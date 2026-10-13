// Dove vivono i dati del diario. È una scelta dell'utente, fatta alla prima
// apertura (BackendChooser) e ricordata sul dispositivo:
//   { mode: 'local' }              → tutto in questo dispositivo/browser
//                                    (IndexedDB, vedi localPocketBase.js);
//   { mode: 'server', url: '…' }   → un'istanza di MyJournal (PocketBase) a un
//                                    indirizzo scelto dall'utente.
// Nessun indirizzo è scritto nel codice. `VITE_PB_URL` (build) serve solo a
// precompilare il campo per chi distribuisce la propria build.

import { Capacitor } from '@capacitor/core'

const KEY = 'myjournal.backend'
const LEGACY_AUTH_KEY = 'pocketbase_auth'

export const DEFAULT_SERVER_URL = import.meta.env.VITE_PB_URL?.trim() || ''

export function isNative() {
  try {
    return Capacitor.isNativePlatform()
  } catch {
    return false
  }
}

export function getBackend() {
  try {
    const raw = localStorage.getItem(KEY)
    if (raw) {
      const cfg = JSON.parse(raw)
      if (cfg?.mode === 'local') return { mode: 'local' }
      if (cfg?.mode === 'server' && cfg.url) return { mode: 'server', url: cfg.url }
    }
    // Chi usava già l'app dal browser (sessione salvata, stessa origin) resta
    // sul suo server senza dover scegliere di nuovo.
    if (!isNative() && localStorage.getItem(LEGACY_AUTH_KEY)) {
      const cfg = { mode: 'server', url: window.location.origin }
      localStorage.setItem(KEY, JSON.stringify(cfg))
      return cfg
    }
  } catch {
    // localStorage non disponibile
  }
  return null
}

export function setBackend(cfg) {
  localStorage.setItem(KEY, JSON.stringify(cfg))
}

// Torna alla scelta iniziale (non cancella i dati locali né quelli del server).
export function resetBackend() {
  try {
    localStorage.removeItem(KEY)
    localStorage.removeItem(LEGACY_AUTH_KEY)
  } catch {
    // niente da fare
  }
}

// "myjournal.mio.it" → "https://myjournal.mio.it"; toglie spazi, "/" finale e
// qualsiasi percorso. Ritorna '' se non è un indirizzo valido.
export function normalizeServerUrl(input) {
  let v = String(input || '').trim()
  if (!v) return ''
  if (!/^[a-z][a-z0-9+.-]*:\/\//i.test(v)) v = `https://${v}`
  try {
    const u = new URL(v)
    if (u.protocol !== 'https:' && u.protocol !== 'http:') return ''
    return u.origin
  } catch {
    return ''
  }
}

// Controlla che all'indirizzo risponda un'istanza di PocketBase.
export async function checkServer(url) {
  const ctrl = new AbortController()
  const timer = setTimeout(() => ctrl.abort(), 8000)
  try {
    const res = await fetch(`${url}/api/health`, { signal: ctrl.signal })
    if (!res.ok) return { ok: false, message: `Il server ha risposto ${res.status}.` }
    return { ok: true }
  } catch {
    return {
      ok: false,
      message:
        'Non riesco a raggiungere il server. Controlla l’indirizzo (meglio https) e la connessione.',
    }
  } finally {
    clearTimeout(timer)
  }
}
