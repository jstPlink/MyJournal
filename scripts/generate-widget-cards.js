// Genera le immagini del cartoncino del mood dei widget Android: sagoma con i lati
// dentellati (come i cartoncini della skin «Pagine»), ombra e texture di cartone.
// Uso: `node scripts/generate-widget-cards.js`, poi `npm run android:build`.
// Per ogni formato esce: widget_card_<f>.png (sagoma bianca, il widget la tinge col colore del
// mood), widget_card_<f>_tex.png (texture sopra la sagoma) e widget_card_<f>_shadow.png.
import { fileURLToPath } from 'node:url'
import { dirname, resolve } from 'node:path'
import sharp from 'sharp'

const here = dirname(fileURLToPath(import.meta.url))
const out = resolve(here, '..', 'android', 'app', 'src', 'main', 'res', 'drawable-nodpi')

const K = 4 // pixel per dp
const TOOTH = 6 * K // passo dei denti
const DEPTH = 2.6 * K // profondità dei denti

// formati: dimensioni in dp (devono coincidere con il layout)
const FORMATS = { wide: [104, 62], tall: [62, 66] }

function outline(w, h) {
  const pts = []
  const n = Math.max(2, Math.round(h / TOOTH))
  const step = h / n
  pts.push([DEPTH, 0], [w - DEPTH, 0])
  for (let i = 0; i < n; i++) {
    pts.push([w, i * step + step / 2], [w - DEPTH, (i + 1) * step])
  }
  pts.push([DEPTH, h])
  for (let i = n - 1; i >= 0; i--) {
    pts.push([0, i * step + step / 2], [DEPTH, i * step])
  }
  return pts.map(([x, y]) => `${x.toFixed(1)},${y.toFixed(1)}`).join(' ')
}

for (const [name, [wDp, hDp]] of Object.entries(FORMATS)) {
  const w = wDp * K
  const h = hDp * K
  const poly = outline(w, h)
  const svg = (inner) =>
    Buffer.from(`<svg xmlns="http://www.w3.org/2000/svg" width="${w}" height="${h}">${inner}</svg>`)

  // sagoma: bianca, il widget la tinge
  await sharp(svg(`<polygon points="${poly}" fill="#fff"/>`)).png().toFile(resolve(out, `widget_card_${name}.png`))

  // ombra: stessa sagoma, scura e semitrasparente
  await sharp(svg(`<polygon points="${poly}" fill="#4a3b24" fill-opacity="0.5"/>`))
    .png()
    .toFile(resolve(out, `widget_card_${name}_shadow.png`))

  // texture di cartone: grana fine + venature orizzontali, ritagliate sulla sagoma
  const tex = `
    <defs>
      <clipPath id="c"><polygon points="${poly}"/></clipPath>
      <filter id="g" x="0" y="0" width="100%" height="100%">
        <feTurbulence type="fractalNoise" baseFrequency="0.9" numOctaves="3" seed="7"/>
        <feColorMatrix type="matrix" values="0 0 0 0 0.25  0 0 0 0 0.17  0 0 0 0 0.08  0 0 0 1.6 -0.55"/>
      </filter>
      <filter id="f" x="0" y="0" width="100%" height="100%">
        <feTurbulence type="fractalNoise" baseFrequency="0.015 0.35" numOctaves="2" seed="3"/>
        <feColorMatrix type="matrix" values="0 0 0 0 0.3  0 0 0 0 0.2  0 0 0 0 0.1  0 0 0 1.3 -0.5"/>
      </filter>
    </defs>
    <g clip-path="url(#c)">
      <rect width="${w}" height="${h}" filter="url(#g)" opacity="0.4"/>
      <rect width="${w}" height="${h}" filter="url(#f)" opacity="0.28"/>
    </g>`
  await sharp(svg(tex)).png().toFile(resolve(out, `widget_card_${name}_tex.png`))
}
console.log('widget cards ok')
