import { useState } from 'react'
import {
  DEFAULT_SERVER_URL,
  checkServer,
  isNative,
  normalizeServerUrl,
  setBackend,
} from '../lib/backend'

// Prima schermata dell'app: dove vivono i dati del diario.
//  - "Su questo dispositivo": tutto resta nel telefono (app) o nel browser;
//  - "Il mio server": l'indirizzo della propria istanza di MyJournal.
// Nessun indirizzo è scritto nel codice. La scelta si cambia da Impostazioni
// (Archivio) o dalla schermata di accesso.
// "https://miosito.it" → { scheme: 'https', rest: 'miosito.it' }: l'utente scrive
// solo la seconda parte, http/https si sceglie con l'interruttore.
function splitScheme(value) {
  const m = String(value || '').trim().match(/^(https?):\/\/(.*)$/i)
  if (m) return { scheme: m[1].toLowerCase(), rest: m[2] }
  return { scheme: 'https', rest: String(value || '').trim() }
}

export default function BackendChooser() {
  const native = isNative()
  const [choice, setChoice] = useState(null) // null | 'server'
  const initial = splitScheme(DEFAULT_SERVER_URL)
  const [scheme, setScheme] = useState(initial.scheme)
  const [url, setUrl] = useState(initial.rest)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')

  function useLocal() {
    setBackend({ mode: 'local' })
    window.location.reload()
  }

  async function useServer(e) {
    e.preventDefault()
    const typed = splitScheme(url)
    const chosen = /^https?:\/\//i.test(url.trim()) ? typed.scheme : scheme
    const clean = normalizeServerUrl(typed.rest ? `${chosen}://${typed.rest}` : '')
    if (!clean) {
      setError('Scrivi un indirizzo valido, per esempio myjournal.tuodominio.it')
      return
    }
    setBusy(true)
    setError('')
    const res = await checkServer(clean)
    if (!res.ok) {
      setError(res.message)
      setBusy(false)
      return
    }
    setBackend({ mode: 'server', url: clean })
    window.location.reload()
  }

  const where = native ? 'questo telefono' : 'questo browser'

  return (
    <div className="app-paper flex min-h-dvh items-center justify-center bg-cream p-4 text-ink">
      <div className="wl-card" style={{ position: 'relative', width: '100%', maxWidth: 440 }}>
        <span className="wl-tape h red top-a" aria-hidden="true" />
        <span className="wl-tape v blue right-a" aria-hidden="true" />
        <span className="wl-card-pin" aria-hidden="true" />

        <div className="wl-logo">
          <img src="/favicon.svg" alt="" />
          <span className="wl-logo-name">MyJournal</span>
        </div>

        <div className="wl-title-wrap">
          <span className="hl" aria-hidden="true" />
          <h1 className="wl-title">Dove tieni il tuo diario?</h1>
        </div>
        <p className="wl-desc">Puoi cambiare idea più avanti da Impostazioni → Archivio.</p>

        {choice !== 'server' ? (
          <div className="mt-4 flex flex-col gap-3">
            <button type="button" onClick={useLocal} className="bc-option bc-primary">
              <strong>Su {where}</strong>
              <small>
                Nessun account e nessun server: le note restano qui. Se cancelli i dati
                {native ? " dell'app" : ' del browser'} o disinstalli, le perdi: usa ogni tanto
                Esporta.
              </small>
            </button>
            <button type="button" onClick={() => setChoice('server')} className="bc-option">
              <strong>Sul mio server</strong>
              <small>
                Accedi con un account su un'istanza di MyJournal (per esempio quella sul tuo NAS):
                i dati sono accessibili da più dispositivi.
              </small>
            </button>
          </div>
        ) : (
          <form onSubmit={useServer} className="mt-4">
            <div className="wl-field">
              <label className="wl-label" htmlFor="bcUrl">
                Indirizzo del server
              </label>
              <div className="bc-scheme" role="group" aria-label="Protocollo">
                {['https', 'http'].map((p) => (
                  <button
                    key={p}
                    type="button"
                    aria-pressed={scheme === p}
                    onClick={() => setScheme(p)}
                    className="bc-scheme-btn"
                  >
                    {p}://
                  </button>
                ))}
              </div>
              <input
                id="bcUrl"
                type="text"
                inputMode="url"
                autoCapitalize="none"
                autoCorrect="off"
                spellCheck={false}
                autoFocus
                value={url}
                onChange={(e) => {
                  const t = splitScheme(e.target.value)
                  if (/^https?:\/\//i.test(e.target.value.trim())) setScheme(t.scheme)
                  setUrl(t.rest)
                }}
                placeholder="myjournal.tuodominio.it"
                className="wl-input"
              />
            </div>
            {!native && (
              <button
                type="button"
                onClick={() => {
                  setScheme(window.location.protocol === 'http:' ? 'http' : 'https')
                  setUrl(window.location.host)
                }}
                className="wl-switch bc-here"
              >
                Usa questo sito ({window.location.host})
              </button>
            )}
            {error && <p className="wl-error">{error}</p>}
            <button type="submit" disabled={busy} className="bc-option bc-primary" style={{ textAlign: 'center', fontWeight: 700 }}>
              {busy ? 'Controllo…' : 'Continua'}
            </button>
            <button
              type="button"
              onClick={() => {
                setChoice(null)
                setError('')
              }}
              className="wl-switch"
            >
              Indietro
            </button>
          </form>
        )}

        <p className="ml-version" style={{ marginTop: 16 }}>
          MyJournal · v{__APP_VERSION__}
        </p>
      </div>
    </div>
  )
}
