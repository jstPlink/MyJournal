// Genera le icone dell'app Android (Capacitor) da scripts/icon-source.svg, la
// stessa sorgente della PWA. Uso: `npm run icons:android`, poi `npm run android:build`.
import { readFile, writeFile } from 'node:fs/promises'
import { fileURLToPath } from 'node:url'
import { dirname, resolve } from 'node:path'
import sharp from 'sharp'

const here = dirname(fileURLToPath(import.meta.url))
const res = resolve(here, '..', 'android', 'app', 'src', 'main', 'res')
const svg = await readFile(resolve(here, 'icon-source.svg'))
const BG = '#5a5547' // fondo scuro con una leggera tinta cartoncino: contrasta con la carta chiara dell'icona

const dens = { mdpi: 1, hdpi: 1.5, xhdpi: 2, xxhdpi: 3, xxxhdpi: 4 }

for (const [name, k] of Object.entries(dens)) {
  const dir = resolve(res, `mipmap-${name}`)
  const legacy = Math.round(48 * k)
  const full = Math.round(108 * k)
  // legacy: icona su fondo pieno, a bordo quadrato / tondo
  const inner = Math.round(legacy * 0.86)
  const iconPng = await sharp(svg).resize(inner, inner).png().toBuffer()
  const square = await sharp({
    create: { width: legacy, height: legacy, channels: 4, background: BG },
  })
    .composite([{ input: iconPng, gravity: 'center' }])
    .png()
    .toBuffer()
  await writeFile(resolve(dir, 'ic_launcher.png'), square)
  const mask = Buffer.from(
    `<svg width="${legacy}" height="${legacy}"><circle cx="${legacy / 2}" cy="${legacy / 2}" r="${legacy / 2}"/></svg>`,
  )
  await writeFile(
    resolve(dir, 'ic_launcher_round.png'),
    await sharp(square).composite([{ input: mask, blend: 'dest-in' }]).png().toBuffer(),
  )
  // adaptive: primo piano trasparente, l'icona sta nel 60% centrale (zona sicura)
  const fg = Math.round(full * 0.64)
  const fgPng = await sharp(svg).resize(fg, fg).png().toBuffer()
  await writeFile(
    resolve(dir, 'ic_launcher_foreground.png'),
    await sharp({
      create: { width: full, height: full, channels: 4, background: { r: 0, g: 0, b: 0, alpha: 0 } },
    })
      .composite([{ input: fgPng, gravity: 'center' }])
      .png()
      .toBuffer(),
  )
  console.log('scritto', name)
}

await writeFile(
  resolve(res, 'values', 'ic_launcher_background.xml'),
  `<?xml version="1.0" encoding="utf-8"?>\n<resources>\n    <color name="ic_launcher_background">${BG}</color>\n</resources>\n`,
)

