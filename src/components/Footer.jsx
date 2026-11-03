import { useState } from 'react'
import { useLocation, useNavigate } from 'react-router-dom'
import Icon from './Icon'
import { useAuth } from '../context/AuthContext'
import { fileUrl } from '../lib/pocketbase'
import { haptic } from '../lib/haptics'

// Pulsante circolare generico del footer, stile "cartoncino chiaro" — usato
// per le voci di `items` che non hanno un materiale dedicato (profilo,
// cerca: vedi sotto).
function PaperCircle({ icon, onClick, title, active }) {
  return (
    <button
      type="button"
      onClick={
        onClick
          ? (e) => {
              haptic()
              onClick(e)
            }
          : undefined
      }
      title={title}
      aria-label={title}
      className={'mcircle mcircle-paper' + (active ? ' active' : '')}
    >
      <Icon name={icon} size={20} />
    </button>
  )
}

// "Opzioni" (→ Profilo): la stessa tessera fotografica della barra
// laterale web, in formato circolare compatto.
function ProfileCircle({ onClick, title }) {
  const { user } = useAuth()
  const avatarUrl = user?.avatar ? fileUrl(user, user.avatar, { thumb: '96x96' }) : ''
  const initial = (user?.name?.trim() || user?.email || '?').charAt(0).toUpperCase()
  return (
    <button
      type="button"
      onClick={
        onClick
          ? (e) => {
              haptic()
              onClick(e)
            }
          : undefined
      }
      title={title}
      aria-label={title}
      className="mcircle mid-btn"
    >
      {avatarUrl ? <img src={avatarUrl} alt="" /> : <span className="mid-photo">{initial}</span>}
    </button>
  )
}

// "Filtri" (→ ricerca): lente d'ingrandimento in ottone, senza manico,
// icona al centro del vetro — stesso materiale della barra laterale web.
function SearchCircle({ onClick, title, active }) {
  return (
    <button
      type="button"
      onClick={
        onClick
          ? (e) => {
              haptic()
              onClick(e)
            }
          : undefined
      }
      title={title}
      aria-label={title}
      className={'mcircle msearch-btn' + (active ? ' active' : '')}
    >
      <Icon name="search" size={18} strokeWidth={2.6} />
    </button>
  )
}

// Footer con pulsanti circolari, in 3 colonne fisse così l'azione
// principale resta sempre centrata in basso: a sinistra "cerca" e le altre
// voci opzionali (meno frequenti), a destra "profilo" (più comodo da
// raggiungere col pollice), al centro il pulsante "nuova nota". Le voci
// non passate non occupano spazio (nessun placeholder). "settings" e
// "search" hanno un materiale dedicato (tessera/lente); le altre restano
// un ritaglio di carta generico.
export default function Footer({ items = [], onPrimary, primaryIcon = 'plus', primaryTitle, viewNav = false }) {
  const navigate = useNavigate()
  const { pathname } = useLocation()
  // viewNav: Statistiche a sinistra e Diario a destra del pulsante «nuova nota»
  const visible = [
    ...items.filter(Boolean),
    ...(viewNav
      ? [
          { icon: 'bar-chart', title: 'Statistiche', active: pathname === '/statistiche', onClick: () => navigate('/statistiche') },
          { icon: 'book', title: 'Diario', side: 'right', active: pathname === '/diario', onClick: () => navigate('/diario') },
        ]
      : []),
  ]
  const left = visible.filter((it) => it.icon !== 'settings' && it.side !== 'right')
  const right = [
    ...visible.filter((it) => it.side === 'right'),
    ...visible.filter((it) => it.icon === 'settings'),
  ]
  const [popPrimary, setPopPrimary] = useState(false)

  function renderCircle(it, i) {
    return it.icon === 'settings' ? (
      <ProfileCircle key={it.title ?? i} onClick={it.onClick} title={it.title} />
    ) : it.icon === 'search' ? (
      <SearchCircle key={it.title ?? i} onClick={it.onClick} title={it.title} active={it.active} />
    ) : (
      <PaperCircle
        key={it.title ?? i}
        icon={it.icon}
        onClick={it.onClick}
        title={it.title}
        active={it.active}
      />
    )
  }

  return (
    <div className={'mnav-footer' + (viewNav ? ' five' : '')}>
      <div className="mnav-footer-side left">{left.map(renderCircle)}</div>
      <button
        type="button"
        onClick={
          onPrimary
            ? () => {
                haptic()
                setPopPrimary(false)
                requestAnimationFrame(() => setPopPrimary(true))
                onPrimary()
              }
            : undefined
        }
        onAnimationEnd={() => setPopPrimary(false)}
        title={primaryTitle}
        aria-label={primaryTitle}
        className={'mcircle mfab' + (popPrimary ? ' anim-pop' : '')}
      >
        <Icon name={primaryIcon} size={24} />
      </button>
      <div className="mnav-footer-side right">{right.map(renderCircle)}</div>
    </div>
  )
}
