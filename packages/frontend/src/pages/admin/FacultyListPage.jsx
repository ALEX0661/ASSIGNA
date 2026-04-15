import { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { getFaculty, deleteFaculty } from '../../services/api'

export default function FacultyListPage() {
  const [faculty,  setFaculty]  = useState([])
  const [search,   setSearch]   = useState('')
  const [loading,  setLoading]  = useState(true)
  const navigate = useNavigate()

  async function load() {
    setLoading(true)
    try { setFaculty(await getFaculty()) } finally { setLoading(false) }
  }
  useEffect(() => { load() }, [])

  async function handleDelete(id, name) {
    if (!confirm(`Delete ${name}?`)) return
    await deleteFaculty(id)
    load()
  }

  const filtered = faculty.filter(f =>
    f.name?.toLowerCase().includes(search.toLowerCase())
  )

  return (
    <div className="page">
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 20 }}>
        <p className="page-title" style={{ margin: 0 }}>Faculty</p>
        <button className="primary" onClick={() => navigate('/dashboard/faculty/new')}>+ Add faculty</button>
      </div>

      <input placeholder="Search by name…" value={search}
        onChange={e => setSearch(e.target.value)}
        style={{ maxWidth: 300, marginBottom: 16 }} />

      {loading ? <p>Loading…</p> : (
        <div className="card" style={{ padding: 0, overflow: 'hidden' }}>
          <table>
            <thead>
              <tr>
                <th>Name</th>
                <th>Rank</th>
                <th>Status</th>
                <th>Units</th>
                <th>Specializations</th>
                <th></th>
              </tr>
            </thead>
            <tbody>
              {filtered.length === 0 && (
                <tr><td colSpan={6} style={{ color: '#888', textAlign: 'center', padding: 20 }}>No faculty found.</td></tr>
              )}
              {filtered.map(f => (
                <tr key={f.id}>
                  <td style={{ fontWeight: 500 }}>{f.name}</td>
                  <td>{f.AcademicRank || '—'}</td>
                  <td>
                    <span className={`badge ${f.status === 'full-time' ? 'badge-green' : 'badge-gray'}`}>
                      {f.status}
                    </span>
                  </td>
                  <td>
                    <span className={f.units > f.max_units ? 'badge badge-red' : 'badge badge-gray'}>
                      {f.units ?? 0} / {f.max_units ?? 21}
                    </span>
                  </td>
                  <td style={{ maxWidth: 200, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                    {(f.specializations || []).join(', ') || '—'}
                  </td>
                  <td style={{ display: 'flex', gap: 8 }}>
                    <button onClick={() => navigate(`/dashboard/faculty/${f.id}`)}>Edit</button>
                    <button className="danger" onClick={() => handleDelete(f.id, f.name)}>Delete</button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  )
}
