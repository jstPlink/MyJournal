import { useState } from 'react'
import { useAuth } from '../context/AuthContext'
import { pb } from '../lib/pocketbase'
import { describeError } from '../lib/notes'
import {
  DEFAULT_NOTE_INSTRUCTIONS,
  DEFAULT_RECAP_INSTRUCTIONS,
  noteInstructionsOf,
  recapInstructionsOf,
} from '../lib/aiInstructions'

// Impostazioni → Istruzioni per IA: testo fisso aggiunto alle richieste di
// QUALUNQUE modello che scrive (Gemini e le sue riserve, Groq). Due campi: uno per
// le note (tono, cosa evidenziare o evitare) e uno per i riassunti di giorno, mese
// e anno, anche quelli scritti dal server alle 23:00. Salvate sull'account. Se un
// campo è vuoto vale il testo iniziale, che si può sempre ripristinare.
function InstructionsField({ title, help, field, initial, fallback }) {
  const { user } = useAuth()
  const [text, setText] = useState(initial)
  const [saving, setSaving] = useState(false)
  const [status, setStatus] = useState(null)

  async function save(value) {
    setSaving(true)
    setStatus(null)
    try {
      const rec = await pb.collection('users').update(user.id, { [field]: value.trim() })
      // Se il server non ha ancora la migration il campo sparisce in silenzio.
      if (rec && rec[field] === undefined) {
        setStatus({ ok: false, message: 'Il server non ha ancora questo campo: pubblica la nuova versione.' })
      } else {
        setStatus({ ok: true, message: 'Salvato.' })
      }
    } catch (err) {
      setStatus({ ok: false, message: describeError(err) })
    } finally {
      setSaving(false)
    }
  }

  return (
    <div className="space-y-2">
      <h4 className="text-sm font-bold text-ink">{title}</h4>
      <p className="text-xs text-ink-soft sm:text-sm">{help}</p>
      <textarea
        rows={10}
        value={text}
        onChange={(e) => setText(e.target.value)}
        maxLength={4000}
        className="w-full resize-y rounded-xl border border-line bg-cream px-3 py-2.5 text-sm text-ink outline-none focus:border-ink-soft"
      />
      {status && (
        <p className={'text-xs sm:text-sm ' + (status.ok ? 'text-save-dark' : 'text-delete-dark')}>
          {status.message}
        </p>
      )}
      <div className="flex gap-2">
        <button
          type="button"
          onClick={() => {
            setText(fallback)
            save('')
          }}
          disabled={saving}
          className="flex-1 rounded-full border border-line bg-tag px-4 py-2 text-xs font-bold text-ink transition disabled:opacity-50 sm:text-sm"
        >
          Ripristina il testo iniziale
        </button>
        <button
          type="button"
          onClick={() => save(text)}
          disabled={saving}
          className="flex-1 rounded-full border border-save-dark bg-save px-4 py-2 text-xs font-bold text-ink transition hover:brightness-105 disabled:opacity-50 sm:text-sm"
        >
          {saving ? 'Salvo…' : 'Salva'}
        </button>
      </div>
    </div>
  )
}

export default function AiInstructionsSettings() {
  const { user } = useAuth()
  return (
    <div className="space-y-6">
      <p className="text-xs text-ink-soft sm:text-sm">
        Istruzioni fisse per l'IA: valgono per qualunque modello che scrive per te (Gemini e le sue
        riserve, Groq) e su tutti i dispositivi. Sono in inglese perché i modelli le seguono meglio, ma
        puoi scriverle come vuoi.
      </p>
      <InstructionsField
        title="Istruzioni per le note"
        help="Aggiunte a ogni nota scritta o ripulita dall'IA (tono, cosa evidenziare o evitare…). Vuoto = testo iniziale."
        field="geminiCustomInstructions"
        initial={noteInstructionsOf(user)}
        fallback={DEFAULT_NOTE_INSTRUCTIONS}
      />
      <InstructionsField
        title="Istruzioni per i riassunti"
        help="Aggiunte a tutti i riassunti (giorno, mese e anno), anche a quelli scritti dal server. Vuoto = testo iniziale."
        field="recapCustomInstructions"
        initial={recapInstructionsOf(user)}
        fallback={DEFAULT_RECAP_INSTRUCTIONS}
      />
    </div>
  )
}
