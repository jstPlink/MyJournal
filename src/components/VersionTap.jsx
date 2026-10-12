import { useRef } from 'react'
import { useNavigate } from 'react-router-dom'
import { toast } from '../lib/toast'

// Riga con la versione dell'app, in fondo alle Impostazioni. Toccata 5 volte di
// seguito (entro 3 secondi) apre il Mood Lab, il banco di prova della formula del mood.
// Alta il doppio di prima (40px invece di 20), carattere più grande e regular
// (peso 400), un po' più scuro: si legge e si tocca meglio.
export default function VersionTap({ className = '' }) {
  const navigate = useNavigate()
  const taps = useRef({ n: 0, t: 0 })

  function onTap() {
    const now = Date.now()
    taps.current = { n: now - taps.current.t < 3000 ? taps.current.n + 1 : 1, t: now }
    const left = 5 - taps.current.n
    if (left <= 0) {
      taps.current = { n: 0, t: 0 }
      navigate('/mood-lab')
    } else if (left <= 2) {
      toast(`Mood Lab: ancora ${left} ${left === 1 ? 'tocco' : 'tocchi'}…`, 1500)
    }
  }

  return (
    <p
      onClick={onTap}
      className={
        'flex min-h-10 select-none items-center justify-center text-center text-base font-normal text-ink/75 ' +
        className
      }
    >
      Annales · versione {__APP_VERSION__}
    </p>
  )
}
