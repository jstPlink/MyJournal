import { useEffect, useMemo, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { useAuth } from '../context/AuthContext'
import CountUp from './CountUp'
import PersonAvatar from './PersonAvatar'
import NotesListSheet from './NotesListSheet'
import Icon from './Icon'
import DateStub from './DateStub'
import { countAllNotes, displayTitle } from '../lib/notes'
import { listPeople } from '../lib/people'
import { listTags } from '../lib/tags'
import { computeYearStats } from '../lib/stats'
import { moodColor, moodTextColor } from '../lib/mood'
import { MONTHS_IT, dayKey, parseWall } from '../lib/dates'
import { countDreamsInYear, countAllDreams } from '../lib/dreams'

// "3 set" da una chiave YYYY-MM-DD (per gli intervalli compatti).
// Giorni di calendario dal 1° gennaio dell'anno della prima nota fino a oggi.
function calendarDays(notes) {
  let first = null
  for (const n of notes) {
    const y = parseWall(n.date)?.y
    if (y && (first === null || y < first)) first = y
  }
  if (first === null) return 0
  const now = new Date()
  const today = Date.UTC(now.getFullYear(), now.getMonth(), now.getDate())
  return Math.round((today - Date.UTC(first, 0, 1)) / 86400000) + 1
}

function shortDM(key, withYear = false) {
  const p = parseWall(key)
  if (!p) return ''
  return `${p.d} ${MONTHS_IT[p.mo - 1].slice(0, 3).toLowerCase()}${withYear ? ` ${p.y}` : ''}`
}

// variant 'tile' = i 3 scontrini in cima; variant 'mini' = le targhette
// secondarie (settimana migliore, tag più usato...) — stessi componenti
// portati identici dalla versione web (WebStats.jsx), le classi .st-*
// si scalano da sole per il telefono via @media in index.css.
function StatCard({ label, value, sub, icon, tone, subBig = false, onClick, variant = 'tile', dream = false }) {
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
          <span className={'st-mt-icon' + (tone ? ' tone-' + tone : '')}>
            <Icon name={icon} size={15} />
          </span>
        )}
      </Tag>
    )
  }

  return (
    <div className={'st-tile' + (dream ? ' st-tile-dream' : '')}>
      <p className="st-tile-label">
        {icon && <Icon name={icon} size={11} />}
        {label}
      </p>
      <p className="st-tile-value truncate">
        <CountUp value={value} />
        {sub && subBig && <span className="st-tile-of">su {sub}</span>}
      </p>
      {sub && !subBig && <p className="st-tile-sub truncate">{sub}</p>}
    </div>
  )
}

function DayRow({ day, onClick, style }) {
  const titles = day.titles?.length ? day.titles : [`${day.count} ${day.count === 1 ? 'nota' : 'note'}`]
  return (
    <button type="button" onClick={onClick} style={style} className="anim-row st-row tk-row">
      <DateStub dateKey={day.key} />
      <span className="tk-text">
        {titles.map((t, i) => (
          <span key={i} className="tk-line">
            {displayTitle(t)}
          </span>
        ))}
      </span>
      <span
        className="st-row-badge"
        style={{ backgroundColor: moodColor(day.mood), color: moodTextColor(day.mood) }}
      >
        {Math.round(day.mood * 100)}
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
    <button type="button" onClick={onClick} style={style} className="anim-row st-row tk-row">
      <DateStub dateKey={dayKey(note.date)} />
      <span className="tk-text">
        <span className="tk-line">
          {note.title ? displayTitle(note.title) : <span className="italic">Senza titolo</span>}
        </span>
      </span>
      <span
        className="st-row-badge"
        style={{
          backgroundColor: moodColor(note.mood),
          color: moodTextColor(note.mood),
        }}
      >
        {Math.round(Number(note.mood) * 100)}
      </span>
    </button>
  )
}


// Tutte le statistiche calcolate su `notes`: per un anno (`year`, pagina
// Anno) o su tutto il diario (`year` nullo, pagina «Di sempre»). Le note
// arrivano dal chiamante; persone, tag e sogni li carica il componente.
export default function StatsBody({ notes, year = null, loading = false }) {
  const navigate = useNavigate()
  const { user } = useAuth()
  const immichUrl = user?.immichUrl?.trim()
  const immichApiKey = user?.immichApiKey?.trim()
  const scopeLabel = year ? `nel ${year}` : 'di sempre'
  const [dreamCount, setDreamCount] = useState(0)
  const [allTimeCount, setAllTimeCount] = useState(null)
  const [people, setPeople] = useState([])
  const [tags, setTags] = useState([])
  const [listSheet, setListSheet] = useState(null) // { title, subtitle, notes } | null
  const [peopleOpen, setPeopleOpen] = useState(false)
  const [topDaysOpen, setTopDaysOpen] = useState(false)
  const [bottomDaysOpen, setBottomDaysOpen] = useState(false)
  const [topNotesOpen, setTopNotesOpen] = useState(false)
  const [bottomNotesOpen, setBottomNotesOpen] = useState(false)

  useEffect(() => {
    let cancelled = false
    Promise.all([
      listPeople(),
      listTags(),
      year ? countDreamsInYear(year) : countAllDreams(),
      year ? Promise.resolve(null) : countAllNotes(),
    ])
      .then(([ppl, tgs, dreams, total]) => {
        if (cancelled) return
        setPeople(ppl)
        setTags(tgs)
        setDreamCount(dreams)
        setAllTimeCount(total)
      })
      .catch(() => {})
    return () => {
      cancelled = true
    }
  }, [year])

  const stats = useMemo(
    () => computeYearStats(notes, { allPeople: people, allTags: tags, peopleLimit: year ? 12 : 10 }),
    [notes, people, tags, year],
  )

  // Ordina per data/orario, per la lista note nel dialog.
  function sortByDateTime(list) {
    return [...list].sort((a, b) => {
      if (a.date !== b.date) return a.date < b.date ? -1 : 1
      return (a.timeStart || '') < (b.timeStart || '') ? -1 : 1
    })
  }

  function openWorstWeekdayNotes() {
    if (!stats.worstWeekday) return
    const list = sortByDateTime(
      notes.filter((n) => {
        const p = parseWall(n.date)
        return p && new Date(p.y, p.mo - 1, p.d).getDay() === stats.worstWeekday.day
      }),
    )
    setListSheet({
      title: stats.worstWeekday.name,
      subtitle: `${stats.worstWeekday.count} ${stats.worstWeekday.count === 1 ? 'giorno' : 'giorni'} ${scopeLabel}`,
      notes: list,
    })
  }

  function openWeekdayNotes() {
    if (!stats.bestWeekday) return
    const list = sortByDateTime(
      notes.filter((n) => {
        const p = parseWall(n.date)
        return p && new Date(p.y, p.mo - 1, p.d).getDay() === stats.bestWeekday.day
      }),
    )
    setListSheet({
      title: stats.bestWeekday.name,
      subtitle: `${stats.bestWeekday.count} ${stats.bestWeekday.count === 1 ? 'giorno' : 'giorni'} ${scopeLabel}`,
      notes: list,
    })
  }

  function openMonthNotes(month, notesCount) {
    if (!notesCount) return
    const list = sortByDateTime(
      notes.filter((n) => {
        const p = parseWall(n.date)
        return p && p.mo - 1 === month
      }),
    )
    setListSheet({
      title: MONTHS_IT[month],
      subtitle: `${notesCount} ${notesCount === 1 ? 'nota' : 'note'} ${scopeLabel}`,
      notes: list,
    })
  }

  function openWeekNotes() {
    if (!stats.bestWeek) return
    const { first, last } = stats.bestWeek
    const list = sortByDateTime(
      notes.filter((n) => {
        const dk = dayKey(n.date)
        return dk >= first && dk <= last
      }),
    )
    setListSheet({
      title: 'Settimana migliore',
      subtitle: `${shortDM(first, !year)} – ${shortDM(last, !year)}`,
      notes: list,
    })
  }

  function openWorstWeekNotes() {
    if (!stats.worstWeek) return
    const { first, last } = stats.worstWeek
    const list = sortByDateTime(
      notes.filter((n) => {
        const dk = dayKey(n.date)
        return dk >= first && dk <= last
      }),
    )
    setListSheet({
      title: 'Settimana peggiore',
      subtitle: `${shortDM(first, !year)} – ${shortDM(last, !year)}`,
      notes: list,
    })
  }

  function openYearNotes(y, count) {
    if (!count) return
    setListSheet({
      title: String(y),
      subtitle: `${count} ${count === 1 ? 'nota' : 'note'}`,
      notes: sortByDateTime(notes.filter((n) => parseWall(n.date)?.y === y)),
    })
  }

  return (
    <>
      <div className="st-tiles three">
        <StatCard
          label={year ? `Note nel ${year}` : 'Note totali'}
          value={year ? stats.noteCount : (allTimeCount ?? stats.noteCount)}
          icon="list"
        />
        <StatCard
          label="Giorni scritti"
          value={stats.dayCount}
          sub={year ? undefined : calendarDays(notes).toLocaleString('it-IT')}
          subBig
          icon="calendar"
        />
        <StatCard label="Sogni segnati" value={dreamCount} icon="moon" dream />
      </div>

      {(stats.bestMonth || stats.worstMonth || stats.bestWeek || stats.worstWeek) && (
        <section className="mt-5">
          <span className="st-label alt">
            <Icon name="layers" size={11} />
            In evidenza
          </span>
          <div className="st-minitiles">
            {stats.bestMonth && (
              <StatCard variant="mini" icon="sun" label="Mese più felice" tone="pos" value={stats.bestMonth.name}
                sub={`mood ${Math.round(stats.bestMonth.mood * 100)} · ${stats.bestMonth.count} note`}
                onClick={() => openMonthNotes(stats.bestMonth.month, stats.bestMonth.count)} />
            )}
            {stats.bestWeek && (
              <StatCard variant="mini" icon="smile" label="Settimana migliore" tone="pos"
                value={`${shortDM(stats.bestWeek.first, !year)} – ${shortDM(stats.bestWeek.last, !year)}`}
                sub={`mood ${Math.round(stats.bestWeek.mood * 100)} · ${stats.bestWeek.notes} note`}
                onClick={openWeekNotes} />
            )}
            {!year && stats.bestWeekday && (
              <StatCard variant="mini" icon="trending-up" label="Giorno più su di morale" tone="pos" value={stats.bestWeekday.name}
                sub={`mood medio ${Math.round(stats.bestWeekday.mood * 100)} su ${stats.bestWeekday.count} ${stats.bestWeekday.count === 1 ? 'giorno' : 'giorni'}`}
                onClick={openWeekdayNotes} />
            )}
            {stats.worstMonth && (
              <StatCard variant="mini" icon="cloud-rain" label="Mese più triste" tone="neg" value={stats.worstMonth.name}
                sub={`mood ${Math.round(stats.worstMonth.mood * 100)} · ${stats.worstMonth.count} note`}
                onClick={() => openMonthNotes(stats.worstMonth.month, stats.worstMonth.count)} />
            )}
            {stats.worstWeek && (
              <StatCard variant="mini" icon="frown" label="Settimana peggiore" tone="neg"
                value={`${shortDM(stats.worstWeek.first, !year)} – ${shortDM(stats.worstWeek.last, !year)}`}
                sub={`mood ${Math.round(stats.worstWeek.mood * 100)} · ${stats.worstWeek.notes} note`}
                onClick={openWorstWeekNotes} />
            )}
            {!year && stats.worstWeekday && (
              <StatCard variant="mini" icon="trending-down" label="Giorno più triste" tone="neg" value={stats.worstWeekday.name}
                sub={`mood medio ${Math.round(stats.worstWeekday.mood * 100)} su ${stats.worstWeekday.count} ${stats.worstWeekday.count === 1 ? 'giorno' : 'giorni'}`}
                onClick={openWorstWeekdayNotes} />
            )}
          </div>
        </section>
      )}

      {stats.noteCount > 0 && (
        <section className="mt-5">
          <span className="st-label">
            <Icon name="calendar" size={11} />
            {year ? 'Note per mese' : 'Note per anno'}
          </span>
          <div className="st-rows st-months">
            <ul>
              {(year ? stats.notesByMonth : stats.notesByYear.slice(0, 10)).map((m, i) => (
                <li key={m.month ?? m.year}>
                  <MonthRow
                    month={m}
                    style={{ '--i': i }}
                    onClick={() =>
                      year ? openMonthNotes(m.month, m.count) : openYearNotes(m.year, m.count)
                    }
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


      {!loading && !stats.noteCount && (
        <p className="py-10 text-center text-ink-soft">
          {year ? `Nessuna nota nel ${year}.` : 'Nessuna nota.'}
        </p>
      )}

<NotesListSheet
  open={Boolean(listSheet)}
  title={listSheet?.title}
  subtitle={listSheet?.subtitle}
  notes={listSheet?.notes || []}
  onClose={() => setListSheet(null)}
  onSelectNote={(id) => navigate(`/note/${id}`)}
/>
    </>
  )
}
