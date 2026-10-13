import { useState } from 'react'
import { useLocation, useNavigate, Navigate } from 'react-router-dom'
import { useAuth } from '../context/AuthContext'
import { describeError } from '../lib/notes'
import { haptic } from '../lib/haptics'
import PhoneShell from '../components/PhoneShell'
import BackendInfo from '../components/BackendInfo'

const MIN_PASSWORD = 8

// Pagina di accesso mobile, skin "Pagine": stessa identità della versione
// web (WebLogin.jsx) — il modulo (cartoncino, nastro, puntina, schede a
// matita) è esattamente lo stesso, classi .wl-* condivise. Qui solo
// un'intestazione di carta più corta (un foglio solo, strappo in basso) al
// posto del pannello a due fogli della barra laterale, e niente
// nota/foto/persone di esempio: sul telefono lo spazio verticale è poco e
// il modulo deve restare la cosa più in vista.
export default function Login() {
  const { login, signup, isAuthed, ready } = useAuth()
  const navigate = useNavigate()
  const location = useLocation()
  const [mode, setMode] = useState('login') // 'login' | 'signup'
  const [name, setName] = useState('')
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [passwordConfirm, setPasswordConfirm] = useState('')
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')

  const from = location.state?.from?.pathname || '/'
  const isSignup = mode === 'signup'

  if (ready && isAuthed) return <Navigate to={from} replace />

  function switchMode() {
    setMode((m) => (m === 'login' ? 'signup' : 'login'))
    setError('')
    setPassword('')
    setPasswordConfirm('')
  }

  async function onSubmit(e) {
    e.preventDefault()
    haptic()
    setError('')

    if (isSignup) {
      if (password.length < MIN_PASSWORD) {
        setError(`La password deve avere almeno ${MIN_PASSWORD} caratteri.`)
        return
      }
      if (password !== passwordConfirm) {
        setError('Le due password non coincidono.')
        return
      }
    }

    setBusy(true)
    try {
      if (isSignup) {
        await signup(email.trim(), password, name.trim() ? { name: name.trim() } : {})
      } else {
        await login(email.trim(), password)
      }
      navigate(from, { replace: true })
    } catch (err) {
      setError(describeError(err))
    } finally {
      setBusy(false)
    }
  }

  return (
    <PhoneShell>
      <main className="anim-page ml-scroll flex-1 overflow-y-auto no-scrollbar">
        <div className="ml-wrap">
          <div className="ml-sheet">
            <div className="wl-logo">
              <img src="/favicon.svg" alt="" />
              <span className="wl-logo-name">MyJournal</span>
            </div>

            <h1 className="wl-headline">
              Il diario che tiene il{' '}
              <span className="wl-hl-wrap">
                <span className="hl" aria-hidden="true" />
                ritmo
              </span>{' '}
              delle tue giornate.
            </h1>
            <p className="wl-sub">
              Annota momenti, umore e immagini. Rivedi il mese a colpo
              d'occhio, un giorno alla volta.
            </p>
          </div>
        </div>

        <div className="ml-form-area">
          <div className="wl-card">
            <span className="wl-tape h red top-a" aria-hidden="true" />
            <span className="wl-tape h green top-b" aria-hidden="true" />
            <span className="wl-tape v blue right-a" aria-hidden="true" />
            <span className="wl-tape v red right-b" aria-hidden="true" />
            <span className="wl-tape h green bottom-a" aria-hidden="true" />
            <span className="wl-tape v blue left-a" aria-hidden="true" />
            <span className="wl-card-pin" aria-hidden="true" />

            <div className="wl-title-wrap">
              <span className="hl" aria-hidden="true" />
              <h2 className="wl-title">
                {isSignup ? 'Crea il tuo account' : 'Bentornato'}
              </h2>
            </div>
            <p className="wl-desc">
              {isSignup
                ? 'Bastano email e password.'
                : 'Accedi per continuare il tuo diario.'}
            </p>

            <div className="wl-tabs" role="tablist" aria-label="Modalità">
              <button
                type="button"
                role="tab"
                aria-selected={!isSignup}
                onClick={() => mode !== 'login' && switchMode()}
                className="wl-tab"
              >
                Accedi
              </button>
              <button
                type="button"
                role="tab"
                aria-selected={isSignup}
                onClick={() => mode !== 'signup' && switchMode()}
                className="wl-tab"
              >
                Registrati
              </button>
            </div>

            <form onSubmit={onSubmit}>
              {isSignup && (
                <div className="wl-field">
                  <label className="wl-label" htmlFor="mlName">
                    Nome <span className="opt">(facoltativo)</span>
                  </label>
                  <input
                    id="mlName"
                    type="text"
                    autoComplete="name"
                    value={name}
                    onChange={(e) => setName(e.target.value)}
                    className="wl-input"
                  />
                </div>
              )}
              <div className="wl-field">
                <label className="wl-label" htmlFor="mlEmail">
                  Email
                </label>
                <input
                  id="mlEmail"
                  type="email"
                  autoComplete={isSignup ? 'email' : 'username'}
                  required
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  className="wl-input"
                />
              </div>
              <div className="wl-field">
                <label className="wl-label" htmlFor="mlPass">
                  Password
                </label>
                <input
                  id="mlPass"
                  type="password"
                  autoComplete={isSignup ? 'new-password' : 'current-password'}
                  required
                  minLength={isSignup ? MIN_PASSWORD : undefined}
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  className="wl-input"
                />
              </div>
              {isSignup && (
                <div className="wl-field">
                  <label className="wl-label" htmlFor="mlPass2">
                    Conferma password
                  </label>
                  <input
                    id="mlPass2"
                    type="password"
                    autoComplete="new-password"
                    required
                    value={passwordConfirm}
                    onChange={(e) => setPasswordConfirm(e.target.value)}
                    className="wl-input"
                  />
                </div>
              )}

              {error && <p className="wl-error">{error}</p>}

              <button type="submit" disabled={busy} className="wl-submit">
                {busy
                  ? isSignup
                    ? 'Creazione…'
                    : 'Accesso…'
                  : isSignup
                    ? 'Crea account'
                    : 'Entra'}
              </button>
            </form>

          </div>

          <p className="ml-postit">
            Per registrarti bastano email e password. Il resto lo scrivi tu.
          </p>

          <p className="ml-version">MyJournal · v{__APP_VERSION__}</p>
          <BackendInfo compact className="ml-version" />
        </div>
      </main>
    </PhoneShell>
  )
}
