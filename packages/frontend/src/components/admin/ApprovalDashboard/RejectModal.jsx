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
    <div style={{ position: 'fixed', inset: 0, zIndex: zIndex, background: 'rgba(10,30,18,0.55)', backdropFilter: 'blur(4px)', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 24 }} onClick={onClose}>
      <div style={{ background: 'var(--surface)', borderRadius: 18, padding: '28px 28px 24px', maxWidth: 440, width: '100%', boxShadow: '0 20px 60px rgba(10,30,18,0.22)' }} onClick={e => e.stopPropagation()}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 14, marginBottom: 20 }}>
          <div style={{ width: 48, height: 48, borderRadius: '50%', background: G.redSoft, color: G.red, display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
            <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><circle cx="12" cy="12" r="10"/><line x1="15" y1="9" x2="9" y2="15"/><line x1="9" y1="9" x2="15" y2="15"/></svg>
          </div>
          <div>
            <h3 style={{ margin: '0 0 4px', fontSize: 18, color: G.ink, fontWeight: 800, fontFamily: 'Inter,sans-serif' }}>Reject Schedule</h3>
            <p style={{ margin: 0, fontSize: 12.5, color: G.muted, lineHeight: 1.4 }}>
              The coordinator for <strong style={{ color: G.ink }}>{schedule?.programCode}</strong> will receive this feedback.
            </p>
          </div>
        </div>
        
        <div style={{ marginBottom: 16 }}>
          <label style={{ display: 'block', fontSize: 12.5, fontWeight: 700, color: G.ink, marginBottom: 8, fontFamily: 'Inter,sans-serif' }}>Reason</label>
          <select
            value={reasonType}
            onChange={e => setReasonType(e.target.value)}
            style={{ width: '100%', padding: '10px 14px', borderRadius: 10, border: `1.5px solid ${G.border}`, background: 'var(--surface)', fontSize: 13, color: G.ink, outline: 'none', fontFamily: 'Inter,sans-serif' }}
          >
            {PREDEFINED_REASONS.map(r => (
              <option key={r} value={r}>{r}</option>
            ))}
          </select>
        </div>
        
        <div style={{ marginBottom: 24 }}>
          <label style={{ display: 'block', fontSize: 12.5, fontWeight: 700, color: G.ink, marginBottom: 8, fontFamily: 'Inter,sans-serif' }}>{reasonType === 'Other' ? 'Details' : 'Additional Notes (Optional)'}</label>
          <textarea value={feedback} onChange={e => setFeedback(e.target.value)} rows={4}
            placeholder="Describe what needs to be corrected..." autoFocus={reasonType === 'Other'}
            style={{ width: '100%', padding: '12px 14px', borderRadius: 10, border: `1.5px solid ${G.border}`, background: 'var(--surface)', fontSize: 13, color: G.ink, outline: 'none', resize: 'vertical', lineHeight: 1.5, fontFamily: 'Inter,sans-serif' }} />
          <p style={{ margin: '6px 0 0', fontSize: 11.5, color: G.muted2, textAlign: 'right' }}>{feedback.length} characters</p>
        </div>
        
        <div style={{ display: 'flex', gap: 10 }}>
          <button onClick={onClose} disabled={saving} style={{ flex: 1, padding: '11px', borderRadius: 9, border: `1.5px solid ${G.border}`, background: 'var(--surface)', fontSize: 13.5, fontWeight: 600, color: G.muted, cursor: saving ? 'default' : 'pointer', fontFamily: 'Inter,sans-serif' }}>
            Cancel
          </button>
          <button onClick={handle} disabled={(reasonType === 'Other' && !feedback.trim()) || saving} style={{ flex: 1, padding: '11px', borderRadius: 9, border: 'none', background: G.red, fontSize: 13.5, fontWeight: 700, color: '#fff', cursor: ((reasonType === 'Other' && !feedback.trim()) || saving) ? 'not-allowed' : 'pointer', fontFamily: 'Inter,sans-serif', opacity: ((reasonType === 'Other' && !feedback.trim()) || saving) ? 0.6 : 1 }}>
            {saving ? 'Rejecting…' : 'Reject & Notify'}
          </button>
        </div>
      </div>
    </div>,
    document.body
  )
}

export default RejectModal