import { useEffect, useState } from 'react'

// Feedback di attesa per le chiamate a Gemini: un timer che scorre e una
// barra di caricamento in loop, per rendere chiaro che sta lavorando (le
// risposte possono richiedere qualche secondo). Resta montato anche durante
// i riprovi automatici sul server sovraccarico (vedi src/lib/gemini.js): il
// chiamante passa `retry` = { attempt, maxAttempts } quando sta ritentando,
// così il timer non si azzera e l'attesa resta sempre visibile e spiegata.
export default function GeminiWait({ label = 'Chiedo a Gemini…', retry = null }) {
  const [seconds, setSeconds] = useState(0)

  useEffect(() => {
    setSeconds(0)
    const id = setInterval(() => setSeconds((s) => s + 1), 1000)
    return () => clearInterval(id)
  }, [])

  return (
    <div className="flex flex-col items-center gap-3 py-10">
      <div className="h-1.5 w-40 overflow-hidden rounded-full bg-panel-2">
        <div
          className="h-full w-1/3 rounded-full bg-ink"
          style={{ animation: 'gemini-loop 1.3s ease-in-out infinite' }}
        />
      </div>
      <p className="text-sm text-ink-soft">
        {retry
          ? `Server occupato, tentativo ${retry.attempt + 1} di ${retry.maxAttempts}${
              retry.model ? ` con un altro modello Gemini (${retry.model})` : ''
            }… ${seconds}s`
          : `${label} (tentativo 1 di 5) ${seconds}s`}
      </p>
    </div>
  )
}
