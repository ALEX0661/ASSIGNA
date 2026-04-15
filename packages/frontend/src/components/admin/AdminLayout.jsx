import { Outlet, NavLink, useNavigate } from 'react-router-dom'
import { useAuth } from '../../hooks/useAuth'

const links = [
  { to: '/dashboard',           label: 'Dashboard' },
  { to: '/dashboard/faculty',   label: 'Faculty' },
  { to: '/dashboard/courses',   label: 'Courses' },
  { to: '/dashboard/rooms',     label: 'Rooms' },
  { to: '/dashboard/settings',  label: 'Settings' },
  { to: '/dashboard/scheduler', label: 'Scheduler' },
  { to: '/dashboard/analytics', label: 'Analytics' },
]

export default function AdminLayout() {
  const { logout } = useAuth()
  const navigate   = useNavigate()

  async function handleLogout() {
    await logout()
    navigate('/login')
  }

  return (
    <div style={{ display: 'flex', minHeight: '100vh' }}>
      {/* Sidebar */}
      <aside style={{
        width: 200, background: '#000', color: '#fff',
        display: 'flex', flexDirection: 'column',
        padding: '20px 0', flexShrink: 0,
      }}>
        <div style={{ padding: '0 20px 24px', fontSize: 18, fontWeight: 700, letterSpacing: 1 }}>
          LOGOS
        </div>
        <nav style={{ flex: 1 }}>
          {links.map(({ to, label }) => (
            <NavLink key={to} to={to} end={to === '/dashboard'}
              style={({ isActive }) => ({
                display: 'block',
                padding: '10px 20px',
                color: isActive ? '#fff' : '#aaa',
                background: isActive ? '#222' : 'transparent',
                fontSize: 13,
                borderLeft: isActive ? '3px solid #fff' : '3px solid transparent',
                transition: 'all 0.1s',
              })}
            >
              {label}
            </NavLink>
          ))}
        </nav>
        <button onClick={handleLogout}
          style={{ margin: '0 12px 12px', background: 'transparent', color: '#aaa', border: '1px solid #444' }}>
          Log out
        </button>
      </aside>

      {/* Main content */}
      <main style={{ flex: 1, overflowY: 'auto' }}>
        <Outlet />
      </main>
    </div>
  )
}
