import { useState, useRef, useEffect } from 'react'
import * as XLSX from 'xlsx'
import { uploadFaculty, extractFacultySheets, commitFaculty } from '../services/api'
import SpecializationModal from './FacultyDetail/SpecializationModal'
import { ACADEMIC_RANKS, DEPARTMENTS } from './FacultyDetail/fdShared'
import {
  generateBlankTemplateWorkbook, downloadWorkbook,
  readFileAsArrayBuffer, parseFacultyInfoSheet, mergeFacultyInfo,
} from './facultyExcelTemplate'

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
      background:linear-gradient(135deg,var(--meadow),var(--meadow-deep)); color:#fff;
      box-shadow:0 3px 12px rgba(0,0,0,.32);
    }
    .ifm-primary:hover:not(:disabled) { background:linear-gradient(135deg,var(--meadow-mid),var(--meadow-deep)); transform:translateY(-1px); box-shadow:0 5px 18px rgba(0,0,0,.4); }
    .ifm-primary:active:not(:disabled) { transform:translateY(0); }
    .ifm-primary:disabled { opacity:.45; cursor:default; transform:none; box-shadow:none; }

    .ifm-ghost {
      display:inline-flex; align-items:center; gap:6px;
      padding:8px 15px; border-radius:10px;
      border:1.5px solid var(--meadow-border); font-family:'Poppins',sans-serif;
      font-size:12px; font-weight:500; cursor:pointer;
      background:#fff; color:var(--muted); transition:all .13s;
    }
    .ifm-ghost:hover:not(:disabled) { background:var(--meadow-soft); border-color:var(--meadow-border); color:var(--meadow-deep); }
    .ifm-ghost:disabled { opacity:.45; cursor:default; }

    .ifm-download {
      display:inline-flex; align-items:center; gap:6px;
      padding:7px 14px; border-radius:9px;
      border:1.5px solid var(--meadow-border); font-family:'Poppins',sans-serif;
      font-size:11.5px; font-weight:600; cursor:pointer;
      background:var(--meadow-soft); color:var(--meadow); transition:all .13s;
    }
    .ifm-download:hover { background:var(--meadow-soft); border-color:var(--meadow-mid); color:var(--meadow-deep); transform:translateY(-1px); box-shadow:0 3px 10px rgba(0,0,0,.15); }
    .ifm-download:active { transform:translateY(0); box-shadow:none; }

    .ifm-close {
      display: inline-flex; align-items: center; justify-content: center;
      width: 32px; height: 32px; border-radius: 8px;
      border: 1.5px solid var(--meadow-border); cursor: pointer;
      background: var(--meadow-soft); color: var(--meadow); transition: all 0.2s; flex-shrink: 0;
      padding: 0;
    }
    .ifm-close:hover { background:#FFE8E8; border-color:#FECACA; color:#DC2626; }

    .ifm-sheet-btn {
      text-align:left; display:flex; align-items:center; gap:10px;
      padding:12px 16px; border-radius:10px; border:1.5px solid var(--meadow-border);
      background:var(--bg); cursor:pointer; transition:all .13s;
      font-family:'Poppins',sans-serif; font-size:13px; font-weight:600; color:var(--ink);
    }
    .ifm-sheet-btn:hover:not(:disabled) { background:var(--meadow-soft); border-color:var(--meadow-border); }
    .ifm-sheet-btn.active { background:var(--meadow-soft); border-color:var(--meadow-mid); }
    .ifm-sheet-btn:disabled { opacity:.5; cursor:wait; }

    .ifm-card {
      display:flex; align-items:center; gap:14px;
      padding:12px 16px; border-radius:11px;
      border:1.5px solid var(--meadow-border); background:var(--bg);
      transition:border-color .12s;
      animation: ifmFadeIn .15s ease both;
    }
    .ifm-card:hover { border-color:var(--meadow-border); }

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
async function downloadTemplate(courses) {
  const wb = await generateBlankTemplateWorkbook(courses)
  await downloadWorkbook(wb, 'CCS-Faculty-Import-Template.xlsx')
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
  <div style={{ width:16, height:16, border:'2px solid var(--meadow-border)', borderTopColor:'var(--meadow)', borderRadius:'50%', animation:'ifmSpin .8s linear infinite', flexShrink:0 }} />
)

const ErrBox = ({ msg }) => !msg ? null : (
  <div style={{ background:'rgba(220, 38, 38, 0.05)', border:'1px solid #FECACA', borderRadius:9, padding:'9px 13px', fontSize:12, color:'#EF4444', display:'flex', alignItems:'flex-start', gap:7 }}>
    <svg style={{ flexShrink:0, marginTop:1 }} width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"><circle cx="12" cy="12" r="10"/><line x1="12" y1="8" x2="12" y2="12"/><line x1="12" y1="16" x2="12.01" y2="16"/></svg>
    {msg}
  </div>
)

const HintBox = ({ children }) => (
  <div style={{ background:'var(--meadow-soft)', border:'1px solid var(--meadow-border)', borderRadius:10, padding:'11px 14px', fontSize:12, color:'var(--muted)', lineHeight:1.65 }}>
    {children}
  </div>
)

const StatusBadge = ({ status }) => (
  <span style={{
    fontSize:10, fontWeight:700, padding:'2px 9px', borderRadius:99, flexShrink:0,
    background: status === 'full-time' ? 'var(--meadow-soft)' : 'rgba(217, 119, 6, 0.05)',
    color:      status === 'full-time' ? 'var(--meadow)' : '#F59E0B',
    border:     `1px solid ${status === 'full-time' ? 'var(--meadow-border)' : 'rgba(245, 158, 11, 0.25)'}`,
  }}>
    {status === 'full-time' ? 'Full-time' : 'Part-time'}
  </span>
)

const ratingColor = r => r >= 4 ? 'var(--meadow)' : r === 3 ? 'var(--meadow)' : r === 2 ? '#F59E0B' : 'var(--muted)'

function Steps({ current }) {
  const labels = ['Upload', 'Select Sheets', 'Review & Import']
  return (
    <div style={{ display:'flex', alignItems:'center', marginBottom:42, padding:'0 16px' }}>
      {labels.map((label, i) => {
        const idx = i + 1, done = idx < current, active = idx === current
        return (
          <div key={label} style={{ display:'flex', alignItems:'center', flex: i < labels.length - 1 ? 1 : 'none' }}>
            <div style={{ position: 'relative', display:'flex', flexDirection:'column', alignItems:'center' }}>
              <div style={{
                width:30, height:30, borderRadius:'50%', display:'flex', alignItems:'center', justifyContent:'center',
                fontSize:12, fontWeight:700, flexShrink:0, transition:'all .2s',
                background: done ? 'var(--meadow-deep)' : active ? 'var(--meadow)' : 'var(--meadow-soft)',
                color: (done || active) ? '#fff' : 'var(--meadow)',
                boxShadow: active ? '0 3px 12px var(--meadow-border)' : 'none',
              }}>
                {done
                  ? <svg width="12" height="9" viewBox="0 0 12 9" fill="none"><polyline points="1,4.5 4.5,8 11,1" stroke="white" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"/></svg>
                  : idx}
              </div>
              <span style={{ position: 'absolute', top: 38, fontSize:10.5, fontWeight:active?700:500, color:active?'var(--meadow)':done?'var(--meadow-deep)':'var(--muted)', whiteSpace:'nowrap', letterSpacing:'.3px' }}>
                {label}
              </span>
            </div>
            {i < labels.length - 1 && (
              <div style={{ flex:1, height:2, margin:'0 12px', borderRadius:99, background: done ? 'var(--meadow)' : 'var(--meadow-border)', transition:'background .3s' }} />
            )}
          </div>
        )
      })}
    </div>
  )
}

/* ─── Step 1: Upload ─────────────────────────────────────────────────────── */
function UploadStep({ onUploaded, courses }) {
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
      onUploaded(res.sheets, res.fileData, file)
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
          border:`2px dashed ${dragging ? 'var(--meadow)' : 'var(--meadow-border)'}`, borderRadius:14,
          padding:'44px 24px', textAlign:'center',
          background: dragging ? 'var(--meadow-soft)' : 'var(--bg)',
          cursor: isBusy ? 'wait' : 'pointer', transition:'all .15s',
        }}
      >
        {isBusy ? (
          <div style={{ display:'flex', flexDirection:'column', alignItems:'center', gap:10 }}>
            <div style={{ width:40, height:40, borderRadius:'50%', border:'3px solid var(--meadow-border)', borderTopColor:'var(--meadow)', animation:'ifmSpin .8s linear infinite' }} />
            <p style={{ fontSize:13, color:'var(--muted)', fontWeight:500, margin:0 }}>
              {validating ? 'Checking template…' : 'Reading file…'}
            </p>
          </div>
        ) : (
          <>
            <div style={{ width:54, height:54, margin:'0 auto 14px', borderRadius:14, display:'flex', alignItems:'center', justifyContent:'center', background: dragging ? 'linear-gradient(135deg,var(--meadow),var(--meadow-deep))' : 'linear-gradient(135deg,var(--meadow-soft),var(--meadow-border))', boxShadow: dragging ? '0 6px 20px rgba(0,0,0,.35)' : 'none', transition:'all .15s' }}>
              <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke={dragging ? '#fff':'var(--meadow)'} strokeWidth="2">
                <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/>
                <polyline points="17 8 12 3 7 8"/><line x1="12" y1="3" x2="12" y2="15"/>
              </svg>
            </div>
            <p style={{ fontWeight:700, fontSize:14, color:'var(--ink)', marginBottom:4 }}>
              {dragging ? 'Drop it here!' : 'Drop your Faculty Matrix Excel file'}
            </p>
            <p style={{ fontSize:12, color:'var(--muted)', margin:0 }}>
              or <span style={{ color: 'var(--meadow-text)', fontWeight:600 }}>click to browse</span> · .xlsx or .xls
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
          <svg style={{ flexShrink:0, marginTop:1 }} width="14" height="14" viewBox="0 0 24 24" fill="none" stroke='#F59E0B' strokeWidth="2.5"><path d="M10.29 3.86L1.82 18a2 2 0 001.71 3h16.94a2 2 0 001.71-3L13.71 3.86a2 2 0 00-3.42 0z"/><line x1="12" y1="9" x2="12" y2="13"/><line x1="12" y1="17" x2="12.01" y2="17"/></svg>
          <span>
            <strong>Wrong template!</strong> The Course List file is used elsewhere in the system.
            For faculty import, please use the <strong>Faculty Specialization Matrix</strong> template
            (columns = faculty names, rows = course codes, cells = ratings 1–5).
          </span>
        </div>
      )}

      <div style={{ display:'flex', alignItems:'center', justifyContent:'space-between', gap:8 }}>
        <p style={{ fontSize:11.5, color:'var(--muted)', margin:0, lineHeight:1.5 }}>
          Matrix sheet(s) for ratings · "Faculty Info" sheet for basic info, login &amp; schedule (dropdowns included)
        </p>
        <button
          onClick={e => { e.stopPropagation(); downloadTemplate(courses) }}
          style={{
            background:'none', border:'none', padding:0, cursor:'pointer',
            display:'inline-flex', alignItems:'center', gap:4,
            fontSize:11.5, color:'var(--meadow-mid)', fontFamily:"'Poppins',sans-serif",
            fontWeight:500, flexShrink:0, transition:'color .13s',
          }}
          onMouseEnter={e => e.currentTarget.style.color='var(--meadow)'}
          onMouseLeave={e => e.currentTarget.style.color='var(--meadow-mid)'}
          title="Download the Faculty Import template (specialization matrix + Faculty Info sheet)"
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
function SheetStep({ sheets, fileData, rawFile, onParsed, onBack }) {
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

      let merged = splitPreview
      if (rawFile) {
        try {
          const buffer = await readFileAsArrayBuffer(rawFile)
          const infoMap = parseFacultyInfoSheet(buffer)
          merged = mergeFacultyInfo(splitPreview, infoMap)
        } catch {
          // Faculty Info sheet is optional — fall back to specialization-only data
        }
      }

      onParsed(merged)
    } catch (err) {
      setError(err.response?.data?.detail || 'Error parsing the selected sheets.')
      setLoading(false)
    }
  }

  const allSelected = selected.size === sheets.length

  return (
    <div style={{ display:'flex', flexDirection:'column', gap:14 }}>
      <p style={{ fontSize:13, color:'var(--muted)', margin:0 }}>
        Select the sheet(s) that contain faculty specialization data. You can import all at once.
      </p>

      <button
        onClick={toggleAll}
        disabled={loading}
        style={{ alignSelf:'flex-start', display:'flex', alignItems:'center', gap:7, padding:'5px 12px', borderRadius:8, border:'1.5px solid var(--meadow-border)', background: allSelected ? 'var(--meadow-soft)' : 'var(--surface)', cursor:'pointer', fontSize:12, fontWeight:600, color: allSelected ? 'var(--meadow)' : 'var(--muted)', fontFamily:'Poppins,sans-serif', transition:'all .12s' }}
      >
        <div style={{ width:14, height:14, borderRadius:4, border:`1.5px solid ${allSelected?'var(--meadow)':'var(--meadow-border)'}`, background:allSelected?'var(--meadow)':'transparent', display:'flex', alignItems:'center', justifyContent:'center' }}>
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
              <div style={{ width:16, height:16, borderRadius:5, border:`1.5px solid ${isSelected?'var(--meadow)':'var(--meadow-border)'}`, background:isSelected?'var(--meadow)':'transparent', display:'flex', alignItems:'center', justifyContent:'center', flexShrink:0, transition:'all .12s' }}>
                {isSelected && <svg width="8" height="6" viewBox="0 0 8 6" fill="none"><polyline points="1,3 3,5 7,1" stroke="white" strokeWidth="1.4" strokeLinecap="round" strokeLinejoin="round"/></svg>}
              </div>
              <div style={{ width:28, height:28, borderRadius:7, background: isPartTime ? 'rgba(217, 119, 6, 0.05)' : 'var(--meadow-soft)', display:'flex', alignItems:'center', justifyContent:'center' }}>
                <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke={isPartTime?'#F59E0B':'var(--meadow)'} strokeWidth="2">
                  <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/>
                  <polyline points="14 2 14 8 20 8"/>
                  <line x1="16" y1="13" x2="8" y2="13"/><line x1="16" y1="17" x2="8" y2="17"/>
                </svg>
              </div>
              <span style={{ flex:1 }}>{name}</span>
              <span style={{ fontSize:10, fontWeight:600, padding:'2px 8px', borderRadius:99, background: isPartTime?'rgba(217, 119, 6, 0.05)':'var(--meadow-soft)', color: isPartTime?'#F59E0B':'var(--meadow)', border:`1px solid ${isPartTime?'rgba(245, 158, 11, 0.25)':'var(--meadow-border)'}` }}>
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
function FacultyCard({ faculty, onRemove, onEdit, animDelay }) {
  const specs     = faculty.specializations || []
  const topSpecs  = specs.filter(s => s.rating >= 4).slice(0, 5)
  const totalGood = specs.filter(s => s.rating >= 3).length

  return (
    <div className="ifm-card" style={{ flexDirection:'column', alignItems:'stretch', animationDelay:`${animDelay}ms`, cursor:'pointer' }} onClick={onEdit}>
      <div style={{ display:'flex', alignItems:'center', gap:12 }}>
        <div style={{ width:36, height:36, borderRadius:10, background:'linear-gradient(135deg,var(--meadow-soft),var(--meadow-border))', display:'flex', alignItems:'center', justifyContent:'center', flexShrink:0, fontSize:13, fontWeight:700, color: 'var(--meadow-text)' }}>
          {faculty.name.split(',')[0].charAt(0)}
        </div>

        <div style={{ flex:1, minWidth:0 }}>
          <div style={{ display:'flex', alignItems:'center', gap:7, flexWrap:'wrap' }}>
            <span style={{ fontSize:13, fontWeight:700, color:'var(--ink)' }}>{faculty.name}</span>
            <StatusBadge status={faculty.status} />
          </div>
          <div style={{ fontSize:11.5, color:'var(--muted)', marginTop:2 }}>
            <strong style={{ color: 'var(--meadow-text)' }}>{totalGood}</strong> rated courses · <strong style={{ color:'var(--ink)' }}>{specs.length}</strong> total
          </div>
        </div>

        <button className="ifm-remove" onClick={e => { e.stopPropagation(); onRemove() }} title="Remove faculty">
          <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
            <line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/>
          </svg>
        </button>
      </div>

      {topSpecs.length > 0 && (
        <div style={{ display:'flex', flexWrap:'wrap', gap:5, marginTop:8, marginLeft:48 }}>
          {topSpecs.map(s => (
            <span 
              key={`${s.courseTitle || s.title || 'untitled'}-${s.courseCode}`} 
              style={{ fontSize:10.5, fontWeight:600, padding:'2px 8px', borderRadius:99, background:'var(--meadow-soft)', color: 'var(--meadow-text)', border:'1px solid var(--meadow-border)' }}
            >
              {s.courseTitle || s.title || s.courseCode}
              <span style={{ marginLeft:4, color: ratingColor(s.rating), fontWeight:700 }}>{s.rating}</span>
            </span>
          ))}
          {specs.filter(s => s.rating >= 4).length > 5 && (
            <span style={{ fontSize:10.5, color:'var(--muted)', padding:'2px 4px' }}>+{specs.filter(s => s.rating >= 4).length - 5} more</span>
          )}
        </div>
      )}
    </div>
  )
}

/* ─── Step 3: Review & Import ────────────────────────────────────────────── */
function EditPreviewStep({ initialFaculty, onSave, onBack }) {
  const [form, setForm] = useState(() => {
    let fn = '', ln = ''
    if (initialFaculty.name) {
      const parts = initialFaculty.name.split(',')
      ln = (parts[0] || '').trim()
      fn = (parts[1] || '').trim()
    }
    return { ...initialFaculty, firstName: fn, lastName: ln }
  })
  const [showSpec, setShowSpec] = useState(false)
  
  return (
    <div style={{ animation:'ifmFadeIn .2s ease' }}>
      <h3 style={{ margin:'0 0 16px', color:'var(--ink)', fontSize:15, fontWeight:700 }}>Edit Faculty Info</h3>
      
      <div style={{ display:'flex', flexDirection:'column', gap:14 }}>
        <div style={{ display:'flex', gap:14 }}>
          <div style={{ display:'flex', flexDirection:'column', gap:6, flex:1 }}>
            <label style={{ fontSize:11.5, fontWeight:600, color:'var(--muted)' }}>Last Name *</label>
            <input style={{ padding:'8px 12px', borderRadius:8, border:'1.5px solid var(--meadow-border)', outline:'none', fontSize:12.5, textTransform:'uppercase' }} value={form.lastName || ''} onChange={e => { const v = e.target.value.toUpperCase(); setForm(f => { const fn = f.firstName || ''; return {...f, lastName:v, name: v && fn ? `${v}, ${fn}` : v || fn }})}} />
          </div>
          <div style={{ display:'flex', flexDirection:'column', gap:6, flex:1 }}>
            <label style={{ fontSize:11.5, fontWeight:600, color:'var(--muted)' }}>First Name *</label>
            <input style={{ padding:'8px 12px', borderRadius:8, border:'1.5px solid var(--meadow-border)', outline:'none', fontSize:12.5, textTransform:'uppercase' }} value={form.firstName || ''} onChange={e => { const v = e.target.value.toUpperCase(); setForm(f => { const ln = f.lastName || ''; return {...f, firstName:v, name: ln && v ? `${ln}, ${v}` : ln || v }})}} />
          </div>
          <div style={{ display:'flex', flexDirection:'column', gap:6, flex:1 }}>
            <label style={{ fontSize:11.5, fontWeight:600, color:'var(--muted)' }}>Status *</label>
            <select style={{ padding:'8px 12px', borderRadius:8, border:'1.5px solid var(--meadow-border)', outline:'none', fontSize:12.5, background: 'var(--surface)' }} value={form.status || 'full-time'} onChange={e => setForm({...form, status:e.target.value})}>
              <option value="full-time">Full-time</option>
              <option value="part-time">Part-time</option>
            </select>
          </div>
        </div>

        <div style={{ display:'flex', gap:14 }}>
          <div style={{ display:'flex', flexDirection:'column', gap:6, flex:1 }}>
            <label style={{ fontSize:11.5, fontWeight:600, color:'var(--muted)' }}>Email Address</label>
            <input type="email" placeholder="faculty@university.edu" style={{ padding:'8px 12px', borderRadius:8, border:'1.5px solid var(--meadow-border)', outline:'none', fontSize:12.5 }} value={form.email || ''} onChange={e => setForm({...form, email:e.target.value})} />
          </div>
          <div style={{ display:'flex', flexDirection:'column', gap:6, flex:1 }}>
            <label style={{ fontSize:11.5, fontWeight:600, color:'var(--muted)' }}>Sex at Birth</label>
            <select style={{ padding:'8px 12px', borderRadius:8, border:'1.5px solid var(--meadow-border)', outline:'none', fontSize:12.5, background: 'var(--surface)' }} value={form.SexAtBirth || ''} onChange={e => setForm({...form, SexAtBirth:e.target.value})}>
              <option value="">Select...</option>
              <option value="Male">Male</option>
              <option value="Female">Female</option>
              <option value="Other">Other</option>
            </select>
          </div>
        </div>

        <div style={{ display:'flex', gap:14 }}>
          <div style={{ display:'flex', flexDirection:'column', gap:6, flex:1 }}>
            <label style={{ fontSize:11.5, fontWeight:600, color:'var(--muted)' }}>Academic Rank</label>
            <select style={{ padding:'8px 12px', borderRadius:8, border:'1.5px solid var(--meadow-border)', outline:'none', fontSize:12.5, background: 'var(--surface)' }} value={form.AcademicRank || ''} onChange={e => setForm({...form, AcademicRank:e.target.value})}>
              <option value="">Select rank...</option>
              {ACADEMIC_RANKS.map(r => <option key={r} value={r}>{r}</option>)}
            </select>
          </div>
          <div style={{ display:'flex', flexDirection:'column', gap:6, flex:1 }}>
            <label style={{ fontSize:11.5, fontWeight:600, color:'var(--muted)' }}>Department</label>
            <select style={{ padding:'8px 12px', borderRadius:8, border:'1.5px solid var(--meadow-border)', outline:'none', fontSize:12.5, background: 'var(--surface)' }} value={form.Department || ''} onChange={e => setForm({...form, Department:e.target.value})}>
              <option value="">Select department...</option>
              {DEPARTMENTS.map(d => <option key={d} value={d}>{d}</option>)}
            </select>
          </div>
        </div>

        <div style={{ display:'flex', flexDirection:'column', gap:6 }}>
          <label style={{ fontSize:11.5, fontWeight:600, color:'var(--muted)' }}>Educational Attainment</label>
          <input type="text" placeholder="e.g. Master's Degree, PhD" style={{ padding:'8px 12px', borderRadius:8, border:'1.5px solid var(--meadow-border)', outline:'none', fontSize:12.5 }} value={form.Educational_attainment || ''} onChange={e => setForm({...form, Educational_attainment:e.target.value})} />
        </div>

        {form.status === 'part-time' && (
          <div style={{ display:'flex', flexDirection:'column', gap:6 }}>
            <label style={{ fontSize:11.5, fontWeight:600, color:'var(--muted)' }}>Preferred Days</label>
            <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
              {['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'].map(d => {
                const isActive = (form.preferredDays || []).includes(d)
                return (
                  <button key={d} onClick={() => {
                    const days = form.preferredDays || []
                    setForm({ ...form, preferredDays: isActive ? days.filter(x => x !== d) : [...days, d] })
                  }} style={{ padding: '6px 12px', borderRadius: 8, border: `1.5px solid ${isActive ? 'var(--meadow)' : 'var(--meadow-border)'}`, background: isActive ? 'var(--meadow-soft)' : 'var(--surface)', color: isActive ? 'var(--meadow)' : 'var(--muted)', fontSize: 11.5, fontWeight: 600, cursor: 'pointer', transition: 'all 0.1s' }}>
                    {d}
                  </button>
                )
              })}
            </div>
          </div>
        )}

        <div style={{ display:'flex', flexDirection:'column', gap:6 }}>
          <label style={{ fontSize:11.5, fontWeight:600, color:'var(--muted)' }}>Specializations</label>
          <button className="ifm-ghost" onClick={() => setShowSpec(true)} style={{ justifyContent:'center', background: 'var(--surface)', color: 'var(--meadow-text)' }}>
            Manage {form.specializations?.length || 0} specializations...
          </button>
        </div>
      </div>
      
      <div style={{ display:'flex', gap:8, marginTop:24 }}>
        <button className="ifm-primary" onClick={() => {
          if (!form.name.trim()) return;
          onSave(form)
        }}>Save Changes</button>
        <button className="ifm-ghost" onClick={onBack}>Cancel</button>
      </div>

      {showSpec && (
        <SpecializationModal
          specializations={form.specializations || []}
          onSave={specs => { setForm(f => ({...f, specializations: specs})); setShowSpec(false) }}
          onClose={() => setShowSpec(false)}
        />
      )}
    </div>
  )
}

function ReviewStep({ faculty, setFaculty, onBack, onImported }) {
  const [saving,  setSaving]  = useState(false)
  const [results, setResults] = useState(null)
  const [error,   setError]   = useState('')
  const [query,   setQuery]   = useState('')
  const [editTarget, setEditTarget] = useState(null)

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

  function saveEdit(updatedFaculty) {
    setFaculty(prev => prev.map(f => f.name === editTarget.name ? updatedFaculty : f))
    setEditTarget(null)
  }

  if (editTarget) {
    return (
      <EditPreviewStep 
        initialFaculty={editTarget} 
        onSave={saveEdit} 
        onBack={() => setEditTarget(null)} 
      />
    )
  }

  if (results) {
    const allGood = results.failed.length === 0
    return (
      <div style={{ display:'flex', flexDirection:'column', gap:16, animation:'ifmPop .2s ease' }}>
        {allGood ? (
          <div style={{ textAlign:'center', padding:'36px 0', display:'flex', flexDirection:'column', alignItems:'center', gap:14 }}>
            <div style={{ width:60, height:60, borderRadius:'50%', background:'linear-gradient(135deg,var(--meadow),var(--meadow-deep))', display:'flex', alignItems:'center', justifyContent:'center', boxShadow:'0 6px 20px rgba(0,0,0,.35)' }}>
              <svg width="26" height="20" viewBox="0 0 26 20" fill="none"><polyline points="2,10 9,17 24,2" stroke="white" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"/></svg>
            </div>
            <div>
              <p style={{ fontWeight:700, fontSize:17, color:'var(--ink)', marginBottom:5 }}>
                {results.committed} {results.committed !== 1 ? 'faculty records' : 'faculty record'} imported!
              </p>
              <p style={{ color:'var(--muted)', fontSize:13, margin:0 }}>
                Specializations saved. Add emails to each profile to enable faculty login.
              </p>
            </div>
          </div>
        ) : (
          <>
            <div style={{ background:'rgba(217, 119, 6, 0.1)', border:'1px solid #F0C040', borderRadius:10, padding:'12px 16px' }}>
              <p style={{ fontWeight:700, fontSize:13, color:'var(--ink)', marginBottom:3 }}>{results.committed} saved · {results.failed.length} failed</p>
              <p style={{ fontSize:12, color:'var(--muted)', margin:0 }}>Some records could not be saved.</p>
            </div>
            <div style={{ maxHeight:200, overflowY:'auto', border:'1px solid var(--meadow-border)', borderRadius:10 }}>
              {results.failed.map((f, i) => (
                <div key={i} style={{ padding:'10px 14px', borderBottom: i < results.failed.length - 1 ? '1px solid var(--meadow-soft)' : 'none', fontSize:12 }}>
                  <strong>{f.faculty?.name}</strong> — <span style={{ color:'#EF4444' }}>{f.reason}</span>
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
        <span style={{ fontSize:13, color:'var(--muted)' }}>
          <strong style={{ color:'var(--ink)' }}>{faculty.length}</strong> faculty ready to import
        </span>
        <span style={{ fontSize:10.5, padding:'2px 9px', borderRadius:99, background:'var(--meadow-soft)', color: 'var(--meadow-text)', border:'1px solid #A7F3D0', fontWeight:600 }}>{fullTime} full-time</span>
        <span style={{ fontSize:10.5, padding:'2px 9px', borderRadius:99, background:'rgba(217, 119, 6, 0.05)', color:'#F59E0B', border:'1px solid #FDE68A', fontWeight:600 }}>{partTime} part-time</span>
        <span style={{ fontSize:11, color:'var(--muted)', marginLeft:'auto' }}>Click a card to edit</span>
      </div>

      <div style={{ position:'relative' }}>
        <svg style={{ position:'absolute', left:10, top:'50%', transform:'translateY(-50%)', pointerEvents:'none' }} width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="var(--muted)" strokeWidth="2.5"><circle cx="11" cy="11" r="8"/><line x1="21" y1="21" x2="16.65" y2="16.65"/></svg>
        <input
          value={query}
          onChange={e => setQuery(e.target.value)}
          placeholder="Search faculty name…"
          style={{ width:'100%', paddingLeft:32, paddingRight:12, paddingTop:8, paddingBottom:8, borderRadius:9, border:'1.5px solid var(--meadow-border)', fontFamily:'Poppins,sans-serif', fontSize:12.5, outline:'none', boxSizing:'border-box' }}
        />
      </div>

      <div style={{ maxHeight:360, overflowY:'auto', display:'flex', flexDirection:'column', gap:8, paddingRight:2 }}>
        {filtered.length === 0 && (
          <div style={{ textAlign:'center', padding:'30px 0', color:'var(--muted)', fontSize:13 }}>No faculty match your search.</div>
        )}
        {filtered.map((f, i) => (
          <FacultyCard
            key={f.name}
            faculty={f}
            animDelay={i * 30}
            onRemove={() => removeFaculty(f.name)}
            onEdit={() => setEditTarget(f)}
          />
        ))}
      </div>

      <ErrBox msg={error} />

      <HintBox>
        <strong style={{ color: 'var(--meadow-text)' }}>Note:</strong> Specialization ratings come from the matrix sheet(s) you selected. Basic info, login email, and preferred schedule come from the "Faculty Info" sheet if you filled it in — otherwise add them per profile after importing.
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
export default function ImportFacultyModal({ onClose, onImported, courses = [] }) {
  const [step,    setStep]    = useState(1)
  const [sheets,  setSheets]  = useState([])
  const [fileData, setFileData] = useState(null)
  const [rawFile, setRawFile] = useState(null)
  const [faculty, setFaculty] = useState([])
  const [ready,   setReady]   = useState(false)

  // Delay backdrop-close to prevent accidental dismissal on open
  useEffect(() => {
    const t = setTimeout(() => setReady(true), 200)
    return () => clearTimeout(t)
  }, [])

  function handleUploaded(s, b, f) {
    const skip = ['faculty info', '_lists', 'course list']
    const validSheets = s.filter(name => !skip.includes(name.trim().toLowerCase()))
    setSheets(validSheets)
    setFileData(b)
    setRawFile(f)
    setStep(2)
  }
  function handleParsed(preview)   { setFaculty(preview); setStep(3) }

  const stepTitles = ['', 'Import Faculty from Excel', 'Select Sheets', 'Review & Import']

  return (
    <div
      style={{ position:'fixed', inset:0, background:'rgba(14,42,32,0.45)', display:'flex', alignItems:'center', justifyContent:'center', zIndex:1000, backdropFilter:'blur(4px)', animation:'ifmFadeIn .18s ease' }}
      onClick={e => { if (ready && e.target === e.currentTarget) onClose() }}
    >
      <div
        style={{
          background: 'var(--surface)', borderRadius:18, padding:'26px 28px',
          width: step === 3 ? 620 : 500, maxWidth:'95vw', maxHeight:'90vh',
          overflowY:'auto', fontFamily:"'Poppins',sans-serif",
          boxShadow:'0 24px 64px rgba(14,42,32,0.24),0 4px 16px rgba(0,0,0,0.12)',
          transition:'width .2s ease',
        }}
        onClick={e => e.stopPropagation()}
      >
        {/* Header */}
        <div style={{ display:'flex', justifyContent:'space-between', alignItems:'flex-start', marginBottom:22 }}>
          <div>
            <div style={{ display:'flex', alignItems:'center', gap:10, marginBottom:4 }}>
              <div style={{ width:34, height:34, borderRadius:10, background:'linear-gradient(135deg,var(--meadow-soft),var(--meadow-border))', display:'flex', alignItems:'center', justifyContent:'center', flexShrink:0 }}>
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="var(--meadow)" strokeWidth="2">
                  <path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2"/>
                  <circle cx="9" cy="7" r="4"/>
                  <path d="M23 21v-2a4 4 0 0 0-3-3.87"/>
                  <path d="M16 3.13a4 4 0 0 1 0 7.75"/>
                </svg>
              </div>
              <h2 style={{ fontSize:16, fontWeight:700, color:'var(--ink)', margin:0 }}>{stepTitles[step]}</h2>
            </div>
            <p style={{ fontSize:11.5, color:'var(--muted)', margin:0, marginLeft:44 }}>
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

        {step === 1 && <UploadStep onUploaded={handleUploaded} courses={courses} />}
        {step === 2 && <SheetStep sheets={sheets} fileData={fileData} rawFile={rawFile} onParsed={handleParsed} onBack={() => setStep(1)} />}
        {step === 3 && <ReviewStep faculty={faculty} setFaculty={setFaculty} onBack={() => setStep(2)} onImported={onImported} />}
      </div>
    </div>
  )
}