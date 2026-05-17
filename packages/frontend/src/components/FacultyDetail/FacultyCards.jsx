import { useState, useMemo } from 'react'
import { ACADEMIC_RANKS, DEPARTMENTS, ALL_DAYS, RATING_COLORS, RATING_LABELS, SPECS_PREVIEW, fmtHour, FormField, SectionSaveBtn, StarRating } from './fdShared'

// ─── Theme Tokens (Lavender & White) ──────────────────────────────────────────
const T = {
  purple:       '#7C6FCD',
  purpleDeep:   '#5a4fbf',
  purpleSoft:   '#EEEAFB',
  purpleBorder: '#D8D3F5',
  textMain:     '#1a1a2e',
  textMid:      '#4a4a6a',
  textMuted:    '#8883B0',
  textLight:    '#B0ABCC',
  border:       '#E8E4F8',
  borderLight:  '#F5F4FB',
  bg:           '#FFFFFF',
  bgAlt:        '#FAFAFE',
  danger:       '#EF4444',
  dangerSoft:   '#FEF2F2',
};

// ─── MiniStar (internal to SpecsGrid) ────────────────────────────────────────
function MiniStar({ filled }) {
  return (
    <svg width="10" height="10" viewBox="0 0 24 24" fill={filled ? T.purple : 'none'} stroke={filled ? T.purple : T.purpleBorder} strokeWidth="2">
      <polygon points="12 2 15.09 8.26 22 9.27 17 14.14 18.18 21.02 12 17.77 5.82 21.02 7 14.14 2 9.27 8.91 8.26 12 2"/>
    </svg>
  )
}

// ─── SpecsGrid (internal to ProfileCard) ─────────────────────────────────────
function SpecsGrid({ specs, preview, expanded, onToggle }) {
  const [sortBy, setSortBy] = useState('rating-desc')
  const sorted = useMemo(() => {
    const copy = [...specs]
    if (sortBy === 'code-asc')    copy.sort((a,b) => ((typeof a==='object' ? a.courseCode : a)||'').localeCompare((typeof b==='object' ? b.courseCode : b)||''))
    if (sortBy === 'rating-desc') copy.sort((a,b) => ((typeof b==='object' ? b.rating : 3)||3) - ((typeof a==='object' ? a.rating : 3)||3))
    if (sortBy === 'rating-asc')  copy.sort((a,b) => ((typeof a==='object' ? a.rating : 3)||3) - ((typeof b==='object' ? b.rating : 3)||3))
    return copy
  }, [specs, sortBy])
  const visible   = expanded ? sorted : sorted.slice(0, preview)
  const remaining = specs.length - preview
  
  return (
    <div style={{ fontFamily: "'Poppins', sans-serif" }}>
      <div style={{ display:'flex', justifyContent:'flex-end', marginBottom:10 }}>
        <div style={{ display:'flex', alignItems:'center', gap:6 }}>
          <span style={{ fontSize:11, color:T.textLight, fontWeight:600 }}>Sort:</span>
          {[{key:'rating-desc',label:'Best first'},{key:'code-asc',label:'A – Z'},{key:'rating-asc',label:'Lowest'}].map(opt => (
            <button key={opt.key} type="button" onClick={() => setSortBy(opt.key)} style={{ 
              padding:'4px 10px', borderRadius:'8px', fontSize:11, fontWeight:600, 
              background:sortBy===opt.key ? T.purpleSoft : 'transparent', 
              color:sortBy===opt.key ? T.purpleDeep : T.textMuted, 
              border:sortBy===opt.key ? `1px solid ${T.purpleBorder}` : '1px solid transparent', 
              cursor:'pointer', transition: 'all 0.2s', fontFamily:"'Poppins',sans-serif" 
            }}>
              {opt.label}
            </button>
          ))}
        </div>
      </div>
      <div style={{ display:'grid', gridTemplateColumns:'repeat(auto-fill, minmax(168px,1fr))', gap:10 }}>
        {visible.map((spec,i) => {
          const code   = typeof spec==='object' ? spec.courseCode : spec
          const rating = typeof spec==='object' ? (spec.rating||3) : 3
          const title  = typeof spec==='object' ? (spec.title||'') : ''
          return (
            <div key={i} style={{ padding:'10px 14px', borderRadius:'10px', background:T.bgAlt, border:`1px solid ${T.border}`, display:'flex', flexDirection:'column', gap:4 }}>
              <span style={{ fontSize:12, fontWeight:700, color:T.purpleDeep }}>{code}</span>
              {title && <span style={{ fontSize:11, color:T.textMuted, lineHeight:1.3, overflow:'hidden', textOverflow:'ellipsis', whiteSpace:'nowrap', fontWeight: 500 }}>{title}</span>}
              <div style={{ display:'flex', alignItems:'center', gap:3, marginTop:4 }}>
                {[1,2,3,4,5].map(s => <MiniStar key={s} filled={s<=rating}/>)}
                <span style={{ fontSize:10, color:RATING_COLORS[rating]||T.textMuted, fontWeight:700, marginLeft:4 }}>{RATING_LABELS[rating]||''}</span>
              </div>
            </div>
          )
        })}
      </div>
      {specs.length > preview && (
        <button type="button" onClick={onToggle} style={{ marginTop:12, display:'flex', alignItems:'center', gap:6, background:'none', border:'none', cursor:'pointer', padding:0, fontSize:12, fontWeight:600, color:T.purple, fontFamily:"'Poppins',sans-serif" }}>
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" style={{ transform:expanded?'rotate(180deg)':'none', transition:'transform 0.2s' }}><polyline points="6 9 12 15 18 9"/></svg>
          {expanded ? 'Show less' : `Show ${remaining} more`}
        </button>
      )}
    </div>
  )
}

// ─── ProfileCard ──────────────────────────────────────────────────────────────
export function ProfileCard({ form, isNew, isOverloaded, avInitials, avFg, avBg, statusBg, statusCl, uniqueSpecs, specsExpanded, setSpecsExpanded, specCount, onOpenSpecModal }) {
  return (
    <div style={{ background:T.bg, borderRadius:'16px', border:`1px solid ${T.border}`, overflow:'hidden', boxShadow:'0 4px 20px rgba(124,111,205,0.04)', fontFamily: "'Poppins', sans-serif" }}>
      <div style={{ padding:'28px 24px 24px', display:'flex', flexDirection:'column', alignItems:'center', gap:16 }}>
        <div style={{ width:80, height:80, borderRadius:'50%', background:`linear-gradient(135deg,${avBg},${avBg}cc)`, color:avFg, display:'flex', alignItems:'center', justifyContent:'center', fontSize:28, fontWeight:700, border:`4px solid ${avFg}15` }}>{avInitials}</div>
        <div style={{ textAlign:'center' }}>
          <div style={{ fontSize:16, fontWeight:700, color:T.textMain, lineHeight:1.2, marginBottom:4, textTransform:'uppercase' }}>{form.name||(isNew?'New Faculty':'—')}</div>
          {form.AcademicRank && <div style={{ fontSize:13, color:T.textMuted, fontWeight:500 }}>{form.AcademicRank}</div>}
          {form.Department   && <div style={{ fontSize:12, color:T.textLight, fontWeight:500, marginTop:2 }}>{form.Department}</div>}
        </div>
        <div style={{ display:'flex', gap:8, flexWrap:'wrap', justifyContent:'center' }}>
          <span style={{ padding:'4px 12px', borderRadius:'99px', fontSize:11, fontWeight:600, background:statusBg, color:statusCl, textTransform:'capitalize' }}>{form.status}</span>
          {!isNew && form.archived  && <span style={{ padding:'4px 12px', borderRadius:'99px', fontSize:11, fontWeight:600, background:'#FFFBEB', color:'#B45309', border:'1px solid #FEF3C7' }}>Archived</span>}
          {!isNew && isOverloaded   && <span style={{ padding:'4px 12px', borderRadius:'99px', fontSize:11, fontWeight:600, background:T.dangerSoft, color:T.danger, border:`1px solid #FECACA` }}>Overloaded</span>}
        </div>
        <button type="button" onClick={onOpenSpecModal} style={{ display:'inline-flex', alignItems:'center', gap:8, padding:'8px 16px', borderRadius:'8px', background:T.bgAlt, color:T.purpleDeep, border:`1px solid ${T.border}`, fontSize:12, fontWeight:600, cursor:'pointer', fontFamily:"'Poppins',sans-serif", marginTop:4, transition: 'all 0.2s' }}>
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M4 19.5A2.5 2.5 0 0 1 6.5 17H20"/><path d="M6.5 2H20v20H6.5A2.5 2.5 0 0 1 4 19.5v-15A2.5 2.5 0 0 1 6.5 2z"/></svg>
          Manage Specializations
          {specCount > 0 && <span style={{ padding:'2px 8px', borderRadius:'99px', background:T.purpleSoft, color:T.purpleDeep, fontSize:10, fontWeight:700 }}>{specCount}</span>}
        </button>
      </div>
    </div>
  )
}

// ─── UnitLoadCard (Cleaned Up Auto Caps) ──────────────────────────────────────
const CLEAN_CAP_RULES = [
  { label: 'Part-Time Faculty',     cap: 'Max 15 units' },
  { label: 'Full-Time (5+ courses)',cap: 'Max 18 units' },
  { label: 'Full-Time (3-4 courses)',cap: 'Max 21 units' },
  { label: 'Full-Time (0-2 courses)',cap: 'Max 24 units' },
];

export function UnitLoadCard({ displayUnits, effectiveCap, isOverloaded, loadPct, tierLabel, scheduleUnits, barBg }) {
  return (
    <div style={{ background:T.bg, borderRadius:'16px', border:`1px solid ${T.border}`, overflow:'hidden', boxShadow:'0 4px 20px rgba(124,111,205,0.04)', fontFamily: "'Poppins', sans-serif" }}>
      {/* Header */}
      <div style={{ padding:'16px 20px', borderBottom:`1px solid ${T.borderLight}`, display:'flex', alignItems:'center', gap:10, background:T.bgAlt }}>
        <div style={{ width:30, height:30, borderRadius:'8px', background:isOverloaded?T.dangerSoft:T.purpleSoft, display:'flex', alignItems:'center', justifyContent:'center' }}>
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke={isOverloaded?T.danger:T.purple} strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><polyline points="22 12 18 12 15 21 9 3 6 12 2 12"/></svg>
        </div>
        <span style={{ fontSize:14, fontWeight:700, color:T.textMain, flex:1 }}>Unit Load</span>
        {scheduleUnits !== null && (
          <span style={{ fontSize:11, color:T.purpleDeep, fontWeight:600, display:'flex', alignItems:'center', gap:5, background:T.purpleSoft, padding:'4px 10px', borderRadius:'99px' }}>
            <span style={{ width: 6, height: 6, borderRadius: '50%', background: T.purpleDeep }}></span>
            Live Schedule
          </span>
        )}
      </div>

      {/* Body */}
      <div style={{ padding:'24px 20px', display:'flex', flexDirection:'column', gap:20 }}>
        {/* Number Display */}
        <div style={{ display:'flex', alignItems:'flex-end', justifyContent:'space-between' }}>
          <div style={{ display:'flex', alignItems:'baseline', gap:6 }}>
            <span style={{ fontSize:36, fontWeight:700, color:isOverloaded?T.danger:T.textMain, lineHeight:1 }}>{displayUnits}</span>
            <span style={{ fontSize:14, color:T.textMuted, fontWeight:500 }}>/ {effectiveCap} <span style={{ fontSize: 12 }}>units</span></span>
          </div>
          {isOverloaded
            ? <span style={{ fontSize:11, fontWeight:700, padding:'4px 10px', borderRadius:'6px', background:T.dangerSoft, color:T.danger }}>Over Cap</span>
            : <span style={{ fontSize:11, fontWeight:700, padding:'4px 10px', borderRadius:'6px', background:T.purpleSoft, color:T.purpleDeep }}>{Math.round(loadPct)}%</span>
          }
        </div>
        
        {/* Progress Bar */}
        <div>
          <div style={{ height:6, borderRadius:99, background:T.borderLight, overflow:'hidden', marginBottom: 8 }}>
            <div style={{ height:'100%', borderRadius:99, transition:'width 0.5s ease', width:`${Math.min(loadPct, 100)}%`, background: isOverloaded ? T.danger : T.purple }}/>
          </div>
          <div style={{ fontSize:12, color:T.textMuted, fontWeight:500 }}>{tierLabel}</div>
        </div>

        {/* Clean Auto Cap Rules (Replaces the messy rainbow pills) */}
        <div style={{ marginTop: 4, paddingTop: 20, borderTop: `1px solid ${T.borderLight}` }}>
          <div style={{ fontSize:11, fontWeight:700, color:T.textLight, textTransform:'uppercase', letterSpacing:'0.05em', marginBottom:12 }}>
            Auto Cap Limits
          </div>
          <div style={{ display:'flex', flexDirection:'column', gap:10 }}>
            {CLEAN_CAP_RULES.map(r => (
              <div key={r.label} style={{ display:'flex', justifyContent:'space-between', alignItems:'center' }}>
                <span style={{ fontSize:12, color:T.textMid, fontWeight: 500 }}>{r.label}</span>
                <span style={{ fontSize:12, fontWeight:600, color:T.purpleDeep }}>{r.cap}</span>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  )
}

// ─── BasicInfoCard ────────────────────────────────────────────────────────────
export function BasicInfoCard({ form, setForm, isNew, infoChanged, infoSaving, infoSaved, infoError, onSaveInfo, password, setPassword, showPassword, setShowPassword }) {
  return (
    <>
      <div style={{ background:T.bg, borderRadius:'16px', border:`1px solid ${T.border}`, overflow:'hidden', boxShadow:'0 4px 20px rgba(124,111,205,0.04)', fontFamily: "'Poppins', sans-serif" }}>
        <div style={{ padding:'16px 20px', borderBottom:`1px solid ${T.borderLight}`, display:'flex', alignItems:'center', gap:10, background: T.bgAlt }}>
          <div style={{ width:30, height:30, borderRadius:'8px', background:T.purpleSoft, display:'flex', alignItems:'center', justifyContent:'center' }}>
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke={T.purple} strokeWidth="2"><path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2"/><circle cx="12" cy="7" r="4"/></svg>
          </div>
          <span style={{ fontSize:14, fontWeight:700, color:T.textMain, flex:1 }}>Basic Information</span>
          {!isNew && (infoChanged||infoSaving||infoSaved) && <SectionSaveBtn saving={infoSaving} saved={infoSaved} onClick={onSaveInfo}/>}
        </div>
        <div style={{ padding:'24px 20px', display:'grid', gridTemplateColumns:'1fr 1fr', gap:'20px 24px' }}>
          <FormField label="Last Name" required>
            <input value={form.lastName||''} onChange={e => { const v = e.target.value.toUpperCase(); setForm(f => { const ln = v, fn = f.firstName||''; return {...f, lastName:ln, name: ln && fn ? `${ln}, ${fn}` : ln || fn }})}} required style={{ padding:'10px 14px', borderRadius:'8px', border:`1px solid ${T.border}`, fontSize:13, fontFamily:"'Poppins',sans-serif", width:'100%', boxSizing:'border-box', textTransform:'uppercase', outline:'none' }}/>
          </FormField>
          <FormField label="First Name" required>
            <input value={form.firstName||''} onChange={e => { const v = e.target.value.toUpperCase(); setForm(f => { const fn = v, ln = f.lastName||''; return {...f, firstName:fn, name: ln && fn ? `${ln}, ${fn}` : ln || fn }})}} required style={{ padding:'10px 14px', borderRadius:'8px', border:`1px solid ${T.border}`, fontSize:13, fontFamily:"'Poppins',sans-serif", width:'100%', boxSizing:'border-box', textTransform:'uppercase', outline:'none' }}/>
          </FormField>
          <FormField label="Academic Rank">
            <select value={form.AcademicRank||''} onChange={e => setForm(f => ({...f, AcademicRank:e.target.value}))} style={{ padding:'10px 14px', borderRadius:'8px', border:`1px solid ${T.border}`, fontSize:13, fontFamily:"'Poppins',sans-serif", background:T.bg, width:'100%', boxSizing:'border-box', outline:'none', color: T.textMain }}>
              <option value="">Select rank...</option>
              {ACADEMIC_RANKS.map(r => <option key={r} value={r}>{r}</option>)}
            </select>
          </FormField>
          <FormField label="Employment Status">
            <select value={form.status} onChange={e => setForm(f => ({...f, status:e.target.value}))} style={{ padding:'10px 14px', borderRadius:'8px', border:`1px solid ${T.border}`, fontSize:13, fontFamily:"'Poppins',sans-serif", background:T.bg, width:'100%', boxSizing:'border-box', outline:'none', color: T.textMain }}>
              <option value="full-time">Full-time</option>
              <option value="part-time">Part-time</option>
            </select>
          </FormField>
          <FormField label="Department">
            <select value={form.Department||''} onChange={e => setForm(f => ({...f, Department:e.target.value}))} style={{ padding:'10px 14px', borderRadius:'8px', border:`1px solid ${T.border}`, fontSize:13, fontFamily:"'Poppins',sans-serif", background:T.bg, width:'100%', boxSizing:'border-box', outline:'none', color: T.textMain }}>
              <option value="">Select department...</option>
              {DEPARTMENTS.map(d => <option key={d} value={d}>{d}</option>)}
            </select>
          </FormField>
          <FormField label="Educational Attainment" hint="e.g. Master's Degree, PhD">
            <input type="text" value={form.Educational_attainment||''} onChange={e => setForm(f => ({...f, Educational_attainment:e.target.value}))} placeholder="Enter degree..." style={{ padding:'10px 14px', borderRadius:'8px', border:`1px solid ${T.border}`, fontSize:13, fontFamily:"'Poppins',sans-serif", width:'100%', boxSizing:'border-box', outline:'none' }}/>
          </FormField>
          <FormField label="Sex at Birth">
            <select value={form.SexAtBirth||''} onChange={e => setForm(f => ({...f, SexAtBirth:e.target.value}))} style={{ padding:'10px 14px', borderRadius:'8px', border:`1px solid ${T.border}`, fontSize:13, fontFamily:"'Poppins',sans-serif", background:T.bg, width:'100%', boxSizing:'border-box', outline:'none', color: T.textMain }}>
              <option value="">Select...</option>
              <option value="Male">Male</option>
              <option value="Female">Female</option>
              <option value="Other">Other / Prefer not to say</option>
            </select>
          </FormField>
        </div>
        {infoError && !isNew && (
          <div style={{ margin:'0 20px 20px', padding:'10px 14px', borderRadius:'8px', background:T.dangerSoft, border:'1px solid #FECACA', display:'flex', gap:8, alignItems:'center' }}>
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke={T.danger} strokeWidth="2"><circle cx="12" cy="12" r="10"/><line x1="12" y1="8" x2="12" y2="12"/></svg>
            <span style={{ fontSize:12, color:T.danger, fontWeight:500 }}>{infoError}</span>
          </div>
        )}
      </div>

      {isNew && (
        <div style={{ background:T.bg, borderRadius:'16px', border:`1px solid ${T.border}`, overflow:'hidden', boxShadow:'0 4px 20px rgba(124,111,205,0.04)', fontFamily: "'Poppins', sans-serif" }}>
          <div style={{ padding:'16px 20px', borderBottom:`1px solid ${T.borderLight}`, display:'flex', alignItems:'center', gap:10, background:T.bgAlt }}>
            <div style={{ width:30, height:30, borderRadius:'8px', background:T.purpleSoft, display:'flex', alignItems:'center', justifyContent:'center' }}>
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke={T.purple} strokeWidth="2"><rect x="3" y="11" width="18" height="11" rx="2"/><path d="M7 11V7a5 5 0 0 1 10 0v4"/></svg>
            </div>
            <span style={{ fontSize:14, fontWeight:700, color:T.textMain, flex:1 }}>Login Credentials</span>
          </div>
          <div style={{ padding:'14px 20px', background:'#F8FAFC', borderBottom:`1px solid ${T.borderLight}`, display:'flex', gap:10, alignItems:'flex-start' }}>
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="#3B82F6" strokeWidth="2" style={{ flexShrink:0, marginTop:2 }}><circle cx="12" cy="12" r="10"/><line x1="12" y1="8" x2="12" y2="12"/><line x1="12" y1="16" x2="12.01" y2="16"/></svg>
            <span style={{ fontSize:12, color:'#334155', lineHeight:1.5 }}>These credentials will be used to log in. Password defaults to <strong>[LastName]GC2026</strong> if left blank.</span>
          </div>
          <div style={{ padding:'24px 20px', display:'flex', flexDirection:'column', gap:20 }}>
            <FormField label="Login Email" required hint="Used as the faculty member's login">
              <input type="email" value={form.email||''} onChange={e => setForm(f => ({...f, email:e.target.value}))} autoComplete="off" required style={{ padding:'10px 14px', borderRadius:'8px', border:`1px solid ${T.border}`, fontSize:13, fontFamily:"'Poppins',sans-serif", width:'100%', boxSizing:'border-box', outline:'none' }}/>
            </FormField>
            <FormField label="Password" hint="Leave blank to use [LastName]GC2026">
              <div style={{ display:'flex', gap:8 }}>
                <input type={showPassword?'text':'password'} value={password} onChange={e => setPassword(e.target.value)} autoComplete="new-password" placeholder="Default: [LastName]GC2026" style={{ flex:1, padding:'10px 14px', borderRadius:'8px', border:`1px solid ${T.border}`, fontSize:13, fontFamily:"'Poppins',sans-serif", outline:'none' }}/>
                <button type="button" onClick={() => setShowPassword(v => !v)} style={{ padding:'10px 16px', borderRadius:'8px', border:`1px solid ${T.border}`, background:T.bgAlt, color:T.textMuted, fontSize:12, fontWeight: 600, cursor:'pointer', fontFamily:"'Poppins',sans-serif", transition: 'all 0.2s' }}>{showPassword?'Hide':'Show'}</button>
                <button type="button" onClick={() => { const ln=(form.name||'').trim().split(/\s+/).pop()||'faculty'; setPassword(ln+'GC2026'); setShowPassword(true) }} style={{ padding:'10px 16px', borderRadius:'8px', border:`1px solid ${T.purpleBorder}`, background:T.purpleSoft, color:T.purpleDeep, fontSize:12, fontWeight:600, cursor:'pointer', fontFamily:"'Poppins',sans-serif", whiteSpace:'nowrap', transition: 'all 0.2s' }}>Generate</button>
              </div>
            </FormField>
          </div>
        </div>
      )}
    </>
  )
}

// ─── SchedulePrefsCard ────────────────────────────────────────────────────────
export function SchedulePrefsCard({ form, setForm, isNew, prefsChanged, prefSaving, prefSaved, prefError, onSavePrefs }) {
  const toggleDay = day => setForm(f => ({ ...f, preferredDays: f.preferredDays.includes(day) ? f.preferredDays.filter(d => d!==day) : [...f.preferredDays, day] }))
  return (
    <div style={{ background:T.bg, borderRadius:'16px', border:`1px solid ${T.border}`, overflow:'hidden', boxShadow:'0 4px 20px rgba(124,111,205,0.04)', fontFamily: "'Poppins', sans-serif" }}>
      <div style={{ padding:'16px 20px', borderBottom:`1px solid ${T.borderLight}`, display:'flex', alignItems:'center', gap:10, background:T.bgAlt }}>
        <div style={{ width:30, height:30, borderRadius:'8px', background:T.purpleSoft, display:'flex', alignItems:'center', justifyContent:'center' }}>
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke={T.purple} strokeWidth="2"><rect x="3" y="4" width="18" height="18" rx="2"/><line x1="16" y1="2" x2="16" y2="6"/><line x1="8" y1="2" x2="8" y2="6"/><line x1="3" y1="10" x2="21" y2="10"/></svg>
        </div>
        <span style={{ fontSize:14, fontWeight:700, color:T.textMain, flex:1 }}>Schedule Preferences</span>
        {!isNew && (prefsChanged||prefSaving||prefSaved) && <SectionSaveBtn saving={prefSaving} saved={prefSaved} onClick={onSavePrefs}/>}
      </div>
      <div style={{ padding:'24px 20px', display:'flex', flexDirection:'column', gap:24 }}>
        <FormField label="Preferred Teaching Days">
          <div style={{ display:'flex', gap:8, flexWrap:'wrap', marginTop:4 }}>
            {ALL_DAYS.map(day => {
              const active = form.preferredDays.includes(day)
              return <button key={day} type="button" onClick={() => toggleDay(day)} style={{ padding:'6px 16px', fontSize:12, borderRadius:'99px', fontFamily:"'Poppins',sans-serif", background:active?T.purpleSoft:T.bgAlt, color:active?T.purpleDeep:T.textMuted, border:active?`1px solid ${T.purpleBorder}`:`1px solid ${T.border}`, cursor:'pointer', fontWeight:600, transition: 'all 0.2s' }}>{day.slice(0,3)}</button>
            })}
          </div>
        </FormField>
        <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr', gap:'20px 24px' }}>
          {[['Preferred Start','preferredTimeStart',6,20],['Preferred End','preferredTimeEnd',7,21]].map(([label,key,min,max]) => (
            <FormField key={key} label={label}>
              <div style={{ position:'relative' }}>
                <input type="number" min={min} max={max} step={0.5} value={form[key]} onChange={e => setForm(f => ({...f,[key]:Number(e.target.value)}))} style={{ padding:'10px 14px', borderRadius:'8px', border:`1px solid ${T.border}`, fontSize:13, fontFamily:"'Poppins',sans-serif", width:'100%', boxSizing:'border-box', outline:'none' }}/>
                <span style={{ position:'absolute', right:14, top:'50%', transform:'translateY(-50%)', fontSize:11, color:T.textLight, pointerEvents:'none', fontWeight:600 }}>{fmtHour(form[key])}</span>
              </div>
            </FormField>
          ))}
        </div>
      </div>
      {prefError && !isNew && (
        <div style={{ margin:'0 20px 20px', padding:'10px 14px', borderRadius:'8px', background:T.dangerSoft, border:'1px solid #FECACA', display:'flex', gap:8, alignItems:'center' }}>
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke={T.danger} strokeWidth="2"><circle cx="12" cy="12" r="10"/><line x1="12" y1="8" x2="12" y2="12"/></svg>
          <span style={{ fontSize:12, color:T.danger, fontWeight:500 }}>{prefError}</span>
        </div>
      )}
    </div>
  )
}

// ─── CredentialsCard ──────────────────────────────────────────────────────────
export function CredentialsCard({ form, credEmail, setCredEmail, credPassword, setCredPassword, credConfirm, setCredConfirm, showCredPwd, setShowCredPwd, credSaving, credError, credSuccess, onSave }) {
  const generate = () => { const ln=(form.name||'').trim().split(/\s+/).pop()||'faculty'; setCredPassword(ln+'GC2026'); setCredConfirm(ln+'GC2026'); setShowCredPwd(true) }
  return (
    <div style={{ background:T.bg, borderRadius:'16px', border:`1px solid ${T.border}`, overflow:'hidden', boxShadow:'0 4px 20px rgba(124,111,205,0.04)', fontFamily: "'Poppins', sans-serif" }}>
      <div style={{ padding:'16px 20px', borderBottom:`1px solid ${T.borderLight}`, display:'flex', alignItems:'center', gap:10, background:T.bgAlt }}>
        <div style={{ width:30, height:30, borderRadius:'8px', background:T.purpleSoft, display:'flex', alignItems:'center', justifyContent:'center' }}>
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke={T.purple} strokeWidth="2"><rect x="3" y="11" width="18" height="11" rx="2"/><path d="M7 11V7a5 5 0 0 1 10 0v4"/></svg>
        </div>
        <span style={{ fontSize:14, fontWeight:700, color:T.textMain, flex:1 }}>Login Credentials</span>
        {form.email
          ? <span style={{ fontSize:11, fontWeight:700, padding:'4px 12px', borderRadius:'99px', background:'#F0FDF4', color:'#166534' }}>Active Account</span>
          : <span style={{ fontSize:11, fontWeight:700, padding:'4px 12px', borderRadius:'99px', background:T.dangerSoft, color:T.danger }}>Not Activated</span>
        }
      </div>
      {!form.email && (
        <div style={{ margin:'20px 20px 0', padding:'12px 16px', borderRadius:'8px', background:'#FFFBEB', border:'1px solid #FEF3C7', display:'flex', gap:10, alignItems:'flex-start' }}>
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="#D97706" strokeWidth="2" style={{ flexShrink:0, marginTop:2 }}><path d="M10.29 3.86L1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z"/><line x1="12" y1="9" x2="12" y2="13"/><line x1="12" y1="17" x2="12.01" y2="17"/></svg>
          <span style={{ fontSize:12, color:'#B45309', lineHeight:1.5 }}>No login account yet. Set an email and password below to activate.</span>
        </div>
      )}
      <div style={{ padding:'24px 20px', display:'grid', gridTemplateColumns:'1fr 1fr 1fr', gap:'20px 24px', alignItems:'start' }}>
        <FormField label="Login Email" hint={form.email?'Change the email used to sign in':'Required — will be used as login'}>
          <input type="email" value={credEmail} onChange={e => setCredEmail(e.target.value)} autoComplete="off" style={{ padding:'10px 14px', borderRadius:'8px', border:`1px solid ${T.border}`, fontSize:13, fontFamily:"'Poppins',sans-serif", width:'100%', boxSizing:'border-box', outline:'none' }}/>
        </FormField>
        <FormField label="New Password" hint={form.email?'Leave blank to keep current':'Auto-generated if blank'}>
          <div style={{ display:'flex', gap:8 }}>
            <input type={showCredPwd?'text':'password'} value={credPassword} onChange={e => setCredPassword(e.target.value)} autoComplete="new-password" placeholder={form.email?'Leave blank to keep current':'Auto-generated if blank'} style={{ flex:1, padding:'10px 14px', borderRadius:'8px', border:`1px solid ${T.border}`, fontSize:13, fontFamily:"'Poppins',sans-serif", minWidth:0, outline:'none' }}/>
            <button type="button" onClick={() => setShowCredPwd(v => !v)} style={{ padding:'10px 14px', borderRadius:'8px', border:`1px solid ${T.border}`, background:T.bgAlt, color:T.textMuted, fontSize:12, fontWeight:600, cursor:'pointer', fontFamily:"'Poppins',sans-serif", flexShrink:0, transition: 'all 0.2s' }}>{showCredPwd?'Hide':'Show'}</button>
            <button type="button" onClick={generate} style={{ padding:'10px 14px', borderRadius:'8px', border:`1px solid ${T.purpleBorder}`, background:T.purpleSoft, color:T.purpleDeep, fontSize:12, fontWeight:600, cursor:'pointer', fontFamily:"'Poppins',sans-serif", flexShrink:0, whiteSpace:'nowrap', transition: 'all 0.2s' }}>Generate</button>
          </div>
        </FormField>
        <div style={{ display:'flex', flexDirection:'column', gap:10 }}>
          {credPassword && (
            <FormField label="Confirm Password">
              <input type={showCredPwd?'text':'password'} value={credConfirm} onChange={e => setCredConfirm(e.target.value)} autoComplete="new-password" placeholder="Re-enter password" style={{ padding:'10px 14px', borderRadius:'8px', border:`1px solid ${credConfirm&&credConfirm!==credPassword?'#FECACA':T.border}`, fontSize:13, fontFamily:"'Poppins',sans-serif", width:'100%', boxSizing:'border-box', outline:'none' }}/>
              {credConfirm && credConfirm!==credPassword && <span style={{ fontSize:11, color:T.danger, marginTop:4, display:'block', fontWeight: 500 }}>Passwords do not match</span>}
            </FormField>
          )}
          <div style={{ paddingTop:credPassword?0:24 }}>
            <button type="button" onClick={onSave} disabled={credSaving} style={{ display:'inline-flex', alignItems:'center', justifyContent:'center', gap:8, padding:'12px 24px', borderRadius:'8px', border:'none', fontFamily:"'Poppins',sans-serif", fontSize:13, fontWeight:600, cursor:credSaving?'default':'pointer', background:T.purple, color:'#fff', boxShadow:'0 4px 14px rgba(124,111,205,0.25)', opacity:credSaving?0.7:1, whiteSpace:'nowrap', width: '100%', transition: 'all 0.2s' }}>
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"><rect x="3" y="11" width="18" height="11" rx="2"/><path d="M7 11V7a5 5 0 0 1 10 0v4"/></svg>
              {credSaving?'Saving...':(form.email?'Update Credentials':'Activate Account')}
            </button>
            {credSuccess && <span style={{ fontSize:12, color:'#166534', fontWeight:600, display:'flex', alignItems:'center', gap:6, marginTop:12 }}><svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="#166534" strokeWidth="2.5"><polyline points="20 6 9 17 4 12"/></svg>{credSuccess}</span>}
            {credError && <div style={{ padding:'10px 14px', borderRadius:'8px', background:T.dangerSoft, border:'1px solid #FECACA', display:'flex', gap:8, alignItems:'center', marginTop:12 }}><svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke={T.danger} strokeWidth="2"><circle cx="12" cy="12" r="10"/><line x1="12" y1="8" x2="12" y2="12"/></svg><span style={{ fontSize:12, color:T.danger, fontWeight:500 }}>{credError}</span></div>}
          </div>
        </div>
      </div>
    </div>
  )
}