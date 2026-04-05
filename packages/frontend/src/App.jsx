import { Routes, Route, Navigate } from 'react-router-dom'
import { useAuth } from './hooks/useAuth'
import LoginPage from './pages/LoginPage'
import DashboardPage from './pages/admin/DashboardPage'
import SchedulePage from './pages/faculty/SchedulePage'

function ProtectedRoute({ children, requiredRole }) {
  const { user, role, loading } = useAuth()
  if (loading) return <div>Loading...</div>
  if (!user) return <Navigate to="/login" />
  if (requiredRole && role !== requiredRole) return <Navigate to="/login" />
  return children
}

export default function App() {
  return (
    <Routes>
      <Route path="/login" element={<LoginPage />} />
      <Route path="/dashboard/*" element={
        <ProtectedRoute requiredRole="admin">
          <DashboardPage />
        </ProtectedRoute>
      } />
      <Route path="/schedule/*" element={
        <ProtectedRoute requiredRole="faculty">
          <SchedulePage />
        </ProtectedRoute>
      } />
      <Route path="*" element={<Navigate to="/login" />} />
    </Routes>
  )
}