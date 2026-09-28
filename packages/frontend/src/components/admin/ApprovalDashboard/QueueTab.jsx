import { useState } from 'react'
import { createPortal } from 'react-dom'
import G from './tokens'
import { EmptyState, ICONS } from './primitives'
import AdminQueueRail, { queueHeadCopy } from './AdminQueueRail'
import { ConfirmModal } from '../../ScheduleView/PublishModal'

// How many programs are approved / waiting on review in a queue (from data the tab already has).
function statusCounts(q) {
  const v = Object.values(q?.programStatus || {})
  return {
    total: (q?.queue || []).length || v.length,
    approved: v.filter(s => s === 'approved').length,
    submitted: v.filter(s => s === 'submitted').length,
  }
}

function QueueTab({ queues, activeQueueId, setActiveQueueId, onAdvance, onFinish, onDelete, showToast, masterFinalized }) {
  const [busy, setBusy] = useState(false)
  const [confirmDelete, setConfirmDelete] = useState(null)
  const [confirmFinish, setConfirmFinish] = useState(null)

  const active = queues.find(q => (q.id || q.queueId) === activeQueueId) || queues[0] || null
  const activeId = active ? (active.id || active.queueId) : null
  const order = active?.queue || []
  const statuses = active?.programStatus || {}
  const turnIndex = active?.currentTurnIndex ?? 0
  const isComplete = active?.status === 'completed' || turnIndex >= order.length
  const effectiveTurnIndex = isComplete ? order.length : turnIndex
  const currentProgram = !isComplete ? order[turnIndex] : null
  const head = queueHeadCopy(order, statuses, effectiveTurnIndex)
  const delCounts = confirmDelete ? statusCounts(confirmDelete) : null
  const finCounts = confirmFinish ? statusCounts(confirmFinish) : null

  async function runBusy(fn) {
    setBusy(true)
    try { await fn() } finally { setBusy(false) }
  }

  if (queues.length === 0) {
    return <div className="ap-card ap-fadein"><EmptyState icon={ICONS.calendar} text="No coordinator queues yet. Create one to set the scheduling order for this semester." /></div>
  }

  return (
    <div className="ap-fadein" style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
      {queues.length > 1 && (
        <div className="ap-card" style={{ padding: 12, display: 'flex', gap: 8, flexWrap: 'wrap' }}>
          {queues.map(q => {
            const qId = q.id || q.queueId
            const isActive = qId === activeId
            return (
              <button key={qId} onClick={() => setActiveQueueId(qId)} className={`r-tab${isActive ? ' active' : ''}`}>
                {q.semester} {q.academicYear}
                {q.status === 'completed' && <span style={{ marginLeft: 6, opacity: 0.7 }}>· done</span>}
              </button>
            )
          })}
        </div>
      )}

      {active && (
        <div className="ap-card" style={{ overflow: 'hidden' }}>
          <div className="aq-head" style={{ borderRadius: 0, flexWrap: 'wrap' }}>
            <div style={{ minWidth: 0 }}>
              <div className="aq-head-title">{head.title}</div>
              <div className="aq-head-sub">
                {active.semester} {active.academicYear}{head.subtitle ? ` · ${head.subtitle}` : ''}
              </div>
            </div>
            <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
              {!isComplete && currentProgram && (
                <>
                  <button onClick={() => runBusy(() => onAdvance(activeId))} disabled={busy} className="btn-blue">
                    {busy
                      ? <><svg className="ap-spin" width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"><path d="M21 12a9 9 0 1 1-6.22-8.56"/></svg> Advancing…</>
                      : <>Advance Queue <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"><polyline points="9 18 15 12 9 6"/></svg></>}
                  </button>
                </>
              )}
              <button onClick={() => setConfirmDelete(active)} className="btn-outline" style={{ background: 'rgba(255,255,255,0.14)', borderColor: 'rgba(255,255,255,0.4)', color: '#fff' }} title="Delete queue">
                <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><polyline points="3 6 5 6 21 6"/><path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"/></svg>
              </button>
              {active.status !== 'completed' && (
                <button onClick={() => setConfirmFinish(active)} className="btn-outline" style={{ background: 'rgba(255,255,255,0.14)', borderColor: 'rgba(255,255,255,0.4)', color: '#fff' }} title="Manually end this queue">
                  <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><rect x="5" y="5" width="14" height="14" rx="1.5"/></svg> Finish Queue
                </button>
              )}
            </div>
          </div>

          <div style={{ padding: '22px 20px' }}>
            <AdminQueueRail programs={order} statuses={statuses} turnIndex={effectiveTurnIndex} />
          </div>
        </div>
      )}

      {confirmDelete && createPortal(
        <div style={{ position: 'fixed', inset: 0, zIndex: 11000, background: 'rgba(10,30,18,0.55)', backdropFilter: 'blur(4px)', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 24 }} onClick={() => !busy && setConfirmDelete(null)}>
          <ConfirmModal
            eyebrow="Delete queue"
            title={`Delete the ${confirmDelete.semester} ${confirmDelete.academicYear} queue?`}
            subtitle="This can't be undone."
            effects={[
              { title: 'The queue and its turn order are deleted', tag: 'Deleted', detail: 'Its audit history is deleted too.' },
              ...(!masterFinalized
                ? [
                    { title: 'The unpublished master schedule is deleted', tag: 'Deleted', detail: "It isn't published yet, so it isn't saved anywhere else." },
                    ...((delCounts.approved + delCounts.submitted) > 0
                      ? [{ title: 'Submitted and approved schedules return to draft', tag: 'Reset', detail: `${delCounts.approved + delCounts.submitted} schedule${(delCounts.approved + delCounts.submitted) > 1 ? 's go' : ' goes'} back to coordinators as drafts.` }]
                      : []),
                  ]
                : [{ title: 'The published master schedule stays', detail: "It's detached from the queue. Faculty still see it and coordinator schedules aren't touched." }]),
            ]}
            busy={busy}
            onCancel={() => setConfirmDelete(null)}
            onConfirm={() => runBusy(async () => { await onDelete(confirmDelete.id || confirmDelete.queueId); setConfirmDelete(null) })}
            confirmLabel="Delete Queue"
            busyLabel="Deleting…"
            confirmBg={G.red}
            border={G.border}
          />
        </div>,
        document.body
      )}
      {confirmFinish && createPortal(
        <div style={{ position: 'fixed', inset: 0, zIndex: 11000, background: 'rgba(10,30,18,0.55)', backdropFilter: 'blur(4px)', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 24 }} onClick={() => !busy && setConfirmFinish(null)}>
          <ConfirmModal
            eyebrow="Finish queue"
            title={`Finish the ${confirmFinish.semester} ${confirmFinish.academicYear} queue?`}
            subtitle="Use this to call the term done manually."
            effects={[
              {
                title: 'The queue closes',
                tag: 'Closes',
                detail: finCounts.approved >= finCounts.total && finCounts.total > 0
                  ? 'Every program already has an approved schedule.'
                  : `${finCounts.approved} of ${finCounts.total} programs have an approved schedule. The others won't be able to submit anymore.`,
                progress: { done: finCounts.approved, total: finCounts.total },
              },
              { title: 'Nothing is deleted', detail: 'Submitted schedules, the master schedule and the audit trail stay as they are.' },
            ]}
            busy={busy}
            onCancel={() => setConfirmFinish(null)}
            onConfirm={() => runBusy(async () => { await onFinish(confirmFinish.id || confirmFinish.queueId); setConfirmFinish(null) })}
            confirmLabel="Finish Queue"
            busyLabel="Finishing…"
            confirmBg={G.red}
            border={G.border}
          />
        </div>,
        document.body
      )}
    </div>
  )
}

export default QueueTab