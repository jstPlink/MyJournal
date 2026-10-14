// Logica dei recap automatici (giorno/mese/anno) — vedi il commento in cima
// a main.pb.js per il quadro generale.
//
// Vive in un modulo CommonJS a parte (invece che nello stesso file degli
// hook) per un vincolo del JSVM di PocketBase: ogni handler di hook/cron
// gira "serializzato" in un contesto isolato — non vede funzioni definite
// altrove nello stesso file, nemmeno nello stesso main.pb.js (fallisce con
// "X is not defined" al primo utilizzo). L'unico modo per condividere
// codice fra handler diversi è un require() di un modulo come questo,
// dentro ciascun handler — vedi https://pocketbase.io/docs/js-overview/
// ("Sharing code" / require). Le funzioni qui sotto sono tutte senza stato
// (nessuna variabile condivisa mutabile), come richiesto da quella pagina.

const GEMINI_MODEL = 'gemini-3.6-flash' // in sync con MODEL in src/lib/gemini.js
const RETRY_DELAY_MS = 10000

function transientError() {
  const e = new Error('Gemini non risponde ora (errore transitorio)')
  e.transient = true
  return e
}

function isRetryableStatus(status) {
  return status === 0 || status === 429 || (status >= 500 && status < 600)
}

// Una singola chiamata testuale a Gemini, con riprovi automatici sugli
// intoppi transitori: ogni 10 secondi finché non arriva un risultato, senza
// bisogno di nessuna revisione. Una chiave non valida (400/401/403) non è
// transitoria: lì ci si ferma subito, non ha senso riprovare all'infinito.
// `maxAttempts` (opzionale) limita i tentativi: il blocco delle 23:00
// (runRecapBatch) ne usa pochi e, se non riesce, lascia i recap in coda per i
// ritentativi di 23:20 e 23:40 invece di tenere occupato il cron. `jsonMode`
// chiede a Gemini una risposta JSON (usata dalla richiesta unica di generateBatch).
function callGeminiText(apiKey, promptText, maxAttempts, jsonMode) {
  const url =
    'https://generativelanguage.googleapis.com/v1beta/models/' +
    GEMINI_MODEL +
    ':generateContent?key=' +
    encodeURIComponent(apiKey)
  let attempt = 0
  for (;;) {
    attempt++
    let res
    try {
      res = $http.send({
        method: 'POST',
        url: url,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(
          jsonMode
            ? {
                contents: [{ parts: [{ text: promptText }] }],
                generationConfig: { responseMimeType: 'application/json' },
              }
            : { contents: [{ parts: [{ text: promptText }] }] },
        ),
      })
    } catch (err) {
      console.log('[recap] rete non raggiungibile (tentativo ' + attempt + '), riprovo tra 10s: ' + err)
      if (maxAttempts && attempt >= maxAttempts) throw transientError()
      sleep(RETRY_DELAY_MS)
      continue
    }
    if (res.statusCode === 200) {
      const candidates = (res.json && res.json.candidates) || []
      const parts = (candidates[0] && candidates[0].content && candidates[0].content.parts) || []
      let text = ''
      for (const p of parts) text += p.text || ''
      text = text.trim()
      if (text) return text
      console.log('[recap] risposta vuota da Gemini (tentativo ' + attempt + '), riprovo tra 10s')
      if (maxAttempts && attempt >= maxAttempts) throw transientError()
      sleep(RETRY_DELAY_MS)
      continue
    }
    if (res.statusCode === 400 || res.statusCode === 401 || res.statusCode === 403) {
      throw new Error('Chiave API Gemini non valida (status ' + res.statusCode + ')')
    }
    if (isRetryableStatus(res.statusCode)) {
      console.log('[recap] Gemini ' + res.statusCode + ' (tentativo ' + attempt + '), riprovo tra 10s')
      if (maxAttempts && attempt >= maxAttempts) throw transientError()
      sleep(RETRY_DELAY_MS)
      continue
    }
    throw new Error('Errore Gemini ' + res.statusCode + ': ' + res.raw)
  }
}

// ---- tentativo "dopo 30 minuti dall'ultima modifica" ----
//
// Mezz'ora dopo l'ultima modifica a una nota (e solo se nel frattempo non ce
// ne sono state altre) un cron prova a scrivere subito i recap segnati, usando
// TUTTI i modelli attivi nell'app: Gemini principale (due volte), le due riserve
// «flash» che Google elenca per la chiave dell'utente e, se l'utente ha messo la
// chiave Groq, Groq come ultima spiaggia: gli stessi cinque tentativi, con le
// stesse attese (3, 5, 7 e 9 s), dei pannelli dell'app (ATTEMPT_PLAN in
// src/lib/gemini.js). Se nessuno risponde i recap restano in coda e li prende il
// giro delle 23:00.

const PLAN_DELAYS_MS = [3000, 5000, 7000, 9000]
const GROQ_TEXT_MODEL = 'llama-3.3-70b-versatile'

function groqApiKeyFor(app, userId) {
  try {
    const key = (app.findRecordById('users', userId).get('groqApiKey') || '').trim()
    return key || null
  } catch {
    return null
  }
}

// Riserve Gemini: i primi due modelli «flash» diversi dal principale, come nell'app.
function fallbackGeminiModels(apiKey) {
  try {
    const res = $http.send({
      method: 'GET',
      url: 'https://generativelanguage.googleapis.com/v1beta/models?pageSize=200&key=' + encodeURIComponent(apiKey),
    })
    if (res.statusCode !== 200) return []
    const out = []
    for (const m of (res.json && res.json.models) || []) {
      if (!(m.supportedGenerationMethods || []).includes('generateContent')) continue
      const name = String(m.name || '').replace(/^models\//, '')
      if (!/flash/i.test(name) || name === GEMINI_MODEL) continue
      if (/image|tts|audio|live|embed|robot|computer|thinking|exp|learnlm|gemma|preview/i.test(name)) continue
      out.push(name)
    }
    return out.sort().reverse().slice(0, 2)
  } catch {
    return []
  }
}

function buildModelPlan(app, userId, apiKey) {
  const fb = fallbackGeminiModels(apiKey)
  const plan = [
    { provider: 'gemini', model: GEMINI_MODEL },
    { provider: 'gemini', model: GEMINI_MODEL },
    { provider: 'gemini', model: fb[0] || GEMINI_MODEL },
    { provider: 'gemini', model: fb[1] || GEMINI_MODEL },
    { provider: 'gemini', model: GEMINI_MODEL },
  ]
  if (groqApiKeyFor(app, userId)) plan[4] = { provider: 'groq', model: GROQ_TEXT_MODEL }
  return plan
}

// Un tentativo con un passo del piano: ritorna {text} oppure {status}.
function callPlanStep(step, keys, promptText, jsonMode) {
  try {
    let res
    if (step.provider === 'groq') {
      const body = { model: step.model, messages: [{ role: 'user', content: promptText }] }
      if (jsonMode) body.response_format = { type: 'json_object' }
      res = $http.send({
        method: 'POST',
        url: 'https://api.groq.com/openai/v1/chat/completions',
        headers: { 'Content-Type': 'application/json', Authorization: 'Bearer ' + keys.groq },
        body: JSON.stringify(body),
      })
      if (res.statusCode === 200) {
        const choice = (res.json && res.json.choices && res.json.choices[0]) || {}
        const text = String((choice.message && choice.message.content) || '').trim()
        return text ? { text: text } : { status: 0 }
      }
      return { status: res.statusCode }
    }
    res = $http.send({
      method: 'POST',
      url:
        'https://generativelanguage.googleapis.com/v1beta/models/' +
        step.model +
        ':generateContent?key=' +
        encodeURIComponent(keys.gemini),
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(
        jsonMode
          ? { contents: [{ parts: [{ text: promptText }] }], generationConfig: { responseMimeType: 'application/json' } }
          : { contents: [{ parts: [{ text: promptText }] }] },
      ),
    })
    if (res.statusCode === 200) {
      const candidates = (res.json && res.json.candidates) || []
      const parts = (candidates[0] && candidates[0].content && candidates[0].content.parts) || []
      let text = ''
      for (const p of parts) text += p.text || ''
      text = text.trim()
      return text ? { text: text } : { status: 0 }
    }
    return { status: res.statusCode }
  } catch (err) {
    console.log('[recap] ' + step.provider + ' ' + step.model + ' non raggiungibile: ' + err)
    return { status: 0 }
  }
}

// Prova i passi del piano uno dopo l'altro (attese di PLAN_DELAYS_MS). Chiave
// Gemini non valida sul principale = errore definitivo; sugli altri modelli un
// rifiuto (404, 400...) vuol dire solo "questo modello non c'è": si passa oltre.
function callTextPlan(plan, keys, promptText, jsonMode) {
  for (let i = 0; i < plan.length; i++) {
    const step = plan[i]
    const r = callPlanStep(step, keys, promptText, jsonMode)
    if (r.text) {
      console.log('[recap] riuscito con ' + step.provider + ' ' + step.model + ' (tentativo ' + (i + 1) + ')')
      return r.text
    }
    if (step.provider === 'gemini' && step.model === GEMINI_MODEL && (r.status === 400 || r.status === 401 || r.status === 403)) {
      throw new Error('Chiave API Gemini non valida (status ' + r.status + ')')
    }
    console.log('[recap] ' + step.provider + ' ' + step.model + ' tentativo ' + (i + 1) + ': status ' + r.status)
    if (i < plan.length - 1) sleep(PLAN_DELAYS_MS[Math.min(i, PLAN_DELAYS_MS.length - 1)])
  }
  throw transientError()
}

// ---- date "a orologio da muro", come src/lib/dates.js: niente fuso, si
// leggono/scrivono le cifre così come sono. ----

function pad2(n) {
  return n < 10 ? '0' + n : '' + n
}
function dayKeyOf(value) {
  return String(value || '').slice(0, 10)
}
function monthKeyOf(dKey) {
  return dKey.slice(0, 7)
}
function yearOf(mKey) {
  return mKey.slice(0, 4)
}
function dayRangeFilter(dKey) {
  return { start: dKey + ' 00:00:00.000Z', end: dKey + ' 23:59:59.999Z' }
}
function monthRangeFilter(mKey) {
  const p = mKey.split('-')
  const lastDay = new Date(Number(p[0]), Number(p[1]), 0).getDate()
  return { start: mKey + '-01 00:00:00.000Z', end: mKey + '-' + pad2(lastDay) + ' 23:59:59.999Z' }
}
function yearRangeFilter(year) {
  return { start: year + '-01-01 00:00:00.000Z', end: year + '-12-31 23:59:59.999Z' }
}

// ---- lettura/scrittura recap + note ----

function geminiApiKeyFor(app, userId) {
  try {
    const key = (app.findRecordById('users', userId).get('geminiApiKey') || '').trim()
    return key || null
  } catch {
    return null
  }
}

// Istruzioni fisse dell'utente per i riassunti (campo recapCustomInstructions,
// Impostazioni → Gemini): prefisso del prompt, vuoto se assenti.
const DEFAULT_RECAP_INSTRUCTIONS = [
  'Write the summaries based on the title and the content, the mood, the places visited and the people met.',
  'Write the text in the first person, as if you had lived the experience yourself.',
  'When choosing what to include in the summary, give more weight to the notes with the most extreme moods, whether the lowest or the highest.',
  "Don't add too many adjectives or words of your own; try to use the words already present, at most paraphrase or combine concepts.",
  'Split the recaps into paragraphs so they are easier to read.',
  'For daily summaries use 80 words.\nFor monthly summaries use 110 words.\nFor yearly summaries use 140 words.',
].join('\n\n')

function recapInstructionsFor(app, userId) {
  try {
    const t = (app.findRecordById('users', userId).get('recapCustomInstructions') || '').trim() || DEFAULT_RECAP_INSTRUCTIONS
    return t
      ? "Istruzioni fisse dell'utente su come scrivere i riassunti (rispettale sempre, a meno che non contraddicano il formato richiesto sotto): " +
          t +
          '\n\n'
      : ''
  } catch {
    return ''
  }
}

function findRecap(app, userId, period, key) {
  try {
    return app.findFirstRecordByFilter(
      'recaps',
      'user = {:user} && period = {:period} && key = {:key}',
      { user: userId, period: period, key: key },
    )
  } catch {
    return null
  }
}

function saveRecap(app, userId, period, key, text) {
  let record = findRecap(app, userId, period, key)
  if (!record) {
    record = new Record(app.findCollectionByNameOrId('recaps'))
    record.set('user', userId)
    record.set('period', period)
    record.set('key', key)
  }
  record.set('text', text)
  app.save(record)
  return record
}

function deleteRecapIfExists(app, userId, period, key) {
  const rec = findRecap(app, userId, period, key)
  if (rec) app.delete(rec)
}

function notesForUserInRange(app, userId, range) {
  try {
    return app.findRecordsByFilter(
      'note',
      'user = {:user} && date >= {:start} && date <= {:end}',
      'timeStart',
      500,
      0,
      { user: userId, start: range.start, end: range.end },
    )
  } catch {
    return []
  }
}

// Il contenuto è HTML dall'editor rich text: via i tag, resta solo il testo.
function plainExcerpt(html, max) {
  return String(html || '')
    .replace(/<[^>]*>/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()
    .slice(0, max)
}

function placeNameOf(rec) {
  const raw = String(rec.get('place') || '').trim()
  if (!raw) return ''
  try {
    const p = JSON.parse(raw)
    return String((p && p.name) || '').trim()
  } catch {
    return raw
  }
}

function peopleNamesOf(app, rec) {
  try {
    const ids = rec.get('people') || []
    if (!ids.length) return []
    return app.findRecordsByIds('people', ids).map((r) => String(r.get('name') || '').trim()).filter(Boolean)
  } catch {
    return []
  }
}

function noteLine(rec, app) {
  const mood = Math.round(Number(rec.get('mood')) * 100)
  const title = (rec.get('title') || '').trim()
  const excerpt = plainExcerpt(rec.get('content'), 240)
  const place = placeNameOf(rec)
  const people = app ? peopleNamesOf(app, rec) : []
  const extra = (place ? ' (luogo: ' + place + ')' : '') + (people.length ? ' (persone: ' + people.join(', ') + ')' : '')
  return '[' + (isFinite(mood) ? mood : 50) + '] ' + title + extra + (excerpt ? ' — ' + excerpt : '')
}

// ---- generazione in blocco: UNA richiesta a Gemini per utente ----
//
// Alle 23:00 tutti i recap segnati da aggiornare (giorni, mesi, anni) di un
// utente si chiedono a Gemini in UNA sola richiesta, che risponde con un
// oggetto JSON {days, months, years}: una richiesta al posto di una per ogni
// recap, così si risparmiano le richieste giornaliere della chiave. I livelli
// dipendono l'uno dall'altro (il mese si basa sui recap dei giorni, l'anno su
// quelli dei mesi): nel prompt si chiede di scrivere prima i giorni, poi i mesi
// usando i giorni appena scritti, poi gli anni. Se i giorni da fare sono troppi
// per una risposta sola (> MAX_DAYS_PER_REQUEST, es. dopo molte modifiche
// accumulate) si dividono in più richieste, poi una per mesi e anni.

const MAX_DAYS_PER_REQUEST = 25
const MAX_RAW_LINES = 300 // note grezze passate per un mese/anno senza recap inferiori

function jsonFromText(text) {
  try {
    return JSON.parse(text)
  } catch {
    const m = String(text).match(/\{[\s\S]*\}/)
    if (m) {
      try {
        return JSON.parse(m[0])
      } catch {
        return null
      }
    }
    return null
  }
}

function dayRecapsForMonth(app, userId, monthKey) {
  try {
    return app.findRecordsByFilter(
      'recaps',
      "user = {:user} && period = 'day' && key >= {:start} && key <= {:end}",
      'key',
      31,
      0,
      { user: userId, start: monthKey + '-01', end: monthKey + '-31' },
    )
  } catch {
    return []
  }
}

function monthRecapsForYear(app, userId, year) {
  try {
    return app.findRecordsByFilter(
      'recaps',
      "user = {:user} && period = 'month' && key >= {:start} && key <= {:end}",
      'key',
      12,
      0,
      { user: userId, start: year + '-01', end: year + '-12' },
    )
  } catch {
    return []
  }
}

function rawNoteRows(app, userId, range) {
  return notesForUserInRange(app, userId, range)
    .slice(0, MAX_RAW_LINES)
    .map((r) => dayKeyOf(r.get('date')) + ' ' + noteLine(r, app))
}

// Sezione del prompt per un mese; null se il mese non ha niente da riassumere.
function monthSection(app, userId, mKey, writtenDays) {
  const existing = dayRecapsForMonth(app, userId, mKey).filter((r) => !writtenDays[r.get('key')])
  const rewritten = Object.keys(writtenDays).filter((k) => monthKeyOf(k) === mKey)
  let body = ''
  if (existing.length) {
    body += 'Recap giornalieri già esistenti:\n' + existing.map((r) => r.get('key') + ': ' + r.get('text')).join('\n') + '\n'
  }
  if (rewritten.length) {
    body += 'Giorni riscritti in questa stessa richiesta (usa i recap che scrivi nella sezione GIORNI): ' + rewritten.join(', ') + '\n'
  }
  if (!existing.length && !rewritten.length) {
    const rows = rawNoteRows(app, userId, monthRangeFilter(mKey))
    if (!rows.length) return null
    body += 'Note del mese (formato: data [mood 0-100] titolo (luogo, persone) — estratto):\n' + rows.join('\n') + '\n'
  }
  return body
}

// Sezione del prompt per un anno; null se l'anno non ha niente da riassumere.
function yearSection(app, userId, year, writtenMonths) {
  const existing = monthRecapsForYear(app, userId, year).filter((r) => !writtenMonths[r.get('key')])
  const rewritten = Object.keys(writtenMonths).filter((k) => yearOf(k) === year)
  let body = ''
  if (existing.length) {
    body += 'Recap mensili già esistenti:\n' + existing.map((r) => r.get('key') + ': ' + r.get('text')).join('\n') + '\n'
  }
  if (rewritten.length) {
    body += 'Mesi riscritti in questa stessa richiesta (usa i recap che scrivi nella sezione MESI): ' + rewritten.join(', ') + '\n'
  }
  if (!existing.length && !rewritten.length) {
    const rows = rawNoteRows(app, userId, yearRangeFilter(year))
    if (!rows.length) return null
    body += "Note dell'anno (formato: data [mood 0-100] titolo — estratto):\n" + rows.join('\n') + '\n'
  }
  return body
}

// Genera in UNA richiesta i recap indicati (liste di chiavi: giorni
// AAAA-MM-GG, mesi AAAA-MM, anni AAAA) e li salva. Ritorna le chiavi
// "periodo|chiave" concluse (anche quelle senza note, il cui recap viene
// eliminato). Lancia un errore transitorio se Gemini non risponde o risponde
// in modo inutilizzabile; quelli non transitori (chiave non valida) passano.
function generateBatch(app, userId, dayKeys, monthKeys, yearKeys, maxAttempts, plan) {
  const done = []
  const apiKey = geminiApiKeyFor(app, userId)
  if (!apiKey) throw new Error('Nessuna chiave Gemini')

  // giorni: senza note il recap non ha motivo di esistere
  const daySections = {}
  for (const dKey of dayKeys) {
    const notes = notesForUserInRange(app, userId, dayRangeFilter(dKey))
    if (!notes.length) {
      deleteRecapIfExists(app, userId, 'day', dKey)
      done.push('day|' + dKey)
    } else {
      daySections[dKey] = notes.map((n) => noteLine(n, app)).join('\n')
    }
  }
  const writtenDays = {}
  for (const k of Object.keys(daySections)) writtenDays[k] = true

  const monthSections = {}
  for (const mKey of monthKeys) {
    const body = monthSection(app, userId, mKey, writtenDays)
    if (body === null) {
      deleteRecapIfExists(app, userId, 'month', mKey)
      done.push('month|' + mKey)
    } else {
      monthSections[mKey] = body
    }
  }
  const writtenMonths = {}
  for (const k of Object.keys(monthSections)) writtenMonths[k] = true

  const yearSections = {}
  for (const year of yearKeys) {
    const body = yearSection(app, userId, year, writtenMonths)
    if (body === null) {
      deleteRecapIfExists(app, userId, 'year', year)
      done.push('year|' + year)
    } else {
      yearSections[year] = body
    }
  }

  const nDays = Object.keys(daySections).length
  const nMonths = Object.keys(monthSections).length
  const nYears = Object.keys(yearSections).length
  if (!nDays && !nMonths && !nYears) return done

  let prompt =
    recapInstructionsFor(app, userId) +
    'Devi scrivere dei recap per un diario personale, in italiano (salvo che le note siano scritte in un\'altra lingua). ' +
    'Rispondi con UN SOLO oggetto JSON, senza altro testo, di questa forma: ' +
    '{"days":{"AAAA-MM-GG":"testo"},"months":{"AAAA-MM":"testo"},"years":{"AAAA":"testo"}} ' +
    'con ESATTAMENTE le chiavi richieste nelle sezioni qui sotto (un oggetto vuoto per i livelli non richiesti). ' +
    'Ogni testo è solo il recap, senza titolo né elenchi puntati. ' +
    'Se le istruzioni fisse dell\'utente non dicono altro su persona e lunghezza, usa questo: GIORNO = 2-4 frasi, cosa è successo, persone e luoghi citati, il tono della giornata, tono caldo e diretto. ' +
    "MESE = 4-6 frasi, temi ricorrenti, persone e luoghi che tornano, andamento dell'umore nel tempo, due o tre momenti salienti, tono caldo e sintetico. " +
    "ANNO = 5-8 frasi, come si è evoluto l'anno, temi ricorrenti, persone e luoghi importanti, l'andamento dell'umore, i momenti più salienti, tono caldo come un ricordo personale. " +
    'I livelli dipendono l\'uno dall\'altro: scrivi prima i giorni, poi i mesi usando anche i recap dei giorni che hai appena scritto, poi gli anni usando quelli dei mesi.\n'

  if (nDays) {
    prompt += '\n### GIORNI DA SCRIVERE (per ognuno: note nel formato [mood 0-100] titolo — estratto)\n'
    for (const k of Object.keys(daySections).sort()) prompt += '\n[' + k + ']\n' + daySections[k] + '\n'
  }
  if (nMonths) {
    prompt += '\n### MESI DA SCRIVERE\n'
    for (const k of Object.keys(monthSections).sort()) prompt += '\n[' + k + ']\n' + monthSections[k]
  }
  if (nYears) {
    prompt += '\n### ANNI DA SCRIVERE\n'
    for (const k of Object.keys(yearSections).sort()) prompt += '\n[' + k + ']\n' + yearSections[k]
  }

  const reply = plan
    ? callTextPlan(plan, { gemini: apiKey, groq: groqApiKeyFor(app, userId) }, prompt, true)
    : callGeminiText(apiKey, prompt, maxAttempts, true)
  const parsed = jsonFromText(reply)
  if (!parsed || typeof parsed !== 'object') {
    console.log('[recap] risposta di Gemini non in formato JSON, riprovo al prossimo giro')
    throw transientError()
  }
  const take = (period, sections, group) => {
    for (const k of Object.keys(sections)) {
      const text = group && typeof group[k] === 'string' ? group[k].trim() : ''
      if (text) {
        saveRecap(app, userId, period, k, text)
        done.push(period + '|' + k)
      } else {
        console.log('[recap] ' + period + ' ' + k + ': manca nella risposta, resta in coda')
      }
    }
  }
  take('day', daySections, parsed.days)
  take('month', monthSections, parsed.months)
  take('year', yearSections, parsed.years)
  return done
}

// ---- recap da aggiornare, tutti in blocco alle 23:00 ----
//
// Il salvataggio di una nota NON chiama Gemini: l'hook si limita a segnare in
// coda (collection recap_jobs) i recap da aggiornare — il giorno della nota e,
// insieme, il suo mese e il suo anno. Poi runRecapBatch, alle 23:00 (e due
// ritentativi a 23:20 e 23:40 per ciò che fosse rimasto), li evade TUTTI in
// blocco: per ogni utente UNA richiesta a Gemini per tutti i suoi recap (vedi
// generateBatch); più modifiche allo stesso periodo contano come una.

const BATCH_ATTEMPTS = 3 // tentativi (10 s l'uno) per richiesta, poi resta in coda
const BATCH_SPACING_MS = 2000 // pausa fra due richieste a Gemini dello stesso utente

function enqueueRecapJob(app, userId, period, key) {
  let job = null
  try {
    job = app.findFirstRecordByFilter(
      'recap_jobs',
      'user = {:user} && period = {:period} && key = {:key}',
      { user: userId, period: period, key: key },
    )
  } catch {
    job = null
  }
  if (!job) {
    job = new Record(app.findCollectionByNameOrId('recap_jobs'))
    job.set('user', userId)
    job.set('period', period)
    job.set('key', key)
  }
  job.set('queuedAt', Date.now())
  app.save(job)
}

// L'orologio vero (del container: TZ=Europe/Rome nel Dockerfile): serve a sapere
// qual è il mese e l'anno CORRENTI, che non si aggiornano finché non finiscono.
function pad2b(n) {
  return n < 10 ? '0' + n : '' + n
}
function currentMonthKey() {
  const d = new Date()
  return d.getFullYear() + '-' + pad2b(d.getMonth() + 1)
}
function currentYearKey() {
  return '' + new Date().getFullYear()
}

function usersWithGeminiKey(app) {
  try {
    return app.findRecordsByFilter('users', "geminiApiKey != ''", '', 500, 0, {})
  } catch {
    return []
  }
}

// Il primo del mese chiude il mese precedente (e il primo gennaio anche l'anno):
// quei recap si segnano qui, così alle 23:00 di quel giorno vengono scritti.
function markClosedPeriods(app) {
  const d = new Date()
  if (d.getDate() !== 1) return
  const prevMonth = new Date(d.getFullYear(), d.getMonth() - 1, 1)
  const mKey = prevMonth.getFullYear() + '-' + pad2b(prevMonth.getMonth() + 1)
  for (const u of usersWithGeminiKey(app)) {
    try {
      enqueueRecapJob(app, u.id, 'month', mKey)
      if (d.getMonth() === 0) enqueueRecapJob(app, u.id, 'year', '' + prevMonth.getFullYear())
    } catch (err) {
      console.log('[recap] chiusura periodi utente ' + u.id + ': ' + err)
    }
  }
}

function dayKeyOfRecord(rec) {
  try {
    return rec ? dayKeyOf(rec.get('date')) : ''
  } catch {
    return ''
  }
}

// Chiamata dagli hook sulle note (creazione, modifica di descrizione/mood,
// cancellazione): veloce, solo scritture sul database locale. Segna il giorno
// della nota (e quello di partenza, se la data è cambiata) e, SOLO se non sono
// quelli correnti, il suo mese e il suo anno: un mese o un anno ancora in corso
// non si riassumono finché non sono finiti (lo fa markClosedPeriods).
function queueFromNote(app, record, original) {
  const userId = record.get('user')
  if (!userId || !geminiApiKeyFor(app, userId)) return
  const keys = {}
  keys[dayKeyOfRecord(record)] = true
  keys[dayKeyOfRecord(original)] = true // data cambiata: serve rifare anche il giorno di partenza
  for (const dKey of Object.keys(keys)) {
    if (!dKey) continue
    try {
      enqueueRecapJob(app, userId, 'day', dKey)
      if (monthKeyOf(dKey) !== currentMonthKey()) enqueueRecapJob(app, userId, 'month', monthKeyOf(dKey))
      if (yearOf(dKey) !== currentYearKey()) enqueueRecapJob(app, userId, 'year', yearOf(dKey))
    } catch (err) {
      console.log('[recap] segno da aggiornare ' + dKey + ' utente ' + userId + ': ' + err)
    }
  }
}

function processUserJobs(app, userId, allJobs, quiet) {
  // mese e anno in corso non si riassumono ancora (vecchi segnali: si scartano)
  const jobs = []
  for (const j of allJobs) {
    const p = j.get('period')
    const k = j.get('key')
    if ((p === 'month' && k === currentMonthKey()) || (p === 'year' && k === currentYearKey())) {
      app.delete(j)
    } else {
      jobs.push(j)
    }
  }
  if (!jobs.length) return
  const keysOf = (period) =>
    jobs
      .filter((j) => j.get('period') === period)
      .map((j) => j.get('key'))
      .sort()
  const days = keysOf('day')
  const months = keysOf('month')
  const years = keysOf('year')
  const done = {}
  // il tentativo "dopo 30 minuti" usa tutti i modelli; il giro delle 23:00 resta quello di sempre
  const apiKey = quiet ? geminiApiKeyFor(app, userId) : null
  const plan = quiet && apiKey ? buildModelPlan(app, userId, apiKey) : null
  const run = (d, m, y) => {
    const finished = generateBatch(app, userId, d, m, y, BATCH_ATTEMPTS, plan)
    for (const k of finished) done[k] = true
    sleep(BATCH_SPACING_MS)
  }
  try {
    if (days.length > MAX_DAYS_PER_REQUEST) {
      for (let i = 0; i < days.length; i += MAX_DAYS_PER_REQUEST) {
        run(days.slice(i, i + MAX_DAYS_PER_REQUEST), [], [])
      }
      if (months.length || years.length) run([], months, years)
    } else {
      run(days, months, years)
    }
  } catch (err) {
    if (err && err.transient) {
      // Gemini sovraccarico o irraggiungibile: quello che non è concluso resta in coda per il prossimo giro
      console.log('[recap] utente ' + userId + ' rimandato: ' + err)
    } else {
      // errore non recuperabile (es. chiave non valida): inutile riprovare
      console.log('[recap] utente ' + userId + ' scartato: ' + err)
      for (const j of jobs) app.delete(j)
      return
    }
  }
  for (const j of jobs) {
    if (done[j.get('period') + '|' + j.get('key')]) app.delete(j)
  }
}

function runRecapBatch(app) {
  // un solo giro alla volta (il blocco può durare minuti con tanti recap)
  if (app.store().get('recapBatchBusy')) return
  app.store().set('recapBatchBusy', true)
  try {
    try {
      markClosedPeriods(app)
    } catch (err) {
      console.log('[recap] chiusura periodi: ' + err)
    }
    let jobs = []
    try {
      jobs = app.findRecordsByFilter('recap_jobs', 'queuedAt >= 0', 'queuedAt', 5000, 0, {})
    } catch {
      jobs = []
    }
    const byUser = {}
    for (const j of jobs) {
      const u = j.get('user')
      if (!byUser[u]) byUser[u] = []
      byUser[u].push(j)
    }
    for (const userId of Object.keys(byUser)) {
      try {
        processUserJobs(app, userId, byUser[userId])
      } catch (err) {
        console.log('[recap] utente ' + userId + ': ' + err)
      }
    }
  } finally {
    app.store().set('recapBatchBusy', false)
  }
}

// Ogni minuto: per ogni utente con recap in coda, se l'ULTIMA modifica (il
// queuedAt più recente fra i suoi segnali) risale ad almeno 30 minuti fa, prova
// a scriverli subito. Un solo tentativo per "ultima modifica" (si ricorda in
// memoria): se fallisce restano in coda per le 23:00; una nuova modifica fa
// ripartire i 30 minuti.
const QUIET_MS = 30 * 60 * 1000

function runQuietRecaps(app) {
  if (app.store().get('recapBatchBusy')) return
  let jobs = []
  try {
    jobs = app.findRecordsByFilter('recap_jobs', 'queuedAt >= 0', 'queuedAt', 5000, 0, {})
  } catch {
    jobs = []
  }
  if (!jobs.length) return
  const byUser = {}
  for (const j of jobs) {
    const u = j.get('user')
    if (!byUser[u]) byUser[u] = []
    byUser[u].push(j)
  }
  const now = Date.now()
  const due = []
  for (const userId of Object.keys(byUser)) {
    let last = 0
    for (const j of byUser[userId]) last = Math.max(last, Number(j.get('queuedAt')) || 0)
    if (now - last < QUIET_MS) continue
    if (app.store().get('recapQuiet:' + userId) === last) continue // già provato per questa modifica
    app.store().set('recapQuiet:' + userId, last)
    due.push(userId)
  }
  if (!due.length) return
  app.store().set('recapBatchBusy', true)
  try {
    for (const userId of due) {
      try {
        processUserJobs(app, userId, byUser[userId], true)
      } catch (err) {
        console.log('[recap] (dopo 30 minuti) utente ' + userId + ': ' + err)
      }
    }
  } finally {
    app.store().set('recapBatchBusy', false)
  }
}

module.exports = {
  runQuietRecaps,
  queueFromNote,
  runRecapBatch,
}
