import { Routes, Route, Navigate } from 'react-router-dom'
import { useAuth } from './hooks/useAuth'

import LoginPage       from './pages/LoginPage'
import DashboardPage   from './pages/admin/DashboardPage'
import FacultyListPage from './pages/admin/FacultyListPage'
import FacultyDetailPage from './pages/admin/FacultyDetailPage'
import CourseListPage  from './pages/admin/CourseListPage'
import RoomsPage       from './pages/admin/RoomsPage'
import SettingsPage    from './pages/admin/SettingsPage'
import SchedulerPage   from './pages/admin/SchedulerPage'
import ScheduleViewPage from './pages/admin/ScheduleViewPage'
import AnalyticsPage   from './pages/admin/AnalyticsPage'
import FacultySchedulePage from './pages/faculty/FacultySchedulePage'
import PreferencesPage from './pages/faculty/PreferencesPage'
import AdminLayout     from './components/admin/AdminLayout'

function RequireAdmin({ children }) {
  const { user, role, loading } = useAuth()
  if (loading) return <div style={{ padding: 40 }}>Loading…</div>
  if (!user || role !== 'admin') return <Navigate to="/login" replace />
  return children
}

function RequireFaculty({ children }) {
  const { user, role, loading } = useAuth()
  if (loading) return <div style={{ padding: 40 }}>Loading…</div>
  if (!user || role !== 'faculty') return <Navigate to="/login" replace />
  return children
}

export default function App() {
  return (
    <Routes>
      <Route path="/login" element={<LoginPage />} />

      {/* Admin routes — all wrapped in AdminLayout (sidebar + topbar) */}
      <Route path="/dashboard" element={<RequireAdmin><AdminLayout /></RequireAdmin>}>
        <Route index          element={<DashboardPage />} />
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
      <Route path="/schedule" element={<RequireFaculty><FacultySchedulePage /></RequireFaculty>} />
      <Route path="/preferences" element={<RequireFaculty><PreferencesPage /></RequireFaculty>} />

      {/* Fallback */}
      <Route path="*" element={<Navigate to="/login" replace />} />
    </Routes>
  )
}
