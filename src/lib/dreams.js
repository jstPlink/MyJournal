import { pb } from './pocketbase'
import { dayKey, dayRange, toPbTime, parseWall } from './dates'

// Accesso alla collection `dreams` (migration 1758000023): i sogni. Sono separati
// dalle note, quindi non entrano nel mood del giorno, nei recap né nelle
// statistiche delle note. Campi: date, time (solo l'orario, data segnaposto come
// timeStart delle note), title, content, clarity (nitidezza 0–1), extra (JSON
// libero per parametri futuri), user.
//
// Le LETTURE non falliscono mai: se il server non ha ancora la collection
// (migration non pubblicata) o non risponde, si torna una lista vuota, così le
// viste giorno, mese e ricerca restano come sono senza sogni.

const COLLECTION = 'dreams'

export const DEFAULT_DREAM_TIME = '00:00' // quando non si sa a che ora

async function safeList(options) {
  try {
    return await pb.collection(COLLECTION).getFullList(options)
  } catch {
    return []
  }
}

export function listDreamsInRange({ start, end }) {
  return safeList({
    filter: pb.filter('date >= {:start} && date <= {:end}', { start, end }),
    sort: 'time',
  })
}

export function listDreamsForDay(date) {
  return listDreamsInRange(dayRange(date))
}

// Giorni (AAAA-MM-GG) con almeno un sogno nell'intervallo: per la lunetta nel calendario.
export async function dreamDaysInRange(range) {
  const list = await listDreamsInRange(range)
  return new Set(list.map((d) => dayKey(d.date)))
}

export function getDream(id) {
  return pb.collection(COLLECTION).getOne(id)
}

// Sogni segnati in un anno (contatore nelle statistiche).
export async function countDreamsInYear(year) {
  try {
    const res = await pb.collection(COLLECTION).getList(1, 1, {
      filter: pb.filter('date >= {:s} && date <= {:e}', {
        s: `${year}-01-01 00:00:00.000Z`,
        e: `${year}-12-31 23:59:59.999Z`,
      }),
      fields: 'id',
    })
    return res.totalItems
  } catch {
    return 0
  }
}

// Ricerca: periodo (start/end già in formato PocketBase) e testo (titolo o descrizione).
export function listDreamsFiltered({ start, end, text = '' } = {}) {
  const parts = []
  const params = {}
  if (start) {
    parts.push('date >= {:start}')
    params.start = start
  }
  if (end) {
    parts.push('date <= {:end}')
    params.end = end
  }
  if (text.trim()) {
    parts.push('(title ~ {:text} || content ~ {:text})')
    params.text = text.trim()
  }
  return safeList({
    filter: parts.length ? pb.filter(parts.join(' && '), params) : undefined,
    sort: '-date,-time',
  })
}

function fields(data) {
  const dKey = dayKey(data.dateKey ?? data.date)
  if (!dKey) throw new Error('Data del sogno mancante o non valida.')
  const clarity = Number(data.clarity)
  return {
    date: dKey,
    time: toPbTime(data.time || DEFAULT_DREAM_TIME),
    title: (data.title ?? '').trim(),
    content: data.content ?? '',
    clarity: Number.isFinite(clarity) ? Math.min(1, Math.max(0, clarity)) : 0.5,
    extra: data.extra ?? {},
  }
}

export function createDream(data) {
  return pb.collection(COLLECTION).create({ ...fields(data), user: pb.authStore.record?.id })
}

export function updateDream(id, data) {
  return pb.collection(COLLECTION).update(id, fields(data))
}

export function deleteDream(id) {
  return pb.collection(COLLECTION).delete(id)
}

// Minuti dalla mezzanotte dell'orario di un sogno (per posizionarlo nella timeline).
export function dreamMinutes(d) {
  const p = parseWall(d?.time)
  return p ? p.h * 60 + p.mi : 0
}

export function dreamTitle(d) {
  return d?.title?.trim() || 'Sogno senza titolo'
}
