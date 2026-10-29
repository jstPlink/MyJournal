import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { useNav } from '../../context/NavContext'
import { useAuth } from '../../context/AuthContext'
import PeriodRecapCard from '../../components/PeriodRecapCard'
import CountUp from '../../components/CountUp'
import PersonAvatar from '../../components/PersonAvatar'
import NotesListSheet from '../../components/NotesListSheet'
import Icon from '../../components/Icon'
import { ClockNav, ClockDropdownList } from '../../components/web/ClockNav'
import { listNotesInRange, countAllNotes, describeError } from '../../lib/notes'
import { listPeople } from '../../lib/people'
import { listTags } from '../../lib/tags'
import { computeYearStats } from '../../lib/stats'
import { moodColor, moodTextColor } from '../../lib/mood'
import { MONTHS_IT, dayKey, dayMonthLabel, parseWall, timeLabel } from '../../lib/dates'
import { countDreamsInYear } from '../../lib/dreams'

function shortDM(key) {
  const p = parseWall(key)
  return p ? `${p.d} ${MONTHS_IT[p.mo - 1].slice(0, 3).toLowerCase()}` : ''
}

// variant 'tile' = i 3 scontrini in cima (numero grande, senza icona a
// parte l'etichetta); variant 'mini' = le targhette secondarie (settimana
// migliore, tag più usato...), orizzontali con icona a destra.
function StatCard({ label, value, sub, icon, onClick, variant = 'tile', dream = false }) {
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
            <Icon name={icon} size={16} />
          </span>
        )}
      </Tag>
    )
  }

  return (
    <div className={'st-tile' + (dream ? ' st-tile-dream' : '')}>
      <p className="st-tile-label">
        {icon && <Icon name={icon} size={13} />}
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

export default function WebStats() {
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
  const [openYear, setOpenYear] = useState(false)
  const navRef = useRef(null)

  useEffect(() => {
    if (!openYear) return
    const onDown = (e) => {
      if (navRef.current && !navRef.current.contains(e.target)) setOpenYear(false)
    }
    const onKey = (e) => {
      if (e.key === 'Escape') setOpenYear(false)
    }
    document.addEventListener('pointerdown', onDown)
    document.addEventListener('keydown', onKey)
    return () => {
      document.removeEventListener('pointerdown', onDown)
      document.removeEventListener('keydown', onKey)
    }
  }, [openYear])

  // anni proposti nel menu: stessa logica di Andamento
  const yearOptions = useMemo(() => {
    const base = Math.max(year, new Date().getFullYear())
    const years = []
    for (let y = base + 2; y >= base - 12; y--) years.push(y)
    return years
  }, [year])

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

  function openWorstWeekdayNotes() {
    if (!stats.worstWeekday) return
    const notes = sortByDateTime(
      yearNotes.filter((n) => {
        const p = parseWall(n.date)
        return p && new Date(p.y, p.mo - 1, p.d).getDay() === stats.worstWeekday.day
      }),
    )
    setListSheet({
      title: stats.worstWeekday.name,
      subtitle: `${stats.worstWeekday.count} ${stats.worstWeekday.count === 1 ? 'giorno' : 'giorni'} nel ${year}`,
      notes,
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
    <div>
      <div className="sticky top-0 z-10 mb-[50px] mt-[40px] w-full bg-cream">
        <span className="header-quadretti bleed-day" aria-hidden="true" />
        {/* griglia 1fr/auto/1fr: il titolo resta a sinistra, l'anno si
            centra sull'intera riga (a centro pagina) invece di seguire
            subito il titolo. */}
        <header className="relative z-[1] grid grid-cols-[1fr_auto_1fr] items-center gap-4 px-4">
          <h1 className="wd-page-title justify-self-start">
            Statistiche
            <span className="hl" aria-hidden="true" />
          </h1>
          <div ref={navRef} className="justify-self-center">
            <ClockNav
              label={year}
              ariaLabel="Scegli anno"
              prevLabel="Anno precedente"
              nextLabel="Anno successivo"
              open={openYear}
              onPrev={() => setCursor((c) => ({ ...c, year: c.year - 1 }))}
              onNext={() => setCursor((c) => ({ ...c, year: c.year + 1 }))}
              onToggle={() => setOpenYear((v) => !v)}
              dropdown={
                <ClockDropdownList
                  items={yearOptions.map((y) => ({
                    key: y,
                    label: y,
                    active: y === year,
                    onClick: () => {
                      setCursor((c) => ({ ...c, year: y }))
                      setOpenYear(false)
                    },
                  }))}
                />
              }
            />
          </div>
          <span className="justify-self-end text-sm text-ink-soft">
            {loading && 'Aggiorno…'}
          </span>
        </header>
      </div>

      {error && (
        <p className="mb-4 rounded-2xl bg-delete/15 px-4 py-3 text-sm text-delete-dark">
          {error}
        </p>
      )}

      <div className="st-tiles st-tiles-four">
        <StatCard label="Note totali" value={allTimeCount ?? '—'} icon="list" />
        <StatCard label={`Note nel ${year}`} value={stats.noteCount} icon="calendar" />
        <StatCard
          label="Mood medio"
          value={stats.avgMood != null ? Math.round(stats.avgMood * 100) : '—'}
          icon="sparkles"
        />
        <StatCard label={`Sogni nel ${year}`} value={dreamCount} icon="moon" dream />
      </div>

      <PeriodRecapCard
        period="year"
        periodKey={String(year)}
        notes={yearNotes}
        apiKey={geminiApiKey}
        tab="Recap dell'anno"
        hideTitle
        className="mt-8"
      />

      {(stats.bestWeek ||
        stats.worstWeek ||
        stats.bestMonth ||
        stats.worstMonth ||
        stats.bestWeekday ||
        stats.worstWeekday ||
        stats.topTag ||
        stats.topPlace) && (
        <section className="mt-8">
          <span className="st-label alt">
            <Icon name="layers" size={12} />
            In evidenza
          </span>
          <div className="grid items-start gap-3 lg:grid-cols-2">
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
            </div>
            <div className="st-minitiles">
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
              {stats.worstWeekday && (
                <StatCard
                  variant="mini"
                  icon="cloud"
                  label="Giorno più giù di morale"
                  value={stats.worstWeekday.name}
                  sub={`mood medio ${Math.round(stats.worstWeekday.mood * 100)} su ${stats.worstWeekday.count} ${stats.worstWeekday.count === 1 ? 'giorno' : 'giorni'}`}
                  onClick={openWorstWeekdayNotes}
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
          </div>
        </section>
      )}

      {(stats.topPeople.length > 0 || stats.noteCount > 0) && (
        <div className="mt-8 grid items-start gap-8 lg:grid-cols-2">
          {stats.topPeople.length > 0 ? (
            <section>
              <span className="st-label">
                <Icon name="user" size={12} />
                Persone più presenti
              </span>
              <ol className="st-people">
                {stats.topPeople.map((p, i) => (
                  <li key={p.id} className="st-person-row">
                    <span className="st-rank">{i + 1}</span>
                    <PersonAvatar
                      person={p.person || { name: p.name }}
                      immichUrl={immichUrl}
                      immichApiKey={immichApiKey}
                      size={28}
                    />
                    <span className="st-person-name">{p.name}</span>
                    <span className="st-person-count">
                      {p.count} {p.count === 1 ? 'nota' : 'note'}
                    </span>
                  </li>
                ))}
              </ol>
            </section>
          ) : (
            <span aria-hidden="true" />
          )}

          {stats.noteCount > 0 && (
            <section>
              <span className="st-label alt">
                <Icon name="calendar" size={12} />
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
        </div>
      )}


      <div className="mt-8 grid gap-8 lg:grid-cols-2">
        {stats.topDays.length > 0 && (
          <section>
            <span className="st-label">
              <Icon name="sparkles" size={12} />
              Giorni migliori
            </span>
            <div className="st-rows">
              <ul>
                {stats.topDays.map((d, i) => (
                  <li key={d.key}>
                    <DayRow
                      day={d}
                      style={{ '--i': i }}
                      onClick={() => navigate(`/day/${d.key}`)}
                    />
                  </li>
                ))}
              </ul>
            </div>
          </section>
        )}

        {stats.bottomDays.length > 0 && (
          <section>
            <span className="st-label alt">
              <Icon name="cloud" size={12} />
              Giorni più difficili
            </span>
            <div className="st-rows">
              <ul>
                {stats.bottomDays.map((d, i) => (
                  <li key={d.key}>
                    <DayRow
                      day={d}
                      style={{ '--i': i }}
                      onClick={() => navigate(`/day/${d.key}`)}
                    />
                  </li>
                ))}
              </ul>
            </div>
          </section>
        )}
      </div>

      <div className="mt-8 grid gap-8 lg:grid-cols-2">
        {stats.topNotes.length > 0 && (
          <section>
            <span className="st-label">
              <Icon name="heart" size={12} />
              Note migliori
            </span>
            <div className="st-rows">
              <ul>
                {stats.topNotes.map((n, i) => (
                  <li key={n.id}>
                    <NoteRow
                      note={n}
                      style={{ '--i': i }}
                      onClick={() => navigate(`/note/${n.id}`)}
                    />
                  </li>
                ))}
              </ul>
            </div>
          </section>
        )}

        {stats.bottomNotes.length > 0 && (
          <section>
            <span className="st-label alt">
              <Icon name="cloud" size={12} />
              Note peggiori
            </span>
            <div className="st-rows">
              <ul>
                {stats.bottomNotes.map((n, i) => (
                  <li key={n.id}>
                    <NoteRow
                      note={n}
                      style={{ '--i': i }}
                      onClick={() => navigate(`/note/${n.id}`)}
                    />
                  </li>
                ))}
              </ul>
            </div>
          </section>
        )}
      </div>

      {!loading && !stats.noteCount && (
        <p className="py-16 text-center text-ink-soft">Nessuna nota nel {year}.</p>
      )}

      <NotesListSheet
        open={Boolean(listSheet)}
        title={listSheet?.title}
        subtitle={listSheet?.subtitle}
        notes={listSheet?.notes || []}
        onClose={() => setListSheet(null)}
        onSelectNote={(id) => navigate(`/note/${id}`)}
      />
    </div>
  )
}
