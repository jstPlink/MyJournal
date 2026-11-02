import { parseWall, MONTHS_IT } from '../lib/dates'

// Tallone del biglietto con la data completa: anno (serif, su fascia scura)
// in cima, giorno e mese centrati nello spazio sotto. Lo usano le righe di
// statistiche e ricerca (`.tk-row`). `dateKey` è una chiave YYYY-MM-DD.
export default function DateStub({ dateKey }) {
  const p = parseWall(dateKey)
  if (!p) return null
  return (
    <span className="ds" aria-label={`${p.d} ${MONTHS_IT[p.mo - 1]} ${p.y}`}>
      <i className="ds-y">{p.y}</i>
      <span className="ds-c">
        <b className="ds-d">{p.d}</b>
        <span className="ds-m">{MONTHS_IT[p.mo - 1]}</span>
      </span>
    </span>
  )
}
