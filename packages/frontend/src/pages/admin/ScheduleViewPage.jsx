import { useEffect, useState, useMemo, useCallback } from 'react'
import { useParams, useLocation } from 'react-router-dom'
import { useScheduleStore } from '../../store/scheduleStore'
import { getSchedules, getRooms, getFaculty, saveSchedule, finalizeSchedule, unfinalizeSchedule, updateScheduleMeta, getSubmittedSchedule } from '../../services/api'
import { buildConflictMap, DAYS, getEventId, getMergedIds } from '../../components/ScheduleView/svHelpers'
import { TV, ConflictSummaryBar, Toast, FilterButton, FilterRow, PendingChangesBar, ProgramLegend, ModalOverlay, ModalHeader } from '../../components/ScheduleView/svPrimitives'
import { useFilters, useDragDrop } from '../../components/ScheduleView/svHooks'
import { FilterModal, FacultyFilterModal, RoomFilterModal, OverrideConfirmModal } from '../../components/ScheduleView/FilterModals'
import TimeGrid from '../../components/ScheduleView/TimeGrid'
import SessionModal from '../../components/ScheduleView/SessionModal'
import VersionHistoryModal from '../../components/VersionHistoryModal'
import { exportScheduleToExcel } from '../../utils/exportScheduleToExcel'
import { exportAvailableRoomsToExcel } from '../../utils/exportAvailableRoomsToExcel'
import { computeRoomAvailability } from '../../utils/roomAvailability'
import scheduleImage from '../../assets/SCHEDULE.png'


/* ── Page-scoped styles ────────────────────────────────────────────────────── */
if (!document.getElementById('sv-page-style')) {
  const s = document.createElement('style')
  s.id = 'sv-page-style'
  s.textContent = `
    @keyframes svSlideIn   { from{opacity:0;transform:translateY(6px)} to{opacity:1;transform:translateY(0)} }
    @keyframes svFadeIn    { from{opacity:0} to{opacity:1} }
    @keyframes svSpinAnim  { to{transform:rotate(360deg)} }
    @keyframes spin        { to{transform:rotate(360deg)} }
    @keyframes svPulse     { 0%,100%{opacity:1} 50%{opacity:.35} }
    @keyframes svShimmer   { 0%{background-position:-400px 0} 100%{background-position:400px 0} }

    .sv-day-btn {
      padding:6px 13px; border-radius:20px; font-size:12px; font-weight:500;
      cursor:pointer; border:1px solid var(--border); background: var(--surface); color:var(--muted);
      transition:all .15s; font-family:'Inter',sans-serif; white-space:nowrap;
    }
    .sv-day-btn:hover  { background:var(--hover); color:var(--ink); }
    .sv-day-btn.active {
      background:var(--meadow); color:#fff;
      border-color:transparent; box-shadow:0 2px 8px var(--meadow-border);
    }

    .sv-icon-btn {
      display:inline-flex; align-items:center; justify-content:center;
      width:30px; height:30px; border-radius:8px; border:1px solid var(--border);
      background: var(--surface); color:var(--muted); cursor:pointer; transition:all .15s;
      flex-shrink:0; padding:0;
    }
    .sv-icon-btn:hover:not(:disabled)  { background:var(--meadow-soft); color:var(--meadow); border-color:var(--meadow-border); }
    .sv-icon-btn.active { background:var(--meadow-soft); border-color:var(--mint); color:var(--ink); }

    .sv-search {
      padding:7px 12px 7px 32px; border-radius:20px; border:1px solid var(--border);
      font-size:12.5px; font-family:'Inter',sans-serif; color:#0E2A20;
      background: var(--surface); outline:none; width:190px; transition:all .15s;
    }
    .sv-search:focus { border-color:var(--mint); box-shadow:0 0 0 3px rgba(0,0,0,.12); width:220px; }
    .sv-search::placeholder { color:#6B8C7A; }

    .sv-chip {
      padding:3px 10px; border-radius:20px; font-size:11px; cursor:pointer;
      border:1px solid var(--border); background: var(--surface); color:var(--muted); font-weight:400;
      font-family:'Inter',sans-serif; transition:all .15s; white-space:nowrap;
    }
    .sv-chip:hover  { background:var(--hover); color:var(--ink); border-color:var(--meadow-border); }
    .sv-chip.active { border-color:var(--mint); background:var(--meadow-soft); color:#0E2A20; font-weight:600; }

    .sv-sched-wrap { position:relative; display:inline-flex; align-items:center; }
    .sv-sched-select {
      appearance:none; -webkit-appearance:none;
      padding:6px 28px 6px 30px; border-radius:9px;
      border:1.5px solid var(--border); font-size:12px;
      font-family:'Inter',sans-serif; color:#0E2A20;
      background: var(--surface); cursor:pointer; outline:none;
      font-weight:500; transition:border-color .15s, box-shadow .15s;
      min-width:140px; max-width:210px;
    }
    .sv-sched-select:hover  { border-color:var(--meadow-border); }
    .sv-sched-select:focus  { border-color:var(--mint); box-shadow:0 0 0 3px rgba(0,0,0,.12); }
    .sv-sched-select:disabled { opacity:.6; cursor:default; }

    .sv-save-btn {
      display:inline-flex; align-items:center; gap:5px;
      padding:6px 10px; border-radius:9px; border:1.5px solid var(--border);
      background: var(--surface); color:#0E2A20; font-size:12px; font-weight:600;
      font-family:'Inter',sans-serif; cursor:pointer; transition:all .2s;
      white-space:nowrap; flex-shrink:0;
    }
    .sv-save-btn:hover:not(:disabled) { background:var(--meadow-soft); border-color:var(--mint); }
    .sv-save-btn:disabled { opacity:.65; cursor:default; }
    .sv-save-btn.saved  { background:#ecfdf5; border-color:var(--mint); color:var(--meadow); }
    .sv-save-btn.failed { background:#fff8f8; border-color:#fca5a5; color:#dc2626; }
    .sv-save-btn.unsaved { background:#fffbeb; border-color:#fde68a; color:#d97706; }

    .sv-view-group { display:flex; border:1px solid var(--border); border-radius:8px; overflow:hidden; background: var(--surface); }
    .sv-view-btn {
      display:flex; align-items:center; gap:5px; padding:5px 11px;
      font-size:11.5px; font-family:'Inter',sans-serif;
      border:none; cursor:pointer; transition:all .15s; white-space:nowrap;
    }
    .sv-view-btn.active { background:var(--meadow-soft); color:#0E2A20; font-weight:700; }
    .sv-view-btn:not(.active) { background:transparent; color:var(--muted); font-weight:400; }
    .sv-view-btn:not(.active):hover { background:var(--hover); color:var(--ink); }

    .sv-shimmer {
      background: linear-gradient(90deg,var(--hover) 25%,var(--border) 50%,var(--hover) 75%);
      background-size: 400px 100%;
      animation: svShimmer 1.2s ease-in-out infinite;
      border-radius:6px;
    }

    .sv-stats-row {
      display:flex; background: var(--surface); border:1px solid var(--border);
      border-radius:10px; overflow:hidden;
      box-shadow:0 1px 4px rgba(0,0,0,.06);
      margin-bottom:14px;
    }
    .sv-stat-cell {
      flex:1; padding:9px 14px; min-width:0;
      border-right:1px solid var(--border);
      display:flex; flex-direction:column; gap:1px;
    }
    .sv-stat-cell:last-child { border-right:none; }

    .sv-save-status-saved { background:#ecfdf5; border-color:var(--mint); }
    .sv-save-status-saving { background:#fffbeb; border-color:#fde68a; }
    .sv-save-status-unsaved { background:#fef2f2; border-color:#fecaca; }
    .sv-save-status-ready { background:#f9fafb; border-color:#d1d5db; }
    
    /* Smart save button styles */
    .sv-smart-save-btn {
      display: flex;
      align-items: center;
      gap: 6px;
      padding: 6px 10px;
      border-radius: 9px;
      border: 1.5px solid;
      font-family: 'Inter', sans-serif;
      font-size: 12px;
      font-weight: 600;
      cursor: pointer;
      transition: all .2s;
      white-space: nowrap;
      flex-shrink: 0;
      min-width: auto;
    }
    .sv-smart-save-btn:disabled {
      opacity: .65;
      cursor: default;
    }
    .sv-smart-save-btn.sv-save-status-saved {
      background: #ecfdf5;
      border-color: var(--mint);
      color: var(--meadow);
    }
    .sv-smart-save-btn.sv-save-status-saving {
      background: #fffbeb;
      border-color: #fde68a;
      color: #d97706;
    }
    .sv-smart-save-btn.sv-save-status-unsaved {
      background: #fef2f2;
      border-color: #fecaca;
      color: #dc2626;
    }
    .sv-smart-save-btn.sv-save-status-ready {
      background: var(--surface);
      border-color: #d1d5db;
      color: var(--muted);
    }
    .sv-smart-save-btn:hover:not(:disabled) {
      transform: translateY(-1px);
      box-shadow: 0 4px 12px rgba(0,0,0,0.1);
    }
    .sv-smart-save-icon {
      flex-shrink: 0;
      display: flex;
      align-items: center;
    }
    .sv-smart-save-text {
      display: flex;
      flex-direction: column;
      gap: 1px;
      min-width: 0;
    }
    .sv-smart-save-label {
      font-weight: 600;
      line-height: 1;
    }
    .sv-smart-save-subtitle {
      font-size: 10px;
      opacity: 0.7;
      font-weight: 500;
      line-height: 1;
    }
    
    /* Version History Modal */
    .sv-version-modal {
      position: fixed;
      inset: 0;
      background: rgba(0,0,0,0.5);
      display: flex;
      align-items: center;
      justify-content: center;
      z-index: 1000;
      animation: svFadeIn 0.2s ease;
    }
    .sv-version-content {
      background: white;
      border-radius: 12px;
      width: 90%;
      max-width: 400px;
      max-height: 80vh;
      display: flex;
      flex-direction: column;
      box-shadow: 0 20px 40px rgba(0,0,0,0.2);
      animation: svSlideIn 0.25s ease;
    }
    .sv-version-header {
      display: flex;
      align-items: center;
      justify-content: space-between;
      padding: 16px 20px;
      border-bottom: 1px solid #e5e7eb;
    }
    .sv-version-header h3 {
      margin: 0;
      font-size: 16px;
      font-weight: 700;
      color: var(--ink);
    }
    .sv-version-close {
      background: none;
      border: none;
      font-size: 24px;
      cursor: pointer;
      color: #6b7280;
      padding: 4px;
      line-height: 1;
    }
    .sv-version-close:hover {
      color: var(--ink);
    }
    .sv-version-list {
      overflow-y: auto;
      flex: 1;
      padding: 8px 20px 20px;
    }
    .sv-version-item {
      display: flex;
      align-items: center;
      gap: 12px;
      padding: 12px 0;
      border-bottom: 1px solid #f3f4f6;
    }
    .sv-version-item:last-child {
      border-bottom: none;
    }
    .sv-version-item.current {
      background: rgba(34, 197, 94, 0.05);
      margin: 0 -20px 8px;
      padding: 12px 20px;
      border-radius: 8px;
      border-bottom: 1px solid var(--meadow-border);
    }
    .sv-version-badge {
      background: #f3f4f6;
      color: #6b7280;
      padding: 4px 8px;
      border-radius: 6px;
      font-size: 11px;
      font-weight: 700;
      font-family: monospace;
      flex-shrink: 0;
    }
    .sv-version-item.current .sv-version-badge {
      background: var(--meadow);
      color: white;
    }
    .sv-version-details {
      flex: 1;
      min-width: 0;
    }
    .sv-version-label {
      font-size: 13px;
      font-weight: 600;
      color: var(--ink);
    }
    .sv-version-meta {
      font-size: 11px;
      color: #6b7280;
      margin-top: 2px;
    }
  `
  document.head.appendChild(s)
}

/* ── Inline spinner ──────────────────────────────────────────────────────── */
function Spinner({ full = false }) {
  const svg = (
    <svg
      width={full ? 30 : 14} height={full ? 30 : 14}
      viewBox="0 0 24 24" fill="none"
      stroke={full ? 'var(--meadow)' : TV.deep} strokeWidth="2.2"
      style={{ animation: 'svSpinAnim .75s linear infinite', flexShrink: 0 }}
    >
      <path d="M21 12a9 9 0 1 1-6.219-8.56"/>
    </svg>
  )
  if (!full) return svg
  return (
    <div style={{ display:'flex', flexDirection:'column', alignItems:'center', justifyContent:'center', height:'100%', minHeight:300, gap:12 }}>
      {svg}
      <span style={{ fontSize:13, color:TV.muted, fontFamily:'Inter,sans-serif' }}>Loading schedule…</span>
    </div>
  )
}

/* ── Empty state ─────────────────────────────────────────────────────────── */
function EmptyState({ hasFilters, onClear }) {
  return (
    <div style={{ display:'flex', flexDirection:'column', alignItems:'center', justifyContent:'center', height:280, gap:12 }}>
      <div style={{ display:'flex', alignItems:'center', justifyContent:'center', marginBottom: 8 }}>
        <img src={scheduleImage} alt="Empty Sessions" style={{ width: 80, height: 'auto', opacity: 0.9 }} />
      </div>
      <div style={{ textAlign:'center' }}>
        <p style={{ fontSize:13.5, fontWeight:600, color:TV.text, marginBottom:4 }}>No sessions found</p>
        <p style={{ fontSize:12, color:TV.muted }}>
          {hasFilters ? 'Try adjusting your filters.' : 'No events scheduled for this day.'}
        </p>
      </div>
      {hasFilters && (
        <button onClick={onClear} style={{ padding:'7px 16px', fontSize:12, fontWeight:600, borderRadius:8, border:`1px solid ${TV.border}`, background: 'var(--surface)', color:TV.deep, cursor:'pointer', fontFamily:'Inter,sans-serif' }}>
          Clear Filters
        </button>
      )}
    </div>
  )
}

/* ── Stats row ───────────────────────────────────────────────────────────── */
function StatsRow({ items }) {
  return (
    <div className="sv-stats-row">
      {items.map(s => (
        <div key={s.label} className="sv-stat-cell">
          <span style={{ fontSize:9, fontWeight:700, color:TV.muted, textTransform:'uppercase', letterSpacing:'.8px', whiteSpace:'nowrap' }}>
            {s.label}
          </span>
          <div style={{ display:'flex', alignItems:'baseline', gap:4 }}>
            <span style={{ fontSize:19, fontWeight:800, color:s.accent || TV.deep, lineHeight:1.15 }}>
              {s.value}
            </span>
            {s.sub && (
              <span style={{ fontSize:9.5, color:TV.muted, whiteSpace:'nowrap' }}>{s.sub}</span>
            )}
          </div>
        </div>
      ))}
    </div>
  )
}

/* ── Schedule dropdown ───────────────────────────────────────────────────── */
function ScheduleDropdown({ names, activeName, loading, initLoading, onChange, schedulesMeta }) {
  // Always work with plain strings to avoid [object Object] key errors
  const toStr = (n) => typeof n === 'string' ? n : (n?.name || n?.id || String(n))

  const getLabel = (n) => {
    const sName = toStr(n)
    const meta = (schedulesMeta || []).find(s => (s.id || s.name) === sName)
    // Show the friendly name (meta.name), not the raw id/document key that
    // sName resolves to for master-finalized schedules -- otherwise the
    // dropdown shows a uuid instead of e.g. "1st Semester 2025-2026 - Final".
    const label = meta?.name || sName
    return meta?.finalized ? `${label} ★` : label
  }
  return (
    <div className="sv-sched-wrap">
      <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke={TV.muted} strokeWidth="2"
        style={{ position:'absolute', left:11, pointerEvents:'none', zIndex:1 }}>
        <rect x="3" y="4" width="18" height="18" rx="2"/>
        <line x1="3" y1="10" x2="21" y2="10"/>
        <line x1="16" y1="2" x2="16" y2="6"/>
        <line x1="8" y1="2" x2="8" y2="6"/>
      </svg>
      <select
        className="sv-sched-select"
        value={activeName || ''}
        onChange={e => e.target.value && onChange(e.target.value)}
        disabled={loading || initLoading}
      >
        {initLoading ? (
          <option value="">Loading…</option>
        ) : (
          <>
            {!activeName && <option value="">— Select schedule —</option>}
            {names.map(n => {
              const sName = toStr(n)
              return <option key={sName} value={sName}>{getLabel(n)}</option>
            })}
          </>
        )}
      </select>
      <div style={{ position:'absolute', right:10, pointerEvents:'none', display:'flex', alignItems:'center' }}>
        {(loading || initLoading) ? <Spinner /> : (
          <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke={TV.muted} strokeWidth="2.2">
            <polyline points="6 9 12 15 18 9"/>
          </svg>
        )}
      </div>
    </div>
  )
}

/* ── Smart save component with integrated status ──────────────────────────── */
function SmartSaveButton({ 
  state, 
  onClick, 
  hasUnsavedChanges, 
  scheduleMeta, 
  activeName,
  className = ""
}) {
  const getContent = () => {
    switch (state) {
      case 'saving':
        return {
          icon: <Spinner />,
          label: 'Saving…',
          subtitle: null,
          bgClass: 'sv-save-status-saving',
          disabled: true
        }
      case 'saved':
        if (!hasUnsavedChanges) {
          const lastSaved = scheduleMeta?.savedAt
          const timeAgo = lastSaved ? formatTimeAgo(lastSaved) : null
          return {
            icon: <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"><polyline points="20 6 9 17 4 12"/></svg>,
            label: 'Saved',
            subtitle: timeAgo || null,
            bgClass: 'sv-save-status-saved',
            disabled: false
          }
        }
        // Fall through to unsaved if there are changes
      case 'idle':
      default:
        if (hasUnsavedChanges) {
          return {
            icon: <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M19 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h11l5 5v11a2 2 0 0 1-2 2z"/><polyline points="17 21 17 13 7 13 7 21"/><polyline points="7 3 7 8 15 8"/></svg>,
            label: 'Save Changes',
            subtitle: 'Click to save',
            bgClass: 'sv-save-status-unsaved',
            disabled: false
          }
        } else {
          // If we're viewing a restored preview, the doc's `version` field is
          // stale (it still reflects the pre-restore save) — show the
          // version that's actually loaded instead.
          const version = scheduleMeta?.restoredFromVersion ?? scheduleMeta?.version
          const lastSaved = scheduleMeta?.restoredAt ?? scheduleMeta?.savedAt
          const timeAgo = lastSaved ? formatTimeAgo(lastSaved) : null
          const sub = [version > 1 ? `v${version}` : null, timeAgo].filter(Boolean).join(' · ')
          return {
            icon: <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M19 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h11l5 5v11a2 2 0 0 1-2 2z"/><polyline points="17 21 17 13 7 13 7 21"/><polyline points="7 3 7 8 15 8"/></svg>,
            label: 'Save',
            subtitle: sub || null,
            bgClass: 'sv-save-status-ready',
            disabled: false
          }
        }
    }
  }

  const { icon, label, subtitle, bgClass, disabled } = getContent()

  return (
    <button
      className={`sv-smart-save-btn ${bgClass} ${className}`}
      onClick={onClick}
      disabled={disabled}
      title={hasUnsavedChanges ? 'You have unsaved changes' : 'Save schedule'}
    >
      <div className="sv-smart-save-icon">{icon}</div>
      <div className="sv-smart-save-text">
        <div className="sv-smart-save-label">{label}</div>
        {subtitle && <div className="sv-smart-save-subtitle">{subtitle}</div>}
      </div>
    </button>
  )
}

/* ── Version History Component ──────────────────────────────────────────── */
function VersionHistory({ versionHistory, currentVersion, onClose }) {
  if (!versionHistory || versionHistory.length === 0) {
    return (
      <div className="sv-version-modal">
        <div className="sv-version-content">
          <div className="sv-version-header">
            <h3>Version History</h3>
            <button onClick={onClose} className="sv-version-close">×</button>
          </div>
          <div style={{ padding: '20px', textAlign: 'center', color: TV.muted }}>
            No previous versions found
          </div>
        </div>
      </div>
    )
  }

  return (
    <div className="sv-version-modal" onClick={onClose}>
      <div className="sv-version-content" onClick={e => e.stopPropagation()}>
        <div className="sv-version-header">
          <h3>Version History</h3>
          <button onClick={onClose} className="sv-version-close">×</button>
        </div>
        <div className="sv-version-list">
          {/* Current version */}
          <div className="sv-version-item current">
            <div className="sv-version-badge">v{currentVersion}</div>
            <div className="sv-version-details">
              <div className="sv-version-label">Current Version</div>
              <div className="sv-version-meta">Active • In memory</div>
            </div>
          </div>
          
          {/* Previous versions */}
          {versionHistory.map((version, index) => (
            <div key={index} className="sv-version-item">
              <div className="sv-version-badge">v{version.version}</div>
              <div className="sv-version-details">
                <div className="sv-version-label">
                  Saved {formatTimeAgo(version.savedAt)}
                </div>
                <div className="sv-version-meta">
                  {new Date(version.savedAt).toLocaleString('en-PH', { timeZone:'Asia/Manila', month:'short', day:'numeric', year:'numeric', hour:'numeric', minute:'2-digit', hour12:true })}
                  {version.eventCount ? ` · ${version.eventCount} events` : ''}
                  {version.user ? ` · ${version.user}` : ''}
                </div>
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  )
}
function formatTimeAgo(dateInput) {
  if (!dateInput) return null
  // Always parse from the raw value — backend sends UTC ISO strings
  const date = typeof dateInput === 'string' ? new Date(dateInput) : dateInput
  const diff = Date.now() - date.getTime()
  const seconds = Math.floor(diff / 1000)
  const minutes = Math.floor(diff / (1000 * 60))
  const hours   = Math.floor(diff / (1000 * 60 * 60))
  const days    = Math.floor(diff / (1000 * 60 * 60 * 24))

  if (seconds < 10) return 'just now'
  if (seconds < 60) return `${seconds}s ago`
  if (minutes === 1) return '1 min ago'
  if (minutes < 60) return `${minutes}m ago`
  if (hours === 1)  return '1 hr ago'
  if (hours < 24)   return `${hours}h ago`
  if (days === 1)   return '1 day ago'
  if (days < 7)     return `${days}d ago`
  return date.toLocaleDateString('en-PH', { timeZone: 'Asia/Manila', month: 'short', day: 'numeric' })
}

/* ── Export menu button — one button, choice of what to export ─────────────── */
function ExportMenuButton({ onExportSchedule, onExportRooms, disabled }) {
  const [open, setOpen] = useState(false)
  const itemStyle = {
    display: 'flex', alignItems: 'center', gap: 8, width: '100%',
    padding: '9px 14px', fontSize: 12.5, fontWeight: 600, color: 'var(--ink)',
    background: 'var(--surface)', border: 'none', cursor: 'pointer',
    fontFamily: 'Inter, sans-serif', textAlign: 'left',
  }
  return (
    <div style={{ position: 'relative', flexShrink: 0 }}>
      <button
        className="sv-save-btn"
        onClick={() => setOpen(o => !o)}
        disabled={disabled}
        title="Export"
      >
        <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
          <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/>
          <polyline points="7 10 12 15 17 10"/>
          <line x1="12" y1="15" x2="12" y2="3"/>
        </svg>
        Export
        <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"
          style={{ marginLeft: 1, transform: open ? 'rotate(180deg)' : 'none', transition: 'transform .15s' }}>
          <polyline points="6 9 12 15 18 9"/>
        </svg>
      </button>
      {open && (
        <>
          {/* Click-outside catcher */}
          <div onClick={() => setOpen(false)} style={{ position: 'fixed', inset: 0, zIndex: 998 }} />
          <div style={{
            position: 'absolute', top: 'calc(100% + 6px)', right: 0, zIndex: 999,
            background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: 10,
            boxShadow: '0 12px 32px rgba(0,0,0,.16)', minWidth: 210, overflow: 'hidden',
          }}>
            <button
              onClick={() => { setOpen(false); onExportSchedule() }}
              style={{ ...itemStyle, borderBottom: '1px solid #EEF3F0' }}
              onMouseEnter={e => e.currentTarget.style.background = 'var(--meadow-soft)'}
              onMouseLeave={e => e.currentTarget.style.background = 'var(--surface)'}
            >
              <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/><polyline points="7 10 12 15 17 10"/><line x1="12" y1="15" x2="12" y2="3"/>
              </svg>
              Schedule (.xlsx)
            </button>
            <button
              onClick={() => { setOpen(false); onExportRooms() }}
              style={itemStyle}
              onMouseEnter={e => e.currentTarget.style.background = 'var(--meadow-soft)'}
              onMouseLeave={e => e.currentTarget.style.background = 'var(--surface)'}
            >
              <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <path d="M3 21h18"/><path d="M5 21V7l8-4v18"/><path d="M19 21V11l-6-4"/>
                <path d="M9 9v.01"/><path d="M9 12v.01"/><path d="M9 15v.01"/><path d="M9 18v.01"/>
              </svg>
              Available Rooms (.xlsx)
            </button>
          </div>
        </>
      )}
    </div>
  )
}

/* ── Other-dept course filter ───────────────────────────────────────────────────────────────────────────── */
// GEC, MAT, NSTP, PATHFIT, PE sessions are managed by other departments and
// will always be TBA — exclude them from unassigned counts to avoid false alarms.
const _SV_OTHER_PREFIXES = ["GEC", "MAT", "MATH", "NSTP", "PATHFIT", "PE"]
function svIsOtherDept(courseCode = "") {
  const upper = courseCode.toUpperCase().trim()
  return _SV_OTHER_PREFIXES.some(p => upper.startsWith(p))
}

/* ════════════════════════════════════════════════════════════════════════════
   Main page
   ════════════════════════════════════════════════════════════════════════════ */
import { useTour } from '../../hooks/useTour.jsx'

const TOUR_SEEN_KEY = 'adminScheduleView_tourSeen'
function isOnboardingCompleted() {
  try { return localStorage.getItem(TOUR_SEEN_KEY) === '1' } catch { return true }
}
function markOnboardingCompleted() {
  try { localStorage.setItem(TOUR_SEEN_KEY, '1') } catch {}
}

export default function ScheduleViewPage({ isSubmittedView = false }) {
  const { name: urlName, id: urlId } = useParams()
  const location = useLocation()
  const { events:storeEvents, scheduleName:storeName, setEvents, setName } = useScheduleStore()

  

  

  const [localEvents,       setLocalEvents]   = useState(storeEvents)
  const [past,              setPast]          = useState([])
  const [future,            setFuture]        = useState([])
  const [masterRooms,       setMasterRooms]   = useState({ lecture:[], lab:[] })
  const [masterFacultyList, setMasterFaculty] = useState([])
  const [savedNames,        setSavedNames]    = useState([])
  const [schedulesMeta,     setSchedulesMeta] = useState([])
  const [activeName,        setActiveName]    = useState(storeName)
  const [isEditingName,     setIsEditingName] = useState(false)
  const [tempName,          setTempName]      = useState('')
  const [activeDay,         setActiveDay]     = useState('Monday')
  const [initLoading,       setInitLoading]   = useState(true)
  const [loading,           setLoading]       = useState(false)

  const { TourElement, startTour } = useTour('adminScheduleView', [
    {
      target: '#tour-sv-save',
      title: 'Saving & Schedule Actions',
      content: 'Switch between saved schedules from the dropdown, then Save here once you\'ve made changes. History shows past versions you can restore, the copy icon duplicates the whole schedule, and Export downloads it as Excel.',
      disableBeacon: true,
      placement: 'bottom',
    },
    {
      target: '#tour-sv-pending',
      title: 'Pending Changes & Auto-Save',
      content: 'Every drag-and-drop move is queued here first, not saved instantly. It auto-saves 5 seconds after your last move — or click Save Now to push immediately, or Revert All to undo every queued move and go back to the last saved state.',
      placement: 'bottom',
    },
    {
      target: '#tour-sv-tools',
      title: 'Search & Filters',
      content: 'Search by course, block, or faculty, or narrow the view by program, year, block, session type, faculty, or room. The Conflicts and Unassigned toggles further down isolate only the sessions that need attention.',
      disableBeacon: true,
      placement: 'bottom',
    },
    {
      target: '#tour-sv-days',
      title: 'Day Selector',
      content: 'The grid, filters, and conflict count only ever show one day at a time — switch days here. The small number on each button is how many sessions fall on that day given your current filters.',
      placement: 'bottom',
    },
    {
      target: '#tour-sv-viewmode',
      title: 'Grid vs. List',
      content: 'Grid view lays sessions out spatially by room and time — best for drag-and-drop. List view is a sortable table of the same day\'s sessions — better for scanning or bulk review. Undo/Redo next to it steps back and forward through your recent moves.',
      placement: 'bottom',
    },
    {
      target: '#tour-sv-conflicts',
      title: 'Conflict Detection',
      content: 'This summarizes every Room, Section, and Faculty conflict on the active day. Conflicts are detected automatically whenever two sessions overlap in time — a shared room, a section double-booked in two places at once, or a faculty member assigned to two sessions simultaneously.',
      disableBeacon: true,
      placement: 'bottom',
    },
    {
      target: '#tour-sv-conflicts',
      title: 'Drag & Drop',
      content: 'Drag any session card to a different room column or time slot to reschedule it. If the drop would overlap another session, you\'re asked to confirm the override before it\'s applied — nothing conflicting saves silently. Dropping one lecture block directly onto its sibling block (same course, same year, different block) merges the two into one shared session instead of flagging a conflict.',
      placement: 'bottom',
      disableScrolling: true,
    },
    {
      target: '#tour-sv-conflicts',
      title: 'Session Cards & Details',
      content: 'Click any card to open its full detail modal — you can change its faculty, room, or time, review every conflict it\'s involved in, or batch-assign a faculty member across all of its merged/sibling sessions at once from there.',
      placement: 'bottom',
      disableScrolling: true,
    },
  ], !loading)
  const [saveState,         setSaveState]     = useState('idle')
  const [error,             setError]         = useState(null)
  const [selectedEvent,     setSelectedEvent] = useState(null)
  const [viewMode,          setViewMode]      = useState('grid')
  const [gridSize,          setGridSize]       = useState('normal') // 'compact' | 'normal' | 'maximize'
  const [maximizeDensity,   setMaximizeDensity] = useState('normal') // density inside fullscreen: 'compact' | 'normal'
  const [maximizeFilterOpen, setMaximizeFilterOpen] = useState(false)
  const [openModal,         setOpenModal]     = useState(null)
  const [filterMerged,      setFilterMerged]  = useState(false)
  const [filterLec,         setFilterLec]     = useState(false)
  const [filterLab,         setFilterLab]     = useState(false)
  const [showAvailableOnly, setShowAvailableOnly] = useState(false)

  /* ── Schedule metadata (AY / Semester / Finalized) ─────────────────────── */
  const [schedAY,           setSchedAY]       = useState('')
  const [schedSem,          setSchedSem]      = useState('')
  const [schedFinalized,    setSchedFinalized]= useState(false)
  const [scheduleMeta,      setScheduleMeta]  = useState(null)  // New: full metadata
  const [finalizingState,   setFinalizingState]= useState('idle') // 'idle' | 'working' | 'done' | 'error'
  const [showFinalizeModal, setShowFinalizeModal] = useState(false)
  const [metaDirty,         setMetaDirty]     = useState(false)
  const [hasUnsavedChanges, setHasUnsavedChanges] = useState(false)
  const [copyToast,         setCopyToast]   = useState(null)
  const [showVersionHistory, setShowVersionHistory] = useState(false)

  /* ── Handle passed metadata from SchedulerPage ─────────────────────────── */
  useEffect(() => {
    const passedMetadata = location.state
    if (passedMetadata && passedMetadata.academicYear && passedMetadata.semester) {
      // Set metadata from the passed state
      setSchedAY(passedMetadata.academicYear)
      setSchedSem(passedMetadata.semester)
      if (passedMetadata.scheduleName) {
        setActiveName(passedMetadata.scheduleName)
        setName(passedMetadata.scheduleName)
      }
      // If this schedule is marked as unsaved, set the flag
      setHasUnsavedChanges(passedMetadata.isUnsaved || false)
    }
  }, [location.state, setName])

  /* ── Bootstrap ──────────────────────────────────────────────────────────── */
  useEffect(() => {
    Promise.all([getRooms(), getFaculty()])
      .then(([r, f]) => { setMasterRooms(r); setMasterFaculty(f) })
      .catch(() => {})
    getSchedules()
      .then(r => {
        setSavedNames(r.names || [])
        setSchedulesMeta(r.schedules || [])
      })
      .catch(() => {})
      .finally(() => setInitLoading(false))
  }, [])

  /* ── Load schedule ──────────────────────────────────────────────────────── */
  async function loadSchedule(nameOrId, { force = false } = {}) {
    if (!nameOrId || (!force && nameOrId === activeName)) return
    setLoading(true); setError(null); setSaveState('idle')
    try {
      if (isSubmittedView) {
        const data = await getSubmittedSchedule(nameOrId)
        setLocalEvents(data.schedule || []); setEvents(data.schedule || [])
        setPast([]); setFuture([])
        setActiveName(data.name || nameOrId); setName(data.name || nameOrId)
        setSchedAY(data.academicYear || ''); setSchedSem(data.semester || '')
        setSchedFinalized(true); setMetaDirty(false)
        setHasUnsavedChanges(false)
        setScheduleMeta({ version: 1, eventCount: (data.schedule || []).length })
      } else {
        const data = await getSchedules(nameOrId)
        setLocalEvents(data.events); setEvents(data.events)
        setPast([]); setFuture([])
        setActiveName(nameOrId); setName(nameOrId)
        setSchedAY(data.academicYear || ''); setSchedSem(data.semester || '')
        setSchedFinalized(data.finalized || false); setMetaDirty(false)
        setHasUnsavedChanges(false) // Clear unsaved changes when loading
        
        // Set full metadata for the smart save component
        setScheduleMeta({
          version: data.version || 1,
          createdAt: data.createdAt,
          lastModified: data.lastModified,
          savedAt: data.savedAt,
          eventCount: data.eventCount || (data.events ? data.events.length : 0),
          versionHistory: data.versionHistory || [],
          restoredFromVersion: data.restoredFromVersion || null,
          restoredAt: data.restoredAt || null,
        })
      }
    } catch { setError(`Failed to load schedule.`) }
    finally   { setLoading(false) }
  }

  /* ── Auto-load from URL param ────────────────────────────────────────────── */
  useEffect(() => {
    if (!initLoading) {
      if (isSubmittedView && urlId) {
        loadSchedule(urlId, { force: true })
      } else if (!isSubmittedView && urlName) {
        const decoded = decodeURIComponent(urlName)
        loadSchedule(decoded, { force: true })
      }
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [initLoading, urlName, urlId, isSubmittedView])

  /* ── Save schedule ──────────────────────────────────────────────────────── */
  
  // Smart naming to prevent overwrites (copied from SchedulerPage)
  function generateUniqueName(baseName) {
    const existingNames = savedNames.map(s => typeof s === 'string' ? s : s.name)
    
    if (!existingNames.includes(baseName)) {
      return baseName
    }
    
    // Find next available number
    let counter = 1
    let uniqueName
    do {
      uniqueName = `${baseName} (${counter})`
      counter++
    } while (existingNames.includes(uniqueName))
    
    return uniqueName
  }

  async function handleSave() {
    if (!activeName || saveState === 'saving') return
    setSaveState('saving')

    try {
      // Moves made via drag-and-drop are queued locally and only reach the
      // backend's schedule_dict after a 5s auto-save or the PendingChangesBar's
      // own Save button (see useDragDrop in svHooks.js). This button creates a
      // new numbered version by snapshotting whatever is CURRENTLY in
      // schedule_dict server-side — so if there are still unsynced moves
      // sitting in dd.pendingOverrides, we have to push them first, or the
      // new version silently won't contain the moves you just made.
      if (dd.pendingOverrides && dd.pendingOverrides.size > 0) {
        const { failed } = await dd.saveAllOverrides()
        if (failed && failed.length > 0) {
          setSaveState('error')
          setTimeout(() => setSaveState('idle'), 2200)
          return
        }
      }

      // Check if this is an existing schedule or a new one
      const isExistingSchedule = savedNames.some(s => {
        const sName = typeof s === 'string' ? s : s.name
        return sName === activeName
      })
      
      let finalName = activeName.trim()
      
      // Only generate unique name if this is NOT an existing schedule
      // This allows updating existing schedules without creating duplicates
      if (!isExistingSchedule) {
        finalName = generateUniqueName(finalName)
      }
      
      const response = await saveSchedule(finalName, { academicYear: schedAY, semester: schedSem }, allEvents)
      
      // Update the name if it was auto-renamed (only for new schedules)
      if (finalName !== activeName && !isExistingSchedule) {
        setActiveName(finalName)
        setName(finalName)
        window.history.replaceState(null, '', `/dashboard/schedule/${encodeURIComponent(finalName)}`)
        setSavedNames(prev => [...prev, finalName])
      }

      // Reload the full schedule from backend so metadata + versionHistory
      // are always the authoritative backend copy — never duplicated client-side
      if (response) {
        const fresh = await getSchedules(finalName)
        setScheduleMeta({
          version:        fresh.version        || response.version || 1,
          createdAt:      fresh.createdAt,
          lastModified:   fresh.lastModified   || response.savedAt,
          savedAt:        fresh.savedAt        || response.savedAt,
          eventCount:     fresh.eventCount     || allEvents.length,
          versionHistory: fresh.versionHistory || [],
        })
      }

      setSaveState('saved')
      setHasUnsavedChanges(false)
      setTimeout(() => setSaveState('idle'), 2500)
    } catch {
      setSaveState('error')
      setTimeout(() => setSaveState('idle'), 2200)
    }
  }

  /* ── Save metadata ─────────────────────────────────────────────────────── */
  async function handleSaveMeta() {
    if (!activeName || !metaDirty) return
    try {
      await updateScheduleMeta(activeName, { academic_year: schedAY, semester: schedSem })
      setMetaDirty(false)
      // refresh metadata in the list
      setSchedulesMeta(prev => prev.map(s => (s.id || s.name) === activeName ? { ...s, academicYear: schedAY, semester: schedSem } : s))
    } catch {}
  }

  /* ── Finalize / Unfinalize ─────────────────────────────────────────────── */
  function handleFinalizeClick() {
    // Check if there's already a finalized schedule for the same AY+semester
    const existingFinalized = schedulesMeta.find(s => 
      s.academicYear === schedAY && 
      s.semester === schedSem && 
      s.finalized && 
      (s.id || s.name) !== activeName
    )
    
    if (existingFinalized) {
      // Show modal with warning about existing finalized schedule
      setShowFinalizeModal(true)
    } else {
      // No conflict, proceed directly
      handleFinalize()
    }
  }

  async function handleFinalize() {
    if (!activeName) return
    setFinalizingState('working')
    try {
      await finalizeSchedule(activeName)
      setSchedFinalized(true)
      setSchedulesMeta(prev => prev.map(s => {
        if ((s.id || s.name) === activeName) return { ...s, finalized: true }
        // un-finalize others with same AY+semester
        if (s.academicYear === schedAY && s.semester === schedSem && s.finalized) return { ...s, finalized: false }
        return s
      }))
      setFinalizingState('done')
      setShowFinalizeModal(false)
      setTimeout(() => setFinalizingState('idle'), 2500)
    } catch {
      setFinalizingState('error')
      setTimeout(() => setFinalizingState('idle'), 2200)
    }
  }

  async function handleUnfinalize() {
    if (!activeName) return
    setFinalizingState('working')
    try {
      await unfinalizeSchedule(activeName)
      setSchedFinalized(false)
      setSchedulesMeta(prev => prev.map(s => (s.id || s.name) === activeName ? { ...s, finalized: false } : s))
      setFinalizingState('done')
      setTimeout(() => setFinalizingState('idle'), 2500)
    } catch {
      setFinalizingState('error')
      setTimeout(() => setFinalizingState('idle'), 2200)
    }
  }

  /* ── Rename ─────────────────────────────────────────────────────────────── */
  function handleSaveName() {
    if (tempName.trim()) { setActiveName(tempName.trim()); setName(tempName.trim()) }
    setIsEditingName(false)
  }

  /* ── Make a copy ────────────────────────────────────────────────────────── */
  async function handleMakeCopy() {
    if (!activeName || !allEvents.length) return
    
    // Generate a unique copy name
    const baseName = `${activeName} - Copy`
    const finalName = generateUniqueName(baseName)
    
    try {
      // Save the current on-screen events as a new schedule
      await saveSchedule(finalName, { academicYear: schedAY, semester: schedSem }, allEvents)
      
      // Update saved names list
      setSavedNames(prev => [...prev, finalName])
      
      // Navigate to the new copy
      setActiveName(finalName)
      setName(finalName)
      setHasUnsavedChanges(false)
      
      // Update URL
      window.history.replaceState(null, '', `/dashboard/schedule/${encodeURIComponent(finalName)}`)
      
      setCopyToast({ type: 'success', message: `Schedule copied as "${finalName}"` })
      setTimeout(() => setCopyToast(null), 3000)
    } catch (err) {
      console.error('Failed to copy schedule:', err)
      setCopyToast({ type: 'error', message: 'Failed to create copy' })
      setTimeout(() => setCopyToast(null), 3000)
    }
  }

  /* ── Shared: apply active filters across ALL days (day filter intentionally excluded) ── */
  function getFilteredExportEvents() {
    const q = filters.searchQuery.trim().toLowerCase()
    const exportEvents = allEvents.filter(ev => {
      if (q) {
        const ok = (ev.courseCode||'').toLowerCase().includes(q)
          || (ev.block||'').toLowerCase().includes(q)
          || (ev.faculty||'').toLowerCase().includes(q)
          || (q.length >= 3 && (ev.title||'').toLowerCase().includes(q))
        if (!ok) return false
      }
      if (filterFac.size      > 0 && !filterFac.has(ev.faculty))       return false
      if (filterPrograms.size > 0 && !filterPrograms.has(ev.program))  return false
      if (filterYears.size    > 0 && !filterYears.has(ev.year))        return false
      if (filterRooms.size    > 0 && !filterRooms.has(ev.room))        return false
      if (filterBlocks.size   > 0 && !filterBlocks.has(ev.block))      return false
      if (filterSessions.size > 0 && !filterSessions.has(ev.session))  return false
      if (filterConflicts && !buildConflictMap(allEvents.filter(e => e.day === ev.day)).has(
        ev.schedule_id ?? `${ev.courseCode}-${ev.block}-${ev.session}-${ev.day}`
      )) return false
      if (filterUnassigned && (ev.faculty && ev.faculty !== 'TBA'))    return false
      if (filterMerged && !mergedIds.has(getEventId(ev)))              return false
      if (filterLec && !filterLab && ev.session?.toUpperCase().includes('LAB'))  return false
      if (filterLab && !filterLec && !ev.session?.toUpperCase().includes('LAB')) return false
      return true
    })

    // Build filter suffix for the file name
    const filterParts = []
    if (q)                  filterParts.push(q)
    if (filterPrograms.size > 0) filterParts.push([...filterPrograms].join('-'))
    if (filterYears.size    > 0) filterParts.push([...filterYears].map(y => `Y${y}`).join('-'))
    if (filterBlocks.size   > 0) filterParts.push([...filterBlocks].join('-'))
    if (filterFac.size      > 0) filterParts.push([...filterFac].map(f => f.split(' ').pop()).join('-'))
    if (filterRooms.size    > 0) filterParts.push([...filterRooms].join('-'))
    if (filterSessions.size > 0) filterParts.push([...filterSessions].join('-'))
    if (filterLec && !filterLab) filterParts.push('LEC')
    if (filterLab && !filterLec) filterParts.push('LAB')
    if (filterMerged)       filterParts.push('Merged')
    if (filterConflicts)    filterParts.push('Conflicts')
    if (filterUnassigned)   filterParts.push('Unassigned')

    const safePart = filterParts.join('_').replace(/[\\/:*?"<>|]+/g, '').trim()
    const exportName = safePart ? `${activeName}_${safePart}` : activeName

    return { exportEvents, exportName }
  }

  /* ── Export to Excel ──────────────────────────────────────────────────────── */
  async function handleExport() {
    if (!allEvents.length) return
    const { exportEvents, exportName } = getFilteredExportEvents()
    await exportScheduleToExcel(exportEvents, exportName)
  }

  /* ── Export room availability ────────────────────────────────────────────── */
  // Deliberately uses ALL events (unfiltered) — availability is a fact about
  // the room, not about whatever section/faculty filters happen to be on.
  async function handleExportAvailableRooms() {
    if (!allEvents.length) return
    await exportAvailableRoomsToExcel(allEvents, masterRooms, activeName)
  }

  /* ── Undo / Redo ────────────────────────────────────────────────────────── */
  const syncLocalEvents = useCallback(updated => {
    setLocalEvents(prev => {
      setPast(p => [...p, prev])
      setFuture([])
      setEvents(updated)
      setHasUnsavedChanges(true) // Mark as having unsaved changes
      return updated
    })
  }, [setEvents])

  const undo = () => {
    setLocalEvents(current => {
      if (past.length === 0) return current
      const previous = past[past.length - 1]
      setPast(past.slice(0, -1))
      setFuture([current, ...future])
      setEvents(previous)
      setHasUnsavedChanges(true) // Mark as having unsaved changes
      return previous
    })
  }

  const redo = () => {
    setLocalEvents(current => {
      if (future.length === 0) return current
      const next = future[0]
      setFuture(future.slice(1))
      setPast([...past, current])
      setEvents(next)
      setHasUnsavedChanges(true) // Mark as having unsaved changes
      return next
    })
  }

  /* ── Derived data ───────────────────────────────────────────────────────── */
  const allEvents   = localEvents
  const conflictMap = useMemo(() => buildConflictMap(allEvents.filter(e => e.day === activeDay)), [allEvents, activeDay])

  const filters = useFilters(allEvents, masterFacultyList, masterRooms, activeDay)
  const {
    dayEvents: rawDayEvents, options, searchQuery, setSearchQuery,
    filterFac, filterPrograms, filterRooms, filterYears, filterBlocks, filterSessions,
    filterConflicts, filterUnassigned,
    toggles, hasFilters, clearFilters,
  } = filters

  // Derived from ALL events — never filtered — so badges are always accurate
  const mergedIds = useMemo(() => getMergedIds(allEvents), [allEvents])

  const dayEvents = useMemo(() => {
    let evs = rawDayEvents
    if (filterMerged) evs = evs.filter(e => mergedIds.has(getEventId(e)))
    if (filterLec && !filterLab) evs = evs.filter(e => !e.session?.toUpperCase().includes('LAB'))
    if (filterLab && !filterLec) evs = evs.filter(e =>  e.session?.toUpperCase().includes('LAB'))
    return evs
  }, [rawDayEvents, filterMerged, filterLec, filterLab, mergedIds])

  const localHasFilters = hasFilters || filterMerged || filterLec || filterLab || showAvailableOnly
  const handleClearAll  = () => { clearFilters(); setFilterMerged(false); setFilterLec(false); setFilterLab(false); setShowAvailableOnly(false) }

  /* ── Drag & drop — now with pending overrides + conflict ids ──────────── */
  const dd = useDragDrop(allEvents, activeDay, syncLocalEvents, setEvents, storeEvents, schedFinalized)

  const allDayRooms = useMemo(() => {
    const occupied = new Set(dayEvents.map(e => e.room).filter(Boolean))
    const master   = [...masterRooms.lecture, ...masterRooms.lab]
    const merged   = master.length > 0 ? master.filter(r => occupied.has(r) || master.includes(r)) : [...occupied]
    const extra    = [...occupied].filter(r => r !== 'TBA' && !merged.includes(r))
    return [...merged, ...extra].filter(r => r && r !== 'TBA')
  }, [dayEvents, masterRooms])

  // Room availability is always computed from ALL events for the day (not
  // dayEvents/allDayRooms, which reflect active filters) so "available"
  // stays correct no matter what program/year/faculty filters are on.
  const dayAvailability = useMemo(
    () => computeRoomAvailability(allEvents, masterRooms, activeDay),
    [allEvents, masterRooms, activeDay]
  )
  // "Available" = has at least one open gap today, not "empty the whole day".
  // On a real schedule almost every room gets booked at some point, so
  // requiring the room to be fully empty made this set (and the toggle
  // below) come up empty basically always.
  const availableRoomSet = useMemo(
    () => new Set(dayAvailability.filter(r => r.free.length > 0).map(r => r.room)),
    [dayAvailability]
  )

  // Room → true free ranges, for glowing actual open slots in the TimeGrid.
  // Built from dayAvailability (already computed from unfiltered allEvents above),
  // so the glow stays correct even while a session/program/faculty filter is
  // hiding the event that's actually occupying a given slot.
  const availabilityMap = useMemo(
    () => new Map(dayAvailability.map(r => [r.room, r.free])),
    [dayAvailability]
  )

  // Room → session count for the active day, unaffected by active filters
  // (same "all events for the day" basis as availableRoomSet above), used
  // to show a simple per-room session tally in the room filter modal.
  const roomSessionCounts = useMemo(() => {
    const counts = new Map()
    for (const ev of allEvents) {
      if (ev.day !== activeDay || !ev.room || ev.room === 'TBA') continue
      counts.set(ev.room, (counts.get(ev.room) ?? 0) + 1)
    }
    return counts
  }, [allEvents, activeDay])

  const visibleRooms = useMemo(() => {
    let rooms
    if (filterRooms.size > 0) {
      // A room the user explicitly filtered for should always show as a
      // column — even if it has zero sessions today — so start from the
      // full known room list (options.allRooms) instead of allDayRooms,
      // which only contains rooms that already have events on this day.
      rooms = options.allRooms.filter(r => filterRooms.has(r))
    } else {
      rooms = allDayRooms
    }
    if (showAvailableOnly) rooms = rooms.filter(r => availableRoomSet.has(r))
    return rooms
  }, [allDayRooms, filterRooms, showAvailableOnly, availableRoomSet, options.allRooms])

  const dayCounts = useMemo(() => {
    const m = {}
    DAYS.forEach(d => { m[d] = allEvents.filter(e => e.day === d).length })
    return m
  }, [allEvents])

  // FIX: exclude GEC/MAT/NSTP/PATHFIT/PE — always TBA, managed externally
  const unassignedCount = dayEvents.filter(e => (!e.faculty || e.faculty === 'TBA') && !svIsOtherDept(e.courseCode)).length
  const hasNoSchedule   = allEvents.length === 0 && !loading

  const statItems = [
    { label:'Sessions',      value: dayEvents.length,    sub: `on ${activeDay}` },
    { label:'Total overall', value: allEvents.length,    sub: 'all days', accent: 'var(--mint)' },
    { label:'Conflicts',     value: conflictMap.size,    accent: conflictMap.size  > 0 ? '#ef4444' : TV.deep, sub: 'detected'   },
    { label:'Unassigned',    value: unassignedCount,     accent: unassignedCount   > 0 ? '#f59e0b' : TV.deep, sub: 'dept courses only' },
    { label:'Faculty',       value: new Set(dayEvents.map(e => e.faculty).filter(f => f && f !== 'TBA')).size, sub: 'teaching' },
    { label:'Rooms',         value: visibleRooms.length, sub: 'in use' },
    // ── New: pending changes count in stats
    ...(dd.pendingOverrides.size > 0 ? [{ label:'Pending', value: dd.pendingOverrides.size, accent: '#F59E0B', sub: 'unsaved' }] : []),
  ]

  const Sep = () => <div style={{ width:1, height:20, background:TV.border, flexShrink:0 }} />

  /* ════════════════════ RENDER ════════════════════════════════════════════ */
  return (
    <div className="page" style={{ padding:'15px 15px 30px', overflowX:'hidden', width:'100%', minWidth:0 }}>
      {TourElement}
      {/* ── Header ───────────────────────────────────────────────────────── */}
      <div style={{ display:'flex', alignItems:'center', justifyContent:'space-between', gap:8, marginBottom:20, minWidth:0 }}>
        <div style={{ display:'flex', alignItems:'center', gap:10, minWidth:0, flex:'1 1 0' }}>
          {isEditingName ? (
            <div style={{ display:'flex', alignItems:'center', gap:8 }}>
              <input
                autoFocus value={tempName}
                onChange={e => setTempName(e.target.value)}
                onKeyDown={e => e.key === 'Enter' && handleSaveName()}
                style={{ fontSize:20, fontWeight:700, padding:'4px 10px', borderRadius:8, border:`2px solid ${TV.mid}`, outline:'none', width:230, fontFamily:'Inter,sans-serif' }}
              />
              <button onClick={handleSaveName} style={{ padding:'6px 14px', background:TV.deep, color: '#fff', border:'none', borderRadius:8, fontWeight:600, cursor:'pointer', fontFamily:'Inter,sans-serif' }}>Save</button>
              <button onClick={() => setIsEditingName(false)} style={{ padding:'6px 14px', background: 'var(--surface)', border:`1px solid ${TV.border}`, borderRadius:8, fontWeight:600, cursor:'pointer', fontFamily:'Inter,sans-serif' }}>Cancel</button>
            </div>
          ) : (
            <div style={{ display:'flex', alignItems:'center', gap:16 }}>
              <div>
                <div style={{ display:'flex', alignItems:'center', gap:8 }}>
                  <h1 className="page-title" style={{ margin:0, fontSize:18, overflow:'hidden', textOverflow:'ellipsis', whiteSpace:'nowrap', maxWidth:'28ch' }}>
                    {activeName || 'Untitled Schedule'}
                  </h1>
                  {activeName && (
                    <button
                      onClick={() => { setTempName(activeName); setIsEditingName(true) }}
                      style={{ background:'transparent', border:'none', cursor:'pointer', color:TV.muted, display:'flex', alignItems:'center', padding:4, borderRadius:6 }}
                      title="Rename"
                    >
                      <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                        <path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"/>
                        <path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"/>
                      </svg>
                    </button>
                  )}
                </div>
                
                {/* Academic Year & Semester - under the name */}
                {activeName && schedAY && schedSem && (
                  <div style={{ fontSize:11.5, marginTop:2, display:'flex', alignItems:'center', gap:12, color:TV.muted2, fontWeight:500 }}>
                    {schedAY} • {schedSem}
                  </div>
                )}
              </div>
              
              {/* Finalize/Unfinalize - same row as title */}
              {activeName && allEvents.length > 0 && (
                schedFinalized ? (
                  <div style={{ display:'flex', alignItems:'center', gap:6 }}>
                    <span style={{ display:'inline-flex', alignItems:'center', gap:4, padding:'3px 10px', borderRadius:99, fontSize:11, fontWeight:700, background:'var(--meadow-soft)', color: 'var(--meadow)', border:'1px solid var(--meadow-border)' }}>
                      <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"><polyline points="20 6 9 17 4 12"/></svg>
                      Finalized
                    </span>
                    <button onClick={handleUnfinalize} disabled={finalizingState === 'working'}
                      style={{ padding:'3px 10px', borderRadius:7, border:'1px solid #fecaca', background:'rgba(220, 38, 38, 0.05)', color:'#EF4444', fontSize:11, fontWeight:600, cursor:'pointer', fontFamily:'Inter,sans-serif' }}>
                      {finalizingState === 'working' ? 'Removing…' : 'Unfinalize'}
                    </button>
                  </div>
                ) : (
                  <button onClick={handleFinalizeClick} disabled={finalizingState === 'working'}
                    style={{ display:'inline-flex', alignItems:'center', gap:5, padding:'4px 13px', borderRadius:8, border:'none', background:'linear-gradient(135deg,var(--meadow),var(--meadow-deep))', color: '#fff', fontSize:11.5, fontWeight:600, cursor:'pointer', fontFamily:'Inter,sans-serif', boxShadow:'0 2px 8px rgba(0,0,0,.25)' }}>
                    <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"><polyline points="20 6 9 17 4 12"/></svg>
                    {finalizingState === 'working' ? 'Finalizing…' : 'Finalize'}
                  </button>
                )
              )}
            </div>
          )}
        </div>
        {!isEditingName && (
          <div id="tour-sv-save" style={{ display:'flex', gap:5, alignItems:'center', flexShrink:0 }}>
            {(initLoading || savedNames.length > 0) && (
              <ScheduleDropdown names={savedNames} activeName={activeName} loading={loading} initLoading={initLoading} onChange={loadSchedule} schedulesMeta={schedulesMeta} />
            )}
            {activeName && !schedFinalized && <SmartSaveButton state={saveState} onClick={handleSave} hasUnsavedChanges={hasUnsavedChanges} scheduleMeta={scheduleMeta} activeName={activeName} />}
            {/* Version History Button - only show if there are previous versions,
                and never while finalized (restoring would overwrite the live
                finalized state that's currently published to faculty) */}
            {activeName && !schedFinalized && scheduleMeta && scheduleMeta.versionHistory && scheduleMeta.versionHistory.length > 0 && (
              <button
                onClick={() => setShowVersionHistory(true)}
                className="sv-save-btn"
                title={`View ${scheduleMeta.versionHistory.length} previous version${scheduleMeta.versionHistory.length !== 1 ? 's' : ''}`}
                style={{ minWidth:'auto', padding:'6px 9px', fontSize:12 }}
              >
                <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <polyline points="1 4 1 10 7 10"/>
                  <path d="M3.51 15a9 9 0 1 0 2.13-9.36L1 10"/>
                </svg>
                <span>History ({scheduleMeta.versionHistory.length})</span>
              </button>
            )}
            {/* Make a Copy Button — icon only to save space */}
            {activeName && allEvents.length > 0 && (
              <button
                onClick={handleMakeCopy}
                className="sv-save-btn"
                title="Make a copy of this schedule"
                style={{ minWidth:'auto', padding:'6px 8px' }}
              >
                <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                  <rect x="9" y="9" width="13" height="13" rx="2" ry="2"/>
                  <path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1"/>
                </svg>
              </button>
            )}
            {allEvents.length > 0 && (
              <ExportMenuButton onExportSchedule={handleExport} onExportRooms={handleExportAvailableRooms} />
            )}
          </div>
        )}
      </div>

      {/* ── Stats ────────────────────────────────────────────────────────── */}
      {allEvents.length > 0 && <StatsRow items={statItems} />}

      {/* ── Pending changes bar ───────────────────────────────────────────── */}
      {/* Appears below stats, above day selector — amber, prominent */}
    {!schedFinalized && (
      <div id="tour-sv-pending">
      <PendingChangesBar
        pendingOverrides={dd.pendingOverrides}
        onSave={dd.saveAllOverrides}
        onRevertAll={dd.revertAllOverrides}
        saving={dd.saving}
        autoSaveIn={dd.autoSaveIn}
      />
      </div>
    )}
 

       {/* ── Program color legend ─────────────────────────────────────────── */}
      {allEvents.length > 0 && (
        <ProgramLegend events={allEvents} />
      )}
 
      {/* ── Filters bar ──────────────────────────────────────────────────── */}
      {allEvents.length > 0 && (
        <div id="tour-sv-tools" style={{ background: 'var(--surface)', border:`1px solid ${TV.border}`, borderRadius:12, padding:'11px 14px', marginBottom:14, display:'flex', flexDirection:'column', gap:10 }}>
          <div style={{ display:'flex', alignItems:'center', gap:8, flexWrap:'wrap' }}>
            <div style={{ position:'relative', flexShrink:0 }}>
              <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke={TV.muted} strokeWidth="2"
                style={{ position:'absolute', left:10, top:'50%', transform:'translateY(-50%)', pointerEvents:'none' }}>
                <circle cx="11" cy="11" r="8"/><line x1="21" y1="21" x2="16.65" y2="16.65"/>
              </svg>
              <input
                className="sv-search"
                placeholder="Course, block, faculty…"
                value={searchQuery}
                onChange={e => setSearchQuery(e.target.value)}
              />
            </div>
            <Sep />
            <FilterRow label="Program">
              <div style={{ display:'flex', gap:5, flexWrap:'wrap' }}>
                {options.allPrograms.map(p => (
                  <button key={p} className={`sv-chip${filterPrograms.has(p)?' active':''}`} onClick={() => toggles.program(p)}>
                    {p}
                  </button>
                ))}
              </div>
            </FilterRow>
            <Sep />
            <FilterRow label="Year">
              {options.allYears.map(y => (
                <button key={y} className={`sv-chip${filterYears.has(y)?' active':''}`} onClick={() => toggles.year(y)}>
                  Yr {y}
                </button>
              ))}
            </FilterRow>
            <Sep />
            <FilterRow label="Block">
              {options.allBlocks.map(b => (
                <button key={b} className={`sv-chip${filterBlocks.has(b)?' active':''}`} onClick={() => toggles.block(b)}>
                  {b}
                </button>
              ))}
            </FilterRow>
            <FilterRow label="Session">
              <button className={`sv-chip${filterLec?' active':''}`} onClick={() => setFilterLec(!filterLec)}>
                Lecture
              </button>
              <button className={`sv-chip${filterLab?' active':''}`} onClick={() => setFilterLab(!filterLab)}>
                Laboratory
              </button>
            </FilterRow>
            <Sep />
            <FilterRow label="Faculty">
              <FilterButton active={filterFac.size > 0} count={filterFac.size} onClick={() => setOpenModal('faculty')} />
            </FilterRow>
            <FilterRow label="Room">
              <FilterButton active={filterRooms.size > 0} count={filterRooms.size} onClick={() => setOpenModal('room')} />
            </FilterRow>
            <Sep />
            <button onClick={toggles.conflicts} style={{
              display:'inline-flex', alignItems:'center', gap:4,
              padding:'3px 10px', borderRadius:20, fontSize:11, cursor:'pointer',
              fontFamily:'Inter,sans-serif', transition:'all .15s',
              fontWeight: filterConflicts ? 700 : 400,
              border: `1px solid ${filterConflicts ? '#fca5a5' : TV.border}`,
              background: filterConflicts ? 'rgba(239, 68, 68, 0.05)' : 'var(--surface)',
              color: filterConflicts ? '#EF4444' : TV.muted,
            }}>
              <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                <path d="M10.29 3.86L1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z"/>
                <line x1="12" y1="9" x2="12" y2="13"/><line x1="12" y1="17" x2="12.01" y2="17"/>
              </svg>
              Conflicts
            </button>
            <button onClick={() => setFilterMerged(!filterMerged)} style={{
              display:'inline-flex', alignItems:'center', gap:4,
              padding:'3px 10px', borderRadius:20, fontSize:11, cursor:'pointer',
              fontFamily:'Inter,sans-serif', transition:'all .15s',
              fontWeight: filterMerged ? 700 : 400,
              border: `1px solid ${filterMerged ? TV.light : TV.border}`,
              background: filterMerged ? TV.pale : 'var(--surface)',
              color: filterMerged ? TV.deep : TV.muted,
            }}>
              <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                <path d="M10 13a5 5 0 0 0 7.54.54l3-3a5 5 0 0 0-7.07-7.07l-1.72 1.71"/>
                <path d="M14 11a5 5 0 0 0-7.54-.54l-3 3a5 5 0 0 0 7.07 7.07l1.71-1.71"/>
              </svg>
              Merged
            </button>
            <button onClick={toggles.unassigned} style={{
              display:'inline-flex', alignItems:'center', gap:4,
              padding:'3px 10px', borderRadius:20, fontSize:11, cursor:'pointer',
              fontFamily:'Inter,sans-serif', transition:'all .15s',
              fontWeight: filterUnassigned ? 700 : 400,
              border: `1px solid ${filterUnassigned ? 'rgba(245, 158, 11, 0.35)' : TV.border}`,
              background: filterUnassigned ? 'rgba(245, 158, 11, 0.05)' : 'var(--surface)',
              color: filterUnassigned ? '#92400e' : TV.muted,
            }}>
              <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                <circle cx="12" cy="12" r="10"/>
              </svg>
              Unassigned
            </button>
            <button
              onClick={() => setShowAvailableOnly(v => !v)}
              title="Show only rooms with open time today, and glow their genuinely free slots green — computed from every session, unaffected by other filters"
              style={{
                display:'inline-flex', alignItems:'center', gap:4,
                padding:'3px 10px', borderRadius:20, fontSize:11, cursor:'pointer',
                fontFamily:'Inter,sans-serif', transition:'all .15s',
                fontWeight: showAvailableOnly ? 700 : 400,
                border: `1px solid ${showAvailableOnly ? 'var(--meadow-border)' : TV.border}`,
                background: showAvailableOnly ? 'var(--meadow-soft)' : 'var(--surface)',
                color: showAvailableOnly ? 'var(--meadow)' : TV.muted,
              }}>
              <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                <path d="M20 6 9 17l-5-5"/>
              </svg>
              Available Rooms
            </button>
            {localHasFilters && (
              <button onClick={handleClearAll} style={{
                fontSize:11.5, color:'#EF4444', background:'rgba(220, 38, 38, 0.05)',
                border:'1px solid #fecaca', borderRadius:8, padding:'4px 10px',
                cursor:'pointer', fontFamily:'Inter,sans-serif', fontWeight:600,
                flexShrink:0, marginLeft:'auto',
              }}>
                ✕ Clear all
              </button>
            )}
          </div>

          {/* Legend */}
          <div style={{ display:'flex', alignItems:'center', gap:14, paddingTop:10, borderTop:`1px solid ${TV.border}` }}>
            {[
              { bg: 'var(--surface)', border:TV.border, label:'Normal', color:TV.muted },
              { bg:TV.pale, border:TV.light, label:'Merge', color:TV.deep,
                icon: <svg width="9" height="9" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"><path d="M10 13a5 5 0 0 0 7.54.54l3-3a5 5 0 0 0-7.07-7.07l-1.72 1.71"/><path d="M14 11a5 5 0 0 0-7.54-.54l-3 3a5 5 0 0 0 7.07 7.07l1.71-1.71"/></svg> },
              { bg:'rgba(239, 68, 68, 0.05)', border:'rgba(220, 38, 38, 0.25)', label:'Conflict', color:'#EF4444',
                icon: <svg width="9" height="9" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"><path d="M10.29 3.86L1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z"/><line x1="12" y1="9" x2="12" y2="13"/><line x1="12" y1="17" x2="12.01" y2="17"/></svg> },
              { bg:'rgba(245, 158, 11, 0.05)', border:'rgba(245, 158, 11, 0.35)', label:'Unassigned', color:'#92400e',
                icon: <svg width="9" height="9" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"><circle cx="12" cy="12" r="10"/></svg> },
            ].map(({ bg, border, label, color, icon }) => (
              <div key={label} style={{ display:'flex', alignItems:'center', gap:6 }}>
                <div style={{ display:'flex', alignItems:'center', justifyContent:'center', width:14, height:14, border:`1.5px solid ${border}`, borderRadius:3, background:bg, color, flexShrink:0 }}>
                  {icon ?? null}
                </div>
                <span style={{ fontSize:11, color, fontWeight: icon ? 600 : 500 }}>{label}</span>
              </div>
            ))}
          </div>
        </div>
      )}

{/* ── Day selector + View toggles ───────────────────────────────────── */}
      {allEvents.length > 0 && (
        <div style={{ display:'flex', alignItems:'center', justifyContent:'space-between', gap:8, marginBottom:16, flexWrap:'wrap' }}>
          <div id="tour-sv-days" style={{ display:'flex', gap:6, flexWrap:'wrap' }}>
            {DAYS.map(d => (
              <button key={d} onClick={() => setActiveDay(d)}
                className={`sv-day-btn${activeDay===d?' active':''}`}>
                {d.slice(0,3)}
                {dayCounts[d] > 0 && (
                  <span style={{ marginLeft:4, fontSize:9.5, fontWeight:700, opacity: activeDay===d ? 1 : .6 }}>
                    {dayCounts[d]}
                  </span>
                )}
              </button>
            ))}
          </div>

          <div style={{ display:'flex', gap:6, alignItems:'center', flexShrink:0 }}>
            <div style={{ display:'flex', gap:6, alignItems:'center', borderRight: `1px solid ${TV.border}`, paddingRight: 8, marginRight: 2 }}>
              <button onClick={undo} disabled={past.length === 0} className="sv-icon-btn" title="Undo" style={{ opacity: past.length === 0 ? 0.4 : 1, cursor: past.length === 0 ? 'not-allowed' : 'pointer' }}>
                <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <path d="M3 7v6h6"/><path d="M21 17a9 9 0 0 0-9-9 9 9 0 0 0-6 2.3L3 13"/>
                </svg>
              </button>
              <button onClick={redo} disabled={future.length === 0} className="sv-icon-btn" title="Redo" style={{ opacity: future.length === 0 ? 0.4 : 1, cursor: future.length === 0 ? 'not-allowed' : 'pointer' }}>
                <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <path d="M21 7v6h-6"/><path d="M3 17a9 9 0 0 1 9-9 9 9 0 0 1 6 2.3l3 2.7"/>
                </svg>
              </button>
            </div>
            <div id="tour-sv-viewmode" className="sv-view-group">
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
                  className={`sv-view-btn${viewMode===v?' active':''}`}
                  style={{ borderRight: i < arr.length-1 ? `1px solid ${TV.border}` : 'none' }}>
                  {icon} {label}
                </button>
              ))}
            </div>
            <div className="sv-view-group">
              {[
                ['compact',  'Compact',  (
                  <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                    <line x1="3" y1="5" x2="21" y2="5"/><line x1="3" y1="9" x2="21" y2="9"/>
                    <line x1="3" y1="13" x2="21" y2="13"/><line x1="3" y1="17" x2="21" y2="17"/><line x1="3" y1="21" x2="21" y2="21"/>
                  </svg>
                )],
                ['normal',   'Normal',   (
                  <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                    <line x1="3" y1="5" x2="21" y2="5"/><line x1="3" y1="11" x2="21" y2="11"/>
                    <line x1="3" y1="17" x2="21" y2="17"/>
                  </svg>
                )],
                ['maximize', 'Maximize', (
                  <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                    <polyline points="15 3 21 3 21 9"/><polyline points="9 21 3 21 3 15"/>
                    <line x1="21" y1="3" x2="14" y2="10"/><line x1="3" y1="21" x2="10" y2="14"/>
                  </svg>
                )],
              ].map(([size, label, icon], i, arr) => (
                <button key={size}
                  onClick={() => setGridSize(size)}
                  title={`${label} density`}
                  className={`sv-view-btn${gridSize === size ? ' active' : ''}`}
                  style={{ borderRight: i < arr.length - 1 ? `1px solid ${TV.border}` : 'none' }}
                >
                  {icon} {label}
                </button>
              ))}
            </div>
          </div>
        </div>
      )}

      {/* ── Main content ─────────────────────────────────────────────────── */}
      {loading ? (
        <Spinner full />
      ) : hasNoSchedule ? (
        <div style={{ background: 'var(--surface)', border:`1px solid ${TV.border}`, borderRadius:14, padding:48, textAlign:'center' }}>
          <div style={{ display:'flex', alignItems:'center', justifyContent:'center', margin:'0 auto 16px' }}>
            <img src={scheduleImage} alt="No Schedule Loaded" style={{ width: 120, height: 'auto' }} />
          </div>
          <p style={{ fontSize:15, fontWeight:700, color:TV.text, marginBottom:6 }}>No Schedule Loaded</p>
          <p style={{ fontSize:13, color:TV.muted }}>
            {savedNames.length > 0 || initLoading
              ? 'Select a saved schedule from the dropdown above to view it.'
              : 'Generate a schedule in the Scheduler page first.'}
          </p>
        </div>
      ) : viewMode === 'list' ? (
        <ListView
          dayEvents={dayEvents} 
          conflictMap={conflictMap}
          hasFilters={localHasFilters} 
          clearFilters={handleClearAll}
          onCardClick={setSelectedEvent}
          mergedIds={mergedIds}
        />
      ) : gridSize === 'maximize' ? (
        /* ── Fullscreen overlay for maximize mode ── */
        <div style={{
          position: 'fixed', inset: 0, zIndex: 200,
          background: 'var(--surface)',
          display: 'flex', flexDirection: 'column',
          fontFamily: 'Inter, sans-serif',
        }}>

          {/* ── Top bar: Unified Header (Name + Days + Controls) ── */}
          <div style={{
            flexShrink: 0,
            display: 'flex', alignItems: 'center', justifyContent: 'space-between',
            padding: '0 16px', height: 56, // Slightly taller to comfortably fit day buttons
            borderBottom: `1px solid ${TV.border}`,
            background: 'linear-gradient(to bottom,#F2F7F4,var(--bg))',
          }}>
            
            {/* Left: name + stats + conflict */}
            <div style={{ display: 'flex', alignItems: 'center', gap: 12, minWidth: 0, flex: 1 }}>
              <span style={{ fontSize: 13.5, fontWeight: 700, color: TV.text, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis', maxWidth: 180 }}>
                {activeName || 'Schedule'}
              </span>
              <div style={{ width: 1, height: 16, background: TV.border }} />
              <span style={{ fontSize: 11, color: TV.muted, whiteSpace: 'nowrap', flexShrink: 0 }}>
                {dayEvents.length} session{dayEvents.length !== 1 ? 's' : ''}
              </span>
              <ConflictSummaryBar conflictMap={conflictMap} compact />
            </div>

            {/* Center: Day Switcher */}
            <div style={{ display: 'flex', alignItems: 'center', gap: 5, flexShrink: 0 }}>
              {DAYS.map(d => (
                <button key={d} onClick={() => setActiveDay(d)}
                  className={`sv-day-btn${activeDay === d ? ' active' : ''}`}
                  style={{ padding: '5px 12px', fontSize: 11 }}>
                  {d.slice(0, 3)}
                  {dayCounts[d] > 0 && (
                    <span style={{ marginLeft: 4, fontSize: 9.5, fontWeight: 700, opacity: activeDay === d ? 1 : .6 }}>
                      {dayCounts[d]}
                    </span>
                  )}
                </button>
              ))}
            </div>

            {/* Right: undo/redo + density + filter + exit */}
            <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexShrink: 0, flex: 1, justifyContent: 'flex-end' }}>
              
              <div style={{ display:'flex', gap:6, alignItems:'center', borderRight: `1px solid ${TV.border}`, paddingRight: 8 }}>
                <button onClick={undo} disabled={past.length === 0} className="sv-icon-btn" title="Undo" style={{ opacity: past.length === 0 ? 0.4 : 1, cursor: past.length === 0 ? 'not-allowed' : 'pointer', width: 28, height: 28 }}>
                  <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                    <path d="M3 7v6h6"/><path d="M21 17a9 9 0 0 0-9-9 9 9 0 0 0-6 2.3L3 13"/>
                  </svg>
                </button>
                <button onClick={redo} disabled={future.length === 0} className="sv-icon-btn" title="Redo" style={{ opacity: future.length === 0 ? 0.4 : 1, cursor: future.length === 0 ? 'not-allowed' : 'pointer', width: 28, height: 28 }}>
                  <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                    <path d="M21 7v6h-6"/><path d="M3 17a9 9 0 0 1 9-9 9 9 0 0 1 6 2.3l3 2.7"/>
                  </svg>
                </button>
              </div>

              <div className="sv-view-group">
                {[
                  ['compact', 'Compact', (
                    <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                      <line x1="3" y1="5" x2="21" y2="5"/><line x1="3" y1="9" x2="21" y2="9"/>
                      <line x1="3" y1="13" x2="21" y2="13"/><line x1="3" y1="17" x2="21" y2="17"/><line x1="3" y1="21" x2="21" y2="21"/>
                    </svg>
                  )],
                  ['normal', 'Normal', (
                    <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                      <line x1="3" y1="5" x2="21" y2="5"/><line x1="3" y1="11" x2="21" y2="11"/>
                      <line x1="3" y1="17" x2="21" y2="17"/>
                    </svg>
                  )],
                ].map(([density, label, icon], i, arr) => (
                  <button key={density} onClick={() => setMaximizeDensity(density)}
                    className={`sv-view-btn${maximizeDensity === density ? ' active' : ''}`}
                    style={{ borderRight: i < arr.length - 1 ? `1px solid ${TV.border}` : 'none' }}>
                    {icon} {label}
                  </button>
                ))}
              </div>

              <button onClick={() => setMaximizeFilterOpen(true)} style={{
                  display: 'inline-flex', alignItems: 'center', gap: 6,
                  padding: '5px 12px', borderRadius: 8,
                  border: `1px solid ${localHasFilters ? TV.mid : TV.border}`,
                  background: localHasFilters ? TV.pale : 'var(--surface)',
                  color: localHasFilters ? TV.deep : TV.muted,
                  fontSize: 12, fontWeight: localHasFilters ? 700 : 500,
                  cursor: 'pointer', fontFamily: 'Inter, sans-serif',
                  transition: 'all .15s',
                }}>
                <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                  <polygon points="22 3 2 3 10 12.46 10 19 14 21 14 12.46 22 3"/>
                </svg>
                Filters
                {localHasFilters && (
                  <span style={{ background: TV.deep, color: '#fff', borderRadius: 10, fontSize: 9, fontWeight: 800, padding: '1px 5px', lineHeight: 1.4 }}>
                    ON
                  </span>
                )}
              </button>

              <button onClick={() => setGridSize('normal')} style={{
                  display: 'inline-flex', alignItems: 'center', gap: 6,
                  padding: '5px 12px', borderRadius: 8, border: `1px solid ${TV.border}`,
                  background: 'var(--surface)', color: TV.deep, fontSize: 12, fontWeight: 600,
                  cursor: 'pointer', fontFamily: 'Inter, sans-serif', transition: 'all .15s',
                }}
                onMouseEnter={e => { e.currentTarget.style.background = TV.pale; e.currentTarget.style.borderColor = TV.mid }}
                onMouseLeave={e => { e.currentTarget.style.background = 'var(--surface)'; e.currentTarget.style.borderColor = TV.border }}>
                <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                  <polyline points="4 14 10 14 10 20"/><polyline points="20 10 14 10 14 4"/>
                  <line x1="10" y1="14" x2="21" y2="3"/><line x1="3" y1="21" x2="14" y2="10"/>
                </svg>
                Exit
              </button>
            </div>
          </div>

          {/* ── Grid fills remaining space ── */}
          <div style={{ flex: 1, overflow: 'hidden', padding: '0 16px' }}>
            {visibleRooms.length === 0
              ? <EmptyState hasFilters={localHasFilters} onClear={handleClearAll} />
              : (
                <TimeGrid
                  rooms={visibleRooms} dayEvents={dayEvents} conflictMap={conflictMap}
                  draggedEvent={dd.draggedEvent} hoveredCell={dd.hoveredCell} getDropConflict={dd.getDropConflict}
                  onDragStart={dd.handleDragStart} onDragEnd={dd.handleDragEnd} onDragOver={dd.handleDragOver}
                  onDragLeave={dd.handleDragLeave} onDrop={dd.handleDrop} onCardClick={setSelectedEvent}
                  locked={schedFinalized}
                  gridSize={maximizeDensity} fullscreen={true} conflictingDragIds={dd.conflictingDragIds}
                  ambientConflictIds={dd.ambientConflictIds}
                  ambientMergeIds={dd.ambientMergeIds}
                  dragConflictBands={dd.dragConflictBands}
                  mergedIds={mergedIds}
                  allEvents={allEvents}
                  availabilityMap={availabilityMap}
                  highlightAvailable={showAvailableOnly}
                />
              )
            }
          </div>

          {/* ── Compact Fullscreen filter modal ── */}
          {maximizeFilterOpen && (
            <ModalOverlay onClose={() => setMaximizeFilterOpen(false)}>
              <div style={{
                background: 'var(--surface)', borderRadius: 14,
                width: 680, maxWidth: '94vw', maxHeight: '88vh',
                display: 'flex', flexDirection: 'column',
                boxShadow: '0 24px 64px rgba(0,0,0,0.22)',
                border: `1px solid ${TV.border}`,
                fontFamily: 'Inter, sans-serif',
                overflow: 'hidden',
              }}>
                <div style={{ padding: '16px 20px 0' }}>
                  <ModalHeader
                    title="Filters"
                    subtitle={localHasFilters ? 'Some filters are active' : 'Narrow down what you see in the grid'}
                    onClose={() => setMaximizeFilterOpen(false)}
                  />
                </div>

                <div style={{ flex: 1, overflowY: 'auto', padding: '12px 20px 20px', display: 'flex', flexDirection: 'column', gap: 18 }}>

                  {/* Row 1: Search & Quick Filters */}
                  <div style={{ display: 'grid', gridTemplateColumns: '1fr 1.2fr', gap: 20 }}>
                    <div>
                      <p style={{ fontSize: 9.5, fontWeight: 700, color: TV.muted, textTransform: 'uppercase', letterSpacing: '.7px', marginBottom: 6 }}>Search</p>
                      <div style={{ position: 'relative' }}>
                        <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke={TV.muted} strokeWidth="2" style={{ position: 'absolute', left: 10, top: '50%', transform: 'translateY(-50%)', pointerEvents: 'none' }}>
                          <circle cx="11" cy="11" r="8"/><line x1="21" y1="21" x2="16.65" y2="16.65"/>
                        </svg>
                        <input className="sv-search" placeholder="Course, block, faculty…" value={searchQuery} onChange={e => setSearchQuery(e.target.value)} style={{ width: '100%', boxSizing: 'border-box' }} />
                      </div>
                    </div>

                    <div>
                      <p style={{ fontSize: 9.5, fontWeight: 700, color: TV.muted, textTransform: 'uppercase', letterSpacing: '.7px', marginBottom: 6 }}>Quick Filters</p>
                      <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
                        <button onClick={toggles.conflicts} style={{
                          display: 'inline-flex', alignItems: 'center', gap: 5, padding: '4px 10px', borderRadius: 20, fontSize: 11, cursor: 'pointer', fontFamily: 'Inter,sans-serif', transition: 'all .15s',
                          fontWeight: filterConflicts ? 700 : 400, border: `1px solid ${filterConflicts ? '#fca5a5' : TV.border}`, background: filterConflicts ? 'rgba(239, 68, 68, 0.05)' : 'var(--surface)', color: filterConflicts ? '#EF4444' : TV.muted,
                        }}>
                          <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"><path d="M10.29 3.86L1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z"/><line x1="12" y1="9" x2="12" y2="13"/><line x1="12" y1="17" x2="12.01" y2="17"/></svg>
                          Conflicts only
                        </button>
                        <button onClick={() => setFilterMerged(!filterMerged)} style={{
                          display: 'inline-flex', alignItems: 'center', gap: 5, padding: '4px 10px', borderRadius: 20, fontSize: 11, cursor: 'pointer', fontFamily: 'Inter,sans-serif', transition: 'all .15s',
                          fontWeight: filterMerged ? 700 : 400, border: `1px solid ${filterMerged ? TV.light : TV.border}`, background: filterMerged ? TV.pale : 'var(--surface)', color: filterMerged ? TV.deep : TV.muted,
                        }}>
                          <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"><path d="M10 13a5 5 0 0 0 7.54.54l3-3a5 5 0 0 0-7.07-7.07l-1.72 1.71"/><path d="M14 11a5 5 0 0 0-7.54-.54l-3 3a5 5 0 0 0 7.07 7.07l1.71-1.71"/></svg>
                          Merged only
                        </button>
                        <button onClick={toggles.unassigned} style={{
                          display: 'inline-flex', alignItems: 'center', gap: 5, padding: '4px 10px', borderRadius: 20, fontSize: 11, cursor: 'pointer', fontFamily: 'Inter,sans-serif', transition: 'all .15s',
                          fontWeight: filterUnassigned ? 700 : 400, border: `1px solid ${filterUnassigned ? 'rgba(245, 158, 11, 0.35)' : TV.border}`, background: filterUnassigned ? 'rgba(245, 158, 11, 0.05)' : 'var(--surface)', color: filterUnassigned ? '#92400e' : TV.muted,
                        }}>
                          <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"><circle cx="12" cy="12" r="10"/></svg>
                          Unassigned only
                        </button>
                        <button onClick={() => setShowAvailableOnly(v => !v)} style={{
                          display: 'inline-flex', alignItems: 'center', gap: 5, padding: '4px 10px', borderRadius: 20, fontSize: 11, cursor: 'pointer', fontFamily: 'Inter,sans-serif', transition: 'all .15s',
                          fontWeight: showAvailableOnly ? 700 : 400, border: `1px solid ${showAvailableOnly ? 'var(--meadow-border)' : TV.border}`, background: showAvailableOnly ? 'var(--meadow-soft)' : 'var(--surface)', color: showAvailableOnly ? 'var(--meadow)' : TV.muted,
                        }}>
                          <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><path d="M20 6 9 17l-5-5"/></svg>
                          Available rooms only
                        </button>
                      </div>
                    </div>
                  </div>

                  <div style={{ height: 1, background: TV.border, width: '100%' }} />

                  {/* Row 2: Program, Year, Block */}
                  <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 16 }}>
                    <div>
                      <p style={{ fontSize: 9.5, fontWeight: 700, color: TV.muted, textTransform: 'uppercase', letterSpacing: '.7px', marginBottom: 6 }}>Program</p>
                      <div style={{ display: 'flex', gap: 5, flexWrap: 'wrap' }}>
                        {options.allPrograms.map(p => (<button key={p} className={`sv-chip${filterPrograms.has(p) ? ' active' : ''}`} onClick={() => toggles.program(p)}>{p}</button>))}
                      </div>
                    </div>
                    <div>
                      <p style={{ fontSize: 9.5, fontWeight: 700, color: TV.muted, textTransform: 'uppercase', letterSpacing: '.7px', marginBottom: 6 }}>Year</p>
                      <div style={{ display: 'flex', gap: 5, flexWrap: 'wrap' }}>
                        {options.allYears.map(y => (<button key={y} className={`sv-chip${filterYears.has(y) ? ' active' : ''}`} onClick={() => toggles.year(y)}>Yr {y}</button>))}
                      </div>
                    </div>
                    <div>
                      <p style={{ fontSize: 9.5, fontWeight: 700, color: TV.muted, textTransform: 'uppercase', letterSpacing: '.7px', marginBottom: 6 }}>Block</p>
                      <div style={{ display: 'flex', gap: 5, flexWrap: 'wrap' }}>
                        {options.allBlocks.map(b => (<button key={b} className={`sv-chip${filterBlocks.has(b) ? ' active' : ''}`} onClick={() => toggles.block(b)}>{b}</button>))}
                      </div>
                    </div>
                  </div>

                  <div style={{ height: 1, background: TV.border, width: '100%' }} />

                  {/* Row 3: Faculty, Room, Session Modal Triggers */}
                  <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 16 }}>
                    <div>
                      <p style={{ fontSize: 9.5, fontWeight: 700, color: TV.muted, textTransform: 'uppercase', letterSpacing: '.7px', marginBottom: 6 }}>Faculty</p>
                      <FilterButton active={filterFac.size > 0} count={filterFac.size} onClick={() => { setMaximizeFilterOpen(false); setOpenModal('faculty') }} />
                    </div>
                    <div>
                      <p style={{ fontSize: 9.5, fontWeight: 700, color: TV.muted, textTransform: 'uppercase', letterSpacing: '.7px', marginBottom: 6 }}>Room</p>
                      <FilterButton active={filterRooms.size > 0} count={filterRooms.size} onClick={() => { setMaximizeFilterOpen(false); setOpenModal('room') }} />
                    </div>
                    <div>
                      <p style={{ fontSize: 9.5, fontWeight: 700, color: TV.muted, textTransform: 'uppercase', letterSpacing: '.7px', marginBottom: 6 }}>Session</p>
                      <div style={{ display: 'flex', gap: 5, flexWrap: 'wrap' }}>
                        <button className={`sv-chip${filterLec ? ' active' : ''}`} onClick={() => setFilterLec(!filterLec)}>Lecture</button>
                        <button className={`sv-chip${filterLab ? ' active' : ''}`} onClick={() => setFilterLab(!filterLab)}>Laboratory</button>
                      </div>
                    </div>
                  </div>

                </div>

                {/* Footer */}
                <div style={{
                  flexShrink: 0, padding: '12px 20px', borderTop: `1px solid ${TV.border}`,
                  display: 'flex', alignItems: 'center', justifyContent: 'space-between', background: 'var(--bg)',
                }}>
                  <span style={{ fontSize: 11.5, color: TV.muted, fontWeight: 500 }}>
                    {dayEvents.length} session{dayEvents.length !== 1 ? 's' : ''} shown
                  </span>
                  <div style={{ display: 'flex', gap: 8 }}>
                    {localHasFilters && (
                      <button onClick={() => { handleClearAll(); }} style={{
                        padding: '6px 14px', borderRadius: 8, fontSize: 11.5, fontWeight: 600,
                        border: '1px solid #fecaca', background: 'rgba(220, 38, 38, 0.05)', color: '#EF4444',
                        cursor: 'pointer', fontFamily: 'Inter,sans-serif',
                      }}>
                        ✕ Clear all
                      </button>
                    )}
                    <button onClick={() => setMaximizeFilterOpen(false)} style={{
                      padding: '6px 18px', borderRadius: 8, fontSize: 11.5, fontWeight: 600,
                      border: 'none', background: TV.deep, color: '#fff',
                      cursor: 'pointer', fontFamily: 'Inter,sans-serif',
                    }}>
                      Done
                    </button>
                  </div>
                </div>
              </div>
            </ModalOverlay>
          )}
        </div>
      ) : (
        <div id="tour-sv-grid" style={{
          background: 'var(--surface)', border:`1px solid ${TV.border}`, borderRadius:14,
          overflow:'hidden', boxShadow:'0 1px 4px rgba(0,0,0,.07)',
          display:'flex', flexDirection:'column', width:'100%', minWidth:0,
          padding:'12px 14px 0',
        }}>
          <div id="tour-sv-conflicts"><ConflictSummaryBar conflictMap={conflictMap} /></div>
          {visibleRooms.length === 0
            ? <EmptyState hasFilters={localHasFilters} onClear={handleClearAll} />
            : (
              <TimeGrid
                rooms={visibleRooms}
                dayEvents={dayEvents}
                conflictMap={conflictMap}
                draggedEvent={dd.draggedEvent}
                hoveredCell={dd.hoveredCell}
                getDropConflict={dd.getDropConflict}
                onDragStart={dd.handleDragStart}
                onDragEnd={dd.handleDragEnd}
                onDragOver={dd.handleDragOver}
                onDragLeave={dd.handleDragLeave}
                onDrop={dd.handleDrop}
                onCardClick={setSelectedEvent}
                locked={schedFinalized}
                gridSize={gridSize}
                conflictingDragIds={dd.conflictingDragIds}
                ambientConflictIds={dd.ambientConflictIds}
                ambientMergeIds={dd.ambientMergeIds}
                dragConflictBands={dd.dragConflictBands}
                mergedIds={mergedIds}
                allEvents={allEvents}
                availabilityMap={availabilityMap}
                highlightAvailable={showAvailableOnly}
              />
            )
          }
        </div>
      )}

      {/* ── Modals ───────────────────────────────────────────────────────── */}
      {selectedEvent && (
        <SessionModal
          event={selectedEvent}
          allEvents={allEvents}
          onClose={() => setSelectedEvent(null)}
          masterRooms={masterRooms}
          masterFacultyList={masterFacultyList}
          readOnly={schedFinalized}
          onSaved={(updates) => {
            setSelectedEvent(null)
            if (!updates) return
            const arr = Array.isArray(updates) ? updates : [updates]
            const patchMap = new Map(arr.map(u => [getEventId(u), u]))
            syncLocalEvents(localEvents.map(e =>
              patchMap.has(getEventId(e)) ? { ...e, ...patchMap.get(getEventId(e)) } : e
            ))
          }}
        />
      )}
      {openModal === 'faculty' && (
        <FacultyFilterModal title="Filter by Faculty" options={options.allFaculty}
          selectedSet={filterFac} onToggle={toggles.faculty} onClose={() => setOpenModal(null)}
          masterFacultyList={masterFacultyList}
          allEvents={allEvents}
          
          />
          
      )}
      {openModal === 'room' && (
        <RoomFilterModal title="Filter by Room" options={options.allRooms}
          selectedSet={filterRooms} onToggle={toggles.room}
          masterRooms={masterRooms} availableRooms={availableRoomSet}
          sessionCounts={roomSessionCounts}
          onClose={() => setOpenModal(null)} />

      )}

      {/* ── Finalize confirmation modal ───────────────────────────────────── */}
      {showFinalizeModal && (
        <ModalOverlay onClose={() => setShowFinalizeModal(false)}>
          <div style={{ background: 'var(--surface)', borderRadius:16, width:420, padding:'28px 30px', boxShadow:'0 24px 60px rgba(0,0,0,0.25)', border:`1px solid ${TV.border}`, fontFamily:'Inter,sans-serif' }}
            onClick={e => e.stopPropagation()}>
            <div style={{ display:'flex', alignItems:'flex-start', gap:14, marginBottom:20 }}>
              <div style={{ width:40, height:40, borderRadius:11, background:'var(--meadow-soft)', display:'flex', alignItems:'center', justifyContent:'center', flexShrink:0 }}>
                <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="var(--meadow)" strokeWidth="2.5"><polyline points="20 6 9 17 4 12"/></svg>
              </div>
              <div>
                <h3 style={{ margin:0, fontSize:15, fontWeight:700, color: 'var(--ink)' }}>Finalize Schedule</h3>
                <p style={{ margin:'5px 0 0', fontSize:12.5, color: 'var(--muted2)', lineHeight:1.5 }}>
                  This will publish <strong>{activeName}</strong>{schedAY || schedSem ? ` (${[schedAY ? `A.Y. ${schedAY}` : '', schedSem].filter(Boolean).join(', ')})` : ''} to faculty.
                  Any other finalized schedule for the same period will be replaced.
                </p>
              </div>
            </div>
            <div style={{ display:'flex', gap:8, justifyContent:'flex-end' }}>
              <button onClick={() => setShowFinalizeModal(false)}
                style={{ padding:'8px 18px', borderRadius:9, border:`1.5px solid ${TV.border}`, background: 'var(--surface)', color: 'var(--muted)', fontSize:12.5, fontWeight:600, cursor:'pointer', fontFamily:'Inter,sans-serif' }}>
                Cancel
              </button>
              <button onClick={handleFinalize} disabled={finalizingState === 'working'}
                style={{ padding:'8px 22px', borderRadius:9, border:'none', background:'linear-gradient(135deg,var(--meadow),var(--meadow-deep))', color: '#fff', fontSize:12.5, fontWeight:700, cursor:'pointer', fontFamily:'Inter,sans-serif', boxShadow:'0 3px 12px rgba(0,0,0,0.25)', opacity: finalizingState === 'working' ? 0.7 : 1 }}>
                {finalizingState === 'working' ? 'Finalizing…' : 'Yes, Finalize'}
              </button>
            </div>
          </div>
        </ModalOverlay>
      )}

      {/* ── Override confirmation modal ────────────────────────────────── */}
      {/* Shown instead of blocking when a conflicting drop is attempted    */}
      <OverrideConfirmModal
        pendingDrop={dd.pendingDrop}
        onConfirm={dd.confirmDrop}
        onCancel={dd.cancelDrop}
      />

      {dd.toast && (
        <Toast
          type={dd.toast.type}
          onDismiss={() => dd.setToast(null)}
          message={
            <span style={{ display:'inline-flex', alignItems:'center', gap:6 }}>
              {dd.toast.icon === 'link' && (
                <svg width={13} height={13} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" style={{flexShrink:0}}>
                  <path d="M10 13a5 5 0 0 0 7.54.54l3-3a5 5 0 0 0-7.07-7.07l-1.72 1.71"/>
                  <path d="M14 11a5 5 0 0 0-7.54-.54l-3 3a5 5 0 0 0 7.07 7.07l1.71-1.71"/>
                </svg>
              )}
              {dd.toast.icon === 'unlink' && (
                <svg width={13} height={13} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" style={{flexShrink:0}}>
                  <path d="M10 13a5 5 0 0 0 7.54.54l3-3a5 5 0 0 0-7.07-7.07l-1.72 1.71"/>
                  <path d="M14 11a5 5 0 0 0-7.54-.54l-3 3a5 5 0 0 0 7.07 7.07l1.71-1.71"/>
                  <line x1="2" y1="2" x2="22" y2="22"/>
                </svg>
              )}
              {dd.toast.message}
            </span>
          }
        />
      )}

      {/* ── Version History Modal ─────────────────────────────────────────── */}
      {showVersionHistory && (
        <VersionHistoryModal
          versionHistory={scheduleMeta?.versionHistory || []}
          currentVersion={scheduleMeta?.restoredFromVersion ?? scheduleMeta?.version ?? 1}
          currentSavedAt={scheduleMeta?.restoredAt ?? scheduleMeta?.savedAt}
          isRestoredPreview={!!scheduleMeta?.restoredFromVersion}
          scheduleName={activeName}
          onClose={() => setShowVersionHistory(false)}
          onRestore={async (restoreResult) => {
            // A restore replaces the whole schedule — any local overrides
            // still queued from drag-and-drop reference the pre-restore
            // events and would otherwise sit around and get silently
            // auto-saved on top of the restored data a few seconds later.
            dd.revertAllOverrides()
            // Reload events from Firestore (backend already swapped them)
            await loadSchedule(activeName, { force: true })
            // Mark as unsaved so the user decides whether to keep the restored state
            setHasUnsavedChanges(true)
            setCopyToast({
              type: 'success',
              message: `Loaded v${restoreResult.fromVersion} — review and save to keep it`
            })
            setTimeout(() => setCopyToast(null), 5000)
          }}
        />
      )}

      {/* ── Copy / restore toast ──────────────────────────────────────────── */}
      {copyToast && (
        <Toast
          type={copyToast.type}
          message={copyToast.message}
          onDismiss={() => setCopyToast(null)}
        />
      )}
    </div>
  )
}

/* ── List view ───────────────────────────────────────────────────────────── */
function ListView({ dayEvents, conflictMap, hasFilters, clearFilters, onCardClick, mergedIds }) {
  if (dayEvents.length === 0) return <EmptyState hasFilters={hasFilters} onClear={clearFilters} />
  return (
    <div style={{ background: 'var(--surface)', border:`1px solid ${TV.border}`, borderRadius:14, overflow:'hidden' }}>
      <table style={{ width:'100%', borderCollapse:'collapse', fontSize:12.5 }}>
        <thead>
          <tr style={{ background:'var(--bg)' }}>
            {['Time','Course','Section','Type','Faculty','Room','Status'].map(h => (
              <th key={h} style={{ padding:'10px 14px', textAlign:'left', fontSize:10.5, fontWeight:700, color:TV.muted, textTransform:'uppercase', letterSpacing:'.6px', borderBottom:`1px solid ${TV.border}`, whiteSpace:'nowrap' }}>
                {h}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {dayEvents.map((ev, i) => {
            const evId     = `${ev.schedule_id ?? `${ev.courseCode}-${ev.block}-${ev.session}-${ev.day}`}`
            const conf     = conflictMap.get(evId)
            const merged   = mergedIds.has(evId)
            const noFaculty = (!ev.faculty || ev.faculty === 'TBA') && !svIsOtherDept(ev.courseCode)
            const isExtManaged = (!ev.faculty || ev.faculty === 'TBA') && svIsOtherDept(ev.courseCode)
            const isLab    = ev.session?.toUpperCase().includes('LAB')
            const sessionType = isLab ? 'LAB' : 'LEC'
            return (
              <tr key={evId}
                onClick={() => onCardClick(ev)}
                style={{ borderBottom:`1px solid ${TV.border}`, cursor:'pointer', background:i%2===0? 'var(--surface)':'var(--bg)', transition:'background .12s' }}
                onMouseEnter={e => e.currentTarget.style.background = TV.pale}
                onMouseLeave={e => e.currentTarget.style.background = i%2===0? 'var(--surface)':'var(--bg)'}
              >
                <td style={{ padding:'10px 14px', whiteSpace:'nowrap', fontSize:11.5, color:TV.muted }}>{ev.period}</td>
                <td style={{ padding:'10px 14px' }}>
                  <span style={{ fontWeight:700, color:TV.text }}>{ev.courseCode}</span>
                  {ev.title && <span style={{ display:'block', fontSize:10.5, color:TV.muted, marginTop:1, maxWidth:180, overflow:'hidden', textOverflow:'ellipsis', whiteSpace:'nowrap' }}>{ev.title}</span>}
                </td>
                <td style={{ padding:'10px 14px', whiteSpace:'nowrap' }}>
                  <span style={{ fontSize:11.5, fontWeight:600, color:TV.deep, background:TV.pale, padding:'2px 7px', borderRadius:5, border:`1px solid ${TV.light}` }}>
                    {ev.program}{ev.year}{ev.block}
                  </span>
                </td>
                <td style={{ padding:'10px 14px', whiteSpace:'nowrap' }}>
                  <span style={{ fontSize:9, fontWeight:800, letterSpacing:'0.5px', color:isLab?TV.deep:TV.text, background:isLab?`rgba(0,0,0,.12)`:`rgba(0,0,0,.04)`, border:`1px solid ${isLab?TV.mid:TV.border}`, padding:'2px 6px', borderRadius:4 }}>
                    {sessionType}
                  </span>
                </td>
                <td style={{ padding:'10px 14px', fontSize:12, maxWidth:150, overflow:'hidden', textOverflow:'ellipsis', whiteSpace:'nowrap' }}>
                  {isExtManaged ? <span style={{ color:'var(--mint)', fontWeight:500 }}>Ext. managed</span> : noFaculty ? <span style={{ color:'#f59e0b', fontWeight:600 }}>Unassigned</span> : <span style={{ color:TV.text }}>{ev.faculty}</span>}
                </td>
                <td style={{ padding:'10px 14px', fontSize:12, color:TV.text, whiteSpace:'nowrap' }}>
                  {ev.room && ev.room !== 'TBA' ? ev.room : <span style={{ color:TV.muted }}>TBA</span>}
                </td>
                <td style={{ padding:'10px 14px' }}>
                  <div style={{ display:'flex', gap:5, flexWrap:'wrap' }}>
                    {/* Only show a conflict badge if the session isn't merged,
                        OR if it's merged but the conflict is NOT just a room
                        overlap with the merge partner (e.g. it also has a
                        faculty / section conflict). */}
                    {conf && !(merged && conf.label === 'Room Conflict') && (
                      <span style={{ display:'inline-flex', alignItems:'center', gap:4, fontSize:9.5, fontWeight:700, background:'rgba(239, 68, 68, 0.05)', color:'#EF4444', border:'1px solid #fecaca', borderRadius:4, padding:'2px 6px' }}>
                        <svg width={9} height={9} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><path d="M10.29 3.86L1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z"/><line x1="12" y1="9" x2="12" y2="13"/><line x1="12" y1="17" x2="12.01" y2="17"/></svg>
                        {conf.label}
                      </span>
                    )}
                    {merged && (
                      <span style={{ display:'inline-flex', alignItems:'center', gap:4, fontSize:9.5, fontWeight:700, background:TV.pale, color:TV.deep, border:`1px solid ${TV.light}`, borderRadius:4, padding:'2px 6px' }}>
                        <svg width={9} height={9} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><path d="M10 13a5 5 0 0 0 7.54.54l3-3a5 5 0 0 0-7.07-7.07l-1.72 1.71"/><path d="M14 11a5 5 0 0 0-7.54-.54l-3 3a5 5 0 0 0 7.07 7.07l1.71-1.71"/></svg>
                        Merge
                      </span>
                    )}
                    {isExtManaged && <span style={{ display:'inline-flex', alignItems:'center', gap:4, fontSize:9.5, fontWeight:600, background:'var(--meadow-soft)', color: 'var(--meadow)', border:'1px solid var(--meadow-border)', borderRadius:4, padding:'2px 6px' }}>Ext. managed</span>}
                    {noFaculty && !isExtManaged && <span style={{ display:'inline-flex', alignItems:'center', gap:4, fontSize:9.5, fontWeight:700, background:'rgba(245, 158, 11, 0.05)', color:'#92400e', border:'1px solid #fcd34d', borderRadius:4, padding:'2px 6px' }}>Unassigned</span>}
                    {!conf && !merged && !noFaculty && <span style={{ fontSize:9.5, color:TV.muted }}>—</span>}
                    {/* Edge case: merged but also has a real non-room conflict */}
                    {conf && merged && conf.label === 'Room Conflict' && (
                      // Already suppressed above — merge badge above covers this
                      null
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