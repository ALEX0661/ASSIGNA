import { useEffect, useState, useMemo } from 'react'
import { useAuth } from '../../hooks/useAuth'
import { getFaculty, updateFaculty, updatePreferences } from '../../services/api'
import SpecializationModal from '../../components/FacultyDetail/SpecializationModal'

// ─── Theme ────────────────────────────────────────────────────────────────────
const T = {
  purple:      '#7C6FCD',
  purpleDeep:  '#5a4fbf',
  purpleSoft:  '#EEEAFB',
  purpleBorder:'#D8D3F5',
  textMain:    '#1a1a2e',
  textMid:     '#4a4a6a',
  textMuted:   '#8883B0',
  textLight:   '#B0ABCC',
  border:      '#E8E4F8',
  borderLight: '#F5F4FB',
  bg:          '#FFFFFF',
  bgAlt:       '#FAFAFE',
  green:       '#10B981',
  greenSoft:   '#ECFDF5',
  greenBorder: '#A7F3D0',
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
    { bg:'#EDE9FE', fg:'#7C3AED' }, { bg:'#DBEAFE', fg:'#2563EB' },
    { bg:'#FCE7F3', fg:'#DB2777' }, { bg:'#D1FAE5', fg:'#059669' },
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
      background:'linear-gradient(90deg,#EDE9F8 25%,#F5F3FC 50%,#EDE9F8 75%)',
      backgroundSize:'200% 100%', animation:'shimmer 1.4s infinite', flexShrink:0
    }}/>
  )
}

function FormField({ label, hint, children, icon }) {
  return (
    <div style={{ display:'flex', flexDirection:'column', gap:6 }}>
      <label style={{ display:'flex', alignItems:'center', gap:6, fontSize:11, fontWeight:700, color:T.textMuted, textTransform:'uppercase', letterSpacing:'.7px' }}>
        {icon && <span style={{ color:T.purple, opacity:0.7 }}>{icon}</span>}
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
        border:`1.5px solid ${focused ? T.purple : T.border}`,
        fontSize:13.5, fontWeight:500, color:T.textMain,
        background: disabled ? T.bgAlt : T.bg,
        outline:'none', fontFamily:"'Poppins',sans-serif",
        transition:'border-color 0.15s, box-shadow 0.15s',
        boxShadow: focused ? `0 0 0 3px ${T.purple}18` : 'none',
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
          border:`1.5px solid ${focused ? T.purple : T.border}`,
          fontSize:13.5, fontWeight:500, color:T.textMain, background:T.bg,
          outline:'none', fontFamily:"'Poppins',sans-serif", appearance:'none',
          cursor:'pointer', transition:'border-color 0.15s, box-shadow 0.15s',
          boxShadow: focused ? `0 0 0 3px ${T.purple}18` : 'none',
        }}
      >{children}</select>
      <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke={T.textMuted} strokeWidth="2.5"
        style={{ position:'absolute', right:12, top:'50%', transform:'translateY(-50%)', pointerEvents:'none' }}>
        <polyline points="6 9 12 15 18 9"/>
      </svg>
    </div>
  )
}

function SaveButton({ saving, saved, onClick, disabled, label='Save Changes' }) {
  const isSaved = saved && !saving
  return (
    <button type="button" onClick={onClick} disabled={saving || disabled} style={{
      display:'inline-flex', alignItems:'center', gap:7,
      padding:'9px 20px', borderRadius:10, border:'none',
      fontFamily:"'Poppins',sans-serif", fontSize:12.5, fontWeight:700,
      cursor: (saving || disabled) ? 'default' : 'pointer',
      background: isSaved
        ? T.greenSoft
        : `linear-gradient(135deg, ${T.purple}, ${T.purpleDeep})`,
      color: isSaved ? T.green : '#fff',
      boxShadow: isSaved || disabled ? 'none' : `0 4px 14px rgba(124,111,205,0.35)`,
      transition:'all 0.18s',
      opacity: disabled ? 0.55 : 1,
      border: isSaved ? `1.5px solid ${T.greenBorder}` : 'none'
    }}>
      {saving ? (
        <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" style={{ animation:'spin 0.8s linear infinite' }}>
          <path d="M21 12a9 9 0 1 1-6.219-8.56"/>
        </svg>
      ) : isSaved ? (
        <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"><polyline points="20 6 9 17 4 12"/></svg>
      ) : (
        <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"><path d="M19 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h11l5 5v11a2 2 0 0 1-2 2z"/><polyline points="17 21 17 13 7 13 7 21"/><polyline points="7 3 7 8 15 8"/></svg>
      )}
      {saving ? 'Saving…' : isSaved ? 'Saved!' : label}
    </button>
  )
}

// ─── Section Header ───────────────────────────────────────────────────────────
function SectionHeader({ icon, title, subtitle, action, accentColor = T.purple }) {
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
          background:`linear-gradient(135deg, ${accentColor}22, ${accentColor}11)`,
          border:`1px solid ${accentColor}30`,
          display:'flex', alignItems:'center', justifyContent:'center',
          color:accentColor, flexShrink:0
        }}>
          {icon}
        </div>
        <div>
          <h2 style={{ fontSize:14.5, fontWeight:700, color:T.textMain, margin:0, lineHeight:1.2 }}>{title}</h2>
          {subtitle && <p style={{ fontSize:11.5, color:T.textMuted, margin:'3px 0 0', fontWeight:500 }}>{subtitle}</p>}
        </div>
      </div>
      {action}
    </div>
  )
}

// ─── Specialization Tag ───────────────────────────────────────────────────────
function SpecTag({ spec, onRemove, readOnly }) {
  const [hovered, setHovered] = useState(false)
  return (
    <div
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => setHovered(false)}
      style={{
        display:'inline-flex', alignItems:'center', gap:6,
        padding:'6px 12px', borderRadius:99,
        background: hovered && !readOnly ? T.purpleSoft : '#F3F1FD',
        border:`1.5px solid ${hovered && !readOnly ? T.purpleBorder : '#E5E0FA'}`,
        transition:'all 0.15s'
      }}
    >
      <span style={{ fontSize:12.5, fontWeight:600, color:T.purpleDeep }}>
        {spec.courseCode}
        {spec.description && <span style={{ fontWeight:400, color:T.textMuted }}> — {spec.description}</span>}
      </span>
      {!readOnly && onRemove && (
        <button type="button" onClick={onRemove} style={{
          width:16, height:16, borderRadius:'50%', border:'none', cursor:'pointer', padding:0,
          background: hovered ? T.purpleBorder : 'transparent', color:T.textMuted,
          display:'flex', alignItems:'center', justifyContent:'center', transition:'all 0.15s'
        }}>
          <svg width="8" height="8" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg>
        </button>
      )}
    </div>
  )
}

// ─── Add Specialization Row ───────────────────────────────────────────────────
function AddSpecRow({ onAdd }) {
  const [code,  setCode]  = useState('')
  const [desc,  setDesc]  = useState('')
  const [open,  setOpen]  = useState(false)

  function handleAdd() {
    if (!code.trim()) return
    onAdd({ courseCode: code.trim(), description: desc.trim() })
    setCode(''); setDesc(''); setOpen(false)
  }

  if (!open) {
    return (
      <button type="button" onClick={() => setOpen(true)} style={{
        display:'inline-flex', alignItems:'center', gap:7, padding:'7px 16px',
        borderRadius:99, border:`1.5px dashed ${T.purpleBorder}`,
        background:'transparent', color:T.purple, fontSize:12.5, fontWeight:600,
        cursor:'pointer', fontFamily:"'Poppins',sans-serif", transition:'all 0.15s'
      }}>
        <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"><line x1="12" y1="5" x2="12" y2="19"/><line x1="5" y1="12" x2="19" y2="12"/></svg>
        Add Specialization
      </button>
    )
  }

  return (
    <div style={{
      background:T.bgAlt, border:`1.5px solid ${T.purpleBorder}`,
      borderRadius:12, padding:'14px 16px', display:'flex', gap:10, flexWrap:'wrap', alignItems:'flex-end'
    }}>
      <div style={{ flex:'0 0 140px' }}>
        <div style={{ fontSize:10.5, fontWeight:700, color:T.textMuted, textTransform:'uppercase', letterSpacing:'.5px', marginBottom:5 }}>Course Code</div>
        <Input value={code} onChange={e => setCode(e.target.value)} placeholder="e.g. CS101"/>
      </div>
      <div style={{ flex:1, minWidth:180 }}>
        <div style={{ fontSize:10.5, fontWeight:700, color:T.textMuted, textTransform:'uppercase', letterSpacing:'.5px', marginBottom:5 }}>Description (optional)</div>
        <Input value={desc} onChange={e => setDesc(e.target.value)} placeholder="e.g. Data Structures"/>
      </div>
      <div style={{ display:'flex', gap:8 }}>
        <button type="button" onClick={handleAdd} disabled={!code.trim()} style={{
          padding:'9px 18px', borderRadius:9, border:'none', fontFamily:"'Poppins',sans-serif",
          fontSize:12.5, fontWeight:700, cursor: code.trim() ? 'pointer' : 'default',
          background: code.trim() ? `linear-gradient(135deg,${T.purple},${T.purpleDeep})` : T.border,
          color: code.trim() ? '#fff' : T.textMuted,
          boxShadow: code.trim() ? `0 3px 10px rgba(124,111,205,0.25)` : 'none'
        }}>Add</button>
        <button type="button" onClick={() => { setOpen(false); setCode(''); setDesc('') }} style={{
          padding:'9px 14px', borderRadius:9, border:`1.5px solid ${T.border}`,
          fontFamily:"'Poppins',sans-serif", fontSize:12.5, fontWeight:600,
          cursor:'pointer', background:T.bg, color:T.textMuted
        }}>Cancel</button>
      </div>
    </div>
  )
}


// ─── Main Component ───────────────────────────────────────────────────────────
export default function FacultyProfilePage() {
  const { user } = useAuth()

  const [facultyId, setFacultyId] = useState(null)
  const [loading,   setLoading]   = useState(true)
  const [error,     setError]     = useState('')

  const [form,      setForm]      = useState({
    firstName:'', lastName:'', name:'', AcademicRank:'', Department:'',
    Educational_attainment:'', SexAtBirth:'', email:'', status:'full-time'
  })
  const [infoSaving, setInfoSaving] = useState(false)
  const [infoSaved,  setInfoSaved]  = useState(false)
  const [infoError,  setInfoError]  = useState('')

  const [specs,      setSpecs]      = useState([])
  const [specSaving, setSpecSaving] = useState(false)
  const [specError,  setSpecError]  = useState('')
  const [showSpecModal, setShowSpecModal] = useState(false)

  const [prefDays,  setPrefDays]  = useState(['Monday','Tuesday','Wednesday','Thursday','Friday'])
  const [prefStart, setPrefStart] = useState(7)
  const [prefEnd,   setPrefEnd]   = useState(17)
  const [prefSaving,setPrefSaving]= useState(false)
  const [prefSaved, setPrefSaved] = useState(false)
  const [prefError, setPrefError] = useState('')

  const timeOptions = Array.from({ length:31 }, (_, i) => 6 + i * 0.5)

  useEffect(() => {
    if (!user) return
    getFaculty()
      .then(list => {
        const me = list.find(f => f.email === user.email || f.id === user.uid) || list[0]
        if (!me) { setError('Profile not found. Contact your admin.'); return }
        setFacultyId(me.id)
        setForm({
          firstName: me.firstName || '',
          lastName:  me.lastName  || '',
          name:      me.name      || '',
          AcademicRank: me.AcademicRank || '',
          Department:   me.Department   || '',
          Educational_attainment: me.Educational_attainment || '',
          SexAtBirth:   me.SexAtBirth   || '',
          email:        me.email        || '',
          status:       me.status       || 'full-time',
        })
        setSpecs(Array.isArray(me.specializations) ? me.specializations : [])
        if (me.preferredDays?.length > 0)  setPrefDays(me.preferredDays)
        if (me.preferredTimeStart != null) setPrefStart(me.preferredTimeStart)
        if (me.preferredTimeEnd   != null) setPrefEnd(me.preferredTimeEnd)
      })
      .catch(() => setError('Could not load profile. Please refresh.'))
      .finally(() => setLoading(false))
  }, [user])

  const avatarColor = useMemo(() => getAvatarColor(form.name || form.firstName), [form.name, form.firstName])
  const initials    = useMemo(() => getInitials(form.name || `${form.firstName} ${form.lastName}`), [form])
  const isPartTime  = form.status === 'part-time'

  async function handleSaveInfo() {
    if (!facultyId) return
    setInfoSaving(true); setInfoError('')
    try {
      const { firstName, lastName, name, AcademicRank, Department, Educational_attainment, SexAtBirth } = form
      await updateFaculty(facultyId, { firstName, lastName, name, AcademicRank, Department, Educational_attainment, SexAtBirth })
      setInfoSaved(true); setTimeout(() => setInfoSaved(false), 2500)
    } catch {
      setInfoError('Failed to save. Please try again.')
    } finally {
      setInfoSaving(false)
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

  async function handleSavePrefs() {
    if (!facultyId) return
    setPrefSaving(true); setPrefError('')
    try {
      await updatePreferences(facultyId, {
        preferredDays: prefDays,
        preferredTimeStart: Number(prefStart),
        preferredTimeEnd:   Number(prefEnd),
      })
      setPrefSaved(true); setTimeout(() => setPrefSaved(false), 2500)
    } catch {
      setPrefError('Failed to save preferences.')
    } finally {
      setPrefSaving(false)
    }
  }

  function toggleDay(day) {
    setPrefDays(d => d.includes(day) ? d.filter(x => x !== day) : [...d, day])
    setPrefSaved(false)
  }


  return (
    <div style={{ fontFamily:"'Poppins',sans-serif", color:T.textMain, padding:'0 2px' }}>
      <style>{`
        @keyframes shimmer { 0%{background-position:200% 0} 100%{background-position:-200% 0} }
        @keyframes fadeUp  { from{opacity:0;transform:translateY(10px)} to{opacity:1;transform:translateY(0)} }
        @keyframes spin    { to{transform:rotate(360deg)} }
      `}</style>

      {/* ── Page Hero ── */}
      <div style={{
        marginBottom:28,
        background:'linear-gradient(135deg, #f0edfd 0%, #fafafe 60%, #f0f9ff 100%)',
        borderRadius:18, border:`1px solid ${T.border}`,
        padding:'24px 28px', position:'relative', overflow:'hidden'
      }}>
        {/* decorative circles */}
        <div style={{ position:'absolute', top:-30, right:-20, width:140, height:140, borderRadius:'50%', background:T.purple+'0B', pointerEvents:'none' }}/>
        <div style={{ position:'absolute', bottom:-20, right:80, width:90, height:90, borderRadius:'50%', background:T.purpleDeep+'08', pointerEvents:'none' }}/>

        <div style={{ display:'flex', alignItems:'flex-start', justifyContent:'space-between', flexWrap:'wrap', gap:16, position:'relative' }}>
          <div>
            <div style={{ display:'flex', alignItems:'center', gap:10, marginBottom:8 }}>
              <div style={{ width:32, height:32, borderRadius:9, background:`linear-gradient(135deg,${T.purple},${T.purpleDeep})`, display:'flex', alignItems:'center', justifyContent:'center' }}>
                <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="#fff" strokeWidth="2.2"><path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2"/><circle cx="12" cy="7" r="4"/></svg>
              </div>
              <span style={{ fontSize:11.5, fontWeight:700, color:T.purple, textTransform:'uppercase', letterSpacing:'.8px' }}>Faculty Profile</span>
            </div>
            <h1 style={{ fontSize:22, fontWeight:800, color:T.textMain, margin:0, lineHeight:1.2 }}>
              {loading ? 'My Profile' : (form.name || `${form.firstName} ${form.lastName}`.trim() || 'My Profile')}
            </h1>
            {!loading && form.AcademicRank && (
              <p style={{ fontSize:13, color:T.textMuted, margin:'5px 0 0', fontWeight:500 }}>
                {form.AcademicRank}{form.Department ? ` · ${form.Department}` : ''}
              </p>
            )}
          </div>

          {!loading && (
            <div style={{
              padding:'6px 16px', borderRadius:99, fontSize:12, fontWeight:700, alignSelf:'flex-start',
              background: isPartTime ? T.purpleSoft : T.greenSoft,
              color: isPartTime ? T.purpleDeep : T.green,
              border:`1.5px solid ${isPartTime ? T.purpleBorder : T.greenBorder}`,
            }}>
              {isPartTime ? '⏰ Part-Time' : '✓ Full-Time'}
            </div>
          )}
        </div>
      </div>

      {error && (
        <div style={{ background:'#FFF0F0', border:'1px solid #FECACA', borderRadius:12, padding:'14px 18px', fontSize:13, color:'#C0392B', marginBottom:24, display:'flex', gap:10, alignItems:'center' }}>
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><circle cx="12" cy="12" r="10"/><line x1="15" y1="9" x2="9" y2="15"/><line x1="9" y1="9" x2="15" y2="15"/></svg>
          {error}
        </div>
      )}

      <div style={{ display:'flex', gap:24, alignItems:'flex-start', flexWrap:'wrap' }}>

        {/* ── Left Sidebar ── */}
        <div style={{ flex:'0 0 236px', minWidth:210, display:'flex', flexDirection:'column', gap:16, animation:'fadeUp 0.3s ease both' }}>

          {/* Avatar card */}
          <div style={{ background:T.bg, borderRadius:18, border:`1px solid ${T.border}`, overflow:'hidden', boxShadow:'0 2px 12px rgba(124,111,205,0.07)' }}>
            {/* Banner */}
            <div style={{
              height:72,
              background:`linear-gradient(135deg, ${avatarColor.fg}CC, ${avatarColor.fg}88, ${T.purple}66)`,
              position:'relative'
            }}>
              <div style={{ position:'absolute', bottom:-32, left:'50%', transform:'translateX(-50%)' }}>
                {loading ? (
                  <Skel w={72} h={72} r={36}/>
                ) : (
                  <div style={{
                    width:72, height:72, borderRadius:'50%',
                    background: avatarColor.bg,
                    color: avatarColor.fg,
                    display:'flex', alignItems:'center', justifyContent:'center',
                    fontSize:24, fontWeight:800, letterSpacing:'-1px',
                    border:`4px solid ${T.bg}`,
                    boxShadow:`0 4px 16px ${avatarColor.fg}30`
                  }}>{initials}</div>
                )}
              </div>
            </div>

            <div style={{ paddingTop:44, paddingBottom:20, paddingLeft:20, paddingRight:20, textAlign:'center' }}>
              {loading ? (
                <div style={{ display:'flex', flexDirection:'column', alignItems:'center', gap:8 }}>
                  <Skel w={130} h={16}/>
                  <Skel w={90} h={12}/>
                </div>
              ) : (
                <>
                  <div style={{ fontSize:15, fontWeight:700, color:T.textMain, lineHeight:1.3 }}>
                    {form.name || `${form.firstName} ${form.lastName}`.trim() || '—'}
                  </div>
                  {form.AcademicRank && <div style={{ fontSize:12, color:T.textMuted, marginTop:4, fontWeight:500 }}>{form.AcademicRank}</div>}
                  {form.Department   && <div style={{ fontSize:11, color:T.textLight, marginTop:2 }}>{form.Department}</div>}
                </>
              )}

              {/* Divider */}
              <div style={{ height:1, background:T.borderLight, margin:'14px 0' }}/>

              {/* Quick stats — only Specs */}
              {loading ? (
                <Skel w="80%" h={56} r={10} />
              ) : (
                <div style={{
                  background:T.bgAlt, borderRadius:12, border:`1px solid ${T.border}`,
                  padding:'14px 12px', display:'flex', flexDirection:'column', alignItems:'center', gap:2
                }}>
                  <div style={{ fontSize:26, fontWeight:800, color:T.purple, lineHeight:1 }}>{specs.length}</div>
                  <div style={{ fontSize:10, color:T.textMuted, fontWeight:600, textTransform:'uppercase', letterSpacing:'.5px', marginTop:3 }}>Specializations</div>
                </div>
              )}
            </div>
          </div>

          {/* Note card */}
          <div style={{ background:'linear-gradient(135deg, #FFF8F0, #FFFBF5)', border:`1px solid #FDE68A`, borderRadius:13, padding:'14px 16px' }}>
            <div style={{ display:'flex', gap:8, alignItems:'flex-start' }}>
              <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="#D97706" strokeWidth="2" style={{ flexShrink:0, marginTop:1 }}><circle cx="12" cy="12" r="10"/><line x1="12" y1="8" x2="12" y2="12"/><line x1="12" y1="16" x2="12.01" y2="16"/></svg>
              <div>
                <div style={{ fontSize:11, fontWeight:700, color:'#92400E', textTransform:'uppercase', letterSpacing:'.5px', marginBottom:5 }}>Note</div>
                <p style={{ fontSize:11.5, color:'#78350F', lineHeight:1.6, margin:0 }}>
                  Preference changes take effect on the <strong>next schedule generation</strong>.
                </p>
              </div>
            </div>
          </div>
        </div>

        {/* ── Right: Cards ── */}
        <div style={{ flex:1, minWidth:300, display:'flex', flexDirection:'column', gap:20 }}>

          {/* ── Basic Info Card ── */}
          <div style={{ background:T.bg, borderRadius:18, border:`1px solid ${T.border}`, overflow:'hidden', boxShadow:'0 2px 12px rgba(124,111,205,0.05)', animation:'fadeUp 0.3s ease 0.05s both' }}>
            <SectionHeader
              icon={<svg width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2"/><circle cx="12" cy="7" r="4"/></svg>}
              title="Basic Information"
              subtitle="Your personal and academic details"
              action={loading ? <Skel w={130} h={38} r={10}/> : (
                <SaveButton saving={infoSaving} saved={infoSaved} onClick={handleSaveInfo}/>
              )}
            />

            <div style={{ padding:24, display:'flex', flexDirection:'column', gap:0 }}>
              {infoError && (
                <div style={{ background:'#FFF0F0', border:'1px solid #FECACA', borderRadius:9, padding:'10px 14px', fontSize:12.5, color:'#C0392B', marginBottom:16 }}>{infoError}</div>
              )}

              {/* Section: Identity */}
              <div style={{ marginBottom:20 }}>
                <div style={{ fontSize:10.5, fontWeight:700, color:T.textLight, textTransform:'uppercase', letterSpacing:'.7px', marginBottom:14, display:'flex', alignItems:'center', gap:8 }}>
                  <div style={{ flex:1, height:1, background:T.borderLight }}/>
                  Identity
                  <div style={{ flex:1, height:1, background:T.borderLight }}/>
                </div>
                <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr', gap:16 }}>
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
              <div style={{ marginBottom:20 }}>
                <div style={{ fontSize:10.5, fontWeight:700, color:T.textLight, textTransform:'uppercase', letterSpacing:'.7px', marginBottom:14, display:'flex', alignItems:'center', gap:8 }}>
                  <div style={{ flex:1, height:1, background:T.borderLight }}/>
                  Academic
                  <div style={{ flex:1, height:1, background:T.borderLight }}/>
                </div>
                <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr', gap:16 }}>
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
                <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr', gap:16, marginBottom:16 }}>
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
          <div style={{ background:T.bg, borderRadius:18, border:`1px solid ${T.border}`, overflow:'hidden', boxShadow:'0 2px 12px rgba(124,111,205,0.05)', animation:'fadeUp 0.3s ease 0.1s both' }}>
            <SectionHeader
              icon={<svg width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M22 11.08V12a10 10 0 1 1-5.93-9.14"/><polyline points="22 4 12 14.01 9 11.01"/></svg>}
              title="Specializations"
              subtitle={loading ? 'Courses you are qualified to teach' : `${specs.length} course${specs.length !== 1 ? 's' : ''} you are qualified to teach`}
              action={loading ? <Skel w={150} h={38} r={10}/> : (
                <button
                  type="button"
                  onClick={() => setShowSpecModal(true)}
                  style={{
                    display:'inline-flex', alignItems:'center', gap:7,
                    padding:'9px 18px', borderRadius:10, border:'none',
                    fontFamily:"'Poppins',sans-serif", fontSize:12.5, fontWeight:700,
                    cursor:'pointer',
                    background:`linear-gradient(135deg, ${T.purple}, ${T.purpleDeep})`,
                    color:'#fff',
                    boxShadow:`0 4px 14px rgba(124,111,205,0.35)`,
                    transition:'all 0.18s',
                  }}
                >
                  <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"><path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"/><path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"/></svg>
                  Manage Specializations
                </button>
              )}
            />

            <div style={{ padding:24 }}>
              {specError && (
                <div style={{ background:'#FFF0F0', border:'1px solid #FECACA', borderRadius:9, padding:'10px 14px', fontSize:12.5, color:'#C0392B', marginBottom:16 }}>{specError}</div>
              )}

              {loading ? (
                <div style={{ display:'flex', gap:10, flexWrap:'wrap' }}>
                  {[1,2,3,4].map(i => <Skel key={i} w={100} h={32} r={99}/>)}
                </div>
              ) : specs.length === 0 ? (
                <div style={{
                  display:'flex', flexDirection:'column', alignItems:'center',
                  padding:'32px 0', textAlign:'center',
                  background:`linear-gradient(135deg,#fafafe,#f5f3fd)`,
                  borderRadius:12, border:`1.5px dashed ${T.purpleBorder}`
                }}>
                  <div style={{ width:48, height:48, borderRadius:14, background:T.purpleSoft, display:'flex', alignItems:'center', justifyContent:'center', marginBottom:12 }}>
                    <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke={T.purple} strokeWidth="1.8"><path d="M4 19.5A2.5 2.5 0 0 1 6.5 17H20"/><path d="M6.5 2H20v20H6.5A2.5 2.5 0 0 1 4 19.5v-15A2.5 2.5 0 0 1 6.5 2z"/></svg>
                  </div>
                  <div style={{ fontSize:13.5, fontWeight:700, color:T.textMid }}>No specializations yet</div>
                  <div style={{ fontSize:12, marginTop:4, color:T.textMuted, marginBottom:16 }}>Click "Manage Specializations" to add courses you can teach.</div>
                  <button
                    type="button"
                    onClick={() => setShowSpecModal(true)}
                    style={{
                      display:'inline-flex', alignItems:'center', gap:6,
                      padding:'8px 18px', borderRadius:99,
                      border:`1.5px solid ${T.purpleBorder}`,
                      background:T.purpleSoft, color:T.purpleDeep,
                      fontSize:12.5, fontWeight:700,
                      cursor:'pointer', fontFamily:"'Poppins',sans-serif",
                    }}
                  >
                    <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"><line x1="12" y1="5" x2="12" y2="19"/><line x1="5" y1="12" x2="19" y2="12"/></svg>
                    Add Courses
                  </button>
                </div>
              ) : (
                <div style={{ display:'flex', gap:8, flexWrap:'wrap' }}>
                  {specs.map((spec, i) => (
                    <SpecTag key={i} spec={spec} readOnly />
                  ))}
                </div>
              )}
            </div>
          </div>

          {/* ── Preferences Card (part-time only) ── */}
          {(loading || isPartTime) && (
            <div style={{ background:T.bg, borderRadius:18, border:`1px solid ${T.border}`, overflow:'hidden', boxShadow:'0 2px 12px rgba(124,111,205,0.05)', animation:'fadeUp 0.3s ease 0.15s both' }}>
              <SectionHeader
                accentColor="#D97706"
                icon={<svg width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><rect x="3" y="4" width="18" height="18" rx="2" ry="2"/><line x1="16" y1="2" x2="16" y2="6"/><line x1="8" y1="2" x2="8" y2="6"/><line x1="3" y1="10" x2="21" y2="10"/></svg>}
                title="Teaching Availability"
                subtitle="Preferred days & time window (Part-Time faculty)"
                action={loading ? <Skel w={140} h={38} r={10}/> : (
                  <SaveButton saving={prefSaving} saved={prefSaved} onClick={handleSavePrefs} label="Save Preferences"/>
                )}
              />

              <div style={{ padding:24, display:'flex', flexDirection:'column', gap:20 }}>
                {!loading && (
                  <div style={{ background:'#FFFBEB', border:'1px solid #FDE68A', borderRadius:11, padding:'12px 16px', display:'flex', gap:10, alignItems:'flex-start' }}>
                    <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="#D97706" strokeWidth="2" style={{ flexShrink:0, marginTop:1 }}><circle cx="12" cy="12" r="10"/><line x1="12" y1="8" x2="12" y2="12"/><line x1="12" y1="16" x2="12.01" y2="16"/></svg>
                    <p style={{ fontSize:12.5, color:'#92400E', lineHeight:1.55, margin:0 }}>
                      As a <strong>part-time faculty</strong>, your availability is used to optimize class assignments during schedule generation.
                    </p>
                  </div>
                )}

                {prefError && (
                  <div style={{ background:'#FFF0F0', border:'1px solid #FECACA', borderRadius:9, padding:'10px 14px', fontSize:12.5, color:'#C0392B' }}>{prefError}</div>
                )}

                {/* Day Picker — visual calendar-style */}
                <FormField label="Preferred Teaching Days">
                  {loading ? (
                    <div style={{ display:'flex', gap:8 }}>
                      {[1,2,3,4,5,6,7].map(i => <Skel key={i} w={42} h={56} r={12}/>)}
                    </div>
                  ) : (
                    <div style={{ display:'flex', gap:8, flexWrap:'wrap' }}>
                      {DAYS.map((day, di) => {
                        const on = prefDays.includes(day)
                        return (
                          <button key={day} type="button" onClick={() => toggleDay(day)} style={{
                            display:'flex', flexDirection:'column', alignItems:'center', gap:5,
                            padding:'10px 0', width:52, borderRadius:13,
                            fontFamily:"'Poppins',sans-serif", transition:'all 0.15s',
                            cursor:'pointer', border:'none',
                            background: on
                              ? `linear-gradient(135deg, ${T.purple}, ${T.purpleDeep})`
                              : T.bgAlt,
                            boxShadow: on ? `0 4px 14px ${T.purple}35` : `inset 0 0 0 1.5px ${T.border}`,
                          }}>
                            <span style={{ fontSize:11, fontWeight:700, color: on ? '#fff' : T.textLight, textTransform:'uppercase', letterSpacing:'.3px' }}>
                              {DAY_SHORT[di]}
                            </span>
                            <div style={{
                              width:8, height:8, borderRadius:'50%',
                              background: on ? 'rgba(255,255,255,0.7)' : T.border
                            }}/>
                          </button>
                        )
                      })}
                    </div>
                  )}
                </FormField>

                {/* Time range */}
                <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr', gap:20 }}>
                  <FormField label="Earliest Start">
                    {loading ? <Skel h={44} r={10}/> : (
                      <Select value={prefStart} onChange={e => { setPrefStart(Number(e.target.value)); setPrefSaved(false) }}>
                        {timeOptions.filter(h => h < prefEnd).map(h => <option key={h} value={h}>{fmtTime(h)}</option>)}
                      </Select>
                    )}
                  </FormField>
                  <FormField label="Latest End">
                    {loading ? <Skel h={44} r={10}/> : (
                      <Select value={prefEnd} onChange={e => { setPrefEnd(Number(e.target.value)); setPrefSaved(false) }}>
                        {timeOptions.filter(h => h > prefStart).map(h => <option key={h} value={h}>{fmtTime(h)}</option>)}
                      </Select>
                    )}
                  </FormField>
                </div>

                {/* Summary pill */}
                {!loading && (
                  <div style={{
                    background:`linear-gradient(135deg, ${T.purpleSoft}, ${T.bgAlt})`,
                    border:`1px solid ${T.purpleBorder}`,
                    borderRadius:11, padding:'12px 16px',
                    display:'flex', alignItems:'center', gap:12, flexWrap:'wrap'
                  }}>
                    <div style={{ display:'flex', alignItems:'center', gap:7 }}>
                      <div style={{ width:30, height:30, borderRadius:8, background:T.bg, border:`1px solid ${T.purpleBorder}`, display:'flex', alignItems:'center', justifyContent:'center' }}>
                        <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke={T.purple} strokeWidth="2"><circle cx="12" cy="12" r="10"/><polyline points="12 6 12 12 16 14"/></svg>
                      </div>
                      <span style={{ fontSize:12.5, color:T.textMid, fontWeight:600 }}>
                        <strong style={{color:T.textMain}}>{fmtTime(prefStart)}</strong>
                        {' – '}
                        <strong style={{color:T.textMain}}>{fmtTime(prefEnd)}</strong>
                      </span>
                    </div>
                    <div style={{ width:1, height:20, background:T.purpleBorder }}/>
                    <span style={{ fontSize:12, color:T.textMuted, fontWeight:600 }}>
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