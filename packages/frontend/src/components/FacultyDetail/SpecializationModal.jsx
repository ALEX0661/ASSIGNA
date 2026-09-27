import { useState, useEffect, useMemo, useCallback, useRef } from 'react'
import { getCourses } from '../../services/api'
import { dedupeSpecs } from './fdShared'
import { useTour } from '../../hooks/useTour.jsx'
import UnsavedChangesModal from '../UnsavedChangesModal' // adjust path to match your project structure

const isDark = document.documentElement.getAttribute('data-mode') === 'dark';

// ─── Proficiency levels ───────────────────────────────────────────────────────
const LEVELS = [
  { rating: 1, label: 'Beginner',   short: 'BEG',  color: '#EF4444', bg: 'rgba(239, 68, 68, 0.05)', border: 'rgba(220, 38, 38, 0.25)', dot: '#EF4444', hoverBg: 'rgba(239, 68, 68, 0.1)' },
  { rating: 2, label: 'Developing', short: 'DEV',  color: '#F59E0B', bg: 'rgba(245, 158, 11, 0.05)', border: 'rgba(245, 158, 11, 0.25)', dot: '#F59E0B', hoverBg: 'rgba(245, 158, 11, 0.1)' },
  { rating: 3, label: 'Competent',  short: 'COMP', color: '#A78BFA', bg: 'rgba(124, 58, 237, 0.1)', border: 'color-mix(in srgb, #6D28D9 30%, transparent)', dot: '#7C3AED', hoverBg: 'color-mix(in srgb, #6D28D9 15%, transparent)' },
  { rating: 4, label: 'Proficient', short: 'PROF', color: '#60A5FA', bg: 'rgba(37, 99, 235, 0.1)', border: '#BFDBFE', dot: '#3B82F6', hoverBg: 'rgba(59, 130, 246, 0.1)' },
  { rating: 5, label: 'Expert',     short: 'EXP',  color: 'var(--meadow-text-hover)', bg: 'var(--meadow-soft)', border: 'var(--meadow-border)', dot: '#10B981', hoverBg: 'var(--meadow-soft)' },
]
const getLvl = r => LEVELS.find(l => l.rating === (r || 3)) || LEVELS[2]

const SEMESTERS = ['All', '1st Semester', '2nd Semester', 'Midyear']

// ─── General-ed / non-specialization course codes ─────────────────────────────
// These are excluded from the Browse Catalog (and the blank import template)
// since faculty aren't rated on them as a "specialization". Matched as a
// prefix immediately followed by a digit, so e.g. "GEC101", "NSTP2", "PE1",
// and "MAT101" all match, but a code that merely contains one of these
// letters somewhere else (e.g. "COMPE101") does not.
// Adjust this list to match your school's actual course-code scheme.
const EXCLUDED_COURSE_PREFIXES = ['GEC', 'NSTP', 'PE', 'MAT']
function isExcludedCourse(code) {
  const c = (code || '').toUpperCase().replace(/\s+/g, '')
  return EXCLUDED_COURSE_PREFIXES.some(p => new RegExp(`^${p}\\d`).test(c))
}

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
            className="spec-pip"
            onClick={() => onChange(l.rating)}
            onMouseEnter={() => setHovered(l.rating)}
            onMouseLeave={() => setHovered(null)}
            style={{
              width: isSmall ? 24 : 28, height: isSmall ? 24 : 28,
              borderRadius: 7, border: `1.5px solid ${show ? l.border : '#E9E6F5'}`,
              background: show ? l.bg : 'var(--surface)',
              color: show ? l.color : 'var(--muted)',
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
          borderRadius: 9, border: '1.5px solid var(--border)',
          fontSize: 12.5, fontFamily: "'Inter', sans-serif",
          boxSizing: 'border-box', outline: 'none',
          background: 'var(--bg)', color: 'var(--ink)',
        }}
      />
      {value && (
        <button type="button" onClick={() => onChange('')}
          style={{ position: 'absolute', right: 9, top: '50%', transform: 'translateY(-50%)', background: 'none', border: 'none', cursor: 'pointer', padding: 2, display: 'flex', color: 'var(--muted2)' }}>
          <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"><line x1="18" y1="6" x2="6" y2="18" /><line x1="6" y1="6" x2="18" y2="18" /></svg>
        </button>
      )}
    </div>
  )
}

function NavBtn({ active, onClick, icon, label, badge }) {
  return (
    <button type="button" onClick={onClick} className="spec-navbtn"
      style={{
        width: '100%', display: 'flex', alignItems: 'center', gap: 9,
        padding: '8px 11px', borderRadius: 8, border: 'none',
        background: active ? 'var(--meadow-soft)' : 'transparent',
        color: active ? ('var(--meadow-text-hover)') : 'var(--muted)',
        cursor: 'pointer', fontFamily: "'Inter', sans-serif",
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
          background: active ? 'var(--meadow)' : 'var(--hover)',
          color: active ? '#fff' : 'var(--muted)',
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
        padding: '5px 10px', borderRadius: 7,
        border: active ? '1.5px solid var(--meadow-border)' : '1.5px solid transparent',
        background: active ? 'var(--meadow-soft)' : 'transparent',
        color: active ? ('var(--meadow-text-hover)') : 'var(--muted2)',
        fontSize: 11.5, fontWeight: active ? 700 : 500,
        cursor: 'pointer', fontFamily: "'Inter', sans-serif",
        display: 'flex', alignItems: 'center', gap: 5,
        transition: 'all 0.12s', whiteSpace: 'nowrap',
      }}>
      {label}
      {count != null && (
        <span style={{
          fontSize: 10, fontWeight: 700, minWidth: 17, height: 17,
          borderRadius: 99, display: 'inline-flex', alignItems: 'center', justifyContent: 'center',
          background: active ? 'var(--meadow-border)' : 'var(--hover)',
          color: active ? ('var(--meadow-text-hover)') : 'var(--muted)', padding: '0 4px',
        }}>{count}</span>
      )}
    </button>
  )
}

// ─── Main ─────────────────────────────────────────────────────────────────────
export default function SpecializationModal({ specializations, onSave, onClose, isSaving }) {

  const [specs,       setSpecs]       = useState(() => dedupeSpecs(specializations))
  const [tab,         setTab]         = useState('current')

  // Snapshot of what was last saved (or what we started with). Compared
  // against the live `specs` (plus any not-yet-committed staged courses)
  // to know whether there's anything the Save button hasn't captured yet.
  // Snapshot of what was last saved (or what we started with) — kept as the
  // actual array (not just a string) so individual rows can be compared
  // against it to show exactly which one changed, not just "something did".
  const [savedBaseline, setSavedBaseline] = useState(() => dedupeSpecs(specializations))
  // Bumped only when Save actually commits, so caches below know when it's
  // safe to forget an unsaved edit's place in a filter (see levelMatchKeys).
  const [saveVersion, setSaveVersion] = useState(0)
  const baselineMap = useMemo(() => {
    const m = new Map()
    savedBaseline.forEach(s => m.set((s.courseCode || '').toLowerCase().trim(), s))
    return m
  }, [savedBaseline])

  // ── Assigned tab state
  const [currentQ,   setCurrentQ]    = useState('')
  const [sortBy,     setSortBy]      = useState('rating-desc')
  const [assignedProgram, setAssignedProgram] = useState('All')
  const [assignedLevel,   setAssignedLevel]   = useState('All')
  const [editedOnly,      setEditedOnly]      = useState(false) // show only rows changed (or added) but not yet saved, for review
  // True the moment any rating gets edited on the Assigned tab; blocks
  // re-sorting (and gets called out in the toolbar) until Save is clicked,
  // so a batch of edits can't get scattered across the list mid-edit.
  const [ratingsDirty, setRatingsDirty] = useState(false)

  // ── Browse tab state
  const [browseQ,    setBrowseQ]     = useState('')
  const [activeSem,  setActiveSem]   = useState('All')
  const [activeProgram, setActiveProgram] = useState('All')
  const [hideAssigned, setHideAssigned] = useState(false)
  const [stagedOnly,  setStagedOnly]   = useState(false) // show only courses you've rated but not yet added, for review before committing
  const [pending,    setPending]     = useState({}) // { courseCode: { rating, title } }
  const [allCourses, setAllCourses]  = useState([]) // full catalog, incl. gen-ed — used for title lookups
  const [loadingCrs, setLoadingCrs]  = useState(false)

  // ── Manual tab state (removed — only catalog-based adding allowed)
  const [newCode] = useState('')    // kept to avoid reference errors
  const [codeError] = useState('')  // kept to avoid reference errors

  // Lock the page's own scroll while this modal is open. It's a fixed,
  // full-viewport overlay, so the page behind it never needs to move —
  // but without this, the underlying page's scroll container (<main>,
  // per the useTour hook's own notes on this app's layout) is still the
  // "nearest scrollable ancestor" that Joyride and other scroll-into-view
  // logic can end up nudging, which reads as the background page
  // scrolling behind the modal.
  useEffect(() => {
    const main = document.querySelector('main') || document.body
    const prevOverflow = main.style.overflow
    main.style.overflow = 'hidden'
    return () => { main.style.overflow = prevOverflow }
  }, [])

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
        setAllCourses(norm.filter(c => {
          const k = (c.courseCode || c.title).toLowerCase()
          if (seen.has(k)) return false; seen.add(k); return true
        }))
      })
      .catch(() => setAllCourses([]))
      .finally(() => setLoadingCrs(false))
  }, [])

  // Browsable/assignable courses — excludes GEC/NSTP/PE/MATH-type courses.
  // Anything already assigned before this exclusion existed still shows
  // fine in the Assigned tab (its title is resolved below from the full,
  // unfiltered catalog).
  const courses = useMemo(() => allCourses.filter(c => !isExcludedCourse(c.courseCode)), [allCourses])

  const existingCodes  = useMemo(() => new Set(specs.map(s => (s.courseCode || '').toLowerCase().trim())), [specs])
  const courseTitleMap = useMemo(() => {
    const m = {}
    allCourses.forEach(c => { 
      if (c.courseCode) {
        const normalized = c.courseCode.toLowerCase().replace(/\s+/g, '')
        m[normalized] = c.title || '' 
      }
    })
    return m
  }, [allCourses])

  const programs = useMemo(() => {
    const set = new Set(courses.map(c => c.program).filter(Boolean))
    return Array.from(set).sort()
  }, [courses])

  // Course code → program, for filtering the Assigned list by program too
  // (a spec only stores courseCode/title/rating, not program, so this looks
  // it up from the full catalog).
  const courseProgramMap = useMemo(() => {
    const m = {}
    allCourses.forEach(c => {
      if (c.courseCode) m[c.courseCode.toLowerCase().replace(/\s+/g, '')] = c.program || ''
    })
    return m
  }, [allCourses])

  // Semester → courses map
  const coursesBySemester = useMemo(() => {
    const map = { All: courses }
    SEMESTERS.slice(1).forEach(sem => {
      map[sem] = courses.filter(c => c.semester === sem)
    })
    return map
  }, [courses])

  const filteredBrowse = useMemo(() => {
    let base = coursesBySemester[activeSem] || []
    if (activeProgram !== 'All') base = base.filter(c => c.program === activeProgram)
    if (hideAssigned) base = base.filter(c => !existingCodes.has(c.courseCode.toLowerCase()))
    if (stagedOnly) base = base.filter(c => pending[c.courseCode] != null)
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
  }, [coursesBySemester, activeSem, activeProgram, hideAssigned, stagedOnly, browseQ, existingCodes, pending])

  const validSpecs = useMemo(() => specs.filter(s => !s.isUnmatched || courseTitleMap[(s.courseCode || '').toLowerCase().replace(/\s+/g, '')]), [specs, courseTitleMap])
  const unmatchedList = useMemo(() => specs.filter(s => s.isUnmatched && !courseTitleMap[(s.courseCode || '').toLowerCase().replace(/\s+/g, '')]), [specs, courseTitleMap])

  // Row order for the Assigned list is frozen while you're just editing
  // ratings — it's only recomputed when the sort mode changes or when a
  // course is added/removed (via validCodesSignature), never as a side
  // effect of clicking a rating pip. Without this, every rating edit
  // instantly re-sorts the whole list out from under you.
  const specKey = s => s.courseCode || s.title || ''
  const sortSpecs = (list, mode) => {
    const src = [...list]
    if (mode === 'code-asc')    src.sort((a, b) => (a.courseCode || '').localeCompare(b.courseCode || ''))
    if (mode === 'rating-desc') src.sort((a, b) => (b.rating || 3) - (a.rating || 3))
    if (mode === 'rating-asc')  src.sort((a, b) => (a.rating || 3) - (b.rating || 3))
    return src
  }
  const validCodesSignature = useMemo(() => validSpecs.map(specKey).slice().sort().join('|'), [validSpecs])
  const [orderKeys, setOrderKeys] = useState(() => sortSpecs(validSpecs, sortBy).map(specKey))

  useEffect(() => {
    setOrderKeys(sortSpecs(validSpecs, sortBy).map(specKey))
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [sortBy, validCodesSignature])

  // Same freezing idea, applied to the Level filter: which rows match a given
  // level is computed once per level and cached, not recalculated every time
  // you land on that level. Without the cache, filtering Beginner → editing a
  // row's rating → switching to another filter → switching back to Beginner
  // would recompute from the now-changed rating and the edited row would
  // vanish. The cache is only thrown out when courses are added/removed or
  // when Save actually commits (saveVersion) — never just from switching
  // filters — so an edited-but-unsaved row stays visible under whichever
  // level filter it matched when you started editing it.
  const levelMatchCacheRef = useRef({ signature: null, map: new Map() })
  const [levelMatchKeys, setLevelMatchKeys] = useState(null) // null = 'All', no filtering
  useEffect(() => {
    if (assignedLevel === 'All') { setLevelMatchKeys(null); return }
    const cacheSignature = `${validCodesSignature}::${saveVersion}`
    const cache = levelMatchCacheRef.current
    if (cache.signature !== cacheSignature) {
      cache.signature = cacheSignature
      cache.map = new Map()
    }
    if (!cache.map.has(assignedLevel)) {
      cache.map.set(assignedLevel, new Set(validSpecs.filter(s => (s.rating || 3) === assignedLevel).map(specKey)))
    }
    setLevelMatchKeys(cache.map.get(assignedLevel))
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [assignedLevel, validCodesSignature, saveVersion])

  // Programs represented among the currently assigned courses (looked up
  // from the catalog since a spec itself doesn't carry a program field).
  const assignedPrograms = useMemo(() => {
    const set = new Set()
    validSpecs.forEach(s => {
      const p = courseProgramMap[(s.courseCode || '').toLowerCase().replace(/\s+/g, '')]
      if (p) set.add(p)
    })
    return Array.from(set).sort()
  }, [validSpecs, courseProgramMap])

  const filteredSpecs = useMemo(() => {
    const q     = currentQ.toLowerCase()
    const byKey = new Map(validSpecs.map(s => [specKey(s), s]))
    // Follow the frozen order; append anything not yet folded into it
    // (e.g. the first render, before the effect above runs) so nothing
    // is ever silently hidden.
    const ordered = orderKeys.map(k => byKey.get(k)).filter(Boolean)
    const seen = new Set(orderKeys)
    validSpecs.forEach(s => { if (!seen.has(specKey(s))) ordered.push(s) })
    let list = ordered
    if (assignedProgram !== 'All') {
      list = list.filter(s => courseProgramMap[(s.courseCode || '').toLowerCase().replace(/\s+/g, '')] === assignedProgram)
    }
    if (levelMatchKeys) {
      list = list.filter(s => levelMatchKeys.has(specKey(s)))
    }
    if (editedOnly) {
      list = list.filter(s => {
        const b = baselineMap.get((s.courseCode || '').toLowerCase().trim())
        return !b || (b.rating || 3) !== (s.rating || 3)
      })
    }
    if (!q) return list
    return list.filter(s => {
      const code  = (s.courseCode || '').toLowerCase()
      const title = (s.title || courseTitleMap[code] || '').toLowerCase()
      return code.includes(q) || title.includes(q)
    })
  }, [validSpecs, orderKeys, currentQ, courseTitleMap, assignedProgram, levelMatchKeys, editedOnly, baselineMap, courseProgramMap])

  const unmatchedSpecs = useMemo(() => {
    const q   = currentQ.toLowerCase()
    const src = [...unmatchedList]
    if (sortBy === 'code-asc')    src.sort((a, b) => (a.courseCode || '').localeCompare(b.courseCode || ''))
    if (sortBy === 'rating-desc') src.sort((a, b) => (b.rating || 3) - (a.rating || 3))
    if (sortBy === 'rating-asc')  src.sort((a, b) => (a.rating || 3) - (b.rating || 3))
    if (!q) return src
    return src.filter(s => {
      const code  = (s.courseCode || '').toLowerCase()
      const title = (s.title || courseTitleMap[code] || '').toLowerCase()
      return code.includes(q) || title.includes(q)
    })
  }, [unmatchedList, sortBy, currentQ, courseTitleMap])

  const pendingList   = useMemo(() => Object.entries(pending).map(([code, info]) => ({ code, ...info })), [pending])
  const pendingCount  = pendingList.length
  const specCount     = validSpecs.length
  const unmatchedCount = unmatchedList.length

  // True whenever there's something Save hasn't captured yet — an edited/
  // added/removed spec, or courses staged in Browse Catalog that haven't
  // been committed with "Add N Courses" yet.
  const hasUnsavedChanges = useMemo(
    () => JSON.stringify(specs) !== JSON.stringify(savedBaseline) || pendingCount > 0,
    [specs, savedBaseline, pendingCount]
  )

  // Breakdown of what's not yet saved, for the toolbar counter — how many
  // ratings were edited, how many rows were removed, how many are new.
  const editedCount = useMemo(() => validSpecs.reduce((n, s) => {
    const b = baselineMap.get((s.courseCode || '').toLowerCase().trim())
    return n + (b && (b.rating || 3) !== (s.rating || 3) ? 1 : 0)
  }, 0), [validSpecs, baselineMap])
  const newCount = useMemo(
    () => validSpecs.filter(s => !baselineMap.has((s.courseCode || '').toLowerCase().trim())).length,
    [validSpecs, baselineMap]
  )
  useEffect(() => {
    if (editedOnly && editedCount === 0 && newCount === 0) setEditedOnly(false)
  }, [editedOnly, editedCount, newCount])

  // Warn on tab close / reload while there are unsaved changes.
  useEffect(() => {
    if (!hasUnsavedChanges) return
    const handler = e => { e.preventDefault(); e.returnValue = '' }
    window.addEventListener('beforeunload', handler)
    return () => window.removeEventListener('beforeunload', handler)
  }, [hasUnsavedChanges])

  // Confirm before closing the modal if there's anything unsaved.
  const [confirmClose, setConfirmClose] = useState(false)
  function handleClose() {
    if (hasUnsavedChanges) { setConfirmClose(true); return }
    onClose()
  }
  const removedCount = useMemo(() => {
    const currentCodes = new Set(specs.map(s => (s.courseCode || '').toLowerCase().trim()))
    return savedBaseline.filter(s => !currentCodes.has((s.courseCode || '').toLowerCase().trim())).length
  }, [specs, savedBaseline])

  const { TourElement, startTour } = useTour('facultySpecModal', [
    {
      target: '#tour-spec-nav',
      title: 'Assigned vs. Browse',
      content: 'Assigned lists what this faculty member is already qualified to teach. Browse Catalog is where you search all courses and stage new ones to add.',
      disableBeacon: true,
      disableScrolling: true,
    },
    {
      target: '#tour-spec-current-toolbar',
      title: 'Filter & Sort',
      content: 'Filter the assigned list by code or title, or sort by proficiency to see their strongest (or weakest) areas first.',
      disableScrolling: true,
    },
    {
      target: '#tour-spec-breakdown',
      title: 'Proficiency Breakdown',
      content: 'A quick count of how their assigned courses split across proficiency levels — useful for spotting whether they\'re mostly rated as experts or still developing.',
      disableScrolling: true,
    },
    {
      target: '#tour-spec-footer',
      title: 'Save Your Changes',
      content: 'Nothing is applied to the faculty member\'s record until you save here — staged courses from Browse Catalog are only committed at this point too.',
      disableScrolling: true,
    },
  ], true, { isPrimary: false })


  const breakdown = useMemo(() => {
    const counts = {}
    validSpecs.forEach(s => { const r = s.rating || 3; counts[r] = (counts[r] || 0) + 1 })
    return LEVELS.slice().reverse().filter(l => counts[l.rating]).map(l => ({ ...l, count: counts[l.rating] }))
  }, [validSpecs])

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
    <div className="spec-overlay" style={{
      position: 'fixed', inset: 0, zIndex: 1000,
      background: 'rgba(10,8,28,0.55)', backdropFilter: 'blur(6px)',
      display: 'flex', alignItems: 'center', justifyContent: 'center',
      padding: '20px 16px',
      fontFamily: "'Inter', sans-serif",
    }}>
      {TourElement}
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700&display=swap');
        .spec-scroll::-webkit-scrollbar { width: 5px }
        .spec-scroll::-webkit-scrollbar-track { background: transparent }
        .spec-scroll::-webkit-scrollbar-thumb { background: var(--border); border-radius: 99px }
        @keyframes spin { to { transform: rotate(360deg) } }
        @keyframes fadeUp { from { opacity:0; transform:translateY(6px) } to { opacity:1; transform:translateY(0) } }
        @keyframes pulseGlow {
          0%, 100% { box-shadow: 0 4px 14px rgba(0,0,0,0.28), 0 0 0 0 rgba(245,158,11,0.55); }
          50%      { box-shadow: 0 4px 14px rgba(0,0,0,0.28), 0 0 0 6px rgba(245,158,11,0); }
        }
        .spec-save-glow { animation: pulseGlow 1.6s ease-in-out infinite; }
        @keyframes dotPulse { 0%, 100% { opacity: 1; } 50% { opacity: 0.35; } }

        /* ── Responsive: tablet ─────────────────────────────────────────── */
        @media (max-width: 860px) {
          .spec-sidebar { width: 168px !important; }
        }

        /* ── Responsive: mobile ─────────────────────────────────────────── */
        @media (max-width: 680px) {
          .spec-overlay { padding: 0 !important; }
          .spec-modal { width: 100% !important; height: 100% !important; max-height: 100dvh !important; border-radius: 0 !important; }

          .spec-header { padding: 12px 14px !important; flex-wrap: wrap !important; row-gap: 10px !important; }
          .spec-header-actions { order: 2 !important; }
          .spec-header-badges { order: 3 !important; flex: 1 1 100% !important; }
          .spec-header-subtitle { display: none !important; }

          .spec-body { flex-direction: column !important; }
          .spec-sidebar { width: 100% !important; flex-direction: row !important; align-items: stretch !important;
            overflow-x: visible !important; border-right: none !important; border-bottom: 1px solid var(--border) !important;
            padding: 8px 10px !important; gap: 6px !important; }
          .spec-sidebar-label, .spec-sidebar-breakdown { display: none !important; }
          .spec-sidebar-nav { display: flex !important; gap: 6px !important; flex: 1 !important; }
          .spec-navbtn { flex: 1 1 0 !important; width: auto !important; justify-content: center !important;
            text-align: center !important; white-space: normal !important; line-height: 1.15 !important;
            padding: 9px 4px !important; min-height: 40px !important; }
          .spec-navbtn > span:nth-child(2) { flex: 0 1 auto !important; }

          .spec-search-wrap { width: 100% !important; flex: 1 1 100% !important; }
          .spec-toolbar-row select { flex: 1 1 auto !important; min-width: 0 !important; padding: 9px 8px !important; font-size: 13px !important; }
          .spec-toolbar-row { width: 100% !important; }
          .spec-toolbar-divider { display: none !important; }
          .spec-toolbar-sort { width: 100% !important; justify-content: space-between !important; }

          .spec-assigned-row { flex-wrap: wrap !important; }
          .spec-row-main { flex: 1 1 100% !important; }
          .spec-row-actions { flex: 1 1 100% !important; justify-content: space-between !important; margin-top: 10px !important; padding-left: 15px !important; flex-wrap: wrap !important; row-gap: 10px !important; }
          .spec-remove-btn { width: auto !important; padding: 0 14px !important; gap: 6px !important; }
          .spec-remove-label { display: inline !important; font-size: 11.5px !important; font-weight: 700 !important; }
          .spec-row-actions-label { display: inline !important; }

          /* Let the course title take its own full line and wrap normally
             instead of being squeezed by the level/edited badges and cut
             off with an ellipsis — badges flow to the line below it. */
          .spec-info-header { flex-wrap: wrap !important; row-gap: 4px !important; }
          .spec-info-title { flex: 1 1 100% !important; white-space: normal !important; overflow: visible !important; text-overflow: clip !important; line-height: 1.3 !important; }

          .spec-browse-row { flex-wrap: wrap !important; }
          .spec-browse-info { flex: 1 1 100% !important; }
          .spec-browse-actions { flex: 1 1 100% !important; justify-content: flex-start !important; margin-top: 10px !important; }

          .spec-pip { width: 34px !important; height: 34px !important; font-size: 12px !important; }

          .spec-footer { flex-direction: column !important; align-items: stretch !important; gap: 10px !important; padding: 12px 16px !important; }
          .spec-footer-info { text-align: left !important; }
          .spec-footer-actions { width: 100% !important; }
          .spec-footer-actions button { flex: 1 1 0 !important; padding: 12px 14px !important; }
        }
      `}</style>

      <div className="spec-modal" style={{
        background: 'var(--surface)', borderRadius: 18, width: '100%', maxWidth: 1180,
        boxShadow: '0 28px 80px rgba(10,8,28,0.2), 0 0 0 1px rgba(0,0,0,0.05)',
        overflow: 'hidden', display: 'flex', flexDirection: 'column', maxHeight: '90vh',
      }}>

        {/* ── Header ─────────────────────────────────────────────────────── */}
        <div className="spec-header" style={{
          padding: '16px 22px', borderBottom: '1px solid var(--border)',
          display: 'flex', alignItems: 'center', gap: 12, flexShrink: 0,
          background: 'linear-gradient(to right, var(--hover), var(--hover))',
        }}>
          <div className="spec-header-title-group" style={{ display: 'flex', alignItems: 'center', gap: 12, minWidth: 0, flex: 1, order: 1 }}>
            <div style={{
              width: 36, height: 36, borderRadius: 10,
              background: 'linear-gradient(135deg, var(--meadow) 0%, var(--meadow-deep) 100%)',
              display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0,
            }}>
              <svg width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="#fff" strokeWidth="2">
                <path d="M4 19.5A2.5 2.5 0 0 1 6.5 17H20" /><path d="M6.5 2H20v20H6.5A2.5 2.5 0 0 1 4 19.5v-15A2.5 2.5 0 0 1 6.5 2z" />
                <line x1="8" y1="7" x2="16" y2="7" /><line x1="8" y1="11" x2="12" y2="11" />
              </svg>
            </div>
            <div style={{ flex: 1, minWidth: 0 }}>
              <div style={{ fontSize: 15, fontWeight: 700, color: 'var(--ink)', letterSpacing: '-0.2px' }}>Manage Specializations</div>
              <div className="spec-header-subtitle" style={{ fontSize: 12, color: 'var(--muted)', marginTop: 1 }}>Assign courses and set proficiency levels</div>
            </div>
          </div>

          {/* Tour + close — always stay pinned on the title's row, never wrap onto their own line */}
          <div className="spec-header-actions" style={{ display: 'flex', alignItems: 'center', gap: 8, flexShrink: 0, order: 3 }}>
            <button type="button" onClick={() => startTour()} title="Take the tour"
              style={{ width: 32, height: 32, borderRadius: 8, border: '1px solid var(--border)', background: 'var(--bg)', display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer', padding: 0, flexShrink: 0, color: 'var(--muted)', fontSize: 13, fontWeight: 700, fontFamily: "'Inter', sans-serif" }}>
              ?
            </button>
            <button onClick={handleClose}
              style={{ width: 32, height: 32, borderRadius: 8, border: '1px solid var(--border)', background: 'var(--bg)', display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer', padding: 0, flexShrink: 0 }}>
              <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="var(--muted)" strokeWidth="2.5"><line x1="18" y1="6" x2="6" y2="18" /><line x1="6" y1="6" x2="18" y2="18" /></svg>
            </button>
          </div>

          {/* Status badges — wrap onto their own full-width row on mobile, below the title/action row */}
          {(specCount > 0 || hasUnsavedChanges) && (
            <div className="spec-header-badges" style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap', order: 2 }}>
              {specCount > 0 && (
                <div style={{ padding: '3px 11px', borderRadius: 99, background: 'var(--meadow-soft)', border: '1px solid var(--meadow-border)' }}>
                  <span style={{ fontSize: 11.5, fontWeight: 700, color: 'var(--meadow-text-hover)' }}>{specCount} assigned</span>
                </div>
              )}
              {hasUnsavedChanges && (
                <div title="You have changes that haven't been saved yet" style={{ display: 'inline-flex', alignItems: 'center', gap: 6, padding: '3px 11px', borderRadius: 99, background: 'rgba(245, 158, 11, 0.1)', border: '1px solid rgba(245, 158, 11, 0.35)' }}>
                  <span style={{ width: 6, height: 6, borderRadius: '50%', background: '#F59E0B', animation: 'dotPulse 1.4s ease-in-out infinite' }} />
                  <span style={{ fontSize: 11.5, fontWeight: 700, color: '#B45309' }}>Unsaved changes</span>
                </div>
              )}
            </div>
          )}
        </div>


        {/* ── Body ───────────────────────────────────────────────────────── */}
        <div className="spec-body" style={{ flex: 1, display: 'flex', overflow: 'hidden' }}>

          {/* Sidebar */}
          <div className="spec-sidebar" style={{ width: 208, flexShrink: 0, borderRight: '1px solid var(--border)', display: 'flex', flexDirection: 'column', padding: '12px 10px', gap: 2, background: 'var(--bg)' }}>
            <div className="spec-sidebar-label" style={{ fontSize: 9.5, fontWeight: 700, color: 'var(--muted2)', textTransform: 'uppercase', letterSpacing: '0.8px', padding: '4px 11px 8px' }}>Navigation</div>

            <div id="tour-spec-nav" className="spec-sidebar-nav">
              <NavBtn active={tab === 'current'} onClick={() => setTab('current')}
                icon={<><path d="M4 19.5A2.5 2.5 0 0 1 6.5 17H20" /><path d="M6.5 2H20v20H6.5A2.5 2.5 0 0 1 4 19.5v-15A2.5 2.5 0 0 1 6.5 2z" /></>}
                label="Assigned" badge={specCount} />
              <NavBtn active={tab === 'browse'} onClick={() => setTab('browse')}
                icon={<><circle cx="11" cy="11" r="8" /><line x1="21" y1="21" x2="16.65" y2="16.65" /></>}
                label="Browse Catalog" badge={pendingCount || null} />
              {unmatchedCount > 0 && (
                <NavBtn active={tab === 'unmatched'} onClick={() => setTab('unmatched')}
                  icon={<><path d="M10.29 3.86L1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z"/><line x1="12" y1="9" x2="12" y2="13"/><line x1="12" y1="17" x2="12.01" y2="17"/></>}
                  label="Needs Review" badge={unmatchedCount} />
              )}
            </div>

            {specCount > 0 && (
              <div id="tour-spec-breakdown" className="spec-sidebar-breakdown" style={{ marginTop: 'auto', paddingTop: 14 }}>
                <div style={{ height: 1, background: 'var(--border)', marginBottom: 12 }} />
                <div style={{ fontSize: 9.5, fontWeight: 700, color: 'var(--muted2)', textTransform: 'uppercase', letterSpacing: '0.8px', padding: '0 11px', marginBottom: 8 }}>Breakdown</div>
                <div style={{ display: 'flex', flexDirection: 'column', gap: 3, padding: '0 2px' }}>
                  {breakdown.map(l => (
                    <div key={l.rating} style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '4px 9px', borderRadius: 7 }}>
                      <span style={{ width: 6, height: 6, borderRadius: '50%', background: l.dot, flexShrink: 0 }} />
                      <span style={{ fontSize: 11.5, color: 'var(--ink2)', flex: 1 }}>{l.label}</span>
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
                <div style={{ padding: '12px 18px 10px', borderBottom: '1px solid var(--border)', flexShrink: 0 }} id="tour-spec-current-toolbar">
                  {/* Everything — search, program, level, sort — in one wrapping row. Each
                      control is sized to its content (no flex:1 search box hogging space) so
                      they pack tightly instead of forcing filters onto their own line. */}
                  <div className="spec-toolbar-row" style={{ display: 'flex', alignItems: 'center', gap: 6, flexWrap: 'wrap', rowGap: 8 }}>
                    <div className="spec-search-wrap" style={{ width: 180, flexShrink: 0 }}>
                      <SearchBox value={currentQ} onChange={setCurrentQ} placeholder="Filter by code or title…" />
                    </div>

                    {assignedPrograms.length > 1 && (
                      <select value={assignedProgram} onChange={e => setAssignedProgram(e.target.value)}
                        style={{ padding: '6px 8px', borderRadius: 7, border: '1.5px solid var(--border)', background: 'var(--bg)', color: 'var(--ink)', fontSize: 11.5, fontWeight: 500, fontFamily: "'Inter', sans-serif", cursor: 'pointer', flexShrink: 0 }}>
                        <option value="All">All Programs</option>
                        {assignedPrograms.map(p => <option key={p} value={p}>{p}</option>)}
                      </select>
                    )}

                    <select value={assignedLevel === 'All' ? 'All' : String(assignedLevel)}
                      onChange={e => setAssignedLevel(e.target.value === 'All' ? 'All' : Number(e.target.value))}
                      style={{ padding: '6px 8px', borderRadius: 7, border: '1.5px solid var(--border)', background: 'var(--bg)', color: 'var(--ink)', fontSize: 11.5, fontWeight: 500, fontFamily: "'Inter', sans-serif", cursor: 'pointer', flexShrink: 0 }}>
                      <option value="All">All Levels</option>
                      {LEVELS.map(l => <option key={l.rating} value={l.rating}>{l.label}</option>)}
                    </select>

                    <span className="spec-toolbar-divider" style={{ width: 1, alignSelf: 'stretch', minHeight: 20, background: 'var(--border)', margin: '0 2px', flexShrink: 0 }} />

                    <div className="spec-toolbar-sort" style={{ display: 'flex', alignItems: 'center', gap: 2, flexShrink: 0 }}>
                      <span style={{ fontSize: 11, color: 'var(--muted2)', fontWeight: 600, marginRight: 4 }}>Sort</span>
                      {[{ key: 'rating-desc', label: 'Best' }, { key: 'code-asc', label: 'A–Z' }, { key: 'rating-asc', label: 'Lowest' }].map(o => (
                        <button key={o.key} type="button" disabled={ratingsDirty} onClick={() => setSortBy(o.key)}
                          title={ratingsDirty ? 'Sorting is locked until you save your changes' : undefined}
                          style={{ padding: '4px 10px', borderRadius: 6, fontSize: 11.5, fontWeight: sortBy === o.key ? 700 : 500, background: sortBy === o.key ? 'var(--meadow-soft)' : 'transparent', color: ratingsDirty ? 'var(--muted2)' : (sortBy === o.key ? ('var(--meadow-text-hover)') : 'var(--muted)'), border: sortBy === o.key ? '1px solid var(--meadow-border)' : '1px solid transparent', cursor: ratingsDirty ? 'not-allowed' : 'pointer', opacity: ratingsDirty ? 0.5 : 1, fontFamily: "'Inter', sans-serif" }}>
                          {o.label}
                        </button>
                      ))}
                    </div>

                    {/* Review filter: show only rows changed or added but not yet saved */}
                    <button type="button" disabled={editedCount === 0 && newCount === 0} onClick={() => setEditedOnly(v => !v)}
                      title={editedCount === 0 && newCount === 0 ? 'Edit a rating or add a course to review it here' : undefined}
                      style={{
                        display: 'inline-flex', alignItems: 'center', gap: 6, flexShrink: 0,
                        padding: '5px 10px', borderRadius: 99, cursor: (editedCount === 0 && newCount === 0) ? 'not-allowed' : 'pointer',
                        border: `1px solid ${editedOnly ? 'rgba(245, 158, 11, 0.35)' : 'var(--border)'}`,
                        background: editedOnly ? 'rgba(245, 158, 11, 0.1)' : 'transparent',
                        color: (editedCount === 0 && newCount === 0) ? 'var(--muted2)' : (editedOnly ? '#B45309' : 'var(--muted)'),
                        opacity: (editedCount === 0 && newCount === 0) ? 0.55 : 1,
                        fontSize: 11, fontWeight: 600, fontFamily: "'Inter', sans-serif", whiteSpace: 'nowrap',
                      }}>
                      <span style={{
                        width: 12, height: 12, borderRadius: 3.5, flexShrink: 0,
                        border: `1.5px solid ${editedOnly ? '#B45309' : 'var(--muted2)'}`,
                        background: editedOnly ? '#B45309' : 'transparent',
                        display: 'flex', alignItems: 'center', justifyContent: 'center',
                      }}>
                        {editedOnly && <svg width="8" height="8" viewBox="0 0 24 24" fill="none" stroke="#fff" strokeWidth="3.5"><polyline points="20 6 9 17 4 12" /></svg>}
                      </span>
                      Edited only{(editedCount + newCount) > 0 ? ` (${editedCount + newCount})` : ''}
                    </button>

                    {/* Pending-changes counter — what Save will apply, at a glance */}
                    {(editedCount > 0 || removedCount > 0 || newCount > 0) && (
                      <span style={{ display: 'inline-flex', alignItems: 'center', gap: 4, marginLeft: 'auto', padding: '3px 8px', borderRadius: 99, background: 'rgba(245, 158, 11, 0.1)', border: '1px solid rgba(245, 158, 11, 0.3)', color: '#B45309', fontSize: 10.5, fontWeight: 700, whiteSpace: 'nowrap', flexShrink: 0 }}>
                        <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"><rect x="4" y="10" width="16" height="10" rx="2"/><path d="M8 10V7a4 4 0 0 1 8 0v3"/></svg>
                        {[
                          newCount > 0 && `${newCount} new`,
                          editedCount > 0 && `${editedCount} edited`,
                          removedCount > 0 && `${removedCount} removed`,
                        ].filter(Boolean).join(' · ')} — unsaved
                      </span>
                    )}
                  </div>
                </div>

                <div className="spec-scroll" style={{ flex: 1, overflowY: 'auto', padding: '14px 18px' }}>
                  {specs.length === 0 ? (
                    <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', padding: '56px 0', gap: 12, textAlign: 'center' }}>
                      <div style={{ width: 48, height: 48, borderRadius: 13, background: 'var(--meadow-soft)', border: '1px solid var(--meadow-border)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                        <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="var(--meadow)" strokeWidth="1.6"><path d="M4 19.5A2.5 2.5 0 0 1 6.5 17H20" /><path d="M6.5 2H20v20H6.5A2.5 2.5 0 0 1 4 19.5v-15A2.5 2.5 0 0 1 6.5 2z" /></svg>
                      </div>
                      <div>
                        <div style={{ fontSize: 14, fontWeight: 600, color: 'var(--ink)', marginBottom: 5 }}>No courses assigned yet</div>
                        <div style={{ fontSize: 12.5, color: 'var(--muted)', lineHeight: 1.7 }}>Browse the catalog or add a course code manually.</div>
                      </div>
                      <div style={{ display: 'flex', gap: 8, marginTop: 4 }}>
                        <button onClick={() => setTab('browse')} style={{ padding: '7px 16px', borderRadius: 9, border: 'none', background: 'linear-gradient(135deg,var(--meadow),var(--meadow-deep))', color: '#fff', fontSize: 12.5, fontWeight: 600, cursor: 'pointer', fontFamily: "'Inter', sans-serif" }}>Browse Catalog</button>
                      </div>
                    </div>
                  ) : filteredSpecs.length === 0 ? (
                    <div style={{ textAlign: 'center', padding: '40px 0', color: 'var(--muted)', fontSize: 13 }}>No courses match "{currentQ}".</div>
                  ) : (
                    <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
                      {filteredSpecs.map((spec, visIdx) => {
                        const origIdx = specs.indexOf(spec)
                        const title   = spec.title || courseTitleMap[(spec.courseCode || '').toLowerCase().trim()] || ''
                        const rating  = spec.rating || 3
                        const lvl     = getLvl(rating)
                        const baselineSpec = baselineMap.get((spec.courseCode || '').toLowerCase().trim())
                        const isNewRow     = !baselineSpec
                        const isEditedRow  = !!baselineSpec && (baselineSpec.rating || 3) !== rating
                        const changed      = isNewRow || isEditedRow
                        return (
                          <div key={spec.courseCode || `spec-${origIdx}`} className="spec-assigned-row" style={{
                            display: 'flex', alignItems: 'center', gap: 12,
                            padding: '11px 14px', borderRadius: 11,
                            border: changed ? '1.5px solid rgba(245, 158, 11, 0.45)' : '1.5px solid var(--border)',
                            background: changed ? 'rgba(245, 158, 11, 0.06)' : 'var(--bg)',
                            animation: 'fadeUp 0.15s ease',
                            position: 'relative',
                          }}>
                            <div className="spec-row-main" style={{ display: 'flex', alignItems: 'center', gap: 12, flex: 1, minWidth: 0 }}>
                              {/* Color accent strip */}
                              <div style={{ width: 3, borderRadius: 99, background: changed ? '#F59E0B' : lvl.dot, alignSelf: 'stretch', flexShrink: 0, minHeight: 32 }} />
                              {/* Info */}
                              <div style={{ flex: 1, minWidth: 0 }}>
                                <div className="spec-info-header" style={{ display: 'flex', alignItems: 'center', gap: 7, marginBottom: 2 }}>
                                  {title ? (
                                    <span className="spec-info-title" style={{ fontSize: 12.5, fontWeight: 700, color: 'var(--ink)', letterSpacing: '0.2px', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', flex: 1 }}>{title}</span>
                                  ) : (
                                    <span style={{ fontSize: 12.5, fontWeight: 700, color: 'var(--ink)', letterSpacing: '0.2px' }}>{spec.courseCode}</span>
                                  )}
                                  <LevelBadge rating={rating} />
                                  {isNewRow && (
                                    <span title="Not yet saved" style={{ fontSize: 9.5, fontWeight: 700, color: '#B45309', background: 'rgba(245, 158, 11, 0.12)', padding: '1px 7px', borderRadius: 99, border: '1px solid rgba(245, 158, 11, 0.35)', flexShrink: 0, whiteSpace: 'nowrap' }}>New</span>
                                  )}
                                  {isEditedRow && (
                                    <span title="Not yet saved" style={{ display: 'inline-flex', alignItems: 'center', gap: 4, fontSize: 9.5, fontWeight: 700, color: '#B45309', background: 'rgba(245, 158, 11, 0.12)', padding: '1px 7px', borderRadius: 99, border: '1px solid rgba(245, 158, 11, 0.35)', flexShrink: 0, whiteSpace: 'nowrap' }}>
                                      Edited
                                      <span style={{ display: 'inline-flex', alignItems: 'center', gap: 3, fontWeight: 500, opacity: 0.85 }}>
                                        <span style={{ textDecoration: 'line-through', textDecorationColor: 'rgba(180, 83, 9, 0.55)' }}>{getLvl(baselineSpec.rating || 3).short}</span>
                                        <svg width="8" height="8" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3"><line x1="5" y1="12" x2="19" y2="12"/><polyline points="12 5 19 12 12 19"/></svg>
                                        <span>{lvl.short}</span>
                                      </span>
                                    </span>
                                  )}
                                </div>
                                <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                                  <span style={{ fontFamily: 'monospace', fontSize: 10.5, fontWeight: 600, color: 'var(--meadow-text-hover)', background: 'var(--meadow-soft)', padding: '1px 7px', borderRadius: 5, border: '1px solid var(--meadow-border)', flexShrink: 0 }}>{spec.courseCode}</span>
                                </div>
                              </div>
                            </div>
                            <div className="spec-row-actions" style={{ display: 'flex', alignItems: 'center', gap: 12, flexShrink: 0 }}>
                              {/* Rating pips */}
                              <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                                <span className="spec-row-actions-label" style={{ display: 'none', fontSize: 10.5, color: 'var(--muted2)', fontWeight: 600 }}>Rate:</span>
                                <RatingPips size="sm" value={rating} onChange={r => { setRatingsDirty(true); setSpecs(p => p.map((s, i) => i === origIdx ? { ...s, rating: r } : s)) }} />
                              </div>
                              {/* Remove */}
                              <button onClick={() => setSpecs(p => p.filter((_, i) => i !== origIdx))} className="spec-remove-btn"
                                style={{ width: 28, height: 28, borderRadius: 7, border: '1px solid rgba(239, 68, 68, 0.25)', background: 'rgba(220, 38, 38, 0.05)', color: '#EF4444', flexShrink: 0, display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer', padding: 0 }}>
                                <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"><polyline points="3 6 5 6 21 6" /><path d="M19 6l-1 14a2 2 0 0 1-2 2H8a2 2 0 0 1-2-2L5 6" /></svg>
                                <span className="spec-remove-label" style={{ display: 'none' }}>Remove</span>
                              </button>
                            </div>
                          </div>
                        )
                      })}
                    </div>
                  )}
                </div>
              </div>
            )}

            {tab === 'unmatched' && (
              <div style={{ flex: 1, display: 'flex', flexDirection: 'column', overflow: 'hidden' }}>
                <div style={{ padding: '16px 20px', background: 'rgba(245, 158, 11, 0.05)', borderBottom: '1px solid #FDE68A', display: 'flex', gap: 12, alignItems: 'flex-start' }}>
                  <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke='#F59E0B' strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" style={{ flexShrink: 0, marginTop: 2 }}><path d="M10.29 3.86L1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z"/><line x1="12" y1="9" x2="12" y2="13"/><line x1="12" y1="17" x2="12.01" y2="17"/></svg>
                  <div>
                    <h3 style={{ margin: '0 0 4px', fontSize: 13, fontWeight: 700, color: '#92400E' }}>Needs Review</h3>
                    <p style={{ margin: 0, fontSize: 12, color: '#F59E0B', lineHeight: 1.4 }}>
                      These courses were imported or orphaned, but don't match anything in the current Course List. They are kept here for your reference.
                    </p>
                  </div>
                </div>

                <div style={{ flex: 1, overflowY: 'auto', padding: '16px 20px', background: 'var(--bg)' }}>
                  <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
                    {unmatchedSpecs.map((s, i) => {
                      const code  = s.courseCode || ''
                      const title = s.title || ''
                      const rating = s.rating || 3
                      return (
                        <div key={`${code}-${i}`} style={{ background: 'var(--surface)', borderRadius: 10, padding: 14, border: '1px solid var(--border)', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                          <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
                            <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                              <input 
                                value={code} 
                                onChange={(e) => {
                                  const newCode = e.target.value
                                  setSpecs(p => p.map(x => x === s ? { ...x, courseCode: newCode } : x))
                                }}
                                style={{ fontSize: 13.5, fontWeight: 700, color: 'var(--ink)', letterSpacing: '-0.2px', border: '1.5px solid var(--border)', background: 'transparent', borderRadius: 6, padding: '4px 8px', width: 120, outline: 'none' }}
                              />
                              <span style={{ fontSize: 10, fontWeight: 600, color: 'var(--muted)', background: 'var(--hover)', padding: '2px 6px', borderRadius: 4 }}>Unmatched</span>
                            </div>
                            {title && <span style={{ fontSize: 11.5, color: 'var(--muted)' }}>{title}</span>}
                          </div>
                          <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
                            <LevelBadge rating={rating} />
                            <button
                              title="Delete record"
                              onClick={() => setSpecs(p => p.filter(x => x !== s))}
                              style={{ width: 28, height: 28, borderRadius: 7, border: '1px solid rgba(239, 68, 68, 0.25)', background: 'rgba(220, 38, 38, 0.05)', color: '#EF4444', flexShrink: 0, display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer', padding: 0 }}>
                              <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"><polyline points="3 6 5 6 21 6" /><path d="M19 6l-1 14a2 2 0 0 1-2 2H8a2 2 0 0 1-2-2L5 6" /></svg>
                            </button>
                          </div>
                        </div>
                      )
                    })}
                  </div>
                </div>
              </div>
            )}

            {/* ── Browse Catalog ────────────────────────────────────────── */}
            {tab === 'browse' && (
              <div style={{ flex: 1, display: 'flex', flexDirection: 'column', overflow: 'hidden' }}>

                {/* Toolbar — search, semester, program, and both review toggles packed
                    into one wrapping row (dropdowns instead of tab strips keep it tight
                    even with many programs), plus a slim status/count line underneath. */}
                <div style={{ padding: '12px 18px 10px', borderBottom: '1px solid var(--border)', flexShrink: 0 }}>
                  <div className="spec-toolbar-row" style={{ display: 'flex', alignItems: 'center', gap: 6, flexWrap: 'wrap', rowGap: 8 }}>
                    <div className="spec-search-wrap" style={{ width: 180, flexShrink: 0 }}>
                      <SearchBox value={browseQ} onChange={setBrowseQ} placeholder="Search code or title…" />
                    </div>

                    <select value={activeSem} onChange={e => setActiveSem(e.target.value)}
                      style={{ padding: '6px 8px', borderRadius: 7, border: '1.5px solid var(--border)', background: 'var(--bg)', color: 'var(--ink)', fontSize: 11.5, fontWeight: 500, fontFamily: "'Inter', sans-serif", cursor: 'pointer', flexShrink: 0 }}>
                      {SEMESTERS.map(sem => (
                        <option key={sem} value={sem}>{sem === 'All' ? 'All Semesters' : sem} ({sem === 'All' ? courses.length : (coursesBySemester[sem] || []).length})</option>
                      ))}
                    </select>

                    {programs.length > 1 && (
                      <select value={activeProgram} onChange={e => setActiveProgram(e.target.value)}
                        style={{ padding: '6px 8px', borderRadius: 7, border: '1.5px solid var(--border)', background: 'var(--bg)', color: 'var(--ink)', fontSize: 11.5, fontWeight: 500, fontFamily: "'Inter', sans-serif", cursor: 'pointer', flexShrink: 0 }}>
                        <option value="All">All Programs</option>
                        {programs.map(p => <option key={p} value={p}>{p} ({courses.filter(c => c.program === p).length})</option>)}
                      </select>
                    )}

                    <span className="spec-toolbar-divider" style={{ width: 1, alignSelf: 'stretch', minHeight: 20, background: 'var(--border)', margin: '0 2px', flexShrink: 0 }} />

                    <button type="button" onClick={() => setHideAssigned(v => !v)}
                      style={{
                        display: 'inline-flex', alignItems: 'center', gap: 6, flexShrink: 0,
                        padding: '5px 10px', borderRadius: 99, cursor: 'pointer',
                        border: `1px solid ${hideAssigned ? 'var(--meadow-border)' : 'var(--border)'}`,
                        background: hideAssigned ? 'var(--meadow-soft)' : 'transparent',
                        color: hideAssigned ? 'var(--meadow-text-hover)' : 'var(--muted)',
                        fontSize: 11, fontWeight: 600, fontFamily: "'Inter', sans-serif", whiteSpace: 'nowrap',
                      }}>
                      <span style={{
                        width: 12, height: 12, borderRadius: 3.5, flexShrink: 0,
                        border: `1.5px solid ${hideAssigned ? 'var(--meadow-text-hover)' : 'var(--muted2)'}`,
                        background: hideAssigned ? 'var(--meadow-text-hover)' : 'transparent',
                        display: 'flex', alignItems: 'center', justifyContent: 'center',
                      }}>
                        {hideAssigned && <svg width="8" height="8" viewBox="0 0 24 24" fill="none" stroke="#fff" strokeWidth="3.5"><polyline points="20 6 9 17 4 12" /></svg>}
                      </span>
                      Hide assigned
                    </button>

                    {/* Review filter: show only courses rated in this session but not
                        yet committed with "Add N Courses", so edits can be double-checked
                        before they're folded into specs. */}
                    <button type="button" disabled={pendingCount === 0} onClick={() => setStagedOnly(v => !v)}
                      title={pendingCount === 0 ? 'Rate a course to stage it, then use this to review staged ratings' : undefined}
                      style={{
                        display: 'inline-flex', alignItems: 'center', gap: 6, flexShrink: 0,
                        padding: '5px 10px', borderRadius: 99, cursor: pendingCount === 0 ? 'not-allowed' : 'pointer',
                        border: `1px solid ${stagedOnly ? 'rgba(124, 58, 237, 0.35)' : 'var(--border)'}`,
                        background: stagedOnly ? 'color-mix(in srgb, #6D28D9 10%, transparent)' : 'transparent',
                        color: pendingCount === 0 ? 'var(--muted2)' : (stagedOnly ? '#7C3AED' : 'var(--muted)'),
                        opacity: pendingCount === 0 ? 0.55 : 1,
                        fontSize: 11, fontWeight: 600, fontFamily: "'Inter', sans-serif", whiteSpace: 'nowrap',
                      }}>
                      <span style={{
                        width: 12, height: 12, borderRadius: 3.5, flexShrink: 0,
                        border: `1.5px solid ${stagedOnly ? '#7C3AED' : 'var(--muted2)'}`,
                        background: stagedOnly ? '#7C3AED' : 'transparent',
                        display: 'flex', alignItems: 'center', justifyContent: 'center',
                      }}>
                        {stagedOnly && <svg width="8" height="8" viewBox="0 0 24 24" fill="none" stroke="#fff" strokeWidth="3.5"><polyline points="20 6 9 17 4 12" /></svg>}
                      </span>
                      Edited only{pendingCount > 0 ? ` (${pendingCount})` : ''}
                    </button>
                  </div>

                  {/* Status row */}
                  <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginTop: 8, flexWrap: 'wrap' }}>
                    <span style={{ fontSize: 11.5, color: 'var(--muted2)' }}>
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
                        <span style={{ fontSize: 11.5, color: 'var(--muted)' }}>{existingCodes.size} already assigned</span>
                      </>
                    )}
                  </div>
                </div>

                {/* Rating legend */}
                <div style={{ padding: '7px 18px', borderBottom: '1px solid var(--hover)', display: 'flex', alignItems: 'center', gap: 6, flexShrink: 0, background: 'var(--bg)' }}>
                  <span style={{ fontSize: 11, color: 'var(--muted)', fontWeight: 600, marginRight: 4 }}>Proficiency:</span>
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
                    <div style={{ display: 'flex', alignItems: 'center', gap: 10, color: 'var(--muted)', fontSize: 13, padding: '28px 0' }}>
                      <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="var(--meadow)" strokeWidth="2" style={{ animation: 'spin 1s linear infinite' }}><path d="M21 12a9 9 0 1 1-6.219-8.56" /></svg>
                      Loading course catalog…
                    </div>
                  ) : filteredBrowse.length === 0 ? (
                    <div style={{ textAlign: 'center', padding: '40px 0', color: 'var(--muted)', fontSize: 13 }}>No matching courses found.</div>
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
                    padding: '12px 18px', borderTop: '1.5px solid var(--meadow-border)',
                    background: 'linear-gradient(to right, var(--hover), var(--meadow-soft))',
                    display: 'flex', alignItems: 'center', gap: 12, flexShrink: 0,
                    animation: 'fadeUp 0.2s ease',
                  }}>
                    {/* Staged preview chips */}
                    <div style={{ flex: 1, display: 'flex', alignItems: 'center', gap: 6, flexWrap: 'wrap', minWidth: 0 }}>
                      <span style={{ fontSize: 12, fontWeight: 600, color: 'var(--meadow-text-hover)', flexShrink: 0 }}>Staged:</span>
                      {pendingList.slice(0, 5).map(p => {
                        const lvl   = getLvl(p.rating)
                        const label = p.title || courseTitleMap[p.code.toLowerCase()] || p.code
                        return (
                          <span key={p.code} style={{
                            display: 'inline-flex', alignItems: 'center', gap: 5,
                            padding: '3px 9px', borderRadius: 99,
                            background: 'var(--surface)', border: `1.5px solid ${lvl.border}`,
                            fontSize: 11.5, fontWeight: 600, color: lvl.color,
                          }}>
                            {label !== p.code ? label : p.code}
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
                  </div>
                )}
              </div>
            )}

            {/* ── Add Manually ─────────────────────────────────────────── */}
            {tab === 'manual' && (
              <div style={{ flex: 1, overflowY: 'auto', padding: '22px 24px' }} className="spec-scroll">
                <div style={{ maxWidth: 480 }}>
                  <div style={{ padding: '12px 16px', borderRadius: 11, background: 'var(--hover)', border: '1px solid color-mix(in srgb, #6D28D9 15%, transparent)', marginBottom: 22, display: 'flex', gap: 10, alignItems: 'flex-start' }}>
                    <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="#7C3AED" strokeWidth="2" style={{ flexShrink: 0, marginTop: 1 }}><circle cx="12" cy="12" r="10" /><line x1="12" y1="8" x2="12" y2="12" /><line x1="12" y1="16" x2="12.01" y2="16" /></svg>
                    <div style={{ fontSize: 12.5, color: '#4C1D95', lineHeight: 1.6 }}>
                      Use this for courses not in the catalog. Enter the code directly — e.g. <strong>CS101</strong>, <strong>MATH201</strong>. Saved as uppercase.
                    </div>
                  </div>

                  <div style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>
                    <div>
                      <label style={{ display: 'block', fontSize: 12, fontWeight: 600, color: 'var(--muted)', marginBottom: 7 }}>
                        Course Code <span style={{ color: '#EF4444' }}>*</span>
                      </label>
                      <input type="text" value={newCode}
                        onChange={e => { setNewCode(e.target.value.toUpperCase()); setCodeError('') }}
                        onKeyDown={e => { if (e.key === 'Enter') { e.preventDefault(); addManual() } }}
                        placeholder="e.g. CS101"
                        style={{ width: '100%', padding: '10px 13px', borderRadius: 9, border: `1.5px solid ${codeError ? '#FCA5A5' : 'var(--border)'}`, fontSize: 13, fontFamily: "'DM Sans', sans-serif", boxSizing: 'border-box', outline: 'none', letterSpacing: '0.5px', background: codeError ? 'rgba(220, 38, 38, 0.05)' : 'var(--surface)' }} />
                      {codeError && (
                        <div style={{ display: 'flex', alignItems: 'center', gap: 5, marginTop: 6, color: '#EF4444', fontSize: 12, fontWeight: 500 }}>
                          <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><circle cx="12" cy="12" r="10" /><line x1="12" y1="8" x2="12" y2="12" /></svg>
                          {codeError}
                        </div>
                      )}
                    </div>

                    <div>
                      <label style={{ display: 'block', fontSize: 12, fontWeight: 600, color: 'var(--muted)', marginBottom: 10 }}>Proficiency Level</label>
                      <div style={{ display: 'flex', gap: 6 }}>
                        {LEVELS.map(l => {
                          const active = newRating === l.rating
                          return (
                            <button key={l.rating} type="button" onClick={() => setNewRating(l.rating)}
                              style={{ flex: 1, padding: '10px 0', borderRadius: 9, border: `1.5px solid ${active ? l.border : 'var(--border)'}`, background: active ? l.bg : 'var(--surface)', color: active ? l.color : 'var(--muted)', fontSize: 11, fontWeight: active ? 700 : 500, cursor: 'pointer', fontFamily: "'DM Sans', sans-serif", display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 4, transition: 'all 0.12s' }}>
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
                      style={{ alignSelf: 'flex-start', display: 'flex', alignItems: 'center', gap: 7, padding: '9px 20px', borderRadius: 9, border: 'none', background: '#A78BFA', color: '#fff', fontSize: 13, fontWeight: 600, cursor: 'pointer', fontFamily: "'DM Sans', sans-serif", boxShadow: '0 4px 14px rgba(109,40,217,0.26)' }}>
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
        <div className="spec-footer" style={{ padding: '12px 22px', borderTop: '1px solid var(--border)', display: 'flex', justifyContent: 'space-between', alignItems: 'center', background: 'var(--bg)', flexShrink: 0 }} id="tour-spec-footer">
          <div className="spec-footer-info" style={{ fontSize: 12, color: 'var(--muted)' }}>
            {specCount === 0
              ? 'No specializations assigned'
              : `${specCount} specialization${specCount === 1 ? '' : 's'} assigned`}
            {specCount > 0 && breakdown[0] && (
              <span> · top level: <strong style={{ color: breakdown[0].color }}>{breakdown[0].label}</strong></span>
            )}
          </div>
          <div className="spec-footer-actions" style={{ display: 'flex', gap: 8 }}>
            {pendingCount > 0 ? (
              <>
                <button onClick={() => setPending({})}
                  style={{ padding: '8px 18px', borderRadius: 9, border: '1.5px solid var(--meadow-border)', background: 'transparent', color: 'var(--meadow-text-hover)', fontSize: 13, fontWeight: 600, cursor: 'pointer', fontFamily: "'Inter', sans-serif" }}>
                  Clear
                </button>
                <button onClick={commitPending}
                  style={{ display: 'inline-flex', alignItems: 'center', gap: 7, padding: '8px 20px', borderRadius: 9, border: 'none', background: 'linear-gradient(135deg,var(--meadow),var(--meadow-deep))', color: '#fff', fontSize: 13, fontWeight: 600, cursor: 'pointer', fontFamily: "'Inter', sans-serif", boxShadow: '0 4px 14px rgba(0,0,0,0.28)' }}>
                  <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"><polyline points="20 6 9 17 4 12" /></svg>
                  Add {pendingCount} Course{pendingCount !== 1 ? 's' : ''}
                </button>
              </>
            ) : (
              <>
                <button onClick={handleClose}
                  style={{ padding: '8px 18px', borderRadius: 9, border: '1.5px solid var(--border)', background: 'var(--surface)', color: 'var(--muted)', fontSize: 13, fontWeight: 600, cursor: 'pointer', fontFamily: "'Inter', sans-serif" }}>
                  Cancel
                </button>
                <button onClick={() => {
                  const cleaned = specs.map(s => {
                    if (s.isUnmatched && courseTitleMap[(s.courseCode || '').toLowerCase().replace(/\s+/g, '')]) {
                      const { isUnmatched, ...rest } = s
                      return rest
                    }
                    return s
                  })
                  setRatingsDirty(false)
                  setSavedBaseline(cleaned)
                  setSaveVersion(v => v + 1)
                  onSave(cleaned)
                }} disabled={isSaving}
                  className={hasUnsavedChanges && !isSaving ? 'spec-save-glow' : undefined}
                  style={{ display: 'inline-flex', alignItems: 'center', gap: 7, padding: '8px 20px', borderRadius: 9, border: 'none', background: 'linear-gradient(135deg,var(--meadow),var(--meadow-deep))', color: '#fff', fontSize: 13, fontWeight: 600, cursor: isSaving ? 'default' : 'pointer', fontFamily: "'Inter', sans-serif", opacity: isSaving ? 0.65 : 1, boxShadow: '0 4px 14px rgba(0,0,0,0.28)' }}>
                  {isSaving
                    ? <><svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" style={{ animation: 'spin 0.8s linear infinite' }}><path d="M21 12a9 9 0 1 1-6.219-8.56" /></svg>Saving…</>
                    : <><svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"><polyline points="20 6 9 17 4 12" /></svg>{specCount > 0 ? `Save Changes (${specCount})` : 'Save'}</>
                  }
                </button>
              </>
            )}
          </div>
        </div>

      </div>

      {confirmClose && (
        <UnsavedChangesModal
          onConfirm={() => { setConfirmClose(false); onClose() }}
          onCancel={() => setConfirmClose(false)}
        />
      )}
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
      className="spec-browse-row"
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => setHovered(false)}
      style={{
        display: 'flex', alignItems: 'center', gap: 12,
        padding: '10px 14px', borderRadius: 10,
        border: `1.5px solid ${staged ? lvl.border : already ? 'color-mix(in srgb, #6D28D9 15%, transparent)' : hovered ? 'var(--meadow-border)' : 'var(--border)'}`,
        background: staged ? lvl.bg : already ? 'color-mix(in srgb, #6D28D9 10%, var(--surface))' : hovered ? 'var(--hover)' : 'var(--surface)',
        transition: 'all 0.12s',
        animation: 'fadeUp 0.12s ease',
        opacity: already ? 0.7 : 1,
      }}>
      {/* Course info */}
      <div className="spec-browse-info" style={{ flex: 1, minWidth: 0 }}>
        <div className="spec-info-header" style={{ display: 'flex', alignItems: 'center', gap: 7, marginBottom: course.title ? 3 : 0 }}>
          {course.title ? (
            <span className="spec-info-title" style={{ fontSize: 12.5, fontWeight: 700, color: 'var(--ink)', letterSpacing: '0.2px', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', flex: 1 }}>{course.title}</span>
          ) : (
            <span style={{ fontSize: 12.5, fontWeight: 700, color: 'var(--ink)', letterSpacing: '0.2px' }}>{code}</span>
          )}
          {already && (
            <span style={{ fontSize: 9.5, fontWeight: 700, color: 'var(--meadow-text-hover)', background: 'var(--meadow-soft)', padding: '1px 7px', borderRadius: 99, border: '1px solid var(--meadow-border)', flexShrink: 0 }}>Assigned</span>
          )}
          {staged && !already && (
            <span style={{ fontSize: 9.5, fontWeight: 700, color: lvl.color, background: lvl.bg, padding: '1px 7px', borderRadius: 99, border: `1px solid ${lvl.border}`, flexShrink: 0 }}>Staged · {lvl.label}</span>
          )}
        </div>
        {course.title && (
          <span style={{ fontFamily: 'monospace', fontSize: 10.5, fontWeight: 600, color: '#A78BFA', background: 'rgba(124, 58, 237, 0.1)', padding: '1px 7px', borderRadius: 5, border: '1px solid color-mix(in srgb, #6D28D9 30%, transparent)' }}>{code}</span>
        )}
      </div>

      {/* Rating pips — disabled if already assigned */}
      {already ? (
        <span className="spec-browse-actions" style={{ fontSize: 11.5, color: 'var(--muted)', fontStyle: 'italic' }}>already assigned</span>
      ) : (
        <div className="spec-browse-actions" style={{ display: 'flex', gap: 3, alignItems: 'center', flexShrink: 0 }}>
          <span style={{ fontSize: 10.5, color: 'var(--muted2)', marginRight: 4, fontWeight: 600 }}>Rate:</span>
          {LEVELS.map(l => {
            const active = staged?.rating === l.rating
            return (
              <button key={l.rating} type="button" title={l.label} className="spec-pip" onClick={() => onRate(l.rating)}
                style={{
                  width: 26, height: 26, borderRadius: 7,
                  border: `1.5px solid ${active ? l.border : '#E9E6F5'}`,
                  background: active ? l.bg : 'var(--surface)',
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