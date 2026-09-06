import { useState, useMemo, useEffect } from 'react'
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
import { useTour } from '../../hooks/useTour.jsx'

const TOUR_SEEN_KEY = 'adminFacultyDetail_tourSeen'
function isOnboardingCompleted() {
  try { return localStorage.getItem(TOUR_SEEN_KEY) === '1' } catch { return true }
}
function markOnboardingCompleted() {
  try { localStorage.setItem(TOUR_SEEN_KEY, '1') } catch {}
}

const FACULTY_STYLE = ``;

export default function FacultyDetailPage() {
  const { id }   = useParams()
  const isNew    = false
  const navigate = useNavigate()

  const { toasts, toast } = useToast()

  const { TourElement, startTour } = useTour('adminFacultyDetail', [
    {
      target: '#tour-fac-actions',
      title: 'Archive or Delete',
      content: 'Archive removes a faculty member from scheduling while keeping their record and history — use this over Delete for anyone who\'s just on leave or no longer teaching. Delete is permanent.',
      disableBeacon: true,
    },
    {
      target: '#tour-fac-profile',
      title: 'Profile Overview',
      content: 'Name, status, and specializations at a glance. Click into specializations here to add or edit the courses this faculty member is qualified to teach.',
      placement: 'right',
    },
    {
      target: '#tour-fac-load',
      title: 'Unit Load',
      content: 'Shows how many units they\'re currently assigned against their cap for their status (full-time/part-time). It turns red when they\'re over capacity — worth checking before finalizing a schedule.',
      placement: 'right',
    },
    {
      target: '#tour-fac-basic-info',
      title: 'Basic Information',
      content: 'Core details — name, rank, department, education, and status. Changing status between full-time and part-time also changes their unit cap and whether schedule preferences apply.',
      placement: 'auto',
    },
    {
      target: '#tour-fac-credentials',
      title: 'Login Credentials',
      content: 'Set or update the email and password this faculty member uses to log in. Changing the email can migrate their account, so a temporary password may be generated — make sure to share it with them.',
      placement: 'auto',
    },
    {
      target: '#tour-fac-schedule-header',
      title: 'Teaching Schedule',
      content: 'Their actual assigned sessions once a schedule has been generated — a quick way to confirm what they\'re teaching without leaving this page.',
      placement: 'bottom',
    },
  ])

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
  const barBg         = isOverloaded ? 'linear-gradient(90deg,#E74C3C,#C0392B)' : loadPct > 80 ? 'linear-gradient(90deg,#D97706,#F59E0B)' : 'linear-gradient(90deg,var(--mint),var(--meadow))'
  const statusBg      = form.status === 'full-time' ? 'var(--meadow-soft)' : 'var(--hover)'
  const statusCl      = form.status === 'full-time' ? 'var(--meadow)' : 'var(--muted)'

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
      const finalEmail = credEmail.includes('@') ? credEmail.trim() : credEmail.trim() + '@gordoncollege.edu.ph'
      const result = await updateCredentials(id, { email: finalEmail, password: credPassword || undefined })
      if (result.migrated) {
        setCredActivated({ newId: result.new_id, tempPassword: result.temp_password })
      } else {
        setForm(f => ({ ...f, email: finalEmail }))
        setSavedInfo(s => s ? { ...s, email: finalEmail } : s)
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





  // ── Main render ───────────────────────────────────────────────────────────────
  return (
    <div className="page" style={{ padding:'28px 32px 200px 32px', fontFamily:"'Inter',sans-serif" }}>
      {TourElement}
      <style>{FACULTY_STYLE}</style>
      
      {/* Breadcrumb + actions */}
      <div style={{ display:'flex', alignItems:'center', gap:8, marginBottom:20, flexWrap:'wrap' }}>
        <div style={{ display:'flex', alignItems:'center', gap:8, flex:1 }}>
          <button onClick={() => navigate('/dashboard/faculty')} style={{ background:'none', border:'none', color: 'var(--muted)', cursor:'pointer', display:'flex', alignItems:'center', gap:5, fontSize:12.5, fontFamily:"'Inter',sans-serif", padding:0 }}>
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><line x1="19" y1="12" x2="5" y2="12"/><polyline points="12 19 5 12 12 5"/></svg>Faculty
          </button>
          <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="var(--border)" strokeWidth="2"><line x1="5" y1="12" x2="19" y2="12"/><polyline points="12 5 19 12 12 19"/></svg>
          <span style={{ fontSize:12.5, color: 'var(--ink)', fontWeight:600 }}>{form.name || 'Edit Faculty'}</span>
          {form.status   && <span style={{ padding:'1px 8px', borderRadius:99, fontSize:10.5, fontWeight:700, background:statusBg, color:statusCl }}>{form.status}</span>}
          {form.archived && <span style={{ padding:'1px 8px', borderRadius:99, fontSize:10.5, fontWeight:700, background:'rgba(217, 119, 6, 0.1)', color:'#F59E0B' }}>Archived</span>}
          {isOverloaded  && <span style={{ padding:'1px 8px', borderRadius:99, fontSize:10.5, fontWeight:700, background:'rgba(220, 38, 38, 0.1)', color:'#EF4444' }}>Overloaded</span>}
        </div>

        <div id="tour-fac-actions" style={{ display:'flex', alignItems:'center', gap:6 }}>
          {form.archived ? (
            <button type="button" onClick={handleUnarchive} disabled={archiving} style={{ display:'inline-flex', alignItems:'center', gap:6, padding:'6px 12px', borderRadius:8, border:'1.5px solid var(--meadow-border)', background:'var(--meadow-soft)', color: 'var(--meadow-text)', fontSize:12, fontWeight:600, cursor: archiving ? 'default' : 'pointer', fontFamily:"'Inter',sans-serif", opacity: archiving ? 0.7 : 1 }}>
              <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><polyline points="1 4 1 10 7 10"/><path d="M3.51 15a9 9 0 1 0 .49-3.5"/></svg>
              {archiving ? 'Restoring…' : 'Restore'}
            </button>
          ) : (
            <button type="button" onClick={() => setShowArchiveModal(true)} style={{ display:'inline-flex', alignItems:'center', gap:6, padding:'6px 12px', borderRadius:8, border:'1.5px solid var(--border)', background: 'var(--surface)', color: 'var(--muted)', fontSize:12, fontWeight:600, cursor:'pointer', fontFamily:"'Inter',sans-serif" }}>
              <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M21 8v13H3V8"/><path d="M23 3H1v5h22z"/><line x1="10" y1="12" x2="14" y2="12"/></svg>Archive
            </button>
          )}
          <button type="button" onClick={() => setShowDeleteModal(true)} style={{ display:'inline-flex', alignItems:'center', gap:6, padding:'6px 12px', borderRadius:8, border:'1.5px solid #FFD0D0', background:'rgba(220, 38, 38, 0.05)', color:'#EF4444', fontSize:12, fontWeight:600, cursor:'pointer', fontFamily:"'Inter',sans-serif" }}>
            <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><polyline points="3 6 5 6 21 6"/><path d="M19 6l-1 14a2 2 0 0 1-2 2H8a2 2 0 0 1-2-2L5 6"/><path d="M10 11v6M14 11v6"/></svg>Delete
          </button>
        </div>
      </div>

      {/* Banners */}
      {!isNew && form.archived && (
        <div style={{ background:'rgba(217, 119, 6, 0.1)', border:'1px solid #FDE68A', borderRadius:12, padding:'12px 16px', marginBottom:20, display:'flex', gap:10, alignItems:'center' }}>
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke='#F59E0B' strokeWidth="2" style={{ flexShrink:0 }}><path d="M21 8v13H3V8"/><path d="M23 3H1v5h22z"/><line x1="10" y1="12" x2="14" y2="12"/></svg>
          <span style={{ fontSize:12.5, color:'#92400E', lineHeight:1.5, flex:1 }}>This faculty member is <strong>archived</strong> and excluded from scheduling. Edits are still saved normally.</span>
          <button onClick={handleUnarchive} disabled={archiving} style={{ padding:'5px 14px', borderRadius:8, border:'1.5px solid #D97706', background: 'var(--surface)', color:'#F59E0B', fontSize:12, fontWeight:600, cursor: archiving ? 'default' : 'pointer', fontFamily:"'Inter',sans-serif", flexShrink:0, opacity: archiving ? 0.7 : 1 }}>
            {archiving ? 'Restoring…' : 'Restore Now'}
          </button>
        </div>
      )}

      {/* Form */}
      <form onSubmit={handleCreate}>
        <div style={{ display:'flex', flexDirection:'column', gap:16 }}>

          {/* Two-column layout */}
          <div style={{ display:'flex', gap:24, flexWrap:'wrap', alignItems:'stretch' }}>

            {/* Left column */}
            <div style={{ flex:'0 0 300px', minWidth:260, display:'flex', flexDirection:'column', gap:16 }}>
              <div id="tour-fac-profile">
                <ProfileCard
                  form={form} isNew={isNew} isOverloaded={isOverloaded}
                  avInitials={avInitials} avFg={avFg} avBg={avBg}
                  statusBg={statusBg} statusCl={statusCl}
                  specCount={specCount} onOpenSpecModal={() => setShowSpecModal(true)}
                />
              </div>
              {!isNew && (
                <div id="tour-fac-load">
                  <UnitLoadCard
                    displayUnits={displayUnits} effectiveCap={effectiveCap}
                    isOverloaded={isOverloaded} loadPct={loadPct} tierLabel={tierLabel}
                    scheduleUnits={scheduleUnits} barBg={barBg}
                  />
                </div>
              )}
            </div>

            {/* Right column */}
            <div style={{ flex:1, minWidth:280, display:'flex', flexDirection:'column', gap:16 }}>
              <div id="tour-fac-basic-info">
                <BasicInfoCard
                  form={form} setForm={setForm} isNew={isNew}
                  infoChanged={infoChanged} infoSaving={infoSaving} infoSaved={infoSaved} infoError={infoError} onSaveInfo={handleSaveInfo}
                  password={password} setPassword={setPassword} showPassword={showPassword} setShowPassword={setShowPassword}
                  facultyId={id}
                />
              </div>

            </div>
          </div>

          {/* Full-width rows — span entire width below the two columns */}

          {/* Part-time: schedule prefs */}
          {form.status === 'part-time' && (
            <SchedulePrefsCard
              form={form} setForm={setForm} isNew={isNew}
              prefsChanged={prefsChanged} prefSaving={prefSaving} prefSaved={prefSaved} prefError={prefError} onSavePrefs={handleSavePrefs}
            />
          )}

          {/* Credentials — full width for both full-time and part-time (edit mode) */}
          {!isNew && (
            <div id="tour-fac-credentials">
              <CredentialsCard
                form={form}
                credEmail={credEmail} setCredEmail={setCredEmail}
                credPassword={credPassword} setCredPassword={setCredPassword}
                credConfirm={credConfirm} setCredConfirm={setCredConfirm}
                showCredPwd={showCredPwd} setShowCredPwd={setShowCredPwd}
                credSaving={credSaving} credError={credError} credSuccess={credSuccess}
                onSave={handleSaveCredentials}
              />
            </div>
          )}

        </div>
      </form>

      {/* Schedule Section — outside form to prevent accidental form submission */}
      <div style={{ marginTop:16 }}>
        <ScheduleSection
          facultyName={form.name}
          faculty={form}
          onUnitsLoaded={setScheduleUnits}
          onAssignmentsLoaded={setScheduleAssignments}
        />
      </div>

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
        <div style={{ position:'fixed', inset:0, zIndex:1100, background:'rgba(10,30,18,0.55)', backdropFilter:'blur(4px)', display:'flex', alignItems:'center', justifyContent:'center', padding:24 }}>
          <div style={{ background: 'var(--surface)', borderRadius:18, padding:'28px 28px 24px', maxWidth:400, width:'100%', boxShadow:'0 20px 60px rgba(10,30,18,0.22)', border:'1px solid var(--border)', textAlign:'center' }}>
            <div style={{ width:52, height:52, borderRadius:'50%', background:'rgba(217, 119, 6, 0.1)', margin:'0 auto 16px', display:'flex', alignItems:'center', justifyContent:'center' }}>
              <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke='#F59E0B' strokeWidth="2"><path d="M21 8v13H3V8"/><path d="M23 3H1v5h22z"/><line x1="10" y1="12" x2="14" y2="12"/></svg>
            </div>
            <div style={{ fontSize:16, fontWeight:700, color: 'var(--ink)', marginBottom:8 }}>Archive Faculty Member?</div>
            <div style={{ fontSize:13, color: 'var(--muted)', marginBottom:24, lineHeight:1.5 }}>
              <strong style={{ color: 'var(--ink)' }}>{form.name}</strong> will be hidden from active scheduling. You can restore them at any time.
            </div>
            <div style={{ display:'flex', gap:10 }}>
              <button onClick={() => setShowArchiveModal(false)} disabled={archiving} style={{ flex:1, padding:'10px', borderRadius:9, border:'1.5px solid var(--border)', background: 'var(--surface)', fontSize:13, fontWeight:600, color: 'var(--muted)', cursor:'pointer', fontFamily:'Inter,sans-serif' }}>Cancel</button>
              <button onClick={handleArchive} disabled={archiving} style={{ flex:1, padding:'10px', borderRadius:9, border:'none', background:'linear-gradient(135deg,#D97706,#B45309)', fontSize:13, fontWeight:700, color: '#fff', cursor: archiving ? 'default' : 'pointer', fontFamily:'Inter,sans-serif', opacity: archiving ? 0.7 : 1 }}>
                {archiving ? 'Archiving…' : 'Archive'}
              </button>
            </div>
          </div>
        </div>
      )}

      {showDeleteModal && (
        <DeleteConfirmModal name={form.name} deleting={deleting} onConfirm={handleDelete} onCancel={() => setShowDeleteModal(false)} />
      )}

      {credActivated && (
        <div style={{ position: 'fixed', inset: 0, zIndex: 9999, display: 'flex', alignItems: 'center', justifyContent: 'center', background: 'rgba(0,0,0,0.5)', backdropFilter: 'blur(4px)', padding: 20 }}>
          <div style={{ background: 'var(--surface)', borderRadius: 18, border: '1px solid var(--border)', overflow: 'hidden', boxShadow: '0 10px 40px rgba(0,0,0,0.2)', width: '100%', maxWidth: 460, animation: 'fadeIn 0.2s ease-out' }}>
            <div style={{ padding: '24px 28px', borderBottom: '1px solid var(--hover)', display: 'flex', gap: 14, alignItems: 'center' }}>
              <div style={{ width: 44, height: 44, borderRadius: '50%', background: 'var(--meadow-soft)', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="var(--meadow)" strokeWidth="2.5"><polyline points="20 6 9 17 4 12"/></svg>
              </div>
              <div>
                <div style={{ fontSize: 16, fontWeight: 700, color: 'var(--meadow-text)' }}>Account activated</div>
                <div style={{ fontSize: 13, color: 'var(--muted)', marginTop: 2 }}>Firebase Auth account created and profile migrated.</div>
              </div>
            </div>
            <div style={{ padding: '24px 28px' }}>
              {credActivated.tempPassword ? (
                <>
                  <div style={{ fontSize: 11, fontWeight: 700, color: 'var(--muted)', textTransform: 'uppercase', letterSpacing: '.6px', marginBottom: 10 }}>Auto-generated Password</div>
                  <div style={{ display: 'flex', gap: 10, marginBottom: 14 }}>
                    <code style={{ flex: 1, padding: '12px 16px', background: 'var(--bg)', borderRadius: 10, border: '1.5px solid var(--border)', fontSize: 15, fontFamily: 'monospace', letterSpacing: 2, color: 'var(--ink)' }}>{credActivated.tempPassword}</code>
                    <button type="button" onClick={() => { navigator.clipboard.writeText(credActivated.tempPassword); setPwCopied(true); setTimeout(() => setPwCopied(false), 2000) }} style={{ padding: '12px 16px', borderRadius: 10, border: '1.5px solid var(--border)', background: pwCopied ? 'var(--meadow-soft)' : 'var(--surface)', color: pwCopied ? 'var(--meadow)' : 'var(--meadow-deep)', fontSize: 12.5, fontWeight: 600, cursor: 'pointer', fontFamily: "'Inter',sans-serif", whiteSpace: 'nowrap' }}>
                      {pwCopied ? 'Copied!' : 'Copy'}
                    </button>
                  </div>
                </>
              ) : (
                <div style={{ marginBottom: 14, fontSize: 12.5, color: 'var(--ink2)' }}>Credentials saved. The faculty member can now log in with the password you set.</div>
              )}
              <div style={{ fontSize: 11.5, color: 'var(--muted)', background: 'var(--bg)', borderRadius: 8, padding: '10px 14px', border: '1px solid var(--border)', marginBottom: 22 }}>The faculty member must log out and back in for their role to take effect.</div>
              <div style={{ display: 'flex', justifyContent: 'flex-end' }}>
                <button type="button" onClick={() => setCredActivated(null)} style={{ padding: '9px 18px', borderRadius: 9, border: 'none', background: 'linear-gradient(135deg,var(--meadow),var(--meadow-deep))', color: '#fff', fontSize: 13, fontWeight: 600, cursor: 'pointer', fontFamily: "'Inter',sans-serif" }}>
                  Close
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      <ToastContainer toasts={toasts} />
    </div>
  )
}