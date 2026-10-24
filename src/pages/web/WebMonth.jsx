import { useCallback, useEffect, useLayoutEffect, useMemo, useRef, useState } from 'react'
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
import { MONTHS_IT, addMonths, calendarGrid } from '../../lib/dates'

function ArrowIcon({ dir }) {
  return (
    <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round">
      {dir === 'left' ? <polyline points="15 18 9 12 15 6" /> : <polyline points="9 18 15 12 9 6" />}
    </svg>
  )
}

// Menu a tendina di anno/mese: stessa estetica LCD dell'orologio che lo
// apre (schermo grigio, cifre col font digitale), non più il solito
// elenco bianco generico — coerente con TimePickerPopover, che usa la
// stessa identica ricetta per l'orario nella vista nota.
function ClockDropdownList({ items, wide }) {
  const listRef = useRef(null)
  const popRef = useRef(null)

  useLayoutEffect(() => {
    // Resta ancorato sotto il proprio pulsante (centrato), ma se così
    // uscirebbe dai bordi del "foglio" app (.app-paper: il limite reale
    // ritagliato da overflow-hidden, non necessariamente tutta la
    // finestra) si sposta quel tanto che basta per restare visibile.
    // Ricalcola a ogni cambio di dimensioni del box (non solo al mount):
    // il font digitale carica in modo asincrono e può cambiare la
    // larghezza del testo dopo il primo render, quando il calcolo fatto
    // una sola volta userebbe ancora le misure del font di riserva.
    const el = popRef.current
    if (!el) return
    const reposition = () => {
      el.style.transform = 'translateX(-50%)'
      const bounds = el.closest('.app-paper')?.getBoundingClientRect()
      const boundLeft = bounds ? bounds.left : 0
      const boundRight = bounds ? bounds.right : window.innerWidth
      const rect = el.getBoundingClientRect()
      const margin = 10
      let shift = 0
      if (rect.left < boundLeft + margin) shift = boundLeft + margin - rect.left
      else if (rect.right > boundRight - margin) shift = boundRight - margin - rect.right
      el.style.transform = shift ? `translateX(calc(-50% + ${shift}px))` : 'translateX(-50%)'
    }
    reposition()
    const ro = new ResizeObserver(reposition)
    ro.observe(el)
    window.addEventListener('resize', reposition)
    // Rete di sicurezza esplicita per il caso più comune di cambio
    // larghezza dopo il mount: il font DSEG14 non ancora pronto al primo
    // render (il ResizeObserver dovrebbe già coprirlo, ma non si affida
    // solo a quello).
    let cancelled = false
    document.fonts?.ready?.then(() => {
      if (!cancelled) reposition()
    })
    return () => {
      cancelled = true
      ro.disconnect()
      window.removeEventListener('resize', reposition)
    }
  }, [])

  useEffect(() => {
    listRef.current?.querySelector('.active')?.scrollIntoView({ block: 'center' })
  }, [])

  return (
    <div className={'mn-pop web' + (wide ? ' wide' : '')} ref={popRef}>
      <div className="mn-list" ref={listRef}>
        {items.map(({ key, label, active, onClick }) => (
          <button
            key={key}
            type="button"
            onClick={onClick}
            className={'mn-item' + (active ? ' active' : '')}
          >
            {label}
          </button>
        ))}
      </div>
    </div>
  )
}

// Orologio LCD (stessa estetica del pannello Data/Orario della vista
// nota): le frecce prima/dopo sono pulsanti tondi a parte, la targhetta
// centrale apre — al tocco — un menu a tendina per saltare direttamente a
// un valore non adiacente (anno o mese qualsiasi), più comodo dello
// scorrere un passo alla volta con le frecce.
function ClockNav({ label, ariaLabel, prevLabel, nextLabel, onPrev, onNext, open, onToggle, dropdown }) {
  return (
    <div className="relative">
      <div className="flex items-center gap-2">
        <button type="button" aria-label={prevLabel} onClick={onPrev} className="ne-clock-arrow">
          <ArrowIcon dir="left" />
        </button>
        <button
          type="button"
          aria-label={ariaLabel}
          aria-expanded={open}
          onClick={onToggle}
          className="ne-clock-face inline"
        >
          <span className="ne-clock-screen">
            <span className="ne-clock-digits">{label}</span>
          </span>
        </button>
        <button type="button" aria-label={nextLabel} onClick={onNext} className="ne-clock-arrow">
          <ArrowIcon dir="right" />
        </button>
      </div>
      {open && dropdown}
    </div>
  )
}

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
