import { useState, useEffect, useRef } from 'react'
import { signInWithEmailAndPassword } from 'firebase/auth'
import { auth } from '../services/firebase'
import { useNavigate } from 'react-router-dom'
import logoImg  from '../assets/ASSIGNAV2.png'
import icon1Img from '../assets/ASSIGNAV1.png'

/* ─── styles ────────────────────────────────────────────────────────────────── */
{
  let s = document.getElementById('login-page-style')
  if (!s) {
    s = document.createElement('style')
    s.id = 'login-page-style'
    document.head.appendChild(s)
  }
  s.textContent = `
    @import url('https://fonts.googleapis.com/css2?family=Sora:wght@600;700;800&family=Inter:wght@400;500;600;700&display=swap');
    *, *::before, *::after { box-sizing: border-box; margin: 0; padding: 0; }
    button {
      font: inherit; color: inherit; background: none; cursor: pointer;
      -webkit-appearance: none; -moz-appearance: none; appearance: none;
    }
    button::-moz-focus-inner { border: 0; padding: 0; }
    /* index.css defines a global button:hover { background: var(--hover) } which otherwise
       wins on the background property alone for any hover rule below that doesn't redeclare it */
    .login-root button:hover { background: none; }

    .login-root {
      --forest:      #0A2E1C;
      --meadow:      #15803D;
      --meadow-deep: #0F5C2C;
      --mint:        #6EE7B7;
      --ink:         #0E2A20;
      --mist:        #F3F8F4;
      --paper:       #FFFFFF;
      --line:        #DCE7DF;
      --slate:       #54655B;
      --slate-soft:  #8FA398;
      --danger:      #C0392B;
      --danger-bg:   #FDF1EF;
      --danger-line: #F3C8C0;
      min-height: 100vh; height: 100vh;
      display: flex; font-family: 'Inter', sans-serif;
      color: var(--ink); overflow: hidden;
    }

    /* ══ LEFT PANEL ══ */
    .login-panel {
      width: 480px; flex-shrink: 0;
      background: var(--forest);
      display: flex; flex-direction: column;
      position: relative; overflow: hidden;
    }
    @media (max-width: 900px) { .login-panel { display: none; } }

    .panel-inner {
      position: relative; z-index: 1;
      display: flex; flex-direction: column;
      height: 100%; padding: 36px 40px 32px;
    }

    .panel-brand {
      display: flex; align-items: center; gap: 11px;
      flex-shrink: 0; margin-bottom: 0;
    }
    .panel-brand img { width: 28px; height: 28px; object-fit: contain; }
    .panel-brand-name {
      font-family: 'Sora', sans-serif;
      font-size: 12.5px; font-weight: 800; color: #fff;
      letter-spacing: 1.4px; text-transform: uppercase; display: block;
    }
    .panel-brand-sub {
      font-size: 8px; font-weight: 500;
      color: rgba(255,255,255,0.38);
      letter-spacing: .8px; text-transform: uppercase; display: block; margin-top: 2px;
    }

    /* ── HERO ── */
    .panel-hero {
      flex: 1; display: flex; flex-direction: column;
      justify-content: center; min-height: 0;
    }
    .hero-tag {
      font-size: 10px; font-weight: 600; color: var(--mint);
      letter-spacing: 1px; text-transform: uppercase; margin-bottom: 12px;
    }
    .hero-heading {
      font-family: 'Sora', sans-serif;
      font-size: 25px; font-weight: 700; color: rgba(255,255,255,0.94);
      line-height: 1.28; letter-spacing: -.3px; margin-bottom: 10px; max-width: 320px;
    }
    .hero-heading em { font-style: normal; color: var(--mint); font-weight: 700; }
    .hero-sub {
      font-size: 12.5px; color: rgba(255,255,255,0.50);
      line-height: 1.65; max-width: 300px; font-weight: 400; margin-bottom: 28px;
    }

    .hero-visual { width: 100%; }

    .panel-footer {
      padding-top: 20px; flex-shrink: 0;
      font-size: 9.5px; font-weight: 500;
      color: rgba(255,255,255,0.20); letter-spacing: .3px;
    }

    /* ═══════════════════════════════════
       VISUAL 1 — timetable grid
    ═══════════════════════════════════ */
    .vis-grid {
      width: 100%; background: rgba(0,0,0,0.14);
      border-radius: 8px; overflow: hidden;
    }
    .vg-days {
      display: grid; grid-template-columns: 34px repeat(5,1fr);
      border-bottom: 1px solid rgba(255,255,255,0.08);
    }
    .vg-day {
      padding: 7px 4px; text-align: center;
      font-size: 8px; font-weight: 700; letter-spacing: .9px;
      color: rgba(255,255,255,0.38); text-transform: uppercase;
      border-left: 1px solid rgba(255,255,255,0.06);
    }
    .vg-day:first-child { border-left: none; }
    .vg-rows { display: flex; flex-direction: column; }
    .vg-row {
      display: grid; grid-template-columns: 34px repeat(5,1fr);
      border-bottom: 1px solid rgba(255,255,255,0.05);
    }
    .vg-row:last-child { border-bottom: none; }
    .vg-time {
      padding: 0 5px;
      display: flex; align-items: center; justify-content: flex-end;
      font-size: 7px; font-weight: 600; color: rgba(255,255,255,0.25);
      white-space: nowrap;
    }
    .vg-cell {
      border-left: 1px solid rgba(255,255,255,0.05);
      padding: 2.5px; min-height: 32px;
      display: flex; align-items: stretch;
    }
    .vg-block {
      flex: 1; border-radius: 4px;
      display: flex; flex-direction: column;
      justify-content: center; padding: 3px 5px;
      opacity: 0; transform: scale(0.82);
      transition: opacity 0.3s ease, transform 0.3s ease;
    }
    .vg-block.vb-placed { opacity: 1; transform: scale(1); }
    .vg-block.vb-a { background: rgba(110,231,183,0.24); color: #C3FCE3; }
    .vg-block.vb-b { background: rgba(21,128,61,0.55);  color: #C3FCE3; }
    .vg-block.vb-c { background: rgba(255,255,255,0.09); color: rgba(255,255,255,0.68); }
    .vg-block.vb-d { background: rgba(52,211,153,0.20); color: #C3FCE3; }
    .vg-code { font-size: 7.5px; font-weight: 700; letter-spacing: .3px; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
    .vg-room { font-size: 6.5px; font-weight: 500; opacity: .65; margin-top: 1.5px; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }

    /* ══ RIGHT FORM SIDE ══ */
    .login-form-side {
      flex: 1; display: flex; align-items: center; justify-content: center;
      padding: 22px 32px;
      background: #EFF5F1;
      background-image:
        linear-gradient(rgba(21,128,61,0.03) 1px, transparent 1px),
        linear-gradient(90deg, rgba(21,128,61,0.03) 1px, transparent 1px);
      background-size: 20px 20px;
      background-position: center center;
      overflow-y: auto;
    }
    .login-card {
      position: relative; z-index: 1;
      width: 100%; max-width: 380px;
      background: var(--paper); border-radius: 18px;
      padding: 24px 26px 22px;
      box-shadow: 0 1px 3px rgba(15,56,40,0.04), 0 12px 36px rgba(15,56,40,0.10), 0 0 0 1px rgba(15,56,40,0.05);
      animation: fadeUp .3s ease both;
    }
    @media (prefers-reduced-motion: reduce) { .login-card { animation: none; } }
    .card-logo-wrap { display: flex; justify-content: center; margin-bottom: 8px; }
    .card-logo-wrap img { width: 88px; height: auto; object-fit: contain; }
    .card-heading { margin-bottom: 12px; }
    .card-heading h1 {
      font-family: 'Sora', sans-serif;
      font-size: 18px; font-weight: 800; color: var(--ink);
      letter-spacing: -.35px; margin-bottom: 3px;
    }
    .card-heading p { font-size: 11.5px; color: var(--slate); font-weight: 500; }
    .card-divider { height: 1px; background: var(--line); margin-bottom: 14px; }

    .role-selector-wrap { margin-bottom: 14px; }
    .role-selector-label { font-size: 11.5px; font-weight: 600; color: var(--ink); display: block; margin-bottom: 7px; }
    .role-selector {
      display: flex; gap: 5px; padding: 4px;
      background: var(--mist); border-radius: 11px; border: 1.5px solid var(--line);
    }
    .role-option {
      flex: 1; padding: 7.5px 8px; border-radius: 8px;
      background: transparent; border: none;
      font-family: 'Inter', sans-serif; font-size: 12px; font-weight: 600;
      color: var(--slate); cursor: pointer; transition: all 0.2s ease;
      display: flex; align-items: center; justify-content: center; gap: 6px;
    }
    .role-option:hover:not(.role-option-active) { background: #A7F0C4; color: var(--meadow-deep); }
    .role-option:focus-visible { outline: 2px solid var(--meadow); outline-offset: 2px; }
    .role-option-active {
      background: linear-gradient(135deg, var(--meadow) 0%, var(--meadow-deep) 100%);
      color: #fff; box-shadow: 0 2px 10px rgba(21,128,61,0.28);
    }
    .role-option-active:hover {
      background: #0F5C2C;
      color: #0F5C2C;
    }

    .login-label { font-size: 11.5px; font-weight: 600; color: var(--ink); display: block; margin-bottom: 5px; }
    .login-field { position: relative; }
    .login-field-icon {
      position: absolute; left: 13px; top: 50%; transform: translateY(-50%);
      color: var(--slate-soft); pointer-events: none; display: flex; align-items: center;
      transition: color 0.15s;
    }
    .login-input {
      width: 100%; padding: 9.5px 13px 9.5px 40px;
      border-radius: 10px; border: 1.5px solid var(--line);
      font-family: 'Inter', sans-serif; font-size: 13px; color: var(--ink);
      background: #FBFDFC; outline: none;
      transition: border-color 0.15s, box-shadow 0.15s;
    }
    .login-input:focus { border-color: var(--meadow); box-shadow: 0 0 0 3px rgba(21,128,61,0.13); background: #fff; }
    .login-field:focus-within .login-field-icon { color: var(--meadow-deep); }
    .login-input::placeholder { color: #A9BDB1; }
    .pw-toggle {
      position: absolute; right: 11px; top: 50%; transform: translateY(-50%);
      background: none; border: none; cursor: pointer;
      color: var(--slate-soft); display: flex; align-items: center; padding: 4px;
      transition: color 0.15s;
    }
    .pw-toggle:hover { color: var(--meadow-deep); }

    .login-btn {
      width: 100%; padding: 10.5px; border-radius: 10px; border: none;
      background: linear-gradient(135deg, var(--meadow) 0%, var(--meadow-deep) 100%);
      color: #fff; font-family: 'Inter', sans-serif;
      font-size: 13.5px; font-weight: 600; cursor: pointer;
      display: flex; align-items: center; justify-content: center; gap: 8px;
      transition: transform 0.12s, box-shadow 0.15s;
      box-shadow: 0 4px 16px rgba(15,92,44,0.30); letter-spacing: .2px;
    }
    .login-btn:hover:not(:disabled) {
      background: linear-gradient(135deg, var(--meadow) 0%, var(--meadow-deep) 100%);
      transform: translateY(-1px); box-shadow: 0 6px 20px rgba(15,92,44,0.40);
    }
    .login-btn:active:not(:disabled) { transform: translateY(0); }
    .login-btn:disabled { opacity: .6; cursor: default; box-shadow: none; }

    .login-error {
      display: flex; align-items: center; gap: 9px;
      padding: 9px 13px; border-radius: 10px;
      background: var(--danger-bg); border: 1px solid var(--danger-line);
      font-size: 12px; color: var(--danger);
      animation: errShake 0.35s ease;
    }
    @media (max-width: 480px) {
      .login-form-side { padding: 16px; }
      .login-card { padding: 22px 18px 20px; border-radius: 16px; }
    }
    @keyframes errShake { 0%,100%{transform:translateX(0)} 20%{transform:translateX(-5px)} 60%{transform:translateX(5px)} }
    @keyframes spin-login { to { transform: rotate(360deg); } }
    @keyframes fadeUp { from{opacity:0;transform:translateY(12px)} to{opacity:1;transform:translateY(0)} }
  `
}

/* ─── Visual 1: Animated timetable ──────────────────────────────────────────── */
const TT_TIMES = ['7 AM','8 AM','9 AM','10 AM','11 AM','12 PM']
const TT_DAYS  = ['MON','TUE','WED','THU','FRI']
const TT_DATA  = [
  [null,              {code:'CS 101',room:'L201',v:'a'}, null,                       null,              null             ],
  [{code:'CS 311',room:'Lab1',v:'b'}, null,             null,                       null,              {code:'EMC 201',room:'L104',v:'d'}],
  [null,              {code:'IT 301',room:'L402',v:'c'}, null,                      {code:'CS 401',room:'L201',v:'a'}, null],
  [{code:'EMC 301',room:'Lab2',v:'d'}, null,            null,                       null,              {code:'IT 101',room:'L201',v:'c'}],
  [null,              null,            {code:'IT 401',room:'L104',v:'b'},            null,              null             ],
  [{code:'CS 201',room:'L402',v:'c'}, null,             {code:'CS 101',room:'L201',v:'a'}, null,       null             ],
]

function TimetableVis() {
  const [placed, setPlaced] = useState(() => TT_DATA.map(r => r.map(() => false)))
  const timerRef = useRef(null)

  useEffect(() => {
    const positions = []
    TT_DATA.forEach((row, r) => row.forEach((cell, c) => { if (cell) positions.push([r,c]) }))
    let i = 0
    const tick = () => {
      if (i >= positions.length) return
      const [r, c] = positions[i++]
      setPlaced(prev => { const n = prev.map(row => [...row]); n[r][c] = true; return n })
      timerRef.current = setTimeout(tick, 90)
    }
    timerRef.current = setTimeout(tick, 300)
    return () => clearTimeout(timerRef.current)
  }, [])

  return (
    <div className="vis-grid">
      <div className="vg-days">
        <div className="vg-day" />
        {TT_DAYS.map(d => <div key={d} className="vg-day">{d}</div>)}
      </div>
      <div className="vg-rows">
        {TT_DATA.map((row, r) => (
          <div key={r} className="vg-row">
            <div className="vg-time">{TT_TIMES[r]}</div>
            {row.map((cell, c) => (
              <div key={c} className="vg-cell">
                {cell && (
                  <div className={`vg-block vb-${cell.v}${placed[r][c] ? ' vb-placed' : ''}`}>
                    <span className="vg-code">{cell.code}</span>
                    <span className="vg-room">{cell.room}</span>
                  </div>
                )}
              </div>
            ))}
          </div>
        ))}
      </div>
    </div>
  )
}

/* ─── Main LoginPage ─────────────────────────────────────────────────────────── */
export default function LoginPage() {
  const [email,        setEmail]        = useState('')
  const [password,     setPassword]     = useState('')
  const [selectedRole, setSelectedRole] = useState('faculty')
  const [showPw,       setShowPw]       = useState(false)
  const [error,        setError]        = useState('')
  const [loading,      setLoading]      = useState(false)
  const navigate = useNavigate()

  async function handleLogin(e) {
    e.preventDefault()
    if (loading) return
    setError('')
    setLoading(true)
    try {
      const result = await signInWithEmailAndPassword(auth, email.trim(), password)
      const token  = await result.user.getIdTokenResult()
      const userRole      = token.claims.role
      const isCoordinator = token.claims.isCoordinator || false

      if (selectedRole === 'admin') {
        if (userRole !== 'admin') { setError('This account is not registered as an Admin.'); await auth.signOut(); setLoading(false); return }
        navigate('/dashboard')
      } else if (selectedRole === 'coordinator') {
        if (userRole !== 'faculty' || !isCoordinator) { setError('Your account does not have coordinator access.'); await auth.signOut(); setLoading(false); return }
        navigate('/coordinator')
      } else if (selectedRole === 'faculty') {
        if (userRole !== 'faculty') { setError('Your account is not registered as Faculty.'); await auth.signOut(); setLoading(false); return }
        navigate('/schedule')
      } else {
        setError('Your account has no role assigned. Contact the admin.')
        await auth.signOut()
      }
    } catch (err) {
      switch (err?.code) {
        case 'auth/too-many-requests':
          setError('Too many attempts. Please wait a moment and try again.')
          break
        case 'auth/user-disabled':
          setError('This account has been disabled. Contact your administrator.')
          break
        case 'auth/network-request-failed':
          setError('Network error. Check your connection and try again.')
          break
        default:
          setError('Incorrect email or password.')
      }
    } finally {
      setLoading(false)
    }
  }

  const ROLES = [
    { id: 'admin',       label: 'Admin',
      icon: <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M12 2L2 7l10 5 10-5-10-5z"/><path d="M2 17l10 5 10-5"/><path d="M2 12l10 5 10-5"/></svg> },
    { id: 'coordinator', label: 'Coordinator',
      icon: <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><rect x="3" y="3" width="7" height="7"/><rect x="14" y="3" width="7" height="7"/><rect x="14" y="14" width="7" height="7"/><rect x="3" y="14" width="7" height="7"/></svg> },
    { id: 'faculty',     label: 'Faculty',
      icon: <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2"/><circle cx="12" cy="7" r="4"/></svg> },
  ]

  return (
    <div className="login-root">

      {/* ══ LEFT PANEL ══ */}
      <div className="login-panel">
        <div className="panel-inner">
          <div className="panel-brand">
            <img src={icon1Img} alt="Assigna" />
            <div>
              <span className="panel-brand-name">Assigna</span>
              <span className="panel-brand-sub">Academic Scheduler</span>
            </div>
          </div>

          <div className="panel-hero">
            <div className="hero-tag">Constraint solver</div>
            <h2 className="hero-heading">Every room, faculty member, and time slot resolved <em>without conflicts.</em></h2>
            <p className="hero-sub">Assigna checks room capacity, faculty load, and course requirements automatically — no manual cross-referencing.</p>
            <div className="hero-visual">
              <TimetableVis />
            </div>
          </div>

          <p className="panel-footer">College of Computing Studies · CCS</p>
        </div>
      </div>

      {/* ══ RIGHT FORM SIDE ══ */}
      <div className="login-form-side">
        <div className="login-card">

          <div className="card-logo-wrap">
            <img src={logoImg} alt="Assigna" />
          </div>

          <div className="card-heading">
            <h1>Welcome back</h1>
            <p>Sign in to manage schedules and faculty workloads.</p>
          </div>

          <div className="card-divider" />

          <form onSubmit={handleLogin} style={{ display:'flex', flexDirection:'column', gap:9 }}>

            <div className="role-selector-wrap">
              <label className="role-selector-label">Select your role</label>
              <div className="role-selector">
                {ROLES.map(r => (
                  <button
                    key={r.id} type="button"
                    className={`role-option${selectedRole === r.id ? ' role-option-active' : ''}`}
                    onClick={() => setSelectedRole(r.id)}
                    aria-pressed={selectedRole === r.id}
                    disabled={loading}
                  >
                    {r.icon}{r.label}
                  </button>
                ))}
              </div>
            </div>

            <div>
              <label className="login-label">Email address</label>
              <div className="login-field">
                <svg className="login-field-icon" width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                  <path d="M4 4h16c1.1 0 2 .9 2 2v12c0 1.1-.9 2-2 2H4c-1.1 0-2-.9-2-2V6c0-1.1.9-2 2-2z"/><polyline points="22,6 12,13 2,6"/>
                </svg>
                <input className="login-input" type="email" value={email}
                  onChange={e => setEmail(e.target.value)}
                  placeholder="you@ccs.edu" required autoComplete="email"
                  autoFocus disabled={loading} />
              </div>
            </div>

            <div>
              <label className="login-label">Password</label>
              <div className="login-field">
                <svg className="login-field-icon" width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                  <rect x="3" y="11" width="18" height="11" rx="2" ry="2"/><path d="M7 11V7a5 5 0 0 1 10 0v4"/>
                </svg>
                <input className="login-input" type={showPw ? 'text' : 'password'} value={password}
                  onChange={e => setPassword(e.target.value)}
                  placeholder="••••••••" required autoComplete="current-password"
                  disabled={loading}
                  style={{ paddingRight: 40 }} />
                <button type="button" className="pw-toggle" onClick={() => setShowPw(p => !p)}
                  tabIndex={-1} aria-label={showPw ? 'Hide password' : 'Show password'}>
                  {showPw ? (
                    <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                      <path d="M17.94 17.94A10.07 10.07 0 0 1 12 20c-7 0-11-8-11-8a18.45 18.45 0 0 1 5.06-5.94"/>
                      <path d="M9.9 4.24A9.12 9.12 0 0 1 12 4c7 0 11 8 11 8a18.5 18.5 0 0 1-2.16 3.19"/>
                      <line x1="1" y1="1" x2="23" y2="23"/>
                    </svg>
                  ) : (
                    <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                      <path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z"/>
                      <circle cx="12" cy="12" r="3"/>
                    </svg>
                  )}
                </button>
              </div>
            </div>

            {error && (
              <div className="login-error" role="alert">
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                  <circle cx="12" cy="12" r="10"/><line x1="12" y1="8" x2="12" y2="12"/><line x1="12" y1="16" x2="12.01" y2="16"/>
                </svg>
                {error}
              </div>
            )}

            <button type="submit" className="login-btn" disabled={loading} style={{ marginTop: 4 }}>
              {loading ? (
                <>
                  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"
                    style={{ animation: 'spin-login .8s linear infinite' }}>
                    <path d="M21 12a9 9 0 1 1-6.219-8.56"/>
                  </svg>
                  Signing in…
                </>
              ) : (
                <>
                  Sign in
                  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
                    <line x1="5" y1="12" x2="19" y2="12"/><polyline points="12 5 19 12 12 19"/>
                  </svg>
                </>
              )}
            </button>
          </form>

          <p style={{ marginTop:10, fontSize:10.5, color:'var(--slate-soft)', textAlign:'center', lineHeight:1.5, fontWeight:500 }}>
            Forgot your password? Contact your department administrator.
          </p>
          <p style={{ marginTop:3, fontSize:10, color:'var(--slate-soft)', textAlign:'center', lineHeight:1.5, fontWeight:500 }}>
            Access is restricted to registered faculty and administrators.
          </p>
        </div>
      </div>
    </div>
  )
}