import { useState } from 'react'
import { LANGUAGES, getLanguage, setLanguage } from '../lib/aiInstructions'
import { haptic } from '../lib/haptics'

// Impostazioni → Lingua. Per ora serve a una cosa sola: l'IA scrive le note
// (nuova nota con IA, pulizia del testo, nota scritta da un prompt) nella lingua
// scelta qui. L'interfaccia dell'app resta in italiano. Preferenza per dispositivo.
export default function LanguageSettings() {
  const [code, setCode] = useState(getLanguage())

  function choose(next) {
    haptic()
    setLanguage(next)
    setCode(next)
  }

  return (
    <div className="space-y-3">
      <p className="text-xs text-ink-soft sm:text-sm">
        Quando crei una nota con l'IA, la scrive in questa lingua. Vale su questo dispositivo.
      </p>
      <div className="grid grid-cols-2 gap-2 sm:grid-cols-3">
        {LANGUAGES.map((l) => (
          <button
            key={l.code}
            type="button"
            onClick={() => choose(l.code)}
            aria-pressed={code === l.code}
            className={
              'rounded-full border px-4 py-2 text-xs font-bold transition sm:text-sm ' +
              (code === l.code
                ? 'border-save-dark bg-save text-ink'
                : 'border-line bg-tag text-ink-soft hover:text-ink')
            }
          >
            {l.label}
          </button>
        ))}
      </div>
    </div>
  )
}
