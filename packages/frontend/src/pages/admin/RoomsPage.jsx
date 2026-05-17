import { useEffect, useRef, useState, useMemo } from 'react'
import { getRooms, saveRooms, getCourses, bulkSetPreferredRooms } from '../../services/api'

if (!document.getElementById('rooms-page-style')) {
  const s = document.createElement('style')
  s.id = 'rooms-page-style'
  s.textContent = `
    .room-row {
      display: flex; align-items: center; gap: 8px;
      padding: 6px 10px; border-radius: 8px;
      border: 1px solid #EEEBF8; background: #fff;
      transition: box-shadow 0.15s, border-color 0.15s;
      animation: slideInR 0.15s ease;
    }
    .room-row:hover { border-color: #D8D3F5; box-shadow: 0 2px 6px rgba(124,111,205,0.09); }
    .room-row:hover .room-del { opacity: 1; }
    .room-row.drag-over { border-color: #7C6FCD; box-shadow: 0 0 0 2px rgba(124,111,205,0.18); }

    .drag-handle {
      cursor: grab; color: #C0BBDC; display: flex; align-items: center;
      padding: 2px; border-radius: 4px; transition: color 0.12s; flex-shrink: 0;
    }
    .drag-handle:hover { color: #7C6FCD; }
    .drag-handle:active { cursor: grabbing; }

    .room-badge {
      min-width: 18px; height: 18px; border-radius: 5px;
      display: flex; align-items: center; justify-content: center;
      font-size: 9px; font-weight: 700; flex-shrink: 0;
    }
    .room-badge.lec { background: #EDE9FB; color: #7C6FCD; }
    .room-badge.lab { background: #FEF3CD; color: #D97706; }

    .room-del {
      margin-left: auto; flex-shrink: 0;
      display: inline-flex; align-items: center; justify-content: center;
      width: 22px; height: 22px; border-radius: 6px;
      border: 1.5px solid #E8E4F8; cursor: pointer;
      background: #fff; color: #C0BBDC;
      transition: all 0.13s; opacity: 0.6;
      padding: 0;
    }
    .room-del:hover { background: #FEE2E2; border-color: #FECACA; color: #DC2626; opacity: 1; }

    .room-add-input {
      flex: 1; padding: 6px 10px; border-radius: 8px;
      border: 1.5px dashed #D8D3F5; font-family: 'Poppins', sans-serif;
      font-size: 12px; color: #1a1a2e; background: #FAFAFE;
      outline: none; transition: border-color 0.15s, background 0.15s;
    }
    .room-add-input:focus {
      border-color: #A99BE8; background: #fff;
      box-shadow: 0 0 0 3px rgba(169,155,232,0.12); border-style: solid;
    }
    .room-add-input::placeholder { color: #C0BBDC; }

    .rooms-list { display: flex; flex-direction: column; gap: 4px; margin-bottom: 10px; }

    .empty-room-state {
      display: flex; align-items: center; gap: 8px;
      padding: 10px; border-radius: 8px;
      border: 1.5px dashed #E8E4F8; background: #FAFAFE; margin-bottom: 10px;
    }

    .room-card-head {
      display: flex; align-items: center; gap: 9px;
      padding: 11px 14px; border-bottom: 1px solid #F0EDF9;
    }

    .rm-save {
      display: inline-flex; align-items: center; gap: 6px;
      padding: 6px 12px; border-radius: 8px;
      border: 1.5px solid #E8E4F8; font-family: 'Poppins', sans-serif;
      font-size: 11.5px; font-weight: 600; cursor: pointer;
      background: #fff; color: #7C6FCD; transition: all 0.13s; flex-shrink: 0;
    }
    .rm-save:hover:not(:disabled) { background: #EEEAFB; border-color: #C5BBEF; }
    .rm-save.saved { background: #E6FAF3; color: #059669; border-color: #A7F3D0; }
    .rm-save:disabled { opacity: .6; cursor: default; }

    .rm-add-btn {
      padding: 6px 12px; border-radius: 8px; border: 1.5px solid #E8E4F8;
      font-family: 'Poppins', sans-serif; font-size: 11.5px; font-weight: 600;
      cursor: pointer; background: #fff; color: #7C6FCD;
      display: inline-flex; align-items: center; gap: 4px; transition: all 0.13s; flex-shrink: 0;
    }
    .rm-add-btn:hover { background: #EEEAFB; border-color: #C5BBEF; }

    @keyframes slideInR { from{opacity:0;transform:translateY(-3px)} to{opacity:1;transform:translateY(0)} }
    @keyframes spin-r { to{transform:rotate(360deg)} }

    @keyframes rmShimmer {
      0%   { background-position: -400px 0 }
      100% { background-position:  400px 0 }
    }
    .rm-skeleton {
      background: linear-gradient(90deg, #F0EDF9 25%, #E4DEFC 50%, #F0EDF9 75%);
      background-size: 800px 100%;
      animation: rmShimmer 1.4s ease-in-out infinite;
      border-radius: 7px;
    }

    /* ── Course Room Assignment Section ──────────────────────────────────────── */

    .cp-search {
      flex: 1; padding: 7px 12px 7px 34px; border-radius: 9px;
      border: 1.5px solid #E8E4F8; font-family: 'Poppins', sans-serif;
      font-size: 12px; color: #1a1a2e; background: #FAFAFE;
      outline: none; transition: border-color 0.15s, box-shadow 0.15s, background 0.15s;
    }
    .cp-search:focus {
      border-color: #A99BE8; background: #fff;
      box-shadow: 0 0 0 3px rgba(169,155,232,0.12);
    }
    .cp-search::placeholder { color: #C0BBDC; }

    .cp-prog-pill {
      padding: 4px 10px; border-radius: 20px; border: 1.5px solid #E8E4F8;
      font-family: 'Poppins', sans-serif; font-size: 10.5px; font-weight: 600;
      cursor: pointer; background: #fff; color: #8883B0;
      transition: all 0.13s; white-space: nowrap; flex-shrink: 0;
    }
    .cp-prog-pill.active {
      background: #EDE9FB; border-color: #C5BBEF; color: #7C6FCD;
    }
    .cp-prog-pill:hover:not(.active) { background: #F5F3FD; border-color: #D8D3F5; color: #7C6FCD; }

    .cp-course-row {
      display: flex; align-items: center; gap: 10px;
      padding: 8px 14px; border-bottom: 1px solid #F5F3FD;
      transition: background 0.1s;
    }
    .cp-course-row:last-child { border-bottom: none; }
    .cp-course-row:hover { background: #FAFAFE; }

    /* ── Room dropdown ──────────────────────────────────────────────────────── */
    .room-select {
      padding: 5px 28px 5px 10px; border-radius: 8px;
      border: 1.5px solid #E8E4F8; font-family: 'Poppins', sans-serif;
      font-size: 11px; font-weight: 500; color: #3D3773;
      background: #fff url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='10' height='10' viewBox='0 0 24 24' fill='none' stroke='%23A09CC0' stroke-width='2.5'%3E%3Cpolyline points='6 9 12 15 18 9'/%3E%3C/svg%3E") no-repeat right 8px center;
      -webkit-appearance: none; appearance: none;
      cursor: pointer; flex-shrink: 0; min-width: 140px; max-width: 200px;
      outline: none; transition: border-color 0.15s, box-shadow 0.15s;
    }
    .room-select:focus {
      border-color: #A99BE8;
      box-shadow: 0 0 0 3px rgba(169,155,232,0.12);
    }
    .room-select.is-assigned {
      border-color: #A99BE8; background-color: #F5F3FD;
      color: #5B50A8; font-weight: 600;
    }
    .room-select.is-assigned-lab {
      border-color: #FCD34D; background-color: #FFFBEB;
      color: #92400E; font-weight: 600;
    }

    .cp-dirty-badge {
      display: inline-flex; align-items: center; justify-content: center;
      min-width: 18px; height: 18px; padding: 0 5px; border-radius: 20px;
      background: #7C6FCD; color: #fff; font-size: 10px; font-weight: 700;
      font-family: 'Poppins', sans-serif; flex-shrink: 0;
    }

    .cp-save-bar {
      display: flex; align-items: center; gap: 8px;
      padding: 10px 14px; border-top: 1px solid #F0EDF9;
      background: #FAFAFE;
    }

    .cp-reset-btn {
      padding: 5px 10px; border-radius: 7px; border: 1.5px solid #E8E4F8;
      font-family: 'Poppins', sans-serif; font-size: 11px; font-weight: 600;
      cursor: pointer; background: #fff; color: #A09CC0;
      transition: all 0.13s;
    }
    .cp-reset-btn:hover:not(:disabled) { background: #FEF3CD; border-color: #FCD34D; color: #D97706; }
    .cp-reset-btn:disabled { opacity: .5; cursor: default; }

    .cp-empty {
      display: flex; flex-direction: column; align-items: center; justify-content: center;
      padding: 28px 0; gap: 8px; color: #B0ABCC;
    }

    @keyframes cp-fadein { from{opacity:0;transform:translateY(2px)} to{opacity:1;transform:translateY(0)} }
    .cp-course-row { animation: cp-fadein 0.12s ease; }
  `
  document.head.appendChild(s)
}

// ── Shared helpers ────────────────────────────────────────────────────────────

function Skel({ w = '100%', h = 14, r = 7, style = {} }) {
  return (
    <div className="rm-skeleton" style={{ width: w, height: h, borderRadius: r, flexShrink: 0, ...style }} />
  )
}

async function parseError(err, action) {
  let title   = `Failed to ${action}`
  let message = 'An unexpected error occurred. Please try again.'
  let code    = null

  if (err instanceof Response || err?.status) {
    code = err.status ?? null
    const causeMap = {
      400: `Failed to ${action} — invalid data sent`,
      401: `Failed to ${action} — not authenticated`,
      403: `Failed to ${action} — access denied`,
      404: `Failed to ${action} — endpoint not found`,
      408: `Failed to ${action} — request timed out`,
      409: `Failed to ${action} — data conflict`,
      422: `Failed to ${action} — validation rejected`,
      429: `Failed to ${action} — too many requests`,
      500: `Failed to ${action} — backend error`,
      502: `Failed to ${action} — bad gateway`,
      503: `Failed to ${action} — server unavailable`,
      504: `Failed to ${action} — gateway timeout`,
    }
    title = causeMap[code] ?? `Failed to ${action} — server error (${code})`
    const detailMap = {
      400: 'The data submitted was rejected as invalid. Check your inputs and try again.',
      401: 'Your session may have expired. Please refresh the page and log in again.',
      403: 'You don\'t have the required permissions to perform this action.',
      404: 'The server endpoint could not be found. The API may have changed.',
      408: 'The server took too long to respond. Check your connection and retry.',
      409: 'This change conflicts with existing data on the server.',
      422: 'The server could not process the submitted values. Check for invalid fields.',
      429: 'You\'ve sent too many requests. Wait a moment, then try again.',
      500: 'An internal server error occurred on the backend. Try again shortly.',
      502: 'The server returned an invalid response. The service may be restarting.',
      503: 'The server is temporarily unavailable. Try again in a few moments.',
      504: 'The gateway did not receive a timely response from the backend.',
    }
    message = detailMap[code] ?? `The server responded with an unexpected status (${code}).`
    try {
      const body = await (err.json?.() ?? Promise.resolve(null))
      if (body?.detail)                                    message = body.detail
      else if (body?.message)                              message = body.message
      else if (typeof body === 'string' && body.length < 200) message = body
    } catch { /* ignore */ }
  } else if (err instanceof TypeError && err.message.includes('fetch')) {
    title   = `Failed to ${action} — no connection`
    message = 'Could not reach the server. Check your internet connection and try again.'
  } else if (err instanceof Error && err.message) {
    title   = `Failed to ${action} — unexpected error`
    message = err.message
  }
  return { title, message, code }
}

function ErrorBanner({ error, onDismiss }) {
  if (!error) return null
  return (
    <div style={{
      display: 'flex', alignItems: 'flex-start', gap: 10, marginBottom: 12,
      padding: '11px 14px', borderRadius: 10,
      background: '#FFF5F5', border: '1px solid #FECACA',
    }}>
      <div style={{
        width: 28, height: 28, borderRadius: 8, background: '#FEE2E2',
        display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0, marginTop: 1,
      }}>
        <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="#DC2626" strokeWidth="2.2">
          <circle cx="12" cy="12" r="10"/>
          <line x1="12" y1="8" x2="12" y2="12"/><line x1="12" y1="16" x2="12.01" y2="16"/>
        </svg>
      </div>
      <div style={{ flex: 1, minWidth: 0 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 7, marginBottom: 3 }}>
          <span style={{ fontSize: 12.5, fontWeight: 700, color: '#B91C1C' }}>{error.title}</span>
          {error.code && (
            <span style={{
              fontSize: 10, fontWeight: 700, padding: '1px 6px', borderRadius: 20,
              background: '#FEE2E2', color: '#DC2626', border: '1px solid #FECACA',
            }}>
              {error.code}
            </span>
          )}
        </div>
        <div style={{ fontSize: 12, color: '#C0392B', lineHeight: 1.5 }}>{error.message}</div>
      </div>
      {onDismiss && (
        <button onClick={onDismiss} style={{
          background: 'none', border: 'none', cursor: 'pointer',
          color: '#EF9999', padding: 2, flexShrink: 0, lineHeight: 0,
          borderRadius: 4, transition: 'color 0.13s',
        }}
          onMouseEnter={e => e.currentTarget.style.color = '#DC2626'}
          onMouseLeave={e => e.currentTarget.style.color = '#EF9999'}
          title="Dismiss"
        >
          <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
            <line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/>
          </svg>
        </button>
      )}
    </div>
  )
}

function SaveBtn({ saving, saved, onClick, disabled }) {
  return (
    <button className={`rm-save${saved?' saved':''}`} onClick={onClick} disabled={saving || disabled}>
      {saving ? (
        <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" style={{ animation:'spin-r .8s linear infinite' }}>
          <path d="M21 12a9 9 0 1 1-6.219-8.56"/>
        </svg>
      ) : saved ? (
        <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
          <polyline points="20 6 9 17 4 12"/>
        </svg>
      ) : (
        <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
          <path d="M19 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h11l5 5v11a2 2 0 0 1-2 2z"/>
          <polyline points="17 21 17 13 7 13 7 21"/>
          <polyline points="7 3 7 8 15 8"/>
        </svg>
      )}
      {saving ? 'Saving…' : saved ? 'Saved!' : 'Save'}
    </button>
  )
}

// ── Room list (drag-to-reorder) ───────────────────────────────────────────────

function RoomList({ rooms, setRooms, type, loading }) {
  const dragIdx = useRef(null)
  const [overIdx, setOverIdx] = useState(null)

  function onDragStart(i) { dragIdx.current = i }
  function onDragOver(e, i) { e.preventDefault(); setOverIdx(i) }
  function onDrop(e, i) {
    e.preventDefault()
    if (dragIdx.current === null || dragIdx.current === i) { setOverIdx(null); return }
    const next = [...rooms]
    const [moved] = next.splice(dragIdx.current, 1)
    next.splice(i, 0, moved)
    setRooms(next)
    dragIdx.current = null; setOverIdx(null)
  }
  function onDragEnd() { dragIdx.current = null; setOverIdx(null) }

  const ac = type === 'lec' ? '#7C6FCD' : '#D97706'
  const bg = type === 'lec' ? '#EDE9FB' : '#FEF3CD'

  if (loading) return (
    <div className="rooms-list">
      {[1, 2, 3].map(i => (
        <div key={i} className="room-row" style={{ padding: '6px 10px' }}>
          <Skel w={14} h={14} r={4} />
          <Skel w={18} h={18} r={5} />
          <Skel w={120} h={14} r={6} style={{ flex: 1, margin: '0 4px' }} />
          <Skel w={22} h={22} r={6} />
        </div>
      ))}
    </div>
  )

  if (rooms.length === 0) return (
    <div className="empty-room-state">
      <div style={{ width:24, height:24, borderRadius:6, background:bg, display:'flex', alignItems:'center', justifyContent:'center', flexShrink:0 }}>
        <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke={ac} strokeWidth="2.5">
          <line x1="12" y1="5" x2="12" y2="19"/><line x1="5" y1="12" x2="19" y2="12"/>
        </svg>
      </div>
      <span style={{ fontSize:11.5, color:'#B0ABCC' }}>No rooms yet — add one below.</span>
    </div>
  )

  return (
    <div className="rooms-list">
      {rooms.map((r, i) => (
        <div
          key={r}
          className={`room-row${overIdx === i ? ' drag-over' : ''}`}
          draggable
          onDragStart={() => onDragStart(i)}
          onDragOver={e => onDragOver(e, i)}
          onDrop={e => onDrop(e, i)}
          onDragEnd={onDragEnd}
        >
          <div className="drag-handle" title="Drag to reorder">
            <svg width="10" height="10" viewBox="0 0 24 24" fill="currentColor">
              <circle cx="9" cy="6" r="1.5"/><circle cx="15" cy="6" r="1.5"/>
              <circle cx="9" cy="12" r="1.5"/><circle cx="15" cy="12" r="1.5"/>
              <circle cx="9" cy="18" r="1.5"/><circle cx="15" cy="18" r="1.5"/>
            </svg>
          </div>
          <div className={`room-badge ${type}`}>{i + 1}</div>
          <span style={{ fontSize:12.5, fontWeight:500, color:'#2D2760', flex:1, overflow:'hidden', textOverflow:'ellipsis', whiteSpace:'nowrap' }}>
            {r}
          </span>
          {i === 0 && (
            <span style={{ fontSize:9.5, fontWeight:700, padding:'2px 6px', borderRadius:20, background:bg, color:ac, flexShrink:0 }}>
              Priority 1
            </span>
          )}
          <button
            className="room-del"
            title="Remove room"
            onClick={() => setRooms(rooms.filter(x => x !== r))}
          >
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round">
              <line x1="18" y1="6" x2="6" y2="18" />
              <line x1="6" y1="6" x2="18" y2="18" />
            </svg>
          </button>
        </div>
      ))}
    </div>
  )
}

function AddRow({ value, onChange, onAdd, placeholder, loading }) {
  return (
    <div style={{ display:'flex', gap:6 }}>
      {loading ? (
        <Skel w="100%" h={32} r={8} />
      ) : (
        <>
          <input
            className="room-add-input" value={value} onChange={e => onChange(e.target.value)}
            onKeyDown={e => e.key === 'Enter' && (e.preventDefault(), onAdd())}
            placeholder={placeholder}
          />
          <button className="rm-add-btn" onClick={onAdd}>
            <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
              <line x1="12" y1="5" x2="12" y2="19"/><line x1="5" y1="12" x2="19" y2="12"/>
            </svg>
            Add
          </button>
        </>
      )}
    </div>
  )
}

// ── Course Room Assignment Section ────────────────────────────────────────────

/**
 * RoomDropdown renders a <select> populated with all configured rooms.
 * lectureRooms and labRooms are string arrays from /settings/rooms.
 * value is the currently assigned room name, or "" for no preference.
 */
function RoomDropdown({ value, onChange, lectureRooms, labRooms }) {
  const assigned  = value || ''
  // Determine styling: which type is the assigned room?
  const isLec = lectureRooms.includes(assigned)
  const isLab = labRooms.includes(assigned)
  const cls   = assigned
    ? (isLab ? 'room-select is-assigned-lab' : 'room-select is-assigned')
    : 'room-select'

  return (
    <select
      className={cls}
      value={assigned}
      onChange={e => onChange(e.target.value || null)}
      title={assigned ? `Pinned to: ${assigned}` : 'No room preference — scheduler decides'}
    >
      <option value="">— No preference —</option>

      {lectureRooms.length > 0 && (
        <optgroup label="Lecture Rooms">
          {lectureRooms.map(r => (
            <option key={r} value={r}>{r}</option>
          ))}
        </optgroup>
      )}

      {labRooms.length > 0 && (
        <optgroup label="Lab Rooms">
          {labRooms.map(r => (
            <option key={r} value={r}>{r}</option>
          ))}
        </optgroup>
      )}

      {lectureRooms.length === 0 && labRooms.length === 0 && (
        <option disabled>No rooms configured yet</option>
      )}
    </select>
  )
}

function CourseRoomAssignmentSection({ onError }) {
  const [courses,     setCourses]     = useState([])
  const [lectureRooms, setLectureRooms] = useState([])
  const [labRooms,    setLabRooms]    = useState([])
  const [loading,     setLoading]     = useState(true)
  const [saving,      setSaving]      = useState(false)
  const [saved,       setSaved]       = useState(false)
  // assignments: { "CODE_PROG": "Room 407" | "" | null }
  const [assignments, setAssignments] = useState({})
  const [original,    setOriginal]    = useState({})
  const [search,      setSearch]      = useState('')
  const [progFilter,  setProgFilter]  = useState('All')

  // Load courses AND rooms in parallel on mount
  useEffect(() => {
    Promise.all([getCourses(), getRooms()])
      .then(([courseData, roomData]) => {
        setCourses(courseData)
        setLectureRooms(roomData.lecture || [])
        setLabRooms(roomData.lab || [])

        // Build initial assignment map from course.preferredRoom
        const init = {}
        courseData.forEach(c => {
          const key = `${c.courseCode}_${c.program}`
          init[key] = c.preferredRoom || ''
        })
        setAssignments(init)
        setOriginal(init)
      })
      .catch(async err => onError(await parseError(err, 'load room assignments')))
      .finally(() => setLoading(false))
  }, [])

  // Unique programs for filter pills
  const programs = useMemo(() => {
    const s = new Set(courses.map(c => c.program).filter(Boolean))
    return ['All', ...Array.from(s).sort()]
  }, [courses])

  // Filtered + searched courses
  const visible = useMemo(() => {
    const q = search.toLowerCase().trim()
    return courses.filter(c => {
      if (progFilter !== 'All' && c.program !== progFilter) return false
      if (q && !c.courseCode.toLowerCase().includes(q) && !c.title.toLowerCase().includes(q)) return false
      return true
    })
  }, [courses, search, progFilter])

  // Number of unsaved changes
  const dirtyKeys = useMemo(() =>
    Object.keys(assignments).filter(k => assignments[k] !== original[k]),
    [assignments, original]
  )

  function setAssignment(key, roomName) {
    setAssignments(prev => ({ ...prev, [key]: roomName || '' }))
    setSaved(false)
  }

  function resetDirty() {
    setAssignments({ ...original })
    setSaved(false)
  }

  async function handleSave() {
    if (dirtyKeys.length === 0) return
    setSaving(true)
    const toSave = {}
    dirtyKeys.forEach(k => { toSave[k] = assignments[k] || null })
    try {
      const { committed, failed } = await bulkSetPreferredRooms(toSave)
      if (failed.length > 0) {
        onError({
          title: 'Partial save failure',
          message: `${committed} course(s) saved, but ${failed.length} failed: ${failed.map(f => f.key).join(', ')}`,
          code: null,
        })
      } else {
        setOriginal(prev => ({ ...prev, ...toSave }))
        setSaved(true)
        setTimeout(() => setSaved(false), 2500)
      }
    } catch (err) {
      onError(await parseError(err, 'save room assignments'))
    } finally {
      setSaving(false)
    }
  }

  // ── Render ────────────────────────────────────────────────────────────────

  // Count how many courses have a room pinned
  const pinnedCount = Object.values(assignments).filter(Boolean).length

  return (
    <div className="card" style={{ padding: 0, overflow: 'hidden', marginTop: 14 }}>

      {/* Header */}
      <div className="room-card-head" style={{ gap: 10 }}>
        <div style={{ width:28, height:28, borderRadius:8, background:'linear-gradient(135deg,#EDE9FB 0%,#FEF3CD 100%)', display:'flex', alignItems:'center', justifyContent:'center', flexShrink:0 }}>
          <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="#7C6FCD" strokeWidth="2">
            <path d="M3 9l9-7 9 7v11a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z"/>
            <polyline points="9 22 9 12 15 12 15 22"/>
            <line x1="12" y1="1" x2="12" y2="5"/>
          </svg>
        </div>
        <div style={{ flex: 1 }}>
          <div style={{ fontSize:12.5, fontWeight:700, color:'#1a1a2e' }}>Course Room Assignment</div>
          <div style={{ fontSize:11, color:'#8883B0' }}>
            {loading
              ? <Skel w={200} h={11} style={{ marginTop:2 }} />
              : pinnedCount > 0
                ? `${pinnedCount} course${pinnedCount !== 1 ? 's' : ''} pinned to a specific room`
                : 'Pin courses to a specific room — scheduler will honour it'}
          </div>
        </div>

        {/* Dirty count badge + Save */}
        {!loading && (
          <div style={{ display:'flex', alignItems:'center', gap:8 }}>
            {dirtyKeys.length > 0 && (
              <span className="cp-dirty-badge" title={`${dirtyKeys.length} unsaved change${dirtyKeys.length !== 1 ? 's' : ''}`}>
                {dirtyKeys.length}
              </span>
            )}
            <SaveBtn
              saving={saving}
              saved={saved}
              onClick={handleSave}
              disabled={dirtyKeys.length === 0}
            />
          </div>
        )}
      </div>

      {/* Toolbar: search + program filter */}
      <div style={{ padding:'10px 14px', borderBottom:'1px solid #F0EDF9', display:'flex', flexDirection:'column', gap:8 }}>

        {/* Search */}
        <div style={{ position:'relative' }}>
          <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="#C0BBDC" strokeWidth="2.5"
            style={{ position:'absolute', left:11, top:'50%', transform:'translateY(-50%)', pointerEvents:'none' }}>
            <circle cx="11" cy="11" r="8"/><line x1="21" y1="21" x2="16.65" y2="16.65"/>
          </svg>
          {loading
            ? <Skel w="100%" h={34} r={9} />
            : (
              <input
                className="cp-search"
                placeholder="Search by course code or title…"
                value={search}
                onChange={e => setSearch(e.target.value)}
              />
            )
          }
        </div>

        {/* Program pills */}
        {!loading && programs.length > 1 && (
          <div style={{ display:'flex', gap:6, flexWrap:'wrap' }}>
            {programs.map(p => (
              <button
                key={p}
                className={`cp-prog-pill${progFilter === p ? ' active' : ''}`}
                onClick={() => setProgFilter(p)}
              >
                {p}
              </button>
            ))}
          </div>
        )}
        {loading && (
          <div style={{ display:'flex', gap:6 }}>
            {[80, 60, 70, 55].map((w, i) => <Skel key={i} w={w} h={26} r={20} />)}
          </div>
        )}
      </div>

      {/* Legend */}
      {!loading && (
        <div style={{
          display:'flex', gap:16, padding:'6px 14px',
          borderBottom:'1px solid #F5F3FD', background:'#FAFAFE',
        }}>
          {[
            { color:'#A09CC0', bg:'#F0EDF9', label:'No preference — scheduler decides' },
            { color:'#7C6FCD', bg:'#EDE9FB', label:'Pinned to a lecture room' },
            { color:'#D97706', bg:'#FEF3CD', label:'Pinned to a lab room' },
          ].map(({ color, bg, label }) => (
            <div key={label} style={{ display:'flex', alignItems:'center', gap:5 }}>
              <div style={{ width:8, height:8, borderRadius:3, background:bg, border:`1.5px solid ${color}`, flexShrink:0 }} />
              <span style={{ fontSize:10.5, color:'#8883B0' }}>{label}</span>
            </div>
          ))}
        </div>
      )}

      {/* Course list */}
      <div style={{ maxHeight: 420, overflowY: 'auto' }}>
        {loading ? (
          <div style={{ display:'flex', flexDirection:'column' }}>
            {[...Array(6)].map((_, i) => (
              <div key={i} style={{ display:'flex', alignItems:'center', gap:10, padding:'9px 14px', borderBottom:'1px solid #F5F3FD' }}>
                <Skel w={52} h={20} r={6} />
                <Skel w="40%" h={13} r={6} style={{ flex:1 }} />
                <Skel w={50} h={13} r={6} />
                <Skel w={160} h={28} r={8} />
              </div>
            ))}
          </div>
        ) : visible.length === 0 ? (
          <div className="cp-empty">
            <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="#D8D3F5" strokeWidth="1.5">
              <circle cx="11" cy="11" r="8"/><line x1="21" y1="21" x2="16.65" y2="16.65"/>
            </svg>
            <span style={{ fontSize:12, fontWeight:500 }}>No courses match your search</span>
            {(search || progFilter !== 'All') && (
              <button
                onClick={() => { setSearch(''); setProgFilter('All') }}
                style={{ fontSize:11, color:'#7C6FCD', background:'none', border:'none', cursor:'pointer', fontFamily:'Poppins,sans-serif', padding:0 }}
              >
                Clear filters
              </button>
            )}
          </div>
        ) : (
          visible.map(course => {
            const key        = `${course.courseCode}_${course.program}`
            const roomValue  = assignments[key] || ''
            const isDirty    = assignments[key] !== original[key]
            const isLab      = labRooms.includes(roomValue)

            // Row accent based on assigned room type
            const rowBorderColor = roomValue
              ? (isLab ? '#FCD34D' : '#A99BE8')
              : 'transparent'

            return (
              <div
                key={key}
                className="cp-course-row"
                style={{ borderLeft: `3px solid ${rowBorderColor}` }}
              >
                {/* Code badge */}
                <div style={{
                  padding:'3px 8px', borderRadius:6,
                  background: roomValue ? (isLab ? '#FFFBEB' : '#F0EDF9') : '#F5F3FD',
                  border:`1px solid ${roomValue ? (isLab ? '#FCD34D' : '#D8D3F5') : '#E8E4F8'}`,
                  flexShrink: 0, minWidth: 60, textAlign:'center',
                }}>
                  <span style={{ fontSize:10.5, fontWeight:700, color: isLab ? '#B45309' : '#5B50A8', letterSpacing:'0.02em' }}>
                    {course.courseCode}
                  </span>
                </div>

                {/* Title + meta */}
                <div style={{ flex:1, minWidth:0 }}>
                  <div style={{ fontSize:12, fontWeight:600, color:'#1a1a2e', overflow:'hidden', textOverflow:'ellipsis', whiteSpace:'nowrap' }}>
                    {course.title}
                  </div>
                  <div style={{ fontSize:10.5, color:'#A09CC0', marginTop:1, display:'flex', gap:6 }}>
                    <span>{course.program}</span>
                    <span>·</span>
                    <span>Yr {course.yearLevel}</span>
                    {course.unitsLecture > 0 && <span>· {course.unitsLecture}u Lec</span>}
                    {course.unitsLab > 0      && <span>· {course.unitsLab}u Lab</span>}
                  </div>
                </div>

                {/* Dirty indicator dot */}
                {isDirty && (
                  <div style={{
                    width:6, height:6, borderRadius:'50%', background:'#7C6FCD', flexShrink:0,
                  }} title="Unsaved change" />
                )}

                {/* Room dropdown */}
                <RoomDropdown
                  value={roomValue}
                  onChange={val => setAssignment(key, val)}
                  lectureRooms={lectureRooms}
                  labRooms={labRooms}
                />
              </div>
            )
          })
        )}
      </div>

      {/* Bottom save bar (shows only when there are dirty changes) */}
      {!loading && dirtyKeys.length > 0 && (
        <div className="cp-save-bar">
          <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="#7C6FCD" strokeWidth="2.2">
            <circle cx="12" cy="12" r="10"/>
            <line x1="12" y1="8" x2="12" y2="12"/><line x1="12" y1="16" x2="12.01" y2="16"/>
          </svg>
          <span style={{ fontSize:11.5, color:'#6B66A0', flex:1 }}>
            <strong style={{ color:'#7C6FCD' }}>{dirtyKeys.length}</strong> unsaved change{dirtyKeys.length !== 1 ? 's' : ''}
          </span>
          <button className="cp-reset-btn" onClick={resetDirty} disabled={saving}>
            Discard
          </button>
          <SaveBtn saving={saving} saved={saved} onClick={handleSave} disabled={false} />
        </div>
      )}
    </div>
  )
}

// ── Main Page ─────────────────────────────────────────────────────────────────

export default function RoomsPage() {
  const [loading, setLoading] = useState(true)
  const [lecture, setLecture] = useState([])
  const [lab,     setLab]     = useState([])
  const [newLec,  setNewLec]  = useState('')
  const [newLab,  setNewLab]  = useState('')
  const [saving,  setSaving]  = useState(false)
  const [saved,   setSaved]   = useState(false)
  const [error,   setError]   = useState(null)

  useEffect(() => {
    getRooms()
      .then(r => { setLecture(r.lecture || []); setLab(r.lab || []) })
      .catch(async (err) => setError(await parseError(err, 'load rooms')))
      .finally(() => setLoading(false))
  }, [])

  function addLecture() {
    const v = newLec.trim(); if (!v) return
    if (lecture.includes(v)) { setError({ title: 'Duplicate Room', message: `"${v}" already exists in Lecture Rooms.` }); return }
    setLecture(l => [...l, v]); setNewLec(''); setError(null); setSaved(false)
  }
  function addLab() {
    const v = newLab.trim(); if (!v) return
    if (lab.includes(v)) { setError({ title: 'Duplicate Room', message: `"${v}" already exists in Lab Rooms.` }); return }
    setLab(l => [...l, v]); setNewLab(''); setError(null); setSaved(false)
  }

  async function handleSave() {
    setSaving(true); setError(null)
    try { await saveRooms({ lecture, lab }); setSaved(true); setTimeout(() => setSaved(false), 2500) }
    catch (err) { setError(await parseError(err, 'save rooms')) }
    finally { setSaving(false) }
  }

  return (
    <div className="page">
      {error && (
        <ErrorBanner error={error} onDismiss={() => setError(null)} />
      )}

      {/* ── Top row: Lecture + Lab room lists ── */}
      <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr', gap:14, alignItems:'start' }}>

        {/* Lecture */}
        <div className="card" style={{ padding:0, overflow:'hidden' }}>
          <div className="room-card-head">
            <div style={{ width:28, height:28, borderRadius:8, background:'#EDE9FB', display:'flex', alignItems:'center', justifyContent:'center', flexShrink:0 }}>
              <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="#7C6FCD" strokeWidth="2">
                <path d="M3 9l9-7 9 7v11a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z"/>
                <polyline points="9 22 9 12 15 12 15 22"/>
              </svg>
            </div>
            <div style={{ flex:1 }}>
              <div style={{ fontSize:12.5, fontWeight:700, color:'#1a1a2e' }}>Lecture Rooms</div>
              <div style={{ fontSize:11, color:'#8883B0' }}>
                {loading ? <Skel w={100} h={11} style={{ marginTop: 2 }} /> : `${lecture.length} room${lecture.length!==1?'s':''} configured`}
              </div>
            </div>
            {loading ? <Skel w={65} h={28} r={8} /> : <SaveBtn saving={saving} saved={saved} onClick={handleSave} />}
          </div>
          <div style={{ padding:'12px 14px' }}>
            <RoomList rooms={lecture} setRooms={r => { setLecture(r); setSaved(false) }} type="lec" loading={loading} />
            <AddRow value={newLec} onChange={setNewLec} onAdd={addLecture} placeholder="e.g. Room 101" loading={loading} />
          </div>
        </div>

        {/* Lab */}
        <div className="card" style={{ padding:0, overflow:'hidden' }}>
          <div className="room-card-head">
            <div style={{ width:28, height:28, borderRadius:8, background:'#FEF3CD', display:'flex', alignItems:'center', justifyContent:'center', flexShrink:0 }}>
              <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="#D97706" strokeWidth="2">
                <path d="M9 3H5a2 2 0 0 0-2 2v4m6-6h10a2 2 0 0 1 2 2v4M9 3v18m0 0h10a2 2 0 0 0 2-2V9M9 21H5a2 2 0 0 1-2-2V9m0 0h18"/>
              </svg>
            </div>
            <div style={{ flex:1 }}>
              <div style={{ fontSize:12.5, fontWeight:700, color:'#1a1a2e' }}>Lab Rooms</div>
              <div style={{ fontSize:11, color:'#8883B0' }}>
                {loading ? <Skel w={100} h={11} style={{ marginTop: 2 }} /> : `${lab.length} room${lab.length!==1?'s':''} configured`}
              </div>
            </div>
            {loading ? <Skel w={65} h={28} r={8} /> : <SaveBtn saving={saving} saved={saved} onClick={handleSave} />}
          </div>
          <div style={{ padding:'12px 14px' }}>
            <RoomList rooms={lab} setRooms={r => { setLab(r); setSaved(false) }} type="lab" loading={loading} />
            <AddRow value={newLab} onChange={setNewLab} onAdd={addLab} placeholder="e.g. ICT Lab 1" loading={loading} />
          </div>
        </div>

      </div>

      {/* ── Course Room Assignment section ── */}
      <CourseRoomAssignmentSection onError={setError} />
    </div>
  )
}