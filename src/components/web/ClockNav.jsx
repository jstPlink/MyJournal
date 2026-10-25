import { useEffect, useLayoutEffect, useRef } from 'react'

function ArrowIcon({ dir }) {
  return (
    <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round">
      {dir === 'left' ? <polyline points="15 18 9 12 15 6" /> : <polyline points="9 18 15 12 9 6" />}
    </svg>
  )
}

// Menu a tendina di anno/mese: stessa estetica LCD dell'orologio che lo
// apre (schermo grigio, cifre col font digitale), non più il solito
// elenco bianco generico — coerente con TimePickerPopover, che usa la
// stessa identica ricetta per l'orario nella vista nota.
export function ClockDropdownList({ items, wide }) {
  const listRef = useRef(null)
  const popRef = useRef(null)

  useLayoutEffect(() => {
    // Resta ancorato sotto il proprio pulsante (centrato), ma se così
    // uscirebbe dai bordi del "foglio" app (.app-paper: il limite reale
    // ritagliato da overflow-hidden, non necessariamente tutta la
    // finestra) si sposta quel tanto che basta per restare visibile.
    // Ricalcola a ogni cambio di dimensioni del box (non solo al mount):
    // il font digitale carica in modo asincrono e può cambiare la
    // larghezza del testo dopo il primo render, quando il calcolo fatto
    // una sola volta userebbe ancora le misure del font di riserva.
    const el = popRef.current
    if (!el) return
    const reposition = () => {
      el.style.transform = 'translateX(-50%)'
      const bounds = el.closest('.app-paper')?.getBoundingClientRect()
      const boundLeft = bounds ? bounds.left : 0
      const boundRight = bounds ? bounds.right : window.innerWidth
      const rect = el.getBoundingClientRect()
      const margin = 10
      let shift = 0
      if (rect.left < boundLeft + margin) shift = boundLeft + margin - rect.left
      else if (rect.right > boundRight - margin) shift = boundRight - margin - rect.right
      el.style.transform = shift ? `translateX(calc(-50% + ${shift}px))` : 'translateX(-50%)'
    }
    reposition()
    const ro = new ResizeObserver(reposition)
    ro.observe(el)
    window.addEventListener('resize', reposition)
    // Rete di sicurezza esplicita per il caso più comune di cambio
    // larghezza dopo il mount: il font DSEG14 non ancora pronto al primo
    // render (il ResizeObserver dovrebbe già coprirlo, ma non si affida
    // solo a quello).
    let cancelled = false
    document.fonts?.ready?.then(() => {
      if (!cancelled) reposition()
    })
    return () => {
      cancelled = true
      ro.disconnect()
      window.removeEventListener('resize', reposition)
    }
  }, [])

  useEffect(() => {
    listRef.current?.querySelector('.active')?.scrollIntoView({ block: 'center' })
  }, [])

  return (
    <div className={'mn-pop web' + (wide ? ' wide' : '')} ref={popRef}>
      <div className="mn-list" ref={listRef}>
        {items.map(({ key, label, active, onClick }) => (
          <button
            key={key}
            type="button"
            onClick={onClick}
            className={'mn-item' + (active ? ' active' : '')}
          >
            {label}
          </button>
        ))}
      </div>
    </div>
  )
}

// Orologio LCD (stessa estetica del pannello Data/Orario della vista
// nota): le frecce prima/dopo sono pulsanti tondi a parte, la targhetta
// centrale apre — al tocco — un menu a tendina per saltare direttamente a
// un valore non adiacente (anno o mese qualsiasi), più comodo dello
// scorrere un passo alla volta con le frecce.
export function ClockNav({ label, ariaLabel, prevLabel, nextLabel, onPrev, onNext, open, onToggle, dropdown }) {
  return (
    <div className="relative">
      <div className="flex items-center gap-2">
        <button type="button" aria-label={prevLabel} onClick={onPrev} className="ne-clock-arrow">
          <ArrowIcon dir="left" />
        </button>
        <button
          type="button"
          aria-label={ariaLabel}
          aria-expanded={open}
          onClick={onToggle}
          className="ne-clock-face inline"
        >
          <span className="ne-clock-screen">
            <span className="ne-clock-digits">{label}</span>
          </span>
        </button>
        <button type="button" aria-label={nextLabel} onClick={onNext} className="ne-clock-arrow">
          <ArrowIcon dir="right" />
        </button>
      </div>
      {open && dropdown}
    </div>
  )
}
