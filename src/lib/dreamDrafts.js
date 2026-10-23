// Sogni lasciati in sospeso: un sogno nuovo che si abbandona senza salvare (tornando
// indietro, anche col tasto di Android) finisce qui, in localStorage, e compare nella
// linguetta celeste a destra (DreamDraftsTab) per riprenderlo dalla pagina del sogno.
// I vocali registrati stanno in voiceStore.js con lo stesso `draftId`. Per-utente,
// come lib/drafts.js e lib/geminiDrafts.js.
import { pb } from './pocketbase'
import { listVoices, deleteVoice, updateVoice } from './voiceStore'

const listeners = new Set()
let cache = { raw: null, list: [] }

const storageKey = () => `myjournal.dreamDrafts:${pb.authStore.record?.id || 'anon'}`

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

// Dalla più recente alla più vecchia: [{ id, dateKey, time, title, content, clarity, extra, savedAt }]
export const listDreamDrafts = () => read()

export function saveDreamDraft(draft) {
  const rest = read().filter((d) => d.id !== draft.id)
  write([{ ...draft, savedAt: Date.now() }, ...rest])
}

export function removeDreamDraft(id) {
  const cur = read()
  if (cur.some((d) => d.id === id)) write(cur.filter((d) => d.id !== id))
}

export function subscribeDreamDrafts(fn) {
  listeners.add(fn)
  window.addEventListener('storage', fn)
  return () => {
    listeners.delete(fn)
    window.removeEventListener('storage', fn)
  }
}

export const newDreamDraftId = () => `s${Date.now().toString(36)}${Math.random().toString(36).slice(2, 6)}`

// Crea la bozza se non c'è ancora (es. un vocale finito di registrare): senza, il vocale
// resterebbe orfano.
export function ensureDreamDraft(draft) {
  if (!read().some((d) => d.id === draft.id)) saveDreamDraft(draft)
}

// A sogno salvato davvero: via la bozza e i vocali già trascritti; quelli NON trascritti si
// staccano dalla bozza (restano sul dispositivo, nell'elenco dei vocali da trascrivere).
export async function discardDreamDraft(id) {
  if (!id) return
  const own = (await listVoices()).filter((v) => v.draftId === id)
  for (const v of own) {
    if (v.transcribed) await deleteVoice(v.id)
    else await updateVoice(v.id, { draftId: null })
  }
  removeDreamDraft(id)
}
