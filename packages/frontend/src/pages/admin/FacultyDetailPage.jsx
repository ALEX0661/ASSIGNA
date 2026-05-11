import { useState, useMemo } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import { addFaculty, updateFaculty, deleteFaculty, archiveFaculty, unarchiveFaculty, updateCredentials } from '../../services/api'

import {
  dedupeSpecs, getEffectiveMaxUnits, getTierLabel, getAvatarParts,
  useToast, useFacultyLoader,
  ToastContainer, DeleteConfirmModal, PageSkeleton,
} from '../../components/FacultyDetail/fdShared'

import { ProfileCard, UnitLoadCard, BasicInfoCard, SchedulePrefsCard, CredentialsCard } from '../../components/FacultyDetail/FacultyCards'
import SpecializationModal from '../../components/FacultyDetail/SpecializationModal'
import ScheduleSection     from '../../components/FacultyDetail/ScheduleSection'

export default function FacultyDetailPage() {
  const { id }   = useParams()
  const isNew    = id === 'new'
  const navigate = useNavigate()

  const { toasts, toast } = useToast()

  // ── Data ─────────────────────────────────────────────────────────────────────
  const {
    form, setForm,
    savedInfo,  setSavedInfo,
    savedPrefs, setSavedPrefs,
    pageLoading,
    credEmail,  setCredEmail,
  } = useFacultyLoader(id)

  // ── UI state ──────────────────────────────────────────────────────────────────
  const [password,         setPassword]         = useState('')
  const [showPassword,     setShowPassword]     = useState(false)
  const [deleting,         setDeleting]         = useState(false)
  const [archiving,        setArchiving]        = useState(false)
  const [showArchiveModal, setShowArchiveModal] = useState(false)
  const [showDeleteModal,  setShowDeleteModal]  = useState(false)
  const [showSpecModal,    setShowSpecModal]    = useState(false)
  const [specsExpanded,    setSpecsExpanded]    = useState(false)
  const [createdPassword,  setCreatedPassword]  = useState('')
  const [passwordCopied,   setPasswordCopied]   = useState(false)

  const [infoSaving,   setInfoSaving]   = useState(false)
  const [infoSaved,    setInfoSaved]    = useState(false)
  const [infoError,    setInfoError]    = useState('')
  const [prefSaving,   setPrefSaving]   = useState(false)
  const [prefSaved,    setPrefSaved]    = useState(false)
  const [prefError,    setPrefError]    = useState('')
  const [specSaving,   setSpecSaving]   = useState(false)
  const [createSaving, setCreateSaving] = useState(false)
  const [createError,  setCreateError]  = useState('')

  const [credPassword,  setCredPassword]  = useState('')
  const [credConfirm,   setCredConfirm]   = useState('')
  const [showCredPwd,   setShowCredPwd]   = useState(false)
  const [credSaving,    setCredSaving]    = useState(false)
  const [credError,     setCredError]     = useState('')
  const [credSuccess,   setCredSuccess]   = useState('')
  const [credActivated, setCredActivated] = useState(null)
  const [pwCopied,      setPwCopied]      = useState(false)

  const [scheduleUnits,       setScheduleUnits]       = useState(null)
  const [scheduleAssignments, setScheduleAssignments] = useState(null)

  // ── Derived ───────────────────────────────────────────────────────────────────
  const uniqueSpecs   = useMemo(() => dedupeSpecs(form.specializations), [form.specializations])
  const specCount     = uniqueSpecs.length
  const assignedCount = scheduleAssignments ?? 0
  const effectiveCap  = getEffectiveMaxUnits(form.status, assignedCount)
  const tierLabel     = getTierLabel(form.status, assignedCount)
  const displayUnits  = scheduleUnits ?? (form.units || 0)
  const isOverloaded  = displayUnits > effectiveCap
  const loadPct       = Math.min(100, (displayUnits / effectiveCap) * 100)
  const barBg         = isOverloaded ? 'linear-gradient(90deg,#E74C3C,#C0392B)' : loadPct > 80 ? 'linear-gradient(90deg,#D97706,#F59E0B)' : 'linear-gradient(90deg,#7C6FCD,#5a4fbf)'
  const statusBg      = form.status === 'full-time' ? '#E6FAF3' : '#F5F4FB'
  const statusCl      = form.status === 'full-time' ? '#059669' : '#8883B0'

  const infoChanged  = savedInfo  != null && ['name','firstName','lastName','status','AcademicRank','Department','Educational_attainment','SexAtBirth'].some(k => form[k] !== savedInfo[k])
  const prefsChanged = savedPrefs != null && (
    form.preferredTimeStart !== savedPrefs.preferredTimeStart ||
    form.preferredTimeEnd   !== savedPrefs.preferredTimeEnd   ||
    JSON.stringify([...(form.preferredDays || [])].sort()) !== JSON.stringify([...(savedPrefs.preferredDays || [])].sort())
  )

  const { fg: avFg, bg: avBg, initials: avInitials } = getAvatarParts(form.name || (isNew ? 'New' : '?'), form.firstName, form.lastName)

  // ── Handlers ──────────────────────────────────────────────────────────────────
  async function handleSaveInfo() {
    setInfoError(''); setInfoSaving(true)
    try {
      const { name, firstName, lastName, status, AcademicRank, Department, Educational_attainment, SexAtBirth } = form
      await updateFaculty(id, { name, firstName, lastName, status, AcademicRank, Department, Educational_attainment, SexAtBirth })
      setSavedInfo({ name, firstName, lastName, status, AcademicRank, Department, Educational_attainment, SexAtBirth })
      setInfoSaved(true); setTimeout(() => setInfoSaved(false), 2500)
    } catch (err) { setInfoError(err.response?.data?.detail || 'Save failed.') }
    finally { setInfoSaving(false) }
  }

  async function handleSavePrefs() {
    setPrefError(''); setPrefSaving(true)
    try {
      const { preferredDays, preferredTimeStart, preferredTimeEnd } = form
      await updateFaculty(id, { preferredDays, preferredTimeStart, preferredTimeEnd })
      setSavedPrefs({ preferredDays: [...(preferredDays || [])], preferredTimeStart, preferredTimeEnd })
      setPrefSaved(true); setTimeout(() => setPrefSaved(false), 2500)
    } catch (err) { setPrefError(err.response?.data?.detail || 'Save failed.') }
    finally { setPrefSaving(false) }
  }

  async function handleSaveSpecs(specs) {
    setSpecSaving(true)
    try {
      const cleaned = dedupeSpecs(specs).filter(s => s.courseCode?.trim())
      await updateFaculty(id, { specializations: cleaned })
      setForm(f => ({ ...f, specializations: cleaned }))
      setShowSpecModal(false)
      toast('Specializations saved successfully.', 'success')
    } catch (err) { alert(err.response?.data?.detail || 'Failed to save specializations.') }
    finally { setSpecSaving(false) }
  }

  async function handleSaveCredentials() {
    setCredError('')
    if (!credEmail.trim())                            { setCredError('Email address is required.'); return }
    if (credPassword && credPassword.length < 6)      { setCredError('Password must be at least 6 characters.'); return }
    if (credPassword && credPassword !== credConfirm) { setCredError('Passwords do not match.'); return }
    setCredSaving(true)
    try {
      const result = await updateCredentials(id, { email: credEmail.trim(), password: credPassword || undefined })
      if (result.migrated) {
        setCredActivated({ newId: result.new_id, tempPassword: result.temp_password })
      } else {
        setForm(f => ({ ...f, email: credEmail.trim() }))
        setSavedInfo(s => s ? { ...s, email: credEmail.trim() } : s)
        setCredPassword(''); setCredConfirm('')
        setCredSuccess(credPassword ? 'Email and password updated.' : 'Email updated.')
        setTimeout(() => setCredSuccess(''), 3000)
      }
    } catch (err) { setCredError(err.response?.data?.detail || 'Failed to update credentials.') }
    finally { setCredSaving(false) }
  }

  async function handleCreate(e) {
    e.preventDefault(); setCreateError(''); setCreateSaving(true)
    try {
      if (!form.email) { setCreateError('Email is required.'); setCreateSaving(false); return }
      const lastName = (form.name || '').trim().split(/\s+/).pop() || 'faculty'
      const result   = await addFaculty({ ...form, specializations: dedupeSpecs(form.specializations), initial_password: password || lastName + 'GC2026' })
      setCreatedPassword(result.temp_password || password || lastName + 'GC2026')
    } catch (err) { setCreateError(err.response?.data?.detail || 'Create failed.') }
    finally { setCreateSaving(false) }
  }

  async function handleDelete() {
    setDeleting(true)
    try {
      await deleteFaculty(id)
      toast('Faculty member deleted.', 'error')
      setTimeout(() => navigate('/dashboard/faculty'), 800)
    } catch { setDeleting(false) }
  }

  async function handleArchive() {
    setArchiving(true)
    try { await archiveFaculty(id); setForm(f => ({ ...f, archived: true })); setShowArchiveModal(false); toast('Faculty member archived.', 'info') }
    catch { /* leave modal open */ } finally { setArchiving(false) }
  }

  async function handleUnarchive() {
    setArchiving(true)
    try { await unarchiveFaculty(id); setForm(f => ({ ...f, archived: false })); toast('Faculty member restored successfully.', 'success') }
    catch { /* silently fail */ } finally { setArchiving(false) }
  }

  // ── Early-exit screens ────────────────────────────────────────────────────────
  if (pageLoading) return <PageSkeleton />

  if (credActivated) {
    const copyBg = pwCopied ? '#E6FAF3' : '#fff', copyCl = pwCopied ? '#059669' : '#7C6FCD'
    return (
      <div style={{ padding:'28px 32px', fontFamily:"'Poppins',sans-serif", maxWidth:560 }}>
        <div style={{ background:'#fff', borderRadius:18, border:'1px solid #E8E4F8', overflow:'hidden', boxShadow:'0 4px 20px rgba(124,111,205,0.1)' }}>
          <div style={{ padding:'24px 28px', borderBottom:'1px solid #F0EDF9', display:'flex', gap:14, alignItems:'center' }}>
            <div style={{ width:44, height:44, borderRadius:'50%', background:'#E6FAF3', display:'flex', alignItems:'center', justifyContent:'center', flexShrink:0 }}>
              <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="#059669" strokeWidth="2.5"><polyline points="20 6 9 17 4 12"/></svg>
            </div>
            <div>
              <div style={{ fontSize:15, fontWeight:700, color:'#059669' }}>Account activated</div>
              <div style={{ fontSize:12, color:'#8883B0', marginTop:2 }}>Firebase Auth account created and profile migrated.</div>
            </div>
          </div>
          <div style={{ padding:'24px 28px' }}>
            {credActivated.tempPassword ? (
              <>
                <div style={{ fontSize:11, fontWeight:700, color:'#8883B0', textTransform:'uppercase', letterSpacing:'.6px', marginBottom:10 }}>Auto-generated Password</div>
                <div style={{ display:'flex', gap:10, marginBottom:14 }}>
                  <code style={{ flex:1, padding:'12px 16px', background:'#F5F4FB', borderRadius:10, border:'1.5px solid #E8E4F8', fontSize:15, fontFamily:'monospace', letterSpacing:2, color:'#1a1a2e' }}>{credActivated.tempPassword}</code>
                  <button type="button" onClick={() => { navigator.clipboard.writeText(credActivated.tempPassword); setPwCopied(true); setTimeout(() => setPwCopied(false), 2000) }} style={{ padding:'12px 16px', borderRadius:10, border:'1.5px solid #E8E4F8', background:copyBg, color:copyCl, fontSize:12.5, fontWeight:600, cursor:'pointer', fontFamily:"'Poppins',sans-serif", whiteSpace:'nowrap' }}>
                    {pwCopied ? 'Copied!' : 'Copy'}
                  </button>
                </div>
              </>
            ) : (
              <div style={{ marginBottom:14, fontSize:12.5, color:'#4a4a6a' }}>Credentials saved. The faculty member can now log in with the password you set.</div>
            )}
            <div style={{ fontSize:11.5, color:'#B0ABCC', background:'#FAFAFE', borderRadius:8, padding:'10px 14px', border:'1px solid #F0EDF9', marginBottom:22 }}>The faculty member must log out and back in for their role to take effect.</div>
            <button type="button" onClick={() => { const dest = credActivated.newId || id; setCredActivated(null); navigate(`/dashboard/faculty/${dest}`) }} style={{ padding:'9px 18px', borderRadius:9, border:'none', background:'linear-gradient(135deg,#7C6FCD,#5a4fbf)', color:'#fff', fontSize:13, fontWeight:600, cursor:'pointer', fontFamily:"'Poppins',sans-serif" }}>
              Continue to Profile
            </button>
          </div>
        </div>
      </div>
    )
  }

  if (createdPassword) {
    const cpBg = passwordCopied ? '#E6FAF3' : '#fff', cpCl = passwordCopied ? '#059669' : '#7C6FCD'
    return (
      <div style={{ padding:'28px 32px', fontFamily:"'Poppins',sans-serif", maxWidth:560 }}>
        <div style={{ display:'flex', alignItems:'center', gap:10, marginBottom:22 }}>
          <button onClick={() => navigate('/dashboard/faculty')} style={{ background:'none', border:'none', color:'#8883B0', cursor:'pointer', display:'flex', alignItems:'center', gap:5, fontSize:12.5, fontFamily:"'Poppins',sans-serif", padding:0 }}>
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><line x1="19" y1="12" x2="5" y2="12"/><polyline points="12 19 5 12 12 5"/></svg>Faculty
          </button>
          <span style={{ fontSize:12.5, color:'#1a1a2e', fontWeight:600 }}>Account Created</span>
        </div>
        <div style={{ background:'#fff', borderRadius:18, border:'1px solid #E8E4F8', overflow:'hidden', boxShadow:'0 4px 20px rgba(124,111,205,0.1)' }}>
          <div style={{ padding:'24px 28px', borderBottom:'1px solid #F0EDF9', display:'flex', gap:14, alignItems:'center' }}>
            <div style={{ width:44, height:44, borderRadius:'50%', background:'#E6FAF3', display:'flex', alignItems:'center', justifyContent:'center', flexShrink:0 }}>
              <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="#059669" strokeWidth="2.5"><polyline points="20 6 9 17 4 12"/></svg>
            </div>
            <div>
              <div style={{ fontSize:15, fontWeight:700, color:'#059669' }}>Account created</div>
              <div style={{ fontSize:12, color:'#8883B0', marginTop:2 }}>Share the password with {form.name || form.email}.</div>
            </div>
          </div>
          <div style={{ padding:'24px 28px' }}>
            <div style={{ fontSize:11, fontWeight:700, color:'#8883B0', textTransform:'uppercase', letterSpacing:'.6px', marginBottom:10 }}>Temporary Password</div>
            <div style={{ display:'flex', gap:10, marginBottom:16 }}>
              <code style={{ flex:1, padding:'12px 16px', background:'#F5F4FB', borderRadius:10, border:'1.5px solid #E8E4F8', fontSize:15, fontFamily:'monospace', letterSpacing:2, color:'#1a1a2e' }}>{createdPassword}</code>
              <button onClick={() => { navigator.clipboard.writeText(createdPassword); setPasswordCopied(true); setTimeout(() => setPasswordCopied(false), 2000) }} style={{ padding:'12px 16px', borderRadius:10, border:'1.5px solid #E8E4F8', background:cpBg, color:cpCl, fontSize:12.5, fontWeight:600, cursor:'pointer', fontFamily:"'Poppins',sans-serif", whiteSpace:'nowrap' }}>
                {passwordCopied ? 'Copied!' : 'Copy'}
              </button>
            </div>
            <div style={{ fontSize:11.5, color:'#B0ABCC', background:'#FAFAFE', borderRadius:8, padding:'10px 14px', border:'1px solid #F0EDF9', marginBottom:22 }}>The faculty member must log out and back in to pick up their new role.</div>
            <div style={{ display:'flex', gap:10 }}>
              <button onClick={() => navigate('/dashboard/faculty')} style={{ padding:'9px 18px', borderRadius:9, border:'none', background:'linear-gradient(135deg,#7C6FCD,#5a4fbf)', color:'#fff', fontSize:13, fontWeight:600, cursor:'pointer', fontFamily:"'Poppins',sans-serif" }}>Back to Faculty List</button>
              <button onClick={() => { setCreatedPassword(''); setPassword('') }} style={{ padding:'9px 16px', borderRadius:9, border:'1.5px solid #E8E4F8', background:'#fff', color:'#8883B0', fontSize:13, fontWeight:600, cursor:'pointer', fontFamily:"'Poppins',sans-serif" }}>Add Another</button>
            </div>
          </div>
        </div>
      </div>
    )
  }

  // ── Main render ───────────────────────────────────────────────────────────────
  return (
    <div style={{ padding:'28px 32px', fontFamily:"'Poppins',sans-serif" }}>

      {/* Breadcrumb + actions */}
      <div style={{ display:'flex', alignItems:'center', gap:8, marginBottom:20, flexWrap:'wrap' }}>
        <div style={{ display:'flex', alignItems:'center', gap:8, flex:1 }}>
          <button onClick={() => navigate('/dashboard/faculty')} style={{ background:'none', border:'none', color:'#8883B0', cursor:'pointer', display:'flex', alignItems:'center', gap:5, fontSize:12.5, fontFamily:"'Poppins',sans-serif", padding:0 }}>
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><line x1="19" y1="12" x2="5" y2="12"/><polyline points="12 19 5 12 12 5"/></svg>Faculty
          </button>
          <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="#D8D3F5" strokeWidth="2"><line x1="5" y1="12" x2="19" y2="12"/><polyline points="12 5 19 12 12 19"/></svg>
          <span style={{ fontSize:12.5, color:'#1a1a2e', fontWeight:600 }}>{isNew ? 'New Faculty' : (form.name || 'Edit Faculty')}</span>
          {!isNew && form.status   && <span style={{ padding:'1px 8px', borderRadius:99, fontSize:10.5, fontWeight:700, background:statusBg, color:statusCl }}>{form.status}</span>}
          {!isNew && form.archived && <span style={{ padding:'1px 8px', borderRadius:99, fontSize:10.5, fontWeight:700, background:'#FEF3CD', color:'#B45309' }}>Archived</span>}
          {!isNew && isOverloaded  && <span style={{ padding:'1px 8px', borderRadius:99, fontSize:10.5, fontWeight:700, background:'#FFE8E8', color:'#C0392B' }}>Overloaded</span>}
        </div>

        {!isNew && (
          <div style={{ display:'flex', alignItems:'center', gap:6 }}>
            {form.archived ? (
              <button type="button" onClick={handleUnarchive} disabled={archiving} style={{ display:'inline-flex', alignItems:'center', gap:6, padding:'6px 12px', borderRadius:8, border:'1.5px solid #A7F3D0', background:'#E6FAF3', color:'#059669', fontSize:12, fontWeight:600, cursor: archiving ? 'default' : 'pointer', fontFamily:"'Poppins',sans-serif", opacity: archiving ? 0.7 : 1 }}>
                <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><polyline points="1 4 1 10 7 10"/><path d="M3.51 15a9 9 0 1 0 .49-3.5"/></svg>
                {archiving ? 'Restoring…' : 'Restore'}
              </button>
            ) : (
              <button type="button" onClick={() => setShowArchiveModal(true)} style={{ display:'inline-flex', alignItems:'center', gap:6, padding:'6px 12px', borderRadius:8, border:'1.5px solid #E8E4F8', background:'#fff', color:'#8883B0', fontSize:12, fontWeight:600, cursor:'pointer', fontFamily:"'Poppins',sans-serif" }}>
                <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M21 8v13H3V8"/><path d="M23 3H1v5h22z"/><line x1="10" y1="12" x2="14" y2="12"/></svg>Archive
              </button>
            )}
            <button type="button" onClick={() => setShowDeleteModal(true)} style={{ display:'inline-flex', alignItems:'center', gap:6, padding:'6px 12px', borderRadius:8, border:'1.5px solid #FFD0D0', background:'#FFF5F5', color:'#C0392B', fontSize:12, fontWeight:600, cursor:'pointer', fontFamily:"'Poppins',sans-serif" }}>
              <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><polyline points="3 6 5 6 21 6"/><path d="M19 6l-1 14a2 2 0 0 1-2 2H8a2 2 0 0 1-2-2L5 6"/><path d="M10 11v6M14 11v6"/></svg>Delete
            </button>
          </div>
        )}
      </div>

      {/* Banners */}
      {isNew && (
        <div style={{ background:'#EBF0FF', border:'1px solid #B3D4F5', borderRadius:12, padding:'12px 16px', marginBottom:20, display:'flex', gap:10, alignItems:'flex-start' }}>
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="#2563EB" strokeWidth="2" style={{ flexShrink:0, marginTop:1 }}><circle cx="12" cy="12" r="10"/><line x1="12" y1="8" x2="12" y2="12"/><line x1="12" y1="16" x2="12.01" y2="16"/></svg>
          <span style={{ fontSize:12.5, color:'#1a4a7c', lineHeight:1.5 }}>Adding a faculty member automatically creates their Firebase login account and assigns the faculty role.</span>
        </div>
      )}
      {!isNew && form.archived && (
        <div style={{ background:'#FEF3CD', border:'1px solid #FDE68A', borderRadius:12, padding:'12px 16px', marginBottom:20, display:'flex', gap:10, alignItems:'center' }}>
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="#D97706" strokeWidth="2" style={{ flexShrink:0 }}><path d="M21 8v13H3V8"/><path d="M23 3H1v5h22z"/><line x1="10" y1="12" x2="14" y2="12"/></svg>
          <span style={{ fontSize:12.5, color:'#92400E', lineHeight:1.5, flex:1 }}>This faculty member is <strong>archived</strong> and excluded from scheduling. Edits are still saved normally.</span>
          <button onClick={handleUnarchive} disabled={archiving} style={{ padding:'5px 14px', borderRadius:8, border:'1.5px solid #D97706', background:'#fff', color:'#B45309', fontSize:12, fontWeight:600, cursor: archiving ? 'default' : 'pointer', fontFamily:"'Poppins',sans-serif", flexShrink:0, opacity: archiving ? 0.7 : 1 }}>
            {archiving ? 'Restoring…' : 'Restore Now'}
          </button>
        </div>
      )}

      {/* Form */}
      <form onSubmit={handleCreate}>
        <div style={{ display:'flex', flexDirection:'column', gap:16 }}>

          {/* Two-column layout */}
          <div style={{ display:'flex', gap:24, flexWrap:'wrap', alignItems:'flex-start' }}>

            {/* Left column */}
            <div style={{ flex:'0 0 300px', minWidth:260, display:'flex', flexDirection:'column', gap:16 }}>
              <ProfileCard
                form={form} isNew={isNew} isOverloaded={isOverloaded}
                avInitials={avInitials} avFg={avFg} avBg={avBg}
                statusBg={statusBg} statusCl={statusCl}
                uniqueSpecs={uniqueSpecs} specsExpanded={specsExpanded} setSpecsExpanded={setSpecsExpanded}
                specCount={specCount} onOpenSpecModal={() => setShowSpecModal(true)}
              />
              {!isNew && (
                <UnitLoadCard
                  displayUnits={displayUnits} effectiveCap={effectiveCap}
                  isOverloaded={isOverloaded} loadPct={loadPct} tierLabel={tierLabel}
                  scheduleUnits={scheduleUnits} barBg={barBg}
                />
              )}
            </div>

            {/* Right column */}
            <div style={{ flex:1, minWidth:280, display:'flex', flexDirection:'column', gap:16 }}>
              <BasicInfoCard
                form={form} setForm={setForm} isNew={isNew}
                infoChanged={infoChanged} infoSaving={infoSaving} infoSaved={infoSaved} infoError={infoError} onSaveInfo={handleSaveInfo}
                password={password} setPassword={setPassword} showPassword={showPassword} setShowPassword={setShowPassword}
              />
              {form.status === 'part-time' && (
                <SchedulePrefsCard
                  form={form} setForm={setForm} isNew={isNew}
                  prefsChanged={prefsChanged} prefSaving={prefSaving} prefSaved={prefSaved} prefError={prefError} onSavePrefs={handleSavePrefs}
                />
              )}
              {isNew && (
                <div>
                  {createError && (
                    <div style={{ background:'#FFE8E8', border:'1px solid #FFCCCC', borderRadius:10, padding:'10px 14px', display:'flex', gap:8, alignItems:'center', marginBottom:12 }}>
                      <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="#C0392B" strokeWidth="2"><circle cx="12" cy="12" r="10"/><line x1="12" y1="8" x2="12" y2="12"/></svg>
                      <span style={{ fontSize:12.5, color:'#C0392B', fontWeight:500 }}>{createError}</span>
                    </div>
                  )}
                  <div style={{ display:'flex', gap:10 }}>
                    <button type="submit" disabled={createSaving} style={{ display:'inline-flex', alignItems:'center', gap:6, padding:'8px 18px', borderRadius:10, border:'none', fontFamily:"'Poppins',sans-serif", fontSize:12.5, fontWeight:600, cursor: createSaving ? 'default' : 'pointer', background:'linear-gradient(135deg,#7C6FCD,#5a4fbf)', color:'#fff', boxShadow:'0 3px 12px rgba(124,111,205,0.32)', opacity: createSaving ? 0.65 : 1 }}>
                      {createSaving ? 'Creating...' : 'Create Faculty'}
                    </button>
                    <button type="button" onClick={() => navigate('/dashboard/faculty')} style={{ display:'inline-flex', alignItems:'center', gap:6, padding:'8px 16px', borderRadius:10, border:'1.5px solid #E8E4F8', fontFamily:"'Poppins',sans-serif", fontSize:12.5, fontWeight:600, cursor:'pointer', background:'#fff', color:'#8883B0' }}>Cancel</button>
                  </div>
                </div>
              )}
            </div>
          </div>

          {/* Full-width rows — edit mode only */}
          {!isNew && (
            <>
              <CredentialsCard
                form={form}
                credEmail={credEmail} setCredEmail={setCredEmail}
                credPassword={credPassword} setCredPassword={setCredPassword}
                credConfirm={credConfirm} setCredConfirm={setCredConfirm}
                showCredPwd={showCredPwd} setShowCredPwd={setShowCredPwd}
                credSaving={credSaving} credError={credError} credSuccess={credSuccess}
                onSave={handleSaveCredentials}
              />
              <ScheduleSection
                facultyName={form.name}
                onUnitsLoaded={setScheduleUnits}
                onAssignmentsLoaded={setScheduleAssignments}
              />
            </>
          )}
        </div>
      </form>

      {/* Modals */}
      {showSpecModal && (
        <SpecializationModal
          specializations={form.specializations}
          onSave={isNew
            ? specs => { setForm(f => ({ ...f, specializations: dedupeSpecs(specs) })); setShowSpecModal(false) }
            : handleSaveSpecs
          }
          isSaving={specSaving}
          onClose={() => setShowSpecModal(false)}
        />
      )}

      {showArchiveModal && (
        <div style={{ position:'fixed', inset:0, zIndex:1100, background:'rgba(26,26,46,0.5)', backdropFilter:'blur(4px)', display:'flex', alignItems:'center', justifyContent:'center', padding:24 }}>
          <div style={{ background:'#fff', borderRadius:18, padding:'28px 28px 24px', maxWidth:400, width:'100%', boxShadow:'0 20px 60px rgba(26,26,46,0.22)', textAlign:'center' }}>
            <div style={{ width:52, height:52, borderRadius:'50%', background:'#FEF3CD', margin:'0 auto 16px', display:'flex', alignItems:'center', justifyContent:'center' }}>
              <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="#D97706" strokeWidth="2"><path d="M21 8v13H3V8"/><path d="M23 3H1v5h22z"/><line x1="10" y1="12" x2="14" y2="12"/></svg>
            </div>
            <div style={{ fontSize:16, fontWeight:700, color:'#1a1a2e', marginBottom:8 }}>Archive Faculty Member?</div>
            <div style={{ fontSize:13, color:'#8883B0', marginBottom:24, lineHeight:1.5 }}>
              <strong style={{ color:'#1a1a2e' }}>{form.name}</strong> will be hidden from active scheduling. You can restore them at any time.
            </div>
            <div style={{ display:'flex', gap:10 }}>
              <button onClick={() => setShowArchiveModal(false)} disabled={archiving} style={{ flex:1, padding:'10px', borderRadius:9, border:'1.5px solid #E8E4F8', background:'#fff', fontSize:13, fontWeight:600, color:'#8883B0', cursor:'pointer', fontFamily:"'Poppins',sans-serif" }}>Cancel</button>
              <button onClick={handleArchive} disabled={archiving} style={{ flex:1, padding:'10px', borderRadius:9, border:'none', background:'linear-gradient(135deg,#D97706,#B45309)', fontSize:13, fontWeight:700, color:'#fff', cursor: archiving ? 'default' : 'pointer', fontFamily:"'Poppins',sans-serif", opacity: archiving ? 0.7 : 1 }}>
                {archiving ? 'Archiving…' : 'Archive'}
              </button>
            </div>
          </div>
        </div>
      )}

      {showDeleteModal && (
        <DeleteConfirmModal name={form.name} deleting={deleting} onConfirm={handleDelete} onCancel={() => setShowDeleteModal(false)} />
      )}

      <ToastContainer toasts={toasts} />
    </div>
  )
}