import { useEffect, useState, useMemo } from 'react'
import { useAuth } from '../../hooks/useAuth'
import { getFaculty, updateFaculty, updatePreferences, getCourses } from '../../services/api'
import SpecializationModal from '../../components/FacultyDetail/SpecializationModal'

// ─── Theme ────────────────────────────────────────────────────────────────────
const T = {
  forest:      '#3D7A58',
  forestDeep:  '#2E6145',
  green:       '#2E7D52',
  greenDeep:   '#236040',
  greenSoft:   '#E8F5EE',
  greenBorder: '#B8D9C6',
  mint:        '#6EE7B7',
  meadow:      '#4A9B6F',
  textMain:    '#0E2A1C',
  textMid:     '#3A5448',
  textMuted:   '#6B8C7A',
  textLight:   '#A0BCAD',
  border:      '#D8E8DF',
  borderLight: '#EFF6F2',
  bg:          '#FFFFFF',
  bgAlt:       '#F6FAF8',
  bgPage:      '#F2F7F4',
  
  // Specific accents
  purple:      '#7C6FCD',
  purpleDeep:  '#5a4fbf',
  purpleSoft:  '#F0EDF9',
  purpleBorder:'#D8D3F5',
  orange:      '#D97706',
  orangeDeep:  '#92400E',
  orangeSoft:  '#FFFBEB',
  orangeBorder:'#FDE68A',

  // Spec section — green-based
  specAccent:      '#15803D',
  specAccentDeep:  '#0F5C2C',
  specAccentSoft:  '#DCFCE7',
  specAccentBorder:'#BBF7D0',
  specTagBg:       '#F0FDF4',
  specTagBorder:   '#A7F3D0',
}

const DAYS = ['Monday','Tuesday','Wednesday','Thursday','Friday','Saturday','Sunday']
const DAY_SHORT = ['Mo','Tu','We','Th','Fr','Sa','Su']

// ─── Helpers ──────────────────────────────────────────────────────────────────
function fmtTime(h) {
  const hi = Math.floor(h)
  const mi = h % 1 === 0.5 ? '30' : '00'
  const ampm = hi >= 12 && hi < 24 ? 'PM' : 'AM'
  const dh = hi > 12 ? hi - 12 : (hi === 0 ? 12 : hi)
  return `${String(dh).padStart(2,'0')}:${mi} ${ampm}`
}

function getInitials(name = '') {
  const parts = name.trim().split(/\s+/)
  if (parts.length >= 2) return (parts[0][0] + parts[parts.length-1][0]).toUpperCase()
  return name.slice(0,2).toUpperCase() || '?'
}

function getAvatarColor(name = '') {
  const palette = [
    { bg:'#D1FAE5', fg:'#059669' }, { bg:'#DBEAFE', fg:'#2563EB' },
    { bg:'#FCE7F3', fg:'#DB2777' }, { bg:'#EDE9FE', fg:'#7C3AED' },
    { bg:'#FEF3C7', fg:'#D97706' }, { bg:'#FFE4E6', fg:'#E11D48' },
  ]
  const code = name.split('').reduce((a,c) => a + c.charCodeAt(0), 0)
  return palette[code % palette.length]
}

// ─── Sub-components ───────────────────────────────────────────────────────────
function Skel({ w='100%', h=14, r=8 }) {
  return (
    <div style={{
      width:w, height:h, borderRadius:r,
      background:`linear-gradient(90deg,${T.greenSoft} 25%,${T.bgAlt} 50%,${T.greenSoft} 75%)`,
      backgroundSize:'200% 100%', animation:'fp-shimmer 1.4s infinite', flexShrink:0
    }}/>
  )
}

function FormField({ label, hint, children, icon }) {
  return (
    <div style={{ display:'flex', flexDirection:'column', gap:6 }}>
      <label style={{ display:'flex', alignItems:'center', gap:6, fontSize:11, fontWeight:700, color:T.textMuted, textTransform:'uppercase', letterSpacing:'.7px' }}>
        {icon && <span style={{ color:T.forest, opacity:0.8 }}>{icon}</span>}
        {label}
      </label>
      {children}
      {hint && <div style={{ fontSize:11, color:T.textLight, marginTop:1 }}>{hint}</div>}
    </div>
  )
}

function Input({ value, onChange, placeholder, disabled }) {
  const [focused, setFocused] = useState(false)
  return (
    <input
      value={value}
      onChange={onChange}
      placeholder={placeholder}
      disabled={disabled}
      onFocus={() => setFocused(true)}
      onBlur={() => setFocused(false)}
      style={{
        width:'100%', padding:'10px 14px', borderRadius:10, boxSizing:'border-box',
        border:`1.5px solid ${focused ? T.forest : T.border}`,
        fontSize:13.5, fontWeight:500, color:T.textMain,
        background: disabled ? T.bgAlt : T.bg,
        outline:'none', fontFamily:"'Inter',sans-serif",
        transition:'border-color 0.15s, box-shadow 0.15s',
        boxShadow: focused ? `0 0 0 3px ${T.greenSoft}` : 'none',
        opacity: disabled ? 0.65 : 1
      }}
    />
  )
}

function Select({ value, onChange, children, disabled }) {
  const [focused, setFocused] = useState(false)
  return (
    <div style={{ position:'relative' }}>
      <select
        value={value} onChange={onChange} disabled={disabled}
        onFocus={() => setFocused(true)} onBlur={() => setFocused(false)}
        style={{
          width:'100%', padding:'10px 36px 10px 14px', borderRadius:10, boxSizing:'border-box',
          border:`1.5px solid ${focused ? T.forest : T.border}`,
          fontSize:13.5, fontWeight:500, color:T.textMain, background:T.bg,
          outline:'none', fontFamily:"'Inter',sans-serif", appearance:'none',
          cursor: disabled ? 'default' : 'pointer', transition:'border-color 0.15s, box-shadow 0.15s',
          boxShadow: focused ? `0 0 0 3px ${T.greenSoft}` : 'none',
          opacity: disabled ? 0.65 : 1
        }}
      >{children}</select>
      <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke={T.textMuted} strokeWidth="2.5"
        style={{ position:'absolute', right:12, top:'50%', transform:'translateY(-50%)', pointerEvents:'none' }}>
        <polyline points="6 9 12 15 18 9"/>
      </svg>
    </div>
  )
}

// ─── Unsaved Changes Action Bar ───────────────────────────────────────────────
function UnsavedChangesBar({ onDiscard, onSave, saving }) {
  return (
    <div style={{ 
      display: 'flex', alignItems: 'center', gap: '16px', background: '#FFFBEB', 
      padding: '8px 16px', borderRadius: '10px', border: '1px solid #FDE68A', 
      animation: 'fp-fadeIn 0.2s ease-out', flexWrap: 'wrap' 
    }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
        <div style={{ width: 24, height: 24, borderRadius: 6, background: '#FEF3C7', display: 'flex', alignItems: 'center', justifyContent: 'center', border: '1px solid #FCD34D' }}>
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="#D97706" strokeWidth="2.5"><circle cx="12" cy="12" r="10"/><line x1="12" y1="8" x2="12" y2="12"/><line x1="12" y1="16" x2="12.01" y2="16"/></svg>
        </div>
        <span style={{ fontSize: 13, color: T.textMain, fontWeight: 600, fontFamily: "'Inter', sans-serif" }}>
          <strong style={{ color: '#D97706' }}>Unsaved</strong> changes
        </span>
      </div>
      <div style={{ display: 'flex', gap: 8 }}>
        <button 
          onClick={onDiscard} disabled={saving} 
          style={{ padding: '6px 14px', borderRadius: 8, border: `1px solid ${T.border}`, background: '#fff', color: T.textMuted, fontSize: 12, fontWeight: 600, cursor: saving ? 'default' : 'pointer', fontFamily: "'Inter', sans-serif" }}
        >
          Discard
        </button>
        <button 
          onClick={onSave} disabled={saving} 
          style={{ 
            display:'inline-flex', alignItems:'center', gap:6, padding: '6px 14px', borderRadius: 8, border: 'none', 
            background: `linear-gradient(135deg, ${T.forest}, ${T.forestDeep})`, color: '#fff', fontSize: 12, fontWeight: 600, 
            cursor: saving ? 'default' : 'pointer', fontFamily: "'Inter', sans-serif", boxShadow: `0 3px 10px rgba(46,122,82,0.25)` 
          }}
        >
          {saving ? (
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" style={{ animation:'fp-spin .8s linear infinite' }}><path d="M21 12a9 9 0 1 1-6.219-8.56"/></svg>
          ) : (
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"><path d="M19 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h11l5 5v11a2 2 0 0 1-2 2z"/><polyline points="17 21 17 13 7 13 7 21"/><polyline points="7 3 7 8 15 8"/></svg>
          )}
          Save
        </button>
      </div>
    </div>
  )
}

// ─── Section Header ───────────────────────────────────────────────────────────
function SectionHeader({ icon, title, subtitle, action, dirty, onDiscard, onSave, saving, accentColor = T.forest, accentBg = T.greenSoft }) {
  return (
    <div style={{
      padding:'18px 24px',
      borderBottom:`1px solid ${T.borderLight}`,
      display:'flex', alignItems:'center', justifyContent:'space-between', flexWrap:'wrap', gap:12,
      background: `linear-gradient(135deg, ${T.bgAlt} 0%, ${T.bg} 100%)`
    }}>
      <div style={{ display:'flex', alignItems:'center', gap:12 }}>
        <div style={{
          width:38, height:38, borderRadius:11,
          background: accentBg,
          border:`1px solid ${accentColor}30`,
          display:'flex', alignItems:'center', justifyContent:'center',
          color:accentColor, flexShrink:0
        }}>
          {icon}
        </div>
        <div>
          <h2 style={{ fontSize:14.5, fontWeight:700, color:T.textMain, margin:0, lineHeight:1.2, fontFamily:"'Sora',sans-serif" }}>{title}</h2>
          {subtitle && <p style={{ fontSize:11.5, color:T.textMuted, margin:'3px 0 0', fontWeight:500 }}>{subtitle}</p>}
        </div>
      </div>
      
      {/* Show the Unsaved Changes Bar if dirty, else show standard action (if any) */}
      {dirty ? <UnsavedChangesBar onDiscard={onDiscard} onSave={onSave} saving={saving} /> : action}
    </div>
  )
}

// ─── Specialization Tag ───────────────────────────────────────────────────────
function SpecTag({ spec, courseMap = {}, readOnly }) {
  const [hovered, setHovered] = useState(false)

  // From faculty.py — Specialization model has: courseCode, title, rating
  // From course.py  — Course model has:         courseCode, title, program, ...
  // So spec.title is the correct direct field; courseMap[code] is the fallback via getCourses()
  const code = (spec.courseCode || '').trim().toUpperCase()
  const title =
    (spec.title && spec.title.trim()) ||          // ← faculty.py: Specialization.title
    (courseMap[code] && courseMap[code].trim()) || // ← course.py:  Course.title via getCourses()
    code                                           // ← last resort: never blank

  return (
    <div
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => setHovered(false)}
      style={{
        display:'inline-flex', alignItems:'center', gap:8,
        padding:'6px 8px 6px 12px', borderRadius:99,
        background: hovered && !readOnly ? T.specAccentSoft : T.specTagBg,
        border:`1.5px solid ${hovered && !readOnly ? T.specAccent : T.specAccentBorder}`,
        transition:'all 0.15s',
        boxShadow: hovered && !readOnly ? `0 2px 8px rgba(21,128,61,0.12)` : 'none',
      }}
    >
      {/* Green dot accent */}
      <div style={{
        width:6, height:6, borderRadius:'50%', flexShrink:0,
        background: T.specAccent, opacity: 0.7
      }}/>
      <span style={{ fontSize:12.5, fontWeight:600, color:T.textMain, fontFamily:"'Inter',sans-serif" }}>
        {title}
      </span>
      <span style={{
        fontSize:10, fontWeight:700, color:T.specAccentDeep,
        background:'#fff', padding:'2px 9px', borderRadius:99,
        border:`1.5px solid ${T.specAccentBorder}`,
        letterSpacing:'.3px', flexShrink:0
      }}>
        {spec.courseCode}
      </span>
    </div>
  )
}

// ─── Main Component ───────────────────────────────────────────────────────────
export default function FacultyProfilePage() {
  const { user } = useAuth()

  const [facultyId, setFacultyId] = useState(null)
  const [loading,   setLoading]   = useState(true)
  const [error,     setError]     = useState('')

  // ── Form State ──
  const [form, setForm] = useState({
    firstName:'', lastName:'', name:'', AcademicRank:'', Department:'',
    Educational_attainment:'', SexAtBirth:'', email:'', status:'full-time'
  })
  const [originalForm, setOriginalForm] = useState(null)
  const [infoSaving, setInfoSaving] = useState(false)
  const [infoError,  setInfoError]  = useState('')

  // ── Specs State ──
  const [specs,      setSpecs]      = useState([])
  const [courseMap,  setCourseMap]  = useState({})   // courseCode → title lookup
  const [specSaving, setSpecSaving] = useState(false)
  const [specError,  setSpecError]  = useState('')
  const [showSpecModal, setShowSpecModal] = useState(false)

  // ── Preferences State ──
  const [prefDays,  setPrefDays]  = useState(['Monday','Tuesday','Wednesday','Thursday','Friday'])
  const [prefStart, setPrefStart] = useState(7)
  const [prefEnd,   setPrefEnd]   = useState(17)
  const [originalPrefs, setOriginalPrefs] = useState(null)
  const [prefSaving, setPrefSaving] = useState(false)
  const [prefError,  setPrefError]  = useState('')

  const timeOptions = Array.from({ length:31 }, (_, i) => 6 + i * 0.5)

  useEffect(() => {
    if (!user) return

    // Step 1: Load faculty first — auth token is guaranteed ready here
    getFaculty()
      .then(list => {
        const me = list.find(f => f.email === user.email || f.id === user.uid) || list[0]
        if (!me) { setError('Profile not found. Contact your admin.'); setLoading(false); return }
        setFacultyId(me.id)

        const fetchedForm = {
          firstName: me.firstName || '',
          lastName:  me.lastName  || '',
          name:      me.name      || '',
          AcademicRank: me.AcademicRank || '',
          Department:   me.Department   || '',
          Educational_attainment: me.Educational_attainment || '',
          SexAtBirth:   me.SexAtBirth   || '',
          email:        me.email        || '',
          status:       me.status       || 'full-time',
        }
        setForm(fetchedForm)
        setOriginalForm(fetchedForm)

        // Specialization model (faculty.py): { courseCode, title, rating }
        setSpecs(Array.isArray(me.specializations) ? me.specializations : [])

        const fetchedPrefs = {
          days: me.preferredDays?.length > 0 ? me.preferredDays : ['Monday','Tuesday','Wednesday','Thursday','Friday'],
          start: me.preferredTimeStart ?? 7,
          end:   me.preferredTimeEnd   ?? 17
        }
        setPrefDays(fetchedPrefs.days)
        setPrefStart(fetchedPrefs.start)
        setPrefEnd(fetchedPrefs.end)
        setOriginalPrefs(fetchedPrefs)
        setLoading(false)

        // Step 2: Load courses for courseMap — done after faculty so token is warm
        // Course model (course.py): { courseCode, title, program, ... }
        getCourses()
          .then(courses => {
            if (!Array.isArray(courses)) return
            const map = {}
            courses.forEach(c => {
              const code = (c.courseCode || '').trim().toUpperCase()
              const label = (c.title || '').trim()   // course.py uses "title"
              if (code && label) map[code] = label
            })
            setCourseMap(map)
          })
          .catch(() => {
            // courseMap stays empty — tags will fall back to spec.title (also "title" in faculty.py)
          })
      })
      .catch(() => { setError('Could not load profile. Please refresh.'); setLoading(false) })
  }, [user])

  const avatarColor = useMemo(() => getAvatarColor(form.name || form.firstName), [form.name, form.firstName])
  const initials    = useMemo(() => getInitials(form.name || `${form.firstName} ${form.lastName}`), [form])
  const isPartTime  = form.status === 'part-time'

  // ── Dirty State Logic ──
  const isInfoChanged = useMemo(() => originalForm && JSON.stringify(form) !== JSON.stringify(originalForm), [form, originalForm])
  const isPrefsChanged = useMemo(() => originalPrefs && (
    JSON.stringify([...prefDays].sort()) !== JSON.stringify([...originalPrefs.days].sort()) ||
    prefStart !== originalPrefs.start ||
    prefEnd !== originalPrefs.end
  ), [prefDays, prefStart, prefEnd, originalPrefs])

  // ── Handlers ──
  function discardInfo() {
    setForm(originalForm)
    setInfoError('')
  }

  async function handleSaveInfo() {
    if (!facultyId) return
    setInfoSaving(true); setInfoError('')
    try {
      const { firstName, lastName, name, AcademicRank, Department, Educational_attainment, SexAtBirth } = form
      await updateFaculty(facultyId, { firstName, lastName, name, AcademicRank, Department, Educational_attainment, SexAtBirth })
      setOriginalForm(form)
    } catch {
      setInfoError('Failed to save. Please try again.')
    } finally {
      setInfoSaving(false)
    }
  }

  function discardPrefs() {
    setPrefDays(originalPrefs.days)
    setPrefStart(originalPrefs.start)
    setPrefEnd(originalPrefs.end)
    setPrefError('')
  }

  async function handleSavePrefs() {
    if (!facultyId) return
    setPrefSaving(true); setPrefError('')
    try {
      await updatePreferences(facultyId, {
        preferredDays: prefDays,
        preferredTimeStart: Number(prefStart),
        preferredTimeEnd:   Number(prefEnd),
      })
      setOriginalPrefs({ days: prefDays, start: prefStart, end: prefEnd })
    } catch {
      setPrefError('Failed to save preferences.')
    } finally {
      setPrefSaving(false)
    }
  }

  // Called by SpecializationModal onSave
  async function handleSaveSpecs(newSpecs) {
    if (!facultyId) return
    setSpecSaving(true); setSpecError('')
    try {
      const cleaned = (newSpecs || specs).filter(s => s.courseCode?.trim())
      await updateFaculty(facultyId, { specializations: cleaned })
      setSpecs(cleaned)
      setShowSpecModal(false)
    } catch {
      setSpecError('Failed to save specializations.')
    } finally {
      setSpecSaving(false)
    }
  }

  function toggleDay(day) {
    setPrefDays(d => d.includes(day) ? d.filter(x => x !== day) : [...d, day])
  }

  return (
    <div className="fp-page-wrap" style={{ fontFamily:"'Inter',sans-serif", color:T.textMain, minHeight:'100vh', background:T.bgPage, padding:'28px 32px 48px' }}>
      <style>{`
        @keyframes fp-shimmer { 0%{background-position:200% 0} 100%{background-position:-200% 0} }
        @keyframes fp-fadeUp  { from{opacity:0;transform:translateY(12px)} to{opacity:1;transform:none} }
        @keyframes fp-fadeIn  { from{opacity:0} to{opacity:1} }
        @keyframes fp-spin    { to{transform:rotate(360deg)} }

        /* ── Mobile responsive ── */
        @media (max-width: 768px) {
          .fp-page-wrap { padding: 16px 16px 40px !important; }
          .fp-hero      { padding: 18px 18px !important; border-radius: 14px !important; }
          .fp-hero h1   { font-size: 20px !important; }
          .fp-layout    { flex-direction: column !important; gap: 16px !important; }
          .fp-sidebar   { flex: none !important; width: 100% !important; min-width: 0 !important; }
          .fp-main      { min-width: 0 !important; }
          .fp-day-grid  { gap: 6px !important; }
          .fp-day-btn   { width: 42px !important; padding: 9px 0 !important; }
          .fp-section-header { flex-wrap: wrap; gap: 10px !important; }
          .fp-unsaved-bar { width: 100% !important; }
          .fp-manage-btn  { font-size: 11px !important; padding: 7px 12px !important; }
        }
        @media (max-width: 480px) {
          .fp-page-wrap { padding: 12px 12px 32px !important; }
          .fp-hero      { margin-bottom: 16px !important; }
          .fp-day-grid  { gap: 4px !important; }
          .fp-day-btn   { width: 38px !important; font-size: 10px !important; }
          .fp-grid-2    { grid-template-columns: 1fr !important; }
        }
      `}</style>

      {/* ── Page Hero ── */}
      <div className="fp-hero" style={{
        background: `linear-gradient(135deg, ${T.forest} 0%, ${T.forestDeep} 60%, #265242 100%)`,
        borderRadius:20, padding:'24px 28px',
        marginBottom:24, position:'relative', overflow:'hidden',
        boxShadow:'0 6px 28px rgba(46,122,82,0.22)',
        animation:'fp-fadeUp 0.3s ease both'
      }}>
        {/* Grid overlay */}
        <div style={{ position:'absolute', inset:0, zIndex:0, pointerEvents:'none', backgroundImage:`linear-gradient(rgba(255,255,255,0.06) 1px,transparent 1px),linear-gradient(90deg,rgba(255,255,255,0.06) 1px,transparent 1px)`, backgroundSize:'32px 32px' }}/>
        <div style={{ position:'absolute', bottom:-60, right:-60, width:280, height:280, background:'radial-gradient(ellipse,rgba(255,255,255,0.08) 0%,transparent 65%)', pointerEvents:'none', zIndex:0 }}/>

        <div style={{ position:'relative', zIndex:1, display:'flex', alignItems:'center', justifyContent:'space-between', gap:16, flexWrap:'wrap' }}>
          <div>
            <div style={{ display:'flex', alignItems:'center', gap:8, marginBottom:4 }}>
              <div style={{ width:24, height:24, borderRadius:6, background:'rgba(255,255,255,0.15)', display:'flex', alignItems:'center', justifyContent:'center' }}>
                <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="#fff" strokeWidth="2.5"><path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2"/><circle cx="12" cy="7" r="4"/></svg>
              </div>
              <span style={{ fontSize:10, fontWeight:700, color:'rgba(255,255,255,0.80)', textTransform:'uppercase', letterSpacing:'1px' }}>
                Faculty Profile
              </span>
            </div>
            <h1 className="fp-hero" style={{ fontFamily:"'Sora',sans-serif", fontSize:24, fontWeight:800, color:'#fff', margin:0, lineHeight:1.15, letterSpacing:'-.4px' }}>
              {loading ? 'My Profile' : (form.name || `${form.firstName} ${form.lastName}`.trim() || 'My Profile')}
            </h1>
            {!loading && form.AcademicRank && (
              <p style={{ fontSize:12.5, color:'rgba(255,255,255,0.7)', margin:'4px 0 0', fontWeight:500 }}>
                {form.AcademicRank}{form.Department ? ` · ${form.Department}` : ''}
              </p>
            )}
          </div>

          {!loading && (
            <div style={{
              padding:'6px 16px', borderRadius:99, fontSize:11, fontWeight:700, alignSelf:'center',
              background: isPartTime ? 'rgba(255,255,255,0.08)' : 'rgba(110,231,183,0.15)',
              color: isPartTime ? 'rgba(255,255,255,0.65)' : '#6EE7B7',
              border:`1px solid ${isPartTime ? 'rgba(255,255,255,0.15)' : 'rgba(110,231,183,0.30)'}`,
              textTransform: 'uppercase', letterSpacing: '.5px'
            }}>
              {isPartTime ? '⏰ Part-Time' : '✓ Full-Time'}
            </div>
          )}
        </div>
      </div>

      {error && (
        <div style={{ background:'#FEF2F2', border:'1px solid #FECACA', borderRadius:12, padding:'14px 18px', fontSize:13, color:'#B91C1C', marginBottom:24, display:'flex', gap:10, alignItems:'center' }}>
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><circle cx="12" cy="12" r="10"/><line x1="15" y1="9" x2="9" y2="15"/><line x1="9" y1="9" x2="15" y2="15"/></svg>
          {error}
        </div>
      )}

      <div className="fp-layout" style={{ display:'flex', gap:24, alignItems:'flex-start', flexWrap:'wrap' }}>

        {/* ── Left Sidebar ── */}
        <div className="fp-sidebar" style={{ flex:'0 0 260px', minWidth:240, display:'flex', flexDirection:'column', gap:16, animation:'fp-fadeUp 0.3s ease both' }}>

          {/* Avatar card */}
          <div style={{ background:T.bg, borderRadius:18, border:`1px solid ${T.border}`, overflow:'hidden', boxShadow:'0 1px 8px rgba(14,42,28,0.04)' }}>
            {/* Banner */}
            <div style={{
              height:80,
              background:`linear-gradient(135deg, ${avatarColor.bg}, ${T.greenBorder})`,
              position:'relative'
            }}>
              <div style={{ position:'absolute', bottom:-36, left:'50%', transform:'translateX(-50%)' }}>
                {loading ? (
                  <Skel w={76} h={76} r={38}/>
                ) : (
                  <div style={{
                    width:76, height:76, borderRadius:'50%',
                    background: avatarColor.bg,
                    color: avatarColor.fg,
                    display:'flex', alignItems:'center', justifyContent:'center',
                    fontSize:26, fontWeight:800, letterSpacing:'-1px', fontFamily:"'Sora',sans-serif",
                    border:`4px solid ${T.bg}`,
                    boxShadow:`0 4px 16px rgba(0,0,0,0.08)`
                  }}>{initials}</div>
                )}
              </div>
            </div>

            <div style={{ paddingTop:50, paddingBottom:24, paddingLeft:20, paddingRight:20, textAlign:'center' }}>
              {loading ? (
                <div style={{ display:'flex', flexDirection:'column', alignItems:'center', gap:8 }}>
                  <Skel w={130} h={16}/>
                  <Skel w={90} h={12}/>
                </div>
              ) : (
                <>
                  <div style={{ fontFamily:"'Sora',sans-serif", fontSize:16, fontWeight:700, color:T.textMain, lineHeight:1.3 }}>
                    {form.name || `${form.firstName} ${form.lastName}`.trim() || '—'}
                  </div>
                  {form.AcademicRank && <div style={{ fontSize:12.5, color:T.textMid, marginTop:4, fontWeight:500 }}>{form.AcademicRank}</div>}
                  {form.Department   && <div style={{ fontSize:11, color:T.textLight, marginTop:2, textTransform: 'uppercase', letterSpacing: '.5px', fontWeight: 600 }}>{form.Department}</div>}
                </>
              )}

              {/* Divider */}
              <div style={{ height:1, background:T.borderLight, margin:'16px 0' }}/>

              {/* Quick stats — only Specs */}
              {loading ? (
                <Skel w="100%" h={64} r={12} />
              ) : (
                <div style={{
                  background:T.bgAlt, borderRadius:12, border:`1px solid ${T.border}`,
                  padding:'16px 12px', display:'flex', flexDirection:'column', alignItems:'center', gap:2
                }}>
                  <div style={{ fontFamily:"'Sora',sans-serif", fontSize:28, fontWeight:800, color:T.forest, lineHeight:1 }}>{specs.length}</div>
                  <div style={{ fontSize:10, color:T.textMuted, fontWeight:700, textTransform:'uppercase', letterSpacing:'.6px', marginTop:4 }}>Specializations</div>
                </div>
              )}
            </div>
          </div>

          {/* Note card (Part time) */}
          {isPartTime && !loading && (
             <div style={{ background: T.orangeSoft, border:`1px solid ${T.orangeBorder}`, borderRadius:16, padding:'16px' }}>
               <div style={{ display:'flex', gap:10, alignItems:'flex-start' }}>
                 <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke={T.orangeDeep} strokeWidth="2" style={{ flexShrink:0, marginTop:1 }}><circle cx="12" cy="12" r="10"/><line x1="12" y1="8" x2="12" y2="12"/><line x1="12" y1="16" x2="12.01" y2="16"/></svg>
                 <div>
                   <div style={{ fontSize:11, fontWeight:700, color:T.orangeDeep, textTransform:'uppercase', letterSpacing:'.5px', marginBottom:6 }}>Notice</div>
                   <p style={{ fontSize:12, color:T.orangeDeep, lineHeight:1.5, margin:0, opacity: 0.9 }}>
                     Preference changes take effect on the <strong>next schedule generation</strong>.
                   </p>
                 </div>
               </div>
             </div>
          )}
        </div>

        {/* ── Right: Cards ── */}
        <div className="fp-main" style={{ flex:1, minWidth:300, display:'flex', flexDirection:'column', gap:24 }}>

          {/* ── Basic Info Card ── */}
          <div style={{ background:T.bg, borderRadius:18, border:`1px solid ${T.border}`, overflow:'hidden', boxShadow:'0 1px 8px rgba(14,42,28,0.04)', animation:'fp-fadeUp 0.3s ease 0.05s both' }}>
            <SectionHeader
              icon={<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2"/><circle cx="12" cy="7" r="4"/></svg>}
              title="Basic Information"
              subtitle="Your personal and academic details"
              dirty={isInfoChanged}
              saving={infoSaving}
              onDiscard={discardInfo}
              onSave={handleSaveInfo}
            />

            <div style={{ padding:24, display:'flex', flexDirection:'column', gap:0 }}>
              {infoError && (
                <div style={{ background:'#FEF2F2', border:'1px solid #FECACA', borderRadius:9, padding:'10px 14px', fontSize:12.5, color:'#B91C1C', marginBottom:16 }}>{infoError}</div>
              )}

              {/* Section: Identity */}
              <div style={{ marginBottom:24 }}>
                <div style={{ fontSize:10.5, fontWeight:700, color:T.textLight, textTransform:'uppercase', letterSpacing:'.7px', marginBottom:14, display:'flex', alignItems:'center', gap:8 }}>
                  <div style={{ flex:1, height:1, background:T.borderLight }}/>
                  Identity
                  <div style={{ flex:1, height:1, background:T.borderLight }}/>
                </div>
                <div className="fp-grid-2" style={{ display:'grid', gridTemplateColumns:'repeat(auto-fit, minmax(200px, 1fr))', gap:16 }}>
                  <FormField label="First Name">
                    {loading ? <Skel h={42} r={10}/> : (
                      <Input value={form.firstName} onChange={e => setForm(f => ({...f, firstName:e.target.value}))} placeholder="First name"/>
                    )}
                  </FormField>
                  <FormField label="Last Name">
                    {loading ? <Skel h={42} r={10}/> : (
                      <Input value={form.lastName} onChange={e => setForm(f => ({...f, lastName:e.target.value}))} placeholder="Last name"/>
                    )}
                  </FormField>
                </div>
                <div style={{ marginTop:16 }}>
                  <FormField label="Display Name" hint="This is how your name appears in schedules">
                    {loading ? <Skel h={42} r={10}/> : (
                      <Input value={form.name} onChange={e => setForm(f => ({...f, name:e.target.value}))} placeholder="Full display name"/>
                    )}
                  </FormField>
                </div>
              </div>

              {/* Section: Academic */}
              <div style={{ marginBottom:24 }}>
                <div style={{ fontSize:10.5, fontWeight:700, color:T.textLight, textTransform:'uppercase', letterSpacing:'.7px', marginBottom:14, display:'flex', alignItems:'center', gap:8 }}>
                  <div style={{ flex:1, height:1, background:T.borderLight }}/>
                  Academic
                  <div style={{ flex:1, height:1, background:T.borderLight }}/>
                </div>
                <div style={{ display:'grid', gridTemplateColumns:'repeat(auto-fit, minmax(200px, 1fr))', gap:16 }}>
                  <FormField label="Academic Rank">
                    {loading ? <Skel h={42} r={10}/> : (
                      <Select value={form.AcademicRank} onChange={e => setForm(f => ({...f, AcademicRank:e.target.value}))}>
                        <option value="">Select rank</option>
                        {['Instructor I','Instructor II','Instructor III','Assistant Professor I','Assistant Professor II','Assistant Professor III','Assistant Professor IV','Associate Professor I','Associate Professor II','Associate Professor III','Associate Professor IV','Associate Professor V','Professor I','Professor II','Professor III','Professor IV','Professor V','Professor VI'].map(r => <option key={r} value={r}>{r}</option>)}
                      </Select>
                    )}
                  </FormField>
                  <FormField label="Department">
                    {loading ? <Skel h={42} r={10}/> : (
                      <Input value={form.Department} onChange={e => setForm(f => ({...f, Department:e.target.value}))} placeholder="e.g. Computer Science"/>
                    )}
                  </FormField>
                </div>
              </div>

              {/* Section: Personal */}
              <div>
                <div style={{ fontSize:10.5, fontWeight:700, color:T.textLight, textTransform:'uppercase', letterSpacing:'.7px', marginBottom:14, display:'flex', alignItems:'center', gap:8 }}>
                  <div style={{ flex:1, height:1, background:T.borderLight }}/>
                  Personal
                  <div style={{ flex:1, height:1, background:T.borderLight }}/>
                </div>
                <div style={{ display:'grid', gridTemplateColumns:'repeat(auto-fit, minmax(200px, 1fr))', gap:16, marginBottom:16 }}>
                  <FormField label="Educational Attainment">
                    {loading ? <Skel h={42} r={10}/> : (
                      <Select value={form.Educational_attainment} onChange={e => setForm(f => ({...f, Educational_attainment:e.target.value}))}>
                        <option value="">Select</option>
                        {["Bachelor's Degree","Master's Degree","Doctorate (Ph.D.)","Post-Doctoral"].map(e => <option key={e} value={e}>{e}</option>)}
                      </Select>
                    )}
                  </FormField>
                  <FormField label="Sex at Birth">
                    {loading ? <Skel h={42} r={10}/> : (
                      <Select value={form.SexAtBirth} onChange={e => setForm(f => ({...f, SexAtBirth:e.target.value}))}>
                        <option value="">Select</option>
                        <option value="Male">Male</option>
                        <option value="Female">Female</option>
                      </Select>
                    )}
                  </FormField>
                </div>
                <FormField label="Email Address">
                  {loading ? <Skel h={42} r={10}/> : (
                    <Input value={form.email} disabled placeholder="Email address"/>
                  )}
                </FormField>
              </div>
            </div>
          </div>

          {/* ── Specializations Card ── */}
          <div style={{ background:T.bg, borderRadius:18, border:`1px solid ${T.specAccentBorder}`, overflow:'hidden', boxShadow:'0 1px 8px rgba(21,128,61,0.06)', animation:'fp-fadeUp 0.3s ease 0.1s both' }}>
            <SectionHeader
              icon={<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M22 11.08V12a10 10 0 1 1-5.93-9.14"/><polyline points="22 4 12 14.01 9 11.01"/></svg>}
              title="Specializations"
              subtitle={loading ? 'Courses you are qualified to teach' : `${specs.length} course${specs.length !== 1 ? 's' : ''} you are qualified to teach`}
              accentColor={T.specAccent}
              accentBg={T.specAccentSoft}
              action={loading ? <Skel w={150} h={38} r={10}/> : (
                <button
                  type="button"
                  onClick={() => setShowSpecModal(true)}
                  style={{
                    display:'inline-flex', alignItems:'center', gap:7,
                    padding:'9px 18px', borderRadius:10,
                    border:`1.5px solid ${T.specAccentBorder}`,
                    fontFamily:"'Inter',sans-serif", fontSize:12.5, fontWeight:700,
                    cursor:'pointer',
                    background: T.specAccentSoft,
                    color: T.specAccentDeep,
                    boxShadow:'0 1px 4px rgba(21,128,61,0.08)',
                    transition:'all 0.18s',
                  }}
                  onMouseEnter={e => { e.currentTarget.style.background = T.specAccent; e.currentTarget.style.color = '#fff'; e.currentTarget.style.borderColor = T.specAccent; e.currentTarget.style.boxShadow = '0 4px 12px rgba(21,128,61,0.25)' }}
                  onMouseLeave={e => { e.currentTarget.style.background = T.specAccentSoft; e.currentTarget.style.color = T.specAccentDeep; e.currentTarget.style.borderColor = T.specAccentBorder; e.currentTarget.style.boxShadow = '0 1px 4px rgba(21,128,61,0.08)' }}
                  className="fp-manage-btn"
                >
                  <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"><path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"/><path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"/></svg>
                  Manage Specializations
                </button>
              )}
            />

            <div style={{ padding:24 }}>
              {specError && (
                <div style={{ background:'#FEF2F2', border:'1px solid #FECACA', borderRadius:9, padding:'10px 14px', fontSize:12.5, color:'#B91C1C', marginBottom:16 }}>{specError}</div>
              )}

              {loading ? (
                <div style={{ display:'flex', gap:10, flexWrap:'wrap' }}>
                  {[1,2,3,4,5,6].map(i => <Skel key={i} w={i % 2 === 0 ? 140 : 110} h={34} r={99}/>)}
                </div>
              ) : specs.length === 0 ? (
                <div style={{
                  display:'flex', flexDirection:'column', alignItems:'center',
                  padding:'36px 20px', textAlign:'center',
                  background: T.specAccentSoft,
                  borderRadius:16, border:`2px dashed ${T.specAccentBorder}`
                }}>
                  <div style={{ width:52, height:52, borderRadius:16, background:'#fff', border:`1.5px solid ${T.specAccentBorder}`, display:'flex', alignItems:'center', justifyContent:'center', marginBottom:14, boxShadow:'0 2px 8px rgba(21,128,61,0.08)' }}>
                    <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke={T.specAccent} strokeWidth="2"><path d="M4 19.5A2.5 2.5 0 0 1 6.5 17H20"/><path d="M6.5 2H20v20H6.5A2.5 2.5 0 0 1 4 19.5v-15A2.5 2.5 0 0 1 6.5 2z"/></svg>
                  </div>
                  <div style={{ fontFamily:"'Sora',sans-serif", fontSize:15, fontWeight:700, color:T.textMain }}>No specializations yet</div>
                  <div style={{ fontSize:13, marginTop:6, color:T.textMuted, marginBottom:20, maxWidth:300, lineHeight:1.5 }}>Add the courses you are qualified to teach so the scheduler can assign them to you.</div>
                  <button
                    type="button"
                    onClick={() => setShowSpecModal(true)}
                    style={{
                      display:'inline-flex', alignItems:'center', gap:6,
                      padding:'10px 22px', borderRadius:10,
                      border:`1.5px solid ${T.specAccent}`,
                      background: T.specAccent, color:'#fff',
                      fontSize:13, fontWeight:700,
                      cursor:'pointer', fontFamily:"'Inter',sans-serif",
                      boxShadow:'0 3px 10px rgba(21,128,61,0.25)',
                      transition:'all 0.15s'
                    }}
                    onMouseEnter={e => { e.currentTarget.style.background = T.specAccentDeep; e.currentTarget.style.boxShadow = '0 4px 14px rgba(21,128,61,0.32)' }}
                    onMouseLeave={e => { e.currentTarget.style.background = T.specAccent; e.currentTarget.style.boxShadow = '0 3px 10px rgba(21,128,61,0.25)' }}
                  >
                    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"><line x1="12" y1="5" x2="12" y2="19"/><line x1="5" y1="12" x2="19" y2="12"/></svg>
                    Add Courses
                  </button>
                </div>
              ) : (
                <div>
                  {/* Count badge row */}
                  <div style={{ display:'flex', alignItems:'center', justifyContent:'space-between', marginBottom:14, flexWrap:'wrap', gap:8 }}>
                    <div style={{ display:'flex', alignItems:'center', gap:8 }}>
                      <div style={{ width:28, height:28, borderRadius:8, background:T.specAccentSoft, border:`1px solid ${T.specAccentBorder}`, display:'flex', alignItems:'center', justifyContent:'center' }}>
                        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke={T.specAccent} strokeWidth="2.5"><polyline points="20 6 9 17 4 12"/></svg>
                      </div>
                      <span style={{ fontSize:12.5, fontWeight:700, color:T.specAccentDeep }}>
                        {specs.length} Qualified Course{specs.length !== 1 ? 's' : ''}
                      </span>
                    </div>
                  </div>
                  <div style={{ display:'flex', gap:8, flexWrap:'wrap' }}>
                    {specs.map((spec, i) => (
                      <SpecTag key={i} spec={spec} courseMap={courseMap} readOnly />
                    ))}
                  </div>
                </div>
              )}
            </div>
          </div>

          {/* ── Preferences Card (part-time only) ── */}
          {(loading || isPartTime) && (
            <div style={{ background:T.bg, borderRadius:18, border:`1px solid ${T.border}`, overflow:'hidden', boxShadow:'0 1px 8px rgba(14,42,28,0.04)', animation:'fp-fadeUp 0.3s ease 0.15s both' }}>
              <SectionHeader
                accentColor={T.orangeDeep}
                accentBg={T.orangeSoft}
                icon={<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><rect x="3" y="4" width="18" height="18" rx="2" ry="2"/><line x1="16" y1="2" x2="16" y2="6"/><line x1="8" y1="2" x2="8" y2="6"/><line x1="3" y1="10" x2="21" y2="10"/></svg>}
                title="Teaching Availability"
                subtitle="Preferred days & time window (Part-Time)"
                dirty={isPrefsChanged}
                saving={prefSaving}
                onDiscard={discardPrefs}
                onSave={handleSavePrefs}
              />

              <div style={{ padding:24, display:'flex', flexDirection:'column', gap:24 }}>
                {prefError && (
                  <div style={{ background:'#FEF2F2', border:'1px solid #FECACA', borderRadius:9, padding:'10px 14px', fontSize:12.5, color:'#B91C1C' }}>{prefError}</div>
                )}

                {/* Day Picker — visual calendar-style */}
                <FormField label="Preferred Teaching Days">
                  {loading ? (
                    <div style={{ display:'flex', gap:8 }}>
                      {[1,2,3,4,5,6,7].map(i => <Skel key={i} w={48} h={64} r={14}/>)}
                    </div>
                  ) : (
                    <div className="fp-day-grid" style={{ display:'flex', gap:10, flexWrap:'wrap' }}>
                      {DAYS.map((day, di) => {
                        const on = prefDays.includes(day)
                        return (
                          <button className="fp-day-btn" key={day} type="button" onClick={() => toggleDay(day)} style={{
                            display:'flex', flexDirection:'column', alignItems:'center', gap:6,
                            padding:'12px 0', width:56, borderRadius:14,
                            fontFamily:"'Inter',sans-serif", transition:'all 0.15s',
                            cursor:'pointer', border: `1.5px solid ${on ? T.forest : T.border}`,
                            background: on ? T.greenSoft : T.bgAlt,
                            boxShadow: on ? `0 2px 8px rgba(46,122,82,0.15)` : 'none',
                          }}>
                            <span style={{ fontSize:11.5, fontWeight:700, color: on ? T.forest : T.textLight, textTransform:'uppercase', letterSpacing:'.3px' }}>
                              {DAY_SHORT[di]}
                            </span>
                            <div style={{
                              width:8, height:8, borderRadius:'50%',
                              background: on ? T.forest : T.border
                            }}/>
                          </button>
                        )
                      })}
                    </div>
                  )}
                </FormField>

                {/* Time range */}
                <div style={{ display:'grid', gridTemplateColumns:'repeat(auto-fit, minmax(180px, 1fr))', gap:20 }}>
                  <FormField label="Earliest Start">
                    {loading ? <Skel h={44} r={10}/> : (
                      <Select value={prefStart} onChange={e => setPrefStart(Number(e.target.value))}>
                        {timeOptions.filter(h => h < prefEnd).map(h => <option key={h} value={h}>{fmtTime(h)}</option>)}
                      </Select>
                    )}
                  </FormField>
                  <FormField label="Latest End">
                    {loading ? <Skel h={44} r={10}/> : (
                      <Select value={prefEnd} onChange={e => setPrefEnd(Number(e.target.value))}>
                        {timeOptions.filter(h => h > prefStart).map(h => <option key={h} value={h}>{fmtTime(h)}</option>)}
                      </Select>
                    )}
                  </FormField>
                </div>

                {/* Summary pill */}
                {!loading && (
                  <div style={{
                    background: T.bgAlt,
                    border:`1px solid ${T.border}`,
                    borderRadius:12, padding:'14px 18px',
                    display:'flex', alignItems:'center', gap:14, flexWrap:'wrap'
                  }}>
                    <div style={{ display:'flex', alignItems:'center', gap:10 }}>
                      <div style={{ width:34, height:34, borderRadius:10, background:'#fff', border:`1px solid ${T.border}`, display:'flex', alignItems:'center', justifyContent:'center' }}>
                        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke={T.textMuted} strokeWidth="2"><circle cx="12" cy="12" r="10"/><polyline points="12 6 12 12 16 14"/></svg>
                      </div>
                      <span style={{ fontSize:13.5, color:T.textMid, fontWeight:500 }}>
                        <strong style={{color:T.textMain, fontWeight: 700}}>{fmtTime(prefStart)}</strong>
                        {' – '}
                        <strong style={{color:T.textMain, fontWeight: 700}}>{fmtTime(prefEnd)}</strong>
                      </span>
                    </div>
                    <div style={{ width:1, height:24, background:T.borderLight }}/>
                    <span style={{ fontSize:12.5, color:T.textMuted, fontWeight:600 }}>
                      {prefDays.length} day{prefDays.length !== 1 ? 's' : ''} selected
                    </span>
                  </div>
                )}
              </div>
            </div>
          )}

        </div>
      </div>

      {/* ── Specialization Modal ── */}
      {showSpecModal && (
        <SpecializationModal
          specializations={specs}
          onSave={handleSaveSpecs}
          onClose={() => setShowSpecModal(false)}
          isSaving={specSaving}
        />
      )}
    </div>
  )
}