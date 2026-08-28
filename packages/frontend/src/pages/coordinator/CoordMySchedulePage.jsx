import { useState, useEffect, useMemo } from 'react'
import { useNavigate } from 'react-router-dom'
import {
  coordListSchedules, coordDeleteSchedule,
  coordRenameSchedule, coordDuplicateSchedule, coordSubmitSchedule,
  coordUnsubmitSchedule, coordCheckTurn,
} from '../../services/api'
import { useTour } from '../../hooks/useTour.jsx'

const TOUR_SEEN_KEY = 'coordMySchedule_tourSeen'
function isOnboardingCompleted() {
  try { return localStorage.getItem(TOUR_SEEN_KEY) === '1' } catch { return true }
}
function markOnboardingCompleted() {
  try { localStorage.setItem(TOUR_SEEN_KEY, '1') } catch {}
}

/* ── Design tokens (unified with CoordSchedulerPage / CourseListPage) ── */
const G = {
  meadow: '#15803D', meadowDeep: '#0F5C2C', meadowMid: '#166534',
  meadowSoft: '#DCFCE7', meadowBorder: '#BBF7D0',
  ink: '#0E2A20', inkMid: '#1C3D2A', muted: '#4B7060', muted2: '#6B8C7A',
  border: '#D8E8DF', borderLight: '#EBF4EF', bg: '#F2F7F4',
  surface: '#FFFFFF', hover: '#EBF4EF', amber: '#D97706',
  amberSoft: '#FEF3C7', amberBorder: '#FDE68A',
  red: '#C0392B', redSoft: '#FFF0F0', redBorder: '#FECACA',
  blue: '#1D4ED8', blueSoft: '#DBEAFE', blueBorder: '#BFDBFE',
}

const CO_STYLE = `
  @import url('https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700;800&display=swap');
  @keyframes fadeUp { from { opacity:0; transform:translateY(8px) } to { opacity:1; transform:translateY(0) } }
  @keyframes shimmer { 0% { background-position:-600px 0 } 100% { background-position:600px 0 } }
  @keyframes spin { to { transform:rotate(360deg) } }
  .co-skel { background:linear-gradient(90deg,${G.hover} 25%,${G.meadowSoft} 50%,${G.hover} 75%); background-size:600px 100%; animation:shimmer 1.4s ease-in-out infinite; border-radius:6px; }
  .co-card { background:${G.surface}; border-radius:14px; border:1px solid ${G.border}; box-shadow:0 1px 8px rgba(10,46,28,0.06); overflow:hidden; animation:fadeUp .28s ease both; }
  .co-row { display:flex; align-items:center; gap:14px; padding:12px 20px; border-bottom:1px solid ${G.borderLight}; transition:background .12s; }
  .co-row:last-child { border-bottom:none; }
  .co-row:hover { background:#F8FBFA; }
  .co-btn { display:inline-flex; align-items:center; gap:6px; padding:7px 15px; border-radius:9px; font-size:12px; font-weight:600; cursor:pointer; font-family:'Inter',sans-serif; transition:opacity .15s; border:none; }
  .co-btn:hover { opacity:.88; }
  .co-btn:disabled { opacity:.5; cursor:default; }
  .co-btn-primary { background:linear-gradient(135deg,${G.meadow},${G.meadowDeep}); color:#fff; box-shadow:0 3px 12px rgba(15,92,44,0.22); }
  .co-btn-ghost { background:${G.bg}; color:${G.inkMid}; border:1.5px solid ${G.border} !important; }
  .co-btn-danger { background:${G.redSoft}; color:${G.red}; border:1px solid ${G.redBorder} !important; }
  .co-btn-amber { background:${G.amberSoft}; color:#92400E; border:1px solid ${G.amberBorder} !important; }
  .co-input { width:100%; padding:9px 12px; border-radius:9px; border:1.5px solid ${G.border}; font-size:13px; font-family:'Inter',sans-serif; outline:none; box-sizing:border-box; transition:all .15s; background:#fff; }
  .co-input:focus { border-color:${G.meadow}; box-shadow:0 0 0 3px rgba(21,128,61,0.1); }
  .co-tab { padding:5px 14px; border-radius:8px; font-size:11.5px; font-weight:600; cursor:pointer; font-family:'Inter',sans-serif; transition:all .15s; border:1.5px solid ${G.border}; background:${G.bg}; color:#4A5568; }
  .co-tab.active { border-color:${G.meadow}; background:${G.meadowSoft}; color:${G.meadowMid}; }

  /* Segmented status filter, matching CourseListPage's tab switcher */
  .co-seg { display:flex; gap:3px; background:#fff; border-radius:10px; padding:3px; border:1px solid ${G.border}; flex-shrink:0; }
  .co-seg-btn { padding:6px 15px; border-radius:7px; font-size:12px; font-weight:500; cursor:pointer; font-family:'Inter',sans-serif; transition:all .15s; border:1px solid transparent; background:transparent; color:${G.muted}; display:flex; align-items:center; gap:6px; }
  .co-seg-btn.active { background:${G.meadow}; color:#fff; font-weight:700; box-shadow:0 2px 8px rgba(21,128,61,0.28); }
  .co-seg-count { font-size:10.5px; color:inherit; opacity:.75; }

  /* Toolbar icon buttons */
  .co-icon-btn { display:inline-flex; align-items:center; justify-content:center; width:34px; height:34px; border-radius:8px; border:1px solid ${G.border}; background:#fff; color:${G.muted}; cursor:pointer; transition:all .15s; padding:0; flex-shrink:0; }
  .co-icon-btn:hover { background:${G.hover}; color:${G.meadow}; border-color:${G.meadowBorder}; }
  .co-icon-btn.active { background:${G.meadowSoft}; color:${G.meadowDeep}; border-color:${G.meadowBorder}; }

  /* Row action icon buttons (smaller, with color variants) */
  .co-row-icon-btn { display:inline-flex; align-items:center; justify-content:center; width:30px; height:30px; border-radius:8px; border:1px solid ${G.border}; background:#fff; color:${G.muted}; cursor:pointer; transition:all .15s; padding:0; flex-shrink:0; }
  .co-row-icon-btn:hover { background:${G.hover}; color:${G.meadowDeep}; border-color:${G.meadowBorder}; }
  .co-row-icon-btn:disabled { opacity:.45; cursor:default; }
  .co-row-icon-btn.primary { background:linear-gradient(135deg,${G.meadow},${G.meadowDeep}); color:#fff; border-color:transparent; box-shadow:0 2px 8px rgba(15,92,44,0.22); }
  .co-row-icon-btn.primary:hover { opacity:.88; color:#fff; }
  .co-row-icon-btn.danger { background:${G.redSoft}; color:${G.red}; border-color:${G.redBorder}; }
  .co-row-icon-btn.danger:hover { background:${G.red}; color:#fff; border-color:${G.red}; }
  .co-row-icon-btn.amber { background:${G.amberSoft}; color:#92400E; border-color:${G.amberBorder}; }
  .co-row-icon-btn.amber:hover { background:${G.amber}; color:#fff; border-color:${G.amber}; }

  /* Sort select */
  .co-sel { padding:6px 30px 6px 12px; border-radius:9px; border:1.5px solid ${G.border}; font-size:12px; font-weight:500; font-family:'Inter',sans-serif; color:${G.inkMid}; background:#fff; outline:none; cursor:pointer; appearance:none; transition:all .15s;
    background-image:url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='11' height='11' viewBox='0 0 24 24' fill='none' stroke='%236B8C7A' stroke-width='2.5'%3E%3Cpolyline points='6 9 12 15 18 9'/%3E%3C/svg%3E"); background-repeat:no-repeat; background-position:right 10px center; }
  .co-sel:focus { border-color:${G.meadow}; box-shadow:0 0 0 3px rgba(21,128,61,0.1); }

  /* Session count chip */
  .co-chip { display:inline-flex; align-items:center; gap:4px; font-size:11px; font-weight:600; color:${G.muted}; }

  /* Page header */
  .co-page-title { font-size:19px; font-weight:800; color:${G.ink}; margin:0; letter-spacing:-0.2px; }
  .co-page-sub { font-size:12.5px; color:${G.muted}; margin:3px 0 0; }
  .co-section-label { font-size:12px; font-weight:700; color:${G.inkMid}; text-transform:uppercase; letterSpacing:0.4px; }

  /* Single-row toolbar — no wrap, no scrollbar. The status tabs, "Approved
     so far" button, sort select, and New Schedule button keep their natural
     size; the term select and search box are the two elements allowed to
     shrink (down to a sane minimum) to absorb any width pressure. */
  .co-toolbar { display:flex; align-items:center; gap:8px; flex-wrap:nowrap; width:100%; min-width:0; }
  .co-toolbar-cluster { display:flex; align-items:center; gap:8px; flex-shrink:0; min-width:0; }
  .co-tb-shrink { flex:1 1 auto; min-width:0; }
  .co-tb-term { flex:0 1 170px; min-width:80px; text-overflow:ellipsis; white-space:nowrap; overflow:hidden; }
`

const STATUS_MAP = {
  draft:     { bg: G.hover,      color: G.muted,     label: 'Draft'     },
  submitted: { bg: G.amberSoft,  color: '#92400E',   label: 'Submitted' },
  approved:  { bg: G.meadowSoft, color: G.meadowMid, label: 'Approved'  },
}

function Badge({ status }) {
  const s = STATUS_MAP[status] || STATUS_MAP.draft
  return <span style={{ padding: '3px 10px', borderRadius: 99, fontSize: 10.5, fontWeight: 700, background: s.bg, color: s.color, display: 'inline-block', lineHeight: 1.5 }}>{s.label}</span>
}

function Skel({ w = '100%', h = 13, r = 6 }) {
  return <div className="co-skel" style={{ width: w, height: h, borderRadius: r, flexShrink: 0 }} />
}

// The backend sends timestamps like "2026-08-22T10:15:00" with no "Z" or
// +offset. JS's Date parser treats a string like that as *local* time, not
// UTC — so on a PH machine (UTC+8) a schedule saved seconds ago gets read
// as 8 hours in the past, which is exactly the "just submitted, says 8h
// ago" bug. If a string has no timezone marker, we assume it's UTC (since
// that's what the backend actually writes) and append "Z" before parsing.
function toSafeDate(dateLike) {
  if (!dateLike) return null
  let val = dateLike
  if (typeof val === 'string' && !/[zZ]|[+-]\d{2}:?\d{2}$/.test(val)) {
    val += 'Z'
  }
  const d = new Date(val)
  return Number.isNaN(d.getTime()) ? null : d
}

function timeAgo(dateStr) {
  const then = toSafeDate(dateStr)
  if (!then) return ''
  const diffMs = Date.now() - then.getTime()
  const min = Math.floor(diffMs / 60000)
  if (min < 1) return 'just now'
  if (min < 60) return `${min}m ago`
  const hr = Math.floor(min / 60)
  if (hr < 24) return `${hr}h ago`
  const day = Math.floor(hr / 24)
  if (day < 7) return `${day}d ago`
  const wk = Math.floor(day / 7)
  if (wk < 5) return `${wk}w ago`
  return then.toLocaleDateString(undefined, { month: 'short', day: 'numeric', year: 'numeric' })
}

// Term shown per-row, straight from the schedule's own metadata — no
// fallback label. If it isn't there, nothing renders for it.
function termLabel(s) {
  const parts = [s.academicYear ? `A.Y. ${s.academicYear}` : null, s.semester || null].filter(Boolean)
  return parts.length ? parts.join(' • ') : null
}

// Grouping key for term sections. Schedules missing term metadata land in
// a single "No term set" bucket rather than being silently dropped.
function termKey(s) {
  return s.academicYear || s.semester ? `${s.academicYear || '—'}||${s.semester || '—'}` : '__no_term__'
}

const SEM_ORDER = { '1st semester': 0, '2nd semester': 1, 'summer': 2 }
function semRank(sem) {
  const r = SEM_ORDER[(sem || '').trim().toLowerCase()]
  return r === undefined ? 99 : r
}

// Sort term keys newest first: latest academic year first, then latest
// semester within that year. Untermed bucket always sinks to the bottom.
function sortTermKeys(keys) {
  return [...keys].sort((ka, kb) => {
    if (ka === '__no_term__') return 1
    if (kb === '__no_term__') return -1
    const [ayA, semA] = ka.split('||')
    const [ayB, semB] = kb.split('||')
    if (ayA !== ayB) return ayB.localeCompare(ayA)
    return semRank(semB) - semRank(semA)
  })
}

function Toast({ msg, onClose }) {
  useEffect(() => {
    if (!msg) return
    const t = setTimeout(onClose, 3500)
    return () => clearTimeout(t)
  }, [msg, onClose])
  if (!msg) return null
  const isErr = /fail|error/i.test(msg)
  return (
    <div style={{
      position: 'fixed', bottom: 28, right: 28, zIndex: 9999,
      padding: '12px 20px', borderRadius: 11, fontSize: 13, fontWeight: 600,
      background: isErr ? '#FFF0F0' : '#ECFDF5', color: isErr ? '#C0392B' : '#15803D',
      boxShadow: '0 8px 28px rgba(0,0,0,0.14)', border: `1px solid ${isErr ? '#FECACA' : '#BBF7D0'}`,
      display: 'flex', alignItems: 'center', gap: 9, animation: 'fadeUp .2s ease',
    }}>
      {isErr
        ? <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><circle cx="12" cy="12" r="10"/><line x1="12" y1="8" x2="12" y2="12"/><line x1="12" y1="16" x2="12.01" y2="16"/></svg>
        : <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"><polyline points="20 6 9 17 4 12"/></svg>}
      {msg}
      <button onClick={onClose} style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'inherit', fontSize: 16, lineHeight: 1, padding: '0 0 0 4px' }}>×</button>
    </div>
  )
}

  function Checkbox({ checked, indeterminate, onChange }) {
    const active = checked || indeterminate
    return (
      <span onClick={onChange} style={{
        width: 16, height: 16, borderRadius: 4, flexShrink: 0,
        border: `1.5px solid ${active ? G.meadow : G.border}`,
        background: active ? G.meadow : 'transparent',
        display: 'inline-flex', alignItems: 'center', justifyContent: 'center',
        transition: 'all 0.15s', cursor: 'pointer',
        boxShadow: active ? '0 2px 6px rgba(21,128,61,0.3)' : 'none',
      }}>
        {indeterminate && !checked && <svg width="8" height="2" viewBox="0 0 8 2" fill="none"><rect width="8" height="2" rx="1" fill="#fff"/></svg>}
        {checked && <svg width="9" height="7" viewBox="0 0 9 7" fill="none"><polyline points="1,3.5 3.5,6 8,1" stroke="#fff" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round"/></svg>}
      </span>
    )
  }

export default function CoordMySchedulePage() {
  const navigate = useNavigate()

  const [schedules,      setSchedules]      = useState([])
  const [loading,        setLoading]        = useState(true)
  const [search,         setSearch]         = useState('')
  const [filter,         setFilter]         = useState('all')
  const [renameId,       setRenameId]       = useState(null)
  const [renameName,     setRenameName]     = useState('')
  const [toast,          setToast]          = useState('')
  const [sortBy,         setSortBy]         = useState('newest')
  const [termFilter,     setTermFilter]     = useState('all')

  const [selected,       setSelected]       = useState(new Set())
  const [deleting,       setDeleting]       = useState(false)
  const [confirmModal,   setConfirmModal]   = useState(null)

  // Active queue's academic term — used to know which of *my* approved
  // schedules is the one belonging to the currently active queue round (a
  // program can have approved schedules from unrelated past terms sitting
  // in this list; only the one matching the current queue's term gets the
  // "view combined schedule" action on its row).
  const [roundTerm,         setRoundTerm]         = useState(null)
  const [hasApprovedInQueue, setHasApprovedInQueue] = useState(false)

  const tourSteps = useMemo(() => {
    const steps = [
      {
        target: '.co-seg',
        title: 'Schedule Status',
        content: 'Filter your generated schedules by their current state: Drafts you are working on, Submitted schedules waiting for admin review, or Approved schedules.',
        placement: 'bottom'
      },
      {
        target: '.co-tb-term',
        title: 'Term Filter',
        content: 'Use this to focus on schedules for a specific academic year and semester.',
        placement: 'bottom'
      },
      {
        target: '.co-btn-primary',
        title: 'Generate Schedule',
        content: 'Ready to build? Click here to enter the automated scheduler and start assigning courses to rooms and faculty.',
        placement: 'left'
      }
    ];

    if (schedules.length > 0) {
      steps.push(
        {
          target: '.tour-btn-view',
          title: 'View Schedule',
          content: 'Click the eye icon to dive into this schedule. You can inspect its timetable, review health stats, or start manually assigning faculty to courses.',
          placement: 'bottom'
        },
        {
          target: '.tour-btn-rename',
          title: 'Rename Draft',
          content: 'Give your draft a clear name (like "Scenario A - Heavy Loading") so you can tell your experiments apart.',
          placement: 'bottom'
        },
        {
          target: '.tour-btn-duplicate',
          title: 'Duplicate Schedule',
          content: 'Want to try a different arrangement without ruining a good draft? Duplicate it first to safely experiment.',
          placement: 'bottom'
        },
        {
          target: '.tour-btn-submit',
          title: 'Submit for Review',
          content: 'When your draft is perfect, hit the green Submit button! This sends the schedule straight to the Administrator for approval. Make sure you\'re ready — you can\'t edit it again unless you recall it.',
          placement: 'left'
        },
        {
          target: '.tour-btn-delete',
          title: 'Delete Draft',
          content: 'Clean up drafts you no longer need. (Note: Only drafts can be deleted; submitted/approved ones are locked).',
          placement: 'bottom'
        }
      );
    } else {
      steps.push({
        target: '#tour-schedules-list',
        title: 'Your Schedules',
        content: 'Once you generate a schedule, it will appear here. You\'ll be able to view, rename, submit, or delete it from this list.',
        placement: 'bottom'
      });
    }

    return steps;
  }, [schedules.length]);

  const { TourElement, startTour } = useTour('coordSchedules', tourSteps, !loading)

  

  useEffect(() => { loadList() }, [])

  useEffect(() => {
    coordCheckTurn().then(t => {
      if (t) {
        setRoundTerm({ academicYear: t.academicYear, semester: t.semester })
        setHasApprovedInQueue(t.queue?.some(p => p.status === 'approved') || false)
      }
    }).catch(() => {})
  }, [])

  async function loadList() {
    try { setLoading(true); const d = await coordListSchedules(); setSchedules(Array.isArray(d) ? d : []) }
    catch { setSchedules([]) } finally { setLoading(false) }
  }

  const flash = msg => setToast(msg)

  const filteredIds = schedules.filter(s => s.status === 'draft').map(s => s.id)
  const selCount = [...selected].filter(id => filteredIds.includes(id)).length
  const selectionMode = selCount > 0
  const allSel = filteredIds.length > 0 && selCount === filteredIds.length
  const someSel = selCount > 0 && selCount < filteredIds.length

  const togAll = () => allSel
    ? setSelected(p => { const n = new Set(p); filteredIds.forEach(id => n.delete(id)); return n })
    : setSelected(p => { const n = new Set(p); filteredIds.forEach(id => n.add(id)); return n })

  const togOne = id => {
    // Only allow selecting drafts
    const s = schedules.find(x => x.id === id)
    if (s && s.status === 'draft') {
      setSelected(p => { const n = new Set(p); n.has(id) ? n.delete(id) : n.add(id); return n })
    }
  }

  async function handleBulkDelete() {
    if (selected.size === 0) return
    setDeleting(true)
    try {
      await Promise.all([...selected].map(sid => coordDeleteSchedule(sid)))
      flash(`Deleted ${selected.size} schedule(s)`)
      setSelected(new Set())
      loadList()
    } catch {
      flash('Failed to delete some schedules')
    } finally {
      setDeleting(false)
      setConfirmModal(null)
    }
  }

  async function handleDelete(sid) {
    try { await coordDeleteSchedule(sid); flash('Deleted'); loadList() }
    catch (e) { flash(e?.response?.data?.detail || 'Delete failed') }
    finally { setConfirmModal(null) }
  }

  async function handleRename(sid) {
    if (!renameName.trim()) return
    try { await coordRenameSchedule(sid, { name: renameName }); setRenameId(null); setRenameName(''); loadList() }
    catch (e) { flash(e?.response?.data?.detail || 'Rename failed') }
  }

  async function handleDuplicate(sid, name) {
    try { await coordDuplicateSchedule(sid, { name: `${name} (copy)` }); flash('Duplicated'); loadList() }
    catch (e) { flash(e?.response?.data?.detail || 'Duplicate failed') }
  }

  async function handleSubmit(sid) {
    try { await coordSubmitSchedule(sid); flash('Submitted for review!'); loadList() }
    catch (e) { flash(e?.response?.data?.detail || 'Submit failed — this term may already have a submission') }
    finally { setConfirmModal(null) }
  }

  async function handleUnsubmit(sid) {
    try { await coordUnsubmitSchedule(sid); flash('Withdrawn from review'); loadList() }
    catch (e) { flash(e?.response?.data?.detail || 'Unsubmit failed') }
  }

  const filtered = schedules.filter(s =>
    (filter === 'all' || s.status === filter) &&
    (termFilter === 'all' || termKey(s) === termFilter) &&
    (s.name || '').toLowerCase().includes(search.toLowerCase())
  )

  const sorters = {
    newest: (a, b) => (toSafeDate(b.createdAt)?.getTime() || 0) - (toSafeDate(a.createdAt)?.getTime() || 0),
    oldest: (a, b) => (toSafeDate(a.createdAt)?.getTime() || 0) - (toSafeDate(b.createdAt)?.getTime() || 0),
    name:   (a, b) => (a.name || '').localeCompare(b.name || ''),
    events: (a, b) => (b.eventCount || 0) - (a.eventCount || 0),
  }
  const sorted = [...filtered].sort(sorters[sortBy] || sorters.newest)

  const counts = {
    all:       schedules.length,
    draft:     schedules.filter(s => s.status === 'draft').length,
    submitted: schedules.filter(s => s.status === 'submitted').length,
    approved:  schedules.filter(s => s.status === 'approved').length,
  }

  // Distinct terms present across all schedules, newest first — drives the
  // term selector regardless of which status tab is active.
  const termKeys = sortTermKeys([...new Set(schedules.map(termKey))])
  const termMeta = Object.fromEntries(
    termKeys.map(k => [k, schedules.find(s => termKey(s) === k)])
  )

  // Group the currently filtered/sorted rows into per-term sections. Each
  // section carries its own submitted schedule pulled out separately, since
  // a term can only have one submission in flight at a time.
  const sections = sortTermKeys([...new Set(sorted.map(termKey))]).map(key => {
    const rows = sorted.filter(s => termKey(s) === key)
    const submitted = rows.filter(s => s.status === 'submitted')
    const rest = rows.filter(s => s.status !== 'submitted')
    return { key, label: termMeta[key] ? (termLabel(termMeta[key]) || 'No term set') : 'No term set', submitted, rest }
  })

  // A term is "locked" once it has a submitted or approved schedule — only
  // one submission is allowed per academic term, mirroring the backend check.
  function termLocked(s) {
    const key = termKey(s)
    return schedules.some(o => o.id !== s.id && termKey(o) === key && (o.status === 'submitted' || o.status === 'approved'))
  }

  // Allow viewing the combined master schedule for any schedule belonging to
  // the currently active queue round, regardless of status.
  function isActiveRound(s) {
    return roundTerm
      && hasApprovedInQueue
      && roundTerm.academicYear === s.academicYear
      && roundTerm.semester === s.semester
  }

  return (
    <div style={{ fontFamily: "'Inter',sans-serif", background: G.bg, minHeight: '100%', padding: '24px 32px', display: 'flex', flexDirection: 'column', gap: 16 }}>
      <style>{CO_STYLE}</style>
      <Toast msg={toast} onClose={() => setToast('')} />
      {TourElement}

      {/* ── Your schedules ── */}
      <div id="tour-schedules-list" style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>

          {selectionMode ? (
            <div className="co-toolbar" style={{ background: '#2C3E50', borderColor: '#1A252F', color: '#fff', padding: '10px 14px', borderRadius: 12 }}>
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                <Checkbox checked={allSel} indeterminate={someSel} onChange={togAll} />
              </div>
              <span style={{ fontSize: 13, fontWeight: 600, color: '#fff', flex: 1, paddingLeft: 8 }}>{selCount} schedule{selCount !== 1 ? 's' : ''} selected</span>
              <button onClick={() => setSelected(new Set())} style={{ background: 'rgba(255,255,255,0.1)', border: '1px solid rgba(255,255,255,0.2)', color: 'rgba(255,255,255,0.85)', fontSize: 12, padding: '5px 14px', borderRadius: 8, cursor: 'pointer', fontFamily: "'Inter',sans-serif" }}>Deselect all</button>
              <button onClick={() => setConfirmModal({ action: 'bulkDelete' })} disabled={deleting} style={{ background: '#C0392B', border: 'none', color: '#fff', fontSize: 12, fontWeight: 600, padding: '5px 15px', borderRadius: 8, display: 'flex', alignItems: 'center', gap: 5, cursor: 'pointer', fontFamily: "'Inter',sans-serif", opacity: deleting ? 0.7 : 1 }}>
                <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"><polyline points="3 6 5 6 21 6"/><path d="M19 6l-1 14a2 2 0 0 1-2 2H8a2 2 0 0 1-2-2L5 6"/><path d="M10 11v6M14 11v6"/></svg>
                Delete {selCount}
              </button>
            </div>
          ) : (
            <div className="co-toolbar">
              <div className="co-seg" style={{ flexShrink: 0 }}>
                {['all', 'draft', 'submitted', 'approved'].map(f => (
                  <button key={f} className={`co-seg-btn${filter === f ? ' active' : ''}`} onClick={() => setFilter(f)}>
                    {f.charAt(0).toUpperCase() + f.slice(1)}
                    <span className="co-seg-count">{counts[f]}</span>
                  </button>
                ))}
              </div>

              {termKeys.length > 0 && (
                <select className="co-sel co-tb-term" value={termFilter} onChange={e => setTermFilter(e.target.value)} title="Filter by academic term">
                  <option value="all">All terms</option>
                  {termKeys.map(k => (
                    <option key={k} value={k}>{termMeta[k] ? (termLabel(termMeta[k]) || 'No term set') : 'No term set'}</option>
                  ))}
                </select>
              )}

              <select className="co-sel" value={sortBy} onChange={e => setSortBy(e.target.value)} title="Sort schedules" style={{ flexShrink: 0 }}>
                <option value="newest">Newest first</option>
                <option value="oldest">Oldest first</option>
                <option value="name">Name (A–Z)</option>
                <option value="events">Most sessions</option>
              </select>

              <div className="co-tb-shrink" style={{ position: 'relative', minWidth: 70 }}>
                <svg style={{ position: 'absolute', left: 11, top: '50%', transform: 'translateY(-50%)', pointerEvents: 'none' }} width="13" height="13" viewBox="0 0 24 24" fill="none" stroke={G.muted2} strokeWidth="2">
                  <circle cx="11" cy="11" r="8"/><line x1="21" y1="21" x2="16.65" y2="16.65"/>
                </svg>
                <input value={search} onChange={e => setSearch(e.target.value)} placeholder="Search…"
                  className="co-input" style={{ paddingLeft: 32, width: '100%' }} />
              </div>

              <button className="co-btn co-btn-primary" onClick={() => navigate('/coordinator/scheduler')} style={{ padding: '7px 14px', flexShrink: 0, whiteSpace: 'nowrap' }}>
                <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"><line x1="12" y1="5" x2="12" y2="19"/><line x1="5" y1="12" x2="19" y2="12"/></svg>
                New Schedule
              </button>
            </div>
          )}

      {loading ? (
        <div className="co-card" style={{ padding: '16px 20px', display: 'flex', flexDirection: 'column', gap: 10 }}>
          {[...Array(4)].map((_, i) => <Skel key={i} h={48} r={9} style={{ opacity: 1 - i * 0.15 }} />)}
        </div>
      ) : filtered.length === 0 ? (
        <div className="co-card" style={{ padding: '60px 20px', textAlign: 'center', color: '#A0AEC0' }}>
          <svg width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" style={{ marginBottom: 10, display: 'block', margin: '0 auto 12px', opacity: 0.3 }}>
            <line x1="8" y1="6" x2="21" y2="6"/><line x1="8" y1="12" x2="21" y2="12"/><line x1="8" y1="18" x2="21" y2="18"/>
            <line x1="3" y1="6" x2="3.01" y2="6"/><line x1="3" y1="12" x2="3.01" y2="12"/><line x1="3" y1="18" x2="3.01" y2="18"/>
          </svg>
          <p style={{ margin: 0, fontSize: 13, fontWeight: 500 }}>
            {search ? 'No schedules match your search.' : filter !== 'all' ? `No ${filter} schedules.` : 'No schedules yet — generate one from the Scheduler page.'}
          </p>
          {!search && filter === 'all' && (
            <button className="co-btn co-btn-primary" style={{ margin: '16px auto 0' }} onClick={() => navigate('/coordinator/scheduler')}>
              Go to Scheduler
            </button>
          )}
        </div>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 18 }}>
          {sections.map(sec => (
            <div key={sec.key} style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
              {(termKeys.length > 1 || sec.key === '__no_term__') && (
                <div style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '0 2px' }}>
                  <span style={{ fontSize: 11.5, fontWeight: 700, color: G.meadowDeep, textTransform: 'uppercase', letterSpacing: 0.4 }}>
                    {sec.label}
                  </span>
                  <span style={{ flex: 1, height: 1, background: G.border }} />
                  <span style={{ fontSize: 10.5, fontWeight: 600, color: G.muted }}>
                    {sec.submitted.length + sec.rest.length} schedule{sec.submitted.length + sec.rest.length === 1 ? '' : 's'}
                  </span>
                </div>
              )}

              {/* Submitted schedule gets its own callout — a term can only have one in flight */}
              {sec.submitted.map(s => (
                <div key={s.id} className="co-card" style={{ border: `1.5px solid ${G.amberBorder}` }}>
                  <div style={{ padding: '10px 20px', display: 'flex', alignItems: 'center', gap: 8, background: G.amberSoft }}>
                    <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="#92400E" strokeWidth="2.2"><circle cx="12" cy="12" r="10"/><polyline points="12 6 12 12 16 14"/></svg>
                    <span style={{ fontSize: 11.5, fontWeight: 700, color: '#92400E' }}>Awaiting admin review</span>
                  </div>
                  {renderScheduleRow(s)}
                </div>
              ))}

              {sec.rest.length > 0 && (
                <div className="co-card">
                  {sec.rest.map(s => renderScheduleRow(s))}
                </div>
              )}
            </div>
          ))}
        </div>
      )}
        </div>

        {confirmModal && (
          <div style={{ position: 'fixed', inset: 0, background: 'rgba(14, 42, 32, 0.6)', backdropFilter: 'blur(4px)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 9999, padding: 24, animation: 'bcFadeIn 0.2s ease forwards' }} onClick={() => setConfirmModal(null)}>
            <div style={{ background: '#fff', borderRadius: 20, width: 400, maxWidth: '100%', boxShadow: '0 20px 40px rgba(0,0,0,0.2)', display: 'flex', flexDirection: 'column' }} onClick={e => e.stopPropagation()}>
              <div style={{ padding: '24px 28px', borderBottom: '1px solid #E2E8F0', display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexShrink: 0 }}>
                <h3 style={{ margin: 0, fontSize: 20, fontWeight: 800, color: '#111827', letterSpacing: '-0.3px', display: 'flex', alignItems: 'center', gap: 10 }}>
                  {confirmModal.action === 'submit' ? 'Submit Schedule' : 'Delete Schedule'}
                </h3>
              </div>
              <div style={{ padding: '24px 28px' }}>
                <p style={{ margin: 0, fontSize: 14, color: '#4B5563', lineHeight: 1.5, fontWeight: 500 }}>
                  {confirmModal.action === 'submit' 
                    ? 'Are you sure you want to submit this schedule for approval? You will not be able to edit it unless the admin recalls it.'
                    : confirmModal.action === 'bulkDelete'
                      ? `Are you sure you want to delete ${selected.size} schedule(s)? This action cannot be undone.`
                      : 'Are you sure you want to delete this schedule? This action cannot be undone.'}
                </p>
              </div>
              <div style={{ padding: '20px 28px', borderTop: '1px solid #E2E8F0', background: '#F9FAFB', display: 'flex', justifyContent: 'flex-end', gap: 12, borderRadius: '0 0 20px 20px' }}>
                <button 
                  onClick={() => setConfirmModal(null)}
                  style={{ padding: '10px 20px', borderRadius: 10, border: '1px solid #E2E8F0', fontFamily: "'Poppins', 'Inter', sans-serif", fontSize: 13, fontWeight: 600, cursor: 'pointer', background: '#fff', color: '#6B7280', transition: 'all .2s' }}
                >
                  Cancel
                </button>
                <button 
                  style={{
                    display: 'inline-flex', alignItems: 'center', gap: 8, padding: '10px 24px',
                    borderRadius: 10, border: 'none', fontFamily: "'Poppins', 'Inter', sans-serif",
                    fontSize: 13, fontWeight: 600, cursor: 'pointer',
                    background: confirmModal.action === 'submit' ? '#15803d' : '#DC2626', color: '#ffffff', 
                    boxShadow: confirmModal.action === 'submit' ? '0 4px 14px rgba(21,128,61,0.25)' : 'none',
                    transition: 'all .2s',
                  }}
                  onClick={() => {
                    if (confirmModal.action === 'submit') {
                      handleSubmit(confirmModal.id)
                    } else if (confirmModal.action === 'bulkDelete') {
                      handleBulkDelete()
                    } else {
                      handleDelete(confirmModal.id)
                    }
                  }}
                >
                  {confirmModal.action === 'submit' ? 'Submit' : 'Delete'}
                </button>
              </div>
            </div>
          </div>
        )}

      </div>
    )

  function renderScheduleRow(s) {
    const isSel = selected.has(s.id);
    const isDraft = s.status === 'draft';
    return (
            <div key={s.id} className="co-row" onClick={() => isDraft && togOne(s.id)} style={{ cursor: isDraft ? 'pointer' : 'default', background: isSel ? G.meadowSoft : 'transparent' }}>
              <div style={{ paddingRight: 14, minWidth: 30, display: 'flex', alignItems: 'center' }} onClick={e => e.stopPropagation()}>
                {isDraft ? <Checkbox checked={isSel} onChange={() => togOne(s.id)} /> : null}
              </div>
              <div style={{ flex: 1, minWidth: 0 }}>
                {renameId === s.id ? (
                  <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                    <input className="co-input" value={renameName} onChange={e => setRenameName(e.target.value)}
                      style={{ maxWidth: 280 }} onKeyDown={e => e.key === 'Enter' && handleRename(s.id)} autoFocus />
                    <button className="co-btn co-btn-primary" style={{ padding: '5px 12px' }} onClick={() => handleRename(s.id)}>Save</button>
                    <button className="co-btn co-btn-ghost" style={{ padding: '5px 12px' }} onClick={() => setRenameId(null)}>Cancel</button>
                  </div>
                ) : (
                  <>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 3, flexWrap: 'wrap' }}>
                      <span style={{ fontSize: 13.5, fontWeight: 700, color: '#0E2A20' }}>{s.name}</span>
                      <Badge status={s.status} />
                      {termLabel(s) && (
                        <span style={{ fontSize: 10.5, fontWeight: 600, color: G.meadowDeep, background: G.meadowSoft, border: `1px solid ${G.meadowBorder}`, padding: '1.5px 8px', borderRadius: 99 }}>
                          {termLabel(s)}
                        </span>
                      )}
                    </div>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 14, fontSize: 11.5, color: '#6B8C7A' }}>
                      <span className="co-chip">
                        <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2"><rect x="3" y="4" width="18" height="18" rx="2"/><line x1="3" y1="10" x2="21" y2="10"/><line x1="16" y1="2" x2="16" y2="6"/><line x1="8" y1="2" x2="8" y2="6"/></svg>
                        {s.eventCount ?? 0} session{(s.eventCount ?? 0) === 1 ? '' : 's'}
                      </span>
                      {s.createdAt && (
                        <span className="co-chip">
                          <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2"><circle cx="12" cy="12" r="9"/><polyline points="12 7 12 12 15.5 14"/></svg>
                          {timeAgo(s.createdAt)}
                        </span>
                      )}
                    </div>
                  </>
                )}
              </div>

              {renameId !== s.id && (
                <div style={{ display: 'flex', gap: 6, flexShrink: 0, flexWrap: 'wrap', justifyContent: 'flex-end' }} onClick={e => e.stopPropagation()}>
                  <button className="co-row-icon-btn tour-btn-view" title="View schedule" onClick={() => navigate(`/coordinator/schedules/${s.id}`)}>
                    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8Z"/><circle cx="12" cy="12" r="3"/></svg>
                  </button>
                  {s.status === 'draft' && (
                    <button className="co-row-icon-btn tour-btn-rename" title="Rename" onClick={() => { setRenameId(s.id); setRenameName(s.name) }}>
                      <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M17 3a2.85 2.83 0 1 1 4 4L7.5 20.5 2 22l1.5-5.5Z"/></svg>
                    </button>
                  )}
                  <button className="co-row-icon-btn tour-btn-duplicate" title="Duplicate" onClick={() => handleDuplicate(s.id, s.name)}>
                    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><rect x="9" y="9" width="13" height="13" rx="2"/><path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1"/></svg>
                  </button>
                  {s.status === 'draft' && (
                    <>
                      <button className="co-row-icon-btn tour-btn-submit" disabled={termLocked(s)}
                        title={termLocked(s) ? 'Another schedule is already submitted/approved for this term' : 'Submit for review'}
                        onClick={() => !termLocked(s) && setConfirmModal({ action: 'submit', id: s.id })}>
                        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><line x1="22" y1="2" x2="11" y2="13"/><polygon points="22 2 15 22 11 13 2 9 22 2"/></svg>
                      </button>
                      <button className="co-row-icon-btn tour-btn-delete danger" title="Delete" onClick={() => setConfirmModal({ action: 'delete', id: s.id })}>
                        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><polyline points="3 6 5 6 21 6"/><path d="M19 6l-1 14a2 2 0 0 1-2 2H8a2 2 0 0 1-2-2L5 6"/><path d="M10 11v6M14 11v6"/></svg>
                      </button>
                    </>
                  )}
                  {s.status === 'submitted' && (
                    <button className="co-row-icon-btn amber" title="Withdraw from review" onClick={() => handleUnsubmit(s.id)}>
                      <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M9 14 4 9l5-5"/><path d="M4 9h10.5a5.5 5.5 0 0 1 0 11H11"/></svg>
                    </button>
                  )}
                  {isActiveRound(s) && (
                    <button className="co-row-icon-btn" style={{ color: G.blue, borderColor: G.blueBorder, background: G.blueSoft }}
                      title="View the combined schedule — see how this schedule fits with what's approved so far"
                      onClick={() => navigate(`/coordinator/schedules/master?overlay=${s.id}`)}>
                      <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><rect x="3" y="4" width="7" height="7" rx="1.5"/><rect x="14" y="4" width="7" height="7" rx="1.5"/><rect x="3" y="15" width="7" height="7" rx="1.5"/><rect x="14" y="15" width="7" height="7" rx="1.5"/></svg>
                    </button>
                  )}
                </div>
              )}
            </div>
    )
  }
}
