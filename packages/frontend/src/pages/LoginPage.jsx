import { useState } from 'react'
import { signInWithEmailAndPassword } from 'firebase/auth'
import { auth } from '../services/firebase'
import { useNavigate } from 'react-router-dom'

/* ─── inject login styles once ─────────────────────────────────────────────── */
if (!document.getElementById('login-page-style')) {
  const s = document.createElement('style')
  s.id = 'login-page-style'
  s.textContent = `
    @import url('https://fonts.googleapis.com/css2?family=Poppins:wght@400;500;600;700;800&display=swap');

    .login-root {
      min-height: 100vh;
      display: flex;
      font-family: 'Poppins', sans-serif;
      background: #F5F4FB;
    }

    /* left decorative panel */
    .login-panel {
      width: 420px; flex-shrink: 0;
      background: linear-gradient(160deg, #3D3580 0%, #2E2660 55%, #1e1945 100%);
      display: flex; flex-direction: column;
      justify-content: space-between;
      padding: 48px 44px;
      position: relative; overflow: hidden;
    }
    @media (max-width: 780px) { .login-panel { display: none; } }

    .login-panel::before {
      content: '';
      position: absolute; inset: 0;
      background-image:
        radial-gradient(circle at 20% 20%, rgba(169,155,232,0.18) 0%, transparent 50%),
        radial-gradient(circle at 80% 80%, rgba(124,111,205,0.14) 0%, transparent 50%);
    }

    /* floating orb decorations */
    .orb {
      position: absolute; border-radius: 50%;
      background: rgba(255,255,255,0.04);
    }

    .login-form-side {
      flex: 1; display: flex; align-items: center; justify-content: center;
      padding: 32px 24px;
    }

    .login-card {
      width: 100%; max-width: 380px;
    }

    /* input field */
    .login-field { position: relative; }
    .login-field-icon {
      position: absolute; left: 12px; top: 50%; transform: translateY(-50%);
      color: #B0ABCC; pointer-events: none; display: flex; align-items: center;
      transition: color 0.15s;
    }
    .login-input {
      width: 100%; padding: 10px 12px 10px 38px;
      border-radius: 10px; border: 1.5px solid #E8E4F8;
      font-family: 'Poppins', sans-serif; font-size: 13px;
      color: #1a1a2e; background: #fff; outline: none;
      transition: border-color 0.15s, box-shadow 0.15s;
      box-sizing: border-box;
    }
    .login-input:focus { border-color: #A99BE8; box-shadow: 0 0 0 3px rgba(169,155,232,0.15); }
    .login-input:focus ~ .login-field-icon,
    .login-field:focus-within .login-field-icon { color: #7C6FCD; }
    .login-input::placeholder { color: #C0BBDC; }

    /* password toggle */
    .pw-toggle {
      position: absolute; right: 11px; top: 50%; transform: translateY(-50%);
      background: none; border: none; cursor: pointer;
      color: #B0ABCC; display: flex; align-items: center; padding: 2px;
      transition: color 0.15s; border-radius: 5px;
    }
    .pw-toggle:hover { color: #7C6FCD; }

    /* submit button */
    .login-btn {
      width: 100%; padding: 11px;
      border-radius: 10px; border: none;
      background: linear-gradient(135deg, #7C6FCD, #5a4fbf);
      color: #fff; font-family: 'Poppins', sans-serif;
      font-size: 13.5px; font-weight: 600; cursor: pointer;
      display: flex; align-items: center; justify-content: center; gap: 8px;
      transition: opacity 0.15s, transform 0.12s;
      box-shadow: 0 4px 16px rgba(124,111,205,0.35);
    }
    .login-btn:hover:not(:disabled) { opacity: .92; transform: translateY(-1px); }
    .login-btn:active:not(:disabled) { transform: translateY(0); }
    .login-btn:disabled { opacity: .65; cursor: default; box-shadow: none; }

    /* error banner */
    .login-error {
      display: flex; align-items: center; gap: 8px;
      padding: 9px 12px; border-radius: 9px;
      background: #FFF5F5; border: 1px solid #FECACA;
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
      from { opacity: 0; transform: translateY(8px); }
      to   { opacity: 1; transform: translateY(0); }
    }
    .login-card { animation: fadeUp .25s ease both; }
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
        {/* orbs */}
        <div className="orb" style={{ width: 300, height: 300, top: -80, right: -80 }} />
        <div className="orb" style={{ width: 180, height: 180, bottom: 60, left: -60 }} />
        <div className="orb" style={{ width: 100, height: 100, bottom: 200, right: 40, background: 'rgba(169,155,232,0.08)' }} />

        {/* logo */}
        <div style={{ position: 'relative', zIndex: 1 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 52 }}>
            <div style={{
              width: 36, height: 36, borderRadius: 10,
              background: 'linear-gradient(135deg,#A99BE8,#7C6FCD)',
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              fontSize: 15, fontWeight: 800, color: '#fff',
              boxShadow: '0 4px 14px rgba(169,155,232,0.4)',
            }}>L</div>
            <span style={{ fontSize: 16, fontWeight: 700, color: '#fff', letterSpacing: 2 }}>LOGOS</span>
          </div>

          <div>
            <h2 style={{ fontSize: 26, fontWeight: 800, color: '#fff', lineHeight: 1.25, marginBottom: 12, letterSpacing: '-.4px' }}>
              Smarter scheduling<br />starts here.
            </h2>
            <p style={{ fontSize: 13, color: 'rgba(255,255,255,0.5)', lineHeight: 1.65 }}>
              Automatically assign faculty workloads, resolve conflicts, and publish schedules — all in one place.
            </p>
          </div>
        </div>

        {/* feature chips */}
        <div style={{ position: 'relative', zIndex: 1, display: 'flex', flexDirection: 'column', gap: 10 }}>
          {[
            { text: 'Constraint-based solver' },
            { text: 'Workload analytics' },
            { text: 'Room & lab management' },
          ].map(f => (
            <div key={f.text} style={{
              display: 'flex', alignItems: 'center', gap: 10,
              padding: '9px 13px', borderRadius: 10,
              background: 'rgba(255,255,255,0.07)',
              border: '1px solid rgba(255,255,255,0.09)',
            }}>
              <span style={{ fontSize: 15 }}>{f.icon}</span>
              <span style={{ fontSize: 12.5, color: 'rgba(255,255,255,0.65)', fontWeight: 500 }}>{f.text}</span>
            </div>
          ))}
        </div>
      </div>

      {/* ── Right form side ── */}
      <div className="login-form-side">
        <div className="login-card">

          {/* Mobile-only logo */}
          <div style={{ display: 'flex', alignItems: 'center', gap: 9, marginBottom: 32 }}>
            <div style={{
              width: 32, height: 32, borderRadius: 9,
              background: 'linear-gradient(135deg,#A99BE8,#7C6FCD)',
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              fontSize: 13, fontWeight: 800, color: '#fff',
            }}>L</div>
            <span style={{ fontSize: 15, fontWeight: 700, color: '#3D3580', letterSpacing: 1.5 }}>LOGOS</span>
          </div>

          {/* Heading */}
          <div style={{ marginBottom: 28 }}>
            <h1 style={{ fontSize: 22, fontWeight: 800, color: '#1a1a2e', letterSpacing: '-.4px', marginBottom: 5 }}>
              Welcome back
            </h1>
            <p style={{ fontSize: 13, color: '#8883B0' }}>
              Sign in to manage schedules and faculty workloads.
            </p>
          </div>

          <form onSubmit={handleLogin} style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>

            {/* Email */}
            <div>
              <label style={{ fontSize: 12, fontWeight: 600, color: '#4a4580', display: 'block', marginBottom: 6 }}>
                Email address
              </label>
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
              <label style={{ fontSize: 12, fontWeight: 600, color: '#4a4580', display: 'block', marginBottom: 6 }}>
                Password
              </label>
              <div className="login-field" style={{ position: 'relative' }}>
                <svg className="login-field-icon" width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                  <rect x="3" y="11" width="18" height="11" rx="2" ry="2"/>
                  <path d="M7 11V7a5 5 0 0 1 10 0v4"/>
                </svg>
                <input
                  className="login-input" type={showPw ? 'text' : 'password'} value={password}
                  onChange={e => setPassword(e.target.value)}
                  placeholder="••••••••" required autoComplete="current-password"
                  style={{ paddingRight: 38 }}
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
            <button type="submit" className="login-btn" disabled={loading} style={{ marginTop: 2 }}>
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

          {/* Footer note */}
          <p style={{ marginTop: 24, fontSize: 12, color: '#B0ABCC', textAlign: 'center' }}>
            Access is restricted to registered faculty and administrators.
          </p>
        </div>
      </div>
    </div>
  )
}