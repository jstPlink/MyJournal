import {
  BrowserRouter,
  Navigate,
  Route,
  Routes,
  useLocation,
} from 'react-router-dom'
import { AuthProvider } from './context/AuthContext'
import { NavProvider } from './context/NavContext'
import { useIsWide } from './hooks/useIsWide'
import RequireAuth from './components/RequireAuth'
import Sidebar from './components/web/Sidebar'
import StatusPills from './components/StatusPills'
import Toaster from './components/Toaster'
import NavStack from './components/NavStack'
import WidgetLinks from './components/WidgetLinks'
import WidgetSync from './components/WidgetSync'
import TiltPhotos from './components/TiltPhotos'
import SketchDefs from './components/SketchDefs'
import Login from './pages/Login'
import ResetPassword from './pages/ResetPassword'
import MonthView from './pages/MonthView'
import DayView from './pages/DayView'
import NoteView from './pages/NoteView'
import DreamView from './pages/DreamView'
import Profile from './pages/Profile'
import DataView from './pages/DataView'
import StatsView from './pages/StatsView'
import FilterView from './pages/FilterView'
import WebLogin from './pages/web/WebLogin'
import WebMonth from './pages/web/WebMonth'
import WebDay from './pages/web/WebDay'
import WebNote from './pages/web/WebNote'
import WebProfile from './pages/web/WebProfile'
import WebData from './pages/web/WebData'
import WebStats from './pages/web/WebStats'
import WebFilter from './pages/web/WebFilter'
import WebImport from './pages/web/WebImport'
import MoodLab from './pages/MoodLab'

// Shell desktop: barra laterale fissa + area contenuti scrollabile.
function DesktopShell({ children }) {
  const { pathname } = useLocation()
  // Nota: sfondo un filo più scuro del cream standard — altrimenti si
  // confonde col foglio della nota (stesso tono).
  const isNotePage = pathname.startsWith('/note')
  // la pagina del sogno ha un suo cielo celeste: occupa tutta l'area, senza la carta a righe dietro
  const isDream = pathname.startsWith('/dream')
  return (
    <div
      className={
        'app-paper flex h-dvh w-full overflow-hidden text-ink ' +
        (isNotePage ? 'webnote-bg' : 'bg-cream')
      }
    >
      <Sidebar />
      <main className={'min-w-0 flex-1 overflow-y-auto' + (isDream ? ' dream-main' : '')}>
        <div
          key={pathname}
          className={'anim-page ' + (isDream ? '' : 'mx-auto max-w-[1180px] px-8 py-8 xl:px-12')}
        >
          {children}
        </div>
      </main>
    </div>
  )
}

// Sceglie la variante mobile o desktop in base alla larghezza della finestra.
function Screen({ mobile: Mobile, desktop: Desktop, chrome = true }) {
  const wide = useIsWide()
  if (!wide) return <Mobile />
  return chrome ? (
    <DesktopShell>
      <Desktop />
    </DesktopShell>
  ) : (
    <Desktop />
  )
}

// Avviso per le schermate disponibili solo dalla versione web/desktop.
function WebOnlyNotice() {
  return (
    <div className="flex min-h-dvh flex-col items-center justify-center gap-3 bg-sand p-8 text-center">
      <p className="text-lg font-bold text-ink">Disponibile solo da web</p>
      <p className="max-w-xs text-sm text-ink-soft">
        L'importazione da immagine si usa dalla versione desktop/web di MyJournal.
      </p>
      <a
        href="/"
        className="rounded-full bg-ink px-5 py-2.5 text-sm font-bold text-cream"
      >
        Torna al calendario
      </a>
    </div>
  )
}

export default function App() {
  return (
    <AuthProvider>
      <NavProvider>
        <SketchDefs />
        <BrowserRouter>
          <WidgetLinks />
          <WidgetSync />
          <TiltPhotos />
          <Routes>
            <Route path="/reset-password/:token" element={<ResetPassword />} />
            <Route
              path="/login"
              element={
                <Screen mobile={Login} desktop={WebLogin} chrome={false} />
              }
            />
            <Route
              path="/"
              element={
                <RequireAuth>
                  <Screen mobile={MonthView} desktop={WebMonth} />
                </RequireAuth>
              }
            />
            <Route
              path="/mood-lab"
              element={
                <RequireAuth>
                  <Screen mobile={MoodLab} desktop={MoodLab} />
                </RequireAuth>
              }
            />
            <Route
              path="/profilo"
              element={
                <RequireAuth>
                  <Screen mobile={Profile} desktop={WebProfile} />
                </RequireAuth>
              }
            />
            <Route
              path="/dati"
              element={
                <RequireAuth>
                  <Screen mobile={DataView} desktop={WebData} />
                </RequireAuth>
              }
            />
            <Route
              path="/statistiche"
              element={
                <RequireAuth>
                  <Screen mobile={StatsView} desktop={WebStats} />
                </RequireAuth>
              }
            />
            <Route
              path="/filtri"
              element={
                <RequireAuth>
                  <Screen mobile={FilterView} desktop={WebFilter} />
                </RequireAuth>
              }
            />
            <Route
              path="/importa"
              element={
                <RequireAuth>
                  <Screen mobile={WebOnlyNotice} desktop={WebImport} />
                </RequireAuth>
              }
            />
            <Route
              path="/day/:date"
              element={
                <RequireAuth>
                  <Screen mobile={DayView} desktop={WebDay} />
                </RequireAuth>
              }
            />
            <Route
              path="/note/new"
              element={
                <RequireAuth>
                  <Screen mobile={NoteView} desktop={WebNote} />
                </RequireAuth>
              }
            />
            <Route
              path="/note/:id"
              element={
                <RequireAuth>
                  <Screen mobile={NoteView} desktop={WebNote} />
                </RequireAuth>
              }
            />
            <Route
              path="/dream/new"
              element={
                <RequireAuth>
                  <Screen mobile={DreamView} desktop={DreamView} />
                </RequireAuth>
              }
            />
            <Route
              path="/dream/:id"
              element={
                <RequireAuth>
                  <Screen mobile={DreamView} desktop={DreamView} />
                </RequireAuth>
              }
            />
            <Route path="*" element={<Navigate to="/" replace />} />
          </Routes>
          <StatusPills />
          <Toaster />
          <NavStack />
        </BrowserRouter>
      </NavProvider>
    </AuthProvider>
  )
}
