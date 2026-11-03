import { useCallback, useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import PhoneShell from '../components/PhoneShell'
import MobileTopBar from '../components/MobileTopBar'
import MobileBottomBar from '../components/MobileBottomBar'
import Footer from '../components/Footer'
import ViewTabs from '../components/ViewTabs'
import Skeleton from '../components/Skeleton'
import StatsBody from '../components/web/StatsBody'
import { listAllNotesLight, describeError } from '../lib/notes'
import { todayKey } from '../lib/dates'

// «Di sempre»: le statistiche su tutte le note del diario. Le note si
// leggono nella versione leggera (senza testo né immagini, vedi
// `listAllNotesLight`), perché qui servono tutte insieme.
export default function StatsView() {
  const navigate = useNavigate()
  const [notes, setNotes] = useState([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')

  const load = useCallback(async () => {
    setLoading(true)
    setError('')
    try {
      setNotes(await listAllNotesLight())
    } catch (err) {
      setError(describeError(err))
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    load()
  }, [load])

  return (
    <PhoneShell>
      <MobileTopBar>
        <h1
          className="text-center text-ink"
          style={{ fontFamily: "'MyJournal Marker', 'Caveat', cursive", fontSize: '1.7rem' }}
        >
          Statistiche
        </h1>
      </MobileTopBar>

      <main className="anim-page flex-1 overflow-y-auto no-scrollbar px-4 py-4">
        {error && (
          <p className="mb-3 rounded-2xl bg-delete/15 px-4 py-3 text-sm text-delete-dark">
            {error}
          </p>
        )}

        {loading && !notes.length ? (
          <div className="st-tiles">
            {Array.from({ length: 4 }).map((_, i) => (
              <div key={i} className="st-tile">
                <Skeleton className="h-3 w-16" />
                <Skeleton className="mt-3 h-6 w-12" />
              </div>
            ))}
          </div>
        ) : (
          <StatsBody notes={notes} loading={loading} />
        )}
      </main>

      <MobileBottomBar>
        <ViewTabs active="stats" />
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
