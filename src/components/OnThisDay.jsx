import { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { pb } from '../lib/pocketbase'
import { parseWall, dayMonthLabel } from '../lib/dates'
import { plainText, displayTitle } from '../lib/notes'
import Icon from './Icon'
import { dayMood, moodColor, moodTextColor } from '../lib/mood'

const pad = (n) => String(n).padStart(2, '0')

// "In questo giorno": note scritte nella stessa data (mese-giorno) degli anni
// precedenti. Non renderizza nulla se non ce ne sono.
export default function OnThisDay({ className = '', foglietto = false, showAll = false }) {
  const navigate = useNavigate()
  const [groups, setGroups] = useState(null)
  const [open, setOpen] = useState(false)

  useEffect(() => {
    const now = new Date()
    const mm = pad(now.getMonth() + 1)
    const dd = pad(now.getDate())
    const thisYear = now.getFullYear()
    let alive = true
    pb.collection('note')
      .getFullList({
        // Il campo `date` è "YYYY-MM-DD 00:00:00.000Z": lo spazio finale evita
        // falsi positivi con la parte oraria.
        filter: pb.filter('date ~ {:md}', { md: `-${mm}-${dd} ` }),
        sort: '-date',
      })
      .then((list) => {
        if (!alive) return
        const byYear = new Map()
        for (const n of list) {
          const p = parseWall(n.date)
          if (!p || p.y >= thisYear) continue
          if (!byYear.has(p.y)) {
            byYear.set(p.y, {
              year: p.y,
              key: `${p.y}-${mm}-${dd}`,
              label: dayMonthLabel(`${p.y}-${mm}-${dd}`),
              notes: [],
            })
          }
          byYear.get(p.y).notes.push(n)
        }
        setGroups([...byYear.values()])
      })
      .catch(() => alive && setGroups([]))
    return () => {
      alive = false
    }
  }, [])

  if (!groups || groups.length === 0) return null

  const thisYear = new Date().getFullYear()
  const today = dayMonthLabel(`${thisYear}-${pad(new Date().getMonth() + 1)}-${pad(new Date().getDate())}`)

  // gli ultimi 3 anni con note (anche non consecutivi); gli altri stanno sotto un pulsante
  const head = showAll ? groups : groups.slice(0, 3)
  const rest = showAll ? [] : groups.slice(3)
  const renderCard = (g) => {
          const ago = thisYear - g.year
          const mood = dayMood(g.notes)
          const lines = g.notes.map(
            (n) => (n.title?.trim() ? displayTitle(n.title.trim()) : plainText(n.content).slice(0, 70) || 'Senza titolo'),
          )
          return (
            <button
              key={g.year}
              type="button"
              onClick={() => navigate(`/day/${g.key}`)}
              className="otd-card"
            >
              <span className="otd-year">
                <b>{g.year}</b>
                <span>
                  {ago} {ago === 1 ? 'anno' : 'anni'} fa
                </span>
              </span>
              <span className="otd-dot">
                <i />
              </span>
              <ul className="otd-notes">
                {lines.map((t, i) => (
                  <li key={i}>{t}</li>
                ))}
              </ul>
              <span
                className="otd-mood"
                style={{ backgroundColor: moodColor(mood), color: moodTextColor(mood) }}
              >
                {Math.round(mood * 100)}
              </span>
            </button>
          )
        }

  return (
    <div className={'anim-unfurl otd ' + className}>
      <span className="st-label otd-tab">
        <Icon name="calendar" size={12} />
        In questo giorno · {today.toLowerCase()}
      </span>
      <div className={'otd-list' + (rest.length ? ' has-more' : '')}>
        {head.map(renderCard)}
      </div>
      {rest.length > 0 && (
        <>
          <div className={'cx' + (open ? ' open' : '')}>
            <div className="cx-in" inert={!open}>
              <div className="otd-list otd-rest">{rest.map(renderCard)}</div>
            </div>
          </div>
          <button
            type="button"
            className={'st-more' + (open ? ' open' : '')}
            aria-expanded={open}
            onClick={() => setOpen((v) => !v)}
          >
            {open ? 'Comprimi' : `Mostra altri ${rest.length}`}
            <Icon name="chevron-right" size={12} />
          </button>
        </>
      )}
    </div>
  )
}
