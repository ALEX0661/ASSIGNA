import { useEffect, useState, useMemo } from 'react'
import { useAuth } from '../../hooks/useAuth'
import { listSaved, loadSaved, getFaculty } from '../../services/api'
import { buildConflictMap, isMergedEvent } from '../../components/ScheduleView/svHelpers'

// ─── Theme ────────────────────────────────────────────────────────────────────
const T = {
  purple:      '#7C6FCD',
  purpleDeep:  '#5a4fbf',
  purpleSoft:  '#EEEAFB',
  purpleBorder:'#D8D3F5',
  textMain:    '#1a1a2e',
  textMid:     '#4a4a6a',
  textMuted:   '#8883B0',
  textLight:   '#B0ABCC',
  border:      '#E8E4F8',
  borderLight: '#F5F4FB',
  bg:          '#FFFFFF',
  bgAlt:       '#FAFAFE',
  bgPage:      '#F4F2FC',
}

const DAYS = ['Monday','Tuesday','Wednesday','Thursday','Friday','Saturday','Sunday']
const DAY_SHORT = { Monday:'Mon', Tuesday:'Tue', Wednesday:'Wed', Thursday:'Thu', Friday:'Fri', Saturday:'Sat', Sunday:'Sun' }
const DAY_COLOR = ['#7C6FCD','#6B8DD6','#5B9FCA','#4AACB5','#48BFA3','#6BC78A','#8DD47A']

// ─── Helpers ──────────────────────────────────────────────────────────────────
function inferSemester(name = '') {
  const n = name.toLowerCase()
  if (n.includes('summer')) return 'Summer'
  if (n.includes('2nd') || n.includes('second')) return '2nd Semester'
  return '1st Semester'
}

function Badge({ children, type = 'default' }) {
  const styles = {
    lec:     { bg:'#EFF6FF', color:'#2563EB', border:'#BFDBFE' },
    lab:     { bg:'#FFF7ED', color:'#D97706', border:'#FDE68A' },
    room:    { bg:T.purpleSoft, color:T.purpleDeep, border:T.purpleBorder },
    merged:  { bg:'#ECFDF5', color:'#059669', border:'#A7F3D0' },
    conflict:{ bg:'#FEF2F2', color:'#B91C1C', border:'#FECACA' },
    default: { bg:T.bgAlt,   color:T.textMid, border:T.border },
  }
  const s = styles[type] || styles.default
  return (
    <span style={{
      display:'inline-flex', alignItems:'center', gap:4,
      padding:'3px 9px', borderRadius:7, fontSize:11, fontWeight:600,
      background:s.bg, color:s.color, border:`1px solid ${s.border}`,
      whiteSpace:'nowrap', letterSpacing:'0.2px'
    }}>{children}</span>
  )
}

function Skel({ w='100%', h=14, r=8 }) {
  return (
    <div style={{
      width:w, height:h, borderRadius:r,
      background:'linear-gradient(90deg,#EDE9F8 25%,#F5F3FC 50%,#EDE9F8 75%)',
      backgroundSize:'200% 100%',
      animation:'shimmer 1.4s infinite',
      flexShrink:0
    }}/>
  )
}

// ─── List View Card ───────────────────────────────────────────────────────────
function ListCard({ event, index, conflictMap }) {
  const [hovered, setHovered] = useState(false)
  const isMerged   = isMergedEvent?.(event) ?? false
  const hasConflict = conflictMap?.has(event.schedule_id)
  const dayIdx     = DAYS.indexOf(event.day)
  const accentColor = DAY_COLOR[dayIdx] || T.purple

  return (
    <div
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => setHovered(false)}
      style={{
        background: hovered ? T.bgAlt : T.bg,
        borderRadius: 14, padding: '18px 20px',
        border: `1px solid ${T.border}`,
        borderLeft: `4px solid ${accentColor}`,
        display: 'flex', alignItems: 'stretch', gap: 18,
        transition: 'all 0.18s ease',
        boxShadow: hovered ? `0 6px 24px rgba(124,111,205,0.1)` : '0 1px 4px rgba(124,111,205,0.04)',
        transform: hovered ? 'translateY(-1px)' : 'none',
        animation: `fadeUp 0.28s ease ${index * 0.04}s both`,
        cursor: 'default'
      }}
    >
      {/* Time block */}
      <div style={{
        display:'flex', flexDirection:'column', alignItems:'center', justifyContent:'center',
        background: T.bgAlt, border:`1px solid ${T.border}`,
        borderRadius: 10, padding:'10px 14px', minWidth: 108, flexShrink: 0, gap: 2
      }}>
        {event.period?.split(/\s*[–—-]\s*/).map((t, ti) => (
          <div key={ti} style={{ textAlign:'center' }}>
            <span style={{ fontFamily:'monospace', fontSize:12.5, fontWeight:700, color:T.textMain, display:'block' }}>{t.trim()}</span>
            {ti === 0 && event.period?.includes('–') && <span style={{ fontSize:9, color:T.textLight, display:'block' }}>to</span>}
          </div>
        ))}
        <div style={{
          marginTop:6, padding:'2px 8px', borderRadius:99,
          background: accentColor + '18', color: accentColor,
          fontSize:10, fontWeight:700, letterSpacing:'0.3px'
        }}>{DAY_SHORT[event.day] || event.day}</div>
      </div>

      {/* Details */}
      <div style={{ flex:1, minWidth:0, display:'flex', flexDirection:'column', justifyContent:'center', gap:8 }}>
        <div style={{ display:'flex', alignItems:'center', gap:8, flexWrap:'wrap' }}>
          <span style={{ fontSize:15, fontWeight:800, color:T.purpleDeep }}>{event.courseCode}</span>
          <span style={{ width:4, height:4, borderRadius:'50%', background:T.textLight, flexShrink:0 }}/>
          <span style={{ fontSize:14, fontWeight:500, color:T.textMain, overflow:'hidden', textOverflow:'ellipsis', whiteSpace:'nowrap', maxWidth:260 }}>{event.title}</span>
        </div>
        <div style={{ display:'flex', gap:6, flexWrap:'wrap', alignItems:'center' }}>
          <Badge type={event.session?.toLowerCase().includes('lab') ? 'lab' : 'lec'}>
            {event.session === 'Lecture'
              ? <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"><path d="M4 19.5A2.5 2.5 0 0 1 6.5 17H20"/><path d="M6.5 2H20v20H6.5A2.5 2.5 0 0 1 4 19.5v-15A2.5 2.5 0 0 1 6.5 2z"/></svg>
              : <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"><path d="M9 3H5a2 2 0 0 0-2 2v4m6-6h10a2 2 0 0 1 2 2v4M9 3v18m0 0h10a2 2 0 0 0 2-2V9M9 21H5a2 2 0 0 1-2-2V9m0 0h18"/></svg>
            }
            {event.session}
          </Badge>
          {(event.program || event.year || event.block) && (
            <Badge>
              {[event.program, event.year && `Y${event.year}`, event.block].filter(Boolean).join(' ')}
            </Badge>
          )}
          {event.room && (
            <Badge type="room">
              <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"><path d="M3 9l9-7 9 7v11a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z"/><polyline points="9 22 9 12 15 12 15 22"/></svg>
              {event.room}
            </Badge>
          )}
          {isMerged && <Badge type="merged">Merged</Badge>}
          {hasConflict && <Badge type="conflict">Conflict</Badge>}
        </div>
      </div>

      {/* Units chip */}
      {event.units != null && (
        <div style={{
          display:'flex', flexDirection:'column', alignItems:'center', justifyContent:'center',
          flexShrink:0, gap:2
        }}>
          <span style={{ fontSize:20, fontWeight:800, color:T.purple, lineHeight:1 }}>{event.units}</span>
          <span style={{ fontSize:9.5, fontWeight:700, color:T.textMuted, textTransform:'uppercase', letterSpacing:'.4px' }}>units</span>
        </div>
      )}
    </div>
  )
}

// ─── Grid View Card ───────────────────────────────────────────────────────────
function GridCard({ event, index, conflictMap }) {
  const [hovered, setHovered] = useState(false)
  const isMerged   = isMergedEvent?.(event) ?? false
  const hasConflict = conflictMap?.has(event.schedule_id)
  const dayIdx     = DAYS.indexOf(event.day)
  const accentColor = DAY_COLOR[dayIdx] || T.purple

  return (
    <div
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => setHovered(false)}
      style={{
        background: hovered ? T.bgAlt : T.bg,
        borderRadius: 14, padding: '18px',
        border: `1px solid ${T.border}`,
        borderTop: `3px solid ${accentColor}`,
        display:'flex', flexDirection:'column', gap:12,
        transition:'all 0.18s ease',
        boxShadow: hovered ? `0 8px 28px rgba(124,111,205,0.13)` : '0 1px 4px rgba(124,111,205,0.04)',
        transform: hovered ? 'translateY(-2px)' : 'none',
        animation: `fadeUp 0.28s ease ${index * 0.04}s both`,
        cursor:'default'
      }}
    >
      {/* Top row: day + session */}
      <div style={{ display:'flex', justifyContent:'space-between', alignItems:'center' }}>
        <span style={{
          fontSize:11, fontWeight:700, letterSpacing:'0.4px',
          color: accentColor, textTransform:'uppercase'
        }}>{event.day}</span>
        <Badge type={event.session?.toLowerCase().includes('lab') ? 'lab' : 'lec'}>
          {event.session}
        </Badge>
      </div>

      {/* Course code + title */}
      <div>
        <div style={{ fontSize:18, fontWeight:800, color:T.purpleDeep, lineHeight:1.1 }}>{event.courseCode}</div>
        <div style={{ fontSize:12.5, color:T.textMid, marginTop:4, fontWeight:500, lineHeight:1.4,
          display:'-webkit-box', WebkitLineClamp:2, WebkitBoxOrient:'vertical', overflow:'hidden'
        }}>{event.title}</div>
      </div>

      <div style={{ height:1, background:T.border }} />

      {/* Details grid */}
      <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr', gap:'8px 12px' }}>
        <div>
          <div style={{ fontSize:9.5, fontWeight:700, color:T.textLight, textTransform:'uppercase', letterSpacing:'.5px', marginBottom:3 }}>Time</div>
          <div style={{ fontSize:12, fontWeight:600, color:T.textMain }}>{event.period || '—'}</div>
        </div>
        <div>
          <div style={{ fontSize:9.5, fontWeight:700, color:T.textLight, textTransform:'uppercase', letterSpacing:'.5px', marginBottom:3 }}>Room</div>
          <div style={{ fontSize:12, fontWeight:600, color:T.textMain }}>{event.room || '—'}</div>
        </div>
        <div>
          <div style={{ fontSize:9.5, fontWeight:700, color:T.textLight, textTransform:'uppercase', letterSpacing:'.5px', marginBottom:3 }}>Class</div>
          <div style={{ fontSize:12, fontWeight:600, color:T.textMain }}>
            {[event.program, event.year && `Y${event.year}`, event.block].filter(Boolean).join(' ') || '—'}
          </div>
        </div>
        <div>
          <div style={{ fontSize:9.5, fontWeight:700, color:T.textLight, textTransform:'uppercase', letterSpacing:'.5px', marginBottom:3 }}>Units</div>
          <div style={{ fontSize:12, fontWeight:800, color:T.purple }}>{event.units ?? '—'}</div>
        </div>
      </div>

      {(isMerged || hasConflict) && (
        <div style={{ display:'flex', gap:6, flexWrap:'wrap' }}>
          {isMerged && <Badge type="merged">Merged Block</Badge>}
          {hasConflict && <Badge type="conflict">Conflict</Badge>}
        </div>
      )}
    </div>
  )
}

// ─── Weekly Heatmap ───────────────────────────────────────────────────────────
function WeekHeatmap({ myEvents }) {
  const dayCount = useMemo(() => {
    const map = {}
    DAYS.forEach(d => { map[d] = myEvents.filter(e => e.day === d).length })
    return map
  }, [myEvents])
  const maxCount = Math.max(...Object.values(dayCount), 1)

  return (
    <div style={{ display:'flex', gap:6, alignItems:'stretch' }}>
      {DAYS.map((d, i) => {
        const count = dayCount[d]
        const intensity = count / maxCount
        const color = DAY_COLOR[i]
        return (
          <div key={d} style={{ flex:1, display:'flex', flexDirection:'column', alignItems:'center', gap:5 }}>
            <div style={{ fontSize:10.5, fontWeight:700, color: count > 0 ? color : T.textLight, textTransform:'uppercase' }}>
              {d.slice(0,2)}
            </div>
            <div style={{
              flex:1, width:'100%', minHeight:32, borderRadius:8,
              background: count > 0 ? color + Math.round(intensity * 200).toString(16).padStart(2,'0') : T.borderLight,
              transition:'all 0.2s', border:`1px solid ${count > 0 ? color + '30' : T.border}`
            }}/>
            {count > 0 && (
              <span style={{ fontSize:11, fontWeight:700, color:color }}>{count}</span>
            )}
          </div>
        )
      })}
    </div>
  )
}

// ─── Main Component ───────────────────────────────────────────────────────────
export default function FacultySchedulePage() {
  const { user } = useAuth()

  const [scheduleNames,    setScheduleNames]    = useState([])
  const [selectedSchedule, setSelectedSchedule] = useState('')
  const [semester,         setSemester]         = useState('All')
  const [events,           setEvents]           = useState([])
  const [facultyName,      setFacultyName]      = useState('')
  const [facultyMeta,      setFacultyMeta]      = useState({})
  const [viewMode,         setViewMode]         = useState('list')  // 'list' | 'grid'
  const [activeDay,        setActiveDay]        = useState('All')

  const [listLoading,   setListLoading]   = useState(true)
  const [eventsLoading, setEventsLoading] = useState(false)
  const [error,         setError]         = useState('')

  // Group schedules by inferred semester
  const semesterGroups = useMemo(() => {
    const map = { 'All': scheduleNames }
    scheduleNames.forEach(n => {
      const sem = inferSemester(n)
      if (!map[sem]) map[sem] = []
      map[sem].push(n)
    })
    return map
  }, [scheduleNames])

  const semesterOptions = useMemo(() => {
    return ['All', ...Object.keys(semesterGroups).filter(k => k !== 'All')]
  }, [semesterGroups])

  const filteredSchedules = useMemo(() => {
    return semester === 'All' ? scheduleNames : (semesterGroups[semester] || [])
  }, [semester, scheduleNames, semesterGroups])

  // Init
  useEffect(() => {
    if (!user) return
    async function init() {
      try {
        let resolvedName = user.displayName || user.email || ''
        try {
          const list = await getFaculty()
          if (list.length > 0) {
            const me = list[0]
            if (me.name) resolvedName = me.name
            setFacultyMeta({
              rank:      me.AcademicRank || '',
              department:me.Department   || '',
              units:     me.units        ?? 0,
              max_units: me.max_units    ?? 21,
              status:    me.status       || 'full-time',
            })
          }
        } catch {}
        setFacultyName(resolvedName)
        const names = await listSaved()
        const arr = Array.isArray(names) ? names : (names?.schedules || [])
        setScheduleNames(arr)
        if (arr.length > 0) setSelectedSchedule(arr[arr.length - 1])
      } catch {
        setError('Could not load schedule data.')
      } finally {
        setListLoading(false)
      }
    }
    init()
  }, [user])

  // Load events
  useEffect(() => {
    if (!selectedSchedule) return
    setEventsLoading(true)
    loadSaved(selectedSchedule)
      .then(data => {
        setEvents(data.schedule || data.events || [])
      })
      .catch(() => setError(`Could not load "${selectedSchedule}".`))
      .finally(() => setEventsLoading(false))
  }, [selectedSchedule])

  const myEvents = useMemo(() => {
    if (!facultyName && !user?.email) return []
    return events.filter(e =>
      (facultyName && e.faculty === facultyName) ||
      (user?.email && e.faculty === user.email)
    )
  }, [events, facultyName, user])

  const conflictMap = useMemo(() => buildConflictMap?.(myEvents) || new Map(), [myEvents])

  const teachingDays = useMemo(() =>
    DAYS.filter(d => myEvents.some(e => e.day === d))
  , [myEvents])

  const displayedEvents = useMemo(() => {
    let arr = [...myEvents]
    if (activeDay !== 'All') arr = arr.filter(e => e.day === activeDay)
    arr.sort((a, b) => {
      const da = DAYS.indexOf(a.day), db = DAYS.indexOf(b.day)
      if (da !== db) return da - db
      return (a.period || '').localeCompare(b.period || '')
    })
    return arr
  }, [myEvents, activeDay])

  const totalUnits = useMemo(() => myEvents.reduce((s, e) => s + (e.units || 0), 0), [myEvents])
  const loading = listLoading || eventsLoading

  return (
    <div style={{ fontFamily:"'Poppins',sans-serif", color:T.textMain, minHeight:'100vh' }}>
      <style>{`
        @keyframes shimmer { 0%{background-position:200% 0} 100%{background-position:-200% 0} }
        @keyframes fadeUp  { from{opacity:0;transform:translateY(12px)} to{opacity:1;transform:translateY(0)} }
        @keyframes spin    { to{transform:rotate(360deg)} }
      `}</style>

      {/* ── Page Header ── */}
      <div style={{ marginBottom:28 }}>
        <div style={{ display:'flex', alignItems:'flex-start', justifyContent:'space-between', flexWrap:'wrap', gap:16 }}>
          <div>
            <h1 style={{ fontSize:22, fontWeight:800, color:T.textMain, margin:0, lineHeight:1.2 }}>My Schedule</h1>
            {facultyMeta.rank && (
              <p style={{ fontSize:13, color:T.textMuted, margin:'6px 0 0', fontWeight:500 }}>
                {facultyMeta.rank}{facultyMeta.department ? ` · ${facultyMeta.department}` : ''}
              </p>
            )}
          </div>

          {/* Controls row */}
          <div style={{ display:'flex', gap:10, alignItems:'center', flexWrap:'wrap' }}>
            {/* Semester filter */}
            <div style={{ position:'relative' }}>
              <select
                value={semester}
                onChange={e => { setSemester(e.target.value); setSelectedSchedule('') }}
                style={{
                  appearance:'none', padding:'9px 36px 9px 14px',
                  borderRadius:10, border:`1.5px solid ${T.purpleBorder}`,
                  fontSize:13, fontWeight:600, color:T.purpleDeep, background:T.bg,
                  cursor:'pointer', outline:'none', fontFamily:"'Poppins',sans-serif"
                }}
              >
                {semesterOptions.map(s => <option key={s} value={s}>{s}</option>)}
              </select>
              <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke={T.purple} strokeWidth="2.5"
                style={{ position:'absolute', right:12, top:'50%', transform:'translateY(-50%)', pointerEvents:'none' }}>
                <polyline points="6 9 12 15 18 9"/>
              </svg>
            </div>

            {/* Schedule dropdown */}
            {filteredSchedules.length > 0 && (
              <div style={{ position:'relative' }}>
                <select
                  value={selectedSchedule}
                  onChange={e => setSelectedSchedule(e.target.value)}
                  style={{
                    appearance:'none', padding:'9px 36px 9px 14px',
                    borderRadius:10, border:`1.5px solid ${T.border}`,
                    fontSize:13, fontWeight:500, color:T.textMid, background:T.bg,
                    cursor:'pointer', outline:'none', fontFamily:"'Poppins',sans-serif",
                    maxWidth:200
                  }}
                >
                  {filteredSchedules.map(n => <option key={n} value={n}>{n}</option>)}
                </select>
                <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke={T.textMuted} strokeWidth="2.5"
                  style={{ position:'absolute', right:12, top:'50%', transform:'translateY(-50%)', pointerEvents:'none' }}>
                  <polyline points="6 9 12 15 18 9"/>
                </svg>
              </div>
            )}

            {/* View toggle */}
            <div style={{
              display:'flex', background:T.bgAlt, border:`1.5px solid ${T.border}`,
              borderRadius:10, padding:3, gap:2
            }}>
              {[
                { mode:'list', icon: <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"><line x1="8" y1="6" x2="21" y2="6"/><line x1="8" y1="12" x2="21" y2="12"/><line x1="8" y1="18" x2="21" y2="18"/><line x1="3" y1="6" x2="3.01" y2="6"/><line x1="3" y1="12" x2="3.01" y2="12"/><line x1="3" y1="18" x2="3.01" y2="18"/></svg> },
                { mode:'grid', icon: <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"><rect x="3" y="3" width="7" height="7"/><rect x="14" y="3" width="7" height="7"/><rect x="14" y="14" width="7" height="7"/><rect x="3" y="14" width="7" height="7"/></svg> },
              ].map(({ mode, icon }) => (
                <button key={mode} onClick={() => setViewMode(mode)} style={{
                  padding:'7px 12px', borderRadius:7, border:'none', cursor:'pointer',
                  background: viewMode === mode ? T.bg : 'transparent',
                  color: viewMode === mode ? T.purpleDeep : T.textMuted,
                  boxShadow: viewMode === mode ? `0 1px 4px rgba(124,111,205,0.15)` : 'none',
                  transition:'all 0.15s', display:'flex', alignItems:'center', justifyContent:'center'
                }}>{icon}</button>
              ))}
            </div>
          </div>
        </div>
      </div>

      {/* ── Stats Bar ── */}
      {!loading && myEvents.length > 0 && (
        <div style={{
          display:'flex', background:T.bg, border:`1px solid ${T.border}`,
          borderRadius:14, overflow:'hidden', marginBottom:24,
          boxShadow:'0 1px 6px rgba(124,111,205,0.06)'
        }}>
          {[
            { label:'Total Classes', value: myEvents.length,     color:T.purple },
            { label:'Teaching Days', value: teachingDays.length, color:'#5B9FCA' },
            { label:'Total Units',   value: totalUnits,          color:'#48BFA3' },
            { label:'Schedule',      value: selectedSchedule || '—', isText:true, color:T.textMid },
          ].map((s, i, arr) => (
            <div key={s.label} style={{
              flex:1, padding:'14px 20px', minWidth:0,
              borderRight: i < arr.length-1 ? `1px solid ${T.border}` : 'none'
            }}>
              <div style={{ fontSize:9.5, fontWeight:700, color:T.textMuted, textTransform:'uppercase', letterSpacing:'.8px', marginBottom:3 }}>
                {s.label}
              </div>
              <div style={{
                fontSize: s.isText ? 14 : 24, fontWeight:800, color:s.color, lineHeight:1.1,
                overflow:'hidden', textOverflow:'ellipsis', whiteSpace:'nowrap'
              }}>
                {s.value}
              </div>
            </div>
          ))}
        </div>
      )}

      {/* ── Loading ── */}
      {loading && (
        <div style={{ display:'flex', flexDirection:'column', gap:12 }}>
          {[1,2,3].map(i => (
            <div key={i} style={{ background:T.bg, borderRadius:14, padding:20, border:`1px solid ${T.border}`, display:'flex', gap:16, alignItems:'center' }}>
              <Skel w={110} h={72} r={10}/>
              <div style={{ flex:1, display:'flex', flexDirection:'column', gap:8 }}>
                <Skel w="60%" h={16}/>
                <Skel w="40%" h={12}/>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* ── No Schedules ── */}
      {!loading && scheduleNames.length === 0 && (
        <div style={{ background:T.bg, borderRadius:16, padding:'56px 32px', border:`2px dashed ${T.border}`, display:'flex', flexDirection:'column', alignItems:'center', gap:14, textAlign:'center' }}>
          <div style={{ width:56, height:56, borderRadius:16, background:T.purpleSoft, display:'flex', alignItems:'center', justifyContent:'center' }}>
            <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke={T.purple} strokeWidth="2"><rect x="3" y="4" width="18" height="18" rx="2" ry="2"/><line x1="16" y1="2" x2="16" y2="6"/><line x1="8" y1="2" x2="8" y2="6"/><line x1="3" y1="10" x2="21" y2="10"/></svg>
          </div>
          <div>
            <p style={{ fontSize:16, fontWeight:700, color:T.textMain, margin:'0 0 6px' }}>No schedules available</p>
            <p style={{ fontSize:13, color:T.textMuted, maxWidth:340, lineHeight:1.6, margin:0 }}>Once administration finalizes a schedule, your classes will appear here.</p>
          </div>
        </div>
      )}

      {/* ── Has Data ── */}
      {!loading && myEvents.length > 0 && (
        <>
          {/* Heatmap */}
          <div style={{ background:T.bg, borderRadius:14, border:`1px solid ${T.border}`, padding:'16px 20px', marginBottom:20 }}>
            <div style={{ fontSize:11, fontWeight:700, color:T.textMuted, textTransform:'uppercase', letterSpacing:'.6px', marginBottom:12 }}>Weekly Overview</div>
            <WeekHeatmap myEvents={myEvents} />
          </div>

          {/* Day filter tabs */}
          <div style={{ display:'flex', gap:8, flexWrap:'wrap', marginBottom:20 }}>
            <button
              onClick={() => setActiveDay('All')}
              style={{
                padding:'7px 16px', borderRadius:99, fontSize:12.5, fontWeight:600,
                cursor:'pointer', border:'1.5px solid', fontFamily:"'Poppins',sans-serif",
                background: activeDay==='All' ? T.purpleSoft : 'transparent',
                borderColor: activeDay==='All' ? T.purpleBorder : T.border,
                color: activeDay==='All' ? T.purpleDeep : T.textMuted,
                transition:'all 0.15s'
              }}
            >
              All Days
              <span style={{
                marginLeft:7, fontSize:10.5, fontWeight:700, padding:'2px 7px',
                borderRadius:99, background: activeDay==='All' ? T.bg : T.bgAlt,
                color: activeDay==='All' ? T.purple : T.textMuted
              }}>{myEvents.length}</span>
            </button>
            {teachingDays.map((day, i) => {
              const count = myEvents.filter(e => e.day === day).length
              const active = activeDay === day
              const color = DAY_COLOR[DAYS.indexOf(day)]
              return (
                <button key={day} onClick={() => setActiveDay(active ? 'All' : day)} style={{
                  padding:'7px 16px', borderRadius:99, fontSize:12.5, fontWeight:600,
                  cursor:'pointer', border:'1.5px solid', fontFamily:"'Poppins',sans-serif",
                  background: active ? color + '18' : 'transparent',
                  borderColor: active ? color + '60' : T.border,
                  color: active ? color : T.textMuted,
                  transition:'all 0.15s'
                }}>
                  {day}
                  <span style={{
                    marginLeft:7, fontSize:10.5, fontWeight:700, padding:'2px 7px',
                    borderRadius:99, background: active ? T.bg : T.bgAlt,
                    color: active ? color : T.textMuted
                  }}>{count}</span>
                </button>
              )
            })}
          </div>

          {/* Events */}
          {viewMode === 'list' ? (
            <div style={{ display:'flex', flexDirection:'column', gap:10 }}>
              {displayedEvents.map((e, i) => (
                <ListCard key={e.schedule_id ?? `${e.courseCode}-${e.day}-${e.period}-${i}`} event={e} index={i} conflictMap={conflictMap}/>
              ))}
            </div>
          ) : (
            <div style={{ display:'grid', gridTemplateColumns:'repeat(auto-fill, minmax(280px, 1fr))', gap:14 }}>
              {displayedEvents.map((e, i) => (
                <GridCard key={e.schedule_id ?? `${e.courseCode}-${e.day}-${e.period}-${i}`} event={e} index={i} conflictMap={conflictMap}/>
              ))}
            </div>
          )}
        </>
      )}

      {!loading && myEvents.length === 0 && scheduleNames.length > 0 && (
        <div style={{ background:T.bg, borderRadius:16, padding:'56px 32px', border:`2px dashed ${T.border}`, display:'flex', flexDirection:'column', alignItems:'center', gap:14, textAlign:'center' }}>
          <div style={{ width:56, height:56, borderRadius:16, background:T.bgAlt, display:'flex', alignItems:'center', justifyContent:'center' }}>
            <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke={T.textMuted} strokeWidth="2"><circle cx="12" cy="12" r="10"/><line x1="12" y1="8" x2="12" y2="12"/><line x1="12" y1="16" x2="12.01" y2="16"/></svg>
          </div>
          <div>
            <p style={{ fontSize:16, fontWeight:700, color:T.textMain, margin:'0 0 6px' }}>No classes assigned</p>
            <p style={{ fontSize:13, color:T.textMuted, maxWidth:340, lineHeight:1.6, margin:0 }}>You have no teaching assignments in <strong style={{color:T.textMain}}>{selectedSchedule}</strong>.</p>
          </div>
        </div>
      )}
    </div>
  )
}