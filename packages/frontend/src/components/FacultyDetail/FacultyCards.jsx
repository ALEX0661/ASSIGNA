import { useState, useMemo } from 'react'
import { ACADEMIC_RANKS, DEPARTMENTS, ALL_DAYS, RATING_COLORS, RATING_LABELS, SPECS_PREVIEW, fmtHour, FormField, SectionSaveBtn, StarRating } from './fdShared'

// ─── MiniStar (internal to SpecsGrid) ────────────────────────────────────────
function MiniStar({ filled }) {
  return (
    <svg width="9" height="9" viewBox="0 0 24 24" fill={filled ? '#7C6FCD' : 'none'} stroke={filled ? '#7C6FCD' : '#D8D3F5'} strokeWidth="2">
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
    <div>
      <div style={{ display:'flex', justifyContent:'flex-end', marginBottom:8 }}>
        <div style={{ display:'flex', alignItems:'center', gap:6 }}>
          <span style={{ fontSize:10.5, color:'#B0ABCC', fontWeight:600 }}>Sort:</span>
          {[{key:'rating-desc',label:'Best first'},{key:'code-asc',label:'A – Z'},{key:'rating-asc',label:'Lowest'}].map(opt => (
            <button key={opt.key} type="button" onClick={() => setSortBy(opt.key)} style={{ padding:'2px 8px', borderRadius:6, fontSize:11, fontWeight:sortBy===opt.key?700:500, background:sortBy===opt.key?'#EEEAFB':'transparent', color:sortBy===opt.key?'#7C6FCD':'#B0ABCC', border:sortBy===opt.key?'1px solid #D8D3F5':'1px solid transparent', cursor:'pointer', fontFamily:"'Poppins',sans-serif" }}>{opt.label}</button>
          ))}
        </div>
      </div>
      <div style={{ display:'grid', gridTemplateColumns:'repeat(auto-fill, minmax(168px,1fr))', gap:8 }}>
        {visible.map((spec,i) => {
          const code   = typeof spec==='object' ? spec.courseCode : spec
          const rating = typeof spec==='object' ? (spec.rating||3) : 3
          const title  = typeof spec==='object' ? (spec.title||'') : ''
          return (
            <div key={i} style={{ padding:'9px 11px', borderRadius:10, background:'#FAFAFE', border:'1.5px solid #EDE9FA', display:'flex', flexDirection:'column', gap:4 }}>
              <span style={{ fontSize:11.5, fontWeight:700, color:'#5a4fbf' }}>{code}</span>
              {title && <span style={{ fontSize:10, color:'#8883B0', lineHeight:1.3, overflow:'hidden', textOverflow:'ellipsis', whiteSpace:'nowrap' }}>{title}</span>}
              <div style={{ display:'flex', alignItems:'center', gap:3, marginTop:2 }}>
                {[1,2,3,4,5].map(s => <MiniStar key={s} filled={s<=rating}/>)}
                <span style={{ fontSize:9.5, color:RATING_COLORS[rating]||'#8883B0', fontWeight:700, marginLeft:2 }}>{RATING_LABELS[rating]||''}</span>
              </div>
            </div>
          )
        })}
      </div>
      {specs.length > preview && (
        <button type="button" onClick={onToggle} style={{ marginTop:8, display:'flex', alignItems:'center', gap:5, background:'none', border:'none', cursor:'pointer', padding:0, fontSize:12, fontWeight:600, color:'#7C6FCD', fontFamily:"'Poppins',sans-serif" }}>
          <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="#7C6FCD" strokeWidth="2.5" style={{ transform:expanded?'rotate(180deg)':'none', transition:'transform 0.2s' }}><polyline points="6 9 12 15 18 9"/></svg>
          {expanded ? 'Show less' : `Show ${remaining} more`}
        </button>
      )}
    </div>
  )
}

// ─── ProfileCard ──────────────────────────────────────────────────────────────
export function ProfileCard({ form, isNew, isOverloaded, avInitials, avFg, avBg, statusBg, statusCl, uniqueSpecs, specsExpanded, setSpecsExpanded, specCount, onOpenSpecModal }) {
  return (
    <div style={{ background:'#fff', borderRadius:16, border:'1px solid #E8E4F8', overflow:'hidden', boxShadow:'0 2px 10px rgba(124,111,205,0.06)' }}>
      <div style={{ padding:'24px 20px 20px', display:'flex', flexDirection:'column', alignItems:'center', gap:12 }}>
        <div style={{ width:72, height:72, borderRadius:'50%', background:`linear-gradient(135deg,${avBg},${avBg}cc)`, color:avFg, display:'flex', alignItems:'center', justifyContent:'center', fontSize:24, fontWeight:700, border:`3px solid ${avFg}25`, boxShadow:`0 6px 18px ${avFg}22` }}>{avInitials}</div>
        <div style={{ textAlign:'center' }}>
          <div style={{ fontSize:15, fontWeight:700, color:'#1a1a2e', lineHeight:1.2, marginBottom:3, textTransform:'uppercase' }}>{form.name||(isNew?'New Faculty':'—')}</div>
          {form.AcademicRank && <div style={{ fontSize:11.5, color:'#8883B0', fontWeight:500 }}>{form.AcademicRank}</div>}
          {form.Department   && <div style={{ fontSize:11, color:'#B0ABCC', fontWeight:500, marginTop:2 }}>{form.Department}</div>}
        </div>
        <div style={{ display:'flex', gap:6, flexWrap:'wrap', justifyContent:'center' }}>
          <span style={{ padding:'3px 10px', borderRadius:99, fontSize:10.5, fontWeight:700, background:statusBg, color:statusCl, border:`1px solid ${form.status==='full-time'?'#B8F0DC':'#E8E4F8'}`, textTransform:'capitalize' }}>{form.status}</span>
          {!isNew && form.archived  && <span style={{ padding:'3px 10px', borderRadius:99, fontSize:10.5, fontWeight:700, background:'#FEF3CD', color:'#B45309', border:'1px solid #FDE68A' }}>Archived</span>}
          {!isNew && isOverloaded   && <span style={{ padding:'3px 10px', borderRadius:99, fontSize:10.5, fontWeight:700, background:'#FFE8E8', color:'#C0392B', border:'1px solid #FFCCCC' }}>Overloaded</span>}
        </div>
        <button type="button" onClick={onOpenSpecModal} style={{ display:'inline-flex', alignItems:'center', gap:6, padding:'7px 16px', borderRadius:9, background:'#F5F4FB', color:'#7C6FCD', border:'1.5px solid #E8E4F8', fontSize:12, fontWeight:600, cursor:'pointer', fontFamily:"'Poppins',sans-serif", marginTop:2 }}>
          <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M4 19.5A2.5 2.5 0 0 1 6.5 17H20"/><path d="M6.5 2H20v20H6.5A2.5 2.5 0 0 1 4 19.5v-15A2.5 2.5 0 0 1 6.5 2z"/></svg>
          Manage Specializations
          {specCount > 0 && <span style={{ padding:'0 6px', borderRadius:99, background:'#EEEAFB', color:'#7C6FCD', fontSize:10, fontWeight:700 }}>{specCount}</span>}
        </button>
        {uniqueSpecs.length > 0 && (
          <div style={{ width:'100%', marginTop:4 }}>
            <SpecsGrid specs={uniqueSpecs} preview={SPECS_PREVIEW} expanded={specsExpanded} onToggle={() => setSpecsExpanded(v => !v)}/>
          </div>
        )}
      </div>
    </div>
  )
}

// ─── UnitLoadCard ─────────────────────────────────────────────────────────────
const CAP_RULES = [
  { label:'Part-Time',        cap:'≤ 15 units', color:'#8883B0', bg:'#F5F4FB' },
  { label:'FT · 5+ courses',  cap:'≤ 18 units', color:'#C0392B', bg:'#FFE8E8' },
  { label:'FT · 3-4 courses', cap:'≤ 21 units', color:'#2563EB', bg:'#EBF0FF' },
  { label:'FT · 0-2 courses', cap:'≤ 24 units', color:'#059669', bg:'#E6FAF3' },
]
export function UnitLoadCard({ displayUnits, effectiveCap, isOverloaded, loadPct, tierLabel, scheduleUnits, barBg }) {
  return (
    <div style={{ background:'#fff', borderRadius:16, border:'1px solid #E8E4F8', overflow:'hidden', boxShadow:'0 2px 10px rgba(124,111,205,0.06)' }}>
      <div style={{ padding:'14px 20px', borderBottom:'1px solid #F0EDF9', display:'flex', alignItems:'center', gap:8 }}>
        <div style={{ width:28, height:28, borderRadius:8, background:isOverloaded?'#FFE8E8':'#EEEAFB', display:'flex', alignItems:'center', justifyContent:'center' }}>
          <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke={isOverloaded?'#C0392B':'#7C6FCD'} strokeWidth="2"><polyline points="22 12 18 12 15 21 9 3 6 12 2 12"/></svg>
        </div>
        <span style={{ fontSize:13, fontWeight:700, color:'#1a1a2e', flex:1 }}>Unit Load</span>
        {scheduleUnits !== null && (
          <span style={{ fontSize:9.5, color:'#059669', fontWeight:600, display:'flex', alignItems:'center', gap:3, background:'#E6FAF3', padding:'2px 8px', borderRadius:99, border:'1px solid #A7F3D0' }}>
            <svg width="6" height="6" viewBox="0 0 24 24" fill="#059669"><circle cx="12" cy="12" r="6"/></svg>live
          </span>
        )}
      </div>
      <div style={{ padding:'16px 20px', display:'flex', flexDirection:'column', gap:12 }}>
        <div style={{ display:'flex', alignItems:'flex-end', justifyContent:'space-between' }}>
          <div style={{ display:'flex', alignItems:'baseline', gap:4 }}>
            <span style={{ fontSize:32, fontWeight:800, color:isOverloaded?'#C0392B':'#1a1a2e', lineHeight:1, letterSpacing:'-1px' }}>{displayUnits}</span>
            <span style={{ fontSize:13, color:'#B0ABCC', fontWeight:500, marginBottom:2 }}>/ {effectiveCap}</span>
            <span style={{ fontSize:11, color:'#C0BBDC', marginBottom:2 }}>units</span>
          </div>
          {isOverloaded
            ? <span style={{ fontSize:10, fontWeight:700, padding:'3px 9px', borderRadius:99, background:'#FFE8E8', color:'#C0392B', border:'1px solid #FFCCCC' }}>Over Cap</span>
            : <span style={{ fontSize:10, fontWeight:600, padding:'3px 9px', borderRadius:99, background:'#EEEAFB', color:'#7C6FCD', border:'1px solid #D8D3F5' }}>{Math.round(loadPct)}%</span>
          }
        </div>
        <div style={{ height:5, borderRadius:99, background:'#F0EDF9', overflow:'hidden' }}>
          <div style={{ height:'100%', borderRadius:99, transition:'width 0.5s', width:`${loadPct}%`, background:barBg }}/>
        </div>
        <div style={{ fontSize:10.5, color:'#B0ABCC', lineHeight:1.4 }}>{tierLabel}</div>
        <div style={{ padding:'10px 12px', borderRadius:10, background:'#FAFAFE', border:'1px solid #F0EDF9' }}>
          <div style={{ fontSize:9.5, fontWeight:700, color:'#B0ABCC', textTransform:'uppercase', letterSpacing:'.7px', marginBottom:7 }}>Auto Cap Rules</div>
          <div style={{ display:'flex', flexDirection:'column', gap:5 }}>
            {CAP_RULES.map(r => (
              <div key={r.label} style={{ display:'flex', justifyContent:'space-between', alignItems:'center' }}>
                <span style={{ fontSize:11, color:'#6a6a8a' }}>{r.label}</span>
                <span style={{ fontSize:10.5, fontWeight:700, padding:'1px 8px', borderRadius:99, background:r.bg, color:r.color }}>{r.cap}</span>
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
      <div style={{ background:'#fff', borderRadius:16, border:'1px solid #E8E4F8', overflow:'hidden', boxShadow:'0 2px 10px rgba(124,111,205,0.06)' }}>
        <div style={{ padding:'14px 20px', borderBottom:'1px solid #F0EDF9', display:'flex', alignItems:'center', gap:8 }}>
          <div style={{ width:28, height:28, borderRadius:8, background:'#EEEAFB', display:'flex', alignItems:'center', justifyContent:'center' }}>
            <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="#7C6FCD" strokeWidth="2"><path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2"/><circle cx="12" cy="7" r="4"/></svg>
          </div>
          <span style={{ fontSize:13, fontWeight:700, color:'#1a1a2e', flex:1 }}>Basic Information</span>
          {!isNew && (infoChanged||infoSaving||infoSaved) && <SectionSaveBtn saving={infoSaving} saved={infoSaved} onClick={onSaveInfo}/>}
        </div>
        <div style={{ padding:'18px 20px', display:'grid', gridTemplateColumns:'1fr 1fr', gap:'16px 20px' }}>
          <FormField label="Last Name" required>
            <input value={form.lastName||''} onChange={e => { const v = e.target.value.toUpperCase(); setForm(f => { const ln = v, fn = f.firstName||''; return {...f, lastName:ln, name: ln && fn ? `${ln}, ${fn}` : ln || fn }})}} required style={{ padding:'8px 11px', borderRadius:8, border:'1.5px solid #E8E4F8', fontSize:13, fontFamily:"'Poppins',sans-serif", width:'100%', boxSizing:'border-box', textTransform:'uppercase' }}/>
          </FormField>
          <FormField label="First Name" required>
            <input value={form.firstName||''} onChange={e => { const v = e.target.value.toUpperCase(); setForm(f => { const fn = v, ln = f.lastName||''; return {...f, firstName:fn, name: ln && fn ? `${ln}, ${fn}` : ln || fn }})}} required style={{ padding:'8px 11px', borderRadius:8, border:'1.5px solid #E8E4F8', fontSize:13, fontFamily:"'Poppins',sans-serif", width:'100%', boxSizing:'border-box', textTransform:'uppercase' }}/>
          </FormField>
          <FormField label="Academic Rank">
            <select value={form.AcademicRank||''} onChange={e => setForm(f => ({...f, AcademicRank:e.target.value}))} style={{ padding:'8px 11px', borderRadius:8, border:'1.5px solid #E8E4F8', fontSize:13, fontFamily:"'Poppins',sans-serif", background:'#fff', width:'100%', boxSizing:'border-box' }}>
              <option value="">select...</option>
              {ACADEMIC_RANKS.map(r => <option key={r} value={r}>{r}</option>)}
            </select>
          </FormField>
          <FormField label="Employment Status">
            <select value={form.status} onChange={e => setForm(f => ({...f, status:e.target.value}))} style={{ padding:'8px 11px', borderRadius:8, border:'1.5px solid #E8E4F8', fontSize:13, fontFamily:"'Poppins',sans-serif", background:'#fff', width:'100%', boxSizing:'border-box' }}>
              <option value="full-time">Full-time</option>
              <option value="part-time">Part-time</option>
            </select>
          </FormField>
          <FormField label="Department">
            <select value={form.Department||''} onChange={e => setForm(f => ({...f, Department:e.target.value}))} style={{ padding:'8px 11px', borderRadius:8, border:'1.5px solid #E8E4F8', fontSize:13, fontFamily:"'Poppins',sans-serif", background:'#fff', width:'100%', boxSizing:'border-box' }}>
              <option value="">select...</option>
              {DEPARTMENTS.map(d => <option key={d} value={d}>{d}</option>)}
            </select>
          </FormField>
          <FormField label="Educational Attainment" hint="e.g. Master's Degree, PhD">
            <input type="text" value={form.Educational_attainment||''} onChange={e => setForm(f => ({...f, Educational_attainment:e.target.value}))} placeholder="Enter degree..." style={{ padding:'8px 11px', borderRadius:8, border:'1.5px solid #E8E4F8', fontSize:13, fontFamily:"'Poppins',sans-serif", width:'100%', boxSizing:'border-box' }}/>
          </FormField>
          <FormField label="Sex at Birth">
            <select value={form.SexAtBirth||''} onChange={e => setForm(f => ({...f, SexAtBirth:e.target.value}))} style={{ padding:'8px 11px', borderRadius:8, border:'1.5px solid #E8E4F8', fontSize:13, fontFamily:"'Poppins',sans-serif", background:'#fff', width:'100%', boxSizing:'border-box' }}>
              <option value="">select...</option>
              <option value="Male">Male</option>
              <option value="Female">Female</option>
              <option value="Other">Other / Prefer not to say</option>
            </select>
          </FormField>
        </div>
        {infoError && !isNew && (
          <div style={{ margin:'0 20px 14px', padding:'8px 12px', borderRadius:8, background:'#FFE8E8', border:'1px solid #FFCCCC', display:'flex', gap:6, alignItems:'center' }}>
            <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="#C0392B" strokeWidth="2"><circle cx="12" cy="12" r="10"/><line x1="12" y1="8" x2="12" y2="12"/></svg>
            <span style={{ fontSize:12, color:'#C0392B', fontWeight:500 }}>{infoError}</span>
          </div>
        )}
      </div>

      {isNew && (
        <div style={{ background:'#fff', borderRadius:16, border:'1px solid #E8E4F8', overflow:'hidden', boxShadow:'0 2px 10px rgba(124,111,205,0.06)' }}>
          <div style={{ padding:'14px 20px', borderBottom:'1px solid #F0EDF9', display:'flex', alignItems:'center', gap:8 }}>
            <div style={{ width:28, height:28, borderRadius:8, background:'#F5F4FB', display:'flex', alignItems:'center', justifyContent:'center' }}>
              <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="#7C6FCD" strokeWidth="2"><rect x="3" y="11" width="18" height="11" rx="2"/><path d="M7 11V7a5 5 0 0 1 10 0v4"/></svg>
            </div>
            <span style={{ fontSize:13, fontWeight:700, color:'#1a1a2e', flex:1 }}>Login Credentials</span>
          </div>
          <div style={{ padding:'12px 20px 6px', background:'#EBF0FF', borderBottom:'1px solid #D1E0FF', display:'flex', gap:8, alignItems:'flex-start' }}>
            <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="#2563EB" strokeWidth="2" style={{ flexShrink:0, marginTop:1 }}><circle cx="12" cy="12" r="10"/><line x1="12" y1="8" x2="12" y2="12"/><line x1="12" y1="16" x2="12.01" y2="16"/></svg>
            <span style={{ fontSize:12, color:'#1a4a7c', lineHeight:1.5 }}>These credentials will be used to log in. Password defaults to <strong>[LastName]GC2026</strong> if left blank.</span>
          </div>
          <div style={{ padding:'18px 20px', display:'flex', flexDirection:'column', gap:14 }}>
            <FormField label="Login Email" required hint="Used as the faculty member's login">
              <input type="email" value={form.email||''} onChange={e => setForm(f => ({...f, email:e.target.value}))} autoComplete="off" required style={{ padding:'8px 11px', borderRadius:8, border:'1.5px solid #E8E4F8', fontSize:13, fontFamily:"'Poppins',sans-serif", width:'100%', boxSizing:'border-box' }}/>
            </FormField>
            <FormField label="Password" hint="Leave blank to use [LastName]GC2026">
              <div style={{ display:'flex', gap:8 }}>
                <input type={showPassword?'text':'password'} value={password} onChange={e => setPassword(e.target.value)} autoComplete="new-password" placeholder="Default: [LastName]GC2026" style={{ flex:1, padding:'8px 11px', borderRadius:8, border:'1.5px solid #E8E4F8', fontSize:13, fontFamily:"'Poppins',sans-serif" }}/>
                <button type="button" onClick={() => setShowPassword(v => !v)} style={{ padding:'8px 12px', borderRadius:8, border:'1.5px solid #E8E4F8', background:'#F5F4FB', color:'#8883B0', fontSize:12, cursor:'pointer', fontFamily:"'Poppins',sans-serif" }}>{showPassword?'Hide':'Show'}</button>
                <button type="button" onClick={() => { const ln=(form.name||'').trim().split(/\s+/).pop()||'faculty'; setPassword(ln+'GC2026'); setShowPassword(true) }} style={{ padding:'8px 12px', borderRadius:8, border:'1.5px solid #E8E4F8', background:'#F5F4FB', color:'#7C6FCD', fontSize:12, fontWeight:600, cursor:'pointer', fontFamily:"'Poppins',sans-serif", whiteSpace:'nowrap' }}>Generate</button>
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
    <div style={{ background:'#fff', borderRadius:16, border:'1px solid #E8E4F8', overflow:'hidden', boxShadow:'0 2px 10px rgba(124,111,205,0.06)' }}>
      <div style={{ padding:'14px 20px', borderBottom:'1px solid #F0EDF9', display:'flex', alignItems:'center', gap:8 }}>
        <div style={{ width:28, height:28, borderRadius:8, background:'#EEEAFB', display:'flex', alignItems:'center', justifyContent:'center' }}>
          <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="#7C6FCD" strokeWidth="2"><rect x="3" y="4" width="18" height="18" rx="2"/><line x1="16" y1="2" x2="16" y2="6"/><line x1="8" y1="2" x2="8" y2="6"/><line x1="3" y1="10" x2="21" y2="10"/></svg>
        </div>
        <span style={{ fontSize:13, fontWeight:700, color:'#1a1a2e', flex:1 }}>Schedule Preferences</span>
        {!isNew && (prefsChanged||prefSaving||prefSaved) && <SectionSaveBtn saving={prefSaving} saved={prefSaved} onClick={onSavePrefs}/>}
      </div>
      <div style={{ padding:'18px 20px', display:'flex', flexDirection:'column', gap:18 }}>
        <FormField label="Preferred Teaching Days">
          <div style={{ display:'flex', gap:6, flexWrap:'wrap', marginTop:2 }}>
            {ALL_DAYS.map(day => {
              const active = form.preferredDays.includes(day)
              return <button key={day} type="button" onClick={() => toggleDay(day)} style={{ padding:'5px 13px', fontSize:12, borderRadius:20, fontFamily:"'Poppins',sans-serif", background:active?'linear-gradient(135deg,#7C6FCD,#5a4fbf)':'#F5F4FB', color:active?'#fff':'#8883B0', border:active?'none':'1.5px solid #E8E4F8', cursor:'pointer', fontWeight:active?600:500 }}>{day.slice(0,3)}</button>
            })}
          </div>
        </FormField>
        <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr', gap:'16px 20px' }}>
          {[['Preferred Start','preferredTimeStart',6,20],['Preferred End','preferredTimeEnd',7,21]].map(([label,key,min,max]) => (
            <FormField key={key} label={label}>
              <div style={{ position:'relative' }}>
                <input type="number" min={min} max={max} step={0.5} value={form[key]} onChange={e => setForm(f => ({...f,[key]:Number(e.target.value)}))} style={{ padding:'8px 11px', borderRadius:8, border:'1.5px solid #E8E4F8', fontSize:13, fontFamily:"'Poppins',sans-serif", width:'100%', boxSizing:'border-box' }}/>
                <span style={{ position:'absolute', right:10, top:'50%', transform:'translateY(-50%)', fontSize:10.5, color:'#B0ABCC', pointerEvents:'none', fontWeight:600 }}>{fmtHour(form[key])}</span>
              </div>
            </FormField>
          ))}
        </div>
      </div>
      {prefError && !isNew && (
        <div style={{ margin:'0 20px 14px', padding:'8px 12px', borderRadius:8, background:'#FFE8E8', border:'1px solid #FFCCCC', display:'flex', gap:6, alignItems:'center' }}>
          <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="#C0392B" strokeWidth="2"><circle cx="12" cy="12" r="10"/><line x1="12" y1="8" x2="12" y2="12"/></svg>
          <span style={{ fontSize:12, color:'#C0392B', fontWeight:500 }}>{prefError}</span>
        </div>
      )}
    </div>
  )
}

// ─── CredentialsCard ──────────────────────────────────────────────────────────
export function CredentialsCard({ form, credEmail, setCredEmail, credPassword, setCredPassword, credConfirm, setCredConfirm, showCredPwd, setShowCredPwd, credSaving, credError, credSuccess, onSave }) {
  const generate = () => { const ln=(form.name||'').trim().split(/\s+/).pop()||'faculty'; setCredPassword(ln+'GC2026'); setCredConfirm(ln+'GC2026'); setShowCredPwd(true) }
  return (
    <div style={{ background:'#fff', borderRadius:16, border:'1px solid #E8E4F8', overflow:'hidden', boxShadow:'0 2px 10px rgba(124,111,205,0.06)' }}>
      <div style={{ padding:'14px 20px', borderBottom:'1px solid #F0EDF9', display:'flex', alignItems:'center', gap:8 }}>
        <div style={{ width:28, height:28, borderRadius:8, background:'#F5F4FB', display:'flex', alignItems:'center', justifyContent:'center' }}>
          <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="#7C6FCD" strokeWidth="2"><rect x="3" y="11" width="18" height="11" rx="2"/><path d="M7 11V7a5 5 0 0 1 10 0v4"/></svg>
        </div>
        <span style={{ fontSize:13, fontWeight:700, color:'#1a1a2e', flex:1 }}>Login Credentials</span>
        {form.email
          ? <span style={{ fontSize:10.5, fontWeight:700, padding:'2px 8px', borderRadius:99, background:'#E6FAF3', color:'#059669' }}>Active</span>
          : <span style={{ fontSize:10.5, fontWeight:700, padding:'2px 8px', borderRadius:99, background:'#FFE8E8', color:'#C0392B' }}>Not Activated</span>
        }
      </div>
      {!form.email && (
        <div style={{ margin:'14px 20px 0', padding:'10px 14px', borderRadius:8, background:'#FFF8E8', border:'1px solid #FFE4A0', display:'flex', gap:8, alignItems:'flex-start' }}>
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="#92400E" strokeWidth="2" style={{ flexShrink:0, marginTop:1 }}><path d="M10.29 3.86L1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z"/><line x1="12" y1="9" x2="12" y2="13"/><line x1="12" y1="17" x2="12.01" y2="17"/></svg>
          <span style={{ fontSize:11.5, color:'#92400E', lineHeight:1.5 }}>No login account yet. Set email and password below to activate.</span>
        </div>
      )}
      <div style={{ padding:'18px 20px', display:'grid', gridTemplateColumns:'1fr 1fr 1fr', gap:'16px 24px', alignItems:'start' }}>
        <FormField label="Login Email" hint={form.email?'Change the email used to sign in':'Required — will be used as login'}>
          <input type="email" value={credEmail} onChange={e => setCredEmail(e.target.value)} autoComplete="off" style={{ padding:'8px 11px', borderRadius:8, border:'1.5px solid #E8E4F8', fontSize:13, fontFamily:"'Poppins',sans-serif", width:'100%', boxSizing:'border-box' }}/>
        </FormField>
        <FormField label="New Password" hint={form.email?'Leave blank to keep current':'Auto-generated if blank'}>
          <div style={{ display:'flex', gap:6 }}>
            <input type={showCredPwd?'text':'password'} value={credPassword} onChange={e => setCredPassword(e.target.value)} autoComplete="new-password" placeholder={form.email?'Leave blank to keep current':'Auto-generated if blank'} style={{ flex:1, padding:'8px 11px', borderRadius:8, border:'1.5px solid #E8E4F8', fontSize:13, fontFamily:"'Poppins',sans-serif", minWidth:0 }}/>
            <button type="button" onClick={() => setShowCredPwd(v => !v)} style={{ padding:'8px 10px', borderRadius:8, border:'1.5px solid #E8E4F8', background:'#F5F4FB', color:'#8883B0', fontSize:11, cursor:'pointer', fontFamily:"'Poppins',sans-serif", flexShrink:0 }}>{showCredPwd?'Hide':'Show'}</button>
            <button type="button" onClick={generate} style={{ padding:'8px 10px', borderRadius:8, border:'1.5px solid #E8E4F8', background:'#F5F4FB', color:'#7C6FCD', fontSize:11, fontWeight:600, cursor:'pointer', fontFamily:"'Poppins',sans-serif", flexShrink:0, whiteSpace:'nowrap' }}>Generate</button>
          </div>
        </FormField>
        <div style={{ display:'flex', flexDirection:'column', gap:8 }}>
          {credPassword && (
            <FormField label="Confirm Password">
              <input type={showCredPwd?'text':'password'} value={credConfirm} onChange={e => setCredConfirm(e.target.value)} autoComplete="new-password" placeholder="Re-enter password" style={{ padding:'8px 11px', borderRadius:8, border:`1.5px solid ${credConfirm&&credConfirm!==credPassword?'#FFCCCC':'#E8E4F8'}`, fontSize:13, fontFamily:"'Poppins',sans-serif", width:'100%', boxSizing:'border-box' }}/>
              {credConfirm && credConfirm!==credPassword && <span style={{ fontSize:11, color:'#C0392B', marginTop:3, display:'block' }}>Passwords do not match</span>}
            </FormField>
          )}
          <div style={{ paddingTop:credPassword?0:20 }}>
            <button type="button" onClick={onSave} disabled={credSaving} style={{ display:'inline-flex', alignItems:'center', justifyContent:'center', gap:6, padding:'9px 20px', borderRadius:9, border:'none', fontFamily:"'Poppins',sans-serif", fontSize:12.5, fontWeight:600, cursor:credSaving?'default':'pointer', background:'linear-gradient(135deg,#7C6FCD,#5a4fbf)', color:'#fff', boxShadow:'0 3px 12px rgba(124,111,205,0.28)', opacity:credSaving?0.65:1, whiteSpace:'nowrap' }}>
              <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"><rect x="3" y="11" width="18" height="11" rx="2"/><path d="M7 11V7a5 5 0 0 1 10 0v4"/></svg>
              {credSaving?'Saving...':(form.email?'Update Credentials':'Activate Account')}
            </button>
            {credSuccess && <span style={{ fontSize:12, color:'#059669', fontWeight:600, display:'flex', alignItems:'center', gap:5, marginTop:8 }}><svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="#059669" strokeWidth="2.5"><polyline points="20 6 9 17 4 12"/></svg>{credSuccess}</span>}
            {credError && <div style={{ padding:'8px 12px', borderRadius:8, background:'#FFE8E8', border:'1px solid #FFCCCC', display:'flex', gap:6, alignItems:'center', marginTop:8 }}><svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="#C0392B" strokeWidth="2"><circle cx="12" cy="12" r="10"/><line x1="12" y1="8" x2="12" y2="12"/></svg><span style={{ fontSize:12, color:'#C0392B', fontWeight:500 }}>{credError}</span></div>}
          </div>
        </div>
      </div>
    </div>
  )
}
