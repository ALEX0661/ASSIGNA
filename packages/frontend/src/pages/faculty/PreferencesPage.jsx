import { useEffect, useState } from 'react'
import { useAuth } from '../../hooks/useAuth'
import { updatePreferences, getFaculty } from '../../services/api'

const DAYS = ['Monday','Tuesday','Wednesday','Thursday','Friday','Saturday','Sunday']

/* ── Time formatter: 8.5 → "08:30 AM" ── */
function fmtTimeDisplay(h) {
  const hi = Math.floor(h)
  const mi = h % 1 === 0.5 ? '30' : '00'
  const ampm = hi >= 12 && hi < 24 ? 'PM' : 'AM'
  const displayH = hi > 12 ? hi - 12 : (hi === 0 ? 12 : hi)
  return `${String(displayH).padStart(2,'0')}:${mi} ${ampm}`
}

/* ── Form field wrapper ── */
function FormField({ label, hint, children }) {
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
      <label style={{ fontSize: 11.5, fontWeight: 700, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '.6px' }}>
        {label}
      </label>
      {children}
      {hint && <div style={{ fontSize: 11, color: '#94A3B8', marginTop: 2 }}>{hint}</div>}
    </div>
  )
}

/* ── Inline Section Save Button (Matches Admin Layout) ── */
function SectionSaveBtn({ saving, saved, onClick, disabled }) {
  const bg  = saved ? 'var(--emerald-pale)' : 'linear-gradient(135deg, var(--emerald-mid), var(--emerald-deep))'
  const cl  = saved ? 'var(--emerald-deep)' : '#fff'
  const bd  = saved ? '1.5px solid var(--emerald-light)' : 'none'
  const lbl = saving ? 'Saving...' : (saved ? 'Saved!' : 'Save Preferences')
  const dis = saving || disabled

  return (
    <button type="button" onClick={onClick} disabled={dis} style={{
      display: 'inline-flex', alignItems: 'center', gap: 6, padding: '8px 18px', borderRadius: '10px',
      border: bd, fontFamily: "'Poppins',sans-serif", fontSize: '12.5px', fontWeight: 600,
      cursor: dis ? 'default' : 'pointer', background: bg, color: cl,
      boxShadow: saved || dis ? 'none' : '0 4px 12px rgba(16,185,129,0.25)',
      transition: 'all 0.15s', flexShrink: 0, opacity: disabled ? 0.65 : 1,
    }}>
      {saving && (
        <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" style={{ animation: 'spin 0.8s linear infinite' }}>
          <path d="M21 12a9 9 0 1 1-6.219-8.56"/>
        </svg>
      )}
      {!saving && saved && (
        <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
          <polyline points="20 6 9 17 4 12"/>
        </svg>
      )}
      {!saving && !saved && (
        <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
          <path d="M19 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h11l5 5v11a2 2 0 0 1-2 2z"/>
          <polyline points="17 21 17 13 7 13 7 21"/>
          <polyline points="7 3 7 8 15 8"/>
        </svg>
      )}
      {lbl}
    </button>
  )
}

/* ── Skeleton Helper ── */
function Skel({ w = '100%', h = 14, r = 7, style = {} }) {
  return <div className="fac-skeleton" style={{ width: w, height: h, borderRadius: r, flexShrink: 0, ...style }} />
}

export default function PreferencesPage() {
  const { user } = useAuth()

  const [facultyId,      setFacultyId]      = useState(null)
  const [preferredDays,  setPreferredDays]  = useState(['Monday','Tuesday','Wednesday','Thursday','Friday'])
  const [preferredStart, setPreferredStart] = useState(7)
  const [preferredEnd,   setPreferredEnd]   = useState(17)
  
  const [saving,  setSaving]  = useState(false)
  const [saved,   setSaved]   = useState(false)
  const [loading, setLoading] = useState(true)
  const [error,   setError]   = useState('')

  const timeOptions = Array.from({length: 31}, (_, i) => 6 + i * 0.5) // 6:00 AM to 9:00 PM

  useEffect(() => {
    if (!user) return
    getFaculty()
      .then(list => {
        const match = list.find(f => f.email === user.email || f.id === user.uid)
        if (match) {
          setFacultyId(match.id)
          if (match.preferredDays?.length > 0) setPreferredDays(match.preferredDays)
          if (match.preferredTimeStart != null) setPreferredStart(match.preferredTimeStart)
          if (match.preferredTimeEnd != null)   setPreferredEnd(match.preferredTimeEnd)
        }
      })
      .catch(() => setError('Could not load your profile. Please refresh.'))
      .finally(() => setLoading(false))
  }, [user])

  function toggleDay(day) {
    setPreferredDays(d => d.includes(day) ? d.filter(x => x !== day) : [...d, day])
    setSaved(false) // Reset saved state if they change something
  }

  async function handleSave() {
    if (!facultyId) { setError('Faculty profile not found. Contact the admin.'); return }
    setSaving(true); setError('')
    try {
      await updatePreferences(facultyId, {
        preferredDays,
        preferredTimeStart:  Number(preferredStart),
        preferredTimeEnd:    Number(preferredEnd),
      })
      setSaved(true)
      setTimeout(() => setSaved(false), 2500)
    } catch {
      setError('Failed to save. Please try again.')
    } finally {
      setSaving(false)
    }
  }

  return (
    <div className="fac-page">
      <style>{`@keyframes spin { to { transform: rotate(360deg) } }`}</style>
      
      <div style={{ width: '100%' }}>
        
        {/* Info banner */}
        <div style={{
          background:'#F8FAFC', border:'1px solid #E2E8F0', borderRadius:12, padding:'14px 18px',
          display:'flex', gap:12, alignItems:'flex-start', marginBottom:28,
        }}>
          <div style={{ width:28, height:28, borderRadius:8, background:'var(--emerald-pale)', color:'var(--emerald-deep)', display:'flex', alignItems:'center', justifyContent:'center', flexShrink:0 }}>
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"><circle cx="12" cy="12" r="10"/><line x1="12" y1="8" x2="12" y2="12"/><line x1="12" y1="16" x2="12.01" y2="16"/></svg>
          </div>
          <p style={{ fontSize:12.5, color:'#334155', lineHeight:1.5 }}>
            Changes made here will apply to the <strong>next</strong> schedule generation. They do not instantly modify currently active schedules.
          </p>
        </div>

        {error && (
          <div style={{ background:'#FFF0F0', border:'1px solid #FECACA', borderRadius:10, padding:'12px 16px', fontSize:13, color:'#C0392B', marginBottom:20, display:'flex', alignItems:'center', gap:8 }}>
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"><circle cx="12" cy="12" r="10"/><line x1="15" y1="9" x2="9" y2="15"/><line x1="9" y1="9" x2="15" y2="15"/></svg>
            {error}
          </div>
        )}

        {/* ── Unified Preferences Card (Matches Admin FacultyDetailPage) ── */}
        <div style={{ background: '#fff', borderRadius: 16, border: '1px solid var(--border)', overflow: 'hidden', boxShadow: 'var(--shadow-sm)', marginBottom: 32 }}>
          
          {/* Card Header + Inline Save Button */}
          <div style={{ padding: '16px 24px', borderBottom: '1px solid #F1F5F9', display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: 14 }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
              <div style={{ width: 36, height: 36, borderRadius: 10, background: 'var(--emerald-pale)', display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'var(--emerald-deep)' }}>
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                  <rect x="3" y="4" width="18" height="18" rx="2" ry="2"/><line x1="16" y1="2" x2="16" y2="6"/><line x1="8" y1="2" x2="8" y2="6"/><line x1="3" y1="10" x2="21" y2="10"/>
                </svg>
              </div>
              <div>
                <h2 style={{ fontSize: 15, fontWeight: 700, color: '#0F172A', margin: 0 }}>Teaching Availability</h2>
                <p style={{ fontSize: 12, color: 'var(--text-muted)', marginTop: 2, margin: 0 }}>Configure your days and time window</p>
              </div>
            </div>
            
            {loading ? <Skel w={140} h={36} r={10} /> : (
              <SectionSaveBtn saving={saving} saved={saved} onClick={handleSave} />
            )}
          </div>

          {/* Card Body */}
          <div style={{ padding: '24px' }}>
            
            {/* Preferred Days */}
            <FormField label="Preferred Teaching Days">
              {loading ? (
                <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap' }}>
                  {[1,2,3,4,5,6,7].map(i => <Skel key={i} w={85} h={36} r={10} />)}
                </div>
              ) : (
                <div style={{ display:'flex', gap:10, flexWrap:'wrap' }}>
                  {DAYS.map(day => {
                    const on = preferredDays.includes(day);
                    return (
                      <button key={day} type="button" onClick={() => toggleDay(day)} 
                        style={{
                          padding: '7px 18px', borderRadius: '10px', fontSize: '12.5px', fontWeight: on ? '700' : '600', cursor: 'pointer', fontFamily: "'Poppins', sans-serif", transition: 'all 0.15s',
                          background: on ? 'var(--emerald-pale)' : '#fff', 
                          color: on ? 'var(--emerald-deep)' : 'var(--text-muted)', 
                          border: on ? '1.5px solid var(--emerald-light)' : '1.5px solid var(--border)'
                        }}>
                        {day}
                      </button>
                    )
                  })}
                </div>
              )}
            </FormField>

            {/* Divider */}
            <hr style={{ margin: '28px 0', border: 'none', borderTop: '1px solid #F1F5F9' }} />

            {/* Time Window Grid */}
            <div style={{ display:'grid', gridTemplateColumns:'repeat(auto-fit, minmax(280px, 1fr))', gap:24 }}>
              <FormField label="Earliest Start">
                {loading ? <Skel h={42} r={10} /> : (
                  <div style={{ position: 'relative' }}>
                    <select 
                      value={preferredStart} onChange={e => { setPreferredStart(Number(e.target.value)); setSaved(false); }}
                      style={{
                        width: '100%', padding: '10px 36px 10px 14px', borderRadius: '10px', border: '1.5px solid #D8D3F5', background: '#fff', color: '#0F172A', fontSize: '13px', fontWeight: '500', fontFamily: "'Poppins', sans-serif", appearance: 'none', cursor: 'pointer', outline: 'none', boxSizing: 'border-box'
                      }}
                    >
                      {timeOptions.filter(h => h < preferredEnd).map(h => (
                        <option key={h} value={h}>{fmtTimeDisplay(h)}</option>
                      ))}
                    </select>
                    <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="var(--text-muted)" strokeWidth="2.5" style={{ position: 'absolute', right: 14, top: '50%', transform: 'translateY(-50%)', pointerEvents: 'none' }}>
                      <polyline points="6 9 12 15 18 9"/>
                    </svg>
                  </div>
                )}
              </FormField>

              <FormField label="Latest End">
                {loading ? <Skel h={42} r={10} /> : (
                  <div style={{ position: 'relative' }}>
                    <select 
                      value={preferredEnd} onChange={e => { setPreferredEnd(Number(e.target.value)); setSaved(false); }}
                      style={{
                        width: '100%', padding: '10px 36px 10px 14px', borderRadius: '10px', border: '1.5px solid #D8D3F5', background: '#fff', color: '#0F172A', fontSize: '13px', fontWeight: '500', fontFamily: "'Poppins', sans-serif", appearance: 'none', cursor: 'pointer', outline: 'none', boxSizing: 'border-box'
                      }}
                    >
                      {timeOptions.filter(h => h > preferredStart).map(h => (
                        <option key={h} value={h}>{fmtTimeDisplay(h)}</option>
                      ))}
                    </select>
                    <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="var(--text-muted)" strokeWidth="2.5" style={{ position: 'absolute', right: 14, top: '50%', transform: 'translateY(-50%)', pointerEvents: 'none' }}>
                      <polyline points="6 9 12 15 18 9"/>
                    </svg>
                  </div>
                )}
              </FormField>
            </div>

            {/* Time Window Context Note */}
            {!loading && (
              <div style={{ marginTop:24, padding:'12px 16px', background:'#F8FAFC', borderRadius:10, display:'flex', alignItems:'center', gap:10, border: '1px solid #F1F5F9' }}>
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="#64748B" strokeWidth="2.5"><circle cx="12" cy="12" r="10"/><polyline points="12 6 12 12 16 14"/></svg>
                <span style={{ fontSize:12.5, color:'#475569', fontWeight:500 }}>
                  Classes can be scheduled between <strong style={{color:'#1e293b'}}>{fmtTimeDisplay(preferredStart)}</strong> and <strong style={{color:'#1e293b'}}>{fmtTimeDisplay(preferredEnd)}</strong>.
                </span>
              </div>
            )}
            
          </div>
        </div>
      </div>
    </div>
  )
}