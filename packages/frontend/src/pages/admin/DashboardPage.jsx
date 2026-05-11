import { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { getFaculty, getCourses, getRooms, getWorkload, listSaved, loadSaved } from '../../services/api'
import { useScheduleStore } from '../../store/scheduleStore'

/* ── Shimmer keyframe injected once ── */
const SHIMMER_STYLE = `
  @keyframes spin { to { transform: rotate(360deg) } }
  @keyframes shimmer {
    0%   { background-position: -400px 0 }
    100% { background-position:  400px 0 }
  }
  .skeleton {
    background: linear-gradient(90deg, #F0EDF9 25%, #E4DEFC 50%, #F0EDF9 75%);
    background-size: 800px 100%;
    animation: shimmer 1.4s ease-in-out infinite;
    border-radius: 7px;
  }
  .hover-row {
    cursor: pointer;
    transition: background 0.15s ease;
  }
  .hover-row:hover {
    background: #FAFAFE;
  }
`

/* ── Error helpers ── */
async function parseError(err, action) {
  let title   = `Failed to ${action}`
  let message = 'An unexpected error occurred. Please try again.'
  let code    = null

  if (err instanceof Response || err?.status) {
    code = err.status ?? null
    const causeMap = {
      400: `Failed to ${action} — invalid data sent`,
      401: `Failed to ${action} — not authenticated`,
      403: `Failed to ${action} — access denied`,
      404: `Failed to ${action} — endpoint not found`,
      408: `Failed to ${action} — request timed out`,
      500: `Failed to ${action} — backend error`,
      502: `Failed to ${action} — bad gateway`,
      503: `Failed to ${action} — server unavailable`,
      504: `Failed to ${action} — gateway timeout`,
    }
    title = causeMap[code] ?? `Failed to ${action} — server error (${code})`
    const detailMap = {
      400: 'The request was rejected as invalid. Check that all inputs are correct.',
      401: 'Your session may have expired. Please refresh the page and log in again.',
      403: 'You don\'t have the required permissions to view this data.',
      404: 'The server endpoint could not be found. The API may have changed.',
      408: 'The server took too long to respond. Check your connection and retry.',
      500: 'An internal server error occurred on the backend. Try again shortly.',
      502: 'The server returned an invalid response. The service may be restarting.',
      503: 'The server is temporarily unavailable. Try again in a few moments.',
      504: 'The gateway did not receive a timely response from the backend.',
    }
    message = detailMap[code] ?? `The server responded with an unexpected status (${code}).`
    try {
      const body = await (err.json?.() ?? Promise.resolve(null))
      if (body?.detail)                                       message = body.detail
      else if (body?.message)                                 message = body.message
      else if (typeof body === 'string' && body.length < 200) message = body
    } catch { /* ignore */ }
  } else if (err instanceof TypeError && err.message.includes('fetch')) {
    title   = `Failed to ${action} — no connection`
    message = 'Could not reach the server. Check your internet connection and try again.'
  } else if (err instanceof Error && err.message) {
    title   = `Failed to ${action} — unexpected error`
    message = err.message
  }

  return { title, message, code }
}

function ErrorBanner({ error, onDismiss, onRetry }) {
  if (!error) return null
  return (
    <div style={{
      display: 'flex', alignItems: 'flex-start', gap: 10, marginBottom: 14,
      padding: '11px 14px', borderRadius: 10,
      background: '#FFF5F5', border: '1px solid #FECACA',
    }}>
      <div style={{
        width: 28, height: 28, borderRadius: 8, background: '#FEE2E2',
        display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0, marginTop: 1,
      }}>
        <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="#DC2626" strokeWidth="2.2">
          <circle cx="12" cy="12" r="10"/>
          <line x1="12" y1="8" x2="12" y2="12"/><line x1="12" y1="16" x2="12.01" y2="16"/>
        </svg>
      </div>
      <div style={{ flex: 1, minWidth: 0 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 7, marginBottom: 3 }}>
          <span style={{ fontSize: 12.5, fontWeight: 700, color: '#B91C1C' }}>{error.title}</span>
          {error.code && (
            <span style={{
              fontSize: 10, fontWeight: 700, padding: '1px 6px', borderRadius: 20,
              background: '#FEE2E2', color: '#DC2626', border: '1px solid #FECACA',
            }}>
              {error.code}
            </span>
          )}
        </div>
        <div style={{ fontSize: 12, color: '#C0392B', lineHeight: 1.5 }}>{error.message}</div>
      </div>
      <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexShrink: 0, marginTop: 2 }}>
        {onRetry && (
          <button onClick={onRetry} style={{
            background: 'none', border: 'none', cursor: 'pointer',
            color: '#B91C1C', fontWeight: 700, fontSize: 12,
            fontFamily: "'Poppins',sans-serif", padding: '2px 4px',
          }}>Retry</button>
        )}
        {onDismiss && (
          <button onClick={onDismiss} style={{
            background: 'none', border: 'none', cursor: 'pointer',
            color: '#EF9999', padding: 2, lineHeight: 0, borderRadius: 4,
          }}
            onMouseEnter={e => e.currentTarget.style.color = '#DC2626'}
            onMouseLeave={e => e.currentTarget.style.color = '#EF9999'}
            title="Dismiss"
          >
            <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
              <line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/>
            </svg>
          </button>
        )}
      </div>
    </div>
  )
}

/* ── Skeleton block helper ── */
function Skel({ w = '100%', h = 14, r = 7, style = {} }) {
  return (
    <div className="skeleton" style={{ width: w, height: h, borderRadius: r, flexShrink: 0, ...style }} />
  )
}

/* ── Stat card — real or skeleton ── */
function StatCard({ label, value, icon, color, bg, loading }) {
  const [hov, setHov] = useState(false)
  return (
    <div
      onMouseEnter={() => setHov(true)}
      onMouseLeave={() => setHov(false)}
      style={{
        background: '#fff', borderRadius: 13, padding: '14px 18px',
        border: '1px solid #E8E4F8', display: 'flex', alignItems: 'center', gap: 14,
        boxShadow: hov && !loading
          ? '0 6px 20px rgba(124,111,205,0.14)'
          : '0 2px 8px rgba(124,111,205,0.06)',
        transform: hov && !loading ? 'translateY(-1px)' : 'none',
        transition: 'all 0.18s ease',
      }}
    >
      {/* Icon area */}
      <div style={{
        width: 42, height: 42, borderRadius: 11, background: loading ? '#F0EDF9' : bg,
        display: 'flex', alignItems: 'center', justifyContent: 'center',
        color, flexShrink: 0,
        ...(loading ? {} : {}),
      }}>
        {loading
          ? <Skel w={42} h={42} r={11} />
          : <div style={{ color }}>{icon}</div>}
      </div>

      {/* Value + label */}
      <div style={{ flex: 1 }}>
        {loading
          ? <>
              <Skel w={48} h={26} r={6} style={{ marginBottom: 6 }} />
              <Skel w={80} h={11} r={5} />
            </>
          : <>
              <div style={{ fontSize: 26, fontWeight: 700, color: '#1a1a2e', lineHeight: 1 }}>{value}</div>
              <div style={{ fontSize: 11.5, color: '#8883B0', marginTop: 3, fontWeight: 500 }}>{label}</div>
            </>
        }
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

/* ── Workload row skeleton ── */
function WorkloadSkel() {
  return (
    <>
      {[1, 2, 3].map(i => (
        <div key={i} style={{
          display: 'flex', alignItems: 'center', justifyContent: 'space-between',
          padding: '10px 16px',
          borderBottom: i < 3 ? '1px solid #F5F4FB' : 'none',
        }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 9 }}>
            <Skel w={28} h={28} r={99} />
            <div>
              <Skel w={110} h={12} r={5} style={{ marginBottom: 5 }} />
              <Skel w={70} h={9} r={4} />
            </div>
          </div>
          <Skel w={72} h={22} r={99} />
        </div>
      ))}
    </>
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
  const { scheduleName, setName, clearSchedule } = useScheduleStore()
  const navigate = useNavigate()

  const [stats,          setStats]          = useState(null)
  const [overloaded,     setOverloaded]     = useState(null)
  const [scheduleSource, setScheduleSource] = useState(null)
  const [savedList,      setSavedList]      = useState([])
  const [facultyList,    setFacultyList]    = useState([])
  const [workloadLoading, setWorkloadLoading] = useState(true)
  const [error,          setError]          = useState(null)

  useEffect(() => {
    let cancelled = false

    async function load() {
      try {
        // Stats and saved list — load together
        const [fac, crs, rms, saved] = await Promise.all([
          getFaculty(), getCourses(), getRooms(), listSaved().catch(() => []),
        ])
        if (cancelled) return

        setStats({
          faculty: fac.length,
          courses: crs.length,
          rooms: (rms.lecture?.length || 0) + (rms.lab?.length || 0),
        })

        // Save full faculty list to use for matching IDs later
        setFacultyList(fac)

        const names = Array.isArray(saved) ? saved : (saved?.schedules ?? [])
        setSavedList(names)

        // Workload — separate so it resolves independently
        const wl = await getWorkload()
        if (!cancelled) setOverloaded(wl.workload.filter(f => f.overloaded))
      } catch (err) {
        // Surface a real error message instead of silently zeroing stats
        if (!cancelled) {
          const parsed = await parseError(err, 'load dashboard data')
          setError(parsed)
          setStats(prev => prev ?? { faculty: 0, courses: 0, rooms: 0 })
          setOverloaded(prev => prev ?? [])
        }
      } finally {
        if (!cancelled) setWorkloadLoading(false)
      }
    }

    load()
    return () => { cancelled = true }
  }, [])

  const statsLoading = stats === null
  const workloadReady = overloaded !== null

  const STAT_CARDS = [
    { label: 'Total Faculty',   value: stats?.faculty,  color: '#7C6FCD', bg: '#EEEAFB',
      icon: <svg width="19" height="19" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2"/><circle cx="9" cy="7" r="4"/><path d="M23 21v-2a4 4 0 0 0-3-3.87"/><path d="M16 3.13a4 4 0 0 1 0 7.75"/></svg> },
    { label: 'Active Courses',  value: stats?.courses,  color: '#2563EB', bg: '#EBF0FF',
      icon: <svg width="19" height="19" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M4 19.5A2.5 2.5 0 0 1 6.5 17H20"/><path d="M6.5 2H20v20H6.5A2.5 2.5 0 0 1 4 19.5v-15A2.5 2.5 0 0 1 6.5 2z"/></svg> },
    { label: 'Available Rooms', value: stats?.rooms,    color: '#059669', bg: '#E6FAF3',
      icon: <svg width="19" height="19" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M3 9l9-7 9 7v11a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z"/><polyline points="9 22 9 12 15 12 15 22"/></svg> },
  ]

  return (
    <div style={{ padding: '20px 28px', fontFamily: "'Poppins',sans-serif", display: 'flex', flexDirection: 'column', gap: 16 }}>
      <style>{SHIMMER_STYLE}</style>

      {error && (
        <ErrorBanner error={error} onDismiss={() => setError(null)} onRetry={() => { setError(null); window.location.reload() }} />
      )}

      {/* Stat cards */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3,1fr)', gap: 14 }}>
        {STAT_CARDS.map(c => (
          <StatCard key={c.label} {...c} loading={statsLoading} />
        ))}
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
                {workloadLoading ? (
                  <Skel w={90} h={10} r={5} />
                ) : savedList.length > 0 ? (
                  <select
                    value={scheduleSource || '__current__'}
                    onChange={async (e) => {
                      const newSchedule = e.target.value;
                      const isPinned = newSchedule !== '__current__';
                      setScheduleSource(isPinned ? newSchedule : null);
                      setWorkloadLoading(true);
                      try {
                        if (isPinned) {
                          await loadSaved(newSchedule);
                          // Sync global store so Analytics and ScheduleView
                          // know what the backend currently has in memory
                          setName(newSchedule);
                        } else {
                          // Switching back to current — clear the pinned name
                          clearSchedule();
                        }
                        const wl = await getWorkload();
                        setOverloaded(wl.workload.filter(f => f.overloaded));
                      } catch (err) {
                        const parsed = await parseError(err, `load schedule "${newSchedule}"`)
                        setError(parsed)
                      } finally {
                        setWorkloadLoading(false);
                      }
                    }}
                    style={{
                      background: 'transparent',
                      border: 'none',
                      outline: 'none',
                      fontSize: 10.5,
                      fontWeight: 600,
                      color: '#8883B0',
                      cursor: 'pointer',
                      maxWidth: 130,
                      fontFamily: 'inherit',
                      padding: 0
                    }}
                  >
                    <option value="__current__">
                      {scheduleName ? `Current (${scheduleName})` : 'Current (in memory)'}
                    </option>
                    {savedList.map((name) => (
                      <option key={name} value={name}>{name}</option>
                    ))}
                  </select>
                ) : (
                  <span style={{ fontSize: 10.5, fontWeight: 600, color: '#8883B0', maxWidth: 130, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                    No saved schedules
                  </span>
                )}
              </div>
              {workloadReady && overloaded.length > 0 && (
                <span style={{ background: overloaded.some(f => !f.parttime_exceeded) ? '#FFE8E8' : '#FEF3CD', color: overloaded.some(f => !f.parttime_exceeded) ? '#C0392B' : '#D97706', fontSize: 10.5, fontWeight: 700, padding: '3px 9px', borderRadius: 99 }}>
                  {overloaded.length} over cap
                </span>
              )}
            </div>
          </div>

          <div>
            {/* While loading — show 3 skeleton rows */}
            {!workloadReady && <WorkloadSkel />}

            {/* Loaded, no issues */}
            {workloadReady && overloaded.length === 0 && (
              <div style={{ padding: '14px 16px', display: 'flex', alignItems: 'center', gap: 10 }}>
                <div style={{ width: 26, height: 26, borderRadius: '50%', background: '#E6FAF3', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                  <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="#059669" strokeWidth="2.5"><polyline points="20 6 9 17 4 12"/></svg>
                </div>
                <span style={{ fontSize: 12.5, color: '#8883B0' }}>All faculty are within their unit limits.</span>
              </div>
            )}

            {/* Loaded, has overloaded faculty */}
            {workloadReady && overloaded.map((f, i) => {
              const isAmber = f.parttime_exceeded
              return (
                <div 
                  key={f.name} 
                  className="hover-row"
                  onClick={() => {
                    // Find the actual faculty ID using the name
                    const targetId = f.id || facultyList.find(fac => fac.name === f.name)?.id;
                    if (targetId) {
                      navigate(`/dashboard/faculty/${targetId}`);
                    } else {
                      navigate('/dashboard/faculty'); // Fallback just in case
                    }
                  }}
                  style={{
                    display: 'flex', alignItems: 'center', justifyContent: 'space-between',
                    padding: '9px 16px',
                    borderBottom: i < overloaded.length - 1 ? '1px solid #F5F4FB' : 'none',
                  }}
                >
                  <div style={{ display: 'flex', alignItems: 'center', gap: 9, minWidth: 0 }}>
                    <div style={{ width: 28, height: 28, borderRadius: '50%', background: isAmber ? '#FEF3CD' : '#FFE8E8', color: isAmber ? '#D97706' : '#C0392B', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 9.5, fontWeight: 700, flexShrink: 0 }}>
                      {f.name.split(' ').map(n => n[0]).join('').slice(0, 2)}
                    </div>
                    <div style={{ minWidth: 0 }}>
                      <span style={{ fontSize: 12.5, fontWeight: 500, color: '#1a1a2e', display: 'block', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{f.name}</span>
                      {f.tier_label && (
                        <span style={{ fontSize: 10, color: '#B0ABCC', display: 'block', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{f.tier_label}</span>
                      )}
                    </div>
                  </div>
                  <span style={{ background: isAmber ? '#FEF3CD' : '#FFE8E8', color: isAmber ? '#D97706' : '#C0392B', fontSize: 11, fontWeight: 700, padding: '2px 9px', borderRadius: 99, flexShrink: 0, marginLeft: 8 }}>
                    {f.assigned} / {f.max_units} units
                  </span>
                </div>
              )
            })}
          </div>
        </div>

        {/* Quick actions — always visible, no loading state needed */}
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