import { useEffect, useState } from 'react'
import Icon from './Icon'
import GeminiWait from './GeminiWait'
import {
  getDayRecap,
  getMonthRecap,
  getYearRecap,
  isRecapManual,
  releaseRecap,
  clearRecap,
  writeRecap,
  regenerateDayRecap,
  regenerateMonthRecap,
  regenerateYearRecap,
} from '../lib/recaps'
import { describeGeminiError } from '../lib/gemini'
import { yellowOf } from '../lib/pagesSkin'

const TITLES = { day: 'Riassunto del giorno', month: 'Riassunto del mese', year: "Riassunto dell'anno" }

// Recap di un periodo (giorno/vista giorno, mese/vista mese, anno/statistiche):
// di norma è già pronto, aggiornato ogni sera alle 23:00 lato server
// (pb_hooks/main.pb.js), quindi qui si legge e basta — non richiede nessuna
// revisione. Il tasto "Genera"/"Rigenera" serve per i periodi che il server non
// ha ancora coperto (passati, da prima che questa funzione esistesse), per
// averlo subito senza aspettare le 23:00, o per un testo nuovo su richiesta. Nascosta del tutto se non c'è ancora niente da mostrare e non
// si può nemmeno generarlo (nessuna nota, o nessuna chiave Gemini).
export default function PeriodRecapCard({
  period, // 'day' | 'month' | 'year'
  periodKey, // 'YYYY-MM-DD' | 'YYYY-MM' | 'YYYY'
  notes,
  label, // etichetta leggibile per il prompt (mese/anno) — non serve per 'day'
  apiKey,
  title,
  alwaysShow = false, // mostra la card anche senza note né recap (vista giorno)
  foglietto = false, // true = cartoncino giallo strappato con forbici (.dg-recap), uguale ovunque; il titolo sta sempre dentro, con una linea tratteggiata sotto
  className = '',
  style, // variabili CSS in più sul cartoncino (inclinazione e nastro nel Diario)
}) {
  const [text, setText] = useState(undefined) // undefined = in caricamento, null = non generato
  const [loading, setLoading] = useState(false)
  const [retry, setRetry] = useState(null)
  const [error, setError] = useState('')
  const [manual, setManual] = useState(false) // scritto a mano: il server non lo rigenera
  const [editing, setEditing] = useState(false)
  const [draft, setDraft] = useState('')

  useEffect(() => {
    let cancelled = false
    setText(undefined)
    setError('')
    setEditing(false)
    isRecapManual(period, periodKey).then((m) => {
      if (!cancelled) setManual(Boolean(m))
    })
    const reader = period === 'day' ? getDayRecap : period === 'month' ? getMonthRecap : getYearRecap
    reader(periodKey).then((t) => {
      if (!cancelled) setText(t)
    })
    return () => {
      cancelled = true
    }
  }, [period, periodKey])

  if (text === undefined) return null // in caricamento: niente salto di layout per un attimo
  if (!alwaysShow && !text && (!notes || !notes.length)) return null

  async function saveHand() {
    const v = draft.trim()
    setError('')
    if (!v) {
      // vuoto = torna automatico: si elimina il testo e, se si può, se ne genera subito uno nuovo
      try {
        await clearRecap(period, periodKey)
        setText(null)
        setManual(false)
        setEditing(false)
        if (apiKey && notes?.length > 0 && period !== 'year') regenerate()
      } catch (err) {
        setError(describeGeminiError(err))
      }
      return
    }
    try {
      await writeRecap(period, periodKey, v)
      setText(v)
      setManual(true)
      setEditing(false)
    } catch (err) {
      setError(describeGeminiError(err))
    }
  }

  async function backToAuto() {
    try {
      await releaseRecap(period, periodKey, text)
      setManual(false)
    } catch (err) {
      setError(describeGeminiError(err))
    }
  }

  async function regenerate() {
    if (loading) return
    setLoading(true)
    setRetry(null)
    setError('')
    const onRetry = (attempt, maxAttempts, model) => setRetry({ attempt, maxAttempts, model })
    try {
      let next
      if (period === 'day') next = await regenerateDayRecap(apiKey, periodKey, notes, onRetry)
      else if (period === 'month')
        next = await regenerateMonthRecap(apiKey, periodKey, notes, label, onRetry)
      else next = await regenerateYearRecap(apiKey, periodKey, notes, onRetry)
      setText(next)
    } catch (err) {
      setError(describeGeminiError(err))
    } finally {
      setLoading(false)
      setRetry(null)
    }
  }

  const card = (
    <section className="prc-card">
      <div className="prc-head">
        <p className="prc-title">
          <Icon name="sparkles" size={14} className="shrink-0" />
          {title || TITLES[period]}
        </p>
        {!loading && !editing && (
          <span className="prc-actions">
            <button
              type="button"
              onClick={() => {
                setDraft(text || '')
                setEditing(true)
              }}
              className="prc-btn"
            >
              {text ? 'Modifica' : 'Scrivi'}
            </button>
            {apiKey && notes?.length > 0 && (
              <button type="button" onClick={regenerate} className="prc-btn">
                {text ? 'Rigenera' : 'Genera'}
              </button>
            )}
          </span>
        )}
      </div>
      {editing ? (
        <>
          <textarea
            className="prc-edit"
            value={draft}
            onChange={(e) => setDraft(e.target.value)}
            rows={6}
            autoFocus
            placeholder="Scrivi il riassunto a mano… (vuoto = torna automatico)"
          />
          <div className="prc-actions prc-edit-actions">
            <button type="button" onClick={saveHand} className="prc-btn prc-btn-ok">
              Salva
            </button>
            <button type="button" onClick={() => setEditing(false)} className="prc-btn">
              Annulla
            </button>
          </div>
        </>
      ) : loading ? (
        <GeminiWait retry={retry} />
      ) : text ? (
        <p className="prc-text">{text}</p>
      ) : (
        <p className="prc-empty">
          {!notes || !notes.length ? 'Nessuna nota: niente da riassumere.' : 'Riassunto non ancora generato.'}
        </p>
      )}
      {manual && text && !editing && !loading && (
        <p className="prc-manual">
          Scritto a mano: non viene più aggiornato in automatico.{' '}
          <button type="button" onClick={backToAuto} className="prc-link">
            Torna automatico
          </button>
        </p>
      )}
      {error && <p className="prc-error">{error}</p>}
    </section>
  )
  if (!foglietto) return <div className={className}>{card}</div>
  return (
    <div className={'dg-recap-block ' + className} style={{ '--ycol': yellowOf(periodKey), ...style }}>
      <div className="dg-recap dg-recap-page">{card}</div>
    </div>
  )
}
