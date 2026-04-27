import { useEffect, useState, useMemo } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import { getFaculty, addFaculty, updateFaculty, deleteFaculty, listSaved, loadSaved, getCourses } from '../../services/api'
import FacultyEventsTable from '../../components/FacultyEventsTable' // adjust path as needed

// ─── Shared constants (synced across all faculty modals & pages) ──────────────
const ACADEMIC_RANKS = [
  'Instructor I',
  'Instructor II',
  'Instructor III',
  'Assistant Professor I',
  'Assistant Professor II',
  'Associate Professor I',
  'Associate Professor II',
  'Professor I',
  'Professor II',
  'Professor III',
  'Assistant Dean',
  'Dean',
]

const DEPARTMENTS = ['CCS', 'CEAS', 'CHTM', 'CBA', 'CAHS']

const DAYS         = ['Monday','Tuesday','Wednesday','Thursday','Friday','Saturday']
const RATING_LABELS = { 5:'Expert', 4:'Highly Proficient', 3:'Competent', 2:'Developing', 1:'Beginner' }
const RATING_COLORS = { 5:'#059669', 4:'#2563EB', 3:'#7C6FCD', 2:'#D97706', 1:'#C0392B' }

const empty = {
  name: '', email: '', status: 'full-time', AcademicRank: '',
  Department: 'CCS', Educational_attainment: '', Sex: '', max_units: 21, units: 0,
  specializations: [], preferredDays: [],
  preferredTimeStart: 7, preferredTimeEnd: 21, maxConsecutiveHours: 4,
}

// ─── Avatar ──────────────────────────────────────────────────────────────────
function Avatar({ name, size = 56 }) {
  const safeName = name || '?'
  const initials = safeName.split(' ').map(n => n[0]).join('').slice(0, 2).toUpperCase()
  const colors = [
    ['#7C6FCD','#EEEAFB'], ['#2563EB','#EBF0FF'], ['#059669','#E6FAF3'],
    ['#D97706','#FEF3CD'], ['#DC2626','#FFE8E8'], ['#7C3AED','#EDE9FE'],
  ]
  const [fg, bg] = colors[safeName.charCodeAt(0) % colors.length]
  return (
    <div style={{
      width: size, height: size, borderRadius: '50%',
      background: `linear-gradient(135deg,${bg},${bg}cc)`,
      color: fg, display: 'flex', alignItems: 'center', justifyContent: 'center',
      fontSize: size * 0.33, fontWeight: 700, flexShrink: 0,
      border: `2.5px solid ${fg}30`, boxShadow: `0 4px 12px ${fg}25`,
    }}>{initials}</div>
  )
}

// ─── Star rating (interactive) ────────────────────────────────────────────────
function StarRating({ value, onChange, size = 20 }) {
  const [hovered, setHovered] = useState(0)
  return (
    <div style={{ display: 'flex', gap: 3, alignItems: 'center' }}>
      {[1,2,3,4,5].map(s => (
        <svg key={s} width={size} height={size} viewBox="0 0 24 24"
          fill={(hovered || value) >= s ? '#7C6FCD' : 'none'}
          stroke={(hovered || value) >= s ? '#7C6FCD' : '#D8D3F5'}
          strokeWidth="2"
          style={{ cursor: onChange ? 'pointer' : 'default', transition: 'all 0.1s' }}
          onMouseEnter={() => onChange && setHovered(s)}
          onMouseLeave={() => onChange && setHovered(0)}
          onClick={() => onChange && onChange(s)}
        >
          <polygon points="12 2 15.09 8.26 22 9.27 17 14.14 18.18 21.02 12 17.77 5.82 21.02 7 14.14 2 9.27 8.91 8.26 12 2"/>
        </svg>
      ))}
      {onChange && (
        <span style={{ fontSize: 11, color: RATING_COLORS[value] || '#8883B0', fontWeight: 600, marginLeft: 4 }}>
          {RATING_LABELS[value] || '—'}
        </span>
      )}
    </div>
  )
}

// ─── Enhanced Specialization Modal (with course fetch + search + rate) ────────
function SpecializationModal({ specializations, onSave, onClose, isSaving = false }) {
  const [specs, setSpecs] = useState(
    specializations.map(s => typeof s === 'string' ? { courseCode: s, rating: 3 } : { ...s })
  )
  const [tab,           setTab]           = useState('current')   // 'current' | 'browse'
  const [newCode,       setNewCode]       = useState('')
  const [newRating,     setNewRating]     = useState(3)
  const [codeError,     setCodeError]     = useState('')
  const [courseSearch,  setCourseSearch]  = useState('')
  const [courses,       setCourses]       = useState([])
  const [loadingCourses,setLoadingCourses]= useState(false)
  const [browseRating,  setBrowseRating]  = useState(3)

  // Fetch available courses
  useEffect(() => {
    setLoadingCourses(true)
    getCourses()
      .then(res => {
        let data = Array.isArray(res) ? res : (res?.courses ?? res?.data ?? [])
        // Normalise to { courseCode, title } objects
        const normalised = data.map(c => ({
          courseCode: c.courseCode || c.course_code || c.code || c.Code || '',
          title:      c.Title || c.title || c.name || c.courseName || c.course_name || '',
        })).filter(c => c.courseCode || c.title)
        // Deduplicate by courseCode
        const seen = new Set()
        setCourses(normalised.filter(c => {
          const key = (c.courseCode || c.title).toLowerCase()
          if (seen.has(key)) return false
          seen.add(key); return true
        }))
      })
      .catch(() => setCourses([]))
      .finally(() => setLoadingCourses(false))
  }, [])

  const existingCodes = useMemo(
    () => new Set(specs.map(s => (s.courseCode || '').toLowerCase().trim())),
    [specs]
  )

  const filteredCourses = useMemo(() => {
    const q = courseSearch.toLowerCase()
    return courses
      .filter(c =>
        c.courseCode.toLowerCase().includes(q) || c.title.toLowerCase().includes(q)
      )
      .sort((a, b) => {
        const aAdded = existingCodes.has(a.courseCode.toLowerCase())
        const bAdded = existingCodes.has(b.courseCode.toLowerCase())
        if (aAdded && !bAdded) return 1
        if (!aAdded && bAdded) return -1
        return a.courseCode.localeCompare(b.courseCode)
      })
  }, [courses, courseSearch, existingCodes])

  function handleAddManual() {
    const code = newCode.trim().toUpperCase()
    if (!code) { setCodeError('Enter a course code'); return }
    if (existingCodes.has(code.toLowerCase())) { setCodeError('Already added'); return }
    setSpecs(prev => [...prev, { courseCode: code, rating: newRating }])
    setNewCode(''); setNewRating(3); setCodeError('')
  }

  function handleAddFromCourse(course) {
    const code = (course.courseCode || course.title).trim()
    if (existingCodes.has(code.toLowerCase())) return
    setSpecs(prev => [...prev, { courseCode: code, title: course.title || '', rating: browseRating }])
  }

  function handleRemove(idx) {
    setSpecs(prev => prev.filter((_, i) => i !== idx))
  }

  function updateRating(idx, rating) {
    setSpecs(prev => prev.map((s, i) => i === idx ? { ...s, rating } : s))
  }

  const tabBtn = (key, label, icon) => (
    <button onClick={() => setTab(key)} style={{
      display: 'flex', alignItems: 'center', gap: 5,
      padding: '6px 14px', borderRadius: 8, fontSize: 12.5, fontWeight: 600,
      cursor: 'pointer', fontFamily: "'Poppins',sans-serif", transition: 'all 0.15s',
      border: tab === key ? 'none' : '1.5px solid #E8E4F8',
      background: tab === key ? 'linear-gradient(135deg,#7C6FCD,#5a4fbf)' : '#F5F4FB',
      color: tab === key ? '#fff' : '#8883B0',
      boxShadow: tab === key ? '0 2px 8px rgba(124,111,205,0.28)' : 'none',
    }}>
      {icon}
      {label}
    </button>
  )

  return (
    <div style={{
      position:'fixed', inset:0, zIndex:1000,
      background:'rgba(26,26,46,0.45)', backdropFilter:'blur(4px)',
      display:'flex', alignItems:'center', justifyContent:'center',
      padding:'24px 16px', animation:'fadeIn 0.18s ease',
    }}>
      <div style={{
        background:'#fff', borderRadius:20, width:'100%', maxWidth:580,
        boxShadow:'0 24px 64px rgba(26,26,46,0.22)',
        overflow:'hidden', animation:'slideUp 0.22s ease',
        display:'flex', flexDirection:'column', maxHeight:'88vh',
      }}>
        {/* Header */}
        <div style={{ padding:'20px 24px 14px', borderBottom:'1px solid #F0EDF9' }}>
          <div style={{ display:'flex', alignItems:'center', justifyContent:'space-between', marginBottom:12 }}>
            <div>
              <div style={{ fontSize:16, fontWeight:700, color:'#1a1a2e' }}>Specializations & Proficiency</div>
              <div style={{ fontSize:12, color:'#8883B0', marginTop:2 }}>Manage courses this faculty can teach and their proficiency level</div>
            </div>
            <button onClick={onClose} style={{
              width:32, height:32, borderRadius:8, border:'1px solid #E8E4F8', background:'#F5F4FB',
              display:'flex', alignItems:'center', justifyContent:'center', cursor:'pointer',
            }}>
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="#8883B0" strokeWidth="2.5">
                <line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/>
              </svg>
            </button>
          </div>
          {/* Tabs */}
          <div style={{ display:'flex', gap:8 }}>
            {tabBtn('current',
              `Current (${specs.length})`,
              <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M4 19.5A2.5 2.5 0 0 1 6.5 17H20"/><path d="M6.5 2H20v20H6.5A2.5 2.5 0 0 1 4 19.5v-15A2.5 2.5 0 0 1 6.5 2z"/></svg>
            )}
            {tabBtn('browse',
              'Browse Courses',
              <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><circle cx="11" cy="11" r="8"/><line x1="21" y1="21" x2="16.65" y2="16.65"/></svg>
            )}
            {tabBtn('manual',
              'Add Manual',
              <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"><line x1="12" y1="5" x2="12" y2="19"/><line x1="5" y1="12" x2="19" y2="12"/></svg>
            )}
          </div>
        </div>

        {/* Body */}
        <div style={{ flex:1, overflowY:'auto', padding:'16px 24px' }}>

          {/* ── Tab: Current specializations ── */}
          {tab === 'current' && (
            <>
              {specs.length === 0 ? (
                <div style={{ textAlign:'center', padding:'32px 0', color:'#C0BBDC' }}>
                  <svg width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="#D8D3F5" strokeWidth="1.5" style={{ marginBottom:10 }}>
                    <path d="M4 19.5A2.5 2.5 0 0 1 6.5 17H20"/><path d="M6.5 2H20v20H6.5A2.5 2.5 0 0 1 4 19.5v-15A2.5 2.5 0 0 1 6.5 2z"/>
                  </svg>
                  <div style={{ fontSize:13, fontWeight:500 }}>No specializations yet</div>
                  <div style={{ fontSize:11.5, marginTop:4 }}>Use Browse Courses or Add Manual to get started</div>
                </div>
              ) : (
                <div style={{ display:'flex', flexDirection:'column', gap:8 }}>
                  {specs.map((spec, idx) => {
                    // Resolve title: use stored title, or look up from courses list, or fall back to code
                    const resolvedTitle = spec.title ||
                      (courses.find(c => c.courseCode?.toLowerCase() === (spec.courseCode || '').toLowerCase())?.title) ||
                      ''
                    return (
                    <div key={idx} style={{
                      display:'flex', alignItems:'center', gap:12,
                      padding:'12px 14px', borderRadius:12,
                      border:'1.5px solid #E8E4F8', background:'#FDFCFF',
                    }}>
                      <div style={{ display:'flex', flexDirection:'column', gap:2, flex:1, minWidth:0 }}>
                        <div style={{ display:'flex', alignItems:'center', gap:8 }}>
                          <span style={{
                            padding:'2px 9px', borderRadius:99, fontSize:10.5, fontWeight:700,
                            background:'#EEEAFB', color:'#7C6FCD', border:'1px solid #D8D3F5',
                            whiteSpace:'nowrap', flexShrink:0,
                          }}>{spec.courseCode}</span>
                          {resolvedTitle && (
                            <span style={{ fontSize:12.5, color:'#1a1a2e', fontWeight:500, overflow:'hidden', textOverflow:'ellipsis', whiteSpace:'nowrap' }}>
                              {resolvedTitle}
                            </span>
                          )}
                        </div>
                        <StarRating value={spec.rating} onChange={r => updateRating(idx, r)} />
                      </div>
                      <span style={{
                        fontSize:10.5, fontWeight:700, padding:'2px 8px', borderRadius:99, flexShrink:0,
                        background: spec.rating >= 4 ? '#E6FAF3' : spec.rating >= 3 ? '#EEEAFB' : '#FEF3CD',
                        color: RATING_COLORS[spec.rating] || '#8883B0',
                      }}>{RATING_LABELS[spec.rating] || '—'}</span>
                      <button onClick={() => handleRemove(idx)} style={{
                        width:28, height:28, borderRadius:8, border:'1px solid #FFD0D0',
                        background:'#FFF5F5', color:'#C0392B',
                        display:'flex', alignItems:'center', justifyContent:'center', cursor:'pointer', flexShrink:0,
                      }}>
                        <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
                          <line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/>
                        </svg>
                      </button>
                    </div>
                    )
                  })}
                </div>
              )}
            </>
          )}

          {/* ── Tab: Browse courses ── */}
          {tab === 'browse' && (
            <>
              {/* Search + default rating */}
              <div style={{ display:'flex', gap:10, marginBottom:14, flexWrap:'wrap' }}>
                <div style={{ position:'relative', flex:'1 1 200px' }}>
                  <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="#B0ABCC" strokeWidth="2"
                    style={{ position:'absolute', left:10, top:'50%', transform:'translateY(-50%)', pointerEvents:'none' }}>
                    <circle cx="11" cy="11" r="8"/><line x1="21" y1="21" x2="16.65" y2="16.65"/>
                  </svg>
                  <input
                    placeholder="Search by code or title…"
                    value={courseSearch}
                    onChange={e => setCourseSearch(e.target.value)}
                    autoFocus
                    style={{
                      width:'100%', paddingLeft:32, paddingRight:10, height:36,
                      borderRadius:8, border:'1.5px solid #E8E4F8',
                      fontSize:12.5, fontFamily:"'Poppins',sans-serif",
                      background:'#FAFAFE', outline:'none', boxSizing:'border-box',
                    }}
                  />
                </div>
                <div style={{ display:'flex', alignItems:'center', gap:8, background:'#F5F4FB', borderRadius:8, padding:'6px 12px', border:'1.5px solid #E8E4F8' }}>
                  <span style={{ fontSize:11, color:'#8883B0', fontWeight:600, whiteSpace:'nowrap' }}>Add rating:</span>
                  <StarRating value={browseRating} onChange={setBrowseRating} size={16} />
                </div>
              </div>

              {loadingCourses ? (
                <div style={{ display:'flex', alignItems:'center', gap:8, color:'#8883B0', fontSize:13, padding:'24px 0' }}>
                  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="#A99BE8" strokeWidth="2" style={{ animation:'spin 1s linear infinite' }}>
                    <path d="M21 12a9 9 0 1 1-6.219-8.56"/>
                  </svg>
                  Loading courses…
                </div>
              ) : filteredCourses.length === 0 ? (
                <div style={{ textAlign:'center', padding:'28px 0', color:'#C0BBDC', fontSize:13 }}>
                  {courseSearch ? `No courses match "${courseSearch}"` : 'No courses available'}
                </div>
              ) : (
                <div style={{ display:'flex', flexDirection:'column', gap:6 }}>
                  {filteredCourses.map((course, i) => {
                    const code    = course.courseCode || course.title
                    const isAdded = existingCodes.has(code.toLowerCase().trim())
                    return (
                      <div key={i} style={{
                        display:'flex', alignItems:'center', gap:12,
                        padding:'10px 14px', borderRadius:10,
                        border:`1.5px solid ${isAdded ? '#E8E4F8' : '#E8E4F8'}`,
                        background: isAdded ? '#FAFAFE' : '#fff',
                        opacity: isAdded ? 0.6 : 1,
                        transition: 'all 0.15s',
                      }}>
                        <span style={{
                          padding:'2px 9px', borderRadius:99, fontSize:10.5, fontWeight:700,
                          background:'#EEEAFB', color:'#7C6FCD', border:'1px solid #D8D3F5',
                          whiteSpace:'nowrap',
                        }}>{code}</span>
                        {course.title && code !== course.title && (
                          <span style={{ flex:1, fontSize:12, color:'#4a4a6a', overflow:'hidden', textOverflow:'ellipsis', whiteSpace:'nowrap' }}>
                            {course.title}
                          </span>
                        )}
                        <button
                          onClick={() => !isAdded && handleAddFromCourse(course)}
                          disabled={isAdded}
                          style={{
                            padding:'5px 12px', borderRadius:8, fontSize:11.5, fontWeight:600,
                            border:'none', cursor: isAdded ? 'default' : 'pointer',
                            background: isAdded ? '#E6FAF3' : 'linear-gradient(135deg,#7C6FCD,#5a4fbf)',
                            color: isAdded ? '#059669' : '#fff',
                            display:'flex', alignItems:'center', gap:4, whiteSpace:'nowrap',
                            fontFamily:"'Poppins',sans-serif", flexShrink:0,
                          }}
                        >
                          {isAdded ? (
                            <><svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"><polyline points="20 6 9 17 4 12"/></svg> Added</>
                          ) : (
                            <><svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"><line x1="12" y1="5" x2="12" y2="19"/><line x1="5" y1="12" x2="19" y2="12"/></svg> Add</>
                          )}
                        </button>
                      </div>
                    )
                  })}
                </div>
              )}
            </>
          )}

          {/* ── Tab: Add manual ── */}
          {tab === 'manual' && (
            <div style={{ display:'flex', flexDirection:'column', gap:16 }}>
              <div style={{ fontSize:12, color:'#8883B0', lineHeight:1.5 }}>
                Enter a course code manually — use this for courses not yet in the system.
              </div>
              <div>
                <label style={{ fontSize:11, fontWeight:700, color:'#8883B0', textTransform:'uppercase', letterSpacing:'.6px', display:'block', marginBottom:6 }}>Course Code</label>
                <input
                  placeholder="e.g. IT101, CS301"
                  value={newCode}
                  onChange={e => { setNewCode(e.target.value); setCodeError('') }}
                  onKeyDown={e => e.key === 'Enter' && handleAddManual()}
                  autoFocus
                  style={{
                    width:'100%', padding:'9px 12px', borderRadius:8, boxSizing:'border-box',
                    border:`1.5px solid ${codeError ? '#E74C3C' : '#E8E4F8'}`,
                    fontSize:13, fontFamily:"'Poppins',sans-serif", textTransform:'uppercase',
                    outline:'none',
                  }}
                />
                {codeError && <div style={{ fontSize:11, color:'#E74C3C', marginTop:4 }}>{codeError}</div>}
              </div>
              <div>
                <label style={{ fontSize:11, fontWeight:700, color:'#8883B0', textTransform:'uppercase', letterSpacing:'.6px', display:'block', marginBottom:8 }}>Proficiency Rating</label>
                <StarRating value={newRating} onChange={setNewRating} />
              </div>
              <button onClick={handleAddManual} style={{
                alignSelf:'flex-start', padding:'9px 20px', borderRadius:9, fontSize:13, fontWeight:600,
                background:'linear-gradient(135deg,#7C6FCD,#5a4fbf)', color:'#fff',
                border:'none', cursor:'pointer', fontFamily:"'Poppins',sans-serif",
                boxShadow:'0 3px 12px rgba(124,111,205,0.35)', display:'flex', alignItems:'center', gap:6,
              }}>
                <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
                  <line x1="12" y1="5" x2="12" y2="19"/><line x1="5" y1="12" x2="19" y2="12"/>
                </svg>
                Add Specialization
              </button>
            </div>
          )}
        </div>

        {/* Footer */}
        <div style={{ padding:'14px 24px', borderTop:'1px solid #F0EDF9', display:'flex', gap:10, justifyContent:'space-between', alignItems:'center' }}>
          <span style={{ fontSize:12, color:'#B0ABCC' }}>{specs.length} specialization{specs.length !== 1 ? 's' : ''}</span>
          <div style={{ display:'flex', gap:10 }}>
            <button onClick={onClose} style={{
              padding:'8px 20px', borderRadius:8, fontSize:13, fontWeight:500,
              border:'1.5px solid #E8E4F8', background:'#fff', color:'#8883B0', cursor:'pointer', fontFamily:"'Poppins',sans-serif",
            }}>Cancel</button>
            <button onClick={() => onSave(specs)} disabled={isSaving} style={{
              padding:'8px 24px', borderRadius:8, fontSize:13, fontWeight:600,
              background:'linear-gradient(135deg,#7C6FCD,#5a4fbf)', color:'#fff',
              border:'none', cursor: isSaving ? 'default' : 'pointer', fontFamily:"'Poppins',sans-serif",
              boxShadow:'0 3px 12px rgba(124,111,205,0.35)', opacity: isSaving ? 0.7 : 1,
              display:'inline-flex', alignItems:'center', gap:6,
            }}>
              {isSaving
                ? <><svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" style={{ animation:'spin 0.8s linear infinite' }}><path d="M21 12a9 9 0 1 1-6.219-8.56"/></svg>Saving…</>
                : <>Save {specs.length > 0 ? `(${specs.length})` : ''}</>
              }
            </button>
          </div>
        </div>
      </div>
    </div>
  )
}

// ─── Delete confirm modal ─────────────────────────────────────────────────────
function DeleteConfirmModal({ name, onConfirm, onCancel, deleting }) {
  return (
    <div style={{
      position:'fixed', inset:0, zIndex:1100,
      background:'rgba(26,26,46,0.5)', backdropFilter:'blur(4px)',
      display:'flex', alignItems:'center', justifyContent:'center',
      padding:24, animation:'fadeIn 0.15s ease',
    }}>
      <div style={{
        background:'#fff', borderRadius:18, padding:'28px 28px 24px', maxWidth:400, width:'100%',
        boxShadow:'0 20px 60px rgba(26,26,46,0.22)', textAlign:'center', animation:'slideUp 0.2s ease',
      }}>
        <div style={{ width:52, height:52, borderRadius:'50%', background:'#FFE8E8', margin:'0 auto 16px', display:'flex', alignItems:'center', justifyContent:'center' }}>
          <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="#C0392B" strokeWidth="2">
            <polyline points="3 6 5 6 21 6"/><path d="M19 6l-1 14a2 2 0 0 1-2 2H8a2 2 0 0 1-2-2L5 6"/>
            <path d="M10 11v6M14 11v6"/><path d="M9 6V4h6v2"/>
          </svg>
        </div>
        <div style={{ fontSize:16, fontWeight:700, color:'#1a1a2e', marginBottom:8 }}>Delete Faculty Member?</div>
        <div style={{ fontSize:13, color:'#8883B0', marginBottom:24, lineHeight:1.5 }}>
          This will permanently remove <strong style={{ color:'#1a1a2e' }}>{name}</strong> and their login account. This cannot be undone.
        </div>
        <div style={{ display:'flex', gap:10 }}>
          <button onClick={onCancel} style={{
            flex:1, padding:'10px', borderRadius:9, border:'1.5px solid #E8E4F8', background:'#fff',
            fontSize:13, fontWeight:600, color:'#8883B0', cursor:'pointer', fontFamily:"'Poppins',sans-serif",
          }}>Cancel</button>
          <button onClick={onConfirm} disabled={deleting} style={{
            flex:1, padding:'10px', borderRadius:9, border:'none', background:'#C0392B',
            fontSize:13, fontWeight:700, color:'#fff', cursor:'pointer', fontFamily:"'Poppins',sans-serif",
            opacity: deleting ? 0.7 : 1,
          }}>{deleting ? 'Deleting…' : 'Yes, Delete'}</button>
        </div>
      </div>
    </div>
  )
}

// ─── Form field helper ────────────────────────────────────────────────────────
function FormField({ label, required, hint, children, span }) {
  return (
    <div style={{ display:'flex', flexDirection:'column', gap:5, gridColumn: span ? `span ${span}` : undefined }}>
      <label style={{ fontSize:11, fontWeight:700, color:'#8883B0', textTransform:'uppercase', letterSpacing:'.6px', display:'flex', alignItems:'center', gap:4 }}>
        {label}
        {required && <span style={{ color:'#7C6FCD' }}>*</span>}
      </label>
      {children}
      {hint && <div style={{ fontSize:10.5, color:'#B0ABCC', marginTop:1 }}>{hint}</div>}
    </div>
  )
}

// ─── Schedule Section (shown for existing faculty) ────────────────────────────
// Dropdown = saved schedule names (each represents a semester/period).
// Events are filtered client-side by faculty name.
function ScheduleSection({ facultyName }) {
  const [scheduleNames,    setScheduleNames]    = useState([])   // all saved schedule names
  const [selectedSchedule, setSelectedSchedule] = useState('')   // currently-viewed schedule name
  const [allEvents,        setAllEvents]        = useState([])   // events from selected schedule
  const [listLoading,      setListLoading]      = useState(true) // fetching name list
  const [eventsLoading,    setEventsLoading]    = useState(false)// fetching events
  const [fetchError,       setFetchError]       = useState(false)

  // Step 1 – load the list of saved schedule names on mount
  useEffect(() => {
    setListLoading(true)
    listSaved()
      .then(names => {
        const arr = Array.isArray(names) ? names : []
        setScheduleNames(arr)
        // Default to the last saved (most recent) schedule
        if (arr.length > 0) setSelectedSchedule(arr[arr.length - 1])
      })
      .catch(() => setFetchError(true))
      .finally(() => setListLoading(false))
  }, [])

  // Step 2 – load events whenever the selected schedule changes
  useEffect(() => {
    if (!selectedSchedule) return
    setEventsLoading(true)
    setFetchError(false)
    loadSaved(selectedSchedule)
      .then(data => {
        const raw = Array.isArray(data.schedule) ? data.schedule : []
        // Only show events explicitly assigned to this faculty
        const filtered = facultyName
          ? raw.filter(e =>
              (e.faculty || '').toLowerCase() === facultyName.toLowerCase()
            )
          : raw
        setAllEvents(filtered)
      })
      .catch(() => setFetchError(true))
      .finally(() => setEventsLoading(false))
  }, [selectedSchedule, facultyName])

  // Compute units for a single event row
  function computeUnits(event) {
    if (event.units != null) return event.units
    if (event.period) {
      const m = event.period.match(/(\d+):(\d+)\s*-\s*(\d+):(\d+)/)
      if (m) {
        const start = parseInt(m[1]) * 60 + parseInt(m[2])
        const end   = parseInt(m[3]) * 60 + parseInt(m[4])
        return Math.round((end - start) / 60)
      }
    }
    return '—'
  }

  const totalUnits = useMemo(() => {
    const nums = allEvents.map(computeUnits).filter(u => typeof u === 'number')
    return nums.reduce((s, u) => s + u, 0)
  }, [allEvents])

  const loading = listLoading || eventsLoading

  return (
    <div style={{ background:'#fff', borderRadius:16, border:'1px solid #E8E4F8', overflow:'hidden', boxShadow:'0 2px 10px rgba(124,111,205,0.06)' }}>
      {/* Section header */}
      <div style={{ padding:'14px 20px', borderBottom:'1px solid #F0EDF9', display:'flex', alignItems:'center', justifyContent:'space-between', flexWrap:'wrap', gap:10 }}>
        <div style={{ display:'flex', alignItems:'center', gap:8 }}>
          <div style={{ width:28, height:28, borderRadius:8, background:'#E6FAF3', display:'flex', alignItems:'center', justifyContent:'center' }}>
            <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="#059669" strokeWidth="2">
              <rect x="3" y="4" width="18" height="18" rx="2"/><line x1="16" y1="2" x2="16" y2="6"/>
              <line x1="8" y1="2" x2="8" y2="6"/><line x1="3" y1="10" x2="21" y2="10"/>
            </svg>
          </div>
          <div>
            <span style={{ fontSize:13, fontWeight:700, color:'#1a1a2e' }}>Schedule</span>
            {!loading && !fetchError && selectedSchedule && (
              <span style={{ fontSize:11.5, color:'#8883B0', marginLeft:8 }}>
                {allEvents.length} class{allEvents.length !== 1 ? 'es' : ''}
                {typeof totalUnits === 'number' && totalUnits > 0 && (
                  <> · <strong style={{ color:'#7C6FCD' }}>{totalUnits} units</strong></>
                )}
              </span>
            )}
          </div>
        </div>

        {/* Saved-schedule / semester dropdown */}
        {scheduleNames.length > 0 && (
          <div style={{ display:'flex', alignItems:'center', gap:8 }}>
            <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="#B0ABCC" strokeWidth="2">
              <rect x="3" y="4" width="18" height="18" rx="2"/><line x1="3" y1="10" x2="21" y2="10"/>
            </svg>
            <select
              value={selectedSchedule}
              onChange={e => setSelectedSchedule(e.target.value)}
              style={{
                padding:'5px 10px', borderRadius:8, border:'1.5px solid #E8E4F8',
                fontSize:12, fontFamily:"'Poppins',sans-serif", background:'#fff',
                color:'#1a1a2e', fontWeight:600, cursor:'pointer', outline:'none',
              }}
            >
              {scheduleNames.map(n => (
                <option key={n} value={n}>{n}</option>
              ))}
            </select>
          </div>
        )}
      </div>

      {/* Content */}
      <div style={{ padding: loading ? '24px 20px' : 0 }}>
        {loading ? (
          <div style={{ display:'flex', alignItems:'center', gap:8, color:'#8883B0', fontSize:13 }}>
            <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="#A99BE8" strokeWidth="2" style={{ animation:'spin 1s linear infinite' }}>
              <path d="M21 12a9 9 0 1 1-6.219-8.56"/>
            </svg>
            {listLoading ? 'Loading schedules…' : 'Loading events…'}
          </div>
        ) : scheduleNames.length === 0 ? (
          <div style={{ padding:'28px 20px', textAlign:'center', color:'#C0BBDC', fontSize:13 }}>
            No saved schedules found. Generate and save a schedule first.
          </div>
        ) : (
          <FacultyEventsTable
            events={allEvents}
            computeUnits={computeUnits}
            fetchError={fetchError}
          />
        )}
      </div>
    </div>
  )
}

// ─── Section-level Save Button (RoomsPage pattern) ───────────────────────────
function SectionSaveBtn({ saving, saved, onClick, disabled }) {
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={saving || disabled}
      style={{
        display: 'inline-flex', alignItems: 'center', gap: 5,
        padding: '5px 12px', borderRadius: 8,
        border: `1.5px solid ${saved ? '#A7F3D0' : '#E8E4F8'}`,
        fontFamily: "'Poppins',sans-serif", fontSize: 11.5, fontWeight: 600,
        cursor: (saving || disabled) ? 'default' : 'pointer',
        background: saved ? '#E6FAF3' : '#fff',
        color: saved ? '#059669' : '#7C6FCD',
        transition: 'all 0.15s', flexShrink: 0,
        opacity: disabled ? 0.5 : 1,
      }}
    >
      {saving ? (
        <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"
          style={{ animation: 'spin 0.8s linear infinite' }}>
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

// ─── Main component ───────────────────────────────────────────────────────────
export default function FacultyDetailPage() {
  const { id }   = useParams()
  const isNew    = id === 'new'
  const navigate = useNavigate()

  const [form,            setForm]            = useState(empty)
  const [password,        setPassword]        = useState('')
  const [showPassword,    setShowPassword]    = useState(false)
  const [deleting,        setDeleting]        = useState(false)
  const [createdPassword, setCreatedPassword] = useState('')
  const [passwordCopied,  setPasswordCopied]  = useState(false)
  const [showSpecModal,   setShowSpecModal]   = useState(false)
  const [showDeleteModal, setShowDeleteModal] = useState(false)

  // ── Per-section save state (existing faculty only) ─────────────────────────
  const [infoSaving,  setInfoSaving]  = useState(false)
  const [infoSaved,   setInfoSaved]   = useState(false)
  const [infoError,   setInfoError]   = useState('')

  const [prefSaving,  setPrefSaving]  = useState(false)
  const [prefSaved,   setPrefSaved]   = useState(false)
  const [prefError,   setPrefError]   = useState('')

  const [specSaving,  setSpecSaving]  = useState(false)

  // ── Snapshots for change-detection ────────────────────────────────────────
  const [savedInfo,  setSavedInfo]  = useState(null)
  const [savedPrefs, setSavedPrefs] = useState(null)

  // ── "Create faculty" state (new only) ─────────────────────────────────────
  const [createSaving, setCreateSaving] = useState(false)
  const [createError,  setCreateError]  = useState('')

  useEffect(() => {
    if (isNew) return
    getFaculty().then(list => {
      const found = list.find(f => f.id === id)
      if (found) {
        const data = { ...empty, ...found, specializations: found.specializations || [] }
        setForm(data)
        setSavedInfo({ name: data.name, email: data.email, status: data.status,
          AcademicRank: data.AcademicRank, Department: data.Department,
          Educational_attainment: data.Educational_attainment, Sex: data.Sex, max_units: data.max_units })
        setSavedPrefs({ preferredDays: [...(data.preferredDays || [])],
          preferredTimeStart: data.preferredTimeStart, preferredTimeEnd: data.preferredTimeEnd,
          maxConsecutiveHours: data.maxConsecutiveHours })
      }
    })
  }, [id])

  // ── Change detection flags ─────────────────────────────────────────────────
  const infoChanged = savedInfo != null && (
    ['name','email','status','AcademicRank','Department','Educational_attainment','Sex'].some(k => form[k] !== savedInfo[k]) ||
    form.max_units !== savedInfo.max_units
  )
  const prefsChanged = savedPrefs != null && (
    form.preferredTimeStart !== savedPrefs.preferredTimeStart ||
    form.preferredTimeEnd   !== savedPrefs.preferredTimeEnd ||
    form.maxConsecutiveHours !== savedPrefs.maxConsecutiveHours ||
    JSON.stringify([...(form.preferredDays || [])].sort()) !== JSON.stringify([...(savedPrefs.preferredDays || [])].sort())
  )

  // ── Save: Basic Information ────────────────────────────────────────────────
  async function handleSaveInfo() {
    setInfoError(''); setInfoSaving(true)
    try {
      const { name, email, status, AcademicRank, Department,
              Educational_attainment, Sex, max_units } = form
      await updateFaculty(id, { name, email, status, AcademicRank,
        Department, Educational_attainment, Sex, max_units })
      setSavedInfo({ name, email, status, AcademicRank, Department, Educational_attainment, Sex, max_units })
      setInfoSaved(true); setTimeout(() => setInfoSaved(false), 2500)
    } catch (err) {
      setInfoError(err.response?.data?.detail || 'Save failed. Please try again.')
    } finally { setInfoSaving(false) }
  }

  // ── Save: Schedule Preferences ─────────────────────────────────────────────
  async function handleSavePrefs() {
    setPrefError(''); setPrefSaving(true)
    try {
      const { preferredDays, preferredTimeStart, preferredTimeEnd, maxConsecutiveHours } = form
      await updateFaculty(id, { preferredDays, preferredTimeStart, preferredTimeEnd, maxConsecutiveHours })
      setSavedPrefs({ preferredDays: [...(preferredDays || [])], preferredTimeStart, preferredTimeEnd, maxConsecutiveHours })
      setPrefSaved(true); setTimeout(() => setPrefSaved(false), 2500)
    } catch (err) {
      setPrefError(err.response?.data?.detail || 'Save failed. Please try again.')
    } finally { setPrefSaving(false) }
  }

  // ── Save: Specializations (called directly from modal) ─────────────────────
  async function handleSaveSpecs(specs) {
    setSpecSaving(true)
    try {
      const cleanedSpecs = specs.filter(s =>
        typeof s === 'object' ? s.courseCode?.trim() : s?.trim()
      )
      await updateFaculty(id, { specializations: cleanedSpecs })
      setForm(f => ({ ...f, specializations: cleanedSpecs }))
      setShowSpecModal(false)
    } catch (err) {
      // Keep modal open so user sees it failed — surface error inside modal via alert for now
      alert(err.response?.data?.detail || 'Failed to save specializations. Please try again.')
    } finally { setSpecSaving(false) }
  }

  // ── Create faculty (new only) ──────────────────────────────────────────────
  async function handleCreate(e) {
    e.preventDefault()
    setCreateError(''); setCreateSaving(true)
    try {
      const cleanedSpecs = form.specializations.filter(s =>
        typeof s === 'object' ? s.courseCode?.trim() : s?.trim()
      )
      const data = { ...form, specializations: cleanedSpecs }
      if (!data.email) { setCreateError('Email is required.'); setCreateSaving(false); return }
      const result = await addFaculty({ ...data, initial_password: password || undefined })
      setCreatedPassword(result.temp_password || password || '')
    } catch (err) {
      setCreateError(err.response?.data?.detail || 'Create failed. Please try again.')
    } finally { setCreateSaving(false) }
  }

  function toggleDay(day) {
    setForm(f => ({
      ...f,
      preferredDays: f.preferredDays.includes(day)
        ? f.preferredDays.filter(d => d !== day)
        : [...f.preferredDays, day],
    }))
  }

  async function handleDelete() {
    setDeleting(true)
    try {
      await deleteFaculty(id)
      navigate('/dashboard/faculty')
    } catch { setDeleting(false) }
  }

  // ── Success screen after create ────────────────────────────────────────────
  if (createdPassword) {
    return (
      <div style={{ padding:'28px 32px', fontFamily:"'Poppins',sans-serif", maxWidth:560 }}>
        <style>{`@keyframes slideUp{from{opacity:0;transform:translateY(12px)}to{opacity:1;transform:translateY(0)}}`}</style>
        <div style={{ display:'flex', alignItems:'center', gap:10, marginBottom:22 }}>
          <button onClick={() => navigate('/dashboard/faculty')} style={{ background:'none', border:'none', color:'#8883B0', cursor:'pointer', display:'flex', alignItems:'center', gap:5, fontSize:12.5, fontFamily:"'Poppins',sans-serif", padding:0 }}>
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><line x1="19" y1="12" x2="5" y2="12"/><polyline points="12 19 5 12 12 5"/></svg>
            Faculty
          </button>
          <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="#D8D3F5" strokeWidth="2"><line x1="5" y1="12" x2="19" y2="12"/><polyline points="12 5 19 12 12 19"/></svg>
          <span style={{ fontSize:12.5, color:'#1a1a2e', fontWeight:600 }}>Account Created</span>
        </div>
        <div style={{ background:'#fff', borderRadius:18, border:'1px solid #E8E4F8', overflow:'hidden', boxShadow:'0 4px 20px rgba(124,111,205,0.1)' }}>
          <div style={{ padding:'28px 28px 20px', borderBottom:'1px solid #F0EDF9', display:'flex', gap:14, alignItems:'center' }}>
            <div style={{ width:44, height:44, borderRadius:'50%', background:'#E6FAF3', display:'flex', alignItems:'center', justifyContent:'center', flexShrink:0 }}>
              <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="#059669" strokeWidth="2.5"><polyline points="20 6 9 17 4 12"/></svg>
            </div>
            <div>
              <div style={{ fontSize:15, fontWeight:700, color:'#059669' }}>Account created successfully</div>
              <div style={{ fontSize:12, color:'#8883B0', marginTop:2 }}>Share the temporary password with {form.name || form.email}.</div>
            </div>
          </div>
          <div style={{ padding:'24px 28px' }}>
            <div style={{ fontSize:11, fontWeight:700, color:'#8883B0', textTransform:'uppercase', letterSpacing:'.6px', marginBottom:10 }}>Temporary Password</div>
            <div style={{ display:'flex', gap:10, marginBottom:20 }}>
              <code style={{ flex:1, padding:'12px 16px', background:'#F5F4FB', borderRadius:10, border:'1.5px solid #E8E4F8', fontSize:15, fontFamily:'monospace', letterSpacing:2, color:'#1a1a2e' }}>{createdPassword}</code>
              <button onClick={() => { navigator.clipboard.writeText(createdPassword); setPasswordCopied(true); setTimeout(() => setPasswordCopied(false), 2000) }} style={{
                padding:'12px 16px', borderRadius:10, border:'1.5px solid #E8E4F8',
                background: passwordCopied ? '#E6FAF3' : '#fff', color: passwordCopied ? '#059669' : '#7C6FCD',
                fontSize:12.5, fontWeight:600, cursor:'pointer', fontFamily:"'Poppins',sans-serif",
                display:'flex', alignItems:'center', gap:6, whiteSpace:'nowrap', transition:'all 0.2s',
              }}>
                {passwordCopied ? <><svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"><polyline points="20 6 9 17 4 12"/></svg> Copied!</> : <><svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><rect x="9" y="9" width="13" height="13" rx="2"/><path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1"/></svg> Copy</>}
              </button>
            </div>
            <div style={{ fontSize:11.5, color:'#B0ABCC', background:'#FAFAFE', borderRadius:8, padding:'10px 14px', border:'1px solid #F0EDF9', marginBottom:22 }}>
              The faculty member must log out and back in to pick up their new role.
            </div>
            <div style={{ display:'flex', gap:10 }}>
              <button onClick={() => navigate('/dashboard/faculty')} style={{ padding:'9px 18px', borderRadius:9, border:'none', background:'linear-gradient(135deg,#7C6FCD,#5a4fbf)', color:'#fff', fontSize:13, fontWeight:600, cursor:'pointer', fontFamily:"'Poppins',sans-serif" }}>
                Back to Faculty List
              </button>
              <button onClick={() => { setCreatedPassword(''); setForm(empty); setPassword('') }} style={{ padding:'9px 16px', borderRadius:9, border:'1.5px solid #E8E4F8', background:'#fff', color:'#8883B0', fontSize:13, fontWeight:600, cursor:'pointer', fontFamily:"'Poppins',sans-serif" }}>
                Add Another
              </button>
            </div>
          </div>
        </div>
      </div>
    )
  }

  const isOverloaded = (form.units ?? 0) > (form.max_units ?? 21)

  return (
    <div style={{ padding:'28px 32px', fontFamily:"'Poppins',sans-serif" }}>
      <style>{`
        @keyframes slideUp  { from { opacity:0; transform:translateY(12px) } to { opacity:1; transform:translateY(0) } }
        @keyframes fadeIn   { from { opacity:0 } to { opacity:1 } }
        @keyframes slideIn  { from { opacity:0; transform:translateY(-6px) } to { opacity:1; transform:translateY(0) } }
        @keyframes spin     { to   { transform:rotate(360deg) } }
        input:focus, select:focus, textarea:focus { border-color:#7C6FCD !important; outline:none; box-shadow:0 0 0 3px rgba(124,111,205,0.12); }
      `}</style>

      {/* Compact breadcrumb + delete */}
      <div style={{ display:'flex', alignItems:'center', justifyContent:'space-between', marginBottom:20 }}>
        <div style={{ display:'flex', alignItems:'center', gap:8 }}>
          <button onClick={() => navigate('/dashboard/faculty')} style={{ background:'none', border:'none', color:'#8883B0', cursor:'pointer', display:'flex', alignItems:'center', gap:5, fontSize:12.5, fontFamily:"'Poppins',sans-serif", padding:0 }}>
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><line x1="19" y1="12" x2="5" y2="12"/><polyline points="12 19 5 12 12 5"/></svg>
            Faculty
          </button>
          <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="#D8D3F5" strokeWidth="2"><line x1="5" y1="12" x2="19" y2="12"/><polyline points="12 5 19 12 12 19"/></svg>
          <span style={{ fontSize:12.5, color:'#1a1a2e', fontWeight:600 }}>{isNew ? 'New Faculty' : (form.name || 'Edit Faculty')}</span>
          {!isNew && form.status && (
            <span style={{
              padding:'1px 8px', borderRadius:99, fontSize:10.5, fontWeight:700,
              background: form.status === 'full-time' ? '#E6FAF3' : '#F5F4FB',
              color: form.status === 'full-time' ? '#059669' : '#8883B0',
            }}>{form.status}</span>
          )}
          {!isNew && isOverloaded && (
            <span style={{ padding:'1px 8px', borderRadius:99, fontSize:10.5, fontWeight:700, background:'#FFE8E8', color:'#C0392B' }}>Overloaded</span>
          )}
        </div>
        {!isNew && (
          <button onClick={() => setShowDeleteModal(true)} style={{
            display:'flex', alignItems:'center', gap:5, padding:'6px 12px', borderRadius:8,
            border:'1.5px solid #FFD0D0', background:'#FFF5F5', color:'#C0392B',
            fontSize:11.5, fontWeight:600, cursor:'pointer', fontFamily:"'Poppins',sans-serif", transition:'all 0.15s',
          }}>
            <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <polyline points="3 6 5 6 21 6"/><path d="M19 6l-1 14a2 2 0 0 1-2 2H8a2 2 0 0 1-2-2L5 6"/>
            </svg>
            Delete
          </button>
        )}
      </div>

      {/* New faculty info banner */}
      {isNew && (
        <div style={{ background:'#EBF0FF', border:'1px solid #B3D4F5', borderRadius:12, padding:'12px 16px', marginBottom:20, display:'flex', gap:10, alignItems:'flex-start' }}>
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="#2563EB" strokeWidth="2" style={{ flexShrink:0, marginTop:1 }}><circle cx="12" cy="12" r="10"/><line x1="12" y1="8" x2="12" y2="12"/><line x1="12" y1="16" x2="12.01" y2="16"/></svg>
          <span style={{ fontSize:12.5, color:'#1a4a7c', lineHeight:1.5 }}>
            Adding a faculty member automatically creates their Firebase login account and assigns the <code style={{ background:'#D6E8F7', padding:'1px 5px', borderRadius:4 }}>faculty</code> role.
          </span>
        </div>
      )}

      <form onSubmit={handleCreate}>
        <div style={{ display:'flex', flexDirection:'column', gap:18 }}>

          {/* ── Basic Information ── */}
          <div style={{ background:'#fff', borderRadius:16, border:'1px solid #E8E4F8', overflow:'hidden', boxShadow:'0 2px 10px rgba(124,111,205,0.06)' }}>
            <div style={{ padding:'14px 20px', borderBottom:'1px solid #F0EDF9', display:'flex', alignItems:'center', gap:8 }}>
              <div style={{ width:28, height:28, borderRadius:8, background:'#EEEAFB', display:'flex', alignItems:'center', justifyContent:'center' }}>
                <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="#7C6FCD" strokeWidth="2"><path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2"/><circle cx="12" cy="7" r="4"/></svg>
              </div>
              <span style={{ fontSize:13, fontWeight:700, color:'#1a1a2e', flex:1 }}>Basic Information</span>
              {!isNew && infoChanged && <SectionSaveBtn saving={infoSaving} saved={infoSaved} onClick={handleSaveInfo} />}
            </div>
            <div style={{ padding:'18px 20px', display:'grid', gridTemplateColumns:'1fr 1fr', gap:'16px 20px' }}>

              <FormField label="Full Name" required>
                <input value={form.name} onChange={e => setForm(f => ({...f, name: e.target.value}))} required
                  style={{ padding:'8px 11px', borderRadius:8, border:'1.5px solid #E8E4F8', fontSize:13, fontFamily:"'Poppins',sans-serif" }} />
              </FormField>

              <FormField label="Email" required={isNew} hint={isNew ? 'Used as login credential' : undefined}>
                <input type="email" value={form.email || ''} onChange={e => setForm(f => ({...f, email: e.target.value}))} required={isNew}
                  style={{ padding:'8px 11px', borderRadius:8, border:'1.5px solid #E8E4F8', fontSize:13, fontFamily:"'Poppins',sans-serif" }} />
              </FormField>

              {/* ── Academic Rank (synced options) ── */}
              <FormField label="Academic Rank">
                <select value={form.AcademicRank || ''} onChange={e => setForm(f => ({...f, AcademicRank: e.target.value}))}
                  style={{ padding:'8px 11px', borderRadius:8, border:'1.5px solid #E8E4F8', fontSize:13, fontFamily:"'Poppins',sans-serif", background:'#fff' }}>
                  <option value="">— select —</option>
                  {ACADEMIC_RANKS.map(r => <option key={r} value={r}>{r}</option>)}
                </select>
              </FormField>

              {/* ── Employment Status (synced) ── */}
              <FormField label="Employment Status">
                <select value={form.status} onChange={e => setForm(f => ({...f, status: e.target.value}))}
                  style={{ padding:'8px 11px', borderRadius:8, border:'1.5px solid #E8E4F8', fontSize:13, fontFamily:"'Poppins',sans-serif", background:'#fff' }}>
                  <option value="full-time">Full-time</option>
                  <option value="part-time">Part-time</option>
                </select>
              </FormField>

              {/* ── Department (synced) ── */}
              <FormField label="Department">
                <select value={form.Department || ''} onChange={e => setForm(f => ({...f, Department: e.target.value}))}
                  style={{ padding:'8px 11px', borderRadius:8, border:'1.5px solid #E8E4F8', fontSize:13, fontFamily:"'Poppins',sans-serif", background:'#fff' }}>
                  <option value="">— select —</option>
                  {DEPARTMENTS.map(d => <option key={d} value={d}>{d}</option>)}
                </select>
              </FormField>

              {/* ── Educational Attainment ── */}
              <FormField label="Educational Attainment" hint="e.g. Master's Degree, PhD">
                <input
                  type="text"
                  value={form.Educational_attainment || ''}
                  onChange={e => setForm(f => ({...f, Educational_attainment: e.target.value}))}
                  placeholder="Enter degree or credential…"
                  style={{ padding:'8px 11px', borderRadius:8, border:'1.5px solid #E8E4F8', fontSize:13, fontFamily:"'Poppins',sans-serif" }}
                />
              </FormField>

              {/* ── Sex ── */}
              <FormField label="Sex">
                <select value={form.Sex || ''} onChange={e => setForm(f => ({...f, Sex: e.target.value}))}
                  style={{ padding:'8px 11px', borderRadius:8, border:'1.5px solid #E8E4F8', fontSize:13, fontFamily:"'Poppins',sans-serif", background:'#fff' }}>
                  <option value="">— select —</option>
                  <option value="Male">Male</option>
                  <option value="Female">Female</option>
                  <option value="Other">Other / Prefer not to say</option>
                </select>
              </FormField>

              <FormField label="Max Units" hint="Maximum teaching load per term">
                <input type="number" value={form.max_units} min={0} max={30}
                  onChange={e => setForm(f => ({...f, max_units: Number(e.target.value)}))}
                  style={{ padding:'8px 11px', borderRadius:8, border:'1.5px solid #E8E4F8', fontSize:13, fontFamily:"'Poppins',sans-serif" }} />
              </FormField>

              {isNew && (
                <FormField label="Temporary Password" hint="Leave blank to auto-generate (min. 6 chars)">
                  <div style={{ display:'flex', gap:8 }}>
                    <input
                      type={showPassword ? 'text' : 'password'}
                      value={password}
                      onChange={e => setPassword(e.target.value)}
                      placeholder="Auto-generated if blank"
                      autoComplete="new-password"
                      style={{ flex:1, padding:'8px 11px', borderRadius:8, border:'1.5px solid #E8E4F8', fontSize:13, fontFamily:"'Poppins',sans-serif" }}
                    />
                    <button type="button" onClick={() => setShowPassword(v => !v)}
                      style={{ padding:'8px 12px', borderRadius:8, border:'1.5px solid #E8E4F8', background:'#F5F4FB', color:'#8883B0', fontSize:12, cursor:'pointer', fontFamily:"'Poppins',sans-serif", whiteSpace:'nowrap' }}>
                      {showPassword ? 'Hide' : 'Show'}
                    </button>
                  </div>
                </FormField>
              )}
            </div>
            {infoError && !isNew && (
              <div style={{ margin:'0 20px 14px', padding:'8px 12px', borderRadius:8, background:'#FFE8E8', border:'1px solid #FFCCCC', display:'flex', gap:6, alignItems:'center', animation:'slideIn 0.15s ease' }}>
                <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="#C0392B" strokeWidth="2"><circle cx="12" cy="12" r="10"/><line x1="12" y1="8" x2="12" y2="12"/><line x1="12" y1="16" x2="12.01" y2="16"/></svg>
                <span style={{ fontSize:12, color:'#C0392B', fontWeight:500 }}>{infoError}</span>
              </div>
            )}
          </div>

          {/* ── Specializations (enhanced) ── */}
          <div style={{ background:'#fff', borderRadius:16, border:'1px solid #E8E4F8', overflow:'hidden', boxShadow:'0 2px 10px rgba(124,111,205,0.06)' }}>
            <div style={{ padding:'14px 20px', borderBottom:'1px solid #F0EDF9', display:'flex', alignItems:'center', justifyContent:'space-between' }}>
              <div style={{ display:'flex', alignItems:'center', gap:8 }}>
                <div style={{ width:28, height:28, borderRadius:8, background:'#EBF0FF', display:'flex', alignItems:'center', justifyContent:'center' }}>
                  <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="#2563EB" strokeWidth="2"><path d="M4 19.5A2.5 2.5 0 0 1 6.5 17H20"/><path d="M6.5 2H20v20H6.5A2.5 2.5 0 0 1 4 19.5v-15A2.5 2.5 0 0 1 6.5 2z"/></svg>
                </div>
                <div>
                  <span style={{ fontSize:13, fontWeight:700, color:'#1a1a2e' }}>Specializations</span>
                  <span style={{ fontSize:11.5, color:'#8883B0', marginLeft:8 }}>
                    {form.specializations.length > 0 ? `${form.specializations.length} course${form.specializations.length !== 1 ? 's' : ''}` : 'None added'}
                  </span>
                </div>
              </div>
              <button type="button" onClick={() => setShowSpecModal(true)} style={{
                display:'flex', alignItems:'center', gap:6, padding:'6px 14px', borderRadius:8,
                background:'linear-gradient(135deg,#7C6FCD,#5a4fbf)', color:'#fff',
                border:'none', fontSize:12, fontWeight:600, cursor:'pointer', fontFamily:"'Poppins',sans-serif",
                boxShadow:'0 2px 8px rgba(124,111,205,0.3)',
              }}>
                <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"><line x1="12" y1="5" x2="12" y2="19"/><line x1="5" y1="12" x2="19" y2="12"/></svg>
                Manage
              </button>
            </div>
            <div style={{ padding:'16px 20px' }}>
              {form.specializations.length === 0 ? (
                <button type="button" onClick={() => setShowSpecModal(true)} style={{
                  width:'100%', padding:'20px', borderRadius:10,
                  border:'2px dashed #E8E4F8', background:'#FAFAFE',
                  cursor:'pointer', display:'flex', flexDirection:'column', alignItems:'center', gap:8,
                  transition:'all 0.15s', fontFamily:"'Poppins',sans-serif",
                }}>
                  <div style={{ width:36, height:36, borderRadius:'50%', background:'#EEEAFB', display:'flex', alignItems:'center', justifyContent:'center' }}>
                    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="#7C6FCD" strokeWidth="2"><line x1="12" y1="5" x2="12" y2="19"/><line x1="5" y1="12" x2="19" y2="12"/></svg>
                  </div>
                  <span style={{ fontSize:13, color:'#8883B0', fontWeight:500 }}>Click to add course specializations</span>
                </button>
              ) : (
                <div style={{ display:'flex', gap:8, flexWrap:'wrap' }}>
                  {form.specializations.map((spec, i) => {
                    const code   = typeof spec === 'object' ? spec.courseCode : spec
                    const rating = typeof spec === 'object' ? spec.rating : 3
                    return (
                      <div key={i} style={{
                        display:'inline-flex', alignItems:'center', gap:7,
                        padding:'5px 10px 5px 8px', borderRadius:99,
                        background:'#F0EDF9', border:'1.5px solid #E0DAF8',
                      }}>
                        <span style={{ fontSize:11.5, fontWeight:700, color:'#5a4fbf' }}>{code}</span>
                        <span style={{ display:'inline-flex', gap:1 }}>
                          {[1,2,3,4,5].map(s => (
                            <svg key={s} width="8" height="8" viewBox="0 0 24 24"
                              fill={s <= rating ? '#7C6FCD' : 'none'}
                              stroke={s <= rating ? '#7C6FCD' : '#D8D3F5'} strokeWidth="2">
                              <polygon points="12 2 15.09 8.26 22 9.27 17 14.14 18.18 21.02 12 17.77 5.82 21.02 7 14.14 2 9.27 8.91 8.26 12 2"/>
                            </svg>
                          ))}
                        </span>
                        <span style={{ fontSize:9.5, color: RATING_COLORS[rating], fontWeight:700 }}>
                          {RATING_LABELS[rating]}
                        </span>
                      </div>
                    )
                  })}
                  <button type="button" onClick={() => setShowSpecModal(true)} style={{
                    padding:'5px 12px', borderRadius:99, fontSize:11, fontWeight:600,
                    border:'1.5px dashed #C4BBF0', background:'#FAFAFE', color:'#7C6FCD',
                    cursor:'pointer', fontFamily:"'Poppins',sans-serif",
                  }}>+ Edit</button>
                </div>
              )}
            </div>
          </div>

          {/* ── Schedule Preferences ── */}
          <div style={{ background:'#fff', borderRadius:16, border:'1px solid #E8E4F8', overflow:'hidden', boxShadow:'0 2px 10px rgba(124,111,205,0.06)' }}>
            <div style={{ padding:'14px 20px', borderBottom:'1px solid #F0EDF9', display:'flex', alignItems:'center', gap:8 }}>
              <div style={{ width:28, height:28, borderRadius:8, background:'#FEF3CD', display:'flex', alignItems:'center', justifyContent:'center' }}>
                <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="#D97706" strokeWidth="2"><rect x="3" y="4" width="18" height="18" rx="2"/><line x1="16" y1="2" x2="16" y2="6"/><line x1="8" y1="2" x2="8" y2="6"/><line x1="3" y1="10" x2="21" y2="10"/></svg>
              </div>
              <span style={{ fontSize:13, fontWeight:700, color:'#1a1a2e', flex:1 }}>Schedule Preferences</span>
              {!isNew && prefsChanged && <SectionSaveBtn saving={prefSaving} saved={prefSaved} onClick={handleSavePrefs} />}
            </div>
            <div style={{ padding:'18px 20px', display:'flex', flexDirection:'column', gap:18 }}>
              <FormField label="Preferred Teaching Days">
                <div style={{ display:'flex', gap:6, flexWrap:'wrap', marginTop:2 }}>
                  {DAYS.map(day => (
                    <button key={day} type="button" onClick={() => toggleDay(day)} style={{
                      padding:'5px 13px', fontSize:12, borderRadius:20, fontFamily:"'Poppins',sans-serif",
                      background: form.preferredDays.includes(day) ? 'linear-gradient(135deg,#7C6FCD,#5a4fbf)' : '#F5F4FB',
                      color: form.preferredDays.includes(day) ? '#fff' : '#8883B0',
                      border: `1.5px solid ${form.preferredDays.includes(day) ? 'transparent' : '#E8E4F8'}`,
                      cursor:'pointer', transition:'all 0.15s',
                      boxShadow: form.preferredDays.includes(day) ? '0 2px 8px rgba(124,111,205,0.28)' : 'none',
                      fontWeight: form.preferredDays.includes(day) ? 600 : 500,
                    }}>{day.slice(0, 3)}</button>
                  ))}
                </div>
              </FormField>
              <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr 1fr', gap:'16px 20px' }}>
                <FormField label="Preferred Start (hr)" hint="e.g. 7 = 7:00 AM">
                  <input type="number" min={6} max={20} step={0.5} value={form.preferredTimeStart}
                    onChange={e => setForm(f => ({...f, preferredTimeStart: Number(e.target.value)}))}
                    style={{ padding:'8px 11px', borderRadius:8, border:'1.5px solid #E8E4F8', fontSize:13, fontFamily:"'Poppins',sans-serif" }} />
                </FormField>
                <FormField label="Preferred End (hr)" hint="e.g. 21 = 9:00 PM">
                  <input type="number" min={7} max={21} step={0.5} value={form.preferredTimeEnd}
                    onChange={e => setForm(f => ({...f, preferredTimeEnd: Number(e.target.value)}))}
                    style={{ padding:'8px 11px', borderRadius:8, border:'1.5px solid #E8E4F8', fontSize:13, fontFamily:"'Poppins',sans-serif" }} />
                </FormField>
                <FormField label="Max Consecutive Hrs">
                  <input type="number" min={1} max={8} step={0.5} value={form.maxConsecutiveHours}
                    onChange={e => setForm(f => ({...f, maxConsecutiveHours: Number(e.target.value)}))}
                    style={{ padding:'8px 11px', borderRadius:8, border:'1.5px solid #E8E4F8', fontSize:13, fontFamily:"'Poppins',sans-serif" }} />
                </FormField>
              </div>
            </div>
            {prefError && !isNew && (
              <div style={{ margin:'0 20px 14px', padding:'8px 12px', borderRadius:8, background:'#FFE8E8', border:'1px solid #FFCCCC', display:'flex', gap:6, alignItems:'center', animation:'slideIn 0.15s ease' }}>
                <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="#C0392B" strokeWidth="2"><circle cx="12" cy="12" r="10"/><line x1="12" y1="8" x2="12" y2="12"/><line x1="12" y1="16" x2="12.01" y2="16"/></svg>
                <span style={{ fontSize:12, color:'#C0392B', fontWeight:500 }}>{prefError}</span>
              </div>
            )}
          </div>

          {/* Create Faculty button — new faculty only */}
          {isNew && (
            <>
              {createError && (
                <div style={{ background:'#FFE8E8', border:'1px solid #FFCCCC', borderRadius:10, padding:'10px 14px', display:'flex', gap:8, alignItems:'center', animation:'slideIn 0.15s ease' }}>
                  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="#C0392B" strokeWidth="2"><circle cx="12" cy="12" r="10"/><line x1="12" y1="8" x2="12" y2="12"/><line x1="12" y1="16" x2="12.01" y2="16"/></svg>
                  <span style={{ fontSize:12.5, color:'#C0392B', fontWeight:500 }}>{createError}</span>
                </div>
              )}
              <div style={{ display:'flex', gap:10 }}>
                <button type="submit" disabled={createSaving} style={{
                  display:'inline-flex', alignItems:'center', gap:6,
                  padding:'8px 18px', borderRadius:10, border:'none',
                  fontFamily:"'Poppins',sans-serif", fontSize:12.5, fontWeight:600,
                  cursor: createSaving ? 'default' : 'pointer', transition:'all 0.15s',
                  background:'linear-gradient(135deg,#7C6FCD,#5a4fbf)', color:'#fff',
                  boxShadow:'0 3px 12px rgba(124,111,205,0.32)', opacity: createSaving ? 0.65 : 1,
                }}>
                  {createSaving
                    ? <><svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" style={{ animation:'spin 1s linear infinite' }}><path d="M21 12a9 9 0 1 1-6.219-8.56"/></svg>Creating…</>
                    : <><svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"><polyline points="20 6 9 17 4 12"/></svg>Create Faculty</>
                  }
                </button>
                <button type="button" onClick={() => navigate('/dashboard/faculty')} style={{
                  display:'inline-flex', alignItems:'center', gap:6,
                  padding:'8px 16px', borderRadius:10,
                  border:'1.5px solid #E8E4F8', fontFamily:"'Poppins',sans-serif",
                  fontSize:12.5, fontWeight:600, cursor:'pointer', transition:'all 0.13s',
                  background:'#fff', color:'#8883B0',
                }}>Cancel</button>
              </div>
            </>
          )}

          {/* ── Schedule Section (existing faculty only) ── */}
          {!isNew && (
            <ScheduleSection facultyName={form.name} />
          )}

        </div>
      </form>

      {/* Specialization Modal — saves directly to API */}
      {showSpecModal && (
        <SpecializationModal
          specializations={form.specializations}
          onSave={isNew
            ? specs => { setForm(f => ({...f, specializations: specs})); setShowSpecModal(false) }
            : handleSaveSpecs
          }
          isSaving={specSaving}
          onClose={() => setShowSpecModal(false)}
        />
      )}

      {/* Delete Confirm Modal */}
      {showDeleteModal && (
        <DeleteConfirmModal
          name={form.name}
          deleting={deleting}
          onConfirm={handleDelete}
          onCancel={() => setShowDeleteModal(false)}
        />
      )}
    </div>
  )
}