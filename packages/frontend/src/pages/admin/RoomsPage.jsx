import { useEffect, useState } from 'react'
import { getRooms, saveRooms } from '../../services/api'

export default function RoomsPage() {
  const [lecture, setLecture] = useState([])
  const [lab,     setLab]     = useState([])
  const [newLec,  setNewLec]  = useState('')
  const [newLab,  setNewLab]  = useState('')
  const [saving,  setSaving]  = useState(false)
  const [saved,   setSaved]   = useState(false)

  useEffect(() => {
    getRooms().then(r => {
      setLecture(r.lecture || [])
      setLab(r.lab || [])
    })
  }, [])

  function addLecture() {
    const v = newLec.trim()
    if (v && !lecture.includes(v)) { setLecture(l => [...l, v]); setNewLec('') }
  }
  function addLab() {
    const v = newLab.trim()
    if (v && !lab.includes(v)) { setLab(l => [...l, v]); setNewLab('') }
  }
  function removeLec(r) { setLecture(l => l.filter(x => x !== r)) }
  function removeLab(r) { setLab(l => l.filter(x => x !== r)) }

  async function handleSave() {
    setSaving(true)
    await saveRooms({ lecture, lab })
    setSaving(false)
    setSaved(true)
    setTimeout(() => setSaved(false), 2000)
  }

  const chipStyle = {
    display: 'inline-flex', alignItems: 'center', gap: 6,
    padding: '4px 10px', borderRadius: 20, border: '1px solid #ccc',
    fontSize: 12, background: '#fafafa', marginRight: 6, marginBottom: 6,
  }

  return (
    <div className="page" style={{ maxWidth: 640 }}>
      <p className="page-title">Rooms</p>
      <p style={{ color: '#666', fontSize: 13, marginBottom: 20 }}>
        Room order determines the solver's assignment priority. Add all rooms before running the scheduler.
      </p>

      {/* Lecture rooms */}
      <div className="card" style={{ marginBottom: 16 }}>
        <p style={{ fontWeight: 600, marginBottom: 12 }}>Lecture rooms ({lecture.length})</p>
        <div style={{ marginBottom: 12, flexWrap: 'wrap', display: 'flex' }}>
          {lecture.map(r => (
            <span key={r} style={chipStyle}>
              {r}
              <button onClick={() => removeLec(r)}
                style={{ border: 'none', background: 'none', cursor: 'pointer', padding: 0, fontSize: 14, lineHeight: 1, color: '#999' }}>×</button>
            </span>
          ))}
          {lecture.length === 0 && <span style={{ color: '#aaa', fontSize: 13 }}>No lecture rooms added.</span>}
        </div>
        <div style={{ display: 'flex', gap: 8 }}>
          <input value={newLec} onChange={e => setNewLec(e.target.value)}
            onKeyDown={e => e.key === 'Enter' && (e.preventDefault(), addLecture())}
            placeholder="e.g. Room 101" style={{ maxWidth: 220 }} />
          <button onClick={addLecture}>Add</button>
        </div>
      </div>

      {/* Lab rooms */}
      <div className="card" style={{ marginBottom: 20 }}>
        <p style={{ fontWeight: 600, marginBottom: 12 }}>Laboratory rooms ({lab.length})</p>
        <div style={{ marginBottom: 12, flexWrap: 'wrap', display: 'flex' }}>
          {lab.map(r => (
            <span key={r} style={chipStyle}>
              {r}
              <button onClick={() => removeLab(r)}
                style={{ border: 'none', background: 'none', cursor: 'pointer', padding: 0, fontSize: 14, lineHeight: 1, color: '#999' }}>×</button>
            </span>
          ))}
          {lab.length === 0 && <span style={{ color: '#aaa', fontSize: 13 }}>No lab rooms added.</span>}
        </div>
        <div style={{ display: 'flex', gap: 8 }}>
          <input value={newLab} onChange={e => setNewLab(e.target.value)}
            onKeyDown={e => e.key === 'Enter' && (e.preventDefault(), addLab())}
            placeholder="e.g. ICT Lab 1" style={{ maxWidth: 220 }} />
          <button onClick={addLab}>Add</button>
        </div>
      </div>

      <button className="primary" onClick={handleSave} disabled={saving}>
        {saving ? 'Saving…' : saved ? 'Saved!' : 'Save rooms'}
      </button>
    </div>
  )
}
