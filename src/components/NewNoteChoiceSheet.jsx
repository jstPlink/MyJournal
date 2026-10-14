import Icon from './Icon'
import { haptic } from '../lib/haptics'
import { useBackClose } from '../hooks/useBack'

// Scelta rapida da telefono prima di aprire una nuova nota: con Gemini
// (genera una bozza da un prompt o dalle foto) oppure a mano. Sostituisce il
// vecchio pulsante Gemini separato nel footer mobile — un tap in meno da
// mostrare in barra, la scelta emerge solo quando serve. Stessa materia di
// carta/cartoncino della barra mobile (.ncs-*, in index.css), non più il
// pannello bianco generico degli altri picker (tag/luogo/canzone).
export default function NewNoteChoiceSheet({ open, onClose, onGemini, onManual }) {
  useBackClose(open, onClose)
  if (!open) return null

  return (
    <div className="ncs-backdrop" onClick={onClose}>
      <div className="ncs-sheet" onClick={(e) => e.stopPropagation()}>
        <span className="ncs-tape a" aria-hidden="true" />
        <span className="ncs-tape b" aria-hidden="true" />

        <div className="ncs-head">
          <h3 className="ncs-title">Nuova nota</h3>
          <button
            type="button"
            onClick={onClose}
            className="mchev"
            title="Chiudi"
            aria-label="Chiudi"
          >
            <Icon name="x" size={15} strokeWidth={2.8} />
          </button>
        </div>

        <div className="ncs-options">
          <button
            type="button"
            onClick={() => {
              haptic()
              onGemini()
            }}
            className="ncs-option"
          >
            <span className="ncs-opt-icon gemini">
              <Icon name="sparkles" size={18} />
            </span>
            <span className="ncs-opt-text">
              <b>Crea una nota con IA</b>
              <span>Descrivi la giornata o parti dalle foto: la bozza è pronta da rivedere.</span>
            </span>
          </button>

          <button
            type="button"
            onClick={() => {
              haptic()
              onManual()
            }}
            className="ncs-option"
          >
            <span className="ncs-opt-icon paper">
              <Icon name="edit" size={17} />
            </span>
            <span className="ncs-opt-text">
              <b>Manuale</b>
              <span>Scrivi la nota da zero, come sempre.</span>
            </span>
          </button>
        </div>
      </div>
    </div>
  )
}
