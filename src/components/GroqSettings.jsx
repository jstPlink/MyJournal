import { useEffect, useState } from 'react'
import Icon from './Icon'
import SettingsSection from './SettingsSection'
import { useAuth } from '../context/AuthContext'
import { pb } from '../lib/pocketbase'
import { testGroqKey, describeGeminiError } from '../lib/gemini'
import { downloadIntegrationDoc } from '../lib/integrationDocs'

// Impostazioni → Groq: chiave per trascrivere i vocali con Whisper (veloce,
// quasi mai intasato). Usata sia dalle Impostazioni web sia da quelle mobile.
export default function GroqSettings() {
  const { user } = useAuth()
  const [key, setKey] = useState(user?.groqApiKey || '')
  const [saving, setSaving] = useState(false)
  const [testing, setTesting] = useState(false)
  const [status, setStatus] = useState(null) // { ok, message }

  useEffect(() => {
    setKey(user?.groqApiKey || '')
  }, [user])

  async function save() {
    setSaving(true)
    setStatus(null)
    try {
      await pb.collection('users').update(user.id, { groqApiKey: key.trim() })
      setStatus({ ok: true, message: 'Salvato.' })
    } catch (err) {
      setStatus({
        ok: false,
        message: /groqApiKey|validation/i.test(err?.message || '')
          ? 'Il server non ha ancora il campo per la chiave Groq: va pubblicata la nuova versione di MyJournal (migration 1758000022).'
          : err?.message || 'Salvataggio non riuscito.',
      })
    } finally {
      setSaving(false)
    }
  }

  async function test() {
    setTesting(true)
    setStatus(null)
    try {
      await testGroqKey(key.trim())
      setStatus({ ok: true, message: 'Connessione riuscita.' })
    } catch (err) {
      setStatus({ ok: false, message: describeGeminiError(err) })
    } finally {
      setTesting(false)
    }
  }

  return (
    <SettingsSection nested title="Groq (vocali)" icon="mic">
      <p className="text-xs text-ink-soft md:text-sm">
        Chiave API di Groq per trascrivere i vocali: è molto più veloce di Gemini e quasi mai
        intasata. Se Groq non risponde, i vocali passano da soli a Gemini.
      </p>
      <button
        type="button"
        onClick={() => downloadIntegrationDoc('groq')}
        className="flex items-center gap-1.5 text-xs font-semibold text-ink-soft underline underline-offset-2"
      >
        <Icon name="download" size={13} className="shrink-0" />
        Come ottenerlo (guida)
      </button>
      <label className="block">
        <span className="mb-1.5 block text-xs font-semibold text-ink-soft">API key</span>
        <input
          type="password"
          placeholder="gsk_…"
          value={key}
          onChange={(e) => setKey(e.target.value)}
          className="w-full rounded-xl border border-line bg-cream px-3 py-2.5 text-sm text-ink outline-none"
        />
      </label>
      {status && (
        <p className={'text-xs md:text-sm ' + (status.ok ? 'text-save-dark' : 'text-delete-dark')}>
          {status.message}
        </p>
      )}
      <div className="flex gap-2">
        <button
          type="button"
          onClick={test}
          disabled={testing || !key.trim()}
          className="flex-1 rounded-full border border-line bg-tag px-4 py-2 text-xs font-bold text-ink transition disabled:opacity-50"
        >
          {testing ? 'Verifico…' : 'Testa connessione'}
        </button>
        <button
          type="button"
          onClick={save}
          disabled={saving}
          className="flex-1 rounded-full border border-save-dark bg-save px-4 py-2 text-xs font-bold text-ink transition disabled:opacity-50"
        >
          {saving ? 'Salvo…' : 'Salva'}
        </button>
      </div>
    </SettingsSection>
  )
}
