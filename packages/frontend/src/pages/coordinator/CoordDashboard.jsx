import { useState, useEffect, useCallback, useRef, useMemo } from 'react'
import { useNavigate } from 'react-router-dom'
import { useAuth } from '../../hooks/useAuth'
import {
  coordCheckTurn, coordListSchedules, coordGetScheduleCounts, coordGetSettings,
  coordGetCourses, coordGetRooms, coordGetSelectedRooms, coordGetSubmittedSchedule,
  coordDuplicateSchedule, coordDeleteSchedule, coordRenameSchedule, coordUnsubmitSchedule,
} from '../../services/api'
import { useTour } from '../../hooks/useTour.jsx'

// Two-speed polling: the queue/turn status is the only thing that genuinely
// needs to feel "live" (it's what tells a coordinator it's their turn), and
// it's a single cheap read. Everything else in `load()` — schedules list,
// settings, courses, rooms, submitted-master lookup — is either backed by
// an in-memory server cache or scales with how many documents this program
// has ever created, so it's polled far less often. Both intervals pause
// entirely while the tab is hidden.
const TURN_POLL_MS = 15000
const FULL_POLL_MS = 90000
// "Recent Schedules" only ever shows/searches the most recent handful — it
// doesn't need this program's entire schedule history re-read every poll.
// Accurate totals for the stat card come from /schedule/counts instead
// (a flat 4 reads via Firestore's count() aggregation, regardless of how
// many schedules exist).
const RECENT_SCHEDULES_LIMIT = 30

const G = {
  meadow: 'var(--meadow, var(--meadow))', meadowDeep: 'var(--meadow-deep)', meadowMid: 'var(--meadow-mid)',
  meadowSoft: 'var(--meadow-soft)', meadowBorder: 'var(--meadow-border)',
  ink: 'var(--ink, #0E2A20)', inkMid: '#1C3D2A', muted: 'var(--muted, #4B7060)', muted2: 'var(--muted2, #6B8C7A)',
  border: 'var(--border)', borderLight: 'var(--hover)', bg: 'var(--bg, #F2F7F4)',
  surface: 'var(--surface, #FFFFFF)', hover: 'var(--hover)',
  amber: '#F59E0B', amberSoft: 'rgba(245, 158, 11, 0.1)', amberBorder: 'rgba(245, 158, 11, 0.25)',
  red: '#EF4444', redDeep: '#EF4444', redSoft: 'rgba(239, 68, 68, 0.05)', redBorder: 'rgba(220, 38, 38, 0.25)',
  blue: '#60A5FA', blueSoft: 'rgba(59, 130, 246, 0.1)', blueBorder: '#BFDBFE',
  violet: '#7C3AED', violetSoft: 'color-mix(in srgb, #6D28D9 15%, transparent)',
  cyan: '#0891B2', cyanSoft: '#CFFAFE',
}

const SEM_COLORS = { '1st Semester': G.meadow, '2nd Semester': G.blue, 'Midyear': G.amber }
const YEAR_COLORS = [G.meadow, G.blue, G.violet, G.amber]

const STYLE_TAG_ID = 'coord-dash-style-v13'
if (!document.getElementById(STYLE_TAG_ID)) {
  document.querySelectorAll('[id^="coord-dash-style"]').forEach(el => el.remove())
  const s = document.createElement('style')
  s.id = STYLE_TAG_ID
  s.textContent = `
    @import url('https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700;800&family=Sora:wght@600;700;800&display=swap');
    
    @keyframes spin-r { to{transform:rotate(360deg)} }
    @keyframes cpToastIn { from{opacity:0;transform:translateY(10px)} to{opacity:1;transform:translateY(0)} }
    @keyframes shimmer { 0%{background-position:-600px 0} 100%{background-position:600px 0} }
    @keyframes fadeUp { from{opacity:0;transform:translateY(6px)} to{opacity:1;transform:translateY(0)} }
    @keyframes barIn { from{width:0} }
    @keyframes pulseGlow {
      0%, 100% { box-shadow: 0 0 0 0 rgba(255, 255, 255, 0.4); }
      50%      { box-shadow: 0 0 0 8px rgba(255, 255, 255, 0); }
    }

    * { box-sizing: border-box; }
    
    .cd-skeleton { background:linear-gradient(90deg,${G.hover} 25%,${G.borderLight} 50%,${G.hover} 75%); background-size:600px 100%; animation:shimmer 1.4s ease-in-out infinite; border-radius:7px; }
    
    .cp-toast-wrap { position:fixed; bottom:24px; left:50%; z-index:9999; display:flex; flex-direction:column; gap:8px; align-items:center; pointer-events:none; transform:translateX(-50%); }
    .cp-toast { display:flex; align-items:center; gap:9px; padding:11px 18px; border-radius:10px; font-family:'Inter',sans-serif; font-size:13px; font-weight:600; animation:cpToastIn .2s ease-out; white-space:nowrap; pointer-events:auto; background:${G.ink}; color:#fff; box-shadow:0 8px 28px rgba(0,0,0,0.18); }
    .cp-toast.error { background: var(--surface); color:${G.redDeep}; border:1.5px solid ${G.redBorder}; }
    .cp-toast.info { background: var(--surface); color:${G.ink}; border:1.5px solid ${G.border}; }
    
    .d-card { background: var(--surface); border-radius:12px; border:1px solid ${G.border}; box-shadow:0 2px 8px rgba(0,0,0,0.05); animation:fadeUp .28s ease both; overflow:hidden; }
    .d-card-hover { transition:box-shadow .15s, transform .15s; }
    .d-card-hover:hover { box-shadow:0 4px 12px rgba(0,0,0,0.08); transform:translateY(-1px); }
    
    .cd-refresh-btn { display:flex; align-items:center; gap:6px; padding:6px 12px; border-radius:8px; border:1px solid ${G.border}; background: var(--surface); color:${G.muted}; font-size:11.5px; font-weight:600; cursor:pointer; font-family:'Inter',sans-serif; transition:all .12s; }
    .cd-refresh-btn:hover { color: var(--meadow-text); background:${G.hover}; border-color:${G.meadowBorder}; }
    .cd-refresh-btn:disabled { opacity:.55; cursor:default; }
    .cd-refresh-btn.spinning svg { animation:spin-r .8s linear infinite; }
    
    .cd-sched-row { display:flex; align-items:center; gap:12px; padding:14px 20px; cursor:pointer; transition:background .12s; border-bottom:1px solid ${G.borderLight}; }
    .cd-sched-row:last-child { border-bottom:none; }
    .cd-sched-row:hover { background:${G.hover}; }
    .cd-row-actions { opacity:1; }
    
    .cd-icon-btn { width:30px; height:30px; border-radius:8px; border:1px solid ${G.border}; background: var(--surface); display:flex; align-items:center; justify-content:center; cursor:pointer; color:${G.muted} !important; transition:all .12s; flex-shrink:0; }
    .cd-icon-btn svg { fill:none !important; stroke:currentColor !important; display:block; flex-shrink:0; }
    .cd-icon-btn:hover { background:${G.hover}; color: var(--meadow-text) !important; border-color:${G.meadowBorder}; }
    .cd-icon-btn.danger:hover { background:${G.redSoft}; color:${G.redDeep} !important; border-color:${G.redBorder}; }
    .cd-icon-btn:disabled { opacity:.5; cursor:default; }
    
    
    .cd-run-btn { display:inline-flex; align-items:center; gap:7px; padding:9px 20px; border-radius:10px; border:none; background:linear-gradient(135deg,${G.meadow},${G.meadowDeep}); color:#fff; font-size:13px; font-weight:700; cursor:pointer; font-family:'Inter',sans-serif; box-shadow:0 3px 12px rgba(0,0,0,0.25); transition:transform .15s, box-shadow .15s, background .15s; }
    .cd-run-btn:hover { transform:translateY(-1px); box-shadow:0 5px 16px rgba(0,0,0,0.3); }
    
    .stat-grid { display:grid; grid-template-columns:repeat(4, 1fr); gap:12px; margin-bottom:20px; }
    @media (max-width: 900px) { .stat-grid { grid-template-columns:repeat(2, 1fr); } }

    /* Safety-net CSS for the react-joyride v3 tour tooltip, in case the
       styles/options props above ever fall out of sync with the installed
       react-joyride version — targets its stable data-action attributes. */
    [data-action="primary"] {
      background:linear-gradient(135deg,${G.meadow},${G.meadowDeep}) !important;
      border-radius:8px !important; font-family:'Inter',sans-serif !important; font-weight:700 !important;
      font-size:13px !important; padding:8px 18px !important; box-shadow:0 3px 10px rgba(0,0,0,0.3) !important; border:none !important; color:#fff !important;
    }
    [data-action="back"] { color:${G.muted} !important; font-family:'Inter',sans-serif !important; font-weight:600 !important; font-size:13px !important; }
    [data-action="skip"] { color:${G.muted2} !important; font-family:'Inter',sans-serif !important; font-weight:600 !important; font-size:12.5px !important; }
    [data-action="close"] { color:${G.muted2} !important; }



    /* Schedules/Analytics/Insights row — same reasoning. */
    .cd-bottom-row { display:grid; grid-template-columns:minmax(0,1fr) minmax(0,1fr); gap:20px; margin-bottom:24px; align-items:start; }
    @media (max-width: 980px) { .cd-bottom-row { grid-template-columns:1fr; } }

    /* Analytics row (Courses by Semester / Room Coverage) — full page width,
       its own row above the two-column area below, so each card gets a full
       half of the page instead of a quarter of it. */
    .cd-analytics-row { display:grid; grid-template-columns:minmax(0,1fr) minmax(0,1fr); gap:20px; margin-bottom:20px; }
    @media (max-width: 720px) { .cd-analytics-row { grid-template-columns:1fr; } }
    
    .stat-card { background: var(--surface); border-radius:12px; border:1px solid ${G.border}; box-shadow:0 2px 4px rgba(0,0,0,0.03); padding:16px 20px; display:flex; align-items:center; gap:14px; min-height:80px; transition:all .15s; position:relative; }
    .stat-card:hover { border-color:${G.meadowBorder}; box-shadow:0 4px 12px rgba(0,0,0,0.06); transform:translateY(-1px); }
    .stat-icon-wrap { width:44px; height:44px; border-radius:10px; display:flex; align-items:center; justify-content:center; flex-shrink:0; }
    
    .suggestion-card { border-radius:10px; padding:12px 14px; display:flex; align-items:flex-start; gap:10px; cursor:default; transition:transform .15s, box-shadow .15s; border:1px solid transparent; }
    .suggestion-card:hover { transform:translateY(-1px); box-shadow:0 4px 12px rgba(0,0,0,0.06); }
    
    .setup-row { display:flex; align-items:center; gap:16px; padding:14px 20px; cursor:default; transition:background 0.12s; }
    .setup-row:hover { background: ${G.hover} !important; }
    
    
    .cd-section-title { font-size:15px; font-weight:800; color:${G.ink}; font-family:'Sora',sans-serif; letter-spacing:-0.1px; }
    .cd-section-sub { font-size:12px; color:${G.muted2}; margin-top:2px; font-weight:500; }
    
    .cd-search-wrap { position:relative; display:flex; align-items:center; }
    .cd-search-wrap svg { position:absolute; left:12px; pointer-events:none; }
    .cd-search-input { font-family:'Inter',sans-serif; font-size:13px; font-weight:500; padding:8px 12px 8px 34px; border-radius:10px; border:1px solid ${G.border}; background: var(--surface); color:${G.ink}; width:200px; transition:border-color .12s, width .15s, box-shadow .15s; }
    .cd-search-input::placeholder { color:${G.muted2}; }
    .cd-search-input:focus { outline:none; border-color: var(--meadow-text-hover); width:240px; box-shadow:0 0 0 3px rgba(0,0,0,0.1); }
    
    .cd-filter-chip { font-family:'Inter',sans-serif; font-size:11.5px; font-weight:600; padding:5px 12px; border-radius:10px; border:1px solid ${G.border}; background: var(--surface); color:${G.muted}; cursor:pointer; transition:all .12s; white-space:nowrap; }
    .cd-filter-chip:hover { border-color:${G.meadowBorder}; color: var(--meadow-text); background:${G.hover}; }
    .cd-filter-chip.active { background:${G.meadowSoft}; border-color:${G.meadowBorder}; color: var(--meadow-text); }
    
    .cd-empty-state { display:flex; flex-direction:column; align-items:center; justify-content:center; gap:10px; padding:40px 20px; text-align:center; }
    .cd-rename-input { font-family:'Inter',sans-serif; font-size:14px; font-weight:700; color:${G.ink}; padding:8px 12px; border-radius:8px; border:2px solid ${G.meadow}; outline:none; width:100%; max-width:300px; box-shadow:0 0 0 3px rgba(0,0,0,0.1); }
    .cd-sched-scroll { max-height: 320px; overflow-y: auto; }
    .cd-sched-scroll::-webkit-scrollbar { width: 6px; }
    .cd-sched-scroll::-webkit-scrollbar-track { background: transparent; }
    .cd-sched-scroll::-webkit-scrollbar-thumb { background: ${G.border}; border-radius: 99px; }
    .cd-sched-scroll::-webkit-scrollbar-thumb:hover { background: ${G.muted2}; }
    
    .cd-retry-btn { padding:6px 14px; border-radius:8px; border:1px solid ${G.redBorder}; background: var(--surface); color:${G.redDeep}; font-size:12px; font-weight:700; cursor:pointer; font-family:'Inter',sans-serif; flex-shrink:0; transition:background .12s; }
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
    <div style={{ padding: '20px 24px', borderBottom: `1px solid ${G.borderLight}`, display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 12, background: 'var(--surface)' }}>
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
        style={{ display: 'flex', alignItems: 'center', gap: 16, padding: '16px 24px', cursor: 'pointer', background: 'var(--surface)', borderBottom: open ? `1px solid ${G.meadowSoft}` : 'none' }}>
        <div style={{ width: 36, height: 36, borderRadius: '50%', flexShrink: 0, background: G.meadowSoft, color: 'var(--meadow-text)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 13, fontWeight: 800, fontFamily: "'Sora',sans-serif" }}>
          {doneCount}/{total}
        </div>
        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={{ fontSize: 15, fontWeight: 800, color: G.ink, fontFamily: "'Sora',sans-serif" }}>Setup Checklist</div>
          <div style={{ fontSize: 12.5, color: 'var(--meadow-text)', fontWeight: 600, marginTop: 2 }}>
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
        <div style={{ background: 'var(--surface)' }}>
          {steps.map((step, i) => (
            <div key={step.title} className="setup-row"
              style={{ borderTop: i > 0 ? `1px solid ${G.borderLight}` : 'none', background: step.done ? '#F8FBF9' : i === nextIdx ? 'var(--meadow-soft)' : 'var(--surface)' }}>
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
                  style={{ flexShrink: 0, padding: '8px 16px', borderRadius: 10, border: 'none', background: G.meadow, color: '#fff', fontSize: 12.5, fontWeight: 600, cursor: 'pointer', fontFamily: "'Inter',sans-serif", whiteSpace: 'nowrap', boxShadow: '0 2px 8px rgba(0,0,0,0.2)' }}
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
  active:     { label: 'Active',     color: 'var(--meadow-text)' },
  generating: { label: 'Generating', color: G.blue },
  submitted:  { label: 'Submitted',  color: G.amber },
  approved:   { label: 'Approved',   color: 'var(--meadow-text)' },
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
    approved:  { label: 'Approved',  color: 'var(--meadow-text)', bg: G.meadowSoft },
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

const SUGGESTION_STYLES = {
  error:   { bg: G.redSoft,    border: G.redBorder,    icon: G.redDeep,    chip: 'rgba(220, 38, 38, 0.25)', dot: '#EF4444', label: 'Critical' },
  warning: { bg: G.amberSoft,  border: G.amberBorder,  icon: G.amber,      chip: 'rgba(245, 158, 11, 0.25)', dot: '#F59E0B', label: 'Warning'  },
  info:    { bg: G.blueSoft,   border: G.blueBorder,   icon: G.blue,       chip: '#BFDBFE', dot: '#3B82F6', label: 'Info'     },
  success: { bg: G.meadowSoft, border: G.meadowBorder, icon: G.meadowDeep, chip: 'var(--meadow-border)', dot: 'var(--meadow)', label: 'Good'     },
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

// ── Onboarding tour trigger ──────────────────────────────────────────────
// These two functions are the ONLY place that decides whether a coordinator
// has already seen the tour. Right now they just read/write localStorage as
// a stand-in. When the backend has a real `onboardingCompleted: true/false`
// field on the coordinator's profile, swap the bodies below for the actual
// API calls (e.g. `coordGetSettings()`/`coordUpdateSettings()`, or whatever
// endpoint tracks this) and nothing else in this file needs to change.
const TOUR_SEEN_KEY = 'coordDashboard_tourSeen'
function isOnboardingCompleted() {
  try { return localStorage.getItem(TOUR_SEEN_KEY) === '1' } catch { return true }
}
function markOnboardingCompleted() {
  try { localStorage.setItem(TOUR_SEEN_KEY, '1') } catch {}
}

export default function CoordDashboard() {
  const { coordinatorProgram } = useAuth()
  const navigate = useNavigate()

  const { toasts, toast } = useToast()

  const [turnData, setTurnData] = useState(null)
  const [schedules, setSchedules] = useState([])
  const [counts, setCounts] = useState({ total: 0, drafts: 0, submitted: 0, approved: 0 })
  const [settings, setSettings] = useState(null)
  const [courses, setCourses] = useState([])
  const [rooms, setRooms] = useState({ lecture: [], lab: [] })
  const [allRooms, setAllRooms] = useState({ lecture: [], lab: [] })
  const [masterInfo, setMasterInfo] = useState(null)
  const [masterStats, setMasterStats] = useState(null)
  const [loading, setLoading] = useState(true)
  const [refreshing, setRefreshing] = useState(false)
  const [lastUpdated, setLastUpdated] = useState(null)
  const [error, setError] = useState(null)
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

  // Tracks the queueId the last-seen turn snapshot belonged to, so the fast
  // poll can tell "the active queue changed under us" apart from "nothing
  // changed" without needing to re-run the full load to find out.
  const lastQueueId = useRef(undefined)

  // Applies a fresh turn/queue snapshot and fires the "it's your turn" toast
  // exactly once per turn. Shared by the full load and the lightweight poll
  // so that logic only lives in one place.
  const applyTurn = useCallback((turn) => {
    setTurnData(turn)
    if (turn?.isMyTurn && !wasMyTurn.current) {
      toast("It's your turn — you can generate your schedule now!", 'success', 5000)
    }
    wasMyTurn.current = !!turn?.isMyTurn
  }, [toast])

  // Full load: schedules list, settings/courses/rooms (cheap — server-cached),
  // and the submitted-master lookup. This is the expensive one (schedules
  // list costs 1 Firestore read per draft this program has ever made), so
  // it only runs on mount, on manual refresh, and on the slow background
  // interval below — not every 15s.
  const load = useCallback(async (silent = false) => {
    if (silent) setRefreshing(true)
    try {
      const [turn, scheds, cnts, sett, crs, selRooms, allR] = await Promise.all([
        coordCheckTurn().catch(() => null),
        coordListSchedules(RECENT_SCHEDULES_LIMIT).catch(() => []),
        coordGetScheduleCounts().catch(() => null),
        coordGetSettings().catch(() => null),
        coordGetCourses().catch(() => []),
        coordGetSelectedRooms().catch(() => ({ lecture: [], lab: [] })),
        coordGetRooms().catch(() => ({ lecture: [], lab: [] })),
      ])
      applyTurn(turn)
      lastQueueId.current = turn?.queueId ?? null
      setSchedules(Array.isArray(scheds) ? scheds : [])
      setCounts(cnts || { total: 0, drafts: 0, submitted: 0, approved: 0 })
      setSettings(sett)
      setCourses(Array.isArray(crs) ? crs : [])
      setRooms({ lecture: selRooms?.lecture || [], lab: selRooms?.lab || [] })
      setAllRooms({ lecture: allR?.lecture || [], lab: allR?.lab || [] })
      setLastUpdated(new Date())
      setError(null)

      if (turn?.queueId) {
        coordGetSubmittedSchedule().then(info => {
          setMasterInfo(info)
          // Fetch full events only when there are approved programs to show stats
          const approvedCount = info?.approvedPrograms?.length ?? 0
          if (approvedCount > 0) {
            coordGetSubmittedSchedule(true).then(full => {
              const events = full?.schedule || []
              const uniqueRooms = new Set(events.map(e => e.room).filter(Boolean))
              const uniqueFaculty = new Set(events.map(e => e.faculty).filter(f => f && f !== 'TBA'))
              const programSessions = {}
              events.forEach(e => {
                const p = e.programCode || e.program || '—'
                programSessions[p] = (programSessions[p] || 0) + 1
              })
              setMasterStats({ totalSessions: events.length, rooms: uniqueRooms.size, faculty: uniqueFaculty.size, programSessions })
            }).catch(() => setMasterStats(null))
          } else {
            setMasterStats(null)
          }
        }).catch(() => { setMasterInfo(null); setMasterStats(null) })
      } else {
        setMasterInfo(null)
        setMasterStats(null)
      }
    } catch (err) {
      if (!silent) {
        setError({ title: 'Failed to load dashboard', message: err?.response?.data?.detail || err.message || 'Server unreachable.' })
        toast('Failed to load dashboard data', 'error')
      }
    } finally {
      setLoading(false)
      setRefreshing(false)
    }
  }, [applyTurn, toast])

  // Lightweight poll: just the turn/queue snapshot (a single cheap read).
  // If it reveals the active queue changed, or it's newly this program's
  // turn, fall through to a full (silent) reload so schedules/master data
  // catch up — otherwise the expensive stuff stays untouched.
  const pollTurn = useCallback(async () => {
    const turn = await coordCheckTurn().catch(() => null)
    if (!turn) return
    const queueChanged = turn.queueId !== lastQueueId.current
    const becameMyTurn = turn.isMyTurn && !wasMyTurn.current
    applyTurn(turn)
    lastQueueId.current = turn.queueId ?? null
    if (queueChanged || becameMyTurn) {
      load(true)
    }
  }, [applyTurn, load])

  // Initial load, once.
  useEffect(() => { load() }, [load])

  // Both intervals pause while the tab is hidden, and immediately re-poll
  // on becoming visible again — so a coordinator who leaves this dashboard
  // open in a background tab all day isn't silently burning reads for a
  // screen nobody's looking at.
  useEffect(() => {
    let turnId = null
    let fullId = null

    function start() {
      if (turnId) return
      pollTurn()
      turnId = setInterval(pollTurn, TURN_POLL_MS)
      fullId = setInterval(() => load(true), FULL_POLL_MS)
    }
    function stop() {
      if (turnId) { clearInterval(turnId); turnId = null }
      if (fullId) { clearInterval(fullId); fullId = null }
    }
    function onVisibility() {
      if (document.hidden) stop(); else start()
    }

    if (!document.hidden) start()
    document.addEventListener('visibilitychange', onVisibility)
    return () => { stop(); document.removeEventListener('visibilitychange', onVisibility) }
  }, [pollTurn, load])

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

  // Accurate across this program's whole history (from /schedule/counts),
  // not just the recent/capped list in `schedules` — a program with more
  // than RECENT_SCHEDULES_LIMIT schedules would otherwise undercount here.
  const drafts = counts.drafts
  const submitted = counts.submitted
  const approved = counts.approved

  const isMyTurn = turnData?.isMyTurn
  const currentProg = turnData?.currentProgram
  const myPos = turnData?.myPosition
  const qLen = turnData?.queueLength
  const queueList = turnData?.queue || []
  const hasQueue = turnData?.queueId != null
  // Field casing on the /coordinator/queue/my-turn response isn't confirmed,
  // so check both camelCase and snake_case and just skip display if neither exists.
  const activeTerm = turnData?.semester || turnData?.term || null
  const activeYear = turnData?.academicYear || turnData?.academic_year || turnData?.year || null
  const activeTermLabel = [activeTerm, activeYear].filter(Boolean).join(' · ')

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

  const hasSubmittedAny = counts.submitted > 0 || counts.approved > 0
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
  
  // For the filter chips below the recent-schedules list — these count
  // only what's actually loaded/browsable there, which may be fewer than
  // the true totals above if this program has more than
  // RECENT_SCHEDULES_LIMIT schedules on record.
  const loadedDrafts = schedules.filter(s => s.status === 'draft').length
  const loadedSubmitted = schedules.filter(s => s.status === 'submitted').length
  const loadedApproved = schedules.filter(s => s.status === 'approved').length
  const schedStatusCounts = { draft: loadedDrafts, submitted: loadedSubmitted, approved: loadedApproved }
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
  const hasInsights = suggestions.length > 1

  // Tour steps are built after `loading` / `courseCount` / `hasInsights` are
  // known, and skip any section that isn't actually in the DOM right now
  // (e.g. the analytics row only exists once there are courses, and the
  // Insights card only exists once there's more than one suggestion) —
  // pointing Joyride at a target that doesn't exist yet stalls the tour.
  const tourSteps = useMemo(() => {
    if (loading) return []
    const steps = [
      { target: '#tour-refresh-btn', title: 'Refresh Anytime', content: 'This refreshes everything on the page — queue position, courses, rooms, and schedules — without reloading the app.', placement: 'bottom', disableBeacon: true },
      { target: '#tour-stat-cards', title: 'Your Overview', content: 'Your stats at a glance: your position in the scheduling queue, how many courses and rooms are set up, and how many schedules you have in draft, submitted, or approved.', placement: 'bottom' },
    ]
    // Setup Checklist collapses to nothing (renders null) once every step
    // is done, so there's no point spotlighting it — same reasoning as the
    // analytics-row / insights-card guards below: don't point Joyride at a
    // section that isn't actually showing anything right now.
    if (readinessPct < 100) {
      steps.push({ target: '#tour-setup-checklist-anchor', spotlightTarget: '#tour-setup-checklist', title: 'Setup Checklist', content: 'This checklist walks you through everything to set up — adding courses, selecting rooms, and generating a schedule — before you can submit.', placement: 'top' })
    }
    steps.push({ target: '#tour-scheduling-queue-anchor', spotlightTarget: '#tour-scheduling-queue', title: 'Scheduling Queue', content: "This shows the active scheduling queue. When it's your turn, you get exclusive access to run the solver, and once other programs are approved you'll see combined progress here too.", placement: 'top' })
    if (courseCount > 0) {
      steps.push({ target: '#tour-analytics-row-anchor', spotlightTarget: '#tour-analytics-row', title: 'Course Analytics', content: "These charts break down your courses by semester and show how much of your selected rooms' time is already covered by approved sessions.", placement: 'top' })
    }
    steps.push({ target: '#tour-my-schedules-anchor', spotlightTarget: '#tour-my-schedules', title: 'My Schedules', content: 'All of your schedules live here — your active one pinned at the top, then recent drafts, submissions, and approvals, each with quick actions to rename, duplicate, recall, or delete.', placement: 'top' })
    if (hasInsights) {
      steps.push({ target: '#tour-insights-anchor', spotlightTarget: '#tour-insights', title: 'Insights & Recommendations', content: "Insights & Recommendations flags anything worth your attention — missing rooms, unsubmitted drafts, or other issues to fix before you're done.", placement: 'top' })
    }
    steps.push({ target: '#tour-scheduler-btn', title: 'Run the Scheduler', content: "Ready to build? Click here to enter the smart scheduler and generate your program's schedule.", placement: 'left' })
    return steps
  }, [loading, courseCount, hasInsights, readinessPct])

  const { TourElement, startTour } = useTour('coordDashboard', tourSteps, !loading)

  // First-time coordinators get the highlighted step-by-step tour automatically,
  // once the page has actually finished loading (so every target below exists
  // in the DOM); returning coordinators never see it again.
  useEffect(() => {
    if (loading || tourSteps.length === 0) return
    if (isOnboardingCompleted()) return
    startTour()
    markOnboardingCompleted()
  }, [loading, tourSteps, startTour])

  // Queue Position now leads the row (widest card) since it's the single most
  // action-relevant number on the page — everything else is supporting context.
  const STAT_CARDS = [
    {
      label: 'Queue Position', color: isMyTurn ? G.meadow : G.amber, iconBg: isMyTurn ? G.meadowSoft : G.amberSoft,
      value: loading ? null : (!hasQueue ? '—' : (isMyTurn ? 'Now' : (myPos ?? '—'))),
      sub: !hasQueue ? 'No active queue' : isMyTurn ? 'Your turn is open' : `of ${qLen} programs`,
      icon: <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2"/><circle cx="9" cy="7" r="4"/><path d="M22 21v-2a4 4 0 0 0-3-3.87"/><path d="M16 3.13a4 4 0 0 1 0 7.75"/></svg>,
    },
    {
      label: 'Courses', color: 'var(--meadow-text-hover)', iconBg: G.meadowSoft,
      value: loading ? null : courseCount,
      sub: courseCount > 0 ? `${lecOnlyCount} lecture · ${labCourseCount} lab` : null,
      icon: <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M4 19.5A2.5 2.5 0 0 1 6.5 17H20"/><path d="M6.5 2H20v20H6.5A2.5 2.5 0 0 1 4 19.5v-15A2.5 2.5 0 0 1 6.5 2z"/></svg>,
    },
    {
      label: 'Rooms', color: G.blue, iconBg: G.blueSoft,
      value: loading ? null : roomsSelectedCount,
      sub: roomsSelectedCount > 0 ? `${lectureRoomCount} lecture · ${labRoomCount} lab` : null,
      icon: <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M3 21h18"/><path d="M5 21V7l8-4v18"/><path d="M19 21V11l-6-4"/><path d="M9 9v.01M9 12v.01M9 15v.01M9 18v.01"/></svg>,
    },
    {
      label: 'Schedules', color: G.violet, iconBg: G.violetSoft,
      value: loading ? null : counts.total,
      sub: counts.total > 0 ? `${drafts} draft · ${submitted} sub · ${approved} appr` : null,
      icon: <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><rect x="3" y="4" width="18" height="18" rx="2"/><line x1="16" y1="2" x2="16" y2="6"/><line x1="8" y1="2" x2="8" y2="6"/><line x1="3" y1="10" x2="21" y2="10"/></svg>,
    },
  ]

  return (
    <div style={{ padding: '28px 32px 48px', fontFamily: "'Inter',sans-serif", display: 'flex', flexDirection: 'column', background: G.bg, minHeight: '100%', width: '100%', flex: '1 1 auto', minWidth: 0, boxSizing: 'border-box' }}>
      {TourElement}
      
      {/* ── Page Header ── */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 16, flexWrap: 'wrap', marginBottom: 20 }}>
        <div style={{ flex: 1, minWidth: 200 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
            <h1 style={{ fontSize: 24, fontWeight: 800, fontFamily: "'Sora',sans-serif", margin: 0, lineHeight: 1.2, color: G.ink }}>
              {greeting}.
            </h1>
          </div>
          <div style={{ fontSize: 12.5, fontWeight: 600, color: G.muted, marginTop: 4 }}>{coordinatorProgram} Coordinator</div>
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: 10, flexShrink: 0 }}>
          {!loading && (
            <>
              {/* TEST-ONLY manual trigger — delete this button once
                  isOnboardingCompleted()/markOnboardingCompleted() above are
                  wired to the real backend flag and you're confident the
                  automatic first-visit tour works. */}
              <button id="tour-refresh-btn" className={`cd-refresh-btn${refreshing ? ' spinning' : ''}`} disabled={refreshing} onClick={() => load(true)} title="Refresh dashboard data">
                <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"><polyline points="23 4 23 10 17 10"/><polyline points="1 20 1 14 7 14"/><path d="M3.51 9a9 9 0 0 1 14.85-3.36L23 10M1 14l4.64 4.36A9 9 0 0 0 20.49 15"/></svg>
              </button>
            </>
          )}
          <button id="tour-scheduler-btn" className="cd-run-btn" onClick={() => navigate('/coordinator/scheduler')}>
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"><polygon points="5 3 19 12 5 21 5 3"/></svg>
            Go to Scheduler
          </button>
        </div>
      </div>

      {/* Next Best Action */}
      {!loading && readinessPct === 100 && topSuggestion && (
        <div style={{ marginBottom: 16, padding: '10px 16px', background: G.meadowSoft, border: `1px solid ${G.meadowBorder}`, borderRadius: 10, display: 'flex', alignItems: 'center', gap: 10, flexWrap: 'wrap' }}>
          <div style={{ width: 24, height: 24, borderRadius: 6, background: G.meadow, color: '#fff', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
            <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3"><polyline points="20 6 9 17 4 12"/></svg>
          </div>
          <div style={{ flex: 1, minWidth: 200, fontSize: 12.5, lineHeight: 1.5 }}>
            <span style={{ fontWeight: 800, color: 'var(--meadow-text)', textTransform: 'uppercase', letterSpacing: '0.4px', fontSize: 10.5 }}>Next step </span>
            <span style={{ fontWeight: 700, color: G.ink }}>{topSuggestion.title}</span>
            <span style={{ color: G.muted }}> — {topSuggestion.body}</span>
          </div>
          {topSuggestion.action && (
            <button onClick={() => navigate(topSuggestion.action.href)} style={{ flexShrink: 0, padding: '6px 14px', borderRadius: 8, background: G.meadow, color: '#fff', border: 'none', fontSize: 12, fontWeight: 700, cursor: 'pointer', boxShadow: '0 2px 8px rgba(0,0,0,0.2)' }}>
              {topSuggestion.action.label}
            </button>
          )}
        </div>
      )}

      {error && (
        <div style={{ display: 'flex', alignItems: 'center', gap: 12, padding: '12px 16px', borderRadius: 10, background: G.redSoft, border: `1px solid ${G.redBorder}`, marginBottom: 16 }}>
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke={G.redDeep} strokeWidth="2.5"><circle cx="12" cy="12" r="10"/><line x1="12" y1="8" x2="12" y2="12"/><line x1="12" y1="16" x2="12.01" y2="16"/></svg>
          <span style={{ fontSize: 13, color: G.redDeep, flex: 1 }}><b>{error.title}</b> — {error.message}</span>
          <button className="cd-retry-btn" onClick={() => load()}>Retry</button>
          <button onClick={() => setError(null)} style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#EF9999', padding: 4 }}>
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg>
          </button>
        </div>
      )}

      {/* ── Stat Cards ── */}
      <div id="tour-stat-cards" className="stat-grid">
        {STAT_CARDS.map(c => (
          <div key={c.label} className="stat-card">
            <div className="stat-icon-wrap" style={{ background: c.iconBg || G.hover, color: c.color }}>
              {c.icon}
            </div>
            <div style={{ flex: 1, minWidth: 0 }}>
              <div style={{ fontSize: 11, fontWeight: 700, color: G.muted2, textTransform: 'uppercase', letterSpacing: '.4px', marginBottom: 2 }}>{c.label}</div>
              {loading
                ? <Skel w={48} h={22} r={6} />
                : <div style={{ fontSize: 22, fontWeight: 800, color: G.ink, lineHeight: 1.1, fontFamily: "'Sora',sans-serif" }}>
                    <AnimatedNumber value={c.value} />
                  </div>
              }
              {loading
                ? <Skel w="80%" h={10} r={4} style={{ marginTop: 4 }} />
                : c.sub
                  ? <div style={{ fontSize: 11.5, color: G.muted, fontWeight: 500, marginTop: 2, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{c.sub}</div>
                  : null
              }
            </div>
          </div>
        ))}
      </div>

      <div id="tour-setup-checklist">
        <div id="tour-setup-checklist-anchor" style={{ height: 0 }} />
        <SetupChecklist steps={setupSteps} onNavigate={navigate} loading={loading} />
      </div>

      {/* ── Scheduling Queue ── */}
      <div id="tour-scheduling-queue" style={{ marginBottom: 20 }}>
        <div id="tour-scheduling-queue-anchor" style={{ height: 0 }} />
        <div className="d-card">
            <SectionHeader
              title="Scheduling Queue"
              sub={hasQueue ? (isMyTurn ? 'Your program is active.' : `Waiting on ${currentProg || 'another program'}`) : 'No active scheduling queue'}
              right={
                <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
                  {hasQueue && activeTermLabel && (
                    <Badge label={activeTermLabel} color={G.ink} bg={G.hover} />
                  )}
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
                    <div style={{ padding: '16px 20px', borderRadius: 12, background: G.meadowSoft, border: `1px solid ${G.meadowBorder}`, fontSize: 14, fontWeight: 700, color: 'var(--meadow-text)', display: 'flex', alignItems: 'center', gap: 10 }}>
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

              {/* Schedule Progress embedded in the Queue card to fix layout whitespace */}
              {!loading && approvedInQueue > 0 && (
                <div style={{ marginTop: 24, paddingTop: 24, borderTop: `1px solid ${G.border}` }}>
                  <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 16 }}>
                    <div style={{ fontSize: 15, fontWeight: 800, color: G.ink }}>Combined Progress</div>
                    <Badge label="Live" color={G.meadowDeep} bg={G.meadowSoft} />
                  </div>
                  
                  {/* Approved program chips */}
                  <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8, marginBottom: 16 }}>
                    {(masterInfo?.approvedPrograms || []).map(prog => (
                      <span key={prog} style={{
                        fontSize: 12.5, fontWeight: 700, padding: '6px 14px', borderRadius: 99,
                        background: G.meadowSoft, color: 'var(--meadow-text)', border: `1px solid ${G.meadowBorder}`,
                        display: 'flex', alignItems: 'center', gap: 6,
                      }}>
                        <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3"><polyline points="20 6 9 17 4 12"/></svg>
                        {prog}
                      </span>
                    ))}
                    {queueList.filter(item => {
                      const status = typeof item === 'string' ? 'waiting' : (item.status || 'waiting')
                      return status !== 'approved' && status !== 'skipped'
                    }).map((item, i) => {
                      const prog = typeof item === 'string' ? item : item.program
                      return (
                        <span key={prog} style={{
                          fontSize: 12.5, fontWeight: 600, padding: '6px 14px', borderRadius: 99,
                          background: G.hover, color: G.muted2, border: `1px solid ${G.border}`,
                        }}>
                          {prog}
                        </span>
                      )
                    })}
                  </div>

                  {/* Stats row */}
                  {masterStats && (
                    <div style={{
                      display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 12, marginBottom: 20,
                      padding: '18px 20px', borderRadius: 12, background: G.hover,
                    }}>
                      <div style={{ textAlign: 'center' }}>
                        <div style={{ fontSize: 22, fontWeight: 800, color: G.ink, fontFamily: "'Sora',sans-serif" }}>
                          <AnimatedNumber value={masterStats.totalSessions} />
                        </div>
                        <div style={{ fontSize: 11, fontWeight: 600, color: G.muted2, textTransform: 'uppercase', letterSpacing: '0.3px', marginTop: 2 }}>Sessions</div>
                      </div>
                      <div style={{ textAlign: 'center' }}>
                        <div style={{ fontSize: 22, fontWeight: 800, color: G.ink, fontFamily: "'Sora',sans-serif" }}>
                          <AnimatedNumber value={masterStats.rooms} />
                        </div>
                        <div style={{ fontSize: 11, fontWeight: 600, color: G.muted2, textTransform: 'uppercase', letterSpacing: '0.3px', marginTop: 2 }}>Rooms</div>
                      </div>
                      <div style={{ textAlign: 'center' }}>
                        <div style={{ fontSize: 22, fontWeight: 800, color: G.ink, fontFamily: "'Sora',sans-serif" }}>
                          <AnimatedNumber value={masterStats.faculty} />
                        </div>
                        <div style={{ fontSize: 11, fontWeight: 600, color: G.muted2, textTransform: 'uppercase', letterSpacing: '0.3px', marginTop: 2 }}>Faculty</div>
                      </div>
                    </div>
                  )}

                  {/* Per-program session breakdown */}
                  {masterStats && Object.keys(masterStats.programSessions).length > 0 && (
                    <div style={{ marginBottom: 16 }}>
                      {Object.entries(masterStats.programSessions).map(([prog, count]) => {
                        const pct = masterStats.totalSessions > 0 ? Math.round((count / masterStats.totalSessions) * 100) : 0
                        return (
                          <div key={prog} style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 10 }}>
                            <span style={{ fontSize: 12.5, fontWeight: 700, color: G.ink, minWidth: 70 }}>{prog}</span>
                            <div style={{ flex: 1, height: 8, borderRadius: 99, background: G.borderLight, overflow: 'hidden' }}>
                              <div style={{ height: '100%', borderRadius: 99, width: `${pct}%`, background: G.meadow, animation: 'barIn .8s cubic-bezier(.4,0,.15,1) both' }} />
                            </div>
                            <span style={{ fontSize: 12, fontWeight: 600, color: G.muted2, minWidth: 60, textAlign: 'right' }}>{count} ({pct}%)</span>
                          </div>
                        )
                      })}
                    </div>
                  )}

                  {/* View Combined Schedule button */}
                  <button
                    onClick={() => navigate('/coordinator/schedules/master')}
                    style={{
                      width: '100%', padding: '12px 20px', borderRadius: 12, border: `1.5px solid ${G.meadowBorder}`,
                      background: G.meadowSoft, color: 'var(--meadow-text)', fontSize: 13.5, fontWeight: 700,
                      cursor: 'pointer', fontFamily: "'Inter',sans-serif", display: 'flex', alignItems: 'center',
                      justifyContent: 'center', gap: 8, transition: 'all .15s',
                    }}
                    onMouseEnter={e => { e.currentTarget.style.background = G.meadow; e.currentTarget.style.color = '#fff'; e.currentTarget.style.borderColor = G.meadowDeep }}
                    onMouseLeave={e => { e.currentTarget.style.background = G.meadowSoft; e.currentTarget.style.color = G.meadowDeep; e.currentTarget.style.borderColor = G.meadowBorder }}
                  >
                    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"><rect x="3" y="3" width="7" height="7" rx="1"/><rect x="14" y="3" width="7" height="7" rx="1"/><rect x="3" y="14" width="7" height="7" rx="1"/><rect x="14" y="14" width="7" height="7" rx="1"/></svg>
                    View Combined Schedule →
                  </button>
                </div>
              )}
            </div>
          </div>
      </div>

      {/* ── Analytics: Courses by Semester / Room Coverage ──
          Full-width row of its own (not nested inside one half of the
          bottom row below) so each card gets a proper half of the page
          instead of being squeezed into a quarter of it. */}
      {!loading && courseCount > 0 && (
        <div id="tour-analytics-row" className="cd-analytics-row">
          <div id="tour-analytics-row-anchor" style={{ height: 0, gridColumn: '1 / -1' }} />
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

      {/* ── Bottom Area: Schedules, Insights ── */}
      <div className="cd-bottom-row" style={!hasInsights ? { gridTemplateColumns: '1fr' } : undefined}>
        <div id="tour-my-schedules" style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>
            {/* Small, always-rendered anchor for the tour tooltip. The
                section below (pinned schedule + full recent list) can run
                taller than the viewport, so anchoring the tooltip to the
                whole #tour-my-schedules block left no room above or below
                for it to fit — floating-ui had nowhere good to flip it.
                Anchoring to this instead (while still spotlighting the
                full section via spotlightTarget) gives it a small, stable
                reference point near the top of the section. */}
            <div id="tour-my-schedules-anchor" style={{ height: 0 }} />
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
               <div style={{ padding: '24px', display: 'flex', alignItems: 'center', justifyContent: 'space-between', background: 'var(--surface)' }}>
                  <div>
                    <div style={{ fontSize: 18, fontWeight: 800, color: G.ink, marginBottom: 4 }}>{pinnedSchedule.name || 'Unnamed Schedule'}</div>
                    <div style={{ fontSize: 13, color: G.muted }}>Last updated {pinnedSchedule.updatedAt || 'recently'}</div>
                  </div>
                  <div style={{ display: 'flex', gap: 12 }}>
                    <button onClick={() => navigate('/coordinator/schedules', { state: { scheduleId: pinnedSchedule.id } })} style={{ padding: '10px 20px', borderRadius: 8, background: 'var(--surface)', border: `1px solid ${G.border}`, fontSize: 13, fontWeight: 700, color: G.ink, cursor: 'pointer', boxShadow: '0 2px 4px rgba(0,0,0,0.02)' }}>View Schedule</button>
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
                sub={`${counts.total} total · ${drafts} draft · ${submitted} submitted · ${approved} approved`}
                right={
                  <button onClick={() => navigate('/coordinator/schedules')} style={{ fontSize: 13.5, fontWeight: 700, color: 'var(--meadow-text)', cursor: 'pointer', background: 'none', border: 'none', padding: 0, fontFamily: "'Inter',sans-serif" }}>View all →</button>
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
                        {f === 'all' ? `${counts.total > schedules.length ? 'Recent' : 'All'} (${schedules.length})` : `${SCHED_META(f).label} (${schedStatusCounts[f] || 0})`}
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
                            <button className="cd-icon-btn" style={{ width: 'auto', padding: '0 12px', fontSize: 12, fontWeight: 700, color: 'var(--meadow-text)', borderColor: G.meadowBorder }} onClick={() => handleRename(s.id)} disabled={isBusy}>
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
                <div style={{ width: 48, height: 48, borderRadius: '50%', background: G.meadowSoft, display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'var(--meadow-text)' }}>
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
        </div>
        {hasInsights && (
        <div id="tour-insights" style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>
            {/* Insights */}
          <div id="tour-insights-anchor" style={{ height: 0 }} />
          {!loading && suggestions.length > 1 && (
            <div className="d-card">
              <SectionHeader
                title="Insights & Recommendations"
                sub="Other things to keep in mind"
                right={
                  <div style={{ display: 'flex', gap: 6 }}>
                    {suggestions.some(s => s.type === 'error') && <Badge label={`${suggestions.filter(s => s.type === 'error').length} critical`} color={G.redDeep} bg='rgba(220, 38, 38, 0.1)' />}
                    {suggestions.some(s => s.type === 'warning') && <Badge label={`${suggestions.filter(s => s.type === 'warning').length} warnings`} color={G.amber} bg={G.amberSoft} />}
                  </div>
                }
              />
              <div style={{ padding: '20px', display: 'flex', flexDirection: 'column', gap: 12 }}>
                {suggestions.slice(1).map((s, i) => <SuggestionCard key={s.id} suggestion={s} navigate={navigate} delay={i * 0.04} />)}
              </div>
            </div>
          )}
        </div>
        )}
      </div>

      <ToastContainer toasts={toasts} />
    </div>
  )
}