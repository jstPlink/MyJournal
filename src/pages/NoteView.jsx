import { playSound } from '../lib/sounds'
import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { useGoBack } from '../hooks/useBack'
import { useLocation, useNavigate, useParams, useSearchParams } from 'react-router-dom'
import { getConnection } from '../lib/cache'
import PhoneShell from '../components/PhoneShell'
import MobileTopBar from '../components/MobileTopBar'
import MobileBottomBar from '../components/MobileBottomBar'
import DatePickerPopover from '../components/DatePickerPopover'
import TimePickerPopover from '../components/TimePickerPopover'
import Icon from '../components/Icon'
import MoodSlider from '../components/MoodSlider'
import RichText from '../components/RichText'
import Dialog from '../components/Dialog'
import ImageLightbox from '../components/ImageLightbox'
import AddImagesSheet from '../components/AddImagesSheet'
import ImmichPicker from '../components/ImmichPicker'
import PeoplePickerSheet from '../components/PeoplePickerSheet'
import PersonAvatar from '../components/PersonAvatar'
import TagPickerSheet from '../components/TagPickerSheet'
import AddSongSheet from '../components/AddSongSheet'
import PlacePickerSheet from '../components/PlacePickerSheet'
import { mymapConfigFromUser } from '../lib/mymap'
import PlaceCard from '../components/PlaceCard'
import GeminiSheet from '../components/GeminiSheet'
import {
  createNote,
  deleteNote,
  getNote,
  updateNote,
  checkSavedNote,
  describeError,
  parsePlace,
  peopleUsageCounts,
} from '../lib/notes'
import { personTapeColor, tilt } from '../lib/pagesSkin'
import { fileUrl } from '../lib/pocketbase'
import { listPeople } from '../lib/people'
import { listTags } from '../lib/tags'
import { haptic } from '../lib/haptics'
import { notifyNotesChanged } from '../lib/widgetSync'
import { pokeRecapQueue } from '../lib/recapQueue'
import { useAutoDraft } from '../hooks/useAutoDraft'
import { discardGeminiDraft } from '../lib/geminiDrafts'
import { useAuth } from '../context/AuthContext'
import {
  dayKey,
  nowRoundedTo5,
  parseWall,
  subtractHours,
  timeInputValue,
  MONTHS_IT,
} from '../lib/dates'
import TitleInput from '../components/TitleInput'
import { noteInstructionsOf } from '../lib/aiInstructions'

const DATE_RE = /^\d{4}-\d{2}-\d{2}$/

// Pulsante circolare (ritaglio di carta, stesso materiale di .mcircle-paper
// della barra inferiore): appena c'è già almeno un elemento di quel tipo,
// l'intero cerchio viene coperto da un dischetto in legno — leggermente
// disallineato per lasciar intravedere il ritaglio tratteggiato sotto
// (stesso sottofondo reale, non uno pseudo-elemento, di .sb-item-underlay/
// .ne-addtag-underlay) — con l'icona della categoria al centro e il
// conteggio in un angolo, non al posto dell'icona.
function FabButton({ icon, iconSize = 19, active, count, onClick, title }) {
  return (
    <span className="mnote-fab-wrap">
      <span className="mnote-fab-underlay" aria-hidden="true" />
      <button
        type="button"
        onClick={() => {
          haptic()
          onClick()
        }}
        title={title}
        aria-label={title}
        className={'mcircle mcircle-paper' + (active ? ' active' : '')}
      >
        <Icon name={icon} size={iconSize} />
      </button>
      {/* fuori dal bottone: .mcircle ha overflow:hidden (per restare un
          cerchio perfetto), taglierebbe via il pallino se sporge oltre il
          bordo. */}
      {active && <span className="mcircle-count">{count}</span>}
    </span>
  )
}

function emptyForm(dKey) {
  const timeEnd = nowRoundedTo5()
  return {
    title: '',
    content: '',
    mood: 0.5,
    place: null,
    songs: [],
    dateKey: dKey,
    timeStart: subtractHours(timeEnd, 2),
    timeEnd,
  }
}

function formFromRecord(rec) {
  return {
    title: rec.title ?? '',
    content: rec.content ?? '',
    mood: Number(rec.mood ?? 0.5),
    place: parsePlace(rec.place),
    songs: Array.isArray(rec.songs) ? rec.songs : [],
    dateKey: dayKey(rec.date),
    timeStart: timeInputValue(rec.timeStart) || '09:00',
    timeEnd: timeInputValue(rec.timeEnd) || '10:00',
  }
}

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

export default function NoteView() {
  const { id } = useParams()
  const navigate = useNavigate()
  const goBack = useGoBack()
  const location = useLocation()
  const [search] = useSearchParams()
  const { user } = useAuth()
  const isNew = !id

  // Bozza arrivata da "Nuova nota con Gemini" (MonthView/Sidebar): titolo,
  // contenuto, tag/persone e luogo pre-compilati, tutti da rivedere qui
  // prima di salvare — non è mai stato scritto nulla sul server.
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
  const geminiApiKey = user?.geminiApiKey?.trim()
  const geminiCustomInstructions = noteInstructionsOf(user)

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
  const [removedImages, setRemovedImages] = useState([])
  const [loading, setLoading] = useState(!isNew)
  const [busy, setBusy] = useState(false)
  const [loadError, setLoadError] = useState('')
  const [dialog, setDialog] = useState(null) // { title, lines }
  const [viewerIndex, setViewerIndex] = useState(null)
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
  const [geminiSheetOpen, setGeminiSheetOpen] = useState(false)
  const fileInputRef = useRef(null)
  const editorRef = useRef(null)
  const savingRef = useRef(false) // guardia anti doppio invio

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
  useEffect(() => {
    return () => previews.forEach((p) => URL.revokeObjectURL(p.url))
  }, [previews])

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

  // Verde = salva (nota nuova o modificata). Rosso = elimina (esistente invariata).
  const mode = !existsOnServer || dirty ? 'save' : 'delete'

  const parsed = parseWall(form.dateKey)
  const year = parsed?.y ?? new Date().getFullYear()
  const dayStr = parsed ? String(parsed.d).padStart(2, '0') : '--'
  const monthStr = parsed ? MONTHS_IT[parsed.mo - 1].slice(0, 3).toUpperCase() : '---'

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

      // Adotta il record salvato: eventuali nuovi salvataggi diventano update.
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

      const targetDay = creating ? form.dateKey : dayKey(rec.date) || form.dateKey
      navigate(`/day/${targetDay}`, { replace: true })
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
    return (
      <PhoneShell>
        <div className="flex flex-1 items-center justify-center text-ink-soft">
          Carico…
        </div>
      </PhoneShell>
    )
  }

  const noImages = existingImages.length === 0 && previews.length === 0
  const hasExtras =
    selectedPeople.length > 0 ||
    selectedTags.length > 0 ||
    Boolean(form.place) ||
    form.songs.length > 0 ||
    !noImages

  return (
    <PhoneShell>
      <MobileTopBar className="mtop-note">
        <div className="mtop-row1">
          <button
            type="button"
            onClick={() => {
              haptic()
              goBack()
            }}
            className="mchev"
            title="Indietro"
            aria-label="Indietro"
          >
            <Icon name="chevron-left" size={19} strokeWidth={2.8} />
          </button>
          <span className="mtop-year">{year}</span>
          <button
            type="button"
            disabled={busy}
            onClick={mode === 'save' ? handleSave : handleDelete}
            title={mode === 'save' ? 'Salva' : 'Elimina nota'}
            className={'mcircle-action ' + mode}
          >
            <Icon name={mode === 'save' ? 'check' : 'trash'} size={19} strokeWidth={2.8} />
          </button>
        </div>

        <div className="mtop-row2">
          <TimePickerPopover
            time={form.timeStart}
            onChange={(timeStart) => set({ timeStart })}
            className="mtime-slot"
            buttonClassName="mclock-face"
            ariaLabel={`Cambia orario di inizio, ora ${form.timeStart}`}
          >
            <span className="mclock-screen">
              <span className="mclock-digits">{form.timeStart}</span>
            </span>
          </TimePickerPopover>

          <DatePickerPopover
            dateKey={form.dateKey}
            onChange={(dateKey) => set({ dateKey })}
            className="mdate-slot"
            buttonClassName="mclock-face"
            textClassName=""
            ariaLabel={`Cambia data, ora ${dayStr} ${monthStr} ${year}`}
          >
            <span className="mclock-screen">
              <span className="mclock-digits">
                {dayStr}
                <span className="mclock-sep">:</span>
                {monthStr}
              </span>
            </span>
          </DatePickerPopover>

          <TimePickerPopover
            time={form.timeEnd}
            onChange={(timeEnd) => set({ timeEnd })}
            className="mtime-slot"
            buttonClassName="mclock-face"
            ariaLabel={`Cambia orario di fine, ora ${form.timeEnd}`}
          >
            <span className="mclock-screen">
              <span className="mclock-digits">{form.timeEnd}</span>
            </span>
          </TimePickerPopover>
        </div>
      </MobileTopBar>

      <main className="mnote-main anim-page flex flex-1 flex-col overflow-y-auto no-scrollbar px-4 py-4">
        {loadError && (
          <p className="mb-4 rounded-2xl bg-delete/10 px-4 py-3 text-sm text-delete-dark">
            {loadError}
          </p>
        )}

        <div className="mnote-mood-frame">
          <MoodSlider
            value={form.mood}
            onChange={(mood) => set({ mood })}
            className="mnote-mood"
          />
        </div>

        {/* Foglio di scrittura: stesse classi della versione web (.ne-sheet),
            scalate per il telefono. Almeno il 35% dello schermo anche da
            vuoto, ma NON si comprime mai (flex-none) e non ha scroll interno
            (niente overflow-hidden): cresce quanto serve a mostrare tutto il
            contenuto ed è la pagina intera (main) a scorrere. */}
        <div className="ne-sheet mt-4 flex min-h-[35dvh] flex-none flex-col">
          <span className="ne-tape ne-tape-a" aria-hidden="true" />
          <span className="ne-tape ne-tape-b" aria-hidden="true" />
          <TitleInput
            placeholder="Titolo della nota"
            value={form.title}
            onChange={(title) => set({ title })}
            className="ne-title shrink-0"
          />
          <RichText
            ref={editorRef}
            value={form.content}
            onChange={(html) => set({ content: html })}
            placeholder="Scrivi qui la nota…"
            className="ne-body flex-1"
          />
        </div>

        {hasExtras &&
          (() => {
            // Ordine fisso: persone → foto → luogo → tag → canzone. Ogni
            // sezione presente è separata dalla successiva da un divisore.
            // Persone e tag sono su griglia a 2 colonne.
            const sections = []

            if (selectedPeople.length > 0) {
              sections.push(
                <div key="people" className="mp-tapes">
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
                </div>,
              )
            }

            if (!noImages) {
              sections.push(
                <div key="images" className="ne-media-polas">
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
                        className="absolute inset-0"
                      />
                      <button
                        type="button"
                        title="Rimuovi"
                        onClick={() => {
                          setExistingImages((prev) => prev.filter((x) => x !== fn))
                          setRemovedImages((prev) => [...prev, fn])
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
                        className="absolute inset-0"
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
                </div>,
              )
            }

            if (form.place) {
              sections.push(
                <PlaceCard
                  key="place"
                  place={form.place}
                  onRemove={() => set({ place: null })}
                />,
              )
            }

            if (selectedTags.length > 0) {
              sections.push(
                <div key="tags" className="ne-chips">
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
                        <Icon name="x" size={12} />
                      </button>
                    </span>
                  ))}
                </div>,
              )
            }

            if (form.songs.length > 0) {
              sections.push(
                <div key="songs" className="flex flex-col gap-2">
                  {form.songs.map((song, i) => (
                    <div key={i} className="ne-song">
                      {song.thumbnailUrl ? (
                        <div
                          className="ne-song-thumb"
                          style={{ backgroundImage: `url(${song.thumbnailUrl})` }}
                        />
                      ) : (
                        <span className="ne-song-thumb">
                          <Icon name="music" size={14} />
                        </span>
                      )}
                      <a
                        href={song.url}
                        target="_blank"
                        rel="noreferrer"
                        className="ne-song-title"
                      >
                        {song.title}
                      </a>
                      <button
                        type="button"
                        title="Rimuovi"
                        onClick={() => removeSong(i)}
                        className="ne-song-rm"
                      >
                        <Icon name="x" size={14} />
                      </button>
                    </div>
                  ))}
                </div>,
              )
            }

            return (
              <div className="ne-extras mt-4">
                {sections.map((node) => (
                  <div key={node.key} className="ne-extra-block">
                    {node}
                  </div>
                ))}
              </div>
            )
          })()}

        <div className="h-6" />
      </main>

      <input
        ref={fileInputRef}
        type="file"
        accept="image/*"
        multiple
        hidden
        onChange={onPickFiles}
      />

      <MobileBottomBar className="mbottom-note">
        <div className="mfooter">
          <button
            type="button"
            onClick={() => {
              haptic()
              setGeminiSheetOpen(true)
            }}
            title="Gemini"
            aria-label="Gemini"
            className="mcircle mgemini"
          >
            <Icon name="sparkles" size={19} />
          </button>

          <div className="mextra-group">
            <FabButton
              icon="user"
              active={selectedPeople.length > 0}
              count={selectedPeople.length}
              onClick={() => setPeopleSheetOpen(true)}
              title="Aggiungi persone"
            />
            <FabButton
              icon="tag"
              active={selectedTags.length > 0}
              count={selectedTags.length}
              onClick={() => setTagSheetOpen(true)}
              title="Aggiungi tag"
            />
            <FabButton
              icon="music"
              active={form.songs.length > 0}
              count={form.songs.length}
              onClick={() => setSongSheetOpen(true)}
              title="Aggiungi canzone"
            />
            <FabButton
              icon="map-pin"
              active={Boolean(form.place)}
              count={form.place ? 1 : 0}
              onClick={() => setPlaceSheetOpen(true)}
              title="Aggiungi luogo"
            />
            <FabButton
              icon="image-plus"
              iconSize={21}
              active={existingImages.length + previews.length > 0}
              count={existingImages.length + previews.length}
              onClick={() =>
                immichReady ? setAddSheetOpen(true) : fileInputRef.current?.click()
              }
              title="Aggiungi immagini"
            />
          </div>
        </div>
      </MobileBottomBar>

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

      <GeminiSheet
        open={geminiSheetOpen}
        onClose={() => setGeminiSheetOpen(false)}
        apiKey={geminiApiKey}
        content={form.content}
        onReplaceContent={(text) => set({ content: text })}
        customInstructions={geminiCustomInstructions}
      />
    </PhoneShell>
  )
}
