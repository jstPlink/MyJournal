import { moodColor } from '../lib/mood'

// Slider per il valore `mood` (0–1): un righello di legno (il binario,
// .mood-track, con tacche e — nella versione grande — i numeri 0–10) il cui
// colore segue il mood (--mood-color), con una placca di metallo (sempre
// uguale) che lo avvolge come cursore. Niente etichetta né valore numerico:
// a dirlo sono le tacche.
export default function MoodSlider({
  value,
  onChange,
  className = '',
  color, // colore fisso del righello (di default segue il mood)
  ariaLabel = "Valore dell'umore da 0 a 1",
}) {
  return (
    <div
      className={'flex h-[1.6rem] items-center ' + className}
      style={{ '--mood-color': color || moodColor(value) }}
    >
      <div className="mood-ruler relative min-w-0 flex-1">
        <span className="mood-track pointer-events-none absolute inset-x-0 top-1/2 -translate-y-1/2">
          <span className="mood-ticks" />
          <span className="mood-nums">
            {Array.from({ length: 11 }, (_, i) => (
              <span key={i} style={{ left: `${i * 10}%` }}>
                {i}
              </span>
            ))}
          </span>
        </span>
        <input
          type="range"
          min="0"
          max="1"
          step="0.01"
          value={value}
          onChange={(e) => onChange(Number(e.target.value))}
          aria-label={ariaLabel}
          className="mood-range relative block h-6 w-full cursor-pointer appearance-none bg-transparent"
        />
      </div>
    </div>
  )
}
