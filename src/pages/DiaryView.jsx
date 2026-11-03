import { useCallback, useEffect, useMemo, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import PhoneShell from '../components/PhoneShell'
import MobileTopBar from '../components/MobileTopBar'
import MobileBottomBar from '../components/MobileBottomBar'
import Footer from '../components/Footer'
import ViewTabs from '../components/ViewTabs'
import YearPill from '../components/YearPill'
import { DayFlowPage } from './web/WebDiary'
import { useAuth } from '../context/AuthContext'
import { useNav } from '../context/NavContext'
import { useCacheRefresh } from '../hooks/useConnection'
import { listNotesInRange, groupByDay, describeError } from '../lib/notes'
import { listPeople } from '../lib/people'
import { listTags } from '../lib/tags'
import { MONTHS_IT, addMonths, monthRange, todayKey } from '../lib/dates'

// «Diario» (telefono): i giorni del mese come fogli a righe uno sotto l'altro,
// con note, foto, persone, tag, luogo e canzone come nel diario web.
export default function DiaryView() {
  const navigate = useNavigate()
  const { user } = useAuth()
  const { cursor, setCursor } = useNav()
  const [notes, setNotes] = useState([])
  const [people, setPeople] = useState([])
  const [tags, setTags] = useState([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')

  const load = useCallback(async ({ year, month }) => {
    setLoading(true)
    setError('')
    try {
      setNotes(await listNotesInRange(monthRange(year, month)))
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
  useCacheRefresh(() => load(cursor))

  useEffect(() => {
    listPeople().then(setPeople).catch(() => setPeople([]))
    listTags().then(setTags).catch(() => setTags([]))
  }, [])

  const days = useMemo(() => {
    const by = groupByDay(notes)
    return [...by.keys()]
      .sort()
      .map((dKey) => ({ dKey, notes: by.get(dKey).filter((n) => !n.carriedFromPrevious) }))
      .filter((d) => d.notes.length)
  }, [notes])

  const ctx = useMemo(
    () => ({
      peopleById: new Map(people.map((p) => [p.id, p])),
      tagsById: new Map(tags.map((t) => [t.id, t])),
      immichUrl: user?.immichUrl?.trim(),
      immichApiKey: user?.immichApiKey?.trim(),
      geminiApiKey: user?.geminiApiKey?.trim(),
      onOpen: navigate,
    }),
    [people, tags, user, navigate],
  )

  return (
    <PhoneShell>
      <MobileTopBar>
        <YearPill
          skin="clock"
          year={cursor.year}
          subtitle={MONTHS_IT[cursor.month]}
          month={cursor.month}
          layout="row"
          onChange={(year) => setCursor((c) => ({ ...c, year }))}
          onMonthChange={(month) => setCursor((c) => ({ ...c, month }))}
          onYearStep={(delta) => setCursor((c) => ({ ...c, year: c.year + delta }))}
          onMonthStep={(delta) => setCursor((c) => addMonths(c, delta))}
        />
      </MobileTopBar>

      <main className="anim-page md-diary flex-1 overflow-y-auto no-scrollbar py-4">
        {error && (
          <p className="mx-3 mb-3 rounded-2xl bg-delete/15 px-4 py-3 text-sm text-delete-dark">{error}</p>
        )}
        {loading && !notes.length ? (
          <p className="py-10 text-center text-ink-soft">Carico…</p>
        ) : days.length === 0 ? (
          <p className="py-10 text-center text-ink-soft">Nessuna nota in questo mese.</p>
        ) : (
          days.map((d) => <DayFlowPage key={d.dKey} dKey={d.dKey} notes={d.notes} ctx={ctx} />)
        )}
      </main>

      <MobileBottomBar>
        <ViewTabs active="diary" />
        <Footer
          items={[
            { icon: 'settings', title: 'Opzioni', onClick: () => navigate('/profilo') },
            { icon: 'search', title: 'Filtri', onClick: () => navigate('/filtri') },
          ]}
          primaryIcon="plus"
          primaryTitle="Nuova nota (oggi)"
          onPrimary={() => navigate(`/note/new?date=${todayKey()}`)}
        />
      </MobileBottomBar>
    </PhoneShell>
  )
}
