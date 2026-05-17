import { useState, useEffect, useMemo, useCallback } from 'react'
import { getCourses } from '../../services/api'
import { dedupeSpecs } from './fdShared'

// ─── Proficiency levels ───────────────────────────────────────────────────────
const LEVELS = [
  { rating: 1, label: 'Beginner',   short: 'BEG',  color: '#B91C1C', bg: '#FEF2F2', border: '#FECACA', dot: '#EF4444', hoverBg: '#FEE2E2' },
  { rating: 2, label: 'Developing', short: 'DEV',  color: '#B45309', bg: '#FFFBEB', border: '#FDE68A', dot: '#F59E0B', hoverBg: '#FEF3C7' },
  { rating: 3, label: 'Competent',  short: 'COMP', color: '#6D28D9', bg: '#F5F3FF', border: '#DDD6FE', dot: '#7C3AED', hoverBg: '#EDE9FE' },
  { rating: 4, label: 'Proficient', short: 'PROF', color: '#1D4ED8', bg: '#EFF6FF', border: '#BFDBFE', dot: '#3B82F6', hoverBg: '#DBEAFE' },
  { rating: 5, label: 'Expert',     short: 'EXP',  color: '#065F46', bg: '#ECFDF5', border: '#A7F3D0', dot: '#10B981', hoverBg: '#D1FAE5' },
]
const getLvl = r => LEVELS.find(l => l.rating === (r || 3)) || LEVELS[2]

const SEMESTERS = ['All', '1st Semester', '2nd Semester', 'Midyear']

// ─── Tiny building blocks ─────────────────────────────────────────────────────

function LevelBadge({ rating }) {
  const l = getLvl(rating)
  return (
    <span style={{
      display: 'inline-flex', alignItems: 'center', gap: 5,
      padding: '2px 9px', borderRadius: 99,
      background: l.bg, border: `1px solid ${l.border}`,
      fontSize: 10.5, fontWeight: 700, color: l.color, whiteSpace: 'nowrap',
    }}>
      <span style={{ width: 5, height: 5, borderRadius: '50%', background: l.dot, flexShrink: 0 }} />
      {l.label}
    </span>
  )
}

/** Five compact numbered rating pips. Used in both browse cards and assigned cards. */
function RatingPips({ value, onChange, size = 'md' }) {
  const [hovered, setHovered] = useState(null)
  const isSmall = size === 'sm'
  return (
    <div style={{ display: 'flex', gap: isSmall ? 3 : 4, alignItems: 'center' }}>
      {LEVELS.map(l => {
        const active  = value === l.rating
        const preview = hovered === l.rating
        const show    = active || preview
        return (
          <button
            key={l.rating}
            type="button"
            title={l.label}
            onClick={() => onChange(l.rating)}
            onMouseEnter={() => setHovered(l.rating)}
            onMouseLeave={() => setHovered(null)}
            style={{
              width: isSmall ? 24 : 28, height: isSmall ? 24 : 28,
              borderRadius: 7, border: `1.5px solid ${show ? l.border : '#E9E6F5'}`,
              background: show ? l.bg : '#F8F7FC',
              color: show ? l.color : '#BDB8D4',
              fontSize: isSmall ? 10 : 11, fontWeight: 700,
              cursor: 'pointer', fontFamily: "'DM Sans', sans-serif",
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              transition: 'all 0.1s', flexShrink: 0,
              boxShadow: active ? `0 0 0 2px ${l.border}` : 'none',
            }}>
            {l.rating}
          </button>
        )
      })}
    </div>
  )
}

function SearchBox({ value, onChange, placeholder }) {
  return (
    <div style={{ position: 'relative' }}>
      <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="#B0ABCC" strokeWidth="2"
        style={{ position: 'absolute', left: 11, top: '50%', transform: 'translateY(-50%)', pointerEvents: 'none' }}>
        <circle cx="11" cy="11" r="8" /><line x1="21" y1="21" x2="16.65" y2="16.65" />
      </svg>
      <input
        type="text" value={value} onChange={e => onChange(e.target.value)}
        placeholder={placeholder}
        style={{
          width: '100%', padding: '8px 34px 8px 32px',
          borderRadius: 9, border: '1.5px solid #EDE9F8',
          fontSize: 12.5, fontFamily: "'DM Sans', sans-serif",
          boxSizing: 'border-box', outline: 'none',
          background: '#FAFAFE', color: '#1a1a2e',
        }}
      />
      {value && (
        <button type="button" onClick={() => onChange('')}
          style={{ position: 'absolute', right: 9, top: '50%', transform: 'translateY(-50%)', background: 'none', border: 'none', cursor: 'pointer', padding: 2, display: 'flex', color: '#C4BFDF' }}>
          <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"><line x1="18" y1="6" x2="6" y2="18" /><line x1="6" y1="6" x2="18" y2="18" /></svg>
        </button>
      )}
    </div>
  )
}

function NavBtn({ active, onClick, icon, label, badge }) {
  return (
    <button type="button" onClick={onClick}
      style={{
        width: '100%', display: 'flex', alignItems: 'center', gap: 9,
        padding: '8px 11px', borderRadius: 8, border: 'none',
        background: active ? '#EEEAF8' : 'transparent',
        color: active ? '#5B3FBF' : '#7A7390',
        cursor: 'pointer', fontFamily: "'DM Sans', sans-serif",
        fontSize: 13, fontWeight: active ? 600 : 400,
        textAlign: 'left', transition: 'all 0.12s',
      }}>
      <span style={{ width: 17, display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={active ? 2.2 : 1.8}>{icon}</svg>
      </span>
      <span style={{ flex: 1 }}>{label}</span>
      {badge != null && badge > 0 && (
        <span style={{
          minWidth: 19, height: 19, borderRadius: 99,
          background: active ? '#7C6FCD' : '#EDE9F8',
          color: active ? '#fff' : '#8883B0',
          fontSize: 10, fontWeight: 700,
          display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '0 5px',
        }}>{badge}</span>
      )}
    </button>
  )
}

function SemesterTab({ label, active, count, onClick }) {
  return (
    <button type="button" onClick={onClick}
      style={{
        padding: '6px 14px', borderRadius: 8,
        border: active ? '1.5px solid #C4B8F0' : '1.5px solid transparent',
        background: active ? '#F0EBF9' : 'transparent',
        color: active ? '#5B3FBF' : '#9CA3AF',
        fontSize: 12, fontWeight: active ? 700 : 500,
        cursor: 'pointer', fontFamily: "'DM Sans', sans-serif",
        display: 'flex', alignItems: 'center', gap: 6,
        transition: 'all 0.12s', whiteSpace: 'nowrap',
      }}>
      {label}
      {count != null && (
        <span style={{
          fontSize: 10, fontWeight: 700, minWidth: 17, height: 17,
          borderRadius: 99, display: 'inline-flex', alignItems: 'center', justifyContent: 'center',
          background: active ? '#C4B8F0' : '#F0EDF9',
          color: active ? '#fff' : '#A89FCC', padding: '0 4px',
        }}>{count}</span>
      )}
    </button>
  )
}

// ─── Main ─────────────────────────────────────────────────────────────────────
export default function SpecializationModal({ specializations, onSave, onClose, isSaving }) {
  const [specs,       setSpecs]       = useState(() => dedupeSpecs(specializations))
  const [tab,         setTab]         = useState('current')

  // ── Assigned tab state
  const [currentQ,   setCurrentQ]    = useState('')
  const [sortBy,     setSortBy]      = useState('rating-desc')

  // ── Browse tab state
  const [browseQ,    setBrowseQ]     = useState('')
  const [activeSem,  setActiveSem]   = useState('All')
  const [pending,    setPending]     = useState({}) // { courseCode: { rating, title } }
  const [courses,    setCourses]     = useState([])
  const [loadingCrs, setLoadingCrs]  = useState(false)

  // ── Manual tab state
  const [newCode,    setNewCode]     = useState('')
  const [newRating,  setNewRating]   = useState(3)
  const [codeError,  setCodeError]   = useState('')

  useEffect(() => {
    setLoadingCrs(true)
    getCourses()
      .then(res => {
        const raw  = Array.isArray(res) ? res : (res?.courses ?? res?.data ?? [])
        const norm = raw.map(c => ({
          courseCode: c.courseCode || c.course_code || c.code || '',
          title:      c.title || c.Title || c.name || '',
          semester:   c.semester || '1st Semester',
          program:    c.program || c.dept || '',
        })).filter(c => c.courseCode || c.title)
        const seen = new Set()
        setCourses(norm.filter(c => {
          const k = (c.courseCode || c.title).toLowerCase()
          if (seen.has(k)) return false; seen.add(k); return true
        }))
      })
      .catch(() => setCourses([]))
      .finally(() => setLoadingCrs(false))
  }, [])

  const existingCodes  = useMemo(() => new Set(specs.map(s => (s.courseCode || '').toLowerCase().trim())), [specs])
  const courseTitleMap = useMemo(() => {
    const m = {}
    courses.forEach(c => { if (c.courseCode) m[c.courseCode.toLowerCase().trim()] = c.title || '' })
    return m
  }, [courses])

  // Semester → courses map
  const coursesBySemester = useMemo(() => {
    const map = { All: courses }
    SEMESTERS.slice(1).forEach(sem => {
      map[sem] = courses.filter(c => c.semester === sem)
    })
    return map
  }, [courses])

  const filteredBrowse = useMemo(() => {
    const base = coursesBySemester[activeSem] || []
    const q    = browseQ.toLowerCase()
    const list = q ? base.filter(c => c.courseCode.toLowerCase().includes(q) || c.title.toLowerCase().includes(q)) : base
    return list.sort((a, b) => {
      const aP = pending[a.courseCode] != null
      const bP = pending[b.courseCode] != null
      const aA = existingCodes.has(a.courseCode.toLowerCase())
      const bA = existingCodes.has(b.courseCode.toLowerCase())
      if (aP && !bP) return -1; if (!aP && bP) return 1
      if (aA && !bA) return 1;  if (!aA && bA) return -1
      return a.courseCode.localeCompare(b.courseCode)
    })
  }, [coursesBySemester, activeSem, browseQ, existingCodes, pending])

  const filteredSpecs = useMemo(() => {
    const q   = currentQ.toLowerCase()
    const src = [...specs]
    if (sortBy === 'code-asc')    src.sort((a, b) => (a.courseCode || '').localeCompare(b.courseCode || ''))
    if (sortBy === 'rating-desc') src.sort((a, b) => (b.rating || 3) - (a.rating || 3))
    if (sortBy === 'rating-asc')  src.sort((a, b) => (a.rating || 3) - (b.rating || 3))
    if (!q) return src
    return src.filter(s => {
      const code  = (s.courseCode || '').toLowerCase()
      const title = (s.title || courseTitleMap[code] || '').toLowerCase()
      return code.includes(q) || title.includes(q)
    })
  }, [specs, sortBy, currentQ, courseTitleMap])

  const pendingList   = useMemo(() => Object.entries(pending).map(([code, info]) => ({ code, ...info })), [pending])
  const pendingCount  = pendingList.length
  const specCount     = specs.length

  const breakdown = useMemo(() => {
    const counts = {}
    specs.forEach(s => { const r = s.rating || 3; counts[r] = (counts[r] || 0) + 1 })
    return LEVELS.slice().reverse().filter(l => counts[l.rating]).map(l => ({ ...l, count: counts[l.rating] }))
  }, [specs])

  // Stage / unstage a course from browse
  const togglePending = useCallback((course, rating) => {
    const code = course.courseCode
    setPending(prev => {
      if (prev[code]?.rating === rating) {
        // clicking the same rating again → remove from pending
        const next = { ...prev }; delete next[code]; return next
      }
      return { ...prev, [code]: { rating, title: course.title } }
    })
  }, [])

  // Commit all pending → specs
  function commitPending() {
    const toAdd = pendingList.filter(p => !existingCodes.has(p.code.toLowerCase()))
    setSpecs(prev => dedupeSpecs([...prev, ...toAdd.map(p => ({ courseCode: p.code, title: p.title || courseTitleMap[p.code.toLowerCase()] || '', rating: p.rating }))]))
    setPending({})
  }

  function addManual() {
    const code = newCode.trim().toUpperCase()
    if (!code) { setCodeError('Course code is required'); return }
    if (existingCodes.has(code.toLowerCase())) { setCodeError('Already added to specializations'); return }
    const resolvedTitle = courseTitleMap[code.toLowerCase()] || ''
    setSpecs(p => [...p, { courseCode: code, ...(resolvedTitle ? { title: resolvedTitle } : {}), rating: newRating }])
    setNewCode(''); setNewRating(3); setCodeError('')
  }

  // ─── Render ────────────────────────────────────────────────────────────────
  return (
    <div style={{
      position: 'fixed', inset: 0, zIndex: 1000,
      background: 'rgba(10,8,28,0.55)', backdropFilter: 'blur(6px)',
      display: 'flex', alignItems: 'center', justifyContent: 'center',
      padding: '20px 16px',
      fontFamily: "'DM Sans', sans-serif",
    }}>
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=DM+Sans:wght@400;500;600;700&display=swap');
        .spec-scroll::-webkit-scrollbar { width: 5px }
        .spec-scroll::-webkit-scrollbar-track { background: transparent }
        .spec-scroll::-webkit-scrollbar-thumb { background: #E0DAF5; border-radius: 99px }
        @keyframes spin { to { transform: rotate(360deg) } }
        @keyframes fadeUp { from { opacity:0; transform:translateY(6px) } to { opacity:1; transform:translateY(0) } }
      `}</style>

      <div style={{
        background: '#fff', borderRadius: 18, width: '100%', maxWidth: 960,
        boxShadow: '0 28px 80px rgba(10,8,28,0.2), 0 0 0 1px rgba(0,0,0,0.05)',
        overflow: 'hidden', display: 'flex', flexDirection: 'column', maxHeight: '90vh',
      }}>

        {/* ── Header ─────────────────────────────────────────────────────── */}
        <div style={{
          padding: '16px 22px', borderBottom: '1px solid #F0EDF9',
          display: 'flex', alignItems: 'center', gap: 12, flexShrink: 0,
          background: 'linear-gradient(to right, #FDFCFF, #F9F7FE)',
        }}>
          <div style={{
            width: 36, height: 36, borderRadius: 10,
            background: 'linear-gradient(135deg, #7C3AED 0%, #5B21B6 100%)',
            display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0,
          }}>
            <svg width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="#fff" strokeWidth="2">
              <path d="M4 19.5A2.5 2.5 0 0 1 6.5 17H20" /><path d="M6.5 2H20v20H6.5A2.5 2.5 0 0 1 4 19.5v-15A2.5 2.5 0 0 1 6.5 2z" />
              <line x1="8" y1="7" x2="16" y2="7" /><line x1="8" y1="11" x2="12" y2="11" />
            </svg>
          </div>
          <div style={{ flex: 1 }}>
            <div style={{ fontSize: 15, fontWeight: 700, color: '#111827', letterSpacing: '-0.2px' }}>Manage Specializations</div>
            <div style={{ fontSize: 12, color: '#9CA3AF', marginTop: 1 }}>Assign courses and set proficiency levels</div>
          </div>
          {specCount > 0 && (
            <div style={{ padding: '3px 11px', borderRadius: 99, background: '#F0EEF9', border: '1px solid #DDD6FE' }}>
              <span style={{ fontSize: 11.5, fontWeight: 700, color: '#6D28D9' }}>{specCount} assigned</span>
            </div>
          )}
          <button onClick={onClose}
            style={{ width: 32, height: 32, borderRadius: 8, border: '1px solid #E9E6F8', background: '#F9FAFB', display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer', padding: 0, flexShrink: 0 }}>
            <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="#6B7280" strokeWidth="2.5"><line x1="18" y1="6" x2="6" y2="18" /><line x1="6" y1="6" x2="18" y2="18" /></svg>
          </button>
        </div>

        {/* ── Body ───────────────────────────────────────────────────────── */}
        <div style={{ flex: 1, display: 'flex', overflow: 'hidden' }}>

          {/* Sidebar */}
          <div style={{ width: 208, flexShrink: 0, borderRight: '1px solid #F0EDF9', display: 'flex', flexDirection: 'column', padding: '12px 10px', gap: 2, background: '#FAFAFE' }}>
            <div style={{ fontSize: 9.5, fontWeight: 700, color: '#C4BFDF', textTransform: 'uppercase', letterSpacing: '0.8px', padding: '4px 11px 8px' }}>Navigation</div>

            <NavBtn active={tab === 'current'} onClick={() => setTab('current')}
              icon={<><path d="M4 19.5A2.5 2.5 0 0 1 6.5 17H20" /><path d="M6.5 2H20v20H6.5A2.5 2.5 0 0 1 4 19.5v-15A2.5 2.5 0 0 1 6.5 2z" /></>}
              label="Assigned" badge={specCount} />
            <NavBtn active={tab === 'browse'} onClick={() => setTab('browse')}
              icon={<><circle cx="11" cy="11" r="8" /><line x1="21" y1="21" x2="16.65" y2="16.65" /></>}
              label="Browse Catalog" badge={pendingCount || null} />
            <NavBtn active={tab === 'manual'} onClick={() => setTab('manual')}
              icon={<><line x1="12" y1="5" x2="12" y2="19" /><line x1="5" y1="12" x2="19" y2="12" /></>}
              label="Add Manually" />

            {specCount > 0 && (
              <div style={{ marginTop: 'auto', paddingTop: 14 }}>
                <div style={{ height: 1, background: '#F0EDF9', marginBottom: 12 }} />
                <div style={{ fontSize: 9.5, fontWeight: 700, color: '#C4BFDF', textTransform: 'uppercase', letterSpacing: '0.8px', padding: '0 11px', marginBottom: 8 }}>Breakdown</div>
                <div style={{ display: 'flex', flexDirection: 'column', gap: 3, padding: '0 2px' }}>
                  {breakdown.map(l => (
                    <div key={l.rating} style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '4px 9px', borderRadius: 7 }}>
                      <span style={{ width: 6, height: 6, borderRadius: '50%', background: l.dot, flexShrink: 0 }} />
                      <span style={{ fontSize: 11.5, color: '#4B5563', flex: 1 }}>{l.label}</span>
                      <span style={{ fontSize: 10.5, fontWeight: 700, color: l.color, background: l.bg, padding: '1px 7px', borderRadius: 99, border: `1px solid ${l.border}` }}>{l.count}</span>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>

          {/* Content */}
          <div style={{ flex: 1, display: 'flex', flexDirection: 'column', overflow: 'hidden' }}>

            {/* ── Assigned Courses ──────────────────────────────────────── */}
            {tab === 'current' && (
              <div style={{ flex: 1, display: 'flex', flexDirection: 'column', overflow: 'hidden' }}>
                <div style={{ padding: '12px 18px', borderBottom: '1px solid #F0EDF9', display: 'flex', alignItems: 'center', gap: 10, flexShrink: 0 }}>
                  <div style={{ flex: 1 }}>
                    <SearchBox value={currentQ} onChange={setCurrentQ} placeholder="Filter by code or title…" />
                  </div>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 2, flexShrink: 0 }}>
                    <span style={{ fontSize: 11, color: '#C4BFDF', fontWeight: 600, marginRight: 4 }}>Sort</span>
                    {[{ key: 'rating-desc', label: 'Best' }, { key: 'code-asc', label: 'A–Z' }, { key: 'rating-asc', label: 'Lowest' }].map(o => (
                      <button key={o.key} type="button" onClick={() => setSortBy(o.key)}
                        style={{ padding: '4px 10px', borderRadius: 6, fontSize: 11.5, fontWeight: sortBy === o.key ? 700 : 500, background: sortBy === o.key ? '#EEEAF8' : 'transparent', color: sortBy === o.key ? '#6D28D9' : '#9CA3AF', border: sortBy === o.key ? '1px solid #DDD6FE' : '1px solid transparent', cursor: 'pointer', fontFamily: "'DM Sans', sans-serif" }}>
                        {o.label}
                      </button>
                    ))}
                  </div>
                </div>

                <div className="spec-scroll" style={{ flex: 1, overflowY: 'auto', padding: '14px 18px' }}>
                  {specs.length === 0 ? (
                    <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', padding: '56px 0', gap: 12, textAlign: 'center' }}>
                      <div style={{ width: 48, height: 48, borderRadius: 13, background: '#F5F3FF', border: '1px solid #EDE9FE', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                        <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="#7C3AED" strokeWidth="1.6"><path d="M4 19.5A2.5 2.5 0 0 1 6.5 17H20" /><path d="M6.5 2H20v20H6.5A2.5 2.5 0 0 1 4 19.5v-15A2.5 2.5 0 0 1 6.5 2z" /></svg>
                      </div>
                      <div>
                        <div style={{ fontSize: 14, fontWeight: 600, color: '#111827', marginBottom: 5 }}>No courses assigned yet</div>
                        <div style={{ fontSize: 12.5, color: '#9CA3AF', lineHeight: 1.7 }}>Browse the catalog or add a course code manually.</div>
                      </div>
                      <div style={{ display: 'flex', gap: 8, marginTop: 4 }}>
                        <button onClick={() => setTab('browse')} style={{ padding: '7px 16px', borderRadius: 9, border: 'none', background: '#6D28D9', color: '#fff', fontSize: 12.5, fontWeight: 600, cursor: 'pointer', fontFamily: "'DM Sans', sans-serif" }}>Browse Catalog</button>
                        <button onClick={() => setTab('manual')} style={{ padding: '7px 14px', borderRadius: 9, border: '1.5px solid #E5E7EB', background: '#fff', color: '#374151', fontSize: 12.5, fontWeight: 600, cursor: 'pointer', fontFamily: "'DM Sans', sans-serif" }}>Add Manually</button>
                      </div>
                    </div>
                  ) : filteredSpecs.length === 0 ? (
                    <div style={{ textAlign: 'center', padding: '40px 0', color: '#9CA3AF', fontSize: 13 }}>No courses match "{currentQ}".</div>
                  ) : (
                    <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
                      {filteredSpecs.map((spec, visIdx) => {
                        const origIdx = specs.indexOf(spec)
                        const title   = spec.title || courseTitleMap[(spec.courseCode || '').toLowerCase().trim()] || ''
                        const rating  = spec.rating || 3
                        const lvl     = getLvl(rating)
                        return (
                          <div key={visIdx} style={{
                            display: 'flex', alignItems: 'center', gap: 12,
                            padding: '11px 14px', borderRadius: 11,
                            border: '1.5px solid #F0EDF9', background: '#FDFDFF',
                            animation: 'fadeUp 0.15s ease',
                          }}>
                            {/* Color accent strip */}
                            <div style={{ width: 3, borderRadius: 99, background: lvl.dot, alignSelf: 'stretch', flexShrink: 0, minHeight: 32 }} />
                            {/* Info */}
                            <div style={{ flex: 1, minWidth: 0 }}>
                              <div style={{ display: 'flex', alignItems: 'center', gap: 7, marginBottom: title ? 2 : 0 }}>
                                <span style={{ fontSize: 12.5, fontWeight: 700, color: '#1a1a2e', letterSpacing: '0.2px' }}>{spec.courseCode}</span>
                                <LevelBadge rating={rating} />
                              </div>
                              {title && <div style={{ fontSize: 11.5, color: '#9CA3AF', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{title}</div>}
                            </div>
                            {/* Rating pips */}
                            <RatingPips size="sm" value={rating} onChange={r => setSpecs(p => p.map((s, i) => i === origIdx ? { ...s, rating: r } : s))} />
                            {/* Remove */}
                            <button onClick={() => setSpecs(p => p.filter((_, i) => i !== origIdx))}
                              style={{ width: 28, height: 28, borderRadius: 7, border: '1px solid #FEE2E2', background: '#FFF5F5', color: '#DC2626', flexShrink: 0, display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer', padding: 0 }}>
                              <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"><polyline points="3 6 5 6 21 6" /><path d="M19 6l-1 14a2 2 0 0 1-2 2H8a2 2 0 0 1-2-2L5 6" /></svg>
                            </button>
                          </div>
                        )
                      })}
                    </div>
                  )}
                </div>
              </div>
            )}

            {/* ── Browse Catalog ────────────────────────────────────────── */}
            {tab === 'browse' && (
              <div style={{ flex: 1, display: 'flex', flexDirection: 'column', overflow: 'hidden' }}>

                {/* Toolbar */}
                <div style={{ padding: '12px 18px 10px', borderBottom: '1px solid #F0EDF9', flexShrink: 0 }}>
                  <SearchBox value={browseQ} onChange={setBrowseQ} placeholder="Search by course code or title…" />

                  {/* Semester tabs */}
                  <div style={{ display: 'flex', gap: 5, marginTop: 10, flexWrap: 'wrap' }}>
                    {SEMESTERS.map(sem => {
                      const list = coursesBySemester[sem] || []
                      return (
                        <SemesterTab
                          key={sem} label={sem === 'All' ? 'All Semesters' : sem}
                          active={activeSem === sem}
                          count={sem === 'All' ? null : list.length}
                          onClick={() => setActiveSem(sem)}
                        />
                      )
                    })}
                  </div>

                  {/* Status row */}
                  <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginTop: 8 }}>
                    <span style={{ fontSize: 11.5, color: '#C4BFDF' }}>
                      {loadingCrs ? 'Loading…' : `${filteredBrowse.length} course${filteredBrowse.length === 1 ? '' : 's'}`}
                    </span>
                    {pendingCount > 0 && (
                      <>
                        <span style={{ color: '#E5E7EB' }}>·</span>
                        <span style={{ fontSize: 11.5, color: '#7C3AED', fontWeight: 600 }}>{pendingCount} staged</span>
                      </>
                    )}
                    {existingCodes.size > 0 && (
                      <>
                        <span style={{ color: '#E5E7EB' }}>·</span>
                        <span style={{ fontSize: 11.5, color: '#9CA3AF' }}>{existingCodes.size} already assigned</span>
                      </>
                    )}
                  </div>
                </div>

                {/* Rating legend */}
                <div style={{ padding: '7px 18px', borderBottom: '1px solid #F8F5FF', display: 'flex', alignItems: 'center', gap: 6, flexShrink: 0, background: '#FDFCFF' }}>
                  <span style={{ fontSize: 11, color: '#C4BFDF', fontWeight: 600, marginRight: 4 }}>Proficiency:</span>
                  {LEVELS.map(l => (
                    <span key={l.rating} style={{ display: 'inline-flex', alignItems: 'center', gap: 4, fontSize: 11, color: l.color, fontWeight: 500 }}>
                      <span style={{ width: 18, height: 18, borderRadius: 5, background: l.bg, border: `1.5px solid ${l.border}`, display: 'inline-flex', alignItems: 'center', justifyContent: 'center', fontSize: 10, fontWeight: 700, color: l.color }}>{l.rating}</span>
                      {l.label}
                      {l.rating < 5 && <span style={{ color: '#E5E7EB', marginLeft: 2 }}>·</span>}
                    </span>
                  ))}
                </div>

                {/* Course grid */}
                <div className="spec-scroll" style={{ flex: 1, overflowY: 'auto', padding: '12px 18px' }}>
                  {loadingCrs ? (
                    <div style={{ display: 'flex', alignItems: 'center', gap: 10, color: '#9CA3AF', fontSize: 13, padding: '28px 0' }}>
                      <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" style={{ animation: 'spin 1s linear infinite' }}><path d="M21 12a9 9 0 1 1-6.219-8.56" /></svg>
                      Loading course catalog…
                    </div>
                  ) : filteredBrowse.length === 0 ? (
                    <div style={{ textAlign: 'center', padding: '40px 0', color: '#9CA3AF', fontSize: 13 }}>No matching courses found.</div>
                  ) : (
                    <div style={{ display: 'flex', flexDirection: 'column', gap: 5 }}>
                      {filteredBrowse.map(course => {
                        const code    = course.courseCode || course.title
                        const already = existingCodes.has(code.toLowerCase())
                        const staged  = pending[code]
                        return (
                          <BrowseCourseRow
                            key={code}
                            course={course}
                            already={already}
                            staged={staged}
                            onRate={rating => togglePending(course, rating)}
                          />
                        )
                      })}
                    </div>
                  )}
                </div>

                {/* Staged commit bar */}
                {pendingCount > 0 && (
                  <div style={{
                    padding: '12px 18px', borderTop: '1.5px solid #EDE9FE',
                    background: 'linear-gradient(to right, #F5F0FF, #EDE9FE)',
                    display: 'flex', alignItems: 'center', gap: 12, flexShrink: 0,
                    animation: 'fadeUp 0.2s ease',
                  }}>
                    {/* Staged preview chips */}
                    <div style={{ flex: 1, display: 'flex', alignItems: 'center', gap: 6, flexWrap: 'wrap', minWidth: 0 }}>
                      <span style={{ fontSize: 12, fontWeight: 600, color: '#5B3FBF', flexShrink: 0 }}>Staged:</span>
                      {pendingList.slice(0, 5).map(p => {
                        const lvl = getLvl(p.rating)
                        return (
                          <span key={p.code} style={{
                            display: 'inline-flex', alignItems: 'center', gap: 5,
                            padding: '3px 9px', borderRadius: 99,
                            background: '#fff', border: `1.5px solid ${lvl.border}`,
                            fontSize: 11.5, fontWeight: 600, color: lvl.color,
                          }}>
                            {p.code}
                            <span style={{ fontSize: 10, background: lvl.bg, padding: '0 5px', borderRadius: 99, color: lvl.color, fontWeight: 700 }}>{p.rating}</span>
                            <button type="button" onClick={() => togglePending({ courseCode: p.code }, p.rating)}
                              style={{ background: 'none', border: 'none', cursor: 'pointer', padding: 0, display: 'flex', color: lvl.color, opacity: 0.6 }}>
                              <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3"><line x1="18" y1="6" x2="6" y2="18" /><line x1="6" y1="6" x2="18" y2="18" /></svg>
                            </button>
                          </span>
                        )
                      })}
                      {pendingCount > 5 && <span style={{ fontSize: 11.5, color: '#7C3AED', fontWeight: 600 }}>+{pendingCount - 5} more</span>}
                    </div>
                    <div style={{ display: 'flex', gap: 7, flexShrink: 0 }}>
                      <button type="button" onClick={() => setPending({})}
                        style={{ padding: '7px 14px', borderRadius: 8, border: '1.5px solid #C4B8F0', background: 'transparent', color: '#6D28D9', fontSize: 12.5, fontWeight: 600, cursor: 'pointer', fontFamily: "'DM Sans', sans-serif" }}>
                        Clear
                      </button>
                      <button type="button" onClick={commitPending}
                        style={{ display: 'inline-flex', alignItems: 'center', gap: 7, padding: '7px 18px', borderRadius: 8, border: 'none', background: '#6D28D9', color: '#fff', fontSize: 12.5, fontWeight: 600, cursor: 'pointer', fontFamily: "'DM Sans', sans-serif", boxShadow: '0 4px 14px rgba(109,40,217,0.28)' }}>
                        <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"><polyline points="20 6 9 17 4 12" /></svg>
                        Add {pendingCount} Course{pendingCount !== 1 ? 's' : ''}
                      </button>
                    </div>
                  </div>
                )}
              </div>
            )}

            {/* ── Add Manually ─────────────────────────────────────────── */}
            {tab === 'manual' && (
              <div style={{ flex: 1, overflowY: 'auto', padding: '22px 24px' }} className="spec-scroll">
                <div style={{ maxWidth: 480 }}>
                  <div style={{ padding: '12px 16px', borderRadius: 11, background: '#FAFAFF', border: '1px solid #EDE9FE', marginBottom: 22, display: 'flex', gap: 10, alignItems: 'flex-start' }}>
                    <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="#7C3AED" strokeWidth="2" style={{ flexShrink: 0, marginTop: 1 }}><circle cx="12" cy="12" r="10" /><line x1="12" y1="8" x2="12" y2="12" /><line x1="12" y1="16" x2="12.01" y2="16" /></svg>
                    <div style={{ fontSize: 12.5, color: '#4C1D95', lineHeight: 1.6 }}>
                      Use this for courses not in the catalog. Enter the code directly — e.g. <strong>CS101</strong>, <strong>MATH201</strong>. Saved as uppercase.
                    </div>
                  </div>

                  <div style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>
                    <div>
                      <label style={{ display: 'block', fontSize: 12, fontWeight: 600, color: '#374151', marginBottom: 7 }}>
                        Course Code <span style={{ color: '#EF4444' }}>*</span>
                      </label>
                      <input type="text" value={newCode}
                        onChange={e => { setNewCode(e.target.value.toUpperCase()); setCodeError('') }}
                        onKeyDown={e => { if (e.key === 'Enter') { e.preventDefault(); addManual() } }}
                        placeholder="e.g. CS101"
                        style={{ width: '100%', padding: '10px 13px', borderRadius: 9, border: `1.5px solid ${codeError ? '#FCA5A5' : '#E5E7EB'}`, fontSize: 13, fontFamily: "'DM Sans', sans-serif", boxSizing: 'border-box', outline: 'none', letterSpacing: '0.5px', background: codeError ? '#FFF5F5' : '#fff' }} />
                      {codeError && (
                        <div style={{ display: 'flex', alignItems: 'center', gap: 5, marginTop: 6, color: '#DC2626', fontSize: 12, fontWeight: 500 }}>
                          <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><circle cx="12" cy="12" r="10" /><line x1="12" y1="8" x2="12" y2="12" /></svg>
                          {codeError}
                        </div>
                      )}
                    </div>

                    <div>
                      <label style={{ display: 'block', fontSize: 12, fontWeight: 600, color: '#374151', marginBottom: 10 }}>Proficiency Level</label>
                      <div style={{ display: 'flex', gap: 6 }}>
                        {LEVELS.map(l => {
                          const active = newRating === l.rating
                          return (
                            <button key={l.rating} type="button" onClick={() => setNewRating(l.rating)}
                              style={{ flex: 1, padding: '10px 0', borderRadius: 9, border: `1.5px solid ${active ? l.border : '#EDE9FA'}`, background: active ? l.bg : '#FAFAFE', color: active ? l.color : '#C4BFDF', fontSize: 11, fontWeight: active ? 700 : 500, cursor: 'pointer', fontFamily: "'DM Sans', sans-serif", display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 4, transition: 'all 0.12s' }}>
                              <span style={{ fontSize: 16, fontWeight: 700 }}>{l.rating}</span>
                              <span style={{ fontSize: 9.5, letterSpacing: '0.3px' }}>{l.short}</span>
                            </button>
                          )
                        })}
                      </div>
                      <div style={{ marginTop: 10, display: 'flex', alignItems: 'center', gap: 8 }}>
                        <LevelBadge rating={newRating} />
                        <span style={{ fontSize: 12, color: '#6B7280' }}>
                          {newRating === 5 ? 'Mastery-level knowledge'
                            : newRating === 4 ? 'Strong command and experience'
                              : newRating === 3 ? 'Solid, can teach effectively'
                                : newRating === 2 ? 'Foundational, building skills'
                                  : 'Just starting out'}
                        </span>
                      </div>
                    </div>

                    <button type="button" onClick={addManual}
                      style={{ alignSelf: 'flex-start', display: 'flex', alignItems: 'center', gap: 7, padding: '9px 20px', borderRadius: 9, border: 'none', background: '#6D28D9', color: '#fff', fontSize: 13, fontWeight: 600, cursor: 'pointer', fontFamily: "'DM Sans', sans-serif", boxShadow: '0 4px 14px rgba(109,40,217,0.26)' }}>
                      <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"><line x1="12" y1="5" x2="12" y2="19" /><line x1="5" y1="12" x2="19" y2="12" /></svg>
                      Add Course
                    </button>
                  </div>
                </div>
              </div>
            )}

          </div>
        </div>

        {/* ── Footer ─────────────────────────────────────────────────────── */}
        <div style={{ padding: '12px 22px', borderTop: '1px solid #F0EDF9', display: 'flex', justifyContent: 'space-between', alignItems: 'center', background: '#FAFAFE', flexShrink: 0 }}>
          <div style={{ fontSize: 12, color: '#9CA3AF' }}>
            {specCount === 0
              ? 'No specializations assigned'
              : `${specCount} specialization${specCount === 1 ? '' : 's'} assigned`}
            {specCount > 0 && breakdown[0] && (
              <span> · top level: <strong style={{ color: breakdown[0].color }}>{breakdown[0].label}</strong></span>
            )}
          </div>
          <div style={{ display: 'flex', gap: 8 }}>
            <button onClick={onClose}
              style={{ padding: '8px 18px', borderRadius: 9, border: '1.5px solid #E5E7EB', background: '#fff', color: '#374151', fontSize: 13, fontWeight: 600, cursor: 'pointer', fontFamily: "'DM Sans', sans-serif" }}>
              Cancel
            </button>
            <button onClick={() => onSave(specs)} disabled={isSaving}
              style={{ display: 'inline-flex', alignItems: 'center', gap: 7, padding: '8px 20px', borderRadius: 9, border: 'none', background: '#6D28D9', color: '#fff', fontSize: 13, fontWeight: 600, cursor: isSaving ? 'default' : 'pointer', fontFamily: "'DM Sans', sans-serif", opacity: isSaving ? 0.65 : 1, boxShadow: '0 4px 14px rgba(109,40,217,0.26)' }}>
              {isSaving
                ? <><svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" style={{ animation: 'spin 0.8s linear infinite' }}><path d="M21 12a9 9 0 1 1-6.219-8.56" /></svg>Saving…</>
                : <><svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"><polyline points="20 6 9 17 4 12" /></svg>{specCount > 0 ? `Save Changes (${specCount})` : 'Save'}</>
              }
            </button>
          </div>
        </div>

      </div>
    </div>
  )
}

// ─── Browse row (split out for clarity) ──────────────────────────────────────
function BrowseCourseRow({ course, already, staged, onRate }) {
  const [hovered, setHovered] = useState(false)
  const code  = course.courseCode || course.title
  const lvl   = staged ? getLvl(staged.rating) : null

  return (
    <div
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => setHovered(false)}
      style={{
        display: 'flex', alignItems: 'center', gap: 12,
        padding: '10px 14px', borderRadius: 10,
        border: `1.5px solid ${staged ? lvl.border : already ? '#EDE9FE' : hovered ? '#E8E3F8' : '#F3F0FE'}`,
        background: staged ? lvl.bg : already ? '#FAFAFF' : hovered ? '#FDFBFF' : '#FDFDFF',
        transition: 'all 0.12s',
        animation: 'fadeUp 0.12s ease',
        opacity: already ? 0.7 : 1,
      }}>
      {/* Course info */}
      <div style={{ flex: 1, minWidth: 0 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 7, marginBottom: course.title ? 1 : 0 }}>
          <span style={{ fontSize: 12.5, fontWeight: 700, color: '#1a1a2e', letterSpacing: '0.2px' }}>{code}</span>
          {already && (
            <span style={{ fontSize: 9.5, fontWeight: 700, color: '#7C3AED', background: '#F5F3FF', padding: '1px 7px', borderRadius: 99, border: '1px solid #DDD6FE' }}>Assigned</span>
          )}
          {staged && !already && (
            <span style={{ fontSize: 9.5, fontWeight: 700, color: lvl.color, background: lvl.bg, padding: '1px 7px', borderRadius: 99, border: `1px solid ${lvl.border}` }}>Staged · {lvl.label}</span>
          )}
        </div>
        {course.title && (
          <div style={{ fontSize: 11.5, color: '#9CA3AF', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{course.title}</div>
        )}
      </div>

      {/* Rating pips — disabled if already assigned */}
      {already ? (
        <span style={{ fontSize: 11.5, color: '#C4BFDF', fontStyle: 'italic' }}>already assigned</span>
      ) : (
        <div style={{ display: 'flex', gap: 3, alignItems: 'center', flexShrink: 0 }}>
          <span style={{ fontSize: 10.5, color: '#C4BFDF', marginRight: 4, fontWeight: 600 }}>Rate:</span>
          {LEVELS.map(l => {
            const active = staged?.rating === l.rating
            return (
              <button key={l.rating} type="button" title={l.label} onClick={() => onRate(l.rating)}
                style={{
                  width: 26, height: 26, borderRadius: 7,
                  border: `1.5px solid ${active ? l.border : '#E9E6F5'}`,
                  background: active ? l.bg : '#F8F7FC',
                  color: active ? l.color : '#BDB8D4',
                  fontSize: 11, fontWeight: 700, cursor: 'pointer',
                  fontFamily: "'DM Sans', sans-serif",
                  display: 'flex', alignItems: 'center', justifyContent: 'center',
                  transition: 'all 0.1s',
                  boxShadow: active ? `0 0 0 2px ${l.border}` : 'none',
                }}>
                {l.rating}
              </button>
            )
          })}
        </div>
      )}
    </div>
  )
}