import { useEffect, useRef, useState } from 'react'
import { useLocation, useNavigate, useParams, useSearchParams } from 'react-router-dom'
import Icon from '../components/Icon'
import DatePickerPopover from '../components/DatePickerPopover'
import TimePickerPopover from '../components/TimePickerPopover'
import ClaritySlider from '../components/ClaritySlider'
import { DreamBottom, DreamGarland, DreamScatter, DreamWaves } from '../components/DreamDecor'
import RichText from '../components/RichText'
import TitleInput from '../components/TitleInput'
import VoiceRecordButton from '../components/VoiceRecordButton'
import { useAuth } from '../context/AuthContext'
import { useIsWide } from '../hooks/useIsWide'
import { useGoBack } from '../hooks/useBack'
import { haptic } from '../lib/haptics'
import { playSound } from '../lib/sounds'
import { MONTHS_IT, dayKey, fullDayLabel, parseWall, timeInputValue, todayKey } from '../lib/dates'
import { describeError } from '../lib/notes'
import { toast } from '../lib/toast'
import { listVoices } from '../lib/voiceStore'
import {
  discardDreamDraft,
  ensureDreamDraft,
  newDreamDraftId,
  saveDreamDraft,
} from '../lib/dreamDrafts'
import {
  DEFAULT_DREAM_TIME,
  createDream,
  deleteDream,
  getDream,
  updateDream,
} from '../lib/dreams'

const snap = (o) => JSON.stringify(o)
const escapeHtml = (s) => s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')

// Pagina per scrivere (o modificare) un sogno: rotte /dream/new?date=AAAA-MM-GG e
// /dream/:id. Stesso impianto della nota: su web la colonna di sinistra con data,
// orario e il righello (qui la NITIDEZZA) e il foglio di scrittura a destra; su
// telefono la barra in alto con gli orologi e il righello sopra il foglio. I sogni
// stanno in una collection a parte (lib/dreams.js): non toccano il mood del giorno.
export default function DreamView() {
  const { id } = useParams()
  const [search] = useSearchParams()
  const navigate = useNavigate()
  const goBack = useGoBack()
  const wide = useIsWide()
  const { user } = useAuth()
  const isNew = !id
  // bozza ripresa dalla linguetta celeste (DreamDraftsTab)
  const location = useLocation()
  const resume = isNew ? location.state?.dreamDraft || null : null
  const [draftId] = useState(() => resume?.id || newDreamDraftId())

  const [dateKey, setDateKey] = useState(resume?.dateKey || search.get('date') || todayKey())
  const [time, setTime] = useState(resume?.time || DEFAULT_DREAM_TIME)
  const [title, setTitle] = useState(resume?.title || '')
  const [content, setContent] = useState(resume?.content || '')
  const [clarity, setClarity] = useState(resume?.clarity ?? 0.5)
  const [extra, setExtra] = useState(resume?.extra || {})
  const [loading, setLoading] = useState(!isNew)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')
  // com'era all'apertura di un sogno già salvato: serve a sapere se è stato modificato
  const [baseline, setBaseline] = useState(null)

  // Uscendo da un sogno nuovo senza salvarlo (indietro, tasto di Android, cambio pagina) la
  // bozza resta sul dispositivo e compare nella linguetta celeste.
  const latest = useRef({})
  latest.current = { dateKey, time, title, content, clarity, extra }
  const savedRef = useRef(false)
  useEffect(() => {
    if (!isNew) return undefined
    return () => {
      if (savedRef.current) return
      const d = latest.current
      const hasText = Boolean(d.title.trim() || d.content.replace(/<[^>]*>/g, '').trim())
      listVoices().then((all) => {
        const hasVoices = all.some((v) => v.draftId === draftId)
        if (!hasText && !hasVoices) return
        saveDreamDraft({ id: draftId, ...d })
        toast("Sogno salvato come bozza: lo trovi nell'etichetta celeste a destra dello schermo.")
      })
    }
  }, [isNew, draftId])

  useEffect(() => {
    if (isNew) return
    let off = false
    getDream(id)
      .then((d) => {
        if (off) return
        setDateKey(dayKey(d.date))
        setTime(timeInputValue(d.time) || DEFAULT_DREAM_TIME)
        setTitle(d.title || '')
        setContent(d.content || '')
        setClarity(Number(d.clarity) || 0)
        const ex = d.extra && typeof d.extra === 'object' ? d.extra : {}
        setExtra(ex)
        setBaseline(
          snap({
            dateKey: dayKey(d.date),
            time: timeInputValue(d.time) || DEFAULT_DREAM_TIME,
            title: d.title || '',
            content: d.content || '',
            clarity: Number(d.clarity) || 0,
            extra: ex,
          }),
        )
        setLoading(false)
      })
      .catch((err) => {
        if (off) return
        setError(describeError(err))
        setLoading(false)
      })
    return () => {
      off = true
    }
  }, [id, isNew])

  async function save() {
    if (busy) return
    if (!title.trim() && !content.replace(/<[^>]*>/g, '').trim()) {
      setError('Scrivi almeno un titolo o una descrizione.')
      return
    }
    haptic()
    setBusy(true)
    setError('')
    try {
      const data = { date: dateKey, time, title, content, clarity, extra }
      if (isNew) await createDream(data)
      else await updateDream(id, data)
      savedRef.current = true
      if (isNew) await discardDreamDraft(draftId)
      playSound('save')
      navigate(`/day/${dateKey}`, { replace: true })
    } catch (err) {
      setError(describeError(err))
      setBusy(false)
    }
  }

  async function remove() {
    if (!window.confirm('Eliminare definitivamente questo sogno?')) return
    setBusy(true)
    try {
      await deleteDream(id)
      playSound('delete')
      navigate(`/day/${dateKey}`, { replace: true })
    } catch (err) {
      setError(describeError(err))
      setBusy(false)
    }
  }

  const parsed = parseWall(dateKey)
  const year = parsed?.y ?? new Date().getFullYear()
  const dayStr = parsed ? String(parsed.d).padStart(2, '0') : '--'
  const monthStr = parsed ? MONTHS_IT[parsed.mo - 1].slice(0, 3).toUpperCase() : '---'
  const [hh, mm] = (time || DEFAULT_DREAM_TIME).split(':')

  // «listHost»: sul web il tasto sta nella colonna di sinistra e l'elenco dei vocali va sotto il foglio
  const [listHost, setListHost] = useState(null)
  const canDictate = Boolean(user?.geminiApiKey?.trim() || user?.groqApiKey?.trim())
  const voiceButton = (
    <VoiceRecordButton
        fab="inline"
        draftId={isNew ? draftId : undefined}
        onSaved={() => isNew && ensureDreamDraft({ id: draftId, ...latest.current })}
        listHost={listHost}
        apiKey={user?.geminiApiKey?.trim()}
        onTranscribed={(t) =>
          setContent((c) => (c.replace(/<[^>]*>/g, '').trim() ? c + '<br><br>' : '') + escapeHtml(t))
        }
      />
  )
  const voice = canDictate && <div className="dream-voice" ref={setListHost} />

  const backBtn = (
    <button
      type="button"
      className={wide ? 'ne-back' : 'mchev dream-back-m'}
      onClick={() => {
        haptic()
        goBack()
      }}
      title="Indietro"
      aria-label="Indietro"
    >
      <Icon name="chevron-left" size={wide ? 16 : 21} strokeWidth={wide ? 2.6 : 2.8} />
      {wide && 'Indietro'}
    </button>
  )

  const yearPill = (
    <span className="dream-year">
      <Icon name="moon" size={wide ? 16 : 19} />
      {year}
    </span>
  )

  const timeClock = (
    <TimePickerPopover
      time={time}
      onChange={setTime}
      className="dream-hang dream-hang-b"
      buttonClassName="dream-lcd"
      ariaLabel={`Cambia orario del sogno, ora ${time}`}
    >
      <span className="dream-lcd-in">
        <small>Orario</small>
        {hh}:{mm}
      </span>
    </TimePickerPopover>
  )

  const dateClock = (
    <DatePickerPopover
      dateKey={dateKey}
      onChange={setDateKey}
      className="dream-hang dream-hang-a"
      buttonClassName="dream-lcd"
      textClassName=""
      ariaLabel={`Cambia data, ora ${fullDayLabel(dateKey)}`}
    >
      <span className="dream-lcd-in">
        <small>Giorno</small>
        {dayStr}:{monthStr}
        {wide ? `:${year}` : ''}
      </span>
    </DatePickerPopover>
  )

  const clarityBlock = (
    <div className="dream-clarity">
      {wide && <span className="dream-clarity-title">Nitidezza</span>}
      <ClaritySlider value={clarity} onChange={setClarity} centerLabel={!wide} ends={false} />
    </div>
  )

  const sheet = (
    <div className="dream-sheet">
      <span className="dream-z dream-z1">z</span>
      <span className="dream-z dream-z2">Z</span>
      <span className="dream-z dream-z3">Z</span>
      {loading ? (
        <p className="dream-hint">Carico…</p>
      ) : (
        <>
          <TitleInput
            placeholder="Titolo del sogno"
            value={title}
            onChange={setTitle}
            className="dream-title"
          />
          <RichText
            value={content}
            onChange={setContent}
            placeholder="Scrivi o detta quello che ricordi…"
            className="dream-body"
          />
        </>
      )}
    </div>
  )

  const tail = (
    <>
      {voice}
      {error && <p className="dream-error">{error}</p>}
    </>
  )

  // Verde = salva (sogno nuovo o modificato). Rosso = elimina (sogno esistente invariato).
  const dirty =
    isNew || baseline === null || snap({ dateKey, time, title, content, clarity, extra }) !== baseline
  const mode = dirty ? 'save' : 'delete'

  const saveBtn = wide ? (
    mode === 'delete' ? (
      <button type="button" disabled={busy || loading} onClick={remove} className="ne-delete">
        <Icon name="trash" size={16} strokeWidth={2.6} />
        Elimina il sogno
      </button>
    ) : (
    <button type="button" disabled={busy || loading} onClick={save} className="ne-save">
      <Icon name="check" size={16} strokeWidth={2.6} />
      {isNew ? 'Segna il sogno' : 'Salva modifiche'}
    </button>
    )
  ) : mode === 'delete' ? (
    <button
      type="button"
      disabled={busy || loading}
      onClick={remove}
      className="mcircle-action delete dream-del-m"
      title="Elimina il sogno"
      aria-label="Elimina il sogno"
    >
      <Icon name="trash" size={19} strokeWidth={2.8} />
    </button>
  ) : (
    <button
      type="button"
      disabled={busy || loading}
      onClick={save}
      className="mcircle-action save dream-save-m"
      title="Salva"
      aria-label="Salva il sogno"
    >
      <Icon name="check" size={19} strokeWidth={2.8} />
    </button>
  )

  if (wide) {
    return (
      <div className="dream-page dream-page-wide">
        <DreamWaves height={150} />
        <DreamScatter />
        <div className="dream-top">
          {backBtn}
          {yearPill}
          {saveBtn}
        </div>
        <div className="dream-cols">
          <div className="dream-left">
            <div className="dream-clocks">
              {dateClock}
              {timeClock}
            </div>
            {clarityBlock}
            {canDictate && <div className="dream-mic-slot">{voiceButton}</div>}
          </div>
          <div className="dream-right">
            {sheet}
            {tail}
          </div>
        </div>
        <DreamBottom repeat />
      </div>
    )
  }

  return (
    <div className={'dream-shell' + (canDictate ? ' has-mic' : '')}>
      <div className="dream-page">
        <DreamWaves height={66} />
        <DreamGarland />
        <div className="dream-top">
          {backBtn}
          {yearPill}
          {saveBtn}
        </div>
        <div className="dream-clocks">
          {dateClock}
          {timeClock}
        </div>
        <div className="dream-clarity-wrap">{clarityBlock}</div>
        <div className="dream-scroll">
          <div className="dream-body-wrap">
            {sheet}
            {tail}
          </div>
        </div>
        {canDictate && <div className="dream-mic-bar">{voiceButton}</div>}
        <DreamBottom repeat />
      </div>
    </div>
  )
}
