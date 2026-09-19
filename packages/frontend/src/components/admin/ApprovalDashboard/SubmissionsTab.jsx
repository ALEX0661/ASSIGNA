import { useState } from 'react'
import { createPortal } from 'react-dom'
import G from './tokens'
import { SCHED_STATUS } from './constants'
import { getProgColor, progShort, timeAgo } from './utils'
import { Badge, EmptyState, ICONS } from './primitives'
import RejectModal from './RejectModal'

function SubmissionsTab({ schedules, onOpen, onQuickApprove, onReject, onUnapprove, onBulkApprove, loadingIds, activeTermKey }) {
  const [search, setSearch] = useState('')
  const [rejectTarget, setRejectTarget] = useState(null)
  const [unapproveTarget, setUnapproveTarget] = useState(null)
  const [selected, setSelected] = useState(new Set())
  const [bulkBusy, setBulkBusy] = useState(false)

  const q = search.trim().toLowerCase()
  const matches = s => !q || `${s.name} ${s.programCode}`.toLowerCase().includes(q)
  function termKey(s) {
    const base = s.academicYear || s.semester ? `${s.academicYear || '—'}||${s.semester || '—'}` : '__no_term__'
    if (base === '__no_term__') return base
    return `${base}||${s.queueId || 'legacy'}`
  }
  const pending = schedules.filter(s => s.status === 'submitted' && matches(s)).sort((a, b) => new Date(a.submittedAt || 0) - new Date(b.submittedAt || 0))
  const approved = schedules.filter(s => s.status === 'approved' && matches(s)).sort((a, b) => new Date(b.approvedAt || b.submittedAt || 0) - new Date(a.approvedAt || a.submittedAt || 0))
  
  const activePending = pending.filter(s => termKey(s) === activeTermKey)

  function toggleSelect(id) { setSelected(prev => { const n = new Set(prev); n.has(id) ? n.delete(id) : n.add(id); return n }) }
  function toggleSelectAll() { setSelected(prev => prev.size === activePending.length ? new Set() : new Set(activePending.map(s => s.id || s.scheduleId))) }
  async function runBulkApprove() {
    setBulkBusy(true)
    try { await onBulkApprove([...selected]); setSelected(new Set()) }
    finally { setBulkBusy(false) }
  }

  function ScheduleRow({ s }) {
    const st = SCHED_STATUS[s.status] || SCHED_STATUS.submitted
    const c = getProgColor(s.programCode)
    const id = s.id || s.scheduleId
    const isLoading = loadingIds.has(id)
    const isPending = s.status === 'submitted'
    const isPastTerm = termKey(s) !== activeTermKey

    return (
      <div className="ap-row">
        {isPending && (
          <div style={{ width: 15, flexShrink: 0, display: 'flex', justifyContent: 'center' }}>
            {!isPastTerm && (
              <input type="checkbox" checked={selected.has(id)} onChange={() => toggleSelect(id)} onClick={e => e.stopPropagation()}
                style={{ width: 15, height: 15, accentColor: G.meadow, cursor: 'pointer' }} />
            )}
          </div>
        )}
        <div onClick={() => onOpen(id)} style={{ display: 'flex', alignItems: 'center', gap: 14, flex: 1, minWidth: 0, cursor: 'pointer' }}>
          <div style={{ width: 38, height: 38, borderRadius: 10, background: `${c}18`, border: `1.5px solid ${c}35`, display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
            <span style={{ fontSize: 10, fontWeight: 800, color: c, fontFamily: "'IBM Plex Mono',monospace" }}>{progShort(s.programCode || '??')}</span>
          </div>
          <div style={{ flex: 1, minWidth: 0 }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 3, flexWrap: 'wrap' }}>
              <span style={{ fontSize: 13, fontWeight: 700, color: G.ink }}>{s.name}</span>
              <Badge label={st.label} bg={st.bg} color={st.color} border={st.border} />
            </div>
            <div style={{ display: 'flex', gap: 13, fontSize: 11.5, color: G.muted, flexWrap: 'wrap' }}>
              <span style={{ fontWeight: 600, color: c }}>{s.programCode}</span>
              {s.eventCount != null && <span>{s.eventCount} events</span>}
              {s.submittedAt && <span>Submitted {timeAgo(s.submittedAt)}</span>}
              {s.semester && <span>{s.semester}</span>}
            </div>
          </div>
        </div>
        <div style={{ display: 'flex', gap: 6, flexShrink: 0 }}>
          <button onClick={() => onOpen(id)} className="btn-outline">
            <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z"/><circle cx="12" cy="12" r="3"/></svg>
            Review
          </button>
          {isPending && !isPastTerm && (
            <>
              <button onClick={() => setRejectTarget(s)} disabled={isLoading} className="btn-danger" style={{ padding: '7px 10px' }} title="Reject">
                <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"><circle cx="12" cy="12" r="10"/><line x1="15" y1="9" x2="9" y2="15"/><line x1="9" y1="9" x2="15" y2="15"/></svg>
              </button>
              <button onClick={() => onQuickApprove(id)} disabled={isLoading} className="btn-primary">
                {isLoading ? <svg className="ap-spin" width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"><path d="M21 12a9 9 0 1 1-6.22-8.56"/></svg> : <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"><polyline points="20 6 9 17 4 12"/></svg>}
                Approve
              </button>
            </>
          )}
          {!isPending && s.status === 'approved' && !isPastTerm && (
            <button onClick={() => setUnapproveTarget(s)} disabled={isLoading} className="btn-amber" style={{ padding: '7px 10px' }} title="Unapprove">
              <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"><path d="M10.29 3.86L1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z"/><line x1="12" y1="9" x2="12" y2="13"/><line x1="12" y1="17" x2="12.01" y2="17"/></svg>
            </button>
          )}
        </div>
      </div>
    )
  }

  function termLabel(k) {
    if (k === '__no_term__') return 'No term set'
    const [ay, sem] = k.split('||')
    const parts = [ay !== '—' ? `A.Y. ${ay}` : null, sem !== '—' ? sem : null].filter(Boolean)
    return parts.join(' • ')
  }

  const SEM_ORDER = { '1st semester': 0, '2nd semester': 1, 'summer': 2 }
  function semRank(sem) { const r = SEM_ORDER[(sem || '').trim().toLowerCase()]; return r === undefined ? 99 : r }
  function sortTermKeys(keys) {
    return [...keys].sort((ka, kb) => {
      if (ka === activeTermKey) return -1
      if (kb === activeTermKey) return 1
      if (ka === '__no_term__') return 1
      if (kb === '__no_term__') return -1
      const [ayA, semA] = ka.split('||')
      const [ayB, semB] = kb.split('||')
      if (ayA !== ayB) return ayB.localeCompare(ayA)
      return semRank(semB) - semRank(semA)
    })
  }

  const filtered = schedules.filter(matches)
  const termKeys = sortTermKeys([...new Set(filtered.map(termKey))])

  return (
    <div className="ap-card ap-fadein">
      <div className="aq-head" style={{ borderRadius: 0, flexWrap: 'wrap' }}>
        <div style={{ minWidth: 0 }}>
          <div className="aq-head-title">Submitted Schedules</div>
          <div className="aq-head-sub">{pending.length} pending review{approved.length ? ` · ${approved.length} approved` : ''}</div>
        </div>
        {schedules.length > 3 && (
          <input value={search} onChange={e => setSearch(e.target.value)} placeholder="Search schedules…" className="cp-inp" style={{ width: 190, padding: '6px 11px', fontSize: 12 }} />
        )}
      </div>

      {activePending.length > 0 && (
        <div style={{ padding: '9px 20px', borderBottom: `1px solid ${G.border}`, display: 'flex', alignItems: 'center', gap: 12, background: selected.size ? G.meadowSoft : G.bg }}>
          <label style={{ display: 'flex', alignItems: 'center', gap: 7, fontSize: 11.5, fontWeight: 600, color: G.muted, cursor: 'pointer' }}>
            <input type="checkbox" checked={selected.size === activePending.length} onChange={toggleSelectAll} style={{ width: 14, height: 14, accentColor: G.meadow, cursor: 'pointer' }} />
            {selected.size > 0 ? `${selected.size} selected` : 'Select all pending'}
          </label>
          {selected.size > 0 && (
            <button className="btn-primary" style={{ padding: '5px 13px', fontSize: 11.5 }} onClick={runBulkApprove} disabled={bulkBusy}>
              {bulkBusy ? 'Approving…' : `Approve ${selected.size} selected`}
            </button>
          )}
        </div>
      )}

      {schedules.length === 0 ? (
        <EmptyState icon={ICONS.inbox} text="No submitted schedules yet. Coordinators will appear here once they submit." />
      ) : pending.length === 0 && approved.length === 0 ? (
        <EmptyState icon={ICONS.inbox} text={`No schedules match "${search}".`} />
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 24, padding: '24px' }}>
          {/* ACTIVE QUEUE TERM */}
          {activeTermKey && termKeys.includes(activeTermKey) && (
            <div style={{ border: `1.5px solid ${G.meadowBorder}`, borderRadius: 12, overflow: 'hidden' }}>
              <div style={{ padding: '12px 20px', background: G.meadowSoft, display: 'flex', alignItems: 'center', gap: 10, borderBottom: `1px solid ${G.meadowBorder}` }}>
                <span style={{ fontSize: 13, fontWeight: 800, color: 'var(--meadow-deep)', textTransform: 'uppercase', letterSpacing: 0.5 }}>
                  Active Queue: {termLabel(activeTermKey)}
                </span>
              </div>
              
              {(() => {
                const termRows = filtered.filter(s => termKey(s) === activeTermKey)
                const tPending = termRows.filter(s => s.status === 'submitted').sort((a, b) => new Date(a.submittedAt || 0) - new Date(b.submittedAt || 0))
                const tApproved = termRows.filter(s => s.status === 'approved').sort((a, b) => new Date(b.approvedAt || b.submittedAt || 0) - new Date(a.approvedAt || a.submittedAt || 0))
                return (
                  <div style={{ background: G.bg }}>
                    {tPending.length > 0 && (
                      <div>
                        <div style={{ padding: '8px 20px 4px', fontSize: 10, fontWeight: 700, color: G.muted2, letterSpacing: 0.5, textTransform: 'uppercase' }}>Pending Review</div>
                        {tPending.map(s => <ScheduleRow key={s.id || s.scheduleId} s={s} />)}
                      </div>
                    )}
                    {tApproved.length > 0 && (
                      <div>
                        <div style={{ padding: '8px 20px 4px', fontSize: 10, fontWeight: 700, color: G.muted2, letterSpacing: 0.5, textTransform: 'uppercase', borderTop: tPending.length > 0 ? `1px solid ${G.border}` : 'none' }}>Approved</div>
                        {tApproved.map(s => <ScheduleRow key={s.id || s.scheduleId} s={s} />)}
                      </div>
                    )}
                    {tPending.length === 0 && tApproved.length === 0 && (
                      <div style={{ padding: '24px', textAlign: 'center', fontSize: 13, color: G.muted }}>No submissions yet for the active term.</div>
                    )}
                  </div>
                )
              })()}
            </div>
          )}

          {/* PAST TERMS */}
          {termKeys.filter(tk => tk !== activeTermKey).length > 0 && (
            <div>
              <div style={{ fontSize: 14, fontWeight: 800, color: G.ink, padding: '0 4px 12px', borderBottom: `2px solid ${G.border}` }}>
                Past Submissions
              </div>
              <div style={{ display: 'flex', flexDirection: 'column' }}>
                {termKeys.filter(tk => tk !== activeTermKey).map((tk, idx) => {
                  const termRows = filtered.filter(s => termKey(s) === tk)
                  const tPending = termRows.filter(s => s.status === 'submitted').sort((a, b) => new Date(a.submittedAt || 0) - new Date(b.submittedAt || 0))
                  const tApproved = termRows.filter(s => s.status === 'approved').sort((a, b) => new Date(b.approvedAt || b.submittedAt || 0) - new Date(a.approvedAt || a.submittedAt || 0))

                  return (
                    <div key={tk} style={{ borderBottom: `1px solid ${G.border}`, paddingBottom: 8 }}>
                      <div style={{ padding: '16px 4px 8px', display: 'flex', alignItems: 'center', gap: 8 }}>
                        <span style={{ fontSize: 12, fontWeight: 700, color: G.muted, textTransform: 'uppercase', letterSpacing: 0.5 }}>
                          {termLabel(tk)}
                        </span>
                      </div>
                      
                      <div style={{ border: `1px solid ${G.border}`, borderRadius: 10, overflow: 'hidden', background: G.bg }}>
                        {tPending.length > 0 && (
                          <div>
                            <div style={{ padding: '8px 20px 4px', fontSize: 10, fontWeight: 700, color: G.muted2, letterSpacing: 0.5, textTransform: 'uppercase' }}>Pending Review</div>
                            {tPending.map(s => <ScheduleRow key={s.id || s.scheduleId} s={s} />)}
                          </div>
                        )}
                        {tApproved.length > 0 && (
                          <div>
                            <div style={{ padding: '8px 20px 4px', fontSize: 10, fontWeight: 700, color: G.muted2, letterSpacing: 0.5, textTransform: 'uppercase', borderTop: tPending.length > 0 ? `1px solid ${G.border}` : 'none' }}>Approved</div>
                            {tApproved.map(s => <ScheduleRow key={s.id || s.scheduleId} s={s} />)}
                          </div>
                        )}
                      </div>
                    </div>
                  )
                })}
              </div>
            </div>
          )}
        </div>
      )}

      {rejectTarget && (
        <RejectModal schedule={rejectTarget} onClose={() => setRejectTarget(null)}
          onReject={async (id, fb) => { await onReject(id, fb); setRejectTarget(null) }} />
      )}

      {unapproveTarget && createPortal(
        <div style={{ position: 'fixed', inset: 0, zIndex: 11000, background: 'rgba(10,30,18,0.55)', backdropFilter: 'blur(4px)', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 24 }} onClick={() => setUnapproveTarget(null)}>
          <div style={{ background: 'var(--surface)', borderRadius: 18, padding: '28px 28px 24px', maxWidth: 400, width: '100%', boxShadow: '0 20px 60px rgba(10,30,18,0.22)' }} onClick={e => e.stopPropagation()}>
            <div style={{ width: 52, height: 52, borderRadius: '50%', background: 'rgba(245, 158, 11, 0.1)', margin: '0 auto 16px', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
              <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="#F59E0B" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><path d="M10.29 3.86L1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z"/><line x1="12" y1="9" x2="12" y2="13"/><line x1="12" y1="17" x2="12.01" y2="17"/></svg>
            </div>
            <div style={{ fontSize: 16, fontWeight: 700, color: 'var(--ink)', marginBottom: 8, fontFamily: 'Inter,sans-serif', textAlign: 'center' }}>Unapprove Schedule?</div>
            <div style={{ fontSize: 13, color: 'var(--muted)', marginBottom: 16, lineHeight: 1.5, fontFamily: 'Inter,sans-serif', textAlign: 'center' }}>
              This will remove the schedule from the master list and return it to a "Draft" state so the coordinator can edit it.
            </div>
            <div style={{ marginBottom: 20 }}>
              <label style={{ display: 'block', fontSize: 12, fontWeight: 600, color: 'var(--ink)', marginBottom: 6 }}>Reason / Note for Coordinator:</label>
              <textarea 
                id="unapprove-feedback-tab"
                placeholder="e.g. Please fix the overlap in Room 402 before I can finalize this."
                style={{ width: '100%', minHeight: 80, padding: 12, borderRadius: 8, border: '1px solid var(--border)', fontSize: 13, fontFamily: 'inherit', resize: 'vertical' }}
              />
            </div>
            <div style={{ display: 'flex', gap: 10 }}>
              <button onClick={() => setUnapproveTarget(null)} style={{ flex: 1, padding: '10px', borderRadius: 9, border: `1.5px solid var(--border)`, background: 'var(--surface)', fontSize: 13, fontWeight: 600, color: 'var(--muted)', cursor: 'pointer', fontFamily: 'Inter,sans-serif' }}>
                Cancel
              </button>
              <button disabled={loadingIds?.has('unapprove-busy')} onClick={async () => {
                const fb = document.getElementById('unapprove-feedback-tab')?.value || 'Schedule unapproved by admin.'
                // Simulate loadingIds locally since we can't easily modify the parent's Set without a dedicated function,
                // but wait, onUnapprove is passed. If we just await it, we can disable it manually or rely on the parent.
                // Actually, the parent handleUnapprove DOES NOT set `approvingIds`. So we must disable it by storing a local state,
                // or just relying on `onUnapprove` resolving!
                const btn = document.getElementById('unapprove-btn-tab')
                if (btn) { btn.disabled = true; btn.textContent = 'Unapproving...' }
                try {
                  await onUnapprove(unapproveTarget.id || unapproveTarget.scheduleId, fb)
                  setUnapproveTarget(null)
                } finally {
                  if (btn) { btn.disabled = false; btn.textContent = 'Unapprove' }
                }
              }} id="unapprove-btn-tab" style={{ flex: 1, padding: '10px', borderRadius: 9, border: 'none', background: '#F59E0B', fontSize: 13, fontWeight: 700, color: '#fff', cursor: 'pointer', fontFamily: 'Inter,sans-serif' }}>
                Unapprove
              </button>
            </div>
          </div>
        </div>,
        document.body
      )}
    </div>
  )
}

export default SubmissionsTab
