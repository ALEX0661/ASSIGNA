import { Routes, Route, Navigate } from 'react-router-dom'
import { useAuth } from './hooks/useAuth'
import { useSolverPolling } from './hooks/useSolverPolling'

import LoginPage        from './pages/LoginPage'
import DashboardPage    from './pages/admin/DashboardPage'
import FacultyListPage  from './pages/admin/FacultyListPage'
import FacultyDetailPage from './pages/admin/FacultyDetailPage'
import CourseListPage   from './pages/admin/CourseListPage'
import RoomsPage        from './pages/admin/RoomsPage'
import SettingsPage     from './pages/admin/SettingsPage'
import SchedulerPage    from './pages/admin/SchedulerPage'
import ScheduleViewPage from './pages/admin/ScheduleViewPage'
import AnalyticsPage    from './pages/admin/AnalyticsPage'
import FacultySchedulePage from './pages/faculty/FacultySchedulePage'
import FacultyProfilePage  from './pages/faculty/FacultyProfilePage'   // ← new unified profile
import AdminLayout      from './components/admin/AdminLayout'
import FacultyLayout    from './components/faculty/FacultyLayout'
import SolverStatusWidget from './components/SolverStatusWidget'

function LoadingScreen() {
  return (
    <div style={{
      display: 'flex', flexDirection: 'column', alignItems: 'center',
      justifyContent: 'center', height: '100vh', backgroundColor: '#F0EEF9',
      color: '#1a1a2e', fontFamily: "'Poppins', sans-serif"
    }}>
      <div style={{
        width: '44px', height: '44px',
        border: '4px solid #D8D3F5', borderTop: '4px solid #7C6FCD',
        borderRadius: '50%', animation: 'spin 1s linear infinite',
        marginBottom: '20px', boxShadow: '0 4px 14px rgba(124,111,205,0.2)'
      }} />
      <h3 style={{ fontSize: '13px', fontWeight: '700', color: '#7C6FCD', letterSpacing: '2px', textTransform: 'uppercase', margin: 0 }}>
        Loading
      </h3>
      <style>{`@keyframes spin { 0%{transform:rotate(0deg)} 100%{transform:rotate(360deg)} }`}</style>
    </div>
  )
}

function RequireAdmin({ children }) {
  const { user, role, loading } = useAuth()
  if (loading) return <LoadingScreen />
  if (!user || role !== 'admin') return <Navigate to="/login" replace />
  return children
}

function RequireFaculty({ children }) {
  const { user, role, loading } = useAuth()
  if (loading) return <LoadingScreen />
  if (!user || role !== 'faculty') return <Navigate to="/login" replace />
  return children
}

function RequireCoordinator({ children }) {
  const { user, role, isCoordinator, loading } = useAuth()
  if (loading) return <LoadingScreen />
  // Coordinators have faculty role + isCoordinator flag
  if (!user || role !== 'faculty' || !isCoordinator) return <Navigate to="/login" replace />
  return children
}

export default function App() {
  // Keeps polling the solver in the background regardless of which page is
  // mounted, so a solve started from the Scheduler page keeps progressing
  // even after navigating elsewhere.
  useSolverPolling()

  return (
    <>
      <Routes>
        <Route path="/login" element={<LoginPage />} />

        {/* Admin routes */}
        <Route path="/dashboard" element={<RequireAdmin><AdminLayout /></RequireAdmin>}>
          <Route index                  element={<DashboardPage />} />
          <Route path="faculty"         element={<FacultyListPage />} />
          <Route path="faculty/:id"     element={<FacultyDetailPage />} />
          <Route path="courses"         element={<CourseListPage />} />
          <Route path="rooms"           element={<RoomsPage />} />
          <Route path="settings"        element={<SettingsPage />} />
          <Route path="scheduler"       element={<SchedulerPage />} />
          <Route path="schedule/:name"  element={<ScheduleViewPage />} />
          <Route path="schedule"        element={<ScheduleViewPage />} />
          <Route path="analytics"       element={<AnalyticsPage />} />
        </Route>

        {/* Faculty routes */}
        <Route element={<RequireFaculty><FacultyLayout /></RequireFaculty>}>
          <Route path="/schedule"    element={<FacultySchedulePage />} />
          <Route path="/profile"     element={<FacultyProfilePage />} />   {/* ← replaces /preferences */}
        </Route>

        {/* Coordinator routes - placeholder for now, uses admin layout */}
        <Route path="/coordinator" element={<RequireCoordinator><AdminLayout /></RequireCoordinator>}>
          <Route index element={<DashboardPage />} />
          <Route path="faculty"         element={<FacultyListPage />} />
          <Route path="faculty/:id"     element={<FacultyDetailPage />} />
          <Route path="courses"         element={<CourseListPage />} />
          <Route path="rooms"           element={<RoomsPage />} />
          <Route path="settings"        element={<SettingsPage />} />
          <Route path="scheduler"       element={<SchedulerPage />} />
          <Route path="schedule/:name"  element={<ScheduleViewPage />} />
          <Route path="schedule"        element={<ScheduleViewPage />} />
          <Route path="analytics"       element={<AnalyticsPage />} />
        </Route>

        <Route path="*" element={<Navigate to="/login" replace />} />
      </Routes>

      {/* Persists across every route — shows solve progress no matter where
          the user navigates to while a schedule is being generated. */}
      <SolverStatusWidget />
    </>
  )
}