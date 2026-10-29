import { useEffect, useRef, useState } from 'react'

function pad2(n) {
  return String(n).padStart(2, '0')
}

const MINUTE_STEP = 5
const WHEEL_GAIN = 0.3 // frazione dello scorrimento normale della rotellina
const HOURS = Array.from({ length: 24 }, (_, i) => pad2(i))
const MINUTES = Array.from({ length: 60 / MINUTE_STEP }, (_, i) => pad2(i * MINUTE_STEP))

// Popover per scegliere un orario (HH:MM), stessa estetica "sveglia LCD" del
// pannello Orario: due colonne separate — ore (0-23) e minuti (multipli di
// 5) — invece di un'unica lista con tutte le combinazioni ogni 5 minuti,
// così si arriva al valore cercato con molto meno scorrimento. Scegliere da
// una colonna applica subito quella parte dell'orario senza chiudere il
// popover (serve poter toccare anche l'altra); si chiude cliccando fuori o
// con Escape, come il calendario/menu mese-anno.
export default function TimePickerPopover({
  time,
  onChange,
  className = '',
  buttonClassName = '',
  children,
  ariaLabel,
}) {
  const [open, setOpen] = useState(false)
  const ref = useRef(null)
  const hourListRef = useRef(null)
  const minuteListRef = useRef(null)

  useEffect(() => {
    if (!open) return
    const onDown = (e) => {
      if (ref.current && !ref.current.contains(e.target)) setOpen(false)
    }
    const onKey = (e) => e.key === 'Escape' && setOpen(false)
    document.addEventListener('pointerdown', onDown)
    document.addEventListener('keydown', onKey)
    return () => {
      document.removeEventListener('pointerdown', onDown)
      document.removeEventListener('keydown', onKey)
    }
  }, [open])

  const [hRaw, mRaw] = (time || '00:00').split(':').map(Number)
  const h = Number.isFinite(hRaw) ? Math.min(23, Math.max(0, hRaw)) : 0
  const m = Number.isFinite(mRaw) ? Math.min(59, Math.max(0, mRaw)) : 0
  // Un orario salvato fuori dai multipli di 5 (dato più vecchio) mostra come
  // "attivo" il minuto arrotondato più vicino, senza però riscriverlo finché
  // non si tocca qualcosa.
  const roundedMinute = Math.min(55, Math.round(m / MINUTE_STEP) * MINUTE_STEP)
  const minuteIdx = roundedMinute / MINUTE_STEP

  useEffect(() => {
    if (!open) return
    hourListRef.current?.children[h]?.scrollIntoView({ block: 'center' })
    minuteListRef.current?.children[minuteIdx]?.scrollIntoView({ block: 'center' })
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open])

  // Una tacca della rotellina del mouse sposta di poche voci, non di una
  // decina: listener non passivo per poter ridurre lo scorrimento.
  useEffect(() => {
    if (!open) return
    const lists = [hourListRef.current, minuteListRef.current].filter(Boolean)
    const onWheel = (e) => {
      if (e.ctrlKey) return
      e.preventDefault()
      e.currentTarget.scrollTop += e.deltaY * WHEEL_GAIN
    }
    lists.forEach((el) => el.addEventListener('wheel', onWheel, { passive: false }))
    return () => lists.forEach((el) => el.removeEventListener('wheel', onWheel))
  }, [open])

  return (
    <div className={'relative ' + className} ref={ref}>
      <button
        type="button"
        onClick={() => setOpen((o) => !o)}
        aria-label={ariaLabel}
        className={buttonClassName}
      >
        {children}
      </button>

      {open && (
        <div className="tp-pop">
          <div className="tp-cols">
            <div className="tp-list" ref={hourListRef}>
              {HOURS.map((hh, i) => (
                <button
                  key={hh}
                  type="button"
                  onClick={() => onChange(`${hh}:${pad2(roundedMinute)}`)}
                  className={'tp-item' + (i === h ? ' active' : '')}
                >
                  {hh}
                </button>
              ))}
            </div>
            <span className="tp-colon" aria-hidden="true">
              :
            </span>
            <div className="tp-list" ref={minuteListRef}>
              {MINUTES.map((mm, i) => (
                <button
                  key={mm}
                  type="button"
                  onClick={() => onChange(`${pad2(h)}:${mm}`)}
                  className={'tp-item' + (i === minuteIdx ? ' active' : '')}
                >
                  {mm}
                </button>
              ))}
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
