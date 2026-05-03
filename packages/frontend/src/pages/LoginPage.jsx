import { useState } from 'react'
import { signInWithEmailAndPassword } from 'firebase/auth'
import { auth } from '../services/firebase'
import { useNavigate } from 'react-router-dom'
import logoImg from '../assets/logo.png'

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

    /* ── Left panel ── */
    .login-panel {
      width: 440px; flex-shrink: 0;
      background: linear-gradient(155deg, #4a3d9e 0%, #2d2468 50%, #1a1540 100%);
      display: flex; flex-direction: column;
      padding: 0;
      position: relative; overflow: hidden;
    }
    @media (max-width: 800px) { .login-panel { display: none; } }

    /* mesh overlay */
    .login-panel::before {
      content: '';
      position: absolute; inset: 0; z-index: 0;
      background:
        radial-gradient(ellipse 60% 50% at 10% 10%, rgba(160,140,240,0.22) 0%, transparent 70%),
        radial-gradient(ellipse 50% 60% at 90% 90%, rgba(100,80,200,0.18) 0%, transparent 70%),
        radial-gradient(ellipse 40% 40% at 50% 50%, rgba(130,110,220,0.08) 0%, transparent 70%);
    }

    /* subtle grid pattern */
    .login-panel::after {
      content: '';
      position: absolute; inset: 0; z-index: 0;
      background-image:
        linear-gradient(rgba(255,255,255,0.03) 1px, transparent 1px),
        linear-gradient(90deg, rgba(255,255,255,0.03) 1px, transparent 1px);
      background-size: 40px 40px;
    }

    .login-panel-inner {
      position: relative; z-index: 1;
      display: flex; flex-direction: column;
      height: 100%; padding: 48px 44px;
      justify-content: space-between;
    }

    /* top brand row */
    .panel-brand {
      display: flex; align-items: center; gap: 14px;
    }
    .panel-brand img {
      width: 48px; height: 48px; object-fit: contain;
      filter: drop-shadow(0 4px 12px rgba(0,0,0,0.3));
    }
    .panel-brand-text { display: flex; flex-direction: column; gap: 2px; }
    .panel-brand-name {
      font-size: 18px; font-weight: 800;
      color: #fff;
      letter-spacing: 2px; text-transform: uppercase;
      line-height: 1;
    }
    .panel-brand-sub {
      font-size: 9.5px; font-weight: 500;
      color: rgba(255,255,255,0.5);
      letter-spacing: 1.5px; text-transform: uppercase;
    }

    /* hero text block */
    .panel-hero { display: flex; align-items: flex-start; }
    .panel-hero-inner {}
    .panel-hero-eyebrow {
      display: inline-flex; align-items: center; gap: 7px;
      padding: 5px 12px; border-radius: 99px;
      background: rgba(255,255,255,0.1);
      border: 1px solid rgba(255,255,255,0.12);
      font-size: 11px; font-weight: 600; color: rgba(255,255,255,0.7);
      letter-spacing: .5px; margin-bottom: 20px;
    }
    .panel-hero-dot {
      width: 6px; height: 6px; border-radius: 50%;
      background: #A99BE8; flex-shrink: 0;
    }
    .panel-hero h2 {
      font-size: 32px; font-weight: 800; color: #fff;
      line-height: 1.2; letter-spacing: -.6px; margin-bottom: 16px;
    }
    .panel-hero h2 span { color: #C4B8F5; }
    .panel-hero p {
      font-size: 13.5px; color: rgba(255,255,255,0.48);
      line-height: 1.7; max-width: 300px;
    }

    /* chips */
    .panel-chips { display: flex; flex-direction: column; gap: 8px; }
    .panel-chip {
      display: flex; align-items: center; gap: 10px;
      padding: 11px 15px; border-radius: 12px;
      background: rgba(255,255,255,0.06);
      border: 1px solid rgba(255,255,255,0.08);
      backdrop-filter: blur(4px);
      transition: background 0.15s;
    }
    .panel-chip-dot {
      width: 7px; height: 7px; border-radius: 50%;
      background: linear-gradient(135deg, #A99BE8, #7C6FCD);
      flex-shrink: 0;
    }
    .panel-chip span {
      font-size: 12.5px; color: rgba(255,255,255,0.6);
      font-weight: 500;
    }

    /* ── Right side ── */
    .login-form-side {
      flex: 1; display: flex; align-items: center; justify-content: center;
      padding: 40px 32px;
      background: #F0EEF9;
      background-image:
        radial-gradient(ellipse 80% 60% at 0% 0%, rgba(169,155,232,0.12) 0%, transparent 60%),
        radial-gradient(ellipse 60% 60% at 100% 100%, rgba(124,111,205,0.08) 0%, transparent 60%);
      position: relative;
    }

    /* dot pattern on right side */
    .login-form-side::before {
      content: '';
      position: absolute; inset: 0; z-index: 0;
      background-image: radial-gradient(circle, rgba(124,111,205,0.12) 1px, transparent 1px);
      background-size: 24px 24px;
    }

    /* the white form card */
    .login-card {
      position: relative; z-index: 1;
      width: 100%; max-width: 380px;
      background: #fff;
      border-radius: 18px;
      padding: 28px 30px;
      box-shadow:
        0 4px 6px rgba(61,53,128,0.04),
        0 12px 40px rgba(61,53,128,0.10),
        0 0 0 1px rgba(61,53,128,0.06);
      animation: fadeUp .3s ease both;
    }

    .card-logo-wrap {
      display: flex; flex-direction: column; align-items: center; gap: 5px; margin-bottom: 16px;
    }
    .card-logo-wrap img {
      width: 54px; height: 54px; object-fit: contain;
    }
    .card-logo-name {
      font-size: 14px; font-weight: 800; color: #1a1a2e;
      letter-spacing: 2px; text-transform: uppercase; line-height: 1;
    }
    .card-logo-sub {
      font-size: 8.5px; font-weight: 500; color: #9490BB;
      letter-spacing: 1.5px; text-transform: uppercase;
    }

    .card-heading { margin-bottom: 16px; }
    .card-heading h1 {
      font-size: 19px; font-weight: 800; color: #1a1a2e;
      letter-spacing: -.4px; margin-bottom: 4px;
    }
    .card-heading p { font-size: 12px; color: #9490BB; }

    /* divider line */
    .card-divider {
      height: 1px; background: #F0EDF9; margin-bottom: 16px;
    }

    /* input label */
    .login-label {
      font-size: 12px; font-weight: 600; color: #3D3580;
      display: block; margin-bottom: 7px; letter-spacing: .2px;
    }

    /* input field */
    .login-field { position: relative; }
    .login-field-icon {
      position: absolute; left: 13px; top: 50%; transform: translateY(-50%);
      color: #C0BBDC; pointer-events: none; display: flex; align-items: center;
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
    .login-input::placeholder { color: #C8C4E0; }

    /* password toggle */
    .pw-toggle {
      position: absolute; right: 12px; top: 50%; transform: translateY(-50%);
      background: none; border: none; cursor: pointer;
      color: #C0BBDC; display: flex; align-items: center; padding: 3px;
      transition: color 0.15s; border-radius: 5px;
    }
    .pw-toggle:hover { color: #7C6FCD; }

    /* submit button */
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
    background: linear-gradient(135deg, #6a6492 0%, #4d4877 100%);
      opacity: .93; transform: translateY(-1px);
      box-shadow: 0 6px 24px rgba(92,79,191,0.5);
    }
    .login-btn:active:not(:disabled) { transform: translateY(0); }
    .login-btn:disabled { opacity: .6; cursor: default; box-shadow: none; }

    /* error banner */
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

      {/* ── Left decorative panel ── */}
      <div className="login-panel">
        <div className="login-panel-inner">

          {/* Hero text */}
          <div className="panel-hero">
            <div className="panel-hero-inner">
              <div className="panel-hero-eyebrow">
                <div className="panel-hero-dot" />
                Academic Scheduling System
              </div>
              <h2>
                Smarter<br /><span>scheduling</span><br />starts here.
              </h2>
              <p>
                Automatically assign faculty workloads, resolve conflicts,
                and publish schedules — all in one place.
              </p>
            </div>
          </div>

          {/* Feature chips */}
          <div className="panel-chips">
            {['Constraint-based solver', 'Workload analytics', 'Room & lab management'].map(text => (
              <div key={text} className="panel-chip">
                <div className="panel-chip-dot" />
                <span>{text}</span>
              </div>
            ))}
          </div>

        </div>
      </div>

      {/* ── Right form side ── */}
      <div className="login-form-side">
        <div className="login-card">

          {/* Logo */}
          <div className="card-logo-wrap">
            <img src={logoImg} alt="Logos" />
            <span className="card-logo-sub">Smart Academic Scheduler</span>
          </div>

          {/* Heading */}
          <div className="card-heading">
            <h1>Welcome back</h1>
            <p>Sign in to manage schedules and faculty workloads.</p>
          </div>

          <div className="card-divider" />

          <form onSubmit={handleLogin} style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>

            {/* Email */}
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

            {/* Password */}
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

            {/* Error */}
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

            {/* Submit */}
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

          {/* Footer */}
          <p style={{ marginTop: 14, fontSize: 11, color: '#C0BBDC', textAlign: 'center', lineHeight: 1.6 }}>
            Access is restricted to registered faculty and administrators.
          </p>
        </div>
      </div>
    </div>
  )
}