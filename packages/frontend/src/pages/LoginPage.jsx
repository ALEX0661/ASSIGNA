import { useState } from 'react'
import { signInWithEmailAndPassword } from 'firebase/auth'
import { auth } from '../services/firebase'
import { useNavigate } from 'react-router-dom'
import logoImg  from '../assets/ASSIGNAV2.png'   // full logo WITH baked-in name + description
import icon1Img from '../assets/ASSIGNAV1.png'  // icon mark only, no text

/* ─── inject login styles once ─────────────────────────────────────────────── */
if (!document.getElementById('login-page-style')) {
  const s = document.createElement('style')
  s.id = 'login-page-style'
  s.textContent = `
    @import url('https://fonts.googleapis.com/css2?family=Poppins:wght@400;500;600;700;800&display=swap');

    *, *::before, *::after { box-sizing: border-box; margin: 0; padding: 0; }

    .login-root {
      min-height: 100vh;
      display: flex;
      font-family: 'Poppins', sans-serif;
    }

    /* ══════════════════════════════════
       LEFT PANEL
    ══════════════════════════════════ */
    .login-panel {
      width: 420px; flex-shrink: 0;
      background: linear-gradient(160deg, #4a3d9e 0%, #2d2468 45%, #1a1540 100%);
      display: flex; flex-direction: column;
      position: relative; overflow: hidden;
    }
    @media (max-width: 800px) { .login-panel { display: none; } }

    /* radial glow blobs */
    .login-panel::before {
      content: '';
      position: absolute; inset: 0; z-index: 0;
      background:
        radial-gradient(ellipse 70% 45% at 15% 8%,  rgba(160,140,240,0.25) 0%, transparent 65%),
        radial-gradient(ellipse 55% 55% at 85% 88%, rgba(100,80,200,0.20) 0%, transparent 65%),
        radial-gradient(ellipse 45% 35% at 50% 50%, rgba(130,110,220,0.08) 0%, transparent 65%);
    }
    /* grid texture */
    .login-panel::after {
      content: '';
      position: absolute; inset: 0; z-index: 0;
      background-image:
        linear-gradient(rgba(255,255,255,0.028) 1px, transparent 1px),
        linear-gradient(90deg, rgba(255,255,255,0.028) 1px, transparent 1px);
      background-size: 38px 38px;
    }

    /* 3-section layout: brand / hero / chips — no space-between, tight gaps */
    .login-panel-inner {
      position: relative; z-index: 1;
      display: flex; flex-direction: column;
      height: 100%;
      padding: 30px 36px 28px;
      justify-content: flex-start;
      gap: 0;
      overflow: hidden;   /* never scroll — everything must fit */
    }

    /* ── TOP: Brand row ── */
    .panel-brand {
      display: flex; align-items: center; gap: 11px;
      margin-bottom: 0;
      padding-bottom: 20px;
      border-bottom: 1px solid rgba(255,255,255,0.09);
      flex-shrink: 0;
    }
    .panel-brand img {
      width: 36px; height: 36px; object-fit: contain; flex-shrink: 0;
      filter: drop-shadow(0 3px 10px rgba(0,0,0,0.4));
    }
    .panel-brand-text { display: flex; flex-direction: column; gap: 2px; }
    .panel-brand-name {
      font-size: 15px; font-weight: 800; color: #fff;
      letter-spacing: 2.5px; text-transform: uppercase; line-height: 1;
    }
    .panel-brand-sub {
      font-size: 8.5px; font-weight: 600;
      color: rgba(255,255,255,0.68);
      letter-spacing: 1.8px; text-transform: uppercase;
    }

    /* ── MIDDLE: Hero copy — grows to fill all leftover space ── */
    .panel-hero {
      display: flex; flex-direction: column;
      flex: 1;                   /* ★ take up ALL remaining height */
      justify-content: center;   /* ★ centre content in that space */
      padding: 8px 0;
    }
    .panel-hero-eyebrow {
      display: inline-flex; align-items: center; gap: 7px;
      padding: 6px 14px; border-radius: 99px;
      background: rgba(255,255,255,0.09);
      border: 1px solid rgba(255,255,255,0.15);
      font-size: 10.5px; font-weight: 600; color: rgba(255,255,255,0.92);
      letter-spacing: .6px; margin-bottom: 20px;
      width: fit-content;
    }
    .panel-hero-dot {
      width: 6px; height: 6px; border-radius: 50%;
      background: #C4B8F5; flex-shrink: 0;
    }
    .panel-hero h2 {
      font-size: 34px; font-weight: 800; color: #fff;
      line-height: 1.18; letter-spacing: -.6px; margin-bottom: 16px;
    }
    .panel-hero h2 span { color: #C4B8F5; }
    .panel-hero p {
      font-size: 13px; color: rgba(255,255,255,0.84);
      line-height: 1.75; max-width: 320px;
    }

    /* ── BOTTOM: Feature chips ── */
    .panel-chips { display: flex; flex-direction: column; gap: 7px; flex-shrink: 0; }
    .panel-chips-label {
      font-size: 8.5px; font-weight: 700;
      color: rgba(255,255,255,0.52);
      letter-spacing: 2px; text-transform: uppercase;
      margin-bottom: 6px;
    }
    .panel-chip {
      display: flex; align-items: center; gap: 11px;
      padding: 10px 14px; border-radius: 10px;
      background: rgba(255,255,255,0.07);
      border: 1px solid rgba(255,255,255,0.10);
      backdrop-filter: blur(6px);
    }
    .panel-chip-icon {
      width: 30px; height: 30px; border-radius: 8px;
      background: rgba(169,155,232,0.18);
      border: 1px solid rgba(169,155,232,0.28);
      display: flex; align-items: center; justify-content: center;
      flex-shrink: 0; color: #C4B8F5;
    }
    .panel-chip-text { display: flex; flex-direction: column; gap: 2px; }
    .panel-chip-title {
      font-size: 12px; color: rgba(255,255,255,0.95);
      font-weight: 600; line-height: 1;
    }
    .panel-chip-sub {
      font-size: 10px; color: rgba(255,255,255,0.60);
      font-weight: 400;
    }

    /* ══════════════════════════════════
       RIGHT FORM SIDE
    ══════════════════════════════════ */
    .login-form-side {
      flex: 1; display: flex; align-items: center; justify-content: center;
      padding: 40px 32px;
      background: #F0EEF9;
      background-image:
        radial-gradient(ellipse 80% 60% at 0% 0%,    rgba(169,155,232,0.13) 0%, transparent 60%),
        radial-gradient(ellipse 60% 60% at 100% 100%, rgba(124,111,205,0.09) 0%, transparent 60%);
      position: relative;
    }
    .login-form-side::before {
      content: '';
      position: absolute; inset: 0; z-index: 0;
      background-image: radial-gradient(circle, rgba(124,111,205,0.13) 1px, transparent 1px);
      background-size: 24px 24px;
    }

    /* White card */
    .login-card {
      position: relative; z-index: 1;
      width: 100%; max-width: 390px;
      background: #fff;
      border-radius: 20px;
      padding: 30px 32px;
      box-shadow:
        0 4px 6px rgba(61,53,128,0.04),
        0 14px 44px rgba(61,53,128,0.11),
        0 0 0 1px rgba(61,53,128,0.06);
      animation: fadeUp .3s ease both;
    }

    /* Logo — full image with baked-in name + subtitle, no separate text */
    .card-logo-wrap {
      display: flex; justify-content: center; align-items: center;
      margin-bottom: 14px;
    }
    .card-logo-wrap img {
      width: 130px; height: auto; object-fit: contain;
    }

    .card-heading { margin-bottom: 16px; }
    .card-heading h1 {
      font-size: 19px; font-weight: 800; color: #1a1a2e;
      letter-spacing: -.4px; margin-bottom: 4px;
    }
    .card-heading p { font-size: 12px; color: #6D67A8; font-weight: 500; }

    .card-divider { height: 1px; background: #EDE9F9; margin-bottom: 16px; }

    .login-label {
      font-size: 11.5px; font-weight: 600; color: #3D3580;
      display: block; margin-bottom: 7px; letter-spacing: .2px;
    }

    .login-field { position: relative; }
    .login-field-icon {
      position: absolute; left: 13px; top: 50%; transform: translateY(-50%);
      color: #9490BB; pointer-events: none; display: flex; align-items: center;
      transition: color 0.15s;
    }
    .login-input {
      width: 100%; padding: 11px 13px 11px 40px;
      border-radius: 11px; border: 1.5px solid #E8E4F8;
      font-family: 'Poppins', sans-serif; font-size: 13px;
      color: #1a1a2e; background: #FAFAFE; outline: none;
      transition: border-color 0.15s, box-shadow 0.15s, background 0.15s;
      box-sizing: border-box;
    }
    .login-input:focus {
      border-color: #A99BE8;
      box-shadow: 0 0 0 3.5px rgba(169,155,232,0.18);
      background: #fff;
    }
    .login-field:focus-within .login-field-icon { color: #7C6FCD; }
    .login-input::placeholder { color: #B0ABCE; }

    .pw-toggle {
      position: absolute; right: 12px; top: 50%; transform: translateY(-50%);
      background: none; border: none; cursor: pointer;
      color: #9490BB; display: flex; align-items: center; padding: 3px;
      transition: color 0.15s;
    }
    .pw-toggle:hover { color: #7C6FCD; }

    .login-btn {
      width: 100%; padding: 12px;
      border-radius: 11px; border: none;
      background: linear-gradient(135deg, #7C6FCD 0%, #5a4fbf 100%);
      color: #fff; font-family: 'Poppins', sans-serif;
      font-size: 13.5px; font-weight: 600; cursor: pointer;
      display: flex; align-items: center; justify-content: center; gap: 8px;
      transition: opacity 0.15s, transform 0.12s, box-shadow 0.15s;
      box-shadow: 0 4px 20px rgba(92,79,191,0.4);
      letter-spacing: .2px;
    }
    .login-btn:hover:not(:disabled) {
      background: linear-gradient(135deg, #6a5cbf 0%, #4d4299 100%);
      transform: translateY(-1px);
      box-shadow: 0 6px 24px rgba(92,79,191,0.5);
    }
    .login-btn:active:not(:disabled) { transform: translateY(0); }
    .login-btn:disabled { opacity: .6; cursor: default; box-shadow: none; }

    .login-error {
      display: flex; align-items: center; gap: 9px;
      padding: 10px 13px; border-radius: 10px;
      background: #FFF5F5; border: 1px solid #FEC9C9;
      font-size: 12.5px; color: #C0392B;
      animation: errShake 0.35s ease;
    }

    @keyframes errShake {
      0%,100% { transform: translateX(0); }
      20%      { transform: translateX(-5px); }
      60%      { transform: translateX(5px); }
    }
    @keyframes spin-login { to { transform: rotate(360deg); } }
    @keyframes fadeUp {
      from { opacity: 0; transform: translateY(14px); }
      to   { opacity: 1; transform: translateY(0); }
    }
  `
  document.head.appendChild(s)
}

const FEATURES = [
  {
    title: 'Conflict-Free Schedule Generation',
    sub: 'Constraint-based engine builds gap-free timetables automatically',
    icon: (
      <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
        <polyline points="22 12 18 12 15 21 9 3 6 12 2 12"/>
      </svg>
    ),
  },
  {
    title: 'Smart Conflict Detection',
    sub: 'Instantly flags overlaps in rooms, faculty, and time slots',
    icon: (
      <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
        <path d="M10.29 3.86L1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z"/>
        <line x1="12" y1="9" x2="12" y2="13"/>
        <line x1="12" y1="17" x2="12.01" y2="17"/>
      </svg>
    ),
  },
  {
    title: 'Course & Faculty Management',
    sub: 'Manage workloads, assignments, and availability in one place',
    icon: (
      <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
        <path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2"/>
        <circle cx="9" cy="7" r="4"/>
        <path d="M23 21v-2a4 4 0 0 0-3-3.87"/>
        <path d="M16 3.13a4 4 0 0 1 0 7.75"/>
      </svg>
    ),
  },
]

export default function LoginPage() {
  const [email,    setEmail]    = useState('')
  const [password, setPassword] = useState('')
  const [showPw,   setShowPw]   = useState(false)
  const [error,    setError]    = useState('')
  const [loading,  setLoading]  = useState(false)
  const navigate = useNavigate()

  async function handleLogin(e) {
    e.preventDefault()
    setError('')
    setLoading(true)
    try {
      const result = await signInWithEmailAndPassword(auth, email, password)
      const token  = await result.user.getIdTokenResult()
      const role   = token.claims.role
      if      (role === 'admin')   navigate('/dashboard')
      else if (role === 'faculty') navigate('/schedule')
      else    setError('Your account has no role assigned. Contact the admin.')
    } catch {
      setError('Incorrect email or password.')
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="login-root">

      {/* ══ LEFT PANEL — 3 sections: brand / hero / chips ══ */}
      <div className="login-panel">
        <div className="login-panel-inner">

          {/* TOP — icon1 (no built-in text) + manual name/subtitle */}
          <div className="panel-brand">
            <img src={icon1Img} alt="Assigna" />
            <div className="panel-brand-text">
              <span className="panel-brand-name">Assigna</span>
              <span className="panel-brand-sub">Smart Academic Scheduler</span>
            </div>
          </div>

          {/* MIDDLE — hero text */}
          <div className="panel-hero">
            <div className="panel-hero-eyebrow">
              <div className="panel-hero-dot" />
              Academic Scheduling System
            </div>
            <h2>Smarter<br /><span>scheduling</span><br />starts here.</h2>
            <p>
              Automatically assign faculty workloads, resolve conflicts,
              and publish schedules — all in one place.
            </p>
          </div>

          {/* BOTTOM — feature chips */}
          <div className="panel-chips">
            <div className="panel-chips-label">Key Features</div>
            {FEATURES.map(({ title, sub, icon }) => (
              <div key={title} className="panel-chip">
                <div className="panel-chip-icon">{icon}</div>
                <div className="panel-chip-text">
                  <span className="panel-chip-title">{title}</span>
                  <span className="panel-chip-sub">{sub}</span>
                </div>
              </div>
            ))}
          </div>

        </div>
      </div>

      {/* ══ RIGHT FORM SIDE ══ */}
      <div className="login-form-side">
        <div className="login-card">

          {/* Full logo image — name + description are baked in, no extra text */}
          <div className="card-logo-wrap">
            <img src={logoImg} alt="Assigna" />
          </div>

          <div className="card-heading">
            <h1>Welcome back</h1>
            <p>Sign in to manage schedules and faculty workloads.</p>
          </div>

          <div className="card-divider" />

          <form onSubmit={handleLogin} style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>

            <div>
              <label className="login-label">Email address</label>
              <div className="login-field">
                <svg className="login-field-icon" width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                  <path d="M4 4h16c1.1 0 2 .9 2 2v12c0 1.1-.9 2-2 2H4c-1.1 0-2-.9-2-2V6c0-1.1.9-2 2-2z"/>
                  <polyline points="22,6 12,13 2,6"/>
                </svg>
                <input
                  className="login-input" type="email" value={email}
                  onChange={e => setEmail(e.target.value)}
                  placeholder="you@ccs.edu" required autoComplete="email"
                />
              </div>
            </div>

            <div>
              <label className="login-label">Password</label>
              <div className="login-field">
                <svg className="login-field-icon" width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                  <rect x="3" y="11" width="18" height="11" rx="2" ry="2"/>
                  <path d="M7 11V7a5 5 0 0 1 10 0v4"/>
                </svg>
                <input
                  className="login-input" type={showPw ? 'text' : 'password'} value={password}
                  onChange={e => setPassword(e.target.value)}
                  placeholder="••••••••" required autoComplete="current-password"
                  style={{ paddingRight: 40 }}
                />
                <button type="button" className="pw-toggle" onClick={() => setShowPw(p => !p)} tabIndex={-1}>
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
              <div className="login-error">
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                  <circle cx="12" cy="12" r="10"/>
                  <line x1="12" y1="8" x2="12" y2="12"/>
                  <line x1="12" y1="16" x2="12.01" y2="16"/>
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
                    <line x1="5" y1="12" x2="19" y2="12"/>
                    <polyline points="12 5 19 12 12 19"/>
                  </svg>
                </>
              )}
            </button>
          </form>

          <p style={{ marginTop: 14, fontSize: 11, color: '#8883B0', textAlign: 'center', lineHeight: 1.6, fontWeight: 500 }}>
            Access is restricted to registered faculty and administrators.
          </p>
        </div>
      </div>
    </div>
  )
}