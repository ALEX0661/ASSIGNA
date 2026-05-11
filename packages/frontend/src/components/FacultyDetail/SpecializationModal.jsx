import { useState, useEffect, useMemo } from 'react'
import { getCourses } from '../../services/api'
import { RATING_COLORS, RATING_LABELS, dedupeSpecs, FormField, StarRating } from './fdShared'

export default function SpecializationModal({ specializations, onSave, onClose, isSaving }) {
  const [specs,        setSpecs]        = useState(() => dedupeSpecs(specializations))
  const [tab,          setTab]          = useState('current')
  const [sortBy,       setSortBy]       = useState('rating-desc')
  const [newCode,      setNewCode]      = useState('')
  const [newRating,    setNewRating]    = useState(3)
  const [codeError,    setCodeError]    = useState('')
  const [courseSearch, setCourseSearch] = useState('')
  const [courses,      setCourses]      = useState([])
  const [loadingCrs,   setLoadingCrs]   = useState(false)
  const [browseRating, setBrowseRating] = useState(3)

  useEffect(() => {
    setLoadingCrs(true)
    getCourses()
      .then(res => {
        const raw  = Array.isArray(res) ? res : (res?.courses ?? res?.data ?? [])
        const norm = raw.map(c => ({ courseCode:c.courseCode||c.course_code||c.code||c.Code||'', title:c.Title||c.title||c.name||c.courseName||'' })).filter(c => c.courseCode||c.title)
        const seen = new Set()
        setCourses(norm.filter(c => { const k=(c.courseCode||c.title).toLowerCase(); if(seen.has(k)) return false; seen.add(k); return true }))
      })
      .catch(() => setCourses([]))
      .finally(() => setLoadingCrs(false))
  }, [])

  const existingCodes   = useMemo(() => new Set(specs.map(s => (s.courseCode||'').toLowerCase().trim())), [specs])
  const courseTitleMap  = useMemo(() => { const m={}; courses.forEach(c => { if(c.courseCode) m[c.courseCode.toLowerCase().trim()]=c.title||'' }); return m }, [courses])

  const filteredCourses = useMemo(() => {
    const q = courseSearch.toLowerCase()
    return courses
      .filter(c => c.courseCode.toLowerCase().includes(q)||c.title.toLowerCase().includes(q))
      .sort((a,b) => {
        const aA=existingCodes.has(a.courseCode.toLowerCase()), bA=existingCodes.has(b.courseCode.toLowerCase())
        if(aA&&!bA) return 1; if(!aA&&bA) return -1
        return a.courseCode.localeCompare(b.courseCode)
      })
  }, [courses, courseSearch, existingCodes])

  const sortedSpecs = useMemo(() => {
    const copy = [...specs]
    if(sortBy==='code-asc')    copy.sort((a,b) => (a.courseCode||'').localeCompare(b.courseCode||''))
    if(sortBy==='rating-desc') copy.sort((a,b) => (b.rating||3)-(a.rating||3))
    if(sortBy==='rating-asc')  copy.sort((a,b) => (a.rating||3)-(b.rating||3))
    return copy
  }, [specs, sortBy])

  function addManual() {
    const code = newCode.trim().toUpperCase()
    if(!code) { setCodeError('Enter a course code'); return }
    if(existingCodes.has(code.toLowerCase())) { setCodeError('Already added'); return }
    setSpecs(p => [...p,{courseCode:code,rating:newRating}])
    setNewCode(''); setNewRating(3); setCodeError('')
  }

  const specCount = specs.length

  function TabBtn({ k, label }) {
    const active = tab===k
    return <button onClick={() => setTab(k)} style={{ padding:'6px 14px', borderRadius:8, fontSize:12.5, fontWeight:600, cursor:'pointer', fontFamily:"'Poppins',sans-serif", border:active?'none':'1.5px solid #E8E4F8', background:active?'linear-gradient(135deg,#7C6FCD,#5a4fbf)':'#F5F4FB', color:active?'#fff':'#8883B0' }}>{label}</button>
  }

  return (
    <div style={{ position:'fixed', inset:0, zIndex:1000, background:'rgba(26,26,46,0.45)', backdropFilter:'blur(4px)', display:'flex', alignItems:'center', justifyContent:'center', padding:'24px 16px' }}>
      <div style={{ background:'#fff', borderRadius:20, width:'100%', maxWidth:580, boxShadow:'0 24px 64px rgba(26,26,46,0.22)', overflow:'hidden', display:'flex', flexDirection:'column', maxHeight:'88vh' }}>

        {/* Header */}
        <div style={{ padding:'20px 24px 14px', borderBottom:'1px solid #F0EDF9' }}>
          <div style={{ display:'flex', alignItems:'center', justifyContent:'space-between', marginBottom:12 }}>
            <div>
              <div style={{ fontSize:16, fontWeight:700, color:'#1a1a2e' }}>Specializations</div>
              <div style={{ fontSize:12, color:'#8883B0', marginTop:2 }}>Manage courses and proficiency levels</div>
            </div>
            <button onClick={onClose} style={{ width:32, height:32, borderRadius:8, border:'1px solid #E8E4F8', background:'#F5F4FB', display:'flex', alignItems:'center', justifyContent:'center', cursor:'pointer', padding:0 }}>
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="#8883B0" strokeWidth="2.5"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg>
            </button>
          </div>
          <div style={{ display:'flex', gap:8 }}>
            <TabBtn k="current" label={`Current (${specCount})`}/>
            <TabBtn k="browse"  label="Browse Courses"/>
            <TabBtn k="manual"  label="Add Manual"/>
          </div>
        </div>

        {/* Body */}
        <div style={{ flex:1, overflowY:'auto', padding:'16px 24px' }}>

          {/* Current — empty */}
          {tab==='current' && specs.length===0 && (
            <div style={{ display:'flex', flexDirection:'column', alignItems:'center', justifyContent:'center', padding:'36px 0', gap:10 }}>
              <div style={{ width:44, height:44, borderRadius:12, background:'#EEEAFB', display:'flex', alignItems:'center', justifyContent:'center' }}>
                <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="#7C6FCD" strokeWidth="1.8"><path d="M4 19.5A2.5 2.5 0 0 1 6.5 17H20"/><path d="M6.5 2H20v20H6.5A2.5 2.5 0 0 1 4 19.5v-15A2.5 2.5 0 0 1 6.5 2z"/></svg>
              </div>
              <div style={{ textAlign:'center' }}>
                <div style={{ fontSize:13, fontWeight:600, color:'#1a1a2e', marginBottom:3 }}>No specializations yet</div>
                <div style={{ fontSize:11.5, color:'#B0ABCC' }}>Use Browse or Add Manual to get started</div>
              </div>
            </div>
          )}

          {/* Current — list */}
          {tab==='current' && specs.length>0 && (
            <div>
              <div style={{ display:'flex', alignItems:'center', justifyContent:'space-between', marginBottom:10 }}>
                <span style={{ fontSize:11, color:'#B0ABCC' }}>{specCount===1?'1 course':`${specCount} courses`}</span>
                <div style={{ display:'flex', alignItems:'center', gap:4 }}>
                  <span style={{ fontSize:10.5, color:'#C4BFDF', fontWeight:600 }}>Sort:</span>
                  {[{key:'rating-desc',label:'Best first'},{key:'code-asc',label:'A – Z'},{key:'rating-asc',label:'Lowest'}].map(opt => (
                    <button key={opt.key} type="button" onClick={() => setSortBy(opt.key)} style={{ padding:'2px 8px', borderRadius:6, fontSize:11, fontWeight:sortBy===opt.key?700:500, background:sortBy===opt.key?'#EEEAFB':'transparent', color:sortBy===opt.key?'#7C6FCD':'#C4BFDF', border:sortBy===opt.key?'1px solid #D8D3F5':'1px solid transparent', cursor:'pointer', fontFamily:"'Poppins',sans-serif" }}>{opt.label}</button>
                  ))}
                </div>
              </div>
              <div style={{ display:'flex', flexDirection:'column', gap:6 }}>
                {sortedSpecs.map((spec,idx) => {
                  const origIdx = specs.indexOf(spec)
                  const rc  = RATING_COLORS[spec.rating]||'#8883B0'
                  const rl  = RATING_LABELS[spec.rating]||''
                  const rbg = spec.rating>=4?'#E6FAF3':spec.rating>=3?'#EEEAFB':'#FEF3CD'
                  const title = spec.title||courseTitleMap[(spec.courseCode||'').toLowerCase().trim()]||''
                  return (
                    <div key={idx} style={{ display:'flex', alignItems:'center', gap:10, padding:'10px 12px', borderRadius:10, border:'1px solid #EDE9FA', background:'#FDFCFF' }}>
                      <div style={{ flex:1, minWidth:0, display:'flex', flexDirection:'column', gap:3 }}>
                        <div style={{ display:'flex', alignItems:'center', gap:7 }}>
                          <span style={{ padding:'1px 8px', borderRadius:99, fontSize:10.5, fontWeight:700, background:'#EEEAFB', color:'#7C6FCD', border:'1px solid #D8D3F5', whiteSpace:'nowrap', flexShrink:0 }}>{spec.courseCode}</span>
                          {title && <span style={{ fontSize:11.5, color:'#4a4a6a', overflow:'hidden', textOverflow:'ellipsis', whiteSpace:'nowrap', fontWeight:500 }}>{title}</span>}
                        </div>
                        <StarRating value={spec.rating} onChange={r => setSpecs(p => p.map((s,i) => i===origIdx?{...s,rating:r}:s))}/>
                      </div>
                      <span style={{ fontSize:10, fontWeight:700, padding:'2px 7px', borderRadius:99, flexShrink:0, background:rbg, color:rc, whiteSpace:'nowrap' }}>{rl}</span>
                      <button onClick={() => setSpecs(p => p.filter((_,i) => i!==origIdx))} style={{ width:26, height:26, borderRadius:7, border:'1px solid #FFD0D0', background:'#FFF5F5', color:'#C0392B', flexShrink:0, display:'flex', alignItems:'center', justifyContent:'center', cursor:'pointer', padding:0 }}>
                        <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg>
                      </button>
                    </div>
                  )
                })}
              </div>
            </div>
          )}

          {/* Browse */}
          {tab==='browse' && (
            <div>
              <div style={{ display:'flex', alignItems:'center', gap:10, marginBottom:12 }}>
                <div style={{ position:'relative', flex:1 }}>
                  <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="#B0ABCC" strokeWidth="2" style={{ position:'absolute', left:10, top:'50%', transform:'translateY(-50%)', pointerEvents:'none' }}><circle cx="11" cy="11" r="8"/><line x1="21" y1="21" x2="16.65" y2="16.65"/></svg>
                  <input type="text" placeholder="Search course code or title..." value={courseSearch} onChange={e => setCourseSearch(e.target.value)} style={{ width:'100%', padding:'8px 10px 8px 30px', borderRadius:9, border:'1.5px solid #E8E4F8', fontSize:12.5, fontFamily:"'Poppins',sans-serif", boxSizing:'border-box', outline:'none' }}/>
                </div>
                <div style={{ display:'flex', alignItems:'center', gap:6, flexShrink:0 }}>
                  <span style={{ fontSize:11, color:'#B0ABCC' }}>Rating:</span>
                  <StarRating value={browseRating} onChange={setBrowseRating} size={16}/>
                </div>
              </div>
              {loadingCrs
                ? <div style={{ display:'flex', alignItems:'center', gap:8, color:'#B0ABCC', fontSize:12.5, padding:'12px 0' }}><svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" style={{ animation:'spin 1s linear infinite' }}><path d="M21 12a9 9 0 1 1-6.219-8.56"/></svg>Loading courses...</div>
                : (
                  <div style={{ display:'flex', flexDirection:'column', gap:5, maxHeight:340, overflowY:'auto' }}>
                    {filteredCourses.length===0 && <div style={{ fontSize:12.5, color:'#B0ABCC', padding:'12px 0', textAlign:'center' }}>No matching courses.</div>}
                    {filteredCourses.map(course => {
                      const code    = course.courseCode||course.title
                      const already = existingCodes.has(code.toLowerCase())
                      return (
                        <div key={code} style={{ display:'flex', alignItems:'center', gap:10, padding:'9px 12px', borderRadius:9, border:`1px solid ${already?'#D8D3F5':'#EDE9FA'}`, background:already?'#F5F4FB':'#FDFCFF', opacity:already?0.65:1 }}>
                          <div style={{ flex:1, minWidth:0 }}>
                            <div style={{ fontSize:12, fontWeight:700, color:'#5a4fbf' }}>{course.courseCode}</div>
                            {course.title && <div style={{ fontSize:11, color:'#8883B0', overflow:'hidden', textOverflow:'ellipsis', whiteSpace:'nowrap' }}>{course.title}</div>}
                          </div>
                          <button type="button" onClick={() => { if(already) return; const c=(course.courseCode||course.title).trim(); setSpecs(p => [...p,{courseCode:c,title:course.title||'',rating:browseRating}]) }} disabled={already} style={{ padding:'4px 12px', borderRadius:7, border:'none', fontSize:11.5, fontWeight:600, cursor:already?'default':'pointer', fontFamily:"'Poppins',sans-serif", background:already?'#EEEAFB':'linear-gradient(135deg,#7C6FCD,#5a4fbf)', color:already?'#A99BE8':'#fff', whiteSpace:'nowrap' }}>
                            {already?'Added':'+ Add'}
                          </button>
                        </div>
                      )
                    })}
                  </div>
                )
              }
            </div>
          )}

          {/* Manual */}
          {tab==='manual' && (
            <div style={{ display:'flex', flexDirection:'column', gap:14 }}>
              <FormField label="Course Code" hint="e.g. CS101, MATH201">
                <input type="text" value={newCode} onChange={e => { setNewCode(e.target.value.toUpperCase()); setCodeError('') }} onKeyDown={e => { if(e.key==='Enter'){e.preventDefault();addManual()} }} placeholder="Enter course code..." style={{ padding:'8px 11px', borderRadius:8, border:`1.5px solid ${codeError?'#FFCCCC':'#E8E4F8'}`, fontSize:13, fontFamily:"'Poppins',sans-serif", width:'100%', boxSizing:'border-box' }}/>
                {codeError && <span style={{ fontSize:11, color:'#C0392B' }}>{codeError}</span>}
              </FormField>
              <FormField label="Proficiency Rating">
                <StarRating value={newRating} onChange={setNewRating} size={22}/>
              </FormField>
              <button type="button" onClick={addManual} style={{ alignSelf:'flex-start', padding:'8px 18px', borderRadius:9, border:'none', background:'linear-gradient(135deg,#7C6FCD,#5a4fbf)', color:'#fff', fontSize:12.5, fontWeight:600, cursor:'pointer', fontFamily:"'Poppins',sans-serif" }}>Add Course</button>
            </div>
          )}
        </div>

        {/* Footer */}
        <div style={{ padding:'14px 24px', borderTop:'1px solid #F0EDF9', display:'flex', justifyContent:'space-between', alignItems:'center', background:'#FAFAFE' }}>
          <span style={{ fontSize:11.5, color:'#B0ABCC' }}>{specCount===1?'1 specialization':`${specCount} specializations`}</span>
          <div style={{ display:'flex', gap:8 }}>
            <button onClick={onClose} style={{ padding:'8px 16px', borderRadius:9, border:'1.5px solid #E8E4F8', background:'#fff', color:'#8883B0', fontSize:12.5, fontWeight:600, cursor:'pointer', fontFamily:"'Poppins',sans-serif" }}>Cancel</button>
            <button onClick={() => onSave(specs)} disabled={isSaving} style={{ display:'inline-flex', alignItems:'center', gap:6, padding:'8px 18px', borderRadius:9, border:'none', background:'linear-gradient(135deg,#7C6FCD,#5a4fbf)', color:'#fff', fontSize:12.5, fontWeight:600, cursor:isSaving?'default':'pointer', fontFamily:"'Poppins',sans-serif", opacity:isSaving?0.65:1 }}>
              {isSaving && <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" style={{ animation:'spin 0.8s linear infinite' }}><path d="M21 12a9 9 0 1 1-6.219-8.56"/></svg>}
              {isSaving?'Saving...':specCount>0?`Save (${specCount})`:'Save'}
            </button>
          </div>
        </div>
      </div>
    </div>
  )
}
