import { useState, useEffect } from 'react'
import { getFaculty, updateFaculty } from '../../services/api'

export function CoordFacultyPage() {
  const [faculty, setFaculty] = useState([])
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)

  const loadAll = async () => {
    try {
      setLoading(true)
      const data = await getFaculty()
      // ensure numeric fields
      const processed = (Array.isArray(data) ? data : (data?.faculty || [])).map(f => ({
        ...f,
        priority_tier: f.priority_tier || 3,
        max_units: f.max_units || 21
      }))
      setFaculty(processed.sort((a, b) => a.name.localeCompare(b.name)))
    } catch (e) {
      console.error(e)
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    loadAll()
  }, [])

  const handleUpdate = async (id, updates) => {
    try {
      setSaving(true)
      await updateFaculty(id, updates)
      setFaculty(prev => prev.map(f => (f.id || f.facultyId) === id ? { ...f, ...updates } : f))
    } catch (e) {
      console.error(e)
      alert("Failed to update faculty")
    } finally {
      setSaving(false)
    }
  }

  return (
    <div className="ap-layout">
      <div className="ap-content ap-fadein">
        <div style={{ marginBottom: 30 }}>
          <h1 className="ap-h1">Faculty Priority & Load</h1>
          <p className="ap-p" style={{ maxWidth: 700 }}>
            Configure priority tiers and maximum teaching loads for the auto-assigner. 
            Faculty with higher priority (Tier 1) will be selected first for classes they specialize in.
          </p>
        </div>

        {loading ? (
          <div style={{ padding: 40, textAlign: 'center', color: "#6b7280" }}>Loading faculty...</div>
        ) : (
          <div className="ap-card" style={{ padding: 20 }}>
            <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 13.5 }}>
              <thead>
                <tr style={{ borderBottom: '1px solid #e5e7eb', textAlign: 'left', color: '#6b7280' }}>
                  <th style={{ padding: '12px 10px', fontWeight: 600 }}>Faculty Name</th>
                  <th style={{ padding: '12px 10px', fontWeight: 600 }}>Department</th>
                  <th style={{ padding: '12px 10px', fontWeight: 600 }}>Priority Tier</th>
                  <th style={{ padding: '12px 10px', fontWeight: 600 }}>Max Load (Units)</th>
                </tr>
              </thead>
              <tbody>
                {faculty.map(f => (
                  <tr key={f.id || f.facultyId} style={{ borderBottom: '1px solid #e5e7eb' }}>
                    <td style={{ padding: '12px 10px', fontWeight: 500 }}>{f.name}</td>
                    <td style={{ padding: '12px 10px', color: '#6b7280' }}>{f.Department || 'N/A'}</td>
                    <td style={{ padding: '12px 10px' }}>
                      <select
                        disabled={saving}
                        value={f.priority_tier || 3}
                        onChange={(e) => handleUpdate(f.id || f.facultyId, { priority_tier: parseInt(e.target.value, 10) })}
                        style={{ padding: '6px 10px', borderRadius: 4, border: '1px solid #e5e7eb', background: '#fff' }}
                      >
                        <option value={1}>Tier 1 (Highest)</option>
                        <option value={2}>Tier 2 (Medium)</option>
                        <option value={3}>Tier 3 (Standard)</option>
                      </select>
                    </td>
                    <td style={{ padding: '12px 10px' }}>
                      <input
                        type="number"
                        disabled={saving}
                        value={f.max_units || 21}
                        onChange={(e) => handleUpdate(f.id || f.facultyId, { max_units: parseFloat(e.target.value) || 21 })}
                        style={{ width: 80, padding: '6px 10px', borderRadius: 4, border: '1px solid #e5e7eb' }}
                        min="0"
                        step="0.5"
                      />
                    </td>
                  </tr>
                ))}
                {faculty.length === 0 && (
                  <tr>
                    <td colSpan={4} style={{ padding: 30, textAlign: 'center', color: '#6b7280' }}>
                      No faculty found.
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  )
}
