import { useCallback, useEffect, useMemo, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import PhoneShell from '../components/PhoneShell'
import MobileTopBar from '../components/MobileTopBar'
import MobileBottomBar from '../components/MobileBottomBar'
import Footer from '../components/Footer'
import ViewTabs from '../components/ViewTabs'
import YearPill from '../components/YearPill'
import YearMoodChart from '../components/YearMoodChart'
import Icon from '../components/Icon'
import PeriodRecapCard from '../components/PeriodRecapCard'
import StatsBody from '../components/web/StatsBody'
import { useAuth } from '../context/AuthContext'
import { useNav } from '../context/NavContext'
import { listNotesInRange, describeError } from '../lib/notes'
import { yearWeeklyMood, moodColor, moodTextColor } from '../lib/mood'
import { MONTHS_IT, dayKey, todayKey } from '../lib/dates'

// Colori delle 3 linee del grafico nella skin "Pagine" — stessi della
// vista web (WebData.jsx): grafite per il giorno, penna blu per la
// settimana, evidenziatore corallo per il mese.
const CHART_LINE_COLORS = { day: '#a9906e', week: '#5ea9d6', month: '#e0655e' }

// Un cartoncino quadrato per ogni giorno del mese, colorato col mood: tocca
// per aprire quel giorno (stessi cartoncini della vista web).
function MonthTiles({ year, month, groups, onOpenDay }) {
  return (
    <div className="wd-day-tiles md-tiles">
      {groups.map((g, i) => {
        const day = i + 1
        const label = `${day} ${MONTHS_IT[month]}`
        return (
          <button
            key={day}
            type="button"
            title={label}
            aria-label={label}
            disabled={!g.count}
            onClick={() => onOpenDay(dayKey(new Date(year, month, day)))}
            className={'wd-day-tile' + (g.mood == null ? ' empty' : '')}
            style={g.mood == null ? undefined : { '--tc': moodColor(g.mood) }}
          >
            <span>{day}</span>
          </button>
        )
      })}
    </div>
  )
}

export default function DataView() {
  const navigate = useNavigate()
  const { cursor, setCursor } = useNav()
  const { user } = useAuth()
  const geminiApiKey = user?.geminiApiKey?.trim()
  const year = cursor.year
  const [notes, setNotes] = useState([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')

  const load = useCallback(async () => {
    setLoading(true)
    setError('')
    try {
      const list = await listNotesInRange({
        start: `${year}-01-01 00:00:00.000Z`,
        end: `${year}-12-31 23:59:59.999Z`,
      })
      setNotes(list)
    } catch (err) {
      setError(describeError(err))
      setNotes([])
    } finally {
      setLoading(false)
    }
  }, [year])

  useEffect(() => {
    load()
  }, [load])

  const data = useMemo(() => yearWeeklyMood(year, notes), [year, notes])

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

      <main className="flex-1 overflow-y-auto no-scrollbar px-3 py-4">
        {error && (
          <p className="mb-3 rounded-2xl bg-delete/15 px-4 py-3 text-sm text-delete-dark">
            {error}
          </p>
        )}

        {loading && !notes.length ? (
          <p className="py-10 text-center text-ink-soft">Carico…</p>
        ) : (
          <>
            <PeriodRecapCard
              period="year"
              periodKey={String(year)}
              notes={notes}
              apiKey={geminiApiKey}
              foglietto="Recap dell'anno"
            />

            <div className="wd-card-wrap">
              <div className="wd-header">
                <Icon name="chart" size={17} />
                <h2>Andamento</h2>
              </div>
              <div className="wd-card">
                <div className="wd-legend">
                  <span className="wd-chip wd-chip-day">giorno</span>
                  <span className="wd-chip wd-chip-week">settimana</span>
                  <span className="wd-chip wd-chip-month">mese</span>
                </div>
                <div className="wd-chart-body">
                  <YearMoodChart data={data} bare lineColors={CHART_LINE_COLORS} />
                </div>
              </div>
            </div>

            <div className="wd-card-wrap alt">
              <div className="wd-header">
                <Icon name="calendar" size={17} />
                <h2>Panoramica</h2>
              </div>
              <div className="wd-card">
                <p className="wd-intro-solo">
                  Punteggio medio e andamento dei singoli giorni.
                </p>
                <ul>
                  {data.monthly.map((m) => (
                    <li key={m.month}>
                      <div className="md-month">
                        <button
                          type="button"
                          onClick={() => {
                            setCursor({ year, month: m.month })
                            navigate('/mese')
                          }}
                          className="md-month-head"
                        >
                          <span className="wd-month-tag">{MONTHS_IT[m.month]}</span>
                          <span
                            className="wd-month-score"
                            style={
                              m.mood == null
                                ? {
                                    color: 'var(--color-ink-soft)',
                                    border: '1px solid var(--color-line)',
                                  }
                                : {
                                    backgroundColor: moodColor(m.mood),
                                    color: moodTextColor(m.mood),
                                  }
                            }
                          >
                            {m.mood == null ? '—' : Math.round(m.mood * 100)}
                          </span>
                        </button>
                        <MonthTiles
                          year={year}
                          month={m.month}
                          groups={m.groups}
                          onOpenDay={(key) => navigate(`/day/${key}`)}
                        />
                      </div>
                    </li>
                  ))}
                </ul>
              </div>
            </div>

            <div className="wd-card-wrap alt">
              <div className="wd-header">
                <Icon name="bar-chart" size={17} />
                <h2>Statistiche</h2>
              </div>
              <div className="wd-card">
                <StatsBody notes={notes} year={year} loading={loading} />
              </div>
            </div>
          </>
        )}
      </main>

      <MobileBottomBar>
        <ViewTabs active="data" />
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
    </PhoneShell>
  )
}
