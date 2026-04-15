import { useState, useEffect, useRef } from 'react'
import { useNavigate } from 'react-router-dom'
import {
  getFacultyPreview, triggerSolve, getSolveStatus,
  getResult, saveSchedule, listSaved, loadSaved, deleteSaved,
} from '../../services/api'
import { useScheduleStore, useSolverStore } from '../../store/scheduleStore'

const PHASES = [
  'NSTP', 'GEC / MAT', 'Year 4', 'Year 3', 'Year 2', 'Year 1', 'PE / PATHFIT',
]

export default function SchedulerPage() {
  const navigate  = useNavigate()
  const setEvents = useScheduleStore(s => s.setEvents)
  const setName   = useScheduleStore(s => s.setName)
  const { processId, progress, status, setProcessId, setProgress, setStatus, reset } = useSolverStore()

  const [preview,   setPreview]   = useState(null)
  const [saveName,  setSaveName]  = useState('')
  const [saved,     setSaved]     = useState(false)
  const [savedList, setSavedList] = useState([])
  const [loadingList, setLoadingList] = useState(true)
  const pollRef = useRef(null)

  // Load saved schedules list on mount
  useEffect(() => {
    listSaved().then(setSavedList).finally(() => setLoadingList(false))
  }, [])

  // Poll solve status when running
  useEffect(() => {
    if (status !== 'running' || !processId) return
    pollRef.current = setInterval(async () => {
      try {
        const s = await getSolveStatus(processId)
        setProgress(s.progress)
        if (s.status === 'complete') {
          clearInterval(pollRef.current)
          setStatus('complete')
          const res = await getResult()
          setEvents(res.schedule)
        } else if (s.status === 'failed') {
          clearInterval(pollRef.current)
          setStatus('failed')
        }
      } catch { clearInterval(pollRef.current) }
    }, 1200)
    return () => clearInterval(pollRef.current)
  }, [status, processId])

  async function handlePreview() {
    const res = await getFacultyPreview()
    setPreview(res.courses)
  }

  async function handleSolve() {
    reset()
    setStatus('running')
    const res = await triggerSolve()
    setProcessId(res.process_id)
  }

  async function handleSave() {
    if (!saveName.trim()) return
    await saveSchedule(saveName.trim())
    setName(saveName.trim())
    setSaved(true)
    const list = await listSaved()
    setSavedList(list)
    setTimeout(() => setSaved(false), 2000)
  }

  async function handleLoad(name) {
    const data = await loadSaved(name)
    setEvents(data.schedule)
    setName(name)
    navigate(`/dashboard/schedule/${encodeURIComponent(name)}`)
  }

  async function handleDelete(name) {
    if (!confirm(`Delete saved schedule "${name}"?`)) return
    await deleteSaved(name)
    setSavedList(l => l.filter(x => x !== name))
  }

  const currentPhaseIdx = Math.floor((progress / 100) * 7)

  return (
    <div className="page">
      <p className="page-title">Scheduler</p>

      {/* Pre-solve preview */}
      <div className="card" style={{ marginBottom: 16 }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 }}>
          <p style={{ fontWeight: 600 }}>Faculty readiness check</p>
          <button onClick={handlePreview}>Run check</button>
        </div>
        {preview && (
          <div style={{ maxHeight: 200, overflow: 'auto' }}>
            <table>
              <thead><tr><th>Course</th><th>Title</th><th>Eligible faculty</th><th>Status</th></tr></thead>
              <tbody>
                {preview.map(c => (
                  <tr key={c.courseCode}>
                    <td style={{ fontWeight: 500 }}>{c.courseCode}</td>
                    <td>{c.title}</td>
                    <td>{c.poolSize}</td>
                    <td>
                      {c.warning
                        ? <span className="badge badge-red">No faculty</span>
                        : <span className="badge badge-green">OK</span>}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Solve trigger */}
      <div className="card" style={{ marginBottom: 16 }}>
        <p style={{ fontWeight: 600, marginBottom: 12 }}>Generate schedule</p>

        <button className="primary"
          onClick={handleSolve}
          disabled={status === 'running'}
          style={{ marginBottom: 20 }}>
          {status === 'running' ? 'Solving…' : 'Solve now'}
        </button>

        {/* Phase progress bar */}
        {(status === 'running' || status === 'complete') && (
          <div>
            <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 6 }}>
              <span style={{ fontSize: 12, color: '#666' }}>
                {status === 'complete' ? 'Complete' : `Phase ${currentPhaseIdx + 1}/7 — ${PHASES[currentPhaseIdx] || ''}`}
              </span>
              <span style={{ fontSize: 12, fontWeight: 600 }}>{progress}%</span>
            </div>
            <div style={{ height: 8, background: '#eee', borderRadius: 4, overflow: 'hidden' }}>
              <div style={{
                height: '100%',
                width: `${progress}%`,
                background: status === 'complete' ? '#1a6b2c' : '#000',
                borderRadius: 4,
                transition: 'width 0.4s ease',
              }} />
            </div>
            {/* Phase labels */}
            <div style={{ display: 'flex', justifyContent: 'space-between', marginTop: 6 }}>
              {PHASES.map((ph, i) => (
                <span key={ph} style={{
                  fontSize: 10,
                  color: i < currentPhaseIdx ? '#1a6b2c' : i === currentPhaseIdx ? '#000' : '#bbb',
                  fontWeight: i === currentPhaseIdx ? 600 : 400,
                  maxWidth: 60, textAlign: 'center',
                }}>
                  {ph}
                </span>
              ))}
            </div>
          </div>
        )}

        {status === 'failed' && (
          <p className="error-msg">The solver could not find a feasible schedule. Check that rooms and time windows are configured, and all courses have eligible faculty.</p>
        )}

        {status === 'complete' && (
          <div style={{ marginTop: 16 }}>
            <p style={{ color: '#1a6b2c', fontWeight: 600, marginBottom: 12 }}>
              Schedule generated successfully.
            </p>
            <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
              <input value={saveName} onChange={e => setSaveName(e.target.value)}
                placeholder="Save as… e.g. 2024-S2" style={{ maxWidth: 200 }} />
              <button className="primary" onClick={handleSave} disabled={!saveName.trim()}>
                {saved ? 'Saved!' : 'Save schedule'}
              </button>
              <button onClick={() => navigate('/dashboard/schedule')}>View schedule</button>
            </div>
          </div>
        )}
      </div>

      {/* Saved schedules */}
      <div className="card">
        <p style={{ fontWeight: 600, marginBottom: 12 }}>Saved schedules</p>
        {loadingList && <p style={{ color: '#888', fontSize: 13 }}>Loading…</p>}
        {!loadingList && savedList.length === 0 && (
          <p style={{ color: '#888', fontSize: 13 }}>No saved schedules yet.</p>
        )}
        {savedList.map(name => (
          <div key={name} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '8px 0', borderBottom: '1px solid #eee' }}>
            <span style={{ fontSize: 13, fontWeight: 500 }}>{name}</span>
            <div style={{ display: 'flex', gap: 8 }}>
              <button onClick={() => handleLoad(name)}>Load & view</button>
              <button className="danger" onClick={() => handleDelete(name)}>Delete</button>
            </div>
          </div>
        ))}
      </div>
    </div>
  )
}
