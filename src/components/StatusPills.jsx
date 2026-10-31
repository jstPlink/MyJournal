import { useEffect } from 'react'
import PendingSync from './PendingSync'
import SideTab from './SideTab'
import DraftsTab from './DraftsTab'
import DreamDraftsTab from './DreamDraftsTab'
import RecapQueueTab from './RecapQueueTab'
import { useAuth } from '../context/AuthContext'
import { useConnection } from '../hooks/useConnection'
import { prefetchAll } from '../lib/prefetch'
import { refreshNotesIfStale } from '../lib/notes'

function hhmm(ms) {
  const d = new Date(ms)
  return `${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}`
}

// Linguette fisse al centro del bordo destro (una sotto l'altra): connessione debole/assente e
// modifiche in coda offline. Qui parte anche il precaricamento della cache
// (note, persone, tag, luoghi, miniature) all'apertura e a ogni ritorno
// della rete — vedi src/lib/prefetch.js.
export default function StatusPills() {
  const { isAuthed } = useAuth()
  const conn = useConnection()

  useEffect(() => {
    if (!isAuthed) return
    // il grosso scaricamento parte dopo la prima schermata, per non rubarle banda
    const first = setTimeout(prefetchAll, 2500)
    const onOnline = () => prefetchAll()
    // ritorno in primo piano: riscarica le note se l'archivio ha più di 2 minuti
    const onVisible = () => document.visibilityState === 'visible' && refreshNotesIfStale()
    window.addEventListener('online', onOnline)
    document.addEventListener('visibilitychange', onVisible)
    return () => {
      clearTimeout(first)
      window.removeEventListener('online', onOnline)
      document.removeEventListener('visibilitychange', onVisible)
    }
  }, [isAuthed])

  const offline = conn.status === 'offline'

  return (
    <div className="pointer-events-none fixed right-0 top-1/2 z-50 flex -translate-y-1/2 flex-col items-end gap-2">
      <PendingSync />
      <RecapQueueTab />
      <DreamDraftsTab />
      <DraftsTab />
      {isAuthed && conn.status !== 'ok' && (
        <SideTab icon="cloud" actionLabel="Riprova ad aggiornare" onAction={prefetchAll}>
          {offline ? 'Offline' : 'Connessione debole'} · i dati potrebbero non essere aggiornati
          {conn.lastSync ? ` (ultimo aggiornamento ${hhmm(conn.lastSync)})` : ''}
        </SideTab>
      )}
    </div>
  )
}
