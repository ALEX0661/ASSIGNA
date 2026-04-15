import { useEffect, useState } from 'react'
import { getDays, saveDays, getTime, saveTime } from '../../services/api'

const ALL_DAYS = ['Monday','Tuesday','Wednesday','Thursday','Friday','Saturday','Sunday']

export default function SettingsPage() {
  const [days,      setDays]      = useState([])
  const [startTime, setStartTime] = useState(7)
  const [endTime,   setEndTime]   = useState(21)
  const [saving,    setSaving]    = useState(false)
  const [saved,     setSaved]     = useState(false)

  useEffect(() => {
    getDays().then(r => setDays(r.days || []))
    getTime().then(r => { setStartTime(r.start_time || 7); setEndTime(r.end_time || 21) })
  }, [])

  function toggleDay(day) {
    setDays(d => d.includes(day) ? d.filter(x => x !== day) : [...d, day])
  }

  async function handleSave() {
    setSaving(true)
    await saveDays({ days })
    await saveTime({ start_time: Number(startTime), end_time: Number(endTime) })
    setSaving(false)
    setSaved(true)
    setTimeout(() => setSaved(false), 2000)
  }

  const slotsPerDay = Math.round((endTime - startTime) / 0.5)

  return (
    <div className="page" style={{ maxWidth: 540 }}>
      <p className="page-title">Scheduling settings</p>
      <p style={{ color: '#666', fontSize: 13, marginBottom: 24 }}>
        Changes take effect on the next solve run.
      </p>

      <div className="card" style={{ marginBottom: 16 }}>
        <p style={{ fontWeight: 600, marginBottom: 12 }}>Active teaching days</p>
        <p style={{ color: '#888', fontSize: 12, marginBottom: 12 }}>
          Day order matters — it determines the solver's day index mapping.
        </p>
        <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
          {ALL_DAYS.map(day => (
            <button key={day} type="button" onClick={() => toggleDay(day)}
              style={{
                padding: '6px 14px', fontSize: 13, borderRadius: 20,
                background: days.includes(day) ? '#000' : '#fff',
                color:      days.includes(day) ? '#fff' : '#000',
                border: '1px solid #000',
              }}>
              {day.slice(0,3)}
            </button>
          ))}
        </div>
        {days.length > 0 && (
          <p style={{ marginTop: 12, fontSize: 12, color: '#888' }}>
            Active: {days.join(' → ')}
          </p>
        )}
      </div>

      <div className="card" style={{ marginBottom: 24 }}>
        <p style={{ fontWeight: 600, marginBottom: 12 }}>Time window</p>
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16, marginBottom: 12 }}>
          <div>
            <label style={{ fontSize: 12, fontWeight: 600, display: 'block', marginBottom: 4 }}>
              Start time (hour)
            </label>
            <input type="number" min={5} max={12} value={startTime}
              onChange={e => setStartTime(Number(e.target.value))} />
          </div>
          <div>
            <label style={{ fontSize: 12, fontWeight: 600, display: 'block', marginBottom: 4 }}>
              End time (hour)
            </label>
            <input type="number" min={14} max={22} value={endTime}
              onChange={e => setEndTime(Number(e.target.value))} />
          </div>
        </div>
        <p style={{ fontSize: 12, color: '#888' }}>
          Window: {startTime}:00 – {endTime}:00 &nbsp;·&nbsp; {slotsPerDay} slots/day (30 min each)
        </p>
      </div>

      <button className="primary" onClick={handleSave} disabled={saving}>
        {saving ? 'Saving…' : saved ? 'Saved!' : 'Save settings'}
      </button>
    </div>
  )
}
