import Icon from './Icon'

// Segnalino del sogno: una piccola nuvoletta (corpo + due gobbe) col contorno celeste e la luna
// dentro. Si usa nel Calendario (accanto al nome del giorno) e nella vista Giorno (sull'asse
// delle ore). La misura si decide con `--w` / `--h` del contenitore; lo spessore del contorno
// è `--dream-outline`, lo stesso della nuvoletta col titolo.
export default function DreamBadge({ iconSize = 14, className = '' }) {
  return (
    <span className={'dream-badge ' + className} aria-hidden="true">
      <span className="db-shape">
        <i className="base" />
        <i className="c1" />
        <i className="c2" />
      </span>
      <Icon name="moon" size={iconSize} strokeWidth={2.4} className="db-moon" />
    </span>
  )
}
