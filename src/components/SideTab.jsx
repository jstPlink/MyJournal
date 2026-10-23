import { useEffect, useState } from 'react'
import Icon from './Icon'
import { playSound } from '../lib/sounds'

// Linguetta di stato attaccata al bordo destro dello schermo, a metà altezza
// (StatusPills.jsx): chiusa è solo un'icona con un eventuale numero, così non
// copre orari né altro; al tocco si allarga verso sinistra mostrando il testo
// per intero e, se c'è, il pulsante dell'azione. Tocca di nuovo per chiuderla.
export default function SideTab({ icon = 'cloud', badge = null, children, body = null, tone = 'warn', actionLabel, onAction, busy }) {
  const [open, setOpen] = useState(false)
  // La caduta d'ingresso (anim-drop) vale solo al montaggio: se restasse
  // sull'elemento ripartirebbe quando cambio animazione per lo scatto al tocco.
  const [dropped, setDropped] = useState(false)
  const [kick, setKick] = useState(false)
  useEffect(() => {
    const t = setTimeout(() => setDropped(true), 700)
    return () => clearTimeout(t)
  }, [])

  function toggle() {
    playSound(open ? 'tabClose' : 'tabOpen')
    setKick(false)
    // riparte l'animazione anche con tocchi ravvicinati
    requestAnimationFrame(() => setKick(true))
    setOpen((o) => !o)
  }

  return (
    <div
      className={
        (dropped ? '' : 'anim-drop ') + (kick ? 'side-tab-kick ' : '') + 'side-tab pointer-events-auto flex max-w-[min(17rem,calc(100vw-0.5rem))] flex-col items-stretch overflow-hidden text-ink ' +
        (tone === 'paper' ? 'paper bg-cream ' : tone === 'dream' ? 'dream ' : 'warn bg-warn ') +
        (open ? 'w-64' : 'w-auto')
      }
    >
      <button
        type="button"
        onClick={toggle}
        aria-expanded={open}
        className="flex items-center gap-1.5 px-2.5 py-2 text-left"
      >
        <Icon name={icon} size={16} className="shrink-0" />
        {badge != null && !open && (
          <span className="text-xs font-extrabold leading-none">{badge}</span>
        )}
        {open && (
          <>
            <span className="min-w-0 flex-1 text-xs font-bold leading-snug">{children}</span>
            <Icon name="chevron-right" size={14} className="shrink-0" />
          </>
        )}
      </button>
      {open && body}
      {open && onAction && (
        <button
          type="button"
          onClick={onAction}
          disabled={busy}
          className="mx-2.5 mb-2.5 rounded-full border border-warn-dark bg-cream px-3 py-1.5 text-xs font-bold disabled:opacity-60"
        >
          {busy ? 'Un attimo…' : actionLabel}
        </button>
      )}
    </div>
  )
}
