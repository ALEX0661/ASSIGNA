import { useState, useEffect, useMemo, useCallback, useRef } from 'react'
import { useAuth } from '../../hooks/useAuth'
import {
  coordGetRooms, coordSelectRooms, coordGetSelectedRooms,
  coordGetCourses, setCoursePreferredRoom
} from '../../services/api'
import { useTour } from '../../hooks/useTour.jsx'

const TOUR_SEEN_KEY = 'coordRooms_tourSeen'
function isOnboardingCompleted() {
  try { return localStorage.getItem(TOUR_SEEN_KEY) === '1' } catch { return true }
}
function markOnboardingCompleted() {
  try { localStorage.setItem(TOUR_SEEN_KEY, '1') } catch {}
}

import iconLab from '../../assets/LABROOM.png'
import iconLec from '../../assets/LECROOM.png'
import iconAssign from '../../assets/ASSIGMENT.png'

/* ── Design tokens (Unified) ── */
const G = {
  meadow: 'var(--meadow, var(--meadow))',
  meadowDeep:   'var(--meadow-deep)',
  meadowMid:    'var(--meadow-mid)',
  meadowSoft:   'var(--meadow-soft)',
  meadowBorder: 'var(--meadow-border)',
  ink: 'var(--ink, #0E2A20)',
  inkMid:       '#1C3D2A',
  muted: 'var(--muted, #4B7060)',
  muted2: 'var(--muted2, #6B8C7A)',
  border:       'var(--border)',
  borderLight:  'var(--hover)',
  bg: 'var(--bg, #F2F7F4)',
  surface: 'var(--surface, #FFFFFF)',
  hover:        'var(--hover)',
}

/* ─── Styles ─────────────────────────────────────────────────────────────── */
if (!document.getElementById('coord-rooms-style')) {
  const s = document.createElement('style')
  s.id = 'coord-rooms-style'
  s.textContent = `
    @import url('https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700;800&display=swap');

    @keyframes fadeIn { from{opacity:0} to{opacity:1} }
    @keyframes slideUp { from{opacity:0;transform:translateY(15px) scale(0.98)} to{opacity:1;transform:translateY(0) scale(1)} }
    @keyframes spin-r { to{transform:rotate(360deg)} }
    @keyframes cpToastIn { from{opacity:0;transform:scale(.96) translateY(12px)} to{opacity:1;transform:scale(1) translateY(0)} }
    @keyframes rmShimmer { 0% { background-position: -400px 0 } 100% { background-position:  400px 0 } }

    .rm-skeleton {
      background: linear-gradient(90deg, ${G.hover} 25%, ${G.borderLight} 50%, ${G.hover} 75%);
      background-size: 800px 100%;
      animation: rmShimmer 1.4s ease-in-out infinite;
      border-radius: 6px;
    }

    /* Toasts */
    .cp-toast-wrap { position:fixed;bottom:20px;left:50%;z-index:9999;display:flex;flex-direction:column;gap:8px;align-items:center;pointer-events:none;transform:translateX(-50%); }
    .cp-toast { display:flex;align-items:center;gap:8px;padding:12px 20px;border-radius:12px;font-family:'Inter',sans-serif;font-size:13px;font-weight:600;animation:cpToastIn .2s cubic-bezier(.4,0,.2,1);white-space:nowrap;pointer-events:auto; box-shadow: 0 8px 24px rgba(0,0,0,0.15); }
    .cp-toast.success { background:${G.meadow};color:#fff;border:1px solid ${G.meadowDeep}; }
    .cp-toast.error   { background: var(--surface);color:#DC2626;border:1px solid #FECACA; }
    .cp-toast.info    { background: var(--surface);color:${G.meadowDeep};border:1px solid ${G.meadowBorder}; }

    /* Compact Layout Cards */
    .room-card { background: var(--surface); border-radius: 12px; border: 1px solid ${G.border}; overflow: hidden; box-shadow: 0 4px 12px rgba(0,0,0,0.04); display: flex; flex-direction: column; }
    .room-card-head { display: flex; align-items: center; gap: 14px; padding: 16px 20px; border-bottom: 1px solid ${G.border}; background: ${G.surface}; flex-wrap: wrap; }

    /* Room Chips */
    .chip-container { display: flex; flex-wrap: wrap; gap: 8px; align-items: center; }
    .room-chip { 
      display: inline-flex; align-items: center; gap: 6px; 
      padding: 5px 8px 5px 10px; border-radius: 8px; 
      border: 1px solid ${G.meadowBorder}; background: ${G.meadowSoft}; 
      font-size: 12.5px; font-weight: 700; color: ${G.meadowDeep};
      cursor: pointer; transition: all 0.15s; box-shadow: 0 1px 3px rgba(0,0,0,0.05);
    }
    .room-chip:hover { border-color: ${G.meadow}; box-shadow: 0 3px 8px rgba(0,0,0,0.15); transform: translateY(-1px); }
    .room-chip.unselected { background: var(--surface);color:${G.muted};border-color:${G.border};opacity:0.65; box-shadow:none; }
    .room-chip.unselected:hover { opacity:1;border-color:${G.meadowBorder};color:${G.meadowDeep}; }
    .room-chip-idx { font-size: 10px; font-weight: 800; color: #fff; background: ${G.meadow}; padding: 2px 6px; border-radius: 4px; }

    /* Buttons */
    .btn-outline { display: inline-flex; align-items: center; gap: 6px; padding: 7px 14px; border-radius: 8px; border: 1px solid ${G.border}; font-family: 'Inter', sans-serif; font-size: 12px; font-weight: 600; cursor: pointer; background: var(--surface); color: ${G.muted}; transition: all 0.13s; flex-shrink: 0; }
    .btn-outline:hover:not(:disabled) { background: ${G.hover}; color: ${G.ink}; border-color: ${G.meadowBorder}; }
    .btn-outline:disabled { opacity: .6; cursor: default; }

    .btn-primary { display: inline-flex; align-items: center; gap: 6px; padding: 7px 16px; border-radius: 8px; border: none; font-family: 'Inter',sans-serif; font-size: 12px; font-weight: 600; cursor: pointer; transition: all .15s; background: ${G.meadow}; color: #fff; box-shadow: 0 3px 10px rgba(0,0,0,0.25); }
    .btn-primary:hover:not(:disabled) { background: ${G.meadowDeep}; box-shadow: 0 5px 15px rgba(0,0,0,0.35); transform: translateY(-1px); }
    .btn-primary:disabled { opacity: .6; cursor: default; }

    /* Compact Data Table */
    .cp-search { flex: 1; padding: 8px 14px 8px 36px; border-radius: 8px; border: 1px solid ${G.border}; font-family: 'Inter', sans-serif; font-size: 13px; color: ${G.ink}; background: var(--surface); outline: none; transition: all 0.15s; box-shadow: 0 1px 3px rgba(0,0,0,0.02); }
    .cp-search:focus { border-color: ${G.meadow}; box-shadow: 0 0 0 2px rgba(0,0,0,0.1); }
    
    .cp-tr-hover:hover td { background: ${G.hover}; }

    /* Tab Styles */
    .room-tabs { display: flex; gap: 4px; background: ${G.hover}; padding: 4px; border-radius: 9px; border: 1px solid ${G.border}; width: fit-content; }
    .room-tab { padding: 5px 14px; border-radius: 7px; font-size: 12px; font-weight: 600; cursor: pointer; transition: all 0.15s; border: none; background: transparent; color: ${G.muted}; font-family: 'Inter', sans-serif; }
    .room-tab.active { background: var(--surface); color: ${G.ink}; box-shadow: 0 2px 4px rgba(0,0,0,0.05); }

    /* Modal Styles */
    .rm-modal-overlay { position: fixed; inset: 0; background: rgba(14,42,32,0.6); backdrop-filter: blur(4px); z-index: 1000; display: flex; align-items: center; justify-content: center; padding: 20px; animation: fadeIn 0.2s ease-out; }
    .rm-modal-box { background: var(--surface); border-radius: 16px; width: 100%; max-width: 540px; box-shadow: 0 24px 48px rgba(0,0,0,0.25); overflow: hidden; display: flex; flex-direction: column; max-height: 85vh; animation: slideUp 0.3s cubic-bezier(0.16, 1, 0.3, 1); }
    .rm-modal-head { padding: 20px 24px; border-bottom: 1px solid ${G.border}; display: flex; align-items: center; justify-content: space-between; background: var(--surface); }
    .rm-modal-body { padding: 24px; overflow-y: auto; flex: 1; display: flex; flex-direction: column; gap: 24px; background: ${G.bg}; }
    .rm-modal-foot { padding: 16px 24px; border-top: 1px solid ${G.border}; display: flex; justify-content: flex-end; gap: 10px; background: var(--surface); }

    .modal-close-btn { 
      display: inline-flex; align-items: center; justify-content: center; 
      width: 32px; height: 32px; border-radius: 8px; 
      border: 1.5px solid ${G.meadowBorder}; cursor: pointer; 
      background: ${G.meadowSoft}; color: ${G.meadowDeep}; transition: all 0.2s; flex-shrink: 0; 
      padding: 0; 
    }
    .modal-close-btn:hover { background: #FFE8E8; border-color: #FECACA; color: #DC2626; }

    /* Modal Selectable Cards */
    .modal-room-card { display: flex; align-items: center; justify-content: space-between; padding: 12px 16px; background: var(--surface); border: 1.5px solid ${G.border}; border-radius: 10px; cursor: pointer; transition: all 0.15s; color: ${G.ink}; box-shadow: 0 1px 2px rgba(0,0,0,0.02); }
    .modal-room-card:hover { border-color: ${G.meadowBorder}; background: ${G.surface}; transform: translateY(-1px); box-shadow: 0 4px 8px rgba(0,0,0,0.08); }
    .modal-room-card.selected { border-color: ${G.meadow}; background: ${G.meadowSoft}; color: ${G.meadowDeep}; box-shadow: 0 2px 8px rgba(0,0,0,0.15); }
    .modal-room-card-inner { display: flex; align-items: center; gap: 12px; }

    /* Green Room Pills for Table */
    .assign-trigger { display: inline-flex; align-items: center; gap: 6px; padding: 5px 10px; border-radius: 7px; font-size: 11.5px; font-weight: 600; background: var(--surface); color: ${G.meadowDeep}; border: 1px dashed ${G.meadow}; cursor: pointer; transition: all 0.15s; }
    .assign-trigger:hover { background: ${G.meadowSoft}; border-style: solid; }
    
    .assigned-pill { display: inline-flex; align-items: center; gap: 5px; padding: 4px 8px; border-radius: 6px; font-size: 11px; font-weight: 700; background: ${G.meadowSoft}; color: ${G.meadowDeep}; border: 1px solid ${G.meadowBorder}; }
  `
  document.head.appendChild(s)
}

/* ── Shared Helpers ──────────────────────────────────────────────────────────── */

function Skel({ w = '100%', h = 14, r = 6, style = {} }) {
  return <div className="rm-skeleton" style={{ width: w, height: h, borderRadius: r, flexShrink: 0, ...style }} />
}

function useToast() {
  const [toasts, setToasts] = useState([])
  const toast = useCallback((message, type = 'info', duration = 3000) => {
    const id = Date.now() + Math.random()
    setToasts(prev => [...prev, { id, message, type }])
    setTimeout(() => setToasts(prev => prev.filter(t => t.id !== id)), duration)
  }, [])
  return { toasts, toast }
}

function ToastContainer({ toasts }) {
  const icons = {
    success: <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"><polyline points="20 6 9 17 4 12"/></svg>,
    error:   <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"><circle cx="12" cy="12" r="10"/><line x1="12" y1="8" x2="12" y2="12"/></svg>,
    info:    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"><circle cx="12" cy="12" r="10"/><path d="M12 8v4"/></svg>,
  }
  return (
    <div className="cp-toast-wrap">
      {toasts.map(t => <div key={t.id} className={`cp-toast ${t.type}`}>{icons[t.type]}{t.message}</div>)}
    </div>
  )
}

function Checkbox({ checked, indeterminate, onChange }) {
  const active = checked || indeterminate
  return (
    <span onClick={onChange} style={{
      width: 18, height: 18, borderRadius: 5, flexShrink: 0,
      border: `1.5px solid ${active ? G.meadow : G.muted2}`,
      background: active ? G.meadow : 'var(--surface)',
      display: 'inline-flex', alignItems: 'center', justifyContent: 'center',
      transition: 'all 0.15s', cursor: 'pointer',
    }}>
      {indeterminate && !checked && <svg width="10" height="2" viewBox="0 0 8 2" fill="none"><rect width="8" height="2" rx="1" fill="#fff"/></svg>}
      {checked && <svg width="12" height="10" viewBox="0 0 10 8" fill="none"><polyline points="1.5,4 4,6.5 8.5,1.5" stroke="#fff" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"/></svg>}
    </span>
  )
}

/* ── Modal Component ─────────────────────────────────────────────────────── */

function RoomAssignModal({ isOpen, onClose, onSave, title, initialRooms = [], lectureRooms = [], labRooms = [] }) {
  const [selected, setSelected] = useState([])

  useEffect(() => {
    if (isOpen) setSelected([...initialRooms])
  }, [isOpen, initialRooms])

  if (!isOpen) return null

  const toggle = (r) => {
    if (selected.includes(r)) setSelected(selected.filter(x => x !== r))
    else setSelected([...selected, r])
  }

  return (
    <div className="rm-modal-overlay" onMouseDown={onClose}>
      <div className="rm-modal-box" onMouseDown={e => e.stopPropagation()}>
        <div className="rm-modal-head">
          <div>
            <div style={{ fontSize: 18, fontWeight: 800, color: G.ink, fontFamily: "'Inter', sans-serif" }}>Assign Rooms</div>
            <div style={{ fontSize: 13, color: G.muted, marginTop: 4, fontWeight: 500 }}>{title}</div>
          </div>
          <button className="modal-close-btn" onClick={onClose} aria-label="Close">
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round">
              <line x1="18" y1="6" x2="6" y2="18" />
              <line x1="6" y1="6" x2="18" y2="18" />
            </svg>
          </button>
        </div>
        
        <div className="rm-modal-body">
          <div style={{ background: 'var(--surface)', padding: '16px', borderRadius: 12, border: `1px solid ${G.border}`, boxShadow: '0 2px 4px rgba(0,0,0,0.02)' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 10 }}>
              <span style={{ fontSize: 11.5, fontWeight: 700, color: G.muted2, textTransform: 'uppercase', letterSpacing: '0.5px' }}>Selected Rooms ({selected.length})</span>
              {selected.length > 0 && (
                <button onClick={() => setSelected([])} style={{ background: 'none', border: 'none', color: '#EF4444', fontSize: 11.5, fontWeight: 600, cursor: 'pointer' }}>Clear All</button>
              )}
            </div>
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8 }}>
              {selected.length === 0 && <span style={{ fontSize: 13, color: G.muted, fontStyle: 'italic' }}>No rooms assigned to this pool yet.</span>}
              {selected.map(r => (
                <span key={r} className="assigned-pill" style={{ padding: '6px 10px', fontSize: 12 }}>
                  {r} 
                  <svg onClick={() => toggle(r)} style={{ cursor: 'pointer', marginLeft: 4, opacity: 0.7 }} width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg>
                </span>
              ))}
            </div>
          </div>

          <div style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>
            {lectureRooms.length > 0 && (
              <div>
                <div style={{ fontSize: 12, fontWeight: 700, color: G.muted2, textTransform: 'uppercase', marginBottom: 10, letterSpacing: '0.5px' }}>Lecture Rooms</div>
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10 }}>
                  {lectureRooms.map(r => {
                    const isSel = selected.includes(r);
                    return (
                      <div key={r} className={`modal-room-card ${isSel ? 'selected' : ''}`} onClick={() => toggle(r)}>
                        <div className="modal-room-card-inner">
                          <Checkbox checked={isSel} onChange={() => {}} /> 
                          <span style={{ fontSize: 14, fontWeight: 700 }}>{r}</span>
                        </div>
                      </div>
                    )
                  })}
                </div>
              </div>
            )}
            
            {labRooms.length > 0 && (
              <div>
                <div style={{ fontSize: 12, fontWeight: 700, color: G.muted2, textTransform: 'uppercase', marginBottom: 10, letterSpacing: '0.5px' }}>Lab Rooms</div>
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10 }}>
                  {labRooms.map(r => {
                    const isSel = selected.includes(r);
                    return (
                      <div key={r} className={`modal-room-card ${isSel ? 'selected' : ''}`} onClick={() => toggle(r)}>
                        <div className="modal-room-card-inner">
                          <Checkbox checked={isSel} onChange={() => {}} /> 
                          <span style={{ fontSize: 14, fontWeight: 700 }}>{r}</span>
                        </div>
                      </div>
                    )
                  })}
                </div>
              </div>
            )}

            {lectureRooms.length === 0 && labRooms.length === 0 && (
              <div style={{ fontSize: 13, color: G.muted, textAlign: 'center', padding: '30px', background: 'var(--surface)', borderRadius: 12, border: `1px dashed ${G.border}` }}>
                No rooms selected for this program yet. Choose some in the section above first.
              </div>
            )}
          </div>
        </div>

        <div className="rm-modal-foot">
          <button className="btn-outline" onClick={onClose} style={{ padding: '8px 16px', fontSize: 13 }}>Cancel</button>
          <button className="btn-primary" onClick={() => { onSave(selected); onClose(); }} style={{ padding: '8px 20px', fontSize: 13 }}>
            Confirm Selection
          </button>
        </div>
      </div>
    </div>
  )
}

/* ── Main Page ───────────────────────────────────────────────────────────────── */

export default function CoordRoomsPage() {
  const { coordinatorProgram } = useAuth()
  const { toasts, toast } = useToast()
  
  const [loading, setLoading] = useState(true)
  const [allRooms, setAllRooms] = useState({ lecture: [], lab: [] })
  
  const [courses, setCourses] = useState([])
  const [assignments, setAssignments] = useState({})
  const [origAssign, setOrigAssign] = useState({})
  
  // Room Config State
  const [activeTab, setActiveTab] = useState('lec')
  const [savingRooms, setSavingRooms] = useState(false)
  const [selectedRooms, setSelectedRooms] = useState({ lecture: [], lab: [] })
  const [originalRooms, setOriginalRooms] = useState({ lecture: [], lab: [] })
  
  // Table State
  const [savingAssigns, setSavingAssigns] = useState(false)
  const [search, setSearch] = useState('')
  const [statusFilter, setStatusFilter] = useState('All')
  const [selectedCourses, setSelectedCourses] = useState(new Set())

  // Modal State
  const [modalState, setModalState] = useState({ isOpen: false, targetKey: null, rooms: [], title: '' })

  const { TourElement, startTour } = useTour('coordRooms', [
    { 
      target: '.room-card-head', 
      title: 'Select Program Rooms',
      content: 'First, choose which rooms in the campus are available for your program to use. This narrows down the master list to just your spaces.',
      placement: 'bottom'
    },
    { 
      target: '#tour-assign-section .room-card-head', 
      title: 'Assign Rooms to Courses',
      content: 'Then, assign specific room pools to your courses (like a designated lab for a coding class) so the automated scheduler knows where to place them.',
      placement: 'bottom'
    },
  ], !loading)

  

  // Load Data
  useEffect(() => {
    Promise.all([
      coordGetRooms().catch(() => ({ lecture: [], lab: [] })),
      coordGetSelectedRooms().catch(() => ({ lecture: [], lab: [] })),
      coordGetCourses().catch(() => []),
    ]).then(([all, sel, crs]) => {
      setAllRooms(all || { lecture: [], lab: [] })
      
      const selNorm = { lecture: sel?.lecture || [], lab: sel?.lab || [] }
      setSelectedRooms(selNorm)
      setOriginalRooms({ lecture: [...selNorm.lecture], lab: [...selNorm.lab] })
      
      const crsArr = Array.isArray(crs) ? crs : []
      setCourses(crsArr)
      
      const init = {}
      crsArr.forEach(c => {
        init[c.courseCode] = c.preferredRoom 
          ? c.preferredRoom.split(',').map(s => s.trim()).filter(Boolean) 
          : []
      })
      setAssignments(init)
      setOrigAssign(init)
    }).catch(() => toast('Failed to load room data. Please refresh.', 'error'))
      .finally(() => setLoading(false))
  }, [toast])

  /* ── Room Handlers ── */
  const tabRooms = activeTab === 'lec' ? allRooms.lecture : allRooms.lab
  const tabSelected = activeTab === 'lec' ? selectedRooms.lecture : selectedRooms.lab

  function toggleRoom(r) {
    const key = activeTab === 'lec' ? 'lecture' : 'lab'
    setSelectedRooms(prev => {
      const cur = prev[key] || []
      const next = cur.includes(r) ? cur.filter(x => x !== r) : [...cur, r]
      return { ...prev, [key]: next }
    })
  }

  function selectAll() {
    const key = activeTab === 'lec' ? 'lecture' : 'lab'
    setSelectedRooms(prev => ({ ...prev, [key]: [...tabRooms] }))
  }

  function deselectAll() {
    const key = activeTab === 'lec' ? 'lecture' : 'lab'
    setSelectedRooms(prev => ({ ...prev, [key]: [] }))
  }

  const roomsDirty = useMemo(() => {
    return selectedRooms.lecture.join(',') !== originalRooms.lecture.join(',') || 
           selectedRooms.lab.join(',') !== originalRooms.lab.join(',')
  }, [selectedRooms, originalRooms])

  function discardRooms() {
    setSelectedRooms({ lecture: [...originalRooms.lecture], lab: [...originalRooms.lab] })
  }

  async function handleSaveRooms() {
    setSavingRooms(true)
    try { 
      await coordSelectRooms({ lecture: selectedRooms.lecture, lab: selectedRooms.lab })
      setOriginalRooms({ lecture: [...selectedRooms.lecture], lab: [...selectedRooms.lab] })
      toast('Rooms saved successfully', 'success')
    }
    catch (err) { toast('Failed to save rooms.', 'error') }
    finally { setSavingRooms(false) }
  }

  /* ── Assignment Handlers ── */
  const dirtyKeys = useMemo(() => Object.keys(assignments).filter(k => assignments[k].join(',') !== (origAssign[k] || []).join(',')), [assignments, origAssign])

  const visibleCourses = useMemo(() => {
    const q = search.toLowerCase().trim()
    return courses.filter(c => {
      const isAssigned = assignments[c.courseCode]?.length > 0
      
      if (statusFilter === 'Assigned' && !isAssigned) return false
      if (statusFilter === 'Unassigned' && isAssigned) return false
      if (q && !c.courseCode.toLowerCase().includes(q) && !(c.courseTitle || c.title || '').toLowerCase().includes(q)) return false
      return true
    })
  }, [courses, search, statusFilter, assignments])

  const visibleKeys = visibleCourses.map(c => c.courseCode)
  const allSel = visibleKeys.length > 0 && visibleKeys.every(k => selectedCourses.has(k))
  const someSel = visibleKeys.some(k => selectedCourses.has(k)) && !allSel

  const togAll = () => allSel 
    ? setSelectedCourses(p => { const n = new Set(p); visibleKeys.forEach(k => n.delete(k)); return n })
    : setSelectedCourses(p => { const n = new Set(p); visibleKeys.forEach(k => n.add(k)); return n })
  const togOne = k => setSelectedCourses(p => { const n = new Set(p); n.has(k) ? n.delete(k) : n.add(k); return n })

  // Modal Openers
  const openSingleModal = (key, title, currentRooms) => {
    setModalState({ isOpen: true, targetKey: key, title, rooms: currentRooms })
  }

  const openBulkModal = () => {
    setModalState({ isOpen: true, targetKey: 'BULK', title: `Bulk assign for ${selectedCourses.size} courses`, rooms: [] })
  }

  const handleModalSave = (selectedModalRooms) => {
    if (modalState.targetKey === 'BULK') {
      setAssignments(prev => {
        const next = { ...prev }
        selectedCourses.forEach(k => next[k] = selectedModalRooms)
        return next
      })
      setSelectedCourses(new Set())
      toast(`Updated assignments for ${selectedCourses.size} courses`, 'success')
    } else {
      setAssignments(prev => ({ ...prev, [modalState.targetKey]: selectedModalRooms }))
    }
  }

  function resetDirty() {
    setAssignments({ ...origAssign })
  }

  async function handleSaveAssignments() {
    if (dirtyKeys.length === 0) return
    setSavingAssigns(true)
    
    try {
      await Promise.all(dirtyKeys.map(k => 
        setCoursePreferredRoom(k, coordinatorProgram, assignments[k].join(', ') || null)
      ))
      setOrigAssign(prev => ({ ...prev, ...assignments })) 
      toast('Assignments updated successfully', 'success')
    } catch (err) {
      toast('Failed to save room assignments', 'error')
    } finally {
      setSavingAssigns(false)
    }
  }

  return (
    <div className="page" style={{ fontFamily:"'Inter', sans-serif", background: G.bg, minHeight: '100%', padding: '32px 40px' }}>
      {TourElement}
      {/* ── Top Row: Ultra-Compact Room Configuration ── */}
      <div className="room-card" style={{ marginBottom: 24 }}>
        <div className="room-card-head" style={{ justifyContent: 'space-between', flexWrap: 'wrap', gap: 16 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
            <div style={{ width: 40, height: 40, borderRadius: 10, background: G.meadowSoft, display: 'flex', alignItems: 'center', justifyContent: 'center', border: `1px solid ${G.meadowBorder}` }}>
              <img src={activeTab === 'lec' ? iconLec : iconLab} alt="Rooms" style={{ width: 22, height: 22, objectFit: 'contain' }} />
            </div>
            <div>
              <div style={{ fontSize: 16, fontWeight: 800, color: G.ink }}>Room Selection</div>
              <div style={{ fontSize: 12.5, color: G.muted }}>Choose which rooms the solver can use for your program</div>
            </div>
          </div>
          
          {/* Header Save Bar Logic for Campus Rooms */}
          {!loading && roomsDirty ? (
            <div style={{ display: 'flex', alignItems: 'center', gap: '16px', background: 'rgba(245, 158, 11, 0.05)', padding: '8px 16px', borderRadius: '10px', border: '1px solid #FDE68A', animation: 'fadeIn 0.2s ease-out' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                <div style={{ width: 24, height: 24, borderRadius: 6, background: 'rgba(245, 158, 11, 0.1)', display: 'flex', alignItems: 'center', justifyContent: 'center', border: '1px solid #FCD34D' }}>
                  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke='#F59E0B' strokeWidth="2.5"><circle cx="12" cy="12" r="10"/><line x1="12" y1="8" x2="12" y2="12"/><line x1="12" y1="16" x2="12.01" y2="16"/></svg>
                </div>
                <span style={{ fontSize: 13, color: G.ink, fontWeight: 600, fontFamily: "'Inter', sans-serif" }}>
                  <strong style={{ color: '#F59E0B' }}>Unsaved</strong> room selection changes
                </span>
              </div>
              <div style={{ display: 'flex', gap: 8 }}>
                <button className="btn-outline" onClick={discardRooms} disabled={savingRooms} style={{ padding: '6px 12px' }}>Discard</button>
                <button className="btn-primary" onClick={handleSaveRooms} disabled={savingRooms} style={{ padding: '6px 12px' }}>
                  {savingRooms ? (
                    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" style={{ animation:'spin-r .8s linear infinite' }}><path d="M21 12a9 9 0 1 1-6.219-8.56"/></svg>
                  ) : (
                    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"><path d="M19 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h11l5 5v11a2 2 0 0 1-2 2z"/><polyline points="17 21 17 13 7 13 7 21"/><polyline points="7 3 7 8 15 8"/></svg>
                  )}
                  Save Changes
                </button>
              </div>
            </div>
          ) : (
            <div style={{ display: 'flex', alignItems: 'center', gap: 16 }}>
              <div className="room-tabs">
                <button className={`room-tab ${activeTab === 'lec' ? 'active' : ''}`} onClick={() => setActiveTab('lec')}>
                  Lecture ({loading ? '...' : allRooms.lecture.length})
                </button>
                <button className={`room-tab ${activeTab === 'lab' ? 'active' : ''}`} onClick={() => setActiveTab('lab')}>
                  Laboratory ({loading ? '...' : allRooms.lab.length})
                </button>
              </div>
              <button className="btn-outline" onClick={selectAll} disabled={loading} style={{ padding: '5px 11px', fontSize: 11.5 }}>Select All</button>
              <button className="btn-outline" onClick={deselectAll} disabled={loading} style={{ padding: '5px 11px', fontSize: 11.5 }}>Deselect All</button>
            </div>
          )}
        </div>

        <div style={{ padding: '16px 20px', background: G.surface }}>
          {loading ? (
            <div className="chip-container">{[1,2,3,4,5].map(i => <Skel key={i} w={90} h={32} r={8} />)}</div>
          ) : tabRooms.length === 0 ? (
            <div style={{ fontSize: 13, color: G.muted, padding: '12px', textAlign: 'center' }}>No rooms available in this category.</div>
          ) : (
            <div className="chip-container">
              {tabRooms.map(r => {
                const isSel = tabSelected.includes(r)
                return (
                  <span key={r} className={`room-chip${isSel ? '' : ' unselected'}`} onClick={() => toggleRoom(r)}>
                    {isSel && <span className="room-chip-idx">{tabSelected.indexOf(r) + 1}</span>}
                    {r}
                    {isSel
                      ? <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke={G.meadow} strokeWidth="2.5"><polyline points="20 6 9 17 4 12"/></svg>
                      : <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke={G.muted2} strokeWidth="2.5"><line x1="12" y1="5" x2="12" y2="19"/><line x1="5" y1="12" x2="19" y2="12"/></svg>
                    }
                  </span>
                )
              })}
            </div>
          )}
          {!loading && tabSelected.length > 0 && (
            <div style={{ marginTop: 10, fontSize: 12, color: G.muted }}>
              {tabSelected.length} of {tabRooms.length} rooms selected
            </div>
          )}
        </div>
      </div>

      {/* ── Bottom Row: High-Density Course Assignments ── */}
      <div id="tour-assign-section" className="room-card" style={{ position: 'relative' }}>
        
        {/* Course Assignment Header - Now with Save/Discard Controls */}
        <div className="room-card-head" style={{ padding: '16px 20px', display: 'flex', alignItems: 'center', flexWrap: 'wrap', gap: '16px' }}>
          <div style={{ width: 40, height: 40, borderRadius: 10, background: G.hover, display: 'flex', alignItems: 'center', justifyContent: 'center', border: `1px solid ${G.border}`, color: G.muted }}>
            <img src={iconAssign} alt="Assignments" style={{ width: 22, height: 22, objectFit: 'contain' }} />
          </div>
          <div style={{ flex: 1, minWidth: '200px' }}>
            <div style={{ fontSize: 16, fontWeight: 800, color: G.ink }}>Course Room Assignment Pool</div>
            <div style={{ fontSize: 12.5, color: G.muted }}>
              {loading ? <Skel w={240} h={12} /> : 'Assign a pool of specific rooms to a course. The scheduler will pick from this pool.'}
            </div>
          </div>
          
          {/* Header Save Bar Logic for Assignments */}
          {!loading && dirtyKeys.length > 0 && (
            <div style={{ display: 'flex', alignItems: 'center', gap: '16px', background: 'rgba(245, 158, 11, 0.05)', padding: '8px 16px', borderRadius: '10px', border: '1px solid #FDE68A', animation: 'fadeIn 0.2s ease-out' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                <div style={{ width: 24, height: 24, borderRadius: 6, background: 'rgba(245, 158, 11, 0.1)', display: 'flex', alignItems: 'center', justifyContent: 'center', border: '1px solid #FCD34D' }}>
                  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke='#F59E0B' strokeWidth="2.5"><circle cx="12" cy="12" r="10"/><line x1="12" y1="8" x2="12" y2="12"/><line x1="12" y1="16" x2="12.01" y2="16"/></svg>
                </div>
                <span style={{ fontSize: 13, color: G.ink, fontWeight: 600, fontFamily: "'Inter', sans-serif" }}>
                  <strong style={{ color: '#F59E0B' }}>{dirtyKeys.length}</strong> unsaved change{dirtyKeys.length !== 1 ? 's' : ''}
                </span>
              </div>
              <div style={{ display: 'flex', gap: 8 }}>
                <button className="btn-outline" onClick={resetDirty} disabled={savingAssigns} style={{ padding: '6px 12px' }}>Discard</button>
                <button className="btn-primary" onClick={handleSaveAssignments} disabled={savingAssigns} style={{ padding: '6px 12px' }}>
                  {savingAssigns ? (
                    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" style={{ animation:'spin-r .8s linear infinite' }}><path d="M21 12a9 9 0 1 1-6.219-8.56"/></svg>
                  ) : (
                    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"><path d="M19 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h11l5 5v11a2 2 0 0 1-2 2z"/><polyline points="17 21 17 13 7 13 7 21"/><polyline points="7 3 7 8 15 8"/></svg>
                  )}
                  Save Changes
                </button>
              </div>
            </div>
          )}
        </div>

        {/* Filters */}
        <div style={{ padding: '14px 20px', borderBottom: `1px solid ${G.borderLight}`, display: 'flex', flexDirection: 'column', gap: 12, background: 'var(--surface)' }}>
          <div style={{ display: 'flex', gap: 12, alignItems: 'center', flexWrap: 'wrap' }}>
            <div style={{ position: 'relative', flex: '1 1 200px', minWidth: 160 }}>
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke={G.muted2} strokeWidth="2.5" style={{ position:'absolute', left:12, top:'50%', transform:'translateY(-50%)', pointerEvents:'none' }}><circle cx="11" cy="11" r="8"/><line x1="21" y1="21" x2="16.65" y2="16.65"/></svg>
              {loading ? <Skel w="100%" h={36} r={8} /> : <input className="cp-search" placeholder="Search course code or title…" value={search} onChange={e => setSearch(e.target.value)} />}
            </div>
            
            {!loading && (
              <div style={{ display: 'flex', gap: 4, background: G.hover, padding: 4, borderRadius: 9, border: `1px solid ${G.border}` }}>
                {['All', 'Assigned', 'Unassigned'].map(status => (
                  <button key={status} onClick={() => { setStatusFilter(status); setSelectedCourses(new Set()) }} 
                    style={{ padding: '6px 14px', borderRadius: 7, fontSize: 12, fontWeight: statusFilter === status ? 700 : 600, background: statusFilter === status ? 'var(--surface)' : 'transparent', color: statusFilter === status ? G.meadowDeep : G.muted, border: 'none', cursor: 'pointer', boxShadow: statusFilter === status ? '0 1px 3px rgba(0,0,0,0.04)' : 'none', transition: 'all .15s', fontFamily: "'Inter', sans-serif" }}>
                    {status}
                  </button>
                ))}
              </div>
            )}
          </div>
        </div>

        {/* Bulk Action Bar */}
        {selectedCourses.size > 0 && (
          <div style={{ background: `linear-gradient(135deg,${G.meadowDeep},${G.inkMid})`, padding: '10px 20px', display: 'flex', alignItems: 'center', gap: 14, animation: 'fadeIn 0.15s ease' }}>
            <span style={{ fontSize: 13, fontWeight: 600, color: '#fff', flex: 1 }}>{selectedCourses.size} course{selectedCourses.size !== 1 ? 's' : ''} selected</span>
            <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
              <button onClick={() => setSelectedCourses(new Set())} style={{ background: 'transparent', border: 'none', color: 'rgba(255,255,255,0.7)', fontSize: 12, fontWeight: 600, cursor: 'pointer', transition: 'all 0.15s' }}>Deselect</button>
              <button onClick={openBulkModal} style={{ background: 'var(--surface)', color: G.meadowDeep, border: 'none', fontSize: 12, fontWeight: 700, padding: '6px 14px', borderRadius: 6, cursor: 'pointer', boxShadow: '0 2px 6px rgba(0,0,0,0.1)' }}>Bulk Assign Rooms</button>
            </div>
          </div>
        )}

        {/* High-Density Data Table */}
        <div style={{ maxHeight: 550, overflowY: 'auto' }}>
          <table style={{ width: '100%', borderCollapse: 'collapse' }}>
            <thead style={{ position: 'sticky', top: 0, zIndex: 5, background: 'var(--surface)' }}>
              <tr>
                <th style={{ width: 48, padding: '12px 20px', borderBottom: `1.5px solid ${G.border}`, background: G.hover }}>
                  <div style={{ display: 'flex', justifyContent: 'center' }}><Checkbox checked={allSel} indeterminate={someSel} onChange={togAll}/></div>
                </th>
                <th style={{ padding: '12px 16px', textAlign: 'left', fontWeight: 700, color: G.muted2, fontSize: 11.5, textTransform: 'uppercase', letterSpacing: '.6px', borderBottom: `1.5px solid ${G.border}`, background: G.hover }}>Course Details</th>
                <th style={{ padding: '12px 16px', textAlign: 'left', fontWeight: 700, color: G.muted2, fontSize: 11.5, textTransform: 'uppercase', letterSpacing: '.6px', borderBottom: `1.5px solid ${G.border}`, background: G.hover, width: 140 }}>Units</th>
                <th style={{ padding: '12px 20px', textAlign: 'left', fontWeight: 700, color: G.muted2, fontSize: 11.5, textTransform: 'uppercase', letterSpacing: '.6px', borderBottom: `1.5px solid ${G.border}`, background: G.hover, width: '40%' }}>Assigned Room Pool</th>
              </tr>
            </thead>
            <tbody>
              {loading ? (
                [...Array(6)].map((_, i) => (
                  <tr key={i} style={{ borderBottom: `1px solid ${G.borderLight}` }}>
                    <td style={{ padding: '12px 20px' }}><Skel w={18} h={18} r={4} /></td>
                    <td style={{ padding: '12px 16px' }}>
                      <Skel w={100} h={20} r={4} style={{ marginBottom: 6 }} />
                      <Skel w="60%" h={14} r={4} />
                    </td>
                    <td style={{ padding: '12px 16px' }}><Skel w={70} h={16} r={4} /></td>
                    <td style={{ padding: '12px 20px' }}><Skel w={120} h={28} r={6} /></td>
                  </tr>
                ))
              ) : visibleCourses.length === 0 ? (
                <tr>
                  <td colSpan={4} style={{ padding: '80px 20px', textAlign: 'center' }}>
                    <div style={{ fontSize: 14, fontWeight: 700, color: G.muted }}>No courses match your filters</div>
                    <button onClick={() => { setSearch(''); setStatusFilter('All') }} style={{ fontSize: 12.5, color: G.meadow, background: 'none', border: 'none', cursor: 'pointer', fontFamily: "'Inter', sans-serif", padding: 0, marginTop: 8, fontWeight: 600 }}>Clear all filters</button>
                  </td>
                </tr>
              ) : (
                visibleCourses.map((course, i) => {
                  const key = course.courseCode
                  const isSel = selectedCourses.has(key)
                  const roomsArr = assignments[key] || []
                  const isDirty = assignments[key].join(',') !== origAssign[key].join(',')
                  const title = course.courseTitle || course.title || ''

                  return (
                    <tr key={key} className="cp-tr-hover" onClick={() => togOne(key)} style={{ background: isSel ? G.meadowSoft : 'transparent', borderBottom: i < visibleCourses.length - 1 ? `1px solid ${G.borderLight}` : 'none', cursor: 'pointer', transition: 'background .15s' }}>
                      <td style={{ padding: '12px 20px', textAlign: 'center', verticalAlign: 'middle' }} onClick={e => e.stopPropagation()}>
                        <div style={{ display: 'flex', justifyContent: 'center' }}><Checkbox checked={isSel} onChange={() => togOne(key)}/></div>
                      </td>
                      <td style={{ padding: '12px 16px' }}>
                        <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
                          <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                            <span style={{ padding: '3px 8px', background: G.hover, color: G.ink, borderRadius: 6, fontSize: 12.5, fontWeight: 800, border: `1px solid ${G.border}` }}>{course.courseCode}</span>
                            <span style={{ fontWeight: 600, color: G.ink, fontSize: 13.5 }}>{title}</span>
                            {isDirty && <div style={{ width: 8, height: 8, borderRadius: '50%', background: '#F59E0B', flexShrink: 0, boxShadow: '0 0 0 2px #FEF3C7' }} title="Unsaved change" />}
                          </div>
                          <div style={{ display: 'flex', gap: 8, alignItems: 'center', fontSize: 11.5, color: G.muted2, fontWeight: 600 }}>
                            <span style={{ color: G.muted }}>{course.program || coordinatorProgram}</span>
                            <span style={{ width: 4, height: 4, borderRadius: '50%', background: G.muted2 }} />
                            <span>Yr {course.yearLevel || '—'}</span>
                          </div>
                        </div>
                      </td>
                      <td style={{ padding: '12px 16px', verticalAlign: 'middle' }}>
                        <div style={{ display: 'flex', gap: 8 }}>
                          {course.unitsLecture > 0 && <span style={{ color: G.meadowDeep, fontWeight: 700, fontSize: 12, display: 'flex', alignItems: 'center', gap: 5 }}><div style={{width:8,height:8,borderRadius:2,background:G.meadowSoft,border:`1px solid ${G.meadowBorder}`}}/> {course.unitsLecture}L</span>}
                          {course.unitsLab > 0 && <span style={{ color: '#38BDF8', fontWeight: 700, fontSize: 12, display: 'flex', alignItems: 'center', gap: 5 }}><div style={{width:8,height:8,borderRadius:2,background:'rgba(59, 130, 246, 0.1)',border:`1px solid #BAE6FD`}}/> {course.unitsLab}L</span>}
                        </div>
                      </td>
                      <td style={{ padding: '12px 20px', verticalAlign: 'middle' }} onClick={e => e.stopPropagation()}>
                        {roomsArr.length === 0 ? (
                          <button className="assign-trigger" onClick={() => openSingleModal(key, `${course.courseCode} - ${title}`, roomsArr)}>
                            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"><line x1="12" y1="5" x2="12" y2="19"/><line x1="5" y1="12" x2="19" y2="12"/></svg>
                            Assign Pool
                          </button>
                        ) : (
                          <div style={{ display: 'flex', alignItems: 'center', flexWrap: 'wrap', gap: 6 }}>
                            {roomsArr.slice(0, 4).map(r => <span key={r} className="assigned-pill">{r}</span>)}
                            {roomsArr.length > 4 && <span style={{ fontSize: 11.5, fontWeight: 800, color: G.muted }}>+{roomsArr.length - 4}</span>}
                            <button onClick={() => openSingleModal(key, `${course.courseCode} - ${title}`, roomsArr)} style={{ border: '1px solid transparent', background: 'transparent', cursor: 'pointer', color: G.meadow, display: 'flex', alignItems: 'center', padding: '5px', marginLeft: '4px', borderRadius: '6px', transition: 'all 0.15s' }} onMouseOver={e => {e.currentTarget.style.background = G.meadowSoft; e.currentTarget.style.borderColor = G.meadowBorder}} onMouseOut={e => {e.currentTarget.style.background = 'transparent'; e.currentTarget.style.borderColor = 'transparent'}} title="Edit Assigned Rooms">
                              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"><path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"/><path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"/></svg>
                            </button>
                          </div>
                        )}
                      </td>
                    </tr>
                  )
                })
              )}
            </tbody>
          </table>
        </div>
      </div>

      <RoomAssignModal 
        isOpen={modalState.isOpen} 
        onClose={() => setModalState(p => ({...p, isOpen: false}))} 
        title={modalState.title} 
        initialRooms={modalState.rooms} 
        lectureRooms={selectedRooms.lecture} 
        labRooms={selectedRooms.lab} 
        onSave={handleModalSave} 
      />

      <ToastContainer toasts={toasts} />
    </div>
  )
}