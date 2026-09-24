import { useState, useEffect, useMemo, useRef } from 'react'
import { useNavigate } from 'react-router-dom'
import { createPortal } from 'react-dom'
import { getSchedules, saveSchedule, deleteSaved, finalizeSchedule, unfinalizeSchedule, renameAdminSchedule } from '../../services/api'
import { buildConflictMap } from '../../components/ScheduleView/svHelpers'
import { exportScheduleToExcel } from '../../utils/exportScheduleToExcel'
import { exportScheduleToPDF } from '../../utils/exportScheduleToPDF'
import { Toast, ModalOverlay } from '../../components/ScheduleView/svPrimitives'
import { DeleteScheduleModal } from '../../components/ScheduleView/FilterModals'
import { useTour } from '../../hooks/useTour.jsx'

const G = {
  meadow: 'var(--meadow, var(--meadow))', meadowDeep: 'var(--meadow-deep)', meadowMid: 'var(--meadow-mid)', meadowSoft: 'var(--meadow-soft)', meadowBorder: 'var(--meadow-border)',
  ink: 'var(--ink, #0E2A20)', inkMid: 'var(--ink, #1C3D2A)', muted: 'var(--muted, #4B7060)', muted2: 'var(--muted2, #6B8C7A)',
  border: 'var(--border)', borderLight: 'var(--hover)', bg: 'var(--bg, #F2F7F4)', hover: 'var(--hover)',
}

/* ── Page-scoped styles ────────────────────────────────────────────────────── */
if (!document.getElementById('sl-page-style')) {
  const s = document.createElement('style')
  s.id = 'sl-page-style'
  s.textContent = `
    @keyframes spin { to { transform: rotate(360deg); } }
    .sl-menu-item {
      display: flex; align-items: center; gap: 8px; width: 100%;
      padding: 9px 12px; border: none; background: transparent; cursor: pointer;
      font-family: 'Inter', sans-serif; font-size: 12.5px; font-weight: 600; text-align: left;
    }
    .sl-menu-item:hover { background: var(--hover); }
  `
  document.head.appendChild(s)
}

/* ── Export menu button — same choice of formats as the Schedule View page ──
   The menu is portaled to document.body and positioned from the button's
   own bounding rect. Both ScheduleCard and the list table wrap this button
   in a container with `overflow: hidden` (needed for their rounded
   corners) — a plain position:absolute dropdown would render but be
   invisible, clipped by that ancestor the instant it opened. Portaling
   escapes that clipping context entirely. */
function ExportMenuButton({ onExportExcel, onExportPdf, iconOnly, size = 26 }) {
  const [open, setOpen] = useState(false)
  const [menuPos, setMenuPos] = useState(null)
  const btnRef = useRef(null)
  const itemStyle = {
    display: 'flex', alignItems: 'center', gap: 8, width: '100%',
    padding: '9px 14px', fontSize: 12.5, fontWeight: 600, color: G.ink,
    background: 'transparent', border: 'none', cursor: 'pointer',
    fontFamily: 'Inter, sans-serif', textAlign: 'left',
  }

  const toggleOpen = (e) => {
    e.stopPropagation()
    if (!open && btnRef.current) {
      const r = btnRef.current.getBoundingClientRect()
      setMenuPos({ top: r.bottom + 6, right: window.innerWidth - r.right })
    }
    setOpen(o => !o)
  }

  // A fixed-position menu doesn't move with the page, so if the user
  // scrolls or resizes while it's open it'd end up floating away from the
  // button that opened it — just close it instead of trying to re-track.
  useEffect(() => {
    if (!open) return
    const close = () => setOpen(false)
    window.addEventListener('scroll', close, true)
    window.addEventListener('resize', close)
    return () => {
      window.removeEventListener('scroll', close, true)
      window.removeEventListener('resize', close)
    }
  }, [open])

  return (
    <div style={{ position: 'relative', flexShrink: 0 }}>
      <button
        ref={btnRef}
        onClick={toggleOpen}
        title="Export"
        style={iconOnly
          ? { width: size, height: size, padding: 0, border: `1px solid ${G.border}`, background: 'transparent', borderRadius: 6, display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer', color: G.muted }
          : { display: 'flex', alignItems: 'center', gap: 4, padding: '6px 0', background: 'var(--surface)', border: `1px solid ${G.border}`, color: G.ink, borderRadius: 6, fontWeight: 600, cursor: 'pointer', justifyContent: 'center', fontSize: 12, flex: 1 }}
      >
        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/><polyline points="7 10 12 15 17 10"/><line x1="12" y1="15" x2="12" y2="3"/></svg>
        {!iconOnly && 'Export'}
      </button>
      {open && menuPos && createPortal(
        <>
          <div onClick={(e) => { e.stopPropagation(); setOpen(false) }} style={{ position: 'fixed', inset: 0, zIndex: 99998 }} />
          <div style={{ position: 'fixed', top: menuPos.top, right: menuPos.right, zIndex: 99999, background: 'var(--surface)', border: `1px solid ${G.border}`, borderRadius: 10, boxShadow: '0 12px 32px rgba(0,0,0,.16)', minWidth: 180, overflow: 'hidden' }}>
            <button
              onClick={(e) => { e.stopPropagation(); setOpen(false); onExportExcel() }}
              className="sl-menu-item"
              style={{ ...itemStyle, borderBottom: `1px solid ${G.border}` }}
            >
              <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/><polyline points="7 10 12 15 17 10"/><line x1="12" y1="15" x2="12" y2="3"/></svg>
              Schedule (.xlsx)
            </button>
            <button
              onClick={(e) => { e.stopPropagation(); setOpen(false); onExportPdf() }}
              className="sl-menu-item"
              style={itemStyle}
            >
              <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/><polyline points="14 2 14 8 20 8"/><line x1="9" y1="15" x2="15" y2="15"/><line x1="9" y1="11" x2="15" y2="11"/></svg>
              Schedule (.pdf)
            </button>
          </div>
        </>,
        document.body
      )}
    </div>
  )
}

function RenameScheduleModal({ schedule, onConfirm, onCancel, renamingState, error }) {
  const [tempName, setTempName] = useState(schedule?.name || '')
  return (
    <ModalOverlay onClose={renamingState === 'working' ? null : onCancel}>
      <div style={{ background: 'var(--surface)', width: 400, borderRadius: 16, overflow: 'hidden', boxShadow: '0 20px 25px -5px rgba(0,0,0,0.1), 0 8px 10px -6px rgba(0,0,0,0.1)' }} onClick={e => e.stopPropagation()}>
        <div style={{ padding: '24px 24px 20px' }}>
          <h2 style={{ margin: '0 0 16px', fontSize: 18, color: G.ink, fontWeight: 700, fontFamily: 'Inter,sans-serif' }}>Rename Schedule</h2>
          <input
            autoFocus
            value={tempName}
            onChange={e => { setTempName(e.target.value) }}
            disabled={renamingState === 'working'}
            onKeyDown={e => { if (e.key === 'Enter' && tempName.trim() && tempName.trim() !== schedule?.name && renamingState !== 'working') onConfirm(tempName.trim()) }}
            style={{ width: '100%', boxSizing: 'border-box', fontSize: 15, padding: '10px 14px', borderRadius: 8, border: error ? `2px solid ${G.red}` : `2px solid ${G.meadow}`, outline: 'none', color: G.ink, fontWeight: 500, fontFamily: 'Inter,sans-serif' }}
          />
          {error && (
            <div style={{ marginTop: 10, fontSize: 13, color: G.red, display: 'flex', alignItems: 'center', gap: 6, fontWeight: 600 }}>
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><circle cx="12" cy="12" r="10"/><line x1="12" y1="8" x2="12" y2="12"/><line x1="12" y1="16" x2="12.01" y2="16"/></svg>
              {error}
            </div>
          )}
        </div>
        <div style={{ display: 'flex', gap: 12, padding: '16px 24px', background: G.hover, borderTop: `1px solid ${G.border}`, justifyContent: 'flex-end' }}>
          <button onClick={onCancel} disabled={renamingState === 'working'} style={{ padding: '8px 16px', borderRadius: 8, border: `1.5px solid ${G.border}`, background: 'var(--surface)', color: G.ink, fontSize: 13, fontWeight: 600, cursor: renamingState === 'working' ? 'default' : 'pointer', fontFamily: 'Inter,sans-serif' }}>Cancel</button>
          <button onClick={() => onConfirm(tempName.trim())} disabled={renamingState === 'working' || !tempName.trim() || tempName.trim() === schedule?.name} style={{ padding: '8px 16px', borderRadius: 8, border: 'none', background: G.meadow, color: '#fff', fontSize: 13, fontWeight: 600, cursor: renamingState === 'working' || !tempName.trim() || tempName.trim() === schedule?.name ? 'default' : 'pointer', fontFamily: 'Inter,sans-serif' }}>
            {renamingState === 'working' ? 'Saving...' : 'Save Name'}
          </button>
        </div>
      </div>
    </ModalOverlay>
  )
}

export default function ScheduleListPage() {
  const navigate = useNavigate()
  const [schedules, setSchedules] = useState([])
  const [loading, setLoading] = useState(true)
  const [search, setSearch] = useState('')
  const [filterAY, setFilterAY] = useState('')
  const [filterSem, setFilterSem] = useState('')
  const [filterStatus, setFilterStatus] = useState('')
  const [sortBy, setSortBy] = useState('newest')
  const [currentPage, setCurrentPage] = useState(1)
  const [viewMode, setViewMode] = useState('grid') // 'grid' | 'list'
  const itemsPerPage = 6

  useEffect(() => {
    getSchedules().then(res => {
      setSchedules(res.schedules || res || [])
      setLoading(false)
    }).catch(err => {
      console.error(err)
      setLoading(false)
    })
  }, [])

  const filtered = useMemo(() => {
    let result = schedules.filter(s => (s.name || '').toLowerCase().includes(search.toLowerCase()))
    
    if (filterAY) {
      result = result.filter(s => s.academic_year === filterAY || s.academicYear === filterAY)
    }
    if (filterSem) {
      result = result.filter(s => s.semester === filterSem)
    }
    if (filterStatus) {
      if (filterStatus === 'published') {
        result = result.filter(s => s.finalized)
      } else if (filterStatus === 'draft') {
        result = result.filter(s => !s.finalized)
      }
    }
    
    const viewHistory = JSON.parse(localStorage.getItem('scheduleViewHistory') || '{}')
    
    result.sort((a, b) => {
      const histA = viewHistory[a.id || a.name] || 0
      const histB = viewHistory[b.id || b.name] || 0
      const timeA = Math.max(histA, new Date(a.lastModified || a.savedAt || a.createdAt || 0).getTime())
      const timeB = Math.max(histB, new Date(b.lastModified || b.savedAt || b.createdAt || 0).getTime())
      return sortBy === 'oldest' ? timeA - timeB : timeB - timeA
    })
    
    return result
  }, [schedules, search, filterAY, filterSem, filterStatus, sortBy])

  useEffect(() => {
    setCurrentPage(1)
  }, [search, filterAY, filterSem, filterStatus, sortBy])

  const totalPages = Math.max(1, Math.ceil(filtered.length / itemsPerPage))
  const paginated = filtered.slice((currentPage - 1) * itemsPerPage, currentPage * itemsPerPage)

  const total = schedules.length
  const published = schedules.filter(s => s.finalized).length
  const drafts = total - published
  const archived = 0 // not implemented
  const [toastMsg, setToastMsg] = useState(null)
  
  const allAYs = [...new Set(schedules.map(s => s.academic_year || s.academicYear).filter(Boolean))]
  const allSems = [...new Set(schedules.map(s => s.semester).filter(Boolean))]

  const handleRefresh = (hard = false) => {
    // A hard refresh (the toolbar Refresh button) drops the cached schedules
    // and asks for the latest data.
    setLoading(true)
    getSchedules().then(res => {
      setSchedules(res.schedules || res || [])
      setLoading(false)
    }).catch(err => {
      console.error(err)
      setLoading(false)
    })
  }

  const handleView = (s) => {
    // Record view time in localStorage so it bumps to the top of "Newest"
    const viewHistory = JSON.parse(localStorage.getItem('scheduleViewHistory') || '{}')
    viewHistory[s.id || s.name] = Date.now()
    localStorage.setItem('scheduleViewHistory', JSON.stringify(viewHistory))
    navigate(`/dashboard/schedule/${encodeURIComponent(s.id || s.name)}`)
  }


  const handleDuplicate = async (schedule, events) => {
    setToastMsg({ type: 'info', message: 'Duplicating schedule...' })
    try {
      const finalName = `${schedule.name} - Copy ${Math.floor(Math.random() * 1000)}`
      await saveSchedule(finalName, {
        academicYear: schedule.academic_year || schedule.academicYear,
        semester: schedule.semester,
        finalized: false,
        source: 'admin'
      }, events || [])
      setToastMsg({ type: 'success', message: `Duplicated to ${finalName}` })
      handleRefresh()
    } catch(err) {
      console.error(err)
      setToastMsg({ type: 'error', message: 'Failed to duplicate' })
    }
  }

  const [scheduleToDelete, setScheduleToDelete] = useState(null)
  const [deletingState, setDeletingState] = useState('idle')

  const [scheduleToRename, setScheduleToRename] = useState(null)
  const [renamingState, setRenamingState] = useState('idle')

  const handleDelete = (schedule) => {
    setScheduleToDelete(schedule)
  }

  const [renameError, setRenameError] = useState(null)
  
  const handleRename = (schedule) => {
    setScheduleToRename(schedule)
    setRenameError(null)
  }

  const confirmRename = async (newName) => {
    if (!scheduleToRename) return
    setRenamingState('working')
    setRenameError(null)
    try {
      await renameAdminSchedule(scheduleToRename.name, newName)
      setToastMsg({ type: 'success', message: 'Renamed schedule' })
      setRenamingState('idle')
      setScheduleToRename(null)
      handleRefresh()
    } catch(err) {
      console.error(err)
      setRenameError(err?.response?.data?.detail || 'Failed to rename schedule')
      setRenamingState('idle')
    }
  }

  const confirmDelete = async () => {
    if (!scheduleToDelete) return
    setDeletingState('working')
    try {
      // delete_saved on the backend already unapproves any coordinator
      // submissions for this term and deletes the schedule in one call —
      // no extra frontend logic needed here.
      await deleteSaved(scheduleToDelete.name)
      setToastMsg({ type: 'success', message: 'Deleted schedule' })
      handleRefresh()
    } catch(err) {
      console.error(err)
      setToastMsg({ type: 'error', message: 'Failed to delete' })
    } finally {
      setDeletingState('idle')
      setScheduleToDelete(null)
    }
  }
  
  const handleDownloadExcel = async (schedule, events) => {
    try {
      let exportEvents = events
      if (!exportEvents || exportEvents.length === 0) {
        setToastMsg({ type: 'info', message: 'Fetching data...' })
        const res = await getSchedules(schedule.name || schedule.id)
        exportEvents = res.events || []
      }
      await exportScheduleToExcel(exportEvents, schedule.name)
      setToastMsg({ type: 'success', message: 'Downloaded as Excel' })
    } catch(err) {
      console.error(err)
      setToastMsg({ type: 'error', message: 'Failed to export' })
    }
  }

  const handleDownloadPdf = async (schedule, events) => {
    try {
      let exportEvents = events
      if (!exportEvents || exportEvents.length === 0) {
        setToastMsg({ type: 'info', message: 'Fetching data...' })
        const res = await getSchedules(schedule.name || schedule.id)
        exportEvents = res.events || []
      }
      await exportScheduleToPDF(exportEvents, schedule.name, {
        academicYear: schedule.academic_year || schedule.academicYear,
        semester: schedule.semester,
      })
      setToastMsg({ type: 'success', message: 'Downloaded as PDF' })
    } catch(err) {
      console.error(err)
      setToastMsg({ type: 'error', message: 'Failed to export' })
    }
  }

  // Publishing is a one-way-visible action (it goes live to faculty), so —
  // same as the Schedule View page — it gets a confirmation step. Moving
  // back to Draft doesn't need one, since that just hides it again.
  const [scheduleToPublish, setScheduleToPublish] = useState(null)
  const [publishingState, setPublishingState] = useState('idle')

  const handleTogglePublish = (schedule) => {
    if (schedule.finalized) {
      confirmUnpublish(schedule)
    } else {
      setScheduleToPublish(schedule)
    }
  }

  const confirmUnpublish = async (schedule) => {
    const name = schedule.id || schedule.name
    try {
      // unfinalize_schedule on the backend already unapproves any
      // coordinator submissions for this term and reopens the queue —
      // one plain call is all that's needed, regardless of source.
      await unfinalizeSchedule(name)
      setToastMsg({ type: 'success', message: `Moved "${schedule.name}" back to draft` })
      handleRefresh()
    } catch (err) {
      console.error(err)
      setToastMsg({ type: 'error', message: 'Failed to update status' })
    }
  }

  const confirmPublish = async () => {
    if (!scheduleToPublish) return
    const name = scheduleToPublish.id || scheduleToPublish.name
    const ay = scheduleToPublish.academic_year || scheduleToPublish.academicYear
    const sem = scheduleToPublish.semester
    setPublishingState('working')
    try {
      await finalizeSchedule(name)

      // Only one schedule can be the live, published one for a given
      // academic year + semester. finalize_schedule on the backend already
      // un-finalizes any other schedule for the same term, so the sibling
      // toast below is just reflecting what already happened server-side —
      // no extra client-side unfinalize calls needed.
      const siblings = schedules.filter(s =>
        (s.id || s.name) !== name &&
        s.finalized &&
        (s.academic_year || s.academicYear) === ay &&
        s.semester === sem
      )

      setToastMsg({
        type: 'success',
        message: siblings.length > 0
          ? `Published "${scheduleToPublish.name}" — moved ${siblings.length} other schedule${siblings.length > 1 ? 's' : ''} for this term back to draft`
          : `Published "${scheduleToPublish.name}"`
      })
      handleRefresh()
    } catch (err) {
      console.error(err)
      setToastMsg({ type: 'error', message: 'Failed to update status' })
    } finally {
      setPublishingState('idle')
      setScheduleToPublish(null)
    }
  }

  const hasActiveFilters = !!(search || filterAY || filterSem || filterStatus)
  const clearFilters = () => {
    setSearch('')
    setFilterAY('')
    setFilterSem('')
    setFilterStatus('')
  }

  // Distinct tourId ('adminScheduleList') from ScheduleViewPage's
  // 'adminScheduleView' keeps the two pages' tours fully separate — the
  // module-level lock in useTour only blocks a second tour from starting
  // while one with a *different* id is still running, and since these two
  // pages are separate routes (never mounted at the same time), each
  // page's own cleanup effect always clears the lock before the other's
  // tour can start. Kept as its own id anyway so that never changes even
  // if the two pages are ever combined or embedded together later.
  const { TourElement } = useTour('adminScheduleList', [
    {
      target: '#tour-sl-stats',
      title: 'Schedule Overview',
      content: 'A quick snapshot of every schedule you\'ve saved — how many total, how many are published, still in draft, or archived.',
      disableBeacon: true,
      placement: 'bottom',
    },
    {
      target: '#tour-sl-filters',
      title: 'Search & Filter',
      content: 'Search by name, academic year, or semester, or narrow the list with the dropdowns. Sort newest or oldest first, and refresh to pull the latest data.',
      placement: 'bottom',
    },
    {
      target: '#tour-sl-viewtoggle',
      title: 'Grid vs. List View',
      content: 'Grid shows a card per schedule with quick stats. List packs everything into a compact table — better when you have a lot of schedules to scan at once.',
      placement: 'bottom',
    },
    {
      target: '#tour-sl-grid',
      title: 'Your Schedules',
      content: 'Click View Schedule to open one. The duplicate, export, and delete icons work right from here — and the ⋯ menu on each card lets you publish or unpublish it without opening it.',
      placement: 'bottom',
    },
    {
      target: '#tour-sl-pagination',
      title: 'Pagination',
      content: 'Schedules are shown 6 at a time — jump between pages here.',
      placement: 'top',
    },
  ], !loading)

  return (
    <div style={{ display: 'flex', flexDirection: 'column', height: '100%', minHeight: '100%', background: G.bg, padding: 24 }}>
      {TourElement}
      {toastMsg && <Toast type={toastMsg.type} message={toastMsg.message} onDismiss={() => setToastMsg(null)} />}
      {scheduleToDelete && (
        <DeleteScheduleModal 
          scheduleName={scheduleToDelete.name}
          isMaster={false}
          onConfirm={confirmDelete}
          onCancel={() => setScheduleToDelete(null)}
          deletingState={deletingState}
        />
      )}

      {scheduleToRename && (
        <RenameScheduleModal
          schedule={scheduleToRename}
          onConfirm={confirmRename}
          onCancel={() => { setScheduleToRename(null); setRenameError(null); }}
          renamingState={renamingState}
          error={renameError}
        />
      )}

      {/* ── Publish confirmation modal ─────────────────────────────────────── */}
      {scheduleToPublish && (
        <ModalOverlay onClose={() => publishingState !== 'working' && setScheduleToPublish(null)}>
          <div style={{ background: 'var(--surface)', borderRadius: 16, width: 420, padding: '28px 30px', boxShadow: '0 24px 60px rgba(0,0,0,0.25)', border: `1px solid ${G.border}`, fontFamily: 'Inter,sans-serif' }}
            onClick={e => e.stopPropagation()}>
            <div style={{ display: 'flex', alignItems: 'flex-start', gap: 14, marginBottom: 20 }}>
              <div style={{ width: 40, height: 40, borderRadius: 11, background: 'var(--meadow-soft)', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="var(--meadow)" strokeWidth="2.5"><polyline points="20 6 9 17 4 12"/></svg>
              </div>
              <div>
                <h3 style={{ margin: 0, fontSize: 15, fontWeight: 700, color: G.ink }}>Publish Schedule</h3>
                <div style={{ margin: '5px 0 0', fontSize: 12.5, color: G.muted, lineHeight: 1.5 }}>
                  <p style={{ margin: '0 0 10px' }}>
                    This will publish <strong>{scheduleToPublish.name}</strong>
                    {(scheduleToPublish.academic_year || scheduleToPublish.academicYear || scheduleToPublish.semester)
                      ? ` (${[scheduleToPublish.academic_year || scheduleToPublish.academicYear ? `A.Y. ${scheduleToPublish.academic_year || scheduleToPublish.academicYear}` : '', scheduleToPublish.semester].filter(Boolean).join(', ')})`
                      : ''} to faculty.
                  </p>
                  <p style={{ margin: 0, padding: '10px 14px', background: 'rgba(239, 68, 68, 0.1)', color: '#EF4444', borderRadius: 8, fontSize: 12.5, fontWeight: 500, border: '1px solid rgba(239, 68, 68, 0.2)' }}>
                    Warning: If you already published a Master Schedule for this term, it will be automatically overwritten and unpublished. There can only be one active published schedule per term.
                  </p>
                </div>
              </div>
            </div>
            <div style={{ display: 'flex', gap: 8, justifyContent: 'flex-end' }}>
              <button onClick={() => setScheduleToPublish(null)} disabled={publishingState === 'working'}
                style={{ padding: '8px 18px', borderRadius: 9, border: `1.5px solid ${G.border}`, background: 'var(--surface)', color: G.muted, fontSize: 12.5, fontWeight: 600, cursor: publishingState === 'working' ? 'default' : 'pointer', fontFamily: 'Inter,sans-serif' }}>
                Cancel
              </button>
              <button onClick={confirmPublish} disabled={publishingState === 'working'}
                style={{ padding: '8px 22px', borderRadius: 9, border: 'none', background: 'linear-gradient(135deg,var(--meadow),var(--meadow-deep))', color: '#fff', fontSize: 12.5, fontWeight: 700, cursor: publishingState === 'working' ? 'default' : 'pointer', fontFamily: 'Inter,sans-serif', boxShadow: '0 3px 12px rgba(0,0,0,0.25)', opacity: publishingState === 'working' ? 0.7 : 1 }}>
                {publishingState === 'working' ? 'Publishing…' : 'Yes, Publish'}
              </button>
            </div>
          </div>
        </ModalOverlay>
      )}
      
      {/* Top Stats */}
      <div id="tour-sl-stats" style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 16, marginBottom: 24 }}>
        <StatCard icon={<svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="var(--meadow)"><rect x="3" y="4" width="18" height="18" rx="2" strokeWidth="2"/><line x1="16" y1="2" x2="16" y2="6" strokeWidth="2"/><line x1="8" y1="2" x2="8" y2="6" strokeWidth="2"/><line x1="3" y1="10" x2="21" y2="10" strokeWidth="2"/></svg>} title="Total Schedules" value={total} />
        <StatCard icon={<svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="var(--meadow)"><path d="M22 11.08V12a10 10 0 1 1-5.93-9.14" strokeWidth="2"/><polyline points="22 4 12 14.01 9 11.01" strokeWidth="2"/></svg>} title="Published" value={published} />
        <StatCard icon={<svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="#F59E0B"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" strokeWidth="2"/><polyline points="14 2 14 8 20 8" strokeWidth="2"/><line x1="16" y1="13" x2="8" y2="13" strokeWidth="2"/><line x1="16" y1="17" x2="8" y2="17" strokeWidth="2"/><polyline points="10 9 9 9 8 9" strokeWidth="2"/></svg>} title="Drafts" value={drafts} trendColor="#F59E0B" iconBg="rgba(245,158,11,0.15)" />
        <StatCard icon={<svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="#6B7280"><polyline points="21 8 21 21 3 21 3 8" strokeWidth="2"/><rect x="1" y="3" width="22" height="5" strokeWidth="2"/><line x1="10" y1="12" x2="14" y2="12" strokeWidth="2"/></svg>} title="Archived" value={archived} trendColor="#6B7280" iconBg="rgba(107,114,128,0.15)" />
      </div>

      {/* Filters */}
      <div id="tour-sl-filters" style={{ display: 'flex', gap: 12, marginBottom: 24, alignItems: 'center' }}>
        <div style={{ position: 'relative', flex: 1 }}>
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="var(--muted2)" strokeWidth="2" style={{ position: 'absolute', left: 12, top: '50%', transform: 'translateY(-50%)', pointerEvents: 'none' }}>
            <circle cx="11" cy="11" r="8"/><line x1="21" y1="21" x2="16.65" y2="16.65"/>
          </svg>
          <input 
            type="text" 
            placeholder="Search by schedule name, academic year, or semester..."
            value={search}
            onChange={e => setSearch(e.target.value)}
            style={{ width: '100%', padding: '10px 16px 10px 36px', borderRadius: 8, border: `1px solid ${G.border}`, outline: 'none', background: 'var(--surface)' }}
          />
        </div>
        <Dropdown 
          icon={<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><rect x="3" y="4" width="18" height="18" rx="2" ry="2"/><line x1="16" y1="2" x2="16" y2="6"/><line x1="8" y1="2" x2="8" y2="6"/><line x1="3" y1="10" x2="21" y2="10"/></svg>} 
          text="Academic Year" 
          value={filterAY} 
          onChange={e => setFilterAY(e.target.value)} 
          options={allAYs.map(ay => ({ value: ay, label: ay }))} 
        />
        <Dropdown 
          icon={<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><polygon points="12 2 2 7 12 12 22 7 12 2"/><polyline points="2 17 12 22 22 17"/><polyline points="2 12 12 17 22 12"/></svg>} 
          text="Semester" 
          value={filterSem} 
          onChange={e => setFilterSem(e.target.value)} 
          options={allSems.map(s => ({ value: s, label: s }))} 
        />
        <Dropdown 
          icon={<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/><polyline points="14 2 14 8 20 8"/><line x1="16" y1="13" x2="8" y2="13"/><line x1="16" y1="17" x2="8" y2="17"/><polyline points="10 9 9 9 8 9"/></svg>} 
          text="Status" 
          value={filterStatus} 
          onChange={e => setFilterStatus(e.target.value)} 
          options={[{value: 'published', label: 'Published'}, {value: 'draft', label: 'Draft'}]} 
        />
        <Dropdown 
          icon={<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><polyline points="1 4 1 10 7 10"/><polyline points="23 20 23 14 17 14"/><path d="M20.49 9A9 9 0 0 0 5.64 5.64L1 10m22 4l-4.64 4.36A9 9 0 0 1 3.51 15"/></svg>} 
          text="Sort By" 
          value={sortBy} 
          onChange={e => setSortBy(e.target.value)} 
          options={[{value: 'newest', label: 'Newest First'}, {value: 'oldest', label: 'Oldest First'}]} 
        />
        
        {hasActiveFilters && (
          <button
            onClick={clearFilters}
            title="Clear all filters"
            style={{ display: 'flex', alignItems: 'center', gap: 6, height: 36, padding: '0 12px', borderRadius: 8, border: `1px solid ${G.border}`, background: 'var(--surface)', cursor: 'pointer', color: G.muted, fontSize: 12, fontWeight: 600, whiteSpace: 'nowrap' }}
          >
            <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg>
            Clear
          </button>
        )}

        <button
          onClick={() => handleRefresh(true)}
          title="Refresh"
          style={{ width: 36, height: 36, padding: 0, borderRadius: 8, border: `1px solid ${G.border}`, background: 'var(--surface)', display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer', color: G.ink, flexShrink: 0 }}
        >
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" style={{ animation: loading ? 'spin 0.8s linear infinite' : 'none' }}>
            <polyline points="1 4 1 10 7 10"/><polyline points="23 20 23 14 17 14"/><path d="M20.49 9A9 9 0 0 0 5.64 5.64L1 10m22 4l-4.64 4.36A9 9 0 0 1 3.51 15"/>
          </svg>
        </button>

        <div id="tour-sl-viewtoggle" style={{ display: 'flex', gap: 6, marginLeft: 8 }}>
          <button
            onClick={() => setViewMode('grid')}
            title="Grid view"
            style={{ width: 36, height: 36, padding: 0, borderRadius: 8, border: viewMode === 'grid' ? 'none' : `1px solid ${G.border}`, background: viewMode === 'grid' ? 'var(--meadow)' : 'var(--surface)', display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer', color: viewMode === 'grid' ? '#fff' : G.ink }}
          >
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><rect x="3" y="3" width="7" height="7"/><rect x="14" y="3" width="7" height="7"/><rect x="14" y="14" width="7" height="7"/><rect x="3" y="14" width="7" height="7"/></svg>
          </button>
          <button
            onClick={() => setViewMode('list')}
            title="List view"
            style={{ width: 36, height: 36, padding: 0, borderRadius: 8, border: viewMode === 'list' ? 'none' : `1px solid ${G.border}`, background: viewMode === 'list' ? 'var(--meadow)' : 'var(--surface)', display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer', color: viewMode === 'list' ? '#fff' : G.ink }}
          >
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><line x1="8" y1="6" x2="21" y2="6"/><line x1="8" y1="12" x2="21" y2="12"/><line x1="8" y1="18" x2="21" y2="18"/><line x1="3" y1="6" x2="3.01" y2="6"/><line x1="3" y1="12" x2="3.01" y2="12"/><line x1="3" y1="18" x2="3.01" y2="18"/></svg>
          </button>
        </div>
      </div>

      {/* Grid / List */}
      <div id="tour-sl-grid">
        {loading ? (
          <div style={{ padding: 40, textAlign: 'center', color: G.muted }}>Loading schedules...</div>
        ) : paginated.length === 0 ? (
          <div style={{ padding: 40, textAlign: 'center', color: G.muted }}>
            {hasActiveFilters ? 'No schedules found matching filters.' : 'No schedules available.'}
          </div>
        ) : viewMode === 'grid' ? (
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 24 }}>
            {paginated.map(s => (
              <ScheduleCard 
                key={s.id || s.name} 
                schedule={s} 
                onClick={() => handleView(s)} 
                onDuplicate={(events) => handleDuplicate(s, events)}
                onDelete={() => handleDelete(s)}
                onRename={() => handleRename(s)}
                onDownloadExcel={(events) => handleDownloadExcel(s, events)}
                onDownloadPdf={(events) => handleDownloadPdf(s, events)}
                onTogglePublish={() => handleTogglePublish(s)}
              />
            ))}
          </div>
        ) : (
          <ScheduleListTable
            schedules={paginated}
            onView={handleView}
            onDuplicate={handleDuplicate}
            onDelete={handleDelete}
            onRename={handleRename}
            onDownloadExcel={handleDownloadExcel}
            onDownloadPdf={handleDownloadPdf}
            onTogglePublish={handleTogglePublish}
          />
        )}
      </div>

      {/* Pagination */}
      {!loading && paginated.length > 0 && (
        <div id="tour-sl-pagination" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginTop: 24, fontSize: 13, color: G.muted }}>
          <span>Showing {(currentPage - 1) * itemsPerPage + 1}-{Math.min(currentPage * itemsPerPage, filtered.length)} of {filtered.length} schedules</span>
          <div style={{ display: 'flex', gap: 6 }}>
            <button 
              onClick={() => setCurrentPage(p => Math.max(1, p - 1))}
              disabled={currentPage === 1}
              style={{ width: 32, height: 32, padding: 0, borderRadius: 8, border: `1px solid ${G.border}`, background: 'var(--surface)', display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: currentPage === 1 ? 'not-allowed' : 'pointer', color: currentPage === 1 ? G.border : G.ink, opacity: currentPage === 1 ? 0.5 : 1 }}>
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><polyline points="15 18 9 12 15 6"/></svg>
            </button>
            
            {Array.from({ length: totalPages }, (_, i) => i + 1).map(page => (
              <button 
                key={page}
                onClick={() => setCurrentPage(page)}
                style={{ 
                  width: 32, height: 32, padding: 0, borderRadius: 8, 
                  border: page === currentPage ? 'none' : `1px solid ${G.border}`, 
                  background: page === currentPage ? 'var(--meadow)' : 'var(--surface)', 
                  color: page === currentPage ? '#fff' : G.ink, 
                  fontWeight: 600, display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer' 
                }}>
                {page}
              </button>
            ))}
            
            <button 
              onClick={() => setCurrentPage(p => Math.min(totalPages, p + 1))}
              disabled={currentPage === totalPages}
              style={{ width: 32, height: 32, padding: 0, borderRadius: 8, border: `1px solid ${G.border}`, background: 'var(--surface)', display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: currentPage === totalPages ? 'not-allowed' : 'pointer', color: currentPage === totalPages ? G.border : G.ink, opacity: currentPage === totalPages ? 0.5 : 1 }}>
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><polyline points="9 18 15 12 9 6"/></svg>
            </button>
          </div>
        </div>
      )}
    </div>
  )
}

function StatCard({ icon, title, value, trend, trendColor = 'var(--meadow)', iconBg = 'var(--meadow-soft)' }) {
  return (
    <div style={{ background: 'var(--surface)', borderRadius: 12, padding: 16, border: `1px solid ${G.border}`, display: 'flex', flexDirection: 'column', gap: 10, position: 'relative', overflow: 'hidden' }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
        <div style={{ width: 40, height: 40, borderRadius: 10, background: iconBg, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
          {icon}
        </div>
        <div style={{ display: 'flex', flexDirection: 'column' }}>
          <span style={{ fontSize: 12, fontWeight: 600, color: G.ink }}>{title}</span>
          <span style={{ fontSize: 20, fontWeight: 700, color: G.ink }}>{value}</span>
        </div>
      </div>
      {trend && (
        <div style={{ fontSize: 11, fontWeight: 600, color: trendColor, zIndex: 1 }}>
          ↑ {trend}
        </div>
      )}
      {/* Decorative wave */}
      <svg width="100%" height="40" style={{ position: 'absolute', bottom: 0, right: 0, opacity: 0.2 }} viewBox="0 0 100 40" preserveAspectRatio="none">
        <path d="M0 40 Q 25 10, 50 25 T 100 10 L 100 40 Z" fill={trendColor} />
      </svg>
    </div>
  )
}

// Shared by both the grid card and the list row so the "fetch this
// schedule's events and derive course/faculty/room/conflict counts" logic
// only lives in one place.

function useScheduleStats(schedule) {
  const [stats, setStats] = useState(() => {
    return {
      courses: schedule.courseCount || 0,
      faculty: schedule.facultyCount || 0,
      rooms: schedule.roomCount || 0,
      conflicts: schedule.conflictCount || 0,
      loading: false,
      events: null
    }
  })

  useEffect(() => {
    if (schedule.stats) {
      setStats({ ...schedule.stats, loading: false, events: null })
    }
  }, [schedule.stats])

  return stats
}

function ScheduleCard({ schedule, onClick, onDuplicate, onDelete, onDownloadExcel, onDownloadPdf, onTogglePublish, onRename }) {
  const stats = useScheduleStats(schedule)

  const ay = schedule.academicYear || 'No A.Y.'
  const sem = schedule.semester || 'No Semester'
  const isFinalized = schedule.finalized || false
  const scheduleImage = "data:image/svg+xml;charset=UTF-8,%3Csvg width='100%25' height='100%25' xmlns='http://www.w3.org/2000/svg'%3E%3Cdefs%3E%3Cpattern id='p' width='40' height='40' patternUnits='userSpaceOnUse'%3E%3Cpath d='M0 40L40 0H20L0 20M40 40V20L20 40' fill='%23ffffff' fill-opacity='0.1'/%3E%3C/pattern%3E%3C/defs%3E%3Crect width='100%25' height='100%25' fill='url(%23p)'/%3E%3C/svg%3E"
  
  const classesCount = schedule.eventCount || stats.classes || stats.events?.length || 0
  const faculty = stats.faculty
  const rooms = stats.rooms
  const conflicts = stats.conflicts
  const name = schedule.name || 'Untitled Schedule'
  const updated = new Date(schedule.lastModified || schedule.savedAt || schedule.createdAt || 0).toLocaleString('en-US', {
    month: 'short', day: 'numeric', year: 'numeric', hour: 'numeric', minute: '2-digit', hour12: true
  }).replace(',', '')
  
  return (
    <div style={{ background: 'var(--surface)', borderRadius: 12, overflow: 'hidden', border: `1px solid ${G.border}`, display: 'flex', flexDirection: 'column' }}>
      <div style={{ height: 48, background: 'var(--meadow-deep)', position: 'relative' }}>
        {/* Placeholder for header background image */}
        <div style={{ position: 'absolute', inset: 0, opacity: 0.3, backgroundImage: `url(${scheduleImage})`, backgroundPosition: 'center', backgroundSize: 'cover' }} />
      </div>
      
      <div style={{ padding: 16, display: 'flex', flexDirection: 'column', flex: 1 }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: 12 }}>
          <div>
            <div style={{ fontSize: 15, fontWeight: 700, color: G.ink, marginBottom: 2, lineHeight: 1.2 }}>{name}</div>
            <div style={{ fontSize: 11, color: G.muted }}>{ay} • {sem}</div>
          </div>
          <button
            onClick={() => onTogglePublish && onTogglePublish()}
            title={isFinalized ? 'Click to move back to Draft' : 'Click to Publish'}
            style={{
              padding: '2px 8px', borderRadius: 99, fontSize: 10, fontWeight: 700,
              background: isFinalized ? 'var(--meadow-soft)' : '#F3F4F6',
              color: isFinalized ? 'var(--meadow)' : '#6B7280',
              display: 'inline-flex', alignItems: 'center', gap: 4,
              border: `1px solid ${isFinalized ? 'var(--meadow-border)' : '#E5E7EB'}`, cursor: 'pointer',
              flexShrink: 0, whiteSpace: 'nowrap', fontFamily: 'inherit',
            }}
          >
            {isFinalized ? (
              <><svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3"><polyline points="20 6 9 17 4 12"/></svg> Published</>
            ) : (
              <><svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><circle cx="12" cy="12" r="10"/></svg> Draft</>
            )}
          </button>
        </div>
        
        <div style={{ display: 'flex', justifyContent: 'space-between', marginTop: 16, paddingTop: 16, borderTop: `1px solid ${G.borderLight}` }}>
          <Stat icon={<svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M4 19.5A2.5 2.5 0 0 1 6.5 17H20"/><path d="M6.5 2H20v20H6.5A2.5 2.5 0 0 1 4 19.5v-15A2.5 2.5 0 0 1 6.5 2z"/></svg>} val={stats.loading && !schedule.eventCount ? '—' : classesCount} label="Classes" />
          <Stat icon={<svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2"/><circle cx="9" cy="7" r="4"/></svg>} val={stats.loading ? '—' : faculty} label="Faculty" />
          <Stat icon={<svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M3 9l9-7 9 7v11a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z"/><polyline points="9 22 9 12 15 12 15 22"/></svg>} val={stats.loading ? '—' : rooms} label="Rooms" />
          <Stat icon={<svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M10.29 3.86L1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z"/><line x1="12" y1="9" x2="12" y2="13"/><line x1="12" y1="17" x2="12.01" y2="17"/></svg>} val={stats.loading ? '—' : conflicts} label="Conflicts" />
        </div>
        
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginTop: 16, fontSize: 10, color: G.muted }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
            <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><circle cx="12" cy="12" r="10"/><polyline points="12 6 12 12 16 14"/></svg>
            Last updated {updated}
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
            <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2"/><circle cx="12" cy="7" r="4"/></svg>
            By {schedule.user || schedule.author || 'Dean'}
          </div>
        </div>
        
        <div style={{ display: 'flex', gap: 6, marginTop: 16 }}>
          <button onClick={onClick} style={{ flex: 1, padding: '6px 0', background: 'var(--meadow)', color: '#fff', border: 'none', borderRadius: 6, fontWeight: 600, cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 4, fontSize: 12 }}>
            <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z"/><circle cx="12" cy="12" r="3"/></svg>
            View Schedule
          </button>
          <button onClick={() => onDuplicate && onDuplicate(stats.events)} style={{ width: 28, height: 28, padding: 0, border: `1px solid ${G.border}`, background: 'transparent', borderRadius: 6, display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer', color: G.muted }} title="Duplicate">
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><rect x="9" y="9" width="13" height="13" rx="2" ry="2"/><path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1"/></svg>
          </button>
          <ExportMenuButton
            iconOnly
            size={28}
            onExportExcel={() => onDownloadExcel && onDownloadExcel(stats.events)}
            onExportPdf={() => onDownloadPdf && onDownloadPdf(stats.events)}
          />
          <button onClick={() => typeof onRename === 'function' && onRename()} style={{ width: 28, height: 28, padding: 0, border: `1px solid ${G.border}`, background: 'transparent', borderRadius: 6, display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer', color: G.muted }} title="Rename">
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"/><path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"/></svg>
          </button>
          <button onClick={() => onDelete && onDelete()} style={{ width: 28, height: 28, padding: 0, border: `1px solid ${G.border}`, background: 'transparent', borderRadius: 6, display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer', color: G.muted }} title="Delete">
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><polyline points="3 6 5 6 21 6"></polyline><path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"></path></svg>
          </button>
        </div>
      </div>
    </div>
  )
}

function Stat({ icon, val, label }) {
  return (
    <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 2 }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 5, fontSize: 13, fontWeight: 700, color: G.ink }}>
        <span style={{ color: G.muted, display: 'flex' }}>{icon}</span>
        {val}
      </div>
      <div style={{ fontSize: 10, color: G.muted, fontWeight: 600 }}>{label}</div>
    </div>
  )
}

function Dropdown({ icon, text, value, onChange, options = [] }) {
  return (
    <div style={{ position: 'relative', display: 'flex', alignItems: 'center' }}>
      <span style={{ position: 'absolute', left: 12, color: G.muted, display: 'flex', alignItems: 'center' }}>{icon}</span>
      <select 
        value={value}
        onChange={onChange}
        style={{ 
          padding: '10px 32px 10px 36px', 
          borderRadius: 8, 
          border: `1px solid ${G.border}`, 
          background: 'var(--surface)', 
          appearance: 'none', 
          backgroundImage: 'url("data:image/svg+xml;charset=US-ASCII,%3Csvg%20xmlns%3D%22http%3A%2F%2Fwww.w3.org%2F2000%2Fsvg%22%20width%3D%22292.4%22%20height%3D%22292.4%22%3E%3Cpath%20fill%3D%22%231C3D2A%22%20d%3D%22M287%2069.4a17.6%2017.6%200%200%200-13-5.4H18.4c-5%200-9.3%201.8-12.9%205.4A17.6%2017.6%200%200%200%200%2082.2c0%205%201.8%209.3%205.4%2012.9l128%20127.9c3.6%203.6%207.8%205.4%2012.8%205.4s9.2-1.8%2012.8-5.4L287%2095c3.5-3.5%205.4-7.8%205.4-12.8%200-5-1.9-9.2-5.5-12.8z%22%2F%3E%3C%2Fsvg%3E")', 
          backgroundRepeat: 'no-repeat', 
          backgroundPosition: 'right 12px top 50%', 
          backgroundSize: '10px auto', 
          color: G.ink, 
          fontSize: 13, 
          fontWeight: 500,
          cursor: 'pointer'
        }}
      >
        <option value="">{text}</option>
        {options.map(opt => (
          <option key={opt.value} value={opt.value}>{opt.label}</option>
        ))}
      </select>
    </div>
  )
}

/* ── List view: a compact table, better for scanning many schedules at
   once than the card grid. Uses the same useScheduleStats hook and the
   same action handlers as ScheduleCard so behavior stays identical
   between the two view modes. ── */
function ScheduleListTable({ schedules, onView, onDuplicate, onDelete, onRename, onDownloadExcel, onDownloadPdf, onTogglePublish }) {
  return (
    <div style={{ background: 'var(--surface)', borderRadius: 12, border: `1px solid ${G.border}`, overflow: 'hidden' }}>
      <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 12.5 }}>
        <thead>
          <tr style={{ background: G.bg }}>
            {['Name', 'Term', 'Status', 'Classes', 'Faculty', 'Rooms', 'Conflicts', 'Last Updated', ''].map(h => (
              <th key={h} style={{ padding: '10px 14px', textAlign: 'left', fontSize: 10.5, fontWeight: 700, color: G.muted, textTransform: 'uppercase', letterSpacing: '.5px', borderBottom: `1px solid ${G.border}`, whiteSpace: 'nowrap' }}>
                {h}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {schedules.map((s, i) => (
            <ScheduleListRow
              key={s.id || s.name}
              schedule={s}
              striped={i % 2 === 1}
              onView={() => onView(s)}
              onDuplicate={(events) => onDuplicate(s, events)}
              onDelete={() => onDelete(s)}
              onRename={() => onRename && onRename(s)}
              onDownloadExcel={(events) => onDownloadExcel(s, events)}
              onDownloadPdf={(events) => onDownloadPdf(s, events)}
              onTogglePublish={() => onTogglePublish(s)}
            />
          ))}
        </tbody>
      </table>
    </div>
  )
}

function ScheduleListRow({ schedule, striped, onView, onDuplicate, onDelete, onRename, onDownloadExcel, onDownloadPdf, onTogglePublish }) {
  const stats = useScheduleStats(schedule)
  const [menuOpen, setMenuOpen] = useState(false)

  const name = schedule.name || 'Untitled Schedule'
  const ay = schedule.academicYear || 'No A.Y.'
  const sem = schedule.semester || 'No Semester'
  const isFinalized = schedule.finalized || false
  const updated = new Date(schedule.lastModified || schedule.savedAt || schedule.createdAt || 0).toLocaleDateString('en-US', {
    month: 'short', day: 'numeric', year: 'numeric'
  })

  return (
    <tr style={{ background: striped ? G.bg : 'var(--surface)', borderBottom: `1px solid ${G.border}` }}>
      <td style={{ padding: '10px 14px', fontWeight: 700, color: G.ink, cursor: 'pointer' }} onClick={onView}>{name}</td>
      <td style={{ padding: '10px 14px', color: G.muted, whiteSpace: 'nowrap' }}>{ay} • {sem}</td>
      <td style={{ padding: '10px 14px' }}>
        <button
          onClick={onTogglePublish}
          title={isFinalized ? 'Click to move back to Draft' : 'Click to Publish'}
          style={{
            padding: '2px 8px', borderRadius: 99, fontSize: 10, fontWeight: 700,
            background: isFinalized ? 'var(--meadow-soft)' : '#F3F4F6',
            color: isFinalized ? 'var(--meadow)' : '#6B7280',
            border: `1px solid ${isFinalized ? 'var(--meadow-border)' : '#E5E7EB'}`, cursor: 'pointer', fontFamily: 'inherit',
          }}
        >
          {isFinalized ? 'Published' : 'Draft'}
        </button>
      </td>
      <td style={{ padding: '10px 14px', color: G.ink }}>{(stats.loading && !schedule.eventCount) ? '—' : (schedule.eventCount || stats.classes || stats.events?.length || 0)}</td>
      <td style={{ padding: '10px 14px', color: G.ink }}>{stats.loading ? '—' : stats.faculty}</td>
      <td style={{ padding: '10px 14px', color: G.ink }}>{stats.loading ? '—' : stats.rooms}</td>
      <td style={{ padding: '10px 14px', color: stats.conflicts > 0 ? '#dc2626' : G.ink, fontWeight: stats.conflicts > 0 ? 700 : 400 }}>{stats.loading ? '—' : stats.conflicts}</td>
      <td style={{ padding: '10px 14px', color: G.muted, whiteSpace: 'nowrap' }}>{updated}</td>
      <td style={{ padding: '10px 14px', position: 'relative' }}>
        <div style={{ display: 'flex', gap: 4, justifyContent: 'flex-end' }}>
          <button onClick={onView} title="View" style={{ width: 26, height: 26, padding: 0, border: `1px solid ${G.border}`, background: 'transparent', borderRadius: 6, display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer', color: G.muted }}>
            <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z"/><circle cx="12" cy="12" r="3"/></svg>
          </button>
          <ExportMenuButton
            iconOnly
            size={26}
            onExportExcel={() => onDownloadExcel(stats.events)}
            onExportPdf={() => onDownloadPdf(stats.events)}
          />
          <button onClick={() => setMenuOpen(o => !o)} title="More options" style={{ width: 26, height: 26, padding: 0, border: `1px solid ${G.border}`, background: 'transparent', borderRadius: 6, display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer', color: G.muted }}>
            <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><circle cx="12" cy="5" r="1"/><circle cx="12" cy="12" r="1"/><circle cx="12" cy="19" r="1"/></svg>
          </button>
          {menuOpen && (
            <>
              <div style={{ position: 'fixed', inset: 0, zIndex: 10 }} onClick={() => setMenuOpen(false)} />
              <div style={{ position: 'absolute', top: 30, right: 0, background: 'var(--surface)', border: `1px solid ${G.border}`, borderRadius: 8, boxShadow: '0 10px 28px rgba(0,0,0,0.2)', minWidth: 150, zIndex: 20, overflow: 'hidden' }}>
                <button className="sl-menu-item" onClick={() => { setMenuOpen(false); if(typeof onRename === 'function') onRename() }} style={{ color: G.ink }}>
                  <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"/><path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"/></svg>
                  Rename
                </button>
                <button className="sl-menu-item" onClick={() => { setMenuOpen(false); onDuplicate(stats.events) }} style={{ color: G.ink }}>
                  <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><rect x="9" y="9" width="13" height="13" rx="2" ry="2"/><path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1"/></svg>
                  Duplicate
                </button>
                <button className="sl-menu-item" onClick={() => { setMenuOpen(false); onDelete() }} style={{ color: '#dc2626' }}>
                  <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><polyline points="3 6 5 6 21 6"/><path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"/></svg>
                  Delete
                </button>
              </div>
            </>
          )}
        </div>
      </td>
    </tr>
  )
}