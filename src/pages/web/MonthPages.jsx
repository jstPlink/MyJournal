import { useEffect, useLayoutEffect, useMemo, useRef } from 'react'
import { fileUrl } from '../../lib/pocketbase'
import { dayMood, moodColor } from '../../lib/mood'
import { plainText, parsePlace } from '../../lib/notes'
import { parseWall, weekdayLong, todayKey } from '../../lib/dates'
import PersonAvatar from '../../components/PersonAvatar'
import Icon from '../../components/Icon'
import DreamBadge from '../../components/DreamBadge'
import { haptic } from '../../lib/haptics'
import {
  hash,
  handFor,
  tilt,
  rng,
  osmTileFor,
  moodKind,
  personTapeColor,
  useCarouselIndex,
} from '../../lib/pagesSkin'

// Larghezza del cartoncino dei titoli in base a quanto testo contiene: poco
// testo -> cartoncino stretto, molto testo -> più largo (fino a un tetto),
// invece di una percentuale fissa uguale per ogni giorno.
function cardWidthFor(titles) {
  const chars = titles.reduce((sum, t) => sum + t.text.length, 0)
  return `${Math.min(42, Math.max(24, 22 + Math.round(chars / 6)))}%`
}

// ---- Vista MOBILE: la colonna di persone/luogo/musica/foto della vista
// desktop non ci sta; sul telefono diventano targhette-contatore compatte
// (icona + numero: persone, luoghi distinti, canzoni distinte) fra
// cartoncino e foto, e UNA sola "diapositiva" per le foto, a carosello se
// ce n'è più di una — niente due polaroid sovrapposte: meno realistico ma
// molto più leggibile in poco spazio. ----
function MpMiniBadge({ kind, icon, count }) {
  if (!count) return null
  return (
    <span className={`mp-mini mp-mini--${kind}`} aria-hidden="true">
      <Icon name={icon} size={14} strokeWidth={2.6} />
      <span className="mp-mini-text">{count}</span>
    </span>
  )
}

function MpPolaMobile({ imgs, rotation }) {
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

// Imperfezione stabile della pagina: angolo piegato, strappo o niente.
function flawFor(key) {
  switch (hash(`${key}~flaw`) % 6) {
    case 0:
      return 'dogear-br'
    case 1:
      return 'dogear-tr'
    case 2:
      return 'torn'
    default:
      return ''
  }
}

// Frammenti di testo (pezzi dei titoli delle note) da spargere sfumati sullo
// sfondo, con ~1 su 5 sostituito da una macchia. Posizioni/rotazioni/opacità
// deterministiche per giorno.
function buildScribbles(key, titles) {
  const chunks = []
  for (const t of titles) {
    const parts = (t.text || '').split(/\s+/).filter((w) => w.length > 2)
    for (let i = 0; i < parts.length && chunks.length < 8; i += 2) {
      chunks.push(parts.slice(i, i + 2).join(' '))
    }
  }
  if (!chunks.length) return []
  const r = rng(hash(`${key}~scr`))
  const count = Math.min(6, Math.max(3, chunks.length))
  const out = []
  for (let i = 0; i < count; i += 1) {
    const stain = i > 0 && Math.floor(r() * 5) === 0
    out.push({
      id: i,
      kind: stain ? (r() > 0.5 ? 'stain' : 'blot') : null,
      text: stain ? '' : chunks[i % chunks.length],
      left: `${2 + Math.round(r() * 52)}%`,
      top: `${3 + Math.round(r() * 84)}%`,
      rot: `${(r() * 12 - 6).toFixed(1)}deg`,
      op: (0.07 + r() * 0.09).toFixed(3),
      size: stain ? 34 + Math.round(r() * 20) : 0,
    })
  }
  return out
}

// Vista mese "pagine" (solo web, skin `pages`): ogni giorno del mese è una
// pagina di diario impilata sulla precedente. Linguetta-umore a lato (forma
// per fascia d'umore, lunghezza leggermente variabile), testata oro/rossa,
// titoli in "mani" diverse, disegnini + frammenti di testo a tema sullo
// sfondo, polaroid col nastro (due se ci sono ≥2 foto), etichette coi nomi
// delle persone e, se presenti, un francobollo del luogo e un dischetto CD
// della canzone.
// Oltre questo numero le targhette dei nomi si addossano alle altre informazioni
// della pagina: se le persone sono di più se ne mostrano le prime (MAX_TAPES - 1)
// e una targhetta «+x persone» per le altre.
const MAX_TAPES = 4

export default function MonthPages({
  grid,
  byDay,
  monthLabel,
  onNavigate,
  peopleById,
  immichUrl,
  immichApiKey,
  dreamDays, // Set di giorni (AAAA-MM-GG) con almeno un sogno: lunetta sulla pagina
}) {
  const pages = useMemo(() => {
    return grid
      .filter((c) => c.inMonth)
      .map((c) => {
        const dayNotes = byDay.get(c.key) || []
        const has = dayNotes.length > 0
        const p = parseWall(c.key)
        const wdIdx = p ? new Date(p.y, p.mo - 1, p.d).getDay() : 0
        const mood = has ? dayMood(dayNotes) : null

        // Fino a due fotografie (con didascalia) dalle note del giorno, per
        // le due polaroid affiancate della vista desktop; fino a cinque per
        // il carosello a "diapositiva unica" della vista mobile.
        const imgs = []
        const imgsCarousel = []
        for (const n of dayNotes) {
          for (const fn of n.images || []) {
            if (imgsCarousel.length >= 5) break
            const im = {
              url: fileUrl(n, fn, { thumb: '300x300' }),
              cap: n.title?.trim() || plainText(n.content).slice(0, 24),
            }
            imgsCarousel.push(im)
            if (imgs.length < 2) imgs.push(im)
          }
          if (imgsCarousel.length >= 5) break
        }

        // Persone distinte del giorno, risolte sull'elenco locale.
        const pids = []
        for (const n of dayNotes) {
          for (const id of n.people || []) {
            if (!pids.includes(id)) pids.push(id)
          }
        }
        const people = pids
          .map((id) => peopleById?.get(id))
          .filter(Boolean)

        // Primo luogo (con mappa reale se ha coordinate) e prima canzone
        // (con copertina) del giorno: per il francobollo/dischetto della
        // vista desktop. In più, tutti i luoghi e le canzoni distinti (fino
        // a 4) per le targhette a carosello della vista mobile.
        let placeName = ''
        let placeMap = null
        const places = []
        for (const n of dayNotes) {
          const pl = parsePlace(n.place)
          const name = pl?.name?.trim()
          if (!name) continue
          if (!placeName) {
            placeName = name
            const lat = Number(pl.lat)
            const lon = Number(pl.lon)
            if (Number.isFinite(lat) && Number.isFinite(lon)) {
              placeMap = osmTileFor(lat, lon, 13)
            }
          }
          if (places.length < 4 && !places.includes(name)) places.push(name)
        }
        let songCover = null // null = nessuna canzone; '' = canzone senza copertina
        let songTitle = ''
        let songArtist = ''
        const songs = []
        for (const n of dayNotes) {
          const s = (n.songs || [])[0]
          if (!s) continue
          if (songCover === null) {
            songCover = s.thumbnailUrl || ''
            songTitle = (s.title || '').trim()
            songArtist = (s.artist || '').trim()
          }
          const label = (s.title || s.artist || '').trim()
          if (label && songs.length < 4 && !songs.includes(label)) songs.push(label)
        }

        const titles = dayNotes
          .map((n) => ({
            id: n.id,
            text: n.title?.trim() || plainText(n.content).slice(0, 70),
            // Rotazione indipendente per nota (non più legata alla "mano"
            // scelta per il font): così più titoli nello stesso giorno non
            // girano tutti allo stesso angolo insieme al cartoncino.
            rot: `${tilt(`${n.id}~mpn`, 1.6).toFixed(2)}deg`,
          }))
          .filter((t) => t.text)

        return {
          key: c.key,
          dayNum: p ? p.d : '',
          weekday: weekdayLong(c.key),
          weekend: wdIdx === 0 || wdIdx === 6,
          has,
          hasDream: Boolean(dreamDays?.has(c.key)),
          count: dayNotes.length,
          mood,
          kind: has ? moodKind(mood) : null,
          flaw: flawFor(c.key),
          isToday: c.key === todayKey(),
          // lunghezza linguetta: base + casualità, ma con più margine per i
          // punteggi a 3 cifre (100) — la larghezza era pura casualità senza
          // rapporto col numero di cifre, e le silhouette ritagliate
          // (mp-tab--green/yellow/coral) a volte tagliavano l'ultima cifra.
          tw: `${(Math.round(mood * 100) >= 100 ? 68 : 56) + (hash(`${c.key}~tw`) % 13)}px`,
          cw: cardWidthFor(titles),
          titles,
          imgs,
          imgsCarousel,
          people,
          placeName,
          placeMap,
          places,
          songCover,
          songTitle,
          songArtist,
          songs,
          hasSong: songCover !== null,
          scribbles: has ? buildScribbles(c.key, titles) : [],
        }
      })
  }, [grid, byDay, peopleById, dreamDays])

  // Ogni volta che si carica/ricarica il mese corrente (mobile: rimonta a
  // ogni cambio mese; web: `pages` cambia comunque perché dipende da
  // `grid`), porta subito a fuoco il giorno di oggi — niente `.is-today`
  // nel DOM se il mese mostrato non è quello corrente, quindi qui non fa
  // nulla nei mesi passati/futuri.
  const stackRef = useRef(null)
  useEffect(() => {
    stackRef.current?.querySelector('.is-today')?.scrollIntoView({ block: 'center' })
  }, [pages])

  // La colonna delle targhette (.mp-side) è posizionata in modo assoluto: deve
  // partire DOPO il cartoncino del mood. La larghezza del cartoncino dipende dal
  // titolo più lungo e dal font, quindi una stima dal numero di caratteri
  // (cardWidthFor) non basta: i nomi finivano sopra il cartoncino. Si misura il
  // bordo destro vero (rispetto alla pagina) e lo si passa al CSS come
  // --mp-card-r; un ResizeObserver lo tiene aggiornato (font che si caricano,
  // finestra ridimensionata).
  useLayoutEffect(() => {
    const root = stackRef.current
    if (!root) return undefined
    const sync = (card) => {
      const page = card.closest('.mp-page')
      if (!page) return
      page.style.setProperty('--mp-card-r', `${card.offsetLeft + card.offsetWidth}px`)
    }
    const cards = root.querySelectorAll('.mp-notes')
    cards.forEach(sync)
    if (typeof ResizeObserver === 'undefined') return undefined
    const ro = new ResizeObserver((entries) => entries.forEach((e) => sync(e.target)))
    cards.forEach((c) => ro.observe(c))
    return () => ro.disconnect()
  }, [pages])

  return (
    <div className="month-pages">
      <div className="mp-stack" ref={stackRef}>
        {pages.map((pg) => {
          const hasMedia = Boolean(pg.placeName) || pg.hasSong
          return (
            <button
              key={pg.key}
              type="button"
              onClick={() => {
                haptic(4, 'page')
                onNavigate(`/day/${pg.key}`)
              }}
              style={{
                '--r': `${tilt(pg.key, 1.3).toFixed(2)}deg`,
                '--mp-cw': pg.cw,
              }}
              className={
                'mp-page' +
                (pg.weekend ? ' wknd' : '') +
                (pg.has ? '' : ' is-empty') +
                (pg.isToday ? ' is-today' : '') +
                (pg.imgs.length > 0 ? ' has-photo' : '') +
                (pg.imgs.length > 1 ? ' two-photo' : '') +
                (pg.people.length > 0 ? ' has-tapes' : '') +
                (hasMedia ? ' has-media' : '') +
                (pg.kind ? ` mood-${pg.kind}` : '') +
                (pg.flaw && !pg.isToday ? ` ${pg.flaw}` : '')
              }
              aria-label={
                `${pg.weekday} ${pg.dayNum} ${monthLabel} — ` +
                (pg.has
                  ? `${pg.count} ${pg.count === 1 ? 'nota' : 'note'}`
                  : 'nessuna nota')
              }
            >
              {pg.isToday && (
                <span className="mp-today-tape" aria-hidden="true" />
              )}

              {pg.has && (
                <span
                  className={'mp-tab' + (pg.kind ? ` mp-tab--${pg.kind}` : '')}
                  aria-hidden="true"
                  style={{ '--mp-tab': moodColor(pg.mood), '--mp-tw': pg.tw }}
                >
                  <b>{Math.round(pg.mood * 100)}</b>
                </span>
              )}

              <span className="mp-head">
                <span className="mp-wd">
                  <span className="mp-hl" aria-hidden="true" />
                  {pg.weekday}&nbsp;{pg.dayNum}
                </span>
                {pg.hasDream && (
                  <span className="mp-moon" title="Sogno" aria-label="Quel giorno hai segnato un sogno">
                    <DreamBadge iconSize={13} />
                  </span>
                )}
              </span>

              {/* Cartoncino + (su mobile) targhette e diapositiva foto: un
                  unico contenitore così la vista mobile può affiancarli in
                  riga (cartoncino spostato a sinistra, targhette e foto nello
                  spazio libero). display:contents da desktop: non cambia
                  nulla, la colonna resta quella di sempre. */}
              <span className="mp-notes-row">
                {pg.titles.length > 0 && (
                  <span
                    className="mp-notes"
                    style={{ '--mp-mood': moodColor(pg.mood) }}
                  >
                    {pg.titles.map((t) => (
                      <span
                        key={t.id}
                        className="mp-n"
                        data-hand={handFor(t.id)}
                        style={{ '--nr': t.rot }}
                      >
                        {t.text}
                      </span>
                    ))}
                  </span>
                )}

                {/* Vista mobile: targhette-contatore compatte impilate in
                    verticale fra cartoncino e foto (icona + numero: persone,
                    luoghi distinti, canzoni distinte). Nascoste da desktop. */}
                {(pg.people.length > 0 || pg.places.length > 0 || pg.songs.length > 0) && (
                  <span className="mp-side-mobile">
                    <MpMiniBadge kind="people" icon="user" count={pg.people.length} />
                    <MpMiniBadge kind="place" icon="map-pin" count={pg.places.length} />
                    <MpMiniBadge kind="song" icon="cassette" count={pg.songs.length} />
                  </span>
                )}

                {/* Vista mobile: UNA sola "diapositiva" per le foto, a
                    carosello se ce n'è più di una (niente due polaroid
                    sovrapposte: poco realistico ma molto più leggibile). */}
                <MpPolaMobile
                  imgs={pg.imgsCarousel}
                  rotation={`${tilt(`${pg.key}pm`, 4).toFixed(2)}deg`}
                />
              </span>

              {pg.scribbles.length > 0 && (
                <span className="mp-scribbles" aria-hidden="true">
                  {pg.scribbles.map((s) => (
                    <span
                      key={s.id}
                      className={s.kind || undefined}
                      style={
                        s.kind
                          ? {
                              left: s.left,
                              top: s.top,
                              '--sr': s.rot,
                              '--sw': `${s.size}px`,
                            }
                          : {
                              left: s.left,
                              top: s.top,
                              '--sr': s.rot,
                              '--so': s.op,
                            }
                      }
                    >
                      {s.text}
                    </span>
                  ))}
                </span>
              )}

              {(pg.people.length > 0 || hasMedia) && (
                <span className="mp-side" aria-hidden="true">
                  {pg.people.length > 0 && (
                    <span className="mp-tapes">
                      {(pg.people.length > MAX_TAPES
                        ? pg.people.slice(0, MAX_TAPES - 1)
                        : pg.people
                      ).map((person) => {
                        return (
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
                        )
                      })}
                      {pg.people.length > MAX_TAPES && (
                        <span className="mp-tape mp-tape-more" style={{ '--tape-c': '#a39a86' }}>
                          <span className="mp-tape-name">
                            +{pg.people.length - (MAX_TAPES - 1)}{' '}
                            {pg.people.length - (MAX_TAPES - 1) === 1 ? 'persona' : 'persone'}
                          </span>
                        </span>
                      )}
                    </span>
                  )}

                  {hasMedia && (
                    <span className="mp-place-row">
                      {pg.placeName && (
                        <span className="mp-place">
                          <span
                            className={'mp-map' + (pg.placeMap ? ' real' : '')}
                            style={
                              pg.placeMap
                                ? {
                                    '--map-url': `url(${pg.placeMap.url})`,
                                    '--map-pos': pg.placeMap.pos,
                                  }
                                : undefined
                            }
                          />
                          <span className="mp-place-name">{pg.placeName}</span>
                        </span>
                      )}
                      {pg.hasSong && (
                        <span className="mp-disc-wrap">
                          <span
                            className="mp-disc"
                            style={
                              pg.songCover
                                ? { '--cover': `url(${pg.songCover})` }
                                : undefined
                            }
                          />
                          {(pg.songTitle || pg.songArtist) && (
                            <span className="mp-song">
                              {pg.songTitle && (
                                <span className="t">{pg.songTitle}</span>
                              )}
                              {pg.songArtist && (
                                <span className="a">{pg.songArtist}</span>
                              )}
                            </span>
                          )}
                        </span>
                      )}
                    </span>
                  )}
                </span>
              )}

              {pg.imgs.length > 0 && (
                <span
                  className={'mp-polas' + (pg.imgs.length > 1 ? ' two' : '')}
                  aria-hidden="true"
                >
                  {pg.imgs.map((im, i) => (
                    <span
                      key={i}
                      className={'mp-pola' + (i === 0 ? ' tc' : '')}
                      style={{
                        '--pr': `${tilt(`${pg.key}p${i}`, 5).toFixed(2)}deg`,
                      }}
                    >
                      <span
                        className="mp-ph"
                        style={{ backgroundImage: `url(${im.url})` }}
                      />
                      {im.cap && <span className="mp-cap">{im.cap}</span>}
                    </span>
                  ))}
                </span>
              )}
            </button>
          )
        })}
      </div>
    </div>
  )
}
