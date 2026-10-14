import { useId, useRef } from 'react'

// Barra della NITIDEZZA di un sogno (0–1): una fila di 14 puntini che da sfocati
// (a sinistra) diventano nitidi (a destra), con un anello giallo come cursore. I
// puntini fino al cursore sono pieni, gli altri chiari. Si trascina con il dito o
// il mouse e si regola con le frecce. Sostituisce il righello di legno delle note.
const N = 14
const X0 = 14 // centro del primo puntino (viewBox 300 x 46)
const STEP = 20

export default function ClaritySlider({ value, onChange, ariaLabel = 'Nitidezza del sogno', centerLabel = false, ends = true }) {
  const id = useId().replace(/:/g, '')
  const box = useRef(null)

  function fromEvent(e) {
    const r = box.current.getBoundingClientRect()
    const x = ((e.clientX - r.left) / r.width) * 300
    const v = (x - X0) / ((N - 1) * STEP)
    onChange(Math.min(1, Math.max(0, Math.round(v * 100) / 100)))
  }

  function onKeyDown(e) {
    const d = e.key === 'ArrowRight' || e.key === 'ArrowUp' ? 0.05 : e.key === 'ArrowLeft' || e.key === 'ArrowDown' ? -0.05 : 0
    if (!d) return
    e.preventDefault()
    onChange(Math.min(1, Math.max(0, Math.round((value + d) * 100) / 100)))
  }

  const dots = Array.from({ length: N }, (_, i) => {
    const active = i / (N - 1) <= value + 0.001
    return {
      i,
      x: X0 + i * STEP,
      r: Math.max(3, 9 - i * 0.5),
      fill: active ? '#5f93bf' : '#bcd8ee',
      opacity: 0.35 + i * 0.05,
    }
  })
  const ringX = X0 + value * (N - 1) * STEP

  return (
    <div className="clarity">
      <div
        ref={box}
        className="clarity-box"
        role="slider"
        tabIndex={0}
        aria-label={ariaLabel}
        aria-valuemin={0}
        aria-valuemax={100}
        aria-valuenow={Math.round(value * 100)}
        onKeyDown={onKeyDown}
        onPointerDown={(e) => {
          e.currentTarget.setPointerCapture(e.pointerId)
          fromEvent(e)
        }}
        onPointerMove={(e) => {
          if (e.buttons) fromEvent(e)
        }}
      >
        <svg viewBox="0 0 300 46" className="clarity-svg" aria-hidden="true">
          <defs>
            <filter id={`bl${id}`} x="-60%" y="-60%" width="220%" height="220%">
              <feGaussianBlur stdDeviation="2.6" />
            </filter>
          </defs>
          <g filter={`url(#bl${id})`}>
            {dots.slice(0, 5).map((d) => (
              <circle key={d.i} cx={d.x} cy="24" r={d.r} fill={d.fill} opacity={d.opacity} />
            ))}
          </g>
          {dots.slice(5).map((d) => (
            <circle key={d.i} cx={d.x} cy="24" r={d.r} fill={d.fill} opacity={d.opacity} />
          ))}
          <rect
            x={ringX - 7}
            y="9"
            width="14"
            height="30"
            rx="7"
            fill="#fff"
            fillOpacity="0.6"
            stroke="#d8a93a"
            strokeWidth="2.2"
          />
        </svg>
      </div>
      {centerLabel ? (
        <div className="clarity-center">Nitidezza</div>
      ) : (
        ends && (
          <div className="clarity-labels">
            <span>sfocato</span>
            <span>nitido</span>
          </div>
        )
      )}
    </div>
  )
}
