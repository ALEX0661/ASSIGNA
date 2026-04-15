import { useEffect, useState, useMemo } from 'react'
import { useNavigate } from 'react-router-dom'
import { useAuth } from '../../hooks/useAuth'
import { listSaved, loadSaved, getFaculty } from '../../services/api'
import { signOut } from 'firebase/auth'
import { auth } from '../../services/firebase'

const DAYS = ['Monday','Tuesday','Wednesday','Thursday','Friday','Saturday']

export default function FacultySchedulePage() {
  const { user } = useAuth()
  const navigate  = useNavigate()

  const [events,      setEvents]      = useState([])
  const [facultyName, setFacultyName] = useState('')   // the name stored in schedule events
  const [activeDay,   setActiveDay]   = useState('Monday')
  const [loading,     setLoading]     = useState(true)
  const [error,       setError]       = useState('')

  useEffect(() => {
    if (!user) return

    async function load() {
      try {
        // 1. Resolve the faculty's canonical name from their Firestore profile.
        //    The schedule stores faculty by name, not by email or UID, so we need
        //    this to filter correctly. Fallback chain: profile name → displayName → email.
        let resolvedName = user.displayName || user.email || ''
        try {
          const list = await getFaculty()   // returns [own record] for faculty role
          if (list.length > 0 && list[0].name) {
            resolvedName = list[0].name
          }
        } catch {
          // Non-fatal — fall back to displayName/email
        }
        setFacultyName(resolvedName)

        // 2. Load the most recently saved schedule
        const names = await listSaved()
        if (names.length === 0) { setLoading(false); return }

        const latest = names[names.length - 1]
        const data   = await loadSaved(latest)
        setEvents(data.schedule || [])
      } catch {
        setError('Could not load schedule.')
      } finally {
        setLoading(false)
      }
    }

    load()
  }, [user])

  // Filter to this faculty member's sessions only.
  // Match on name (primary), email, and displayName as fallbacks so
  // old schedules generated before the name was normalised still work.
  const myEvents = useMemo(() => {
    if (!facultyName && !user?.email) return []
    return events.filter(e =>
      (facultyName  && e.faculty === facultyName)  ||
      (user?.email  && e.faculty === user.email)   ||
      (user?.displayName && e.faculty === user.displayName)
    )
  }, [events, facultyName, user])

  const dayEvents = useMemo(() =>
    myEvents
      .filter(e => e.day === activeDay)
      .sort((a, b) => a.period.localeCompare(b.period)),
    [myEvents, activeDay]
  )

  async function handleLogout() {
    await signOut(auth)
    navigate('/login')
  }

  return (
    <div style={{ minHeight: '100vh', background: '#f5f5f5' }}>
      {/* Top bar */}
      <div style={{ background: '#000', color: '#fff', padding: '12px 20px', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <div style={{ fontWeight: 700, fontSize: 16 }}>LOGOS</div>
        <div style={{ display: 'flex', gap: 16, alignItems: 'center', fontSize: 13 }}>
          <span style={{ color: '#aaa' }}>{user?.email}</span>
          <button
            onClick={() => navigate('/preferences')}
            style={{ background: 'transparent', color: '#fff', border: '1px solid #555', fontSize: 12 }}
          >
            Preferences
          </button>
          <button
            onClick={handleLogout}
            style={{ background: 'transparent', color: '#aaa', border: 'none', cursor: 'pointer', fontSize: 12 }}
          >
            Log out
          </button>
        </div>
      </div>

      <div style={{ padding: 20, maxWidth: 900, margin: '0 auto' }}>
        <p style={{ fontSize: 18, fontWeight: 700, marginBottom: 4 }}>My schedule</p>
        <p style={{ color: '#888', fontSize: 13, marginBottom: 20 }}>
          {myEvents.length} sessions assigned to you this semester.
        </p>

        {error && <p style={{ color: '#c00', fontSize: 13, marginBottom: 12 }}>{error}</p>}
        {loading && <p style={{ color: '#888' }}>Loading schedule…</p>}

        {!loading && myEvents.length === 0 && (
          <div className="card" style={{ color: '#888', fontSize: 13 }}>
            No sessions assigned yet. Check back after the admin generates and saves a schedule.
          </div>
        )}

        {!loading && myEvents.length > 0 && (
          <>
            {/* Day tabs — only show days that have sessions */}
            <div style={{ display: 'flex', gap: 6, marginBottom: 16, flexWrap: 'wrap' }}>
              {DAYS.map(day => {
                const count = myEvents.filter(e => e.day === day).length
                if (count === 0) return null
                return (
                  <button
                    key={day}
                    onClick={() => setActiveDay(day)}
                    style={{
                      padding: '6px 14px', borderRadius: 20, fontSize: 13,
                      background: activeDay === day ? '#000' : '#fff',
                      color:      activeDay === day ? '#fff' : '#000',
                      border: '1px solid #000',
                    }}
                  >
                    {day} ({count})
                  </button>
                )
              })}
            </div>

            {dayEvents.length === 0 && (
              <div className="card" style={{ color: '#888', fontSize: 13 }}>
                No sessions on {activeDay}.
              </div>
            )}

            <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
              {dayEvents.map((e, i) => (
                <div
                  key={i}
                  className="card"
                  style={{ borderLeft: '4px solid #000', padding: '14px 16px' }}
                >
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
                    <div>
                      <p style={{ fontWeight: 700, fontSize: 15, marginBottom: 2 }}>
                        {e.courseCode} — {e.title}
                      </p>
                      <p style={{ color: '#555', fontSize: 13 }}>
                        {e.session} &nbsp;·&nbsp; Block {e.block} &nbsp;·&nbsp; {e.program}
                      </p>
                    </div>
                    <span className="badge badge-gray">{e.room}</span>
                  </div>
                  <p style={{ marginTop: 8, fontSize: 13, fontWeight: 500 }}>{e.period}</p>
                </div>
              ))}
            </div>

            {/* Weekly summary */}
            <div className="card" style={{ marginTop: 20 }}>
              <p style={{ fontWeight: 600, marginBottom: 10 }}>Weekly summary</p>
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 12 }}>
                <div style={{ textAlign: 'center' }}>
                  <div style={{ fontSize: 22, fontWeight: 700 }}>{myEvents.length}</div>
                  <div style={{ fontSize: 12, color: '#888' }}>Total sessions</div>
                </div>
                <div style={{ textAlign: 'center' }}>
                  <div style={{ fontSize: 22, fontWeight: 700 }}>
                    {[...new Set(myEvents.map(e => e.day))].length}
                  </div>
                  <div style={{ fontSize: 12, color: '#888' }}>Teaching days</div>
                </div>
                <div style={{ textAlign: 'center' }}>
                  <div style={{ fontSize: 22, fontWeight: 700 }}>
                    {[...new Set(myEvents.map(e => e.room))].length}
                  </div>
                  <div style={{ fontSize: 12, color: '#888' }}>Rooms</div>
                </div>
              </div>
            </div>
          </>
        )}
      </div>
    </div>
  )
}