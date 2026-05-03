import { useEffect, useState, useMemo, useCallback } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import { getFaculty, getArchivedFaculty, addFaculty, updateFaculty, deleteFaculty, archiveFaculty, unarchiveFaculty, listSaved, loadSaved, getCourses, updateCredentials } from '../../services/api'
import { useScheduleStore } from '../../store/scheduleStore'
import FacultyEventsTable from '../../components/FacultyEventsTable'

// ─── Constants ────────────────────────────────────────────────────────────────
const ACADEMIC_RANKS = [
  'Instructor I','Instructor II','Instructor III',
  'Assistant Professor I','Assistant Professor II',
  'Associate Professor I','Associate Professor II',
  'Professor I','Professor II','Professor III',
  'Assistant Dean','Dean',
]
const DEPARTMENTS   = ['CCS','CEAS','CHTM','CBA','CAHS']
const ALL_DAYS      = ['Monday','Tuesday','Wednesday','Thursday','Friday','Saturday','Sunday']
const RATING_LABELS = { 5:'Expert', 4:'Highly Proficient', 3:'Competent', 2:'Developing', 1:'Beginner' }
const RATING_COLORS = { 5:'#059669', 4:'#2563EB', 3:'#7C6FCD', 2:'#D97706', 1:'#C0392B' }
const SPECS_PREVIEW = 4

const empty = {
  name: '', email: '', status: 'full-time', AcademicRank: '',
  Department: 'CCS', Educational_attainment: '', Sex: '', units: 0,
  specializations: [], preferredDays: ALL_DAYS,
  preferredTimeStart: 7, preferredTimeEnd: 21,
}

// ─── Toast styles injection ───────────────────────────────────────────────────
if (!document.getElementById('faculty-detail-toast-style')) {
  const s = document.createElement('style')
  s.id = 'faculty-detail-toast-style'
  s.textContent = `
    @keyframes fdToastIn { from{opacity:0;transform:scale(.96) translateY(12px)} to{opacity:1;transform:scale(1) translateY(0)} }
    .fd-toast-wrap { position:fixed; bottom:24px; left:50%; z-index:9999; display:flex; flex-direction:column; gap:8px; align-items:center; pointer-events:none; transform:translateX(-50%); }
    .fd-toast { display:flex; align-items:center; gap:9px; padding:10px 16px; border-radius:12px; font-family:'Poppins',sans-serif; font-size:12.5px; font-weight:500; box-shadow:0 8px 28px rgba(26,26,46,0.18); animation:fdToastIn .22s cubic-bezier(.4,0,.2,1); white-space:nowrap; pointer-events:auto; }
    .fd-toast.success { background:linear-gradient(135deg,#7C6FCD,#5a4fbf); color:#fff; box-shadow:0 8px 24px rgba(124,111,205,0.3); border:1px solid #A99BE8; }
    .fd-toast.error   { background:linear-gradient(135deg,#7C6FCD,#5a4fbf); color:#fff; box-shadow:0 8px 24px rgba(124,111,205,0.3); border:1px solid #A99BE8; }
    .fd-toast.info    { background:linear-gradient(135deg,#7C6FCD,#5a4fbf); color:#fff; box-shadow:0 8px 24px rgba(124,111,205,0.3); border:1px solid #A99BE8; }
  `
  document.head.appendChild(s)
}

// ─── Toast System ─────────────────────────────────────────────────────────────
function useToast() {
  const [toasts, setToasts] = useState([])
  const toast = useCallback(function(message, type, duration) {
    const t = type || 'info'
    const d = duration || 3000
    const id = Date.now() + Math.random()
    setToasts(function(prev) { return prev.concat([{ id, message, type: t }]) })
    setTimeout(function() { setToasts(function(prev) { return prev.filter(function(x) { return x.id !== id }) }) }, d)
  }, [])
  return { toasts, toast }
}

function ToastContainer({ toasts }) {
  const icons = {
    success: <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"><polyline points="20 6 9 17 4 12"/></svg>,
    error:   <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><circle cx="12" cy="12" r="10"/><line x1="12" y1="8" x2="12" y2="12"/></svg>,
    info:    <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><circle cx="12" cy="12" r="10"/><path d="M12 8v4"/></svg>,
  }
  return (
    <div className="fd-toast-wrap">
      {toasts.map(function(t) {
        return <div key={t.id} className={'fd-toast ' + t.type}>{icons[t.type]}{t.message}</div>
      })}
    </div>
  )
}

// ─── Tier helpers (mirrors unit_balancing.py) ─────────────────────────────────
function getEffectiveMaxUnits(status, count) {
  if (status === 'part-time') return 15
  if (count >= 5) return 18
  if (count >= 3) return 21
  return 24
}
function getTierLabel(status, count) {
  if (status === 'part-time') return 'Part-Time · max 15 units'
  if (count >= 5) return 'Full-Time · 5+ courses · max 18 units'
  if (count >= 3) return 'Full-Time · 3-4 courses · max 21 units'
  if (count >= 1) return 'Full-Time · 1-2 courses · max 24 units'
  return 'Full-Time · no assignments yet · max 24 units'
}

// ─── Dedup ────────────────────────────────────────────────────────────────────
function dedupeSpecs(specs) {
  const seen = new Set()
  return (specs || [])
    .map(function(s) { return (typeof s === 'string') ? { courseCode: s, rating: 3 } : Object.assign({}, s) })
    .filter(function(s) {
      const key = (s.courseCode || '').toLowerCase().trim()
      if (!key || seen.has(key)) return false
      seen.add(key)
      return true
    })
}

// ─── Time label ───────────────────────────────────────────────────────────────
function fmtHour(h) {
  const hh   = Math.floor(h)
  const mm   = (h % 1) === 0.5 ? '30' : '00'
  const ampm = hh >= 12 ? 'PM' : 'AM'
  const disp = hh > 12 ? hh - 12 : (hh === 0 ? 12 : hh)
  return disp + ':' + mm + ' ' + ampm
}

// ─── Mini star — no inline ternaries in SVG attrs ────────────────────────────
function MiniStar({ filled }) {
  const fc = filled ? '#7C6FCD' : 'none'
  const sc = filled ? '#7C6FCD' : '#D8D3F5'
  return (
    <svg width="9" height="9" viewBox="0 0 24 24" fill={fc} stroke={sc} strokeWidth="2">
      <polygon points="12 2 15.09 8.26 22 9.27 17 14.14 18.18 21.02 12 17.77 5.82 21.02 7 14.14 2 9.27 8.91 8.26 12 2"/>
    </svg>
  )
}

// ─── Star rating ──────────────────────────────────────────────────────────────
function StarRating({ value, onChange, size }) {
  const sz = size || 20
  const [hov, setHov] = useState(0)
  return (
    <div style={{ display: 'flex', gap: 3, alignItems: 'center' }}>
      {[1,2,3,4,5].map(function(s) {
        const on  = (hov || value) >= s
        const fc  = on ? '#7C6FCD' : 'none'
        const sc  = on ? '#7C6FCD' : '#D8D3F5'
        const cur = onChange ? 'pointer' : 'default'
        return (
          <svg key={s} width={sz} height={sz} viewBox="0 0 24 24" fill={fc} stroke={sc} strokeWidth="2"
            style={{ cursor: cur, transition: 'all 0.1s' }}
            onMouseEnter={function() { if (onChange) setHov(s) }}
            onMouseLeave={function() { if (onChange) setHov(0) }}
            onClick={function() { if (onChange) onChange(s) }}
          >
            <polygon points="12 2 15.09 8.26 22 9.27 17 14.14 18.18 21.02 12 17.77 5.82 21.02 7 14.14 2 9.27 8.91 8.26 12 2"/>
          </svg>
        )
      })}
      {onChange && (
        <span style={{ fontSize: 11, color: RATING_COLORS[value] || '#8883B0', fontWeight: 600, marginLeft: 4 }}>
          {RATING_LABELS[value] || ''}
        </span>
      )}
    </div>
  )
}

// ─── Unit cap info panel (inline expandable — no overflow clipping) ────────────
function UnitCapInfo({ expanded, onToggle }) {
  const rows = [
    { label: 'Part-Time',        cap: '≤ 15 units', color: '#8883B0', bg: '#F5F4FB' },
    { label: 'FT · 5+ courses',  cap: '≤ 18 units', color: '#C0392B', bg: '#FFE8E8' },
    { label: 'FT · 3-4 courses', cap: '≤ 21 units', color: '#2563EB', bg: '#EBF0FF' },
    { label: 'FT · 0-2 courses', cap: '≤ 24 units', color: '#059669', bg: '#E6FAF3' },
  ]
  return (
    <div>
      <button type="button" onClick={onToggle}
        style={{ display: 'flex', alignItems: 'center', gap: 4, background: 'none', border: 'none', cursor: 'pointer', padding: 0, color: '#B0ABCC', fontSize: 11, fontFamily: "'Poppins',sans-serif", fontWeight: 500 }}>
        <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
          <circle cx="12" cy="12" r="10"/>
          <line x1="12" y1="8" x2="12" y2="12"/>
          <line x1="12" y1="16" x2="12.01" y2="16"/>
        </svg>
        Cap rules
        <svg width="9" height="9" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"
          style={{ transform: expanded ? 'rotate(180deg)' : 'none', transition: 'transform 0.18s' }}>
          <polyline points="6 9 12 15 18 9"/>
        </svg>
      </button>
      {expanded && (
        <div style={{ marginTop: 8, padding: '10px 12px', borderRadius: 10, background: '#FAFAFE', border: '1px solid #F0EDF9' }}>
          <div style={{ fontSize: 9.5, fontWeight: 700, color: '#B0ABCC', textTransform: 'uppercase', letterSpacing: '.7px', marginBottom: 8 }}>Auto Cap Rules</div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 5 }}>
            {rows.map(function(r) {
              return (
                <div key={r.label} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                  <span style={{ fontSize: 11, color: '#6a6a8a' }}>{r.label}</span>
                  <span style={{ fontSize: 10.5, fontWeight: 700, padding: '1px 8px', borderRadius: 99, background: r.bg, color: r.color }}>{r.cap}</span>
                </div>
              )
            })}
          </div>
          <div style={{ marginTop: 8, fontSize: 10, color: '#C0BBDC', lineHeight: 1.5, borderTop: '1px solid #EDE9FA', paddingTop: 7 }}>
            Cap auto-adjusts after each schedule solve based on course count.
          </div>
        </div>
      )}
    </div>
  )
}

// ─── Specs grid (extracted — avoids OXC ternary-in-JSX bug) ──────────────────
function SpecsGrid({ specs, preview, expanded, onToggle }) {
  const [sortBy, setSortBy] = useState('rating-desc')

  const sorted = useMemo(function() {
    const copy = specs.slice()
    if (sortBy === 'code-asc') {
      copy.sort(function(a, b) {
        const ac = (typeof a === 'object' ? a.courseCode : a) || ''
        const bc = (typeof b === 'object' ? b.courseCode : b) || ''
        return ac.localeCompare(bc)
      })
    } else if (sortBy === 'rating-desc') {
      copy.sort(function(a, b) {
        const ar = (typeof a === 'object' ? a.rating : 3) || 3
        const br = (typeof b === 'object' ? b.rating : 3) || 3
        return br - ar
      })
    } else if (sortBy === 'rating-asc') {
      copy.sort(function(a, b) {
        const ar = (typeof a === 'object' ? a.rating : 3) || 3
        const br = (typeof b === 'object' ? b.rating : 3) || 3
        return ar - br
      })
    }
    return copy
  }, [specs, sortBy])

  const visible   = expanded ? sorted : sorted.slice(0, preview)
  const remaining = specs.length - preview

  return (
    <div>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'flex-end', marginBottom: 8 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
          <span style={{ fontSize: 10.5, color: '#B0ABCC', fontWeight: 600 }}>Sort:</span>
          {[
            { key: 'rating-desc', label: 'Best first' },
            { key: 'code-asc',    label: 'A – Z' },
            { key: 'rating-asc',  label: 'Lowest first' },
          ].map(function(opt) {
            const isActive = sortBy === opt.key
            const bg = isActive ? '#EEEAFB' : 'transparent'
            const cl = isActive ? '#7C6FCD' : '#B0ABCC'
            const fw = isActive ? 700 : 500
            const bd = isActive ? '1px solid #D8D3F5' : '1px solid transparent'
            return (
              <button key={opt.key} type="button" onClick={function() { setSortBy(opt.key) }} style={{ padding: '2px 8px', borderRadius: 6, fontSize: 11, fontWeight: fw, background: bg, color: cl, border: bd, cursor: 'pointer', fontFamily: "'Poppins',sans-serif" }}>
                {opt.label}
              </button>
            )
          })}
        </div>
      </div>
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(168px, 1fr))', gap: 8 }}>
        {visible.map(function(spec, i) {
          const code       = (typeof spec === 'object') ? spec.courseCode : spec
          const rating     = (typeof spec === 'object') ? (spec.rating || 3) : 3
          const title      = (typeof spec === 'object') ? (spec.title || '') : ''
          const labelColor = RATING_COLORS[rating] || '#8883B0'
          const labelText  = RATING_LABELS[rating] || ''
          return (
            <div key={i} style={{
              padding: '9px 11px', borderRadius: 10,
              background: '#FAFAFE', border: '1.5px solid #EDE9FA',
              display: 'flex', flexDirection: 'column', gap: 4,
            }}>
              <span style={{ fontSize: 11.5, fontWeight: 700, color: '#5a4fbf', letterSpacing: '.2px' }}>{code}</span>
              {title ? <span style={{ fontSize: 10, color: '#8883B0', lineHeight: 1.3, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{title}</span> : null}
              <div style={{ display: 'flex', alignItems: 'center', gap: 3, marginTop: 2 }}>
                {[1,2,3,4,5].map(function(s) { return <MiniStar key={s} filled={s <= rating} /> })}
                <span style={{ fontSize: 9.5, color: labelColor, fontWeight: 700, marginLeft: 2 }}>{labelText}</span>
              </div>
            </div>
          )
        })}
      </div>
      {specs.length > preview && (
        <ExpandToggle expanded={expanded} remaining={remaining} onToggle={onToggle} />
      )}
    </div>
  )
}

// ─── Expand toggle (chevron rotation pre-computed, not in JSX) ────────────────
function ExpandToggle({ expanded, remaining, onToggle }) {
  const label = expanded ? 'Show less' : 'Show ' + remaining + ' more'
  const rot   = expanded ? 'rotate(180deg)' : 'rotate(0deg)'
  return (
    <button type="button" onClick={onToggle} style={{
      marginTop: 8, display: 'flex', alignItems: 'center', gap: 5,
      background: 'none', border: 'none', cursor: 'pointer', padding: 0,
      fontSize: 12, fontWeight: 600, color: '#7C6FCD', fontFamily: "'Poppins',sans-serif",
    }}>
      <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="#7C6FCD" strokeWidth="2.5"
        style={{ transform: rot, transition: 'transform 0.2s' }}>
        <polyline points="6 9 12 15 18 9"/>
      </svg>
      {label}
    </button>
  )
}

// ─── Delete confirm ───────────────────────────────────────────────────────────
function DeleteConfirmModal({ name, onConfirm, onCancel, deleting }) {
  const btnLabel = deleting ? 'Deleting...' : 'Yes, Permanently Delete'
  return (
    <div style={{
      position: 'fixed', inset: 0, zIndex: 1100,
      background: 'rgba(26,26,46,0.5)', backdropFilter: 'blur(4px)',
      display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 24,
    }}>
      <div style={{ background: '#fff', borderRadius: 18, padding: '28px 28px 24px', maxWidth: 400, width: '100%', boxShadow: '0 20px 60px rgba(26,26,46,0.22)', textAlign: 'center' }}>
        <div style={{ width: 52, height: 52, borderRadius: '50%', background: '#FFE8E8', margin: '0 auto 16px', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
          <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="#C0392B" strokeWidth="2">
            <polyline points="3 6 5 6 21 6"/>
            <path d="M19 6l-1 14a2 2 0 0 1-2 2H8a2 2 0 0 1-2-2L5 6"/>
            <path d="M10 11v6M14 11v6M9 6V4h6v2"/>
          </svg>
        </div>
        <div style={{ fontSize: 16, fontWeight: 700, color: '#1a1a2e', marginBottom: 8 }}>Permanently Delete Faculty Member?</div>
        <div style={{ fontSize: 13, color: '#8883B0', marginBottom: 24, lineHeight: 1.5 }}>
          This cannot be undone. <strong style={{ color: '#1a1a2e' }}>{name}</strong> and their login account will be removed forever.
          <div style={{ marginTop: 8, fontSize: 12, color: '#D97706', background: '#FEF3CD', borderRadius: 8, padding: '6px 10px', border: '1px solid #FDE68A', textAlign: 'left' }}>
            Tip: use Archive instead to hide them without losing their data.
          </div>
        </div>
        <div style={{ display: 'flex', gap: 10 }}>
          <button onClick={onCancel} style={{ flex: 1, padding: '10px', borderRadius: 9, border: '1.5px solid #E8E4F8', background: '#fff', fontSize: 13, fontWeight: 600, color: '#8883B0', cursor: 'pointer', fontFamily: "'Poppins',sans-serif" }}>Cancel</button>
          <button onClick={onConfirm} disabled={deleting} style={{ flex: 1, padding: '10px', borderRadius: 9, border: 'none', background: '#C0392B', fontSize: 13, fontWeight: 700, color: '#fff', cursor: 'pointer', fontFamily: "'Poppins',sans-serif", opacity: deleting ? 0.7 : 1 }}>
            {btnLabel}
          </button>
        </div>
      </div>
    </div>
  )
}

// ─── Form field ───────────────────────────────────────────────────────────────
function FormField({ label, required, hint, children, span }) {
  const gc = span ? ('span ' + span) : undefined
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 5, gridColumn: gc }}>
      <label style={{ fontSize: 11, fontWeight: 700, color: '#8883B0', textTransform: 'uppercase', letterSpacing: '.6px', display: 'flex', alignItems: 'center', gap: 4 }}>
        {label}
        {required && <span style={{ color: '#7C6FCD' }}>*</span>}
      </label>
      {children}
      {hint && <div style={{ fontSize: 10.5, color: '#B0ABCC', marginTop: 1 }}>{hint}</div>}
    </div>
  )
}

// ─── Section save button ──────────────────────────────────────────────────────
function SectionSaveBtn({ saving, saved, onClick, disabled }) {
  const bg  = saved ? '#E6FAF3' : '#fff'
  const cl  = saved ? '#059669' : '#7C6FCD'
  const bd  = saved ? '1.5px solid #A7F3D0' : '1.5px solid #E8E4F8'
  const lbl = saving ? 'Saving...' : (saved ? 'Saved!' : 'Save')
  const dis = saving || disabled
  return (
    <button type="button" onClick={onClick} disabled={dis} style={{
      display: 'inline-flex', alignItems: 'center', gap: 5, padding: '5px 12px', borderRadius: 8,
      border: bd, fontFamily: "'Poppins',sans-serif", fontSize: 11.5, fontWeight: 600,
      cursor: dis ? 'default' : 'pointer', background: bg, color: cl,
      transition: 'all 0.15s', flexShrink: 0, opacity: disabled ? 0.5 : 1,
    }}>
      {saving && (
        <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" style={{ animation: 'spin 0.8s linear infinite' }}>
          <path d="M21 12a9 9 0 1 1-6.219-8.56"/>
        </svg>
      )}
      {!saving && saved && (
        <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
          <polyline points="20 6 9 17 4 12"/>
        </svg>
      )}
      {!saving && !saved && (
        <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
          <path d="M19 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h11l5 5v11a2 2 0 0 1-2 2z"/>
          <polyline points="17 21 17 13 7 13 7 21"/>
          <polyline points="7 3 7 8 15 8"/>
        </svg>
      )}
      {lbl}
    </button>
  )
}

// ─── Specialization modal ─────────────────────────────────────────────────────
function SpecializationModal({ specializations, onSave, onClose, isSaving }) {
  const saving = isSaving || false
  const [specs,        setSpecs]        = useState(function() { return dedupeSpecs(specializations) })
  const [tab,          setTab]          = useState('current')
  const [sortBy,       setSortBy]       = useState('rating-desc')
  const [newCode,      setNewCode]      = useState('')
  const [newRating,    setNewRating]    = useState(3)
  const [codeError,    setCodeError]    = useState('')
  const [courseSearch, setCourseSearch] = useState('')
  const [courses,      setCourses]      = useState([])
  const [loadingCrs,   setLoadingCrs]   = useState(false)
  const [browseRating, setBrowseRating] = useState(3)

  useEffect(function() {
    setLoadingCrs(true)
    getCourses()
      .then(function(res) {
        const raw  = Array.isArray(res) ? res : (res && res.courses ? res.courses : (res && res.data ? res.data : []))
        const norm = raw.map(function(c) {
          return {
            courseCode: c.courseCode || c.course_code || c.code || c.Code || '',
            title:      c.Title || c.title || c.name || c.courseName || '',
          }
        }).filter(function(c) { return c.courseCode || c.title })
        const seen2 = new Set()
        setCourses(norm.filter(function(c) {
          const k = (c.courseCode || c.title).toLowerCase()
          if (seen2.has(k)) return false
          seen2.add(k)
          return true
        }))
      })
      .catch(function() { setCourses([]) })
      .finally(function() { setLoadingCrs(false) })
  }, [])

  const existingCodes = useMemo(function() {
    return new Set(specs.map(function(s) { return (s.courseCode || '').toLowerCase().trim() }))
  }, [specs])

  const filteredCourses = useMemo(function() {
    const q = courseSearch.toLowerCase()
    return courses
      .filter(function(c) { return c.courseCode.toLowerCase().includes(q) || c.title.toLowerCase().includes(q) })
      .sort(function(a, b) {
        const aA = existingCodes.has(a.courseCode.toLowerCase())
        const bA = existingCodes.has(b.courseCode.toLowerCase())
        if (aA && !bA) return 1
        if (!aA && bA) return -1
        return a.courseCode.localeCompare(b.courseCode)
      })
  }, [courses, courseSearch, existingCodes])

  function handleAddManual() {
    const code = newCode.trim().toUpperCase()
    if (!code) { setCodeError('Enter a course code'); return }
    if (existingCodes.has(code.toLowerCase())) { setCodeError('Already added'); return }
    setSpecs(function(prev) { return prev.concat([{ courseCode: code, rating: newRating }]) })
    setNewCode(''); setNewRating(3); setCodeError('')
  }
  function handleAddFromCourse(course) {
    const code = (course.courseCode || course.title).trim()
    if (existingCodes.has(code.toLowerCase())) return
    setSpecs(function(prev) { return prev.concat([{ courseCode: code, title: course.title || '', rating: browseRating }]) })
  }
  function handleRemove(idx) { setSpecs(function(prev) { return prev.filter(function(_, i) { return i !== idx }) }) }
  function updateRating(idx, r) { setSpecs(function(prev) { return prev.map(function(s, i) { return i === idx ? Object.assign({}, s, { rating: r }) : s }) }) }

  // Build a quick code→title lookup from fetched courses
  const courseTitleMap = useMemo(function() {
    const map = {}
    courses.forEach(function(c) {
      if (c.courseCode) map[c.courseCode.toLowerCase().trim()] = c.title || ''
    })
    return map
  }, [courses])

  // Sorted view of current specs
  const sortedSpecs = useMemo(function() {
    const copy = specs.slice()
    if (sortBy === 'code-asc') {
      copy.sort(function(a, b) { return (a.courseCode || '').localeCompare(b.courseCode || '') })
    } else if (sortBy === 'rating-desc') {
      copy.sort(function(a, b) { return (b.rating || 3) - (a.rating || 3) })
    } else if (sortBy === 'rating-asc') {
      copy.sort(function(a, b) { return (a.rating || 3) - (b.rating || 3) })
    }
    return copy
  }, [specs, sortBy])

  const specCount      = specs.length
  const specCountLabel = specCount === 1 ? '1 specialization' : specCount + ' specializations'
  const saveLabel      = specCount > 0 ? 'Save (' + specCount + ')' : 'Save'

  function tabBtn(key, label) {
    const active = tab === key
    const bg     = active ? 'linear-gradient(135deg,#7C6FCD,#5a4fbf)' : '#F5F4FB'
    const cl     = active ? '#fff' : '#8883B0'
    const bd     = active ? 'none' : '1.5px solid #E8E4F8'
    return (
      <button key={key} onClick={function() { setTab(key) }} style={{
        padding: '6px 14px', borderRadius: 8, fontSize: 12.5, fontWeight: 600, cursor: 'pointer',
        fontFamily: "'Poppins',sans-serif", border: bd, background: bg, color: cl,
      }}>{label}</button>
    )
  }

  return (
    <div style={{ position: 'fixed', inset: 0, zIndex: 1000, background: 'rgba(26,26,46,0.45)', backdropFilter: 'blur(4px)', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '24px 16px' }}>
      <div style={{ background: '#fff', borderRadius: 20, width: '100%', maxWidth: 580, boxShadow: '0 24px 64px rgba(26,26,46,0.22)', overflow: 'hidden', display: 'flex', flexDirection: 'column', maxHeight: '88vh' }}>

        {/* Header */}
        <div style={{ padding: '20px 24px 14px', borderBottom: '1px solid #F0EDF9' }}>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 12 }}>
            <div>
              <div style={{ fontSize: 16, fontWeight: 700, color: '#1a1a2e' }}>Specializations</div>
              <div style={{ fontSize: 12, color: '#8883B0', marginTop: 2 }}>Manage courses and proficiency levels</div>
            </div>
            <button onClick={onClose} style={{ width: 32, height: 32, borderRadius: 8, border: '1px solid #E8E4F8', background: '#F5F4FB', display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer', padding: 0 }}>
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="#8883B0" strokeWidth="2.5">
                <line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/>
              </svg>
            </button>
          </div>
          <div style={{ display: 'flex', gap: 8 }}>
            {tabBtn('current', 'Current (' + specCount + ')')}
            {tabBtn('browse',  'Browse Courses')}
            {tabBtn('manual',  'Add Manual')}
          </div>
        </div>

        {/* Body */}
        <div style={{ flex: 1, overflowY: 'auto', padding: '16px 24px' }}>

          {/* Current tab */}
          {tab === 'current' && specs.length === 0 && (
            <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', padding: '36px 0', gap: 10 }}>
              <div style={{ width: 44, height: 44, borderRadius: 12, background: '#EEEAFB', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="#7C6FCD" strokeWidth="1.8">
                  <path d="M4 19.5A2.5 2.5 0 0 1 6.5 17H20"/>
                  <path d="M6.5 2H20v20H6.5A2.5 2.5 0 0 1 4 19.5v-15A2.5 2.5 0 0 1 6.5 2z"/>
                </svg>
              </div>
              <div style={{ textAlign: 'center' }}>
                <div style={{ fontSize: 13, fontWeight: 600, color: '#1a1a2e', marginBottom: 3 }}>No specializations yet</div>
                <div style={{ fontSize: 11.5, color: '#B0ABCC' }}>Use Browse or Add Manual to get started</div>
              </div>
            </div>
          )}

          {tab === 'current' && specs.length > 0 && (
            <div>
              {/* Sort bar */}
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 10 }}>
                <span style={{ fontSize: 11, color: '#B0ABCC' }}>{specCount === 1 ? '1 course' : specCount + ' courses'}</span>
                <div style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
                  <span style={{ fontSize: 10.5, color: '#C4BFDF', fontWeight: 600 }}>Sort:</span>
                  {[
                    { key: 'rating-desc', label: 'Best first' },
                    { key: 'code-asc',    label: 'A – Z' },
                    { key: 'rating-asc',  label: 'Lowest' },
                  ].map(function(opt) {
                    const isAct = sortBy === opt.key
                    const obg   = isAct ? '#EEEAFB' : 'transparent'
                    const ocl   = isAct ? '#7C6FCD' : '#C4BFDF'
                    const ofw   = isAct ? 700 : 500
                    const obd   = isAct ? '1px solid #D8D3F5' : '1px solid transparent'
                    return (
                      <button key={opt.key} type="button" onClick={function() { setSortBy(opt.key) }}
                        style={{ padding: '2px 8px', borderRadius: 6, fontSize: 11, fontWeight: ofw, background: obg, color: ocl, border: obd, cursor: 'pointer', fontFamily: "'Poppins',sans-serif" }}>
                        {opt.label}
                      </button>
                    )
                  })}
                </div>
              </div>
              {/* Rows */}
              <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
                {sortedSpecs.map(function(spec, idx) {
                  const originalIdx = specs.indexOf(spec)
                  const rc    = RATING_COLORS[spec.rating] || '#8883B0'
                  const rl    = RATING_LABELS[spec.rating] || ''
                  const rbg   = spec.rating >= 4 ? '#E6FAF3' : (spec.rating >= 3 ? '#EEEAFB' : '#FEF3CD')
                  const title = spec.title || courseTitleMap[(spec.courseCode || '').toLowerCase().trim()] || ''
                  return (
                    <div key={idx} style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '10px 12px', borderRadius: 10, border: '1px solid #EDE9FA', background: '#FDFCFF' }}>
                      {/* Left: code + title + stars */}
                      <div style={{ flex: 1, minWidth: 0, display: 'flex', flexDirection: 'column', gap: 3 }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: 7 }}>
                          <span style={{ padding: '1px 8px', borderRadius: 99, fontSize: 10.5, fontWeight: 700, background: '#EEEAFB', color: '#7C6FCD', border: '1px solid #D8D3F5', whiteSpace: 'nowrap', flexShrink: 0 }}>
                            {spec.courseCode}
                          </span>
                          {title ? (
                            <span style={{ fontSize: 11.5, color: '#4a4a6a', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', fontWeight: 500 }}>{title}</span>
                          ) : null}
                        </div>
                        <StarRating value={spec.rating} onChange={function(r) { updateRating(originalIdx, r) }} />
                      </div>
                      {/* Badge */}
                      <span style={{ fontSize: 10, fontWeight: 700, padding: '2px 7px', borderRadius: 99, flexShrink: 0, background: rbg, color: rc, whiteSpace: 'nowrap' }}>{rl}</span>
                      {/* Remove */}
                      <button onClick={function() { handleRemove(originalIdx) }} style={{ width: 26, height: 26, borderRadius: 7, border: '1px solid #FFD0D0', background: '#FFF5F5', color: '#C0392B', flexShrink: 0, display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer', padding: 0 }}>
                        <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
                          <line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/>
                        </svg>
                      </button>
                    </div>
                  )
                })}
              </div>
            </div>
          )}

          {/* Browse tab */}
          {tab === 'browse' && (
            <div>
              <div style={{ display: 'flex', gap: 10, marginBottom: 14, flexWrap: 'wrap' }}>
                <div style={{ position: 'relative', flex: '1 1 200px' }}>
                  <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="#B0ABCC" strokeWidth="2"
                    style={{ position: 'absolute', left: 10, top: '50%', transform: 'translateY(-50%)', pointerEvents: 'none' }}>
                    <circle cx="11" cy="11" r="8"/><line x1="21" y1="21" x2="16.65" y2="16.65"/>
                  </svg>
                  <input placeholder="Search by code or title..." value={courseSearch}
                    onChange={function(e) { setCourseSearch(e.target.value) }} autoFocus
                    style={{ width: '100%', paddingLeft: 32, paddingRight: 10, height: 36, borderRadius: 8, border: '1.5px solid #E8E4F8', fontSize: 12.5, fontFamily: "'Poppins',sans-serif", background: '#FAFAFE', outline: 'none', boxSizing: 'border-box' }} />
                </div>
                <div style={{ display: 'flex', alignItems: 'center', gap: 8, background: '#F5F4FB', borderRadius: 8, padding: '6px 12px', border: '1.5px solid #E8E4F8' }}>
                  <span style={{ fontSize: 11, color: '#8883B0', fontWeight: 600, whiteSpace: 'nowrap' }}>Rating:</span>
                  <StarRating value={browseRating} onChange={setBrowseRating} size={16} />
                </div>
              </div>
              {loadingCrs ? (
                <div style={{ display: 'flex', alignItems: 'center', gap: 8, color: '#8883B0', fontSize: 13, padding: '24px 0' }}>
                  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="#A99BE8" strokeWidth="2" style={{ animation: 'spin 1s linear infinite' }}>
                    <path d="M21 12a9 9 0 1 1-6.219-8.56"/>
                  </svg>
                  Loading courses...
                </div>
              ) : (
                <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
                  {filteredCourses.length === 0 && (
                    <div style={{ textAlign: 'center', padding: '28px 0', color: '#C0BBDC', fontSize: 13 }}>No courses found</div>
                  )}
                  {filteredCourses.map(function(course, i) {
                    const code    = course.courseCode || course.title
                    const isAdded = existingCodes.has(code.toLowerCase().trim())
                    const rowBg   = isAdded ? '#FAFAFE' : '#fff'
                    const btnBg   = isAdded ? '#E6FAF3' : 'linear-gradient(135deg,#7C6FCD,#5a4fbf)'
                    const btnCl   = isAdded ? '#059669' : '#fff'
                    const btnLbl  = isAdded ? 'Added' : 'Add'
                    return (
                      <div key={i} style={{ display: 'flex', alignItems: 'center', gap: 12, padding: '10px 14px', borderRadius: 10, border: '1.5px solid #E8E4F8', background: rowBg, opacity: isAdded ? 0.6 : 1 }}>
                        <span style={{ padding: '2px 9px', borderRadius: 99, fontSize: 10.5, fontWeight: 700, background: '#EEEAFB', color: '#7C6FCD', border: '1px solid #D8D3F5', whiteSpace: 'nowrap' }}>{code}</span>
                        {course.title && code !== course.title && (
                          <span style={{ flex: 1, fontSize: 12, color: '#4a4a6a', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{course.title}</span>
                        )}
                        <button onClick={function() { if (!isAdded) handleAddFromCourse(course) }} disabled={isAdded} style={{ padding: '5px 12px', borderRadius: 8, fontSize: 11.5, fontWeight: 600, border: 'none', cursor: isAdded ? 'default' : 'pointer', background: btnBg, color: btnCl, fontFamily: "'Poppins',sans-serif", flexShrink: 0 }}>
                          {btnLbl}
                        </button>
                      </div>
                    )
                  })}
                </div>
              )}
            </div>
          )}

          {/* Manual tab */}
          {tab === 'manual' && (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
              <div style={{ fontSize: 12, color: '#8883B0', lineHeight: 1.5 }}>
                Enter a course code manually for courses not yet in the system.
              </div>
              <div>
                <label style={{ fontSize: 11, fontWeight: 700, color: '#8883B0', textTransform: 'uppercase', letterSpacing: '.6px', display: 'block', marginBottom: 6 }}>Course Code</label>
                <input placeholder="e.g. IT101" value={newCode}
                  onChange={function(e) { setNewCode(e.target.value); setCodeError('') }}
                  onKeyDown={function(e) { if (e.key === 'Enter') handleAddManual() }}
                  autoFocus
                  style={{ width: '100%', padding: '9px 12px', borderRadius: 8, boxSizing: 'border-box', border: codeError ? '1.5px solid #E74C3C' : '1.5px solid #E8E4F8', fontSize: 13, fontFamily: "'Poppins',sans-serif", textTransform: 'uppercase', outline: 'none' }} />
                {codeError && <div style={{ fontSize: 11, color: '#E74C3C', marginTop: 4 }}>{codeError}</div>}
              </div>
              <div>
                <label style={{ fontSize: 11, fontWeight: 700, color: '#8883B0', textTransform: 'uppercase', letterSpacing: '.6px', display: 'block', marginBottom: 8 }}>Proficiency</label>
                <StarRating value={newRating} onChange={setNewRating} />
              </div>
              <button onClick={handleAddManual} style={{ alignSelf: 'flex-start', padding: '9px 20px', borderRadius: 9, fontSize: 13, fontWeight: 600, background: 'linear-gradient(135deg,#7C6FCD,#5a4fbf)', color: '#fff', border: 'none', cursor: 'pointer', fontFamily: "'Poppins',sans-serif", boxShadow: '0 3px 12px rgba(124,111,205,0.35)', display: 'flex', alignItems: 'center', gap: 6 }}>
                <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
                  <line x1="12" y1="5" x2="12" y2="19"/><line x1="5" y1="12" x2="19" y2="12"/>
                </svg>
                Add
              </button>
            </div>
          )}
        </div>

        {/* Footer */}
        <div style={{ padding: '14px 24px', borderTop: '1px solid #F0EDF9', display: 'flex', gap: 10, justifyContent: 'space-between', alignItems: 'center' }}>
          <span style={{ fontSize: 12, color: '#B0ABCC' }}>{specCountLabel}</span>
          <div style={{ display: 'flex', gap: 10 }}>
            <button onClick={onClose} style={{ padding: '8px 20px', borderRadius: 8, fontSize: 13, fontWeight: 500, border: '1.5px solid #E8E4F8', background: '#fff', color: '#8883B0', cursor: 'pointer', fontFamily: "'Poppins',sans-serif" }}>Cancel</button>
            <button onClick={function() { onSave(specs) }} disabled={saving} style={{ padding: '8px 24px', borderRadius: 8, fontSize: 13, fontWeight: 600, background: 'linear-gradient(135deg,#7C6FCD,#5a4fbf)', color: '#fff', border: 'none', cursor: saving ? 'default' : 'pointer', fontFamily: "'Poppins',sans-serif", boxShadow: '0 3px 12px rgba(124,111,205,0.35)', opacity: saving ? 0.7 : 1 }}>
              {saving ? 'Saving...' : saveLabel}
            </button>
          </div>
        </div>
      </div>
    </div>
  )
}

// ─── Schedule section ─────────────────────────────────────────────────────────
function ScheduleSection({ facultyName, onUnitsLoaded, onAssignmentsLoaded }) {
  const { scheduleName, events: storeEvents } = useScheduleStore()

  const [scheduleNames,    setScheduleNames]    = useState([])
  const [selectedSchedule, setSelectedSchedule] = useState('__current__')
  const [allEvents,        setAllEvents]        = useState([])
  const [listLoading,      setListLoading]      = useState(true)
  const [eventsLoading,    setEventsLoading]    = useState(false)
  const [fetchError,       setFetchError]       = useState(false)

  useEffect(function() {
    listSaved()
      .then(function(names) {
        const arr = Array.isArray(names) ? names : []
        setScheduleNames(arr)
      })
      .catch(function() { setFetchError(true) })
      .finally(function() { setListLoading(false) })
  }, [])

  useEffect(function() {
    if (!selectedSchedule) return

    if (selectedSchedule === '__current__') {
      const raw = storeEvents || []
      const filtered = facultyName
        ? raw.filter(function(e) { return (e.faculty || '').toLowerCase() === facultyName.toLowerCase() })
        : raw
      setAllEvents(filtered)
      setEventsLoading(false)
      return
    }

    setEventsLoading(true)
    setFetchError(false)
    loadSaved(selectedSchedule)
      .then(function(data) {
        // Handle different possible payload structures from the API
        const raw = Array.isArray(data.schedule) ? data.schedule : (Array.isArray(data.events) ? data.events : [])
        const filtered = facultyName
          ? raw.filter(function(e) { return (e.faculty || '').toLowerCase() === facultyName.toLowerCase() })
          : raw
        setAllEvents(filtered)
      })
      .catch(function() { setFetchError(true) })
      .finally(function() { setEventsLoading(false) })
  }, [selectedSchedule, facultyName, storeEvents])

  function computeUnits(event) {
    if (event.units != null) return event.units
    if (event.period) {
      const m = event.period.match(/(\d+):(\d+)\s*-\s*(\d+):(\d+)/)
      if (m) {
        const start = parseInt(m[1]) * 60 + parseInt(m[2])
        const end   = parseInt(m[3]) * 60 + parseInt(m[4])
        return Math.round((end - start) / 60)
      }
    }
    return 0
  }

  const totalUnits = useMemo(function() {
    return allEvents.map(computeUnits).filter(function(u) { return typeof u === 'number' }).reduce(function(s, u) { return s + u }, 0)
  }, [allEvents])

  // Distinct assigned courses — used by parent for the correct unit cap tier
  const distinctCourseCount = useMemo(function() {
    const codes = new Set()
    allEvents.forEach(function(e) {
      const code = e.courseCode || e.course_code || e.subject || e.course || ''
      if (code) codes.add(code.trim().toLowerCase())
    })
    // fall back to raw event count if no recognisable course code field
    return codes.size > 0 ? codes.size : allEvents.length
  }, [allEvents])

  useEffect(function() {
    if (onUnitsLoaded) onUnitsLoaded(totalUnits)
  }, [totalUnits])

  useEffect(function() {
    if (onAssignmentsLoaded) onAssignmentsLoaded(distinctCourseCount)
  }, [distinctCourseCount])

  const loading    = listLoading || eventsLoading
  const classCount = allEvents.length
  const classLbl   = classCount === 1 ? '1 class' : classCount + ' classes'
  const loadLbl    = listLoading ? 'Loading schedules...' : 'Loading events...'

  return (
    <div style={{ background: '#fff', borderRadius: 16, border: '1px solid #E8E4F8', overflow: 'hidden', boxShadow: '0 2px 10px rgba(124,111,205,0.06)' }}>
      <div style={{ padding: '12px 20px', borderBottom: '1px solid #F0EDF9', display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 12 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
          <span style={{ fontSize: 13, fontWeight: 700, color: '#1a1a2e' }}>Schedule</span>
          {!loading && !fetchError && selectedSchedule && (
            <span style={{ fontSize: 11.5, color: '#B0ABCC' }}>
              · {classLbl}{totalUnits > 0 ? ` · ${totalUnits} units` : ''}
            </span>
          )}
        </div>
        <select value={selectedSchedule} onChange={function(e) { setSelectedSchedule(e.target.value) }}
          style={{ padding: '5px 10px', borderRadius: 8, border: '1px solid #E8E4F8', fontSize: 11.5, fontFamily: "'Poppins',sans-serif", background: '#FAFAFE', color: '#4a4a6a', cursor: 'pointer', outline: 'none' }}>
          <option value="__current__">
            {scheduleName ? `Current (${scheduleName})` : 'Current (in memory)'}
          </option>
          {scheduleNames.map(function(n) { return <option key={n} value={n}>{n}</option> })}
        </select>
      </div>
      <div style={{ padding: loading ? '24px 20px' : 0 }}>
        {loading ? (
          <div style={{ display: 'flex', alignItems: 'center', gap: 8, color: '#B0ABCC', fontSize: 12.5 }}>
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="#C4BFDF" strokeWidth="2" style={{ animation: 'spin 1s linear infinite' }}>
              <path d="M21 12a9 9 0 1 1-6.219-8.56"/>
            </svg>
            {loadLbl}
          </div>
        ) : allEvents.length === 0 ? (
          <div style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '20px', color: '#B0ABCC' }}>
            <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="#D8D3F5" strokeWidth="1.8">
              <rect x="3" y="4" width="18" height="18" rx="2"/>
              <line x1="16" y1="2" x2="16" y2="6"/>
              <line x1="8" y1="2" x2="8" y2="6"/>
              <line x1="3" y1="10" x2="21" y2="10"/>
            </svg>
            <span style={{ fontSize: 12.5 }}>No classes in the selected schedule.</span>
          </div>
        ) : (
          <FacultyEventsTable events={allEvents} computeUnits={computeUnits} fetchError={fetchError} />
        )}
      </div>
    </div>
  )
}

// ─── Main ─────────────────────────────────────────────────────────────────────
export default function FacultyDetailPage() {
  const { id }   = useParams()
  const isNew    = id === 'new'
  const navigate = useNavigate()

  const { toasts, toast } = useToast()

  const [form,            setForm]            = useState(empty)
  const [password,        setPassword]        = useState('')
  const [showPassword,    setShowPassword]    = useState(false)
  const [deleting,        setDeleting]        = useState(false)
  const [archiving,       setArchiving]       = useState(false)
  const [showArchiveModal, setShowArchiveModal] = useState(false)
  const [createdPassword, setCreatedPassword] = useState('')
  const [passwordCopied,  setPasswordCopied]  = useState(false)
  const [showSpecModal,   setShowSpecModal]   = useState(false)
  const [showDeleteModal, setShowDeleteModal] = useState(false)
  const [specsExpanded,   setSpecsExpanded]   = useState(false)
  const [scheduleUnits,       setScheduleUnits]       = useState(null)
  const [scheduleAssignments, setScheduleAssignments] = useState(null)
  const [capInfoOpen,         setCapInfoOpen]         = useState(false)
  const [infoSaving,      setInfoSaving]      = useState(false)
  const [infoSaved,       setInfoSaved]       = useState(false)
  const [infoError,       setInfoError]       = useState('')
  const [prefSaving,      setPrefSaving]      = useState(false)
  const [prefSaved,       setPrefSaved]       = useState(false)
  const [prefError,       setPrefError]       = useState('')
  const [specSaving,      setSpecSaving]      = useState(false)
  const [createSaving,    setCreateSaving]    = useState(false)
  const [createError,     setCreateError]     = useState('')
  const [savedInfo,       setSavedInfo]       = useState(null)
  const [savedPrefs,      setSavedPrefs]      = useState(null)
  const [credEmail,     setCredEmail]     = useState('')
  const [credPassword,  setCredPassword]  = useState('')
  const [credConfirm,   setCredConfirm]   = useState('')
  const [showCredPwd,   setShowCredPwd]   = useState(false)
  const [credSaving,    setCredSaving]    = useState(false)
  const [credError,     setCredError]     = useState('')
  const [credSuccess,   setCredSuccess]   = useState('')
  const [credActivated, setCredActivated] = useState(null)
  const [pwCopied,      setPwCopied]      = useState(false)
  const [pageLoading,   setPageLoading]   = useState(!isNew)

  useEffect(function() {
    if (isNew) return

    // getFaculty() returns only active faculty now.
    // If the user navigates directly to an archived member's URL (via bookmark
    // or the archived tab link), the id won't be found in the active list.
    // Fall back to getArchivedFaculty() in that case so the page still loads.
    getFaculty()
      .then(function(list) {
        const found = list.find(function(f) { return f.id === id })
        if (found) return found
        return getArchivedFaculty().then(function(all) {
          return all.find(function(f) { return f.id === id }) || null
        })
      })
      .then(function(found) {
        if (found) {
          const deduped = dedupeSpecs(found.specializations || [])
          const data    = Object.assign({}, empty, found, { specializations: deduped })
          setForm(data)
          setCredEmail(data.email || '')
          setSavedInfo({ name: data.name, status: data.status, AcademicRank: data.AcademicRank, Department: data.Department, Educational_attainment: data.Educational_attainment, Sex: data.Sex })
          setSavedPrefs({ preferredDays: (data.preferredDays || []).slice(), preferredTimeStart: data.preferredTimeStart, preferredTimeEnd: data.preferredTimeEnd })
        }
      })
      .finally(function() { setPageLoading(false) })
  }, [id])

  // Derived
  const uniqueSpecs   = useMemo(function() { return dedupeSpecs(form.specializations) }, [form.specializations])
  const specCount     = uniqueSpecs.length
  // Cap is based on how many courses are actually assigned in the schedule (mirrors unit_balancing.py),
  // not on the number of specializations. Default to 0 until schedule data arrives → 24 unit cap.
  const assignedCount = scheduleAssignments !== null ? scheduleAssignments : 0
  const effectiveCap  = getEffectiveMaxUnits(form.status, assignedCount)
  const tierLabel     = getTierLabel(form.status, assignedCount)
  const displayUnits  = scheduleUnits !== null ? scheduleUnits : (form.units || 0)
  const isOverloaded  = displayUnits > effectiveCap
  const loadPct       = Math.min(100, (displayUnits / effectiveCap) * 100)
  const specCntLabel  = specCount === 1 ? '1 course' : (specCount > 0 ? specCount + ' courses' : 'None added')

  // Pre-compute style values (no ternaries in JSX)
  const statusBg  = form.status === 'full-time' ? '#E6FAF3' : '#F5F4FB'
  const statusCl  = form.status === 'full-time' ? '#059669' : '#8883B0'
  const unitBd    = isOverloaded ? '1.5px solid #FFCCCC' : '1.5px solid #E8E4F8'
  const unitBg    = isOverloaded ? '#FFF8F8' : '#FAFAFE'
  const unitNumCl = isOverloaded ? '#C0392B' : '#1a1a2e'
  const barBg     = isOverloaded ? 'linear-gradient(90deg,#E74C3C,#C0392B)' : (loadPct > 80 ? 'linear-gradient(90deg,#D97706,#F59E0B)' : 'linear-gradient(90deg,#7C6FCD,#5a4fbf)')
  const unitCapLbl = 'Cap: ' + effectiveCap
  const unitFrac   = '/ ' + effectiveCap + ' units'

  const infoChanged = savedInfo != null && ['name','status','AcademicRank','Department','Educational_attainment','Sex'].some(function(k) { return form[k] !== savedInfo[k] })
  const prefsChanged = savedPrefs != null && (
    form.preferredTimeStart !== savedPrefs.preferredTimeStart ||
    form.preferredTimeEnd   !== savedPrefs.preferredTimeEnd   ||
    JSON.stringify((form.preferredDays || []).slice().sort()) !== JSON.stringify((savedPrefs.preferredDays || []).slice().sort())
  )

  async function handleSaveInfo() {
    setInfoError(''); setInfoSaving(true)
    try {
      const { name, status, AcademicRank, Department, Educational_attainment, Sex } = form
      await updateFaculty(id, { name, status, AcademicRank, Department, Educational_attainment, Sex })
      setSavedInfo({ name, status, AcademicRank, Department, Educational_attainment, Sex })
      setInfoSaved(true); setTimeout(function() { setInfoSaved(false) }, 2500)
    } catch (err) {
      setInfoError((err.response && err.response.data && err.response.data.detail) || 'Save failed.')
    } finally { setInfoSaving(false) }
  }

  async function handleSavePrefs() {
    setPrefError(''); setPrefSaving(true)
    try {
      const { preferredDays, preferredTimeStart, preferredTimeEnd } = form
      await updateFaculty(id, { preferredDays, preferredTimeStart, preferredTimeEnd })
      setSavedPrefs({ preferredDays: (preferredDays || []).slice(), preferredTimeStart, preferredTimeEnd })
      setPrefSaved(true); setTimeout(function() { setPrefSaved(false) }, 2500)
    } catch (err) {
      setPrefError((err.response && err.response.data && err.response.data.detail) || 'Save failed.')
    } finally { setPrefSaving(false) }
  }

  function genPassword() {
  const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZabcdefghjkmnpqrstuvwxyz23456789'
  return Array.from({ length: 10 }, function() {
    return chars[Math.floor(Math.random() * chars.length)]
  }).join('')
}

async function handleSaveCredentials() {
  setCredError('')
  if (!credEmail.trim()) { setCredError('Email address is required.'); return }
  if (credPassword && credPassword.length < 6) { setCredError('Password must be at least 6 characters.'); return }
  if (credPassword && credPassword !== credConfirm) { setCredError('Passwords do not match.'); return }
  setCredSaving(true)
  try {
    const result = await updateCredentials(id, {
      email:    credEmail.trim(),
      password: credPassword || undefined,
    })
    if (result.migrated) {
      // Doc ID changed — show activation success screen with new ID + temp password
      setCredActivated({ newId: result.new_id, tempPassword: result.temp_password })
    } else {
      setForm(function(f) { return Object.assign({}, f, { email: credEmail.trim() }) })
      setSavedInfo(function(s) { return s ? Object.assign({}, s, { email: credEmail.trim() }) : s })
      setCredPassword(''); setCredConfirm('')
      setCredSuccess(credPassword ? 'Email and password updated.' : 'Email updated.')
      setTimeout(function() { setCredSuccess('') }, 3000)
    }
  } catch (err) {
    setCredError((err.response && err.response.data && err.response.data.detail) || 'Failed to update credentials.')
  } finally { setCredSaving(false) }
}

  async function handleSaveSpecs(specs) {
    setSpecSaving(true)
    try {
      const cleaned = dedupeSpecs(specs).filter(function(s) { return s.courseCode && s.courseCode.trim() })
      await updateFaculty(id, { specializations: cleaned })
      setForm(function(f) { return Object.assign({}, f, { specializations: cleaned }) })
      setShowSpecModal(false)
      toast('Specializations saved successfully.', 'success')
    } catch (err) {
      alert((err.response && err.response.data && err.response.data.detail) || 'Failed to save specializations.')
    } finally { setSpecSaving(false) }
  }

  async function handleCreate(e) {
    e.preventDefault(); setCreateError(''); setCreateSaving(true)
    try {
      const cleaned = dedupeSpecs(form.specializations)
      if (!form.email) { setCreateError('Email is required.'); setCreateSaving(false); return }
      const lastName = (form.name || '').trim().split(/\s+/).pop() || 'faculty'
      const defaultPassword = lastName + 'GC2026'
      const result = await addFaculty(Object.assign({}, form, { specializations: cleaned, initial_password: password || defaultPassword }))
      setCreatedPassword(result.temp_password || password || defaultPassword)
    } catch (err) {
      setCreateError((err.response && err.response.data && err.response.data.detail) || 'Create failed.')
    } finally { setCreateSaving(false) }
  }

  function toggleDay(day) {
    setForm(function(f) {
      const days = f.preferredDays.includes(day) ? f.preferredDays.filter(function(d) { return d !== day }) : f.preferredDays.concat([day])
      return Object.assign({}, f, { preferredDays: days })
    })
  }

  async function handleDelete() {
    setDeleting(true)
    try {
      await deleteFaculty(id)
      toast('Faculty member deleted.', 'error')
      setTimeout(function() { navigate('/dashboard/faculty') }, 800)
    }
    catch { setDeleting(false) }
  }

  async function handleArchive() {
    setArchiving(true)
    try {
      await archiveFaculty(id)
      setForm(f => Object.assign({}, f, { archived: true }))
      setShowArchiveModal(false)
      toast('Faculty member archived.', 'info')
    } catch { /* leave modal open */ }
    finally { setArchiving(false) }
  }

  async function handleUnarchive() {
    setArchiving(true)
    try {
      await unarchiveFaculty(id)
      setForm(f => Object.assign({}, f, { archived: false }))
      toast('Faculty member restored successfully.', 'success')
    } catch { /* silently fail */ }
    finally { setArchiving(false) }
  }

// ── Activation success screen (bulk-import → new account created) ──────────
if (credActivated) {
  const copyBg  = pwCopied ? '#E6FAF3' : '#fff'
  const copyCl  = pwCopied ? '#059669' : '#7C6FCD'
  const copyLbl = pwCopied ? 'Copied!' : 'Copy'
  return (
    <div style={{ padding: '28px 32px', fontFamily: "'Poppins',sans-serif", maxWidth: 560 }}>
      <style>{`@keyframes spin { to { transform: rotate(360deg) } }`}</style>
      <div style={{ background: '#fff', borderRadius: 18, border: '1px solid #E8E4F8', overflow: 'hidden', boxShadow: '0 4px 20px rgba(124,111,205,0.1)' }}>
        <div style={{ padding: '24px 28px', borderBottom: '1px solid #F0EDF9', display: 'flex', gap: 14, alignItems: 'center' }}>
          <div style={{ width: 44, height: 44, borderRadius: '50%', background: '#E6FAF3', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="#059669" strokeWidth="2.5"><polyline points="20 6 9 17 4 12"/></svg>
          </div>
          <div>
            <div style={{ fontSize: 15, fontWeight: 700, color: '#059669' }}>Account activated</div>
            <div style={{ fontSize: 12, color: '#8883B0', marginTop: 2 }}>Firebase Auth account created and profile migrated.</div>
          </div>
        </div>
        <div style={{ padding: '24px 28px' }}>
          {credActivated.tempPassword ? (
            <>
              <div style={{ fontSize: 11, fontWeight: 700, color: '#8883B0', textTransform: 'uppercase', letterSpacing: '.6px', marginBottom: 10 }}>Auto-generated Password</div>
              <div style={{ display: 'flex', gap: 10, marginBottom: 14 }}>
                <code style={{ flex: 1, padding: '12px 16px', background: '#F5F4FB', borderRadius: 10, border: '1.5px solid #E8E4F8', fontSize: 15, fontFamily: 'monospace', letterSpacing: 2, color: '#1a1a2e' }}>{credActivated.tempPassword}</code>
                <button type="button" onClick={function() { navigator.clipboard.writeText(credActivated.tempPassword); setPwCopied(true); setTimeout(function() { setPwCopied(false) }, 2000) }}
                  style={{ padding: '12px 16px', borderRadius: 10, border: '1.5px solid #E8E4F8', background: copyBg, color: copyCl, fontSize: 12.5, fontWeight: 600, cursor: 'pointer', fontFamily: "'Poppins',sans-serif", whiteSpace: 'nowrap' }}>
                  {copyLbl}
                </button>
              </div>
            </>
          ) : (
            <div style={{ marginBottom: 14, fontSize: 12.5, color: '#4a4a6a' }}>Credentials saved. The faculty member can now log in with the password you set.</div>
          )}
          <div style={{ fontSize: 11.5, color: '#B0ABCC', background: '#FAFAFE', borderRadius: 8, padding: '10px 14px', border: '1px solid #F0EDF9', marginBottom: 22 }}>
            The faculty member must log out and back in for their role to take effect.
          </div>
          <button type="button" onClick={function() { const dest = credActivated.newId || id; setCredActivated(null); navigate('/dashboard/faculty/' + dest) }}
            style={{ padding: '9px 18px', borderRadius: 9, border: 'none', background: 'linear-gradient(135deg,#7C6FCD,#5a4fbf)', color: '#fff', fontSize: 13, fontWeight: 600, cursor: 'pointer', fontFamily: "'Poppins',sans-serif" }}>
            Continue to Profile
          </button>
        </div>
      </div>
    </div>
  )
}

  // ── Success screen ──────────────────────────────────────────────────────────
  if (createdPassword) {
    const cpBg = passwordCopied ? '#E6FAF3' : '#fff'
    const cpCl = passwordCopied ? '#059669' : '#7C6FCD'
    const cpLbl = passwordCopied ? 'Copied!' : 'Copy'
    return (
      <div style={{ padding: '28px 32px', fontFamily: "'Poppins',sans-serif", maxWidth: 560 }}>
        <style>{`@keyframes spin { to { transform: rotate(360deg) } }`}</style>
        <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 22 }}>
          <button onClick={function() { navigate('/dashboard/faculty') }} style={{ background: 'none', border: 'none', color: '#8883B0', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 5, fontSize: 12.5, fontFamily: "'Poppins',sans-serif", padding: 0 }}>
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><line x1="19" y1="12" x2="5" y2="12"/><polyline points="12 19 5 12 12 5"/></svg>
            Faculty
          </button>
          <span style={{ fontSize: 12.5, color: '#1a1a2e', fontWeight: 600 }}>Account Created</span>
        </div>
        <div style={{ background: '#fff', borderRadius: 18, border: '1px solid #E8E4F8', overflow: 'hidden', boxShadow: '0 4px 20px rgba(124,111,205,0.1)' }}>
          <div style={{ padding: '24px 28px', borderBottom: '1px solid #F0EDF9', display: 'flex', gap: 14, alignItems: 'center' }}>
            <div style={{ width: 44, height: 44, borderRadius: '50%', background: '#E6FAF3', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
              <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="#059669" strokeWidth="2.5"><polyline points="20 6 9 17 4 12"/></svg>
            </div>
            <div>
              <div style={{ fontSize: 15, fontWeight: 700, color: '#059669' }}>Account created</div>
              <div style={{ fontSize: 12, color: '#8883B0', marginTop: 2 }}>Share the password with {form.name || form.email}.</div>
            </div>
          </div>
          <div style={{ padding: '24px 28px' }}>
            <div style={{ fontSize: 11, fontWeight: 700, color: '#8883B0', textTransform: 'uppercase', letterSpacing: '.6px', marginBottom: 10 }}>Temporary Password</div>
            <div style={{ display: 'flex', gap: 10, marginBottom: 16 }}>
              <code style={{ flex: 1, padding: '12px 16px', background: '#F5F4FB', borderRadius: 10, border: '1.5px solid #E8E4F8', fontSize: 15, fontFamily: 'monospace', letterSpacing: 2, color: '#1a1a2e' }}>{createdPassword}</code>
              <button onClick={function() { navigator.clipboard.writeText(createdPassword); setPasswordCopied(true); setTimeout(function() { setPasswordCopied(false) }, 2000) }}
                style={{ padding: '12px 16px', borderRadius: 10, border: '1.5px solid #E8E4F8', background: cpBg, color: cpCl, fontSize: 12.5, fontWeight: 600, cursor: 'pointer', fontFamily: "'Poppins',sans-serif", display: 'flex', alignItems: 'center', gap: 6, whiteSpace: 'nowrap' }}>
                {cpLbl}
              </button>
            </div>
            <div style={{ fontSize: 11.5, color: '#B0ABCC', background: '#FAFAFE', borderRadius: 8, padding: '10px 14px', border: '1px solid #F0EDF9', marginBottom: 22 }}>
              The faculty member must log out and back in to pick up their new role.
            </div>
            <div style={{ display: 'flex', gap: 10 }}>
              <button onClick={function() { navigate('/dashboard/faculty') }} style={{ padding: '9px 18px', borderRadius: 9, border: 'none', background: 'linear-gradient(135deg,#7C6FCD,#5a4fbf)', color: '#fff', fontSize: 13, fontWeight: 600, cursor: 'pointer', fontFamily: "'Poppins',sans-serif" }}>Back to Faculty List</button>
              <button onClick={function() { setCreatedPassword(''); setForm(empty); setPassword('') }} style={{ padding: '9px 16px', borderRadius: 9, border: '1.5px solid #E8E4F8', background: '#fff', color: '#8883B0', fontSize: 13, fontWeight: 600, cursor: 'pointer', fontFamily: "'Poppins',sans-serif" }}>Add Another</button>
            </div>
          </div>
        </div>
      </div>
    )
  }

  // ── Main render ─────────────────────────────────────────────────────────────
  if (pageLoading) {
    // Shimmer keyframe + helper styles injected once
    if (!document.getElementById('fd-skel-style')) {
      const s = document.createElement('style')
      s.id = 'fd-skel-style'
      s.textContent = `
        @keyframes fdShimmer {
          0%   { background-position: -600px 0 }
          100% { background-position:  600px 0 }
        }
        .fd-skel {
          background: linear-gradient(90deg, #F0EDF9 25%, #E6E0F8 50%, #F0EDF9 75%);
          background-size: 1200px 100%;
          animation: fdShimmer 1.5s ease-in-out infinite;
          border-radius: 7px;
        }
        .fd-skel-card {
          background: #fff;
          border-radius: 16px;
          border: 1.5px solid #E8E4F8;
          overflow: hidden;
          box-shadow: 0 2px 10px rgba(124,111,205,0.06);
        }
        .fd-skel-card-header {
          padding: 14px 20px;
          border-bottom: 1px solid #F0EDF9;
          display: flex;
          align-items: center;
          gap: 10px;
        }
        .fd-skel-card-body {
          padding: 18px 20px;
          display: flex;
          flex-direction: column;
          gap: 14px;
        }
        .fd-skel-row {
          display: flex;
          gap: 12px;
          align-items: flex-start;
        }
      `
      document.head.appendChild(s)
    }

    const Sk = ({ w = '100%', h = 14, r = 7, delay = 0, style: extra = {} }) => (
      <div className="fd-skel" style={{ width: w, height: h, borderRadius: r, flexShrink: 0, animationDelay: `${delay}s`, ...extra }} />
    )

    return (
      <div style={{ padding: '28px 32px', fontFamily: "'Poppins',sans-serif" }}>

        {/* ── Breadcrumb skeleton ── */}
        <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 22 }}>
          <Sk w={52} h={14} r={6} />
          <Sk w={10} h={10} r={3} />
          <Sk w={140} h={14} r={6} delay={0.05} />
          <Sk w={56} h={18} r={99} delay={0.08} />
        </div>

        {/* ── Two-column layout skeleton (mirrors real page) ── */}
        <div style={{ display: 'flex', gap: 24, flexWrap: 'wrap', alignItems: 'flex-start' }}>

          {/* ── Left column: avatar card + load card ── */}
          <div style={{ flex: '0 0 300px', minWidth: 260, display: 'flex', flexDirection: 'column', gap: 16 }}>

            {/* Profile / avatar card */}
            <div className="fd-skel-card">
              <div className="fd-skel-card-body" style={{ alignItems: 'center', paddingTop: 28, paddingBottom: 24 }}>
                <Sk w={72} h={72} r="50%" delay={0} />
                <Sk w="55%" h={16} delay={0.06} />
                <Sk w="38%" h={12} delay={0.09} />
                <div style={{ display: 'flex', gap: 8, marginTop: 4 }}>
                  <Sk w={64} h={20} r={99} delay={0.11} />
                  <Sk w={72} h={20} r={99} delay={0.13} />
                </div>
              </div>
            </div>

            {/* Unit load card */}
            <div className="fd-skel-card">
              <div className="fd-skel-card-header">
                <Sk w={28} h={28} r={8} delay={0.05} />
                <Sk w="50%" h={13} delay={0.07} />
              </div>
              <div className="fd-skel-card-body">
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                  <Sk w="40%" h={28} r={8} delay={0.08} />
                  <Sk w="30%" h={13} delay={0.1} />
                </div>
                <Sk w="100%" h={6} r={99} delay={0.11} />
                <Sk w="60%" h={11} delay={0.13} />
              </div>
            </div>

            {/* Credentials card stub */}
            <div className="fd-skel-card">
              <div className="fd-skel-card-header">
                <Sk w={28} h={28} r={8} delay={0.06} />
                <Sk w="45%" h={13} delay={0.09} />
              </div>
              <div className="fd-skel-card-body">
                <Sk w="100%" h={36} r={8} delay={0.1} />
                <Sk w="100%" h={36} r={8} delay={0.12} />
                <Sk w="45%" h={32} r={8} delay={0.14} />
              </div>
            </div>
          </div>

          {/* ── Right column: info card + specializations + prefs + schedule ── */}
          <div style={{ flex: 1, minWidth: 280, display: 'flex', flexDirection: 'column', gap: 16 }}>

            {/* Basic info card */}
            <div className="fd-skel-card">
              <div className="fd-skel-card-header">
                <Sk w={28} h={28} r={8} delay={0.04} />
                <Sk w="40%" h={13} delay={0.07} />
              </div>
              <div className="fd-skel-card-body">
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 14 }}>
                  {[0.08, 0.1, 0.12, 0.14, 0.16, 0.18].map((d, i) => (
                    <div key={i} style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
                      <Sk w="45%" h={10} delay={d} />
                      <Sk w="100%" h={34} r={8} delay={d + 0.01} />
                    </div>
                  ))}
                </div>
              </div>
            </div>

            {/* Specializations card */}
            <div className="fd-skel-card">
              <div className="fd-skel-card-header">
                <Sk w={28} h={28} r={8} delay={0.06} />
                <Sk w="38%" h={13} delay={0.09} />
                <div style={{ marginLeft: 'auto' }}>
                  <Sk w={80} h={28} r={8} delay={0.11} />
                </div>
              </div>
              <div className="fd-skel-card-body">
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(168px, 1fr))', gap: 8 }}>
                  {[0.1, 0.12, 0.14, 0.16, 0.18, 0.2, 0.22, 0.24].map((d, i) => (
                    <Sk key={i} w="100%" h={52} r={10} delay={d} />
                  ))}
                </div>
              </div>
            </div>

            {/* Schedule preferences card */}
            <div className="fd-skel-card">
              <div className="fd-skel-card-header">
                <Sk w={28} h={28} r={8} delay={0.07} />
                <Sk w="44%" h={13} delay={0.1} />
              </div>
              <div className="fd-skel-card-body">
                <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                  <Sk w="30%" h={10} delay={0.11} />
                  <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
                    {[0.12, 0.13, 0.14, 0.15, 0.16, 0.17, 0.18].map((d, i) => (
                      <Sk key={i} w={48} h={28} r={20} delay={d} />
                    ))}
                  </div>
                </div>
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 14 }}>
                  <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
                    <Sk w="50%" h={10} delay={0.19} />
                    <Sk w="100%" h={34} r={8} delay={0.2} />
                  </div>
                  <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
                    <Sk w="50%" h={10} delay={0.21} />
                    <Sk w="100%" h={34} r={8} delay={0.22} />
                  </div>
                </div>
              </div>
            </div>

            {/* Schedule section card */}
            <div className="fd-skel-card">
              <div className="fd-skel-card-header" style={{ justifyContent: 'space-between' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                  <Sk w={28} h={28} r={8} delay={0.08} />
                  <Sk w={80} h={13} delay={0.11} />
                </div>
                <Sk w={140} h={30} r={8} delay={0.12} />
              </div>
              <div className="fd-skel-card-body" style={{ gap: 10 }}>
                {/* Table header */}
                <div style={{ display: 'flex', gap: 10 }}>
                  {[0.13, 0.15, 0.17, 0.19].map((d, i) => (
                    <Sk key={i} w="25%" h={10} delay={d} />
                  ))}
                </div>
                {/* Table rows */}
                {[0.15, 0.18, 0.21, 0.24].map((d, i) => (
                  <div key={i} style={{ display: 'flex', gap: 10 }}>
                    {[d, d + 0.02, d + 0.04, d + 0.06].map((dd, j) => (
                      <Sk key={j} w="25%" h={32} r={6} delay={dd} />
                    ))}
                  </div>
                ))}
              </div>
            </div>

          </div>
        </div>
      </div>
    )
  }

  // ── Avatar helper (initials + colour from name) ────────────────────────────
  const avatarColors = [
    ['#7C6FCD','#EEEAFB'],['#2563EB','#EBF0FF'],['#059669','#E6FAF3'],
    ['#D97706','#FEF3CD'],['#DC2626','#FFE8E8'],['#7C3AED','#EDE9FE'],
  ]
  const avatarName    = form.name || (isNew ? 'New' : '?')
  const [avFg, avBg]  = avatarColors[avatarName.charCodeAt(0) % avatarColors.length]
  const avInitials    = avatarName.split(' ').map(function(n) { return n[0] }).join('').slice(0, 2).toUpperCase()

  return (
    <div style={{ padding: '28px 32px', fontFamily: "'Poppins',sans-serif" }}>
      <style>{`
        @keyframes spin { to { transform: rotate(360deg) } }
        input:focus, select:focus { border-color: #7C6FCD !important; outline: none; box-shadow: 0 0 0 3px rgba(124,111,205,0.12); }
      `}</style>

      {/* ── Header row ── */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 20, flexWrap: 'wrap' }}>
        {/* Breadcrumb */}
        <div style={{ display: 'flex', alignItems: 'center', gap: 8, flex: 1 }}>
          <button onClick={function() { navigate('/dashboard/faculty') }} style={{ background: 'none', border: 'none', color: '#8883B0', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 5, fontSize: 12.5, fontFamily: "'Poppins',sans-serif", padding: 0 }}>
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><line x1="19" y1="12" x2="5" y2="12"/><polyline points="12 19 5 12 12 5"/></svg>
            Faculty
          </button>
          <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="#D8D3F5" strokeWidth="2"><line x1="5" y1="12" x2="19" y2="12"/><polyline points="12 5 19 12 12 19"/></svg>
          <span style={{ fontSize: 12.5, color: '#1a1a2e', fontWeight: 600 }}>{isNew ? 'New Faculty' : (form.name || 'Edit Faculty')}</span>
          {!isNew && form.status && <span style={{ padding: '1px 8px', borderRadius: 99, fontSize: 10.5, fontWeight: 700, background: statusBg, color: statusCl }}>{form.status}</span>}
          {!isNew && form.archived && <span style={{ padding: '1px 8px', borderRadius: 99, fontSize: 10.5, fontWeight: 700, background: '#FEF3CD', color: '#B45309' }}>Archived</span>}
          {!isNew && isOverloaded && <span style={{ padding: '1px 8px', borderRadius: 99, fontSize: 10.5, fontWeight: 700, background: '#FFE8E8', color: '#C0392B' }}>Overloaded</span>}
        </div>

        {/* Archive + Delete buttons in header */}
        {!isNew && (
          <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
            {form.archived ? (
              <button type="button" onClick={handleUnarchive} disabled={archiving}
                style={{ display: 'inline-flex', alignItems: 'center', gap: 6, padding: '6px 12px', borderRadius: 8, border: '1.5px solid #A7F3D0', background: '#E6FAF3', color: '#059669', fontSize: 12, fontWeight: 600, cursor: archiving ? 'default' : 'pointer', fontFamily: "'Poppins',sans-serif", opacity: archiving ? 0.7 : 1 }}>
                <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><polyline points="1 4 1 10 7 10"/><path d="M3.51 15a9 9 0 1 0 .49-3.5"/></svg>
                {archiving ? 'Restoring…' : 'Restore'}
              </button>
            ) : (
              <button type="button" onClick={function() { setShowArchiveModal(true) }}
                style={{ display: 'inline-flex', alignItems: 'center', gap: 6, padding: '6px 12px', borderRadius: 8, border: '1.5px solid #E8E4F8', background: '#fff', color: '#8883B0', fontSize: 12, fontWeight: 600, cursor: 'pointer', fontFamily: "'Poppins',sans-serif", transition: 'all 0.15s' }}>
                <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M21 8v13H3V8"/><path d="M23 3H1v5h22z"/><line x1="10" y1="12" x2="14" y2="12"/></svg>
                Archive
              </button>
            )}
            <button type="button" onClick={function() { setShowDeleteModal(true) }}
              style={{ display: 'inline-flex', alignItems: 'center', gap: 6, padding: '6px 12px', borderRadius: 8, border: '1.5px solid #FFD0D0', background: '#FFF5F5', color: '#C0392B', fontSize: 12, fontWeight: 600, cursor: 'pointer', fontFamily: "'Poppins',sans-serif" }}>
              <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><polyline points="3 6 5 6 21 6"/><path d="M19 6l-1 14a2 2 0 0 1-2 2H8a2 2 0 0 1-2-2L5 6"/><path d="M10 11v6"/><path d="M14 11v6"/></svg>
              Delete
            </button>
          </div>
        )}
      </div>

      {/* ── Banners ── */}
      {isNew && (
        <div style={{ background: '#EBF0FF', border: '1px solid #B3D4F5', borderRadius: 12, padding: '12px 16px', marginBottom: 20, display: 'flex', gap: 10, alignItems: 'flex-start' }}>
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="#2563EB" strokeWidth="2" style={{ flexShrink: 0, marginTop: 1 }}><circle cx="12" cy="12" r="10"/><line x1="12" y1="8" x2="12" y2="12"/><line x1="12" y1="16" x2="12.01" y2="16"/></svg>
          <span style={{ fontSize: 12.5, color: '#1a4a7c', lineHeight: 1.5 }}>Adding a faculty member automatically creates their Firebase login account and assigns the faculty role.</span>
        </div>
      )}
      {!isNew && form.archived && (
        <div style={{ background: '#FEF3CD', border: '1px solid #FDE68A', borderRadius: 12, padding: '12px 16px', marginBottom: 20, display: 'flex', gap: 10, alignItems: 'center' }}>
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="#D97706" strokeWidth="2" style={{ flexShrink: 0 }}>
            <path d="M21 8v13H3V8"/><path d="M23 3H1v5h22z"/><line x1="10" y1="12" x2="14" y2="12"/>
          </svg>
          <span style={{ fontSize: 12.5, color: '#92400E', lineHeight: 1.5, flex: 1 }}>
            This faculty member is <strong>archived</strong> and excluded from scheduling. Edits are still saved normally.
          </span>
          <button onClick={handleUnarchive} disabled={archiving} style={{ padding: '5px 14px', borderRadius: 8, border: '1.5px solid #D97706', background: '#fff', color: '#B45309', fontSize: 12, fontWeight: 600, cursor: archiving ? 'default' : 'pointer', fontFamily: "'Poppins',sans-serif", flexShrink: 0, opacity: archiving ? 0.7 : 1 }}>
            {archiving ? 'Restoring…' : 'Restore Now'}
          </button>
        </div>
      )}

      <form onSubmit={handleCreate}>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
        {/* ══ Two-column layout ══════════════════════════════════════════════ */}
        <div style={{ display: 'flex', gap: 24, flexWrap: 'wrap', alignItems: 'flex-start' }}>

          {/* ── LEFT COLUMN ─────────────────────────────────────────────────── */}
          <div style={{ flex: '0 0 300px', minWidth: 260, display: 'flex', flexDirection: 'column', gap: 16 }}>

            {/* ── Profile card ── */}
            <div style={{ background: '#fff', borderRadius: 16, border: '1px solid #E8E4F8', overflow: 'hidden', boxShadow: '0 2px 10px rgba(124,111,205,0.06)' }}>
              <div style={{ padding: '24px 20px 20px', display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 12 }}>
                {/* Avatar */}
                <div style={{
                  width: 72, height: 72, borderRadius: '50%',
                  background: `linear-gradient(135deg, ${avBg}, ${avBg}cc)`,
                  color: avFg, display: 'flex', alignItems: 'center', justifyContent: 'center',
                  fontSize: 24, fontWeight: 700, flexShrink: 0,
                  border: `3px solid ${avFg}25`,
                  boxShadow: `0 6px 18px ${avFg}22`,
                }}>{avInitials}</div>

                {/* Name + rank */}
                <div style={{ textAlign: 'center' }}>
                  <div style={{ fontSize: 15, fontWeight: 700, color: '#1a1a2e', lineHeight: 1.2, marginBottom: 3 }}>
                    {form.name || (isNew ? 'New Faculty' : '—')}
                  </div>
                  {form.AcademicRank && (
                    <div style={{ fontSize: 11.5, color: '#8883B0', fontWeight: 500 }}>{form.AcademicRank}</div>
                  )}
                  {form.Department && (
                    <div style={{ fontSize: 11, color: '#B0ABCC', fontWeight: 500, marginTop: 2 }}>{form.Department}</div>
                  )}
                </div>

                {/* Status / archived chips */}
                <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap', justifyContent: 'center' }}>
                  <span style={{ padding: '3px 10px', borderRadius: 99, fontSize: 10.5, fontWeight: 700, background: statusBg, color: statusCl, border: `1px solid ${form.status === 'full-time' ? '#B8F0DC' : '#E8E4F8'}`, textTransform: 'capitalize' }}>
                    {form.status}
                  </span>
                  {!isNew && form.archived && (
                    <span style={{ padding: '3px 10px', borderRadius: 99, fontSize: 10.5, fontWeight: 700, background: '#FEF3CD', color: '#B45309', border: '1px solid #FDE68A' }}>Archived</span>
                  )}
                  {!isNew && isOverloaded && (
                    <span style={{ padding: '3px 10px', borderRadius: 99, fontSize: 10.5, fontWeight: 700, background: '#FFE8E8', color: '#C0392B', border: '1px solid #FFCCCC' }}>Overloaded</span>
                  )}
                </div>

                {/* Manage Specializations button */}
                <button type="button" onClick={function() { setShowSpecModal(true) }}
                  style={{ display: 'inline-flex', alignItems: 'center', gap: 6, padding: '7px 16px', borderRadius: 9, background: '#F5F4FB', color: '#7C6FCD', border: '1.5px solid #E8E4F8', fontSize: 12, fontWeight: 600, cursor: 'pointer', fontFamily: "'Poppins',sans-serif", transition: 'all 0.15s', marginTop: 2 }}>
                  <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M4 19.5A2.5 2.5 0 0 1 6.5 17H20"/><path d="M6.5 2H20v20H6.5A2.5 2.5 0 0 1 4 19.5v-15A2.5 2.5 0 0 1 6.5 2z"/></svg>
                  Manage Specializations
                  {specCount > 0 && <span style={{ padding: '0px 6px', borderRadius: 99, background: '#EEEAFB', color: '#7C6FCD', fontSize: 10, fontWeight: 700 }}>{specCount}</span>}
                </button>
              </div>
            </div>

            {/* ── Unit Load card ── */}
            {!isNew && (
              <div style={{ background: '#fff', borderRadius: 16, border: '1px solid #E8E4F8', overflow: 'hidden', boxShadow: '0 2px 10px rgba(124,111,205,0.06)' }}>
                <div style={{ padding: '14px 20px', borderBottom: '1px solid #F0EDF9', display: 'flex', alignItems: 'center', gap: 8 }}>
                  <div style={{ width: 28, height: 28, borderRadius: 8, background: isOverloaded ? '#FFE8E8' : '#EEEAFB', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                    <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke={isOverloaded ? '#C0392B' : '#7C6FCD'} strokeWidth="2">
                      <polyline points="22 12 18 12 15 21 9 3 6 12 2 12"/>
                    </svg>
                  </div>
                  <span style={{ fontSize: 13, fontWeight: 700, color: '#1a1a2e', flex: 1 }}>Unit Load</span>
                  {scheduleUnits !== null && (
                    <span style={{ fontSize: 9.5, color: '#059669', fontWeight: 600, display: 'flex', alignItems: 'center', gap: 3, background: '#E6FAF3', padding: '2px 8px', borderRadius: 99, border: '1px solid #A7F3D0' }}>
                      <svg width="6" height="6" viewBox="0 0 24 24" fill="#059669"><circle cx="12" cy="12" r="6"/></svg>
                      live
                    </span>
                  )}
                </div>
                <div style={{ padding: '16px 20px', display: 'flex', flexDirection: 'column', gap: 12 }}>
                  {/* Big number row */}
                  <div style={{ display: 'flex', alignItems: 'flex-end', justifyContent: 'space-between' }}>
                    <div style={{ display: 'flex', alignItems: 'baseline', gap: 4 }}>
                      <span style={{ fontSize: 32, fontWeight: 800, color: unitNumCl, lineHeight: 1, letterSpacing: '-1px' }}>{displayUnits}</span>
                      <span style={{ fontSize: 13, color: '#B0ABCC', fontWeight: 500, marginBottom: 2 }}>/ {effectiveCap}</span>
                      <span style={{ fontSize: 11, color: '#C0BBDC', fontWeight: 400, marginBottom: 2 }}>units</span>
                    </div>
                    {isOverloaded
                      ? <span style={{ fontSize: 10, fontWeight: 700, padding: '3px 9px', borderRadius: 99, background: '#FFE8E8', color: '#C0392B', border: '1px solid #FFCCCC' }}>Over Cap</span>
                      : <span style={{ fontSize: 10, fontWeight: 600, padding: '3px 9px', borderRadius: 99, background: '#EEEAFB', color: '#7C6FCD', border: '1px solid #D8D3F5' }}>
                          {Math.round(loadPct)}%
                        </span>
                    }
                  </div>
                  {/* Progress bar */}
                  <div style={{ height: 5, borderRadius: 99, background: '#F0EDF9', overflow: 'hidden' }}>
                    <div style={{ height: '100%', borderRadius: 99, transition: 'width 0.5s cubic-bezier(.4,0,.2,1)', width: loadPct + '%', background: barBg }}/>
                  </div>
                  {/* Tier label */}
                  <div style={{ fontSize: 10.5, color: '#B0ABCC', lineHeight: 1.4 }}>{tierLabel}</div>
                  {/* Cap rules — always visible */}
                  <div style={{ marginTop: 2, padding: '10px 12px', borderRadius: 10, background: '#FAFAFE', border: '1px solid #F0EDF9' }}>
                    <div style={{ fontSize: 9.5, fontWeight: 700, color: '#B0ABCC', textTransform: 'uppercase', letterSpacing: '.7px', marginBottom: 7 }}>Auto Cap Rules</div>
                    <div style={{ display: 'flex', flexDirection: 'column', gap: 5 }}>
                      {[
                        { label: 'Part-Time',        cap: '≤ 15 units', color: '#8883B0', bg: '#F5F4FB' },
                        { label: 'FT · 5+ courses',  cap: '≤ 18 units', color: '#C0392B', bg: '#FFE8E8' },
                        { label: 'FT · 3-4 courses', cap: '≤ 21 units', color: '#2563EB', bg: '#EBF0FF' },
                        { label: 'FT · 0-2 courses', cap: '≤ 24 units', color: '#059669', bg: '#E6FAF3' },
                      ].map(function(r) {
                        return (
                          <div key={r.label} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                            <span style={{ fontSize: 11, color: '#6a6a8a' }}>{r.label}</span>
                            <span style={{ fontSize: 10.5, fontWeight: 700, padding: '1px 8px', borderRadius: 99, background: r.bg, color: r.color }}>{r.cap}</span>
                          </div>
                        )
                      })}
                    </div>
                  </div>
                </div>
              </div>
            )}


          </div>{/* end LEFT COLUMN */}

          {/* ── RIGHT COLUMN ────────────────────────────────────────────────── */}
          <div style={{ flex: 1, minWidth: 280, display: 'flex', flexDirection: 'column', gap: 16 }}>

          {/* Basic Info */}
          <div style={{ background: '#fff', borderRadius: 16, border: '1px solid #E8E4F8', overflow: 'hidden', boxShadow: '0 2px 10px rgba(124,111,205,0.06)' }}>
            <div style={{ padding: '14px 20px', borderBottom: '1px solid #F0EDF9', display: 'flex', alignItems: 'center', gap: 8 }}>
              <div style={{ width: 28, height: 28, borderRadius: 8, background: '#EEEAFB', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="#7C6FCD" strokeWidth="2"><path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2"/><circle cx="12" cy="7" r="4"/></svg>
              </div>
              <span style={{ fontSize: 13, fontWeight: 700, color: '#1a1a2e', flex: 1 }}>Basic Information</span>
              {!isNew && (infoChanged || infoSaving || infoSaved) && <SectionSaveBtn saving={infoSaving} saved={infoSaved} onClick={handleSaveInfo} />}
            </div>
            <div style={{ padding: '18px 20px', display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '16px 20px' }}>
              <FormField label="Full Name" required>
                <input value={form.name} onChange={function(e) { setForm(function(f) { return Object.assign({}, f, { name: e.target.value }) }) }} required style={{ padding: '8px 11px', borderRadius: 8, border: '1.5px solid #E8E4F8', fontSize: 13, fontFamily: "'Poppins',sans-serif", width: '100%', boxSizing: 'border-box' }} />
              </FormField>

              <FormField label="Academic Rank">
                <select value={form.AcademicRank || ''} onChange={function(e) { setForm(function(f) { return Object.assign({}, f, { AcademicRank: e.target.value }) }) }} style={{ padding: '8px 11px', borderRadius: 8, border: '1.5px solid #E8E4F8', fontSize: 13, fontFamily: "'Poppins',sans-serif", background: '#fff', width: '100%', boxSizing: 'border-box' }}>
                  <option value="">select...</option>
                  {ACADEMIC_RANKS.map(function(r) { return <option key={r} value={r}>{r}</option> })}
                </select>
              </FormField>
              <FormField label="Employment Status">
                <select value={form.status} onChange={function(e) { setForm(function(f) { return Object.assign({}, f, { status: e.target.value }) }) }} style={{ padding: '8px 11px', borderRadius: 8, border: '1.5px solid #E8E4F8', fontSize: 13, fontFamily: "'Poppins',sans-serif", background: '#fff', width: '100%', boxSizing: 'border-box' }}>
                  <option value="full-time">Full-time</option>
                  <option value="part-time">Part-time</option>
                </select>
              </FormField>
              <FormField label="Department">
                <select value={form.Department || ''} onChange={function(e) { setForm(function(f) { return Object.assign({}, f, { Department: e.target.value }) }) }} style={{ padding: '8px 11px', borderRadius: 8, border: '1.5px solid #E8E4F8', fontSize: 13, fontFamily: "'Poppins',sans-serif", background: '#fff', width: '100%', boxSizing: 'border-box' }}>
                  <option value="">select...</option>
                  {DEPARTMENTS.map(function(d) { return <option key={d} value={d}>{d}</option> })}
                </select>
              </FormField>
              <FormField label="Educational Attainment" hint="e.g. Master's Degree, PhD">
                <input type="text" value={form.Educational_attainment || ''} onChange={function(e) { setForm(function(f) { return Object.assign({}, f, { Educational_attainment: e.target.value }) }) }} placeholder="Enter degree..." style={{ padding: '8px 11px', borderRadius: 8, border: '1.5px solid #E8E4F8', fontSize: 13, fontFamily: "'Poppins',sans-serif", width: '100%', boxSizing: 'border-box' }} />
              </FormField>
              <FormField label="Sex">
                <select value={form.Sex || ''} onChange={function(e) { setForm(function(f) { return Object.assign({}, f, { Sex: e.target.value }) }) }} style={{ padding: '8px 11px', borderRadius: 8, border: '1.5px solid #E8E4F8', fontSize: 13, fontFamily: "'Poppins',sans-serif", background: '#fff', width: '100%', boxSizing: 'border-box' }}>
                  <option value="">select...</option>
                  <option value="Male">Male</option>
                  <option value="Female">Female</option>
                  <option value="Other">Other / Prefer not to say</option>
                </select>
              </FormField>

            </div>
            {infoError && !isNew && (
              <div style={{ margin: '0 20px 14px', padding: '8px 12px', borderRadius: 8, background: '#FFE8E8', border: '1px solid #FFCCCC', display: 'flex', gap: 6, alignItems: 'center' }}>
                <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="#C0392B" strokeWidth="2"><circle cx="12" cy="12" r="10"/><line x1="12" y1="8" x2="12" y2="12"/><line x1="12" y1="16" x2="12.01" y2="16"/></svg>
                <span style={{ fontSize: 12, color: '#C0392B', fontWeight: 500 }}>{infoError}</span>
              </div>
            )}
          </div>

          {/* Login Credentials — new faculty */}
          {isNew && (
            <div style={{ background: '#fff', borderRadius: 16, border: '1px solid #E8E4F8', overflow: 'hidden', boxShadow: '0 2px 10px rgba(124,111,205,0.06)' }}>
              <div style={{ padding: '14px 20px', borderBottom: '1px solid #F0EDF9', display: 'flex', alignItems: 'center', gap: 8 }}>
                <div style={{ width: 28, height: 28, borderRadius: 8, background: '#F5F4FB', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                  <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="#7C6FCD" strokeWidth="2"><rect x="3" y="11" width="18" height="11" rx="2"/><path d="M7 11V7a5 5 0 0 1 10 0v4"/></svg>
                </div>
                <span style={{ fontSize: 13, fontWeight: 700, color: '#1a1a2e', flex: 1 }}>Login Credentials</span>
              </div>
              <div style={{ padding: '12px 20px 6px', background: '#EBF0FF', borderBottom: '1px solid #D1E0FF', display: 'flex', gap: 8, alignItems: 'flex-start' }}>
                <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="#2563EB" strokeWidth="2" style={{ flexShrink: 0, marginTop: 1 }}><circle cx="12" cy="12" r="10"/><line x1="12" y1="8" x2="12" y2="12"/><line x1="12" y1="16" x2="12.01" y2="16"/></svg>
                <span style={{ fontSize: 12, color: '#1a4a7c', lineHeight: 1.5 }}>These credentials will be used to log in to the system. The password defaults to <strong>[LastName]GC2026</strong> if left blank.</span>
              </div>
              <div style={{ padding: '18px 20px', display: 'flex', flexDirection: 'column', gap: 14 }}>
                <FormField label="Login Email" required hint="Used as the faculty member's login">
                  <input type="email" value={form.email || ''} onChange={function(e) { setForm(function(f) { return Object.assign({}, f, { email: e.target.value }) }) }} autoComplete="off" required
                    style={{ padding: '8px 11px', borderRadius: 8, border: '1.5px solid #E8E4F8', fontSize: 13, fontFamily: "'Poppins',sans-serif", width: '100%', boxSizing: 'border-box' }} />
                </FormField>
                <FormField label="Password" hint="Leave blank to use [LastName]GC2026">
                  <div style={{ display: 'flex', gap: 8 }}>
                    <input type={showPassword ? 'text' : 'password'} value={password} onChange={function(e) { setPassword(e.target.value) }} autoComplete="new-password" placeholder="Default: [LastName]GC2026"
                      style={{ flex: 1, padding: '8px 11px', borderRadius: 8, border: '1.5px solid #E8E4F8', fontSize: 13, fontFamily: "'Poppins',sans-serif" }} />
                    <button type="button" onClick={function() { setShowPassword(function(v) { return !v }) }}
                      style={{ padding: '8px 12px', borderRadius: 8, border: '1.5px solid #E8E4F8', background: '#F5F4FB', color: '#8883B0', fontSize: 12, cursor: 'pointer', fontFamily: "'Poppins',sans-serif" }}>
                      {showPassword ? 'Hide' : 'Show'}
                    </button>
                    <button type="button" onClick={function() { const lastName = (form.name || '').trim().split(/\s+/).pop() || 'faculty'; const p = lastName + 'GC2026'; setPassword(p); setShowPassword(true) }}
                      style={{ padding: '8px 12px', borderRadius: 8, border: '1.5px solid #E8E4F8', background: '#F5F4FB', color: '#7C6FCD', fontSize: 12, fontWeight: 600, cursor: 'pointer', fontFamily: "'Poppins',sans-serif", whiteSpace: 'nowrap' }}>
                      Generate
                    </button>
                  </div>
                </FormField>
              </div>
            </div>
          )}

          {/* Schedule Preferences */}
          <div style={{ background: '#fff', borderRadius: 16, border: '1px solid #E8E4F8', overflow: 'hidden', boxShadow: '0 2px 10px rgba(124,111,205,0.06)' }}>
            <div style={{ padding: '14px 20px', borderBottom: '1px solid #F0EDF9', display: 'flex', alignItems: 'center', gap: 8 }}>
              <div style={{ width: 28, height: 28, borderRadius: 8, background: '#EEEAFB', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="#7C6FCD" strokeWidth="2"><rect x="3" y="4" width="18" height="18" rx="2"/><line x1="16" y1="2" x2="16" y2="6"/><line x1="8" y1="2" x2="8" y2="6"/><line x1="3" y1="10" x2="21" y2="10"/></svg>
              </div>
              <span style={{ fontSize: 13, fontWeight: 700, color: '#1a1a2e', flex: 1 }}>Schedule Preferences</span>
              {!isNew && (prefsChanged || prefSaving || prefSaved) && <SectionSaveBtn saving={prefSaving} saved={prefSaved} onClick={handleSavePrefs} />}
            </div>
            <div style={{ padding: '18px 20px', display: 'flex', flexDirection: 'column', gap: 18 }}>
              <FormField label="Preferred Teaching Days">
                <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap', marginTop: 2 }}>
                  {ALL_DAYS.map(function(day) {
                    const active = form.preferredDays.includes(day)
                    const bg     = active ? 'linear-gradient(135deg,#7C6FCD,#5a4fbf)' : '#F5F4FB'
                    const cl     = active ? '#fff' : '#8883B0'
                    const bd     = active ? 'none' : '1.5px solid #E8E4F8'
                    const fw     = active ? 600 : 500
                    return (
                      <button key={day} type="button" onClick={function() { toggleDay(day) }} style={{ padding: '5px 13px', fontSize: 12, borderRadius: 20, fontFamily: "'Poppins',sans-serif", background: bg, color: cl, border: bd, cursor: 'pointer', transition: 'all 0.15s', fontWeight: fw }}>
                        {day.slice(0, 3)}
                      </button>
                    )
                  })}
                </div>
              </FormField>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '16px 20px' }}>
                <FormField label="Preferred Start">
                  <div style={{ position: 'relative' }}>
                    <input type="number" min={6} max={20} step={0.5} value={form.preferredTimeStart} onChange={function(e) { setForm(function(f) { return Object.assign({}, f, { preferredTimeStart: Number(e.target.value) }) }) }}
                      style={{ padding: '8px 11px', borderRadius: 8, border: '1.5px solid #E8E4F8', fontSize: 13, fontFamily: "'Poppins',sans-serif", width: '100%', boxSizing: 'border-box' }} />
                    <span style={{ position: 'absolute', right: 10, top: '50%', transform: 'translateY(-50%)', fontSize: 10.5, color: '#B0ABCC', pointerEvents: 'none', fontWeight: 600 }}>{fmtHour(form.preferredTimeStart)}</span>
                  </div>
                </FormField>
                <FormField label="Preferred End">
                  <div style={{ position: 'relative' }}>
                    <input type="number" min={7} max={21} step={0.5} value={form.preferredTimeEnd} onChange={function(e) { setForm(function(f) { return Object.assign({}, f, { preferredTimeEnd: Number(e.target.value) }) }) }}
                      style={{ padding: '8px 11px', borderRadius: 8, border: '1.5px solid #E8E4F8', fontSize: 13, fontFamily: "'Poppins',sans-serif", width: '100%', boxSizing: 'border-box' }} />
                    <span style={{ position: 'absolute', right: 10, top: '50%', transform: 'translateY(-50%)', fontSize: 10.5, color: '#B0ABCC', pointerEvents: 'none', fontWeight: 600 }}>{fmtHour(form.preferredTimeEnd)}</span>
                  </div>
                </FormField>
              </div>
            </div>
            {prefError && !isNew && (
              <div style={{ margin: '0 20px 14px', padding: '8px 12px', borderRadius: 8, background: '#FFE8E8', border: '1px solid #FFCCCC', display: 'flex', gap: 6, alignItems: 'center' }}>
                <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="#C0392B" strokeWidth="2"><circle cx="12" cy="12" r="10"/><line x1="12" y1="8" x2="12" y2="12"/><line x1="12" y1="16" x2="12.01" y2="16"/></svg>
                <span style={{ fontSize: 12, color: '#C0392B', fontWeight: 500 }}>{prefError}</span>
              </div>
            )}
          </div>

          {/* Create button */}
          {isNew && (
            <div>
              {createError && (
                <div style={{ background: '#FFE8E8', border: '1px solid #FFCCCC', borderRadius: 10, padding: '10px 14px', display: 'flex', gap: 8, alignItems: 'center', marginBottom: 12 }}>
                  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="#C0392B" strokeWidth="2"><circle cx="12" cy="12" r="10"/><line x1="12" y1="8" x2="12" y2="12"/><line x1="12" y1="16" x2="12.01" y2="16"/></svg>
                  <span style={{ fontSize: 12.5, color: '#C0392B', fontWeight: 500 }}>{createError}</span>
                </div>
              )}
              <div style={{ display: 'flex', gap: 10 }}>
                <button type="submit" disabled={createSaving} style={{ display: 'inline-flex', alignItems: 'center', gap: 6, padding: '8px 18px', borderRadius: 10, border: 'none', fontFamily: "'Poppins',sans-serif", fontSize: 12.5, fontWeight: 600, cursor: createSaving ? 'default' : 'pointer', background: 'linear-gradient(135deg,#7C6FCD,#5a4fbf)', color: '#fff', boxShadow: '0 3px 12px rgba(124,111,205,0.32)', opacity: createSaving ? 0.65 : 1 }}>
                  {createSaving ? 'Creating...' : 'Create Faculty'}
                </button>
                <button type="button" onClick={function() { navigate('/dashboard/faculty') }} style={{ display: 'inline-flex', alignItems: 'center', gap: 6, padding: '8px 16px', borderRadius: 10, border: '1.5px solid #E8E4F8', fontFamily: "'Poppins',sans-serif", fontSize: 12.5, fontWeight: 600, cursor: 'pointer', background: '#fff', color: '#8883B0' }}>Cancel</button>
              </div>
            </div>
          )}

          </div>{/* end RIGHT COLUMN */}
        </div>{/* end two-column layout */}

        {/* ── Credentials (full width row) ── */}
        {!isNew && (
          <div style={{ background: '#fff', borderRadius: 16, border: '1px solid #E8E4F8', overflow: 'hidden', boxShadow: '0 2px 10px rgba(124,111,205,0.06)' }}>
            <div style={{ padding: '14px 20px', borderBottom: '1px solid #F0EDF9', display: 'flex', alignItems: 'center', gap: 8 }}>
              <div style={{ width: 28, height: 28, borderRadius: 8, background: '#F5F4FB', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="#7C6FCD" strokeWidth="2"><rect x="3" y="11" width="18" height="11" rx="2"/><path d="M7 11V7a5 5 0 0 1 10 0v4"/></svg>
              </div>
              <span style={{ fontSize: 13, fontWeight: 700, color: '#1a1a2e', flex: 1 }}>Login Credentials</span>
              {form.email
                ? <span style={{ fontSize: 10.5, fontWeight: 700, padding: '2px 8px', borderRadius: 99, background: '#E6FAF3', color: '#059669' }}>Active</span>
                : <span style={{ fontSize: 10.5, fontWeight: 700, padding: '2px 8px', borderRadius: 99, background: '#FFE8E8', color: '#C0392B' }}>Not Activated</span>
              }
            </div>
            {!form.email && (
              <div style={{ margin: '14px 20px 0', padding: '10px 14px', borderRadius: 8, background: '#FFF8E8', border: '1px solid #FFE4A0', display: 'flex', gap: 8, alignItems: 'flex-start' }}>
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="#92400E" strokeWidth="2" style={{ flexShrink: 0, marginTop: 1 }}><path d="M10.29 3.86L1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z"/><line x1="12" y1="9" x2="12" y2="13"/><line x1="12" y1="17" x2="12.01" y2="17"/></svg>
                <span style={{ fontSize: 11.5, color: '#92400E', lineHeight: 1.5 }}>No login account yet. Set email and password below to activate.</span>
              </div>
            )}
            <div style={{ padding: '18px 20px', display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: '16px 24px', alignItems: 'start' }}>
              <FormField label="Login Email" hint={form.email ? 'Change the email used to sign in' : 'Required — will be used as login'}>
                <input type="email" value={credEmail} onChange={function(e) { setCredEmail(e.target.value) }} autoComplete="off"
                  style={{ padding: '8px 11px', borderRadius: 8, border: '1.5px solid #E8E4F8', fontSize: 13, fontFamily: "'Poppins',sans-serif", width: '100%', boxSizing: 'border-box' }} />
              </FormField>
              <FormField label="New Password" hint={form.email ? 'Leave blank to keep current' : 'Auto-generated if blank'}>
                <div style={{ display: 'flex', gap: 6 }}>
                  <input type={showCredPwd ? 'text' : 'password'} value={credPassword} onChange={function(e) { setCredPassword(e.target.value) }} autoComplete="new-password" placeholder={form.email ? 'Leave blank to keep current' : 'Auto-generated if blank'}
                    style={{ flex: 1, padding: '8px 11px', borderRadius: 8, border: '1.5px solid #E8E4F8', fontSize: 13, fontFamily: "'Poppins',sans-serif", minWidth: 0 }} />
                  <button type="button" onClick={function() { setShowCredPwd(function(v) { return !v }) }}
                    style={{ padding: '8px 10px', borderRadius: 8, border: '1.5px solid #E8E4F8', background: '#F5F4FB', color: '#8883B0', fontSize: 11, cursor: 'pointer', fontFamily: "'Poppins',sans-serif", flexShrink: 0 }}>
                    {showCredPwd ? 'Hide' : 'Show'}
                  </button>
                  <button type="button" onClick={function() { const ln = (form.name || '').trim().split(/\s+/).pop() || 'faculty'; const p = ln + 'GC2026'; setCredPassword(p); setCredConfirm(p); setShowCredPwd(true) }}
                    style={{ padding: '8px 10px', borderRadius: 8, border: '1.5px solid #E8E4F8', background: '#F5F4FB', color: '#7C6FCD', fontSize: 11, fontWeight: 600, cursor: 'pointer', fontFamily: "'Poppins',sans-serif", flexShrink: 0, whiteSpace: 'nowrap' }}>
                    Generate
                  </button>
                </div>
              </FormField>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                {credPassword && (
                  <FormField label="Confirm Password">
                    <input type={showCredPwd ? 'text' : 'password'} value={credConfirm} onChange={function(e) { setCredConfirm(e.target.value) }} autoComplete="new-password" placeholder="Re-enter password"
                      style={{ padding: '8px 11px', borderRadius: 8, border: '1.5px solid ' + (credConfirm && credConfirm !== credPassword ? '#FFCCCC' : '#E8E4F8'), fontSize: 13, fontFamily: "'Poppins',sans-serif", width: '100%', boxSizing: 'border-box' }} />
                    {credConfirm && credConfirm !== credPassword && (
                      <span style={{ fontSize: 11, color: '#C0392B', marginTop: 3, display: 'block' }}>Passwords do not match</span>
                    )}
                  </FormField>
                )}
                <div style={{ paddingTop: credPassword ? 0 : 20 }}>
                  <button type="button" onClick={handleSaveCredentials} disabled={credSaving}
                    style={{ display: 'inline-flex', alignItems: 'center', justifyContent: 'center', gap: 6, padding: '9px 20px', borderRadius: 9, border: 'none', fontFamily: "'Poppins',sans-serif", fontSize: 12.5, fontWeight: 600, cursor: credSaving ? 'default' : 'pointer', background: 'linear-gradient(135deg,#7C6FCD,#5a4fbf)', color: '#fff', boxShadow: '0 3px 12px rgba(124,111,205,0.28)', opacity: credSaving ? 0.65 : 1, whiteSpace: 'nowrap' }}>
                    <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"><rect x="3" y="11" width="18" height="11" rx="2"/><path d="M7 11V7a5 5 0 0 1 10 0v4"/></svg>
                    {credSaving ? 'Saving...' : (form.email ? 'Update Credentials' : 'Activate Account')}
                  </button>
                  {credSuccess && (
                    <span style={{ fontSize: 12, color: '#059669', fontWeight: 600, display: 'flex', alignItems: 'center', gap: 5, marginTop: 8 }}>
                      <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="#059669" strokeWidth="2.5"><polyline points="20 6 9 17 4 12"/></svg>
                      {credSuccess}
                    </span>
                  )}
                  {credError && (
                    <div style={{ padding: '8px 12px', borderRadius: 8, background: '#FFE8E8', border: '1px solid #FFCCCC', display: 'flex', gap: 6, alignItems: 'center', marginTop: 8 }}>
                      <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="#C0392B" strokeWidth="2"><circle cx="12" cy="12" r="10"/><line x1="12" y1="8" x2="12" y2="12"/></svg>
                      <span style={{ fontSize: 12, color: '#C0392B', fontWeight: 500 }}>{credError}</span>
                    </div>
                  )}
                </div>
              </div>
            </div>
          </div>
        )}

        {/* ── Schedule Section (full width row) ── */}
        {!isNew && (
          <ScheduleSection facultyName={form.name} onUnitsLoaded={setScheduleUnits} onAssignmentsLoaded={setScheduleAssignments} />
        )}
        </div>{/* end flex-col wrapper */}
      </form>

      {showSpecModal && (
        <SpecializationModal
          specializations={form.specializations}
          onSave={isNew ? function(specs) { setForm(function(f) { return Object.assign({}, f, { specializations: dedupeSpecs(specs) }) }); setShowSpecModal(false) } : handleSaveSpecs}
          isSaving={specSaving}
          onClose={function() { setShowSpecModal(false) }}
        />
      )}
      {showArchiveModal && (
        <div style={{ position: 'fixed', inset: 0, zIndex: 1100, background: 'rgba(26,26,46,0.5)', backdropFilter: 'blur(4px)', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 24 }}>
          <div style={{ background: '#fff', borderRadius: 18, padding: '28px 28px 24px', maxWidth: 400, width: '100%', boxShadow: '0 20px 60px rgba(26,26,46,0.22)', textAlign: 'center' }}>
            <div style={{ width: 52, height: 52, borderRadius: '50%', background: '#FEF3CD', margin: '0 auto 16px', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
              <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="#D97706" strokeWidth="2">
                <path d="M21 8v13H3V8"/><path d="M23 3H1v5h22z"/><line x1="10" y1="12" x2="14" y2="12"/>
              </svg>
            </div>
            <div style={{ fontSize: 16, fontWeight: 700, color: '#1a1a2e', marginBottom: 8 }}>Archive Faculty Member?</div>
            <div style={{ fontSize: 13, color: '#8883B0', marginBottom: 24, lineHeight: 1.5 }}>
              <strong style={{ color: '#1a1a2e' }}>{form.name}</strong> will be hidden from active scheduling. You can restore them at any time.
            </div>
            <div style={{ display: 'flex', gap: 10 }}>
              <button onClick={function() { setShowArchiveModal(false) }} disabled={archiving} style={{ flex: 1, padding: '10px', borderRadius: 9, border: '1.5px solid #E8E4F8', background: '#fff', fontSize: 13, fontWeight: 600, color: '#8883B0', cursor: 'pointer', fontFamily: "'Poppins',sans-serif" }}>Cancel</button>
              <button onClick={handleArchive} disabled={archiving} style={{ flex: 1, padding: '10px', borderRadius: 9, border: 'none', background: 'linear-gradient(135deg,#D97706,#B45309)', fontSize: 13, fontWeight: 700, color: '#fff', cursor: archiving ? 'default' : 'pointer', fontFamily: "'Poppins',sans-serif", opacity: archiving ? 0.7 : 1 }}>
                {archiving ? 'Archiving…' : 'Archive'}
              </button>
            </div>
          </div>
        </div>
      )}
      {showDeleteModal && (
        <DeleteConfirmModal name={form.name} deleting={deleting} onConfirm={handleDelete} onCancel={function() { setShowDeleteModal(false) }} />
      )}

      {/* Toast Notifications */}
      <ToastContainer toasts={toasts} />
    </div>
  )
}