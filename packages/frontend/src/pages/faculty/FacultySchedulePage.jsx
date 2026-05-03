import { useEffect, useState, useMemo } from 'react'
import { useAuth } from '../../hooks/useAuth'
import { listSaved, loadSaved, getFaculty } from '../../services/api'
import { buildConflictMap, isMergedEvent, parsePeriodRange } from '../../components/ScheduleView/svHelpers'

const DAYS = ['Monday','Tuesday','Wednesday','Thursday','Friday','Saturday','Sunday']

/* ── Badge helper ── */
function Badge({ children, type }) {
  const bg = type === 'lec' ? '#EFF6FF' : type === 'lab' ? '#FFF7ED' : type === 'room' ? 'var(--emerald-pale)' : '#F8FAFC';
  const color = type === 'lec' ? '#2563EB' : type === 'lab' ? '#D97706' : type === 'room' ? 'var(--emerald-deep)' : '#475569';
  const border = type === 'lec' ? '#BFDBFE' : type === 'lab' ? '#FDE68A' : type === 'room' ? 'var(--emerald-light)' : '#E2E8F0';
  
  return (
    <span style={{
      display:'inline-flex', alignItems:'center', padding:'3px 10px', borderRadius:'8px', 
      fontSize:'11px', fontWeight:'600', letterSpacing:'0.3px', background: bg, color: color, border: `1px solid ${border}`,
      whiteSpace: 'nowrap'
    }}>
      {children}
    </span>
  )
}

/* ── Compact horizontal stats row (Matches Admin ScheduleViewPage) ── */
function StatsRow({ items }) {
  return (
    <div style={{
      display:'flex', background:'#fff', border:'1px solid var(--border)',
      borderRadius:'12px', overflow:'hidden',
      boxShadow:'var(--shadow-sm)', marginBottom:'24px'
    }}>
      {items.map((s, i) => (
        <div key={s.label} style={{
          flex:1, padding:'12px 18px', minWidth:0,
          borderRight: i < items.length - 1 ? '1px solid var(--border)' : 'none',
          display:'flex', flexDirection:'column', gap:'2px'
        }}>
          <span style={{ fontSize:9.5, fontWeight:700, color:'var(--text-muted)', textTransform:'uppercase', letterSpacing:'.8px', whiteSpace:'nowrap' }}>
            {s.label}
          </span>
          <div style={{ display:'flex', alignItems:'baseline', gap:6 }}>
            <span style={{ fontSize:22, fontWeight:800, color:s.accent || 'var(--emerald-deep)', lineHeight:1.15 }}>
              {s.value}
            </span>
            {s.sub && (
              <span style={{ fontSize:10.5, color:'var(--text-muted)', whiteSpace:'nowrap' }}>{s.sub}</span>
            )}
          </div>
        </div>
      ))}
    </div>
  )
}

/* ── Skeleton Helper ── */
function Skel({ w = '100%', h = 14, r = 7, style = {} }) {
  return <div className="fac-skeleton" style={{ width: w, height: h, borderRadius: r, flexShrink: 0, ...style }} />
}

export default function FacultySchedulePage() {
  const { user } = useAuth()

  const [scheduleNames, setScheduleNames] = useState([])
  const [selectedSchedule, setSelectedSchedule] = useState('')
  const [events,        setEvents]        = useState([])
  const [facultyName,   setFacultyName]   = useState('')
  const [facultyMeta,   setFacultyMeta]   = useState({})
  const [activeDay,     setActiveDay]     = useState(null)
  
  const [listLoading,   setListLoading]   = useState(true)
  const [eventsLoading, setEventsLoading] = useState(false)
  const [error,         setError]         = useState('')

  // 1. Load initial faculty profile & schedule list
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
              rank:       me.AcademicRank || '',
              department: me.Department   || '',
              units:      me.units        ?? 0,
              max_units:  me.max_units    ?? 21,
            })
          }
        } catch { /* fall through */ }
        setFacultyName(resolvedName)

        const names = await listSaved()
        const arr = Array.isArray(names) ? names : (names?.schedules || [])
        setScheduleNames(arr)
        
        // Auto-select latest schedule
        if (arr.length > 0) {
          setSelectedSchedule(arr[arr.length - 1])
        }
      } catch {
        setError('Could not load schedule data. Please try again later.')
      } finally {
        setListLoading(false)
      }
    }
    init()
  }, [user])

  // 2. Load events whenever selectedSchedule changes
  useEffect(() => {
    if (!selectedSchedule) return
    
    setEventsLoading(true)
    loadSaved(selectedSchedule)
      .then(data => {
        const allEvents = data.schedule || []
        setEvents(allEvents)
        
        // Auto-select the first day the faculty actually has a class
        const myDays = DAYS.filter(d =>
          allEvents.some(e =>
            ((facultyName && e.faculty === facultyName) || (user?.email && e.faculty === user.email)) && e.day === d
          )
        )
        if (myDays.length > 0) setActiveDay(myDays[0])
        else setActiveDay(null)
      })
      .catch(() => setError(`Could not load "${selectedSchedule}".`))
      .finally(() => setEventsLoading(false))
  }, [selectedSchedule, facultyName, user])

  const myEvents = useMemo(() => {
    if (!facultyName && !user?.email) return []
    return events.filter(e =>
      (facultyName && e.faculty === facultyName) || (user?.email && e.faculty === user.email)
    )
  }, [events, facultyName, user])

  const teachingDays = useMemo(() => DAYS.filter(d => myEvents.some(e => e.day === d)), [myEvents])
  const dayEvents = useMemo(() => myEvents.filter(e => e.day === activeDay).sort((a, b) => (parsePeriodRange(a.period)?.start ?? 9999) - (parsePeriodRange(b.period)?.start ?? 9999)), [myEvents, activeDay])
  const totalRooms = useMemo(() => [...new Set(myEvents.map(e => e.room))].length, [myEvents])
  
  // Calculate conflicts just for the logged in faculty's events to display warning tags
  const conflictMap = useMemo(() => buildConflictMap(myEvents.filter(e => e.day === activeDay)), [myEvents, activeDay])

  const loading = listLoading || eventsLoading

  const statItems = [
    { label: 'Total Sessions', value: loading ? '-' : myEvents.length, sub: 'assigned' },
    { label: 'Teaching Days',  value: loading ? '-' : teachingDays.length, sub: 'this semester' },
    { label: 'Rooms Used',     value: loading ? '-' : totalRooms, sub: 'distinct locations' },
  ]

  return (
    <div className="fac-page">
      <style>{`@keyframes facFadeUp { from{opacity:0;transform:translateY(6px)} to{opacity:1;transform:translateY(0)} }`}</style>
      
      {/* Page header area with Dropdown */}
      <div style={{ display: 'flex', flexWrap: 'wrap', alignItems: 'center', justifyContent: 'space-between', gap: 16, marginBottom: 28 }}>
        <div>
          <h1 style={{ fontSize:22, fontWeight:700, color:'#0F172A', letterSpacing:'-0.3px', marginBottom:6 }}>
            {listLoading ? <Skel w={240} h={28} /> : (facultyName || user?.displayName || 'My Schedule')}
          </h1>
          <p style={{ fontSize:13.5, color:'var(--text-muted)', display: 'flex', alignItems: 'center', gap: 6 }}>
            {listLoading ? <Skel w={300} h={16} /> : (
              <>
                {[facultyMeta.rank, facultyMeta.department].filter(Boolean).join(' · ')}
                {facultyMeta.units != null && (
                  <>
                    <span style={{ color: '#CBD5E1' }}>|</span>
                    <span style={{ color:'var(--emerald-deep)', fontWeight:600, background: 'var(--emerald-pale)', padding: '2px 8px', borderRadius: 6 }}>
                      {facultyMeta.units} / {facultyMeta.max_units} units
                    </span>
                  </>
                )}
              </>
            )}
          </p>
        </div>

        {/* Schedule Selector Dropdown */}
        {scheduleNames.length > 0 && !listLoading && (
          <div style={{ display: 'flex', alignItems: 'center', gap: 10, background: '#fff', border: '1px solid var(--border)', padding: '6px 8px 6px 14px', borderRadius: 12, boxShadow: 'var(--shadow-sm)' }}>
            <span style={{ fontSize: 11, fontWeight: 700, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.8px' }}>Semester</span>
            <select 
              value={selectedSchedule} 
              onChange={e => setSelectedSchedule(e.target.value)}
              disabled={eventsLoading}
              style={{
                padding: '6px 30px 6px 12px', borderRadius: '8px', border: '1.5px solid #D8D3F5', background: eventsLoading ? '#F8FAFC' : '#fff', color: '#0F172A', fontSize: '13px', fontWeight: '600', fontFamily: "'Poppins', sans-serif", appearance: 'none', cursor: eventsLoading ? 'default' : 'pointer', outline: 'none',
                backgroundImage: `url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='12' height='12' viewBox='0 0 24 24' fill='none' stroke='%238883B0' stroke-width='2.5'%3E%3Cpolyline points='6 9 12 15 18 9'/%3E%3C/svg%3E")`, backgroundRepeat: 'no-repeat', backgroundPosition: 'right 10px center'
              }}
            >
              {scheduleNames.map(name => <option key={name} value={name}>{name}</option>)}
            </select>
          </div>
        )}
      </div>

      {error && (
        <div style={{ background:'#FFF0F0', border:'1px solid #FECACA', borderRadius:10, padding:'12px 16px', fontSize:13, color:'#C0392B', marginBottom:24, display:'flex', alignItems:'center', gap:8 }}>
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"><circle cx="12" cy="12" r="10"/><line x1="15" y1="9" x2="9" y2="15"/><line x1="9" y1="9" x2="15" y2="15"/></svg>
          {error}
        </div>
      )}

      {/* Weekly summary Stats (Matches Admin Layout) */}
      <StatsRow items={statItems} />

      {loading && (
        <div style={{ maxWidth: 800 }}>
          <div style={{ display: 'flex', gap: 10, marginBottom: 24 }}><Skel w={100} h={36} r={10} /><Skel w={100} h={36} r={10} /><Skel w={100} h={36} r={10} /></div>
          <div style={{ display:'flex', flexDirection:'column', gap:14 }}>
            {[1,2,3].map(i => <Skel key={i} h={96} r={14} />)}
          </div>
        </div>
      )}

      {!loading && scheduleNames.length === 0 && (
        <div style={{ background: '#fff', borderRadius: 16, padding: '56px 32px', border: '2px dashed var(--border)', display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 14, maxWidth: 800 }}>
          <div style={{ width: 56, height: 56, borderRadius: '50%', background: 'var(--emerald-pale)', color: 'var(--emerald-mid)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
            <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"><rect x="3" y="4" width="18" height="18" rx="2" ry="2"/><line x1="16" y1="2" x2="16" y2="6"/><line x1="8" y1="2" x2="8" y2="6"/><line x1="3" y1="10" x2="21" y2="10"/></svg>
          </div>
          <div style={{ textAlign: 'center' }}>
            <p style={{ fontSize: 16, fontWeight: 700, color: '#0F172A', marginBottom: 6 }}>No schedules available</p>
            <p style={{ fontSize: 13, color: 'var(--text-muted)', maxWidth: 360, lineHeight: 1.6 }}>
              Once the administration finalizes and saves a schedule for the semester, your classes will appear here.
            </p>
          </div>
        </div>
      )}

      {!loading && scheduleNames.length > 0 && myEvents.length === 0 && (
        <div style={{ background: '#fff', borderRadius: 16, padding: '56px 32px', border: '2px dashed var(--border)', display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 14, maxWidth: 800 }}>
          <div style={{ width: 56, height: 56, borderRadius: '50%', background: '#F8FAFC', color: 'var(--text-muted)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
            <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"><circle cx="12" cy="12" r="10"/><line x1="12" y1="8" x2="12" y2="12"/><line x1="12" y1="16" x2="12.01" y2="16"/></svg>
          </div>
          <div style={{ textAlign: 'center' }}>
            <p style={{ fontSize: 16, fontWeight: 700, color: '#0F172A', marginBottom: 6 }}>No classes assigned</p>
            <p style={{ fontSize: 13, color: 'var(--text-muted)', maxWidth: 360, lineHeight: 1.6 }}>
              You do not have any teaching assignments in <strong style={{color:'#0F172A'}}>{selectedSchedule}</strong>.
            </p>
          </div>
        </div>
      )}

      {!loading && myEvents.length > 0 && (
        <div style={{ maxWidth: 800 }}>
          {/* Week-at-a-glance bar */}
          <div style={{ display:'flex', gap:6, marginBottom:24, background: '#fff', padding: '12px 16px', borderRadius: 12, border: '1px solid var(--border)', boxShadow:'var(--shadow-sm)' }}>
            {DAYS.map(d => (
              <div key={d} style={{ flex:1, textAlign:'center' }}>
                <div style={{ fontSize:11, color: teachingDays.includes(d) ? 'var(--emerald-deep)' : '#CBD5E1', fontWeight:700, marginBottom:8, textTransform:'uppercase', letterSpacing:'0.05em' }}>
                  {d.slice(0,3)}
                </div>
                <div style={{ height:5, borderRadius:99, background: teachingDays.includes(d) ? 'var(--emerald-mid)' : '#E2E8F0', boxShadow: teachingDays.includes(d) ? '0 0 6px rgba(16,185,129,0.4)' : 'none', transition: 'background 0.2s' }} />
              </div>
            ))}
          </div>

          {/* Day tabs */}
          <div style={{ display:'flex', gap:10, flexWrap:'wrap', marginBottom:24 }}>
            {teachingDays.map(day => {
              const cnt = myEvents.filter(e => e.day === day).length
              const active = activeDay === day;
              return (
                <button key={day} onClick={() => setActiveDay(day)} 
                  style={{
                    padding: '8px 16px', borderRadius: '10px', fontSize: '12.5px', fontWeight: '600', cursor: 'pointer', fontFamily: "'Poppins', sans-serif", transition: 'all 0.15s', display: 'flex', alignItems: 'center', gap: '8px',
                    background: active ? 'var(--emerald-pale)' : '#fff', color: active ? 'var(--emerald-deep)' : 'var(--text-muted)', border: active ? '1.5px solid var(--emerald-light)' : '1.5px solid var(--border)'
                  }}>
                  {day} 
                  <span style={{
                    fontSize:'10.5px', fontWeight:700, padding:'2px 8px', borderRadius:99,
                    background: active ? '#fff' : '#F1F5F9', color: active ? 'var(--emerald-deep)' : '#64748B', boxShadow: active ? '0 1px 3px rgba(16,185,129,0.15)' : 'none'
                  }}>{cnt}</span>
                </button>
              )
            })}
          </div>

          {/* Session cards */}
          <div style={{ display:'flex', flexDirection:'column', gap:12 }}>
            {dayEvents.length === 0 ? (
              <div style={{ color:'var(--text-muted)', fontSize:13.5, textAlign:'center', padding: '32px 0' }}>
                No sessions assigned on {activeDay}.
              </div>
            ) : dayEvents.map((e, i) => {
              const evId = e.schedule_id ?? `${e.courseCode}-${e.block}-${e.session}-${e.day}`
              const isMerged = isMergedEvent(e)
              const hasConflict = conflictMap.has(evId)
              const conflictData = conflictMap.get(evId)

              return (
                <div key={i} style={{
                  background:'#fff', borderRadius:14, padding:'18px 22px', boxShadow:'var(--shadow-sm)', border:'1px solid var(--border)',
                  display: 'flex', alignItems: 'stretch', gap: 18, borderLeft: '4px solid var(--emerald-mid)',
                  transition: 'transform 0.15s, box-shadow 0.15s', animation: `facFadeUp 0.25s ease ${i * 0.05}s both`
                }}>
                  {/* Time side */}
                  <div style={{
                    display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center',
                    background:'#F8FAFC', border:'1px solid #E2E8F0', borderRadius:10, padding:'10px 14px',
                    minWidth: 105, flexShrink: 0
                  }}>
                    {e.period?.split(' – ').map((t, ti) => (
                      <div key={ti} style={{ display: 'flex', flexDirection: 'column', alignItems: 'center' }}>
                        <span style={{ fontFamily:'monospace', fontSize:12.5, fontWeight:700, color:'#334155' }}>{t}</span>
                        {ti === 0 && <span style={{ fontSize: 10, color: '#94A3B8', margin: '2px 0' }}>to</span>}
                      </div>
                    ))}
                  </div>

                  {/* Details side */}
                  <div style={{ flex:1, minWidth:0, display: 'flex', flexDirection: 'column', justifyContent: 'center' }}>
                    <p style={{ fontWeight:700, fontSize:15, color:'#1e293b', marginBottom:8, lineHeight: 1.3 }}>
                      <span style={{ color: 'var(--emerald-deep)' }}>{e.courseCode}</span> <span style={{ color: '#CBD5E1', margin: '0 4px' }}>|</span> {e.title}
                    </p>
                    
                    <div style={{ display:'flex', flexWrap:'wrap', gap:8, alignItems:'center' }}>
                      <Badge type={e.session === 'Lecture' ? 'lec' : 'lab'}>
                        {e.session === 'Lecture' ? <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" style={{marginRight:4}}><path d="M4 19.5A2.5 2.5 0 0 1 6.5 17H20"/><path d="M6.5 2H20v20H6.5A2.5 2.5 0 0 1 4 19.5v-15A2.5 2.5 0 0 1 6.5 2z"/></svg> : <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" style={{marginRight:4}}><path d="M9 3H5a2 2 0 0 0-2 2v4m6-6h10a2 2 0 0 1 2 2v4M9 3v18m0 0h10a2 2 0 0 0 2-2V9M9 21H5a2 2 0 0 1-2-2V9m0 0h18"/></svg>}
                        {e.session}
                      </Badge>
                      <Badge type="prog">{e.program} {e.year}-{e.block}</Badge>
                      <Badge type="room">
                        <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" style={{marginRight:4}}><path d="M21 10c0 7-9 13-9 13s-9-6-9-13a9 9 0 0 1 18 0z"/><circle cx="12" cy="10" r="3"/></svg>
                        {e.room}
                      </Badge>

                      {/* Merged / Conflict Tags */}
                      {isMerged && (
                        <span style={{ display: 'inline-flex', alignItems: 'center', gap: 4, fontSize:9.5, fontWeight:700, background:'var(--emerald-pale)', color:'var(--emerald-deep)', border:'1px solid var(--emerald-light)', borderRadius:6, padding:'3px 8px' }}>
                          <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><path d="M10 13a5 5 0 0 0 7.54.54l3-3a5 5 0 0 0-7.07-7.07l-1.72 1.71" /><path d="M14 11a5 5 0 0 0-7.54-.54l-3 3a5 5 0 0 0 7.07 7.07l1.71-1.71" /></svg>
                          Merged Block
                        </span>
                      )}
                      {hasConflict && (
                        <span title={conflictData.label} style={{ display: 'inline-flex', alignItems: 'center', gap: 4, fontSize:9.5, fontWeight:700, background:'#fef2f2', color:'#b91c1c', border:'1px solid #fca5a5', borderRadius:6, padding:'3px 8px' }}>
                          <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><path d="M10.29 3.86L1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z" /><line x1="12" y1="9" x2="12" y2="13" /><line x1="12" y1="17" x2="12.01" y2="17" /></svg>
                          Conflict
                        </span>
                      )}
                    </div>
                  </div>
                </div>
              )
            })}
          </div>
        </div>
      )}
    </div>
  )
}