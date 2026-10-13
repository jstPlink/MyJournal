// Preferenze di aspetto dell'app (animazioni, sfondo, foto che oscillano).
// Sono per-dispositivo: salvate in localStorage e applicate come attributi
// data-* sull'elemento <html>, che il CSS in index.css legge.
//
// Tema, font e cursore NON sono più scelte dell'utente: per ora l'app è solo
// chiara, con il font "tondeggiante" e il cursore di sistema (Windows). Il CSS
// del tema scuro e degli altri font resta in index.css ma non viene attivato.

const ANIM_KEY = 'myjournal.anim'
const PAPER_KEY = 'myjournal.paper'
const PAPER_IMAGE_KEY = 'myjournal.paperImage'
const TILT_KEY = 'myjournal.tilt'

export const ANIMS = ['system', 'on', 'off']
export const ANIM_LABELS = { system: 'Sistema', on: 'Sì', off: 'No' }

export const PAPERS = ['nessuna', 'puntini', 'rigato', 'quadretti', 'immagine']
export const PAPER_LABELS = {
  nessuna: 'Nessuno',
  puntini: 'Puntini',
  rigato: 'Righe',
  quadretti: 'Quadretti',
  immagine: 'Immagine',
}

function read(key, fallback, allowed) {
  try {
    const v = localStorage.getItem(key)
    return allowed.includes(v) ? v : fallback
  } catch {
    return fallback
  }
}

export function getAnim() {
  return read(ANIM_KEY, 'on', ANIMS)
}
// Uno sfondo scelto in passato e poi tolto dall'elenco (grana, lino, legno...)
// torna a quello di partenza.
export function getPaper() {
  return read(PAPER_KEY, 'rigato', PAPERS)
}
// Sfondo personalizzato (data URL, solo per lo sfondo "immagine"). Vive in
// localStorage come le altre preferenze di aspetto: per-dispositivo.
export function getPaperImage() {
  try {
    return localStorage.getItem(PAPER_IMAGE_KEY) || ''
  } catch {
    return ''
  }
}
// Foto che oscillano a destra e a sinistra leggendo il giroscopio (src/lib/tilt.js).
// Attivo di default; si spegne da Impostazioni → Permessi.
export function getTilt() {
  return read(TILT_KEY, 'on', ['on', 'off']) === 'on'
}

function prefersReducedMotion() {
  try {
    return window.matchMedia('(prefers-reduced-motion: reduce)').matches
  } catch {
    return false
  }
}

function resolvedAnim() {
  const a = getAnim()
  if (a === 'on' || a === 'off') return a
  return prefersReducedMotion() ? 'off' : 'on'
}

// Scrive gli attributi su <html>. Chiamata all'avvio e a ogni modifica.
export function applyPrefs() {
  const root = document.documentElement
  root.dataset.theme = 'light'
  delete root.dataset.font // font tondeggiante (quello di partenza)
  delete root.dataset.cursor // cursore di sistema
  root.dataset.anim = resolvedAnim()

  const paper = getPaper()
  const paperImage = paper === 'immagine' ? getPaperImage() : ''
  // "immagine" senza immagine caricata = nessuno sfondo.
  if (paper === 'nessuna' || (paper === 'immagine' && !paperImage)) {
    delete root.dataset.paper
  } else {
    root.dataset.paper = paper
  }
  if (paperImage) {
    root.style.setProperty('--paper-custom', `url("${paperImage}")`)
  } else {
    root.style.removeProperty('--paper-custom')
  }

  // Skin "Pagine": l'unica rimasta, per vista giorno e vista mese — non più
  // una preferenza dell'utente (vedi AppearanceControls.jsx).
  root.dataset.skinDay = 'pages'
  root.dataset.skinMonth = 'pages'

  const meta = document.querySelector('meta[name="theme-color"]')
  if (meta) meta.setAttribute('content', '#dbd1bd')
  window.dispatchEvent(new Event('myjournal:prefs'))
}

function setKey(key, value) {
  try {
    localStorage.setItem(key, value)
  } catch {
    // localStorage non disponibile: la scelta vale solo per questa sessione
  }
  applyPrefs()
}

export function setAnim(v) {
  setKey(ANIM_KEY, v)
}
export function setPaper(v) {
  setKey(PAPER_KEY, v)
}
export function setTilt(on) {
  setKey(TILT_KEY, on ? 'on' : 'off')
}
// Salva/rimuove l'immagine di sfondo personalizzata. `setPaperImage` torna
// false se localStorage rifiuta il salvataggio (quota: immagine troppo
// grande), così la UI può avvisare.
export function setPaperImage(dataUrl) {
  try {
    localStorage.setItem(PAPER_IMAGE_KEY, dataUrl)
  } catch {
    return false
  }
  applyPrefs()
  return true
}
export function clearPaperImage() {
  try {
    localStorage.removeItem(PAPER_IMAGE_KEY)
  } catch {
    // niente: se non si può rimuovere, applyPrefs userà comunque il valore
  }
  applyPrefs()
}

// In modalità "Sistema" per le animazioni, segue i cambi del SO in tempo reale.
export function watchSystemTheme() {
  try {
    const motion = window.matchMedia('(prefers-reduced-motion: reduce)')
    motion.addEventListener('change', () => {
      if (getAnim() === 'system') applyPrefs()
    })
  } catch {
    // matchMedia non disponibile: nessun aggiornamento automatico
  }
}
