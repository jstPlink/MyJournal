import { useLayoutEffect, useMemo, useRef, useState } from 'react'
import { fileUrl } from '../../lib/pocketbase'
import { noteText, parsePlace } from '../../lib/notes'
import { dayMood, moodColor } from '../../lib/mood'
import { durationMinutes, parseWall } from '../../lib/dates'
import PersonAvatar from '../../components/PersonAvatar'
import Icon from '../../components/Icon'
import DreamBadge from '../../components/DreamBadge'
import { useIsWide } from '../../hooks/useIsWide'
import { haptic } from '../../lib/haptics'
import { dreamMinutes, dreamTitle } from '../../lib/dreams'
import {
  hash,
  handFor,
  tilt,
  osmTileFor,
  personTapeColor,
  useCarouselIndex,
} from '../../lib/pagesSkin'

// ---- Vista MOBILE: come nel mese, la colonna desktop (targhette
// persone+nome, francobollo+mappa, dischetto CD) non ci sta sul telefono.
// Diventa una colonna di semplici contatori (icona + numero: persone,
// luogo, canzoni) fra cartoncino e foto, e la foto UNA sola "diapositiva"
// a carosello se la nota ne ha più di una. ----
function DnMiniBadge({ kind, icon, count }) {
  if (!count) return null
  return (
    <span className={`dn-mini dn-mini--${kind}`} aria-hidden="true">
      <Icon name={icon} size={12} strokeWidth={2.6} />
      <span className="dn-mini-text">{count}</span>
    </span>
  )
}

function DnPolaMobile({ imgs, rotation }) {
  const idx = useCarouselIndex(imgs.length, 3200)
  if (!imgs.length) return null
  return (
    <span className="dn-pola-mobile" style={{ '--pr': rotation }} aria-hidden="true">
      <span className="dn-ph" style={{ backgroundImage: `url(${imgs[idx].url})` }} />
      {imgs.length > 1 && (
        <span className="dn-pola-dots">
          {imgs.map((_, i) => (
            <i key={i} className={i === idx ? 'on' : undefined} />
          ))}
        </span>
      )}
    </span>
  )
}

const DAY_MIN = 24 * 60
// Altezza dell'intera giornata (24h) quando il foglio SCORRE (telefono):
// un valore fisso, il foglio si comporta come un vero foglio di carta più
// lungo dello schermo. Da web (prop `fit`) il foglio invece NON scorre: sta
// tutto nella pagina e l'altezza si misura da quanto spazio c'è davvero
// (vedi il componente).
const TRACK_H = 1240
const MIN_BLOCK_H = 30
const DREAM_H = 34 // altezza di pallino + nuvoletta del sogno (.day-dream)
const BLOCK_GAP = 3 // spazio minimo fra due blocchi quando si spostano
const RAIL_HOURS = [0, 3, 6, 9, 12, 15, 18, 21, 24]
const TICK_HOURS = [0, 6, 12, 18, 24]

// Altezza minima del blocco di una nota su telefono: foto (78px + cornice) e
// contatori impilati escono dal blocco se la nota dura poco.
function phoneMinH(it) {
  if (it.imgsCarousel.length) return 124
  const badges = (it.people.length ? 1 : 0) + (it.placeName ? 1 : 0) + (it.songsCount ? 1 : 0)
  return badges ? 8 + badges * 26 : 0
}

function startMinutesOf(value) {
  const p = parseWall(value)
  return p ? p.h * 60 + p.mi : 0
}

// Larghezza casuale del cartoncino, stabile per nota: ~47% ± 16% (40–55%,
// più spazio a titolo e contenuti — su mobile è ignorata: il cartoncino
// riempie lo spazio libero, vedi .dn-card in index.css).
function cardWidthFor(id) {
  const span = (hash(`${id}~cw`) % 1000) / 1000
  return `${Math.round(40 + span * 15)}%`
}

// Contenuto della nota: mano casuale, sfumato verso il basso; se il testo non
// ci sta nel cartoncino aggiunge "…" (misurato via ResizeObserver, non un
// indovinello sulla lunghezza del testo).
function DnBody({ text, hand }) {
  const ref = useRef(null)
  const [clamped, setClamped] = useState(false)
  useLayoutEffect(() => {
    const el = ref.current
    if (!el) return
    const check = () => setClamped(el.scrollHeight > el.clientHeight + 1)
    check()
    const ro = new ResizeObserver(check)
    ro.observe(el)
    return () => ro.disconnect()
  }, [text])
  if (!text) return null
  return (
    <span
      ref={ref}
      className={'dn-body' + (clamped ? ' is-clamped' : '')}
      data-hand={hand}
    >
      {text}
    </span>
  )
}

// Vista giorno "pagine" (skin `pages`, web + telefono): la giornata come un
// unico foglio di diario con una timeline 24h compressa a sinistra (altezza
// del blocco = durata della nota). Ogni nota è un cartoncino strappato del
// colore del mood, titolo a "penna doppia" evidenziato in nero, contenuto in
// una delle "mani" casuali; a destra le stesse informazioni della vista
// mese (persone, luogo, canzone, foto). L'intestazione è un foglietto a
// quadretti a parte, più scuro, sovrapposto in alto.
//
// `fit` (solo web, da WebDay.jsx): il foglio non scorre, sta tutto nella
// pagina — l'altezza delle 24h si misura da quanta ce n'è davvero
// (ResizeObserver su .day-track, dentro un contenitore ad altezza fissa),
// invece del TRACK_H fisso usato da telefono (che invece scorre).
export default function DayPages({
  date,
  notes,
  onNavigate,
  peopleById,
  immichUrl,
  immichApiKey,
  fit = false,
  onCreate, // opzionale: con il giorno vuoto offre «Crea la prima nota»
  dreams = [], // sogni del giorno: pallino con la luna sull'asse + nuvoletta (lib/dreams.js)
}) {
  const trackRef = useRef(null)
  const phone = !useIsWide()
  // Con il foglio allungato (.grow) l'altezza del righello è quella delle 24h
  // misurata prima: rimisurarla ora darebbe un ciclo (più alto → più spazio →
  // più alto).
  const grownRef = useRef(false)
  const [fitH, setFitH] = useState(0)
  useLayoutEffect(() => {
    if (!fit) return
    const el = trackRef.current
    if (!el) return
    const update = () => {
      if (!grownRef.current) setFitH(el.clientHeight)
    }
    update()
    const ro = new ResizeObserver(update)
    ro.observe(el)
    return () => ro.disconnect()
  }, [fit])

  const items = useMemo(() => {
    const list = notes.map((n) => {
      // Nota del giorno prima che finisce oggi: da mezzanotte all'ora di fine.
      const carried = Boolean(n.carriedFromPrevious)
      const startMin = carried ? 0 : Math.max(0, Math.min(DAY_MIN, startMinutesOf(n.timeStart)))
      const dur = durationMinutes(n.timeStart, n.timeEnd)
      const endMin = carried
        ? Math.min(DAY_MIN, startMinutesOf(n.timeEnd))
        : Math.min(DAY_MIN, startMin + (dur || 0))

      const people = (n.people || [])
        .map((id) => peopleById?.get(id))
        .filter(Boolean)

      const pl = parsePlace(n.place)
      const placeName = pl?.name?.trim() || ''
      let placeMap = null
      if (placeName) {
        const lat = Number(pl.lat)
        const lon = Number(pl.lon)
        if (Number.isFinite(lat) && Number.isFinite(lon)) {
          placeMap = osmTileFor(lat, lon, 14)
        }
      }

      const song = (n.songs || [])[0] || null
      const songsCount = (n.songs || []).length
      const imgs = (n.images || []).slice(0, 2).map((fn) => ({
        url: fileUrl(n, fn, { thumb: '300x300' }),
      }))
      // Fino a 5 foto per il carosello a "diapositiva unica" della vista
      // mobile (imgs resta a 2 per le due polaroid affiancate del desktop).
      const imgsCarousel = (n.images || []).slice(0, 5).map((fn) => ({
        url: fileUrl(n, fn, { thumb: '300x300' }),
      }))

      return {
        id: n.id,
        carried,
        startMin,
        endMin,
        title: n.title?.trim() || 'Senza titolo',
        body: noteText(n.content),
        hand: handFor(n.id),
        mood: n.mood,
        cw: cardWidthFor(n.id),
        cr: `${tilt(`${n.id}~cr`, 0.8).toFixed(2)}deg`,
        people,
        placeName,
        placeMap,
        song,
        songsCount,
        imgs,
        imgsCarousel,
      }
    })
    list.sort((a, b) => a.startMin - b.startMin)
    return list
  }, [notes, peopleById])

  // Decori di sfondo più fitti quanto più il giorno ha dati (note, persone,
  // luoghi, canzoni, foto) — stesso unico asset "natura", solo ripetuto.
  const deco = useMemo(() => {
    const extras = items.reduce(
      (sum, it) =>
        sum + it.people.length + (it.placeName ? 1 : 0) + (it.song ? 1 : 0),
      0,
    )
    return Math.min(2.1, 1 + items.length * 0.14 + extras * 0.05).toFixed(2)
  }, [items])

  // Mood del giorno (stessa media pesata della vista mese), solo con le note del giorno
  const ownNotes = useMemo(() => notes.filter((n) => !n.carriedFromPrevious), [notes])
  const moodValue = ownNotes.length ? dayMood(ownNotes) : null

  const trackH = fit ? fitH : TRACK_H
  const pxPerMin = trackH / DAY_MIN

  // Telefono: note e sogni stanno alla loro ora, ma se due blocchi si
  // sovrapporrebbero il successivo scende sotto il precedente e il foglio si
  // allunga (e la pagina scorre). Il righello delle ore resta quello vero.
  // Da web (finestra larga) il foglio ha altezza fissa e non si sposta nulla.
  const { pos, sheetH } = useMemo(() => {
    const pos = new Map()
    if (!phone || trackH <= 0) return { pos, sheetH: trackH }
    const blocks = [
      ...dreams.map((d) => ({
        key: `d:${d.id}`,
        top: Math.min(DAY_MIN - 24, dreamMinutes(d)) * pxPerMin,
        h: DREAM_H,
      })),
      ...items.map((it) => ({
        key: `n:${it.id}`,
        top: it.startMin * pxPerMin,
        h: Math.max(MIN_BLOCK_H, (it.endMin - it.startMin) * pxPerMin, 44, phoneMinH(it)),
      })),
    ].sort((a, b) => a.top - b.top)
    let bottom = -Infinity
    for (const b of blocks) {
      const top = Math.max(b.top, bottom + BLOCK_GAP)
      pos.set(b.key, top)
      bottom = top + b.h
    }
    return { pos, sheetH: Math.max(trackH, bottom + BLOCK_GAP) }
  }, [phone, trackH, pxPerMin, dreams, items])
  const grow = fit && phone && sheetH > trackH + 1
  grownRef.current = grow

  return (
    <div className={'day-outer' + (fit ? ' fit' : '') + (grow ? ' grow' : '')}>
      <div className="day-sheet" style={{ '--deco': deco }}>
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
        <div
          className="day-track"
          ref={trackRef}
          style={fit && !grow ? undefined : { height: sheetH }}
        >
          <div className="day-rail" aria-hidden="true">
            {RAIL_HOURS.map((h) => (
              <span
                key={h}
                className="hr"
                style={{ top: Math.min(h * 60 * pxPerMin, TRACK_H) }}
              >
                {String(h % 24).padStart(2, '0')}.00
              </span>
            ))}
            {TICK_HOURS.map((h) => (
              <span
                key={h}
                className="tickline"
                style={{ top: Math.min(h * 60 * pxPerMin, TRACK_H - 1) }}
              />
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
              const top = pos.get(`d:${d.id}`) ?? Math.min(DAY_MIN - 24, dreamMinutes(d)) * pxPerMin
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

          {trackH > 0 && items.map((it) => {
            const top = pos.get(`n:${it.id}`) ?? it.startMin * pxPerMin
            const rawH = (it.endMin - it.startMin) * pxPerMin
            const h = Math.max(MIN_BLOCK_H, rawH, phone ? phoneMinH(it) : 0)
            const hasMedia = Boolean(it.placeName) || Boolean(it.song)
            return (
              <button
                key={it.id}
                type="button"
                onClick={() => {
                  haptic(4, 'page')
                  onNavigate(`/note/${it.id}`)
                }}
                className={'day-note' + (it.imgs.length > 0 ? ' has-photo' : '')}
                // --cw qui (non solo su .dn-card): .dn-side ne ha bisogno per
                // calcolare la propria posizione ("cw + 4%") ed è un fratello
                // di .dn-card, non un discendente — una custom property in
                // style su .dn-card da sola non gli arriva. Senza questo,
                // .dn-side ricadeva sempre sul default (38%) invece del vero
                // valore casuale (40-55%), e la targhetta coi nomi finiva
                // per sovrapporsi al cartoncino ogni volta che quest'ultimo
                // era più largo del default.
                style={{ top, height: h, '--cw': it.cw }}
                aria-label={it.title}
              >
                {/* Cartoncino + (su mobile) contatori e diapositiva foto: un
                    unico contenitore così la vista mobile può affiancarli in
                    riga (cartoncino spostato a sinistra, contatori e foto
                    nello spazio libero). display:contents da desktop: non
                    cambia nulla, la colonna resta quella di sempre. */}
                <span className="dn-notes-row">
                  <span
                    className="dn-card"
                    style={{ '--cr': it.cr, '--mood': moodColor(it.mood) }}
                  >
                    {it.carried && <span className="dn-carry">continua dalla notte</span>}
                    <span className="dn-title">
                      <span className="hl" aria-hidden="true" />
                      <span className="dn-title-text">{it.title}</span>
                    </span>
                    <DnBody text={it.body} hand={it.hand} />
                  </span>

                  {/* Vista mobile: contatori compatti impilati in verticale
                      fra cartoncino e foto (persone, luogo, canzoni — icona +
                      numero). Nascosti da desktop. */}
                  {(it.people.length > 0 || it.placeName || it.songsCount > 0) && (
                    <span className="dn-side-mobile">
                      <DnMiniBadge kind="people" icon="user" count={it.people.length} />
                      <DnMiniBadge kind="place" icon="map-pin" count={it.placeName ? 1 : 0} />
                      <DnMiniBadge kind="song" icon="cassette" count={it.songsCount} />
                    </span>
                  )}

                  {/* Vista mobile: UNA sola "diapositiva" per le foto, a
                      carosello se la nota ne ha più di una. */}
                  <DnPolaMobile
                    imgs={it.imgsCarousel}
                    rotation={`${tilt(`${it.id}pm`, 4).toFixed(2)}deg`}
                  />
                </span>

                {(it.people.length > 0 || hasMedia) && (
                  <span className="dn-side" aria-hidden="true">
                    {it.people.length > 0 && (
                      <span className="dn-tapes">
                        {it.people.map((person) => {
                          return (
                            <span
                              key={person.id}
                              className="dn-tape"
                              style={{ '--tape-c': personTapeColor(person) }}
                            >
                              <PersonAvatar
                                person={person}
                                immichUrl={immichUrl}
                                immichApiKey={immichApiKey}
                                size={18}
                              />
                              <span className="dn-tape-name">{person.name}</span>
                            </span>
                          )
                        })}
                      </span>
                    )}
                    {hasMedia && (
                      <span className="dn-media">
                        {it.placeName && (
                          <span className="dn-place">
                            <span
                              className={'dn-map' + (it.placeMap ? ' real' : '')}
                              style={
                                it.placeMap
                                  ? {
                                      '--map-url': `url(${it.placeMap.url})`,
                                      '--map-pos': it.placeMap.pos,
                                    }
                                  : undefined
                              }
                            />
                            <span className="dn-place-name">{it.placeName}</span>
                          </span>
                        )}
                        {it.song && (
                          <span className="dn-disc-wrap">
                            <span
                              className="dn-disc"
                              style={
                                it.song.thumbnailUrl
                                  ? { '--cover': `url(${it.song.thumbnailUrl})` }
                                  : undefined
                              }
                            />
                            {(it.song.title || it.song.artist) && (
                              <span className="dn-song">
                                {it.song.title && <span className="t">{it.song.title}</span>}
                                {it.song.artist && <span className="a">{it.song.artist}</span>}
                              </span>
                            )}
                          </span>
                        )}
                      </span>
                    )}
                  </span>
                )}

                {it.imgs.length > 0 && (
                  <span
                    className={'dn-polas' + (it.imgs.length > 1 ? ' two' : '')}
                    aria-hidden="true"
                  >
                    {it.imgs.map((im, i) => (
                      <span
                        key={i}
                        className="dn-pola"
                        style={{ '--pr': `${tilt(`${it.id}p${i}`, 4).toFixed(2)}deg` }}
                      >
                        <span className="dn-ph" style={{ backgroundImage: `url(${im.url})` }} />
                      </span>
                    ))}
                  </span>
                )}
              </button>
            )
          })}
        </div>
      </div>
    </div>
  )
}
