import { useState, useEffect, useCallback } from 'react'
import { Outlet, NavLink, useNavigate, useLocation } from 'react-router-dom'
import { useAuth } from '../../hooks/useAuth'
import { useCoordSolverPolling } from '../../hooks/useCoordSolverPolling'
import CoordSolverStatusWidget from '../CoordSolverStatusWidget'
import icon1Img from '../../assets/ASSIGNAV1.png'

/* Coordinator-only addition: a minimal text subtitle shown under the logo.
   Kept clean and themed with the same meadow-green tokens as the rest
   of the app. */
const COORD_PILL_STYLE = `
  .sidebar-logo-pill {
    display: block;
    color: #A7D3B8;
    font-size: 10.5px;
    font-weight: 600;
    letter-spacing: 1.2px;
    text-transform: uppercase;
    margin-top: 2px;
    font-family: 'Inter', sans-serif;
    opacity: 0.9;
  }
`

const NAV_SECTIONS = [
  {
    label: 'Overview',
    links: [
      { to: '/coordinator', label: 'Dashboard',
        icon: <svg className="nav-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><rect x="3" y="3" width="7" height="7" rx="1.5"/><rect x="14" y="3" width="7" height="7" rx="1.5"/><rect x="3" y="14" width="7" height="7" rx="1.5"/><rect x="14" y="14" width="7" height="7" rx="1.5"/></svg> },
    ],
  },
  {
    label: 'Setup',
    links: [
      { to: '/coordinator/courses', label: 'Courses',
        icon: <svg className="nav-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M4 19.5A2.5 2.5 0 0 1 6.5 17H20"/><path d="M6.5 2H20v20H6.5A2.5 2.5 0 0 1 4 19.5v-15A2.5 2.5 0 0 1 6.5 2z"/></svg> },
      { to: '/coordinator/rooms', label: 'Rooms',
        icon: <svg className="nav-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M3 9l9-7 9 7v11a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z"/><polyline points="9 22 9 12 15 12 15 22"/></svg> },
    ],
  },
  {
    label: 'Schedule',
    links: [
      { to: '/coordinator/scheduler', label: 'Scheduler',
        icon: <svg className="nav-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><rect x="3" y="4" width="18" height="18" rx="2"/><line x1="16" y1="2" x2="16" y2="6"/><line x1="8" y1="2" x2="8" y2="6"/><line x1="3" y1="10" x2="21" y2="10"/></svg> },
      { to: '/coordinator/schedules', label: 'My Schedules',
        icon: <svg className="nav-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><line x1="8" y1="6" x2="21" y2="6"/><line x1="8" y1="12" x2="21" y2="12"/><line x1="8" y1="18" x2="21" y2="18"/><line x1="3" y1="6" x2="3.01" y2="6"/><line x1="3" y1="12" x2="3.01" y2="12"/><line x1="3" y1="18" x2="3.01" y2="18"/></svg> },
    ],
  },
]

function useToast() {
  const [toasts, setToasts] = useState([])
  const toast = useCallback((message, type = 'info', dur = 3000) => {
    const id = Date.now() + Math.random()
    setToasts(p => [...p, { id, message, type }])
    setTimeout(() => setToasts(p => p.filter(t => t.id !== id)), dur)
  }, [])
  return { toasts, toast }
}

function CoordToastContainer({ toasts }) {
  return (
    <div style={{ position:'fixed', bottom:24, left:'50%', transform:'translateX(-50%)', zIndex:9999, display:'flex', flexDirection:'column', gap:10, alignItems:'center', pointerEvents:'none' }}>
      {toasts.map(t => (
        <div key={t.id} style={{
          display:'flex', alignItems:'center', gap:10, padding:'12px 20px', borderRadius:12,
          fontFamily:'Inter,sans-serif', fontSize:13, fontWeight:600, whiteSpace:'nowrap',
          boxShadow:'0 8px 24px rgba(10,46,28,0.15)', pointerEvents:'auto',
          background: t.type === 'success' ? '#15803D' : '#fff',
          color: t.type === 'success' ? '#fff' : t.type === 'error' ? '#DC2626' : '#0F5C2C',
          border: t.type === 'success' ? '1px solid #0F5C2C' : t.type === 'error' ? '1px solid #FECACA' : '1px solid #BBF7D0',
        }}>
          {t.message}
        </div>
      ))}
    </div>
  )
}

function LogoutModal({ onConfirm, onCancel }) {
  return (
    <div className="logout-modal-backdrop" onClick={onCancel}>
      <div className="logout-modal-box" onClick={e => e.stopPropagation()}>
        <div style={{ display:'flex', alignItems:'center', gap:14, marginBottom:20 }}>
          <div style={{ width:42, height:42, borderRadius:12, background:'#FFF0F0', display:'flex', alignItems:'center', justifyContent:'center', flexShrink:0 }}>
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="#C0392B" strokeWidth="2">
              <path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4"/>
              <polyline points="16 17 21 12 16 7"/><line x1="21" y1="12" x2="9" y2="12"/>
            </svg>
          </div>
          <div>
            <p style={{ fontSize:14, fontWeight:700, color:'#0E2A20' }}>Confirm Logout</p>
            <p style={{ fontSize:12, color:'#6B8C7A', marginTop:3 }}>Are you sure you want to exit?</p>
          </div>
        </div>
        <div style={{ display:'flex', gap:9, justifyContent:'flex-end' }}>
          <button onClick={onCancel} style={{ padding:'8px 18px', borderRadius:10, border:'1.5px solid #D8E8DF', background:'#F2F7F4', color:'#1C3D2A', fontSize:12.5, fontWeight:600, cursor:'pointer', fontFamily:'Inter,sans-serif' }}>
            Cancel
          </button>
          <button onClick={onConfirm} style={{ padding:'8px 18px', borderRadius:10, border:'none', background:'linear-gradient(135deg,#EF4444,#C0392B)', color:'#fff', fontSize:12.5, fontWeight:600, cursor:'pointer', fontFamily:'Inter,sans-serif', boxShadow:'0 4px 14px rgba(192,57,43,0.3)' }}>
            Logout
          </button>
        </div>
      </div>
    </div>
  )
}

export default function CoordinatorLayout() {
  const { logout, user, coordinatorProgram } = useAuth()
  const navigate = useNavigate()
  const location = useLocation()
  const { toasts, toast } = useToast()

  // Polls the coordinator's solve regardless of which coordinator page is
  // currently mounted, so the floating pill stays accurate and a Stop click
  // on any page actually reaches the running solve.
  useCoordSolverPolling(toast)

  const allLinks = NAV_SECTIONS.flatMap(s => s.links)
  const activeLink = allLinks.find(l =>
    l.to === '/coordinator'
      ? location.pathname === '/coordinator'
      : location.pathname.startsWith(l.to)
  )
  const currentPageLabel = activeLink?.label ?? 'Dashboard'
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

  const [now, setNow] = useState(new Date())
  useEffect(() => {
    const id = setInterval(() => setNow(new Date()), 1000)
    return () => clearInterval(id)
  }, [])
  const timeStr = now.toLocaleTimeString([], { hour:'2-digit', minute:'2-digit' })
  const dateStr = now.toLocaleDateString([], { weekday:'short', month:'short', day:'numeric' })

  async function handleLogout() { await logout(); navigate('/login') }

  const initials = user?.email ? user.email.slice(0, 2).toUpperCase() : 'CO'
  const sidebarWidth = collapsed ? 58 : 220

  return (
    <div style={{ display:'flex', minHeight:'100vh', fontFamily:"'Inter',sans-serif" }}>
      <style>{COORD_PILL_STYLE}</style>

      {/* ── Sidebar ── */}
      <aside style={{
        width: sidebarWidth,
        background: 'linear-gradient(180deg, #1A5C35 0%, #154D2C 60%, #0F3D22 100%)',
        display:'flex', flexDirection:'column', flexShrink:0,
        boxShadow:'4px 0 20px rgba(10,40,20,0.22)', zIndex:100,
        position: isMobile ? 'absolute' : 'sticky', top:0, left:0, height:'100vh', overflow:'visible',
        transition:'width 0.25s cubic-bezier(0.4,0,0.2,1)',
      }}>

        {/* subtle texture */}
        <div style={{
          position:'absolute', inset:0, zIndex:0, pointerEvents:'none', overflow:'hidden',
          backgroundImage:'linear-gradient(rgba(255,255,255,0.025) 1px,transparent 1px),linear-gradient(90deg,rgba(255,255,255,0.025) 1px,transparent 1px)',
          backgroundSize:'32px 32px',
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

        <div style={{ position:'relative', zIndex:1, display:'flex', flexDirection:'column', flex:1, overflow:'hidden' }}>

          {/* Logo */}
          <div className="sidebar-logo-area" style={{ justifyContent: collapsed ? 'center' : 'flex-start' }}>
            <img src={icon1Img} alt="Assigna" className="sidebar-logo-img" />
            {!collapsed && (
              <div>
                <span className="sidebar-logo-name">Assigna</span>
                {coordinatorProgram
                  ? <span className="sidebar-logo-pill">{coordinatorProgram}</span>
                  : <span className="sidebar-logo-sub">Coordinator</span>}
              </div>
            )}
          </div>

          {/* Nav */}
          <nav style={{ flex:1, overflowY:'auto', overflowX:'hidden', paddingBottom:8, paddingTop:4 }}>
            {NAV_SECTIONS.map(section => (
              <div key={section.label}>
                {!collapsed && <div className="nav-section-label">{section.label}</div>}
                {collapsed && <div style={{ height:10 }} />}
                {section.links.map(({ to, label, icon }) => (
                  <NavLink
                    key={to} to={to}
                    end={to === '/coordinator'}
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
                <div style={{ flex:1, minWidth:0 }}>
                  <div className="sidebar-user-email">{user?.email ?? 'Coordinator'}</div>
                  <div className="sidebar-user-role">{coordinatorProgram ? `${coordinatorProgram} Coordinator` : 'Coordinator'}</div>
                </div>
                <button className="sidebar-logout-btn" onClick={() => setShowLogoutModal(true)} title="Log out">
                  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                    <path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4"/>
                    <polyline points="16 17 21 12 16 7"/><line x1="21" y1="12" x2="9" y2="12"/>
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
      <div style={{ flex:1, minWidth:0, display:'flex', flexDirection:'column', height:'100vh', background:'var(--bg)', overflow:'hidden', marginLeft: isMobile ? 58 : 0 }}>
        <header className="topbar" style={{ position: 'relative' }}>
          <div className="topbar-left" style={{ display: 'flex', alignItems: 'center', gap: 24, minWidth: 0 }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
              <span className="topbar-title" style={{ fontSize:18, fontWeight:700, color:'var(--ink)', letterSpacing:'-.3px', fontFamily:"'Sora',sans-serif", whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                {currentPageLabel}
              </span>
              <button 
                onClick={() => window.dispatchEvent(new Event('start-tour'))}
                title="Page Tour / Help"
                style={{ 
                  display:'flex', alignItems:'center', justifyContent:'center', 
                  width: 24, height: 24, borderRadius: '50%', border: '1.5px solid var(--border)', 
                  background: '#fff', color: 'var(--muted)', cursor: 'pointer', transition: 'all .15s', flexShrink: 0,
                  fontSize: 13, fontWeight: 800, fontFamily: "'Inter',sans-serif", padding: 0, lineHeight: 1
                }}
                onMouseEnter={e => { e.currentTarget.style.background = 'var(--meadowSoft)'; e.currentTarget.style.color = 'var(--meadowDeep)' }}
                onMouseLeave={e => { e.currentTarget.style.background = 'var(--hover)'; e.currentTarget.style.color = 'var(--muted)' }}
              >
                ?
              </button>
            </div>
          </div>

          {/* TELEPORT DESTINATION: Absolutely centered in the middle of the header */}
          <div id="header-stepper-portal" style={{ position: 'absolute', left: '50%', transform: 'translateX(-50%)' }}></div>

          <div style={{ flex:1 }} />
          <div style={{ display:'flex', alignItems:'center', gap:16, marginLeft: 16 }}>
            <div className="topbar-time" style={{ display:'flex', flexDirection:'column', gap:1, textAlign:'right' }}>
              <span style={{ fontSize:11.5, fontWeight:700, color:'var(--meadow)', fontVariantNumeric:'tabular-nums' }}>{timeStr}</span>
              <span style={{ fontSize:10.5, fontWeight:500, color:'var(--muted2)' }}>{dateStr}</span>
            </div>
            {collapsed && (
              <button className="topbar-logout" onClick={() => setShowLogoutModal(true)}
                style={{ display:'flex', alignItems:'center', gap:6, padding:'6px 13px', borderRadius:9, border:'1.5px solid var(--border)', background:'var(--hover)', color:'var(--muted)', fontSize:12, fontWeight:600, cursor:'pointer', fontFamily:'Inter,sans-serif' }}
                onMouseEnter={e => { e.currentTarget.style.background='#FFF0F0'; e.currentTarget.style.color='#C0392B'; }}
                onMouseLeave={e => { e.currentTarget.style.background='var(--hover)'; e.currentTarget.style.color='var(--muted)'; }}
              >
                <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                  <path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4"/>
                  <polyline points="16 17 21 12 16 7"/><line x1="21" y1="12" x2="9" y2="12"/>
                </svg>
                Logout
              </button>
            )}
          </div>
        </header>

        <main style={{ flex:1, overflowY:'auto', overflowX:'hidden', display:'flex', flexDirection:'column' }}>
          <Outlet />
        </main>
      </div>

      {showLogoutModal && (
        <LogoutModal onConfirm={handleLogout} onCancel={() => setShowLogoutModal(false)} />
      )}

      <CoordSolverStatusWidget />
      <CoordToastContainer toasts={toasts} />
    </div>
  )
}