import { useEffect, useState, useMemo, useCallback } from 'react'
import { useParams, useNavigate, useLocation } from 'react-router-dom'
import { useScheduleStore } from '../../store/scheduleStore'
import { useAuth } from '../../hooks/useAuth'
import {
  coordLoadSchedule, coordSaveScheduleInPlace, coordOverrideSession,
  coordSubmitSchedule, coordUnsubmitSchedule, coordGetRooms, getFaculty,
  coordRestoreScheduleVersion, coordGetScheduleVersionDiff,
  coordGetSubmittedSchedule, coordListSchedules, coordCheckTurn,
} from '../../services/api'

// Special :id value used for the read-only "combined schedule so far" view —
// there's no single schedule doc behind it, just the merged events from
// whichever programs ahead in the queue have already been approved.
const MASTER_VIEW_ID = 'master'
import { buildConflictMap, DAYS, getEventId, getMergedIds } from '../../components/ScheduleView/svHelpers'
import { TV, ConflictSummaryBar, Toast, FilterButton, FilterRow, PendingChangesBar, ProgramLegend, ModalOverlay, ModalHeader } from '../../components/ScheduleView/svPrimitives'
import { useFilters, useDragDrop } from '../../components/ScheduleView/svHooks'
import { FilterModal, FacultyFilterModal, RoomFilterModal, OverrideConfirmModal } from '../../components/ScheduleView/FilterModals'
import TimeGrid from '../../components/ScheduleView/TimeGrid'
import SessionModal from '../../components/ScheduleView/SessionModal'
import VersionHistoryModal from '../../components/VersionHistoryModal'
import { computeRoomAvailability } from '../../utils/roomAvailability'
import { exportScheduleToExcel } from '../../utils/exportScheduleToExcel'
import { useTour } from '../../hooks/useTour.jsx'
import scheduleImage from '../../assets/SCHEDULE.png'

const TOUR_SEEN_KEY = 'coordScheduleView_tourSeen'
function isOnboardingCompleted() {
  try { return localStorage.getItem(TOUR_SEEN_KEY) === '1' } catch { return true }
}
function markOnboardingCompleted() {
  try { localStorage.setItem(TOUR_SEEN_KEY, '1') } catch {}
}

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
      cursor:pointer; border:1px solid #D8E8DF; background:#fff; color:#4B7060;
      transition:all .15s; font-family:'Inter',sans-serif; white-space:nowrap;
    }
    .sv-day-btn:hover  { background:#EBF4EF; color:#0F5C2C; }
    .sv-day-btn.active {
      background:linear-gradient(135deg,#15803D,#0F5C2C); color:#fff;
      border-color:transparent; box-shadow:0 2px 8px rgba(21,128,61,.3);
    }

    .sv-icon-btn {
      display:inline-flex; align-items:center; justify-content:center;
      width:30px; height:30px; border-radius:8px; border:1px solid #D8E8DF;
      background:#fff; color:#4B7060; cursor:pointer; transition:all .15s;
      flex-shrink:0; padding:0;
    }
    .sv-icon-btn:hover:not(:disabled)  { background:#DCFCE7; color:#15803D; border-color:#BBF7D0; }
    .sv-icon-btn.active { background:#DCFCE7; border-color:#6EE7B7; color:#0F5C2C; }

    .sv-search {
      padding:7px 12px 7px 32px; border-radius:20px; border:1px solid #D8E8DF;
      font-size:12.5px; font-family:'Inter',sans-serif; color:#0E2A20;
      background:#fff; outline:none; width:190px; transition:all .15s;
    }
    .sv-search:focus { border-color:#6EE7B7; box-shadow:0 0 0 3px rgba(21,128,61,.12); width:220px; }
    .sv-search::placeholder { color:#6B8C7A; }

    .sv-chip {
      padding:3px 10px; border-radius:20px; font-size:11px; cursor:pointer;
      border:1px solid #D8E8DF; background:#fff; color:#4B7060; font-weight:400;
      font-family:'Inter',sans-serif; transition:all .15s; white-space:nowrap;
    }
    .sv-chip:hover  { background:#EBF4EF; color:#0F5C2C; border-color:#BBF7D0; }
    .sv-chip.active { border-color:#6EE7B7; background:#DCFCE7; color:#0E2A20; font-weight:600; }

    .sv-sched-wrap { position:relative; display:inline-flex; align-items:center; }
    .sv-sched-select {
      appearance:none; -webkit-appearance:none;
      padding:6px 28px 6px 30px; border-radius:9px;
      border:1.5px solid #D8E8DF; font-size:12px;
      font-family:'Inter',sans-serif; color:#0E2A20;
      background:#fff; cursor:pointer; outline:none;
      font-weight:500; transition:border-color .15s, box-shadow .15s;
      min-width:140px; max-width:210px;
    }
    .sv-sched-select:hover  { border-color:#BBF7D0; }
    .sv-sched-select:focus  { border-color:#6EE7B7; box-shadow:0 0 0 3px rgba(21,128,61,.12); }
    .sv-sched-select:disabled { opacity:.6; cursor:default; }

    .sv-save-btn {
      display:inline-flex; align-items:center; gap:5px;
      padding:6px 10px; border-radius:9px; border:1.5px solid #D8E8DF;
      background:#fff; color:#0E2A20; font-size:12px; font-weight:600;
      font-family:'Inter',sans-serif; cursor:pointer; transition:all .2s;
      white-space:nowrap; flex-shrink:0;
    }
    .sv-save-btn:hover:not(:disabled) { background:#DCFCE7; border-color:#6EE7B7; }
    .sv-save-btn:disabled { opacity:.65; cursor:default; }
    .sv-save-btn.saved  { background:#ecfdf5; border-color:#6ee7b7; color:#059669; }
    .sv-save-btn.failed { background:#fff8f8; border-color:#fca5a5; color:#dc2626; }
    .sv-save-btn.unsaved { background:#fffbeb; border-color:#fde68a; color:#d97706; }

    .sv-view-group { display:flex; border:1px solid #D8E8DF; border-radius:8px; overflow:hidden; background:#fff; }
    .sv-view-btn {
      display:flex; align-items:center; gap:5px; padding:5px 11px;
      font-size:11.5px; font-family:'Inter',sans-serif;
      border:none; cursor:pointer; transition:all .15s; white-space:nowrap;
    }
    .sv-view-btn.active { background:#DCFCE7; color:#0E2A20; font-weight:700; }
    .sv-view-btn:not(.active) { background:transparent; color:#4B7060; font-weight:400; }
    .sv-view-btn:not(.active):hover { background:#EBF4EF; color:#0F5C2C; }

    .sv-shimmer {
      background: linear-gradient(90deg,#EBF4EF 25%,#D8E8DF 50%,#EBF4EF 75%);
      background-size: 400px 100%;
      animation: svShimmer 1.2s ease-in-out infinite;
      border-radius:6px;
    }

    .sv-stats-row {
      display:flex; background:#fff; border:1px solid #D8E8DF;
      border-radius:10px; overflow:hidden;
      box-shadow:0 1px 4px rgba(10,46,28,.06);
      margin-bottom:14px;
    }
    .sv-stat-cell {
      flex:1; padding:9px 14px; min-width:0;
      border-right:1px solid #D8E8DF;
      display:flex; flex-direction:column; gap:1px;
    }
    .sv-stat-cell:last-child { border-right:none; }

    .sv-save-status-saved { background:#ecfdf5; border-color:#6ee7b7; }
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
      border-color: #6ee7b7;
      color: #059669;
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
      background: #fff;
      border-color: #d1d5db;
      color: #374151;
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
      color: #111827;
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
      color: #111827;
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
      border-bottom: 1px solid #bbf7d0;
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
      background: #22c55e;
      color: white;
    }
    .sv-version-details {
      flex: 1;
      min-width: 0;
    }
    .sv-version-label {
      font-size: 13px;
      font-weight: 600;
      color: #111827;
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
      stroke={full ? '#15803D' : TV.deep} strokeWidth="2.2"
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
        <button onClick={onClear} style={{ padding:'7px 16px', fontSize:12, fontWeight:600, borderRadius:8, border:`1px solid ${TV.border}`, background:'#fff', color:TV.deep, cursor:'pointer', fontFamily:'Inter,sans-serif' }}>
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
    padding: '9px 14px', fontSize: 12.5, fontWeight: 600, color: '#0E2A20',
    background: '#fff', border: 'none', cursor: 'pointer',
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
            background: '#fff', border: '1px solid #D8E8DF', borderRadius: 10,
            boxShadow: '0 12px 32px rgba(10,46,28,.16)', minWidth: 210, overflow: 'hidden',
          }}>
            <button
              onClick={() => { setOpen(false); onExportSchedule() }}
              style={{ ...itemStyle, borderBottom: '1px solid #EEF3F0' }}
              onMouseEnter={e => e.currentTarget.style.background = '#F0FDF4'}
              onMouseLeave={e => e.currentTarget.style.background = '#fff'}
            >
              <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/><polyline points="7 10 12 15 17 10"/><line x1="12" y1="15" x2="12" y2="3"/>
              </svg>
              Schedule (.xlsx)
            </button>
            <button
              onClick={() => { setOpen(false); onExportRooms() }}
              style={itemStyle}
              onMouseEnter={e => e.currentTarget.style.background = '#F0FDF4'}
              onMouseLeave={e => e.currentTarget.style.background = '#fff'}
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
export default function CoordScheduleViewPage() {
  const { id } = useParams()
  const navigate = useNavigate()
  const { search } = useLocation()
  const overlayId = new URLSearchParams(search).get('overlay')
  const { coordinatorProgram } = useAuth()
  const { events:storeEvents, scheduleName:storeName, setEvents, setName } = useScheduleStore()

  const [localEvents,       setLocalEvents]   = useState(storeEvents)
  const [past,              setPast]          = useState([])
  const [future,            setFuture]        = useState([])
  const [masterRooms,       setMasterRooms]   = useState({ lecture:[], lab:[] })
  const [masterFacultyList, setMasterFaculty] = useState([])
  const [activeName,        setActiveName]    = useState(storeName)
  const [schedAY,           setSchedAY]       = useState('')
  const [schedSem,          setSchedSem]      = useState('')
  const [activeDay,         setActiveDay]     = useState('Monday')
  const [initLoading,       setInitLoading]   = useState(true)
  const [loading,           setLoading]       = useState(false)
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

  const { TourElement, startTour } = useTour('coordScheduleView', [
    { 
      target: '#tour-sv-filters', 
      title: 'Advanced Filtering',
      content: 'Filter the schedule by specific programs, faculty members, or rooms. This is the fastest way to hunt down conflicts or check a specific professor\'s workload.', 
      placement: 'bottom' 
    },
    { 
      target: '#tour-sv-grid', 
      title: 'Interactive Grid',
      content: 'Drag and drop sessions to assign faculty, change rooms, or move timeslots. The system will warn you if you create a conflict.', 
      placement: 'left' 
    },
  ], !loading)

  

  /* ── Schedule status (draft / submitted / approved) ─────────────────────── */
  const [status,            setStatus]        = useState('draft')
  const [scheduleMeta,      setScheduleMeta]  = useState(null)
  const [actionState,       setActionState]   = useState('idle') // 'idle' | 'working' | 'done' | 'error' — for Submit/Unsubmit
  const [actionError,       setActionError]   = useState('') // message shown when Submit/Unsubmit is rejected (e.g. term already has a submission)
  const [hasUnsavedChanges, setHasUnsavedChanges] = useState(false)
  const [showVersionHistory, setShowVersionHistory] = useState(false)

  // Editing (drag-drop, overrides, Save) is only allowed while still a
  // draft — mirrors the admin page's "locked while finalized" behavior,
  // just keyed off the coordinator workflow's status instead.
  const isMasterView = id === MASTER_VIEW_ID
  const locked = (isMasterView && !overlayId) || status !== 'draft'

  /* ── Bootstrap ──────────────────────────────────────────────────────────── */
  useEffect(() => {
    Promise.all([coordGetRooms(), getFaculty()])
      .then(([r, f]) => { setMasterRooms(r); setMasterFaculty(f) })
      .catch(() => {})
      .finally(() => setInitLoading(false))
  }, [])

  /* ── Load schedule (pinned to the route's :id — no schedule switcher) ─────
     :id === 'master' is a special case: instead of one draft/submitted doc,
     it pulls the merged events from every program already approved ahead of
     this coordinator in the queue. There's no doc behind it, so it's always
     rendered read-only (status is forced to 'approved', which the header/
     save/submit logic below already treats as locked). */
  async function loadSchedule() {
    if (!id) return
    setLoading(true); setError(null); setSaveState('idle')
    try {
      if (isMasterView) {
        // The queue endpoint only returns programs already approved *ahead*
        // of this coordinator — it never includes this coordinator's own
        // schedule, even once it's approved too. Pull that in separately
        // and merge it in so "Combined Schedule (Approved So Far)" actually
        // includes your own approved schedule once you have one. Scoped to
        // the *active queue's* academic term only — a coordinator can have
        // approved schedules from unrelated past/future terms sitting in
        // "My Schedules", and those must never bleed into this term's view.
        const [data, mine, turn] = await Promise.all([
          coordGetSubmittedSchedule(true).catch(() => null),
          coordListSchedules().catch(() => []),
          coordCheckTurn().catch(() => null),
        ])
        const queueEvents = data?.schedule || []
        const approvedInMaster = data?.approvedPrograms || []
        const roundAY = turn?.academicYear
        const roundSem = turn?.semester
        const myProgram = turn?.queue?.find(q =>
          (typeof q === 'string' ? q : q.program) === (coordinatorProgram || '')
        )
        const myProgramInMaster = approvedInMaster.includes(coordinatorProgram || '')
        const myApproved = myProgramInMaster ? [] : (Array.isArray(mine) ? mine : []).filter(s =>
          s.status === 'approved' &&
          (!roundAY || s.academicYear === roundAY) &&
          (!roundSem || s.semester === roundSem)
        )
        const myApprovedEvents = myApproved.length
          ? (await Promise.all(myApproved.map(s => coordLoadSchedule(s.id).catch(() => null))))
              .filter(Boolean)
              .flatMap(d => d.schedule || [])
          : []
          
        let overlayEvents = []
        let overlayData = null
        if (overlayId) {
          overlayData = await coordLoadSchedule(overlayId).catch(() => null)
          overlayEvents = overlayData?.schedule || []
        }
        
        // Mark events appropriately
        const myProgramName = coordinatorProgram || ''
        const overEvents = overlayEvents.map(e => ({ ...e, _isOtherProgram: false, _isReadonly: false }))
        const overlayEventIds = new Set(overEvents.map(getEventId))
        
        const qEvents = queueEvents
          .filter(e => !overlayEventIds.has(getEventId(e)))
          .map(e => ({ ...e, _isOtherProgram: e.program !== myProgramName, _isReadonly: true }))
          
        const myApprEvents = myApprovedEvents
          .filter(e => !overlayEventIds.has(getEventId(e)))
          .map(e => ({ ...e, _isOtherProgram: false, _isReadonly: true }))
        
        const events = [...qEvents, ...myApprEvents, ...overEvents]
        setLocalEvents(events); setEvents(events)
        setPast([]); setFuture([])
        
        const finalName = overlayId ? 'Combined Schedule (with Draft Overlay)' : 'Combined Schedule (Approved So Far)'
        setActiveName(finalName); setName(finalName)
        setSchedAY(roundAY || ''); setSchedSem(roundSem || '')
        setStatus(overlayId ? (overlayData?.status || 'draft') : 'approved')
        setHasUnsavedChanges(false)
        setScheduleMeta({
          version: overlayData?.version || 1, savedAt: overlayData?.updatedAt || overlayData?.createdAt || null, eventCount: events.length,
          versionHistory: overlayData?.versionHistory || [], restoredFromVersion: null, restoredAt: null,
        })
      } else {
        const data = await coordLoadSchedule(id)
        const events = data.schedule || []
        setLocalEvents(events); setEvents(events)
        setPast([]); setFuture([])
        setActiveName(data.name || 'Schedule'); setName(data.name || 'Schedule')
        setSchedAY(data.academicYear || ''); setSchedSem(data.semester || '')
        setStatus(data.status || 'draft')
        setHasUnsavedChanges(false)
        setScheduleMeta({
          version:        data.version || 1,
          savedAt:        data.updatedAt || data.createdAt,
          eventCount:     events.length,
          versionHistory: data.versionHistory || [],
          restoredFromVersion: data.restoredFromVersion || null,
          restoredAt:          data.restoredAt || null,
        })
      }
    } catch { setError(isMasterView ? 'Failed to load the combined schedule.' : 'Failed to load this schedule.') }
    finally   { setLoading(false) }
  }

  useEffect(() => {
    if (!initLoading) loadSchedule()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [initLoading, id])

  /* ── Override calls scoped to THIS schedule doc ──────────────────────────
     Injected into useDragDrop / SessionModal below so drag-and-drop and the
     session editor hit the coordinator-scoped endpoint (ownership + draft-
     only checked server-side) instead of the admin-only one they default to. */
  const overrideFn = useCallback(payload => {
    if (isMasterView && !overlayId) return Promise.reject(new Error('read-only'))
    const targetId = (isMasterView && overlayId) ? overlayId : id
    return coordOverrideSession(targetId, payload)
  }, [id, isMasterView, overlayId])

  /* ── Save (in place) ──────────────────────────────────────────────────────
     Unlike the admin page's Save (which mints a new numbered version), this
     coordinator schedule has no versioning — it just persists the current
     board back onto the same draft doc. */
  async function handleSave() {
    const targetId = (isMasterView && overlayId) ? overlayId : id
    if (!targetId || (isMasterView && !overlayId) || saveState === 'saving' || locked) return
    setSaveState('saving')
    try {
      // Same reasoning as the admin page: flush any drag-and-drop moves still
      // sitting in dd.pendingOverrides before saving, or they won't be
      // reflected in what actually gets persisted.
      if (dd.pendingOverrides && dd.pendingOverrides.size > 0) {
        const { failed } = await dd.saveAllOverrides()
        if (failed && failed.length > 0) {
          setSaveState('error')
          setTimeout(() => setSaveState('idle'), 2200)
          return
        }
      }
      const response = await coordSaveScheduleInPlace(targetId)
      // Reload so versionHistory reflects the authoritative backend copy.
      const fresh = await coordLoadSchedule(targetId)
      setScheduleMeta({
        version:        fresh.version || response?.version || 1,
        savedAt:        fresh.updatedAt || response?.savedAt,
        eventCount:     fresh.schedule?.length ?? allEvents.length,
        versionHistory: fresh.versionHistory || [],
        restoredFromVersion: null,
        restoredAt:          null,
      })
      setSaveState('saved')
      setHasUnsavedChanges(false)
      setTimeout(() => setSaveState('idle'), 2500)
    } catch {
      setSaveState('error')
      setTimeout(() => setSaveState('idle'), 2200)
    }
  }

  /* ── Submit / Unsubmit (replaces Finalize / Unfinalize) ──────────────────── */
  async function handleSubmit() {
    if (!id || isMasterView || actionState === 'working') return
    setActionState('working')
    setActionError('')
    try {
      if (dd.pendingOverrides && dd.pendingOverrides.size > 0) {
        const { failed } = await dd.saveAllOverrides()
        if (failed && failed.length > 0) {
          setActionState('error')
          setActionError('Some changes failed to save — try again.')
          setTimeout(() => setActionState('idle'), 2200)
          return
        }
      }
      // Make sure what gets submitted for review matches what's on screen.
      if (hasUnsavedChanges) await coordSaveScheduleInPlace(id)
      await coordSubmitSchedule(id)
      setStatus('submitted')
      setActionState('done')
      setTimeout(() => setActionState('idle'), 2500)
    } catch (e) {
      // A 409 here means the term already has a submitted/approved schedule
      // for this program — only one submission per academic term is allowed.
      setActionState('error')
      setActionError(e?.response?.data?.detail || 'Submit failed — please try again.')
      setTimeout(() => setActionState('idle'), 2200)
    }
  }

  async function handleUnsubmit() {
    if (!id || isMasterView || actionState === 'working') return
    setActionState('working')
    setActionError('')
    try {
      await coordUnsubmitSchedule(id)
      setStatus('draft')
      setActionState('done')
      setTimeout(() => setActionState('idle'), 2500)
    } catch (e) {
      setActionState('error')
      setActionError(e?.response?.data?.detail || 'Unsubmit failed — please try again.')
      setTimeout(() => setActionState('idle'), 2200)
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
  const dd = useDragDrop(allEvents, activeDay, syncLocalEvents, setEvents, storeEvents, locked, overrideFn)

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
    { label:'Total overall', value: allEvents.length,    sub: 'all days', accent: '#6EE7B7' },
    { label:'Conflicts',     value: conflictMap.size,    accent: conflictMap.size  > 0 ? '#ef4444' : TV.deep, sub: 'detected'   },
    { label:'Unassigned',    value: unassignedCount,     accent: unassignedCount   > 0 ? '#f59e0b' : TV.deep, sub: 'dept courses only' },
    { label:'Faculty',       value: new Set(dayEvents.map(e => e.faculty).filter(f => f && f !== 'TBA')).size, sub: 'teaching' },
    { label:'Rooms',         value: visibleRooms.length, sub: 'in use' },
    // ── New: pending changes count in stats
    ...(dd.pendingOverrides.size > 0 ? [{ label:'Pending', value: dd.pendingOverrides.size, accent: '#d97706', sub: 'unsaved' }] : []),
  ]

  const Sep = () => <div style={{ width:1, height:20, background:TV.border, flexShrink:0 }} />

  /* ════════════════════ RENDER ════════════════════════════════════════════ */
  return (
    <div className="page" style={{ padding:'15px 15px 30px', overflowX:'hidden', width:'100%', minWidth:0 }}>
      {TourElement}
      {/* ── Header + day tabs, merged into one row to save vertical space ─── */}
      <div style={{ display:'flex', alignItems:'center', justifyContent:'space-between', gap:10, marginBottom:16, minWidth:0, flexWrap:'wrap', rowGap:8 }}>
        <div style={{ display:'flex', alignItems:'center', gap:10, minWidth:0, flex:'1 1 auto' }}>
          <button
            onClick={() => navigate('/coordinator/schedules')}
            className="sv-icon-btn"
            title="Back to My Schedules"
          >
            <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.3"><polyline points="15 18 9 12 15 6"/></svg>
          </button>

          <div style={{ minWidth:0, flexShrink:0 }}>
            <h1 className="page-title" style={{ margin:0, fontSize:15, fontWeight:700, overflow:'hidden', textOverflow:'ellipsis', whiteSpace:'nowrap', maxWidth:'20ch' }}>
              {activeName || 'Schedule'}
            </h1>
            {(schedAY || schedSem) && (
              <div style={{ fontSize:10.5, marginTop:1, color:TV.muted2, fontWeight:500, whiteSpace:'nowrap' }}>
                {[schedAY, schedSem].filter(Boolean).join(' • ')}
              </div>
            )}
          </div>

          {/* Submit/Unsubmit — same row as title, replaces admin's Finalize/Unfinalize */}
          {allEvents.length > 0 && (
            status === 'submitted' ? (
              <div style={{ display:'flex', alignItems:'center', gap:6, flexShrink:0 }}>
                <span style={{ display:'inline-flex', alignItems:'center', gap:4, padding:'3px 10px', borderRadius:99, fontSize:11, fontWeight:700, background:'#FEF3C7', color:'#92400E', border:'1px solid #FDE68A' }}>
                  <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><circle cx="12" cy="12" r="10"/><polyline points="12 6 12 12 16 14"/></svg>
                  Submitted
                </span>
                <button onClick={handleUnsubmit} disabled={actionState === 'working'}
                  style={{ padding:'3px 10px', borderRadius:7, border:'1px solid #fecaca', background:'#fff8f8', color:'#dc2626', fontSize:11, fontWeight:600, cursor:'pointer', fontFamily:'Inter,sans-serif' }}>
                  {actionState === 'working' ? 'Withdrawing…' : 'Unsubmit'}
                </button>
              </div>
            ) : status === 'approved' ? (
              <span style={{ display:'inline-flex', alignItems:'center', gap:4, padding:'3px 10px', borderRadius:99, fontSize:11, fontWeight:700, background:'#DCFCE7', color:'#15803D', border:'1px solid #BBF7D0', flexShrink:0 }}>
                <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"><polyline points="20 6 9 17 4 12"/></svg>
                Approved
              </span>
            ) : (
              <button onClick={handleSubmit} disabled={actionState === 'working'}
                style={{ display:'inline-flex', alignItems:'center', gap:5, padding:'4px 13px', borderRadius:8, border:'none', background:'linear-gradient(135deg,#15803D,#0F5C2C)', color:'#fff', fontSize:11.5, fontWeight:600, cursor:'pointer', fontFamily:'Inter,sans-serif', boxShadow:'0 2px 8px rgba(21,128,61,.25)', flexShrink:0 }}>
                <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"><line x1="22" y1="2" x2="11" y2="13"/><polygon points="22 2 15 22 11 13 2 9 22 2"/></svg>
                {actionState === 'working' ? 'Submitting…' : 'Submit'}
              </button>
            )
          )}

          {/* Day tabs live in this same row now — no separate row just for them */}
          {allEvents.length > 0 && (
            <div style={{ display:'flex', gap:6, flexWrap:'wrap', minWidth:0 }}>
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
          )}
        </div>

        <div style={{ display:'flex', gap:6, alignItems:'center', flexShrink:0, flexWrap:'wrap', justifyContent:'flex-end' }}>
          {/* Combined-schedule tab — replaces the old separate "Approved so far"
              card/link on the My Schedules list; one click switches views right
              here instead of navigating through a different page. */}
          {isMasterView ? (
            <button onClick={() => navigate('/coordinator/schedules')} className="sv-day-btn active" title="Back to your own schedule">
              <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.3" style={{ marginRight:4, verticalAlign:-1 }}><polyline points="15 18 9 12 15 6"/></svg>
              My Schedule
            </button>
          ) : (
            <button onClick={() => navigate('/coordinator/schedules/master')} className="sv-day-btn" title="View what's been approved so far — programs ahead of you in the queue, plus your own approved schedule">
              <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" style={{ marginRight:4, verticalAlign:-1 }}><rect x="3" y="4" width="18" height="18" rx="2"/><line x1="3" y1="10" x2="21" y2="10"/><line x1="16" y1="2" x2="16" y2="6"/><line x1="8" y1="2" x2="8" y2="6"/></svg>
              Approved So Far
            </button>
          )}
          {activeName && !locked && <SmartSaveButton state={saveState} onClick={handleSave} hasUnsavedChanges={hasUnsavedChanges} scheduleMeta={scheduleMeta} activeName={activeName} />}
          {activeName && scheduleMeta && scheduleMeta.versionHistory && scheduleMeta.versionHistory.length > 0 && (
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
          {allEvents.length > 0 && (
            <ExportMenuButton onExportSchedule={handleExport} onExportRooms={handleExportAvailableRooms} />
          )}
        </div>
      </div>

      {/* ── Submit error banner — e.g. term already has a submission ───────── */}
      {actionError && (
        <div style={{
          display:'flex', alignItems:'flex-start', gap:10, marginBottom:16,
          padding:'12px 14px', borderRadius:12, background:'#FEF2F2',
          border:'1px solid #FECACA', animation:'svSlideIn .22s ease',
        }}>
          <div style={{
            width:26, height:26, borderRadius:8, background:'#FEE2E2', color:'#DC2626',
            display:'flex', alignItems:'center', justifyContent:'center', flexShrink:0, marginTop:1,
          }}>
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.3" strokeLinecap="round" strokeLinejoin="round">
              <circle cx="12" cy="12" r="10"/><line x1="12" y1="8" x2="12" y2="12"/><line x1="12" y1="16" x2="12.01" y2="16"/>
            </svg>
          </div>
          <div style={{ flex:1, minWidth:0 }}>
            <div style={{ fontSize:12.5, fontWeight:700, color:'#991B1B', marginBottom:2 }}>
              Couldn't submit this schedule
            </div>
            <div style={{ fontSize:12, color:'#B91C1C', lineHeight:1.45 }}>
              {actionError}
            </div>
          </div>
          <button
            onClick={() => setActionError('')}
            title="Dismiss"
            style={{
              display:'flex', alignItems:'center', justifyContent:'center',
              width:22, height:22, borderRadius:6, border:'none', background:'transparent',
              color:'#B91C1C', cursor:'pointer', flexShrink:0, opacity:.7, transition:'opacity .15s, background .15s',
            }}
            onMouseEnter={e => { e.currentTarget.style.opacity = 1; e.currentTarget.style.background = '#FEE2E2' }}
            onMouseLeave={e => { e.currentTarget.style.opacity = .7; e.currentTarget.style.background = 'transparent' }}
          >
            <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.3" strokeLinecap="round" strokeLinejoin="round">
              <line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/>
            </svg>
          </button>
        </div>
      )}

      {/* ── Stats ────────────────────────────────────────────────────────── */}
      {allEvents.length > 0 && <StatsRow items={statItems} />}

      {/* ── Pending changes bar ───────────────────────────────────────────── */}
      {/* Appears below stats, above day selector — amber, prominent */}
    {!locked && (
      <PendingChangesBar
        pendingOverrides={dd.pendingOverrides}
        onSave={dd.saveAllOverrides}
        onRevertAll={dd.revertAllOverrides}
        saving={dd.saving}
        autoSaveIn={dd.autoSaveIn}
      />
    )}
 

       {/* ── Program color legend ─────────────────────────────────────────── */}
      {allEvents.length > 0 && (
        <ProgramLegend events={allEvents} />
      )}
 
      {/* ── Filters bar ──────────────────────────────────────────────────── */}
      {allEvents.length > 0 && (
        <div id="tour-sv-filters" style={{ background:'#fff', border:`1px solid ${TV.border}`, borderRadius:12, padding:'11px 14px', marginBottom:14, display:'flex', flexDirection:'column', gap:10 }}>
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
              background: filterConflicts ? '#fef2f2' : '#fff',
              color: filterConflicts ? '#b91c1c' : TV.muted,
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
              background: filterMerged ? TV.pale : '#fff',
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
              border: `1px solid ${filterUnassigned ? '#fcd34d' : TV.border}`,
              background: filterUnassigned ? '#fffbeb' : '#fff',
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
                border: `1px solid ${showAvailableOnly ? '#86EFAC' : TV.border}`,
                background: showAvailableOnly ? '#F0FDF4' : '#fff',
                color: showAvailableOnly ? '#15803D' : TV.muted,
              }}>
              <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                <path d="M20 6 9 17l-5-5"/>
              </svg>
              Available Rooms
            </button>
            {localHasFilters && (
              <button onClick={handleClearAll} style={{
                fontSize:11.5, color:'#dc2626', background:'#fff8f8',
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
              { bg:'#fff', border:TV.border, label:'Normal', color:TV.muted },
              { bg:TV.pale, border:TV.light, label:'Merge', color:TV.deep,
                icon: <svg width="9" height="9" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"><path d="M10 13a5 5 0 0 0 7.54.54l3-3a5 5 0 0 0-7.07-7.07l-1.72 1.71"/><path d="M14 11a5 5 0 0 0-7.54-.54l-3 3a5 5 0 0 0 7.07 7.07l1.71-1.71"/></svg> },
              { bg:'#fef2f2', border:'#fecaca', label:'Conflict', color:'#b91c1c',
                icon: <svg width="9" height="9" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"><path d="M10.29 3.86L1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z"/><line x1="12" y1="9" x2="12" y2="13"/><line x1="12" y1="17" x2="12.01" y2="17"/></svg> },
              { bg:'#fffbeb', border:'#fcd34d', label:'Unassigned', color:'#92400e',
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

{/* ── View toggles (day tabs now live in the header row above) ───────── */}
      {allEvents.length > 0 && (
        <div style={{ display:'flex', alignItems:'center', justifyContent:'flex-end', gap:8, marginBottom:16, flexWrap:'wrap' }}>
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
            <div className="sv-view-group">
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
        <div style={{ background:'#fff', border:`1px solid ${TV.border}`, borderRadius:14, padding:48, textAlign:'center' }}>
          <div style={{ display:'flex', alignItems:'center', justifyContent:'center', margin:'0 auto 16px' }}>
            <img src={scheduleImage} alt="No Schedule Loaded" style={{ width: 120, height: 'auto' }} />
          </div>
          <p style={{ fontSize:15, fontWeight:700, color:TV.text, marginBottom:6 }}>No Schedule Loaded</p>
          <p style={{ fontSize:13, color:TV.muted }}>
            {error || 'This schedule has no events yet.'}
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
          background: '#fff',
          display: 'flex', flexDirection: 'column',
          fontFamily: 'Inter, sans-serif',
        }}>

          {/* ── Top bar: Unified Header (Name + Days + Controls) ── */}
          <div style={{
            flexShrink: 0,
            display: 'flex', alignItems: 'center', justifyContent: 'space-between',
            padding: '0 16px', height: 56, // Slightly taller to comfortably fit day buttons
            borderBottom: `1px solid ${TV.border}`,
            background: 'linear-gradient(to bottom,#F2F7F4,#F8FAF9)',
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
                  background: localHasFilters ? TV.pale : '#fff',
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
                  background: '#fff', color: TV.deep, fontSize: 12, fontWeight: 600,
                  cursor: 'pointer', fontFamily: 'Inter, sans-serif', transition: 'all .15s',
                }}
                onMouseEnter={e => { e.currentTarget.style.background = TV.pale; e.currentTarget.style.borderColor = TV.mid }}
                onMouseLeave={e => { e.currentTarget.style.background = '#fff'; e.currentTarget.style.borderColor = TV.border }}>
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
                  locked={locked}
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
                background: '#fff', borderRadius: 14,
                width: 680, maxWidth: '94vw', maxHeight: '88vh',
                display: 'flex', flexDirection: 'column',
                boxShadow: '0 24px 64px rgba(10,46,28,0.22)',
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
                          fontWeight: filterConflicts ? 700 : 400, border: `1px solid ${filterConflicts ? '#fca5a5' : TV.border}`, background: filterConflicts ? '#fef2f2' : '#fff', color: filterConflicts ? '#b91c1c' : TV.muted,
                        }}>
                          <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"><path d="M10.29 3.86L1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z"/><line x1="12" y1="9" x2="12" y2="13"/><line x1="12" y1="17" x2="12.01" y2="17"/></svg>
                          Conflicts only
                        </button>
                        <button onClick={() => setFilterMerged(!filterMerged)} style={{
                          display: 'inline-flex', alignItems: 'center', gap: 5, padding: '4px 10px', borderRadius: 20, fontSize: 11, cursor: 'pointer', fontFamily: 'Inter,sans-serif', transition: 'all .15s',
                          fontWeight: filterMerged ? 700 : 400, border: `1px solid ${filterMerged ? TV.light : TV.border}`, background: filterMerged ? TV.pale : '#fff', color: filterMerged ? TV.deep : TV.muted,
                        }}>
                          <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"><path d="M10 13a5 5 0 0 0 7.54.54l3-3a5 5 0 0 0-7.07-7.07l-1.72 1.71"/><path d="M14 11a5 5 0 0 0-7.54-.54l-3 3a5 5 0 0 0 7.07 7.07l1.71-1.71"/></svg>
                          Merged only
                        </button>
                        <button onClick={toggles.unassigned} style={{
                          display: 'inline-flex', alignItems: 'center', gap: 5, padding: '4px 10px', borderRadius: 20, fontSize: 11, cursor: 'pointer', fontFamily: 'Inter,sans-serif', transition: 'all .15s',
                          fontWeight: filterUnassigned ? 700 : 400, border: `1px solid ${filterUnassigned ? '#fcd34d' : TV.border}`, background: filterUnassigned ? '#fffbeb' : '#fff', color: filterUnassigned ? '#92400e' : TV.muted,
                        }}>
                          <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"><circle cx="12" cy="12" r="10"/></svg>
                          Unassigned only
                        </button>
                        <button onClick={() => setShowAvailableOnly(v => !v)} style={{
                          display: 'inline-flex', alignItems: 'center', gap: 5, padding: '4px 10px', borderRadius: 20, fontSize: 11, cursor: 'pointer', fontFamily: 'Inter,sans-serif', transition: 'all .15s',
                          fontWeight: showAvailableOnly ? 700 : 400, border: `1px solid ${showAvailableOnly ? '#86EFAC' : TV.border}`, background: showAvailableOnly ? '#F0FDF4' : '#fff', color: showAvailableOnly ? '#15803D' : TV.muted,
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
                  display: 'flex', alignItems: 'center', justifyContent: 'space-between', background: '#F8FAF9',
                }}>
                  <span style={{ fontSize: 11.5, color: TV.muted, fontWeight: 500 }}>
                    {dayEvents.length} session{dayEvents.length !== 1 ? 's' : ''} shown
                  </span>
                  <div style={{ display: 'flex', gap: 8 }}>
                    {localHasFilters && (
                      <button onClick={() => { handleClearAll(); }} style={{
                        padding: '6px 14px', borderRadius: 8, fontSize: 11.5, fontWeight: 600,
                        border: '1px solid #fecaca', background: '#fff8f8', color: '#dc2626',
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
          background:'#fff', border:`1px solid ${TV.border}`, borderRadius:14,
          overflow:'hidden', boxShadow:'0 1px 4px rgba(10,46,28,.07)',
          display:'flex', flexDirection:'column', width:'100%', minWidth:0,
          padding:'12px 14px 0',
        }}>
          <ConflictSummaryBar conflictMap={conflictMap} />
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
                locked={locked}
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
          readOnly={locked || selectedEvent._isReadonly}
          overrideFn={overrideFn}
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
          restoreFn={(version) => coordRestoreScheduleVersion(id, version)}
          diffFn={(version) => coordGetScheduleVersionDiff(id, version)}
          onRestore={async (restoreResult) => {
            // A restore replaces the whole schedule — any local overrides
            // still queued from drag-and-drop reference the pre-restore
            // events and would otherwise sit around and get silently
            // auto-saved on top of the restored data a few seconds later.
            dd.revertAllOverrides()
            await loadSchedule()
            setHasUnsavedChanges(true)
          }}
        />
      )}
    </div>
  )
}

/* ── List view ───────────────────────────────────────────────────────────── */
function ListView({ dayEvents, conflictMap, hasFilters, clearFilters, onCardClick, mergedIds }) {
  if (dayEvents.length === 0) return <EmptyState hasFilters={hasFilters} onClear={clearFilters} />
  return (
    <div style={{ background:'#fff', border:`1px solid ${TV.border}`, borderRadius:14, overflow:'hidden' }}>
      <table style={{ width:'100%', borderCollapse:'collapse', fontSize:12.5 }}>
        <thead>
          <tr style={{ background:'#F8FAF9' }}>
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
                style={{ borderBottom:`1px solid ${TV.border}`, cursor:'pointer', background:i%2===0?'#fff':'#F8FAF9', transition:'background .12s' }}
                onMouseEnter={e => e.currentTarget.style.background = TV.pale}
                onMouseLeave={e => e.currentTarget.style.background = i%2===0?'#fff':'#F8FAF9'}
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
                  <span style={{ fontSize:9, fontWeight:800, letterSpacing:'0.5px', color:isLab?TV.deep:TV.text, background:isLab?`rgba(21,128,61,.12)`:`rgba(0,0,0,.04)`, border:`1px solid ${isLab?TV.mid:TV.border}`, padding:'2px 6px', borderRadius:4 }}>
                    {sessionType}
                  </span>
                </td>
                <td style={{ padding:'10px 14px', fontSize:12, maxWidth:150, overflow:'hidden', textOverflow:'ellipsis', whiteSpace:'nowrap' }}>
                  {isExtManaged ? <span style={{ color:'#6EE7B7', fontWeight:500 }}>Ext. managed</span> : noFaculty ? <span style={{ color:'#f59e0b', fontWeight:600 }}>Unassigned</span> : <span style={{ color:TV.text }}>{ev.faculty}</span>}
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
                      <span style={{ display:'inline-flex', alignItems:'center', gap:4, fontSize:9.5, fontWeight:700, background:'#fef2f2', color:'#b91c1c', border:'1px solid #fecaca', borderRadius:4, padding:'2px 6px' }}>
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
                    {isExtManaged && <span style={{ display:'inline-flex', alignItems:'center', gap:4, fontSize:9.5, fontWeight:600, background:'#E5F9EC', color:'#15803D', border:'1px solid #BBF7D0', borderRadius:4, padding:'2px 6px' }}>Ext. managed</span>}
                    {noFaculty && !isExtManaged && <span style={{ display:'inline-flex', alignItems:'center', gap:4, fontSize:9.5, fontWeight:700, background:'#fffbeb', color:'#92400e', border:'1px solid #fcd34d', borderRadius:4, padding:'2px 6px' }}>Unassigned</span>}
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