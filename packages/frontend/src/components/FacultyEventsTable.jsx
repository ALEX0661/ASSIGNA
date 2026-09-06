import { useMemo, useState } from 'react'

const isDark = document.documentElement.getAttribute('data-mode') === 'dark';

const DAY_ORDER = ['Monday','Tuesday','Wednesday','Thursday','Friday','Saturday','Sunday']
const DAY_SHORT = { Monday:'Mon', Tuesday:'Tue', Wednesday:'Wed', Thursday:'Thu', Friday:'Fri', Saturday:'Sat', Sunday:'Sun' }

const DAY_COLORS = {
  Monday:    { bg:'var(--meadow-soft)', color: 'var(--meadow-text)', border:'var(--meadow-border)' },
  Tuesday:   { bg:'rgba(59, 130, 246, 0.1)', color:'#60A5FA', border:'rgba(59, 130, 246, 0.25)' },
  Wednesday: { bg:'rgba(217, 119, 6, 0.1)', color:'#F59E0B', border:'rgba(245, 158, 11, 0.25)' },
  Thursday:  { bg:'rgba(219, 39, 119, 0.1)', color:'#F472B6', border:'rgba(219, 39, 119, 0.25)' },
  Friday:    { bg:'color-mix(in srgb, #6D28D9 15%, transparent)', color:'#A78BFA', border:'color-mix(in srgb, #6D28D9 30%, transparent)' },
  Saturday:  { bg:'rgba(59, 130, 246, 0.1)', color:'#38BDF8', border:'rgba(59, 130, 246, 0.25)' },
  Sunday:    { bg:'rgba(217, 119, 6, 0.05)', color:'#C2410C', border:'rgba(217, 119, 6, 0.25)' },
}

const PROG_PALETTE = ['var(--meadow)','#60A5FA','#7C3AED','#C2410C','#38BDF8','#9D174D','#F59E0B','var(--meadow-mid)']
const _progMap = {}
function progColor(prog) {
  if (!prog) return 'var(--muted)'
  if (!_progMap[prog]) {
    _progMap[prog] = PROG_PALETTE[Object.keys(_progMap).length % PROG_PALETTE.length]
  }
  return _progMap[prog]
}

// ── Atoms ─────────────────────────────────────────────────────────────────────
function DayBadge({ day }) {
  const c = DAY_COLORS[day] || { bg:'var(--hover)', color: 'var(--muted)', border:'var(--border)' }
  return (
    <span style={{ display:'inline-flex', alignItems:'center', justifyContent:'center', padding:'3px 10px', borderRadius:99, fontSize:11, fontWeight:700, background:c.bg, color:c.color, border:`1px solid ${c.border}`, whiteSpace:'nowrap' }}>
      {DAY_SHORT[day] || day?.slice(0,3) || '—'}
    </span>
  )
}

function ProgramBadge({ program, year, block }) {
  if (!program && !year && !block) return <span style={{ color:'var(--border)', fontSize:12 }}>—</span>
  const color = progColor(program)
  const parts = [program, year ? `Y${year}` : null, block ? `-${block}` : null].filter(Boolean)
  return (
    <span style={{ display:'inline-flex', alignItems:'center', gap:3, padding:'3px 9px', borderRadius:6, fontSize:11.5, fontWeight:700, background:color+'18', color, border:`1px solid ${color}40`, whiteSpace:'nowrap' }}>
      {parts.join(' ')}
    </span>
  )
}

function RoomBadge({ room, session }) {
  if (!room || room === '—') return <span style={{ color:'var(--border)', fontSize:12 }}>—</span>
  const isTBA = room.trim().toUpperCase() === 'TBA'
  if (isTBA) return (
    <span style={{ display:'inline-flex', alignItems:'center', gap:4, padding:'2px 8px', borderRadius:6, background:'rgba(217, 119, 6, 0.1)', color:'#F59E0B', fontSize:11, fontWeight:600, border:'1px solid #FDE68A' }}>
      <svg width="9" height="9" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"><circle cx="12" cy="12" r="10"/><line x1="12" y1="8" x2="12" y2="12"/></svg>
      TBA
    </span>
  )
  const isLab = session?.toUpperCase().includes('LAB')
  return (
    <span style={{ display:'inline-flex', alignItems:'center', gap:4, padding:'2px 8px', borderRadius:6, background: isLab ? 'color-mix(in srgb, #6D28D9 15%, transparent)' : 'var(--bg)', color: isLab ? '#A78BFA' : 'var(--ink2)', fontSize:11.5, fontWeight:500, border: isLab ? '1px solid color-mix(in srgb, #6D28D9 30%, transparent)' : '1px solid var(--border)' }}>
      {room}
    </span>
  )
}

// Multi-select pill — active when value is in selectedSet
function Pill({ label, value, selectedSet, onToggle, color }) {
  const active = selectedSet.size > 0 && selectedSet.has(value)
  const c = color || 'var(--meadow)'
  return (
    <button type="button" onClick={() => onToggle(value)} style={{
      padding:'4px 11px', borderRadius:99, fontSize:11.5,
      fontWeight: active ? 700 : 500,
      background: active ? c : 'var(--surface)',
      color: active ? '#fff' : 'var(--muted)',
      border: `1.5px solid ${active ? 'transparent' : 'var(--border)'}`,
      cursor:'pointer', transition:'all .12s', whiteSpace:'nowrap',
      boxShadow: active ? `0 2px 6px ${c}44` : 'none',
    }}>{label}</button>
  )
}

function SortIcon({ active, dir }) {
  if (!active) return <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" style={{ opacity:.25 }}><line x1="12" y1="5" x2="12" y2="19"/><polyline points="19 12 12 19 5 12"/></svg>
  return dir === 'asc'
    ? <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="var(--meadow)" strokeWidth="2.5"><line x1="12" y1="19" x2="12" y2="5"/><polyline points="5 12 12 5 19 12"/></svg>
    : <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="var(--meadow)" strokeWidth="2.5"><line x1="12" y1="5" x2="12" y2="19"/><polyline points="19 12 12 19 5 12"/></svg>
}

// helper – toggle a value in/out of a Set, returning new Set
function toggleSet(prev, val) {
  const next = new Set(prev)
  next.has(val) ? next.delete(val) : next.add(val)
  return next
}

// ── Main ──────────────────────────────────────────────────────────────────────
export default function FacultyEventsTable({ events, computeUnits, fetchError }) {
  const [search,    setSearch]    = useState('')
  const [days,      setDays]      = useState(new Set())   // multi-select
  const [progs,     setProgs]     = useState(new Set())   // multi-select
  const [years,     setYears]     = useState(new Set())   // multi-select
  const [roomTypes, setRoomTypes] = useState(new Set())   // multi-select
  const [sortKey,   setSortKey]   = useState('day')
  const [sortDir,   setSortDir]   = useState('asc')

  // ── Available filter options ───────────────────────────────────────────────
  const opts = useMemo(() => {
    const d = new Set(), p = new Set(), y = new Set()
    let hasLab = false, hasLec = false, hasTBA = false
    ;(events||[]).forEach(e => {
      if (e.day)     d.add(e.day)
      if (e.program) p.add(e.program)
      if (e.year)    y.add(String(e.year))
      const r = (e.room||'').trim()
      const isLab = e.session?.toUpperCase().includes('LAB')
      if (!r || r.toUpperCase()==='TBA') hasTBA = true
      else if (isLab)                    hasLab = true
      else                               hasLec = true
    })
    return {
      days:      DAY_ORDER.filter(dd => d.has(dd)),
      programs:  [...p].sort(),
      years:     ['1','2','3','4'].filter(yy => y.has(yy)),
      roomTypes: [...(hasLec?['Lecture']:[]), ...(hasLab?['Lab']:[]), ...(hasTBA?['TBA']:[])],
    }
  }, [events])

  // ── Filtered + sorted list ─────────────────────────────────────────────────
  const filtered = useMemo(() => {
    let list = [...(events||[])]
    const q = search.trim().toLowerCase()

    if (q) list = list.filter(e => {
      const code  = (e.courseCode||e.course_code||e.subject||e.course||'').toLowerCase()
      const title = (e.courseTitle||e.title||e.course_title||'').toLowerCase()
      const room  = (e.room||'').toLowerCase()
      const prog  = (e.program||'').toLowerCase()
      return code.includes(q) || title.includes(q) || room.includes(q) || prog.includes(q)
    })

    if (days.size)      list = list.filter(e => days.has(e.day||''))
    if (progs.size)     list = list.filter(e => progs.has(e.program||''))
    if (years.size)     list = list.filter(e => years.has(String(e.year||'')))
    if (roomTypes.size) list = list.filter(e => {
      const r = (e.room||'').trim()
      const isLab = e.session?.toUpperCase().includes('LAB')
      if (roomTypes.has('TBA')     && r.toUpperCase()==='TBA')      return true
      if (roomTypes.has('Lab')     && isLab && r.toUpperCase()!=='TBA') return true
      if (roomTypes.has('Lecture') && !isLab && r.toUpperCase()!=='TBA') return true
      return false
    })

    list.sort((a, b) => {
      let cmp = 0
      if (sortKey === 'day') {
        const dA = DAY_ORDER.indexOf(a.day||''), dB = DAY_ORDER.indexOf(b.day||'')
        cmp = (dA<0?99:dA)-(dB<0?99:dB)
        if (cmp===0) cmp = (a.timeSlot||a.time||a.period||'').localeCompare(b.timeSlot||b.time||b.period||'')
      } else if (sortKey === 'time') {
        cmp = (a.timeSlot||a.time||a.period||'').localeCompare(b.timeSlot||b.time||b.period||'')
      } else if (sortKey === 'course') {
        cmp = (a.courseCode||a.course||'').toLowerCase().localeCompare((b.courseCode||b.course||'').toLowerCase())
      } else if (sortKey === 'program') {
        cmp = (a.program||'').localeCompare(b.program||'')
        if (cmp===0) cmp = Number(a.year||0)-Number(b.year||0)
      } else if (sortKey === 'room') {
        cmp = (a.room||'').localeCompare(b.room||'')
      } else if (sortKey === 'units') {
        const ua = typeof computeUnits==='function' ? computeUnits(a) : (a.units??0)
        const ub = typeof computeUnits==='function' ? computeUnits(b) : (b.units??0)
        cmp = ua - ub
      }
      return sortDir==='asc' ? cmp : -cmp
    })
    return list
  }, [events, search, days, progs, years, roomTypes, sortKey, sortDir])

  function toggleSort(key) {
    if (sortKey===key) setSortDir(d => d==='asc'?'desc':'asc')
    else { setSortKey(key); setSortDir('asc') }
  }

  const hasFilters = search || days.size || progs.size || years.size || roomTypes.size
  function clearAll() { setSearch(''); setDays(new Set()); setProgs(new Set()); setYears(new Set()); setRoomTypes(new Set()) }

  if (fetchError) return (
    <div style={{ padding:'40px 20px', textAlign:'center', color: 'var(--muted)', fontFamily:"'Inter',sans-serif" }}>
      <svg width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="var(--border)" strokeWidth="1.5" style={{ display:'block', margin:'0 auto 10px' }}><circle cx="12" cy="12" r="10"/><line x1="12" y1="8" x2="12" y2="12"/><line x1="12" y1="16" x2="12.01" y2="16"/></svg>
      <span style={{ fontSize:13, fontWeight:500 }}>Failed to load schedule data.</span>
    </div>
  )
  if (!events?.length) return null

  const showDayFilter  = opts.days.length > 1
  const showProgFilter = opts.programs.length > 0
  const showYearFilter = opts.years.length > 1
  const showRoomFilter = opts.roomTypes.length > 1
  const showFilters    = showDayFilter || showProgFilter || showYearFilter || showRoomFilter

  return (
    <div style={{ fontFamily:"'Inter',sans-serif" }}>

      {/* ── Filter Bar ─────────────────────────────────────────────────────── */}
      <div style={{ padding:'12px 20px', borderBottom:'1px solid var(--hover)', background:'var(--bg)', display:'flex', flexDirection:'column', gap:10 }}>

        {/* Search row */}
        <div style={{ display:'flex', gap:10, alignItems:'center', flexWrap:'wrap' }}>
          <div style={{ position:'relative', flex:'1 1 200px', minWidth:160 }}>
            <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="var(--muted2)" strokeWidth="2" style={{ position:'absolute', left:10, top:'50%', transform:'translateY(-50%)', pointerEvents:'none' }}><circle cx="11" cy="11" r="8"/><line x1="21" y1="21" x2="16.65" y2="16.65"/></svg>
            <input
              type="text" value={search} onChange={e => setSearch(e.target.value)}
              placeholder="Search code, title, room, program…"
              style={{ width:'100%', paddingLeft:30, paddingRight:search?28:10, paddingTop:7, paddingBottom:7, borderRadius:8, border:'1.5px solid var(--border)', fontSize:12.5, fontFamily:"'Inter',sans-serif", outline:'none', boxSizing:'border-box', background: 'var(--surface)', color: 'var(--ink)', transition:'border-color .15s' }}
              onFocus={e => e.target.style.borderColor='var(--meadow)'}
              onBlur={e => e.target.style.borderColor='var(--border)'}
            />
            {search && (
              <button type="button" onClick={() => setSearch('')} style={{ position:'absolute', right:8, top:'50%', transform:'translateY(-50%)', background:'none', border:'none', cursor:'pointer', padding:2, color: 'var(--muted2)', display:'flex' }}>
                <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg>
              </button>
            )}
          </div>
          {hasFilters && (
            <button type="button" onClick={clearAll} style={{ padding:'5px 12px', borderRadius:99, fontSize:11.5, fontWeight:600, background:'rgba(220, 38, 38, 0.05)', color:'#EF4444', border:'1.5px solid #FECACA', cursor:'pointer', whiteSpace:'nowrap', flexShrink:0 }}>
              Clear all
            </button>
          )}
          <span style={{ fontSize:11.5, color: 'var(--muted2)', marginLeft:'auto', whiteSpace:'nowrap', flexShrink:0 }}>
            <strong style={{ color: 'var(--ink)' }}>{filtered.length}</strong>/{events.length} classes
          </span>
        </div>

        {/* Filter pills row */}
        {showFilters && (
          <div style={{ display:'flex', gap:10, flexWrap:'wrap', alignItems:'flex-start' }}>

            {/* Day */}
            {showDayFilter && (
              <div style={{ display:'flex', gap:4, alignItems:'center', flexWrap:'wrap' }}>
                <span style={{ fontSize:10, fontWeight:700, color: 'var(--muted2)', textTransform:'uppercase', letterSpacing:'.6px', flexShrink:0 }}>Day</span>
                {opts.days.map(d => (
                  <Pill key={d} value={d} label={DAY_SHORT[d]||d} selectedSet={days} onToggle={v => setDays(s => toggleSet(s,v))} />
                ))}
              </div>
            )}

            {showDayFilter && (showProgFilter||showYearFilter||showRoomFilter) && (
              <div style={{ width:1, height:24, background:'var(--border)', alignSelf:'center', flexShrink:0 }}/>
            )}

            {/* Program */}
            {showProgFilter && (
              <div style={{ display:'flex', gap:4, alignItems:'center', flexWrap:'wrap' }}>
                <span style={{ fontSize:10, fontWeight:700, color: 'var(--muted2)', textTransform:'uppercase', letterSpacing:'.6px', flexShrink:0 }}>Program</span>
                {opts.programs.map(p => (
                  <Pill key={p} value={p} label={p} selectedSet={progs} onToggle={v => setProgs(s => toggleSet(s,v))} color={progColor(p)} />
                ))}
              </div>
            )}

            {showProgFilter && (showYearFilter||showRoomFilter) && (
              <div style={{ width:1, height:24, background:'var(--border)', alignSelf:'center', flexShrink:0 }}/>
            )}

            {/* Year */}
            {showYearFilter && (
              <div style={{ display:'flex', gap:4, alignItems:'center', flexWrap:'wrap' }}>
                <span style={{ fontSize:10, fontWeight:700, color: 'var(--muted2)', textTransform:'uppercase', letterSpacing:'.6px', flexShrink:0 }}>Year</span>
                {opts.years.map(y => (
                  <Pill key={y} value={y} label={`Y${y}`} selectedSet={years} onToggle={v => setYears(s => toggleSet(s,v))} />
                ))}
              </div>
            )}

            {showYearFilter && showRoomFilter && (
              <div style={{ width:1, height:24, background:'var(--border)', alignSelf:'center', flexShrink:0 }}/>
            )}

            {/* Room type */}
            {showRoomFilter && (
              <div style={{ display:'flex', gap:4, alignItems:'center', flexWrap:'wrap' }}>
                <span style={{ fontSize:10, fontWeight:700, color: 'var(--muted2)', textTransform:'uppercase', letterSpacing:'.6px', flexShrink:0 }}>Room</span>
                {opts.roomTypes.map(r => (
                  <Pill key={r} value={r} label={r} selectedSet={roomTypes} onToggle={v => setRoomTypes(s => toggleSet(s,v))}
                    color={r==='Lab'?'#A78BFA':r==='TBA'?'#F59E0B':('var(--meadow-text-hover)')} />
                ))}
              </div>
            )}
          </div>
        )}
      </div>

      {/* ── Table ─────────────────────────────────────────────────────────── */}
      {filtered.length === 0 ? (
        <div style={{ padding:'44px 20px', textAlign:'center', color: 'var(--muted)' }}>
          <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="var(--border)" strokeWidth="1.5" style={{ display:'block', margin:'0 auto 8px' }}><circle cx="11" cy="11" r="8"/><line x1="21" y1="21" x2="16.65" y2="16.65"/></svg>
          <div style={{ fontSize:13, fontWeight:600, color: 'var(--ink2)' }}>No matching classes</div>
          <div style={{ fontSize:12, color: 'var(--muted2)', marginTop:4 }}>Try adjusting your filters</div>
          <button type="button" onClick={clearAll} style={{ marginTop:12, padding:'6px 16px', borderRadius:99, fontSize:12, fontWeight:600, background:'var(--meadow-soft)', color: 'var(--meadow-text)', border:'1px solid var(--meadow-border)', cursor:'pointer' }}>
            Clear filters
          </button>
        </div>
      ) : (
        <div style={{ overflowX:'auto' }}>
          <table style={{ width:'100%', borderCollapse:'collapse', fontSize:12.5 }}>
            <thead>
              <tr style={{ background: 'var(--bg)', borderBottom:'1.5px solid var(--border)' }}>
                {[
                  { key:'day',     label:'Day'            },
                  { key:'time',    label:'Time'           },
                  { key:'course',  label:'Course'         },
                  { key:'program', label:'Program / Year' },
                  { key:'room',    label:'Room'           },
                  { key:'units',   label:'Units'          },
                ].map(col => (
                  <th key={col.key} onClick={() => toggleSort(col.key)}
                    style={{ padding:'10px 14px', textAlign:'left', fontSize:11, fontWeight:700, color: sortKey===col.key? ('var(--meadow-text-hover)') : 'var(--muted)', textTransform:'uppercase', letterSpacing:'0.6px', whiteSpace:'nowrap', cursor:'pointer', userSelect:'none', transition:'color .15s' }}>
                    <span style={{ display:'inline-flex', alignItems:'center', gap:4 }}>
                      {col.label}
                      <SortIcon active={sortKey===col.key} dir={sortDir} />
                    </span>
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {filtered.map((ev, i) => {
                const code   = ev.courseCode || ev.course_code || ev.subject || ev.course || '—'
                const title  = ev.courseTitle || ev.title || ev.course_title || ''
                const room   = ev.room || '—'
                const time   = ev.timeSlot || ev.time || ev.period || '—'
                const units  = computeUnits ? computeUnits(ev) : (ev.units ?? '—')
                const isLast = i === filtered.length - 1

                return (
                  <tr key={i}
                    style={{ borderBottom: isLast ? 'none' : '1px solid var(--hover)', background: i%2===0? 'var(--surface)':'var(--bg)', transition:'background .1s' }}
                    onMouseEnter={e => { e.currentTarget.style.background='var(--meadow-soft)' }}
                    onMouseLeave={e => { e.currentTarget.style.background=i%2===0? 'var(--surface)':'var(--bg)' }}
                  >
                    <td style={{ padding:'11px 14px', whiteSpace:'nowrap' }}>
                      <DayBadge day={ev.day} />
                    </td>
                    <td style={{ padding:'11px 14px', color: 'var(--ink2)', fontWeight:500, whiteSpace:'nowrap', fontSize:12 }}>
                      {time}
                    </td>
                    <td style={{ padding:'11px 14px' }}>
                      <div style={{ display:'flex', alignItems:'center', gap:7, flexWrap:'wrap' }}>
                        <span style={{ fontFamily:'monospace', fontSize:11, fontWeight:700, color: 'var(--meadow-text-hover)', background:'var(--meadow-soft)', padding:'2px 7px', borderRadius:5, border:'1px solid var(--meadow-border)', whiteSpace:'nowrap' }}>
                          {code}
                        </span>
                        {title && <span style={{ fontSize:12.5, fontWeight:600, color: 'var(--ink)' }}>{title}</span>}
                        {(() => {
                          const isLab = ev.session?.toUpperCase().includes('LAB')
                          return (
                            <span style={{ fontSize:11, fontWeight:700, color: isLab ? '#A78BFA' : 'var(--muted)', background: isLab ? 'color-mix(in srgb, #6D28D9 15%, transparent)' : 'var(--hover)', padding: '2px 6px', borderRadius: 4, border: `1px solid ${isLab ? 'color-mix(in srgb, #6D28D9 30%, transparent)' : 'var(--border)'}`, whiteSpace: 'nowrap' }}>
                              {isLab ? '(LAB)' : '(LEC)'}
                            </span>
                          )
                        })()}
                      </div>
                    </td>
                    <td style={{ padding:'11px 14px', whiteSpace:'nowrap' }}>
                      <ProgramBadge program={ev.program} year={ev.year} block={ev.block} />
                    </td>
                    <td style={{ padding:'11px 14px' }}>
                      <RoomBadge room={room} session={ev.session} />
                    </td>
                    <td style={{ padding:'11px 14px', textAlign:'center' }}>
                      {units != null && units !== '—' && units !== 0 ? (
                        <span style={{ display:'inline-flex', alignItems:'center', justifyContent:'center', minWidth:28, height:22, padding:'0 8px', borderRadius:99, background:'var(--meadow-soft)', color: 'var(--meadow-text-hover)', fontSize:11.5, fontWeight:700, border:'1px solid var(--meadow-border)' }}>
                          {units}
                        </span>
                      ) : <span style={{ color:'var(--border)', fontSize:12 }}>—</span>}
                    </td>
                  </tr>
                )
              })}
            </tbody>
          </table>

          {/* Footer */}
          <div style={{ padding:'8px 20px', borderTop:'1px solid var(--hover)', background:'var(--bg)', display:'flex', gap:12, alignItems:'center' }}>
            <span style={{ fontSize:11.5, color: 'var(--muted2)' }}>
              <strong style={{ color: 'var(--ink)' }}>{filtered.length}</strong> of <strong style={{ color: 'var(--ink)' }}>{events.length}</strong> classes{hasFilters ? ' (filtered)' : ''}
            </span>
            {hasFilters && (
              <button type="button" onClick={clearAll} style={{ padding:'3px 10px', borderRadius:99, fontSize:11, fontWeight:600, background: 'var(--bg)', color: 'var(--muted)', border:'1px solid var(--border)', cursor:'pointer' }}>
                Clear filters
              </button>
            )}
          </div>
        </div>
      )}
    </div>
  )
}
