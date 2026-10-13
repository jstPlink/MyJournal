// Suoni dell'app, sintetizzati con Web Audio (nessun file audio da caricare).
// Preferenze per-dispositivo in localStorage: interruttore (Impostazioni →
// Aspetto → Suoni) e volume (Impostazioni → Suoni).
//
// I browser e la WebView Android tengono l'audio "sospeso" finché l'utente non
// tocca qualcosa: `installAudioUnlock()` (chiamata all'avvio) lo sblocca al
// primo tocco, così anche i suoni che partono dopo un'operazione asincrona
// (es. il salvataggio di una nota) si sentono.

const ON_KEY = 'myjournal.sounds'
const VOLUME_KEY = 'myjournal.soundVolume'
const DEFAULT_VOLUME = 60

export function getSoundsOn() {
  try {
    return localStorage.getItem(ON_KEY) !== 'off'
  } catch {
    return true
  }
}
export function setSoundsOn(on) {
  try {
    localStorage.setItem(ON_KEY, on ? 'on' : 'off')
  } catch {
    /* la scelta vale solo per questa sessione */
  }
}

// 0–100
export function getVolume() {
  try {
    const v = Number(localStorage.getItem(VOLUME_KEY))
    return Number.isFinite(v) && localStorage.getItem(VOLUME_KEY) !== null
      ? Math.min(100, Math.max(0, v))
      : DEFAULT_VOLUME
  } catch {
    return DEFAULT_VOLUME
  }
}
export function setVolume(v) {
  try {
    localStorage.setItem(VOLUME_KEY, String(Math.round(v)))
  } catch {
    /* la scelta vale solo per questa sessione */
  }
}

let ctx = null
function audio() {
  if (ctx) return ctx
  const AC = typeof window !== 'undefined' && (window.AudioContext || window.webkitAudioContext)
  if (!AC) return null
  try {
    ctx = new AC()
  } catch {
    ctx = null
  }
  return ctx
}

export function installAudioUnlock() {
  const unlock = () => {
    const c = audio()
    if (c && c.state === 'suspended') c.resume().catch(() => {})
  }
  for (const ev of ['pointerdown', 'touchstart', 'keydown']) {
    document.addEventListener(ev, unlock, { passive: true })
  }
}

// Volume percepito: curva quadratica, così la metà dello slider è davvero
// "metà" e i valori bassi restano utilizzabili.
const master = () => Math.pow(getVolume() / 100, 2) * 0.9

function tone(c, out, { freq, to, dur, type = 'sine', gain = 0.2, at = 0 }) {
  const t0 = c.currentTime + at
  const osc = c.createOscillator()
  const g = c.createGain()
  osc.type = type
  osc.frequency.setValueAtTime(freq, t0)
  if (to) osc.frequency.exponentialRampToValueAtTime(to, t0 + dur)
  g.gain.setValueAtTime(0.0001, t0)
  g.gain.exponentialRampToValueAtTime(gain, t0 + 0.006)
  g.gain.exponentialRampToValueAtTime(0.0001, t0 + dur)
  osc.connect(g).connect(out)
  osc.start(t0)
  osc.stop(t0 + dur + 0.02)
}

function noise(c, out, { dur, gain = 0.2, freq = 2000, q = 0.8, at = 0 }) {
  const t0 = c.currentTime + at
  const len = Math.max(1, Math.floor(c.sampleRate * dur))
  const buf = c.createBuffer(1, len, c.sampleRate)
  const data = buf.getChannelData(0)
  for (let i = 0; i < len; i++) data[i] = Math.random() * 2 - 1
  const src = c.createBufferSource()
  src.buffer = buf
  const bp = c.createBiquadFilter()
  bp.type = 'bandpass'
  bp.frequency.value = freq
  bp.Q.value = q
  const g = c.createGain()
  g.gain.setValueAtTime(0.0001, t0)
  g.gain.exponentialRampToValueAtTime(gain, t0 + 0.012)
  g.gain.exponentialRampToValueAtTime(0.0001, t0 + dur)
  src.connect(bp).connect(g).connect(out)
  src.start(t0)
}

const SOUNDS = {
  // tocco di un pulsante: "tic" leggero
  tap: (c, o) => tone(c, o, { freq: 760, to: 520, dur: 0.05, type: 'triangle', gain: 0.22 }),
  // cambio mese/anno: due note brevi che salgono
  nav: (c, o) => {
    tone(c, o, { freq: 520, to: 600, dur: 0.06, gain: 0.2 })
    tone(c, o, { freq: 700, to: 780, dur: 0.07, gain: 0.16, at: 0.05 })
  },
  // pagina che si apre: fruscio di carta
  page: (c, o) => noise(c, o, { dur: 0.13, gain: 0.3, freq: 2400, q: 0.6 }),
  // pagina sfogliata (swipe tra i mesi): fruscio che sale di tono, come una
  // pagina che scorre sotto il pollice, e un lieve colpo quando si posa
  flip: (c, o) => {
    const t0 = c.currentTime
    const dur = 0.3
    const len = Math.floor(c.sampleRate * dur)
    const buf = c.createBuffer(1, len, c.sampleRate)
    const data = buf.getChannelData(0)
    for (let i = 0; i < len; i++) data[i] = Math.random() * 2 - 1
    const src = c.createBufferSource()
    src.buffer = buf
    const bp = c.createBiquadFilter()
    bp.type = 'bandpass'
    bp.Q.value = 0.9
    bp.frequency.setValueAtTime(1100, t0)
    bp.frequency.exponentialRampToValueAtTime(4200, t0 + dur * 0.7)
    const g = c.createGain()
    g.gain.setValueAtTime(0.0001, t0)
    g.gain.exponentialRampToValueAtTime(0.4, t0 + 0.07)
    g.gain.exponentialRampToValueAtTime(0.0001, t0 + dur)
    src.connect(bp).connect(g).connect(o)
    src.start(t0)
    tone(c, o, { freq: 170, to: 110, dur: 0.07, type: 'triangle', gain: 0.18, at: dur * 0.72 })
  },
  // nota salvata: due note che salgono, come una campanella
  save: (c, o) => {
    tone(c, o, { freq: 659, dur: 0.16, type: 'triangle', gain: 0.24 })
    tone(c, o, { freq: 988, dur: 0.26, type: 'triangle', gain: 0.22, at: 0.09 })
  },
  // nota eliminata: nota che scende e fruscio
  delete: (c, o) => {
    tone(c, o, { freq: 420, to: 150, dur: 0.28, type: 'triangle', gain: 0.32 })
    noise(c, o, { dur: 0.18, gain: 0.26, freq: 1200, q: 0.8, at: 0.04 })
  },
  // linguetta laterale che si apre / si chiude: due note brevi, su e giù
  tabOpen: (c, o) => {
    tone(c, o, { freq: 440, to: 620, dur: 0.09, type: 'triangle', gain: 0.22 })
    tone(c, o, { freq: 880, dur: 0.12, type: 'triangle', gain: 0.16, at: 0.06 })
  },
  tabClose: (c, o) => {
    tone(c, o, { freq: 700, to: 420, dur: 0.1, type: 'triangle', gain: 0.2 })
  },
  // avviso a schermo (toast): tre note che salgono, per farsi notare
  notice: (c, o) => {
    tone(c, o, { freq: 784, dur: 0.14, type: 'triangle', gain: 0.26 })
    tone(c, o, { freq: 1047, dur: 0.14, type: 'triangle', gain: 0.26, at: 0.13 })
    tone(c, o, { freq: 1319, dur: 0.28, type: 'triangle', gain: 0.24, at: 0.26 })
  },
  // dettatura: avvio, stop, avviso degli ultimi secondi
  recStart: (c, o) => tone(c, o, { freq: 520, to: 880, dur: 0.13, gain: 0.22 }),
  recStop: (c, o) => tone(c, o, { freq: 880, to: 440, dur: 0.14, gain: 0.22 }),
  recWarn: (c, o) => {
    tone(c, o, { freq: 1000, dur: 0.08, type: 'square', gain: 0.1 })
    tone(c, o, { freq: 1000, dur: 0.08, type: 'square', gain: 0.1, at: 0.14 })
  },
}

export function playSound(name, { force = false } = {}) {
  if (!force && !getSoundsOn()) return
  const level = master()
  if (level <= 0) return
  const make = SOUNDS[name]
  const c = audio()
  if (!make || !c) return
  try {
    if (c.state === 'suspended') c.resume().catch(() => {})
    const out = c.createGain()
    out.gain.value = level
    out.connect(c.destination)
    make(c, out)
  } catch {
    /* audio non disponibile: ignora */
  }
}
