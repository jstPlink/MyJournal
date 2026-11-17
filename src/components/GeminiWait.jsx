import { useEffect, useState, useSyncExternalStore } from 'react'
import { getAiStatus, subscribeAiStatus } from '../lib/gemini'
import Icon from './Icon'

// Nome leggibile del modello (es. «gemini-omni-1.1-flash» → «Gemini Omni 1.1 Flash»).
function modelLabel(model) {
  if (!model) return ''
  if (/llama|mixtral|whisper/i.test(model)) return 'Groq ' + model
  return model
    .replace(/^models\//, '')
    .split('-')
    .map((w) => (/^\d/.test(w) ? w : w.charAt(0).toUpperCase() + w.slice(1)))
    .join(' ')
}

// Feedback di attesa per le chiamate a Gemini: un timer che scorre e
// un'animazione in loop, per rendere chiaro che sta lavorando (le risposte
// possono richiedere qualche secondo). Resta montato anche durante i riprovi
// automatici sul server sovraccarico (vedi src/lib/gemini.js): il chiamante
// passa `retry` = { attempt, maxAttempts, model } e il nome del modello in uso
// compare sempre, così il timer non si azzera e l'attesa resta spiegata.
// `big` = versione a tutto spazio, centrata e col testo grande (creazione nota).
export default function GeminiWait({ ai = 'Gemini', retry = null, big = false }) {
  const [seconds, setSeconds] = useState(0)

  useEffect(() => {
    setSeconds(0)
    const id = setInterval(() => setSeconds((s) => s + 1), 1000)
    return () => clearInterval(id)
  }, [])

  const status = useSyncExternalStore(subscribeAiStatus, getAiStatus)
  const received = status.phase === 'received'

  const label = retry?.model ? modelLabel(retry.model) : ai
  const receivedLabel = status.model ? modelLabel(status.model) : ai
  const text = received ? 'Sto elaborando la nota…' : 'Sto scrivendo con ' + label
  const detail = received
    ? 'Risposta ricevuta da ' + receivedLabel + ' · ' + seconds + 's'
    : 'Tentativo ' + (retry ? retry.attempt + 1 : 1) + '/' + (retry ? retry.maxAttempts : 5) + ' · ' + seconds + 's'

  if (big) {
    return (
      <div className="gw-big" role="status" aria-live="polite">
        <div className="gw-paper" aria-hidden="true">
          <span className="gw-line" style={{ '--i': 0, '--w': '78%' }} />
          <span className="gw-line" style={{ '--i': 1, '--w': '92%' }} />
          <span className="gw-line" style={{ '--i': 2, '--w': '64%' }} />
          <span className="gw-line" style={{ '--i': 3, '--w': '85%' }} />
          <span className="gw-line" style={{ '--i': 4, '--w': '48%' }} />
          <span className="gw-spark gw-spark-a"><Icon name="sparkles" size={22} /></span>
          <span className="gw-spark gw-spark-b"><Icon name="sparkles" size={14} /></span>
        </div>
        <p className="gw-title">{text}</p>
        <p className="gw-detail">{detail}</p>
      </div>
    )
  }

  return (
    <div className="flex flex-col items-center gap-3 py-10">
      <div className="h-1.5 w-40 overflow-hidden rounded-full bg-panel-2">
        <div
          className="h-full w-1/3 rounded-full bg-ink"
          style={{ animation: 'gemini-loop 1.3s ease-in-out infinite' }}
        />
      </div>
      <p className="text-sm text-ink-soft">{received ? detail + ' · Sto elaborando la nota…' : 'Generando con ' + label + '. ' + detail}</p>
    </div>
  )
}
