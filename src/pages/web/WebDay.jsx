import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { useCacheRefresh } from '../../hooks/useConnection'
import { useNavigate, useParams } from 'react-router-dom'
import { useAuth } from '../../context/AuthContext'
import Icon from '../../components/Icon'
import { ClockNav, ClockDropdownList } from '../../components/web/ClockNav'
import DayPages from './DayPages'
import PeriodRecapCard from '../../components/PeriodRecapCard'
import { listNotesForDay, describeError } from '../../lib/notes'
import { listDreamsForDay } from '../../lib/dreams'
import { listPeople } from '../../lib/people'
import { listTags } from '../../lib/tags'
import { MONTHS_IT, addDaysKey, parseWall, todayKey } from '../../lib/dates'

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
  const params = useParams()
  // senza data nell'indirizzo (pagina iniziale) è oggi
  const date = params.date || todayKey()
  const navigate = useNavigate()
  const { user } = useAuth()
  const [notes, setNotes] = useState([])
  const [dreams, setDreams] = useState([])
  const [people, setPeople] = useState([])
  const [tags, setTags] = useState([])
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
    listTags()
      .then(setTags)
      .catch(() => setTags([]))
  }, [])

  const tagsById = useMemo(() => new Map(tags.map((t) => [t.id, t])), [tags])

  // selettori di giorno, mese e anno (come nelle viste mese, anno e statistiche)
  const [openMenu, setOpenMenu] = useState(null) // 'day' | 'month' | 'year' | null
  const navRef = useRef(null)
  useEffect(() => {
    if (!openMenu) return
    const onDown = (e) => {
      if (navRef.current && !navRef.current.contains(e.target)) setOpenMenu(null)
    }
    const onKey = (e) => {
      if (e.key === 'Escape') setOpenMenu(null)
    }
    document.addEventListener('pointerdown', onDown)
    document.addEventListener('keydown', onKey)
    return () => {
      document.removeEventListener('pointerdown', onDown)
      document.removeEventListener('keydown', onKey)
    }
  }, [openMenu])

  const cur = parseWall(date)
  const pad2 = (n) => String(n).padStart(2, '0')
  // stessa data in un altro mese/anno: il giorno si adegua alla lunghezza del mese
  const goTo = useCallback(
    (y, mo0, d) => {
      const last = new Date(y, mo0 + 1, 0).getDate()
      navigate(`/day/${y}-${pad2(mo0 + 1)}-${pad2(Math.min(d, last))}`)
    },
    [navigate],
  )
  const daysInMonth = cur ? new Date(cur.y, cur.mo, 0).getDate() : 31
  const yearOptions = useMemo(() => {
    const now = new Date().getFullYear()
    const base = Math.max(cur?.y ?? now, now)
    const years = []
    for (let y = base + 2; y >= base - 12; y--) years.push(y)
    return years
  }, [cur?.y])

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
          <h1 className="wd-page-title justify-self-start whitespace-nowrap">
            Giorno
            <span className="hl" aria-hidden="true" />
          </h1>
          <div ref={navRef} className="flex flex-wrap items-center gap-3 justify-self-center">
            {cur && (
              <>
                <ClockNav
                  label={cur.d}
                  ariaLabel="Scegli giorno"
                  prevLabel="Giorno precedente"
                  nextLabel="Giorno successivo"
                  open={openMenu === 'day'}
                  onPrev={() => go(-1)}
                  onNext={() => go(1)}
                  onToggle={() => setOpenMenu((m) => (m === 'day' ? null : 'day'))}
                  dropdown={
                    <ClockDropdownList
                      items={Array.from({ length: daysInMonth }, (_, i) => i + 1).map((d) => ({
                        key: d,
                        label: d,
                        active: d === cur.d,
                        onClick: () => {
                          goTo(cur.y, cur.mo - 1, d)
                          setOpenMenu(null)
                        },
                      }))}
                    />
                  }
                />
                <ClockNav
                  label={MONTHS_IT[cur.mo - 1]}
                  ariaLabel="Scegli mese"
                  prevLabel="Mese precedente"
                  nextLabel="Mese successivo"
                  open={openMenu === 'month'}
                  onPrev={() => goTo(cur.mo === 1 ? cur.y - 1 : cur.y, (cur.mo + 10) % 12, cur.d)}
                  onNext={() => goTo(cur.mo === 12 ? cur.y + 1 : cur.y, cur.mo % 12, cur.d)}
                  onToggle={() => setOpenMenu((m) => (m === 'month' ? null : 'month'))}
                  dropdown={
                    <ClockDropdownList
                      wide
                      items={MONTHS_IT.map((m, i) => ({
                        key: m,
                        label: m,
                        active: i === cur.mo - 1,
                        onClick: () => {
                          goTo(cur.y, i, cur.d)
                          setOpenMenu(null)
                        },
                      }))}
                    />
                  }
                />
                <ClockNav
                  label={cur.y}
                  ariaLabel="Scegli anno"
                  prevLabel="Anno precedente"
                  nextLabel="Anno successivo"
                  open={openMenu === 'year'}
                  onPrev={() => goTo(cur.y - 1, cur.mo - 1, cur.d)}
                  onNext={() => goTo(cur.y + 1, cur.mo - 1, cur.d)}
                  onToggle={() => setOpenMenu((m) => (m === 'year' ? null : 'year'))}
                  dropdown={
                    <ClockDropdownList
                      items={yearOptions.map((y) => ({
                        key: y,
                        label: y,
                        active: y === cur.y,
                        onClick: () => {
                          goTo(y, cur.mo - 1, cur.d)
                          setOpenMenu(null)
                        },
                      }))}
                    />
                  }
                />
              </>
            )}
          </div>
          <span aria-hidden="true" />
        </header>
      </div>

      {error && (
        <p className="mx-auto mb-3 w-3/5 shrink-0 rounded-2xl bg-delete/15 px-4 py-3 text-sm text-delete-dark">
          {error}
        </p>
      )}

      <div className="wd-card-wrap dg-recap-block mx-auto w-[78%] shrink-0">
        <div className="wd-header">
          <Icon name="sparkles" size={19} />
          <h2>Recap del giorno</h2>
        </div>
        <div className="dg-recap dg-recap-page">
          <PeriodRecapCard
            period="day"
            periodKey={date}
            notes={notes.filter((n) => !n.carriedFromPrevious)}
            apiKey={user?.geminiApiKey?.trim()}
            hideTitle
            alwaysShow
          />
        </div>
      </div>

      {/* Il foglio NON si scorre, sta tutto nella pagina (fit) — altezza
          fissa qui, DayPages misura lo spazio disponibile. Larghezza piena,
          non più w-3/5: stessa larghezza della vista mese, che non ha alcun
          tetto sulla propria griglia (solo l'header lo ha). */}
      <div className="min-h-0 flex-1 overflow-hidden pt-8">
        {loading ? (
          <p className="p-6 text-center text-ink-soft">Carico…</p>
        ) : (
          <DayPages
            date={date}
            notes={notes}
            onNavigate={navigate}
            peopleById={peopleById}
            tagsById={tagsById}
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
