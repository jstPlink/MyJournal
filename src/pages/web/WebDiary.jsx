import { useCallback, useEffect, useLayoutEffect, useMemo, useRef, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { useCacheRefresh } from '../../hooks/useConnection'
import { useNav } from '../../context/NavContext'
import { listNotesInRange, groupByDay, displayTitle, parsePlace, describeError } from '../../lib/notes'
import { listPeople } from '../../lib/people'
import { listTags } from '../../lib/tags'
import { useAuth } from '../../context/AuthContext'
import PersonAvatar from '../../components/PersonAvatar'
import PeriodRecapCard from '../../components/PeriodRecapCard'
import { fileUrl } from '../../lib/pocketbase'
import { dayMood, moodColor } from '../../lib/mood'
import { personTapeColor, osmTileFor, tilt } from '../../lib/pagesSkin'
import { ClockNav, ClockDropdownList } from '../../components/web/ClockNav'
import {
  MONTHS_IT,
  addMonths,
  monthDayKeys,
  parseWall,
  weekdayLong,
  isWeekend,
  timeLabel,
} from '../../lib/dates'

// Riga del testo di una nota: «07.40 80 post process foto» → ora, mood
// (due cifre, o «~» = nessuno) e testo; «- 80 bacon e uova» è una voce senza
// ora; il resto è testo libero.
// altezza di una riga del quaderno, come l'interlinea del testo nella nota
const ROW = 27
// fascia vuota in cima a ogni pagina (come in un foglio a righe vero): ci si
// scrive il giorno e ci si incolla il cartoncino del mood
const BAND = 72
// spazio fra una nota e la successiva: due righe del quaderno
const GAP = ROW * 2
const LINE_RE = /^(\d{1,2})[.:](\d{2})\s*(?:(~)|(\d{2,3})\b)?\s*(.*)$/
const SUB_RE = /^[-•]\s*(?:(\d{2,3})\b)?\s*(.*)$/

function parseLines(content) {
  const text = String(content ?? '')
    .replace(/<br\s*\/?>/gi, '\n')
    .replace(/<\/(p|div|li)>/gi, '\n')
    .replace(/<[^>]*>/g, '')
    .replace(/&nbsp;/gi, ' ')
    .replace(/&amp;/gi, '&')
    .replace(/\n+$/, '')
  const out = []
  for (const raw of text.split(/\r?\n/)) {
    const line = raw.trim()
    if (!line) {
      out.push({ kind: 'blank' })
      continue
    }
    let m = line.match(LINE_RE)
    if (m) {
      out.push({ kind: 'time', time: `${m[1].padStart(2, '0')}.${m[2]}`, text: m[5] })
      continue
    }
    m = line.match(SUB_RE)
    if (m) out.push({ kind: 'sub', text: m[2] })
    else out.push({ kind: 'free', text: raw.replace(/\s+$/, '') })
  }
  return out
}

// Altezza arrotondata al multiplo della riga del quaderno (ROW px), così le
// note sotto un blocco di targhette/foto restano sulle righe.
function useSnap(ref, deps) {
  useLayoutEffect(() => {
    const el = ref.current
    if (!el) return
    const fit = () => {
      el.style.height = 'auto'
      el.style.height = `${Math.ceil(el.offsetHeight / ROW) * ROW}px`
    }
    fit()
    const ro = new ResizeObserver(fit)
    ro.observe(el)
    return () => ro.disconnect()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, deps)
}

function placeOf(note) {
  const pl = parsePlace(note.place)
  const name = pl?.name?.trim() || ''
  let map = null
  if (name && Number.isFinite(Number(pl.lat)) && Number.isFinite(Number(pl.lon))) {
    map = osmTileFor(Number(pl.lat), Number(pl.lon), 14)
  }
  return { name, map }
}

// Colonna «da album» a destra del testo (il testo le scorre attorno): foto
// a polaroid sovrapposte e storte, sotto il biglietto del luogo e il disco
// della canzone affiancati.
function NoteAside({ note, asideMax }) {
  const { name, map } = placeOf(note)
  const song = (note.songs || [])[0] || null
  // quante polaroid ci stanno in una pagina insieme a luogo e canzone: la
  // colonna non deve mai superare l'altezza utile del foglio
  const hasMedia = Boolean(name || song)
  const maxPhotos = asideMax ? Math.max(1, Math.floor((asideMax - (hasMedia ? 170 : 0) - 30) / 208)) : 3
  const imgs = (note.images || [])
    .slice(0, Math.min(3, maxPhotos))
    .map((fn) => fileUrl(note, fn, { thumb: '300x300' }))
  if (!name && !song && !imgs.length) return null
  return (
    <span className="dg-aside">
      {imgs.length > 0 && (
        <span className="dg-photos">
          {imgs.map((u, i) => (
            <span
              key={u}
              className="dn-pola"
              style={{ '--pr': `${tilt(`${note.id}p${i}`, 4).toFixed(2)}deg`, '--dx': `${i % 2 ? 16 : -12}px` }}
            >
              <span className="dn-ph" style={{ backgroundImage: `url(${u})` }} />
            </span>
          ))}
        </span>
      )}
      {(name || song) && (
        <span className="dn-media">
          {name && (
            <span className="dg-stampwrap">
              <span className="dn-place">
                <span
                  className={'dn-map' + (map ? ' real' : '')}
                  style={map ? { '--map-url': `url(${map.url})`, '--map-pos': map.pos } : undefined}
                />
                <span className="dn-place-name">{name}</span>
              </span>
            </span>
          )}
          {song && (
            <span className="dn-disc-wrap">
              <span
                className="dn-disc"
                style={song.thumbnailUrl ? { '--cover': `url(${song.thumbnailUrl})` } : undefined}
              />
              {(song.title || song.artist) && (
                <span className="dn-song">
                  {song.title && <span className="t">{song.title}</span>}
                  {song.artist && <span className="a">{song.artist}</span>}
                </span>
              )}
            </span>
          )}
        </span>
      )}
    </span>
  )
}

// Tag e persone in fondo alla nota, su una riga di targhette.
function NoteTapes({ note, peopleById, tagsById, immichUrl, immichApiKey }) {
  const people = (note.people || []).map((id) => peopleById.get(id)).filter(Boolean)
  const tags = (note.tags || []).map((id) => tagsById.get(id)).filter(Boolean)
  if (!people.length && !tags.length) return null
  return (
    <>
      {people.length > 0 && (
        <span className="dn-tapes dg-tapesrow">
          {people.map((pe) => (
            <span key={pe.id} className="dn-tape" style={{ '--tape-c': personTapeColor(pe) }}>
              <PersonAvatar person={pe} immichUrl={immichUrl} immichApiKey={immichApiKey} size={18} />
              <span className="dn-tape-name">{pe.name}</span>
            </span>
          ))}
        </span>
      )}
      {tags.length > 0 && (
        <span className="dn-tapes dg-tapesrow">
          {tags.map((t) => (
            <span key={t.id} className="dn-tag">
              #{t.name}
            </span>
          ))}
        </span>
      )}
    </>
  )
}

// Una nota: titolo, testo (che scorre attorno a foto/luogo/canzone) e
// targhette. `part` (solo per le note più alte di una pagina intera): quale
// pezzo mostrare {from, to, title, tapes}.
function NoteBlock({ n, part, asideMax, peopleById, tagsById, immichUrl, immichApiKey, onOpen }) {
  const ref = useRef(null)
  useSnap(ref, [part?.from, part?.to, part?.skip, part?.endRow])
  const lines = useMemo(() => parseLines(n.content), [n.content])
  const shown = part ? lines.slice(part.from, part.to + 1) : lines
  const showTitle = !part || part.title
  const showTapes = !part || part.tapes
  const showAside = showTitle && !part?.noAside
  return (
    <article
      ref={ref}
      className={'dg-note' + (part && !part.last ? ' dg-part' : '')}
      data-id={n.id}
      style={{ '--nm': moodColor(n.mood), ...(part?.gap != null ? { '--gap': `${part.gap}px` } : null) }}
    >
      <div
        className="dg-open"
        role="link"
        tabIndex={0}
        onClick={() => onOpen(`/note/${n.id}`)}
        onKeyDown={(e) => e.key === 'Enter' && onOpen(`/note/${n.id}`)}
        title="Apri la nota"
      >
        {showTitle && (
          <h3 className="dg-title">
            <span className="dg-tcenter">
              <span className="dg-tcard">
                <span className="dg-time">{timeLabel(n.timeStart)}</span>
                <span className="dg-dash" aria-hidden="true">–</span>
                <span className="dg-title-text">{displayTitle(n.title)}</span>
              </span>
            </span>
            {n.mood != null && (
              <span className="dg-nmood" title="Mood della nota">
                <span className="dg-nmood-in">
                  <em>mood</em>
                  <b>{Math.round(n.mood * 100)}</b>
                </span>
              </span>
            )}
          </h3>
        )}
        {showAside && <NoteAside note={n} asideMax={asideMax} />}
        <div className="dg-body">
          {shown.map((l, i) => {
            const k = (part ? part.from : 0) + i
            const el =
              l.kind === 'time' ? (
                <p key={k} className="dg-line">
                  <span className="dg-lt">{l.time}</span>
                  {l.text}
                </p>
              ) : l.kind === 'blank' ? (
                <p key={k} className="dg-line">
                  {' '}
                </p>
              ) : (
                <p key={k} className={'dg-line' + (l.kind === 'sub' ? ' dg-sub' : '')}>
                  {l.text}
                </p>
              )
            if (!part) return el
            // paragrafo spezzato fra due pagine: si vedono solo le sue righe
            // di questa pagina (le altre restano nascoste sopra/sotto)
            const startRow = k === part.from ? part.skip : 0
            const endRow = k === part.to ? part.endRow : part.rows[k]
            if (startRow === 0 && endRow >= part.rows[k]) return el
            return (
              <div
                key={k}
                className="dg-clip"
                style={{ height: (endRow - startRow) * ROW }}
              >
                <div style={{ marginTop: -startRow * ROW }}>{el}</div>
              </div>
            )
          })}
          {part?.ellipsis && <span className="dg-more">…</span>}
        </div>
        {showTapes && (
          <NoteTapes
            note={n}
            peopleById={peopleById}
            tagsById={tagsById}
            immichUrl={immichUrl}
            immichApiKey={immichApiKey}
          />
        )}
      </div>
    </article>
  )
}

// Cartoncino col riassunto del giorno fatto dall'IA (lo stesso «Recap del
// giorno» della vista giorno). Altezza fissa quando c'è, così la
// paginazione sa quanto posto riservargli; vuoto se non c'è nulla da mostrare.
function DayRecap({ dKey, notes, apiKey }) {
  const outer = useRef(null)
  const inner = useRef(null)
  // il cartoncino arriva in ritardo (si legge dal server): si osserva il
  // contenuto interno, non l'involucro a altezza fissa
  useLayoutEffect(() => {
    const o = outer.current
    const i = inner.current
    if (!o || !i) return
    const fit = () => {
      o.style.height = `${Math.ceil(i.offsetHeight / ROW) * ROW + ROW}px`
    }
    fit()
    const ro = new ResizeObserver(fit)
    ro.observe(i)
    return () => ro.disconnect()
  }, [])
  return (
    <div className="dg-recap" ref={outer}>
      <div className="dg-recap-in" ref={inner}>
        <PeriodRecapCard
          period="day"
          periodKey={dKey}
          notes={notes}
          apiKey={apiKey}
          tab="Riassunto del giorno"
          tabInside
          hideTitle
        />
      </div>
    </div>
  )
}

function DayPage({ page, side, number, ctx }) {
  const { dKey, items, cont } = page
  const p = parseWall(dKey)
  return (
    <section className={`dg-page ${side}${isWeekend(dKey) ? ' wknd' : ''}`}>
      <span className="dg-margin" aria-hidden="true" />
      <div className="dg-band">
        <span className="dg-month">
          {MONTHS_IT[p.mo - 1]} {p.y}
        </span>
        {!cont && (
          <button type="button" className="dg-day" onClick={() => ctx.onOpen(`/day/${dKey}`)} title="Apri il giorno">
            <b>{p.d}</b>
            <span>{weekdayLong(dKey)}</span>
          </button>
        )}
      </div>
      <div className={'dg-scroll'}>
        {page.recap && <DayRecap dKey={dKey} notes={page.dayNotes} apiKey={ctx.geminiApiKey} />}
        {items.map((it, i) => (
          <NoteBlock key={`${it.n.id}-${i}`} n={it.n} part={it.part} {...ctx} />
        ))}
      </div>
      {!cont && page.mood != null && (
        <span className="dg-torn" style={{ '--nm': moodColor(page.mood) }} title="Mood del giorno">
          <span className="dg-torn-card">
            <span className="dg-torn-cap">mood</span>
            <b>{Math.round(page.mood * 100)}</b>
          </span>
        </span>
      )}
      <span className="dg-pn">pagina {number}</span>
    </section>
  )
}

// Distribuisce le note nelle pagine: ogni giorno parte da una pagina nuova e
// una nota intera non si spezza — se non ci sta nello spazio rimasto passa
// alla pagina successiva. Solo una nota più alta di una pagina intera viene
// divisa fra due (o più) pagine, a righe. `hts`: misure delle note,
// `cap`: spazio utile per le note in una pagina.
function paginate(days, hts, cap) {
  const pages = []
  for (const d of days) {
    const sorted = [...d.notes].sort((a, b) => String(a.timeStart).localeCompare(String(b.timeStart)))
    const mood = dayMood(sorted)
    let cur = null
    let used = 0
    // il riassunto del giorno occupa il suo spazio in cima alla prima pagina
    const rh = hts.get(`d:${d.key}`)?.total || 0
    // spazio utile: la prima pagina del giorno ha l'intestazione, quelle di
    // continuazione partono dall'alto
    const room = () => cap
    const fresh = () => {
      const first = cur == null
      cur = { dKey: d.key, items: [], cont: !first, mood, recap: first && rh > 0, dayNotes: sorted }
      pages.push(cur)
      used = first ? rh : 0
    }
    for (const n of sorted) {
      const m = hts.get(n.id) || { total: ROW * 4, title: ROW, lines: [], tapes: 0, aside: 0 }
      if (!cur) fresh()
      // la nota intera ci sta (lo spazio finale non conta a fondo pagina)
      if (used + m.total - GAP <= room()) {
        cur.items.push({ n, part: null })
        used += m.total
        continue
      }
      // altrimenti si divide dove finisce la pagina, anche a metà paragrafo
      // (righe visive); se lo spazio rimasto è troppo poco (titolo + qualche
      // riga, o la colonna delle foto) si riparte dalla pagina dopo
      if (used > 0 && room() - used < Math.max(m.title + ROW * 3, Math.min(m.aside + 10, room()))) {
        fresh()
        if (m.total - GAP <= room()) {
          cur.items.push({ n, part: null })
          used += m.total
          continue
        }
      }
      const rowsOf = m.lines.map((h) => Math.max(1, Math.round(h / ROW)))
      const nl = rowsOf.length
      // un paragrafo accanto alle foto non si taglia: la sua altezza cambia
      // senza la colonna a lato
      const tops = []
      let acc = m.title
      for (const r of rowsOf) {
        tops.push(acc)
        acc += r * ROW
      }
      const canSplit = (k) => m.aside === 0 || tops[k] >= m.title + m.aside + 12
      let i = 0
      let ro = 0
      let first = true
      while (first || i < nl) {
        if (!first) fresh()
        const avail = room() - used - (first ? m.title : 0)
        const availRows = Math.floor(avail / ROW)
        const from = i
        const skip = ro
        let rows = 0
        let to = from - 1
        let endRow = 0
        while (i < nl && rows < availRows) {
          const remain = rowsOf[i] - ro
          if (rows + remain <= availRows) {
            rows += remain
            to = i
            endRow = rowsOf[i]
            i++
            ro = 0
          } else {
            const take = availRows - rows
            if (canSplit(i) && take >= 2 && remain - take >= 2) {
              rows += take
              to = i
              endRow = ro + take
              ro += take
            }
            break
          }
        }
        if (rows === 0 && i < nl && used === 0) {
          // pagina vuota e nemmeno una riga ci sta: la si mette comunque
          rows = rowsOf[i] - ro
          to = i
          endRow = rowsOf[i]
          i++
          ro = 0
        }
        const done = i >= nl
        const tapesFit = done && rows * ROW + m.tapes <= avail
        cur.items.push({
          n,
          part: { from, skip, to, endRow, rows: rowsOf, title: first, tapes: tapesFit, last: done && (tapesFit || !m.tapes) },
        })
        used += (first ? m.title : 0) + rows * ROW + (tapesFit ? m.tapes + GAP : 0)
        first = false
        if (done && !tapesFit && m.tapes > 0) {
          fresh()
          cur.items.push({
            n,
            part: { from: nl, skip: 0, to: nl - 1, endRow: 0, rows: rowsOf, title: false, tapes: true, last: true },
          })
          used += m.tapes + GAP
        }
      }
    }
  }
  return pages
}

// «Vista diario»: ogni giorno del mese con note comincia su una pagina di
// diario nuova (titoli e testo delle note, persone, tag, luoghi, musica,
// foto). Le pagine si sfogliano
// a coppie, come un libro aperto, senza scorrere: se le note di un giorno non
// stanno in una pagina, il giorno continua sulla successiva.
// `phone`: sul telefono la stessa pagina web, ma si vede una pagina alla volta
// (metà sinistra o destra del libro) e l'intestazione è quella dell'app.
export default function WebDiary({ phone = false }) {
  const navigate = useNavigate()
  const { user } = useAuth()
  const { cursor, setCursor } = useNav()
  const [tags, setTags] = useState([])
  const [notes, setNotes] = useState([])
  const [people, setPeople] = useState([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [openYear, setOpenYear] = useState(false)
  const [openMonth, setOpenMonth] = useState(false)
  const [spread, setSpread] = useState(0)
  const [half, setHalf] = useState(0) // telefono: 0 = pagina sinistra, 1 = destra
  const [heights, setHeights] = useState(() => new Map())
  const [cap, setCap] = useState(0)
  const navRef = useRef(null)
  const bookRef = useRef(null)
  const measureRef = useRef(null)
  const positioned = useRef('')
  // dopo un cambio mese dai bordi del libro: 'end' = ultima pagina, 'start' = prima
  const pending = useRef(null)

  useEffect(() => {
    if (!openYear && !openMonth) return
    const onDown = (e) => {
      if (navRef.current && !navRef.current.contains(e.target)) {
        setOpenYear(false)
        setOpenMonth(false)
      }
    }
    const onKey = (e) => {
      if (e.key === 'Escape') {
        setOpenYear(false)
        setOpenMonth(false)
      }
    }
    document.addEventListener('pointerdown', onDown)
    document.addEventListener('keydown', onKey)
    return () => {
      document.removeEventListener('pointerdown', onDown)
      document.removeEventListener('keydown', onKey)
    }
  }, [openYear, openMonth])

  const keys = useMemo(() => monthDayKeys(cursor.year, cursor.month), [cursor.year, cursor.month])

  const yearOptions = useMemo(() => {
    const now = new Date().getFullYear()
    const base = Math.max(cursor.year, now)
    const years = []
    for (let y = base + 2; y >= base - 12; y--) years.push(y)
    return years
  }, [cursor.year])

  const load = useCallback(async () => {
    setLoading(true)
    setError('')
    try {
      setNotes(
        await listNotesInRange({
          start: `${keys[0]} 00:00:00.000Z`,
          end: `${keys[keys.length - 1]} 23:59:59.999Z`,
        }),
      )
    } catch (err) {
      setError(describeError(err))
      setNotes([])
    } finally {
      setLoading(false)
    }
  }, [keys])

  useEffect(() => {
    load()
  }, [load])
  useCacheRefresh(load)

  useEffect(() => {
    listPeople()
      .then(setPeople)
      .catch(() => setPeople([]))
    listTags()
      .then(setTags)
      .catch(() => setTags([]))
  }, [])
  const tagsById = useMemo(() => new Map(tags.map((t) => [t.id, t])), [tags])
  const peopleById = useMemo(() => new Map(people.map((p) => [p.id, p])), [people])

  const days = useMemo(() => {
    const byDay = groupByDay(notes)
    return keys.filter((k) => byDay.has(k)).map((k) => ({ key: k, notes: byDay.get(k) }))
  }, [notes, keys])
  const allNotes = useMemo(() => days.flatMap((d) => d.notes), [days])

  // Misura l'altezza di ogni nota (in un livello nascosto largo come il testo
  // di una pagina) e lo spazio utile di una pagina; si rifà quando cambia
  // qualcosa (finestra, caratteri, immagini, targhette che arrivano).
  useLayoutEffect(() => {
    const book = bookRef.current
    const box = measureRef.current
    if (!book || !box) return
    const measure = () => {
      const pageW = book.clientWidth / 2
      box.style.width = `${Math.max(200, pageW - 92)}px`
      const next = new Map()
      box.querySelectorAll('[data-id]').forEach((el) =>
        next.set(el.dataset.id, {
          total: el.offsetHeight,
          // il titolo lascia una riga vuota sotto di sé
          title: (el.querySelector('.dg-title')?.offsetHeight || 0) + ROW,
          lines: [...el.querySelectorAll('.dg-line')].map((l) => l.offsetHeight),
          tapes: [...el.querySelectorAll('.dg-tapesrow')].reduce((sum, r) => sum + r.offsetHeight, 0),
          aside: el.querySelector('.dg-aside')?.offsetHeight || 0,
        }),
      )
      box.querySelectorAll('[data-day]').forEach((el) =>
        next.set(`d:${el.dataset.day}`, { total: el.offsetHeight }),
      )
      setHeights((old) => {
        const key = (m) => JSON.stringify([...m])
        return key(old) === key(next) ? old : next
      })
      // pagina: 34px in basso (numero), 1 in alto e 10 sotto il testo
      // una riga di margine sopra il testo
      setCap(book.clientHeight - BAND - 34 - 1 - ROW - 10 - 14)
    }
    measure()
    const ro = new ResizeObserver(measure)
    ro.observe(book)
    ro.observe(box)
    document.fonts?.ready.then(measure)
    return () => ro.disconnect()
  }, [allNotes, peopleById, tagsById])

  const pages = useMemo(() => paginate(days, heights, cap), [days, heights, cap])
  const spreadCount = Math.max(1, Math.ceil(pages.length / 2))

  // all'apertura (mese corrente) si parte dalla pagina del giorno di oggi, o
  // dall'ultimo giorno scritto fino a oggi; negli altri mesi dalla prima coppia
  useEffect(() => {
    const id = `${cursor.year}-${cursor.month}`
    if (loading || cap <= 0 || positioned.current === id) return
    positioned.current = id
    const now = new Date()
    let target = 0
    if (pending.current) {
      target = 0
    } else if (now.getFullYear() === cursor.year && now.getMonth() === cursor.month) {
      const today = keys[now.getDate() - 1]
      for (let i = 0; i < pages.length; i++) {
        if (pages[i].dKey <= today) target = i
      }
    }
    setSpread(Math.floor(target / 2))
    setHalf(pending.current === 'end' ? 1 : target % 2)
  }, [loading, cap, pages, keys, cursor.year, cursor.month])

  const cur = Math.min(spread, spreadCount - 1)
  // sfogliamento: una pagina si gira (rotateY) sopra le due sottostanti
  const [flip, setFlip] = useState(null)
  const go = useCallback(
    (n) => {
      if (flip) return
      // dalla prima pagina indietro si va al mese prima, dall'ultima avanti al successivo
      if (cur + n < 0) {
        pending.current = 'end'
        setCursor((c) => addMonths(c, -1))
        return
      }
      if (cur + n > spreadCount - 1) {
        pending.current = 'start'
        setCursor((c) => addMonths(c, 1))
        return
      }
      pending.current = null
      const to = cur + n
      if (to === cur) return
      setFlip({ dir: to > cur ? 1 : -1, from: cur, to })
      setTimeout(() => {
        setSpread(to)
        setFlip(null)
      }, 720)
    },
    [flip, cur, spreadCount, setCursor],
  )

  // telefono: si sfoglia una pagina alla volta; a fine coppia si gira davvero
  const step = useCallback(
    (n) => {
      if (!phone) return go(n)
      if (n > 0 && half === 0) setHalf(1)
      else if (n < 0 && half === 1) setHalf(0)
      else {
        go(n)
        setHalf(n > 0 ? 0 : 1)
      }
    },
    [phone, half, go],
  )

  // telefono: swipe orizzontale per cambiare pagina (sinistra = avanti)
  const swipeStart = useRef(null)
  const swipe = {
    down: (e) => {
      swipeStart.current = { x: e.clientX, y: e.clientY }
    },
    up: (e) => {
      const s0 = swipeStart.current
      swipeStart.current = null
      if (!s0) return
      const dx = e.clientX - s0.x
      const dy = e.clientY - s0.y
      if (Math.abs(dx) > 40 && Math.abs(dx) > Math.abs(dy) * 1.5) step(dx < 0 ? 1 : -1)
    },
  }

  // arrivati nel mese precedente, si resta sull'ultima coppia di pagine anche
  // mentre le misure si assestano
  useEffect(() => {
    if (pending.current === 'end' && !loading) setSpread(spreadCount - 1)
  }, [pages, loading, spreadCount])

  useEffect(() => {
    const onKey = (e) => {
      if (e.target.closest?.('input, textarea, [contenteditable]')) return
      if (e.key === 'ArrowLeft') step(-1)
      else if (e.key === 'ArrowRight') step(1)
    }
    document.addEventListener('keydown', onKey)
    return () => document.removeEventListener('keydown', onKey)
  }, [step])

  const ctx = {
    peopleById,
    tagsById,
    immichUrl: user?.immichUrl?.trim(),
    immichApiKey: user?.immichApiKey?.trim(),
    onOpen: navigate,
    geminiApiKey: user?.geminiApiKey?.trim(),
    asideMax: cap > 0 ? cap - ROW * 2 : 0,
  }

  const renderPage = (idx) => {
    if (idx >= pages.length) return <section className="dg-page empty" />
    return <DayPage page={pages[idx]} side={idx % 2 === 0 ? 'l' : 'r'} number={idx + 1} ctx={ctx} />
  }

  return (
    <div
      className={'dg-wrap' + (phone ? ` phone h${half}` : '')}
      {...(phone ? { onPointerDown: swipe.down, onPointerUp: swipe.up } : null)}
    >
      {!phone && (
      <div className="dg-banner sticky top-0 z-10 mb-[50px] mt-[40px] w-full bg-cream">
        <span className="header-quadretti bleed-month" aria-hidden="true" />
        <header className="relative z-[1] grid grid-cols-[1fr_auto_1fr] items-center gap-4 px-4">
          <h1 className="wd-page-title justify-self-start">
            Diario
            <span className="hl" aria-hidden="true" />
          </h1>
          <div ref={navRef} className="flex flex-wrap items-center gap-3 justify-self-center">
            <ClockNav
              label={cursor.year}
              ariaLabel="Scegli anno"
              prevLabel="Anno precedente"
              nextLabel="Anno successivo"
              open={openYear}
              onPrev={() => setCursor((c) => ({ ...c, year: c.year - 1 }))}
              onNext={() => setCursor((c) => ({ ...c, year: c.year + 1 }))}
              onToggle={() => {
                setOpenYear((v) => !v)
                setOpenMonth(false)
              }}
              dropdown={
                <ClockDropdownList
                  items={yearOptions.map((y) => ({
                    key: y,
                    label: y,
                    active: y === cursor.year,
                    onClick: () => {
                      setCursor((c) => ({ ...c, year: y }))
                      setOpenYear(false)
                    },
                  }))}
                />
              }
            />
            <ClockNav
              label={MONTHS_IT[cursor.month]}
              ariaLabel="Scegli mese"
              prevLabel="Mese precedente"
              nextLabel="Mese successivo"
              open={openMonth}
              onPrev={() => setCursor((c) => addMonths(c, -1))}
              onNext={() => setCursor((c) => addMonths(c, 1))}
              onToggle={() => {
                setOpenMonth((v) => !v)
                setOpenYear(false)
              }}
              dropdown={
                <ClockDropdownList
                  wide
                  items={MONTHS_IT.map((m, i) => ({
                    key: m,
                    label: m,
                    active: i === cursor.month,
                    onClick: () => {
                      setCursor((c) => ({ ...c, month: i }))
                      setOpenMonth(false)
                    },
                  }))}
                />
              }
            />
          </div>
          <span className="justify-self-end text-sm text-ink-soft">{loading && 'Aggiorno…'}</span>
        </header>
      </div>
      )}

      {error && (
        <p className="mb-4 rounded-2xl bg-delete/15 px-4 py-3 text-sm text-delete-dark">{error}</p>
      )}

      <div className="dg-stage">
      <div className="dg-book" ref={bookRef}>
        {flip ? (
          <>
            {renderPage(flip.dir > 0 ? flip.from * 2 : flip.to * 2)}
            {renderPage(flip.dir > 0 ? flip.to * 2 + 1 : flip.from * 2 + 1)}
            <div className={'dg-leaf ' + (flip.dir > 0 ? 'next' : 'prev')}>
              <div className="dg-face front">
                {renderPage(flip.dir > 0 ? flip.from * 2 + 1 : flip.from * 2)}
              </div>
              <div className="dg-face back">
                {renderPage(flip.dir > 0 ? flip.to * 2 : flip.to * 2 + 1)}
              </div>
            </div>
          </>
        ) : (
          <>
            {renderPage(cur * 2)}
            {renderPage(cur * 2 + 1)}
          </>
        )}
        {!phone && (
          <>
        <button
          type="button"
          className="dg-flip l"
          aria-label="Pagine precedenti"
          onClick={() => step(-1)}
        >
          ‹
        </button>
        <button
          type="button"
          className="dg-flip r"
          aria-label="Pagine successive"
          onClick={() => step(1)}
        >
          ›
        </button>
          </>
        )}
      </div>

      </div>

      {/* livello nascosto per misurare le note (stessa larghezza del testo) */}
      <div className="dg-measure" ref={measureRef} aria-hidden="true">
        {days.map((d) => (
          <div key={d.key} data-day={d.key}>
            <DayRecap dKey={d.key} notes={d.notes} apiKey={ctx.geminiApiKey} />
          </div>
        ))}
        {allNotes.map((n) => (
          <NoteBlock key={n.id} n={n} {...ctx} onOpen={() => {}} />
        ))}
      </div>
    </div>
  )
}
