import { useEffect, useState, useMemo } from 'react'
import { useScheduleStore } from '../../store/scheduleStore'
import { listSaved, loadSaved } from '../../services/api'
import { exportScheduleToExcel } from '../../utils/exportScheduleToExcel'
import { exportScheduleToICS } from '../../utils/exportScheduleToICS'
import { exportFacultyLoadToPDF, mergeAndSortEvents } from '../../utils/exportFacultyLoadToPDF'
import FacultyEventsTable from '../../components/FacultyEventsTable'

export default function ScheduleSection({ facultyName, faculty, onUnitsLoaded, onAssignmentsLoaded }) {
  const storeEvents      = useScheduleStore(s => s.events)
  const scheduleName     = useScheduleStore(s => s.scheduleName)
  const storeAcademicYear = useScheduleStore(s => s.academicYear)
  const storeSemester     = useScheduleStore(s => s.semester)

  const [scheduleNames,    setScheduleNames]    = useState([])
  const [selectedSchedule, setSelectedSchedule] = useState('__current__')
  const [allEvents,        setAllEvents]        = useState([])
  const [scheduleMeta,     setScheduleMeta]     = useState({ academicYear: '', semester: '' })
  const [listLoading,      setListLoading]      = useState(true)
  const [eventsLoading,    setEventsLoading]    = useState(false)
  const [fetchError,       setFetchError]       = useState(false)
  const [exporting,        setExporting]        = useState(false)
  const [exportingIcs,     setExportingIcs]      = useState(false)
  const [exportingPdf,     setExportingPdf]      = useState(false)
  const [showExportMenu,   setShowExportMenu]    = useState(false)

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
      setScheduleMeta({ academicYear: storeAcademicYear || '', semester: storeSemester || '' })
      setEventsLoading(false)
      return
    }
    setEventsLoading(true); setFetchError(false)
    loadSaved(selectedSchedule)
      .then(data => {
        const raw = Array.isArray(data.schedule) ? data.schedule : (Array.isArray(data.events) ? data.events : [])
        setAllEvents(facultyName ? raw.filter(e => (e.faculty||'').toLowerCase() === facultyName.toLowerCase()) : raw)
        setScheduleMeta({ academicYear: data.academicYear || data.academic_year || '', semester: data.semester || '' })
      })
      .catch(() => setFetchError(true))
      .finally(() => setEventsLoading(false))
  }, [selectedSchedule, facultyName, storeEvents, storeAcademicYear, storeSemester])

  function computeUnits(ev) {
    let hours = 0;
    if (ev.period) {
      const m = ev.period.match(/(\d+):(\d+)\s*(AM|PM)?\s*-\s*(\d+):(\d+)\s*(AM|PM)?/i)
      if (m) {
        let h1 = parseInt(m[1]), m1 = parseInt(m[2]), ap1 = (m[3]||'').toUpperCase()
        let h2 = parseInt(m[4]), m2 = parseInt(m[5]), ap2 = (m[6]||'').toUpperCase()
        if (ap1 === 'PM' && h1 !== 12) h1 += 12
        if (ap1 === 'AM' && h1 === 12) h1 = 0
        if (ap2 === 'PM' && h2 !== 12) h2 += 12
        if (ap2 === 'AM' && h2 === 12) h2 = 0
        hours = Math.max(0, (h2 * 60 + m2 - h1 * 60 - m1) / 60)
      }
    }
    const days = ev.day ? String(ev.day).trim().match(/Th|Sat|Sun|M|T|W|F/gi) : null
    const multiplier = days ? days.length : 1
    return hours > 0 ? hours * multiplier : (ev.units || 0)
  }

  const mergedAllEvents = useMemo(() => mergeAndSortEvents(allEvents), [allEvents])

  const { totalUnits, physicalClassCount } = useMemo(() => {
    const seen = new Set(); let units = 0, count = 0
    mergedAllEvents.forEach(ev => {
      const room = (ev.room||'').trim(), ts = (ev.timeSlot||ev.time||ev.period||'').trim()
      const code = (ev.courseCode||ev.course_code||ev.subject||ev.course||'').trim(), day = (ev.day||'').trim()
      if (room && room.toUpperCase() !== 'TBA') {
        const key = `${day}|${room}|${ts}|${code}`
        if (seen.has(key)) return; seen.add(key)
      }
      const u = computeUnits(ev); if (typeof u === 'number') units += u; count++
    })
    return { totalUnits: units, physicalClassCount: count }
  }, [mergedAllEvents])

  const distinctCourseCount = useMemo(() => {
    const codes = new Set()
    mergedAllEvents.forEach(e => { const c = e.courseCode||e.course_code||e.subject||e.course||''; if(c) codes.add(c.trim().toLowerCase()) })
    return codes.size > 0 ? codes.size : mergedAllEvents.length
  }, [mergedAllEvents])

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

  /* ── PDF export — Individual Faculty Load and Schedule form ─────────────── */
  async function handleExportPdf(eventsToExport) {
    if (!eventsToExport?.length || exportingPdf || !faculty) return
    setExportingPdf(true)
    try {
      const schedLabel = selectedSchedule === '__current__'
        ? (scheduleName || 'current')
        : selectedSchedule
      await exportFacultyLoadToPDF(eventsToExport, faculty, { name: schedLabel, ...scheduleMeta }, computeUnits)
    } finally {
      setExportingPdf(false)
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

  const PdfIcon = ({ spinning }) => spinning
    ? <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" style={{ animation: 'spin 0.8s linear infinite', flexShrink: 0 }}><path d="M21 12a9 9 0 1 1-6.219-8.56"/></svg>
    : <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/><polyline points="14 2 14 8 20 8"/><line x1="9" y1="15" x2="15" y2="15"/><line x1="9" y1="11" x2="12" y2="11"/></svg>

  return (
    <div style={{ 
      background: 'var(--surface)', 
      borderRadius: '16px', 
      border: '1px solid var(--border)', 
      boxShadow: '0 4px 20px rgba(0,0,0,0.06)',
      overflow: 'hidden',
      fontFamily: "'Inter', sans-serif"
    }}>
      <style>{`@keyframes spin { 100% { transform: rotate(360deg); } }`}</style>

      {/* Header */}
      <div id="tour-fac-schedule-header" style={{ 
        padding: '14px 20px', 
        borderBottom: '1.5px solid var(--meadow-border)', 
        display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: 12,
        background: 'var(--meadow-soft)'
      }}>
        {/* Left: title + stats */}
        <div style={{ flex: 1, minWidth: 0 }}>
          <h2 style={{ fontSize:13.5, fontWeight:700, color: 'var(--ink)', margin:0, fontFamily:"'Sora',sans-serif" }}>Schedule</h2>
          {!loading && !fetchError && selectedSchedule && mergedAllEvents.length > 0 && (
            <div style={{ display:'flex', alignItems:'center', gap:8, marginTop:2 }}>
              <span style={{ fontSize:11, color: 'var(--muted)', fontWeight:500 }}>
                <strong style={{ color: 'var(--meadow-text)' }}>{physicalClassCount}</strong> {physicalClassCount === 1 ? 'class' : 'classes'}
              </span>
              {totalUnits > 0 && (
                <>
                  <span style={{ width:3, height:3, borderRadius:'50%', background:'var(--meadow-border)', display:'inline-block' }}/>
                  <span style={{ fontSize:11, color: 'var(--muted)', fontWeight:500 }}>
                    <strong style={{ color: 'var(--meadow-text)' }}>{totalUnits}</strong> units
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
                border: '1.5px solid var(--border)', 
                fontSize: 12.5, fontWeight: 600,
                background: 'var(--surface)', color: 'var(--ink)', 
                cursor: 'pointer', outline: 'none',
                fontFamily: "'Inter', sans-serif",
                transition: 'all 0.2s'
              }}
              onFocus={e => e.target.style.borderColor='var(--meadow)'}
              onBlur={e => e.target.style.borderColor='var(--border)'}
            >
              <option value="__current__">{scheduleName ? `Current · ${scheduleName}` : 'Current Schedule'}</option>
              {scheduleNames.map(n => <option key={n} value={n}>{n}</option>)}
            </select>
            <div style={{ position: 'absolute', right: 12, top: '50%', transform: 'translateY(-50%)', pointerEvents: 'none', color: 'var(--meadow-text)' }}>
              <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><polyline points="6 9 12 15 18 9"/></svg>
            </div>
          </div>

          {/* Export Dropdown */}
          {!loading && mergedAllEvents.length > 0 && (
            <div style={{ position: 'relative' }}>
              <button
                type="button"
                onClick={() => setShowExportMenu(!showExportMenu)}
                onBlur={() => setTimeout(() => setShowExportMenu(false), 150)}
                disabled={exporting || exportingIcs || exportingPdf}
                title={`Export options`}
                style={{
                  display: 'inline-flex', alignItems: 'center', gap: 6,
                  padding: '8px 14px', borderRadius: '8px',
                  border: '1.5px solid var(--border)',
                  background: (exporting || exportingIcs || exportingPdf) ? 'var(--hover)' : (showExportMenu ? 'var(--meadow-soft)' : 'var(--surface)'),
                  color: (exporting || exportingIcs || exportingPdf) ? 'var(--muted)' : 'var(--meadow)',
                  fontSize: 12.5, fontWeight: 600,
                  cursor: (exporting || exportingIcs || exportingPdf) ? 'default' : 'pointer',
                  fontFamily: "'Inter', sans-serif",
                  transition: 'all 0.2s',
                  borderColor: showExportMenu ? 'var(--meadow)' : 'var(--border)'
                }}
                onMouseEnter={e => { if (!(exporting || exportingIcs || exportingPdf)) { e.currentTarget.style.background = 'var(--meadow-soft)'; e.currentTarget.style.borderColor='var(--meadow)' } }}
                onMouseLeave={e => { if (!(exporting || exportingIcs || exportingPdf)) { e.currentTarget.style.background = showExportMenu ? 'var(--meadow-soft)' : 'var(--surface)'; e.currentTarget.style.borderColor = showExportMenu ? 'var(--meadow)' : 'var(--border)' } }}
              >
                <ExportIcon spinning={exporting || exportingIcs || exportingPdf} />
                {(exporting || exportingIcs || exportingPdf) ? 'Exporting…' : 'Export'}
                <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" style={{ marginLeft: 2, transform: showExportMenu ? 'rotate(180deg)' : 'none', transition: 'transform 0.2s' }}><polyline points="6 9 12 15 18 9"/></svg>
              </button>

              {showExportMenu && (
                <div style={{
                  position: 'absolute', top: '100%', right: 0, marginTop: 4,
                  background: 'var(--surface)', border: '1px solid var(--border)',
                  borderRadius: 8, boxShadow: '0 4px 12px rgba(0,0,0,0.1)',
                  zIndex: 50, minWidth: 160, overflow: 'hidden',
                  display: 'flex', flexDirection: 'column'
                }}>
                  <button
                    onClick={() => { setShowExportMenu(false); handleExport(mergedAllEvents) }}
                    style={{ padding: '10px 14px', textAlign: 'left', background: 'transparent', border: 'none', borderBottom: '1px solid var(--border)', cursor: 'pointer', fontSize: 12, color: 'var(--ink)', fontWeight: 500, display: 'flex', alignItems: 'center', gap: 8 }}
                    onMouseEnter={e => e.currentTarget.style.background = 'var(--hover)'}
                    onMouseLeave={e => e.currentTarget.style.background = 'transparent'}
                  ><ExportIcon spinning={false} /> Export XLSX</button>
                  
                  <button
                    onClick={() => { setShowExportMenu(false); handleExportIcs(mergedAllEvents) }}
                    style={{ padding: '10px 14px', textAlign: 'left', background: 'transparent', border: 'none', borderBottom: '1px solid var(--border)', cursor: 'pointer', fontSize: 12, color: 'var(--ink)', fontWeight: 500, display: 'flex', alignItems: 'center', gap: 8 }}
                    onMouseEnter={e => e.currentTarget.style.background = 'var(--hover)'}
                    onMouseLeave={e => e.currentTarget.style.background = 'transparent'}
                  ><CalendarIcon spinning={false} /> Add to Calendar</button>
                  
                  {faculty && (
                    <button
                      onClick={() => { setShowExportMenu(false); handleExportPdf(mergedAllEvents) }}
                      style={{ padding: '10px 14px', textAlign: 'left', background: 'transparent', border: 'none', cursor: 'pointer', fontSize: 12, color: 'var(--ink)', fontWeight: 500, display: 'flex', alignItems: 'center', gap: 8 }}
                      onMouseEnter={e => e.currentTarget.style.background = 'var(--hover)'}
                      onMouseLeave={e => e.currentTarget.style.background = 'transparent'}
                    ><PdfIcon spinning={false} /> Export PDF</button>
                  )}
                </div>
              )}
            </div>
          )}
        </div>
      </div>

      {/* Main content */}
      <div>
        {loading ? (
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '64px 20px', gap: 10, color: 'var(--muted)', fontSize: 14, fontWeight: 500 }}>
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="var(--meadow)" strokeWidth="2.5" style={{ animation: 'spin 1s linear infinite' }}><path d="M21 12a9 9 0 1 1-6.219-8.56"/></svg>
            {listLoading ? 'Loading schedule list...' : 'Fetching events...'}
          </div>
        ) : mergedAllEvents.length === 0 ? (
          <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', padding: '64px 20px', color: 'var(--muted)' }}>
            <svg width="36" height="36" viewBox="0 0 24 24" fill="none" stroke="var(--border)" strokeWidth="1.5" style={{ marginBottom: 12 }}>
              <rect x="3" y="4" width="18" height="18" rx="2" ry="2"/>
              <line x1="16" y1="2" x2="16" y2="6"/><line x1="8" y1="2" x2="8" y2="6"/><line x1="3" y1="10" x2="21" y2="10"/>
            </svg>
            <span style={{ fontSize: 15, fontWeight: 600, color: 'var(--ink2)' }}>No classes found</span>
            <span style={{ fontSize: 13, marginTop: 4, color: 'var(--muted)' }}>There are no events in the selected schedule.</span>
          </div>
        ) : (
          <FacultyEventsTable
            events={mergedAllEvents}
            computeUnits={computeUnits}
            fetchError={fetchError}
            onExport={handleExport}
          />
        )}
      </div>
    </div>
  )
}