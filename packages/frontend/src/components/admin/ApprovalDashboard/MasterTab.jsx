import { useState, useEffect } from 'react'
import { createPortal } from 'react-dom'
import G from './tokens'
import { getMasterSchedule, adminEditMasterSchedule } from '../../../services/api'
import ScheduleViewPage from '../../../pages/admin/ScheduleViewPage'
import TimeGrid from '../../ScheduleView/TimeGrid'
import { getProgColor } from './utils'
import { Badge, Skel, EmptyState, ICONS } from './primitives'

function MasterTab({ queueId, onFinalize, programs, onMasterSaved }) {
  const [master, setMaster] = useState(null)
  const [loading, setLoading] = useState(false)
  const [expanded, setExpanded] = useState(true)
  const [filter, setFilter] = useState('All')
  const [acting, setActing] = useState(false)
  const [reviewViewMode, setReviewViewMode] = useState('grid')
  const [activeDay, setActiveDay] = useState('Monday')
  const [showFinalizeConfirm, setShowFinalizeConfirm] = useState(false)
  const [fixMode, setFixMode] = useState(false)

  useEffect(() => {
    if (!queueId) return
    setLoading(true)
    getMasterSchedule(queueId).then(setMaster).catch(() => setMaster(null)).finally(() => setLoading(false))
  }, [queueId])

  async function handleFinalize() {
    setActing(true)
    try { await onFinalize(queueId) } finally { setActing(false); setShowFinalizeConfirm(false) }
  }

  if (!queueId) return <div className="ap-card ap-fadein"><EmptyState icon={ICONS.calendar} text="Create a coordinator queue first — the master schedule builds up as programs get approved." /></div>

  const events = master?.schedule || []
  const approved = master?.approvedPrograms || []
  const isFinalized = master?.status === 'finalized'
  const progList = ['All', ...new Set(events.map(e => e.program).filter(Boolean))]
  const visible = filter === 'All' ? events : events.filter(e => e.program === filter)

  return (
    <div className="ap-card ap-fadein">
      <div className="aq-head" style={{ borderRadius: 0, flexWrap: 'wrap' }}>
        <div style={{ minWidth: 0 }}>
          <div className="aq-head-title">Master Schedule</div>
          <div className="aq-head-sub">{approved.length} program(s) merged · {events.length} total events</div>
        </div>
        <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
          {isFinalized
            ? <Badge label="Published to Faculty" bg="rgba(255,255,255,0.18)" color="#fff" border="rgba(255,255,255,0.4)" />
            : approved.length > 0 && (
              <button onClick={() => setShowFinalizeConfirm(true)} disabled={acting} className="btn-blue">
                {acting
                  ? <><svg className="ap-spin" width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"><path d="M21 12a9 9 0 1 1-6.22-8.56"/></svg> Finalizing…</>
                  : <><svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"><polyline points="22 12 18 12 15 21 9 3 6 12 2 12"/></svg> Finalize & Publish</>}
              </button>
            )}
          {events.length > 0 && (
            <button onClick={() => setFixMode(true)} className="btn-outline" style={{ background: 'rgba(255,255,255,0.14)', borderColor: 'rgba(255,255,255,0.4)', color: '#fff' }}>
              <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"><path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"/><path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"/></svg> Edit
            </button>
          )}
          {events.length > 0 && (
            <button onClick={() => setExpanded(v => !v)} className="btn-outline" style={{ background: 'rgba(255,255,255,0.14)', borderColor: 'rgba(255,255,255,0.4)', color: '#fff' }}>
              {expanded
                ? <><svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"><polyline points="18 15 12 9 6 15"/></svg> Collapse</>
                : <><svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"><polyline points="6 9 12 15 18 9"/></svg> View Events</>}
            </button>
          )}
        </div>
      </div>

      {loading ? (
        <div style={{ padding: '24px 20px', display: 'flex', flexDirection: 'column', gap: 10 }}>{[...Array(3)].map((_, i) => <Skel key={i} h={14} style={{ opacity: 1 - i * 0.25 }} />)}</div>
      ) : !master ? (
        <EmptyState icon={ICONS.calendar} text="No master schedule yet. Approve coordinator schedules to start building it." />
      ) : (
        <>
          <div style={{ padding: '14px 20px', display: 'flex', flexWrap: 'wrap', gap: 8, borderBottom: expanded ? `1px solid ${G.border}` : 'none' }}>
            {programs.map(prog => {
              const done = approved.includes(prog)
              const c = getProgColor(prog)
              return (
                <div key={prog} style={{ display: 'flex', alignItems: 'center', gap: 6, padding: '5px 12px', borderRadius: 99, background: done ? `${c}14` : '#F1F5F9', border: `1px solid ${done ? `${c}40` : '#E2E8F0'}` }}>
                  <div style={{ width: 7, height: 7, borderRadius: 99, background: done ? c : '#CBD5E1', flexShrink: 0 }} />
                  <span style={{ fontSize: 11.5, fontWeight: 700, color: done ? c : '#94A3B8' }}>{prog}</span>
                  {done && <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke={c} strokeWidth="3"><polyline points="20 6 9 17 4 12"/></svg>}
                </div>
              )
            })}
          </div>

          {expanded && events.length > 0 && (
            <>
              <div style={{ padding: '10px 20px', background: G.bg, borderBottom: `1px solid ${G.border}`, display: 'flex', alignItems: 'center', gap: 6, flexWrap: 'wrap' }}>
                <span style={{ fontSize: 11, fontWeight: 600, color: G.muted, marginRight: 4 }}>Filter:</span>
                {progList.map(p => (
                  <button key={p} onClick={() => setFilter(p)} className={`r-tab${filter === p ? ' active' : ''}`}>
                    {p}{p !== 'All' && <span style={{ marginLeft: 5, opacity: 0.7, fontWeight: 400 }}>({events.filter(e => e.program === p).length})</span>}
                  </button>
                ))}
                
                <div style={{ flex: 1 }} />
                <div style={{ display: 'flex', background: G.borderLight, borderRadius: 8, padding: 4 }}>
                  <button onClick={() => setReviewViewMode('grid')}
                    style={{ padding: '4px 10px', fontSize: 11, fontWeight: 600, borderRadius: 6, cursor: 'pointer', border: 'none', background: reviewViewMode === 'grid' ? 'var(--surface)' : 'transparent', color: reviewViewMode === 'grid' ? G.ink : G.muted2, boxShadow: reviewViewMode === 'grid' ? '0 1px 3px rgba(0,0,0,0.1)' : 'none' }}>
                    Grid
                  </button>
                  <button onClick={() => setReviewViewMode('table')}
                    style={{ padding: '4px 10px', fontSize: 11, fontWeight: 600, borderRadius: 6, cursor: 'pointer', border: 'none', background: reviewViewMode === 'table' ? 'var(--surface)' : 'transparent', color: reviewViewMode === 'table' ? G.ink : G.muted2, boxShadow: reviewViewMode === 'table' ? '0 1px 3px rgba(0,0,0,0.1)' : 'none' }}>
                    List
                  </button>
                </div>
              </div>
              <div style={{ maxHeight: reviewViewMode === 'grid' ? 500 : 380, overflowY: 'auto' }}>
                {reviewViewMode === 'table' ? (
                  <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 12.5 }}>
                    <thead style={{ position: 'sticky', top: 0, zIndex: 1 }}>
                      <tr style={{ background: G.bg }}>
                        {['Program', 'Course', 'Section', 'Day', 'Period', 'Room', 'Faculty'].map(h => (
                          <th key={h} style={{ padding: '9px 14px', textAlign: 'left', fontSize: 10.5, fontWeight: 700, color: G.muted, letterSpacing: 0.4, textTransform: 'uppercase', borderBottom: `1px solid ${G.border}`, whiteSpace: 'nowrap' }}>{h}</th>
                        ))}
                      </tr>
                    </thead>
                    <tbody>
                      {visible.map((ev, i) => {
                        const c = getProgColor(ev.program)
                        return (
                          <tr key={i} className="ap-row">
                            <td style={{ padding: '8px 14px' }}><span style={{ padding: '2px 8px', borderRadius: 6, background: `${c}14`, color: c, fontSize: 11, fontWeight: 700 }}>{ev.program}</span></td>
                            <td style={{ padding: '8px 14px', fontWeight: 600, color: G.ink }}>{ev.courseCode}</td>
                            <td style={{ padding: '8px 14px', color: G.ink }}>{ev.program}-{ev.year}{ev.block}</td>
                            <td style={{ padding: '8px 14px', color: G.ink }}>{ev.day}</td>
                            <td style={{ padding: '8px 14px', color: G.ink, whiteSpace: 'nowrap' }}>{ev.period}</td>
                            <td style={{ padding: '8px 14px', color: G.ink }}>{ev.room}</td>
                            <td style={{ padding: '8px 14px', color: G.muted }}>{ev.assigned_faculty || ev.faculty || 'TBA'}</td>
                          </tr>
                        )
                      })}
                    </tbody>
                  </table>
                ) : (
                  <div style={{ display: 'flex', flexDirection: 'column', height: '100%', minHeight: 450, padding: '12px 16px', background: 'var(--surface)' }}>
                    <div style={{ display: 'flex', gap: 6, marginBottom: 12, overflowX: 'auto', paddingBottom: 4 }}>
                      {['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'].map(d => (
                        <button key={d} onClick={() => setActiveDay(d)} 
                          style={{
                            padding: '5px 12px', borderRadius: 20, fontSize: 11, fontWeight: 600,
                            cursor: 'pointer', border: '1px solid var(--border)',
                            background: activeDay === d ? `linear-gradient(135deg, ${G.meadow}, ${G.meadowDeep})` : 'var(--surface)',
                            color: activeDay === d ? '#fff' : G.muted,
                            transition: 'all .15s', whiteSpace: 'nowrap',
                            boxShadow: activeDay === d ? '0 2px 8px rgba(0,0,0,.3)' : 'none'
                          }}>
                          {d}
                        </button>
                      ))}
                    </div>
                    <div style={{ flex: 1, minHeight: 400 }}>
                      <TimeGrid 
                        rooms={Array.from(new Set(visible.map(e => e.room))).sort()} 
                        dayEvents={visible.filter(e => e.day === activeDay)} 
                        conflictMap={new Map()}
                        locked={true} 
                        gridSize="normal" fullscreen={false}
                        ambientConflictIds={new Set()} ambientMergeIds={new Set()}
                        conflictingDragIds={new Set()} dragConflictBands={[]}
                        mergedIds={new Set()} allEvents={visible} availabilityMap={new Map()}
                      />
                    </div>
                  </div>
                )}
              </div>
            </>
          )}
        </>
      )}

      {showFinalizeConfirm && createPortal(
        <div style={{ position: 'fixed', inset: 0, zIndex: 1100, background: 'rgba(10,30,18,0.55)', backdropFilter: 'blur(4px)', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 24 }} onClick={() => !acting && setShowFinalizeConfirm(false)}>
          <div style={{ background: 'var(--surface)', borderRadius: 18, padding: '28px 28px 24px', maxWidth: 400, width: '100%', boxShadow: '0 20px 60px rgba(10,30,18,0.22)', textAlign: 'center' }} onClick={e => e.stopPropagation()}>
            <div style={{ width: 52, height: 52, borderRadius: '50%', background: G.blueSoft, margin: '0 auto 16px', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
              <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke={G.blue} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><polyline points="22 12 18 12 15 21 9 3 6 12 2 12"/></svg>
            </div>
            <div style={{ fontSize: 16, fontWeight: 700, color: G.ink, marginBottom: 8, fontFamily: 'Inter,sans-serif' }}>Finalize and Publish?</div>
            <div style={{ fontSize: 13, color: G.muted2, marginBottom: 24, lineHeight: 1.5, fontFamily: 'Inter,sans-serif' }}>
              Finalizing and publishing this schedule will also mark the current scheduling queue as complete. This cannot be undone.
            </div>
            <div style={{ display: 'flex', gap: 10 }}>
              <button onClick={() => setShowFinalizeConfirm(false)} disabled={acting} style={{ flex: 1, padding: '10px', borderRadius: 9, border: `1.5px solid ${G.border}`, background: 'var(--surface)', fontSize: 13, fontWeight: 600, color: G.muted, cursor: acting ? 'default' : 'pointer', fontFamily: 'Inter,sans-serif' }}>
                Cancel
              </button>
              <button onClick={handleFinalize} disabled={acting} style={{ flex: 1, padding: '10px', borderRadius: 9, border: 'none', background: G.blue, fontSize: 13, fontWeight: 700, color: '#fff', cursor: acting ? 'default' : 'pointer', fontFamily: 'Inter,sans-serif', opacity: acting ? 0.7 : 1 }}>
                {acting ? 'Publishing...' : 'Publish'}
              </button>
            </div>
          </div>
        </div>,
        document.body
      )}
      {fixMode && createPortal(
        <div style={{ position: 'fixed', inset: 0, zIndex: 9999, background: 'var(--bg)', display: 'flex', flexDirection: 'column' }}>
          <ScheduleViewPage 
            isSubmittedView={false}
            isMasterView={true}
            embeddedId={"master_" + queueId}
            onSaveOverride={async (updatedEvents) => {
              const payloadEvents = updatedEvents.map(e => ({
                ...e,
                schedule_id: (typeof e.schedule_id === 'string' && e.schedule_id.startsWith('master_')) 
                  ? e.schedule_id.replace('master_', '') 
                  : e.schedule_id,
                _isOtherProgram: undefined,
                _isMergedHead: undefined,
              }))
              
              await adminEditMasterSchedule(queueId, { schedule: payloadEvents })
              setMaster(prev => ({ ...prev, schedule: payloadEvents }))
              // MasterTab keeps its own local `master` state (updated above),
              // but ApprovalDashboardPage ALSO keeps a separate top-level
              // `master` state that's what actually gets fed into the
              // submission review panel as `masterEvents`. That top-level
              // copy only ever refetched when the active queue changed, so
              // editing+saving here never reached it — the review overlay
              // kept showing whatever was fetched before this edit. Tell
              // the parent to refresh its copy too.
              onMasterSaved?.()
            }}
            onClose={() => { setFixMode(false); onMasterSaved?.() }}
          />
        </div>,
        document.body
      )}
    </div>
  )
}

export default MasterTab
