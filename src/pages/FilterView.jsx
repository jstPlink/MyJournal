import { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { useGoBack } from '../hooks/useBack'
import PhoneShell from '../components/PhoneShell'
import MobileTopBar from '../components/MobileTopBar'
import MobileBottomBar from '../components/MobileBottomBar'
import Footer from '../components/Footer'
import Icon from '../components/Icon'
import PersonAvatar from '../components/PersonAvatar'
import { useAuth } from '../context/AuthContext'
import {
  listNotesFiltered,
  describeError,
  peopleUsageCounts,
  songsUsageList,
  plainText,
} from '../lib/notes'
import { listPeople, topByUsage } from '../lib/people'
import { listTags } from '../lib/tags'
import { listPlaces } from '../lib/places'
import { moodColor, moodTextColor } from '../lib/mood'
import { dateRangeBounds, dayKey, dayMonthLabel, timeLabel, todayKey } from '../lib/dates'
import { haptic } from '../lib/haptics'
import { listDreamsFiltered, dreamTitle } from '../lib/dreams'

const SORTS = [
  { key: 'mood-desc', label: 'Mood più alto' },
  { key: 'mood-asc', label: 'Mood più basso' },
  { key: 'date-desc', label: 'Più recenti' },
  { key: 'date-asc', label: 'Meno recenti' },
]

function sortNotes(list, sort) {
  const arr = [...list]
  switch (sort) {
    case 'mood-asc':
      arr.sort((a, b) => Number(a.mood) - Number(b.mood))
      break
    case 'date-asc':
      arr.sort((a, b) => (a.date < b.date ? -1 : a.date > b.date ? 1 : 0))
      break
    case 'date-desc':
      arr.sort((a, b) => (a.date > b.date ? -1 : a.date < b.date ? 1 : 0))
      break
    case 'mood-desc':
    default:
      arr.sort((a, b) => Number(b.mood) - Number(a.mood))
  }
  return arr
}

const inputCls = 'wf-input'

function ChipButton({ active, onClick, icon, square, children }) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={'wf-chip' + (square ? ' sq' : '') + (active ? ' active' : '')}
    >
      {icon && <Icon name={icon} size={12} />}
      {children}
    </button>
  )
}

export default function FilterView() {
  const navigate = useNavigate()
  const goBack = useGoBack()
  const { user } = useAuth()
  const immichUrl = user?.immichUrl?.trim()
  const immichApiKey = user?.immichApiKey?.trim()
  const [peopleOpen, setPeopleOpen] = useState(false)
  const [placesOpen, setPlacesOpen] = useState(false)
  const [tagsOpen, setTagsOpen] = useState(false)
  const [sortOpen, setSortOpen] = useState(false)
  const [songsOpen, setSongsOpen] = useState(false)
  const [peopleUsage, setPeopleUsage] = useState(null)
  const [showAllPeople, setShowAllPeople] = useState(false)
  const [filters, setFilters] = useState({
    from: '',
    to: '',
    moodMin: 0,
    moodMax: 100,
    sort: 'mood-desc',
    limit: '',
    text: '',
    place: '',
    song: '',
    personIds: [],
    tagIds: [],
    hasSongs: false,
    hasPlace: false,
  })
  const [kind, setKind] = useState('notes') // cosa cercare: 'notes' | 'dreams' | 'all'
  const [results, setResults] = useState(null) // null = filtri non ancora applicati
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const [people, setPeople] = useState([])
  const [peopleError, setPeopleError] = useState('')
  const [tags, setTags] = useState([])
  const [tagsError, setTagsError] = useState('')
  const [places, setPlaces] = useState([])
  const [placesError, setPlacesError] = useState('')
  const [songs, setSongs] = useState([])
  const [songsError, setSongsError] = useState('')

  useEffect(() => {
    listPeople()
      .then(setPeople)
      .catch((err) => setPeopleError(describeError(err)))
    listTags()
      .then(setTags)
      .catch((err) => setTagsError(describeError(err)))
    listPlaces()
      .then(setPlaces)
      .catch((err) => setPlacesError(describeError(err)))
    songsUsageList()
      .then(setSongs)
      .catch((err) => setSongsError(describeError(err)))
    peopleUsageCounts()
      .then(setPeopleUsage)
      .catch(() => {})
  }, [])

  const set = (patch) => setFilters((f) => ({ ...f, ...patch }))

  function togglePerson(id) {
    set({
      personIds: filters.personIds.includes(id)
        ? filters.personIds.filter((x) => x !== id)
        : [...filters.personIds, id],
    })
  }

  function toggleTag(id) {
    set({
      tagIds: filters.tagIds.includes(id)
        ? filters.tagIds.filter((x) => x !== id)
        : [...filters.tagIds, id],
    })
  }

  // Un solo luogo alla volta (il filtro sottostante confronta per nome, non
  // per relazione multipla come persone/tag): un secondo tap lo toglie.
  function togglePlace(name) {
    set({ place: filters.place === name ? '' : name })
  }

  // Una sola canzone alla volta, come il luogo (non è una relazione, è un
  // titolo confrontato per uguaglianza — vedi listNotesFiltered).
  function toggleSong(title) {
    set({ song: filters.song === title ? '' : title })
  }

  async function applyFilters() {
    haptic()
    setLoading(true)
    setError('')
    try {
      const { start, end } = dateRangeBounds(filters.from, filters.to)
      const moodMin = filters.moodMin > 0 ? filters.moodMin / 100 : undefined
      const moodMax = filters.moodMax < 100 ? filters.moodMax / 100 : undefined
      const dreamList =
        kind === 'notes'
          ? []
          : (await listDreamsFiltered({ start, end, text: filters.text })).map((d) => ({ ...d, _dream: true }))
      const list = kind === 'dreams' ? [] : await listNotesFiltered({
        start,
        end,
        moodMin,
        moodMax,
        text: filters.text,
        place: filters.place,
        song: filters.song,
        personIds: filters.personIds,
        tagIds: filters.tagIds,
        hasSongs: filters.hasSongs,
        hasPlace: filters.hasPlace,
      })
      const sorted = [...sortNotes(list, filters.sort), ...dreamList]
      const limit = Number(filters.limit)
      setResults(limit > 0 ? sorted.slice(0, limit) : sorted)
    } catch (err) {
      setError(describeError(err))
      setResults([])
    } finally {
      setLoading(false)
    }
  }

  return (
    <PhoneShell>
      <MobileTopBar className="mtop-day">
        <button
          type="button"
          className="mchev"
          onClick={() => {
            haptic()
            goBack()
          }}
          title="Indietro"
          aria-label="Indietro"
        >
          <Icon name="chevron-left" size={21} strokeWidth={2.8} />
        </button>
        <h2 className="flex-1 text-center font-serif text-xl font-extrabold text-ink">
          Filtri
        </h2>
        <span className="w-[34px]" />
      </MobileTopBar>

      <main className="anim-page flex-1 overflow-y-auto no-scrollbar px-3 py-4">
        <div className="space-y-2.5">
          <div className="wf-sub">
            <p className="wf-title">
              <Icon name="list" size={15} />
              Mostra
            </p>
            <div className="wf-chips">
              <ChipButton active={kind === 'notes'} onClick={() => setKind('notes')}>
                Note
              </ChipButton>
              <ChipButton icon="moon" active={kind === 'dreams'} onClick={() => setKind('dreams')}>
                Sogni
              </ChipButton>
              <ChipButton active={kind === 'all'} onClick={() => setKind('all')}>
                Tutto
              </ChipButton>
            </div>
            {kind !== 'notes' && (
              <p className="text-xs text-ink-soft">
                Per i sogni valgono solo periodo e testo (titolo e descrizione).
              </p>
            )}
          </div>

          <div className="wf-sub">
            <p className="wf-title">
              <Icon name="calendar" size={15} />
              Periodo
            </p>
            <div className="wf-row">
              <input
                type="date"
                aria-label="Da"
                value={filters.from}
                onChange={(e) => set({ from: e.target.value })}
                className={inputCls}
              />
              <span className="wf-sep">–</span>
              <input
                type="date"
                aria-label="A"
                value={filters.to}
                onChange={(e) => set({ to: e.target.value })}
                className={inputCls}
              />
            </div>
          </div>

          <div className="wf-sub">
            <p className="wf-title">
              <Icon name="sparkles" size={15} />
              Mood (0–100)
            </p>
            <div className="wf-row">
              <input
                type="number"
                min={0}
                max={100}
                step={5}
                aria-label="Mood minimo"
                value={filters.moodMin}
                onChange={(e) => set({ moodMin: Number(e.target.value) })}
                className={inputCls}
              />
              <span className="wf-sep">–</span>
              <input
                type="number"
                min={0}
                max={100}
                step={5}
                aria-label="Mood massimo"
                value={filters.moodMax}
                onChange={(e) => set({ moodMax: Number(e.target.value) })}
                className={inputCls}
              />
            </div>
          </div>

          <div className="wf-sub">
            <p className="wf-title">
              <Icon name="search" size={15} />
              Testo (titolo e contenuto)
            </p>
            <input
              type="text"
              placeholder="Cerca nel testo…"
              value={filters.text}
              onChange={(e) => set({ text: e.target.value })}
              className={inputCls}
            />
          </div>

          <div className="wf-sub">
            <button
              type="button"
              onClick={() => setPlacesOpen((v) => !v)}
              className="wf-title w-full"
            >
              <Icon name="map-pin" size={15} />
              Luogo
              {(filters.hasPlace ? 1 : 0) + (filters.place ? 1 : 0) > 0 && (
                <span className="count">
                  {(filters.hasPlace ? 1 : 0) + (filters.place ? 1 : 0)}
                </span>
              )}
              <Icon
                name="chevron-right"
                size={14}
                className={
                  'ml-auto shrink-0 transition-transform ' +
                  (placesOpen ? 'rotate-90' : '')
                }
              />
            </button>
            {placesOpen && (
              <>
                {placesError && (
                  <p className="text-xs text-delete-dark">{placesError}</p>
                )}
                <div className="wf-chips">
                  <ChipButton
                    icon="map-pin"
                    active={filters.hasPlace}
                    onClick={() => set({ hasPlace: !filters.hasPlace })}
                  >
                    Note con luoghi
                  </ChipButton>
                </div>
                {places.length > 0 && (
                  <div className="wf-chips mt-2">
                    {places.map((p) => (
                      <ChipButton
                        key={p.id}
                        icon="map-pin"
                        active={filters.place === p.name}
                        onClick={() => togglePlace(p.name)}
                      >
                        {p.name}
                      </ChipButton>
                    ))}
                  </div>
                )}
              </>
            )}
          </div>

          {peopleError && (
            <div className="wf-sub">
              <p className="wf-title">
                <Icon name="user" size={15} />
                Persone
              </p>
              <p className="text-xs text-delete-dark">{peopleError}</p>
            </div>
          )}

          {people.length > 0 && (
            <div className="wf-sub">
              <button
                type="button"
                onClick={() => setPeopleOpen((v) => !v)}
                className="wf-title w-full"
              >
                <Icon name="user" size={15} />
                Persone
                {filters.personIds.length > 0 && (
                  <span className="count">{filters.personIds.length}</span>
                )}
                <Icon
                  name="chevron-right"
                  size={14}
                  className={
                    'ml-auto shrink-0 transition-transform ' +
                    (peopleOpen ? 'rotate-90' : '')
                  }
                />
              </button>
              {peopleOpen && (
                <>
                  <div className="mt-3 flex flex-wrap gap-1.5">
                    {(showAllPeople
                      ? people
                      : topByUsage(people, peopleUsage, filters.personIds, 10)
                    ).map((p) => {
                      const active = filters.personIds.includes(p.id)
                      return (
                        <button
                          key={p.id}
                          type="button"
                          onClick={() => togglePerson(p.id)}
                          className={'wf-chip' + (active ? ' active' : '')}
                        >
                          <PersonAvatar
                            person={p}
                            immichUrl={immichUrl}
                            immichApiKey={immichApiKey}
                            size={20}
                          />
                          {p.name}
                        </button>
                      )
                    })}
                  </div>
                  {people.length > 10 && (
                    <button
                      type="button"
                      onClick={() => setShowAllPeople((v) => !v)}
                      className="wf-more"
                    >
                      {showAllPeople
                        ? 'Mostra solo le più frequenti'
                        : `Mostra tutte (${people.length})`}
                    </button>
                  )}
                </>
              )}
            </div>
          )}

          {tagsError && (
            <div className="wf-sub">
              <p className="wf-title">
                <Icon name="tag" size={15} />
                Tag
              </p>
              <p className="text-xs text-delete-dark">{tagsError}</p>
            </div>
          )}

          {tags.length > 0 && (
            <div className="wf-sub">
              <button
                type="button"
                onClick={() => setTagsOpen((v) => !v)}
                className="wf-title w-full"
              >
                <Icon name="tag" size={15} />
                Tag
                {filters.tagIds.length > 0 && (
                  <span className="count">{filters.tagIds.length}</span>
                )}
                <Icon
                  name="chevron-right"
                  size={14}
                  className={
                    'ml-auto shrink-0 transition-transform ' +
                    (tagsOpen ? 'rotate-90' : '')
                  }
                />
              </button>
              {tagsOpen && (
                <div className="wf-chips">
                  {tags.map((t) => (
                    <ChipButton
                      key={t.id}
                      square
                      icon="tag"
                      active={filters.tagIds.includes(t.id)}
                      onClick={() => toggleTag(t.id)}
                    >
                      {t.name}
                    </ChipButton>
                  ))}
                </div>
              )}
            </div>
          )}

          {songsError && (
            <div className="wf-sub">
              <p className="wf-title">
                <Icon name="music" size={15} />
                Canzoni
              </p>
              <p className="text-xs text-delete-dark">{songsError}</p>
            </div>
          )}

          <div className="wf-sub">
            <button
              type="button"
              onClick={() => setSongsOpen((v) => !v)}
              className="wf-title w-full"
            >
              <Icon name="music" size={15} />
              Canzoni
              {(filters.hasSongs ? 1 : 0) + (filters.song ? 1 : 0) > 0 && (
                <span className="count">
                  {(filters.hasSongs ? 1 : 0) + (filters.song ? 1 : 0)}
                </span>
              )}
              <Icon
                name="chevron-right"
                size={14}
                className={
                  'ml-auto shrink-0 transition-transform ' +
                  (songsOpen ? 'rotate-90' : '')
                }
              />
            </button>
            {songsOpen && (
              <>
                <div className="wf-chips">
                  <ChipButton
                    icon="music"
                    active={filters.hasSongs}
                    onClick={() => set({ hasSongs: !filters.hasSongs })}
                  >
                    Note con canzoni
                  </ChipButton>
                </div>
                {songs.length > 0 && (
                  <div className="wf-chips mt-2">
                    {songs.map((s) => (
                      <ChipButton
                        key={s.title}
                        icon="cassette"
                        active={filters.song === s.title}
                        onClick={() => toggleSong(s.title)}
                      >
                        {s.title}
                      </ChipButton>
                    ))}
                  </div>
                )}
              </>
            )}
          </div>

          <div className="wf-sub">
            <button
              type="button"
              onClick={() => setSortOpen((v) => !v)}
              className="wf-title w-full"
            >
              <Icon name="chart" size={15} />
              Ordina per
              <Icon
                name="chevron-right"
                size={14}
                className={
                  'ml-auto shrink-0 transition-transform ' +
                  (sortOpen ? 'rotate-90' : '')
                }
              />
            </button>
            {sortOpen && (
              <div className="wf-chips-col">
                {SORTS.map((s) => (
                  <ChipButton
                    key={s.key}
                    active={filters.sort === s.key}
                    onClick={() => set({ sort: s.key })}
                  >
                    {s.label}
                  </ChipButton>
                ))}
              </div>
            )}
          </div>

          <div className="wf-sub">
            <p className="wf-title">
              <Icon name="list" size={15} />
              Numero massimo di risultati
            </p>
            <input
              type="number"
              min={1}
              inputMode="numeric"
              aria-label="Numero massimo di risultati"
              value={filters.limit}
              onChange={(e) => set({ limit: e.target.value })}
              placeholder="Tutte"
              className={inputCls}
            />
          </div>

          <button type="button" onClick={applyFilters} disabled={loading} className="wf-apply">
            {loading ? 'Cerco…' : 'Applica filtri'}
          </button>
        </div>

        <div className="mt-5">
          {error && (
            <p className="mb-3 rounded-2xl bg-delete/10 px-4 py-3 text-sm text-delete-dark">
              {error}
            </p>
          )}

          {results === null && !error && (
            <p className="wf-empty">
              Imposta i filtri e premi "Applica filtri".
            </p>
          )}

          {results !== null && (
            <>
              <p className="wf-results-head">
                {kind === 'notes'
                  ? `${results.length} ${results.length === 1 ? 'nota trovata' : 'note trovate'}`
                  : `${results.length} ${results.length === 1 ? 'risultato' : 'risultati'}`}
              </p>
              <div className="wf-results">
                <ul>
                  {results.map((n, i) =>
                    n._dream ? (
                      <li key={'d' + n.id}>
                        <button type="button" onClick={() => navigate(`/dream/${n.id}`)} className="dream-result">
                          <span className="dr-t"><Icon name="moon" size={15} />{dreamTitle(n)}</span>
                          <span className="dr-d">{dayMonthLabel(dayKey(n.date))}</span>
                          {plainText(n.content) && <span className="dr-x">{plainText(n.content)}</span>}
                        </button>
                      </li>
                    ) : (
                    <li key={n.id}>
                      <button
                        type="button"
                        onClick={() => navigate(`/note/${n.id}`)}
                        style={{ '--i': i }}
                        className="anim-row wf-result"
                      >
                        <span
                          className="wf-result-badge"
                          style={{
                            backgroundColor: moodColor(n.mood),
                            color: moodTextColor(n.mood),
                          }}
                        >
                          {Math.round(Number(n.mood) * 100)}
                        </span>
                        <span className="min-w-0 flex-1">
                          <span className="wf-result-title title-2">
                            {n.title || (
                              <span className="italic text-ink-soft">
                                Senza titolo
                              </span>
                            )}
                          </span>
                          <span className="wf-result-meta block">
                            {dayMonthLabel(dayKey(n.date))} · {timeLabel(n.timeStart)}–
                            {timeLabel(n.timeEnd)}
                          </span>
                        </span>
                      </button>
                    </li>
                  )
)}
                </ul>
              </div>
            </>
          )}
        </div>
      </main>

      <MobileBottomBar>
        <Footer
          items={[
            { icon: 'settings', title: 'Opzioni', onClick: () => navigate('/profilo') },
            { icon: 'search', title: 'Filtri', active: true },
          ]}
          primaryIcon="plus"
          primaryTitle="Nuova nota (oggi)"
          onPrimary={() => navigate(`/note/new?date=${todayKey()}`)}
        />
      </MobileBottomBar>
    </PhoneShell>
  )
}
