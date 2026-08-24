import { create } from 'zustand'

export const useScheduleStore = create((set) => ({
  events:       [],
  scheduleName: null,
  loading:      false,
  setEvents:    (events) => set({ events }),
  setName:      (name)   => set({ scheduleName: name }),
  setLoading:   (v)      => set({ loading: v }),
  clearSchedule: ()      => set({ events: [], scheduleName: null }),
}))

export const useSolverStore = create((set) => ({
  processId: null,
  progress:  0,
  status:    'idle',   // idle | running | complete | failed
  label:     null,     // name of the schedule currently solving — shown in the floating pill
  originalName: null,  // the name that was being generated when solve started — preserved during navigation
  dismissed: false,    // whether the complete pill has been dismissed by user
  setProcessId: (id)   => set({ processId: id }),
  setProgress:  (p)    => set({ progress: p }),
  setStatus:    (s)    => set({ status: s }),
  setLabel:     (l)    => set({ label: l }),
  setOriginalName: (name) => set({ originalName: name }),
  setDismissed: (dismissed) => set({ dismissed }),
  reset:        ()     => set({ processId: null, progress: 0, status: 'idle', label: null, originalName: null, dismissed: false }),
  // Cancel stops the frontend polling and resets state. The backend task
  // finishes on its own but the result is simply never used.
  cancelSolve: ()      => set({ processId: null, progress: 0, status: 'idle', label: null, originalName: null, dismissed: false }),
}))

/**
 * Coordinator-side twin of useSolverStore. Kept separate (not shared with
 * admin) because a coordinator's solve is scoped to their own program and
 * carries a couple of fields the admin pill doesn't need (result, error,
 * errorKind) — CoordSchedulerPage already surfaces a specific error message
 * and "busy vs failed" distinction in its Step 3 UI, so those are tracked
 * here rather than flattened into a single status the way admin does it.
 */
export const useCoordSolverStore = create((set) => ({
  processId: null,
  progress:  0,
  status:    'idle',   // idle | running | complete | failed
  label:     null,     // e.g. "BSIT — 1st Semester" — shown in the floating pill
  result:    null,     // raw coordGetResult() response once complete
  error:     null,     // human-readable failure message
  errorKind: null,     // 'busy' | 'error' | null
  dismissed: false,
  setProcessId: (id) => set({ processId: id }),
  setProgress:  (p)  => set({ progress: p }),
  setStatus:    (s)  => set({ status: s }),
  setLabel:     (l)  => set({ label: l }),
  setResult:    (r)  => set({ result: r }),
  setError:     (e)  => set({ error: e }),
  setErrorKind: (k)  => set({ errorKind: k }),
  setDismissed: (dismissed) => set({ dismissed }),
  reset: () => set({ processId: null, progress: 0, status: 'idle', label: null, result: null, error: null, errorKind: null, dismissed: false }),
}))