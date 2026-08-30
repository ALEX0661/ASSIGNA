import { useEffect, useState, useMemo, useCallback, useRef } from 'react'
import { getCourses, addCourse, deleteCourse, updateCourse } from '../../services/api'
import ImportCoursesModal from '../../components/ImportCoursesModal'
import BlockConfigModal from '../../components/BlockConfigModal'
import * as XLSX from 'xlsx'

import iconCourses from '../../assets/COURSES.png'
import iconBlocks from '../../assets/BLOCKS.png'
import iconUnits from '../../assets/UNITS.png'
import iconPrograms from '../../assets/PROGRAMS.png'

/* ── Design tokens (Unified with FacultyListPage) ── */
const G = {
  meadow:       '#15803D',
  meadowDeep:   '#0F5C2C',
  meadowMid:    '#166534',
  meadowSoft:   '#DCFCE7',
  meadowBorder: '#BBF7D0',
  ink:          '#0E2A20',
  inkMid:       '#1C3D2A',
  muted:        '#4B7060',
  muted2:       '#6B8C7A',
  border:       '#D8E8DF',
  borderLight:  '#EBF4EF',
  bg:           '#F2F7F4',
  surface:      '#FFFFFF',
  hover:        '#EBF4EF',
  amber:        '#D97706',
  amberSoft:    '#FEF3C7',
  amberBorder:  '#FDE68A',
}

const EMPTY = { courseCode: '', title: '', program: '', yearLevel: '1', blocks: 1, unitsLecture: 3, unitsLab: 0, semester: '1st Semester' }
const YEAR_LABELS = { '1': '1st Year', '2': '2nd Year', '3': '3rd Year', '4': '4th Year' }
const YEAR_SHORT  = { '1': '1st', '2': '2nd', '3': '3rd', '4': '4th' }
const SEMESTERS = ['1st Semester', '2nd Semester', 'Midyear']
const SEM_SHORT = { '1st Semester': '1st Sem', '2nd Semester': '2nd Sem', 'Midyear': 'Midyear' }
const SEM_SHEET = { '1st Semester': 'First Semester', '2nd Semester': 'Second Semester', 'Midyear': 'Midyear' }

const PROGRAMS = [
  { value: 'BSCS',      full: 'BS in Computer Science' },
  { value: 'BSIT',      full: 'BS in Information Technology' },
  { value: 'BSEMC-GD',  full: 'BSEMC – Game Development' },
  { value: 'BSEMC-DAT', full: 'BSEMC – Digital Animation' },
]

const LS_VIEW_PREFS = 'cp-view-prefs'

/* ─── Styles ─────────────────────────────────────────────────────────────── */
{
  let s = document.getElementById('course-page-style')
  if (!s) {
    s = document.createElement('style')
    s.id = 'course-page-style'
    document.head.appendChild(s)
  }
  s.textContent = `
    @import url('https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700&display=swap');

    @keyframes slideIn    { from{opacity:0;transform:translateY(-8px)} to{opacity:1;transform:translateY(0)} }
    @keyframes fadeIn     { from{opacity:0} to{opacity:1} }
    @keyframes cpSpin     { to{transform:rotate(360deg)} }
    @keyframes cpShimmer  { 0%{background-position:-400px 0} 100%{background-position:400px 0} }
    @keyframes cpToastIn  { from{opacity:0;transform:scale(.96) translateY(12px)} to{opacity:1;transform:scale(1) translateY(0)} }

    .cp-skeleton { background:linear-gradient(90deg,${G.hover} 25%,${G.borderLight} 50%,${G.hover} 75%);background-size:800px 100%;animation:cpShimmer 1.4s ease-in-out infinite;border-radius:7px; }

    .cp-toast-wrap { position:fixed;bottom:24px;left:50%;z-index:9999;display:flex;flex-direction:column;gap:10px;align-items:center;pointer-events:none;transform:translateX(-50%); }
    .cp-toast { display:flex;align-items:center;gap:10px;padding:12px 20px;border-radius:12px;font-family:'Inter',sans-serif;font-size:13px;font-weight:600;animation:cpToastIn .22s cubic-bezier(.4,0,.2,1);white-space:nowrap;pointer-events:auto; }
    .cp-toast.success { background:linear-gradient(135deg,${G.meadow},${G.meadowDeep});color:#fff;box-shadow:0 8px 24px rgba(21,128,61,0.3);border:1px solid ${G.meadowBorder}; }
    .cp-toast.error   { background:#fff;color:#DC2626;border:1.5px solid #FECACA;box-shadow:0 8px 24px rgba(220,38,38,0.15); }
    .cp-toast.info    { background:#fff;color:${G.meadow};border:1.5px solid ${G.meadowBorder};box-shadow:0 8px 24px rgba(21,128,61,0.15); }

    .cp-search:focus  { border-color:${G.meadow}!important;box-shadow:0 0 0 3px rgba(21,128,61,0.12)!important;background:#fff!important; }
    .cp-tr-hover:hover td { background:${G.hover}; }

    .cp-inp, .cp-sel { padding: 9px 12px; border-radius: 10px; border: 1px solid ${G.border}; font-family: 'Inter',sans-serif; font-size: 12.5px; color: ${G.ink}; background: #fff; outline: none; transition: all 0.15s ease; width: 100%; box-sizing: border-box; box-shadow: 0 1px 3px rgba(0,0,0,0.02); }
    .cp-inp:focus,.cp-sel:focus { border-color:${G.meadow}; box-shadow:0 0 0 3px rgba(21,128,61,0.1); }
    .cp-sel { appearance:none; cursor:pointer; padding-right:32px; background-image:url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='12' height='12' viewBox='0 0 24 24' fill='none' stroke='%236B8C7A' stroke-width='2.5'%3E%3Cpolyline points='6 9 12 15 18 9'/%3E%3C/svg%3E"); background-repeat:no-repeat; background-position:right 12px center; }

    .cp-th-sort { cursor:pointer; user-select:none; transition: color .15s; }
    .cp-th-sort:hover { color: ${G.meadowDeep}!important; }
    .cp-th-sort .cp-sort-arrow { display:inline-block; margin-left:4px; opacity:0; transition: opacity .15s; }
    .cp-th-sort.active .cp-sort-arrow { opacity:1; }
    .cp-th-sort:hover .cp-sort-arrow { opacity:0.6; }

    /* Compact Stats Cards */
    .cp-stat-card { background:#fff; border:1px solid ${G.border}; border-radius:12px; padding:12px 14px; display:flex; align-items:center; gap:14px; transition: all .15s ease; box-shadow: 0 2px 4px rgba(10,46,28,0.03); }
    .cp-stat-card:hover { border-color: ${G.meadowBorder}; box-shadow: 0 4px 12px rgba(21,128,61,0.06); transform: translateY(-1px); }
    .cp-stat-card.warn { border-color:${G.amberBorder}; background:${G.amberSoft}; }
    .cp-stat-card.warn:hover { border-color:${G.amber}; box-shadow: 0 4px 12px rgba(217,119,6,0.1); }
    .cp-stat-icon-wrap { width: 46px; height: 46px; border-radius: 10px; display: flex; align-items: center; justify-content: center; flex-shrink: 0; }
  `
}

/* ─── Shared Components ──────────────────────────────────────────────────── */
function Skel({ w = '100%', h = 14, r = 6, style = {} }) {
  return <div className="cp-skeleton" style={{ width: w, height: h, borderRadius: r, flexShrink: 0, ...style }} />
}

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
      {toasts.map(t => <div key={t.id} className={`cp-toast ${t.type}`}>{icons[t.type]}{t.message}</div>)}
    </div>
  )
}

function Checkbox({ checked, indeterminate, onChange }) {
  const active = checked || indeterminate
  return (
    <span onClick={onChange} style={{
      width: 16, height: 16, borderRadius: 4, flexShrink: 0,
      border: `1.5px solid ${active ? G.meadow : G.border}`,
      background: active ? G.meadow : 'transparent',
      display: 'inline-flex', alignItems: 'center', justifyContent: 'center',
      transition: 'all 0.15s', cursor: 'pointer',
      boxShadow: active ? '0 2px 6px rgba(21,128,61,0.3)' : 'none',
    }}>
      {indeterminate && !checked && <svg width="8" height="2" viewBox="0 0 8 2" fill="none"><rect width="8" height="2" rx="1" fill="#fff"/></svg>}
      {checked && <svg width="9" height="7" viewBox="0 0 9 7" fill="none"><polyline points="1,3.5 3.5,6 8,1" stroke="#fff" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round"/></svg>}
    </span>
  )
}

function FilterPill({ label, count, active, onClick, icon }) {
  return (
    <button onClick={onClick} style={{
      padding: '6px 14px', borderRadius: 10, fontSize: 11.5,
      fontFamily: "'Inter',sans-serif", fontWeight: active ? 600 : 500,
      background: active ? '#E5F9EC' : '#fff',
      color: active ? G.meadowDeep : G.muted,
      border: `1px solid ${active ? G.meadowBorder : G.border}`,
      cursor: 'pointer', transition: 'all .15s',
      display: 'flex', alignItems: 'center', gap: 6,
      boxShadow: active ? '0 2px 8px rgba(21,128,61,0.08)' : '0 1px 2px rgba(0,0,0,0.02)'
    }}
    onMouseEnter={e => { if(!active) { e.currentTarget.style.borderColor = G.meadowBorder; e.currentTarget.style.color = G.meadow } }}
    onMouseLeave={e => { if(!active) { e.currentTarget.style.borderColor = G.border; e.currentTarget.style.color = G.muted } }}
    >
      {active && <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3"><polyline points="20 6 9 17 4 12"/></svg>}
      {icon && !active && icon}
      <span style={{ maxWidth: 180, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{label}</span>
      {count != null && <span style={{ fontSize: 10.5, opacity: active ? 0.8 : 0.5, flexShrink: 0 }}>{count}</span>}
    </button>
  )
}

function SectionLabel({ label, count, onClear, icon }) {
  return (
    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 12 }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
        {icon && <div style={{ color: G.muted2, display: 'flex' }}>{icon}</div>}
        <span style={{ fontSize: 13, fontWeight: 600, color: G.ink }}>{label}</span>
        {count > 0 && (
          <span style={{ fontSize: 10, fontWeight: 700, padding: '2px 6px', borderRadius: 6, background: G.meadowSoft, color: G.meadow }}>{count}</span>
        )}
      </div>
      {count > 0 && (
        <button onClick={onClear} style={{ fontSize: 11.5, color: G.muted2, background: 'none', border: 'none', cursor: 'pointer', fontFamily: "'Inter',sans-serif", fontWeight: 500, transition: 'color .15s' }}
          onMouseEnter={e => e.currentTarget.style.color = G.meadow}
          onMouseLeave={e => { e.currentTarget.style.color = G.muted2 }}>
          Clear
        </button>
      )}
    </div>
  )
}

function progColor(p = '') {
  const v = p.toUpperCase()
  if (v === 'BSCS') return { bg: '#E0F2FE', color: '#0369A1', border: '#BAE6FD' }
  if (v === 'BSIT') return { bg: '#DCFCE7', color: '#15803D', border: '#BBF7D0' }
  if (v.includes('GD'))  return { bg: '#FEF3C7', color: '#B45309', border: '#FDE68A' }
  if (v.includes('DAT')) return { bg: '#FEE2E2', color: '#B91C1C', border: '#FECACA' }
  return { bg: G.borderLight, color: G.muted, border: G.border }
}

function courseIssue(c) {
  const totalUnits = (c.unitsLecture || 0) + (c.unitsLab || 0)
  if (!c.blocks || c.blocks < 1) return 'No sections defined'
  if (totalUnits === 0) return 'No units assigned'
  return null
}

function WarnIcon({ size = 14 }) {
  return <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"><path d="M10.29 3.86 1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z"/><line x1="12" y1="9" x2="12" y2="13"/><line x1="12" y1="17" x2="12.01" y2="17"/></svg>
}

/* ─── Modals ─────────────────────────────────────────────────────────────── */
function DeleteConfirmModal({ name, count, onConfirm, onCancel, deleting }) {
  const isBulk   = count > 1
  const title    = isBulk ? `Permanently Delete ${count} Courses?` : 'Permanently Delete?'
  return (
    <div style={{ position: 'fixed', inset: 0, zIndex: 1100, background: 'rgba(10,30,18,0.55)', backdropFilter: 'blur(4px)', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 24 }}>
      <div style={{ background: '#fff', borderRadius: 18, padding: '28px 28px 24px', maxWidth: 400, width: '100%', boxShadow: '0 20px 60px rgba(10,30,18,0.22)', textAlign: 'center' }}>
        <div style={{ width: 52, height: 52, borderRadius: '50%', background: '#FFE8E8', margin: '0 auto 16px', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
          <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="#C0392B" strokeWidth="2"><polyline points="3 6 5 6 21 6"/><path d="M19 6l-1 14a2 2 0 0 1-2 2H8a2 2 0 0 1-2-2L5 6"/><path d="M10 11v6M14 11v6M9 6V4h6v2"/></svg>
        </div>
        <div style={{ fontSize: 16, fontWeight: 700, color: G.ink, marginBottom: 8 }}>{title}</div>
        <div style={{ fontSize: 13, color: G.muted2, marginBottom: 24, lineHeight: 1.5 }}>
          {isBulk ? `This cannot be undone. All ${count} courses will be removed forever.` : `This cannot be undone. ${name} will be removed forever.`}
        </div>
        <div style={{ display: 'flex', gap: 10 }}>
          <button onClick={onCancel} disabled={deleting} style={{ flex: 1, padding: '10px', borderRadius: 9, border: `1.5px solid ${G.border}`, background: '#fff', fontSize: 13, fontWeight: 600, color: G.muted, cursor: deleting ? 'default' : 'pointer', fontFamily: 'Inter,sans-serif' }}>Cancel</button>
          <button onClick={onConfirm} disabled={deleting} style={{ flex: 1, padding: '10px', borderRadius: 9, border: 'none', background: '#C0392B', fontSize: 13, fontWeight: 700, color: '#fff', cursor: deleting ? 'default' : 'pointer', fontFamily: 'Inter,sans-serif', opacity: deleting ? 0.7 : 1 }}>
            {deleting ? 'Deleting...' : isBulk ? `Delete ${count}` : 'Yes, Delete'}
          </button>
        </div>
      </div>
    </div>
  )
}

function CourseModal({ mode, initial, onSave, onClose, saving, error }) {
  const [form, setForm] = useState(initial || EMPTY)
  const isEdit = mode === 'edit'
  const isDuplicate = mode === 'duplicate'
  const set = (k, v) => setForm(f => ({ ...f, [k]: v }))
  const canSave = form.courseCode.trim() && form.title.trim() && form.program

  function submit() {
    onSave({ ...form, yearLevel: Number(form.yearLevel), blocks: Number(form.blocks), unitsLecture: Number(form.unitsLecture), unitsLab: Number(form.unitsLab), semester: form.semester })
  }

  return (
    <div style={{ position: 'fixed', inset: 0, zIndex: 1100, background: 'rgba(14,42,32,0.45)', backdropFilter: 'blur(4px)', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 24 }} onClick={e => e.target === e.currentTarget && onClose()}>
      <div style={{ background: '#fff', borderRadius: 20, width: '100%', maxWidth: 560, boxShadow: '0 24px 64px rgba(14,42,32,0.24)', overflow: 'hidden' }}>
        <div style={{ padding: '20px 24px', borderBottom: `1px solid ${G.border}`, display: 'flex', alignItems: 'center', justifyContent: 'space-between', background: '#fff' }}>
          <div>
            <div style={{ fontSize: 16, fontWeight: 700, color: G.ink, fontFamily: "'Inter',sans-serif" }}>
              {isEdit ? 'Edit Course' : isDuplicate ? 'Duplicate Course' : 'Add New Course'}
            </div>
            <div style={{ fontSize: 12, color: G.muted2, marginTop: 4 }}>
              {isEdit ? `Modifying ${initial?.courseCode}` : isDuplicate ? `Copying from ${initial?.courseCode} — adjust the code and save` : 'Fill in the course details below'}
            </div>
          </div>
          <button onClick={onClose} style={{ width: 32, height: 32, borderRadius: 8, border: `1px solid ${G.border}`, background: '#fff', display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer', padding: 0, transition: 'all .15s' }}
            onMouseEnter={e => { e.currentTarget.style.background = '#FFE8E8'; e.currentTarget.style.borderColor = '#FECACA'; e.currentTarget.style.color = '#DC2626' }}
            onMouseLeave={e => { e.currentTarget.style.background = '#fff'; e.currentTarget.style.borderColor = G.border; e.currentTarget.style.color = G.muted }}>
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg>
          </button>
        </div>

        <div style={{ padding: '24px', display: 'flex', flexDirection: 'column', gap: 16 }}>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16 }}>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
              <label style={{ fontSize: 11.5, fontWeight: 600, color: G.ink }}>Course Code *</label>
              <input className="cp-inp" value={form.courseCode} onChange={e => set('courseCode', e.target.value)} placeholder="e.g. CS 101" autoFocus={isDuplicate} />
            </div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
              <label style={{ fontSize: 11.5, fontWeight: 600, color: G.ink }}>Program *</label>
              <select className="cp-sel" value={form.program} onChange={e => set('program', e.target.value)}>
                <option value="" disabled>Select program…</option>
                {PROGRAMS.map(p => <option key={p.value} value={p.value}>{p.value} — {p.full}</option>)}
              </select>
            </div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 6, gridColumn: 'span 2' }}>
              <label style={{ fontSize: 11.5, fontWeight: 600, color: G.ink }}>Course Title *</label>
              <input className="cp-inp" value={form.title} onChange={e => set('title', e.target.value)} placeholder="e.g. Introduction to Computing" />
            </div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
              <label style={{ fontSize: 11.5, fontWeight: 600, color: G.ink }}>Year Level</label>
              <select className="cp-sel" value={form.yearLevel} onChange={e => set('yearLevel', e.target.value)}>
                {Object.entries(YEAR_LABELS).map(([v,l]) => <option key={v} value={v}>{l}</option>)}
              </select>
            </div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
              <label style={{ fontSize: 11.5, fontWeight: 600, color: G.ink }}>Sections / Blocks</label>
              <input className="cp-inp" type="number" min={1} value={form.blocks} onChange={e => set('blocks', e.target.value)} />
            </div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
              <label style={{ fontSize: 11.5, fontWeight: 600, color: G.ink }}>Lecture Units</label>
              <input className="cp-inp" type="number" min={0} value={form.unitsLecture} onChange={e => set('unitsLecture', e.target.value)} />
            </div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
              <label style={{ fontSize: 11.5, fontWeight: 600, color: G.ink }}>Lab Units</label>
              <input className="cp-inp" type="number" min={0} value={form.unitsLab} onChange={e => set('unitsLab', e.target.value)} />
            </div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 6, gridColumn: 'span 2' }}>
              <label style={{ fontSize: 11.5, fontWeight: 600, color: G.ink }}>Semester</label>
              <select className="cp-sel" value={form.semester} onChange={e => set('semester', e.target.value)}>
                {SEMESTERS.map(s => <option key={s} value={s}>{s}</option>)}
              </select>
            </div>
          </div>

          <div style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '10px 14px', borderRadius: 8, background: '#FAFAFE', border: `1px solid ${G.borderLight}` }}>
            <div style={{ width: 6, height: 6, borderRadius: '50%', background: G.meadow, flexShrink: 0 }} />
            <span style={{ fontSize: 11.5, color: G.muted }}>
              Total units: <strong style={{ color: G.ink }}>{Number(form.unitsLecture)+Number(form.unitsLab)}</strong>
              {form.program && <span style={{ marginLeft: 16 }}>Program: <strong style={{ color: G.ink }}>{form.program}</strong></span>}
            </span>
          </div>

          {error && (
            <div style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '10px 14px', borderRadius: 8, background: '#FEF2F2', border: '1px solid #FECACA', fontSize: 11.5, color: '#DC2626' }}>
              <WarnIcon size={16} />
              {error}
            </div>
          )}
        </div>

        <div style={{ padding: '16px 24px', borderTop: `1px solid ${G.border}`, display: 'flex', alignItems: 'center', justifyContent: 'flex-end', gap: 10, background: '#FAFAFE' }}>
          <button onClick={onClose} style={{ padding: '8px 18px', borderRadius: 10, border: `1.5px solid ${G.border}`, background: '#fff', color: G.muted, fontSize: 12.5, fontWeight: 600, cursor: 'pointer', fontFamily: "'Inter',sans-serif", transition: 'all .15s' }}
            onMouseEnter={e => { e.currentTarget.style.background = '#FFF5F5'; e.currentTarget.style.borderColor = '#FECACA'; e.currentTarget.style.color = '#DC2626' }}
            onMouseLeave={e => { e.currentTarget.style.background = '#fff'; e.currentTarget.style.borderColor = G.border; e.currentTarget.style.color = G.muted }}>
            Cancel
          </button>
          <button onClick={submit} disabled={saving || !canSave} style={{ padding: '8px 22px', borderRadius: 10, border: 'none', background: `linear-gradient(135deg,${G.meadow},${G.meadowDeep})`, color: '#fff', fontSize: 12.5, fontWeight: 600, cursor: 'pointer', fontFamily: "'Inter',sans-serif", transition: 'all .15s', display: 'flex', alignItems: 'center', gap: 8, opacity: (saving || !canSave) ? 0.6 : 1, boxShadow: '0 4px 14px rgba(21,128,61,0.3)' }}
            onMouseEnter={e => { if(!saving && canSave) { e.currentTarget.style.transform = 'translateY(-1px)'; e.currentTarget.style.boxShadow = '0 6px 20px rgba(21,128,61,0.4)' } }}
            onMouseLeave={e => { if(!saving && canSave) { e.currentTarget.style.transform = 'none'; e.currentTarget.style.boxShadow = '0 4px 14px rgba(21,128,61,0.3)' } }}>
            {saving ? <span style={{ animation: 'cpSpin .8s linear infinite' }}>↻</span> : <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"><polyline points="20 6 9 17 4 12"/></svg>}
            {isEdit ? 'Save Changes' : isDuplicate ? 'Create Copy' : 'Add Course'}
          </button>
        </div>
      </div>
    </div>
  )
}

/* ─── Stats Bar ──────────────────────────────────────────────────────────── */
function StatsBar({ loading, filtered, isFiltered }) {
  const stats = useMemo(() => {
    const totalLec = filtered.reduce((s, c) => s + (c.unitsLecture || 0), 0)
    const totalLab = filtered.reduce((s, c) => s + (c.unitsLab || 0), 0)
    const totalSections = filtered.reduce((s, c) => s + (c.blocks || 0), 0)
    const programs = new Set(filtered.map(c => c.program).filter(Boolean)).size
    const issues = filtered.filter(c => courseIssue(c)).length
    return { count: filtered.length, totalLec, totalLab, totalUnits: totalLec + totalLab, totalSections, programs, issues }
  }, [filtered])

  const items = [
    { 
      label: 'Total Courses', 
      value: stats.count, 
      icon: <img src={iconCourses} alt="Courses" style={{ width: 26, height: 26, objectFit: 'contain' }} />, 
      color: G.meadow, 
      bg: G.meadowSoft 
    },
    { 
      label: 'Active Sections', 
      value: stats.totalSections, 
      icon: <img src={iconBlocks} alt="Blocks" style={{ width: 26, height: 26, objectFit: 'contain' }} />, 
      color: G.meadow, 
      bg: G.meadowSoft 
    },
    {
      label: 'Combined Units', 
      value: stats.totalUnits,
      subtitle: (
        <span style={{ display: 'inline-flex', alignItems: 'center', gap: 6, marginTop: 4 }}>
          <span style={{ display: 'inline-flex', alignItems: 'center', gap: 3 }}>
            <span style={{ width: 6, height: 6, borderRadius: '2px', background: G.meadow, display: 'inline-block' }} />
            <span style={{ fontSize: 10.5, color: G.muted, fontWeight: 600 }}>{stats.totalLec} Lec</span>
          </span>
          <span style={{ display: 'inline-flex', alignItems: 'center', gap: 3 }}>
            <span style={{ width: 6, height: 6, borderRadius: '2px', background: '#0369A1', display: 'inline-block' }} />
            <span style={{ fontSize: 10.5, color: G.muted, fontWeight: 600 }}>{stats.totalLab} Lab</span>
          </span>
        </span>
      ),
      icon: <img src={iconUnits} alt="Units" style={{ width: 26, height: 26, objectFit: 'contain' }} />, 
      color: G.meadow, 
      bg: G.meadowSoft,
    },
    { 
      label: 'Programs', 
      value: stats.programs, 
      icon: <img src={iconPrograms} alt="Programs" style={{ width: 26, height: 26, objectFit: 'contain' }} />, 
      color: G.meadow, 
      bg: G.meadowSoft 
    },
  ]

  return (
    <div style={{ marginBottom: isFiltered ? 8 : 16 }}>
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))', gap: 12 }}>
        {items.map(it => (
          <div key={it.label} className="cp-stat-card">
            <div className="cp-stat-icon-wrap" style={{ background: it.bg, color: it.color }}>{it.icon}</div>
            <div style={{ minWidth: 0, flex: 1 }}>
              <div style={{ fontSize: 11, fontWeight: 600, color: G.muted2, marginBottom: 2, textTransform: 'uppercase', letterSpacing: '0.5px' }}>{it.label}</div>
              {loading ? <Skel w={40} h={18} r={4} /> : <div style={{ fontSize: 18, fontWeight: 700, color: G.ink, lineHeight: 1.1 }}>{it.value}</div>}
              {it.subtitle && !loading && it.subtitle}
            </div>
          </div>
        ))}
        {!loading && stats.issues > 0 && (
          <div className="cp-stat-card warn">
            <div className="cp-stat-icon-wrap" style={{ background: '#FEF3C7', color: '#D97706' }}><WarnIcon size={16} /></div>
            <div style={{ minWidth: 0, flex: 1 }}>
              <div style={{ fontSize: 11, fontWeight: 600, color: '#D97706', marginBottom: 2, textTransform: 'uppercase', letterSpacing: '0.5px' }}>Needs Attention</div>
              <div style={{ fontSize: 18, fontWeight: 700, color: '#D97706', lineHeight: 1.1 }}>{stats.issues}</div>
            </div>
          </div>
        )}
      </div>
      {!loading && isFiltered && (
        <div style={{ fontSize: 11.5, color: G.muted, marginTop: 8, display: 'flex', alignItems: 'center', gap: 6 }}>
          <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"><circle cx="12" cy="12" r="10"/><path d="M12 8v4"/><line x1="12" y1="16" x2="12.01" y2="16"/></svg>
          Metrics reflect current search and filter selections
        </div>
      )}
    </div>
  )
}

/* ─── Sortable column header ─────────────────────────────────────────────── */
function SortTh({ label, field, sortBy, sortDir, onSort, center, right, width }) {
  const active = sortBy === field
  return (
    <th
      className={`cp-th-sort${active ? ' active' : ''}`}
      onClick={() => onSort(field)}
      style={{
        width, padding: '10px 14px', textAlign: center ? 'center' : right ? 'right' : 'left',
        fontWeight: 700, color: G.muted2, fontSize: 10.5, textTransform: 'uppercase', letterSpacing: '.7px',
        borderBottom: `1.5px solid ${G.border}`, whiteSpace: 'nowrap',
      }}
    >
      {label}
      <span className="cp-sort-arrow">{sortDir === 'asc' ? '↑' : '↓'}</span>
    </th>
  )
}

import { useTour } from '../../hooks/useTour.jsx'

const TOUR_SEEN_KEY = 'adminCourses_tourSeen'
function isOnboardingCompleted() {
  try { return localStorage.getItem(TOUR_SEEN_KEY) === '1' } catch { return true }
}
function markOnboardingCompleted() {
  try { localStorage.setItem(TOUR_SEEN_KEY, '1') } catch {}
}

/* ─── Main Page ───────────────────────────────────────────────────────────── */
export default function CourseListPage() {
  const { toasts, toast } = useToast()

  

  

  const initialPrefs = useMemo(() => {
    try { return JSON.parse(localStorage.getItem(LS_VIEW_PREFS)) || {} } catch { return {} }
  }, [])

  const [courses,       setCourses]       = useState([])
  const [loading,       setLoading]       = useState(true)

  const { TourElement, startTour } = useTour('adminCourses', [
    {
      target: '#tour-semester-tabs',
      title: '1st Sem, 2nd Sem, Midyear',
      content: 'Courses are grouped by semester — switch tabs to see and manage the offering for each term separately.',
      disableBeacon: true,
    },
    {
      target: '#tour-block-config-btn',
      title: 'Configure Blocks',
      content: 'Set how many blocks/sections each program and year level gets — this determines how many parallel sections of a course the scheduler needs to fill.',
    },
    {
      target: '#tour-header-actions',
      title: 'Export & Import',
      content: 'Export the full course list to Excel, or bulk-upload a spreadsheet of courses instead of entering them one by one.',
    },
    {
      target: '#tour-add-course-btn',
      title: 'Add a Course',
      content: 'Manually add a single course — set its code, title, units, program, and whether it has a lab component.',
    },
    {
      target: '#tour-stats-bar',
      title: 'Semester Summary',
      content: 'A quick read on the currently selected semester — total courses, units, and how they split between lecture and lab.',
    },
    {
      target: '#tour-search-toolbar',
      title: 'Search & Filter',
      content: 'Find a course by code or title, or open advanced filters to narrow by program, year level, or lab status.',
    },
    {
      target: '#tour-courses-table-anchor',
      spotlightTarget: '#tour-courses-table',
      title: 'The Course List',
      content: 'Every course for this semester lives here. Click a row to edit its details, or use the action icons to duplicate or delete it.',
      placement: 'center',
    },
  ], !loading)
  const [search,        setSearch]        = useState('')
  const [progFilter,    setProgFilter]    = useState([])
  const [yearFilter,    setYearFilter]    = useState([])
  const [typeFilter,    setTypeFilter]    = useState('')
  const [issuesOnly,    setIssuesOnly]    = useState(false)
  const [semesterTab,   setSemesterTab]   = useState('1st Semester')
  const [sortBy,        setSortBy]        = useState(initialPrefs.sortBy || 'code')
  const [sortDir,       setSortDir]       = useState(initialPrefs.sortDir || 'asc')
  const [showImport,    setShowImport]    = useState(false)
  const [showAdd,       setShowAdd]       = useState(false)
  const [showBlockCfg,  setShowBlockCfg]  = useState(false)
  const [showFilters,   setShowFilters]   = useState(false)
  const [editTarget,    setEditTarget]    = useState(null)
  const [dupTarget,     setDupTarget]     = useState(null)
  const [saving,        setSaving]        = useState(false)
  const [error,         setError]         = useState('')
  const [selected,      setSelected]      = useState(new Set())
  const [deleting,      setDeleting]      = useState(false)
  const [pendingDelete, setPendingDelete] = useState(null)

  const searchRef = useRef(null)

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

  useEffect(() => {
    localStorage.setItem(LS_VIEW_PREFS, JSON.stringify({ sortBy, sortDir }))
  }, [sortBy, sortDir])

  useEffect(() => {
    function onKey(e) {
      if (e.key === '/' && document.activeElement?.tagName !== 'INPUT' && document.activeElement?.tagName !== 'SELECT' && document.activeElement?.tagName !== 'TEXTAREA') {
        e.preventDefault()
        searchRef.current?.focus()
      }
      if (e.key === 'Escape' && document.activeElement === searchRef.current) {
        searchRef.current?.blur()
      }
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [])

  const programs = useMemo(() => Array.from(new Set(courses.map(c=>c.program).filter(Boolean))).sort(), [courses])
  const YEAR_OPTS = ['1','2','3','4']

  const filtered = useMemo(() => {
    let list = courses.filter(c => {
      const q = search.toLowerCase()
      const matchSem = c.semester === semesterTab || (semesterTab === 'all')
      const matchType = typeFilter === 'lab' ? (c.unitsLab > 0) : typeFilter === 'lec' ? (c.unitsLab === 0) : true
      const matchIssue = !issuesOnly || courseIssue(c)
      return matchSem && matchType && matchIssue
        && (!q || `${c.courseCode} ${c.title}`.toLowerCase().includes(q))
        && (progFilter.length === 0 || progFilter.includes(c.program))
        && (yearFilter.length === 0 || yearFilter.includes(String(c.yearLevel)))
    })

    const dir = sortDir === 'asc' ? 1 : -1
    const cmp = {
      code:     (a, b) => a.courseCode.localeCompare(b.courseCode),
      title:    (a, b) => a.title.localeCompare(b.title),
      program:  (a, b) => (a.program || '').localeCompare(b.program || ''),
      year:     (a, b) => Number(a.yearLevel || 0) - Number(b.yearLevel || 0),
      sections: (a, b) => (a.blocks || 0) - (b.blocks || 0),
      units:    (a, b) => ((a.unitsLecture||0)+(a.unitsLab||0)) - ((b.unitsLecture||0)+(b.unitsLab||0)),
    }[sortBy] || (() => 0)

    list.sort((a, b) => cmp(a, b) * dir)
    return list
  }, [courses, search, progFilter, yearFilter, semesterTab, typeFilter, issuesOnly, sortBy, sortDir])

  function handleSort(field) {
    if (sortBy === field) {
      setSortDir(d => d === 'asc' ? 'desc' : 'asc')
    } else {
      setSortBy(field)
      setSortDir('asc')
    }
  }

  const semesterCounts = useMemo(() => {
    const counts = {}
    SEMESTERS.forEach(s => { counts[s] = courses.filter(c => (c.semester || '1st Semester') === s).length })
    return counts
  }, [courses])

  const activeModalFilterCount = progFilter.length + yearFilter.length + (typeFilter ? 1 : 0) + (issuesOnly ? 1 : 0)
  const hasFilter   = search || activeModalFilterCount > 0
  const filteredIds = filtered.map(c => c.id)
  const allSel      = filteredIds.length > 0 && filteredIds.every(id => selected.has(id))
  const someSel     = filteredIds.some(id => selected.has(id)) && !allSel
  const selCount    = [...selected].filter(id => filteredIds.includes(id)).length
  const selectionMode = selCount > 0

  const togProg = p => setProgFilter(v => v.includes(p) ? v.filter(x=>x!==p) : [...v,p])
  const togYear = y => setYearFilter(v => v.includes(y) ? v.filter(x=>x!==y) : [...v,y])
  const togAll  = () => allSel
    ? setSelected(p => { const n=new Set(p); filteredIds.forEach(id=>n.delete(id)); return n })
    : setSelected(p => { const n=new Set(p); filteredIds.forEach(id=>n.add(id)); return n })
  const togOne  = id => setSelected(p => { const n=new Set(p); n.has(id)?n.delete(id):n.add(id); return n })

  function resetFilters() {
    setSearch(''); setProgFilter([]); setYearFilter([]); setTypeFilter(''); setIssuesOnly(false)
  }

  async function handleAdd(data) {
    setSaving(true); setError('')
    try {
      await addCourse(data)
      setShowAdd(false)
      setDupTarget(null)
      load()
      toast('Course added successfully', 'success')
    }
    catch(err) { setError(err.response?.data?.detail || 'Failed to add course.') }
    finally { setSaving(false) }
  }

  async function handleEdit(data) {
    setSaving(true); setError('')
    try {
      await updateCourse(editTarget.courseCode, editTarget.program, data)
      setEditTarget(null)
      load()
      toast('Course updated successfully', 'success')
    }
    catch(err) { setError(err.response?.data?.detail || 'Failed to update course.') }
    finally { setSaving(false) }
  }

  function handleDelete(code, prog) {
    setPendingDelete({ code, prog, name: code })
  }

  function handleDuplicate(course) {
    setError('')
    setDupTarget({
      ...course,
      courseCode: `${course.courseCode}-COPY`,
      yearLevel: String(course.yearLevel),
      id: undefined,
    })
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
      setSelected(new Set())
      load()
    } catch (err) {
      toast('Failed to delete course(s)', 'error')
    } finally { setDeleting(false) }
  }

  function handleExport() {
    if (!filtered.length) return // Use 'filtered' instead of 'courses'

    const headers = ['Course Code', 'Title', 'Program', 'Semester', 'Year Level', 'Sections', 'Lecture Units', 'Lab Units', 'Total Units']
    const colWidths = [
      { wch: 16 }, { wch: 38 }, { wch: 14 }, { wch: 16 },
      { wch: 12 }, { wch: 10 }, { wch: 11 }, { wch: 10 }, { wch: 12 },
    ]

    const wb = XLSX.utils.book_new()

    SEMESTERS.forEach(sem => {
      // Filter from the 'filtered' array to respect active search/filters
      const semCourses = filtered.filter(c => (c.semester || '1st Semester') === sem)
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

    // 1. Build a dynamic filename based on active filters
    const filterParts = []
    
    if (progFilter.length > 0) {
      filterParts.push(progFilter.join('-'))
    }
    
    if (yearFilter.length > 0) {
      // Sort years ascending to keep strings tidy (e.g. '3rd-4th')
      const sortedYears = [...yearFilter].sort((a, b) => Number(a) - Number(b))
      filterParts.push(sortedYears.map(y => YEAR_SHORT[y]).join('-') + '-Year')
    }
    
    if (typeFilter === 'lec') filterParts.push('Lec-Only')
    if (typeFilter === 'lab') filterParts.push('Has-Lab')
    if (issuesOnly) filterParts.push('Needs-Attention')
    
    const filterSuffix = filterParts.length > 0 ? `-${filterParts.join('_')}` : ''
    const date = new Date().toISOString().slice(0, 10)
    
    // 2. Append the dynamic suffix to the exported file name
    XLSX.writeFile(wb, `Courses${filterSuffix}-${date}.xlsx`)
    toast('Filtered courses exported successfully', 'success')
  }

  return (
    <div className="page" style={{ fontFamily:"'Inter',sans-serif", background: G.bg, minHeight: '100%', padding: '28px 32px' }}>
      {TourElement}
      {/* ── Header Row ── */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16, gap: 12, flexWrap: 'wrap' }}>

        {/* Semester Tabs - Unified with Faculty active/archived toggle */}
        <div id="tour-semester-tabs" style={{ display: 'flex', gap: 3, background: '#fff', borderRadius: 10, padding: 3, border: `1px solid ${G.border}`, flexShrink: 0 }}>
          {SEMESTERS.map(sem => {
            const isActive = semesterTab === sem
            return (
              <button
                key={sem}
                onClick={() => { setSemesterTab(sem); setSelected(new Set()) }}
                style={{
                  padding: '5px 16px', borderRadius: 7, fontSize: 12, fontWeight: isActive ? 700 : 500,
                  background: isActive ? G.meadow : 'transparent',
                  color: isActive ? '#fff' : G.muted,
                  border: isActive ? 'none' : '1px solid transparent',
                  cursor: 'pointer', transition: 'all 0.15s', fontFamily: "'Inter',sans-serif",
                  boxShadow: isActive ? '0 2px 8px rgba(21,128,61,0.28)' : 'none',
                  display: 'flex', alignItems: 'center', gap: 6
                }}
              >
                {SEM_SHORT[sem]}
                <span className="cp-sem-count" style={{
                  background: 'none',
                  color: isActive ? 'rgba(255,255,255,0.85)' : G.muted2
                }}>
                  {loading ? '…' : semesterCounts[sem] || 0}
                </span>
              </button>
            )
          })}
        </div>

        <div id="tour-header-actions" style={{ display: 'flex', gap: 8, alignItems: 'center', flexShrink: 0 }}>
          <button id="tour-block-config-btn" onClick={() => setShowBlockCfg(true)} title="Configure blocks per program-year"
            style={{ display: 'inline-flex', alignItems: 'center', justifyContent: 'center', width: 34, height: 34, borderRadius: 8, border: `1px solid ${G.border}`, background: '#fff', color: G.muted, cursor: 'pointer', transition: 'all .15s', padding: 0 }}
            onMouseEnter={e => { e.currentTarget.style.background = G.hover; e.currentTarget.style.color = G.meadow }}
            onMouseLeave={e => { e.currentTarget.style.background = '#fff'; e.currentTarget.style.color = G.muted }}>
            <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2"><rect x="3" y="3" width="7" height="7" rx="1"/><rect x="14" y="3" width="7" height="7" rx="1"/><rect x="3" y="14" width="7" height="7" rx="1"/><rect x="14" y="14" width="7" height="7" rx="1"/></svg>
          </button>

          {/* Export */}
          <button onClick={handleExport} disabled={!filtered.length} title="Export all semesters to Excel"
            style={{ display: 'inline-flex', alignItems: 'center', gap: 6, padding: '7px 12px', borderRadius: 8, border: `1px solid ${G.border}`, background: '#fff', color: G.muted2, fontSize: 11.5, fontWeight: 500, cursor: filtered.length ? 'pointer' : 'not-allowed', opacity: filtered.length ? 1 : 0.45, transition: 'all .15s', fontFamily: "'Inter',sans-serif" }}
            onMouseEnter={e => { if (filtered.length) { e.currentTarget.style.background = G.hover; e.currentTarget.style.color = G.meadow }}}
            onMouseLeave={e => { e.currentTarget.style.background = '#fff'; e.currentTarget.style.color = G.muted2 }}>
            <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2">
              <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/>
              <polyline points="7 10 12 15 17 10"/>
              <line x1="12" y1="15" x2="12" y2="3"/>
            </svg>
            Export
          </button>

          {/* Import */}
          <button onClick={() => setShowImport(true)}
            style={{ display: 'inline-flex', alignItems: 'center', gap: 7, padding: '8px 16px', borderRadius: 10, border: `1px solid ${G.border}`, fontFamily: "'Inter',sans-serif", fontSize: 12.5, fontWeight: 600, cursor: 'pointer', transition: 'all .15s', background: '#fff', color: G.muted }}
            onMouseEnter={e => { e.currentTarget.style.background = G.hover; e.currentTarget.style.borderColor = G.meadowBorder; e.currentTarget.style.color = G.meadow }}
            onMouseLeave={e => { e.currentTarget.style.background = '#fff'; e.currentTarget.style.borderColor = G.border; e.currentTarget.style.color = G.muted }}>
            <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
              <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/>
              <polyline points="17 8 12 3 7 8"/>
              <line x1="12" y1="3" x2="12" y2="15"/>
            </svg>
            Upload Courses
          </button>

          <button id="tour-add-course-btn" onClick={() => { setShowAdd(true); setError('') }}
            style={{ display: 'inline-flex', alignItems: 'center', gap: 7, padding: '8px 18px', borderRadius: 10, border: 'none', fontFamily: "'Inter',sans-serif", fontSize: 12.5, fontWeight: 600, cursor: 'pointer', transition: 'all .15s', background: `linear-gradient(135deg,${G.meadow},${G.meadowDeep})`, color: '#fff', boxShadow: '0 3px 12px rgba(21,128,61,0.32)' }}
            onMouseEnter={e => { e.currentTarget.style.boxShadow = '0 5px 18px rgba(21,128,61,0.42)'; e.currentTarget.style.transform = 'translateY(-1px)' }}
            onMouseLeave={e => { e.currentTarget.style.boxShadow = '0 3px 12px rgba(21,128,61,0.32)'; e.currentTarget.style.transform = 'none' }}>
            <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"><line x1="12" y1="5" x2="12" y2="19"/><line x1="5" y1="12" x2="19" y2="12"/></svg>
            Add Course
          </button>
        </div>
      </div>

      {/* ── Stats Bar ── */}
      <div id="tour-stats-bar">
        <StatsBar loading={loading} filtered={filtered} isFiltered={hasFilter} />
      </div>

      {/* ── Search + Toolbar ── */}
      <div id="tour-search-toolbar" style={{ background: '#fff', borderRadius: 14, border: `1px solid ${G.border}`, padding: '10px 16px', marginBottom: 10, display: 'flex', alignItems: 'center', gap: 12, flexWrap: 'wrap', boxShadow: '0 2px 8px rgba(10,46,28,0.05)' }}>

        {/* Search */}
        <div style={{ position: 'relative', flex: '1 1 220px', minWidth: 180 }}>
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke={G.muted2} strokeWidth="2"
            style={{ position: 'absolute', left: 11, top: '50%', transform: 'translateY(-50%)', pointerEvents: 'none' }}>
            <circle cx="11" cy="11" r="8"/><line x1="21" y1="21" x2="16.65" y2="16.65"/>
          </svg>
          <input ref={searchRef} placeholder="Search course code or title…" value={search} onChange={e => setSearch(e.target.value)} className="cp-search"
            style={{ width: '100%', paddingLeft: 34, paddingRight: 10, height: 34, borderRadius: 8, border: `1.5px solid ${G.border}`, fontSize: 12.5, fontFamily: "'Inter',sans-serif", background: G.hover, outline: 'none', boxSizing: 'border-box', transition: 'all .15s', color: G.ink }}/>
          {!search && (
            <kbd style={{ position: 'absolute', right: 10, top: '50%', transform: 'translateY(-50%)', fontSize: 10.5, fontWeight: 700, color: G.muted2, background: '#fff', border: `1px solid ${G.border}`, borderRadius: 4, padding: '2px 5px', pointerEvents: 'none', fontFamily: "'Inter',sans-serif" }}>/</kbd>
          )}
        </div>

        <div style={{ width: 1, height: 20, background: G.border, flexShrink: 0 }}/>

        {/* Filters modal trigger */}
        <button onClick={() => setShowFilters(true)} style={{
          display: 'inline-flex', alignItems: 'center', gap: 6, padding: '5px 13px', borderRadius: 99, fontSize: 11.5,
          fontWeight: activeModalFilterCount ? 600 : 500,
          background: activeModalFilterCount ? G.meadow : G.hover,
          color: activeModalFilterCount ? '#fff' : G.muted,
          border: `1.5px solid ${activeModalFilterCount ? 'transparent' : G.border}`,
          cursor: 'pointer', transition: 'all .15s', whiteSpace: 'nowrap', fontFamily: "'Inter',sans-serif",
          boxShadow: activeModalFilterCount ? '0 2px 8px rgba(21,128,61,0.28)' : 'none',
        }}>
          <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
            <line x1="4" y1="6" x2="20" y2="6"/><line x1="8" y1="12" x2="16" y2="12"/><line x1="11" y1="18" x2="13" y2="18"/>
          </svg>
          Filters{activeModalFilterCount > 0 ? ` (${activeModalFilterCount})` : ''}
        </button>

        {filtered.length > 0 && (
          <>
            <div style={{ width: 1, height: 20, background: G.border, flexShrink: 0 }}/>
            <div onClick={togAll} style={{ display: 'flex', alignItems: 'center', gap: 7, cursor: 'pointer', fontSize: 12, color: G.muted, fontWeight: 500, userSelect: 'none', whiteSpace: 'nowrap' }}>
              <Checkbox checked={allSel} indeterminate={someSel}/>
              {allSel ? 'Deselect all' : 'Select all'}
            </div>
          </>
        )}

        {hasFilter && (
          <>
            <div style={{ width: 1, height: 20, background: G.border, flexShrink: 0 }}/>
            <button onClick={resetFilters} style={{ fontSize: 11.5, color: G.meadow, background: G.meadowSoft, border: 'none', padding: '4px 11px', borderRadius: 99, cursor: 'pointer', fontWeight: 600, fontFamily: "'Inter',sans-serif", whiteSpace: 'nowrap' }}>
              Clear all
            </button>
          </>
        )}
      </div>

      {/* Active Filter Chips */}
      {activeModalFilterCount > 0 && (
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6, marginBottom: 12, alignItems: 'center' }}>
          <span style={{ fontSize: 10.5, color: G.muted2, fontWeight: 600, marginRight: 2 }}>Active filters:</span>
          {[
            ...progFilter.map(p => ({ label: p, onRemove: () => togProg(p), color: G.meadow })),
            ...yearFilter.map(y => ({ label: `Year ${y}`, onRemove: () => togYear(y), color: G.meadow })),
            typeFilter ? { label: typeFilter === 'lab' ? 'Has Laboratory' : 'Lecture Only', onRemove: () => setTypeFilter(''), color: G.meadow } : null,
            issuesOnly ? { label: 'Needs attention', onRemove: () => setIssuesOnly(false), color: '#D97706' } : null,
          ].filter(Boolean).map((chip, i) => (
            <span key={i} style={{
              display: 'inline-flex', alignItems: 'center', gap: 5,
              padding: '3px 6px 3px 9px', borderRadius: 99, fontSize: 11, fontWeight: 600,
              background: chip.color === G.meadow ? G.meadowSoft : chip.color + '18', 
              color: chip.color, 
              border: `1px solid ${chip.color === G.meadow ? G.meadowBorder : chip.color + '33'}`,
            }}>
              {chip.label}
              <button onClick={chip.onRemove} style={{
                display: 'flex', alignItems: 'center', justifyContent: 'center',
                width: 14, height: 14, borderRadius: '50%',
                background: 'transparent', border: 'none', cursor: 'pointer',
                padding: 0, color: chip.color,
              }}>
                <svg width="8" height="8" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3">
                  <line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/>
                </svg>
              </button>
            </span>
          ))}
        </div>
      )}

      {/* Bulk Action Bar */}
      {selCount > 0 && (
        <div style={{ background: `linear-gradient(135deg,${G.meadowDeep},${G.inkMid})`, borderRadius: 12, padding: '10px 18px', marginBottom: 16, display: 'flex', alignItems: 'center', gap: 12, boxShadow: '0 6px 20px rgba(10,46,28,0.28)', animation: 'slideIn 0.18s ease' }}>
          <div style={{ width: 28, height: 28, borderRadius: 8, background: 'rgba(255,255,255,0.14)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
            <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="2.5"><polyline points="20 6 9 17 4 12"/></svg>
          </div>
          <span style={{ fontSize: 13, fontWeight: 600, color: '#fff', flex: 1 }}>{selCount} course{selCount !== 1 ? 's' : ''} selected</span>
          <button onClick={() => setSelected(new Set())} style={{ background: 'rgba(255,255,255,0.1)', border: '1px solid rgba(255,255,255,0.2)', color: 'rgba(255,255,255,0.85)', fontSize: 12, padding: '5px 14px', borderRadius: 8, cursor: 'pointer', fontFamily: "'Inter',sans-serif" }}>Deselect all</button>
          <button onClick={handleBulkDelete} disabled={deleting} style={{ background: '#C0392B', border: 'none', color: '#fff', fontSize: 12, fontWeight: 600, padding: '5px 15px', borderRadius: 8, display: 'flex', alignItems: 'center', gap: 5, cursor: 'pointer', fontFamily: "'Inter',sans-serif", opacity: deleting ? 0.7 : 1 }}>
            <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"><polyline points="3 6 5 6 21 6"/><path d="M19 6l-1 14a2 2 0 0 1-2 2H8a2 2 0 0 1-2-2L5 6"/><path d="M10 11v6M14 11v6"/></svg>
            Delete {selCount}
          </button>
        </div>
      )}

      {/* ── Content (List view only) ── */}
      {loading ? (
        <div style={{ background: '#fff', borderRadius: 12, border: `1.5px solid ${G.border}`, overflow: 'hidden' }}>
          {Array.from({ length: 8 }).map((_, i) => (
            <div key={i} style={{ display: 'flex', alignItems: 'center', gap: 16, padding: '16px 20px', borderBottom: i < 7 ? `1px solid ${G.borderLight}` : 'none' }}>
              <Skel w={20} h={20} r={4} />
              <Skel w={80} h={16} r={4} />
              <Skel w="30%" h={16} r={4} />
              <Skel w={64} h={16} r={4} />
              <Skel w={48} h={16} r={4} />
              <Skel w={48} h={16} r={4} style={{ marginLeft: 'auto' }} />
            </div>
          ))}
        </div>
      ) : filtered.length === 0 ? (
        <div style={{ textAlign: 'center', padding: '60px 20px', color: G.muted2, animation: 'fadeIn 0.3s' }}>
          <div style={{ width: 56, height: 56, borderRadius: '50%', background: G.hover, display: 'flex', alignItems: 'center', justifyContent: 'center', margin: '0 auto 14px' }}>
            <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke={G.border} strokeWidth="1.5">
              <path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2"/><circle cx="9" cy="7" r="4"/>
            </svg>
          </div>
          <div style={{ fontSize: 14, fontWeight: 600, color: G.muted, marginBottom: 4 }}>
            {courses.length === 0 ? 'No courses available' : 'No matches found'}
          </div>
          <div style={{ fontSize: 12.5, color: G.muted2, marginBottom: hasFilter ? 14 : 0 }}>
            {courses.length === 0 ? 'Add your first course or upload from Excel to get started.' : 'Try adjusting your search or clearing your filters.'}
          </div>
          {hasFilter && (
            <button onClick={resetFilters} style={{ padding: '8px 18px', borderRadius: 9, border: 'none', background: G.meadow, color: '#fff', fontSize: 12.5, fontWeight: 600, cursor: 'pointer', fontFamily: "'Inter',sans-serif" }}>
              Clear all filters
            </button>
          )}
        </div>
      ) : (
        <div id="tour-courses-table-anchor" style={{ background: '#fff', borderRadius: 12, border: `1.5px solid ${G.border}`, overflow: 'hidden', boxShadow: '0 2px 8px rgba(10,46,28,0.06)' }}>
          <table id="tour-courses-table" style={{ width: '100%', borderCollapse: 'collapse', fontSize: 12.5 }}>
            <thead>
              <tr style={{ background: G.hover, borderBottom: `1.5px solid ${G.border}` }}>
                <th style={{ width: 40, padding: '10px 14px', textAlign: 'center' }}><div onClick={togAll} style={{ cursor: 'pointer', display: 'inline-flex' }}><Checkbox checked={allSel} indeterminate={someSel}/></div></th>
                <SortTh label="Code"             field="code"     sortBy={sortBy} sortDir={sortDir} onSort={handleSort} />
                <SortTh label="Course Title"     field="title"    sortBy={sortBy} sortDir={sortDir} onSort={handleSort} />
                <SortTh label="Program"          field="program"  sortBy={sortBy} sortDir={sortDir} onSort={handleSort} />
                <SortTh label="Year"             field="year"     sortBy={sortBy} sortDir={sortDir} onSort={handleSort} center />
                <SortTh label="Sections"         field="sections" sortBy={sortBy} sortDir={sortDir} onSort={handleSort} center />
                <SortTh
                  label={(
                    <span style={{ display: 'inline-flex', alignItems: 'center', gap: 6 }}>
                      Units
                      <span style={{ display: 'inline-flex', alignItems: 'center', gap: 4, fontSize: 10, fontWeight: 700, textTransform: 'none', letterSpacing: 0, color: G.muted2 }}>
                        <span style={{ width: 6, height: 6, borderRadius: '2px', background: G.meadow, display: 'inline-block' }} />Lec
                        <span style={{ width: 6, height: 6, borderRadius: '2px', background: '#0369A1', display: 'inline-block', marginLeft: 4 }} />Lab
                      </span>
                    </span>
                  )}
                  field="units" sortBy={sortBy} sortDir={sortDir} onSort={handleSort} center
                />
                <th style={{ padding: '10px 14px', textAlign: 'right', fontWeight: 700, color: G.muted2, fontSize: 10.5, textTransform: 'uppercase', letterSpacing: '.7px', whiteSpace: 'nowrap' }}>Actions</th>
              </tr>
            </thead>
            <tbody>
              {filtered.map((c, i) => {
                const isSel = selected.has(c.id)
                const pc = progColor(c.program)
                const issue = courseIssue(c)
                return (
                  <tr key={c.id} className="cp-tr-hover" onClick={() => { if(selectionMode) togOne(c.id); else { setEditTarget(c); setError('') } }}
                    style={{ borderBottom: i < filtered.length - 1 ? `1px solid ${G.borderLight}` : 'none', background: isSel ? G.meadowSoft : 'transparent', cursor: 'pointer', transition: 'background .1s' }}>
                    <td style={{ padding: '10px 14px', textAlign: 'center' }} onClick={e => { e.stopPropagation(); togOne(c.id) }}><Checkbox checked={isSel}/></td>
                    <td style={{ padding: '10px 14px' }}>
                      <span style={{ display: 'inline-block', padding: '3px 8px', background: G.hover, color: G.ink, borderRadius: 6, fontSize: 12, fontWeight: 700, border: `1.5px solid ${G.border}` }}>{c.courseCode}</span>
                    </td>
                    <td style={{ padding: '10px 14px', fontWeight: 600, color: G.ink, fontSize: 13 }}>
                      <span className="cp-row-flag">
                        {c.title}
                        {issue && (
                          <span title={issue} style={{ color: '#D97706', display: 'inline-flex', flexShrink: 0 }}><WarnIcon size={14} /></span>
                        )}
                      </span>
                    </td>
                    <td style={{ padding: '10px 14px' }}><span style={{ display: 'inline-block', padding: '3px 8px', borderRadius: 6, fontSize: 12, fontWeight: 700, background: pc.bg, color: pc.color }}>{c.program}</span></td>
                    <td style={{ padding: '10px 14px', textAlign: 'center', color: G.muted2, fontSize: 12 }}>{YEAR_SHORT[c.yearLevel]} Year</td>
                    <td style={{ padding: '10px 14px', textAlign: 'center', color: G.ink, fontWeight: 500, fontSize: 12 }}>{c.blocks}</td>
                    <td style={{ padding: '10px 14px', textAlign: 'center' }}>
                      <div style={{ display: 'inline-flex', alignItems: 'center', gap: 6 }}>
                        <span style={{ fontWeight: 700, color: G.ink, fontSize: 13 }}>{(c.unitsLecture||0)+(c.unitsLab||0)}</span>
                        <span style={{ display: 'inline-flex', minWidth: 22, justifyContent: 'center', padding: '2px 5px', borderRadius: 4, fontSize: 10.5, fontWeight: 700, background: G.meadowSoft, color: G.meadowDeep }} title="Lecture units">{c.unitsLecture}</span>
                        <span style={{ display: 'inline-flex', minWidth: 22, justifyContent: 'center', padding: '2px 5px', borderRadius: 4, fontSize: 10.5, fontWeight: 700, background: '#E0F2FE', color: '#0369A1' }} title="Lab units">{c.unitsLab}</span>
                      </div>
                    </td>
                    <td style={{ padding: '10px 14px', textAlign: 'right' }} onClick={e => e.stopPropagation()}>
                      <div style={{ display: 'flex', gap: 4, justifyContent: 'flex-end' }}>
                        <button title="Edit course" onClick={() => { setEditTarget(c); setError('') }}
                          style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', width: 26, height: 26, borderRadius: 7, background: G.meadowSoft, border: `1px solid ${G.meadowBorder}`, color: G.meadow, cursor: 'pointer', padding: 0, transition: 'all .14s' }}
                          onMouseEnter={e => { e.currentTarget.style.background = G.meadow; e.currentTarget.style.color = '#fff' }}
                          onMouseLeave={e => { e.currentTarget.style.background = G.meadowSoft; e.currentTarget.style.color = G.meadow }}>
                          <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2"><path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"/><path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"/></svg>
                        </button>
                        <button title="Delete course" onClick={() => handleDelete(c.courseCode, c.program)}
                          style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', width: 26, height: 26, borderRadius: 7, background: '#FFE8E8', border: '1px solid #FFCCCC', color: '#C0392B', cursor: 'pointer', padding: 0, transition: 'all .14s' }}
                          onMouseEnter={e => { e.currentTarget.style.background = '#C0392B'; e.currentTarget.style.color = '#fff' }}
                          onMouseLeave={e => { e.currentTarget.style.background = '#FFE8E8'; e.currentTarget.style.color = '#C0392B' }}>
                          <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2"><polyline points="3 6 5 6 21 6"/><path d="M19 6l-1 14a2 2 0 0 1-2 2H8a2 2 0 0 1-2-2L5 6"/><path d="M10 11v6M14 11v6"/></svg>
                        </button>
                      </div>
                    </td>
                  </tr>
                )
              })}
            </tbody>
          </table>
        </div>
      )}

      {/* ── Modals ── */}
      {showFilters && (
        <div style={{ position: 'fixed', inset: 0, zIndex: 1000, background: 'rgba(14,42,32,0.45)', backdropFilter: 'blur(4px)', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 24 }} onClick={() => setShowFilters(false)}>
          <div style={{ background: '#fff', borderRadius: 20, width: '100%', maxWidth: 500, display: 'flex', flexDirection: 'column', boxShadow: '0 24px 64px rgba(14,42,32,0.24)', overflow: 'hidden' }} onClick={e => e.stopPropagation()}>
            <div style={{ padding: '20px 24px', borderBottom: `1px solid ${G.border}`, display: 'flex', alignItems: 'center', justifyContent: 'space-between', background: '#fff' }}>
              <div><div style={{ fontSize: 16, fontWeight: 700, color: G.ink, fontFamily: "'Inter',sans-serif" }}>Filter Courses</div></div>
              <button onClick={() => setShowFilters(false)} style={{ width: 32, height: 32, borderRadius: 8, border: `1px solid ${G.border}`, background: '#fff', display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer', padding: 0, transition: 'all .15s' }}
                onMouseEnter={e => { e.currentTarget.style.background = '#FFE8E8'; e.currentTarget.style.borderColor = '#FECACA'; e.currentTarget.style.color = '#DC2626' }}
                onMouseLeave={e => { e.currentTarget.style.background = '#fff'; e.currentTarget.style.borderColor = G.border; e.currentTarget.style.color = G.muted }}>
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg>
              </button>
            </div>
            <div style={{ padding: '24px', display: 'flex', flexDirection: 'column', gap: 24 }}>
              <div>
                <SectionLabel label="Program" count={progFilter.length} onClear={() => setProgFilter([])} />
                <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6 }}>
                  {programs.map(p => <FilterPill key={p} label={p} active={progFilter.includes(p)} onClick={() => togProg(p)} />)}
                </div>
              </div>
              <div>
                <SectionLabel label="Year Level" count={yearFilter.length} onClear={() => setYearFilter([])} />
                <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6 }}>
                  {YEAR_OPTS.map(y => <FilterPill key={y} label={`${YEAR_SHORT[y]} Year`} active={yearFilter.includes(y)} onClick={() => togYear(y)} />)}
                </div>
              </div>
              <div>
                <SectionLabel label="Course Type" count={typeFilter ? 1 : 0} onClear={() => setTypeFilter('')} />
                <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6 }}>
                  <FilterPill label="Any" active={typeFilter === ''} onClick={() => setTypeFilter('')} />
                  <FilterPill label="Lecture Only" active={typeFilter === 'lec'} onClick={() => setTypeFilter('lec')} icon={<svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"><path d="M2 3h6a4 4 0 0 1 4 4v14a3 3 0 0 0-3-3H2z"/><path d="M22 3h-6a4 4 0 0 0-4 4v14a3 3 0 0 1 3-3h7z"/></svg>} />
                  <FilterPill label="Has Laboratory" active={typeFilter === 'lab'} onClick={() => setTypeFilter('lab')} icon={<svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"><path d="M9 2v2"/><path d="M15 2v2"/><path d="M9 22v-4h6v4"/><path d="M16 6h-8"/><path d="M8 6h.01"/><path d="M16 10h.01"/><path d="M8 10h.01"/></svg>} />
                </div>
              </div>
              <div>
                <SectionLabel label="Data Quality" count={issuesOnly ? 1 : 0} onClear={() => setIssuesOnly(false)} />
                <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6 }}>
                  <FilterPill
                    label="Needs attention only"
                    active={issuesOnly}
                    onClick={() => setIssuesOnly(v => !v)}
                    icon={<WarnIcon size={12} />}
                  />
                </div>
              </div>
            </div>
            <div style={{ padding: '16px 24px', borderTop: `1px solid ${G.border}`, display: 'flex', justifyContent: 'space-between', background: '#FAFAFE' }}>
              <span style={{ fontSize: 12.5, color: G.muted2, fontWeight: 500, alignSelf: 'center' }}>{filtered.length} matches</span>
              <div style={{ display: 'flex', gap: 10 }}>
                <button onClick={resetFilters} style={{ padding: '8px 18px', borderRadius: 10, border: `1.5px solid ${G.border}`, background: '#fff', color: G.muted, fontSize: 12.5, fontWeight: 600, cursor: 'pointer', fontFamily: "'Inter',sans-serif", transition: 'all .15s' }}
                  onMouseEnter={e => { e.currentTarget.style.background = '#FFF5F5'; e.currentTarget.style.borderColor = '#FECACA'; e.currentTarget.style.color = '#DC2626' }}
                  onMouseLeave={e => { e.currentTarget.style.background = '#fff'; e.currentTarget.style.borderColor = G.border; e.currentTarget.style.color = G.muted }}>
                  Reset
                </button>
                <button onClick={() => setShowFilters(false)} style={{ padding: '8px 22px', borderRadius: 10, border: 'none', background: `linear-gradient(135deg,${G.meadow},${G.meadowDeep})`, color: '#fff', fontSize: 12.5, fontWeight: 600, cursor: 'pointer', fontFamily: "'Inter',sans-serif", boxShadow: '0 4px 14px rgba(21,128,61,0.3)', transition: 'all .15s' }}
                  onMouseEnter={e => { e.currentTarget.style.transform = 'translateY(-1px)'; e.currentTarget.style.boxShadow = '0 6px 20px rgba(21,128,61,0.4)' }}
                  onMouseLeave={e => { e.currentTarget.style.transform = 'none'; e.currentTarget.style.boxShadow = '0 4px 14px rgba(21,128,61,0.3)' }}>
                  Apply
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {showAdd && <CourseModal mode="add" initial={{...EMPTY, semester: semesterTab}} onSave={handleAdd} onClose={()=>{setShowAdd(false);setError('')}} saving={saving} error={error} />}
      {editTarget && <CourseModal mode="edit" initial={{...editTarget,yearLevel:String(editTarget.yearLevel), semester:editTarget.semester||'1st Semester'}} onSave={handleEdit} onClose={()=>{setEditTarget(null);setError('')}} saving={saving} error={error} />}
      {dupTarget && <CourseModal mode="duplicate" initial={dupTarget} onSave={handleAdd} onClose={()=>{setDupTarget(null);setError('')}} saving={saving} error={error} />}

      {showImport && (
        <ImportCoursesModal
          onClose={()=>setShowImport(false)}
          onImported={()=>{ load(); setShowImport(false); toast('Courses imported successfully', 'success') }}
        />
      )}

      {showBlockCfg && (
        <BlockConfigModal semester={semesterTab} onClose={() => setShowBlockCfg(false)} onApplied={() => load()} />
      )}

      {pendingDelete && (
        <DeleteConfirmModal name={pendingDelete.name} count={pendingDelete.bulk ? pendingDelete.count : 1} deleting={deleting} onConfirm={handleConfirmDelete} onCancel={() => { if (!deleting) setPendingDelete(null) }} />
      )}

      <ToastContainer toasts={toasts} />
    </div>
  )
}