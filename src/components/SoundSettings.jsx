import { useState } from 'react'
import { getSoundsOn, getVolume, playSound, setSoundsOn, setVolume } from '../lib/sounds'

// Impostazioni → Suoni: volume dei suoni dell'app (per dispositivo). L'interruttore
// per attivarli/spegnerli sta in Aspetto. Il suono della notifica dei promemoria
// segue invece il volume delle notifiche del telefono.
export default function SoundSettings() {
  const [volume, setVol] = useState(getVolume)
  const [on, setOn] = useState(getSoundsOn)

  return (
    <div className="space-y-3 text-xs sm:text-sm">
      <p className="text-ink-soft">
        Volume dei suoni (tocchi, cambio mese e anno, pagine, salvataggio ed eliminazione delle
        note, dettatura vocale). Si attivano e disattivano anche da Aspetto → Suoni.
      </p>
      <label className="flex items-center justify-between rounded-2xl border border-line bg-tag px-4 py-2.5 font-bold text-ink">
        <span>Suoni attivi</span>
        <input
          type="checkbox"
          checked={on}
          onChange={(e) => {
            setOn(e.target.checked)
            setSoundsOn(e.target.checked)
            if (e.target.checked) playSound('save')
          }}
          className="h-5 w-5 accent-[var(--color-ink)]"
          aria-label="Attiva i suoni"
        />
      </label>
      <label className="block">
        <span className="mb-1.5 flex items-center justify-between font-semibold text-ink-soft">
          <span>Volume</span>
          <span className="text-ink">{volume}%</span>
        </span>
        <input
          type="range"
          min={0}
          max={100}
          step={5}
          value={volume}
          onChange={(e) => {
            const v = Number(e.target.value)
            setVol(v)
            setVolume(v)
          }}
          onPointerUp={() => playSound('save', { force: true })}
          onKeyUp={() => playSound('save', { force: true })}
          className="w-full accent-[var(--color-ink)]"
          aria-label="Volume dei suoni"
        />
      </label>
      {!on && (
        <p className="font-semibold text-ink-soft">
          I suoni sono spenti.
        </p>
      )}
      <button
        type="button"
        onClick={() => playSound('save', { force: true })}
        className="w-full rounded-full border border-line bg-tag px-4 py-2 text-xs font-bold text-ink"
      >
        Prova il suono
      </button>
    </div>
  )
}
