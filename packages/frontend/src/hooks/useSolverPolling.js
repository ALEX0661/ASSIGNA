import { useEffect, useRef } from 'react'
import { getSolveStatus, getResult } from '../services/api'
import { useScheduleStore, useSolverStore } from '../store/scheduleStore'

/**
 * Polls the solver while a job is running, independent of which page is
 * mounted. Call this once from a component that lives for the lifetime of
 * the app (e.g. your root layout / App.jsx) — NOT from SchedulerPage itself,
 * or polling will stop the moment the user navigates away.
 *
 * Accepts an optional `toast` function (message, type, duration) so the
 * caller can surface completion/failure notifications from wherever the
 * user currently is.
 */
export function useSolverPolling(toast) {
  const { processId, status, setProgress, setStatus } = useSolverStore()
  const setEvents = useScheduleStore(s => s.setEvents)
  const pollRef = useRef(null)
  const notify = toast || (() => {})

  useEffect(() => {
    if (status !== 'running' || !processId) return

    pollRef.current = setInterval(async () => {
      try {
        const s = await getSolveStatus(processId)

        // 'stopping' means a cancel was requested but the solver hasn't
        // actually unwound yet (it only checks between phases, which can
        // take a while) — keep polling and leave progress/status alone so
        // the UI doesn't flash back to 0% while it waits.
        if (s.status === 'stopping') return

        setProgress(s.progress)

        if (s.status === 'complete') {
          clearInterval(pollRef.current)
          setStatus('complete')
          try {
            const res = await getResult()
            setEvents(res.schedule || [])
            notify('Schedule generated successfully!', 'success')
          } catch (err) {
            console.error('Failed to fetch result:', err)
            setStatus('failed')
            notify('Schedule generation completed but failed to load results', 'error', 5000)
          }
        } else if (s.status === 'cancelled') {
          clearInterval(pollRef.current)
          setStatus('idle')
          notify('Schedule generation was cancelled.', 'info', 3000)
        } else if (s.status === 'failed') {
          clearInterval(pollRef.current)
          setStatus('failed')
          notify('Solver failed — check eligibility and room settings.', 'error', 5000)
        }
      } catch (err) {
        clearInterval(pollRef.current)
        setStatus('failed')
        notify('Lost connection while checking solver status.', 'error', 5000)
      }
    }, 1200)

    return () => clearInterval(pollRef.current)
  }, [status, processId])
}