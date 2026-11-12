// Helpers condivisi dalla skin "Pagine" (vista mese: src/pages/web/MonthPages.jsx
// e vista giorno: src/pages/web/DayPages.jsx). Tutto deterministico: stessa
// nota/chiave -> sempre lo stesso risultato, così l'aspetto non "salta" tra
// un render e l'altro.

import { useEffect, useState } from 'react'

// Indice che avanza da solo ogni `intervalMs`, per far scorrere più
// foto/luoghi/canzoni nello stesso piccolo spazio (i badge mobili della
// skin "Pagine": una sola "diapositiva" per foto, targhetta del luogo,
// musicassetta). Con 0 o 1 elemento non fa nulla (niente timer sprecati).
export function useCarouselIndex(length, intervalMs = 2800) {
  const [i, setI] = useState(0)
  useEffect(() => {
    if (length <= 1) return
    const id = setInterval(() => {
      setI((v) => (v + 1) % length)
    }, intervalMs)
    return () => clearInterval(id)
  }, [length, intervalMs])
  // Modulo qui (non nell'effetto): se `length` si riduce fra un render e
  // l'altro, l'indice resta comunque dentro i limiti senza uno setState in più.
  return length > 0 ? i % length : 0
}

// Hash stabile di una stringa (mano, inclinazione, tinta... tutto ne deriva).
// Dopo l'hash polinomiale c'è un mixing finale (stile finalizer Murmur3):
// senza, chiavi quasi identiche come le date consecutive di un mese
// ("2026-01-14" vs "2026-01-15") davano hash quasi uguali — le note di uno
// stesso mese finivano tutte con la stessa inclinazione, invece che sparse.
export function hash(str) {
  let h = 0
  for (let i = 0; i < str.length; i += 1) h = (h * 31 + str.charCodeAt(i)) | 0
  h ^= h >>> 16
  h = Math.imul(h, 0x85ebca6b)
  h ^= h >>> 13
  h = Math.imul(h, 0xc2b2ae35)
  h ^= h >>> 16
  return ((h % 1e9) + 1e9) % 1e9
}

// Inclinazione stabile per chiave, in circa [-spread, +spread] gradi.
export function tilt(key, spread) {
  return ((hash(key) % 1000) / 1000) * spread * 2 - spread
}

// PRNG deterministico da un seme (per posizionare i frammenti di sfondo in
// modo stabile per ogni giorno).
export function rng(seed) {
  let x = seed % 2147483647
  if (x <= 0) x += 2147483646
  return () => {
    x = (x * 16807) % 2147483647
    return (x - 1) / 2147483646
  }
}

// Tile OSM che contiene (lat, lon) allo zoom dato, più lo scostamento in px
// per centrare il punto esatto dentro il francobollo (la mappa reale del
// luogo). Un solo tile 256px: leggero e senza chiave API.
export function osmTileFor(lat, lon, z) {
  const n = 2 ** z
  const xf = ((lon + 180) / 360) * n
  const latRad = (lat * Math.PI) / 180
  const yf =
    ((1 - Math.log(Math.tan(latRad) + 1 / Math.cos(latRad)) / Math.PI) / 2) * n
  const px = Math.round((xf - Math.floor(xf)) * 256 - 128)
  const py = Math.round((yf - Math.floor(yf)) * 256 - 128)
  return {
    url: `https://tile.openstreetmap.org/${z}/${Math.floor(xf)}/${Math.floor(yf)}.png`,
    pos: `calc(50% - ${px}px) calc(50% - ${py}px)`,
  }
}

// Fascia d'umore -> forma della linguetta/colore del cartoncino + disegnino
// di sfondo. Le soglie seguono gli stop di colore in lib/mood.js (corallo,
// giallo, verde, blu), così forma e colore vanno d'accordo.
export function moodKind(value) {
  const m = Number(value)
  if (Number.isNaN(m)) return null
  if (m < 0.3) return 'coral'
  if (m < 0.5) return 'yellow'
  if (m < 0.7) return 'green'
  return 'blue'
}

// Colore delle targhette coi nomi: UN colore per persona (non più una
// terna bg/ink/bordo curata a mano) — CSS deriva sfondo/testo/bordo da
// questo con color-mix (vedi .mp-tape/.dn-tape in index.css), esattamente
// come già fa il colore del mood sul cartoncino. Così vista mese e vista
// giorno, che leggono lo STESSO colore, non possono più andare fuori
// sincrono come succedeva quando la vista giorno applicava solo il bordo.
// Le tinte non sono più 12 fisse (tutte simili e sul beige: con più persone
// nella stessa nota le targhette si assomigliavano e nomi diversi finivano
// spesso sullo stesso colore): il colore si ricava dal nome con 24 tonalità
// (una ogni 15°) in due luminosità, quindi 48 varianti ben distinte, sempre con
// lo stesso aspetto "di carta" (saturazione e luminosità contenute).
function hslToHex(h, s, l) {
  const a = s * Math.min(l, 1 - l)
  const f = (n) => {
    const k = (n + h / 30) % 12
    const c = l - a * Math.max(-1, Math.min(k - 3, 9 - k, 1))
    return Math.round(255 * c)
      .toString(16)
      .padStart(2, '0')
  }
  return `#${f(0)}${f(8)}${f(4)}`
}

// La vecchia tavolozza: i colori salvati sulle persone prima del cambio
// (`tapeColor`, assegnato alla creazione) vengono ricalcolati dal nome con la
// tavolozza nuova, così anche le persone esistenti ottengono i colori più vari.
const LEGACY_TAPE_COLORS = new Set([
  '#8397a6', '#a58e6a', '#8a9c6a', '#a889a0', '#a89465', '#9089ac',
  '#7ea6a0', '#c19077', '#8b98b3', '#b39cae', '#93a575', '#b9a874',
])

// Colore per nome (non per id): stabile anche se la persona viene
// ricreata, e la stessa formula da poter salvare lato server (vedi
// pb_migrations/1758000014_people_tape_color.js, campo `tapeColor`).
export function colorForName(name) {
  const key = (name || '').trim().toLowerCase()
  // hash() ha i bit bassi poco mescolati (molti nomi finivano sullo stesso colore):
  // si usano quelli alti
  const h = Math.floor(hash(key) / 4096)
  const hue = (h % 24) * 15 + 6
  const light = Math.floor(h / 24) % 2 === 0 ? 0.5 : 0.6
  return hslToHex(hue, 0.5, light)
}

// Colore attivo di una persona: quello salvato sul record (`tapeColor`,
// assegnato alla creazione — vedi src/lib/people.js) se presente, altrimenti
// ricalcolato dal nome (persone create prima di questo campo).
export function personTapeColor(person) {
  const saved = (person?.tapeColor || '').toLowerCase()
  if (saved && !LEGACY_TAPE_COLORS.has(saved)) return person.tapeColor
  return colorForName(person?.name)
}

// Giallo del cartoncino del riassunto: leggere variazioni casuali (stabili per chiave)
// attorno al giallo base #efe0b5 (tinta 44°, saturazione 62%, luminosità 82%).
export function yellowOf(key) {
  const h = 50 + tilt(`${key}h`, 3)
  const s = 92 + tilt(`${key}s`, 5)
  const l = 76 + tilt(`${key}l`, 3)
  return `hsl(${h.toFixed(1)} ${s.toFixed(1)}% ${l.toFixed(1)}%)`
}
