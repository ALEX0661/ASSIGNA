import { useEffect, useState, useMemo } from 'react'
import { useNavigate, NavLink } from 'react-router-dom'
import { useAuth } from '../../hooks/useAuth'
import { listSaved, loadSaved, getFaculty } from '../../services/api'
import { signOut } from 'firebase/auth'
import { auth } from '../../services/firebase'

/* ── Google Font (Poppins — matches admin side) ── */
if (!document.getElementById('poppins-font')) {
  const l = document.createElement('link')
  l.id = 'poppins-font'; l.rel = 'stylesheet'
  l.href = 'https://fonts.googleapis.com/css2?family=Poppins:wght@400;500;600;700&display=swap'
  document.head.appendChild(l)
}

/* ── Faculty global styles ── */
if (!document.getElementById('faculty-global-style')) {
  const s = document.createElement('style')
  s.id = 'faculty-global-style'
  s.textContent = `
    *, *::before, *::after { box-sizing: border-box; margin: 0; padding: 0; }
    body { font-family: 'Poppins', sans-serif; background: #F5F4FB; color: #1a1a2e; }
    :root {
      --teal:        #1D9E75;
      --teal-dark:   #0F6E56;
      --teal-deeper: #085041;
      --teal-pale:   #E1F5EE;
      --teal-mid:    #9FE1CB;
      --white:       #FFFFFF;
      --page-bg:     #F5F4FB;
      --border:      #E8E4F8;
      --text-muted:  #8883B0;
      --shadow-sm:   0 2px 8px rgba(124,111,205,0.10);
    }

    /* ── Sidebar nav ── */
    .fac-sidebar-link {
      display: flex; align-items: center; gap: 10px;
      padding: 9px 20px; color: rgba(255,255,255,0.52);
      font-size: 12.5px; font-weight: 500;
      border-left: 3px solid transparent;
      text-decoration: none; transition: all 0.15s;
    }
    .fac-sidebar-link:hover  { color:#fff; background:rgba(255,255,255,0.07); }
    .fac-sidebar-link.active { color:#fff; background:rgba(255,255,255,0.11); border-left:3px solid #9FE1CB; }
    .fac-nav-icon { width:16px; height:16px; opacity:.7; flex-shrink:0; }
    .fac-sidebar-link.active .fac-nav-icon,
    .fac-sidebar-link:hover  .fac-nav-icon { opacity:1; }
    .fac-nav-section {
      padding: 14px 20px 5px;
      font-size: 9.5px; font-weight: 700;
      color: rgba(255,255,255,0.28);
      letter-spacing: 1.8px; text-transform: uppercase;
    }

    /* ── Cards ── */
    .fac-card {
      background:#fff; border-radius:14px; padding:20px 24px;
      box-shadow:var(--shadow-sm); border:1px solid var(--border);
    }

    /* ── Day tab pills ── */
    .fac-day-tab {
      padding: 6px 14px; border-radius: 99px;
      font-size: 12px; font-weight: 500;
      cursor: pointer; font-family: 'Poppins', sans-serif;
      border: 1px solid #E8E4F8;
      background: #fff; color: var(--text-muted);
      transition: all 0.15s;
    }
    .fac-day-tab:hover  { border-color: #A99BE8; color: #1a1a2e; }
    .fac-day-tab.active { background: var(--teal); border-color: var(--teal); color: #fff; }

    /* ── Session type badges ── */
    .badge-lec  { background:#E8F0FF; color:#2563EB; }
    .badge-lab  { background:#FAEEDA; color:#633806; }
    .badge-room { background:var(--teal-pale); color:var(--teal-deeper); }
    .badge-prog { background:#F5F4FB; color:var(--text-muted); }

    /* ── Week pips ── */
    .fac-pip        { height:4px; border-radius:2px; background:#E8E4F8; }
    .fac-pip.active { background:var(--teal); }

    /* ── Stat cards ── */
    .fac-stat {
      background:#fff; border-radius:12px; padding:16px 18px;
      box-shadow:var(--shadow-sm); border:1px solid var(--border);
      text-align:center;
    }
    .fac-stat-num   { font-size:26px; font-weight:700; color:#1a1a2e; line-height:1; }
    .fac-stat-label { font-size:11px; color:var(--text-muted); margin-top:5px; }
  `
  document.head.appendChild(s)
}

const DAYS = ['Monday','Tuesday','Wednesday','Thursday','Friday','Saturday']

/* ── Sidebar shared between both faculty pages ── */
function FacultySidebar({ user, initials, onLogout }) {
  return (
    <aside style={{
      width: 220, flexShrink: 0,
      background: 'linear-gradient(170deg,#1D6B50 0%,#0D4A38 100%)',
      display: 'flex', flexDirection: 'column',
      boxShadow: '4px 0 24px rgba(13,74,56,0.22)', zIndex: 20,
    }}>
      {/* Logo */}
      <div style={{ padding:'22px 20px 14px', display:'flex', alignItems:'center', gap:10 }}>
        <div style={{
          width:32, height:32,
          background:'linear-gradient(135deg,#9FE1CB,#1D9E75)',
          borderRadius:9, display:'flex', alignItems:'center',
          justifyContent:'center', fontSize:14, fontWeight:800, color:'#fff',
          boxShadow:'0 4px 12px rgba(29,158,117,0.35)',
        }}>L</div>
        <span style={{ fontSize:15, fontWeight:700, color:'#fff', letterSpacing:1.5 }}>LOGOS</span>
      </div>

      <div style={{ height:1, background:'rgba(255,255,255,0.1)', margin:'0 16px 2px' }} />

      <nav style={{ flex:1, paddingBottom:8 }}>
        <div className="fac-nav-section">My Portal</div>

        <NavLink to="/schedule" end className={({ isActive }) => `fac-sidebar-link${isActive ? ' active' : ''}`}>
          <svg className="fac-nav-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
            <rect x="3" y="4" width="18" height="18" rx="2"/>
            <line x1="16" y1="2" x2="16" y2="6"/>
            <line x1="8" y1="2" x2="8" y2="6"/>
            <line x1="3" y1="10" x2="21" y2="10"/>
            <circle cx="8" cy="15" r="1" fill="currentColor"/>
            <circle cx="12" cy="15" r="1" fill="currentColor"/>
          </svg>
          My Schedule
        </NavLink>

        <NavLink to="/preferences" className={({ isActive }) => `fac-sidebar-link${isActive ? ' active' : ''}`}>
          <svg className="fac-nav-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
            <circle cx="12" cy="12" r="3"/>
            <path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 0 1-2.83 2.83l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-4 0v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 0 1-2.83-2.83l.06-.06A1.65 1.65 0 0 0 4.68 15a1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1 0-4h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 0 1 2.83-2.83l.06.06A1.65 1.65 0 0 0 9 4.68a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 4 0v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 0 1 2.83 2.83l-.06.06A1.65 1.65 0 0 0 19.4 9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 0 4h-.09a1.65 1.65 0 0 0-1.51 1z"/>
          </svg>
          Preferences
        </NavLink>
      </nav>

      {/* User row */}
      <div style={{ padding:'10px 14px', borderTop:'1px solid rgba(255,255,255,0.1)', display:'flex', alignItems:'center', gap:9 }}>
        <div style={{
          width:30, height:30, borderRadius:'50%',
          background:'linear-gradient(135deg,#9FE1CB,#1D9E75)',
          display:'flex', alignItems:'center', justifyContent:'center',
          fontSize:10, fontWeight:700, color:'#fff', flexShrink:0,
        }}>{initials}</div>
        <div style={{ flex:1, minWidth:0 }}>
          <div style={{ fontSize:11, fontWeight:600, color:'#fff', overflow:'hidden', textOverflow:'ellipsis', whiteSpace:'nowrap' }}>
            {user?.email ?? 'Faculty'}
          </div>
          <div style={{ fontSize:10, color:'rgba(255,255,255,0.38)' }}>Faculty</div>
        </div>
        <button
          onClick={onLogout} title="Log out"
          style={{ background:'none', border:'none', cursor:'pointer', color:'rgba(255,255,255,0.38)', padding:4, borderRadius:6, display:'flex', alignItems:'center', transition:'color 0.15s' }}
          onMouseEnter={e => e.currentTarget.style.color='#fff'}
          onMouseLeave={e => e.currentTarget.style.color='rgba(255,255,255,0.38)'}
        >
          <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
            <path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4"/>
            <polyline points="16 17 21 12 16 7"/>
            <line x1="21" y1="12" x2="9" y2="12"/>
          </svg>
        </button>
      </div>
    </aside>
  )
}

/* ── Badge helper ── */
function Badge({ children, className }) {
  return (
    <span style={{
      display:'inline-flex', alignItems:'center',
      padding:'3px 9px', borderRadius:99,
      fontSize:11, fontWeight:600,
    }} className={className}>
      {children}
    </span>
  )
}

export default function FacultySchedulePage() {
  const { user } = useAuth()
  const navigate  = useNavigate()

  const [events,      setEvents]      = useState([])
  const [facultyName, setFacultyName] = useState('')
  const [facultyMeta, setFacultyMeta] = useState({})   // rank, department, units, max_units
  const [activeDay,   setActiveDay]   = useState(null)
  const [loading,     setLoading]     = useState(true)
  const [error,       setError]       = useState('')

  const initials = user?.email ? user.email.slice(0, 2).toUpperCase() : 'FA'

  async function handleLogout() {
    await signOut(auth)
    navigate('/login')
  }

  useEffect(() => {
    if (!user) return
    async function load() {
      try {
        let resolvedName = user.displayName || user.email || ''
        try {
          const list = await getFaculty()
          if (list.length > 0) {
            const me = list[0]
            if (me.name) resolvedName = me.name
            setFacultyMeta({
              rank:       me.AcademicRank || '',
              department: me.Department   || '',
              units:      me.units        ?? 0,
              max_units:  me.max_units    ?? 21,
            })
          }
        } catch { /* fall through */ }
        setFacultyName(resolvedName)

        const names = await listSaved()
        if (names.length === 0) { setLoading(false); return }

        const latest = names[names.length - 1]
        const data   = await loadSaved(latest)
        const allEvents = data.schedule || []
        setEvents(allEvents)

        // Pre-select first teaching day
        const myDays = DAYS.filter(d =>
          allEvents.some(e =>
            (resolvedName    && e.faculty === resolvedName) ||
            (user?.email     && e.faculty === user.email)   ||
            (user?.displayName && e.faculty === user.displayName)
          ) && allEvents.some(e =>
            e.day === d &&
            (
              (resolvedName      && e.faculty === resolvedName) ||
              (user?.email       && e.faculty === user.email)   ||
              (user?.displayName && e.faculty === user.displayName)
            )
          )
        )
        if (myDays.length > 0) setActiveDay(myDays[0])
      } catch {
        setError('Could not load schedule. Please try again later.')
      } finally {
        setLoading(false)
      }
    }
    load()
  }, [user])

  const myEvents = useMemo(() => {
    if (!facultyName && !user?.email) return []
    return events.filter(e =>
      (facultyName       && e.faculty === facultyName)       ||
      (user?.email       && e.faculty === user.email)        ||
      (user?.displayName && e.faculty === user.displayName)
    )
  }, [events, facultyName, user])

  const teachingDays = useMemo(() =>
    DAYS.filter(d => myEvents.some(e => e.day === d)),
    [myEvents]
  )

  const dayEvents = useMemo(() =>
    myEvents
      .filter(e => e.day === activeDay)
      .sort((a, b) => a.period.localeCompare(b.period)),
    [myEvents, activeDay]
  )

  const totalRooms = useMemo(() => [...new Set(myEvents.map(e => e.room))].length, [myEvents])

  return (
    <div style={{ display:'flex', minHeight:'100vh', fontFamily:"'Poppins', sans-serif" }}>

      <FacultySidebar user={user} initials={initials} onLogout={handleLogout} />

      {/* ── Main content ── */}
      <div style={{ flex:1, display:'flex', flexDirection:'column', background:'#F5F4FB', minHeight:'100vh' }}>

        {/* Topbar */}
        <header style={{
          height:56, background:'#fff',
          borderBottom:'1px solid #E8E4F8',
          display:'flex', alignItems:'center',
          padding:'0 28px', gap:12,
          boxShadow:'0 2px 8px rgba(124,111,205,0.08)',
        }}>
          <div style={{ flex:1 }}>
            <span style={{ fontSize:13, color:'#8883B0', fontWeight:500 }}>
              {loading ? 'Loading schedule…' : `${myEvents.length} session${myEvents.length !== 1 ? 's' : ''} assigned this semester`}
            </span>
          </div>
          <div style={{
            width:32, height:32, borderRadius:'50%',
            background:'linear-gradient(135deg,#9FE1CB,#1D9E75)',
            display:'flex', alignItems:'center', justifyContent:'center',
            fontSize:11, fontWeight:700, color:'#fff',
            boxShadow:'0 2px 8px rgba(29,158,117,0.3)',
          }}>{initials}</div>
        </header>

        <main style={{ flex:1, padding:'28px 32px', overflowY:'auto' }}>

          {/* Page header */}
          <div style={{ marginBottom:24 }}>
            <h1 style={{ fontSize:20, fontWeight:700, color:'#1a1a2e', letterSpacing:'-0.3px', marginBottom:4 }}>
              {facultyName || user?.displayName || 'My Schedule'}
            </h1>
            <p style={{ fontSize:13, color:'#8883B0' }}>
              {[facultyMeta.rank, facultyMeta.department].filter(Boolean).join(' · ')}
              {facultyMeta.units != null && (
                <> &nbsp;·&nbsp;
                  <span style={{ color:'#1D9E75', fontWeight:600 }}>
                    {facultyMeta.units} / {facultyMeta.max_units} units
                  </span>
                </>
              )}
            </p>
          </div>

          {error && (
            <div style={{
              background:'#FFF0F0', border:'1px solid #FECACA', borderRadius:10,
              padding:'12px 16px', fontSize:13, color:'#C0392B', marginBottom:20,
            }}>
              {error}
            </div>
          )}

          {loading && (
            <div style={{ display:'flex', flexDirection:'column', gap:10 }}>
              {[1,2,3].map(i => (
                <div key={i} style={{ height:80, background:'#fff', borderRadius:14, border:'1px solid #E8E4F8', opacity:0.6 }}/>
              ))}
            </div>
          )}

          {!loading && myEvents.length === 0 && (
            <div className="fac-card" style={{ textAlign:'center', padding:'48px 24px' }}>
              <div style={{ fontSize:32, marginBottom:12 }}>📅</div>
              <p style={{ fontWeight:600, fontSize:15, color:'#1a1a2e', marginBottom:6 }}>No sessions yet</p>
              <p style={{ fontSize:13, color:'#8883B0', maxWidth:340, margin:'0 auto' }}>
                Check back after the admin generates and saves a schedule for this semester.
              </p>
            </div>
          )}

          {!loading && myEvents.length > 0 && (
            <>
              {/* Week-at-a-glance bar */}
              <div style={{ display:'flex', gap:4, marginBottom:20 }}>
                {DAYS.map(d => (
                  <div key={d} style={{ flex:1, textAlign:'center' }}>
                    <div style={{ fontSize:10, color:'#8883B0', fontWeight:600, marginBottom:5, textTransform:'uppercase', letterSpacing:'0.05em' }}>
                      {d.slice(0,2)}
                    </div>
                    <div className={`fac-pip${teachingDays.includes(d) ? ' active' : ''}`} />
                  </div>
                ))}
              </div>

              {/* Day tabs */}
              <div style={{ display:'flex', gap:8, flexWrap:'wrap', marginBottom:20 }}>
                {teachingDays.map(day => {
                  const cnt = myEvents.filter(e => e.day === day).length
                  return (
                    <button
                      key={day}
                      className={`fac-day-tab${activeDay === day ? ' active' : ''}`}
                      onClick={() => setActiveDay(day)}
                    >
                      {day}
                      <span style={{
                        marginLeft:6, fontSize:10, fontWeight:700,
                        background: activeDay === day ? 'rgba(255,255,255,0.25)' : '#F5F4FB',
                        color:      activeDay === day ? '#fff' : '#8883B0',
                        padding:'1px 6px', borderRadius:99,
                      }}>
                        {cnt}
                      </span>
                    </button>
                  )
                })}
              </div>

              {/* Session cards */}
              <div style={{ display:'flex', flexDirection:'column', gap:10, marginBottom:24 }}>
                {dayEvents.length === 0 ? (
                  <div className="fac-card" style={{ color:'#8883B0', fontSize:13, textAlign:'center', padding:28 }}>
                    No sessions on {activeDay}.
                  </div>
                ) : dayEvents.map((e, i) => (
                  <div key={i} className="fac-card" style={{
                    padding:'16px 20px', display:'flex',
                    alignItems:'flex-start', gap:16,
                    borderLeft:'3px solid #1D9E75', borderRadius:'0 14px 14px 0',
                  }}>
                    {/* Time chip */}
                    <div style={{
                      background:'#F5F4FB', border:'1px solid #E8E4F8',
                      borderRadius:9, padding:'8px 12px',
                      fontFamily:'monospace', fontSize:11, fontWeight:600,
                      color:'#8883B0', minWidth:90, textAlign:'center',
                      lineHeight:1.6, flexShrink:0,
                    }}>
                      {e.period?.replace('–','\n–\n').split(' – ').map((t, ti) => (
                        <div key={ti}>{t}</div>
                      ))}
                    </div>

                    {/* Body */}
                    <div style={{ flex:1, minWidth:0 }}>
                      <p style={{ fontWeight:700, fontSize:14, color:'#1a1a2e', marginBottom:6 }}>
                        {e.courseCode} — {e.title}
                      </p>
                      <div style={{ display:'flex', flexWrap:'wrap', gap:6, alignItems:'center' }}>
                        <Badge className={e.session === 'Lecture' ? 'badge-lec' : 'badge-lab'}>
                          {e.session}
                        </Badge>
                        <Badge className="badge-prog">
                          {e.block}
                        </Badge>
                        <Badge className="badge-prog">
                          {e.program}
                        </Badge>
                        <Badge className="badge-room">
                          {e.room}
                        </Badge>
                      </div>
                    </div>
                  </div>
                ))}
              </div>

              {/* Weekly summary */}
              <div style={{ display:'grid', gridTemplateColumns:'repeat(3,1fr)', gap:12 }}>
                <div className="fac-stat">
                  <div className="fac-stat-num">{myEvents.length}</div>
                  <div className="fac-stat-label">Total sessions</div>
                </div>
                <div className="fac-stat">
                  <div className="fac-stat-num">{teachingDays.length}</div>
                  <div className="fac-stat-label">Teaching days</div>
                </div>
                <div className="fac-stat">
                  <div className="fac-stat-num">{totalRooms}</div>
                  <div className="fac-stat-label">Rooms used</div>
                </div>
              </div>
            </>
          )}
        </main>
      </div>
    </div>
  )
}