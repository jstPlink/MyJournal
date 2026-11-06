import { useMemo } from 'react'
import { useNavigate } from 'react-router-dom'
import { useAuth } from '../context/AuthContext'
import Icon from './Icon'
import PersonAvatar from './PersonAvatar'
import { DayRow, NoteRow } from './web/StatsBody'
import { computeYearStats } from '../lib/stats'
import { parseWall } from '../lib/dates'

// Vista mese: giorno migliore, nota migliore e le 5 persone più presenti del
// mese, con gli stessi blocchi delle statistiche (Anno / Di sempre).
// `notes` può contenere anche giorni dei mesi vicini (griglia a 6 settimane):
// qui si contano solo quelli del mese `year`/`month` (month 0-11).
export default function MonthHighlights({ notes, year, month, people = [], stacked = false, className = '' }) {
  const navigate = useNavigate()
  const { user } = useAuth()
  const immichUrl = user?.immichUrl?.trim()
  const immichApiKey = user?.immichApiKey?.trim()

  const stats = useMemo(() => {
    const inMonth = notes.filter((n) => {
      const p = parseWall(n.date)
      return p && p.y === year && p.mo - 1 === month
    })
    return computeYearStats(inMonth, { allPeople: people, peopleLimit: 5 })
  }, [notes, year, month, people])

  const day = stats.topDays[0]
  const note = stats.topNotes[0]
  const topPeople = stats.topPeople
  if (!day && !note && topPeople.length === 0) return null

  return (
    <div className={'month-hl ' + (stacked ? 'flex flex-col gap-6 ' : 'grid items-start gap-6 lg:grid-cols-3 ') + className}>
      {day && (
        <section>
          <span className="st-label">
            <Icon name="sparkles" size={12} />
            Giorno migliore
          </span>
          <div className="st-rows">
            <DayRow day={day} onClick={() => navigate(`/day/${day.key}`)} />
          </div>
        </section>
      )}
      {note && (
        <section>
          <span className="st-label">
            <Icon name="heart" size={12} />
            Nota migliore
          </span>
          <div className="st-rows">
            <NoteRow note={note} onClick={() => navigate(`/note/${note.id}`)} />
          </div>
        </section>
      )}
      {topPeople.length > 0 && (
        <section>
          <span className="st-label">
            <Icon name="user" size={12} />
            Persone più presenti
          </span>
          <ol className="st-people">
            {topPeople.map((p, i) => (
              <li key={p.id} className="st-person-row">
                <span className="st-rank">{i + 1}</span>
                <PersonAvatar
                  person={p.person || { name: p.name }}
                  immichUrl={immichUrl}
                  immichApiKey={immichApiKey}
                  size={28}
                />
                <span className="st-person-name">{p.name}</span>
                <span className="st-person-count">
                  {p.count} {p.count === 1 ? 'nota' : 'note'}
                </span>
              </li>
            ))}
          </ol>
        </section>
      )}
    </div>
  )
}
