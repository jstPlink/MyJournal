import { useState } from 'react'
import { pb } from '../lib/pocketbase'
import { describeError } from '../lib/notes'

// «Ho dimenticato la password»: chiede l'email e fa inviare da PocketBase il link
// per sceglierne una nuova (apre /reset-password/<token>, vedi ResetPassword.jsx).
// La mail parte solo se sul server sono impostati SMTP e Application URL.
export default function ForgotPasswordForm({ idPrefix, onBack }) {
  const [email, setEmail] = useState('')
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')
  const [sent, setSent] = useState(false)

  async function onSubmit(e) {
    e.preventDefault()
    setBusy(true)
    setError('')
    try {
      await pb.collection('users').requestPasswordReset(email.trim())
      setSent(true)
    } catch (err) {
      setError(describeError(err))
    } finally {
      setBusy(false)
    }
  }

  if (sent) {
    return (
      <div>
        <p className="wl-desc" style={{ marginTop: 8 }}>
          Se l'indirizzo è registrato, tra poco ti arriva una mail con il link per scegliere
          una nuova password. Controlla anche lo spam.
        </p>
        <button type="button" onClick={onBack} className="wl-switch">
          Torna all'accesso
        </button>
      </div>
    )
  }

  return (
    <form onSubmit={onSubmit}>
      <p className="wl-desc" style={{ marginTop: 8 }}>
        Scrivi la tua email: ti mandiamo un link per scegliere una nuova password.
      </p>
      <div className="wl-field">
        <label className="wl-label" htmlFor={`${idPrefix}ForgotEmail`}>
          Email
        </label>
        <input
          id={`${idPrefix}ForgotEmail`}
          type="email"
          autoComplete="username"
          required
          autoFocus
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          className="wl-input"
        />
      </div>
      {error && <p className="wl-error">{error}</p>}
      <button type="submit" disabled={busy} className="wl-submit">
        {busy ? 'Invio…' : 'Invia il link'}
      </button>
      <button type="button" onClick={onBack} className="wl-switch">
        Indietro
      </button>
    </form>
  )
}
