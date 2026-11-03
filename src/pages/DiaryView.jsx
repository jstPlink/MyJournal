import { useEffect, useRef, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import PhoneShell from '../components/PhoneShell'
import MobileBottomBar from '../components/MobileBottomBar'
import Footer from '../components/Footer'
import ViewTabs from '../components/ViewTabs'
import WebDiary from './web/WebDiary'
import { todayKey } from '../lib/dates'

// Misure della pagina web (schermo 1920×1080): il Diario web si disegna a
// queste dimensioni e qui viene solo rimpicciolito per entrare nel telefono.
const STAGE_W = 1260
const STAGE_H = 1080

// «Diario» (telefono): la stessa identica pagina del web, in scala.
export default function DiaryView() {
  const navigate = useNavigate()
  const boxRef = useRef(null)
  const [fit, setFit] = useState({ scale: 0.3, top: 12 })

  useEffect(() => {
    const el = boxRef.current
    if (!el) return
    const measure = () => {
      const scale = el.clientWidth / STAGE_W
      setFit({ scale, top: Math.max(12, (el.clientHeight - STAGE_H * scale) / 2) })
    }
    measure()
    const ro = new ResizeObserver(measure)
    ro.observe(el)
    return () => ro.disconnect()
  }, [])

  return (
    <PhoneShell>
      <main ref={boxRef} className="md-webdiary min-h-0 flex-1">
        <div className="md-stage" style={{ transform: `scale(${fit.scale})`, top: fit.top }}>
          <WebDiary />
        </div>
      </main>

      <MobileBottomBar>
        <ViewTabs active="diary" />
        <Footer
          viewNav
          items={[
            { icon: 'settings', title: 'Opzioni', onClick: () => navigate('/profilo') },
            { icon: 'search', title: 'Filtri', onClick: () => navigate('/filtri') },
          ]}
          primaryIcon="plus"
          primaryTitle="Nuova nota (oggi)"
          onPrimary={() => navigate(`/note/new?date=${todayKey()}`)}
        />
      </MobileBottomBar>
    </PhoneShell>
  )
}
