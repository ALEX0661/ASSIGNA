import { useState, useEffect, useRef } from 'react'
import { signInWithEmailAndPassword } from 'firebase/auth'
import { auth } from '../services/firebase'
import { useNavigate } from 'react-router-dom'
import logoImg      from '../assets/ASSIGNAV2.png'
import icon1Img     from '../assets/ASSIGNAV1.png'
import buildingImg  from '../assets/gordon college building.png'

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

    .login-root {
      color-scheme: light !important;
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
      position: relative;
    }

    /* ══ SECURE LOGIN BADGE ══ */
    .secure-badge {
      position: absolute; top: 18px; right: 22px; z-index: 5;
      display: flex; align-items: center; gap: 9px;
      background: var(--paper); border-radius: 12px; padding: 7px 13px 7px 9px;
      box-shadow: 0 4px 16px rgba(15,56,40,0.10), 0 0 0 1px rgba(15,56,40,0.05);
    }
    .secure-badge-icon {
      width: 25px; height: 25px; border-radius: 50%; flex-shrink: 0;
      background: var(--meadow); color: #fff;
      display: flex; align-items: center; justify-content: center;
    }
    .secure-badge-icon svg { width: 13px; height: 13px; }
    .secure-badge-title { font-size: 10.5px; font-weight: 700; color: var(--ink); line-height: 1.3; }
    .secure-badge-sub   { font-size: 8.5px;  font-weight: 500; color: var(--slate-soft); line-height: 1.3; }
    @media (max-width: 760px) { .secure-badge { display: none; } }

    /* ══ LEFT PANEL ══ */
    .login-panel {
      width: 50%; flex-shrink: 0;
      background:
        radial-gradient(circle at top right, transparent 30%, rgba(10,46,28,0.85) 60%, rgba(10,46,28,0.98) 80%),
        url(${buildingImg}) center 15% / cover no-repeat;
      display: flex; flex-direction: column;
      position: relative; overflow: hidden;
    }

    /* Floating Squares Animation */
    .bg-squares {
      position: absolute; top: 0; left: 0;
      width: 100%; height: 100%; overflow: hidden;
      margin: 0; padding: 0; z-index: 0; pointer-events: none;
    }
    .bg-squares li {
      position: absolute; display: block; list-style: none;
      width: 20px; height: 20px; background: rgba(21, 128, 61, 0.08);
      border: 1px solid rgba(21, 128, 61, 0.15);
      border-radius: 12px;
      animation: floatUp 25s linear infinite;
      bottom: -200px;
    }
    .bg-squares li:nth-child(1) { left: 10%; width: 80px; height: 80px; animation-delay: 0s; animation-duration: 22s; border-radius: 16px; }
    .bg-squares li:nth-child(2) { left: 25%; width: 55px; height: 55px; animation-delay: 2s; animation-duration: 25s; border-radius: 10px; }
    .bg-squares li:nth-child(3) { left: 45%; width: 110px; height: 110px; animation-delay: 4s; animation-duration: 30s; border-radius: 24px; }
    .bg-squares li:nth-child(4) { left: 65%; width: 70px; height: 70px; animation-delay: 0s; animation-duration: 18s; border-radius: 14px; }
    .bg-squares li:nth-child(5) { left: 85%; width: 120px; height: 120px; animation-delay: 3s; animation-duration: 35s; border-radius: 28px; }
    .bg-squares li:nth-child(6) { left: 55%; width: 45px; height: 45px; animation-delay: 7s; animation-duration: 20s; border-radius: 8px; }
    .bg-squares li:nth-child(7) { left: 35%; width: 95px; height: 95px; animation-delay: 6s; animation-duration: 28s; border-radius: 20px; }
    .bg-squares li:nth-child(8) { left: 75%; width: 60px; height: 60px; animation-delay: 1s; animation-duration: 24s; border-radius: 12px; }

    @keyframes floatUp {
      0% { transform: translateY(0) rotate(0deg); opacity: 0; }
      10% { opacity: 1; }
      90% { opacity: 1; }
      100% { transform: translateY(-1200px) rotate(360deg); opacity: 0; }
    }

    @media (max-width: 900px) { .login-panel { display: none; } }

    .panel-inner {
      flex: 1; display: flex; flex-direction: column;
      padding: 50px 60px;
      position: relative; z-index: 1;
    }

    .panel-header-row { display: flex; justify-content: space-between; align-items: flex-start; }
    .panel-brand { display: flex; align-items: center; gap: 10px; }
    .panel-brand img { width: 28px; height: 28px; object-fit: contain; }
    .panel-brand-name { font-family: 'Sora', sans-serif; font-size: 16px; font-weight: 800; color: #fff; letter-spacing: 1px; text-transform: uppercase; display: block; line-height: 1.1; }
    .panel-brand-sub { font-size: 9px; font-weight: 500; color: rgba(255,255,255,0.6); text-transform: uppercase; letter-spacing: 1.5px; }

    .panel-tagline-container { text-align: right; }
    .panel-tagline { font-size: 10.5px; color: rgba(255,255,255,0.7); font-weight: 500; margin-top: 4px; }
    .panel-tagline-rule { display: block; width: 24px; height: 2px; background: var(--mint); margin-left: auto; border-radius: 2px; }

    /* ── HERO ── */
    .panel-hero {
      flex: 1; display: flex; flex-direction: column;
      justify-content: center; min-height: 0; margin-top: 24px;
    }
    .hero-heading {
      font-family: 'Sora', sans-serif;
      font-size: 22px; font-weight: 700; color: rgba(255,255,255,0.96);
      line-height: 1.25; letter-spacing: -.4px; margin-bottom: 12px; max-width: 420px;
    }
    .hero-heading em { font-style: normal; color: var(--mint); font-weight: 700; }
    .hero-sub {
      font-size: 11.5px; color: rgba(255,255,255,0.7);
      line-height: 1.6; max-width: 380px; font-weight: 400; margin-bottom: 32px;
    }

    .hero-visual { width: 100%; max-width: 520px; }

    .panel-footer {
      padding-top: 18px; flex-shrink: 0;
      display: flex; align-items: center; justify-content: space-between;
      border-top: 1px solid rgba(255,255,255,0.06);
    }
    .panel-footer-left {
      font-size: 10.5px; font-weight: 500; color: rgba(255,255,255,0.5);
      display: flex; align-items: center; gap: 7px;
    }
    .panel-footer-right { font-size: 9.5px; font-weight: 500; color: rgba(255,255,255,0.22); letter-spacing: .4px; }

    /* ═══════════════════════════════════
       Weekly schedule card
    ═══════════════════════════════════ */
    .schedule-card {
      width: 100%; background: rgba(0,0,0,0.22);
      border: 1px solid rgba(255,255,255,0.08);
      border-radius: 12px; overflow: hidden;
    }
    .schedule-card-header {
      display: flex; align-items: center; justify-content: space-between;
      padding: 10px 12px; border-bottom: 1px solid rgba(255,255,255,0.08);
    }
    .schedule-card-title { display: flex; align-items: center; gap: 8px; font-size: 12px; font-weight: 700; color: #fff; }
    .schedule-card-title svg { color: var(--mint); flex-shrink: 0; width: 14px; height: 14px; }
    .schedule-card-date { display: flex; align-items: center; gap: 8px; font-size: 10.5px; font-weight: 600; color: rgba(255,255,255,0.5); }
    .schedule-nav-btn {
      width: 18px; height: 18px; border-radius: 4px; flex-shrink: 0;
      display: flex; align-items: center; justify-content: center;
      background: rgba(255,255,255,0.08); color: rgba(255,255,255,0.55);
    }
    .schedule-nav-btn svg { width: 10px; height: 10px; }
    .vis-grid { width: 100%; }
    .vg-days {
      display: grid; grid-template-columns: 36px repeat(5,1fr);
      border-bottom: 1px solid rgba(255,255,255,0.08);
    }
    .vg-day {
      padding: 8px 4px; text-align: center;
      font-size: 9px; font-weight: 700; letter-spacing: .8px;
      color: rgba(255,255,255,0.38); text-transform: uppercase;
      border-left: 1px solid rgba(255,255,255,0.06);
    }
    .vg-day:first-child { border-left: none; }
    .vg-rows { display: flex; flex-direction: column; }
    .vg-row {
      display: grid; grid-template-columns: 36px repeat(5,1fr);
      border-bottom: 1px solid rgba(255,255,255,0.05);
    }
    .vg-row:last-child { border-bottom: none; }
    .vg-time {
      padding: 0 4px;
      display: flex; align-items: center; justify-content: flex-end;
      font-size: 7.5px; font-weight: 600; color: rgba(255,255,255,0.25);
      white-space: nowrap;
    }
    .vg-cell {
      border-left: 1px solid rgba(255,255,255,0.05);
      padding: 3px; min-height: 36px;
      display: flex; align-items: stretch;
    }
    .vg-block {
      flex: 1; border-radius: 5px;
      display: flex; flex-direction: column;
      justify-content: center; padding: 4px 6px;
      opacity: 0; transform: scale(0.82);
      transition: opacity 0.3s ease, transform 0.3s ease;
    }
    .vg-block.vb-placed { opacity: 1; transform: scale(1); }
    .vg-block.vb-a { background: rgba(110,231,183,0.24); color: #C3FCE3; }
    .vg-block.vb-b { background: rgba(21,128,61,0.55);  color: #C3FCE3; }
    .vg-block.vb-c { background: rgba(255,255,255,0.09); color: rgba(255,255,255,0.68); }
    .vg-block.vb-d { background: rgba(52,211,153,0.20); color: #C3FCE3; }
    .vg-code { font-size: 8.5px; font-weight: 700; letter-spacing: .3px; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
    .vg-room { font-size: 7px; font-weight: 500; opacity: .65; margin-top: 2px; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }

    .login-form-side {
      flex: 1; display: flex; align-items: center; justify-content: center;
      padding: 22px 32px;
      background-color: #ffffff;
      background-image: url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 1000 1000' preserveAspectRatio='xMaxYMid slice'%3E%3Cpath fill='%23e2ede7' d='M400,0 L1000,0 L1000,250 C800,250 600,100 400,0 Z' /%3E%3Cpath fill='%23d6e8dd' d='M200,1000 C400,800 700,750 1000,850 L1000,1000 Z' /%3E%3Cpath fill='%23cbe0d2' d='M500,1000 C700,850 850,850 1000,950 L1000,1000 Z' /%3E%3C/svg%3E");
      background-size: cover;
      background-position: center;
      background-repeat: no-repeat;
      position: relative;
      overflow: hidden;
      overflow-y: auto;
    }

    .login-card {
      width: 100%; max-width: 340px;
      background: #fff; border-radius: 16px;
      padding: 28px;
      box-shadow: 0 12px 40px rgba(0,0,0,0.06), 0 2px 10px rgba(0,0,0,0.02);
      border: 1px solid rgba(0,0,0,0.04);
      position: relative; z-index: 1;
    }
    @media (prefers-reduced-motion: reduce) { .login-card { animation: none; } }
    .card-logo-wrap { display: flex; justify-content: center; margin-bottom: 14px; }
    .card-logo-wrap img { width: 72px; height: auto; object-fit: contain; }
    .card-heading { margin-bottom: 20px; text-align: center; }
    .card-heading h1 {
      font-family: 'Sora', sans-serif;
      font-size: 20px; font-weight: 800; color: var(--ink);
      letter-spacing: -.5px; margin-bottom: 4px;
    }
    .card-heading p { font-size: 10.5px; color: var(--slate); font-weight: 500; }

    .role-selector-wrap { margin-bottom: 4px; }
    .role-selector {
      display: flex; gap: 4px; padding: 4px;
      background: #F3F8F4; border-radius: 9px;
    }
    .role-option {
      flex: 1; padding: 8px 6px; border-radius: 6px;
      background: transparent; border: none;
      font-family: 'Inter', sans-serif; font-size: 10.5px; font-weight: 600;
      color: var(--slate); cursor: pointer; transition: all 0.2s ease;
      display: flex; align-items: center; justify-content: center; gap: 5px;
    }
    .role-option svg { width: 12px; height: 12px; flex-shrink: 0; }
    .role-option:hover:not(.role-option-active) { background: rgba(21,128,61,0.06); color: var(--ink); }
    .role-option:focus-visible { outline: 2px solid var(--meadow); outline-offset: 2px; }
    .role-option-active {
      background: var(--meadow);
      color: #fff; box-shadow: 0 4px 12px rgba(21,128,61,0.25);
    }
    .role-option-active:hover { filter: brightness(1.1); }

    .login-label { font-size: 10px; font-weight: 600; color: var(--ink); display: block; margin-bottom: 4px; }
    .login-field { position: relative; }
    .login-field-icon {
      position: absolute; left: 12px; top: 50%; transform: translateY(-50%);
      color: var(--slate-soft); pointer-events: none; display: flex; align-items: center;
      transition: color 0.15s;
    }
    .login-input {
      width: 100%; padding: 10px 12px 10px 34px;
      border-radius: 8px; border: 1px solid var(--line);
      font-family: 'Inter', sans-serif; font-size: 12px; color: var(--ink);
      background: #FBFDFC; outline: none;
      transition: border-color 0.15s, box-shadow 0.15s;
    }
    .login-input:focus { border-color: var(--meadow); box-shadow: 0 0 0 3px rgba(21,128,61,0.13); background: #fff; }
    .login-field:focus-within .login-field-icon { color: var(--meadow-deep); }
    .login-input::placeholder { color: #A9BDB1; }
    .pw-toggle {
      position: absolute; right: 11px; top: 50%; transform: translateY(-50%);
      background: none; border: none; cursor: pointer;
      color: var(--slate-soft); display: flex; align-items: center; padding: 3px;
      transition: color 0.15s;
    }
    .pw-toggle:hover { color: var(--meadow-deep); }

    .login-btn {
      width: 100%; padding: 11.5px; border-radius: 8px; border: none;
      background: var(--meadow);
      color: #fff; font-family: 'Inter', sans-serif;
      font-size: 13.5px; font-weight: 600; cursor: pointer;
      display: flex; align-items: center; justify-content: center; gap: 8px;
      transition: transform 0.12s, box-shadow 0.15s, filter 0.15s;
      letter-spacing: .2px;
    }
    .login-btn:hover:not(:disabled) {
      filter: brightness(1.1);
      transform: translateY(-1px); box-shadow: 0 6px 20px rgba(21,128,61,0.35);
    }
    .login-btn:active:not(:disabled) { transform: translateY(0); }
    .login-btn:disabled { opacity: .6; cursor: default; box-shadow: none; }

    .divider-or {
      display: flex; align-items: center; gap: 8px;
      margin: 12px 0 8px; color: var(--slate-soft);
      font-size: 9px; font-weight: 700; letter-spacing: .5px;
    }
    .divider-or::before, .divider-or::after { content: ''; flex: 1; height: 1px; background: var(--line); }

    .forgot-btn {
      width: 100%; padding: 8px; border-radius: 8px;
      border: 1.5px solid var(--line); background: var(--mist);
      color: var(--ink); font-family: 'Inter', sans-serif;
      font-size: 11.5px; font-weight: 600; cursor: pointer;
      display: flex; align-items: center; justify-content: center; gap: 7px;
      transition: background 0.15s, border-color 0.15s;
    }
    .forgot-btn:hover { background: rgba(21,128,61,0.06); border-color: var(--meadow); }
    .forgot-btn svg { color: var(--meadow-deep); flex-shrink: 0; }

    .login-error {
      display: flex; align-items: center; gap: 8px;
      padding: 8px 11px; border-radius: 8px;
      background: var(--danger-bg); border: 1px solid var(--danger-line);
      font-size: 11px; color: var(--danger);
      animation: errShake 0.35s ease;
    }
    @media (max-width: 480px) {
      .login-form-side { padding: 14px; }
      .login-card { padding: 20px 16px 18px; border-radius: 14px; }
      .role-selector { flex-wrap: wrap; }
      .role-option { flex-basis: calc(50% - 3px); font-size: 10.5px; padding: 6px 4px; gap: 4px; }
      .role-option:last-child { flex-basis: 100%; }
    }
    @keyframes errShake { 0%,100%{transform:translateX(0)} 20%{transform:translateX(-5px)} 60%{transform:translateX(5px)} }
    @keyframes spin-login { to { transform: rotate(360deg); } }
    @keyframes fadeUp { from{opacity:0;transform:translateY(12px)} to{opacity:1;transform:translateY(0)} }
  `
}

/* ─── Weekly schedule preview card ──────────────────────────────────────────── */
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

function ScheduleCard() {
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
    <div className="schedule-card">
      <div className="schedule-card-header">
        <div className="schedule-card-title">
          <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
            <rect x="3" y="4" width="18" height="18" rx="2"/><line x1="16" y1="2" x2="16" y2="6"/><line x1="8" y1="2" x2="8" y2="6"/><line x1="3" y1="10" x2="21" y2="10"/>
          </svg>
          Weekly Schedule
        </div>
        <div className="schedule-card-date">
          Mon, 7 Apr 2025
          <span className="schedule-nav-btn" aria-hidden="true">
            <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"><polyline points="15 18 9 12 15 6"/></svg>
          </span>
          <span className="schedule-nav-btn" aria-hidden="true">
            <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"><polyline points="9 18 15 12 9 6"/></svg>
          </span>
        </div>
      </div>
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
      const finalEmail = email.includes('@') ? email.trim() : email.trim() + '@gordoncollege.edu.ph'
      const result = await signInWithEmailAndPassword(auth, finalEmail, password)
      const token  = await result.user.getIdTokenResult()
      const userRole      = token.claims.role
      const isCoordinator = token.claims.isCoordinator || false

      if (selectedRole === 'admin') {
        if (userRole !== 'admin') { setError('This account is not registered as a Dean.'); await auth.signOut(); setLoading(false); return }
        navigate('/dashboard')
      } else if (selectedRole === 'coordinator') {
        if (userRole !== 'faculty' || !isCoordinator) { setError('Your account does not have coordinator access.'); await auth.signOut(); setLoading(false); return }
        navigate('/coordinator')
      } else if (selectedRole === 'faculty') {
        if (userRole !== 'faculty') { setError('Your account is not registered as Faculty.'); await auth.signOut(); setLoading(false); return }
        navigate('/schedule')
      } else {
        setError('Your account has no role assigned. Contact the dean.')
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
    { id: 'admin',       label: 'Dean',
      icon: <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2"/><circle cx="12" cy="7" r="4"/></svg> },
    { id: 'coordinator', label: 'Coordinator',
      icon: <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2"/><circle cx="9" cy="7" r="4"/><path d="M23 21v-2a4 4 0 0 0-3-3.87"/><path d="M16 3.13a4 4 0 0 1 0 7.75"/></svg> },
    { id: 'faculty',     label: 'Faculty',
      icon: <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M22 10v6M2 10l10-5 10 5-10 5z"/><path d="M6 12v5c3 3 9 3 12 0v-5"/></svg> },
  ]

  return (
    <div className="login-root">



      {/* ══ LEFT PANEL ══ */}
      <div className="login-panel">
        <div className="panel-inner">
          <div className="panel-header-row">
            <div className="panel-brand">
              <img src={icon1Img} alt="Assigna" className="no-theme-filter" />
              <div>
                <span className="panel-brand-name">Assigna</span>
                <span className="panel-brand-sub">Academic Scheduler</span>
              </div>
            </div>
            <div className="panel-tagline-container">
              <span className="panel-tagline-rule" />
              <p className="panel-tagline">Smarter Scheduling for a Better Tomorrow</p>
            </div>
          </div>

          <div className="panel-hero">
            <h2 className="hero-heading">Every room, faculty member, and time slot resolved <em>without conflicts.</em></h2>
            <p className="hero-sub">Assigna checks room capacity, faculty load, and course requirements automatically — no manual cross-referencing.</p>



            <div className="hero-visual">
              <ScheduleCard />
            </div>
          </div>

          <div className="panel-footer">
            <div className="panel-footer-left">
              <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <path d="M22 10L12 5 2 10l10 5 10-5z"/><path d="M6 12v5c0 1.5 3 3 6 3s6-1.5 6-3v-5"/>
              </svg>
              Gordon College
            </div>
            <div className="panel-footer-right">Plan · Organize · Excel</div>
          </div>
        </div>
      </div>

      {/* ══ RIGHT FORM SIDE ══ */}
      <div className="login-form-side">
        <ul className="bg-squares" aria-hidden="true">
          <li /><li /><li /><li /><li /><li /><li /><li />
        </ul>

        <div className="login-card">

          <div className="card-logo-wrap">
            <img src={logoImg} alt="Assigna" className="no-theme-filter" />
          </div>

          <div className="card-heading">
            <h1>Welcome back</h1>
            <p>Sign in to manage your schedules and faculty workloads.</p>
          </div>

          <form onSubmit={handleLogin} style={{ display:'flex', flexDirection:'column', gap:14 }}>

            <div className="role-selector-wrap">

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
                <input className="login-input" type="text" value={email}
                  onChange={e => setEmail(e.target.value)}
                  placeholder="username" required autoComplete="email"
                  style={{ paddingRight: !email.includes('@') && email.length > 0 ? 150 : 12 }}
                  autoFocus disabled={loading} />
                {!email.includes('@') && email.length > 0 && (
                  <span style={{ position: 'absolute', right: 12, top: '50%', transform: 'translateY(-50%)', color: '#9CA3AF', fontSize: 12, pointerEvents: 'none' }}>
                    @gordoncollege.edu.ph
                  </span>
                )}
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
                  style={{ paddingRight: 34 }} />
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
                  Sign In
                  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
                    <line x1="5" y1="12" x2="19" y2="12"/><polyline points="12 5 19 12 12 19"/>
                  </svg>
                </>
              )}
            </button>


          </form>



          <p style={{ marginTop:20, fontSize:9.5, color:'var(--slate-soft)', textAlign:'center', lineHeight:1.5, fontWeight:500 }}>
            Contact your department administrator.
          </p>
          <p style={{ marginTop:2, fontSize:9, color:'var(--slate-soft)', textAlign:'center', lineHeight:1.5, fontWeight:500 }}>
            Access is restricted to registered faculty and administrators.
          </p>
        </div>
      </div>
    </div>
  )
}