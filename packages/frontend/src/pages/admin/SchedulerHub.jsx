import { useState, useEffect, useCallback } from 'react'
import { useSearchParams } from 'react-router-dom'
import { listQueues, getSubmittedSchedules } from '../../services/api'
import SchedulerPage from './SchedulerPage'
import ApprovalDashboardPage from './ApprovalDashboardPage'
import scheduleImage from '../../assets/SCHEDULE1.png'
import manageQueueImage from '../../assets/MANAGECOORQUE1.png'

/* ── Design tokens (matches SchedulerPage / ApprovalDashboardPage) ── */
const G = {
  meadow: 'var(--meadow, var(--meadow))', meadowDeep: 'var(--meadow-deep)', meadowMid: 'var(--meadow-mid)', meadowSoft: 'var(--meadow-soft)', meadowBorder: 'var(--meadow-border)',
  ink: 'var(--ink, #0E2A20)', inkMid: '#1C3D2A', muted: 'var(--muted, #4B7060)', muted2: 'var(--muted2, #6B8C7A)',
  border: 'var(--border)', borderLight: 'var(--hover)', bg: 'var(--bg, #F2F7F4)', hover: 'var(--hover)',
  amber: '#D97706', amberSoft: '#FEF3C7', amberBorder: '#FDE68A',
}

if (!document.getElementById('scheduler-hub-style')) {
  const s = document.createElement('style')
  s.id = 'scheduler-hub-style'
  s.textContent = `
    @keyframes shPulse { 0%,100%{box-shadow:0 0 0 0 rgba(217,119,6,0.35)} 50%{box-shadow:0 0 0 5px rgba(217,119,6,0)} }
    @keyframes shFadeIn { from{opacity:0;transform:translateY(8px)} to{opacity:1;transform:translateY(0)} }
    .sh-choice-card { background: var(--surface); border:1px solid ${G.border}; border-radius:16px; padding:0; margin:0;
      cursor:pointer; transition:box-shadow .15s, transform .15s; text-align:left; font:inherit; appearance:none;
      display:flex; flex-direction:column; animation:shFadeIn .35s ease both; font-family:'Poppins',sans-serif;
      box-shadow:0 1px 4px rgba(0,0,0,0.04); overflow:hidden; }
    .sh-choice-card:hover { box-shadow:0 10px 26px rgba(0,0,0,0.12); transform:translateY(-3px); }
    .sh-choice-head { padding:26px 22px 22px; display:flex; align-items:center; justify-content:space-between; gap:10px; }
    .sh-choice-icon { width:44px; height:44px; border-radius:11px; display:flex; align-items:center; justify-content:center;
      flex-shrink:0; background:rgba(255,255,255,0.22); }
    .sh-choice-pill { display:inline-flex; align-items:center; gap:5px; padding:3px 9px; border-radius:6px;
      font-size:10px; font-weight:700; letter-spacing:.3px; white-space:nowrap; background:rgba(255,255,255,0.22); color:#fff; }
    .sh-choice-pill-dot { width:5px; height:5px; border-radius:50%; flex-shrink:0; background: var(--surface); }
    .sh-choice-body { padding:16px 22px 20px; display:flex; flex-direction:column; gap:12px; flex:1; }
    .sh-choice-title { font-size:16px; font-weight:800; font-family:"'Poppins',sans-serif"; color:#fff; }
    .sh-choice-meta { display:flex; align-items:center; gap:7px; font-size:11.5px; color:${G.muted2}; font-weight:600;
      padding-top:12px; border-top:1px solid ${G.borderLight}; }
    .sh-choice-cta { display:inline-flex; align-items:center; gap:6px; font-size:12.5px; font-weight:700; margin-top:auto; }
    .sh-badge { display:inline-flex; align-items:center; justify-content:center; min-width:19px; height:19px; padding:0 5px;
      border-radius:99px; background:${G.amber}; color:#fff; font-size:10.5px; font-weight:800; animation:shPulse 2s infinite; }
    .sh-back-btn { display:inline-flex; align-items:center; gap:6px; padding:4px 11px; border-radius:8px;
      border:1.5px solid ${G.border}; background: var(--surface); color:${G.muted}; font-size:11.5px; font-weight:700;
      cursor:pointer; font-family:'Poppins',sans-serif; transition:all .15s; }
    .sh-back-btn:hover { border-color:${G.meadowBorder}; color:${G.meadowDeep}; background:${G.hover}; }
  `
  document.head.appendChild(s)
}

const CHOICES = [
  {
    key: 'generate',
    title: 'Generate a Schedule',
    who: 'For building or testing a schedule yourself.',
    features: [
      'Walks you through the 3-step wizard',
      'Runs the solver and shows live status',
      'Lets you tweak rooms, sections, and constraints',
    ],
    accent: G.meadowMid,
    image: scheduleImage,
  },
  {
    key: 'manage',
    title: 'Manage Coordinator Queue',
    who: 'For coordinators submitting schedules for your approval.',
    features: [
      'Review schedules submitted by coordinators',
      'Approve, reject, or send back for revision',
      'Track queue activity and pending counts',
    ],
    accent: G.meadowMid,
    image: manageQueueImage,
  },
]

function LandingChoice({ onPick, pendingCount, queueActive }) {
  return (
    <div style={{ flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'flex-start', padding: '72px 28px 40px' }}>
      <div style={{ maxWidth: 880, width: '100%' }}>
        <div style={{ textAlign: 'center', marginBottom: 40 }}>
          <h1 style={{ fontSize: 24, fontWeight: 800, color: G.ink, fontFamily: "'Poppins',sans-serif", margin: 0 }}>What do you want to do?</h1>
          <p style={{ fontSize: 14, color: G.muted, margin: '8px 0 0' }}>Pick one — you can switch to the other anytime.</p>
        </div>
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 30 }}>
          {CHOICES.map((c, i) => {
            const isManage = c.key === 'manage'
            const pillLabel = isManage ? (queueActive ? 'Queue active' : 'No active queue') : '3-step wizard'
            return (
              <button
                key={c.key}
                className="sh-choice-card"
                onClick={() => onPick(c.key)}
                style={{ animationDelay: `${i * 0.06}s` }}
              >
                <div className="sh-choice-head" style={{ background: c.accent, padding: '32px 26px 26px' }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 14 }}>
                    <div className="sh-choice-icon" style={{ width: 52, height: 52, borderRadius: 13, background: 'rgba(255,255,255,0.22)' }}>
                      <img src={c.image} alt={c.title} className="no-theme-filter" style={{ width: 32, height: 32, objectFit: 'contain' }} />
                    </div>
                    <div className="sh-choice-title" style={{ fontSize: 18 }}>{c.title}</div>
                  </div>
                  <span className="sh-choice-pill">
                    {isManage && <span className="sh-choice-pill-dot" style={{ opacity: queueActive ? 1 : 0.45 }} />}
                    {pillLabel}
                  </span>
                </div>
                <div className="sh-choice-body" style={{ padding: '22px 26px 26px', gap: 16 }}>
                  <div style={{ fontSize: 13.5, color: G.inkMid, fontWeight: 600, lineHeight: 1.5 }}>
                    {c.who}
                  </div>
                  <ul style={{ margin: 0, padding: 0, listStyle: 'none', display: 'flex', flexDirection: 'column', gap: 9 }}>
                    {c.features.map((f, fi) => (
                      <li key={fi} style={{ display: 'flex', alignItems: 'flex-start', gap: 8, fontSize: 12.5, color: G.muted, fontWeight: 500, lineHeight: 1.4 }}>
                        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke={c.accent} strokeWidth="2.5" style={{ flexShrink: 0, marginTop: 2 }}><polyline points="20 6 9 17 4 12"/></svg>
                        {f}
                      </li>
                    ))}
                  </ul>
                  {isManage && pendingCount > 0 && (
                    <div className="sh-choice-meta" style={{ borderTop: `1px solid ${G.borderLight}`, paddingTop: 14, marginTop: 2 }}>
                      <span className="sh-badge" style={{ marginLeft: 'auto' }}>{pendingCount} pending</span>
                    </div>
                  )}
                  <div className="sh-choice-cta" style={{ color: c.accent, fontSize: 13.5 }}>
                    Open
                    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"><polyline points="9 18 15 12 9 6"/></svg>
                  </div>
                </div>
              </button>
            )
          })}
        </div>
      </div>
    </div>
  )
}

export default function SchedulerHub() {
  const [searchParams] = useSearchParams()
  const preselect = searchParams.get('mode') === 'manage' ? 'manage'
    : searchParams.get('mode') === 'generate' ? 'generate' : null
  const [mode, setMode] = useState(preselect) // null = landing choice screen
  const [pendingCount, setPendingCount] = useState(0)
  const [queueActive, setQueueActive] = useState(false)

  // Lightweight, independent of whichever screen is mounted — just enough to
  // flag the "Manage Queue" card so it's obvious something needs attention.
  const refreshBadge = useCallback(() => {
    Promise.all([
      listQueues().catch(() => []),
      getSubmittedSchedules().catch(() => []),
    ]).then(([q, s]) => {
      const qArr = Array.isArray(q) ? q : (q?.queues ?? [])
      const sArr = Array.isArray(s) ? s : (s?.schedules ?? [])
      setQueueActive(qArr.some(x => x.status === 'active') || qArr.length > 0)
      setPendingCount(sArr.filter(x => x.status === 'submitted').length)
    }).catch(() => {})
  }, [])

  useEffect(() => {
    refreshBadge()
    const t = setInterval(refreshBadge, 20000)
    return () => clearInterval(t)
  }, [refreshBadge])

  if (mode === null) {
    return (
      <div style={{ display: 'flex', flexDirection: 'column', height: '100%', minHeight: '100%', background: G.bg }}>
        <LandingChoice onPick={setMode} pendingCount={pendingCount} queueActive={queueActive} />
      </div>
    )
  }

  const activeChoice = CHOICES.find(c => c.key === mode)

  return (
    <div style={{ display: 'flex', flexDirection: 'column', height: '100%', minHeight: '100%', background: G.bg }}>
      {/* Slim back bar — always visible so switching flows is one click away */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '6px 24px', flexShrink: 0, minHeight: 0 }}>
        <button className="sh-back-btn" onClick={() => setMode(null)}>
          <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"><polyline points="15 18 9 12 15 6"/></svg>
          Back
        </button>
        <span style={{ width: 1, height: 12, background: G.border, flexShrink: 0 }} />
        <span style={{ fontSize: 12, fontWeight: 700, color: G.meadowDeep }}>{activeChoice.title}</span>
      </div>

      {/* Active screen — each page manages its own data/state, untouched */}
      <div style={{ flex: 1, overflow: 'auto', minHeight: 0 }}>
        {mode === 'generate' ? <SchedulerPage /> : <ApprovalDashboardPage />}
      </div>
    </div>
  )
}