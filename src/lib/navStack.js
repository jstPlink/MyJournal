// Pila di navigazione dell'app (indietro "a livelli", non cronologia del browser).
//
// Livelli:
//   0  schermate principali: Calendario (/), Andamento (/dati), Statistiche (/statistiche)
//   1  aperte da una principale: giorno (/day/..), Cerca (/filtri), Impostazioni (/profilo), Importa
//   2  la nota (/note/..)
//   +  i pannelli (selettori, Gemini, immagini...) stanno sopra a tutto: si registrano
//      con useBackClose e «indietro» li chiude prima di cambiare pagina.
//
// Cambiare giorno (frecce, swipe) o scheda principale SOSTITUISCE la cima della pila
// invece di aggiungere un livello: dal giorno 12 si torna al mese, non al giorno 11.
// «Indietro» (pulsante dell'app o tasto/gesto di Android) toglie la cima e va alla
// pagina sotto; dalla schermata principale esce dall'app. Così «indietro» non dipende
// dalla cronologia del browser, che si riempie di passaggi intermedi.

const KEY = 'myjournal.navStack'

function level(path) {
  const p = path.split('?')[0]
  if (p === '/' || p === '/dati' || p === '/statistiche') return 0
  if (p.startsWith('/note')) return 2
  return 1
}

let stack = []
try {
  const saved = JSON.parse(sessionStorage.getItem(KEY) || '[]')
  if (Array.isArray(saved)) stack = saved.filter((x) => typeof x === 'string')
} catch {
  stack = []
}

function persist() {
  try {
    sessionStorage.setItem(KEY, JSON.stringify(stack))
  } catch {
    // pila solo in memoria
  }
}

// Da chiamare a ogni cambio di pagina (vedi components/NavStack.jsx).
export function trackLocation(path) {
  const lv = level(path)
  if (stack[stack.length - 1] === path) return
  // aperta da un link diretto (widget, notifica): sotto c'è sempre il calendario
  if (!stack.length && lv > 0) stack = ['/']
  while (stack.length && level(stack[stack.length - 1]) > lv) stack.pop()
  if (stack.length && level(stack[stack.length - 1]) === lv) stack[stack.length - 1] = path
  else stack.push(path)
  persist()
}

// Pagina a cui porta «indietro», o null se si è già sulla principale.
export function previousPath() {
  return stack.length > 1 ? stack[stack.length - 2] : null
}

// ---- pannelli aperti (l'ultimo registrato è quello in cima)
const overlays = []

export function registerOverlay(close) {
  const entry = { close }
  overlays.push(entry)
  return () => {
    const i = overlays.indexOf(entry)
    if (i >= 0) overlays.splice(i, 1)
  }
}

// «Indietro»: chiude il pannello in cima, altrimenti sale di un livello.
// Ritorna 'overlay' | 'page' | 'root' (già in cima alla pila: nulla da fare).
export function goBack(navigate) {
  const top = overlays[overlays.length - 1]
  if (top) {
    top.close()
    return 'overlay'
  }
  const prev = previousPath()
  if (prev) {
    stack.pop()
    persist()
    navigate(prev, { replace: true })
    return 'page'
  }
  return 'root'
}
