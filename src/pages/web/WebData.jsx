import { useCallback, useEffect, useMemo, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import YearMoodChart from '../../components/YearMoodChart'
import Icon from '../../components/Icon'
import { useNav } from '../../context/NavContext'
import { listNotesInRange, describeError } from '../../lib/notes'
import { yearWeeklyMood, moodColor, moodTextColor } from '../../lib/mood'
import { MONTHS_IT, dayKey } from '../../lib/dates'

// Colori delle 3 linee del grafico nella skin "Pagine": grafite per il
// giorno, penna blu per la settimana, evidenziatore corallo per il mese —
// riprendono due tinte già usate come accento altrove nell'app invece di
// inventarne di nuove.
const CHART_LINE_COLORS = { day: '#a9906e', week: '#5ea9d6', month: '#e0655e' }

// Una barretta cliccabile per ogni giorno del mese: porta dritti a quel
// giorno. Sotto, il numero di ogni giorno che esiste davvero in quel mese
// (niente 31 per i mesi da 30 giorni, niente 29/30 per febbraio...).
function MonthDayBars({ year, month, groups, onOpenDay }) {
  return (
    <div className="wd-day-bars">
      <div className="wd-day-bars-track">
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
              className="wd-day-bar"
            >
              <i
                style={
                  g.mood == null
                    ? { height: '10%', backgroundColor: 'var(--color-line)' }
                    : { height: `${Math.max(10, g.mood * 100)}%`, backgroundColor: moodColor(g.mood) }
                }
              />
            </button>
          )
        })}
      </div>
      <div className="wd-day-bars-ticks">
        {groups.map((g, i) => (
          <span key={i} style={{ left: `${((i + 0.5) / groups.length) * 100}%` }}>
            {i + 1}
          </span>
        ))}
      </div>
    </div>
  )
}

export default function WebData() {
  const navigate = useNavigate()
  const { cursor, setCursor } = useNav()
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
    <div>
      <div className="sticky top-0 z-10 mb-[50px] mt-[40px] w-full bg-cream">
        <span className="header-quadretti bleed-day" aria-hidden="true" />
        {/* griglia 1fr/auto/1fr: il titolo resta a sinistra, l'anno si
            centra sull'intera riga (a centro pagina) invece di seguire
            subito il titolo. */}
        <header className="relative z-[1] grid grid-cols-[1fr_auto_1fr] items-center gap-4 px-4">
          <h1 className="wd-page-title justify-self-start">
            Andamento
            <span className="hl" aria-hidden="true" />
          </h1>
          <div className="flex items-center gap-2 justify-self-center">
            <button
              type="button"
              aria-label="Anno precedente"
              onClick={() => setCursor((c) => ({ ...c, year: c.year - 1 }))}
              className="ne-clock-arrow"
            >
              <Icon name="chevron-left" size={18} />
            </button>
            <span className="ne-clock-face inline">
              <span className="ne-clock-screen">
                <span className="ne-clock-digits">{year}</span>
              </span>
            </span>
            <button
              type="button"
              aria-label="Anno successivo"
              onClick={() => setCursor((c) => ({ ...c, year: c.year + 1 }))}
              className="ne-clock-arrow"
            >
              <Icon name="chevron-right" size={18} />
            </button>
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

      <div className="wd-card-wrap">
        <div className="wd-header">
          <Icon name="chart" size={19} />
          <h2>Umore nell'anno</h2>
        </div>
        <div className="wd-card">
          <div className="wd-intro">
            <p>
              Media giornaliera, settimanale e mensile — tocca un mese qui
              sotto per aprirlo.
            </p>
            <div className="wd-legend">
              <span className="wd-chip wd-chip-day">giorno</span>
              <span className="wd-chip wd-chip-week">settimana</span>
              <span className="wd-chip wd-chip-month">mese</span>
            </div>
          </div>
          <div className="wd-chart-body">
            <YearMoodChart
              data={data}
              gridRows={8}
              monthFontSize={13}
              axisFontSize={13}
              fontFamily="'MyJournal Hand', 'Kalam', sans-serif"
              fontWeight={700}
              alternateMonths={false}
              showAxisValues
              bare
              lineColors={CHART_LINE_COLORS}
            />
          </div>
        </div>
      </div>

      <div className="wd-card-wrap alt">
        <div className="wd-header">
          <Icon name="calendar" size={19} />
          <h2>Mese per mese</h2>
        </div>
        <div className="wd-card">
          <p className="wd-intro-solo">
            Un biglietto per ogni mese: punteggio medio e andamento dei
            singoli giorni.
          </p>
          <ul>
            {data.monthly.map((m) => (
              <li key={m.month}>
                <div className="wd-month-row wd-day-row">
                  <button
                    type="button"
                    onClick={() => {
                      setCursor({ year, month: m.month })
                      navigate('/')
                    }}
                    title={`Apri ${MONTHS_IT[m.month]}`}
                    className="wd-month-tag-btn"
                  >
                    <span className="wd-month-tag">{MONTHS_IT[m.month]}</span>
                  </button>
                  <MonthDayBars
                    year={year}
                    month={m.month}
                    groups={m.groups}
                    onOpenDay={(key) => navigate(`/day/${key}`)}
                  />
                  <button
                    type="button"
                    onClick={() => {
                      setCursor({ year, month: m.month })
                      navigate('/')
                    }}
                    title={`Apri ${MONTHS_IT[m.month]}`}
                    className="wd-month-score-btn"
                  >
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
                </div>
              </li>
            ))}
          </ul>
        </div>
      </div>
    </div>
  )
}
