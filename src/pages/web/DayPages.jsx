import { useLayoutEffect, useMemo, useRef, useState } from 'react'
import { fileUrl } from '../../lib/pocketbase'
import { noteText } from '../../lib/notes'
import { dayMood, moodColor } from '../../lib/mood'
import { durationMinutes, parseWall } from '../../lib/dates'
import PersonAvatar from '../../components/PersonAvatar'
import Icon from '../../components/Icon'
import DreamBadge from '../../components/DreamBadge'
import { haptic } from '../../lib/haptics'
import { dreamMinutes, dreamTitle } from '../../lib/dreams'
import { titleFontVars } from '../../lib/noteFont'
import { hash, tilt, moodKind, personTapeColor, useCarouselIndex } from '../../lib/pagesSkin'

// ---- Vista MOBILE: come nel mese, la colonna con le targhette delle persone
// non ci sta sul telefono. Diventa una colonna di semplici contatori (icona +
// numero) fra testo e foto, e la foto UNA sola "diapositiva" a carosello se la
// nota ne ha più di una. ----
function RowMini({ kind, icon, count }) {
  if (!count) return null
  return (
    <span className={`mp-mini mp-mini--${kind}`} aria-hidden="true">
      <Icon name={icon} size={14} strokeWidth={2.6} />
      <span className="mp-mini-text">{count}</span>
    </span>
  )
}

const MINI_H = 30 // altezza di una targhetta compatta (con lo spazio fra una e l'altra)
const POLA_COL_H = 106 // altezza della diapositiva con la foto nella colonna di destra

// Cosa entra nella colonna di destra (targhette compatte + foto) in `h` pixel:
// prima tutto, poi foto + una targhetta riassuntiva, poi solo le targhette,
// poi solo la riassuntiva, poi solo la foto; altrimenti niente.
function sideLayout(it, h) {
  const minis = [
    { kind: 'people', icon: 'user', count: it.people.length },
    { kind: 'tag', icon: 'tag', count: it.tags.length },
  ].filter((m) => m.count > 0)
  const photo = it.imgsCarousel.length > 0
  const total = it.people.length + it.tags.length
  const more = total > 0 ? [{ kind: 'more', icon: 'list', count: total }] : []
  const room = h - 16
  const need = (list, withPhoto) => list.length * MINI_H + (withPhoto ? POLA_COL_H : 0)
  const tries = [
    [minis, photo],
    [more, photo],
    [minis, false],
    [more, false],
    [[], photo],
  ]
  for (const [list, withPhoto] of tries) {
    if (!list.length && !withPhoto) continue
    if (need(list, withPhoto) <= room) return { minis: list, photo: withPhoto }
  }
  return { minis: [], photo: false }
}

function RowPolaMobile({ imgs, rotation }) {
  const idx = useCarouselIndex(imgs.length, 3200)
  if (!imgs.length) return null
  return (
    <span className="mp-pola-mobile" style={{ '--pr': rotation }} aria-hidden="true">
      <span className="mp-ph" style={{ backgroundImage: `url(${imgs[idx].url})` }} />
      {imgs.length > 1 && (
        <span className="mp-pola-dots">
          {imgs.map((_, i) => (
            <i key={i} className={i === idx ? 'on' : undefined} />
          ))}
        </span>
      )}
    </span>
  )
}

const DAY_MIN = 24 * 60
const DREAM_H = 34 // altezza di pallino + nuvoletta del sogno (.day-dream)
const RAIL_HOURS = [0, 3, 6, 9, 12, 15, 18, 21, 24]
const TICK_HOURS = [0, 6, 12, 18, 24]
const LINE_H = 20 // altezza stimata di una riga di descrizione
const CHARS_PER_LINE = 34
const GAP = 8 // spazio fra due righe
const HEAD_H = 52 // titolo (una riga) + margini della riga
const BARE_H = 54 // altezza minima di una riga: solo cartellino del mood e titolo
const BARE_H_PHONE = 38 // sul telefono il mood è un quadratino: la riga minima è più bassa
const TAPE_H = 37 // altezza di una targhetta persona/tag nella colonna completa
const POLA_H = 132 // altezza delle due polaroid nella versione completa

// Altezza che serve alla versione completa (targhette in colonna, polaroid).
function fullNeed(it) {
  const tapes = it.people.length + it.tags.length
  return Math.max(tapes ? tapes * TAPE_H + 14 : 0, it.imgs.length ? POLA_H : 0)
}

function startMinutesOf(value) {
  const p = parseWall(value)
  return p ? p.h * 60 + p.mi : 0
}

// Imperfezione stabile della riga (angolo piegato, strappo o niente), come nel mese.
function flawFor(key) {
  switch (hash(`${key}~flaw`) % 6) {
    case 2:
      return 'torn'
    default:
      return ''
  }
}

// Posiziona righe e sogni sulla tavola, che NON scorre: ognuno parte dall'ora
// della nota e dura quanto la nota (max), ma si ferma prima dell'inizio della
// successiva; se così resta meno del minimo, la successiva viene spostata più
// in basso. Se in fondo non c'è più posto le righe si rialzano dal fondo e, se
// serve, si schiacciano un po'. Ogni nota si accorcia solo per sé: una nota
// tarda non fa più rimpicciolire tutte le altre.
function layoutBlocks(blocks, height) {
  // blocks: { key, desired, min, max }, già in ordine di orario
  const n = blocks.length
  const tops = []
  const hs = []
  let bottom = -Infinity
  for (let i = 0; i < n; i++) {
    const b = blocks[i]
    const top = Math.max(b.desired, bottom + GAP)
    const limit = i + 1 < n ? blocks[i + 1].desired - GAP : height
    const h = Math.max(b.min, Math.min(b.max, limit - top))
    tops.push(top)
    hs.push(h)
    bottom = top + h
  }
  if (bottom > height) {
    const gaps = GAP * (n - 1)
    const sum = hs.reduce((x, y) => x + y, 0)
    if (sum + gaps > height) {
      const s = Math.max(0.5, (height - gaps) / sum)
      for (let i = 0; i < n; i++) hs[i] *= s
    }
    let lim = height
    for (let i = n - 1; i >= 0; i--) {
      tops[i] = Math.min(tops[i], lim - hs[i])
      lim = tops[i] - GAP
    }
    let floor = 0
    for (let i = 0; i < n; i++) {
      tops[i] = Math.max(tops[i], floor)
      floor = tops[i] + hs[i] + GAP
    }
  }
  return blocks.map((b, i) => ({ key: b.key, top: tops[i], h: hs[i] }))
}

// Vista giorno "pagine" (web + telefono): la giornata come una tavola di pino
// con le ore segnate, tutta dentro lo schermo; ogni nota è una riga di carta
// come quella della vista mese (titolo sul foglietto a quadretti, descrizione
// che si ferma quando non c'è più posto, persone, tag e foto).
export default function DayPages({
  notes,
  onNavigate,
  peopleById,
  tagsById,
  immichUrl,
  immichApiKey,
  onCreate, // opzionale: con il giorno vuoto offre «Crea la prima nota»
  dreams = [], // sogni del giorno: pallino con la luna sull'asse + nuvoletta (lib/dreams.js)
}) {
  const trackRef = useRef(null)
  const [bareH] = useState(() =>
    typeof window !== 'undefined' && window.matchMedia?.('(max-width: 480px)').matches ? BARE_H_PHONE : BARE_H,
  )
  const [trackH, setTrackH] = useState(0)
  useLayoutEffect(() => {
    const el = trackRef.current
    if (!el) return
    const update = () => setTrackH(el.clientHeight)
    update()
    const ro = new ResizeObserver(update)
    ro.observe(el)
    return () => ro.disconnect()
  }, [])

  const items = useMemo(() => {
    const list = notes.map((n) => {
      // Nota del giorno prima che finisce oggi: da mezzanotte all'ora di fine.
      const carried = Boolean(n.carriedFromPrevious)
      const startMin = carried ? 0 : Math.max(0, Math.min(DAY_MIN, startMinutesOf(n.timeStart)))
      const dur = durationMinutes(n.timeStart, n.timeEnd)
      const endMin = carried
        ? Math.min(DAY_MIN, startMinutesOf(n.timeEnd))
        : Math.min(DAY_MIN, startMin + (dur || 0))

      const people = (n.people || []).map((id) => peopleById?.get(id)).filter(Boolean)
      const tags = (n.tags || []).map((id) => tagsById?.get(id)).filter(Boolean)
      const imgs = (n.images || []).slice(0, 2).map((fn) => ({
        url: fileUrl(n, fn, { thumb: '300x300' }),
      }))
      // Fino a 5 foto per il carosello a "diapositiva unica" del telefono.
      const imgsCarousel = (n.images || []).slice(0, 5).map((fn) => ({
        url: fileUrl(n, fn, { thumb: '300x300' }),
      }))

      return {
        id: n.id,
        startMin,
        endMin,
        title: n.title?.trim() || 'Senza titolo',
        body: noteText(n.content),
        mood: Number(n.mood ?? 0.5),
        people,
        tags,
        imgs,
        imgsCarousel,
      }
    })
    list.sort((a, b) => a.startMin - b.startMin)
    return list
  }, [notes, peopleById, tagsById])

  // Mood del giorno (stessa media pesata della vista mese), solo con le note del giorno
  const ownNotes = useMemo(() => notes.filter((n) => !n.carriedFromPrevious), [notes])
  const moodValue = ownNotes.length ? dayMood(ownNotes) : null

  const pxPerMin = trackH / DAY_MIN

  const pos = useMemo(() => {
    const map = new Map()
    if (trackH <= 0) return map
    const blocks = [
      ...dreams.map((d) => ({
        key: `d:${d.id}`,
        desired: Math.min(DAY_MIN - 24, dreamMinutes(d)) * pxPerMin,
        min: DREAM_H,
        max: DREAM_H,
      })),
      ...items.map((it) => {
        const k = 1
        const lines = Math.min(
          6,
          it.body
            ? it.body
                .split('\n')
                .reduce((s, l) => s + Math.max(1, Math.ceil(l.length / CHARS_PER_LINE)), 0)
            : 0,
        )
        const contentMax = Math.max(HEAD_H + lines * LINE_H * k + 8, fullNeed(it))
        // l'altezza segue la durata della nota (da inizio a fine), anche se il
        // contenuto ne occupa meno: se lo spazio non basta (note vicine) si passa
        // alle versioni compatte; senza orario di fine, quanto serve al contenuto
        const spanPx = Math.max(0, it.endMin - it.startMin) * pxPerMin
        const max = spanPx > 0 ? Math.max(bareH, spanPx) : contentMax
        return {
          key: `n:${it.id}`,
          desired: it.startMin * pxPerMin,
          min: bareH,
          max: Math.max(bareH, max),
        }
      }),
    ].sort((a, b) => a.desired - b.desired)
    layoutBlocks(blocks, trackH).forEach((r) => map.set(r.key, r))
    return map
  }, [trackH, pxPerMin, dreams, items, bareH])

  return (
    <div className="day-outer fit">
      <div className="day-sheet">
        {moodValue != null && (
          <span
            className="day-mood"
            style={{ '--dm': moodColor(moodValue) }}
            title="Mood del giorno"
            aria-label={`Mood del giorno: ${Math.round(moodValue * 100)}`}
          >
            <span className="day-mood-tape" aria-hidden="true" />
            <span className="day-mood-cap">MOOD</span>
            <b>{Math.round(moodValue * 100)}</b>
          </span>
        )}
        <div className="day-track" ref={trackRef}>
          <div className="day-rail" aria-hidden="true">
            {RAIL_HOURS.map((h) => (
              <span key={h} className="hr" style={{ top: h * 60 * pxPerMin }}>
                {String(h % 24).padStart(2, '0')}.00
              </span>
            ))}
            {TICK_HOURS.map((h) => (
              <span key={h} className="tickline" style={{ top: Math.min(h * 60 * pxPerMin, trackH - 1) }} />
            ))}
          </div>

          {!items.length && !dreams.length && (
            <p className="dp-empty">
              Nessuna nota per questo giorno.
              {onCreate && (
                <>
                  {' '}
                  <button type="button" onClick={onCreate} className="dp-empty-btn">
                    Crea la prima nota
                  </button>
                </>
              )}
            </p>
          )}

          {trackH > 0 &&
            dreams.map((d) => {
              const top = pos.get(`d:${d.id}`)?.top ?? Math.min(DAY_MIN - 24, dreamMinutes(d)) * pxPerMin
              return (
                <button
                  key={d.id}
                  type="button"
                  className="day-dream"
                  style={{ top }}
                  aria-label={`Sogno: ${dreamTitle(d)}`}
                  onClick={() => {
                    haptic(4, 'page')
                    onNavigate(`/dream/${d.id}`)
                  }}
                >
                  <span className="dd-dot">
                    <DreamBadge iconSize={14.4} />
                  </span>
                  <span className="dd-cloud">
                    <span className="dd-shape" aria-hidden="true">
                      <i className="b1" />
                      <i className="b2" />
                      <i className="l1" />
                      <i className="l2" />
                    </span>
                    <span className="dd-t">{dreamTitle(d)}</span>
                  </span>
                </button>
              )
            })}

          {trackH > 0 &&
            items.map((it) => {
              const r = pos.get(`n:${it.id}`)
              if (!r) return null
              const kind = moodKind(it.mood)
              const hasPeople = it.people.length > 0 || it.tags.length > 0
              // decori della carta diversi da riga a riga (posizione e misura)
              const h1 = hash(`${it.id}~p1`)
              const h2 = hash(`${it.id}~p2`)
              const h3 = hash(`${it.id}~p3`)
              const bg = {
                '--p1': `${(h1 % 160) - 60}px ${(h2 % 190) - 80}px`,
                '--p2': `right ${(h2 % 120) - 50}px top ${(h3 % 110) - 20}px`,
                '--p3': `${h3 % 160}px ${h1 % 160}px`,
                '--p4': `${-(h1 % 200)}px ${h2 % 200}px`,
                '--s1': `${85 + (h3 % 45)}% auto`,
                '--s2': `${55 + (h1 % 35)}% auto`,
              }
              // se persone, tag e foto non ci stanno si usano le versioni compatte
              // (contatori e una foto sola, come sul telefono); se non c'è posto
              // neanche per quelle restano solo cartellino del mood e titolo
              const bare = r.h < bareH + 22
              const compact = !bare && r.h < fullNeed(it)
              const tapes = { tags: it.tags, people: it.people }
              const side = bare ? { minis: [], photo: false } : sideLayout(it, r.h)
              const open = () => {
                haptic(4, 'page')
                onNavigate(`/note/${it.id}`)
              }
              return (
                <div key={it.id} className="dr-wrap" style={{ top: r.top, height: r.h }}>
                  <button
                    type="button"
                    onClick={open}
                    className={
                      'mp-page' +
                      (it.imgs.length > 0 ? ' has-photo' : '') +
                      (it.imgs.length > 1 ? ' two-photo' : '') +
                      (hasPeople ? ' has-tapes' : '') +
                      (!hasPeople && it.imgs.length === 0 ? ' dr-plain' : '') +
                      (it.imgs.length === 0 ? ' dr-nophoto' : '') +
                      (bare ? ' dr-bare' : compact ? ' dr-compact' : '') +
                      (kind ? ` mood-${kind}` : '') +
                      (flawFor(it.id) ? ` ${flawFor(it.id)}` : '')
                    }
                    style={{ '--r': `${tilt(it.id, 1).toFixed(2)}deg`, '--mp-cw': '56%', ...bg }}
                    aria-label={it.title}
                  >
                    <span className="mp-notes-row">
                      <span className="dr-body" style={{ '--nm': moodColor(it.mood) }}>
                        <span className="dr-head">
                          <span className="dr-mood" title="Mood della nota">
                            {Math.round(it.mood * 100)}
                          </span>
                          <span className="dg-tcard dr-title" style={titleFontVars(it.id)}>{it.title}</span>
                        </span>
                        {it.body && <span className="dr-desc">{it.body}</span>}
                      </span>

                      {(side.minis.length > 0 || side.photo) && (
                        <span className="dr-right">
                          {side.minis.length > 0 && (
                            <span className="mp-side-mobile">
                              {side.minis.map((m) => (
                                <RowMini key={m.kind} kind={m.kind} icon={m.icon} count={m.count} />
                              ))}
                            </span>
                          )}
                          {side.photo && (
                            <RowPolaMobile
                              imgs={it.imgsCarousel}
                              rotation={`${tilt(`${it.id}pm`, 4).toFixed(2)}deg`}
                            />
                          )}
                        </span>
                      )}
                    </span>

                    {hasPeople && (
                      <span className="mp-side" aria-hidden="true">
                        <span className="mp-tapes">
                          {tapes.tags.map((tag) => (
                            <span key={tag.id} className="dn-tag">
                              #{tag.name}
                            </span>
                          ))}
                          {tapes.people.map((person) => (
                            <span
                              key={person.id}
                              className="mp-tape"
                              style={{ '--tape-c': personTapeColor(person) }}
                            >
                              <PersonAvatar
                                person={person}
                                immichUrl={immichUrl}
                                immichApiKey={immichApiKey}
                                size={19}
                              />
                              <span className="mp-tape-name">{person.name}</span>
                            </span>
                          ))}
                        </span>
                      </span>
                    )}

                    {it.imgs.length > 0 && (
                      <span className={'mp-polas' + (it.imgs.length > 1 ? ' two' : '')} aria-hidden="true">
                        {it.imgs.map((im, i) => (
                          <span
                            key={i}
                            className={'mp-pola' + (i === 0 ? ' tc' : '')}
                            style={{ '--pr': `${tilt(`${it.id}p${i}`, 5).toFixed(2)}deg` }}
                          >
                            <span className="mp-ph" style={{ backgroundImage: `url(${im.url})` }} />
                          </span>
                        ))}
                      </span>
                    )}
                  </button>
                </div>
              )
            })}
        </div>
      </div>
    </div>
  )
}
