// Integrazione Gemini (Google AI Studio): pulizia/riassunto del testo di una
// nota, generazione di nuovo contenuto, estrazione di note da uno screenshot
// di vecchio diario. Serve solo una API key (Profilo) — nessun OAuth,
// chiamata REST diretta, nessuna libreria necessaria.

import { MONTHS_IT, dayKey } from './dates'
import { plainText } from './notes'
import { timesInText } from './importSheet'
import { pb } from './pocketbase'
import { logGeminiRequest } from './geminiUsage'

// Salva le istruzioni personalizzate sull'account (campo `geminiCustomInstructions`
// di `users`) — usata sia da Impostazioni sia dai pannelli dove si scrive il
// prompt (modificabili lì al volo, senza dover andare in Impostazioni).
export async function saveGeminiCustomInstructions(text) {
  const userId = pb.authStore.record?.id
  if (!userId) throw new Error('Non autenticato.')
  await pb.collection('users').update(userId, {
    geminiCustomInstructions: text.trim(),
  })
}

// Istruzioni fisse per TUTTI i riassunti (recap giorno/mese/anno): campo
// `recapCustomInstructions` di `users`, usato anche dal server (recap_lib.js).
// Restituisce il record aggiornato.
export async function saveRecapCustomInstructions(text) {
  const userId = pb.authStore.record?.id
  if (!userId) throw new Error('Non autenticato.')
  return pb.collection('users').update(userId, {
    recapCustomInstructions: text.trim(),
  })
}

// Prefisso del prompt con le istruzioni dell'utente per i riassunti.
function recapInstructionsPrefix(text) {
  const t = (text || '').trim()
  return t
    ? `Istruzioni fisse dell'utente su come scrivere i riassunti (rispettale sempre, a meno che non contraddicano il formato richiesto sotto): ${t}

`
    : ''
}

const clamp01 = (x) => Math.min(1, Math.max(0, x))

// gemini-2.5-flash è stato ritirato per i nuovi utenti (l'API risponde 404
// indicando questo modello come sostituto): vedi errore riportato dall'utente
// il 2026-09-06.
const MODEL = 'gemini-3.6-flash'

// Bozza del prompt scritto per "Nuova nota con Gemini": salvata in
// localStorage a ogni battitura e cancellata solo alla generazione riuscita.
// Se la chiamata a Gemini fallisce per qualunque motivo (rete, chiave,
// limite di richieste...) il testo scritto non va perso — riaprendo il
// dialog lo si ritrova già lì, senza doverlo riscrivere.
const PROMPT_DRAFT_KEY = 'myjournal.geminiPromptDraft'

export function loadGeminiPromptDraft() {
  try {
    return localStorage.getItem(PROMPT_DRAFT_KEY) || ''
  } catch {
    return ''
  }
}

export function saveGeminiPromptDraft(text) {
  try {
    if (text) localStorage.setItem(PROMPT_DRAFT_KEY, text)
    else localStorage.removeItem(PROMPT_DRAFT_KEY)
  } catch {
    // localStorage non disponibile: nessun backup possibile, non blocca l'uso
  }
}

export function clearGeminiPromptDraft() {
  saveGeminiPromptDraft('')
}

// Un tentativo, senza riprovi: il chiamante fornisce `contents` completo
// (un turno per ogni scambio utente/modello — vedi callGeminiParts).
async function callGeminiOnce(apiKey, contents, model = MODEL) {
  const res = await fetch(
    `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${encodeURIComponent(apiKey)}`,
    {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ contents }),
    },
  )
  logGeminiRequest(res.status) // contatore richieste (vedi geminiUsage.js)
  if (!res.ok) {
    let detail = ''
    let retryDelaySeconds = null
    let quotaId = ''
    try {
      const data = await res.json()
      detail = data?.error?.message || ''
      // Sui 429 Gemini include spesso un dettaglio RetryInfo con il tempo
      // esatto di attesa consigliato (es. "retryDelay": "38s") — lo usiamo
      // per dare un tempo preciso invece di un generico "riprova tra poco".
      const retryInfo = data?.error?.details?.find((d) =>
        String(d?.['@type'] || '').includes('RetryInfo'),
      )
      const m = String(retryInfo?.retryDelay || '').match(/([\d.]+)\s*s/)
      if (m) retryDelaySeconds = Math.ceil(Number(m[1]))
      // QuotaFailure dice QUALE limite è scattato (es. ...PerDay... o ...PerMinute...)
      const quota = data?.error?.details?.find((d) =>
        String(d?.['@type'] || '').includes('QuotaFailure'),
      )
      quotaId = (quota?.violations || [])
        .map((v) => `${v?.quotaId || ''} ${v?.quotaMetric || ''}`)
        .join(' ')
    } catch {
      // risposta non JSON, ignora
    }
    if (retryDelaySeconds == null) {
      const retryAfter = res.headers.get('retry-after')
      if (retryAfter && !Number.isNaN(Number(retryAfter))) {
        retryDelaySeconds = Math.ceil(Number(retryAfter))
      }
    }
    const err = new Error(detail || 'Richiesta a Gemini non riuscita.')
    err.status = res.status
    err.retryDelaySeconds = retryDelaySeconds
    err.quotaId = quotaId
    throw err
  }
  const data = await res.json()
  const text = (data?.candidates?.[0]?.content?.parts || [])
    .map((p) => p.text || '')
    .join('')
    .trim()
  if (!text) throw new Error('Gemini non ha restituito testo.')
  return text
}

// Se una richiesta fallisce per un intoppo momentaneo si riprova da sole: dopo
// 3 secondi, poi 5, poi 7 e infine 9 — in tutto 5 tentativi prima di arrendersi.
const RETRY_DELAYS_MS = [3000, 5000, 7000, 9000]
const OVERLOAD_MAX_ATTEMPTS = RETRY_DELAYS_MS.length + 1

// Vale la pena riprovare? Sì per i guasti momentanei (server sovraccarico o
// in errore, limite al minuto, rete assente); no per chiave non valida, richiesta
// sbagliata o limite GIORNALIERO esaurito: riprovare non cambierebbe nulla.
function isRetryable(err) {
  const s = err?.status
  if (s == null) return err?.name === 'TypeError' // fetch fallita: rete
  if (s === 429) return !/perday|per_day|daily/i.test(err.quotaId || '')
  return s >= 500
}

function wait(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms))
}

// Il modello risponde spesso 503 "overloaded" nelle ore di punta (e a volte
// la rete o il limite al minuto fanno cilecca): sono intoppi momentanei, non
// errori dell'utente, quindi si riprova da soli (vedi RETRY_DELAYS_MS) prima di
// arrendersi. `onRetry(attempt, maxAttempts)` (opzionale) avvisa
// chi ha in corso una UI di attesa (vedi GeminiWait) che si sta ritentando.
async function callGeminiParts(apiKey, parts, { onRetry } = {}) {
  return callGeminiTurns(apiKey, [{ role: 'user', parts }], { onRetry })
}

// Come callGeminiParts ma con una conversazione a più turni (usata per
// chiedere piccole correzioni su un output già ottenuto — vedi refineText).
async function callGeminiTurns(apiKey, contents, { onRetry } = {}) {
  let lastErr
  for (let attempt = 1; attempt <= OVERLOAD_MAX_ATTEMPTS; attempt++) {
    const model = await modelForAttempt(apiKey, attempt)
    try {
      return await callGeminiOnce(apiKey, contents, model)
    } catch (err) {
      lastErr = err
      const last = attempt === OVERLOAD_MAX_ATTEMPTS
      // Il modello di riserva non c'è o non risponde come previsto (404, 400...):
      // non è colpa dell'utente, si passa subito al tentativo dopo.
      if (model !== MODEL && !isRetryable(err) && !last) continue
      if (!isRetryable(err) || last) throw err
      onRetry?.(attempt, OVERLOAD_MAX_ATTEMPTS)
      await wait(RETRY_DELAYS_MS[attempt - 1])
    }
  }
  throw lastErr
}

// Quando il modello principale è sovraccarico (503) spesso un altro modello
// Gemini ha la coda libera. Dopo due tentativi falliti sul principale si
// provano fino a due modelli «flash» diversi, poi si torna al principale.
// L'elenco si chiede una volta sola a Google (models.list) invece di
// scrivere a mano nomi che possono essere ritirati.
const ATTEMPT_PLAN = [0, 0, 1, 2, 0] // 0 = principale, 1/2 = prima/seconda riserva
let fallbackPromise = null

function fallbackModels(apiKey) {
  if (!fallbackPromise) {
    fallbackPromise = fetch(
      `https://generativelanguage.googleapis.com/v1beta/models?pageSize=200&key=${encodeURIComponent(apiKey)}`,
    )
      .then((r) => (r.ok ? r.json() : { models: [] }))
      .then((d) =>
        (d.models || [])
          .filter((m) => (m.supportedGenerationMethods || []).includes('generateContent'))
          .map((m) => String(m.name || '').replace(/^models\//, ''))
          .filter(
            (n) =>
              /flash/i.test(n) &&
              n !== MODEL &&
              !/image|tts|audio|live|embed|robot|computer|thinking|exp|learnlm|gemma|preview/i.test(n),
          )
          .sort()
          .reverse()
          .slice(0, 2),
      )
      .catch(() => [])
  }
  return fallbackPromise
}

async function modelForAttempt(apiKey, attempt) {
  const slot = ATTEMPT_PLAN[attempt - 1] || 0
  if (!slot) return MODEL
  const list = await fallbackModels(apiKey)
  return list[slot - 1] || MODEL
}

async function callGemini(apiKey, prompt, opts) {
  return callGeminiParts(apiKey, [{ text: prompt }], opts)
}

// Verifica rapida della chiave (una richiesta minima).
export async function testGeminiKey(apiKey) {
  await callGemini(apiKey, 'Rispondi con la sola parola: ok.')
}


// Ripulisce/sintetizza il testo esistente di una nota, mantenendone i fatti.
// Restituisce anche `history`: la conversazione fin qui, da passare a
// refineText per chiedere piccole correzioni sul risultato.
export async function cleanupNoteText(apiKey, text, onRetry) {
  const prompt =
    "Ripulisci e sintetizza il seguente testo di una nota personale di diario, in italiano: correggi refusi e sgrammaticature, migliora la scorrevolezza, mantieni fatti, senso e tono originali. Non aggiungere informazioni non presenti nel testo. Rispondi SOLO con il testo finale della nota, senza titoli, virgolette o commenti.\n\nTesto:\n" +
    text
  const result = await callGemini(apiKey, prompt, { onRetry })
  return {
    text: result,
    history: [
      { role: 'user', parts: [{ text: prompt }] },
      { role: 'model', parts: [{ text: result }] },
    ],
  }
}

// Scrive un nuovo contenuto di nota a partire da indicazioni dell'utente.
export async function writeNoteText(apiKey, instructions, customInstructions = '', onRetry) {
  const prompt =
    'Scrivi il contenuto di una nota personale di diario in italiano, in prima persona, seguendo queste indicazioni. Rispondi SOLO con il testo della nota, senza titoli, virgolette o commenti.\n\n' +
    (customInstructions.trim()
      ? `Istruzioni fisse dell'utente su come scrivere le note (rispettale sempre, a meno che non contraddicano il formato richiesto sopra): ${customInstructions.trim()}\n\n`
      : '') +
    `Indicazioni:\n${instructions}`
  const result = await callGemini(apiKey, prompt, { onRetry })
  return {
    text: result,
    history: [
      { role: 'user', parts: [{ text: prompt }] },
      { role: 'model', parts: [{ text: result }] },
    ],
  }
}

// Chiede una piccola correzione su un testo già generato da cleanupNoteText/
// writeNoteText, mantenendo il contesto (indicazioni originali + risposta
// precedente) invece di ripartire da zero: `history` è quello restituito
// dalla chiamata precedente (o da un refineText precedente). Restituisce lo
// stesso { text, history }, con la correzione e la nuova risposta aggiunte
// in coda, così si può richiedere un'altra correzione sul risultato.
export async function refineText(apiKey, history, correction, onRetry) {
  const correctionPrompt =
    'Applica questa correzione al testo appena scritto, mantenendo lo stesso formato di risposta (SOLO il testo finale della nota, senza titoli, virgolette o commenti): ' +
    correction
  const contents = [...history, { role: 'user', parts: [{ text: correctionPrompt }] }]
  const result = await callGeminiTurns(apiKey, contents, { onRetry })
  return {
    text: result,
    history: [...contents, { role: 'model', parts: [{ text: result }] }],
  }
}

const TIME_RE = /^([01]\d|2[0-3]):([0-5]\d)$/

function toMinutes(hhmm) {
  const [h, m] = hhmm.split(':').map(Number)
  return h * 60 + m
}

// Genera una nota intera (titolo, contenuto, tag/persone tra quelli
// disponibili, luogo, mood e orario stimati) a partire da un prompt libero.
// La nota risultante va sempre rivista dall'utente prima di salvare: qui si
// crea solo una bozza.
export async function draftNoteFromPrompt(
  apiKey,
  prompt,
  { peopleNames = [], tagNames = [], customInstructions = '', onRetry } = {},
) {
  const instruction =
    'Da queste indicazioni scritte da un utente, prepara la bozza di una nota personale di diario in italiano, in prima persona. ' +
    'Rispondi SOLO con un oggetto JSON valido, senza testo prima o dopo, con esattamente questa forma:\n' +
    '{"title": string (breve, poche parole), ' +
    '"content": string (il testo della nota, ripulito e scorrevole, più lungo e articolato delle indicazioni), ' +
    `"tags": array di stringhe prese ESATTAMENTE dall'elenco ${JSON.stringify(tagNames)} se pertinenti, altrimenti [], ` +
    `"people": array di stringhe prese ESATTAMENTE dall'elenco ${JSON.stringify(peopleNames)} se pertinenti, altrimenti [], ` +
    '"place": string col nome del luogo se le indicazioni ne citano uno, altrimenti stringa vuota, ' +
    '"mood": numero tra 0 e 1 che stimi l\'umore raccontato (0 = pessima giornata, 0.5 = neutra, 1 = ottima giornata), dedotto dal tono e dai fatti del testo, ' +
    '"timeStart": stringa "HH:MM" (24 ore) con l\'orario di inizio più plausibile in base alle indicazioni (es. "colazione" ~ mattina presto, "cena" ~ sera); se non è deducibile usa "09:00", ' +
    '"timeEnd": stringa "HH:MM" con l\'orario di fine plausibile, successivo a timeStart di una durata ragionevole per quanto descritto; se non è deducibile usa "10:00"}\n\n' +
    (customInstructions.trim()
      ? `Istruzioni fisse dell'utente su come scrivere le note (rispettale sempre, a meno che non contraddicano il formato JSON richiesto sopra): ${customInstructions.trim()}\n\n`
      : '') +
    `Indicazioni dell'utente:\n${prompt}`
  const raw = await callGemini(apiKey, instruction, { onRetry })
  const match = raw.match(/\{[\s\S]*\}/)
  if (!match) throw new Error('Gemini non ha restituito un risultato valido.')
  let data
  try {
    data = JSON.parse(match[0])
  } catch {
    throw new Error('Gemini non ha restituito un risultato valido.')
  }

  const mood = Number(data.mood)
  let timeStart = TIME_RE.test(data.timeStart) ? data.timeStart : '09:00'
  let timeEnd = TIME_RE.test(data.timeEnd) ? data.timeEnd : '10:00'
  // Se Gemini restituisce un intervallo invertito o nullo, non fidarsi:
  // meglio l'intervallo di default che uno privo di senso.
  if (toMinutes(timeEnd) <= toMinutes(timeStart)) {
    timeStart = '09:00'
    timeEnd = '10:00'
  }

  return {
    title: typeof data.title === 'string' ? data.title.trim() : '',
    content: typeof data.content === 'string' ? data.content.trim() : '',
    tags: Array.isArray(data.tags) ? data.tags.filter((x) => typeof x === 'string') : [],
    people: Array.isArray(data.people)
      ? data.people.filter((x) => typeof x === 'string')
      : [],
    place: typeof data.place === 'string' ? data.place.trim() : '',
    mood: Number.isFinite(mood) ? Math.min(1, Math.max(0, mood)) : 0.5,
    timeStart,
    timeEnd,
  }
}

// Normalizza/valida una nota estratta da Gemini (schermata di import).
export function normalizeExtractedNote(n) {
  if (!n || typeof n !== 'object') return null
  const dateOk = typeof n.date === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(n.date)
  const mood = Number(n.mood)
  const asName = (x) => (typeof x === 'string' ? x.trim() : '')
  return {
    date: dateOk ? n.date : '',
    title: asName(n.title),
    content: asName(n.content),
    mood: Number.isFinite(mood) ? Math.min(1, Math.max(0, mood)) : 0.5,
    timeStart: TIME_RE.test(n.timeStart) ? n.timeStart : '',
    timeEnd: TIME_RE.test(n.timeEnd) ? n.timeEnd : '',
    people: Array.isArray(n.people) ? n.people.map(asName).filter(Boolean) : [],
    place: asName(n.place),
    tags: Array.isArray(n.tags) ? n.tags.map(asName).filter(Boolean) : [],
  }
}

// Estrae una o più note da uno screenshot di un vecchio diario tenuto su un
// foglio di calcolo (una riga = un giorno; nella cella di testo più attività
// con orari; un voto di umore 0–100 per riga). Ogni blocco coerente di
// attività diventa una nota separata, da rivedere prima di salvare.
export async function extractNotesFromImage(
  apiKey,
  { imageBase64, mimeType, year, month, peopleNames = [], tagNames = [], onRetry },
) {
  const ref = `${MONTHS_IT[month]} ${year}`
  const instruction =
    "L'immagine è lo screenshot di un vecchio diario tenuto su un foglio di calcolo. " +
    'Ogni RIGA è un giorno e contiene: la lettera del giorno della settimana, il numero del giorno del mese, ' +
    'una cella di testo con righe che iniziano con un orario tipo "04.30" o "17.00 ~", ' +
    'a volte un titolo in una colonna a parte, un voto di umore da 0 a 100, a volte una foto. ' +
    `Il mese di riferimento è ${ref}. ` +
    'Converti OGNI giornata in UNA O PIÙ note separate: raggruppa le righe della cella di testo per attività/blocco ' +
    'coerente (per argomento e continuità di orario) e crea una nota per ciascun blocco. ' +
    'Rispondi SOLO con un array JSON valido, senza testo prima o dopo. Ogni elemento con ESATTAMENTE questi campi: ' +
    '{"date": "YYYY-MM-DD" (mese e anno di riferimento + il numero del giorno della riga), ' +
    '"title": stringa breve (se la riga ha un titolo usalo per il blocco principale, altrimenti sintetizzane uno), ' +
    '"content": stringa col testo del blocco, ripulito ma mantenendo la sequenza oraria (righe "HH.MM ~ ..."), ' +
    '"mood": numero tra 0 e 1 = voto della riga diviso 100; se manca usa 0.5, ' +
    '"timeStart": "HH:MM" dal primo orario del blocco, o "" se assente, ' +
    '"timeEnd": "HH:MM" dall\'ultimo orario del blocco, o "" se assente, ' +
    `"people": array di nomi di persona citati nel blocco; usa ESATTAMENTE i nomi dell'elenco ${JSON.stringify(peopleNames)} quando corrispondono, aggiungi gli altri nomi propri chiaramente citati, ` +
    '"place": stringa col nome del luogo se chiaro dal testo, altrimenti "", ' +
    `"tags": array preso ESATTAMENTE dall'elenco ${JSON.stringify(tagNames)} se pertinente, altrimenti []}. ` +
    'Se una giornata non ha testo, restituisci comunque una nota con "content" vuoto e il mood della riga. ' +
    'Ordina le note per data e orario.'
  const raw = await callGeminiParts(
    apiKey,
    [{ text: instruction }, { inlineData: { mimeType, data: imageBase64 } }],
    { onRetry },
  )
  const match = raw.match(/\[[\s\S]*\]/)
  if (!match) throw new Error('Gemini non ha restituito un risultato valido.')
  let arr
  try {
    arr = JSON.parse(match[0])
  } catch {
    throw new Error('Gemini non ha restituito un risultato valido.')
  }
  if (!Array.isArray(arr)) return []
  return arr.map(normalizeExtractedNote).filter(Boolean)
}

const padTime = (t) => {
  const m = String(t ?? '').match(/^(\d{1,2}):(\d{2})$/)
  return m ? `${String(m[1]).padStart(2, '0')}:${m[2]}` : ''
}

// Avvisi non bloccanti su un blocco: servono solo a guidare la revisione.
function segmentFlags(seg, total) {
  const flags = []
  if (total > 5) flags.push('Molti blocchi in un giorno')
  if (seg.content.trim().length < 40) flags.push('Blocco molto corto')
  if (seg.content.trim() && !timesInText(seg.content).length)
    flags.push('Nessun orario nel blocco')
  if (seg.timeStart && seg.timeEnd && seg.timeEnd < seg.timeStart)
    flags.push('Fine prima dell’inizio')
  return flags
}

// Ricompone i blocchi proposti da Gemini in una PARTIZIONE del giorno: dei
// suoi dati si tengono solo i punti di taglio (startLine) e i metadati; gli
// intervalli vengono ricostruiti qui così da coprire OGNI riga non vuota
// esattamente una volta, in ordine, senza buchi né sovrapposizioni. Il testo
// di ogni nota è preso ALLA LETTERA dalle righe originali: Gemini non lo
// riscrive, quindi non può inventare né perdere contenuto. Sovra/sotto-
// segmentazione restano recuperabili in revisione con Fondi / Spezza.
function partitionDay({ segs, lines, nonEmpty, dateKey, defaultMood }) {
  const firstIdx = nonEmpty[0]
  const lastIdx = nonEmpty[nonEmpty.length - 1]

  const cuts = []
  for (const s of segs) {
    const c = Number(s?.startLine)
    if (Number.isInteger(c) && c > firstIdx && c <= lastIdx && !cuts.includes(c))
      cuts.push(c)
  }
  cuts.sort((a, b) => a - b)

  const starts = [firstIdx, ...cuts]
  const bySeg = [...segs].sort(
    (a, b) => (Number(a?.startLine) || 0) - (Number(b?.startLine) || 0),
  )

  const raw = starts.map((start, k) => {
    const end = k + 1 < starts.length ? starts[k + 1] - 1 : lastIdx
    const meta = bySeg[k] || bySeg[bySeg.length - 1] || {}
    const content = lines
      .slice(start, end + 1)
      .join('\n')
      .replace(/^\s+|\s+$/g, '')
    const times = timesInText(content)
    const moodNum = Number(meta.mood)
    return {
      ...normalizeExtractedNote({
        date: dateKey,
        title: typeof meta.title === 'string' ? meta.title : '',
        content,
        mood: Number.isFinite(moodNum) ? clamp01(moodNum) : defaultMood,
        timeStart: padTime(meta.timeStart) || times[0] || '',
        timeEnd: padTime(meta.timeEnd) || times[times.length - 1] || '',
        people: Array.isArray(meta.people) ? meta.people : [],
        place: typeof meta.place === 'string' ? meta.place : '',
        tags: Array.isArray(meta.tags) ? meta.tags : [],
      }),
      sourceStart: start,
      sourceEnd: end,
    }
  })

  // Blocchi risultati vuoti (solo righe bianche tra due tagli) → fusi col
  // precedente, così la copertura resta completa.
  const merged = []
  for (const seg of raw) {
    if (!seg.content.trim() && merged.length) {
      merged[merged.length - 1].sourceEnd = seg.sourceEnd
      continue
    }
    merged.push(seg)
  }
  return merged.map((seg) => ({ ...seg, flags: segmentFlags(seg, merged.length) }))
}

// Segmenta il testo di UNA giornata del vecchio diario (una cella del foglio
// Google) in una o più note da rivedere una a una. Gemini indica SOLO dove
// tagliare — vedi partitionDay. Qualunque cosa risponda, il risultato copre
// sempre il 100% del testo del giorno.
export async function segmentDayIntoNotes(
  apiKey,
  {
    dateKey,
    rawText,
    sheetTitle = '',
    moodScore = null,
    peopleNames = [],
    tagNames = [],
    onRetry,
  },
) {
  const lines = String(rawText ?? '')
    .replace(/\r\n/g, '\n')
    .split('\n')
  const nonEmpty = []
  lines.forEach((l, i) => {
    if (l.trim()) nonEmpty.push(i)
  })
  const defaultMood = moodScore != null ? clamp01(moodScore / 100) : 0.5

  if (!nonEmpty.length) {
    return [
      {
        ...normalizeExtractedNote({
          date: dateKey,
          title: sheetTitle,
          content: '',
          mood: defaultMood,
          timeStart: '',
          timeEnd: '',
          people: [],
          place: '',
          tags: [],
        }),
        sourceStart: null,
        sourceEnd: null,
        flags: ['Giornata senza testo'],
      },
    ]
  }

  const numbered = lines.map((l, i) => `${i}\t${l}`).join('\n')
  const instruction =
    'Questo è il testo di UNA giornata di un vecchio diario personale: una riga per attività, ' +
    'molte iniziano con un orario tipo "09.00" o "17.00 ~". Le righe sono NUMERATE come "indice<TAB>testo". ' +
    'Dividi la giornata in uno o più BLOCCHI coerenti: stesso argomento e continuità di orario stanno insieme. ' +
    'NON riscrivere il testo: indica solo dove iniziano i blocchi. ' +
    'Sii CONSERVATIVO: nel dubbio un blocco solo; una giornata tranquilla resta un blocco unico. ' +
    'Taglia solo quando cambiano SIA argomento SIA fascia oraria, oppure quando una riga è chiaramente un evento a sé con un titolo proprio. ' +
    'Rispondi SOLO con un array JSON valido, senza testo prima o dopo. Ogni elemento con ESATTAMENTE questi campi: ' +
    '{"startLine": numero (indice della prima riga del blocco; il primo blocco parte dalla prima riga non vuota), ' +
    '"title": stringa breve' +
    (sheetTitle
      ? ` (per il blocco principale puoi usare "${sheetTitle.replace(/"/g, "'")}")`
      : '') +
    ', ' +
    `"mood": numero tra 0 e 1; se non hai indizi usa ${defaultMood.toFixed(2)}, ` +
    '"timeStart": "HH:MM" dal primo orario del blocco, o "" se assente, ' +
    '"timeEnd": "HH:MM" dall\'ultimo orario del blocco, o "" se assente, ' +
    `"people": array di nomi di persona citati nel blocco; usa ESATTAMENTE i nomi dell'elenco ${JSON.stringify(peopleNames)} quando corrispondono, aggiungi gli altri nomi propri chiaramente citati, ` +
    '"place": stringa col nome del luogo se chiaro dal testo, altrimenti "", ' +
    `"tags": array preso ESATTAMENTE dall'elenco ${JSON.stringify(tagNames)} se pertinente, altrimenti []}. ` +
    'Ordina i blocchi per startLine.\n\n' +
    `Data: ${dateKey}\n\nTesto:\n${numbered}`

  const out = await callGemini(apiKey, instruction, { onRetry })
  const match = out.match(/\[[\s\S]*\]/)
  let segs = []
  if (match) {
    try {
      const parsed = JSON.parse(match[0])
      if (Array.isArray(parsed)) segs = parsed
    } catch {
      segs = []
    }
  }
  if (!segs.length) {
    // Nessuna risposta utile: un blocco unico con tutta la giornata.
    segs = [{ startLine: nonEmpty[0], title: sheetTitle, mood: defaultMood }]
  }
  return partitionDay({ segs, lines, nonEmpty, dateKey, defaultMood })
}

// Recap di un periodo: poche frasi che riassumono un insieme di note.
export async function recapNotes(
  apiKey,
  notes,
  { label = '', onRetry, customInstructions = '' } = {},
) {
  if (!notes || !notes.length) throw new Error('Nessuna nota nel periodo.')
  const rows = [...notes]
    .sort((a, b) => (a.date < b.date ? -1 : a.date > b.date ? 1 : 0))
    .map((n) => {
      const d = dayKey(n.date)
      const mood = Math.round(Number(n.mood) * 100)
      const title = (n.title || '').trim()
      const body = plainText(n.content).replace(/\s+/g, ' ').slice(0, 240)
      return `${d} [${mood}] ${title}${body ? ' — ' + body : ''}`
    })
  const prompt =
    recapInstructionsPrefix(customInstructions) +
    `Queste sono le note di diario ${label ? 'del ' + label : 'di un periodo'} ` +
    '(formato: data [mood 0-100] titolo — estratto). ' +
    'Scrivi un recap personale in italiano, rivolto a chi le ha scritte ("hai…", "ti…"), ' +
    "di 4-6 frasi: temi ricorrenti, persone e luoghi che tornano, andamento dell'umore nel " +
    'tempo, due o tre momenti salienti. Tono caldo e sintetico. Rispondi SOLO con il recap, ' +
    'senza titolo né elenchi puntati.\n\n' +
    rows.join('\n')
  return callGemini(apiKey, prompt, { onRetry })
}

// Recap di UN giorno (più breve di recapNotes, pensato per period): usato dal
// tasto "Genera"/"Rigenera" sul recap giornaliero (src/lib/recaps.js). Lo
// stesso testo, con lo stesso stile, lo scrive anche il cron notturno lato
// server (pb_hooks/main.pb.js) — qui è la versione richiamabile a mano.
export async function dayRecap(apiKey, notes, onRetry, customInstructions = '') {
  if (!notes || !notes.length) throw new Error('Nessuna nota in questo giorno.')
  const rows = notes.map((n) => {
    const mood = Math.round(Number(n.mood) * 100)
    const title = (n.title || '').trim()
    const body = plainText(n.content).replace(/\s+/g, ' ').slice(0, 240)
    return `[${mood}] ${title}${body ? ' — ' + body : ''}`
  })
  const prompt =
    recapInstructionsPrefix(customInstructions) +
    'Queste sono le note di diario scritte in un solo giorno (formato: [mood 0-100] titolo — estratto). ' +
    'Scrivi un breve recap personale in italiano, rivolto a chi le ha scritte ("hai…", "ti…"), di 2-4 frasi: ' +
    'cosa è successo, persone e luoghi citati, il tono della giornata. Tono caldo, diretto. ' +
    'Rispondi SOLO col testo del recap, senza titolo né elenchi puntati.\n\n' +
    rows.join('\n')
  return callGemini(apiKey, prompt, { onRetry })
}

// Trascrive un vocale registrato nell'app (invece di affidarsi al dettato
// dello smartphone, spesso impreciso): Gemini capisce l'audio direttamente,
// senza bisogno di un servizio di trascrizione separato. Pensato per essere
// incollato/aggiunto al testo di un prompt scritto a voce, quindi risponde
// con la sola trascrizione, pulita da balbettii ed esitazioni ma senza
// riformulare il contenuto.
export async function transcribeAudio(apiKey, { audioBase64, mimeType }, onRetry) {
  const instruction =
    'Trascrivi fedelmente questo messaggio vocale in italiano. Correggi solo balbettii, ' +
    'esitazioni ("ehm", ripetizioni) e la punteggiatura; non riassumere, non aggiungere e non ' +
    'togliere contenuto. Rispondi SOLO con la trascrizione, senza commenti.'
  return callGeminiParts(
    apiKey,
    [{ text: instruction }, { inlineData: { mimeType, data: audioBase64 } }],
    { onRetry },
  )
}

// Trascrizione con Groq (Whisper): veloce e quasi mai intasata. Si usa prima di
// Gemini quando l'utente ha messo la chiave Groq in Impostazioni; se fallisce
// si ripiega su Gemini (vedi VoiceRecordButton).
const GROQ_URL = 'https://api.groq.com/openai/v1/audio/transcriptions'
const GROQ_MODEL = 'whisper-large-v3-turbo'

function groqExt(mimeType = '') {
  if (/mp4|m4a|aac/i.test(mimeType)) return 'm4a'
  if (/ogg/i.test(mimeType)) return 'ogg'
  if (/wav/i.test(mimeType)) return 'wav'
  if (/mpeg|mp3/i.test(mimeType)) return 'mp3'
  return 'webm'
}

export async function transcribeWithGroq(groqKey, blob, mimeType) {
  let lastErr
  for (let attempt = 1; attempt <= 2; attempt++) {
    try {
      const form = new FormData()
      form.append('file', new File([blob], `voce.${groqExt(mimeType)}`, { type: mimeType || blob.type }))
      form.append('model', GROQ_MODEL)
      form.append('language', 'it')
      form.append('response_format', 'text')
      form.append('temperature', '0')
      const res = await fetch(GROQ_URL, {
        method: 'POST',
        headers: { Authorization: `Bearer ${groqKey}` },
        body: form,
      })
      const body = await res.text()
      if (!res.ok) {
        let detail = ''
        try {
          detail = JSON.parse(body)?.error?.message || ''
        } catch {
          detail = body.slice(0, 200)
        }
        const err = new Error(detail || 'Richiesta a Groq non riuscita.')
        err.status = res.status
        throw err
      }
      const text = body.trim()
      if (!text) throw new Error('Groq non ha restituito testo.')
      return text
    } catch (err) {
      err.provider = 'groq'
      lastErr = err
      const retry = err.status == null ? err.name === 'TypeError' : err.status === 429 || err.status >= 500
      if (!retry || attempt === 2) throw err
      await wait(2000)
    }
  }
  throw lastErr
}

// Verifica della chiave Groq (elenco modelli: nessun consumo di audio).
export async function testGroqKey(groqKey) {
  try {
    const res = await fetch('https://api.groq.com/openai/v1/models', {
      headers: { Authorization: `Bearer ${groqKey}` },
    })
    if (!res.ok) {
      const err = new Error('Richiesta a Groq non riuscita.')
      err.status = res.status
      throw err
    }
  } catch (err) {
    err.provider = 'groq'
    throw err
  }
}

function describeGroqError(err) {
  if (err.status === 401 || err.status === 403) return 'Chiave API Groq non valida.'
  if (err.status === 429) return 'Limite di richieste Groq raggiunto, riprova tra poco.'
  if (err.status >= 500) return 'Il server Groq non risponde, riprova tra poco.'
  if (err.status) return `Errore Groq (${err.status}): ${err.message}`
  if (err.name === 'TypeError') return 'Impossibile raggiungere Groq (rete).'
  return err.message || String(err)
}

export function describeGeminiError(err) {
  if (!err) return 'Errore sconosciuto.'
  if (err.provider === 'groq') return describeGroqError(err)
  if (err.status === 400 || err.status === 403) return 'Chiave API Gemini non valida.'
  if (err.status === 429) {
    // limite GIORNALIERO: inutile riprovare tra poco
    if (/perday|per_day|daily/i.test(err.quotaId || '')) {
      return 'Hai esaurito le richieste giornaliere di Gemini per questa chiave. Si azzerano a mezzanotte (ora del Pacifico, di solito verso le 9 in Italia): fino ad allora non posso trascrivere o generare. Il vocale è salvato sul dispositivo: potrai ritrascriverlo più tardi.'
    }
    const s = err.retryDelaySeconds
    if (s != null) {
      const label =
        s >= 60
          ? `${Math.ceil(s / 60)} minut${Math.ceil(s / 60) === 1 ? 'o' : 'i'}`
          : `${s} second${s === 1 ? 'o' : 'i'}`
      return `Limite di richieste Gemini raggiunto, riprova tra circa ${label}.`
    }
    return 'Limite di richieste Gemini raggiunto, riprova tra poco (di solito entro un minuto).'
  }
  if (err.status >= 500)
    return 'Il server Gemini è sovraccarico. Effettuati 5 tentativi senza successo, riprova tra poco.'
  if (err.status) return `Errore Gemini (${err.status}): ${err.message}`
  if (err.name === 'TypeError') return 'Impossibile raggiungere Gemini (rete).'
  return err.message || String(err)
}
