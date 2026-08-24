import { useEffect, useState, useMemo } from 'react'
import { useAuth } from '../../hooks/useAuth'
import { getFaculty, updateFaculty, updatePreferences, getCourses, updateCredentials } from '../../services/api'
import SpecializationModal from '../../components/FacultyDetail/SpecializationModal'

// ─── Theme — matches FacultyCards/FacultyDetailPage exactly ──────────────────
const T = {
  green:        '#15803D',
  greenDeep:    '#0F5C2C',
  greenMid:     '#166534',
  greenSoft:    '#DCFCE7',
  greenBorder:  '#BBF7D0',
  textMain:     '#0E2A20',
  textMid:      '#1C3D2A',
  textMuted:    '#4B7060',
  textLight:    '#6B8C7A',
  border:       '#D8E8DF',
  borderLight:  '#EBF4EF',
  bg:           '#FFFFFF',
  bgAlt:        '#F2F7F4',
  bgPage:       '#F2F7F4',
  danger:       '#EF4444',
  dangerSoft:   '#FEF2F2',
  headerBg:     '#F0FDF4',
  headerBorder: '#BBF7D0',
  // Specialization accent
  specGreen:    '#15803D',
  specGreenDeep:'#0F5C2C',
  specGreenSoft:'#DCFCE7',
  specGreenBorder:'#BBF7D0',
  // Orange (part-time notice)
  orange:       '#D97706',
  orangeDeep:   '#92400E',
  orangeSoft:   '#FFFBEB',
  orangeBorder: '#FDE68A',
}

const DAYS      = ['Monday','Tuesday','Wednesday','Thursday','Friday','Saturday','Sunday']
const DAY_SHORT = ['Mo','Tu','We','Th','Fr','Sa','Su']

// ─── Helpers ──────────────────────────────────────────────────────────────────
function fmtTime(h) {
  const hi = Math.floor(h)
  const mi = h % 1 === 0.5 ? '30' : '00'
  const ampm = hi >= 12 && hi < 24 ? 'PM' : 'AM'
  const dh = hi > 12 ? hi - 12 : (hi === 0 ? 12 : hi)
  return `${dh}:${mi} ${ampm}`
}

function getInitials(name = '') {
  const parts = name.trim().split(/\s+/)
  if (parts.length >= 2) return (parts[0][0] + parts[parts.length - 1][0]).toUpperCase()
  return name.slice(0, 2).toUpperCase() || '?'
}

function getAvatarColor(name = '') {
  const palette = [
    { bg: '#D1FAE5', fg: '#059669' }, { bg: '#DBEAFE', fg: '#2563EB' },
    { bg: '#FCE7F3', fg: '#DB2777' }, { bg: '#EDE9FE', fg: '#7C3AED' },
    { bg: '#FEF3C7', fg: '#D97706' }, { bg: '#FFE4E6', fg: '#E11D48' },
  ]
  const code = name.split('').reduce((a, c) => a + c.charCodeAt(0), 0)
  return palette[code % palette.length]
}

// ─── Skeleton ─────────────────────────────────────────────────────────────────
function Skel({ w = '100%', h = 14, r = 8 }) {
  return (
    <div style={{
      width: w, height: h, borderRadius: r, flexShrink: 0,
      background: `linear-gradient(90deg,${T.headerBg} 25%,${T.bgAlt} 50%,${T.headerBg} 75%)`,
      backgroundSize: '200% 100%', animation: 'fp-shimmer 1.4s infinite',
    }} />
  )
}

// ─── Card Header — matches FacultyCards CardHeader exactly ───────────────────
function CardHeader({ title, sub, right }) {
  return (
    <div style={{
      padding: '14px 20px',
      background: T.headerBg,
      borderBottom: `1.5px solid ${T.headerBorder}`,
      display: 'flex', alignItems: 'center', gap: 12,
    }}>
      <div style={{ flex: 1, minWidth: 0 }}>
        <span style={{ fontSize: 13.5, fontWeight: 700, color: T.textMain, display: 'block', fontFamily: "'Sora',sans-serif" }}>{title}</span>
        {sub && <span style={{ fontSize: 11, color: T.textMuted, marginTop: 1, display: 'block' }}>{sub}</span>}
      </div>
      {right && <div style={{ flexShrink: 0 }}>{right}</div>}
    </div>
  )
}

// ─── Section Save Button — matches FacultyCards SectionSaveBtn style ─────────
function SaveBtn({ saving, saved, dirty, onClick }) {
  if (!dirty && !saving && !saved) return null
  return (
    <button
      type="button" onClick={onClick} disabled={saving}
      style={{
        display: 'inline-flex', alignItems: 'center', gap: 6,
        padding: '6px 14px', borderRadius: 8, border: 'none',
        background: saved ? T.greenSoft : `linear-gradient(135deg,${T.green},${T.greenDeep})`,
        color: saved ? T.greenDeep : '#fff',
        fontSize: 12, fontWeight: 600, cursor: saving ? 'default' : 'pointer',
        fontFamily: "'Inter',sans-serif",
        boxShadow: saved ? 'none' : `0 3px 10px rgba(15,92,44,0.28)`,
        opacity: saving ? 0.7 : 1, transition: 'all 0.2s',
      }}
    >
      {saving ? (
        <><svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"
          style={{ animation: 'fp-spin .8s linear infinite' }}><path d="M21 12a9 9 0 1 1-6.219-8.56"/></svg>Saving…</>
      ) : saved ? (
        <><svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke={T.greenDeep} strokeWidth="2.5"><polyline points="20 6 9 17 4 12"/></svg>Saved</>
      ) : (
        <><svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"><path d="M19 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h11l5 5v11a2 2 0 0 1-2 2z"/><polyline points="17 21 17 13 7 13 7 21"/><polyline points="7 3 7 8 15 8"/></svg>Save</>
      )}
    </button>
  )
}

// ─── Form Field ───────────────────────────────────────────────────────────────
function FormField({ label, hint, children, required }) {
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 5 }}>
      <label style={{ fontSize: 11, fontWeight: 700, color: T.textMuted, textTransform: 'uppercase', letterSpacing: '.6px' }}>
        {label}{required && <span style={{ color: T.danger, marginLeft: 3 }}>*</span>}
      </label>
      {children}
      {hint && <div style={{ fontSize: 11, color: T.textLight }}>{hint}</div>}
    </div>
  )
}

// ─── Shared input style ───────────────────────────────────────────────────────
const inputStyle = {
  padding: '10px 14px', borderRadius: 8, border: `1px solid ${T.border}`,
  fontSize: 13, fontFamily: "'Inter',sans-serif", width: '100%',
  boxSizing: 'border-box', outline: 'none', background: T.bg, color: T.textMain,
}
const selectStyle = { ...inputStyle }
const disabledInputStyle = { ...inputStyle, background: T.bgAlt, color: T.textMuted, opacity: 0.75 }

// ─── Specialization Tag ───────────────────────────────────────────────────────
function SpecTag({ spec, courseMap = {} }) {
  const code  = (spec.courseCode || '').trim().toUpperCase()
  const title = (spec.title && spec.title.trim()) || (courseMap[code] && courseMap[code].trim()) || code
  return (
    <div style={{
      display: 'inline-flex', alignItems: 'center', gap: 8,
      padding: '6px 8px 6px 12px', borderRadius: 99,
      background: T.bgAlt, border: `1.5px solid ${T.greenBorder}`,
    }}>
      <div style={{ width: 6, height: 6, borderRadius: '50%', flexShrink: 0, background: T.green, opacity: 0.7 }} />
      <span style={{ fontSize: 12.5, fontWeight: 600, color: T.textMain, fontFamily: "'Inter',sans-serif" }}>{title}</span>
      <span style={{
        fontSize: 10, fontWeight: 700, color: T.greenDeep,
        background: '#fff', padding: '2px 9px', borderRadius: 99,
        border: `1.5px solid ${T.greenBorder}`, letterSpacing: '.3px', flexShrink: 0,
      }}>{spec.courseCode}</span>
    </div>
  )
}

// ─── Main Component ───────────────────────────────────────────────────────────
export default function FacultyProfilePage() {
  const { user } = useAuth()

  const [facultyId,  setFacultyId]  = useState(null)
  const [loading,    setLoading]    = useState(true)
  const [error,      setError]      = useState('')

  // Form state
  const [form,         setForm]         = useState({ firstName:'', lastName:'', name:'', AcademicRank:'', Department:'', Educational_attainment:'', SexAtBirth:'', email:'', status:'full-time' })
  const [originalForm, setOriginalForm] = useState(null)
  const [infoSaving,   setInfoSaving]   = useState(false)
  const [infoSaved,    setInfoSaved]    = useState(false)
  const [infoError,    setInfoError]    = useState('')

  // Specs state
  const [specs,        setSpecs]        = useState([])
  const [courseMap,    setCourseMap]    = useState({})
  const [specSaving,   setSpecSaving]   = useState(false)
  const [specError,    setSpecError]    = useState('')
  const [showSpecModal,setShowSpecModal]= useState(false)

  // Prefs state
  const [prefDays,     setPrefDays]     = useState(['Monday','Tuesday','Wednesday','Thursday','Friday'])
  const [prefStart,    setPrefStart]    = useState(7)
  const [prefEnd,      setPrefEnd]      = useState(17)
  const [originalPrefs,setOriginalPrefs]= useState(null)
  const [prefSaving,   setPrefSaving]   = useState(false)
  const [prefSaved,    setPrefSaved]    = useState(false)
  const [prefError,    setPrefError]    = useState('')

  const timeOptions = Array.from({ length: 31 }, (_, i) => 6 + i * 0.5)

  // Credentials state
  const [credEmail,    setCredEmail]    = useState('')
  const [credPassword, setCredPassword] = useState('')
  const [credConfirm,  setCredConfirm]  = useState('')
  const [showCredPwd,  setShowCredPwd]  = useState(false)
  const [credSaving,   setCredSaving]   = useState(false)
  const [credError,    setCredError]    = useState('')
  const [credSuccess,  setCredSuccess]  = useState('')

  useEffect(() => {
    if (!user) return
    getFaculty()
      .then(list => {
        const me = list.find(f => f.email === user.email || f.id === user.uid) || list[0]
        if (!me) { setError('Profile not found. Contact your admin.'); setLoading(false); return }
        setFacultyId(me.id)
        const fetched = { firstName: me.firstName||'', lastName: me.lastName||'', name: me.name||'', AcademicRank: me.AcademicRank||'', Department: me.Department||'', Educational_attainment: me.Educational_attainment||'', SexAtBirth: me.SexAtBirth||'', email: me.email||'', status: me.status||'full-time' }
        setForm(fetched); setOriginalForm(fetched)
        setCredEmail(fetched.email)
        setSpecs(Array.isArray(me.specializations) ? me.specializations : [])
        const prefs = { days: me.preferredDays?.length > 0 ? me.preferredDays : ['Monday','Tuesday','Wednesday','Thursday','Friday'], start: me.preferredTimeStart ?? 7, end: me.preferredTimeEnd ?? 17 }
        setPrefDays(prefs.days); setPrefStart(prefs.start); setPrefEnd(prefs.end); setOriginalPrefs(prefs)
        setLoading(false)
        getCourses().then(courses => {
          if (!Array.isArray(courses)) return
          const map = {}
          courses.forEach(c => { const code = (c.courseCode||'').trim().toUpperCase(); const label = (c.title||'').trim(); if (code && label) map[code] = label })
          setCourseMap(map)
        }).catch(() => {})
      })
      .catch(() => { setError('Could not load profile. Please refresh.'); setLoading(false) })
  }, [user])

  const avatarColor = useMemo(() => getAvatarColor(form.name || form.firstName), [form.name, form.firstName])
  const initials    = useMemo(() => getInitials(form.name || `${form.firstName} ${form.lastName}`), [form])
  const isPartTime  = form.status === 'part-time'

  const isInfoChanged  = useMemo(() => originalForm && JSON.stringify(form) !== JSON.stringify(originalForm), [form, originalForm])
  const isPrefsChanged = useMemo(() => originalPrefs && (JSON.stringify([...prefDays].sort()) !== JSON.stringify([...originalPrefs.days].sort()) || prefStart !== originalPrefs.start || prefEnd !== originalPrefs.end), [prefDays, prefStart, prefEnd, originalPrefs])

  async function handleSaveInfo() {
    if (!facultyId) return
    setInfoSaving(true); setInfoError('')
    try {
      const { firstName, lastName, name, AcademicRank, Department, Educational_attainment, SexAtBirth } = form
      await updateFaculty(facultyId, { firstName, lastName, name, AcademicRank, Department, Educational_attainment, SexAtBirth })
      setOriginalForm(form); setInfoSaved(true); setTimeout(() => setInfoSaved(false), 2500)
    } catch { setInfoError('Failed to save. Please try again.') }
    finally { setInfoSaving(false) }
  }

  async function handleSavePrefs() {
    if (!facultyId) return
    setPrefSaving(true); setPrefError('')
    try {
      await updatePreferences(facultyId, { preferredDays: prefDays, preferredTimeStart: Number(prefStart), preferredTimeEnd: Number(prefEnd) })
      setOriginalPrefs({ days: prefDays, start: prefStart, end: prefEnd })
      setPrefSaved(true); setTimeout(() => setPrefSaved(false), 2500)
    } catch { setPrefError('Failed to save preferences.') }
    finally { setPrefSaving(false) }
  }

  async function handleSaveSpecs(newSpecs) {
    if (!facultyId) return
    setSpecSaving(true); setSpecError('')
    try {
      const cleaned = (newSpecs || specs).filter(s => s.courseCode?.trim())
      await updateFaculty(facultyId, { specializations: cleaned })
      setSpecs(cleaned); setShowSpecModal(false)
    } catch { setSpecError('Failed to save specializations.') }
    finally { setSpecSaving(false) }
  }

  async function handleSaveCredentials() {
    setCredError(''); setCredSuccess('')
    if (!credEmail.trim())                             { setCredError('Email address is required.'); return }
    if (credPassword && credPassword.length < 6)       { setCredError('Password must be at least 6 characters.'); return }
    if (credPassword && credPassword !== credConfirm)  { setCredError('Passwords do not match.'); return }
    if (!facultyId) return
    setCredSaving(true)
    try {
      await updateCredentials(facultyId, { email: credEmail.trim(), password: credPassword || undefined })
      setForm(f => ({ ...f, email: credEmail.trim() }))
      setOriginalForm(f => f ? { ...f, email: credEmail.trim() } : f)
      setCredPassword(''); setCredConfirm('')
      setCredSuccess(credPassword ? 'Email and password updated.' : 'Email updated.')
      setTimeout(() => setCredSuccess(''), 3500)
    } catch (err) {
      setCredError(err?.response?.data?.detail || 'Failed to update credentials.')
    } finally {
      setCredSaving(false)
    }
  }

  function toggleDay(day) { setPrefDays(d => d.includes(day) ? d.filter(x => x !== day) : [...d, day]) }

  return (
    <div className="fp-page-wrap" style={{ fontFamily: "'Inter',sans-serif", color: T.textMain, background: T.bgPage, padding: '20px 20px 48px', minHeight: '100vh' }}>
      <style>{`
        @keyframes fp-shimmer { 0%{background-position:200% 0} 100%{background-position:-200% 0} }
        @keyframes fp-fadeUp  { from{opacity:0;transform:translateY(10px)} to{opacity:1;transform:none} }
        @keyframes fp-spin    { to{transform:rotate(360deg)} }

        /* ── Tablet ── */
        @media (max-width: 768px) {
          .fp-layout       { flex-direction: column !important; }
          .fp-sidebar      { flex: none !important; width: 100% !important; min-width: 0 !important; }
          .fp-grid-2       { grid-template-columns: 1fr 1fr !important; }
          .fp-hero h1      { font-size: 19px !important; }
          .fp-hero-wrap    { padding: 18px 18px !important; border-radius: 14px !important; margin-bottom: 14px !important; }
          .fp-prefs-body   { flex-direction: column !important; gap: 16px !important; }
          .fp-prefs-divider{ display: none !important; }
          .fp-prefs-times  { flex-direction: row !important; flex-wrap: wrap !important; gap: 12px !important; }
          .fp-cred-grid    { grid-template-columns: 1fr !important; }
        }

        /* ── Mobile ── */
        @media (max-width: 480px) {
          .fp-grid-2       { grid-template-columns: 1fr !important; }
          .fp-hero-wrap    { padding: 14px 14px !important; border-radius: 12px !important; }
          .fp-hero h1      { font-size: 17px !important; }
          .fp-hero-badge   { display: none !important; }
          .fp-card-header  { flex-wrap: wrap; gap: 8px !important; }
          .fp-card-padding { padding: 14px 14px !important; }
          .fp-prefs-days   { gap: 6px !important; }
          .fp-prefs-pill   { padding: 6px 12px !important; font-size: 11.5px !important; }
          .fp-page-wrap    { padding: 12px 12px 40px !important; }
          .fp-save-btn-text { display: none !important; }
        }
      `}</style>

      {/* ── Hero banner ── */}
      <div className="fp-hero-wrap" style={{
        background: `linear-gradient(135deg, #3D7A58 0%, #2E6145 60%, #265242 100%)`,
        borderRadius: 20, padding: '24px 28px', marginBottom: 20,
        position: 'relative', overflow: 'hidden',
        boxShadow: '0 6px 28px rgba(46,122,82,0.22)',
        animation: 'fp-fadeUp 0.3s ease both',
      }}>
        <div style={{ position: 'absolute', inset: 0, zIndex: 0, pointerEvents: 'none', backgroundImage: `linear-gradient(rgba(255,255,255,0.06) 1px,transparent 1px),linear-gradient(90deg,rgba(255,255,255,0.06) 1px,transparent 1px)`, backgroundSize: '32px 32px' }} />
        <div style={{ position: 'absolute', bottom: -60, right: -60, width: 280, height: 280, background: 'radial-gradient(ellipse,rgba(255,255,255,0.08) 0%,transparent 65%)', pointerEvents: 'none', zIndex: 0 }} />
        <div style={{ position: 'relative', zIndex: 1, display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 16, flexWrap: 'wrap' }}>
          <div>
            <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 4 }}>
              <div style={{ width: 24, height: 24, borderRadius: 6, background: 'rgba(255,255,255,0.15)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="#fff" strokeWidth="2.5"><path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2"/><circle cx="12" cy="7" r="4"/></svg>
              </div>
              <span style={{ fontSize: 10, fontWeight: 700, color: 'rgba(255,255,255,0.80)', textTransform: 'uppercase', letterSpacing: '1px' }}>Faculty Profile</span>
            </div>
            <h1 className="fp-hero" style={{ fontFamily: "'Sora',sans-serif", fontSize: 24, fontWeight: 800, color: '#fff', margin: 0, lineHeight: 1.15, letterSpacing: '-.4px' }}>
              {loading ? 'My Profile' : (form.name || `${form.firstName} ${form.lastName}`.trim() || 'My Profile')}
            </h1>
            {!loading && form.AcademicRank && (
              <p style={{ fontSize: 12.5, color: 'rgba(255,255,255,0.7)', margin: '4px 0 0', fontWeight: 500 }}>
                {form.AcademicRank}{form.Department ? ` · ${form.Department}` : ''}
              </p>
            )}
          </div>
          {!loading && (
            <div className="fp-hero-badge" style={{ padding: '6px 16px', borderRadius: 99, fontSize: 11, fontWeight: 700, alignSelf: 'center', background: isPartTime ? 'rgba(255,255,255,0.08)' : 'rgba(110,231,183,0.15)', color: isPartTime ? 'rgba(255,255,255,0.65)' : '#6EE7B7', border: `1px solid ${isPartTime ? 'rgba(255,255,255,0.15)' : 'rgba(110,231,183,0.30)'}`, textTransform: 'uppercase', letterSpacing: '.5px' }}>
              {isPartTime ? 'Part-Time' : 'Full-Time'}
            </div>
          )}
        </div>
      </div>

      {error && (
        <div style={{ background: T.dangerSoft, border: '1px solid #FECACA', borderRadius: 12, padding: '12px 16px', fontSize: 13, color: '#B91C1C', marginBottom: 20, display: 'flex', gap: 10, alignItems: 'center' }}>
          <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><circle cx="12" cy="12" r="10"/><line x1="15" y1="9" x2="9" y2="15"/><line x1="9" y1="9" x2="15" y2="15"/></svg>
          {error}
        </div>
      )}

      <div className="fp-layout" style={{ display: 'flex', gap: 20, alignItems: 'flex-start' }}>

        {/* ── Left sidebar ── */}
        <div className="fp-sidebar" style={{ flex: '0 0 280px', minWidth: 260, display: 'flex', flexDirection: 'column', gap: 16, animation: 'fp-fadeUp 0.3s ease both' }}>

          {/* Profile card — dark green gradient header, matches FacultyCards ProfileCard */}
          <div style={{ background: T.bg, borderRadius: 16, border: `1px solid ${T.border}`, overflow: 'hidden', boxShadow: '0 4px 20px rgba(10,46,28,0.08)' }}>
            {/* Avatar header */}
            <div style={{ background: `linear-gradient(160deg,#166534 0%,${T.greenDeep} 100%)`, padding: '28px 24px 20px', display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 12, position: 'relative', overflow: 'hidden' }}>
              <div style={{ position: 'absolute', top: -30, right: -30, width: 100, height: 100, borderRadius: '50%', background: 'rgba(255,255,255,0.05)', pointerEvents: 'none' }} />
              <div style={{ position: 'absolute', bottom: -20, left: -14, width: 72, height: 72, borderRadius: '50%', background: 'rgba(255,255,255,0.04)', pointerEvents: 'none' }} />
              {loading ? (
                <Skel w={72} h={72} r={36} />
              ) : (
                <div style={{ width: 72, height: 72, borderRadius: '50%', background: `linear-gradient(135deg,${avatarColor.bg},${avatarColor.bg}bb)`, color: avatarColor.fg, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 24, fontWeight: 700, border: '3px solid rgba(255,255,255,0.3)', fontFamily: "'Sora',sans-serif", position: 'relative', zIndex: 1, boxShadow: '0 4px 16px rgba(0,0,0,0.2)' }}>
                  {initials}
                </div>
              )}
              <div style={{ textAlign: 'center', position: 'relative', zIndex: 1, maxWidth: '100%' }}>
                {loading ? (
                  <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 6 }}><Skel w={130} h={16} r={8} /><Skel w={90} h={12} r={6} /></div>
                ) : (
                  <>
                    <div style={{ fontSize: 15, fontWeight: 700, color: '#fff', lineHeight: 1.25, marginBottom: 3, textTransform: 'uppercase', fontFamily: "'Sora',sans-serif", letterSpacing: '.5px', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', maxWidth: 220 }}>
                      {form.name || `${form.firstName} ${form.lastName}`.trim() || '—'}
                    </div>
                    {form.AcademicRank && <div style={{ fontSize: 12, color: 'rgba(255,255,255,0.78)', fontWeight: 500 }}>{form.AcademicRank}</div>}
                    {form.Department   && <div style={{ fontSize: 11, color: 'rgba(255,255,255,0.55)', marginTop: 2 }}>{form.Department}</div>}
                  </>
                )}
              </div>
              {!loading && (
                <span style={{ padding: '3px 10px', borderRadius: 99, fontSize: 10.5, fontWeight: 600, background: 'rgba(255,255,255,0.16)', color: '#fff', border: '1px solid rgba(255,255,255,0.22)', textTransform: 'capitalize', position: 'relative', zIndex: 1 }}>
                  {form.status}
                </span>
              )}
            </div>

            {/* Manage Specializations button */}
            <div style={{ padding: '16px 20px' }}>
              {loading ? <Skel h={40} r={10} /> : (
                <button type="button" onClick={() => setShowSpecModal(true)}
                  style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', width: '100%', padding: '10px 14px', borderRadius: 10, background: T.bgAlt, color: T.greenDeep, border: `1.5px solid ${T.border}`, fontSize: 12.5, fontWeight: 600, cursor: 'pointer', fontFamily: "'Inter',sans-serif", transition: 'all 0.2s' }}
                  onMouseEnter={e => { e.currentTarget.style.background = T.greenSoft; e.currentTarget.style.borderColor = T.greenBorder }}
                  onMouseLeave={e => { e.currentTarget.style.background = T.bgAlt; e.currentTarget.style.borderColor = T.border }}
                >
                  <span style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M4 19.5A2.5 2.5 0 0 1 6.5 17H20"/><path d="M6.5 2H20v20H6.5A2.5 2.5 0 0 1 4 19.5v-15A2.5 2.5 0 0 1 6.5 2z"/></svg>
                    Manage Specializations
                  </span>
                  <span style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                    {specs.length > 0 && <span style={{ padding: '2px 8px', borderRadius: 99, background: T.greenSoft, color: T.greenDeep, fontSize: 10.5, fontWeight: 700, border: `1px solid ${T.greenBorder}` }}>{specs.length}</span>}
                    <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"><polyline points="9 18 15 12 9 6"/></svg>
                  </span>
                </button>
              )}
            </div>
          </div>

          {/* Part-time notice */}
          {isPartTime && !loading && (
            <div style={{ background: T.orangeSoft, border: `1px solid ${T.orangeBorder}`, borderRadius: 16, padding: 16 }}>
              <div style={{ display: 'flex', gap: 10, alignItems: 'flex-start' }}>
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke={T.orangeDeep} strokeWidth="2" style={{ flexShrink: 0, marginTop: 1 }}><circle cx="12" cy="12" r="10"/><line x1="12" y1="8" x2="12" y2="12"/><line x1="12" y1="16" x2="12.01" y2="16"/></svg>
                <div>
                  <div style={{ fontSize: 11, fontWeight: 700, color: T.orangeDeep, textTransform: 'uppercase', letterSpacing: '.5px', marginBottom: 5 }}>Notice</div>
                  <p style={{ fontSize: 12, color: T.orangeDeep, lineHeight: 1.5, margin: 0 }}>Preference changes take effect on the <strong>next schedule generation</strong>.</p>
                </div>
              </div>
            </div>
          )}
        </div>

        {/* ── Right column ── */}
        <div style={{ flex: 1, minWidth: 280, display: 'flex', flexDirection: 'column', gap: 16 }}>

          {/* ── Basic Information Card ── */}
          <div style={{ background: T.bg, borderRadius: 16, border: `1px solid ${T.border}`, overflow: 'hidden', boxShadow: '0 4px 20px rgba(10,46,28,0.08)', animation: 'fp-fadeUp 0.3s ease 0.05s both' }}>
            <CardHeader
              title="Basic Information"
              right={<SaveBtn dirty={isInfoChanged} saving={infoSaving} saved={infoSaved} onClick={handleSaveInfo} />}
            />
            <div style={{ padding: '24px 20px', display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '20px 24px' }}>
              {infoError && (
                <div style={{ gridColumn: '1/-1', background: T.dangerSoft, border: '1px solid #FECACA', borderRadius: 8, padding: '10px 14px', fontSize: 12.5, color: '#B91C1C', display: 'flex', gap: 8, alignItems: 'center' }}>
                  <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><circle cx="12" cy="12" r="10"/></svg>{infoError}
                </div>
              )}

              <FormField label="Last Name">
                {loading ? <Skel h={40} r={8} /> : (
                  <input value={form.lastName} onChange={e => setForm(f => ({ ...f, lastName: e.target.value }))} placeholder="Last name" style={inputStyle} />
                )}
              </FormField>
              <FormField label="First Name">
                {loading ? <Skel h={40} r={8} /> : (
                  <input value={form.firstName} onChange={e => setForm(f => ({ ...f, firstName: e.target.value }))} placeholder="First name" style={inputStyle} />
                )}
              </FormField>

              <FormField label="Academic Rank">
                {loading ? <Skel h={40} r={8} /> : (
                  <select value={form.AcademicRank} onChange={e => setForm(f => ({ ...f, AcademicRank: e.target.value }))} style={selectStyle}>
                    <option value="">Select rank…</option>
                    {['Instructor I','Instructor II','Instructor III','Assistant Professor I','Assistant Professor II','Assistant Professor III','Assistant Professor IV','Associate Professor I','Associate Professor II','Associate Professor III','Associate Professor IV','Associate Professor V','Professor I','Professor II','Professor III','Professor IV','Professor V','Professor VI'].map(r => <option key={r} value={r}>{r}</option>)}
                  </select>
                )}
              </FormField>
              <FormField label="Employment Status">
                {loading ? <Skel h={40} r={8} /> : (
                  <select value={form.status} onChange={e => setForm(f => ({ ...f, status: e.target.value }))} style={selectStyle}>
                    <option value="full-time">Full-time</option>
                    <option value="part-time">Part-time</option>
                  </select>
                )}
              </FormField>

              <FormField label="Department">
                {loading ? <Skel h={40} r={8} /> : (
                  <input value={form.Department} onChange={e => setForm(f => ({ ...f, Department: e.target.value }))} placeholder="e.g. Computer Science" style={inputStyle} />
                )}
              </FormField>
              <FormField label="Educational Attainment">
                {loading ? <Skel h={40} r={8} /> : (
                  <select value={form.Educational_attainment} onChange={e => setForm(f => ({ ...f, Educational_attainment: e.target.value }))} style={selectStyle}>
                    <option value="">Select…</option>
                    {["Bachelor's Degree","Master's Degree","Doctorate (Ph.D.)","Post-Doctoral"].map(e => <option key={e} value={e}>{e}</option>)}
                  </select>
                )}
              </FormField>

              <FormField label="Sex at Birth">
                {loading ? <Skel h={40} r={8} /> : (
                  <select value={form.SexAtBirth} onChange={e => setForm(f => ({ ...f, SexAtBirth: e.target.value }))} style={selectStyle}>
                    <option value="">Select…</option>
                    <option value="Male">Male</option>
                    <option value="Female">Female</option>
                    <option value="Other">Other / Prefer not to say</option>
                  </select>
                )}
              </FormField>

              <FormField label="Display Name" hint="How your name appears in schedules">
                {loading ? <Skel h={40} r={8} /> : (
                  <input value={form.name} onChange={e => setForm(f => ({ ...f, name: e.target.value }))} placeholder="Full display name" style={inputStyle} />
                )}
              </FormField>
            </div>
          </div>

        </div>{/* end right column */}
      </div>{/* end layout */}

      {/* ── Schedule Preferences Card — full width, part-time only ── */}
      {(loading || isPartTime) && (
        <div style={{ background: T.bg, borderRadius: 16, border: `1px solid ${T.border}`, overflow: 'hidden', boxShadow: '0 4px 20px rgba(10,46,28,0.08)', animation: 'fp-fadeUp 0.3s ease 0.15s both', marginTop: 16 }}>
          <CardHeader
            title="Schedule Preferences"
            sub="Preferred teaching days and time window"
            right={<SaveBtn dirty={isPrefsChanged} saving={prefSaving} saved={prefSaved} onClick={handleSavePrefs} />}
          />
          <div className="fp-prefs-body" style={{ padding: '20px 24px', display: 'flex', gap: 32, flexWrap: 'wrap', alignItems: 'flex-start' }}>

            {/* Days — pill style */}
            <div style={{ flex: '1 1 300px' }}>
              <div style={{ fontSize: 11, fontWeight: 700, color: T.textMuted, textTransform: 'uppercase', letterSpacing: '.6px', marginBottom: 10 }}>
                Preferred Teaching Days
              </div>
              {loading ? (
                <div style={{ display: 'flex', gap: 8 }}>{[1,2,3,4,5,6,7].map(i => <Skel key={i} w={56} h={34} r={99} />)}</div>
              ) : (
                <div className="fp-prefs-days" style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
                  {DAYS.map(day => {
                    const on = prefDays.includes(day)
                    return (
                      <button key={day} type="button" onClick={() => toggleDay(day)} className="fp-prefs-pill" style={{
                        padding: '7px 18px', fontSize: 12.5, borderRadius: 99, fontFamily: "'Inter',sans-serif",
                        background: on ? T.green : T.bgAlt, color: on ? '#fff' : T.textMuted,
                        border: on ? '1.5px solid transparent' : `1.5px solid ${T.border}`,
                        cursor: 'pointer', fontWeight: on ? 700 : 500, transition: 'all 0.15s',
                        boxShadow: on ? '0 2px 8px rgba(21,128,61,0.28)' : 'none',
                      }}>
                        {day.slice(0, 3)}
                      </button>
                    )
                  })}
                </div>
              )}
              <div style={{ marginTop: 8, fontSize: 11.5, color: T.textLight }}>
                {loading ? '' : prefDays.length === 0 ? 'No days selected' : `${prefDays.length} day${prefDays.length !== 1 ? 's' : ''} selected`}
              </div>
            </div>

            {/* Vertical divider */}
            <div className="fp-prefs-divider" style={{ width: 1, background: T.borderLight, alignSelf: 'stretch', flexShrink: 0, minHeight: 60 }} />

            {/* Time selects */}
            <div className="fp-prefs-times" style={{ flex: '0 0 auto', display: 'flex', gap: 20, alignItems: 'flex-end' }}>
              {[
                { label: 'Start Time', value: prefStart, onChange: e => setPrefStart(Number(e.target.value)), options: timeOptions.filter(h => h < prefEnd) },
                { label: 'End Time',   value: prefEnd,   onChange: e => setPrefEnd(Number(e.target.value)),   options: timeOptions.filter(h => h > prefStart) },
              ].map(({ label, value, onChange, options }) => (
                <div key={label} style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
                  <label style={{ fontSize: 11, fontWeight: 700, color: T.textMuted, textTransform: 'uppercase', letterSpacing: '.6px' }}>{label}</label>
                  {loading ? <Skel w={130} h={38} r={8} /> : (
                    <div style={{ position: 'relative' }}>
                      <select value={value} onChange={onChange} style={{ appearance: 'none', padding: '9px 36px 9px 14px', borderRadius: 8, border: `1.5px solid ${T.border}`, fontSize: 13, fontWeight: 600, fontFamily: "'Inter',sans-serif", background: T.bg, color: T.textMain, cursor: 'pointer', outline: 'none', width: 130, transition: 'border-color .15s' }}
                        onFocus={e => e.target.style.borderColor = T.green}
                        onBlur={e => e.target.style.borderColor = T.border}
                      >
                        {options.map(h => <option key={h} value={h}>{fmtTime(h)}</option>)}
                      </select>
                      <div style={{ position: 'absolute', right: 11, top: '50%', transform: 'translateY(-50%)', pointerEvents: 'none', color: T.green }}>
                        <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round"><polyline points="6 9 12 15 18 9"/></svg>
                      </div>
                    </div>
                  )}
                </div>
              ))}
            </div>
          </div>

          {prefError && (
            <div style={{ margin: '0 24px 20px', padding: '10px 14px', borderRadius: 8, background: T.dangerSoft, border: '1px solid #FECACA', display: 'flex', gap: 8, alignItems: 'center' }}>
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke={T.danger} strokeWidth="2"><circle cx="12" cy="12" r="10"/><line x1="12" y1="8" x2="12" y2="12"/></svg>
              <span style={{ fontSize: 12, color: T.danger, fontWeight: 500 }}>{prefError}</span>
            </div>
          )}
        </div>
      )}

      {/* ── Login Credentials Card — full width ── */}
      {!loading && (
        <div style={{ background: T.bg, borderRadius: 16, border: `1px solid ${T.border}`, overflow: 'hidden', boxShadow: '0 4px 20px rgba(10,46,28,0.08)', animation: 'fp-fadeUp 0.3s ease 0.2s both', marginTop: 16 }}>
          <CardHeader
            title="Login Credentials"
            sub={form.email ? undefined : 'No account activated yet'}
            right={
              form.email
                ? <span style={{ fontSize: 11, fontWeight: 700, padding: '3px 10px', borderRadius: 99, background: 'rgba(134,239,172,0.25)', color: '#059669', border: '1px solid rgba(134,239,172,0.5)' }}>Active</span>
                : <span style={{ fontSize: 11, fontWeight: 700, padding: '3px 10px', borderRadius: 99, background: 'rgba(239,68,68,0.15)', color: T.danger, border: '1px solid rgba(239,68,68,0.3)' }}>Not Activated</span>
            }
          />
          {!form.email && (
            <div style={{ margin: '20px 20px 0', padding: '12px 16px', borderRadius: 8, background: '#FFFBEB', border: '1px solid #FEF3C7', display: 'flex', gap: 10, alignItems: 'flex-start' }}>
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="#D97706" strokeWidth="2" style={{ flexShrink: 0, marginTop: 2 }}><path d="M10.29 3.86L1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z"/><line x1="12" y1="9" x2="12" y2="13"/><line x1="12" y1="17" x2="12.01" y2="17"/></svg>
              <span style={{ fontSize: 12, color: '#B45309', lineHeight: 1.5 }}>No login account yet. Set an email and password below to activate.</span>
            </div>
          )}
          <div style={{ padding: '24px 20px', display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: '20px 24px', alignItems: 'start' }}>
            <FormField label="Login Email" hint={form.email ? 'Change the email used to sign in' : 'Required — will be used as login'}>
              <input type="email" value={credEmail} onChange={e => setCredEmail(e.target.value)} autoComplete="off" style={inputStyle} />
            </FormField>

            <FormField label="New Password" hint={form.email ? 'Leave blank to keep current' : 'Auto-generated if blank'}>
              <div style={{ display: 'flex', gap: 8 }}>
                <input type={showCredPwd ? 'text' : 'password'} value={credPassword} onChange={e => setCredPassword(e.target.value)} autoComplete="new-password" placeholder={form.email ? 'Leave blank to keep' : 'Auto-generated if blank'} style={{ ...inputStyle, minWidth: 0, flex: 1 }} />
                <button type="button" onClick={() => setShowCredPwd(v => !v)} style={{ padding: '10px 12px', borderRadius: 8, border: `1px solid ${T.border}`, background: T.bgAlt, color: T.textMuted, fontSize: 12, fontWeight: 600, cursor: 'pointer', fontFamily: "'Inter',sans-serif", flexShrink: 0 }}>{showCredPwd ? 'Hide' : 'Show'}</button>
                <button type="button" onClick={() => { const ln = (form.name||'').trim().split(/\s+/).pop()||'faculty'; setCredPassword(ln+'GC2026'); setCredConfirm(ln+'GC2026'); setShowCredPwd(true) }} style={{ padding: '10px 12px', borderRadius: 8, border: `1.5px solid ${T.greenBorder}`, background: T.greenSoft, color: T.greenDeep, fontSize: 12, fontWeight: 600, cursor: 'pointer', fontFamily: "'Inter',sans-serif", flexShrink: 0, whiteSpace: 'nowrap' }}>Generate</button>
              </div>
            </FormField>

            <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
              {credPassword && (
                <FormField label="Confirm Password">
                  <input type={showCredPwd ? 'text' : 'password'} value={credConfirm} onChange={e => setCredConfirm(e.target.value)} autoComplete="new-password" placeholder="Re-enter password" style={{ ...inputStyle, borderColor: credConfirm && credConfirm !== credPassword ? '#FECACA' : T.border }} />
                  {credConfirm && credConfirm !== credPassword && <span style={{ fontSize: 11, color: T.danger, marginTop: 4, display: 'block', fontWeight: 500 }}>Passwords do not match</span>}
                </FormField>
              )}
              <div style={{ paddingTop: credPassword ? 0 : 24 }}>
                <button type="button" onClick={handleSaveCredentials} disabled={credSaving} style={{ display: 'inline-flex', alignItems: 'center', justifyContent: 'center', gap: 8, padding: '11px 20px', borderRadius: 8, border: 'none', fontFamily: "'Inter',sans-serif", fontSize: 13, fontWeight: 600, cursor: credSaving ? 'default' : 'pointer', background: `linear-gradient(135deg,${T.green},${T.greenDeep})`, color: '#fff', boxShadow: '0 4px 14px rgba(15,92,44,0.25)', opacity: credSaving ? 0.7 : 1, width: '100%', transition: 'all 0.2s' }}>
                  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"><rect x="3" y="11" width="18" height="11" rx="2"/><path d="M7 11V7a5 5 0 0 1 10 0v4"/></svg>
                  {credSaving ? 'Saving…' : (form.email ? 'Update Credentials' : 'Activate Account')}
                </button>
                {credSuccess && (
                  <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginTop: 12, fontSize: 12, color: '#166534', fontWeight: 600 }}>
                    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="#166534" strokeWidth="2.5"><polyline points="20 6 9 17 4 12"/></svg>
                    {credSuccess}
                  </div>
                )}
                {credError && (
                  <div style={{ padding: '10px 14px', borderRadius: 8, background: T.dangerSoft, border: '1px solid #FECACA', display: 'flex', gap: 8, alignItems: 'center', marginTop: 12 }}>
                    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke={T.danger} strokeWidth="2"><circle cx="12" cy="12" r="10"/><line x1="12" y1="8" x2="12" y2="12"/></svg>
                    <span style={{ fontSize: 12, color: T.danger, fontWeight: 500 }}>{credError}</span>
                  </div>
                )}
              </div>
            </div>
          </div>
        </div>
      )}

      {showSpecModal && (
        <SpecializationModal specializations={specs} onSave={handleSaveSpecs} onClose={() => setShowSpecModal(false)} isSaving={specSaving} />
      )}
    </div>
  )
}
