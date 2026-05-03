import { useState, useEffect } from 'react'
import { Outlet, NavLink, useNavigate, useLocation } from 'react-router-dom'
import { useAuth } from '../../hooks/useAuth'
import logoImg from '../../assets/logo.png' // Adjust path to your logo

/* ── Google Fonts ── */
if (!document.getElementById('poppins-font')) {
  const l = document.createElement('link')
  l.id = 'poppins-font'; l.rel = 'stylesheet'
  l.href = 'https://fonts.googleapis.com/css2?family=Poppins:wght@400;500;600;700&display=swap'
  document.head.appendChild(l)
}

/* ── Global CSS for Faculty Portal ── */
if (!document.getElementById('faculty-global-style')) {
  const s = document.createElement('style')
  s.id = 'faculty-global-style'
  s.textContent = `
    *, *::before, *::after { box-sizing: border-box; margin: 0; padding: 0; }
    body { font-family: 'Poppins', sans-serif; background: #F8FAFC; color: #0F172A; }
    :root {
      --emerald-deep: #059669; --emerald-mid: #10B981;
      --emerald-light: #A7F3D0; --emerald-pale: #ECFDF5;
      --white: #FFFFFF; --text-muted: #64748B;
      --border: #E2E8F0;
      --shadow-sm: 0 2px 8px rgba(16, 185, 129, 0.08);
    }

    /* ── Sidebar ── */
    .fac-sidebar-logo-area {
      padding: 18px 14px 16px;
      display: flex; flex-direction: row; align-items: center; gap: 10px;
      position: relative; overflow: hidden;
      min-height: 68px;
    }
    .fac-sidebar-logo-area::after {
      content: '';
      position: absolute; bottom: 0; left: 16px; right: 16px;
      height: 1px;
      background: linear-gradient(90deg, transparent, rgba(255,255,255,0.12), transparent);
    }
    .fac-sidebar-logo-img {
      width: 36px; height: 36px; object-fit: contain; flex-shrink: 0;
      filter: drop-shadow(0 2px 8px rgba(0,0,0,0.25));
    }
    .fac-sidebar-logo-text {
      display: flex; flex-direction: column; gap: 2px;
      overflow: hidden; white-space: nowrap;
      transition: opacity 0.2s, width 0.2s;
    }
    .fac-sidebar-logo-name {
      font-size: 14px; font-weight: 800; color: #fff;
      letter-spacing: 2px; text-transform: uppercase; line-height: 1;
    }
    .fac-sidebar-logo-sub {
      font-size: 8px; font-weight: 500; color: rgba(255,255,255,0.45);
      letter-spacing: 1.2px; text-transform: uppercase;
    }

    /* collapse toggle */
    .fac-sidebar-toggle {
      position: absolute; top: 50%; right: -18px; transform: translateY(-50%) scale(0.8);
      width: 36px; height: 36px; border-radius: 50%;
      background: #064E3B;
      border: 1.5px solid rgba(167,243,208,0.25);
      padding: 0;
      display: flex; align-items: center; justify-content: center;
      cursor: pointer; z-index: 50;
      box-shadow: 0 2px 10px rgba(2,44,34,0.5);
      color: rgba(167,243,208,0.6);
      opacity: 0;
      pointer-events: none;
      transition: opacity 0.2s ease, transform 0.2s ease, background 0.2s, color 0.2s;
    }
    aside:hover .fac-sidebar-toggle {
      opacity: 1;
      pointer-events: auto;
      transform: translateY(-50%) scale(1);
    }
    .fac-sidebar-toggle:hover {
      background: #047857;
      color: #A7F3D0;
      border-color: rgba(167,243,208,0.5);
      box-shadow: 0 2px 14px rgba(2,44,34,0.6);
    }

    .fac-sidebar-link {
      display: flex; align-items: center; gap: 10px;
      padding: 9px 18px; color: rgba(255,255,255,0.48);
      font-size: 12.5px; font-weight: 500;
      text-decoration: none; transition: all 0.15s;
      margin: 1px 8px; border-radius: 8px;
      white-space: nowrap; overflow: hidden;
    }
    .fac-sidebar-link:hover { color: #fff; background: rgba(255,255,255,0.08); }
    .fac-sidebar-link.active {
      color: #fff; background: rgba(167,243,208,0.18);
      box-shadow: inset 3px 0 0 var(--emerald-mid);
    }
    .fac-nav-icon { width: 15px; height: 15px; opacity: .65; flex-shrink: 0; }
    .fac-sidebar-link.active .fac-nav-icon, .fac-sidebar-link:hover .fac-nav-icon { opacity: 1; }
    .fac-sidebar-link-label { overflow: hidden; white-space: nowrap; }

    .fac-nav-section-label {
      padding: 10px 18px 4px;
      font-size: 9px; font-weight: 700;
      color: rgba(255,255,255,0.22);
      letter-spacing: 2px; text-transform: uppercase;
      white-space: nowrap; overflow: hidden;
    }
    .fac-nav-section-label:first-child {
      padding-top: 4px;
    }

    /* ── Topbar ── */
    .fac-topbar {
      height: 56px; background: #fff;
      border-bottom: 1px solid var(--border);
      display: flex; align-items: center;
      padding: 0 28px; gap: 12px;
      position: sticky; top: 0; z-index: 10;
      box-shadow: 0 1px 12px rgba(16,185,129,0.04);
    }

    /* ── Page content ── */
    .fac-page { padding: 28px 32px; }


    /* ── User row ── */
    .fac-sidebar-user {
      padding: 12px 16px;
      border-top: 1px solid rgba(255,255,255,0.08);
      display: flex; align-items: center; gap: 10px;
      margin: 4px 0 0;
    }
    .fac-sidebar-avatar {
      width: 32px; height: 32px; border-radius: 50%;
      background: linear-gradient(135deg, var(--emerald-mid), var(--emerald-deep));
      display: flex; align-items: center; justify-content: center;
      font-size: 11px; font-weight: 700; color: #fff; flex-shrink: 0;
      box-shadow: 0 2px 8px rgba(16,185,129,0.4);
    }
    .fac-sidebar-user-info { flex: 1; min-width: 0; }
    .fac-sidebar-user-email {
      font-size: 11px; font-weight: 600; color: #fff;
      overflow: hidden; text-overflow: ellipsis; white-space: nowrap;
    }
    .fac-sidebar-user-role { font-size: 10px; color: rgba(255,255,255,0.3); margin-top: 1px; }
    .fac-sidebar-logout-btn {
      background: none; border: none; cursor: pointer; padding: 5px;
      border-radius: 7px; display: flex; align-items: center;
      color: rgba(255,255,255,0.3); transition: all 0.15s;
    }
    .fac-sidebar-logout-btn:hover { color: #fff; background: rgba(255,255,255,0.1); }
  `
  document.head.appendChild(s)
}

/* ── Nav sections ── */
const FACULTY_NAV = [
  {
    label: 'My Portal',
    links: [
      {
        to: '/schedule', label: 'My Schedule',
        icon: <svg className="fac-nav-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"><rect x="3" y="4" width="18" height="18" rx="2"/><line x1="16" y1="2" x2="16" y2="6"/><line x1="8" y1="2" x2="8" y2="6"/><line x1="3" y1="10" x2="21" y2="10"/><circle cx="8" cy="15" r="1.5" fill="currentColor"/><circle cx="12" cy="15" r="1.5" fill="currentColor"/></svg>,
      },
      {
        to: '/preferences', label: 'Preferences',
        icon: <svg className="fac-nav-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"><circle cx="12" cy="12" r="3"/><path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 0 1-2.83 2.83l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-4 0v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 0 1-2.83-2.83l.06-.06A1.65 1.65 0 0 0 9 4.68a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 4 0v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 0 1 2.83 2.83l-.06.06A1.65 1.65 0 0 0 19.4 9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 0 4h-.09a1.65 1.65 0 0 0-1.51 1z"/></svg>,
      },
    ],
  },
]

function LogoutModal({ onConfirm, onCancel }) {
  return (
    <div className="logout-modal-backdrop" onClick={onCancel}>
      <div className="logout-modal-box" onClick={e => e.stopPropagation()}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 14, marginBottom: 20 }}>
          <div style={{
            width: 42, height: 42, borderRadius: 12, background: '#FFF0F0',
            display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0,
          }}>
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="#C0392B" strokeWidth="2">
              <path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4"/>
              <polyline points="16 17 21 12 16 7"/>
              <line x1="21" y1="12" x2="9" y2="12"/>
            </svg>
          </div>
          <div>
            <p style={{ fontSize: 14, fontWeight: 700, color: '#0F172A' }}>Confirm Logout</p>
            <p style={{ fontSize: 12, color: '#64748B', marginTop: 3 }}>Are you sure you want to exit?</p>
          </div>
        </div>
        <div style={{ display: 'flex', gap: 9, justifyContent: 'flex-end' }}>
          <button onClick={onCancel} style={{ padding: '8px 18px', borderRadius: 10, border: '1.5px solid #E2E8F0', background: '#F8FAFC', color: '#64748B', fontSize: 12.5, fontWeight: 600, cursor: 'pointer', fontFamily: "'Poppins',sans-serif" }}>Cancel</button>
          <button onClick={onConfirm} style={{ padding: '8px 18px', borderRadius: 10, border: 'none', background: 'linear-gradient(135deg,#EF4444,#C0392B)', color: '#fff', fontSize: 12.5, fontWeight: 600, cursor: 'pointer', fontFamily: "'Poppins',sans-serif", boxShadow: '0 4px 14px rgba(192,57,43,0.3)' }}>Logout</button>
        </div>
      </div>
    </div>
  )
}

export default function FacultyLayout() {
  const { logout, user } = useAuth()
  const navigate = useNavigate()
  const location = useLocation()

  const allLinks = FACULTY_NAV.flatMap(s => s.links)
  const activeLink = allLinks.find(l => location.pathname.startsWith(l.to))
  const currentPageLabel = activeLink?.label ?? 'My Portal'
  const [showLogoutModal, setShowLogoutModal] = useState(false)
  const [collapsed, setCollapsed] = useState(false)

  async function handleLogout() {
    await logout()
    navigate('/login')
  }

  const initials = user?.email ? user.email.slice(0, 2).toUpperCase() : 'FA'
  const sidebarWidth = collapsed ? 64 : 224

  const [now, setNow] = useState(new Date())
  useEffect(() => {
    const id = setInterval(() => setNow(new Date()), 1000)
    return () => clearInterval(id)
  }, [])

  const timeStr = now.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
  const dateStr = now.toLocaleDateString([], { weekday: 'short', month: 'short', day: 'numeric', year: 'numeric' })

  return (
    <div style={{ display: 'flex', minHeight: '100vh', fontFamily: "'Poppins', sans-serif" }}>

      {/* ── Sidebar ── */}
      <aside style={{
        width: sidebarWidth,
        background: 'linear-gradient(170deg, #064E3B 0%, #022C22 100%)',
        display: 'flex', flexDirection: 'column', flexShrink: 0,
        boxShadow: '4px 0 28px rgba(2,44,34,0.22)', zIndex: 20,
        position: 'sticky', top: 0, height: '100vh', overflow: 'visible',
        transition: 'width 0.25s cubic-bezier(0.4,0,0.2,1)',
      }}>

        {/* Sidebar background grid */}
        <div style={{
          position: 'absolute', inset: 0, zIndex: 0, pointerEvents: 'none', overflow: 'hidden',
          backgroundImage: 'linear-gradient(rgba(255,255,255,0.025) 1px, transparent 1px), linear-gradient(90deg, rgba(255,255,255,0.025) 1px, transparent 1px)',
          backgroundSize: '32px 32px',
        }} />

        {/* Collapse toggle */}
        <button className="fac-sidebar-toggle" onClick={() => setCollapsed(c => !c)} title={collapsed ? 'Expand sidebar' : 'Collapse sidebar'}>
          <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
            {collapsed ? <polyline points="9 18 15 12 9 6" /> : <polyline points="15 18 9 12 15 6" />}
          </svg>
        </button>

        {/* Content above grid */}
        <div style={{ position: 'relative', zIndex: 1, display: 'flex', flexDirection: 'column', flex: 1, overflow: 'hidden' }}>

          {/* Logo area */}
          <div className="fac-sidebar-logo-area" style={{ justifyContent: collapsed ? 'center' : 'flex-start' }}>
            <img src={logoImg} alt="Logos" className="fac-sidebar-logo-img" />
            {!collapsed && (
              <div className="fac-sidebar-logo-text">
                <span className="fac-sidebar-logo-name">Logos</span>
                <span className="fac-sidebar-logo-sub">Faculty Portal</span>
              </div>
            )}
          </div>

          {/* Nav */}
          <nav style={{ flex: 1, overflowY: 'auto', overflowX: 'hidden', paddingBottom: 8, paddingTop: 2 }}>
            {FACULTY_NAV.map(section => (
              <div key={section.label}>
                {!collapsed && <div className="fac-nav-section-label">{section.label}</div>}
                {collapsed && <div style={{ height: 12 }} />}
                {section.links.map(({ to, label, icon }) => (
                  <NavLink
                    key={to} to={to}
                    end={to === '/schedule'}
                    className={({ isActive }) => `fac-sidebar-link${isActive ? ' active' : ''}`}
                    title={collapsed ? label : undefined}
                    style={{ justifyContent: collapsed ? 'center' : 'flex-start', padding: collapsed ? '9px' : '9px 18px' }}
                  >
                    {icon}
                    {!collapsed && <span className="fac-sidebar-link-label">{label}</span>}
                  </NavLink>
                ))}
              </div>
            ))}
          </nav>

          {/* User row */}
          <div className="fac-sidebar-user" style={{ justifyContent: collapsed ? 'center' : 'flex-start', padding: collapsed ? '12px 0' : '12px 16px' }}>
            <div className="fac-sidebar-avatar">{initials}</div>
            {!collapsed && (
              <>
                <div className="fac-sidebar-user-info">
                  <div className="fac-sidebar-user-email">{user?.email ?? 'Faculty'}</div>
                  <div className="fac-sidebar-user-role">Faculty Member</div>
                </div>
                <button className="fac-sidebar-logout-btn" onClick={() => setShowLogoutModal(true)} title="Log out">
                  <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4"/><polyline points="16 17 21 12 16 7"/><line x1="21" y1="12" x2="9" y2="12"/></svg>
                </button>
              </>
            )}
          </div>
        </div>
      </aside>

      {/* ── Right panel ── */}
      <div style={{ flex: 1, minWidth: 0, display: 'flex', flexDirection: 'column', minHeight: '100vh', background: '#F8FAFC' }}>
        <header className="fac-topbar">
          <span style={{ fontSize: 20, fontWeight: 700, color: '#0F172A', letterSpacing: '-.3px' }}>
            {currentPageLabel}
          </span>
          <div style={{ flex: 1 }} />
          <div style={{ display: 'flex', alignItems: 'center', gap: 16 }}>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 1, textAlign: 'right' }}>
              <span style={{ fontSize: 11, fontWeight: 600, color: '#94A3B8', letterSpacing: '-.2px', fontVariantNumeric: 'tabular-nums' }}>{timeStr}</span>
              <span style={{ fontSize: 11, fontWeight: 600, color: '#94A3B8', letterSpacing: '-.2px' }}>{dateStr}</span>
            </div>
            {collapsed && (
              <button onClick={() => setShowLogoutModal(true)} style={{ display: 'flex', alignItems: 'center', gap: 7, padding: '7px 14px', borderRadius: 9, border: '1.5px solid #E2E8F0', background: '#F8FAFC', color: '#64748B', fontSize: 12, fontWeight: 600, cursor: 'pointer', fontFamily: "'Poppins', sans-serif" }}>
                <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4"/><polyline points="16 17 21 12 16 7"/><line x1="21" y1="12" x2="9" y2="12"/></svg>
                Logout
              </button>
            )}
          </div>
        </header>

        <main style={{ flex: 1, overflowY: 'auto', overflowX: 'hidden', display: 'flex', flexDirection: 'column' }}>
          <Outlet />
        </main>
      </div>

      {showLogoutModal && <LogoutModal onConfirm={handleLogout} onCancel={() => setShowLogoutModal(false)} />}
    </div>
  )
}