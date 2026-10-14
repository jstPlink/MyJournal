import { useEffect, useState } from 'react'

// Feedback di attesa per le chiamate a Gemini: un timer che scorre e una
// barra di caricamento in loop, per rendere chiaro che sta lavorando (le
// risposte possono richiedere qualche secondo). Resta montato anche durante
// i riprovi automatici sul server sovraccarico (vedi src/lib/gemini.js): il
// chiamante passa `retry` = { attempt, maxAttempts, model } quando sta ritentando,
// così il timer non si azzera e l'attesa resta sempre visibile e spiegata.
export default function GeminiWait({ ai = 'Gemini', retry = null }) {
  const [seconds, setSeconds] = useState(0)

  useEffect(() => {
    setSeconds(0)
    const id = setInterval(() => setSeconds((s) => s + 1), 1000)
    return () => clearInterval(id)
  }, [])

  const who = retry?.model && /llama|mixtral|whisper/i.test(retry.model) ? 'Groq' : ai

  return (
    <div className="flex flex-col items-center gap-3 py-10">
      <div className="h-1.5 w-40 overflow-hidden rounded-full bg-panel-2">
        <div
          className="h-full w-1/3 rounded-full bg-ink"
          style={{ animation: 'gemini-loop 1.3s ease-in-out infinite' }}
        />
      </div>
      <p className="text-sm text-ink-soft">
        {`Generando con ${who}${retry?.model ? ` (${retry.model})` : ''}. Tentativo ${
          retry ? retry.attempt + 1 : 1
        }/${retry ? retry.maxAttempts : 5} · ${seconds}s`}
      </p>
    </div>
  )
}
