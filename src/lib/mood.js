import { durationMinutes, parseWall } from './dates'

// Gestione del valore `mood` (0–1) e della sua rappresentazione a colori.

// Posizioni PREDEFINITE degli stop del gradiente del mood (0 = pessimo,
// 1 = ottimo). L'utente può personalizzare sia i colori sia le posizioni
// (le soglie) dei 4 stop interni da Impostazioni → Dati utente (salvati
// sull'account, campo `moodGradient`); i due estremi (0 e 1) restano fissi.
// `MOOD_STOP_POSITIONS` resta esportato per compatibilità: è lo stato
// PREDEFINITO, non quello attivo — per le posizioni attive vedi
// `getMoodStopPositions()`.
export const DEFAULT_STOP_POSITIONS = [0, 0.2, 0.4, 0.6, 0.8, 1]
export const MOOD_STOP_POSITIONS = DEFAULT_STOP_POSITIONS

// Gradiente predefinito, coerente con la palette dell'app:
// rosso corallo (= delete) → arancio → giallo → verde (= save) → blu → blu-viola.
const DEFAULT_STOPS = [
  { t: 0.0, c: [224, 101, 94] }, // #e0655e
  { t: 0.2, c: [231, 154, 77] }, // #e79a4d
  { t: 0.4, c: [230, 207, 92] }, // #e6cf5c
  { t: 0.6, c: [166, 208, 110] }, // #a6d06e
  { t: 0.8, c: [94, 169, 214] }, // #5ea9d6
  { t: 1.0, c: [139, 143, 214] }, // #8b8fd6
]

const toHex = (n) => Math.max(0, Math.min(255, Math.round(n))).toString(16).padStart(2, '0')
export function rgbToHex([r, g, b]) {
  return `#${toHex(r)}${toHex(g)}${toHex(b)}`
}
export function hexToRgb(hex) {
  const m = /^#?([0-9a-f]{2})([0-9a-f]{2})([0-9a-f]{2})$/i.exec(String(hex || '').trim())
  return m ? [parseInt(m[1], 16), parseInt(m[2], 16), parseInt(m[3], 16)] : null
}

export const DEFAULT_MOOD_HEX = DEFAULT_STOPS.map((s) => rgbToHex(s.c))

// Stop attivi: il modulo li tiene in una variabile mutabile così che
// moodColor/moodTextColor (usate ovunque nell'app) riflettano subito il
// gradiente scelto senza dover passare un parametro in decine di componenti.
let STOPS = DEFAULT_STOPS

// Posizioni valide: 6 numeri crescenti dentro 0–1 (estremi compresi: anche
// "pessimo" e "ottimo" si possono spostare, non solo i 4 stop interni), con
// un margine minimo fra loro perché il gradiente non degeneri.
function isValidPositions(pos) {
  if (!Array.isArray(pos) || pos.length !== DEFAULT_STOP_POSITIONS.length) {
    return false
  }
  if (!Number.isFinite(pos[0]) || pos[0] < 0) return false
  if (pos[pos.length - 1] > 1) return false
  for (let i = 1; i < pos.length; i++) {
    if (!(Number.isFinite(pos[i]) && pos[i] > pos[i - 1])) return false
  }
  return true
}

// Imposta il gradiente attivo. `saved` è il valore grezzo del campo
// `moodGradient` sull'account: null/assente (predefinito), un array di 6
// esadecimali (formato storico: solo colori, posizioni predefinite), oppure
// `{ colors, positions }` (formato attuale: colori E soglie personalizzati).
// Un valore assente/non valido ripristina il gradiente predefinito. Chiamata
// all'avvio e a ogni salvataggio dal contesto di autenticazione
// (src/context/AuthContext.jsx).
export function setMoodGradient(saved) {
  const colors = Array.isArray(saved)
    ? saved
    : Array.isArray(saved?.colors)
      ? saved.colors
      : null
  const positions = isValidPositions(saved?.positions)
    ? saved.positions
    : DEFAULT_STOP_POSITIONS
  const rgbArr = Array.isArray(colors) ? colors.map(hexToRgb) : null
  if (!rgbArr || rgbArr.length !== positions.length || rgbArr.some((c) => !c)) {
    STOPS = DEFAULT_STOPS
    return
  }
  STOPS = rgbArr.map((c, i) => ({ t: positions[i], c }))
}

// I 6 colori del gradiente attivo, in esadecimale.
export function getMoodGradientHex() {
  return STOPS.map((s) => rgbToHex(s.c))
}

// Le 6 posizioni (soglie) attive, 0–1.
export function getMoodStopPositions() {
  return STOPS.map((s) => s.t)
}

function clamp01(n) {
  if (Number.isNaN(n) || n == null) return 0
  return Math.min(1, Math.max(0, n))
}

function lerp(a, b, k) {
  return Math.round(a + (b - a) * k)
}

// Colore CSS per un singolo valore di mood. Se gli estremi del gradiente
// sono stati spostati (non più a 0/1), un mood oltre l'ultimo/prima del
// primo stop resta piatto al colore di quello stop, non sfuma oltre.
export function moodColor(value) {
  const v = clamp01(Number(value))
  if (v <= STOPS[0].t) {
    const c = STOPS[0].c
    return `rgb(${c[0]}, ${c[1]}, ${c[2]})`
  }
  const lastStop = STOPS[STOPS.length - 1]
  if (v >= lastStop.t) {
    const c = lastStop.c
    return `rgb(${c[0]}, ${c[1]}, ${c[2]})`
  }
  for (let i = 0; i < STOPS.length - 1; i++) {
    const lo = STOPS[i]
    const hi = STOPS[i + 1]
    if (v >= lo.t && v <= hi.t) {
      const k = hi.t === lo.t ? 0 : (v - lo.t) / (hi.t - lo.t)
      const r = lerp(lo.c[0], hi.c[0], k)
      const g = lerp(lo.c[1], hi.c[1], k)
      const b = lerp(lo.c[2], hi.c[2], k)
      return `rgb(${r}, ${g}, ${b})`
    }
  }
  const last = lastStop.c
  return `rgb(${last[0]}, ${last[1]}, ${last[2]})`
}

// Colore del testo (scuro o chiaro) da usare SOPRA un'area colorata col mood,
// per mantenere il contrasto leggibile.
export function moodTextColor(value) {
  const v = clamp01(Number(value))
  let rgb = [255, 255, 255]
  if (v <= STOPS[0].t) {
    rgb = STOPS[0].c
  } else if (v >= STOPS[STOPS.length - 1].t) {
    rgb = STOPS[STOPS.length - 1].c
  } else {
    for (let i = 0; i < STOPS.length - 1; i++) {
      const lo = STOPS[i]
      const hi = STOPS[i + 1]
      if (v >= lo.t && v <= hi.t) {
        rgb = [
          lerp(lo.c[0], hi.c[0], (v - lo.t) / (hi.t - lo.t)),
          lerp(lo.c[1], hi.c[1], (v - lo.t) / (hi.t - lo.t)),
          lerp(lo.c[2], hi.c[2], (v - lo.t) / (hi.t - lo.t)),
        ]
        break
      }
    }
  }
  const lum = (0.299 * rgb[0] + 0.587 * rgb[1] + 0.114 * rgb[2]) / 255
  return lum > 0.62 ? '#3a3226' : '#fdf7ea'
}

// Peso di una nota nel calcolo del mood del giorno.
// Curva a "valle": peso ~1 ai mood estremi (0 e 1), peso minimo (0.15) a 0.5,
// con transizione morbida (smoothstep) e code piatte.
function extremeWeight(m) {
  const d = Math.min(1, Math.abs(2 * clamp01(m) - 1))
  const s = d * d * (3 - 2 * d)
  return 0.15 + 0.85 * s
}

// ---- Formula personalizzata (Mood Lab) ----
// L'utente può mettere a punto la formula nel Mood Lab (src/pages/MoodLab.jsx) e
// applicarla a tutta l'app: viene salvata sull'account (campo `moodFormula`) e
// letta qui, come il gradiente. Contiene una curva a 7 punti (peso di una nota in
// base al suo mood), due fattori extra (durata e persone della nota) e, facoltativa,
// una curva per pesare i giorni nel mood del mese. Senza formula valgono le regole
// originali qui sotto.
export const BUILTIN_MOOD_CURVE = [1, 0.7796, 0.3704, 0.15, 0.3704, 0.7796, 1] // = extremeWeight
const MAX_WEIGHT = 5
const DURATION_CAP_MIN = 180
const PEOPLE_CAP = 6

function isCurve(c) {
  return Array.isArray(c) && c.length === 7 && c.every((v) => Number.isFinite(Number(v)) && v >= 0 && v <= MAX_WEIGHT)
}

// Ritorna la formula ripulita, o null se il valore non è valido.
export function normalizeMoodFormula(f) {
  if (!f || typeof f !== 'object' || !isCurve(f.curve)) return null
  const factor = (v) => (Number.isFinite(Number(v)) ? Math.min(MAX_WEIGHT, Math.max(0, Number(v))) : 0)
  return {
    curve: f.curve.map(Number),
    durationWeight: factor(f.durationWeight),
    peopleWeight: factor(f.peopleWeight),
    monthCurve: isCurve(f.monthCurve) ? f.monthCurve.map(Number) : null,
  }
}

let FORMULA = null

// Chiamata all'avvio e a ogni salvataggio dal contesto di autenticazione.
export function setMoodFormula(saved) {
  FORMULA = normalizeMoodFormula(saved)
}

export function getMoodFormula() {
  return FORMULA
}

function catmullRom(p0, p1, p2, p3, t) {
  return (
    0.5 *
    (2 * p1 +
      (-p0 + p2) * t +
      (2 * p0 - 5 * p1 + 4 * p2 - p3) * t * t +
      (-p0 + 3 * p1 - 3 * p2 + p3) * t * t * t)
  )
}

// Peso letto dalla curva a 7 punti equispaziati su 0–1 (interpolazione morbida).
function curveWeight(points, m) {
  const v = clamp01(Number(m))
  const seg = points.length - 1
  const i = Math.min(seg - 1, Math.floor(v * seg))
  const t = v * seg - i
  const w = catmullRom(points[i - 1] ?? points[i], points[i], points[i + 1], points[i + 2] ?? points[i + 1], t)
  return Math.min(MAX_WEIGHT, Math.max(0, w))
}

function formulaDayMood(notes) {
  let wsum = 0
  let acc = 0
  let sum = 0
  let n = 0
  for (const note of notes) {
    const m = Number(note.mood)
    if (Number.isNaN(m)) continue
    const dur = durationMinutes(note.timeStart, note.timeEnd) || 0
    const people = Array.isArray(note.people) ? note.people.length : Number(note.peopleCount) || 0
    const w =
      curveWeight(FORMULA.curve, m) *
      (1 + FORMULA.durationWeight * clamp01(dur / DURATION_CAP_MIN)) *
      (1 + FORMULA.peopleWeight * clamp01(people / PEOPLE_CAP))
    wsum += w
    acc += m * w
    sum += m
    n += 1
  }
  if (!n) return 0
  return wsum > 0 ? acc / wsum : sum / n
}

// Mood del mese a partire dai mood dei giorni scritti: media semplice, oppure
// pesata con la curva del mese se la formula personalizzata ne ha una. null se non ci sono giorni.
export function monthMoodFromDays(vals) {
  if (!vals.length) return null
  const mc = FORMULA?.monthCurve
  if (!mc) return vals.reduce((a, b) => a + b, 0) / vals.length
  let wsum = 0
  let acc = 0
  for (const v of vals) {
    const w = curveWeight(mc, v)
    wsum += w
    acc += v * w
  }
  return wsum > 0 ? acc / wsum : vals.reduce((a, b) => a + b, 0) / vals.length
}

// Mood del giorno: media delle note pesata con extremeWeight, così le note
// "neutre" (mood ~0.5) contano poco e quelle marcate contano molto. Con una
// formula personalizzata (setMoodFormula) pesa invece con la sua curva e i suoi fattori.
export function dayMood(notes) {
  if (FORMULA) return formulaDayMood(notes)
  const vals = notes
    .map((n) => Number(n.mood))
    .filter((n) => !Number.isNaN(n))
  if (!vals.length) return 0
  let wsum = 0
  let acc = 0
  for (const m of vals) {
    const w = extremeWeight(m)
    wsum += w
    acc += m * w
  }
  return wsum > 0
    ? acc / wsum
    : vals.reduce((a, b) => a + b, 0) / vals.length
}

// ---- Andamento del mood sull'anno ----
// Tre serie a granularità diversa (giorno / settimana / mese) per il
// grafico, più un riepilogo per mese con una barretta per ogni giorno.

function isLeapYear(y) {
  return (y % 4 === 0 && y % 100 !== 0) || y % 400 === 0
}

function daysInMonthOf(year, month /* 0–11 */) {
  return [31, isLeapYear(year) ? 29 : 28, 31, 30, 31, 30, 31, 31, 30, 31, 30, 31][
    month
  ]
}

// Media semplice ignorando i null; null se non c'è alcun valore noto.
function meanIgnoringNulls(vals) {
  const known = vals.filter((v) => v != null)
  return known.length ? known.reduce((a, b) => a + b, 0) / known.length : null
}

export function yearWeeklyMood(year, notes) {
  const byDay = new Map() // "mese-giorno" (1-based) -> note[]
  for (const n of notes) {
    const p = parseWall(n.date)
    if (!p || p.y !== year) continue
    const key = `${p.mo}-${p.d}`
    if (!byDay.has(key)) byDay.set(key, [])
    byDay.get(key).push(n)
  }

  const daily = []
  const monthly = []
  for (let mo = 1; mo <= 12; mo++) {
    const dim = daysInMonthOf(year, mo - 1)
    const monthNotes = []
    const groups = [] // una barretta per ogni giorno del mese
    for (let d = 1; d <= dim; d++) {
      const ns = byDay.get(`${mo}-${d}`) || []
      daily.push(ns.length ? dayMood(ns) : null)
      monthNotes.push(...ns)
      groups.push({
        mood: ns.length ? dayMood(ns) : null,
        count: ns.length,
      })
    }
    monthly.push({
      month: mo - 1,
      count: monthNotes.length,
      mood: monthNotes.length
        ? FORMULA?.monthCurve
          ? monthMoodFromDays(groups.filter((g) => g.mood != null).map((g) => g.mood))
          : dayMood(monthNotes)
        : null,
      groups,
    })
  }

  // Settimanale: media dei valori giornalieri a blocchi di 7 dal 1° gennaio.
  const weekly = []
  for (let i = 0; i < daily.length; i += 7) {
    weekly.push(meanIgnoringNulls(daily.slice(i, i + 7)))
  }

  const monthlySeries = monthly.map((m) => m.mood)

  return {
    daily,
    weekly,
    monthlySeries,
    monthly,
    hasData: daily.some((v) => v != null),
  }
}
