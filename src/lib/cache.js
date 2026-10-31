// Cache locale in lettura (IndexedDB) + stato della connessione, per usare
// l'app anche con poca o nessuna rete. Le SCRITTURE offline sono già gestite
// da src/lib/offlineQueue.js (coda + riprova); qui c'è il lato lettura:
//  - `cachedRead(key, fetcher)`: mostra subito i dati salvati se la rete è
//    assente o lenta (oltre ~2,5 s) e li aggiorna in background appena
//    arriva la risposta vera, avvisando le pagine con un evento;
//  - `prefetchAll()` (src/lib/prefetch.js) riempie la cache all'apertura;
//  - lo stato ('ok' | 'slow' | 'offline') alimenta la pillola in alto
//    (src/components/StatusPills.jsx).
// Le chiavi sono per-utente, così un altro account sullo stesso dispositivo
// non vede i dati altrui.

import { pb, isLocal } from './pocketbase'
import { isNetworkError } from './offlineQueue'

const DB_NAME = 'myjournal-cache'
const STORE = 'kv'
const SOFT_MS = 2500
const SOFT = Symbol('soft-timeout')

function hasIndexedDb() {
  try {
    return typeof indexedDB !== 'undefined' && indexedDB !== null
  } catch {
    return false
  }
}

function openDb() {
  return new Promise((resolve, reject) => {
    const req = indexedDB.open(DB_NAME, 1)
    req.onupgradeneeded = () => {
      if (!req.result.objectStoreNames.contains(STORE)) {
        req.result.createObjectStore(STORE)
      }
    }
    req.onsuccess = () => resolve(req.result)
    req.onerror = () => reject(req.error)
  })
}

async function withStore(mode, fn) {
  const db = await openDb()
  try {
    return await new Promise((resolve, reject) => {
      const t = db.transaction(STORE, mode)
      const req = fn(t.objectStore(STORE))
      t.oncomplete = () => resolve(req?.result)
      t.onerror = () => reject(t.error)
      t.onabort = () => reject(t.error)
    })
  } finally {
    db.close()
  }
}

function scoped(key) {
  return `${pb.authStore.record?.id || 'anon'}:${key}`
}

// { value, savedAt } oppure null. Mai un errore: la cache è solo un aiuto.
export async function cacheGet(key) {
  if (!hasIndexedDb()) return null
  try {
    return (await withStore('readonly', (s) => s.get(scoped(key)))) || null
  } catch {
    return null
  }
}

export async function cacheSet(key, value) {
  if (!hasIndexedDb()) return
  try {
    await withStore('readwrite', (s) => s.put({ value, savedAt: Date.now() }, scoped(key)))
  } catch {
    // spazio esaurito / storage non disponibile: si va avanti senza cache
  }
}

// ---- stato connessione ----
let state = {
  status: typeof navigator !== 'undefined' && navigator.onLine === false ? 'offline' : 'ok',
  lastSync: null,
}
const connListeners = new Set()

function setState(patch) {
  const next = { ...state, ...patch }
  if (next.status === state.status && next.lastSync === state.lastSync) return
  state = next
  connListeners.forEach((fn) => fn())
}

export const getConnection = () => state
export function subscribeConnection(fn) {
  connListeners.add(fn)
  return () => connListeners.delete(fn)
}
export const markOk = () => setState({ status: 'ok', lastSync: Date.now() })
export const markSlow = () => setState({ status: state.status === 'offline' ? 'offline' : 'slow' })
export const markOffline = () => setState({ status: 'offline' })

if (typeof window !== 'undefined') {
  window.addEventListener('offline', markOffline)
  window.addEventListener('online', () => setState({ status: 'slow' }))
  const conn = navigator.connection
  const check = () => {
    if (navigator.onLine !== false && ['slow-2g', '2g'].includes(conn?.effectiveType)) {
      markSlow()
    }
  }
  conn?.addEventListener?.('change', check)
  check()
}

// ---- eventi "cache aggiornata" (le pagine ricaricano) ----
const updateListeners = new Set()
export function subscribeCacheUpdates(fn) {
  updateListeners.add(fn)
  return () => updateListeners.delete(fn)
}
export function emitCacheUpdate(key) {
  updateListeners.forEach((fn) => fn(key))
}
function emitUpdate(key) {
  updateListeners.forEach((fn) => fn(key))
}

// Legge con cache: vedi il commento in cima. `fallback` (opzionale) prova a
// ricostruire il dato da altra cache quando quella esatta manca.
export async function cachedRead(key, fetcher, { fallback, softMs = SOFT_MS } = {}) {
  // Archivio sul dispositivo: i dati sono già locali, niente cache da tenere in pari.
  if (isLocal) return fetcher()
  const cached = await cacheGet(key)
  let servedFromCache = false

  const live = fetcher().then(
    async (value) => {
      await cacheSet(key, value)
      markOk()
      // avvisa le pagine solo se i dati sono davvero cambiati (evita giri
      // a vuoto di ricaricamenti con rete sempre lenta)
      if (servedFromCache && (!cached || JSON.stringify(cached.value) !== JSON.stringify(value))) {
        emitUpdate(key)
      }
      return value
    },
    (err) => {
      if (isNetworkError(err)) markOffline()
      throw err
    },
  )

  const stale = async () => {
    if (cached) return cached.value
    const alt = fallback ? await fallback() : undefined
    return alt
  }

  if (typeof navigator !== 'undefined' && navigator.onLine === false) {
    const v = await stale()
    if (v !== undefined) {
      servedFromCache = true
      markOffline()
      live.catch(() => {})
      return v
    }
    return live
  }

  try {
    if (!cached) return await live
    return await Promise.race([
      live,
      new Promise((_, reject) => setTimeout(() => reject(SOFT), softMs)),
    ])
  } catch (err) {
    if (err === SOFT) {
      servedFromCache = true
      markSlow()
      live.catch(() => {})
      return cached.value
    }
    if (isNetworkError(err)) {
      const v = await stale()
      if (v !== undefined) return v
    }
    throw err
  }
}

// ---- statistiche e pulizia (Impostazioni → Uso offline) ----
export const THUMBS_CACHE = 'myjournal-thumbs-v2'
const LEGACY_THUMBS_CACHES = ['myjournal-thumbs']

// Spazio usato dall'app su questo dispositivo (stima del browser: include
// anche coda offline e file dell'app) + cosa c'è nella cache dei dati.
export async function offlineStats() {
  let usage = null
  let quota = null
  try {
    const e = await navigator.storage?.estimate?.()
    usage = e?.usage ?? null
    quota = e?.quota ?? null
  } catch {
    // stima non disponibile su questo browser
  }
  const all = await cacheGet('notes:all')
  let thumbs = 0
  try {
    thumbs = (await (await caches.open(THUMBS_CACHE)).keys()).length
  } catch {
    // Cache Storage non disponibile
  }
  return {
    usage,
    quota,
    notes: all?.value?.length ?? 0,
    savedAt: all?.savedAt ?? null,
    thumbs,
  }
}

// Svuota dati e miniature salvati (le note sul server restano intatte, e la
// coda delle modifiche offline non si tocca).
export async function clearOfflineCache() {
  if (hasIndexedDb()) {
    try {
      await withStore('readwrite', (s) => s.clear())
    } catch {
      // niente da svuotare
    }
  }
  try {
    for (const name of [THUMBS_CACHE, ...LEGACY_THUMBS_CACHES]) await caches.delete(name)
  } catch {
    // Cache Storage non disponibile
  }
}
