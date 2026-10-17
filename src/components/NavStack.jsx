import { useEffect } from 'react'
import { useLocation, useNavigate } from 'react-router-dom'
import { App as CapApp } from '@capacitor/app'
import { Capacitor } from '@capacitor/core'
import { goBack, trackLocation } from '../lib/navStack'

// Tiene aggiornata la pila di navigazione (src/lib/navStack.js) e, nell'app
// Android, prende in mano il tasto/gesto «indietro»: chiude il pannello aperto,
// altrimenti sale di un livello, e dalla schermata principale esce dall'app.
export default function NavStack() {
  const { pathname, search } = useLocation()
  const navigate = useNavigate()

  trackLocation(pathname + search)

  // Cambiando pagina si toglie il fuoco al campo di testo: su telefono, se la tastiera
  // resta aperta, la pagina in cui si arriva rimane schiacciata alla sua altezza.
  useEffect(() => {
    document.activeElement?.blur?.()
  }, [pathname])

  useEffect(() => {
    if (!Capacitor.isNativePlatform()) return
    let handle
    let cancelled = false
    CapApp.addListener('backButton', () => {
      if (goBack(navigate) === 'root') CapApp.exitApp()
    }).then((h) => {
      if (cancelled) h.remove()
      else handle = h
    })
    return () => {
      cancelled = true
      handle?.remove()
    }
  }, [navigate])

  return null
}
