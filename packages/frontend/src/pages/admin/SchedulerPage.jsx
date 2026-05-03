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

// Calculate the current academic year dynamically
const now = new Date();
// If it's before June (month index 5), it usually still counts as the previous academic year ending
const startYear = now.getMonth() < 5 ? now.getFullYear() - 1 : now.getFullYear();

const PRESET_NAMES = [
  `A.Y. ${startYear}-${startYear + 1}, 1st Semester`,
  `A.Y. ${startYear}-${startYear + 1}, 2nd Semester`,
  `A.Y. ${startYear}-${startYear + 1}, Midyear`,
  `A.Y. ${startYear + 1}-${startYear + 2}, 1st Semester`,
  `A.Y. ${startYear + 1}-${startYear + 2}, 2nd Semester`,
  `A.Y. ${startYear + 1}-${startYear + 2}, Midyear`,
  'Custom...'
]

/* ─────────────────────────── styles ─────────────────────────── */

if (!document.getElementById('scheduler-page-style')) {
  const s = document.createElement('style')
  s.id = 'scheduler-page-style'
  s.textContent = `
    .sch-root  { display:flex; flex-direction:column; gap:20px; padding:28px 32px; }
    
    /* Sleek Toolbar */
    .solver-toolbar { background:#fff; border-radius:16px; border:1px solid #E8E4F8; box-shadow:0 4px 20px rgba(124,111,205,0.06); padding:14px 22px; display:flex; align-items:center; gap:16px; flex-wrap:wrap; }
    .solver-status-panel { background:#fff; border-radius:16px; border:1px solid #E8E4F8; box-shadow:0 4px 20px rgba(124,111,205,0.06); padding:24px 28px; }
    
    .sch-select { padding:9px 36px 9px 14px; border-radius:10px; border:1.5px solid #D8D3F5; background:#fff; color:#1a1a2e; font-size:13px; font-weight:600; font-family:'Poppins',sans-serif; appearance:none; cursor:pointer; outline:none; transition:all .15s; background-image:url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='12' height='12' viewBox='0 0 24 24' fill='none' stroke='%237C6FCD' stroke-width='2.5'%3E%3Cpolyline points='6 9 12 15 18 9'/%3E%3C/svg%3E"); background-repeat:no-repeat; background-position:right 12px center; min-width:260px; box-shadow:0 2px 6px rgba(124,111,205,0.04); }
    .sch-select:focus, .sch-input:focus { border-color:#7C6FCD; box-shadow:0 0 0 3px rgba(124,111,205,0.15); }
    
    .sch-input { padding:9px 14px; border-radius:10px; border:1.5px solid #D8D3F5; background:#fff; color:#1a1a2e; font-size:13px; font-weight:600; font-family:'Poppins',sans-serif; outline:none; transition:all .15s; min-width:240px; box-shadow:0 2px 6px rgba(124,111,205,0.04); }
    .sch-input::placeholder { color:#C0BBDC; font-weight:500; }

    /* Bottom Split */
    .bottom-split { display:flex; gap:20px; align-items:flex-start; }
    .readiness-panel { flex:1; min-width:0; background:#fff; border-radius:16px; border:1px solid #E8E4F8; box-shadow:0 2px 10px rgba(124,111,205,0.05); overflow:hidden; }
    .saved-panel { width:340px; flex-shrink:0; background:#fff; border-radius:16px; border:1px solid #E8E4F8; box-shadow:0 2px 10px rgba(124,111,205,0.05); overflow:hidden; position:sticky; top:28px; }

    .panel-header { display:flex; align-items:center; gap:12px; padding:18px 22px; border-bottom:1px solid #F0EDF9; background:#FAFAFE; }
    .panel-title { font-size:15px; font-weight:700; color:#1a1a2e; display:flex; align-items:center; gap:8px; }
    .panel-body { padding:20px 22px; }

    .r-tab { display:inline-flex; align-items:center; gap:5px; padding:6px 14px; border-radius:9px; font-family:'Poppins',sans-serif; font-size:12px; font-weight:600; cursor:pointer; transition:all .14s; border:1.5px solid #E8E4F8; background:#fff; color:#8883B0; }
    .r-tab.active { background:linear-gradient(135deg,#7C6FCD,#5a4fbf); color:#fff; border-color:transparent; box-shadow:0 3px 10px rgba(124,111,205,0.28); }
    .r-tab:hover:not(.active) { background:#FAFAFE; border-color:#D8D3F5; color:#3D3580; }

    .r-stat { flex:1; display:flex; flex-direction:column; align-items:center; padding:14px 8px; border-radius:12px; border:1px solid; transition:transform .15s, box-shadow .15s; }
    .r-stat.clickable { cursor:pointer; }
    .r-stat.clickable:hover { transform:translateY(-2px); box-shadow:0 6px 16px rgba(0,0,0,.06); }

    .course-row { border-bottom:1px solid #F5F4FB; transition:background .12s; cursor:pointer; }
    .course-row:hover { background:#FAFAFE; }
    .course-row:last-child { border-bottom:none; }
    .course-row-main { display:flex; align-items:center; gap:12px; padding:12px 16px; }

    .star-fill  { fill:#7C6FCD; stroke:#7C6FCD; }
    .star-empty { fill:none;    stroke:#D8D3F5; }

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

    .wl-bar-wrap { flex:1; height:5px; background:#F0EDF9; border-radius:99px; overflow:hidden; }
    .wl-bar-fill { height:100%; border-radius:99px; transition:width .5s; }

    .phase-track  { display:flex; align-items:flex-start; gap:0; margin-top:18px; }
    .phase-step   { flex:1; display:flex; flex-direction:column; align-items:center; position:relative; }
    .phase-connector { position:absolute; top:11px; left:50%; width:100%; height:3px; transition:background .4s; z-index:0; }
    .phase-dot    { width:24px; height:24px; border-radius:50%; z-index:1; display:flex; align-items:center; justify-content:center; transition:all .35s ease; }
    .phase-label  { font-size:10px; margin-top:6px; font-weight:700; text-align:center; letter-spacing:0.5px; transition:color .3s; text-transform:uppercase; }

    .prog-bar-wrap { height:6px; background:#F0EDF9; border-radius:99px; overflow:hidden; margin-top:14px; box-shadow:inset 0 1px 2px rgba(0,0,0,0.05); }
    .prog-bar-fill { height:100%; border-radius:99px; transition:width .6s cubic-bezier(.4,0,.2,1); }

    .action-btn { display:inline-flex; align-items:center; justify-content:center; gap:8px; padding:12px 28px; border-radius:10px; font-family:'Poppins',sans-serif; font-size:13px; font-weight:600; cursor:pointer; transition:all .2s; border:none; }
    .action-btn.solve { background:linear-gradient(135deg,#7C6FCD,#5a4fbf); color:#fff; box-shadow:0 4px 16px rgba(124,111,205,0.3); }
    .action-btn.solve:hover:not(:disabled) { transform:translateY(-1px); box-shadow:0 6px 20px rgba(124,111,205,0.4); }
    .action-btn.solve:disabled { opacity:0.5; cursor:not-allowed; transform:none; box-shadow:none; }
    
    .action-btn.save { background:linear-gradient(135deg,#10b981,#059669); color:#fff; box-shadow:0 4px 16px rgba(16,185,129,0.3); }
    .action-btn.save:hover:not(:disabled) { transform:translateY(-1px); box-shadow:0 6px 20px rgba(16,185,129,0.4); }
    .action-btn.save:disabled { opacity:0.5; cursor:not-allowed; }
    
    .action-btn.view { background:#fff; color:#3D3580; border:1.5px solid #D8D3F5; box-shadow:0 2px 8px rgba(124,111,205,0.06); }
    .action-btn.view:hover { background:#FAFAFE; border-color:#C5BBEF; color:#7C6FCD; }

    .status-strip { display:flex; align-items:center; gap:12px; padding:12px 18px; border-radius:12px; font-size:13px; font-weight:600; }
    .status-strip.running  { background:#F0EDFB; color:#5a4fbf; border:1px solid #D8D3F5; }
    .status-strip.complete { background:#E6FAF3; color:#065f46; border:1px solid #A7F3D0; }
    .status-strip.failed   { background:#FFF0F0; color:#991B1B; border:1px solid #FECACA; }

    .saved-item { display:flex; align-items:center; gap:12px; padding:14px 22px; cursor:default; transition:background .14s; border-bottom:1px solid #F5F4FB; }
    .saved-item:hover { background:#FAFAFE; }
    .saved-item:last-child { border-bottom:none; }
    .saved-icon { width:36px; height:36px; border-radius:10px; background:#EEEAFB; color:#7C6FCD; display:flex; align-items:center; justify-content:center; flex-shrink:0; }
    .saved-actions { display:flex; gap:6px; margin-left:auto; flex-shrink:0; }
    .saved-actions button { padding:6px 12px; border-radius:8px; font-size:12px; font-weight:600; cursor:pointer; font-family:'Poppins',sans-serif; transition:all .15s; }
    .saved-load-btn { background:#fff; color:#7C6FCD; border:1px solid #D8D3F5; }
    .saved-load-btn:hover:not(:disabled) { background:#EEEAFB; border-color:#C5BBEF; }
    .saved-load-btn:disabled { opacity:.5; cursor:not-allowed; }
    .saved-del-btn  { background:#fff; color:#C0392B; border:1px solid #FECACA; }
    .saved-del-btn:hover  { background:#FFF0F0; border-color:#FCA5A5; }

    .check-btn { display:inline-flex; align-items:center; gap:7px; padding:8px 16px; border-radius:10px; border:none; background:#EEEAFB; color:#7C6FCD; font-family:'Poppins',sans-serif; font-size:12.5px; font-weight:600; cursor:pointer; transition:all .15s; }
    .check-btn:hover:not(:disabled) { background:#DED6F5; color:#5a4fbf; }
    .check-btn:disabled { opacity:.6; cursor:not-allowed; }

    @keyframes sch-spin    { to { transform:rotate(360deg) } }
    @keyframes sch-fadein  { from{opacity:0;transform:translateY(6px)} to{opacity:1;transform:translateY(0)} }
    
    .spin   { animation:sch-spin 1s linear infinite; }
    .fadein { animation:sch-fadein .25s cubic-bezier(0.2, 0.8, 0.2, 1) both; }

    /* Toast Notifications - Lavender & White Theme */
    @keyframes sch-toast-in { from{opacity:0;transform:scale(.96) translateY(12px)} to{opacity:1;transform:scale(1) translateY(0)} }
    .sch-toast-wrap { position:fixed; bottom:24px; left:50%; z-index:9999; display:flex; flex-direction:column; gap:10px; align-items:center; pointer-events:none; transform:translateX(-50%); }
    .sch-toast { display:flex; align-items:center; gap:10px; padding:12px 20px; border-radius:12px; font-family:'Poppins',sans-serif; font-size:13px; font-weight:600; animation:sch-toast-in .22s cubic-bezier(.4,0,.2,1); white-space:nowrap; pointer-events:auto; }
    .sch-toast.success { background:linear-gradient(135deg,#7C6FCD,#5a4fbf); color:#fff; box-shadow:0 8px 24px rgba(124,111,205,0.3); border:1px solid #A99BE8; }
    .sch-toast.error   { background:#fff; color:#DC2626; border:1.5px solid #FECACA; box-shadow:0 8px 24px rgba(220,38,38,0.15); }
    .sch-toast.info { background:linear-gradient(135deg,#7C6FCD,#5a4fbf); color:#fff; box-shadow:0 8px 24px rgba(124,111,205,0.3); border:1px solid #A99BE8; }
    /* Search */
    .sch-search { padding:8px 12px 8px 34px; border-radius:10px; border:1px solid #E8E4F8; font-family:'Poppins',sans-serif; font-size:12.5px; background:#FAFAFE; color:#1a1a2e; outline:none; transition:all .15s; width:100%; box-sizing:border-box; }
    .sch-search:focus { border-color:#A99BE8; box-shadow:0 0 0 3px rgba(169,155,232,0.12); background:#fff; }

    /* Delete modal */
    .del-modal-backdrop { position:fixed; inset:0; background:rgba(26,26,46,0.4); display:flex; align-items:center; justify-content:center; z-index:500; backdrop-filter:blur(3px); }
    .del-modal-box { background:#fff; border-radius:18px; width:360px; padding:28px; box-shadow:0 24px 64px rgba(26,26,46,0.25); border:1px solid #E8E4F8; animation:sch-fadein .2s cubic-bezier(.4,0,.2,1); }

    /* Skeleton Loading Keyframes & Styles */
    @keyframes schShimmer {
      0%   { background-position: -400px 0 }
      100% { background-position:  400px 0 }
    }
    .sch-skeleton {
      background: linear-gradient(90deg, #F0EDF9 25%, #E4DEFC 50%, #F0EDF9 75%);
      background-size: 800px 100%;
      animation: schShimmer 1.4s ease-in-out infinite;
      border-radius: 7px;
    }
  `
  document.head.appendChild(s)
}

/* ─────────────────────────── pure helpers ─────────────────────────── */

function Skel({ w = '100%', h = 14, r = 7, style = {} }) {
  return (
    <div className="sch-skeleton" style={{ width: w, height: h, borderRadius: r, flexShrink: 0, ...style }} />
  )
}

function buildReadinessReport(courses, facultyList) {
  const poolMap = {}
  for (const f of facultyList) {
    for (const spec of (f.specializations || [])) {
      const code = (spec.courseCode || '').trim().toUpperCase()
      if (!code) continue
      if (!poolMap[code]) poolMap[code] = []
      poolMap[code].push({ name: f.name || 'Unknown', rating: spec.rating || 1, units: f.units || 0, max_units: f.max_units || 21 })
    }
  }

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
    success: <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"><polyline points="20 6 9 17 4 12"/></svg>,
    error:   <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"><circle cx="12" cy="12" r="10"/><line x1="12" y1="8" x2="12" y2="12"/></svg>,
    info:    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"><circle cx="12" cy="12" r="10"/><path d="M12 8v4"/></svg>,
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
        <div style={{ display: 'flex', alignItems: 'center', gap: 14, marginBottom: 18 }}>
          <div style={{ width: 42, height: 42, borderRadius: 12, background: '#FFF0F0', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="#C0392B" strokeWidth="2">
              <polyline points="3 6 5 6 21 6"/><path d="M19 6l-1 14H6L5 6"/><path d="M10 11v6"/><path d="M14 11v6"/>
            </svg>
          </div>
          <div>
            <p style={{ fontSize: 15, fontWeight: 700, color: '#1a1a2e', margin: 0 }}>Delete schedule?</p>
            <p style={{ fontSize: 12.5, color: '#8883B0', marginTop: 2 }}>This action cannot be undone.</p>
          </div>
        </div>
        <div style={{ background: '#FAFAFE', borderRadius: 10, padding: '12px 14px', marginBottom: 20, border:'1px solid #E8E4F8' }}>
          <p style={{ fontSize: 13, color: '#1a1a2e', fontWeight: 600, margin: 0, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>"{name}"</p>
        </div>
        <div style={{ display: 'flex', gap: 10, justifyContent: 'flex-end' }}>
          <button onClick={onCancel} style={{ padding: '10px 18px', borderRadius: 10, border: '1.5px solid #E8E4F8', background: '#fff', color: '#8883B0', fontSize: 13, fontWeight: 600, cursor: 'pointer', fontFamily: "'Poppins',sans-serif", transition: 'all .15s' }}>
            Cancel
          </button>
          <button onClick={onConfirm} style={{ padding: '10px 18px', borderRadius: 10, border: 'none', background: 'linear-gradient(135deg,#EF4444,#C0392B)', color: '#fff', fontSize: 13, fontWeight: 600, cursor: 'pointer', fontFamily: "'Poppins',sans-serif", boxShadow: '0 4px 12px rgba(192,57,43,0.25)' }}>
            Yes, Delete
          </button>
        </div>
      </div>
    </div>
  )
}

/* ─────────────────────────── sub-components ─────────────────────────── */

function Badge({ children, type = 'neutral' }) {
  const map = { green: ['#E6FAF3','#065f46'], red: ['#FFE8E8','#991B1B'], amber: ['#FEF3CD','#78350f'], neutral: ['#EEEAFB','#7C6FCD'], blue: ['#EBF0FF','#1e40af'] }
  const [bg, color] = map[type] || map.neutral
  return <span style={{ display:'inline-flex', alignItems:'center', justifyContent:'center', padding:'3px 10px', borderRadius:99, fontSize:11.5, fontWeight:700, background:bg, color }}>{children}</span>
}

function MiniStars({ rating, size = 10 }) {
  return (
    <span style={{ display:'inline-flex', gap:2 }}>
      {[1,2,3,4,5].map(s => (
        <svg key={s} width={size} height={size} viewBox="0 0 24 24" strokeWidth="2.5" className={s <= rating ? 'star-fill' : 'star-empty'}>
          <polygon points="12 2 15.09 8.26 22 9.27 17 14.14 18.18 21.02 12 17.77 5.82 21.02 7 14.14 2 9.27 8.91 8.26 12 2"/>
        </svg>
      ))}
    </span>
  )
}

function FacultyPoolModal({ item, onClose }) {
  if (!item) return null
  const meta = STATUS_META[item.status]
  const qualified   = item.pool.filter(f => f.rating >= 3)
  const unqualified = item.pool.filter(f => f.rating < 3)

  const mkIni = name => (name || '').split(/\s+/).filter(Boolean).map(n => n[0]).join('').slice(0, 2).toUpperCase()

  return (
    <div className="fp-modal-backdrop" onClick={onClose}>
      <div className="fp-modal" onClick={e => e.stopPropagation()}>
        <div className="fp-modal-head">
          <div style={{ display:'flex', alignItems:'flex-start', justifyContent:'space-between', gap:12 }}>
            <div style={{ flex:1, minWidth:0 }}>
              <div style={{ display:'flex', alignItems:'center', gap:9, flexWrap:'wrap', marginBottom:6 }}>
                <span style={{ fontFamily:'monospace', fontSize:14, fontWeight:700, color:'#3D3580' }}>{item.courseCode}</span>
                <span style={{ fontSize:11, fontWeight:700, padding:'2px 10px', borderRadius:99, background:meta.bg, color:meta.color, border:`1px solid ${meta.border}`, flexShrink:0 }}>{meta.label}</span>
              </div>
              <p style={{ fontSize:15, fontWeight:600, color:'#1a1a2e', marginBottom:12, lineHeight:1.35 }}>{item.title || '—'}</p>
              <div style={{ display:'flex', gap:20 }}>
                {[
                  { val: item.poolSize,       label: 'in pool',          c: '#7C6FCD' },
                  { val: item.qualifiedCount,  label: 'qualified (≥ 3)',  c: '#059669' },
                  { val: item.availableCount,  label: 'available',        c: '#2563EB' },
                ].map(s => (
                  <div key={s.label}>
                    <span style={{ fontSize:20, fontWeight:800, color:s.c, lineHeight:1 }}>{s.val}</span>
                    <span style={{ fontSize:11, color:'#B0ABCC', marginLeft:6, fontWeight:500 }}>{s.label}</span>
                  </div>
                ))}
              </div>
            </div>
            <button onClick={onClose} style={{ width:32, height:32, borderRadius:10, border:'1.5px solid #E8E4F8', background:'#fff', cursor:'pointer', display:'flex', alignItems:'center', justifyContent:'center', color:'#8883B0', fontSize:18, flexShrink:0, lineHeight:1, transition:'all .15s' }}>×</button>
          </div>
        </div>

        <div className="fp-modal-body">
          {item.pool.length === 0 ? (
            <div style={{ textAlign:'center', padding:'40px 0', color:'#B0ABCC', fontSize:13.5 }}>No faculty assigned to this course yet.</div>
          ) : (
            <>
              {qualified.length > 0 && (
                <div style={{ marginTop:20 }}>
                  <p style={{ fontSize:10.5, fontWeight:700, color:'#B0ABCC', textTransform:'uppercase', letterSpacing:'.8px', marginBottom:10 }}>Qualified faculty — eligible for assignment</p>
                  {qualified.map((f, i) => {
                    const isFull = f.units >= f.max_units
                    const pct    = Math.min(100, Math.round((f.units / f.max_units) * 100))
                    const barCol = isFull ? '#C0392B' : pct > 80 ? '#D97706' : '#059669'
                    return (
                      <div key={i} className="fp-frow" style={{ opacity: isFull ? 0.6 : 1 }}>
                        <div className="fp-avatar" style={{ background:RATING_BG[f.rating], color:RATING_COLORS[f.rating] }}>{mkIni(f.name)}</div>
                        <div style={{ flex:1, minWidth:0 }}>
                          <div style={{ display:'flex', alignItems:'center', justifyContent:'space-between', marginBottom:6 }}>
                            <span style={{ fontSize:13, fontWeight:600, color:'#1a1a2e', overflow:'hidden', textOverflow:'ellipsis', whiteSpace:'nowrap' }}>{f.name}</span>
                            <div style={{ display:'flex', alignItems:'center', gap:8, flexShrink:0, marginLeft:8 }}>
                              {isFull && <span style={{ fontSize:10, fontWeight:700, padding:'2px 8px', borderRadius:99, background:'#FFE8E8', color:'#C0392B' }}>At cap</span>}
                              <span style={{ fontSize:11, fontWeight:700, padding:'2px 10px', borderRadius:99, background:RATING_BG[f.rating], color:RATING_COLORS[f.rating] }}>{RATING_LABELS[f.rating]}</span>
                              <MiniStars rating={f.rating} size={10} />
                            </div>
                          </div>
                          <div style={{ display:'flex', alignItems:'center', gap:10 }}>
                            <div className="fp-ubar-wrap"><div className="fp-ubar-fill" style={{ width:`${pct}%`, background:barCol }} /></div>
                            <span style={{ fontSize:11, fontWeight:600, color:barCol, whiteSpace:'nowrap' }}>{f.units}/{f.max_units} units</span>
                          </div>
                        </div>
                      </div>
                    )
                  })}
                </div>
              )}

              {unqualified.length > 0 && (
                <div style={{ marginTop:24 }}>
                  <p style={{ fontSize:10.5, fontWeight:700, color:'#D0CCE8', textTransform:'uppercase', letterSpacing:'.8px', marginBottom:10 }}>Below threshold — not eligible</p>
                  {unqualified.map((f, i) => (
                    <div key={i} className="fp-frow" style={{ opacity:0.5 }}>
                      <div className="fp-avatar" style={{ background:'#F5F4FB', color:'#C0BBDC' }}>{mkIni(f.name)}</div>
                      <div style={{ flex:1, minWidth:0 }}>
                        <div style={{ display:'flex', alignItems:'center', justifyContent:'space-between' }}>
                          <span style={{ fontSize:13, fontWeight:600, color:'#8883B0', overflow:'hidden', textOverflow:'ellipsis', whiteSpace:'nowrap' }}>{f.name}</span>
                          <span style={{ fontSize:11, fontWeight:600, padding:'2px 10px', borderRadius:99, background:'#F5F4FB', color:'#C0BBDC', flexShrink:0, marginLeft:8 }}>{RATING_LABELS[f.rating]}</span>
                        </div>
                      </div>
                    </div>
                  ))}
                  <p style={{ fontSize:11.5, color:'#C0BBDC', marginTop:12, lineHeight:1.5, background:'#FAFAFE', padding:'10px 14px', borderRadius:8 }}>
                    Faculty need a rating of Competent (3) or above to be auto-scheduled. They can still be manually assigned.
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
  
  const canOpen = item.poolSize > 0 && !item.otherDept
  const total = item.poolSize || 1
  const ratingSegs = [5,4,3,2,1].filter(r => item.ratingDist?.[r])

  return (
    <div className="course-row">
      <div className="course-row-main"
        onClick={() => canOpen && onOpenModal(item)}
        style={{ cursor: canOpen ? 'pointer' : 'default' }}>

        <div style={{ width:8, height:8, borderRadius:'50%', flexShrink:0, background:meta.color, boxShadow:`0 0 0 2px ${meta.bg}` }} />

        <div style={{ flex:1, minWidth:0 }}>
          <div style={{ display:'flex', alignItems:'center', gap:8, marginBottom:4 }}>
            <span style={{ fontSize:13, fontWeight:700, color:'#3D3580', fontFamily:'monospace' }}>{item.courseCode}</span>
            {item.otherDept && <span style={{ fontSize:10, fontWeight:700, padding:'1px 8px', borderRadius:99, background:'#EEEAFB', color:'#7C6FCD' }}>Ext. dept</span>}
          </div>
          <span style={{ fontSize:12, color:'#8883B0', overflow:'hidden', textOverflow:'ellipsis', whiteSpace:'nowrap', display:'block', fontWeight:500 }}>{item.title || '—'}</span>
        </div>

        {!item.otherDept && (
          <div style={{ display:'flex', flexDirection:'column', alignItems:'flex-end', gap:6, flexShrink:0, width:90 }}>
            <div style={{ display:'flex', height:5, borderRadius:99, overflow:'hidden', gap:1, width:'100%' }}>
              {ratingSegs.length === 0
                ? <div style={{ flex:1, background:'#F0EDF9', borderRadius:99 }} />
                : ratingSegs.map(r => (
                    <div key={r} style={{ flex: item.ratingDist[r] / total, background: r >= 3 ? RATING_COLORS[r] : '#E5E7EB', borderRadius:99 }}
                      title={`${item.ratingDist[r]}× ${RATING_LABELS[r]}`} />
                  ))
              }
            </div>
            <span style={{ fontSize:11, fontWeight:600, color:'#8883B0', whiteSpace:'nowrap' }}>
              {item.qualifiedCount}/{item.poolSize} qual.
            </span>
          </div>
        )}

        <div style={{ width:100, display:'flex', justifyContent:'flex-end', flexShrink:0 }}>
          <span style={{ fontSize:11, fontWeight:700, padding:'4px 10px', borderRadius:99, whiteSpace:'nowrap', background:meta.bg, color:meta.color, border:`1px solid ${meta.border}` }}>{meta.label}</span>
        </div>

        <div style={{ width:16, display:'flex', justifyContent:'flex-end', flexShrink:0 }}>
          {canOpen && (
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="#C5BBEF" strokeWidth="2.5">
              <polyline points="9 18 15 12 9 6"/>
            </svg>
          )}
        </div>
      </div>
    </div>
  )
}

function WorkloadRow({ f }) {
  const barColor = f.status === 'full' ? '#C0392B' : f.status === 'near' ? '#D97706' : '#059669'
  return (
    <div style={{ display:'flex', alignItems:'center', gap:12, padding:'10px 0', borderBottom:'1px solid #F5F4FB' }}>
      <div style={{ width:28, height:28, borderRadius:'50%', flexShrink:0, display:'flex', alignItems:'center', justifyContent:'center', fontSize:10, fontWeight:700,
        background: f.status === 'full' ? '#FFE8E8' : f.status === 'near' ? '#FEF3CD' : '#E6FAF3', color: barColor }}>
        {f.name.split(' ').map(n => n[0]).join('').slice(0,2).toUpperCase()}
      </div>
      <span style={{ fontSize:12.5, fontWeight:600, color:'#1a1a2e', flex:1, overflow:'hidden', textOverflow:'ellipsis', whiteSpace:'nowrap', minWidth:0 }}>{f.name}</span>
      <div className="wl-bar-wrap" style={{ maxWidth:90 }}><div className="wl-bar-fill" style={{ width:`${f.pct}%`, background:barColor }} /></div>
      <span style={{ fontSize:12, fontWeight:700, color:barColor, whiteSpace:'nowrap', minWidth:42, textAlign:'right' }}>{f.units}/{f.max_units}</span>
    </div>
  )
}

function PhaseTimeline({ currentPhaseIdx, status, progress }) {
  const idle = status === 'idle', done = status === 'complete'
  return (
    <div className="fadein">
      <div style={{ display:'flex', justifyContent:'space-between', alignItems:'center', marginBottom:8 }}>
        <span style={{ fontSize:12.5, fontWeight:600, color: idle ? '#C0BBDC' : '#1a1a2e' }}>
          {idle ? '7 scheduling phases' : done ? 'All phases complete' : `Phase ${Math.min(currentPhaseIdx + 1, 7)} of 7 — ${PHASES[Math.min(currentPhaseIdx, 6)]?.label}`}
        </span>
        <span style={{ fontSize:13, fontWeight:800, color: idle ? '#C0BBDC' : done ? '#059669' : '#7C6FCD' }}>{idle ? '—' : `${progress}%`}</span>
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
              <div className="phase-dot" style={{ background: idle ? '#F5F4FB' : phaseDone ? '#7C6FCD' : phaseActive ? '#fff' : '#F0EDF9', border: idle ? '2px solid #E8E4F8' : phaseActive ? '2.5px solid #7C6FCD' : phaseDone ? 'none' : '2px solid #E8E4F8', boxShadow: phaseActive ? '0 0 0 4px rgba(124,111,205,0.15)' : 'none' }}>
                {phaseDone && !idle ? <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="#fff" strokeWidth="3"><polyline points="20 6 9 17 4 12"/></svg>
                  : phaseActive ? <div style={{ width:8, height:8, borderRadius:'50%', background:'#7C6FCD' }} /> : null}
              </div>
              <span className="phase-label" style={{ color: idle ? '#D0CCE8' : phaseDone ? '#7C6FCD' : phaseActive ? '#3D3580' : '#C0BBDC' }}>{ph.short}</span>
            </div>
          )
        })}
      </div>
    </div>
  )
}

function SavedItem({ name, onLoad, onDelete, loading }) {
  return (
    <div className="saved-item fadein">
      <div className="saved-icon">
        <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2">
          <rect x="3" y="4" width="18" height="18" rx="2"/>
          <line x1="16" y1="2" x2="16" y2="6"/><line x1="8" y1="2" x2="8" y2="6"/><line x1="3" y1="10" x2="21" y2="10"/>
        </svg>
      </div>
      <span style={{ flex:1, fontSize:13, fontWeight:600, color:'#1a1a2e', overflow:'hidden', textOverflow:'ellipsis', whiteSpace:'nowrap' }}>{name}</span>
      <div className="saved-actions">
        <button className="saved-load-btn" onClick={() => onLoad(name)} disabled={loading}>
          {loading ? <svg className="spin" width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"><path d="M21 12a9 9 0 1 1-6.219-8.56"/></svg> : 'Load'}
        </button>
        <button className="saved-del-btn" onClick={() => onDelete(name)} disabled={loading} title="Delete">
          <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
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
  const [courseSearch, setCourseSearch] = useState('')

  // Solver / Setup states
  const [scheduleNamePreset, setScheduleNamePreset] = useState(PRESET_NAMES[0])
  const [scheduleNameCustom, setScheduleNameCustom] = useState('')
  const [solveError,   setSolveError]   = useState('')
  const [saved,        setSaved]        = useState(false)
  const [saveLoading,  setSaveLoading]  = useState(false)

  // Aside states
  const [savedList,    setSavedList]    = useState([])
  const [loadingList,  setLoadingList]  = useState(true)
  const [loadingItem,  setLoadingItem]  = useState(null)
  const [deleteTarget, setDeleteTarget] = useState(null)
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

  const effectiveScheduleName = scheduleNamePreset === 'Custom...' ? scheduleNameCustom : scheduleNamePreset;
  const canSolve = effectiveScheduleName.trim().length > 0;

  async function handleSolve() {
    if (!canSolve) return;
    setSolveError('')
    setSaved(false)
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

  async function handleSave() {
    const finalName = effectiveScheduleName.trim()
    if (!finalName) return
    setSaveLoading(true)
    try {
      await saveSchedule(finalName)
      setName(finalName)
      setSaved(true)
      toast(`Saved as "${finalName}"`, 'success')
      const data = await listSaved()
      setSavedList(Array.isArray(data) ? data : (data?.schedules ?? []))
    } catch (err) {
      const msg = err?.response?.data?.detail || 'Failed to save schedule. Try again.'
      toast(msg, 'error')
    } finally {
      setSaveLoading(false)
    }
  }

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

  const filteredReadiness = useMemo(() => {
    if (!readiness) return []
    const q = courseSearch.toLowerCase().trim()
    return readiness.filter(r => {
      if (r.otherDept) return false
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

  /* ────────────────────────── render ────────────────────────── */

  return (
    <div className="sch-root" style={{ fontFamily:"'Poppins',sans-serif" }}>

      {/* ─── TOP: COMMAND CENTER (STREAMLINED) ─── */}
      <div className="solver-toolbar">
        <div style={{ display: 'flex', alignItems: 'center', gap: 14 }}>
          <div style={{ width: 42, height: 42, borderRadius: 12, background: 'linear-gradient(135deg,#7C6FCD,#5a4fbf)', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#fff', boxShadow: '0 4px 12px rgba(124,111,205,0.3)' }}>
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"><polygon points="5 3 19 12 5 21 5 3"/></svg>
          </div>
          <div>
            <h2 style={{ fontSize: 16, fontWeight: 700, color: '#1a1a2e', margin: 0, letterSpacing: '-0.3px' }}>Solver</h2>
            <div style={{ fontSize: 12, color: '#8883B0', marginTop: 1 }}>Configure & run</div>
          </div>
        </div>

        <div style={{ width: 1, height: 32, background: '#E8E4F8', margin: '0 8px' }} />
        
        <div style={{ display: 'flex', alignItems: 'center', gap: 10, flexWrap: 'wrap' }}>
          <span style={{ fontSize: 11, fontWeight: 700, color: '#C0BBDC', textTransform: 'uppercase', letterSpacing: '0.8px' }}>Target Term</span>
          <select 
            className="sch-select"
            value={scheduleNamePreset}
            onChange={e => { setScheduleNamePreset(e.target.value); setSaved(false); }}
            disabled={status === 'running'}
            style={{ minWidth: 240 }}
          >
            {PRESET_NAMES.map(n => <option key={n} value={n}>{n}</option>)}
          </select>

          {scheduleNamePreset === 'Custom...' && (
            <input 
              className="sch-input fadein" 
              placeholder="Enter custom schedule name..." 
              value={scheduleNameCustom}
              onChange={e => { setScheduleNameCustom(e.target.value); setSaved(false); }}
              disabled={status === 'running'}
            />
          )}
        </div>
        
        <div style={{ flex: 1 }} />
        
        <button 
          className={`action-btn solve ${status === 'running' ? 'running' : ''}`}
          onClick={handleSolve} 
          disabled={!canSolve || status === 'running'}
          style={{ padding: '10px 24px', fontSize: 13 }}
        >
          {status === 'running' ? (
            <><svg className="spin" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"><path d="M21 12a9 9 0 1 1-6.219-8.56"/></svg> Solving...</>
          ) : status === 'complete' ? (
            <><svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"><polyline points="1 4 1 10 7 10"/><path d="M3.51 15a9 9 0 1 0 .49-4.2"/></svg> Re-generate</>
          ) : (
            <><svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"><polygon points="5 3 19 12 5 21 5 3"/></svg> Start Solver</>
          )}
        </button>
      </div>

      {/* Progress & Results Area */}
      {(status === 'running' || status === 'complete' || status === 'failed') && (
        <div className="solver-status-panel fadein">
          <PhaseTimeline currentPhaseIdx={currentPhaseIdx} status={status} progress={progress} />
          
          {status === 'running' && (
            <div className="status-strip running fadein" style={{ marginTop:20 }}>
              <svg className="spin" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"><path d="M21 12a9 9 0 1 1-6.219-8.56"/></svg>
              Solver is analyzing constraints and generating the timetable... Do not close this tab.
            </div>
          )}
          
          {status === 'failed' && (
            <div className="status-strip failed fadein" style={{ marginTop:20 }}>
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"><circle cx="12" cy="12" r="10"/><line x1="12" y1="8" x2="12" y2="12"/></svg>
              {solveError || 'Could not find a feasible schedule. Check the Readiness Check below for conflicts.'}
            </div>
          )}

          {status === 'complete' && (
            <div className="fadein" style={{ marginTop: 24, display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '16px 20px', background: '#FAFAFE', borderRadius: '12px', border: '1px solid #E8E4F8' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
                <div style={{ width: 40, height: 40, borderRadius: '50%', background: '#E6FAF3', color: '#059669', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                  <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3"><polyline points="20 6 9 17 4 12"/></svg>
                </div>
                <div>
                  <div style={{ fontSize: 14, fontWeight: 700, color: '#1a1a2e' }}>Schedule Generated Successfully</div>
                  <div style={{ fontSize: 12, color: '#8883B0', marginTop: 2 }}>"{effectiveScheduleName}" is ready in memory. Save it to keep it.</div>
                </div>
              </div>
              
              <div style={{ display: 'flex', gap: 12 }}>
                <button className="action-btn view" onClick={() => navigate('/dashboard/schedule')}>
                  View Schedule
                </button>
                <button className="action-btn save" onClick={handleSave} disabled={saved || saveLoading}>
                  {saveLoading ? (
                    <><svg className="spin" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"><path d="M21 12a9 9 0 1 1-6.219-8.56"/></svg> Saving...</>
                  ) : saved ? (
                    <><svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3"><polyline points="20 6 9 17 4 12"/></svg> Saved</>
                  ) : (
                    <><svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"><path d="M19 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h11l5 5v11a2 2 0 0 1-2 2z"/><polyline points="17 21 17 13 7 13 7 21"/></svg> Save "{effectiveScheduleName}"</>
                  )}
                </button>
              </div>
            </div>
          )}
        </div>
      )}

      {/* ─── BOTTOM SPLIT ─── */}
      <div className="bottom-split">
        
        {/* Readiness Check (Left) */}
        <div className="readiness-panel">
          <div className="panel-header">
            <div style={{ width: 36, height: 36, borderRadius: 10, background: '#F0EDF9', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
              <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="#7C6FCD" strokeWidth="2.5"><path d="M22 11.08V12a10 10 0 1 1-5.93-9.14"/><polyline points="22 4 12 14.01 9 11.01"/></svg>
            </div>
            <div style={{ flex: 1 }}>
              <h2 className="panel-title">Faculty Readiness Check</h2>
              <p style={{ fontSize: 12, color: '#8883B0', marginTop: 2 }}>Review pool sizes and ratings to identify bottlenecks before generating.</p>
            </div>
            <button className="check-btn" onClick={handleCheck} disabled={checkLoading}>
              {checkLoading
                ? <><svg className="spin" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M21 12a9 9 0 1 1-6.219-8.56"/></svg>Checking…</>
                : readiness
                  ? <><svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"><polyline points="1 4 1 10 7 10"/><path d="M3.51 15a9 9 0 1 0 .49-4.2"/></svg>Recheck</>
                  : <><svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"><path d="M22 11.08V12a10 10 0 1 1-5.93-9.14"/><polyline points="22 4 12 14.01 9 11.01"/></svg>Run check</>
              }
            </button>
          </div>

          <div className="panel-body">
            {checkError && (
              <div style={{ display:'flex', alignItems:'center', gap:10, padding:'12px 16px', borderRadius:10, background:'#FFF0F0', border:'1px solid #FECACA', fontSize:13, color:'#C0392B', marginBottom:16 }}>
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"><circle cx="12" cy="12" r="10"/><line x1="12" y1="8" x2="12" y2="12"/></svg>
                {checkError}
                <button onClick={handleCheck} style={{ marginLeft:'auto', background:'none', border:'none', cursor:'pointer', color:'#C0392B', fontSize:13, fontWeight:700, fontFamily:"'Poppins',sans-serif", padding:0 }}>Retry →</button>
              </div>
            )}

            {!readiness && !checkLoading && (
              <div style={{ display:'flex', flexDirection:'column', alignItems:'center', gap:12, padding:'40px 20px', textAlign:'center' }}>
                <div style={{ width:56, height:56, borderRadius:'50%', background:'#FAFAFE', display:'flex', alignItems:'center', justifyContent:'center', border:'1px solid #F0EDF9' }}>
                  <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="#D8D3F5" strokeWidth="2"><circle cx="12" cy="12" r="10"/><path d="M12 8v4"/><circle cx="12" cy="16" r=".5" fill="#D8D3F5"/></svg>
                </div>
                <p style={{ fontSize:14, fontWeight:600, color:'#1a1a2e', margin:0 }}>No data checked yet</p>
                <p style={{ fontSize:13, color:'#8883B0', maxWidth:320, lineHeight:1.5 }}>Run a check to see if your faculty and courses are fully prepared for scheduling.</p>
              </div>
            )}

            {readiness && summary && (
              <div className="fadein">
                {/* Summary tiles */}
                <div style={{ display:'flex', gap:12, marginBottom:20 }}>
                  {[
                    { key:'ready',       label:'Ready',       icon:'✓' },
                    { key:'thin',        label:'Thin pool',   icon:'~' },
                    { key:'low_quality', label:'Low quality', icon:'↓' },
                    { key:'no_faculty',  label:'No faculty',  icon:'!' },
                  ].map(({ key, label }) => {
                    const meta = STATUS_META[key], count = summary[key]
                    const active = count > 0
                    return (
                      <div key={key}
                        className={`r-stat${active ? ' clickable' : ''}`}
                        onClick={() => active && setFilterTab(key === 'ready' ? 'ready' : 'issues')}
                        style={{ background:meta.bg, borderColor: active ? meta.border : '#F0EDF9', opacity: active ? 1 : 0.4 }}>
                        <span style={{ fontSize:28, fontWeight:800, color:meta.color, lineHeight:1 }}>{count}</span>
                        <span style={{ fontSize:11, fontWeight:700, color:meta.color, textAlign:'center', marginTop:4, textTransform:'uppercase', letterSpacing:'0.5px' }}>{label}</span>
                      </div>
                    )
                  })}
                </div>

                {/* Workload accordion */}
                {workload && workload.length > 0 && (
                  <div style={{ marginBottom:16, borderRadius:12, border:'1px solid #E8E4F8', overflow:'hidden', boxShadow:'0 2px 6px rgba(124,111,205,0.04)' }}>
                    <button onClick={() => setShowWorkload(w => !w)}
                      style={{ width:'100%', display:'flex', alignItems:'center', gap:10, padding:'14px 18px', background:showWorkload ? '#FAFAFE' : '#fff', border:'none', cursor:'pointer', fontFamily:"'Poppins',sans-serif", textAlign:'left' }}>
                      <div style={{ width:28, height:28, borderRadius:8, background:'#EEEAFB', display:'flex', alignItems:'center', justifyContent:'center', color:'#7C6FCD' }}>
                        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"><line x1="18" y1="20" x2="18" y2="10"/><line x1="12" y1="20" x2="12" y2="4"/><line x1="6" y1="20" x2="6" y2="14"/></svg>
                      </div>
                      <span style={{ fontSize:13, fontWeight:700, color:'#1a1a2e', flex:1 }}>Current Faculty Workload</span>
                      {overloadedCount > 0 && <span style={{ fontSize:10.5, fontWeight:700, padding:'2px 10px', borderRadius:99, background:'#FFE8E8', color:'#C0392B' }}>{overloadedCount} at cap</span>}
                      <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="#B0ABCC" strokeWidth="2.5"
                        style={{ transition:'transform .2s', transform: showWorkload ? 'rotate(180deg)' : 'none', flexShrink:0 }}>
                        <polyline points="6 9 12 15 18 9"/>
                      </svg>
                    </button>
                    {showWorkload && (
                      <div className="fadein" style={{ borderTop:'1px solid #F0EDF9', padding:'4px 18px 12px', maxHeight:240, overflowY:'auto' }}>
                        {workload.map((f, i) => <WorkloadRow key={i} f={f} />)}
                      </div>
                    )}
                  </div>
                )}

                {/* Filter tabs + search */}
                <div style={{ display:'flex', gap:10, marginBottom:12, alignItems:'center', flexWrap:'wrap' }}>
                  <div style={{ display:'flex', gap:6, background:'#FAFAFE', padding:4, borderRadius:12, border:'1px solid #F0EDF9' }}>
                    {[
                      { key:'all',    label:`All (${summary.total})` },
                      ...(issueCount > 0 ? [{ key:'issues', label:`Issues (${issueCount})` }] : []),
                      { key:'ready',  label:`Ready (${summary.ready})` },
                    ].map(t => (
                      <button key={t.key} className={`r-tab${filterTab === t.key ? ' active' : ''}`} onClick={() => setFilterTab(t.key)}>{t.label}</button>
                    ))}
                  </div>
                  <span style={{ flex:1 }} />
                  <div style={{ position:'relative', width:220 }}>
                    <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="#B0ABCC" strokeWidth="2.5"
                      style={{ position:'absolute', left:12, top:'50%', transform:'translateY(-50%)', pointerEvents:'none' }}>
                      <circle cx="11" cy="11" r="8"/><line x1="21" y1="21" x2="16.65" y2="16.65"/>
                    </svg>
                    <input className="sch-search" type="text" placeholder="Search by course..." value={courseSearch} onChange={e => setCourseSearch(e.target.value)} />
                  </div>
                </div>

                {/* Course table */}
                <div style={{ borderRadius:12, border:'1px solid #E8E4F8', overflow:'hidden', maxHeight:400, overflowY:'auto', boxShadow:'0 2px 6px rgba(124,111,205,0.04)' }}>
                  <div style={{ display:'grid', gridTemplateColumns:'24px 1fr 100px 100px 20px', gap:12, padding:'10px 16px', background:'#FAFAFE', borderBottom:'1px solid #F0EDF9', position:'sticky', top:0, zIndex:1, alignItems:'center' }}>
                    <span />
                    <span style={{ fontSize:10.5, fontWeight:700, color:'#B0ABCC', textTransform:'uppercase', letterSpacing:'.8px' }}>Course</span>
                    <span style={{ fontSize:10.5, fontWeight:700, color:'#B0ABCC', textTransform:'uppercase', letterSpacing:'.8px', textAlign:'right' }}>Pool rating</span>
                    <span style={{ fontSize:10.5, fontWeight:700, color:'#B0ABCC', textTransform:'uppercase', letterSpacing:'.8px', textAlign:'right' }}>Status</span>
                    <span />
                  </div>
                  {filteredReadiness.length === 0
                    ? <div style={{ padding:'32px 20px', textAlign:'center', color:'#B0ABCC', fontSize:13 }}>
                        {courseSearch ? `No courses match "${courseSearch}".` : 'No courses match this filter.'}
                      </div>
                    : filteredReadiness.map(item => <CourseRow key={item.courseCode} item={item} onOpenModal={setModalItem} />)
                  }
                </div>

                {/* Externally managed courses */}
                {summary.otherDept > 0 && (
                  <div style={{ marginTop:14, borderRadius:12, border:'1px solid #E8E4F8', overflow:'hidden' }}>
                    <button onClick={() => setShowOtherDept(v => !v)}
                      style={{ width:'100%', padding:'14px 18px', background:'#FAFAFE', border:'none', cursor:'pointer', display:'flex', alignItems:'center', gap:10, fontFamily:"'Poppins',sans-serif" }}>
                      <div style={{ width:28, height:28, borderRadius:8, background:'#EEEAFB', display:'flex', alignItems:'center', justifyContent:'center', color:'#7C6FCD' }}>
                        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
                          <rect x="3" y="3" width="7" height="7" rx="1"/><rect x="14" y="3" width="7" height="7" rx="1"/>
                          <rect x="3" y="14" width="7" height="7" rx="1"/><rect x="14" y="14" width="7" height="7" rx="1"/>
                        </svg>
                      </div>
                      <span style={{ fontSize:13, fontWeight:700, color:'#1a1a2e', flex:1, textAlign:'left' }}>Externally Managed Courses</span>
                      <span style={{ fontSize:11, padding:'2px 10px', borderRadius:99, background:'#EEEAFB', color:'#7C6FCD', fontWeight:700 }}>{summary.otherDept}</span>
                      <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="#B0ABCC" strokeWidth="2.5"
                        style={{ flexShrink:0, transform: showOtherDept ? 'rotate(180deg)' : 'none', transition:'transform 0.18s', marginLeft:4 }}>
                        <polyline points="6 9 12 15 18 9"/>
                      </svg>
                    </button>
                    {showOtherDept && (
                      <div className="fadein" style={{ borderTop:'1px solid #F0EDF9', maxHeight:280, overflowY:'auto' }}>
                        <div style={{ padding:'10px 18px', background:'#fff', borderBottom:'1px solid #F5F4FB', fontSize:11.5, color:'#8883B0' }}>
                          PE, NSTP, MAT, and GEC are assigned by other departments and skipped by the automated solver.
                        </div>
                        {otherDeptReadiness.map(item => <CourseRow key={item.courseCode} item={item} onOpenModal={setModalItem} />)}
                      </div>
                    )}
                  </div>
                )}
              </div>
            )}
          </div>
        </div>

        {/* Saved Schedules (Right Aside) */}
        <div className="saved-panel">
          <div className="panel-header">
            <div style={{ width: 36, height: 36, borderRadius: 10, background: '#E6FAF3', color: '#059669', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
              <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"><path d="M19 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h11l5 5v11a2 2 0 0 1-2 2z"/><polyline points="17 21 17 13 7 13 7 21"/></svg>
            </div>
            <div style={{ flex: 1 }}>
              <h2 className="panel-title">Library</h2>
              <p style={{ fontSize: 12, color: '#8883B0', marginTop: 2 }}>Your saved schedules</p>
            </div>
            {loadingList ? (
              <Skel w={28} h={20} r={99} />
            ) : (
              savedList.length > 0 && <Badge type="green">{savedList.length}</Badge>
            )}
          </div>

          <div style={{ maxHeight:'calc(100vh - 280px)', overflowY:'auto' }}>
            {loadingList ? (
              <div style={{ display: 'flex', flexDirection: 'column' }}>
                {[1, 2, 3, 4].map((i) => (
                  <div key={i} className="saved-item" style={{ cursor: 'default' }}>
                    <Skel w={36} h={36} r={10} />
                    <div style={{ flex: 1, paddingLeft: 12 }}>
                      <Skel w="70%" h={14} r={6} />
                    </div>
                    <div style={{ display: 'flex', gap: 6, marginLeft: 'auto' }}>
                      <Skel w={56} h={28} r={8} />
                      <Skel w={34} h={28} r={8} />
                    </div>
                  </div>
                ))}
              </div>
            ) : savedList.length === 0 ? (
              <div style={{ display:'flex', flexDirection:'column', alignItems:'center', gap:12, padding:'48px 24px', color:'#C0BBDC' }}>
                <div style={{ width:56, height:56, borderRadius:'50%', background:'#FAFAFE', border:'1px solid #F0EDF9', display:'flex', alignItems:'center', justifyContent:'center' }}>
                  <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="#D8D3F5" strokeWidth="2">
                    <rect x="3" y="4" width="18" height="18" rx="2"/><line x1="16" y1="2" x2="16" y2="6"/><line x1="8" y1="2" x2="8" y2="6"/><line x1="3" y1="10" x2="21" y2="10"/>
                  </svg>
                </div>
                <div style={{ textAlign:'center' }}>
                  <p style={{ fontSize:14, fontWeight:600, color:'#1a1a2e', margin:0 }}>No saved schedules</p>
                  <p style={{ fontSize:12.5, color:'#8883B0', marginTop:6, lineHeight:1.5 }}>Generate a new schedule above and save it here.</p>
                </div>
              </div>
            ) : (
              savedList.map(name => (
                <SavedItem key={name} name={name} onLoad={handleLoad} onDelete={handleDelete} loading={loadingItem === name} />
              ))
            )}
          </div>
        </div>

      </div>

      {/* Modals */}
      {modalItem && <FacultyPoolModal item={modalItem} onClose={() => setModalItem(null)} />}
      {deleteTarget && <DeleteModal name={deleteTarget} onConfirm={confirmDelete} onCancel={() => setDeleteTarget(null)} />}
      <ToastContainer toasts={toasts} />
    </div>
  )
}