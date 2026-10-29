import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { useCacheRefresh } from '../hooks/useConnection'
import { useGoBack } from '../hooks/useBack'
import { useNavigate, useParams } from 'react-router-dom'
import { useAuth } from '../context/AuthContext'
import PhoneShell from '../components/PhoneShell'
import MobileTopBar from '../components/MobileTopBar'
import MobileBottomBar from '../components/MobileBottomBar'
import Footer from '../components/Footer'
import YearPill from '../components/YearPill'
import Icon from '../components/Icon'
import NewNoteWithGeminiSheet from '../components/NewNoteWithGeminiSheet'
import NewNoteChoiceSheet from '../components/NewNoteChoiceSheet'
import PeriodRecapCard from '../components/PeriodRecapCard'
import DayPages from './web/DayPages'
import { listNotesForDay, describeError } from '../lib/notes'
import { listDreamsForDay } from '../lib/dreams'
import { listPeople } from '../lib/people'
import { listTags } from '../lib/tags'
import { addDaysKey, dayMonthLabel, parseWall } from '../lib/dates'
import { haptic } from '../lib/haptics'
import { noteInstructionsOf } from '../lib/aiInstructions'

const SWIPE_THRESHOLD = 55 // px, swipe orizzontale per cambiare giorno

// Le note arrivate dal giorno prima partono da mezzanotte.
function startOf(n) {
  return n.carriedFromPrevious ? -1 : startMinutes(n.timeStart)
}

function startMinutes(value) {
  const p = parseWall(value)
  return p ? p.h * 60 + p.mi : 0
}

export default function DayView() {
  const { date } = useParams()
  const navigate = useNavigate()
  const goBack = useGoBack()
  const { user } = useAuth()
  const [notes, setNotes] = useState([])
  const [dreams, setDreams] = useState([])
  const [people, setPeople] = useState([])
  const [tags, setTags] = useState([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [geminiNoteOpen, setGeminiNoteOpen] = useState(false)
  const [noteChoiceOpen, setNoteChoiceOpen] = useState(false)
  const peopleById = useMemo(
    () => new Map(people.map((p) => [p.id, p])),
    [people],
  )

  const tagsById = useMemo(() => new Map(tags.map((t) => [t.id, t])), [tags])

  const parsed = parseWall(date)
  const year = parsed?.y ?? new Date().getFullYear()

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

  // Navigazione tra giorni: swipe orizzontale (mobile) o frecce ← →.
  const go = useCallback(
    (delta) => navigate(`/day/${addDaysKey(date, delta)}`),
    [navigate, date],
  )
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

  return (
    <PhoneShell>
      <MobileTopBar className="mtop-day">
        <button
          type="button"
          className="mchev"
          onClick={() => {
            haptic()
            goBack()
          }}
          title="Indietro"
          aria-label="Indietro"
        >
          <Icon name="chevron-left" size={21} strokeWidth={2.8} />
        </button>
        <div className="flex flex-1 justify-center">
          <YearPill
            skin="clock"
            year={year}
            subtitle={dayMonthLabel(date)}
            layout="row"
            onStep={go}
          />
        </div>
      </MobileTopBar>

      <PeriodRecapCard
        period="day"
        periodKey={date}
        notes={notes.filter((n) => !n.carriedFromPrevious)}
        apiKey={user?.geminiApiKey?.trim()}
        tab="Recap del giorno"
        tabInside
        hideTitle
        alwaysShow
        className="mx-2 mt-2"
      />

      <main
        key={date}
        className="day-surface anim-page relative min-h-0 flex-1 overflow-hidden bg-panel px-2 py-3"
        style={{ touchAction: 'pan-y' }}
        onPointerDown={onPointerDown}
        onPointerUp={onPointerUp}
      >
        {error && (
          <p className="mb-3 rounded-2xl bg-delete/10 px-4 py-3 text-sm text-delete-dark">
            {error}
          </p>
        )}

        {/* Le 24h si comprimono per stare tutte nello schermo (fit), come da
            web — se il contenuto di una nota non ci sta viene tagliato, è
            solo decorativo, non serve scorrere per vedere le note più tarde. */}
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
          />
        )}
      </main>

      <MobileBottomBar>
        <Footer
          primaryIcon="plus"
          primaryTitle="Nuova nota in questo giorno"
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
          navigate(`/note/new?date=${date}`)
        }}
        onDream={() => {
          setNoteChoiceOpen(false)
          navigate(`/dream/new?date=${date}`)
        }}
      />

      <NewNoteWithGeminiSheet
        open={geminiNoteOpen}
        dateKey={date}
        onClose={() => setGeminiNoteOpen(false)}
        apiKey={user?.geminiApiKey?.trim()}
        customInstructions={noteInstructionsOf(user)}
        allPeople={people}
        allTags={tags}
        onGenerated={(draft) =>
          navigate(`/note/new?date=${date}`, {
            state: { aiDraft: draft },
          })
        }
      />
    </PhoneShell>
  )
}
