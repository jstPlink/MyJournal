import { useEffect, useLayoutEffect, useMemo, useRef, useState } from 'react'
import RichText from '../RichText'
import TitleInput from '../TitleInput'
import PersonAvatar from '../PersonAvatar'
import Icon from '../Icon'
import { moodColor } from '../../lib/mood'
import { parsePlace } from '../../lib/notes'
import { osmTileFor, personTapeColor, tilt } from '../../lib/pagesSkin'
import { MONTHS_IT, isWeekend, parseWall, weekdayLong } from '../../lib/dates'

// Foglio della nota: gli stessi fogli A4 della vista diario (stessa proporzione,
// stessi margini, stesse righe da 27px, stessi disegni), uno sotto l'altro. Si
// scrive su un unico testo che scorre da un foglio al successivo: fra un
// foglio e l'altro il testo salta la «zona vuota» (margine in basso del foglio,
// spazio fra i fogli, fascia in alto del foglio dopo) grazie a due float per
// foglio (vedi `.nb-sp` e `.nb-zone` in index.css).
const ROW = 27
const BAND = 72 // fascia vuota in cima (giorno, mese)
const TEXT_TOP = BAND + 28 // dove parte il testo nel foglio
const PAGE_GAP = 24
const RATIO = 1.4142

const FONT_SIZES = [
  { id: 0, label: 'Piccolo', rem: 0.8 },
  { id: 1, label: 'Medio', rem: 0.89 },
  { id: 2, label: 'Grande', rem: 0.98 },
]
const FONTS = [
  { id: 0, label: 'Kalam', css: "'MyJournal Hand', 'Kalam', sans-serif", k: 1 },
  { id: 1, label: 'Caveat', css: "'MyJournal Marker', 'Caveat', cursive", k: 1.22 },
  { id: 2, label: 'Gochi', css: "'MyJournal Hand Gochi', 'Gochi Hand', cursive", k: 1.04 },
]

function readPrefs() {
  try {
    const v = JSON.parse(localStorage.getItem('myjournal.noteFont') || '{}')
    return { fs: FONT_SIZES.some((x) => x.id === v.fs) ? v.fs : 1, ff: FONTS.some((x) => x.id === v.ff) ? v.ff : 0 }
  } catch {
    return { fs: 1, ff: 0 }
  }
}

// Preferenze di carattere del foglio (dimensione e stile), salvate nel browser.
export function useNoteFontPrefs() {
  const [prefs, setPrefs] = useState(readPrefs)
  const setPref = (patch) =>
    setPrefs((old) => {
      const next = { ...old, ...patch }
      try {
        localStorage.setItem('myjournal.noteFont', JSON.stringify(next))
      } catch {
        /* nessuna memoria locale */
      }
      return next
    })
  return [prefs, setPref]
}

// Tasti per scegliere dimensione e stile (stanno nella colonna di sinistra).
export function NoteFontTools({ prefs, setPref }) {
  return (
    <div className="nb-tools" role="group" aria-label="Carattere del foglio">
      <span className="nb-tools-group" aria-label="Dimensione">
        {FONT_SIZES.map((s) => (
          <button
            key={s.id}
            type="button"
            className={prefs.fs === s.id ? 'on' : ''}
            title={`Carattere ${s.label.toLowerCase()}`}
            aria-pressed={prefs.fs === s.id}
            onClick={() => setPref({ fs: s.id })}
            style={{ fontSize: `${0.8 + s.id * 0.18}rem` }}
          >
            A
          </button>
        ))}
      </span>
      <span className="nb-tools-group" aria-label="Stile">
        {FONTS.map((f) => (
          <button
            key={f.id}
            type="button"
            className={prefs.ff === f.id ? 'on' : ''}
            title={`Stile ${f.label}`}
            aria-pressed={prefs.ff === f.id}
            onClick={() => setPref({ ff: f.id })}
            style={{ fontFamily: f.css }}
          >
            Aa
          </button>
        ))}
      </span>
    </div>
  )
}

// Colonna «da album»: foto, luogo e canzone della nota in modifica.
function PreviewAside({ imageUrls, place, songs, seed, maxH }) {
  const song = songs?.[0] || null
  const name = place?.name?.trim() || ''
  let map = null
  if (name && Number.isFinite(Number(place?.lat)) && Number.isFinite(Number(place?.lon))) {
    map = osmTileFor(Number(place.lat), Number(place.lon), 14)
  }
  const imgs = (imageUrls || []).filter(Boolean).slice(0, 3)
  if (!imgs.length && !name && !song) return null
  return (
    <span className="dg-aside nb-aside" style={{ maxHeight: maxH }}>
      {imgs.length > 0 && (
        <span className="dg-photos">
          {imgs.map((u, i) => (
            <span
              key={u}
              className="dn-pola"
              style={{ '--pr': `${tilt(`${seed}p${i}`, 4).toFixed(2)}deg`, '--dx': `${i % 2 ? 16 : -12}px` }}
            >
              <span className="dn-ph" style={{ backgroundImage: `url(${u})` }} />
            </span>
          ))}
        </span>
      )}
      {(name || song) && (
        <span className="dn-media">
          {name && (
            <span className="dg-stampwrap">
              <span className="dn-place">
                <span
                  className={'dn-map' + (map ? ' real' : '')}
                  style={map ? { '--map-url': `url(${map.url})`, '--map-pos': map.pos } : undefined}
                />
                <span className="dn-place-name">{name}</span>
              </span>
            </span>
          )}
          {song && (
            <span className="dn-disc-wrap">
              <span
                className="dn-disc"
                style={song.thumbnailUrl ? { '--cover': `url(${song.thumbnailUrl})` } : undefined}
              />
              {(song.title || song.artist) && (
                <span className="dn-song">
                  {song.title && <span className="t">{song.title}</span>}
                  {song.artist && <span className="a">{song.artist}</span>}
                </span>
              )}
            </span>
          )}
        </span>
      )}
    </span>
  )
}

export default function NoteBook({
  form,
  set,
  editorRef,
  imageUrls,
  seed = 'new',
  people = [],
  tags = [],
  onRemovePerson,
  onRemoveTag,
  prefs,
  immichUrl,
  immichApiKey,
}) {
  const wrap = useRef(null)
  const flow = useRef(null)
  const editorBox = useRef(null)
  const tapesBox = useRef(null)
  const [avail, setAvail] = useState({ w: 700, vh: typeof window !== 'undefined' ? window.innerHeight : 900 })
  const [pages, setPages] = useState(1)

  // dimensioni dei fogli: come nel diario (altezza dalla finestra, proporzione A4)
  useEffect(() => {
    const el = wrap.current
    const upd = () => setAvail({ w: el ? el.clientWidth : 700, vh: window.innerHeight })
    upd()
    const ro = new ResizeObserver(upd)
    if (el) ro.observe(el)
    window.addEventListener('resize', upd)
    return () => {
      ro.disconnect()
      window.removeEventListener('resize', upd)
    }
  }, [])

  const geo = useMemo(() => {
    let h = Math.max(520, avail.vh - 230)
    let w = Math.round(h / RATIO)
    if (w > avail.w) {
      w = Math.max(320, Math.floor(avail.w))
      h = Math.round(w * RATIO)
    }
    // altezza utile del testo in un foglio: righe intere, come `cap` del diario
    const textH = Math.max(ROW * 4, Math.floor((h - BAND - 34 - 1 - ROW - 10 - 14) / ROW) * ROW)
    return { w, h, textH, textW: w - 92, stride: h + PAGE_GAP }
  }, [avail])

  // quanti fogli servono: il testo non deve finire nella zona vuota
  useLayoutEffect(() => {
    const flowEl = flow.current
    if (!flowEl) return
    const count = () => {
      const ed = editorBox.current
      const tp = tapesBox.current
      let bottom = ed ? ed.offsetTop + ed.offsetHeight : 0
      if (tp && tp.offsetHeight) bottom = Math.max(bottom, tp.offsetTop + tp.offsetHeight)
      const n = bottom <= geo.textH ? 1 : 1 + Math.ceil((bottom - geo.textH) / geo.stride)
      setPages((old) => (old === n ? old : n))
    }
    count()
    const ro = new ResizeObserver(count)
    if (editorBox.current) ro.observe(editorBox.current)
    if (tapesBox.current) ro.observe(tapesBox.current)
    ro.observe(flowEl)
    document.fonts?.ready.then(count)
    return () => ro.disconnect()
  }, [geo, prefs, form.content, form.title, people.length, tags.length, imageUrls?.length, form.place, form.songs])

  const p = parseWall(form.dateKey)
  const wknd = form.dateKey ? isWeekend(form.dateKey) : false
  const mood = Math.round(Number(form.mood) * 100)
  const time = (form.timeStart || '').replace(':', '.')
  const place = typeof form.place === 'string' ? parsePlace(form.place) : form.place
  const font = FONTS.find((f) => f.id === prefs.ff) || FONTS[0]
  const size = FONT_SIZES.find((s) => s.id === prefs.fs) || FONT_SIZES[1]
  const fontRem = (size.rem * font.k).toFixed(3)
  const monthLabel = p ? `${MONTHS_IT[p.mo - 1]} ${p.y}` : ''

  return (
    <div className="nb-wrap" ref={wrap} style={{ '--nm': moodColor(form.mood) }}>
      <div className="nb-stack" style={{ width: geo.w, height: pages * geo.stride - PAGE_GAP }}>
        {Array.from({ length: pages }, (_, i) => (
          <section
            key={i}
            className={'dg-page l nb-page' + (wknd ? ' wknd' : '')}
            style={{ width: geo.w, height: geo.h, top: i * geo.stride }}
          >
            <span className="dg-margin" aria-hidden="true" />
            <div className="dg-band">
              <span className="dg-month">{monthLabel}</span>
              {i === 0 && p && (
                <span className="dg-day">
                  <b>{p.d}</b>
                  <span>{weekdayLong(form.dateKey)}</span>
                </span>
              )}
            </div>
            <div className="dg-scroll" />
            <span className="dg-pn">pagina {i + 1}</span>
          </section>
        ))}

        <div
          className="nb-flow"
          ref={flow}
          style={{ left: 58, top: TEXT_TOP, width: geo.textW, '--nb-fs': `${fontRem}rem`, '--nb-ff': font.css }}
        >
          {/* colonna foto/luogo/canzone: il testo le scorre attorno */}
          <PreviewAside imageUrls={imageUrls} place={place} songs={form.songs} seed={seed} maxH={geo.textH - 70} />
          {/* zone vuote fra un foglio e l'altro: uno spaziatore (altezza del testo) e
              un blocco pieno per ogni passaggio di foglio */}
          {Array.from({ length: pages }, (_, i) => (
            <span key={`sp${i}`} className="nb-sp" style={{ height: geo.textH }} />
          )).flatMap((sp, i) =>
            i < pages - 1
              ? [sp, <span key={`z${i}`} className="nb-zone" style={{ height: geo.stride - geo.textH }} />]
              : [],
          )}

          <div className="nb-titlerow">
            <span className="dg-tcard nb-tcard">
              <span className="dg-time">{time}</span>
              <span className="dg-dash" aria-hidden="true">
                –
              </span>
              <TitleInput
                placeholder="Titolo della nota"
                value={form.title}
                onChange={(title) => set({ title })}
                className="nb-title-in"
              />
            </span>
            <span className="dg-nmood" title="Mood della nota">
              <span className="dg-nmood-in">
                <em>mood</em>
                <b>{mood}</b>
              </span>
            </span>
          </div>

          <div ref={editorBox} className="nb-editor-box">
            <RichText
              ref={editorRef}
              value={form.content}
              onChange={(html) => set({ content: html })}
              placeholder="Scrivi qui la nota…"
              className="nb-editor"
            />
          </div>

          {(people.length > 0 || tags.length > 0) && (
            <div ref={tapesBox} className="nb-tapes">
              {people.length > 0 && (
                <span className="dn-tapes dg-tapesrow">
                  {people.map((pe) => (
                    <span key={pe.id} className="dn-tape" style={{ '--tape-c': personTapeColor(pe) }}>
                      <PersonAvatar person={pe} immichUrl={immichUrl} immichApiKey={immichApiKey} size={18} />
                      <span className="dn-tape-name">{pe.name}</span>
                      <button type="button" className="nb-x" title="Rimuovi" onClick={() => onRemovePerson?.(pe.id)}>
                        <Icon name="x" size={10} />
                      </button>
                    </span>
                  ))}
                </span>
              )}
              {tags.length > 0 && (
                <span className="dn-tapes dg-tapesrow">
                  {tags.map((t) => (
                    <span key={t.id} className="dn-tag">
                      #{t.name}
                      <button type="button" className="nb-x" title="Rimuovi" onClick={() => onRemoveTag?.(t.id)}>
                        <Icon name="x" size={10} />
                      </button>
                    </span>
                  ))}
                </span>
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
