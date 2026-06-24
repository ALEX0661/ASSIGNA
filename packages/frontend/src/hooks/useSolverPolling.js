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
        setProgress(s.progress)

        if (s.status === 'complete') {
          clearInterval(pollRef.current)
          setStatus('complete')
          const res = await getResult()
          setEvents(res.schedule)
          notify('Schedule generated successfully!', 'success')
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
