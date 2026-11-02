import { useNavigate } from 'react-router-dom'
import PhoneShell from '../components/PhoneShell'
import MobileTopBar from '../components/MobileTopBar'
import MobileBottomBar from '../components/MobileBottomBar'
import Footer from '../components/Footer'
import ViewTabs from '../components/ViewTabs'
import { todayKey } from '../lib/dates'

// «Vista diario»: pagina vuota, l'estetica vera arriva dopo.
export default function DiaryView() {
  const navigate = useNavigate()
  return (
    <PhoneShell>
      <MobileTopBar>
        <h1
          className="text-center text-ink"
          style={{ fontFamily: "'MyJournal Marker', 'Caveat', cursive", fontSize: '1.7rem' }}
        >
          Vista diario
        </h1>
      </MobileTopBar>

      <main className="anim-page flex-1 overflow-y-auto no-scrollbar px-4 py-4" />

      <MobileBottomBar>
        <ViewTabs active="diary" />
        <Footer
          items={[
            {
              icon: 'settings',
              title: 'Opzioni',
              onClick: () => navigate('/profilo'),
            },
            {
              icon: 'search',
              title: 'Filtri',
              onClick: () => navigate('/filtri'),
            },
          ]}
          primaryIcon="plus"
          primaryTitle="Nuova nota (oggi)"
          onPrimary={() => navigate(`/note/new?date=${todayKey()}`)}
        />
      </MobileBottomBar>
    </PhoneShell>
  )
}
