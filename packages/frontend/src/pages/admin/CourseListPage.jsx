import { useEffect, useState } from 'react'
import { getCourses, addCourse, deleteCourse } from '../../services/api'
import ImportCoursesModal from '../../components/ImportCoursesModal'

const empty = {
  courseCode: '', title: '', program: '', yearLevel: 1,
  blocks: 1, unitsLecture: 3, unitsLab: 0,
}

export default function CourseListPage() {
  const [courses,      setCourses]      = useState([])
  const [search,       setSearch]       = useState('')
  const [showForm,     setShowForm]     = useState(false)
  const [showImport,   setShowImport]   = useState(false)
  const [form,         setForm]         = useState(empty)
  const [saving,       setSaving]       = useState(false)
  const [error,        setError]        = useState('')

  async function load() { setCourses(await getCourses()) }
  useEffect(() => { load() }, [])

  async function handleAdd(e) {
    e.preventDefault()
    setSaving(true)
    setError('')
    try {
      await addCourse({
        ...form,
        yearLevel:    Number(form.yearLevel),
        blocks:       Number(form.blocks),
        unitsLecture: Number(form.unitsLecture),
        unitsLab:     Number(form.unitsLab),
      })
      setForm(empty)
      setShowForm(false)
      load()
    } catch (err) {
      setError(err.response?.data?.detail || 'Failed to add course.')
    } finally {
      setSaving(false) }
  }

  async function handleDelete(code, prog) {
    if (!confirm(`Delete ${code}?`)) return
    await deleteCourse(code, prog)
    load()
  }

  const filtered = courses.filter(c =>
    `${c.courseCode} ${c.title} ${c.program}`.toLowerCase().includes(search.toLowerCase())
  )

  return (
    <div className="page">
      {/* ── Header ── */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 }}>
        <p className="page-title" style={{ margin: 0 }}>
          Courses
          <span style={{ fontSize: 13, fontWeight: 400, color: '#888', marginLeft: 10 }}>
            {courses.length} total
          </span>
        </p>
        <div style={{ display: 'flex', gap: 8 }}>
          <button onClick={() => setShowImport(true)}>↑ Import Excel</button>
          <button className="primary" onClick={() => setShowForm(!showForm)}>+ Add course</button>
        </div>
      </div>

      {/* ── Add form ── */}
      {showForm && (
        <form
          onSubmit={handleAdd}
          className="card"
          style={{ marginBottom: 16, display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 12 }}
        >
          <input placeholder="Course code *"
            value={form.courseCode} onChange={e => setForm(f => ({...f, courseCode: e.target.value}))} required />
          <input placeholder="Title *" style={{ gridColumn: 'span 2' }}
            value={form.title}      onChange={e => setForm(f => ({...f, title:      e.target.value}))} required />
          <input placeholder="Program *"
            value={form.program}    onChange={e => setForm(f => ({...f, program:    e.target.value}))} required />
          <input placeholder="Year level" type="number" min={1} max={4}
            value={form.yearLevel}    onChange={e => setForm(f => ({...f, yearLevel:    e.target.value}))} />
          <input placeholder="Sections"   type="number" min={1}
            value={form.blocks}         onChange={e => setForm(f => ({...f, blocks:         e.target.value}))} />
          <input placeholder="Lec units"  type="number" min={0}
            value={form.unitsLecture}   onChange={e => setForm(f => ({...f, unitsLecture:   e.target.value}))} />
          <input placeholder="Lab units"  type="number" min={0}
            value={form.unitsLab}       onChange={e => setForm(f => ({...f, unitsLab:       e.target.value}))} />

          {error && <p className="error-msg" style={{ gridColumn: 'span 4' }}>{error}</p>}

          <div style={{ gridColumn: 'span 4', display: 'flex', gap: 8 }}>
            <button className="primary" type="submit" disabled={saving}>
              {saving ? 'Saving…' : 'Save'}
            </button>
            <button type="button" onClick={() => { setShowForm(false); setError('') }}>Cancel</button>
          </div>
        </form>
      )}

      {/* ── Search ── */}
      <input
        placeholder="Search by code, title, or program…"
        value={search}
        onChange={e => setSearch(e.target.value)}
        style={{ maxWidth: 340, marginBottom: 16 }}
      />

      {/* ── Table ── */}
      <div className="card" style={{ padding: 0, overflow: 'hidden' }}>
        <table>
          <thead>
            <tr>
              <th>Code</th><th>Title</th><th>Program</th>
              <th>Year</th><th>Sections</th><th>Lec</th><th>Lab</th><th></th>
            </tr>
          </thead>
          <tbody>
            {filtered.length === 0 && (
              <tr>
                <td colSpan={8} style={{ textAlign: 'center', padding: 24, color: '#888' }}>
                  {courses.length === 0 ? 'No courses yet — add one or import from Excel.' : 'No results for that search.'}
                </td>
              </tr>
            )}
            {filtered.map(c => (
              <tr key={c.id}>
                <td style={{ fontWeight: 500 }}>{c.courseCode}</td>
                <td>{c.title}</td>
                <td>{c.program}</td>
                <td style={{ textAlign: 'center' }}>{c.yearLevel}</td>
                <td style={{ textAlign: 'center' }}>{c.blocks}</td>
                <td style={{ textAlign: 'center' }}>{c.unitsLecture}</td>
                <td style={{ textAlign: 'center' }}>{c.unitsLab}</td>
                <td>
                  <button className="danger" onClick={() => handleDelete(c.courseCode, c.program)}>
                    Delete
                  </button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {/* ── Import modal ── */}
      {showImport && (
        <ImportCoursesModal
          onClose={() => setShowImport(false)}
          onImported={() => { load(); setShowImport(false) }}
        />
      )}
    </div>
  )
}