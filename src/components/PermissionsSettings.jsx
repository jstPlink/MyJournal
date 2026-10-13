import { useCallback, useEffect, useState } from 'react'
import { App } from '@capacitor/app'
import { haptic } from '../lib/haptics'
import { getTilt, setTilt } from '../lib/prefs'
import {
  openAppSettings,
  openBatterySettings,
  openExactAlarmSettings,
  openNotificationSettings,
  permissionsNative,
  readPermissions,
  requestMicrophone,
  requestNotifications,
} from '../lib/permissions'

// Impostazioni → Permessi: cosa è concesso all'app e a cosa serve, con il
// pulsante per concederlo (o per aprire la schermata di Android dove si
// cambia a mano). Si riaggiorna da solo quando torni nell'app dopo aver
// cambiato un permesso nelle impostazioni del telefono.
const BADGE = {
  ok: 'border-save-dark bg-save text-ink',
  no: 'border-delete-dark bg-delete/15 text-delete-dark',
  ask: 'border-line bg-tag text-ink',
  na: 'border-line-soft bg-transparent text-ink-soft',
}

function Row({ title, why, label, tone, action, actionLabel }) {
  return (
    <div className="rounded-xl border border-line bg-cream p-3">
      <div className="flex items-center justify-between gap-2">
        <span className="font-bold text-ink">{title}</span>
        <span className={'rounded-full border px-3 py-0.5 text-xs font-bold ' + BADGE[tone]}>{label}</span>
      </div>
      <p className="mt-1 text-ink-soft">{why}</p>
      {action && (
        <button
          type="button"
          onClick={() => {
            haptic()
            action()
          }}
          className="mt-2 rounded-full border border-line bg-tag px-4 py-1.5 text-xs font-bold text-ink"
        >
          {actionLabel}
        </button>
      )}
    </div>
  )
}

export default function PermissionsSettings() {
  const [p, setP] = useState(null)
  const [error, setError] = useState('')
  const [tilt, setTiltState] = useState(getTilt())
  const native = permissionsNative()

  const refresh = useCallback(async () => {
    try {
      setP(await readPermissions())
    } catch {
      setError('Non riesco a leggere i permessi su questo dispositivo.')
    }
  }, [])

  useEffect(() => {
    const first = setTimeout(refresh, 0)
    const onVisible = () => document.visibilityState === 'visible' && refresh()
    document.addEventListener('visibilitychange', onVisible)
    let handle
    if (native) App.addListener('resume', refresh).then((h) => (handle = h))
    return () => {
      clearTimeout(first)
      document.removeEventListener('visibilitychange', onVisible)
      handle?.remove()
    }
  }, [native, refresh])

  async function run(fn) {
    setError('')
    try {
      await fn()
    } catch {
      setError('Operazione non riuscita su questo dispositivo.')
    }
    refresh()
  }

  if (!p) return <p className="text-xs text-ink-soft sm:text-sm">Controllo i permessi…</p>

  const mic = p.microphone
  const micRow =
    mic === 'granted'
      ? { label: 'Concesso', tone: 'ok' }
      : mic === 'denied'
        ? { label: 'Negato', tone: 'no', actionLabel: 'Apri impostazioni', action: () => run(openAppSettings) }
        : mic === 'unknown'
          ? { label: 'Non rilevabile', tone: 'na' }
          : {
              label: 'Da concedere',
              tone: 'ask',
              actionLabel: 'Consenti',
              action: () => run(requestMicrophone),
            }

  const notifRow =
    p.notifications === true
      ? { label: 'Concesso', tone: 'ok' }
      : p.notifications === false
        ? {
            label: 'Negato',
            tone: 'no',
            actionLabel: native ? 'Consenti' : null,
            action: native
              ? () =>
                  run(async () => {
                    const s = await requestNotifications()
                    // la richiesta non compare più se già negata di recente: serve la schermata di sistema
                    if (!s.notifications) await openNotificationSettings()
                  })
              : null,
          }
        : { label: 'Da concedere', tone: 'ask' }

  return (
    <div className="space-y-3 text-xs sm:text-sm">
      <p className="text-ink-soft">
        {native
          ? "Cosa hai concesso all'app Android (e i sensori che usa). Se cambi un permesso nelle impostazioni del telefono, qui si aggiorna al tuo ritorno."
          : 'Cosa hai concesso a questo sito nel browser. Per cambiarli usa le impostazioni del sito (lucchetto accanto all’indirizzo).'}
      </p>

      <Row
        title="Microfono"
        why="Serve per dettare a voce (“Detta un vocale”) nelle note con Gemini."
        {...micRow}
      />
      <Row
        title="Notifiche"
        why="Servono per i promemoria “scrivi la nota del giorno”."
        {...notifRow}
      />
      <Row
        title="Giroscopio"
        why="Fa dondolare le foto a destra e a sinistra quando inclini il telefono. Android non chiede nessun permesso per questo sensore: qui si vede solo se c'è."
        label={p.gyroscope === true ? 'Disponibile' : p.gyroscope === false ? 'Non disponibile' : 'Non rilevabile'}
        tone={p.gyroscope === true ? 'ok' : p.gyroscope === false ? 'no' : 'na'}
        actionLabel={tilt ? 'Spegni le foto che oscillano' : 'Accendi le foto che oscillano'}
        action={
          p.gyroscope === false
            ? null
            : () => {
                setTilt(!tilt)
                setTiltState(!tilt)
              }
        }
      />
      {native && p.exactAlarmsNeeded && (
        <Row
          title="Allarmi precisi"
          why="Senza, Android può ritardare i promemoria di diversi minuti rispetto all’orario scelto."
          label={p.exactAlarms ? 'Concesso' : 'Negato'}
          tone={p.exactAlarms ? 'ok' : 'no'}
          action={p.exactAlarms ? null : () => run(openExactAlarmSettings)}
          actionLabel="Apri impostazioni"
        />
      )}
      {native && (
        <Row
          title="Risparmio batteria"
          why="Con le restrizioni Android può ritardare o saltare i promemoria ad app chiusa. In Batteria scegli “Nessuna restrizione” per MyJournal."
          label={p.batteryUnrestricted ? 'Senza restrizioni' : 'Ottimizzata'}
          tone={p.batteryUnrestricted ? 'ok' : 'ask'}
          action={p.batteryUnrestricted ? null : () => run(openBatterySettings)}
          actionLabel="Apri impostazioni"
        />
      )}

      {error && <p className="font-semibold text-delete-dark">{error}</p>}

      {native && (
        <button
          type="button"
          onClick={() => {
            haptic()
            run(openAppSettings)
          }}
          className="w-full rounded-full border border-line bg-tag px-4 py-2 text-xs font-bold text-ink"
        >
          Apri le impostazioni dell’app
        </button>
      )}
    </div>
  )
}
