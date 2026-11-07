// Mentre si scrive il nome di una persona, un tag o un luogo da aggiungere, mostra
// quelli già presenti che combaciano (anche in parte, senza distinguere maiuscole e
// accenti), così non si crea una copia. Con `onPick` i risultati sono pulsanti che
// scelgono quello esistente; senza, sono solo informativi.

export const normName = (s) =>
  String(s || '')
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .toLowerCase()
    .replace(/\s+/g, ' ')
    .trim()

// L'elemento che ha esattamente lo stesso nome (ignorando maiuscole, accenti, spazi), se c'è.
export function findExact(items, name) {
  const n = normName(name)
  return n ? items.find((i) => normName(i.name) === n) || null : null
}

export default function ExistingMatches({
  query,
  items = [],
  selectedIds = [],
  onPick,
  label = 'Già presenti',
  className = '',
}) {
  const q = normName(query)
  if (!q) return null
  const matches = items
    .filter((i) => normName(i.name).includes(q))
    .sort((a, b) => {
      const ea = normName(a.name) === q ? 0 : normName(a.name).startsWith(q) ? 1 : 2
      const eb = normName(b.name) === q ? 0 : normName(b.name).startsWith(q) ? 1 : 2
      return ea - eb || String(a.name).localeCompare(String(b.name), 'it', { sensitivity: 'base' })
    })
    .slice(0, 8)
  if (!matches.length) return null
  const exact = matches.some((m) => normName(m.name) === q)

  return (
    <div className={'text-xs ' + className}>
      <p className={'mb-1.5 font-semibold ' + (exact ? 'text-delete-dark' : 'text-ink-soft')}>
        {exact ? 'Esiste già: non crearne un’altra.' : label + ':'}
      </p>
      <div className="flex flex-wrap gap-2">
        {matches.map((m) => {
          const active = selectedIds.includes(m.id)
          const cls =
            'rounded-full border font-semibold ' +
            (onPick
              ? 'flex min-h-11 items-center px-4 py-2 text-sm active:scale-95 transition '
              : 'px-3 py-1.5 text-sm ') +
            (active ? 'border-ink bg-ink text-cream' : 'border-line bg-tag text-ink')
          return onPick ? (
            <button key={m.id} type="button" onClick={() => onPick(m)} className={cls}>
              {m.name}
            </button>
          ) : (
            <span key={m.id} className={cls}>
              {m.name}
            </span>
          )
        })}
      </div>
    </div>
  )
}
