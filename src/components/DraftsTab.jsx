import { useEffect, useRef, useState, useSyncExternalStore } from 'react'
import { createPortal } from 'react-dom'
import { useLocation, useNavigate } from 'react-router-dom'
import SideTab from './SideTab'
import Icon from './Icon'
import NewNoteWithGeminiSheet from './NewNoteWithGeminiSheet'
import { useAuth } from '../context/AuthContext'
import { listDrafts, removeDraft, subscribeDrafts } from '../lib/drafts'
import {
  listGeminiDrafts,
  newGeminiDraftId,
  removeGeminiDraft,
  saveGeminiDraft,
  subscribeGeminiDrafts,
} from '../lib/geminiDrafts'
import { deleteVoice, listVoices, subscribeVoices, updateVoice } from '../lib/voiceStore'
import { listDreamDrafts, subscribeDreamDrafts } from '../lib/dreamDrafts'
import { dayKey } from '../lib/dates'
import { listPeople } from '../lib/people'
import { listTags } from '../lib/tags'
import { dayMonthLabel } from '../lib/dates'
import { playSound } from '../lib/sounds'
import { noteInstructionsOf } from '../lib/aiInstructions'

export function ago(ms) {
  const m = Math.max(0, Math.round((Date.now() - ms) / 60_000))
  if (m < 1) return 'adesso'
  if (m < 60) return `${m} min fa`
  const h = Math.round(m / 60)
  if (h < 24) return `${h} h fa`
  const d = Math.round(h / 24)
  return d === 1 ? 'ieri' : `${d} giorni fa`
}

export const fmtLen = (s) => `${Math.floor(s / 60)}:${String(s % 60).padStart(2, '0')}`

// Riproduce un vocale salvato (anteprima, senza trascrivere).
export function VoicePlay({ voice }) {
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
      className="w-5 shrink-0 text-center text-xs font-bold"
    >
      {playing ? '■' : '▶'}
    </button>
  )
}

// Linguetta «note in sospeso» (matitina, bordo destro, sotto le altre di
// StatusPills.jsx): tutte le note nuove lasciate a metà, sia quelle iniziate a
// mano (lib/drafts.js) sia quelle che si stavano preparando con Gemini
// (lib/geminiDrafts.js, con testo e vocali). Ogni riga ha l'icona del tipo —
// matita = a mano, scintille = Gemini — e il giorno a cui appartiene; il tocco
// riprende la nota (a mano: pagina nota; Gemini: pannello di Gemini).
export default function DraftsTab() {
  const manual = useSyncExternalStore(subscribeDrafts, listDrafts)
  const gemini = useSyncExternalStore(subscribeGeminiDrafts, listGeminiDrafts)
  const dreams = useSyncExternalStore(subscribeDreamDrafts, listDreamDrafts)
  const { user } = useAuth()
  const navigate = useNavigate()
  const { pathname } = useLocation()
  const [voices, setVoices] = useState([])
  const [resume, setResume] = useState(null)
  const [people, setPeople] = useState([])
  const [tags, setTags] = useState([])

  useEffect(() => {
    let alive = true
    const load = async () => {
      const all = await listVoices()
      if (alive) setVoices(all)
    }
    load()
    const off = subscribeVoices(load)
    return () => {
      alive = false
      off()
    }
  }, [])

  useEffect(() => {
    if (!resume) return
    listPeople()
      .then(setPeople)
      .catch(() => setPeople([]))
    listTags()
      .then(setTags)
      .catch(() => setTags([]))
  }, [resume])

  // Mentre si sta scrivendo una nuova nota la sua bozza è quella aperta: non serve elencarla.
  const manualShown = pathname.startsWith('/note/new') ? [] : manual
  // Vocali registrati ma non ancora trascritti che non appartengono a nessuna nota in
  // sospeso (es. dettati nel pannello Gemini di una nota già aperta, poi chiuso):
  // compaiono come una voce a parte, da riprendere con un tocco.
  const geminiIds = new Set([...gemini, ...dreams].map((d) => d.id))
  const loose = voices.filter((v) => !v.transcribed && !geminiIds.has(v.draftId))
  const items = [
    ...manualShown.map((d) => ({ kind: 'manual', d })),
    ...gemini.map((d) => ({ kind: 'gemini', d })),
    ...(loose.length
      ? [{ kind: 'voices', d: { id: 'voices', savedAt: Math.max(...loose.map((v) => v.createdAt || 0)), list: loose } }]
      : []),
  ].sort((a, b) => b.d.savedAt - a.d.savedAt)

  function open(it) {
    if (it.kind === 'manual') {
      navigate(`/note/new?date=${it.d.dateKey}`, { state: { aiDraft: it.d, draftId: it.d.id } })
    } else if (it.kind === 'voices') {
      // Si trasformano in una nota Gemini in sospeso (di oggi) e si apre il pannello.
      const id = newGeminiDraftId()
      const draft = { id, dateKey: dayKey(new Date()), text: '', savedAt: Date.now() }
      saveGeminiDraft(draft)
      it.d.list.forEach((v) => updateVoice(v.id, { draftId: id }))
      setResume(draft)
    } else {
      setResume(it.d)
    }
  }

  function discard(it) {
    if (it.kind === 'manual') {
      if (window.confirm('Scartare questa bozza?')) {
        playSound('delete')
        removeDraft(it.d.id)
      }
    } else if (it.kind === 'voices') {
      if (window.confirm('Eliminare questi vocali non trascritti?')) {
        playSound('delete')
        it.d.list.forEach((v) => deleteVoice(v.id))
      }
    } else if (window.confirm('Scartare questa nota in sospeso, con i suoi vocali?')) {
      playSound('delete')
      voices.filter((v) => v.draftId === it.d.id).forEach((v) => deleteVoice(v.id))
      removeGeminiDraft(it.d.id)
    }
  }

  if (!items.length && !resume) return null

  return (
    <>
      {items.length > 0 && (
        <SideTab
          icon="edit"
          tone="paper"
          badge={items.length}
          body={
            <ul className="mx-2.5 mb-2.5 flex max-h-72 flex-col gap-1.5 overflow-y-auto">
              {items.map((it) => {
                const { d } = it
                const own =
                  it.kind === 'gemini' ? voices.filter((v) => v.draftId === d.id) : it.kind === 'voices' ? d.list : []
                return (
                  <li key={`${it.kind}-${d.id}`} className="rounded-xl border border-line bg-tag">
                    <div className="flex items-start gap-1.5 pl-2.5">
                      <Icon
                        name={it.kind === 'manual' ? 'edit' : it.kind === 'voices' ? 'mic' : 'sparkles'}
                        size={13}
                        className="mt-2 shrink-0"
                      />
                      <button type="button" onClick={() => open(it)} className="min-w-0 flex-1 py-1.5 text-left">
                        {it.kind === 'manual' ? (
                          <>
                            <span className="title-2 text-xs font-bold">{d.title.trim() || 'Senza titolo'}</span>
                            <span className="block truncate text-[11px] text-ink-soft">
                              {dayMonthLabel(d.dateKey)} · {ago(d.savedAt)}
                              {d.imageCount ? ` · ${d.imageCount} immagini da riaggiungere` : ''}
                            </span>
                          </>
                        ) : it.kind === 'voices' ? (
                          <>
                            <span className="line-clamp-3 text-xs font-bold">
                              {d.list.length === 1 ? '1 vocale da trascrivere' : `${d.list.length} vocali da trascrivere`}
                            </span>
                            <span className="block truncate text-[11px] text-ink-soft">
                              Tocca per trascriverli · {ago(d.savedAt)}
                            </span>
                          </>
                        ) : (
                          <>
                            <span className="line-clamp-3 text-xs font-bold">
                              {d.text.trim() || 'Solo vocali: tocca per trascriverli'}
                            </span>
                            <span className="block truncate text-[11px] text-ink-soft">
                              {dayMonthLabel(d.dateKey)} · {ago(d.savedAt)}
                            </span>
                          </>
                        )}
                      </button>
                      <button
                        type="button"
                        onClick={() => discard(it)}
                        title="Scarta"
                        aria-label="Scarta la nota in sospeso"
                        className="shrink-0 px-2 py-2"
                      >
                        <Icon name="trash" size={14} />
                      </button>
                    </div>
                    {own.length > 0 && (
                      <ul className="border-t border-line-soft px-2.5 py-1">
                        {own.map((v) => (
                          <li key={v.id} className="flex items-center gap-1 py-0.5 text-[11px]">
                            <VoicePlay voice={v} />
                            <span className="min-w-0 flex-1 truncate font-semibold">{v.title || 'Vocale'}</span>
                            <span className="shrink-0 text-ink-soft">{fmtLen(v.seconds || 0)}</span>
                          </li>
                        ))}
                      </ul>
                    )}
                  </li>
                )
              })}
            </ul>
          }
        >
          {items.length === 1 ? '1 nota lasciata in sospeso' : `${items.length} note lasciate in sospeso`}: tocca per
          riprenderle.
        </SideTab>
      )}
      {createPortal(
        <NewNoteWithGeminiSheet
          open={Boolean(resume)}
          draft={resume}
          dateKey={resume?.dateKey}
          onClose={() => setResume(null)}
          apiKey={user?.geminiApiKey?.trim()}
          customInstructions={noteInstructionsOf(user)}
          allPeople={people}
          allTags={tags}
          onGenerated={(draft) => navigate(`/note/new?date=${resume.dateKey}`, { state: { aiDraft: draft } })}
        />,
        document.body,
      )}
    </>
  )
}
