import { useNavigate } from 'react-router-dom'
import { haptic } from '../lib/haptics'

const TABS = [
  { key: 'day', path: '/', label: 'Giorno' },
  { key: 'month', path: '/mese', label: 'Mese' },
  { key: 'data', path: '/dati', label: 'Anno' },
  { key: 'stats', path: '/statistiche', label: 'Stat' },
  { key: 'diary', path: '/diario', label: 'Diario' },
]

// Selettore di vista (Giorno / Mese / Anno / Stat / Diario): un'unica
// striscia di cartoncino bianco — una targhetta rettangolare in metallo
// dorato inquadra l'opzione attiva e scivola sopra quella scelta.
export default function ViewTabs({ active }) {
  const navigate = useNavigate()
  const activeIndex = Math.max(0, TABS.findIndex((t) => t.key === active))

  function go(path) {
    haptic()
    navigate(path)
  }

  return (
    <div className="mtabs">
      <div
        className="mtab-plaque"
        style={{ left: `${activeIndex * (100 / TABS.length)}%`, width: `calc(${100 / TABS.length}% - 6px)` }}
        aria-hidden="true"
      />
      {TABS.map((tab) => (
        <button
          key={tab.key}
          type="button"
          onClick={() => go(tab.path)}
          className={'mtab' + (tab.key === active ? ' active' : '')}
        >
          {tab.label}
        </button>
      ))}
    </div>
  )
}
