import { useEffect, useRef, useState } from 'react'
import { sortByName } from '../lib/sort'
import ExistingMatches from './ExistingMatches'
import { useBackClose } from '../hooks/useBack'
import { createPortal } from 'react-dom'
import Icon from './Icon'
import { loadLeaflet, searchPlaces, reverseGeocode } from '../lib/leaflet'
import { listPlaces, upsertPlaceIfMissing } from '../lib/places'
import { listMymapVisits, lookupPlaceName, describeMymapError, hhmm } from '../lib/mymap'
import { addDaysKey, dayKey, dayMonthLabel, weekdayShort } from '../lib/dates'

const SOURCE_KEY = 'myjournal.placeSource'

function readSource() {
  try {
    return localStorage.getItem(SOURCE_KEY) === 'mymap' ? 'mymap' : 'myjournal'
  } catch {
    return 'myjournal'
  }
}

function fmtMinutes(min) {
  if (min < 60) return `${min} min`
  const h = Math.floor(min / 60)
  const m = min % 60
  return m ? `${h} h ${m} min` : `${h} h`
}

const DEFAULT_CENTER = [41.9, 12.5] // Italia, vista d'insieme
const DEFAULT_ZOOM = 5

// Segnalino personalizzato (coerente con la palette dell'app) per il punto
// scelto sulla mappa: più riconoscibile del segnalino blu di default.
function customMarkerIcon(L) {
  return L.divIcon({
    className: '',
    html:
      '<svg width="30" height="30" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg">' +
      '<path d="M21 10c0 6-9 12-9 12s-9-6-9-12a9 9 0 0 1 18 0Z" fill="#e0655e" stroke="#3a3226" stroke-width="1.2"/>' +
      '<circle cx="12" cy="10" r="3.2" fill="#fdf7ea"/>' +
      '</svg>',
    iconSize: [30, 30],
    iconAnchor: [15, 29],
  })
}

// Dialog per scegliere un luogo su una mappa reale (Leaflet + OpenStreetMap,
// nessuna chiave API): si cerca per nome, oppure si tocca direttamente un
// punto qualsiasi sulla mappa. Il punto viene selezionato SEMPRE, anche se
// OpenStreetMap non riconosce un indirizzo lì (es. un punto in mezzo alla
// natura): in quel caso il nome va scritto a mano.
// `initial` (opzionale): { name, lat, lon } di un luogo da MODIFICARE. Se
// presente, la mappa parte centrata lì col segnalino già posato e il nome
// precompilato, il titolo/azione diventano "Modifica luogo", e il luogo NON
// viene ri-salvato tra quelli curati (lo aggiorna chi chiama).
// `mymap` (opzionale): { url, email, password } dell'integrazione MyMap. Se
// presente (e non si sta modificando) compare la scelta della sorgente
// "MyJournal" / "MyMap"; con MyMap si propongono i posti visitati nel giorno
// `dateKey` (quello della nota), cambiabile con le frecce.
export default function PlacePickerSheet({
  open,
  onClose,
  onAdd,
  initial = null,
  mymap = null,
  dateKey = '',
}) {
  const showSources = Boolean(mymap) && !initial
  const [source, setSource] = useState(readSource)
  const fromMymap = showSources && source === 'mymap'
  const [visitDay, setVisitDay] = useState('')
  const [visits, setVisits] = useState(null)
  const [visitsError, setVisitsError] = useState('')
  const [visitNames, setVisitNames] = useState({})
  const mymapRef = useRef(mymap)
  mymapRef.current = mymap
  const mymapKey = mymap ? `${mymap.url}|${mymap.email}|${mymap.password}` : ''
  const [query, setQuery] = useState('')
  const [results, setResults] = useState([])
  const [searching, setSearching] = useState(false)
  const [error, setError] = useState('')
  const [selected, setSelected] = useState(null)
  const [nameOverride, setNameOverride] = useState('')
  const [locating, setLocating] = useState(false)
  const [savedPlaces, setSavedPlaces] = useState([])

  const mapElRef = useRef(null)
  const mapRef = useRef(null)
  const markerRef = useRef(null)
  // `initial` serve solo al momento della creazione della mappa (effect su
  // [open]); via ref per non entrare tra le dipendenze dell'effect.
  const initialRef = useRef(initial)
  initialRef.current = initial

  // Luoghi salvati (Impostazioni → Luoghi, o aggiunti in precedenza da una
  // nota), per riproporli invece di dover ricercare/ridigitare da capo un
  // posto in cui si è già stati.
  useEffect(() => {
    if (!open) return
    let alive = true
    listPlaces()
      .then((places) => alive && setSavedPlaces(places))
      .catch(() => {})
    return () => {
      alive = false
    }
  }, [open])

  // All'apertura riparte dal giorno della nota e dall'ultima sorgente usata.
  useEffect(() => {
    if (!open) return
    setSource(readSource())
    setVisitDay(dayKey(dateKey) || dayKey(new Date()))
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open])

  // Posti visitati del giorno scelto da MyMap; i nomi mancanti si cercano su
  // OpenStreetMap uno alla volta (limite del servizio), man mano che arrivano.
  useEffect(() => {
    if (!open || !fromMymap || !visitDay || !mymapRef.current) return
    let alive = true
    setVisits(null)
    setVisitsError('')
    setVisitNames({})
    listMymapVisits(mymapRef.current, visitDay)
      .then(async (list) => {
        if (!alive) return
        setVisits(list)
        for (let i = 0; i < list.length; i++) {
          if (!alive) return
          if (list[i].name) continue
          const name = await lookupPlaceName(list[i].lat, list[i].lon)
          if (!alive) return
          if (name) setVisitNames((prev) => ({ ...prev, [i]: name }))
        }
      })
      .catch((err) => alive && setVisitsError(describeMymapError(err)))
    return () => {
      alive = false
    }
  }, [open, fromMymap, visitDay, mymapKey])

  // Se il nome di un posto già selezionato arriva dopo il tocco, lo precompila
  // (solo se non si è ancora scritto nulla).
  useEffect(() => {
    if (!selected || !visits) return
    const i = visits.findIndex((v) => `mymap-${v.start}` === selected.id)
    if (i >= 0 && visitNames[i]) setNameOverride((cur) => cur || visitNames[i])
  }, [visitNames, selected, visits])

  // Crea la mappa una volta sola all'apertura, con tocco per selezionare un punto.
  useEffect(() => {
    if (!open) return
    let cancelled = false
    loadLeaflet()
      .then((L) => {
        if (cancelled || !mapElRef.current || mapRef.current) return
        const map = L.map(mapElRef.current).setView(DEFAULT_CENTER, DEFAULT_ZOOM)
        L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
          attribution: '© OpenStreetMap',
          maxZoom: 19,
        }).addTo(map)
        // Modifica di un luogo esistente: parti da lì col segnalino posato.
        const init = initialRef.current
        if (init && init.lat != null && init.lon != null) {
          placeMarker(map, L, {
            id: 'initial',
            name: init.name || '',
            shortName: init.name || '',
            lat: init.lat,
            lon: init.lon,
          })
        }
        map.on('click', async (e) => {
          const { lat, lng } = e.latlng
          setLocating(true)
          setError('')
          try {
            const place = await reverseGeocode(lat, lng)
            placeMarker(map, L, place)
          } catch {
            // Punto senza indirizzo riconosciuto: lo selezioniamo comunque,
            // il nome lo scrive a mano l'utente qui sotto.
            placeMarker(map, L, {
              id: `manual-${lat}-${lng}`,
              name: '',
              shortName: '',
              lat,
              lon: lng,
            })
          } finally {
            setLocating(false)
          }
        })
        mapRef.current = map
      })
      .catch((err) => setError(err.message))
    return () => {
      cancelled = true
    }
  }, [open])

  // Distrugge la mappa alla chiusura, per poterla ricreare pulita la volta dopo.
  useEffect(() => {
    if (open) return
    if (mapRef.current) {
      mapRef.current.remove()
      mapRef.current = null
      markerRef.current = null
    }
    setQuery('')
    setResults([])
    setSelected(null)
    setNameOverride('')
    setError('')
    setSavedPlaces([])
    setVisits(null)
    setVisitsError('')
    setVisitNames({})
  }, [open])

  useBackClose(open, onClose)
  if (!open) return null

  function chooseSource(next) {
    setSource(next)
    try {
      localStorage.setItem(SOURCE_KEY, next)
    } catch {
      // preferenza non salvabile: vale solo per questa apertura
    }
  }

  function pickVisit(v, i) {
    const map = mapRef.current
    if (!map || !window.L) return
    const name = v.name || visitNames[i] || ''
    placeMarker(map, window.L, {
      id: `mymap-${v.start}`,
      name,
      shortName: name,
      lat: v.lat,
      lon: v.lon,
    })
  }

  function placeMarker(map, L, place) {
    setSelected(place)
    setNameOverride(place.shortName || '')
    map.setView([place.lat, place.lon], Math.max(map.getZoom(), 15))
    if (markerRef.current) markerRef.current.remove()
    markerRef.current = L.marker([place.lat, place.lon], {
      icon: customMarkerIcon(L),
    }).addTo(map)
  }

  async function runSearch() {
    if (!query.trim() || searching) return
    setSearching(true)
    setError('')
    try {
      const found = await searchPlaces(query.trim())
      setResults(found)
    } catch (err) {
      setError(err.message)
    } finally {
      setSearching(false)
    }
  }

  function pickResult(place) {
    const map = mapRef.current
    if (!map || !window.L) return
    placeMarker(map, window.L, place)
  }

  function confirm() {
    if (!selected || !nameOverride.trim()) return
    const place = { name: nameOverride.trim(), lat: selected.lat, lon: selected.lon }
    onAdd(place)
    // In creazione lo salva anche tra i luoghi curati (se non ce n'è già uno
    // con lo stesso nome). In modifica no: lo aggiorna chi ha aperto il
    // dialog, che sa quale record toccare e come propagare alle note.
    if (!initial) upsertPlaceIfMissing(place, savedPlaces).catch(() => {})
    onClose()
  }

  // In portal su <body>: annidato nella pagina, il fixed poteva restare
  // legato al contenitore invece che alla vera finestra (sfondo scuro che
  // non copriva tutto, pannello fuori dai bordi visibili).
  return createPortal(
    <div
      className="fixed inset-0 z-50 flex items-end justify-center bg-black/45 sm:items-center"
      onClick={onClose}
    >
      <div
        className="flex h-[85vh] w-full max-w-lg flex-col overflow-hidden rounded-t-3xl bg-cream sm:h-[80vh] sm:rounded-3xl"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center justify-between border-b border-line px-5 py-4">
          <h3 className="text-lg font-extrabold text-ink">
            {initial ? 'Modifica luogo' : 'Aggiungi luogo'}
          </h3>
          <button
            type="button"
            onClick={onClose}
            className="rounded-full p-1 text-ink-soft transition hover:text-ink"
            title="Chiudi"
          >
            <Icon name="x" size={20} />
          </button>
        </div>

        {showSources && (
          <div className="flex gap-2 border-b border-line px-5 py-3" role="tablist">
            {[
              ['myjournal', 'MyJournal', 'search'],
              ['mymap', 'MyMap', 'map-pin'],
            ].map(([key, label, icon]) => (
              <button
                key={key}
                type="button"
                role="tab"
                aria-selected={source === key}
                onClick={() => chooseSource(key)}
                className={
                  'flex flex-1 items-center justify-center gap-1.5 rounded-full border px-3 py-1.5 text-xs font-bold transition ' +
                  (source === key
                    ? 'border-ink bg-ink text-cream'
                    : 'border-line bg-tag text-ink hover:bg-cream')
                }
              >
                <Icon name={icon} size={13} />
                {label}
              </button>
            ))}
          </div>
        )}

        {fromMymap && (
          <div className="border-b border-line px-5 py-3">
            <div className="mb-2 flex items-center justify-between">
              <button
                type="button"
                onClick={() => setVisitDay((d) => addDaysKey(d, -1))}
                className="rounded-full p-1 text-ink-soft transition hover:text-ink"
                title="Giorno precedente"
                aria-label="Giorno precedente"
              >
                <Icon name="chevron-left" size={18} />
              </button>
              <p className="text-xs font-semibold uppercase tracking-wide text-ink-soft">
                Posti visitati · {weekdayShort(visitDay)} {dayMonthLabel(visitDay)}
              </p>
              <button
                type="button"
                onClick={() => setVisitDay((d) => addDaysKey(d, 1))}
                className="rounded-full p-1 text-ink-soft transition hover:text-ink"
                title="Giorno successivo"
                aria-label="Giorno successivo"
              >
                <Icon name="chevron-right" size={18} />
              </button>
            </div>
            {visitsError ? (
              <p className="text-xs text-delete-dark">{visitsError}</p>
            ) : visits === null ? (
              <p className="text-xs text-ink-soft">Carico i posti da MyMap…</p>
            ) : visits.length === 0 ? (
              <p className="text-xs text-ink-soft">
                Nessun posto registrato in questo giorno (servono soste di
                almeno 20 minuti). Cambia giorno o tocca un punto sulla mappa.
              </p>
            ) : (
              <div className="max-h-40 space-y-1 overflow-y-auto">
                {visits.map((v, i) => {
                  const name = v.name || visitNames[i]
                  const active = selected?.id === `mymap-${v.start}`
                  return (
                    <button
                      key={v.start}
                      type="button"
                      onClick={() => pickVisit(v, i)}
                      className={
                        'flex w-full items-center gap-2 rounded-xl px-3 py-2 text-left text-sm transition ' +
                        (active ? 'bg-ink text-cream' : 'text-ink hover:bg-tag')
                      }
                    >
                      <span className="min-w-0 flex-1 truncate font-semibold">
                        {name || 'Cerco il nome…'}
                      </span>
                      <span
                        className={
                          'shrink-0 text-xs ' + (active ? 'text-cream/80' : 'text-ink-soft')
                        }
                      >
                        {hhmm(v.start)}–{hhmm(v.end)} · {fmtMinutes(v.minutes)}
                      </span>
                    </button>
                  )
                })}
              </div>
            )}
          </div>
        )}

        {!fromMymap && (
        <div className="flex gap-2 border-b border-line px-5 py-3">
          <input
            type="text"
            placeholder="Cerca un luogo…"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            onKeyDown={(e) => e.key === 'Enter' && runSearch()}
            className="min-w-0 flex-1 rounded-xl border border-line bg-tag px-3 py-2 text-sm text-ink outline-none"
          />
          <button
            type="button"
            disabled={!query.trim() || searching}
            onClick={runSearch}
            className="shrink-0 rounded-xl border border-save-dark bg-save px-3 py-2 text-sm font-bold text-ink transition disabled:opacity-50"
          >
            {searching ? '…' : 'Cerca'}
          </button>
        </div>
        )}

        {!fromMymap && !initial && (
          <ExistingMatches
            query={query}
            items={savedPlaces}
            onPick={(p) => {
              setQuery('')
              onAdd(p)
              onClose()
            }}
            label="Luoghi già salvati"
            className="border-b border-line px-5 py-2"
          />
        )}

        {!fromMymap && !initial && !results.length && savedPlaces.length > 0 && (
          <div className="border-b border-line px-5 py-3">
            <p className="mb-2 text-xs font-semibold uppercase tracking-wide text-ink-soft">
              Luoghi salvati
            </p>
            {/* scorre se i luoghi sono tanti: prima la lista non si poteva scorrere e spingeva via la mappa */}
            <div className="grid max-h-40 grid-cols-3 gap-1.5 overflow-y-auto overscroll-contain pr-1">
              {sortByName(savedPlaces).map((p) => (
                <button
                  key={p.id}
                  type="button"
                  onClick={() => {
                    onAdd(p)
                    onClose()
                  }}
                  className="flex min-w-0 items-center gap-1.5 rounded-full border border-line bg-tag px-3 py-1.5 text-xs font-semibold text-ink transition hover:bg-cream"
                >
                  <Icon name="map-pin" size={12} className="text-ink-soft" />
                  <span className="min-w-0 truncate">{p.name}</span>
                </button>
              ))}
            </div>
          </div>
        )}

        {!fromMymap && (
          <p className="px-5 pt-2 text-xs text-ink-soft">
            Oppure tocca direttamente un punto sulla mappa: puoi scegliere
            qualsiasi punto, anche se non viene riconosciuto un indirizzo.
          </p>
        )}
        {error && <p className="px-5 pt-1 text-xs text-delete-dark">{error}</p>}

        {!fromMymap && results.length > 0 && (
          <div className="max-h-32 overflow-y-auto px-3 pt-2">
            {results.map((r) => (
              <button
                key={r.id}
                type="button"
                onClick={() => pickResult(r)}
                className={
                  'block w-full truncate rounded-xl px-3 py-2 text-left text-sm transition ' +
                  (selected?.id === r.id
                    ? 'bg-ink text-cream'
                    : 'text-ink hover:bg-tag')
                }
                title={r.name}
              >
                {r.name}
              </button>
            ))}
          </div>
        )}

        <div className="isolate relative mt-2 min-h-0 flex-1">
          <div ref={mapElRef} className="h-full w-full" />
          {locating && (
            <div className="pointer-events-none absolute inset-x-0 top-2 z-[1000] flex justify-center">
              <span className="rounded-full bg-ink px-3 py-1 text-xs font-semibold text-cream shadow">
                Riconosco il punto…
              </span>
            </div>
          )}
        </div>

        <div className="border-t border-line px-5 py-4">
          {selected && (
            <input
              type="text"
              placeholder="Nome del luogo…"
              value={nameOverride}
              onChange={(e) => setNameOverride(e.target.value)}
              className="mb-2 w-full rounded-xl border border-line bg-tag px-3 py-2 text-sm text-ink outline-none"
            />
          )}
          <button
            type="button"
            disabled={!selected || !nameOverride.trim()}
            onClick={confirm}
            className="w-full rounded-full bg-save px-6 py-3 text-sm font-bold text-ink transition active:scale-95 disabled:opacity-50"
          >
            {selected
              ? initial
                ? `Salva "${nameOverride.trim() || '…'}"`
                : `Aggiungi "${nameOverride.trim() || '…'}"`
              : 'Cerca o tocca un punto sulla mappa'}
          </button>
        </div>
      </div>
    </div>,
    document.body,
  )
}
