import { useState, useRef, useEffect } from 'react'
import * as XLSX from 'xlsx'
import { uploadFaculty, extractFacultySheets, commitFaculty } from '../services/api'
import facultyTemplate from '../assets/templates/CCS-Faculty-Specialization-Matrix-Template.xlsx';

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
      background:linear-gradient(135deg,#2E9E5B,#1F7A45); color:#fff;
      box-shadow:0 3px 12px rgba(46,158,91,.32);
    }
    .ifm-primary:hover:not(:disabled) { background:linear-gradient(135deg,#4BB377,#27914F); transform:translateY(-1px); box-shadow:0 5px 18px rgba(46,158,91,.4); }
    .ifm-primary:active:not(:disabled) { transform:translateY(0); }
    .ifm-primary:disabled { opacity:.45; cursor:default; transform:none; box-shadow:none; }

    .ifm-ghost {
      display:inline-flex; align-items:center; gap:6px;
      padding:8px 15px; border-radius:10px;
      border:1.5px solid #DCF3E4; font-family:'Poppins',sans-serif;
      font-size:12px; font-weight:500; cursor:pointer;
      background:#fff; color:#5C8A6E; transition:all .13s;
    }
    .ifm-ghost:hover:not(:disabled) { background:#EFFAF4; border-color:#9EDDB7; color:#1F7A45; }
    .ifm-ghost:disabled { opacity:.45; cursor:default; }

    .ifm-download {
      display:inline-flex; align-items:center; gap:6px;
      padding:7px 14px; border-radius:9px;
      border:1.5px solid #C9ECD6; font-family:'Poppins',sans-serif;
      font-size:11.5px; font-weight:600; cursor:pointer;
      background:#F1FBF5; color:#2E9E5B; transition:all .13s;
    }
    .ifm-download:hover { background:#E5F9EC; border-color:#6FC795; color:#1F7A45; transform:translateY(-1px); box-shadow:0 3px 10px rgba(46,158,91,.15); }
    .ifm-download:active { transform:translateY(0); box-shadow:none; }

    .ifm-close {
      display: inline-flex; align-items: center; justify-content: center;
      width: 32px; height: 32px; border-radius: 8px;
      border: 1.5px solid #DCF3E4; cursor: pointer;
      background: #EFFAF4; color: #2E9E5B; transition: all 0.2s; flex-shrink: 0;
      padding: 0;
    }
    .ifm-close:hover { background:#FFE8E8; border-color:#FECACA; color:#DC2626; }

    .ifm-sheet-btn {
      text-align:left; display:flex; align-items:center; gap:10px;
      padding:12px 16px; border-radius:10px; border:1.5px solid #DCF3E4;
      background:#F7FCF9; cursor:pointer; transition:all .13s;
      font-family:'Poppins',sans-serif; font-size:13px; font-weight:600; color:#0E2A20;
    }
    .ifm-sheet-btn:hover:not(:disabled) { background:#E5F9EC; border-color:#9EDDB7; }
    .ifm-sheet-btn.active { background:#E5F9EC; border-color:#6FC795; }
    .ifm-sheet-btn:disabled { opacity:.5; cursor:wait; }

    .ifm-card {
      display:flex; align-items:center; gap:14px;
      padding:12px 16px; border-radius:11px;
      border:1.5px solid #DCF3E4; background:#F7FCF9;
      transition:border-color .12s;
      animation: ifmFadeIn .15s ease both;
    }
    .ifm-card:hover { border-color:#9EDDB7; }

    .ifm-remove {
      width:24px; height:24px; border-radius:7px;
      border:1.5px solid #FECACA; background:#FFF5F5; color:#DC2626;
      display:inline-flex; align-items:center; justify-content:center;
      cursor:pointer; transition:all .12s; flex-shrink:0; margin-left:auto;
      padding: 0;
    }
    .ifm-remove:hover { background:#FEE2E2; border-color:#FCA5A5; }

    .ifm-warn-box {
      background:#FFFBEB; border:1.5px solid #FCD34D; border-radius:10px;
      padding:11px 14px; font-size:12px; color:#92400E; line-height:1.6;
      display:flex; gap:9px; align-items:flex-start;
    }
  `
  document.head.appendChild(s)
}

// ─── Template download ─────────────────────────────────────────────────────────
function downloadTemplate() {
  const a = document.createElement('a')
  a.href = facultyTemplate
  a.download = 'CCS-Faculty-Specialization-Matrix_Template.xlsx'
  document.body.appendChild(a)
  a.click()
  document.body.removeChild(a)
}

// ─── Template validation ───────────────────────────────────────────────────────
function validateFacultyMatrixFile(file) {
  return new Promise((resolve) => {
    const reader = new FileReader()
    reader.onload = (e) => {
      try {
        const data = new Uint8Array(e.target.result)
        const wb = XLSX.read(data, { type: 'array', sheetRows: 5 })

        if (!wb.SheetNames.length) {
          resolve({ valid: false, reason: 'The file contains no sheets.' })
          return
        }

        const cell = (ws, col, row) =>
          (ws[`${col}${row}`]?.v ?? '').toString().trim().toUpperCase()

        const COURSE_LIST_INDICATORS = ['PROGRAM', 'YEAR LEVEL', 'UNITS LECTURE', 'UNITS LAB', 'COURSE TITLE']

        let validSheetFound = false
        const diagLines = []

        for (const sheetName of wb.SheetNames) {
          const ws = wb.Sheets[sheetName]

          let headerRow = null
          for (let r = 1; r <= 5; r++) {
            const a = cell(ws, 'A', r)
            if (a.includes('COURSE') && a.includes('CODE')) {
              headerRow = r
              break
            }
          }

          if (headerRow === null) {
            diagLines.push(`"${sheetName}" — no "COURSES CODE" header found in rows 1–5`)
            continue
          }

          const labelRow = headerRow + 1
          const aH = cell(ws, 'A', headerRow)
          const bH = cell(ws, 'B', headerRow)
          const cH = cell(ws, 'C', headerRow)
          const dH = cell(ws, 'D', headerRow)
          const bL = cell(ws, 'B', labelRow)

          const hasCourseListHeaders =
            COURSE_LIST_INDICATORS.some(ind => cH.includes(ind) || dH.includes(ind))

          if (hasCourseListHeaders) {
            diagLines.push(`"${sheetName}" looks like a Course List (found "${cH || dH}" in headers)`)
            continue
          }

          const hasCoursesCode = aH.includes('COURSE') && aH.includes('CODE')
          const hasCoursesName = bH.includes('COURSE') && (bH.includes('NAME') || bH.includes('TITLE'))

          const hasTemplateFacultyRow = bL.includes('FACULTY') || bL.includes('FULL') || bL.includes('PART')

          const prevRow  = headerRow - 1
          const cPrev    = prevRow >= 1 ? cell(ws, 'C', prevRow) : ''
          const hasActualFileFacultyRow = (
            prevRow >= 1 &&
            cPrev.length > 0 &&
            !COURSE_LIST_INDICATORS.some(ind => cPrev.includes(ind)) &&
            !cPrev.includes('INSTRUCTION') &&
            !cPrev.includes('COURSE')
          )

          const hasFacultyRow = hasTemplateFacultyRow || hasActualFileFacultyRow

          if (hasCoursesCode && hasCoursesName && hasFacultyRow) {
            validSheetFound = true
            break
          }

          diagLines.push(
            `"${sheetName}" — A${headerRow}: "${aH}", B${headerRow}: "${bH}", B${labelRow}: "${bL}"`
          )
        }

        if (validSheetFound) {
          resolve({ valid: true })
        } else {
          const isCourseList = diagLines.some(l => l.includes('Course List'))
          if (isCourseList) {
            resolve({
              valid: false,
              reason:
                'This looks like the Course List template, not the Faculty Specialization Matrix. ' +
                'Please upload the correct file (columns = faculty names, rows = course codes, cells = ratings 1–5).',
            })
          } else {
            resolve({
              valid: false,
              reason:
                'This file does not match the Faculty Specialization Matrix template. ' +
                'Expected a header row with "COURSES CODE" / "COURSES NAME" / faculty names, ' +
                'followed by a row with "↳ FULL-TIME FACULTY" or "↳ PART-TIME FACULTY". ' +
                'Make sure you are using the correct template.',
            })
          }
        }
      } catch (err) {
        resolve({ valid: false, reason: 'Could not read the file. It may be corrupted or password-protected.' })
      }
    }
    reader.onerror = () =>
      resolve({ valid: false, reason: 'File could not be read. Please try again.' })
    reader.readAsArrayBuffer(file)
  })
}

const Spin = () => (
  <div style={{ width:16, height:16, border:'2px solid #DCF3E4', borderTopColor:'#2E9E5B', borderRadius:'50%', animation:'ifmSpin .8s linear infinite', flexShrink:0 }} />
)

const ErrBox = ({ msg }) => !msg ? null : (
  <div style={{ background:'#FFF5F5', border:'1px solid #FECACA', borderRadius:9, padding:'9px 13px', fontSize:12, color:'#DC2626', display:'flex', alignItems:'flex-start', gap:7 }}>
    <svg style={{ flexShrink:0, marginTop:1 }} width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"><circle cx="12" cy="12" r="10"/><line x1="12" y1="8" x2="12" y2="12"/><line x1="12" y1="16" x2="12.01" y2="16"/></svg>
    {msg}
  </div>
)

const HintBox = ({ children }) => (
  <div style={{ background:'#F1FBF5', border:'1px solid #DCF3E4', borderRadius:10, padding:'11px 14px', fontSize:12, color:'#5C8A6E', lineHeight:1.65 }}>
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

const ratingColor = r => r >= 4 ? '#16A34A' : r === 3 ? '#2E9E5B' : r === 2 ? '#D97706' : '#7DAB8E'

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
                background: done ? 'linear-gradient(135deg,#2E9E5B,#1F7A45)' : active ? 'linear-gradient(135deg,#6FC795,#2E9E5B)' : '#E5F9EC',
                color: (done || active) ? '#fff' : '#A8D9BB',
                boxShadow: active ? '0 3px 12px rgba(46,158,91,.35)' : done ? '0 2px 8px rgba(46,158,91,.2)' : 'none',
              }}>
                {done
                  ? <svg width="12" height="9" viewBox="0 0 12 9" fill="none"><polyline points="1,4.5 4.5,8 11,1" stroke="white" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"/></svg>
                  : idx}
              </div>
              <span style={{ fontSize:10.5, fontWeight:active?700:500, color:active?'#2E9E5B':done?'#6FC795':'#A8D9BB', whiteSpace:'nowrap', letterSpacing:'.3px' }}>
                {label}
              </span>
            </div>
            {i < labels.length - 1 && (
              <div style={{ flex:1, height:2, margin:'0 8px 18px', borderRadius:99, background: done ? 'linear-gradient(90deg,#2E9E5B,#6FC795)' : '#DCF3E4', transition:'background .3s' }} />
            )}
          </div>
        )
      })}
    </div>
  )
}

/* ─── Step 1: Upload ─────────────────────────────────────────────────────── */
function UploadStep({ onUploaded }) {
  const [dragging,   setDragging]   = useState(false)
  const [loading,    setLoading]    = useState(false)
  const [validating, setValidating] = useState(false)
  const [error,      setError]      = useState('')
  const inputRef = useRef()

  async function processFile(file) {
    if (!file) return
    if (!file.name.match(/\.(xlsx|xls)$/i)) {
      setError('Please upload an .xlsx or .xls file.')
      return
    }

    setValidating(true)
    setError('')

    const validation = await validateFacultyMatrixFile(file)

    if (!validation.valid) {
      setError(validation.reason)
      setValidating(false)
      return
    }

    setValidating(false)
    setLoading(true)
    try {
      const res = await uploadFaculty(file)
      if (!res.sheets?.length) {
        setError('No sheets found in the file.')
        return
      }
      onUploaded(res.sheets, res.fileData)
    } catch (err) {
      setError(err.response?.data?.detail || 'Could not read the file. Check the format and try again.')
    } finally {
      setLoading(false)
    }
  }

  const isBusy = loading || validating

  return (
    <div style={{ display:'flex', flexDirection:'column', gap:14 }}>
      <div
        onDragOver={e => { e.preventDefault(); setDragging(true) }}
        onDragLeave={() => setDragging(false)}
        onDrop={e => { e.preventDefault(); setDragging(false); processFile(e.dataTransfer.files[0]) }}
        onClick={() => !isBusy && inputRef.current?.click()}
        style={{
          border:`2px dashed ${dragging ? '#2E9E5B' : '#C9ECD6'}`, borderRadius:14,
          padding:'44px 24px', textAlign:'center',
          background: dragging ? '#F1FBF5' : '#F7FCF9',
          cursor: isBusy ? 'wait' : 'pointer', transition:'all .15s',
        }}
      >
        {isBusy ? (
          <div style={{ display:'flex', flexDirection:'column', alignItems:'center', gap:10 }}>
            <div style={{ width:40, height:40, borderRadius:'50%', border:'3px solid #DCF3E4', borderTopColor:'#2E9E5B', animation:'ifmSpin .8s linear infinite' }} />
            <p style={{ fontSize:13, color:'#5C8A6E', fontWeight:500, margin:0 }}>
              {validating ? 'Checking template…' : 'Reading file…'}
            </p>
          </div>
        ) : (
          <>
            <div style={{ width:54, height:54, margin:'0 auto 14px', borderRadius:14, display:'flex', alignItems:'center', justifyContent:'center', background: dragging ? 'linear-gradient(135deg,#2E9E5B,#1F7A45)' : 'linear-gradient(135deg,#E5F9EC,#D7F2E0)', boxShadow: dragging ? '0 6px 20px rgba(46,158,91,.35)' : 'none', transition:'all .15s' }}>
              <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke={dragging?'#fff':'#2E9E5B'} strokeWidth="2">
                <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/>
                <polyline points="17 8 12 3 7 8"/><line x1="12" y1="3" x2="12" y2="15"/>
              </svg>
            </div>
            <p style={{ fontWeight:700, fontSize:14, color:'#0E2A20', marginBottom:4 }}>
              {dragging ? 'Drop it here!' : 'Drop your Faculty Matrix Excel file'}
            </p>
            <p style={{ fontSize:12, color:'#7DAB8E', margin:0 }}>
              or <span style={{ color:'#2E9E5B', fontWeight:600 }}>click to browse</span> · .xlsx or .xls
            </p>
          </>
        )}
      </div>
      <input
        ref={inputRef}
        type="file"
        accept=".xlsx,.xls"
        style={{ display:'none' }}
        onChange={e => { processFile(e.target.files[0]); e.target.value = null }}
      />

      <ErrBox msg={error} />

      {error && error.toLowerCase().includes('course list') && (
        <div className="ifm-warn-box">
          <svg style={{ flexShrink:0, marginTop:1 }} width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="#D97706" strokeWidth="2.5"><path d="M10.29 3.86L1.82 18a2 2 0 001.71 3h16.94a2 2 0 001.71-3L13.71 3.86a2 2 0 00-3.42 0z"/><line x1="12" y1="9" x2="12" y2="13"/><line x1="12" y1="17" x2="12.01" y2="17"/></svg>
          <span>
            <strong>Wrong template!</strong> The Course List file is used elsewhere in the system.
            For faculty import, please use the <strong>Faculty Specialization Matrix</strong> template
            (columns = faculty names, rows = course codes, cells = ratings 1–5).
          </span>
        </div>
      )}

      <div style={{ display:'flex', alignItems:'center', justifyContent:'space-between', gap:8 }}>
        <p style={{ fontSize:11.5, color:'#7DAB8E', margin:0, lineHeight:1.5 }}>
          Columns = faculty names · Rows = course codes · Cells = rating (1–5)
        </p>
        <button
          onClick={e => { e.stopPropagation(); downloadTemplate() }}
          style={{
            background:'none', border:'none', padding:0, cursor:'pointer',
            display:'inline-flex', alignItems:'center', gap:4,
            fontSize:11.5, color:'#6FC795', fontFamily:"'Poppins',sans-serif",
            fontWeight:500, flexShrink:0, transition:'color .13s',
          }}
          onMouseEnter={e => e.currentTarget.style.color='#2E9E5B'}
          onMouseLeave={e => e.currentTarget.style.color='#6FC795'}
          title="Download the blank Faculty Specialization Matrix template"
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

/* ─── Step 2: Sheet selection ────────────────────────────────────────────── */
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
      if (!res.preview?.length) {
        setError('No faculty data found in the selected sheet(s). Check the format.')
        setLoading(false)
        return
      }

      const splitPreview = res.preview.map(faculty => {
        const expanded = faculty.specializations.flatMap(spec => {
          const codes = spec.courseCode.split('/').map(c => c.trim()).filter(Boolean)
          return codes.map(code => ({ ...spec, courseCode: code }))
        })

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
      <p style={{ fontSize:13, color:'#5C8A6E', margin:0 }}>
        Select the sheet(s) that contain faculty specialization data. You can import all at once.
      </p>

      <button
        onClick={toggleAll}
        disabled={loading}
        style={{ alignSelf:'flex-start', display:'flex', alignItems:'center', gap:7, padding:'5px 12px', borderRadius:8, border:'1.5px solid #DCF3E4', background: allSelected ? '#E5F9EC' : '#fff', cursor:'pointer', fontSize:12, fontWeight:600, color: allSelected ? '#2E9E5B' : '#5C8A6E', fontFamily:'Poppins,sans-serif', transition:'all .12s' }}
      >
        <div style={{ width:14, height:14, borderRadius:4, border:`1.5px solid ${allSelected?'#2E9E5B':'#A8D9BB'}`, background:allSelected?'#2E9E5B':'transparent', display:'flex', alignItems:'center', justifyContent:'center' }}>
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
              <div style={{ width:16, height:16, borderRadius:5, border:`1.5px solid ${isSelected?'#2E9E5B':'#A8D9BB'}`, background:isSelected?'#2E9E5B':'transparent', display:'flex', alignItems:'center', justifyContent:'center', flexShrink:0, transition:'all .12s' }}>
                {isSelected && <svg width="8" height="6" viewBox="0 0 8 6" fill="none"><polyline points="1,3 3,5 7,1" stroke="white" strokeWidth="1.4" strokeLinecap="round" strokeLinejoin="round"/></svg>}
              </div>
              <div style={{ width:28, height:28, borderRadius:7, background: isPartTime ? '#FFF7ED' : '#E5F9EC', display:'flex', alignItems:'center', justifyContent:'center' }}>
                <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke={isPartTime?'#D97706':'#2E9E5B'} strokeWidth="2">
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

/* ─── Faculty card ───────────────────────────────────────────────────────── */
function FacultyCard({ faculty, onRemove, animDelay }) {
  const [expanded, setExpanded] = useState(false)
  const specs     = faculty.specializations || []
  const topSpecs  = specs.filter(s => s.rating >= 4).slice(0, 5)
  const totalGood = specs.filter(s => s.rating >= 3).length

  return (
    <div className="ifm-card" style={{ flexDirection:'column', alignItems:'stretch', animationDelay:`${animDelay}ms`, cursor:'pointer' }} onClick={() => setExpanded(e => !e)}>
      <div style={{ display:'flex', alignItems:'center', gap:12 }}>
        <div style={{ width:36, height:36, borderRadius:10, background:'linear-gradient(135deg,#E5F9EC,#C9ECD6)', display:'flex', alignItems:'center', justifyContent:'center', flexShrink:0, fontSize:13, fontWeight:700, color:'#2E9E5B' }}>
          {faculty.name.split(',')[0].charAt(0)}
        </div>

        <div style={{ flex:1, minWidth:0 }}>
          <div style={{ display:'flex', alignItems:'center', gap:7, flexWrap:'wrap' }}>
            <span style={{ fontSize:13, fontWeight:700, color:'#0E2A20' }}>{faculty.name}</span>
            <StatusBadge status={faculty.status} />
          </div>
          <div style={{ fontSize:11.5, color:'#5C8A6E', marginTop:2 }}>
            <strong style={{ color:'#2E9E5B' }}>{totalGood}</strong> rated courses · <strong style={{ color:'#0E2A20' }}>{specs.length}</strong> total
          </div>
        </div>

        <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="#A8D9BB" strokeWidth="2.5" style={{ transition:'transform .2s', transform: expanded ? 'rotate(180deg)' : 'rotate(0deg)', flexShrink:0 }}>
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
            <span 
              key={`${s.courseTitle || s.title || 'untitled'}-${s.courseCode}`} 
              style={{ fontSize:10.5, fontWeight:600, padding:'2px 8px', borderRadius:99, background:'#E5F9EC', color:'#2E9E5B', border:'1px solid #DCF3E4' }}
            >
              {s.courseTitle || s.title || s.courseCode}
              <span style={{ marginLeft:4, color: ratingColor(s.rating), fontWeight:700 }}>{s.rating}</span>
            </span>
          ))}
          {specs.filter(s => s.rating >= 4).length > 5 && (
            <span style={{ fontSize:10.5, color:'#7DAB8E', padding:'2px 4px' }}>+{specs.filter(s => s.rating >= 4).length - 5} more</span>
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
                    <span 
                      key={`${s.courseTitle || s.title || 'untitled'}-${s.courseCode}`} 
                      style={{ fontSize:10.5, padding:'2px 8px', borderRadius:99, background:'#F1FBF5', color:'#1F7A45', border:'1px solid #DCF3E4', fontWeight:500 }}
                    >
                      {s.courseTitle || s.title || s.courseCode}
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

/* ─── Step 3: Review & Import ────────────────────────────────────────────── */
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
            <div style={{ width:60, height:60, borderRadius:'50%', background:'linear-gradient(135deg,#2E9E5B,#1F7A45)', display:'flex', alignItems:'center', justifyContent:'center', boxShadow:'0 6px 20px rgba(46,158,91,.35)' }}>
              <svg width="26" height="20" viewBox="0 0 26 20" fill="none"><polyline points="2,10 9,17 24,2" stroke="white" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"/></svg>
            </div>
            <div>
              <p style={{ fontWeight:700, fontSize:17, color:'#0E2A20', marginBottom:5 }}>
                {results.committed} {results.committed !== 1 ? 'faculty records' : 'faculty record'} imported!
              </p>
              <p style={{ color:'#5C8A6E', fontSize:13, margin:0 }}>
                Specializations saved. Add emails to each profile to enable faculty login.
              </p>
            </div>
          </div>
        ) : (
          <>
            <div style={{ background:'#FEF3CD', border:'1px solid #F0C040', borderRadius:10, padding:'12px 16px' }}>
              <p style={{ fontWeight:700, fontSize:13, color:'#0E2A20', marginBottom:3 }}>{results.committed} saved · {results.failed.length} failed</p>
              <p style={{ fontSize:12, color:'#5C8A6E', margin:0 }}>Some records could not be saved.</p>
            </div>
            <div style={{ maxHeight:200, overflowY:'auto', border:'1px solid #DCF3E4', borderRadius:10 }}>
              {results.failed.map((f, i) => (
                <div key={i} style={{ padding:'10px 14px', borderBottom: i < results.failed.length - 1 ? '1px solid #E5F9EC' : 'none', fontSize:12 }}>
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
        <span style={{ fontSize:13, color:'#5C8A6E' }}>
          <strong style={{ color:'#0E2A20' }}>{faculty.length}</strong> faculty ready to import
        </span>
        <span style={{ fontSize:10.5, padding:'2px 9px', borderRadius:99, background:'#EEF9F0', color:'#16A34A', border:'1px solid #A7F3D0', fontWeight:600 }}>{fullTime} full-time</span>
        <span style={{ fontSize:10.5, padding:'2px 9px', borderRadius:99, background:'#FFF7ED', color:'#D97706', border:'1px solid #FDE68A', fontWeight:600 }}>{partTime} part-time</span>
        <span style={{ fontSize:11, color:'#7DAB8E', marginLeft:'auto' }}>Click a card to expand</span>
      </div>

      <div style={{ position:'relative' }}>
        <svg style={{ position:'absolute', left:10, top:'50%', transform:'translateY(-50%)', pointerEvents:'none' }} width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="#7DAB8E" strokeWidth="2.5"><circle cx="11" cy="11" r="8"/><line x1="21" y1="21" x2="16.65" y2="16.65"/></svg>
        <input
          value={query}
          onChange={e => setQuery(e.target.value)}
          placeholder="Search faculty name…"
          style={{ width:'100%', paddingLeft:32, paddingRight:12, paddingTop:8, paddingBottom:8, borderRadius:9, border:'1.5px solid #DCF3E4', fontFamily:'Poppins,sans-serif', fontSize:12.5, outline:'none', boxSizing:'border-box' }}
        />
      </div>

      <div style={{ maxHeight:360, overflowY:'auto', display:'flex', flexDirection:'column', gap:8, paddingRight:2 }}>
        {filtered.length === 0 && (
          <div style={{ textAlign:'center', padding:'30px 0', color:'#7DAB8E', fontSize:13 }}>No faculty match your search.</div>
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
        <strong style={{ color:'#2E9E5B' }}>Note:</strong> This saves faculty profiles and their specialization ratings. To enable login, open each faculty profile and add their email address after importing.
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

/* ─── Main Modal ─────────────────────────────────────────────────────────── */
export default function ImportFacultyModal({ onClose, onImported }) {
  const [step,    setStep]    = useState(1)
  const [sheets,  setSheets]  = useState([])
  const [fileData, setFileData] = useState(null)
  const [faculty, setFaculty] = useState([])
  const [ready,   setReady]   = useState(false)

  // Delay backdrop-close to prevent accidental dismissal on open
  useEffect(() => {
    const t = setTimeout(() => setReady(true), 200)
    return () => clearTimeout(t)
  }, [])

  function handleUploaded(s, b) { setSheets(s); setFileData(b); setStep(2) }
  function handleParsed(preview)   { setFaculty(preview); setStep(3) }

  const stepTitles = ['', 'Import Faculty from Excel', 'Select Sheets', 'Review & Import']

  return (
    <div
      style={{ position:'fixed', inset:0, background:'rgba(14,42,32,0.45)', display:'flex', alignItems:'center', justifyContent:'center', zIndex:1000, backdropFilter:'blur(4px)', animation:'ifmFadeIn .18s ease' }}
      onClick={e => { if (ready && e.target === e.currentTarget) onClose() }}
    >
      <div
        style={{
          background:'#fff', borderRadius:18, padding:'26px 28px',
          width: step === 3 ? 620 : 500, maxWidth:'95vw', maxHeight:'90vh',
          overflowY:'auto', fontFamily:"'Poppins',sans-serif",
          boxShadow:'0 24px 64px rgba(14,42,32,0.24),0 4px 16px rgba(46,158,91,0.12)',
          transition:'width .2s ease',
        }}
        onClick={e => e.stopPropagation()}
      >
        {/* Header */}
        <div style={{ display:'flex', justifyContent:'space-between', alignItems:'flex-start', marginBottom:22 }}>
          <div>
            <div style={{ display:'flex', alignItems:'center', gap:10, marginBottom:4 }}>
              <div style={{ width:34, height:34, borderRadius:10, background:'linear-gradient(135deg,#E5F9EC,#C9ECD6)', display:'flex', alignItems:'center', justifyContent:'center', flexShrink:0 }}>
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="#2E9E5B" strokeWidth="2">
                  <path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2"/>
                  <circle cx="9" cy="7" r="4"/>
                  <path d="M23 21v-2a4 4 0 0 0-3-3.87"/>
                  <path d="M16 3.13a4 4 0 0 1 0 7.75"/>
                </svg>
              </div>
              <h2 style={{ fontSize:16, fontWeight:700, color:'#0E2A20', margin:0 }}>{stepTitles[step]}</h2>
            </div>
            <p style={{ fontSize:11.5, color:'#7DAB8E', margin:0, marginLeft:44 }}>
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