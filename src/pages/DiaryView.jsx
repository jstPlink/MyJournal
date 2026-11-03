import { useEffect, useRef, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import PhoneShell from '../components/PhoneShell'
import MobileTopBar from '../components/MobileTopBar'
import MobileBottomBar from '../components/MobileBottomBar'
import Footer from '../components/Footer'
import ViewTabs from '../components/ViewTabs'
import YearPill from '../components/YearPill'
import WebDiary from './web/WebDiary'
import { useNav } from '../context/NavContext'
import { MONTHS_IT, addMonths, todayKey } from '../lib/dates'

// Misure di una pagina del Diario web (schermo 1920×1080): il libro si disegna
// a queste dimensioni e qui viene solo rimpicciolito, una pagina alla volta.
const PAGE_W = 601
const STAGE_H = 866

// «Diario» (telefono): la stessa identica pagina del web, in scala.
export default function DiaryView() {
  const navigate = useNavigate()
  const { cursor, setCursor } = useNav()
  const boxRef = useRef(null)
  const [fit, setFit] = useState({ scale: 0.6, top: 8 })

  useEffect(() => {
    const el = boxRef.current
    if (!el) return
    const measure = () => {
      const scale = el.clientWidth / PAGE_W
      setFit({ scale, top: Math.max(8, (el.clientHeight - STAGE_H * scale) / 2) })
    }
    measure()
    const ro = new ResizeObserver(measure)
    ro.observe(el)
    return () => ro.disconnect()
  }, [])

  return (
    <PhoneShell>
      <MobileTopBar>
        <YearPill
          skin="clock"
          year={cursor.year}
          subtitle={MONTHS_IT[cursor.month]}
          month={cursor.month}
          layout="row"
          onChange={(year) => setCursor((c) => ({ ...c, year }))}
          onMonthChange={(month) => setCursor((c) => ({ ...c, month }))}
          onYearStep={(delta) => setCursor((c) => ({ ...c, year: c.year + delta }))}
          onMonthStep={(delta) => setCursor((c) => addMonths(c, delta))}
        />
      </MobileTopBar>

      <main ref={boxRef} className="md-webdiary min-h-0 flex-1">
        <div className="md-stage" style={{ transform: `scale(${fit.scale})`, top: fit.top }}>
          <WebDiary phone />
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
