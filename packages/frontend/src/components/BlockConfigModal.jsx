import { useState, useEffect } from 'react'
import { getCourses, getBlockConfigs, saveBlockConfigs, applyBlockConfigs } from '../services/api'

// Helper for ordinal numbers (1st, 2nd, etc.)
const ORDINAL = n => {
  const s = ['th','st','nd','rd'], v = n % 100
  return n + (s[(v-20)%10] || s[v] || s[0])
}

// Program badge colors
const PROG_META = {
  'BSCS':      { color: '#7C6FCD', bg: '#F4F2FA' },
  'BSIT':      { color: '#059669', bg: '#E6FAF3' },
  'BSEMC-GD':  { color: '#D97706', bg: '#FEF3CD' },
  'BSEMC-DAT': { color: '#DC2626', bg: '#FFF5F5' },
}
const DEFAULT_META = { color: '#7C6FCD', bg: '#F4F2FA' }

// Injected CSS for hover states and animations
if (!document.getElementById('block-config-modal-style')) {
  const s = document.createElement('style')
  s.id = 'block-config-modal-style'
  s.textContent = `
    @keyframes bcFadeIn  { from{opacity:0; backdrop-filter:blur(0px);} to{opacity:1; backdrop-filter:blur(4px);} }
    @keyframes bcSlideUp { from{opacity:0; transform:translateY(12px) scale(0.98);} to{opacity:1; transform:translateY(0) scale(1);} }
    @keyframes bcSpin    { to{transform:rotate(360deg);} }

    /* Minimalist Stepper */
    .bc-stepper-container {
      display: inline-flex; align-items: center;
      background: #F8F7FD; border: 1.5px solid #E8E4F8;
      border-radius: 10px; overflow: hidden;
      transition: border-color 0.2s, background 0.2s;
    }
    .bc-stepper-container:focus-within {
      border-color: #7C6FCD; background: #fff;
      box-shadow: 0 0 0 3px rgba(124, 111, 205, 0.1);
    }
    .bc-stepper-btn {
      width: 32px; height: 32px; background: transparent;
      border: none; color: #7C6FCD; font-size: 16px;
      font-weight: 500; cursor: pointer; transition: all 0.15s;
      display: flex; align-items: center; justify-content: center;
    }
    .bc-stepper-btn:hover:not(:disabled) { background: #EEEAFB; }
    .bc-stepper-btn:active:not(:disabled) { background: #E2DDF5; }
    .bc-stepper-btn:disabled { opacity: 0.3; cursor: not-allowed; }
    
    .bc-stepper-input {
      width: 36px; text-align: center; border: none;
      background: transparent; font-weight: 600; font-size: 14px;
      color: #1a1a2e; font-family: 'Poppins', sans-serif;
      outline: none; -moz-appearance: textfield;
    }
    .bc-stepper-input::-webkit-outer-spin-button,
    .bc-stepper-input::-webkit-inner-spin-button { -webkit-appearance: none; margin: 0; }

    /* Modern Cards */
    .bc-group-card {
      border: 1.5px solid #F0EDF9; border-radius: 14px;
      background: #ffffff; padding: 16px;
      display: flex; align-items: center; justify-content: space-between; gap: 16px;
      transition: all 0.2s ease;
    }
    .bc-group-card:hover { 
      border-color: #D8D3F5; 
      box-shadow: 0 4px 20px rgba(124,111,205,0.06); 
      transform: translateY(-1px);
    }
    
    /* Close Button (Mapped from ImportCoursesModal for consistency) */
    .bc-close-btn {
      display: inline-flex; align-items: center; justify-content: center;
      width: 32px; height: 32px; border-radius: 8px;
      border: 1.5px solid #E8E4F8; cursor: pointer;
      background: #F5F4FB; color: #7C6FCD; transition: all 0.2s; flex-shrink: 0;
      padding: 0;
    }
    .bc-close-btn:hover { background: #FFE8E8; border-color: #FECACA; color: #DC2626; }

    .bc-cancel-btn:hover { background: #F5F4FB !important; color: #7C6FCD !important; border-color: #D8D3F5 !important; }
    
    /* Scrollbar for modern feel */
    .bc-scroll::-webkit-scrollbar { width: 6px; }
    .bc-scroll::-webkit-scrollbar-track { background: transparent; }
    .bc-scroll::-webkit-scrollbar-thumb { background: #E8E4F8; border-radius: 10px; }
    .bc-scroll::-webkit-scrollbar-thumb:hover { background: #C5BBEF; }
  `
  document.head.appendChild(s)
}

function Stepper({ value, onChange, disabled }) {
  const num = value === '' ? '' : Number(value)
  return (
    <div className="bc-stepper-container">
      <button 
        className="bc-stepper-btn" 
        disabled={disabled || num <= 1 || num === ''} 
        onClick={() => onChange(Math.max(1, num - 1))}
      >−</button>
      <input
        className="bc-stepper-input"
        type="number" min={1} max={20} value={value}
        onChange={e => onChange(e.target.value === '' ? '' : Number(e.target.value))}
        placeholder="—"
        disabled={disabled}
      />
      <button 
        className="bc-stepper-btn" 
        disabled={disabled || num >= 20} 
        onClick={() => onChange(num === '' ? 1 : Math.min(20, num + 1))}
      >+</button>
    </div>
  )
}

export default function BlockConfigModal({ semester, onClose, onApplied }) {
  const [groups,      setGroups]      = useState([])
  const [configs,     setConfigs]     = useState({})
  const [loading,     setLoading]     = useState(true)
  const [applying,    setApplying]    = useState(false)
  const [applied,     setApplied]     = useState(false)
  const [applyResult, setApplyResult] = useState(null)
  const [error,       setError]       = useState('')

  useEffect(() => { loadData() }, [semester])

  async function loadData() {
    setLoading(true); setError('')
    try {
      const [courses, cfgData] = await Promise.all([getCourses(semester), getBlockConfigs(semester)])
      const seen = new Set()
      const grps = []
      courses.forEach(c => {
        const key = `${c.program}_${c.yearLevel}`
        if (!seen.has(key)) {
          seen.add(key)
          grps.push({ key, program: c.program, yearLevel: Number(c.yearLevel), count: 0 })
        }
        grps.find(g => g.key === key).count++
      })
      grps.sort((a, b) => a.program.localeCompare(b.program) || a.yearLevel - b.yearLevel)
      setGroups(grps)
      const map = {}
      for (const cfg of cfgData) { map[`${cfg.program}_${cfg.yearLevel}`] = cfg.blocks }
      setConfigs(map)
    } catch {
      setError('Failed to load data.')
    } finally { setLoading(false) }
  }

  function setVal(key, value) {
    setConfigs(prev => ({ ...prev, [key]: value === '' ? '' : Number(value) }))
    setApplied(false)
  }

  // Unified Save & Apply function
  async function handleApply() {
    setApplying(true); setError(''); setApplyResult(null); setApplied(false)
    try {
      const cfgList = groups
        .filter(g => configs[g.key] !== undefined && configs[g.key] !== '' && Number(configs[g.key]) >= 1)
        .map(g => ({ program: g.program, yearLevel: g.yearLevel, semester, blocks: Number(configs[g.key]) }))
      
      // Save configuration first, then apply immediately to courses
      await saveBlockConfigs(cfgList)
      const res = await applyBlockConfigs(semester)
      
      setApplyResult(res); setApplied(true)
      if (onApplied) onApplied()
    } catch (err) {
      setError(err?.response?.data?.detail || 'Failed to save and apply configurations.')
    } finally { setApplying(false) }
  }

  const programs = [...new Set(groups.map(g => g.program))]

  return (
    <div
      style={{ position:'fixed', inset:0, background:'rgba(20, 18, 40, 0.4)', display:'flex', alignItems:'center', justifyContent:'center', zIndex:1000, animation:'bcFadeIn 0.2s ease forwards', padding:24 }}
      onClick={e => e.target === e.currentTarget && onClose()}
    >
      <div style={{
        background:'#ffffff', borderRadius:20, width:'100%', maxWidth:720,
        maxHeight:'85vh', display:'flex', flexDirection:'column',
        fontFamily:"'Poppins',sans-serif",
        boxShadow:'0 24px 48px rgba(0,0,0,0.08), 0 8px 24px rgba(124,111,205,0.06)',
        animation:'bcSlideUp 0.3s cubic-bezier(0.16, 1, 0.3, 1) forwards',
      }}>

        {/* ── Header ── */}
        <div style={{ display:'flex', justifyContent:'space-between', alignItems:'flex-start', padding:'26px 28px', borderBottom:'1px solid #F4F2FA', flexShrink:0 }}>
          <div>
            <div style={{ display:'flex', alignItems:'center', gap:10, marginBottom:4 }}>
              <div style={{ width:34, height:34, borderRadius:10, background:'linear-gradient(135deg,#EEEAFB,#D8D3F5)', display:'flex', alignItems:'center', justifyContent:'center', flexShrink:0, color:'#7C6FCD' }}>
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                  <rect x="3" y="3" width="7" height="7" rx="1.5"/><rect x="14" y="3" width="7" height="7" rx="1.5"/>
                  <rect x="3" y="14" width="7" height="7" rx="1.5"/><rect x="14" y="14" width="7" height="7" rx="1.5"/>
                </svg>
              </div>
              <h2 style={{ fontSize:16, fontWeight:700, color:'#1a1a2e', margin:0 }}>Block Configuration</h2>
            </div>
            <p style={{ fontSize:11.5, color:'#B0ABCC', margin:0, marginLeft:44 }}>
              Set sections for <span style={{ color:'#7C6FCD', fontWeight:500 }}>{semester}</span>
            </p>
          </div>
          <button className="bc-close-btn" onClick={onClose} aria-label="Close">
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round">
              <line x1="18" y1="6" x2="6" y2="18" />
              <line x1="6" y1="6" x2="18" y2="18" />
            </svg>
          </button>
        </div>

        {/* ── Body ── */}
        <div className="bc-scroll" style={{ padding:'24px', overflowY:'auto', flex:1, background:'#FAFAFC' }}>
          {loading ? (
            <div style={{ display:'flex', flexDirection:'column', alignItems:'center', justifyContent:'center', gap:16, height:'100%', minHeight:200 }}>
              <div style={{ width:40, height:40, borderRadius:'50%', border:'3px solid #E8E4F8', borderTopColor:'#7C6FCD', animation:'bcSpin 0.8s linear infinite' }} />
              <span style={{ fontSize:14, color:'#6B7280', fontWeight:500 }}>Loading curriculum data…</span>
            </div>
          ) : groups.length === 0 ? (
            <div style={{ display:'flex', flexDirection:'column', alignItems:'center', justifyContent:'center', textAlign:'center', padding:'48px 20px', minHeight:200 }}>
              <div style={{ width:56, height:56, borderRadius:16, background:'#F4F2FA', color:'#A99BE8', display:'flex', alignItems:'center', justifyContent:'center', marginBottom:16 }}>
                 <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M22 12h-4l-3 9L9 3l-3 9H2"/></svg>
              </div>
              <h3 style={{ fontWeight:600, color:'#1E1B4B', fontSize:16, margin:'0 0 8px 0' }}>No courses found</h3>
              <p style={{ fontSize:14, color:'#6B7280', margin:0, maxWidth:300 }}>There are no courses imported for <strong>{semester}</strong> yet. Please import curriculum data first.</p>
            </div>
          ) : (
            <div style={{ display:'flex', flexDirection:'column', gap:24 }}>
              {programs.map(prog => {
                const meta = PROG_META[prog] || DEFAULT_META
                const progGroups = groups.filter(g => g.program === prog)
                return (
                  <div key={prog}>
                    {/* Program Header */}
                    <div style={{ display:'flex', alignItems:'center', gap:12, marginBottom:16 }}>
                      <span style={{
                        fontSize:12, fontWeight:600, padding:'4px 12px', borderRadius:8,
                        background: meta.bg, color: meta.color,
                        border: `1px solid ${meta.color}20`,
                      }}>
                        {prog}
                      </span>
                      <div style={{ flex:1, height:1, background:'#E8E4F8' }} />
                      <span style={{ fontSize:12, color:'#9CA3AF', fontWeight:500 }}>
                        {progGroups.reduce((s, g) => s + g.count, 0)} courses
                      </span>
                    </div>

                    {/* Cards Grid */}
                    <div style={{ display:'grid', gridTemplateColumns:'repeat(auto-fit, minmax(300px, 1fr))', gap:12 }}>
                      {progGroups.map(g => (
                        <div key={g.key} className="bc-group-card">
                          <div style={{ display: 'flex', gap: 12, alignItems: 'center' }}>
                            <div style={{ width: 4, height: 32, borderRadius: 4, background: meta.color }} />
                            <div>
                              <div style={{ fontSize:14, fontWeight:600, color:'#1E1B4B', marginBottom:2 }}>
                                {ORDINAL(g.yearLevel)} Year
                              </div>
                              <div style={{ fontSize:12, color:'#6B7280' }}>
                                {g.count} course{g.count !== 1 ? 's' : ''}
                              </div>
                            </div>
                          </div>
                          <Stepper
                            value={configs[g.key] ?? ''}
                            onChange={v => setVal(g.key, v)}
                            disabled={applying}
                          />
                        </div>
                      ))}
                    </div>
                  </div>
                )
              })}

              {/* Status Messages */}
              {error && (
                <div style={{ background:'#FEF2F2', border:'1px solid #FECACA', borderRadius:12, padding:'12px 16px', fontSize:13, color:'#DC2626', display:'flex', alignItems:'center', gap:8, fontWeight:500 }}>
                  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"><circle cx="12" cy="12" r="10"/><line x1="12" y1="8" x2="12" y2="12"/><line x1="12" y1="16" x2="12.01" y2="16"/></svg>
                  {error}
                </div>
              )}
              {applyResult && (
                <div style={{ background:'#ECFDF5', border:'1px solid #A7F3D0', borderRadius:12, padding:'12px 16px', fontSize:13, color:'#059669', display:'flex', alignItems:'center', gap:8, fontWeight:500 }}>
                  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"><path d="M22 11.08V12a10 10 0 1 1-5.93-9.14"/><polyline points="22 4 12 14.01 9 11.01"/></svg>
                  Successfully updated {applyResult.updated} course{applyResult.updated !== 1 ? 's' : ''}.
                </div>
              )}
            </div>
          )}
        </div>

        {/* ── Footer ── */}
        <div style={{ padding:'20px 24px', borderTop:'1px solid #F4F2FA', display:'flex', alignItems:'center', gap:12, flexShrink:0, background:'#ffffff', borderRadius:'0 0 20px 20px' }}>
          <p style={{ fontSize:13, color:'#9CA3AF', margin:0, flex:1 }}>
            {applied ? "Sections mapped successfully." : "Apply block configs to courses in this semester."}
          </p>
          
          <button
            onClick={onClose}
            className="bc-cancel-btn"
            style={{ padding:'10px 20px', borderRadius:10, border:'1px solid #E8E4F8', fontFamily:"'Poppins',sans-serif", fontSize:13, fontWeight:500, cursor:'pointer', background:'#fff', color:'#6B7280', transition:'all .2s' }}
          >
            Cancel
          </button>
          
          <button
            onClick={handleApply}
            disabled={applying || loading || groups.length === 0}
            style={{
              display:'inline-flex', alignItems:'center', gap:8, padding:'10px 20px',
              borderRadius:10, border:'none', fontFamily:"'Poppins',sans-serif",
              fontSize:13, fontWeight:600, cursor: applying ? 'not-allowed' : 'pointer',
              background: applied ? '#059669' : '#7C6FCD', color:'#ffffff', 
              boxShadow: applying ? 'none' : applied ? '0 4px 12px rgba(5,150,105,0.25)' : '0 4px 12px rgba(124,111,205,0.25)',
              opacity: applying ? 0.7 : 1, transition:'all .2s',
            }}
          >
            {applying ? (
              <><svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" style={{animation:'bcSpin .8s linear infinite'}}><path d="M21 12a9 9 0 1 1-6.219-8.56"/></svg>Applying...</>
            ) : applied ? (
              <><svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"><polyline points="20 6 9 17 4 12"/></svg>Applied Successfully</>
            ) : (
              <><svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"><path d="M5 12h14"/><path d="m12 5 7 7-7 7"/></svg>Apply Configuration</>
            )}
          </button>
        </div>

      </div>
    </div>
  )
}