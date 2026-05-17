import { useEffect, useState, useMemo } from 'react'
import { useScheduleStore } from '../../store/scheduleStore'
import { listSaved, loadSaved } from '../../services/api'
import { exportScheduleToExcel } from '../../utils/exportScheduleToExcel'
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
  const [exporting,        setExporting]        = useState(false)

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

  /* ── Export ─────────────────────────────────────────────────────────────── */
  async function handleExport(eventsToExport) {
    if (!eventsToExport?.length || exporting) return
    setExporting(true)
    try {
      const schedLabel = selectedSchedule === '__current__'
        ? (scheduleName || 'current')
        : selectedSchedule
      const safeName   = (facultyName || 'Faculty').replace(/[^a-zA-Z0-9\s-]/g, '').trim()
      await exportScheduleToExcel(eventsToExport, `${safeName} - ${schedLabel}`)
    } finally {
      setExporting(false)
    }
  }

  const loading  = listLoading || eventsLoading
  const classLbl = physicalClassCount === 1 ? '1 Class' : `${physicalClassCount} Classes`

  /* ── Export icon SVG ─────────────────────────────────────────────────────── */
  const ExportIcon = ({ spinning }) => spinning
    ? <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" style={{ animation: 'spin 0.8s linear infinite', flexShrink: 0 }}><path d="M21 12a9 9 0 1 1-6.219-8.56"/></svg>
    : <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/><polyline points="7 10 12 15 17 10"/><line x1="12" y1="15" x2="12" y2="3"/></svg>

  return (
    <div style={{ 
      background: '#FFFFFF', 
      borderRadius: '16px', 
      border: '1px solid #E8E4F8', 
      boxShadow: '0 4px 20px rgba(124,111,205,0.04)',
      overflow: 'hidden',
      fontFamily: "'Poppins', sans-serif"
    }}>
      <style>{`@keyframes spin { 100% { transform: rotate(360deg); } }`}</style>

      {/* Header */}
      <div style={{ 
        padding: '16px 20px', 
        borderBottom: '1px solid #E8E4F8', 
        display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: 12,
        background: '#FAFAFE'
      }}>
        {/* Left: title + stats */}
        <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
          <h2 style={{ fontSize: 16, fontWeight: 700, color: '#1a1a2e', margin: 0 }}>Schedule</h2>
          {!loading && !fetchError && selectedSchedule && (
            <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
              <span style={{ width: 4, height: 4, borderRadius: '50%', background: '#B0ABCC' }}></span>
              <span style={{ fontSize: 13, color: '#8883B0', fontWeight: 600 }}>
                {classLbl} {totalUnits > 0 ? `• ${totalUnits} Units` : ''}
              </span>
            </div>
          )}
        </div>
        
        {/* Right: schedule selector + export button */}
        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>

          {/* Schedule dropdown */}
          <div style={{ position: 'relative' }}>
            <select 
              value={selectedSchedule} 
              onChange={e => setSelectedSchedule(e.target.value)} 
              style={{ 
                appearance: 'none',
                padding: '8px 36px 8px 14px', 
                borderRadius: '8px', 
                border: '1px solid #D8D3F5', 
                fontSize: 13, fontWeight: 600,
                background: '#FFFFFF', color: '#5a4fbf', 
                cursor: 'pointer', outline: 'none',
                fontFamily: "'Poppins', sans-serif",
                transition: 'all 0.2s'
              }}
              onMouseEnter={e => e.currentTarget.style.borderColor = '#7C6FCD'}
              onMouseLeave={e => e.currentTarget.style.borderColor = '#D8D3F5'}
            >
              <option value="__current__">{scheduleName ? `Current (${scheduleName})` : 'Current Schedule'}</option>
              {scheduleNames.map(n => <option key={n} value={n}>{n}</option>)}
            </select>
            <div style={{ position: 'absolute', right: 12, top: '50%', transform: 'translateY(-50%)', pointerEvents: 'none', color: '#7C6FCD' }}>
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><polyline points="6 9 12 15 18 9"/></svg>
            </div>
          </div>

          {/* Export button — only shown when there are events */}
          {!loading && allEvents.length > 0 && (
            <button
              onClick={() => handleExport(allEvents)}
              disabled={exporting}
              title={`Export ${facultyName ? `${facultyName}'s` : 'faculty'} schedule to Excel`}
              style={{
                display: 'inline-flex', alignItems: 'center', gap: 6,
                padding: '8px 14px', borderRadius: '8px',
                border: '1px solid #D8D3F5',
                background: exporting ? '#F5F4FB' : '#FFFFFF',
                color: exporting ? '#8883B0' : '#5a4fbf',
                fontSize: 13, fontWeight: 600,
                cursor: exporting ? 'default' : 'pointer',
                fontFamily: "'Poppins', sans-serif",
                transition: 'all 0.2s',
                opacity: exporting ? 0.7 : 1,
              }}
              onMouseEnter={e => { if (!exporting) { e.currentTarget.style.background = '#EEEAFB'; e.currentTarget.style.borderColor = '#7C6FCD' } }}
              onMouseLeave={e => { e.currentTarget.style.background = exporting ? '#F5F4FB' : '#FFFFFF'; e.currentTarget.style.borderColor = '#D8D3F5' }}
            >
              <ExportIcon spinning={exporting} />
              {exporting ? 'Exporting…' : 'Export'}
            </button>
          )}
        </div>
      </div>

      {/* Main content */}
      <div>
        {loading ? (
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '64px 20px', gap: 10, color: '#8883B0', fontSize: 14, fontWeight: 500 }}>
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="#7C6FCD" strokeWidth="2.5" style={{ animation: 'spin 1s linear infinite' }}><path d="M21 12a9 9 0 1 1-6.219-8.56"/></svg>
            {listLoading ? 'Loading schedule list...' : 'Fetching events...'}
          </div>
        ) : allEvents.length === 0 ? (
          <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', padding: '64px 20px', color: '#8883B0' }}>
            <svg width="36" height="36" viewBox="0 0 24 24" fill="none" stroke="#D8D3F5" strokeWidth="1.5" style={{ marginBottom: 12 }}>
              <rect x="3" y="4" width="18" height="18" rx="2" ry="2"/>
              <line x1="16" y1="2" x2="16" y2="6"/><line x1="8" y1="2" x2="8" y2="6"/><line x1="3" y1="10" x2="21" y2="10"/>
            </svg>
            <span style={{ fontSize: 15, fontWeight: 600, color: '#4a4a6a' }}>No classes found</span>
            <span style={{ fontSize: 13, marginTop: 4 }}>There are no events in the selected schedule.</span>
          </div>
        ) : (
          <FacultyEventsTable
            events={allEvents}
            computeUnits={computeUnits}
            fetchError={fetchError}
            onExport={handleExport}
          />
        )}
      </div>
    </div>
  )
}