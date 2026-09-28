import G from './tokens'
import AdminQueueRail, { queueHeadCopy } from './AdminQueueRail'
import { getProgColor, progShort, timeAgo } from './utils'

/* Drop this file in: src/components/admin/ApprovalDashboard/ApprovalOverview.jsx
   Used by the admin DashboardPage. Read-only summary, all actions route to the
   Approval Dashboard page. */

const OVERVIEW_STYLE = `
  .aov-grid {
    display: grid;
    grid-template-columns: minmax(0, 1.55fr) minmax(0, 1fr);
  }
  .aov-left { padding: 20px 22px 22px; min-width: 0; }
  .aov-right { padding: 18px 20px 16px; border-left: 1px solid var(--border); min-width: 0; display: flex; flex-direction: column; }
  .aov-sub-row { display: flex; align-items: center; gap: 12px; padding: 10px 0; border-bottom: 1px solid var(--border); cursor: pointer; transition: background .13s; }
  .aov-sub-row:last-of-type { border-bottom: none; }
  .aov-sub-row:hover { background: var(--hover); margin: 0 -10px; padding-left: 10px; padding-right: 10px; border-radius: 8px; }
  .aov-foot { display: grid; grid-template-columns: repeat(3, minmax(0, 1fr)); border-top: 1px solid var(--border); }
  .aov-foot > div { padding: 12px 22px; min-width: 0; }
  .aov-foot > div + div { border-left: 1px solid var(--border); }
  .aov-link { background: none; border: none; padding: 0; cursor: pointer; font-family: Inter, sans-serif; font-size: 11.5px; font-weight: 700; color: var(--meadow-text); }
  .aov-link:hover { text-decoration: underline; }
  .ap-spin { animation: spin 1s linear infinite; }
  @media (max-width: 960px) {
    .aov-grid { grid-template-columns: minmax(0, 1fr); }
    .aov-right { border-left: none; border-top: 1px solid var(--border); }
  }
  @media (max-width: 560px) {
    .aov-foot { grid-template-columns: minmax(0, 1fr); }
    .aov-foot > div + div { border-left: none; border-top: 1px solid var(--border); }
  }
`

function Pill({ label, color, bg, border, dot }) {
  return (
    <span style={{ display: 'inline-flex', alignItems: 'center', gap: 6, fontSize: 10.5, fontWeight: 700, padding: '3px 10px', borderRadius: 99, background: bg, color, border: `1px solid ${border || 'transparent'}`, whiteSpace: 'nowrap' }}>
      {dot && <span style={{ width: 6, height: 6, borderRadius: '50%', background: dot }} />}
      {label}
    </span>
  )
}

function FootItem({ label, value, sub, color }) {
  return (
    <div>
      <div style={{ fontSize: 10, fontWeight: 700, letterSpacing: '.5px', textTransform: 'uppercase', color: 'var(--muted2)' }}>{label}</div>
      <div style={{ fontSize: 15, fontWeight: 800, color: color || 'var(--ink)', fontFamily: "'Sora',sans-serif", marginTop: 3, lineHeight: 1.2 }}>{value}</div>
      {sub && <div style={{ fontSize: 11, color: 'var(--muted2)', marginTop: 2, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{sub}</div>}
    </div>
  )
}

export default function ApprovalOverview({ queue, submissions = [], master, loading, onNavigate }) {
  const goApprovals = () => onNavigate('/dashboard/scheduler?mode=manage')

  // Only render while there is an active queue
  if (loading || !queue) return null

  /* ── Derived ── */
  const qId = queue.id || queue.queueId
  const order = queue.queue || []
  const statuses = queue.programStatus || {}
  const turnIndex = queue.currentTurnIndex ?? 0
  const isComplete = queue.status === 'completed' || turnIndex >= order.length
  const effectiveTurn = isComplete ? order.length : turnIndex
  const currentProgram = !isComplete ? order[turnIndex] : null
  const head = queueHeadCopy(order, statuses, effectiveTurn)

  const mine = submissions.filter(s => (s.queueId || null) === qId)
  const pending = mine
    .filter(s => s.status === 'submitted')
    .sort((a, b) => new Date(a.submittedAt || 0) - new Date(b.submittedAt || 0))
  const approved = mine.filter(s => s.status === 'approved')

  const doneCount = order.filter(p => ['approved', 'skipped'].includes(statuses[p])).length
  const approvedProgs = order.filter(p => statuses[p] === 'approved').length
  const pct = order.length ? Math.round((doneCount / order.length) * 100) : 0

  const isFinalized = master?.status === 'finalized'
  const masterEvents = master?.schedule?.length ?? null
  const lastSubmitted = [...mine].sort((a, b) => new Date(b.submittedAt || 0) - new Date(a.submittedAt || 0))[0]

  const curStatus = currentProgram ? (statuses[currentProgram] || 'waiting') : null
  const turnColor = isComplete ? 'var(--muted2)' : curStatus === 'submitted' ? '#F59E0B' : 'var(--meadow-text)'

  return (
    <div className="d-card" style={{ overflow: 'hidden' }}>
      <style>{OVERVIEW_STYLE}</style>

      {/* Header */}
      <div style={{ padding: '14px 22px', borderBottom: '1px solid var(--border)', display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 10, flexWrap: 'wrap' }}>
        <div style={{ minWidth: 0 }}>
          <div style={{ fontSize: 13, fontWeight: 700, color: 'var(--ink)' }}>Scheduling Queue</div>
          <div style={{ fontSize: 11, color: 'var(--muted2)', marginTop: 1 }}>
            {queue.semester} {queue.academicYear}
          </div>
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
          {pending.length > 0 && (
            <Pill label={`${pending.length} awaiting review`} color="#B45309" bg="rgba(245, 158, 11, 0.12)" border="rgba(245, 158, 11, 0.3)" dot="#F59E0B" />
          )}
          <Pill
            label={isComplete ? 'Completed' : 'Active'}
            color={isComplete ? 'var(--muted)' : 'var(--meadow-text)'}
            bg={isComplete ? 'var(--hover)' : 'var(--meadow-soft)'}
            border={isComplete ? 'var(--border)' : 'var(--meadow-border)'}
            dot={isComplete ? 'var(--muted2)' : 'var(--meadow)'}
          />
          <button onClick={goApprovals} style={{ padding: '5px 12px', borderRadius: 8, border: '1.5px solid var(--border)', background: 'var(--hover)', color: 'var(--muted)', fontSize: 11.5, fontWeight: 600, cursor: 'pointer', fontFamily: 'Inter,sans-serif' }}>
            Manage →
          </button>
        </div>
      </div>

      <div className="aov-grid">
        {/* Left: current turn + rail */}
        <div className="aov-left">
          <div style={{ display: 'flex', alignItems: 'flex-end', justifyContent: 'space-between', gap: 16, flexWrap: 'wrap', marginBottom: 18 }}>
            <div style={{ minWidth: 0 }}>
              <div style={{ fontSize: 10, fontWeight: 700, letterSpacing: '.6px', textTransform: 'uppercase', color: 'var(--muted2)', marginBottom: 5 }}>
                {isComplete ? 'Status' : 'Current turn'}
              </div>
              <div style={{ fontSize: 22, fontWeight: 800, color: turnColor, fontFamily: "'Sora',sans-serif", letterSpacing: '-.3px', lineHeight: 1.1 }}>
                {isComplete ? 'Queue complete' : currentProgram}
              </div>
              <div style={{ fontSize: 12, color: 'var(--muted)', marginTop: 5, lineHeight: 1.45 }}>
                {head.subtitle}
              </div>
            </div>
            <div style={{ textAlign: 'right', minWidth: 120 }}>
              <div style={{ fontSize: 11, fontWeight: 700, color: 'var(--ink)' }}>
                {doneCount} <span style={{ color: 'var(--muted2)', fontWeight: 500 }}>of {order.length} programs done</span>
              </div>
              <div style={{ height: 5, borderRadius: 99, background: 'var(--hover)', overflow: 'hidden', marginTop: 6 }}>
                <div style={{ height: '100%', width: `${pct}%`, borderRadius: 99, background: 'var(--meadow)', transition: 'width .5s ease' }} />
              </div>
            </div>
          </div>
          <AdminQueueRail programs={order} statuses={statuses} turnIndex={effectiveTurn} />
        </div>

        {/* Right: awaiting review */}
        <div className="aov-right">
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 6 }}>
            <div style={{ fontSize: 12, fontWeight: 700, color: 'var(--ink)' }}>Awaiting your review</div>
            {pending.length > 0 && (
              <span style={{ fontSize: 10.5, fontWeight: 800, minWidth: 20, textAlign: 'center', padding: '1px 7px', borderRadius: 99, background: '#F59E0B', color: '#fff' }}>{pending.length}</span>
            )}
          </div>

          {pending.length === 0 ? (
            <div style={{ flex: 1, display: 'flex', flexDirection: 'column', justifyContent: 'center', padding: '14px 0 8px' }}>
              <div style={{ width: 30, height: 30, borderRadius: '50%', background: 'var(--meadow-soft)', color: 'var(--meadow)', display: 'flex', alignItems: 'center', justifyContent: 'center', marginBottom: 10 }}>
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3"><polyline points="20 6 9 17 4 12" /></svg>
              </div>
              <div style={{ fontSize: 12.5, fontWeight: 700, color: 'var(--ink)' }}>Nothing to review</div>
              <div style={{ fontSize: 11.5, color: 'var(--muted2)', marginTop: 3, lineHeight: 1.5 }}>
                {isComplete
                  ? 'Every submission for this queue has been handled.'
                  : `Waiting on ${currentProgram} to submit their schedule.`}
              </div>
            </div>
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column' }}>
              {pending.slice(0, 4).map(s => {
                const c = getProgColor(s.programCode)
                return (
                  <div key={s.id || s.scheduleId} className="aov-sub-row" onClick={goApprovals}>
                    <div style={{ width: 34, height: 34, borderRadius: 9, background: `${c}18`, border: `1.5px solid ${c}35`, display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                      <span style={{ fontSize: 9.5, fontWeight: 800, color: c, fontFamily: "'IBM Plex Mono',monospace" }}>{progShort(s.programCode || '??')}</span>
                    </div>
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <div style={{ fontSize: 12, fontWeight: 700, color: 'var(--ink)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{s.name}</div>
                      <div style={{ fontSize: 11, color: 'var(--muted2)', marginTop: 1 }}>
                        {s.programCode}{s.eventCount != null ? ` · ${s.eventCount} events` : ''}{s.submittedAt ? ` · ${timeAgo(s.submittedAt)}` : ''}
                      </div>
                    </div>
                    <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="var(--muted2)" strokeWidth="2.5" style={{ flexShrink: 0 }}><polyline points="9 18 15 12 9 6" /></svg>
                  </div>
                )
              })}
              {pending.length > 4 && (
                <div style={{ marginTop: 6 }}>
                  <button className="aov-link" onClick={goApprovals}>+{pending.length - 4} more →</button>
                </div>
              )}
            </div>
          )}

          {pending.length > 0 && (
            <button onClick={goApprovals} style={{ marginTop: 'auto', alignSelf: 'stretch', padding: '8px 14px', borderRadius: 9, border: 'none', background: 'var(--meadow)', color: '#fff', fontSize: 12, fontWeight: 600, cursor: 'pointer', fontFamily: 'Inter,sans-serif' }}>
              Review submissions →
            </button>
          )}
        </div>
      </div>

      {/* Ledger footer */}
      <div className="aov-foot">
        <FootItem
          label="Approved"
          value={`${approved.length} schedule${approved.length === 1 ? '' : 's'}`}
          sub={`${approvedProgs} of ${order.length} programs`}
        />
        <FootItem
          label="Master schedule"
          value={isFinalized ? 'Published' : 'Not published'}
          color={isFinalized ? 'var(--meadow-text)' : 'var(--ink)'}
          sub={masterEvents != null ? `${masterEvents} classes merged` : 'Builds as programs are approved'}
        />
        <FootItem
          label="Last submission"
          value={lastSubmitted?.submittedAt ? timeAgo(lastSubmitted.submittedAt) : 'None yet'}
          sub={lastSubmitted ? `${lastSubmitted.programCode || ''} ${lastSubmitted.status === 'approved' ? '· approved' : '· pending'}`.trim() : null}
        />
      </div>
    </div>
  )
}