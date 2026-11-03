import { useCallback, useEffect, useState } from 'react'
import StatsBody from '../../components/web/StatsBody'
import { listAllNotesLight, describeError } from '../../lib/notes'

// «Di sempre»: le statistiche su tutte le note del diario. Le note si
// leggono nella versione leggera (senza testo né immagini, vedi
// `listAllNotesLight`), perché qui servono tutte insieme.
export default function WebStats() {
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
    <div>
      <div className="sticky top-0 z-10 mb-[50px] mt-[40px] w-full bg-cream">
        <span className="header-quadretti bleed-day" aria-hidden="true" />
        <header className="relative z-[1] grid grid-cols-[1fr_auto_1fr] items-center gap-4 px-4">
          <h1 className="wd-page-title justify-self-start">
            Statistiche
            <span className="hl" aria-hidden="true" />
          </h1>
          <span aria-hidden="true" />
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

      <StatsBody notes={notes} loading={loading} />
    </div>
  )
}
