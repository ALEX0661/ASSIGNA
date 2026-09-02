import { useState, useEffect } from 'react'
import { Outlet, NavLink, useNavigate, useLocation } from 'react-router-dom'
import { useAuth } from '../../hooks/useAuth'
import logoImg from '../../assets/ASSIGNAV1.png'

/* ── Nav definition ── */
const FACULTY_NAV = [
  {
    label: 'My Portal',
    links: [
      {
        to: '/schedule',
        label: 'My Schedule',
        icon: (
          <svg className="nav-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
            <rect x="3" y="4" width="18" height="18" rx="2"/>
            <line x1="16" y1="2" x2="16" y2="6"/>
            <line x1="8" y1="2" x2="8" y2="6"/>
            <line x1="3" y1="10" x2="21" y2="10"/>
          </svg>
        ),
      },
      {
        to: '/profile',
        label: 'My Profile',
        icon: (
          <svg className="nav-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
            <path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2"/>
            <circle cx="12" cy="7" r="4"/>
          </svg>
        ),
      },
    ],
  },
]

/* ── Helpers ── */
function getInitials(email = '', displayName = '') {
  if (displayName) {
    const parts = displayName.trim().split(/\s+/)
    if (parts.length >= 2) return (parts[0][0] + parts[parts.length - 1][0]).toUpperCase()
    return displayName.slice(0, 2).toUpperCase()
  }
  return email.slice(0, 2).toUpperCase() || 'FA'
}

/* ── Logout Modal — identical to AdminLayout ── */
function LogoutModal({ onConfirm, onCancel }) {
  return (
    <div className="logout-modal-backdrop" onClick={onCancel}>
      <div className="logout-modal-box" onClick={e => e.stopPropagation()}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 14, marginBottom: 20 }}>
          <div style={{ width: 42, height: 42, borderRadius: 12, background: '#FFF0F0', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke='#EF4444' strokeWidth="2">
              <path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4"/>
              <polyline points="16 17 21 12 16 7"/>
              <line x1="21" y1="12" x2="9" y2="12"/>
            </svg>
          </div>
          <div>
            <p style={{ fontSize: 13, fontWeight: 700, color: 'var(--ink)' }}>Confirm Logout</p>
            <p style={{ fontSize: 12, color: 'var(--muted2)', marginTop: 3 }}>Are you sure you want to exit?</p>
          </div>
        </div>
        <div style={{ display: 'flex', gap: 9, justifyContent: 'flex-end' }}>
          <button onClick={onCancel} style={{ padding: '8px 18px', borderRadius: 10, border: '1.5px solid var(--border)', background: 'var(--bg)', color: 'var(--ink2)', fontSize: 12.5, fontWeight: 600, cursor: 'pointer', fontFamily: 'Inter,sans-serif' }}>
            Cancel
          </button>
          <button onClick={onConfirm} style={{ padding: '8px 18px', borderRadius: 10, border: 'none', background: 'linear-gradient(135deg,#EF4444,#C0392B)', color: '#fff', fontSize: 12.5, fontWeight: 600, cursor: 'pointer', fontFamily: 'Inter,sans-serif', boxShadow: '0 4px 14px rgba(192,57,43,0.3)' }}>
            Logout
          </button>
        </div>
      </div>
    </div>
  )
}

/* ── FacultyLayout ── */
export default function FacultyLayout() {
  const { logout, user } = useAuth()
  const navigate = useNavigate()
  const location = useLocation()

  const allLinks = FACULTY_NAV.flatMap(s => s.links)
  const activeLink = allLinks.find(l => location.pathname.startsWith(l.to))
  const currentPageLabel = activeLink?.label ?? 'Faculty Portal'

  const [showLogoutModal, setShowLogoutModal] = useState(false)
  const [isMobile, setIsMobile] = useState(() => window.innerWidth < 768)
  const [collapsed, setCollapsed] = useState(() => window.innerWidth < 768)

  useEffect(() => {
    const handleResize = () => {
      const mobile = window.innerWidth < 768
      setIsMobile(mobile)
      if (mobile) {
        setCollapsed(true)
      }
    }
    window.addEventListener('resize', handleResize)
    return () => window.removeEventListener('resize', handleResize)
  }, [])

  const initials  = getInitials(user?.email, user?.displayName)
  const shortName = user?.displayName || user?.email?.split('@')[0] || 'Faculty'
  const sidebarWidth = collapsed ? 58 : 220

  const [now, setNow] = useState(new Date())
  useEffect(() => {
    const id = setInterval(() => setNow(new Date()), 1000)
    return () => clearInterval(id)
  }, [])
  const timeStr = now.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
  const dateStr = now.toLocaleDateString([], { weekday: 'short', month: 'short', day: 'numeric' })

  async function handleLogout() { await logout(); navigate('/login') }

  return (
    <div style={{ display: 'flex', minHeight: '100vh', fontFamily: "'Inter',sans-serif" }}>

      {/* ── Sidebar — identical structure & classes to AdminLayout ── */}
      <aside style={{
        width: sidebarWidth,
        background: 'linear-gradient(180deg, var(--meadow-mid) 0%, var(--meadow-deep) 100%)',
        display: 'flex', flexDirection: 'column', flexShrink: 0,
        boxShadow: '4px 0 20px rgba(10,40,20,0.22)', zIndex: 100,
        position: isMobile ? 'absolute' : 'sticky', top: 0, left: 0, height: '100vh', overflow: 'visible',
        transition: 'width 0.25s cubic-bezier(0.4,0,0.2,1)',
      }}>

        {/* Grid texture overlay */}
        <div style={{
          position: 'absolute', inset: 0, zIndex: 0, pointerEvents: 'none', overflow: 'hidden',
          backgroundImage: 'linear-gradient(rgba(255,255,255,0.025) 1px,transparent 1px),linear-gradient(90deg,rgba(255,255,255,0.025) 1px,transparent 1px)',
          backgroundSize: '32px 32px',
        }} />

        <button
          className="sidebar-toggle"
          onClick={() => setCollapsed(c => !c)}
          title={collapsed ? 'Expand' : 'Collapse'}
        >
          <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round">
            {collapsed ? <polyline points="9 18 15 12 9 6"/> : <polyline points="15 18 9 12 15 6"/>}
          </svg>
        </button>

        <div style={{ position: 'relative', zIndex: 1, display: 'flex', flexDirection: 'column', flex: 1, overflow: 'hidden' }}>

          {/* Logo */}
          <div className="sidebar-logo-area" style={{ justifyContent: collapsed ? 'center' : 'flex-start' }}>
            <img src={logoImg} alt="Assigna" className="sidebar-logo-img" />
            {!collapsed && (
              <div>
                <span className="sidebar-logo-name">Assigna</span>
                <span className="sidebar-logo-sub">Faculty Portal</span>
              </div>
            )}
          </div>

          {/* Nav */}
          <nav style={{ flex: 1, overflowY: 'auto', overflowX: 'hidden', paddingBottom: 8, paddingTop: 4 }}>
            {FACULTY_NAV.map(section => (
              <div key={section.label}>
                {!collapsed && <div className="nav-section-label">{section.label}</div>}
                {collapsed && <div style={{ height: 10 }} />}
                {section.links.map(({ to, label, icon }) => (
                  <NavLink
                    key={to} to={to}
                    className={({ isActive }) => `sidebar-link${isActive ? ' active' : ''}`}
                    title={collapsed ? label : undefined}
                    style={{ justifyContent: collapsed ? 'center' : 'flex-start', padding: collapsed ? '9px' : '9px 14px' }}
                  >
                    {icon}
                    {!collapsed && <span className="sidebar-link-label">{label}</span>}
                  </NavLink>
                ))}
              </div>
            ))}
          </nav>

          {/* User row */}
          <div className="sidebar-user" style={{ justifyContent: collapsed ? 'center' : 'flex-start' }}>
            <div className="sidebar-avatar">{initials}</div>
            {!collapsed && (
              <>
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div className="sidebar-user-email">{shortName}</div>
                  <div className="sidebar-user-role">Faculty</div>
                </div>
                <button className="sidebar-logout-btn" onClick={() => setShowLogoutModal(true)} title="Log out">
                  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                    <path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4"/>
                    <polyline points="16 17 21 12 16 7"/>
                    <line x1="21" y1="12" x2="9" y2="12"/>
                  </svg>
                </button>
              </>
            )}
          </div>
        </div>
      </aside>

      {/* ── Overlay for mobile when expanded ── */}
      {isMobile && !collapsed && (
        <div 
          onClick={() => setCollapsed(true)}
          style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.5)', zIndex: 90, backdropFilter: 'blur(2px)' }} 
        />
      )}

      {/* ── Right panel ── */}
      <div style={{ flex: 1, minWidth: 0, display: 'flex', flexDirection: 'column', height: '100vh', background: 'var(--bg)', overflow: 'hidden', marginLeft: isMobile ? 58 : 0 }}>
        <header className="topbar" style={{ position: 'relative' }}>
          <div className="topbar-left" style={{ display: 'flex', alignItems: 'center', gap: 24, minWidth: 0 }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
              <span className="topbar-title" style={{ fontSize: 18, fontWeight: 700, color: 'var(--ink)', letterSpacing: '-.3px', fontFamily: "'Sora',sans-serif", whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                {currentPageLabel}
              </span>
              <button 
                onClick={() => window.dispatchEvent(new Event('start-tour'))}
                title="Page Tour / Help"
                style={{ 
                  display:'flex', alignItems:'center', justifyContent:'center', 
                  width: 24, height: 24, borderRadius: '50%', border: '1.5px solid var(--border)', 
                  background: 'var(--surface)', color: 'var(--muted)', cursor: 'pointer', transition: 'all .15s', flexShrink: 0,
                  fontSize: 13, fontWeight: 800, fontFamily: "'Inter',sans-serif", padding: 0, lineHeight: 1
                }}
                onMouseEnter={e => { e.currentTarget.style.background = 'var(--meadowSoft)'; e.currentTarget.style.color = 'var(--meadowDeep)' }}
                onMouseLeave={e => { e.currentTarget.style.background = 'var(--hover)'; e.currentTarget.style.color = 'var(--muted)' }}
              >
                ?
              </button>
            </div>
            <span className="topbar-badge" style={{ display: 'inline-flex', alignItems: 'center', gap: 5, padding: '3px 10px', borderRadius: 99, background: 'var(--hover)', border: '1px solid var(--border)', fontSize: 10.5, fontWeight: 700, color: 'var(--muted)', letterSpacing: '.3px', whiteSpace: 'nowrap' }}>
              <svg width="9" height="9" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"><path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2"/><circle cx="12" cy="7" r="4"/></svg>
              Faculty
            </span>
          </div>
          <div style={{ flex: 1 }} />
          <div style={{ display: 'flex', alignItems: 'center', gap: 16, marginLeft: 16 }}>
            <div className="topbar-time" style={{ display: 'flex', flexDirection: 'column', gap: 1, textAlign: 'right' }}>
              <span style={{ fontSize: 11.5, fontWeight: 700, color: 'var(--meadow-text)', fontVariantNumeric: 'tabular-nums' }}>{timeStr}</span>
              <span style={{ fontSize: 10.5, fontWeight: 500, color: 'var(--muted2)' }}>{dateStr}</span>
            </div>
            {collapsed && (
              <button className="topbar-logout" onClick={() => setShowLogoutModal(true)}
                style={{ display: 'flex', alignItems: 'center', gap: 6, padding: '6px 13px', borderRadius: 9, border: '1.5px solid var(--border)', background: 'var(--hover)', color: 'var(--muted)', fontSize: 12, fontWeight: 600, cursor: 'pointer', fontFamily: 'Inter,sans-serif' }}
                onMouseEnter={e => { e.currentTarget.style.background = '#FFF0F0'; e.currentTarget.style.color = '#EF4444' }}
                onMouseLeave={e => { e.currentTarget.style.background = 'var(--hover)'; e.currentTarget.style.color = 'var(--muted)' }}
              >
                <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                  <path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4"/>
                  <polyline points="16 17 21 12 16 7"/>
                  <line x1="21" y1="12" x2="9" y2="12"/>
                </svg>
                Logout
              </button>
            )}
          </div>
        </header>

        <main style={{ flex: 1, overflowY: 'auto', overflowX: 'hidden', display: 'flex', flexDirection: 'column' }}>
          <Outlet />
        </main>
      </div>

      {showLogoutModal && (
        <LogoutModal onConfirm={handleLogout} onCancel={() => setShowLogoutModal(false)} />
      )}
    </div>
  )
}
