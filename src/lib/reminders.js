import { Capacitor } from '@capacitor/core'
import { LocalNotifications } from '@capacitor/local-notifications'

// Promemoria periodici "scrivi la nota del giorno" (solo app Android).
// Salvati sul dispositivo (localStorage) e programmati come notifiche locali
// ripetute: funzionano anche ad app chiusa e senza rete.
//   { id, time: 'HH:MM', days: [0..6] (0 = domenica), enabled, text? }
// `text` = testo della notifica (vuoto/assente = DEFAULT_TEXT).

const KEY = 'myjournal.reminders'
// Un canale Android non si può modificare dopo la creazione: per dargli il suono
// proprio (res/raw/myjournal_reminder.wav, vedi scripts/generate-sounds.js) ne
// serve uno nuovo, e il vecchio ('reminders', suono predefinito) si elimina.
const CHANNEL = 'reminders-bell'
const OLD_CHANNEL = 'reminders'
export const DAY_LABELS = ['D', 'L', 'M', 'M', 'G', 'V', 'S']
export const ALL_DAYS = [0, 1, 2, 3, 4, 5, 6]
// La settimana si mostra da lunedì (i giorni restano numerati 0 = domenica ... 6 = sabato).
export const WEEK_ORDER = [1, 2, 3, 4, 5, 6, 0]
export const DEFAULT_TEXT = 'Com’è andata oggi? Scrivi la nota del giorno.'

export const remindersSupported = () => Capacitor.isNativePlatform()

export function loadReminders() {
  try {
    const list = JSON.parse(localStorage.getItem(KEY) || '[]')
    return Array.isArray(list) ? list : []
  } catch {
    return []
  }
}

function save(list) {
  try {
    localStorage.setItem(KEY, JSON.stringify(list))
  } catch {
    /* storage non disponibile */
  }
}

export function newReminder(list) {
  const id = list.reduce((m, r) => Math.max(m, r.id), 0) + 1
  return { id, time: '21:00', days: ALL_DAYS, enabled: true, text: '' }
}

// Un id di notifica per promemoria (ogni giorno) o per giorno della settimana.
const notifId = (reminderId, weekday) => reminderId * 10 + (weekday ?? 8)

export async function ensurePermission() {
  let p = await LocalNotifications.checkPermissions()
  if (p.display === 'prompt' || p.display === 'prompt-with-rationale') {
    p = await LocalNotifications.requestPermissions()
  }
  return p.display === 'granted'
}

// Riallinea le notifiche programmate con l'elenco salvato.
export async function applyReminders(list) {
  save(list)
  if (!remindersSupported()) return true
  const pending = await LocalNotifications.getPending()
  if (pending.notifications.length) {
    await LocalNotifications.cancel({
      notifications: pending.notifications.map((n) => ({ id: n.id })),
    })
  }
  const active = list.filter((r) => r.enabled && r.days.length)
  if (!active.length) return true
  if (!(await ensurePermission())) return false
  await LocalNotifications.deleteChannel({ id: OLD_CHANNEL }).catch(() => {})
  await LocalNotifications.createChannel({
    id: CHANNEL,
    name: 'Promemoria nota del giorno',
    importance: 4,
    sound: 'myjournal_reminder.wav',
  }).catch(() => {})

  const notifications = []
  for (const r of active) {
    const [hour, minute] = r.time.split(':').map(Number)
    const base = {
      title: 'MyJournal',
      body: (r.text || '').trim() || DEFAULT_TEXT,
      channelId: CHANNEL,
      extra: { newNote: true },
    }
    if (r.days.length === 7) {
      notifications.push({
        ...base,
        id: notifId(r.id),
        schedule: { on: { hour, minute }, allowWhileIdle: true },
      })
    } else {
      for (const d of r.days) {
        notifications.push({
          ...base,
          id: notifId(r.id, d),
          // Capacitor: 1 = domenica ... 7 = sabato
          schedule: { on: { weekday: d + 1, hour, minute }, allowWhileIdle: true },
        })
      }
    }
  }
  await LocalNotifications.schedule({ notifications })
  return true
}
