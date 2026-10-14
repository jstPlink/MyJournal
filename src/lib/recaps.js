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

async function saveRecap(period, key, text) {
  const userId = pb.authStore.record?.id
  if (!userId) throw new Error('Non autenticato.')
  const existing = await findRecap(period, key)
  if (existing) await pb.collection(COLLECTION).update(existing.id, { text })
  else await pb.collection(COLLECTION).create({ user: userId, period, key, text })
  await cacheSet(`recap:${period}:${key}`, text)
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
