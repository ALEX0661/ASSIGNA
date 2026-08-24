import { useEffect, useRef } from 'react'
import { coordSolveStatus, coordGetResult } from '../services/api'
import { useCoordSolverStore } from '../store/scheduleStore'

/**
 * Coordinator-side twin of useSolverPolling.js. Polls the coordinator solve
 * while a job is running, independent of which page is mounted. Call this
 * once from a component that lives for the lifetime of the coordinator
 * section (e.g. CoordinatorLayout.jsx) — NOT from CoordSchedulerPage itself,
 * or polling will stop the moment the coordinator navigates away and the
 * floating pill will have nothing updating it.
 *
 * Accepts an optional `toast` function (message, type, duration) so the
 * caller can surface completion/failure notifications from wherever the
 * coordinator currently is.
 */
export function useCoordSolverPolling(toast) {
  const { processId, status, setProgress, setStatus, setResult, setError, setErrorKind } = useCoordSolverStore()
  const pollRef = useRef(null)
  const notify = toast || (() => {})

  useEffect(() => {
    if (status !== 'running' || !processId) return

    pollRef.current = setInterval(async () => {
      try {
        const r = await coordSolveStatus(processId)

        // 'stopping' means a cancel was requested but the solver hasn't
        // actually unwound yet (it only checks between phases, which can
        // take a while) — keep polling and leave progress/status alone so
        // the UI doesn't flash back to 0% while it waits.
        if (r.status === 'stopping') return

        setProgress(r.progress || 0)

        if (r.status === 'done' || r.status === 'complete' || r.status === 'completed' || r.progress >= 100) {
          clearInterval(pollRef.current)
          setStatus('complete')
          try {
            const res = await coordGetResult()
            setResult(res)
            notify('Schedule generated successfully!', 'success')
          } catch (err) {
            console.error('Failed to fetch result:', err)
            setStatus('failed')
            setError('Schedule generation completed but failed to load results.')
            setErrorKind('error')
            notify('Schedule generation completed but failed to load results', 'error', 5000)
          }
        } else if (r.status === 'cancelled') {
          clearInterval(pollRef.current)
          setStatus('idle')
          notify('Solve cancelled', 'info')
        } else if (r.status === 'error' || r.status === 'failed') {
          clearInterval(pollRef.current)
          setStatus('failed')
          const fallbackMsg = r.error || 'Solver failed to find a feasible schedule. Try adjusting your room selection.'
          const reasons = r.reasons && r.reasons.length ? r.reasons : [fallbackMsg]
          setError({
            failedPhase: r.failedPhase || 'Unknown Phase',
            reasons,
            suggestions: r.suggestions && r.suggestions.length
              ? r.suggestions
              : ['Check your room selection and time constraints.']
          })
          setErrorKind(/already running/i.test(fallbackMsg) ? 'busy' : 'error')
          notify(reasons[0], 'error', 5000)
        }
      } catch (err) {
        clearInterval(pollRef.current)
        setStatus('failed')
        setError('Lost connection to solver.')
        setErrorKind('error')
        notify('Lost connection while checking solver status.', 'error', 5000)
      }
    }, 2000)

    return () => clearInterval(pollRef.current)
  }, [status, processId])
}