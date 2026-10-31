import { playSound } from '../../lib/sounds'
import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { useGoBack } from '../../hooks/useBack'
import { useLocation, useNavigate, useParams, useSearchParams } from 'react-router-dom'
import { getConnection } from '../../lib/cache'
import MoodSlider from '../../components/MoodSlider'
import RichText from '../../components/RichText'
import Dialog from '../../components/Dialog'
import AddImagesSheet from '../../components/AddImagesSheet'
import ImmichPicker from '../../components/ImmichPicker'
import PeoplePickerSheet from '../../components/PeoplePickerSheet'
import PersonAvatar from '../../components/PersonAvatar'
import TagPickerSheet from '../../components/TagPickerSheet'
import AddSongSheet from '../../components/AddSongSheet'
import PlacePickerSheet from '../../components/PlacePickerSheet'
import { mymapConfigFromUser } from '../../lib/mymap'
import DatePickerPopover from '../../components/DatePickerPopover'
import TimePickerPopover from '../../components/TimePickerPopover'
import Icon from '../../components/Icon'
import {
  createNote,
  deleteNote,
  getNote,
  updateNote,
  checkSavedNote,
  describeError,
  parsePlace,
  peopleUsageCounts,
} from '../../lib/notes'
import { personTapeColor, osmTileFor, tilt } from '../../lib/pagesSkin'
import { fileUrl } from '../../lib/pocketbase'
import { listPeople } from '../../lib/people'
import { listTags } from '../../lib/tags'
import { notifyNotesChanged } from '../../lib/widgetSync'
import { pokeRecapQueue } from '../../lib/recapQueue'
import { useAutoDraft } from '../../hooks/useAutoDraft'
import { discardGeminiDraft } from '../../lib/geminiDrafts'
import { useAuth } from '../../context/AuthContext'
import {
  dayKey,
  fullDayLabel,
  timeInputValue,
  parseWall,
  MONTHS_IT,
} from '../../lib/dates'
import { haptic } from '../../lib/haptics'
import ImageLightbox from '../../components/ImageLightbox'
import TitleInput from '../../components/TitleInput'

const DATE_RE = /^\d{4}-\d{2}-\d{2}$/

// Targhetta rettangolare per aggiungere un tipo di contenuto: da vuota è un
// ritaglio di carta tratteggiato con l'icona e l'etichetta; appena c'è
// almeno un elemento viene "coperta" da una targhetta in legno col
// conteggio, restando comunque cliccabile per aprire il selettore.
function AddTag({ icon, label, count, onClick }) {
  return (
    <span className="ne-addtag-wrap">
      <span className="ne-addtag-underlay" aria-hidden="true" />
      <button
        type="button"
        onClick={onClick}
        title={label}
        className={'ne-addtag' + (count > 0 ? ' filled' : '')}
      >
        <Icon name={icon} size={14} />
        <span className="label">{label}</span>
        {count > 0 && <span className="count">{count}</span>}
      </button>
    </span>
  )
}

const emptyForm = (dKey) => ({
  title: '',
  content: '',
  mood: 0.5,
  place: null,
  songs: [],
  dateKey: dKey,
  timeStart: '09:00',
  timeEnd: '10:00',
})

const formFromRecord = (rec) => ({
  title: rec.title ?? '',
  content: rec.content ?? '',
  mood: Number(rec.mood ?? 0.5),
  place: parsePlace(rec.place),
  songs: Array.isArray(rec.songs) ? rec.songs : [],
  dateKey: dayKey(rec.date),
  timeStart: timeInputValue(rec.timeStart) || '09:00',
  timeEnd: timeInputValue(rec.timeEnd) || '10:00',
})

const snapshot = (f) =>
  JSON.stringify({
    title: f.title,
    content: f.content,
    mood: Number(f.mood),
    place: f.place,
    songs: f.songs,
    dateKey: f.dateKey,
    timeStart: f.timeStart,
    timeEnd: f.timeEnd,
  })

export default function WebNote() {
  const { id } = useParams()
  const navigate = useNavigate()
  const goBack = useGoBack()
  const location = useLocation()
  const [search] = useSearchParams()
  const { user } = useAuth()
  const isNew = !id

  // Bozza arrivata da "Nuova nota con Gemini" (Sidebar): titolo, contenuto,
  // tag/persone e luogo pre-compilati, tutti da rivedere qui prima di
  // salvare — non è mai stato scritto nulla sul server.
  const aiDraft = isNew ? location.state?.aiDraft : null
  // Bozza ripresa dall'elenco "Bozze" (DraftsTab): si continua a salvare sotto lo stesso id.
  const resumedDraftId = isNew ? location.state?.draftId : null
  // bozza di «Nuova nota con Gemini» da cui nasce questa nota: si cancella (con i vocali) al salvataggio
  const geminiDraftId = isNew ? aiDraft?.geminiDraftId || null : null
  const draftExtra = useMemo(() => (geminiDraftId ? { geminiDraftId } : undefined), [geminiDraftId])

  const immichUrl = user?.immichUrl?.trim()
  const immichApiKey = user?.immichApiKey?.trim()
  const immichReady = Boolean(immichUrl && immichApiKey)
  const spotifyClientId = user?.spotifyClientId?.trim()
  const spotifyClientSecret = user?.spotifyClientSecret?.trim()

  const dateParam = search.get('date')
  const initialDate =
    dateParam && DATE_RE.test(dateParam) ? dateParam : dayKey(new Date())

  const initialForm = () => {
    const base = emptyForm(initialDate)
    if (!aiDraft) return base
    return {
      ...base,
      title: aiDraft.title || '',
      content: aiDraft.content || '',
      place: aiDraft.place || null,
      songs: aiDraft.songs || base.songs,
      mood: aiDraft.mood ?? base.mood,
      timeStart: aiDraft.timeStart || base.timeStart,
      timeEnd: aiDraft.timeEnd || base.timeEnd,
    }
  }

  const [form, setForm] = useState(initialForm)
  const [baseline, setBaseline] = useState(() => snapshot(initialForm()))
  const [existingImages, setExistingImages] = useState([])
  const [record, setRecord] = useState(null)
  const [createdId, setCreatedId] = useState(null)
  const [newFiles, setNewFiles] = useState([])
  // immagine aperta a schermo intero (indice in galleryImages), null = chiuso
  const [viewerIndex, setViewerIndex] = useState(null)
  const [removedImages, setRemovedImages] = useState([])
  const [loading, setLoading] = useState(!isNew)
  const [busy, setBusy] = useState(false)
  const [loadError, setLoadError] = useState('')
  const [dialog, setDialog] = useState(null)
  const [addSheetOpen, setAddSheetOpen] = useState(false)
  const [immichOpen, setImmichOpen] = useState(false)
  const [allPeople, setAllPeople] = useState([])
  const [peopleUsage, setPeopleUsage] = useState(null)
  const [peopleIds, setPeopleIds] = useState(() => aiDraft?.peopleIds || [])
  const [baselinePeopleIds, setBaselinePeopleIds] = useState([])
  const [peopleSheetOpen, setPeopleSheetOpen] = useState(false)
  const [allTags, setAllTags] = useState([])
  const [tagIds, setTagIds] = useState(() => aiDraft?.tagIds || [])
  const [baselineTagIds, setBaselineTagIds] = useState([])
  const [tagSheetOpen, setTagSheetOpen] = useState(false)
  const [songSheetOpen, setSongSheetOpen] = useState(false)
  const [placeSheetOpen, setPlaceSheetOpen] = useState(false)
  const fileInputRef = useRef(null)
  const editorRef = useRef(null)
  const savingRef = useRef(false)

  const effectiveId = id || createdId
  const existsOnServer = Boolean(effectiveId)

  // Una nuova nota abbandonata senza salvare (es. Indietro per sbaglio) resta
  // nell'elenco Bozze: vedi src/lib/drafts.js.
  const { discard: discardDraft } = useAutoDraft({
    enabled: !existsOnServer,
    draftId: resumedDraftId,
    form,
    peopleIds,
    tagIds,
    imageCount: newFiles.length,
    extra: draftExtra,
  })

  useEffect(() => {
    if (isNew) return
    let alive = true
    setLoading(true)
    getNote(id)
      .then((rec) => {
        if (!alive) return
        setRecord(rec)
        const f = formFromRecord(rec)
        setForm(f)
        setBaseline(snapshot(f))
        setExistingImages(rec.images || [])
        setPeopleIds(rec.people || [])
        setBaselinePeopleIds(rec.people || [])
        setTagIds(rec.tags || [])
        setBaselineTagIds(rec.tags || [])
      })
      .catch((err) => alive && setLoadError(describeError(err)))
      .finally(() => alive && setLoading(false))
    return () => {
      alive = false
    }
  }, [id, isNew])

  useEffect(() => {
    listPeople()
      .then(setAllPeople)
      .catch(() => {})
    listTags()
      .then(setAllTags)
      .catch(() => {})
    peopleUsageCounts()
      .then(setPeopleUsage)
      .catch(() => {})
  }, [])

  const set = (patch) => setForm((f) => ({ ...f, ...patch }))

  const previews = useMemo(
    () => newFiles.map((file) => ({ file, url: URL.createObjectURL(file) })),
    [newFiles],
  )
  useEffect(
    () => () => previews.forEach((p) => URL.revokeObjectURL(p.url)),
    [previews],
  )

  // immagini della nota (già salvate e appena aggiunte) per il visualizzatore
  const galleryImages = useMemo(
    () => [
      ...existingImages.map((fn) => ({
        url: record ? fileUrl(record, fn) : '',
        key: fn,
      })),
      ...previews.map((p) => ({ url: p.url, key: p.url })),
    ],
    [existingImages, previews, record],
  )

  const selectedPeople = useMemo(
    () => allPeople.filter((p) => peopleIds.includes(p.id)),
    [allPeople, peopleIds],
  )

  function togglePerson(id) {
    setPeopleIds((prev) =>
      prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id],
    )
  }

  const selectedTags = useMemo(
    () => allTags.filter((t) => tagIds.includes(t.id)),
    [allTags, tagIds],
  )

  function toggleTag(id) {
    setTagIds((prev) =>
      prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id],
    )
  }

  function removeSong(index) {
    setForm((f) => ({ ...f, songs: f.songs.filter((_, i) => i !== index) }))
  }

  const peopleDirty =
    JSON.stringify([...peopleIds].sort()) !== JSON.stringify([...baselinePeopleIds].sort())
  const tagsDirty =
    JSON.stringify([...tagIds].sort()) !== JSON.stringify([...baselineTagIds].sort())

  const dirty =
    !existsOnServer ||
    snapshot(form) !== baseline ||
    newFiles.length > 0 ||
    removedImages.length > 0 ||
    peopleDirty ||
    tagsDirty
  const mode = !existsOnServer || dirty ? 'save' : 'delete'

  const onPickFiles = useCallback((e) => {
    const picked = Array.from(e.target.files || [])
    if (picked.length) setNewFiles((prev) => [...prev, ...picked])
    e.target.value = ''
  }, [])

  async function handleSave() {
    if (savingRef.current) return
    savingRef.current = true
    setBusy(true)
    setDialog(null)
    if (getConnection().status !== 'ok') {
      setDialog({
        title: 'Connessione debole',
        tone: 'info',
        lines: [
          'Il salvataggio potrebbe richiedere del tempo (soprattutto con immagini).',
          'La nota verrà caricata appena la connessione lo permette: se non ci riesce ora resta in coda e si sincronizza da sola.',
        ],
      })
    }
    const creating = !existsOnServer
    const imageCount = existingImages.length + newFiles.length
    try {
      const rec = creating
        ? await createNote(form, { newFiles, peopleIds, tagIds })
        : await updateNote(effectiveId, form, { newFiles, removedImages, peopleIds, tagIds })

      if (creating) {
        discardDraft()
        discardGeminiDraft(geminiDraftId)
      }
      pokeRecapQueue() // il server rigenera in background il recap del giorno (se passato)
      notifyNotesChanged() // widget della home (app Android)
      playSound('save')
      setRecord(rec)
      setCreatedId(rec.id)
      setExistingImages(rec.images || [])
      setNewFiles([])
      setRemovedImages([])
      setBaseline(snapshot(form))
      setPeopleIds(rec.people || [])
      setBaselinePeopleIds(rec.people || [])
      setTagIds(rec.tags || [])
      setBaselineTagIds(rec.tags || [])

      const problems = checkSavedNote(rec, {
        title: form.title,
        content: form.content,
        mood: form.mood,
        imageCount,
        peopleCount: peopleIds.length,
        tagCount: tagIds.length,
        dateKey: form.dateKey,
        timeStart: form.timeStart,
        timeEnd: form.timeEnd,
      })

      if (problems.length) {
        savingRef.current = false
        setBusy(false)
        setDialog({
          title: 'La nota potrebbe non essere stata salvata correttamente',
          lines: [
            ...problems,
            'La nota resta aperta qui: correggi e salva di nuovo, oppure eliminala.',
          ],
        })
        return
      }

      navigate(
        `/day/${creating ? form.dateKey : dayKey(rec.date) || form.dateKey}`,
        { replace: true },
      )
    } catch (err) {
      savingRef.current = false
      setBusy(false)
      if (err?.queued) {
        discardDraft() // è in coda offline: non serve anche la bozza
        discardGeminiDraft(geminiDraftId)
      }
      setDialog(
        err?.queued
          ? {
              title: 'Salvato in coda offline',
              lines: [
                describeError(err),
                'La nota resta aperta qui; comparirà nel diario dopo la sincronizzazione.',
              ],
            }
          : { title: 'Errore nel salvataggio', lines: [describeError(err)] },
      )
    }
  }

  async function handleDelete() {
    if (!window.confirm('Eliminare definitivamente questa nota?')) return
    playSound('delete')
    setBusy(true)
    setDialog(null)
    try {
      await deleteNote(effectiveId)
      pokeRecapQueue()
      notifyNotesChanged()
      navigate(`/day/${form.dateKey}`, { replace: true })
    } catch (err) {
      setBusy(false)
      setDialog({
        title: "Errore nell'eliminazione",
        lines: [describeError(err)],
      })
    }
  }

  if (loading) {
    return <p className="py-20 text-center text-ink-soft">Carico…</p>
  }

  const noImages = existingImages.length === 0 && previews.length === 0
  const hasMedia =
    !noImages ||
    selectedPeople.length > 0 ||
    selectedTags.length > 0 ||
    form.songs.length > 0 ||
    Boolean(form.place)

  const placeLat = Number(form.place?.lat)
  const placeLon = Number(form.place?.lon)
  const placeMap =
    Number.isFinite(placeLat) && Number.isFinite(placeLon)
      ? osmTileFor(placeLat, placeLon, 14)
      : null

  const parsedDate = parseWall(form.dateKey)
  const dayStr = parsedDate ? String(parsedDate.d).padStart(2, '0') : '--'
  const monthStr = parsedDate ? MONTHS_IT[parsedDate.mo - 1].slice(0, 3).toUpperCase() : '---'
  const yearStr = parsedDate ? String(parsedDate.y) : '----'
  const [startH, startM] = (form.timeStart || '00:00').split(':')
  const [endH, endM] = (form.timeEnd || '00:00').split(':')

  return (
    <div>
      <div className="relative mb-[50px] mt-[40px]">
        <span className="header-quadretti bleed-note" aria-hidden="true" />
        <div className="ne-head relative z-[1] px-4">
          <button
            type="button"
            onClick={() => {
              haptic()
              goBack()
            }}
            className="ne-back"
          >
            <Icon name="chevron-left" size={16} strokeWidth={2.6} />
            Indietro
          </button>

          {mode === 'save' ? (
            <button type="button" disabled={busy} onClick={handleSave} className="ne-save">
              <Icon name="check" size={16} strokeWidth={2.6} />
              {existsOnServer ? 'Salva modifiche' : 'Crea nota'}
            </button>
          ) : (
            <button type="button" disabled={busy} onClick={handleDelete} className="ne-delete">
              <Icon name="trash" size={16} strokeWidth={2.6} />
              Elimina nota
            </button>
          )}
        </div>
      </div>

      {loadError && (
        <p className="mb-4 rounded-2xl bg-delete/15 px-4 py-3 text-sm text-delete-dark">
          {loadError}
        </p>
      )}

      <div className="ne-grid">
        {/* Colonna meta */}
        <div className="ne-meta">
          <div className="ne-sub">
            <div className="ne-sub-head">
              <span className="ne-sub-title">Data</span>
            </div>
            {/* l'intera targhetta è ora il pulsante che apre il calendario
                (prima solo l'anno lo era, e sotto c'era anche il vecchio
                link testuale "2 Settembre": entrambi rimossi). */}
            <DatePickerPopover
              dateKey={form.dateKey}
              onChange={(dateKey) => set({ dateKey })}
              className="ne-clock-tilt-a"
              buttonClassName="ne-clock-face"
              textClassName=""
              ariaLabel={`Cambia data, ora ${fullDayLabel(form.dateKey)}`}
            >
              <span className="ne-clock-screen">
                <span className="ne-clock-digits">
                  {dayStr}
                  <span className="ne-clock-sep">:</span>
                  {monthStr}
                  <span className="ne-clock-sep">:</span>
                  {yearStr}
                </span>
              </span>
            </DatePickerPopover>
          </div>

          <div className="ne-sub">
            <div className="ne-sub-head">
              <span className="ne-sub-title">Orario</span>
            </div>
            {/* stesso discorso dell'orologio Data, ma con un dropdown
                nostro (TimePickerPopover) invece del popup nativo del
                browser: con due orologi vicini, showPicker() apriva il
                selettore sempre ancorato al primo input anche cliccando
                il secondo — un dropdown per orologio, posizionato
                relativamente al proprio pulsante, risolve il problema. */}
            <div className="ne-clock-pair">
              <TimePickerPopover
                time={form.timeStart}
                onChange={(timeStart) => set({ timeStart })}
                className="ne-clock-tilt-b"
                buttonClassName="ne-clock-face small"
                ariaLabel={`Cambia orario di inizio, ora ${form.timeStart}`}
              >
                <span className="ne-clock-screen">
                  <span className="ne-clock-digits">{startH}:{startM}</span>
                </span>
              </TimePickerPopover>
              <span className="ne-clock-pair-sep">–</span>
              <TimePickerPopover
                time={form.timeEnd}
                onChange={(timeEnd) => set({ timeEnd })}
                className="ne-clock-tilt-c"
                buttonClassName="ne-clock-face small"
                ariaLabel={`Cambia orario di fine, ora ${form.timeEnd}`}
              >
                <span className="ne-clock-screen">
                  <span className="ne-clock-digits">{endH}:{endM}</span>
                </span>
              </TimePickerPopover>
            </div>
          </div>

          <div className="ne-sub">
            <div className="ne-sub-head">
              <span className="ne-sub-title">Aggiungi</span>
            </div>
            <div className="ne-addrow">
              <AddTag
                icon="image"
                label="Immagini"
                count={existingImages.length + previews.length}
                onClick={() =>
                  immichReady ? setAddSheetOpen(true) : fileInputRef.current?.click()
                }
              />
              <AddTag
                icon="user"
                label="Persone"
                count={selectedPeople.length}
                onClick={() => setPeopleSheetOpen(true)}
              />
              <AddTag
                icon="tag"
                label="Tag"
                count={selectedTags.length}
                onClick={() => setTagSheetOpen(true)}
              />
              <AddTag
                icon="music"
                label="Canzoni"
                count={form.songs.length}
                onClick={() => setSongSheetOpen(true)}
              />
              <AddTag
                icon="map-pin"
                label="Luogo"
                count={form.place ? 1 : 0}
                onClick={() => setPlaceSheetOpen(true)}
              />
            </div>
          </div>
        </div>

        {/* Colonna editor: foglio di scrittura + (sotto) persone/luogo/
            canzoni/foto aggiunte, con l'estetica della vista mese. */}
        <div className="flex flex-col">
          <div className="ne-sub ne-mood-top">
            <div className="ne-sub-head">
              <span className="ne-sub-title">Mood</span>
            </div>
            <div className="mnote-mood-frame">
              <MoodSlider
                value={form.mood}
                onChange={(mood) => set({ mood })}
                className="mnote-mood"
              />
            </div>
          </div>
        <div className="ne-sheet">
          <span className="ne-tape ne-tape-a" aria-hidden="true" />
          <span className="ne-tape ne-tape-b" aria-hidden="true" />
          <TitleInput
            placeholder="Titolo della nota"
            value={form.title}
            onChange={(title) => set({ title })}
            className="ne-title"
          />
          <RichText
            ref={editorRef}
            value={form.content}
            onChange={(html) => set({ content: html })}
            placeholder="Scrivi qui la nota…"
            className="ne-body"
          />
        </div>

        {hasMedia && (
          <div className="ne-media">
            {!noImages && (
              <span className="ne-media-col">
                <span className="ne-media-polas">
                  {existingImages.map((fn, i) => (
                    <span
                      key={fn}
                      className="mp-pola ne-media-pola"
                      style={{ '--pr': `${tilt(`${fn}p${i}`, 4).toFixed(2)}deg` }}
                    >
                      <span
                        className="mp-ph"
                        style={{
                          backgroundImage: record
                            ? `url(${fileUrl(record, fn, { thumb: '300x300' })})`
                            : undefined,
                        }}
                      />
                      <button
                        type="button"
                        title="Visualizza"
                        onClick={() => setViewerIndex(i)}
                        className="absolute inset-0 cursor-zoom-in"
                      />
                      <button
                        type="button"
                        title="Rimuovi"
                        onClick={() => {
                          setExistingImages((p) => p.filter((x) => x !== fn))
                          setRemovedImages((p) => [...p, fn])
                        }}
                        className="ne-media-x"
                      >
                        <Icon name="x" size={11} />
                      </button>
                    </span>
                  ))}
                  {previews.map((p, i) => (
                    <span
                      key={p.url}
                      className="mp-pola ne-media-pola"
                      style={{ '--pr': `${tilt(`${p.url}p${i}`, 4).toFixed(2)}deg` }}
                    >
                      <span className="mp-ph" style={{ backgroundImage: `url(${p.url})` }} />
                      <button
                        type="button"
                        title="Visualizza"
                        onClick={() => setViewerIndex(existingImages.length + i)}
                        className="absolute inset-0 cursor-zoom-in"
                      />
                      <button
                        type="button"
                        title="Rimuovi"
                        onClick={() =>
                          setNewFiles((prev) => prev.filter((_, idx) => idx !== i))
                        }
                        className="ne-media-x"
                      >
                        <Icon name="x" size={11} />
                      </button>
                    </span>
                  ))}
                </span>
              </span>
            )}

            {selectedPeople.length > 0 && (
              <span className="ne-media-col">
                <span className="mp-tapes">
                  {selectedPeople.map((person) => (
                    <span
                      key={person.id}
                      className="mp-tape ne-media-tape"
                      style={{ '--tape-c': personTapeColor(person) }}
                    >
                      <PersonAvatar
                        person={person}
                        immichUrl={immichUrl}
                        immichApiKey={immichApiKey}
                        size={19}
                      />
                      <span className="mp-tape-name">{person.name}</span>
                      <button
                        type="button"
                        title="Rimuovi"
                        onClick={() => togglePerson(person.id)}
                        className="ne-media-x static"
                      >
                        <Icon name="x" size={10} />
                      </button>
                    </span>
                  ))}
                </span>
              </span>
            )}

            {selectedTags.length > 0 && (
              <span className="ne-media-col">
                <span className="ne-media-tags">
                  {selectedTags.map((tag) => (
                    <span key={tag.id} className="ne-chip sq">
                      <Icon name="tag" size={11} />
                      {tag.name}
                      <button
                        type="button"
                        title="Rimuovi"
                        onClick={() => toggleTag(tag.id)}
                        className="rm"
                      >
                        ×
                      </button>
                    </span>
                  ))}
                </span>
              </span>
            )}

            {form.songs.length > 0 && (
              <span className="ne-media-col">
                {form.songs.map((song, i) => (
                  <span key={i} className="mp-disc-wrap ne-media-pola">
                    <span
                      className="mp-disc"
                      style={
                        song.thumbnailUrl
                          ? { '--cover': `url(${song.thumbnailUrl})` }
                          : undefined
                      }
                    />
                    {(song.title || song.artist) && (
                      <span className="mp-song">
                        {song.title && <span className="t">{song.title}</span>}
                        {song.artist && <span className="a">{song.artist}</span>}
                      </span>
                    )}
                    <button
                      type="button"
                      title="Rimuovi"
                      onClick={() => removeSong(i)}
                      className="ne-media-x"
                    >
                      <Icon name="x" size={11} />
                    </button>
                  </span>
                ))}
              </span>
            )}

            {form.place && (
              <span className="ne-media-col">
                <span className="mp-place ne-media-pola">
                  <span
                    className={'mp-map' + (placeMap ? ' real' : '')}
                    style={
                      placeMap
                        ? { '--map-url': `url(${placeMap.url})`, '--map-pos': placeMap.pos }
                        : undefined
                    }
                  />
                  <span className="mp-place-name">{form.place.name}</span>
                  <button
                    type="button"
                    title="Rimuovi"
                    onClick={() => set({ place: null })}
                    className="ne-media-x"
                  >
                    <Icon name="x" size={11} />
                  </button>
                </span>
              </span>
            )}
          </div>
        )}
        </div>
      </div>

      <input
        ref={fileInputRef}
        type="file"
        accept="image/*"
        multiple
        hidden
        onChange={onPickFiles}
      />

      <Dialog
        open={Boolean(dialog)}
        title={dialog?.title}
        lines={dialog?.lines || []}
        onClose={() => setDialog(null)}
      />

      <ImageLightbox
        images={galleryImages}
        index={viewerIndex}
        onClose={() => setViewerIndex(null)}
        onIndex={setViewerIndex}
      />

      <AddImagesSheet
        open={addSheetOpen}
        onClose={() => setAddSheetOpen(false)}
        onDevice={() => fileInputRef.current?.click()}
        onImmich={immichReady ? () => setImmichOpen(true) : null}
      />

      {immichReady && (
        <ImmichPicker
          open={immichOpen}
          dateKey={form.dateKey}
          baseUrl={immichUrl}
          apiKey={immichApiKey}
          onClose={() => setImmichOpen(false)}
          onConfirm={(files) => {
            setNewFiles((prev) => [...prev, ...files])
            setImmichOpen(false)
          }}
        />
      )}
      <PeoplePickerSheet
        open={peopleSheetOpen}
        people={allPeople}
        selectedIds={peopleIds}
        immichUrl={immichUrl}
        immichApiKey={immichApiKey}
        onClose={() => setPeopleSheetOpen(false)}
        onToggle={togglePerson}
        usageCounts={peopleUsage}
        onCreated={(person) => {
          setAllPeople((prev) =>
            [...prev, person].sort((a, b) => a.name.localeCompare(b.name)),
          )
          setPeopleIds((prev) => [...prev, person.id])
        }}
      />

      <TagPickerSheet
        open={tagSheetOpen}
        tags={allTags}
        selectedIds={tagIds}
        onClose={() => setTagSheetOpen(false)}
        onToggle={toggleTag}
        onCreated={(tag) => {
          setAllTags((prev) => [...prev, tag].sort((a, b) => a.name.localeCompare(b.name)))
          setTagIds((prev) => [...prev, tag.id])
        }}
      />

      <AddSongSheet
        open={songSheetOpen}
        onClose={() => setSongSheetOpen(false)}
        onAdd={(song) => setForm((f) => ({ ...f, songs: [...f.songs, song] }))}
        spotifyClientId={spotifyClientId}
        spotifyClientSecret={spotifyClientSecret}
      />

      <PlacePickerSheet
        open={placeSheetOpen}
        onClose={() => setPlaceSheetOpen(false)}
        onAdd={(place) => set({ place })}
        mymap={mymapConfigFromUser(user)}
        dateKey={form.dateKey}
      />
    </div>
  )
}
