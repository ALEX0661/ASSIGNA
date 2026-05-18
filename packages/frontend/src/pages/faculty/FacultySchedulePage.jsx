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

const DAYS      = ['Monday','Tuesday','Wednesday','Thursday','Friday','Saturday','Sunday']
const DAY_SHORT = { Monday:'Mon', Tuesday:'Tue', Wednesday:'Wed', Thursday:'Thu', Friday:'Fri', Saturday:'Sat', Sunday:'Sun' }
const DAY_ABBR  = { Monday:'MO', Tuesday:'TU', Wednesday:'WE', Thursday:'TH', Friday:'FR', Saturday:'SA', Sunday:'SU' }
const DAY_COLOR = ['#7C6FCD','#6B8DD6','#5B9FCA','#4AACB5','#48BFA3','#6BC78A','#8DD47A']

// ─── Helpers ──────────────────────────────────────────────────────────────────
function inferSemester(name = '') {
  const n = name.toLowerCase()
  if (n.includes('summer')) return 'Summer'
  if (n.includes('2nd') || n.includes('second')) return '2nd Semester'
  return '1st Semester'
}

/** Parse "7:30 AM", "13:00", "1:30 PM" → total minutes from midnight */
function parseTimeToMinutes(str = '') {
  const m = str.trim().match(/^(\d{1,2}):(\d{2})(?:\s*(AM|PM))?$/i)
  if (!m) return 9999
  let h = parseInt(m[1], 10)
  const min = parseInt(m[2], 10)
  const ampm = (m[3] || '').toUpperCase()
  if (ampm === 'PM' && h !== 12) h += 12
  if (ampm === 'AM' && h === 12) h = 0
  return h * 60 + min
}

/** Extract the start time from a period string like "7:30 AM - 9:00 AM" */
function periodStartMinutes(period = '') {
  const start = period.split(/\s*[–—\-]\s*/)[0] || ''
  return parseTimeToMinutes(start)
}

/** Format a period string more compactly: "7:30 AM - 9:00 AM" → ["7:30","9:00 AM"] */
function formatPeriodCompact(period = '') {
  const parts = period.split(/\s*[–—\-]\s*/)
  if (parts.length < 2) return [period.trim()]
  const start = parts[0].trim()
  const end   = parts[1].trim()
  // Drop AM from start if both share the same meridiem
  const startAmpm = start.match(/(AM|PM)$/i)?.[1]?.toUpperCase()
  const endAmpm   = end.match(/(AM|PM)$/i)?.[1]?.toUpperCase()
  const compactStart = (startAmpm && startAmpm === endAmpm)
    ? start.replace(/\s*(AM|PM)$/i, '')
    : start
  return [compactStart.trim(), end.trim()]
}

function getAvatarColor(name = '') {
  const palette = [
    { bg:'#EDE9FE', fg:'#7C3AED' }, { bg:'#DBEAFE', fg:'#2563EB' },
    { bg:'#FCE7F3', fg:'#DB2777' }, { bg:'#D1FAE5', fg:'#059669' },
    { bg:'#FEF3C7', fg:'#D97706' }, { bg:'#FFE4E6', fg:'#E11D48' },
  ]
  const code = name.split('').reduce((a,c) => a + c.charCodeAt(0), 0)
  return palette[code % palette.length]
}

function getInitials(name = '') {
  const parts = name.trim().split(/\s+/)
  if (parts.length >= 2) return (parts[0][0] + parts[parts.length-1][0]).toUpperCase()
  return name.slice(0,2).toUpperCase() || '?'
}

// ─── Badge ────────────────────────────────────────────────────────────────────
function Badge({ children, type = 'default' }) {
  const styles = {
    lec:     { bg:'#EFF6FF', color:'#2563EB', border:'#BFDBFE' },
    lab:     { bg:'#FFF7ED', color:'#D97706', border:'#FDE68A' },
    room:    { bg:T.purpleSoft, color:T.purpleDeep, border:T.purpleBorder },
    merged:  { bg:'#ECFDF5', color:'#059669', border:'#A7F3D0' },
    conflict:{ bg:'#FEF2F2', color:'#B91C1C', border:'#FECACA' },
    default: { bg:T.bgAlt, color:T.textMid, border:T.border },
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

// ─── Stat Tile ────────────────────────────────────────────────────────────────
function StatTile({ label, value, isText, color, icon, delay=0 }) {
  return (
    <div style={{
      background:T.bg, borderRadius:14, border:`1px solid ${T.border}`,
      padding:'16px 18px', display:'flex', flexDirection:'column', gap:10,
      animation:`fadeUp 0.3s ease ${delay}s both`,
      boxShadow:'0 1px 6px rgba(124,111,205,0.05)'
    }}>
      <div style={{
        width:34, height:34, borderRadius:9,
        background:`${color}18`, border:`1px solid ${color}25`,
        display:'flex', alignItems:'center', justifyContent:'center', color
      }}>{icon}</div>
      <div>
        <div style={{ fontSize:9.5, fontWeight:700, color:T.textMuted, textTransform:'uppercase', letterSpacing:'.8px', marginBottom:4 }}>{label}</div>
        <div style={{
          fontSize: isText ? 14 : 26, fontWeight:800, color, lineHeight:1.1,
          overflow:'hidden', textOverflow:'ellipsis', whiteSpace:'nowrap'
        }}>{value}</div>
      </div>
    </div>
  )
}

// ─── List View Card ───────────────────────────────────────────────────────────
function ListCard({ event, index, conflictMap }) {
  const [hovered, setHovered] = useState(false)
  const isMerged    = isMergedEvent?.(event) ?? false
  const hasConflict = conflictMap?.has(event.schedule_id)
  const dayIdx      = DAYS.indexOf(event.day)
  const accentColor = DAY_COLOR[dayIdx] || T.purple
  const timeParts   = formatPeriodCompact(event.period || '')

  return (
    <div
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => setHovered(false)}
      style={{
        background: hovered ? T.bgAlt : T.bg,
        borderRadius: 12, padding: '0',
        border: `1px solid ${hovered ? T.purpleBorder : T.border}`,
        display: 'flex', alignItems: 'stretch',
        transition: 'all 0.16s ease',
        boxShadow: hovered ? `0 6px 20px rgba(124,111,205,0.11)` : '0 1px 3px rgba(124,111,205,0.04)',
        transform: hovered ? 'translateY(-1px)' : 'none',
        animation: `fadeUp 0.24s ease ${index * 0.035}s both`,
        cursor: 'default', overflow: 'hidden'
      }}
    >
      {/* ── Left: narrow time column ── */}
      <div style={{
        width: 76, flexShrink: 0,
        background: `${accentColor}0D`,
        borderRight: `1px solid ${accentColor}1A`,
        display: 'flex', flexDirection: 'column',
        alignItems: 'center', justifyContent: 'center',
        padding: '10px 6px', gap: 3,
      }}>
        {/* Day abbreviation */}
        <span style={{
          fontSize: 9, fontWeight: 800, letterSpacing: '1.2px',
          color: accentColor, textTransform: 'uppercase', lineHeight: 1
        }}>
          {DAY_ABBR[event.day] || event.day?.slice(0, 2)?.toUpperCase()}
        </span>

        {/* Hairline */}
        <div style={{ width: 22, height: 1, background: `${accentColor}35`, margin: '1px 0' }} />

        {/* Time range — compact stacked */}
        <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 1 }}>
          {timeParts.map((t, ti) => (
            <span key={ti} style={{
              fontFamily: 'monospace', fontSize: ti === 0 ? 11 : 10,
              fontWeight: ti === 0 ? 700 : 500,
              color: ti === 0 ? T.textMain : T.textMuted,
              lineHeight: 1.3, whiteSpace: 'nowrap'
            }}>{t}</span>
          ))}
        </div>
      </div>

      {/* ── Right: content ── */}
      <div style={{ flex: 1, minWidth: 0, display: 'flex', alignItems: 'center', gap: 12, padding: '10px 14px' }}>
        <div style={{ flex: 1, minWidth: 0 }}>
          {/* Course code + title on one line */}
          <div style={{ display: 'flex', alignItems: 'baseline', gap: 7, marginBottom: 5, minWidth: 0 }}>
            <span style={{ fontSize: 14, fontWeight: 800, color: T.purpleDeep, flexShrink: 0 }}>{event.courseCode}</span>
            <span style={{
              fontSize: 12.5, fontWeight: 500, color: T.textMid,
              overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap'
            }}>{event.title}</span>
          </div>

          {/* Badges row */}
          <div style={{ display: 'flex', gap: 5, flexWrap: 'wrap', alignItems: 'center' }}>
            <Badge type={event.session?.toLowerCase().includes('lab') ? 'lab' : 'lec'}>
              {event.session === 'Lecture'
                ? <svg width="9" height="9" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"><path d="M4 19.5A2.5 2.5 0 0 1 6.5 17H20"/><path d="M6.5 2H20v20H6.5A2.5 2.5 0 0 1 4 19.5v-15A2.5 2.5 0 0 1 6.5 2z"/></svg>
                : <svg width="9" height="9" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"><path d="M9 3H5a2 2 0 0 0-2 2v4m6-6h10a2 2 0 0 1 2 2v4M9 3v18m0 0h10a2 2 0 0 0 2-2V9M9 21H5a2 2 0 0 1-2-2V9m0 0h18"/></svg>
              }
              {event.session}
            </Badge>
            {(event.program || event.year || event.block) && (
              <Badge>{[event.program, event.year && `Y${event.year}`, event.block].filter(Boolean).join(' ')}</Badge>
            )}
            {event.room && (
              <Badge type="room">
                <svg width="9" height="9" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"><path d="M3 9l9-7 9 7v11a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z"/><polyline points="9 22 9 12 15 12 15 22"/></svg>
                {event.room}
              </Badge>
            )}
            {isMerged && <Badge type="merged">Merged</Badge>}
            {hasConflict && <Badge type="conflict">Conflict</Badge>}
          </div>
        </div>

        {/* Units chip — compact */}
        {event.units != null && (
          <div style={{ flexShrink: 0, textAlign: 'center' }}>
            <div style={{
              fontSize: 15, fontWeight: 800, color: T.purple, lineHeight: 1,
              background: T.purpleSoft, borderRadius: 8,
              padding: '6px 10px', border: `1px solid ${T.purpleBorder}`,
              minWidth: 32
            }}>{event.units}</div>
            <div style={{ fontSize: 8.5, fontWeight: 700, color: T.textMuted, textTransform: 'uppercase', letterSpacing: '.5px', marginTop: 3 }}>units</div>
          </div>
        )}
      </div>
    </div>
  )
}

// ─── Grid View Card ───────────────────────────────────────────────────────────
function GridCard({ event, index, conflictMap }) {
  const [hovered, setHovered] = useState(false)
  const isMerged    = isMergedEvent?.(event) ?? false
  const hasConflict = conflictMap?.has(event.schedule_id)
  const dayIdx      = DAYS.indexOf(event.day)
  const accentColor = DAY_COLOR[dayIdx] || T.purple

  return (
    <div
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => setHovered(false)}
      style={{
        background: T.bg,
        borderRadius: 16, padding: '0',
        border: `1px solid ${hovered ? accentColor + '50' : T.border}`,
        display:'flex', flexDirection:'column',
        transition:'all 0.18s ease',
        boxShadow: hovered ? `0 10px 32px ${accentColor}20` : '0 1px 6px rgba(124,111,205,0.05)',
        transform: hovered ? 'translateY(-3px)' : 'none',
        animation: `fadeUp 0.28s ease ${index * 0.04}s both`,
        cursor:'default', overflow:'hidden'
      }}
    >
      {/* Color header band */}
      <div style={{
        height:6,
        background:`linear-gradient(90deg, ${accentColor}, ${accentColor}80)`
      }}/>

      <div style={{ padding:'16px 18px', flex:1, display:'flex', flexDirection:'column', gap:12 }}>
        {/* Top row: day + session */}
        <div style={{ display:'flex', justifyContent:'space-between', alignItems:'center' }}>
          <div style={{
            display:'flex', alignItems:'center', gap:6,
            padding:'3px 10px', borderRadius:99,
            background:`${accentColor}14`,
            border:`1px solid ${accentColor}25`
          }}>
            <div style={{ width:6, height:6, borderRadius:'50%', background:accentColor }}/>
            <span style={{ fontSize:10.5, fontWeight:800, color:accentColor, textTransform:'uppercase', letterSpacing:'0.8px' }}>
              {DAY_SHORT[event.day] || event.day}
            </span>
          </div>
          <Badge type={event.session?.toLowerCase().includes('lab') ? 'lab' : 'lec'}>
            {event.session}
          </Badge>
        </div>

        {/* Course code + title */}
        <div>
          <div style={{ fontSize:19, fontWeight:800, color:T.purpleDeep, lineHeight:1.1, marginBottom:5 }}>{event.courseCode}</div>
          <div style={{ fontSize:12.5, color:T.textMid, fontWeight:500, lineHeight:1.4,
            display:'-webkit-box', WebkitLineClamp:2, WebkitBoxOrient:'vertical', overflow:'hidden'
          }}>{event.title}</div>
        </div>

        <div style={{ height:1, background:T.borderLight }}/>

        {/* Details grid */}
        <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr', gap:'10px 14px' }}>
          {[
            { label:'Time', value: formatPeriodCompact(event.period || '').join(' – ') || '—' },
            { label:'Room', value:event.room   || '—' },
            { label:'Class', value:[event.program, event.year && `Y${event.year}`, event.block].filter(Boolean).join(' ') || '—' },
            { label:'Units', value:event.units ?? '—', accent:true },
          ].map(({ label, value, accent }) => (
            <div key={label}>
              <div style={{ fontSize:9, fontWeight:700, color:T.textLight, textTransform:'uppercase', letterSpacing:'.6px', marginBottom:3 }}>{label}</div>
              <div style={{ fontSize:12.5, fontWeight:accent ? 800 : 600, color: accent ? T.purple : T.textMain }}>{value}</div>
            </div>
          ))}
        </div>

        {(isMerged || hasConflict) && (
          <div style={{ display:'flex', gap:6, flexWrap:'wrap' }}>
            {isMerged && <Badge type="merged">Merged Block</Badge>}
            {hasConflict && <Badge type="conflict">Conflict</Badge>}
          </div>
        )}
      </div>
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
    <div style={{ display:'flex', gap:8, alignItems:'stretch' }}>
      {DAYS.map((d, i) => {
        const count = dayCount[d]
        const intensity = count / maxCount
        const color = DAY_COLOR[i]
        return (
          <div key={d} style={{ flex:1, display:'flex', flexDirection:'column', alignItems:'center', gap:6 }}>
            <div style={{ fontSize:10, fontWeight:700, color: count > 0 ? color : T.textLight, textTransform:'uppercase', letterSpacing:'.3px' }}>
              {d.slice(0,2)}
            </div>
            <div style={{ position:'relative', flex:1, width:'100%', minHeight:40, borderRadius:10, background:T.borderLight, overflow:'hidden' }}>
              <div style={{
                position:'absolute', bottom:0, left:0, right:0,
                borderRadius:10,
                height: count > 0 ? `${Math.max(20, intensity * 100)}%` : '0%',
                background: count > 0
                  ? `linear-gradient(180deg, ${color}CC, ${color})`
                  : 'transparent',
                transition:'height 0.6s ease'
              }}/>
            </div>
            {count > 0 ? (
              <span style={{
                fontSize:11.5, fontWeight:800, color,
                background:`${color}14`, padding:'2px 8px',
                borderRadius:99, border:`1px solid ${color}25`
              }}>{count}</span>
            ) : (
              <span style={{ fontSize:11.5, color:T.borderLight, fontWeight:700 }}>—</span>
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
  const [viewMode,         setViewMode]         = useState('list')
  const [activeDay,        setActiveDay]        = useState('All')

  const [listLoading,   setListLoading]   = useState(true)
  const [eventsLoading, setEventsLoading] = useState(false)
  const [error,         setError]         = useState('')

  const semesterGroups = useMemo(() => {
    const map = { 'All': scheduleNames }
    scheduleNames.forEach(n => {
      const sem = inferSemester(n)
      if (!map[sem]) map[sem] = []
      map[sem].push(n)
    })
    return map
  }, [scheduleNames])

  const semesterOptions  = useMemo(() => ['All', ...Object.keys(semesterGroups).filter(k => k !== 'All')], [semesterGroups])
  const filteredSchedules = useMemo(() => semester === 'All' ? scheduleNames : (semesterGroups[semester] || []), [semester, scheduleNames, semesterGroups])

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

  useEffect(() => {
    if (!selectedSchedule) return
    setEventsLoading(true)
    loadSaved(selectedSchedule)
      .then(data => setEvents(data.schedule || data.events || []))
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

  const conflictMap    = useMemo(() => buildConflictMap?.(myEvents) || new Map(), [myEvents])
  const teachingDays   = useMemo(() => DAYS.filter(d => myEvents.some(e => e.day === d)), [myEvents])
  const displayedEvents = useMemo(() => {
    let arr = [...myEvents]
    if (activeDay !== 'All') arr = arr.filter(e => e.day === activeDay)
    arr.sort((a, b) => {
      const da = DAYS.indexOf(a.day), db = DAYS.indexOf(b.day)
      if (da !== db) return da - db
      // sort by actual start time in minutes, not string
      return periodStartMinutes(a.period) - periodStartMinutes(b.period)
    })
    return arr
  }, [myEvents, activeDay])

  const totalUnits  = useMemo(() => myEvents.reduce((s, e) => s + (e.units || 0), 0), [myEvents])
  const loading     = listLoading || eventsLoading
  const avatarColor = useMemo(() => getAvatarColor(facultyName), [facultyName])
  const initials    = useMemo(() => getInitials(facultyName), [facultyName])

  return (
    <div style={{ fontFamily:"'Poppins',sans-serif", color:T.textMain, minHeight:'100vh' }}>
      <style>{`
        @keyframes shimmer { 0%{background-position:200% 0} 100%{background-position:-200% 0} }
        @keyframes fadeUp  { from{opacity:0;transform:translateY(12px)} to{opacity:1;transform:translateY(0)} }
        @keyframes spin    { to{transform:rotate(360deg)} }
      `}</style>

      {/* ── Page Hero ── */}
      <div style={{
        marginBottom:28,
        background:'linear-gradient(135deg, #EDE9FB 0%, #FAFAFE 55%, #E0F2FE 100%)',
        borderRadius:18, border:`1px solid ${T.border}`,
        padding:'22px 28px', position:'relative', overflow:'hidden',
        animation:'fadeUp 0.3s ease both'
      }}>
        {/* decorative blobs */}
        <div style={{ position:'absolute', top:-40, right:40, width:160, height:160, borderRadius:'50%', background:T.purple+'08', pointerEvents:'none' }}/>
        <div style={{ position:'absolute', bottom:-30, right:-20, width:110, height:110, borderRadius:'50%', background:'#5B9FCA10', pointerEvents:'none' }}/>

        <div style={{ display:'flex', alignItems:'center', justifyContent:'space-between', gap:16, flexWrap:'wrap', position:'relative' }}>
          {/* Left: identity */}
          <div style={{ display:'flex', alignItems:'center', gap:16 }}>
            {/* Avatar */}
            <div style={{
              width:56, height:56, borderRadius:16, flexShrink:0,
              background: listLoading ? T.purpleSoft : avatarColor.bg,
              color: listLoading ? T.purple : avatarColor.fg,
              display:'flex', alignItems:'center', justifyContent:'center',
              fontSize:20, fontWeight:800, letterSpacing:'-0.5px',
              border:`3px solid ${listLoading ? T.purpleBorder : avatarColor.fg + '30'}`,
              boxShadow:`0 4px 16px ${T.purple}20`
            }}>
              {listLoading ? (
                <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2"/><circle cx="12" cy="7" r="4"/></svg>
              ) : initials}
            </div>

            <div>
              <div style={{ display:'flex', alignItems:'center', gap:8, marginBottom:4 }}>
                <span style={{ fontSize:11, fontWeight:700, color:T.purple, textTransform:'uppercase', letterSpacing:'.8px' }}>My Schedule</span>
                {facultyMeta.status && (
                  <span style={{
                    fontSize:10.5, fontWeight:700, padding:'2px 9px', borderRadius:99,
                    background: facultyMeta.status === 'full-time' ? '#ECFDF5' : T.purpleSoft,
                    color: facultyMeta.status === 'full-time' ? '#059669' : T.purpleDeep,
                    border:`1px solid ${facultyMeta.status === 'full-time' ? '#A7F3D0' : T.purpleBorder}`
                  }}>
                    {facultyMeta.status === 'full-time' ? 'Full-Time' : 'Part-Time'}
                  </span>
                )}
              </div>
              <h1 style={{ fontSize:20, fontWeight:800, color:T.textMain, margin:0, lineHeight:1.2 }}>
                {listLoading ? '…' : facultyName || 'Faculty Schedule'}
              </h1>
              {facultyMeta.rank && (
                <p style={{ fontSize:12.5, color:T.textMuted, margin:'3px 0 0', fontWeight:500 }}>
                  {facultyMeta.rank}{facultyMeta.department ? ` · ${facultyMeta.department}` : ''}
                </p>
              )}
            </div>
          </div>

          {/* Right: controls */}
          <div style={{ display:'flex', gap:10, alignItems:'center', flexWrap:'wrap' }}>
            {/* Semester filter */}
            <div style={{ position:'relative' }}>
              <select value={semester} onChange={e => { setSemester(e.target.value); setSelectedSchedule('') }}
                style={{
                  appearance:'none', padding:'9px 34px 9px 14px',
                  borderRadius:10, border:`1.5px solid ${T.purpleBorder}`,
                  fontSize:13, fontWeight:600, color:T.purpleDeep, background:T.bg,
                  cursor:'pointer', outline:'none', fontFamily:"'Poppins',sans-serif",
                  boxShadow:`0 1px 4px rgba(124,111,205,0.08)`
                }}>
                {semesterOptions.map(s => <option key={s} value={s}>{s}</option>)}
              </select>
              <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke={T.purple} strokeWidth="2.5"
                style={{ position:'absolute', right:11, top:'50%', transform:'translateY(-50%)', pointerEvents:'none' }}>
                <polyline points="6 9 12 15 18 9"/>
              </svg>
            </div>

            {/* Schedule dropdown */}
            {filteredSchedules.length > 0 && (
              <div style={{ position:'relative' }}>
                <select value={selectedSchedule} onChange={e => setSelectedSchedule(e.target.value)}
                  style={{
                    appearance:'none', padding:'9px 34px 9px 14px',
                    borderRadius:10, border:`1.5px solid ${T.border}`,
                    fontSize:13, fontWeight:500, color:T.textMid, background:T.bg,
                    cursor:'pointer', outline:'none', fontFamily:"'Poppins',sans-serif",
                    maxWidth:200, boxShadow:`0 1px 4px rgba(124,111,205,0.06)`
                  }}>
                  {filteredSchedules.map(n => <option key={n} value={n}>{n}</option>)}
                </select>
                <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke={T.textMuted} strokeWidth="2.5"
                  style={{ position:'absolute', right:11, top:'50%', transform:'translateY(-50%)', pointerEvents:'none' }}>
                  <polyline points="6 9 12 15 18 9"/>
                </svg>
              </div>
            )}

            {/* View toggle */}
            <div style={{
              display:'flex', background:T.bgAlt, border:`1.5px solid ${T.border}`,
              borderRadius:10, padding:3, gap:2, boxShadow:`0 1px 4px rgba(124,111,205,0.06)`
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
        <div style={{ display:'grid', gridTemplateColumns:'repeat(auto-fit,minmax(140px,1fr))', gap:12, marginBottom:24 }}>
          <StatTile
            label="Total Classes" value={myEvents.length} color={T.purple} delay={0}
            icon={<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><rect x="3" y="4" width="18" height="18" rx="2"/><line x1="16" y1="2" x2="16" y2="6"/><line x1="8" y1="2" x2="8" y2="6"/><line x1="3" y1="10" x2="21" y2="10"/></svg>}
          />
          <StatTile
            label="Teaching Days" value={teachingDays.length} color="#5B9FCA" delay={0.05}
            icon={<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><circle cx="12" cy="12" r="10"/><polyline points="12 6 12 12 16 14"/></svg>}
          />
          <StatTile
            label="Total Units" value={totalUnits} color="#48BFA3" delay={0.1}
            icon={<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M12 20h9"/><path d="M16.5 3.5a2.121 2.121 0 0 1 3 3L7 19l-4 1 1-4L16.5 3.5z"/></svg>}
          />
          <StatTile
            label="Schedule" value={selectedSchedule || '—'} color={T.textMid} isText delay={0.15}
            icon={<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/><polyline points="14 2 14 8 20 8"/></svg>}
          />
        </div>
      )}

      {/* ── Loading ── */}
      {loading && (
        <div style={{ display:'flex', flexDirection:'column', gap:12 }}>
          {[1,2,3].map(i => (
            <div key={i} style={{ background:T.bg, borderRadius:14, border:`1px solid ${T.border}`, display:'flex', overflow:'hidden' }}>
              <div style={{ width:96, background:T.bgAlt, padding:20 }}><Skel w="100%" h={60} r={8}/></div>
              <div style={{ flex:1, padding:20, display:'flex', flexDirection:'column', gap:10 }}>
                <Skel w="55%" h={18}/>
                <Skel w="35%" h={12}/>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* ── No Schedules ── */}
      {!loading && scheduleNames.length === 0 && (
        <div style={{
          background:T.bg, borderRadius:18, padding:'56px 32px',
          border:`2px dashed ${T.border}`,
          display:'flex', flexDirection:'column', alignItems:'center', gap:16, textAlign:'center'
        }}>
          <div style={{
            width:64, height:64, borderRadius:18,
            background:`linear-gradient(135deg, ${T.purpleSoft}, #e0f2fe)`,
            display:'flex', alignItems:'center', justifyContent:'center',
            border:`1px solid ${T.purpleBorder}`
          }}>
            <svg width="26" height="26" viewBox="0 0 24 24" fill="none" stroke={T.purple} strokeWidth="1.8"><rect x="3" y="4" width="18" height="18" rx="2" ry="2"/><line x1="16" y1="2" x2="16" y2="6"/><line x1="8" y1="2" x2="8" y2="6"/><line x1="3" y1="10" x2="21" y2="10"/></svg>
          </div>
          <div>
            <p style={{ fontSize:16, fontWeight:700, color:T.textMain, margin:'0 0 8px' }}>No schedules available</p>
            <p style={{ fontSize:13, color:T.textMuted, maxWidth:340, lineHeight:1.7, margin:0 }}>
              Once administration finalizes a schedule, your classes will appear here.
            </p>
          </div>
        </div>
      )}

      {/* ── Has Data ── */}
      {!loading && myEvents.length > 0 && (
        <>
          {/* Heatmap */}
          <div style={{
            background:T.bg, borderRadius:14, border:`1px solid ${T.border}`,
            padding:'16px 20px', marginBottom:20,
            boxShadow:'0 1px 6px rgba(124,111,205,0.05)'
          }}>
            <div style={{ display:'flex', alignItems:'center', gap:8, marginBottom:14 }}>
              <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke={T.purple} strokeWidth="2.5"><rect x="3" y="4" width="18" height="18" rx="2"/><line x1="16" y1="2" x2="16" y2="6"/><line x1="8" y1="2" x2="8" y2="6"/><line x1="3" y1="10" x2="21" y2="10"/></svg>
              <div style={{ fontSize:10.5, fontWeight:700, color:T.textMuted, textTransform:'uppercase', letterSpacing:'.7px' }}>Weekly Overview</div>
            </div>
            <WeekHeatmap myEvents={myEvents}/>
          </div>

          {/* Day filter tabs */}
          <div style={{ display:'flex', gap:8, flexWrap:'wrap', marginBottom:20 }}>
            <button onClick={() => setActiveDay('All')} style={{
              display:'flex', alignItems:'center', gap:7,
              padding:'7px 16px', borderRadius:99, fontSize:12.5, fontWeight:600,
              cursor:'pointer', border:'1.5px solid', fontFamily:"'Poppins',sans-serif",
              background: activeDay==='All' ? T.purpleSoft : 'transparent',
              borderColor: activeDay==='All' ? T.purpleBorder : T.border,
              color: activeDay==='All' ? T.purpleDeep : T.textMuted,
              transition:'all 0.15s'
            }}>
              All Days
              <span style={{
                fontSize:10, fontWeight:800, padding:'2px 7px',
                borderRadius:99, background: activeDay==='All' ? T.bg : T.bgAlt,
                color: activeDay==='All' ? T.purple : T.textMuted,
                border:`1px solid ${activeDay==='All' ? T.purpleBorder : T.border}`
              }}>{myEvents.length}</span>
            </button>

            {teachingDays.map((day) => {
              const count  = myEvents.filter(e => e.day === day).length
              const active = activeDay === day
              const color  = DAY_COLOR[DAYS.indexOf(day)]
              return (
                <button key={day} onClick={() => setActiveDay(active ? 'All' : day)} style={{
                  display:'flex', alignItems:'center', gap:7,
                  padding:'7px 16px', borderRadius:99, fontSize:12.5, fontWeight:600,
                  cursor:'pointer', border:'1.5px solid', fontFamily:"'Poppins',sans-serif",
                  background: active ? `${color}14` : 'transparent',
                  borderColor: active ? `${color}50` : T.border,
                  color: active ? color : T.textMuted,
                  transition:'all 0.15s'
                }}>
                  {active && <div style={{ width:7, height:7, borderRadius:'50%', background:color }}/>}
                  {day}
                  <span style={{
                    fontSize:10, fontWeight:800, padding:'2px 7px', borderRadius:99,
                    background: active ? T.bg : T.bgAlt,
                    color: active ? color : T.textMuted,
                    border:`1px solid ${active ? color + '40' : T.border}`
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

      {/* ── No assignments ── */}
      {!loading && myEvents.length === 0 && scheduleNames.length > 0 && (
        <div style={{
          background:T.bg, borderRadius:18, padding:'56px 32px',
          border:`2px dashed ${T.border}`,
          display:'flex', flexDirection:'column', alignItems:'center', gap:14, textAlign:'center'
        }}>
          <div style={{ width:60, height:60, borderRadius:16, background:T.bgAlt, border:`1px solid ${T.border}`, display:'flex', alignItems:'center', justifyContent:'center' }}>
            <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke={T.textMuted} strokeWidth="1.8"><circle cx="12" cy="12" r="10"/><line x1="12" y1="8" x2="12" y2="12"/><line x1="12" y1="16" x2="12.01" y2="16"/></svg>
          </div>
          <div>
            <p style={{ fontSize:16, fontWeight:700, color:T.textMain, margin:'0 0 8px' }}>No classes assigned</p>
            <p style={{ fontSize:13, color:T.textMuted, maxWidth:340, lineHeight:1.7, margin:0 }}>
              You have no teaching assignments in <strong style={{color:T.textMain}}>{selectedSchedule}</strong>.
            </p>
          </div>
        </div>
      )}

      {/* ── Error ── */}
      {error && (
        <div style={{ background:'#FFF0F0', border:'1px solid #FECACA', borderRadius:12, padding:'14px 18px', fontSize:13, color:'#C0392B', marginTop:16, display:'flex', gap:10, alignItems:'center' }}>
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><circle cx="12" cy="12" r="10"/><line x1="15" y1="9" x2="9" y2="15"/><line x1="9" y1="9" x2="15" y2="15"/></svg>
          {error}
        </div>
      )}
    </div>
  )
}