import { hash } from './pagesSkin'

// Carattere di una nota (editor web, Diario): dimensione e stile, salvati
// con la nota nel campo JSON `font` = { ff, fs } (migration 1758000024).

export const FONT_SIZES = [
  { id: 0, label: 'Piccolo', rem: 0.8 },
  { id: 1, label: 'Medio', rem: 0.89 },
  { id: 2, label: 'Grande', rem: 0.98 },
]
export const FONTS = [
  { id: 0, label: 'Kalam', css: "'MyJournal Hand', 'Kalam', sans-serif", k: 1 },
  { id: 1, label: 'Caveat', css: "'MyJournal Marker', 'Caveat', cursive", k: 1.22 },
  { id: 2, label: 'Gochi', css: "'MyJournal Hand Gochi', 'Gochi Hand', cursive", k: 1.04 },
]

// { ff, fs } valido oppure null (nota senza carattere salvato).
export function sanitizeFont(v) {
  let o = v
  if (typeof o === 'string') {
    try {
      o = JSON.parse(o)
    } catch {
      return null
    }
  }
  if (!o || typeof o !== 'object') return null
  if (!FONTS.some((f) => f.id === o.ff) || !FONT_SIZES.some((s) => s.id === o.fs)) return null
  return { ff: o.ff, fs: o.fs }
}

export function fontRem(font) {
  const f = FONTS.find((x) => x.id === font?.ff) || FONTS[0]
  const s = FONT_SIZES.find((x) => x.id === font?.fs) || FONT_SIZES[1]
  return { css: f.css, rem: (s.rem * f.k).toFixed(3) }
}

// Stile in linea per il testo di una nota che ha un carattere salvato.
export function noteFontStyle(font) {
  const ok = sanitizeFont(font)
  if (!ok) return undefined
  const { css, rem } = fontRem(ok)
  return { fontFamily: css, fontSize: `${rem}rem` }
}

// Carattere del TITOLO di una nota: uno dei tre caratteri, scelto a caso ma
// stabile per nota (stesso id -> stesso carattere ovunque compaia il titolo).
// Restituisce le variabili CSS `--tf` (famiglia) e `--tk` (correzione di misura).
// I titoli sono in maiuscolo: la misura si pareggia sull'altezza delle maiuscole
// (misurata: Kalam 73, Caveat 73, Gochi 56 per 100px), così la grandezza apparente è la stessa.
const TITLE_K = [1.05, 1.05, 1.37]
export function titleFontVars(id) {
  const i = hash(String(id ?? 'new')) % FONTS.length
  return { '--tf': FONTS[i].css, '--tk': TITLE_K[i] }
}
