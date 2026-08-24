import { useState, useEffect, useCallback, useRef, useMemo } from 'react'
import { useNavigate } from 'react-router-dom'
import { useAuth } from '../../hooks/useAuth'
import {
  coordCheckTurn, coordListSchedules, coordGetSettings,
  coordGetCourses, coordGetRooms, coordGetSelectedRooms, coordGetSubmittedSchedule,
  coordDuplicateSchedule, coordDeleteSchedule, coordRenameSchedule, coordUnsubmitSchedule,
} from '../../services/api'

const POLL_MS = 15000

const G = {
  meadow: '#15803D', meadowDeep: '#0F5C2C', meadowMid: '#166534',
  meadowSoft: '#DCFCE7', meadowBorder: '#BBF7D0',
  ink: '#0E2A20', inkMid: '#1C3D2A', muted: '#4B7060', muted2: '#6B8C7A',
  border: '#D8E8DF', borderLight: '#EBF4EF', bg: '#F2F7F4',
  surface: '#FFFFFF', hover: '#EBF4EF',
  amber: '#B45309', amberSoft: '#FEF3C7', amberBorder: '#FDE68A',
  red: '#DC2626', redDeep: '#B91C1C', redSoft: '#FEF2F2', redBorder: '#FECACA',
  blue: '#1D4ED8', blueSoft: '#DBEAFE', blueBorder: '#BFDBFE',
  violet: '#7C3AED', violetSoft: '#EDE9FE',
  cyan: '#0891B2', cyanSoft: '#CFFAFE',
}

const SEM_COLORS = { '1st Semester': G.meadow, '2nd Semester': G.blue, 'Midyear': G.amber }
const YEAR_COLORS = [G.meadow, G.blue, G.violet, G.amber]

const STYLE_TAG_ID = 'coord-dash-style-v10'
if (!document.getElementById(STYLE_TAG_ID)) {
  document.querySelectorAll('[id^="coord-dash-style"]').forEach(el => el.remove())
  const s = document.createElement('style')
  s.id = STYLE_TAG_ID
  s.textContent = `
    @import url('https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700;800&family=Sora:wght@600;700;800&display=swap');
    
    @keyframes spin-r { to{transform:rotate(360deg)} }
    @keyframes cpToastIn { from{opacity:0;transform:translateY(10px)} to{opacity:1;transform:translateY(0)} }
    @keyframes shimmer { 0%{background-position:-600px 0} 100%{background-position:600px 0} }
    @keyframes fadeUp { from{opacity:0;transform:translateY(8px)} to{opacity:1;transform:translateY(0)} }
    @keyframes barIn { from{width:0} }
    @keyframes pulseGlow {
      0%, 100% { box-shadow: 0 0 0 0 rgba(255, 255, 255, 0.4); }
      50%      { box-shadow: 0 0 0 8px rgba(255, 255, 255, 0); }
    }

    * { box-sizing: border-box; }
    
    .cd-skeleton { background:linear-gradient(90deg,${G.hover} 25%,${G.borderLight} 50%,${G.hover} 75%); background-size:600px 100%; animation:shimmer 1.4s ease-in-out infinite; border-radius:7px; }
    
    .cp-toast-wrap { position:fixed; bottom:24px; left:50%; z-index:9999; display:flex; flex-direction:column; gap:8px; align-items:center; pointer-events:none; transform:translateX(-50%); }
    .cp-toast { display:flex; align-items:center; gap:9px; padding:11px 18px; border-radius:10px; font-family:'Inter',sans-serif; font-size:13px; font-weight:600; animation:cpToastIn .2s ease-out; white-space:nowrap; pointer-events:auto; background:${G.ink}; color:#fff; box-shadow:0 8px 28px rgba(0,0,0,0.18); }
    .cp-toast.error { background:#fff; color:${G.redDeep}; border:1.5px solid ${G.redBorder}; }
    .cp-toast.info { background:#fff; color:${G.ink}; border:1.5px solid ${G.border}; }
    
    .d-card { background:${G.surface}; border-radius:16px; border:1px solid ${G.border}; box-shadow:0 1px 8px rgba(10,46,28,0.06); animation:fadeUp .32s ease both; overflow:hidden; }
    .d-card-hover { transition:box-shadow .18s, transform .18s; }
    .d-card-hover:hover { box-shadow:0 6px 20px rgba(10,46,28,0.08); transform:translateY(-2px); }
    
    .cd-refresh-btn { display:flex; align-items:center; gap:6px; padding:6px 12px; border-radius:8px; border:1px solid ${G.border}; background:#fff; color:${G.muted}; font-size:11.5px; font-weight:600; cursor:pointer; font-family:'Inter',sans-serif; transition:all .12s; }
    .cd-refresh-btn:hover { color:${G.meadowDeep}; background:${G.hover}; border-color:${G.meadowBorder}; }
    .cd-refresh-btn:disabled { opacity:.55; cursor:default; }
    .cd-refresh-btn.spinning svg { animation:spin-r .8s linear infinite; }
    
    .cd-sched-row { display:flex; align-items:center; gap:12px; padding:16px 20px; cursor:pointer; transition:background .12s; border-bottom:1px solid ${G.borderLight}; }
    .cd-sched-row:last-child { border-bottom:none; }
    .cd-sched-row:hover { background:${G.hover}; }
    .cd-row-actions { opacity:1; }
    
    .cd-icon-btn { width:32px; height:32px; border-radius:8px; border:1px solid ${G.border}; background:#fff; display:flex; align-items:center; justify-content:center; cursor:pointer; color:${G.muted} !important; transition:all .12s; flex-shrink:0; }
    .cd-icon-btn svg { fill:none !important; stroke:currentColor !important; display:block; flex-shrink:0; }
    .cd-icon-btn:hover { background:${G.hover}; color:${G.meadowDeep} !important; border-color:${G.meadowBorder}; }
    .cd-icon-btn.danger:hover { background:${G.redSoft}; color:${G.redDeep} !important; border-color:${G.redBorder}; }
    .cd-icon-btn:disabled { opacity:.5; cursor:default; }
    
    .cd-bell-btn { width:36px; height:36px; border-radius:10px; border:1px solid rgba(255,255,255,0.2); background:rgba(255,255,255,0.1); display:flex; align-items:center; justify-content:center; cursor:pointer; color:#fff; transition:all .12s; flex-shrink:0; backdrop-filter:blur(4px); }
    .cd-bell-btn:hover { background:rgba(255,255,255,0.2); }
    .cd-bell-btn.on { color:#fff; background:rgba(255,255,255,0.25); border-color:rgba(255,255,255,0.4); }
    .cd-bell-btn.light { border-color:${G.border}; background:#fff; color:${G.muted}; }
    .cd-bell-btn.light:hover { background:${G.hover}; }
    .cd-bell-btn.light.on { color:${G.meadowDeep}; background:${G.meadowSoft}; border-color:${G.meadowBorder}; }
    
    .cd-run-btn { display:flex; align-items:center; gap:8px; padding:12px 24px; border-radius:12px; border:none; background:${G.meadow}; color:#fff; font-size:13.5px; font-weight:700; cursor:pointer; font-family:'Inter',sans-serif; box-shadow:0 4px 14px rgba(21,128,61,0.25); transition:transform .15s, box-shadow .15s, background .15s; }
    .cd-run-btn:hover { background:${G.meadowDeep}; transform:translateY(-2px); box-shadow:0 6px 20px rgba(21,128,61,0.3); }
    
    .stat-grid { display:grid; grid-template-columns:repeat(5, 1fr); gap:12px; margin-bottom:24px; }
    @media (max-width: 1024px) { .stat-grid { grid-template-columns:repeat(3, 1fr); } }
    @media (max-width: 640px)  { .stat-grid { grid-template-columns:repeat(2, 1fr); } }
    
    .stat-card { background:#fff; border-radius:16px; border:1px solid ${G.border}; box-shadow:0 1px 8px rgba(10,46,28,0.06); padding:20px; display:flex; flex-direction:column; gap:8px; justify-content:flex-start; min-height:112px; transition:box-shadow .18s, transform .18s; position:relative; overflow:hidden; }
    .stat-card::before { content:''; position:absolute; top:0; left:0; width:4px; height:100%; background:var(--card-color); }
    .stat-card:hover { box-shadow:0 6px 16px rgba(10,46,28,0.08); transform:translateY(-2px); }
    .stat-card.feature { background:linear-gradient(180deg, #fff, ${G.hover}); border-color:var(--card-color); border-width:1.5px; }
    .stat-card.feature::before { width:6px; }
    
    .suggestion-card { border-radius:12px; padding:14px 16px; display:flex; align-items:flex-start; gap:12px; cursor:default; transition:transform .15s, box-shadow .15s; border:1px solid transparent; }
    .suggestion-card:hover { transform:translateY(-2px); box-shadow:0 6px 16px rgba(10,46,28,0.08); }
    
    .setup-row { display:flex; align-items:center; gap:16px; padding:14px 20px; cursor:default; transition:background 0.12s; }
    .setup-row:hover { background: #EBF4EF !important; }
    
    .cd-qa-card { display:flex; align-items:center; gap:16px; padding:20px; cursor:pointer; transition:all .15s; border:1px solid ${G.border}; border-radius:16px; background:#fff; box-shadow:0 2px 8px rgba(10,46,28,0.04); }
    .cd-qa-card:hover { border-color:${G.meadowBorder}; box-shadow:0 8px 24px rgba(10,46,28,0.08); transform:translateY(-2px); }
    
    .cd-section-title { font-size:15px; font-weight:800; color:${G.ink}; font-family:'Sora',sans-serif; }
    .cd-section-sub { font-size:12px; color:${G.muted2}; margin-top:2px; font-weight:500; }
    
    .cd-search-wrap { position:relative; display:flex; align-items:center; }
    .cd-search-wrap svg { position:absolute; left:12px; pointer-events:none; }
    .cd-search-input { font-family:'Inter',sans-serif; font-size:13px; font-weight:500; padding:8px 12px 8px 34px; border-radius:10px; border:1px solid ${G.border}; background:#fff; color:${G.ink}; width:200px; transition:border-color .12s, width .15s, box-shadow .15s; }
    .cd-search-input::placeholder { color:${G.muted2}; }
    .cd-search-input:focus { outline:none; border-color:${G.meadow}; width:240px; box-shadow:0 0 0 3px rgba(21,128,61,0.1); }
    
    .cd-filter-chip { font-family:'Inter',sans-serif; font-size:12px; font-weight:600; padding:6px 14px; border-radius:99px; border:1px solid ${G.border}; background:#fff; color:${G.muted}; cursor:pointer; transition:all .12s; white-space:nowrap; }
    .cd-filter-chip:hover { border-color:${G.meadowBorder}; color:${G.meadowDeep}; background:${G.hover}; }
    .cd-filter-chip.active { background:${G.meadow}; border-color:${G.meadowDeep}; color:#fff; box-shadow:0 2px 8px rgba(21,128,61,0.2); }
    
    .cd-empty-state { display:flex; flex-direction:column; align-items:center; justify-content:center; gap:12px; padding:48px 20px; text-align:center; }
    .cd-rename-input { font-family:'Inter',sans-serif; font-size:14px; font-weight:700; color:${G.ink}; padding:8px 12px; border-radius:8px; border:2px solid ${G.meadow}; outline:none; width:100%; max-width:300px; box-shadow:0 0 0 3px rgba(21,128,61,0.1); }
    .cd-sched-scroll { max-height: 336px; overflow-y: auto; }
    .cd-sched-scroll::-webkit-scrollbar { width: 8px; }
    .cd-sched-scroll::-webkit-scrollbar-track { background: transparent; }
    .cd-sched-scroll::-webkit-scrollbar-thumb { background: ${G.border}; border-radius: 99px; }
    .cd-sched-scroll::-webkit-scrollbar-thumb:hover { background: ${G.muted2}; }
    
    .cd-retry-btn { padding:6px 14px; border-radius:8px; border:1px solid ${G.redBorder}; background:#fff; color:${G.redDeep}; font-size:12px; font-weight:700; cursor:pointer; font-family:'Inter',sans-serif; flex-shrink:0; transition:background .12s; }
    .cd-retry-btn:hover { background:${G.redSoft}; }
    
    .cd-progress-ring { transform: rotate(-90deg); }
    .cd-progress-ring-circle { transition: stroke-dashoffset 0.8s cubic-bezier(0.4, 0, 0.2, 1); }
  `
  document.head.appendChild(s)
}

function Skel({ w = '100%', h = 14, r = 6, style = {} }) {
  return <div className="cd-skeleton" style={{ width: w, height: h, borderRadius: r, flexShrink: 0, ...style }} />
}

function SectionHeader({ title, sub, right }) {
  return (
    <div style={{ padding: '20px 24px', borderBottom: `1px solid ${G.borderLight}`, display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 12, background: '#fff' }}>
      <div>
        <div className="cd-section-title">{title}</div>
        {sub && <div className="cd-section-sub">{sub}</div>}
      </div>
      {right && <div style={{ flexShrink: 0 }}>{right}</div>}
    </div>
  )
}

function Badge({ label, color, bg }) {
  return (
    <span style={{ fontSize: 11.5, fontWeight: 700, padding: '4px 12px', borderRadius: 99, background: bg || G.hover, color: color || G.muted }}>
      {label}
    </span>
  )
}

function AnimatedNumber({ value, duration = 700 }) {
  const [display, setDisplay] = useState(0)
  const raf = useRef(null)
  useEffect(() => {
    if (value === '—' || value == null) { setDisplay(value); return }
    const num = parseInt(value, 10)
    if (isNaN(num)) { setDisplay(value); return }
    const start = performance.now()
    const tick = (now) => {
      const pct = Math.min(1, (now - start) / duration)
      const ease = 1 - Math.pow(1 - pct, 3)
      setDisplay(Math.round(ease * num))
      if (pct < 1) raf.current = requestAnimationFrame(tick)
    }
    raf.current = requestAnimationFrame(tick)
    return () => cancelAnimationFrame(raf.current)
  }, [value, duration])
  return <>{display}</>
}

function DonutChart({ segments, size = 130, stroke = 24, label, sublabel }) {
  const r = (size - stroke) / 2
  const circ = 2 * Math.PI * r
  const total = segments.reduce((s, x) => s + (x.value || 0), 0) || 1
  let offset = 0
  return (
    <div style={{ position: 'relative', width: size, height: size, flexShrink: 0 }}>
      <svg width={size} height={size} style={{ transform: 'rotate(-90deg)' }}>
        <circle cx={size / 2} cy={size / 2} r={r} fill="none" stroke={G.hover} strokeWidth={stroke} />
        {segments.filter(s => s.value > 0).map((seg, i) => {
          const dash = (seg.value / total) * circ
          const gap = circ - dash
          const arc = (
            <circle key={i} cx={size / 2} cy={size / 2} r={r} fill="none"
              stroke={seg.color} strokeWidth={stroke}
              strokeDasharray={`${dash} ${gap}`} strokeDashoffset={-offset}
              strokeLinecap="butt"
              style={{ transition: 'stroke-dasharray 0.9s cubic-bezier(.4,0,.15,1)' }}
            />
          )
          offset += dash
          return arc
        })}
      </svg>
      <div style={{ position: 'absolute', inset: 0, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center' }}>
        <span style={{ fontFamily: "'Sora',sans-serif", fontSize: 26, fontWeight: 800, color: G.ink, lineHeight: 1 }}>{label}</span>
        {sublabel && <span style={{ fontSize: 10, color: G.muted2, marginTop: 4, fontWeight: 700, letterSpacing: '0.5px', textTransform: 'uppercase' }}>{sublabel}</span>}
      </div>
    </div>
  )
}

function HorizBar({ label, value, pct, color }) {
  return (
    <div style={{ marginBottom: 14 }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 6 }}>
        <span style={{ fontSize: 12.5, fontWeight: 600, color: G.ink }}>{label}</span>
        <span style={{ fontSize: 12, fontWeight: 700, color }}>
          {value} <span style={{ fontWeight: 500, color: G.muted2 }}>({pct}%)</span>
        </span>
      </div>
      <div style={{ height: 10, borderRadius: 99, background: G.hover, overflow: 'hidden' }}>
        <div style={{ height: '100%', borderRadius: 99, width: `${pct}%`, background: color, animation: 'barIn .8s cubic-bezier(.4,0,.15,1) both' }} />
      </div>
    </div>
  )
}

function ReadinessRing({ percent, size = 64, stroke = 6 }) {
  const r = (size - stroke) / 2
  const circ = 2 * Math.PI * r
  const offset = circ - (percent / 100) * circ

  return (
    <div style={{ position: 'relative', width: size, height: size, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
      <svg className="cd-progress-ring" width={size} height={size}>
        <circle stroke="rgba(255,255,255,0.2)" strokeWidth={stroke} fill="transparent" r={r} cx={size / 2} cy={size / 2} />
        <circle className="cd-progress-ring-circle" stroke="#fff" strokeWidth={stroke} strokeLinecap="round" fill="transparent" r={r} cx={size / 2} cy={size / 2} strokeDasharray={`${circ} ${circ}`} strokeDashoffset={offset} />
      </svg>
      <div style={{ position: 'absolute', fontFamily: "'Sora', sans-serif", fontSize: 15, fontWeight: 800, color: '#fff' }}>
        {percent}%
      </div>
    </div>
  )
}

function SetupChecklist({ steps, onNavigate, loading }) {
  const [open, setOpen] = useState(false)

  if (loading) {
    return (
      <div className="d-card" style={{ padding: '16px 20px', display: 'flex', alignItems: 'center', gap: 14, marginBottom: 24 }}>
        <Skel w={34} h={34} r={99} />
        <Skel w={240} h={14} r={4} />
      </div>
    )
  }

  const total = steps.length
  const doneCount = steps.filter(s => s.done).length
  const nextIdx = steps.findIndex(s => !s.done)
  const allDone = nextIdx === -1

  if (allDone) return null;

  return (
    <div className="d-card" style={{ overflow: 'hidden', marginBottom: 24 }}>
      <div onClick={() => setOpen(o => !o)}
        style={{ display: 'flex', alignItems: 'center', gap: 16, padding: '16px 24px', cursor: 'pointer', background: '#fff', borderBottom: open ? `1px solid ${G.meadowSoft}` : 'none' }}>
        <div style={{ width: 36, height: 36, borderRadius: '50%', flexShrink: 0, background: G.meadowSoft, color: G.meadowDeep, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 13, fontWeight: 800, fontFamily: "'Sora',sans-serif" }}>
          {doneCount}/{total}
        </div>
        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={{ fontSize: 15, fontWeight: 800, color: G.ink, fontFamily: "'Sora',sans-serif" }}>Setup Checklist</div>
          <div style={{ fontSize: 12.5, color: G.meadowDeep, fontWeight: 600, marginTop: 2 }}>
            {open ? 'Click to collapse' : `Next Action: ${steps[nextIdx]?.title}`}
          </div>
        </div>
        <div style={{ width: 100, height: 6, borderRadius: 99, background: G.meadowBorder, overflow: 'hidden', flexShrink: 0, marginRight: 12 }}>
          <div style={{ height: '100%', borderRadius: 99, width: `${(doneCount / total) * 100}%`, background: G.meadow, transition: 'width .4s ease' }} />
        </div>
        <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke={G.meadow} strokeWidth="2.5"
          style={{ transform: open ? 'rotate(180deg)' : 'none', transition: 'transform .2s', flexShrink: 0 }}>
          <polyline points="6 9 12 15 18 9" />
        </svg>
      </div>

      {open && (
        <div style={{ background: '#fff' }}>
          {steps.map((step, i) => (
            <div key={step.title} className="setup-row"
              style={{ borderTop: i > 0 ? `1px solid ${G.borderLight}` : 'none', background: step.done ? '#F8FBF9' : i === nextIdx ? '#F0FDF4' : '#fff' }}>
              <div style={{
                width: 28, height: 28, borderRadius: '50%', flexShrink: 0,
                display: 'flex', alignItems: 'center', justifyContent: 'center',
                fontSize: 12, fontWeight: 800, fontFamily: "'Sora',sans-serif",
                background: step.done ? G.meadow : i === nextIdx ? G.meadowSoft : G.hover,
                color: step.done ? '#fff' : i === nextIdx ? G.meadowDeep : G.muted2,
                border: i === nextIdx && !step.done ? `2px solid ${G.meadow}` : '2px solid transparent',
              }}>
                {step.done
                  ? <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3"><polyline points="20 6 9 17 4 12" /></svg>
                  : i + 1}
              </div>
              <div style={{ flex: 1, minWidth: 0 }}>
                <div style={{ fontSize: 14, fontWeight: 700, color: step.done ? G.muted2 : G.ink, marginBottom: 3, textDecoration: step.done ? 'line-through' : 'none' }}>
                  {step.title}
                </div>
                <div style={{ fontSize: 12.5, color: G.muted, lineHeight: 1.5 }}>{step.desc}</div>
              </div>
              {!step.done && (
                <button
                  onClick={(e) => { e.stopPropagation(); onNavigate(step.href) }}
                  style={{ flexShrink: 0, padding: '8px 16px', borderRadius: 10, border: 'none', background: G.meadow, color: '#fff', fontSize: 12.5, fontWeight: 600, cursor: 'pointer', fontFamily: "'Inter',sans-serif", whiteSpace: 'nowrap', boxShadow: '0 2px 8px rgba(21,128,61,0.2)' }}
                  onMouseEnter={e => e.currentTarget.style.background = G.meadowDeep}
                  onMouseLeave={e => e.currentTarget.style.background = G.meadow}
                >
                  {step.cta} →
                </button>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  )
}

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
    success: <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"><polyline points="20 6 9 17 4 12"/></svg>,
    error: <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"><circle cx="12" cy="12" r="10"/><line x1="12" y1="8" x2="12" y2="12"/></svg>,
    info: <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"><circle cx="12" cy="12" r="10"/><path d="M12 8v4"/></svg>,
  }
  return (
    <div className="cp-toast-wrap">
      {toasts.map(t => <div key={t.id} className={`cp-toast ${t.type}`}>{icons[t.type]}{t.message}</div>)}
    </div>
  )
}

const STATUS_META = {
  waiting:    { label: 'Waiting',    color: G.muted2 },
  active:     { label: 'Active',     color: G.meadowDeep },
  generating: { label: 'Generating', color: G.blue },
  submitted:  { label: 'Submitted',  color: G.amber },
  approved:   { label: 'Approved',   color: G.meadowDeep },
  skipped:    { label: 'Skipped',    color: '#C2410C' },
}

function fmt12(h) {
  if (h === 0) return '12:00 AM'
  if (h < 12) return `${h}:00 AM`
  if (h === 12) return '12:00 PM'
  return `${h - 12}:00 PM`
}

function SCHED_META(status) {
  const map = {
    draft:     { label: 'Draft',     color: G.muted,      bg: G.hover },
    submitted: { label: 'Submitted', color: G.amber,      bg: G.amberSoft },
    approved:  { label: 'Approved',  color: G.meadowDeep, bg: G.meadowSoft },
  }
  return map[status] || map.draft
}

function courseIssue(c) {
  const totalUnits = (c.unitsLecture || 0) + (c.unitsLab || 0)
  if (!c.blocks || c.blocks < 1) return 'No sections defined'
  if (totalUnits === 0) return 'No units assigned'
  return null
}

function QueueLedger({ queue }) {
  if (!queue || queue.length === 0) return null
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
      {queue.map((item, i) => {
        const prog = typeof item === 'string' ? item : item.program
        const status = typeof item === 'string' ? 'waiting' : (item.status || 'waiting')
        const meta = STATUS_META[status] || STATUS_META.waiting
        return (
          <div key={`${prog}-${i}`} style={{ display: 'flex', alignItems: 'center', gap: 14, padding: '10px 14px', borderRadius: 10, background: status === 'active' ? G.meadowSoft : 'transparent', border: status === 'active' ? `1px solid ${G.meadowBorder}` : '1px solid transparent' }}>
            <span style={{ width: 24, fontSize: 12, fontWeight: 800, color: status === 'active' ? G.meadowDeep : G.muted2, textAlign: 'right' }}>{i + 1}</span>
            <span style={{ flex: 1, fontSize: 13.5, fontWeight: status === 'active' ? 800 : 600, color: status === 'active' ? G.meadowDeep : G.ink }}>{prog}</span>
            <span style={{ fontSize: 12.5, fontWeight: 700, color: meta.color }}>{meta.label}</span>
          </div>
        )
      })}
    </div>
  )
}

function NotifyBell({ permission, onRequest, light }) {
  if (permission === 'unsupported') return null
  const title = permission === 'granted' ? 'Turn alerts are on'
    : permission === 'denied' ? 'Turn alerts are blocked — enable notifications for this site in your browser'
    : 'Turn on alerts for when your turn opens up'
  return (
    <button className={`cd-bell-btn${light ? ' light' : ''}${permission === 'granted' ? ' on' : ''}`} title={title} onClick={onRequest} disabled={permission !== 'default'}>
      {permission === 'denied' ? (
        <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M13.73 21a2 2 0 0 1-3.46 0"/><path d="M18.63 13A17.89 17.89 0 0 1 18 8"/><path d="M6.26 6.26A5.86 5.86 0 0 0 6 8c0 7-3 9-3 9h14"/><path d="M18 8a6 6 0 0 0-9.33-5"/><line x1="1" y1="1" x2="23" y2="23"/></svg>
      ) : (
        <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M18 8a6 6 0 0 0-12 0c0 7-3 9-3 9h18s-3-2-3-9"/><path d="M13.73 21a2 2 0 0 1-3.46 0"/></svg>
      )}
    </button>
  )
}

const SUGGESTION_STYLES = {
  error:   { bg: G.redSoft,    border: G.redBorder,    icon: G.redDeep,    chip: '#FECACA', dot: '#EF4444', label: 'Critical' },
  warning: { bg: G.amberSoft,  border: G.amberBorder,  icon: G.amber,      chip: '#FDE68A', dot: '#F59E0B', label: 'Warning'  },
  info:    { bg: G.blueSoft,   border: G.blueBorder,   icon: G.blue,       chip: '#BFDBFE', dot: '#3B82F6', label: 'Info'     },
  success: { bg: G.meadowSoft, border: G.meadowBorder, icon: G.meadowDeep, chip: '#BBF7D0', dot: '#22C55E', label: 'Good'     },
}
const SUGGESTION_ICONS = {
  error:   <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"><circle cx="12" cy="12" r="10"/><line x1="12" y1="8" x2="12" y2="12"/><line x1="12" y1="16" x2="12.01" y2="16"/></svg>,
  warning: <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"><path d="M10.29 3.86L1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z"/><line x1="12" y1="9" x2="12" y2="13"/><line x1="12" y1="17" x2="12.01" y2="17"/></svg>,
  info:    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"><circle cx="12" cy="12" r="10"/><line x1="12" y1="16" x2="12" y2="12"/><line x1="12" y1="8" x2="12.01" y2="8"/></svg>,
  success: <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"><polyline points="20 6 9 17 4 12"/></svg>,
}

function SuggestionCard({ suggestion, navigate, delay = 0 }) {
  const s = SUGGESTION_STYLES[suggestion.type] || SUGGESTION_STYLES.info
  return (
    <div className="suggestion-card" style={{ background: s.bg, borderColor: s.border, animationDelay: `${delay}s` }}>
      <div style={{ width: 36, height: 36, borderRadius: 10, background: s.chip, color: s.icon, display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0, marginTop: 2 }}>
        {SUGGESTION_ICONS[suggestion.type]}
      </div>
      <div style={{ flex: 1, minWidth: 0 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 4 }}>
          <span style={{ fontSize: 13.5, fontWeight: 800, color: G.ink }}>{suggestion.title}</span>
          <span style={{ fontSize: 10.5, fontWeight: 800, padding: '2px 8px', borderRadius: 99, background: s.dot, color: '#fff' }}>{s.label}</span>
        </div>
        <p style={{ fontSize: 12.5, color: G.muted, margin: 0, lineHeight: 1.5 }}>{suggestion.body}</p>
        {suggestion.action && (
          <button onClick={() => navigate(suggestion.action.href)}
            style={{ marginTop: 10, padding: '6px 14px', borderRadius: 8, border: 'none', fontSize: 11.5, fontWeight: 700, cursor: 'pointer', fontFamily: 'Inter,sans-serif',
              background: s.icon, color: '#fff', transition: 'opacity .15s' }}
            onMouseEnter={e => e.currentTarget.style.opacity = '.85'}
            onMouseLeave={e => e.currentTarget.style.opacity = '1'}>
            {suggestion.action.label} →
          </button>
        )}
      </div>
    </div>
  )
}

const QUICK_ACTIONS = [
  { label: 'Generate Schedule', desc: 'Run the solver for your program', href: '/coordinator/scheduler', color: G.meadow, bg: G.meadowSoft,
    icon: <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"><polygon points="5 3 19 12 5 21 5 3"/></svg> },
  { label: 'My Courses', desc: 'View and edit course info', href: '/coordinator/courses', color: G.blue, bg: G.blueSoft,
    icon: <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"><path d="M4 19.5A2.5 2.5 0 0 1 6.5 17H20"/><path d="M6.5 2H20v20H6.5A2.5 2.5 0 0 1 4 19.5v-15A2.5 2.5 0 0 1 6.5 2z"/></svg> },
  { label: 'Room Selection', desc: 'Pick rooms for your program', href: '/coordinator/rooms', color: G.violet, bg: G.violetSoft,
    icon: <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"><path d="M3 21h18"/><path d="M5 21V7l8-4v18"/><path d="M19 21V11l-6-4"/><path d="M9 9v.01M9 12v.01M9 15v.01M9 18v.01"/></svg> },
  { label: 'My Schedules', desc: 'View saved and submitted', href: '/coordinator/schedules', color: G.amber, bg: G.amberSoft,
    icon: <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"><rect x="3" y="4" width="18" height="18" rx="2"/><line x1="16" y1="2" x2="16" y2="6"/><line x1="8" y1="2" x2="8" y2="6"/><line x1="3" y1="10" x2="21" y2="10"/></svg> },
]

export default function CoordDashboard() {
  const { coordinatorProgram } = useAuth()
  const navigate = useNavigate()
  const { toasts, toast } = useToast()

  const [turnData, setTurnData] = useState(null)
  const [schedules, setSchedules] = useState([])
  const [settings, setSettings] = useState(null)
  const [courses, setCourses] = useState([])
  const [rooms, setRooms] = useState({ lecture: [], lab: [] })
  const [allRooms, setAllRooms] = useState({ lecture: [], lab: [] })
  const [masterInfo, setMasterInfo] = useState(null)
  const [loading, setLoading] = useState(true)
  const [refreshing, setRefreshing] = useState(false)
  const [lastUpdated, setLastUpdated] = useState(null)
  const [error, setError] = useState(null)
  const [notifPerm, setNotifPerm] = useState(() => (typeof Notification !== 'undefined' ? Notification.permission : 'unsupported'))
  const [rowBusyId, setRowBusyId] = useState(null)
  const [confirmDeleteId, setConfirmDeleteId] = useState(null)
  const [renameId, setRenameId] = useState(null)
  const [renameTmp, setRenameTmp] = useState('')
  const [schedSearch, setSchedSearch] = useState('')
  const [schedFilter, setSchedFilter] = useState('all')
  const wasMyTurn = useRef(false)

  useEffect(() => {
    if (!confirmDeleteId && !renameId) return
    const onKey = (e) => {
      if (e.key !== 'Escape') return
      setConfirmDeleteId(null)
      setRenameId(null)
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [confirmDeleteId, renameId])

  const hr = new Date().getHours()
  const greeting = hr < 12 ? 'Good morning' : hr < 17 ? 'Good afternoon' : 'Good evening'

  const load = useCallback(async (silent = false) => {
    if (silent) setRefreshing(true)
    try {
      const [turn, scheds, sett, crs, selRooms, allR] = await Promise.all([
        coordCheckTurn().catch(() => null),
        coordListSchedules().catch(() => []),
        coordGetSettings().catch(() => null),
        coordGetCourses().catch(() => []),
        coordGetSelectedRooms().catch(() => ({ lecture: [], lab: [] })),
        coordGetRooms().catch(() => ({ lecture: [], lab: [] })),
      ])
      setTurnData(turn)
      setSchedules(Array.isArray(scheds) ? scheds : [])
      setSettings(sett)
      setCourses(Array.isArray(crs) ? crs : [])
      setRooms({ lecture: selRooms?.lecture || [], lab: selRooms?.lab || [] })
      setAllRooms({ lecture: allR?.lecture || [], lab: allR?.lab || [] })
      setLastUpdated(new Date())
      setError(null)

      if (turn?.queueId) {
        coordGetSubmittedSchedule().then(setMasterInfo).catch(() => setMasterInfo(null))
      } else {
        setMasterInfo(null)
      }

      if (turn?.isMyTurn && !wasMyTurn.current) {
        toast("It's your turn — you can generate your schedule now!", 'success', 5000)
        if (typeof Notification !== 'undefined' && Notification.permission === 'granted') {
          try { new Notification("It's your turn to schedule", { body: 'Your program is now active in the queue.' }) } catch {}
        }
      }
      wasMyTurn.current = !!turn?.isMyTurn
    } catch (err) {
      if (!silent) {
        setError({ title: 'Failed to load dashboard', message: err?.response?.data?.detail || err.message || 'Server unreachable.' })
        toast('Failed to load dashboard data', 'error')
      }
    } finally {
      setLoading(false)
      setRefreshing(false)
    }
  }, [toast])

  useEffect(() => {
    load()
    const interval = setInterval(() => load(true), POLL_MS)
    return () => clearInterval(interval)
  }, [load])

  const requestNotifPermission = useCallback(() => {
    if (typeof Notification === 'undefined' || Notification.permission !== 'default') return
    Notification.requestPermission().then(p => {
      setNotifPerm(p)
      if (p === 'granted') toast('Turn alerts are on', 'success')
    }).catch(() => {})
  }, [toast])

  const handleDuplicate = useCallback(async (id) => {
    setRowBusyId(id)
    try {
      await coordDuplicateSchedule(id, {})
      toast('Schedule duplicated', 'success')
      await load(true)
    } catch {
      toast('Could not duplicate that schedule', 'error')
    } finally {
      setRowBusyId(null)
    }
  }, [toast, load])

  const handleDelete = useCallback(async (id) => {
    setRowBusyId(id)
    try {
      await coordDeleteSchedule(id)
      toast('Schedule deleted', 'success')
      setConfirmDeleteId(null)
      await load(true)
    } catch {
      toast('Could not delete that schedule', 'error')
    } finally {
      setRowBusyId(null)
    }
  }, [toast, load])

  const handleRename = useCallback(async (id) => {
    const name = renameTmp.trim()
    if (!name) return
    setRowBusyId(id)
    try {
      await coordRenameSchedule(id, { name })
      setSchedules(prev => prev.map(s => s.id === id ? { ...s, name } : s))
      setRenameId(null)
      toast('Schedule renamed', 'success')
    } catch {
      toast('Could not rename that schedule', 'error')
    } finally {
      setRowBusyId(null)
    }
  }, [toast, renameTmp])

  const handleUnsubmit = useCallback(async (id) => {
    setRowBusyId(id)
    try {
      await coordUnsubmitSchedule(id)
      toast('Schedule recalled to draft', 'success')
      await load(true)
    } catch {
      toast('Could not recall that schedule', 'error')
    } finally {
      setRowBusyId(null)
    }
  }, [toast, load])

  const drafts = schedules.filter(s => s.status === 'draft').length
  const submitted = schedules.filter(s => s.status === 'submitted').length
  const approved = schedules.filter(s => s.status === 'approved').length

  const isMyTurn = turnData?.isMyTurn
  const currentProg = turnData?.currentProgram
  const myPos = turnData?.myPosition
  const qLen = turnData?.queueLength
  const queueList = turnData?.queue || []
  const hasQueue = turnData?.queueId != null

  const activeDays = settings?.days || []
  const startH = settings?.start_time ?? 7
  const endH = settings?.end_time ?? 21
  const slots = (endH - startH) * 2
  const daysShort = activeDays.map(d => d.slice(0, 3)).join('–') || '—'

  const courseCount = courses.length
  const labCourseCount = courses.filter(c => (c.unitsLab || 0) > 0).length
  const lecOnlyCount = courseCount - labCourseCount
  const lectureRoomCount = rooms.lecture?.length || 0
  const labRoomCount = rooms.lab?.length || 0
  const roomsSelectedCount = lectureRoomCount + labRoomCount

  const approvedInQueue = masterInfo?.approvedPrograms?.length ?? 0
  const totalInQueue = queueList.length

  const hasSubmittedAny = schedules.some(s => s.status === 'submitted' || s.status === 'approved')
  const setupSteps = [
    { title: 'Add your courses', desc: `${courseCount} course${courseCount === 1 ? '' : 's'} on file`, done: courseCount > 0, cta: 'Go to Courses', href: '/coordinator/courses' },
    { title: 'Select your rooms', desc: `${roomsSelectedCount} room${roomsSelectedCount === 1 ? '' : 's'} selected`, done: roomsSelectedCount > 0, cta: 'Go to Rooms', href: '/coordinator/rooms' },
    { title: 'Generate & submit a schedule', desc: hasSubmittedAny ? 'Submitted for approval' : "Run the solver when it's your turn", done: hasSubmittedAny, cta: 'Go to Scheduler', href: '/coordinator/scheduler' },
  ]
  const readinessPct = Math.round((setupSteps.filter(s => s.done).length / setupSteps.length) * 100)

  const courseStats = useMemo(() => {
    const bySemester = { '1st Semester': 0, '2nd Semester': 0, 'Midyear': 0 }
    const byYear = {}
    let totalUnits = 0
    let issues = 0
    courses.forEach(c => {
      const sem = c.semester || '1st Semester'
      bySemester[sem] = (bySemester[sem] || 0) + 1
      const yr = String(c.yearLevel || '—')
      byYear[yr] = (byYear[yr] || 0) + 1
      totalUnits += (c.unitsLecture || 0) + (c.unitsLab || 0)
      if (courseIssue(c)) issues += 1
    })
    return { bySemester, byYear, totalUnits, issues }
  }, [courses])

  const semTotal = Object.values(courseStats.bySemester).reduce((a, b) => a + b, 0) || 1

  const roomCoverage = useMemo(() => {
    const totalLecture = allRooms.lecture?.length || 0
    const totalLab = allRooms.lab?.length || 0
    return {
      totalLecture, totalLab,
      pctLecture: totalLecture > 0 ? Math.round((lectureRoomCount / totalLecture) * 100) : 0,
      pctLab: totalLab > 0 ? Math.round((labRoomCount / totalLab) * 100) : 0,
    }
  }, [allRooms, lectureRoomCount, labRoomCount])

  const filteredSchedules = useMemo(() => {
    const q = schedSearch.trim().toLowerCase()
    return schedules.filter(s => {
      if (schedFilter !== 'all' && s.status !== schedFilter) return false
      if (!q) return true
      const name = (s.name || `${s.semester || 'Schedule'} ${s.academicYear || ''}`).toLowerCase()
      return name.includes(q)
    })
  }, [schedules, schedSearch, schedFilter])
  
  const schedStatusCounts = { draft: drafts, submitted, approved }
  const pinnedSchedule = schedules.find(s => s.status === 'approved') || schedules.find(s => s.status === 'submitted')

  const suggestions = useMemo(() => {
    if (loading) return []
    const out = []

    if (courseCount === 0) {
      out.push({ id: 'no-courses', type: 'info', title: 'No courses added yet', body: "Add your program's courses so they can be picked up by the solver.", action: { label: 'Add Courses', href: '/coordinator/courses' } })
    } else if (courseStats.issues > 0) {
      out.push({ id: 'issues', type: 'warning', title: `${courseStats.issues} course${courseStats.issues === 1 ? '' : 's'} need${courseStats.issues === 1 ? 's' : ''} attention`, body: 'Missing units or section counts — the solver may skip these.', action: { label: 'Review Courses', href: '/coordinator/courses' } })
    }

    if (courseCount > 0 && roomsSelectedCount === 0) {
      out.push({ id: 'no-rooms', type: 'error', title: 'No rooms selected', body: 'Pick which rooms your program can use before generating a schedule.', action: { label: 'Select Rooms', href: '/coordinator/rooms' } })
    } else {
      if (labCourseCount > 0 && labRoomCount === 0) {
        out.push({ id: 'no-lab-rooms', type: 'warning', title: 'No lab rooms selected', body: `You have ${labCourseCount} course${labCourseCount === 1 ? '' : 's'} with lab units but no lab room chosen.`, action: { label: 'Select Rooms', href: '/coordinator/rooms' } })
      }
      if (lecOnlyCount > 0 && lectureRoomCount === 0) {
        out.push({ id: 'no-lec-rooms', type: 'warning', title: 'No lecture rooms selected', body: 'Lecture sections need at least one lecture room to be scheduled.', action: { label: 'Select Rooms', href: '/coordinator/rooms' } })
      }
    }

    if (hasQueue && isMyTurn && drafts === 0 && submitted === 0 && approved === 0) {
      out.push({ id: 'my-turn', type: 'success', title: "It's your turn", body: 'Your program is active in the queue — generate a schedule now.', action: { label: 'Go to Scheduler', href: '/coordinator/scheduler' } })
    }

    if (drafts > 0 && submitted === 0 && approved === 0) {
      out.push({ id: 'unsubmitted', type: 'warning', title: `${drafts} unsubmitted draft${drafts === 1 ? '' : 's'}`, body: "A draft schedule isn't visible to the admin until you submit it for approval.", action: { label: 'Go to My Schedules', href: '/coordinator/schedules' } })
    }

    if (out.length === 0 && courseCount > 0) {
      out.push({ id: 'all-good', type: 'success', title: 'Everything looks ready', body: 'Courses and rooms are set up with no open issues.' })
    }
    return out
  }, [loading, courseCount, courseStats.issues, roomsSelectedCount, labCourseCount, labRoomCount, lecOnlyCount, lectureRoomCount, hasQueue, isMyTurn, drafts, submitted, approved])

  const topSuggestion = suggestions.length > 0 ? suggestions[0] : null;

  // Queue Position now leads the row (widest card) since it's the single most
  // action-relevant number on the page — everything else is supporting context.
  const STAT_CARDS = [
    {
      label: 'Queue Position', color: isMyTurn ? G.meadow : G.amber, feature: true,
      value: loading ? null : (!hasQueue ? '—' : (isMyTurn ? 'Now' : (myPos ?? '—'))),
      sub: !hasQueue ? 'No active queue' : isMyTurn ? 'Your turn is open' : `of ${qLen} programs`,
      style: { '--card-color': isMyTurn ? G.meadow : G.amber }
    },
    {
      label: 'Courses', color: G.meadow,
      value: loading ? null : courseCount,
      sub: courseCount > 0 ? `${lecOnlyCount} lecture · ${labCourseCount} lab` : null,
    },
    {
      label: 'Rooms Selected', color: G.blue,
      value: loading ? null : roomsSelectedCount,
      sub: roomsSelectedCount > 0 ? `${lectureRoomCount} lecture · ${labRoomCount} lab` : null,
    },
    {
      label: 'Schedules', color: G.violet,
      value: loading ? null : schedules.length,
      sub: schedules.length > 0 ? `${drafts} draft · ${submitted} sub · ${approved} appr` : null,
    },
    {
      label: 'Scheduling Window', color: G.cyan,
      value: loading ? null : (activeDays.length ? `${activeDays.length} days/wk` : '—'),
      sub: activeDays.length > 0 ? `${daysShort} · ${fmt12(startH)}–${fmt12(endH)}` : null,
    },
  ]

  return (
    <div style={{ padding: '32px 40px 60px', fontFamily: "'Inter',sans-serif", display: 'flex', flexDirection: 'column', background: G.bg, minHeight: '100%', maxWidth: 1600, margin: '0 auto', width: '100%' }}>

      {/* ── Page Header ── */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 20, flexWrap: 'wrap', marginBottom: 24 }}>
        <div style={{ flex: 1, minWidth: 260 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
            <h1 style={{ fontSize: 26, fontWeight: 800, fontFamily: "'Sora',sans-serif", margin: 0, lineHeight: 1.2, color: G.ink }}>
              {greeting}.
            </h1>
            {!loading && <NotifyBell permission={notifPerm} onRequest={requestNotifPermission} light />}
          </div>
          <div style={{ fontSize: 13, fontWeight: 600, color: G.muted, marginTop: 4 }}>{coordinatorProgram} Coordinator</div>
        </div>
        <button className="cd-run-btn cd-run-btn-solid" onClick={() => navigate('/coordinator/scheduler')}>
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"><polygon points="5 3 19 12 5 21 5 3"/></svg>
          Go to Scheduler
        </button>
      </div>

      {/* Next Best Action — only surfaces once setup is done; during onboarding
          the Setup Checklist owns "what's next" to avoid two competing CTAs */}
      {!loading && readinessPct === 100 && topSuggestion && (
        <div style={{ marginBottom: 24, padding: '10px 16px', background: G.meadowSoft, border: `1px solid ${G.meadowBorder}`, borderRadius: 12, display: 'flex', alignItems: 'center', gap: 12, flexWrap: 'wrap' }}>
          <div style={{ width: 26, height: 26, borderRadius: 7, background: G.meadow, color: '#fff', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"><polyline points="20 6 9 17 4 12"/></svg>
          </div>
          <div style={{ flex: 1, minWidth: 200, fontSize: 13, lineHeight: 1.5 }}>
            <span style={{ fontWeight: 800, color: G.meadowDeep, textTransform: 'uppercase', letterSpacing: '0.4px', fontSize: 11 }}>Next step </span>
            <span style={{ fontWeight: 700, color: G.ink }}>{topSuggestion.title}</span>
            <span style={{ color: G.muted }}> — {topSuggestion.body}</span>
          </div>
          {topSuggestion.action && (
            <button onClick={() => navigate(topSuggestion.action.href)} style={{ flexShrink: 0, padding: '7px 16px', borderRadius: 8, background: G.meadow, color: '#fff', border: 'none', fontSize: 12.5, fontWeight: 700, cursor: 'pointer', boxShadow: '0 2px 8px rgba(21,128,61,0.2)' }}>
              {topSuggestion.action.label}
            </button>
          )}
        </div>
      )}

      {error && (
        <div style={{ display: 'flex', alignItems: 'center', gap: 12, padding: '14px 20px', borderRadius: 12, background: G.redSoft, border: `1px solid ${G.redBorder}`, marginBottom: 24 }}>
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke={G.redDeep} strokeWidth="2.5"><circle cx="12" cy="12" r="10"/><line x1="12" y1="8" x2="12" y2="12"/><line x1="12" y1="16" x2="12.01" y2="16"/></svg>
          <span style={{ fontSize: 13.5, color: G.redDeep, flex: 1 }}><b>{error.title}</b> — {error.message}</span>
          <button className="cd-retry-btn" onClick={() => load()}>Retry</button>
          <button onClick={() => setError(null)} style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#EF9999', padding: 4 }}>
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg>
          </button>
        </div>
      )}

      {/* ── Primary Stat Cards ── */}
      <div className="stat-grid">
        {STAT_CARDS.map(c => (
          <div key={c.label} className={`stat-card${c.feature ? ' feature' : ''}`} style={c.style || { '--card-color': c.color }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
              <span style={{ width: 8, height: 8, borderRadius: '50%', background: c.color, flexShrink: 0 }} />
              <span style={{ fontSize: 11.5, fontWeight: 700, color: G.muted2, letterSpacing: '.5px', textTransform: 'uppercase', lineHeight: 1.3 }}>{c.label}</span>
            </div>
            {loading
              ? <Skel w={64} h={36} r={8} />
              : <div style={{ fontSize: c.feature ? 44 : 30, fontWeight: 800, color: G.ink, lineHeight: 1.1, fontFamily: "'Sora',sans-serif", letterSpacing: '-1px', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                  <AnimatedNumber value={c.value} />
                </div>
            }
            {loading
              ? <Skel w="80%" h={12} r={4} />
              : c.sub
                ? <div style={{ fontSize: 12, color: c.subColor || G.muted, fontWeight: 500, lineHeight: 1.4, overflow: 'hidden', textOverflow: 'ellipsis', display: '-webkit-box', WebkitLineClamp: 2, WebkitBoxOrient: 'vertical' }}>{c.sub}</div>
                : <div style={{ height: 12 }} />
            }
          </div>
        ))}
      </div>

      <SetupChecklist steps={setupSteps} onNavigate={navigate} loading={loading} />

      <div style={{ display: 'grid', gridTemplateColumns: '2fr 1fr', gap: 24, marginBottom: 24, alignItems: 'start' }}>
        
        {/* ── Left Column: Schedules & Insights ── */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: 24 }}>
          
          {/* Pinned Active Schedule */}
          {!loading && pinnedSchedule && (
             <div className="d-card" style={{ border: `2px solid ${pinnedSchedule.status === 'approved' ? G.meadowBorder : G.amberBorder}`, overflow: 'visible' }}>
               <div style={{ background: pinnedSchedule.status === 'approved' ? G.meadowSoft : G.amberSoft, padding: '12px 24px', display: 'flex', alignItems: 'center', gap: 10, borderBottom: `1px solid ${pinnedSchedule.status === 'approved' ? G.meadowBorder : G.amberBorder}` }}>
                  <div style={{ width: 24, height: 24, borderRadius: 6, background: pinnedSchedule.status === 'approved' ? G.meadow : G.amber, color: '#fff', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"><circle cx="12" cy="12" r="10"/><path d="M12 8v4l3 3"/></svg>
                  </div>
                  <span style={{ fontSize: 13, fontWeight: 700, color: pinnedSchedule.status === 'approved' ? G.meadowDeep : '#92400E', textTransform: 'uppercase', letterSpacing: '0.5px' }}>
                    Active Submission
                  </span>
               </div>
               <div style={{ padding: '24px', display: 'flex', alignItems: 'center', justifyContent: 'space-between', background: '#fff' }}>
                  <div>
                    <div style={{ fontSize: 18, fontWeight: 800, color: G.ink, marginBottom: 4 }}>{pinnedSchedule.name || 'Unnamed Schedule'}</div>
                    <div style={{ fontSize: 13, color: G.muted }}>Last updated {pinnedSchedule.updatedAt || 'recently'}</div>
                  </div>
                  <div style={{ display: 'flex', gap: 12 }}>
                    <button onClick={() => navigate('/coordinator/schedules', { state: { scheduleId: pinnedSchedule.id } })} style={{ padding: '10px 20px', borderRadius: 8, background: '#fff', border: `1px solid ${G.border}`, fontSize: 13, fontWeight: 700, color: G.ink, cursor: 'pointer', boxShadow: '0 2px 4px rgba(0,0,0,0.02)' }}>View Schedule</button>
                    {pinnedSchedule.status === 'submitted' && (
                      <button onClick={() => handleUnsubmit(pinnedSchedule.id)} disabled={rowBusyId === pinnedSchedule.id} style={{ padding: '10px 20px', borderRadius: 8, background: G.hover, border: 'none', fontSize: 13, fontWeight: 700, color: G.ink, cursor: 'pointer' }}>Recall to Draft</button>
                    )}
                  </div>
               </div>
             </div>
          )}

          {/* Recent Schedules */}
          {!loading && schedules.length > 0 && (
            <div className="d-card">
              <SectionHeader
                title="Recent Schedules"
                sub={`${schedules.length} total · ${drafts} draft · ${submitted} submitted · ${approved} approved`}
                right={
                  <button onClick={() => navigate('/coordinator/schedules')} style={{ fontSize: 13.5, fontWeight: 700, color: G.meadowDeep, cursor: 'pointer', background: 'none', border: 'none', padding: 0, fontFamily: "'Inter',sans-serif" }}>View all →</button>
                }
              />

              {schedules.length > 4 && (
                <div style={{ display: 'flex', alignItems: 'center', gap: 12, padding: '16px 24px', borderBottom: `1px solid ${G.borderLight}`, flexWrap: 'wrap', background: '#FAFAFA' }}>
                  <div className="cd-search-wrap">
                    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke={G.muted2} strokeWidth="2.5"><circle cx="11" cy="11" r="8"/><line x1="21" y1="21" x2="16.65" y2="16.65"/></svg>
                    <input
                      className="cd-search-input"
                      placeholder="Search schedules…"
                      value={schedSearch}
                      onChange={e => setSchedSearch(e.target.value)}
                    />
                  </div>
                  <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
                    {['all', 'draft', 'submitted', 'approved'].map(f => (
                      <button key={f} className={`cd-filter-chip${schedFilter === f ? ' active' : ''}`} onClick={() => setSchedFilter(f)}>
                        {f === 'all' ? `All (${schedules.length})` : `${SCHED_META(f).label} (${schedStatusCounts[f] || 0})`}
                      </button>
                    ))}
                  </div>
                </div>
              )}

              {filteredSchedules.length === 0 ? (
                <div className="cd-empty-state">
                  <div style={{ width: 44, height: 44, borderRadius: '50%', background: G.hover, display: 'flex', alignItems: 'center', justifyContent: 'center', color: G.muted2, marginBottom: 8 }}>
                    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><circle cx="11" cy="11" r="8"/><line x1="21" y1="21" x2="16.65" y2="16.65"/></svg>
                  </div>
                  <div style={{ fontSize: 14, color: G.muted, fontWeight: 600 }}>No schedules match “{schedSearch || SCHED_META(schedFilter).label}”.</div>
                  <button className="cd-icon-btn" style={{ width: 'auto', padding: '8px 16px', fontSize: 12.5, fontWeight: 700 }} onClick={() => { setSchedSearch(''); setSchedFilter('all') }}>Clear filters</button>
                </div>
              ) : (
                <div className="cd-sched-scroll">
                  {filteredSchedules.map((s, i) => {
                    const meta = SCHED_META(s.status)
                    const isConfirming = confirmDeleteId === s.id
                    const isRenaming = renameId === s.id
                    const isBusy = rowBusyId === s.id
                    return (
                      <div key={s.id ?? i} className="cd-sched-row" onClick={() => !isConfirming && !isRenaming && navigate('/coordinator/schedules', { state: { scheduleId: s.id } })}>
                        <div style={{ width: 40, height: 40, borderRadius: 10, background: meta.bg, display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke={meta.color} strokeWidth="2"><rect x="3" y="4" width="18" height="18" rx="2"/><line x1="16" y1="2" x2="16" y2="6"/><line x1="8" y1="2" x2="8" y2="6"/><line x1="3" y1="10" x2="21" y2="10"/></svg>
                        </div>

                        {isRenaming ? (
                          <div style={{ flex: 1, minWidth: 0 }} onClick={e => e.stopPropagation()}>
                            <input
                              autoFocus
                              className="cd-rename-input"
                              value={renameTmp}
                              onChange={e => setRenameTmp(e.target.value)}
                              onKeyDown={e => { if (e.key === 'Enter') handleRename(s.id); if (e.key === 'Escape') setRenameId(null) }}
                            />
                          </div>
                        ) : (
                          <div style={{ flex: 1, minWidth: 0 }}>
                            <div style={{ fontSize: 15, fontWeight: 700, color: G.ink, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                              {s.name || `${s.semester || 'Schedule'} ${s.academicYear || ''}`}
                            </div>
                            {s.updatedAt && <div style={{ fontSize: 12.5, color: G.muted2, marginTop: 2 }}>Updated {s.updatedAt}</div>}
                          </div>
                        )}

                        {isConfirming ? (
                          <div style={{ display: 'flex', alignItems: 'center', gap: 10 }} onClick={e => e.stopPropagation()}>
                            <span style={{ fontSize: 13, fontWeight: 700, color: G.redDeep }}>Delete this schedule?</span>
                            <button className="cd-icon-btn" style={{ width: 'auto', padding: '0 12px', fontSize: 12, fontWeight: 700 }} onClick={() => setConfirmDeleteId(null)} disabled={isBusy}>Cancel</button>
                            <button className="cd-icon-btn danger" style={{ width: 'auto', padding: '0 12px', fontSize: 12, fontWeight: 700, color: G.redDeep, borderColor: G.redBorder }} onClick={() => handleDelete(s.id)} disabled={isBusy}>
                              {isBusy ? 'Deleting…' : 'Delete'}
                            </button>
                          </div>
                        ) : isRenaming ? (
                          <div style={{ display: 'flex', alignItems: 'center', gap: 10 }} onClick={e => e.stopPropagation()}>
                            <button className="cd-icon-btn" style={{ width: 'auto', padding: '0 12px', fontSize: 12, fontWeight: 700 }} onClick={() => setRenameId(null)} disabled={isBusy}>Cancel</button>
                            <button className="cd-icon-btn" style={{ width: 'auto', padding: '0 12px', fontSize: 12, fontWeight: 700, color: G.meadowDeep, borderColor: G.meadowBorder }} onClick={() => handleRename(s.id)} disabled={isBusy}>
                              {isBusy ? 'Saving…' : 'Save'}
                            </button>
                          </div>
                        ) : (
                          <>
                            <span style={{ fontSize: 12.5, fontWeight: 700, color: meta.color, background: meta.bg, padding: '6px 14px', borderRadius: 99, flexShrink: 0 }}>{meta.label}</span>
                            <div className="cd-row-actions" style={{ display: 'flex', alignItems: 'center', gap: 8 }} onClick={e => e.stopPropagation()}>
                              <button className="cd-icon-btn" title="Rename" onClick={() => { setRenameId(s.id); setRenameTmp(s.name || '') }} disabled={isBusy}>
                                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" style={{ display: 'block', fill: 'none', strokeWidth: 2 }}><path d="M12 20h9"/><path d="M16.5 3.5a2.12 2.12 0 0 1 3 3L7 19l-4 1 1-4Z"/></svg>
                              </button>
                              <button className="cd-icon-btn" title="Duplicate" onClick={() => handleDuplicate(s.id)} disabled={isBusy}>
                                {isBusy ? (
                                  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" style={{ display: 'block', fill: 'none', strokeWidth: 2.5, animation: 'spin-r .8s linear infinite' }}><path d="M21 12a9 9 0 1 1-3-6.7"/></svg>
                                ) : (
                                  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" style={{ display: 'block', fill: 'none', strokeWidth: 2 }}><rect x="9" y="9" width="13" height="13" rx="2"/><path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1"/></svg>
                                )}
                              </button>
                              {s.status === 'submitted' && (
                                <button className="cd-icon-btn" title="Recall to draft" onClick={() => handleUnsubmit(s.id)} disabled={isBusy}>
                                  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" style={{ display: 'block', fill: 'none', strokeWidth: 2 }}><path d="M3 12a9 9 0 1 0 3-6.7"/><polyline points="3 4 3 9 8 9"/></svg>
                                </button>
                              )}
                              <button className="cd-icon-btn danger" title="Delete" onClick={() => setConfirmDeleteId(s.id)} disabled={isBusy}>
                                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" style={{ display: 'block', fill: 'none', strokeWidth: 2 }}><polyline points="3 6 5 6 21 6"/><path d="M19 6l-1 14a2 2 0 0 1-2 2H8a2 2 0 0 1-2-2L5 6"/><path d="M10 11v6"/><path d="M14 11v6"/><path d="M9 6V4a1 1 0 0 1 1-1h4a1 1 0 0 1 1 1v2"/></svg>
                              </button>
                            </div>
                          </>
                        )}
                      </div>
                    )
                  })}
                </div>
              )}
            </div>
          )}

          {!loading && schedules.length === 0 && courseCount > 0 && (
            <div className="d-card">
              <div className="cd-empty-state">
                <div style={{ width: 48, height: 48, borderRadius: '50%', background: G.meadowSoft, display: 'flex', alignItems: 'center', justifyContent: 'center', color: G.meadowDeep }}>
                  <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"><rect x="3" y="4" width="18" height="18" rx="2"/><line x1="16" y1="2" x2="16" y2="6"/><line x1="8" y1="2" x2="8" y2="6"/><line x1="3" y1="10" x2="21" y2="10"/></svg>
                </div>
                <div style={{ fontSize: 15, fontWeight: 800, color: G.ink }}>No schedules yet</div>
                <div style={{ fontSize: 13, color: G.muted, maxWidth: 360, lineHeight: 1.5 }}>Once it's your turn in the queue, run the solver to generate your program's first schedule.</div>
                <button className="cd-run-btn" style={{ marginTop: 12 }} onClick={() => navigate('/coordinator/scheduler')}>
                  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"><polygon points="5 3 19 12 5 21 5 3"/></svg>
                  Go to Scheduler
                </button>
              </div>
            </div>
          )}
          
          {/* Insights */}
          {!loading && suggestions.length > 1 && (
            <div className="d-card">
              <SectionHeader
                title="Insights & Recommendations"
                sub="Other things to keep in mind"
                right={
                  <div style={{ display: 'flex', gap: 6 }}>
                    {suggestions.some(s => s.type === 'error') && <Badge label={`${suggestions.filter(s => s.type === 'error').length} critical`} color={G.redDeep} bg="#FFE8E8" />}
                    {suggestions.some(s => s.type === 'warning') && <Badge label={`${suggestions.filter(s => s.type === 'warning').length} warnings`} color={G.amber} bg={G.amberSoft} />}
                  </div>
                }
              />
              <div style={{ padding: '20px', display: 'flex', flexDirection: 'column', gap: 12 }}>
                {suggestions.slice(1).map((s, i) => <SuggestionCard key={s.id} suggestion={s} navigate={navigate} delay={i * 0.04} />)}
              </div>
            </div>
          )}

          {/* Course/Room analytics — kept inside the left column so it flows right
              after the content above instead of waiting on the taller right column */}
          {!loading && courseCount > 0 && (
            <div style={{ display: 'grid', gridTemplateColumns: (roomCoverage.totalLecture > 0 || roomCoverage.totalLab > 0) ? '1fr 1fr' : '1fr', gap: 24 }}>
              <div className="d-card d-card-hover" style={{ padding: '24px' }}>
                <div style={{ fontSize: 14, fontWeight: 800, color: G.ink, marginBottom: 4 }}>Courses by Semester</div>
                <div style={{ display: 'flex', gap: 24, alignItems: 'center', marginTop: 16 }}>
                  <DonutChart
                    segments={Object.entries(courseStats.bySemester).map(([label, value]) => ({ label, value, color: SEM_COLORS[label] }))}
                    label={courseCount} sublabel="courses" size={100} stroke={16}
                  />
                  <div style={{ flex: 1 }}>
                    {Object.entries(courseStats.bySemester).filter(([, v]) => v > 0).map(([sem, count]) => (
                      <div key={sem} style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 8 }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                          <div style={{ width: 10, height: 10, borderRadius: 3, background: SEM_COLORS[sem], flexShrink: 0 }} />
                          <span style={{ fontSize: 12.5, fontWeight: 600, color: G.ink }}>{sem}</span>
                        </div>
                        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                          <span style={{ fontSize: 11.5, color: G.muted2 }}>{Math.round(count / semTotal * 100)}%</span>
                          <span style={{ fontSize: 13, fontWeight: 700, color: SEM_COLORS[sem] }}>{count}</span>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              </div>

              {(roomCoverage.totalLecture > 0 || roomCoverage.totalLab > 0) && (
                <div className="d-card d-card-hover" style={{ padding: '24px' }}>
                  <div style={{ fontSize: 14, fontWeight: 800, color: G.ink, marginBottom: 16 }}>Room Coverage</div>
                  <div style={{ display: 'flex', flexDirection: 'column', gap: 8, justifyContent: 'center', minHeight: 100 }}>
                    {roomCoverage.totalLecture > 0 && (
                      <HorizBar label="Lecture rooms" value={`${lectureRoomCount} / ${roomCoverage.totalLecture}`} pct={roomCoverage.pctLecture} color={G.blue} />
                    )}
                    {roomCoverage.totalLab > 0 && (
                      <HorizBar label="Lab rooms" value={`${labRoomCount} / ${roomCoverage.totalLab}`} pct={roomCoverage.pctLab} color={G.violet} />
                    )}
                  </div>
                </div>
              )}
            </div>
          )}
        </div>

        {/* ── Right Column: Actions, Queue & Stats ── */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: 24 }}>

          {/* Quick Actions — leads the column since these are things the user does,
              ahead of the passive queue/analytics widgets below */}
          <div>
            <div className="cd-section-title" style={{ textTransform: 'uppercase', letterSpacing: '.8px', fontSize: 12, color: G.muted2, marginBottom: 16 }}>Quick Actions</div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
              {QUICK_ACTIONS.map(qa => (
                <div key={qa.label} className="cd-qa-card" onClick={() => navigate(qa.href)}>
                  <div style={{ width: 44, height: 44, borderRadius: 12, background: qa.bg, color: qa.color, display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                    {qa.icon}
                  </div>
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{ fontSize: 14, fontWeight: 800, color: G.ink }}>{qa.label}</div>
                    <div style={{ fontSize: 12.5, color: G.muted, marginTop: 2 }}>{qa.desc}</div>
                  </div>
                  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke={G.muted2} strokeWidth="2.5" style={{ flexShrink: 0 }}><polyline points="9 18 15 12 9 6"/></svg>
                </div>
              ))}
            </div>
          </div>

          {/* Scheduling Queue */}
          <div className="d-card">
            <SectionHeader
              title="Scheduling Queue"
              sub={hasQueue ? (isMyTurn ? 'Your program is active.' : `Waiting on ${currentProg || 'another program'}`) : 'No active scheduling queue'}
              right={
                <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
                  {hasQueue && totalInQueue > 0 && (
                    <Badge label={`${approvedInQueue}/${totalInQueue} approved`} color={G.meadowDeep} bg={G.meadowSoft} />
                  )}
                  {!loading && (
                    <button className={`cd-refresh-btn${refreshing ? ' spinning' : ''}`} disabled={refreshing} onClick={() => load(true)} title="Refresh queue status">
                      <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"><polyline points="23 4 23 10 17 10"/><polyline points="1 20 1 14 7 14"/><path d="M3.51 9a9 9 0 0 1 14.85-3.36L23 10M1 14l4.64 4.36A9 9 0 0 0 20.49 15"/></svg>
                    </button>
                  )}
                </div>
              }
            />
            <div style={{ padding: '20px 24px' }}>
              {loading ? (
                <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
                  <Skel w="50%" h={16} />
                  <Skel w="100%" h={44} />
                  <Skel w="100%" h={44} />
                </div>
              ) : !hasQueue ? (
                <div style={{ padding: '24px 20px', fontSize: 14, color: G.muted, background: G.hover, borderRadius: 12, textAlign: 'center' }}>
                  No active scheduling queue. The admin hasn't started one yet.
                </div>
              ) : (
                <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
                  {isMyTurn ? (
                    <div style={{ padding: '16px 20px', borderRadius: 12, background: G.meadowSoft, border: `1px solid ${G.meadowBorder}`, fontSize: 14, fontWeight: 700, color: G.meadowDeep, display: 'flex', alignItems: 'center', gap: 10 }}>
                      <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"><polyline points="20 6 9 17 4 12"/></svg>
                      It's your turn — generate your schedule now.
                    </div>
                  ) : (
                    <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
                      <div style={{ padding: '14px 20px', borderRadius: 12, background: G.amberSoft, border: `1px solid ${G.amberBorder}`, fontSize: 13.5, color: '#78350F', fontWeight: 600 }}>
                        Waiting for <strong>{currentProg}</strong> to finish · position {myPos} of {qLen}
                      </div>
                      {myPos > 0 && qLen > 0 && (
                        <div style={{ height: 6, borderRadius: 99, background: G.hover, overflow: 'hidden' }}>
                          <div style={{ height: '100%', width: `${Math.max(4, Math.round(((qLen - myPos) / qLen) * 100))}%`, background: G.meadow, transition: 'width .4s ease' }} />
                        </div>
                      )}
                    </div>
                  )}
                  <QueueLedger queue={queueList} />
                </div>
              )}
            </div>
          </div>

        </div>
      </div>

      <ToastContainer toasts={toasts} />
    </div>
  )
}