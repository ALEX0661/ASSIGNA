import { useState, useEffect, useCallback, useMemo, useRef } from 'react'
import {
  listQueues, createQueue, skipProgram, advanceQueue, deleteQueue, reorderQueue,
  getSubmittedSchedules, getSubmittedSchedule, approveSchedule, rejectSchedule,
  getMasterSchedule, finalizeMasterSchedule, getCourses, adminEditSchedule,
} from '../../services/api'

/* ─────────────────────────── DESIGN TOKENS ───────────────────────────
   Same meadow palette + Inter/Poppins/IBM Plex Mono stack as
   CoordSchedulerPage / SchedulerPage / CoordMySchedulePage, so this page
   reads as part of the same product instead of a one-off. ── */
const G = {
  meadow: '#15803D', meadowDeep: '#0F5C2C', meadowMid: '#166534',
  meadowSoft: '#DCFCE7', meadowBorder: '#BBF7D0',
  ink: '#0E2A20', inkMid: '#1C3D2A', muted: '#4B7060', muted2: '#6B8C7A',
  border: '#D8E8DF', borderLight: '#EBF4EF', bg: '#F2F7F4',
  surface: '#FFFFFF', hover: '#EBF4EF',
  amber: '#D97706', amberSoft: '#FEF3C7', amberBorder: '#FDE68A',
  blue: '#1D4ED8', blueSoft: '#DBEAFE', blueBorder: '#BFDBFE',
  red: '#DC2626', redSoft: '#FEE2E2', redBorder: '#FECACA',
}

if (!document.getElementById('approval-dashboard-style')) {
  const s = document.createElement('style')
  s.id = 'approval-dashboard-style'
  s.textContent = `
    @import url('https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700;800&family=Poppins:wght@600;700;800&family=IBM+Plex+Mono:wght@500;600;700&display=swap');

    .ap-root { font-family:'Inter',sans-serif; background:${G.bg}; }
    @keyframes apFadeUp { from { opacity:0; transform:translateY(8px) } to { opacity:1; transform:translateY(0) } }
    @keyframes apShimmer { 0% { background-position:-600px 0 } 100% { background-position:600px 0 } }
    @keyframes apSpin { to { transform:rotate(360deg) } }
    @keyframes apSlideIn { from { transform:translateX(24px); opacity:0 } to { transform:translateX(0); opacity:1 } }
    @keyframes apOverlayIn { from { opacity:0 } to { opacity:1 } }
    .ap-fadein { animation:apFadeUp .28s ease both; }
    .ap-spin { animation:apSpin .8s linear infinite; }
    .ap-skeleton { background:linear-gradient(90deg,${G.hover} 25%,${G.borderLight} 50%,${G.hover} 75%); background-size:600px 100%; animation:apShimmer 1.4s ease-in-out infinite; border-radius:7px; }

    .ap-card { background:#fff; border-radius:12px; border:1px solid ${G.border}; box-shadow:0 2px 12px rgba(10,46,28,0.03); overflow:hidden; }
    .ap-row { display:flex; align-items:center; gap:14px; padding:13px 18px; border-bottom:1px solid ${G.borderLight}; transition:background .12s; }
    .ap-row:last-child { border-bottom:none; }
    .ap-row:hover { background:${G.hover}; }

    .btn-outline { display:inline-flex; align-items:center; gap:6px; padding:7px 14px; border-radius:8px; border:1px solid ${G.border}; font-family:'Inter',sans-serif; font-size:12px; font-weight:600; cursor:pointer; background:#fff; color:${G.muted}; transition:all .13s; }
    .btn-outline:hover:not(:disabled) { background:${G.hover}; color:${G.ink}; border-color:${G.meadowBorder}; }
    .btn-outline:disabled { opacity:.5; cursor:default; }
    .btn-primary { display:inline-flex; align-items:center; gap:6px; padding:7px 16px; border-radius:8px; border:none; font-family:'Inter',sans-serif; font-size:12px; font-weight:600; cursor:pointer; transition:all .15s; background:${G.meadow}; color:#fff; box-shadow:0 3px 10px rgba(21,128,61,0.25); }
    .btn-primary:hover:not(:disabled) { background:${G.meadowDeep}; transform:translateY(-1px); }
    .btn-primary:disabled { opacity:.55; cursor:default; transform:none; box-shadow:none; }
    .btn-danger { display:inline-flex; align-items:center; gap:6px; padding:7px 14px; border-radius:8px; border:1px solid ${G.redBorder}; font-family:'Inter',sans-serif; font-size:12px; font-weight:600; cursor:pointer; background:#fff; color:${G.red}; transition:all .13s; }
    .btn-danger:hover:not(:disabled) { background:${G.redSoft}; border-color:${G.red}; }
    .btn-danger:disabled { opacity:.5; cursor:default; }
    .btn-amber { display:inline-flex; align-items:center; gap:6px; padding:7px 14px; border-radius:8px; border:1px solid ${G.amberBorder}; font-family:'Inter',sans-serif; font-size:11.5px; font-weight:600; cursor:pointer; background:${G.amberSoft}; color:#92400E; transition:all .13s; }
    .btn-amber:hover:not(:disabled) { background:#FDE9B0; }
    .btn-blue { display:inline-flex; align-items:center; gap:6px; padding:7px 16px; border-radius:8px; border:none; font-family:'Inter',sans-serif; font-size:12px; font-weight:600; cursor:pointer; transition:all .15s; background:${G.blue}; color:#fff; box-shadow:0 3px 10px rgba(29,78,216,0.22); }
    .btn-blue:hover:not(:disabled) { background:#1E40AF; transform:translateY(-1px); }

    .ap-icon-btn { display:inline-flex; align-items:center; justify-content:center; width:32px; height:32px; border-radius:8px; border:1px solid ${G.border}; background:#fff; color:${G.muted}; cursor:pointer; transition:all .15s; padding:0; flex-shrink:0; }
    .ap-icon-btn:hover:not(:disabled) { background:${G.hover}; color:${G.meadowDeep}; border-color:${G.meadowBorder}; }
    .ap-icon-btn:disabled { opacity:.4; cursor:default; }

    .cp-inp { padding:8px 12px; border-radius:8px; border:1.5px solid ${G.border}; font-family:'Inter',sans-serif; font-size:12.5px; color:${G.ink}; background:#fff; outline:none; transition:all .15s; width:100%; box-sizing:border-box; }
    .cp-inp:focus { border-color:${G.meadow}; box-shadow:0 0 0 3px rgba(21,128,61,0.1); }
    .cp-inp.sm { padding:5px 8px; font-size:11.5px; border-radius:6px; }

    .ap-badge { display:inline-flex; align-items:center; padding:3px 9px; border-radius:99px; font-family:'Inter',sans-serif; font-size:10.5px; font-weight:700; border:1px solid transparent; line-height:1.5; white-space:nowrap; }

    .ap-tab { display:inline-flex; align-items:center; gap:7px; padding:8px 16px; border-radius:9px; font-family:'Inter',sans-serif; font-size:12.5px; font-weight:700; cursor:pointer; transition:all .15s; border:1px solid transparent; background:transparent; color:${G.muted}; }
    .ap-tab:hover:not(.active) { background:${G.hover}; color:${G.ink}; }
    .ap-tab.active { background:${G.meadow}; color:#fff; box-shadow:0 3px 10px rgba(21,128,61,0.22); }
    .ap-tab-count { display:inline-flex; align-items:center; justify-content:center; min-width:17px; height:17px; padding:0 6px; border-radius:99px; font-size:10px; font-weight:800; background:rgba(255,255,255,0.28); font-family:'IBM Plex Mono',monospace; }
    .ap-tab:not(.active) .ap-tab-count { background:${G.amberSoft}; color:#92400E; }

    .r-tab { display:inline-flex; align-items:center; gap:5px; padding:6px 13px; border-radius:8px; font-family:'Inter',sans-serif; font-size:11.5px; font-weight:600; cursor:pointer; transition:all .15s; border:1px solid ${G.border}; background:#fff; color:${G.muted}; }
    .r-tab.active { background:${G.meadow}; color:#fff; border-color:${G.meadowDeep}; box-shadow:0 3px 10px rgba(21,128,61,0.22); }
    .r-tab:hover:not(.active) { background:${G.hover}; border-color:${G.meadowBorder}; color:${G.ink}; }

    .ap-tile { flex:1; display:flex; flex-direction:column; align-items:flex-start; gap:2px; padding:11px 15px; border-radius:11px; border:1px solid; background:#fff; font-family:'Inter',sans-serif; text-align:left; transition:transform .15s, box-shadow .15s; cursor:pointer; }
    .ap-tile:hover { transform:translateY(-2px); box-shadow:0 6px 16px rgba(10,46,28,0.08); }
    .ap-tile-value { font-family:'IBM Plex Mono',monospace; font-size:21px; font-weight:800; line-height:1; }
    .ap-tile-label { font-size:10px; font-weight:700; text-transform:uppercase; letter-spacing:.4px; opacity:.85; }

    .prog-bar-wrap { height:6px; background:${G.borderLight}; border-radius:99px; overflow:hidden; width:100%; }
    .prog-bar-fill { height:100%; border-radius:99px; transition:width .4s cubic-bezier(.4,0,.2,1); background:linear-gradient(90deg,${G.meadow},#22C55E); }

    /* Queue rail — mirrors the coordinator-side queue card (gradient head
       + circular status rail) so the admin queue view reads as the same
       product instead of the old boxy phase-track squares. */
    .aq-card { border-radius:13px; border:1px solid ${G.border}; overflow:hidden; background:#fff; }
    .aq-head { display:flex; align-items:center; justify-content:space-between; gap:14px; padding:12px 16px; background:linear-gradient(135deg, ${G.meadowDeep}, ${G.meadow}); color:#fff; }
    .aq-head-title { font-size:13px; font-weight:800; letter-spacing:-.1px; line-height:1.3; }
    .aq-head-sub { font-size:11px; font-weight:500; color:rgba(255,255,255,0.82); margin-top:2px; line-height:1.3; }
    .aq-head-turn { font-family:'IBM Plex Mono',monospace; font-size:12.5px; font-weight:800; flex-shrink:0; white-space:nowrap; }
    .aq-head-of { font-size:9.5px; font-weight:600; color:rgba(255,255,255,0.75); margin-left:2px; }
    .aq-rail-wrap { padding:20px 16px 16px; }

    .ap-order-item { display:flex; align-items:center; gap:11px; padding:10px 12px; border-radius:9px; background:#fff; cursor:grab; transition:border-color .12s, box-shadow .12s; }

    .cp-toast-wrap { position:fixed; bottom:24px; right:26px; z-index:9999; display:flex; flex-direction:column-reverse; gap:10px; align-items:flex-end; pointer-events:none; }
    .cp-toast { display:flex; align-items:center; gap:10px; padding:13px 20px; border-radius:11px; font-family:'Inter',sans-serif; font-size:13px; font-weight:600; animation:apFadeUp .22s cubic-bezier(.4,0,.2,1); white-space:nowrap; pointer-events:auto; box-shadow:0 8px 24px rgba(10,46,28,0.15); }
    .cp-toast.success { background:${G.meadow}; color:#fff; border:1px solid ${G.meadowBorder}; }
    .cp-toast.error { background:#fff; color:${G.red}; border:1px solid ${G.redBorder}; }
    .cp-toast.info { background:#fff; color:${G.meadowDeep}; border:1px solid ${G.meadowBorder}; }

    .ap-modal-overlay { position:fixed; inset:0; background:rgba(10,30,20,0.48); z-index:2000; display:flex; align-items:center; justify-content:center; padding:20px; animation:apOverlayIn .15s ease; }
    .ap-modal { background:#fff; border-radius:15px; box-shadow:0 24px 60px rgba(10,46,28,0.22); overflow:hidden; }
    .ap-modal-header { padding:17px 20px; border-bottom:1px solid ${G.border}; display:flex; align-items:flex-start; gap:12px; background:${G.bg}; }
    .ap-modal-title { font-size:15.5px; font-weight:800; color:${G.ink}; margin:0; letter-spacing:-.1px; }
    .ap-modal-close { width:28px; height:28px; border-radius:8px; border:1px solid ${G.border}; background:#fff; cursor:pointer; color:${G.muted}; font-size:15px; line-height:1; display:flex; align-items:center; justify-content:center; flex-shrink:0; }
    .ap-modal-close:hover { background:${G.hover}; }

    /* Review panel — slide-over from the right, keeps queue context visible
       behind a dim backdrop instead of yanking the admin to a full modal. */
    .ap-panel-overlay { position:fixed; inset:0; background:rgba(10,30,20,0.4); z-index:2500; animation:apOverlayIn .15s ease; }
    .ap-panel { position:fixed; top:0; right:0; bottom:0; width:min(620px, 100vw); background:#fff; z-index:2501; display:flex; flex-direction:column; box-shadow:-16px 0 48px rgba(10,46,28,0.18); animation:apSlideIn .22s cubic-bezier(.16,1,.3,1); }
    .ap-kbd { display:inline-flex; align-items:center; justify-content:center; min-width:18px; height:18px; padding:0 4px; border-radius:5px; background:${G.hover}; border:1px solid ${G.border}; font-family:'IBM Plex Mono',monospace; font-size:10px; font-weight:700; color:${G.muted}; }
  `
  document.head.appendChild(s)
}

/* ─────────────────────────── CONSTANTS ─────────────────────────── */
const DEFAULT_PROGRAMS = ['BSIT', 'BSCS', 'BSEMC-GD', 'BSEMC-DAT']
const SEMESTERS = ['1st Semester', '2nd Semester', 'Midyear']
const POLL_MS = 20000

// PH school years run roughly June–May, so anything from June onward
// counts as the start of that calendar year's AY. Centers the dropdown
// on "today's" AY with a couple years of slack either side, so admins
// can still set up a queue for a term that hasn't started yet.
function currentAcademicYearStart(d = new Date()) {
  return d.getMonth() >= 5 ? d.getFullYear() : d.getFullYear() - 1
}
function academicYearOptions() {
  const start = currentAcademicYearStart()
  const years = []
  for (let y = start - 1; y <= start + 3; y++) years.push(`${y}-${y + 1}`)
  return years
}

const STATUS = {
  waiting:    { bg: '#F1F5F9', color: '#64748B', dot: '#94A3B8', label: 'Waiting'    },
  active:     { bg: G.meadowSoft, color: G.meadowDeep, dot: G.meadow, label: 'Their turn' },
  generating: { bg: G.blueSoft, color: G.blue, dot: '#3B82F6', label: 'Generating' },
  submitted:  { bg: G.amberSoft, color: '#92400E', dot: G.amber, label: 'Submitted'  },
  approved:   { bg: G.meadowSoft, color: G.meadowMid, dot: G.meadow, label: 'Approved'   },
  skipped:    { bg: '#FFF7ED', color: '#9A3412', dot: '#FB923C', label: 'Skipped'    },
}
const SCHED_STATUS = {
  draft:     { bg: G.hover, color: G.muted, border: G.border, label: 'Draft'     },
  submitted: { bg: G.amberSoft, color: '#92400E', border: G.amberBorder, label: 'Submitted' },
  approved:  { bg: G.meadowSoft, color: G.meadowMid, border: G.meadowBorder, label: 'Approved'  },
}

const PROG_COLORS = { 'BSIT': G.meadow, 'BSCS': '#2563EB', 'BSEMC-GD': '#7C3AED', 'BSEMC-DAT': '#D97706' }
const PROG_COLOR_PALETTE = [G.meadow, '#2563EB', '#7C3AED', '#D97706', '#DB2777', '#0EA5E9', '#CA8A04', '#059669']
function getProgColor(prog) {
  if (!prog) return G.meadow
  if (PROG_COLORS[prog]) return PROG_COLORS[prog]
  let hash = 0
  for (let i = 0; i < prog.length; i++) hash = prog.charCodeAt(i) + ((hash << 5) - hash)
  return PROG_COLOR_PALETTE[Math.abs(hash) % PROG_COLOR_PALETTE.length]
}
function progShort(prog = '') {
  const stripped = prog.replace(/^BS/, '')
  const parts = stripped.split('-')
  return parts.length > 1 ? parts[parts.length - 1] : stripped
}

const ICONS = {
  queue: <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8"><rect x="3" y="4" width="18" height="4" rx="1"/><rect x="3" y="10" width="18" height="4" rx="1"/><rect x="3" y="16" width="18" height="4" rx="1"/></svg>,
  inbox: <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8"><path d="M22 12h-6l-2 3h-4l-2-3H2"/><path d="M5.45 5.11 2 12v6a2 2 0 0 0 2 2h16a2 2 0 0 0 2-2v-6l-3.45-6.89A2 2 0 0 0 16.76 4H7.24a2 2 0 0 0-1.79 1.11z"/></svg>,
  calendar: <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8"><rect x="3" y="4" width="18" height="18" rx="2"/><line x1="16" y1="2" x2="16" y2="6"/><line x1="8" y1="2" x2="8" y2="6"/><line x1="3" y1="10" x2="21" y2="10"/></svg>,
  clipboard: <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8"><path d="M9 2h6a1 1 0 0 1 1 1v2H8V3a1 1 0 0 1 1-1z"/><rect x="5" y="4" width="14" height="17" rx="2"/><line x1="9" y1="11" x2="15" y2="11"/><line x1="9" y1="15" x2="15" y2="15"/></svg>,
  activity: <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8"><polyline points="22 12 18 12 15 21 9 3 6 12 2 12"/></svg>,
}

/* ─────────────────────────── HELPERS ─────────────────────────── */
function useEscapeClose(onClose) {
  useEffect(() => {
    const onKey = e => { if (e.key === 'Escape') onClose() }
    document.addEventListener('keydown', onKey)
    return () => document.removeEventListener('keydown', onKey)
  }, [onClose])
}

function useToast() {
  const [toasts, setToasts] = useState([])
  const toast = useCallback((msg, type = 'info', dur = 3200) => {
    const id = Date.now() + Math.random()
    setToasts(p => [...p, { id, message: msg, type }])
    setTimeout(() => setToasts(p => p.filter(t => t.id !== id)), dur)
  }, [])
  return { toasts, toast }
}
function ToastContainer({ toasts }) {
  const icons = {
    success: <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"><polyline points="20 6 9 17 4 12"/></svg>,
    error: <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"><circle cx="12" cy="12" r="10"/><line x1="12" y1="8" x2="12" y2="12"/><line x1="12" y1="16" x2="12.01" y2="16"/></svg>,
    info: <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"><circle cx="12" cy="12" r="10"/><path d="M12 8v4"/></svg>,
  }
  return <div className="cp-toast-wrap">{toasts.map(t => <div key={t.id} className={`cp-toast ${t.type}`}>{icons[t.type]}{t.message}</div>)}</div>
}

function Skel({ w = '100%', h = 13, r = 6, style = {} }) {
  return <div className="ap-skeleton" style={{ width: w, height: h, borderRadius: r, flexShrink: 0, ...style }} />
}
function Badge({ label, bg, color, border }) {
  return <span className="ap-badge" style={{ background: bg, color, borderColor: border || 'transparent' }}>{label}</span>
}
function EmptyState({ icon, text, action }) {
  return (
    <div style={{ padding: '42px 20px', textAlign: 'center', color: G.muted2, display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 11 }}>
      <div style={{ width: 44, height: 44, borderRadius: 12, background: G.bg, display: 'flex', alignItems: 'center', justifyContent: 'center', color: G.muted2 }}>{icon}</div>
      <div style={{ fontSize: 12.5, fontWeight: 500, maxWidth: 280, lineHeight: 1.5 }}>{text}</div>
      {action}
    </div>
  )
}

// The backend sends timestamps with no "Z"/offset (e.g. "2026-08-22T10:15:00").
// JS reads a bare string like that as *local* time, not UTC — on a PH
// client (UTC+8) that silently adds 8 hours to everything, so a schedule
// submitted seconds ago reads as "8h ago". Assume UTC when no timezone
// marker is present and append "Z" before parsing. Accepts a Date too
// (e.g. from ActivityTab, which builds Date objects up front).
function toSafeDate(dateLike) {
  if (!dateLike) return null
  let val = dateLike
  if (typeof val === 'string' && !/[zZ]|[+-]\d{2}:?\d{2}$/.test(val)) {
    val += 'Z'
  }
  const d = val instanceof Date ? val : new Date(val)
  return Number.isNaN(d.getTime()) ? null : d
}

function timeAgo(dateLike) {
  const d = toSafeDate(dateLike)
  if (!d) return ''
  const diff = Math.max(0, Date.now() - d.getTime())
  const min = Math.floor(diff / 60000)
  if (min < 1) return 'just now'
  if (min < 60) return `${min}m ago`
  const hr = Math.floor(min / 60)
  if (hr < 24) return `${hr}h ago`
  const day = Math.floor(hr / 24)
  if (day < 7) return `${day}d ago`
  return d.toLocaleDateString()
}

// Flags same-room/same-day/same-period collisions between a candidate
// schedule's events and events already merged into the master schedule
// (excluding the candidate's own program, in case it was previously
// approved and is being re-submitted). Pure client-side, no extra calls —
// the data is already on screen by the time a review is opened.
function computeConflicts(events = [], masterEvents = [], excludeProgram) {
  const key = e => `${e.day}__${e.period}__${e.room}`
  const masterByKey = new Map()
  for (const ev of masterEvents) {
    if (excludeProgram && ev.program === excludeProgram) continue
    const k = key(ev)
    if (!masterByKey.has(k)) masterByKey.set(k, [])
    masterByKey.get(k).push(ev)
  }
  const conflicts = []
  for (const ev of events) {
    if (!ev.room || !ev.day || !ev.period) continue
    const hits = masterByKey.get(key(ev))
    if (hits && hits.length) {
      conflicts.push({ event: ev, against: hits })
    }
  }
  return conflicts
}

/* ─────────────────────────── SHARED ORDER LIST ───────────────────────────
   Used by both CreateQueueModal and QueueTab's reorder view. Each program
   gets the same color-coded chip used everywhere else in the dashboard
   (submission rows, activity feed) instead of a plain number box, so the
   queue order reads as part of the same visual language. ── */
function DraggableOrderList({ order, dragIndex, overIndex, onDragStart, onDragEnter, onDrop, onDragEnd }) {
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 7 }}>
      {order.map((prog, i) => {
        const isDragging = dragIndex === i
        const isOver = overIndex === i && dragIndex !== null && dragIndex !== i
        const color = getProgColor(prog)
        return (
          <div key={prog} draggable
            onDragStart={() => onDragStart(i)}
            onDragEnter={() => onDragEnter(i)}
            onDragOver={e => e.preventDefault()}
            onDrop={() => onDrop(i)}
            onDragEnd={onDragEnd}
            className="ap-order-item"
            style={{
              border: `1.5px solid ${isOver ? G.meadow : G.border}`,
              boxShadow: isDragging ? '0 6px 16px rgba(10,46,28,0.16)' : '0 1px 3px rgba(10,46,28,0.04)',
              opacity: isDragging ? 0.55 : 1,
            }}>
            <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="#B8CCC0" strokeWidth="2" style={{ flexShrink: 0 }}><circle cx="9" cy="6" r="1"/><circle cx="9" cy="12" r="1"/><circle cx="9" cy="18" r="1"/><circle cx="15" cy="6" r="1"/><circle cx="15" cy="12" r="1"/><circle cx="15" cy="18" r="1"/></svg>
            <div style={{ width: 26, height: 26, borderRadius: 7, background: `${color}18`, border: `1.5px solid ${color}40`, color, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 10, fontWeight: 800, flexShrink: 0, fontFamily: "'IBM Plex Mono',monospace" }}>{progShort(prog)}</div>
            <div style={{ flex: 1, fontSize: 13, fontWeight: 700, color: G.ink }}>{prog}</div>
            <div style={{ fontSize: 10, fontWeight: 800, color: G.muted2, fontFamily: "'IBM Plex Mono',monospace" }}>#{i + 1}</div>
          </div>
        )
      })}
    </div>
  )
}

/* ─────────────────────────── ADMIN QUEUE RAIL ───────────────────────────
   Same visual language as the coordinator-side QueueRail (circular status
   nodes joined by a progress line) instead of the old boxy phase-track,
   so the two sides of the same queue look like one product. ── */
function AdminQueueRail({ programs, statuses, turnIndex }) {
  if (!programs || programs.length === 0) return null
  const n = programs.length
  const CIRCLE = 30
  const MIN_COL = 68
  return (
    <div style={{ width: '100%', overflowX: 'auto' }}>
      <div style={{ position: 'relative', minWidth: n * MIN_COL }}>
        {n > 1 && (
          <div style={{ position: 'absolute', top: CIRCLE / 2 - 1, left: `${50 / n}%`, right: `${50 / n}%`, height: 2 }}>
            {programs.slice(0, -1).map((prog, i) => (
              <div key={prog} style={{
                position: 'absolute', left: `${(i / (n - 1)) * 100}%`, width: `${100 / (n - 1)}%`, height: 2, borderRadius: 99,
                background: i < turnIndex ? G.meadowBorder : G.border,
              }} />
            ))}
          </div>
        )}
        <div style={{ display: 'flex', position: 'relative' }}>
          {programs.map((prog, i) => {
            const s = statuses[prog] || 'waiting'
            const stm = STATUS[s] || STATUS.waiting
            const isCurrent = i === turnIndex
            return (
              <div key={prog} style={{ flex: '1 1 0', minWidth: MIN_COL, display: 'flex', flexDirection: 'column', alignItems: 'center' }}>
                <div style={{
                  width: CIRCLE, height: CIRCLE, borderRadius: '50%', flexShrink: 0,
                  background: s === 'active' ? G.meadow : stm.bg,
                  border: `2px solid ${stm.dot}`,
                  display: 'flex', alignItems: 'center', justifyContent: 'center',
                  boxShadow: s === 'active' ? `0 0 0 5px ${stm.dot}22` : 'none',
                  transition: 'all .25s',
                }}>
                  {s === 'approved'
                    ? <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke={stm.color} strokeWidth="3"><polyline points="20 6 9 17 4 12"/></svg>
                    : s === 'generating'
                      ? <svg className="ap-spin" width="13" height="13" viewBox="0 0 24 24" fill="none" stroke={stm.color} strokeWidth="3"><path d="M21 12a9 9 0 1 1-6.22-8.56"/></svg>
                      : s === 'submitted'
                        ? <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke={stm.color} strokeWidth="2.5"><path d="M22 12h-6l-2 3h-4l-2-3H2"/><path d="M5.45 5.11 2 12v6a2 2 0 0 0 2 2h16a2 2 0 0 0 2-2v-6l-3.45-6.89A2 2 0 0 0 16.76 4H7.24a2 2 0 0 0-1.79 1.11z"/></svg>
                        : s === 'active'
                          ? <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="#fff" strokeWidth="3"><polygon points="5 3 19 12 5 21 5 3"/></svg>
                          : s === 'skipped'
                            ? <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke={stm.color} strokeWidth="2.5"><polyline points="13 17 18 12 13 7"/><polyline points="6 17 11 12 6 7"/></svg>
                            : <span style={{ width: 7, height: 7, borderRadius: '50%', background: stm.dot }} />}
                </div>
                <div style={{ marginTop: 7, textAlign: 'center' }}>
                  <div style={{ fontSize: 11.5, fontWeight: isCurrent ? 800 : 700, color: isCurrent ? G.meadowDeep : G.ink, whiteSpace: 'nowrap' }}>{prog}</div>
                  <div style={{ fontSize: 9, fontWeight: 800, color: stm.color, letterSpacing: '.4px', textTransform: 'uppercase', whiteSpace: 'nowrap', marginTop: 2 }}>{stm.label}</div>
                </div>
              </div>
            )
          })}
        </div>
      </div>
    </div>
  )
}

// Header banner copy — mirrors the coordinator side's "It's your turn" /
// "Waiting in line" head, but written from the admin's vantage point.
function queueHeadCopy(programs, statuses, turnIndex) {
  if (!programs.length) return { title: 'No queue', subtitle: '' }
  if (turnIndex >= programs.length) return { title: 'Queue complete', subtitle: 'Every program has had their turn.' }
  const prog = programs[turnIndex]
  const s = statuses[prog] || 'waiting'
  if (s === 'generating') return { title: `${prog} is generating`, subtitle: 'Their schedule is being solved right now.' }
  if (s === 'submitted') return { title: `${prog} submitted`, subtitle: 'Waiting on your review to advance the queue.' }
  return { title: `${prog}'s turn`, subtitle: 'Picking rooms and building their schedule now.' }
}

/* ─────────────────────────── CREATE QUEUE MODAL ─────────────────────────── */
function CreateQueueModal({ onClose, onCreate, programs }) {
  useEscapeClose(onClose)
  const [semester, setSemester] = useState('1st Semester')
  const [year, setYear] = useState(() => academicYearOptions()[1])
  const [order, setOrder] = useState([...programs])
  const [saving, setSaving] = useState(false)
  const [dragIndex, setDragIndex] = useState(null)
  const [overIndex, setOverIndex] = useState(null)

  function handleDrop(dropAt) {
    if (dragIndex === null || dragIndex === dropAt) { setDragIndex(null); setOverIndex(null); return }
    const next = [...order]
    const [moved] = next.splice(dragIndex, 1)
    next.splice(dropAt, 0, moved)
    setOrder(next)
    setDragIndex(null); setOverIndex(null)
  }
  async function handleCreate() {
    if (!year.trim()) return
    setSaving(true)
    try { await onCreate({ semester, academicYear: year, queue: order }); onClose() }
    catch (e) { alert(e?.response?.data?.detail || 'Failed to create queue') }
    finally { setSaving(false) }
  }

  return (
    <div className="ap-modal-overlay" onClick={onClose}>
      <div className="ap-modal" style={{ width: 460 }} onClick={e => e.stopPropagation()}>
        <div className="ap-modal-header" style={{ background: `linear-gradient(135deg, ${G.meadowDeep}, ${G.meadow})`, borderBottom: 'none' }}>
          <div style={{ width: 34, height: 34, borderRadius: 9, background: 'rgba(255,255,255,0.18)', color: '#fff', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="#fff" strokeWidth="2"><rect x="3" y="4" width="18" height="4" rx="1"/><rect x="3" y="10" width="18" height="4" rx="1"/><rect x="3" y="16" width="18" height="4" rx="1"/></svg>
          </div>
          <div style={{ flex: 1 }}>
            <h3 className="ap-modal-title" style={{ color: '#fff' }}>Create Coordinator Queue</h3>
            <p style={{ margin: '3px 0 0', fontSize: 11.5, color: 'rgba(255,255,255,0.82)' }}>Set the scheduling order for this semester</p>
          </div>
          <button onClick={onClose} className="ap-modal-close" style={{ background: 'rgba(255,255,255,0.18)', border: '1px solid rgba(255,255,255,0.32)', color: '#fff' }}>×</button>
        </div>

        <div style={{ padding: '20px 22px 22px' }}>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12, marginBottom: 20 }}>
            <div>
              <label style={{ fontSize: 11.5, fontWeight: 600, color: G.muted, display: 'block', marginBottom: 5 }}>Semester</label>
              <select value={semester} onChange={e => setSemester(e.target.value)} className="cp-inp">
                {SEMESTERS.map(s => <option key={s}>{s}</option>)}
              </select>
            </div>
            <div>
              <label style={{ fontSize: 11.5, fontWeight: 600, color: G.muted, display: 'block', marginBottom: 5 }}>Academic Year</label>
              <select value={year} onChange={e => setYear(e.target.value)} className="cp-inp">
                {academicYearOptions().map(y => <option key={y} value={y}>{y}</option>)}
              </select>
            </div>
          </div>

          <label style={{ fontSize: 11.5, fontWeight: 600, color: G.muted, display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 8 }}>
            <span>Scheduling Order</span>
            <span style={{ fontWeight: 500, color: G.meadow, display: 'inline-flex', alignItems: 'center', gap: 4 }}>
              <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><circle cx="9" cy="6" r="1"/><circle cx="9" cy="12" r="1"/><circle cx="9" cy="18" r="1"/><circle cx="15" cy="6" r="1"/><circle cx="15" cy="12" r="1"/><circle cx="15" cy="18" r="1"/></svg>
              drag to reorder
            </span>
          </label>
          <div style={{ marginBottom: 22, background: G.bg, border: `1px solid ${G.border}`, borderRadius: 12, padding: 8 }}>
            <DraggableOrderList
              order={order}
              dragIndex={dragIndex}
              overIndex={overIndex}
              onDragStart={setDragIndex}
              onDragEnter={setOverIndex}
              onDrop={handleDrop}
              onDragEnd={() => { setDragIndex(null); setOverIndex(null) }}
            />
          </div>

          <div style={{ display: 'flex', gap: 8, justifyContent: 'flex-end' }}>
            <button onClick={onClose} className="btn-outline">Cancel</button>
            <button onClick={handleCreate} disabled={saving} className="btn-primary" style={{ minWidth: 110, justifyContent: 'center' }}>
              {saving
                ? <><svg className="ap-spin" width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"><path d="M21 12a9 9 0 1 1-6.22-8.56"/></svg> Creating…</>
                : 'Create Queue'}
            </button>
          </div>
        </div>
      </div>
    </div>
  )
}

/* ─────────────────────────── REJECT MODAL ─────────────────────────── */
function RejectModal({ schedule, onClose, onReject }) {
  useEscapeClose(onClose)
  const [feedback, setFeedback] = useState('')
  const [saving, setSaving] = useState(false)

  async function handle() {
    if (!feedback.trim()) return
    setSaving(true)
    try { await onReject(schedule.id || schedule.scheduleId, feedback); onClose() }
    finally { setSaving(false) }
  }

  return (
    <div className="ap-modal-overlay" style={{ zIndex: 3000 }} onClick={onClose}>
      <div className="ap-modal" style={{ width: 440 }} onClick={e => e.stopPropagation()}>
        <div className="ap-modal-header">
          <div style={{ width: 34, height: 34, borderRadius: 9, background: G.redSoft, color: G.red, display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><circle cx="12" cy="12" r="10"/><line x1="15" y1="9" x2="9" y2="15"/><line x1="9" y1="9" x2="15" y2="15"/></svg>
          </div>
          <div style={{ flex: 1 }}>
            <h3 className="ap-modal-title">Reject Schedule</h3>
            <p style={{ margin: '3px 0 0', fontSize: 11.5, color: G.muted, lineHeight: 1.5 }}>
              The coordinator for <strong style={{ color: G.ink }}>{schedule?.programCode}</strong> will receive this feedback.
            </p>
          </div>
          <button onClick={onClose} className="ap-modal-close">×</button>
        </div>
        <div style={{ padding: '18px 22px 22px' }}>
          <textarea value={feedback} onChange={e => setFeedback(e.target.value)} rows={4}
            placeholder="Describe what needs to be corrected..." autoFocus
            className="cp-inp" style={{ resize: 'vertical', lineHeight: 1.6 }} />
          <p style={{ margin: '6px 0 18px', fontSize: 11, color: G.muted2 }}>{feedback.length} characters</p>
          <div style={{ display: 'flex', gap: 8, justifyContent: 'flex-end' }}>
            <button onClick={onClose} className="btn-outline">Cancel</button>
            <button onClick={handle} disabled={!feedback.trim() || saving} className="btn-danger" style={{ minWidth: 120, justifyContent: 'center', background: saving ? undefined : G.red, color: '#fff', border: 'none' }}>
              {saving ? 'Rejecting…' : 'Reject & Notify'}
            </button>
          </div>
        </div>
      </div>
    </div>
  )
}

/* ─────────────────────────── REVIEW PANEL (inbox-style slide-over) ───────────────────────────
   Replaces the old full-screen detail modal. Stays anchored to the
   Submissions list so the admin can page through pending schedules with
   the keyboard (J/K to move, A to approve, R to reject, Esc to close),
   optionally patch a room/period before approving, and see room/time
   conflicts against the master schedule before merging. ── */
function ReviewPanel({ scheduleId, pendingList, masterEvents, onClose, onApprove, onReject, onNavigate, onSaved, showToast }) {
  const [data, setData] = useState(null)
  const [loading, setLoading] = useState(true)
  const [showReject, setShowReject] = useState(false)
  const [acting, setActing] = useState(false)
  const [editing, setEditing] = useState(false)
  const [editedEvents, setEditedEvents] = useState([])
  const [savingEdit, setSavingEdit] = useState(false)

  useEscapeClose(() => { if (!showReject) onClose() })

  useEffect(() => {
    setLoading(true); setEditing(false)
    getSubmittedSchedule(scheduleId).then(d => { setData(d); setEditedEvents(d?.schedule || []) })
      .catch(() => setData(null)).finally(() => setLoading(false))
  }, [scheduleId])

  // Keyboard nav — ignored while typing in the reject/edit inputs or with
  // the reject modal open, so shortcuts never eat real text.
  useEffect(() => {
    function onKey(e) {
      const typing = ['INPUT', 'TEXTAREA', 'SELECT'].includes(e.target.tagName)
      if (typing || showReject) return
      if (e.key === 'j' || e.key === 'ArrowDown') { e.preventDefault(); onNavigate(1) }
      else if (e.key === 'k' || e.key === 'ArrowUp') { e.preventDefault(); onNavigate(-1) }
      else if ((e.key === 'a' || e.key === 'A') && data?.status === 'submitted' && !editing) { e.preventDefault(); handleApprove() }
      else if ((e.key === 'r' || e.key === 'R') && data?.status === 'submitted' && !editing) { e.preventDefault(); setShowReject(true) }
    }
    document.addEventListener('keydown', onKey)
    return () => document.removeEventListener('keydown', onKey)
  }, [data, editing, showReject, onNavigate])

  async function handleApprove() {
    setActing(true)
    try { await onApprove(scheduleId) } finally { setActing(false) }
  }
  async function handleSaveEdit() {
    setSavingEdit(true)
    try {
      await adminEditSchedule(scheduleId, { events: editedEvents })
      setData(d => ({ ...d, schedule: editedEvents }))
      setEditing(false)
      showToast('Edits saved', 'success')
      onSaved?.()
    } catch (e) { showToast(e?.response?.data?.detail || 'Failed to save edits', 'error') }
    finally { setSavingEdit(false) }
  }
  function patchEvent(i, field, value) {
    setEditedEvents(prev => prev.map((ev, idx) => idx === i ? { ...ev, [field]: value } : ev))
  }

  const events = editing ? editedEvents : (data?.schedule || [])
  const st = SCHED_STATUS[data?.status] || SCHED_STATUS.submitted
  const isSubmitted = data?.status === 'submitted'
  const idx = pendingList.findIndex(s => (s.id || s.scheduleId) === scheduleId)
  const conflicts = useMemo(
    () => computeConflicts(data?.schedule || [], masterEvents, data?.programCode),
    [data, masterEvents]
  )
  const COLS = ['Course', 'Section', 'Session', 'Day', 'Period', 'Room', 'Faculty']

  return (
    <>
      <div className="ap-panel-overlay" onClick={onClose} />
      <div className="ap-panel">
        {/* Header */}
        <div style={{ padding: '16px 20px', borderBottom: `1px solid ${G.border}`, display: 'flex', alignItems: 'flex-start', gap: 12, background: G.bg, flexShrink: 0 }}>
          {data && (
            <div style={{ width: 36, height: 36, borderRadius: 10, background: `${getProgColor(data.programCode)}18`, color: getProgColor(data.programCode), display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
              <span style={{ fontSize: 10, fontWeight: 800, fontFamily: "'IBM Plex Mono',monospace" }}>{progShort(data.programCode || '')}</span>
            </div>
          )}
          <div style={{ flex: 1, minWidth: 0 }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
              <span style={{ fontSize: 15, fontWeight: 800, color: G.ink, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{loading ? 'Loading…' : data?.name}</span>
              {data && <Badge label={st.label} bg={st.bg} color={st.color} border={st.border} />}
            </div>
            {data && <div style={{ fontSize: 11.5, color: G.muted, marginTop: 2 }}>{data.programCode} · {events.length} events{data.semester ? ` · ${data.semester}` : ''}</div>}
          </div>
          {pendingList.length > 1 && (
            <div style={{ display: 'flex', alignItems: 'center', gap: 4, flexShrink: 0 }}>
              <button className="ap-icon-btn" disabled={idx <= 0} onClick={() => onNavigate(-1)} title="Previous (K)">
                <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"><polyline points="18 15 12 9 6 15"/></svg>
              </button>
              <span style={{ fontSize: 10.5, fontWeight: 700, color: G.muted2, fontFamily: "'IBM Plex Mono',monospace", minWidth: 32, textAlign: 'center' }}>{idx + 1}/{pendingList.length}</span>
              <button className="ap-icon-btn" disabled={idx < 0 || idx >= pendingList.length - 1} onClick={() => onNavigate(1)} title="Next (J)">
                <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"><polyline points="6 9 12 15 18 9"/></svg>
              </button>
            </div>
          )}
          <button onClick={onClose} className="ap-modal-close">×</button>
        </div>

        {/* Conflict banner */}
        {!loading && conflicts.length > 0 && (
          <div style={{ padding: '11px 20px', background: G.redSoft, borderBottom: `1px solid ${G.redBorder}`, display: 'flex', alignItems: 'center', gap: 9, flexShrink: 0 }}>
            <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke={G.red} strokeWidth="2.5" style={{ flexShrink: 0 }}><path d="M10.29 3.86 1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z"/><line x1="12" y1="9" x2="12" y2="13"/><line x1="12" y1="17" x2="12.01" y2="17"/></svg>
            <span style={{ fontSize: 12, fontWeight: 700, color: '#991B1B' }}>
              {conflicts.length} room/time conflict{conflicts.length > 1 ? 's' : ''} with the master schedule — check the highlighted rows below before approving.
            </span>
          </div>
        )}

        {/* Edit toolbar */}
        {!loading && isSubmitted && (
          <div style={{ padding: '9px 20px', borderBottom: `1px solid ${G.border}`, display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexShrink: 0, background: '#fff' }}>
            <span style={{ fontSize: 11, color: G.muted2, display: 'flex', alignItems: 'center', gap: 6 }}>
              <span className="ap-kbd">J</span><span className="ap-kbd">K</span> navigate · <span className="ap-kbd">A</span> approve · <span className="ap-kbd">R</span> reject
            </span>
            {editing ? (
              <div style={{ display: 'flex', gap: 7 }}>
                <button className="btn-outline" style={{ padding: '5px 11px', fontSize: 11.5 }} onClick={() => { setEditing(false); setEditedEvents(data?.schedule || []) }}>Cancel</button>
                <button className="btn-primary" style={{ padding: '5px 12px', fontSize: 11.5 }} onClick={handleSaveEdit} disabled={savingEdit}>{savingEdit ? 'Saving…' : 'Save Changes'}</button>
              </div>
            ) : (
              <button className="btn-outline" style={{ padding: '5px 11px', fontSize: 11.5 }} onClick={() => setEditing(true)}>
                <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"><path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"/><path d="M18.5 2.5a2.12 2.12 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"/></svg>
                Fix before approving
              </button>
            )}
          </div>
        )}

        {/* Table */}
        <div style={{ flex: 1, overflowY: 'auto' }}>
          {loading ? (
            <div style={{ padding: '40px 20px', display: 'flex', flexDirection: 'column', gap: 12 }}>
              {[...Array(6)].map((_, i) => <Skel key={i} h={34} r={8} style={{ opacity: 1 - i * 0.12 }} />)}
            </div>
          ) : events.length === 0 ? (
            <EmptyState icon={ICONS.clipboard} text="No events found in this schedule." />
          ) : (
            <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 12 }}>
              <thead style={{ position: 'sticky', top: 0, zIndex: 1 }}>
                <tr style={{ background: G.bg }}>
                  {COLS.map(h => (
                    <th key={h} style={{ padding: '9px 12px', textAlign: 'left', fontSize: 10, fontWeight: 700, color: G.muted, letterSpacing: 0.4, textTransform: 'uppercase', borderBottom: `1px solid ${G.border}`, whiteSpace: 'nowrap' }}>{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {events.map((ev, i) => {
                  const conflicted = conflicts.some(c => c.event === (data.schedule || [])[i])
                  return (
                    <tr key={i} className="ap-row" style={{ padding: 0, background: conflicted && !editing ? '#FEF2F2' : undefined }}>
                      <td style={{ padding: '8px 12px', fontWeight: 600, color: G.ink }}>{ev.courseCode}</td>
                      <td style={{ padding: '8px 12px', color: G.inkMid }}>{ev.program}-{ev.year}{ev.block}</td>
                      <td style={{ padding: '8px 12px', color: G.inkMid }}>{ev.session}</td>
                      <td style={{ padding: '8px 12px', color: G.inkMid }}>
                        {editing ? <input className="cp-inp sm" value={ev.day || ''} onChange={e => patchEvent(i, 'day', e.target.value)} /> : ev.day}
                      </td>
                      <td style={{ padding: '8px 12px', color: G.inkMid, whiteSpace: 'nowrap' }}>
                        {editing ? <input className="cp-inp sm" value={ev.period || ''} onChange={e => patchEvent(i, 'period', e.target.value)} style={{ width: 100 }} /> : ev.period}
                      </td>
                      <td style={{ padding: '8px 12px', color: conflicted && !editing ? '#991B1B' : G.inkMid, fontWeight: conflicted && !editing ? 700 : 400 }}>
                        {editing ? <input className="cp-inp sm" value={ev.room || ''} onChange={e => patchEvent(i, 'room', e.target.value)} style={{ width: 90 }} /> : ev.room}
                      </td>
                      <td style={{ padding: '8px 12px', color: G.muted }}>{ev.assigned_faculty || ev.faculty || 'TBA'}</td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          )}
        </div>

        {/* Footer actions */}
        {!loading && isSubmitted && !editing && (
          <div style={{ padding: '13px 20px', borderTop: `1px solid ${G.border}`, display: 'flex', gap: 8, justifyContent: 'flex-end', background: G.bg, flexShrink: 0 }}>
            <button onClick={() => setShowReject(true)} disabled={acting} className="btn-danger">
              <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"><circle cx="12" cy="12" r="10"/><line x1="15" y1="9" x2="9" y2="15"/><line x1="9" y1="9" x2="15" y2="15"/></svg>
              Reject
            </button>
            <button onClick={handleApprove} disabled={acting} className="btn-primary">
              {acting
                ? <><svg className="ap-spin" width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"><path d="M21 12a9 9 0 1 1-6.22-8.56"/></svg> Approving…</>
                : <><svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"><polyline points="20 6 9 17 4 12"/></svg> Approve{pendingList.length > 1 ? ' & Next' : ''}</>}
            </button>
          </div>
        )}
      </div>

      {showReject && (
        <RejectModal schedule={data}
          onClose={() => setShowReject(false)}
          onReject={async (id, fb) => { await onReject(id, fb); onClose() }} />
      )}
    </>
  )
}

/* ─────────────────────────── QUEUE TAB ─────────────────────────── */
function QueueTab({ queues, activeQueueId, setActiveQueueId, onSkip, onAdvance, onDelete, onReorder, showToast }) {
  const [acting, setActing] = useState(null)
  const [reordering, setReordering] = useState(false)
  const [order, setOrder] = useState([])
  const [dragIndex, setDragIndex] = useState(null)
  const [overIndex, setOverIndex] = useState(null)
  const [savingOrder, setSavingOrder] = useState(false)

  const queue = queues.find(q => (q.id || q.queueId) === activeQueueId) || queues[0] || null
  const programs = queue?.queue || []
  const statuses = queue?.programStatus || {}
  const turnIndex = queue?.currentTurnIndex ?? 0
  const skippable = programs.filter(p => statuses[p] === 'waiting' || statuses[p] === 'active')
  const canReorder = turnIndex === 0

  function startReorder() { setOrder([...programs]); setReordering(true) }
  function handleDrop(dropAt) {
    if (dragIndex === null || dragIndex === dropAt) { setDragIndex(null); setOverIndex(null); return }
    const next = [...order]
    const [moved] = next.splice(dragIndex, 1)
    next.splice(dropAt, 0, moved)
    setOrder(next); setDragIndex(null); setOverIndex(null)
  }
  async function saveOrder() {
    setSavingOrder(true)
    try { await onReorder(queue.id || queue.queueId, order); setReordering(false) }
    finally { setSavingOrder(false) }
  }

  async function doSkip(prog) { setActing(`skip-${prog}`); try { await onSkip(queue.id || queue.queueId, prog) } finally { setActing(null) } }
  async function doAdvance() { setActing('advance'); try { await onAdvance(queue.id || queue.queueId) } finally { setActing(null) } }
  async function doDelete() { if (!confirm('Delete this queue? This cannot be undone.')) return; await onDelete(queue.id || queue.queueId) }

  return (
    <div className="ap-card ap-fadein">
      <div className="aq-head" style={{ borderRadius: 0 }}>
        <div style={{ minWidth: 0 }}>
          <div className="aq-head-title">Coordinator Queue</div>
          <div className="aq-head-sub">{queue ? `${queue.semester} · ${queue.academicYear}` : 'No queues created'}</div>
        </div>
        {queue && programs.length > 0 && (
          <span className="aq-head-turn">
            {Math.min(turnIndex + 1, programs.length)}<span className="aq-head-of"> of {programs.length}</span>
          </span>
        )}
      </div>
      {queues.length > 1 && (
        <div style={{ display: 'flex', gap: 5, flexWrap: 'wrap', padding: '12px 20px', borderBottom: `1px solid ${G.border}` }}>
          {queues.map(q => {
            const qid = q.id || q.queueId
            return <button key={qid} onClick={() => { setActiveQueueId(qid); setReordering(false) }} className={`r-tab${activeQueueId === qid ? ' active' : ''}`}>{q.semester?.replace(' Semester', '')} {q.academicYear}</button>
          })}
        </div>
      )}

      {!queue ? (
        <EmptyState icon={ICONS.queue} text="No queues yet. Create one to get started." />
      ) : (
        <div style={{ padding: '22px 20px 20px' }}>
          {reordering ? (
            <div style={{ background: G.bg, border: `1px solid ${G.border}`, borderRadius: 13, padding: '20px 18px 16px' }}>
              <DraggableOrderList
                order={order}
                dragIndex={dragIndex}
                overIndex={overIndex}
                onDragStart={setDragIndex}
                onDragEnter={setOverIndex}
                onDrop={handleDrop}
                onDragEnd={() => { setDragIndex(null); setOverIndex(null) }}
              />
              <div style={{ display: 'flex', gap: 8, justifyContent: 'flex-end', marginTop: 11 }}>
                <button className="btn-outline" onClick={() => setReordering(false)}>Cancel</button>
                <button className="btn-primary" onClick={saveOrder} disabled={savingOrder}>{savingOrder ? 'Saving…' : 'Save Order'}</button>
              </div>
            </div>
          ) : (
            <div className="aq-card">
              <div className="aq-rail-wrap">
                <AdminQueueRail programs={programs} statuses={statuses} turnIndex={turnIndex} />
              </div>
            </div>
          )}

          {!reordering && (
            <>
              <div style={{ height: 1, background: G.borderLight, margin: '16px 0' }} />
              <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
                {skippable.length > 0 && (
                  <div style={{ display: 'flex', alignItems: 'center', gap: 6, flexWrap: 'wrap' }}>
                    <span style={{ fontSize: 11, fontWeight: 600, color: G.muted, marginRight: 2 }}>Skip:</span>
                    {skippable.map(prog => (
                      <button key={prog} onClick={() => doSkip(prog)} disabled={acting === `skip-${prog}`} className="btn-amber">{prog}</button>
                    ))}
                  </div>
                )}
                <div style={{ flex: 1 }} />
                <button
                  onClick={canReorder ? startReorder : () => showToast('Reorder is locked once the queue has started', 'info')}
                  className="btn-outline" title={canReorder ? 'Change the scheduling order' : 'Locked — the queue has already started'}>
                  <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><circle cx="9" cy="6" r="1"/><circle cx="9" cy="12" r="1"/><circle cx="9" cy="18" r="1"/><circle cx="15" cy="6" r="1"/><circle cx="15" cy="12" r="1"/><circle cx="15" cy="18" r="1"/></svg>
                  Reorder
                </button>
                <button onClick={doAdvance} disabled={acting === 'advance'} className="btn-primary">
                  {acting === 'advance'
                    ? <><svg className="ap-spin" width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"><path d="M21 12a9 9 0 1 1-6.22-8.56"/></svg> Advancing…</>
                    : <><svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"><polyline points="9 18 15 12 9 6"/></svg> Advance Queue</>}
                </button>
                <button onClick={doDelete} className="btn-danger" title="Delete queue" style={{ padding: '7px 10px' }}>
                  <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"><polyline points="3 6 5 6 21 6"/><path d="M19 6l-1 14H6L5 6"/><path d="M10 11v6"/><path d="M14 11v6"/><path d="M9 6V4h6v2"/></svg>
                </button>
              </div>
            </>
          )}
        </div>
      )}
    </div>
  )
}

/* ─────────────────────────── SUBMISSIONS TAB ─────────────────────────── */
function SubmissionsTab({ schedules, onOpen, onQuickApprove, onReject, onBulkApprove, loadingIds }) {
  const [search, setSearch] = useState('')
  const [rejectTarget, setRejectTarget] = useState(null)
  const [selected, setSelected] = useState(new Set())
  const [bulkBusy, setBulkBusy] = useState(false)

  const q = search.trim().toLowerCase()
  const matches = s => !q || `${s.name} ${s.programCode}`.toLowerCase().includes(q)
  const pending = schedules.filter(s => s.status === 'submitted' && matches(s)).sort((a, b) => new Date(a.submittedAt || 0) - new Date(b.submittedAt || 0))
  const approved = schedules.filter(s => s.status === 'approved' && matches(s)).sort((a, b) => new Date(b.approvedAt || b.submittedAt || 0) - new Date(a.approvedAt || a.submittedAt || 0))

  function toggleSelect(id) { setSelected(prev => { const n = new Set(prev); n.has(id) ? n.delete(id) : n.add(id); return n }) }
  function toggleSelectAll() { setSelected(prev => prev.size === pending.length ? new Set() : new Set(pending.map(s => s.id || s.scheduleId))) }
  async function runBulkApprove() {
    setBulkBusy(true)
    try { await onBulkApprove([...selected]); setSelected(new Set()) }
    finally { setBulkBusy(false) }
  }

  function ScheduleRow({ s }) {
    const st = SCHED_STATUS[s.status] || SCHED_STATUS.submitted
    const c = getProgColor(s.programCode)
    const id = s.id || s.scheduleId
    const isLoading = loadingIds.has(id)
    const isPending = s.status === 'submitted'
    return (
      <div className="ap-row">
        {isPending && (
          <input type="checkbox" checked={selected.has(id)} onChange={() => toggleSelect(id)} onClick={e => e.stopPropagation()}
            style={{ width: 15, height: 15, accentColor: G.meadow, cursor: 'pointer', flexShrink: 0 }} />
        )}
        <div onClick={() => onOpen(id)} style={{ display: 'flex', alignItems: 'center', gap: 14, flex: 1, minWidth: 0, cursor: 'pointer' }}>
          <div style={{ width: 38, height: 38, borderRadius: 10, background: `${c}18`, border: `1.5px solid ${c}35`, display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
            <span style={{ fontSize: 10, fontWeight: 800, color: c, fontFamily: "'IBM Plex Mono',monospace" }}>{progShort(s.programCode || '??')}</span>
          </div>
          <div style={{ flex: 1, minWidth: 0 }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 3, flexWrap: 'wrap' }}>
              <span style={{ fontSize: 13, fontWeight: 700, color: G.ink }}>{s.name}</span>
              <Badge label={st.label} bg={st.bg} color={st.color} border={st.border} />
            </div>
            <div style={{ display: 'flex', gap: 13, fontSize: 11.5, color: G.muted, flexWrap: 'wrap' }}>
              <span style={{ fontWeight: 600, color: c }}>{s.programCode}</span>
              {s.eventCount != null && <span>{s.eventCount} events</span>}
              {s.submittedAt && <span>Submitted {timeAgo(s.submittedAt)}</span>}
              {s.semester && <span>{s.semester}</span>}
            </div>
          </div>
        </div>
        <div style={{ display: 'flex', gap: 6, flexShrink: 0 }}>
          <button onClick={() => onOpen(id)} className="btn-outline">
            <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z"/><circle cx="12" cy="12" r="3"/></svg>
            Review
          </button>
          {isPending && (
            <>
              <button onClick={() => setRejectTarget(s)} disabled={isLoading} className="btn-danger" style={{ padding: '7px 10px' }} title="Reject">
                <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"><circle cx="12" cy="12" r="10"/><line x1="15" y1="9" x2="9" y2="15"/><line x1="9" y1="9" x2="15" y2="15"/></svg>
              </button>
              <button onClick={() => onQuickApprove(id)} disabled={isLoading} className="btn-primary">
                {isLoading ? <svg className="ap-spin" width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"><path d="M21 12a9 9 0 1 1-6.22-8.56"/></svg> : <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"><polyline points="20 6 9 17 4 12"/></svg>}
                Approve
              </button>
            </>
          )}
        </div>
      </div>
    )
  }

  return (
    <div className="ap-card ap-fadein">
      <div className="aq-head" style={{ borderRadius: 0, flexWrap: 'wrap' }}>
        <div style={{ minWidth: 0 }}>
          <div className="aq-head-title">Submitted Schedules</div>
          <div className="aq-head-sub">{pending.length} pending review{approved.length ? ` · ${approved.length} approved` : ''}</div>
        </div>
        {schedules.length > 3 && (
          <input value={search} onChange={e => setSearch(e.target.value)} placeholder="Search schedules…" className="cp-inp" style={{ width: 190, padding: '6px 11px', fontSize: 12 }} />
        )}
      </div>

      {pending.length > 0 && (
        <div style={{ padding: '9px 20px', borderBottom: `1px solid ${G.border}`, display: 'flex', alignItems: 'center', gap: 12, background: selected.size ? G.meadowSoft : G.bg }}>
          <label style={{ display: 'flex', alignItems: 'center', gap: 7, fontSize: 11.5, fontWeight: 600, color: G.muted, cursor: 'pointer' }}>
            <input type="checkbox" checked={selected.size === pending.length} onChange={toggleSelectAll} style={{ width: 14, height: 14, accentColor: G.meadow, cursor: 'pointer' }} />
            {selected.size > 0 ? `${selected.size} selected` : 'Select all pending'}
          </label>
          {selected.size > 0 && (
            <button className="btn-primary" style={{ padding: '5px 13px', fontSize: 11.5 }} onClick={runBulkApprove} disabled={bulkBusy}>
              {bulkBusy ? 'Approving…' : `Approve ${selected.size} selected`}
            </button>
          )}
        </div>
      )}

      {schedules.length === 0 ? (
        <EmptyState icon={ICONS.inbox} text="No submitted schedules yet. Coordinators will appear here once they submit." />
      ) : pending.length === 0 && approved.length === 0 ? (
        <EmptyState icon={ICONS.inbox} text={`No schedules match "${search}".`} />
      ) : (
        <>
          {pending.length > 0 && (
            <div>
              <div style={{ padding: '10px 20px 4px', fontSize: 10, fontWeight: 700, color: G.muted2, letterSpacing: 0.5, textTransform: 'uppercase' }}>Pending Review</div>
              {pending.map(s => <ScheduleRow key={s.id || s.scheduleId} s={s} />)}
            </div>
          )}
          {approved.length > 0 && (
            <div>
              <div style={{ padding: '10px 20px 4px', fontSize: 10, fontWeight: 700, color: G.muted2, letterSpacing: 0.5, textTransform: 'uppercase', borderTop: pending.length > 0 ? `1px solid ${G.border}` : 'none' }}>Approved</div>
              {approved.map(s => <ScheduleRow key={s.id || s.scheduleId} s={s} />)}
            </div>
          )}
        </>
      )}

      {rejectTarget && (
        <RejectModal schedule={rejectTarget} onClose={() => setRejectTarget(null)}
          onReject={async (id, fb) => { await onReject(id, fb); setRejectTarget(null) }} />
      )}
    </div>
  )
}

/* ─────────────────────────── MASTER SCHEDULE TAB ─────────────────────────── */
function MasterTab({ queueId, onFinalize, programs }) {
  const [master, setMaster] = useState(null)
  const [loading, setLoading] = useState(false)
  const [expanded, setExpanded] = useState(true)
  const [filter, setFilter] = useState('All')
  const [acting, setActing] = useState(false)

  useEffect(() => {
    if (!queueId) return
    setLoading(true)
    getMasterSchedule(queueId).then(setMaster).catch(() => setMaster(null)).finally(() => setLoading(false))
  }, [queueId])

  async function handleFinalize() {
    if (!confirm('Finalize and publish this schedule to faculty? This cannot be undone.')) return
    setActing(true)
    try { await onFinalize(queueId) } finally { setActing(false) }
  }

  if (!queueId) return <div className="ap-card ap-fadein"><EmptyState icon={ICONS.calendar} text="Create a coordinator queue first — the master schedule builds up as programs get approved." /></div>

  const events = master?.schedule || []
  const approved = master?.approvedPrograms || []
  const isFinalized = master?.status === 'finalized'
  const progList = ['All', ...new Set(events.map(e => e.program).filter(Boolean))]
  const visible = filter === 'All' ? events : events.filter(e => e.program === filter)

  return (
    <div className="ap-card ap-fadein">
      <div className="aq-head" style={{ borderRadius: 0, flexWrap: 'wrap' }}>
        <div style={{ minWidth: 0 }}>
          <div className="aq-head-title">Master Schedule</div>
          <div className="aq-head-sub">{approved.length} program(s) merged · {events.length} total events</div>
        </div>
        <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
          {isFinalized
            ? <Badge label="Published to Faculty" bg="rgba(255,255,255,0.18)" color="#fff" border="rgba(255,255,255,0.4)" />
            : approved.length > 0 && (
              <button onClick={handleFinalize} disabled={acting} className="btn-blue">
                {acting
                  ? <><svg className="ap-spin" width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"><path d="M21 12a9 9 0 1 1-6.22-8.56"/></svg> Finalizing…</>
                  : <><svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"><polyline points="22 12 18 12 15 21 9 3 6 12 2 12"/></svg> Finalize & Publish</>}
              </button>
            )}
          {events.length > 0 && (
            <button onClick={() => setExpanded(v => !v)} className="btn-outline" style={{ background: 'rgba(255,255,255,0.14)', borderColor: 'rgba(255,255,255,0.4)', color: '#fff' }}>
              {expanded
                ? <><svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"><polyline points="18 15 12 9 6 15"/></svg> Collapse</>
                : <><svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"><polyline points="6 9 12 15 18 9"/></svg> View Events</>}
            </button>
          )}
        </div>
      </div>

      {loading ? (
        <div style={{ padding: '24px 20px', display: 'flex', flexDirection: 'column', gap: 10 }}>{[...Array(3)].map((_, i) => <Skel key={i} h={14} style={{ opacity: 1 - i * 0.25 }} />)}</div>
      ) : !master ? (
        <EmptyState icon={ICONS.calendar} text="No master schedule yet. Approve coordinator schedules to start building it." />
      ) : (
        <>
          <div style={{ padding: '14px 20px', display: 'flex', flexWrap: 'wrap', gap: 8, borderBottom: expanded ? `1px solid ${G.border}` : 'none' }}>
            {programs.map(prog => {
              const done = approved.includes(prog)
              const c = getProgColor(prog)
              return (
                <div key={prog} style={{ display: 'flex', alignItems: 'center', gap: 6, padding: '5px 12px', borderRadius: 99, background: done ? `${c}14` : '#F1F5F9', border: `1px solid ${done ? `${c}40` : '#E2E8F0'}` }}>
                  <div style={{ width: 7, height: 7, borderRadius: 99, background: done ? c : '#CBD5E1', flexShrink: 0 }} />
                  <span style={{ fontSize: 11.5, fontWeight: 700, color: done ? c : '#94A3B8' }}>{prog}</span>
                  {done && <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke={c} strokeWidth="3"><polyline points="20 6 9 17 4 12"/></svg>}
                </div>
              )
            })}
          </div>

          {expanded && events.length > 0 && (
            <>
              <div style={{ padding: '10px 20px', background: G.bg, borderBottom: `1px solid ${G.border}`, display: 'flex', alignItems: 'center', gap: 6, flexWrap: 'wrap' }}>
                <span style={{ fontSize: 11, fontWeight: 600, color: G.muted, marginRight: 4 }}>Filter:</span>
                {progList.map(p => (
                  <button key={p} onClick={() => setFilter(p)} className={`r-tab${filter === p ? ' active' : ''}`}>
                    {p}{p !== 'All' && <span style={{ marginLeft: 5, opacity: 0.7, fontWeight: 400 }}>({events.filter(e => e.program === p).length})</span>}
                  </button>
                ))}
              </div>
              <div style={{ overflowX: 'auto', maxHeight: 380, overflowY: 'auto' }}>
                <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 12.5 }}>
                  <thead style={{ position: 'sticky', top: 0, zIndex: 1 }}>
                    <tr style={{ background: G.bg }}>
                      {['Program', 'Course', 'Section', 'Day', 'Period', 'Room', 'Faculty'].map(h => (
                        <th key={h} style={{ padding: '9px 14px', textAlign: 'left', fontSize: 10.5, fontWeight: 700, color: G.muted, letterSpacing: 0.4, textTransform: 'uppercase', borderBottom: `1px solid ${G.border}`, whiteSpace: 'nowrap' }}>{h}</th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {visible.map((ev, i) => {
                      const c = getProgColor(ev.program)
                      return (
                        <tr key={i} className="ap-row">
                          <td style={{ padding: '8px 14px' }}><span style={{ padding: '2px 8px', borderRadius: 6, background: `${c}14`, color: c, fontSize: 11, fontWeight: 700 }}>{ev.program}</span></td>
                          <td style={{ padding: '8px 14px', fontWeight: 600, color: G.ink }}>{ev.courseCode}</td>
                          <td style={{ padding: '8px 14px', color: G.inkMid }}>{ev.program}-{ev.year}{ev.block}</td>
                          <td style={{ padding: '8px 14px', color: G.inkMid }}>{ev.day}</td>
                          <td style={{ padding: '8px 14px', color: G.inkMid, whiteSpace: 'nowrap' }}>{ev.period}</td>
                          <td style={{ padding: '8px 14px', color: G.inkMid }}>{ev.room}</td>
                          <td style={{ padding: '8px 14px', color: G.muted }}>{ev.assigned_faculty || ev.faculty || 'TBA'}</td>
                        </tr>
                      )
                    })}
                  </tbody>
                </table>
              </div>
            </>
          )}
        </>
      )}
    </div>
  )
}

/* ─────────────────────────── ACTIVITY TAB (new) ───────────────────────────
   Derived entirely from timestamps already present on submitted schedules
   (submittedAt / approvedAt) — no extra endpoint needed — so the admin
   gets a running feed of what's happened without leaving the page. ── */
function ActivityTab({ schedules }) {
  const items = useMemo(() => {
    const out = []
    for (const s of schedules) {
      const c = getProgColor(s.programCode)
      if (s.submittedAt) out.push({ t: toSafeDate(s.submittedAt) || new Date(0), c, kind: 'submitted', text: `${s.programCode} submitted "${s.name}" for review` })
      if (s.status === 'approved' && s.approvedAt) out.push({ t: toSafeDate(s.approvedAt) || new Date(0), c, kind: 'approved', text: `${s.programCode}'s "${s.name}" was approved and merged` })
    }
    return out.sort((a, b) => b.t - a.t).slice(0, 40)
  }, [schedules])

  const KIND_META = {
    submitted: { bg: G.amberSoft, color: '#92400E', icon: <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"><path d="M22 12h-6l-2 3h-4l-2-3H2"/><path d="M5.45 5.11 2 12v6a2 2 0 0 0 2 2h16a2 2 0 0 0 2-2v-6l-3.45-6.89A2 2 0 0 0 16.76 4H7.24a2 2 0 0 0-1.79 1.11z"/></svg> },
    approved: { bg: G.meadowSoft, color: G.meadowDeep, icon: <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"><polyline points="20 6 9 17 4 12"/></svg> },
  }

  return (
    <div className="ap-card ap-fadein">
      <div className="aq-head" style={{ borderRadius: 0 }}>
        <div style={{ minWidth: 0 }}>
          <div className="aq-head-title">Recent Activity</div>
          <div className="aq-head-sub">Submissions and approvals across all coordinators</div>
        </div>
      </div>
      {items.length === 0 ? (
        <EmptyState icon={ICONS.activity} text="Nothing has happened yet — activity shows up here as coordinators submit and you approve schedules." />
      ) : (
        <div>
          {items.map((it, i) => {
            const m = KIND_META[it.kind]
            return (
              <div key={i} className="ap-row">
                <div style={{ width: 30, height: 30, borderRadius: 8, background: m.bg, color: m.color, display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>{m.icon}</div>
                <div style={{ flex: 1, fontSize: 12.5, color: G.inkMid, fontWeight: 500 }}>{it.text}</div>
                <div style={{ fontSize: 11, color: G.muted2, flexShrink: 0, fontFamily: "'IBM Plex Mono',monospace" }}>{timeAgo(it.t)}</div>
              </div>
            )
          })}
        </div>
      )}
    </div>
  )
}

/* ─────────────────────────── MAIN PAGE ─────────────────────────── */
export default function ApprovalDashboardPage() {
  const [queues, setQueues] = useState([])
  const [submitted, setSubmitted] = useState([])
  const [courses, setCourses] = useState([])
  const [loading, setLoading] = useState(true)
  const [refreshing, setRefreshing] = useState(false)
  const [lastUpdated, setLastUpdated] = useState(null)
  const [showCreate, setShowCreate] = useState(false)
  const [reviewId, setReviewId] = useState(null)
  const [activeQueueId, setActiveQueueId] = useState(null)
  const [approvingIds, setApprovingIds] = useState(new Set())
  const [tab, setTab] = useState('submissions')
  const [master, setMaster] = useState(null)
  const { toasts, toast } = useToast()

  const loadAll = useCallback(async (silent = false) => {
    if (silent) setRefreshing(true); else setLoading(true)
    try {
      // Each call used to swallow its own error and fall back to `[]`,
      // which is why submitted schedules could go quietly missing with
      // zero indication anything was wrong — a 401/404/500 from
      // /approval/submitted looked identical to "no one has submitted
      // yet". Log the real failure so it's visible in devtools, and
      // surface a toast specifically for the submissions fetch since
      // that's the one that was reported as "not showing".
      const [q, s, c] = await Promise.all([
        listQueues().catch(e => { console.error('listQueues failed:', e); return [] }),
        getSubmittedSchedules().catch(e => {
          console.error('getSubmittedSchedules failed:', e)
          toast(e?.response?.status ? `Couldn't load submitted schedules (${e.response.status})` : "Couldn't load submitted schedules — check your connection", 'error')
          return []
        }),
        getCourses().catch(e => { console.error('getCourses failed:', e); return [] }),
      ])
      const qArr = Array.isArray(q) ? q : (q?.queues ?? [])
      // Defensive: the backend has changed the wrapper key on other list
      // endpoints before (see `getSchedules` in api.js handling both
      // shapes). If /approval/submitted ever comes back wrapped under a
      // key other than `schedules` — `submitted`, `items`, `results` —
      // this used to silently resolve to [] with nothing in the console.
      const sArr = Array.isArray(s) ? s : (s?.schedules ?? s?.submitted ?? s?.items ?? s?.results ?? [])
      if (!Array.isArray(s) && s && typeof s === 'object' && sArr.length === 0 && Object.keys(s).length > 0) {
        console.warn('getSubmittedSchedules: unrecognized response shape, defaulted to empty list. Raw response:', s)
      }
      const cArr = Array.isArray(c) ? c : (c?.courses ?? [])
      setQueues(qArr)
      setSubmitted(sArr)
      setCourses(cArr)
      setActiveQueueId(prev => {
        if (prev) return prev
        const active = qArr.find(qq => qq.status === 'active') || qArr[0]
        return active ? (active.id || active.queueId) : null
      })
      setLastUpdated(new Date())
    } catch { if (!silent) toast('Failed to load data', 'error') }
    finally { setLoading(false); setRefreshing(false) }
  }, [toast])

  useEffect(() => { loadAll() }, [loadAll])

  useEffect(() => {
    if (showCreate || reviewId) return
    const t = setInterval(() => loadAll(true), POLL_MS)
    return () => clearInterval(t)
  }, [loadAll, showCreate, reviewId])

  // Master schedule events, kept at page level so the review panel can run
  // conflict checks without an extra fetch of its own.
  useEffect(() => {
    if (!activeQueueId) { setMaster(null); return }
    getMasterSchedule(activeQueueId).then(setMaster).catch(() => setMaster(null))
  }, [activeQueueId, submitted])

  const programs = useMemo(() => {
    const fromCourses = new Set(courses.map(c => c.program).filter(Boolean))
    if (fromCourses.size === 0) return DEFAULT_PROGRAMS
    return [...fromCourses].sort()
  }, [courses])

  const pendingList = useMemo(
    () => submitted.filter(s => s.status === 'submitted').sort((a, b) => new Date(a.submittedAt || 0) - new Date(b.submittedAt || 0)),
    [submitted]
  )

  /* ── Queue handlers ── */
  async function handleCreate(data) {
    try { await createQueue(data); toast('Queue created!', 'success'); loadAll(true) }
    catch (e) { toast(e?.response?.data?.detail || 'Failed to create queue', 'error') }
  }
  async function handleSkip(qId, prog) {
    try { await skipProgram(qId, prog); toast(`${prog} skipped`, 'info'); loadAll(true) }
    catch (e) { toast(e?.response?.data?.detail || 'Skip failed', 'error') }
  }
  async function handleAdvance(qId) {
    try { await advanceQueue(qId); toast('Queue advanced', 'success'); loadAll(true) }
    catch (e) { toast(e?.response?.data?.detail || 'Advance failed', 'error') }
  }
  async function handleDeleteQueue(qId) {
    try { await deleteQueue(qId); toast('Queue deleted', 'info'); setActiveQueueId(null); loadAll() }
    catch (e) { toast(e?.response?.data?.detail || 'Delete failed', 'error') }
  }
  async function handleReorder(qId, order) {
    try { await reorderQueue(qId, { queue: order }); toast('Scheduling order updated', 'success'); loadAll(true) }
    catch (e) { toast(e?.response?.data?.detail || 'Reorder failed', 'error') }
  }

  /* ── Approval handlers ── */
  async function handleApprove(id) {
    setApprovingIds(s => new Set(s).add(id))
    try {
      await approveSchedule(id)
      toast('Schedule approved and merged into master!', 'success')
      // Inbox flow: jump to the next pending item instead of just closing.
      const remaining = pendingList.filter(s => (s.id || s.scheduleId) !== id)
      setReviewId(remaining.length ? (remaining[0].id || remaining[0].scheduleId) : null)
      loadAll(true)
    } catch (e) { toast(e?.response?.data?.detail || 'Approval failed', 'error') }
    finally { setApprovingIds(s => { const n = new Set(s); n.delete(id); return n }) }
  }
  async function handleBulkApprove(ids) {
    let ok = 0, fail = 0
    setApprovingIds(s => new Set([...s, ...ids]))
    for (const id of ids) {
      try { await approveSchedule(id); ok++ } catch { fail++ }
    }
    setApprovingIds(s => { const n = new Set(s); ids.forEach(id => n.delete(id)); return n })
    toast(fail ? `Approved ${ok}, ${fail} failed` : `Approved ${ok} schedule${ok === 1 ? '' : 's'}`, fail ? 'error' : 'success')
    loadAll(true)
  }
  async function handleReject(id, feedback) {
    try {
      await rejectSchedule(id, { feedback })
      toast('Feedback sent — schedule returned to draft', 'info')
      setReviewId(prev => prev === id ? null : prev)
      loadAll(true)
    } catch (e) { toast(e?.response?.data?.detail || 'Reject failed', 'error') }
  }
  async function handleFinalize(qId) {
    try { await finalizeMasterSchedule(qId); toast('Master schedule published to faculty!', 'success'); loadAll() }
    catch (e) { toast(e?.response?.data?.detail || 'Finalize failed', 'error') }
  }
  function navigateReview(delta) {
    const idx = pendingList.findIndex(s => (s.id || s.scheduleId) === reviewId)
    const next = pendingList[idx + delta]
    if (next) setReviewId(next.id || next.scheduleId)
  }

  /* ── Stats ── */
  const pendingCount = submitted.filter(s => s.status === 'submitted').length
  const approvedCount = submitted.filter(s => s.status === 'approved').length
  const queueCount = queues.length
  const activeCount = queues.filter(q => q.status === 'active').length

  const TABS = [
    { id: 'submissions', label: 'Submissions', badge: pendingCount ? `${pendingCount}` : null },
    { id: 'queue', label: 'Queue Control', badge: queueCount ? `${activeCount}/${queueCount}` : null },
    { id: 'master', label: 'Master Schedule', badge: approvedCount ? `${approvedCount}` : null },
    { id: 'activity', label: 'Activity' },
  ]

  return (
    <div className="ap-root" style={{ padding: '20px 28px 60px', display: 'flex', flexDirection: 'column', gap: 16, minHeight: '100%' }}>

      {/* Tabs + toolbar, one row */}
      {loading ? (
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 12, flexWrap: 'wrap' }}>
          <div style={{ display: 'flex', gap: 6 }}>
            {[72, 96, 108, 70].map((w, i) => <Skel key={i} w={w} h={32} r={9} />)}
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
            <Skel w={32} h={32} r={8} />
            <Skel w={104} h={32} r={8} />
          </div>
        </div>
      ) : (
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 12, flexWrap: 'wrap' }}>
          <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
            {TABS.map(t => (
              <button key={t.id} className={`ap-tab${tab === t.id ? ' active' : ''}`} onClick={() => setTab(t.id)}>
                {t.label}
                {t.badge && <span className="ap-tab-count">{t.badge}</span>}
              </button>
            ))}
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: 10, flexShrink: 0 }}>
            {lastUpdated && <span style={{ fontSize: 11, color: G.muted2, fontWeight: 500 }}>Updated {lastUpdated.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</span>}
            <button onClick={() => loadAll(true)} disabled={refreshing || loading} className="ap-icon-btn" title="Refresh">
              <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" className={refreshing ? 'ap-spin' : undefined}><polyline points="23 4 23 10 17 10"/><polyline points="1 20 1 14 7 14"/><path d="M3.51 9a9 9 0 0 1 14.85-3.36L23 10M1 14l4.64 4.36A9 9 0 0 0 20.49 15"/></svg>
            </button>
            <button onClick={() => setShowCreate(true)} className="btn-primary" style={{ padding: '9px 18px', fontSize: 12.5 }}>
              <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"><line x1="12" y1="5" x2="12" y2="19"/><line x1="5" y1="12" x2="19" y2="12"/></svg>
              New Queue
            </button>
          </div>
        </div>
      )}

      {loading ? (
        <div className="ap-card" style={{ overflow: 'hidden' }}>
          <div className="aq-head" style={{ borderRadius: 0, opacity: 0.55 }}>
            <div style={{ minWidth: 0, width: '100%' }}>
              <Skel w={170} h={14} style={{ background: 'rgba(255,255,255,0.35)' }} />
              <div style={{ height: 7 }} />
              <Skel w={220} h={10} style={{ background: 'rgba(255,255,255,0.22)' }} />
            </div>
          </div>
          <div style={{ padding: '20px' }}>
            <div style={{ display: 'flex', gap: 16, marginBottom: 18 }}>
              {[0, 1, 2, 3].map(i => (
                <div key={i} style={{ flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 8 }}>
                  <Skel w={30} h={30} r={99} />
                  <Skel w={50} h={9} />
                </div>
              ))}
            </div>
            <Skel h={1} style={{ margin: '4px 0 16px' }} />
            {[0, 1, 2].map(i => <div key={i} style={{ marginBottom: i < 2 ? 10 : 0 }}><Skel h={30} r={8} style={{ opacity: 1 - i * 0.18 }} /></div>)}
          </div>
        </div>
      ) : (
        <>
          {tab === 'submissions' && (
            <SubmissionsTab
              schedules={submitted}
              onOpen={setReviewId}
              onQuickApprove={handleApprove}
              onReject={handleReject}
              onBulkApprove={handleBulkApprove}
              loadingIds={approvingIds}
            />
          )}
          {tab === 'queue' && (
            <QueueTab
              queues={queues}
              activeQueueId={activeQueueId}
              setActiveQueueId={setActiveQueueId}
              onSkip={handleSkip}
              onAdvance={handleAdvance}
              onDelete={handleDeleteQueue}
              onReorder={handleReorder}
              showToast={toast}
            />
          )}
          {tab === 'master' && (
            <MasterTab queueId={activeQueueId} onFinalize={handleFinalize} programs={programs} />
          )}
          {tab === 'activity' && <ActivityTab schedules={submitted} />}
        </>
      )}

      {/* Modals / overlays */}
      {showCreate && <CreateQueueModal onClose={() => setShowCreate(false)} onCreate={handleCreate} programs={programs} />}
      {reviewId && (
        <ReviewPanel
          scheduleId={reviewId}
          pendingList={pendingList}
          masterEvents={master?.schedule || []}
          onClose={() => setReviewId(null)}
          onApprove={handleApprove}
          onReject={handleReject}
          onNavigate={navigateReview}
          onSaved={() => loadAll(true)}
          showToast={toast}
        />
      )}

      <ToastContainer toasts={toasts} />
    </div>
  )
}