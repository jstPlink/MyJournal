import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { useAuth } from '../../context/AuthContext'
import {
  createNote,
  describeError,
  listNotesInRange,
  peopleUsageCounts,
} from '../../lib/notes'
import { listPeople, createPerson } from '../../lib/people'
import { listTags, createTag } from '../../lib/tags'
import { listImportCsvs, createImportCsv, deleteImportCsv } from '../../lib/importCsvs'
import { extractNotesFromImage, describeGeminiError } from '../../lib/gemini'
import {
  parseDelimited,
  sheetRowsToDays,
  dayToNote,
  timesInText,
  matchMentioned,
} from '../../lib/importSheet'
import { MONTHS_IT, dayKey, dateRangeBounds, importDayLabel } from '../../lib/dates'
import MoodSlider from '../../components/MoodSlider'
import PersonAvatar from '../../components/PersonAvatar'
import PeoplePickerSheet from '../../components/PeoplePickerSheet'
import TagPickerSheet from '../../components/TagPickerSheet'
import AddSongSheet from '../../components/AddSongSheet'
import PlacePickerSheet from '../../components/PlacePickerSheet'
import { mymapConfigFromUser } from '../../lib/mymap'
import PlaceCard from '../../components/PlaceCard'
import AddImagesSheet from '../../components/AddImagesSheet'
import GeminiWait from '../../components/GeminiWait'
import ImmichPicker from '../../components/ImmichPicker'
import Icon from '../../components/Icon'

// Schermata PROVVISORIA (solo web) per migrare il vecchio diario tenuto su
// Google Fogli. Due sorgenti:
//  - "Da foglio (testo)": si incolla/carica l'export TSV/CSV dell'anno (o di
//    un periodo); ogni riga diventa una giornata e ogni giornata UNA nota
//    con tutto il suo testo (vedi dayToNote in lib/importSheet.js) — niente
//    Gemini qui: su tanti giorni insieme si bloccava spesso. La suddivisione
//    in più fasi (e l'umore di ciascuna) si fa in revisione con Fondi/Spezza.
//  - "Da immagine": si incolla lo screenshot di una o più giornate, che
//    Gemini estrae come note separate.
// In entrambi i casi le note estratte si rivedono e salvano una a una, con
// gli stessi selettori del telefono (persone con foto, tag, luogo, canzoni).

const now = new Date()

const clamp01 = (x) => Math.min(1, Math.max(0, x))

// Costruisce la bozza modificabile abbinando i nomi estratti da Gemini alle
// persone/tag già in elenco (match sul nome, case-insensitive); quelli senza
// corrispondenza restano "in attesa" e verranno creati al salvataggio.
function toDraft(n, allPeople, allTags) {
  const peopleIds = []
  const pendingPeople = []
  for (const nm of n.people || []) {
    const hit = allPeople.find(
      (p) => p.name.trim().toLowerCase() === nm.trim().toLowerCase(),
    )
    if (hit) peopleIds.push(hit.id)
    else if (!pendingPeople.some((x) => x.toLowerCase() === nm.toLowerCase()))
      pendingPeople.push(nm)
  }
  const tagIds = []
  const pendingTags = []
  for (const nm of n.tags || []) {
    const hit = allTags.find(
      (t) => t.name.trim().toLowerCase() === nm.trim().toLowerCase(),
    )
    if (hit) tagIds.push(hit.id)
    else if (!pendingTags.some((x) => x.toLowerCase() === nm.toLowerCase()))
      pendingTags.push(nm)
  }
  return {
    date: n.date || '',
    title: n.title || '',
    content: n.content || '',
    mood: typeof n.mood === 'number' ? n.mood : 0.5,
    timeStart: n.timeStart || '',
    timeEnd: n.timeEnd || '',
    peopleIds,
    pendingPeople,
    tagIds,
    pendingTags,
    place: n.place ? { name: n.place, lat: null, lon: null } : null,
    songs: [],
    files: [], // immagini (File) da allegare, aggiunte in revisione
    // Solo import da testo: avvisi non bloccanti + intervallo di righe del
    // blocco originale del giorno (per il pannello di copertura e Fondi/Spezza).
    flags: Array.isArray(n.flags) ? n.flags : [],
    sourceStart: n.sourceStart ?? null,
    sourceEnd: n.sourceEnd ?? null,
  }
}

// Abbina/crea per nome, restituendo gli id. Aggiorna la lista locale con gli
// eventuali nuovi record.
async function resolveNames(names, list, setList, create) {
  const ids = []
  let current = list
  for (const nm of names) {
    let hit = current.find(
      (x) => x.name.trim().toLowerCase() === nm.trim().toLowerCase(),
    )
    if (!hit) {
      hit = await create(nm)
      current = [...current, hit]
    }
    ids.push(hit.id)
  }
  if (current !== list) setList(current)
  return ids
}

export default function WebImport() {
  const navigate = useNavigate()
  const { user } = useAuth()
  const apiKey = user?.geminiApiKey?.trim()
  const immichUrl = user?.immichUrl?.trim()
  const immichApiKey = user?.immichApiKey?.trim()
  const immichReady = Boolean(immichUrl && immichApiKey)
  const spotifyClientId = user?.spotifyClientId?.trim()
  const spotifyClientSecret = user?.spotifyClientSecret?.trim()

  const [mode, setMode] = useState('text') // 'text' (foglio) | 'image' (screenshot)
  const [image, setImage] = useState(null) // { dataUrl, base64, mimeType }
  const [year, setYear] = useState(now.getFullYear())
  const [month, setMonth] = useState(now.getMonth())

  // Import da testo: TSV/CSV dell'anno e mappatura colonne (lettere del foglio).
  const [tsv, setTsv] = useState('')
  const [cols, setCols] = useState({
    month: 'C',
    day: 'E',
    text: 'F',
    title: 'G',
    mood: 'H',
  })
  const [savedCsvs, setSavedCsvs] = useState([]) // libreria di file caricati in precedenza (da import_csvs)
  const [preSkipped, setPreSkipped] = useState(0) // giorni saltati perché già importati
  const [dayText, setDayText] = useState({}) // { 'YYYY-MM-DD': testo grezzo del giorno }

  const [allPeople, setAllPeople] = useState([])
  const [allTags, setAllTags] = useState([])
  const [peopleUsage, setPeopleUsage] = useState(null)

  const [extracting, setExtracting] = useState(false)
  const [extractRetry, setExtractRetry] = useState(null)
  const [error, setError] = useState('')

  const [notes, setNotes] = useState(null) // array estratto (null = non ancora)
  const [index, setIndex] = useState(0)
  const [draft, setDraft] = useState(null)
  const [saving, setSaving] = useState(false)
  const [results, setResults] = useState([]) // [{ title, date, status }]
  const [done, setDone] = useState(false)

  const [peopleSheetOpen, setPeopleSheetOpen] = useState(false)
  const [tagSheetOpen, setTagSheetOpen] = useState(false)
  const [songSheetOpen, setSongSheetOpen] = useState(false)
  const [placeSheetOpen, setPlaceSheetOpen] = useState(false)
  const [addImagesOpen, setAddImagesOpen] = useState(false)
  const [immichOpen, setImmichOpen] = useState(false)

  const fileInputRef = useRef(null) // immagine sorgente (screenshot)
  const tsvFileRef = useRef(null) // file TSV/CSV sorgente (foglio)
  const noteFilesRef = useRef(null) // immagini da allegare alla nota
  const contentRef = useRef(null) // textarea contenuto, per "Spezza qui"

  useEffect(() => {
    listPeople().then(setAllPeople).catch(() => {})
    listTags().then(setAllTags).catch(() => {})
    peopleUsageCounts().then(setPeopleUsage).catch(() => {})
    listImportCsvs().then(setSavedCsvs).catch(() => {})
  }, [])

  const setField = (patch) => setDraft((d) => ({ ...d, ...patch }))

  const selectedPeople = useMemo(
    () => (draft ? allPeople.filter((p) => draft.peopleIds.includes(p.id)) : []),
    [allPeople, draft],
  )
  const selectedTags = useMemo(
    () => (draft ? allTags.filter((t) => draft.tagIds.includes(t.id)) : []),
    [allTags, draft],
  )

  const previews = useMemo(
    () => (draft?.files || []).map((file) => ({ file, url: URL.createObjectURL(file) })),
    [draft?.files],
  )
  useEffect(() => () => previews.forEach((p) => URL.revokeObjectURL(p.url)), [previews])

  // Il box "Contenuto" si espande sempre quanto serve a mostrare tutto il
  // testo, invece di scrollare al suo interno o richiedere un ridimensiona-
  // mento manuale: si ricalcola a ogni cambio di testo (battitura, cambio
  // nota, Fondi/Spezza).
  useEffect(() => {
    const el = contentRef.current
    if (!el) return
    el.style.height = 'auto'
    el.style.height = `${el.scrollHeight}px`
  }, [draft?.content])

  function addFiles(list) {
    const picked = Array.from(list || []).filter((f) => f.type.startsWith('image/'))
    if (picked.length) setDraft((d) => ({ ...d, files: [...d.files, ...picked] }))
  }

  function togglePerson(id) {
    setDraft((d) => ({
      ...d,
      peopleIds: d.peopleIds.includes(id)
        ? d.peopleIds.filter((x) => x !== id)
        : [...d.peopleIds, id],
    }))
  }
  function toggleTag(id) {
    setDraft((d) => ({
      ...d,
      tagIds: d.tagIds.includes(id)
        ? d.tagIds.filter((x) => x !== id)
        : [...d.tagIds, id],
    }))
  }

  // Crea al volo una persona/tag "in attesa" e la sposta tra i selezionati.
  async function materializePending(kind, name) {
    try {
      if (kind === 'person') {
        const rec = await createPerson(name)
        setAllPeople((p) =>
          [...p, rec].sort((a, b) => a.name.localeCompare(b.name)),
        )
        setDraft((d) => ({
          ...d,
          peopleIds: [...d.peopleIds, rec.id],
          pendingPeople: d.pendingPeople.filter((x) => x !== name),
        }))
      } else {
        const rec = await createTag(name)
        setAllTags((t) =>
          [...t, rec].sort((a, b) => a.name.localeCompare(b.name)),
        )
        setDraft((d) => ({
          ...d,
          tagIds: [...d.tagIds, rec.id],
          pendingTags: d.pendingTags.filter((x) => x !== name),
        }))
      }
    } catch (err) {
      setError(describeError(err))
    }
  }

  const loadFile = useCallback((file) => {
    if (!file || !file.type.startsWith('image/')) return
    const reader = new FileReader()
    reader.onload = () => {
      const dataUrl = String(reader.result)
      const comma = dataUrl.indexOf(',')
      const base64 = dataUrl.slice(comma + 1)
      const mimeType =
        dataUrl.slice(5, dataUrl.indexOf(';')) || file.type || 'image/png'
      setImage({ dataUrl, base64, mimeType })
      setNotes(null)
      setDone(false)
      setResults([])
      setError('')
    }
    reader.readAsDataURL(file)
  }, [])

  const pasteEnabled = mode === 'image' && !notes && !done
  useEffect(() => {
    if (!pasteEnabled) return
    function onPaste(e) {
      const item = [...(e.clipboardData?.items || [])].find((i) =>
        i.type.startsWith('image/'),
      )
      if (item) loadFile(item.getAsFile())
    }
    window.addEventListener('paste', onPaste)
    return () => window.removeEventListener('paste', onPaste)
  }, [pasteEnabled, loadFile])

  const years = useMemo(() => {
    const y = now.getFullYear()
    return Array.from({ length: 12 }, (_, i) => y + 1 - i)
  }, [])

  async function runExtract() {
    if (!apiKey || !image || extracting) return
    setExtracting(true)
    setExtractRetry(null)
    setError('')
    try {
      const result = await extractNotesFromImage(apiKey, {
        imageBase64: image.base64,
        mimeType: image.mimeType,
        year,
        month,
        peopleNames: allPeople.map((p) => p.name),
        tagNames: allTags.map((t) => t.name),
        onRetry: (attempt, maxAttempts, model) => setExtractRetry({ attempt, maxAttempts, model }),
      })
      if (!result.length) {
        setError("Nessuna nota estratta dall'immagine.")
        return
      }
      setNotes(result)
      setIndex(0)
      setDraft(toDraft(result[0], allPeople, allTags))
      setResults([])
      setDone(false)
    } catch (err) {
      setError(describeGeminiError(err))
    } finally {
      setExtracting(false)
      setExtractRetry(null)
    }
  }

  // Import da testo: legge il TSV/CSV e ricava le giornate (mese e anno letti
  // dalla riga stessa, vedi sheetRowsToDays). Ogni giornata diventa subito UNA
  // nota con tutto il suo testo (dayToNote, nessuna chiamata a Gemini): la
  // suddivisione in più fasi si fa a mano in revisione con Fondi/Spezza.
  function runExtractText() {
    if (!tsv.trim()) return
    setError('')
    const rows = parseDelimited(tsv)
    const days = sheetRowsToDays(rows, {
      year,
      monthCol: cols.month,
      day: cols.day,
      text: cols.text,
      title: cols.title,
      mood: cols.mood,
    })
    if (!days.length) {
      setError(
        `Nessuna giornata riconosciuta per l'anno ${year}: controlla le colonne indicate.`,
      )
      return
    }
    runExtractTextAsync(days)
  }

  // Parte async separata solo per il controllo anti-duplicato (fetch delle
  // note già presenti nel periodo): il resto è sincrono.
  async function runExtractTextAsync(days) {
    let list = days
    let skipped = 0
    try {
      const { start, end } = dateRangeBounds(
        list[0].dateKey,
        list[list.length - 1].dateKey,
      )
      const existing = await listNotesInRange({ start, end })
      const hasNotes = new Set(existing.map((n) => dayKey(n.date)))
      const before = list.length
      list = list.filter((d) => !hasNotes.has(d.dateKey))
      skipped = before - list.length
    } catch {
      // fetch fallito: si procede senza filtro anti-duplicato
    }
    if (!list.length) {
      setError(`Tutti i ${skipped} giorni presenti nel testo risultano già importati.`)
      return
    }

    const peopleNames = allPeople.map((p) => p.name)
    const tagNames = allTags.map((t) => t.name)
    const texts = {}
    const acc = list.map((d) => {
      texts[d.dateKey] = d.rawText
      return dayToNote(d, { peopleNames, tagNames })
    })
    setDayText(texts)
    setPreSkipped(skipped)
    setNotes(acc)
    setIndex(0)
    setDraft(toDraft(acc[0], allPeople, allTags))
    setResults([])
    setDone(false)
  }

  // Salvata su `import_csvs` (PocketBase), non più solo in localStorage: così
  // resta disponibile anche cambiando dispositivo. Se lo stesso contenuto è
  // già in libreria non lo riduplica.
  async function addSavedCsv(label, content) {
    if (savedCsvs.some((c) => c.content === content)) return
    try {
      const rec = await createImportCsv(label, content)
      setSavedCsvs((prev) => [rec, ...prev])
    } catch (err) {
      setError(describeError(err))
    }
  }

  function loadSavedCsv(entry) {
    setTsv(entry.content)
    setNotes(null)
    setDone(false)
    setResults([])
    setError('')
  }

  async function removeSavedCsv(id) {
    try {
      await deleteImportCsv(id)
      setSavedCsvs((prev) => prev.filter((c) => c.id !== id))
    } catch (err) {
      setError(describeError(err))
    }
  }

  function loadTsvFile(file) {
    if (!file) return
    const reader = new FileReader()
    reader.onload = () => {
      const text = String(reader.result || '')
      setTsv(text)
      setNotes(null)
      setDone(false)
      setResults([])
      setError('')
      addSavedCsv(file.name, text)
    }
    reader.readAsText(file)
  }

  // Ricostruisce un "segmento" (nomi, non id) dalla bozza corrente, così che
  // Fondi/Spezza non perdano le modifiche fatte a mano nella revisione.
  const segFromDraft = useCallback(
    (d) => ({
      date: d.date,
      title: d.title,
      content: d.content,
      mood: d.mood,
      timeStart: d.timeStart,
      timeEnd: d.timeEnd,
      people: [
        ...allPeople.filter((p) => d.peopleIds.includes(p.id)).map((p) => p.name),
        ...d.pendingPeople,
      ],
      tags: [
        ...allTags.filter((t) => d.tagIds.includes(t.id)).map((t) => t.name),
        ...d.pendingTags,
      ],
      place: d.place?.name || '',
      sourceStart: d.sourceStart ?? null,
      sourceEnd: d.sourceEnd ?? null,
    }),
    [allPeople, allTags],
  )

  // Fonde la nota corrente con quella adiacente (dir = -1 prima, +1 dopo).
  // Se gli indici di riga originali sono noti si ricompone il testo dal blocco
  // del giorno; altrimenti si concatenano i due contenuti.
  function mergeAdjacent(dir) {
    if (!notes || !draft) return
    const j = index + dir
    if (j < 0 || j >= notes.length) return
    const cur = segFromDraft(draft)
    const other = notes[j]
    if (cur.date !== other.date) {
      setError('Si possono fondere solo blocchi dello stesso giorno.')
      return
    }
    const a = dir < 0 ? other : cur
    const b = dir < 0 ? cur : other
    const haveIdx = a.sourceStart != null && b.sourceEnd != null
    const lines = String(dayText[cur.date] || '')
      .replace(/\r\n/g, '\n')
      .split('\n')
    const content = haveIdx
      ? lines
          .slice(a.sourceStart, b.sourceEnd + 1)
          .join('\n')
          .replace(/^\s+|\s+$/g, '')
      : [a.content, b.content].filter((s) => s && s.trim()).join('\n')
    const times = timesInText(content)
    const uniq = (arr) => [...new Set(arr.filter(Boolean))]
    const startTimes = [a.timeStart, b.timeStart].filter(Boolean).sort()
    const endTimes = [a.timeEnd, b.timeEnd].filter(Boolean).sort()
    const mergedSeg = {
      date: cur.date,
      title: a.title || b.title,
      content,
      mood: clamp01((Number(a.mood) + Number(b.mood)) / 2),
      timeStart: startTimes[0] || times[0] || '',
      timeEnd: endTimes[endTimes.length - 1] || times[times.length - 1] || '',
      people: uniq([...(a.people || []), ...(b.people || [])]),
      tags: uniq([...(a.tags || []), ...(b.tags || [])]),
      place: a.place || b.place || '',
      sourceStart: haveIdx ? a.sourceStart : null,
      sourceEnd: haveIdx ? b.sourceEnd : null,
      flags: [],
    }
    const lo = Math.min(index, j)
    setNotes([...notes.slice(0, lo), mergedSeg, ...notes.slice(lo + 2)])
    setIndex(lo)
    setDraft(toDraft(mergedSeg, allPeople, allTags))
    setError('')
  }

  // Spezza la nota corrente nel punto in cui è il cursore dentro il contenuto:
  // la parte prima resta, quella dopo diventa una nuova nota subito successiva.
  function splitAtCaret() {
    if (!draft || !notes) return
    const ta = contentRef.current
    const pos =
      ta && ta.selectionStart != null ? ta.selectionStart : draft.content.length
    const before = draft.content.slice(0, pos).replace(/\s+$/g, '')
    const after = draft.content.slice(pos).replace(/^\s+/g, '')
    if (!before.trim() || !after.trim()) {
      setError('Metti il cursore nel punto del testo in cui vuoi spezzare.')
      return
    }
    const base = segFromDraft(draft)
    const tA = timesInText(before)
    const tB = timesInText(after)
    const peopleNames = allPeople.map((p) => p.name)
    const tagNames = allTags.map((t) => t.name)
    const partA = {
      ...base,
      content: before,
      // Il primo pezzo eredita l'inizio del blocco originale se il suo testo
      // non contiene orari; la fine no (apparteneva al blocco intero, non a
      // questa metà) — resta vuota finché non c'è un orario da leggere lì.
      timeStart: tA[0] || base.timeStart || '',
      timeEnd: tA[tA.length - 1] || '',
      people: matchMentioned(before, peopleNames),
      tags: matchMentioned(before, tagNames),
      sourceStart: null,
      sourceEnd: null,
      flags: [],
    }
    const partB = {
      ...base,
      title: '',
      content: after,
      // Speculare: il secondo pezzo eredita la fine del blocco originale se
      // manca, non l'inizio.
      timeStart: tB[0] || '',
      timeEnd: tB[tB.length - 1] || base.timeEnd || '',
      people: matchMentioned(after, peopleNames),
      tags: matchMentioned(after, tagNames),
      sourceStart: null,
      sourceEnd: null,
      flags: [],
    }
    setNotes([...notes.slice(0, index), partA, partB, ...notes.slice(index + 1)])
    setDraft(toDraft(partA, allPeople, allTags))
    setError('')
  }

  function advance(entry) {
    setResults((r) => [...r, entry])
    const next = index + 1
    if (next >= notes.length) {
      setDone(true)
      setDraft(null)
    } else {
      setIndex(next)
      setDraft(toDraft(notes[next], allPeople, allTags))
    }
  }

  async function saveCurrent() {
    if (!draft || saving || !draft.date) return
    setSaving(true)
    setError('')
    try {
      const createdPeopleIds = await resolveNames(
        draft.pendingPeople,
        allPeople,
        setAllPeople,
        createPerson,
      )
      const createdTagIds = await resolveNames(
        draft.pendingTags,
        allTags,
        setAllTags,
        createTag,
      )
      const peopleIds = [...new Set([...draft.peopleIds, ...createdPeopleIds])]
      const tagIds = [...new Set([...draft.tagIds, ...createdTagIds])]
      await createNote(
        {
          dateKey: draft.date,
          title: draft.title,
          content: draft.content,
          mood: draft.mood,
          place: draft.place,
          songs: draft.songs,
          timeStart: draft.timeStart || '09:00',
          timeEnd: draft.timeEnd || '10:00',
        },
        { newFiles: draft.files, peopleIds, tagIds },
      )
      advance({
        title: draft.title || '(senza titolo)',
        date: draft.date,
        status: 'saved',
      })
    } catch (err) {
      setError(describeError(err))
    } finally {
      setSaving(false)
    }
  }

  function skipCurrent() {
    if (!draft) return
    advance({
      title: draft.title || '(senza titolo)',
      date: draft.date,
      status: 'skipped',
    })
  }

  function reset() {
    setImage(null)
    setTsv('')
    setDayText({})
    setPreSkipped(0)
    setNotes(null)
    setDraft(null)
    setResults([])
    setDone(false)
    setError('')
  }

  return (
    <div className="mx-auto max-w-2xl">
      <div className="mb-6 flex items-baseline justify-between gap-3">
        <h1 className="font-serif text-4xl font-semibold tracking-tight text-ink">
          Importa
        </h1>
        <span className="flex items-center gap-1.5 rounded-full border border-warn-dark bg-warn px-2.5 py-1 text-xs font-bold text-ink">
          <Icon name="alert-triangle" size={13} className="shrink-0" />
          Funzione provvisoria
        </span>
      </div>

      {!notes && !done && (
        <div className="mb-4 inline-flex rounded-full border border-line bg-tag p-1 text-sm font-bold">
          {[
            ['text', 'Da foglio (testo)'],
            ['image', 'Da immagine'],
          ].map(([key, label]) => (
            <button
              key={key}
              type="button"
              onClick={() => {
                setMode(key)
                setError('')
              }}
              className={
                'rounded-full px-4 py-1.5 transition ' +
                (mode === key
                  ? 'bg-save text-ink shadow-sm'
                  : 'text-ink-soft hover:text-ink')
              }
            >
              {label}
            </button>
          ))}
        </div>
      )}

      {mode === 'image' && !apiKey && (
        <p className="mb-4 rounded-2xl bg-delete/15 px-4 py-3 text-sm text-delete-dark">
          Configura una chiave API Gemini in Profilo per usare questa schermata.
        </p>
      )}

      {/* ---- 1a. Da foglio: TSV/CSV di un mese ---- */}
      {mode === 'text' && !notes && !done && (
        <div className="space-y-4 rounded-3xl border border-line bg-tag p-6">
          <button
            type="button"
            onClick={() => tsvFileRef.current?.click()}
            onDragOver={(e) => e.preventDefault()}
            onDrop={(e) => {
              e.preventDefault()
              loadTsvFile(e.dataTransfer.files?.[0])
            }}
            className="flex min-h-[64px] w-full items-center justify-center gap-2 rounded-2xl border-2 border-dashed border-line bg-cream p-3 text-center text-sm font-semibold text-ink transition hover:border-ink-soft"
          >
            <Icon name="list" size={18} className="text-ink-soft" />
            Trascina o clicca per caricare un file .tsv / .csv
          </button>
          <input
            ref={tsvFileRef}
            type="file"
            accept=".tsv,.csv,.txt,text/plain,text/tab-separated-values"
            hidden
            onChange={(e) => {
              loadTsvFile(e.target.files?.[0])
              e.target.value = ''
            }}
          />
          <label className="block">
            <span className="mb-1 block text-xs font-semibold uppercase tracking-wide text-ink-soft">
              …oppure incolla qui le righe del mese (Ctrl/Cmd+V)
            </span>
            <textarea
              rows={7}
              value={tsv}
              onChange={(e) => setTsv(e.target.value)}
              placeholder={
                'Incolla qui le righe del vecchio diario (anche l’anno intero): una riga per giorno, colonne separate da TAB (o virgola). Le celle con più righe restano tra virgolette — va bene così.'
              }
              className="w-full resize-y rounded-xl border border-line bg-cream px-3 py-2 font-mono text-xs leading-relaxed text-ink outline-none focus:border-ink-soft"
            />
          </label>

          {savedCsvs.length > 0 && (
            <div className="flex flex-wrap gap-2">
              {savedCsvs.map((c) => (
                <span
                  key={c.id}
                  className="flex items-center gap-1.5 rounded-full border border-line bg-cream py-1 pl-3 pr-1.5 text-xs font-semibold text-ink"
                >
                  <button
                    type="button"
                    onClick={() => loadSavedCsv(c)}
                    title={`Rimetti nel box: ${c.label}`}
                    className="max-w-[160px] truncate hover:underline"
                  >
                    {c.label}
                  </button>
                  <button
                    type="button"
                    onClick={() => removeSavedCsv(c.id)}
                    title="Dimentica questo file"
                    className="rounded-full p-0.5 text-ink-soft transition hover:text-delete-dark"
                  >
                    <Icon name="x" size={12} />
                  </button>
                </span>
              ))}
            </div>
          )}

          <div className="flex flex-wrap items-end gap-3">
            <label className="block">
              <span className="mb-1 block text-xs font-semibold uppercase tracking-wide text-ink-soft">
                Anno
              </span>
              <select
                value={year}
                onChange={(e) => setYear(Number(e.target.value))}
                className="rounded-xl border border-line bg-cream px-3 py-2 text-sm text-ink outline-none"
              >
                {years.map((y) => (
                  <option key={y} value={y}>
                    {y}
                  </option>
                ))}
              </select>
            </label>
          </div>

          <div className="flex flex-wrap items-end gap-3">
            {[
              ['month', 'Col. mese'],
              ['day', 'Col. giorno'],
              ['text', 'Col. testo'],
              ['title', 'Col. titolo'],
              ['mood', 'Col. voto'],
            ].map(([key, label]) => (
              <label key={key} className="block">
                <span className="mb-1 block text-xs font-semibold uppercase tracking-wide text-ink-soft">
                  {label}
                </span>
                <input
                  type="text"
                  value={cols[key]}
                  onChange={(e) =>
                    setCols((c) => ({
                      ...c,
                      [key]: e.target.value.toUpperCase().slice(0, 3),
                    }))
                  }
                  placeholder="—"
                  className="w-16 rounded-xl border border-line bg-cream px-3 py-2 text-center text-sm text-ink outline-none focus:border-ink-soft"
                />
              </label>
            ))}
            <p className="w-full text-xs text-ink-soft">
              Lettere di colonna del foglio (A, B, C…). Lascia vuoto “titolo” o
              “voto” se non ci sono. La colonna <strong>“mese”</strong> (numero
              1–12 o nome) va sempre indicata: dice a ogni riga in che mese
              cade, così si può incollare l’anno intero in un colpo solo —
              niente più menu da cambiare mese per mese. I giorni già
              importati vengono saltati in automatico.
            </p>
          </div>

          <div className="flex items-center gap-3">
            <button
              type="button"
              disabled={!tsv.trim()}
              onClick={runExtractText}
              className="ml-auto rounded-full border border-save-dark bg-save px-5 py-2.5 text-sm font-bold text-ink transition hover:brightness-105 disabled:opacity-50"
            >
              Prepara le note
            </button>
          </div>

          {error && <p className="text-sm text-delete-dark">{error}</p>}
        </div>
      )}

      {/* ---- 1b. Da immagine: screenshot + periodo ---- */}
      {mode === 'image' && !notes && !done && (
        <div className="space-y-4 rounded-3xl border border-line bg-tag p-6">
          <button
            type="button"
            onClick={() => fileInputRef.current?.click()}
            onDragOver={(e) => e.preventDefault()}
            onDrop={(e) => {
              e.preventDefault()
              loadFile(e.dataTransfer.files?.[0])
            }}
            className="flex min-h-[180px] w-full flex-col items-center justify-center gap-2 rounded-2xl border-2 border-dashed border-line bg-cream p-4 text-center transition hover:border-ink-soft"
          >
            {image ? (
              <img
                src={image.dataUrl}
                alt="Anteprima"
                className="max-h-[420px] w-auto rounded-lg"
              />
            ) : (
              <>
                <Icon name="image-plus" size={28} className="text-ink-soft" />
                <span className="text-sm font-semibold text-ink">
                  Incolla, trascina o clicca per scegliere un'immagine
                </span>
              </>
            )}
          </button>
          <input
            ref={fileInputRef}
            type="file"
            accept="image/*"
            hidden
            onChange={(e) => {
              loadFile(e.target.files?.[0])
              e.target.value = ''
            }}
          />

          <div className="flex flex-wrap items-end gap-3">
            <label className="block">
              <span className="mb-1 block text-xs font-semibold uppercase tracking-wide text-ink-soft">
                Mese di riferimento
              </span>
              <select
                value={month}
                onChange={(e) => setMonth(Number(e.target.value))}
                className="rounded-xl border border-line bg-cream px-3 py-2 text-sm text-ink outline-none"
              >
                {MONTHS_IT.map((m, i) => (
                  <option key={m} value={i}>
                    {m}
                  </option>
                ))}
              </select>
            </label>
            <label className="block">
              <span className="mb-1 block text-xs font-semibold uppercase tracking-wide text-ink-soft">
                Anno
              </span>
              <select
                value={year}
                onChange={(e) => setYear(Number(e.target.value))}
                className="rounded-xl border border-line bg-cream px-3 py-2 text-sm text-ink outline-none"
              >
                {years.map((y) => (
                  <option key={y} value={y}>
                    {y}
                  </option>
                ))}
              </select>
            </label>
            <button
              type="button"
              disabled={!apiKey || !image || extracting}
              onClick={runExtract}
              className="ml-auto rounded-full border border-save-dark bg-save px-5 py-2.5 text-sm font-bold text-ink transition hover:brightness-105 disabled:opacity-50"
            >
              {extracting ? 'Estraggo…' : 'Estrai note'}
            </button>
          </div>

          {extracting && <GeminiWait retry={extractRetry} />}
          {error && <p className="text-sm text-delete-dark">{error}</p>}
        </div>
      )}

      {/* ---- 2. Revisione nota per nota ---- */}
      {notes && !done && draft && (
        <div className="space-y-4 rounded-3xl border border-line bg-tag p-6">
          <div className="flex items-center justify-between">
            <span className="text-sm font-semibold text-ink-soft">
              Nota {index + 1} di {notes.length}
              {mode === 'text' && preSkipped > 0 && (
                <span className="ml-2 font-normal">
                  · {preSkipped} giorni già importati, saltati
                </span>
              )}
            </span>
            <button
              type="button"
              onClick={reset}
              className="text-xs font-semibold text-ink-soft underline underline-offset-2 hover:text-ink"
            >
              Ricomincia
            </button>
          </div>

          {/* Solo import da testo: Fondi/Spezza + avvisi + blocco originale */}
          {mode === 'text' && (
            <>
              <div className="flex flex-wrap items-center gap-2">
                <button
                  type="button"
                  onClick={() => mergeAdjacent(-1)}
                  disabled={
                    saving ||
                    index === 0 ||
                    notes[index - 1]?.date !== draft.date
                  }
                  className="rounded-full border border-line bg-cream px-3 py-1.5 text-xs font-bold text-ink transition hover:bg-tag disabled:opacity-40"
                >
                  ↑ Fondi con precedente
                </button>
                <button
                  type="button"
                  onClick={() => mergeAdjacent(1)}
                  disabled={
                    saving ||
                    index + 1 >= notes.length ||
                    notes[index + 1]?.date !== draft.date
                  }
                  className="rounded-full border border-line bg-cream px-3 py-1.5 text-xs font-bold text-ink transition hover:bg-tag disabled:opacity-40"
                >
                  ↓ Fondi con successiva
                </button>
                <button
                  type="button"
                  onClick={splitAtCaret}
                  disabled={saving}
                  className="rounded-full border border-line bg-cream px-3 py-1.5 text-xs font-bold text-ink transition hover:bg-tag disabled:opacity-40"
                  title="Spezza il contenuto nel punto in cui è il cursore"
                >
                  ✂ Spezza qui
                </button>
              </div>

              {draft.flags?.length > 0 && (
                <div className="flex flex-wrap gap-1.5">
                  {draft.flags.map((f) => (
                    <span
                      key={f}
                      className="flex items-center gap-1 rounded-full border border-warn-dark bg-warn px-2 py-0.5 text-xs font-semibold text-ink"
                    >
                      <Icon name="alert-triangle" size={11} className="shrink-0" />
                      {f}
                    </span>
                  ))}
                </div>
              )}

              {dayText[draft.date] != null && (
                <details className="rounded-2xl border border-line bg-cream p-3 text-sm">
                  <summary className="cursor-pointer text-xs font-semibold uppercase tracking-wide text-ink-soft">
                    Blocco originale del giorno
                    {draft.sourceStart != null
                      ? ` · righe evidenziate = questa nota`
                      : ' · modificata a mano'}
                  </summary>
                  <pre className="mt-2 overflow-x-auto whitespace-pre-wrap font-mono text-xs leading-relaxed text-ink">
                    {String(dayText[draft.date])
                      .replace(/\r\n/g, '\n')
                      .split('\n')
                      .map((ln, i) => {
                        const inSeg =
                          draft.sourceStart != null &&
                          i >= draft.sourceStart &&
                          i <= draft.sourceEnd
                        return (
                          <span
                            key={i}
                            className={
                              inSeg ? 'block bg-save/40' : 'block text-ink-soft'
                            }
                          >
                            {ln || ' '}
                          </span>
                        )
                      })}
                  </pre>
                </details>
              )}
            </>
          )}

          <div className="flex flex-wrap items-end justify-between gap-3">
            <label className="block">
              <span className="mb-1 block text-xs font-semibold uppercase tracking-wide text-ink-soft">
                {draft.date ? importDayLabel(draft.date) : 'Data'}
              </span>
              <input
                type="date"
                value={draft.date}
                onChange={(e) => setField({ date: e.target.value })}
                className="rounded-xl border border-line bg-cream px-3 py-2 text-sm text-ink outline-none"
              />
            </label>
            <div className="flex gap-3">
              <label className="block">
                <span className="mb-1 block text-xs font-semibold uppercase tracking-wide text-ink-soft">
                  Inizio
                </span>
                <input
                  type="time"
                  value={draft.timeStart}
                  onChange={(e) => setField({ timeStart: e.target.value })}
                  className="rounded-xl border border-line bg-cream px-3 py-2 text-sm text-ink outline-none"
                />
              </label>
              <label className="block">
                <span className="mb-1 block text-xs font-semibold uppercase tracking-wide text-ink-soft">
                  Fine
                </span>
                <input
                  type="time"
                  value={draft.timeEnd}
                  onChange={(e) => setField({ timeEnd: e.target.value })}
                  className="rounded-xl border border-line bg-cream px-3 py-2 text-sm text-ink outline-none"
                />
              </label>
            </div>
          </div>

          <MoodSlider value={draft.mood} onChange={(mood) => setField({ mood })} />

          <label className="block">
            <span className="mb-1 block text-xs font-semibold uppercase tracking-wide text-ink-soft">
              Titolo
            </span>
            <input
              type="text"
              value={draft.title}
              onChange={(e) => setField({ title: e.target.value })}
              placeholder="Titolo della nota"
              className="w-full rounded-xl border border-line bg-cream px-3 py-2 text-sm text-ink outline-none focus:border-ink-soft"
            />
          </label>

          <label className="block">
            <span className="mb-1 block text-xs font-semibold uppercase tracking-wide text-ink-soft">
              Contenuto
            </span>
            <textarea
              ref={contentRef}
              rows={9}
              value={draft.content}
              onChange={(e) => setField({ content: e.target.value })}
              className="w-full resize-none overflow-hidden rounded-xl border border-line bg-cream px-3 py-2 text-sm leading-relaxed text-ink outline-none focus:border-ink-soft"
            />
          </label>

          {/* Immagini */}
          <div className="rounded-2xl border border-line bg-cream p-3">
            <div className="mb-2 flex items-center justify-between">
              <span className="text-xs font-semibold uppercase tracking-wide text-ink-soft">
                Immagini
              </span>
              <button
                type="button"
                onClick={() =>
                  immichReady
                    ? setAddImagesOpen(true)
                    : noteFilesRef.current?.click()
                }
                className="rounded-full border border-line bg-tag px-3 py-1 text-xs font-bold text-ink transition hover:brightness-95"
              >
                + Aggiungi
              </button>
            </div>
            {previews.length === 0 ? (
              <p className="text-sm italic text-ink-soft">Nessuna immagine</p>
            ) : (
              <div className="grid grid-cols-4 gap-2">
                {previews.map((p, i) => (
                  <div
                    key={p.url}
                    className="relative aspect-square overflow-hidden rounded-lg bg-panel-2 ring-2 ring-save"
                  >
                    <img
                      src={p.url}
                      alt=""
                      className="h-full w-full object-cover"
                    />
                    <button
                      type="button"
                      title="Rimuovi"
                      onClick={() =>
                        setField({
                          files: draft.files.filter((_, idx) => idx !== i),
                        })
                      }
                      className="absolute right-1 top-1 rounded-full bg-black/55 px-1.5 text-xs text-white"
                    >
                      ×
                    </button>
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* Persone */}
          <div className="rounded-2xl border border-line bg-cream p-3">
            <div className="mb-2 flex items-center justify-between">
              <span className="text-xs font-semibold uppercase tracking-wide text-ink-soft">
                Persone
              </span>
              <button
                type="button"
                onClick={() => setPeopleSheetOpen(true)}
                className="rounded-full border border-line bg-tag px-3 py-1 text-xs font-bold text-ink transition hover:brightness-95"
              >
                + Aggiungi
              </button>
            </div>
            {selectedPeople.length === 0 && draft.pendingPeople.length === 0 ? (
              <p className="text-sm italic text-ink-soft">Nessuna persona</p>
            ) : (
              <div className="flex flex-wrap gap-1.5">
                {selectedPeople.map((person) => (
                  <span
                    key={person.id}
                    className="flex items-center gap-2 rounded-full border border-line bg-tag py-1 pl-1 pr-2"
                  >
                    <PersonAvatar
                      person={person}
                      immichUrl={immichUrl}
                      immichApiKey={immichApiKey}
                      size={24}
                    />
                    <span className="text-sm font-semibold text-ink">
                      {person.name}
                    </span>
                    <button
                      type="button"
                      title="Rimuovi"
                      onClick={() => togglePerson(person.id)}
                      className="text-ink-soft"
                    >
                      <Icon name="x" size={14} />
                    </button>
                  </span>
                ))}
                {draft.pendingPeople.map((nm) => (
                  <span
                    key={nm}
                    className="flex items-center gap-1.5 rounded-full border border-dashed border-line bg-tag/60 py-1 pl-2.5 pr-1.5 text-sm font-semibold text-ink-soft"
                  >
                    {nm}
                    <button
                      type="button"
                      title="Crea e aggiungi"
                      onClick={() => materializePending('person', nm)}
                      className="rounded-full bg-save px-1.5 text-xs font-bold text-ink"
                    >
                      crea
                    </button>
                    <button
                      type="button"
                      title="Scarta"
                      onClick={() =>
                        setField({
                          pendingPeople: draft.pendingPeople.filter(
                            (x) => x !== nm,
                          ),
                        })
                      }
                      className="text-ink-soft"
                    >
                      <Icon name="x" size={14} />
                    </button>
                  </span>
                ))}
              </div>
            )}
          </div>

          {/* Tag */}
          <div className="rounded-2xl border border-line bg-cream p-3">
            <div className="mb-2 flex items-center justify-between">
              <span className="text-xs font-semibold uppercase tracking-wide text-ink-soft">
                Tag
              </span>
              <button
                type="button"
                onClick={() => setTagSheetOpen(true)}
                className="rounded-full border border-line bg-tag px-3 py-1 text-xs font-bold text-ink transition hover:brightness-95"
              >
                + Aggiungi
              </button>
            </div>
            {selectedTags.length === 0 && draft.pendingTags.length === 0 ? (
              <p className="text-sm italic text-ink-soft">Nessun tag</p>
            ) : (
              <div className="flex flex-wrap gap-1.5">
                {selectedTags.map((tag) => (
                  <span
                    key={tag.id}
                    className="flex items-center gap-1.5 rounded-lg border border-line bg-tag py-1 pl-2 pr-1.5 text-sm font-medium text-ink"
                  >
                    <Icon name="tag" size={12} className="shrink-0 text-ink-soft" />
                    {tag.name}
                    <button
                      type="button"
                      title="Rimuovi"
                      onClick={() => toggleTag(tag.id)}
                      className="text-ink-soft"
                    >
                      <Icon name="x" size={12} />
                    </button>
                  </span>
                ))}
                {draft.pendingTags.map((nm) => (
                  <span
                    key={nm}
                    className="flex items-center gap-1.5 rounded-lg border border-dashed border-line bg-tag/60 py-1 pl-2 pr-1.5 text-sm font-medium text-ink-soft"
                  >
                    {nm}
                    <button
                      type="button"
                      title="Crea e aggiungi"
                      onClick={() => materializePending('tag', nm)}
                      className="rounded-full bg-save px-1.5 text-xs font-bold text-ink"
                    >
                      crea
                    </button>
                    <button
                      type="button"
                      title="Scarta"
                      onClick={() =>
                        setField({
                          pendingTags: draft.pendingTags.filter((x) => x !== nm),
                        })
                      }
                      className="text-ink-soft"
                    >
                      <Icon name="x" size={12} />
                    </button>
                  </span>
                ))}
              </div>
            )}
          </div>

          {/* Luogo */}
          <div className="rounded-2xl border border-line bg-cream p-3">
            <div className="mb-2 flex items-center justify-between">
              <span className="text-xs font-semibold uppercase tracking-wide text-ink-soft">
                Luogo
              </span>
              <button
                type="button"
                onClick={() => setPlaceSheetOpen(true)}
                className="rounded-full border border-line bg-tag px-3 py-1 text-xs font-bold text-ink transition hover:brightness-95"
              >
                {draft.place ? 'Cambia' : '+ Aggiungi'}
              </button>
            </div>
            {draft.place ? (
              draft.place.lat != null ? (
                <PlaceCard
                  place={draft.place}
                  onRemove={() => setField({ place: null })}
                />
              ) : (
                <div className="flex items-center gap-2">
                  <input
                    type="text"
                    value={draft.place.name}
                    onChange={(e) =>
                      setField({
                        place: { ...draft.place, name: e.target.value },
                      })
                    }
                    placeholder="Nome del luogo (senza mappa)"
                    className="min-w-0 flex-1 rounded-xl border border-line bg-tag px-3 py-2 text-sm text-ink outline-none"
                  />
                  <button
                    type="button"
                    title="Rimuovi"
                    onClick={() => setField({ place: null })}
                    className="shrink-0 text-ink-soft"
                  >
                    <Icon name="x" size={16} />
                  </button>
                </div>
              )
            ) : (
              <p className="text-sm italic text-ink-soft">Nessun luogo</p>
            )}
          </div>

          {/* Canzoni */}
          <div className="rounded-2xl border border-line bg-cream p-3">
            <div className="mb-2 flex items-center justify-between">
              <span className="text-xs font-semibold uppercase tracking-wide text-ink-soft">
                Canzoni
              </span>
              <button
                type="button"
                onClick={() => setSongSheetOpen(true)}
                className="rounded-full border border-line bg-tag px-3 py-1 text-xs font-bold text-ink transition hover:brightness-95"
              >
                + Aggiungi
              </button>
            </div>
            {draft.songs.length === 0 ? (
              <p className="text-sm italic text-ink-soft">Nessuna canzone</p>
            ) : (
              <div className="space-y-2">
                {draft.songs.map((song, i) => (
                  <div
                    key={i}
                    className="flex items-center gap-2 rounded-xl border border-line bg-tag px-2 py-1.5"
                  >
                    {song.thumbnailUrl ? (
                      <img
                        src={song.thumbnailUrl}
                        alt=""
                        className="h-9 w-9 shrink-0 rounded-lg object-cover"
                      />
                    ) : (
                      <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-panel-2 text-ink-soft">
                        <Icon name="music" size={16} />
                      </span>
                    )}
                    <a
                      href={song.url}
                      target="_blank"
                      rel="noreferrer"
                      className="min-w-0 flex-1 truncate text-sm font-semibold text-ink"
                    >
                      {song.title}
                    </a>
                    <button
                      type="button"
                      title="Rimuovi"
                      onClick={() =>
                        setField({
                          songs: draft.songs.filter((_, idx) => idx !== i),
                        })
                      }
                      className="shrink-0 text-ink-soft"
                    >
                      <Icon name="x" size={14} />
                    </button>
                  </div>
                ))}
              </div>
            )}
          </div>

          {error && <p className="text-sm text-delete-dark">{error}</p>}

          <div className="flex items-center gap-3 pt-1">
            <button
              type="button"
              onClick={skipCurrent}
              disabled={saving}
              className="rounded-full border border-line bg-cream px-4 py-2.5 text-sm font-bold text-ink transition hover:bg-tag disabled:opacity-50"
            >
              Salta
            </button>
            <button
              type="button"
              onClick={saveCurrent}
              disabled={saving || !draft.date}
              title={draft.date ? undefined : 'Manca la data'}
              className="ml-auto rounded-full border border-save-dark bg-save px-5 py-2.5 text-sm font-bold text-ink transition hover:brightness-105 disabled:opacity-50"
            >
              {saving
                ? 'Salvo…'
                : index + 1 < notes.length
                  ? 'Salva e continua'
                  : 'Salva e chiudi'}
            </button>
          </div>
        </div>
      )}

      {/* ---- 3. Riepilogo ---- */}
      {done && (
        <div className="space-y-4 rounded-3xl border border-line bg-tag p-6">
          <h2 className="font-serif text-2xl font-semibold text-ink">Fatto</h2>
          <p className="text-sm text-ink-soft">
            {results.filter((r) => r.status === 'saved').length} salvate,{' '}
            {results.filter((r) => r.status === 'skipped').length} saltate.
            {preSkipped > 0 &&
              ` ${preSkipped} giorni non riproposti perché già presenti nel diario.`}
          </p>
          <ul className="divide-y divide-line-soft border-y border-line-soft text-sm">
            {results.map((r, i) => (
              <li key={i} className="flex items-center justify-between py-2">
                <span className="min-w-0 truncate text-ink">
                  {r.date} · {r.title}
                </span>
                <span
                  className={
                    'ml-3 shrink-0 text-xs font-semibold ' +
                    (r.status === 'saved' ? 'text-save-dark' : 'text-ink-soft')
                  }
                >
                  {r.status === 'saved' ? 'salvata' : 'saltata'}
                </span>
              </li>
            ))}
          </ul>
          <div className="flex gap-3">
            <button
              type="button"
              onClick={reset}
              className="rounded-full border border-line bg-cream px-4 py-2.5 text-sm font-bold text-ink transition hover:bg-tag"
            >
              Importa altro
            </button>
            <button
              type="button"
              onClick={() => navigate('/')}
              className="rounded-full border border-save-dark bg-save px-4 py-2.5 text-sm font-bold text-ink transition hover:brightness-105"
            >
              Vai al calendario
            </button>
          </div>
        </div>
      )}

      <input
        ref={noteFilesRef}
        type="file"
        accept="image/*"
        multiple
        hidden
        onChange={(e) => {
          addFiles(e.target.files)
          e.target.value = ''
        }}
      />

      {draft && (
        <>
          <AddImagesSheet
            open={addImagesOpen}
            onClose={() => setAddImagesOpen(false)}
            onDevice={() => noteFilesRef.current?.click()}
            onImmich={immichReady ? () => setImmichOpen(true) : null}
          />
          {immichReady && (
            <ImmichPicker
              open={immichOpen}
              baseUrl={immichUrl}
              apiKey={immichApiKey}
              onClose={() => setImmichOpen(false)}
              onConfirm={(files) => {
                addFiles(files)
                setImmichOpen(false)
              }}
            />
          )}
          <PeoplePickerSheet
            open={peopleSheetOpen}
            people={allPeople}
            selectedIds={draft.peopleIds}
            immichUrl={immichUrl}
            immichApiKey={immichApiKey}
            usageCounts={peopleUsage}
            onClose={() => setPeopleSheetOpen(false)}
            onToggle={togglePerson}
            onCreated={(person) => {
              setAllPeople((prev) =>
                [...prev, person].sort((a, b) => a.name.localeCompare(b.name)),
              )
              setDraft((d) => ({ ...d, peopleIds: [...d.peopleIds, person.id] }))
            }}
          />
          <TagPickerSheet
            open={tagSheetOpen}
            tags={allTags}
            selectedIds={draft.tagIds}
            onClose={() => setTagSheetOpen(false)}
            onToggle={toggleTag}
            onCreated={(tag) => {
              setAllTags((prev) =>
                [...prev, tag].sort((a, b) => a.name.localeCompare(b.name)),
              )
              setDraft((d) => ({ ...d, tagIds: [...d.tagIds, tag.id] }))
            }}
          />
          <AddSongSheet
            open={songSheetOpen}
            onClose={() => setSongSheetOpen(false)}
            onAdd={(song) =>
              setDraft((d) => ({ ...d, songs: [...d.songs, song] }))
            }
            spotifyClientId={spotifyClientId}
            spotifyClientSecret={spotifyClientSecret}
          />
          <PlacePickerSheet
            open={placeSheetOpen}
            onClose={() => setPlaceSheetOpen(false)}
            onAdd={(place) => setField({ place })}
            mymap={mymapConfigFromUser(user)}
            dateKey={draft.date}
          />
        </>
      )}
    </div>
  )
}
