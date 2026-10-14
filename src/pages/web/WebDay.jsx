import { useCallback, useEffect, useMemo, useState } from 'react'
import { useCacheRefresh } from '../../hooks/useConnection'
import { useGoBack } from '../../hooks/useBack'
import { useNavigate, useParams } from 'react-router-dom'
import { useAuth } from '../../context/AuthContext'
import Icon from '../../components/Icon'
import DayPages from './DayPages'
import PeriodRecapCard from '../../components/PeriodRecapCard'
import { listNotesForDay, describeError } from '../../lib/notes'
import { listDreamsForDay } from '../../lib/dreams'
import { listPeople } from '../../lib/people'
import { addDaysKey, fullDayLabel, parseWall } from '../../lib/dates'
import { haptic } from '../../lib/haptics'

// Stessa logica della vista giorno mobile (src/pages/DayView.jsx): l'intera
// giornata (24h) viene compressa per stare tutta nell'altezza disponibile
// sullo schermo, senza dover scorrere la pagina per vedere le note più
// tarde. Solo l'header è centrato a w-3/5 (come quello della vista mese) —
// il contenuto vero e proprio (skin "Pagine") è a piena larghezza, senza
// alcun tetto, esattamente come la griglia della vista mese (WebMonth), che
// non ne ha uno proprio.

// Le note arrivate dal giorno prima partono da mezzanotte.
function startOf(n) {
  return n.carriedFromPrevious ? -1 : startMinutes(n.timeStart)
}

function startMinutes(value) {
  const p = parseWall(value)
  return p ? p.h * 60 + p.mi : 0
}

export default function WebDay() {
  const { date } = useParams()
  const navigate = useNavigate()
  const goBack = useGoBack()
  const { user } = useAuth()
  const [notes, setNotes] = useState([])
  const [dreams, setDreams] = useState([])
  const [people, setPeople] = useState([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const peopleById = useMemo(
    () => new Map(people.map((p) => [p.id, p])),
    [people],
  )

  const load = useCallback(async () => {
    setLoading(true)
    setError('')
    try {
      const list = await listNotesForDay(date)
      list.sort((a, b) => startOf(a) - startOf(b))
      setNotes(list)
      setDreams(await listDreamsForDay(date))
    } catch (err) {
      setError(describeError(err))
      setNotes([])
    } finally {
      setLoading(false)
    }
  }, [date])

  useEffect(() => {
    load()
  }, [load])

  // dati arrivati in background dopo aver mostrato quelli salvati (rete lenta)
  useCacheRefresh(load)

  // Persone (per le targhette coi nomi nella skin "Pagine"). Caricato una
  // volta; se fallisce, la skin resta senza targhette.
  useEffect(() => {
    listPeople()
      .then(setPeople)
      .catch(() => setPeople([]))
  }, [])

  const go = useCallback(
    (delta) => navigate(`/day/${addDaysKey(date, delta)}`),
    [navigate, date],
  )
  useEffect(() => {
    const onKey = (e) => {
      if (e.key === 'ArrowLeft') go(-1)
      if (e.key === 'ArrowRight') go(1)
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [go])

  return (
    <div className="flex h-[calc(100dvh-4rem)] flex-col">
      <div className="relative mb-[50px] mt-[40px] w-full shrink-0">
        <span className="header-quadretti bleed-day" aria-hidden="true" />
        {/* griglia 1fr/auto/1fr: indietro resta ancorato a sinistra, ma
            l'orologio si centra sempre sull'intera riga (a centro schermo),
            non dov'è capitato dopo il pulsante indietro. La 3° colonna
            vuota è solo per bilanciare le due 1fr. */}
        <header className="relative z-[1] grid grid-cols-[1fr_auto_1fr] items-center gap-4 px-4">
          <button
            type="button"
            onClick={() => {
              haptic()
              goBack()
            }}
            className="ne-back justify-self-start"
          >
            <Icon name="chevron-left" size={16} strokeWidth={2.6} />
            Torna al mese
          </button>
          <div className="flex min-w-0 items-center justify-self-center gap-[15px]">
            <button
              type="button"
              onClick={() => go(-1)}
              aria-label="Giorno precedente"
              className="ne-clock-arrow"
            >
              <Icon name="chevron-left" size={18} />
            </button>
            {/* testo scritto a mano, non più l'orologio LCD: qui la data
                non si può modificare direttamente (solo ± un giorno con le
                frecce), a differenza degli altri orologi della vista mese
                e nota — lo stile "cliccabile" era fuorviante. */}
            <span className="day-label-hand">
              {fullDayLabel(date)}
              <span className="hl" aria-hidden="true" />
            </span>
            <button
              type="button"
              onClick={() => go(1)}
              aria-label="Giorno successivo"
              className="ne-clock-arrow"
            >
              <Icon name="chevron-right" size={18} />
            </button>
          </div>
          <span aria-hidden="true" />
        </header>
      </div>

      {error && (
        <p className="mx-auto mb-3 w-3/5 shrink-0 rounded-2xl bg-delete/15 px-4 py-3 text-sm text-delete-dark">
          {error}
        </p>
      )}

      <PeriodRecapCard
        period="day"
        periodKey={date}
        notes={notes.filter((n) => !n.carriedFromPrevious)}
        apiKey={user?.geminiApiKey?.trim()}
        tab="Recap del giorno"
        tabInside
        hideTitle
        alwaysShow
        className="mx-auto mb-3 w-[78%] shrink-0"
      />

      {/* Il foglio NON si scorre, sta tutto nella pagina (fit) — altezza
          fissa qui, DayPages misura lo spazio disponibile. Larghezza piena,
          non più w-3/5: stessa larghezza della vista mese, che non ha alcun
          tetto sulla propria griglia (solo l'header lo ha). */}
      <div className="min-h-0 flex-1 overflow-hidden">
        {loading ? (
          <p className="p-6 text-center text-ink-soft">Carico…</p>
        ) : (
          <DayPages
            date={date}
            notes={notes}
            onNavigate={navigate}
            peopleById={peopleById}
            dreams={dreams}
            immichUrl={user?.immichUrl?.trim()}
            immichApiKey={user?.immichApiKey?.trim()}
            fit
            onCreate={() => navigate(`/note/new?date=${date}`)}
          />
        )}
      </div>
    </div>
  )
}
