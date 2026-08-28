import { useEffect, useState, useMemo } from 'react'
import { useScheduleStore } from '../../store/scheduleStore'
import { listSaved, loadSaved } from '../../services/api'
import { exportScheduleToExcel } from '../../utils/exportScheduleToExcel'
import { exportScheduleToICS } from '../../utils/exportScheduleToICS'
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
  const [exportingIcs,     setExportingIcs]      = useState(false)

  useEffect(() => {
    listSaved()
      .then(res => {
        const list = Array.isArray(res) ? res : []
        // listSaved() returns schedule objects ({id, name, ...}), not plain name strings
        const names = list.map(item => (typeof item === 'string' ? item : item?.name)).filter(Boolean)
        setScheduleNames(names)
      })
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

  /* ── Calendar export (.ics) — for import into Google/Outlook/Apple Calendar ── */
  async function handleExportIcs(eventsToExport) {
    if (!eventsToExport?.length || exportingIcs) return
    setExportingIcs(true)
    try {
      const schedLabel = selectedSchedule === '__current__'
        ? (scheduleName || 'current')
        : selectedSchedule
      const safeName   = (facultyName || 'Faculty').replace(/[^a-zA-Z0-9\s-]/g, '').trim()
      await exportScheduleToICS(eventsToExport, `${safeName} - ${schedLabel}`)
    } finally {
      setExportingIcs(false)
    }
  }

  const loading  = listLoading || eventsLoading
  const classLbl = physicalClassCount === 1 ? '1 Class' : `${physicalClassCount} Classes`

  /* ── Export icon SVG ─────────────────────────────────────────────────────── */
  const ExportIcon = ({ spinning }) => spinning
    ? <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" style={{ animation: 'spin 0.8s linear infinite', flexShrink: 0 }}><path d="M21 12a9 9 0 1 1-6.219-8.56"/></svg>
    : <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/><polyline points="7 10 12 15 17 10"/><line x1="12" y1="15" x2="12" y2="3"/></svg>

  const CalendarIcon = ({ spinning }) => spinning
    ? <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" style={{ animation: 'spin 0.8s linear infinite', flexShrink: 0 }}><path d="M21 12a9 9 0 1 1-6.219-8.56"/></svg>
    : <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><rect x="3" y="4" width="18" height="18" rx="2"/><line x1="16" y1="2" x2="16" y2="6"/><line x1="8" y1="2" x2="8" y2="6"/><line x1="3" y1="10" x2="21" y2="10"/><line x1="12" y1="14" x2="12" y2="18"/><line x1="10" y1="16" x2="14" y2="16"/></svg>

  return (
    <div style={{ 
      background: '#FFFFFF', 
      borderRadius: '16px', 
      border: '1px solid #D8E8DF', 
      boxShadow: '0 4px 20px rgba(10,46,28,0.06)',
      overflow: 'hidden',
      fontFamily: "'Inter', sans-serif"
    }}>
      <style>{`@keyframes spin { 100% { transform: rotate(360deg); } }`}</style>

      {/* Header */}
      <div id="tour-fac-schedule-header" style={{ 
        padding: '14px 20px', 
        borderBottom: '1.5px solid #BBF7D0', 
        display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: 12,
        background: '#F0FDF4'
      }}>
        {/* Left: title + stats */}
        <div style={{ flex: 1, minWidth: 0 }}>
          <h2 style={{ fontSize:13.5, fontWeight:700, color:'#0E2A20', margin:0, fontFamily:"'Sora',sans-serif" }}>Schedule</h2>
          {!loading && !fetchError && selectedSchedule && allEvents.length > 0 && (
            <div style={{ display:'flex', alignItems:'center', gap:8, marginTop:2 }}>
              <span style={{ fontSize:11, color:'#4B7060', fontWeight:500 }}>
                <strong style={{ color:'#15803D' }}>{physicalClassCount}</strong> {physicalClassCount === 1 ? 'class' : 'classes'}
              </span>
              {totalUnits > 0 && (
                <>
                  <span style={{ width:3, height:3, borderRadius:'50%', background:'#BBF7D0', display:'inline-block' }}/>
                  <span style={{ fontSize:11, color:'#4B7060', fontWeight:500 }}>
                    <strong style={{ color:'#15803D' }}>{totalUnits}</strong> units
                  </span>
                </>
              )}
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
                border: '1.5px solid #D8E8DF', 
                fontSize: 12.5, fontWeight: 600,
                background: '#FFFFFF', color: '#0E2A20', 
                cursor: 'pointer', outline: 'none',
                fontFamily: "'Inter', sans-serif",
                transition: 'all 0.2s'
              }}
              onFocus={e => e.target.style.borderColor='#15803D'}
              onBlur={e => e.target.style.borderColor='#D8E8DF'}
            >
              <option value="__current__">{scheduleName ? `Current · ${scheduleName}` : 'Current Schedule'}</option>
              {scheduleNames.map(n => <option key={n} value={n}>{n}</option>)}
            </select>
            <div style={{ position: 'absolute', right: 12, top: '50%', transform: 'translateY(-50%)', pointerEvents: 'none', color: '#15803D' }}>
              <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><polyline points="6 9 12 15 18 9"/></svg>
            </div>
          </div>

          {/* Export button */}
          {!loading && allEvents.length > 0 && (
            <button
              type="button"
              onClick={() => handleExport(allEvents)}
              disabled={exporting}
              title={`Export ${facultyName ? `${facultyName}'s` : 'faculty'} schedule to Excel`}
              style={{
                display: 'inline-flex', alignItems: 'center', gap: 6,
                padding: '8px 14px', borderRadius: '8px',
                border: '1.5px solid #D8E8DF',
                background: exporting ? '#EBF4EF' : '#FFFFFF',
                color: exporting ? '#4B7060' : '#15803D',
                fontSize: 12.5, fontWeight: 600,
                cursor: exporting ? 'default' : 'pointer',
                fontFamily: "'Inter', sans-serif",
                transition: 'all 0.2s',
                opacity: exporting ? 0.7 : 1,
              }}
              onMouseEnter={e => { if (!exporting) { e.currentTarget.style.background = '#DCFCE7'; e.currentTarget.style.borderColor = '#15803D' } }}
              onMouseLeave={e => { if (!exporting) { e.currentTarget.style.background = '#FFFFFF'; e.currentTarget.style.borderColor = '#D8E8DF' } }}
            >
              <ExportIcon spinning={exporting} />
              {exporting ? 'Exporting…' : 'Export'}
            </button>
          )}

          {/* Add to Calendar button (.ics) */}
          {!loading && allEvents.length > 0 && (
            <button
              type="button"
              onClick={() => handleExportIcs(allEvents)}
              disabled={exportingIcs}
              title={`Download ${facultyName ? `${facultyName}'s` : 'this'} schedule as a .ics file to import into Google Calendar, Outlook, or Apple Calendar`}
              style={{
                display: 'inline-flex', alignItems: 'center', gap: 6,
                padding: '8px 14px', borderRadius: '8px',
                border: '1.5px solid #D8E8DF',
                background: exportingIcs ? '#EBF4EF' : '#FFFFFF',
                color: exportingIcs ? '#4B7060' : '#15803D',
                fontSize: 12.5, fontWeight: 600,
                cursor: exportingIcs ? 'default' : 'pointer',
                fontFamily: "'Inter', sans-serif",
                transition: 'all 0.2s',
                opacity: exportingIcs ? 0.7 : 1,
              }}
              onMouseEnter={e => { if (!exportingIcs) { e.currentTarget.style.background = '#DCFCE7'; e.currentTarget.style.borderColor = '#15803D' } }}
              onMouseLeave={e => { if (!exportingIcs) { e.currentTarget.style.background = '#FFFFFF'; e.currentTarget.style.borderColor = '#D8E8DF' } }}
            >
              <CalendarIcon spinning={exportingIcs} />
              {exportingIcs ? 'Preparing…' : 'Add to Calendar'}
            </button>
          )}
        </div>
      </div>

      {/* Main content */}
      <div>
        {loading ? (
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '64px 20px', gap: 10, color: '#4B7060', fontSize: 14, fontWeight: 500 }}>
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="#15803D" strokeWidth="2.5" style={{ animation: 'spin 1s linear infinite' }}><path d="M21 12a9 9 0 1 1-6.219-8.56"/></svg>
            {listLoading ? 'Loading schedule list...' : 'Fetching events...'}
          </div>
        ) : allEvents.length === 0 ? (
          <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', padding: '64px 20px', color: '#4B7060' }}>
            <svg width="36" height="36" viewBox="0 0 24 24" fill="none" stroke="#D8E8DF" strokeWidth="1.5" style={{ marginBottom: 12 }}>
              <rect x="3" y="4" width="18" height="18" rx="2" ry="2"/>
              <line x1="16" y1="2" x2="16" y2="6"/><line x1="8" y1="2" x2="8" y2="6"/><line x1="3" y1="10" x2="21" y2="10"/>
            </svg>
            <span style={{ fontSize: 15, fontWeight: 600, color: '#1C3D2A' }}>No classes found</span>
            <span style={{ fontSize: 13, marginTop: 4, color: '#4B7060' }}>There are no events in the selected schedule.</span>
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