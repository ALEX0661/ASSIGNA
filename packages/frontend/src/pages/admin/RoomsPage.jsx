import { useEffect, useRef, useState } from 'react'
import { getRooms, saveRooms } from '../../services/api'

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

    /* Remove button — always visible but subtle, more visible on row hover */
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

    /* Shared save button */
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

    /* Add btn */
    .rm-add-btn {
      padding: 6px 12px; border-radius: 8px; border: 1.5px solid #E8E4F8;
      font-family: 'Poppins,sans-serif'; font-size: 11.5px; font-weight: 600;
      cursor: pointer; background: #fff; color: #7C6FCD;
      display: inline-flex; align-items: center; gap: 4px; transition: all 0.13s; flex-shrink: 0;
    }
    .rm-add-btn:hover { background: #EEEAFB; border-color: #C5BBEF; }

    @keyframes slideInR { from{opacity:0;transform:translateY(-3px)} to{opacity:1;transform:translateY(0)} }
    @keyframes spin-r { to{transform:rotate(360deg)} }

    /* Skeleton Animations */
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
  `
  document.head.appendChild(s)
}

function Skel({ w = '100%', h = 14, r = 7, style = {} }) {
  return (
    <div className="rm-skeleton" style={{ width: w, height: h, borderRadius: r, flexShrink: 0, ...style }} />
  )
}

/** Extract a structured error object from any thrown value.
 *  `action` = short verb phrase, e.g. "save rooms" or "load rooms"
 */
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
    } catch { /* ignore parse errors */ }

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

function SaveBtn({ saving, saved, onClick }) {
  return (
    <button className={`rm-save${saved?' saved':''}`} onClick={onClick} disabled={saving}>
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

export default function RoomsPage() {
  const [loading, setLoading] = useState(true) // <-- Added loading state
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
    </div>
  )
}