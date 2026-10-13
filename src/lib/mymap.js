// Integrazione MyMap (app personale che traccia gli spostamenti).
// MyMap salva sul suo PocketBase solo i punti GPS grezzi (collection `points`:
// ts in ms, lat, lon, accuracy). I "posti visitati" li calcola l'app MyMap sul
// client: qui rifacciamo lo stesso calcolo (soste di almeno 20 minuti entro
// 150 m) sui punti di un singolo giorno. I nomi dati a mano in MyMap stanno
// nel campo `settings.names.list` ([{lat,lon,name}]) dell'utente MyMap.

import PocketBase, { BaseAuthStore } from 'pocketbase'
import { parseWall } from './dates'

function normalizeBaseUrl(url) {
  return String(url || '').trim().replace(/\/+$/, '')
}

// Configurazione completa dall'utente MyJournal, oppure null se manca qualcosa.
export function mymapConfigFromUser(user) {
  const url = normalizeBaseUrl(user?.mymapUrl)
  const email = user?.mymapEmail?.trim()
  const password = user?.mymapPassword
  if (!url || !email || !password) return null
  return { url, email, password }
}

// Un client per ogni server MyMap, con auth store IN MEMORIA: quello di
// default scriverebbe in localStorage sulla stessa chiave del PocketBase di
// MyJournal, sloggando l'utente.
const sessions = new Map()

async function login({ url, email, password }) {
  const key = `${normalizeBaseUrl(url)}|${email}`
  let client = sessions.get(key)
  if (!client) {
    client = new PocketBase(normalizeBaseUrl(url), new BaseAuthStore())
    client.autoCancellation(false)
    sessions.set(key, client)
  }
  // Il record utente porta i nomi dati a mano: si rilegge a ogni uso (authRefresh)
  // così un nome appena dato in MyMap compare senza ricaricare MyJournal.
  if (client.authStore.isValid) {
    try {
      await client.collection('users').authRefresh()
      return client
    } catch {
      client.authStore.clear()
    }
  }
  try {
    await client.collection('users').authWithPassword(email, password)
  } catch (err) {
    sessions.delete(key)
    throw err
  }
  return client
}

export async function testMymapConnection(cfg) {
  const client = await login(cfg)
  const res = await client.collection('points').getList(1, 1)
  const names = client.authStore.record?.settings?.names?.list
  return {
    points: res.totalItems,
    customNames: Array.isArray(names) ? names.length : 0,
  }
}

const RAD = Math.PI / 180

function km(a, b) {
  const dLat = (b.lat - a.lat) * RAD
  const dLon = (b.lon - a.lon) * RAD
  const h =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(a.lat * RAD) * Math.cos(b.lat * RAD) * Math.sin(dLon / 2) ** 2
  return 2 * 6371 * Math.asin(Math.sqrt(h))
}

// Stessa pulizia di MyMap: via i fix con accuratezza > 120 m e i salti
// impossibili (> 180 km/h per più di 300 m).
function clean(pts) {
  const out = []
  let last = null
  let bad = 0
  for (const p of pts) {
    if (p.acc > 120) continue
    if (last) {
      const h = (p.ts - last.ts) / 36e5
      const d = km(last, p)
      if (h > 0 && d > 0.3 && d / h > 180 && bad < 3) {
        bad++
        continue
      }
    }
    bad = 0
    out.push(p)
    last = p
  }
  return out
}

// Soste di almeno 20 minuti (punti entro 150 m dal primo, buchi fino a 3 h),
// con le soste vicine (entro 150 m) unite nello stesso posto.
function visitPlaces(pts) {
  const episodes = []
  for (let i = 0; i < pts.length; ) {
    const a = pts[i]
    let j = i + 1
    let sl = a.lat
    let so = a.lon
    while (j < pts.length && pts[j].ts - pts[j - 1].ts <= 3 * 36e5 && km(a, pts[j]) < 0.15) {
      sl += pts[j].lat
      so += pts[j].lon
      j++
    }
    const n = j - i
    const end = pts[j - 1].ts
    if (end - a.ts >= 20 * 60000) {
      episodes.push({ lat: sl / n, lon: so / n, start: a.ts, end })
    }
    i = j
  }
  const places = []
  for (const e of episodes) {
    let best = null
    let bd = 0.15
    for (const pl of places) {
      const d = km(pl, e)
      if (d < bd) {
        bd = d
        best = pl
      }
    }
    if (!best) {
      places.push(
        (best = { lat: e.lat, lon: e.lon, visits: 0, ms: 0, first: e.start, last: e.end, sl: 0, so: 0 }),
      )
    }
    best.visits++
    best.ms += e.end - e.start
    best.sl += e.lat
    best.so += e.lon
    best.lat = best.sl / best.visits
    best.lon = best.so / best.visits
    best.last = e.end
  }
  return places
}

// Nome dato a mano in MyMap. In MyMap vale entro 120 m dal centro del posto
// calcolato su TUTTI i dati; qui il centro è quello di un solo giorno e può
// scostarsi (deriva GPS, soste in punti diversi dello stesso posto), quindi
// si accetta fino a 150 m, il raggio con cui MyMap unisce le visite.
function customName(names, lat, lon) {
  let best = null
  let bd = 0.15
  for (const n of names) {
    if (typeof n?.lat !== 'number' || typeof n?.lon !== 'number') continue
    const d = km(n, { lat, lon })
    if (d < bd) {
      bd = d
      best = n
    }
  }
  return best?.name || null
}

const pad = (n) => String(n).padStart(2, '0')
export const hhmm = (ms) => {
  const d = new Date(ms)
  return `${pad(d.getHours())}:${pad(d.getMinutes())}`
}

// Posti visitati in un giorno ("YYYY-MM-DD", ora locale), in ordine
// cronologico. Ogni voce: { lat, lon, start, end, minutes, visits, name }
// con `name` valorizzato solo se l'utente l'ha dato a mano in MyMap.
export async function listMymapVisits(cfg, dateKey) {
  const p = parseWall(dateKey)
  if (!p) return []
  const from = new Date(p.y, p.mo - 1, p.d).getTime()
  const to = new Date(p.y, p.mo - 1, p.d + 1).getTime()
  const client = await login(cfg)
  const rows = await client.collection('points').getFullList({
    filter: `ts >= ${from} && ts < ${to}`,
    sort: 'ts',
    fields: 'ts,lat,lon,accuracy',
    batch: 500,
  })
  const pts = clean(
    rows.map((r) => ({ ts: r.ts, lat: r.lat, lon: r.lon, acc: r.accuracy ?? 0 })),
  )
  const names = client.authStore.record?.settings?.names?.list
  const list = Array.isArray(names) ? names : []
  return visitPlaces(pts)
    .sort((a, b) => a.first - b.first)
    .map((v) => ({
      lat: v.lat,
      lon: v.lon,
      start: v.first,
      end: v.last,
      minutes: Math.round(v.ms / 60000),
      visits: v.visits,
      name: customName(list, v.lat, v.lon),
    }))
}

// Nome da OpenStreetMap (Nominatim) per un punto, come fa MyMap: una
// richiesta alla volta, al massimo una al secondo, con cache in memoria.
const nameCache = new Map()
let nameChain = Promise.resolve()

function osmNameOf(j) {
  const a = j.address || {}
  const town = a.city || a.town || a.village || a.hamlet || a.municipality || a.county || ''
  const spot =
    a.road || a.pedestrian || a.neighbourhood || a.suburb || a.leisure || a.amenity || a.tourism || ''
  const full = [spot, town].filter(Boolean).join(', ')
  return full || (j.display_name || '').split(',').slice(0, 2).join(',').trim()
}

export function lookupPlaceName(lat, lon) {
  const key = `${lat.toFixed(3)},${lon.toFixed(3)}`
  if (nameCache.has(key)) return Promise.resolve(nameCache.get(key))
  nameChain = nameChain.then(async () => {
    if (nameCache.has(key)) return nameCache.get(key)
    let name = null
    try {
      const r = await fetch(
        `https://nominatim.openstreetmap.org/reverse?format=jsonv2&zoom=16&accept-language=it&lat=${lat.toFixed(5)}&lon=${lon.toFixed(5)}`,
      )
      if (r.ok) name = osmNameOf(await r.json()) || null
    } catch {
      // rete non disponibile: resta senza nome, si scrive a mano
    }
    if (name) nameCache.set(key, name)
    await new Promise((res) => setTimeout(res, 1100))
    return name
  })
  return nameChain
}

export function describeMymapError(err) {
  if (!err) return 'Errore sconosciuto.'
  if (err.status === 400 || err.status === 401 || err.status === 403) {
    return 'Email o password di MyMap non valide.'
  }
  if (err.status === 404) {
    return 'Server non valido o collection `points` assente: controlla l’URL di MyMap.'
  }
  if (err.status) return `Errore MyMap (${err.status}).`
  if (err.status === 0 || err.name === 'ClientResponseError' || err.name === 'TypeError') {
    return 'Impossibile raggiungere il server MyMap (rete/CORS). Verifica URL (https) e che sia raggiungibile da qui.'
  }
  return err.message || String(err)
}
