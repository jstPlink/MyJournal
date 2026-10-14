import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { useCacheRefresh } from '../hooks/useConnection'
import { usePullToRefresh } from '../hooks/usePullToRefresh'
import { useLocation, useNavigate } from 'react-router-dom'
import { useNav } from '../context/NavContext'
import { useAuth } from '../context/AuthContext'
import PhoneShell from '../components/PhoneShell'
import MobileTopBar from '../components/MobileTopBar'
import MobileBottomBar from '../components/MobileBottomBar'
import Footer from '../components/Footer'
import ViewTabs from '../components/ViewTabs'
import YearPill from '../components/YearPill'
import OnThisDay from '../components/OnThisDay'
import PeriodRecapCard from '../components/PeriodRecapCard'
import NewNoteWithGeminiSheet from '../components/NewNoteWithGeminiSheet'
import NewNoteChoiceSheet from '../components/NewNoteChoiceSheet'
import MonthPages from './web/MonthPages'
import { listNotesInRange, groupByDay, describeError } from '../lib/notes'
import { listPeople } from '../lib/people'
import { listTags } from '../lib/tags'
import { playSound } from '../lib/sounds'
import { MONTHS_IT, addMonths, monthDayKeys, monthRange, todayKey } from '../lib/dates'
import { noteInstructionsOf } from '../lib/aiInstructions'

const SWIPE_THRESHOLD = 55

export default function MonthView() {
  const navigate = useNavigate()
  const location = useLocation()
  const { cursor, setCursor } = useNav()
  const { user } = useAuth()
  const [notes, setNotes] = useState([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [dir, setDir] = useState(0) // -1 / 1: direzione ultima transizione
  const [geminiNoteOpen, setGeminiNoteOpen] = useState(false)
  const [noteChoiceOpen, setNoteChoiceOpen] = useState(false)
  const [allPeople, setAllPeople] = useState([])
  const [allTags, setAllTags] = useState([])

  // Aperta dal widget "Nuova nota": mostra subito la scelta Gemini / a mano.
  const widgetNewNote = location.state?.newNote
  useEffect(() => {
    if (!widgetNewNote) return
    setNoteChoiceOpen(true)
    navigate('/', { replace: true, state: null })
  }, [widgetNewNote, navigate])

  const loadLists = useCallback(() => {
    listPeople()
      .then(setAllPeople)
      .catch(() => {})
    listTags()
      .then(setAllTags)
      .catch(() => {})
  }, [])
  useEffect(() => {
    loadLists()
  }, [loadLists])

  const load = useCallback(async ({ year, month }, { fresh = false } = {}) => {
    setLoading(true)
    setError('')
    try {
      const list = await listNotesInRange(monthRange(year, month), { fresh })
      setNotes(list)
    } catch (err) {
      setError(describeError(err))
      setNotes([])
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    load(cursor)
  }, [cursor, load])

  const mainRef = useRef(null)
  const { pull, refreshing } = usePullToRefresh(mainRef, async () => {
    loadLists()
    await load(cursor, { fresh: true })
  })

  // dati arrivati in background dopo aver mostrato quelli salvati (rete lenta)
  useCacheRefresh(() => load(cursor))

  const go = useCallback((delta) => {
    setDir(delta)
    setCursor((c) => addMonths(c, delta))
  }, [])

  // Navigazione tra mesi via swipe orizzontale (niente frecce).
  const drag = useRef(null)
  function onPointerDown(e) {
    drag.current = { x: e.clientX, y: e.clientY }
  }
  function onPointerUp(e) {
    if (!drag.current) return
    const dx = e.clientX - drag.current.x
    const dy = e.clientY - drag.current.y
    drag.current = null
    if (Math.abs(dx) > SWIPE_THRESHOLD && Math.abs(dx) > Math.abs(dy)) {
      playSound('flip') // pagina che si sfoglia
      go(dx < 0 ? 1 : -1)
    }
  }

  useEffect(() => {
    const onKey = (e) => {
      if (e.key === 'ArrowLeft') go(-1)
      if (e.key === 'ArrowRight') go(1)
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [go])

  // Skin "Pagine", unica rimasta: i giorni sono pagine di diario impilate,
  // come sul web. Riusa il componente MonthPages; l'impaginato passa a
  // verticale grazie al blocco @media (max-width: 480px) in index.css.
  const pagesData = useMemo(
    () => ({
      grid: monthDayKeys(cursor.year, cursor.month).map((key) => ({
        key,
        inMonth: true,
      })),
      byDay: groupByDay(notes),
      peopleById: new Map(allPeople.map((p) => [p.id, p])),
    }),
    [notes, cursor.year, cursor.month, allPeople],
  )

  return (
    <PhoneShell>
      <MobileTopBar
        className="select-none"
        style={{ touchAction: 'pan-y' }}
        onPointerDown={onPointerDown}
        onPointerUp={onPointerUp}
      >
        <YearPill
          skin="clock"
          year={cursor.year}
          subtitle={MONTHS_IT[cursor.month]}
          month={cursor.month}
          layout="row"
          onChange={(year) => {
            setDir(0)
            setCursor((c) => ({ ...c, year }))
          }}
          onMonthChange={(month) => {
            setDir(0)
            setCursor((c) => ({ ...c, month }))
          }}
          onYearStep={(delta) => {
            setDir(0)
            setCursor((c) => ({ ...c, year: c.year + delta }))
          }}
          onMonthStep={go}
        />
      </MobileTopBar>

      <main
        ref={mainRef}
        key={`${cursor.year}-${cursor.month}`}
        className="flex-1 overflow-y-auto no-scrollbar"
        style={{
          touchAction: 'pan-y',
          animation: `${dir < 0 ? 'slideInLeft' : dir > 0 ? 'slideInRight' : 'fadeIn'} .18s ease-out`,
        }}
        onPointerDown={onPointerDown}
        onPointerUp={onPointerUp}
      >
        {(pull > 0 || refreshing) && (
          <div
            className="flex items-center justify-center text-xs font-semibold text-ink-soft"
            style={{ height: pull }}
          >
            {refreshing ? 'Aggiorno…' : pull >= 35 ? 'Rilascia per aggiornare' : 'Tira per aggiornare'}
          </div>
        )}

        {error && (
          <p className="m-4 rounded-2xl bg-delete/10 px-4 py-3 text-sm text-delete-dark">
            {error}
          </p>
        )}

        <OnThisDay className="mx-3 mb-1 mt-3" />

        <PeriodRecapCard
          period="month"
          periodKey={`${cursor.year}-${String(cursor.month + 1).padStart(2, '0')}`}
          notes={notes}
          label={`${MONTHS_IT[cursor.month]} ${cursor.year}`}
          apiKey={user?.geminiApiKey?.trim()}
          tab="Recap del mese"
          tabInside
          hideTitle
          className="mx-3 mb-1"
        />

        <div className="pb-2 pt-1">
          <MonthPages
            grid={pagesData.grid}
            byDay={pagesData.byDay}
            monthLabel={MONTHS_IT[cursor.month]}
            onNavigate={navigate}
            peopleById={pagesData.peopleById}
            immichUrl={user?.immichUrl?.trim()}
            immichApiKey={user?.immichApiKey?.trim()}
          />
        </div>

        {loading && !notes.length && (
          <p className="p-6 text-center text-sm text-ink-soft">Carico…</p>
        )}

        <div className="h-4" />
      </main>

      <MobileBottomBar>
        <ViewTabs active="calendar" />
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
          primaryTitle="Nuova nota"
          onPrimary={() => setNoteChoiceOpen(true)}
        />
      </MobileBottomBar>

      <NewNoteChoiceSheet
        open={noteChoiceOpen}
        onClose={() => setNoteChoiceOpen(false)}
        onGemini={() => {
          setNoteChoiceOpen(false)
          setGeminiNoteOpen(true)
        }}
        onManual={() => {
          setNoteChoiceOpen(false)
          navigate(`/note/new?date=${todayKey()}`)
        }}
      />

      <NewNoteWithGeminiSheet
        open={geminiNoteOpen}
        dateKey={todayKey()}
        onClose={() => setGeminiNoteOpen(false)}
        apiKey={user?.geminiApiKey?.trim()}
        customInstructions={noteInstructionsOf(user)}
        allPeople={allPeople}
        allTags={allTags}
        onGenerated={(draft) =>
          navigate(`/note/new?date=${todayKey()}`, {
            state: { aiDraft: draft },
          })
        }
      />
    </PhoneShell>
  )
}
