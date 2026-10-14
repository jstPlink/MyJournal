import { isLocal, pb, serverUrl } from '../lib/pocketbase'
import { resetBackend } from '../lib/backend'
import { haptic } from '../lib/haptics'

// Dove sono i dati e come cambiarlo. `compact` = riga piccola per le
// schermate di accesso; altrimenti blocco per Impostazioni → Archivio.
export function changeBackend() {
  resetBackend()
  pb.authStore.clear()
  window.location.replace('/')
}

export default function BackendInfo({ compact = false, className = '' }) {
  const where = isLocal ? 'su questo dispositivo' : serverUrl.replace(/^https?:\/\//, '')
  const onChange = () => {
    haptic()
    changeBackend()
  }

  if (compact) {
    return (
      <p className={className}>
        Indirizzo database:{' '}
        <button
          type="button"
          onClick={onChange}
          title="Tocca per cambiare indirizzo"
          className="font-bold underline underline-offset-2"
        >
          {where}
        </button>
      </p>
    )
  }

  return (
    <div>
      <p className="text-sm text-ink-soft">
        I tuoi dati sono <span className="font-semibold text-ink">{where}</span>.
        {isLocal && ' Se cancelli i dati dell’app o del browser li perdi: usa ogni tanto Esporta.'}
      </p>
      <button
        type="button"
        onClick={onChange}
        className="mt-3 flex w-full items-center justify-center gap-2 rounded-full border border-line bg-panel px-6 py-3 text-sm font-bold text-ink shadow-sm"
      >
        {isLocal ? 'Cambia archivio' : 'Cambia server'}
      </button>
    </div>
  )
}
