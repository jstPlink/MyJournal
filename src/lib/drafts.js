// Note lasciate in sospeso: una nuova nota che si abbandona senza salvare (ad
// esempio tornando indietro per sbaglio) finisce qui, in localStorage, e si
// ritrova nell'elenco "Bozze" (src/components/DraftsTab.jsx) per riprenderla
// da dove era. Si salva da sola mentre si scrive (src/hooks/useAutoDraft.js) e
// sparisce quando la nota viene davvero salvata. Per-utente, come la cache
// (src/lib/cache.js), così un altro account sullo stesso dispositivo non vede
// le bozze altrui.
//
// Le immagini scelte ma non ancora salvate NON si conservano (sono file, non
// stanno in localStorage): della bozza resta solo il numero (`imageCount`),
// per avvisare che vanno riaggiunte.
import { pb } from './pocketbase'

const MAX_DRAFTS = 30
const listeners = new Set()
let cache = { raw: null, list: [] }

const storageKey = () => `myjournal.noteDrafts:${pb.authStore.record?.id || 'anon'}`

function read() {
  let raw = null
  try {
    raw = localStorage.getItem(storageKey())
  } catch {
    // localStorage non disponibile: nessuna bozza
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
    localStorage.setItem(storageKey(), JSON.stringify(list.slice(0, MAX_DRAFTS)))
  } catch {
    // spazio esaurito / storage bloccato: si perde solo la bozza
  }
  listeners.forEach((fn) => fn())
}

// Dalla più recente alla più vecchia.
export const listDrafts = () => read()

export function saveDraft(draft) {
  const rest = read().filter((d) => d.id !== draft.id)
  write([{ ...draft, savedAt: Date.now() }, ...rest])
}

export function removeDraft(id) {
  const cur = read()
  if (cur.some((d) => d.id === id)) write(cur.filter((d) => d.id !== id))
}

export function subscribeDrafts(fn) {
  listeners.add(fn)
  // altre schede/finestre dello stesso browser
  window.addEventListener('storage', fn)
  return () => {
    listeners.delete(fn)
    window.removeEventListener('storage', fn)
  }
}

export const newDraftId = () => `d${Date.now().toString(36)}${Math.random().toString(36).slice(2, 6)}`
