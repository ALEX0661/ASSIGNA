import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { useSolverStore } from '../store/scheduleStore'
import ScheduleGeneratorLoader from '../pages/admin/ScheduleGeneratorLoader'

const G = {
  meadow:     '#15803D',
  meadowDeep: '#0F5C2C',
  ink:        '#0E2A20',
  muted:      '#4B7060',
  border:     '#D8E8DF',
  bg:         '#F2F7F4',
}

const PHASES = ['NSTP', 'GEC / MAT', 'Year 4', 'Year 3', 'Year 2', 'Year 1', 'PE / PATHFIT']

if (!document.getElementById('solver-pill-style')) {
  const s = document.createElement('style')
  s.id = 'solver-pill-style'
  s.textContent = `
    @keyframes pillSlideIn { from { opacity:0; transform:translateY(12px) scale(0.96); } to { opacity:1; transform:translateY(0) scale(1); } }
    @keyframes pillSpin { to { transform: rotate(360deg); } }

    .solver-pill {
      position: fixed; bottom: 24px; right: 24px; z-index: 950;
      display: flex; align-items: center; gap: 12px;
      background: #fff; border: 1px solid ${G.border}; border-radius: 14px;
      box-shadow: 0 10px 28px rgba(10,46,28,0.18);
      padding: 12px 16px; cursor: pointer; font-family: 'Inter', sans-serif;
      animation: pillSlideIn .25s cubic-bezier(0.16,1,0.3,1);
      max-width: 280px; transition: box-shadow .15s, transform .15s;
    }
    .solver-pill:hover { box-shadow: 0 14px 34px rgba(10,46,28,0.24); transform: translateY(-1px); }

    .solver-pill-ring { position: relative; width: 36px; height: 36px; flex-shrink: 0; }
    .solver-pill-ring svg { transform: rotate(-90deg); }
    .solver-pill-ring-bg { stroke: ${G.bg}; }
    .solver-pill-ring-fg { stroke: ${G.meadow}; transition: stroke-dashoffset .4s ease; }
    .solver-pill-pct { position: absolute; inset: 0; display: flex; align-items: center; justify-content: center; font-size: 10px; font-weight: 800; color: ${G.meadowDeep}; }

    .solver-pill-text { display: flex; flex-direction: column; gap: 1px; min-width: 0; }
    .solver-pill-title { font-size: 12.5px; font-weight: 700; color: ${G.ink}; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
    .solver-pill-sub { font-size: 11px; font-weight: 500; color: ${G.muted}; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }

    .solver-pill-done { background: linear-gradient(135deg, ${G.meadow}, ${G.meadowDeep}); border-color: ${G.meadowDeep}; }
    .solver-pill-done .solver-pill-title, .solver-pill-done .solver-pill-sub { color: #fff; }
    .solver-pill-failed { border-color: #FECACA; background: #FEF2F2; }
    .solver-pill-failed .solver-pill-title { color: #991B1B; }
    .solver-pill-failed .solver-pill-sub { color: #B91C1C; }

    .solver-expand-backdrop { position: fixed; inset: 0; background: rgba(14,42,32,0.55); z-index: 960; backdrop-filter: blur(4px); animation: pillFade .2s ease-out; display:flex; align-items:center; justify-content:center; padding: 24px; }
    @keyframes pillFade { from { opacity:0; } to { opacity:1; } }
    .solver-expand-card { background: #fff; border-radius: 20px; box-shadow: 0 32px 72px rgba(10,46,28,0.32), 0 0 0 1px rgba(10,46,28,0.06); border: 1px solid ${G.border}; width: 680px; max-width: 94vw; animation: pillSlideIn .28s cubic-bezier(0.16,1,0.3,1); position: relative; overflow: hidden; }

    .solver-expand-header { display: flex; align-items: center; gap: 14px; padding: 22px 28px 18px; border-bottom: 1px solid ${G.border}; background: #fff; }
    .solver-expand-header-icon { width: 42px; height: 42px; border-radius: 12px; display: flex; align-items: center; justify-content: center; flex-shrink: 0; }
    .solver-expand-header-icon.running { background: linear-gradient(135deg, ${G.meadow}, ${G.meadowDeep}); box-shadow: 0 4px 12px rgba(21,128,61,0.3); }
    .solver-expand-header-icon.complete { background: #D1FAE5; border: 1px solid #A7F3D0; }
    .solver-expand-header-icon.failed { background: #FEE2E2; border: 1px solid #FECACA; }
    .solver-expand-header-title { font-size: 16px; font-weight: 800; color: ${G.ink}; letter-spacing: -0.2px; line-height: 1.2; }
    .solver-expand-header-sub { font-size: 12.5px; font-weight: 500; color: ${G.muted}; margin-top: 2px; }

    .solver-expand-close { position: absolute; top: 16px; right: 16px; width: 34px; height: 34px; border-radius: 9px; border: 1px solid ${G.border}; background: #fff; cursor: pointer; display: flex; align-items: center; justify-content: center; z-index: 2; line-height: 0; transition: background .15s, border-color .15s, transform .15s; }
    .solver-expand-close:hover { background: #FEE2E2; border-color: #FECACA; transform: rotate(90deg); }

    .solver-expand-body { padding: 28px; }

    .solver-expand-done-bar { padding: 18px 28px; border-top: 1px solid ${G.border}; background: ${G.bg}; display: flex; align-items: center; justify-content: space-between; gap: 12px; flex-wrap: wrap; }
    .solver-done-btn { display: inline-flex; align-items: center; gap: 8px; padding: 10px 22px; border-radius: 10px; font-family: 'Inter', sans-serif; font-size: 13px; font-weight: 700; cursor: pointer; transition: all .18s; border: none; }
    .solver-done-btn.primary { background: linear-gradient(135deg, ${G.meadow}, ${G.meadowDeep}); color: #fff; box-shadow: 0 4px 14px rgba(21,128,61,0.32); }
    .solver-done-btn.primary:hover { transform: translateY(-1px); box-shadow: 0 6px 20px rgba(21,128,61,0.42); }
    .solver-done-btn.secondary { background: #fff; color: ${G.ink}; border: 1px solid ${G.border}; }
    .solver-done-btn.secondary:hover { background: ${G.bg}; border-color: #BBF7D0; color: ${G.meadowDeep}; }
  `
  document.head.appendChild(s)
}

/**
 * Mount this once near the root of the app (alongside your router), e.g.:
 *
 *   <SolverStatusWidget onSave={handleSave} />
 *
 * Pass `onSave` — a function that triggers saving the schedule — so the
 * "Save" button inside the expanded modal works from any page context.
 *
 * It renders nothing while idle. Once a solve starts, it shows a small
 * floating progress pill in the bottom-right corner that persists across
 * page navigation (since it reads from the global useSolverStore, not from
 * SchedulerPage's local state). Clicking the pill expands the full animated
 * loader; clicking again (or the backdrop) collapses it back down.
 *
 * Note: there's currently no backend endpoint to actually cancel a solve in
 * progress — schedule.py only exposes start + status. This widget lets you
 * navigate freely while a solve runs in the background; it does not stop it.
 */
export default function SolverStatusWidget({ onSave }) {
  const { status, progress, label } = useSolverStore()
  const [expanded, setExpanded] = useState(false)
  const navigate = useNavigate()

  if (status === 'idle') return null

  const phaseIdx = Math.min(Math.floor((progress / 100) * 7), 6)
  const radius = 15
  const circumference = 2 * Math.PI * radius
  const offset = circumference - (progress / 100) * circumference

  const pillClass = status === 'complete' ? 'solver-pill solver-pill-done'
    : status === 'failed' ? 'solver-pill solver-pill-failed'
    : 'solver-pill'

  const title = status === 'complete' ? 'Schedule ready'
    : status === 'failed' ? 'Solve failed'
    : (label || 'Generating schedule…')

  const subtitle = status === 'complete' ? (label || 'Tap to view')
    : status === 'failed' ? 'Tap for details'
    : `${PHASES[phaseIdx]} · ${progress}%`

  return (
    <>
      <div className={pillClass} onClick={() => setExpanded(true)} role="button" aria-label="Schedule generation status">
        {status === 'running' ? (
          <div className="solver-pill-ring">
            <svg width="36" height="36" viewBox="0 0 36 36">
              <circle className="solver-pill-ring-bg" cx="18" cy="18" r={radius} fill="none" strokeWidth="4" />
              <circle className="solver-pill-ring-fg" cx="18" cy="18" r={radius} fill="none" strokeWidth="4"
                strokeDasharray={circumference} strokeDashoffset={offset} strokeLinecap="round" />
            </svg>
            <span className="solver-pill-pct">{progress}%</span>
          </div>
        ) : status === 'complete' ? (
          <div style={{ width: 36, height: 36, borderRadius: '50%', background: 'rgba(255,255,255,0.25)', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="#fff" strokeWidth="3"><polyline points="20 6 9 17 4 12"/></svg>
          </div>
        ) : (
          <div style={{ width: 36, height: 36, borderRadius: '50%', background: '#FEE2E2', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="#DC2626" strokeWidth="2.5"><circle cx="12" cy="12" r="10"/><line x1="12" y1="8" x2="12" y2="12"/><line x1="12" y1="16" x2="12.01" y2="16"/></svg>
          </div>
        )}
        <div className="solver-pill-text">
          <span className="solver-pill-title">{title}</span>
          <span className="solver-pill-sub">{subtitle}</span>
        </div>
      </div>

      {expanded && (
        <div className="solver-expand-backdrop" onClick={() => setExpanded(false)}>
          <div className="solver-expand-card" onClick={e => e.stopPropagation()}>

            {/* Header */}
            <div className="solver-expand-header">
              <div className={`solver-expand-header-icon ${status}`}>
                {status === 'running' && (
                  <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="#fff" strokeWidth="2.5" style={{ animation: 'pillSpin 1.2s linear infinite' }}><path d="M21 12a9 9 0 1 1-6.219-8.56"/></svg>
                )}
                {status === 'complete' && (
                  <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="#059669" strokeWidth="3"><polyline points="20 6 9 17 4 12"/></svg>
                )}
                {status === 'failed' && (
                  <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="#DC2626" strokeWidth="2.5"><circle cx="12" cy="12" r="10"/><line x1="12" y1="8" x2="12" y2="12"/><line x1="12" y1="16" x2="12.01" y2="16"/></svg>
                )}
              </div>
              <div>
                <div className="solver-expand-header-title">
                  {status === 'running'  ? 'Generating Schedule…' :
                   status === 'complete' ? 'Schedule Ready' :
                   'Schedule Generation Failed'}
                </div>
                <div className="solver-expand-header-sub">
                  {status === 'running'  ? `Currently solving: ${PHASES[phaseIdx]}  ·  ${progress}% complete` :
                   status === 'complete' ? (label || 'Your schedule has been generated and is ready to save.') :
                   'A feasible solution could not be found. Review the Readiness panel for conflicts.'}
                </div>
              </div>
            </div>

            <button className="solver-expand-close" onClick={() => setExpanded(false)} aria-label="Close">
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="#4B7060" strokeWidth="2.5">
                <line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/>
              </svg>
            </button>

            {/* Body — the animated loader */}
            <div className="solver-expand-body">
              <ScheduleGeneratorLoader
                message={
                  status === 'running'  ? `Generating ${PHASES[phaseIdx]} schedule…` :
                  status === 'complete' ? 'All phases complete!' :
                  'Solve failed — check readiness checks.'
                }
                progress={progress}
                showProgress={status !== 'failed'}
                isOverlay={false}
              />
            </div>

            {/* Footer action bar */}
            {status === 'complete' && (
              <div className="solver-expand-done-bar">
                <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                  <div style={{ width: 34, height: 34, borderRadius: '50%', background: '#D1FAE5', border: '1px solid #A7F3D0', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="#059669" strokeWidth="3"><polyline points="20 6 9 17 4 12"/></svg>
                  </div>
                  <div>
                    <div style={{ fontSize: 13, fontWeight: 700, color: G.ink, lineHeight: 1.2 }}>Ready in memory</div>
                    <div style={{ fontSize: 11.5, color: G.muted, fontWeight: 500, marginTop: 1 }}>Save it to keep it permanently</div>
                  </div>
                </div>
                <div style={{ display: 'flex', gap: 10 }}>
                  <button className="solver-done-btn secondary" onClick={() => { setExpanded(false); navigate('/dashboard/schedule') }}>
                    <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"><path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z"/><circle cx="12" cy="12" r="3"/></svg>
                    View Schedule
                  </button>
                  {onSave && (
                    <button className="solver-done-btn primary" onClick={() => { onSave(); setExpanded(false) }}>
                      <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"><path d="M19 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h11l5 5v11a2 2 0 0 1-2 2z"/><polyline points="17 21 17 13 7 13 7 21"/></svg>
                      Save Schedule
                    </button>
                  )}
                </div>
              </div>
            )}
            {status === 'failed' && (
              <div className="solver-expand-done-bar" style={{ background: '#FEF2F2', borderTopColor: '#FECACA' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                  <div style={{ width: 34, height: 34, borderRadius: '50%', background: '#FEE2E2', border: '1px solid #FECACA', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="#DC2626" strokeWidth="2.5"><circle cx="12" cy="12" r="10"/><line x1="12" y1="8" x2="12" y2="12"/><line x1="12" y1="16" x2="12.01" y2="16"/></svg>
                  </div>
                  <span style={{ fontSize: 13, fontWeight: 600, color: '#B91C1C' }}>Check the Readiness panel for conflicts, then try again.</span>
                </div>
                <button className="solver-done-btn secondary" style={{ borderColor: '#FECACA', color: '#DC2626' }} onClick={() => { setExpanded(false); navigate('/dashboard/scheduler') }}>
                  Go to Scheduler
                </button>
              </div>
            )}
          </div>
        </div>
      )}
    </>
  )
}