import { useState } from 'react'
import { useNavigate, useParams } from 'react-router-dom'
import { pb } from '../lib/pocketbase'
import { describeError } from '../lib/notes'

const MIN_PASSWORD = 5

// Schermata aperta dal link della mail «Ho dimenticato la password»: sceglie la
// nuova password con il token ricevuto. Fuori da RequireAuth.
export default function ResetPassword() {
  const { token } = useParams()
  const navigate = useNavigate()
  const [password, setPassword] = useState('')
  const [confirm, setConfirm] = useState('')
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')
  const [done, setDone] = useState(false)

  async function onSubmit(e) {
    e.preventDefault()
    setError('')
    if (password.length < MIN_PASSWORD) {
      setError(`La password deve avere almeno ${MIN_PASSWORD} caratteri.`)
      return
    }
    if (password !== confirm) {
      setError('Le due password non coincidono.')
      return
    }
    setBusy(true)
    try {
      await pb.collection('users').confirmPasswordReset(token, password, confirm)
      setDone(true)
    } catch (err) {
      setError(
        err?.status === 400
          ? 'Il link non è valido o è scaduto: richiedine uno nuovo dalla schermata di accesso.'
          : describeError(err),
      )
    } finally {
      setBusy(false)
    }
  }

  return (
    <div className="app-paper flex min-h-dvh items-center justify-center bg-cream p-4 text-ink">
      <div className="wl-card" style={{ position: 'relative', width: '100%', maxWidth: 440 }}>
        <span className="wl-tape h red top-a" aria-hidden="true" />
        <span className="wl-tape v blue right-a" aria-hidden="true" />
        <span className="wl-card-pin" aria-hidden="true" />

        <div className="wl-title-wrap">
          <span className="hl" aria-hidden="true" />
          <h1 className="wl-title">Nuova password</h1>
        </div>

        {done ? (
          <div>
            <p className="wl-desc">Fatto: ora puoi accedere con la nuova password.</p>
            <button
              type="button"
              className="wl-submit"
              onClick={() => navigate('/login', { replace: true })}
            >
              Vai all'accesso
            </button>
          </div>
        ) : (
          <form onSubmit={onSubmit}>
            <div className="wl-field">
              <label className="wl-label" htmlFor="rpPass">
                Nuova password
              </label>
              <input
                id="rpPass"
                type="password"
                autoComplete="new-password"
                required
                minLength={MIN_PASSWORD}
                autoFocus
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                className="wl-input"
              />
            </div>
            <div className="wl-field">
              <label className="wl-label" htmlFor="rpPass2">
                Conferma password
              </label>
              <input
                id="rpPass2"
                type="password"
                autoComplete="new-password"
                required
                value={confirm}
                onChange={(e) => setConfirm(e.target.value)}
                className="wl-input"
              />
            </div>
            {error && <p className="wl-error">{error}</p>}
            <button type="submit" disabled={busy} className="wl-submit">
              {busy ? 'Salvo…' : 'Salva la password'}
            </button>
          </form>
        )}
      </div>
    </div>
  )
}
