import { useState } from 'react'
import { ACADEMIC_RANKS, DEPARTMENTS } from './FacultyDetail/fdShared'
import { addFaculty } from '../services/api'

export default function AddFacultyModal({ onClose, onSuccess }) {
  const [form, setForm] = useState({
    firstName: '',
    lastName: '',
    email: '',
    AcademicRank: '',
    Department: '',
    status: 'full-time',
    Educational_attainment: '',
    SexAtBirth: '',
  })
  
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')
  const [successData, setSuccessData] = useState(null)
  const [pwCopied, setPwCopied] = useState(false)

  const isDark = document.documentElement.getAttribute('data-mode') === 'dark'
  const T = {
    bg: 'var(--bg)',
    surface: 'var(--surface)',
    border: 'var(--border)',
    borderLight: 'var(--hover)',
    textMain: 'var(--ink)',
    textMuted: 'var(--muted)',
    meadow: 'var(--meadow)',
    meadowDeep: 'var(--meadow-deep)',
    meadowSoft: 'var(--meadow-soft)',
  }

  async function handleSubmit(e) {
    e.preventDefault()
    if (!form.firstName || !form.lastName || !form.email) return
    setSaving(true)
    setError('')
    try {
      const payload = {
        ...form,
        name: `${form.lastName.trim().toUpperCase()}, ${form.firstName.trim().toUpperCase()}`
      }
      const res = await addFaculty(payload)
      setSuccessData(res) // { tempPassword, newId }
    } catch (err) {
      setError(err.response?.data?.detail || 'Failed to create faculty member.')
    } finally {
      setSaving(false)
    }
  }

  if (successData) {
    const copyBg = pwCopied ? T.meadowSoft : T.surface
    const copyCl = pwCopied ? T.meadow : T.meadowDeep
    return (
      <div style={{ position: 'fixed', inset: 0, zIndex: 9999, display: 'flex', alignItems: 'center', justifyContent: 'center', background: 'rgba(0,0,0,0.5)', backdropFilter: 'blur(4px)', padding: 20 }}>
        <div style={{ background: T.surface, borderRadius: 18, border: `1px solid ${T.border}`, overflow: 'hidden', boxShadow: '0 10px 40px rgba(0,0,0,0.2)', width: '100%', maxWidth: 460, animation: 'fadeIn 0.2s ease-out' }}>
          <div style={{ padding: '24px 28px', borderBottom: `1px solid ${T.borderLight}`, display: 'flex', gap: 14, alignItems: 'center' }}>
            <div style={{ width: 44, height: 44, borderRadius: '50%', background: T.meadowSoft, display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
              <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke={T.meadow} strokeWidth="2.5"><polyline points="20 6 9 17 4 12"/></svg>
            </div>
            <div>
              <div style={{ fontSize: 16, fontWeight: 700, color: T.textMain }}>Account Created</div>
              <div style={{ fontSize: 13, color: T.textMuted, marginTop: 2 }}>Firebase Auth account created and profile ready.</div>
            </div>
          </div>
          <div style={{ padding: '24px 28px' }}>
            <div style={{ fontSize: 11, fontWeight: 700, color: T.textMuted, textTransform: 'uppercase', letterSpacing: '.6px', marginBottom: 10 }}>Auto-generated Password</div>
            <div style={{ display: 'flex', gap: 10, marginBottom: 20 }}>
              <code style={{ flex: 1, padding: '12px 16px', background: T.bg, borderRadius: 10, border: `1.5px solid ${T.border}`, fontSize: 16, fontFamily: 'monospace', letterSpacing: 2, color: T.textMain }}>{successData.tempPassword}</code>
              <button type="button" onClick={() => { navigator.clipboard.writeText(successData.tempPassword); setPwCopied(true); setTimeout(() => setPwCopied(false), 2000) }} style={{ padding: '12px 16px', borderRadius: 10, border: `1.5px solid ${T.border}`, background: copyBg, color: copyCl, fontSize: 13, fontWeight: 600, cursor: 'pointer', fontFamily: "'Inter',sans-serif", whiteSpace: 'nowrap' }}>
                {pwCopied ? 'Copied!' : 'Copy'}
              </button>
            </div>
            <div style={{ fontSize: 12.5, color: T.textMuted, background: T.bg, borderRadius: 8, padding: '12px 16px', border: `1px solid ${T.border}`, marginBottom: 24, lineHeight: 1.5 }}>
              The faculty member can now log in using the email you provided and this temporary password.
            </div>
            <div style={{ display: 'flex', justifyContent: 'flex-end' }}>
              <button onClick={() => { if(onSuccess) onSuccess(); onClose(); }} style={{ padding: '10px 20px', borderRadius: 10, border: 'none', background: `linear-gradient(135deg,${T.meadow},${T.meadowDeep})`, color: '#fff', fontSize: 13, fontWeight: 600, cursor: 'pointer', fontFamily: "'Inter',sans-serif" }}>
                Close
              </button>
            </div>
          </div>
        </div>
      </div>
    )
  }

  const inputStyle = {
    padding: '10px 14px', borderRadius: 8, border: `1px solid ${T.border}`, fontSize: 13, fontFamily: "'Inter',sans-serif", width: '100%', boxSizing: 'border-box', outline: 'none', background: T.bg, color: T.textMain
  }
  const labelStyle = { display: 'block', fontSize: 11.5, fontWeight: 600, color: T.textMuted, marginBottom: 6 }

  return (
    <div style={{ position: 'fixed', inset: 0, zIndex: 9999, display: 'flex', alignItems: 'center', justifyContent: 'center', background: 'rgba(0,0,0,0.5)', backdropFilter: 'blur(4px)', padding: 20 }}>
      <div style={{ background: T.surface, borderRadius: 16, border: `1px solid ${T.border}`, width: '100%', maxWidth: 600, display: 'flex', flexDirection: 'column', maxHeight: '90vh', boxShadow: '0 10px 40px rgba(0,0,0,0.2)', animation: 'fadeIn 0.2s ease-out' }}>
        
        {/* Header */}
        <div style={{ padding: '20px 24px', borderBottom: `1px solid ${T.borderLight}`, display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexShrink: 0 }}>
          <h2 style={{ margin: 0, fontSize: 16, fontWeight: 700, color: T.textMain, display: 'flex', alignItems: 'center', gap: 8 }}>
            <div style={{ width: 32, height: 32, borderRadius: 8, background: `linear-gradient(135deg,${T.meadow},${T.meadowDeep})`, display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#fff' }}>
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"><line x1="12" y1="5" x2="12" y2="19"/><line x1="5" y1="12" x2="19" y2="12"/></svg>
            </div>
            Add Faculty Member
          </h2>
          <button type="button" onClick={onClose} style={{ background: 'none', border: 'none', cursor: 'pointer', color: T.textMuted, padding: 4 }}>
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg>
          </button>
        </div>

        {/* Body */}
        <div style={{ padding: '24px', overflowY: 'auto', flex: 1 }}>
          <form id="add-fac-form" onSubmit={handleSubmit} style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '20px 24px' }}>
            
            <div>
              <label style={labelStyle}>Last Name <span style={{color: '#EF4444'}}>*</span></label>
              <input value={form.lastName} onChange={e => setForm({...form, lastName: e.target.value.toUpperCase()})} required style={{...inputStyle, textTransform: 'uppercase'}} placeholder="e.g. DELA CRUZ" />
            </div>
            <div>
              <label style={labelStyle}>First Name <span style={{color: '#EF4444'}}>*</span></label>
              <input value={form.firstName} onChange={e => setForm({...form, firstName: e.target.value.toUpperCase()})} required style={{...inputStyle, textTransform: 'uppercase'}} placeholder="e.g. JUAN" />
            </div>
            
            <div style={{ gridColumn: '1 / -1' }}>
              <label style={labelStyle}>Email Address <span style={{color: '#EF4444'}}>*</span></label>
              <input type="email" value={form.email} onChange={e => setForm({...form, email: e.target.value})} required style={inputStyle} placeholder="name@school.edu.ph" />
              <div style={{ fontSize: 10.5, color: T.textMuted, marginTop: 6 }}>This will be used for their Firebase login credentials.</div>
            </div>

            <div>
              <label style={labelStyle}>Employment Status <span style={{color: '#EF4444'}}>*</span></label>
              <select value={form.status} onChange={e => setForm({...form, status: e.target.value})} required style={inputStyle}>
                <option value="full-time">Full-time</option>
                <option value="part-time">Part-time</option>
              </select>
            </div>
            
            <div>
              <label style={labelStyle}>Academic Rank</label>
              <select value={form.AcademicRank} onChange={e => setForm({...form, AcademicRank: e.target.value})} style={inputStyle}>
                <option value="">Select rank...</option>
                {ACADEMIC_RANKS.map(r => <option key={r} value={r}>{r}</option>)}
              </select>
            </div>

            <div>
              <label style={labelStyle}>Department</label>
              <select value={form.Department} onChange={e => setForm({...form, Department: e.target.value})} style={inputStyle}>
                <option value="">Select department...</option>
                {DEPARTMENTS.map(d => <option key={d} value={d}>{d}</option>)}
              </select>
            </div>

            <div>
              <label style={labelStyle}>Sex at Birth</label>
              <select value={form.SexAtBirth} onChange={e => setForm({...form, SexAtBirth: e.target.value})} style={inputStyle}>
                <option value="">Select...</option>
                <option value="Male">Male</option>
                <option value="Female">Female</option>
                <option value="Other">Other / Prefer not to say</option>
              </select>
            </div>

          </form>

          {error && (
            <div style={{ marginTop: 24, background: 'rgba(239, 68, 68, 0.1)', border: '1px solid rgba(239, 68, 68, 0.3)', borderRadius: 8, padding: '10px 14px', display: 'flex', gap: 8, alignItems: 'center' }}>
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="#EF4444" strokeWidth="2"><circle cx="12" cy="12" r="10"/><line x1="12" y1="8" x2="12" y2="12"/></svg>
              <span style={{ fontSize: 12.5, color: '#EF4444', fontWeight: 500 }}>{error}</span>
            </div>
          )}
        </div>

        {/* Footer */}
        <div style={{ padding: '16px 24px', borderTop: `1px solid ${T.borderLight}`, display: 'flex', justifyContent: 'flex-end', gap: 12, flexShrink: 0, background: T.bg, borderBottomLeftRadius: 16, borderBottomRightRadius: 16 }}>
          <button type="button" onClick={onClose} disabled={saving} style={{ padding: '9px 18px', borderRadius: 10, border: `1.5px solid ${T.border}`, background: T.surface, color: T.textMuted, fontSize: 12.5, fontWeight: 600, cursor: saving ? 'default' : 'pointer', fontFamily: "'Inter',sans-serif", opacity: saving ? 0.7 : 1 }}>
            Cancel
          </button>
          <button type="submit" form="add-fac-form" disabled={saving} style={{ padding: '9px 24px', borderRadius: 10, border: 'none', background: `linear-gradient(135deg,${T.meadow},${T.meadowDeep})`, color: '#fff', fontSize: 12.5, fontWeight: 600, cursor: saving ? 'default' : 'pointer', fontFamily: "'Inter',sans-serif", opacity: saving ? 0.7 : 1, boxShadow: '0 3px 10px rgba(0,0,0,0.2)' }}>
            {saving ? 'Creating...' : 'Create Faculty'}
          </button>
        </div>

      </div>
    </div>
  )
}
