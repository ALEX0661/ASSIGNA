import { useState, useEffect } from 'react'
import { Outlet, NavLink, useNavigate, useLocation } from 'react-router-dom'
import { useAuth } from '../../hooks/useAuth'
import icon1Img from '../../assets/ASSIGNAV1.png'  // icon mark without text

/* ── Google Fonts ── */
if (!document.getElementById('poppins-font')) {
  const l = document.createElement('link')
  l.id = 'poppins-font'; l.rel = 'stylesheet'
  l.href = 'https://fonts.googleapis.com/css2?family=Poppins:wght@400;500;600;700&display=swap'
  document.head.appendChild(l)
}

/* ── Global CSS ── */
if (!document.getElementById('admin-global-style')) {
  const s = document.createElement('style')
  s.id = 'admin-global-style'
  s.textContent = `
    *, *::before, *::after { box-sizing: border-box; margin: 0; padding: 0; }
    body { font-family: 'Poppins', sans-serif; background: #F0EEF9; color: #1a1a2e; }
    :root {
      --lavender-deep: #7C6FCD; --lavender-mid: #A99BE8;
      --lavender-light: #D8D3F5; --lavender-pale: #EEEAFB;
      --white: #FFFFFF; --text-muted: #6D67A8;
      --border: #E8E4F8;
      --shadow-sm: 0 2px 8px rgba(61,53,128,0.08);
    }

    /* ══════════════════════════════════
       SIDEBAR LOGO AREA
    ══════════════════════════════════ */
    .sidebar-logo-area {
      padding: 16px 14px 15px;
      display: flex; flex-direction: row; align-items: center; gap: 10px;
      position: relative; overflow: hidden;
      min-height: 66px;
    }
    .sidebar-logo-area::after {
      content: '';
      position: absolute; bottom: 0; left: 14px; right: 14px;
      height: 1px;
      background: linear-gradient(90deg, transparent, rgba(255,255,255,0.18), transparent);
    }
    .sidebar-logo-img {
      width: 32px; height: 32px; object-fit: contain; flex-shrink: 0;
      filter: drop-shadow(0 2px 8px rgba(0,0,0,0.3));
    }
    .sidebar-logo-text {
      display: flex; flex-direction: column; gap: 3px;
      overflow: hidden; white-space: nowrap;
      transition: opacity 0.2s, width 0.2s;
    }
    /* ★ High-contrast name: pure white, no opacity reduction */
    .sidebar-logo-name {
      font-size: 14px; font-weight: 800; color: #ffffff;
      letter-spacing: 2px; text-transform: uppercase; line-height: 1;
      text-shadow: 0 1px 3px rgba(0,0,0,0.25);
    }
    /* ★ High-contrast subtitle: increased from 0.45–0.58 → solid light lavender */
    .sidebar-logo-sub {
      font-size: 8px; font-weight: 600; color: #C4B8F5;
      letter-spacing: 1.2px; text-transform: uppercase;
    }

    /* ══════════════════════════════════
       COLLAPSE TOGGLE
    ══════════════════════════════════ */
    .sidebar-toggle {
      position: absolute; top: 50%; right: -18px; transform: translateY(-50%) scale(0.8);
      width: 36px; height: 36px; border-radius: 50%;
      background: #3a2f7a;
      border: 1.5px solid rgba(169,155,232,0.3);
      padding: 0;
      display: flex; align-items: center; justify-content: center;
      cursor: pointer; z-index: 50;
      box-shadow: 0 2px 10px rgba(26,21,64,0.5);
      color: rgba(196,184,245,0.75);
      opacity: 0; pointer-events: none;
      transition: opacity 0.2s ease, transform 0.2s ease, background 0.2s, color 0.2s;
    }
    aside:hover .sidebar-toggle {
      opacity: 1; pointer-events: auto;
      transform: translateY(-50%) scale(1);
    }
    .sidebar-toggle:hover {
      background: #4a3d9e; color: #C4B8F5;
      border-color: rgba(169,155,232,0.55);
      box-shadow: 0 2px 14px rgba(26,21,64,0.6);
    }

    /* ══════════════════════════════════
       NAV LINKS
    ══════════════════════════════════ */
    .sidebar-link {
      display: flex; align-items: center; gap: 10px;
      padding: 9px 18px; color: rgba(255,255,255,0.68);
      font-size: 12.5px; font-weight: 500;
      text-decoration: none; transition: all 0.15s;
      margin: 1px 8px; border-radius: 8px;
      white-space: nowrap; overflow: hidden;
    }
    .sidebar-link:hover { color: #fff; background: rgba(255,255,255,0.10); }
    .sidebar-link.active {
      color: #fff; background: rgba(169,155,232,0.22);
      box-shadow: inset 3px 0 0 #C4B8F5;
    }
    .nav-icon { width: 15px; height: 15px; opacity: .72; flex-shrink: 0; }
    .sidebar-link.active .nav-icon, .sidebar-link:hover .nav-icon { opacity: 1; }
    .sidebar-link-label { overflow: hidden; white-space: nowrap; }

    /* ★ Section labels — increased from 0.22 → solid visible color */
    .nav-section-label {
      padding: 10px 18px 4px;
      font-size: 9px; font-weight: 700;
      color: rgba(196,184,245,0.55);
      letter-spacing: 2px; text-transform: uppercase;
      white-space: nowrap; overflow: hidden;
    }
    .nav-section-label:first-child, .nav-section-label-first { padding-top: 4px; }

    /* ══════════════════════════════════
       TOPBAR
    ══════════════════════════════════ */
    .topbar {
      height: 56px; background: #fff;
      border-bottom: 1px solid var(--border);
      display: flex; align-items: center;
      padding: 0 28px; gap: 12px;
      position: sticky; top: 0; z-index: 10;
      box-shadow: 0 1px 12px rgba(61,53,128,0.06);
    }

    /* ── Page ── */
    .page { padding: 28px 32px; }
    .page-title { font-size: 20px; font-weight: 700; color: #1a1a2e; margin-bottom: 22px; letter-spacing: -.3px; }

    /* ── Cards ── */
    .card {
      background: #fff; border-radius: 14px;
      padding: 20px 24px;
      box-shadow: 0 2px 12px rgba(61,53,128,0.07);
      border: 1px solid var(--border);
    }

    /* ── Badges ── */
    .badge { display: inline-block; padding: 2px 10px; border-radius: 99px; font-size: 11px; font-weight: 600; }
    .badge-red   { background: #FFE8E8; color: #C0392B; }
    .badge-green { background: #E8F8EE; color: #1E8449; }
    .badge-blue  { background: #E8F0FF; color: #1A56B0; }

    /* ── Table ── */
    table { width: 100%; border-collapse: collapse; font-size: 13px; }
    th { text-align: left; padding: 10px 14px; font-size: 11px; font-weight: 600; color: #6D67A8; text-transform: uppercase; letter-spacing: .6px; border-bottom: 1px solid #F0EDF9; background: #FAFAFE; }
    td { padding: 11px 14px; border-bottom: 1px solid #F5F4FB; color: #2d2a4a; }
    tr:last-child td { border-bottom: none; }
    tr:hover td { background: #FAFAFE; }

    /* ── Inputs ── */
    input, select {
      padding: 8px 12px; border-radius: 9px;
      border: 1px solid #E8E4F8; font-family: 'Poppins', sans-serif;
      font-size: 13px; color: #1a1a2e; background: #FAFAFE;
      outline: none; transition: border-color 0.15s, box-shadow 0.15s;
    }
    input:focus, select:focus {
      border-color: #A99BE8;
      box-shadow: 0 0 0 3px rgba(169,155,232,0.15);
      background: #fff;
    }
    input::placeholder { color: #B0ABCE; }

    /* ── Buttons ── */
    button {
      padding: 8px 16px; border-radius: 9px;
      border: 1px solid #E8E4F8; font-family: 'Poppins', sans-serif;
      font-size: 13px; font-weight: 500; cursor: pointer;
      background: #fff; color: #3D3580; transition: all 0.15s;
    }
    button:hover { background: #F5F4FB; }
    button.primary { background: linear-gradient(135deg, #7C6FCD, #5a4fbf); color: #fff; border-color: transparent; box-shadow: 0 3px 12px rgba(92,79,191,0.3); }
    button.primary:hover { opacity: .9; }
    button.danger { background: #FFF0F0; color: #C0392B; border-color: #FECACA; }
    button.danger:hover { background: #FFE0E0; }

    .error-msg { color: #C0392B; font-size: 12px; }

    /* ── Logout modal ── */
    .logout-modal-backdrop {
      position: fixed; inset: 0; background: rgba(15, 10, 40, 0.45);
      display: flex; align-items: center; justify-content: center;
      z-index: 9999; backdrop-filter: blur(4px);
      animation: fadeIn 0.18s cubic-bezier(0.4, 0, 0.2, 1);
    }
    .logout-modal-box {
      background: #fff; border-radius: 18px; width: 340px;
      padding: 28px; box-shadow: 0 24px 60px rgba(15,10,40,0.22);
      border: 1px solid #E8E4F8;
      animation: slideUp 0.2s cubic-bezier(0.34, 1.56, 0.64, 1);
    }
    @keyframes fadeIn  { from { opacity: 0; } to { opacity: 1; } }
    @keyframes slideUp { from { transform: translateY(16px) scale(.97); opacity: 0; } to { transform: none; opacity: 1; } }

    /* ══════════════════════════════════
       USER ROW
    ══════════════════════════════════ */
    .sidebar-user {
      padding: 12px 16px;
      border-top: 1px solid rgba(255,255,255,0.10);
      display: flex; align-items: center; gap: 10px;
      margin: 4px 0 0;
    }
    .sidebar-avatar {
      width: 32px; height: 32px; border-radius: 50%;
      background: linear-gradient(135deg, #A99BE8, #7C6FCD);
      display: flex; align-items: center; justify-content: center;
      font-size: 11px; font-weight: 700; color: #fff; flex-shrink: 0;
      box-shadow: 0 2px 8px rgba(124,111,205,0.4);
    }
    .sidebar-user-info { flex: 1; min-width: 0; }
    .sidebar-user-email {
      font-size: 11px; font-weight: 600; color: #fff;
      overflow: hidden; text-overflow: ellipsis; white-space: nowrap;
    }
    /* ★ Role label: boosted from 0.30 → clear lavender */
    .sidebar-user-role {
      font-size: 10px; color: #C4B8F5;
      margin-top: 1px; font-weight: 500;
    }
    .sidebar-logout-btn {
      background: none; border: none; cursor: pointer; padding: 5px;
      border-radius: 7px; display: flex; align-items: center;
      color: rgba(255,255,255,0.50); transition: all 0.15s;
    }
    .sidebar-logout-btn:hover { color: #fff; background: rgba(255,255,255,0.12); }
  `
  document.head.appendChild(s)
}

/* ── Nav sections ── */
const NAV_SECTIONS = [
  {
    label: 'Overview',
    links: [
      {
        to: '/dashboard', label: 'Dashboard',
        icon: <svg className="nav-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><rect x="3" y="3" width="7" height="7" rx="1.5"/><rect x="14" y="3" width="7" height="7" rx="1.5"/><rect x="3" y="14" width="7" height="7" rx="1.5"/><rect x="14" y="14" width="7" height="7" rx="1.5"/></svg>,
      },
    ],
  },
  {
    label: 'Setup',
    links: [
      {
        to: '/dashboard/faculty', label: 'Faculty',
        icon: <svg className="nav-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2"/><circle cx="9" cy="7" r="4"/><path d="M23 21v-2a4 4 0 0 0-3-3.87"/><path d="M16 3.13a4 4 0 0 1 0 7.75"/></svg>,
      },
      {
        to: '/dashboard/courses', label: 'Courses',
        icon: <svg className="nav-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M4 19.5A2.5 2.5 0 0 1 6.5 17H20"/><path d="M6.5 2H20v20H6.5A2.5 2.5 0 0 1 4 19.5v-15A2.5 2.5 0 0 1 6.5 2z"/></svg>,
      },
      {
        to: '/dashboard/rooms', label: 'Rooms',
        icon: <svg className="nav-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M3 9l9-7 9 7v11a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z"/><polyline points="9 22 9 12 15 12 15 22"/></svg>,
      },
      {
        to: '/dashboard/settings', label: 'Settings',
        icon: <svg className="nav-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><circle cx="12" cy="12" r="3"/><path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 0 1-2.83 2.83l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-4 0v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 0 1-2.83-2.83l.06-.06A1.65 1.65 0 0 0 4.68 15a1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1 0-4h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 0 1 2.83-2.83l.06.06A1.65 1.65 0 0 0 9 4.68a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 4 0v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 0 1 2.83 2.83l-.06.06A1.65 1.65 0 0 0 19.4 9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 0 4h-.09a1.65 1.65 0 0 0-1.51 1z"/></svg>,
      },
    ],
  },
  {
    label: 'Schedule',
    links: [
      {
        to: '/dashboard/scheduler', label: 'Scheduler',
        icon: <svg className="nav-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><rect x="3" y="4" width="18" height="18" rx="2"/><line x1="16" y1="2" x2="16" y2="6"/><line x1="8" y1="2" x2="8" y2="6"/><line x1="3" y1="10" x2="21" y2="10"/></svg>,
      },
      {
        to: '/dashboard/schedule', label: 'Schedule View',
        icon: <svg className="nav-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><line x1="8" y1="6" x2="21" y2="6"/><line x1="8" y1="12" x2="21" y2="12"/><line x1="8" y1="18" x2="21" y2="18"/><line x1="3" y1="6" x2="3.01" y2="6"/><line x1="3" y1="12" x2="3.01" y2="12"/><line x1="3" y1="18" x2="3.01" y2="18"/></svg>,
      },
      {
        to: '/dashboard/analytics', label: 'Analytics',
        icon: <svg className="nav-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><line x1="18" y1="20" x2="18" y2="10"/><line x1="12" y1="20" x2="12" y2="4"/><line x1="6" y1="20" x2="6" y2="14"/></svg>,
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
            <p style={{ fontSize: 14, fontWeight: 700, color: '#1a1a2e' }}>Confirm Logout</p>
            <p style={{ fontSize: 12, color: '#6D67A8', marginTop: 3, fontWeight: 500 }}>Are you sure you want to exit?</p>
          </div>
        </div>
        <div style={{ display: 'flex', gap: 9, justifyContent: 'flex-end' }}>
          <button onClick={onCancel} style={{ padding: '8px 18px', borderRadius: 10, border: '1.5px solid #E8E4F8', background: '#FAFAFE', color: '#5a5490', fontSize: 12.5, fontWeight: 600, cursor: 'pointer', fontFamily: "'Poppins',sans-serif" }}>
            Cancel
          </button>
          <button onClick={onConfirm} style={{ padding: '8px 18px', borderRadius: 10, border: 'none', background: 'linear-gradient(135deg,#EF4444,#C0392B)', color: '#fff', fontSize: 12.5, fontWeight: 600, cursor: 'pointer', fontFamily: "'Poppins',sans-serif", boxShadow: '0 4px 14px rgba(192,57,43,0.3)' }}>
            Logout
          </button>
        </div>
      </div>
    </div>
  )
}

export default function AdminLayout() {
  const { logout, user } = useAuth()
  const navigate = useNavigate()
  const location = useLocation()

  const allLinks = NAV_SECTIONS.flatMap(s => s.links)
  const activeLink = allLinks.find(l =>
    l.to === '/dashboard'
      ? location.pathname === '/dashboard'
      : location.pathname.startsWith(l.to)
  )
  const currentPageLabel = activeLink?.label ?? 'Dashboard'
  const [showLogoutModal, setShowLogoutModal] = useState(false)
  const [collapsed, setCollapsed] = useState(false)

  async function handleLogout() {
    await logout()
    navigate('/login')
  }

  const initials = user?.email ? user.email.slice(0, 2).toUpperCase() : 'AD'
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
        background: 'linear-gradient(170deg, #3D3580 0%, #2a2160 60%, #1a1540 100%)',
        display: 'flex', flexDirection: 'column', flexShrink: 0,
        boxShadow: '4px 0 28px rgba(26,21,64,0.22)', zIndex: 20,
        position: 'sticky', top: 0, height: '100vh', overflow: 'visible',
        transition: 'width 0.25s cubic-bezier(0.4,0,0.2,1)',
      }}>

        {/* grid texture */}
        <div style={{
          position: 'absolute', inset: 0, zIndex: 0, pointerEvents: 'none', overflow: 'hidden',
          backgroundImage: 'linear-gradient(rgba(255,255,255,0.025) 1px, transparent 1px), linear-gradient(90deg, rgba(255,255,255,0.025) 1px, transparent 1px)',
          backgroundSize: '32px 32px',
        }} />

        {/* Collapse toggle */}
        <button
          className="sidebar-toggle"
          onClick={() => setCollapsed(c => !c)}
          title={collapsed ? 'Expand sidebar' : 'Collapse sidebar'}
        >
          <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
            {collapsed ? <polyline points="9 18 15 12 9 6" /> : <polyline points="15 18 9 12 15 6" />}
          </svg>
        </button>

        <div style={{ position: 'relative', zIndex: 1, display: 'flex', flexDirection: 'column', flex: 1, overflow: 'hidden' }}>

          {/* Logo area — icon1 (mark only) + text labels */}
          <div className="sidebar-logo-area" style={{ justifyContent: collapsed ? 'center' : 'flex-start' }}>
            <img src={icon1Img} alt="Assigna" className="sidebar-logo-img" />
            {!collapsed && (
              <div className="sidebar-logo-text">
                <span className="sidebar-logo-name">Assigna</span>
                <span className="sidebar-logo-sub">Smart Academic Scheduler</span>
              </div>
            )}
          </div>

          {/* Nav */}
          <nav style={{ flex: 1, overflowY: 'auto', overflowX: 'hidden', paddingBottom: 8, paddingTop: 2 }}>
            {NAV_SECTIONS.map(section => (
              <div key={section.label}>
                {!collapsed && <div className="nav-section-label">{section.label}</div>}
                {collapsed && <div style={{ height: 12 }} />}
                {section.links.map(({ to, label, icon }) => (
                  <NavLink
                    key={to} to={to}
                    end={to === '/dashboard'}
                    className={({ isActive }) => `sidebar-link${isActive ? ' active' : ''}`}
                    title={collapsed ? label : undefined}
                    style={{ justifyContent: collapsed ? 'center' : 'flex-start', padding: collapsed ? '9px' : '9px 18px' }}
                  >
                    {icon}
                    {!collapsed && <span className="sidebar-link-label">{label}</span>}
                  </NavLink>
                ))}
              </div>
            ))}
          </nav>

          {/* User row */}
          <div className="sidebar-user" style={{ justifyContent: collapsed ? 'center' : 'flex-start', padding: collapsed ? '12px 0' : '12px 16px' }}>
            <div className="sidebar-avatar">{initials}</div>
            {!collapsed && (
              <>
                <div className="sidebar-user-info">
                  <div className="sidebar-user-email">{user?.email ?? 'Admin'}</div>
                  <div className="sidebar-user-role">Administrator</div>
                </div>
                <button className="sidebar-logout-btn" onClick={() => setShowLogoutModal(true)} title="Log out">
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
      <div style={{ flex: 1, minWidth: 0, display: 'flex', flexDirection: 'column', minHeight: '100vh', background: '#F0EEF9' }}>

        <header className="topbar">
          <span style={{ fontSize: 20, fontWeight: 700, color: '#1a1a2e', letterSpacing: '-.3px' }}>
            {currentPageLabel}
          </span>
          <div style={{ flex: 1 }} />
          <div style={{ display: 'flex', alignItems: 'center', gap: 16 }}>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 1, textAlign: 'right' }}>
              <span style={{ fontSize: 11, fontWeight: 600, color: '#6D67A8', letterSpacing: '-.2px', fontVariantNumeric: 'tabular-nums' }}>{timeStr}</span>
              <span style={{ fontSize: 11, fontWeight: 500, color: '#8883B0', letterSpacing: '-.2px' }}>{dateStr}</span>
            </div>
            {collapsed && (
              <button
                onClick={() => setShowLogoutModal(true)}
                style={{ display: 'flex', alignItems: 'center', gap: 7, padding: '7px 14px', borderRadius: 9, border: '1.5px solid #E8E4F8', background: '#FAFAFE', color: '#5a5490', fontSize: 12, fontWeight: 600, cursor: 'pointer', fontFamily: "'Poppins', sans-serif", transition: 'all 0.15s' }}
                onMouseEnter={e => { e.currentTarget.style.background = '#FFF0F0'; e.currentTarget.style.color = '#C0392B'; e.currentTarget.style.borderColor = '#FECACA'; }}
                onMouseLeave={e => { e.currentTarget.style.background = '#FAFAFE'; e.currentTarget.style.color = '#5a5490'; e.currentTarget.style.borderColor = '#E8E4F8'; }}
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