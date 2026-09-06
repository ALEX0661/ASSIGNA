import { useEffect, useState, useRef } from 'react'
import { useNavigate } from 'react-router-dom'
import { useAuth } from '../../hooks/useAuth'
import {
  getDashboardStats, getWorkload, listSaved, loadSaved,
  getAssignmentQuality, getScheduleDistribution,
} from '../../services/api'
import { useScheduleStore } from '../../store/scheduleStore'
import { useTour } from '../../hooks/useTour.jsx'

const TOUR_SEEN_KEY = 'adminDashboard_tourSeen'
function isOnboardingCompleted() {
  try { return localStorage.getItem(TOUR_SEEN_KEY) === '1' } catch { return true }
}
function markOnboardingCompleted() {
  try { localStorage.setItem(TOUR_SEEN_KEY, '1') } catch {}
}

/* ─── Global keyframes & utility classes ─────────────────────────────────── */
const DASH_STYLE = `
  @keyframes shimmer {
    0%   { background-position: -600px 0 }
    100% { background-position:  600px 0 }
  }
  @keyframes barIn { from { width: 0 } }
  @keyframes spin { to { transform:rotate(360deg) } }
  @keyframes pulseGlow {
    0%,100% { box-shadow: 0 0 0 0 rgba(110,231,183,0.4) }
    50%     { box-shadow: 0 0 0 6px rgba(110,231,183,0) }
  }
  .skel {
    background: linear-gradient(90deg,var(--hover) 25%,var(--border) 50%,var(--hover) 75%);
    background-size: 600px 100%;
    animation: shimmer 1.4s ease-in-out infinite;
    border-radius: 7px;
  }
  .d-card {
    background: var(--surface);
    border-radius: 14px;
    border: 1px solid var(--border);
    box-shadow: 0 1px 8px rgba(0,0,0,0.06);
    overflow: visible;
  }
  .d-row { cursor:pointer; transition:background 0.13s; }
  .d-row:hover { background: var(--hover) !important; }
  .stat-card {
    background: var(--surface);
    border-radius: 14px;
    border: 1px solid var(--border);
    box-shadow: 0 1px 8px rgba(0,0,0,0.06);
    padding: 18px 20px 16px;
    transition: box-shadow .18s, transform .18s;
    display: flex;
    flex-direction: column;
    gap: 10px;
    min-width: 0;
  }
  .stat-card:hover {
    box-shadow: 0 4px 18px rgba(0,0,0,0.1);
    transform: translateY(-2px);
  }
  .setup-row {
    display: flex;
    align-items: center;
    gap: 14px;
    padding: 12px 18px;
    cursor: pointer;
    background: var(--surface);
    transition: background 0.12s;
  }
  .setup-row:hover { background: var(--hover); }
  .suggestion-card {
    border-radius: 12px;
    padding: 12px 14px;
    display: flex;
    align-items: flex-start;
    gap: 11px;
    cursor: default;
    transition: transform .15s, box-shadow .15s;
    border: 1px solid transparent;
  }
  .suggestion-card:hover {
    transform: translateY(-1px);
    box-shadow: 0 4px 14px rgba(0,0,0,0.1);
  }

  /* ── Responsive grid ── */
  .stat-grid {
    display: grid;
    grid-template-columns: repeat(5, minmax(0, 1fr));
    gap: 12px;
  }
  @media (max-width: 1280px) {
    .stat-grid { grid-template-columns: repeat(auto-fit, minmax(220px, 1fr)); }
  }
  @media (max-width: 640px) {
    .stat-grid { grid-template-columns: repeat(1, minmax(0, 1fr)); }
  }
`

/* ─── Helpers ─────────────────────────────────────────────────────────────── */
function Skel({ w = '100%', h = 14, r = 7, style = {} }) {
  return <div className="skel" style={{ width:w, height:h, borderRadius:r, flexShrink:0, ...style }} />
}

function SectionHeader({ title, sub, right }) {
  return (
    <div style={{ padding:'14px 18px', borderBottom:'1px solid var(--border)', display:'flex', alignItems:'center', justifyContent:'space-between', gap:8 }}>
      <div>
        <div style={{ fontSize:13, fontWeight:700, color:'var(--ink)' }}>{title}</div>
        {sub && <div style={{ fontSize:11, color:'var(--muted2)', marginTop:1 }}>{sub}</div>}
      </div>
      {right && <div style={{ flexShrink:0 }}>{right}</div>}
    </div>
  )
}

function Badge({ label, color, bg }) {
  return (
    <span style={{ fontSize:10.5, fontWeight:700, padding:'3px 9px', borderRadius:99, background:bg||'var(--hover)', color:color||'var(--muted)' }}>
      {label}
    </span>
  )
}

/* ─── Animated counter ───────────────────────────────────────────────────── */
function AnimatedNumber({ value, duration = 800 }) {
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
  }, [value])
  return <>{display}</>
}

/* ─── Donut chart (pure SVG) ─────────────────────────────────────────────── */
function DonutChart({ segments, size = 120, stroke = 22, label, sublabel }) {
  const r = (size - stroke) / 2
  const circ = 2 * Math.PI * r
  const total = segments.reduce((s, x) => s + (x.value||0), 0) || 1
  let offset = 0
  return (
    <div style={{ position:'relative', width:size, height:size, flexShrink:0 }}>
      <svg width={size} height={size} style={{ transform:'rotate(-90deg)' }}>
        <circle cx={size/2} cy={size/2} r={r} fill="none" stroke="var(--hover)" strokeWidth={stroke}/>
        {segments.map((seg, i) => {
          const dash = (seg.value / total) * circ
          const gap  = circ - dash
          const arc = (
            <circle key={i} cx={size/2} cy={size/2} r={r} fill="none"
              stroke={seg.color} strokeWidth={stroke}
              strokeDasharray={`${dash} ${gap}`} strokeDashoffset={-offset}
              strokeLinecap="butt"
              style={{ transition:'stroke-dasharray 0.9s cubic-bezier(.4,0,.15,1)' }}
            />
          )
          offset += dash
          return arc
        })}
      </svg>
      <div style={{ position:'absolute', inset:0, display:'flex', flexDirection:'column', alignItems:'center', justifyContent:'center' }}>
        <span style={{ fontSize:22, fontWeight:800, color:'var(--ink)', lineHeight:1, fontFamily:"'Sora',sans-serif" }}>{label}</span>
        {sublabel && <span style={{ fontSize:9.5, color:'var(--muted2)', marginTop:2, fontWeight:600 }}>{sublabel}</span>}
      </div>
    </div>
  )
}

/* ─── Horizontal bar (courses / programs) ───────────────────────────────── */
function HorizBar({ label, value, max, color, pct: pctProp }) {
  const pct = pctProp ?? (max > 0 ? Math.round(value / max * 100) : 0)
  return (
    <div style={{ marginBottom:10 }}>
      <div style={{ display:'flex', justifyContent:'space-between', marginBottom:4 }}>
        <span style={{ fontSize:11.5, fontWeight:600, color:'var(--ink)' }}>{label}</span>
        <span style={{ fontSize:11, fontWeight:700, color }}>
          {value} <span style={{ fontWeight:400, color:'var(--muted2)' }}>({pct}%)</span>
        </span>
      </div>
      <div style={{ height:8, borderRadius:99, background:'var(--hover)', overflow:'hidden' }}>
        <div style={{ height:'100%', borderRadius:99, width:`${pct}%`, background:color, animation:'barIn .8s cubic-bezier(.4,0,.15,1) both' }}/>
      </div>
    </div>
  )
}

/* ─── Mini workload bar ─────────────────────────────────────────────────── */
function MiniBar({ label, value, max, onClick, tier }) {
  const pct  = Math.min(100, Math.round((value / Math.max(max, 1)) * 100))
  const over = value > max
  const warn = pct >= 85 && !over
  const c = over ? '#EF4444' : warn ? '#F59E0B' : 'var(--meadow)'
  const b = over ? 'rgba(220, 38, 38, 0.1)' : warn ? 'rgba(217, 119, 6, 0.1)' : '#E6FAF3'
  return (
    <div className="d-row" onClick={onClick}
      style={{ display:'flex', alignItems:'center', gap:12, padding:'9px 16px', borderBottom:'1px solid var(--border)' }}>
      <div style={{ width:30, height:30, borderRadius:8, background:b, color:c, display:'flex', alignItems:'center', justifyContent:'center', fontSize:9.5, fontWeight:800, flexShrink:0, fontFamily:"'Sora',sans-serif" }}>
        {label.split(' ').map(n=>n[0]).join('').slice(0,2)}
      </div>
      <div style={{ flex:1, minWidth:0 }}>
        <div style={{ display:'flex', justifyContent:'space-between', alignItems:'center', marginBottom:5 }}>
          <span style={{ fontSize:12, fontWeight:600, color:'var(--ink)', overflow:'hidden', textOverflow:'ellipsis', whiteSpace:'nowrap', flex:1, marginRight:8 }}>{label}</span>
          <div style={{ display:'flex', alignItems:'center', gap:5, flexShrink:0 }}>
            {tier && <span style={{ fontSize:9, fontWeight:600, color:'var(--muted2)', background:'var(--hover)', padding:'1px 6px', borderRadius:4 }}>{tier}</span>}
            <span style={{ fontSize:10.5, fontWeight:700, color:c }}>{value}/{max}u</span>
          </div>
        </div>
        <div style={{ height:5, borderRadius:99, background:'var(--hover)', overflow:'hidden' }}>
          <div style={{ height:'100%', borderRadius:99,
            background: over ? 'linear-gradient(90deg,#EF4444,#C0392B)' : warn ? 'linear-gradient(90deg,#FBBF24,#D97706)' : `linear-gradient(90deg,var(--mint),${c})`,
            width:`${pct}%`, animation:'barIn 0.8s cubic-bezier(.4,0,.15,1) both' }}/>
        </div>
      </div>
    </div>
  )
}

/* ─── Day heatmap cell ──────────────────────────────────────────────────── */
function HeatCell({ count, max, label }) {
  const intensity = max > 0 ? count / max : 0
  const bg = intensity === 0 ? 'var(--hover)' : `rgba(0,0,0,${0.12 + intensity * 0.75})`
  const textColor = intensity > 0.5 ? 'var(--surface)' : 'var(--ink)'
  return (
    <div style={{ flex:1, display:'flex', flexDirection:'column', alignItems:'center', gap:4 }}>
      <div style={{ width:'100%', height:52, borderRadius:10, background:bg, display:'flex', alignItems:'center', justifyContent:'center', transition:'background .3s' }}>
        <span style={{ fontSize:16, fontWeight:800, color:textColor, fontFamily:"'Sora',sans-serif" }}>{count}</span>
      </div>
      <span style={{ fontSize:9.5, fontWeight:600, color:'var(--muted2)' }}>{label}</span>
    </div>
  )
}

/* ─── Score ring ─────────────────────────────────────────────────────────── */
function ScoreRing({ score, label, color = 'var(--meadow)' }) {
  const size = 76; const stroke = 9
  const r = (size - stroke) / 2
  const circ = 2 * Math.PI * r
  const filled = (score / 100) * circ
  return (
    <div style={{ display:'flex', flexDirection:'column', alignItems:'center', gap:5 }}>
      <div style={{ position:'relative', width:size, height:size }}>
        <svg width={size} height={size} style={{ transform:'rotate(-90deg)' }}>
          <circle cx={size/2} cy={size/2} r={r} fill="none" stroke="var(--hover)" strokeWidth={stroke}/>
          <circle cx={size/2} cy={size/2} r={r} fill="none" stroke={color} strokeWidth={stroke}
            strokeDasharray={`${filled} ${circ-filled}`} strokeLinecap="round"
            style={{ transition:'stroke-dasharray 1s cubic-bezier(.4,0,.15,1)' }}/>
        </svg>
        <div style={{ position:'absolute', inset:0, display:'flex', alignItems:'center', justifyContent:'center' }}>
          <span style={{ fontSize:15, fontWeight:800, color:'var(--ink)', fontFamily:"'Sora',sans-serif" }}>{score}%</span>
        </div>
      </div>
      <span style={{ fontSize:10, fontWeight:600, color:'var(--muted2)', textAlign:'center', lineHeight:1.3 }}>{label}</span>
    </div>
  )
}

/* ─── Suggestion card ────────────────────────────────────────────────────── */
const SUGGESTION_STYLES = {
  error:   { bg:'rgba(220, 38, 38, 0.05)', border:'rgba(220, 38, 38, 0.25)', icon:'#EF4444', dot:'#EF4444', label:'Critical' },
  warning: { bg:'rgba(245, 158, 11, 0.05)', border:'rgba(245, 158, 11, 0.25)', icon:'#F59E0B', dot:'#F59E0B', label:'Warning'  },
  info:    { bg:'rgba(37, 99, 235, 0.1)', border:'#BFDBFE', icon:'#60A5FA', dot:'#3B82F6', label:'Info'     },
  success: { bg:'var(--meadow-soft)', border:'var(--meadow-border)', icon:'var(--meadow)', dot:'var(--meadow)', label:'Good'     },
}

const SUGGESTION_ICONS = {
  error: <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><circle cx="12" cy="12" r="10"/><line x1="12" y1="8" x2="12" y2="12"/><line x1="12" y1="16" x2="12.01" y2="16"/></svg>,
  warning: <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M10.29 3.86L1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z"/><line x1="12" y1="9" x2="12" y2="13"/><line x1="12" y1="17" x2="12.01" y2="17"/></svg>,
  info: <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><circle cx="12" cy="12" r="10"/><line x1="12" y1="16" x2="12" y2="12"/><line x1="12" y1="8" x2="12.01" y2="8"/></svg>,
  success: <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><polyline points="20 6 9 17 4 12"/></svg>,
}

function SuggestionCard({ suggestion, onAction, delay = 0 }) {
  const navigate = useNavigate()
  const s = SUGGESTION_STYLES[suggestion.type] || SUGGESTION_STYLES.info
  return (
    <div className="suggestion-card"
      style={{ background:s.bg, borderColor:s.border, animationDelay:`${delay}s` }}>
      <div style={{ width:28, height:28, borderRadius:8, background: suggestion.type === 'error' ? 'rgba(220, 38, 38, 0.25)' : suggestion.type === 'warning' ? 'rgba(245, 158, 11, 0.25)' : suggestion.type === 'success' ? 'var(--meadow-border)' : '#BFDBFE',
        color:s.icon, display:'flex', alignItems:'center', justifyContent:'center', flexShrink:0, marginTop:1 }}>
        {SUGGESTION_ICONS[suggestion.type]}
      </div>
      <div style={{ flex:1, minWidth:0 }}>
        <div style={{ display:'flex', alignItems:'center', gap:6, marginBottom:3 }}>
          <span style={{ fontSize:12, fontWeight:700, color:'var(--ink)' }}>{suggestion.title}</span>
          <span style={{ fontSize:9.5, fontWeight:700, padding:'1px 7px', borderRadius:99, background:s.dot, color: '#fff' }}>{s.label}</span>
        </div>
        <p style={{ fontSize:11, color:'var(--muted)', margin:0, lineHeight:1.5 }}>{suggestion.body}</p>
        {suggestion.action && (
          <button onClick={() => navigate(suggestion.action.href)}
            style={{ marginTop:6, padding:'4px 11px', borderRadius:7, border:'none', fontSize:10.5, fontWeight:600, cursor:'pointer', fontFamily:'Inter,sans-serif',
              background: s.icon, color: '#fff', transition:'opacity .15s' }}
            onMouseEnter={e => e.currentTarget.style.opacity='.85'}
            onMouseLeave={e => e.currentTarget.style.opacity='1'}>
            {suggestion.action.label} →
          </button>
        )}
      </div>
    </div>
  )
}

/* ─── Setup Checklist ─────────────────────────────────────────────────────
   Self-contained component: always mounted, manages its own open/close
   state, and always renders SOMETHING (never returns null) so it can never
   be mistaken for "not there." Pass it `steps: [{done,title,desc,cta,href}]`.
──────────────────────────────────────────────────────────────────────────── */
function SetupChecklist({ steps, onNavigate, loading }) {
  const [open, setOpen] = useState(false)

  if (loading) {
    return (
      <div style={{ background: 'var(--surface)', borderRadius:12, border:'1px solid var(--border)', padding:'14px 18px', display:'flex', alignItems:'center', gap:12, boxShadow:'0 1px 6px rgba(0,0,0,0.05)' }}>
        <Skel w={30} h={30} r={99}/>
        <Skel w={180} h={12} r={4}/>
      </div>
    )
  }

  const total     = steps.length
  const doneCount = steps.filter(s => s.done).length
  const nextIdx   = steps.findIndex(s => !s.done)
  const allDone   = nextIdx === -1

  if (allDone) {
    return (
      <div style={{ background:'var(--meadow-soft)', borderRadius:12, border:'1px solid var(--meadow-border)', display:'flex', alignItems:'center', gap:12, padding:'12px 18px', boxShadow:'0 1px 6px rgba(0,0,0,0.05)' }}>
        <div style={{ width:26, height:26, borderRadius:'50%', flexShrink:0, background: 'var(--meadow)', color: '#fff', display:'flex', alignItems:'center', justifyContent:'center' }}>
          <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3"><polyline points="20 6 9 17 4 12"/></svg>
        </div>
        <div style={{ fontSize:12.5, fontWeight:700, color: 'var(--ink)' }}>Setup complete — everything is loaded and ready to schedule.</div>
      </div>
    )
  }

  return (
    <div style={{ background: 'var(--surface)', borderRadius:12, border:'1px solid var(--border)', boxShadow:'0 1px 6px rgba(0,0,0,0.05)', width:'100%' }}>
      {/* ── Toggle header ── */}
      <div
        onClick={() => setOpen(v => !v)}
        style={{ display:'flex', alignItems:'center', gap:12, padding:'13px 16px', background:'var(--meadow-soft)', cursor:'pointer', borderBottom: open ? '1px solid var(--meadow-soft)' : 'none', userSelect:'none', borderRadius: open ? '12px 12px 0 0' : 12 }}
      >
        {/* Done counter badge */}
        <div style={{ width:30, height:30, borderRadius:'50%', flexShrink:0, background: 'var(--meadow)', color: '#fff', display:'flex', alignItems:'center', justifyContent:'center', fontSize:11, fontWeight:800, fontFamily:"'Sora',sans-serif" }}>
          {doneCount}/{total}
        </div>

        {/* Title + subtitle */}
        <div style={{ flex:1, minWidth:0 }}>
          <div style={{ fontSize:13, fontWeight:800, color: 'var(--ink)', fontFamily:"'Sora',sans-serif" }}>Setup Checklist</div>
          <div style={{ fontSize:11, color: 'var(--meadow-text)', fontWeight:600, marginTop:1 }}>
            {open ? 'Click to collapse' : `Next: ${steps[nextIdx]?.label}`}
          </div>
        </div>

        {/* Progress bar */}
        <div style={{ width:80, height:5, borderRadius:99, background:'var(--meadow-border)', overflow:'hidden', flexShrink:0 }}>
          <div style={{ height:'100%', borderRadius:99, width:`${(doneCount/total)*100}%`, background: 'var(--meadow)', transition:'width .4s ease' }}/>
        </div>

        {/* Chevron */}
        <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="var(--meadow)" strokeWidth="2.5"
          style={{ transform: open ? 'rotate(180deg)' : 'none', transition:'transform .2s', flexShrink:0 }}>
          <polyline points="6 9 12 15 18 9"/>
        </svg>
      </div>

      {/* ── Step rows ── */}
      {open && (
        <div style={{ borderRadius:'0 0 12px 12px', overflow:'hidden' }}>
          {steps.map((step, i) => (
            <div key={step.label}
              style={{ display:'flex', alignItems:'center', gap:12, padding:'12px 16px', borderBottom: i < steps.length - 1 ? '1px solid var(--hover)' : 'none', background: step.done ? 'var(--hover)' : i === nextIdx ? 'var(--meadow-soft)' : 'var(--surface)' }}
            >
              {/* Circle */}
              <div style={{
                width:24, height:24, borderRadius:'50%', flexShrink:0,
                display:'flex', alignItems:'center', justifyContent:'center',
                fontSize:10.5, fontWeight:800, fontFamily:"'Sora',sans-serif",
                background: step.done ? 'var(--meadow)' : i === nextIdx ? 'var(--meadow-soft)' : 'var(--hover)',
                color:      step.done ? '#ffffff' : i === nextIdx ? 'var(--meadow)' : 'var(--muted2)',
                border: i === nextIdx && !step.done ? '2px solid var(--meadow)' : '2px solid transparent',
              }}>
                {step.done
                  ? <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3"><polyline points="20 6 9 17 4 12"/></svg>
                  : i + 1}
              </div>

              {/* Text */}
              <div style={{ flex:1, minWidth:0 }}>
                <div style={{ fontSize:12.5, fontWeight:700, color: step.done ? 'var(--muted2)' : 'var(--ink)', marginBottom:2, textDecoration: step.done ? 'line-through' : 'none' }}>
                  {step.label}
                </div>
                <div style={{ fontSize:11, color: 'var(--muted2)', lineHeight:1.45 }}>
                  {step.desc}
                </div>
              </div>

              {/* CTA button */}
              {!step.done && (
                <button
                  onClick={(e) => { e.stopPropagation(); onNavigate(step.href) }}
                  style={{ flexShrink:0, padding:'6px 13px', borderRadius:8, border:'none', background: 'var(--meadow)', color: '#fff', fontSize:11, fontWeight:600, cursor:'pointer', fontFamily:"'Inter',sans-serif", whiteSpace:'nowrap' }}
                  onMouseEnter={e => e.currentTarget.style.background='var(--meadow-deep)'}
                  onMouseLeave={e => e.currentTarget.style.background='var(--meadow)'}
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

/* ─── PROGRAM COLORS ─────────────────────────────────────────────────────── */
const PROG_COLORS = ['var(--meadow)','#60A5FA','#7C3AED','#F59E0B','#0891B2','#EF4444','#0F766E','#9333EA']

/* ─── Main Page ──────────────────────────────────────────────────────────── */
export default function DashboardPage() {
  const { user }  = useAuth()
  const { scheduleName, setName, clearSchedule } = useScheduleStore()
  const navigate  = useNavigate()

  // Data states
  const [dashStats,    setDashStats]    = useState(null)   // from /analytics/dashboard-stats
  const [workload,     setWorkload]     = useState(null)
  const [savedList,    setSavedList]    = useState([])
  const [distribution, setDistribution] = useState(null)
  const [quality,      setQuality]      = useState(null)
  const [suggestions,  setSuggestions]  = useState([])

  // Loading states
  const [statsLoading, setStatsLoading] = useState(true)
  const [wlLoading,    setWlLoading]    = useState(true)
  const [distLoading,  setDistLoading]  = useState(true)
  const [showAllWl,    setShowAllWl]    = useState(false)
  const [error,        setError]        = useState(null)

  const { TourElement, startTour } = useTour('adminDashboard', [
    {
      target: '#tour-admin-stats',
      title: 'Your Overview',
      content: 'A live snapshot of the system — faculty, courses, rooms, and schedules. Watch these counts as you set things up; they double as a quick check that each step of onboarding actually went through.',
      placement: 'bottom',
      disableBeacon: true,
    },
    {
      target: '#tour-admin-setup',
      title: 'Setup Checklist',
      content: 'The recommended path to your first generated schedule, in order. Each item links straight to where you need to go, and checks itself off automatically once that step is detected as done — so you always know what\'s left.',
      placement: 'top',
    },
    {
      target: '#tour-admin-health',
      title: 'Schedule Health',
      content: 'Once a schedule is loaded, this checks it for problems — room/faculty coverage, unresolved conflicts, and any faculty over or near their unit cap. Green means clear; anything red or amber is worth fixing before you finalize.',
      placement: 'bottom',
    },
    {
      target: '#tour-admin-scheduler',
      title: 'Run the Scheduler',
      content: 'Once faculty, courses, and rooms are in place, this is where you generate the actual timetable — pick a semester, check Readiness, and start the solver.',
      placement: 'left',
    },
    {
      target: '#tour-admin-breakdowns',
      title: 'Course Breakdowns',
      content: 'A quick read on how your curriculum is shaped — how courses split across semesters and which programs they belong to. Useful for spotting an imbalance before you generate a schedule.',
      placement: 'top',
    },
    {
      target: '#tour-admin-snapshot',
      title: 'Year Level & Faculty Mix',
      content: 'Rounds out the picture: how courses are spread across year levels, and your full-time vs. part-time faculty split — both worth checking if the scheduler ever comes back with unexpected results.',
      placement: 'top',
    },
  ])

  

  useEffect(() => {
    let cancelled = false
    async function load() {
      // Core stats — single aggregated call
      try {
        const [stats, saved] = await Promise.all([
          getDashboardStats(),
          listSaved().catch(() => []),
        ])
        if (cancelled) return
        setDashStats(stats)
        setSuggestions(stats.suggestions || [])
        setSavedList(Array.isArray(saved) ? saved : (saved?.schedules ?? []))
      } catch (err) {
        if (!cancelled) setError({ title:'Failed to load stats', message: err?.response?.data?.detail || err.message || 'Server unreachable.' })
      } finally {
        if (!cancelled) setStatsLoading(false)
      }

      // Workload
      try {
        const wl = await getWorkload()
        if (!cancelled) setWorkload(wl.workload)
      } catch {}
      finally { if (!cancelled) setWlLoading(false) }

      // Distribution + quality (schedule-dependent)
      try {
        const [dist, qual] = await Promise.allSettled([getScheduleDistribution(), getAssignmentQuality()])
        if (!cancelled) {
          if (dist.status === 'fulfilled') setDistribution(dist.value)
          if (qual.status === 'fulfilled') setQuality(qual.value)
        }
      } catch {}
      finally { if (!cancelled) setDistLoading(false) }
    }
    load()
    return () => { cancelled = true }
  }, [])

  async function loadSchedule(name) {
    setWlLoading(true); setDistLoading(true)
    try {
      await loadSaved(name); setName(name)
      const [wl, dist, qual, stats] = await Promise.allSettled([
        getWorkload(), getScheduleDistribution(), getAssignmentQuality(), getDashboardStats(),
      ])
      if (wl.status    === 'fulfilled') setWorkload(wl.value.workload)
      if (dist.status  === 'fulfilled') setDistribution(dist.value)
      if (qual.status  === 'fulfilled') setQuality(qual.value)
      if (stats.status === 'fulfilled') {
        setDashStats(stats.value)
        setSuggestions(stats.value.suggestions || [])
      }
    } catch (err) {
      setError({ title:`Failed to load "${name}"`, message: err?.response?.data?.detail || err.message })
    }
    finally { setWlLoading(false); setDistLoading(false) }
  }

  /* ── Derived ── */
  const wlRows   = workload ? [...workload].sort((a,b)=>(b.assigned/Math.max(b.max_units,1))-(a.assigned/Math.max(a.max_units,1))) : []
  const overList = wlRows.filter(f => f.overloaded)
  const atRisk   = wlRows.filter(f => !f.overloaded && (f.assigned/Math.max(f.max_units,1)) >= 0.85)
  const ok       = wlRows.filter(f => !f.overloaded && (f.assigned/Math.max(f.max_units,1)) < 0.85)
  const visWl    = showAllWl ? wlRows : wlRows.slice(0, 8)

  const donutSegs = [
    { label:'Over cap',  value: overList.length, color:'#EF4444' },
    { label:'Near cap',  value: atRisk.length,   color:'#F59E0B' },
    { label:'Healthy',   value: ok.length,        color: 'var(--meadow-text)' },
  ]

  const DAYS = ['Mon','Tue','Wed','Thu','Fri','Sat']
  const dayData = distribution?.byDay || []
  const dayCounts = DAYS.map(short => {
    const full = { Mon:'Monday', Tue:'Tuesday', Wed:'Wednesday', Thu:'Thursday', Fri:'Friday', Sat:'Saturday' }[short]
    const row = dayData.find(d => d.day === full)
    return row ? row.sessions : 0
  })
  const maxDay = Math.max(...dayCounts, 1)

  const specScore  = quality?.pctInWindow     ?? null
  const balScore   = quality?.autoAssignPct   ?? null
  const coverScore = quality?.pctOnPreferredDays ?? null

  const hr = new Date().getHours()
  const greeting     = hr < 12 ? 'Good morning' : hr < 17 ? 'Good afternoon' : 'Good evening'
  
  let displayName = 'ADMIN'
  if (user?.displayName) {
    // If it's a "Last, First" format, let's grab the First Name
    if (user.displayName.includes(',')) {
      displayName = user.displayName.split(',')[1].trim()
    } else {
      displayName = user.displayName.split(' ')[0]
    }
    displayName = displayName.toUpperCase()
  } else if (user?.email) {
    displayName = user.email.split('@')[0].toUpperCase()
  }

  // Courses breakdown
  const crs    = dashStats?.courses || {}
  const bySem  = crs.bySemester  || {}
  const byProg = crs.byProgram   || {}
  const semTotal   = Object.values(bySem).reduce((s, v) => s + v, 0) || 1
  const progTotal  = Object.values(byProg).reduce((s, v) => s + v, 0) || 1
  const progEntries = Object.entries(byProg).sort((a, b) => b[1] - a[1])

  // Stat cards config
  const fac  = dashStats?.faculty  || {}
  const rms  = dashStats?.rooms    || {}
  const sch  = dashStats?.scheduleHealth || {}

  // Stat cards — redesigned with icons instead of left border
  const STAT_CARDS = [
    {
      label: 'Total Faculty',
      color: 'var(--meadow-text)',
      bg: 'var(--meadow-soft)',
      icon: <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2"/><circle cx="9" cy="7" r="4"/><path d="M23 21v-2a4 4 0 0 0-3-3.87"/><path d="M16 3.13a4 4 0 0 1 0 7.75"/></svg>,
      value: statsLoading ? null : (fac.total ?? '—'),
      sub: fac.total > 0 ? `${fac.fullTime||0} full-time · ${fac.partTime||0} part-time` : null,
      subColor: 'var(--muted2)',
    },
    {
      label: 'Total Courses',
      color: '#60A5FA',
      bg: 'rgba(37, 99, 235, 0.1)',
      icon: <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M4 19.5v-15A2.5 2.5 0 0 1 6.5 2H20v20H6.5a2.5 2.5 0 0 1 0-5H20"/></svg>,
      value: statsLoading ? null : (crs.total ?? '—'),
      sub: (bySem['1st Semester']||bySem['2nd Semester']||bySem['Midyear'])
        ? `${bySem['1st Semester']||0} 1st · ${bySem['2nd Semester']||0} 2nd · ${bySem['Midyear']||0} Mid`
        : null,
      subColor: 'var(--muted2)',
    },
    {
      label: 'Rooms',
      color: '#7C3AED',
      bg: 'rgba(124, 58, 237, 0.1)',
      icon: <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M3 9l9-7 9 7v11a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z"/><polyline points="9 22 9 12 15 12 15 22"/></svg>,
      value: statsLoading ? null : (rms.total ?? '—'),
      sub: rms.total > 0 ? `${rms.lecture||0} lecture · ${rms.lab||0} lab` : null,
      subColor: 'var(--muted2)',
    },
    {
      label: 'Specializations',
      color: '#0891B2',
      bg: 'rgba(8, 145, 178, 0.1)',
      icon: <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><polygon points="12 2 15.09 8.26 22 9.27 17 14.14 18.18 21.02 12 17.77 5.82 21.02 7 14.14 2 9.27 8.91 8.26 12 2"/></svg>,
      value: statsLoading ? null : (fac.withSpecializations ?? '—'),
      sub: fac.total > 0
        ? (fac.withoutSpecializations > 0 ? `${fac.withoutSpecializations} missing` : 'All covered')
        : null,
      subColor: fac.withoutSpecializations > 0 ? '#F59E0B' : 'var(--meadow)',
    },
    {
      label: 'Schedules',
      color: '#F59E0B',
      bg: 'rgba(245, 158, 11, 0.05)',
      icon: <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><rect x="3" y="4" width="18" height="18" rx="2" ry="2"/><line x1="16" y1="2" x2="16" y2="6"/><line x1="8" y1="2" x2="8" y2="6"/><line x1="3" y1="10" x2="21" y2="10"/></svg>,
      value: statsLoading ? null : savedList.length,
      sub: scheduleName ? `Active: ${scheduleName}` : 'None loaded',
      subColor: scheduleName ? '#F59E0B' : 'var(--muted2)',
    },
  ]

  // ── Setup checklist steps ──
  const obSteps = [
    { done: (fac.total||0) > 0,                                                label: 'Load Faculty',    desc: 'Add faculty members and assign their course specializations so the solver knows who can teach what.',       cta: 'Go to Faculty',   href: '/dashboard/faculty'   },
    { done: (crs.total||0) > 0,                                                label: 'Load Courses',    desc: 'Import the course catalog with codes, units, and semester info before generating a schedule.',              cta: 'Go to Courses',   href: '/dashboard/courses'   },
    { done: (rms.total||0) > 0,                                                label: 'Configure Rooms', desc: 'Add lecture and lab rooms. The solver needs these to assign a venue to every class.',                       cta: 'Go to Settings',  href: '/dashboard/settings'  },
    { done: (fac.total||0)>0 && (crs.total||0)>0 && (rms.total||0)>0,         label: 'Run Scheduler',   desc: 'Go to the Scheduler, select a semester, check Readiness, then click Start Solver to generate the timetable.', cta: 'Go to Scheduler', href: '/dashboard/scheduler' },
    { done: !!scheduleName,                                                    label: 'Review Schedule', desc: 'Inspect the generated timetable, override any assignments, then save it.',                                  cta: 'View Schedule',   href: scheduleName ? `/dashboard/schedule/${encodeURIComponent(scheduleName)}` : '/dashboard/schedule'  },
  ]

  return (
    <div className="page" style={{ padding:'22px 28px 40px', fontFamily:"'Inter',sans-serif", display:'flex', flexDirection:'column', gap:18, background:'var(--bg)', minHeight:'100%' }}>
      {TourElement}
      <style>{DASH_STYLE}</style>

      {/* ── Row 1: Header ── */}
      <div style={{ display:'flex', alignItems:'center', justifyContent:'space-between', flexWrap:'wrap', gap:12 }}>
        <div>
          <h1 style={{ fontSize:22, fontWeight:800, color:'var(--ink)', letterSpacing:'-.4px', fontFamily:"'Sora',sans-serif", lineHeight:1.15, margin:0 }}>
            {greeting}, {displayName}.
          </h1>
        </div>
        <button id="tour-admin-scheduler" onClick={() => navigate('/dashboard/scheduler')}
          style={{ display:'flex', alignItems:'center', gap:7, padding:'9px 18px', borderRadius:10, border:'none', background:'linear-gradient(135deg,var(--meadow),var(--meadow-deep))', color: '#fff', fontSize:12.5, fontWeight:600, cursor:'pointer', fontFamily:'Inter,sans-serif', boxShadow:'0 4px 14px rgba(0,0,0,0.28)', transition:'opacity .15s' }}
          onMouseEnter={e=>e.currentTarget.style.opacity='.9'}
          onMouseLeave={e=>e.currentTarget.style.opacity='1'}>
          <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"><polygon points="5 3 19 12 5 21 5 3"/></svg>
          Run Scheduler
        </button>
      </div>

      {/* ── Setup Checklist — always mounted; renders its own empty/complete state ── */}
      <div id="tour-admin-setup">
        <SetupChecklist steps={obSteps} onNavigate={navigate} loading={statsLoading} />
      </div>

      {/* Error banner */}
      {error && (
        <div style={{ display:'flex', alignItems:'center', gap:10, padding:'10px 14px', borderRadius:10, background:'rgba(220, 38, 38, 0.05)', border:'1px solid #FECACA' }}>
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke='#EF4444' strokeWidth="2"><circle cx="12" cy="12" r="10"/><line x1="12" y1="8" x2="12" y2="12"/><line x1="12" y1="16" x2="12.01" y2="16"/></svg>
          <span style={{ fontSize:12.5, color:'#EF4444', flex:1 }}><b>{error.title}</b> — {error.message}</span>
          <button onClick={() => setError(null)} style={{ background:'none', border:'none', cursor:'pointer', color:'#EF9999', padding:2 }}>
            <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg>
          </button>
        </div>
      )}

      {/* ── Row 2: Primary Stat Cards ── */}
      <div id="tour-admin-stats" className="stat-grid">
        {STAT_CARDS.map((c, i) => (
          <div key={c.label} className="stat-card" style={{ gap: 12, flexDirection: 'row', alignItems: 'center' }}>
            <div style={{ width: 44, height: 44, borderRadius: 10, background: c.bg, color: c.color, display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
              {c.icon}
            </div>
            <div style={{ flex: 1, minWidth: 0 }}>
              <div style={{ fontSize: 11, fontWeight: 700, color: 'var(--muted2)', letterSpacing: '.4px', textTransform: 'uppercase', marginBottom: 2 }}>{c.label}</div>
              {statsLoading
                ? <Skel w={48} h={22} r={6} />
                : <div style={{ fontSize: 24, fontWeight: 800, color: 'var(--ink)', lineHeight: 1.1, fontFamily: "'Sora',sans-serif" }}>
                    <AnimatedNumber value={c.value} />
                  </div>
              }
              {statsLoading
                ? <Skel w="80%" h={10} r={4} style={{ marginTop: 4 }} />
                : c.sub
                  ? <div style={{ fontSize: 11.5, color: c.subColor || 'var(--muted2)', fontWeight: 500, marginTop: 2, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{c.sub}</div>
                  : null
              }
            </div>
          </div>
        ))}
      </div>

      {/* ── Schedule Health ── */}
      <div id="tour-admin-health" className="d-card" style={{ padding:'16px 18px', animationDelay:'.12s' }}>
        <div style={{ display:'flex', alignItems:'center', justifyContent:'space-between', marginBottom:14, flexWrap:'wrap', gap:8 }}>
          <div>
            <div style={{ fontSize:13, fontWeight:700, color:'var(--ink)' }}>Schedule Health</div>
            <div style={{ fontSize:11, color:'var(--muted2)', marginTop:1 }}>
              {scheduleName ? `Based on loaded schedule: ${scheduleName}` : 'No schedule loaded — run the scheduler to see health data'}
            </div>
          </div>
          {scheduleName && (
            <button onClick={() => navigate(`/dashboard/schedule/${encodeURIComponent(scheduleName)}`)}
              style={{ padding:'5px 12px', borderRadius:8, border:'1.5px solid var(--border)', background:'var(--hover)', color:'var(--muted)', fontSize:11.5, fontWeight:600, cursor:'pointer', fontFamily:'Inter,sans-serif', transition:'all .15s' }}>
              View Schedule →
            </button>
          )}
        </div>
        {!scheduleName ? (
          <div style={{ display:'flex', alignItems:'center', gap:14, padding:'12px 14px', borderRadius:10, background:'var(--hover)', border:'1px solid var(--border)' }}>
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="var(--muted2)" strokeWidth="1.5"><rect x="3" y="4" width="18" height="18" rx="2"/><line x1="16" y1="2" x2="16" y2="6"/><line x1="8" y1="2" x2="8" y2="6"/><line x1="3" y1="10" x2="21" y2="10"/></svg>
            <span style={{ fontSize:12, color:'var(--muted2)' }}>
              Go to the <button onClick={() => navigate('/dashboard/scheduler')} style={{ background:'none', border:'none', color: 'var(--meadow-text)', fontWeight:700, cursor:'pointer', fontSize:12, padding:0, fontFamily:'Inter,sans-serif' }}>Scheduler</button> to generate a timetable, then load it here to see health metrics.
            </span>
          </div>
        ) : (
          <div style={{ display:'grid', gridTemplateColumns:'repeat(4,1fr)', gap:10 }}>
            {[
              {
                label: 'Coverage',
                value: statsLoading ? '…' : `${sch.coveragePct ?? 0}%`,
                sub: statsLoading ? '' : `${sch.tbaSessions ?? 0} TBA sessions`,
                color: (sch.coveragePct ?? 0) >= 95 ? 'var(--meadow)' : (sch.coveragePct ?? 0) >= 80 ? '#F59E0B' : '#EF4444',
                bg: (sch.coveragePct ?? 0) >= 95 ? 'var(--meadow-soft)' : (sch.coveragePct ?? 0) >= 80 ? 'rgba(245, 158, 11, 0.05)' : 'rgba(220, 38, 38, 0.05)',
                icon: <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><polyline points="20 6 9 17 4 12"/></svg>,
              },
              {
                label: 'Conflicts',
                value: statsLoading ? '…' : (sch.conflictCount ?? 0),
                sub: (sch.conflictCount ?? 0) === 0 ? 'None detected' : 'Need resolution',
                color: (sch.conflictCount ?? 0) === 0 ? 'var(--meadow)' : '#EF4444',
                bg: (sch.conflictCount ?? 0) === 0 ? 'var(--meadow-soft)' : 'rgba(220, 38, 38, 0.05)',
                icon: <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><circle cx="12" cy="12" r="10"/><line x1="12" y1="8" x2="12" y2="12"/><line x1="12" y1="16" x2="12.01" y2="16"/></svg>,
              },
              {
                label: 'Overloaded Faculty',
                value: wlLoading ? '…' : overList.length,
                sub: overList.length === 0 ? 'All within cap' : `${overList.length} over unit cap`,
                color: overList.length === 0 ? 'var(--meadow)' : '#EF4444',
                bg: overList.length === 0 ? 'var(--meadow-soft)' : 'rgba(220, 38, 38, 0.05)',
                icon: <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2"/><circle cx="9" cy="7" r="4"/></svg>,
              },
              {
                label: 'Near Cap',
                value: wlLoading ? '…' : atRisk.length,
                sub: atRisk.length === 0 ? 'No one near limit' : 'At ≥85% capacity',
                color: atRisk.length === 0 ? 'var(--meadow)' : '#F59E0B',
                bg: atRisk.length === 0 ? 'var(--meadow-soft)' : 'rgba(245, 158, 11, 0.05)',
                icon: <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M10.29 3.86L1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z"/><line x1="12" y1="9" x2="12" y2="13"/></svg>,
              },
            ].map(item => (
              <div key={item.label} style={{ padding:'12px 13px', borderRadius:10, background:item.bg, border:`1px solid ${item.bg === 'var(--meadow-soft)' ? 'var(--meadow-border)' : item.bg === 'rgba(245, 158, 11, 0.05)' ? 'rgba(245, 158, 11, 0.25)' : 'rgba(220, 38, 38, 0.25)'}`, display:'flex', flexDirection:'column', gap:6 }}>
                <div style={{ display:'flex', alignItems:'center', justifyContent:'space-between' }}>
                  <span style={{ fontSize:11, fontWeight:600, color:'var(--muted2)' }}>{item.label}</span>
                  <div style={{ color:item.color, opacity:.7 }}>{item.icon}</div>
                </div>
                <div style={{ fontSize:24, fontWeight:800, color:item.color, fontFamily:"'Sora',sans-serif", lineHeight:1 }}>{item.value}</div>
                <div style={{ fontSize:10.5, color:'var(--muted2)', fontWeight:500 }}>{item.sub}</div>
              </div>
            ))}
          </div>
        )}
        {/* Saved schedule selector — compact, below health metrics */}
        {savedList.length > 0 && (
          <div style={{ marginTop:12, paddingTop:12, borderTop:'1px solid var(--border)', display:'flex', alignItems:'center', gap:8, flexWrap:'wrap' }}>
            <span style={{ fontSize:11, fontWeight:600, color:'var(--muted2)', flexShrink:0 }}>Saved:</span>
            {savedList.map(s => {
              const sName = typeof s === 'string' ? s : (s.name || s.id || '')
              const sFinalized = typeof s === 'object' ? !!s.finalized : false
              const isActive = scheduleName === sName
              return (
                <button key={sName} onClick={() => loadSchedule(sName)}
                  style={{ padding:'4px 11px', borderRadius:7, border:`1.5px solid ${isActive?'var(--meadow)':'var(--border)'}`, background:isActive?'var(--meadow-soft)':'var(--hover)', color:isActive?'var(--meadow)':'var(--muted)', fontSize:11, fontWeight:600, cursor:'pointer', fontFamily:'Inter,sans-serif', transition:'all .15s', display:'flex', alignItems:'center', gap:4 }}>
                  {isActive && <svg width="9" height="9" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3"><polyline points="20 6 9 17 4 12"/></svg>}
                  {sName}
                  {sFinalized && (
                    <span style={{ display:'inline-flex', alignItems:'center', gap:2, padding:'0px 5px', borderRadius:99, fontSize:9, fontWeight:700, background:'var(--meadow-soft)', color: 'var(--meadow-text)', border:'1px solid var(--meadow-border)', marginLeft:2 }}>
                      <svg width="7" height="7" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3"><polyline points="20 6 9 17 4 12"/></svg>
                      Final
                    </span>
                  )}
                </button>
              )
            })}
            {scheduleName && (
              <button onClick={() => clearSchedule()}
                style={{ padding:'4px 11px', borderRadius:7, border:'1.5px solid #FECACA', background:'rgba(220, 38, 38, 0.05)', color:'#EF4444', fontSize:11, fontWeight:600, cursor:'pointer', fontFamily:'Inter,sans-serif' }}>
                Clear
              </button>
            )}
          </div>
        )}
      </div>

      {/* ── Row 3: Insights & Suggestions ── */}
      {scheduleName && (
        <div className="d-card" style={{ animationDelay:'.14s' }}>
          <SectionHeader
            title="Insights & Recommendations"
            sub={
              <span>
                Based on loaded schedule:&nbsp;
                <span style={{ fontWeight:700, color: 'var(--meadow-text)', background:'var(--meadow-soft)', padding:'1px 8px', borderRadius:99, fontSize:10.5 }}>
                  {scheduleName}
                </span>
              </span>
            }
            right={
              suggestions.length > 0 && (
                <div style={{ display:'flex', gap:5 }}>
                  {suggestions.some(s=>s.type==='error') && <Badge label={`${suggestions.filter(s=>s.type==='error').length} critical`} color='#EF4444' bg='rgba(220, 38, 38, 0.1)'/>}
                  {suggestions.some(s=>s.type==='warning') && <Badge label={`${suggestions.filter(s=>s.type==='warning').length} warnings`} color='#F59E0B' bg='rgba(217, 119, 6, 0.1)'/>}
                  {suggestions.some(s=>s.type==='success') && <Badge label="✓ healthy" color="var(--meadow)" bg="var(--meadow-soft)"/>}
                </div>
              )
            }
          />
          <div style={{ padding:'14px 16px' }}>
            {wlLoading ? (
              <div style={{ display:'grid', gridTemplateColumns:'repeat(2,1fr)', gap:10 }}>
                {[1,2,3,4].map(i=><div key={i} style={{ display:'flex', gap:10, padding:'12px 14px', borderRadius:12, background:'var(--hover)' }}><Skel w={28} h={28} r={8}/><div style={{ flex:1 }}><Skel w={160} h={11} r={5} style={{ marginBottom:6 }}/><Skel w={220} h={9} r={4}/></div></div>)}
              </div>
            ) : suggestions.length === 0 ? (
              <div style={{ textAlign:'center', padding:'20px 0', color:'var(--muted2)', fontSize:13 }}>
                <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" style={{ display:'block', margin:'0 auto 8px' }}><polyline points="20 6 9 17 4 12"/></svg>
                No issues found for this schedule.
              </div>
            ) : (
              <div style={{ display:'grid', gridTemplateColumns:'repeat(2,1fr)', gap:10 }}>
                {suggestions.map((s, i) => <SuggestionCard key={s.id} suggestion={s} delay={i * 0.04}/>)}
              </div>
            )}
          </div>
        </div>
      )}

      {/* ── Row 4: Course Breakdowns (2 columns) ── */}
      <div id="tour-admin-breakdowns" style={{ display:'grid', gridTemplateColumns:'1fr 1fr', gap:14 }}>

        {/* Left: Courses by Semester */}
        <div className="d-card" style={{ padding:'18px', animationDelay:'.16s' }}>
          <div style={{ fontSize:13, fontWeight:700, color:'var(--ink)', marginBottom:2 }}>Courses by Semester</div>
          <div style={{ fontSize:11, color:'var(--muted2)', marginBottom:16 }}>Distribution across the academic year</div>
          {statsLoading ? (
            <div style={{ display:'flex', flexDirection:'column', gap:12 }}>
              {[1,2,3].map(i=><div key={i}><Skel w={120} h={10} r={4} style={{ marginBottom:5 }}/><Skel w='100%' h={8} r={99}/></div>)}
            </div>
          ) : Object.keys(bySem).length === 0 ? (
            <div style={{ textAlign:'center', color:'var(--muted2)', fontSize:12, padding:'16px 0' }}>No courses loaded yet.</div>
          ) : (
            <>
              {[
                { key:'1st Semester', color: 'var(--meadow-text)' },
                { key:'2nd Semester', color:'#60A5FA' },
                { key:'Midyear',      color:'#F59E0B' },
              ].filter(x => bySem[x.key] > 0).map(x => (
                <HorizBar key={x.key} label={x.key} value={bySem[x.key]||0} max={semTotal} color={x.color} pct={Math.round((bySem[x.key]||0)/semTotal*100)}/>
              ))}
              <div style={{ display:'flex', gap:10, marginTop:12, paddingTop:12, borderTop:'1px solid var(--border)' }}>
                <div style={{ flex:1, textAlign:'center' }}>
                  <div style={{ fontSize:11, color:'var(--muted2)', marginBottom:2 }}>With Lab</div>
                  <div style={{ fontSize:18, fontWeight:800, color:'#7C3AED', fontFamily:"'Sora',sans-serif" }}>{crs.coursesWithLab||0}</div>
                </div>
                <div style={{ width:1, background:'var(--border)' }}/>
                <div style={{ flex:1, textAlign:'center' }}>
                  <div style={{ fontSize:11, color:'var(--muted2)', marginBottom:2 }}>Lecture Only</div>
                  <div style={{ fontSize:18, fontWeight:800, color: 'var(--meadow-text)', fontFamily:"'Sora',sans-serif" }}>{crs.coursesLectureOnly||0}</div>
                </div>
                <div style={{ width:1, background:'var(--border)' }}/>
                <div style={{ flex:1, textAlign:'center' }}>
                  <div style={{ fontSize:11, color:'var(--muted2)', marginBottom:2 }}>Total Units</div>
                  <div style={{ fontSize:18, fontWeight:800, color:'#0891B2', fontFamily:"'Sora',sans-serif" }}>{crs.totalUnits||0}</div>
                </div>
              </div>
            </>
          )}
        </div>

        {/* Right: Courses by Program (donut + legend) */}
        <div className="d-card" style={{ padding:'18px', animationDelay:'.18s' }}>
          <div style={{ fontSize:13, fontWeight:700, color:'var(--ink)', marginBottom:2 }}>Courses by Program</div>
          <div style={{ fontSize:11, color:'var(--muted2)', marginBottom:16 }}>Program-level course distribution</div>
          {statsLoading ? (
            <div style={{ display:'flex', gap:18, alignItems:'center' }}>
              <Skel w={120} h={120} r={60}/>
              <div style={{ flex:1, display:'flex', flexDirection:'column', gap:8 }}>
                {[1,2,3,4].map(i=><Skel key={i} w='100%' h={9} r={4}/>)}
              </div>
            </div>
          ) : progEntries.length === 0 ? (
            <div style={{ textAlign:'center', color:'var(--muted2)', fontSize:12, padding:'16px 0' }}>No courses loaded yet.</div>
          ) : (
            <div style={{ display:'flex', gap:18, alignItems:'center' }}>
              <DonutChart
                segments={progEntries.map(([, v], i) => ({ value:v, color:PROG_COLORS[i % PROG_COLORS.length] }))}
                size={120} stroke={22} label={crs.total||0} sublabel="courses"
              />
              <div style={{ flex:1 }}>
                {progEntries.map(([prog, count], i) => (
                  <div key={prog} style={{ display:'flex', alignItems:'center', justifyContent:'space-between', marginBottom:7 }}>
                    <div style={{ display:'flex', alignItems:'center', gap:7 }}>
                      <div style={{ width:9, height:9, borderRadius:2, background:PROG_COLORS[i % PROG_COLORS.length], flexShrink:0 }}/>
                      <span style={{ fontSize:12, fontWeight:600, color:'var(--ink)' }}>{prog}</span>
                    </div>
                    <div style={{ display:'flex', alignItems:'center', gap:6 }}>
                      <span style={{ fontSize:11, color:'var(--muted2)' }}>{Math.round(count/progTotal*100)}%</span>
                      <span style={{ fontSize:12, fontWeight:700, color:PROG_COLORS[i % PROG_COLORS.length] }}>{count}</span>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      </div>

      {/* ── Row 5: Data snapshot (year level + faculty composition) ── */}
      <div id="tour-admin-snapshot" style={{ display:'grid', gridTemplateColumns:'1fr 340px', gap:14 }}>

        {/* Courses by Year Level */}
        <div className="d-card" style={{ padding:'18px', animationDelay:'.20s' }}>
          <div style={{ fontSize:13, fontWeight:700, color:'var(--ink)', marginBottom:2 }}>Courses by Year Level</div>
          <div style={{ fontSize:11, color:'var(--muted2)', marginBottom:14 }}>How the curriculum is distributed across years</div>
          {statsLoading ? (
            <div style={{ display:'flex', flexDirection:'column', gap:8 }}>
              {[1,2,3,4].map(i=><Skel key={i} w='100%' h={8} r={99}/>)}
            </div>
          ) : Object.keys(crs.byYearLevel||{}).length === 0 ? (
            <div style={{ textAlign:'center', color:'var(--muted2)', fontSize:11.5, padding:'8px 0' }}>No course data loaded.</div>
          ) : (
            <div style={{ display:'flex', flexDirection:'column', gap:9 }}>
              {Object.entries(crs.byYearLevel||{}).map(([yr, count], i) => {
                const total = Object.values(crs.byYearLevel||{}).reduce((s,v)=>s+v,0)||1
                const pct   = Math.round(count/total*100)
                const yearColors = ['var(--meadow)','#60A5FA','#7C3AED','#F59E0B']
                const color = yearColors[i % yearColors.length]
                return (
                  <div key={yr}>
                    <div style={{ display:'flex', justifyContent:'space-between', marginBottom:4 }}>
                      <span style={{ fontSize:11.5, fontWeight:600, color:'var(--ink)' }}>Year {yr}</span>
                      <span style={{ fontSize:11, fontWeight:700, color }}>{count} <span style={{ fontWeight:400, color:'var(--muted2)' }}>({pct}%)</span></span>
                    </div>
                    <div style={{ height:7, borderRadius:99, background:'var(--hover)', overflow:'hidden' }}>
                      <div style={{ height:'100%', borderRadius:99, width:`${pct}%`, background:color, animation:'barIn .7s ease both' }}/>
                    </div>
                  </div>
                )
              })}
            </div>
          )}
        </div>

        {/* Faculty Composition */}
        <div className="d-card" style={{ padding:'16px', animationDelay:'.22s' }}>
            <div style={{ fontSize:13, fontWeight:700, color:'var(--ink)', marginBottom:2 }}>Faculty Composition</div>
            <div style={{ fontSize:11, color:'var(--muted2)', marginBottom:14 }}>Full-time vs. part-time breakdown</div>
            {statsLoading ? (
              <div style={{ display:'flex', flexDirection:'column', gap:10 }}>
                <Skel w={120} h={120} r={60} style={{ margin:'0 auto' }}/>
                {[1,2].map(i=><Skel key={i} w='100%' h={32} r={7}/>)}
              </div>
            ) : fac.total === 0 ? (
              <div style={{ textAlign:'center', color:'var(--muted2)', fontSize:11.5, padding:'8px 0' }}>No faculty loaded.</div>
            ) : (
              <div style={{ display:'flex', flexDirection:'column', gap:14 }}>
                <DonutChart
                  segments={[
                    { label:'Full-time', value: fac.fullTime || 0, color:'#60A5FA' },
                    { label:'Part-time', value: fac.partTime || 0, color: 'var(--meadow-text)' },
                  ]}
                  size={120} stroke={20} label={fac.total || 0} sublabel="faculty"
                />
                {[
                  {
                    label: 'Full-time',
                    val: fac.fullTime || 0,
                    total: fac.total || 1,
                    color: '#60A5FA', bg: 'rgba(59, 130, 246, 0.1)',
                  },
                  {
                    label: 'Part-time',
                    val: fac.partTime || 0,
                    total: fac.total || 1,
                    color: 'var(--meadow-text)', bg: 'var(--meadow-soft)',
                  },
                ].map(row => {
                  const pct = Math.round(row.val / row.total * 100)
                  return (
                    <div key={row.label} style={{ display:'flex', alignItems:'center', gap:9 }}>
                      <div style={{ width:9, height:9, borderRadius:2, background:row.color, flexShrink:0 }}/>
                      <span style={{ fontSize:11.5, fontWeight:600, color:'var(--ink)', flex:1 }}>{row.label}</span>
                      <span style={{ fontSize:11, color:'var(--muted2)' }}>{pct}%</span>
                      <span style={{ fontSize:13, fontWeight:800, color:row.color, fontFamily:"'Sora',sans-serif", minWidth:20, textAlign:'right' }}>{row.val}</span>
                    </div>
                  )
                })}
              </div>
            )}
          </div>
        </div>

    </div>
  )
}