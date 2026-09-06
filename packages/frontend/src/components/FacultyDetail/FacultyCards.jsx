import { useState, useMemo, useEffect } from 'react'
import { ACADEMIC_RANKS, DEPARTMENTS, ALL_DAYS, RATING_COLORS, RATING_LABELS, fmtHour, FormField, SectionSaveBtn, StarRating } from './fdShared'

// Add spin animation
if (!document.getElementById('role-spin-animation')) {
  const style = document.createElement('style')
  style.id = 'role-spin-animation'
  style.textContent = '@keyframes spin { 0%{transform:rotate(0deg)} 100%{transform:rotate(360deg)} }'
  document.head.appendChild(style)
}

// ─── Theme Tokens (Green — matches admin theme) ───────────────────────────────
const T = {
  green: 'var(--meadow, var(--meadow))',
  greenDeep:    'var(--meadow-deep)',
  greenMid:     'var(--meadow-mid)',
  greenSoft:    'var(--meadow-soft)',
  greenBorder:  'var(--meadow-border)',
  textMain:     'var(--ink)',
  textMid:      'var(--ink2, #1C3D2A)',
  textMuted: 'var(--muted, #4B7060)',
  textLight: 'var(--muted2, #6B8C7A)',
  border:       'var(--border)',
  borderLight:  'var(--hover)',
  bg: 'var(--surface, #FFFFFF)',
  bgAlt: 'var(--bg, #F2F7F4)',
  danger:       '#EF4444',
  dangerSoft:   'rgba(239, 68, 68, 0.05)',
  // card header — soft green tint, not dark
  headerBg:     'var(--meadow-soft)',
  headerBorder: 'var(--meadow-border)',
  headerText:   'var(--ink)',
  headerMuted: 'var(--muted, #4B7060)',
  headerIcon: 'var(--meadow, var(--meadow))',
}

// Reusable card header — soft green tint, no icon
function CardHeader({ title, right, sub }) {
  return (
    <div style={{
      padding:'14px 20px',
      background: T.headerBg,
      borderBottom:`1.5px solid ${T.headerBorder}`,
      display:'flex', alignItems:'center', gap:12,
    }}>
      <div style={{ flex:1, minWidth:0 }}>
        <span style={{ fontSize:13.5, fontWeight:700, color:T.headerText, display:'block', fontFamily:"'Sora',sans-serif" }}>{title}</span>
        {sub && <span style={{ fontSize:11, color:T.headerMuted, marginTop:1, display:'block' }}>{sub}</span>}
      </div>
      {right && <div style={{ flexShrink:0 }}>{right}</div>}
    </div>
  )
}

// ─── ProfileCard ──────────────────────────────────────────────────────────────
export function ProfileCard({ form, isNew, isOverloaded, avInitials, avFg, avBg, statusBg, statusCl, specCount, onOpenSpecModal }) {
  return (
    <div style={{ background:T.bg, borderRadius:'16px', border:`1px solid ${T.border}`, overflow:'hidden', boxShadow:'0 4px 20px rgba(0,0,0,0.08)', fontFamily:"'Inter',sans-serif" }}>

      {/* Avatar header — gradient green, not full dark */}
      <div style={{ background:`linear-gradient(160deg,var(--meadow-mid) 0%,var(--meadow-deep) 100%)`, padding:'28px 24px 20px', display:'flex', flexDirection:'column', alignItems:'center', gap:12, position:'relative', overflow:'hidden' }}>
        <div style={{ position:'absolute', top:-30, right:-30, width:100, height:100, borderRadius:'50%', background:'rgba(255,255,255,0.05)', pointerEvents:'none' }}/>
        <div style={{ position:'absolute', bottom:-20, left:-14, width:72, height:72, borderRadius:'50%', background:'rgba(255,255,255,0.04)', pointerEvents:'none' }}/>

        {/* Avatar */}
        <div style={{ width:72, height:72, borderRadius:'50%', background:`linear-gradient(135deg,${avBg},${avBg}bb)`, color:avFg, display:'flex', alignItems:'center', justifyContent:'center', fontSize:24, fontWeight:700, border:`3px solid rgba(255,255,255,0.3)`, fontFamily:"'Sora',sans-serif", position:'relative', zIndex:1, boxShadow:'0 4px 16px rgba(0,0,0,0.2)' }}>
          {avInitials}
        </div>

        {/* Name */}
        <div style={{ textAlign:'center', position:'relative', zIndex:1, maxWidth:'100%' }}>
          <div style={{ fontSize:15, fontWeight:700, color: '#fff', lineHeight:1.25, marginBottom:3, textTransform:'uppercase', fontFamily:"'Sora',sans-serif", letterSpacing:'0.5px', overflow:'hidden', textOverflow:'ellipsis', whiteSpace:'nowrap', maxWidth:220 }}>
            {form.name||(isNew?'New Faculty':'—')}
          </div>
          {form.AcademicRank && <div style={{ fontSize:12, color:'rgba(255,255,255,0.78)', fontWeight:500 }}>{form.AcademicRank}</div>}
          {form.Department   && <div style={{ fontSize:11, color:'rgba(255,255,255,0.55)', fontWeight:400, marginTop:2 }}>{form.Department}</div>}
        </div>

        {/* Status badges */}
        <div style={{ display:'flex', gap:6, flexWrap:'wrap', justifyContent:'center', position:'relative', zIndex:1 }}>
          <span style={{ padding:'3px 10px', borderRadius:'99px', fontSize:10.5, fontWeight:600, background:'rgba(255,255,255,0.16)', color: '#fff', textTransform:'capitalize', border:'1px solid rgba(255,255,255,0.22)' }}>{form.status}</span>
          {!isNew && form.archived  && <span style={{ padding:'3px 10px', borderRadius:'99px', fontSize:10.5, fontWeight:600, background:'rgba(217, 119, 6, 0.1)', color:'#F59E0B' }}>Archived</span>}
          {!isNew && isOverloaded   && <span style={{ padding:'3px 10px', borderRadius:'99px', fontSize:10.5, fontWeight:600, background:'rgba(220, 38, 38, 0.1)', color:'#EF4444' }}>Overloaded</span>}
        </div>
      </div>

      {/* Manage Specializations button */}
      <div style={{ padding:'16px 20px' }}>
        <button type="button" onClick={onOpenSpecModal}
          style={{ display:'flex', alignItems:'center', justifyContent:'space-between', width:'100%', padding:'10px 14px', borderRadius:'10px', background:T.bgAlt, color:T.greenDeep, border:`1.5px solid ${T.border}`, fontSize:12.5, fontWeight:600, cursor:'pointer', fontFamily:"'Inter',sans-serif", transition:'all 0.2s' }}
          onMouseEnter={e => { e.currentTarget.style.background=T.greenSoft; e.currentTarget.style.borderColor=T.greenBorder }}
          onMouseLeave={e => { e.currentTarget.style.background=T.bgAlt; e.currentTarget.style.borderColor=T.border }}>
          <span style={{ display:'flex', alignItems:'center', gap:8 }}>
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M4 19.5A2.5 2.5 0 0 1 6.5 17H20"/><path d="M6.5 2H20v20H6.5A2.5 2.5 0 0 1 4 19.5v-15A2.5 2.5 0 0 1 6.5 2z"/></svg>
            Manage Specializations
          </span>
          <span style={{ display:'flex', alignItems:'center', gap:6 }}>
            {specCount > 0 && (
              <span style={{ padding:'2px 8px', borderRadius:'99px', background:T.greenSoft, color:T.greenDeep, fontSize:10.5, fontWeight:700, border:`1px solid ${T.greenBorder}` }}>{specCount}</span>
            )}
            <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"><polyline points="9 18 15 12 9 6"/></svg>
          </span>
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
    <div style={{ flex:1, background:T.bg, borderRadius:'16px', border:`1px solid ${T.border}`, overflow:'hidden', boxShadow:'0 4px 20px rgba(0,0,0,0.08)', fontFamily:"'Inter',sans-serif" }}>
      <CardHeader
        title={isOverloaded ? 'Unit Load — Over Cap' : 'Unit Load'}
        sub={isOverloaded ? `${displayUnits} units assigned — exceeds cap of ${effectiveCap}` : `${displayUnits} / ${effectiveCap} units`}
        right={scheduleUnits !== null ? (
          <span style={{ fontSize:11, color:'rgba(255,255,255,0.85)', fontWeight:600, display:'flex', alignItems:'center', gap:5, background:'rgba(255,255,255,0.18)', padding:'3px 10px', borderRadius:'99px', border:'1px solid rgba(255,255,255,0.25)' }}>
            <span style={{ width:6, height:6, borderRadius:'50%', background:'var(--meadow-border)' }}/>
            Live
          </span>
        ) : undefined}
      />

      {/* Body */}
      <div style={{ padding:'24px 20px', display:'flex', flexDirection:'column', gap:20 }}>
        {/* Number Display */}
        <div style={{ display:'flex', alignItems:'flex-end', justifyContent:'space-between' }}>
          <div style={{ display:'flex', alignItems:'baseline', gap:6 }}>
            <span style={{ fontSize:36, fontWeight:800, color:isOverloaded?T.danger:T.textMain, lineHeight:1, fontFamily:"'Sora',sans-serif" }}>{displayUnits}</span>
            <span style={{ fontSize:14, color:T.textMuted, fontWeight:500 }}>/ {effectiveCap} <span style={{ fontSize: 12 }}>units</span></span>
          </div>
          {isOverloaded
            ? <span style={{ fontSize:11, fontWeight:700, padding:'4px 10px', borderRadius:'6px', background:T.dangerSoft, color:T.danger }}>Over Cap</span>
            : <span style={{ fontSize:11, fontWeight:700, padding:'4px 10px', borderRadius:'6px', background:T.greenSoft, color:T.greenDeep }}>{Math.round(loadPct)}%</span>
          }
        </div>
        
        {/* Progress Bar */}
        <div>
          <div style={{ height:6, borderRadius:99, background:T.borderLight, overflow:'hidden', marginBottom: 8 }}>
            <div style={{ height:'100%', borderRadius:99, transition:'width 0.5s ease', width:`${Math.min(loadPct, 100)}%`, background: isOverloaded ? T.danger : T.green }}/>
          </div>
          <div style={{ fontSize:12, color:T.textMuted, fontWeight:500 }}>{tierLabel}</div>
        </div>

        {/* Auto Cap Rules */}
        <div style={{ marginTop: 4, paddingTop: 20, borderTop: `1px solid ${T.borderLight}` }}>
          <div style={{ fontSize:11, fontWeight:700, color:T.textLight, textTransform:'uppercase', letterSpacing:'0.05em', marginBottom:12 }}>
            Auto Cap Limits
          </div>
          <div style={{ display:'flex', flexDirection:'column', gap:10 }}>
            {CLEAN_CAP_RULES.map(r => (
              <div key={r.label} style={{ display:'flex', justifyContent:'space-between', alignItems:'center' }}>
                <span style={{ fontSize:12, color:T.textMid, fontWeight: 500 }}>{r.label}</span>
                <span style={{ fontSize:12, fontWeight:600, color:T.green }}>{r.cap}</span>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  )
}

// ─── BasicInfoCard ────────────────────────────────────────────────────────────
export function BasicInfoCard({ form, setForm, isNew, infoChanged, infoSaving, infoSaved, infoError, onSaveInfo, password, setPassword, showPassword, setShowPassword, facultyId }) {
  // Role management state (only for existing faculty)
  // Roles are independent toggles now — a user can be Admin, Faculty, or both at once.
  // Valid combos: Admin, Faculty, Admin+Faculty, Faculty+Coordinator.
  // Invalid: Coordinator alone, Admin+Coordinator, Admin+Faculty+Coordinator.
  const [roleLoading, setRoleLoading] = useState(!isNew)
  const [roleSaving, setRoleSaving] = useState(false)
  const [currentIsAdmin, setCurrentIsAdmin] = useState(false)
  const [currentIsFaculty, setCurrentIsFaculty] = useState(true)
  const [isCoordinator, setIsCoordinator] = useState(false)
  const [coordinatorProgram, setCoordinatorProgram] = useState('')
  const [selectedIsAdmin, setSelectedIsAdmin] = useState(false)
  const [selectedIsFaculty, setSelectedIsFaculty] = useState(true)
  const [selectedCoordinator, setSelectedCoordinator] = useState(false)
  const [selectedProgram, setSelectedProgram] = useState('')
  const [roleError, setRoleError] = useState('')
  const [roleSuccess, setRoleSuccess] = useState('')

  const PROGRAMS = ['BSCS', 'BSIT', 'BSEMC-GD', 'BSEMC-DAT']
  // Deans/Assistant Deans usually also hold Admin access — surfaced as a one-click
  // suggestion in the Role & Permissions section, never applied automatically.
  const rankSuggestsAdmin = form.AcademicRank === 'Dean' || form.AcademicRank === 'Assistant Dean'

  // Derive isAdmin/isFaculty from whatever shape the API returns (explicit booleans,
  // an array of roles, or a legacy single 'admin'/'faculty' string).
  function parseRoleData(data) {
    if (typeof data.isAdmin === 'boolean' || typeof data.isFaculty === 'boolean') {
      return { isAdmin: !!data.isAdmin, isFaculty: !!data.isFaculty }
    }
    const roleVal = data.role
    if (Array.isArray(roleVal)) {
      return { isAdmin: roleVal.includes('admin'), isFaculty: roleVal.includes('faculty') }
    }
    if (typeof roleVal === 'string' && roleVal.includes(',')) {
      const parts = roleVal.split(',').map(s => s.trim())
      return { isAdmin: parts.includes('admin'), isFaculty: parts.includes('faculty') }
    }
    return { isAdmin: roleVal === 'admin', isFaculty: roleVal === 'faculty' || roleVal == null }
  }

  // Load role for existing faculty
  useEffect(() => {
    if (isNew || !facultyId) return
    
    async function loadRole() {
      try {
        const { getFacultyRole } = await import('../../services/api')
        const data = await getFacultyRole(facultyId)
        const { isAdmin, isFaculty } = parseRoleData(data)
        setCurrentIsAdmin(isAdmin); setSelectedIsAdmin(isAdmin)
        setCurrentIsFaculty(isFaculty); setSelectedIsFaculty(isFaculty)
        setIsCoordinator(data.isCoordinator || false); setSelectedCoordinator(data.isCoordinator || false)
        setCoordinatorProgram(data.coordinatorProgram || ''); setSelectedProgram(data.coordinatorProgram || '')
      } catch (err) {
        setCurrentIsAdmin(false); setSelectedIsAdmin(false)
        setCurrentIsFaculty(true); setSelectedIsFaculty(true)
        setIsCoordinator(false); setSelectedCoordinator(false)
        setCoordinatorProgram(''); setSelectedProgram('')
      } finally {
        setRoleLoading(false)
      }
    }
    loadRole()
  }, [facultyId, isNew])

  function toggleAdmin() {
    const next = !selectedIsAdmin
    setSelectedIsAdmin(next)
    if (next) { 
      setSelectedIsFaculty(false)
      setSelectedCoordinator(false)
      setSelectedProgram('') 
    }
  }

  function toggleFaculty() {
    const next = !selectedIsFaculty
    setSelectedIsFaculty(next)
    if (next) {
      setSelectedIsAdmin(false)
    }
    // Coordinator requires Faculty — turning Faculty off clears Coordinator.
    if (!next) { setSelectedCoordinator(false); setSelectedProgram('') }
  }

  const roleHasChanges = !isNew && (selectedIsAdmin !== currentIsAdmin ||
                                     selectedIsFaculty !== currentIsFaculty ||
                                     selectedCoordinator !== isCoordinator ||
                                     selectedProgram !== coordinatorProgram)

  async function handleSaveRole() {
    setRoleError('')
    setRoleSuccess('')

    if (!selectedIsAdmin && !selectedIsFaculty) {
      setRoleError('Select at least one role (Admin or Faculty).')
      return
    }
    if (selectedCoordinator && selectedIsAdmin) {
      setRoleError('Coordinator access cannot be combined with Admin.')
      return
    }
    if (selectedCoordinator && !selectedIsFaculty) {
      setRoleError('Coordinator access requires the Faculty role.')
      return
    }
    if (selectedCoordinator && !selectedProgram) {
      setRoleError('Please select a program for the coordinator.')
      return
    }
    
    setRoleSaving(true)
    try {
      const { setFacultyRole } = await import('../../services/api')
      await setFacultyRole(facultyId, { isAdmin: selectedIsAdmin, isFaculty: selectedIsFaculty, isCoordinator: selectedCoordinator, coordinatorProgram: selectedProgram || null })
      setCurrentIsAdmin(selectedIsAdmin)
      setCurrentIsFaculty(selectedIsFaculty)
      setIsCoordinator(selectedCoordinator)
      setCoordinatorProgram(selectedProgram)
      setRoleSuccess(`Role updated${selectedCoordinator ? ` as ${selectedProgram} Coordinator` : ''}. User must log out and back in.`)
      setTimeout(() => setRoleSuccess(''), 4000)
    } catch (err) {
      setRoleError(err.response?.data?.detail || 'Failed to update role.')
    } finally {
      setRoleSaving(false)
    }
  }

  function formatRoleBadge() {
    const parts = []
    if (currentIsAdmin) parts.push('Admin')
    if (currentIsFaculty) parts.push('Faculty')
    let label = parts.join(' + ') || 'No Role'
    if (isCoordinator && coordinatorProgram) label += ` · ${coordinatorProgram} Coord.`
    return label
  }

  return (
    <>
      <div style={{ flex:1, background:T.bg, borderRadius:'16px', border:`1px solid ${T.border}`, overflow:'hidden', boxShadow:'0 4px 20px rgba(0,0,0,0.08)', fontFamily: "'Inter', sans-serif" }}>
        <CardHeader
          title="Basic Information"
          right={!isNew && (infoChanged||infoSaving||infoSaved) ? <SectionSaveBtn saving={infoSaving} saved={infoSaved} onClick={onSaveInfo}/> : undefined}
        />
        <div style={{ padding:'24px 20px', display:'grid', gridTemplateColumns:'1fr 1fr', gap:'20px 24px' }}>
          <FormField label="Last Name" required>
            <input value={form.lastName||''} onChange={e => { const v = e.target.value.toUpperCase(); setForm(f => { const ln = v, fn = f.firstName||''; return {...f, lastName:ln, name: ln && fn ? `${ln}, ${fn}` : ln || fn }})}} required style={{ padding:'10px 14px', borderRadius:'8px', border:`1px solid ${T.border}`, fontSize:13, fontFamily:"'Inter',sans-serif", width:'100%', boxSizing:'border-box', textTransform:'uppercase', outline:'none', background:T.bg, color:T.textMain }}/>
          </FormField>
          <FormField label="First Name" required>
            <input value={form.firstName||''} onChange={e => { const v = e.target.value.toUpperCase(); setForm(f => { const fn = v, ln = f.lastName||''; return {...f, firstName:fn, name: ln && fn ? `${ln}, ${fn}` : ln || fn }})}} required style={{ padding:'10px 14px', borderRadius:'8px', border:`1px solid ${T.border}`, fontSize:13, fontFamily:"'Inter',sans-serif", width:'100%', boxSizing:'border-box', textTransform:'uppercase', outline:'none', background:T.bg, color:T.textMain }}/>
          </FormField>
          <FormField label="Academic Rank">
            <select value={form.AcademicRank||''} onChange={e => setForm(f => ({...f, AcademicRank:e.target.value}))} style={{ padding:'10px 14px', borderRadius:'8px', border:`1px solid ${T.border}`, fontSize:13, fontFamily:"'Inter',sans-serif", background:T.bg, width:'100%', boxSizing:'border-box', outline:'none', color: T.textMain }}>
              <option value="">Select rank...</option>
              {ACADEMIC_RANKS.map(r => <option key={r} value={r}>{r}</option>)}
            </select>
          </FormField>
          <FormField label="Employment Status">
            <select value={form.status} onChange={e => setForm(f => ({...f, status:e.target.value}))} style={{ padding:'10px 14px', borderRadius:'8px', border:`1px solid ${T.border}`, fontSize:13, fontFamily:"'Inter',sans-serif", background:T.bg, width:'100%', boxSizing:'border-box', outline:'none', color: T.textMain }}>
              <option value="full-time">Full-time</option>
              <option value="part-time">Part-time</option>
            </select>
          </FormField>
          <FormField label="Department">
            <select value={form.Department||''} onChange={e => setForm(f => ({...f, Department:e.target.value}))} style={{ padding:'10px 14px', borderRadius:'8px', border:`1px solid ${T.border}`, fontSize:13, fontFamily:"'Inter',sans-serif", background:T.bg, width:'100%', boxSizing:'border-box', outline:'none', color: T.textMain }}>
              <option value="">Select department...</option>
              {DEPARTMENTS.map(d => <option key={d} value={d}>{d}</option>)}
            </select>
          </FormField>
          <FormField label="Educational Attainment" hint="e.g. Master's Degree, PhD">
            <input type="text" value={form.Educational_attainment||''} onChange={e => setForm(f => ({...f, Educational_attainment:e.target.value}))} placeholder="Enter degree..." style={{ padding:'10px 14px', borderRadius:'8px', border:`1px solid ${T.border}`, fontSize:13, fontFamily:"'Inter',sans-serif", width:'100%', boxSizing:'border-box', outline:'none', background:T.bg, color:T.textMain }}/>
          </FormField>
          <FormField label="Sex at Birth">
            <select value={form.SexAtBirth||''} onChange={e => setForm(f => ({...f, SexAtBirth:e.target.value}))} style={{ padding:'10px 14px', borderRadius:'8px', border:`1px solid ${T.border}`, fontSize:13, fontFamily:"'Inter',sans-serif", background:T.bg, width:'100%', boxSizing:'border-box', outline:'none', color: T.textMain }}>
              <option value="">Select...</option>
              <option value="Male">Male</option>
              <option value="Female">Female</option>
              <option value="Other">Other / Prefer not to say</option>
            </select>
          </FormField>
        </div>

        {/* ── Role & Permissions — edit mode only ── */}
        {!isNew && (
          <div style={{ margin:'0 20px', paddingTop:20, borderTop:`1px solid ${T.borderLight}`, marginBottom:20 }}>
            {/* Sub-header */}
            <div style={{ display:'flex', alignItems:'center', gap:8, marginBottom:14 }}>
              <div style={{ width:28, height:28, borderRadius:'7px', background:`linear-gradient(135deg,${T.green},${T.greenDeep})`, display:'flex', alignItems:'center', justifyContent:'center', flexShrink:0 }}>
                <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="#fff" strokeWidth="2.2"><path d="M12 2L2 7l10 5 10-5-10-5z"/><path d="M2 17l10 5 10-5"/><path d="M2 12l10 5 10-5"/></svg>
              </div>
              <span style={{ fontSize:13, fontWeight:700, color:T.textMain, flex:1 }}>Role & Permissions</span>
              {!roleLoading && (currentIsAdmin || currentIsFaculty) && (
                <span style={{ fontSize:10, fontWeight:700, padding:'3px 10px', borderRadius:'99px', background: currentIsAdmin ? 'rgba(217, 119, 6, 0.1)' : T.greenSoft, color: currentIsAdmin ? '#F59E0B' : T.greenDeep, border:`1px solid ${currentIsAdmin?'rgba(245, 158, 11, 0.25)':T.greenBorder}` }}>
                  {formatRoleBadge()}
                </span>
              )}
            </div>

            {roleLoading ? (
              <div style={{ padding:'8px 0 4px', color:T.textMuted, fontSize:12 }}>Loading...</div>
            ) : (
              <div style={{ display:'flex', flexDirection:'column', gap:14 }}>
                {/* Role toggle — Admin and Faculty are independent, not mutually exclusive */}
                <div>
                  <div style={{ fontSize:11, fontWeight:600, color:T.textMuted, letterSpacing:'.3px', marginBottom:7, textTransform:'uppercase' }}>System Role</div>
                  <div style={{ display:'flex', gap:8 }}>
                    {[
                      { key:'faculty', label:'Faculty', active:selectedIsFaculty, onClick:toggleFaculty, icon:<svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2"/><circle cx="12" cy="7" r="4"/></svg> },
                      { key:'admin',   label:'Admin',   active:selectedIsAdmin,   onClick:toggleAdmin,   icon:<svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M12 2L2 7l10 5 10-5-10-5z"/><path d="M2 17l10 5 10-5"/><path d="M2 12l10 5 10-5"/></svg> },
                    ].map(opt => (
                        <button key={opt.key} type="button"
                          onClick={opt.onClick}
                          style={{ flex:1, padding:'9px 12px', borderRadius:'9px', fontSize:12.5, fontFamily:"'Inter',sans-serif", background: opt.active ? `linear-gradient(135deg,${T.green},${T.greenDeep})` : T.bgAlt, color: opt.active ? '#fff' : T.textMuted, border: opt.active ? 'none' : `1.5px solid ${T.border}`, cursor:'pointer', fontWeight:600, transition:'all 0.18s', display:'flex', alignItems:'center', justifyContent:'center', gap:7, boxShadow: opt.active ? `0 3px 10px rgba(0,0,0,0.28)` : 'none' }}
                        >
                          {opt.icon}{opt.label}
                        </button>
                      ))}
                  </div>
                  <div style={{ fontSize:10.5, color:T.textMuted, marginTop:6 }}>Admin and Faculty are mutually exclusive.</div>
                </div>

                {/* Rank-based suggestion — never auto-applied, just a one-click nudge */}
                {rankSuggestsAdmin && !selectedIsAdmin && (
                  <div style={{ display:'flex', alignItems:'center', gap:10, padding:'10px 14px', borderRadius:'9px', background:'#FEFBEB', border:'1px solid #FDE68A' }}>
                    <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke='#F59E0B' strokeWidth="2" style={{ flexShrink:0 }}><path d="M9 18h6"/><path d="M10 22h4"/><path d="M12 2a7 7 0 0 0-4 12.7V17h8v-2.3A7 7 0 0 0 12 2z"/></svg>
                    <div style={{ flex:1, fontSize:11.5, color:'#92400E', lineHeight:1.4 }}><strong>{form.AcademicRank}</strong> usually comes with Admin access.</div>
                    <button type="button" onClick={() => setSelectedIsAdmin(true)}
                      style={{ flexShrink:0, padding:'6px 12px', borderRadius:'7px', border:'1px solid #D97706', background: 'var(--surface)', color:'#F59E0B', fontSize:11.5, fontWeight:600, cursor:'pointer', fontFamily:"'Inter',sans-serif" }}
                    >Apply</button>
                  </div>
                )}

                {/* Coordinator toggle — only for Faculty, never combined with Admin */}
                {selectedIsFaculty && !selectedIsAdmin && (
                  <div>
                    <div style={{ fontSize:11, fontWeight:600, color:T.textMuted, letterSpacing:'.3px', marginBottom:7, textTransform:'uppercase' }}>Coordinator Access</div>
                    <label style={{ display:'flex', alignItems:'center', gap:12, padding:'11px 14px', borderRadius:'9px', background: selectedCoordinator ? T.greenSoft : T.bgAlt, border: selectedCoordinator ? `1.5px solid ${T.greenBorder}` : `1.5px solid ${T.border}`, cursor:'pointer', transition:'all 0.18s' }}>
                      <input type="checkbox" checked={selectedCoordinator} onChange={e => setSelectedCoordinator(e.target.checked)} style={{ width:15, height:15, cursor:'pointer', accentColor:T.green }} />
                      <div style={{ flex:1 }}>
                        <div style={{ fontSize:12.5, fontWeight:600, color: selectedCoordinator ? T.greenDeep : T.textMain }}>Program Coordinator</div>
                        <div style={{ fontSize:10.5, color:T.textMuted, marginTop:1 }}>Can log in as Coordinator or Faculty</div>
                      </div>
                    </label>
                  </div>
                )}
                {selectedIsAdmin && (
                  <div>
                    <div style={{ fontSize:11, fontWeight:600, color:T.textMuted, letterSpacing:'.3px', marginBottom:7, textTransform:'uppercase' }}>Coordinator Access</div>
                    <div style={{ display:'flex', alignItems:'center', gap:12, padding:'11px 14px', borderRadius:'9px', background:T.bgAlt, border:`1.5px dashed ${T.border}` }}>
                      <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke={T.textMuted} strokeWidth="2" style={{ flexShrink:0 }}><rect x="3" y="11" width="18" height="10" rx="2"/><path d="M7 11V7a5 5 0 0 1 10 0v4"/></svg>
                      <div style={{ flex:1 }}>
                        <div style={{ fontSize:12.5, fontWeight:600, color:T.textMuted }}>Not available with Admin</div>
                        <div style={{ fontSize:10.5, color:T.textMuted, marginTop:1 }}>Remove Admin to grant Coordinator access</div>
                      </div>
                    </div>
                  </div>
                )}

                {/* Program pills */}
                {selectedIsFaculty && !selectedIsAdmin && selectedCoordinator && (
                  <div>
                    <div style={{ fontSize:11, fontWeight:600, color:T.textMuted, letterSpacing:'.3px', marginBottom:7, textTransform:'uppercase' }}>Assigned Program</div>
                    <div style={{ display:'flex', gap:8, flexWrap:'wrap' }}>
                      {PROGRAMS.map(prog => {
                        const active = selectedProgram === prog
                        return (
                          <button key={prog} type="button" onClick={() => setSelectedProgram(prog)}
                            style={{ padding:'7px 16px', borderRadius:'99px', fontSize:12, fontFamily:"'Inter',sans-serif", background: active ? T.greenDeep : T.bgAlt, color: active ? '#fff' : T.textMuted, border: active ? 'none' : `1.5px solid ${T.border}`, cursor:'pointer', fontWeight:600, transition:'all 0.18s', boxShadow: active ? `0 2px 8px rgba(0,0,0,0.28)` : 'none' }}
                          >
                            {prog}
                          </button>
                        )
                      })}
                    </div>
                  </div>
                )}

                {/* Feedback */}
                {roleSuccess && (
                  <div style={{ padding:'9px 12px', borderRadius:'8px', background:'var(--meadow-soft)', border:'1px solid var(--meadow-border)', display:'flex', gap:8, alignItems:'flex-start' }}>
                    <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="var(--meadow)" strokeWidth="2.5" style={{ flexShrink:0, marginTop:1 }}><polyline points="20 6 9 17 4 12"/></svg>
                    <span style={{ fontSize:11.5, color:'var(--meadow-mid)', fontWeight:500, lineHeight:1.4 }}>{roleSuccess}</span>
                  </div>
                )}
                {roleError && (
                  <div style={{ padding:'9px 12px', borderRadius:'8px', background:T.dangerSoft, border:'1px solid #FECACA', display:'flex', gap:8, alignItems:'center' }}>
                    <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke={T.danger} strokeWidth="2"><circle cx="12" cy="12" r="10"/><line x1="12" y1="8" x2="12" y2="12"/></svg>
                    <span style={{ fontSize:11.5, color:T.danger, fontWeight:500 }}>{roleError}</span>
                  </div>
                )}

                {/* Save */}
                {roleHasChanges && (
                  <button type="button" onClick={handleSaveRole} disabled={roleSaving}
                    style={{ display:'inline-flex', alignItems:'center', gap:7, padding:'9px 18px', borderRadius:'9px', border:'none', background: roleSaving ? T.borderLight : `linear-gradient(135deg,${T.green},${T.greenDeep})`, color: '#fff', fontSize:12.5, fontWeight:600, cursor: roleSaving ? 'default' : 'pointer', fontFamily:"'Inter',sans-serif", boxShadow: roleSaving ? 'none' : `0 3px 12px rgba(0,0,0,0.28)`, opacity: roleSaving ? 0.7 : 1, transition:'all 0.2s', width:'fit-content' }}
                  >
                    {roleSaving
                      ? <><svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" style={{ animation:'spin .8s linear infinite' }}><path d="M21 12a9 9 0 1 1-6.219-8.56"/></svg>Saving...</>
                      : <><svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"><polyline points="20 6 9 17 4 12"/></svg>Save Role</>
                    }
                  </button>
                )}
              </div>
            )}
          </div>
        )}
        {infoError && !isNew && (
          <div style={{ margin:'0 20px 20px', padding:'10px 14px', borderRadius:'8px', background:T.dangerSoft, border:'1px solid #FECACA', display:'flex', gap:8, alignItems:'center' }}>
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke={T.danger} strokeWidth="2"><circle cx="12" cy="12" r="10"/><line x1="12" y1="8" x2="12" y2="12"/></svg>
            <span style={{ fontSize:12, color:T.danger, fontWeight:500 }}>{infoError}</span>
          </div>
        )}
      </div>

      {isNew && (
        <div style={{ background:T.bg, borderRadius:'16px', border:`1px solid ${T.border}`, overflow:'hidden', boxShadow:'0 4px 20px rgba(0,0,0,0.08)', fontFamily:"'Inter',sans-serif" }}>
          <CardHeader
            title="Login Credentials"
            sub="Password defaults to [LastName]GC2026 if left blank"
          />
          <div style={{ padding:'24px 20px', display:'flex', flexDirection:'column', gap:20 }}>
            <FormField label="Login Email" required hint="Used as the faculty member's login">
              <input type="email" value={form.email||''} onChange={e => setForm(f => ({...f, email:e.target.value}))} autoComplete="off" required style={{ padding:'10px 14px', borderRadius:'8px', border:`1px solid ${T.border}`, fontSize:13, fontFamily:"'Inter',sans-serif", width:'100%', boxSizing:'border-box', outline:'none', background:T.bg, color:T.textMain }}/>
            </FormField>
            <FormField label="Password" hint="Leave blank to use [LastName]GC2026">
              <div style={{ display:'flex', gap:8 }}>
                <input type={showPassword?'text':'password'} value={password} onChange={e => setPassword(e.target.value)} autoComplete="new-password" placeholder="Default: [LastName]GC2026" style={{ flex:1, padding:'10px 14px', borderRadius:'8px', border:`1px solid ${T.border}`, fontSize:13, fontFamily:"'Inter',sans-serif", outline:'none', background:T.bg, color:T.textMain }}/>
                <button type="button" onClick={() => setShowPassword(v => !v)} style={{ padding:'10px 16px', borderRadius:'8px', border:`1px solid ${T.border}`, background:T.bgAlt, color:T.textMuted, fontSize:12, fontWeight:600, cursor:'pointer', fontFamily:"'Inter',sans-serif", transition:'all 0.2s' }}>{showPassword?'Hide':'Show'}</button>
                <button type="button" onClick={() => { const ln=(form.name||'').trim().split(/\s+/).pop()||'faculty'; setPassword(ln+'GC2026'); setShowPassword(true) }} style={{ padding:'10px 16px', borderRadius:'8px', border:`1px solid ${T.greenBorder}`, background:T.greenSoft, color:T.greenDeep, fontSize:12, fontWeight:600, cursor:'pointer', fontFamily:"'Inter',sans-serif", whiteSpace:'nowrap', transition:'all 0.2s' }}>Generate</button>
              </div>
            </FormField>
          </div>
        </div>
      )}
    </>
  )
}

// ─── SchedulePrefsCard ────────────────────────────────────────────────────────
// ── Time options: 6:00 AM → 9:30 PM in 30-min steps, formatted as 12h AM/PM ──
const TIME_OPTIONS = (() => {
  const opts = []
  for (let h = 6; h <= 21.5; h += 0.5) {
    const hh   = Math.floor(h)
    const mm   = h % 1 === 0.5 ? '30' : '00'
    const ampm = hh >= 12 ? 'PM' : 'AM'
    const disp = hh > 12 ? hh - 12 : (hh === 0 ? 12 : hh)
    opts.push({ value: h, label: `${disp}:${mm} ${ampm}` })
  }
  return opts
})()

export function SchedulePrefsCard({ form, setForm, isNew, prefsChanged, prefSaving, prefSaved, prefError, onSavePrefs }) {
  const toggleDay = day => setForm(f => ({ ...f, preferredDays: f.preferredDays.includes(day) ? f.preferredDays.filter(d => d!==day) : [...f.preferredDays, day] }))
  return (
    <div style={{ background:T.bg, borderRadius:'16px', border:`1px solid ${T.border}`, overflow:'hidden', boxShadow:'0 4px 20px rgba(0,0,0,0.08)', fontFamily:"'Inter',sans-serif" }}>
      <CardHeader
        title="Schedule Preferences"
        sub="Set preferred teaching days and hours"
        right={!isNew && (prefsChanged||prefSaving||prefSaved) ? <SectionSaveBtn saving={prefSaving} saved={prefSaved} onClick={onSavePrefs}/> : undefined}
      />

      <div style={{ padding:'20px 24px', display:'flex', gap:32, flexWrap:'wrap', alignItems:'flex-start' }}>

        {/* Days — takes most of the space */}
        <div style={{ flex:'1 1 380px' }}>
          <div style={{ fontSize:11, fontWeight:700, color:T.textMuted, textTransform:'uppercase', letterSpacing:'.6px', marginBottom:10 }}>
            Preferred Teaching Days
          </div>
          <div style={{ display:'flex', gap:8, flexWrap:'wrap' }}>
            {ALL_DAYS.map(day => {
              const active = form.preferredDays.includes(day)
              return (
                <button key={day} type="button" onClick={() => toggleDay(day)} style={{
                  padding:'7px 18px', fontSize:12.5, borderRadius:'99px', fontFamily:"'Inter',sans-serif",
                  background:active ? T.green : T.bgAlt,
                  color: active ? '#fff' : T.textMuted,
                  border:active ? `1.5px solid transparent` : `1.5px solid ${T.border}`,
                  cursor:'pointer', fontWeight:active ? 700 : 500,
                  transition:'all 0.15s',
                  boxShadow: active ? '0 2px 8px rgba(0,0,0,0.28)' : 'none',
                }}>
                  {day.slice(0,3)}
                </button>
              )
            })}
          </div>
          <div style={{ marginTop:8, fontSize:11.5, color:T.textLight }}>
            {form.preferredDays.length === 0
              ? 'No days selected'
              : `${form.preferredDays.length} day${form.preferredDays.length !== 1 ? 's' : ''} selected`}
          </div>
        </div>

        {/* Divider */}
        <div style={{ width:1, background:T.borderLight, alignSelf:'stretch', flexShrink:0, minHeight:60 }}/>

        {/* Time range */}
        <div style={{ flex:'0 0 auto', display:'flex', gap:20, alignItems:'flex-end' }}>
          {[
            { label:'Start Time', key:'preferredTimeStart' },
            { label:'End Time',   key:'preferredTimeEnd'   },
          ].map(({ label, key }) => (
            <div key={key} style={{ display:'flex', flexDirection:'column', gap:6 }}>
              <label style={{ fontSize:11, fontWeight:700, color:T.textMuted, textTransform:'uppercase', letterSpacing:'.6px' }}>
                {label}
              </label>
              <div style={{ position:'relative' }}>
                <select
                  value={form[key]}
                  onChange={e => setForm(f => ({ ...f, [key]: Number(e.target.value) }))}
                  style={{
                    appearance:'none',
                    padding:'9px 36px 9px 14px',
                    borderRadius:'8px',
                    border:`1.5px solid ${T.border}`,
                    fontSize:13, fontWeight:600,
                    fontFamily:"'Inter',sans-serif",
                    background:T.bg, color:T.textMain,
                    cursor:'pointer', outline:'none',
                    width:130,
                    transition:'border-color .15s',
                  }}
                  onFocus={e => e.target.style.borderColor = T.green}
                  onBlur={e => e.target.style.borderColor = T.border}
                >
                  {TIME_OPTIONS.map(opt => (
                    <option key={opt.value} value={opt.value}>{opt.label}</option>
                  ))}
                </select>
                <div style={{ position:'absolute', right:11, top:'50%', transform:'translateY(-50%)', pointerEvents:'none', color:T.green }}>
                  <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round"><polyline points="6 9 12 15 18 9"/></svg>
                </div>
              </div>
            </div>
          ))}
        </div>
      </div>

      {prefError && !isNew && (
        <div style={{ margin:'0 24px 20px', padding:'10px 14px', borderRadius:'8px', background:T.dangerSoft, border:'1px solid #FECACA', display:'flex', gap:8, alignItems:'center' }}>
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
    <div style={{ background:T.bg, borderRadius:'16px', border:`1px solid ${T.border}`, overflow:'hidden', boxShadow:'0 4px 20px rgba(0,0,0,0.08)', fontFamily:"'Inter',sans-serif" }}>
      <CardHeader
        title="Login Credentials"
        sub={form.email ? undefined : 'No account activated yet'}
        right={
          form.email
            ? <span style={{ fontSize:11, fontWeight:700, padding:'3px 10px', borderRadius:'99px', background:'rgba(134,239,172,0.25)', color:'var(--meadow-border)', border:'1px solid rgba(134,239,172,0.4)' }}>Active</span>
            : <span style={{ fontSize:11, fontWeight:700, padding:'3px 10px', borderRadius:'99px', background:'rgba(239,68,68,0.2)', color:'#FCA5A5', border:'1px solid rgba(239,68,68,0.3)' }}>Not Activated</span>
        }
      />
      {!form.email && (
        <div style={{ margin:'20px 20px 0', padding:'12px 16px', borderRadius:'8px', background:'rgba(245, 158, 11, 0.05)', border:'1px solid #FEF3C7', display:'flex', gap:10, alignItems:'flex-start' }}>
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke='#F59E0B' strokeWidth="2" style={{ flexShrink:0, marginTop:2 }}><path d="M10.29 3.86L1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z"/><line x1="12" y1="9" x2="12" y2="13"/><line x1="12" y1="17" x2="12.01" y2="17"/></svg>
          <span style={{ fontSize:12, color:'#F59E0B', lineHeight:1.5 }}>No login account yet. Set an email and password below to activate.</span>
        </div>
      )}
      <div style={{ padding:'24px 20px', display:'grid', gridTemplateColumns:'1fr 1fr 1fr', gap:'20px 24px', alignItems:'start' }}>
        <FormField label="Login Email" hint={form.email?'Change the email used to sign in':'Required — will be used as login'}>
          <div style={{ position: 'relative', display: 'flex', alignItems: 'center' }}>
            <input type="text" value={credEmail} onChange={e => setCredEmail(e.target.value)} autoComplete="off" style={{ padding:'10px 14px', paddingRight: !credEmail.includes('@') && credEmail.length > 0 ? 170 : 14, borderRadius:'8px', border:`1px solid ${T.border}`, fontSize:13, fontFamily:"'Inter',sans-serif", width:'100%', boxSizing:'border-box', outline:'none', background:T.bg, color:T.textMain }}/>
            {!credEmail.includes('@') && credEmail.length > 0 && (
              <span style={{ position: 'absolute', right: 14, color: '#9CA3AF', fontSize: 13, pointerEvents: 'none' }}>
                @gordoncollege.edu.ph
              </span>
            )}
          </div>
        </FormField>
        <FormField label="New Password" hint={form.email?'Leave blank to keep current':'Auto-generated if blank'}>
          <div style={{ display:'flex', gap:8 }}>
            <input type={showCredPwd?'text':'password'} value={credPassword} onChange={e => setCredPassword(e.target.value)} autoComplete="new-password" placeholder={form.email?'Leave blank to keep current':'Auto-generated if blank'} style={{ flex:1, padding:'10px 14px', borderRadius:'8px', border:`1px solid ${T.border}`, fontSize:13, fontFamily:"'Inter',sans-serif", minWidth:0, outline:'none', background:T.bg, color:T.textMain }}/>
            <button type="button" onClick={() => setShowCredPwd(v => !v)} style={{ padding:'10px 14px', borderRadius:'8px', border:`1px solid ${T.border}`, background:T.bgAlt, color:T.textMuted, fontSize:12, fontWeight:600, cursor:'pointer', fontFamily:"'Inter',sans-serif", flexShrink:0, transition:'all 0.2s' }}>{showCredPwd?'Hide':'Show'}</button>
            <button type="button" onClick={generate} style={{ padding:'10px 14px', borderRadius:'8px', border:`1px solid ${T.greenBorder}`, background:T.greenSoft, color:T.greenDeep, fontSize:12, fontWeight:600, cursor:'pointer', fontFamily:"'Inter',sans-serif", flexShrink:0, whiteSpace:'nowrap', transition:'all 0.2s' }}>Generate</button>
          </div>
        </FormField>
        <div style={{ display:'flex', flexDirection:'column', gap:10 }}>
          {credPassword && (
            <FormField label="Confirm Password">
              <input type={showCredPwd?'text':'password'} value={credConfirm} onChange={e => setCredConfirm(e.target.value)} autoComplete="new-password" placeholder="Re-enter password" style={{ padding:'10px 14px', borderRadius:'8px', border:`1px solid ${credConfirm&&credConfirm!==credPassword?'rgba(220, 38, 38, 0.25)':T.border}`, fontSize:13, fontFamily:"'Inter',sans-serif", width:'100%', boxSizing:'border-box', outline:'none', background:T.bg, color:T.textMain }}/>
              {credConfirm && credConfirm!==credPassword && <span style={{ fontSize:11, color:T.danger, marginTop:4, display:'block', fontWeight: 500 }}>Passwords do not match</span>}
            </FormField>
          )}
          <div style={{ paddingTop:credPassword?0:24 }}>
            <button type="button" onClick={onSave} disabled={credSaving} style={{ display:'inline-flex', alignItems:'center', justifyContent:'center', gap:8, padding:'12px 24px', borderRadius:'8px', border:'none', fontFamily:"'Inter',sans-serif", fontSize:13, fontWeight:600, cursor:credSaving?'default':'pointer', background:`linear-gradient(135deg,${T.green},${T.greenDeep})`, color: '#fff', boxShadow:`0 4px 14px rgba(0,0,0,0.25)`, opacity:credSaving?0.7:1, whiteSpace:'nowrap', width:'100%', transition:'all 0.2s' }}>
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"><rect x="3" y="11" width="18" height="11" rx="2"/><path d="M7 11V7a5 5 0 0 1 10 0v4"/></svg>
              {credSaving?'Saving...':(form.email?'Update Credentials':'Activate Account')}
            </button>
            {credSuccess && <span style={{ fontSize:12, color:'var(--meadow-mid)', fontWeight:600, display:'flex', alignItems:'center', gap:6, marginTop:12 }}><svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="var(--meadow-mid)" strokeWidth="2.5"><polyline points="20 6 9 17 4 12"/></svg>{credSuccess}</span>}
            {credError && <div style={{ padding:'10px 14px', borderRadius:'8px', background:T.dangerSoft, border:'1px solid #FECACA', display:'flex', gap:8, alignItems:'center', marginTop:12 }}><svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke={T.danger} strokeWidth="2"><circle cx="12" cy="12" r="10"/><line x1="12" y1="8" x2="12" y2="12"/></svg><span style={{ fontSize:12, color:T.danger, fontWeight:500 }}>{credError}</span></div>}
          </div>
        </div>
      </div>
    </div>
  )
}


// ─── RoleManagementCard ───────────────────────────────────────────────────────
export function RoleManagementCard({ facultyId, facultyEmail, onRoleUpdated }) {
  // Roles are independent toggles — a user can be Admin, Faculty, or both.
  // Valid combos: Admin, Faculty, Admin+Faculty, Faculty+Coordinator.
  // Invalid: Coordinator alone, Admin+Coordinator, Admin+Faculty+Coordinator.
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [currentIsAdmin, setCurrentIsAdmin] = useState(false)
  const [currentIsFaculty, setCurrentIsFaculty] = useState(true)
  const [isCoordinator, setIsCoordinator] = useState(false)
  const [coordinatorProgram, setCoordinatorProgram] = useState('')
  const [selectedIsAdmin, setSelectedIsAdmin] = useState(false)
  const [selectedIsFaculty, setSelectedIsFaculty] = useState(true)
  const [selectedCoordinator, setSelectedCoordinator] = useState(false)
  const [selectedProgram, setSelectedProgram] = useState('')
  const [error, setError] = useState('')
  const [success, setSuccess] = useState('')

  // Available programs
  const PROGRAMS = ['BSCS', 'BSIT', 'BSEMC-GD', 'BSEMC-DAT']

  // Derive isAdmin/isFaculty from whatever shape the API returns (explicit booleans,
  // an array of roles, or a legacy single 'admin'/'faculty' string).
  function parseRoleData(data) {
    if (typeof data.isAdmin === 'boolean' || typeof data.isFaculty === 'boolean') {
      return { isAdmin: !!data.isAdmin, isFaculty: !!data.isFaculty }
    }
    const roleVal = data.role
    if (Array.isArray(roleVal)) {
      return { isAdmin: roleVal.includes('admin'), isFaculty: roleVal.includes('faculty') }
    }
    if (typeof roleVal === 'string' && roleVal.includes(',')) {
      const parts = roleVal.split(',').map(s => s.trim())
      return { isAdmin: parts.includes('admin'), isFaculty: parts.includes('faculty') }
    }
    return { isAdmin: roleVal === 'admin', isFaculty: roleVal === 'faculty' || roleVal == null }
  }

  // Load current role on mount
  useEffect(() => {
    async function loadRole() {
      try {
        const { getFacultyRole } = await import('../../services/api')
        const data = await getFacultyRole(facultyId)
        const { isAdmin, isFaculty } = parseRoleData(data)
        setCurrentIsAdmin(isAdmin); setSelectedIsAdmin(isAdmin)
        setCurrentIsFaculty(isFaculty); setSelectedIsFaculty(isFaculty)
        setIsCoordinator(data.isCoordinator || false); setSelectedCoordinator(data.isCoordinator || false)
        setCoordinatorProgram(data.coordinatorProgram || ''); setSelectedProgram(data.coordinatorProgram || '')
      } catch (err) {
        // If no role set yet, default to faculty
        setCurrentIsAdmin(false); setSelectedIsAdmin(false)
        setCurrentIsFaculty(true); setSelectedIsFaculty(true)
        setIsCoordinator(false); setSelectedCoordinator(false)
        setCoordinatorProgram(''); setSelectedProgram('')
      } finally {
        setLoading(false)
      }
    }
    loadRole()
  }, [facultyId])

  function toggleAdmin() {
    const next = !selectedIsAdmin
    setSelectedIsAdmin(next)
    if (next) { 
      setSelectedIsFaculty(false)
      setSelectedCoordinator(false)
      setSelectedProgram('') 
    }
  }

  function toggleFaculty() {
    const next = !selectedIsFaculty
    setSelectedIsFaculty(next)
    if (next) {
      setSelectedIsAdmin(false)
    }
    if (!next) { 
      setSelectedCoordinator(false)
      setSelectedProgram('') 
    }
  }

  const hasChanges = selectedIsAdmin !== currentIsAdmin ||
                     selectedIsFaculty !== currentIsFaculty ||
                     selectedCoordinator !== isCoordinator ||
                     selectedProgram !== coordinatorProgram

  async function handleSave() {
    setError('')
    setSuccess('')

    if (!selectedIsAdmin && !selectedIsFaculty) {
      setError('Select at least one role (Admin or Faculty).')
      return
    }
    if (selectedCoordinator && selectedIsAdmin) {
      setError('Coordinator access cannot be combined with Admin.')
      return
    }
    if (selectedCoordinator && !selectedIsFaculty) {
      setError('Coordinator access requires the Faculty role.')
      return
    }
    if (selectedCoordinator && !selectedProgram) {
      setError('Please select a program for the coordinator.')
      return
    }
    
    setSaving(true)
    try {
      const { setFacultyRole } = await import('../../services/api')
      await setFacultyRole(facultyId, { isAdmin: selectedIsAdmin, isFaculty: selectedIsFaculty, isCoordinator: selectedCoordinator, coordinatorProgram: selectedProgram || null })
      setCurrentIsAdmin(selectedIsAdmin)
      setCurrentIsFaculty(selectedIsFaculty)
      setIsCoordinator(selectedCoordinator)
      setCoordinatorProgram(selectedProgram)
      setSuccess(`Role updated successfully${selectedCoordinator ? ` as ${selectedProgram} Coordinator` : ''}. User must log out and back in for changes to take effect.`)
      if (onRoleUpdated) onRoleUpdated(selectedIsAdmin, selectedIsFaculty, selectedCoordinator, selectedProgram)
      setTimeout(() => setSuccess(''), 5000)
    } catch (err) {
      setError(err.response?.data?.detail || 'Failed to update role.')
    } finally {
      setSaving(false)
    }
  }

  function formatRoleBadge() {
    const parts = []
    if (currentIsAdmin) parts.push('Admin')
    if (currentIsFaculty) parts.push('Faculty')
    let label = parts.join(' + ') || 'No Role'
    if (isCoordinator && coordinatorProgram) label += ` · ${coordinatorProgram} Coord.`
    return label
  }

  if (loading) {
    return (
      <div style={{ background:T.bg, borderRadius:'16px', border:`1px solid ${T.border}`, overflow:'hidden', boxShadow:'0 4px 20px rgba(0,0,0,0.08)', fontFamily:"'Inter',sans-serif" }}>
        <CardHeader title="Role & Permissions" />
        <div style={{ padding:'24px 20px', textAlign:'center', color:T.textMuted }}>Loading role information...</div>
      </div>
    )
  }

  const roleBadge = (currentIsAdmin || currentIsFaculty)
    ? <span style={{ fontSize:11, fontWeight:700, padding:'3px 10px', borderRadius:'99px', background: currentIsAdmin?'rgba(251,191,36,0.25)':'rgba(134,239,172,0.25)', color: currentIsAdmin?'rgba(245, 158, 11, 0.35)':'var(--meadow-border)', border:`1px solid ${currentIsAdmin?'rgba(251,191,36,0.4)':'rgba(134,239,172,0.4)'}` }}>
        {formatRoleBadge()}
      </span>
    : undefined

  return (
    <div style={{ background:T.bg, borderRadius:'16px', border:`1px solid ${T.border}`, overflow:'hidden', boxShadow:'0 4px 20px rgba(0,0,0,0.08)', fontFamily:"'Inter',sans-serif" }}>
      <CardHeader
        title="Role & Permissions"
        sub="Controls which portal the user can access"
        right={roleBadge}
      />

      {!facultyEmail && (
        <div style={{ margin:'20px 20px 0', padding:'12px 16px', borderRadius:'8px', background:'rgba(245, 158, 11, 0.05)', border:'1px solid #FEF3C7', display:'flex', gap:10, alignItems:'flex-start' }}>
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke='#F59E0B' strokeWidth="2" style={{ flexShrink:0, marginTop:2 }}><path d="M10.29 3.86L1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z"/><line x1="12" y1="9" x2="12" y2="13"/><line x1="12" y1="17" x2="12.01" y2="17"/></svg>
          <span style={{ fontSize:12, color:'#F59E0B', lineHeight:1.5 }}>No login account yet. Activate credentials first before setting a role.</span>
        </div>
      )}

      <div style={{ padding:'24px 20px', display:'flex', flexDirection:'column', gap:20 }}>
        <FormField label="System Role" hint="Admin and Faculty are mutually exclusive.">
          <div style={{ display:'flex', gap:8 }}>
            <button
              type="button"
              onClick={toggleFaculty}
              disabled={!facultyEmail}
              style={{
                flex:1, padding:'10px 14px', borderRadius:'8px', fontSize:13, fontFamily:"'Inter',sans-serif",
                background: selectedIsFaculty ? T.greenSoft : T.bgAlt,
                color: selectedIsFaculty ? T.greenDeep : T.textMuted,
                border: selectedIsFaculty ? `1.5px solid ${T.greenBorder}` : `1px solid ${T.border}`,
                cursor: facultyEmail ? 'pointer' : 'not-allowed',
                fontWeight:600, transition: 'all 0.2s',
                opacity: facultyEmail ? 1 : 0.5
              }}
            >
              <div style={{ display:'flex', alignItems:'center', justifyContent:'center', gap:8 }}>
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2"/><circle cx="12" cy="7" r="4"/></svg>
                Faculty
              </div>
            </button>
            <button
              type="button"
              onClick={toggleAdmin}
              disabled={!facultyEmail}
              style={{
                flex:1, padding:'10px 14px', borderRadius:'8px', fontSize:13, fontFamily:"'Inter',sans-serif",
                background: selectedIsAdmin ? T.greenSoft : T.bgAlt,
                color: selectedIsAdmin ? T.greenDeep : T.textMuted,
                border: selectedIsAdmin ? `1.5px solid ${T.greenBorder}` : `1px solid ${T.border}`,
                cursor: facultyEmail ? 'pointer' : 'not-allowed',
                fontWeight:600, transition: 'all 0.2s',
                opacity: facultyEmail ? 1 : 0.5
              }}
            >
              <div style={{ display:'flex', alignItems:'center', justifyContent:'center', gap:8 }}>
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M12 2L2 7l10 5 10-5-10-5z"/><path d="M2 17l10 5 10-5"/><path d="M2 12l10 5 10-5"/></svg>
                Admin
              </div>
            </button>
          </div>
        </FormField>

        {selectedIsFaculty && !selectedIsAdmin && (
          <>
            <FormField label="Coordinator Access" hint="Grants access to program coordinator panel">
              <label style={{ display:'flex', alignItems:'center', gap:12, padding:'12px 16px', borderRadius:'8px', background:T.bgAlt, border:`1px solid ${T.border}`, cursor: facultyEmail ? 'pointer' : 'not-allowed', opacity: facultyEmail ? 1 : 0.5 }}>
                <input
                  type="checkbox"
                  checked={selectedCoordinator}
                  onChange={e => setSelectedCoordinator(e.target.checked)}
                  disabled={!facultyEmail}
                  style={{ width:18, height:18, cursor: facultyEmail ? 'pointer' : 'not-allowed' }}
                />
                <div style={{ flex:1 }}>
                  <div style={{ fontSize:13, fontWeight:600, color:T.textMain }}>Grant Coordinator Access</div>
                  <div style={{ fontSize:11, color:T.textMuted, marginTop:2 }}>Can log in as either Coordinator or Faculty</div>
                </div>
              </label>
            </FormField>

            {selectedCoordinator && (
              <FormField label="Coordinator Program" hint="Select which program this coordinator manages" required>
                <select
                  value={selectedProgram}
                  onChange={e => setSelectedProgram(e.target.value)}
                  disabled={!facultyEmail}
                  style={{
                    padding:'10px 14px', borderRadius:'8px', border:`1px solid ${T.border}`,
                    fontSize:13, fontFamily:"'Inter',sans-serif", background:T.bg,
                    width:'100%', boxSizing:'border-box', outline:'none', color: T.textMain,
                    cursor: facultyEmail ? 'pointer' : 'not-allowed',
                    opacity: facultyEmail ? 1 : 0.5
                  }}
                >
                  <option value="">Select program...</option>
                  {PROGRAMS.map(prog => (
                    <option key={prog} value={prog}>{prog}</option>
                  ))}
                </select>
              </FormField>
            )}
          </>
        )}
        {selectedIsAdmin && (
          <FormField label="Coordinator Access" hint="Grants access to program coordinator panel">
            <div style={{ display:'flex', alignItems:'center', gap:12, padding:'12px 16px', borderRadius:'8px', background:T.bgAlt, border:`1.5px dashed ${T.border}` }}>
              <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke={T.textMuted} strokeWidth="2" style={{ flexShrink:0 }}><rect x="3" y="11" width="18" height="10" rx="2"/><path d="M7 11V7a5 5 0 0 1 10 0v4"/></svg>
              <div style={{ flex:1 }}>
                <div style={{ fontSize:13, fontWeight:600, color:T.textMuted }}>Not available with Admin</div>
                <div style={{ fontSize:11, color:T.textMuted, marginTop:2 }}>Remove Admin to grant Coordinator access</div>
              </div>
            </div>
          </FormField>
        )}

        {success && (
          <div style={{ padding:'10px 14px', borderRadius:'8px', background:'#E6FAF3', border:'1px solid #A7F3D0', display:'flex', gap:8, alignItems:'flex-start' }}>
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="var(--meadow)" strokeWidth="2" style={{ flexShrink:0, marginTop:2 }}><polyline points="20 6 9 17 4 12"/></svg>
            <span style={{ fontSize:12, color: 'var(--meadow-text)', fontWeight:500, lineHeight:1.5 }}>{success}</span>
          </div>
        )}

        {error && (
          <div style={{ padding:'10px 14px', borderRadius:'8px', background:T.dangerSoft, border:'1px solid #FECACA', display:'flex', gap:8, alignItems:'center' }}>
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke={T.danger} strokeWidth="2"><circle cx="12" cy="12" r="10"/><line x1="12" y1="8" x2="12" y2="12"/></svg>
            <span style={{ fontSize:12, color:T.danger, fontWeight:500 }}>{error}</span>
          </div>
        )}

        {hasChanges && facultyEmail && (
          <button
            type="button"
            onClick={handleSave}
            disabled={saving}
            style={{
              display:'inline-flex', alignItems:'center', justifyContent:'center', gap:8,
              padding:'10px 18px', borderRadius:'10px', border:'none',
              background: saving ? T.borderLight : `linear-gradient(135deg,${T.green},${T.greenDeep})`,
              color: '#fff', fontSize:13, fontWeight:600,
              cursor: saving ? 'default' : 'pointer',
              fontFamily:"'Inter',sans-serif",
              boxShadow: saving ? 'none' : `0 3px 12px rgba(0,0,0,0.28)`,
              opacity: saving ? 0.7 : 1,
              transition: 'all 0.2s'
            }}
          >
            {saving ? (
              <>
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" style={{ animation: 'spin 0.8s linear infinite' }}>
                  <path d="M21 12a9 9 0 1 1-6.219-8.56"/>
                </svg>
                Saving...
              </>
            ) : (
              <>
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><polyline points="20 6 9 17 4 12"/></svg>
                Save Role Changes
              </>
            )}
          </button>
        )}
      </div>
    </div>
  )
}