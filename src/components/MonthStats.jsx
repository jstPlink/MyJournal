import Icon from './Icon'
import OnThisDay from './OnThisDay'
import MonthHighlights from './MonthHighlights'

// Vista mese: «In questo giorno» e le statistiche del mese dentro un'unica
// tavola in legno con l'etichetta «Statistiche». Sul web (`wide`) i blocchi
// stanno su due colonne, sul telefono uno sotto l'altro.
export default function MonthStats({ notes, year, month, people, wide = false, className = '' }) {
  return (
    <div className={'month-stats wd-card-wrap ' + className}>
      <div className="wd-header">
        <Icon name="bar-chart" size={19} />
        <h2>Statistiche</h2>
      </div>
      <div className={'wd-card ' + (wide ? 'grid items-start gap-8 lg:grid-cols-2' : 'flex flex-col gap-6')}>
        <OnThisDay showAll={wide} className="min-w-0" />
        <MonthHighlights
          notes={notes}
          year={year}
          month={month}
          people={people}
          stacked
          className="min-w-0"
        />
      </div>
    </div>
  )
}
