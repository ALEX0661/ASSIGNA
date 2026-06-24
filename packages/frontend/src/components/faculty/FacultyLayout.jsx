import { useState, useEffect } from 'react'
import { Outlet, NavLink, useNavigate, useLocation } from 'react-router-dom'
import { useAuth } from '../../hooks/useAuth'
import logoImg from '../../assets/ASSIGNAV1.png'

/* ── Google Fonts ── */
if (!document.getElementById('poppins-font')) {
  const l = document.createElement('link')
  l.id = 'poppins-font'; l.rel = 'stylesheet'
  l.href = 'https://fonts.googleapis.com/css2?family=Poppins:wght@400;500;600;700;800&family=Sora:wght@600;700;800&display=swap'
  document.head.appendChild(l)
}

/* ── Global CSS ── */
if (!document.getElementById('faculty-global-style')) {
  const s = document.createElement('style')
  s.id = 'faculty-global-style'
  s.textContent = `
    *, *::before, *::after { box-sizing: border-box; margin: 0; padding: 0; }
    body { font-family: 'Poppins', sans-serif; }

    :root {
      --theme-background: #F2F7F4;
      --theme-surface:    #FFFFFF;
      --theme-border:     #D8E8DF;
      --theme-text:       #0E2A1C;
      --meadow:           #1E7A4A;
      --meadow-soft:      #E8F5EE;
      --meadow-border:    #C0DFC9;
    }

    /* ═══════════════════════════════════
       SIDEBAR LOGO
    ═══════════════════════════════════ */
    .fl-logo-area {
      padding: 16px 14px 15px;
      display: flex; flex-direction: row; align-items: center; gap: 10px;
      position: relative; overflow: hidden; min-height: 66px;
    }
    .fl-logo-area::after {
      content: '';
      position: absolute; bottom: 0; left: 14px; right: 14px; height: 1px;
      background: linear-gradient(90deg, transparent, rgba(255,255,255,0.18), transparent);
    }
    .fl-logo-img {
      width: 32px; height: 32px; object-fit: contain; flex-shrink: 0;
      filter: drop-shadow(0 2px 8px rgba(0,0,0,0.3));
    }
    .fl-logo-text { display: flex; flex-direction: column; gap: 3px; overflow: hidden; white-space: nowrap; }
    .fl-logo-name {
      font-size: 14px; font-weight: 800; color: #ffffff;
      letter-spacing: 2px; text-transform: uppercase; line-height: 1;
      text-shadow: 0 1px 3px rgba(0,0,0,0.25);
    }
    .fl-logo-sub {
      font-size: 8px; font-weight: 600; color: #A8D4BC;
      letter-spacing: 1.2px; text-transform: uppercase;
    }

    /* ═══════════════════════════════════
       COLLAPSE TOGGLE
    ═══════════════════════════════════ */
    .fl-toggle {
      position: absolute; top: 50%; right: -18px; transform: translateY(-50%) scale(0.8);
      width: 36px; height: 36px; border-radius: 50%;
      background: #0A2E18;
      border: 1.5px solid rgba(168,212,188,0.3);
      padding: 0; display: flex; align-items: center; justify-content: center;
      cursor: pointer; z-index: 50;
      box-shadow: 0 2px 10px rgba(10,30,18,0.5);
      color: rgba(168,212,188,0.75);
      opacity: 0; pointer-events: none;
      transition: opacity 0.2s ease, transform 0.2s ease, background 0.2s, color 0.2s;
    }
    aside:hover .fl-toggle {
      opacity: 1; pointer-events: auto;
      transform: translateY(-50%) scale(1);
    }
    .fl-toggle:hover {
      background: #154D2C; color: #A8D4BC;
      border-color: rgba(168,212,188,0.55);
      box-shadow: 0 2px 14px rgba(10,30,18,0.6);
    }

    /* ═══════════════════════════════════
       NAV LINKS
    ═══════════════════════════════════ */
    .fl-nav-link {
      display: flex; align-items: center; gap: 10px;
      padding: 9px 18px; color: rgba(255,255,255,0.68);
      font-size: 12.5px; font-weight: 500; font-family: 'Poppins', sans-serif;
      text-decoration: none; transition: all 0.15s;
      margin: 1px 8px; border-radius: 8px;
      white-space: nowrap; overflow: hidden;
    }
    .fl-nav-link:hover { color: #fff; background: rgba(255,255,255,0.10); }
    .fl-nav-link.active {
      color: #fff; background: rgba(255,255,255,0.13);
      box-shadow: inset 3px 0 0 rgba(255,255,255,0.5);
    }
    .fl-nav-icon { width: 15px; height: 15px; opacity: .72; flex-shrink: 0; }
    .fl-nav-link.active .fl-nav-icon, .fl-nav-link:hover .fl-nav-icon { opacity: 1; }
    .fl-nav-label { overflow: hidden; white-space: nowrap; }

    .fl-section-label {
      padding: 10px 18px 4px;
      font-size: 9px; font-weight: 700;
      color: rgba(168,212,188,0.55);
      letter-spacing: 2px; text-transform: uppercase;
      white-space: nowrap; overflow: hidden;
    }

    /* ═══════════════════════════════════
       TOPBAR
    ═══════════════════════════════════ */
    .fl-topbar {
      height: 56px; background: var(--theme-surface);
      border-bottom: 1px solid var(--theme-border);
      display: flex; align-items: center;
      padding: 0 28px; gap: 12px;
      position: sticky; top: 0; z-index: 10;
      box-shadow: 0 1px 12px rgba(14,42,28,0.05);
    }
    .fl-portal-badge {
      display: inline-flex; align-items: center; gap: 5px;
      padding: 3px 10px; border-radius: 99px;
      background: var(--meadow-soft); border: 1px solid var(--meadow-border);
      font-size: 10.5px; font-weight: 700; color: var(--meadow);
      letter-spacing: .3px; white-space: nowrap;
    }

    /* ═══════════════════════════════════
       LOGOUT MODAL
    ═══════════════════════════════════ */
    .fl-modal-backdrop {
      position: fixed; inset: 0; background: rgba(10,30,18,0.4);
      display: flex; align-items: center; justify-content: center;
      z-index: 9999; backdrop-filter: blur(4px);
      animation: fl-fadeIn 0.18s cubic-bezier(0.4,0,0.2,1);
    }
    .fl-modal-box {
      background: #FFFFFF; border-radius: 18px; width: 340px;
      padding: 28px; box-shadow: 0 24px 60px rgba(10,30,18,0.18);
      border: 1px solid var(--theme-border);
      animation: fl-slideUp 0.2s cubic-bezier(0.34,1.56,0.64,1);
    }
    @keyframes fl-fadeIn  { from { opacity: 0; } to { opacity: 1; } }
    @keyframes fl-slideUp { from { transform: translateY(16px) scale(.97); opacity:0; } to { transform: none; opacity:1; } }

    /* ═══════════════════════════════════
       USER ROW
    ═══════════════════════════════════ */
    .fl-user-row {
      padding: 12px 16px;
      border-top: 1px solid rgba(255,255,255,0.10);
      display: flex; align-items: center; gap: 10px; margin: 4px 0 0;
    }
    .fl-avatar {
      width: 32px; height: 32px; border-radius: 50%;
      background: linear-gradient(135deg, #4CAF84, #1E7A4A);
      display: flex; align-items: center; justify-content: center;
      font-size: 11px; font-weight: 700; color: #fff; flex-shrink: 0;
      box-shadow: 0 2px 8px rgba(30,122,74,0.4);
    }
    .fl-user-name {
      font-size: 11px; font-weight: 600; color: #fff;
      overflow: hidden; text-overflow: ellipsis; white-space: nowrap;
    }
    .fl-user-role { font-size: 10px; color: #A8D4BC; margin-top: 1px; font-weight: 500; }
    .fl-logout-btn {
      background: none; border: none; cursor: pointer; padding: 5px;
      border-radius: 7px; display: flex; align-items: center;
      color: rgba(255,255,255,0.45); transition: all 0.15s;
    }
    .fl-logout-btn:hover { color: #fff; background: rgba(255,255,255,0.12); }
  `
  document.head.appendChild(s)
}

/* ── Nav definition ── */
const FACULTY_NAV = [
  {
    label: 'My Portal',
    links: [
      {
        to: '/schedule',
        label: 'My Schedule',
        icon: (
          <svg className="fl-nav-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2">
            <rect x="3" y="4" width="18" height="18" rx="2"/>
            <line x1="16" y1="2" x2="16" y2="6"/>
            <line x1="8" y1="2" x2="8" y2="6"/>
            <line x1="3" y1="10" x2="21" y2="10"/>
            <circle cx="8" cy="15" r="1.3" fill="currentColor" stroke="none"/>
            <circle cx="12" cy="15" r="1.3" fill="currentColor" stroke="none"/>
            <circle cx="16" cy="15" r="1.3" fill="currentColor" stroke="none"/>
          </svg>
        ),
      },
      {
        to: '/profile',
        label: 'My Profile',
        icon: (
          <svg className="fl-nav-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2">
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

/* ── Logout Modal ── */
function LogoutModal({ onConfirm, onCancel }) {
  return (
    <div className="fl-modal-backdrop" onClick={onCancel}>
      <div className="fl-modal-box" onClick={e => e.stopPropagation()}>
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
            <p style={{ fontSize: 14, fontWeight: 700, color: '#0E2A1C' }}>Confirm Logout</p>
            <p style={{ fontSize: 12, color: '#6B8C7A', marginTop: 3, fontWeight: 500 }}>Are you sure you want to exit?</p>
          </div>
        </div>
        <div style={{ display: 'flex', gap: 9, justifyContent: 'flex-end' }}>
          <button
            onClick={onCancel}
            style={{ padding: '8px 18px', borderRadius: 10, border: '1.5px solid #D8E8DF', background: '#F2F7F4', color: '#1C3D2A', fontSize: 12.5, fontWeight: 600, cursor: 'pointer', fontFamily: "'Poppins',sans-serif" }}
          >
            Cancel
          </button>
          <button
            onClick={onConfirm}
            style={{ padding: '8px 18px', borderRadius: 10, border: 'none', background: 'linear-gradient(135deg,#EF4444,#C0392B)', color: '#fff', fontSize: 12.5, fontWeight: 600, cursor: 'pointer', fontFamily: "'Poppins',sans-serif", boxShadow: '0 4px 14px rgba(192,57,43,0.3)' }}
          >
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
  const [collapsed, setCollapsed] = useState(false)

  const initials  = getInitials(user?.email, user?.displayName)
  const shortName = user?.displayName || user?.email?.split('@')[0] || 'Faculty'
  const sidebarWidth = collapsed ? 64 : 224

  const [now, setNow] = useState(new Date())
  useEffect(() => {
    const id = setInterval(() => setNow(new Date()), 1000)
    return () => clearInterval(id)
  }, [])
  const timeStr = now.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
  const dateStr = now.toLocaleDateString([], { weekday: 'short', month: 'short', day: 'numeric' })

  async function handleLogout() { await logout(); navigate('/login') }

  return (
    <div style={{ display: 'flex', minHeight: '100vh', fontFamily: "'Poppins', sans-serif" }}>

      {/* ── Sidebar ── */}
      <aside style={{
        width: sidebarWidth,
        background: 'linear-gradient(180deg, #1A5C35 0%, #154D2C 60%, #0F3D22 100%)',
        display: 'flex', flexDirection: 'column', flexShrink: 0,
        boxShadow: '4px 0 20px rgba(10,40,20,0.22)', zIndex: 20,
        position: 'sticky', top: 0, height: '100vh', overflow: 'visible',
        transition: 'width 0.25s cubic-bezier(0.4,0,0.2,1)',
      }}>

        {/* Subtle grid texture — same as admin */}
        <div style={{
          position: 'absolute', inset: 0, zIndex: 0, pointerEvents: 'none', overflow: 'hidden',
          backgroundImage: 'linear-gradient(rgba(255,255,255,0.025) 1px,transparent 1px),linear-gradient(90deg,rgba(255,255,255,0.025) 1px,transparent 1px)',
          backgroundSize: '32px 32px',
        }} />

        {/* Collapse toggle */}
        <button
          className="fl-toggle"
          onClick={() => setCollapsed(c => !c)}
          title={collapsed ? 'Expand sidebar' : 'Collapse sidebar'}
        >
          <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
            {collapsed ? <polyline points="9 18 15 12 9 6" /> : <polyline points="15 18 9 12 15 6" />}
          </svg>
        </button>

        <div style={{ position: 'relative', zIndex: 1, display: 'flex', flexDirection: 'column', flex: 1, overflow: 'hidden' }}>

          {/* Logo */}
          <div className="fl-logo-area" style={{ justifyContent: collapsed ? 'center' : 'flex-start' }}>
            <img src={logoImg} alt="Assigna" className="fl-logo-img" />
            {!collapsed && (
              <div className="fl-logo-text">
                <span className="fl-logo-name">Assigna</span>
                <span className="fl-logo-sub">Faculty Portal</span>
              </div>
            )}
          </div>

          {/* Nav */}
          <nav style={{ flex: 1, overflowY: 'auto', overflowX: 'hidden', paddingBottom: 8, paddingTop: 4 }}>
            {FACULTY_NAV.map(section => (
              <div key={section.label}>
                {!collapsed && <div className="fl-section-label">{section.label}</div>}
                {collapsed && <div style={{ height: 12 }} />}
                {section.links.map(({ to, label, icon }) => (
                  <NavLink
                    key={to} to={to}
                    className={({ isActive }) => `fl-nav-link${isActive ? ' active' : ''}`}
                    title={collapsed ? label : undefined}
                    style={{ justifyContent: collapsed ? 'center' : 'flex-start', padding: collapsed ? '9px' : '9px 18px' }}
                  >
                    {icon}
                    {!collapsed && <span className="fl-nav-label">{label}</span>}
                  </NavLink>
                ))}
              </div>
            ))}
          </nav>

          {/* User row */}
          <div className="fl-user-row" style={{ justifyContent: collapsed ? 'center' : 'flex-start', padding: collapsed ? '12px 0' : '12px 16px' }}>
            <div className="fl-avatar">{initials}</div>
            {!collapsed && (
              <>
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div className="fl-user-name">{shortName}</div>
                  <div className="fl-user-role">{user?.email ?? 'Faculty'}</div>
                </div>
                <button className="fl-logout-btn" onClick={() => setShowLogoutModal(true)} title="Log out">
                  <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
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

      {/* ── Right panel ── */}
      <div style={{ flex: 1, minWidth: 0, display: 'flex', flexDirection: 'column', minHeight: '100vh', background: 'var(--theme-background)' }}>

        <header className="fl-topbar">
          <span style={{ fontSize: 18, fontWeight: 700, color: 'var(--theme-text)', letterSpacing: '-.3px', fontFamily: "'Sora',sans-serif" }}>
            {currentPageLabel}
          </span>
          <span className="fl-portal-badge">
            <svg width="9" height="9" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"><path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2"/><circle cx="12" cy="7" r="4"/></svg>
            Faculty
          </span>
          <div style={{ flex: 1 }} />
          <div style={{ display: 'flex', alignItems: 'center', gap: 16 }}>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 1, textAlign: 'right' }}>
              <span style={{ fontSize: 11.5, fontWeight: 700, color: '#1E7A4A', fontVariantNumeric: 'tabular-nums' }}>{timeStr}</span>
              <span style={{ fontSize: 10.5, fontWeight: 500, color: '#6B8C7A' }}>{dateStr}</span>
            </div>
            {collapsed && (
              <button
                onClick={() => setShowLogoutModal(true)}
                style={{ display: 'flex', alignItems: 'center', gap: 6, padding: '6px 13px', borderRadius: 9, border: '1.5px solid var(--theme-border)', background: 'var(--meadow-soft)', color: '#1E7A4A', fontSize: 12, fontWeight: 600, cursor: 'pointer', fontFamily: "'Poppins',sans-serif", transition: 'all 0.15s' }}
                onMouseEnter={e => { e.currentTarget.style.background = '#FFF0F0'; e.currentTarget.style.color = '#C0392B'; e.currentTarget.style.borderColor = '#FECACA'; }}
                onMouseLeave={e => { e.currentTarget.style.background = 'var(--meadow-soft)'; e.currentTarget.style.color = '#1E7A4A'; e.currentTarget.style.borderColor = 'var(--theme-border)'; }}
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