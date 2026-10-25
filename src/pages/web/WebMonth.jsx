import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { useCacheRefresh } from '../../hooks/useConnection'
import { useNavigate } from 'react-router-dom'
import { useNav } from '../../context/NavContext'
import { useAuth } from '../../context/AuthContext'
import { listNotesInRange, groupByDay, describeError } from '../../lib/notes'
import { dreamDaysInRange } from '../../lib/dreams'
import { listPeople } from '../../lib/people'
import OnThisDay from '../../components/OnThisDay'
import PeriodRecapCard from '../../components/PeriodRecapCard'
import MonthPages from './MonthPages'
import { ClockNav, ClockDropdownList } from '../../components/web/ClockNav'
import { MONTHS_IT, addMonths, calendarGrid } from '../../lib/dates'

export default function WebMonth() {
  const navigate = useNavigate()
  const { cursor, setCursor } = useNav()
  const { user } = useAuth()
  const immichUrl = user?.immichUrl?.trim()
  const immichApiKey = user?.immichApiKey?.trim()
  const [notes, setNotes] = useState([])
  const [dreamDays, setDreamDays] = useState(() => new Set())
  const [people, setPeople] = useState([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [openYear, setOpenYear] = useState(false)
  const [openMonth, setOpenMonth] = useState(false)
  const navRef = useRef(null)

  useEffect(() => {
    if (!openYear && !openMonth) return
    const onDown = (e) => {
      if (navRef.current && !navRef.current.contains(e.target)) {
        setOpenYear(false)
        setOpenMonth(false)
      }
    }
    const onKey = (e) => {
      if (e.key === 'Escape') {
        setOpenYear(false)
        setOpenMonth(false)
      }
    }
    document.addEventListener('pointerdown', onDown)
    document.addEventListener('keydown', onKey)
    return () => {
      document.removeEventListener('pointerdown', onDown)
      document.removeEventListener('keydown', onKey)
    }
  }, [openYear, openMonth])

  const grid = useMemo(
    () => calendarGrid(cursor.year, cursor.month),
    [cursor.year, cursor.month],
  )

  // Elenco anni proposti nel menu a tendina: dal cursore (o dall'anno
  // corrente se il cursore è nel futuro) qualche anno avanti e parecchi
  // indietro, per raggiungere in un tap anche un anno lontano/non adiacente.
  const yearOptions = useMemo(() => {
    const now = new Date().getFullYear()
    const base = Math.max(cursor.year, now)
    const years = []
    for (let y = base + 2; y >= base - 12; y--) years.push(y)
    return years
  }, [cursor.year])

  const load = useCallback(async () => {
    setLoading(true)
    setError('')
    try {
      const list = await listNotesInRange({
        start: `${grid[0].key} 00:00:00.000Z`,
        end: `${grid[41].key} 23:59:59.999Z`,
      })
      setNotes(list)
      setDreamDays(
        await dreamDaysInRange({
          start: `${grid[0].key} 00:00:00.000Z`,
          end: `${grid[41].key} 23:59:59.999Z`,
        }),
      )
    } catch (err) {
      setError(describeError(err))
      setNotes([])
    } finally {
      setLoading(false)
    }
  }, [grid])

  useEffect(() => {
    load()
  }, [load])

  // dati arrivati in background dopo aver mostrato quelli salvati (rete lenta)
  useCacheRefresh(load)

  // Elenco persone (per le etichette coi nomi nella skin "Pagine"). Caricato
  // una volta; se fallisce, la skin resta senza targhette.
  useEffect(() => {
    listPeople()
      .then(setPeople)
      .catch(() => setPeople([]))
  }, [])

  const byDay = useMemo(() => groupByDay(notes), [notes])
  const peopleById = useMemo(
    () => new Map(people.map((p) => [p.id, p])),
    [people],
  )

  return (
    <div>
      <div className="sticky top-0 z-10 mb-[50px] mt-[40px] w-full bg-cream">
        <span className="header-quadretti bleed-month" aria-hidden="true" />
        <header className="relative z-[1] mx-auto flex w-3/5 flex-wrap items-center justify-between gap-4">
        <div ref={navRef} className="flex flex-wrap items-center gap-3">
          <ClockNav
            label={cursor.year}
            ariaLabel="Scegli anno"
            prevLabel="Anno precedente"
            nextLabel="Anno successivo"
            open={openYear}
            onPrev={() => setCursor((c) => ({ ...c, year: c.year - 1 }))}
            onNext={() => setCursor((c) => ({ ...c, year: c.year + 1 }))}
            onToggle={() => {
              setOpenYear((v) => !v)
              setOpenMonth(false)
            }}
            dropdown={
              <ClockDropdownList
                items={yearOptions.map((y) => ({
                  key: y,
                  label: y,
                  active: y === cursor.year,
                  onClick: () => {
                    setCursor((c) => ({ ...c, year: y }))
                    setOpenYear(false)
                  },
                }))}
              />
            }
          />
          <ClockNav
            label={MONTHS_IT[cursor.month]}
            ariaLabel="Scegli mese"
            prevLabel="Mese precedente"
            nextLabel="Mese successivo"
            open={openMonth}
            onPrev={() => setCursor((c) => addMonths(c, -1))}
            onNext={() => setCursor((c) => addMonths(c, 1))}
            onToggle={() => {
              setOpenMonth((v) => !v)
              setOpenYear(false)
            }}
            dropdown={
              <ClockDropdownList
                wide
                items={MONTHS_IT.map((m, i) => ({
                  key: m,
                  label: m,
                  active: i === cursor.month,
                  onClick: () => {
                    setCursor((c) => ({ ...c, month: i }))
                    setOpenMonth(false)
                  },
                }))}
              />
            }
          />
        </div>
        {loading && <span className="text-sm text-ink-soft">Aggiorno…</span>}
        </header>
      </div>

      {error && (
        <p className="mb-4 rounded-2xl bg-delete/15 px-4 py-3 text-sm text-delete-dark">
          {error}
        </p>
      )}

      <OnThisDay className="mb-5 max-w-md" />

      <PeriodRecapCard
        period="month"
        periodKey={`${cursor.year}-${String(cursor.month + 1).padStart(2, '0')}`}
        notes={notes}
        label={`${MONTHS_IT[cursor.month]} ${cursor.year}`}
        apiKey={user?.geminiApiKey?.trim()}
        tab="Recap del mese"
        tabInside
        hideTitle
        className="mx-auto mb-5 w-[78%]"
      />

      <MonthPages
        grid={grid}
        byDay={byDay}
        monthLabel={MONTHS_IT[cursor.month]}
        onNavigate={navigate}
        peopleById={peopleById}
        immichUrl={immichUrl}
        immichApiKey={immichApiKey}
        dreamDays={dreamDays}
      />
    </div>
  )
}
