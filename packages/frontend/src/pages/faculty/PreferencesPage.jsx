import { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { useAuth } from '../../hooks/useAuth'
import { updatePreferences, getFaculty } from '../../services/api'

const DAYS = ['Monday','Tuesday','Wednesday','Thursday','Friday','Saturday']

export default function PreferencesPage() {
  const { user }  = useAuth()
  const navigate  = useNavigate()

  const [facultyId,        setFacultyId]        = useState(null)
  const [preferredDays,    setPreferredDays]    = useState([])
  const [preferredStart,   setPreferredStart]   = useState(7)
  const [preferredEnd,     setPreferredEnd]     = useState(17)
  const [maxConsecutive,   setMaxConsecutive]   = useState(4)
  const [saving,           setSaving]           = useState(false)
  const [saved,            setSaved]            = useState(false)
  const [loading,          setLoading]          = useState(true)
  const [error,            setError]            = useState('')

  useEffect(() => {
    if (!user) return
    getFaculty().then(list => {
      const match = list.find(f => f.email === user.email || f.id === user.uid)
      if (match) {
        setFacultyId(match.id)
        setPreferredDays(match.preferredDays    || [])
        setPreferredStart(match.preferredTimeStart ?? 7)
        setPreferredEnd(  match.preferredTimeEnd   ?? 17)
        setMaxConsecutive(match.maxConsecutiveHours ?? 4)
      }
    }).finally(() => setLoading(false))
  }, [user])

  function toggleDay(day) {
    setPreferredDays(d => d.includes(day)
      ? d.filter(x => x !== day)
      : [...d, day]
    )
  }

  async function handleSave() {
    if (!facultyId) { setError('Faculty profile not found. Contact the admin.'); return }
    setSaving(true)
    setError('')
    try {
      await updatePreferences(facultyId, {
        preferredDays:      preferredDays,
        preferredTimeStart: Number(preferredStart),
        preferredTimeEnd:   Number(preferredEnd),
        maxConsecutiveHours: Number(maxConsecutive),
      })
      setSaved(true)
      setTimeout(() => setSaved(false), 2500)
    } catch {
      setError('Failed to save. Please try again.')
    } finally {
      setSaving(false)
    }
  }

  if (loading) return (
    <div style={{ minHeight:'100vh', display:'flex', alignItems:'center', justifyContent:'center' }}>
      Loading…
    </div>
  )

  return (
    <div style={{ minHeight:'100vh', background:'#f5f5f5' }}>
      {/* Top bar */}
      <div style={{ background:'#000', color:'#fff', padding:'12px 20px', display:'flex', justifyContent:'space-between', alignItems:'center' }}>
        <div style={{ fontWeight:700, fontSize:16 }}>LOGOS</div>
        <button onClick={() => navigate('/schedule')}
          style={{ background:'transparent', color:'#aaa', border:'none', cursor:'pointer', fontSize:13 }}>
          ← Back to my schedule
        </button>
      </div>

      <div style={{ padding:20, maxWidth:520, margin:'0 auto' }}>
        <p style={{ fontSize:18, fontWeight:700, marginBottom:4 }}>Scheduling preferences</p>
        <p style={{ color:'#888', fontSize:13, marginBottom:24 }}>
          These preferences are used by the CP-SAT solver when generating the next schedule.
          They are soft constraints — the solver will try its best to honor them.
        </p>

        {/* Preferred days */}
        <div className="card" style={{ marginBottom:14 }}>
          <p style={{ fontWeight:600, marginBottom:12 }}>Preferred teaching days</p>
          <div style={{ display:'flex', gap:8, flexWrap:'wrap' }}>
            {DAYS.map(day => (
              <button key={day} type="button" onClick={() => toggleDay(day)}
                style={{
                  padding:'7px 16px', borderRadius:20, fontSize:13,
                  background: preferredDays.includes(day) ? '#000' : '#fff',
                  color:      preferredDays.includes(day) ? '#fff' : '#000',
                  border:'1px solid #000',
                }}>
                {day}
              </button>
            ))}
          </div>
          {preferredDays.length === 0 && (
            <p style={{ color:'#aaa', fontSize:12, marginTop:10 }}>
              No days selected — any day may be assigned.
            </p>
          )}
        </div>

        {/* Time window */}
        <div className="card" style={{ marginBottom:14 }}>
          <p style={{ fontWeight:600, marginBottom:12 }}>Preferred time window</p>
          <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr', gap:14 }}>
            <div>
              <label style={{ fontSize:12, fontWeight:600, display:'block', marginBottom:4 }}>
                Earliest start (hour)
              </label>
              <input type="number" min={6} max={20} step={0.5}
                value={preferredStart}
                onChange={e => setPreferredStart(Number(e.target.value))} />
            </div>
            <div>
              <label style={{ fontSize:12, fontWeight:600, display:'block', marginBottom:4 }}>
                Latest end (hour)
              </label>
              <input type="number" min={7} max={21} step={0.5}
                value={preferredEnd}
                onChange={e => setPreferredEnd(Number(e.target.value))} />
            </div>
          </div>
          <p style={{ color:'#888', fontSize:12, marginTop:10 }}>
            Preferred window: {preferredStart}:00 – {preferredEnd}:00
          </p>
        </div>

        {/* Max consecutive hours */}
        <div className="card" style={{ marginBottom:20 }}>
          <p style={{ fontWeight:600, marginBottom:12 }}>Maximum consecutive teaching hours</p>
          <div style={{ display:'flex', alignItems:'center', gap:16 }}>
            <input type="range" min={1} max={8} step={0.5}
              value={maxConsecutive}
              onChange={e => setMaxConsecutive(Number(e.target.value))}
              style={{ flex:1, accentColor:'#000' }} />
            <span style={{ fontWeight:700, fontSize:18, minWidth:40, textAlign:'center' }}>
              {maxConsecutive}h
            </span>
          </div>
          <p style={{ color:'#888', fontSize:12, marginTop:8 }}>
            The solver will try to avoid scheduling you for more than {maxConsecutive} consecutive hours.
          </p>
        </div>

        {error && <p className="error-msg" style={{ marginBottom:12 }}>{error}</p>}

        <button className="primary" onClick={handleSave} disabled={saving}
          style={{ width:'100%', padding:'10px', fontSize:14 }}>
          {saving ? 'Saving…' : saved ? 'Preferences saved!' : 'Save preferences'}
        </button>

        {saved && (
          <p style={{ color:'#1a6b2c', fontSize:13, textAlign:'center', marginTop:10 }}>
            Saved. Your preferences will be applied on the next schedule generation.
          </p>
        )}
      </div>
    </div>
  )
}
