import { useState, useRef } from 'react'
import { uploadFaculty, extractFacultySheets, commitFaculty } from '../services/api'

if (!document.getElementById('ifm-style')) {
  const s = document.createElement('style')
  s.id = 'ifm-style'
  s.textContent = `
    @keyframes ifmSpin   { to { transform: rotate(360deg) } }
    @keyframes ifmFadeIn { from { opacity:0; transform:translateY(6px) } to { opacity:1; transform:translateY(0) } }
    @keyframes ifmPop    { 0%{transform:scale(.92);opacity:0} 100%{transform:scale(1);opacity:1} }

    .ifm-primary {
      display:inline-flex; align-items:center; gap:7px;
      padding:9px 20px; border-radius:10px; border:none;
      font-family:'Poppins',sans-serif; font-size:12.5px; font-weight:600;
      cursor:pointer; transition:all .15s;
      background:linear-gradient(135deg,#7C6FCD,#5a4fbf); color:#fff;
      box-shadow:0 3px 12px rgba(124,111,205,.32);
    }
    .ifm-primary:hover:not(:disabled) { background:linear-gradient(135deg,#8E82D9,#6A5FD2); transform:translateY(-1px); box-shadow:0 5px 18px rgba(124,111,205,.4); }
    .ifm-primary:active:not(:disabled) { transform:translateY(0); }
    .ifm-primary:disabled { opacity:.45; cursor:default; transform:none; box-shadow:none; }

    .ifm-ghost {
      display:inline-flex; align-items:center; gap:6px;
      padding:8px 15px; border-radius:10px;
      border:1.5px solid #E8E4F8; font-family:'Poppins',sans-serif;
      font-size:12px; font-weight:500; cursor:pointer;
      background:#fff; color:#8883B0; transition:all .13s;
    }
    .ifm-ghost:hover:not(:disabled) { background:#F5F4FB; border-color:#C5BBEF; color:#5a4fbf; }
    .ifm-ghost:disabled { opacity:.45; cursor:default; }

    .ifm-close {
      display: inline-flex; align-items: center; justify-content: center;
      width: 32px; height: 32px; border-radius: 8px;
      border: 1.5px solid #E8E4F8; cursor: pointer;
      background: #F5F4FB; color: #7C6FCD; transition: all 0.2s; flex-shrink: 0;
      padding: 0;
    }
    .ifm-close:hover { background:#FFE8E8; border-color:#FECACA; color:#DC2626; }

    .ifm-sheet-btn {
      text-align:left; display:flex; align-items:center; gap:10px;
      padding:12px 16px; border-radius:10px; border:1.5px solid #E8E4F8;
      background:#FAFAFE; cursor:pointer; transition:all .13s;
      font-family:'Poppins',sans-serif; font-size:13px; font-weight:600; color:#1a1a2e;
    }
    .ifm-sheet-btn:hover:not(:disabled) { background:#F0EDF9; border-color:#C5BBEF; }
    .ifm-sheet-btn.active { background:#F0EDF9; border-color:#A99BE8; }
    .ifm-sheet-btn:disabled { opacity:.5; cursor:wait; }

    .ifm-card {
      display:flex; align-items:center; gap:14px;
      padding:12px 16px; border-radius:11px;
      border:1.5px solid #E8E4F8; background:#FAFAFE;
      transition:border-color .12s;
      animation: ifmFadeIn .15s ease both;
    }
    .ifm-card:hover { border-color:#C5BBEF; }

    .ifm-remove {
      width:24px; height:24px; border-radius:7px;
      border:1.5px solid #FECACA; background:#FFF5F5; color:#DC2626;
      display:inline-flex; align-items:center; justify-content:center;
      cursor:pointer; transition:all .12s; flex-shrink:0; margin-left:auto;
      padding: 0;
    }
    .ifm-remove:hover { background:#FEE2E2; border-color:#FCA5A5; }
  `
  document.head.appendChild(s)
}

const Spin = () => (
  <div style={{ width:16, height:16, border:'2px solid #E8E4F8', borderTopColor:'#7C6FCD', borderRadius:'50%', animation:'ifmSpin .8s linear infinite', flexShrink:0 }} />
)

const ErrBox = ({ msg }) => !msg ? null : (
  <div style={{ background:'#FFF5F5', border:'1px solid #FECACA', borderRadius:9, padding:'9px 13px', fontSize:12, color:'#DC2626', display:'flex', alignItems:'center', gap:7 }}>
    <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"><circle cx="12" cy="12" r="10"/><line x1="12" y1="8" x2="12" y2="12"/><line x1="12" y1="16" x2="12.01" y2="16"/></svg>
    {msg}
  </div>
)

const HintBox = ({ children }) => (
  <div style={{ background:'#F7F5FD', border:'1px solid #E8E4F8', borderRadius:10, padding:'11px 14px', fontSize:12, color:'#8883B0', lineHeight:1.65 }}>
    {children}
  </div>
)

const StatusBadge = ({ status }) => (
  <span style={{
    fontSize:10, fontWeight:700, padding:'2px 9px', borderRadius:99, flexShrink:0,
    background: status === 'full-time' ? '#EEF9F0' : '#FFF7ED',
    color:      status === 'full-time' ? '#16A34A' : '#D97706',
    border:     `1px solid ${status === 'full-time' ? '#A7F3D0' : '#FDE68A'}`,
  }}>
    {status === 'full-time' ? 'Full-time' : 'Part-time'}
  </span>
)

const ratingColor = r => r >= 4 ? '#16A34A' : r === 3 ? '#7C6FCD' : r === 2 ? '#D97706' : '#B0ABCC'

function Steps({ current }) {
  const labels = ['Upload', 'Select Sheets', 'Review & Import']
  return (
    <div style={{ display:'flex', alignItems:'center', marginBottom:26, padding:'0 2px' }}>
      {labels.map((label, i) => {
        const idx = i + 1, done = idx < current, active = idx === current
        return (
          <div key={label} style={{ display:'flex', alignItems:'center', flex: i < labels.length - 1 ? 1 : 'none' }}>
            <div style={{ display:'flex', flexDirection:'column', alignItems:'center', gap:5 }}>
              <div style={{
                width:30, height:30, borderRadius:'50%', display:'flex', alignItems:'center', justifyContent:'center',
                fontSize:12, fontWeight:700, flexShrink:0, transition:'all .2s',
                background: done ? 'linear-gradient(135deg,#7C6FCD,#5a4fbf)' : active ? 'linear-gradient(135deg,#A99BE8,#7C6FCD)' : '#F0EDF9',
                color: (done || active) ? '#fff' : '#C0BBDC',
                boxShadow: active ? '0 3px 12px rgba(124,111,205,.35)' : done ? '0 2px 8px rgba(124,111,205,.2)' : 'none',
              }}>
                {done
                  ? <svg width="12" height="9" viewBox="0 0 12 9" fill="none"><polyline points="1,4.5 4.5,8 11,1" stroke="white" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"/></svg>
                  : idx}
              </div>
              <span style={{ fontSize:10.5, fontWeight:active?700:500, color:active?'#7C6FCD':done?'#A99BE8':'#C0BBDC', whiteSpace:'nowrap', letterSpacing:'.3px' }}>
                {label}
              </span>
            </div>
            {i < labels.length - 1 && (
              <div style={{ flex:1, height:2, margin:'0 8px 18px', borderRadius:99, background: done ? 'linear-gradient(90deg,#7C6FCD,#A99BE8)' : '#E8E4F8', transition:'background .3s' }} />
            )}
          </div>
        )
      })}
    </div>
  )
}

function UploadStep({ onUploaded }) {
  const [dragging, setDragging] = useState(false)
  const [loading,  setLoading]  = useState(false)
  const [error,    setError]    = useState('')
  const inputRef = useRef()

  async function processFile(file) {
    if (!file) return
    if (!file.name.match(/\.(xlsx|xls)$/i)) { setError('Please upload an .xlsx or .xls file.'); return }
    setLoading(true); setError('')
    try {
      const res = await uploadFaculty(file)
      if (!res.sheets?.length) { setError('No sheets found in the file.'); return }
      onUploaded(res.sheets, res.fileData)
    } catch (err) {
      setError(err.response?.data?.detail || 'Could not read the file. Check the format and try again.')
    } finally { setLoading(false) }
  }

  return (
    <div style={{ display:'flex', flexDirection:'column', gap:14 }}>
      <div
        onDragOver={e => { e.preventDefault(); setDragging(true) }}
        onDragLeave={() => setDragging(false)}
        onDrop={e => { e.preventDefault(); setDragging(false); processFile(e.dataTransfer.files[0]) }}
        onClick={() => !loading && inputRef.current?.click()}
        style={{
          border:`2px dashed ${dragging ? '#7C6FCD' : '#D8D3F5'}`, borderRadius:14,
          padding:'44px 24px', textAlign:'center',
          background: dragging ? '#F7F5FD' : '#FAFAFE',
          cursor: loading ? 'wait' : 'pointer', transition:'all .15s',
        }}
      >
        {loading ? (
          <div style={{ display:'flex', flexDirection:'column', alignItems:'center', gap:10 }}>
            <div style={{ width:40, height:40, borderRadius:'50%', border:'3px solid #E8E4F8', borderTopColor:'#7C6FCD', animation:'ifmSpin .8s linear infinite' }} />
            <p style={{ fontSize:13, color:'#8883B0', fontWeight:500, margin:0 }}>Reading file…</p>
          </div>
        ) : (
          <>
            <div style={{ width:54, height:54, margin:'0 auto 14px', borderRadius:14, display:'flex', alignItems:'center', justifyContent:'center', background: dragging ? 'linear-gradient(135deg,#7C6FCD,#5a4fbf)' : 'linear-gradient(135deg,#EEEAFB,#E0D9F7)', boxShadow: dragging ? '0 6px 20px rgba(124,111,205,.35)' : 'none', transition:'all .15s' }}>
              <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke={dragging?'#fff':'#7C6FCD'} strokeWidth="2">
                <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/>
                <polyline points="17 8 12 3 7 8"/><line x1="12" y1="3" x2="12" y2="15"/>
              </svg>
            </div>
            <p style={{ fontWeight:700, fontSize:14, color:'#1a1a2e', marginBottom:4 }}>{dragging ? 'Drop it here!' : 'Drop your Faculty Matrix Excel file'}</p>
            <p style={{ fontSize:12, color:'#B0ABCC', margin:0 }}>or <span style={{ color:'#7C6FCD', fontWeight:600 }}>click to browse</span> · .xlsx or .xls</p>
          </>
        )}
      </div>
      <input ref={inputRef} type="file" accept=".xlsx,.xls" style={{ display:'none' }} onChange={e => { processFile(e.target.files[0]); e.target.value = null }} />
      <ErrBox msg={error} />
      <HintBox>
        <strong style={{ color:'#7C6FCD' }}>Expected format:</strong> Columns = faculty names · Rows = course codes · Cells = rating (0–5)
        <br />Each sheet is treated as one employment group (e.g. "Full Time", "Part Time").
      </HintBox>
    </div>
  )
}

function SheetStep({ sheets, fileData, onParsed, onBack }) {
  const [selected, setSelected] = useState(new Set())
  const [loading,  setLoading]  = useState(false)
  const [error,    setError]    = useState('')

  function toggle(name) {
    setSelected(prev => {
      const next = new Set(prev)
      next.has(name) ? next.delete(name) : next.add(name)
      return next
    })
  }

  function toggleAll() {
    setSelected(prev => prev.size === sheets.length ? new Set() : new Set(sheets))
  }

  async function handleExtract() {
    if (selected.size === 0) { setError('Select at least one sheet.'); return }
    setLoading(true); setError('')
    try {
      const res = await extractFacultySheets({ fileData, sheetNames: [...selected] })
      if (!res.preview?.length) { setError('No faculty data found in the selected sheet(s). Check the format.'); setLoading(false); return }

      // Split course codes like "ITC121/CSP121" into separate entries with the same rating
      const splitPreview = res.preview.map(faculty => {
        const expanded = faculty.specializations.flatMap(spec => {
          const codes = spec.courseCode.split('/').map(c => c.trim()).filter(Boolean)
          return codes.map(code => ({ ...spec, courseCode: code }))
        })

        // Deduplicate by courseCode — keep the highest rating when the same code appears more than once
        const seen = new Map()
        for (const spec of expanded) {
          const key = spec.courseCode.toUpperCase()
          if (!seen.has(key) || spec.rating > seen.get(key).rating) {
            seen.set(key, spec)
          }
        }

        return { ...faculty, specializations: [...seen.values()] }
      })

      onParsed(splitPreview)
    } catch (err) {
      setError(err.response?.data?.detail || 'Error parsing the selected sheets.')
      setLoading(false)
    }
  }

  const allSelected = selected.size === sheets.length

  return (
    <div style={{ display:'flex', flexDirection:'column', gap:14 }}>
      <p style={{ fontSize:13, color:'#8883B0', margin:0 }}>
        Select the sheet(s) that contain faculty specialization data. You can import all at once.
      </p>

      <button
        onClick={toggleAll}
        disabled={loading}
        style={{ alignSelf:'flex-start', display:'flex', alignItems:'center', gap:7, padding:'5px 12px', borderRadius:8, border:'1.5px solid #E8E4F8', background: allSelected ? '#F0EDF9' : '#fff', cursor:'pointer', fontSize:12, fontWeight:600, color: allSelected ? '#7C6FCD' : '#8883B0', fontFamily:'Poppins,sans-serif', transition:'all .12s' }}
      >
        <div style={{ width:14, height:14, borderRadius:4, border:`1.5px solid ${allSelected?'#7C6FCD':'#C0BBDC'}`, background:allSelected?'#7C6FCD':'transparent', display:'flex', alignItems:'center', justifyContent:'center' }}>
          {allSelected && <svg width="8" height="6" viewBox="0 0 8 6" fill="none"><polyline points="1,3 3,5 7,1" stroke="white" strokeWidth="1.4" strokeLinecap="round" strokeLinejoin="round"/></svg>}
        </div>
        Select all sheets
      </button>

      <div style={{ display:'flex', flexDirection:'column', gap:8 }}>
        {sheets.map(name => {
          const isSelected = selected.has(name)
          const isPartTime = name.toLowerCase().includes('part')
          return (
            <button
              key={name}
              onClick={() => toggle(name)}
              disabled={loading}
              className={`ifm-sheet-btn${isSelected ? ' active' : ''}`}
            >
              <div style={{ width:16, height:16, borderRadius:5, border:`1.5px solid ${isSelected?'#7C6FCD':'#C0BBDC'}`, background:isSelected?'#7C6FCD':'transparent', display:'flex', alignItems:'center', justifyContent:'center', flexShrink:0, transition:'all .12s' }}>
                {isSelected && <svg width="8" height="6" viewBox="0 0 8 6" fill="none"><polyline points="1,3 3,5 7,1" stroke="white" strokeWidth="1.4" strokeLinecap="round" strokeLinejoin="round"/></svg>}
              </div>
              <div style={{ width:28, height:28, borderRadius:7, background: isPartTime ? '#FFF7ED' : '#EEEAFB', display:'flex', alignItems:'center', justifyContent:'center' }}>
                <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke={isPartTime?'#D97706':'#7C6FCD'} strokeWidth="2">
                  <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/>
                  <polyline points="14 2 14 8 20 8"/>
                  <line x1="16" y1="13" x2="8" y2="13"/><line x1="16" y1="17" x2="8" y2="17"/>
                </svg>
              </div>
              <span style={{ flex:1 }}>{name}</span>
              <span style={{ fontSize:10, fontWeight:600, padding:'2px 8px', borderRadius:99, background: isPartTime?'#FFF7ED':'#EEF9F0', color: isPartTime?'#D97706':'#16A34A', border:`1px solid ${isPartTime?'#FDE68A':'#A7F3D0'}` }}>
                {isPartTime ? 'Part-time' : 'Full-time'}
              </span>
              {loading && isSelected && <Spin />}
            </button>
          )
        })}
      </div>

      <ErrBox msg={error} />

      <div style={{ display:'flex', gap:8 }}>
        <button className="ifm-primary" onClick={handleExtract} disabled={loading || selected.size === 0}>
          {loading ? <><Spin />Parsing…</> : <>Continue — {selected.size} sheet{selected.size !== 1 ? 's' : ''}</>}
        </button>
        <button className="ifm-ghost" onClick={onBack} disabled={loading}>
          <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"><polyline points="15 18 9 12 15 6"/></svg>
          Back
        </button>
      </div>
    </div>
  )
}

function FacultyCard({ faculty, onRemove, animDelay }) {
  const [expanded, setExpanded] = useState(false)
  const specs     = faculty.specializations || []
  const topSpecs  = specs.filter(s => s.rating >= 4).slice(0, 5)
  const totalGood = specs.filter(s => s.rating >= 3).length

  return (
    <div className="ifm-card" style={{ flexDirection:'column', alignItems:'stretch', animationDelay:`${animDelay}ms`, cursor:'pointer' }} onClick={() => setExpanded(e => !e)}>
      <div style={{ display:'flex', alignItems:'center', gap:12 }}>
        <div style={{ width:36, height:36, borderRadius:10, background:'linear-gradient(135deg,#EEEAFB,#D8D3F5)', display:'flex', alignItems:'center', justifyContent:'center', flexShrink:0, fontSize:13, fontWeight:700, color:'#7C6FCD' }}>
          {faculty.name.split(',')[0].charAt(0)}
        </div>

        <div style={{ flex:1, minWidth:0 }}>
          <div style={{ display:'flex', alignItems:'center', gap:7, flexWrap:'wrap' }}>
            <span style={{ fontSize:13, fontWeight:700, color:'#1a1a2e' }}>{faculty.name}</span>
            <StatusBadge status={faculty.status} />
          </div>
          <div style={{ fontSize:11.5, color:'#8883B0', marginTop:2 }}>
            <strong style={{ color:'#7C6FCD' }}>{totalGood}</strong> rated courses · <strong style={{ color:'#1a1a2e' }}>{specs.length}</strong> total
          </div>
        </div>

        <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="#C0BBDC" strokeWidth="2.5" style={{ transition:'transform .2s', transform: expanded ? 'rotate(180deg)' : 'rotate(0deg)', flexShrink:0 }}>
          <polyline points="6 9 12 15 18 9"/>
        </svg>

        <button className="ifm-remove" onClick={e => { e.stopPropagation(); onRemove() }} title="Remove faculty">
          <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
            <line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/>
          </svg>
        </button>
      </div>

      {!expanded && topSpecs.length > 0 && (
        <div style={{ display:'flex', flexWrap:'wrap', gap:5, marginTop:8, marginLeft:48 }}>
          {topSpecs.map(s => (
            <span key={s.courseCode} style={{ fontSize:10.5, fontWeight:600, padding:'2px 8px', borderRadius:99, background:'#F0EDF9', color:'#7C6FCD', border:'1px solid #E8E4F8' }}>
              {s.courseCode}
              <span style={{ marginLeft:4, color: ratingColor(s.rating), fontWeight:700 }}>{s.rating}</span>
            </span>
          ))}
          {specs.filter(s => s.rating >= 4).length > 5 && (
            <span style={{ fontSize:10.5, color:'#B0ABCC', padding:'2px 4px' }}>+{specs.filter(s => s.rating >= 4).length - 5} more</span>
          )}
        </div>
      )}

      {expanded && (
        <div style={{ marginTop:10, marginLeft:48, display:'flex', flexDirection:'column', gap:6 }} onClick={e => e.stopPropagation()}>
          {[5, 4, 3, 2, 1].map(r => {
            const group = specs.filter(s => s.rating === r)
            if (!group.length) return null
            return (
              <div key={r} style={{ display:'flex', alignItems:'flex-start', gap:8 }}>
                <div style={{ display:'flex', alignItems:'center', gap:5, flexShrink:0, marginTop:3 }}>
                  <div style={{ width:7, height:7, borderRadius:'50%', background: ratingColor(r), flexShrink:0 }} />
                  <span style={{ fontSize:11, fontWeight:700, color: ratingColor(r), minWidth:14 }}>{r}</span>
                </div>
                <div style={{ display:'flex', flexWrap:'wrap', gap:4 }}>
                  {group.map(s => (
                    <span key={s.courseCode} style={{ fontSize:10.5, padding:'2px 8px', borderRadius:99, background:'#F7F5FD', color:'#5a4fbf', border:'1px solid #E8E4F8', fontWeight:500 }}>
                      {s.courseCode}
                    </span>
                  ))}
                </div>
              </div>
            )
          })}
        </div>
      )}
    </div>
  )
}

function ReviewStep({ faculty, setFaculty, onBack, onImported }) {
  const [saving,  setSaving]  = useState(false)
  const [results, setResults] = useState(null)
  const [error,   setError]   = useState('')
  const [query,   setQuery]   = useState('')

  const filtered  = query.trim() ? faculty.filter(f => f.name.toLowerCase().includes(query.trim().toLowerCase())) : faculty
  const fullTime  = faculty.filter(f => f.status === 'full-time').length
  const partTime  = faculty.filter(f => f.status === 'part-time').length

  async function handleCommit() {
    setSaving(true); setError('')
    try {
      const res = await commitFaculty(faculty)
      setResults(res)
    } catch (err) {
      setError(err.response?.data?.detail || 'Server error. Please try again.')
    } finally { setSaving(false) }
  }

  function removeFaculty(name) {
    setFaculty(prev => prev.filter(f => f.name !== name))
  }

  if (results) {
    const allGood = results.failed.length === 0
    return (
      <div style={{ display:'flex', flexDirection:'column', gap:16, animation:'ifmPop .2s ease' }}>
        {allGood ? (
          <div style={{ textAlign:'center', padding:'36px 0', display:'flex', flexDirection:'column', alignItems:'center', gap:14 }}>
            <div style={{ width:60, height:60, borderRadius:'50%', background:'linear-gradient(135deg,#7C6FCD,#5a4fbf)', display:'flex', alignItems:'center', justifyContent:'center', boxShadow:'0 6px 20px rgba(124,111,205,.35)' }}>
              <svg width="26" height="20" viewBox="0 0 26 20" fill="none"><polyline points="2,10 9,17 24,2" stroke="white" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"/></svg>
            </div>
            <div>
              <p style={{ fontWeight:700, fontSize:17, color:'#1a1a2e', marginBottom:5 }}>
                {results.committed} {results.committed !== 1 ? 'faculty records' : 'faculty record'} imported!
              </p>
              <p style={{ color:'#8883B0', fontSize:13, margin:0 }}>
                Specializations saved. Add emails to each profile to enable faculty login.
              </p>
            </div>
          </div>
        ) : (
          <>
            <div style={{ background:'#FEF3CD', border:'1px solid #F0C040', borderRadius:10, padding:'12px 16px' }}>
              <p style={{ fontWeight:700, fontSize:13, color:'#1a1a2e', marginBottom:3 }}>{results.committed} saved · {results.failed.length} failed</p>
              <p style={{ fontSize:12, color:'#8883B0', margin:0 }}>Some records could not be saved.</p>
            </div>
            <div style={{ maxHeight:200, overflowY:'auto', border:'1px solid #E8E4F8', borderRadius:10 }}>
              {results.failed.map((f, i) => (
                <div key={i} style={{ padding:'10px 14px', borderBottom: i < results.failed.length - 1 ? '1px solid #F0EDF9' : 'none', fontSize:12 }}>
                  <strong>{f.faculty?.name}</strong> — <span style={{ color:'#DC2626' }}>{f.reason}</span>
                </div>
              ))}
            </div>
          </>
        )}

        <div style={{ display: 'flex', justifyContent: 'center', marginTop: 12 }}>
          <button 
            className="ifm-primary" 
            onClick={onImported} 
            style={{ padding: '10px 40px', fontSize: 13 }}
          >
            Done
          </button>
        </div>
      </div>
    )
  }

  return (
    <div style={{ display:'flex', flexDirection:'column', gap:14 }}>
      <div style={{ display:'flex', alignItems:'center', gap:10, flexWrap:'wrap' }}>
        <span style={{ fontSize:13, color:'#8883B0' }}>
          <strong style={{ color:'#1a1a2e' }}>{faculty.length}</strong> faculty ready to import
        </span>
        <span style={{ fontSize:10.5, padding:'2px 9px', borderRadius:99, background:'#EEF9F0', color:'#16A34A', border:'1px solid #A7F3D0', fontWeight:600 }}>{fullTime} full-time</span>
        <span style={{ fontSize:10.5, padding:'2px 9px', borderRadius:99, background:'#FFF7ED', color:'#D97706', border:'1px solid #FDE68A', fontWeight:600 }}>{partTime} part-time</span>
        <span style={{ fontSize:11, color:'#B0ABCC', marginLeft:'auto' }}>Click a card to expand</span>
      </div>

      <div style={{ position:'relative' }}>
        <svg style={{ position:'absolute', left:10, top:'50%', transform:'translateY(-50%)', pointerEvents:'none' }} width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="#B0ABCC" strokeWidth="2.5"><circle cx="11" cy="11" r="8"/><line x1="21" y1="21" x2="16.65" y2="16.65"/></svg>
        <input
          value={query}
          onChange={e => setQuery(e.target.value)}
          placeholder="Search faculty name…"
          style={{ width:'100%', paddingLeft:32, paddingRight:12, paddingTop:8, paddingBottom:8, borderRadius:9, border:'1.5px solid #E8E4F8', fontFamily:'Poppins,sans-serif', fontSize:12.5, outline:'none', boxSizing:'border-box' }}
        />
      </div>

      <div style={{ maxHeight:360, overflowY:'auto', display:'flex', flexDirection:'column', gap:8, paddingRight:2 }}>
        {filtered.length === 0 && (
          <div style={{ textAlign:'center', padding:'30px 0', color:'#B0ABCC', fontSize:13 }}>No faculty match your search.</div>
        )}
        {filtered.map((f, i) => (
          <FacultyCard
            key={f.name}
            faculty={f}
            animDelay={i * 30}
            onRemove={() => removeFaculty(f.name)}
          />
        ))}
      </div>

      <ErrBox msg={error} />

      <HintBox>
        <strong style={{ color:'#7C6FCD' }}>Note:</strong> This saves faculty profiles and their specialization ratings. To enable login, open each faculty profile and add their email address after importing.
      </HintBox>

      <div style={{ display:'flex', gap:8, alignItems:'center' }}>
        <button className="ifm-primary" onClick={handleCommit} disabled={saving || faculty.length === 0}>
          {saving ? (
            <><Spin />Saving…</>
          ) : (
            <>
              <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"><polyline points="20 6 9 17 4 12"/></svg>
              Import {faculty.length} {faculty.length !== 1 ? 'faculty' : 'faculty member'}
            </>
          )}
        </button>
        <button className="ifm-ghost" onClick={onBack} disabled={saving}>
          <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"><polyline points="15 18 9 12 15 6"/></svg>
          Back
        </button>
      </div>
    </div>
  )
}

export default function ImportFacultyModal({ onClose, onImported }) {
  const [step,     setStep]     = useState(1)
  const [sheets,   setSheets]   = useState([])
  const [fileData, setFileData] = useState(null)
  const [faculty,  setFaculty]  = useState([])

  function handleUploaded(s, b) { setSheets(s); setFileData(b); setStep(2) }
  function handleParsed(preview) { setFaculty(preview); setStep(3) }

  const stepTitles = ['', 'Import Faculty from Excel', 'Select Sheets', 'Review & Import']

  return (
    <div
      style={{ position:'fixed', inset:0, background:'rgba(26,22,60,0.5)', display:'flex', alignItems:'center', justifyContent:'center', zIndex:1000, backdropFilter:'blur(4px)', animation:'ifmFadeIn .18s ease' }}
      onClick={e => e.target === e.currentTarget && onClose()}
    >
      <div style={{
        background:'#fff', borderRadius:18, padding:'26px 28px',
        width: step === 3 ? 620 : 500, maxWidth:'95vw', maxHeight:'90vh',
        overflowY:'auto', fontFamily:"'Poppins',sans-serif",
        boxShadow:'0 24px 64px rgba(26,22,60,0.24),0 4px 16px rgba(124,111,205,0.12)',
        transition:'width .2s ease',
      }}>
        <div style={{ display:'flex', justifyContent:'space-between', alignItems:'flex-start', marginBottom:22 }}>
          <div>
            <div style={{ display:'flex', alignItems:'center', gap:10, marginBottom:4 }}>
              <div style={{ width:34, height:34, borderRadius:10, background:'linear-gradient(135deg,#EEEAFB,#D8D3F5)', display:'flex', alignItems:'center', justifyContent:'center', flexShrink:0 }}>
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="#7C6FCD" strokeWidth="2">
                  <path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2"/>
                  <circle cx="9" cy="7" r="4"/>
                  <path d="M23 21v-2a4 4 0 0 0-3-3.87"/>
                  <path d="M16 3.13a4 4 0 0 1 0 7.75"/>
                </svg>
              </div>
              <h2 style={{ fontSize:16, fontWeight:700, color:'#1a1a2e', margin:0 }}>{stepTitles[step]}</h2>
            </div>
            <p style={{ fontSize:11.5, color:'#B0ABCC', margin:0, marginLeft:44 }}>
              Step {step} of 3 · Upload → Sheets → Review
            </p>
          </div>
          <button className="ifm-close" onClick={onClose}>
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round">
              <line x1="18" y1="6" x2="6" y2="18" />
              <line x1="6" y1="6" x2="18" y2="18" />
            </svg>
          </button>
        </div>

        <Steps current={step} />

        {step === 1 && <UploadStep onUploaded={handleUploaded} />}
        {step === 2 && <SheetStep sheets={sheets} fileData={fileData} onParsed={handleParsed} onBack={() => setStep(1)} />}
        {step === 3 && <ReviewStep faculty={faculty} setFaculty={setFaculty} onBack={() => setStep(2)} onImported={onImported} />}
      </div>
    </div>
  )
}