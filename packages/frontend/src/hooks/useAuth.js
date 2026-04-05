import { useState, useEffect } from 'react'
import { onAuthStateChanged } from 'firebase/auth'
import { auth } from '../services/firebase'

export function useAuth() {
  const [user, setUser]   = useState(null)
  const [role, setRole]   = useState(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    return onAuthStateChanged(auth, async (u) => {
      if (u) {
        const token = await u.getIdTokenResult()
        setUser(u)
        setRole(token.claims.role || null)
      } else {
        setUser(null)
        setRole(null)
      }
      setLoading(false)
    })
  }, [])

  return { user, role, loading }
}