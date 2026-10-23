import { useEffect, useState, useSyncExternalStore } from 'react'
import { useLocation, useNavigate } from 'react-router-dom'
import SideTab from './SideTab'
import Icon from './Icon'
import { VoicePlay, ago, fmtLen } from './DraftsTab'
import { listDreamDrafts, removeDreamDraft, subscribeDreamDrafts } from '../lib/dreamDrafts'
import { deleteVoice, listVoices, subscribeVoices } from '../lib/voiceStore'
import { dayMonthLabel } from '../lib/dates'
import { playSound } from '../lib/sounds'

const stripTags = (html) => String(html || '').replace(/<[^>]*>/g, ' ').replace(/\s+/g, ' ').trim()

// Linguetta celeste «sogni in sospeso» (luna, bordo destro, sopra quella delle note):
// i sogni lasciati a metà (lib/dreamDrafts.js). Il tocco riapre la pagina del sogno con
// titolo, testo, nitidezza e vocali; il cestino scarta la bozza e i suoi vocali.
export default function DreamDraftsTab() {
  const drafts = useSyncExternalStore(subscribeDreamDrafts, listDreamDrafts)
  const navigate = useNavigate()
  const { pathname } = useLocation()
  const [voices, setVoices] = useState([])

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

  // mentre si scrive un sogno nuovo la sua bozza è quella aperta
  if (!drafts.length || pathname.startsWith('/dream/new')) return null

  function open(d) {
    navigate(`/dream/new?date=${d.dateKey}`, { state: { dreamDraft: d } })
  }

  function discard(d) {
    if (!window.confirm('Scartare questo sogno, con i suoi vocali?')) return
    playSound('delete')
    voices.filter((v) => v.draftId === d.id).forEach((v) => deleteVoice(v.id))
    removeDreamDraft(d.id)
  }

  return (
    <SideTab
      icon="moon"
      tone="dream"
      badge={drafts.length}
      body={
        <ul className="mx-2.5 mb-2.5 flex max-h-72 flex-col gap-1.5 overflow-y-auto">
          {drafts.map((d) => {
            const own = voices.filter((v) => v.draftId === d.id)
            const label = d.title?.trim() || stripTags(d.content).slice(0, 60) || 'Sogno senza titolo'
            return (
              <li key={d.id} className="rounded-xl border border-[#a9c4de] bg-white">
                <div className="flex items-start gap-1.5 pl-2.5">
                  <Icon name="moon" size={13} className="mt-2 shrink-0" />
                  <button type="button" onClick={() => open(d)} className="min-w-0 flex-1 py-1.5 text-left">
                    <span className="line-clamp-3 text-xs font-bold">{label}</span>
                    <span className="block truncate text-[11px] text-[#4b6f93]">
                      {dayMonthLabel(d.dateKey)} · {ago(d.savedAt)}
                    </span>
                  </button>
                  <button
                    type="button"
                    onClick={() => discard(d)}
                    title="Scarta"
                    aria-label="Scarta il sogno in sospeso"
                    className="shrink-0 px-2 py-2"
                  >
                    <Icon name="trash" size={14} />
                  </button>
                </div>
                {own.length > 0 && (
                  <ul className="border-t border-[#c6dbee] px-2.5 py-1">
                    {own.map((v) => (
                      <li key={v.id} className="flex items-center gap-1 py-0.5 text-[11px]">
                        <VoicePlay voice={v} />
                        <span className="min-w-0 flex-1 truncate font-semibold">{v.title || 'Vocale'}</span>
                        <span className="shrink-0 text-[#4b6f93]">{fmtLen(v.seconds || 0)}</span>
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
      {drafts.length === 1 ? '1 sogno lasciato in sospeso' : `${drafts.length} sogni lasciati in sospeso`}: tocca per
      riprenderlo.
    </SideTab>
  )
}
