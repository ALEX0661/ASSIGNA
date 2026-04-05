import { useState } from 'react'
import { signInWithEmailAndPassword } from 'firebase/auth'
import { auth } from '../services/firebase'
import { useNavigate } from 'react-router-dom'

export default function LoginPage() {
  const [email, setEmail]       = useState('')
  const [password, setPassword] = useState('')
  const [error, setError]       = useState('')
  const navigate = useNavigate()

  async function handleLogin(e) {
    e.preventDefault()
    setError('')
    try {
      const result = await signInWithEmailAndPassword(auth, email, password)
      const token  = await result.user.getIdTokenResult()
      const role   = token.claims.role
      if (role === 'admin')   navigate('/dashboard')
      else if (role === 'faculty') navigate('/schedule')
      else setError('Your account has no role assigned. Contact admin.')
    } catch {
      setError('Invalid email or password.')
    }
  }

  return (
    <div style={{ display:'flex', flexDirection:'column', alignItems:'center', justifyContent:'center', height:'100vh' }}>
      <h1>LOGOS</h1>
      <p>Faculty Workload Optimizer</p>
      <form onSubmit={handleLogin} style={{ display:'flex', flexDirection:'column', gap:'12px', width:'300px' }}>
        <input type="email"    placeholder="Email"    value={email}    onChange={e => setEmail(e.target.value)}    required />
        <input type="password" placeholder="Password" value={password} onChange={e => setPassword(e.target.value)} required />
        {error && <p style={{ color:'red' }}>{error}</p>}
        <button type="submit">Log in</button>
      </form>
    </div>
  )
}