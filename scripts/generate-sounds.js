// Genera il suono della notifica dei promemoria (campanella a due note) come
// WAV mono 16 bit in android/app/src/main/res/raw/. Android vuole un file
// vero per il suono di un canale di notifica (gli altri suoni dell'app sono
// sintetizzati a runtime, vedi src/lib/sounds.js).
// Uso: `npm run sounds:android`, poi `npm run android:build`.
import { mkdir, writeFile } from 'node:fs/promises'
import { fileURLToPath } from 'node:url'
import { dirname, resolve } from 'node:path'

const here = dirname(fileURLToPath(import.meta.url))
const outDir = resolve(here, '..', 'android', 'app', 'src', 'main', 'res', 'raw')
const RATE = 22050
const total = Math.round(RATE * 1.3)
const data = new Float32Array(total)

// Nota di campanella: sinusoide + armonica, attacco rapido, coda esponenziale.
function bell(freq, start, dur, gain) {
  const s0 = Math.round(start * RATE)
  const n = Math.round(dur * RATE)
  for (let i = 0; i < n && s0 + i < total; i++) {
    const t = i / RATE
    const env = Math.min(1, t / 0.006) * Math.exp(-t * 4.2)
    const w =
      Math.sin(2 * Math.PI * freq * t) +
      0.35 * Math.sin(2 * Math.PI * freq * 2.01 * t) * Math.exp(-t * 3)
    data[s0 + i] += w * env * gain
  }
}
bell(784, 0, 0.9, 0.5) // sol
bell(1175, 0.22, 1.0, 0.45) // re

const pcm = Buffer.alloc(44 + total * 2)
pcm.write('RIFF', 0)
pcm.writeUInt32LE(36 + total * 2, 4)
pcm.write('WAVEfmt ', 8)
pcm.writeUInt32LE(16, 16)
pcm.writeUInt16LE(1, 20)
pcm.writeUInt16LE(1, 22)
pcm.writeUInt32LE(RATE, 24)
pcm.writeUInt32LE(RATE * 2, 28)
pcm.writeUInt16LE(2, 32)
pcm.writeUInt16LE(16, 34)
pcm.write('data', 36)
pcm.writeUInt32LE(total * 2, 40)
for (let i = 0; i < total; i++) {
  pcm.writeInt16LE(Math.round(Math.max(-1, Math.min(1, data[i])) * 32000), 44 + i * 2)
}
await mkdir(outDir, { recursive: true })
await writeFile(resolve(outDir, 'myjournal_reminder.wav'), pcm)
console.log('scritto myjournal_reminder.wav', pcm.length, 'byte')
