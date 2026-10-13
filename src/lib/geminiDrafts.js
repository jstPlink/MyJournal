// Note da scrivere con Gemini lasciate in sospeso: chiudendo il pannello «Nuova
// nota con Gemini» il testo scritto (e i vocali registrati, che stanno in
// voiceStore.js con lo stesso `draftId`) restano sul dispositivo e compaiono
// nella linguetta a destra (DraftsTab), con il giorno a cui appartengono:
// quello aperto quando si è premuto «nuova nota», altrimenti oggi.
// localStorage per-utente, come lib/drafts.js.
import { pb } from './pocketbase'
import { deleteVoice, listVoices } from './voiceStore'

const listeners = new Set()
let cache = { raw: null, list: [] }

const storageKey = () => `myjournal.geminiDrafts:${pb.authStore.record?.id || 'anon'}`

function read() {
  let raw = null
  try {
    raw = localStorage.getItem(storageKey())
  } catch {
    // localStorage non disponibile
  }
  if (raw === cache.raw) return cache.list
  let list = []
  try {
    const parsed = raw ? JSON.parse(raw) : []
    if (Array.isArray(parsed)) list = parsed
  } catch {
    list = []
  }
  cache = { raw, list }
  return list
}

function write(list) {
  try {
    localStorage.setItem(storageKey(), JSON.stringify(list))
  } catch {
    // spazio esaurito: si perde solo la bozza
  }
  listeners.forEach((fn) => fn())
}

// Dalla più recente alla più vecchia: [{ id, dateKey, text, savedAt }]
export const listGeminiDrafts = () => read()

export function saveGeminiDraft({ id, dateKey, text }) {
  const rest = read().filter((d) => d.id !== id)
  write([{ id, dateKey, text, savedAt: Date.now() }, ...rest])
}

export function removeGeminiDraft(id) {
  const cur = read()
  if (cur.some((d) => d.id === id)) write(cur.filter((d) => d.id !== id))
}

export function subscribeGeminiDrafts(fn) {
  listeners.add(fn)
  window.addEventListener('storage', fn)
  return () => {
    listeners.delete(fn)
    window.removeEventListener('storage', fn)
  }
}

export const newGeminiDraftId = () => `g${Date.now().toString(36)}${Math.random().toString(36).slice(2, 6)}`

// Crea la bozza se non c'è ancora (es. un vocale finito di registrare dopo che il
// pannello è stato chiuso): senza voce nell'elenco il vocale resterebbe orfano.
export function ensureGeminiDraft({ id, dateKey, text }) {
  if (!read().some((d) => d.id === id)) saveGeminiDraft({ id, dateKey, text })
}

// A nota creata davvero: via la bozza e i vocali già trascritti (finché la nota non
// è confermata restano sul dispositivo). I vocali ancora NON trascritti non si
// toccano: la bozza resta (senza il testo, già finito nella nota) finché ce ne sono.
export async function discardGeminiDraft(id) {
  if (!id) return
  const own = (await listVoices()).filter((v) => v.draftId === id)
  for (const v of own) if (v.transcribed) await deleteVoice(v.id)
  if (own.some((v) => !v.transcribed)) {
    const cur = read().find((d) => d.id === id)
    saveGeminiDraft({ id, dateKey: cur?.dateKey, text: '' })
  } else {
    removeGeminiDraft(id)
  }
}
