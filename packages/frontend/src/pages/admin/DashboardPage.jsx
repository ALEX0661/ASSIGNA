import { useEffect, useState } from 'react'
import { getFaculty, getCourses, getRooms, getWorkload } from '../../services/api'

export default function DashboardPage() {
  const [stats,   setStats]   = useState({ faculty: 0, courses: 0, rooms: 0 })
  const [overloaded, setOverloaded] = useState([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    async function load() {
      try {
        const [fac, crs, rms, wl] = await Promise.all([
          getFaculty(), getCourses(), getRooms(), getWorkload(),
        ])
        const lecture = rms.lecture?.length || 0
        const lab     = rms.lab?.length     || 0
        setStats({ faculty: fac.length, courses: crs.length, rooms: lecture + lab })
        setOverloaded(wl.workload.filter(f => f.overloaded))
      } catch { /* api may not be running yet */ }
      finally { setLoading(false) }
    }
    load()
  }, [])

  if (loading) return <div className="page">Loading…</div>

  return (
    <div className="page">
      <p className="page-title">Dashboard</p>

      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 16, marginBottom: 32 }}>
        {[
          { label: 'Faculty',  value: stats.faculty  },
          { label: 'Courses',  value: stats.courses  },
          { label: 'Rooms',    value: stats.rooms    },
        ].map(({ label, value }) => (
          <div className="card" key={label} style={{ textAlign: 'center' }}>
            <div style={{ fontSize: 36, fontWeight: 700 }}>{value}</div>
            <div style={{ color: '#666', fontSize: 13 }}>{label}</div>
          </div>
        ))}
      </div>

      {overloaded.length > 0 && (
        <div className="card">
          <p style={{ fontWeight: 600, marginBottom: 12, color: '#c00' }}>
            Overloaded faculty ({overloaded.length})
          </p>
          {overloaded.map(f => (
            <div key={f.name} style={{ display: 'flex', justifyContent: 'space-between', padding: '6px 0', borderBottom: '1px solid #eee', fontSize: 13 }}>
              <span>{f.name}</span>
              <span className="badge badge-red">{f.assigned} / {f.max_units} units</span>
            </div>
          ))}
        </div>
      )}

      {overloaded.length === 0 && !loading && (
        <div className="card" style={{ color: '#666', fontSize: 13 }}>
          No overloaded faculty detected in the current schedule.
        </div>
      )}
    </div>
  )
}
