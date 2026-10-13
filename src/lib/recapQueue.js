// Recap segnati da aggiornare (collection `recap_jobs`, scritta solo dal
// server — vedi pb_hooks/recap_lib.js): il server li rigenera tutti in blocco
// ogni sera alle 23:00. Serve a far vedere in app cosa è in attesa dopo aver
// salvato una nota (src/components/RecapQueueTab.jsx).
import { pb } from './pocketbase'
import { MONTHS_IT, dayMonthLabel } from './dates'

const POKE_EVENT = 'myjournal:recap-queue-poke'

// Da chiamare dopo aver salvato una nota: fa ricontrollare subito la coda
// (con un attimo di respiro, il tempo che l'hook del server la riempia).
export function pokeRecapQueue(delayMs = 1500) {
  setTimeout(() => window.dispatchEvent(new Event(POKE_EVENT)), delayMs)
}

export function onRecapQueuePoke(fn) {
  window.addEventListener(POKE_EVENT, fn)
  return () => window.removeEventListener(POKE_EVENT, fn)
}

export function jobLabel(job) {
  if (job.period === 'day') return `il giorno ${dayMonthLabel(job.key)}`
  if (job.period === 'month') {
    const [y, m] = job.key.split('-')
    return `il mese di ${MONTHS_IT[Number(m) - 1]} ${y}`
  }
  return `l'anno ${job.key}`
}

// Etichetta breve di una voce dell'elenco: "5 ottobre", "ottobre 2026", "2026".
export function jobShortLabel(job) {
  if (job.period === 'day') return dayMonthLabel(job.key)
  if (job.period === 'month') {
    const [y, m] = job.key.split('-')
    return `${MONTHS_IT[Number(m) - 1]} ${y}`
  }
  return job.key
}

const ORDER = { day: 0, month: 1, year: 2 }

// { total, items: [{period, key}] } con TUTTI i recap segnati da aggiornare, nel
// modo in cui li lavora il server: prima i giorni, poi i mesi, poi gli anni
// (ciascun gruppo dal più vecchio al più recente). Vuota anche se la collection
// non esiste ancora (server non aggiornato) o la rete manca.
export async function fetchRecapQueue() {
  try {
    const all = await pb.collection('recap_jobs').getFullList({ batch: 200 })
    // mese e anno in corso non si aggiornano finché non finiscono
    const now = new Date()
    const curMonth = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`
    const curYear = String(now.getFullYear())
    const items = all.filter(
      (j) => !((j.period === 'month' && j.key === curMonth) || (j.period === 'year' && j.key === curYear)),
    )
    items.sort((a, b) => ORDER[a.period] - ORDER[b.period] || (a.key < b.key ? -1 : a.key > b.key ? 1 : 0))
    return { total: items.length, items }
  } catch {
    return { total: 0, items: [] }
  }
}
