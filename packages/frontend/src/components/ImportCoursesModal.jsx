import { useState, useRef } from 'react'
import { uploadCourses, extractSheet, commitCourses } from '../services/api'
import courseListTemplate from '../assets/templates/CCS_COURSE_LIST_Template.xlsx';

const PROGRAMS = ['BSCS', 'BSIT', 'BSEMC-GD', 'BSEMC-DAT']
const SEMESTERS = ['1st Semester', '2nd Semester', 'Midyear']

// Sheets that must be present in the official CCS Course List template.
// Any file whose sheets don't exactly match this set is rejected.
const TEMPLATE_SHEETS     = ['First Semester', 'Second Semester', 'Midyear']
const TEMPLATE_SHEETS_SET = new Set(TEMPLATE_SHEETS)

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
      width: 32px; height: 32px; border-radius: 8px;
      border: 1.5px solid #E8E4F8; cursor: pointer;
      background: #F5F4FB; color: #7C6FCD; transition: all 0.2s; flex-shrink: 0;
      padding: 0;
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
      padding: 0;
    }
    .im-row-remove:hover { background: #FEE2E2; border-color: #FCA5A5; }

    @keyframes imSpin { to{transform:rotate(360deg)} }
    @keyframes imFadeIn { from{opacity:0} to{opacity:1} }
    @keyframes imPop    { 0%{transform:scale(.92);opacity:0} 100%{transform:scale(1);opacity:1} }

    /* ── Block Config Stepper ── */
    .im-stepper {
      display: inline-flex; align-items: center;
      background: #F8F7FD; border: 1.5px solid #E8E4F8;
      border-radius: 10px; overflow: hidden;
      transition: border-color 0.2s, box-shadow 0.2s;
    }
    .im-stepper:focus-within { border-color: #7C6FCD; box-shadow: 0 0 0 3px rgba(124,111,205,0.1); }
    .im-stepper-btn {
      width: 32px; height: 32px; background: transparent;
      border: none; color: #7C6FCD; font-size: 16px; font-weight: 500;
      cursor: pointer; transition: all 0.15s;
      display: flex; align-items: center; justify-content: center;
    }
    .im-stepper-btn:hover:not(:disabled) { background: #EEEAFB; }
    .im-stepper-btn:active:not(:disabled) { background: #E2DDF5; }
    .im-stepper-btn:disabled { opacity: 0.3; cursor: not-allowed; }
    .im-stepper-input {
      width: 36px; text-align: center; border: none; background: transparent;
      font-weight: 600; font-size: 14px; color: #1a1a2e;
      font-family: 'Poppins', sans-serif; outline: none; -moz-appearance: textfield;
    }
    .im-stepper-input::-webkit-outer-spin-button,
    .im-stepper-input::-webkit-inner-spin-button { -webkit-appearance: none; margin: 0; }

    /* ── Block Config Group Card ── */
    .im-group-card {
      border: 1.5px solid #F0EDF9; border-radius: 14px; background: #ffffff;
      padding: 14px 16px; display: flex; align-items: center;
      justify-content: space-between; gap: 16px; transition: all 0.2s ease;
    }
    .im-group-card:hover {
      border-color: #D8D3F5;
      box-shadow: 0 4px 20px rgba(124,111,205,0.06);
      transform: translateY(-1px);
    }
    .im-download {
      display:inline-flex; align-items:center; gap:6px;
      padding:7px 14px; border-radius:9px;
      border:1.5px solid #D8D3F5; font-family:'Poppins',sans-serif;
      font-size:11.5px; font-weight:600; cursor:pointer;
      background:#F7F5FD; color:#7C6FCD; transition:all .13s;
    }
    .im-download:hover { background:#EEEAFB; border-color:#A99BE8; color:#5a4fbf; transform:translateY(-1px); box-shadow:0 3px 10px rgba(124,111,205,.15); }
    .im-download:active { transform:translateY(0); box-shadow:none; }
  `
  document.head.appendChild(s)
}


// ─── Template download (frontend-side, no backend needed) ─────────────────────
function downloadTemplate() {
    const a = document.createElement('a');
    a.href = courseListTemplate; 
    a.download = 'CCS_COURSE_LIST_Template.xlsx';
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
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

      // ── Template enforcement (client-side fast-fail) ──────────────────
      const badSheets = res.sheets.filter(s => !TEMPLATE_SHEETS_SET.has(s))
      if (badSheets.length > 0) {
        setError(
          `Wrong template — unexpected sheet(s): "${badSheets.join('", "')}". ` +
          `Please download and use the official CCS Course List template ` +
          `(expected sheets: ${TEMPLATE_SHEETS.join(', ')}).`
        )
        return
      }
      if (!res.sheets.some(s => TEMPLATE_SHEETS_SET.has(s))) {
        setError(`No valid template sheets found. Expected: ${TEMPLATE_SHEETS.join(', ')}.`)
        return
      }
      // ─────────────────────────────────────────────────────────────────

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
      <div style={{ display:'flex', alignItems:'center', justifyContent:'space-between', gap:8 }}>
        <p style={{ fontSize:11.5, color:'#B0ABCC', margin:0, lineHeight:1.5 }}>
          Official CCS Course List template only · Semester read from sheet name
        </p>
        <button
          onClick={e => { e.stopPropagation(); downloadTemplate() }}
          style={{
            background:'none', border:'none', padding:0, cursor:'pointer',
            display:'inline-flex', alignItems:'center', gap:4,
            fontSize:11.5, color:'#A99BE8', fontFamily:"'Poppins',sans-serif",
            fontWeight:500, flexShrink:0, transition:'color .13s',
          }}
          onMouseEnter={e => e.currentTarget.style.color='#7C6FCD'}
          onMouseLeave={e => e.currentTarget.style.color='#A99BE8'}
          title="Download the blank Course List template"
        >
          <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
            <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/>
            <polyline points="7 10 12 15 17 10"/>
            <line x1="12" y1="15" x2="12" y2="3"/>
          </svg>
          Download template
        </button>
      </div>
    </div>
  )
}

/* ─── Semester detection from sheet name ─────────────────────────────────── */
const SEM_DETECT_MAP = [
  { patterns: ['1st sem', '1st semester', 'first sem', 'sem 1', 'semester 1'], value: '1st Semester' },
  { patterns: ['2nd sem', '2nd semester', 'second sem', 'sem 2', 'semester 2'], value: '2nd Semester' },
  { patterns: ['midyear', 'mid year', 'mid-year', 'summer'], value: 'Midyear' },
]
const SEM_BADGE = {
  '1st Semester': { bg:'#EDE9FB', color:'#7C6FCD', border:'#D8D3F5', short:'1st Sem' },
  '2nd Semester': { bg:'#E6FAF3', color:'#059669', border:'#A7F3D0', short:'2nd Sem' },
  'Midyear':      { bg:'#FEF3CD', color:'#D97706', border:'#FCD34D', short:'Midyear' },
}
function detectSemester(sheetName) {
  const lower = sheetName.toLowerCase().trim()
  for (const { patterns, value } of SEM_DETECT_MAP) {
    if (patterns.some(p => lower.includes(p))) return value
  }
  return null
}

/* ─── Step 2: Sheet Selection ───────────────────────────────────────────── */
function SheetSelectionStep({ sheets, fileData, onParsed, onBack }) {
  const [loading, setLoading] = useState(false)
  const [active,  setActive]  = useState(null)
  const [error,   setError]   = useState('')

  const sheetSemesters = sheets.map(name => ({ name, semester: detectSemester(name) }))
  const allDetected = sheetSemesters.every(s => s.semester !== null)

  async function handleSelect(sheetName) {
    const sem = detectSemester(sheetName) || '1st Semester'
    setLoading(true); setActive(sheetName); setError('')
    try {
      const res = await extractSheet({ sheetName, fileData })
      if (!res.preview || res.preview.length === 0) {
        setError(`No valid courses found in sheet "${sheetName}". Check column headers.`)
        setLoading(false); setActive(null); return
      }
      onParsed(res.preview.map(c => ({ ...c, semester: sem })))
    } catch(err) {
      setError(err.response?.data?.detail || 'Error extracting data from this sheet.')
      setLoading(false); setActive(null)
    }
  }

  async function handleImportAll() {
    setLoading(true); setActive('__all__'); setError('')
    try {
      let allCourses = []
      for (const { name, semester } of sheetSemesters) {
        const sem = semester || '1st Semester'
        const res = await extractSheet({ sheetName: name, fileData })
        if (res.preview && res.preview.length > 0) {
          allCourses = allCourses.concat(res.preview.map(c => ({ ...c, semester: sem })))
        }
      }
      if (allCourses.length === 0) {
        setError('No valid courses found in any sheet. Check column headers.')
        setLoading(false); setActive(null); return
      }
      onParsed(allCourses)
    } catch(err) {
      setError(err.response?.data?.detail || 'Error extracting data.')
      setLoading(false); setActive(null)
    }
  }

  return (
    <div style={{ display:'flex', flexDirection:'column', gap:14 }}>
      <p style={{ fontSize:13, color:'#8883B0', margin:0 }}>
        {sheets.length} sheet{sheets.length !== 1 ? 's' : ''} found. Semester is auto-detected from sheet names.
      </p>

      {/* Import All button */}
      {sheets.length > 1 && (
        <button onClick={handleImportAll} disabled={loading}
          style={{
            textAlign:'left', padding:'14px 16px', background:'linear-gradient(135deg,#7C6FCD,#5a4fbf)',
            border:'none', borderRadius:11, cursor:loading?'wait':'pointer', fontSize:13, fontWeight:700,
            color:'#fff', display:'flex', justifyContent:'space-between', alignItems:'center',
            transition:'all 0.15s', fontFamily:'Poppins,sans-serif',
            boxShadow:'0 4px 14px rgba(124,111,205,0.3)',
          }}>
          <div style={{ display:'flex', alignItems:'center', gap:10 }}>
            <div style={{ width:30, height:30, borderRadius:8, background:'rgba(255,255,255,0.15)', display:'flex', alignItems:'center', justifyContent:'center' }}>
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="#fff" strokeWidth="2.5">
                <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/>
                <polyline points="17 8 12 3 7 8"/><line x1="12" y1="3" x2="12" y2="15"/>
              </svg>
            </div>
            Import All Sheets
          </div>
          {active==='__all__' && loading
            ? <div style={{ width:16, height:16, border:'2px solid rgba(255,255,255,0.3)', borderTopColor:'#fff', borderRadius:'50%', animation:'imSpin 0.8s linear infinite' }} />
            : <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="rgba(255,255,255,0.7)" strokeWidth="2.5"><line x1="5" y1="12" x2="19" y2="12"/><polyline points="12 5 19 12 12 19"/></svg>}
        </button>
      )}

      <div style={{ display:'flex', flexDirection:'column', gap:8 }}>
        {sheetSemesters.map(({ name, semester }) => {
          const badge = semester ? SEM_BADGE[semester] : null
          return (
            <button key={name} onClick={()=>handleSelect(name)} disabled={loading}
              style={{ textAlign:'left', padding:'13px 16px', background:active===name?'#F7F5FD':'#FAFAFE', border:`1.5px solid ${active===name?'#A99BE8':'#E8E4F8'}`, borderRadius:10, cursor:loading?'wait':'pointer', fontSize:13, fontWeight:600, color:'#1a1a2e', display:'flex', justifyContent:'space-between', alignItems:'center', transition:'all 0.15s', fontFamily:'Poppins,sans-serif' }}>
              <div style={{ display:'flex', alignItems:'center', gap:10 }}>
                <div style={{ width:30, height:30, borderRadius:8, background:'#EEEAFB', display:'flex', alignItems:'center', justifyContent:'center' }}>
                  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="#7C6FCD" strokeWidth="2">
                    <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/>
                    <polyline points="14 2 14 8 20 8"/>
                    <line x1="16" y1="13" x2="8" y2="13"/><line x1="16" y1="17" x2="8" y2="17"/>
                  </svg>
                </div>
                <span>{name}</span>
                {badge && (
                  <span style={{ fontSize:10.5, fontWeight:600, padding:'2px 8px', borderRadius:99, background:badge.bg, color:badge.color, border:`1px solid ${badge.border}` }}>
                    {badge.short}
                  </span>
                )}
                {!badge && (
                  <span style={{ fontSize:10.5, fontWeight:600, padding:'2px 8px', borderRadius:99, background:'#FFF5F5', color:'#DC2626', border:'1px solid #FECACA' }}>
                    Unknown
                  </span>
                )}
              </div>
              {active===name && loading
                ? <div style={{ width:16, height:16, border:'2px solid #E8E4F8', borderTopColor:'#7C6FCD', borderRadius:'50%', animation:'imSpin 0.8s linear infinite' }} />
                : <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="#C0BBDC" strokeWidth="2.5"><line x1="5" y1="12" x2="19" y2="12"/><polyline points="12 5 19 12 12 19"/></svg>}
            </button>
          )
        })}
      </div>
      <ErrBox msg={error} />
      <button className="im-back" onClick={onBack} disabled={loading}>
        <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"><polyline points="15 18 9 12 15 6"/></svg>
        Back
      </button>
    </div>
  )
}

/* ─── Block config helpers ──────────────────────────────────────────────── */
const ICM_PROG_META = {
  'BSCS':      { color: '#7C6FCD', bg: '#F4F2FA' },
  'BSIT':      { color: '#059669', bg: '#E6FAF3' },
  'BSEMC-GD':  { color: '#D97706', bg: '#FEF3CD' },
  'BSEMC-DAT': { color: '#DC2626', bg: '#FFF5F5' },
}
const ICM_PROG_META_DEFAULT = { color: '#7C6FCD', bg: '#F4F2FA' }

function BlockStepper({ value, onChange }) {
  const num = value === '' ? '' : Number(value)
  return (
    <div className="im-stepper">
      <button
        type="button"
        className="im-stepper-btn"
        disabled={num <= 1 || num === ''}
        onClick={() => onChange(Math.max(1, num - 1))}
      >−</button>
      <input
        className="im-stepper-input"
        type="number" min={1} max={20} value={value}
        onChange={e => onChange(e.target.value === '' ? '' : Number(e.target.value))}
        placeholder="—"
      />
      <button
        type="button"
        className="im-stepper-btn"
        disabled={num >= 20}
        onClick={() => onChange(num === '' ? 1 : Math.min(20, num + 1))}
      >+</button>
    </div>
  )
}

/* ─── Step 3: Block config ──────────────────────────────────────────────── */
function BlockConfigStep({ courses, onBack, onSubmit }) {
  // Detect all semesters present
  const semesters = [...new Set(courses.map(c => c.semester || '1st Semester'))]
  const [activeSem, setActiveSem] = useState(semesters[0])

  const allGroups = []
  const seen = new Set()
  courses.forEach(c => {
    const sem = c.semester || '1st Semester'
    const key = `${c.program}_${c.yearLevel}_${sem}`
    if (!seen.has(key)) {
      seen.add(key)
      const count = courses.filter(x => x.program === c.program && x.yearLevel === c.yearLevel && (x.semester || '1st Semester') === sem).length
      allGroups.push({ key, program: c.program, yearLevel: Number(c.yearLevel), semester: sem, count })
    }
  })
  allGroups.sort((a, b) => a.program.localeCompare(b.program) || a.yearLevel - b.yearLevel)

  const filteredGroups = allGroups.filter(g => g.semester === activeSem)
  const activePrograms  = [...new Set(filteredGroups.map(g => g.program))]

  const [blocks, setBlocks] = useState(() => {
    const init = {}
    allGroups.forEach(g => { init[g.key] = '' })
    return init
  })
  const [error, setError] = useState('')

  function setVal(key, value) {
    setBlocks(prev => ({ ...prev, [key]: value === '' ? '' : Number(value) }))
    setError('')
  }

  function handleSubmit(e) {
    e.preventDefault()
    const missing = allGroups.filter(g => !blocks[g.key] || Number(blocks[g.key]) < 1)
    if (missing.length > 0) {
      setError(`Set at least 1 section for: ${missing.map(g => `${g.program} Y${g.yearLevel}`).join(', ')}`)
      return
    }
    onSubmit(blocks)
  }

  const semBadge = {
    '1st Semester': { bg:'#EDE9FB', color:'#7C6FCD', short:'1st Sem' },
    '2nd Semester': { bg:'#E6FAF3', color:'#059669', short:'2nd Sem' },
    'Midyear':      { bg:'#FEF3CD', color:'#D97706', short:'Midyear' },
  }

  return (
    <form onSubmit={handleSubmit} style={{ display:'flex', flexDirection:'column', gap:16 }}>
      <p style={{ fontSize:13, color:'#8883B0', margin:0 }}>
        Set how many sections (blocks) exist for each program-year group.
      </p>

      {/* Semester tabs — only shown when multiple semesters are present */}
      {semesters.length > 1 && (
        <div style={{ display:'flex', gap:3, background:'#F5F4FB', padding:4, borderRadius:10, border:'1px solid #E8E4F8' }}>
          {semesters.map(sem => {
            const badge = semBadge[sem] || { bg:'#F5F4FB', color:'#8883B0', short: sem }
            const count = allGroups.filter(g => g.semester === sem).length
            return (
              <button key={sem} type="button" onClick={() => setActiveSem(sem)}
                style={{
                  display:'inline-flex', alignItems:'center', gap:5, padding:'6px 14px', borderRadius:8,
                  border:'none', fontFamily:'Poppins,sans-serif', fontSize:12, fontWeight:600, cursor:'pointer',
                  transition:'all 0.15s',
                  background: activeSem === sem ? 'linear-gradient(135deg,#7C6FCD,#5a4fbf)' : 'transparent',
                  color: activeSem === sem ? '#fff' : '#8883B0',
                  boxShadow: activeSem === sem ? '0 2px 8px rgba(124,111,205,0.25)' : 'none',
                }}>
                {badge.short}
                <span style={{
                  fontSize:10, fontWeight:700, padding:'1px 6px', borderRadius:99,
                  background: activeSem === sem ? 'rgba(255,255,255,0.2)' : '#E8E4F8',
                  color: activeSem === sem ? '#fff' : '#8883B0',
                }}>{count}</span>
              </button>
            )
          })}
        </div>
      )}

      {/* Program-grouped cards */}
      <div style={{ display:'flex', flexDirection:'column', gap:20, background:'#FAFAFC', borderRadius:12, padding:16, border:'1px solid #F0EDF9' }}>
        {activePrograms.map(prog => {
          const meta      = ICM_PROG_META[prog] || ICM_PROG_META_DEFAULT
          const progGroups = filteredGroups.filter(g => g.program === prog)
          return (
            <div key={prog}>
              {/* Program header row */}
              <div style={{ display:'flex', alignItems:'center', gap:12, marginBottom:12 }}>
                <span style={{
                  fontSize:12, fontWeight:600, padding:'4px 12px', borderRadius:8,
                  background: meta.bg, color: meta.color,
                  border: `1px solid ${meta.color}20`,
                }}>
                  {prog}
                </span>
                <div style={{ flex:1, height:1, background:'#E8E4F8' }} />
                <span style={{ fontSize:12, color:'#9CA3AF', fontWeight:500 }}>
                  {progGroups.reduce((s, g) => s + g.count, 0)} courses
                </span>
              </div>

              {/* Cards grid */}
              <div style={{ display:'grid', gridTemplateColumns:'repeat(auto-fit, minmax(280px, 1fr))', gap:10 }}>
                {progGroups.map(g => (
                  <div key={g.key} className="im-group-card">
                    <div style={{ display:'flex', gap:12, alignItems:'center' }}>
                      <div style={{ width:4, height:32, borderRadius:4, background: meta.color, flexShrink:0 }} />
                      <div>
                        <div style={{ fontSize:14, fontWeight:600, color:'#1E1B4B', marginBottom:2 }}>
                          {ORDINAL(g.yearLevel)} Year
                        </div>
                        <div style={{ fontSize:12, color:'#6B7280' }}>
                          {g.count} course{g.count !== 1 ? 's' : ''}
                        </div>
                      </div>
                    </div>
                    <BlockStepper
                      value={blocks[g.key] ?? ''}
                      onChange={v => setVal(g.key, v)}
                    />
                  </div>
                ))}
              </div>
            </div>
          )
        })}
      </div>

      <ErrBox msg={error} />

      <div style={{ display:'flex', gap:8 }}>
        <button type="submit" className="im-primary">
          <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"><line x1="5" y1="12" x2="19" y2="12"/><polyline points="12 5 19 12 12 19"/></svg>
          Continue to Review
        </button>
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
function ReviewStep({ courses, onBack, onCommit, onRemove, onEdit, onImported }) {
  const [saving,  setSaving]  = useState(false)
  const [results, setResults] = useState(null)

  const semesters = [...new Set(courses.map(c => c.semester || '1st Semester'))]
  const [activeSem, setActiveSem] = useState(semesters[0])
  const semBadge = { '1st Semester':{ short:'1st Sem' }, '2nd Semester':{ short:'2nd Sem' }, 'Midyear':{ short:'Midyear' } }

  const displayed = semesters.length > 1 ? courses.filter(c => (c.semester || '1st Semester') === activeSem) : courses

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
      <div style={{ display:'flex', flexDirection:'column', gap:16, animation:'imPop .2s ease' }}>
        {allGood ? (
          <div style={{ textAlign:'center', padding:'36px 0', display:'flex', flexDirection:'column', alignItems:'center', gap:14 }}>
            <div style={{ width:60, height:60, borderRadius:'50%', background:'linear-gradient(135deg,#7C6FCD,#5a4fbf)', display:'flex', alignItems:'center', justifyContent:'center', boxShadow:'0 6px 20px rgba(124,111,205,.35)' }}>
              <svg width="26" height="20" viewBox="0 0 26 20" fill="none"><polyline points="2,10 9,17 24,2" stroke="white" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"/></svg>
            </div>
            <div>
              <p style={{ fontWeight:700, fontSize:17, color:'#1a1a2e', marginBottom:5 }}>
                {results.saved} course{results.saved!==1?'s':''} imported!
              </p>
              <p style={{ color:'#8883B0', fontSize:13, margin:0 }}>You can now use these courses in the scheduler.</p>
            </div>
          </div>
        ) : (
          <>
            <div style={{ background:'#FEF3CD', border:'1px solid #F0C040', borderRadius:10, padding:'12px 16px' }}>
              <p style={{ fontWeight:700, fontSize:13, color:'#1a1a2e', marginBottom:3 }}>{results.saved} saved · {results.failed.length} failed</p>
              <p style={{ fontSize:12, color:'#8883B0', margin:0 }}>These courses couldn't be saved — they may already exist or have invalid data.</p>
            </div>
            <div style={{ maxHeight:320, overflowY:'auto', overflowX:'auto', border:'1px solid #E8E4F8', borderRadius:10 }}>
               <table style={{ width:'100%', borderCollapse:'collapse' }}>
                <thead style={{ position:'sticky', top:0, background:'#FAFAFE', zIndex:1 }}>
                  <tr>
                    <th style={{ padding:'8px', fontSize:10.5, fontWeight:700, color:'#A0ABC0', textTransform:'uppercase', letterSpacing:'.5px', textAlign:'left' }}>Code</th>
                    <th style={{ padding:'8px', fontSize:10.5, fontWeight:700, color:'#A0ABC0', textTransform:'uppercase', letterSpacing:'.5px', textAlign:'left' }}>Title</th>
                    <th style={{ padding:'8px', fontSize:10.5, fontWeight:700, color:'#A0ABC0', textTransform:'uppercase', letterSpacing:'.5px', textAlign:'left' }}>Program</th>
                    <th style={{ padding:'8px', fontSize:10.5, fontWeight:700, color:'#A0ABC0', textTransform:'uppercase', letterSpacing:'.5px', textAlign:'left' }}>Reason</th>
                  </tr>
                </thead>
                <tbody>
                  {results.failed.map((f,i) => (
                    <tr key={i} style={{ borderTop:'1px solid #F0EDF9' }}>
                      <td style={{ padding:'8px' }}><span style={{ display:'inline-block', padding:'2px 8px', background:'#EEEAFB', color:'#7C6FCD', borderRadius:99, fontSize:11, fontWeight:700 }}>{f.course.courseCode}</span></td>
                      <td style={{ padding:'8px', fontWeight:500, fontSize:12 }}>{f.course.title}</td>
                      <td style={{ padding:'8px', fontSize:12 }}>{f.course.program}</td>
                      <td style={{ padding:'8px', color:'#DC2626', fontSize:12 }}>{f.reason}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </>
        )}

        <div style={{ display: 'flex', justifyContent: 'center', marginTop: 12 }}>
          <button className="im-primary" onClick={onImported} style={{ padding: '10px 40px', fontSize: 13 }}>Done</button>
        </div>
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

      {/* Semester tabs if multiple */}
      {semesters.length > 1 && (
        <div style={{ display:'flex', gap:3, background:'#F5F4FB', padding:4, borderRadius:10, border:'1px solid #E8E4F8' }}>
          {semesters.map(sem => {
            const count = courses.filter(c => (c.semester || '1st Semester') === sem).length
            return (
              <button key={sem} type="button" onClick={() => setActiveSem(sem)}
                style={{
                  display:'inline-flex', alignItems:'center', gap:5, padding:'6px 14px', borderRadius:8,
                  border:'none', fontFamily:'Poppins,sans-serif', fontSize:12, fontWeight:600, cursor:'pointer',
                  transition:'all 0.15s',
                  background: activeSem === sem ? 'linear-gradient(135deg,#7C6FCD,#5a4fbf)' : 'transparent',
                  color: activeSem === sem ? '#fff' : '#8883B0',
                  boxShadow: activeSem === sem ? '0 2px 8px rgba(124,111,205,0.25)' : 'none',
                }}>
                {(semBadge[sem] || { short: sem }).short}
                <span style={{
                  fontSize:10, fontWeight:700, padding:'1px 6px', borderRadius:99,
                  background: activeSem === sem ? 'rgba(255,255,255,0.2)' : '#E8E4F8',
                  color: activeSem === sem ? '#fff' : '#8883B0',
                }}>{count}</span>
              </button>
            )
          })}
        </div>
      )}

      <div style={{ maxHeight:200, overflowY:'auto', overflowX:'auto', border:'1px solid #E8E4F8', borderRadius:10 }}>
  <table style={{ width:'100%', borderCollapse:'collapse' }}>
          <thead style={{ position:'sticky', top:0, background:'#FAFAFE', zIndex:1 }}>
            <tr>
              <th style={{ padding:'8px 8px', fontSize:10.5, fontWeight:700, color:'#A0ABC0', textTransform:'uppercase', letterSpacing:'.5px', textAlign:'left' }}>Code</th>
              <th style={{ padding:'8px 8px', fontSize:10.5, fontWeight:700, color:'#A0ABC0', textTransform:'uppercase', letterSpacing:'.5px', textAlign:'left' }}>Title</th>
              <th style={{ padding:'8px 8px', fontSize:10.5, fontWeight:700, color:'#A0ABC0', textTransform:'uppercase', letterSpacing:'.5px', textAlign:'left' }}>Program</th>
              <th style={{ padding:'8px 8px', textAlign:'center', fontSize:10.5, fontWeight:700, color:'#A0ABC0', textTransform:'uppercase', letterSpacing:'.5px' }}>Yr</th>
              <th style={{ padding:'8px 8px', textAlign:'center', fontSize:10.5, fontWeight:700, color:'#A0ABC0', textTransform:'uppercase', letterSpacing:'.5px' }}>Lec</th>
              <th style={{ padding:'8px 8px', textAlign:'center', fontSize:10.5, fontWeight:700, color:'#A0ABC0', textTransform:'uppercase', letterSpacing:'.5px' }}>Lab</th>
              <th style={{ padding:'8px 8px', textAlign:'center', fontSize:10.5, fontWeight:700, color:'#A0ABC0', textTransform:'uppercase', letterSpacing:'.5px' }}>Blk</th>
              <th style={{ width:36 }}></th>
            </tr>
          </thead>
          <tbody>
            {displayed.map((c,i) => (
              <EditableRow key={`${c.courseCode}_${c.semester}_${i}`} course={c} invalid={!isValid(c)} onEdit={u=>onEdit(c,u)} onRemove={()=>onRemove(c)} />
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
    setCourses(parsed.map(c => { const sem=c.semester||'1st Semester'; const key=`${c.program}_${c.yearLevel}_${sem}`; return {...c,blocks:Number(blocksMap[key])||0} }))
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
        width: step === 4 ? 760 : step === 3 ? 700 : 540, maxWidth:'95vw', maxHeight:'90vh',
        overflowY:'auto', fontFamily:"'Poppins',sans-serif",
        boxShadow:'0 24px 64px rgba(26,22,60,0.24),0 4px 16px rgba(124,111,205,0.12)',
        transition:'width 0.25s cubic-bezier(0.16, 1, 0.3, 1)',
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
          <button className="im-close" onClick={onClose} aria-label="Close">
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round">
              <line x1="18" y1="6" x2="6" y2="18" />
              <line x1="6" y1="6" x2="18" y2="18" />
            </svg>
          </button>
        </div>

        <Steps current={step} />

        {step===1 && <UploadStep onUploaded={handleUploaded} />}
        {step===2 && <SheetSelectionStep sheets={sheets} fileData={fileData} onParsed={handleParsed} onBack={()=>setStep(1)} />}
        {step===3 && <BlockConfigStep courses={parsed} onBack={()=>setStep(2)} onSubmit={handleBlockConfig} />}
        {step===4 && <ReviewStep courses={courses} onBack={()=>setStep(3)} onCommit={handleCommit} onRemove={handleRemove} onEdit={handleEdit} onImported={onImported} />}
      </div>
    </div>
  )
}