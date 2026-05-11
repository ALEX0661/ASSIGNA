import { useEffect, useState, useMemo } from 'react'
import { useScheduleStore } from '../../store/scheduleStore'
import { listSaved, loadSaved } from '../../services/api'
import FacultyEventsTable from '../../components/FacultyEventsTable'

export default function ScheduleSection({ facultyName, onUnitsLoaded, onAssignmentsLoaded }) {
  const storeEvents  = useScheduleStore(s => s.events)
  const scheduleName = useScheduleStore(s => s.scheduleName)

  const [scheduleNames,    setScheduleNames]    = useState([])
  const [selectedSchedule, setSelectedSchedule] = useState('__current__')
  const [allEvents,        setAllEvents]        = useState([])
  const [listLoading,      setListLoading]      = useState(true)
  const [eventsLoading,    setEventsLoading]    = useState(false)
  const [fetchError,       setFetchError]       = useState(false)

  useEffect(() => {
    listSaved()
      .then(names => setScheduleNames(Array.isArray(names) ? names : []))
      .catch(() => setFetchError(true))
      .finally(() => setListLoading(false))
  }, [])

  useEffect(() => {
    if (!selectedSchedule) return
    if (selectedSchedule === '__current__') {
      const raw = storeEvents || []
      setAllEvents(facultyName ? raw.filter(e => (e.faculty||'').toLowerCase() === facultyName.toLowerCase()) : raw)
      setEventsLoading(false)
      return
    }
    setEventsLoading(true); setFetchError(false)
    loadSaved(selectedSchedule)
      .then(data => {
        const raw = Array.isArray(data.schedule) ? data.schedule : (Array.isArray(data.events) ? data.events : [])
        setAllEvents(facultyName ? raw.filter(e => (e.faculty||'').toLowerCase() === facultyName.toLowerCase()) : raw)
      })
      .catch(() => setFetchError(true))
      .finally(() => setEventsLoading(false))
  }, [selectedSchedule, facultyName, storeEvents])

  function computeUnits(ev) {
    if (ev.units != null) return ev.units
    if (ev.period) {
      const m = ev.period.match(/(\d+):(\d+)\s*-\s*(\d+):(\d+)/)
      if (m) return Math.round((parseInt(m[3])*60+parseInt(m[4])-parseInt(m[1])*60-parseInt(m[2]))/60)
    }
    return 0
  }

  const { totalUnits, physicalClassCount } = useMemo(() => {
    const seen = new Set(); let units = 0, count = 0
    allEvents.forEach(ev => {
      const room = (ev.room||'').trim(), ts = (ev.timeSlot||ev.time||ev.period||'').trim()
      const code = (ev.courseCode||ev.course_code||ev.subject||ev.course||'').trim(), day = (ev.day||'').trim()
      if (room && room.toUpperCase() !== 'TBA') {
        const key = `${day}|${room}|${ts}|${code}`
        if (seen.has(key)) return; seen.add(key)
      }
      const u = computeUnits(ev); if (typeof u === 'number') units += u; count++
    })
    return { totalUnits: units, physicalClassCount: count }
  }, [allEvents])

  const distinctCourseCount = useMemo(() => {
    const codes = new Set()
    allEvents.forEach(e => { const c = e.courseCode||e.course_code||e.subject||e.course||''; if(c) codes.add(c.trim().toLowerCase()) })
    return codes.size > 0 ? codes.size : allEvents.length
  }, [allEvents])

  useEffect(() => { onUnitsLoaded?.(totalUnits) },            [totalUnits])
  useEffect(() => { onAssignmentsLoaded?.(distinctCourseCount) }, [distinctCourseCount])

  const loading  = listLoading || eventsLoading
  const classLbl = physicalClassCount === 1 ? '1 class' : `${physicalClassCount} classes`

  return (
    <div style={{ background:'#fff', borderRadius:16, border:'1px solid #E8E4F8', overflow:'hidden', boxShadow:'0 2px 10px rgba(124,111,205,0.06)' }}>
      <div style={{ padding:'12px 20px', borderBottom:'1px solid #F0EDF9', display:'flex', alignItems:'center', justifyContent:'space-between', gap:12 }}>
        <div style={{ display:'flex', alignItems:'center', gap:6 }}>
          <span style={{ fontSize:13, fontWeight:700, color:'#1a1a2e' }}>Schedule</span>
          {!loading && !fetchError && selectedSchedule && (
            <span style={{ fontSize:11.5, color:'#B0ABCC' }}>· {classLbl}{totalUnits > 0 ? ` · ${totalUnits} units` : ''}</span>
          )}
        </div>
        <select value={selectedSchedule} onChange={e => setSelectedSchedule(e.target.value)} style={{ padding:'5px 10px', borderRadius:8, border:'1px solid #E8E4F8', fontSize:11.5, fontFamily:"'Poppins',sans-serif", background:'#FAFAFE', color:'#4a4a6a', cursor:'pointer', outline:'none' }}>
          <option value="__current__">{scheduleName ? `Current (${scheduleName})` : 'Current (in memory)'}</option>
          {scheduleNames.map(n => <option key={n} value={n}>{n}</option>)}
        </select>
      </div>
      <div style={{ padding:loading ? '24px 20px' : 0 }}>
        {loading ? (
          <div style={{ display:'flex', alignItems:'center', gap:8, color:'#B0ABCC', fontSize:12.5 }}>
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="#C4BFDF" strokeWidth="2" style={{ animation:'spin 1s linear infinite' }}><path d="M21 12a9 9 0 1 1-6.219-8.56"/></svg>
            {listLoading ? 'Loading schedules...' : 'Loading events...'}
          </div>
        ) : allEvents.length === 0 ? (
          <div style={{ display:'flex', alignItems:'center', gap:10, padding:'20px', color:'#B0ABCC' }}>
            <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="#D8D3F5" strokeWidth="1.8"><rect x="3" y="4" width="18" height="18" rx="2"/><line x1="16" y1="2" x2="16" y2="6"/><line x1="8" y1="2" x2="8" y2="6"/><line x1="3" y1="10" x2="21" y2="10"/></svg>
            <span style={{ fontSize:12.5 }}>No classes in the selected schedule.</span>
          </div>
        ) : (
          <FacultyEventsTable events={allEvents} computeUnits={computeUnits} fetchError={fetchError}/>
        )}
      </div>
    </div>
  )
}
