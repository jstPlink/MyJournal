// Precarica in locale (IndexedDB + Cache Storage) tutto ciò che serve per
// usare l'app con poca rete: note (testo e metadati), persone, tag, luoghi e
// le miniature delle immagini. Parte all'apertura (dopo il login) e a ogni
// ritorno della rete; le letture vere passano da src/lib/cache.js.

import { pb, fileUrl, isLocal } from './pocketbase'
import { cacheSet, markOk, markSlow, THUMBS_CACHE } from './cache'
import { isNetworkError } from './offlineQueue'
import { refreshNotesStore } from './notes'

const THUMB_SIZE = '300x300'
let running = false

async function prefetchThumbs(notes) {
  // In modalità locale le immagini sono già sul dispositivo (blob:).
  if (isLocal || typeof caches === 'undefined') return
  // vecchia cache (versione precedente, con miniature pesanti e risposte opache)
  await caches.delete('myjournal-thumbs')
  const cache = await caches.open(THUMBS_CACHE)
  const urls = []
  for (const n of notes) {
    for (const name of n.images || []) urls.push(fileUrl(n, name, { thumb: THUMB_SIZE }))
  }
  // toglie le miniature di note/immagini che non esistono più
  const wanted = new Set(urls)
  for (const req of await cache.keys()) {
    if (!wanted.has(req.url)) await cache.delete(req)
  }
  let i = 0
  const worker = async () => {
    while (i < urls.length) {
      const url = urls[i++]
      try {
        if (await cache.match(url)) continue
        const res = await fetch(url, { mode: 'cors' })
        if (!res.ok) continue
        await cache.put(url, res)
      } catch {
        // miniatura non scaricabile ora: si riprova al prossimo avvio
      }
    }
  }
  await Promise.all([worker(), worker()])
}

export async function prefetchAll() {
  if (running || !pb.authStore.isValid) return
  running = true
  try {
    // le note passano dall'archivio in memoria di notes.js (una sola richiesta)
    const [notes, people, tags, places] = await Promise.all([
      refreshNotesStore(),
      pb.collection('people').getFullList({ sort: 'name' }),
      pb.collection('tags').getFullList({ sort: 'name' }),
      pb.collection('places').getFullList({ sort: 'name' }),
    ])
    await Promise.all([
      cacheSet('people', people),
      cacheSet('tags', tags),
      cacheSet('places', places),
      ...notes.map((n) => cacheSet(`note:${n.id}`, n)),
    ])
    markOk()
    await prefetchThumbs(notes)
  } catch (err) {
    if (isNetworkError(err)) markSlow()
  } finally {
    running = false
  }
}
