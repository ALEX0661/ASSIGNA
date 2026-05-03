import { useEffect, useState, useMemo, useCallback } from 'react'
import { useScheduleStore } from '../../store/scheduleStore'
import { getSchedules, getRooms, getFaculty, saveSchedule } from '../../services/api'
import { buildConflictMap, DAYS, getEventId, getMergedIds } from '../../components/ScheduleView/svHelpers'
import { TV, ConflictSummaryBar, Toast, FilterButton, FilterRow, PendingChangesBar, ModalOverlay, ModalHeader } from '../../components/ScheduleView/svPrimitives'
import { useFilters, useDragDrop } from '../../components/ScheduleView/svHooks'
import { FilterModal, FacultyFilterModal, RoomFilterModal, OverrideConfirmModal } from '../../components/ScheduleView/FilterModals'
import TimeGrid from '../../components/ScheduleView/TimeGrid'
import SessionModal from '../../components/ScheduleView/SessionModal'

/* ── Page-scoped styles ────────────────────────────────────────────────────── */
if (!document.getElementById('sv-page-style')) {
  const s = document.createElement('style')
  s.id = 'sv-page-style'
  s.textContent = `
    @keyframes svSlideIn   { from{opacity:0;transform:translateY(6px)} to{opacity:1;transform:translateY(0)} }
    @keyframes svFadeIn    { from{opacity:0} to{opacity:1} }
    @keyframes svSpinAnim  { to{transform:rotate(360deg)} }
    @keyframes spin        { to{transform:rotate(360deg)} }
    @keyframes svPulse     { 0%,100%{opacity:1} 50%{opacity:.35} }
    @keyframes svShimmer   { 0%{background-position:-400px 0} 100%{background-position:400px 0} }

    .sv-day-btn {
      padding:6px 13px; border-radius:20px; font-size:12px; font-weight:500;
      cursor:pointer; border:1px solid #E8E4F8; background:#fff; color:#8883B0;
      transition:all .15s; font-family:'Poppins',sans-serif; white-space:nowrap;
    }
    .sv-day-btn:hover  { background:#F5F4FB; color:#5a4fbf; }
    .sv-day-btn.active {
      background:linear-gradient(135deg,#7C6FCD,#5a4fbf); color:#fff;
      border-color:transparent; box-shadow:0 2px 8px rgba(124,111,205,.3);
    }

    .sv-icon-btn {
      display:inline-flex; align-items:center; justify-content:center;
      width:30px; height:30px; border-radius:8px; border:1px solid #E8E4F8;
      background:#fff; color:#8883B0; cursor:pointer; transition:all .15s;
      flex-shrink:0; padding:0;
    }
    .sv-icon-btn:hover:not(:disabled)  { background:#EEEAFB; color:#7C6FCD; border-color:#C5BBEF; }
    .sv-icon-btn.active { background:#EEEAFB; border-color:#A99BE8; color:#5a4fbf; }

    .sv-search {
      padding:7px 12px 7px 32px; border-radius:20px; border:1px solid #E8E4F8;
      font-size:12.5px; font-family:'Poppins',sans-serif; color:#1a1a2e;
      background:#fff; outline:none; width:190px; transition:all .15s;
    }
    .sv-search:focus { border-color:#A99BE8; box-shadow:0 0 0 3px rgba(169,155,232,.12); width:220px; }
    .sv-search::placeholder { color:#C0BBDC; }

    .sv-chip {
      padding:3px 10px; border-radius:20px; font-size:11px; cursor:pointer;
      border:1px solid #E8E4F8; background:#fff; color:#8883B0; font-weight:400;
      font-family:'Poppins',sans-serif; transition:all .15s; white-space:nowrap;
    }
    .sv-chip:hover  { background:#F5F4FB; color:#5a4fbf; border-color:#C5BBEF; }
    .sv-chip.active { border-color:#A99BE8; background:#EEEAFB; color:#3D3580; font-weight:600; }

    .sv-sched-wrap { position:relative; display:inline-flex; align-items:center; }
    .sv-sched-select {
      appearance:none; -webkit-appearance:none;
      padding:7px 32px 7px 34px; border-radius:9px;
      border:1.5px solid #E8E4F8; font-size:12.5px;
      font-family:'Poppins',sans-serif; color:#3D3580;
      background:#fff; cursor:pointer; outline:none;
      font-weight:500; transition:border-color .15s, box-shadow .15s;
      min-width:180px; max-width:270px;
    }
    .sv-sched-select:hover  { border-color:#C5BBEF; }
    .sv-sched-select:focus  { border-color:#A99BE8; box-shadow:0 0 0 3px rgba(169,155,232,.12); }
    .sv-sched-select:disabled { opacity:.6; cursor:default; }

    .sv-save-btn {
      display:inline-flex; align-items:center; gap:6px;
      padding:7px 14px; border-radius:9px; border:1.5px solid #E8E4F8;
      background:#fff; color:#3D3580; font-size:12.5px; font-weight:600;
      font-family:'Poppins',sans-serif; cursor:pointer; transition:all .2s;
      white-space:nowrap; flex-shrink:0;
    }
    .sv-save-btn:hover:not(:disabled) { background:#EEEAFB; border-color:#A99BE8; }
    .sv-save-btn:disabled { opacity:.65; cursor:default; }
    .sv-save-btn.saved  { background:#ecfdf5; border-color:#6ee7b7; color:#059669; }
    .sv-save-btn.failed { background:#fff8f8; border-color:#fca5a5; color:#dc2626; }

    .sv-view-group { display:flex; border:1px solid #E8E4F8; border-radius:8px; overflow:hidden; background:#fff; }
    .sv-view-btn {
      display:flex; align-items:center; gap:5px; padding:5px 11px;
      font-size:11.5px; font-family:'Poppins',sans-serif;
      border:none; cursor:pointer; transition:all .15s; white-space:nowrap;
    }
    .sv-view-btn.active { background:#EEEAFB; color:#3D3580; font-weight:700; }
    .sv-view-btn:not(.active) { background:transparent; color:#8883B0; font-weight:400; }
    .sv-view-btn:not(.active):hover { background:#F5F4FB; color:#5a4fbf; }

    .sv-shimmer {
      background: linear-gradient(90deg,#f0eef8 25%,#e8e4f8 50%,#f0eef8 75%);
      background-size: 400px 100%;
      animation: svShimmer 1.2s ease-in-out infinite;
      border-radius:6px;
    }

    .sv-stats-row {
      display:flex; background:#fff; border:1px solid #E8E4F8;
      border-radius:10px; overflow:hidden;
      box-shadow:0 1px 4px rgba(124,111,205,.06);
      margin-bottom:14px;
    }
    .sv-stat-cell {
      flex:1; padding:9px 14px; min-width:0;
      border-right:1px solid #E8E4F8;
      display:flex; flex-direction:column; gap:1px;
    }
    .sv-stat-cell:last-child { border-right:none; }
  `
  document.head.appendChild(s)
}

/* ── Inline spinner ──────────────────────────────────────────────────────── */
function Spinner({ full = false }) {
  const svg = (
    <svg
      width={full ? 30 : 14} height={full ? 30 : 14}
      viewBox="0 0 24 24" fill="none"
      stroke={full ? '#7C6FCD' : TV.deep} strokeWidth="2.2"
      style={{ animation: 'svSpinAnim .75s linear infinite', flexShrink: 0 }}
    >
      <path d="M21 12a9 9 0 1 1-6.219-8.56"/>
    </svg>
  )
  if (!full) return svg
  return (
    <div style={{ display:'flex', flexDirection:'column', alignItems:'center', justifyContent:'center', height:'100%', minHeight:300, gap:12 }}>
      {svg}
      <span style={{ fontSize:13, color:TV.muted, fontFamily:'Poppins,sans-serif' }}>Loading schedule…</span>
    </div>
  )
}

/* ── Empty state ─────────────────────────────────────────────────────────── */
function EmptyState({ hasFilters, onClear }) {
  return (
    <div style={{ display:'flex', flexDirection:'column', alignItems:'center', justifyContent:'center', height:280, gap:12 }}>
      <div style={{ width:48, height:48, borderRadius:14, background:TV.pale, display:'flex', alignItems:'center', justifyContent:'center' }}>
        <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke={TV.deep} strokeWidth="1.8">
          <rect x="3" y="4" width="18" height="18" rx="2"/>
          <line x1="16" y1="2" x2="16" y2="6"/>
          <line x1="8" y1="2" x2="8" y2="6"/>
          <line x1="3" y1="10" x2="21" y2="10"/>
        </svg>
      </div>
      <div style={{ textAlign:'center' }}>
        <p style={{ fontSize:13.5, fontWeight:600, color:TV.text, marginBottom:4 }}>No sessions found</p>
        <p style={{ fontSize:12, color:TV.muted }}>
          {hasFilters ? 'Try adjusting your filters.' : 'No events scheduled for this day.'}
        </p>
      </div>
      {hasFilters && (
        <button onClick={onClear} style={{ padding:'7px 16px', fontSize:12, fontWeight:600, borderRadius:8, border:`1px solid ${TV.border}`, background:'#fff', color:TV.deep, cursor:'pointer', fontFamily:'Poppins,sans-serif' }}>
          Clear Filters
        </button>
      )}
    </div>
  )
}

/* ── Stats row ───────────────────────────────────────────────────────────── */
function StatsRow({ items }) {
  return (
    <div className="sv-stats-row">
      {items.map(s => (
        <div key={s.label} className="sv-stat-cell">
          <span style={{ fontSize:9, fontWeight:700, color:TV.muted, textTransform:'uppercase', letterSpacing:'.8px', whiteSpace:'nowrap' }}>
            {s.label}
          </span>
          <div style={{ display:'flex', alignItems:'baseline', gap:4 }}>
            <span style={{ fontSize:19, fontWeight:800, color:s.accent || TV.deep, lineHeight:1.15 }}>
              {s.value}
            </span>
            {s.sub && (
              <span style={{ fontSize:9.5, color:TV.muted, whiteSpace:'nowrap' }}>{s.sub}</span>
            )}
          </div>
        </div>
      ))}
    </div>
  )
}

/* ── Schedule dropdown ───────────────────────────────────────────────────── */
function ScheduleDropdown({ names, activeName, loading, initLoading, onChange }) {
  return (
    <div className="sv-sched-wrap">
      <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke={TV.muted} strokeWidth="2"
        style={{ position:'absolute', left:11, pointerEvents:'none', zIndex:1 }}>
        <rect x="3" y="4" width="18" height="18" rx="2"/>
        <line x1="3" y1="10" x2="21" y2="10"/>
        <line x1="16" y1="2" x2="16" y2="6"/>
        <line x1="8" y1="2" x2="8" y2="6"/>
      </svg>
      <select
        className="sv-sched-select"
        value={activeName || ''}
        onChange={e => e.target.value && onChange(e.target.value)}
        disabled={loading || initLoading}
      >
        {initLoading ? (
          <option value="">Loading…</option>
        ) : (
          <>
            {!activeName && <option value="">— Select schedule —</option>}
            {names.map(n => <option key={n} value={n}>{n}</option>)}
          </>
        )}
      </select>
      <div style={{ position:'absolute', right:10, pointerEvents:'none', display:'flex', alignItems:'center' }}>
        {(loading || initLoading) ? <Spinner /> : (
          <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke={TV.muted} strokeWidth="2.2">
            <polyline points="6 9 12 15 18 9"/>
          </svg>
        )}
      </div>
    </div>
  )
}

/* ── Save button ─────────────────────────────────────────────────────────── */
function SaveButton({ state, onClick }) {
  const map = {
    idle:   { label:'Save',    icon: <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M19 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h11l5 5v11a2 2 0 0 1-2 2z"/><polyline points="17 21 17 13 7 13 7 21"/><polyline points="7 3 7 8 15 8"/></svg>, cls: '' },
    saving: { label:'Saving…', icon: <Spinner />, cls: '' },
    saved:  { label:'Saved',   icon: <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"><polyline points="20 6 9 17 4 12"/></svg>, cls: 'saved' },
    error:  { label:'Failed',  icon: <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg>, cls: 'failed' },
  }
  const { label, icon, cls } = map[state] || map.idle
  return (
    <button className={`sv-save-btn ${cls}`} onClick={onClick} disabled={state === 'saving'}>
      {icon}{label}
    </button>
  )
}

/* ── Other-dept course filter ───────────────────────────────────────────────────────────────────────────── */
// GEC, MAT, NSTP, PATHFIT, PE sessions are managed by other departments and
// will always be TBA — exclude them from unassigned counts to avoid false alarms.
const _SV_OTHER_PREFIXES = ["GEC", "MAT", "MATH", "NSTP", "PATHFIT", "PE"]
function svIsOtherDept(courseCode = "") {
  const upper = courseCode.toUpperCase().trim()
  return _SV_OTHER_PREFIXES.some(p => upper.startsWith(p))
}

/* ════════════════════════════════════════════════════════════════════════════
   Main page
   ════════════════════════════════════════════════════════════════════════════ */
export default function ScheduleViewPage() {
  const { events:storeEvents, scheduleName:storeName, setEvents, setName } = useScheduleStore()

  const [localEvents,       setLocalEvents]   = useState(storeEvents)
  const [past,              setPast]          = useState([])
  const [future,            setFuture]        = useState([])
  const [masterRooms,       setMasterRooms]   = useState({ lecture:[], lab:[] })
  const [masterFacultyList, setMasterFaculty] = useState([])
  const [savedNames,        setSavedNames]    = useState([])
  const [activeName,        setActiveName]    = useState(storeName)
  const [isEditingName,     setIsEditingName] = useState(false)
  const [tempName,          setTempName]      = useState('')
  const [activeDay,         setActiveDay]     = useState('Monday')
  const [initLoading,       setInitLoading]   = useState(true)
  const [loading,           setLoading]       = useState(false)
  const [saveState,         setSaveState]     = useState('idle')
  const [error,             setError]         = useState(null)
  const [selectedEvent,     setSelectedEvent] = useState(null)
  const [viewMode,          setViewMode]      = useState('grid')
  const [gridSize,          setGridSize]       = useState('normal') // 'compact' | 'normal' | 'maximize'
  const [maximizeDensity,   setMaximizeDensity] = useState('normal') // density inside fullscreen: 'compact' | 'normal'
  const [maximizeFilterOpen, setMaximizeFilterOpen] = useState(false)
  const [openModal,         setOpenModal]     = useState(null)
  const [filterMerged,      setFilterMerged]  = useState(false)
  const [filterLec,         setFilterLec]     = useState(false)
  const [filterLab,         setFilterLab]     = useState(false)

  /* ── Bootstrap ──────────────────────────────────────────────────────────── */
  useEffect(() => {
    Promise.all([getRooms(), getFaculty()])
      .then(([r, f]) => { setMasterRooms(r); setMasterFaculty(f) })
      .catch(() => {})
    getSchedules()
      .then(r => setSavedNames(r.names || []))
      .catch(() => {})
      .finally(() => setInitLoading(false))
  }, [])

  /* ── Load schedule ──────────────────────────────────────────────────────── */
  async function loadSchedule(name) {
    if (!name || name === activeName) return
    setLoading(true); setError(null); setSaveState('idle')
    try {
      const data = await getSchedules(name)
      setLocalEvents(data.events); setEvents(data.events)
      setPast([]); setFuture([])
      setActiveName(name); setName(name)
    } catch { setError(`Failed to load "${name}".`) }
    finally   { setLoading(false) }
  }

  /* ── Save schedule ──────────────────────────────────────────────────────── */
  async function handleSave() {
    if (!activeName || saveState === 'saving') return
    setSaveState('saving')
    try {
      await saveSchedule(activeName)
      setSaveState('saved')
      setTimeout(() => setSaveState('idle'), 2500)
    } catch {
      setSaveState('error')
      setTimeout(() => setSaveState('idle'), 2200)
    }
  }

  /* ── Rename ─────────────────────────────────────────────────────────────── */
  function handleSaveName() {
    if (tempName.trim()) { setActiveName(tempName.trim()); setName(tempName.trim()) }
    setIsEditingName(false)
  }

  useEffect(() => {
    if (storeEvents.length > 0 && localEvents.length === 0) setLocalEvents(storeEvents)
  }, [storeEvents])

  /* ── Undo / Redo ────────────────────────────────────────────────────────── */
  const syncLocalEvents = useCallback(updated => {
    setLocalEvents(prev => {
      setPast(p => [...p, prev])
      setFuture([])
      setEvents(updated)
      return updated
    })
  }, [setEvents])

  const undo = () => {
    setLocalEvents(current => {
      if (past.length === 0) return current
      const previous = past[past.length - 1]
      setPast(past.slice(0, -1))
      setFuture([current, ...future])
      setEvents(previous)
      return previous
    })
  }

  const redo = () => {
    setLocalEvents(current => {
      if (future.length === 0) return current
      const next = future[0]
      setFuture(future.slice(1))
      setPast([...past, current])
      setEvents(next)
      return next
    })
  }

  /* ── Derived data ───────────────────────────────────────────────────────── */
  const allEvents   = localEvents
  const conflictMap = useMemo(() => buildConflictMap(allEvents.filter(e => e.day === activeDay)), [allEvents, activeDay])

  const filters = useFilters(allEvents, masterFacultyList, masterRooms, activeDay)
  const {
    dayEvents: rawDayEvents, options, searchQuery, setSearchQuery,
    filterFac, filterPrograms, filterRooms, filterYears, filterBlocks, filterSessions,
    filterConflicts, filterUnassigned,
    toggles, hasFilters, clearFilters,
  } = filters

  // Derived from ALL events — never filtered — so badges are always accurate
  const mergedIds = useMemo(() => getMergedIds(allEvents), [allEvents])

  const dayEvents = useMemo(() => {
    let evs = rawDayEvents
    if (filterMerged) evs = evs.filter(e => mergedIds.has(getEventId(e)))
    if (filterLec && !filterLab) evs = evs.filter(e => !e.session?.toUpperCase().includes('LAB'))
    if (filterLab && !filterLec) evs = evs.filter(e =>  e.session?.toUpperCase().includes('LAB'))
    return evs
  }, [rawDayEvents, filterMerged, filterLec, filterLab, mergedIds])

  const localHasFilters = hasFilters || filterMerged || filterLec || filterLab
  const handleClearAll  = () => { clearFilters(); setFilterMerged(false); setFilterLec(false); setFilterLab(false) }

  /* ── Drag & drop — now with pending overrides + conflict ids ──────────── */
  const dd = useDragDrop(allEvents, activeDay, syncLocalEvents, setEvents, storeEvents)

  const allDayRooms = useMemo(() => {
    const occupied = new Set(dayEvents.map(e => e.room).filter(Boolean))
    const master   = [...masterRooms.lecture, ...masterRooms.lab]
    const merged   = master.length > 0 ? master.filter(r => occupied.has(r) || master.includes(r)) : [...occupied]
    const extra    = [...occupied].filter(r => r !== 'TBA' && !merged.includes(r))
    return [...merged, ...extra].filter(r => r && r !== 'TBA')
  }, [dayEvents, masterRooms])

  const visibleRooms = useMemo(() => {
    if (filterRooms.size > 0) return allDayRooms.filter(r => filterRooms.has(r))
    return allDayRooms
  }, [allDayRooms, filterRooms])

  const dayCounts = useMemo(() => {
    const m = {}
    DAYS.forEach(d => { m[d] = allEvents.filter(e => e.day === d).length })
    return m
  }, [allEvents])

  // FIX: exclude GEC/MAT/NSTP/PATHFIT/PE — always TBA, managed externally
  const unassignedCount = dayEvents.filter(e => (!e.faculty || e.faculty === 'TBA') && !svIsOtherDept(e.courseCode)).length
  const hasNoSchedule   = allEvents.length === 0 && !loading

  const statItems = [
    { label:'Sessions',      value: dayEvents.length,    sub: `on ${activeDay}` },
    { label:'Total overall', value: allEvents.length,    sub: 'all days', accent: '#A99BE8' },
    { label:'Conflicts',     value: conflictMap.size,    accent: conflictMap.size  > 0 ? '#ef4444' : TV.deep, sub: 'detected'   },
    { label:'Unassigned',    value: unassignedCount,     accent: unassignedCount   > 0 ? '#f59e0b' : TV.deep, sub: 'dept courses only' },
    { label:'Faculty',       value: new Set(dayEvents.map(e => e.faculty).filter(f => f && f !== 'TBA')).size, sub: 'teaching' },
    { label:'Rooms',         value: visibleRooms.length, sub: 'in use' },
    // ── New: pending changes count in stats
    ...(dd.pendingOverrides.size > 0 ? [{ label:'Pending', value: dd.pendingOverrides.size, accent: '#d97706', sub: 'unsaved' }] : []),
  ]

  const Sep = () => <div style={{ width:1, height:20, background:TV.border, flexShrink:0 }} />

  /* ════════════════════ RENDER ════════════════════════════════════════════ */
  return (
    <div className="page" style={{ paddingBottom:40, overflowX:'hidden', width:'100%', minWidth:0 }}>

      {/* ── Header ───────────────────────────────────────────────────────── */}
      <div style={{ display:'flex', alignItems:'center', justifyContent:'space-between', gap:12, flexWrap:'wrap', marginBottom:20 }}>
        <div style={{ display:'flex', alignItems:'center', gap:10 }}>
          {isEditingName ? (
            <div style={{ display:'flex', alignItems:'center', gap:8 }}>
              <input
                autoFocus value={tempName}
                onChange={e => setTempName(e.target.value)}
                onKeyDown={e => e.key === 'Enter' && handleSaveName()}
                style={{ fontSize:20, fontWeight:700, padding:'4px 10px', borderRadius:8, border:`2px solid ${TV.mid}`, outline:'none', width:230, fontFamily:'Poppins,sans-serif' }}
              />
              <button onClick={handleSaveName} style={{ padding:'6px 14px', background:TV.deep, color:'#fff', border:'none', borderRadius:8, fontWeight:600, cursor:'pointer', fontFamily:'Poppins,sans-serif' }}>Save</button>
              <button onClick={() => setIsEditingName(false)} style={{ padding:'6px 14px', background:'#fff', border:`1px solid ${TV.border}`, borderRadius:8, fontWeight:600, cursor:'pointer', fontFamily:'Poppins,sans-serif' }}>Cancel</button>
            </div>
          ) : (
            <div style={{ display:'flex', alignItems:'center', gap:10 }}>
              <h1 className="page-title" style={{ margin:0, fontSize:22 }}>
                {activeName || 'Untitled Schedule'}
              </h1>
              {activeName && (
                <button
                  onClick={() => { setTempName(activeName); setIsEditingName(true) }}
                  style={{ background:'transparent', border:'none', cursor:'pointer', color:TV.muted, display:'flex', alignItems:'center', padding:4, borderRadius:6 }}
                  title="Rename"
                >
                  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                    <path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"/>
                    <path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"/>
                  </svg>
                </button>
              )}
            </div>
          )}
        </div>
        {!isEditingName && (
          <div style={{ display:'flex', gap:8, alignItems:'center', flexShrink:0 }}>
            {(initLoading || savedNames.length > 0) && (
              <ScheduleDropdown names={savedNames} activeName={activeName} loading={loading} initLoading={initLoading} onChange={loadSchedule} />
            )}
            {activeName && <SaveButton state={saveState} onClick={handleSave} />}
          </div>
        )}
      </div>

      {/* ── Stats ────────────────────────────────────────────────────────── */}
      {allEvents.length > 0 && <StatsRow items={statItems} />}

      {/* ── Pending changes bar ───────────────────────────────────────────── */}
      {/* Appears below stats, above day selector — amber, prominent */}
      <PendingChangesBar
        pendingOverrides={dd.pendingOverrides}
        onSave={dd.saveAllOverrides}
        onRevertAll={dd.revertAllOverrides}
        saving={dd.saving}
      />

      

      {/* ── Filters bar ──────────────────────────────────────────────────── */}
      {allEvents.length > 0 && (
        <div style={{ background:'#fff', border:`1px solid ${TV.border}`, borderRadius:12, padding:'11px 14px', marginBottom:14, display:'flex', flexDirection:'column', gap:10 }}>
          <div style={{ display:'flex', alignItems:'center', gap:8, flexWrap:'wrap' }}>
            <div style={{ position:'relative', flexShrink:0 }}>
              <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke={TV.muted} strokeWidth="2"
                style={{ position:'absolute', left:10, top:'50%', transform:'translateY(-50%)', pointerEvents:'none' }}>
                <circle cx="11" cy="11" r="8"/><line x1="21" y1="21" x2="16.65" y2="16.65"/>
              </svg>
              <input
                className="sv-search"
                placeholder="Course, block, faculty…"
                value={searchQuery}
                onChange={e => setSearchQuery(e.target.value)}
              />
            </div>
            <Sep />
            <FilterRow label="Program">
              <div style={{ display:'flex', gap:5, flexWrap:'wrap' }}>
                {options.allPrograms.map(p => (
                  <button key={p} className={`sv-chip${filterPrograms.has(p)?' active':''}`} onClick={() => toggles.program(p)}>
                    {p}
                  </button>
                ))}
              </div>
            </FilterRow>
            <Sep />
            <FilterRow label="Year">
              {options.allYears.map(y => (
                <button key={y} className={`sv-chip${filterYears.has(y)?' active':''}`} onClick={() => toggles.year(y)}>
                  Yr {y}
                </button>
              ))}
            </FilterRow>
            <Sep />
            <FilterRow label="Block">
              {options.allBlocks.map(b => (
                <button key={b} className={`sv-chip${filterBlocks.has(b)?' active':''}`} onClick={() => toggles.block(b)}>
                  {b}
                </button>
              ))}
            </FilterRow>
            <FilterRow label="Session">
              <button className={`sv-chip${filterLec?' active':''}`} onClick={() => setFilterLec(!filterLec)}>
                Lecture
              </button>
              <button className={`sv-chip${filterLab?' active':''}`} onClick={() => setFilterLab(!filterLab)}>
                Laboratory
              </button>
            </FilterRow>
            <Sep />
            <FilterRow label="Faculty">
              <FilterButton active={filterFac.size > 0} count={filterFac.size} onClick={() => setOpenModal('faculty')} />
            </FilterRow>
            <FilterRow label="Room">
              <FilterButton active={filterRooms.size > 0} count={filterRooms.size} onClick={() => setOpenModal('room')} />
            </FilterRow>
            <Sep />
            <button onClick={toggles.conflicts} style={{
              display:'inline-flex', alignItems:'center', gap:4,
              padding:'3px 10px', borderRadius:20, fontSize:11, cursor:'pointer',
              fontFamily:'Poppins,sans-serif', transition:'all .15s',
              fontWeight: filterConflicts ? 700 : 400,
              border: `1px solid ${filterConflicts ? '#fca5a5' : TV.border}`,
              background: filterConflicts ? '#fef2f2' : '#fff',
              color: filterConflicts ? '#b91c1c' : TV.muted,
            }}>
              <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                <path d="M10.29 3.86L1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z"/>
                <line x1="12" y1="9" x2="12" y2="13"/><line x1="12" y1="17" x2="12.01" y2="17"/>
              </svg>
              Conflicts
            </button>
            <button onClick={() => setFilterMerged(!filterMerged)} style={{
              display:'inline-flex', alignItems:'center', gap:4,
              padding:'3px 10px', borderRadius:20, fontSize:11, cursor:'pointer',
              fontFamily:'Poppins,sans-serif', transition:'all .15s',
              fontWeight: filterMerged ? 700 : 400,
              border: `1px solid ${filterMerged ? TV.light : TV.border}`,
              background: filterMerged ? TV.pale : '#fff',
              color: filterMerged ? TV.deep : TV.muted,
            }}>
              <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                <path d="M10 13a5 5 0 0 0 7.54.54l3-3a5 5 0 0 0-7.07-7.07l-1.72 1.71"/>
                <path d="M14 11a5 5 0 0 0-7.54-.54l-3 3a5 5 0 0 0 7.07 7.07l1.71-1.71"/>
              </svg>
              Merged
            </button>
            <button onClick={toggles.unassigned} style={{
              display:'inline-flex', alignItems:'center', gap:4,
              padding:'3px 10px', borderRadius:20, fontSize:11, cursor:'pointer',
              fontFamily:'Poppins,sans-serif', transition:'all .15s',
              fontWeight: filterUnassigned ? 700 : 400,
              border: `1px solid ${filterUnassigned ? '#fcd34d' : TV.border}`,
              background: filterUnassigned ? '#fffbeb' : '#fff',
              color: filterUnassigned ? '#92400e' : TV.muted,
            }}>
              <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                <circle cx="12" cy="12" r="10"/>
              </svg>
              Unassigned
            </button>
            {localHasFilters && (
              <button onClick={handleClearAll} style={{
                fontSize:11.5, color:'#dc2626', background:'#fff8f8',
                border:'1px solid #fecaca', borderRadius:8, padding:'4px 10px',
                cursor:'pointer', fontFamily:'Poppins,sans-serif', fontWeight:600,
                flexShrink:0, marginLeft:'auto',
              }}>
                ✕ Clear all
              </button>
            )}
          </div>

          {/* Legend */}
          <div style={{ display:'flex', alignItems:'center', gap:14, paddingTop:10, borderTop:`1px solid ${TV.border}` }}>
            {[
              { bg:'#fff', border:TV.border, label:'Normal', color:TV.muted },
              { bg:TV.pale, border:TV.light, label:'Merge', color:TV.deep,
                icon: <svg width="9" height="9" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"><path d="M10 13a5 5 0 0 0 7.54.54l3-3a5 5 0 0 0-7.07-7.07l-1.72 1.71"/><path d="M14 11a5 5 0 0 0-7.54-.54l-3 3a5 5 0 0 0 7.07 7.07l1.71-1.71"/></svg> },
              { bg:'#fef2f2', border:'#fecaca', label:'Conflict', color:'#b91c1c',
                icon: <svg width="9" height="9" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"><path d="M10.29 3.86L1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z"/><line x1="12" y1="9" x2="12" y2="13"/><line x1="12" y1="17" x2="12.01" y2="17"/></svg> },
              { bg:'#fffbeb', border:'#fcd34d', label:'Unassigned', color:'#92400e',
                icon: <svg width="9" height="9" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"><circle cx="12" cy="12" r="10"/></svg> },
            ].map(({ bg, border, label, color, icon }) => (
              <div key={label} style={{ display:'flex', alignItems:'center', gap:6 }}>
                <div style={{ display:'flex', alignItems:'center', justifyContent:'center', width:14, height:14, border:`1.5px solid ${border}`, borderRadius:3, background:bg, color, flexShrink:0 }}>
                  {icon ?? null}
                </div>
                <span style={{ fontSize:11, color, fontWeight: icon ? 600 : 500 }}>{label}</span>
              </div>
            ))}
          </div>
        </div>
      )}

{/* ── Day selector + View toggles ───────────────────────────────────── */}
      {allEvents.length > 0 && (
        <div style={{ display:'flex', alignItems:'center', justifyContent:'space-between', gap:8, marginBottom:16, flexWrap:'wrap' }}>
          <div style={{ display:'flex', gap:6, flexWrap:'wrap' }}>
            {DAYS.map(d => (
              <button key={d} onClick={() => setActiveDay(d)}
                className={`sv-day-btn${activeDay===d?' active':''}`}>
                {d.slice(0,3)}
                {dayCounts[d] > 0 && (
                  <span style={{ marginLeft:4, fontSize:9.5, fontWeight:700, opacity: activeDay===d ? 1 : .6 }}>
                    {dayCounts[d]}
                  </span>
                )}
              </button>
            ))}
          </div>

          <div style={{ display:'flex', gap:6, alignItems:'center', flexShrink:0 }}>
            <div style={{ display:'flex', gap:6, alignItems:'center', borderRight: `1px solid ${TV.border}`, paddingRight: 8, marginRight: 2 }}>
              <button onClick={undo} disabled={past.length === 0} className="sv-icon-btn" title="Undo" style={{ opacity: past.length === 0 ? 0.4 : 1, cursor: past.length === 0 ? 'not-allowed' : 'pointer' }}>
                <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <path d="M3 7v6h6"/><path d="M21 17a9 9 0 0 0-9-9 9 9 0 0 0-6 2.3L3 13"/>
                </svg>
              </button>
              <button onClick={redo} disabled={future.length === 0} className="sv-icon-btn" title="Redo" style={{ opacity: future.length === 0 ? 0.4 : 1, cursor: future.length === 0 ? 'not-allowed' : 'pointer' }}>
                <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <path d="M21 7v6h-6"/><path d="M3 17a9 9 0 0 1 9-9 9 9 0 0 1 6 2.3l3 2.7"/>
                </svg>
              </button>
            </div>
            <div className="sv-view-group">
              {[
                ['grid', 'Grid', (
                  <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                    <rect x="3" y="3" width="7" height="7"/><rect x="14" y="3" width="7" height="7"/>
                    <rect x="3" y="14" width="7" height="7"/><rect x="14" y="14" width="7" height="7"/>
                  </svg>
                )],
                ['list', 'List', (
                  <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                    <line x1="8" y1="6" x2="21" y2="6"/><line x1="8" y1="12" x2="21" y2="12"/>
                    <line x1="8" y1="18" x2="21" y2="18"/><line x1="3" y1="6" x2="3.01" y2="6"/>
                    <line x1="3" y1="12" x2="3.01" y2="12"/><line x1="3" y1="18" x2="3.01" y2="18"/>
                  </svg>
                )],
              ].map(([v, label, icon], i, arr) => (
                <button key={v} onClick={() => setViewMode(v)} title={`${label} view`}
                  className={`sv-view-btn${viewMode===v?' active':''}`}
                  style={{ borderRight: i < arr.length-1 ? `1px solid ${TV.border}` : 'none' }}>
                  {icon} {label}
                </button>
              ))}
            </div>
            <div className="sv-view-group">
              {[
                ['compact',  'Compact',  (
                  <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                    <line x1="3" y1="5" x2="21" y2="5"/><line x1="3" y1="9" x2="21" y2="9"/>
                    <line x1="3" y1="13" x2="21" y2="13"/><line x1="3" y1="17" x2="21" y2="17"/><line x1="3" y1="21" x2="21" y2="21"/>
                  </svg>
                )],
                ['normal',   'Normal',   (
                  <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                    <line x1="3" y1="5" x2="21" y2="5"/><line x1="3" y1="11" x2="21" y2="11"/>
                    <line x1="3" y1="17" x2="21" y2="17"/>
                  </svg>
                )],
                ['maximize', 'Maximize', (
                  <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                    <polyline points="15 3 21 3 21 9"/><polyline points="9 21 3 21 3 15"/>
                    <line x1="21" y1="3" x2="14" y2="10"/><line x1="3" y1="21" x2="10" y2="14"/>
                  </svg>
                )],
              ].map(([size, label, icon], i, arr) => (
                <button key={size}
                  onClick={() => setGridSize(size)}
                  title={`${label} density`}
                  className={`sv-view-btn${gridSize === size ? ' active' : ''}`}
                  style={{ borderRight: i < arr.length - 1 ? `1px solid ${TV.border}` : 'none' }}
                >
                  {icon} {label}
                </button>
              ))}
            </div>
          </div>
        </div>
      )}

      {/* ── Main content ─────────────────────────────────────────────────── */}
      {loading ? (
        <Spinner full />
      ) : hasNoSchedule ? (
        <div style={{ background:'#fff', border:`1px solid ${TV.border}`, borderRadius:14, padding:48, textAlign:'center' }}>
          <div style={{ width:56, height:56, borderRadius:16, background:TV.pale, display:'flex', alignItems:'center', justifyContent:'center', margin:'0 auto 16px' }}>
            <svg width="26" height="26" viewBox="0 0 24 24" fill="none" stroke={TV.deep} strokeWidth="1.8">
              <rect x="3" y="4" width="18" height="18" rx="2"/>
              <line x1="16" y1="2" x2="16" y2="6"/>
              <line x1="8" y1="2" x2="8" y2="6"/>
              <line x1="3" y1="10" x2="21" y2="10"/>
            </svg>
          </div>
          <p style={{ fontSize:15, fontWeight:700, color:TV.text, marginBottom:6 }}>No Schedule Loaded</p>
          <p style={{ fontSize:13, color:TV.muted }}>
            {savedNames.length > 0 || initLoading
              ? 'Select a saved schedule from the dropdown above to view it.'
              : 'Generate a schedule in the Scheduler page first.'}
          </p>
        </div>
      ) : viewMode === 'list' ? (
        <ListView
          dayEvents={dayEvents} 
          conflictMap={conflictMap}
          hasFilters={localHasFilters} 
          clearFilters={handleClearAll}
          onCardClick={setSelectedEvent}
          mergedIds={mergedIds}
        />
      ) : gridSize === 'maximize' ? (
        /* ── Fullscreen overlay for maximize mode ── */
        <div style={{
          position: 'fixed', inset: 0, zIndex: 200,
          background: '#fff',
          display: 'flex', flexDirection: 'column',
          fontFamily: 'Poppins, sans-serif',
        }}>

          {/* ── Top bar: Unified Header (Name + Days + Controls) ── */}
          <div style={{
            flexShrink: 0,
            display: 'flex', alignItems: 'center', justifyContent: 'space-between',
            padding: '0 16px', height: 56, // Slightly taller to comfortably fit day buttons
            borderBottom: `1px solid ${TV.border}`,
            background: 'linear-gradient(to bottom,#F7F6FD,#FAFAFE)',
          }}>
            
            {/* Left: name + stats + conflict */}
            <div style={{ display: 'flex', alignItems: 'center', gap: 12, minWidth: 0, flex: 1 }}>
              <span style={{ fontSize: 13.5, fontWeight: 700, color: TV.text, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis', maxWidth: 180 }}>
                {activeName || 'Schedule'}
              </span>
              <div style={{ width: 1, height: 16, background: TV.border }} />
              <span style={{ fontSize: 11, color: TV.muted, whiteSpace: 'nowrap', flexShrink: 0 }}>
                {dayEvents.length} session{dayEvents.length !== 1 ? 's' : ''}
              </span>
              <ConflictSummaryBar conflictMap={conflictMap} compact />
            </div>

            {/* Center: Day Switcher */}
            <div style={{ display: 'flex', alignItems: 'center', gap: 5, flexShrink: 0 }}>
              {DAYS.map(d => (
                <button key={d} onClick={() => setActiveDay(d)}
                  className={`sv-day-btn${activeDay === d ? ' active' : ''}`}
                  style={{ padding: '5px 12px', fontSize: 11 }}>
                  {d.slice(0, 3)}
                  {dayCounts[d] > 0 && (
                    <span style={{ marginLeft: 4, fontSize: 9.5, fontWeight: 700, opacity: activeDay === d ? 1 : .6 }}>
                      {dayCounts[d]}
                    </span>
                  )}
                </button>
              ))}
            </div>

            {/* Right: undo/redo + density + filter + exit */}
            <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexShrink: 0, flex: 1, justifyContent: 'flex-end' }}>
              
              <div style={{ display:'flex', gap:6, alignItems:'center', borderRight: `1px solid ${TV.border}`, paddingRight: 8 }}>
                <button onClick={undo} disabled={past.length === 0} className="sv-icon-btn" title="Undo" style={{ opacity: past.length === 0 ? 0.4 : 1, cursor: past.length === 0 ? 'not-allowed' : 'pointer', width: 28, height: 28 }}>
                  <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                    <path d="M3 7v6h6"/><path d="M21 17a9 9 0 0 0-9-9 9 9 0 0 0-6 2.3L3 13"/>
                  </svg>
                </button>
                <button onClick={redo} disabled={future.length === 0} className="sv-icon-btn" title="Redo" style={{ opacity: future.length === 0 ? 0.4 : 1, cursor: future.length === 0 ? 'not-allowed' : 'pointer', width: 28, height: 28 }}>
                  <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                    <path d="M21 7v6h-6"/><path d="M3 17a9 9 0 0 1 9-9 9 9 0 0 1 6 2.3l3 2.7"/>
                  </svg>
                </button>
              </div>

              <div className="sv-view-group">
                {[
                  ['compact', 'Compact', (
                    <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                      <line x1="3" y1="5" x2="21" y2="5"/><line x1="3" y1="9" x2="21" y2="9"/>
                      <line x1="3" y1="13" x2="21" y2="13"/><line x1="3" y1="17" x2="21" y2="17"/><line x1="3" y1="21" x2="21" y2="21"/>
                    </svg>
                  )],
                  ['normal', 'Normal', (
                    <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                      <line x1="3" y1="5" x2="21" y2="5"/><line x1="3" y1="11" x2="21" y2="11"/>
                      <line x1="3" y1="17" x2="21" y2="17"/>
                    </svg>
                  )],
                ].map(([density, label, icon], i, arr) => (
                  <button key={density} onClick={() => setMaximizeDensity(density)}
                    className={`sv-view-btn${maximizeDensity === density ? ' active' : ''}`}
                    style={{ borderRight: i < arr.length - 1 ? `1px solid ${TV.border}` : 'none' }}>
                    {icon} {label}
                  </button>
                ))}
              </div>

              <button onClick={() => setMaximizeFilterOpen(true)} style={{
                  display: 'inline-flex', alignItems: 'center', gap: 6,
                  padding: '5px 12px', borderRadius: 8,
                  border: `1px solid ${localHasFilters ? TV.mid : TV.border}`,
                  background: localHasFilters ? TV.pale : '#fff',
                  color: localHasFilters ? TV.deep : TV.muted,
                  fontSize: 12, fontWeight: localHasFilters ? 700 : 500,
                  cursor: 'pointer', fontFamily: 'Poppins, sans-serif',
                  transition: 'all .15s',
                }}>
                <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                  <polygon points="22 3 2 3 10 12.46 10 19 14 21 14 12.46 22 3"/>
                </svg>
                Filters
                {localHasFilters && (
                  <span style={{ background: TV.deep, color: '#fff', borderRadius: 10, fontSize: 9, fontWeight: 800, padding: '1px 5px', lineHeight: 1.4 }}>
                    ON
                  </span>
                )}
              </button>

              <button onClick={() => setGridSize('normal')} style={{
                  display: 'inline-flex', alignItems: 'center', gap: 6,
                  padding: '5px 12px', borderRadius: 8, border: `1px solid ${TV.border}`,
                  background: '#fff', color: TV.deep, fontSize: 12, fontWeight: 600,
                  cursor: 'pointer', fontFamily: 'Poppins, sans-serif', transition: 'all .15s',
                }}
                onMouseEnter={e => { e.currentTarget.style.background = TV.pale; e.currentTarget.style.borderColor = TV.mid }}
                onMouseLeave={e => { e.currentTarget.style.background = '#fff'; e.currentTarget.style.borderColor = TV.border }}>
                <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                  <polyline points="4 14 10 14 10 20"/><polyline points="20 10 14 10 14 4"/>
                  <line x1="10" y1="14" x2="21" y2="3"/><line x1="3" y1="21" x2="14" y2="10"/>
                </svg>
                Exit
              </button>
            </div>
          </div>

          {/* ── Grid fills remaining space ── */}
          <div style={{ flex: 1, overflow: 'hidden', padding: '0 16px' }}>
            {dayEvents.length === 0
              ? <EmptyState hasFilters={localHasFilters} onClear={handleClearAll} />
              : (
                <TimeGrid
                  rooms={visibleRooms} dayEvents={dayEvents} conflictMap={conflictMap}
                  draggedEvent={dd.draggedEvent} hoveredCell={dd.hoveredCell} getDropConflict={dd.getDropConflict}
                  onDragStart={dd.handleDragStart} onDragEnd={dd.handleDragEnd} onDragOver={dd.handleDragOver}
                  onDragLeave={dd.handleDragLeave} onDrop={dd.handleDrop} onCardClick={setSelectedEvent}
                  gridSize={maximizeDensity} fullscreen={true} conflictingDragIds={dd.conflictingDragIds}
                  ambientConflictIds={dd.ambientConflictIds}
                  ambientMergeIds={dd.ambientMergeIds}
                  dragConflictBands={dd.dragConflictBands}
                  mergedIds={mergedIds}
                  allEvents={allEvents}
                />
              )
            }
          </div>

          {/* ── Compact Fullscreen filter modal ── */}
          {maximizeFilterOpen && (
            <ModalOverlay onClose={() => setMaximizeFilterOpen(false)}>
              <div style={{
                background: '#fff', borderRadius: 14,
                width: 680, maxWidth: '94vw', maxHeight: '88vh',
                display: 'flex', flexDirection: 'column',
                boxShadow: '0 24px 64px rgba(61,53,128,0.22)',
                border: `1px solid ${TV.border}`,
                fontFamily: 'Poppins, sans-serif',
                overflow: 'hidden',
              }}>
                <div style={{ padding: '16px 20px 0' }}>
                  <ModalHeader
                    title="Filters"
                    subtitle={localHasFilters ? 'Some filters are active' : 'Narrow down what you see in the grid'}
                    onClose={() => setMaximizeFilterOpen(false)}
                  />
                </div>

                <div style={{ flex: 1, overflowY: 'auto', padding: '12px 20px 20px', display: 'flex', flexDirection: 'column', gap: 18 }}>

                  {/* Row 1: Search & Quick Filters */}
                  <div style={{ display: 'grid', gridTemplateColumns: '1fr 1.2fr', gap: 20 }}>
                    <div>
                      <p style={{ fontSize: 9.5, fontWeight: 700, color: TV.muted, textTransform: 'uppercase', letterSpacing: '.7px', marginBottom: 6 }}>Search</p>
                      <div style={{ position: 'relative' }}>
                        <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke={TV.muted} strokeWidth="2" style={{ position: 'absolute', left: 10, top: '50%', transform: 'translateY(-50%)', pointerEvents: 'none' }}>
                          <circle cx="11" cy="11" r="8"/><line x1="21" y1="21" x2="16.65" y2="16.65"/>
                        </svg>
                        <input className="sv-search" placeholder="Course, block, faculty…" value={searchQuery} onChange={e => setSearchQuery(e.target.value)} style={{ width: '100%', boxSizing: 'border-box' }} />
                      </div>
                    </div>

                    <div>
                      <p style={{ fontSize: 9.5, fontWeight: 700, color: TV.muted, textTransform: 'uppercase', letterSpacing: '.7px', marginBottom: 6 }}>Quick Filters</p>
                      <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
                        <button onClick={toggles.conflicts} style={{
                          display: 'inline-flex', alignItems: 'center', gap: 5, padding: '4px 10px', borderRadius: 20, fontSize: 11, cursor: 'pointer', fontFamily: 'Poppins,sans-serif', transition: 'all .15s',
                          fontWeight: filterConflicts ? 700 : 400, border: `1px solid ${filterConflicts ? '#fca5a5' : TV.border}`, background: filterConflicts ? '#fef2f2' : '#fff', color: filterConflicts ? '#b91c1c' : TV.muted,
                        }}>
                          <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"><path d="M10.29 3.86L1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z"/><line x1="12" y1="9" x2="12" y2="13"/><line x1="12" y1="17" x2="12.01" y2="17"/></svg>
                          Conflicts only
                        </button>
                        <button onClick={() => setFilterMerged(!filterMerged)} style={{
                          display: 'inline-flex', alignItems: 'center', gap: 5, padding: '4px 10px', borderRadius: 20, fontSize: 11, cursor: 'pointer', fontFamily: 'Poppins,sans-serif', transition: 'all .15s',
                          fontWeight: filterMerged ? 700 : 400, border: `1px solid ${filterMerged ? TV.light : TV.border}`, background: filterMerged ? TV.pale : '#fff', color: filterMerged ? TV.deep : TV.muted,
                        }}>
                          <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"><path d="M10 13a5 5 0 0 0 7.54.54l3-3a5 5 0 0 0-7.07-7.07l-1.72 1.71"/><path d="M14 11a5 5 0 0 0-7.54-.54l-3 3a5 5 0 0 0 7.07 7.07l1.71-1.71"/></svg>
                          Merged only
                        </button>
                        <button onClick={toggles.unassigned} style={{
                          display: 'inline-flex', alignItems: 'center', gap: 5, padding: '4px 10px', borderRadius: 20, fontSize: 11, cursor: 'pointer', fontFamily: 'Poppins,sans-serif', transition: 'all .15s',
                          fontWeight: filterUnassigned ? 700 : 400, border: `1px solid ${filterUnassigned ? '#fcd34d' : TV.border}`, background: filterUnassigned ? '#fffbeb' : '#fff', color: filterUnassigned ? '#92400e' : TV.muted,
                        }}>
                          <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"><circle cx="12" cy="12" r="10"/></svg>
                          Unassigned only
                        </button>
                      </div>
                    </div>
                  </div>

                  <div style={{ height: 1, background: TV.border, width: '100%' }} />

                  {/* Row 2: Program, Year, Block */}
                  <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 16 }}>
                    <div>
                      <p style={{ fontSize: 9.5, fontWeight: 700, color: TV.muted, textTransform: 'uppercase', letterSpacing: '.7px', marginBottom: 6 }}>Program</p>
                      <div style={{ display: 'flex', gap: 5, flexWrap: 'wrap' }}>
                        {options.allPrograms.map(p => (<button key={p} className={`sv-chip${filterPrograms.has(p) ? ' active' : ''}`} onClick={() => toggles.program(p)}>{p}</button>))}
                      </div>
                    </div>
                    <div>
                      <p style={{ fontSize: 9.5, fontWeight: 700, color: TV.muted, textTransform: 'uppercase', letterSpacing: '.7px', marginBottom: 6 }}>Year</p>
                      <div style={{ display: 'flex', gap: 5, flexWrap: 'wrap' }}>
                        {options.allYears.map(y => (<button key={y} className={`sv-chip${filterYears.has(y) ? ' active' : ''}`} onClick={() => toggles.year(y)}>Yr {y}</button>))}
                      </div>
                    </div>
                    <div>
                      <p style={{ fontSize: 9.5, fontWeight: 700, color: TV.muted, textTransform: 'uppercase', letterSpacing: '.7px', marginBottom: 6 }}>Block</p>
                      <div style={{ display: 'flex', gap: 5, flexWrap: 'wrap' }}>
                        {options.allBlocks.map(b => (<button key={b} className={`sv-chip${filterBlocks.has(b) ? ' active' : ''}`} onClick={() => toggles.block(b)}>{b}</button>))}
                      </div>
                    </div>
                  </div>

                  <div style={{ height: 1, background: TV.border, width: '100%' }} />

                  {/* Row 3: Faculty, Room, Session Modal Triggers */}
                  <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 16 }}>
                    <div>
                      <p style={{ fontSize: 9.5, fontWeight: 700, color: TV.muted, textTransform: 'uppercase', letterSpacing: '.7px', marginBottom: 6 }}>Faculty</p>
                      <FilterButton active={filterFac.size > 0} count={filterFac.size} onClick={() => { setMaximizeFilterOpen(false); setOpenModal('faculty') }} />
                    </div>
                    <div>
                      <p style={{ fontSize: 9.5, fontWeight: 700, color: TV.muted, textTransform: 'uppercase', letterSpacing: '.7px', marginBottom: 6 }}>Room</p>
                      <FilterButton active={filterRooms.size > 0} count={filterRooms.size} onClick={() => { setMaximizeFilterOpen(false); setOpenModal('room') }} />
                    </div>
                    <div>
                      <p style={{ fontSize: 9.5, fontWeight: 700, color: TV.muted, textTransform: 'uppercase', letterSpacing: '.7px', marginBottom: 6 }}>Session</p>
                      <div style={{ display: 'flex', gap: 5, flexWrap: 'wrap' }}>
                        <button className={`sv-chip${filterLec ? ' active' : ''}`} onClick={() => setFilterLec(!filterLec)}>Lecture</button>
                        <button className={`sv-chip${filterLab ? ' active' : ''}`} onClick={() => setFilterLab(!filterLab)}>Laboratory</button>
                      </div>
                    </div>
                  </div>

                </div>

                {/* Footer */}
                <div style={{
                  flexShrink: 0, padding: '12px 20px', borderTop: `1px solid ${TV.border}`,
                  display: 'flex', alignItems: 'center', justifyContent: 'space-between', background: '#FAFAFE',
                }}>
                  <span style={{ fontSize: 11.5, color: TV.muted, fontWeight: 500 }}>
                    {dayEvents.length} session{dayEvents.length !== 1 ? 's' : ''} shown
                  </span>
                  <div style={{ display: 'flex', gap: 8 }}>
                    {localHasFilters && (
                      <button onClick={() => { handleClearAll(); }} style={{
                        padding: '6px 14px', borderRadius: 8, fontSize: 11.5, fontWeight: 600,
                        border: '1px solid #fecaca', background: '#fff8f8', color: '#dc2626',
                        cursor: 'pointer', fontFamily: 'Poppins,sans-serif',
                      }}>
                        ✕ Clear all
                      </button>
                    )}
                    <button onClick={() => setMaximizeFilterOpen(false)} style={{
                      padding: '6px 18px', borderRadius: 8, fontSize: 11.5, fontWeight: 600,
                      border: 'none', background: TV.deep, color: '#fff',
                      cursor: 'pointer', fontFamily: 'Poppins,sans-serif',
                    }}>
                      Done
                    </button>
                  </div>
                </div>
              </div>
            </ModalOverlay>
          )}
        </div>
      ) : (
        <div style={{
          background:'#fff', border:`1px solid ${TV.border}`, borderRadius:14,
          overflow:'hidden', boxShadow:'0 1px 4px rgba(124,111,205,.07)',
          display:'flex', flexDirection:'column', width:'100%', minWidth:0,
          padding:'12px 14px 0',
        }}>
          <ConflictSummaryBar conflictMap={conflictMap} />
          {dayEvents.length === 0
            ? <EmptyState hasFilters={localHasFilters} onClear={handleClearAll} />
            : (
              <TimeGrid
                rooms={visibleRooms}
                dayEvents={dayEvents}
                conflictMap={conflictMap}
                draggedEvent={dd.draggedEvent}
                hoveredCell={dd.hoveredCell}
                getDropConflict={dd.getDropConflict}
                onDragStart={dd.handleDragStart}
                onDragEnd={dd.handleDragEnd}
                onDragOver={dd.handleDragOver}
                onDragLeave={dd.handleDragLeave}
                onDrop={dd.handleDrop}
                onCardClick={setSelectedEvent}
                gridSize={gridSize}
                conflictingDragIds={dd.conflictingDragIds}
                ambientConflictIds={dd.ambientConflictIds}
                ambientMergeIds={dd.ambientMergeIds}
                dragConflictBands={dd.dragConflictBands}
                mergedIds={mergedIds}
                allEvents={allEvents}
              />
            )
          }
        </div>
      )}

      {/* ── Modals ───────────────────────────────────────────────────────── */}
      {selectedEvent && (
        <SessionModal
          event={selectedEvent}
          allEvents={allEvents}
          onClose={() => setSelectedEvent(null)}
          masterRooms={masterRooms}
          masterFacultyList={masterFacultyList}
          onSaved={(updates) => {
            setSelectedEvent(null)
            if (!updates) return
            const arr = Array.isArray(updates) ? updates : [updates]
            const patchMap = new Map(arr.map(u => [getEventId(u), u]))
            syncLocalEvents(localEvents.map(e =>
              patchMap.has(getEventId(e)) ? { ...e, ...patchMap.get(getEventId(e)) } : e
            ))
          }}
        />
      )}
      {openModal === 'faculty' && (
        <FacultyFilterModal title="Filter by Faculty" options={options.allFaculty}
          selectedSet={filterFac} onToggle={toggles.faculty} onClose={() => setOpenModal(null)}
          masterFacultyList={masterFacultyList}
          allEvents={allEvents}
          
          />
          
      )}
      {openModal === 'room' && (
        <RoomFilterModal title="Filter by Room" options={options.allRooms}
          selectedSet={filterRooms} onToggle={toggles.room}
          masterRooms={masterRooms} onClose={() => setOpenModal(null)} />

      )}

      {/* ── Override confirmation modal ────────────────────────────────── */}
      {/* Shown instead of blocking when a conflicting drop is attempted    */}
      <OverrideConfirmModal
        pendingDrop={dd.pendingDrop}
        onConfirm={dd.confirmDrop}
        onCancel={dd.cancelDrop}
      />

      {dd.toast && (
        <Toast
          type={dd.toast.type}
          onDismiss={() => dd.setToast(null)}
          message={
            <span style={{ display:'inline-flex', alignItems:'center', gap:6 }}>
              {dd.toast.icon === 'link' && (
                <svg width={13} height={13} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" style={{flexShrink:0}}>
                  <path d="M10 13a5 5 0 0 0 7.54.54l3-3a5 5 0 0 0-7.07-7.07l-1.72 1.71"/>
                  <path d="M14 11a5 5 0 0 0-7.54-.54l-3 3a5 5 0 0 0 7.07 7.07l1.71-1.71"/>
                </svg>
              )}
              {dd.toast.icon === 'unlink' && (
                <svg width={13} height={13} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" style={{flexShrink:0}}>
                  <path d="M10 13a5 5 0 0 0 7.54.54l3-3a5 5 0 0 0-7.07-7.07l-1.72 1.71"/>
                  <path d="M14 11a5 5 0 0 0-7.54-.54l-3 3a5 5 0 0 0 7.07 7.07l1.71-1.71"/>
                  <line x1="2" y1="2" x2="22" y2="22"/>
                </svg>
              )}
              {dd.toast.message}
            </span>
          }
        />
      )}
    </div>
  )
}

/* ── List view ───────────────────────────────────────────────────────────── */
function ListView({ dayEvents, conflictMap, hasFilters, clearFilters, onCardClick, mergedIds }) {
  if (dayEvents.length === 0) return <EmptyState hasFilters={hasFilters} onClear={clearFilters} />
  return (
    <div style={{ background:'#fff', border:`1px solid ${TV.border}`, borderRadius:14, overflow:'hidden' }}>
      <table style={{ width:'100%', borderCollapse:'collapse', fontSize:12.5 }}>
        <thead>
          <tr style={{ background:'#FAFAFE' }}>
            {['Time','Course','Section','Type','Faculty','Room','Status'].map(h => (
              <th key={h} style={{ padding:'10px 14px', textAlign:'left', fontSize:10.5, fontWeight:700, color:TV.muted, textTransform:'uppercase', letterSpacing:'.6px', borderBottom:`1px solid ${TV.border}`, whiteSpace:'nowrap' }}>
                {h}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {dayEvents.map((ev, i) => {
            const evId     = `${ev.schedule_id ?? `${ev.courseCode}-${ev.block}-${ev.session}-${ev.day}`}`
            const conf     = conflictMap.get(evId)
            const merged   = mergedIds.has(evId)
            const noFaculty = (!ev.faculty || ev.faculty === 'TBA') && !svIsOtherDept(ev.courseCode)
            const isExtManaged = (!ev.faculty || ev.faculty === 'TBA') && svIsOtherDept(ev.courseCode)
            const isLab    = ev.session?.toUpperCase().includes('LAB')
            const sessionType = isLab ? 'LAB' : 'LEC'
            return (
              <tr key={evId}
                onClick={() => onCardClick(ev)}
                style={{ borderBottom:`1px solid ${TV.border}`, cursor:'pointer', background:i%2===0?'#fff':'#FAFAFE', transition:'background .12s' }}
                onMouseEnter={e => e.currentTarget.style.background = TV.pale}
                onMouseLeave={e => e.currentTarget.style.background = i%2===0?'#fff':'#FAFAFE'}
              >
                <td style={{ padding:'10px 14px', whiteSpace:'nowrap', fontSize:11.5, color:TV.muted }}>{ev.period}</td>
                <td style={{ padding:'10px 14px' }}>
                  <span style={{ fontWeight:700, color:TV.text }}>{ev.courseCode}</span>
                  {ev.title && <span style={{ display:'block', fontSize:10.5, color:TV.muted, marginTop:1, maxWidth:180, overflow:'hidden', textOverflow:'ellipsis', whiteSpace:'nowrap' }}>{ev.title}</span>}
                </td>
                <td style={{ padding:'10px 14px', whiteSpace:'nowrap' }}>
                  <span style={{ fontSize:11.5, fontWeight:600, color:TV.deep, background:TV.pale, padding:'2px 7px', borderRadius:5, border:`1px solid ${TV.light}` }}>
                    {ev.program}{ev.year}{ev.block}
                  </span>
                </td>
                <td style={{ padding:'10px 14px', whiteSpace:'nowrap' }}>
                  <span style={{ fontSize:9, fontWeight:800, letterSpacing:'0.5px', color:isLab?TV.deep:TV.text, background:isLab?`rgba(124,111,205,.12)`:`rgba(0,0,0,.04)`, border:`1px solid ${isLab?TV.mid:TV.border}`, padding:'2px 6px', borderRadius:4 }}>
                    {sessionType}
                  </span>
                </td>
                <td style={{ padding:'10px 14px', fontSize:12, maxWidth:150, overflow:'hidden', textOverflow:'ellipsis', whiteSpace:'nowrap' }}>
                  {isExtManaged ? <span style={{ color:'#A99BE8', fontWeight:500 }}>Ext. managed</span> : noFaculty ? <span style={{ color:'#f59e0b', fontWeight:600 }}>Unassigned</span> : <span style={{ color:TV.text }}>{ev.faculty}</span>}
                </td>
                <td style={{ padding:'10px 14px', fontSize:12, color:TV.text, whiteSpace:'nowrap' }}>
                  {ev.room && ev.room !== 'TBA' ? ev.room : <span style={{ color:TV.muted }}>TBA</span>}
                </td>
                <td style={{ padding:'10px 14px' }}>
                  <div style={{ display:'flex', gap:5, flexWrap:'wrap' }}>
                    {/* Only show a conflict badge if the session isn't merged,
                        OR if it's merged but the conflict is NOT just a room
                        overlap with the merge partner (e.g. it also has a
                        faculty / section conflict). */}
                    {conf && !(merged && conf.label === 'Room Conflict') && (
                      <span style={{ display:'inline-flex', alignItems:'center', gap:4, fontSize:9.5, fontWeight:700, background:'#fef2f2', color:'#b91c1c', border:'1px solid #fecaca', borderRadius:4, padding:'2px 6px' }}>
                        <svg width={9} height={9} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><path d="M10.29 3.86L1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z"/><line x1="12" y1="9" x2="12" y2="13"/><line x1="12" y1="17" x2="12.01" y2="17"/></svg>
                        {conf.label}
                      </span>
                    )}
                    {merged && (
                      <span style={{ display:'inline-flex', alignItems:'center', gap:4, fontSize:9.5, fontWeight:700, background:TV.pale, color:TV.deep, border:`1px solid ${TV.light}`, borderRadius:4, padding:'2px 6px' }}>
                        <svg width={9} height={9} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><path d="M10 13a5 5 0 0 0 7.54.54l3-3a5 5 0 0 0-7.07-7.07l-1.72 1.71"/><path d="M14 11a5 5 0 0 0-7.54-.54l-3 3a5 5 0 0 0 7.07 7.07l1.71-1.71"/></svg>
                        Merge
                      </span>
                    )}
                    {isExtManaged && <span style={{ display:'inline-flex', alignItems:'center', gap:4, fontSize:9.5, fontWeight:600, background:'#F0EDF9', color:'#7C6FCD', border:'1px solid #D8D3F5', borderRadius:4, padding:'2px 6px' }}>Ext. managed</span>}
                    {noFaculty && !isExtManaged && <span style={{ display:'inline-flex', alignItems:'center', gap:4, fontSize:9.5, fontWeight:700, background:'#fffbeb', color:'#92400e', border:'1px solid #fcd34d', borderRadius:4, padding:'2px 6px' }}>Unassigned</span>}
                    {!conf && !merged && !noFaculty && <span style={{ fontSize:9.5, color:TV.muted }}>—</span>}
                    {/* Edge case: merged but also has a real non-room conflict */}
                    {conf && merged && conf.label === 'Room Conflict' && (
                      // Already suppressed above — merge badge above covers this
                      null
                    )}
                  </div>
                </td>
              </tr>
            )
          })}
        </tbody>
      </table>
    </div>
  )
}