import { useEffect, useState } from 'react'
import { getAssignmentQuality, getWorkload } from '../../services/api'

function StatCard({ label, value, sub }) {
  return (
    <div className="card" style={{ textAlign:'center' }}>
      <div style={{ fontSize:28, fontWeight:700 }}>{value ?? '—'}</div>
      <div style={{ fontWeight:600, fontSize:13, marginTop:2 }}>{label}</div>
      {sub && <div style={{ color:'#888', fontSize:12, marginTop:2 }}>{sub}</div>}
    </div>
  )
}

function Bar({ label, value, max, color = '#000' }) {
  const pct = max > 0 ? Math.min((value / max) * 100, 100) : 0
  return (
    <div style={{ marginBottom:10 }}>
      <div style={{ display:'flex', justifyContent:'space-between', marginBottom:3, fontSize:13 }}>
        <span style={{ fontWeight:500 }}>{label}</span>
        <span style={{ color:'#666' }}>{value} / {max}</span>
      </div>
      <div style={{ height:10, background:'#eee', borderRadius:5, overflow:'hidden' }}>
        <div style={{ height:'100%', width:`${pct}%`, background: pct > 100 ? '#a00' : color, borderRadius:5, transition:'width 0.3s' }} />
      </div>
    </div>
  )
}

export default function AnalyticsPage() {
  const [quality,  setQuality]  = useState(null)
  const [workload, setWorkload] = useState(null)
  const [loading,  setLoading]  = useState(true)

  useEffect(() => {
    Promise.all([getAssignmentQuality(), getWorkload()])
      .then(([q, w]) => { setQuality(q); setWorkload(w) })
      .finally(() => setLoading(false))
  }, [])

  if (loading) return <div className="page">Loading…</div>

  if (!quality || quality.totalSessions === 0) {
    return (
      <div className="page">
        <p className="page-title">Analytics</p>
        <div className="card" style={{ color:'#888', fontSize:13 }}>
          No schedule in memory. Generate or load a schedule first.
        </div>
      </div>
    )
  }

  return (
    <div className="page">
      <p className="page-title">Analytics</p>

      {/* KPI row */}
      <div style={{ display:'grid', gridTemplateColumns:'repeat(4, 1fr)', gap:14, marginBottom:24 }}>
        <StatCard label="Total sessions"    value={quality.totalSessions} />
        <StatCard label="Auto-assigned"     value={`${quality.autoAssignPct}%`} sub={`${quality.autoAssigned} sessions`} />
        <StatCard label="Avg assignment score" value={quality.avgScore ?? '—'} sub="target ≥ 0.70" />
        <StatCard label="TBA sessions"      value={quality.tbaSessions} sub="need manual assignment" />
      </div>

      {/* Preference compliance */}
      <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr', gap:14, marginBottom:24 }}>
        <div className="card">
          <p style={{ fontWeight:600, marginBottom:12 }}>Time window compliance</p>
          <div style={{ fontSize:32, fontWeight:700, marginBottom:4 }}>
            {quality.pctInWindow !== null ? `${quality.pctInWindow}%` : '—'}
          </div>
          <p style={{ color:'#888', fontSize:12 }}>
            Sessions placed within each faculty's preferred time window.
          </p>
        </div>
        <div className="card">
          <p style={{ fontWeight:600, marginBottom:12 }}>Day preference compliance</p>
          <div style={{ fontSize:32, fontWeight:700, marginBottom:4 }}>
            {quality.pctOnPreferredDays !== null ? `${quality.pctOnPreferredDays}%` : '—'}
          </div>
          <p style={{ color:'#888', fontSize:12 }}>
            Sessions placed on each faculty's preferred teaching days.
          </p>
        </div>
      </div>

      {/* Per-faculty assignment quality */}
      <div className="card" style={{ marginBottom:24 }}>
        <p style={{ fontWeight:600, marginBottom:12 }}>Assignment quality per faculty</p>
        {quality.perFaculty.length === 0
          ? <p style={{ color:'#888', fontSize:13 }}>No faculty assigned.</p>
          : quality.perFaculty
              .sort((a,b) => (a.avgScore ?? 0) - (b.avgScore ?? 0))
              .map(f => (
                <div key={f.name} style={{ display:'flex', justifyContent:'space-between', alignItems:'center', padding:'7px 0', borderBottom:'1px solid #eee', fontSize:13 }}>
                  <span style={{ fontWeight:500 }}>{f.name}</span>
                  <div style={{ display:'flex', gap:12, alignItems:'center' }}>
                    <span style={{ color:'#666' }}>{f.sessions} sessions</span>
                    {f.avgScore !== null && (
                      <span className={`badge ${f.avgScore >= 0.70 ? 'badge-green' : f.avgScore >= 0.40 ? 'badge-amber' : 'badge-red'}`}>
                        {f.avgScore} score
                      </span>
                    )}
                  </div>
                </div>
              ))
        }
      </div>

      {/* Workload bars */}
      {workload && (
        <div className="card">
          <p style={{ fontWeight:600, marginBottom:16 }}>Faculty workload</p>
          {workload.workload.length === 0
            ? <p style={{ color:'#888', fontSize:13 }}>No workload data.</p>
            : workload.workload
                .sort((a,b) => b.assigned - a.assigned)
                .map(f => (
                  <Bar
                    key={f.name}
                    label={f.name}
                    value={f.assigned}
                    max={f.max_units}
                    color={f.overloaded ? '#a00' : '#000'}
                  />
                ))
          }
        </div>
      )}
    </div>
  )
}
