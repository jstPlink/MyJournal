import { useCallback, useEffect, useMemo, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import PhoneShell from '../components/PhoneShell'
import MobileTopBar from '../components/MobileTopBar'
import MobileBottomBar from '../components/MobileBottomBar'
import Footer from '../components/Footer'
import ViewTabs from '../components/ViewTabs'
import YearPill from '../components/YearPill'
import PeriodRecapCard from '../components/PeriodRecapCard'
import CountUp from '../components/CountUp'
import Skeleton from '../components/Skeleton'
import PersonAvatar from '../components/PersonAvatar'
import NotesListSheet from '../components/NotesListSheet'
import Icon from '../components/Icon'
import { useNav } from '../context/NavContext'
import { useAuth } from '../context/AuthContext'
import { listNotesInRange, countAllNotes, describeError } from '../lib/notes'
import { listPeople } from '../lib/people'
import { listTags } from '../lib/tags'
import { computeYearStats } from '../lib/stats'
import { moodColor, moodTextColor } from '../lib/mood'
import {
  MONTHS_IT,
  dayKey,
  dayMonthLabel,
  parseWall,
  timeLabel,
  todayKey,
} from '../lib/dates'
import { countDreamsInYear } from '../lib/dreams'

// "3 set" da una chiave YYYY-MM-DD (per gli intervalli compatti).
function shortDM(key) {
  const p = parseWall(key)
  return p ? `${p.d} ${MONTHS_IT[p.mo - 1].slice(0, 3).toLowerCase()}` : ''
}

// variant 'tile' = i 3 scontrini in cima; variant 'mini' = le targhette
// secondarie (settimana migliore, tag più usato...) — stessi componenti
// portati identici dalla versione web (WebStats.jsx), le classi .st-*
// si scalano da sole per il telefono via @media in index.css.
function StatCard({ label, value, sub, icon, onClick, variant = 'tile' }) {
  if (variant === 'mini') {
    const Tag = onClick ? 'button' : 'div'
    return (
      <Tag
        type={onClick ? 'button' : undefined}
        onClick={onClick}
        className={'st-minitile' + (onClick ? '' : ' static')}
      >
        <div className="min-w-0">
          <p className="st-mt-label">{label}</p>
          <p className="st-mt-value truncate">
            <CountUp value={value} />
          </p>
          {sub && <p className="st-mt-sub truncate">{sub}</p>}
        </div>
        {icon && (
          <span className="st-mt-icon">
            <Icon name={icon} size={15} />
          </span>
        )}
      </Tag>
    )
  }

  return (
    <div className="st-tile">
      <p className="st-tile-label">
        {icon && <Icon name={icon} size={11} />}
        {label}
      </p>
      <p className="st-tile-value truncate">
        <CountUp value={value} />
      </p>
      {sub && <p className="st-tile-sub truncate">{sub}</p>}
    </div>
  )
}

function DayRow({ day, onClick, style }) {
  return (
    <button type="button" onClick={onClick} style={style} className="anim-row st-row">
      <span
        className="st-row-badge"
        style={{ backgroundColor: moodColor(day.mood), color: moodTextColor(day.mood) }}
      >
        {Math.round(day.mood * 100)}
      </span>
      <span className="min-w-0 flex-1">
        <span className="st-row-title truncate">{dayMonthLabel(day.key)}</span>
        {day.titles?.length ? (
          <span className="mt-0.5 flex flex-col gap-0.5">
            {day.titles.map((t, i) => (
              <span key={i} className="st-row-meta truncate">
                {t}
              </span>
            ))}
          </span>
        ) : (
          <span className="st-row-meta">
            {day.count} {day.count === 1 ? 'nota' : 'note'}
          </span>
        )}
      </span>
    </button>
  )
}

// Pulsante "mostra altri / mostra meno" in fondo a una lista troncata
// (persone, giorni, note) — resta nascosto quando non c'è nulla da espandere.
function ShowMore({ open, onClick, moreCount }) {
  return (
    <button type="button" onClick={onClick} className={'st-more' + (open ? ' open' : '')}>
      {open ? 'Mostra meno' : `Mostra altri ${moreCount}`}
      <Icon name="chevron-right" size={12} />
    </button>
  )
}

function MonthRow({ month, onClick, style }) {
  return (
    <button
      type="button"
      onClick={onClick}
      style={style}
      disabled={!month.count}
      className="anim-row st-row st-month-row"
    >
      <span className="st-row-title">{month.name}</span>
      <span className="st-row-meta">
        {month.count} {month.count === 1 ? 'nota' : 'note'}
      </span>
    </button>
  )
}

function NoteRow({ note, onClick, style }) {
  return (
    <button type="button" onClick={onClick} style={style} className="anim-row st-row">
      <span
        className="st-row-badge"
        style={{
          backgroundColor: moodColor(note.mood),
          color: moodTextColor(note.mood),
        }}
      >
        {Math.round(Number(note.mood) * 100)}
      </span>
      <span className="min-w-0 flex-1">
        <span className="st-row-title title-2">
          {note.title || <span className="italic text-ink-soft">Senza titolo</span>}
        </span>
        <span className="st-row-meta truncate">
          {dayMonthLabel(dayKey(note.date))} · {timeLabel(note.timeStart)}–
          {timeLabel(note.timeEnd)}
        </span>
      </span>
    </button>
  )
}

export default function StatsView() {
  const navigate = useNavigate()
  const { cursor, setCursor } = useNav()
  const { user } = useAuth()
  const geminiApiKey = user?.geminiApiKey?.trim()
  const immichUrl = user?.immichUrl?.trim()
  const immichApiKey = user?.immichApiKey?.trim()
  const year = cursor.year
  const [yearNotes, setYearNotes] = useState([])
  const [dreamCount, setDreamCount] = useState(0)
  const [allTimeCount, setAllTimeCount] = useState(null)
  const [people, setPeople] = useState([])
  const [tags, setTags] = useState([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [listSheet, setListSheet] = useState(null) // { title, subtitle, notes } | null
  const [peopleOpen, setPeopleOpen] = useState(false)
  const [topDaysOpen, setTopDaysOpen] = useState(false)
  const [bottomDaysOpen, setBottomDaysOpen] = useState(false)
  const [topNotesOpen, setTopNotesOpen] = useState(false)
  const [bottomNotesOpen, setBottomNotesOpen] = useState(false)

  const load = useCallback(async () => {
    setLoading(true)
    setError('')
    try {
      const [notes, total, ppl, tgs, dreams] = await Promise.all([
        listNotesInRange({
          start: `${year}-01-01 00:00:00.000Z`,
          end: `${year}-12-31 23:59:59.999Z`,
        }),
        countAllNotes(),
        listPeople(),
        listTags(),
        countDreamsInYear(year),
      ])
      setYearNotes(notes)
      setDreamCount(dreams)
      setAllTimeCount(total)
      setPeople(ppl)
      setTags(tgs)
    } catch (err) {
      setError(describeError(err))
    } finally {
      setLoading(false)
    }
  }, [year])

  useEffect(() => {
    load()
  }, [load])

  const stats = useMemo(
    () => computeYearStats(yearNotes, { allPeople: people, allTags: tags }),
    [yearNotes, people, tags],
  )

  // Ordina per data/orario, per la lista note nel dialog.
  function sortByDateTime(list) {
    return [...list].sort((a, b) => {
      if (a.date !== b.date) return a.date < b.date ? -1 : 1
      return (a.timeStart || '') < (b.timeStart || '') ? -1 : 1
    })
  }

  function openWeekdayNotes() {
    if (!stats.bestWeekday) return
    const notes = sortByDateTime(
      yearNotes.filter((n) => {
        const p = parseWall(n.date)
        return p && new Date(p.y, p.mo - 1, p.d).getDay() === stats.bestWeekday.day
      }),
    )
    setListSheet({
      title: stats.bestWeekday.name,
      subtitle: `${stats.bestWeekday.count} ${stats.bestWeekday.count === 1 ? 'giorno' : 'giorni'} nel ${year}`,
      notes,
    })
  }

  function openMonthNotes(month, notesCount) {
    if (!notesCount) return
    const notes = sortByDateTime(
      yearNotes.filter((n) => {
        const p = parseWall(n.date)
        return p && p.mo - 1 === month
      }),
    )
    setListSheet({
      title: MONTHS_IT[month],
      subtitle: `${notesCount} ${notesCount === 1 ? 'nota' : 'note'} nel ${year}`,
      notes,
    })
  }

  function openWeekNotes() {
    if (!stats.bestWeek) return
    const { first, last } = stats.bestWeek
    const notes = sortByDateTime(
      yearNotes.filter((n) => {
        const dk = dayKey(n.date)
        return dk >= first && dk <= last
      }),
    )
    setListSheet({
      title: 'Settimana migliore',
      subtitle: `${shortDM(first)} – ${shortDM(last)}`,
      notes,
    })
  }

  function openWorstWeekNotes() {
    if (!stats.worstWeek) return
    const { first, last } = stats.worstWeek
    const notes = sortByDateTime(
      yearNotes.filter((n) => {
        const dk = dayKey(n.date)
        return dk >= first && dk <= last
      }),
    )
    setListSheet({
      title: 'Settimana peggiore',
      subtitle: `${shortDM(first)} – ${shortDM(last)}`,
      notes,
    })
  }

  return (
    <PhoneShell>
      <MobileTopBar>
        <YearPill
          skin="clock"
          year={year}
          onChange={(y) => setCursor((c) => ({ ...c, year: y }))}
          onStep={(delta) => setCursor((c) => ({ ...c, year: c.year + delta }))}
        />
      </MobileTopBar>

      <main className="anim-page flex-1 overflow-y-auto no-scrollbar px-4 py-4">
        {error && (
          <p className="mb-3 rounded-2xl bg-delete/15 px-4 py-3 text-sm text-delete-dark">
            {error}
          </p>
        )}

        {loading && !yearNotes.length ? (
          <div className="st-tiles">
            {Array.from({ length: 3 }).map((_, i) => (
              <div key={i} className="st-tile">
                <Skeleton className="h-3 w-16" />
                <Skeleton className="mt-3 h-6 w-12" />
              </div>
            ))}
          </div>
        ) : (
          <>
            <div className="st-tiles">
              <StatCard label="Note totali" value={allTimeCount ?? '—'} icon="list" />
              <StatCard label={`Note nel ${year}`} value={stats.noteCount} icon="calendar" />
              <StatCard
                label="Mood medio"
                value={stats.avgMood != null ? Math.round(stats.avgMood * 100) : '—'}
                icon="sparkles"
              />
            </div>

            <div className="st-tiles st-tiles-dream">
              <StatCard label={`Sogni segnati nel ${year}`} value={dreamCount} icon="moon" />
            </div>

            <PeriodRecapCard
              period="year"
              periodKey={String(year)}
              notes={yearNotes}
              apiKey={geminiApiKey}
              className="mt-5"
            />

            {(stats.bestWeek ||
              stats.worstWeek ||
              stats.bestWeekday ||
              stats.bestMonth ||
              stats.worstMonth ||
              stats.topTag ||
              stats.topPlace) && (
              <section className="mt-5">
                <span className="st-label alt">
                  <Icon name="layers" size={11} />
                  In evidenza
                </span>
                <div className="st-minitiles">
                  {stats.bestWeek && (
                    <StatCard
                      variant="mini"
                      icon="calendar"
                      label="Settimana migliore"
                      value={`${shortDM(stats.bestWeek.first)} – ${shortDM(stats.bestWeek.last)}`}
                      sub={`mood ${Math.round(stats.bestWeek.mood * 100)} · ${stats.bestWeek.notes} note`}
                      onClick={openWeekNotes}
                    />
                  )}
                  {stats.worstWeek && (
                    <StatCard
                      variant="mini"
                      icon="cloud"
                      label="Settimana peggiore"
                      value={`${shortDM(stats.worstWeek.first)} – ${shortDM(stats.worstWeek.last)}`}
                      sub={`mood ${Math.round(stats.worstWeek.mood * 100)} · ${stats.worstWeek.notes} note`}
                      onClick={openWorstWeekNotes}
                    />
                  )}
                  {stats.bestMonth && (
                    <StatCard
                      variant="mini"
                      icon="sparkles"
                      label="Mese più felice"
                      value={stats.bestMonth.name}
                      sub={`mood ${Math.round(stats.bestMonth.mood * 100)} · ${stats.bestMonth.count} note`}
                      onClick={() => openMonthNotes(stats.bestMonth.month, stats.bestMonth.count)}
                    />
                  )}
                  {stats.worstMonth && (
                    <StatCard
                      variant="mini"
                      icon="cloud"
                      label="Mese più triste"
                      value={stats.worstMonth.name}
                      sub={`mood ${Math.round(stats.worstMonth.mood * 100)} · ${stats.worstMonth.count} note`}
                      onClick={() => openMonthNotes(stats.worstMonth.month, stats.worstMonth.count)}
                    />
                  )}
                  {stats.bestWeekday && (
                    <StatCard
                      variant="mini"
                      icon="sparkles"
                      label="Giorno più su di morale"
                      value={stats.bestWeekday.name}
                      sub={`mood medio ${Math.round(stats.bestWeekday.mood * 100)} su ${stats.bestWeekday.count} ${stats.bestWeekday.count === 1 ? 'giorno' : 'giorni'}`}
                      onClick={openWeekdayNotes}
                    />
                  )}
                  {stats.topTag && (
                    <StatCard
                      variant="mini"
                      icon="tag"
                      label="Tag più usato"
                      value={stats.topTag.name}
                      sub={`in ${stats.topTag.count} note`}
                    />
                  )}
                  {stats.topPlace && (
                    <StatCard
                      variant="mini"
                      icon="map-pin"
                      label="Luogo più frequente"
                      value={stats.topPlace.name}
                      sub={`in ${stats.topPlace.count} note`}
                    />
                  )}
                </div>
              </section>
            )}

            {stats.noteCount > 0 && (
              <section className="mt-5">
                <span className="st-label">
                  <Icon name="calendar" size={11} />
                  Note per mese
                </span>
                <div className="st-rows st-months">
                  <ul>
                    {stats.notesByMonth.map((m, i) => (
                      <li key={m.month}>
                        <MonthRow
                          month={m}
                          style={{ '--i': i }}
                          onClick={() => openMonthNotes(m.month, m.count)}
                        />
                      </li>
                    ))}
                  </ul>
                </div>
              </section>
            )}

            {stats.topPeople.length > 0 && (
              <section className="mt-5">
                <span className="st-label">
                  <Icon name="user" size={11} />
                  Persone più presenti
                </span>
                <ol className="st-people">
                  {(peopleOpen ? stats.topPeople : stats.topPeople.slice(0, 5)).map((p, i) => (
                    <li key={p.id} className="st-person-row">
                      <span className="st-rank">{i + 1}</span>
                      <PersonAvatar
                        person={p.person || { name: p.name }}
                        immichUrl={immichUrl}
                        immichApiKey={immichApiKey}
                        size={26}
                      />
                      <span className="st-person-name">{p.name}</span>
                      <span className="st-person-count">
                        {p.count} {p.count === 1 ? 'nota' : 'note'}
                      </span>
                    </li>
                  ))}
                  {stats.topPeople.length > 5 && (
                    <li>
                      <ShowMore
                        open={peopleOpen}
                        onClick={() => setPeopleOpen((v) => !v)}
                        moreCount={stats.topPeople.length - 5}
                      />
                    </li>
                  )}
                </ol>
              </section>
            )}

            {stats.topDays.length > 0 && (
              <section className="mt-5">
                <span className="st-label alt">
                  <Icon name="sparkles" size={11} />
                  Giorni migliori
                </span>
                <div className="st-rows">
                  <ul>
                    {(topDaysOpen ? stats.topDays : stats.topDays.slice(0, 2)).map((d, i) => (
                      <li key={d.key}>
                        <DayRow
                          day={d}
                          style={{ '--i': i }}
                          onClick={() => navigate(`/day/${d.key}`)}
                        />
                      </li>
                    ))}
                  </ul>
                  {stats.topDays.length > 2 && (
                    <ShowMore
                      open={topDaysOpen}
                      onClick={() => setTopDaysOpen((v) => !v)}
                      moreCount={stats.topDays.length - 2}
                    />
                  )}
                </div>
              </section>
            )}

            {stats.bottomDays.length > 0 && (
              <section className="mt-5">
                <span className="st-label">
                  <Icon name="cloud" size={11} />
                  Giorni più difficili
                </span>
                <div className="st-rows">
                  <ul>
                    {(bottomDaysOpen ? stats.bottomDays : stats.bottomDays.slice(0, 2)).map(
                      (d, i) => (
                        <li key={d.key}>
                          <DayRow
                            day={d}
                            style={{ '--i': i }}
                            onClick={() => navigate(`/day/${d.key}`)}
                          />
                        </li>
                      ),
                    )}
                  </ul>
                  {stats.bottomDays.length > 2 && (
                    <ShowMore
                      open={bottomDaysOpen}
                      onClick={() => setBottomDaysOpen((v) => !v)}
                      moreCount={stats.bottomDays.length - 2}
                    />
                  )}
                </div>
              </section>
            )}

            {stats.topNotes.length > 0 && (
              <section className="mt-5">
                <span className="st-label alt">
                  <Icon name="heart" size={11} />
                  Note migliori
                </span>
                <div className="st-rows">
                  <ul>
                    {(topNotesOpen ? stats.topNotes : stats.topNotes.slice(0, 2)).map((n, i) => (
                      <li key={n.id}>
                        <NoteRow
                          note={n}
                          style={{ '--i': i }}
                          onClick={() => navigate(`/note/${n.id}`)}
                        />
                      </li>
                    ))}
                  </ul>
                  {stats.topNotes.length > 2 && (
                    <ShowMore
                      open={topNotesOpen}
                      onClick={() => setTopNotesOpen((v) => !v)}
                      moreCount={stats.topNotes.length - 2}
                    />
                  )}
                </div>
              </section>
            )}

            {stats.bottomNotes.length > 0 && (
              <section className="mt-5">
                <span className="st-label">
                  <Icon name="cloud" size={11} />
                  Note peggiori
                </span>
                <div className="st-rows">
                  <ul>
                    {(bottomNotesOpen ? stats.bottomNotes : stats.bottomNotes.slice(0, 2)).map(
                      (n, i) => (
                        <li key={n.id}>
                          <NoteRow
                            note={n}
                            style={{ '--i': i }}
                            onClick={() => navigate(`/note/${n.id}`)}
                          />
                        </li>
                      ),
                    )}
                  </ul>
                  {stats.bottomNotes.length > 2 && (
                    <ShowMore
                      open={bottomNotesOpen}
                      onClick={() => setBottomNotesOpen((v) => !v)}
                      moreCount={stats.bottomNotes.length - 2}
                    />
                  )}
                </div>
              </section>
            )}


            {!stats.noteCount && (
              <p className="py-10 text-center text-ink-soft">
                Nessuna nota nel {year}.
              </p>
            )}
          </>
        )}
      </main>

      <MobileBottomBar>
        <ViewTabs active="stats" />
        <Footer
          items={[
            {
              icon: 'settings',
              title: 'Opzioni',
              onClick: () => navigate('/profilo'),
            },
            {
              icon: 'search',
              title: 'Filtri',
              onClick: () => navigate('/filtri'),
            },
          ]}
          primaryIcon="plus"
          primaryTitle="Nuova nota (oggi)"
          onPrimary={() => navigate(`/note/new?date=${todayKey()}`)}
        />
      </MobileBottomBar>

      <NotesListSheet
        open={Boolean(listSheet)}
        title={listSheet?.title}
        subtitle={listSheet?.subtitle}
        notes={listSheet?.notes || []}
        onClose={() => setListSheet(null)}
        onSelectNote={(id) => navigate(`/note/${id}`)}
      />
    </PhoneShell>
  )
}
