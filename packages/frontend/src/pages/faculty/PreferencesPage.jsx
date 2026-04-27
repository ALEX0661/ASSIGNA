import { useEffect, useState } from 'react'
import { useNavigate, NavLink } from 'react-router-dom'
import { useAuth } from '../../hooks/useAuth'
import { updatePreferences, getFaculty } from '../../services/api'
import { signOut } from 'firebase/auth'
import { auth } from '../../services/firebase'

/* ── Font + global styles are injected by FacultySchedulePage (same session).
      We guard with the same ID so whichever page loads first wins. ── */
if (!document.getElementById('poppins-font')) {
  const l = document.createElement('link')
  l.id = 'poppins-font'; l.rel = 'stylesheet'
  l.href = 'https://fonts.googleapis.com/css2?family=Poppins:wght@400;500;600;700&display=swap'
  document.head.appendChild(l)
}
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
    .fac-card {
      background:#fff; border-radius:14px; padding:20px 24px;
      box-shadow:var(--shadow-sm); border:1px solid var(--border);
    }
  `
  document.head.appendChild(s)
}

const DAYS = ['Monday','Tuesday','Wednesday','Thursday','Friday','Saturday']

/* ── Sidebar (duplicated here so this page is self-contained) ── */
function FacultySidebar({ user, initials, onLogout }) {
  return (
    <aside style={{
      width:220, flexShrink:0,
      background:'linear-gradient(170deg,#1D6B50 0%,#0D4A38 100%)',
      display:'flex', flexDirection:'column',
      boxShadow:'4px 0 24px rgba(13,74,56,0.22)', zIndex:20,
    }}>
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

/* ── Section heading helper ── */
function SectionLabel({ children }) {
  return (
    <div style={{
      fontSize:9.5, fontWeight:700, letterSpacing:'1.6px',
      textTransform:'uppercase', color:'#8883B0', marginBottom:10,
    }}>
      {children}
    </div>
  )
}

/* ── Time formatter: 8.5 → "08:30" ── */
function fmtHour(h) {
  const hi = Math.floor(h)
  const mi = h % 1 === 0.5 ? '30' : '00'
  return `${String(hi).padStart(2,'0')}:${mi}`
}

export default function PreferencesPage() {
  const { user }  = useAuth()
  const navigate  = useNavigate()

  const [facultyId,          setFacultyId]          = useState(null)
  const [preferredDays,      setPreferredDays]      = useState([])
  const [preferredStart,     setPreferredStart]     = useState(7)
  const [preferredEnd,       setPreferredEnd]       = useState(17)
  const [maxConsecutive,     setMaxConsecutive]     = useState(4)
  const [saving,             setSaving]             = useState(false)
  const [saved,              setSaved]              = useState(false)
  const [loading,            setLoading]            = useState(true)
  const [error,              setError]              = useState('')

  const initials = user?.email ? user.email.slice(0, 2).toUpperCase() : 'FA'

  async function handleLogout() {
    await signOut(auth)
    navigate('/login')
  }

  useEffect(() => {
    if (!user) return
    getFaculty()
      .then(list => {
        const match = list.find(f => f.email === user.email || f.id === user.uid)
        if (match) {
          setFacultyId(match.id)
          setPreferredDays(match.preferredDays         || [])
          setPreferredStart(match.preferredTimeStart   ?? 7)
          setPreferredEnd(  match.preferredTimeEnd     ?? 17)
          setMaxConsecutive(match.maxConsecutiveHours  ?? 4)
        }
      })
      .catch(() => setError('Could not load your profile. Please refresh.'))
      .finally(() => setLoading(false))
  }, [user])

  function toggleDay(day) {
    setPreferredDays(d =>
      d.includes(day) ? d.filter(x => x !== day) : [...d, day]
    )
  }

  async function handleSave() {
    if (!facultyId) { setError('Faculty profile not found. Contact the admin.'); return }
    setSaving(true); setError('')
    try {
      await updatePreferences(facultyId, {
        preferredDays,
        preferredTimeStart:  Number(preferredStart),
        preferredTimeEnd:    Number(preferredEnd),
        maxConsecutiveHours: Number(maxConsecutive),
      })
      setSaved(true)
      setTimeout(() => setSaved(false), 2500)
    } catch {
      setError('Failed to save. Please try again.')
    } finally {
      setSaving(false)
    }
  }

  if (loading) return (
    <div style={{ display:'flex', minHeight:'100vh', fontFamily:"'Poppins',sans-serif" }}>
      <FacultySidebar user={user} initials={initials} onLogout={handleLogout} />
      <div style={{ flex:1, display:'flex', alignItems:'center', justifyContent:'center', background:'#F5F4FB' }}>
        <div style={{ textAlign:'center' }}>
          <div style={{ width:36, height:36, border:'3px solid #1D9E75', borderTopColor:'transparent', borderRadius:'50%', animation:'spin 0.8s linear infinite', margin:'0 auto 12px' }}/>
          <p style={{ fontSize:13, color:'#8883B0' }}>Loading preferences…</p>
        </div>
        <style>{`@keyframes spin { to { transform:rotate(360deg) } }`}</style>
      </div>
    </div>
  )

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
              Scheduling preferences
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
              Scheduling preferences
            </h1>
            <p style={{ fontSize:13, color:'#8883B0' }}>
              Soft constraints — the solver will do its best to honor these when generating the next schedule.
            </p>
          </div>

          {/* Info banner */}
          <div style={{
            background:'#E1F5EE', border:'1px solid #9FE1CB',
            borderRadius:10, padding:'12px 16px',
            display:'flex', gap:10, alignItems:'flex-start', marginBottom:24,
          }}>
            <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="#0F6E56" strokeWidth="2" style={{ flexShrink:0, marginTop:1 }}>
              <circle cx="12" cy="12" r="10"/><line x1="12" y1="8" x2="12" y2="12"/><line x1="12" y1="16" x2="12.01" y2="16"/>
            </svg>
            <p style={{ fontSize:12, color:'#085041', lineHeight:1.5 }}>
              These preferences apply to the <strong>next</strong> schedule generation. Your current assignments may differ from what is set here.
            </p>
          </div>

          <div style={{ maxWidth:560 }}>

            {/* ── Preferred days ── */}
            <SectionLabel>Preferred teaching days</SectionLabel>
            <div className="fac-card" style={{ marginBottom:20 }}>
              <div style={{ display:'flex', gap:8, flexWrap:'wrap' }}>
                {DAYS.map(day => {
                  const on = preferredDays.includes(day)
                  return (
                    <button
                      key={day} type="button" onClick={() => toggleDay(day)}
                      style={{
                        padding:'7px 16px', borderRadius:99,
                        fontSize:12.5, fontWeight:500,
                        fontFamily:"'Poppins',sans-serif",
                        cursor:'pointer', transition:'all 0.15s',
                        background: on ? '#1D9E75' : '#fff',
                        color:      on ? '#fff'    : '#8883B0',
                        border:     on ? '1px solid #1D9E75' : '1px solid #E8E4F8',
                      }}
                    >
                      {day}
                    </button>
                  )
                })}
              </div>
              <p style={{ fontSize:11.5, color:'#8883B0', marginTop:12 }}>
                {preferredDays.length === 0
                  ? 'No days selected — any day may be assigned.'
                  : `${preferredDays.length} day${preferredDays.length > 1 ? 's' : ''} selected: ${preferredDays.join(', ')}`}
              </p>
            </div>

            {/* ── Preferred time window ── */}
            <SectionLabel>Preferred time window</SectionLabel>
            <div className="fac-card" style={{ marginBottom:20 }}>
              <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr', gap:16 }}>
                <div>
                  <label style={{ fontSize:11, fontWeight:600, color:'#8883B0', display:'block', marginBottom:6, letterSpacing:'0.04em' }}>
                    EARLIEST START (hour)
                  </label>
                  <input
                    type="number" min={6} max={20} step={0.5}
                    value={preferredStart}
                    onChange={e => setPreferredStart(Number(e.target.value))}
                    style={{
                      width:'100%', padding:'9px 12px', borderRadius:9,
                      border:'1px solid #E8E4F8', fontFamily:"'Poppins',sans-serif",
                      fontSize:13, color:'#1a1a2e', background:'#fff', outline:'none',
                    }}
                    onFocus={e => e.target.style.borderColor='#1D9E75'}
                    onBlur={e  => e.target.style.borderColor='#E8E4F8'}
                  />
                </div>
                <div>
                  <label style={{ fontSize:11, fontWeight:600, color:'#8883B0', display:'block', marginBottom:6, letterSpacing:'0.04em' }}>
                    LATEST END (hour)
                  </label>
                  <input
                    type="number" min={7} max={21} step={0.5}
                    value={preferredEnd}
                    onChange={e => setPreferredEnd(Number(e.target.value))}
                    style={{
                      width:'100%', padding:'9px 12px', borderRadius:9,
                      border:'1px solid #E8E4F8', fontFamily:"'Poppins',sans-serif",
                      fontSize:13, color:'#1a1a2e', background:'#fff', outline:'none',
                    }}
                    onFocus={e => e.target.style.borderColor='#1D9E75'}
                    onBlur={e  => e.target.style.borderColor='#E8E4F8'}
                  />
                </div>
              </div>
              <div style={{
                marginTop:14, padding:'10px 14px', background:'#F5F4FB',
                borderRadius:8, display:'flex', alignItems:'center', gap:8,
              }}>
                <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="#8883B0" strokeWidth="2">
                  <circle cx="12" cy="12" r="10"/><polyline points="12 6 12 12 16 14"/>
                </svg>
                <span style={{ fontSize:12, color:'#8883B0', fontFamily:'monospace', fontWeight:600 }}>
                  {fmtHour(preferredStart)} – {fmtHour(preferredEnd)}
                </span>
              </div>
            </div>

            {/* ── Max consecutive hours ── */}
            <SectionLabel>Max consecutive teaching hours</SectionLabel>
            <div className="fac-card" style={{ marginBottom:28 }}>
              <div style={{ display:'flex', alignItems:'center', gap:16, marginBottom:10 }}>
                <input
                  type="range" min={1} max={8} step={0.5}
                  value={maxConsecutive}
                  onChange={e => setMaxConsecutive(Number(e.target.value))}
                  style={{ flex:1, accentColor:'#1D9E75', height:4 }}
                />
                <div style={{
                  minWidth:52, textAlign:'center', padding:'6px 12px',
                  background:'#1D9E75', borderRadius:8,
                  fontSize:15, fontWeight:700, color:'#fff',
                }}>
                  {maxConsecutive}h
                </div>
              </div>

              {/* Visual scale */}
              <div style={{ display:'flex', justifyContent:'space-between', marginBottom:12 }}>
                {[1,2,3,4,5,6,7,8].map(n => (
                  <div key={n} style={{ textAlign:'center' }}>
                    <div style={{
                      width:6, height:6, borderRadius:'50%', margin:'0 auto 3px',
                      background: n <= maxConsecutive ? '#1D9E75' : '#E8E4F8',
                      transition:'background 0.15s',
                    }}/>
                    <span style={{ fontSize:9, color:'#8883B0' }}>{n}</span>
                  </div>
                ))}
              </div>

              <p style={{ fontSize:12, color:'#8883B0', lineHeight:1.5 }}>
                The solver will try to avoid scheduling you for more than{' '}
                <strong style={{ color:'#1a1a2e' }}>{maxConsecutive} consecutive hour{maxConsecutive !== 1 ? 's' : ''}</strong>.
              </p>
            </div>

            {/* Error */}
            {error && (
              <div style={{
                background:'#FFF0F0', border:'1px solid #FECACA', borderRadius:9,
                padding:'10px 14px', fontSize:12.5, color:'#C0392B', marginBottom:16,
              }}>
                {error}
              </div>
            )}

            {/* Save button */}
            <button
              onClick={handleSave}
              disabled={saving}
              style={{
                width:'100%', padding:'12px',
                background: saved ? '#085041' : '#1D9E75',
                color:'#fff', border:'none', borderRadius:9,
                fontSize:14, fontWeight:600, fontFamily:"'Poppins',sans-serif",
                cursor: saving ? 'not-allowed' : 'pointer',
                opacity: saving ? 0.8 : 1,
                transition:'all 0.2s', letterSpacing:'0.01em',
              }}
            >
              {saving ? 'Saving…' : saved ? '✓ Preferences saved!' : 'Save preferences'}
            </button>

            {saved && (
              <p style={{ textAlign:'center', fontSize:12, color:'#1D9E75', marginTop:10, fontWeight:500 }}>
                Your preferences will be applied on the next schedule generation.
              </p>
            )}
          </div>
        </main>
      </div>
    </div>
  )
}