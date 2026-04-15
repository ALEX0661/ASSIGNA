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
  setProcessId: (id)   => set({ processId: id }),
  setProgress:  (p)    => set({ progress: p }),
  setStatus:    (s)    => set({ status: s }),
  reset:        ()     => set({ processId: null, progress: 0, status: 'idle' }),
}))
