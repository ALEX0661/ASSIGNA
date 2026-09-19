import { useState } from 'react'
import G from './tokens'
import { SEMESTERS, academicYearOptions } from './constants'
import { useEscapeClose } from './hooks'
import DraggableOrderList from './DraggableOrderList'

function CreateQueueModal({ onClose, onCreate, programs }) {
  useEscapeClose(onClose)
  const [semester, setSemester] = useState('1st Semester')
  const [year, setYear] = useState(() => academicYearOptions()[1])
  const [order, setOrder] = useState([...programs])
  const [saving, setSaving] = useState(false)
  const [dragIndex, setDragIndex] = useState(null)
  const [overIndex, setOverIndex] = useState(null)

  const [error, setError] = useState(null)

  function handleDrop(dropAt) {
    if (dragIndex === null || dragIndex === dropAt) { setDragIndex(null); setOverIndex(null); return }
    const next = [...order]
    const [moved] = next.splice(dragIndex, 1)
    next.splice(dropAt, 0, moved)
    setOrder(next)
    setDragIndex(null); setOverIndex(null)
  }

  async function handleCreate() {
    if (!year.trim()) return
    setSaving(true)
    setError(null)
    try { await onCreate({ semester, academicYear: year, queue: order }); onClose() }
    catch (e) { setError(e?.response?.data?.detail || 'Failed to create queue') }
    finally { setSaving(false) }
  }

  return (
    <div className="ap-modal-overlay" onClick={onClose}>
      <div className="ap-modal" style={{ width: 460 }} onClick={e => e.stopPropagation()}>
        <div className="ap-modal-header" style={{ background: `linear-gradient(135deg, ${G.meadowDeep}, ${G.meadow})`, borderBottom: 'none' }}>
          <div style={{ width: 34, height: 34, borderRadius: 9, background: 'rgba(255,255,255,0.18)', color: '#fff', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="#fff" strokeWidth="2"><rect x="3" y="4" width="18" height="4" rx="1"/><rect x="3" y="10" width="18" height="4" rx="1"/><rect x="3" y="16" width="18" height="4" rx="1"/></svg>
          </div>
          <div style={{ flex: 1 }}>
            <h3 className="ap-modal-title" style={{ color: '#fff' }}>Create Coordinator Queue</h3>
            <p style={{ margin: '3px 0 0', fontSize: 11.5, color: 'rgba(255,255,255,0.82)' }}>Set the scheduling order for this semester</p>
          </div>
          <button onClick={onClose} className="ap-modal-close" style={{ background: 'rgba(255,255,255,0.18)', border: '1px solid rgba(255,255,255,0.32)', color: '#fff' }}>×</button>
        </div>

        <div style={{ padding: '20px 22px 22px' }}>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12, marginBottom: 20 }}>
            <div>
              <label style={{ fontSize: 11.5, fontWeight: 600, color: G.muted, display: 'block', marginBottom: 5 }}>Semester</label>
              <select value={semester} onChange={e => { setSemester(e.target.value); setError(null) }} className="cp-inp">
                {SEMESTERS.map(s => <option key={s}>{s}</option>)}
              </select>
            </div>
            <div>
              <label style={{ fontSize: 11.5, fontWeight: 600, color: G.muted, display: 'block', marginBottom: 5 }}>Academic Year</label>
              <select value={year} onChange={e => { setYear(e.target.value); setError(null) }} className="cp-inp">
                {academicYearOptions().map(y => <option key={y} value={y}>{y}</option>)}
              </select>
            </div>
          </div>

          <label style={{ fontSize: 11.5, fontWeight: 600, color: G.muted, display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 8 }}>
            <span>Scheduling Order</span>
            <span style={{ fontWeight: 500, color: 'var(--meadow-text-hover)', display: 'inline-flex', alignItems: 'center', gap: 4 }}>
              <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><circle cx="9" cy="6" r="1"/><circle cx="9" cy="12" r="1"/><circle cx="9" cy="18" r="1"/><circle cx="15" cy="6" r="1"/><circle cx="15" cy="12" r="1"/><circle cx="15" cy="18" r="1"/></svg>
              drag to reorder
            </span>
          </label>
          <div style={{ marginBottom: 22, background: G.bg, border: `1px solid ${G.border}`, borderRadius: 12, padding: 8 }}>
            <DraggableOrderList
              order={order}
              dragIndex={dragIndex}
              overIndex={overIndex}
              onDragStart={setDragIndex}
              onDragEnter={setOverIndex}
              onDrop={handleDrop}
              onDragEnd={() => { setDragIndex(null); setOverIndex(null) }}
            />
          </div>

          {error && (
            <div style={{ marginBottom: 16, padding: '8px 12px', background: 'rgba(239, 68, 68, 0.1)', color: '#EF4444', borderRadius: 8, fontSize: 12, fontWeight: 500 }}>
              {error}
            </div>
          )}

          <div style={{ display: 'flex', gap: 8, justifyContent: 'flex-end' }}>
            <button onClick={onClose} className="btn-outline">Cancel</button>
            <button onClick={handleCreate} disabled={saving} className="btn-primary" style={{ minWidth: 110, justifyContent: 'center' }}>
              {saving
                ? <><svg className="ap-spin" width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"><path d="M21 12a9 9 0 1 1-6.22-8.56"/></svg> Creating…</>
                : 'Create Queue'}
            </button>
          </div>
        </div>
      </div>
    </div>
  )
}

export default CreateQueueModal
