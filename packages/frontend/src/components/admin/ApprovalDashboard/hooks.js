import { useState, useEffect, useCallback } from 'react'

function useEscapeClose(onClose) {
  useEffect(() => {
    const onKey = e => { if (e.key === 'Escape') onClose() }
    document.addEventListener('keydown', onKey)
    return () => document.removeEventListener('keydown', onKey)
  }, [onClose])
}

function useToast() {
  const [toasts, setToasts] = useState([])
  const toast = useCallback((msg, type = 'info', dur = 3200) => {
    const id = Date.now() + Math.random()
    setToasts(p => [...p, { id, message: msg, type }])
    setTimeout(() => setToasts(p => p.filter(t => t.id !== id)), dur)
  }, [])
  return { toasts, toast }
}

export { useEscapeClose, useToast }
