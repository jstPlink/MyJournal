import { useEffect, useState } from 'react'
import { songsUsageList, describeError } from '../lib/notes'

// Elenco delle canzoni usate nelle note, con quante note ciascuna collega.
// A differenza di persone/luoghi/tag non è un'entità curata (arriva da
// Spotify nota per nota, senza un id proprio): sola lettura, niente
// rinomina/rimozione/riassegnazione.
//
// I titoli più lunghi di MAX_TITLE caratteri si tagliano con «…» (il titolo intero resta
// nel suggerimento al tocco prolungato / al passaggio del mouse).
const MAX_TITLE = 32
const cut = (t) => (t.length > MAX_TITLE ? `${t.slice(0, MAX_TITLE).trimEnd()}…` : t)

export default function SongsUsageList() {
  const [songs, setSongs] = useState(null)
  const [error, setError] = useState('')

  useEffect(() => {
    songsUsageList()
      .then(setSongs)
      .catch((err) => setError(describeError(err)))
  }, [])

  if (error) {
    return <p className="text-xs text-delete-dark">{error}</p>
  }
  if (!songs) {
    return <p className="text-xs text-ink-soft">Carico…</p>
  }
  if (!songs.length) {
    return <p className="text-xs text-ink-soft">Nessuna canzone nelle note, ancora.</p>
  }
  return (
    <ul className="divide-y divide-line-soft overflow-hidden rounded-2xl border border-line">
      {songs.map((s) => (
        <li key={s.title} className="flex items-center gap-3 bg-cream px-3 py-2">
          <span
            className="h-9 w-9 shrink-0 rounded-full bg-panel-2 bg-cover bg-center"
            style={
              s.thumbnailUrl ? { backgroundImage: `url(${s.thumbnailUrl})` } : undefined
            }
            aria-hidden="true"
          />
          <span className="min-w-0 flex-1 truncate text-sm font-medium text-ink" title={s.title}>
            {cut(s.title)}
          </span>
          <span className="shrink-0 rounded-full border border-line bg-tag px-2 py-0.5 text-xs font-bold tabular-nums text-ink-soft">
            {s.count} {s.count === 1 ? 'nota' : 'note'}
          </span>
        </li>
      ))}
    </ul>
  )
}
