// Coda offline delle scritture sulle note (create / update / delete).
// Quando una chiamata a PocketBase fallisce per rete assente, l'operazione
// (dati e file inclusi) viene messa in coda in IndexedDB e riprovata quando
// si torna online. La riproduzione vera è in src/lib/notes.js (flushQueue).

const DB_NAME = 'myjournal-offline'
const STORE = 'ops'
const listeners = new Set()

// Errore "di rete" (offline / DNS / CORS): stessa euristica di describeError.
export function isNetworkError(err) {
  return (
    err?.status === 0 ||
    err?.name === 'TypeError' ||
    err?.originalError?.name === 'TypeError'
  )
}

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
        req.result.createObjectStore(STORE, { keyPath: 'id', autoIncrement: true })
      }
    }
    req.onsuccess = () => resolve(req.result)
    req.onerror = () => reject(req.error)
  })
}

function reqP(req) {
  return new Promise((resolve, reject) => {
    req.onsuccess = () => resolve(req.result)
    req.onerror = () => reject(req.error)
  })
}

async function tx(mode, fn) {
  const db = await openDb()
  try {
    return await new Promise((resolve, reject) => {
      const t = db.transaction(STORE, mode)
      let out
      Promise.resolve(fn(t.objectStore(STORE)))
        .then((r) => {
          out = r
        })
        .catch(reject)
      t.oncomplete = () => resolve(out)
      t.onerror = () => reject(t.error)
      t.onabort = () => reject(t.error)
    })
  } finally {
    db.close()
  }
}

function notify() {
  for (const cb of listeners) {
    try {
      cb()
    } catch {
      // un listener rotto non deve bloccare gli altri
    }
  }
}

// Aggiunge un'operazione alla coda. Ritorna true se riuscito.
export async function enqueue(op) {
  if (!hasIndexedDb()) return false
  try {
    await tx('readwrite', (s) => reqP(s.add({ ...op, createdAt: Date.now() })))
    notify()
    return true
  } catch {
    return false
  }
}

export async function allOps() {
  if (!hasIndexedDb()) return []
  try {
    return await tx('readonly', (s) => reqP(s.getAll()))
  } catch {
    return []
  }
}

export async function removeOp(id) {
  if (!hasIndexedDb()) return
  try {
    await tx('readwrite', (s) => reqP(s.delete(id)))
    notify()
  } catch {
    // ignora: verrà ritentato
  }
}

export async function queuedCount() {
  if (!hasIndexedDb()) return 0
  try {
    return await tx('readonly', (s) => reqP(s.count()))
  } catch {
    return 0
  }
}

// Si iscrive ai cambi della coda. Ritorna la funzione per disiscriversi.
export function onQueueChange(cb) {
  listeners.add(cb)
  return () => listeners.delete(cb)
}
