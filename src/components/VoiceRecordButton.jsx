import { useCallback, useEffect, useRef, useState } from 'react'
import { createPortal } from 'react-dom'
import { Capacitor } from '@capacitor/core'
import Icon from './Icon'
import { transcribeAudio, transcribeWithGroq, describeGeminiError } from '../lib/gemini'
import { useAuth } from '../context/AuthContext'
import { blobToWav } from '../lib/audio'
import { playSound } from '../lib/sounds'
import { deleteVoice, listVoices, saveVoice, subscribeVoices, updateVoice } from '../lib/voiceStore'

const fmtLen = (s) => `${Math.floor(s / 60)}:${String(s % 60).padStart(2, '0')}`
const fmtAgo = (t) => {
  const m = Math.round((Date.now() - t) / 60000)
  if (m < 1) return 'adesso'
  if (m < 60) return `${m} min fa`
  const h = Math.round(m / 60)
  return h < 24 ? `${h} h fa` : `${Math.round(h / 24)} g fa`
}

// Nessun limite di durata: il pulsante mostra il tempo trascorso e si ferma solo quando
// lo tocchi.

const fmtTime = (s) => `${Math.floor(s / 60)}:${String(s % 60).padStart(2, '0')}`

const CANDIDATE_TYPES = [
  'audio/webm;codecs=opus',
  'audio/webm',
  'audio/mp4',
  'audio/ogg;codecs=opus',
]

function pickMimeType() {
  if (typeof MediaRecorder === 'undefined') return ''
  return CANDIDATE_TYPES.find((t) => MediaRecorder.isTypeSupported?.(t)) || ''
}

function blobToBase64(blob) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader()
    reader.onload = () => {
      const dataUrl = reader.result
      resolve(dataUrl.slice(dataUrl.indexOf(',') + 1))
    }
    reader.onerror = () => reject(reader.error)
    reader.readAsDataURL(blob)
  })
}

// Bottone per dettare un pezzo di prompt invece di scriverlo: registra con
// il microfono e fa trascrivere l'audio a Gemini, che capisce l'audio
// direttamente — più affidabile del dettato dello smartphone, specie su
// nomi propri e termini particolari. Il testo trascritto va al chiamante
// (`onTranscribed`), che decide se accodarlo o sostituire il prompt: qui non
// si tocca il campo direttamente. Non renderizza nulla se il browser non
// supporta la registrazione o manca la chiave Gemini.
//
// Finita la registrazione il vocale NON viene trascritto da solo: si salva sul
// dispositivo con un titolo (modificabile) e l'utente sceglie quando premere
// «Trascrivi». `draftId` lega i vocali a una nota Gemini in sospeso: l'elenco
// mostra solo quelli di quella nota (più quelli vecchi senza nota); senza
// `draftId` mostra solo i vocali non legati a nessuna nota.
// Riproduce un vocale salvato (anteprima, senza trascrivere).
function VoicePlay({ voice }) {
  const [playing, setPlaying] = useState(false)
  const audio = useRef(null)
  const url = useRef('')

  useEffect(
    () => () => {
      audio.current?.pause()
      if (url.current) URL.revokeObjectURL(url.current)
    },
    [],
  )

  function toggle() {
    if (!audio.current) {
      url.current = URL.createObjectURL(voice.blob)
      audio.current = new Audio(url.current)
      audio.current.onended = () => setPlaying(false)
    }
    if (playing) {
      audio.current.pause()
      setPlaying(false)
    } else {
      audio.current.play().then(
        () => setPlaying(true),
        () => setPlaying(false),
      )
    }
  }

  return (
    <button
      type="button"
      onClick={toggle}
      aria-label={playing ? 'Ferma' : 'Ascolta'}
      className="gvs-play"
    >
      {playing ? '■' : '▶'}
    </button>
  )
}

export default function VoiceRecordButton({ apiKey, onTranscribed, onSaved, disabled, draftId, bubble = false, fab = false, listHost = null }) {
  const { user } = useAuth()
  const groqKey = user?.groqApiKey?.trim()
  const [state, setState] = useState('idle') // idle | recording | transcribing
  const [seconds, setSeconds] = useState(0)
  const [error, setError] = useState('')
  // testo di avanzamento mostrato nel pulsante mentre Gemini trascrive (con i tentativi)
  const [progress, setProgress] = useState('')
  // Elenco dei vocali salvati sul dispositivo e non ancora trascritti.
  const [saved, setSaved] = useState([])
  const mediaRef = useRef(null)
  const chunksRef = useRef([])
  const streamRef = useRef(null)
  const timerRef = useRef(null)
  const elapsedRef = useRef(0)

  // Il browser nasconde del tutto navigator.mediaDevices fuori da un
  // "contesto sicuro" (HTTPS, o localhost): niente errore, l'API proprio non
  // esiste. Capita testando l'app dal telefono sull'indirizzo di rete locale
  // (es. http://192.168.x.x:5173) invece che in produzione (HTTPS) — sul PC
  // "localhost" è esentato dal requisito, per questo lì il bottone si vede
  // comunque. Lo segnaliamo invece di sparire silenziosamente, altrimenti
  // sembra un bottone dimenticato.
  const insecure = typeof window !== 'undefined' && window.isSecureContext === false
  const supported =
    !insecure &&
    typeof navigator !== 'undefined' &&
    Boolean(navigator.mediaDevices?.getUserMedia) &&
    typeof MediaRecorder !== 'undefined'

  useEffect(
    () => () => {
      clearInterval(timerRef.current)
      // pannello chiuso durante la registrazione: si ferma e la registrazione si salva
      // lo stesso (onstop)
      if (mediaRef.current?.state === 'recording') mediaRef.current.stop()
      streamRef.current?.getTracks().forEach((t) => t.stop())
    },
    [],
  )

  // Vocali salvati sul dispositivo e non ancora trascritti (anche di sessioni
  // precedenti): vedi lib/voiceStore.js.
  const refreshSaved = useCallback(async () => {
    const all = await listVoices()
    setSaved(all.filter((v) => !v.draftId || v.draftId === draftId))
  }, [draftId])
  useEffect(() => {
    const t = setTimeout(refreshSaved, 0)
    const off = subscribeVoices(refreshSaved)
    return () => {
      clearTimeout(t)
      off()
    }
  }, [refreshSaved])

  if (!apiKey && !groqKey) return null
  if (!supported) {
    return (
      <p className="gms-voice-error">
        {insecure
          ? 'Dettatura non disponibile: serve una connessione sicura (https) — su questo indirizzo il browser blocca il microfono.'
          : 'Dettatura non disponibile su questo browser.'}
      </p>
    )
  }

  function stop() {
    clearInterval(timerRef.current)
    playSound('recStop')
    mediaRef.current?.stop()
  }

  async function transcribe(blob, mimeType, id) {
    setState('transcribing')
    setError('')
    const onRetry = (attempt, max, model) =>
      setProgress(`Generando con Gemini${model ? ` (${model})` : ''}. Tentativo ${attempt + 1}/${max}`)
    setProgress('Generando con Gemini. Tentativo 1/5')
    try {
      let text
      // Con la chiave Groq si prova prima Whisper (veloce, quasi mai intasato);
      // se fallisce e c'è anche Gemini si ripiega su Gemini.
      if (groqKey) {
        try {
          setProgress('Generando con Groq. Tentativo 1/2')
          text = await transcribeWithGroq(groqKey, blob, mimeType, (attempt, max) =>
            setProgress(`Generando con Groq. Tentativo ${attempt + 1}/${max}`),
          )
        } catch (err) {
          if (!apiKey) throw err
          setProgress('Groq non risponde. Generando con Gemini. Tentativo 1/5')
        }
      }
      if (text == null) try {
        text = await transcribeAudio(apiKey, { audioBase64: await blobToBase64(blob), mimeType }, onRetry)
      } catch (err) {
        // Il telefono registra in WebM/MP4, formati che Gemini non dichiara
        // di supportare: se rifiuta l'audio (400 che non riguarda la chiave)
        // si riprova col WAV, quello ufficiale, ricavato dalla stessa registrazione.
        const rejectedFormat =
          err?.status === 400 && !/api key/i.test(err.message || '') && mimeType !== 'audio/wav'
        if (!rejectedFormat) throw err
        const wav = await blobToWav(blob)
        setProgress('Riprovo con un altro formato audio…')
        text = await transcribeAudio(apiKey, { audioBase64: await blobToBase64(wav), mimeType: 'audio/wav' }, onRetry)
      }
      onTranscribed(text)
      // Nella nota con Gemini il vocale originale resta (segnato «trascritto») fino a
      // quando la nota non viene creata; fuori da lì si cancella subito.
      if (draftId) await updateVoice(id, { transcribed: true })
      else await deleteVoice(id)
    } catch (err) {
      setError(describeGeminiError(err))
    } finally {
      setState('idle')
      setProgress('')
      refreshSaved()
    }
  }

  // Ritrascrive un vocale salvato (anche di una sessione precedente).
  function retrySaved(v) {
    transcribe(v.blob, v.mimeType, v.id)
  }
  async function discardSaved(v) {
    await deleteVoice(v.id)
    refreshSaved()
  }

  async function start() {
    setError('')
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true })
      streamRef.current = stream
      const mimeType = pickMimeType()
      const rec = new MediaRecorder(stream, mimeType ? { mimeType } : undefined)
      chunksRef.current = []
      rec.ondataavailable = (e) => {
        if (e.data.size) chunksRef.current.push(e.data)
      }
      rec.onstop = async () => {
        streamRef.current?.getTracks().forEach((t) => t.stop())
        const type = rec.mimeType || mimeType || 'audio/webm'
        const blob = new Blob(chunksRef.current, { type })
        // Salvato sul dispositivo con un titolo; la trascrizione la decide
        // l'utente dall'elenco (così non si spreca una richiesta a Gemini e
        // il vocale non si perde se Gemini è intasato o si chiude l'app).
        const d = new Date()
        const title = `Vocale ${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}`
        await saveVoice({ blob, mimeType: type, seconds: elapsedRef.current, draftId: draftId || null, title })
        onSaved?.()
        refreshSaved()
        setState('idle')
      }
      mediaRef.current = rec
      rec.start()
      playSound('recStart')
      elapsedRef.current = 0
      setSeconds(0)
      setState('recording')
      timerRef.current = setInterval(() => {
        setSeconds(++elapsedRef.current)
      }, 1000)
    } catch (err) {
      // motivo preciso, per capire al volo cosa non va sul telefono
      if (err?.name === 'NotAllowedError' || err?.name === 'SecurityError') {
        setError(
          Capacitor.isNativePlatform()
            ? 'Microfono bloccato: consenti il permesso Microfono ad MyJournal dalle impostazioni del telefono (Impostazioni → App → MyJournal → Autorizzazioni) e riprova.'
            : "Microfono bloccato: consenti il microfono per questo sito (icona del lucchetto accanto all'indirizzo, oppure Impostazioni del telefono → App → permessi) e riprova.",
        )
      } else if (err?.name === 'NotFoundError') {
        setError('Nessun microfono trovato su questo dispositivo.')
      } else if (err?.name === 'NotReadableError' || err?.name === 'AbortError') {
        setError(
          "Il microfono è occupato da un'altra app (una chiamata, un'altra registrazione): chiudila e riprova.",
        )
      } else {
        setError('Microfono non disponibile: ' + (err?.message || 'errore sconosciuto') + '.')
      }
    }
  }

  const savedBlock =
    saved.length > 0 ? (
          <div className="gms-voice-saved">
            <p className="gvs-head">
              {(() => {
                const todo = saved.filter((v) => !v.transcribed).length
                return todo === 1 ? '1 vocale da trascrivere' : `${todo} vocali da trascrivere`
              })()}
            </p>
            <ul>
              {saved.map((v) => (
                <li key={v.id} className={v.transcribed ? 'done' : ''}>
                  <VoicePlay voice={v} />
                  <div className="gvs-main">
                    <input
                      type="text"
                      defaultValue={v.title || ''}
                      placeholder="Titolo del vocale"
                      aria-label="Titolo del vocale"
                      maxLength={60}
                      onBlur={(e) => {
                        const t = e.target.value.trim()
                        if (t !== (v.title || '')) updateVoice(v.id, { title: t })
                      }}
                      className="gms-voice-title"
                    />
                    <span className="gvs-meta">
                      {v.transcribed ? '✓ trascritto · ' : ''}
                      {fmtLen(v.seconds || 0)} · {fmtAgo(v.createdAt)}
                    </span>
                  </div>
                  <button
                    type="button"
                    disabled={state !== 'idle'}
                    onClick={() => retrySaved(v)}
                    className="gms-voice-retry"
                  >
                    Trascrivi
                  </button>
                  <button
                    type="button"
                    disabled={state !== 'idle'}
                    onClick={() => discardSaved(v)}
                    className="gms-voice-discard"
                  >
                    Elimina
                  </button>
                </li>
              ))}
            </ul>
          </div>
    ) : null

  return (
    <div className="gms-voice">
      {fab ? (
        <div className={'gfab' + (fab === 'inline' ? ' inline' : '')}>
          {(state !== 'idle' || false) && (
            <span className={'gfab-time' + (state === 'recording' ? ' rec' : '')}>
              {state === 'recording' ? fmtTime(seconds) : progress || 'Trascrivo…'}
            </span>
          )}
          <button
            type="button"
            onClick={state === 'recording' ? stop : start}
            disabled={disabled || state === 'transcribing'}
            className={'gfab-btn' + (state === 'recording' ? ' rec' : '') + (state === 'transcribing' ? ' busy' : '')}
            title={state === 'recording' ? 'Ferma la registrazione' : 'Detta un vocale'}
            aria-label={state === 'recording' ? 'Ferma la registrazione' : 'Detta un vocale'}
          >
            {state === 'recording' ? <span className="gfab-sq" /> : <Icon name="mic" size={30} />}
          </button>
        </div>
      ) : bubble ? (
        <>
          <button
            type="button"
            onClick={state === 'recording' ? stop : start}
            disabled={disabled || state === 'transcribing'}
            className={
              'dream-mic' +
              (state === 'recording' ? ' recording' : '') +
              (state === 'transcribing' ? ' busy' : '')
            }
            title={state === 'recording' ? 'Ferma la registrazione' : 'Detta un vocale'}
            aria-label={state === 'recording' ? 'Ferma la registrazione' : 'Detta un vocale'}
          >
            <Icon name={state === 'recording' ? 'square' : 'mic'} size={22} />
          </button>
          {state !== 'idle' && (
            <span className="dream-mic-status">
              {state === 'recording' ? fmtTime(seconds) : progress || 'Trascrivo…'}
            </span>
          )}
        </>
      ) : state === 'recording' ? (
        <button
          type="button"
          onClick={stop}
          className="gms-voice-btn recording"
        >
          <span className="gms-voice-label">
            <Icon name="square" size={13} />
            Ferma · {fmtTime(seconds)}
          </span>
        </button>
      ) : (
        <button
          type="button"
          onClick={start}
          disabled={disabled || state === 'transcribing'}
          className="gms-voice-btn"
        >
          <Icon name="mic" size={13} />
          {state === 'transcribing' ? progress || 'Trascrivo…' : 'Detta un vocale'}
        </button>
      )}
      {error && (
        <p className="gms-voice-error">
          {error}
        </p>
      )}
      {listHost ? createPortal(savedBlock, listHost) : savedBlock}
    </div>
  )
}
