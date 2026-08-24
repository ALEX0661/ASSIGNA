import { useState, useEffect } from 'react'
import { onAuthStateChanged, signOut } from 'firebase/auth'
import { auth } from '../services/firebase'

export function useAuth() {
  const [user,               setUser]               = useState(null)
  const [role,               setRole]               = useState(null)
  const [isCoordinator,      setIsCoordinator]      = useState(false)
  const [coordinatorProgram, setCoordinatorProgram] = useState(null)
  const [loading,            setLoading]            = useState(true)

  useEffect(() => {
    const unsub = onAuthStateChanged(auth, async (u) => {
      if (u) {
        const token = await u.getIdTokenResult()
        setUser(u)
        setRole(token.claims.role || null)
        setIsCoordinator(token.claims.isCoordinator || false)
        setCoordinatorProgram(token.claims.coordinatorProgram || null)
      } else {
        setUser(null)
        setRole(null)
        setIsCoordinator(false)
        setCoordinatorProgram(null)
      }
      setLoading(false)
    })
    return unsub
  }, [])

  const logout = () => signOut(auth)

  return { user, role, isCoordinator, coordinatorProgram, loading, logout }
}
