import { pb } from './pocketbase'
import { downloadTextFile } from './integrationDocs'
import { plainText, parsePlace } from './notes'
import { MONTHS_IT, dayKey, timeInputValue } from './dates'
import { listDreamsFiltered, dreamTitle } from './dreams'
import { getMonthRecap, getYearRecap } from './recaps'

// Export completo del diario (client-side). Le immagini restano sul server:
// l'export contiene i nomi file, non i binari.

function stamp() {
  return new Date().toISOString().slice(0, 10)
}

async function fetchAll() {
  const [notes, people, tags] = await Promise.all([
    pb.collection('note').getFullList({ sort: 'date,timeStart' }),
    pb.collection('people').getFullList({ sort: 'name' }),
    pb.collection('tags').getFullList({ sort: 'name' }),
  ])
  // i sogni (collection a parte); se il server non l'ha ancora la lista è vuota
  const dreams = await listDreamsFiltered()
  dreams.reverse() // dal più vecchio al più recente, come le note
  return { notes, people, tags, dreams }
}

export async function exportJson() {
  const { notes, people, tags, dreams } = await fetchAll()
  const payload = {
    app: 'MyJournal',
    appVersion: typeof __APP_VERSION__ !== 'undefined' ? __APP_VERSION__ : null,
    exportedAt: new Date().toISOString(),
    counts: { notes: notes.length, people: people.length, tags: tags.length, dreams: dreams.length },
    people,
    tags,
    notes,
    dreams,
  }
  downloadTextFile(
    `myjournal-export-${stamp()}.json`,
    JSON.stringify(payload, null, 2),
    'application/json;charset=utf-8',
  )
}

export async function exportMarkdown() {
  const { notes, people, tags, dreams } = await fetchAll()
  const pById = new Map(people.map((p) => [p.id, p.name]))
  const tById = new Map(tags.map((t) => [t.id, t.name]))

  const out = [`# MyJournal — export ${stamp()}`, '', `${notes.length} note.`]
  let currentDay = ''
  for (const n of notes) {
    const dk = dayKey(n.date)
    if (dk !== currentDay) {
      currentDay = dk
      out.push('', `## ${dk}`)
    }
    const time = `${timeInputValue(n.timeStart)}–${timeInputValue(n.timeEnd)}`
    out.push('', `### ${time} · ${n.title?.trim() || '(senza titolo)'}`)

    const meta = [`Mood: ${Math.round(Number(n.mood) * 100)}/100`]
    const ppl = (n.people || []).map((id) => pById.get(id)).filter(Boolean)
    const tgs = (n.tags || []).map((id) => tById.get(id)).filter(Boolean)
    if (ppl.length) meta.push(`Persone: ${ppl.join(', ')}`)
    if (tgs.length) meta.push(`Tag: ${tgs.join(', ')}`)
    const place = parsePlace(n.place)
    if (place?.name) meta.push(`Luogo: ${place.name}`)
    if (Array.isArray(n.songs) && n.songs.length) {
      meta.push(`Canzoni: ${n.songs.map((s) => s.title).filter(Boolean).join(', ')}`)
    }
    if ((n.images || []).length) meta.push(`Immagini: ${n.images.length}`)
    out.push('', meta.join('  \n'))

    const body = plainText(n.content)
    if (body) out.push('', body)
  }
  if (dreams.length) {
    out.push('', '## Sogni', '', `${dreams.length} sogni.`)
    for (const d of dreams) {
      out.push('', `### ${dayKey(d.date)} ${timeInputValue(d.time)} · ${dreamTitle(d)}`)
      out.push('', `Nitidezza: ${Math.round(Number(d.clarity) * 100)}/100`)
      const body = plainText(d.content)
      if (body) out.push('', body)
    }
  }
  out.push('')
  downloadTextFile(`myjournal-export-${stamp()}.md`, out.join('\n'))
}

// Dati di un anno, già raggruppati per mese: note e sogni insieme, in ordine di giorno e orario.
// Solo contenuti (niente pulsanti né altri elementi dell'editor).
async function fetchYear(year) {
  const start = `${year}-01-01 00:00:00.000Z`
  const end = `${year}-12-31 23:59:59.999Z`
  const [notes, people, tags, dreams, yearRecap] = await Promise.all([
    pb.collection('note').getFullList({
      filter: pb.filter('date >= {:start} && date <= {:end}', { start, end }),
      sort: 'date,timeStart',
    }),
    pb.collection('people').getFullList({ sort: 'name' }),
    pb.collection('tags').getFullList({ sort: 'name' }),
    listDreamsFiltered({ start, end }),
    getYearRecap(year),
  ])
  dreams.reverse() // dal più vecchio al più recente
  const pById = new Map(people.map((x) => [x.id, x.name]))
  const tById = new Map(tags.map((t) => [t.id, t.name]))

  const months = []
  for (let m = 0; m < 12; m++) {
    const mk = `${year}-${String(m + 1).padStart(2, '0')}`
    const items = [
      ...notes
        .filter((n) => dayKey(n.date).startsWith(mk))
        .map((n) => {
          const place = parsePlace(n.place)
          return {
            kind: 'nota',
            day: dayKey(n.date),
            time: `${timeInputValue(n.timeStart)}–${timeInputValue(n.timeEnd)}`,
            sort: timeInputValue(n.timeStart),
            title: n.title?.trim() || '(senza titolo)',
            mood: Math.round(Number(n.mood) * 100),
            people: (n.people || []).map((id) => pById.get(id)).filter(Boolean),
            tags: (n.tags || []).map((id) => tById.get(id)).filter(Boolean),
            place: place?.name || '',
            songs: Array.isArray(n.songs) ? n.songs.map((sg) => sg.title).filter(Boolean) : [],
            images: (n.images || []).length,
            body: plainText(n.content),
          }
        }),
      ...dreams
        .filter((d) => dayKey(d.date).startsWith(mk))
        .map((d) => ({
          kind: 'sogno',
          day: dayKey(d.date),
          time: timeInputValue(d.time),
          sort: timeInputValue(d.time),
          title: dreamTitle(d),
          body: plainText(d.content),
        })),
    ].sort((a, b) => (a.day + a.sort < b.day + b.sort ? -1 : 1))
    if (!items.length) continue
    months.push({ m, name: `${MONTHS_IT[m]} ${year}`, recap: await getMonthRecap(mk), items })
  }
  return { year, noteCount: notes.length, dreamCount: dreams.length, yearRecap, months }
}

function noteMeta(it) {
  const meta = [`Mood: ${it.mood}/100`]
  if (it.people.length) meta.push(`Persone: ${it.people.join(', ')}`)
  if (it.tags.length) meta.push(`Tag: ${it.tags.join(', ')}`)
  if (it.place) meta.push(`Luogo: ${it.place}`)
  if (it.songs.length) meta.push(`Canzoni: ${it.songs.join(', ')}`)
  if (it.images) meta.push(`Immagini: ${it.images}`)
  return meta
}

// Un anno del diario in Markdown: riassunto dell'anno, poi mese per mese (riassunto del mese,
// note e sogni giorno per giorno). Le immagini restano sul server: se ne indica solo il numero.
export async function exportYearMarkdown(year) {
  const d = await fetchYear(year)
  const out = [`# Diario ${year}`, '', `${d.noteCount} note, ${d.dreamCount} sogni.`]
  if (d.yearRecap) out.push('', `## Riassunto dell'anno`, '', d.yearRecap)
  for (const mo of d.months) {
    out.push('', `## ${mo.name}`)
    if (mo.recap) out.push('', `_Riassunto del mese:_ ${mo.recap}`)
    let day = ''
    for (const it of mo.items) {
      if (it.day !== day) {
        day = it.day
        out.push('', `### ${it.day}`)
      }
      if (it.kind === 'sogno') {
        out.push('', `#### ${it.time} · Sogno: ${it.title}`)
      } else {
        out.push('', `#### ${it.time} · ${it.title}`, '', noteMeta(it).join('  \n'))
      }
      if (it.body) out.push('', it.body)
    }
  }
  out.push('')
  downloadTextFile(`diario-${year}.md`, out.join('\n'))
}

const esc = (t) =>
  String(t ?? '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
const paragraphs = (t) =>
  String(t || '')
    .split(/\n+/)
    .map((x) => x.trim())
    .filter(Boolean)
    .map((x) => `<p>${esc(x)}</p>`)
    .join('')

// Un anno del diario come documento stampabile (A4): si apre la finestra di stampa del browser,
// da cui si sceglie «Salva come PDF». Contiene solo i contenuti del diario.
export async function exportYearPdf(year) {
  const d = await fetchYear(year)
  const parts = [
    `<section class="cover"><div class="kick">anno</div><h1>${year}</h1><div class="orn">✦</div>`,
    d.yearRecap ? `<div class="recap">${paragraphs(d.yearRecap)}</div>` : '',
    `<div class="count">${d.noteCount} note · ${d.dreamCount} sogni</div></section>`,
  ]
  for (const mo of d.months) {
    parts.push(`<section class="month"><h2>${esc(mo.name)}</h2>`)
    if (mo.recap) parts.push(`<div class="recap">${paragraphs(mo.recap)}</div>`)
    let day = ''
    for (const it of mo.items) {
      if (it.day !== day) {
        day = it.day
        parts.push(`<h3>${esc(it.day)}</h3>`)
      }
      if (it.kind === 'sogno') {
        parts.push(`<article class="dream"><h4><span>${esc(it.time)}</span> Sogno: ${esc(it.title)}</h4>${paragraphs(it.body)}</article>`)
      } else {
        parts.push(
          `<article><h4><span>${esc(it.time)}</span> ${esc(it.title)}</h4><div class="meta">${esc(noteMeta(it).join(' · '))}</div>${paragraphs(it.body)}</article>`,
        )
      }
    }
    parts.push('</section>')
  }
  const html = `<!doctype html><html lang="it"><head><meta charset="utf-8"><title>Diario ${year}</title><style>
@page { size: A4; margin: 18mm 16mm; }
* { box-sizing: border-box; }
body { margin: 0; font: 11pt/1.5 Georgia, 'Times New Roman', serif; color: #2a2118; }
.cover { text-align: center; padding-top: 60mm; page-break-after: always; }
.kick { font: 700 9pt sans-serif; letter-spacing: .35em; text-transform: uppercase; color: #b08d3c; }
h1 { font: 400 64pt/1 Georgia, serif; letter-spacing: .06em; color: #1f2f52; margin: 6mm 0; }
.orn { color: #b08d3c; margin: 6mm 0; }
.recap { text-align: justify; margin: 8mm 10mm; }
.count { font: italic 11pt Georgia, serif; color: #7a6a4d; }
.month { page-break-before: always; }
h2 { font: 400 26pt Georgia, serif; color: #8f2f1b; border-bottom: 1px solid #b08d3c; padding-bottom: 2mm; }
h3 { font: 700 10pt sans-serif; letter-spacing: .12em; text-transform: uppercase; color: #b08d3c; margin: 7mm 0 2mm; page-break-after: avoid; }
article { margin: 0 0 4mm; page-break-inside: avoid; }
h4 { font: 700 12pt Georgia, serif; margin: 0; color: #1f2f52; page-break-after: avoid; }
h4 span { font: 700 9pt sans-serif; color: #7a6a4d; margin-right: 2mm; }
.meta { font: 8.5pt sans-serif; color: #7a6a4d; margin: 0 0 1mm; }
p { margin: 0 0 1.5mm; text-align: justify; }
.dream { border-left: 2px solid #8aa8d0; padding-left: 4mm; }
.dream h4 { color: #3b5a8a; font-style: italic; }
</style></head><body>${parts.join('')}</body></html>`

  // finestra di stampa in un iframe nascosto (niente popup da sbloccare)
  const frame = document.createElement('iframe')
  frame.style.cssText = 'position:fixed;right:0;bottom:0;width:0;height:0;border:0'
  document.body.appendChild(frame)
  frame.onload = () => {
    frame.contentWindow.focus()
    frame.contentWindow.print()
    setTimeout(() => frame.remove(), 60000)
  }
  frame.srcdoc = html
}
