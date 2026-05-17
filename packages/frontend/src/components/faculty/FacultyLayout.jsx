import { useState, useEffect, useRef } from 'react'
import { Outlet, NavLink, useNavigate, useLocation } from 'react-router-dom'
import { useAuth } from '../../hooks/useAuth'
import logoImg from '../../assets/logo.png'

/* ─── Google Fonts ──────────────────────────────────────────────────────────── */
if (!document.getElementById('poppins-font')) {
  const l = document.createElement('link')
  l.id = 'poppins-font'; l.rel = 'stylesheet'
  l.href = 'https://fonts.googleapis.com/css2?family=Poppins:ital,wght@0,400;0,500;0,600;0,700;0,800&display=swap'
  document.head.appendChild(l)
}

/* ─── Global CSS ────────────────────────────────────────────────────────────── */
if (!document.getElementById('faculty-global-style')) {
  const s = document.createElement('style')
  s.id = 'faculty-global-style'
  s.textContent = `
    *, *::before, *::after { box-sizing: border-box; margin: 0; padding: 0; }
    body { font-family: 'Poppins', sans-serif; background: #F4F2FC; color: #1a1a2e; }

    :root {
      --fp:        #7C6FCD;
      --fp-deep:   #5a4fbf;
      --fp-mid:    #A99BE8;
      --fp-light:  #D8D3F5;
      --fp-pale:   #EEEAFB;
      --fp-bg:     #F4F2FC;
      --white:     #FFFFFF;
      --text-main: #1a1a2e;
      --text-mid:  #4a4a6a;
      --text-muted:#8883B0;
      --text-light:#B0ABCC;
      --border:    #E8E4F8;
      --border-lt: #F5F4FB;
      --shadow-sm: 0 2px 8px rgba(61,53,128,0.07);
      --shadow-md: 0 4px 20px rgba(61,53,128,0.10);
    }

    /* ── Scrollbar ── */
    ::-webkit-scrollbar { width: 5px; height: 5px; }
    ::-webkit-scrollbar-track { background: transparent; }
    ::-webkit-scrollbar-thumb { background: var(--fp-light); border-radius: 99px; }

    /* ── Sidebar ── */
    .fl-sidebar {
      width: var(--fl-w, 232px);
      background: linear-gradient(165deg, #2d246b 0%, #1f1850 45%, #160f3a 100%);
      display: flex; flex-direction: column; flex-shrink: 0;
      box-shadow: 4px 0 32px rgba(22,15,58,0.28);
      position: sticky; top: 0; height: 100vh;
      overflow: visible; z-index: 20;
      transition: width 0.26s cubic-bezier(0.4,0,0.2,1);
    }
    .fl-sidebar-grid {
      position: absolute; inset: 0; pointer-events: none; overflow: hidden;
      background-image:
        linear-gradient(rgba(255,255,255,0.028) 1px, transparent 1px),
        linear-gradient(90deg, rgba(255,255,255,0.028) 1px, transparent 1px);
      background-size: 28px 28px;
    }
    .fl-sidebar-glow {
      position: absolute; top: -60px; left: -60px; width: 220px; height: 220px;
      background: radial-gradient(circle, rgba(124,111,205,0.18) 0%, transparent 70%);
      pointer-events: none;
    }
    .fl-inner { position: relative; z-index: 1; display: flex; flex-direction: column; flex: 1; overflow: hidden; }

    /* Logo */
    .fl-logo {
      padding: 18px 16px 16px; display: flex; align-items: center; gap: 10px;
      position: relative; min-height: 70px; flex-shrink: 0;
    }
    .fl-logo::after {
      content: ''; position: absolute; bottom: 0; left: 14px; right: 14px; height: 1px;
      background: linear-gradient(90deg, transparent, rgba(169,155,232,0.22), transparent);
    }
    .fl-logo-img { width: 34px; height: 34px; object-fit: contain; flex-shrink: 0; filter: drop-shadow(0 2px 8px rgba(0,0,0,0.3)); }
    .fl-logo-name { font-size: 14px; font-weight: 800; color: #fff; letter-spacing: 2px; text-transform: uppercase; line-height: 1; text-shadow: 0 1px 4px rgba(0,0,0,0.3); }
    .fl-logo-sub  { font-size: 8px; font-weight: 600; color: #C4B8F5; letter-spacing: 1.4px; text-transform: uppercase; margin-top: 3px; }

    /* Collapse toggle */
    .fl-toggle {
      position: absolute; top: 50%; right: -17px; transform: translateY(-50%) scale(0.8);
      width: 34px; height: 34px; border-radius: 50%; padding: 0;
      background: #2d246b; border: 1.5px solid rgba(169,155,232,0.3);
      display: flex; align-items: center; justify-content: center;
      cursor: pointer; z-index: 50; color: rgba(196,184,245,0.7);
      box-shadow: 0 2px 12px rgba(22,15,58,0.5);
      opacity: 0; pointer-events: none;
      transition: opacity 0.2s, transform 0.2s, background 0.15s, color 0.15s;
    }
    .fl-sidebar:hover .fl-toggle { opacity: 1; pointer-events: auto; transform: translateY(-50%) scale(1); }
    .fl-toggle:hover { background: #4a3d9e; color: #C4B8F5; border-color: rgba(169,155,232,0.55); }

    /* Faculty role chip */
    .fl-role-chip {
      margin: 10px 12px 8px;
      padding: 6px 12px;
      background: rgba(169,155,232,0.12);
      border: 1px solid rgba(169,155,232,0.2);
      border-radius: 10px;
      display: flex; align-items: center; gap: 8px;
      flex-shrink: 0;
    }
    .fl-role-dot { width: 6px; height: 6px; border-radius: 50%; background: #A99BE8; flex-shrink: 0; box-shadow: 0 0 6px rgba(169,155,232,0.6); }
    .fl-role-label { font-size: 10px; font-weight: 700; color: #C4B8F5; letter-spacing: 1.2px; text-transform: uppercase; white-space: nowrap; overflow: hidden; }

    /* Nav */
    .fl-nav { flex: 1; overflow-y: auto; overflow-x: hidden; padding: 4px 0 8px; }
    .fl-section-label {
      padding: 12px 18px 5px; font-size: 9px; font-weight: 700;
      color: rgba(196,184,245,0.45); letter-spacing: 2px; text-transform: uppercase;
      white-space: nowrap; overflow: hidden;
    }
    .fl-link {
      display: flex; align-items: center; gap: 11px;
      padding: 9px 16px; margin: 1px 8px; border-radius: 9px;
      color: rgba(255,255,255,0.55); font-size: 12.5px; font-weight: 500;
      text-decoration: none; white-space: nowrap; overflow: hidden;
      transition: background 0.15s, color 0.15s, box-shadow 0.15s;
      position: relative;
    }
    .fl-link:hover { color: rgba(255,255,255,0.9); background: rgba(255,255,255,0.07); }
    .fl-link.active {
      color: #fff; font-weight: 600;
      background: rgba(169,155,232,0.2);
      box-shadow: inset 3px 0 0 #A99BE8;
    }
    .fl-link-icon { width: 15px; height: 15px; flex-shrink: 0; opacity: 0.65; transition: opacity 0.15s; }
    .fl-link:hover  .fl-link-icon,
    .fl-link.active .fl-link-icon { opacity: 1; }
    .fl-link-label { overflow: hidden; white-space: nowrap; flex: 1; }
    .fl-link-badge {
      font-size: 9.5px; font-weight: 700; padding: 2px 7px; border-radius: 99px;
      background: rgba(169,155,232,0.25); color: #C4B8F5;
      flex-shrink: 0; letter-spacing: 0.3px;
    }

    /* User row */
    .fl-user {
      padding: 12px 14px; margin-top: 4px;
      border-top: 1px solid rgba(255,255,255,0.08);
      display: flex; align-items: center; gap: 10px; flex-shrink: 0;
    }
    .fl-avatar {
      width: 34px; height: 34px; border-radius: 50%; flex-shrink: 0;
      background: linear-gradient(135deg, #A99BE8, #7C6FCD);
      display: flex; align-items: center; justify-content: center;
      font-size: 11.5px; font-weight: 800; color: #fff;
      box-shadow: 0 2px 10px rgba(124,111,205,0.45);
      letter-spacing: 0.5px;
    }
    .fl-user-info { flex: 1; min-width: 0; }
    .fl-user-name  { font-size: 11.5px; font-weight: 700; color: #fff; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
    .fl-user-role  { font-size: 10px; color: #C4B8F5; margin-top: 1px; font-weight: 500; }
    .fl-logout-btn {
      background: none; border: none; cursor: pointer; padding: 6px;
      border-radius: 7px; display: flex; align-items: center;
      color: rgba(255,255,255,0.38); transition: all 0.15s; flex-shrink: 0;
    }
    .fl-logout-btn:hover { color: #fff; background: rgba(255,255,255,0.1); }

    /* ── Topbar ── */
    .fl-topbar {
      height: 58px; background: var(--white);
      border-bottom: 1px solid var(--border);
      display: flex; align-items: center; gap: 12px;
      padding: 0 28px; position: sticky; top: 0; z-index: 10;
      box-shadow: 0 1px 12px rgba(61,53,128,0.05);
      flex-shrink: 0;
    }

    /* Breadcrumb */
    .fl-breadcrumb { display: flex; align-items: center; gap: 6px; }
    .fl-breadcrumb-portal { font-size: 12px; font-weight: 600; color: var(--text-muted); }
    .fl-breadcrumb-sep { color: var(--text-light); font-size: 13px; }
    .fl-breadcrumb-page { font-size: 14px; font-weight: 700; color: var(--text-main); }

    /* Topbar right */
    .fl-topbar-right { display: flex; align-items: center; gap: 12px; }
    .fl-clock { display: flex; flex-direction: column; gap: 0; text-align: right; }
    .fl-clock-time { font-size: 11.5px; font-weight: 700; color: var(--fp); font-variant-numeric: tabular-nums; line-height: 1.2; }
    .fl-clock-date { font-size: 10.5px; font-weight: 500; color: var(--text-muted); line-height: 1.2; }

    /* Topbar divider */
    .fl-topbar-divider { width: 1px; height: 24px; background: var(--border); flex-shrink: 0; }

    /* Topbar user chip */
    .fl-topbar-user {
      display: flex; align-items: center; gap: 9px;
      padding: 5px 12px 5px 6px; border-radius: 99px;
      border: 1.5px solid var(--border); background: var(--white);
      cursor: pointer; transition: all 0.15s;
    }
    .fl-topbar-user:hover { border-color: var(--fp-light); background: var(--fp-pale); }
    .fl-topbar-avatar {
      width: 28px; height: 28px; border-radius: 50%;
      background: linear-gradient(135deg, #A99BE8, #7C6FCD);
      display: flex; align-items: center; justify-content: center;
      font-size: 10px; font-weight: 800; color: #fff; flex-shrink: 0;
    }
    .fl-topbar-name { font-size: 12px; font-weight: 600; color: var(--text-main); white-space: nowrap; }

    /* Notification bell */
    .fl-notif-btn {
      width: 36px; height: 36px; border-radius: 10px;
      border: 1.5px solid var(--border); background: var(--white);
      display: flex; align-items: center; justify-content: center;
      cursor: pointer; color: var(--text-muted); transition: all 0.15s;
      position: relative;
    }
    .fl-notif-btn:hover { border-color: var(--fp-light); background: var(--fp-pale); color: var(--fp); }
    .fl-notif-dot {
      position: absolute; top: 7px; right: 7px; width: 7px; height: 7px;
      border-radius: 50%; background: var(--fp); border: 1.5px solid var(--white);
    }

    /* Logout topbar btn (collapsed mode) */
    .fl-logout-topbar {
      display: flex; align-items: center; gap: 7px;
      padding: 7px 14px; border-radius: 9px; cursor: pointer;
      border: 1.5px solid var(--border); background: var(--white);
      color: var(--text-mid); font-size: 12px; font-weight: 600;
      font-family: 'Poppins', sans-serif; transition: all 0.15s;
    }
    .fl-logout-topbar:hover { background: #FFF0F0; color: #C0392B; border-color: #FECACA; }

    /* ── Page wrapper ── */
    .fac-page { padding: 28px 32px; max-width: 1320px; width: 100%; margin: 0 auto; }

    /* ── Skeleton shared ── */
    .fac-skeleton {
      background: linear-gradient(90deg, #EDE9F8 25%, #F5F3FC 50%, #EDE9F8 75%);
      background-size: 200% 100%; animation: fac-shimmer 1.4s infinite;
    }
    @keyframes fac-shimmer { 0%{background-position:200% 0} 100%{background-position:-200% 0} }

    /* ── Logout modal ── */
    .fl-modal-backdrop {
      position: fixed; inset: 0; z-index: 9999;
      background: rgba(22,15,58,0.50); backdrop-filter: blur(5px);
      display: flex; align-items: center; justify-content: center;
      animation: fl-fadein 0.18s ease;
    }
    .fl-modal-box {
      background: #fff; border-radius: 20px; width: 360px; padding: 30px;
      box-shadow: 0 28px 64px rgba(22,15,58,0.25); border: 1px solid var(--border);
      animation: fl-slideup 0.22s cubic-bezier(0.34,1.56,0.64,1);
    }
    @keyframes fl-fadein  { from{opacity:0} to{opacity:1} }
    @keyframes fl-slideup { from{transform:translateY(18px) scale(.96);opacity:0} to{transform:none;opacity:1} }

    /* ── Page transition ── */
    .fl-outlet-wrap { flex: 1; overflow-y: auto; overflow-x: hidden; display: flex; flex-direction: column; }
  `
  document.head.appendChild(s)
}

/* ─── Nav definition ────────────────────────────────────────────────────────── */
const FACULTY_NAV = [
  {
    label: 'My Portal',
    links: [
      {
        to: '/schedule',
        label: 'My Schedule',
        icon: (
          <svg className="fl-link-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2">
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
          <svg className="fl-link-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2">
            <path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2"/>
            <circle cx="12" cy="7" r="4"/>
          </svg>
        ),
      },
    ],
  },
]

/* ─── Helpers ───────────────────────────────────────────────────────────────── */
function getInitials(email = '', displayName = '') {
  if (displayName) {
    const parts = displayName.trim().split(/\s+/)
    if (parts.length >= 2) return (parts[0][0] + parts[parts.length - 1][0]).toUpperCase()
    return displayName.slice(0, 2).toUpperCase()
  }
  return email.slice(0, 2).toUpperCase() || 'FA'
}

/* ─── Logout Modal ──────────────────────────────────────────────────────────── */
function LogoutModal({ onConfirm, onCancel }) {
  return (
    <div className="fl-modal-backdrop" onClick={onCancel}>
      <div className="fl-modal-box" onClick={e => e.stopPropagation()}>
        {/* Icon + text */}
        <div style={{ display:'flex', alignItems:'center', gap:16, marginBottom:24 }}>
          <div style={{
            width:48, height:48, borderRadius:14, flexShrink:0,
            background:'#FFF0F0', border:'1px solid #FECACA',
            display:'flex', alignItems:'center', justifyContent:'center',
          }}>
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="#C0392B" strokeWidth="2">
              <path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4"/>
              <polyline points="16 17 21 12 16 7"/>
              <line x1="21" y1="12" x2="9" y2="12"/>
            </svg>
          </div>
          <div>
            <p style={{ fontSize:15, fontWeight:700, color:'#1a1a2e', marginBottom:3 }}>Sign out?</p>
            <p style={{ fontSize:12.5, color:'#8883B0', lineHeight:1.5 }}>You'll need to log in again to access<br/>the faculty portal.</p>
          </div>
        </div>

        {/* Divider */}
        <div style={{ height:1, background:'#F1F5F9', marginBottom:20 }}/>

        {/* Buttons */}
        <div style={{ display:'flex', gap:10, justifyContent:'flex-end' }}>
          <button
            onClick={onCancel}
            style={{ padding:'9px 20px', borderRadius:10, border:'1.5px solid #E8E4F8', background:'#FAFAFE', color:'#5a5490', fontSize:12.5, fontWeight:600, cursor:'pointer', fontFamily:"'Poppins',sans-serif" }}
          >
            Stay logged in
          </button>
          <button
            onClick={onConfirm}
            style={{ padding:'9px 20px', borderRadius:10, border:'none', background:'linear-gradient(135deg,#EF4444,#C0392B)', color:'#fff', fontSize:12.5, fontWeight:700, cursor:'pointer', fontFamily:"'Poppins',sans-serif", boxShadow:'0 4px 14px rgba(192,57,43,0.28)' }}
          >
            Sign out
          </button>
        </div>
      </div>
    </div>
  )
}

/* ─── FacultyLayout ─────────────────────────────────────────────────────────── */
export default function FacultyLayout() {
  const { logout, user } = useAuth()
  const navigate  = useNavigate()
  const location  = useLocation()

  const [collapsed,        setCollapsed]        = useState(false)
  const [showLogoutModal,  setShowLogoutModal]  = useState(false)
  const [now,              setNow]              = useState(new Date())

  /* live clock */
  useEffect(() => {
    const id = setInterval(() => setNow(new Date()), 1000)
    return () => clearInterval(id)
  }, [])

  const timeStr = now.toLocaleTimeString([], { hour:'2-digit', minute:'2-digit' })
  const dateStr = now.toLocaleDateString([], { weekday:'short', month:'short', day:'numeric' })

  /* active link */
  const allLinks    = FACULTY_NAV.flatMap(s => s.links)
  const activeLink  = allLinks.find(l => location.pathname.startsWith(l.to))
  const pageLabel   = activeLink?.label ?? 'Faculty Portal'

  const sidebarW  = collapsed ? 64 : 232
  const initials  = getInitials(user?.email, user?.displayName)
  const shortName = user?.displayName || user?.email?.split('@')[0] || 'Faculty'

  async function handleLogout() {
    await logout()
    navigate('/login')
  }

  return (
    <div style={{ display:'flex', minHeight:'100vh', fontFamily:"'Poppins',sans-serif" }}>

      {/* ══════════════════════════════════
          SIDEBAR
      ══════════════════════════════════ */}
      <aside
        className="fl-sidebar"
        style={{ '--fl-w': sidebarW + 'px', width: sidebarW }}
      >
        {/* Background textures */}
        <div className="fl-sidebar-grid"/>
        <div className="fl-sidebar-glow"/>

        {/* Collapse toggle */}
        <button
          className="fl-toggle"
          onClick={() => setCollapsed(c => !c)}
          title={collapsed ? 'Expand' : 'Collapse'}
        >
          <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round">
            {collapsed
              ? <polyline points="9 18 15 12 9 6"/>
              : <polyline points="15 18 9 12 15 6"/>
            }
          </svg>
        </button>

        <div className="fl-inner">

          {/* ── Logo ── */}
          <div className="fl-logo" style={{ justifyContent: collapsed ? 'center' : 'flex-start' }}>
            <img src={logoImg} alt="Logo" className="fl-logo-img"/>
            {!collapsed && (
              <div>
                <div className="fl-logo-name">Assigna</div>
                <div className="fl-logo-sub">Faculty Portal</div>
              </div>
            )}
          </div>

          {/* ── Role chip ── */}
          {!collapsed && (
            <div className="fl-role-chip">
              <div className="fl-role-dot"/>
              <span className="fl-role-label">Faculty Member</span>
            </div>
          )}

          {/* ── Navigation ── */}
          <nav className="fl-nav">
            {FACULTY_NAV.map(section => (
              <div key={section.label}>
                {!collapsed && (
                  <div className="fl-section-label">{section.label}</div>
                )}
                {collapsed && <div style={{ height:10 }}/>}

                {section.links.map(({ to, label, icon }) => (
                  <NavLink
                    key={to}
                    to={to}
                    className={({ isActive }) => `fl-link${isActive ? ' active' : ''}`}
                    title={collapsed ? label : undefined}
                    style={{
                      justifyContent: collapsed ? 'center' : 'flex-start',
                      padding: collapsed ? '10px' : '9px 16px',
                    }}
                  >
                    {icon}
                    {!collapsed && (
                      <span className="fl-link-label">{label}</span>
                    )}
                  </NavLink>
                ))}
              </div>
            ))}
          </nav>

          {/* ── User row ── */}
          <div
            className="fl-user"
            style={{ justifyContent: collapsed ? 'center' : 'flex-start', padding: collapsed ? '12px 0' : '12px 14px' }}
          >
            <div className="fl-avatar">{initials}</div>

            {!collapsed && (
              <>
                <div className="fl-user-info">
                  <div className="fl-user-name">{shortName}</div>
                  <div className="fl-user-role">{user?.email}</div>
                </div>
                <button
                  className="fl-logout-btn"
                  onClick={() => setShowLogoutModal(true)}
                  title="Sign out"
                >
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

      {/* ══════════════════════════════════
          MAIN PANEL
      ══════════════════════════════════ */}
      <div style={{ flex:1, minWidth:0, display:'flex', flexDirection:'column', minHeight:'100vh', background:'var(--fp-bg)' }}>

        {/* ── Topbar ── */}
        <header className="fl-topbar">

          {/* Breadcrumb */}
          <div className="fl-breadcrumb">
            <span className="fl-breadcrumb-portal">Faculty Portal</span>
            <span className="fl-breadcrumb-sep">/</span>
            <span className="fl-breadcrumb-page">{pageLabel}</span>
          </div>

          <div style={{ flex:1 }}/>

          <div className="fl-topbar-right">

            {/* Clock */}
            <div className="fl-clock">
              <span className="fl-clock-time">{timeStr}</span>
              <span className="fl-clock-date">{dateStr}</span>
            </div>

            <div className="fl-topbar-divider"/>

            {/* Notification bell */}
            <button className="fl-notif-btn" title="Notifications">
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <path d="M18 8A6 6 0 0 0 6 8c0 7-3 9-3 9h18s-3-2-3-9"/>
                <path d="M13.73 21a2 2 0 0 1-3.46 0"/>
              </svg>
            </button>

            {/* User chip */}
            <div className="fl-topbar-user" onClick={() => setShowLogoutModal(true)}>
              <div className="fl-topbar-avatar">{initials}</div>
              <span className="fl-topbar-name">{shortName}</span>
              <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" style={{ color:'var(--text-muted)', flexShrink:0 }}>
                <polyline points="6 9 12 15 18 9"/>
              </svg>
            </div>

            {/* Logout btn (collapsed sidebar) */}
            {collapsed && (
              <button className="fl-logout-topbar" onClick={() => setShowLogoutModal(true)}>
                <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                  <path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4"/>
                  <polyline points="16 17 21 12 16 7"/>
                  <line x1="21" y1="12" x2="9" y2="12"/>
                </svg>
                Sign out
              </button>
            )}
          </div>
        </header>

        {/* ── Page content ── */}
        <main className="fl-outlet-wrap">
          <Outlet/>
        </main>

      </div>

      {/* ── Logout Modal ── */}
      {showLogoutModal && (
        <LogoutModal
          onConfirm={handleLogout}
          onCancel={() => setShowLogoutModal(false)}
        />
      )}
    </div>
  )
}