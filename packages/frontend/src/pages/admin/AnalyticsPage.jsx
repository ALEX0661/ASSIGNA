import { useEffect, useState, useRef, useCallback } from 'react'
import { getAssignmentQuality, getWorkload, getFacultyPreview, listSaved, loadSaved } from '../../services/api'

/* ─────────────────────────────────────────────
   Styles
───────────────────────────────────────────── */
if (!document.getElementById('analytics-style')) {
  const s = document.createElement('style')
  s.id = 'analytics-style'
  s.textContent = `
    @keyframes spin    { to { transform:rotate(360deg) } }
    @keyframes fadeUp  { from{opacity:0;transform:translateY(7px)} to{opacity:1;transform:translateY(0)} }
    @keyframes shimmer { 0%{background-position:-400px 0} 100%{background-position:400px 0} }
    @keyframes modalIn { from{opacity:0;transform:scale(.96) translateY(6px)} to{opacity:1;transform:scale(1) translateY(0)} }
    @keyframes an-toast-in { from{opacity:0;transform:translateX(-50%) translateY(12px) scale(.96)} to{opacity:1;transform:translateX(-50%) translateY(0) scale(1)} }

    .a-tab {
      padding:7px 16px; border-radius:8px; border:none;
      font-family:'Poppins',sans-serif; font-size:12.5px; font-weight:500;
      cursor:pointer; background:transparent; color:#8883B0;
      transition:all 0.15s; white-space:nowrap;
      display:flex; align-items:center; gap:5px;
    }
    .a-tab:hover  { background:#F0EDF9; color:#3D3580; }
    .a-tab.active { background:#7C6FCD; color:#fff; box-shadow:0 3px 10px rgba(124,111,205,0.28); }
    .a-tab .tbadge {
      display:inline-flex; align-items:center; justify-content:center;
      min-width:16px; height:16px; padding:0 4px; border-radius:99px;
      font-size:9px; font-weight:700; background:#E8E4F8; color:#7C6FCD;
    }
    .a-tab.active .tbadge { background:rgba(255,255,255,0.22); color:#fff; }
    .a-tab.warn .tbadge   { background:#FFE8E8; color:#C0392B; }
    .a-tab.active.warn .tbadge { background:rgba(255,90,90,0.28); color:#fff; }

    .kcard { animation:fadeUp 0.3s ease both; }
    .kcard:nth-child(1){animation-delay:.04s}
    .kcard:nth-child(2){animation-delay:.08s}
    .kcard:nth-child(3){animation-delay:.12s}
    .kcard:nth-child(4){animation-delay:.16s}
    .sec { animation:fadeUp 0.26s ease both; }

    .skel {
      background:linear-gradient(90deg,#F0EDF9 25%,#E8E4F8 50%,#F0EDF9 75%);
      background-size:400px 100%; animation:shimmer 1.4s infinite linear; border-radius:8px;
    }
    .xrow { transition:background 0.12s; cursor:pointer; }
    .xrow:hover { background:#FAFAFE; }
    .chip {
      display:inline-flex; align-items:center; padding:2px 9px;
      border-radius:99px; font-size:11px; font-weight:600;
      background:#EEEAFB; color:#7C6FCD;
    }
    .sort-opt {
      background:none; border:none; cursor:pointer; padding:4px 8px;
      border-radius:6px; color:#B0ABCC; font-size:11.5px; font-weight:500;
      font-family:'Poppins',sans-serif; transition:all 0.12s;
    }
    .sort-opt:hover  { background:#F0EDF9; color:#7C6FCD; }
    .sort-opt.active { background:#EEEAFB; color:#7C6FCD; }
    .filter-btn {
      padding:4px 10px; border-radius:7px; border:1px solid #E8E4F8;
      background:#fff; color:#8883B0; font-family:'Poppins',sans-serif;
      font-size:11.5px; font-weight:500; cursor:pointer; transition:all 0.15s;
    }
    .filter-btn:hover  { border-color:#D8D3F5; color:#3D3580; }
    .filter-btn.active { border-color:#7C6FCD; background:#EEEAFB; color:#7C6FCD; }
    .srch {
      padding:6px 10px 6px 30px; border-radius:8px;
      border:1px solid #E8E4F8; font-family:'Poppins',sans-serif;
      font-size:12.5px; background:#FAFAFE; color:#1a1a2e; outline:none;
      transition:border-color 0.15s; width:100%; box-sizing:border-box;
    }
    .srch:focus { border-color:#A99BE8; box-shadow:0 0 0 3px rgba(169,155,232,0.12); }
    .ring-fill  { transition:stroke-dashoffset 1s cubic-bezier(.4,0,.2,1); }
    .warn-icon-btn {
      display:flex; align-items:center; justify-content:center;
      width:30px; height:30px; border-radius:8px; border:none;
      cursor:pointer; transition:all 0.15s; position:relative;
    }
    .warn-icon-btn:hover { background:#FEF3CD; }
    .warn-dot {
      position:absolute; top:4px; right:4px; width:7px; height:7px;
      border-radius:50%; background:#EF4444; border:1.5px solid #fff;
    }
    .modal-backdrop {
      position:fixed; inset:0; background:rgba(26,26,46,0.35);
      display:flex; align-items:flex-start; justify-content:flex-end;
      padding:56px 28px 0; z-index:200; backdrop-filter:blur(2px);
    }
    .modal-box {
      background:#fff; border-radius:14px; width:340px; max-height:460px;
      overflow:hidden; display:flex; flex-direction:column;
      box-shadow:0 12px 40px rgba(26,26,46,0.18); border:1px solid #E8E4F8;
      animation:modalIn 0.2s cubic-bezier(.4,0,.2,1);
    }
    .info-note {
      display:flex; align-items:flex-start; gap:8px; padding:9px 13px;
      border-radius:9px; background:#F0EDF9; border:1px solid #E8E4F8;
      font-size:11.5px; color:#5a4fbf; line-height:1.55;
    }

    /* Sortable column header */
    .sort-col {
      display:inline-flex; align-items:center; gap:4px;
      cursor:pointer; user-select:none; transition:color .12s;
    }
    .sort-col:hover { color:#7C6FCD; }
    .sort-col.active { color:#7C6FCD; }

    /* Toast */
    .an-toast-wrap { position:fixed; bottom:24px; left:50%; z-index:9999; display:flex; flex-direction:column; gap:8px; align-items:center; pointer-events:none; transform:translateX(-50%); }
    .an-toast { display:flex; align-items:center; gap:9px; padding:10px 16px; border-radius:12px; font-family:'Poppins',sans-serif; font-size:12.5px; font-weight:500; box-shadow:0 8px 28px rgba(26,26,46,0.18); animation:an-toast-in .22s cubic-bezier(.4,0,.2,1); white-space:nowrap; pointer-events:auto; }
    .an-toast.success { background:#1a1a2e; color:#6EE7B7; }
    .an-toast.error   { background:#1a1a2e; color:#FCA5A5; }
    .an-toast.info    { background:#1a1a2e; color:#A99BE8; }

    /* Export button */
    .export-btn {
      display:inline-flex; align-items:center; gap:6px;
      padding:6px 12px; border-radius:9px; border:1px solid #E8E4F8;
      background:#fff; color:#8883B0; font-size:12.5px; font-weight:500;
      font-family:'Poppins',sans-serif; cursor:pointer; transition:all .15s;
    }
    .export-btn:hover { border-color:#D8D3F5; color:#3D3580; background:#F5F4FB; }
  `
  document.head.appendChild(s)
}

/* ─────────────────────────────────────────────
   Constants
───────────────────────────────────────────── */
const OTHER_DEPT_PREFIXES = ['PE', 'NSTP', 'MAT', 'MATH', 'PATHFIT', 'GEC']

function isOtherDept(courseCode = '') {
  const upper = courseCode.toUpperCase().trim()
  return OTHER_DEPT_PREFIXES.some(p => upper.startsWith(p))
}

function deduplicateCourses(courses = []) {
  const seen = new Map()
  for (const c of courses) {
    const key = c.courseCode
    if (!seen.has(key)) {
      seen.set(key, { ...c })
    } else {
      const existing = seen.get(key)
      if (c.poolSize > existing.poolSize) seen.set(key, { ...c })
    }
  }
  return [...seen.values()]
}

const mkIni = name =>
  (name || '').split(/[\s,]+/).filter(Boolean).map(n => n[0]).join('').slice(0, 2).toUpperCase()

/* ─────────────────────────────────────────────
   Toast system
───────────────────────────────────────────── */
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
    <div className="an-toast-wrap">
      {toasts.map(t => (
        <div key={t.id} className={`an-toast ${t.type}`}>{icons[t.type]}{t.message}</div>
      ))}
    </div>
  )
}

/* ─────────────────────────────────────────────
   CSV export helper
───────────────────────────────────────────── */
function downloadCSV(filename, rows, headers) {
  const escape = v => {
    const s = String(v ?? '')
    return s.includes(',') || s.includes('"') || s.includes('\n') ? `"${s.replace(/"/g, '""')}"` : s
  }
  const csv = [headers, ...rows.map(r => headers.map(h => escape(r[h])))].map(r => r.join(',')).join('\n')
  const blob = new Blob([csv], { type: 'text/csv' })
  const url  = URL.createObjectURL(blob)
  const a    = Object.assign(document.createElement('a'), { href: url, download: filename })
  document.body.appendChild(a); a.click(); document.body.removeChild(a); URL.revokeObjectURL(url)
}

/* ─────────────────────────────────────────────
   Skeleton
───────────────────────────────────────────── */
function Sk({ w = '100%', h = 14, r = 8 }) {
  return <div className="skel" style={{ width: w, height: h, borderRadius: r }} />
}

function SkeletonPage() {
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4,1fr)', gap: 14 }}>
        {[...Array(4)].map((_, i) => (
          <div key={i} style={{ background: '#fff', borderRadius: 16, padding: 20, border: '1px solid #E8E4F8', display: 'flex', flexDirection: 'column', gap: 12 }}>
            <Sk w={38} h={38} r={10} /><Sk w="55%" h={26} /><Sk w="70%" h={11} />
          </div>
        ))}
      </div>
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 14 }}>
        {[...Array(2)].map((_, i) => (
          <div key={i} style={{ background: '#fff', borderRadius: 16, padding: '20px 22px', border: '1px solid #E8E4F8', display: 'flex', gap: 18, alignItems: 'center' }}>
            <Sk w={80} h={80} r={99} />
            <div style={{ flex: 1, display: 'flex', flexDirection: 'column', gap: 8 }}><Sk w="60%" h={13} /><Sk w="80%" h={11} /></div>
          </div>
        ))}
      </div>
    </div>
  )
}

/* ─────────────────────────────────────────────
   Alert icon button + modal (top-right)
───────────────────────────────────────────── */
function AlertIconModal({ overloadCount, warnCount }) {
  const [open, setOpen] = useState(false)
  const ref             = useRef(null)
  const total           = overloadCount + warnCount
  if (total === 0) return null

  const items = []
  if (overloadCount > 0) items.push({
    icon: (
      <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="#C0392B" strokeWidth="2">
        <line x1="18" y1="20" x2="18" y2="10"/>
        <line x1="12" y1="20" x2="12" y2="4"/>
        <line x1="6"  y1="20" x2="6"  y2="14"/>
        <line x1="3"  y1="20" x2="21" y2="20"/>
      </svg>
    ),
    title: `${overloadCount} faculty overloaded`,
    desc:  'Some faculty members exceed their max unit cap. Review the Workload tab.',
    color: '#C0392B', bg: '#FFE8E8',
  })
  if (warnCount > 0) items.push({
    icon: (
      <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="#D97706" strokeWidth="2">
        <path d="M4 19.5A2.5 2.5 0 0 1 6.5 17H20"/>
        <path d="M6.5 2H20v20H6.5A2.5 2.5 0 0 1 4 19.5v-15A2.5 2.5 0 0 1 6.5 2z"/>
        <line x1="12" y1="7" x2="12" y2="13"/>
        <line x1="12" y1="17" x2="12.01" y2="17"/>
      </svg>
    ),
    title: `${warnCount} courses may lack eligible faculty`,
    desc:  'PE, NSTP, MAT and GEC courses are excluded as they are managed by other departments.',
    color: '#D97706', bg: '#FEF3CD',
  })

  useEffect(() => {
    if (!open) return
    const handler = e => { if (ref.current && !ref.current.contains(e.target)) setOpen(false) }
    document.addEventListener('mousedown', handler)
    return () => document.removeEventListener('mousedown', handler)
  }, [open])

  return (
    <div style={{ position: 'relative' }} ref={ref}>
      <button className="warn-icon-btn" onClick={() => setOpen(v => !v)} title="View schedule alerts"
        style={{ background: open ? '#FEF3CD' : '#FFFBEB', border: '1px solid #FDE68A' }}>
        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="#D97706" strokeWidth="2.2">
          <path d="M10.29 3.86L1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z"/>
          <line x1="12" y1="9" x2="12" y2="13"/><line x1="12" y1="17" x2="12.01" y2="17"/>
        </svg>
        <span className="warn-dot" />
      </button>

      {open && (
        <div style={{ position: 'absolute', top: 38, right: 0, zIndex: 200 }}>
          <div className="modal-box" style={{ width: 320, maxHeight: 'none' }}>
            <div style={{ padding: '12px 16px 10px', borderBottom: '1px solid #F0EDF9', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 7 }}>
                <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="#D97706" strokeWidth="2.2">
                  <path d="M10.29 3.86L1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z"/>
                  <line x1="12" y1="9" x2="12" y2="13"/><line x1="12" y1="17" x2="12.01" y2="17"/>
                </svg>
                <span style={{ fontSize: 12.5, fontWeight: 700, color: '#1a1a2e' }}>Schedule alerts</span>
              </div>
              <span style={{ fontSize: 11, color: '#B0ABCC' }}>{total} issue{total !== 1 ? 's' : ''}</span>
            </div>
            <div style={{ padding: '8px 0' }}>
              {items.map((item, i) => (
                <div key={i} style={{ display: 'flex', gap: 11, padding: '10px 16px', borderBottom: i < items.length - 1 ? '1px solid #F5F4FB' : 'none' }}>
                  <div style={{ width: 32, height: 32, borderRadius: 9, background: item.bg, display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>{item.icon}</div>
                  <div>
                    <p style={{ fontSize: 12.5, fontWeight: 600, color: item.color, marginBottom: 3 }}>{item.title}</p>
                    <p style={{ fontSize: 11.5, color: '#8883B0', lineHeight: 1.55 }}>{item.desc}</p>
                  </div>
                </div>
              ))}
            </div>
            <div style={{ padding: '8px 16px 12px', borderTop: '1px solid #F0EDF9' }}>
              <p style={{ fontSize: 11, color: '#B0ABCC', textAlign: 'center' }}>Check the Workload and Eligibility tabs for details</p>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}

/* ─────────────────────────────────────────────
   KPI Card
───────────────────────────────────────────── */
function KpiCard({ label, value, sub, icon, color, bg }) {
  const [hov, setHov] = useState(false)
  return (
    <div className="kcard" onMouseEnter={() => setHov(true)} onMouseLeave={() => setHov(false)}
      style={{
        background: '#fff', borderRadius: 16, padding: '18px 20px',
        border: `1px solid ${hov ? '#D8D3F5' : '#E8E4F8'}`,
        boxShadow: hov ? `0 6px 22px ${color}1A` : '0 2px 8px rgba(124,111,205,0.06)',
        transform: hov ? 'translateY(-2px)' : 'none',
        transition: 'all 0.18s cubic-bezier(.4,0,.2,1)',
        display: 'flex', flexDirection: 'column', gap: 12,
        position: 'relative', overflow: 'hidden',
      }}>
      <div style={{ position: 'absolute', top: -20, right: -20, width: 68, height: 68, borderRadius: '50%', background: bg, opacity: 0.5, pointerEvents: 'none' }} />
      <div style={{ width: 36, height: 36, borderRadius: 10, background: bg, display: 'flex', alignItems: 'center', justifyContent: 'center', color, flexShrink: 0 }}>{icon}</div>
      <div>
        <div style={{ fontSize: 26, fontWeight: 700, color: '#1a1a2e', lineHeight: 1, letterSpacing: '-0.5px' }}>{value ?? '—'}</div>
        <div style={{ fontSize: 11.5, color: '#8883B0', marginTop: 4, fontWeight: 500 }}>{label}</div>
        {sub && <div style={{ fontSize: 11, color: '#B0ABCC', marginTop: 2 }}>{sub}</div>}
      </div>
    </div>
  )
}

/* ─────────────────────────────────────────────
   Compliance Ring
───────────────────────────────────────────── */
function ComplianceRing({ label, value, desc, color }) {
  const pct      = value !== null && value !== undefined ? parseFloat(value) : null
  const hasValue = pct !== null
  const radius   = 30, circ = 2 * Math.PI * radius
  const [mounted, setMounted] = useState(false)
  useEffect(() => { const t = setTimeout(() => setMounted(true), 120); return () => clearTimeout(t) }, [])

  const grade = !hasValue ? null
    : pct >= 80 ? { label: 'Excellent', c: '#059669', bg: '#DCFCE7' }
    : pct >= 60 ? { label: 'Good',      c: '#D97706', bg: '#FEF3CD' }
    :             { label: 'Low',       c: '#C0392B', bg: '#FFE8E8' }

  return (
    <div style={{ background: '#fff', borderRadius: 16, padding: '18px 22px', border: '1px solid #E8E4F8', boxShadow: '0 2px 8px rgba(124,111,205,0.06)', display: 'flex', alignItems: 'center', gap: 18 }}>
      <svg width={76} height={76} viewBox="0 0 76 76" style={{ flexShrink: 0 }}>
        <circle cx={38} cy={38} r={radius} fill="none" stroke="#F0EDF9" strokeWidth={7} />
        <circle cx={38} cy={38} r={radius} fill="none" stroke={hasValue ? color : '#E8E4F8'} strokeWidth={7}
          strokeLinecap="round" strokeDasharray={circ}
          strokeDashoffset={mounted && hasValue ? circ - (pct / 100) * circ : circ}
          transform="rotate(-90 38 38)" className="ring-fill" />
        <text x={38} y={38} dominantBaseline="middle" textAnchor="middle"
          style={{ fontSize: 11, fontWeight: 700, fill: hasValue ? '#1a1a2e' : '#C8C8D8', fontFamily: 'Poppins,sans-serif' }}>
          {hasValue ? `${pct}%` : 'N/A'}
        </text>
      </svg>
      <div style={{ flex: 1 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 7, marginBottom: 5, flexWrap: 'wrap' }}>
          <p style={{ fontWeight: 700, fontSize: 13, color: '#1a1a2e' }}>{label}</p>
          {grade && <span style={{ fontSize: 10, fontWeight: 700, padding: '2px 8px', borderRadius: 99, background: grade.bg, color: grade.c }}>{grade.label}</span>}
        </div>
        <p style={{ fontSize: 11.5, color: '#8883B0', lineHeight: 1.55 }}>{desc}</p>
        {!hasValue && <p style={{ fontSize: 11, color: '#B0ABCC', marginTop: 4, fontStyle: 'italic' }}>Available after scheduler runs</p>}
      </div>
    </div>
  )
}

/* ─────────────────────────────────────────────
   Score badge
───────────────────────────────────────────── */
function ScoreBadge({ score }) {
  if (score === null || score === undefined) return <span style={{ color: '#B0ABCC', fontSize: 11.5 }}>—</span>
  const v = parseFloat(score)
  const [bg, color] = v >= 0.70 ? ['#DCFCE7', '#166534'] : v >= 0.40 ? ['#FEF3CD', '#8a5c00'] : ['#FFE8E8', '#C0392B']
  return <span style={{ display: 'inline-block', padding: '2px 10px', borderRadius: 99, fontSize: 11.5, fontWeight: 700, background: bg, color }}>{v.toFixed(2)}</span>
}

/* ─────────────────────────────────────────────
   Workload bar
───────────────────────────────────────────── */
function WorkloadBar({ label, value, max, overloaded }) {
  const pct    = max > 0 ? Math.min((value / max) * 100, 100) : 0
  const barCol = overloaded
    ? 'linear-gradient(90deg,#E74C3C,#C0392B)'
    : pct > 85 ? 'linear-gradient(90deg,#F59E0B,#D97706)'
    : 'linear-gradient(90deg,#A99BE8,#7C6FCD)'

  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '8px 0', borderBottom: '1px solid #F5F4FB' }}>
      <div style={{ width: 28, height: 28, borderRadius: '50%', flexShrink: 0, background: overloaded ? '#FFE8E8' : '#EEEAFB', color: overloaded ? '#C0392B' : '#7C6FCD', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 9, fontWeight: 700 }}>{mkIni(label)}</div>
      <div style={{ flex: 1, minWidth: 0 }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 4, alignItems: 'center' }}>
          <span style={{ fontSize: 12, fontWeight: 600, color: '#1a1a2e', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{label}</span>
          <span style={{ fontSize: 11, color: overloaded ? '#C0392B' : '#8883B0', fontWeight: overloaded ? 700 : 400, flexShrink: 0, marginLeft: 8 }}>{value}/{max}</span>
        </div>
        <div style={{ height: 5, background: '#F0EDF9', borderRadius: 99, overflow: 'hidden' }}>
          <div style={{ height: '100%', width: `${pct}%`, background: barCol, borderRadius: 99, transition: 'width 0.7s cubic-bezier(.4,0,.2,1)' }} />
        </div>
      </div>
      {overloaded
        ? <span style={{ flexShrink: 0, background: '#FFE8E8', color: '#C0392B', fontSize: 9.5, fontWeight: 700, padding: '2px 7px', borderRadius: 99 }}>Over</span>
        : <span style={{ flexShrink: 0, fontSize: 10, color: '#C8CCCC', minWidth: 28, textAlign: 'right' }}>{Math.round(pct)}%</span>
      }
    </div>
  )
}

/* ─────────────────────────────────────────────
   Eligibility row (deduped, expandable)
───────────────────────────────────────────── */
function EligibilityRow({ courseCode, title, poolSize, eligibleFaculty, warning, idx, otherDept }) {
  const [open, setOpen] = useState(false)
  const canExpand = poolSize > 0

  return (
    <div style={{ borderBottom: '1px solid #F5F4FB', animation: `fadeUp 0.2s ease ${Math.min(idx, 15) * 0.02}s both` }}>
      <div className={canExpand ? 'xrow' : ''} onClick={() => canExpand && setOpen(v => !v)}
        style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '9px 18px', cursor: canExpand ? 'pointer' : 'default' }}>
        <div style={{ width: 7, height: 7, borderRadius: '50%', flexShrink: 0, background: otherDept ? '#A99BE8' : warning ? '#EF4444' : poolSize >= 3 ? '#22C55E' : '#F59E0B' }} />
        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 7 }}>
            <p style={{ fontSize: 12.5, fontWeight: 600, color: '#1a1a2e', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{courseCode}</p>
            {otherDept && <span style={{ fontSize: 10, fontWeight: 600, padding: '1px 7px', borderRadius: 99, background: '#EEEAFB', color: '#7C6FCD', whiteSpace: 'nowrap', flexShrink: 0 }}>Other dept</span>}
          </div>
          <p style={{ fontSize: 11, color: '#8883B0', marginTop: 1, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{title}</p>
        </div>
        <span style={{
          flexShrink: 0, fontSize: 11, fontWeight: 700, padding: '2px 10px', borderRadius: 99,
          background: otherDept ? '#F0EDF9' : warning ? '#FFE8E8' : poolSize >= 3 ? '#DCFCE7' : '#FEF3CD',
          color:      otherDept ? '#7C6FCD' : warning ? '#C0392B' : poolSize >= 3 ? '#166534' : '#8a5c00',
        }}>
          {otherDept ? 'Ext. managed' : warning ? 'No match' : `${poolSize} eligible`}
        </span>
        {canExpand && (
          <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="#C0C8CC" strokeWidth="2"
            style={{ flexShrink: 0, transform: open ? 'rotate(180deg)' : 'none', transition: 'transform 0.18s' }}>
            <polyline points="6 9 12 15 18 9"/>
          </svg>
        )}
      </div>
      {open && (
        <div style={{ padding: '0 18px 9px 37px', display: 'flex', flexWrap: 'wrap', gap: 5, animation: 'fadeUp 0.15s ease' }}>
          {eligibleFaculty.map(name => <span key={name} className="chip">{name}</span>)}
        </div>
      )}
    </div>
  )
}

/* ─────────────────────────────────────────────
   Empty card
───────────────────────────────────────────── */
function EmptyCard({ title, desc }) {
  return (
    <div style={{ background: '#fff', borderRadius: 14, padding: '38px 28px', border: '1px solid #E8E4F8', display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 10, textAlign: 'center' }}>
      <div style={{ width: 44, height: 44, borderRadius: '50%', background: '#EEEAFB', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
        <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="#A99BE8" strokeWidth="2"><line x1="18" y1="20" x2="18" y2="10"/><line x1="12" y1="20" x2="12" y2="4"/><line x1="6" y1="20" x2="6" y2="14"/></svg>
      </div>
      <p style={{ fontSize: 13.5, fontWeight: 600, color: '#1a1a2e' }}>{title}</p>
      <p style={{ fontSize: 12, color: '#8883B0', maxWidth: 300, lineHeight: 1.6 }}>{desc}</p>
    </div>
  )
}

/* ─────────────────────────────────────────────
   Section: Overview
───────────────────────────────────────────── */
function OverviewSection({ quality, onExport }) {
  // NEW: per-faculty sort
  const [pfSort, setPfSort] = useState({ col: 'avgScore', dir: 'asc' })

  const noSolverRun = quality.autoAssignPct === 0 && quality.avgScore === null

  const KPIS = [
    {
      label: 'Total sessions', value: quality.totalSessions, sub: 'in current schedule',
      color: '#7C6FCD', bg: '#EEEAFB',
      icon: <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><rect x="3" y="4" width="18" height="18" rx="2"/><line x1="16" y1="2" x2="16" y2="6"/><line x1="8" y1="2" x2="8" y2="6"/><line x1="3" y1="10" x2="21" y2="10"/></svg>,
    },
    {
      label: 'Auto-assigned rate', value: `${quality.autoAssignPct}%`, sub: `${quality.autoAssigned} of ${quality.totalSessions}`,
      color: '#2563EB', bg: '#EBF0FF',
      icon: <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z"/></svg>,
    },
    {
      label: 'Avg quality score', value: quality.avgScore ?? '—', sub: 'target ≥ 0.70',
      color: '#059669', bg: '#DCFCE7',
      icon: <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><polygon points="12 2 15.09 8.26 22 9.27 17 14.14 18.18 21.02 12 17.77 5.82 21.02 7 14.14 2 9.27 8.91 8.26 12 2"/></svg>,
    },
    {
      label: 'TBA sessions', value: quality.tbaSessions,
      sub: quality.tbaSessions > 0 ? 'need manual assignment' : 'all sessions covered',
      color: quality.tbaSessions > 0 ? '#D97706' : '#059669',
      bg:    quality.tbaSessions > 0 ? '#FEF3CD' : '#DCFCE7',
      icon: quality.tbaSessions > 0
        ? <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><circle cx="12" cy="12" r="10"/><line x1="12" y1="8" x2="12" y2="12"/><line x1="12" y1="16" x2="12.01" y2="16"/></svg>
        : <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><polyline points="20 6 9 17 4 12"/></svg>,
    },
  ]

  // Sortable per-faculty list
  function toggleSort(col) {
    setPfSort(prev => prev.col === col ? { col, dir: prev.dir === 'asc' ? 'desc' : 'asc' } : { col, dir: col === 'avgScore' ? 'asc' : 'asc' })
  }

  const sortedFaculty = [...quality.perFaculty].sort((a, b) => {
    const mul = pfSort.dir === 'asc' ? 1 : -1
    if (pfSort.col === 'name')     return mul * a.name.localeCompare(b.name)
    if (pfSort.col === 'sessions') return mul * (a.sessions - b.sessions)
    if (pfSort.col === 'avgScore') return mul * ((a.avgScore ?? 0) - (b.avgScore ?? 0))
    return 0
  })

  function SortIcon({ col }) {
    if (pfSort.col !== col) return <svg width="9" height="9" viewBox="0 0 24 24" fill="none" stroke="#D0CCE8" strokeWidth="2"><polyline points="6 9 12 15 18 9"/></svg>
    return pfSort.dir === 'asc'
      ? <svg width="9" height="9" viewBox="0 0 24 24" fill="none" stroke="#7C6FCD" strokeWidth="2"><polyline points="18 15 12 9 6 15"/></svg>
      : <svg width="9" height="9" viewBox="0 0 24 24" fill="none" stroke="#7C6FCD" strokeWidth="2"><polyline points="6 9 12 15 18 9"/></svg>
  }

  return (
    <div className="sec" style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4,1fr)', gap: 14 }}>
        {KPIS.map(c => <KpiCard key={c.label} {...c} />)}
      </div>

      {noSolverRun ? (
        <div style={{ background: '#fff', borderRadius: 14, padding: '16px 20px', border: '1px solid #E8E4F8', display: 'flex', gap: 12, alignItems: 'flex-start' }}>
          <div style={{ width: 32, height: 32, borderRadius: 9, background: '#EEEAFB', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="#7C6FCD" strokeWidth="2"><circle cx="12" cy="12" r="10"/><line x1="12" y1="8" x2="12" y2="12"/><line x1="12" y1="16" x2="12.01" y2="16"/></svg>
          </div>
          <div>
            <p style={{ fontSize: 13, fontWeight: 600, color: '#1a1a2e', marginBottom: 3 }}>Preference compliance</p>
            <p style={{ fontSize: 12, color: '#8883B0', lineHeight: 1.6 }}>
              Time window and day-preference metrics are available after the scheduler has assigned faculty. Generate a schedule first.
            </p>
          </div>
        </div>
      ) : (
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 14 }}>
          <ComplianceRing label="Time window compliance"    value={quality.pctInWindow}        desc="Sessions placed within each faculty's preferred time window." color="#7C6FCD" />
          <ComplianceRing label="Day preference compliance" value={quality.pctOnPreferredDays} desc="Sessions placed on each faculty's preferred teaching days."   color="#2563EB" />
        </div>
      )}

      {quality.perFaculty.length > 0 ? (
        <div style={{ background: '#fff', borderRadius: 14, border: '1px solid #E8E4F8', overflow: 'hidden' }}>
          <div style={{ padding: '12px 18px', borderBottom: '1px solid #F0EDF9', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <div>
              <p style={{ fontWeight: 700, fontSize: 13, color: '#1a1a2e' }}>Per-faculty quality</p>
              <p style={{ fontSize: 11, color: '#8883B0', marginTop: 1 }}>Click column headers to sort</p>
            </div>
            {/* NEW: Export button */}
            <button className="export-btn" onClick={() => onExport('per-faculty')}>
              <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/>
                <polyline points="7 10 12 15 17 10"/><line x1="12" y1="15" x2="12" y2="3"/>
              </svg>
              Export CSV
            </button>
          </div>
          {/* Sortable header */}
          <div style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '7px 18px', background: '#FAFAFE', borderBottom: '1px solid #F0EDF9' }}>
            <div style={{ width: 28, flexShrink: 0 }} />
            <span className={`sort-col${pfSort.col === 'name' ? ' active' : ''}`} style={{ flex: 1, fontSize: 10, fontWeight: 700, color: '#B0ABCC', textTransform: 'uppercase', letterSpacing: '.6px' }}
              onClick={() => toggleSort('name')}>
              Name <SortIcon col="name" />
            </span>
            <span className={`sort-col${pfSort.col === 'sessions' ? ' active' : ''}`} style={{ fontSize: 10, fontWeight: 700, color: '#B0ABCC', textTransform: 'uppercase', letterSpacing: '.6px', width: 70, flexShrink: 0 }}
              onClick={() => toggleSort('sessions')}>
              Sessions <SortIcon col="sessions" />
            </span>
            <span className={`sort-col${pfSort.col === 'avgScore' ? ' active' : ''}`} style={{ fontSize: 10, fontWeight: 700, color: '#B0ABCC', textTransform: 'uppercase', letterSpacing: '.6px', width: 80, flexShrink: 0, textAlign: 'right' }}
              onClick={() => toggleSort('avgScore')}>
              Avg score <SortIcon col="avgScore" />
            </span>
          </div>
          <div style={{ maxHeight: 280, overflowY: 'auto' }}>
            {sortedFaculty.map((f, i, arr) => {
              const isLow = f.avgScore !== null && f.avgScore < 0.40
              return (
                <div key={f.name} style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '9px 18px', borderBottom: i < arr.length - 1 ? '1px solid #F5F4FB' : 'none', background: isLow ? '#FFFBF5' : 'transparent' }}>
                  <div style={{ width: 28, height: 28, borderRadius: '50%', flexShrink: 0, background: isLow ? '#FEF3CD' : '#EEEAFB', color: isLow ? '#D97706' : '#7C6FCD', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 9, fontWeight: 700 }}>{mkIni(f.name)}</div>
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <p style={{ fontSize: 12.5, fontWeight: 600, color: '#1a1a2e', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{f.name}</p>
                  </div>
                  <span style={{ fontSize: 11, color: '#8883B0', width: 70, flexShrink: 0 }}>{f.sessions} session{f.sessions !== 1 ? 's' : ''}</span>
                  <div style={{ width: 80, flexShrink: 0, textAlign: 'right' }}><ScoreBadge score={f.avgScore} /></div>
                </div>
              )
            })}
          </div>
        </div>
      ) : (
        <div style={{ background: '#fff', borderRadius: 14, padding: '22px', border: '1px solid #E8E4F8', textAlign: 'center' }}>
          <p style={{ fontSize: 12.5, color: '#B0ABCC' }}>Quality scores appear here after the scheduler assigns faculty to sessions.</p>
        </div>
      )}
    </div>
  )
}

/* ─────────────────────────────────────────────
   Section: Workload
───────────────────────────────────────────── */
function WorkloadSection({ workload, onExport }) {
  const [search, setSearch] = useState('')
  const [sort,   setSort]   = useState('load')

  if (!workload?.workload?.length) {
    return <EmptyCard title="No workload data" desc="Run or load a schedule to see faculty workload distribution." />
  }

  const list       = workload.workload
  const overloaded = list.filter(f => f.overloaded).length
  const nearCap    = list.filter(f => !f.overloaded && f.assigned / f.max_units >= 0.85).length
  const unassigned = list.filter(f => f.assigned === 0).length

  const filtered = [...list]
    .filter(f => f.name.toLowerCase().includes(search.toLowerCase()))
    .sort((a, b) =>
      sort === 'name'   ? a.name.localeCompare(b.name) :
      sort === 'status' ? (b.overloaded ? 1 : 0) - (a.overloaded ? 1 : 0) :
      b.assigned - a.assigned
    )

  return (
    <div className="sec" style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
      <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap' }}>
        {[
          { label: 'Total',      val: list.length, bg: '#EEEAFB', c: '#7C6FCD' },
          { label: 'Overloaded', val: overloaded,  bg: overloaded > 0 ? '#FFE8E8' : '#DCFCE7', c: overloaded > 0 ? '#C0392B' : '#166534' },
          { label: 'Near cap',   val: nearCap,     bg: nearCap > 0 ? '#FEF3CD' : '#DCFCE7',    c: nearCap > 0 ? '#8a5c00' : '#166534' },
          { label: 'Unassigned', val: unassigned,  bg: unassigned > 0 ? '#F5F4FB' : '#DCFCE7', c: unassigned > 0 ? '#8883B0' : '#166534' },
        ].map(p => (
          <div key={p.label} style={{ background: p.bg, color: p.c, borderRadius: 12, padding: '9px 15px', minWidth: 84 }}>
            <div style={{ fontSize: 20, fontWeight: 700, lineHeight: 1 }}>{p.val}</div>
            <div style={{ fontSize: 11, fontWeight: 500, opacity: 0.75, marginTop: 3 }}>{p.label}</div>
          </div>
        ))}
      </div>

      <div style={{ background: '#fff', borderRadius: 14, border: '1px solid #E8E4F8', overflow: 'hidden' }}>
        <div style={{ padding: '10px 16px', borderBottom: '1px solid #F0EDF9', display: 'flex', gap: 10, alignItems: 'center', flexWrap: 'wrap' }}>
          <div style={{ position: 'relative', flex: 1, minWidth: 150 }}>
            <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="#B0ABCC" strokeWidth="2"
              style={{ position: 'absolute', left: 9, top: '50%', transform: 'translateY(-50%)', pointerEvents: 'none' }}>
              <circle cx="11" cy="11" r="8"/><line x1="21" y1="21" x2="16.65" y2="16.65"/>
            </svg>
            <input className="srch" type="text" placeholder="Search faculty…" value={search} onChange={e => setSearch(e.target.value)} />
          </div>
          <div style={{ display: 'flex', gap: 3, alignItems: 'center' }}>
            <span style={{ fontSize: 11, color: '#C0ABCC', marginRight: 2 }}>Sort:</span>
            {[{ k: 'load', l: 'Load' }, { k: 'name', l: 'Name' }, { k: 'status', l: 'Status' }].map(o => (
              <button key={o.k} className={`sort-opt${sort === o.k ? ' active' : ''}`} onClick={() => setSort(o.k)}>{o.l}</button>
            ))}
          </div>
          {/* NEW: Export */}
          <button className="export-btn" onClick={() => onExport('workload')}>
            <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/>
              <polyline points="7 10 12 15 17 10"/><line x1="12" y1="15" x2="12" y2="3"/>
            </svg>
            Export CSV
          </button>
        </div>
        <div style={{ padding: '2px 16px 10px', maxHeight: 440, overflowY: 'auto' }}>
          {filtered.length === 0
            ? <p style={{ color: '#B0ABCC', fontSize: 12.5, padding: '18px 0', textAlign: 'center' }}>No results for "{search}"</p>
            : filtered.map(f => <WorkloadBar key={f.name} label={f.name} value={f.assigned} max={f.max_units} overloaded={f.overloaded} />)
          }
        </div>
      </div>
    </div>
  )
}

/* ─────────────────────────────────────────────
   Section: Eligibility
───────────────────────────────────────────── */
function EligibilitySection({ preview, onExport }) {
  const [search, setSearch] = useState('')
  const [filter, setFilter] = useState('all')
  const [showOther, setShowOther] = useState(false)

  if (!preview?.courses?.length) {
    return <EmptyCard title="No eligibility data" desc="Run or load a schedule to see faculty eligibility per course." />
  }

  const deduped   = deduplicateCourses(preview.courses)
  const myDept    = deduped.filter(c => !isOtherDept(c.courseCode))
  const otherDept = deduped.filter(c =>  isOtherDept(c.courseCode))
  const warnCount = myDept.filter(c => c.warning).length

  const filtered = [...myDept]
    .filter(c => {
      const ms = c.courseCode.toLowerCase().includes(search.toLowerCase()) || c.title.toLowerCase().includes(search.toLowerCase())
      const mf = filter === 'all' || (filter === 'warn' && c.warning) || (filter === 'ok' && !c.warning)
      return ms && mf
    })
    .sort((a, b) => a.poolSize - b.poolSize)

  const filteredOther = otherDept.filter(c =>
    c.courseCode.toLowerCase().includes(search.toLowerCase()) || c.title.toLowerCase().includes(search.toLowerCase())
  )

  return (
    <div className="sec" style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
      <div className="info-note">
        <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="#7C6FCD" strokeWidth="2" style={{ flexShrink: 0, marginTop: 1 }}>
          <circle cx="12" cy="12" r="10"/><line x1="12" y1="8" x2="12" y2="12"/><line x1="12" y1="16" x2="12.01" y2="16"/>
        </svg>
        <span>
          <strong>Estimates only.</strong> Specialisations are stored as <code style={{ background: 'rgba(124,111,205,0.12)', padding: '1px 5px', borderRadius: 4, fontSize: 11 }}>{'{courseCode, rating}'}</code> objects — pool sizes become fully accurate after the scheduler resolves assignments.
          PE, NSTP, MAT and GEC courses are excluded from warnings as they are handled externally.
        </span>
      </div>

      <div style={{ background: '#fff', borderRadius: 14, border: '1px solid #E8E4F8', overflow: 'hidden' }}>
        <div style={{ padding: '10px 16px', borderBottom: '1px solid #F0EDF9', display: 'flex', gap: 10, alignItems: 'center', flexWrap: 'wrap' }}>
          <div style={{ position: 'relative', flex: 1, minWidth: 180 }}>
            <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="#B0ABCC" strokeWidth="2"
              style={{ position: 'absolute', left: 9, top: '50%', transform: 'translateY(-50%)', pointerEvents: 'none' }}>
              <circle cx="11" cy="11" r="8"/><line x1="21" y1="21" x2="16.65" y2="16.65"/>
            </svg>
            <input className="srch" type="text" placeholder="Search by code or title…" value={search} onChange={e => setSearch(e.target.value)} />
          </div>
          <div style={{ display: 'flex', gap: 5 }}>
            {[
              { k: 'all',  l: `All (${myDept.length})` },
              { k: 'warn', l: `No match (${warnCount})` },
              { k: 'ok',   l: `Has pool (${myDept.length - warnCount})` },
            ].map(o => (
              <button key={o.k} className={`filter-btn${filter === o.k ? ' active' : ''}`} onClick={() => setFilter(o.k)}>{o.l}</button>
            ))}
          </div>
          {/* NEW: Export */}
          <button className="export-btn" onClick={() => onExport('eligibility')}>
            <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/>
              <polyline points="7 10 12 15 17 10"/><line x1="12" y1="15" x2="12" y2="3"/>
            </svg>
            Export CSV
          </button>
        </div>

        <div style={{ padding: '5px 16px 4px', borderBottom: '1px solid #F5F4FB', background: '#FAFAFE' }}>
          <p style={{ fontSize: 11, color: '#C0C8CC' }}>
            {filtered.length} of {myDept.length} courses · click to expand eligible faculty
          </p>
        </div>

        <div style={{ maxHeight: 440, overflowY: 'auto' }}>
          {filtered.length === 0
            ? <p style={{ color: '#B0ABCC', fontSize: 12.5, padding: '22px', textAlign: 'center' }}>No courses match your filters.</p>
            : filtered.map((c, i) => <EligibilityRow key={c.courseCode} {...c} idx={i} otherDept={false} />)
          }
        </div>
      </div>

      {otherDept.length > 0 && (
        <div style={{ background: '#fff', borderRadius: 14, border: '1px solid #E8E4F8', overflow: 'hidden' }}>
          <button onClick={() => setShowOther(v => !v)}
            style={{ width: '100%', padding: '11px 18px', background: 'none', border: 'none', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'space-between', fontFamily: "'Poppins',sans-serif" }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
              <span style={{ fontSize: 12.5, fontWeight: 600, color: '#8883B0' }}>Externally managed courses</span>
              <span style={{ fontSize: 11, padding: '2px 8px', borderRadius: 99, background: '#EEEAFB', color: '#7C6FCD', fontWeight: 600 }}>{filteredOther.length || otherDept.length}</span>
              <span style={{ fontSize: 11, color: '#B0ABCC' }}>PE · NSTP · MAT · GEC — assigned by other departments</span>
            </div>
            <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="#B0ABCC" strokeWidth="2"
              style={{ flexShrink: 0, transform: showOther ? 'rotate(180deg)' : 'none', transition: 'transform 0.18s' }}>
              <polyline points="6 9 12 15 18 9"/>
            </svg>
          </button>
          {showOther && (
            <div style={{ borderTop: '1px solid #F0EDF9', maxHeight: 320, overflowY: 'auto' }}>
              {(search ? filteredOther : otherDept).map((c, i) => (
                <EligibilityRow key={c.courseCode} {...c} idx={i} otherDept warning={false} />
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  )
}

/* ─────────────────────────────────────────────
   Empty state (page-level) — IMPROVED: link to Scheduler
───────────────────────────────────────────── */
function EmptyState({ onNavigateToScheduler }) {
  return (
    <div style={{ background: '#fff', borderRadius: 16, padding: '56px 32px', border: '2px dashed #E8E4F8', display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 14 }}>
      <div style={{ width: 52, height: 52, borderRadius: '50%', background: '#EEEAFB', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
        <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="#A99BE8" strokeWidth="2"><line x1="18" y1="20" x2="18" y2="10"/><line x1="12" y1="20" x2="12" y2="4"/><line x1="6" y1="20" x2="6" y2="14"/></svg>
      </div>
      <div style={{ textAlign: 'center' }}>
        <p style={{ fontSize: 14, fontWeight: 700, color: '#1a1a2e', marginBottom: 6 }}>No schedule in memory</p>
        <p style={{ fontSize: 12.5, color: '#8883B0', maxWidth: 330, lineHeight: 1.6 }}>
          Generate a schedule from the Scheduler page, or select a saved schedule from the dropdown above.
        </p>
      </div>
      {onNavigateToScheduler && (
        <button onClick={onNavigateToScheduler}
          style={{ display: 'inline-flex', alignItems: 'center', gap: 7, padding: '9px 18px', borderRadius: 10, border: 'none', background: 'linear-gradient(135deg,#7C6FCD,#5a4fbf)', color: '#fff', fontSize: 13, fontWeight: 600, cursor: 'pointer', fontFamily: "'Poppins',sans-serif", boxShadow: '0 4px 14px rgba(124,111,205,0.35)', marginTop: 2 }}>
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="#fff" strokeWidth="2.2"><polygon points="5 3 19 12 5 21 5 3"/></svg>
          Go to Scheduler
        </button>
      )}
    </div>
  )
}

/* ─────────────────────────────────────────────
   Main
───────────────────────────────────────────── */
export default function AnalyticsPage() {
  const [quality,      setQuality]      = useState(null)
  const [workload,     setWorkload]     = useState(null)
  const [preview,      setPreview]      = useState(null)
  const [loading,      setLoading]      = useState(true)
  const [selected,     setSelected]     = useState(null)
  const [savedList,    setSavedList]    = useState([])
  const [error,        setError]        = useState(null)
  const [listLoading,  setListLoading]  = useState(true)
  const [switching,    setSwitching]    = useState(false)
  const [refreshing,   setRefreshing]   = useState(false)
  const [activeTab,    setActiveTab]    = useState('overview')
  const [lastRefreshed, setLastRefreshed] = useState(null)   // NEW: last-refreshed timestamp
  const { toasts, toast } = useToast()

  // Optional: if you have useNavigate available (add import at top)
  // const navigate = useNavigate()

  const fetchAll = async () => {
    const [q, w, p] = await Promise.all([getAssignmentQuality(), getWorkload(), getFacultyPreview()])
    setQuality(q); setWorkload(w); setPreview(p)
    setLastRefreshed(new Date())
  }

  useEffect(() => {
    listSaved()
      .then(d => setSavedList(Array.isArray(d) ? d : (d?.schedules ?? [])))
      .catch(() => {})
      .finally(() => setListLoading(false))
  }, [])

  useEffect(() => {
    setLoading(true)
    fetchAll().catch(() => setError('Failed to load analytics.')).finally(() => setLoading(false))
  }, []) // eslint-disable-line

  async function handleSelect(value) {
    const name = value === '__current__' ? null : value
    setSelected(name)
    if (!name) {
      setLoading(true)
      fetchAll().catch(() => setError('Failed to reload.')).finally(() => setLoading(false))
      return
    }
    setSwitching(true)
    try { await loadSaved(name); await fetchAll() }
    catch { setError(`Failed to load "${name}".`) }
    finally { setSwitching(false) }
  }

  async function handleRefresh() {
    setRefreshing(true)
    setError(null)
    try {
      await fetchAll()
      toast('Analytics refreshed', 'success')
    } catch {
      setError('Refresh failed.')
      toast('Refresh failed. Try again.', 'error')
    } finally {
      setRefreshing(false)
    }
  }

  /* ── CSV export handler ── */
  function handleExport(section) {
    try {
      if (section === 'per-faculty' && quality?.perFaculty?.length) {
        downloadCSV(
          `analytics-per-faculty-${new Date().toISOString().slice(0,10)}.csv`,
          quality.perFaculty,
          ['name', 'sessions', 'avgScore'],
        )
        toast('Per-faculty CSV downloaded', 'success')
      } else if (section === 'workload' && workload?.workload?.length) {
        downloadCSV(
          `analytics-workload-${new Date().toISOString().slice(0,10)}.csv`,
          workload.workload,
          ['name', 'assigned', 'max_units', 'overloaded'],
        )
        toast('Workload CSV downloaded', 'success')
      } else if (section === 'eligibility' && preview?.courses?.length) {
        const deduped = deduplicateCourses(preview.courses)
        const rows = deduped.map(c => ({
          courseCode:      c.courseCode,
          title:           c.title,
          poolSize:        c.poolSize,
          warning:         c.warning ? 'Yes' : 'No',
          eligibleFaculty: (c.eligibleFaculty || []).join('; '),
        }))
        downloadCSV(
          `analytics-eligibility-${new Date().toISOString().slice(0,10)}.csv`,
          rows,
          ['courseCode', 'title', 'poolSize', 'warning', 'eligibleFaculty'],
        )
        toast('Eligibility CSV downloaded', 'success')
      } else {
        toast('No data to export for this section.', 'info')
      }
    } catch {
      toast('Export failed. Try again.', 'error')
    }
  }

  const busy    = loading || switching
  const hasData = quality && quality.totalSessions > 0

  const overloadCount = workload?.workload?.filter(f => f.overloaded).length ?? 0
  const rawWarnCount  = preview?.courses
    ? deduplicateCourses(preview.courses).filter(c => c.warning && !isOtherDept(c.courseCode)).length
    : 0

  /* NEW: human-friendly "last refreshed" label */
  function fmtLastRefreshed(d) {
    if (!d) return null
    const now  = Date.now()
    const diff = Math.floor((now - d.getTime()) / 1000)
    if (diff < 5)  return 'just now'
    if (diff < 60) return `${diff}s ago`
    const mins = Math.floor(diff / 60)
    if (mins < 60) return `${mins}m ago`
    return d.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
  }

  const TABS = [
    { key: 'overview',    label: 'Overview',    count: null,                   warn: false },
    { key: 'workload',    label: 'Workload',    count: overloadCount || null,  warn: overloadCount > 0 },
    { key: 'eligibility', label: 'Eligibility', count: null,                   warn: false },
  ]

  return (
    <div className="page" style={{ fontFamily: "'Poppins',sans-serif" }}>

      {/* ── Header ── */}
      <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', marginBottom: 18, flexWrap: 'wrap', gap: 12 }}>
        <div>
          <h1 style={{ fontSize: 20, fontWeight: 700, color: '#1a1a2e', letterSpacing: '-.3px', margin: 0 }}>Analytics</h1>
          <p style={{ fontSize: 12, color: '#8883B0', marginTop: 3, display: 'flex', alignItems: 'center', gap: 6 }}>
            {hasData
              ? `${quality.totalSessions} sessions · ${quality.autoAssignPct}% auto-assigned`
              : 'Load a schedule to view metrics.'}
            {/* NEW: last refreshed timestamp */}
            {lastRefreshed && hasData && (
              <>
                <span style={{ color: '#D8D3F5' }}>·</span>
                <span style={{ color: '#C0BBDC', display: 'inline-flex', alignItems: 'center', gap: 4 }}>
                  <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="#C0BBDC" strokeWidth="2"><circle cx="12" cy="12" r="10"/><polyline points="12 6 12 12 16 14"/></svg>
                  Updated {fmtLastRefreshed(lastRefreshed)}
                </span>
              </>
            )}
          </p>
        </div>

        <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexShrink: 0 }}>
          {hasData && <AlertIconModal overloadCount={overloadCount} warnCount={rawWarnCount} />}

          {hasData && (
            <button onClick={handleRefresh} disabled={busy || refreshing}
              style={{ display: 'flex', alignItems: 'center', gap: 6, padding: '6px 12px', borderRadius: 9, border: '1px solid #E8E4F8', background: '#fff', color: '#7C6FCD', fontSize: 12.5, fontWeight: 500, fontFamily: "'Poppins',sans-serif", cursor: busy ? 'not-allowed' : 'pointer', opacity: busy ? 0.5 : 1, transition: 'all 0.15s' }}>
              <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"
                style={{ animation: refreshing ? 'spin 0.8s linear infinite' : 'none' }}>
                <path d="M23 4v6h-6"/><path d="M1 20v-6h6"/>
                <path d="M3.51 9a9 9 0 0 1 14.85-3.36L23 10M1 14l4.64 4.36A9 9 0 0 0 20.49 15"/>
              </svg>
              Refresh
            </button>
          )}

          <select value={selected ?? '__current__'} onChange={e => handleSelect(e.target.value)}
            disabled={busy || listLoading}
            style={{
              padding: '6px 30px 6px 11px', borderRadius: 9, border: '1px solid #E8E4F8',
              background: '#fff', color: '#1a1a2e', fontSize: 12.5, fontWeight: 500,
              fontFamily: "'Poppins',sans-serif", appearance: 'none',
              cursor: busy ? 'not-allowed' : 'pointer', opacity: listLoading ? 0.6 : 1, minWidth: 180,
              backgroundImage: `url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='11' height='11' viewBox='0 0 24 24' fill='none' stroke='%238883B0' stroke-width='2'%3E%3Cpolyline points='6 9 12 15 18 9'/%3E%3C/svg%3E")`,
              backgroundRepeat: 'no-repeat', backgroundPosition: 'right 9px center',
            }}>
            <option value="__current__">Current (in memory)</option>
            {savedList.map(name => <option key={name} value={name}>{name}</option>)}
          </select>

          {busy && (
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="#A99BE8" strokeWidth="2" style={{ animation: 'spin 0.8s linear infinite', flexShrink: 0 }}>
              <path d="M21 12a9 9 0 1 1-6.219-8.56"/>
            </svg>
          )}
        </div>
      </div>

      {/* Error */}
      {error && (
        <div style={{ display: 'flex', alignItems: 'center', gap: 8, justifyContent: 'space-between', padding: '7px 13px', borderRadius: 9, background: '#FFF5F5', border: '1px solid #FECACA', fontSize: 12.5, color: '#B91C1C', marginBottom: 12 }}>
          <span>{error}</span>
          <div style={{ display: 'flex', gap: 8 }}>
            <button onClick={handleRefresh} style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#B91C1C', fontWeight: 600, fontSize: 12, fontFamily: "'Poppins',sans-serif", padding: 0 }}>Retry</button>
            <button onClick={() => setError(null)} style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#B91C1C', fontWeight: 700, fontSize: 15, lineHeight: 1 }}>×</button>
          </div>
        </div>
      )}

      {loading ? (
        <SkeletonPage />
      ) : !hasData ? (
        <EmptyState
          onNavigateToScheduler={() => {
            // Replace with your router navigation if available
            // navigate('/dashboard/scheduler')
            window.location.href = '/dashboard/scheduler'
          }}
        />
      ) : (
        <>
          {/* Tabs */}
          <div style={{ display: 'flex', gap: 3, marginBottom: 18, background: '#fff', padding: '5px', borderRadius: 11, border: '1px solid #E8E4F8', boxShadow: '0 2px 6px rgba(124,111,205,0.05)', width: 'fit-content' }}>
            {TABS.map(tab => (
              <button key={tab.key} className={`a-tab${activeTab === tab.key ? ' active' : ''}${tab.warn ? ' warn' : ''}`} onClick={() => setActiveTab(tab.key)}>
                {tab.label}
                {tab.count !== null && <span className="tbadge">{tab.count}</span>}
              </button>
            ))}
          </div>

          {activeTab === 'overview'    && <OverviewSection    quality={quality}    onExport={handleExport} />}
          {activeTab === 'workload'    && <WorkloadSection    workload={workload}   onExport={handleExport} />}
          {activeTab === 'eligibility' && <EligibilitySection preview={preview}    onExport={handleExport} />}
        </>
      )}

      {/* Schedule-switching overlay */}
      {switching && (
        <div style={{ position: 'fixed', inset: 0, background: 'rgba(245,244,251,0.72)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 50, backdropFilter: 'blur(3px)' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 10, background: '#fff', padding: '12px 20px', borderRadius: 13, boxShadow: '0 8px 32px rgba(124,111,205,0.18)', border: '1px solid #E8E4F8' }}>
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="#A99BE8" strokeWidth="2" style={{ animation: 'spin 0.8s linear infinite' }}><path d="M21 12a9 9 0 1 1-6.219-8.56"/></svg>
            <span style={{ fontSize: 12.5, color: '#8883B0', fontWeight: 500 }}>Loading schedule…</span>
          </div>
        </div>
      )}

      {/* Toast notifications */}
      <ToastContainer toasts={toasts} />
    </div>
  )
}