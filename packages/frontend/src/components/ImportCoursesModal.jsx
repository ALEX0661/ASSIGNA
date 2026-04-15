import { useState, useRef } from 'react'
import { uploadCourses, extractSheet, commitCourses } from '../services/api'

// ─── helpers ─────────────────────────────────────────────────────────────────

const PROGRAMS = ['BSIT', 'BSCS', 'BSEMC-DAT', 'BSEMC-GD']

const ORDINAL = (n) => {
  const s = ['th', 'st', 'nd', 'rd']
  const v = n % 100
  return n + (s[(v - 20) % 10] || s[v] || s[0])
}

// ─── Step indicators ──────────────────────────────────────────────────────────

function Steps({ current }) {
  const steps = ['Upload', 'Select Sheet', 'Blocks', 'Review']
  return (
    <div style={{ display: 'flex', alignItems: 'center', marginBottom: 28 }}>
      {steps.map((label, i) => {
        const idx   = i + 1
        const done  = idx < current
        const active = idx === current
        return (
          <div key={label} style={{ display: 'flex', alignItems: 'center', flex: i < steps.length - 1 ? 1 : 'none' }}>
            <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 4 }}>
              <div style={{
                width: 28, height: 28, borderRadius: '50%', display: 'flex',
                alignItems: 'center', justifyContent: 'center', fontSize: 12, fontWeight: 700,
                background: done ? '#1a6b2c' : active ? '#000' : '#ddd',
                color: done || active ? '#fff' : '#999',
                flexShrink: 0,
              }}>
                {done ? '✓' : idx}
              </div>
              <span style={{ fontSize: 11, fontWeight: active ? 600 : 400, color: active ? '#000' : '#888', whiteSpace: 'nowrap' }}>
                {label}
              </span>
            </div>
            {i < steps.length - 1 && (
              <div style={{ flex: 1, height: 2, background: done ? '#1a6b2c' : '#ddd', margin: '0 8px', marginBottom: 18 }} />
            )}
          </div>
        )
      })}
    </div>
  )
}

// ─── Step 1: File upload ──────────────────────────────────────────────────────

function UploadStep({ onUploaded }) {
  const [dragging,  setDragging]  = useState(false)
  const [loading,   setLoading]   = useState(false)
  const [error,     setError]     = useState('')
  const inputRef = useRef()

  async function processFile(file) {
    if (!file) return
    if (!file.name.match(/\.(xlsx|xls)$/i)) {
      setError('Please upload an .xlsx or .xls file.')
      return
    }
    setLoading(true)
    setError('')
    try {
      const res = await uploadCourses(file)
      if (!res.sheets || res.sheets.length === 0) {
        setError('No sheets found in the file.')
        return
      }
      onUploaded(res.sheets, res.fileData)
    } catch (err) {
      setError(err.response?.data?.detail || 'Could not parse the file. Check the format and try again.')
    } finally {
      setLoading(false)
    }
  }

  return (
    <div>
      <p style={{ fontSize: 13, color: '#666', marginBottom: 20 }}>
        Upload an Excel file (.xlsx / .xls). Expected columns:
        <br />
        <code style={{ fontSize: 11, color: '#444' }}>
          Course Code · Title · Program · Year Level · Units Lecture · Units Lab
        </code>
      </p>

      {/* Drop zone */}
      <div
        onDragOver={e => { e.preventDefault(); setDragging(true) }}
        onDragLeave={() => setDragging(false)}
        onDrop={e => { e.preventDefault(); setDragging(false); processFile(e.dataTransfer.files[0]) }}
        onClick={() => inputRef.current?.click()}
        style={{
          border: `2px dashed ${dragging ? '#000' : '#ccc'}`,
          borderRadius: 8, padding: '40px 20px', textAlign: 'center',
          background: dragging ? '#f9f9f9' : '#fff',
          cursor: 'pointer', transition: 'all .15s',
          marginBottom: 16,
        }}
      >
        {loading ? (
          <p style={{ color: '#888', fontSize: 14 }}>Reading file…</p>
        ) : (
          <>
            <div style={{ fontSize: 32, marginBottom: 8 }}>📄</div>
            <p style={{ fontWeight: 600, marginBottom: 4 }}>Drop your Excel file here</p>
            <p style={{ fontSize: 12, color: '#888' }}>or click to browse</p>
          </>
        )}
      </div>
      <input
        ref={inputRef}
        type="file"
        accept=".xlsx,.xls"
        style={{ display: 'none' }}
        onChange={e => { processFile(e.target.files[0]); e.target.value = null }}
      />

      {error && <p style={{ color: '#c00', fontSize: 13, marginTop: 8 }}>{error}</p>}

      {/* Template hint */}
      <div style={{ marginTop: 16, padding: '10px 14px', background: '#f5f5f5', borderRadius: 6, fontSize: 12, color: '#666' }}>
        <strong>Expected column names (case-insensitive):</strong><br />
        <code>Course Code</code>, <code>Title</code>, <code>Program</code>, <code>Year Level</code>, <code>Units Lecture</code>, <code>Units Lab</code>
        <br /><br />
        Blocks are configured later — you don't need a Blocks column.
      </div>
    </div>
  )
}

// ─── Step 2: Sheet Selection ──────────────────────────────────────────────────

function SheetSelectionStep({ sheets, fileData, onParsed, onBack }) {
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')

  async function handleSelect(sheetName) {
    setLoading(true)
    setError('')
    try {
      // Calls the new /upload/extract endpoint
      const res = await extractSheet({ sheetName, fileData })
      if (!res.preview || res.preview.length === 0) {
        setError(`No valid courses found in sheet "${sheetName}". Please check column headers.`)
        setLoading(false)
        return
      }
      onParsed(res.preview)
    } catch (err) {
      setError(err.response?.data?.detail || "Error extracting data from this sheet.")
      setLoading(false)
    }
  }

  return (
    <div>
      <p style={{ fontSize: 14, color: '#333', marginBottom: 16, fontWeight: 500 }}>
        Multiple sheets found. Which one contains the course data?
      </p>
      
      <div style={{ display: 'flex', flexDirection: 'column', gap: 10, marginBottom: 20 }}>
        {sheets.map(name => (
          <button 
            key={name} 
            onClick={() => handleSelect(name)} 
            disabled={loading}
            style={{ 
              textAlign: 'left', padding: '14px 16px', background: '#fafafa', 
              border: '1px solid #ddd', borderRadius: 6, cursor: 'pointer',
              fontSize: 14, display: 'flex', justifyContent: 'space-between'
            }}
          >
            <span>📄 {name}</span>
            {loading && <span style={{color: '#888', fontSize: 12}}>Extracting...</span>}
          </button>
        ))}
      </div>

      {error && <p style={{ color: '#c00', fontSize: 13, marginBottom: 16 }}>{error}</p>}

      <button type="button" onClick={onBack} disabled={loading}>← Back to upload</button>
    </div>
  )
}


// ─── Step 3: Block configuration ─────────────────────────────────────────────

function BlockConfigStep({ courses, onBack, onSubmit }) {
  // Deduplicate program+yearLevel combinations
  const groups = []
  const seen   = new Set()
  courses.forEach(c => {
    const key = `${c.program}_${c.yearLevel}`
    if (!seen.has(key)) {
      seen.add(key)
      groups.push({ key, program: c.program, yearLevel: Number(c.yearLevel) })
    }
  })
  groups.sort((a, b) => a.program.localeCompare(b.program) || a.yearLevel - b.yearLevel)

  const [blocks, setBlocks] = useState(() => {
    const init = {}
    groups.forEach(g => { init[g.key] = '' })
    return init
  })
  const [error, setError] = useState('')

  function handleSubmit(e) {
    e.preventDefault()
    const missing = groups.filter(g => !blocks[g.key] || Number(blocks[g.key]) < 1)
    if (missing.length > 0) {
      setError(`Please enter at least 1 block for: ${missing.map(g => `${g.program} Y${g.yearLevel}`).join(', ')}`)
      return
    }
    onSubmit(blocks)
  }

  return (
    <form onSubmit={handleSubmit}>
      <p style={{ fontSize: 13, color: '#666', marginBottom: 20 }}>
        Set the number of sections/blocks for each program-year combination found in the file.
      </p>

      <div style={{ display: 'flex', flexDirection: 'column', gap: 10, marginBottom: 20 }}>
        {groups.map(g => (
          <div key={g.key} style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '10px 14px', background: '#fafafa', border: '1px solid #eee', borderRadius: 6 }}>
            <span style={{ fontWeight: 500, fontSize: 14 }}>
              {g.program} — {ORDINAL(g.yearLevel)} Year
            </span>
            <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
              <span style={{ fontSize: 12, color: '#888' }}>Blocks:</span>
              <input
                type="number" min={1} max={20}
                value={blocks[g.key]}
                onChange={e => setBlocks(prev => ({ ...prev, [g.key]: e.target.value }))}
                placeholder="e.g. 3"
                style={{ width: 80, textAlign: 'center' }}
                required
              />
            </div>
          </div>
        ))}
      </div>

      {error && <p style={{ color: '#c00', fontSize: 13, marginBottom: 12 }}>{error}</p>}

      <div style={{ display: 'flex', gap: 8 }}>
        <button type="submit" className="primary">Continue to preview</button>
        <button type="button" onClick={onBack}>← Back</button>
      </div>
    </form>
  )
}

// ─── Step 4: Review & save ────────────────────────────────────────────────────

function ReviewStep({ courses, onBack, onCommit, onRemove, onEdit }) {
  const [saving,  setSaving]  = useState(false)
  const [results, setResults] = useState(null)  // { saved, failed }

  async function handleSave() {
    setSaving(true)
    try {
      const res = await onCommit(courses)
      setResults(res)
    } finally {
      setSaving(false)
    }
  }

  if (results) {
    return (
      <div>
        {results.failed.length === 0 ? (
          <div style={{ textAlign: 'center', padding: '30px 0' }}>
            <div style={{ fontSize: 40, marginBottom: 12 }}>✅</div>
            <p style={{ fontWeight: 700, fontSize: 16, marginBottom: 4 }}>
              {results.saved} course{results.saved !== 1 ? 's' : ''} saved successfully
            </p>
            <p style={{ color: '#888', fontSize: 13 }}>You can now use these courses in the scheduler.</p>
          </div>
        ) : (
          <div>
            <div style={{ padding: '12px 16px', background: '#fff8e6', border: '1px solid #f0c040', borderRadius: 6, marginBottom: 16 }}>
              <p style={{ fontWeight: 600, marginBottom: 4 }}>
                {results.saved} saved · {results.failed.length} failed
              </p>
              <p style={{ fontSize: 12, color: '#666' }}>
                The courses below could not be saved (they may already exist or have invalid data).
                You can remove them or retry.
              </p>
            </div>
            <div className="card" style={{ padding: 0, overflow: 'hidden', marginBottom: 16 }}>
              <table>
                <thead>
                  <tr><th>Code</th><th>Title</th><th>Program</th><th>Reason</th></tr>
                </thead>
                <tbody>
                  {results.failed.map((f, i) => (
                    <tr key={i}>
                      <td style={{ fontWeight: 500 }}>{f.course.courseCode}</td>
                      <td>{f.course.title}</td>
                      <td>{f.course.program}</td>
                      <td style={{ color: '#c00', fontSize: 12 }}>{f.reason}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        )}
      </div>
    )
  }

  // Group courses by program for readability
  const byProgram = courses.reduce((acc, c) => {
    const key = c.program
    if (!acc[key]) acc[key] = []
    acc[key].push(c)
    return acc
  }, {})

  // Validation: highlight rows missing required fields
  const isValid = (c) => c.courseCode && c.title && c.program && Number(c.blocks) >= 1

  const invalidCount = courses.filter(c => !isValid(c)).length

  return (
    <div>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 }}>
        <p style={{ fontSize: 13, color: '#666' }}>
          {courses.length} course{courses.length !== 1 ? 's' : ''} ready to import.
          {invalidCount > 0 && (
            <span style={{ color: '#c00', marginLeft: 8 }}>
              ⚠ {invalidCount} row{invalidCount !== 1 ? 's' : ''} have missing data (highlighted).
            </span>
          )}
        </p>
        <span style={{ fontSize: 12, color: '#888' }}>Click a row to edit inline</span>
      </div>

      <div style={{ maxHeight: 360, overflowY: 'auto', border: '1px solid #eee', borderRadius: 6, marginBottom: 20 }}>
        <table style={{ width: '100%' }}>
          <thead style={{ position: 'sticky', top: 0, background: '#fff', zIndex: 1 }}>
            <tr>
              <th>Code</th><th>Title</th><th>Program</th><th>Yr</th>
              <th>Lec</th><th>Lab</th><th>Blocks</th><th></th>
            </tr>
          </thead>
          <tbody>
            {Object.entries(byProgram).map(([prog, rows]) =>
              rows.map((c, i) => (
                <EditableRow
                  key={`${c.courseCode}_${i}`}
                  course={c}
                  invalid={!isValid(c)}
                  onEdit={updated => onEdit(c, updated)}
                  onRemove={() => onRemove(c)}
                />
              ))
            )}
          </tbody>
        </table>
      </div>

      <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
        <button className="primary" onClick={handleSave} disabled={saving || courses.length === 0}>
          {saving ? 'Saving…' : `Save ${courses.length} course${courses.length !== 1 ? 's' : ''}`}
        </button>
        <button onClick={onBack} disabled={saving}>← Back</button>
        <span style={{ fontSize: 12, color: '#888', marginLeft: 'auto' }}>
          {invalidCount > 0 ? `Fix ${invalidCount} row${invalidCount !== 1 ? 's' : ''} before saving, or they will be skipped.` : ''}
        </span>
      </div>
    </div>
  )
}

// ─── Inline-editable table row ────────────────────────────────────────────────

function EditableRow({ course, invalid, onEdit, onRemove }) {
  const [editing, setEditing] = useState(false)
  const [draft,   setDraft]   = useState({ ...course })

  function save() {
    onEdit({ ...draft, yearLevel: Number(draft.yearLevel), unitsLecture: Number(draft.unitsLecture), unitsLab: Number(draft.unitsLab), blocks: Number(draft.blocks) })
    setEditing(false)
  }

  function cancel() {
    setDraft({ ...course })
    setEditing(false)
  }

  const rowStyle = {
    background: invalid ? '#fff5f5' : 'transparent',
    cursor: editing ? 'default' : 'pointer',
  }

  const cellInput = (field, opts = {}) => (
    <input
      value={draft[field] ?? ''}
      onChange={e => setDraft(d => ({ ...d, [field]: e.target.value }))}
      onClick={e => e.stopPropagation()}
      style={{ width: '100%', minWidth: opts.wide ? 120 : 60, fontSize: 12, padding: '3px 5px' }}
      type={opts.number ? 'number' : 'text'}
      min={opts.min}
    />
  )

  if (editing) {
    return (
      <tr style={{ background: '#f0f7ff' }}>
        <td>{cellInput('courseCode')}</td>
        <td>{cellInput('title', { wide: true })}</td>
        <td>
          <select value={draft.program} onChange={e => setDraft(d => ({...d, program: e.target.value}))} style={{ fontSize: 12 }}>
            {PROGRAMS.map(p => <option key={p} value={p}>{p}</option>)}
          </select>
        </td>
        <td>{cellInput('yearLevel', { number: true, min: 1 })}</td>
        <td>{cellInput('unitsLecture', { number: true, min: 0 })}</td>
        <td>{cellInput('unitsLab', { number: true, min: 0 })}</td>
        <td>{cellInput('blocks', { number: true, min: 1 })}</td>
        <td>
          <div style={{ display: 'flex', gap: 4 }}>
            <button onClick={save}    style={{ fontSize: 11, padding: '2px 8px' }}>✓</button>
            <button onClick={cancel}  style={{ fontSize: 11, padding: '2px 8px' }}>✕</button>
          </div>
        </td>
      </tr>
    )
  }

  return (
    <tr style={rowStyle} onClick={() => setEditing(true)}>
      <td style={{ fontWeight: 500 }}>{course.courseCode || <span style={{ color: '#c00' }}>—</span>}</td>
      <td>{course.title      || <span style={{ color: '#c00' }}>—</span>}</td>
      <td>{course.program    || <span style={{ color: '#c00' }}>—</span>}</td>
      <td style={{ textAlign: 'center' }}>{course.yearLevel}</td>
      <td style={{ textAlign: 'center' }}>{course.unitsLecture}</td>
      <td style={{ textAlign: 'center' }}>{course.unitsLab}</td>
      <td style={{ textAlign: 'center' }}>
        {Number(course.blocks) >= 1
          ? course.blocks
          : <span style={{ color: '#c00', fontWeight: 600 }}>!</span>
        }
      </td>
      <td>
        <button
          className="danger"
          onClick={e => { e.stopPropagation(); onRemove() }}
          style={{ fontSize: 11, padding: '2px 8px' }}
        >
          ✕
        </button>
      </td>
    </tr>
  )
}

// ─── Main modal ───────────────────────────────────────────────────────────────

export default function ImportCoursesModal({ onClose, onImported }) {
  const [step,    setStep]    = useState(1)
  const [sheets,  setSheets]  = useState([])   // available sheet names
  const [fileData, setFileData] = useState(null) // base64 representation of file
  const [parsed,  setParsed]  = useState([])   // raw from backend specific sheet
  const [courses, setCourses] = useState([])   // with blocks applied

  // Step 1 → 2: file uploaded and sheets found
  function handleUploaded(foundSheets, base64Data) {
    setSheets(foundSheets)
    setFileData(base64Data)
    // If only 1 sheet, you could optionally auto-skip, but selecting is safer
    setStep(2)
  }

  // Step 2 → 3: specific sheet parsed successfully
  function handleParsed(preview) {
    setParsed(preview)
    setStep(3)
  }

  // Step 3 → 4: blocks configured
  function handleBlockConfig(blocksMap) {
    const withBlocks = parsed.map(c => {
      const key = `${c.program}_${c.yearLevel}`
      return { ...c, blocks: Number(blocksMap[key]) || 0 }
    })
    setCourses(withBlocks)
    setStep(4)
  }

  // Inline edit a row
  function handleEdit(original, updated) {
    setCourses(prev => prev.map(c =>
      c.courseCode === original.courseCode && c.program === original.program && c.yearLevel === original.yearLevel
        ? updated
        : c
    ))
  }

  // Remove a row from preview
  function handleRemove(course) {
    setCourses(prev => prev.filter(c => !(
      c.courseCode === course.courseCode &&
      c.program   === course.program    &&
      c.yearLevel === course.yearLevel
    )))
  }

  // Commit to backend — returns { saved, failed }
  async function handleCommit(rows) {
    // Only send valid rows; track invalid ones as immediate failures
    const valid   = rows.filter(c => c.courseCode && c.title && c.program && Number(c.blocks) >= 1)
    const invalid = rows.filter(c => !(c.courseCode && c.title && c.program && Number(c.blocks) >= 1))

    const failed = invalid.map(c => ({ course: c, reason: 'Missing required field(s)' }))

    try {
      // Use the batch commit endpoint
      const res = await commitCourses(valid)
      onImported?.()
      return { saved: res.committed ?? valid.length, failed }
    } catch (err) {
      // If the batch endpoint fails entirely, surface it
      const reason = err.response?.data?.detail || 'Server error'
      return {
        saved: 0,
        failed: [...rows.map(c => ({ course: c, reason }))],
      }
    }
  }

  const overlay = {
    position: 'fixed', inset: 0,
    background: 'rgba(0,0,0,0.45)',
    display: 'flex', alignItems: 'center', justifyContent: 'center',
    zIndex: 1000,
  }
  const modal = {
    background: '#fff', borderRadius: 10, padding: '28px 32px',
    width: 680, maxWidth: '95vw', maxHeight: '90vh',
    overflowY: 'auto', boxShadow: '0 8px 40px rgba(0,0,0,.18)',
  }

  return (
    <div style={overlay} onClick={e => e.target === e.currentTarget && onClose()}>
      <div style={modal}>
        {/* Header */}
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 24 }}>
          <div>
            <p style={{ fontWeight: 700, fontSize: 18, marginBottom: 2 }}>Import courses from Excel</p>
            <p style={{ fontSize: 12, color: '#888' }}>Upload → select sheet → configure blocks → review → save</p>
          </div>
          <button onClick={onClose} style={{ background: 'none', border: 'none', fontSize: 20, cursor: 'pointer', color: '#888', lineHeight: 1 }}>×</button>
        </div>

        <Steps current={step} />

        {step === 1 && (
          <UploadStep onUploaded={handleUploaded} />
        )}

        {step === 2 && (
          <SheetSelectionStep
            sheets={sheets}
            fileData={fileData}
            onParsed={handleParsed}
            onBack={() => setStep(1)}
          />
        )}

        {step === 3 && (
          <BlockConfigStep
            courses={parsed}
            onBack={() => setStep(2)}
            onSubmit={handleBlockConfig}
          />
        )}

        {step === 4 && (
          <ReviewStep
            courses={courses}
            onBack={() => setStep(3)}
            onCommit={handleCommit}
            onRemove={handleRemove}
            onEdit={handleEdit}
          />
        )}
      </div>
    </div>
  )
}