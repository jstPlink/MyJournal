import { useEffect, useState } from 'react'
import Icon from './Icon'
import GeminiWait from './GeminiWait'
import {
  getDayRecap,
  getMonthRecap,
  getYearRecap,
  regenerateDayRecap,
  regenerateMonthRecap,
  regenerateYearRecap,
} from '../lib/recaps'
import { describeGeminiError } from '../lib/gemini'

const TITLES = { day: 'Recap del giorno', month: 'Recap del mese', year: "Recap dell'anno" }

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
  tab, // testo di una targhetta (stile .st-label delle Statistiche) sopra la card: sparisce insieme alla card
  tabInside = false, // la targhetta sta dentro la card, all'altezza del tasto Genera/Rigenera
  alwaysShow = false, // mostra la card anche senza note né recap (vista giorno)
  hideTitle = false, // il titolo sta già nella targhetta: dentro la card resta solo il tasto
  className = '',
}) {
  const [text, setText] = useState(undefined) // undefined = in caricamento, null = non generato
  const [loading, setLoading] = useState(false)
  const [retry, setRetry] = useState(null)
  const [error, setError] = useState('')

  useEffect(() => {
    let cancelled = false
    setText(undefined)
    setError('')
    const reader = period === 'day' ? getDayRecap : period === 'month' ? getMonthRecap : getYearRecap
    reader(periodKey).then((t) => {
      if (!cancelled) setText(t)
    })
    return () => {
      cancelled = true
    }
  }, [period, periodKey])

  if (text === undefined) return null // in caricamento: niente salto di layout per un attimo
  if (!alwaysShow && !text && (!apiKey || !notes || !notes.length)) return null

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
    <section className={'prc-card ' + (tab && !tabInside ? '' : className)}>
      <div className={'prc-head' + (hideTitle && !(tab && tabInside) ? ' prc-head-end' : '')}>
        {tab && tabInside ? (
          <span className="st-label prc-tab-in">
            <Icon name="sparkles" size={12} />
            {tab}
          </span>
        ) : (
          !hideTitle && (
          <p className="prc-title">
            <Icon name="sparkles" size={14} className="shrink-0" />
            {title || TITLES[period]}
          </p>
          )
        )}
        {!loading && apiKey && notes?.length > 0 && (
          <button type="button" onClick={regenerate} className="prc-btn">
            {text ? 'Rigenera' : 'Genera'}
          </button>
        )}
      </div>
      {loading ? (
        <GeminiWait retry={retry} />
      ) : text ? (
        <p className="prc-text">{text}</p>
      ) : (
        <p className="prc-empty">
          {!notes || !notes.length ? 'Nessuna nota: niente da riassumere.' : 'Recap non ancora generato.'}
        </p>
      )}
      {error && <p className="prc-error">{error}</p>}
    </section>
  )
  if (!tab || tabInside) return card
  return (
    <div className={className}>
      <span className="st-label">
        <Icon name="sparkles" size={12} />
        {tab}
      </span>
      {card}
    </div>
  )
}
