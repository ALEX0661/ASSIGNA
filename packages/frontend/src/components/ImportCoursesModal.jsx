import { useState, useRef } from 'react'
import { uploadCourses, extractSheet, commitCourses } from '../services/api'

const PROGRAMS = ['BSCS', 'BSIT', 'BSEMC-GD', 'BSEMC-DAT']

const PROGRAM_FULL = {
  'BSCS':      'BS in Computer Science',
  'BSIT':      'BS in Information Technology',
  'BSEMC-GD':  'BS in Entertainment and Multimedia Computing – Game Development',
  'BSEMC-DAT': 'BS in Entertainment and Multimedia Computing – Digital Animation Technology',
}

const ORDINAL = n => {
  const s = ['th','st','nd','rd'], v = n % 100
  return n + (s[(v-20)%10] || s[v] || s[0])
}

/* ─── Styles ────────────────────────────────────────────────────────────── */
if (!document.getElementById('import-modal-style')) {
  const s = document.createElement('style')
  s.id = 'import-modal-style'
  s.textContent = `
    .im-primary {
      display: inline-flex; align-items: center; gap: 7px;
      padding: 8px 18px; border-radius: 10px; border: none;
      font-family: 'Poppins',sans-serif; font-size: 12.5px; font-weight: 600;
      cursor: pointer; transition: all 0.15s;
      background: linear-gradient(135deg,#7C6FCD,#5a4fbf); color: #fff;
      box-shadow: 0 3px 12px rgba(124,111,205,0.32);
    }
    .im-primary:hover:not(:disabled) { background: linear-gradient(135deg,#8E82D9,#6A5FD2); box-shadow: 0 5px 18px rgba(124,111,205,0.4); transform: translateY(-1px); }
    .im-primary:active:not(:disabled) { transform: translateY(0); }
    .im-primary:disabled { opacity:.5; cursor:default; transform:none; box-shadow:none; }

    .im-back {
      display: inline-flex; align-items: center; gap: 6px;
      padding: 8px 14px; border-radius: 10px;
      border: 1.5px solid #E8E4F8; font-family: 'Poppins',sans-serif;
      font-size: 12px; font-weight: 500; cursor: pointer;
      background: #fff; color: #8883B0; transition: all 0.13s;
    }
    .im-back:hover:not(:disabled) { background: #F5F4FB; border-color: #D8D3F5; color: #5a4fbf; }
    .im-back:disabled { opacity:.5; cursor:default; }

    .im-close {
      display: inline-flex; align-items: center; justify-content: center;
      width: 30px; height: 30px; border-radius: 8px;
      border: 1.5px solid #E8E4F8; cursor: pointer;
      background: #F5F4FB; color: #8883B0; transition: all 0.13s; flex-shrink: 0;
    }
    .im-close:hover { background: #FFE8E8; border-color: #FECACA; color: #DC2626; }

    .im-row-save {
      padding: 3px 9px; border-radius: 7px; border: 1.5px solid #A7F3D0;
      background: #E6FAF3; color: #059669; font-family: 'Poppins',sans-serif;
      font-size: 11px; font-weight: 600; cursor: pointer; transition: all 0.12s;
    }
    .im-row-save:hover { background: #D1FAE5; }

    .im-row-cancel {
      padding: 3px 9px; border-radius: 7px; border: 1.5px solid #E8E4F8;
      background: #F5F4FB; color: #8883B0; font-family: 'Poppins',sans-serif;
      font-size: 11px; font-weight: 600; cursor: pointer; transition: all 0.12s;
    }
    .im-row-cancel:hover { background: #EEEAFB; border-color: #C5BBEF; color: #7C6FCD; }

    .im-row-remove {
      width: 22px; height: 22px; border-radius: 6px; border: 1.5px solid #FECACA;
      background: #FFF5F5; color: #DC2626; display: inline-flex;
      align-items: center; justify-content: center;
      cursor: pointer; transition: all 0.12s; flex-shrink: 0;
    }
    .im-row-remove:hover { background: #FEE2E2; border-color: #FCA5A5; }

    @keyframes imSpin { to{transform:rotate(360deg)} }
    @keyframes imFadeIn { from{opacity:0} to{opacity:1} }
  `
  document.head.appendChild(s)
}

/* ─── Step indicator ────────────────────────────────────────────────────── */
function Steps({ current }) {
  const steps = ['Upload','Sheet','Blocks','Review']
  return (
    <div style={{ display:'flex', alignItems:'center', marginBottom:26, padding:'0 2px' }}>
      {steps.map((label, i) => {
        const idx = i+1, done = idx < current, active = idx === current
        return (
          <div key={label} style={{ display:'flex', alignItems:'center', flex: i<steps.length-1?1:'none' }}>
            <div style={{ display:'flex', flexDirection:'column', alignItems:'center', gap:5 }}>
              <div style={{
                width:30, height:30, borderRadius:'50%', display:'flex', alignItems:'center', justifyContent:'center',
                fontSize:12, fontWeight:700, flexShrink:0, transition:'all 0.2s',
                background: done ? 'linear-gradient(135deg,#7C6FCD,#5a4fbf)' : active ? 'linear-gradient(135deg,#A99BE8,#7C6FCD)' : '#F0EDF9',
                color: (done||active) ? '#fff' : '#C0BBDC',
                boxShadow: active ? '0 3px 12px rgba(124,111,205,0.35)' : done ? '0 2px 8px rgba(124,111,205,0.2)' : 'none',
              }}>
                {done
                  ? <svg width="12" height="9" viewBox="0 0 12 9" fill="none"><polyline points="1,4.5 4.5,8 11,1" stroke="white" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"/></svg>
                  : idx}
              </div>
              <span style={{ fontSize:10.5, fontWeight:active?700:500, color:active?'#7C6FCD':done?'#A99BE8':'#C0BBDC', whiteSpace:'nowrap', letterSpacing:'.3px' }}>
                {label}
              </span>
            </div>
            {i < steps.length-1 && (
              <div style={{ flex:1, height:2, margin:'0 8px 18px', borderRadius:99, transition:'background 0.3s', background: done ? 'linear-gradient(90deg,#7C6FCD,#A99BE8)' : '#E8E4F8' }} />
            )}
          </div>
        )
      })}
    </div>
  )
}

function HintBox({ children }) {
  return (
    <div style={{ background:'#F7F5FD', border:'1px solid #E8E4F8', borderRadius:10, padding:'11px 14px', fontSize:12, color:'#8883B0', lineHeight:1.6 }}>
      {children}
    </div>
  )
}

function ErrBox({ msg }) {
  if (!msg) return null
  return (
    <div style={{ background:'#FFF5F5', border:'1px solid #FECACA', borderRadius:9, padding:'9px 13px', fontSize:12, color:'#DC2626', display:'flex', alignItems:'center', gap:7 }}>
      <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"><circle cx="12" cy="12" r="10"/><line x1="12" y1="8" x2="12" y2="12"/><line x1="12" y1="16" x2="12.01" y2="16"/></svg>
      {msg}
    </div>
  )
}

/* ─── Step 1: Upload ────────────────────────────────────────────────────── */
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
      const res = await uploadCourses(file)
      if (!res.sheets || res.sheets.length === 0) { setError('No sheets found in the file.'); return }
      onUploaded(res.sheets, res.fileData)
    } catch(err) {
      setError(err.response?.data?.detail || 'Could not parse the file. Check the format and try again.')
    } finally { setLoading(false) }
  }

  return (
    <div style={{ display:'flex', flexDirection:'column', gap:14 }}>
      <div
        onDragOver={e=>{e.preventDefault();setDragging(true)}}
        onDragLeave={()=>setDragging(false)}
        onDrop={e=>{e.preventDefault();setDragging(false);processFile(e.dataTransfer.files[0])}}
        onClick={()=>!loading&&inputRef.current?.click()}
        style={{
          border:`2px dashed ${dragging?'#7C6FCD':'#D8D3F5'}`, borderRadius:14,
          padding:'40px 24px', textAlign:'center',
          background:dragging?'#F7F5FD':'#FAFAFE',
          cursor:loading?'wait':'pointer', transition:'all .15s',
        }}
      >
        {loading ? (
          <div style={{ display:'flex', flexDirection:'column', alignItems:'center', gap:10 }}>
            <div style={{ width:40, height:40, borderRadius:'50%', border:'3px solid #E8E4F8', borderTopColor:'#7C6FCD', animation:'imSpin 0.8s linear infinite' }} />
            <p style={{ fontSize:13, color:'#8883B0', fontWeight:500 }}>Reading file…</p>
          </div>
        ) : (
          <>
            <div style={{ width:52, height:52, margin:'0 auto 14px', borderRadius:14, display:'flex', alignItems:'center', justifyContent:'center', transition:'all 0.15s', background:dragging?'linear-gradient(135deg,#7C6FCD,#5a4fbf)':'linear-gradient(135deg,#EEEAFB,#E0D9F7)', boxShadow:dragging?'0 6px 20px rgba(124,111,205,0.35)':'none' }}>
              <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke={dragging?'#fff':'#7C6FCD'} strokeWidth="2">
                <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/>
                <polyline points="17 8 12 3 7 8"/><line x1="12" y1="3" x2="12" y2="15"/>
              </svg>
            </div>
            <p style={{ fontWeight:700, fontSize:14, color:'#1a1a2e', marginBottom:4 }}>{dragging?'Drop it here!':'Drop your Excel file here'}</p>
            <p style={{ fontSize:12, color:'#B0ABCC' }}>or <span style={{ color:'#7C6FCD', fontWeight:600 }}>click to browse</span> · .xlsx or .xls</p>
          </>
        )}
      </div>
      <input ref={inputRef} type="file" accept=".xlsx,.xls" style={{ display:'none' }} onChange={e=>{processFile(e.target.files[0]);e.target.value=null}} />
      <ErrBox msg={error} />
      <HintBox>
        <strong style={{ color:'#7C6FCD' }}>Expected columns (case-insensitive):</strong>{' '}
        Course Code · Title · Program · Year Level · Units Lecture · Units Lab
        <br />Sections/blocks are configured in the next step — no column needed.
      </HintBox>
    </div>
  )
}

/* ─── Step 2: Sheet Selection ───────────────────────────────────────────── */
function SheetSelectionStep({ sheets, fileData, onParsed, onBack }) {
  const [loading, setLoading] = useState(false)
  const [active,  setActive]  = useState(null)
  const [error,   setError]   = useState('')

  async function handleSelect(sheetName) {
    setLoading(true); setActive(sheetName); setError('')
    try {
      const res = await extractSheet({ sheetName, fileData })
      if (!res.preview || res.preview.length === 0) {
        setError(`No valid courses found in sheet "${sheetName}". Check column headers.`)
        setLoading(false); setActive(null); return
      }
      onParsed(res.preview)
    } catch(err) {
      setError(err.response?.data?.detail || 'Error extracting data from this sheet.')
      setLoading(false); setActive(null)
    }
  }

  return (
    <div style={{ display:'flex', flexDirection:'column', gap:14 }}>
      <p style={{ fontSize:13, color:'#8883B0', margin:0 }}>Multiple sheets found. Select the one that contains course data.</p>
      <div style={{ display:'flex', flexDirection:'column', gap:8 }}>
        {sheets.map(name => (
          <button key={name} onClick={()=>handleSelect(name)} disabled={loading}
            style={{ textAlign:'left', padding:'13px 16px', background:active===name?'#F7F5FD':'#FAFAFE', border:`1.5px solid ${active===name?'#A99BE8':'#E8E4F8'}`, borderRadius:10, cursor:loading?'wait':'pointer', fontSize:13, fontWeight:600, color:'#1a1a2e', display:'flex', justifyContent:'space-between', alignItems:'center', transition:'all 0.15s', fontFamily:'Poppins,sans-serif' }}>
            <div style={{ display:'flex', alignItems:'center', gap:10 }}>
              <div style={{ width:30, height:30, borderRadius:8, background:'#EEEAFB', display:'flex', alignItems:'center', justifyContent:'center' }}>
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="#7C6FCD" strokeWidth="2">
                  <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/>
                  <polyline points="14 2 14 8 20 8"/>
                  <line x1="16" y1="13" x2="8" y2="13"/><line x1="16" y1="17" x2="8" y2="17"/>
                  <polyline points="10 9 9 9 8 9"/>
                </svg>
              </div>
              {name}
            </div>
            {active===name && loading
              ? <div style={{ width:16, height:16, border:'2px solid #E8E4F8', borderTopColor:'#7C6FCD', borderRadius:'50%', animation:'imSpin 0.8s linear infinite' }} />
              : <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="#C0BBDC" strokeWidth="2.5"><line x1="5" y1="12" x2="19" y2="12"/><polyline points="12 5 19 12 12 19"/></svg>}
          </button>
        ))}
      </div>
      <ErrBox msg={error} />
      <button className="im-back" onClick={onBack} disabled={loading}>
        <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"><polyline points="15 18 9 12 15 6"/></svg>
        Back
      </button>
    </div>
  )
}

/* ─── Step 3: Block config ──────────────────────────────────────────────── */
function BlockConfigStep({ courses, onBack, onSubmit }) {
  const groups = []
  const seen   = new Set()
  courses.forEach(c => {
    const key = `${c.program}_${c.yearLevel}`
    if (!seen.has(key)) { seen.add(key); groups.push({ key, program: c.program, yearLevel: Number(c.yearLevel) }) }
  })
  groups.sort((a,b) => a.program.localeCompare(b.program) || a.yearLevel-b.yearLevel)

  const [blocks, setBlocks] = useState(() => { const init={}; groups.forEach(g=>{init[g.key]=''}); return init })
  const [error,  setError]  = useState('')

  function handleSubmit(e) {
    e.preventDefault()
    const missing = groups.filter(g => !blocks[g.key] || Number(blocks[g.key]) < 1)
    if (missing.length > 0) { setError(`Please enter at least 1 block for: ${missing.map(g=>`${g.program} Y${g.yearLevel}`).join(', ')}`); return }
    onSubmit(blocks)
  }

  return (
    <form onSubmit={handleSubmit} style={{ display:'flex', flexDirection:'column', gap:14 }}>
      <p style={{ fontSize:13, color:'#8883B0', margin:0 }}>Set how many sections (blocks) exist for each program-year group found in the file.</p>
      <div style={{ display:'flex', flexDirection:'column', gap:8 }}>
        {groups.map(g => (
          <div key={g.key} style={{ display:'flex', alignItems:'center', justifyContent:'space-between', padding:'12px 16px', background:'#FAFAFE', border:'1.5px solid #E8E4F8', borderRadius:10 }}>
            <div style={{ display:'flex', alignItems:'center', gap:10 }}>
              <span style={{ background:'#EEEAFB', color:'#7C6FCD', fontSize:11, fontWeight:700, padding:'2px 10px', borderRadius:99 }}>{g.program}</span>
              <span style={{ fontSize:13, fontWeight:600, color:'#1a1a2e' }}>{ORDINAL(g.yearLevel)} Year</span>
            </div>
            <div style={{ display:'flex', alignItems:'center', gap:9 }}>
              <span style={{ fontSize:11.5, color:'#B0ABCC', fontWeight:500 }}>Sections</span>
              <input type="number" min={1} max={20} value={blocks[g.key]}
                onChange={e=>setBlocks(p=>({...p,[g.key]:e.target.value}))}
                placeholder="e.g. 3" required
                style={{ width:72, textAlign:'center', fontWeight:600, fontSize:14, padding:'6px', borderRadius:8, border:'1.5px solid #E8E4F8', fontFamily:'Poppins,sans-serif', outline:'none' }} />
            </div>
          </div>
        ))}
      </div>
      <ErrBox msg={error} />
      <div style={{ display:'flex', gap:8 }}>
        <button type="submit" className="im-primary">Continue to Review</button>
        <button type="button" className="im-back" onClick={onBack}>
          <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"><polyline points="15 18 9 12 15 6"/></svg>
          Back
        </button>
      </div>
    </form>
  )
}

/* ─── Editable row ──────────────────────────────────────────────────────── */
function EditableRow({ course, invalid, onEdit, onRemove }) {
  const [editing, setEditing] = useState(false)
  const [draft,   setDraft]   = useState({...course})

  function save() { onEdit({...draft,yearLevel:Number(draft.yearLevel),unitsLecture:Number(draft.unitsLecture),unitsLab:Number(draft.unitsLab),blocks:Number(draft.blocks)}); setEditing(false) }
  function cancel() { setDraft({...course}); setEditing(false) }

  const cellInp = (field, opts={}) => (
    <input value={draft[field]??''} onChange={e=>setDraft(d=>({...d,[field]:e.target.value}))}
      onClick={e=>e.stopPropagation()}
      style={{ width:'100%', minWidth:opts.wide?100:52, fontSize:12, padding:'3px 6px', borderRadius:6, border:'1.5px solid #D8D3F5', fontFamily:'Poppins,sans-serif', outline:'none' }}
      type={opts.number?'number':'text'} min={opts.min} />
  )

  if (editing) return (
    <tr style={{ background:'#F7F5FD' }}>
      <td style={{ padding:'6px 8px' }}>{cellInp('courseCode')}</td>
      <td style={{ padding:'6px 8px' }}>{cellInp('title',{wide:true})}</td>
      <td style={{ padding:'6px 8px' }}>
        <select value={draft.program} onChange={e=>setDraft(d=>({...d,program:e.target.value}))} onClick={e=>e.stopPropagation()}
          style={{ fontSize:12, padding:'3px 6px', borderRadius:6, border:'1.5px solid #D8D3F5', fontFamily:'Poppins,sans-serif', outline:'none' }}>
          {PROGRAMS.map(p => <option key={p} value={p}>{p}</option>)}
        </select>
      </td>
      <td style={{ padding:'6px 8px' }}>{cellInp('yearLevel',{number:true,min:1})}</td>
      <td style={{ padding:'6px 8px' }}>{cellInp('unitsLecture',{number:true,min:0})}</td>
      <td style={{ padding:'6px 8px' }}>{cellInp('unitsLab',{number:true,min:0})}</td>
      <td style={{ padding:'6px 8px' }}>{cellInp('blocks',{number:true,min:1})}</td>
      <td style={{ padding:'6px 10px' }}>
        <div style={{ display:'flex', gap:4, alignItems:'center' }}>
          <button className="im-row-save" onClick={e=>{e.stopPropagation();save()}}>✓ Save</button>
          <button className="im-row-cancel" onClick={e=>{e.stopPropagation();cancel()}}>✕</button>
        </div>
      </td>
    </tr>
  )

  return (
    <tr onClick={()=>setEditing(true)} style={{ background:invalid?'#FFF8F8':'transparent', cursor:'pointer' }}>
      <td style={{ padding:'8px 8px' }}>
        <span style={{ display:'inline-block', padding:'2px 8px', background:invalid?'#FFE8E8':'#EEEAFB', color:invalid?'#DC2626':'#7C6FCD', borderRadius:99, fontSize:11, fontWeight:700 }}>
          {course.courseCode||'—'}
        </span>
      </td>
      <td style={{ padding:'8px 8px', fontWeight:500, color:'#1a1a2e', fontSize:12.5 }}>{course.title||<span style={{color:'#FECACA'}}>—</span>}</td>
      <td style={{ padding:'8px 8px' }}>
        <span style={{ display:'inline-block', padding:'2px 8px', background:'#F0EDF9', color:'#5a4fbf', borderRadius:99, fontSize:11, fontWeight:600 }}>{course.program||'—'}</span>
      </td>
      <td style={{ textAlign:'center', fontSize:12, color:'#8883B0', padding:'8px 8px' }}>{course.yearLevel}</td>
      <td style={{ textAlign:'center', fontSize:12, color:'#8883B0', padding:'8px 8px' }}>{course.unitsLecture}</td>
      <td style={{ textAlign:'center', fontSize:12, color:'#8883B0', padding:'8px 8px' }}>{course.unitsLab}</td>
      <td style={{ textAlign:'center', padding:'8px 8px' }}>
        {Number(course.blocks)>=1
          ? <span style={{ fontSize:12, fontWeight:700, color:'#7C6FCD' }}>{course.blocks}</span>
          : <span style={{ color:'#DC2626', fontWeight:700, fontSize:12 }}>!</span>}
      </td>
      <td style={{ padding:'8px 10px' }}>
        <button className="im-row-remove" onClick={e=>{e.stopPropagation();onRemove()}} title="Remove row">
          <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
            <line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/>
          </svg>
        </button>
      </td>
    </tr>
  )
}

/* ─── Step 4: Review ────────────────────────────────────────────────────── */
function ReviewStep({ courses, onBack, onCommit, onRemove, onEdit }) {
  const [saving,  setSaving]  = useState(false)
  const [results, setResults] = useState(null)

  async function handleSave() {
    setSaving(true)
    try { const res = await onCommit(courses); setResults(res) }
    finally { setSaving(false) }
  }

  const isValid = c => c.courseCode && c.title && c.program && Number(c.blocks) >= 1
  const invalidCount = courses.filter(c=>!isValid(c)).length

  if (results) {
    const allGood = results.failed.length === 0
    return (
      <div style={{ display:'flex', flexDirection:'column', gap:14 }}>
        {allGood ? (
          <div style={{ textAlign:'center', padding:'32px 0', display:'flex', flexDirection:'column', alignItems:'center', gap:12 }}>
            <div style={{ width:56, height:56, borderRadius:'50%', background:'linear-gradient(135deg,#7C6FCD,#5a4fbf)', display:'flex', alignItems:'center', justifyContent:'center', boxShadow:'0 6px 20px rgba(124,111,205,0.35)' }}>
              <svg width="24" height="18" viewBox="0 0 24 18" fill="none"><polyline points="2,9 8,15 22,2" stroke="white" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"/></svg>
            </div>
            <div>
              <p style={{ fontWeight:700, fontSize:16, color:'#1a1a2e', marginBottom:4 }}>{results.saved} course{results.saved!==1?'s':''} imported!</p>
              <p style={{ color:'#8883B0', fontSize:13 }}>You can now use these courses in the scheduler.</p>
            </div>
          </div>
        ) : (
          <>
            <div style={{ background:'#FEF3CD', border:'1px solid #F0C040', borderRadius:10, padding:'12px 16px' }}>
              <p style={{ fontWeight:700, fontSize:13, color:'#1a1a2e', marginBottom:3 }}>{results.saved} saved · {results.failed.length} failed</p>
              <p style={{ fontSize:12, color:'#8883B0' }}>These courses couldn't be saved — they may already exist or have invalid data.</p>
            </div>
            <div style={{ border:'1px solid #E8E4F8', borderRadius:10, overflow:'hidden' }}>
              <table>
                <thead><tr><th>Code</th><th>Title</th><th>Program</th><th>Reason</th></tr></thead>
                <tbody>
                  {results.failed.map((f,i) => (
                    <tr key={i}>
                      <td><span style={{ display:'inline-block', padding:'2px 8px', background:'#EEEAFB', color:'#7C6FCD', borderRadius:99, fontSize:11, fontWeight:700 }}>{f.course.courseCode}</span></td>
                      <td style={{ fontWeight:500 }}>{f.course.title}</td>
                      <td>{f.course.program}</td>
                      <td style={{ color:'#DC2626', fontSize:12 }}>{f.reason}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </>
        )}
      </div>
    )
  }

  return (
    <div style={{ display:'flex', flexDirection:'column', gap:14 }}>
      <div style={{ display:'flex', justifyContent:'space-between', alignItems:'center' }}>
        <div style={{ display:'flex', alignItems:'center', gap:8 }}>
          <span style={{ fontSize:13, color:'#8883B0' }}>
            <strong style={{ color:'#1a1a2e' }}>{courses.length}</strong> course{courses.length!==1?'s':''} ready
          </span>
          {invalidCount > 0 && (
            <span style={{ background:'#FFF0F0', color:'#DC2626', fontSize:11, fontWeight:700, padding:'2px 9px', borderRadius:99, border:'1px solid #FECACA' }}>
              ⚠ {invalidCount} invalid
            </span>
          )}
        </div>
        <span style={{ fontSize:11, color:'#B0ABCC' }}>Click a row to edit</span>
      </div>

      <div style={{ maxHeight:320, overflowY:'auto', border:'1px solid #E8E4F8', borderRadius:10, overflow:'hidden' }}>
        <table style={{ width:'100%' }}>
          <thead style={{ position:'sticky', top:0, background:'#FAFAFE', zIndex:1 }}>
            <tr>
              <th style={{ padding:'8px 8px', fontSize:10.5, fontWeight:700, color:'#A0ABC0', textTransform:'uppercase', letterSpacing:'.5px' }}>Code</th>
              <th style={{ padding:'8px 8px', fontSize:10.5, fontWeight:700, color:'#A0ABC0', textTransform:'uppercase', letterSpacing:'.5px' }}>Title</th>
              <th style={{ padding:'8px 8px', fontSize:10.5, fontWeight:700, color:'#A0ABC0', textTransform:'uppercase', letterSpacing:'.5px' }}>Program</th>
              <th style={{ padding:'8px 8px', textAlign:'center', fontSize:10.5, fontWeight:700, color:'#A0ABC0', textTransform:'uppercase', letterSpacing:'.5px' }}>Yr</th>
              <th style={{ padding:'8px 8px', textAlign:'center', fontSize:10.5, fontWeight:700, color:'#A0ABC0', textTransform:'uppercase', letterSpacing:'.5px' }}>Lec</th>
              <th style={{ padding:'8px 8px', textAlign:'center', fontSize:10.5, fontWeight:700, color:'#A0ABC0', textTransform:'uppercase', letterSpacing:'.5px' }}>Lab</th>
              <th style={{ padding:'8px 8px', textAlign:'center', fontSize:10.5, fontWeight:700, color:'#A0ABC0', textTransform:'uppercase', letterSpacing:'.5px' }}>Blk</th>
              <th style={{ width:36 }}></th>
            </tr>
          </thead>
          <tbody>
            {courses.map((c,i) => (
              <EditableRow key={`${c.courseCode}_${i}`} course={c} invalid={!isValid(c)} onEdit={u=>onEdit(c,u)} onRemove={()=>onRemove(c)} />
            ))}
          </tbody>
        </table>
      </div>

      {invalidCount > 0 && (
        <HintBox>
          <span style={{ color:'#DC2626', fontWeight:600 }}>{invalidCount} row{invalidCount!==1?'s':''}</span> with missing data will be skipped on save. Fix them by clicking the row, or remove them.
        </HintBox>
      )}

      <div style={{ display:'flex', gap:8, alignItems:'center' }}>
        <button className="im-primary" onClick={handleSave} disabled={saving||courses.length===0}>
          {saving ? (
            <><svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" style={{animation:'imSpin .8s linear infinite'}}><path d="M21 12a9 9 0 1 1-6.219-8.56"/></svg>Saving…</>
          ) : (
            <><svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"><polyline points="20 6 9 17 4 12"/></svg>Import {courses.length} course{courses.length!==1?'s':''}</>
          )}
        </button>
        <button className="im-back" onClick={onBack} disabled={saving}>
          <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"><polyline points="15 18 9 12 15 6"/></svg>
          Back
        </button>
      </div>
    </div>
  )
}

/* ─── Main Modal ────────────────────────────────────────────────────────── */
export default function ImportCoursesModal({ onClose, onImported }) {
  const [step,     setStep]     = useState(1)
  const [sheets,   setSheets]   = useState([])
  const [fileData, setFileData] = useState(null)
  const [parsed,   setParsed]   = useState([])
  const [courses,  setCourses]  = useState([])

  function handleUploaded(s, b) { setSheets(s); setFileData(b); setStep(2) }
  function handleParsed(p)      { setParsed(p); setStep(3) }
  function handleBlockConfig(blocksMap) {
    setCourses(parsed.map(c => { const key=`${c.program}_${c.yearLevel}`; return {...c,blocks:Number(blocksMap[key])||0} }))
    setStep(4)
  }
  function handleEdit(original, updated) {
    setCourses(prev => prev.map(c => c.courseCode===original.courseCode&&c.program===original.program&&c.yearLevel===original.yearLevel ? updated : c))
  }
  function handleRemove(course) {
    setCourses(prev => prev.filter(c => !(c.courseCode===course.courseCode&&c.program===course.program&&c.yearLevel===course.yearLevel)))
  }
  async function handleCommit(rows) {
    const valid   = rows.filter(c => c.courseCode&&c.title&&c.program&&Number(c.blocks)>=1)
    const invalid = rows.filter(c => !(c.courseCode&&c.title&&c.program&&Number(c.blocks)>=1))
    const failed  = invalid.map(c => ({course:c,reason:'Missing required field(s)'}))
    try {
      const res = await commitCourses(valid)
      onImported?.()
      return { saved: res.committed??valid.length, failed }
    } catch(err) {
      const reason = err.response?.data?.detail || 'Server error'
      return { saved:0, failed:[...rows.map(c=>({course:c,reason}))] }
    }
  }

  const stepTitles = ['','Import from Excel','Select Sheet','Configure Sections','Review & Import']

  return (
    <div
      style={{ position:'fixed', inset:0, background:'rgba(26,22,60,0.5)', display:'flex', alignItems:'center', justifyContent:'center', zIndex:1000, backdropFilter:'blur(4px)', animation:'imFadeIn 0.18s ease' }}
      onClick={e=>e.target===e.currentTarget&&onClose()}
    >
      <div style={{
        background:'#fff', borderRadius:18, padding:'26px 28px',
        width:step===4?720:540, maxWidth:'95vw', maxHeight:'90vh',
        overflowY:'auto', fontFamily:"'Poppins',sans-serif",
        boxShadow:'0 24px 64px rgba(26,22,60,0.24),0 4px 16px rgba(124,111,205,0.12)',
        transition:'width 0.2s ease',
      }}>
        {/* Header */}
        <div style={{ display:'flex', justifyContent:'space-between', alignItems:'flex-start', marginBottom:22 }}>
          <div>
            <div style={{ display:'flex', alignItems:'center', gap:10, marginBottom:4 }}>
              <div style={{ width:34, height:34, borderRadius:10, background:'linear-gradient(135deg,#EEEAFB,#D8D3F5)', display:'flex', alignItems:'center', justifyContent:'center', flexShrink:0 }}>
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="#7C6FCD" strokeWidth="2">
                  <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/>
                  <polyline points="17 8 12 3 7 8"/><line x1="12" y1="3" x2="12" y2="15"/>
                </svg>
              </div>
              <h2 style={{ fontSize:16, fontWeight:700, color:'#1a1a2e', margin:0 }}>{stepTitles[step]}</h2>
            </div>
            <p style={{ fontSize:11.5, color:'#B0ABCC', margin:0, marginLeft:44 }}>
              Step {step} of 4 · Upload → Sheet → Sections → Review
            </p>
          </div>
          <button className="im-close" onClick={onClose}>
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
              <line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/>
            </svg>
          </button>
        </div>

        <Steps current={step} />

        {step===1 && <UploadStep onUploaded={handleUploaded} />}
        {step===2 && <SheetSelectionStep sheets={sheets} fileData={fileData} onParsed={handleParsed} onBack={()=>setStep(1)} />}
        {step===3 && <BlockConfigStep courses={parsed} onBack={()=>setStep(2)} onSubmit={handleBlockConfig} />}
        {step===4 && <ReviewStep courses={courses} onBack={()=>setStep(3)} onCommit={handleCommit} onRemove={handleRemove} onEdit={handleEdit} />}
      </div>
    </div>
  )
}