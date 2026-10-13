import { pb } from './pocketbase'
import { downloadTextFile } from './integrationDocs'
import { plainText, parsePlace } from './notes'
import { dayKey, timeInputValue } from './dates'

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
  return { notes, people, tags }
}

export async function exportJson() {
  const { notes, people, tags } = await fetchAll()
  const payload = {
    app: 'MyJournal',
    appVersion: typeof __APP_VERSION__ !== 'undefined' ? __APP_VERSION__ : null,
    exportedAt: new Date().toISOString(),
    counts: { notes: notes.length, people: people.length, tags: tags.length },
    people,
    tags,
    notes,
  }
  downloadTextFile(
    `myjournal-export-${stamp()}.json`,
    JSON.stringify(payload, null, 2),
    'application/json;charset=utf-8',
  )
}

export async function exportMarkdown() {
  const { notes, people, tags } = await fetchAll()
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
  out.push('')
  downloadTextFile(`myjournal-export-${stamp()}.md`, out.join('\n'))
}
