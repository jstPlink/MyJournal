// Contatore delle richieste a Gemini fatte da QUESTO dispositivo.
//
// Si contano le richieste partite dall'app (ultimo minuto, ultima ora, ultime
// 24 ore) e si mostrano come semplice contatore (GeminiUsage). Non include le
// richieste del server (recap delle 23:00) né quelle di altri dispositivi con
// la stessa chiave: il conteggio è una stima per difetto.

const LOG_KEY = 'myjournal.geminiLog'
const EVENT = 'myjournal:gemini-usage'
const DAY_MS = 24 * 60 * 60 * 1000
const HOUR_MS = 60 * 60 * 1000
const MINUTE_MS = 60 * 1000
const MAX_ENTRIES = 3000

function readLog() {
  try {
    const list = JSON.parse(localStorage.getItem(LOG_KEY) || '[]')
    return Array.isArray(list) ? list : []
  } catch {
    return []
  }
}

// Registra una richiesta che ha raggiunto il server di Gemini (qualunque esito
// HTTP; gli errori di rete non contano). `status` = codice HTTP.
export function logGeminiRequest(status) {
  const now = Date.now()
  const list = readLog().filter((e) => now - e.t < DAY_MS)
  list.push({ t: now, s: status })
  try {
    localStorage.setItem(LOG_KEY, JSON.stringify(list.slice(-MAX_ENTRIES)))
  } catch {
    /* storage non disponibile: il conteggio salta */
  }
  window.dispatchEvent(new Event(EVENT))
}

export function onGeminiUsageChange(fn) {
  window.addEventListener(EVENT, fn)
  return () => window.removeEventListener(EVENT, fn)
}

// { minute, hour, day } — richieste negli ultimi 60 s / 60 min / 24 h
export function getGeminiUsage() {
  const now = Date.now()
  const out = { minute: 0, hour: 0, day: 0 }
  for (const e of readLog()) {
    const age = now - e.t
    if (age >= DAY_MS) continue
    out.day++
    if (age < HOUR_MS) out.hour++
    if (age < MINUTE_MS) out.minute++
  }
  return out
}
