import { useState, useEffect, useCallback, useMemo, useRef } from 'react'
import { createPortal } from 'react-dom'
import {
  listQueues, createQueue, advanceQueue, finishQueue, deleteQueue,
  getSubmittedSchedules, getSubmittedSchedule, approveSchedule, rejectSchedule, unapproveSchedule,
  getMasterSchedule, finalizeMasterSchedule, unfinalizeMasterSchedule, getCourses, adminEditSchedule, adminEditMasterSchedule
} from '../../services/api'
import ScheduleViewPage from './ScheduleViewPage'
import { ProgramLegend } from '../../components/ScheduleView/svPrimitives'
import { useTour } from '../../hooks/useTour.jsx'
import QueueAuditTrail from '../../components/QueueAuditTrail'
import G from '../../components/admin/ApprovalDashboard/tokens'
import { DEFAULT_PROGRAMS, POLL_MS } from '../../components/admin/ApprovalDashboard/constants'
import { useToast } from '../../components/admin/ApprovalDashboard/hooks'
import { Skel, ToastContainer } from '../../components/admin/ApprovalDashboard/primitives'
import CreateQueueModal from '../../components/admin/ApprovalDashboard/CreateQueueModal'
import RejectModal from '../../components/admin/ApprovalDashboard/RejectModal'
import QueueTab from '../../components/admin/ApprovalDashboard/QueueTab'
import SubmissionsTab from '../../components/admin/ApprovalDashboard/SubmissionsTab'
import MasterTab from '../../components/admin/ApprovalDashboard/MasterTab'
import ActivityTab from '../../components/admin/ApprovalDashboard/ActivityTab'

const TOUR_SEEN_KEY = 'adminApprovalDashboard_tourSeen'
function isOnboardingCompleted() {
  try { return localStorage.getItem(TOUR_SEEN_KEY) === '1' } catch { return true }
}
function markOnboardingCompleted() {
  try { localStorage.setItem(TOUR_SEEN_KEY, '1') } catch {}
}

/* ─────────────────────────── MAIN PAGE ─────────────────────────── */
export default function ApprovalDashboardPage() {
  const [queues, setQueues] = useState([])
  const [submitted, setSubmitted] = useState([])
  const [courses, setCourses] = useState([])
  const [loading, setLoading] = useState(true)
  const [refreshing, setRefreshing] = useState(false)
  const [lastUpdated, setLastUpdated] = useState(null)
  const [showCreate, setShowCreate] = useState(false)
  const [reviewId, setReviewId] = useState(null)
  // Confirmation targets for the Reject/Unapprove buttons that live inside
  // the full-screen review panel (adminActions below) — distinct from the
  // same-named state inside SubmissionsTab, which handles the row-level
  // buttons in the list view.
  const [rejectTarget, setRejectTarget] = useState(null)
  const [unapproveTarget, setUnapproveTarget] = useState(null)
  const [activeQueueId, setActiveQueueId] = useState(null)
  const [approvingIds, setApprovingIds] = useState(new Set())
  const [tab, setTab] = useState('submissions')
  const [master, setMaster] = useState(null)
  const { toasts, toast } = useToast()

  const { TourElement } = useTour('adminApprovalDashboard', [
    {
      target: '#tour-create-queue',
      title: 'Start with a Scheduling Queue',
      content: 'A queue decides which programs get to build their schedule first, and in what order. Create one here whenever a new semester or scheduling round begins — coordinators can\'t submit a draft until their program has a turn.',
      disableBeacon: true,
    },
    {
      target: '#tour-queue-tab',
      title: 'Queue Control',
      content: 'Track and manage turn order here. You can see which program is currently up, skip a program that isn\'t ready, advance the queue once a program finishes, reorder programs by dragging, or delete a queue entirely. The badge shows how many queues are active out of the total.',
    },
    {
      target: '#tour-submissions-tab',
      title: 'Reviewing submissions',
      content: 'Once a coordinator submits their draft, it lands here for your review. Open a submission to inspect it in detail, then approve it (which merges it into the Master Schedule) or reject it with feedback so the coordinator can revise and resubmit. The badge shows how many are waiting on you right now.',
    },
    {
      target: '#tour-master-tab',
      title: 'Master Schedule',
      content: 'This is every approved class from every program, layered together into one unified timetable. Once everything looks right, finalize it here to publish the official schedule out to faculty.',
    },
    {
      target: '#tour-activity-tab',
      title: 'Activity log',
      content: 'A running history of what happened and when — submissions, approvals, rejections, and queue changes — so you can trace back through the approval process if something needs double-checking.',
    },
  ])

  

  const loadAll = useCallback(async (silent = false) => {
    if (silent) setRefreshing(true); else setLoading(true)
    try {
      // Each call used to swallow its own error and fall back to `[]`,
      // which is why submitted schedules could go quietly missing with
      // zero indication anything was wrong — a 401/404/500 from
      // /approval/submitted looked identical to "no one has submitted
      // yet". Log the real failure so it's visible in devtools, and
      // surface a toast specifically for the submissions fetch since
      // that's the one that was reported as "not showing".
      const [q, s] = await Promise.all([
        listQueues().catch(e => { console.error('listQueues failed:', e); return [] }),
        getSubmittedSchedules().catch(e => {
          console.error('getSubmittedSchedules failed:', e)
          toast(e?.response?.status ? `Couldn't load submitted schedules (${e.response.status})` : "Couldn't load submitted schedules - check your connection", 'error')
          return []
        })
      ])
      const qArr = Array.isArray(q) ? q : (q?.queues ?? [])
      // Defensive: the backend has changed the wrapper key on other list
      // endpoints before (see `getSchedules` in api.js handling both
      // shapes). If /approval/submitted ever comes back wrapped under a
      // key other than `schedules` - `submitted`, `items`, `results` -
      // this used to silently resolve to [] with nothing in the console.
      const sArr = Array.isArray(s) ? s : (s?.schedules ?? s?.submitted ?? s?.items ?? s?.results ?? [])
      if (!Array.isArray(s) && s && typeof s === 'object' && sArr.length === 0 && Object.keys(s).length > 0) {
        console.warn('getSubmittedSchedules: unrecognized response shape, defaulted to empty list. Raw response:', s)
      }
      setQueues(qArr)
      setSubmitted(sArr)
      setActiveQueueId(prev => {
        if (prev) return prev
        const active = qArr.find(qq => qq.status === 'active') || qArr[0]
        return active ? (active.id || active.queueId) : null
      })
      setLastUpdated(new Date())
    } catch { if (!silent) toast('Failed to load data', 'error') }
    finally { setLoading(false); setRefreshing(false) }
  }, [toast])

  useEffect(() => { loadAll() }, [loadAll])

  // Fetch courses exactly once on mount, solely to compute the list of active programs
  useEffect(() => {
    getCourses()
      .then(c => {
        const cArr = Array.isArray(c) ? c : (c?.courses ?? [])
        setCourses(cArr)
      })
      .catch(e => console.error('getCourses failed:', e))
  }, [])

  // Paused while a modal is open, and now also paused whenever the tab is
  // hidden — an admin who leaves this dashboard open in the background all
  // day was otherwise polling forever for a screen nobody was looking at.
  useEffect(() => {
    if (showCreate || reviewId) return
    let id = null
    function start() { if (!id) id = setInterval(() => loadAll(true), POLL_MS) }
    function stop() { if (id) { clearInterval(id); id = null } }
    function onVisibility() { if (document.hidden) stop(); else { start(); loadAll(true) } }
    if (!document.hidden) start()
    document.addEventListener('visibilitychange', onVisibility)
    return () => { stop(); document.removeEventListener('visibilitychange', onVisibility) }
  }, [loadAll, showCreate, reviewId])

  // Master schedule events, kept at page level so the review panel can run
  // conflict checks without an extra fetch of its own.
  //
  // IMPORTANT: this used to depend on `submitted`, which gets a brand-new
  // array reference from every loadAll() call — including the silent
  // background poll — even when nothing in it actually changed. Since
  // GET /approval/master/{id} reads every event in the master schedule's
  // subcollection (one Firestore read per session, easily hundreds), that
  // was re-reading the entire master schedule on every single poll tick
  // regardless of whether an approval had happened. The master schedule
  // only ever changes as a *result* of an approve/reject action, so those
  // handlers now call refreshMaster() explicitly instead — this effect
  // only fires when the admin switches which queue they're looking at.
  const refreshMaster = useCallback((queueId) => {
    if (!queueId) { setMaster(null); return }
    getMasterSchedule(queueId).then(setMaster).catch(() => setMaster(null))
  }, [])

  useEffect(() => {
    refreshMaster(activeQueueId)
  }, [activeQueueId, refreshMaster])

  const programs = useMemo(() => {
    const fromCourses = new Set(courses.map(c => c.program).filter(Boolean))
    if (fromCourses.size === 0) return DEFAULT_PROGRAMS
    
    // Sort such that DEFAULT_PROGRAMS are exactly in that order first, then anything else alphabetically
    const orderMap = {}
    DEFAULT_PROGRAMS.forEach((p, i) => orderMap[p] = i)
    
    return [...fromCourses].sort((a, b) => {
      const idxA = orderMap[a] ?? 999
      const idxB = orderMap[b] ?? 999
      if (idxA !== idxB) return idxA - idxB
      return a.localeCompare(b)
    })
  }, [courses])

  const pendingList = useMemo(
    () => submitted.filter(s => s.status === 'submitted').sort((a, b) => new Date(a.submittedAt || 0) - new Date(b.submittedAt || 0)),
    [submitted]
  )

  /* ── Queue handlers ── */
  async function handleCreate(data) {
    const newQueue = await createQueue(data)
    toast('Queue created!', 'success')
    loadAll(true)
    setTab('queue')
    setActiveQueueId(newQueue.queueId)
  }
  async function handleAdvance(qId) {
    try { await advanceQueue(qId); toast('Queue advanced', 'success'); loadAll(true) }
    catch (e) { toast(e?.response?.data?.detail || 'Advance failed', 'error') }
  }
  async function handleFinish(qId) {
    try { await finishQueue(qId); toast('Queue finished', 'success'); loadAll(true) }
    catch (e) { toast(e?.response?.data?.detail || 'Finish failed', 'error') }
  }
  async function handleDeleteQueue(qId) {
    try { await deleteQueue(qId); toast('Queue deleted', 'info'); setActiveQueueId(null); loadAll() }
    catch (e) { toast(e?.response?.data?.detail || 'Delete failed', 'error') }
  }

  /* ── Approval handlers ── */
  async function handleUnapprove(id, feedback) {
    try {
      await unapproveSchedule(id, feedback)
      toast('Schedule unapproved and returned to draft status.', 'success')
      setReviewId(prev => prev === id ? null : prev)
      loadAll(true)
      refreshMaster(activeQueueId)
    } catch (e) { toast(e?.response?.data?.detail || 'Unapprove failed', 'error') }
  }

  async function handleApprove(id) {
    setApprovingIds(s => new Set(s).add(id))
    try {
      await approveSchedule(id)
      toast('Schedule approved and merged into master!', 'success')
      setReviewId(null)
      loadAll(true)
      refreshMaster(activeQueueId)
    } catch (e) { toast(e?.response?.data?.detail || 'Approval failed', 'error') }
    finally { setApprovingIds(s => { const n = new Set(s); n.delete(id); return n }) }
  }
  async function handleBulkApprove(ids) {
    let ok = 0, fail = 0
    setApprovingIds(s => new Set([...s, ...ids]))
    for (const id of ids) {
      try { await approveSchedule(id); ok++ } catch { fail++ }
    }
    setApprovingIds(s => { const n = new Set(s); ids.forEach(id => n.delete(id)); return n })
    toast(fail ? `Approved ${ok}, ${fail} failed` : `Approved ${ok} schedule${ok === 1 ? '' : 's'}`, fail ? 'error' : 'success')
    loadAll(true)
    if (ok > 0) refreshMaster(activeQueueId)
  }
  async function handleReject(id, feedback) {
    try {
      await rejectSchedule(id, { feedback })
      toast('Feedback sent — schedule returned to draft', 'info')
      setReviewId(null)
      loadAll(true)
      // Rejection doesn't touch the master schedule, so no refreshMaster() call.
    } catch (e) { toast(e?.response?.data?.detail || 'Reject failed', 'error') }
  }
  async function handleFinalize(qId) {
    try {
      await finalizeMasterSchedule(qId)
      toast('Master schedule published to faculty!', 'success')
      loadAll()
      refreshMaster(qId)
    }
    catch (e) { toast(e?.response?.data?.detail || 'Finalize failed', 'error') }
  }
  async function handleUnpublish(qId) {
    try {
      await unfinalizeMasterSchedule(qId)
      toast('Master schedule unpublished. Queue reopened.', 'info')
      loadAll()
      refreshMaster(qId)
    } catch (e) { toast(e?.response?.data?.detail || 'Unpublish failed', 'error') }
  }
  function navigateReview(delta) {
    const idx = pendingList.findIndex(s => (s.id || s.scheduleId) === reviewId)
    const next = pendingList[idx + delta]
    if (next) setReviewId(next.id || next.scheduleId)
  }

  /* ── Stats ── */
  const pendingCount = submitted.filter(s => s.status === 'submitted').length
  const approvedCount = submitted.filter(s => s.status === 'approved').length
  const queueCount = queues.length
  const activeCount = queues.filter(q => q.status === 'active').length

  const TABS = [
    { id: 'submissions', label: 'Submissions', badge: pendingCount ? `${pendingCount}` : null },
    { id: 'queue', label: 'Queue Control', badge: queueCount ? `${activeCount}/${queueCount}` : null },
    { id: 'master', label: 'Master Schedule', badge: approvedCount ? `${approvedCount}` : null },
    { id: 'activity', label: 'Activity' },
  ]

  return (
    <div className="ap-root" style={{ padding: '20px 28px 60px', display: 'flex', flexDirection: 'column', gap: 16, minHeight: '100%' }}>
      {TourElement}

      {/* Tabs + toolbar, one row */}
      {loading ? (
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 12, flexWrap: 'wrap' }}>
          <div style={{ display: 'flex', gap: 6 }}>
            {[72, 96, 108, 70].map((w, i) => <Skel key={i} w={w} h={32} r={9} />)}
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
            <Skel w={32} h={32} r={8} />
            <Skel w={104} h={32} r={8} />
          </div>
        </div>
      ) : (
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 12, flexWrap: 'wrap' }}>
          <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
            {TABS.map(t => (
              <button key={t.id} id={`tour-${t.id}-tab`} className={`ap-tab${tab === t.id ? ' active' : ''}`} onClick={() => setTab(t.id)}>
                {t.label}
                {t.badge && <span className="ap-tab-count">{t.badge}</span>}
              </button>
            ))}
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: 10, flexShrink: 0 }}>
            {lastUpdated && <span style={{ fontSize: 11, color: G.muted2, fontWeight: 500 }}>Updated {lastUpdated.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</span>}
            <button onClick={() => loadAll(true)} disabled={refreshing || loading} className="ap-icon-btn" title="Refresh">
              <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" className={refreshing ? 'ap-spin' : undefined}><polyline points="23 4 23 10 17 10"/><polyline points="1 20 1 14 7 14"/><path d="M3.51 9a9 9 0 0 1 14.85-3.36L23 10M1 14l4.64 4.36A9 9 0 0 0 20.49 15"/></svg>
            </button>
            <button id="tour-create-queue" onClick={() => setShowCreate(true)} className="btn-primary" style={{ padding: '9px 18px', fontSize: 12.5 }}>
              <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"><line x1="12" y1="5" x2="12" y2="19"/><line x1="5" y1="12" x2="19" y2="12"/></svg>
              New Queue
            </button>
          </div>
        </div>
      )}

      {loading ? (
        <div className="ap-card" style={{ overflow: 'hidden' }}>
          <div className="aq-head" style={{ borderRadius: 0, opacity: 0.55 }}>
            <div style={{ minWidth: 0, width: '100%' }}>
              <Skel w={170} h={14} style={{ background: 'rgba(255,255,255,0.35)' }} />
              <div style={{ height: 7 }} />
              <Skel w={220} h={10} style={{ background: 'rgba(255,255,255,0.22)' }} />
            </div>
          </div>
          <div style={{ padding: '20px' }}>
            <div style={{ display: 'flex', gap: 16, marginBottom: 18 }}>
              {[0, 1, 2, 3].map(i => (
                <div key={i} style={{ flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 8 }}>
                  <Skel w={30} h={30} r={99} />
                  <Skel w={50} h={9} />
                </div>
              ))}
            </div>
            <Skel h={1} style={{ margin: '4px 0 16px' }} />
            {[0, 1, 2].map(i => <div key={i} style={{ marginBottom: i < 2 ? 10 : 0 }}><Skel h={30} r={8} style={{ opacity: 1 - i * 0.18 }} /></div>)}
          </div>
        </div>
      ) : (
        <>
          {tab === 'submissions' && (
            <SubmissionsTab
              schedules={submitted}
              onOpen={setReviewId}
              onQuickApprove={handleApprove}
              onReject={handleReject}
              onUnapprove={handleUnapprove}
              onBulkApprove={handleBulkApprove}
              loadingIds={approvingIds}
              activeTermKey={
                (() => {
                  const active = queues.find(q => (q.id || q.queueId) === activeQueueId)
                  return active ? `${active.academicYear || '—'}||${active.semester || '—'}||${active.id || active.queueId}` : null
                })()
              }
              masterFinalized={master?.status === 'finalized'}
            />
          )}
          {tab === 'queue' && (
            <>
              <QueueTab
                queues={queues}
                activeQueueId={activeQueueId}
                setActiveQueueId={setActiveQueueId}
                onAdvance={handleAdvance}
                onFinish={handleFinish}
                onDelete={handleDeleteQueue}
                showToast={toast}
              />
              {activeQueueId && <QueueAuditTrail queueId={activeQueueId} />}
            </>
          )}
          {tab === 'master' && (
            <MasterTab queueId={activeQueueId} onFinalize={handleFinalize} onUnpublish={handleUnpublish} programs={programs} onMasterSaved={() => refreshMaster(activeQueueId)} />
          )}
          {tab === 'activity' && <ActivityTab schedules={submitted} />}
        </>
      )}

      {/* Modals / overlays */}
      {showCreate && <CreateQueueModal onClose={() => setShowCreate(false)} onCreate={handleCreate} programs={programs} />}
      {reviewId && (() => {
        const reviewSchedule = submitted.find(s => (s.id || s.scheduleId) === reviewId)
        const isPending = reviewSchedule?.status === 'submitted'
        const isApproved = reviewSchedule?.status === 'approved'
        // Once approved, a program's events live in the master schedule's
        // own collection — admin edits from the Master Schedule tab land
        // there, not back on the original submission doc. Hand Review
        // that program's slice of the current master so it reflects any
        // edits instead of the frozen submitted-at-the-time copy.
        const masterProgramEvents = isApproved && reviewSchedule?.programCode
          ? (master?.schedule || []).filter(e => e.program === reviewSchedule.programCode)
          : null

        return createPortal(
          <div style={{ position: 'fixed', inset: 0, zIndex: 9999, background: 'var(--bg)', display: 'flex', flexDirection: 'column' }}>
            <ScheduleViewPage 
              isSubmittedView={true}
              embeddedId={reviewId} 
              onClose={() => setReviewId(null)}
              masterEvents={master?.schedule || []}
              masterTerm={master ? { academicYear: master.academicYear, semester: master.semester } : null}
              masterProgramEvents={masterProgramEvents}
              onSaveOverride={async (events) => {
                await adminEditSchedule(reviewId, { schedule: events })
                loadAll(true)
              }}
              adminActions={
                <>
                  {isPending && (
                    <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
                      <button onClick={() => handleApprove(reviewId)} disabled={approvingIds.has(reviewId) || master?.status === 'finalized'} title={master?.status === 'finalized' ? 'Cannot approve while master schedule is published' : ''} style={{ padding: '6px 14px', fontSize: 11.5, background: 'var(--meadow)', color: '#fff', border: 'none', borderRadius: 8, display: 'inline-flex', alignItems: 'center', gap: 6, fontWeight: 600, opacity: (approvingIds.has(reviewId) || master?.status === 'finalized') ? 0.4 : 1, cursor: (approvingIds.has(reviewId) || master?.status === 'finalized') ? 'not-allowed' : 'pointer' }}>
                        {approvingIds.has(reviewId) ? <svg className="ap-spin" width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"><path d="M21 12a9 9 0 1 1-6.22-8.56"/></svg> : <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"><polyline points="20 6 9 17 4 12"/></svg>}
                        Approve
                      </button>
                      <button onClick={() => setRejectTarget(reviewSchedule)} disabled={approvingIds.has(reviewId) || master?.status === 'finalized'} title={master?.status === 'finalized' ? 'Cannot reject while master schedule is published' : ''} style={{ padding: '6px 14px', fontSize: 11.5, background: '#EF4444', color: '#fff', border: 'none', borderRadius: 8, display: 'inline-flex', alignItems: 'center', gap: 6, fontWeight: 600, opacity: (approvingIds.has(reviewId) || master?.status === 'finalized') ? 0.4 : 1, cursor: (approvingIds.has(reviewId) || master?.status === 'finalized') ? 'not-allowed' : 'pointer' }}>
                        <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg>
                        Reject...
                      </button>
                    </div>
                  )}
                  {isApproved && (
                    <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
                      <button onClick={() => setUnapproveTarget(reviewSchedule)} disabled={master?.status === 'finalized'} title={master?.status === 'finalized' ? 'Cannot unapprove while master schedule is published' : ''} style={{ padding: '6px 14px', fontSize: 11.5, border: '1.5px solid #F59E0B', background: 'rgba(245, 158, 11, 0.1)', color: '#F59E0B', borderRadius: 8, display: 'inline-flex', alignItems: 'center', gap: 6, fontWeight: 600, opacity: master?.status === 'finalized' ? 0.4 : 1, cursor: master?.status === 'finalized' ? 'not-allowed' : 'pointer' }}>
                        <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"><path d="M10.29 3.86L1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z"/><line x1="12" y1="9" x2="12" y2="13"/><line x1="12" y1="17" x2="12.01" y2="17"/></svg>
                        Unapprove
                      </button>
                    </div>
                  )}
                </>
              }
            />
          </div>,
          document.body
        )
      })()}

      {rejectTarget && (
        <RejectModal schedule={rejectTarget} onClose={() => setRejectTarget(null)}
          onReject={async (id, fb) => { await handleReject(id, fb); setRejectTarget(null) }}
          zIndex={10000} />
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
                id="unapprove-feedback"
                placeholder="e.g. Please fix the overlap in Room 402 before I can finalize this."
                style={{ width: '100%', minHeight: 80, padding: 12, borderRadius: 8, border: '1px solid var(--border)', fontSize: 13, fontFamily: 'inherit', resize: 'vertical' }}
              />
            </div>
            <div style={{ display: 'flex', gap: 10 }}>
              <button onClick={() => setUnapproveTarget(null)} style={{ flex: 1, padding: '10px', borderRadius: 9, border: `1.5px solid var(--border)`, background: 'var(--surface)', fontSize: 13, fontWeight: 600, color: 'var(--muted)', cursor: 'pointer', fontFamily: 'Inter,sans-serif' }}>
                Cancel
              </button>
              <button disabled={approvingIds.has('unapprove-busy')} onClick={async () => {
                setApprovingIds(s => new Set(s).add('unapprove-busy'))
                try {
                  const fb = document.getElementById('unapprove-feedback')?.value || 'Schedule unapproved by admin.'
                  await handleUnapprove(unapproveTarget.id || unapproveTarget.scheduleId, fb)
                  setUnapproveTarget(null)
                } finally {
                  setApprovingIds(s => { const n = new Set(s); n.delete('unapprove-busy'); return n })
                }
              }} style={{ flex: 1, padding: '10px', borderRadius: 9, border: 'none', background: '#F59E0B', fontSize: 13, fontWeight: 700, color: '#fff', cursor: 'pointer', fontFamily: 'Inter,sans-serif', opacity: approvingIds.has('unapprove-busy') ? 0.6 : 1 }}>
                {approvingIds.has('unapprove-busy') ? 'Unapproving...' : 'Unapprove'}
              </button>
            </div>
          </div>
        </div>,
        document.body
      )}

      <ToastContainer toasts={toasts} />
    </div>
  )
}