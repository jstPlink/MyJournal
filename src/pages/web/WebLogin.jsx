import { useState } from 'react'
import { Navigate, useLocation, useNavigate } from 'react-router-dom'
import { useAuth } from '../../context/AuthContext'
import { describeError } from '../../lib/notes'
import BackendInfo from '../../components/BackendInfo'
import { moodColor } from '../../lib/mood'

const MIN_PASSWORD = 8

// Pagina di accesso web, skin "Pagine": a sinistra un pannello di
// cartoncino strappato sempre di carta (come la barra laterale, stesso
// tono in chiaro e in scuro) con un esempio fisso di nota/foto/persone —
// nessun utente è ancora connesso qui, è solo un assaggio dell'app; a
// destra il modulo vero, sui token del tema, con le schede Accedi/
// Registrati "a matita" che diventano inchiostro pieno da selezionate, il
// cartoncino tenuto da nastro adesivo e una puntina. Renderizza solo da
// desktop (Screen sceglie Login.jsx sotto i 1024px).
export default function WebLogin() {
  const { login, signup, isAuthed, ready } = useAuth()
  const navigate = useNavigate()
  const location = useLocation()
  const [mode, setMode] = useState('login')
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
        await signup(
          email.trim(),
          password,
          name.trim() ? { name: name.trim() } : {},
        )
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
    <div className="wl-stage">
      {/* pannello sinistro: sempre carta calda, colori fissi */}
      <div className="wl-wrap">
        <div className="wl-under" aria-hidden="true" />
        <aside className="wl-sheet">
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

          <div className="wl-artifacts">
            <div
              className="wl-note"
              style={{ '--mood': moodColor(0.82) }}
              aria-hidden="true"
            >
              <span className="wl-note-mood">82</span>
              <div className="wl-note-title-wrap">
                <span className="hl" aria-hidden="true" />
                <span className="wl-note-title">Giornata al mare</span>
              </div>
              <span className="wl-note-body">
                Acqua fredda, sabbia calda, gelato sciolto e la pelle salata.
              </span>
            </div>

            <figure className="wl-pola" style={{ '--pr': '3.2deg' }} aria-hidden="true">
              <span className="wl-pola-tape" />
              <span className="wl-pola-ph">
                <svg
                  viewBox="0 0 100 100"
                  preserveAspectRatio="xMidYMax slice"
                  role="img"
                  aria-label="Foto di un gruppo di amici (illustrazione)"
                >
                  <defs>
                    <linearGradient id="wlSky" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="0%" stopColor="#f6c98a" />
                      <stop offset="55%" stopColor="#e79a72" />
                      <stop offset="100%" stopColor="#b96a58" />
                    </linearGradient>
                  </defs>
                  <rect width="100" height="100" fill="url(#wlSky)" />
                  <rect x="0" y="83" width="100" height="17" fill="#6d4536" opacity="0.5" />
                  <g fill="#3d2a22">
                    <ellipse cx="26" cy="61" rx="13" ry="16" />
                    <circle cx="26" cy="41" r="11" />
                  </g>
                  <g fill="#4a2f22">
                    <ellipse cx="52" cy="56" rx="14" ry="19" />
                    <circle cx="52" cy="33" r="12" />
                  </g>
                  <g fill="#5a3a28">
                    <ellipse cx="77" cy="62" rx="12" ry="15" />
                    <circle cx="77" cy="44" r="10.5" />
                  </g>
                </svg>
              </span>
              <figcaption className="wl-pola-cap">noi, sabato</figcaption>
            </figure>

            <figure className="wl-pola" style={{ '--pr': '-4deg' }} aria-hidden="true">
              <span className="wl-pola-tape" />
              <span className="wl-pola-ph">
                <svg
                  viewBox="0 0 100 100"
                  preserveAspectRatio="xMidYMax slice"
                  role="img"
                  aria-label="Foto di una giornata al mare (illustrazione)"
                >
                  <defs>
                    <linearGradient id="wlSea" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="0%" stopColor="#bfe3ec" />
                      <stop offset="45%" stopColor="#8fc7d6" />
                      <stop offset="46%" stopColor="#4f9fb0" />
                      <stop offset="100%" stopColor="#2c7688" />
                    </linearGradient>
                  </defs>
                  <rect width="100" height="100" fill="url(#wlSea)" />
                  <circle cx="78" cy="20" r="10" fill="#f9dd8a" />
                  <rect x="0" y="86" width="100" height="14" fill="#e7cf9c" />
                  <path d="M30 60 L30 92" stroke="#8a5c3a" strokeWidth="2" />
                  <path d="M14 58 Q30 42 46 58 Z" fill="#d9645a" />
                  <path d="M14 58 Q30 42 46 58" fill="none" stroke="#a83f37" strokeWidth="1" />
                </svg>
              </span>
              <figcaption className="wl-pola-cap">mare, agosto</figcaption>
            </figure>

            <div className="wl-people" aria-hidden="true">
              <span className="wl-person" style={{ '--tape-c': '#c98a5a', '--pr': '1.6deg' }}>
                <span className="wl-person-face">
                  <svg viewBox="0 0 40 40" role="img" aria-label="Foto di Marta (illustrazione)">
                    <circle cx="20" cy="20" r="20" fill="#e7b98a" />
                    <path d="M2 16 Q20 -2 38 16 L38 10 Q20 4 2 10 Z" fill="#5a3a22" />
                    <circle cx="14" cy="22" r="1.6" fill="#3a2418" />
                    <circle cx="26" cy="22" r="1.6" fill="#3a2418" />
                    <path d="M14 28 Q20 32 26 28" stroke="#3a2418" strokeWidth="1.6" fill="none" strokeLinecap="round" />
                  </svg>
                </span>
                <span className="wl-person-name">Marta</span>
              </span>

              <span className="wl-person" style={{ '--tape-c': '#6a93b0', '--pr': '-1.4deg' }}>
                <span className="wl-person-face">
                  <svg viewBox="0 0 40 40" role="img" aria-label="Foto di Giulio (illustrazione)">
                    <circle cx="20" cy="20" r="20" fill="#d9a878" />
                    <path d="M2 14 Q20 0 38 14 L38 6 Q20 -4 2 6 Z" fill="#2f2018" />
                    <circle cx="14" cy="23" r="1.6" fill="#2a1a10" />
                    <circle cx="26" cy="23" r="1.6" fill="#2a1a10" />
                    <path d="M14 29 Q20 32 26 29" stroke="#2a1a10" strokeWidth="1.6" fill="none" strokeLinecap="round" />
                  </svg>
                </span>
                <span className="wl-person-name">Giulio</span>
              </span>

              <span className="wl-person" style={{ '--tape-c': '#a97fb0', '--pr': '2deg' }}>
                <span className="wl-person-face">
                  <svg viewBox="0 0 40 40" role="img" aria-label="Foto di Ada (illustrazione)">
                    <circle cx="20" cy="20" r="20" fill="#f0c9a0" />
                    <path d="M3 17 Q20 -1 37 17 L37 11 Q20 5 3 11 Z" fill="#c9c9c9" />
                    <circle cx="20" cy="9" r="5" fill="#c9c9c9" />
                    <circle cx="14" cy="23" r="1.6" fill="#4a3626" />
                    <circle cx="26" cy="23" r="1.6" fill="#4a3626" />
                    <path d="M14 29 Q20 32 26 29" stroke="#4a3626" strokeWidth="1.6" fill="none" strokeLinecap="round" />
                  </svg>
                </span>
                <span className="wl-person-name">Ada</span>
              </span>

              <span className="wl-person" style={{ '--tape-c': '#7fae6a', '--pr': '-1.8deg' }}>
                <span className="wl-person-face">
                  <svg viewBox="0 0 40 40" role="img" aria-label="Foto di Luca (illustrazione)">
                    <circle cx="20" cy="20" r="20" fill="#c9946a" />
                    <path d="M3 15 Q20 0 37 15 L37 8 Q20 0 3 8 Z" fill="#241a12" />
                    <rect x="9" y="26" width="22" height="7" rx="3.5" fill="#241a12" opacity="0.35" />
                    <circle cx="14" cy="22" r="1.6" fill="#241a12" />
                    <circle cx="26" cy="22" r="1.6" fill="#241a12" />
                    <path d="M14 27 Q20 30 26 27" stroke="#241a12" strokeWidth="1.6" fill="none" strokeLinecap="round" />
                  </svg>
                </span>
                <span className="wl-person-name">Luca</span>
              </span>
            </div>
          </div>

          <p className="wl-postit">
            Per registrarti bastano email e password. Il resto lo scrivi tu.
          </p>

          <div className="wl-foot">
            <span className="wl-version">MyJournal · v{__APP_VERSION__}</span>
            <BackendInfo compact className="wl-version" />
          </div>
        </aside>
      </div>

      {/* colonna destra: il modulo vero, sui token del tema */}
      <div className="wl-form-wrap">
        <div>
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
                  <label className="wl-label" htmlFor="wlName">
                    Nome <span className="opt">(facoltativo)</span>
                  </label>
                  <input
                    id="wlName"
                    type="text"
                    autoComplete="name"
                    value={name}
                    onChange={(e) => setName(e.target.value)}
                    className="wl-input"
                  />
                </div>
              )}
              <div className="wl-field">
                <label className="wl-label" htmlFor="wlEmail">
                  Email
                </label>
                <input
                  id="wlEmail"
                  type="email"
                  autoComplete={isSignup ? 'email' : 'username'}
                  required
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  className="wl-input"
                />
              </div>
              <div className="wl-field">
                <label className="wl-label" htmlFor="wlPass">
                  Password
                </label>
                <input
                  id="wlPass"
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
                  <label className="wl-label" htmlFor="wlPass2">
                    Conferma password
                  </label>
                  <input
                    id="wlPass2"
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

            <button type="button" onClick={switchMode} className="wl-switch">
              {isSignup
                ? 'Hai già un account? Accedi'
                : 'Non hai un account? Registrati'}
            </button>
          </div>
        </div>
      </div>
    </div>
  )
}
