import { Outlet, NavLink, useNavigate } from 'react-router-dom'
import { useAuth } from '../../hooks/useAuth'

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
    body { font-family: 'Poppins', sans-serif; background: #F5F4FB; color: #1a1a2e; }
    :root {
      --lavender-deep: #7C6FCD; --lavender-mid: #A99BE8;
      --lavender-light: #D8D3F5; --lavender-pale: #EEEAFB;
      --white: #FFFFFF; --text-muted: #8883B0;
      --border: #E8E4F8;
      --shadow-sm: 0 2px 8px rgba(124,111,205,0.10);
    }

    /* Sidebar */
    .sidebar-link {
      display: flex; align-items: center; gap: 10px;
      padding: 9px 20px; color: rgba(255,255,255,0.52);
      font-size: 12.5px; font-weight: 500;
      border-left: 3px solid transparent;
      text-decoration: none; transition: all 0.15s;
    }
    .sidebar-link:hover { color:#fff; background:rgba(255,255,255,0.07); }
    .sidebar-link.active { color:#fff; background:rgba(255,255,255,0.11); border-left:3px solid #A99BE8; }
    .nav-icon { width:16px; height:16px; opacity:.7; flex-shrink:0; }
    .sidebar-link.active .nav-icon, .sidebar-link:hover .nav-icon { opacity:1; }
    .nav-section-label {
      padding: 14px 20px 5px;
      font-size: 9.5px; font-weight: 700;
      color: rgba(255,255,255,0.28);
      letter-spacing: 1.8px; text-transform: uppercase;
    }

    /* Topbar */
    .topbar {
      height: 56px; background: #fff;
      border-bottom: 1px solid var(--border);
      display: flex; align-items: center;
      padding: 0 28px; gap: 12px;
      position: sticky; top: 0; z-index: 10;
      box-shadow: var(--shadow-sm);
    }

    /* Page */
    .page { padding: 28px 32px; }
    .page-title { font-size: 20px; font-weight: 700; color: #1a1a2e; margin-bottom: 22px; letter-spacing: -.3px; }

    /* Cards */
    .card { background:#fff; border-radius:14px; padding:20px 24px; box-shadow:var(--shadow-sm); border:1px solid var(--border); }

    /* Badges */
    .badge { display:inline-block; padding:2px 10px; border-radius:99px; font-size:11px; font-weight:600; }
    .badge-red   { background:#FFE8E8; color:#C0392B; }
    .badge-green { background:#E8F8EE; color:#27AE60; }
    .badge-blue  { background:#E8F0FF; color:#2563EB; }

    /* Table */
    table { width:100%; border-collapse:collapse; font-size:13px; }
    th { text-align:left; padding:10px 14px; font-size:11px; font-weight:600; color:#8883B0; text-transform:uppercase; letter-spacing:.6px; border-bottom:1px solid #F0EDF9; background:#FAFAFE; }
    td { padding:11px 14px; border-bottom:1px solid #F5F4FB; }
    tr:last-child td { border-bottom:none; }
    tr:hover td { background:#FAFAFE; }

    /* Inputs */
    input, select {
      padding:8px 12px; border-radius:9px;
      border:1px solid #E8E4F8; font-family:'Poppins',sans-serif;
      font-size:13px; color:#1a1a2e; background:#fff;
      outline:none; transition:border-color 0.15s;
    }
    input:focus, select:focus { border-color:#A99BE8; box-shadow:0 0 0 3px rgba(169,155,232,0.15); }
    input::placeholder { color:#B0ABCC; }

    /* Buttons */
    button {
      padding:8px 16px; border-radius:9px;
      border:1px solid #E8E4F8; font-family:'Poppins',sans-serif;
      font-size:13px; font-weight:500; cursor:pointer;
      background:#fff; color:#3D3580; transition:all 0.15s;
    }
    button:hover { background:#F5F4FB; }
    button.primary { background:linear-gradient(135deg,#7C6FCD,#5a4fbf); color:#fff; border-color:transparent; }
    button.primary:hover { opacity:.9; }
    button.danger { background:#FFF0F0; color:#C0392B; border-color:#FECACA; }
    button.danger:hover { background:#FFE0E0; }

    .error-msg { color:#C0392B; font-size:12px; }

    /* Scrollbar */
    ::-webkit-scrollbar { width:5px; }
    ::-webkit-scrollbar-track { background:transparent; }
    ::-webkit-scrollbar-thumb { background:var(--lavender-light); border-radius:99px; }
  `
  document.head.appendChild(s)
}

/* ── Icon helper ── */
const Icon = ({ d, d2, circle, polyline, rect, line, path2 }) => (
  <svg className="nav-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
    {d && <path d={d}/>}
    {d2 && <path d={d2}/>}
    {circle && <circle {...circle}/>}
    {polyline && <polyline points={polyline}/>}
    {rect && <rect {...rect}/>}
    {line && line.map((l,i)=><line key={i} {...l}/>)}
    {path2 && path2.map((p,i)=><path key={i} d={p}/>)}
  </svg>
)

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

export default function AdminLayout() {
  const { logout, user } = useAuth()
  const navigate = useNavigate()

  async function handleLogout() { await logout(); navigate('/login') }

  const initials = user?.email ? user.email.slice(0, 2).toUpperCase() : 'AD'

  return (
    <div style={{ display: 'flex', minHeight: '100vh', fontFamily: "'Poppins', sans-serif" }}>

      {/* ── Sidebar ── */}
      <aside style={{
        width: 220,
        background: 'linear-gradient(170deg, #3D3580 0%, #2E2660 100%)',
        display: 'flex', flexDirection: 'column', flexShrink: 0,
        boxShadow: '4px 0 24px rgba(61,53,128,0.18)', zIndex: 20,
      }}>

        {/* Logo */}
        <div style={{ padding: '22px 20px 14px', display: 'flex', alignItems: 'center', gap: 10 }}>
          <div style={{
            width: 32, height: 32,
            background: 'linear-gradient(135deg, #A99BE8, #7C6FCD)',
            borderRadius: 9, display: 'flex', alignItems: 'center',
            justifyContent: 'center', fontSize: 14, fontWeight: 800, color: '#fff',
            boxShadow: '0 4px 12px rgba(169,155,232,0.4)',
          }}>L</div>
          <span style={{ fontSize: 15, fontWeight: 700, color: '#fff', letterSpacing: 1.5 }}>LOGOS</span>
        </div>

        <div style={{ height: 1, background: 'rgba(255,255,255,0.08)', margin: '0 16px 2px' }} />

        {/* Nav */}
        <nav style={{ flex: 1, overflowY: 'auto', paddingBottom: 8 }}>
          {NAV_SECTIONS.map(section => (
            <div key={section.label}>
              <div className="nav-section-label">{section.label}</div>
              {section.links.map(({ to, label, icon }) => (
                <NavLink
                  key={to} to={to}
                  end={to === '/dashboard'}
                  className={({ isActive }) => `sidebar-link${isActive ? ' active' : ''}`}
                >
                  {icon}{label}
                </NavLink>
              ))}
            </div>
          ))}
        </nav>

        {/* User row */}
        <div style={{ padding: '10px 14px', borderTop: '1px solid rgba(255,255,255,0.08)', display: 'flex', alignItems: 'center', gap: 9 }}>
          <div style={{
            width: 30, height: 30, borderRadius: '50%',
            background: 'linear-gradient(135deg,#A99BE8,#7C6FCD)',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            fontSize: 10, fontWeight: 700, color: '#fff', flexShrink: 0,
          }}>{initials}</div>
          <div style={{ flex: 1, minWidth: 0 }}>
            <div style={{ fontSize: 11, fontWeight: 600, color: '#fff', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
              {user?.email ?? 'Admin'}
            </div>
            <div style={{ fontSize: 10, color: 'rgba(255,255,255,0.35)' }}>Administrator</div>
          </div>
          <button
            onClick={handleLogout} title="Log out"
            style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'rgba(255,255,255,0.38)', padding: 4, borderRadius: 6, display: 'flex', alignItems: 'center', transition: 'color 0.15s' }}
            onMouseEnter={e => e.currentTarget.style.color = '#fff'}
            onMouseLeave={e => e.currentTarget.style.color = 'rgba(255,255,255,0.38)'}
          >
            <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4"/>
              <polyline points="16 17 21 12 16 7"/>
              <line x1="21" y1="12" x2="9" y2="12"/>
            </svg>
          </button>
        </div>
      </aside>

      {/* ── Right panel ── */}
      <div style={{ flex: 1, display: 'flex', flexDirection: 'column', minHeight: '100vh', background: '#F5F4FB' }}>
        <header className="topbar">
          <div style={{ flex: 1 }} />
          <div style={{
            width: 32, height: 32, borderRadius: '50%',
            background: 'linear-gradient(135deg,#A99BE8,#7C6FCD)',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            fontSize: 11, fontWeight: 700, color: '#fff', cursor: 'pointer',
            boxShadow: '0 2px 8px rgba(124,111,205,0.3)',
          }}>{initials}</div>
        </header>

        <main style={{ flex: 1, overflowY: 'auto' }}>
          <Outlet />
        </main>
      </div>
    </div>
  )
}