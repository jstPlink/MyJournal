import { Capacitor } from '@capacitor/core'
import { Haptics, ImpactStyle } from '@capacitor/haptics'
import { playSound } from './sounds'

let last = 0

// Breve feedback aptico, SOLO sul tocco dei pulsanti d'azione (non su
// selezioni, schede, filtri, scorrimenti): per questo si chiama haptic() a mano
// nei singoli pulsanti, e NON c'è un listener globale su ogni elemento
// cliccabile. Intensità dimezzata rispetto a prima (8 ms → 4 ms nel browser;
// nell'app Android una vibrazione breve da 10 ms, invece dell'impatto
// "leggero" predefinito). Nel browser usa navigator.vibrate, dove supportato.
// Chiamate ravvicinate (< 40 ms) vengono unite.
// `sound` = suono che accompagna il tocco (vedi sounds.js; i suoni si spengono
// da Impostazioni → Aspetto).
export function haptic(ms = 4, sound = 'tap') {
  const now = Date.now()
  if (now - last < 40) return
  last = now
  playSound(sound)
  try {
    if (Capacitor.isNativePlatform()) {
      if (Capacitor.getPlatform() === 'android') {
        Haptics.vibrate({ duration: 10 }).catch(() => {})
      } else {
        Haptics.impact({ style: ImpactStyle.Light }).catch(() => {})
      }
    } else if (typeof navigator !== 'undefined' && typeof navigator.vibrate === 'function') {
      navigator.vibrate(ms)
    }
  } catch {
    /* non supportato: ignora */
  }
}

