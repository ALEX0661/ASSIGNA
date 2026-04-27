import { useState, useEffect, useRef, useMemo, useCallback } from 'react'
import { useNavigate } from 'react-router-dom'
import {
  getFaculty, getCourses,
  triggerSolve, getSolveStatus,
  getResult, saveSchedule, listSaved, loadSaved, deleteSaved,
} from '../../services/api'
import { useScheduleStore, useSolverStore } from '../../store/scheduleStore'

/* ─────────────────────────── constants ─────────────────────────── */

const PHASES = [
  { label: 'NSTP',         short: 'NSTP' },
  { label: 'GEC / MAT',    short: 'GEC'  },
  { label: 'Year 4',       short: 'Y4'   },
  { label: 'Year 3',       short: 'Y3'   },
  { label: 'Year 2',       short: 'Y2'   },
  { label: 'Year 1',       short: 'Y1'   },
  { label: 'PE / PATHFIT', short: 'PE'   },
]

const RATING_LABELS = { 5: 'Expert', 4: 'Highly Proficient', 3: 'Competent', 2: 'Developing', 1: 'Beginner' }
const RATING_SHORT  = { 5: 'Expert', 4: 'H.Prof', 3: 'Comp', 2: 'Dev', 1: 'Basic' }
const RATING_COLORS = { 5: '#059669', 4: '#2563EB', 3: '#7C6FCD', 2: '#D97706', 1: '#C0392B' }
const RATING_BG     = { 5: '#E6FAF3', 4: '#EBF0FF', 3: '#EEEAFB', 2: '#FEF3CD', 1: '#FFE8E8' }

const OTHER_DEPT_PREFIXES = ['PE', 'NSTP', 'MAT', 'MATH', 'PATHFIT', 'GEC']
function isOtherDept(courseCode = '') {
  const upper = courseCode.toUpperCase().trim()
  return OTHER_DEPT_PREFIXES.some(p => upper.startsWith(p))
}

const STATUS_META = {
  no_faculty:  { label: 'No faculty',   color: '#C0392B', bg: '#FFE8E8', border: '#FECACA' },
  low_quality: { label: 'Low quality',  color: '#92400e', bg: '#FEF3CD', border: '#FCD34D' },
  thin:        { label: 'Thin pool',    color: '#1e40af', bg: '#EBF0FF', border: '#BFDBFE' },
  ready:       { label: 'Ready',        color: '#065f46', bg: '#E6FAF3', border: '#A7F3D0' },
  other_dept:  { label: 'Ext. managed', color: '#7C6FCD', bg: '#EEEAFB', border: '#D8D3F5' },
}

/* ─────────────────────────── styles ─────────────────────────── */

if (!document.getElementById('scheduler-page-style')) {
  const s = document.createElement('style')
  s.id = 'scheduler-page-style'
  s.textContent = `
    .sch-root  { display:flex; gap:20px; padding:28px 32px; align-items:flex-start; }
    .sch-main  { flex:1; min-width:0; display:flex; flex-direction:column; gap:14px; }
    .sch-aside { width:310px; flex-shrink:0; position:sticky; top:72px; }

    .step-card { background:#fff; border-radius:16px; border:1px solid #E8E4F8; overflow:hidden; box-shadow:0 2px 10px rgba(124,111,205,0.07); transition:box-shadow 0.2s; }
    .step-card:hover { box-shadow:0 4px 20px rgba(124,111,205,0.12); }
    .step-card.active-card { border-color:#C5BBEF; }

    .step-header { display:flex; align-items:center; gap:14px; padding:16px 20px; border-bottom:1px solid #F0EDF9; }
    .step-num { width:28px; height:28px; border-radius:50%; display:flex; align-items:center; justify-content:center; font-size:11px; font-weight:800; flex-shrink:0; letter-spacing:.2px; }
    .step-num.pending { background:#F0EDF9; color:#B0ABCC; }
    .step-num.active  { background:linear-gradient(135deg,#A99BE8,#7C6FCD); color:#fff; box-shadow:0 3px 10px rgba(124,111,205,0.4); }
    .step-num.done    { background:linear-gradient(135deg,#6EE7B7,#059669); color:#fff; }
    .step-body { padding:18px 20px; }

    .r-tab { display:inline-flex; align-items:center; gap:5px; padding:5px 12px; border-radius:8px; font-family:'Poppins',sans-serif; font-size:12px; font-weight:600; cursor:pointer; transition:all .14s; border:1.5px solid #E8E4F8; background:#F5F4FB; color:#8883B0; }
    .r-tab.active { background:linear-gradient(135deg,#7C6FCD,#5a4fbf); color:#fff; border-color:transparent; box-shadow:0 2px 8px rgba(124,111,205,0.28); }
    .r-tab:hover:not(.active) { background:#EEEAFB; border-color:#D8D3F5; }

    .r-stat { flex:1; display:flex; flex-direction:column; align-items:center; padding:10px 6px; border-radius:10px; border:1px solid; transition:transform .15s, box-shadow .15s; }
    .r-stat.clickable { cursor:pointer; }
    .r-stat.clickable:hover { transform:translateY(-1px); box-shadow:0 4px 12px rgba(0,0,0,.06); }

    .course-row { border-bottom:1px solid #F5F4FB; }
    .course-row:last-child { border-bottom:none; }
    .course-row-main { display:flex; align-items:center; gap:12px; padding:10px 14px; transition:background .12s; cursor:pointer; }
    .course-row-main:hover { background:#FAFAFE; }

    .star-fill  { fill:#7C6FCD; stroke:#7C6FCD; }
    .star-empty { fill:none;    stroke:#D8D3F5; }

    .pool-bar-wrap { flex:1; max-width:80px; height:5px; background:#F0EDF9; border-radius:99px; overflow:hidden; }
    .pool-bar-fill { height:100%; border-radius:99px; transition:width .4s; }

    .faculty-pool-panel { background:#FAFAFE; border-top:1px solid #F0EDF9; padding:10px 14px 12px 42px; animation:sch-fadein .15s ease; }
    .faculty-chip { display:inline-flex; align-items:center; gap:5px; padding:3px 9px; border-radius:99px; font-size:11px; font-weight:600; border:1px solid; }

    /* Faculty pool modal */
    .fp-modal-backdrop { position:fixed; inset:0; background:rgba(26,26,46,0.38); display:flex; align-items:center; justify-content:center; z-index:600; backdrop-filter:blur(4px); padding:24px; }
    .fp-modal { background:#fff; border-radius:20px; width:100%; max-width:480px; max-height:82vh; display:flex; flex-direction:column; box-shadow:0 24px 64px rgba(26,26,46,0.22); border:1px solid #E8E4F8; animation:sch-fadein .18s cubic-bezier(.4,0,.2,1); overflow:hidden; }
    .fp-modal-head { padding:20px 22px 16px; border-bottom:1px solid #F0EDF9; flex-shrink:0; }
    .fp-modal-body { overflow-y:auto; flex:1; padding:0 22px 20px; }
    .fp-frow { display:flex; align-items:center; gap:12px; padding:11px 0; border-bottom:1px solid #F5F4FB; }
    .fp-frow:last-child { border-bottom:none; }
    .fp-avatar { width:32px; height:32px; border-radius:50%; display:flex; align-items:center; justify-content:center; font-size:10px; font-weight:700; flex-shrink:0; }
    .fp-ubar-wrap { flex:1; height:4px; background:#F0EDF9; border-radius:99px; overflow:hidden; }
    .fp-ubar-fill { height:100%; border-radius:99px; transition:width .5s; }

    /* Rating mini stacked bar */
    .r-minibar { display:flex; height:4px; border-radius:99px; overflow:hidden; gap:1px; width:60px; flex-shrink:0; }

    .wl-bar-wrap { flex:1; height:5px; background:#F0EDF9; border-radius:99px; overflow:hidden; }
    .wl-bar-fill { height:100%; border-radius:99px; transition:width .5s; }

    .phase-track  { display:flex; align-items:flex-start; gap:0; margin-top:18px; }
    .phase-step   { flex:1; display:flex; flex-direction:column; align-items:center; position:relative; }
    .phase-connector { position:absolute; top:11px; left:50%; width:100%; height:2px; transition:background .4s; z-index:0; }
    .phase-dot    { width:22px; height:22px; border-radius:50%; z-index:1; display:flex; align-items:center; justify-content:center; transition:all .35s ease; }
    .phase-label  { font-size:9px; margin-top:5px; font-weight:600; text-align:center; letter-spacing:.3px; transition:color .3s; }

    .prog-bar-wrap { height:5px; background:#F0EDF9; border-radius:99px; overflow:hidden; margin-top:12px; }
    .prog-bar-fill { height:100%; border-radius:99px; transition:width .6s cubic-bezier(.4,0,.2,1); }

    .solve-btn { display:inline-flex; align-items:center; gap:8px; padding:10px 24px; border-radius:10px; font-family:'Poppins',sans-serif; font-size:13px; font-weight:600; cursor:pointer; transition:all .18s; border:none; }
    .solve-btn.idle    { background:linear-gradient(135deg,#7C6FCD,#5a4fbf); color:#fff; box-shadow:0 4px 14px rgba(124,111,205,0.4); }
    .solve-btn.idle:hover { opacity:.92; transform:translateY(-1px); box-shadow:0 6px 20px rgba(124,111,205,0.45); }
    .solve-btn.running { background:#F0EDF9; color:#8883B0; cursor:not-allowed; }
    .solve-btn.again   { background:#fff; color:#7C6FCD; border:1.5px solid #C5BBEF; }
    .solve-btn.again:hover { background:#EEEAFB; }

    .status-strip { display:flex; align-items:center; gap:10px; padding:10px 14px; border-radius:10px; margin-top:14px; font-size:12.5px; font-weight:500; }
    .status-strip.running  { background:#F0EDFB; color:#5a4fbf; border:1px solid #D8D3F5; }
    .status-strip.complete { background:#E6FAF3; color:#065f46; border:1px solid #A7F3D0; }
    .status-strip.failed   { background:#FFF0F0; color:#991B1B; border:1px solid #FECACA; }

    .save-row { display:flex; align-items:center; gap:10px; margin-top:16px; padding-top:16px; border-top:1px solid #F0EDF9; flex-wrap:wrap; }
    .save-name-input { flex:1; min-width:180px; padding:9px 13px; border-radius:10px; border:1.5px solid #E8E4F8; font-family:'Poppins',sans-serif; font-size:13px; color:#1a1a2e; background:#fff; outline:none; transition:border-color .15s; }
    .save-name-input:focus { border-color:#A99BE8; box-shadow:0 0 0 3px rgba(169,155,232,0.13); }
    .save-name-input::placeholder { color:#C0BBDC; }
    .save-name-input:disabled { background:#FAFAFE; color:#B0ABCC; }

    .aside-panel  { background:#fff; border-radius:16px; border:1px solid #E8E4F8; box-shadow:0 2px 10px rgba(124,111,205,0.07); overflow:hidden; }
    .aside-header { padding:14px 18px; border-bottom:1px solid #F0EDF9; display:flex; align-items:center; justify-content:space-between; }

    .saved-item { display:flex; align-items:center; gap:11px; padding:11px 18px; cursor:default; transition:background .14s; }
    .saved-item:hover { background:#FAFAFE; }
    .saved-item + .saved-item { border-top:1px solid #F5F4FB; }
    .saved-icon { width:32px; height:32px; border-radius:9px; background:#EEEAFB; display:flex; align-items:center; justify-content:center; flex-shrink:0; }
    .saved-actions { display:flex; gap:5px; margin-left:auto; flex-shrink:0; }
    .saved-actions button { padding:5px 10px; border-radius:7px; font-size:11.5px; font-weight:600; cursor:pointer; font-family:'Poppins',sans-serif; transition:all .13s; }
    .saved-load-btn { background:#EEEAFB; color:#7C6FCD; border:1px solid #D8D3F5; }
    .saved-load-btn:hover:not(:disabled) { background:#DDD6F5; }
    .saved-load-btn:disabled { opacity:.5; cursor:default; }
    .saved-del-btn  { background:#FFF0F0; color:#C0392B; border:1px solid #FECACA; }
    .saved-del-btn:hover  { background:#FFE0E0; }

    .check-btn { display:inline-flex; align-items:center; gap:7px; padding:7px 15px; border-radius:9px; border:1.5px solid #E8E4F8; background:#fff; color:#3D3580; font-family:'Poppins',sans-serif; font-size:12px; font-weight:600; cursor:pointer; transition:all .15s; }
    .check-btn:hover:not(:disabled) { background:#EEEAFB; border-color:#C5BBEF; }
    .check-btn:disabled { opacity:.6; cursor:default; }
    .view-btn  { display:inline-flex; align-items:center; gap:7px; padding:9px 18px; border-radius:10px; border:1.5px solid #E8E4F8; background:#fff; color:#3D3580; font-family:'Poppins',sans-serif; font-size:13px; font-weight:600; cursor:pointer; transition:all .15s; }
    .view-btn:hover { background:#F5F4FB; }
    .prim-btn  { display:inline-flex; align-items:center; gap:7px; padding:9px 20px; border-radius:10px; border:none; background:linear-gradient(135deg,#7C6FCD,#5a4fbf); color:#fff; font-family:'Poppins',sans-serif; font-size:13px; font-weight:600; cursor:pointer; transition:all .15s; box-shadow:0 3px 10px rgba(124,111,205,0.35); }
    .prim-btn:hover:not(:disabled) { opacity:.92; box-shadow:0 5px 16px rgba(124,111,205,0.42); }
    .prim-btn:disabled { opacity:.45; cursor:default; }
    .prim-btn.success-btn { background:linear-gradient(135deg,#10b981,#059669); box-shadow:0 3px 10px rgba(5,150,105,0.3); }

    .sch-title-bar { display:flex; align-items:flex-start; justify-content:space-between; margin-bottom:20px; }

    @keyframes solverPulse { 0%,100%{transform:scale(1);opacity:.55} 50%{transform:scale(1.65);opacity:0} }
    @keyframes sch-spin    { to { transform:rotate(360deg) } }
    @keyframes sch-fadein  { from{opacity:0;transform:translateY(4px)} to{opacity:1;transform:translateY(0)} }
    @keyframes sch-toast-in { from{opacity:0;transform:translateX(-50%) translateY(12px) scale(.96)} to{opacity:1;transform:translateX(-50%) translateY(0) scale(1)} }
    .spin   { animation:sch-spin 1s linear infinite; }
    .fadein { animation:sch-fadein .2s ease both; }

    /* Toast */
    .sch-toast-wrap { position:fixed; bottom:24px; left:50%; z-index:9999; display:flex; flex-direction:column; gap:8px; align-items:center; pointer-events:none; transform:translateX(-50%); }
    .sch-toast { display:flex; align-items:center; gap:9px; padding:10px 16px; border-radius:12px; font-family:'Poppins',sans-serif; font-size:12.5px; font-weight:500; box-shadow:0 8px 28px rgba(26,26,46,0.18); animation:sch-toast-in .22s cubic-bezier(.4,0,.2,1); white-space:nowrap; pointer-events:auto; }
    .sch-toast.success { background:#1a1a2e; color:#6EE7B7; }
    .sch-toast.error   { background:#1a1a2e; color:#FCA5A5; }
    .sch-toast.info    { background:#1a1a2e; color:#A99BE8; }

    /* Search */
    .sch-search { padding:6px 10px 6px 30px; border-radius:8px; border:1px solid #E8E4F8; font-family:'Poppins',sans-serif; font-size:12px; background:#FAFAFE; color:#1a1a2e; outline:none; transition:border-color .15s; width:100%; box-sizing:border-box; }
    .sch-search:focus { border-color:#A99BE8; box-shadow:0 0 0 3px rgba(169,155,232,0.12); }

    /* Delete modal */
    .del-modal-backdrop { position:fixed; inset:0; background:rgba(26,26,46,0.4); display:flex; align-items:center; justify-content:center; z-index:500; backdrop-filter:blur(3px); }
    .del-modal-box { background:#fff; border-radius:16px; width:340px; padding:24px; box-shadow:0 16px 48px rgba(26,26,46,0.2); border:1px solid #E8E4F8; animation:sch-fadein .18s cubic-bezier(.4,0,.2,1); }
  `
  document.head.appendChild(s)
}

/* ─────────────────────────── pure helpers ─────────────────────────── */

function buildReadinessReport(courses, facultyList) {
  // Build pool map from faculty specializations
  const poolMap = {}
  for (const f of facultyList) {
    for (const spec of (f.specializations || [])) {
      const code = (spec.courseCode || '').trim().toUpperCase()
      if (!code) continue
      if (!poolMap[code]) poolMap[code] = []
      poolMap[code].push({ name: f.name || 'Unknown', rating: spec.rating || 1, units: f.units || 0, max_units: f.max_units || 21 })
    }
  }

  // Deduplicate courses by courseCode (keep first occurrence)
  const seen = new Map()
  for (const c of courses) {
    const key = (c.courseCode || '').trim().toUpperCase()
    if (key && !seen.has(key)) seen.set(key, c)
  }

  return [...seen.values()].map(c => {
    const code           = (c.courseCode || '').trim().toUpperCase()
    const otherDept      = isOtherDept(code)
    const pool           = (poolMap[code] || []).sort((a, b) => b.rating - a.rating)
    const poolSize       = pool.length
    const bestRating     = poolSize > 0 ? pool[0].rating : 0
    const qualifiedPool  = pool.filter(f => f.rating >= 3)
    const qualifiedCount = qualifiedPool.length
    const availablePool  = qualifiedPool.filter(f => f.units < f.max_units)
    const availableCount = availablePool.length

    // Rating distribution across ALL pool members
    const ratingDist = {}
    for (const f of pool) ratingDist[f.rating] = (ratingDist[f.rating] || 0) + 1

    const status = otherDept
      ? 'other_dept'
      : poolSize === 0  ? 'no_faculty'
      : bestRating <= 2 ? 'low_quality'
      : qualifiedCount <= 1 ? 'thin'
      : 'ready'

    return { courseCode: c.courseCode, title: c.title, program: c.program, yearLevel: c.yearLevel,
             pool, poolSize, bestRating, qualifiedCount, availableCount, status, otherDept, ratingDist }
  })
}

function buildWorkloadReport(facultyList) {
  return facultyList
    .map(f => ({
      name: f.name || 'Unknown', units: f.units || 0, max_units: f.max_units || 21,
      pct: Math.min(100, Math.round(((f.units || 0) / (f.max_units || 21)) * 100)),
      status: (f.units || 0) >= (f.max_units || 21) ? 'full' : (f.units || 0) >= (f.max_units || 21) * 0.8 ? 'near' : 'ok',
    }))
    .sort((a, b) => b.pct - a.pct)
}

/* ─────────────────────────── Toast system ─────────────────────────── */

function useToast() {
  const [toasts, setToasts] = useState([])
  const toast = useCallback((message, type = 'info', duration = 3000) => {
    const id = Date.now() + Math.random()
    setToasts(prev => [...prev, { id, message, type }])
    setTimeout(() => setToasts(prev => prev.filter(t => t.id !== id)), duration)
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
    <div className="sch-toast-wrap">
      {toasts.map(t => (
        <div key={t.id} className={`sch-toast ${t.type}`}>
          {icons[t.type]}
          {t.message}
        </div>
      ))}
    </div>
  )
}

/* ─────────────────────────── Delete confirm modal ─────────────────────────── */

function DeleteModal({ name, onConfirm, onCancel }) {
  return (
    <div className="del-modal-backdrop" onClick={onCancel}>
      <div className="del-modal-box" onClick={e => e.stopPropagation()}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 14 }}>
          <div style={{ width: 38, height: 38, borderRadius: 10, background: '#FFF0F0', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="#C0392B" strokeWidth="2">
              <polyline points="3 6 5 6 21 6"/><path d="M19 6l-1 14H6L5 6"/><path d="M10 11v6"/><path d="M14 11v6"/>
            </svg>
          </div>
          <div>
            <p style={{ fontSize: 13.5, fontWeight: 700, color: '#1a1a2e', margin: 0 }}>Delete schedule?</p>
            <p style={{ fontSize: 12, color: '#8883B0', marginTop: 2 }}>This action cannot be undone.</p>
          </div>
        </div>
        <div style={{ background: '#F5F4FB', borderRadius: 9, padding: '9px 13px', marginBottom: 18 }}>
          <p style={{ fontSize: 12.5, color: '#3D3580', fontWeight: 600, margin: 0, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>"{name}"</p>
        </div>
        <div style={{ display: 'flex', gap: 9, justifyContent: 'flex-end' }}>
          <button onClick={onCancel} style={{ padding: '8px 16px', borderRadius: 9, border: '1.5px solid #E8E4F8', background: '#fff', color: '#8883B0', fontSize: 12.5, fontWeight: 600, cursor: 'pointer', fontFamily: "'Poppins',sans-serif", transition: 'all .15s' }}>
            Cancel
          </button>
          <button onClick={onConfirm} style={{ padding: '8px 16px', borderRadius: 9, border: 'none', background: 'linear-gradient(135deg,#EF4444,#C0392B)', color: '#fff', fontSize: 12.5, fontWeight: 600, cursor: 'pointer', fontFamily: "'Poppins',sans-serif", boxShadow: '0 3px 10px rgba(192,57,43,0.28)' }}>
            Delete
          </button>
        </div>
      </div>
    </div>
  )
}

/* ─────────────────────────── sub-components ─────────────────────────── */

function Badge({ children, type = 'neutral' }) {
  const map = { green: ['#E6FAF3','#065f46'], red: ['#FFE8E8','#991B1B'], amber: ['#FEF3CD','#78350f'], neutral: ['#EEEAFB','#3D3580'], blue: ['#EBF0FF','#1e40af'] }
  const [bg, color] = map[type] || map.neutral
  return <span style={{ display:'inline-flex', alignItems:'center', gap:4, padding:'3px 10px', borderRadius:99, fontSize:11, fontWeight:700, background:bg, color }}>{children}</span>
}

function StepNum({ n, state }) {
  return (
    <div className={`step-num ${state}`}>
      {state === 'done'
        ? <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="#fff" strokeWidth="3"><polyline points="20 6 9 17 4 12"/></svg>
        : n}
    </div>
  )
}

function MiniStars({ rating, size = 9 }) {
  return (
    <span style={{ display:'inline-flex', gap:1.5 }}>
      {[1,2,3,4,5].map(s => (
        <svg key={s} width={size} height={size} viewBox="0 0 24 24" strokeWidth="2" className={s <= rating ? 'star-fill' : 'star-empty'}>
          <polygon points="12 2 15.09 8.26 22 9.27 17 14.14 18.18 21.02 12 17.77 5.82 21.02 7 14.14 2 9.27 8.91 8.26 12 2"/>
        </svg>
      ))}
    </span>
  )
}

/* ── Faculty Pool Modal ── */
function FacultyPoolModal({ item, onClose }) {
  if (!item) return null
  const meta = STATUS_META[item.status]
  const qualified   = item.pool.filter(f => f.rating >= 3)
  const unqualified = item.pool.filter(f => f.rating < 3)

  const mkIni = name => (name || '').split(/\s+/).filter(Boolean).map(n => n[0]).join('').slice(0, 2).toUpperCase()

  return (
    <div className="fp-modal-backdrop" onClick={onClose}>
      <div className="fp-modal" onClick={e => e.stopPropagation()}>

        {/* Header */}
        <div className="fp-modal-head">
          <div style={{ display:'flex', alignItems:'flex-start', justifyContent:'space-between', gap:12 }}>
            <div style={{ flex:1, minWidth:0 }}>
              <div style={{ display:'flex', alignItems:'center', gap:9, flexWrap:'wrap', marginBottom:4 }}>
                <span style={{ fontFamily:'monospace', fontSize:13, fontWeight:700, color:'#3D3580' }}>{item.courseCode}</span>
                <span style={{ fontSize:10.5, fontWeight:700, padding:'2px 10px', borderRadius:99, background:meta.bg, color:meta.color, border:`1px solid ${meta.border}`, flexShrink:0 }}>{meta.label}</span>
              </div>
              <p style={{ fontSize:13.5, fontWeight:600, color:'#1a1a2e', marginBottom:10, lineHeight:1.35 }}>{item.title || '—'}</p>
              {/* Stat row */}
              <div style={{ display:'flex', gap:16 }}>
                {[
                  { val: item.poolSize,       label: 'in pool',          c: '#7C6FCD' },
                  { val: item.qualifiedCount,  label: 'qualified (≥ 3)',  c: '#059669' },
                  { val: item.availableCount,  label: 'available',        c: '#2563EB' },
                ].map(s => (
                  <div key={s.label}>
                    <span style={{ fontSize:18, fontWeight:700, color:s.c, lineHeight:1 }}>{s.val}</span>
                    <span style={{ fontSize:10.5, color:'#B0ABCC', marginLeft:5 }}>{s.label}</span>
                  </div>
                ))}
              </div>
            </div>
            <button onClick={onClose} style={{ width:30, height:30, borderRadius:8, border:'1.5px solid #E8E4F8', background:'#fff', cursor:'pointer', display:'flex', alignItems:'center', justifyContent:'center', color:'#B0ABCC', fontSize:16, flexShrink:0, lineHeight:1 }}>×</button>
          </div>
        </div>

        {/* Body */}
        <div className="fp-modal-body">
          {item.pool.length === 0 ? (
            <div style={{ textAlign:'center', padding:'32px 0', color:'#C0BBDC', fontSize:13 }}>No faculty assigned to this course yet.</div>
          ) : (
            <>
              {qualified.length > 0 && (
                <div style={{ marginTop:16 }}>
                  <p style={{ fontSize:10, fontWeight:700, color:'#B0ABCC', textTransform:'uppercase', letterSpacing:'.8px', marginBottom:8 }}>Qualified faculty — can be scheduled</p>
                  {qualified.map((f, i) => {
                    const isFull = f.units >= f.max_units
                    const pct    = Math.min(100, Math.round((f.units / f.max_units) * 100))
                    const barCol = isFull ? '#C0392B' : pct > 80 ? '#D97706' : '#059669'
                    return (
                      <div key={i} className="fp-frow" style={{ opacity: isFull ? 0.6 : 1 }}>
                        <div className="fp-avatar" style={{ background:RATING_BG[f.rating], color:RATING_COLORS[f.rating] }}>{mkIni(f.name)}</div>
                        <div style={{ flex:1, minWidth:0 }}>
                          <div style={{ display:'flex', alignItems:'center', justifyContent:'space-between', marginBottom:5 }}>
                            <span style={{ fontSize:12.5, fontWeight:600, color:'#1a1a2e', overflow:'hidden', textOverflow:'ellipsis', whiteSpace:'nowrap' }}>{f.name}</span>
                            <div style={{ display:'flex', alignItems:'center', gap:6, flexShrink:0, marginLeft:8 }}>
                              {isFull && <span style={{ fontSize:9.5, fontWeight:700, padding:'1px 6px', borderRadius:99, background:'#FFE8E8', color:'#C0392B' }}>At cap</span>}
                              <span style={{ fontSize:10.5, fontWeight:700, padding:'1px 8px', borderRadius:99, background:RATING_BG[f.rating], color:RATING_COLORS[f.rating] }}>{RATING_LABELS[f.rating]}</span>
                              <MiniStars rating={f.rating} size={8} />
                            </div>
                          </div>
                          <div style={{ display:'flex', alignItems:'center', gap:8 }}>
                            <div className="fp-ubar-wrap"><div className="fp-ubar-fill" style={{ width:`${pct}%`, background:barCol }} /></div>
                            <span style={{ fontSize:10.5, fontWeight:600, color:barCol, whiteSpace:'nowrap' }}>{f.units}/{f.max_units} units</span>
                          </div>
                        </div>
                      </div>
                    )
                  })}
                </div>
              )}

              {unqualified.length > 0 && (
                <div style={{ marginTop:18 }}>
                  <p style={{ fontSize:10, fontWeight:700, color:'#D0CCE8', textTransform:'uppercase', letterSpacing:'.8px', marginBottom:8 }}>Below threshold — not eligible for scheduling</p>
                  {unqualified.map((f, i) => (
                    <div key={i} className="fp-frow" style={{ opacity:0.5 }}>
                      <div className="fp-avatar" style={{ background:'#F5F4FB', color:'#C0BBDC' }}>{mkIni(f.name)}</div>
                      <div style={{ flex:1, minWidth:0 }}>
                        <div style={{ display:'flex', alignItems:'center', justifyContent:'space-between' }}>
                          <span style={{ fontSize:12.5, fontWeight:600, color:'#8883B0', overflow:'hidden', textOverflow:'ellipsis', whiteSpace:'nowrap' }}>{f.name}</span>
                          <span style={{ fontSize:10.5, fontWeight:600, padding:'1px 8px', borderRadius:99, background:'#F5F4FB', color:'#C0BBDC', flexShrink:0, marginLeft:8 }}>{RATING_LABELS[f.rating]}</span>
                        </div>
                      </div>
                    </div>
                  ))}
                  <p style={{ fontSize:11, color:'#C0BBDC', marginTop:10, lineHeight:1.5 }}>
                    Faculty need a rating of Competent (3) or above to be eligible. These members can still be manually assigned.
                  </p>
                </div>
              )}
            </>
          )}
        </div>

      </div>
    </div>
  )
}

function CourseRow({ item, onOpenModal }) {
  const meta = STATUS_META[item.status]
  const barColor = item.status === 'ready' ? '#059669' : item.status === 'thin' ? '#2563EB' : item.status === 'low_quality' ? '#D97706' : item.status === 'other_dept' ? '#A99BE8' : '#C0392B'
  const qualBarPct = item.poolSize === 0 ? 0 : Math.min(100, (item.qualifiedCount / item.poolSize) * 100)
  const canOpen = item.poolSize > 0 && !item.otherDept

  // Stacked mini-bar segments (5→1)
  const total = item.poolSize || 1
  const ratingSegs = [5,4,3,2,1].filter(r => item.ratingDist?.[r])

  return (
    <div className="course-row">
      <div className="course-row-main"
        onClick={() => canOpen && onOpenModal(item)}
        style={{ cursor: canOpen ? 'pointer' : 'default', padding:'12px 16px', gap:14 }}>

        {/* Status dot */}
        <div style={{ width:7, height:7, borderRadius:'50%', flexShrink:0, background:meta.color }} />

        <div style={{ flex:1, minWidth:0 }}>
          <div style={{ display:'flex', alignItems:'center', gap:8, marginBottom:3 }}>
            <span style={{ fontSize:12, fontWeight:700, color:'#3D3580', fontFamily:'monospace' }}>{item.courseCode}</span>
            {item.otherDept && <span style={{ fontSize:9.5, fontWeight:700, padding:'1px 7px', borderRadius:99, background:'#EEEAFB', color:'#7C6FCD' }}>Ext. dept</span>}
          </div>
          <span style={{ fontSize:12, color:'#8883B0', overflow:'hidden', textOverflow:'ellipsis', whiteSpace:'nowrap', display:'block' }}>{item.title || '—'}</span>
        </div>

        {/* Stacked rating mini-bar + qual count */}
        {!item.otherDept && (
          <div style={{ display:'flex', flexDirection:'column', alignItems:'flex-end', gap:4, flexShrink:0 }}>
            <div style={{ display:'flex', height:4, borderRadius:99, overflow:'hidden', gap:1, width:64 }}>
              {ratingSegs.length === 0
                ? <div style={{ flex:1, background:'#F0EDF9', borderRadius:99 }} />
                : ratingSegs.map(r => (
                    <div key={r} style={{ flex: item.ratingDist[r] / total, background: r >= 3 ? RATING_COLORS[r] : '#E5E7EB', borderRadius:99 }}
                      title={`${item.ratingDist[r]}× ${RATING_LABELS[r]}`} />
                  ))
              }
            </div>
            <span style={{ fontSize:10.5, fontWeight:600, color:'#8883B0', whiteSpace:'nowrap' }}>
              {item.qualifiedCount}/{item.poolSize} qualified
            </span>
          </div>
        )}

        <span style={{ fontSize:10.5, fontWeight:700, padding:'3px 10px', borderRadius:99, flexShrink:0, whiteSpace:'nowrap', background:meta.bg, color:meta.color, border:`1px solid ${meta.border}` }}>{meta.label}</span>

        {canOpen && (
          <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="#C5BBEF" strokeWidth="2.5" style={{ flexShrink:0 }}>
            <polyline points="9 18 15 12 9 6"/>
          </svg>
        )}
      </div>
    </div>
  )
}

function WorkloadRow({ f }) {
  const barColor = f.status === 'full' ? '#C0392B' : f.status === 'near' ? '#D97706' : '#059669'
  return (
    <div style={{ display:'flex', alignItems:'center', gap:10, padding:'7px 0', borderBottom:'1px solid #F5F4FB' }}>
      <div style={{ width:26, height:26, borderRadius:'50%', flexShrink:0, display:'flex', alignItems:'center', justifyContent:'center', fontSize:9, fontWeight:700,
        background: f.status === 'full' ? '#FFE8E8' : f.status === 'near' ? '#FEF3CD' : '#E6FAF3', color: barColor }}>
        {f.name.split(' ').map(n => n[0]).join('').slice(0,2).toUpperCase()}
      </div>
      <span style={{ fontSize:12, fontWeight:500, color:'#1a1a2e', flex:1, overflow:'hidden', textOverflow:'ellipsis', whiteSpace:'nowrap', minWidth:0 }}>{f.name}</span>
      <div className="wl-bar-wrap" style={{ maxWidth:72 }}><div className="wl-bar-fill" style={{ width:`${f.pct}%`, background:barColor }} /></div>
      <span style={{ fontSize:11, fontWeight:700, color:barColor, whiteSpace:'nowrap', minWidth:38, textAlign:'right' }}>{f.units}/{f.max_units}</span>
    </div>
  )
}

function PhaseTimeline({ currentPhaseIdx, status, progress }) {
  const idle = status === 'idle', done = status === 'complete'
  return (
    <div>
      <div style={{ display:'flex', justifyContent:'space-between', alignItems:'center', marginBottom:6 }}>
        <span style={{ fontSize:11.5, fontWeight:500, color: idle ? '#C0BBDC' : '#8883B0' }}>
          {idle ? '7 solving phases' : done ? 'All phases complete' : `Phase ${Math.min(currentPhaseIdx + 1, 7)} of 7 — ${PHASES[Math.min(currentPhaseIdx, 6)]?.label}`}
        </span>
        <span style={{ fontSize:12, fontWeight:700, color: idle ? '#C0BBDC' : done ? '#059669' : '#7C6FCD' }}>{idle ? '—' : `${progress}%`}</span>
      </div>
      <div className="prog-bar-wrap">
        <div className="prog-bar-fill" style={{ width:`${idle ? 0 : progress}%`, background: done ? 'linear-gradient(90deg,#6EE7B7,#059669)' : 'linear-gradient(90deg,#A99BE8,#7C6FCD)' }} />
      </div>
      <div className="phase-track">
        {PHASES.map((ph, i) => {
          const phaseDone = done || i < currentPhaseIdx, phaseActive = !done && !idle && i === currentPhaseIdx
          return (
            <div key={ph.label} className="phase-step">
              {i < PHASES.length - 1 && <div className="phase-connector" style={{ background: (phaseDone && !idle) ? '#7C6FCD' : '#E8E4F8' }} />}
              <div className="phase-dot" style={{ background: idle ? '#F5F4FB' : phaseDone ? '#7C6FCD' : phaseActive ? '#fff' : '#F0EDF9', border: idle ? '2px solid #E8E4F8' : phaseActive ? '2px solid #7C6FCD' : phaseDone ? 'none' : '2px solid #E8E4F8', boxShadow: phaseActive ? '0 0 0 4px rgba(124,111,205,0.16)' : 'none' }}>
                {phaseDone && !idle ? <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="#fff" strokeWidth="3"><polyline points="20 6 9 17 4 12"/></svg>
                  : phaseActive ? <div style={{ width:7, height:7, borderRadius:'50%', background:'#7C6FCD' }} /> : null}
              </div>
              <span className="phase-label" style={{ color: idle ? '#D0CCE8' : phaseDone ? '#7C6FCD' : phaseActive ? '#3D3580' : '#C0BBDC' }}>{ph.short}</span>
            </div>
          )
        })}
      </div>
    </div>
  )
}

function SolveIconBubble({ running }) {
  return (
    <div style={{ position:'relative', width:46, height:46, flexShrink:0 }}>
      {running && <div style={{ position:'absolute', inset:0, borderRadius:'50%', background:'rgba(124,111,205,0.18)', animation:'solverPulse 1.5s ease-in-out infinite' }} />}
      <div style={{ width:46, height:46, borderRadius:'50%', display:'flex', alignItems:'center', justifyContent:'center', boxShadow:'0 4px 14px rgba(124,111,205,0.38)', background: running ? 'linear-gradient(135deg,#A99BE8,#7C6FCD)' : 'linear-gradient(135deg,#7C6FCD,#5a4fbf)' }}>
        {running
          ? <svg className="spin" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="#fff" strokeWidth="2.2"><path d="M21 12a9 9 0 1 1-6.219-8.56"/></svg>
          : <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="#fff" strokeWidth="2.2"><polygon points="5 3 19 12 5 21 5 3"/></svg>}
      </div>
    </div>
  )
}

function SavedItem({ name, onLoad, onDelete, loading }) {
  return (
    <div className="saved-item fadein">
      <div className="saved-icon">
        <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="#7C6FCD" strokeWidth="2">
          <rect x="3" y="4" width="18" height="18" rx="2"/>
          <line x1="16" y1="2" x2="16" y2="6"/><line x1="8" y1="2" x2="8" y2="6"/><line x1="3" y1="10" x2="21" y2="10"/>
        </svg>
      </div>
      <span style={{ flex:1, fontSize:12.5, fontWeight:600, color:'#1a1a2e', overflow:'hidden', textOverflow:'ellipsis', whiteSpace:'nowrap' }}>{name}</span>
      <div className="saved-actions">
        <button className="saved-load-btn" onClick={() => onLoad(name)} disabled={loading}>
          {loading ? <svg className="spin" width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M21 12a9 9 0 1 1-6.219-8.56"/></svg> : 'Load'}
        </button>
        <button className="saved-del-btn" onClick={() => onDelete(name)} disabled={loading}>
          <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
            <polyline points="3 6 5 6 21 6"/><path d="M19 6l-1 14H6L5 6"/>
          </svg>
        </button>
      </div>
    </div>
  )
}

/* ─────────────────────────── main page ─────────────────────────── */

export default function SchedulerPage() {
  const navigate  = useNavigate()
  const setEvents = useScheduleStore(s => s.setEvents)
  const setName   = useScheduleStore(s => s.setName)
  const { processId, progress, status, setProcessId, setProgress, setStatus, reset } = useSolverStore()
  const { toasts, toast } = useToast()

  const [readiness,    setReadiness]    = useState(null)
  const [workload,     setWorkload]     = useState(null)
  const [checkLoading, setCheckLoading] = useState(false)
  const [checkError,   setCheckError]   = useState('')
  const [filterTab,    setFilterTab]    = useState('all')
  const [showWorkload, setShowWorkload] = useState(false)
  const [showOtherDept, setShowOtherDept] = useState(false)
  const [modalItem,    setModalItem]     = useState(null)
  const [courseSearch, setCourseSearch] = useState('')        // NEW: course table search

  const [saveName,     setSaveName]     = useState('')
  const [saved,        setSaved]        = useState(false)
  const [saveError,    setSaveError]    = useState('')        // NEW: save error message
  const [savedList,    setSavedList]    = useState([])
  const [loadingList,  setLoadingList]  = useState(true)
  const [loadingItem,  setLoadingItem]  = useState(null)      // NEW: per-item loading state
  const [deleteTarget, setDeleteTarget] = useState(null)      // NEW: custom confirm modal
  const [solveError,   setSolveError]   = useState('')        // NEW: solver error detail
  const pollRef = useRef(null)

  useEffect(() => {
    listSaved()
      .then(data => setSavedList(Array.isArray(data) ? data : (data?.schedules ?? [])))
      .finally(() => setLoadingList(false))
  }, [])

  useEffect(() => {
    if (status !== 'running' || !processId) return
    pollRef.current = setInterval(async () => {
      try {
        const s = await getSolveStatus(processId)
        setProgress(s.progress)
        if (s.status === 'complete') {
          clearInterval(pollRef.current)
          setStatus('complete')
          const res = await getResult()
          setEvents(res.schedule)
          toast('Schedule generated successfully!', 'success')
        } else if (s.status === 'failed') {
          clearInterval(pollRef.current)
          setStatus('failed')
          toast('Solver failed — check eligibility and room settings.', 'error', 5000)
        }
      } catch {
        clearInterval(pollRef.current)
        setStatus('failed')
        toast('Lost connection to solver. Please try again.', 'error', 5000)
      }
    }, 1200)
    return () => clearInterval(pollRef.current)
  }, [status, processId])

  /* ── handlers ── */

  async function handleCheck() {
    setCheckLoading(true)
    setCheckError('')
    try {
      const [facultyList, courseList] = await Promise.all([getFaculty(), getCourses()])
      setReadiness(buildReadinessReport(courseList, facultyList))
      setWorkload(buildWorkloadReport(facultyList))
      setFilterTab('all')
      setCourseSearch('')
    } catch {
      setCheckError('Failed to load data. Check your connection and try again.')
    } finally {
      setCheckLoading(false)
    }
  }

  // FIXED: proper try/catch; resets save state when solving again
  async function handleSolve() {
    setSolveError('')
    setSaved(false)    // reset save badge when re-running
    setSaveName('')
    reset()
    setStatus('running')
    try {
      const res = await triggerSolve()
      setProcessId(res.process_id)
    } catch (err) {
      setStatus('failed')
      const msg = err?.response?.data?.detail || 'Could not start the solver. Try again.'
      setSolveError(msg)
      toast(msg, 'error', 5000)
    }
  }

  // FIXED: error handling + error display
  async function handleSave() {
    if (!saveName.trim()) return
    setSaveError('')
    try {
      await saveSchedule(saveName.trim())
      setName(saveName.trim())
      setSaved(true)
      toast(`Saved as "${saveName.trim()}"`, 'success')
      const data = await listSaved()
      setSavedList(Array.isArray(data) ? data : (data?.schedules ?? []))
      setTimeout(() => setSaved(false), 2500)
    } catch (err) {
      const msg = err?.response?.data?.detail || 'Failed to save schedule. Try again.'
      setSaveError(msg)
      toast(msg, 'error')
    }
  }

  // FIXED: per-item loading state + error handling
  async function handleLoad(name) {
    setLoadingItem(name)
    try {
      const data = await loadSaved(name)
      setEvents(data.schedule)
      setName(name)
      navigate(`/dashboard/schedule/${encodeURIComponent(name)}`)
    } catch {
      toast(`Failed to load "${name}". Try again.`, 'error')
    } finally {
      setLoadingItem(null)
    }
  }

  // REPLACED: native confirm() → custom modal
  function handleDelete(name) {
    setDeleteTarget(name)
  }

  async function confirmDelete() {
    const name = deleteTarget
    setDeleteTarget(null)
    try {
      await deleteSaved(name)
      setSavedList(l => l.filter(x => x !== name))
      toast(`"${name}" deleted.`, 'info')
    } catch {
      toast(`Failed to delete "${name}". Try again.`, 'error')
    }
  }

  /* ── derived ── */

  const currentPhaseIdx = Math.floor((progress / 100) * 7)

  const summary = useMemo(() => {
    if (!readiness) return null
    const myDept = readiness.filter(r => !r.otherDept)
    return {
      ready:      myDept.filter(r => r.status === 'ready').length,
      thin:       myDept.filter(r => r.status === 'thin').length,
      low_quality:myDept.filter(r => r.status === 'low_quality').length,
      no_faculty: myDept.filter(r => r.status === 'no_faculty').length,
      total:      myDept.length,
      otherDept:  readiness.filter(r => r.otherDept).length,
    }
  }, [readiness])

  // IMPROVED: filter tab + search combined — excludes other_dept from main table
  const filteredReadiness = useMemo(() => {
    if (!readiness) return []
    const q = courseSearch.toLowerCase().trim()
    return readiness.filter(r => {
      if (r.otherDept) return false  // other_dept shown in separate collapsible section
      const matchTab = filterTab === 'issues' ? r.status !== 'ready' : filterTab === 'ready' ? r.status === 'ready' : true
      const matchSearch = !q || r.courseCode.toLowerCase().includes(q) || (r.title || '').toLowerCase().includes(q)
      return matchTab && matchSearch
    })
  }, [readiness, filterTab, courseSearch])

  const otherDeptReadiness = useMemo(() => {
    if (!readiness) return []
    const q = courseSearch.toLowerCase().trim()
    return readiness.filter(r => r.otherDept && (!q || r.courseCode.toLowerCase().includes(q) || (r.title || '').toLowerCase().includes(q)))
  }, [readiness, courseSearch])

  const issueCount      = summary ? summary.thin + summary.low_quality + summary.no_faculty : 0
  const overloadedCount = workload ? workload.filter(f => f.status === 'full').length : 0

  const step1State = readiness ? (issueCount === 0 ? 'done' : 'active') : 'pending'
  const step2State = status === 'complete' ? 'done' : (status === 'running' || status === 'failed') ? 'active' : 'pending'
  const step3State = status === 'complete' ? (saved ? 'done' : 'active') : 'pending'
  const sn = s => s === 'done' ? 'done' : s === 'active' ? 'active' : 'pending'

  /* ────────────────────────── render ────────────────────────── */

  return (
    <div className="sch-root" style={{ fontFamily:"'Poppins',sans-serif" }}>

      <div className="sch-main">

        <div className="sch-title-bar">
          <div>
            <h1 style={{ fontSize:20, fontWeight:700, color:'#1a1a2e', margin:0, letterSpacing:'-.3px' }}>Scheduler</h1>
            <p style={{ fontSize:12.5, color:'#8883B0', margin:'3px 0 0' }}>Follow the steps below to generate and save a faculty schedule.</p>
          </div>
          {status === 'complete' && (
            <button className="view-btn fadein" onClick={() => navigate('/dashboard/schedule')}>
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <line x1="8" y1="6" x2="21" y2="6"/><line x1="8" y1="12" x2="21" y2="12"/><line x1="8" y1="18" x2="21" y2="18"/>
                <circle cx="3" cy="6" r="1"/><circle cx="3" cy="12" r="1"/><circle cx="3" cy="18" r="1"/>
              </svg>
              View schedule
            </button>
          )}
        </div>

        {/* ─── STEP 1 ─── */}
        <div className={`step-card${step1State === 'active' ? ' active-card' : ''}`}>
          <div className="step-header">
            <StepNum n="1" state={sn(step1State)} />
            <div style={{ flex:1 }}>
              <div style={{ fontSize:13.5, fontWeight:700, color:'#1a1a2e' }}>Faculty Readiness Check</div>
              <div style={{ fontSize:11.5, color:'#8883B0', marginTop:1 }}>
                Analyses specialization <strong>ratings</strong>, pool sizes, and faculty workload to surface scheduling risks before you solve.
              </div>
            </div>
            <button className="check-btn" onClick={handleCheck} disabled={checkLoading}>
              {checkLoading
                ? <><svg className="spin" width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M21 12a9 9 0 1 1-6.219-8.56"/></svg>Checking…</>
                : readiness
                  ? <><svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><polyline points="1 4 1 10 7 10"/><path d="M3.51 15a9 9 0 1 0 .49-4.2"/></svg>Recheck</>
                  : <><svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M22 11.08V12a10 10 0 1 1-5.93-9.14"/><polyline points="22 4 12 14.01 9 11.01"/></svg>Run check</>
              }
            </button>
          </div>

          <div className="step-body">
            {checkError && (
              <div style={{ display:'flex', alignItems:'center', gap:8, padding:'9px 13px', borderRadius:9, background:'#FFF0F0', border:'1px solid #FECACA', fontSize:12.5, color:'#C0392B', marginBottom:14 }}>
                <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><circle cx="12" cy="12" r="10"/><line x1="12" y1="8" x2="12" y2="12"/></svg>
                {checkError}
                <button onClick={handleCheck} style={{ marginLeft:'auto', background:'none', border:'none', cursor:'pointer', color:'#C0392B', fontSize:12, fontWeight:600, fontFamily:"'Poppins',sans-serif", padding:0 }}>Retry →</button>
              </div>
            )}

            {!readiness && !checkLoading && (
              <div style={{ display:'flex', alignItems:'center', gap:10, color:'#B0ABCC', fontSize:12.5, padding:'4px 0' }}>
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="#D8D3F5" strokeWidth="1.8">
                  <circle cx="12" cy="12" r="10"/><path d="M12 8v4"/><circle cx="12" cy="16" r=".5" fill="#D8D3F5"/>
                </svg>
                Run a check to analyse faculty specialization ratings, pool sizes, and current workload before generating.
              </div>
            )}

            {readiness && summary && (
              <div className="fadein">

                {/* Summary tiles — my-dept only */}
                <div style={{ display:'flex', gap:10, marginBottom:18 }}>
                  {[
                    { key:'ready',       label:'Ready',       icon:'✓' },
                    { key:'thin',        label:'Thin pool',   icon:'~' },
                    { key:'low_quality', label:'Low quality', icon:'↓' },
                    { key:'no_faculty',  label:'No faculty',  icon:'!' },
                  ].map(({ key, label, icon }) => {
                    const meta = STATUS_META[key], count = summary[key]
                    const active = count > 0
                    return (
                      <div key={key}
                        className={`r-stat${active ? ' clickable' : ''}`}
                        onClick={() => active && setFilterTab(key === 'ready' ? 'ready' : 'issues')}
                        style={{ background:meta.bg, borderColor: active ? meta.border : '#F0EDF9', opacity: active ? 1 : 0.38, gap:4 }}>
                        <span style={{ fontSize:24, fontWeight:800, color:meta.color, lineHeight:1 }}>{count}</span>
                        <span style={{ fontSize:10, fontWeight:600, color:meta.color, textAlign:'center', lineHeight:1.3 }}>{label}</span>
                      </div>
                    )
                  })}
                </div>

                {/* Workload accordion */}
                {workload && workload.length > 0 && (
                  <div style={{ marginBottom:14, borderRadius:10, border:'1px solid #F0EDF9', overflow:'hidden' }}>
                    <button onClick={() => setShowWorkload(w => !w)}
                      style={{ width:'100%', display:'flex', alignItems:'center', gap:8, padding:'11px 14px', background:showWorkload ? '#F5F4FB' : '#fff', border:'none', cursor:'pointer', fontFamily:"'Poppins',sans-serif", textAlign:'left' }}>
                      <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="#A99BE8" strokeWidth="2">
                        <line x1="18" y1="20" x2="18" y2="10"/><line x1="12" y1="20" x2="12" y2="4"/><line x1="6" y1="20" x2="6" y2="14"/>
                      </svg>
                      <span style={{ fontSize:12, fontWeight:600, color:'#3D3580', flex:1 }}>Faculty workload</span>
                      {overloadedCount > 0 && <span style={{ fontSize:10, fontWeight:700, padding:'2px 8px', borderRadius:99, background:'#FFE8E8', color:'#C0392B' }}>{overloadedCount} at cap</span>}
                      <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="#B0ABCC" strokeWidth="2"
                        style={{ transition:'transform .2s', transform: showWorkload ? 'rotate(180deg)' : 'none', flexShrink:0 }}>
                        <polyline points="6 9 12 15 18 9"/>
                      </svg>
                    </button>
                    {showWorkload && (
                      <div className="fadein" style={{ borderTop:'1px solid #F0EDF9', padding:'4px 14px 10px', maxHeight:200, overflowY:'auto' }}>
                        {workload.map((f, i) => <WorkloadRow key={i} f={f} />)}
                      </div>
                    )}
                  </div>
                )}

                {/* Filter tabs + search */}
                <div style={{ display:'flex', gap:6, marginBottom:10, alignItems:'center', flexWrap:'wrap' }}>
                  <div style={{ display:'flex', gap:5 }}>
                    {[
                      { key:'all',    label:`All (${summary.total})` },
                      ...(issueCount > 0 ? [{ key:'issues', label:`Issues (${issueCount})` }] : []),
                      { key:'ready',  label:`Ready (${summary.ready})` },
                    ].map(t => (
                      <button key={t.key} className={`r-tab${filterTab === t.key ? ' active' : ''}`} onClick={() => setFilterTab(t.key)}>{t.label}</button>
                    ))}
                  </div>
                  <span style={{ flex:1 }} />
                  <div style={{ position:'relative', width:178 }}>
                    <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="#B0ABCC" strokeWidth="2"
                      style={{ position:'absolute', left:9, top:'50%', transform:'translateY(-50%)', pointerEvents:'none' }}>
                      <circle cx="11" cy="11" r="8"/><line x1="21" y1="21" x2="16.65" y2="16.65"/>
                    </svg>
                    <input className="sch-search" type="text" placeholder="Search courses…" value={courseSearch} onChange={e => setCourseSearch(e.target.value)} />
                  </div>
                </div>

                {/* Course table */}
                <div style={{ borderRadius:12, border:'1px solid #F0EDF9', overflow:'hidden', maxHeight:320, overflowY:'auto' }}>
                  {/* Column headers */}
                  <div style={{ display:'grid', gridTemplateColumns:'16px 1fr 130px 90px 16px', gap:12, padding:'7px 16px', background:'#FAFAFE', borderBottom:'1px solid #F0EDF9', position:'sticky', top:0, zIndex:1, alignItems:'center' }}>
                    <span />
                    <span style={{ fontSize:10, fontWeight:700, color:'#B0ABCC', textTransform:'uppercase', letterSpacing:'.6px' }}>Course</span>
                    <span style={{ fontSize:10, fontWeight:700, color:'#B0ABCC', textTransform:'uppercase', letterSpacing:'.6px', textAlign:'right' }}>Pool</span>
                    <span style={{ fontSize:10, fontWeight:700, color:'#B0ABCC', textTransform:'uppercase', letterSpacing:'.6px' }}>Status</span>
                    <span />
                  </div>
                  {filteredReadiness.length === 0
                    ? <div style={{ padding:'24px', textAlign:'center', color:'#C0BBDC', fontSize:12.5 }}>
                        {courseSearch ? `No courses match "${courseSearch}".` : 'No courses match this filter.'}
                      </div>
                    : filteredReadiness.map(item => <CourseRow key={item.courseCode} item={item} onOpenModal={setModalItem} />)
                  }
                </div>

                {/* Externally managed courses — collapsible */}
                {summary.otherDept > 0 && (
                  <div style={{ marginTop:10, borderRadius:12, border:'1px solid #F0EDF9', overflow:'hidden' }}>
                    <button onClick={() => setShowOtherDept(v => !v)}
                      style={{ width:'100%', padding:'11px 16px', background:'#FAFAFE', border:'none', cursor:'pointer', display:'flex', alignItems:'center', gap:9, fontFamily:"'Poppins',sans-serif" }}>
                      <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="#A99BE8" strokeWidth="2">
                        <rect x="3" y="3" width="7" height="7" rx="1"/><rect x="14" y="3" width="7" height="7" rx="1"/>
                        <rect x="3" y="14" width="7" height="7" rx="1"/><rect x="14" y="14" width="7" height="7" rx="1"/>
                      </svg>
                      <span style={{ fontSize:12, fontWeight:600, color:'#8883B0', flex:1 }}>Externally managed</span>
                      <span style={{ fontSize:11, padding:'2px 9px', borderRadius:99, background:'#EEEAFB', color:'#7C6FCD', fontWeight:600 }}>{summary.otherDept}</span>
                      <span style={{ fontSize:11, color:'#C0BBDC' }}>PE · NSTP · MAT · GEC</span>
                      <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="#C0BBDC" strokeWidth="2"
                        style={{ flexShrink:0, transform: showOtherDept ? 'rotate(180deg)' : 'none', transition:'transform 0.18s' }}>
                        <polyline points="6 9 12 15 18 9"/>
                      </svg>
                    </button>
                    {showOtherDept && (
                      <div className="fadein" style={{ borderTop:'1px solid #F0EDF9', maxHeight:220, overflowY:'auto' }}>
                        {otherDeptReadiness.map(item => <CourseRow key={item.courseCode} item={item} onOpenModal={setModalItem} />)}
                      </div>
                    )}
                  </div>
                )}

              </div>
            )}
          </div>
        </div>

        {/* ─── STEP 2 ─── */}
        <div className={`step-card${step2State === 'active' ? ' active-card' : ''}`}>
          <div className="step-header">
            <StepNum n="2" state={sn(step2State)} />
            <div style={{ flex:1 }}>
              <div style={{ fontSize:13.5, fontWeight:700, color:'#1a1a2e' }}>Generate Schedule</div>
              <div style={{ fontSize:11.5, color:'#8883B0', marginTop:1 }}>
                {status === 'idle'     && 'Runs the constraint solver across all 7 phases.'}
                {status === 'running'  && `Solving phase ${Math.min(currentPhaseIdx + 1, 7)} of 7 — ${PHASES[Math.min(currentPhaseIdx, 6)]?.label}…`}
                {status === 'complete' && 'Schedule generated successfully — proceed to save below.'}
                {status === 'failed'   && 'Solver failed. Check rooms, time windows, and faculty eligibility.'}
              </div>
            </div>
            <SolveIconBubble running={status === 'running'} />
          </div>

          <div className="step-body">
            <PhaseTimeline currentPhaseIdx={currentPhaseIdx} status={status} progress={progress} />

            {status === 'running' && (
              <div className="status-strip running fadein">
                <svg className="spin" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M21 12a9 9 0 1 1-6.219-8.56"/></svg>
                Solver is running — this may take a moment. Do not close this tab.
              </div>
            )}
            {status === 'complete' && (
              <div className="status-strip complete fadein">
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"><polyline points="20 6 9 17 4 12"/></svg>
                All 7 phases completed. A valid schedule has been generated.
              </div>
            )}
            {status === 'failed' && (
              <div className="status-strip failed fadein">
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><circle cx="12" cy="12" r="10"/><line x1="12" y1="8" x2="12" y2="12"/></svg>
                {solveError || 'Could not find a feasible schedule. Ensure rooms, time windows, and faculty assignments are configured.'}
              </div>
            )}

            <div style={{ display:'flex', gap:10, marginTop:16, alignItems:'center' }}>
              <button className={`solve-btn ${status === 'running' ? 'running' : status === 'complete' ? 'again' : 'idle'}`}
                onClick={handleSolve} disabled={status === 'running'}>
                {status === 'running'
                  ? <><svg className="spin" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2"><path d="M21 12a9 9 0 1 1-6.219-8.56"/></svg>Solving…</>
                  : status === 'complete'
                    ? <><svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><polyline points="1 4 1 10 7 10"/><path d="M3.51 15a9 9 0 1 0 .49-4.2"/></svg>Solve again</>
                    : <><svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2"><polygon points="5 3 19 12 5 21 5 3"/></svg>Solve now</>
                }
              </button>
              {status === 'complete' && (
                <button className="view-btn fadein" onClick={() => navigate('/dashboard/schedule')}>View schedule →</button>
              )}
            </div>
          </div>
        </div>

        {/* ─── STEP 3 ─── */}
        <div className={`step-card${step3State === 'active' ? ' active-card' : ''}`}>
          <div className="step-header">
            <StepNum n="3" state={sn(step3State)} />
            <div style={{ flex:1 }}>
              <div style={{ fontSize:13.5, fontWeight:700, color:'#1a1a2e' }}>Save Schedule</div>
              <div style={{ fontSize:11.5, color:'#8883B0', marginTop:1 }}>
                {status === 'complete' ? 'Name and save this schedule to your library for future reference.' : 'Generate a schedule first before saving.'}
              </div>
            </div>
            {step3State === 'done' && (
              <div style={{ width:28, height:28, borderRadius:'50%', background:'linear-gradient(135deg,#6EE7B7,#059669)', display:'flex', alignItems:'center', justifyContent:'center', boxShadow:'0 2px 8px rgba(5,150,105,0.3)' }}>
                <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="#fff" strokeWidth="3"><polyline points="20 6 9 17 4 12"/></svg>
              </div>
            )}
          </div>

          <div className="step-body">
            {status !== 'complete' ? (
              <div style={{ display:'flex', alignItems:'center', gap:10, color:'#C0BBDC', fontSize:12.5, padding:'2px 0' }}>
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="#D8D3F5" strokeWidth="1.8">
                  <path d="M19 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h11l5 5v11a2 2 0 0 1-2 2z"/><polyline points="17 21 17 13 7 13 7 21"/>
                </svg>
                Waiting for a successful schedule generation…
              </div>
            ) : (
              <div className="fadein">
                <p style={{ fontSize:12, color:'#8883B0', marginBottom:12 }}>Give this schedule a memorable name. It'll appear in your saved library on the right.</p>
                {saveError && (
                  <div style={{ display:'flex', alignItems:'center', gap:8, padding:'8px 12px', borderRadius:8, background:'#FFF0F0', border:'1px solid #FECACA', fontSize:12, color:'#C0392B', marginBottom:10 }}>
                    <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><circle cx="12" cy="12" r="10"/><line x1="12" y1="8" x2="12" y2="12"/></svg>
                    {saveError}
                    <button onClick={() => setSaveError('')} style={{ marginLeft:'auto', background:'none', border:'none', cursor:'pointer', color:'#C0392B', fontSize:14, lineHeight:1 }}>×</button>
                  </div>
                )}
                <div className="save-row">
                  <div style={{ position:'relative', flex:1, minWidth:180 }}>
                    <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="#B0ABCC" strokeWidth="2"
                      style={{ position:'absolute', left:12, top:'50%', transform:'translateY(-50%)', pointerEvents:'none' }}>
                      <path d="M19 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h11l5 5v11a2 2 0 0 1-2 2z"/><polyline points="17 21 17 13 7 13 7 21"/>
                    </svg>
                    <input className="save-name-input" value={saveName}
                      onChange={e => { setSaveName(e.target.value); setSaveError('') }}
                      onKeyDown={e => e.key === 'Enter' && handleSave()}
                      placeholder="e.g. 2024-S2-Final" style={{ paddingLeft:34 }} disabled={saved} />
                  </div>
                  <button className={`prim-btn${saved ? ' success-btn' : ''}`} onClick={handleSave} disabled={!saveName.trim() || saved}>
                    {saved
                      ? <><svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="#fff" strokeWidth="2.5"><polyline points="20 6 9 17 4 12"/></svg>Saved!</>
                      : <><svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="#fff" strokeWidth="2"><path d="M19 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h11l5 5v11a2 2 0 0 1-2 2z"/><polyline points="17 21 17 13 7 13 7 21"/></svg>Save schedule</>
                    }
                  </button>
                </div>
              </div>
            )}
          </div>
        </div>

      </div>

      {/* ══════════ Aside ══════════ */}
      <aside className="sch-aside">
        <div className="aside-panel">
          <div className="aside-header">
            <div>
              <div style={{ fontSize:13, fontWeight:700, color:'#1a1a2e' }}>Saved Schedules</div>
              <div style={{ fontSize:11, color:'#8883B0', marginTop:1 }}>Load or delete past schedules</div>
            </div>
            {savedList.length > 0 && <Badge type="neutral">{savedList.length}</Badge>}
          </div>

          <div style={{ maxHeight:'calc(100vh - 200px)', overflowY:'auto' }}>
            {loadingList && (
              <div style={{ display:'flex', alignItems:'center', gap:8, padding:18, color:'#B0ABCC', fontSize:12.5 }}>
                <svg className="spin" width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M21 12a9 9 0 1 1-6.219-8.56"/></svg>
                Loading…
              </div>
            )}
            {!loadingList && savedList.length === 0 && (
              <div style={{ display:'flex', flexDirection:'column', alignItems:'center', gap:10, padding:'32px 20px', color:'#C0BBDC' }}>
                <div style={{ width:44, height:44, borderRadius:13, background:'#F5F4FB', display:'flex', alignItems:'center', justifyContent:'center' }}>
                  <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="#D8D3F5" strokeWidth="1.5">
                    <rect x="3" y="4" width="18" height="18" rx="2"/>
                    <line x1="16" y1="2" x2="16" y2="6"/><line x1="8" y1="2" x2="8" y2="6"/><line x1="3" y1="10" x2="21" y2="10"/>
                  </svg>
                </div>
                <div style={{ textAlign:'center' }}>
                  <p style={{ fontSize:12.5, fontWeight:600, color:'#B0ABCC', margin:0 }}>No saved schedules</p>
                  <p style={{ fontSize:11.5, color:'#D0CCE8', marginTop:4 }}>Generate and save one using the steps on the left.</p>
                </div>
              </div>
            )}
            {!loadingList && savedList.map(name => (
              <SavedItem key={name} name={name} onLoad={handleLoad} onDelete={handleDelete} loading={loadingItem === name} />
            ))}
          </div>

          {!loadingList && savedList.length > 0 && (
            <div style={{ padding:'10px 18px', borderTop:'1px solid #F0EDF9', display:'flex', alignItems:'center', gap:7, fontSize:11, color:'#B0ABCC' }}>
              <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <circle cx="12" cy="12" r="10"/><path d="M12 8v4"/><circle cx="12" cy="16" r=".5" fill="currentColor"/>
              </svg>
              Loading a schedule navigates to Schedule View.
            </div>
          )}
        </div>
      </aside>

      {/* Faculty pool modal */}
      {modalItem && <FacultyPoolModal item={modalItem} onClose={() => setModalItem(null)} />}

      {/* Custom delete confirmation modal */}
      {deleteTarget && (
        <DeleteModal name={deleteTarget} onConfirm={confirmDelete} onCancel={() => setDeleteTarget(null)} />
      )}

      {/* Toast notifications */}
      <ToastContainer toasts={toasts} />

    </div>
  )
}