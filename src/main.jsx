import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import { Capacitor } from '@capacitor/core'
import { registerSW } from 'virtual:pwa-register'
import './index.css'
import { applyPrefs, watchSystemTheme } from './lib/prefs'
import { installAudioUnlock } from './lib/sounds'
import { getBackend } from './lib/backend'
import { migrateLocalStorage, migrateLegacyIndexedDb } from './lib/legacyMigration'

// Tema e font scelti dall'utente: applicati subito, prima del render.
migrateLocalStorage()
applyPrefs()
watchSystemTheme()
installAudioUnlock()

// Aggiorna il service worker in background quando c'è una nuova versione.
// Nell'app Android (Capacitor) i file sono già dentro l'APK: niente service worker.
if (!Capacitor.isNativePlatform()) registerSW({ immediate: true })

const root = createRoot(document.getElementById('root'))

// Alla prima apertura si sceglie dove tengono i dati (su questo dispositivo o
// su un proprio server, vedi src/lib/backend.js). L'app vera si carica solo
// dopo, così nessun modulo parla con un indirizzo non ancora scelto.
async function start() {
  await migrateLegacyIndexedDb()
  if (!getBackend()) {
    const { default: BackendChooser } = await import('./pages/BackendChooser.jsx')
    root.render(
      <StrictMode>
        <BackendChooser />
      </StrictMode>,
    )
    return
  }
  const { backendReady } = await import('./lib/pocketbase')
  try {
    await backendReady
  } catch (err) {
    console.error('Archivio locale non disponibile', err)
  }
  const { default: App } = await import('./App.jsx')
  root.render(
    <StrictMode>
      <App />
    </StrictMode>,
  )
}

start()
