import { useState } from 'react'
import { signInWithEmailAndPassword } from 'firebase/auth'
import { auth } from '../services/firebase'
import { useNavigate } from 'react-router-dom'

export default function LoginPage() {
  const [email,    setEmail]    = useState('')
  const [password, setPassword] = useState('')
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
    <div style={{
      minHeight: '100vh', display: 'flex',
      alignItems: 'center', justifyContent: 'center',
      background: '#f5f5f5',
    }}>
      <div className="card" style={{ width: 340 }}>
        <h1 style={{ fontSize: 28, fontWeight: 800, marginBottom: 4 }}>LOGOS</h1>
        <p style={{ color: '#666', marginBottom: 24, fontSize: 13 }}>
          Faculty Workload Optimizer
        </p>

        <form onSubmit={handleLogin} style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
          <div>
            <label style={{ fontSize: 12, fontWeight: 600, display: 'block', marginBottom: 4 }}>Email</label>
            <input type="email" value={email} onChange={e => setEmail(e.target.value)}
              placeholder="you@ccs.edu" required autoComplete="email" />
          </div>
          <div>
            <label style={{ fontSize: 12, fontWeight: 600, display: 'block', marginBottom: 4 }}>Password</label>
            <input type="password" value={password} onChange={e => setPassword(e.target.value)}
              placeholder="••••••••" required autoComplete="current-password" />
          </div>

          {error && <p className="error-msg">{error}</p>}

          <button type="submit" className="primary" disabled={loading} style={{ marginTop: 4 }}>
            {loading ? 'Logging in…' : 'Log in'}
          </button>
        </form>
      </div>
    </div>
  )
}
