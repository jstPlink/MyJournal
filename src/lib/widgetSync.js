import { Capacitor, registerPlugin } from '@capacitor/core'
import { pb } from './pocketbase'
import { addDaysKey, dayKey, timeInputValue, todayKey } from './dates'
import { dayMood, getMoodGradientHex, getMoodStopPositions } from './mood'

// Riepilogo per il widget 3x1 della home (solo app Android): mood degli ultimi
// giorni e ultima nota. Lo calcola l'app e lo passa al widget nativo
// (MyJournalWidgetPlugin → MyJournalSummaryWidget), che lo conserva e lo mostra
// anche ad app chiusa. Quindi il widget è aggiornato all'ultima volta che l'app
// è stata aperta, è tornata in primo piano o ha salvato/eliminato una nota:
// una nota scritta da un altro dispositivo compare alla prossima apertura.
//
// Si mandano 14 giorni (non 7): la finestra "ultima settimana" la calcola il
// widget al momento di disegnarsi, così resta giusta anche se l'app non viene
// aperta per qualche giorno.

const MyJournalWidget = registerPlugin('MyJournalWidget')

export const widgetSupported = () => Capacitor.isNativePlatform()

export async function refreshWidget() {
  if (!widgetSupported() || !pb.authStore.isValid) return
  try {
    const today = todayKey()
    const from = addDaysKey(today, -13)
    const [recent, latest] = await Promise.all([
      pb.collection('note').getFullList({
        filter: pb.filter('date >= {:s} && date <= {:e}', {
          s: `${from} 00:00:00.000Z`,
          e: `${today} 23:59:59.999Z`,
        }),
        fields: 'date,mood',
      }),
      // le ore di fine sono "solo orario" con data segnaposto: ordinano bene come testo
      pb.collection('note').getList(1, 1, { sort: '-date,-timeEnd', fields: 'date,timeEnd', skipTotal: true }),
    ])

    const byDay = new Map()
    for (const n of recent) {
      const d = dayKey(n.date)
      if (!d) continue
      if (!byDay.has(d)) byDay.set(d, [])
      byDay.get(d).push(n)
    }
    const days = [...byDay.entries()]
      .sort(([a], [b]) => (a < b ? -1 : 1))
      .map(([d, notes]) => ({ d, m: dayMood(notes), n: notes.length }))

    const lastNote = latest.items[0]
    const positions = getMoodStopPositions()
    await MyJournalWidget.update({
      days,
      last: lastNote
        ? { date: dayKey(lastNote.date), end: timeInputValue(lastNote.timeEnd) }
        : null,
      stops: getMoodGradientHex().map((c, i) => ({ t: positions[i], c })),
    })
  } catch {
    // offline o plugin assente (APK vecchio): il widget resta com'era
  }
}

let timer = null
// Da chiamare dopo aver salvato/eliminato una nota: ricalcola dopo un attimo
// (accorpa più chiamate ravvicinate).
export function notifyNotesChanged(delayMs = 1200) {
  if (!widgetSupported()) return
  clearTimeout(timer)
  timer = setTimeout(refreshWidget, delayMs)
}
