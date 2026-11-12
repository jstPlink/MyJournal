// Lettura e generazione manuale dei recap automatici (giorno/mese/anno,
// collection `recaps`). Quelli "in orario" li scrive da sé il server, di
// notte, con Gemini — vedi il commento in cima a pb_hooks/main.pb.js. Qui
// c'è solo:
//  - la lettura (con cache, come il resto dell'app — vedi lib/cache.js);
//  - il tasto "Genera"/"Rigenera" nell'app: serve per i periodi passati, mai
//    toccati dal cron perché chiusi prima che questa funzione esistesse, o
//    per avere subito un testo aggiornato senza aspettare il cron.
import { pb } from './pocketbase'
import { cachedRead, cacheSet } from './cache'
import { dayRecap as geminiDayRecap, recapNotes } from './gemini'
import { recapInstructionsOf } from './aiInstructions'

const COLLECTION = 'recaps'

async function findRecap(period, key) {
  try {
    return await pb
      .collection(COLLECTION)
      .getFirstListItem(pb.filter('period = {:period} && key = {:key}', { period, key }))
  } catch (err) {
    if (err?.status === 404) return null
    throw err
  }
}

async function getRecap(period, key) {
  return cachedRead(`recap:${period}:${key}`, async () => {
    const rec = await findRecap(period, key)
    return rec ? rec.text : null
  })
}

// null = non ancora generato (periodo non chiuso, o cron non ancora
// passato di lì — vedi il tasto "Genera" per crearlo subito a mano).
export const getDayRecap = (dateKey) => getRecap('day', dateKey)
export const getMonthRecap = (monthKey) => getRecap('month', monthKey)
export const getYearRecap = (year) => getRecap('year', String(year))

// Un solo record per (utente, periodo, chiave) — vedi l'indice unico in
// pb_migrations/1758000016_recaps_collection.js.
// Istruzioni dell'utente per i riassunti (Impostazioni → Gemini).
const recapInstructions = () => recapInstructionsOf(pb.authStore.record)

// true = riassunto scritto a mano: il server non lo rigenera mai in automatico.
export const isRecapManual = (period, key) =>
  cachedRead(`recapm:${period}:${key}`, async () => {
    const rec = await findRecap(period, key)
    return Boolean(rec?.manual)
  })

async function saveRecap(period, key, text, manual = false) {
  const userId = pb.authStore.record?.id
  if (!userId) throw new Error('Non autenticato.')
  const existing = await findRecap(period, key)
  if (existing) await pb.collection(COLLECTION).update(existing.id, { text, manual })
  else await pb.collection(COLLECTION).create({ user: userId, period, key, text, manual })
  await cacheSet(`recap:${period}:${key}`, text)
  await cacheSet(`recapm:${period}:${key}`, manual)
}

// Testo scritto a mano dall'utente: da qui in poi resta suo (manual = true).
export const writeRecap = (period, key, text) => saveRecap(period, key, text.trim(), true)

// Svuotato a mano: il riassunto si elimina e torna del tutto automatico (il server lo
// riscrive alla prossima modifica del periodo; l'anno resta vuoto finché non lo si scrive).
export async function clearRecap(period, key) {
  const existing = await findRecap(period, key)
  if (existing) await pb.collection(COLLECTION).delete(existing.id)
  await cacheSet(`recap:${period}:${key}`, null)
  await cacheSet(`recapm:${period}:${key}`, false)
}

// Torna alla generazione automatica (il testo resta finché non viene rigenerato).
export async function releaseRecap(period, key, text) {
  await saveRecap(period, key, text, false)
}

export async function regenerateDayRecap(apiKey, dateKey, notes, onRetry) {
  const text = await geminiDayRecap(apiKey, notes, onRetry, recapInstructions())
  await saveRecap('day', dateKey, text)
  return text
}

export async function regenerateMonthRecap(apiKey, monthKey, notes, label, onRetry) {
  const text = await recapNotes(apiKey, notes, {
    label,
    onRetry,
    customInstructions: recapInstructions(),
  })
  await saveRecap('month', monthKey, text)
  return text
}

export async function regenerateYearRecap(apiKey, year, notes, onRetry) {
  const text = await recapNotes(apiKey, notes, {
    label: String(year),
    onRetry,
    customInstructions: recapInstructions(),
  })
  await saveRecap('year', String(year), text)
  return text
}

// Riassunti dei giorni di un anno intero (chiave AAAA-MM-GG -> testo), con una sola richiesta:
// serve all'export del Diario con l'estetica a schermo.
export async function listDayRecapsInYear(year) {
  try {
    const list = await pb.collection(COLLECTION).getFullList({
      filter: pb.filter('period = "day" && key >= {:a} && key <= {:b}', { a: `${year}-01-01`, b: `${year}-12-31` }),
    })
    return new Map(list.filter((r) => r.text).map((r) => [r.key, r.text]))
  } catch {
    return new Map()
  }
}
