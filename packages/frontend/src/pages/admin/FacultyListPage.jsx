import { useEffect, useState, useMemo, useCallback } from 'react'
import { useNavigate } from 'react-router-dom'
import ImportFacultyModal from '../../components/ImportFacultyModal'
import { generateExportWorkbook, downloadWorkbook } from '../../components/facultyExcelTemplate'
import { getFaculty, getArchivedFaculty, deleteFaculty, archiveFaculty, unarchiveFaculty, getCourses } from '../../services/api'

/* ── Design tokens ── */
const G = {
  meadow: 'var(--meadow, var(--meadow))',
  meadowDeep:   'var(--meadow-deep)',
  meadowMid:    'var(--meadow-mid)',
  meadowSoft:   'var(--meadow-soft)',
  meadowBorder: 'var(--meadow-border)',
  ink: 'var(--ink, #0E2A20)',
  inkMid:       '#1C3D2A',
  muted: 'var(--muted, #4B7060)',
  muted2: 'var(--muted2, #6B8C7A)',
  border:       'var(--border)',
  borderLight:  'var(--hover)',
  bg: 'var(--bg, #F2F7F4)',
  surface: 'var(--surface, #FFFFFF)',
  hover:        'var(--hover)',
}

/* ── Skeleton ── */
function Skel({ w = '100%', h = 14, r = 7, style = {} }) {
  return <div className="fac-skeleton" style={{ width: w, height: h, borderRadius: r, flexShrink: 0, ...style }} />
}

/* ── Toast ── */
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
    <div className="fac-toast-wrap">
      {toasts.map(t => <div key={t.id} className={`fac-toast ${t.type}`}>{icons[t.type]}{t.message}</div>)}
    </div>
  )
}

/* ── Checkbox ── */
function Checkbox({ checked, indeterminate }) {
  const active = checked || indeterminate
  return (
    <span style={{
      width: 16, height: 16, borderRadius: 4, flexShrink: 0,
      border: `1.5px solid ${active ? G.meadow : G.border}`,
      background: active ? G.meadow : 'transparent',
      display: 'inline-flex', alignItems: 'center', justifyContent: 'center',
      transition: 'all 0.15s',
      boxShadow: active ? '0 2px 6px rgba(0,0,0,0.3)' : 'none',
      pointerEvents: 'none',
    }}>
      {indeterminate && !checked && (
        <svg width="8" height="2" viewBox="0 0 8 2" fill="none"><rect width="8" height="2" rx="1" fill="#fff"/></svg>
      )}
      {checked && (
        <svg width="9" height="7" viewBox="0 0 9 7" fill="none">
          <polyline points="1,3.5 3.5,6 8,1" stroke="#fff" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round"/>
        </svg>
      )}
    </span>
  )
}

/* ── Toggle pill ── */
function TogglePill({ label, active, onClick }) {
  return (
    <button onClick={onClick} style={{
      padding: '4px 12px', borderRadius: 99, fontSize: 11.5, fontWeight: active ? 600 : 500,
      background: active ? G.meadow : G.hover,
      color: active ? '#fff' : G.muted,
      border: `1.5px solid ${active ? 'transparent' : G.border}`,
      cursor: 'pointer', transition: 'all 0.15s',
      boxShadow: active ? '0 2px 8px rgba(0,0,0,0.28)' : 'none',
      whiteSpace: 'nowrap', fontFamily: "'Inter',sans-serif",
    }}>{label}</button>
  )
}

/* ── Spec helpers ── */
function normalizeSpec(s) {
  if (!s) return null
  if (typeof s === 'object') return { code: s.courseCode, title: s.courseTitle || s.title, rating: s.rating }
  return { code: s, title: undefined, rating: undefined }
}
function facultySpecs(faculty, courseTitleMap = {}) {
  return (faculty.specializations || [])
    .filter(s => {
      if (typeof s !== 'object') return true;
      if (!s.isUnmatched) return true;
      const code = (s.courseCode || '').toUpperCase().replace(/\s+/g, '');
      return !!courseTitleMap[code];
    })
    .map(normalizeSpec)
    .filter(s => s && (s.title || s.code))
}
function specKey(s) { return (s.title || s.code || '').toLowerCase().trim() }


function ActiveFilterChips({
  statusFilter, rankFilter, departmentFilter, educationFilter,
  coordinatorFilter, specializationFilter, specMinRating,
  onRemoveStatus, onRemoveRank, onRemoveDept, onRemoveEducation,
  onClearCoordinator, onRemoveSpec, onClearRating,
}) {
  const chips = [
    ...statusFilter.map(v => ({ label: v === 'full-time' ? 'Full-time' : 'Part-time', onRemove: () => onRemoveStatus(v), color: 'var(--meadow-text-hover)' })),
    ...rankFilter.map(v => ({ label: v, onRemove: () => onRemoveRank(v), color: 'var(--meadow-text-hover)' })),
    ...departmentFilter.map(v => ({ label: v, onRemove: () => onRemoveDept(v), color: 'var(--meadow-text-hover)' })),
    ...educationFilter.map(v => ({ label: v, onRemove: () => onRemoveEducation(v), color: 'var(--meadow-text-hover)' })),
    coordinatorFilter ? { label: coordinatorFilter === 'any' ? 'Coordinators only' : 'Non-coordinators', onRemove: onClearCoordinator, color: 'var(--meadow-text-hover)' } : null,
    ...specializationFilter.map(v => ({ label: v, onRemove: () => onRemoveSpec(v), color: 'var(--meadow-text-hover)' })),
    specMinRating > 0 ? { label: `★${specMinRating}+ rating`, onRemove: onClearRating, color: '#F59E0B' } : null,
  ].filter(Boolean)

  if (!chips.length) return null

  return (
    <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6, marginBottom: 12, alignItems: 'center' }}>
      <span style={{ fontSize: 10.5, color: G.muted2, fontWeight: 600, marginRight: 2 }}>Active filters:</span>
      {chips.map((chip, i) => (
        <span key={i} style={{
          display: 'inline-flex', alignItems: 'center', gap: 5,
          padding: '3px 6px 3px 9px', borderRadius: 99, fontSize: 11, fontWeight: 600,
          background: chip.color === 'var(--meadow-text-hover)' ? G.meadowSoft : chip.color + '18', 
          color: chip.color, 
          border: `1px solid ${chip.color === 'var(--meadow-text-hover)' ? G.meadowBorder : chip.color + '33'}`,
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
  )
}

/* ── Confirm modal ── */
function ActionModal({ mode, name, count, onConfirm, onCancel, busy }) {
  const isBulk = count > 1
  const cfg = {
    archive: {
      iconBg: 'rgba(217, 119, 6, 0.1)', iconStroke: '#F59E0B',
      iconPath: <><path d="M21 8v13H3V8"/><path d="M23 3H1v5h22z"/><line x1="10" y1="12" x2="14" y2="12"/></>,
      title: isBulk ? `Archive ${count} Faculty Members?` : 'Archive Faculty Member?',
      body: isBulk ? `These ${count} members will be hidden from active scheduling but can be restored at any time.`
                   : `${name} will be hidden from active scheduling. You can restore them at any time.`,
      btnBg: 'linear-gradient(135deg,#D97706,#B45309)', btnLabel: busy ? 'Archiving…' : isBulk ? `Archive ${count}` : 'Archive',
    },
    unarchive: {
      iconBg: '#E6FAF3', iconStroke: 'var(--meadow)',
      iconPath: <><polyline points="1 4 1 10 7 10"/><path d="M3.51 15a9 9 0 1 0 .49-3.5"/></>,
      title: isBulk ? `Restore ${count} Faculty Members?` : 'Restore Faculty Member?',
      body: isBulk ? `These ${count} members will be moved back to the active roster.`
                   : `${name} will be moved back to the active roster and included in scheduling.`,
      btnBg: `linear-gradient(135deg,${G.meadow},${G.meadowDeep})`, btnLabel: busy ? 'Restoring…' : isBulk ? `Restore ${count}` : 'Restore',
    },
    delete: {
      iconBg: 'rgba(220, 38, 38, 0.1)', iconStroke: '#EF4444',
      iconPath: <><polyline points="3 6 5 6 21 6"/><path d="M19 6l-1 14a2 2 0 0 1-2 2H8a2 2 0 0 1-2-2L5 6"/><path d="M10 11v6M14 11v6M9 6V4h6v2"/></>,
      title: isBulk ? `Permanently Delete ${count} Faculty Members?` : 'Permanently Delete?',
      body: isBulk ? `This cannot be undone. All ${count} members and their login accounts will be removed forever.`
                   : `This cannot be undone. ${name} and their login account will be removed forever.`,
      btnBg: '#EF4444', btnLabel: busy ? 'Deleting…' : isBulk ? `Delete ${count}` : 'Yes, Delete',
    },
  }
  const c = cfg[mode] || cfg.delete
  return (
    <div style={{ position: 'fixed', inset: 0, zIndex: 1100, background: 'rgba(10,30,18,0.55)', backdropFilter: 'blur(4px)', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 24 }}>
      <div style={{ background: 'var(--surface)', borderRadius: 18, padding: '28px 28px 24px', maxWidth: 400, width: '100%', boxShadow: '0 20px 60px rgba(10,30,18,0.22)', textAlign: 'center' }}>
        <div style={{ width: 52, height: 52, borderRadius: '50%', background: c.iconBg, margin: '0 auto 16px', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
          <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke={c.iconStroke} strokeWidth="2">{c.iconPath}</svg>
        </div>
        <div style={{ fontSize: 16, fontWeight: 700, color: G.ink, marginBottom: 8 }}>{c.title}</div>
        <div style={{ fontSize: 13, color: G.muted2, marginBottom: 24, lineHeight: 1.5 }}>{c.body}</div>
        <div style={{ display: 'flex', gap: 10 }}>
          <button onClick={onCancel} disabled={busy} style={{ flex: 1, padding: '10px', borderRadius: 9, border: `1.5px solid ${G.border}`, background: 'var(--surface)', fontSize: 13, fontWeight: 600, color: G.muted, cursor: busy ? 'default' : 'pointer', fontFamily: 'Inter,sans-serif' }}>Cancel</button>
          <button onClick={onConfirm} disabled={busy} style={{ flex: 1, padding: '10px', borderRadius: 9, border: 'none', background: c.btnBg, fontSize: 13, fontWeight: 700, color: '#fff', cursor: busy ? 'default' : 'pointer', fontFamily: 'Inter,sans-serif', opacity: busy ? 0.7 : 1 }}>{c.btnLabel}</button>
        </div>
      </div>
    </div>
  )
}

/* ── Faculty Card (enhanced) ── */
function FacultyCard({ faculty, courseTitleMap, selected, onSelect, onClick, onArchive, onUnarchive, onDelete, selectionMode, viewTab }) {
  const [hovered, setHovered] = useState(false)
  const isArchived = !!faculty.archived
  const isFullTime = faculty.status === 'full-time'
  const specs      = useMemo(() => facultySpecs(faculty, courseTitleMap), [faculty, courseTitleMap])
  const specCount  = specs.length
  const isCoord    = !!faculty.coordinatorProgram

  const headerBg = isArchived
    ? 'linear-gradient(135deg, #7A9488, #5A7268)'
    : `linear-gradient(135deg, ${G.meadow}, ${G.meadowDeep})`
  const statusLabel = isArchived ? 'Archived' : isFullTime ? 'Full-time' : 'Part-time'

  return (
    <div
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => setHovered(false)}
      onClick={onClick}
      style={{
        background: 'var(--surface)', borderRadius: 12,
        border: `1.5px solid ${selected ? G.meadow : hovered ? G.meadowBorder : G.border}`,
        cursor: 'pointer', overflow: 'hidden',
        opacity: isArchived ? 0.85 : 1,
        display: 'flex', flexDirection: 'column',
        boxShadow: selected
          ? `0 0 0 3px rgba(0,0,0,0.14), 0 2px 8px rgba(0,0,0,0.08)`
          : hovered ? `0 4px 16px rgba(0,0,0,0.10)` : `0 1px 4px rgba(0,0,0,0.05)`,
        transform: hovered && !selected ? 'translateY(-2px)' : 'none',
        transition: 'all 0.15s ease',
        position: 'relative',
      }}
    >
      {/* ── Green header ── */}
      <div style={{ background: headerBg, padding: '14px 14px 12px', position: 'relative', overflow: 'hidden', flex: 1 }}>
        <div style={{ position: 'absolute', top: -20, right: -20, width: 70, height: 70, borderRadius: '50%', background: 'rgba(255,255,255,0.06)', pointerEvents: 'none' }}/>
        <div style={{ position: 'absolute', bottom: -12, left: -8, width: 48, height: 48, borderRadius: '50%', background: 'rgba(255,255,255,0.04)', pointerEvents: 'none' }}/>

        {/* Coordinator badge */}
        {isCoord && (
          <div style={{
            display: 'inline-flex', alignItems: 'center', gap: 3, marginBottom: 6,
            padding: '2px 7px', borderRadius: 99,
            background: 'rgba(255,215,0,0.22)', fontSize: 9, fontWeight: 700,
            color: '#FFD700', textTransform: 'uppercase', letterSpacing: '.5px',
            position: 'relative', zIndex: 1,
          }}>
            <svg width="8" height="8" viewBox="0 0 24 24" fill="#FFD700" stroke="#FFD700" strokeWidth="1">
              <polygon points="12 2 15.09 8.26 22 9.27 17 14.14 18.18 21.02 12 17.77 5.82 21.02 7 14.14 2 9.27 8.91 8.26 12 2"/>
            </svg>
            Coord · {faculty.coordinatorProgram}
          </div>
        )}

        {/* Name */}
        <div style={{ fontSize: 13.5, fontWeight: 700, color: '#fff', lineHeight: 1.3, paddingRight: 28, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', position: 'relative', zIndex: 1 }}>
          {faculty.name}
        </div>

        {/* Rank */}
        {faculty.AcademicRank && (
          <div style={{ fontSize: 11, color: 'rgba(255,255,255,0.75)', fontWeight: 500, marginTop: 3, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', position: 'relative', zIndex: 1 }}>
            {faculty.AcademicRank}
          </div>
        )}

        {/* Department */}
        {faculty.Department && (
          <div style={{ fontSize: 10, color: 'rgba(255,255,255,0.55)', fontWeight: 400, marginTop: 1, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', position: 'relative', zIndex: 1 }}>
            {faculty.Department}
          </div>
        )}

        {/* Status pill */}
        <div style={{ marginTop: 10, position: 'relative', zIndex: 1 }}>
          <span style={{
            display: 'inline-flex', alignItems: 'center', gap: 4,
            padding: '3px 9px', borderRadius: 99, fontSize: 9.5, fontWeight: 700,
            background: 'rgba(255,255,255,0.18)', color: '#fff',
            textTransform: 'uppercase', letterSpacing: '0.7px',
          }}>
            <span style={{ width: 5, height: 5, borderRadius: '50%', background: 'rgba(255,255,255,0.85)', flexShrink: 0 }}/>
            {statusLabel}
            {isArchived && faculty.status && <> · <span style={{ textTransform: 'uppercase', opacity: .7 }}>{faculty.status}</span></>}
          </span>
        </div>

        {/* Checkbox */}
        <div onClick={e => { e.stopPropagation(); onSelect() }}
          style={{ position: 'absolute', top: 12, right: 12, opacity: selected ? 1 : hovered || selectionMode ? 0.9 : 0.22, transition: 'opacity 0.15s', zIndex: 2 }}>
          <Checkbox checked={selected}/>
        </div>
      </div>

      {/* ── White bottom ── */}
      <div style={{ padding: '9px 14px 0', flexShrink: 0 }}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 6 }}>
          {specCount > 0 ? (
            <span style={{ fontSize: 11, fontWeight: 600, color: G.muted2, display: 'flex', alignItems: 'center', gap: 4 }}>
              <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M4 19.5A2.5 2.5 0 0 1 6.5 17H20"/><path d="M6.5 2H20v20H6.5A2.5 2.5 0 0 1 4 19.5v-15A2.5 2.5 0 0 1 6.5 2z"/></svg>
              {specCount} {specCount === 1 ? 'course' : 'courses'}
            </span>
          ) : (
            <span style={{ fontSize: 10.5, color: G.border, fontStyle: 'italic' }}>No specializations</span>
          )}
        </div>
      </div>
      <div style={{ height: 8 }}/>

      {/* ── Hover action bar ── */}
      {hovered && !selectionMode && (
        <div style={{
          position: 'absolute', bottom: 0, left: 0, right: 0,
          background: 'var(--surface)',
          borderTop: `1px solid ${G.borderLight}`, height: 36,
          display: 'flex', alignItems: 'center', justifyContent: 'space-between',
          padding: '0 14px', animation: 'fadeIn 0.13s ease',
        }}>
          <span style={{ fontSize: 10.5, color: 'var(--meadow-text-hover)', fontWeight: 600 }}>View &amp; edit</span>
          <div style={{ display: 'flex', gap: 4 }}>
            {viewTab === 'active' && (
              <button onClick={e => { e.stopPropagation(); onArchive() }} title="Archive"
                style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', width: 26, height: 26, borderRadius: 7, background: 'rgba(217, 119, 6, 0.1)', border: '1px solid #FDE68A', color: '#F59E0B', cursor: 'pointer', padding: 0, transition: 'all .14s' }}
                onMouseEnter={e => { e.currentTarget.style.background = '#F59E0B'; e.currentTarget.style.color = '#fff' }}
                onMouseLeave={e => { e.currentTarget.style.background = 'rgba(217, 119, 6, 0.1)'; e.currentTarget.style.color = '#F59E0B' }}>
                <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2"><path d="M21 8v13H3V8"/><path d="M23 3H1v5h22z"/><line x1="10" y1="12" x2="14" y2="12"/></svg>
              </button>
            )}
            {viewTab === 'archived' && (
              <>
                <button onClick={e => { e.stopPropagation(); onUnarchive() }} title="Restore"
                  style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', width: 26, height: 26, borderRadius: 7, background: G.meadowSoft, border: `1px solid ${G.meadowBorder}`, color: 'var(--meadow-text-hover)', cursor: 'pointer', padding: 0, transition: 'all .14s' }}
                  onMouseEnter={e => { e.currentTarget.style.background = G.meadow; e.currentTarget.style.color = '#fff' }}
                  onMouseLeave={e => { e.currentTarget.style.background = G.meadowSoft; e.currentTarget.style.color = 'var(--meadow-text-hover)' }}>
                  <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2"><polyline points="1 4 1 10 7 10"/><path d="M3.51 15a9 9 0 1 0 .49-3.5"/></svg>
                </button>
                <button onClick={e => { e.stopPropagation(); onDelete() }} title="Delete permanently"
                  style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', width: 26, height: 26, borderRadius: 7, background: 'rgba(220, 38, 38, 0.1)', border: '1px solid #FFCCCC', color: '#EF4444', cursor: 'pointer', padding: 0, transition: 'all .14s' }}
                  onMouseEnter={e => { e.currentTarget.style.background = '#EF4444'; e.currentTarget.style.color = '#fff' }}
                  onMouseLeave={e => { e.currentTarget.style.background = 'rgba(220, 38, 38, 0.1)'; e.currentTarget.style.color = '#EF4444' }}>
                  <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2"><polyline points="3 6 5 6 21 6"/><path d="M19 6l-1 14a2 2 0 0 1-2 2H8a2 2 0 0 1-2-2L5 6"/><path d="M10 11v6M14 11v6"/></svg>
                </button>
              </>
            )}
          </div>
        </div>
      )}
    </div>
  )
}

/* ── Faculty Table (list view) ── */
function FacultyTable({ faculty, selected, selectionMode, viewTab, onSelect, onSelectAll, allSelected, someSelected, onArchive, onUnarchive, onDelete, navigate }) {
  return (
    <div style={{ background: 'var(--surface)', borderRadius: 12, border: `1.5px solid ${G.border}`, overflow: 'hidden', boxShadow: '0 2px 8px rgba(0,0,0,0.06)' }}>
      <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 12.5 }}>
        <thead>
          <tr style={{ background: G.hover, borderBottom: `1.5px solid ${G.border}` }}>
            <th style={{ width: 40, padding: '10px 14px', textAlign: 'center' }}>
              <div onClick={onSelectAll} style={{ cursor: 'pointer', display: 'inline-flex' }}>
                <Checkbox checked={allSelected} indeterminate={someSelected}/>
              </div>
            </th>
            {[
              { label: 'Name' },
              { label: 'Department' },
              { label: 'Rank / Education' },
              { label: 'Status' },
              { label: 'Courses' },
              { label: 'Actions', right: true },
            ].map(col => (
              <th key={col.label} style={{
                padding: '10px 14px', textAlign: col.right ? 'right' : 'left',
                fontWeight: 700, color: G.muted2, fontSize: 10.5,
                textTransform: 'uppercase', letterSpacing: '.7px', whiteSpace: 'nowrap',
              }}>{col.label}</th>
            ))}
          </tr>
        </thead>
        <tbody>
          {faculty.map((f, i) => {
            const isSel  = selected.has(f.id)
            const specs  = facultySpecs(f)

            return (
              <tr key={f.id}
                onClick={() => navigate(`/dashboard/faculty/${f.id}`)}
                onMouseEnter={e => { if (!isSel) e.currentTarget.style.background = G.hover }}
                onMouseLeave={e => { if (!isSel) e.currentTarget.style.background = 'transparent' }}
                style={{
                  borderBottom: i < faculty.length - 1 ? `1px solid ${G.borderLight}` : 'none',
                  background: isSel ? G.meadowSoft : 'transparent',
                  cursor: 'pointer', transition: 'background .1s',
                }}>

                {/* Checkbox */}
                <td style={{ padding: '10px 14px', textAlign: 'center' }} onClick={e => { e.stopPropagation(); onSelect(f.id) }}>
                  <Checkbox checked={isSel}/>
                </td>

                {/* Name */}
                <td style={{ padding: '10px 14px' }}>
                  <div style={{ fontWeight: 600, color: G.ink, fontSize: 13 }}>{f.name}</div>
                  {f.coordinatorProgram && (
                    <div style={{ fontSize: 10, color: '#F59E0B', fontWeight: 700, display: 'flex', alignItems: 'center', gap: 3, marginTop: 2 }}>
                      <svg width="8" height="8" viewBox="0 0 24 24" fill='#F59E0B'><polygon points="12 2 15.09 8.26 22 9.27 17 14.14 18.18 21.02 12 17.77 5.82 21.02 7 14.14 2 9.27 8.91 8.26 12 2"/></svg>
                      Coord · {f.coordinatorProgram}
                    </div>
                  )}
                </td>

                {/* Department */}
                <td style={{ padding: '10px 14px', color: G.muted2, fontSize: 12 }}>{f.Department || <span style={{ color: G.border }}>—</span>}</td>

                {/* Rank / Education */}
                <td style={{ padding: '10px 14px' }}>
                  {f.AcademicRank && <div style={{ color: G.ink, fontWeight: 500, fontSize: 12 }}>{f.AcademicRank}</div>}
                  {f.Educational_attainment && <div style={{ color: G.muted2, fontSize: 10.5, marginTop: 1 }}>{f.Educational_attainment}</div>}
                  {!f.AcademicRank && !f.Educational_attainment && <span style={{ color: G.border }}>—</span>}
                </td>

                {/* Status */}
                <td style={{ padding: '10px 14px' }}>
                  <span style={{
                    padding: '3px 9px', borderRadius: 99, fontSize: 10.5, fontWeight: 600,
                    background: f.status === 'full-time' ? G.meadowSoft : G.hover,
                    color: f.status === 'full-time' ? 'var(--meadow-text-hover)' : G.muted,
                  }}>
                    {f.status === 'full-time' ? 'Full-time' : 'Part-time'}
                  </span>
                  {f.archived && (
                    <span style={{ marginLeft: 5, padding: '3px 9px', borderRadius: 99, fontSize: 10.5, fontWeight: 600, background: 'rgba(217, 119, 6, 0.1)', color: '#F59E0B' }}>Archived</span>
                  )}
                </td>

                {/* Courses */}
                <td style={{ padding: '10px 14px', color: G.muted2, fontSize: 12 }}>
                  {specs.length > 0 ? (
                    <span style={{ fontWeight: 600, color: G.muted }}>{specs.length} courses</span>
                  ) : <span style={{ color: G.border }}>—</span>}
                </td>

                {/* Actions */}
                <td style={{ padding: '10px 14px', textAlign: 'right' }} onClick={e => e.stopPropagation()}>
                  <div style={{ display: 'flex', gap: 4, justifyContent: 'flex-end' }}>
                    {viewTab === 'active' && (
                      <button onClick={() => onArchive(f.id, f.name)} title="Archive"
                        style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', width: 26, height: 26, borderRadius: 7, background: 'rgba(217, 119, 6, 0.1)', border: '1px solid #FDE68A', color: '#F59E0B', cursor: 'pointer', padding: 0, transition: 'all .14s' }}
                        onMouseEnter={e => { e.currentTarget.style.background = '#F59E0B'; e.currentTarget.style.color = '#fff' }}
                        onMouseLeave={e => { e.currentTarget.style.background = 'rgba(217, 119, 6, 0.1)'; e.currentTarget.style.color = '#F59E0B' }}>
                        <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2"><path d="M21 8v13H3V8"/><path d="M23 3H1v5h22z"/><line x1="10" y1="12" x2="14" y2="12"/></svg>
                      </button>
                    )}
                    {viewTab === 'archived' && (
                      <>
                        <button onClick={() => onUnarchive(f.id, f.name)} title="Restore"
                          style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', width: 26, height: 26, borderRadius: 7, background: G.meadowSoft, border: `1px solid ${G.meadowBorder}`, color: 'var(--meadow-text-hover)', cursor: 'pointer', padding: 0, transition: 'all .14s' }}
                          onMouseEnter={e => { e.currentTarget.style.background = G.meadow; e.currentTarget.style.color = '#fff' }}
                          onMouseLeave={e => { e.currentTarget.style.background = G.meadowSoft; e.currentTarget.style.color = 'var(--meadow-text-hover)' }}>
                          <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2"><polyline points="1 4 1 10 7 10"/><path d="M3.51 15a9 9 0 1 0 .49-3.5"/></svg>
                        </button>
                        <button onClick={() => onDelete(f.id, f.name)} title="Delete permanently"
                          style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', width: 26, height: 26, borderRadius: 7, background: 'rgba(220, 38, 38, 0.1)', border: '1px solid #FFCCCC', color: '#EF4444', cursor: 'pointer', padding: 0, transition: 'all .14s' }}
                          onMouseEnter={e => { e.currentTarget.style.background = '#EF4444'; e.currentTarget.style.color = '#fff' }}
                          onMouseLeave={e => { e.currentTarget.style.background = 'rgba(220, 38, 38, 0.1)'; e.currentTarget.style.color = '#EF4444' }}>
                          <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2"><polyline points="3 6 5 6 21 6"/><path d="M19 6l-1 14a2 2 0 0 1-2 2H8a2 2 0 0 1-2-2L5 6"/><path d="M10 11v6M14 11v6"/></svg>
                        </button>
                      </>
                    )}
                  </div>
                </td>
              </tr>
            )
          })}
        </tbody>
      </table>
    </div>
  )
}

/* ── Filter modal section header ── */
function SectionLabel({ label, count, onClear, icon }) {
  return (
    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 12 }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
        {icon && <div style={{ color: G.muted2, display: 'flex' }}>{icon}</div>}
        <span style={{ fontSize: 13, fontWeight: 600, color: G.ink }}>{label}</span>
        {count > 0 && (
          <span style={{ fontSize: 10, fontWeight: 700, padding: '2px 6px', borderRadius: 6, background: G.meadowSoft, color: 'var(--meadow-text-hover)' }}>{count}</span>
        )}
      </div>
      {count > 0 && (
        <button onClick={onClear} style={{ fontSize: 11.5, color: G.muted2, background: 'none', border: 'none', cursor: 'pointer', fontFamily: "'Inter',sans-serif", fontWeight: 500, transition: 'color .15s' }}
          onMouseEnter={e => e.currentTarget.style.color = 'var(--meadow-text-hover)'}
          onMouseLeave={e => e.currentTarget.style.color = G.muted2}>
          Clear
        </button>
      )}
    </div>
  )
}

/* ── New Modern Filter pill ── */
function FilterPill({ label, count, active, onClick, icon }) {
  return (
    <button onClick={onClick} style={{
      padding: '6px 14px', borderRadius: 10, fontSize: 12,
      fontFamily: "'Inter',sans-serif", fontWeight: active ? 600 : 500,
      background: active ? 'var(--meadow-soft)' : 'var(--surface)',
      color: active ? 'var(--meadow-text)' : G.muted,
      border: `1px solid ${active ? G.meadowBorder : G.border}`,
      cursor: 'pointer', transition: 'all .15s',
      display: 'flex', alignItems: 'center', gap: 6,
      boxShadow: active ? '0 2px 8px rgba(0,0,0,0.08)' : '0 1px 2px rgba(0,0,0,0.02)'
    }}
    onMouseEnter={e => { if(!active) { e.currentTarget.style.borderColor = G.meadowBorder; e.currentTarget.style.color = 'var(--meadow-text-hover)' } }}
    onMouseLeave={e => { if(!active) { e.currentTarget.style.borderColor = G.border; e.currentTarget.style.color = G.muted } }}
    >
      {active && <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3"><polyline points="20 6 9 17 4 12"/></svg>}
      {icon && !active && icon}
      <span style={{ maxWidth: 180, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{label}</span>
      {count != null && <span style={{ fontSize: 10.5, opacity: active ? 0.8 : 0.5, flexShrink: 0 }}>{count}</span>}
    </button>
  )
}

import { useTour } from '../../hooks/useTour.jsx'

const TOUR_SEEN_KEY = 'adminFaculty_tourSeen'
function isOnboardingCompleted() {
  try { return localStorage.getItem(TOUR_SEEN_KEY) === '1' } catch { return true }
}
function markOnboardingCompleted() {
  try { localStorage.setItem(TOUR_SEEN_KEY, '1') } catch {}
}

/* ═══════════════════════════════════════════════════════════════
   MAIN PAGE
═══════════════════════════════════════════════════════════════ */
export default function FacultyListPage() {
  const { toasts, toast } = useToast()

  

  
  const [activeFaculty,     setActiveFaculty]     = useState([])
  const [archivedFaculty,   setArchivedFaculty]   = useState([])
  const [search,            setSearch]            = useState('')
  const [statusFilter,      setStatusFilter]      = useState([])
  const [viewTab,           setViewTab]           = useState('active')
  const [viewMode,          setViewMode]          = useState('grid')   // 'grid' | 'list'
  const [loading,           setLoading]           = useState(true)

  const { TourElement, startTour } = useTour('adminFaculty', [
    {
      target: '#tour-faculty-tabs',
      title: 'Active vs. Archived',
      content: 'Active is your working roster — everyone eligible for scheduling. Archive a faculty member instead of deleting them to keep their history without including them in future runs.',
      disableBeacon: true,
    },
    {
      target: '#tour-faculty-actions',
      title: 'Bulk Import & Export',
      content: 'Export the current list to Excel for records or offline edits, or upload a spreadsheet to add or update many faculty members at once instead of entering them one by one.',
    },
    {
      target: '#tour-add-faculty-btn',
      title: 'Add a Faculty Member',
      content: 'Manually add one faculty member — set their department, specialization, unit cap, and availability individually.',
    },
    {
      target: '#tour-faculty-search',
      title: 'Search & Filter',
      content: 'Find someone by name, department, or specialization, or open the advanced filters to narrow the list by status, load, or other criteria.',
    },
    {
      target: '#tour-faculty-view-toggle',
      title: 'Grid or List View',
      content: 'Switch between a card-based grid for browsing and a denser list view when you need to scan or compare more faculty at once.',
    },
    {
      target: '#tour-faculty-list-anchor',
      spotlightTarget: '#tour-faculty-list',
      title: 'Faculty Profiles',
      content: 'Click any faculty member to open their full profile — schedule, teaching load, availability, and preferences — and edit it from there.',
      placement: 'center',
    },
  ], !loading)
  const [selected,          setSelected]          = useState(new Set())
  const [busy,              setBusy]              = useState(false)
  const [showImport,        setShowImport]        = useState(false)
  const [pendingAction,     setPendingAction]     = useState(null)
  const [filterModalOpen,   setFilterModalOpen]   = useState(false)
  const [specQuery,         setSpecQuery]         = useState('')
  const [specMinRating,     setSpecMinRating]     = useState(0)
  const [rankFilter,        setRankFilter]        = useState([])
  const [departmentFilter,  setDepartmentFilter]  = useState([])
  const [educationFilter,   setEducationFilter]   = useState([])
  const [coordinatorFilter, setCoordinatorFilter] = useState('') // '' | 'any' | 'none'
  const [specializationFilter, setSpecializationFilter] = useState([])
  const [sortBy,            setSortBy]            = useState('name')
  const [courseTitleMap,    setCourseTitleMap]    = useState({})
  const navigate = useNavigate()

  async function load() {
    setLoading(true)
    try {
      const [active, archived, courseList] = await Promise.all([
        getFaculty(),
        getArchivedFaculty(),
        getCourses().catch(() => []),
      ])
      setActiveFaculty(active)
      setArchivedFaculty(archived.filter(f => f.archived))
      const titleMap = {}
      ;(Array.isArray(courseList) ? courseList : []).forEach(c => {
        const code  = (c.courseCode || '').trim()
        const title = (c.title || '').trim()
        if (code && title) { titleMap[code.toUpperCase()] = title; titleMap[code.toUpperCase().replace(/\s+/g, "")] = title }
      })
      setCourseTitleMap(titleMap)
    } finally { setLoading(false) }
    setSelected(new Set())
  }
  useEffect(() => { load() }, [])

  const tabFaculty = viewTab === 'active' ? activeFaculty : archivedFaculty

  /* ── Derived option lists ── */
  const allDepartments = useMemo(() => {
    const s = new Set()
    tabFaculty.forEach(f => { if (f.Department) s.add(f.Department) })
    return [...s].sort()
  }, [tabFaculty])

  const allEducations = useMemo(() => {
    const s = new Set()
    tabFaculty.forEach(f => { if (f.Educational_attainment) s.add(f.Educational_attainment) })
    return [...s].sort()
  }, [tabFaculty])

  /* ── Specialization index ── */
  const allSpecializations = useMemo(() => {
    const map = new Map()
    tabFaculty.forEach(f => {
      facultySpecs(f).forEach(s => {
        const resolvedTitle = s.title || courseTitleMap[(s.code || '').toUpperCase()] || ''
        const enriched = { ...s, title: resolvedTitle || undefined }
        const key = specKey(enriched)
        if (!key) return
        if (!map.has(key)) map.set(key, { key, title: resolvedTitle || undefined, code: s.code, count: 0, ratingSum: 0, ratingCount: 0 })
        const entry = map.get(key)
        entry.count += 1
        const r = Number(s.rating)
        if (s.rating != null && !isNaN(r)) { entry.ratingSum += r; entry.ratingCount += 1 }
      })
    })
    return [...map.values()].map(e => ({
      ...e,
      avgRating: e.ratingCount > 0 ? Math.round(e.ratingSum / e.ratingCount * 10) / 10 : null,
    })).sort((a, b) => (a.title || a.code || '').toLowerCase().localeCompare((b.title || b.code || '').toLowerCase()))
  }, [tabFaculty, courseTitleMap])

  const visibleSpecs = useMemo(() => {
    const q = specQuery.trim().toLowerCase()
    if (!q) return allSpecializations
    return allSpecializations.filter(s =>
      (s.title || '').toLowerCase().includes(q) || (s.code || '').toLowerCase().includes(q)
    )
  }, [allSpecializations, specQuery])

  /* ── Filtered & sorted list ── */
  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase()
    let list = tabFaculty.filter(f => {
      const specs = facultySpecs(f)

      const matchSearch = !q
        || (f.name || '').toLowerCase().includes(q)
        || (f.AcademicRank || '').toLowerCase().includes(q)
        || (f.Department || '').toLowerCase().includes(q)
        || (f.Educational_attainment || '').toLowerCase().includes(q)
        || specs.some(s =>
            (s.code  || '').toLowerCase().includes(q) ||
            (s.title || '').toLowerCase().includes(q) ||
            (courseTitleMap[(s.code || '').toUpperCase()] || '').toLowerCase().includes(q)
          )

      const matchStatus      = statusFilter.length === 0 || statusFilter.includes(f.status)
      const matchRank        = rankFilter.length === 0 || rankFilter.includes(f.AcademicRank || '')
      const matchDept        = departmentFilter.length === 0 || departmentFilter.includes(f.Department || '')
      const matchEducation   = educationFilter.length === 0 || educationFilter.includes(f.Educational_attainment || '')
      const matchCoordinator = !coordinatorFilter
        || (coordinatorFilter === 'any'  && !!f.coordinatorProgram)
        || (coordinatorFilter === 'none' && !f.coordinatorProgram)

      const matchSpec = (() => {
        const hasSF = specializationFilter.length > 0
        const hasRF = specMinRating > 0
        if (!hasSF && !hasRF) return true
        return specs.some(s => {
          const resolvedTitle = s.title || courseTitleMap[(s.code || '').toUpperCase()] || ''
          const enriched = { ...s, title: resolvedTitle || undefined }
          const courseMatch = !hasSF || specializationFilter.includes(specKey(enriched))
          const ratingMatch = !hasRF || (Number(s.rating) || 0) >= specMinRating
          return courseMatch && ratingMatch
        })
      })()

      return matchSearch && matchStatus && matchRank && matchDept && matchEducation && matchCoordinator && matchSpec
    })

    if (sortBy === 'name')        list = [...list].sort((a, b) => (a.name || '').localeCompare(b.name || ''))
    else if (sortBy === 'specs-desc') list = [...list].sort((a, b) => facultySpecs(b).length - facultySpecs(a).length)
    return list
  }, [tabFaculty, search, statusFilter, rankFilter, departmentFilter, educationFilter, coordinatorFilter, specializationFilter, specMinRating, sortBy, courseTitleMap])

  /* ── Selection ── */
  const filteredIds  = filtered.map(f => f.id)
  const allSelected  = filteredIds.length > 0 && filteredIds.every(id => selected.has(id))
  const someSelected = filteredIds.some(id => selected.has(id)) && !allSelected
  const selectedCount = [...selected].filter(id => filteredIds.includes(id)).length
  const selectionMode = selected.size > 0

  function toggleSelectAll() {
    if (allSelected) setSelected(prev => { const n = new Set(prev); filteredIds.forEach(id => n.delete(id)); return n })
    else             setSelected(prev => { const n = new Set(prev); filteredIds.forEach(id => n.add(id)); return n })
  }
  function toggleOne(id) { setSelected(prev => { const n = new Set(prev); n.has(id) ? n.delete(id) : n.add(id); return n }) }
  function toggleSpec(key) { setSpecializationFilter(prev => prev.includes(key) ? prev.filter(k => k !== key) : [...prev, key]) }

  /* ── Actions ── */
  function handleCardArchive(id, name)   { setPendingAction({ mode: 'archive',   id, name }) }
  function handleCardUnarchive(id, name) { setPendingAction({ mode: 'unarchive', id, name }) }
  function handleCardDelete(id, name)    { setPendingAction({ mode: 'delete',    id, name }) }
  function handleBulkArchive()   { const t = filtered.filter(f => selected.has(f.id)); if (t.length) setPendingAction({ mode: 'archive',   bulk: true, count: t.length, targets: t }) }
  function handleBulkUnarchive() { const t = filtered.filter(f => selected.has(f.id)); if (t.length) setPendingAction({ mode: 'unarchive', bulk: true, count: t.length, targets: t }) }
  function handleBulkDelete()    { const t = filtered.filter(f => selected.has(f.id)); if (t.length) setPendingAction({ mode: 'delete',    bulk: true, count: t.length, targets: t }) }

  async function handleConfirm() {
    if (!pendingAction) return
    setBusy(true)
    try {
      const { mode, bulk, targets, id } = pendingAction
      if (bulk) {
        if (mode === 'archive')   { await Promise.all(targets.map(f => archiveFaculty(f.id)));   toast(`${targets.length} faculty archived`, 'success') }
        if (mode === 'unarchive') { await Promise.all(targets.map(f => unarchiveFaculty(f.id))); toast(`${targets.length} faculty restored`, 'success') }
        if (mode === 'delete')    { await Promise.all(targets.map(f => deleteFaculty(f.id)));    toast(`${targets.length} faculty deleted`, 'success') }
      } else {
        if (mode === 'archive')   { await archiveFaculty(id);   toast('Faculty archived', 'success') }
        if (mode === 'unarchive') { await unarchiveFaculty(id); toast('Faculty restored', 'success') }
        if (mode === 'delete')    { await deleteFaculty(id);    toast('Faculty deleted', 'success') }
      }
      setPendingAction(null); setSelected(new Set()); load()
    } catch { toast(`Failed to ${pendingAction.mode} faculty`, 'error') }
    finally  { setBusy(false) }
  }

  /* ── Reset all filters ── */
  function resetAllFilters() {
    setSearch(''); setStatusFilter([]); setRankFilter([])
    setDepartmentFilter([]); setEducationFilter([])
    setCoordinatorFilter('')
    setSpecializationFilter([]); setSpecQuery(''); setSpecMinRating(0)
  }

  const activeModalFilterCount =
    rankFilter.length + departmentFilter.length + educationFilter.length +
    specializationFilter.length + (coordinatorFilter ? 1 : 0) + (specMinRating > 0 ? 1 : 0)

  const hasAnyFilter = search || statusFilter.length > 0 || activeModalFilterCount > 0

  /* ── Export ── */
  async function handleExport() {
    if (!filtered.length) return

    const wb = await generateExportWorkbook(filtered, courseTitleMap)

    const filterParts = []

    if (viewTab === 'archived') filterParts.push('Archived')

    if (statusFilter.length > 0) {
      filterParts.push(statusFilter.map(s => s === 'full-time' ? 'FullTime' : 'PartTime').join('-'))
    }

    if (departmentFilter.length > 0) {
      filterParts.push(departmentFilter.join('-'))
    }

    if (rankFilter.length > 0) {
      filterParts.push(rankFilter.join('-'))
    }

    if (coordinatorFilter === 'any') filterParts.push('Coordinators')

    // Clean up filename parts and construct final suffix
    const safeFilterString = filterParts.join('_').replace(/[^a-zA-Z0-9_-]/g, '')
    const filterSuffix = safeFilterString ? `-${safeFilterString}` : ''

    await downloadWorkbook(wb, `Faculty-Matrix${filterSuffix}-${new Date().toISOString().slice(0, 10)}.xlsx`)
    toast('Exported successfully', 'success')
  }

  /* ──────────────────────────────────────────────────────────────
     RENDER
  ────────────────────────────────────────────────────────────── */
  return (
    <div style={{ padding: '28px 32px', fontFamily: "'Inter',sans-serif", background: G.bg, minHeight: '100%' }}>
      {TourElement}
      <style>{`
        @keyframes slideIn    { from{opacity:0;transform:translateY(-8px)} to{opacity:1;transform:translateY(0)} }
        @keyframes spin       { to{transform:rotate(360deg)} }
        @keyframes fadeIn     { from{opacity:0} to{opacity:1} }
        @keyframes facShimmer { 0%{background-position:-400px 0} 100%{background-position:400px 0} }
        .fac-skeleton { background:linear-gradient(90deg,${G.hover} 25%,${G.borderLight} 50%,${G.hover} 75%);background-size:800px 100%;animation:facShimmer 1.4s ease-in-out infinite;border-radius:7px; }
        @keyframes facToastIn { from{opacity:0;transform:scale(.96) translateY(12px)} to{opacity:1;transform:scale(1) translateY(0)} }
        .fac-toast-wrap { position:fixed;bottom:24px;left:50%;z-index:9999;display:flex;flex-direction:column;gap:10px;align-items:center;pointer-events:none;transform:translateX(-50%); }
        .fac-toast { display:flex;align-items:center;gap:10px;padding:12px 20px;border-radius:12px;font-family:'Inter',sans-serif;font-size:13px;font-weight:600;animation:facToastIn .22s cubic-bezier(.4,0,.2,1);white-space:nowrap;pointer-events:auto; }
        .fac-toast.success { background:linear-gradient(135deg,${G.meadow},${G.meadowDeep});color:#fff;box-shadow:0 8px 24px rgba(0,0,0,0.3);border:1px solid ${G.meadowBorder}; }
        .fac-toast.error   { background: var(--surface);color:#DC2626;border:1.5px solid #FECACA;box-shadow:0 8px 24px rgba(220,38,38,0.15); }
        .fac-toast.info    { background: var(--surface);color: var(--meadow-text-hover);border:1.5px solid ${G.meadowBorder};box-shadow:0 8px 24px rgba(0,0,0,0.15); }
        .fac-search:focus  { border-color: var(--meadow-text-hover)!important;box-shadow:0 0 0 3px rgba(0,0,0,0.12)!important;background: var(--surface)!important; }
        .fac-tr-hover:hover td { background:${G.hover}; }

        /* ── Segmented Button Styles (Unified with ScheduleView) ── */
        .fac-view-group { display:flex; border:1px solid ${G.border}; border-radius:8px; overflow:hidden; background: var(--surface); }
        .fac-view-btn {
          display:flex; align-items:center; gap:5px; padding:5px 11px;
          font-size:11.5px; font-family:'Inter',sans-serif;
          border:none; cursor:pointer; transition:all .15s; white-space:nowrap;
        }
        .fac-view-btn.active { background:${G.meadowSoft}; color: var(--meadow-text); font-weight:700; }
        .fac-view-btn:not(.active) { background:transparent; color:${G.muted2}; font-weight:400; }
        .fac-view-btn:not(.active):hover { background:${G.hover}; color: var(--meadow-text-hover); }
      `}</style>

      {/* ── Header row ── */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16, gap: 12, flexWrap: 'wrap' }}>
        {/* Tab switcher */}
        <div id="tour-faculty-tabs" style={{ display: 'flex', gap: 3, background: 'var(--surface)', borderRadius: 10, padding: 3, border: `1px solid ${G.border}`, flexShrink: 0 }}>
          {[
            { key: 'active',   label: loading ? 'Active'   : `Active (${activeFaculty.length})` },
            { key: 'archived', label: loading ? 'Archived' : `Archived (${archivedFaculty.length})` },
          ].map(({ key, label }) => {
            const isActive = viewTab === key
            return (
              <button key={key} onClick={() => { setViewTab(key); setSelected(new Set()) }} style={{
                padding: '5px 16px', borderRadius: 7, fontSize: 12, fontWeight: isActive ? 700 : 500,
                background: isActive ? G.meadow : 'transparent',
                color: isActive ? '#fff' : G.muted,
                border: isActive ? 'none' : '1px solid transparent',
                cursor: 'pointer', transition: 'all 0.15s', fontFamily: "'Inter',sans-serif",
                boxShadow: isActive ? '0 2px 8px rgba(0,0,0,0.28)' : 'none',
              }}>{label}</button>
            )
          })}
        </div>

        <div style={{ display: 'flex', gap: 8, alignItems: 'center', flexShrink: 0 }}>
          {/* View mode toggle (Updated to match ScheduleView logic) */}
          <div id="tour-faculty-view-toggle" className="fac-view-group">
            {[
              ['grid', 'Grid', (
                <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                  <rect x="3" y="3" width="7" height="7"/><rect x="14" y="3" width="7" height="7"/>
                  <rect x="3" y="14" width="7" height="7"/><rect x="14" y="14" width="7" height="7"/>
                </svg>
              )],
              ['list', 'List', (
                <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                  <line x1="8" y1="6" x2="21" y2="6"/><line x1="8" y1="12" x2="21" y2="12"/>
                  <line x1="8" y1="18" x2="21" y2="18"/><line x1="3" y1="6" x2="3.01" y2="6"/>
                  <line x1="3" y1="12" x2="3.01" y2="12"/><line x1="3" y1="18" x2="3.01" y2="18"/>
                </svg>
              )],
            ].map(([v, label, icon], i, arr) => (
              <button key={v} onClick={() => setViewMode(v)} title={`${label} view`}
                className={`fac-view-btn${viewMode===v?' active':''}`}
                style={{ borderRight: i < arr.length-1 ? `1px solid ${G.border}` : 'none' }}>
                {icon} {label}
              </button>
            ))}
          </div>

          <div id="tour-faculty-actions" style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
            {/* Export */}
            <button onClick={handleExport} disabled={!filtered.length} title="Export specialization matrix to Excel"
              style={{ display: 'inline-flex', alignItems: 'center', gap: 6, padding: '7px 12px', borderRadius: 8, border: `1px solid ${G.border}`, background: 'var(--surface)', color: G.muted2, fontSize: 11.5, fontWeight: 500, cursor: filtered.length ? 'pointer' : 'not-allowed', opacity: filtered.length ? 1 : 0.45, transition: 'all .15s', fontFamily: "'Inter',sans-serif" }}
              onMouseEnter={e => { if (filtered.length) { e.currentTarget.style.background = G.hover; e.currentTarget.style.color = 'var(--meadow-text-hover)' }}}
              onMouseLeave={e => { e.currentTarget.style.background = 'var(--surface)'; e.currentTarget.style.color = G.muted2 }}>
             <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2">
                <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/>
                <polyline points="7 10 12 15 17 10"/>
                <line x1="12" y1="15" x2="12" y2="3"/>
              </svg>
              Export
            </button>

            {/* Upload Faculty List */}
            <button onClick={() => setShowImport(true)}
              style={{ display: 'inline-flex', alignItems: 'center', gap: 7, padding: '8px 16px', borderRadius: 10, border: `1px solid ${G.border}`, fontFamily: "'Inter',sans-serif", fontSize: 12.5, fontWeight: 600, cursor: 'pointer', transition: 'all .15s', background: 'var(--surface)', color: G.muted }}
              onMouseEnter={e => { e.currentTarget.style.background = G.hover; e.currentTarget.style.borderColor = G.meadowBorder; e.currentTarget.style.color = 'var(--meadow-text-hover)' }}
              onMouseLeave={e => { e.currentTarget.style.background = 'var(--surface)'; e.currentTarget.style.borderColor = G.border; e.currentTarget.style.color = G.muted }}>
              <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
                <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/>
                <polyline points="17 8 12 3 7 8"/>
                <line x1="12" y1="3" x2="12" y2="15"/>
              </svg>
              Upload Faculty List
            </button>
          </div>

          <button id="tour-add-faculty-btn" onClick={() => navigate('/dashboard/faculty/new')}
            style={{ display: 'inline-flex', alignItems: 'center', gap: 7, padding: '8px 18px', borderRadius: 10, border: 'none', fontFamily: "'Inter',sans-serif", fontSize: 12.5, fontWeight: 600, cursor: 'pointer', transition: 'all .15s', background: `linear-gradient(135deg,${G.meadow},${G.meadowDeep})`, color: '#fff', boxShadow: '0 3px 12px rgba(0,0,0,0.32)' }}
            onMouseEnter={e => { e.currentTarget.style.boxShadow = '0 5px 18px rgba(0,0,0,0.42)'; e.currentTarget.style.transform = 'translateY(-1px)' }}
            onMouseLeave={e => { e.currentTarget.style.boxShadow = '0 3px 12px rgba(0,0,0,0.32)'; e.currentTarget.style.transform = 'none' }}>
            <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"><line x1="12" y1="5" x2="12" y2="19"/><line x1="5" y1="12" x2="19" y2="12"/></svg>
            Add Faculty
          </button>
        </div>
      </div>

      {/* ── Search + Toolbar ── */}
      <div id="tour-faculty-search" style={{ background: 'var(--surface)', borderRadius: 14, border: `1px solid ${G.border}`, padding: '10px 16px', marginBottom: 10, display: 'flex', alignItems: 'center', gap: 12, flexWrap: 'wrap', boxShadow: '0 2px 8px rgba(0,0,0,0.05)' }}>

        {/* Search */}
        <div style={{ position: 'relative', flex: '1 1 220px', minWidth: 180 }}>
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke={G.muted2} strokeWidth="2"
            style={{ position: 'absolute', left: 11, top: '50%', transform: 'translateY(-50%)', pointerEvents: 'none' }}>
            <circle cx="11" cy="11" r="8"/><line x1="21" y1="21" x2="16.65" y2="16.65"/>
          </svg>
          <input placeholder="Search by name, rank, department, or course…" value={search} onChange={e => setSearch(e.target.value)} className="fac-search"
            style={{ width: '100%', paddingLeft: 34, paddingRight: 10, height: 34, borderRadius: 8, border: `1.5px solid ${G.border}`, fontSize: 12.5, fontFamily: "'Inter',sans-serif", background: G.hover, outline: 'none', boxSizing: 'border-box', transition: 'all .15s', color: G.ink }}/>
        </div>

        <div style={{ width: 1, height: 20, background: G.border, flexShrink: 0 }}/>

        {/* Status quick-pills */}
        <span style={{ fontSize: 10.5, fontWeight: 700, color: G.muted2, textTransform: 'uppercase', letterSpacing: '.7px', whiteSpace: 'nowrap', flexShrink: 0 }}>Status</span>
        <div style={{ display: 'flex', gap: 5 }}>
          <TogglePill label="Full-time" active={statusFilter.includes('full-time')} onClick={() => setStatusFilter(p => p.includes('full-time') ? p.filter(x => x !== 'full-time') : [...p, 'full-time'])}/>
          <TogglePill label="Part-time" active={statusFilter.includes('part-time')} onClick={() => setStatusFilter(p => p.includes('part-time') ? p.filter(x => x !== 'part-time') : [...p, 'part-time'])}/>
        </div>

        <div style={{ width: 1, height: 20, background: G.border, flexShrink: 0 }}/>

        {/* Filters modal trigger */}
        <button onClick={() => setFilterModalOpen(true)} style={{
          display: 'inline-flex', alignItems: 'center', gap: 6, padding: '5px 13px', borderRadius: 99, fontSize: 11.5,
          fontWeight: activeModalFilterCount ? 600 : 500,
          background: activeModalFilterCount ? G.meadow : G.hover,
          color: activeModalFilterCount ? '#fff' : G.muted,
          border: `1.5px solid ${activeModalFilterCount ? 'transparent' : G.border}`,
          cursor: 'pointer', transition: 'all .15s', whiteSpace: 'nowrap', fontFamily: "'Inter',sans-serif",
          boxShadow: activeModalFilterCount ? '0 2px 8px rgba(0,0,0,0.28)' : 'none',
        }}>
          <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
            <line x1="4" y1="6" x2="20" y2="6"/><line x1="8" y1="12" x2="16" y2="12"/><line x1="11" y1="18" x2="13" y2="18"/>
          </svg>
          Filters{activeModalFilterCount > 0 ? ` (${activeModalFilterCount})` : ''}
        </button>

        <div style={{ width: 1, height: 20, background: G.border, flexShrink: 0 }}/>

        {/* Sort */}
        <span style={{ fontSize: 10.5, fontWeight: 700, color: G.muted2, textTransform: 'uppercase', letterSpacing: '.7px', whiteSpace: 'nowrap', flexShrink: 0 }}>Sort</span>
        <select value={sortBy} onChange={e => setSortBy(e.target.value)} style={{ fontSize: 11.5, fontWeight: 500, color: G.ink, background: G.hover, border: `1.5px solid ${G.border}`, borderRadius: 8, padding: '5px 8px', fontFamily: "'Inter',sans-serif", cursor: 'pointer', outline: 'none' }}>
          <option value="name">Name (A–Z)</option>
          <option value="specs-desc">Most specializations</option>
        </select>

        {/* Select all */}
        {filtered.length > 0 && (
          <>
            <div style={{ width: 1, height: 20, background: G.border, flexShrink: 0 }}/>
            <div onClick={toggleSelectAll} style={{ display: 'flex', alignItems: 'center', gap: 7, cursor: 'pointer', fontSize: 12, color: G.muted, fontWeight: 500, userSelect: 'none', whiteSpace: 'nowrap' }}>
              <Checkbox checked={allSelected} indeterminate={someSelected}/>
              {allSelected ? 'Deselect all' : 'Select all'}
            </div>
          </>
        )}

        {/* Clear all filters */}
        {hasAnyFilter && (
          <>
            <div style={{ width: 1, height: 20, background: G.border, flexShrink: 0 }}/>
            <button onClick={resetAllFilters}
              style={{ fontSize: 11.5, color: 'var(--meadow-text-hover)', background: G.meadowSoft, border: 'none', padding: '4px 11px', borderRadius: 99, cursor: 'pointer', fontWeight: 600, fontFamily: "'Inter',sans-serif", whiteSpace: 'nowrap' }}>
              Clear all
            </button>
          </>
        )}
      </div>

      {/* ── Active filter chips ── */}
      <ActiveFilterChips
        statusFilter={statusFilter} rankFilter={rankFilter}
        departmentFilter={departmentFilter} educationFilter={educationFilter}
        coordinatorFilter={coordinatorFilter}
        specializationFilter={specializationFilter} specMinRating={specMinRating}
        onRemoveStatus={v => setStatusFilter(p => p.filter(x => x !== v))}
        onRemoveRank={v => setRankFilter(p => p.filter(x => x !== v))}
        onRemoveDept={v => setDepartmentFilter(p => p.filter(x => x !== v))}
        onRemoveEducation={v => setEducationFilter(p => p.filter(x => x !== v))}
        onClearCoordinator={() => setCoordinatorFilter('')}
        onRemoveSpec={v => setSpecializationFilter(p => p.filter(x => x !== v))}
        onClearRating={() => setSpecMinRating(0)}
      />

      {/* ════════════════════════════════════════════
          FILTER MODAL (MODERNIZED & GRID LAYOUT)
      ════════════════════════════════════════════ */}
      {filterModalOpen && (
        <div style={{ position: 'fixed', inset: 0, zIndex: 1000, background: 'rgba(14,42,32,0.45)', backdropFilter: 'blur(4px)', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 24 }}
          onClick={() => setFilterModalOpen(false)}>
          <div style={{ background: 'var(--surface)', borderRadius: 20, width: '100%', maxWidth: 720, maxHeight: '90vh', display: 'flex', flexDirection: 'column', boxShadow: '0 24px 64px rgba(14,42,32,0.24)', overflow: 'hidden' }}
            onClick={e => e.stopPropagation()}>

            {/* Modal header */}
            <div style={{ padding: '20px 24px', borderBottom: `1px solid ${G.border}`, display: 'flex', alignItems: 'center', justifyContent: 'space-between', background: 'var(--surface)' }}>
              <div>
                <div style={{ fontSize: 16, fontWeight: 700, color: G.ink, fontFamily: "'Inter',sans-serif" }}>Advanced Filters</div>
                <div style={{ fontSize: 12, color: G.muted2, marginTop: 4 }}>Narrow down faculty by position, department, load, and course expertise</div>
              </div>
              <button onClick={() => setFilterModalOpen(false)} style={{ width: 32, height: 32, borderRadius: 8, border: `1px solid ${G.border}`, background: 'var(--surface)', display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer', padding: 0, transition: 'all .15s' }}
                onMouseEnter={e => { e.currentTarget.style.background = 'rgba(220, 38, 38, 0.1)'; e.currentTarget.style.borderColor = 'rgba(220, 38, 38, 0.25)'; e.currentTarget.style.color = '#EF4444' }}
                onMouseLeave={e => { e.currentTarget.style.background = 'var(--surface)'; e.currentTarget.style.borderColor = G.border; e.currentTarget.style.color = G.muted }}>
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg>
              </button>
            </div>

            {/* Modal body — scrollable grid layout */}
            <div style={{ overflowY: 'auto', flex: 1, padding: '24px', display: 'flex', flexDirection: 'column' }}>

              {/* Grid Group 1: Identity & Education */}
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 32 }}>
                
                {/* ── Academic Rank / Position ── */}
                <div>
                  <SectionLabel 
                    label="Academic Position" count={rankFilter.length} onClear={() => setRankFilter([])}
                    icon={<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2"/><circle cx="12" cy="7" r="4"/></svg>}
                  />
                  <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6 }}>
                    {[
                      'Instructor I', 'Instructor II', 'Instructor III',
                      'Assistant Professor I', 'Assistant Professor II',
                      'Associate Professor I', 'Associate Professor II',
                      'Professor I', 'Professor II', 'Professor III',
                      'Assistant Dean', 'Dean',
                    ].map(rank => {
                      const cnt = tabFaculty.filter(f => f.AcademicRank === rank).length
                      if (cnt === 0) return null
                      return (
                        <FilterPill key={rank} label={rank} count={cnt} active={rankFilter.includes(rank)}
                          onClick={() => setRankFilter(p => p.includes(rank) ? p.filter(r => r !== rank) : [...p, rank])}/>
                      )
                    })}
                  </div>
                </div>

                {/* ── Educational Attainment ── */}
                {allEducations.length > 0 && (
                  <div>
                    <SectionLabel 
                      label="Education" count={educationFilter.length} onClear={() => setEducationFilter([])}
                      icon={<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M22 10v6M2 10l10-5 10 5-10 5z"/><path d="M6 12v5c3 3 9 3 12 0v-5"/></svg>}
                    />
                    <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6 }}>
                      {allEducations.map(edu => {
                        const cnt = tabFaculty.filter(f => f.Educational_attainment === edu).length
                        return (
                          <FilterPill key={edu} label={edu} count={cnt} active={educationFilter.includes(edu)}
                            onClick={() => setEducationFilter(p => p.includes(edu) ? p.filter(e => e !== edu) : [...p, edu])}/>
                        )
                      })}
                    </div>
                  </div>
                )}
              </div>

              <div style={{ height: 1, background: G.borderLight, margin: '24px 0' }} />

              {/* Grid Group 2: Department & Role */}
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 32 }}>
                
                {/* ── Department ── */}
                {allDepartments.length > 0 && (
                  <div>
                    <SectionLabel 
                      label="Department" count={departmentFilter.length} onClear={() => setDepartmentFilter([])}
                      icon={<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><rect x="4" y="2" width="16" height="20" rx="2" ry="2"/><path d="M9 22v-4h6v4"/><path d="M8 6h.01"/><path d="M16 6h.01"/><path d="M12 6h.01"/><path d="M12 10h.01"/><path d="M12 14h.01"/><path d="M16 10h.01"/><path d="M16 14h.01"/><path d="M8 10h.01"/><path d="M8 14h.01"/></svg>}
                    />
                    <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6 }}>
                      {allDepartments.map(dept => {
                        const cnt = tabFaculty.filter(f => f.Department === dept).length
                        return (
                          <FilterPill key={dept} label={dept} count={cnt} active={departmentFilter.includes(dept)}
                            onClick={() => setDepartmentFilter(p => p.includes(dept) ? p.filter(d => d !== dept) : [...p, dept])}/>
                        )
                      })}
                    </div>
                  </div>
                )}

                {/* ── Coordinator Status ── */}
                <div>
                  <SectionLabel 
                    label="Coordinator Status" count={coordinatorFilter ? 1 : 0} onClear={() => setCoordinatorFilter('')}
                    icon={<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><polygon points="12 2 15.09 8.26 22 9.27 17 14.14 18.18 21.02 12 17.77 5.82 21.02 7 14.14 2 9.27 8.91 8.26 12 2"/></svg>}
                  />
                  <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
                    {[
                      { v: '',     label: 'All faculty',        count: tabFaculty.length },
                      { v: 'any',  label: 'Coordinators only',  count: tabFaculty.filter(f => f.coordinatorProgram).length, icon: <svg width="10" height="10" viewBox="0 0 24 24" fill='#F59E0B' stroke='#F59E0B'><polygon points="12 2 15.09 8.26 22 9.27 17 14.14 18.18 21.02 12 17.77 5.82 21.02 7 14.14 2 9.27 8.91 8.26 12 2"/></svg> },
                      { v: 'none', label: 'Non-coordinators',   count: tabFaculty.filter(f => !f.coordinatorProgram).length },
                    ].map(({ v, label, count, icon }) => (
                      <FilterPill key={v} label={label} count={count} active={coordinatorFilter === v} icon={icon}
                        onClick={() => setCoordinatorFilter(v)}/>
                    ))}
                  </div>
                </div>
              </div>

              <div style={{ height: 1, background: G.borderLight, margin: '24px 0' }} />

              {/* ── Course Specializations & Ratings (Full Width) ── */}
              <div>
                <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', marginBottom: 12 }}>
                  <SectionLabel 
                    label="Course Specializations" count={specializationFilter.length} onClear={() => setSpecializationFilter([])}
                    icon={<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M4 19.5A2.5 2.5 0 0 1 6.5 17H20"/><path d="M6.5 2H20v20H6.5A2.5 2.5 0 0 1 4 19.5v-15A2.5 2.5 0 0 1 6.5 2z"/></svg>}
                  />
                  
                  {/* Min Rating integrated next to the label */}
                  <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                    <span style={{ fontSize: 10.5, fontWeight: 700, color: G.muted2, textTransform: 'uppercase', letterSpacing: '.6px' }}>Min Rating:</span>
                    <select 
                      value={specMinRating} onChange={e => setSpecMinRating(Number(e.target.value))} 
                      style={{ fontSize: 11.5, fontWeight: 600, color: specMinRating > 0 ? 'var(--meadow-text)' : G.ink, background: specMinRating > 0 ? G.meadowSoft : 'var(--surface)', border: `1.5px solid ${specMinRating > 0 ? G.meadowBorder : G.border}`, borderRadius: 8, padding: '4px 8px', fontFamily: "'Inter',sans-serif", cursor: 'pointer', outline: 'none', transition: 'all .15s' }}
                    >
                      <option value={0}>Any</option>
                      <option value={1}>★ 1+</option>
                      <option value={2}>★★ 2+</option>
                      <option value={3}>★★★ 3+</option>
                      <option value={4}>★★★★ 4+</option>
                      <option value={5}>★★★★★ 5</option>
                    </select>
                  </div>
                </div>

                {/* Sleek Search inside modal */}
                <div style={{ position: 'relative', marginBottom: 16 }}>
                  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke={G.muted2} strokeWidth="2.5"
                    style={{ position: 'absolute', left: 12, top: '50%', transform: 'translateY(-50%)', pointerEvents: 'none' }}>
                    <circle cx="11" cy="11" r="8"/><line x1="21" y1="21" x2="16.65" y2="16.65"/>
                  </svg>
                  <input placeholder="Search course title or code…" value={specQuery} onChange={e => setSpecQuery(e.target.value)}
                    style={{ width: '100%', padding: '9px 12px 9px 36px', borderRadius: 10, border: `1px solid ${G.border}`, fontSize: 12.5, fontFamily: "'Inter',sans-serif", background: 'var(--surface)', outline: 'none', boxSizing: 'border-box', color: G.ink, transition: 'all .15s', boxShadow: '0 1px 3px rgba(0,0,0,0.02)' }}
                    onFocus={e => { e.currentTarget.style.borderColor = G.meadow; e.currentTarget.style.boxShadow = '0 0 0 3px rgba(0,0,0,0.1)' }}
                    onBlur={e => { e.currentTarget.style.borderColor = G.border; e.currentTarget.style.boxShadow = '0 1px 3px rgba(0,0,0,0.02)' }}
                  />
                </div>

                {allSpecializations.length === 0 ? (
                  <div style={{ fontSize: 12, color: G.muted2, padding: '8px 0', textAlign: 'center', background: 'var(--bg)', borderRadius: 10, border: `1px dashed ${G.borderLight}` }}>No course data for {viewTab} faculty yet.</div>
                ) : visibleSpecs.length === 0 ? (
                  <div style={{ fontSize: 12, color: G.muted2, padding: '8px 0', textAlign: 'center', background: 'var(--bg)', borderRadius: 10, border: `1px dashed ${G.borderLight}` }}>No courses match "{specQuery}".</div>
                ) : (
                  <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6, maxHeight: 200, overflowY: 'auto', paddingRight: 4 }}>
                    {visibleSpecs.map(s => {
                      const active = specializationFilter.includes(s.key)
                      return (
                        <button key={s.key} onClick={() => toggleSpec(s.key)} style={{
                          padding: '6px 12px', borderRadius: 10, fontSize: 11.5, fontFamily: "'Inter',sans-serif",
                          fontWeight: active ? 600 : 500,
                          background: active ? G.meadowSoft : 'var(--surface)', color: active ? 'var(--meadow-text)' : G.ink,
                          border: `1px solid ${active ? G.meadowBorder : G.border}`,
                          cursor: 'pointer', transition: 'all .15s', display: 'flex', alignItems: 'center', gap: 6,
                          boxShadow: active ? '0 2px 8px rgba(0,0,0,0.08)' : '0 1px 2px rgba(0,0,0,0.02)'
                        }}
                        onMouseEnter={e => { if(!active) { e.currentTarget.style.borderColor = G.meadowBorder; e.currentTarget.style.color = 'var(--meadow-text-hover)' } }}
                        onMouseLeave={e => { if(!active) { e.currentTarget.style.borderColor = G.border; e.currentTarget.style.color = G.ink } }}
                        >
                          {active && <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3"><polyline points="20 6 9 17 4 12"/></svg>}
                          <span style={{ maxWidth: 220, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{s.title || s.code}</span>
                          <span style={{ fontSize: 10, opacity: .5, flexShrink: 0 }}>{s.count}</span>
                          {s.avgRating != null && <span style={{ fontSize: 9.5, opacity: .5, flexShrink: 0 }}>★{s.avgRating}</span>}
                        </button>
                      )
                    })}
                  </div>
                )}
              </div>
            </div>

            {/* Modal footer */}
            <div style={{ padding: '16px 24px', borderTop: `1px solid ${G.border}`, display: 'flex', alignItems: 'center', justifyContent: 'space-between', background: 'var(--bg)' }}>
              <div style={{ fontSize: 12.5, color: G.muted2, fontWeight: 500 }}>
                {(() => {
                  const total = activeModalFilterCount + statusFilter.length
                  return total === 0
                    ? 'No filters applied'
                    : <><strong style={{ color: G.ink }}>{total}</strong> filter{total > 1 ? 's' : ''} active · <strong style={{ color: G.ink }}>{filtered.length}</strong> result{filtered.length !== 1 ? 's' : ''}</>
                })()}
              </div>
              <div style={{ display: 'flex', gap: 10 }}>
                <button onClick={() => { setRankFilter([]); setDepartmentFilter([]); setEducationFilter([]); setCoordinatorFilter(''); setSpecializationFilter([]); setSpecQuery(''); setSpecMinRating(0) }}
                  style={{ padding: '8px 18px', borderRadius: 10, border: `1.5px solid ${G.border}`, background: 'var(--surface)', color: G.muted, fontSize: 12.5, fontWeight: 600, cursor: 'pointer', fontFamily: "'Inter',sans-serif", transition: 'all .15s' }}
                  onMouseEnter={e => { e.currentTarget.style.background = 'rgba(220, 38, 38, 0.05)'; e.currentTarget.style.borderColor = 'rgba(220, 38, 38, 0.25)'; e.currentTarget.style.color = '#EF4444' }}
                  onMouseLeave={e => { e.currentTarget.style.background = 'var(--surface)'; e.currentTarget.style.borderColor = G.border; e.currentTarget.style.color = G.muted }}>
                  Reset All
                </button>
                <button onClick={() => setFilterModalOpen(false)}
                  style={{ padding: '8px 22px', borderRadius: 10, border: 'none', background: `linear-gradient(135deg,${G.meadow},${G.meadowDeep})`, color: '#fff', fontSize: 12.5, fontWeight: 600, cursor: 'pointer', fontFamily: "'Inter',sans-serif", boxShadow: '0 4px 14px rgba(0,0,0,0.3)', transition: 'all .15s' }}
                  onMouseEnter={e => { e.currentTarget.style.transform = 'translateY(-1px)'; e.currentTarget.style.boxShadow = '0 6px 20px rgba(0,0,0,0.4)' }}
                  onMouseLeave={e => { e.currentTarget.style.transform = 'none'; e.currentTarget.style.boxShadow = '0 4px 14px rgba(0,0,0,0.3)' }}>
                  Show {filtered.length} Results
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* ── Bulk action bar ── */}
      {selectedCount > 0 && (
        <div style={{ background: `linear-gradient(135deg,${G.meadowDeep},${G.inkMid})`, borderRadius: 12, padding: '10px 18px', marginBottom: 16, display: 'flex', alignItems: 'center', gap: 12, boxShadow: '0 6px 20px rgba(0,0,0,0.28)', animation: 'slideIn 0.18s ease' }}>
          <div style={{ width: 28, height: 28, borderRadius: 8, background: 'rgba(255,255,255,0.14)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
            <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="2.5"><polyline points="20 6 9 17 4 12"/></svg>
          </div>
          <span style={{ fontSize: 13, fontWeight: 600, color: '#fff', flex: 1 }}>{selectedCount} faculty member{selectedCount !== 1 ? 's' : ''} selected</span>
          <button onClick={() => setSelected(new Set())} style={{ background: 'rgba(255,255,255,0.1)', border: '1px solid rgba(255,255,255,0.2)', color: 'rgba(255,255,255,0.85)', fontSize: 12, padding: '5px 14px', borderRadius: 8, cursor: 'pointer', fontFamily: "'Inter',sans-serif" }}>Deselect all</button>
          {viewTab === 'active' && (
            <button onClick={handleBulkArchive} disabled={busy} style={{ background: 'linear-gradient(135deg,#D97706,#B45309)', border: 'none', color: '#fff', fontSize: 12, fontWeight: 600, padding: '5px 15px', borderRadius: 8, display: 'flex', alignItems: 'center', gap: 5, cursor: 'pointer', fontFamily: "'Inter',sans-serif", opacity: busy ? 0.7 : 1 }}>
              <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"><path d="M21 8v13H3V8"/><path d="M23 3H1v5h22z"/><line x1="10" y1="12" x2="14" y2="12"/></svg>
              Archive {selectedCount}
            </button>
          )}
          {viewTab === 'archived' && (
            <>
              <button onClick={handleBulkUnarchive} disabled={busy} style={{ background: `linear-gradient(135deg,${G.meadow},${G.meadowDeep})`, border: 'none', color: '#fff', fontSize: 12, fontWeight: 600, padding: '5px 15px', borderRadius: 8, display: 'flex', alignItems: 'center', gap: 5, cursor: 'pointer', fontFamily: "'Inter',sans-serif", opacity: busy ? 0.7 : 1 }}>
                <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"><polyline points="1 4 1 10 7 10"/><path d="M3.51 15a9 9 0 1 0 .49-3.5"/></svg>
                Restore {selectedCount}
              </button>
              <button onClick={handleBulkDelete} disabled={busy} style={{ background: '#EF4444', border: 'none', color: '#fff', fontSize: 12, fontWeight: 600, padding: '5px 15px', borderRadius: 8, display: 'flex', alignItems: 'center', gap: 5, cursor: 'pointer', fontFamily: "'Inter',sans-serif", opacity: busy ? 0.7 : 1 }}>
                <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"><polyline points="3 6 5 6 21 6"/><path d="M19 6l-1 14a2 2 0 0 1-2 2H8a2 2 0 0 1-2-2L5 6"/><path d="M10 11v6M14 11v6"/></svg>
                Delete {selectedCount}
              </button>
            </>
          )}
        </div>
      )}

      {/* ════════════════════════════════════════════
          CONTENT — grid or list
      ════════════════════════════════════════════ */}
      <div id="tour-faculty-list-anchor" style={{ position: 'relative' }}>
        <div id="tour-faculty-list">
          {loading ? (
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(260px, 1fr))', gap: 14, animation: 'fadeIn 0.25s ease' }}>
              {Array.from({ length: 8 }).map((_, i) => (
                <div key={i} style={{ background: 'var(--surface)', borderRadius: 12, border: `1.5px solid ${G.border}`, overflow: 'hidden', display: 'flex', flexDirection: 'column' }}>
                  {/* Header — mirrors the green card header */}
                  <div style={{ background: `linear-gradient(135deg,${G.meadow},${G.meadowDeep})`, padding: '14px 14px 12px', flex: 1, position: 'relative' }}>
                    {/* Name */}
                    <Skel w="68%" h={13} r={4} style={{ background: 'rgba(255,255,255,0.28)' }}/>
                    {/* Academic rank */}
                    <Skel w="48%" h={9} r={3} style={{ marginTop: 5, background: 'rgba(255,255,255,0.18)' }}/>
                    {/* Department */}
                    <Skel w="58%" h={8} r={3} style={{ marginTop: 3, background: 'rgba(255,255,255,0.12)' }}/>
                    {/* Status pill */}
                    <Skel w={72} h={18} r={99} style={{ marginTop: 12, background: 'rgba(255,255,255,0.18)' }}/>
                    {/* Checkbox placeholder */}
                    <div style={{ position: 'absolute', top: 12, right: 12, width: 16, height: 16, borderRadius: 4, background: 'rgba(255,255,255,0.18)' }}/>
                  </div>
                  {/* Footer — mirrors the white bottom */}
                  <div style={{ padding: '9px 14px 0', flexShrink: 0 }}>
                    <Skel w={80} h={11} r={4}/>
                  </div>
                  <div style={{ height: 8 }}/>
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
                {viewTab === 'archived'
                  ? (archivedFaculty.length === 0 ? 'No archived faculty' : 'No matches')
                  : (activeFaculty.length === 0 ? 'No faculty yet' : 'No faculty match your filters')}
              </div>
              <div style={{ fontSize: 12.5, color: G.muted2, marginBottom: hasAnyFilter ? 14 : 0 }}>
                {viewTab === 'archived'
                  ? (archivedFaculty.length === 0 ? 'Archived members appear here.' : 'Try adjusting your filters.')
                  : (activeFaculty.length === 0 ? 'Add your first faculty member to get started.' : 'Try adjusting your search or filters.')}
              </div>
              {hasAnyFilter && (
                <button onClick={resetAllFilters} style={{ padding: '8px 18px', borderRadius: 9, border: 'none', background: G.meadow, color: '#fff', fontSize: 12.5, fontWeight: 600, cursor: 'pointer', fontFamily: "'Inter',sans-serif" }}>
                  Clear all filters
                </button>
              )}
            </div>
          ) : viewMode === 'list' ? (
            <FacultyTable
              faculty={filtered}
              selected={selected}
              selectionMode={selectionMode}
              viewTab={viewTab}
              onSelect={toggleOne}
              onSelectAll={toggleSelectAll}
              allSelected={allSelected}
              someSelected={someSelected}
              onArchive={handleCardArchive}
              onUnarchive={handleCardUnarchive}
              onDelete={handleCardDelete}
              navigate={navigate}
            />
          ) : (
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(260px, 1fr))', gap: 14, animation: 'fadeIn 0.25s ease' }}>
              {filtered.map(f => (
                <FacultyCard key={f.id} faculty={f} courseTitleMap={courseTitleMap} selected={selected.has(f.id)} selectionMode={selectionMode}
                  viewTab={viewTab}
                  onSelect={() => toggleOne(f.id)}
                  onArchive={() => handleCardArchive(f.id, f.name)}
                  onUnarchive={() => handleCardUnarchive(f.id, f.name)}
                  onDelete={() => handleCardDelete(f.id, f.name)}
                  onClick={() => { if (selectionMode) { toggleOne(f.id); return } navigate(`/dashboard/faculty/${f.id}`) }}
                />
              ))}
            </div>
          )}
        </div>
      </div>

      {!loading && filtered.length > 0 && (
        <div style={{ marginTop: 18, fontSize: 12, color: G.muted2, textAlign: 'right' }}>
          Showing {filtered.length} of {tabFaculty.length} {viewTab} faculty
          {selectedCount > 0 && <span style={{ marginLeft: 8, color: 'var(--meadow-text-hover)', fontWeight: 600 }}>· {selectedCount} selected</span>}
        </div>
      )}

      {showImport && <ImportFacultyModal onClose={() => setShowImport(false)} onImported={() => { load(); setShowImport(false); toast('Faculty imported', 'success') }} courses={Object.entries(courseTitleMap).filter(([k]) => !k.includes(" ")).map(([k, v]) => ({ courseCode: k, title: v }))} />}
      {pendingAction && <ActionModal mode={pendingAction.mode} name={pendingAction.name} count={pendingAction.bulk ? pendingAction.count : 1} busy={busy} onConfirm={handleConfirm} onCancel={() => { if (!busy) setPendingAction(null) }}/>}
      <ToastContainer toasts={toasts}/>
    </div>
  )
}