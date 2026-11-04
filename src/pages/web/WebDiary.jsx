import { useCallback, useEffect, useLayoutEffect, useMemo, useRef, useState } from 'react'
import { createPortal } from 'react-dom'
import { useNavigate } from 'react-router-dom'
import { useCacheRefresh } from '../../hooks/useConnection'
import { useNav } from '../../context/NavContext'
import { listNotesInRange, groupByDay, displayTitle, parsePlace, describeError } from '../../lib/notes'
import { listPeople } from '../../lib/people'
import { listDreamsInRange, dreamTitle } from '../../lib/dreams'
import { getYearRecap, regenerateYearRecap, listDayRecapsInYear } from '../../lib/recaps'
import { exportYearMarkdown, exportYearPdf } from '../../lib/exportData'

// orario del sogno (il campo `time` ha una data segnaposto)
const dreamTime = (d) => parseWall(d.time) || { h: 0, mi: 0 }

// un sogno si impagina come una nota (senza mood)
const dreamAsNote = (d) => ({
  id: `dream-${d.id}`,
  dreamId: d.id,
  isDream: true,
  title: `Sogno: ${dreamTitle(d)}`,
  content: d.content || '',
  date: d.date,
  timeStart: `${dayKey(d.date)} ${String(dreamTime(d).h).padStart(2, '0')}:${String(dreamTime(d).mi).padStart(2, '0')}:00.000Z`,
  mood: null,
})
import { listTags } from '../../lib/tags'
import { useAuth } from '../../context/AuthContext'
import PersonAvatar from '../../components/PersonAvatar'
import Icon from '../../components/Icon'
import PeriodRecapCard from '../../components/PeriodRecapCard'
import { fileUrl } from '../../lib/pocketbase'
import { dayMood, moodColor } from '../../lib/mood'
import { personTapeColor, osmTileFor, tilt, yellowOf } from '../../lib/pagesSkin'

// nastri adesivi: una tavolozza per tipo (mood, riassunto, sogno), colore scelto a caso
// ma stabile per ogni elemento
const TAPES = {
  mood: ['rgba(247,198,207,.78)', 'rgba(250,225,160,.78)', 'rgba(244,190,160,.78)', 'rgba(250,240,170,.78)'],
  recap: ['rgba(180,222,200,.78)', 'rgba(175,212,240,.78)', 'rgba(205,195,240,.78)', 'rgba(190,235,225,.78)'],
  dream: ['rgba(245,185,215,.78)', 'rgba(200,185,240,.78)', 'rgba(250,205,225,.78)', 'rgba(185,200,245,.78)'],
}
const tapeOf = (kind, key, i = 0) => {
  const list = TAPES[kind]
  return list[Math.floor((tilt(`${key}${kind}${i}`, 0.5) + 0.5) * list.length) % list.length]
}
import { ClockNav, ClockDropdownList } from '../../components/web/ClockNav'
import {
  MONTHS_IT,
  addMonths,
  monthDayKeys,
  parseWall,
  dayKey,
  dayMonthLabel,
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
function NoteAside({ note, asideMax, ghost = false }) {
  const { name, map } = placeOf(note)
  const song = (note.songs || [])[0] || null
  // quante polaroid ci stanno in una pagina insieme a luogo e canzone: la
  // colonna non deve mai superare l'altezza utile del foglio
  const hasMedia = Boolean(name || song)
  const maxPhotos = asideMax ? Math.max(1, Math.floor((asideMax - (hasMedia ? 170 : 0) - 30) / 208)) : 3
  const imgs = (note.images || [])
    .slice(0, Math.min(3, maxPhotos))
    .map((fn) => (ghost ? '' : fileUrl(note, fn, { thumb: '300x300' })))
  if (!name && !song && !imgs.length) return null
  return (
    <span className="dg-aside">
      {imgs.length > 0 && (
        <span className="dg-photos">
          {imgs.map((u, i) => (
            <span
              key={`${u}${i}`}
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
                  className={'dn-map' + (map && !ghost ? ' real' : '')}
                  style={map && !ghost ? { '--map-url': `url(${map.url})`, '--map-pos': map.pos } : undefined}
                />
                <span className="dn-place-name">{name}</span>
              </span>
            </span>
          )}
          {song && (
            <span className="dn-disc-wrap">
              <span
                className="dn-disc"
                style={song.thumbnailUrl && !ghost ? { '--cover': `url(${song.thumbnailUrl})` } : undefined}
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
function NoteTapes({ note, peopleById, tagsById, immichUrl, immichApiKey, ghost = false }) {
  const people = (note.people || []).map((id) => peopleById.get(id)).filter(Boolean)
  const tags = (note.tags || []).map((id) => tagsById.get(id)).filter(Boolean)
  if (!people.length && !tags.length) return null
  return (
    <>
      {people.length > 0 && (
        <span className="dn-tapes dg-tapesrow">
          {people.map((pe) => (
            <span key={pe.id} className="dn-tape" style={{ '--tape-c': personTapeColor(pe) }}>
              {ghost ? (
                <span style={{ display: 'inline-block', width: 18, height: 18 }} />
              ) : (
                <PersonAvatar person={pe} immichUrl={immichUrl} immichApiKey={immichApiKey} size={18} />
              )}
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
function NoteBlock({ n, part, asideMax, peopleById, tagsById, immichUrl, immichApiKey, onOpen, ghost = false }) {
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
      className={'dg-note' + (n.isDream ? ' dg-dream' : '') + (part && !part.last ? ' dg-part' : '')}
      data-id={n.id}
      style={{ '--nm': n.isDream ? '#a9c8e8' : moodColor(n.mood), ...(part?.gap != null ? { '--gap': `${part.gap}px` } : null) }}
    >
      <div
        className="dg-open"
        role="link"
        tabIndex={0}
        onClick={() => onOpen(n.isDream ? `/dream/${n.dreamId}` : `/note/${n.id}`)}
        onKeyDown={(e) => e.key === 'Enter' && onOpen(n.isDream ? `/dream/${n.dreamId}` : `/note/${n.id}`)}
        title="Apri la nota"
      >
        {showTitle && (
          <h3 className="dg-title">
            <span className="dg-tcenter" style={{ transform: `rotate(${tilt(`${n.id}tc`, 1.4).toFixed(2)}deg)`, transformOrigin: 'left center' }}>
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
        {showAside && <NoteAside note={n} asideMax={asideMax} ghost={ghost} />}
        <div className="dg-body">
          {n.isDream && (
            <span
              className="dg-cloudwrap"
              aria-hidden="true"
              style={{ '--rot': `${tilt(`${n.id}cl`, 1.2).toFixed(2)}deg` }}
            >
              <i className="b" />
              <i className="f" />
              <u className="tp tr" style={{ '--tape': tapeOf('dream', n.id, 0) }} />
              <u className="tp bl" style={{ '--tape': tapeOf('dream', n.id, 1) }} />
            </span>
          )}
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
            ghost={ghost}
          />
        )}
      </div>
    </article>
  )
}

// Cartoncino col riassunto del giorno fatto dall'IA (lo stesso «Recap del
// giorno» della vista giorno). Altezza fissa quando c'è, così la
// paginazione sa quanto posto riservargli; vuoto se non c'è nulla da mostrare.
function DayRecap({ dKey, notes, apiKey, text }) {
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
    <div
      className="dg-recap"
      ref={outer}
      style={{ '--rr': `${tilt(`${dKey}rc`, 1.3).toFixed(2)}deg`, '--tape': tapeOf('recap', dKey), '--ycol': yellowOf(dKey) }}
    >
      <div className="dg-recap-in" ref={inner}>
        {text !== undefined ? (
          // export: il testo c'è già, niente richieste e niente pulsanti
          <section className="prc-card">
            <div className="prc-head">
              <span className="st-label prc-tab-in">
                <Icon name="sparkles" size={12} />
                Riassunto del giorno
              </span>
            </div>
            <p className="prc-text">{text}</p>
          </section>
        ) : (
          <PeriodRecapCard
            period="day"
            periodKey={dKey}
            notes={notes}
            apiKey={apiKey}
            tab="Riassunto del giorno"
            tabInside
            hideTitle
          />
        )}
      </div>
    </div>
  )
}

// Copertine a tema stagione: colori e decori agli angoli (simbolo, colore, rotazione, misura, posizione)
const SEASONS = {
  autunno: {
    bg: '#f6ecd2', fc: '#c9ad7a', fc2: '#d9c294', tc: '#8f2f1b', yc: '#9a8a68',
    decor: [
      ['leaf', '#c9772f', 20, 56, { left: 34, top: 30 }],
      ['leaf', '#a0522d', -35, 44, { left: 88, top: 28 }],
      ['leaf', '#d9a441', 70, 38, { left: 30, top: 74 }],
      ['leaf', '#b0652a', 200, 80, { right: 30, bottom: 30 }],
      ['leaf', '#d9a441', 150, 62, { right: 94, bottom: 26 }],
      ['leaf', '#a0522d', 240, 58, { right: 26, bottom: 96 }],
    ],
  },
  primavera: {
    bg: '#f2f4df', fc: '#a9c48a', fc2: '#c4d7ad', tc: '#3f6b2f', yc: '#8aa070',
    decor: [
      ['flower', '#e98fae', 10, 58, { left: 34, top: 28 }],
      ['flower', '#f6b84f', -20, 44, { left: 98, top: 30 }],
      ['leaf', '#78b35a', 60, 40, { left: 30, top: 76 }],
      ['flower', '#c98fe0', -10, 80, { right: 30, bottom: 30 }],
      ['flower', '#e98fae', 30, 60, { right: 112, bottom: 28 }],
      ['leaf', '#78b35a', 200, 58, { right: 26, bottom: 108 }],
    ],
  },
  estate: {
    bg: '#fbf2d2', fc: '#e0b25a', fc2: '#ecd08e', tc: '#c4571f', yc: '#c9a15c',
    decor: [
      ['sun', '#f2a81d', 0, 72, { left: 28, top: 18 }],
      ['shell', '#f2a07a', 20, 76, { right: 30, bottom: 30 }],
      ['shell', '#e8c27a', -30, 58, { right: 112, bottom: 26 }],
      ['shell', '#f08a6a', 15, 52, { right: 26, bottom: 108 }],
    ],
  },
  inverno: {
    bg: '#edf3f9', fc: '#9fb7d0', fc2: '#bccfe2', tc: '#2f4e7a', yc: '#8aa2c0',
    decor: [
      ['snow', '#7ea3cc', 10, 60, { left: 34, top: 26 }],
      ['snow', '#a9c3de', -20, 40, { left: 104, top: 30 }],
      ['snow', '#9fb7d0', 30, 30, { left: 36, top: 84 }],
      ['snow', '#7ea3cc', 20, 84, { right: 30, bottom: 30 }],
      ['snow', '#a9c3de', -10, 56, { right: 122, bottom: 30 }],
      ['snow', '#9fb7d0', 40, 46, { right: 30, bottom: 124 }],
    ],
  },
}
const seasonOf = (month) =>
  month === 11 || month < 2 ? 'inverno' : month < 5 ? 'primavera' : month < 8 ? 'estate' : 'autunno'

// sinistra e destra scambiate: la seconda pagina ha i decori speculari
const flipPos = (pos) =>
  Object.fromEntries(Object.entries(pos).map(([k, v]) => [k === 'left' ? 'right' : k === 'right' ? 'left' : k, v]))

// Simboli, cornice (piena e tratteggiata) e decori agli angoli delle pagine di apertura
function CoverDecor({ season, mirror = false }) {
  return (
    <>
      <svg width="0" height="0" style={{ position: 'absolute' }} aria-hidden="true">
        <defs>
          <symbol id="dgc-leaf" viewBox="0 0 24 24">
            <path d="M12 1C5 8 3 15 12 23 21 15 19 8 12 1Z" fill="currentColor" />
            <path d="M12 5V22" stroke="rgba(60,30,10,.35)" strokeWidth="1" fill="none" />
          </symbol>
          <symbol id="dgc-flower" viewBox="0 0 24 24">
            <g fill="currentColor">
              <circle cx="12" cy="5.5" r="4.2" />
              <circle cx="18.2" cy="10" r="4.2" />
              <circle cx="15.8" cy="17.3" r="4.2" />
              <circle cx="8.2" cy="17.3" r="4.2" />
              <circle cx="5.8" cy="10" r="4.2" />
            </g>
            <circle cx="12" cy="12" r="3.3" fill="#f6d65a" />
          </symbol>
          <symbol id="dgc-snow" viewBox="0 0 24 24">
            <g stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" fill="none">
              <path d="M12 2V22M3.3 7L20.7 17M3.3 17L20.7 7" />
              <path d="M9.5 3.8L12 6.3L14.5 3.8M9.5 20.2L12 17.7L14.5 20.2" />
            </g>
          </symbol>
          <symbol id="dgc-sun" viewBox="0 0 24 24">
            <circle cx="12" cy="12" r="5" fill="currentColor" />
            <path
              d="M12 1.5V4M12 20V22.5M1.5 12H4M20 12H22.5M4.5 4.5L6.3 6.3M17.7 17.7L19.5 19.5M19.5 4.5L17.7 6.3M6.3 17.7L4.5 19.5"
              stroke="currentColor"
              strokeWidth="1.8"
              strokeLinecap="round"
            />
          </symbol>
          <symbol id="dgc-shell" viewBox="0 0 24 24">
            <path d="M12 21C5 19 2 13 3 8C7 6 17 6 21 8C22 13 19 19 12 21Z" fill="currentColor" />
            <path d="M12 20V8M8 19L6 9M16 19L18 9" stroke="rgba(120,60,30,.35)" strokeWidth="1" fill="none" />
          </symbol>
        </defs>
      </svg>
      <span className={`dgc-fr1 dgy-fr ${mirror ? 'r' : 'l'}`} />
      <span className={`dgc-fr2 dgy-fr ${mirror ? 'r' : 'l'}`} />
      {season.decor.map(([sym, c, r, sz, pos], i) => (
        <svg key={i} className="dgc-leaf" style={{ color: c, width: sz, height: sz, transform: `rotate(${r}deg)`, ...(mirror ? flipPos(pos) : pos) }}>
          <use href={`#dgc-${sym}`} />
        </svg>
      ))}
    </>
  )
}

// Ornamenti delle pagine dell'anno: cornice (piena e tratteggiata) che prosegue da un foglio all'altro
// attraverso la piega, e squadre d'angolo dorate solo agli angoli esterni del doppio foglio
function YearOrnaments({ side }) {
  const left = side === 'l'
  const corners = left ? ['tl', 'bl'] : ['tr', 'br']
  return (
    <>
      <svg width="0" height="0" style={{ position: 'absolute' }} aria-hidden="true">
        <defs>
          <symbol id="dgy-corner" viewBox="0 0 120 120">
            <g fill="none" stroke="currentColor" strokeLinecap="round">
              <path d="M6 112V6H112" strokeWidth="1.8" />
              <path d="M13 104V13H104" strokeWidth="0.8" />
              <path d="M24 24C37 24 37 37 24 37C17 37 17 29 23 29" strokeWidth="1" />
              <path d="M30 6C38 6 40 14 48 14C56 14 56 6 64 6" strokeWidth="0.9" />
              <path d="M6 30C6 38 14 40 14 48C14 56 6 56 6 64" strokeWidth="0.9" />
              <path d="M40 40C52 40 60 48 60 60" strokeWidth="0.8" />
              <path d="M40 40C40 52 48 60 60 60" strokeWidth="0.8" />
            </g>
            <g fill="currentColor">
              <path d="M6 0L12 6L6 12L0 6Z" />
              <circle cx="6" cy="112" r="2.4" />
              <circle cx="112" cy="6" r="2.4" />
              <circle cx="72" cy="6" r="1.4" />
              <circle cx="80" cy="6" r="1.1" />
              <circle cx="6" cy="72" r="1.4" />
              <circle cx="6" cy="80" r="1.1" />
              <path d="M60 54L64 60L60 66L56 60Z" />
              <ellipse cx="48" cy="14" rx="3.2" ry="1.6" transform="rotate(-30 48 14)" />
              <ellipse cx="14" cy="48" rx="1.6" ry="3.2" transform="rotate(-30 14 48)" />
            </g>
          </symbol>
        </defs>
      </svg>
      <span className={`dgc-fr1 dgy-fr ${left ? 'l' : 'r'}`} />
      <span className={`dgc-fr2 dgy-fr ${left ? 'l' : 'r'}`} />
      {corners.map((c) => (
        <svg key={c} className={`dgy-corner ${c}`} aria-hidden="true">
          <use href="#dgy-corner" />
        </svg>
      ))}
    </>
  )
}

// Statistiche delle note per le pagine di apertura: foto dei giorni migliori, tag, canzoni e persone
function useCoverStats(notes, ctx) {
  // fino a 3 foto, una per giorno, dai giorni con il mood più alto
  const photos = useMemo(() => {
    const ranked = [...groupByDay(notes).entries()]
      .map(([k, list]) => ({ k, list, mood: dayMood(list) }))
      .filter((d) => d.list.some((n) => n.images?.length))
      .sort((a, b) => b.mood - a.mood)
      .slice(0, 3)
    return ranked.map((d) => {
      const n = d.list.find((x) => x.images?.length)
      return { id: n.id, url: fileUrl(n, n.images[0], { thumb: '300x300' }), label: dayMonthLabel(d.k) }
    })
  }, [notes])
  // i 4 tag più usati
  const tags = useMemo(() => {
    const count = new Map()
    for (const n of notes) for (const id of n.tags || []) count.set(id, (count.get(id) || 0) + 1)
    return [...count.entries()]
      .sort((a, b) => b[1] - a[1])
      .slice(0, 4)
      .map(([id]) => ctx.tagsById.get(id))
      .filter(Boolean)
  }, [notes, ctx.tagsById])
  // le canzoni delle 3 note più positive che ne hanno una
  const songs = useMemo(() => {
    const out = []
    const seen = new Set()
    const ranked = [...notes].filter((n) => n.songs?.length).sort((a, b) => Number(b.mood) - Number(a.mood))
    for (const n of ranked) {
      const s = n.songs[0]
      const id = `${s.title}|${s.artist}`
      if (seen.has(id)) continue
      seen.add(id)
      out.push(s)
      if (out.length === 3) break
    }
    return out
  }, [notes])
  // le 8 persone più presenti nelle note
  const people = useMemo(() => {
    const count = new Map()
    for (const n of notes) for (const id of n.people || []) count.set(id, (count.get(id) || 0) + 1)
    return [...count.entries()]
      .sort((a, b) => b[1] - a[1])
      .slice(0, 8)
      .map(([id]) => ctx.peopleById.get(id))
      .filter(Boolean)
  }, [notes, ctx.peopleById])
  return { photos, tags, songs, people }
}

// Pagine dell'anno (a inizio gennaio), stile editoriale: la prima è il riassunto come un articolo
// con frase d'apertura, capolettera e numeri; la seconda le immagini, l'indice dei mesi e le persone.
const YEAR_VARS = { '--fc': '#b9993f', '--fc2': '#c9ad6a' }
const ORN = <div className="dgy-orn">✦</div>

function YearPage1({ year, side, ctx }) {
  const notes = ctx.yearNotes
  const [text, setText] = useState(undefined) // undefined = in lettura, null = non generato
  const [busy, setBusy] = useState(false)
  useEffect(() => {
    let off = false
    getYearRecap(year).then((t) => !off && setText(t))
    return () => {
      off = true
    }
  }, [year])
  async function generate() {
    if (busy) return
    setBusy(true)
    try {
      setText(await regenerateYearRecap(ctx.geminiApiKey, String(year), notes))
    } catch {
      /* il recap resta com'era */
    } finally {
      setBusy(false)
    }
  }
  // la prima frase è l'apertura, il resto l'articolo
  const sentences = (text || '').match(/[^.!?]+[.!?]+(\s|$)|[^.!?]+$/g)?.map((x) => x.trim()) || []
  const lead = sentences.length > 1 ? sentences[0] : ''
  const body = sentences.length > 1 ? sentences.slice(1).join(' ') : text || ''
  const hasNotes = notes.some((n) => !n.isDream)
  return (
    <section className={`dg-page ${side} dg-yr`} style={YEAR_VARS}>
      <YearOrnaments side={side} />
      <div className="dg-scroll">
        <div className="dgy-kick">anno</div>
        <h1 className="dgy-title">{year}</h1>
        {ORN}
        {lead && <p className="dgy-lead">{lead}</p>}
        {body ? (
          <p className="dgy-text">{body}</p>
        ) : (
          <p className="dgy-text dgy-empty">{text === undefined ? '' : 'Il riassunto dell’anno non è ancora stato generato.'}</p>
        )}
        {text !== undefined && ctx.geminiApiKey && hasNotes && (
          <button type="button" className="dgy-gen" onClick={generate} disabled={busy}>
            {busy ? 'Scrivo…' : text ? 'Rigenera il riassunto' : 'Genera il riassunto'}
          </button>
        )}
      </div>
    </section>
  )
}

function YearPage2({ side, ctx }) {
  const notes = ctx.yearNotes
  const real = useMemo(() => notes.filter((n) => !n.isDream), [notes])
  const { tags, people } = useCoverStats(notes, ctx)
  const { counts, starts } = ctx.monthIndex
  const days = useMemo(() => groupByDay(real).size, [real])
  const images = useMemo(() => real.reduce((sum, n) => sum + (n.images?.length || 0), 0), [real])
  const mood = real.length ? Math.round(dayMood(real) * 100) : null
  const months = useMemo(
    () =>
      Array.from({ length: 12 }, (_, m) => {
        const list = real.filter((n) => parseWall(n.date)?.mo === m + 1)
        return { m, mood: list.length ? Math.round(dayMood(list) * 100) : null }
      }).filter((x) => x.mood != null),
    [real],
  )
  const best = months.length ? months.reduce((a, b) => (b.mood > a.mood ? b : a)) : null
  const worst = months.length ? months.reduce((a, b) => (b.mood < a.mood ? b : a)) : null
  return (
    <section className={`dg-page ${side} dg-yr`} style={YEAR_VARS}>
      <YearOrnaments side={side} />
      <div className="dg-scroll">
        <h4 className="dgy-h">Indice</h4>
        {ORN}
        <div className="dgy-months">
          {Array.from({ length: 12 }, (_, m) =>
            counts[m] > 0 ? (
              <div key={m}>
                {MONTHS_IT[m]}
                <i />
                <b>pag. {starts[m]}</b>
              </div>
            ) : null,
          )}
        </div>
        {ORN}
        <h4 className="dgy-h">Riassunto</h4>
        {ORN}
        <div className="dgy-num dgy-num4">
          <div>
            <b>{real.length}</b>
            <span>note</span>
          </div>
          <div>
            <b>{days}</b>
            <span>giorni</span>
          </div>
          <div>
            <b>{images}</b>
            <span>immagini</span>
          </div>
          <div>
            <b>{mood ?? '–'}</b>
            <span>mood medio</span>
          </div>
        </div>
        {best && worst && (
          <p className="dgy-people">
            Mese migliore: {MONTHS_IT[best.m].toLowerCase()} ({best.mood}) · il più basso: {MONTHS_IT[worst.m].toLowerCase()} ({worst.mood})
          </p>
        )}
        {people.length > 0 && <p className="dgy-people">con {people.slice(0, 5).map((pe) => pe.name).join(', ')}</p>}
        {tags.length > 0 && (
          <p className="dgy-tags">
            {tags.map((t) => (
              <span key={t.id}>{t.name}</span>
            ))}
          </p>
        )}
      </div>
    </section>
  )
}

function YearCover({ part, year, side, ctx }) {
  return part === 1 ? (
    <YearPage1 year={year} side={side} ctx={ctx} />
  ) : (
    <YearPage2 side={side} ctx={ctx} />
  )
}

// Prima pagina del mese: titolo grande, anno e riassunto del mese su un cartoncino.
function MonthCover({ part = 1, year, month, side, ctx, notes }) {
  const key = `${year}-${String(month + 1).padStart(2, '0')}`
  const season = SEASONS[seasonOf(month)]
  const { photos, tags, songs, people } = useCoverStats(notes, ctx)
  // il mood di ogni giorno del mese, per i cartoncini della seconda pagina
  const dayTiles = useMemo(() => {
    const by = groupByDay(notes)
    return monthDayKeys(year, month).map((k, i) => ({ day: i + 1, mood: by.has(k) ? dayMood(by.get(k)) : null }))
  }, [notes, year, month])
  return (
    <section
      className={`dg-page ${side} dg-cover`}
      style={{ '--cbg': season.bg, '--fc': season.fc, '--fc2': season.fc2, '--tc': season.tc, '--yc': season.yc }}
    >
      <CoverDecor season={season} mirror={part === 2} />
      <div className="dg-band" />
      <div className="dg-scroll">
        {part === 1 ? (
          <>
        <div className="dg-cover-head">
          <span className="dg-cover-year">{year}</span>
          <span className="dg-cover-title">{MONTHS_IT[month]}</span>
        </div>
        <div
          className="wd-card-wrap dg-recap-block dg-cover-recap"
          style={{ '--rr': `${tilt(`${key}rc`, 1.3).toFixed(2)}deg`, '--tape': tapeOf('recap', key), '--ycol': yellowOf(key) }}
        >
          <div className="wd-header">
            <Icon name="sparkles" size={19} />
            <h2>Riassunto del mese</h2>
          </div>
          <div className="dg-recap dg-recap-page">
            <PeriodRecapCard
              period="month"
              periodKey={key}
              notes={notes}
              label={`${MONTHS_IT[month]} ${year}`}
              apiKey={ctx.geminiApiKey}
              hideTitle
              alwaysShow
            />
          </div>
        </div>
        {photos.length > 0 && (
          <div className="dg-cover-photos">
            {photos.map((ph, i) => (
              <span
                key={ph.id}
                className="dn-pola"
                style={{ '--pr': `${tilt(`${ph.id}cv`, 4).toFixed(2)}deg`, transform: `rotate(${tilt(`${ph.id}cv`, 4).toFixed(2)}deg)`, marginTop: i % 2 ? 12 : 0 }}
              >
                <span className="dn-ph" style={{ backgroundImage: `url(${ph.url})` }} />
                <span className="dg-cover-cap">{ph.label}</span>
              </span>
            ))}
          </div>
        )}
          </>
        ) : (
          <>
        <div className="wd-card-wrap dg-cover-sec">
          <div className="wd-header">
            <Icon name="calendar" size={19} />
            <h2>Giorno per giorno</h2>
          </div>
          <div className="dg-cover-days">
            {dayTiles.map((t) => (
              <span key={t.day} className="dg-cover-day" style={t.mood == null ? undefined : { '--mc': moodColor(t.mood) }}>
                {t.day}
              </span>
            ))}
          </div>
        </div>
        {songs.length > 0 && (
          <div className="wd-card-wrap dg-cover-sec">
            <div className="wd-header">
              <Icon name="music" size={19} />
              <h2>Canzoni del mese</h2>
            </div>
          <span className="dg-cover-songs">
            {songs.map((sg) => (
              <span key={`${sg.title}${sg.artist}`} className="dn-disc-wrap">
                <span className="dn-disc" style={sg.thumbnailUrl ? { '--cover': `url(${sg.thumbnailUrl})` } : undefined} />
                {(sg.title || sg.artist) && (
                  <span className="dn-song">
                    {sg.title && <span className="t">{sg.title}</span>}
                    {sg.artist && <span className="a">{sg.artist}</span>}
                  </span>
                )}
              </span>
            ))}
          </span>
          </div>
        )}
        {people.length > 0 && (
          <div className="wd-card-wrap dg-cover-sec">
            <div className="wd-header">
              <Icon name="user" size={19} />
              <h2>Persone più presenti</h2>
            </div>
          <span className="dn-tapes dg-cover-people">
            {people.map((pe) => (
              <span key={pe.id} className="dn-tape" style={{ '--tape-c': personTapeColor(pe) }}>
                <PersonAvatar person={pe} immichUrl={ctx.immichUrl} immichApiKey={ctx.immichApiKey} size={18} />
                <span className="dn-tape-name">{pe.name}</span>
              </span>
            ))}
          </span>
          </div>
        )}
        {tags.length > 0 && (
          <div className="wd-card-wrap dg-cover-sec">
            <div className="wd-header">
              <Icon name="tag" size={19} />
              <h2>Tag più usati</h2>
            </div>
          <span className="dn-tapes dg-cover-people dg-cover-tags">
            {tags.map((t) => (
              <span key={t.id} className="dn-tag">
                #{t.name}
              </span>
            ))}
          </span>
          </div>
        )}
          </>
        )}
      </div>
    </section>
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
        {page.recap && (
          <DayRecap
            dKey={dKey}
            notes={page.dayNotes}
            apiKey={ctx.geminiApiKey}
            text={ctx.recapMap ? ctx.recapMap.get(dKey) ?? null : undefined}
          />
        )}
        {items.map((it, i) => (
          <NoteBlock key={`${it.n.id}-${i}`} n={it.n} part={it.part} {...ctx} />
        ))}
      </div>
      {!cont && page.mood != null && (
        <span className="dg-torn" style={{ '--nm': moodColor(page.mood), '--tape': tapeOf('mood', dKey) }} title="Mood del giorno">
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

// Misura (in un livello nascosto) l'altezza di ogni nota e di ogni riassunto del giorno
function readHeights(box) {
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
  box.querySelectorAll('[data-day]').forEach((el) => next.set(`d:${el.dataset.day}`, { total: el.offsetHeight }))
  return next
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
    const real = sorted.filter((n) => !n.isDream)
    const mood = real.length ? dayMood(real) : null
    let cur = null
    let used = 0
    // il riassunto del giorno occupa il suo spazio in cima alla prima pagina
    const rh = hts.get(`d:${d.key}`)?.total || 0
    // spazio utile: la prima pagina del giorno ha l'intestazione, quelle di
    // continuazione partono dall'alto
    const room = () => cap
    const fresh = () => {
      const first = cur == null
      cur = { dKey: d.key, items: [], cont: !first, mood, recap: first && rh > 0, dayNotes: real }
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

// ---- Export dell'anno con l'estetica a schermo ----------------------------------------------
// Si disegnano tutte le pagine dell'anno (anno, copertine dei mesi, giorni) a grandezza fissa in un
// livello fuori schermo e si apre la stampa del browser: «Salva come PDF» dà una pagina A4 per foglio
// del diario. I pulsanti dell'editor non si disegnano e quelli dei riassunti sono nascosti in stampa.
// La pagina si disegna alla stessa grandezza che ha a schermo (`pageW` × `pageH`, misurata dal libro
// aperto): così il testo ha la stessa scala dell'editor, e solo alla stampa la pagina si adatta all'A4.
const A4_PX = 793.7 // larghezza di un A4 a 96 dpi

// aspetta che immagini di sfondo (foto, mappe, copertine) siano scaricate, al massimo 20 secondi
async function preloadBackgrounds(root) {
  const urls = new Set()
  root.querySelectorAll('.dn-ph, .dn-map, .dn-disc, .dgy-photo span').forEach((el) => {
    const bg = getComputedStyle(el).backgroundImage
    for (const m of bg.matchAll(/url\("?([^")]+)"?\)/g)) if (!m[1].startsWith('data:')) urls.add(m[1])
  })
  const load = (u) =>
    new Promise((res) => {
      const img = new Image()
      img.onload = img.onerror = () => res()
      img.src = u
    })
  const imgs = [...root.querySelectorAll('img')].map((i) => (i.complete ? Promise.resolve() : new Promise((res) => { i.onload = i.onerror = () => res() })))
  await Promise.race([Promise.all([...[...urls].map(load), ...imgs]), new Promise((r) => setTimeout(r, 20000))])
}

function YearPrint({ year, base, pageW, pageH, onDone }) {
  const PRINT_W = pageW
  const PRINT_CAP = pageH - BAND - 34 - 1 - ROW - 10 - 14
  const [data, setData] = useState(null)
  const [heights, setHeights] = useState(null)
  const measureRef = useRef(null)
  const rootRef = useRef(null)
  const doneRef = useRef(onDone)
  useEffect(() => {
    doneRef.current = onDone
  })

  // 1) note, sogni e riassunti dei giorni dell'anno
  useEffect(() => {
    let off = false
    const range = { start: `${year}-01-01 00:00:00.000Z`, end: `${year}-12-31 23:59:59.999Z` }
    Promise.all([listNotesInRange(range), listDreamsInRange(range), listDayRecapsInYear(year)])
      .then(([notes, dreams, recapMap]) => {
        if (!off) setData({ notes, all: [...notes, ...dreams.map(dreamAsNote)], recapMap })
      })
      .catch((err) => !off && doneRef.current(err))
    return () => {
      off = true
    }
  }, [year])

  // 2) misura di tutte le note, alla larghezza di una pagina
  useLayoutEffect(() => {
    if (!data || !measureRef.current) return
    let off = false
    ;(async () => {
      await new Promise((r) => setTimeout(r, 400))
      await document.fonts?.ready
      if (!off) setHeights(readHeights(measureRef.current))
    })()
    return () => {
      off = true
    }
  }, [data])

  // 3) impaginazione di ogni mese e numerazione cumulativa
  const plan = useMemo(() => {
    if (!data || !heights) return null
    const byAll = groupByDay(data.all)
    const months = []
    const counts = []
    for (let m = 0; m < 12; m++) {
      const dl = monthDayKeys(year, m)
        .filter((k) => byAll.has(k))
        .map((k) => ({ key: k, notes: byAll.get(k) }))
      const pages = dl.length ? paginate(dl, heights, PRINT_CAP) : []
      months.push({ m, pages })
      counts.push(pages.length)
    }
    const starts = []
    let acc = 1
    for (const c of counts) {
      starts.push(acc)
      acc += c
    }
    return { months, monthIndex: { counts, starts } }
  }, [data, heights, year])

  // 4) quando le pagine sono pronte e le immagini scaricate, si apre la stampa
  useEffect(() => {
    if (!plan) return
    let off = false
    ;(async () => {
      await new Promise((r) => setTimeout(r, 800))
      await document.fonts?.ready
      if (rootRef.current) await preloadBackgrounds(rootRef.current)
      if (off) return
      window.addEventListener('afterprint', () => doneRef.current(), { once: true })
      window.print()
    })()
    return () => {
      off = true
    }
  }, [plan])

  const ctxM = { ...base, onOpen: () => {}, asideMax: PRINT_CAP - ROW * 2 }
  const days = data ? [...groupByDay(data.all).entries()] : []

  const sheets = []
  if (plan) {
    const ctx = { ...ctxM, recapMap: data.recapMap, yearNotes: data.notes, monthIndex: plan.monthIndex }
    for (const { m, pages } of plan.months) {
      if (!pages.length) continue
      const monthNotes = data.notes.filter((n) => parseWall(n.date)?.mo === m + 1)
      const mctx = { ...ctx, monthNotes }
      const list = []
      if (m === 0) {
        list.push((side) => <YearCover part={1} year={year} side={side} ctx={ctx} />)
        list.push((side) => <YearCover part={2} year={year} side={side} ctx={ctx} />)
      }
      list.push((side) => <MonthCover part={1} year={year} month={m} side={side} ctx={mctx} notes={monthNotes} />)
      list.push((side) => <MonthCover part={2} year={year} month={m} side={side} ctx={mctx} notes={monthNotes} />)
      pages.forEach((pg, i) => {
        list.push((side) => <DayPage page={pg} side={side} number={plan.monthIndex.starts[m] + i} ctx={mctx} />)
      })
      list.forEach((make, i) => {
        sheets.push(
          <div className="dgp-sheet" key={`${m}-${i}`}>
            <div className="dgp-page">{make(i % 2 === 0 ? 'l' : 'r')}</div>
          </div>,
        )
      })
    }
  }

  return createPortal(
    <div
      className="dgp-root"
      ref={rootRef}
      style={{ '--pw': `${pageW}px`, '--ph': `${pageH}px`, '--ps': A4_PX / pageW }}
    >
      {data && !plan && (
        <div className="dg-measure" ref={measureRef} style={{ width: PRINT_W - 92 }} aria-hidden="true">
          {days.map(([k, list]) =>
            data.recapMap.get(k) ? (
              <div key={k} data-day={k}>
                <DayRecap dKey={k} notes={list.filter((n) => !n.isDream)} text={data.recapMap.get(k)} />
              </div>
            ) : null,
          )}
          {data.all.map((n) => (
            <NoteBlock key={n.id} n={n} {...ctxM} ghost />
          ))}
        </div>
      )}
      {sheets}
    </div>,
    document.body,
  )
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
  const [dreams, setDreams] = useState([])
  const [yearNotes, setYearNotes] = useState([])
  const [downloading, setDownloading] = useState(false)
  const [dlOpen, setDlOpen] = useState(false)
  const [printing, setPrinting] = useState(false)
  const dlRef = useRef(null)
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
      const range = {
        start: `${keys[0]} 00:00:00.000Z`,
        end: `${keys[keys.length - 1]} 23:59:59.999Z`,
      }
      const [list, dreamList] = await Promise.all([listNotesInRange(range), listDreamsInRange(range)])
      setNotes(list)
      setDreams(dreamList)
    } catch (err) {
      setError(describeError(err))
      setNotes([])
      setDreams([])
    } finally {
      setLoading(false)
    }
  }, [keys])

  useEffect(() => {
    load()
  }, [load])
  useCacheRefresh(load)

  // le pagine dell'anno e l'indice hanno bisogno delle note di tutto l'anno; l'archivio in memoria
  // si riempie in background, quindi si rilegge quando arrivano altri dati
  useEffect(() => {
    if (!dlOpen) return
    const onDown = (e) => {
      if (dlRef.current && !dlRef.current.contains(e.target)) setDlOpen(false)
    }
    document.addEventListener('pointerdown', onDown)
    return () => document.removeEventListener('pointerdown', onDown)
  }, [dlOpen])

  async function downloadYear(kind) {
    if (downloading) return
    setDlOpen(false)
    setDownloading(true)
    try {
      await (kind === 'pdf' ? exportYearPdf : exportYearMarkdown)(cursor.year)
    } catch (err) {
      setError(describeError(err))
    } finally {
      setDownloading(false)
    }
  }

  const loadYear = useCallback(() => {
    let off = false
    listNotesInRange({ start: `${cursor.year}-01-01 00:00:00.000Z`, end: `${cursor.year}-12-31 23:59:59.999Z` })
      .then((list) => !off && setYearNotes(list))
      .catch(() => {})
    return () => {
      off = true
    }
  }, [cursor.year])
  useEffect(() => loadYear(), [loadYear])
  useCacheRefresh(loadYear)

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

  // i sogni entrano nelle pagine come note (senza mood): si aprono nella loro pagina
  const dreamNotes = useMemo(() => dreams.map(dreamAsNote), [dreams])
  const days = useMemo(() => {
    const byDay = groupByDay([...notes, ...dreamNotes])
    return keys.filter((k) => byDay.has(k)).map((k) => ({ key: k, notes: byDay.get(k) }))
  }, [notes, dreamNotes, keys])
  const allNotes = useMemo(() => days.flatMap((d) => d.notes), [days])
  // note degli altri mesi dell'anno: si misurano (senza immagini) per sapere a che pagina cade ogni mese
  const ghostNotes = useMemo(
    () =>
      yearNotes.filter((n) => {
        const w = parseWall(n.date)
        return w && w.y === cursor.year && w.mo !== cursor.month + 1
      }),
    [yearNotes, cursor.year, cursor.month],
  )

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
      const next = readHeights(box)
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
  }, [allNotes, ghostNotes, peopleById, tagsById])

  // la prima pagina del mese è la copertina col riassunto; poi i giorni
  // a gennaio c'è prima la pagina dell'anno; poi sempre quella del mese
  const covers = cursor.month === 0 ? 4 : 2
  const pages = useMemo(
    () => [
      ...(covers === 4 ? [{ yearCover: 1, dKey: keys[0] }, { yearCover: 2, dKey: keys[0] }] : []),
      { cover: 1, dKey: keys[0] },
      { cover: 2, dKey: keys[0] },
      ...paginate(days, heights, cap),
    ],
    [covers, keys, days, heights, cap],
  )
  const spreadCount = Math.max(1, Math.ceil(pages.length / 2))

  // a quale pagina del diario intero comincia ogni mese (numerazione cumulativa sull'anno);
  // per gli altri mesi è una stima fatta con le misure delle note
  const monthIndex = useMemo(() => {
    const counts = Array.from({ length: 12 }, (_, m) => {
      if (m === cursor.month) return Math.max(0, pages.length - covers)
      if (!(cap > 0)) return 0
      const list = yearNotes.filter((n) => parseWall(n.date)?.mo === m + 1 && parseWall(n.date)?.y === cursor.year)
      if (!list.length) return 0
      const by = groupByDay(list)
      const dl = monthDayKeys(cursor.year, m)
        .filter((k) => by.has(k))
        .map((k) => ({ key: k, notes: by.get(k) }))
      return paginate(dl, heights, cap).length
    })
    const starts = []
    let acc = 1
    for (const c of counts) {
      starts.push(acc)
      acc += c
    }
    return { counts, starts }
  }, [pages.length, covers, cursor.month, cursor.year, cap, heights, yearNotes])

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
    monthNotes: notes,
    yearNotes,
    monthIndex,
  }

  const renderPage = (idx) => {
    if (idx >= pages.length) return <section className="dg-page empty" />
    if (pages[idx].yearCover)
      return <YearCover part={pages[idx].yearCover} year={cursor.year} side={idx % 2 === 0 ? 'l' : 'r'} ctx={ctx} />
    if (pages[idx].cover)
      return (
        <MonthCover
          part={pages[idx].cover}
          year={cursor.year}
          month={cursor.month}
          side={idx % 2 === 0 ? 'l' : 'r'}
          ctx={ctx}
          notes={ctx.monthNotes}
        />
      )
    return <DayPage page={pages[idx]} side={idx % 2 === 0 ? 'l' : 'r'} number={monthIndex.starts[cursor.month] + idx - covers} ctx={ctx} />
  }

  return (
    <div
      className={'dg-wrap' + (phone ? ` phone h${half}` : '')}
      {...(phone ? { onPointerDown: swipe.down, onPointerUp: swipe.up } : null)}
    >
      {printing && (
        <YearPrint
          year={cursor.year}
          base={ctx}
          pageW={printing.w}
          pageH={printing.h}
          onDone={(err) => {
            setPrinting(false)
            if (err) setError(describeError(err))
          }}
        />
      )}
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
          <div className="flex items-center gap-3 justify-self-end">
            {loading && <span className="text-sm text-ink-soft">Aggiorno…</span>}
            <div className="dg-dl-wrap" ref={dlRef}>
              <button
                type="button"
                className="dg-dl"
                onClick={() => setDlOpen((v) => !v)}
                disabled={downloading || printing}
                aria-haspopup="menu"
                aria-expanded={dlOpen}
                title={`Scarica tutto il ${cursor.year}`}
              >
                <Icon name="download" size={18} />
                {downloading || printing ? 'Preparo…' : `Scarica ${cursor.year}`}
              </button>
              {dlOpen && (
                <div className="dg-dl-menu" role="menu">
                  <button type="button" role="menuitem" onClick={() => {
                      setDlOpen(false)
                      // si esporta alla stessa grandezza di pagina che vedi ora
                      const b = bookRef.current
                      setPrinting({ w: Math.round((b?.clientWidth || 1202) / 2), h: Math.round(b?.clientHeight || 850) })
                    }}>
                    PDF come lo vedi a schermo
                    <small>pagine a righe e decori; nella stampa scegli «Salva come PDF»</small>
                  </button>
                  <button type="button" role="menuitem" onClick={() => downloadYear('pdf')}>
                    PDF solo testo
                    <small>documento semplice, senza decori</small>
                  </button>
                  <button type="button" role="menuitem" onClick={() => downloadYear('md')}>
                    Markdown
                    <small>testo semplice</small>
                  </button>
                </div>
              )}
            </div>
          </div>
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
            <DayRecap dKey={d.key} notes={d.notes.filter((n) => !n.isDream)} apiKey={ctx.geminiApiKey} />
          </div>
        ))}
        {allNotes.map((n) => (
          <NoteBlock key={n.id} n={n} {...ctx} onOpen={() => {}} />
        ))}
        {ghostNotes.map((n) => (
          <NoteBlock key={n.id} n={n} {...ctx} ghost onOpen={() => {}} />
        ))}
      </div>
    </div>
  )
}
