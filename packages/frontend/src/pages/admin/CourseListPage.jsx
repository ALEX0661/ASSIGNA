import { useEffect, useState, useMemo, useCallback } from 'react'
import { getCourses, addCourse, deleteCourse, updateCourse } from '../../services/api'
import ImportCoursesModal from '../../components/ImportCoursesModal'
import BlockConfigModal from '../../components/BlockConfigModal'
import * as XLSX from 'xlsx'

const EMPTY = { courseCode: '', title: '', program: '', yearLevel: '1', blocks: 1, unitsLecture: 3, unitsLab: 0, semester: '1st Semester' }

const YEAR_LABELS = { '1': '1st Year', '2': '2nd Year', '3': '3rd Year', '4': '4th Year' }
const YEAR_SHORT  = { '1': '1st', '2': '2nd', '3': '3rd', '4': '4th' }

const SEMESTERS = ['1st Semester', '2nd Semester', 'Midyear']
const SEM_SHORT = { '1st Semester': '1st Sem', '2nd Semester': '2nd Sem', 'Midyear': 'Midyear' }
const SEM_SHEET = {
  '1st Semester': 'First Semester',
  '2nd Semester': 'Second Semester',
  'Midyear':      'Midyear',
}
const SEM_COLORS = {
  '1st Semester': { bg: '#EDE9FB', color: '#7C6FCD', border: '#D8D3F5' },
  '2nd Semester': { bg: '#E6FAF3', color: '#059669', border: '#A7F3D0' },
  'Midyear':      { bg: '#FEF3CD', color: '#D97706', border: '#FCD34D' },
}

const PROGRAMS = [
  { value: 'BSCS',      full: 'BS in Computer Science' },
  { value: 'BSIT',      full: 'BS in Information Technology' },
  { value: 'BSEMC-GD',  full: 'BS in Entertainment and Multimedia Computing – Game Development' },
  { value: 'BSEMC-DAT', full: 'BS in Entertainment and Multimedia Computing – Digital Animation Technology' },
]

/* ─── Styles ─────────────────────────────────────────────────────────────── */
if (!document.getElementById('course-page-style')) {
  const s = document.createElement('style')
  s.id = 'course-page-style'
  s.textContent = `
    .cp-primary {
      display: inline-flex; align-items: center; gap: 7px;
      padding: 8px 18px; border-radius: 10px; border: none;
      font-family: 'Poppins', sans-serif; font-size: 12.5px; font-weight: 600;
      cursor: pointer; transition: all 0.15s;
      background: linear-gradient(135deg,#7C6FCD,#5a4fbf); color: #fff;
      box-shadow: 0 3px 12px rgba(124,111,205,0.32);
    }
    .cp-primary:hover:not(:disabled) { background: linear-gradient(135deg,#8E82D9,#6A5FD2); box-shadow: 0 5px 18px rgba(124,111,205,0.42); transform: translateY(-1px); }
    .cp-primary:active:not(:disabled) { transform: translateY(0); }
    .cp-primary:disabled { opacity:.5; cursor:default; transform:none; box-shadow:none; }

    .cp-ghost {
      display: inline-flex; align-items: center; gap: 6px;
      padding: 8px 14px; border-radius: 10px;
      border: 1.5px solid #D8D3F5; font-family: 'Poppins', sans-serif;
      font-size: 12px; font-weight: 600; cursor: pointer;
      background: #fff; color: #7C6FCD; transition: all 0.13s;
    }
    .cp-ghost:hover { background: #F2EFFD; border-color: #C5BBEF; }

    .cp-cancel {
      display: inline-flex; align-items: center; gap: 6px;
      padding: 8px 16px; border-radius: 10px;
      border: 1.5px solid #E8E4F8; font-family: 'Poppins', sans-serif;
      font-size: 12px; font-weight: 600; cursor: pointer;
      background: #fff; color: #8883B0; transition: all 0.13s;
    }
    .cp-cancel:hover { background: #F5F4FB; border-color: #D8D3F5; }

    .cp-delete {
      display: inline-flex; align-items: center; gap: 5px;
      padding: 5px 10px; border-radius: 8px;
      border: 1.5px solid #FECACA; font-family: 'Poppins', sans-serif;
      font-size: 11.5px; font-weight: 600; cursor: pointer;
      background: #FFF5F5; color: #DC2626; transition: all 0.13s;
    }
    .cp-delete:hover { background: #FEE2E2; border-color: #FCA5A5; }

    .cp-edit-btn {
      display: inline-flex; align-items: center; justify-content: center;
      width: 28px; height: 28px; border-radius: 7px;
      border: 1.5px solid #E8E4F8; cursor: pointer;
      background: #fff; color: #B0ABCC; transition: all 0.13s; flex-shrink: 0;
      padding: 0;
    }
    .cp-edit-btn:hover { background: #EDE9FB; border-color: #C5BBEF; color: #7C6FCD; }

    .cp-close-btn {
      display: inline-flex; align-items: center; justify-content: center;
      width: 32px; height: 32px; border-radius: 8px;
      border: 1.5px solid #E8E4F8; cursor: pointer;
      background: #F5F4FB; color: #7C6FCD; transition: all 0.2s; flex-shrink: 0;
      padding: 0;
    }
    .cp-close-btn:hover { background: #FFE8E8; border-color: #FECACA; color: #DC2626; }

    .cp-cb {
      width: 17px; height: 17px; border-radius: 5px; flex-shrink: 0;
      border: 1.5px solid #C5BBEF; background: #fff;
      display: inline-flex; align-items: center; justify-content: center;
      transition: all 0.15s; cursor: pointer; box-sizing: border-box;
    }
    .cp-cb.on { background: linear-gradient(135deg,#7C6FCD,#5a4fbf); border-color: #7C6FCD; }

    .cp-pill {
      padding: 4px 11px; border-radius: 99px; font-size: 11.5px;
      border: 1.5px solid #E8E4F8; cursor: pointer;
      background: #F5F4FB; color: #8883B0; transition: all 0.13s;
      white-space: nowrap; font-family: 'Poppins',sans-serif; font-weight: 500;
    }
    .cp-pill.on {
      background: linear-gradient(135deg,#7C6FCD,#5a4fbf); color: #fff;
      border-color: transparent; font-weight: 600;
      box-shadow: 0 2px 8px rgba(124,111,205,0.28);
    }
    .cp-pill:hover:not(.on) { background: #EEEAFB; border-color: #C5BBEF; color: #5a4fbf; }

    .cp-overlay {
      position: fixed; inset: 0; background: rgba(26,26,46,0.5);
      backdrop-filter: blur(4px); z-index: 1000;
      display: flex; align-items: center; justify-content: center;
      padding: 20px; animation: cpFadeOv 0.18s ease;
    }
    @keyframes cpFadeOv { from{opacity:0} to{opacity:1} }

    .cp-modal {
      background: #fff; border-radius: 18px; width: 100%; max-width: 560px;
      box-shadow: 0 24px 64px rgba(26,26,46,0.22),0 4px 16px rgba(124,111,205,0.12);
      animation: cpSlideUp 0.22s cubic-bezier(0.34,1.4,0.64,1); overflow: hidden;
    }
    @keyframes cpSlideUp {
      from{opacity:0;transform:translateY(22px) scale(0.97)}
      to{opacity:1;transform:translateY(0) scale(1)}
    }

    .cp-form-grid { display: grid; grid-template-columns: 1fr 1fr; gap: 12px; }
    .cp-field { display: flex; flex-direction: column; gap: 5px; }
    .cp-field.s2 { grid-column: span 2; }
    .cp-label { font-size:10.5px; font-weight:700; color:#8883B0; text-transform:uppercase; letter-spacing:.7px; }
    .cp-inp, .cp-sel {
      padding: 8px 11px; border-radius: 9px;
      border: 1.5px solid #E8E4F8; font-family: 'Poppins',sans-serif;
      font-size: 12.5px; color: #1a1a2e; background: #fff; outline: none;
      transition: border-color 0.15s,box-shadow 0.15s; width: 100%; box-sizing: border-box;
    }
    .cp-inp:focus,.cp-sel:focus { border-color:#A99BE8; box-shadow:0 0 0 3px rgba(169,155,232,0.13); }
    .cp-sel {
      appearance:none; cursor:pointer; padding-right:28px;
      background-image:url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='11' height='11' viewBox='0 0 24 24' fill='none' stroke='%238883B0' stroke-width='2.5'%3E%3Cpolyline points='6 9 12 15 18 9'/%3E%3C/svg%3E");
      background-repeat:no-repeat; background-position:right 10px center;
    }

    .prog-bscs     { background:#EDE9FB; color:#7C6FCD; }
    .prog-bsit     { background:#E6FAF3; color:#059669; }
    .prog-bsemcgd  { background:#FEF3CD; color:#D97706; }
    .prog-bsemcdat { background:#FEE2E2; color:#DC2626; }

    @keyframes cpSlideIn { from{opacity:0;transform:translateY(-6px)} to{opacity:1;transform:translateY(0)} }
    @keyframes cpSpin { to{transform:rotate(360deg)} }

    /* Skeleton Animations */
    @keyframes cpShimmer {
      0%   { background-position: -400px 0 }
      100% { background-position:  400px 0 }
    }
    .cp-skeleton {
      background: linear-gradient(90deg, #F0EDF9 25%, #E4DEFC 50%, #F0EDF9 75%);
      background-size: 800px 100%;
      animation: cpShimmer 1.4s ease-in-out infinite;
      border-radius: 7px;
    }

    /* Toast Notifications - Lavender & White Theme */
    @keyframes cpToastIn { from{opacity:0;transform:scale(.96) translateY(12px)} to{opacity:1;transform:scale(1) translateY(0)} }
    .cp-toast-wrap { position:fixed; bottom:24px; left:50%; z-index:9999; display:flex; flex-direction:column; gap:10px; align-items:center; pointer-events:none; transform:translateX(-50%); }
    .cp-toast { display:flex; align-items:center; gap:10px; padding:12px 20px; border-radius:12px; font-family:'Poppins',sans-serif; font-size:13px; font-weight:600; animation:cpToastIn .22s cubic-bezier(.4,0,.2,1); white-space:nowrap; pointer-events:auto; }
    .cp-toast.success { background:linear-gradient(135deg,#7C6FCD,#5a4fbf); color:#fff; box-shadow:0 8px 24px rgba(124,111,205,0.3); border:1px solid #A99BE8; }
    .cp-toast.error   { background:#fff; color:#DC2626; border:1.5px solid #FECACA; box-shadow:0 8px 24px rgba(220,38,38,0.15); }
    .cp-toast.info    { background:#fff; color:#7C6FCD; border:1.5px solid #D8D3F5; box-shadow:0 8px 24px rgba(124,111,205,0.15); }
    .cp-sem-tab-bar {
      display: flex; gap: 3px; background: #F5F4FB; padding: 4px; border-radius: 12px;
      border: 1px solid #E8E4F8;
    }
    .cp-sem-tab {
      display: inline-flex; align-items: center; gap: 6px;
      padding: 7px 16px; border-radius: 9px; border: none;
      font-family: 'Poppins', sans-serif; font-size: 12.5px; font-weight: 600;
      cursor: pointer; transition: all 0.15s; background: transparent;
      color: #8883B0; white-space: nowrap;
    }
    .cp-sem-tab.active {
      background: linear-gradient(135deg,#7C6FCD,#5a4fbf); color: #fff;
      box-shadow: 0 3px 10px rgba(124,111,205,0.28);
    }
    .cp-sem-tab:hover:not(.active) { background: #EEEAFB; color: #5a4fbf; }
    .cp-sem-tab .cp-sem-count {
      display: inline-flex; align-items: center; justify-content: center;
      min-width: 20px; height: 18px; padding: 0 5px; border-radius: 99px;
      font-size: 10.5px; font-weight: 700; line-height: 1;
    }
    .cp-sem-tab.active .cp-sem-count { background: rgba(255,255,255,0.2); color: #fff; }
    .cp-sem-tab:not(.active) .cp-sem-count { background: #E8E4F8; color: #8883B0; }
  `
  document.head.appendChild(s)
}

/* ─── Toast System ───────────────────────────────────────────────────────── */
function useToast() {
  const [toasts, setToasts] = useState([])
  const toast = useCallback((message, type = 'info', duration = 3000) => {
    const id = Date.now() + Math.random()
    setToasts(prev => [...prev, { id, message, type }])
    setTimeout(() => setToasts(prev => prev.filter(t => t.id !== id)), duration)
  }, [])
  return { toasts, toast }
}

function ToastContainer({ toasts }) {
  const icons = {
    success: <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"><polyline points="20 6 9 17 4 12"/></svg>,
    error:   <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"><circle cx="12" cy="12" r="10"/><line x1="12" y1="8" x2="12" y2="12"/></svg>,
    info:    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"><circle cx="12" cy="12" r="10"/><path d="M12 8v4"/></svg>,
  }
  return (
    <div className="cp-toast-wrap">
      {toasts.map(t => (
        <div key={t.id} className={`cp-toast ${t.type}`}>{icons[t.type]}{t.message}</div>
      ))}
    </div>
  )
}

/* ─── Skeleton Helper ────────────────────────────────────────────────────── */
function Skel({ w = '100%', h = 14, r = 7, style = {} }) {
  return (
    <div className="cp-skeleton" style={{ width: w, height: h, borderRadius: r, flexShrink: 0, ...style }} />
  )
}

function progClass(p = '') {
  const v = p.toUpperCase()
  if (v === 'BSCS') return 'prog-bscs'
  if (v === 'BSIT') return 'prog-bsit'
  if (v.includes('GD'))  return 'prog-bsemcgd'
  if (v.includes('DAT')) return 'prog-bsemcdat'
  return ''
}

function Checkbox({ checked, indeterminate, onChange }) {
  const cls = `cp-cb${(checked || indeterminate) ? ' on' : ''}`
  return (
    <span className={cls} onClick={onChange} role="checkbox" aria-checked={checked}>
      {indeterminate && !checked && (
        <svg width="8" height="2" viewBox="0 0 8 2"><rect width="8" height="2" rx="1" fill="white"/></svg>
      )}
      {checked && (
        <svg width="9" height="7" viewBox="0 0 9 7" fill="none">
          <polyline points="1,3.5 3.5,6 8,1" stroke="white" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"/>
        </svg>
      )}
    </span>
  )
}

function Pill({ label, active, onClick }) {
  return <button className={`cp-pill${active ? ' on' : ''}`} onClick={onClick}>{label}</button>
}

function Spin() {
  return (
    <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"
      style={{ animation: 'cpSpin .8s linear infinite' }}>
      <path d="M21 12a9 9 0 1 1-6.219-8.56"/>
    </svg>
  )
}

/* ─── Delete Confirm Modal ───────────────────────────────────────────────── */
function DeleteConfirmModal({ name, count, onConfirm, onCancel, deleting }) {
  const isBulk   = count > 1
  const title    = isBulk ? `Delete ${count} Courses?` : 'Delete Course?'
  const btnLabel = deleting ? 'Deleting...' : 'Yes, Delete'
  return (
    <div className="cp-overlay" onClick={e => { if (e.target === e.currentTarget && !deleting) onCancel() }}>
      <div style={{
        background: '#fff', borderRadius: 18, padding: '28px 28px 24px',
        maxWidth: 400, width: '100%',
        boxShadow: '0 20px 60px rgba(26,26,46,0.22)', textAlign: 'center',
        animation: 'cpSlideUp 0.22s cubic-bezier(0.34,1.4,0.64,1)',
      }}>
        <div style={{
          width: 52, height: 52, borderRadius: '50%', background: '#FFE8E8',
          margin: '0 auto 16px', display: 'flex', alignItems: 'center', justifyContent: 'center',
        }}>
          <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="#C0392B" strokeWidth="2">
            <polyline points="3 6 5 6 21 6"/>
            <path d="M19 6l-1 14a2 2 0 0 1-2 2H8a2 2 0 0 1-2-2L5 6"/>
            <path d="M10 11v6M14 11v6M9 6V4h6v2"/>
          </svg>
        </div>
        <div style={{ fontSize: 16, fontWeight: 700, color: '#1a1a2e', marginBottom: 8 }}>{title}</div>
        <div style={{ fontSize: 13, color: '#8883B0', marginBottom: 24, lineHeight: 1.5 }}>
          {isBulk
            ? `This will permanently remove ${count} courses. This cannot be undone.`
            : <>This will permanently remove <strong style={{ color: '#1a1a2e' }}>{name}</strong>. This cannot be undone.</>
          }
        </div>
        <div style={{ display: 'flex', gap: 10 }}>
          <button onClick={onCancel} disabled={deleting} style={{
            flex: 1, padding: '10px', borderRadius: 9, border: '1.5px solid #E8E4F8',
            background: '#fff', fontSize: 13, fontWeight: 600, color: '#8883B0',
            cursor: deleting ? 'default' : 'pointer', fontFamily: "'Poppins',sans-serif",
          }}>Cancel</button>
          <button onClick={onConfirm} disabled={deleting} style={{
            flex: 1, padding: '10px', borderRadius: 9, border: 'none',
            background: '#C0392B', fontSize: 13, fontWeight: 700, color: '#fff',
            cursor: deleting ? 'default' : 'pointer', fontFamily: "'Poppins',sans-serif",
            opacity: deleting ? 0.7 : 1,
          }}>{btnLabel}</button>
        </div>
      </div>
    </div>
  )
}

/* ─── Course Modal ────────────────────────────────────────────────────────── */
function CourseModal({ mode, initial, onSave, onClose, saving, error }) {
  const [form, setForm] = useState(initial || EMPTY)
  const isEdit = mode === 'edit'
  const set = (k, v) => setForm(f => ({ ...f, [k]: v }))
  const canSave = form.courseCode.trim() && form.title.trim() && form.program

  function submit() {
    onSave({ ...form, yearLevel: Number(form.yearLevel), blocks: Number(form.blocks), unitsLecture: Number(form.unitsLecture), unitsLab: Number(form.unitsLab), semester: form.semester })
  }

  return (
    <div className="cp-overlay" onClick={e => e.target === e.currentTarget && onClose()}>
      <div className="cp-modal">

        {/* Head */}
        <div style={{ display:'flex', alignItems:'center', gap:12, padding:'18px 22px 16px', borderBottom:'1px solid #F0EDF9' }}>
          <div style={{ width:36, height:36, borderRadius:11, flexShrink:0, display:'flex', alignItems:'center', justifyContent:'center', background: isEdit ? '#FEF3CD' : '#EDE9FB' }}>
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke={isEdit ? '#D97706' : '#7C6FCD'} strokeWidth="2">
              {isEdit
                ? <><path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"/><path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"/></>
                : <><line x1="12" y1="5" x2="12" y2="19"/><line x1="5" y1="12" x2="19" y2="12"/></>}
            </svg>
          </div>
          <div style={{ flex:1 }}>
            <div style={{ fontSize:14, fontWeight:700, color:'#1a1a2e' }}>{isEdit ? 'Edit Course' : 'Add New Course'}</div>
            <div style={{ fontSize:11.5, color:'#8883B0', marginTop:1 }}>{isEdit ? `Editing ${initial?.courseCode}` : 'Fill in the course details below'}</div>
          </div>
          <button className="cp-close-btn" onClick={onClose}>
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round">
              <line x1="18" y1="6" x2="6" y2="18" />
              <line x1="6" y1="6" x2="18" y2="18" />
            </svg>
          </button>
        </div>

        {/* Body */}
        <div style={{ padding:'20px 22px', display:'flex', flexDirection:'column', gap:14 }}>
          <div className="cp-form-grid">
            <div className="cp-field">
              <label className="cp-label">Course Code *</label>
              <input className="cp-inp" value={form.courseCode}
                onChange={e => !isEdit && set('courseCode', e.target.value)}
                placeholder="e.g. CS 101" readOnly={isEdit}
                style={isEdit ? { background:'#FAFAFE', color:'#A0ABC0' } : {}} />
            </div>
            <div className="cp-field">
              <label className="cp-label">Program *</label>
              <select className="cp-sel" value={form.program} onChange={e => set('program', e.target.value)}>
                <option value="" disabled>Select program…</option>
                {PROGRAMS.map(p => <option key={p.value} value={p.value}>{p.value} — {p.full}</option>)}
              </select>
            </div>
            <div className="cp-field s2">
              <label className="cp-label">Course Title *</label>
              <input className="cp-inp" value={form.title} onChange={e => set('title', e.target.value)} placeholder="e.g. Introduction to Computing" />
            </div>
            <div className="cp-field">
              <label className="cp-label">Year Level</label>
              <select className="cp-sel" value={form.yearLevel} onChange={e => set('yearLevel', e.target.value)}>
                {Object.entries(YEAR_LABELS).map(([v,l]) => <option key={v} value={v}>{l}</option>)}
              </select>
            </div>
            <div className="cp-field">
              <label className="cp-label">Sections / Blocks</label>
              <input className="cp-inp" type="number" min={1} value={form.blocks} onChange={e => set('blocks', e.target.value)} />
            </div>
            <div className="cp-field">
              <label className="cp-label">Lecture Units</label>
              <input className="cp-inp" type="number" min={0} value={form.unitsLecture} onChange={e => set('unitsLecture', e.target.value)} />
            </div>
            <div className="cp-field">
              <label className="cp-label">Lab Units</label>
              <input className="cp-inp" type="number" min={0} value={form.unitsLab} onChange={e => set('unitsLab', e.target.value)} />
            </div>
            <div className="cp-field s2">
              <label className="cp-label">Semester</label>
              <select className="cp-sel" value={form.semester} onChange={e => set('semester', e.target.value)}>
                {SEMESTERS.map(s => <option key={s} value={s}>{s}</option>)}
              </select>
            </div>
          </div>

          <div style={{ display:'flex', alignItems:'center', gap:8, padding:'8px 12px', borderRadius:9, background:'#FAFAFE', border:'1px solid #F0EDF9' }}>
            <div style={{ width:6, height:6, borderRadius:'50%', background:'#A99BE8', flexShrink:0 }} />
            <span style={{ fontSize:11.5, color:'#8883B0' }}>
              Total units: <strong style={{ color:'#7C6FCD' }}>{Number(form.unitsLecture)+Number(form.unitsLab)}</strong>
              {form.program && <span style={{ marginLeft:10 }}>Program: <strong style={{ color:'#5a4fbf' }}>{form.program}</strong></span>}
            </span>
          </div>

          {error && (
            <div style={{ display:'flex', alignItems:'center', gap:8, padding:'8px 12px', borderRadius:9, background:'#FFF5F5', border:'1px solid #FECACA', fontSize:12, color:'#DC2626' }}>
              <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><circle cx="12" cy="12" r="10"/><line x1="12" y1="8" x2="12" y2="12"/><line x1="12" y1="16" x2="12.01" y2="16"/></svg>
              {error}
            </div>
          )}
        </div>

        {/* Footer */}
        <div style={{ padding:'14px 22px', borderTop:'1px solid #F0EDF9', display:'flex', alignItems:'center', justifyContent:'flex-end', gap:8 }}>
          <button className="cp-cancel" onClick={onClose}>Cancel</button>
          <button className="cp-primary" onClick={submit} disabled={saving || !canSave}>
            {saving ? <><Spin /> Saving…</> : (
              <><svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"><polyline points="20 6 9 17 4 12"/></svg>{isEdit ? 'Save Changes' : 'Add Course'}</>
            )}
          </button>
        </div>
      </div>
    </div>
  )
}

/* ─── Main Page ───────────────────────────────────────────────────────────── */
export default function CourseListPage() {
  const { toasts, toast } = useToast()

  const [courses,       setCourses]       = useState([])
  const [loading,       setLoading]       = useState(true) 
  const [search,        setSearch]        = useState('')
  const [progFilter,    setProgFilter]    = useState([])
  const [yearFilter,    setYearFilter]    = useState([])
  const [semesterTab,   setSemesterTab]   = useState('1st Semester')
  const [showImport,    setShowImport]    = useState(false)
  const [showAdd,       setShowAdd]       = useState(false)
  const [showBlockCfg,  setShowBlockCfg]  = useState(false)
  const [editTarget,    setEditTarget]    = useState(null)
  const [saving,        setSaving]        = useState(false)
  const [error,         setError]         = useState('')
  const [selected,      setSelected]      = useState(new Set())
  const [deleting,      setDeleting]      = useState(false)
  const [pendingDelete, setPendingDelete] = useState(null)

  async function load() { 
    setLoading(true)
    try {
      setCourses(await getCourses())
      setSelected(new Set())
    } finally {
      setLoading(false)
    }
  }
  
  useEffect(() => { load() }, [])

  const programs = useMemo(() => Array.from(new Set(courses.map(c=>c.program).filter(Boolean))).sort(), [courses])
  const YEAR_OPTS = ['1','2','3','4']

  const filtered = useMemo(() => courses.filter(c => {
    const q = search.toLowerCase()
    const matchSem = c.semester === semesterTab || (semesterTab === 'all')
    return matchSem
      && (!q || `${c.courseCode} ${c.title}`.toLowerCase().includes(q))
      && (progFilter.length === 0 || progFilter.includes(c.program))
      && (yearFilter.length === 0 || yearFilter.includes(String(c.yearLevel)))
  }), [courses, search, progFilter, yearFilter, semesterTab])

  const semesterCounts = useMemo(() => {
    const counts = {}
    SEMESTERS.forEach(s => { counts[s] = courses.filter(c => (c.semester || '1st Semester') === s).length })
    return counts
  }, [courses])

  const hasFilter   = search || progFilter.length > 0 || yearFilter.length > 0
  const filteredIds = filtered.map(c => c.id)
  const allSel      = filteredIds.length > 0 && filteredIds.every(id => selected.has(id))
  const someSel     = filteredIds.some(id => selected.has(id)) && !allSel
  const selCount    = [...selected].filter(id => filteredIds.includes(id)).length

  const togProg = p => setProgFilter(v => v.includes(p) ? v.filter(x=>x!==p) : [...v,p])
  const togYear = y => setYearFilter(v => v.includes(y) ? v.filter(x=>x!==y) : [...v,y])
  const togAll  = () => allSel
    ? setSelected(p => { const n=new Set(p); filteredIds.forEach(id=>n.delete(id)); return n })
    : setSelected(p => { const n=new Set(p); filteredIds.forEach(id=>n.add(id)); return n })
  const togOne  = id => setSelected(p => { const n=new Set(p); n.has(id)?n.delete(id):n.add(id); return n })

  async function handleAdd(data) {
    setSaving(true); setError('')
    try { 
      await addCourse(data); 
      setShowAdd(false); 
      load(); 
      toast('Course added successfully', 'success') 
    }
    catch(err) { setError(err.response?.data?.detail || 'Failed to add course.') }
    finally { setSaving(false) }
  }

  async function handleEdit(data) {
    setSaving(true); setError('')
    try { 
      await updateCourse(data.courseCode, data.program, data); 
      setEditTarget(null); 
      load(); 
      toast('Course updated successfully', 'success') 
    }
    catch(err) { setError(err.response?.data?.detail || 'Failed to update course.') }
    finally { setSaving(false) }
  }

  function handleDelete(code, prog) {
    setPendingDelete({ code, prog, name: code })
  }

  function handleBulkDelete() {
    const tgts = filtered.filter(c => selected.has(c.id))
    if (!tgts.length) return
    setPendingDelete({ bulk: true, count: tgts.length, targets: tgts })
  }

  async function handleConfirmDelete() {
    setDeleting(true)
    try {
      if (pendingDelete.bulk) {
        await Promise.all(pendingDelete.targets.map(c => deleteCourse(c.courseCode, c.program)))
        toast(`${pendingDelete.count} courses deleted`, 'success')
      } else {
        await deleteCourse(pendingDelete.code, pendingDelete.prog)
        toast(`Course ${pendingDelete.code} deleted`, 'success')
      }
      setPendingDelete(null)
      load()
    } catch (err) {
      toast('Failed to delete course(s)', 'error')
    } finally { setDeleting(false) }
  }

  function handleExport() {
    if (!courses.length) return

    const headers = ['Course Code', 'Title', 'Program', 'Semester', 'Year Level', 'Sections', 'Lecture Units', 'Lab Units', 'Total Units']
    const colWidths = [
      { wch: 16 }, { wch: 38 }, { wch: 14 }, { wch: 16 },
      { wch: 12 }, { wch: 10 }, { wch: 11 }, { wch: 10 }, { wch: 12 },
    ]

    const wb = XLSX.utils.book_new()

    SEMESTERS.forEach(sem => {
      const semCourses = courses.filter(c => (c.semester || '1st Semester') === sem)
      if (!semCourses.length) return

      const rows = semCourses.map(c => [
        c.courseCode,
        c.title,
        c.program,
        c.semester || '1st Semester',
        c.yearLevel,
        c.blocks,
        c.unitsLecture,
        c.unitsLab,
        (c.unitsLecture || 0) + (c.unitsLab || 0),
      ])

      const ws = XLSX.utils.aoa_to_sheet([headers, ...rows])
      ws['!cols'] = colWidths
      XLSX.utils.book_append_sheet(wb, ws, SEM_SHEET[sem] || sem)
    })

    const date = new Date().toISOString().slice(0, 10)
    XLSX.writeFile(wb, `Courses-All-Semesters-${date}.xlsx`)
    toast('All semesters exported successfully', 'success')
  }

  return (
    <div className="page" style={{ fontFamily:"'Poppins',sans-serif" }}>

      {/* Semester Tabs */}
      <div style={{ display:'flex', justifyContent:'space-between', alignItems:'center', marginBottom:14, gap: 12, flexWrap: 'wrap' }}>
        <div className="cp-sem-tab-bar">
          {SEMESTERS.map(sem => (
            <button
              key={sem}
              className={`cp-sem-tab${semesterTab === sem ? ' active' : ''}`}
              onClick={() => { setSemesterTab(sem); setSelected(new Set()) }}
            >
              {SEM_SHORT[sem]}
              <span className="cp-sem-count">{loading ? '…' : semesterCounts[sem] || 0}</span>
            </button>
          ))}
        </div>
        
         {/* Header - Course Count */}
      <div style={{ display:'flex', justifyContent:'space-between', alignItems:'center', marginBottom:12 }}>
        <div style={{ display: 'flex', alignItems: 'center', background: '#F5F4FB', padding: '6px 14px', borderRadius: 10, border: '1px solid #E8E4F8', fontSize: 12.5, color: '#8883B0' }}>
          <span style={{ fontWeight: 700, color: '#7C6FCD', marginRight: 5, display: 'flex', alignItems: 'center' }}>
            {loading ? <Skel w={16} h={14} r={4} /> : filtered.length}
          </span>
          course{!loading && filtered.length !== 1 ? 's' : ''} in {SEM_SHORT[semesterTab]}
          
          {hasFilter && filtered.length !== courses.filter(c => c.semester === semesterTab).length && (
            <span style={{ marginLeft: 8, paddingLeft: 8, borderLeft: '1.5px solid #D8D3F5', color: '#7C6FCD', fontWeight: 600 }}>
              {filtered.length} shown
            </span>
          )}
        </div>
      </div>
        

        {/* Action Buttons */}
        <div style={{ display:'flex', gap:8, alignItems:'center' }}>
          <button className="cp-ghost" onClick={() => setShowBlockCfg(true)} title="Configure blocks per program-year">
            <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <rect x="3" y="3" width="7" height="7" rx="1"/><rect x="14" y="3" width="7" height="7" rx="1"/>
              <rect x="3" y="14" width="7" height="7" rx="1"/><rect x="14" y="14" width="7" height="7" rx="1"/>
            </svg>
            Block Config
          </button>

          {/* Export — icon only */}
          <button
            onClick={handleExport}
            disabled={!courses.length}
            title="Export all semesters to Excel"
            style={{
              display: 'inline-flex', alignItems: 'center', justifyContent: 'center',
              width: 34, height: 34, borderRadius: 9,
              border: '1.5px solid #D8D3F5',
              background: '#fff', color: '#7C6FCD',
              cursor: courses.length ? 'pointer' : 'not-allowed',
              opacity: courses.length ? 1 : 0.45,
              transition: 'all 0.15s', flexShrink: 0, padding: 0,
            }}
            onMouseEnter={e => { if (courses.length) { e.currentTarget.style.background = '#F2EFFD'; e.currentTarget.style.borderColor = '#B8B0E8' } }}
            onMouseLeave={e => { e.currentTarget.style.background = '#fff'; e.currentTarget.style.borderColor = '#D8D3F5' }}
          >
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2">
              <path d="M12 19V5"/><polyline points="5 12 12 5 19 12"/>
              <line x1="4" y1="20" x2="20" y2="20"/>
            </svg>
          </button>

          <button className="cp-ghost" onClick={() => setShowImport(true)}>
            <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/>
              <polyline points="7 10 12 15 17 10"/><line x1="12" y1="15" x2="12" y2="3"/>
            </svg>
            Import Courses
          </button>
          <button className="cp-primary" onClick={() => { setShowAdd(true); setError('') }}>
            <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
              <line x1="12" y1="5" x2="12" y2="19"/><line x1="5" y1="12" x2="19" y2="12"/>
            </svg>
            Add Course
          </button>
        </div>
      </div>

     

      {/* Filter bar */}
      <div style={{ background:'#fff', borderRadius:12, padding:'10px 16px', border:'1px solid #E8E4F8', boxShadow:'0 1px 6px rgba(124,111,205,0.06)', marginBottom:14, display:'flex', alignItems:'center', gap:10, flexWrap:'wrap' }}>
        <div style={{ position:'relative', flex:'0 0 220px' }}>
          <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="#B0ABCC" strokeWidth="2"
            style={{ position:'absolute', left:9, top:'50%', transform:'translateY(-50%)', pointerEvents:'none' }}>
            <circle cx="11" cy="11" r="8"/><path d="M21 21l-4.35-4.35"/>
          </svg>
          <input placeholder="Search code or title…" value={search} onChange={e=>setSearch(e.target.value)}
            style={{ paddingLeft:28, width:'100%', fontSize:12, padding:'6px 10px 6px 28px', fontFamily:'Poppins,sans-serif', border:'1.5px solid #E8E4F8', borderRadius:9, outline:'none', color:'#1a1a2e', background:'#FAFAFE', boxSizing:'border-box' }} />
        </div>
        <div style={{ width:1, height:20, background:'#E8E4F8', flexShrink:0 }} />
        <span style={{ fontSize:10.5, fontWeight:700, color:'#C0BBDC', textTransform:'uppercase', letterSpacing:'.8px', whiteSpace:'nowrap', flexShrink:0 }}>Program</span>
        <div style={{ display:'flex', gap:5, flexWrap:'wrap' }}>
          {programs.map(p => <Pill key={p} label={p} active={progFilter.includes(p)} onClick={()=>togProg(p)} />)}
        </div>
        <div style={{ width:1, height:20, background:'#E8E4F8', flexShrink:0 }} />
        <span style={{ fontSize:10.5, fontWeight:700, color:'#C0BBDC', textTransform:'uppercase', letterSpacing:'.8px', whiteSpace:'nowrap', flexShrink:0 }}>Year</span>
        <div style={{ display:'flex', gap:5, flexWrap:'wrap' }}>
          {YEAR_OPTS.map(y => <Pill key={y} label={`${YEAR_SHORT[y]} Yr`} active={yearFilter.includes(y)} onClick={()=>togYear(y)} />)}
        </div>
        {hasFilter && (
          <>
            <div style={{ width:1, height:20, background:'#E8E4F8', flexShrink:0 }} />
            <button onClick={()=>{setSearch('');setProgFilter([]);setYearFilter([])}}
              style={{ fontSize:11.5, color:'#7C6FCD', background:'#EEEAFB', border:'none', padding:'4px 11px', borderRadius:99, cursor:'pointer', fontWeight:600, whiteSpace:'nowrap', fontFamily:'Poppins,sans-serif' }}>
              Clear all
            </button>
          </>
        )}
      </div>

      {/* Bulk bar */}
      {selCount > 0 && (
        <div style={{ background:'linear-gradient(135deg,#3D3580,#2E2660)', borderRadius:10, padding:'10px 16px', marginBottom:12, display:'flex', alignItems:'center', gap:12, boxShadow:'0 4px 16px rgba(61,53,128,0.22)', animation:'cpSlideIn 0.18s ease' }}>
          <div style={{ width:28, height:28, borderRadius:8, background:'rgba(255,255,255,0.12)', display:'flex', alignItems:'center', justifyContent:'center' }}>
            <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="2.5"><polyline points="20 6 9 17 4 12"/></svg>
          </div>
          <span style={{ fontSize:13, fontWeight:600, color:'#fff', flex:1 }}>{selCount} course{selCount!==1?'s':''} selected</span>
          <button onClick={()=>setSelected(new Set())}
            style={{ background:'rgba(255,255,255,0.1)', border:'1px solid rgba(255,255,255,0.18)', color:'rgba(255,255,255,0.85)', fontSize:12, fontWeight:500, padding:'5px 13px', borderRadius:8, cursor:'pointer', fontFamily:'Poppins,sans-serif' }}>
            Deselect all
          </button>
          <button onClick={handleBulkDelete} disabled={deleting}
            style={{ background:'#DC2626', border:'none', color:'#fff', fontSize:12, fontWeight:600, padding:'5px 14px', borderRadius:8, display:'flex', alignItems:'center', gap:5, cursor:'pointer', fontFamily:'Poppins,sans-serif' }}>
            <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"><polyline points="3 6 5 6 21 6"/><path d="M19 6l-1 14a2 2 0 0 1-2 2H8a2 2 0 0 1-2-2L5 6"/><path d="M10 11v6M14 11v6"/></svg>
            {deleting ? 'Deleting…' : `Delete ${selCount}`}
          </button>
        </div>
      )}

      {/* Table */}
      <div style={{ background:'#fff', borderRadius:14, border:'1px solid #E8E4F8', boxShadow:'0 2px 10px rgba(124,111,205,0.07)', overflow:'hidden' }}>
        <table style={{ width:'100%', borderCollapse:'collapse' }}>
          <thead>
            <tr style={{ background:'#FAFAFE', borderBottom:'1px solid #F0EDF9' }}>
              <th style={{ width:44, padding:'10px 8px 10px 16px' }}>
                <Checkbox checked={allSel} indeterminate={someSel} onChange={togAll} />
              </th>
              {[['Code'],['Title'],['Program'],['Semester','center'],['Year','center'],['Sections','center'],['Lec','center'],['Lab','center'],['Total','center'],['']].map(([h,align],i)=>(
                <th key={i} style={{ padding:'10px 12px', fontSize:10.5, fontWeight:700, color:'#A0ABC0', textTransform:'uppercase', letterSpacing:'.6px', textAlign:align||'left' }}>{h}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {loading ? (
              Array.from({ length: 5 }).map((_, i) => (
                <tr key={i} style={{ borderBottom:'1px solid #F5F4FB' }}>
                  <td style={{ padding:'10px 8px 10px 16px' }}><Skel w={17} h={17} r={5} /></td>
                  <td style={{ padding:'10px 12px' }}><Skel w={50} h={18} r={99} /></td>
                  <td style={{ padding:'10px 12px' }}><Skel w={180} h={14} /></td>
                  <td style={{ padding:'10px 12px' }}><Skel w={60} h={18} r={99} /></td>
                  <td style={{ padding:'10px 12px', textAlign:'center' }}><Skel w={24} h={14} style={{ margin: '0 auto' }} /></td>
                  <td style={{ padding:'10px 12px', textAlign:'center' }}><Skel w={16} h={14} style={{ margin: '0 auto' }} /></td>
                  <td style={{ padding:'10px 12px', textAlign:'center' }}><Skel w={16} h={14} style={{ margin: '0 auto' }} /></td>
                  <td style={{ padding:'10px 12px', textAlign:'center' }}><Skel w={16} h={14} style={{ margin: '0 auto' }} /></td>
                  <td style={{ padding:'10px 12px', textAlign:'center' }}><Skel w={20} h={16} style={{ margin: '0 auto' }} /></td>
                  <td style={{ padding:'10px 14px 10px 8px' }}>
                    <div style={{ display:'flex', alignItems:'center', gap:5 }}>
                      <Skel w={28} h={28} r={7} />
                      <Skel w={65} h={24} r={8} />
                    </div>
                  </td>
                </tr>
              ))
            ) : filtered.length === 0 ? (
              <tr><td colSpan={11} style={{ textAlign:'center', padding:'40px 0', color:'#B0ABCC' }}>
                <div style={{ display:'flex', flexDirection:'column', alignItems:'center', gap:10 }}>
                  <svg width="34" height="34" viewBox="0 0 24 24" fill="none" stroke="#D8D3F5" strokeWidth="1.5">
                    <path d="M4 19.5A2.5 2.5 0 0 1 6.5 17H20"/><path d="M6.5 2H20v20H6.5A2.5 2.5 0 0 1 4 19.5v-15A2.5 2.5 0 0 1 6.5 2z"/>
                  </svg>
                  <span style={{ fontSize:13 }}>{courses.length===0?'No courses yet — add one or import from Excel.':'No courses match the current filters.'}</span>
                </div>
              </td></tr>
            ) : filtered.map(c => {
              const total = (c.unitsLecture||0)+(c.unitsLab||0)
              const isSel = selected.has(c.id)
              return (
                <tr key={c.id} style={{ background:isSel?'#F7F5FD':'transparent', borderBottom:'1px solid #F5F4FB', transition:'background 0.1s' }}>
                  <td style={{ padding:'10px 8px 10px 16px' }} onClick={e=>e.stopPropagation()}>
                    <Checkbox checked={isSel} onChange={()=>togOne(c.id)} />
                  </td>
                  <td style={{ padding:'10px 12px' }}>
                    <span style={{ display:'inline-block', padding:'2px 9px', background:'#EEEAFB', color:'#7C6FCD', borderRadius:99, fontSize:11, fontWeight:700, letterSpacing:'.3px' }}>{c.courseCode}</span>
                  </td>
                  <td style={{ padding:'10px 12px', fontWeight:500, color:'#1a1a2e', fontSize:13 }}>{c.title}</td>
                  <td style={{ padding:'10px 12px' }}>
                    <span style={{ display:'inline-block', padding:'2px 9px', borderRadius:99, fontSize:11, fontWeight:600 }} className={progClass(c.program)}>{c.program}</span>
                  </td>
                  <td style={{ padding:'10px 12px', textAlign:'center' }}>
                    {(() => { const sc = SEM_COLORS[c.semester] || SEM_COLORS['1st Semester']; return (
                      <span style={{ display:'inline-block', padding:'2px 9px', borderRadius:99, fontSize:10.5, fontWeight:600, background:sc.bg, color:sc.color, border:`1px solid ${sc.border}` }}>
                        {SEM_SHORT[c.semester] || c.semester}
                      </span>
                    ) })()}
                  </td>
                  <td style={{ padding:'10px 12px', textAlign:'center' }}>
                    <span style={{ fontSize:12, color:'#8883B0', fontWeight:500 }}>{YEAR_SHORT[c.yearLevel]??c.yearLevel}</span>
                  </td>
                  <td style={{ padding:'10px 12px', textAlign:'center', fontWeight:600, color:'#1a1a2e' }}>{c.blocks}</td>
                  <td style={{ padding:'10px 12px', textAlign:'center', color:'#8883B0' }}>{c.unitsLecture}</td>
                  <td style={{ padding:'10px 12px', textAlign:'center', color:'#8883B0' }}>{c.unitsLab}</td>
                  <td style={{ padding:'10px 12px', textAlign:'center' }}>
                    <span style={{ fontSize:12, fontWeight:700, color:'#7C6FCD' }}>{total}</span>
                  </td>
                  <td style={{ padding:'10px 14px 10px 8px' }}>
                    <div style={{ display:'flex', alignItems:'center', gap:5 }}>
                      <button className="cp-edit-btn" title="Edit course" onClick={()=>{setEditTarget(c);setError('')}}>
                        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
                          <path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"/>
                          <path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"/>
                        </svg>
                      </button>
                      <button className="cp-delete" onClick={()=>handleDelete(c.courseCode,c.program)}>
                        <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
                          <polyline points="3 6 5 6 21 6"/>
                          <path d="M19 6l-1 14a2 2 0 0 1-2 2H8a2 2 0 0 1-2-2L5 6"/>
                          <path d="M10 11v6M14 11v6"/>
                        </svg>
                        Delete
                      </button>
                    </div>
                  </td>
                </tr>
              )
            })}
          </tbody>
        </table>
        {!loading && filtered.length > 0 && (
          <div style={{ padding:'10px 16px', borderTop:'1px solid #F5F4FB', display:'flex', alignItems:'center' }}>
            <span style={{ fontSize:12, color:'#B0ABCC' }}>
              Showing {filtered.length} of {courses.length} courses
              {selCount>0 && <span style={{ marginLeft:8, color:'#7C6FCD', fontWeight:600 }}>· {selCount} selected</span>}
            </span>
          </div>
        )}
      </div>

      {showAdd && <CourseModal mode="add" initial={{...EMPTY, semester: semesterTab}} onSave={handleAdd} onClose={()=>{setShowAdd(false);setError('')}} saving={saving} error={error} />}
      {editTarget && <CourseModal mode="edit" initial={{...editTarget,yearLevel:String(editTarget.yearLevel), semester:editTarget.semester||'1st Semester'}} onSave={handleEdit} onClose={()=>{setEditTarget(null);setError('')}} saving={saving} error={error} />}
      
      {showImport && (
        <ImportCoursesModal 
          onClose={()=>setShowImport(false)} 
          onImported={()=>{
            load();
            setShowImport(false);
            toast('Courses imported successfully', 'success');
          }} 
        />
      )}

      {showBlockCfg && (
        <BlockConfigModal
          semester={semesterTab}
          onClose={() => setShowBlockCfg(false)}
          onApplied={() => load()}
        />
      )}

      {pendingDelete && (
        <DeleteConfirmModal
          name={pendingDelete.name}
          count={pendingDelete.bulk ? pendingDelete.count : 1}
          deleting={deleting}
          onConfirm={handleConfirmDelete}
          onCancel={() => { if (!deleting) setPendingDelete(null) }}
        />
      )}

      {/* Toast Notification Container */}
      <ToastContainer toasts={toasts} />
    </div>
  )
}