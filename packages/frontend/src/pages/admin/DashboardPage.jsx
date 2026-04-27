import { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { getFaculty, getCourses, getRooms, getWorkload, listSaved, loadSaved } from '../../services/api'

/* ── Compact horizontal stat card ── */
function StatCard({ label, value, icon, color, bg }) {
  const [hov, setHov] = useState(false)
  return (
    <div
      onMouseEnter={() => setHov(true)}
      onMouseLeave={() => setHov(false)}
      style={{
        background: '#fff', borderRadius: 13, padding: '14px 18px',
        border: '1px solid #E8E4F8', display: 'flex', alignItems: 'center', gap: 14,
        boxShadow: hov ? '0 6px 20px rgba(124,111,205,0.14)' : '0 2px 8px rgba(124,111,205,0.06)',
        transform: hov ? 'translateY(-1px)' : 'none',
        transition: 'all 0.18s ease',
      }}
    >
      <div style={{
        width: 42, height: 42, borderRadius: 11, background: bg,
        display: 'flex', alignItems: 'center', justifyContent: 'center',
        color, flexShrink: 0,
      }}>
        {icon}
      </div>
      <div>
        <div style={{ fontSize: 26, fontWeight: 700, color: '#1a1a2e', lineHeight: 1 }}>{value}</div>
        <div style={{ fontSize: 11.5, color: '#8883B0', marginTop: 3, fontWeight: 500 }}>{label}</div>
      </div>
    </div>
  )
}

/* ── Quick action item ── */
function ActionItem({ label, desc, color, bg, href, icon }) {
  const [hov, setHov] = useState(false)
  const navigate = useNavigate()
  return (
    <div
      onClick={() => navigate(href)}
      onMouseEnter={() => setHov(true)}
      onMouseLeave={() => setHov(false)}
      style={{
        display: 'flex', alignItems: 'center', gap: 11,
        padding: '9px 12px', borderRadius: 10,
        border: `1px solid ${hov ? color + '35' : '#F0EDF9'}`,
        cursor: 'pointer',
        background: hov ? bg : '#fff',
        transition: 'all 0.15s ease',
      }}
    >
      <div style={{
        width: 32, height: 32, borderRadius: 9, background: bg, color,
        display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0,
      }}>
        {icon}
      </div>
      <div style={{ flex: 1, minWidth: 0 }}>
        <div style={{ fontSize: 12.5, fontWeight: 600, color: '#1a1a2e' }}>{label}</div>
        <div style={{ fontSize: 11, color: '#8883B0', marginTop: 1, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{desc}</div>
      </div>
      <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke={hov ? color : '#C0BBDC'} strokeWidth="2.5" style={{ transition: 'stroke 0.13s', flexShrink: 0 }}>
        <line x1="5" y1="12" x2="19" y2="12"/><polyline points="12 5 19 12 12 19"/>
      </svg>
    </div>
  )
}

const QUICK_ACTIONS = [
  {
    label: 'Run Scheduler',
    desc: 'Generate a new schedule automatically',
    color: '#7C6FCD', bg: '#EEEAFB',
    href: '/dashboard/scheduler',
    icon: <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><rect x="3" y="4" width="18" height="18" rx="2"/><line x1="16" y1="2" x2="16" y2="6"/><line x1="8" y1="2" x2="8" y2="6"/><line x1="3" y1="10" x2="21" y2="10"/></svg>,
  },
  {
    label: 'Manage Faculty',
    desc: 'Add, edit, or review faculty members',
    color: '#2563EB', bg: '#EBF0FF',
    href: '/dashboard/faculty',
    icon: <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2"/><circle cx="9" cy="7" r="4"/><path d="M23 21v-2a4 4 0 0 0-3-3.87"/><path d="M16 3.13a4 4 0 0 1 0 7.75"/></svg>,
  },
  {
    label: 'Manage Courses',
    desc: 'Add, filter, or remove course records',
    color: '#059669', bg: '#E6FAF3',
    href: '/dashboard/courses',
    icon: <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M4 19.5A2.5 2.5 0 0 1 6.5 17H20"/><path d="M6.5 2H20v20H6.5A2.5 2.5 0 0 1 4 19.5v-15A2.5 2.5 0 0 1 6.5 2z"/></svg>,
  },
  {
    label: 'Room Settings',
    desc: 'Configure lecture & lab room availability',
    color: '#D97706', bg: '#FEF3CD',
    href: '/dashboard/rooms',
    icon: <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M3 9l9-7 9 7v11a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z"/><polyline points="9 22 9 12 15 12 15 22"/></svg>,
  },
]

export default function DashboardPage() {
  const [stats,          setStats]          = useState({ faculty: 0, courses: 0, rooms: 0 })
  const [overloaded,     setOverloaded]     = useState([])
  const [loading,        setLoading]        = useState(true)
  const [scheduleSource, setScheduleSource] = useState(null)
  const [savedList,      setSavedList]      = useState([])

  useEffect(() => {
    async function load() {
      try {
        const [fac, crs, rms, saved] = await Promise.all([
          getFaculty(), getCourses(), getRooms(), listSaved().catch(() => []),
        ])
        setStats({
          faculty: fac.length,
          courses: crs.length,
          rooms: (rms.lecture?.length || 0) + (rms.lab?.length || 0),
        })
        const names = Array.isArray(saved) ? saved : (saved?.schedules ?? [])
        setSavedList(names)
        if (names.length > 0) {
          const latest = names[names.length - 1]
          await loadSaved(latest)
          setScheduleSource(latest)
        }
        const wl = await getWorkload()
        setOverloaded(wl.workload.filter(f => f.overloaded))
      } catch {}
      finally { setLoading(false) }
    }
    load()
  }, [])

  if (loading) return (
    <div style={{ padding: 32, display: 'flex', alignItems: 'center', gap: 10, color: '#8883B0', fontSize: 13, fontFamily: "'Poppins',sans-serif" }}>
      <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="#A99BE8" strokeWidth="2" style={{ animation: 'spin 1s linear infinite' }}>
        <path d="M21 12a9 9 0 1 1-6.219-8.56"/>
      </svg>
      Loading…
      <style>{`@keyframes spin{to{transform:rotate(360deg)}}`}</style>
    </div>
  )

  const STAT_CARDS = [
    { label: 'Total Faculty',   value: stats.faculty,  color: '#7C6FCD', bg: '#EEEAFB',
      icon: <svg width="19" height="19" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2"/><circle cx="9" cy="7" r="4"/><path d="M23 21v-2a4 4 0 0 0-3-3.87"/><path d="M16 3.13a4 4 0 0 1 0 7.75"/></svg> },
    { label: 'Active Courses',  value: stats.courses,  color: '#2563EB', bg: '#EBF0FF',
      icon: <svg width="19" height="19" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M4 19.5A2.5 2.5 0 0 1 6.5 17H20"/><path d="M6.5 2H20v20H6.5A2.5 2.5 0 0 1 4 19.5v-15A2.5 2.5 0 0 1 6.5 2z"/></svg> },
    { label: 'Available Rooms', value: stats.rooms,    color: '#059669', bg: '#E6FAF3',
      icon: <svg width="19" height="19" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M3 9l9-7 9 7v11a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z"/><polyline points="9 22 9 12 15 12 15 22"/></svg> },
  ]

  return (
    <div style={{ padding: '20px 28px', fontFamily: "'Poppins',sans-serif", display: 'flex', flexDirection: 'column', gap: 16 }}>
      <style>{`@keyframes spin{to{transform:rotate(360deg)}}`}</style>

      {/* Header */}
      <div>
        <h1 style={{ fontSize: 19, fontWeight: 700, color: '#1a1a2e', letterSpacing: '-.3px', margin: 0 }}>Dashboard</h1>
        <p style={{ fontSize: 12, color: '#8883B0', marginTop: 2, marginBottom: 0 }}>Your scheduling overview at a glance.</p>
      </div>

      {/* Stat cards — horizontal, no fake trends */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3,1fr)', gap: 14 }}>
        {STAT_CARDS.map(c => <StatCard key={c.label} {...c} />)}
      </div>

      {/* Bottom row */}
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 14 }}>

        {/* Workload alerts */}
        <div style={{ background: '#fff', borderRadius: 13, border: '1px solid #E8E4F8', boxShadow: '0 2px 8px rgba(124,111,205,0.06)', overflow: 'hidden' }}>
          <div style={{ padding: '12px 16px', borderBottom: '1px solid #F0EDF9', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
            <div>
              <div style={{ fontSize: 13, fontWeight: 700, color: '#1a1a2e' }}>Workload Alerts</div>
              <div style={{ fontSize: 11, color: '#8883B0', marginTop: 1 }}>Faculty exceeding their unit cap</div>
            </div>
            <div style={{ display: 'flex', alignItems: 'center', gap: 6, flexShrink: 0 }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 5, padding: '3px 9px', borderRadius: 99, background: '#F5F4FB', border: '1px solid #E8E4F8' }}>
                <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="#8883B0" strokeWidth="2.5" style={{ flexShrink: 0 }}>
                  <rect x="3" y="4" width="18" height="18" rx="2"/>
                  <line x1="16" y1="2" x2="16" y2="6"/><line x1="8" y1="2" x2="8" y2="6"/>
                  <line x1="3" y1="10" x2="21" y2="10"/>
                </svg>
                <span style={{ fontSize: 10.5, fontWeight: 600, color: '#8883B0', maxWidth: 130, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                  {scheduleSource ?? (savedList.length === 0 ? 'No saved schedules' : 'Current (in memory)')}
                </span>
              </div>
              {overloaded.length > 0 && (
                <span style={{ background: '#FFE8E8', color: '#C0392B', fontSize: 10.5, fontWeight: 700, padding: '3px 9px', borderRadius: 99 }}>
                  {overloaded.length} overloaded
                </span>
              )}
            </div>
          </div>
          <div>
            {overloaded.length === 0 ? (
              <div style={{ padding: '14px 16px', display: 'flex', alignItems: 'center', gap: 10 }}>
                <div style={{ width: 26, height: 26, borderRadius: '50%', background: '#E6FAF3', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                  <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="#059669" strokeWidth="2.5"><polyline points="20 6 9 17 4 12"/></svg>
                </div>
                <span style={{ fontSize: 12.5, color: '#8883B0' }}>All faculty are within their unit limits.</span>
              </div>
            ) : overloaded.map((f, i) => (
              <div key={f.name} style={{
                display: 'flex', alignItems: 'center', justifyContent: 'space-between',
                padding: '9px 16px',
                borderBottom: i < overloaded.length - 1 ? '1px solid #F5F4FB' : 'none',
              }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 9 }}>
                  <div style={{ width: 28, height: 28, borderRadius: '50%', background: '#FFE8E8', color: '#C0392B', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 9.5, fontWeight: 700, flexShrink: 0 }}>
                    {f.name.split(' ').map(n => n[0]).join('').slice(0, 2)}
                  </div>
                  <span style={{ fontSize: 12.5, fontWeight: 500, color: '#1a1a2e' }}>{f.name}</span>
                </div>
                <span style={{ background: '#FFE8E8', color: '#C0392B', fontSize: 11, fontWeight: 700, padding: '2px 9px', borderRadius: 99, flexShrink: 0 }}>
                  {f.assigned} / {f.max_units} units
                </span>
              </div>
            ))}
          </div>
        </div>

        {/* Quick actions */}
        <div style={{ background: '#fff', borderRadius: 13, border: '1px solid #E8E4F8', boxShadow: '0 2px 8px rgba(124,111,205,0.06)', overflow: 'hidden' }}>
          <div style={{ padding: '12px 16px', borderBottom: '1px solid #F0EDF9' }}>
            <div style={{ fontSize: 13, fontWeight: 700, color: '#1a1a2e' }}>Quick Actions</div>
            <div style={{ fontSize: 11, color: '#8883B0', marginTop: 1 }}>Jump to common tasks</div>
          </div>
          <div style={{ padding: '8px 10px', display: 'flex', flexDirection: 'column', gap: 5 }}>
            {QUICK_ACTIONS.map(a => <ActionItem key={a.label} {...a} />)}
          </div>
        </div>

      </div>
    </div>
  )
}