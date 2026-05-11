import { useState, useEffect, useCallback } from 'react'
import { getFaculty, getArchivedFaculty } from '../../services/api'

// ─── Style injection ──────────────────────────────────────────────────────────
if (!document.getElementById('fd-shared-style')) {
  const s = document.createElement('style')
  s.id = 'fd-shared-style'
  s.textContent = `
    @keyframes fdToastIn  { from{opacity:0;transform:scale(.96) translateY(12px)} to{opacity:1;transform:scale(1) translateY(0)} }
    @keyframes spin        { to { transform: rotate(360deg) } }
    @keyframes fdShimmer  { 0%{background-position:-600px 0} 100%{background-position:600px 0} }
    .fd-toast-wrap { position:fixed; bottom:24px; left:50%; z-index:9999; display:flex; flex-direction:column; gap:8px; align-items:center; pointer-events:none; transform:translateX(-50%); }
    .fd-toast { display:flex; align-items:center; gap:9px; padding:10px 16px; border-radius:12px; font-family:'Poppins',sans-serif; font-size:12.5px; font-weight:500; box-shadow:0 8px 28px rgba(26,26,46,0.18); animation:fdToastIn .22s cubic-bezier(.4,0,.2,1); white-space:nowrap; pointer-events:auto; }
    .fd-toast.success,.fd-toast.error,.fd-toast.info { background:linear-gradient(135deg,#7C6FCD,#5a4fbf); color:#fff; box-shadow:0 8px 24px rgba(124,111,205,0.3); border:1px solid #A99BE8; }
    .fd-skel { background:linear-gradient(90deg,#F0EDF9 25%,#E6E0F8 50%,#F0EDF9 75%); background-size:1200px 100%; animation:fdShimmer 1.5s ease-in-out infinite; border-radius:7px; }
    .fd-skel-card { background:#fff; border-radius:16px; border:1.5px solid #E8E4F8; overflow:hidden; box-shadow:0 2px 10px rgba(124,111,205,0.06); }
    .fd-skel-card-header { padding:14px 20px; border-bottom:1px solid #F0EDF9; display:flex; align-items:center; gap:10px; }
    .fd-skel-card-body { padding:18px 20px; display:flex; flex-direction:column; gap:14px; }
    input:focus, select:focus { border-color:#7C6FCD !important; outline:none; box-shadow:0 0 0 3px rgba(124,111,205,0.12); }
  `
  document.head.appendChild(s)
}

// ─── Constants ────────────────────────────────────────────────────────────────
export const ACADEMIC_RANKS = [
  'Instructor I','Instructor II','Instructor III',
  'Assistant Professor I','Assistant Professor II',
  'Associate Professor I','Associate Professor II',
  'Professor I','Professor II','Professor III',
  'Assistant Dean','Dean',
]
export const DEPARTMENTS   = ['CCS','CEAS','CHTM','CBA','CAHS']
export const ALL_DAYS      = ['Monday','Tuesday','Wednesday','Thursday','Friday','Saturday','Sunday']
export const RATING_LABELS = { 5:'Expert', 4:'Highly Proficient', 3:'Competent', 2:'Developing', 1:'Beginner' }
export const RATING_COLORS = { 5:'#059669', 4:'#2563EB', 3:'#7C6FCD', 2:'#D97706', 1:'#C0392B' }
export const SPECS_PREVIEW = 4

export const EMPTY_FACULTY = {
  name:'', firstName:'', lastName:'', email:'', status:'full-time', AcademicRank:'',
  Department:'CCS', Educational_attainment:'', SexAtBirth:'', units:0,
  specializations:[], preferredDays:['Monday','Tuesday','Wednesday','Thursday','Friday','Saturday','Sunday'],
  preferredTimeStart:7, preferredTimeEnd:21,
}

const AVATAR_COLORS = [
  ['#7C6FCD','#EEEAFB'],['#2563EB','#EBF0FF'],['#059669','#E6FAF3'],
  ['#D97706','#FEF3CD'],['#DC2626','#FFE8E8'],['#7C3AED','#EDE9FE'],
]

// ─── Pure utilities ───────────────────────────────────────────────────────────
export function dedupeSpecs(specs) {
  const seen = new Set()
  return (specs || [])
    .map(s => typeof s === 'string' ? { courseCode: s, rating: 3 } : { ...s })
    .filter(s => {
      const key = (s.courseCode || '').toLowerCase().trim()
      if (!key || seen.has(key)) return false
      seen.add(key); return true
    })
}

export function fmtHour(h) {
  const hh = Math.floor(h), mm = h % 1 === 0.5 ? '30' : '00', ampm = hh >= 12 ? 'PM' : 'AM'
  const disp = hh > 12 ? hh - 12 : (hh === 0 ? 12 : hh)
  return `${disp}:${mm} ${ampm}`
}

export function getEffectiveMaxUnits(status, count) {
  if (status === 'part-time') return 15
  if (count >= 5) return 18
  if (count >= 3) return 21
  return 24
}

export function getTierLabel(status, count) {
  if (status === 'part-time') return 'Part-Time · max 15 units'
  if (count >= 5) return 'Full-Time · 5+ courses · max 18 units'
  if (count >= 3) return 'Full-Time · 3-4 courses · max 21 units'
  if (count >= 1) return 'Full-Time · 1-2 courses · max 24 units'
  return 'Full-Time · no assignments yet · max 24 units'
}

export function getAvatarParts(name, firstName, lastName) {
  const n = name || '?'
  const [fg, bg] = AVATAR_COLORS[n.charCodeAt(0) % AVATAR_COLORS.length]
  let initials
  if (lastName && firstName) {
    initials = (lastName[0] + firstName[0]).toUpperCase()
  } else {
    initials = n.split(/[, ]+/).filter(Boolean).map(w => w[0]).join('').slice(0, 2).toUpperCase()
  }
  return { fg, bg, initials }
}

// ─── useToast ─────────────────────────────────────────────────────────────────
export function useToast() {
  const [toasts, setToasts] = useState([])
  const toast = useCallback((message, type = 'info', duration = 3000) => {
    const id = Date.now() + Math.random()
    setToasts(prev => [...prev, { id, message, type }])
    setTimeout(() => setToasts(prev => prev.filter(x => x.id !== id)), duration)
  }, [])
  return { toasts, toast }
}

// ─── useFacultyLoader ─────────────────────────────────────────────────────────
export function useFacultyLoader(id) {
  const isNew = id === 'new'
  const [form,        setForm]        = useState(EMPTY_FACULTY)
  const [savedInfo,   setSavedInfo]   = useState(null)
  const [savedPrefs,  setSavedPrefs]  = useState(null)
  const [credEmail,   setCredEmail]   = useState('')
  const [pageLoading, setPageLoading] = useState(!isNew)

  useEffect(() => {
    if (isNew) return
    getFaculty()
      .then(list => {
        const found = list.find(f => f.id === id)
        if (found) return found
        return getArchivedFaculty().then(all => all.find(f => f.id === id) || null)
      })
      .then(found => {
        if (!found) return
        const data = { ...EMPTY_FACULTY, ...found, specializations: dedupeSpecs(found.specializations || []) }
        // ── Backward compat: parse firstName / lastName from legacy `name` ──
        if (!data.firstName && !data.lastName && data.name) {
          const parts = data.name.split(',')
          if (parts.length >= 2) {
            data.lastName  = parts[0].trim().toUpperCase()
            data.firstName = parts.slice(1).join(',').trim().toUpperCase()
          } else {
            const words = data.name.trim().split(/\s+/)
            if (words.length >= 2) {
              data.lastName  = words[words.length - 1].toUpperCase()
              data.firstName = words.slice(0, -1).join(' ').toUpperCase()
            } else {
              data.lastName  = data.name.trim().toUpperCase()
              data.firstName = ''
            }
          }
        }
        // ── Backward compat: migrate Sex → SexAtBirth ──
        if (!data.SexAtBirth && found.Sex) {
          data.SexAtBirth = found.Sex
        }
        setForm(data)
        setCredEmail(data.email || '')
        setSavedInfo({ name:data.name, firstName:data.firstName, lastName:data.lastName, status:data.status, AcademicRank:data.AcademicRank, Department:data.Department, Educational_attainment:data.Educational_attainment, SexAtBirth:data.SexAtBirth })
        setSavedPrefs({ preferredDays:[...(data.preferredDays||[])], preferredTimeStart:data.preferredTimeStart, preferredTimeEnd:data.preferredTimeEnd })
      })
      .finally(() => setPageLoading(false))
  }, [id])

  return { form, setForm, savedInfo, setSavedInfo, savedPrefs, setSavedPrefs, pageLoading, credEmail, setCredEmail }
}

// ─── ToastContainer ───────────────────────────────────────────────────────────
export function ToastContainer({ toasts }) {
  const icons = {
    success: <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"><polyline points="20 6 9 17 4 12"/></svg>,
    error:   <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><circle cx="12" cy="12" r="10"/><line x1="12" y1="8" x2="12" y2="12"/></svg>,
    info:    <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><circle cx="12" cy="12" r="10"/><path d="M12 8v4"/></svg>,
  }
  return (
    <div className="fd-toast-wrap">
      {toasts.map(t => <div key={t.id} className={`fd-toast ${t.type}`}>{icons[t.type]}{t.message}</div>)}
    </div>
  )
}

// ─── FormField ────────────────────────────────────────────────────────────────
export function FormField({ label, required, hint, children, span }) {
  return (
    <div style={{ display:'flex', flexDirection:'column', gap:5, gridColumn:span ? `span ${span}` : undefined }}>
      <label style={{ fontSize:11, fontWeight:700, color:'#8883B0', textTransform:'uppercase', letterSpacing:'.6px', display:'flex', alignItems:'center', gap:4 }}>
        {label}{required && <span style={{ color:'#7C6FCD' }}>*</span>}
      </label>
      {children}
      {hint && <div style={{ fontSize:10.5, color:'#B0ABCC', marginTop:1 }}>{hint}</div>}
    </div>
  )
}

// ─── SectionSaveBtn ───────────────────────────────────────────────────────────
export function SectionSaveBtn({ saving, saved, onClick, disabled }) {
  const dis = saving || disabled
  return (
    <button type="button" onClick={onClick} disabled={dis} style={{ display:'inline-flex', alignItems:'center', gap:5, padding:'5px 12px', borderRadius:8, border:saved ? '1.5px solid #A7F3D0' : '1.5px solid #E8E4F8', background:saved ? '#E6FAF3' : '#fff', color:saved ? '#059669' : '#7C6FCD', fontFamily:"'Poppins',sans-serif", fontSize:11.5, fontWeight:600, cursor:dis ? 'default' : 'pointer', flexShrink:0, opacity:disabled ? 0.5 : 1 }}>
      {saving  && <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" style={{ animation:'spin 0.8s linear infinite' }}><path d="M21 12a9 9 0 1 1-6.219-8.56"/></svg>}
      {!saving && saved  && <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"><polyline points="20 6 9 17 4 12"/></svg>}
      {!saving && !saved && <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"><path d="M19 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h11l5 5v11a2 2 0 0 1-2 2z"/><polyline points="17 21 17 13 7 13 7 21"/><polyline points="7 3 7 8 15 8"/></svg>}
      {saving ? 'Saving...' : saved ? 'Saved!' : 'Save'}
    </button>
  )
}

// ─── StarRating ───────────────────────────────────────────────────────────────
export function StarRating({ value, onChange, size = 20 }) {
  const [hov, setHov] = useState(0)
  return (
    <div style={{ display:'flex', gap:3, alignItems:'center' }}>
      {[1,2,3,4,5].map(s => {
        const on = (hov || value) >= s
        return (
          <svg key={s} width={size} height={size} viewBox="0 0 24 24" fill={on ? '#7C6FCD' : 'none'} stroke={on ? '#7C6FCD' : '#D8D3F5'} strokeWidth="2" style={{ cursor:onChange ? 'pointer' : 'default' }}
            onMouseEnter={() => onChange && setHov(s)} onMouseLeave={() => onChange && setHov(0)} onClick={() => onChange && onChange(s)}>
            <polygon points="12 2 15.09 8.26 22 9.27 17 14.14 18.18 21.02 12 17.77 5.82 21.02 7 14.14 2 9.27 8.91 8.26 12 2"/>
          </svg>
        )
      })}
      {onChange && <span style={{ fontSize:11, color:RATING_COLORS[value]||'#8883B0', fontWeight:600, marginLeft:4 }}>{RATING_LABELS[value]||''}</span>}
    </div>
  )
}

// ─── DeleteConfirmModal ───────────────────────────────────────────────────────
export function DeleteConfirmModal({ name, onConfirm, onCancel, deleting }) {
  return (
    <div style={{ position:'fixed', inset:0, zIndex:1100, background:'rgba(26,26,46,0.5)', backdropFilter:'blur(4px)', display:'flex', alignItems:'center', justifyContent:'center', padding:24 }}>
      <div style={{ background:'#fff', borderRadius:18, padding:'28px 28px 24px', maxWidth:400, width:'100%', boxShadow:'0 20px 60px rgba(26,26,46,0.22)', textAlign:'center' }}>
        <div style={{ width:52, height:52, borderRadius:'50%', background:'#FFE8E8', margin:'0 auto 16px', display:'flex', alignItems:'center', justifyContent:'center' }}>
          <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="#C0392B" strokeWidth="2"><polyline points="3 6 5 6 21 6"/><path d="M19 6l-1 14a2 2 0 0 1-2 2H8a2 2 0 0 1-2-2L5 6"/><path d="M10 11v6M14 11v6M9 6V4h6v2"/></svg>
        </div>
        <div style={{ fontSize:16, fontWeight:700, color:'#1a1a2e', marginBottom:8 }}>Permanently Delete Faculty Member?</div>
        <div style={{ fontSize:13, color:'#8883B0', marginBottom:24, lineHeight:1.5 }}>
          This cannot be undone. <strong style={{ color:'#1a1a2e' }}>{name}</strong> and their login account will be removed forever.
          <div style={{ marginTop:8, fontSize:12, color:'#D97706', background:'#FEF3CD', borderRadius:8, padding:'6px 10px', border:'1px solid #FDE68A', textAlign:'left' }}>Tip: use Archive instead to hide them without losing their data.</div>
        </div>
        <div style={{ display:'flex', gap:10 }}>
          <button onClick={onCancel} style={{ flex:1, padding:'10px', borderRadius:9, border:'1.5px solid #E8E4F8', background:'#fff', fontSize:13, fontWeight:600, color:'#8883B0', cursor:'pointer', fontFamily:"'Poppins',sans-serif" }}>Cancel</button>
          <button onClick={onConfirm} disabled={deleting} style={{ flex:1, padding:'10px', borderRadius:9, border:'none', background:'#C0392B', fontSize:13, fontWeight:700, color:'#fff', cursor:'pointer', fontFamily:"'Poppins',sans-serif", opacity:deleting ? 0.7 : 1 }}>
            {deleting ? 'Deleting...' : 'Yes, Permanently Delete'}
          </button>
        </div>
      </div>
    </div>
  )
}

// ─── PageSkeleton ─────────────────────────────────────────────────────────────
function Sk({ w='100%', h=14, r=7, delay=0, style:extra={} }) {
  return <div className="fd-skel" style={{ width:w, height:h, borderRadius:r, flexShrink:0, animationDelay:`${delay}s`, ...extra }} />
}

export function PageSkeleton() {
  return (
    <div style={{ padding:'28px 32px', fontFamily:"'Poppins',sans-serif" }}>
      <div style={{ display:'flex', alignItems:'center', gap:8, marginBottom:22 }}>
        <Sk w={52} h={14} r={6}/><Sk w={10} h={10} r={3}/><Sk w={140} h={14} r={6} delay={0.05}/><Sk w={56} h={18} r={99} delay={0.08}/>
      </div>
      <div style={{ display:'flex', gap:24, flexWrap:'wrap', alignItems:'flex-start' }}>
        <div style={{ flex:'0 0 300px', minWidth:260, display:'flex', flexDirection:'column', gap:16 }}>
          <div className="fd-skel-card">
            <div className="fd-skel-card-body" style={{ alignItems:'center', paddingTop:28, paddingBottom:24 }}>
              <Sk w={72} h={72} r="50%"/><Sk w="55%" h={16} delay={0.06}/><Sk w="38%" h={12} delay={0.09}/>
              <div style={{ display:'flex', gap:8, marginTop:4 }}><Sk w={64} h={20} r={99} delay={0.11}/><Sk w={72} h={20} r={99} delay={0.13}/></div>
            </div>
          </div>
          <div className="fd-skel-card">
            <div className="fd-skel-card-header"><Sk w={28} h={28} r={8} delay={0.05}/><Sk w="50%" h={13} delay={0.07}/></div>
            <div className="fd-skel-card-body">
              <div style={{ display:'flex', justifyContent:'space-between' }}><Sk w="40%" h={28} r={8} delay={0.08}/><Sk w="30%" h={13} delay={0.1}/></div>
              <Sk w="100%" h={6} r={99} delay={0.11}/><Sk w="60%" h={11} delay={0.13}/>
            </div>
          </div>
        </div>
        <div style={{ flex:1, minWidth:280, display:'flex', flexDirection:'column', gap:16 }}>
          <div className="fd-skel-card">
            <div className="fd-skel-card-header"><Sk w={28} h={28} r={8} delay={0.04}/><Sk w="40%" h={13} delay={0.07}/></div>
            <div className="fd-skel-card-body">
              <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr', gap:14 }}>
                {[0.08,0.1,0.12,0.14,0.16,0.18].map((d,i) => (
                  <div key={i} style={{ display:'flex', flexDirection:'column', gap:6 }}><Sk w="45%" h={10} delay={d}/><Sk w="100%" h={34} r={8} delay={d+0.01}/></div>
                ))}
              </div>
            </div>
          </div>
          <div className="fd-skel-card">
            <div className="fd-skel-card-header"><Sk w={28} h={28} r={8} delay={0.07}/><Sk w="44%" h={13} delay={0.1}/></div>
            <div className="fd-skel-card-body">
              <div style={{ display:'flex', gap:6, flexWrap:'wrap' }}>{[0.12,0.13,0.14,0.15,0.16,0.17,0.18].map((d,i) => <Sk key={i} w={48} h={28} r={20} delay={d}/>)}</div>
              <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr', gap:14 }}>
                {[0.19,0.21].map((d,i) => <div key={i} style={{ display:'flex', flexDirection:'column', gap:6 }}><Sk w="50%" h={10} delay={d}/><Sk w="100%" h={34} r={8} delay={d+0.01}/></div>)}
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}
