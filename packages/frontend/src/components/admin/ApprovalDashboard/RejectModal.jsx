import { useState } from 'react'
import { createPortal } from 'react-dom'
import G from './tokens'
import { useEscapeClose } from './hooks'

function RejectModal({ schedule, onClose, onReject, zIndex = 3000 }) {
  useEscapeClose(onClose)
  const PREDEFINED_REASONS = [
    "Faculty conflict detected",
    "Room conflict or overcapacity",
    "Missing required courses",
    "Schedule violates department guidelines",
    "Other"
  ]
  const [reasonType, setReasonType] = useState(PREDEFINED_REASONS[0])
  const [feedback, setFeedback] = useState('')
  const [saving, setSaving] = useState(false)

  async function handle() {
    const finalFeedback = reasonType === 'Other' ? feedback.trim() : (feedback.trim() ? `${reasonType} - ${feedback.trim()}` : reasonType)
    if (!finalFeedback) return
    setSaving(true)
    try { await onReject(schedule.id || schedule.scheduleId, finalFeedback); onClose() }
    finally { setSaving(false) }
  }

  return createPortal(
    <div className="ap-modal-overlay" style={{ zIndex }} onClick={onClose}>
      <div className="ap-modal" style={{ width: 440 }} onClick={e => e.stopPropagation()}>
        <div className="ap-modal-header">
          <div style={{ width: 34, height: 34, borderRadius: 9, background: G.redSoft, color: G.red, display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><circle cx="12" cy="12" r="10"/><line x1="15" y1="9" x2="9" y2="15"/><line x1="9" y1="9" x2="15" y2="15"/></svg>
          </div>
          <div style={{ flex: 1 }}>
            <h3 className="ap-modal-title">Reject Schedule</h3>
            <p style={{ margin: '3px 0 0', fontSize: 11.5, color: G.muted, lineHeight: 1.5 }}>
              The coordinator for <strong style={{ color: G.ink }}>{schedule?.programCode}</strong> will receive this feedback.
            </p>
          </div>
          <button onClick={onClose} className="ap-modal-close">×</button>
        </div>
        <div style={{ padding: '18px 22px 22px' }}>
          <div style={{ marginBottom: 12 }}>
            <label style={{ display: 'block', fontSize: 12, fontWeight: 600, color: G.ink, marginBottom: 6 }}>Reason</label>
            <select
              value={reasonType}
              onChange={e => setReasonType(e.target.value)}
              className="cp-inp"
              style={{ width: '100%', padding: '8px 12px' }}
            >
              {PREDEFINED_REASONS.map(r => (
                <option key={r} value={r}>{r}</option>
              ))}
            </select>
          </div>
          <div style={{ marginBottom: 18 }}>
            <label style={{ display: 'block', fontSize: 12, fontWeight: 600, color: G.ink, marginBottom: 6 }}>{reasonType === 'Other' ? 'Details' : 'Additional Notes (Optional)'}</label>
            <textarea value={feedback} onChange={e => setFeedback(e.target.value)} rows={4}
              placeholder="Describe what needs to be corrected..." autoFocus={reasonType === 'Other'}
              className="cp-inp" style={{ resize: 'vertical', lineHeight: 1.6 }} />
            <p style={{ margin: '6px 0 0', fontSize: 11, color: G.muted2 }}>{feedback.length} characters</p>
          </div>
          <div style={{ display: 'flex', gap: 8, justifyContent: 'flex-end' }}>
            <button onClick={onClose} className="btn-outline">Cancel</button>
            <button onClick={handle} disabled={(reasonType === 'Other' && !feedback.trim()) || saving} className="btn-danger" style={{ minWidth: 120, justifyContent: 'center', background: saving ? undefined : G.red, color: '#fff', border: 'none' }}>
              {saving ? 'Rejecting…' : 'Reject & Notify'}
            </button>
          </div>
        </div>
      </div>
    </div>,
    document.body
  )
}

export default RejectModal