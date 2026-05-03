import { useState, useMemo } from 'react'
import { overrideSession } from '../../services/api'
import {
  DAYS, YEAR_LABEL, DAY_END_HOUR, DAY_START_HOUR,
  parsePeriodRange, minutesToTimeLabel, findMergePartner,
  getEventId, findConflicts, TIME_SLOTS, programColor,
  timeOverlaps, areMergePartners,
} from './svHelpers'
import {
  ModalOverlay, ModalHeader, RoomChip, ConflictTable, TV,
} from './svPrimitives'

/* ── Inject styles once ────────────────────────────────────────────────────── */
if (!document.getElementById('sm-style')) {
  const s = document.createElement('style')
  s.id = 'sm-style'
  s.textContent = `
    @keyframes sm-in   { from{opacity:0;transform:scale(.97) translateY(8px)} to{opacity:1;transform:scale(1) translateY(0)} }
    @keyframes sm-spin { to{transform:rotate(360deg)} }

    .sm-tab {
      padding:6px 14px; border-radius:7px; border:none;
      font-family:'Poppins',sans-serif; font-size:12px; font-weight:500;
      cursor:pointer; background:transparent; color:#8883B0;
      transition:all 0.14s; white-space:nowrap;
      display:flex; align-items:center; gap:5px;
    }
    .sm-tab:hover  { background:#F0EDF9; color:#3D3580; }
    .sm-tab.active { background:#7C6FCD; color:#fff; box-shadow:0 3px 10px rgba(124,111,205,0.28); }
    .sm-tab .sm-badge {
      display:inline-flex; align-items:center; justify-content:center;
      min-width:16px; height:16px; padding:0 4px; border-radius:99px;
      font-size:9px; font-weight:700; background:#E8E4F8; color:#7C6FCD;
    }
    .sm-tab.active .sm-badge         { background:rgba(255,255,255,0.22); color:#fff; }
    .sm-tab.warn   .sm-badge         { background:#FFE8E8; color:#C0392B; }
    .sm-tab.active.warn .sm-badge    { background:rgba(255,90,90,0.28); color:#fff; }

    .sm-select {
      padding:8px 32px 8px 11px; font-size:12.5px; width:100%;
      border-radius:9px; border:1px solid #E8E4F8; background:#fff;
      font-family:'Poppins',sans-serif; color:#1a1a2e; outline:none;
      appearance:none; -webkit-appearance:none; cursor:pointer;
      transition:border-color .15s, box-shadow .15s;
      background-image:url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='11' height='11' viewBox='0 0 24 24' fill='none' stroke='%238883B0' stroke-width='2'%3E%3Cpolyline points='6 9 12 15 18 9'/%3E%3C/svg%3E");
      background-repeat:no-repeat; background-position:right 10px center;
    }
    .sm-select:focus { border-color:#A99BE8; box-shadow:0 0 0 3px rgba(169,155,232,.12); }
    .sm-select:hover { border-color:#C5BBEF; }

    .sm-time-row {
      padding:7px 12px; display:flex; align-items:center;
      justify-content:space-between; cursor:pointer;
      transition:background .1s; user-select:none;
    }
    .sm-time-row:hover { filter:brightness(.97); }

    .sm-fac-row {
      padding:8px 12px; display:flex; align-items:center;
      justify-content:space-between; cursor:pointer;
      transition:background .1s; user-select:none;
      border-bottom:1px solid #F0EDF9;
    }
    .sm-fac-row:last-child { border-bottom:none; }
    .sm-fac-row:hover { filter:brightness(.97); }

    .sm-save-btn {
      flex:1; padding:9px 16px; font-size:13px; font-weight:700;
      border:none; border-radius:9px; cursor:pointer;
      font-family:'Poppins',sans-serif; transition:all .15s;
      display:flex; align-items:center; justify-content:center; gap:6px;
    }
    .sm-cancel-btn {
      padding:9px 20px; font-size:13px; font-weight:600;
      border-radius:9px; cursor:pointer;
      font-family:'Poppins',sans-serif; transition:all .15s;
      background:#fff; color:#1a1a2e; border:1px solid #E8E4F8;
    }
    .sm-cancel-btn:hover { background:#F5F4FB; border-color:#C5BBEF; }

    .sm-field-label {
      font-size:10px; font-weight:700; color:#8883B0;
      text-transform:uppercase; letter-spacing:.8px; margin-bottom:8px;
      display:flex; align-items:center; gap:5px;
    }
    .sm-empty {
      display:flex; flex-direction:column; align-items:center;
      justify-content:center; padding:44px 20px; gap:10px; text-align:center;
    }
    .sm-view-link {
      background:none; border:none; font-size:11px; color:#7C6FCD;
      cursor:pointer; font-family:'Poppins',sans-serif; font-weight:600;
      padding:0; text-decoration:underline;
    }

    /* ── Batch tab styles ───────────────────────────────────────────────────── */
    .sm-batch-row {
      display:flex; align-items:flex-start; gap:12px; padding:11px 14px;
      border-radius:10px; border:1px solid #E8E4F8; background:#fff;
      transition:border-color .14s;
    }
    .sm-batch-row.has-conflict { border-color:#fca5a5; background:#fff8f8; }
    .sm-batch-row.success      { border-color:#86efac; background:#f0fdf4; }
  `
  document.head.appendChild(s)
}

/* ── Reusable SVG icons ───────────────────────────────────────────────────── */
const Ic = {
  Warning: ({ size=14, color='currentColor' }) => (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" style={{flexShrink:0}}>
      <path d="M10.29 3.86L1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z"/>
      <line x1="12" y1="9" x2="12" y2="13"/><line x1="12" y1="17" x2="12.01" y2="17"/>
    </svg>
  ),
  Link: ({ size=14, color='currentColor' }) => (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" style={{flexShrink:0}}>
      <path d="M10 13a5 5 0 0 0 7.54.54l3-3a5 5 0 0 0-7.07-7.07l-1.72 1.71"/>
      <path d="M14 11a5 5 0 0 0-7.54-.54l-3 3a5 5 0 0 0 7.07 7.07l1.71-1.71"/>
    </svg>
  ),
  MapPin: ({ size=14, color='currentColor' }) => (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" style={{flexShrink:0}}>
      <path d="M21 10c0 7-9 13-9 13s-9-6-9-13a9 9 0 0 1 18 0z"/><circle cx="12" cy="10" r="3"/>
    </svg>
  ),
  Clock: ({ size=14, color='currentColor' }) => (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" style={{flexShrink:0}}>
      <circle cx="12" cy="12" r="10"/><polyline points="12 6 12 12 16 14"/>
    </svg>
  ),
  User: ({ size=14, color='currentColor' }) => (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" style={{flexShrink:0}}>
      <path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2"/><circle cx="12" cy="7" r="4"/>
    </svg>
  ),
  Users: ({ size=14, color='currentColor' }) => (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" style={{flexShrink:0}}>
      <path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2"/>
      <circle cx="9" cy="7" r="4"/>
      <path d="M23 21v-2a4 4 0 0 0-3-3.87"/>
      <path d="M16 3.13a4 4 0 0 1 0 7.75"/>
    </svg>
  ),
  Calendar: ({ size=14, color='currentColor' }) => (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" style={{flexShrink:0}}>
      <rect x="3" y="4" width="18" height="18" rx="2"/>
      <line x1="3" y1="10" x2="21" y2="10"/>
      <line x1="16" y1="2" x2="16" y2="6"/>
      <line x1="8" y1="2" x2="8" y2="6"/>
    </svg>
  ),
  Check: ({ size=14, color='currentColor' }) => (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" style={{flexShrink:0}}>
      <polyline points="20 6 9 17 4 12"/>
    </svg>
  ),
  Save: ({ size=14, color='currentColor' }) => (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" style={{flexShrink:0}}>
      <path d="M19 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h11l5 5v11a2 2 0 0 1-2 2z"/>
      <polyline points="17 21 17 13 7 13 7 21"/>
      <polyline points="7 3 7 8 15 8"/>
    </svg>
  ),
  Door: ({ size=14, color='currentColor' }) => (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" style={{flexShrink:0}}>
      <path d="M3 21h18"/><path d="M9 3h12v18H9z"/><circle cx="15" cy="12" r="1" fill={color} stroke="none"/>
    </svg>
  ),
  AlertCircle: ({ size=14, color='currentColor' }) => (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" style={{flexShrink:0}}>
      <circle cx="12" cy="12" r="10"/>
      <line x1="12" y1="8" x2="12" y2="12"/><line x1="12" y1="16" x2="12.01" y2="16"/>
    </svg>
  ),
  CheckCircle: ({ size=14, color='currentColor' }) => (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" style={{flexShrink:0}}>
      <path d="M22 11.08V12a10 10 0 1 1-5.93-9.14"/>
      <polyline points="22 4 12 14.01 9 11.01"/>
    </svg>
  ),
  Spin: ({ size=14, color=TV.deep }) => (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth="2.2" style={{animation:'sm-spin .75s linear infinite', flexShrink:0}}>
      <path d="M21 12a9 9 0 1 1-6.219-8.56"/>
    </svg>
  ),
}



export function OverrideConfirmDialog({ event, newDay, newPeriod, newRoom, newFaculty, conflicts, onConfirm, onCancel }) {
  return (
    <ModalOverlay onClose={onCancel}>
      <div style={{
        background:'#fff', borderRadius:14, padding:24,
        width:640, maxWidth:'95vw', maxHeight:'90vh', overflowY:'auto',
        boxShadow:'0 20px 60px rgba(61,53,128,0.22)',
        border:`1px solid ${TV.border}`, fontFamily:'Poppins,sans-serif',
        animation:'sm-in .2s cubic-bezier(.4,0,.2,1)',
      }}>
        <ModalHeader title="Confirm Override" subtitle="This will force the change despite detected conflicts." onClose={onCancel} fontSize={15} />

        <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr', gap:10, marginBottom:16 }}>
          <div style={{ padding:14, background:'#fff8f8', border:'1px solid #fecaca', borderRadius:10 }}>
            <p style={{ fontSize:9.5, fontWeight:700, color:'#c2410c', textTransform:'uppercase', letterSpacing:'.8px', margin:'0 0 8px' }}>Current</p>
            <p style={{ margin:'0 0 3px', fontWeight:700, fontSize:13, color:TV.text }}>{event.courseCode}</p>
            <p style={{ margin:0, fontSize:11.5, color:TV.muted }}>{event.day} · {event.period}</p>
            <p style={{ margin:'2px 0 0', fontSize:11.5, color:TV.muted }}>Room: {event.room || '—'} · {event.faculty || 'TBA'}</p>
          </div>
          <div style={{ padding:14, background:'#f0fdf4', border:'1px solid #bbf7d0', borderRadius:10 }}>
            <p style={{ fontSize:9.5, fontWeight:700, color:'#15803d', textTransform:'uppercase', letterSpacing:'.8px', margin:'0 0 8px' }}>New</p>
            <p style={{ margin:'0 0 3px', fontWeight:700, fontSize:13, color:TV.text }}>{event.courseCode}</p>
            <p style={{ margin:0, fontSize:11.5, color:TV.muted }}>{newDay} · {newPeriod}</p>
            <p style={{ margin:'2px 0 0', fontSize:11.5, color:TV.muted }}>Room: {newRoom} · {newFaculty || 'TBA'}</p>
          </div>
        </div>

        {conflicts.length > 0 && (
          <>
            <div style={{ display:'flex', alignItems:'center', gap:6, margin:'0 0 6px', fontSize:12, fontWeight:700, color:'#b91c1c' }}>
              <Ic.Warning size={13} color="#b91c1c" />
              {conflicts.length} class{conflicts.length > 1 ? 'es' : ''} will conflict
            </div>
            <ConflictTable conflicts={conflicts} />
          </>
        )}

        <div style={{ display:'flex', gap:10, marginTop:20, borderTop:`1px solid ${TV.border}`, paddingTop:16 }}>
          <button onClick={onConfirm} style={{ flex:1, padding:'10px 16px', fontSize:13, fontWeight:700, background:'#dc2626', color:'#fff', border:'none', borderRadius:9, cursor:'pointer', fontFamily:'Poppins,sans-serif', display:'flex', alignItems:'center', justifyContent:'center', gap:6 }}>
            <Ic.Warning size={13} color="#fff" /> Force Override
          </button>
          <button onClick={onCancel} style={{ flex:1, padding:'10px 16px', fontSize:13, fontWeight:600, background:'#fff', color:TV.text, border:`1px solid ${TV.border}`, borderRadius:9, cursor:'pointer', fontFamily:'Poppins,sans-serif' }}>
            Cancel
          </button>
        </div>
      </div>
    </ModalOverlay>
  )
}

/* ════════════════════════════════════════════════════════════════════════════
   Main component
   ════════════════════════════════════════════════════════════════════════════ */
export default function SessionModal({ event, allEvents, onClose, onSaved, masterRooms, masterFacultyList }) {
  const originalRange = parsePeriodRange(event.period)
  const duration      = originalRange?.duration ?? 60
  const evId          = getEventId(event)
  const merged        = !!findMergePartner(event, allEvents)
  const mergePartner  = findMergePartner(event, allEvents)
  const progColor     = programColor(event.program)
  const isLab         = event.session?.toUpperCase().includes('LAB')

  // ── Single-session state ──────────────────────────────────────────────────
  const [tab,         setTab]         = useState('details')
  const [newRoom,     setNewRoom]     = useState(event.room)
  const [newDay,      setNewDay]      = useState(event.day)
  const [newFaculty,  setNewFaculty]  = useState(event.faculty)
  const [newStart,    setNewStart]    = useState(originalRange?.start ?? DAY_START_HOUR * 60)
  const [saving,      setSaving]      = useState(false)
  const [error,       setError]       = useState('')
  const [showConfirm, setShowConfirm] = useState(false)

  // ── Batch-assign state ────────────────────────────────────────────────────
  const [batchFaculty,  setBatchFaculty]  = useState(event.faculty && event.faculty !== 'TBA' ? event.faculty : '')
  const [batchSaving,   setBatchSaving]   = useState(false)
  const [batchError,    setBatchError]    = useState('')
  const [batchResults,  setBatchResults]  = useState(null) // null = not run yet

  // ── Merge state (read-only; merging is now done via drag-and-drop) ───────

  const newEnd    = newStart + duration
  const newPeriod = `${minutesToTimeLabel(newStart)} - ${minutesToTimeLabel(newEnd)}`

  /* ── Single-session conflict calculations ───────────────────────────────── */
  const currentConflicts = useMemo(() =>
    originalRange
      ? findConflicts(allEvents, { evId, day:event.day, startMin:originalRange.start, endMin:originalRange.end, room:event.room, faculty:event.faculty, program:event.program, year:event.year, block:event.block })
      : [],
  [event, allEvents, evId, originalRange])

  const previewConflicts = useMemo(() =>
    findConflicts(allEvents, { evId, day:newDay, startMin:newStart, endMin:newEnd, room:newRoom, faculty:newFaculty, program:event.program, year:event.year, block:event.block }),
  [allEvents, evId, newDay, newStart, newEnd, newRoom, newFaculty, event.program, event.year, event.block])

  /* ── Room + time conflict maps ──────────────────────────────────────────── */
  const timeOptions  = TIME_SLOTS.filter(s => s.startMinutes <= DAY_END_HOUR * 60 - duration)
  const allFacNames  = [...new Set([...masterFacultyList.map(f => f.name), event.faculty])].filter(n => n && n !== 'TBA').sort()
  const lectureRooms = masterRooms.lecture ?? []
  const labRooms     = masterRooms.lab     ?? []
  const knownRooms   = new Set([...lectureRooms, ...labRooms])
  const otherRooms   = [...new Set(allEvents.map(e => e.room).filter(r => r && r !== 'TBA' && !knownRooms.has(r)))].sort()

  /* ── Merge preview: which time slots would merge this with another event ─── */
  // Only fires when the proposed slot EXACTLY matches an existing partner's period.
  // We do NOT use areMergePartners here because its legacy -A/-B suffix rule
  // matches regardless of time, causing false positives on every overlapping slot.
  const mergePreviewMap = useMemo(() => {
    const m = new Map()
    if (!event.courseCode || !newRoom || newRoom === 'TBA') return m
    TIME_SLOTS.forEach(s => {
      if (s.startMinutes > DAY_END_HOUR * 60 - duration) return
      const sEnd = s.startMinutes + duration
      const partner = allEvents.find(ev => {
        if (getEventId(ev) === evId) return false
        if (ev.day     !== newDay)   return false
        if (ev.room    !== newRoom)  return false
        if (ev.courseCode !== event.courseCode) return false
        if (ev.program    !== event.program)    return false
        if (String(ev.year) !== String(event.year)) return false
        if (ev.block === event.block) return false   // must be a different block
        // Exact time match — both events must occupy the same slot
        const evRange = parsePeriodRange(ev.period)
        return evRange && evRange.start === s.startMinutes && evRange.end === sEnd
      })
      if (partner) m.set(s.startMinutes, partner)
    })
    return m
  }, [allEvents, evId, event.courseCode, event.program, event.year, event.block, newRoom, newDay, duration])

  // mergePreviewRooms: for the current newStart, which rooms would cause a merge?
  const mergePreviewRooms = useMemo(() => {
    const set = new Set()
    if (!event.courseCode) return set
    const sEnd = newStart + duration
    ;[...lectureRooms, ...labRooms, ...otherRooms].forEach(r => {
      if (!r || r === 'TBA') return
      const hasMerge = allEvents.some(ev => {
        if (getEventId(ev) === evId) return false
        if (ev.day     !== newDay) return false
        if (ev.room    !== r)      return false
        if (ev.courseCode !== event.courseCode) return false
        if (ev.program    !== event.program)    return false
        if (String(ev.year) !== String(event.year)) return false
        if (ev.block === event.block) return false
        const evRange = parsePeriodRange(ev.period)
        return evRange && evRange.start === newStart && evRange.end === sEnd
      })
      if (hasMerge) set.add(r)
    })
    return set
  }, [allEvents, evId, event.courseCode, event.program, event.year, event.block, newStart, duration, newDay, lectureRooms, labRooms, otherRooms])

  const roomConflictSet = useMemo(() => {
    const set = new Set()
    ;[...lectureRooms, ...labRooms, ...otherRooms].forEach(r => {
      const c = findConflicts(allEvents, { evId, day:newDay, startMin:newStart, endMin:newEnd, room:r, faculty:null, program:null, year:null, block:null })
      if (c.length > 0) set.add(r)
    })
    return set
  }, [allEvents, evId, newDay, newStart, newEnd])

  const timeConflictMap = useMemo(() => {
    const m = new Map()
    TIME_SLOTS.forEach(s => {
      if (s.startMinutes > DAY_END_HOUR * 60 - duration) return
      const c = findConflicts(allEvents, { evId, day:newDay, startMin:s.startMinutes, endMin:s.startMinutes + duration, room:newRoom, faculty:newFaculty, program:event.program, year:event.year, block:event.block })
      if (c.length > 0) {
        const typeSet = new Set()
        c.forEach(x => { if (x.conflictLabel) x.conflictLabel.replace(' Conflict','').split(' + ').forEach(t => typeSet.add(t)) })
        m.set(s.startMinutes, { conflicts:c, typeLabel:[...typeSet].join(' + ') || 'Conflict' })
      }
    })
    return m
  }, [allEvents, evId, newDay, newRoom, newFaculty, duration, event.program, event.year, event.block])

  /* ── Faculty availability at current selected time slot ─────────────────── */
  const facultyAvailabilityMap = useMemo(() => {
    const map = new Map()
    allFacNames.forEach(fac => {
      const conflicts = allEvents.filter(ev => {
        if (getEventId(ev) === evId) return false
        if (ev.faculty !== fac)      return false
        if (ev.day     !== newDay)   return false
        const evRange = parsePeriodRange(ev.period)
        if (!evRange) return false
        return timeOverlaps({ start:newStart, end:newEnd }, evRange)
      })
      map.set(fac, conflicts)
    })
    return map
  }, [allFacNames, allEvents, evId, newDay, newStart, newEnd])

  /* ── Per-time-slot faculty conflict map (for time picker labels) ─────────── */
  const facultyTimeConflictMap = useMemo(() => {
    if (!newFaculty || newFaculty === 'TBA') return new Map()
    const m = new Map()
    TIME_SLOTS.forEach(s => {
      if (s.startMinutes > DAY_END_HOUR * 60 - duration) return
      const sEnd = s.startMinutes + duration
      const fc = allEvents.filter(ev => {
        if (getEventId(ev) === evId) return false
        if (ev.faculty !== newFaculty) return false
        if (ev.day     !== newDay)     return false
        const evRange = parsePeriodRange(ev.period)
        if (!evRange) return false
        return timeOverlaps({ start:s.startMinutes, end:sEnd }, evRange)
      })
      if (fc.length > 0) m.set(s.startMinutes, fc)
    })
    return m
  }, [allEvents, evId, newDay, newFaculty, duration])

  const siblingEvents = useMemo(() => {
    const sortFn = (a, b) => {
      const dayOrder = DAYS.indexOf(a.day) - DAYS.indexOf(b.day)
      if (dayOrder !== 0) return dayOrder
      return (parsePeriodRange(a.period)?.start ?? 0) - (parsePeriodRange(b.period)?.start ?? 0)
    }

    const makeBlockKey = (e) => `${e.program}-${e.year}-${e.block}`
    const targetBlockKey = makeBlockKey(event)

    if (!merged) {
      // Not merged — return only sessions belonging to this block
      return allEvents.filter(e =>
        e.courseCode === event.courseCode &&
        makeBlockKey(e) === targetBlockKey
      ).sort(sortFn)
    }

    // Merged — include this block AND its current merge partner's block
    const relatedBlockKeys = new Set([targetBlockKey])
    if (mergePartner) relatedBlockKeys.add(makeBlockKey(mergePartner))

    return allEvents.filter(e =>
      e.courseCode === event.courseCode &&
      relatedBlockKeys.has(makeBlockKey(e))
    ).sort(sortFn)
    
  }, [allEvents, event.courseCode, event.block, event.program, event.year, merged])

  const batchConflictMap = useMemo(() => {
    if (!batchFaculty || batchFaculty === 'TBA') return new Map()
    const siblingIds = new Set(siblingEvents.map(getEventId))
    const map = new Map()
    siblingEvents.forEach(sib => {
      const sibId    = getEventId(sib)
      const sibRange = parsePeriodRange(sib.period)
      if (!sibRange) return
      const conflicts = allEvents.filter(ev => {
        if (siblingIds.has(getEventId(ev))) return false  // skip the whole sibling group
        if (ev.day !== sib.day)             return false
        if (ev.faculty !== batchFaculty)    return false
        const evRange = parsePeriodRange(ev.period)
        if (!evRange) return false
        return timeOverlaps(sibRange, evRange)
      })
      if (conflicts.length > 0) map.set(sibId, conflicts)
    })
    return map
  }, [siblingEvents, allEvents, batchFaculty])

  const batchConflictCount = batchConflictMap.size

  /* ── Batch: per-faculty aggregate availability across ALL sibling sessions ── */
  // For the current event specifically, we use newStart/newDay (the proposed time
  // from the Details tab) so the list stays live as you change the time picker.
  // For all other siblings we use their actual saved period/day.
  const batchFacultyStatusMap = useMemo(() => {
    const siblingIds = new Set(siblingEvents.map(getEventId))
    const map = new Map()
    allFacNames.forEach(fac => {
      let conflictCount = 0
      siblingEvents.forEach(sib => {
        const isCurrentEvent = getEventId(sib) === evId
        // Use proposed time for the current event, saved time for siblings
        const checkDay   = isCurrentEvent ? newDay   : sib.day
        const checkStart = isCurrentEvent ? newStart : (parsePeriodRange(sib.period)?.start ?? null)
        const checkEnd   = isCurrentEvent ? newEnd   : (parsePeriodRange(sib.period)?.end   ?? null)
        if (checkStart == null || checkEnd == null) return
        const hasConflict = allEvents.some(ev => {
          if (siblingIds.has(getEventId(ev))) return false
          if (ev.faculty !== fac || ev.day !== checkDay) return false
          const evRange = parsePeriodRange(ev.period)
          if (!evRange) return false
          return timeOverlaps({ start: checkStart, end: checkEnd }, evRange)
        })
        if (hasConflict) conflictCount++
      })
      map.set(fac, conflictCount)
    })
    return map
  }, [allFacNames, siblingEvents, allEvents, evId, newDay, newStart, newEnd])

  /* ── Unit cap helper (mirrors FacultyDetailPage / unit_balancing.py) ──────── */
  const getEffectiveMaxUnits = (status, courseCount) => {
    if (status === 'part-time') return 15
    if (courseCount >= 5) return 18
    if (courseCount >= 3) return 21
    return 24
  }

  /* ── Per-faculty unit load (excludes sibling sessions being re-assigned) ─── */
  const facultyUnitMap = useMemo(() => {
    const sibIds = new Set(siblingEvents.map(getEventId))

    // Sum units across ALL sibling sessions — this is what will be added in a batch commit
    const batchUnits = siblingEvents.reduce((sum, sib) => sum + (Number(sib.units) || 0), 0)

    const map = new Map()
    masterFacultyList.forEach(facObj => {
      let usedUnits = 0
      const courseCodes = new Set()
      allEvents.forEach(ev => {
        if (ev.faculty !== facObj.name) return
        if (sibIds.has(getEventId(ev))) return        // exclude sessions we're about to reassign
        const u = Number(ev.units) || 0
        usedUnits += u
        if (ev.courseCode) courseCodes.add(ev.courseCode)
      })
      const courseCount  = courseCodes.size
      const maxUnits     = getEffectiveMaxUnits(facObj.status, courseCount)
      map.set(facObj.name, {
        usedUnits,
        maxUnits,
        sessionUnits:   batchUnits,                        // total across all sibling sessions
        projectedUnits: usedUnits + batchUnits,
        wouldExceed:    usedUnits + batchUnits > maxUnits,
        status:         facObj.status,
      })
    })
    return map
  }, [masterFacultyList, allEvents, siblingEvents])

  /* ── Specialization match map: name → rating (1-5) if they teach this course ── */
  const facultySpecMap = useMemo(() => {
    const map = new Map()
    masterFacultyList.forEach(facObj => {
      const specs = Array.isArray(facObj.specializations) ? facObj.specializations : []
      const match = specs.find(s => {
        const code = typeof s === 'string' ? s : s.courseCode
        return code && event.courseCode &&
          code.trim().toUpperCase() === event.courseCode.trim().toUpperCase()
      })
      if (match) map.set(facObj.name, typeof match === 'object' ? (match.rating ?? 3) : 3)
    })
    return map
  }, [masterFacultyList, event.courseCode])

  /* ── Ranked faculty list: best spec match first, conflicts / unit overflow last ── */
  const rankedFaculty = useMemo(() => {
    return allFacNames.slice().sort((a, b) => {
      const aSpec = facultySpecMap.get(a) ?? 0
      const bSpec = facultySpecMap.get(b) ?? 0
      const aConf = batchFacultyStatusMap.get(a) ?? 0
      const bConf = batchFacultyStatusMap.get(b) ?? 0
      const aOver = facultyUnitMap.get(a)?.wouldExceed ? 1 : 0
      const bOver = facultyUnitMap.get(b)?.wouldExceed ? 1 : 0
      // Higher score floats to top of list
      const score = (spec, conf, over) => spec * 20 - conf * 6 - over * 10
      const diff  = score(bSpec, bConf, bOver) - score(aSpec, aConf, aOver)
      return diff !== 0 ? diff : a.localeCompare(b)
    })
  }, [allFacNames, facultySpecMap, batchFacultyStatusMap, facultyUnitMap])

  /* ── Merge: partner detection (when already merged) ─────────────────────── */
  async function handleBatchSave() {
    // Allow TBA to explicitly unassign; only block when nothing is selected at all
    const facultyValue = batchFaculty === 'TBA' ? 'TBA' : batchFaculty
    if (facultyValue === '' || facultyValue == null) {
      setBatchError('Please select a faculty member or choose Unassigned (TBA).')
      return
    }
    setBatchSaving(true); setBatchError(''); setBatchResults(null)
    const results = []
    for (const sib of siblingEvents) {
      try {
        await overrideSession({
          schedule_id:  sib.schedule_id,
          courseCode:   sib.courseCode,
          block:        sib.block,
          session:      sib.session,
          new_room:     sib.room,
          new_day:      sib.day,
          new_period:   sib.period,
          new_faculty:  facultyValue,
          force_override: (merged || batchConflictMap.has(getEventId(sib))) ? true : undefined,
        })
        results.push({ sib, ok:true })
      } catch (err) {
        const detail = err.response?.data?.detail
        const msg    = detail?.conflict
          ? `Conflict with ${detail.conflicting_event?.courseCode} ${detail.conflicting_event?.block}`
          : (typeof detail === 'string' ? detail : 'Failed')
        results.push({ sib, ok:false, error:msg })
      }
    }
    setBatchResults(results)
    setBatchSaving(false)
    const allOk = results.every(r => r.ok)
    if (allOk) {
      const updatedEvents = results.map(r => ({
        ...r.sib,
        faculty: facultyValue,
        facultyAutoAssigned: false,
        assignmentScore: null,
      }))
      onSaved(updatedEvents); onClose()
    }
  }

  /* ── Merge handler ──────────────────────────────────────────────────────── */
  const hasChanges     = newRoom !== event.room || newDay !== event.day || newStart !== originalRange?.start || newFaculty !== event.faculty
  const totalConflicts = currentConflicts.length + previewConflicts.length

  /* ── Save logic (single session) ───────────────────────────────────────── */
  async function doSave(force = false) {
    setSaving(true); setError('')
    try {
      await overrideSession({
        schedule_id: event.schedule_id, // <-- ADD THIS LINE
        courseCode:event.courseCode, 
        block:event.block, 
        session:event.session,
        new_room:newRoom, 
        new_day:newDay, 
        new_period:newPeriod,
        new_faculty:newFaculty !== event.faculty ? newFaculty : undefined,
        force_override:force || undefined,
      })
      // Build the updated event object and pass it up — no page reload needed
      const updatedEvent = {
        ...event,
        room:   newRoom,
        day:    newDay,
        period: newPeriod,
        ...(newFaculty !== event.faculty
          ? { faculty: newFaculty, facultyAutoAssigned: false, assignmentScore: null }
          : {}),
      }
      onSaved(updatedEvent); onClose()
    } catch (err) {
      const detail = err.response?.data?.detail
      if (detail?.conflict) {
        const ce = detail.conflicting_event
        setError(`Conflict with ${ce.courseCode} ${ce.block} (${ce.session}).`)
      } else {
        setError(typeof detail === 'string' ? detail : 'Failed to save changes.')
      }
    } finally { setSaving(false) }
  }

  function handleSave() {
    if (previewConflicts.length > 0) setShowConfirm(true)
    else doSave(false)
  }

  /* ── Tab definitions ────────────────────────────────────────────────────── */
  const TABS = [
    { key:'details',   label:'Details',    icon:<Ic.Calendar size={11} />, count:null,                    warn:false },
    { key:'rooms',     label:'Rooms',      icon:<Ic.Door     size={11} />, count:null,                    warn:roomConflictSet.has(newRoom), merge: mergePreviewRooms.has(newRoom) && !roomConflictSet.has(newRoom) },
    { key:'conflicts', label:'Conflicts',  icon:<Ic.Warning  size={11} />, count:totalConflicts||null,    warn:totalConflicts > 0 },
    { key:'batch',     label:'Assign All', icon:<Ic.Users    size={11} />, count:siblingEvents.length||null, warn:false },
  ]

  /* ── Combined section label: e.g. "BSCS 3-A" ───────────────────────────── */
  const sectionLabel = [
    event.program,
    event.year ? `${event.year}` : null,
    event.block ? `-${event.block}` : null,
  ].filter(Boolean).join('')

  /* ════════════════════════════════════════════════════════════════════════ */
  return (
    <>
      <ModalOverlay onClose={onClose}>
        <div style={{
          background:'#fff', borderRadius:16, width:740, maxWidth:'97vw',
          maxHeight:'92vh', display:'flex', flexDirection:'column',
          boxShadow:'0 24px 72px rgba(61,53,128,0.24)', border:`1px solid ${TV.border}`,
          fontFamily:'Poppins,sans-serif', animation:'sm-in .22s cubic-bezier(.4,0,.2,1)',
          overflow:'hidden',
        }}>

          {/* ── HEADER ─────────────────────────────────────────────────────── */}
          <div style={{ padding:'20px 24px 0', flexShrink:0 }}>

            {/* Course identity row */}
            <div style={{ display:'flex', alignItems:'flex-start', justifyContent:'space-between', marginBottom:16, gap:12 }}>

              {/* Left: info */}
              <div style={{ minWidth:0, flex:1 }}>
                <div style={{ display:'flex', alignItems:'center', gap:8, flexWrap:'wrap', marginBottom:5 }}>
                  <span style={{ fontSize:18, fontWeight:800, color:TV.text, letterSpacing:'-.5px', lineHeight:1 }}>
                    {event.courseCode}
                  </span>
                  {merged && (
                    <span style={{ display:'inline-flex', alignItems:'center', gap:4, fontSize:10, fontWeight:700, color:TV.deep, background:TV.pale, border:`1px solid ${TV.light}`, padding:'2px 8px', borderRadius:6 }}>
                      <Ic.Link size={9} color={TV.deep} /> Merged Block
                    </span>
                  )}
                </div>

                {event.title && (
                  <p style={{ margin:'0 0 8px', fontSize:12, color:TV.muted, lineHeight:1.45, overflow:'hidden', textOverflow:'ellipsis', whiteSpace:'nowrap', maxWidth:480 }}>
                    {event.title}
                  </p>
                )}

                <div style={{ display:'flex', gap:5, flexWrap:'wrap' }}>
                  {event.program && (
                    <span style={{ fontSize:10, fontWeight:700, background:progColor.bg, color:progColor.text, border:`1px solid ${progColor.border}`, padding:'2px 8px', borderRadius:5 }}>
                      {sectionLabel}
                    </span>
                  )}
                  {event.session && (
                    <span style={{ display:'inline-flex', alignItems:'center', gap:3, fontSize:10, fontWeight: isLab ? 700 : 400, padding:'2px 8px', borderRadius:5, border:`1px solid ${isLab ? TV.light : TV.border}`, background: isLab ? TV.pale : '#fff', color: isLab ? TV.deep : TV.muted }}>
                      {event.session}
                    </span>
                  )}
                  {event.room && event.room !== 'TBA' && (
                    <span style={{ display:'inline-flex', alignItems:'center', gap:4, fontSize:10, background:'#fff', border:`1px solid ${TV.border}`, color:TV.muted, padding:'2px 8px', borderRadius:5 }}>
                      <Ic.MapPin size={9} color={TV.muted} /> {event.room}
                    </span>
                  )}
                </div>
              </div>

              {/* Right: faculty chip + close button */}
              <div style={{ display:'flex', alignItems:'center', gap:8, flexShrink:0 }}>
                {newFaculty && newFaculty !== 'TBA' ? (
                  <span style={{
                    display:'inline-flex', alignItems:'center', gap:5,
                    fontSize:11, fontWeight:700, padding:'5px 11px', borderRadius:8,
                    background:'#EEF2FF', color:'#4338CA', border:'1px solid #C7D2FE',
                    maxWidth:180, overflow:'hidden', textOverflow:'ellipsis', whiteSpace:'nowrap',
                  }}>
                    <Ic.User size={11} color="#4338CA" />
                    {newFaculty}
                  </span>
                ) : (
                  <span style={{
                    display:'inline-flex', alignItems:'center', gap:5,
                    fontSize:11, fontWeight:600, padding:'5px 11px', borderRadius:8,
                    background:'#F3F4F6', color:'#9CA3AF', border:'1px solid #E5E7EB',
                  }}>
                    <Ic.User size={11} color="#9CA3AF" />
                    Unassigned
                  </span>
                )}

                <button
                  onClick={onClose}
                  style={{ background:TV.pale, border:`1px solid ${TV.border}`, width:30, height:30, borderRadius:9, display:'flex', alignItems:'center', justifyContent:'center', cursor:'pointer', color:TV.muted, fontSize:18, lineHeight:1, flexShrink:0, fontFamily:'inherit', transition:'all .15s' }}
                  onMouseEnter={e => { e.currentTarget.style.background=TV.light; e.currentTarget.style.color=TV.text }}
                  onMouseLeave={e => { e.currentTarget.style.background=TV.pale;  e.currentTarget.style.color=TV.muted }}
                >×</button>
              </div>
            </div>

            {/* Tab bar */}
            <div style={{ display:'flex', gap:3, background:'#F5F4FB', padding:4, borderRadius:10, width:'fit-content' }}>
              {TABS.map(t => (
                <button
                  key={t.key}
                  className={`sm-tab${tab === t.key ? ' active' : ''}${t.warn ? ' warn' : ''}`}
                  onClick={() => setTab(t.key)}
                  style={ t.merge && tab !== t.key ? { color:'#1d4ed8' } : undefined }
                >
                  {t.icon}
                  {t.label}
                  {t.merge && tab !== t.key && (
                    <span style={{ display:'inline-flex', alignItems:'center', justifyContent:'center', minWidth:16, height:16, padding:'0 4px', borderRadius:99, fontSize:9, fontWeight:700, background:'#dbeafe', color:'#1d4ed8' }}>
                      ⊕
                    </span>
                  )}
                  {t.count !== null && !t.merge && <span className="sm-badge">{t.count}</span>}
                  {t.count !== null && t.merge && tab === t.key && <span className="sm-badge">{t.count}</span>}
                </button>
              ))}
            </div>

            <div style={{ height:1, background:TV.border, marginTop:12 }} />
          </div>

          {/* ── TAB CONTENT ─────────────────────────────────────────────────── */}
          <div style={{ flex:1, overflowY:'auto', padding:'20px 24px' }}>

            {/* ══════════════ DETAILS TAB ══════════════ */}
            {tab === 'details' && (
              <div style={{ display:'flex', flexDirection:'column', gap:20 }}>

                {/* ── Merged Block info banner ── */}
                {merged && mergePartner && (
                  <div style={{ display:'flex', alignItems:'flex-start', gap:10, padding:'11px 14px', background:TV.pale, border:`1.5px solid ${TV.light}`, borderRadius:10 }}>
                    <svg width={15} height={15} viewBox="0 0 24 24" fill="none" stroke={TV.deep} strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" style={{flexShrink:0,marginTop:1}}>
                      <path d="M10 13a5 5 0 0 0 7.54.54l3-3a5 5 0 0 0-7.07-7.07l-1.72 1.71"/>
                      <path d="M14 11a5 5 0 0 0-7.54-.54l-3 3a5 5 0 0 0 7.07 7.07l1.71-1.71"/>
                    </svg>
                    <div style={{flex:1,minWidth:0}}>
                      <p style={{margin:'0 0 3px',fontSize:12,fontWeight:700,color:TV.deep}}>Merged Block</p>
                      <p style={{margin:0,fontSize:11,color:TV.muted,lineHeight:1.5}}>
                        This session is merged with{' '}
                        <strong style={{color:TV.text}}>
                          {mergePartner.program} {mergePartner.year}-{mergePartner.block}
                        </strong>
                        {' '}— both sections share the same room, day, and time.
                        Drag either card to a different slot to unmerge.
                      </p>
                    </div>
                  </div>
                )}


                <div>
                  <p className="sm-field-label"><Ic.Calendar size={10} color={TV.muted} /> Day</p>
                  <select className="sm-select" value={newDay} onChange={e => setNewDay(e.target.value)}>
                    {DAYS.map(d => <option key={d} value={d}>{d}</option>)}
                  </select>
                </div>

                {/* Time picker */}
                <div>
                  <p className="sm-field-label">
                    <Ic.Clock size={10} color={TV.muted} /> Time Period
                    <span style={{ fontWeight:400, fontSize:10.5, color:TV.muted, textTransform:'none', letterSpacing:0, marginLeft:4 }}>
                      — ends {minutesToTimeLabel(newEnd)}
                    </span>
                  </p>
                  <div style={{ border:`1px solid ${TV.border}`, borderRadius:10, overflow:'hidden', background:'#fff', maxHeight:224, overflowY:'auto' }}>
                    {timeOptions.map((s, idx) => {
                      const isSelected   = newStart === s.startMinutes
                      const cd           = timeConflictMap.get(s.startMinutes)
                      const fd           = facultyTimeConflictMap.get(s.startMinutes)
                      const mergePartnerAtSlot = mergePreviewMap.get(s.startMinutes)
                      const hasC         = !!cd
                      const hasF         = !!fd
                      const hasAny       = hasC || hasF
                      const isHour       = s.startMinutes % 60 === 0

                      const conflictParts = new Set()
                      if (hasC && cd.typeLabel) cd.typeLabel.split(' + ').forEach(t => conflictParts.add(t))
                      if (hasF) conflictParts.add('Faculty')
                      const combinedLabel = [...conflictParts].join(' + ') || 'Conflict'

                      let bg, color, bl
                      if (isSelected && hasAny)          { bg='#dc2626'; color='#fff'; bl='3px solid #991b1b' }
                      else if (isSelected && mergePartnerAtSlot) { bg=TV.deep; color='#fff'; bl=`3px solid ${TV.deep}` }
                      else if (isSelected)               { bg=TV.deep;   color='#fff'; bl=`3px solid ${TV.deep}` }
                      else if (mergePartnerAtSlot)       { bg='#eff6ff'; color='#1d4ed8'; bl='3px solid #93c5fd' }
                      else if (hasAny)                   { bg='#fef2f2'; color='#b91c1c'; bl='3px solid #fca5a5' }
                      else                               { bg=isHour?'#FAFAFE':'#fff'; color=TV.text; bl='3px solid transparent' }

                      return (
                        <div key={s.startMinutes}
                          className="sm-time-row"
                          onClick={() => setNewStart(s.startMinutes)}
                          style={{
                            background:bg, color, borderLeft:bl,
                            borderBottom: idx < timeOptions.length-1 ? `1px solid ${TV.border}` : 'none',
                            fontSize: isHour ? 12 : 11,
                            fontWeight: isSelected ? 700 : isHour ? 500 : 400,
                          }}
                        >
                          <div style={{ display:'flex', alignItems:'center', gap:8 }}>
                            <span style={{ width:14, display:'inline-flex', alignItems:'center', justifyContent:'center' }}>
                              {isSelected && <Ic.Check size={11} color={color} />}
                            </span>
                            <span>{s.label}</span>
                            <span style={{ fontSize:9.5, opacity:.65 }}>→ {minutesToTimeLabel(s.startMinutes + duration)}</span>
                          </div>
                          {mergePartnerAtSlot && !isSelected && (
                            <span style={{ display:'inline-flex', alignItems:'center', gap:3, fontSize:9, background:'#dbeafe', color:'#1d4ed8', borderRadius:4, padding:'1px 6px', fontWeight:700, flexShrink:0 }}>
                              <Ic.Link size={9} color="#1d4ed8" /> Would merge · {mergePartnerAtSlot.program} {mergePartnerAtSlot.year}-{mergePartnerAtSlot.block}
                            </span>
                          )}
                          {hasAny && !isSelected && (
                            <span style={{ display:'inline-flex', alignItems:'center', gap:3, fontSize:9, background:'#fee2e2', color:'#b91c1c', borderRadius:4, padding:'1px 6px', fontWeight:700, flexShrink:0 }}>
                              <Ic.Warning size={9} color="#b91c1c" /> {combinedLabel}
                            </span>
                          )}
                        </div>
                      )
                    })}
                  </div>
                </div>

                {/* Faculty — redirects to Assign All which is reactive to this time/day */}
                <div style={{ display:'flex', alignItems:'center', gap:10, padding:'10px 14px', background:'#F5F4FB', border:`1px solid ${TV.border}`, borderRadius:9, fontSize:11.5, color:TV.muted }}>
                  <Ic.User size={13} color={TV.muted} />
                  <span style={{ flex:1 }}>
                    Faculty availability for <strong style={{ color:TV.text }}>{minutesToTimeLabel(newStart)}–{minutesToTimeLabel(newEnd)} on {newDay}</strong> is shown in the{' '}
                    <button className="sm-view-link" onClick={() => setTab('batch')}>Assign All tab</button>.
                  </span>
                </div>

              </div>
            )}

            {/* ══════════════ ROOMS TAB ══════════════ */}
            {tab === 'rooms' && (
              <div style={{ display:'flex', flexDirection:'column', gap:20 }}>

                <div style={{ display:'flex', alignItems:'center', gap:10, padding:'10px 14px', background:TV.pale, borderRadius:10, border:`1px solid ${TV.light}` }}>
                  <Ic.MapPin size={13} color={TV.deep} />
                  <span style={{ fontSize:12, color:TV.muted }}>Selected:</span>
                  <span style={{ fontSize:12, fontWeight:700, color:TV.deep }}>
                    {newRoom && newRoom !== 'TBA' ? newRoom : 'None (TBA)'}
                  </span>
                  {roomConflictSet.has(newRoom) && newRoom !== 'TBA' && (
                    <span style={{ display:'inline-flex', alignItems:'center', gap:5, marginLeft:'auto', fontSize:10.5, fontWeight:700, color:'#b91c1c', background:'#fee2e2', border:'1px solid #fca5a5', padding:'3px 9px', borderRadius:6 }}>
                      <Ic.Warning size={10} color="#b91c1c" /> Occupied at this time
                    </span>
                  )}
                  {mergePreviewRooms.has(newRoom) && newRoom !== 'TBA' && !roomConflictSet.has(newRoom) && (
                    <span style={{ display:'inline-flex', alignItems:'center', gap:5, marginLeft:'auto', fontSize:10.5, fontWeight:700, color:'#1d4ed8', background:'#dbeafe', border:'1px solid #93c5fd', padding:'3px 9px', borderRadius:6 }}>
                      <Ic.Link size={10} color="#1d4ed8" /> Would merge at current time
                    </span>
                  )}
                </div>

                {lectureRooms.length > 0 && (
                  <div>
                    <p className="sm-field-label"><Ic.Door size={10} color={TV.muted} /> Lecture Rooms</p>
                    <div style={{ display:'flex', flexWrap:'wrap', gap:6 }}>
                      {lectureRooms.map(r => (
                        <RoomChip key={r} room={r} selected={newRoom===r} hasRoomConflict={roomConflictSet.has(r)} hasMergePreview={mergePreviewRooms.has(r)} onClick={() => setNewRoom(r)} />
                      ))}
                    </div>
                  </div>
                )}

                {labRooms.length > 0 && (
                  <div>
                    <p className="sm-field-label"><Ic.Door size={10} color={TV.muted} /> Lab Rooms</p>
                    <div style={{ display:'flex', flexWrap:'wrap', gap:6 }}>
                      {labRooms.map(r => (
                        <RoomChip key={r} room={r} selected={newRoom===r} hasRoomConflict={roomConflictSet.has(r)} hasMergePreview={mergePreviewRooms.has(r)} onClick={() => setNewRoom(r)} />
                      ))}
                    </div>
                  </div>
                )}

                {otherRooms.length > 0 && (
                  <div>
                    <p className="sm-field-label"><Ic.Door size={10} color={TV.muted} /> Other Rooms</p>
                    <div style={{ display:'flex', flexWrap:'wrap', gap:6 }}>
                      {otherRooms.map(r => (
                        <RoomChip key={r} room={r} selected={newRoom===r} hasRoomConflict={roomConflictSet.has(r)} hasMergePreview={mergePreviewRooms.has(r)} onClick={() => setNewRoom(r)} />
                      ))}
                    </div>
                  </div>
                )}

                {lectureRooms.length === 0 && labRooms.length === 0 && otherRooms.length === 0 && (
                  <div className="sm-empty">
                    <div style={{ width:46, height:46, borderRadius:13, background:TV.pale, display:'flex', alignItems:'center', justifyContent:'center' }}>
                      <Ic.Door size={22} color={TV.deep} />
                    </div>
                    <p style={{ fontSize:13.5, fontWeight:700, color:TV.text, margin:0 }}>No rooms configured</p>
                    <p style={{ fontSize:12, color:TV.muted, margin:0, maxWidth:280 }}>Add rooms in Settings to enable room assignment.</p>
                  </div>
                )}
              </div>
            )}

            {/* ══════════════ CONFLICTS TAB ══════════════ */}
            {tab === 'conflicts' && (
              <div style={{ display:'flex', flexDirection:'column', gap:20 }}>
                {(() => {
                  // Split currentConflicts into merge-partner vs real conflicts.
                  // A merge partner shares the same courseCode + program + year but a
                  // different block — their room overlap is intentional, not an error.
                  const isMergePartner = c =>
                    c.courseCode === event.courseCode &&
                    String(c.year) === String(event.year) &&
                    c.program === event.program &&
                    c.block !== event.block

                  const currentMerge = currentConflicts.filter(isMergePartner)
                  const currentReal  = currentConflicts.filter(c => !isMergePartner(c))
                  const previewMerge = previewConflicts.filter(isMergePartner)
                  const previewReal  = previewConflicts.filter(c => !isMergePartner(c))

                  return (
                    <>
                      {totalConflicts === 0 && (
                        <div className="sm-empty">
                          <div style={{ width:46, height:46, borderRadius:13, background:'#f0fdf4', border:'1px solid #bbf7d0', display:'flex', alignItems:'center', justifyContent:'center' }}>
                            <Ic.CheckCircle size={22} color="#16a34a" />
                          </div>
                          <p style={{ fontSize:13.5, fontWeight:700, color:TV.text, margin:0 }}>No conflicts detected</p>
                          <p style={{ fontSize:12, color:TV.muted, margin:0, maxWidth:300 }}>This session has no room, section, or faculty conflicts with the current schedule.</p>
                        </div>
                      )}

                      {/* ── Merge-partner overlaps (current) — informational, not errors ── */}
                      {currentMerge.length > 0 && (
                        <div>
                          <p className="sm-field-label" style={{ color:TV.deep }}>
                            <Ic.Link size={10} color={TV.deep} />
                            Merge Overlap &nbsp;·&nbsp; {currentMerge.length} partner{currentMerge.length > 1 ? 's' : ''}
                          </p>
                          <div style={{ background:TV.pale, border:`1px solid ${TV.light}`, borderRadius:10, padding:'10px 14px' }}>
                            <p style={{ margin:'0 0 8px', fontSize:11.5, color:TV.muted, lineHeight:1.5 }}>
                              This session shares a room with its merged block partner. This is expected — not a real conflict.
                            </p>
                            <ConflictTable conflicts={currentMerge} />
                          </div>
                        </div>
                      )}

                      {/* ── Real active conflicts ── */}
                      {currentReal.length > 0 && (
                        <div>
                          <p className="sm-field-label" style={{ color:'#b91c1c' }}>
                            <Ic.Warning size={10} color="#b91c1c" />
                            Active Conflicts &nbsp;·&nbsp; {currentReal.length} class{currentReal.length > 1 ? 'es' : ''}
                          </p>
                          <div style={{ background:'#fff8f8', border:'1px solid #fecaca', borderRadius:10, padding:'10px 14px' }}>
                            <p style={{ margin:'0 0 8px', fontSize:11.5, color:'#991b1b' }}>
                              These conflicts exist in the current saved schedule and need to be resolved.
                            </p>
                            <ConflictTable conflicts={currentReal} />
                          </div>
                        </div>
                      )}

                      {/* ── Merge-partner overlaps (preview) — informational ── */}
                      {previewMerge.length > 0 && (
                        <div>
                          <p className="sm-field-label" style={{ color:TV.deep }}>
                            <Ic.Link size={10} color={TV.deep} />
                            Proposed Merge &nbsp;·&nbsp; {previewMerge.length} partner{previewMerge.length > 1 ? 's' : ''}
                          </p>
                          <div style={{ background:TV.pale, border:`1px solid ${TV.light}`, borderRadius:10, padding:'10px 14px' }}>
                            <p style={{ margin:'0 0 8px', fontSize:11.5, color:TV.muted }}>
                              Moving here would merge this session with its block partner — both sections share the same room and time.
                            </p>
                            <ConflictTable conflicts={previewMerge} />
                          </div>
                        </div>
                      )}

                      {/* ── Real proposed-slot conflicts ── */}
                      {previewReal.length > 0 && (
                        <div>
                          <p className="sm-field-label" style={{ color:'#c2410c' }}>
                            <Ic.Warning size={10} color="#c2410c" />
                            Proposed Slot Conflicts &nbsp;·&nbsp; {previewReal.length} class{previewReal.length > 1 ? 'es' : ''}
                          </p>
                          <div style={{ background:'#fff7ed', border:'1px solid #fed7aa', borderRadius:10, padding:'10px 14px' }}>
                            <p style={{ margin:'0 0 8px', fontSize:11.5, color:'#92400e' }}>
                              Your proposed changes conflict with the sessions below. Saving will force-override.
                            </p>
                            <ConflictTable conflicts={previewReal} />
                          </div>
                        </div>
                      )}
                    </>
                  )
                })()}
              </div>
            )}

            {/* ══════════════ BATCH ASSIGN TAB ══════════════ */}
            {tab === 'batch' && (
              <div style={{ display:'flex', flexDirection:'column', gap:20 }}>

                {/* Info banner — now shows the reactive proposed time */}
                <div style={{ padding:'11px 14px', background:TV.pale, border:`1px solid ${TV.light}`, borderRadius:10, fontSize:12, color:TV.muted, lineHeight:1.6 }}>
                  <span style={{ fontWeight:700, color:TV.deep }}>Assign to All Sessions</span>
                  {' '}sets one faculty member across{' '}
                  <span style={{ fontWeight:700, color:TV.text }}>all {siblingEvents.length} session{siblingEvents.length !== 1 ? 's' : ''}</span> of{' '}
                  <span style={{ fontWeight:700, color:TV.text }}>{event.courseCode}</span>
                  {merged && <span style={{ color:TV.deep, fontWeight:600 }}> (merged block — both sections included)</span>}.
                  {' '}Availability reflects{' '}
                  <span style={{ fontWeight:700, color:TV.text }}>{minutesToTimeLabel(newStart)}–{minutesToTimeLabel(newEnd)} on {newDay}</span>
                  {' '}for this session, and saved times for all others.
                </div>

                {/* ── Faculty picker list ── */}
                <div>
                  <p className="sm-field-label">
                    <Ic.User size={10} color={TV.muted} /> Select Faculty
                    {batchFaculty && batchFaculty !== 'TBA' && (
                      <span style={{ fontWeight:600, fontSize:10.5, color:TV.deep, textTransform:'none', letterSpacing:0, marginLeft:4 }}>
                        — {batchFaculty}
                      </span>
                    )}
                    {(!batchFaculty || batchFaculty === 'TBA') && (
                      <span style={{ fontWeight:600, fontSize:10.5, color:TV.muted, textTransform:'none', letterSpacing:0, marginLeft:4 }}>
                        — Unassigned (TBA)
                      </span>
                    )}
                  </p>

                  <div style={{ border:`1px solid ${TV.border}`, borderRadius:10, overflow:'hidden', background:'#fff', maxHeight:320, overflowY:'auto' }}>

                    {/* ── Recommended header (shown when any faculty has a spec match) ── */}
                    {[...facultySpecMap.keys()].some(k => allFacNames.includes(k)) && (
                      <div style={{ display:'flex', alignItems:'center', gap:6, padding:'6px 12px', background:'linear-gradient(90deg,#EDE9FB,#F5F4FB)', borderBottom:`1px solid ${TV.light}` }}>
                        <span style={{ fontSize:9, fontWeight:800, color:TV.deep, textTransform:'uppercase', letterSpacing:'.8px' }}>
                          ★ Ranked by specialization match &amp; availability
                        </span>
                        <span style={{ marginLeft:'auto', fontSize:9, color:TV.muted, fontWeight:500 }}>
                          for {event.courseCode}
                        </span>
                      </div>
                    )}

                    {/* ── Unassign / TBA row ── */}
                    <div
                      className="sm-fac-row"
                      onClick={() => { setBatchFaculty('TBA'); setBatchResults(null); setBatchError('') }}
                      style={{
                        background: !batchFaculty || batchFaculty === 'TBA' ? TV.deep : '#FAFAFE',
                        color:      !batchFaculty || batchFaculty === 'TBA' ? '#fff'  : TV.muted,
                        borderLeft: !batchFaculty || batchFaculty === 'TBA' ? `3px solid ${TV.deep}` : '3px solid transparent',
                        fontSize: 11,
                      }}
                    >
                      <div style={{ display:'flex', alignItems:'center', gap:8 }}>
                        <span style={{ width:14, display:'inline-flex', alignItems:'center', justifyContent:'center' }}>
                          {(!batchFaculty || batchFaculty === 'TBA')
                            ? <Ic.Check size={11} color="#fff" />
                            : <span style={{ width:7, height:7, borderRadius:'50%', background:'#d1d5db', display:'inline-block' }} />
                          }
                        </span>
                        <span style={{ fontStyle:'italic' }}>Unassigned (TBA)</span>
                      </div>
                      {(!batchFaculty || batchFaculty === 'TBA') && (
                        <span style={{ fontSize:9, color:'rgba(255,255,255,.75)', fontWeight:600, flexShrink:0 }}>
                          will clear faculty on all sessions
                        </span>
                      )}
                    </div>

                    {(() => {
                      const SPEC_LABELS = { 5:'Expert', 4:'Highly Proficient', 3:'Competent', 2:'Developing', 1:'Beginner' }
                      const SPEC_COLORS = { 5:'#059669', 4:'#2563EB', 3:'#7C6FCD', 2:'#D97706', 1:'#C0392B' }

                      // Find the first index in the ranked list where conflicts or unit overflow begin
                      let dividerAt = -1
                      rankedFaculty.forEach((fac, idx) => {
                        if (dividerAt !== -1) return
                        const conf = batchFacultyStatusMap.get(fac) ?? 0
                        const over = facultyUnitMap.get(fac)?.wouldExceed
                        if (conf > 0 || over) dividerAt = idx
                      })

                      return rankedFaculty.map((fac, idx) => {
                        const conflictCount  = batchFacultyStatusMap.get(fac) ?? 0
                        const totalSessions  = siblingEvents.length
                        const isSelected     = batchFaculty === fac
                        const isClean        = conflictCount === 0
                        const isFullConflict = conflictCount === totalSessions && totalSessions > 0
                        const isPartial      = conflictCount > 0 && !isFullConflict
                        const specRating     = facultySpecMap.get(fac)
                        const unitInfo       = facultyUnitMap.get(fac)
                        const hasUnitInfo    = !!unitInfo
                        const wouldExceed    = unitInfo?.wouldExceed ?? false

                        // Colour scheme — unit overflow shifts partial/clean rows to amber
                        let bg, color, bl, dotColor
                        if      (isSelected && isClean && !wouldExceed)      { bg=TV.deep;   color='#fff';     bl=`3px solid ${TV.deep}`; dotColor='rgba(255,255,255,.7)' }
                        else if (isSelected && (isPartial || wouldExceed))   { bg='#d97706'; color='#fff';     bl='3px solid #b45309';    dotColor='rgba(255,255,255,.7)' }
                        else if (isSelected)                                  { bg='#dc2626'; color='#fff';     bl='3px solid #991b1b';    dotColor='rgba(255,255,255,.7)' }
                        else if (isClean && !wouldExceed)                    { bg='#fff';    color=TV.text;    bl='3px solid transparent'; dotColor='#22c55e' }
                        else if (isPartial || wouldExceed)                   { bg='#fffbeb'; color='#92400e';  bl='3px solid #fde68a';    dotColor='#f59e0b' }
                        else                                                  { bg='#fff5f5'; color='#b91c1c';  bl='3px solid #fca5a5';    dotColor='#ef4444' }

                        // Unit bar
                        const unitBarPct   = hasUnitInfo ? Math.min(100, Math.round((unitInfo.projectedUnits / unitInfo.maxUnits) * 100)) : 0
                        const unitBarColor = wouldExceed ? '#ef4444' : unitBarPct > 80 ? '#f59e0b' : '#22c55e'
                        const unitLabelColor = isSelected
                          ? 'rgba(255,255,255,.8)'
                          : wouldExceed ? '#b91c1c' : unitBarPct > 80 ? '#92400e' : TV.muted

                        return (
                          <div key={fac}>
                            {/* ── Tier divider: "conflicts/unit issues below" ── */}
                            {idx === dividerAt && (
                              <div style={{ display:'flex', alignItems:'center', gap:6, padding:'5px 12px', background:'#fffbeb', borderTop:`1px solid #fde68a`, borderBottom:`1px solid #fde68a` }}>
                                <Ic.Warning size={9} color="#b45309" />
                                <span style={{ fontSize:9, fontWeight:700, color:'#92400e', textTransform:'uppercase', letterSpacing:'.7px' }}>
                                  Schedule conflicts or unit limit issues below
                                </span>
                              </div>
                            )}

                            <div
                              className="sm-fac-row"
                              onClick={() => { setBatchFaculty(fac); setBatchResults(null); setBatchError('') }}
                              style={{
                                background:bg, color, borderLeft:bl, fontSize:11.5,
                                fontWeight: isSelected ? 700 : 400,
                                flexDirection:'column', gap:5, alignItems:'stretch',
                              }}
                            >
                              {/* ── Top row: dot · name · spec badge · status pill ── */}
                              <div style={{ display:'flex', alignItems:'center', gap:8 }}>
                                <span style={{ width:14, display:'inline-flex', alignItems:'center', justifyContent:'center', flexShrink:0 }}>
                                  {isSelected
                                    ? <Ic.Check size={11} color={color} />
                                    : <span style={{ width:8, height:8, borderRadius:'50%', background:dotColor, display:'inline-block', flexShrink:0 }} />
                                  }
                                </span>

                                <span style={{ flex:1, minWidth:0, overflow:'hidden', textOverflow:'ellipsis', whiteSpace:'nowrap' }}>
                                  {fac}
                                </span>

                                {/* Specialization match badge */}
                                {specRating && (
                                  <span style={{
                                    display:'inline-flex', alignItems:'center', gap:3,
                                    fontSize:9, fontWeight:700, flexShrink:0,
                                    padding:'2px 7px', borderRadius:4,
                                    background: isSelected ? 'rgba(255,255,255,.22)' : '#EDE9FB',
                                    color:      isSelected ? '#fff' : (SPEC_COLORS[specRating] ?? TV.deep),
                                    border:     `1px solid ${isSelected ? 'rgba(255,255,255,.3)' : TV.light}`,
                                  }}>
                                    ★ {SPEC_LABELS[specRating] ?? 'Match'}
                                  </span>
                                )}

                                {/* Availability / conflict status pill */}
                                {!isSelected && isClean && !wouldExceed && (
                                  <span style={{ fontSize:9, fontWeight:700, color:'#15803d', background:'#dcfce7', borderRadius:4, padding:'2px 7px', flexShrink:0 }}>
                                    Free · all {totalSessions}
                                  </span>
                                )}
                                {!isSelected && isPartial && (
                                  <span style={{ display:'inline-flex', alignItems:'center', gap:3, fontSize:9, fontWeight:700, color:'#92400e', background:'#fef3c7', border:'1px solid #fde68a', borderRadius:4, padding:'2px 7px', flexShrink:0 }}>
                                    <Ic.Warning size={8} color="#b45309" />
                                    Conflict {conflictCount}/{totalSessions}
                                  </span>
                                )}
                                {!isSelected && isFullConflict && (
                                  <span style={{ display:'inline-flex', alignItems:'center', gap:3, fontSize:9, fontWeight:700, color:'#b91c1c', background:'#fee2e2', border:'1px solid #fca5a5', borderRadius:4, padding:'2px 7px', flexShrink:0 }}>
                                    <Ic.Warning size={8} color="#b91c1c" />
                                    Busy · all sessions
                                  </span>
                                )}
                                {!isSelected && !isPartial && !isFullConflict && wouldExceed && (
                                  <span style={{ display:'inline-flex', alignItems:'center', gap:3, fontSize:9, fontWeight:700, color:'#b91c1c', background:'#fee2e2', border:'1px solid #fca5a5', borderRadius:4, padding:'2px 7px', flexShrink:0 }}>
                                    <Ic.Warning size={8} color="#b91c1c" />
                                    Over cap
                                  </span>
                                )}
                                {isSelected && (conflictCount > 0 || wouldExceed) && (
                                  <span style={{ fontSize:9.5, color:'rgba(255,255,255,.85)', fontWeight:600, flexShrink:0 }}>
                                    {conflictCount > 0 ? `${conflictCount} overlap${conflictCount > 1 ? 's' : ''} — will override` : 'Unit cap exceeded'}
                                  </span>
                                )}
                                {isSelected && conflictCount === 0 && !wouldExceed && (
                                  <span style={{ fontSize:9.5, color:'rgba(255,255,255,.75)', flexShrink:0, display:'inline-flex', alignItems:'center', gap:3 }}>
                                    <svg width={9} height={9} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round"><polyline points="20 6 9 17 4 12"/></svg>
                                    Available for all sessions
                                  </span>
                                )}
                              </div>

                              {/* ── Bottom row: unit load bar ── */}
                              {hasUnitInfo && (
                                <div style={{ display:'flex', alignItems:'center', gap:8, paddingLeft:22 }}>
                                  {/* Progress bar track */}
                                  <div style={{ flex:1, height:4, borderRadius:99, background: isSelected ? 'rgba(255,255,255,.2)' : '#F0EDF9', overflow:'hidden' }}>
                                    <div style={{
                                      height:'100%', borderRadius:99,
                                      width:`${unitBarPct}%`,
                                      background: isSelected ? 'rgba(255,255,255,.65)' : unitBarColor,
                                      transition:'width .3s ease',
                                    }} />
                                  </div>
                                  {/* Unit label */}
                                  <span style={{ fontSize:9.5, fontWeight:600, flexShrink:0, color:unitLabelColor }}>
                                    {unitInfo.projectedUnits}/{unitInfo.maxUnits} units
                                    {unitInfo.sessionUnits > 0 && (
                                      <span style={{ fontWeight:400, opacity:.7 }}> (+{unitInfo.sessionUnits})</span>
                                    )}
                                    {wouldExceed && (
                                      <span style={{ marginLeft:4, fontWeight:700, color: isSelected ? 'rgba(255,255,255,.9)' : '#b91c1c' }}>
                                        · Over cap!
                                      </span>
                                    )}
                                  </span>
                                </div>
                              )}
                            </div>
                          </div>
                        )
                      })
                    })()}
                  </div>
                </div>

                {/* Overall conflict summary when a faculty is chosen */}
                {batchFaculty && batchConflictCount > 0 && !batchResults && (
                  <div style={{ display:'flex', alignItems:'center', gap:8, padding:'9px 13px', background:'#fff7ed', border:'1px solid #fed7aa', borderRadius:9, fontSize:12 }}>
                    <Ic.Warning size={13} color="#c2410c" />
                    <span style={{ fontWeight:700, color:'#c2410c' }}>{batchConflictCount} session{batchConflictCount > 1 ? 's' : ''} have a schedule overlap.</span>
                    <span style={{ color:'#92400e' }}>They will be force-overridden on save.</span>
                  </div>
                )}

                {batchFaculty && batchConflictCount === 0 && siblingEvents.length > 0 && !batchResults && (
                  <div style={{ display:'flex', alignItems:'center', gap:8, padding:'9px 13px', background:'#f0fdf4', border:'1px solid #bbf7d0', borderRadius:9, fontSize:12 }}>
                    <Ic.CheckCircle size={13} color="#16a34a" />
                    <span style={{ fontWeight:700, color:'#15803d' }}>No overlaps.</span>
                    <span style={{ color:'#166534' }}>All {siblingEvents.length} sessions can be safely assigned.</span>
                  </div>
                )}

                {/* Session list */}
                {siblingEvents.length > 0 ? (
                  <div style={{ display:'flex', flexDirection:'column', gap:8 }}>
                    <p className="sm-field-label">
                      <Ic.Clock size={10} color={TV.muted} /> Affected Sessions ({siblingEvents.length})
                      {merged && (
                        <span style={{ fontWeight:500, fontSize:10, color:TV.deep, textTransform:'none', letterSpacing:0, marginLeft:4 }}>
                          — merged block (both sides)
                        </span>
                      )}
                    </p>
                    {siblingEvents.map(sib => {
                      const sibId          = getEventId(sib)
                      const isCurrentEvent = sibId === evId
                      const conflicts      = batchFaculty ? (batchConflictMap.get(sibId) ?? []) : []
                      const hasConflict    = conflicts.length > 0
                      const result         = batchResults?.find(r => getEventId(r.sib) === sibId)
                      // Is this sib the partner block (different from the clicked event's block)?
                      const isPartnerBlock = merged && sib.block !== event.block

                      return (
                        <div
                          key={sibId}
                          style={{
                            padding:'11px 14px', borderRadius:10,
                            border:`1px solid ${result?.ok ? '#86efac' : hasConflict ? '#fca5a5' : TV.border}`,
                            background: result?.ok ? '#f0fdf4' : hasConflict ? '#fff8f8' : '#fff',
                            display:'flex', alignItems:'flex-start', gap:12,
                          }}
                        >
                          {/* Status icon */}
                          <div style={{ marginTop:1, flexShrink:0 }}>
                            {result?.ok
                              ? <Ic.CheckCircle size={15} color="#16a34a" />
                              : result?.error
                                ? <Ic.AlertCircle size={15} color="#b91c1c" />
                                : hasConflict
                                  ? <Ic.Warning size={15} color="#c2410c" />
                                  : <Ic.Clock size={15} color={TV.muted} />
                            }
                          </div>

                          {/* Session info */}
                          <div style={{ flex:1, minWidth:0 }}>
                            <div style={{ display:'flex', alignItems:'center', gap:7, flexWrap:'wrap', marginBottom:3 }}>
                              <span style={{ fontSize:12, fontWeight:700, color:TV.text }}>{sib.day}</span>
                              <span style={{ fontSize:11, color:TV.muted }}>·</span>
                              <span style={{ fontSize:11, color:TV.muted }}>{sib.period}</span>
                              {sib.room && sib.room !== 'TBA' && (
                                <span style={{ display:'inline-flex', alignItems:'center', gap:3, fontSize:10, color:TV.muted, background:'#fff', border:`1px solid ${TV.border}`, padding:'1px 7px', borderRadius:4 }}>
                                  <Ic.MapPin size={8} color={TV.muted} />{sib.room}
                                </span>
                              )}
                              <span style={{ fontSize:10, color:TV.muted, background:'#fff', border:`1px solid ${TV.border}`, padding:'1px 7px', borderRadius:4 }}>
                                {sib.session}
                              </span>
                              {/* Section tag — always shown, highlighted when partner block */}
                              {sib.program && (
                                <span style={{
                                  fontSize:9.5, fontWeight:700,
                                  padding:'1px 7px', borderRadius:4,
                                  background: isPartnerBlock ? '#EDE9FB' : '#F5F4FB',
                                  color: isPartnerBlock ? TV.deep : TV.muted,
                                  border: `1px solid ${isPartnerBlock ? TV.light : TV.border}`,
                                }}>
                                  {sib.program} {sib.year}-{sib.block}
                                  {isPartnerBlock && ' (merged partner)'}
                                </span>
                              )}
                              {isCurrentEvent && (
                                <span style={{ fontSize:9.5, fontWeight:700, color:TV.deep, background:TV.pale, border:`1px solid ${TV.light}`, padding:'1px 7px', borderRadius:4 }}>
                                  This session
                                </span>
                              )}
                              {sib.faculty && sib.faculty !== 'TBA' && sib.faculty !== batchFaculty && (
                                <span style={{ fontSize:9.5, color:'#92400e', background:'#fff7ed', border:'1px solid #fed7aa', padding:'1px 7px', borderRadius:4 }}>
                                  Currently: {sib.faculty}
                                </span>
                              )}
                            </div>

                            {/* Conflict details */}
                            {hasConflict && !result && (
                              <div style={{ marginTop:4 }}>
                                {conflicts.map((c, i) => (
                                  <div key={i} style={{ fontSize:10.5, color:'#c2410c', display:'flex', alignItems:'center', gap:5 }}>
                                    <svg width={10} height={10} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" style={{flexShrink:0,opacity:.7}}><path d="M10.29 3.86L1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z"/><line x1="12" y1="9" x2="12" y2="13"/><line x1="12" y1="17" x2="12.01" y2="17"/></svg>
                                    <span>
                                      Overlaps with <strong>{c.courseCode}</strong> {c.program} {c.year}-{c.block} ({c.period}) — will force-override
                                    </span>
                                  </div>
                                ))}
                              </div>
                            )}

                            {/* Save result feedback */}
                            {result?.error && (
                              <p style={{ margin:'4px 0 0', fontSize:10.5, color:'#b91c1c' }}>{result.error}</p>
                            )}
                          </div>
                        </div>
                      )
                    })}
                  </div>
                ) : (
                  <div className="sm-empty">
                    <p style={{ fontSize:12, color:TV.muted, margin:0 }}>No sessions found for {event.courseCode} · {sectionLabel}.</p>
                  </div>
                )}

              </div>
            )}

            {/* ── Batch tab footer ── */}
            {tab === 'batch' && (
              <>
                {batchError && (
                  <div style={{ display:'flex', alignItems:'center', gap:8, background:'#fff8f8', border:'1px solid #fecaca', borderRadius:9, padding:'8px 12px', marginBottom:10, fontSize:12, color:'#b91c1c', fontWeight:600 }}>
                    <Ic.AlertCircle size={13} color="#b91c1c" />
                    <span style={{ flex:1 }}>{batchError}</span>
                    <button onClick={() => setBatchError('')} style={{ background:'none', border:'none', color:'#b91c1c', cursor:'pointer', fontSize:17, lineHeight:1, padding:0 }}>×</button>
                  </div>
                )}

                {batchConflictCount > 0 && !batchResults && (
                  <div style={{ display:'flex', alignItems:'center', gap:8, background:'#fff7ed', border:'1px solid #fed7aa', borderRadius:9, padding:'7px 12px', marginBottom:10, fontSize:11.5 }}>
                    <Ic.Warning size={12} color="#c2410c" />
                    <span style={{ color:'#c2410c', fontWeight:600 }}>
                      {batchConflictCount} overlap{batchConflictCount > 1 ? 's' : ''} will be force-overridden
                    </span>
                  </div>
                )}

                <div style={{ display:'flex', gap:8 }}>
                  {/* batchFaculty can be a name OR 'TBA' (unassign) — both are valid */}
                  {(() => {
                    const isTBA      = batchFaculty === 'TBA'
                    const hasChoice  = batchFaculty !== '' && batchFaculty != null
                    const btnEnabled = hasChoice && !batchSaving
                    const bg = !hasChoice
                      ? '#f3f4f6'
                      : isTBA
                        ? 'linear-gradient(135deg,#6b7280,#4b5563)'
                        : batchConflictCount > 0
                          ? '#d97706'
                          : 'linear-gradient(135deg,#7C6FCD,#5a4fbf)'
                    return (
                      <button
                        className="sm-save-btn"
                        onClick={handleBatchSave}
                        disabled={!hasChoice || batchSaving}
                        style={{
                          background: bg,
                          color: !hasChoice ? TV.muted : '#fff',
                          cursor: btnEnabled ? 'pointer' : 'default',
                          opacity: batchSaving ? .7 : 1,
                          boxShadow: btnEnabled ? '0 4px 14px rgba(124,111,205,.3)' : 'none',
                        }}
                      >
                        {batchSaving
                          ? <><Ic.Spin size={13} color="#fff" /> {isTBA ? 'Clearing…' : 'Assigning…'}</>
                          : isTBA
                            ? <><Ic.User size={13} color="#fff" /> Unassign All {siblingEvents.length} Sessions</>
                            : batchConflictCount > 0
                              ? <><Ic.Warning size={13} color="#fff" /> Assign with Overrides ({siblingEvents.length} sessions)</>
                              : <><Ic.Users size={13} color={hasChoice ? '#fff' : TV.muted} /> Assign to All {siblingEvents.length} Sessions</>
                        }
                      </button>
                    )
                  })()}
                  <button className="sm-cancel-btn" onClick={onClose}>Cancel</button>
                </div>
              </>
            )}

            {/* ── Single session tabs footer ── */}
            {tab !== 'batch' && tab !== 'merge' && (
              <>
                {error && (
                  <div style={{ display:'flex', alignItems:'center', gap:8, background:'#fff8f8', border:'1px solid #fecaca', borderRadius:9, padding:'8px 12px', marginBottom:10, fontSize:12, color:'#b91c1c', fontWeight:600 }}>
                    <Ic.AlertCircle size={13} color="#b91c1c" />
                    <span style={{ flex:1 }}>{error}</span>
                    <button onClick={() => setError('')} style={{ background:'none', border:'none', color:'#b91c1c', cursor:'pointer', fontSize:17, lineHeight:1, padding:0, fontFamily:'inherit' }}>×</button>
                  </div>
                )}

                {(() => {
                  const isMergePartner = c =>
                    c.courseCode === event.courseCode &&
                    String(c.year) === String(event.year) &&
                    c.program === event.program &&
                    c.block !== event.block
                  const realPreviewConflicts = previewConflicts.filter(c => !isMergePartner(c))
                  const mergePreviewConflicts = previewConflicts.filter(isMergePartner)
                  return (
                    <>
                      {mergePreviewConflicts.length > 0 && realPreviewConflicts.length === 0 && (
                        <div style={{ display:'flex', alignItems:'center', gap:8, background:TV.pale, border:`1px solid ${TV.light}`, borderRadius:9, padding:'7px 12px', marginBottom:10, fontSize:11.5 }}>
                          <Ic.Link size={12} color={TV.deep} />
                          <span style={{ color:TV.deep, fontWeight:600 }}>
                            This slot would merge with {mergePreviewConflicts.length} partner section{mergePreviewConflicts.length > 1 ? 's' : ''}
                          </span>
                          <button className="sm-view-link" onClick={() => setTab('conflicts')} style={{ marginLeft:'auto' }}>
                            View details
                          </button>
                        </div>
                      )}
                      {realPreviewConflicts.length > 0 && (
                        <div style={{ display:'flex', alignItems:'center', gap:8, background:'#fff8f8', border:'1px solid #fecaca', borderRadius:9, padding:'7px 12px', marginBottom:10, fontSize:11.5 }}>
                          <Ic.Warning size={12} color="#b91c1c" />
                          <span style={{ color:'#b91c1c', fontWeight:600 }}>
                            {realPreviewConflicts.length} conflict{realPreviewConflicts.length > 1 ? 's' : ''} in proposed slot
                          </span>
                          <button className="sm-view-link" onClick={() => setTab('conflicts')} style={{ marginLeft:'auto' }}>
                            View details
                          </button>
                        </div>
                      )}
                    </>
                  )
                })()}

                <div style={{ display:'flex', gap:8 }}>
                  {(() => {
                    const isMergePartner = c =>
                      c.courseCode === event.courseCode &&
                      String(c.year) === String(event.year) &&
                      c.program === event.program &&
                      c.block !== event.block
                    const realConflicts = previewConflicts.filter(c => !isMergePartner(c))
                    const hasRealConflicts = realConflicts.length > 0
                    return (
                      <button
                        className="sm-save-btn"
                        onClick={handleSave}
                        disabled={!hasChanges || saving}
                        style={{
                          background: !hasChanges
                            ? '#f3f4f6'
                            : hasRealConflicts
                              ? '#dc2626'
                              : 'linear-gradient(135deg,#7C6FCD,#5a4fbf)',
                          color: !hasChanges ? TV.muted : '#fff',
                          cursor: hasChanges && !saving ? 'pointer' : 'default',
                          opacity: saving ? .7 : 1,
                          boxShadow: hasChanges && !saving ? '0 4px 14px rgba(124,111,205,.3)' : 'none',
                        }}
                      >
                        {saving
                          ? <><Ic.Spin size={13} color="#fff" /> Saving…</>
                          : hasRealConflicts
                            ? <><Ic.Warning size={13} color="#fff" /> Force Override</>
                            : <><Ic.Save size={13} color={hasChanges ? '#fff' : TV.muted} /> Save Changes</>
                        }
                      </button>
                    )
                  })()}
                  <button className="sm-cancel-btn" onClick={onClose}>Cancel</button>
                </div>
              </>
            )}
          </div>

        </div>
      </ModalOverlay>

      {showConfirm && (
        <OverrideConfirmDialog
          event={event} newDay={newDay} newPeriod={newPeriod}
          newRoom={newRoom} newFaculty={newFaculty} conflicts={previewConflicts}
          onConfirm={() => { setShowConfirm(false); doSave(true) }}
          onCancel={() => setShowConfirm(false)}
        />
      )}
    </>
  )
}