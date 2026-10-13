import { useEffect, useRef, useState } from 'react'
import Icon from './Icon'
import { useBackClose } from '../hooks/useBack'
import GeminiWait from './GeminiWait'
import VoiceRecordButton from './VoiceRecordButton'
import GeminiUsage from './GeminiUsage'
import {
  draftNoteFromPrompt,
  describeGeminiError,
  loadGeminiPromptDraft,
  clearGeminiPromptDraft,
  saveGeminiCustomInstructions,
} from '../lib/gemini'
import {
  ensureGeminiDraft,
  newGeminiDraftId,
  removeGeminiDraft,
  saveGeminiDraft,
} from '../lib/geminiDrafts'
import { listVoices } from '../lib/voiceStore'
import { toast } from '../lib/toast'
import { describeError } from '../lib/notes'
import { searchPlaces } from '../lib/leaflet'

// Dialog per creare una nota intera con Gemini da un prompt scritto. Il
// risultato apre la nota già compilata, da rivedere prima di salvare — nulla
// viene salvato da qui.
//
// Quello che si scrive (e i vocali registrati) è una bozza legata a `dateKey`,
// il giorno della nota: chiudendo il pannello resta salvata sul dispositivo e
// compare nella linguetta a destra (DraftsTab), da cui si riapre passando
// `draft`.

// Esempi vari per il placeholder del prompt: uno diverso a ogni apertura del
// dialog, invece di un unico esempio fisso (con un nome sempre uguale).
const PROMPT_PLACEHOLDERS = [
  'Es. oggi pranzo con Marco al ristorante vicino al lago, giornata bellissima…',
  'Es. mattinata di lavoro intensa, poi corsa al parco e cena con la famiglia…',
  'Es. giornata no: sveglia tardi, riunione stressante, serata di recupero con un film…',
  'Es. gita fuori porta con gli amici, tanto sole e la scoperta di un paesino carino…',
  'Es. giornata tranquilla in casa, un po’ di lettura e la spesa fatta insieme…',
  'Es. mattina dal dentista, poi shopping e aperitivo con i colleghi…',
]

function resolveIds(names, list, keyName) {
  const wanted = names.map((n) => n.trim().toLowerCase())
  return list.filter((x) => wanted.includes(x[keyName].trim().toLowerCase())).map((x) => x.id)
}

async function resolvePlace(name) {
  if (!name) return null
  try {
    const found = await searchPlaces(name)
    return found[0]
      ? { name: found[0].shortName, lat: found[0].lat, lon: found[0].lon }
      : { name, lat: null, lon: null }
  } catch {
    return { name, lat: null, lon: null }
  }
}

export default function NewNoteWithGeminiSheet({
  open,
  onClose,
  apiKey,
  customInstructions,
  allPeople,
  allTags,
  onGenerated,
  dateKey,
  draft: resumeDraft = null,
}) {
  const [prompt, setPrompt] = useState('')
  // testo corrente, leggibile anche da callback che arrivano a pannello chiuso
  const promptRef = useRef('')
  const closeRef = useRef(null)
  useBackClose(open, () => closeRef.current?.())
  const [draftId, setDraftId] = useState('')
  const [placeholder, setPlaceholder] = useState(PROMPT_PLACEHOLDERS[0])
  const [loading, setLoading] = useState(false)
  const [retry, setRetry] = useState(null)
  const [error, setError] = useState('')

  const [instructions, setInstructions] = useState(customInstructions || '')
  const [savingInstructions, setSavingInstructions] = useState(false)
  const [instructionsStatus, setInstructionsStatus] = useState(null)
  const [instructionsOpen, setInstructionsOpen] = useState(false)

  useEffect(() => {
    if (!open) return
    // Se un tentativo precedente è fallito (rete, chiave, limite...) il
    // prompt scritto è ancora in locale: lo si ritrova qui invece di
    // doverlo riscrivere da capo.
    let text = ''
    if (resumeDraft) {
      setDraftId(resumeDraft.id)
      text = resumeDraft.text || ''
    } else {
      setDraftId(newGeminiDraftId())
      // testo di un tentativo fallito prima che esistessero le bozze per nota
      text = loadGeminiPromptDraft()
      if (text) clearGeminiPromptDraft()
    }
    setPrompt(text)
    setPlaceholder(
      PROMPT_PLACEHOLDERS[Math.floor(Math.random() * PROMPT_PLACEHOLDERS.length)],
    )
    setLoading(false)
    setRetry(null)
    setError('')
    setInstructions(customInstructions || '')
    setInstructionsStatus(null)
    setInstructionsOpen(false)
  }, [open, customInstructions, resumeDraft])

  promptRef.current = prompt

  if (!open) return null

  const ready = Boolean(apiKey)

  // Tiene la bozza in pari col testo (se c'è testo); i vocali hanno già il loro
  // `draftId` e si salvano da soli.
  function keepDraft(text) {
    if (text.trim()) saveGeminiDraft({ id: draftId, dateKey, text })
  }

  // Chiusura col pulsante ✕ (o toccando fuori): se c'è qualcosa di scritto o
  // registrato resta come bozza e lo si dice.
  // «indietro» chiude come la ✕: la nota resta salvata come bozza
  closeRef.current = closeSheet

  async function closeSheet() {
    const voices = (await listVoices()).filter((v) => v.draftId === draftId)
    if (prompt.trim() || voices.length) {
      saveGeminiDraft({ id: draftId, dateKey, text: prompt })
      toast("Nota salvata come bozza: la trovi nell'etichetta a destra dello schermo.")
    } else {
      removeGeminiDraft(draftId)
    }
    onClose()
  }
  async function saveInstructions() {
    setSavingInstructions(true)
    setInstructionsStatus(null)
    try {
      await saveGeminiCustomInstructions(instructions)
      setInstructionsStatus({ ok: true, message: 'Salvato.' })
    } catch (err) {
      setInstructionsStatus({ ok: false, message: describeError(err) })
    } finally {
      setSavingInstructions(false)
    }
  }

  async function generateFromPrompt() {
    if (!prompt.trim() || loading) return
    setLoading(true)
    setRetry(null)
    setError('')
    try {
      const draft = await draftNoteFromPrompt(apiKey, prompt.trim(), {
        peopleNames: allPeople.map((p) => p.name),
        tagNames: allTags.map((t) => t.name),
        customInstructions: instructions,
        onRetry: (attempt, maxAttempts, model) => setRetry({ attempt, maxAttempts, model }),
      })
      onGenerated({
        title: draft.title,
        content: draft.content,
        tagIds: resolveIds(draft.tags, allTags, 'name'),
        peopleIds: resolveIds(draft.people, allPeople, 'name'),
        place: await resolvePlace(draft.place),
        mood: draft.mood,
        timeStart: draft.timeStart,
        timeEnd: draft.timeEnd,
        geminiDraftId: draftId,
      })
      // La bozza (testo + vocali originali) resta sul dispositivo finché la nota
      // generata non viene davvero salvata: lo farà la pagina nota (discardGeminiDraft).
      saveGeminiDraft({ id: draftId, dateKey, text: prompt })
      onClose()
    } catch (err) {
      setError(describeGeminiError(err))
    } finally {
      setLoading(false)
      setRetry(null)
    }
  }

  return (
    <div className="ncs-backdrop" onClick={closeSheet}>
      <div className="ncs-sheet gms-sheet gms-readable" onClick={(e) => e.stopPropagation()}>
        <span className="ncs-tape a" aria-hidden="true" />
        <span className="ncs-tape b" aria-hidden="true" />

        <div className="ncs-head">
          <div className="flex items-center gap-2">
            <h3 className="ncs-title">Nuova nota con Gemini</h3>
          </div>
          <button type="button" onClick={closeSheet} className="gms-chev" title="Chiudi" aria-label="Chiudi">
            <Icon name="x" size={15} strokeWidth={2.8} />
          </button>
        </div>

        <div className="gms-body">
          {!ready ? (
            <p className="gms-empty">
              Configura una chiave API Gemini in Profilo per usare questa
              funzione.
            </p>
          ) : loading ? (
            <GeminiWait label="Preparo la nota…" retry={retry} />
          ) : (
            <div className="gms-stack">
              <p className="gms-hint">
                Racconta cosa è successo: Gemini prova a ricavare titolo, testo,
                tag, persone e luogo. Potrai correggere tutto prima di salvare.
              </p>
              <textarea
                autoFocus
                rows={9}
                placeholder={placeholder}
                value={prompt}
                onChange={(e) => {
                  const v = e.target.value
                  setPrompt(v)
                  keepDraft(v)
                }}
                className="gms-field gms-field-lg"
              />
              <VoiceRecordButton
                apiKey={apiKey}
                draftId={draftId}
                disabled={loading}
                onSaved={() => ensureGeminiDraft({ id: draftId, dateKey, text: promptRef.current })}
                onTranscribed={(text) => {
                  // anche a pannello chiuso (trascrizione finita dopo la ✕): il testo
                  // finisce comunque nella bozza
                  const p = promptRef.current
                  const next = p.trim() ? `${p.trim()} ${text}` : text
                  promptRef.current = next
                  setPrompt(next)
                  keepDraft(next)
                }}
              />
              <GeminiUsage />
              <button
                type="button"
                disabled={!prompt.trim()}
                onClick={generateFromPrompt}
                className="gms-cta"
              >
                Genera nota
              </button>

              <div className="gms-instructions">
                <button
                  type="button"
                  onClick={() => setInstructionsOpen((v) => !v)}
                  className="gms-instructions-label"
                >
                  <Icon name="edit" size={13} />
                  Istruzioni per le note
                  <Icon
                    name="chevron-right"
                    size={12}
                    className={'gms-instructions-chev' + (instructionsOpen ? ' open' : '')}
                  />
                </button>
                {instructionsOpen && (
                  <>
                    <textarea
                      rows={6}
                      placeholder='Es. "scrivi in tono ironico" oppure "non menzionare mai il lavoro a meno che non sia esplicito"'
                      value={instructions}
                      onChange={(e) => setInstructions(e.target.value)}
                      className="gms-field"
                    />
                    {instructionsStatus && (
                      <p
                        className={
                          'text-xs ' +
                          (instructionsStatus.ok ? 'text-save-dark' : 'text-delete-dark')
                        }
                      >
                        {instructionsStatus.message}
                      </p>
                    )}
                    <button
                      type="button"
                      onClick={saveInstructions}
                      disabled={savingInstructions}
                      className="gms-instructions-save"
                    >
                      {savingInstructions ? 'Salvo…' : 'Salva istruzioni'}
                    </button>
                  </>
                )}
              </div>
            </div>
          )}

          {error && <p className="gms-error">{error}</p>}
        </div>
      </div>
    </div>
  )
}
