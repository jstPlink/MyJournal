// Il progetto si chiamava «Annales»: chiavi di localStorage e database
// IndexedDB avevano quel prefisso. Prima di tutto il resto (main.jsx) si
// copiano sotto i nuovi nomi «myjournal», così chi aveva già dati sul
// dispositivo (soprattutto la modalità «Su questo dispositivo») non li perde.
// Questo file è l'UNICO posto dove il vecchio nome deve restare.

const OLD = 'annales'
const NEW = 'myjournal'

const IDB_NAMES = ['local', 'cache', 'offline', 'voice']

export function migrateLocalStorage() {
  try {
    for (const key of Object.keys(localStorage)) {
      if (!key.startsWith(OLD + '.') && !key.startsWith(OLD + ':')) continue
      const next = NEW + key.slice(OLD.length)
      if (localStorage.getItem(next) === null) localStorage.setItem(next, localStorage.getItem(key))
      localStorage.removeItem(key)
    }
  } catch {
    /* localStorage non disponibile */
  }
}

const wrap = (req) =>
  new Promise((resolve, reject) => {
    req.onsuccess = () => resolve(req.result)
    req.onerror = () => reject(req.error)
  })

async function copyDb(oldName, newName) {
  const src = await wrap(indexedDB.open(oldName))
  const stores = [...src.objectStoreNames]
  const dump = {}
  const meta = {}
  if (stores.length) {
    const tx = src.transaction(stores, 'readonly')
    for (const s of stores) {
      const st = tx.objectStore(s)
      meta[s] = { keyPath: st.keyPath, autoIncrement: st.autoIncrement }
      const [keys, values] = await Promise.all([wrap(st.getAllKeys()), wrap(st.getAll())])
      dump[s] = { keys, values }
    }
  }
  src.close()

  const dest = await new Promise((resolve, reject) => {
    const req = indexedDB.open(newName, 1)
    req.onupgradeneeded = () => {
      for (const s of stores) {
        const { keyPath, autoIncrement } = meta[s]
        req.result.createObjectStore(s, keyPath != null ? { keyPath, autoIncrement } : undefined)
      }
    }
    req.onsuccess = () => resolve(req.result)
    req.onerror = () => reject(req.error)
  })
  if (stores.length) {
    const tx = dest.transaction(stores, 'readwrite')
    for (const s of stores) {
      const st = tx.objectStore(s)
      dump[s].values.forEach((v, i) => {
        if (meta[s].keyPath != null) st.put(v)
        else st.put(v, dump[s].keys[i])
      })
    }
    await new Promise((resolve, reject) => {
      tx.oncomplete = resolve
      tx.onerror = () => reject(tx.error)
    })
  }
  dest.close()
  await wrap(indexedDB.deleteDatabase(oldName))
}

async function migrateIndexedDb() {
  if (typeof indexedDB === 'undefined' || !indexedDB.databases) return
  const existing = new Set((await indexedDB.databases()).map((d) => d.name))
  for (const suffix of IDB_NAMES) {
    const oldName = `${OLD}-${suffix}`
    const newName = `${NEW}-${suffix}`
    if (!existing.has(oldName) || existing.has(newName)) continue
    try {
      await copyDb(oldName, newName)
    } catch (err) {
      console.error('Migrazione archivio fallita', oldName, err)
    }
  }
}

export const migrateLegacyIndexedDb = migrateIndexedDb
