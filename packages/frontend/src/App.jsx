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
import FacultyLayout   from './components/faculty/FacultyLayout' 

function LoadingScreen() {
  return (
    <div style={{
      display: 'flex',
      flexDirection: 'column',
      alignItems: 'center',
      justifyContent: 'center',
      height: '100vh',
      backgroundColor: '#F0EEF9', 
      color: '#1a1a2e',           
      fontFamily: "'Poppins', sans-serif" 
    }}>
      <div style={{
        width: '44px',
        height: '44px',
        border: '4px solid #D8D3F5',      // --lavender-light
        borderTop: '4px solid #7C6FCD',   // --lavender-deep
        borderRadius: '50%',
        animation: 'spin 1s linear infinite',
        marginBottom: '20px',
        boxShadow: '0 4px 14px rgba(124,111,205,0.2)' 
      }} />
      <h3 style={{ 
        fontSize: '13px',
        fontWeight: '700',
        color: '#7C6FCD', // --lavender-deep
        letterSpacing: '2px', 
        textTransform: 'uppercase', 
        margin: 0
      }}>
        Loading
      </h3>
      
      <style>
        {`
          @keyframes spin {
            0% { transform: rotate(0deg); }
            100% { transform: rotate(360deg); }
          }
        `}
      </style>
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

export default function App() {
  return (
    <Routes>
      <Route path="/login" element={<LoginPage />} />

      {/* Admin routes — all wrapped in AdminLayout (sidebar + topbar) */}
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

      {/* Faculty routes — wrapped in the new FacultyLayout */}
      <Route element={<RequireFaculty><FacultyLayout /></RequireFaculty>}>
        <Route path="/schedule"       element={<FacultySchedulePage />} />
        <Route path="/preferences"    element={<PreferencesPage />} />
      </Route>

      {/* Fallback */}
      <Route path="*" element={<Navigate to="/login" replace />} />
    </Routes>
  )
}