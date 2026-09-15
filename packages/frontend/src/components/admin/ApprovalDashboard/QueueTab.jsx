import { useState } from 'react'
import { createPortal } from 'react-dom'
import G from './tokens'
import { EmptyState, ICONS } from './primitives'
import AdminQueueRail, { queueHeadCopy } from './AdminQueueRail'
import DraggableOrderList from './DraggableOrderList'

function QueueTab({ queues, activeQueueId, setActiveQueueId, onSkip, onAdvance, onFinish, onDelete, onReorder, showToast }) {
  const [dragIndex, setDragIndex] = useState(null)
  const [overIndex, setOverIndex] = useState(null)
  const [busy, setBusy] = useState(false)
  const [confirmDelete, setConfirmDelete] = useState(null)
  const [confirmFinish, setConfirmFinish] = useState(null)

  const active = queues.find(q => (q.id || q.queueId) === activeQueueId) || queues[0] || null
  const activeId = active ? (active.id || active.queueId) : null
  const order = active?.queue || []
  const statuses = active?.programStatus || {}
  const turnIndex = active?.currentTurnIndex ?? 0
  const isComplete = active?.status === 'completed' || turnIndex >= order.length
  const currentProgram = !isComplete ? order[turnIndex] : null
  const head = queueHeadCopy(order, statuses, turnIndex)

  async function runBusy(fn) {
    setBusy(true)
    try { await fn() } finally { setBusy(false) }
  }

  function handleDrop(dropAt) {
    if (dragIndex === null || dragIndex === dropAt || !activeId) { setDragIndex(null); setOverIndex(null); return }
    const next = [...order]
    const [moved] = next.splice(dragIndex, 1)
    next.splice(dropAt, 0, moved)
    setDragIndex(null); setOverIndex(null)
    onReorder(activeId, next)
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
              <div className="aq-head-sub">{head.subtitle || `${active.semester} · ${active.academicYear}`}</div>
            </div>
            <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
              {!isComplete && currentProgram && (
                <>
                  <button onClick={() => runBusy(() => onSkip(activeId, currentProgram))} disabled={busy} className="btn-outline" style={{ background: 'rgba(255,255,255,0.14)', borderColor: 'rgba(255,255,255,0.4)', color: '#fff' }}>
                    <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"><polyline points="13 17 18 12 13 7"/><polyline points="6 17 11 12 6 7"/></svg> Skip
                  </button>
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
            <AdminQueueRail programs={order} statuses={statuses} turnIndex={turnIndex} />
          </div>

          <div style={{ padding: '4px 20px 20px' }}>
            <label style={{ fontSize: 11.5, fontWeight: 600, color: G.muted, display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 8 }}>
              <span>Scheduling Order</span>
              <span style={{ fontWeight: 500, color: 'var(--meadow-text-hover)', display: 'inline-flex', alignItems: 'center', gap: 4 }}>
                <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><circle cx="9" cy="6" r="1"/><circle cx="9" cy="12" r="1"/><circle cx="9" cy="18" r="1"/><circle cx="15" cy="6" r="1"/><circle cx="15" cy="12" r="1"/><circle cx="15" cy="18" r="1"/></svg>
                drag to reorder
              </span>
            </label>
            <div style={{ background: G.bg, border: `1px solid ${G.border}`, borderRadius: 12, padding: 8 }}>
              <DraggableOrderList
                order={order}
                dragIndex={dragIndex}
                overIndex={overIndex}
                onDragStart={setDragIndex}
                onDragEnter={setOverIndex}
                onDrop={handleDrop}
                onDragEnd={() => { setDragIndex(null); setOverIndex(null) }}
              />
            </div>
          </div>
        </div>
      )}

      {confirmDelete && createPortal(
        <div className="ap-modal-overlay" style={{ zIndex: 3000 }} onClick={() => !busy && setConfirmDelete(null)}>
          <div className="ap-modal" style={{ width: 420 }} onClick={e => e.stopPropagation()}>
            <div style={{ display: 'flex', gap: 14, marginBottom: 20 }}>
              <div style={{ width: 46, height: 46, borderRadius: '50%', background: G.redSoft, color: G.red, display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><circle cx="12" cy="12" r="10"/><line x1="15" y1="9" x2="9" y2="15"/><line x1="9" y1="9" x2="15" y2="15"/></svg>
              </div>
              <div>
                <h3 style={{ margin: 0, fontSize: 16, color: 'var(--ink)' }}>Delete Queue?</h3>
                <p style={{ margin: '6px 0 0', fontSize: 13, color: 'var(--muted)', lineHeight: 1.5 }}>
                  This removes the {confirmDelete.semester} {confirmDelete.academicYear} queue and its turn order. This cannot be undone.
                </p>
              </div>
            </div>
            <div style={{ display: 'flex', gap: 8, justifyContent: 'flex-end' }}>
              <button onClick={() => setConfirmDelete(null)} className="btn-outline" disabled={busy}>Cancel</button>
              <button onClick={() => runBusy(async () => { await onDelete(confirmDelete.id || confirmDelete.queueId); setConfirmDelete(null) })} disabled={busy} className="btn-danger" style={{ background: G.red, color: '#fff', border: 'none' }}>
                {busy ? 'Deleting…' : 'Delete Queue'}
              </button>
            </div>
          </div>
        </div>,
        document.body
      )}
      {confirmFinish && createPortal(
        <div className="ap-modal-overlay" style={{ zIndex: 3000 }} onClick={() => !busy && setConfirmFinish(null)}>
          <div className="ap-modal" style={{ width: 420 }} onClick={e => e.stopPropagation()}>
            <div style={{ display: 'flex', gap: 14, marginBottom: 20 }}>
              <div style={{ width: 46, height: 46, borderRadius: '50%', background: G.redSoft, color: G.red, display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><rect x="5" y="5" width="14" height="14" rx="1.5"/></svg>
              </div>
              <div>
                <h3 style={{ margin: 0, fontSize: 16, color: 'var(--ink)' }}>Finish Queue?</h3>
                <p style={{ margin: '6px 0 0', fontSize: 13, color: 'var(--muted)', lineHeight: 1.5 }}>
                  This ends the {confirmFinish.semester} {confirmFinish.academicYear} queue right now, even if some programs haven't submitted an approved schedule yet. Use this when you're manually calling it done for the term.
                </p>
              </div>
            </div>
            <div style={{ display: 'flex', gap: 8, justifyContent: 'flex-end' }}>
              <button onClick={() => setConfirmFinish(null)} className="btn-outline" disabled={busy}>Cancel</button>
              <button onClick={() => runBusy(async () => { await onFinish(confirmFinish.id || confirmFinish.queueId); setConfirmFinish(null) })} disabled={busy} className="btn-danger" style={{ background: G.red, color: '#fff', border: 'none' }}>
                {busy ? 'Finishing…' : 'Finish Queue'}
              </button>
            </div>
          </div>
        </div>,
        document.body
      )}
    </div>
  )
}

export default QueueTab