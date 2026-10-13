import { useEffect, useState } from 'react'
import { createPortal } from 'react-dom'
import { useBackClose } from '../hooks/useBack'
import Icon from './Icon'
import {
  listImmichPeople,
  fetchImmichPersonThumbnailBlob,
  describeImmichError,
} from '../lib/immich'

function ImmichPersonThumb({ baseUrl, apiKey, person }) {
  const [url, setUrl] = useState('')

  useEffect(() => {
    let alive = true
    let objUrl = ''
    fetchImmichPersonThumbnailBlob(baseUrl, apiKey, person.id)
      .then((blob) => {
        if (!alive) return
        objUrl = URL.createObjectURL(blob)
        setUrl(objUrl)
      })
      .catch(() => {})
    return () => {
      alive = false
      if (objUrl) URL.revokeObjectURL(objUrl)
    }
  }, [baseUrl, apiKey, person.id])

  return url ? (
    <img src={url} alt="" className="h-12 w-12 rounded-full object-cover" />
  ) : (
    <span className="flex h-12 w-12 items-center justify-center rounded-full bg-panel-2 text-sm font-bold text-ink-soft">
      {person.name.charAt(0).toUpperCase()}
    </span>
  )
}

// Dialog per scegliere, tra le persone nominate su Immich, quelle da
// aggiungere all'elenco locale di MyJournal (in Profilo).
export default function ImmichPeoplePicker({ open, baseUrl, apiKey, existingIds, onClose, onPick }) {
  const [people, setPeople] = useState([])
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const [adding, setAdding] = useState('')
  const [query, setQuery] = useState('')

  useEffect(() => {
    if (!open) return
    setQuery('')
    setLoading(true)
    setError('')
    listImmichPeople(baseUrl, apiKey)
      .then(setPeople)
      .catch((err) => setError(describeImmichError(err)))
      .finally(() => setLoading(false))
  }, [open, baseUrl, apiKey])

  useBackClose(open, onClose)
  if (!open) return null

  const available = people.filter(
    (p) =>
      !existingIds.has(p.id) && p.name.toLowerCase().includes(query.trim().toLowerCase()),
  )

  async function pick(person) {
    if (adding) return
    setAdding(person.id)
    try {
      await onPick(person)
    } finally {
      setAdding('')
    }
  }

  // In portal su <body>: annidato nella pagina, il fixed poteva restare
  // legato al contenitore invece che alla vera finestra (sfondo scuro che
  // non copriva tutto, pannello fuori dai bordi visibili).
  return createPortal(
    <div
      className="fixed inset-0 z-50 flex items-end justify-center bg-black/45 sm:items-center sm:p-6"
      onClick={onClose}
    >
      <div
        className="flex max-h-[85vh] w-full max-w-md flex-col overflow-hidden rounded-t-3xl bg-cream sm:rounded-3xl"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center justify-between border-b border-line px-5 py-4">
          <h3 className="text-lg font-extrabold text-ink">Aggiungi da Immich</h3>
          <button
            type="button"
            onClick={onClose}
            className="rounded-full p-1 text-ink-soft transition hover:text-ink"
            title="Chiudi"
          >
            <Icon name="x" size={20} />
          </button>
        </div>

        <div className="border-b border-line px-5 py-3">
          <input
            type="text"
            placeholder="Cerca per nome…"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            className="w-full rounded-xl border border-line bg-tag px-3 py-2 text-sm text-ink outline-none"
          />
        </div>

        <div className="flex-1 overflow-y-auto px-5 py-4">
          {loading ? (
            <p className="py-10 text-center text-ink-soft">Carico persone…</p>
          ) : error ? (
            <p className="py-10 text-center text-sm text-delete-dark">{error}</p>
          ) : !available.length ? (
            <p className="py-10 text-center text-ink-soft">
              {people.length
                ? 'Nessun risultato.'
                : 'Nessuna persona con un nome trovata su Immich.'}
            </p>
          ) : (
            <div className="space-y-1">
              {available.map((person) => (
                <button
                  key={person.id}
                  type="button"
                  disabled={Boolean(adding)}
                  onClick={() => pick(person)}
                  className="flex w-full items-center gap-3 rounded-2xl px-2 py-2 text-left transition hover:bg-tag disabled:opacity-50"
                >
                  <ImmichPersonThumb baseUrl={baseUrl} apiKey={apiKey} person={person} />
                  <span className="text-sm font-semibold text-ink">{person.name}</span>
                  {adding === person.id && (
                    <span className="ml-auto text-xs text-ink-soft">Aggiungo…</span>
                  )}
                </button>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>,
    document.body,
  )
}
