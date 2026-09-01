import { useState, useRef, useCallback, useEffect } from 'react'
import { useNavigate, useLocation } from 'react-router-dom'
import { useSolverStore } from '../store/scheduleStore'
import { cancelSolve } from '../services/api'

const G = {
  meadow: 'var(--meadow, var(--meadow))',
  meadowDeep:   'var(--meadow-deep)',
  meadowSoft:   'var(--meadow-soft)',
  meadowBorder: 'var(--meadow-border)',
  ink: 'var(--ink, #0E2A20)',
  muted: 'var(--muted, #4B7060)',
  border:       'var(--border)',
  bg: 'var(--bg, #F2F7F4)',
}

const PHASES = ['NSTP', 'GEC / MAT', 'Year 4', 'Year 3', 'Year 2', 'Year 1', 'PE / PATHFIT']

if (!document.getElementById('solver-pill-style')) {
  const s = document.createElement('style')
  s.id = 'solver-pill-style'
  s.textContent = `
    @keyframes pillSlideIn { from { opacity:0; transform:translateY(12px) scale(0.96); } to { opacity:1; transform:translateY(0) scale(1); } }
    @keyframes pillFadeIn  { from { opacity:0; } to { opacity:1; } }

    .solver-pill {
      position: fixed; z-index: 950;
      display: flex; align-items: center; gap: 10px;
      background: var(--surface); border: 1px solid ${G.border}; border-radius: 14px;
      box-shadow: 0 10px 28px rgba(0,0,0,0.18);
      padding: 10px 14px;
      cursor: pointer;
      font-family: 'Inter', sans-serif;
      animation: pillSlideIn .25s cubic-bezier(0.16,1,0.3,1);
      max-width: 300px; min-width: 200px;
      user-select: none;
      transition: box-shadow .15s, transform .15s;
    }
    .solver-pill:hover { box-shadow: 0 14px 36px rgba(0,0,0,0.24); transform: translateY(-1px); }
    .solver-pill.dragging { cursor: grabbing; box-shadow: 0 18px 40px rgba(0,0,0,0.28); transform: none; }

    .solver-pill-ring { position: relative; width: 36px; height: 36px; flex-shrink: 0; }
    .solver-pill-ring svg { transform: rotate(-90deg); display: block; }
    .solver-pill-ring-bg { stroke: ${G.bg}; }
    .solver-pill-ring-fg { stroke: ${G.meadow}; transition: stroke-dashoffset .4s ease; }
    .solver-pill-pct { position: absolute; inset: 0; display: flex; align-items: center; justify-content: center; font-size: 10px; font-weight: 800; color: ${G.meadowDeep}; }

    .solver-pill-text { display: flex; flex-direction: column; gap: 2px; min-width: 0; flex: 1; }
    .solver-pill-title { font-size: 12.5px; font-weight: 700; color: ${G.ink}; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
    .solver-pill-sub { font-size: 11px; font-weight: 500; color: ${G.muted}; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }

    .solver-pill-done { background: linear-gradient(135deg, ${G.meadow}, ${G.meadowDeep}); border-color: ${G.meadowDeep}; }
    .solver-pill-done .solver-pill-title,
    .solver-pill-done .solver-pill-sub { color: #fff; }
    .solver-pill-failed { border-color: #FECACA; background: #FEF2F2; }
    .solver-pill-failed .solver-pill-title { color: #991B1B; }
    .solver-pill-failed .solver-pill-sub { color: #B91C1C; }

    .solver-pill-stop {
      width: 26px !important; height: 26px !important; border-radius: 7px !important; flex-shrink: 0;
      display: flex !important; align-items: center; justify-content: center;
      background: #FEF3C7 !important; border: 1px solid #FDE68A !important; color: #92400E !important;
      cursor: pointer; transition: all .15s; padding: 0 !important;
    }
    .solver-pill-stop:hover { background: #FEE2E2 !important; border-color: #FECACA !important; color: #DC2626 !important; }

    /* Cancelled toast — centered within main content area, not full viewport */
    .solver-cancelled-toast {
      position: fixed; 
      bottom: 24px; 
      left: 50%;
      transform: translateX(-50%);
      /* Offset by sidebar width to center within main content */
      margin-left: 110px; /* Half of normal sidebar width (220px / 2) */
      z-index: 9999;
      display: flex; align-items: center; gap: 10px;
      padding: 14px 22px; border-radius: 12px;
      font-family: 'Inter', sans-serif; font-size: 13.5px; font-weight: 600;
      white-space: nowrap; pointer-events: none;
      box-shadow: 0 8px 24px rgba(0,0,0,0.15);
      background: var(--surface); color: ${G.meadowDeep}; border: 1px solid ${G.meadowBorder};
      animation: pillSlideIn .25s cubic-bezier(.4,0,.2,1);
    }

    /* Redirect modal */
    .solver-redirect-backdrop {      position: fixed; inset: 0; z-index: 1100;
      background: rgba(10,30,18,0.55); backdrop-filter: blur(4px);
      display: flex; align-items: center; justify-content: center; padding: 20px;
      animation: pillFadeIn .18s ease;
    }
    .solver-redirect-box {
      background: var(--surface); border-radius: 18px; width: 360px; padding: 28px;
      box-shadow: 0 24px 60px rgba(0,0,0,0.28); border: 1px solid ${G.border};
      font-family: 'Inter', sans-serif;
      animation: pillSlideIn .22s cubic-bezier(0.16,1,0.3,1);
    }
  `
  document.head.appendChild(s)
}

/* ── Redirect / action confirmation modal ── */
function PillModal({ status, label, onClose, onGoScheduler, onStopConfirm }) {
  const isRunning  = status === 'running'
  const isComplete = status === 'complete'
  const isFailed   = status === 'failed'

  return (
    <div className="solver-redirect-backdrop" onClick={onClose}>
      <div className="solver-redirect-box" onClick={e => e.stopPropagation()}>

        {/* Icon + title */}
        <div style={{ display:'flex', alignItems:'center', gap:14, marginBottom:18 }}>
          <div style={{
            width:44, height:44, borderRadius:12, flexShrink:0, display:'flex', alignItems:'center', justifyContent:'center',
            background: isComplete ? G.meadowSoft : isFailed ? 'rgba(239, 68, 68, 0.1)' : 'rgba(245, 158, 11, 0.1)',
            border: `1px solid ${isComplete ? G.meadowBorder : isFailed ? 'rgba(220, 38, 38, 0.25)' : 'rgba(245, 158, 11, 0.25)'}`,
          }}>
            {isComplete && <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke={G.meadow} strokeWidth="2.5"><polyline points="20 6 9 17 4 12"/></svg>}
            {isFailed   && <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="#DC2626" strokeWidth="2.5"><circle cx="12" cy="12" r="10"/><line x1="12" y1="8" x2="12" y2="12"/></svg>}
            {isRunning  && <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="#D97706" strokeWidth="2.5" style={{ animation:'pillSpin 1s linear infinite' }}><path d="M21 12a9 9 0 1 1-6.219-8.56"/></svg>}
          </div>
          <div>
            <div style={{ fontSize:15, fontWeight:800, color:G.ink }}>
              {isRunning ? 'Generation in progress' : isComplete ? 'Schedule ready!' : 'Generation failed'}
            </div>
            {label && <div style={{ fontSize:12, color:G.muted, marginTop:3, overflow:'hidden', textOverflow:'ellipsis', whiteSpace:'nowrap', maxWidth:250 }}>{label}</div>}
          </div>
        </div>

        {/* Actions */}
        <div style={{ display:'flex', flexDirection:'column', gap:8 }}>
          <button
            onClick={onGoScheduler}
            style={{ display:'flex', alignItems:'center', gap:12, padding:'12px 16px', borderRadius:10, border:`1.5px solid ${G.meadowBorder}`, background:G.meadowSoft, cursor:'pointer', fontFamily:'Inter,sans-serif', textAlign:'left', transition:'all .15s' }}
            onMouseEnter={e => { e.currentTarget.style.background=G.meadowBorder }}
            onMouseLeave={e => { e.currentTarget.style.background=G.meadowSoft }}
          >
            <div style={{ width:32, height:32, borderRadius:8, background:G.meadow, display:'flex', alignItems:'center', justifyContent:'center', flexShrink:0 }}>
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="#fff" strokeWidth="2.5"><rect x="3" y="4" width="18" height="18" rx="2"/><line x1="16" y1="2" x2="16" y2="6"/><line x1="8" y1="2" x2="8" y2="6"/><line x1="3" y1="10" x2="21" y2="10"/></svg>
            </div>
            <div>
              <div style={{ fontSize:13, fontWeight:700, color:G.meadowDeep }}>Go to Scheduler</div>
              <div style={{ fontSize:11, color:G.muted }}>
                {isComplete ? 'View and save the completed schedule' : isRunning ? 'Monitor progress and save when done' : 'Retry generation from the wizard'}
              </div>
            </div>
          </button>

          {isRunning && (
            <button
              onClick={onStopConfirm}
              style={{ display:'flex', alignItems:'center', gap:12, padding:'12px 16px', borderRadius:10, border:'1.5px solid #FECACA', background:'rgba(220, 38, 38, 0.05)', cursor:'pointer', fontFamily:'Inter,sans-serif', textAlign:'left', transition:'all .15s' }}
              onMouseEnter={e => { e.currentTarget.style.background='rgba(239, 68, 68, 0.1)' }}
              onMouseLeave={e => { e.currentTarget.style.background='rgba(220, 38, 38, 0.05)' }}
            >
              <div style={{ width:32, height:32, borderRadius:8, background:'rgba(239, 68, 68, 0.1)', display:'flex', alignItems:'center', justifyContent:'center', flexShrink:0 }}>
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="#DC2626" strokeWidth="2.5"><rect x="4" y="4" width="16" height="16" rx="2"/></svg>
              </div>
              <div>
                <div style={{ fontSize:13, fontWeight:700, color:'#DC2626' }}>Stop generation</div>
                <div style={{ fontSize:11, color:G.muted }}>Cancel this run — progress will be lost.</div>
              </div>
            </button>
          )}

          <button
            onClick={onClose}
            style={{ padding:'9px', borderRadius:9, border:`1px solid ${G.border}`, background: 'var(--surface)', color:G.muted, fontSize:12.5, fontWeight:600, cursor:'pointer', fontFamily:'Inter,sans-serif', textAlign:'center' }}
          >
            Dismiss
          </button>
        </div>
      </div>
    </div>
  )
}

/**
 * Draggable floating pill — shows solver status across all pages.
 * Click it to get a modal with navigation options and a stop button.
 */
export default function SolverStatusWidget() {
  const navigate = useNavigate()
  const location = useLocation()
  const { status, progress, label, processId, dismissed, reset, setStatus, setDismissed } = useSolverStore()
  const [pos,        setPos]        = useState(null)
  const [showModal,  setShowModal]  = useState(false)
  const [stopping,   setStopping]   = useState(false)
  const [cancelledMsg, setCancelledMsg] = useState(false)
  const pillRef  = useRef(null)
  const dragRef  = useRef(null)
  const didDragRef = useRef(false)
  const [isDragging, setIsDragging] = useState(false)

  // Reset position when going idle
  useEffect(() => {
    if (status === 'idle') { setPos(null); setShowModal(false) }
  }, [status])

  // Reset dismissed flag when starting new generation
  useEffect(() => {
    if (status === 'running' && dismissed) {
      setDismissed(false)
    }
  }, [status, dismissed, setDismissed])

  const onMouseDown = useCallback((e) => {
    if (e.button !== 0) return
    // Don't start drag if clicking the stop button
    if (e.target.closest('.solver-pill-stop')) return
    e.preventDefault()
    didDragRef.current = false
    const rect = pillRef.current.getBoundingClientRect()
    dragRef.current = { startX: e.clientX, startY: e.clientY, origLeft: rect.left, origTop: rect.top }

    const onMove = (e) => {
      const dx = e.clientX - dragRef.current.startX
      const dy = e.clientY - dragRef.current.startY
      if (Math.abs(dx) > 4 || Math.abs(dy) > 4) didDragRef.current = true
      setIsDragging(true)
      const newLeft = Math.max(8, Math.min(window.innerWidth  - rect.width  - 8, dragRef.current.origLeft + dx))
      const newTop  = Math.max(8, Math.min(window.innerHeight - rect.height - 8, dragRef.current.origTop  + dy))
      setPos({ left: newLeft, top: newTop, right: 'auto', bottom: 'auto' })
    }
    const onUp = () => {
      setIsDragging(false)
      window.removeEventListener('mousemove', onMove)
      window.removeEventListener('mouseup', onUp)
      dragRef.current = null
    }
    window.addEventListener('mousemove', onMove)
    window.addEventListener('mouseup', onUp)
  }, [])

  const handleClick = useCallback(() => {
    if (didDragRef.current) return   // was a drag, not a click
    setShowModal(true)
  }, [])

  async function handleStop() {
    if (!processId) return
    setStopping(true)
    try { await cancelSolve(processId) } catch { /* ignore — poller will catch -2 */ }
    setStopping(false)
    setShowModal(false)
    reset()
    setStatus('idle')
    // Show a brief centred toast that matches the app's sch-toast style
    setCancelledMsg(true)
    setTimeout(() => setCancelledMsg(false), 3000)
  }

  function handleGoScheduler() {
    setShowModal(false)
    
    // If generation is complete, mark as dismissed (hides pill but keeps solver state)
    if (status === 'complete') {
      setDismissed(true)  // Hide the pill without clearing the schedule data
      navigate('/dashboard/scheduler#step3')  // Go directly to step 3
    } else {
      // For running or failed, go to scheduler (will auto-advance to step 3 if running)
      navigate('/dashboard/scheduler')
    }
  }

  if (status === 'idle' && !cancelledMsg) return null

  // Hide the pill when:
  // 1. User is on scheduler page (they have full wizard UI)
  // 2. Status is idle 
  // 3. Status is complete but user has dismissed it
  const hidePill = location.pathname.startsWith('/dashboard/scheduler') 
    || status === 'idle' 
    || (status === 'complete' && dismissed)
  const phaseIdx      = Math.min(Math.floor((progress / 100) * 7), 6)
  const radius        = 15
  const circumference = 2 * Math.PI * radius
  const offset        = circumference - (progress / 100) * circumference

  const pillClass = [
    'solver-pill',
    status === 'complete' ? 'solver-pill-done'   : '',
    status === 'failed'   ? 'solver-pill-failed' : '',
    isDragging ? 'dragging' : '',
  ].filter(Boolean).join(' ')

  const pillStyle = pos
    ? { left: pos.left, top: pos.top, right: pos.right, bottom: pos.bottom }
    : { right: 24, bottom: 24 }

  const title = status === 'complete' ? 'Schedule ready — click to save'
    : status === 'failed' ? 'Solve failed — click for options'
    : (label || 'Generating schedule…')

  const subtitle = status === 'complete' ? (label || 'Click to go to Scheduler')
    : status === 'failed' ? 'Click to retry'
    : `${PHASES[phaseIdx]} · ${progress}%`

  return (
    <>
      {!hidePill && (
        <div
          ref={pillRef}
          className={pillClass}
          style={pillStyle}
          onMouseDown={onMouseDown}
          onClick={handleClick}
          aria-label="Schedule generation status"
          title="Click for options"
        >
          {status === 'running' ? (
            <div className="solver-pill-ring">
              <svg width="36" height="36" viewBox="0 0 36 36">
                <circle className="solver-pill-ring-bg" cx="18" cy="18" r={radius} fill="none" strokeWidth="4"/>
                <circle className="solver-pill-ring-fg" cx="18" cy="18" r={radius} fill="none" strokeWidth="4"
                  strokeDasharray={circumference} strokeDashoffset={offset} strokeLinecap="round"/>
              </svg>
              <span className="solver-pill-pct">{progress}%</span>
            </div>
          ) : status === 'complete' ? (
            <div style={{ width:36, height:36, borderRadius:'50%', background:'rgba(255,255,255,0.25)', display:'flex', alignItems:'center', justifyContent:'center', flexShrink:0 }}>
              <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="#fff" strokeWidth="3"><polyline points="20 6 9 17 4 12"/></svg>
            </div>
          ) : (
            <div style={{ width:36, height:36, borderRadius:'50%', background:'rgba(239, 68, 68, 0.1)', display:'flex', alignItems:'center', justifyContent:'center', flexShrink:0 }}>
              <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="#DC2626" strokeWidth="2.5"><circle cx="12" cy="12" r="10"/><line x1="12" y1="8" x2="12" y2="12"/></svg>
            </div>
          )}

          <div className="solver-pill-text">
            <span className="solver-pill-title">{title}</span>
            <span className="solver-pill-sub">{subtitle}</span>
          </div>

          {/* Quick-stop button — only shown when running */}
          {status === 'running' && (
            <button
              className="solver-pill-stop"
              title="Stop generation"
              onClick={e => { e.stopPropagation(); setShowModal(true) }}
            >
              <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
                <rect x="4" y="4" width="16" height="16" rx="2"/>
              </svg>
            </button>
          )}
        </div>
      )}

      {showModal && (
        <PillModal
          status={status}
          label={label}
          onClose={() => setShowModal(false)}
          onGoScheduler={handleGoScheduler}
          onStopConfirm={handleStop}
          stopping={stopping}
        />
      )}

      {/* Cancelled toast notification */}
      {cancelledMsg && (
        <div className="solver-cancelled-toast">
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
            <circle cx="12" cy="12" r="10"/>
            <line x1="15" y1="9" x2="9" y2="15"/>
            <line x1="9" y1="9" x2="15" y2="15"/>
          </svg>
          Generation cancelled
        </div>
      )}
    </>
  )
}
