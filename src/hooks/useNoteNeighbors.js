import { useEffect, useState } from 'react'
import { listAllNotesLight } from '../lib/notes'
import { dayKey, timeInputValue } from '../lib/dates'

// Id della nota precedente e successiva a `id`, in ordine cronologico
// (giorno + ora di inizio). Serve alle frecce della vista nota.
export function useNoteNeighbors(id, enabled = true) {
  const [neighbors, setNeighbors] = useState({ prev: null, next: null })
  useEffect(() => {
    if (!enabled || !id) return
    let alive = true
    listAllNotesLight()
      .then((all) => {
        if (!alive) return
        const keyOf = (n) => `${dayKey(n.date)} ${timeInputValue(n.timeStart) || '00:00'} ${n.id}`
        const sorted = [...all].sort((a, b) => (keyOf(a) < keyOf(b) ? -1 : 1))
        const i = sorted.findIndex((n) => n.id === id)
        setNeighbors(
          i < 0
            ? { prev: null, next: null }
            : { prev: sorted[i - 1]?.id || null, next: sorted[i + 1]?.id || null },
        )
      })
      .catch(() => {})
    return () => {
      alive = false
    }
  }, [id, enabled])
  return neighbors
}
