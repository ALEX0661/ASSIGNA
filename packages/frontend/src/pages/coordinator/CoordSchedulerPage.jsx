import { useState, useEffect, useCallback, useMemo, useRef } from 'react'
import { createPortal } from 'react-dom'
import { useNavigate } from 'react-router-dom'
import { useAuth } from '../../hooks/useAuth'
import {
  coordCheckTurn, coordGenerate, coordCancelSolve,
  coordSaveSchedule, coordListSchedules, coordDeleteSchedule,
  coordRenameSchedule, coordDuplicateSchedule, coordSubmitSchedule, coordUnsubmitSchedule,
  coordGetRooms, coordGetSelectedRooms, coordSelectRooms, coordGetCourses,
  coordGetSettings, coordGetSubmittedSchedule, getCoordSchedulePhases
} from '../../services/api'
import { useTour } from '../../hooks/useTour.jsx'
import { useCoordSolverStore } from '../../store/scheduleStore'
import ScheduleGeneratorLoader from '../admin/ScheduleGeneratorLoader'
import TimeGrid from '../../components/ScheduleView/TimeGrid'
import roomsIcon from '../../assets/ROOMS.png'

/* ─────────────────────────── CONSTANTS & SETTINGS ─────────────────────────── */

const G = {
  meadow: 'var(--meadow, var(--meadow))', meadowDeep: 'var(--meadow-deep)', meadowMid: 'var(--meadow-mid)',
  meadowSoft: 'var(--meadow-soft)', meadowBorder: 'var(--meadow-border)',
  ink: 'var(--ink, #0E2A20)', inkMid: 'var(--ink2)', muted: 'var(--muted, #4B7060)', muted2: 'var(--muted2, #6B8C7A)',
  border: 'var(--border)', borderLight: 'var(--hover)', bg: 'var(--bg, #F2F7F4)',
  surface: 'var(--surface, #FFFFFF)', hover: 'var(--hover)', amber: '#F59E0B',
  amberSoft: 'rgba(245, 158, 11, 0.1)', amberBorder: 'rgba(245, 158, 11, 0.25)',
  blue: '#38BDF8', blueSoft: 'rgba(59, 130, 246, 0.1)', blueBorder: 'rgba(59, 130, 246, 0.25)',
  red: '#EF4444', redSoft: 'rgba(239, 68, 68, 0.1)', redBorder: 'rgba(220, 38, 38, 0.25)',
}

const PHASES = [
  { key: 'NSTP',       label: 'NSTP',         short: 'NSTP' },
  { key: 'GEC_MAT',    label: 'GEC / MAT',    short: 'GEC'  },
  { key: 'MAJORS_Y4',  label: 'Year 4',       short: 'Y4'   },
  { key: 'MAJORS_Y3',  label: 'Year 3',       short: 'Y3'   },
  { key: 'MAJORS_Y2',  label: 'Year 2',       short: 'Y2'   },
  { key: 'MAJORS_Y1',  label: 'Year 1',       short: 'Y1'   },
  { key: 'PE',         label: 'PE / PATHFIT', short: 'PE'   },
]
const PHASE_BY_KEY = Object.fromEntries(PHASES.map(p => [p.key, p]))
const DEFAULT_PHASE_KEYS = PHASES.map(p => p.key)

const VERDICT_META = {
  feasible:        { color: 'var(--meadow-text)', bg: G.meadowSoft, border: G.meadowBorder, label: 'Feasible',           icon: '✓' },
  likely_feasible: { color: '#38BDF8',    bg: 'rgba(59, 130, 246, 0.1)',    border: 'rgba(59, 130, 246, 0.25)',      label: 'Likely Feasible',    icon: '~' },
  tight:           { color: '#F59E0B',    bg: 'rgba(245, 158, 11, 0.1)',    border: 'rgba(245, 158, 11, 0.25)',      label: 'Feasible but Tight', icon: '⚠' },
  at_risk:         { color: '#EF4444',    bg: 'rgba(239, 68, 68, 0.1)',    border: 'rgba(220, 38, 38, 0.25)',      label: 'At Risk',            icon: '!' },
  infeasible:      { color: '#FCA5A5',    bg: 'rgba(239, 68, 68, 0.05)',    border: 'rgba(220, 38, 38, 0.25)',      label: 'Likely Infeasible',  icon: '✕' },
}

const CHECK_META = {
  pass: { color: 'var(--meadow-text)', bg: G.meadowSoft, border: G.meadowBorder, dot: G.meadow,  label: 'Pass' },
  warn: { color: '#F59E0B',    bg: 'rgba(245, 158, 11, 0.05)',    border: 'rgba(245, 158, 11, 0.25)',      dot: '#F59E0B', label: 'Warn' },
  fail: { color: '#EF4444',    bg: 'rgba(239, 68, 68, 0.1)',    border: 'rgba(220, 38, 38, 0.25)',      dot: '#EF4444', label: 'Fail' },
  info: { color: G.blue,       bg: G.blueSoft,   border: G.blueBorder,   dot: G.blue,    label: 'Info' },
}

// ── Room usage from previously-approved coordinator schedules ──────────────
// Parses a saved event's "period" string ("7:00 AM - 8:30 AM") into a
// duration in hours. Returns 0 for anything that doesn't match, so a bad
// record just doesn't count instead of blowing up the summary.
function _periodHours(period) {
  if (!period || typeof period !== 'string') return 0
  const parts = period.split(' - ')
  if (parts.length !== 2) return 0
  const toHours = str => {
    const m = str.trim().match(/^(\d{1,2}):(\d{2})\s*([AP]M)$/i)
    if (!m) return null
    let h = parseInt(m[1], 10)
    const min = parseInt(m[2], 10)
    const ampm = m[3].toUpperCase()
    if (ampm === 'PM' && h !== 12) h += 12
    if (ampm === 'AM' && h === 12) h = 0
    return h + min / 60
  }
  const start = toHours(parts[0])
  const end = toHours(parts[1])
  if (start == null || end == null || end <= start) return 0
  return end - start
}

// Total hours each room is already booked for, from a list of events —
// used both to badge room chips ("this room's filling up") and to keep the
// readiness check from double-counting hours other programs already claimed.
function summarizeRoomHours(events) {
  const byRoom = {}
  for (const ev of (events || [])) {
    const room = ev.room
    if (!room || room === 'TBA') continue
    byRoom[room] = (byRoom[room] || 0) + _periodHours(ev.period)
  }
  return byRoom
}

const REC_META = {
  blocker:    { color: '#EF4444',    bg: 'rgba(239, 68, 68, 0.1)',    border: 'rgba(220, 38, 38, 0.25)' },
  warning:    { color: '#F59E0B',    bg: 'rgba(245, 158, 11, 0.05)',    border: 'rgba(245, 158, 11, 0.25)' },
  suggestion: { color: '#38BDF8',    bg: 'rgba(59, 130, 246, 0.1)',    border: 'rgba(59, 130, 246, 0.25)' },
  success:    { color: 'var(--meadow-text)', bg: G.meadowSoft, border: G.meadowBorder },
}

const Q_META = {
  waiting:    { bg: 'var(--hover)', color: 'var(--muted2)', dot: 'var(--border)', label: 'Waiting' },
  active:     { bg: G.meadowSoft, color: 'var(--meadow-text)', dot: G.meadow, label: 'Their turn' },
  generating: { bg: 'rgba(37, 99, 235, 0.1)', color: '#60A5FA', dot: '#3B82F6', label: 'Generating' },
  submitted:  { bg: G.amberSoft, color: '#92400E', dot: G.amber, label: 'Submitted' },
  approved:   { bg: G.meadowSoft, color: 'var(--meadow-text)', dot: G.meadow, label: 'Approved' },
  skipped:    { bg: 'rgba(217, 119, 6, 0.05)', color: '#C2410C', dot: '#F97316', label: 'Skipped' },
}

const STATUS_COLORS = {
  draft:     { bg: G.hover, color: G.muted, border: G.border, label: 'Draft' },
  submitted: { bg: G.amberSoft, color: '#92400E', border: G.amberBorder, label: 'Submitted' },
  approved:  { bg: G.meadowSoft, color: 'var(--meadow-text)', border: G.meadowBorder, label: 'Approved' },
  rejected:  { bg: 'rgba(239, 68, 68, 0.1)', color: '#FCA5A5', border: 'rgba(220, 38, 38, 0.25)', label: 'Rejected' },
}

const WIZ_STEPS = [
  { n: 1, label: 'Setup' },
  { n: 2, label: 'Readiness' },
  { n: 3, label: 'Generate' },
  { n: 4, label: 'Review & Save' },
]

/* ─────────────────────────── STYLES ─────────────────────────── */

if (!document.getElementById('coord-scheduler-style')) {
  const s = document.createElement('style')
  s.id = 'coord-scheduler-style'
  s.textContent = `
    @import url('https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700;800&family=Poppins:wght@600;700;800&family=IBM+Plex+Mono:wght@500;600;700&display=swap');
    
    .sch-root { display:flex; flex-direction:column; gap:0; padding:0; background:${G.bg}; min-height:100%; font-family:'Inter',sans-serif; overflow:hidden; }
    .sch-wizard-shell { display:flex; flex-direction:column; height:100%; overflow:hidden; }

    .wiz-topbar { display:flex; align-items:center; justify-content:center; padding:0; background:transparent; border:none; flex-shrink:0; z-index:10; }
    .wiz-steps { display:flex; align-items:center; gap:4px; position:relative; background: var(--surface); padding:6px 12px; border-radius:99px; border:1px solid ${G.border}; box-shadow:0 2px 8px rgba(0,0,0,0.04); }
    .wiz-step-node { display:flex; align-items:center; gap:6px; padding:4px 12px; border-radius:99px; transition:all .2s; }
    .wiz-step-node.active { background:${G.meadowSoft}; }
    .wiz-step-node.done { cursor:pointer; }
    .wiz-step-node.done:hover { background:${G.hover}; }
    .wiz-step-circle { width:20px; height:20px; border-radius:50%; display:flex; align-items:center; justify-content:center; font-size:10.5px; font-weight:800; flex-shrink:0; transition:all .2s; border:2px solid transparent; }
    .wiz-step-circle.done   { background:${G.meadow}; color:#fff; }
    .wiz-step-circle.active { background:${G.meadow}; color:#fff; border-color:${G.meadowBorder}; box-shadow:0 0 0 3px rgba(0,0,0,0.15); }
    .wiz-step-circle.todo   { background:${G.hover}; color:${G.muted2}; border-color:${G.border}; }
    .wiz-step-label { font-size:11.5px; font-weight:700; transition:color .2s; white-space:nowrap; }
    .wiz-step-label.active { color: var(--meadow-text); }
    .wiz-step-label.done   { color:${G.ink}; }
    .wiz-step-label.todo   { color:${G.muted}; }
    .wiz-step-div { width:16px; height:2px; background:${G.border}; border-radius:99px; flex-shrink:0; }
    .wiz-step-div.done { background:${G.meadowBorder}; }

    .wiz-body { flex:1; overflow:hidden; position:relative; }
    .wiz-slide { position:absolute; inset:0; overflow-y:auto; padding:16px 28px 40px; display:flex; flex-direction:column; gap:14px; }
    .wiz-slide-enter  { animation:wizSlideIn .32s cubic-bezier(0.16,1,0.3,1) both; }
    .wiz-slide-back   { animation:wizSlideBack .32s cubic-bezier(0.16,1,0.3,1) both; }
    @keyframes wizSlideIn  { from { opacity:0; transform:translateX(48px) scale(0.98); } to { opacity:1; transform:translateX(0) scale(1); } }
    @keyframes wizSlideBack { from { opacity:0; transform:translateX(-48px) scale(0.98); } to { opacity:1; transform:translateX(0) scale(1); } }

    .sch-card { background: var(--surface); border-radius:12px; border:1px solid ${G.border}; box-shadow:0 2px 12px rgba(0,0,0,0.03); overflow:hidden; }
    .sch-card-header { display:flex; align-items:center; gap:12px; padding:16px 20px; border-bottom:1px solid ${G.border}; }
    .sch-card-title { font-size:15px; font-weight:800; color:${G.ink}; margin:0; letter-spacing:-0.1px; }
    .sch-card-sub { font-size:11.5px; color:${G.muted}; margin-top:2px; font-weight:500; }
    .sch-card-body { padding:16px 20px; }

    /* Step 1's two-column layout (setup column + My Schedules rail) used a
       hard 340px side column that had nowhere to go on a narrower window —
       it either got squeezed illegibly thin or pushed off-screen. Below
       980px it drops to a single stacked column instead.

       On wider screens, step 1 no longer scrolls as a whole page — the
       queue/room column is short enough to just fit, and "My Schedules"
       already has its own internal scroll body, so letting the whole
       slide scroll too just meant two scrollbars fighting for attention.
       Above 980px the slide's own scroll is turned off and the grid is
       height-locked to the available space so only the My Schedules list
       scrolls. Below 980px (where content stacks and needs more room
       than the screen has anyway) the normal whole-page scroll returns. */
    .step1-grid { display:grid; grid-template-columns: 1fr 340px; gap:20px; align-items:start; }
    @media (min-width: 980px) {
      .wiz-slide.step1-slide { overflow-y:hidden; padding-bottom:16px; }
      .step1-grid { flex:1; min-height:0; align-items:stretch; grid-template-rows:minmax(0,1fr); }
    }
    @media (max-width: 980px) {
      .step1-grid { grid-template-columns: 1fr; }
    }
    .step1-col { display:flex; flex-direction:column; gap:16px; min-height:0; }

    /* Queue status card — a small green header (same gradient as the
       step header up top) always on, since "waiting your turn" and "your
       turn now" are both normal, current states of one queue, not a
       warning vs. an all-clear. The queue order rail is the card's main
       content: it spreads across the full card width on its own equal-
       width columns instead of being squeezed into a narrow strip. */
    .queue-card { background: var(--surface); border-radius:12px; border:1px solid ${G.border}; box-shadow:0 1px 3px rgba(0,0,0,0.04); overflow:hidden; flex-shrink:0; }

    .queue-head { display:flex; align-items:center; justify-content:space-between; gap:14px; padding:9px 16px; background:linear-gradient(135deg, ${G.meadowDeep}, ${G.meadow}); color:#fff; }
    .queue-head-title { font-size:12px; font-weight:800; letter-spacing:-.1px; line-height:1.3; }
    .queue-head-sub { font-size:10.5px; font-weight:500; color:rgba(255,255,255,0.82); margin-top:1px; line-height:1.3; }
    .queue-head-sub strong { color:#fff; font-weight:700; }
    .queue-head-num { font-family:'IBM Plex Mono',monospace; font-size:15px; font-weight:800; flex-shrink:0; }
    .queue-head-of { font-size:9px; font-weight:600; color:rgba(255,255,255,0.75); margin-left:2px; }

    .qt-refresh { width:26px; height:26px; border-radius:7px; border:1px solid rgba(255,255,255,0.35); background:rgba(255,255,255,0.14); display:flex; align-items:center; justify-content:center; color:#fff; cursor:pointer; flex-shrink:0; padding:0; transition:background .15s; }
    .qt-refresh:hover { background:rgba(255,255,255,0.26); }

    .qt-rail-wrap { padding:10px 16px 12px; }
    .qt-empty-note { padding:14px 16px; font-size:11.5px; color:${G.muted}; font-weight:500; }

    .wiz-footer { position:sticky; bottom:0; display:flex; align-items:center; justify-content:space-between; padding:12px 28px; background:var(--surface); backdrop-filter:blur(12px); border-top:1px solid ${G.border}; z-index:40; flex-shrink:0; }
    .wiz-nav-btn { display:inline-flex; align-items:center; gap:8px; padding:11px 24px; border-radius:10px; font-family:'Inter',sans-serif; font-size:13.5px; font-weight:700; cursor:pointer; transition:all .18s; }
    .wiz-nav-btn.back { background: var(--surface); color:${G.muted}; border:1px solid ${G.border}; }
    .wiz-nav-btn.back:hover { background:${G.hover}; color:${G.ink}; border-color:${G.meadowBorder}; }
    .wiz-nav-btn.next { background:${G.meadow}; color:#fff; border:none; box-shadow:0 4px 14px rgba(0,0,0,0.2); }
    .wiz-nav-btn.next:hover:not(:disabled) { background:${G.meadowDeep}; transform:translateY(-1px); box-shadow:0 6px 20px rgba(0,0,0,0.3); }
    .wiz-nav-btn.next:disabled { opacity:.5; cursor:not-allowed; transform:none; box-shadow:none; }

    .cp-inp, .cp-sel { padding:9px 12px; border-radius:10px; border:1px solid ${G.border}; font-family:'Inter',sans-serif; font-size:12.5px; color:${G.ink}; background: var(--surface); outline:none; transition:all .15s; width:100%; box-sizing:border-box; }
    .cp-inp:focus, .cp-sel:focus { border-color: var(--meadow-text-hover); box-shadow:0 0 0 3px rgba(0,0,0,0.1); }
    
    .btn-outline { display:inline-flex; align-items:center; gap:6px; padding:7px 14px; border-radius:8px; border:1px solid ${G.border}; font-family:'Inter',sans-serif; font-size:12px; font-weight:600; cursor:pointer; background: var(--surface); color:${G.muted}; transition:all .13s; }
    .btn-outline:hover:not(:disabled) { background:${G.hover}; color:${G.ink}; border-color:${G.meadowBorder}; }
    .btn-primary { display:inline-flex; align-items:center; gap:6px; padding:7px 16px; border-radius:8px; border:none; font-family:'Inter',sans-serif; font-size:12px; font-weight:600; cursor:pointer; transition:all .15s; background:${G.meadow}; color:#fff; box-shadow:0 3px 10px rgba(0,0,0,0.25); }
    .btn-primary:hover:not(:disabled) { background:${G.meadowDeep}; transform:translateY(-1px); }
    .btn-danger { display:inline-flex; align-items:center; gap:6px; padding:7px 14px; border-radius:8px; border:1px solid #FECACA; font-family:'Inter',sans-serif; font-size:12px; font-weight:600; cursor:pointer; background: var(--surface); color:#DC2626; transition:all .13s; }
    .btn-danger:hover:not(:disabled) { background:#FEF2F2; border-color:#DC2626; }
    
    .csh-prog-chip { display:inline-flex; align-items:center; gap:6px; padding:5px 11px; border-radius:7px; font-size:11.5px; font-weight:700; border:1px solid transparent; }
    
    .csh-room-chip { display:inline-flex; align-items:center; justify-content:center; gap:4px; padding:3px 9px; border-radius:6px; font-size:11px; font-weight:600; cursor:pointer; border:1px solid ${G.border}; background: var(--surface); color:${G.muted}; transition:all .13s; user-select:none; min-width: 40px; }
    .csh-room-chip:hover { border-color:${G.meadowBorder}; background:${G.hover}; }
    .csh-room-chip.picked { background:var(--meadow-soft); border-color: var(--meadow-text-hover); color: var(--meadow-text); }
    
    .saved-item { display:flex; align-items:flex-start; gap:12px; padding:16px 20px; border-bottom:1px solid ${G.borderLight}; background: var(--surface); transition:background .15s; }
    .saved-item:last-child { border-bottom:none; }
    .saved-item:hover { background:${G.hover}; }
    .saved-name { font-size:13.5px; font-weight:700; color:${G.ink}; overflow:hidden; text-overflow:ellipsis; white-space:nowrap; display:block; }
    .saved-sub { font-size:11.5px; color:${G.muted}; font-weight:500; margin-top:3px; display:block; }

    .check-btn { display:inline-flex; align-items:center; gap:8px; padding:9px 16px; border-radius:8px; border:1px solid ${G.border}; background: var(--surface); color:${G.ink}; font-family:'Inter',sans-serif; font-size:12.5px; font-weight:600; cursor:pointer; transition:all .15s; box-shadow:0 1px 2px rgba(0,0,0,0.02); white-space:nowrap; }
    .check-btn:hover:not(:disabled) { background:${G.hover}; color: var(--meadow-text); border-color:${G.meadowBorder}; }
    
    .diag-check-row { display:flex; align-items:flex-start; gap:12px; padding:10px 0; border-bottom:1px solid ${G.borderLight}; }
    .diag-check-row:last-child { border-bottom:none; }
    .diag-rec { padding:12px 16px; border-radius:10px; display:flex; gap:12px; align-items:flex-start; border:1px solid transparent; transition:transform .15s; margin-bottom:12px; }
    
    .r-tab { display:inline-flex; align-items:center; gap:5px; padding:8px 16px; border-radius:8px; font-family:'Inter',sans-serif; font-size:12.5px; font-weight:600; cursor:pointer; transition:all .15s; border:1px solid ${G.border}; background: var(--surface); color:${G.muted}; box-shadow:0 1px 2px rgba(0,0,0,0.02); }
    .r-tab.active { background:${G.meadow}; color:#fff; border-color: var(--meadow-text); box-shadow:0 3px 10px rgba(0,0,0,0.25); }
    .r-tab:hover:not(.active) { background:${G.hover}; border-color:${G.meadowBorder}; color:${G.ink}; }

    .phase-track { display:flex; align-items:flex-start; gap:0; margin-top:12px; width: 100%; }
    .phase-step  { flex:1; display:flex; flex-direction:column; align-items:center; position:relative; }
    .phase-connector { position:absolute; top:10px; left:50%; width:100%; height:2px; transition:background .4s; z-index:0; }
    .phase-dot   { width:22px; height:22px; border-radius:50%; z-index:1; display:flex; align-items:center; justify-content:center; transition:all .35s ease; }
    .phase-label { font-size:10px; margin-top:5px; font-weight:700; text-align:center; letter-spacing:0.5px; transition:color .3s; text-transform:uppercase; }

    /* ── Reorderable phase list (editable priority order) — horizontal ── */
    .phase-reorder-hint { display:flex; align-items:center; gap:6px; font-size:11.5px; color:${G.muted2}; font-weight:600; margin-bottom:14px; }
    .phase-reorder-track { display:flex; align-items:flex-start; gap:0; width:100%; }
    .phase-reorder-step { flex:1; display:flex; flex-direction:column; align-items:center; position:relative; min-width:0; }
    .phase-reorder-connector { position:absolute; top:15px; left:50%; width:100%; height:2px; background:${G.border}; z-index:0; transition:background .2s; }
    .phase-chip {
      display:flex; flex-direction:column; align-items:center; gap:6px; width:100%;
      cursor:grab; user-select:none; touch-action:none; position:relative; z-index:1;
      transition:transform .15s cubic-bezier(.2,.8,.2,1);
    }
    .phase-chip:active { cursor:grabbing; }
    .phase-chip.dragging { opacity:0.35; }
    .phase-chip.drop-before::before,
    .phase-chip.drop-after::after {
      content:''; position:absolute; top:2px; width:3px; height:26px; border-radius:99px; background:${G.meadow};
      box-shadow:0 0 0 3px rgba(0,0,0,0.15);
    }
    .phase-chip.drop-before::before { left:-2px; }
    .phase-chip.drop-after::after   { right:-2px; }
    .phase-chip.keyboard-grabbed .phase-chip-dot { border-color: var(--meadow-text-hover) !important; box-shadow:0 0 0 4px rgba(0,0,0,0.18); }
    .phase-chip-dot {
      width:30px; height:30px; border-radius:50%; flex-shrink:0; display:flex; align-items:center; justify-content:center;
      font-size:11px; font-weight:800; background:${G.meadowSoft}; color: var(--meadow-text); border:2px solid ${G.meadowBorder};
      transition:all .15s; position:relative;
    }
    .phase-chip:hover .phase-chip-dot { background:${G.meadow}; color:#fff; border-color: var(--meadow-text); transform:scale(1.08); }
    .phase-chip-order {
      position:absolute; top:-5px; right:-5px; width:15px; height:15px; border-radius:50%; background: var(--surface);
      border:1.5px solid ${G.border}; color:${G.muted2}; font-size:8.5px; font-weight:800;
      display:flex; align-items:center; justify-content:center; transition:all .15s;
    }
    .phase-chip:hover .phase-chip-order { border-color: var(--meadow-text); color: var(--meadow-text); }
    .phase-chip-label { font-size:10.5px; font-weight:700; text-align:center; letter-spacing:0.4px; text-transform:uppercase; color:${G.ink}; line-height:1.3; max-width:100%; }
    .phase-chip-handle { display:flex; align-items:center; justify-content:center; color:${G.muted2}; opacity:0; transition:opacity .15s; margin-top:-2px; }
    .phase-chip:hover .phase-chip-handle, .phase-chip:focus-within .phase-chip-handle { opacity:1; }
    .phase-chip-arrows { display:flex; gap:3px; margin-top:2px; opacity:0; transition:opacity .15s; }
    .phase-chip:hover .phase-chip-arrows, .phase-chip:focus-within .phase-chip-arrows { opacity:1; }
    .phase-chip-arrow { width:18px; height:18px; padding:0; border-radius:5px; border:1px solid ${G.border}; background: var(--surface); display:flex; align-items:center; justify-content:center; cursor:pointer; color:${G.muted2}; transition:all .15s; }
    .phase-chip-arrow:hover:not(:disabled) { background:${G.meadowSoft}; border-color:${G.meadowBorder}; color: var(--meadow-text); }
    .phase-chip-arrow:disabled { opacity:0.25; cursor:default; }
    @media (max-width: 720px) {
      .phase-reorder-track { flex-wrap:wrap; row-gap:22px; }
      .phase-reorder-step { flex:0 0 25%; }
    }

    .prog-bar-wrap { height:6px; background:${G.borderLight}; border-radius:99px; overflow:hidden; margin-top:10px; box-shadow:inset 0 1px 2px rgba(0,0,0,0.05); width: 100%; }
    .prog-bar-fill { height:100%; border-radius:99px; transition:width .6s cubic-bezier(.4,0,.2,1); }

    @keyframes spin-r { to{transform:rotate(360deg)} }
    .qr-gen-spin { animation: spin-r .9s linear infinite; transform-origin: center; }
    @keyframes cshShimmer { 0%{background-position:-600px 0} 100%{background-position:600px 0} }
    @keyframes cpToastIn { from{opacity:0;transform:scale(.96) translateY(12px)} to{opacity:1;transform:scale(1) translateY(0)} }
    @keyframes cshFadeIn { from{opacity:0} to{opacity:1} }
    @keyframes diag-bar { from { width:0 } }
    
    .csh-skeleton { background:linear-gradient(90deg,${G.hover} 25%,${G.borderLight} 50%,${G.hover} 75%); background-size:600px 100%; animation:cshShimmer 1.4s ease-in-out infinite; border-radius:7px; }
    .cp-toast-wrap { position:fixed; bottom:24px; left:50%; z-index:9999; display:flex; flex-direction:column; gap:10px; align-items:center; pointer-events:none; transform:translateX(-50%); margin-left: 110px; }
    .cp-toast { display:flex; align-items:center; gap:10px; padding:14px 22px; border-radius:12px; font-family:'Inter',sans-serif; font-size:13.5px; font-weight:600; animation:cpToastIn .25s cubic-bezier(.4,0,.2,1); white-space:nowrap; pointer-events:auto; box-shadow:0 8px 24px rgba(0,0,0,0.15); }
    .cp-toast.success { background:${G.meadow}; color:#fff; border:1px solid ${G.meadowBorder}; }
    .cp-toast.error { background: var(--surface); color:#DC2626; border:1px solid #FECACA; }
    .cp-toast.info { background: var(--surface); color: var(--meadow-text); border:1px solid ${G.meadowBorder}; }
    
    .cp-tr-hover:nth-child(even) { background: #FAFDFB; }
    .cp-tr-hover:hover { background: ${G.meadowSoft} !important; }

    .csh-table-wrap::-webkit-scrollbar { width: 6px; height: 6px; }
    .csh-table-wrap::-webkit-scrollbar-track { background: transparent; }
    .csh-table-wrap::-webkit-scrollbar-thumb { background: ${G.border}; border-radius: 8px; }
    .csh-table-wrap::-webkit-scrollbar-thumb:hover { background: ${G.muted2}; }

    /* Failure Result UI */
    .solve-result { border-radius:12px; border:1px solid ${G.border}; overflow:hidden; }
    .solve-result.failed { border-color:#FECACA; }
    .solve-result-body { display:flex; align-items:flex-start; gap:14px; padding:18px 20px; }
    .solve-result-body > div:last-child { flex:1; min-width:0; }
    .solve-result-body p, .solve-result-body div { overflow-wrap:break-word; word-break:break-word; }
    .solve-result-actions { display:flex; flex-wrap:wrap; gap:10px; padding:16px 28px; border-top:1px solid #FECACA; background:#FEF2F2; justify-content:flex-end; }
    .solve-action-btn { display:inline-flex; align-items:center; gap:8px; padding:10px 20px; border-radius:9px; font-family:'Inter',sans-serif; font-size:13px; font-weight:700; cursor:pointer; transition:all .2s; }
    .solve-action-btn.primary { background:${G.meadow}; color:#fff; border:none; box-shadow:0 4px 12px rgba(0,0,0,0.2); }
    .solve-action-btn.primary:hover:not(:disabled) { transform:translateY(-1px); box-shadow:0 6px 16px rgba(0,0,0,0.3); background:${G.meadowDeep}; }
    .solve-action-btn.primary:disabled { opacity:.5; cursor:not-allowed; transform:none; box-shadow:none; }
    .solve-action-btn.ghost { background: var(--surface); color:${G.ink}; border:1px solid ${G.border}; }
    .solve-action-btn.ghost:hover { background:${G.bg}; border-color:${G.meadowBorder}; color: var(--meadow-text); }
  `
  document.head.appendChild(s)
}

/* ─────────────────────────── HELPERS ─────────────────────────── */

function Skel({ w = '100%', h = 14, r = 7, style = {} }) {
  return <div className="csh-skeleton" style={{ width: w, height: h, borderRadius: r, flexShrink: 0, ...style }} />
}

function useToast() {
  const [toasts, setToasts] = useState([])
  const toast = useCallback((msg, type = 'info', dur = 3000) => {
    const id = Date.now() + Math.random()
    setToasts(p => [...p, { id, message: msg, type }])
    setTimeout(() => setToasts(p => p.filter(t => t.id !== id)), dur)
  }, [])
  return { toasts, toast }
}

function ToastContainer({ toasts }) {
  const icons = {
    success: <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"><polyline points="20 6 9 17 4 12"/></svg>,
    error: <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"><circle cx="12" cy="12" r="10"/><line x1="12" y1="8" x2="12" y2="12"/></svg>,
    info: <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"><circle cx="12" cy="12" r="10"/><path d="M12 8v4"/></svg>,
  }
  return <div className="cp-toast-wrap">{toasts.map(t => <div key={t.id} className={`cp-toast ${t.type}`}>{icons[t.type]}{t.message}</div>)}</div>
}

function StatusBadge({ status }) {
  const m = STATUS_COLORS[status] || STATUS_COLORS.draft
  return <span style={{ padding: '3px 9px', borderRadius: 6, fontSize: 10.5, fontWeight: 700, background: m.bg, color: m.color, border: `1px solid ${m.border}` }}>{m.label}</span>
}

function RoundBadge({ semester, academicYear, light }) {
  if (!semester) return null
  return (
    <span style={{
      display: 'inline-flex', alignItems: 'center', gap: 6, padding: '5px 13px',
      borderRadius: 99, fontSize: 12, fontWeight: 700,
      background: light ? 'rgba(255,255,255,0.2)' : G.hover,
      color: light ? '#fff' : G.inkMid,
      border: light ? '1px solid rgba(255,255,255,0.3)' : `1px solid ${G.border}`,
    }}>
      <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke={light ? '#fff' : G.muted} strokeWidth="2.5"><rect x="3" y="4" width="18" height="18" rx="2"/><line x1="3" y1="10" x2="21" y2="10"/><line x1="16" y1="2" x2="16" y2="6"/><line x1="8" y1="2" x2="8" y2="6"/></svg>
      {semester}{academicYear ? ` · ${academicYear}` : ''}
    </span>
  )
}

function QueueRail({ queue, myProgram, currentProgram }) {
  const isDark = document.documentElement.getAttribute('data-mode') === 'dark'
  if (!queue || queue.length === 0) return null
  const items = queue.map((item, i) => {
    const prog = typeof item === 'string' ? item : item.program
    const status = typeof item === 'object' ? (item.status || 'waiting') : (prog === currentProgram ? 'active' : 'waiting')
    return { prog, status, meta: Q_META[status] || Q_META.waiting, isMine: prog === myProgram }
  })
  // Equal-width flex columns (not fixed px) so the rail spreads across
  // the whole card instead of clumping on one side with the rest left
  // empty. Each column holds both its circle and its label, so they
  // can't drift apart the way they used to when the connector line and
  // the circle shared one box. Connector segments are drawn separately,
  // positioned in percent between circle centers, so they still land
  // exactly regardless of how wide each column ends up.
  const n = items.length
  const CIRCLE = 24
  const MIN_COL = 42
  return (
    <div style={{ width: '100%', overflowX: 'auto' }}>
      <div style={{ position: 'relative', minWidth: n * MIN_COL }}>
        {n > 1 && (
          <div style={{ position: 'absolute', top: CIRCLE / 2 - 1, left: `${50 / n}%`, right: `${50 / n}%`, height: 2 }}>
            {items.slice(0, -1).map((it, i) => (
              <div key={it.prog} style={{
                position: 'absolute', left: `${(i / (n - 1)) * 100}%`, width: `${100 / (n - 1)}%`, height: 2, borderRadius: 99,
                background: (it.status === 'active' || it.status === 'approved') ? G.meadowBorder : G.border,
              }} />
            ))}
          </div>
        )}
        <div style={{ display: 'flex', position: 'relative' }}>
          {items.map(({ prog, status, meta, isMine }) => (
            <div key={prog} style={{ flex: `1 1 0`, minWidth: MIN_COL, display: 'flex', flexDirection: 'column', alignItems: 'center' }}>
              <div style={{
                width: CIRCLE, height: CIRCLE, borderRadius: '50%', flexShrink: 0,
                background: status === 'active' ? G.meadow : meta.bg,
                border: isMine ? `2.5px solid ${G.meadowDeep}` : `1.5px solid ${meta.dot}`,
                display: 'flex', alignItems: 'center', justifyContent: 'center',
                boxShadow: status === 'active' ? '0 0 0 4px rgba(0,0,0,0.15)' : isMine ? '0 0 0 3px rgba(0,0,0,0.12)' : 'none',
                transition: 'all .25s',
              }}>
                {status === 'approved'
                  ? <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke={G.meadowDeep} strokeWidth="3"><polyline points="20 6 9 17 4 12"/></svg>
                  : status === 'generating'
                    ? <svg className="qr-gen-spin" width="11" height="11" viewBox="0 0 24 24" fill="none" stroke='#60A5FA' strokeWidth="3"><path d="M21 12a9 9 0 1 1-6.219-8.56"/></svg>
                    : status === 'active'
                      ? <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="#fff" strokeWidth="3"><polygon points="5 3 19 12 5 21 5 3"/></svg>
                      : <span style={{ width: 6, height: 6, borderRadius: '50%', background: meta.dot }} />
                }
              </div>
              <div style={{ marginTop: 6, textAlign: 'center' }}>
                <div style={{ fontSize: 11, fontWeight: isMine ? 800 : 700, color: isMine ? 'var(--meadow-text)' : G.ink, whiteSpace: 'nowrap' }}>{prog}</div>
                <div style={{ fontSize: 8.5, fontWeight: 800, color: isMine ? 'var(--meadow-text-hover)' : meta.color, letterSpacing: '.4px', textTransform: 'uppercase', whiteSpace: 'nowrap', marginTop: 2 }}>
                  {isMine ? 'You' : meta.label}
                </div>
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  )
}

function RoomGroup({ title, all, selected, onToggle, onSelectAll, onClear, compact, usage }) {
  if (!all || all.length === 0) {
    return compact ? (
      <div style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '8px 12px', background: G.hover, borderRadius: 8, border: `1px dashed ${G.border}` }}>
        <span style={{ fontSize: 12, fontWeight: 700, color: G.muted2 }}>{title}:</span>
        <span style={{ fontSize: 12, color: G.muted }}>None configured by the admin yet</span>
      </div>
    ) : (
      <div style={{ flex: 1, minWidth: 220 }}>
        <div style={{ fontSize: 13, fontWeight: 800, color: G.ink, marginBottom: 8 }}>{title}</div>
        <div style={{ fontSize: 12, color: G.muted, padding: '10px 12px', background: G.hover, borderRadius: 8 }}>No {title.toLowerCase()} configured by the admin yet.</div>
      </div>
    )
  }
  const allPicked = selected.length === all.length
  return (
    <div style={{ flex: 1, minWidth: 220 }}>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 12 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          <span style={{ fontSize: 13, fontWeight: 800, color: G.ink }}>{title}</span>
          <span style={{ fontSize: 11, fontWeight: 700, color: 'var(--meadow-text)', background: G.meadowSoft, padding: '1.5px 8px', borderRadius: 99 }}>{selected.length}/{all.length}</span>
        </div>
        <button
          onClick={() => (allPicked ? onClear() : onSelectAll())}
          style={{ background: 'none', border: 'none', cursor: 'pointer', fontSize: 11.5, fontWeight: 700, color: 'var(--meadow-text-hover)', fontFamily: "'Inter',sans-serif", padding: 0 }}
        >
          {allPicked ? 'Clear' : 'Select all'}
        </button>
      </div>
      <div style={{ display: 'flex', flexWrap: 'wrap', gap: 7 }}>
        {all.map(room => {
          const picked = selected.includes(room)
          const u = usage?.[room]
          const badge = u && u.hours > 0.05
            ? (u.pct >= 85 ? { bg: 'rgba(239, 68, 68, 0.1)', color: '#EF4444' } : u.pct >= 50 ? { bg: 'rgba(245, 158, 11, 0.1)', color: '#92400E' } : { bg: G.meadowSoft, color: 'var(--meadow-text)' })
            : null
          return (
            <span key={room} className={`csh-room-chip${picked ? ' picked' : ''}`} onClick={() => onToggle(room)}
              title={badge ? `${u.hours.toFixed(1)}h/week already booked by previously-approved programs (~${u.pct}% of this room's weekly capacity)` : 'Not used by any previously-approved program yet'}>
              {picked && <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3"><polyline points="20 6 9 17 4 12"/></svg>}
              {room}
              {badge && (
                <span style={{ marginLeft: 5, fontSize: 9.5, fontWeight: 800, padding: '1px 5px', borderRadius: 99, background: badge.bg, color: badge.color }}>
                  {u.pct}%
                </span>
              )}
            </span>
          )
        })}
      </div>
      {usage && Object.keys(usage).length > 0 && (
        <div id="tour-room-usage-legend" style={{ fontSize: 10.5, color: G.muted2, marginTop: 7, display: 'flex', alignItems: 'center', gap: 5 }}>
          <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><circle cx="12" cy="12" r="10"/><line x1="12" y1="16" x2="12" y2="12"/><line x1="12" y1="8" x2="12.01" y2="8"/></svg>
          % shown is how full that room already is from programs approved ahead of you in the queue.
        </div>
      )}
    </div>
  )
}

function WizTopBar({ step, maxReached, onStepClick }) {
  return (
    <div className="wiz-topbar">
      <div className="wiz-steps" style={{ animation: 'cshFadeIn .3s' }}>
        {WIZ_STEPS.map((s, i) => {
          const state = s.n < step ? 'done' : s.n === step ? 'active' : 'todo'
          const clickable = s.n <= maxReached && s.n !== step
          return (
            <div key={s.n} style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
              <div className={`wiz-step-node ${state}`} onClick={() => clickable && onStepClick(s.n)} style={{ cursor: clickable ? 'pointer' : 'default' }}>
                <div className={`wiz-step-circle ${state}`}>
                  {state === 'done'
                    ? <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3"><polyline points="20 6 9 17 4 12"/></svg>
                    : s.n}
                </div>
                <span className={`wiz-step-label ${state}`}>{s.label}</span>
              </div>
              {i < WIZ_STEPS.length - 1 && <div className={`wiz-step-div${state === 'done' ? ' done' : ''}`} />}
            </div>
          )
        })}
      </div>
    </div>
  )
}

function StepHeader({ number, title, subtitle, badge }) {
  return (
    <div style={{ display:'flex', alignItems:'center', gap:14, padding:'16px 22px', borderRadius:14,
      background: `linear-gradient(135deg, ${G.meadowDeep}, ${G.meadow})`, 
      boxShadow: '0 4px 14px rgba(0,0,0,0.15)',
      marginBottom:16, position:'relative', overflow:'hidden', flexShrink: 0 }}>
      <div style={{ position:'absolute', top:-30, right:-20, width:100, height:100, borderRadius:'50%', background:'rgba(255,255,255,0.05)', pointerEvents:'none' }} />
      <div style={{ width:32, height:32, borderRadius:'50%', background: 'rgba(255,255,255,0.2)', border: '1px solid rgba(255,255,255,0.3)',
        display:'flex', alignItems:'center', justifyContent:'center', fontSize:13, fontWeight:800, color: '#fff', flexShrink:0, zIndex: 1 }}>
        {number}
      </div>
      <div style={{ flex:1, minWidth:0, zIndex: 1 }}>
        <div style={{ fontSize:16, fontWeight:800, color: '#fff', letterSpacing:'-0.3px', fontFamily:"'Poppins',sans-serif" }}>{title}</div>
        <div style={{ fontSize:12.5, color: 'rgba(255,255,255,0.85)', fontWeight:500, marginTop:2 }}>{subtitle}</div>
      </div>
      <div style={{ zIndex: 1 }}>{badge}</div>
    </div>
  )
}

function PhaseTimeline({ currentPhaseIdx, status, progress, order, defaultOrder, onReorder, onReset, editable }) {
  const idle = status === 'idle', done = status === 'complete'
  const phaseKeys = (order && order.length ? order : DEFAULT_PHASE_KEYS)
  const phases = phaseKeys.map(k => PHASE_BY_KEY[k]).filter(Boolean)
  const isDefaultOrder = !defaultOrder || (phaseKeys.length === defaultOrder.length && phaseKeys.every((k, i) => k === defaultOrder[i]))
  const canEdit = !!editable

  return (
    <div className="fadein">
      <div style={{ display:'flex', justifyContent:'space-between', alignItems:'center', marginBottom:10, gap:12 }}>
        <span style={{ fontSize:13.5, fontWeight:700, color: idle ? G.muted2 : G.ink }}>
          {idle ? '7 scheduling phases' : done ? 'All phases complete' : `Phase ${Math.min(currentPhaseIdx + 1, 7)} of 7 — ${phases[Math.min(currentPhaseIdx, 6)]?.label}`}
        </span>
        <div style={{ display:'flex', alignItems:'center', gap:12, flexShrink:0 }}>
          {canEdit && (
            <button
              type="button"
              onClick={onReset}
              disabled={isDefaultOrder}
              style={{ background:'none', border:'none', padding:0, fontSize:11.5, fontWeight:700, color: isDefaultOrder ? G.muted2 : 'var(--meadow-text)', cursor: isDefaultOrder ? 'default' : 'pointer', opacity: isDefaultOrder ? 0.5 : 1 }}>
              Reset to Default
            </button>
          )}
          <span style={{ fontSize:14, fontWeight:800, color: idle ? G.muted2 : done ? 'var(--meadow-text-hover)' : 'var(--meadow-text)' }}>{idle ? '—' : `${progress}%`}</span>
        </div>
      </div>
      <div className="prog-bar-wrap">
        <div className="prog-bar-fill" style={{ width:`${idle ? 0 : progress}%`, background: done ? `linear-gradient(90deg,${G.meadowSoft},${G.meadow})` : `linear-gradient(90deg,${G.meadowBorder},${G.meadowDeep})` }} />
      </div>

      {canEdit ? (
        <PhaseReorderList phases={phases} onReorder={onReorder} />
      ) : (
        <div className="phase-track">
          {phases.map((ph, i) => {
            const phaseDone = done || i < currentPhaseIdx, phaseActive = !done && !idle && i === currentPhaseIdx
            return (
              <div key={ph.key} className="phase-step">
                {i < phases.length - 1 && <div className="phase-connector" style={{ background: (phaseDone && !idle) ? G.meadow : G.border }} />}
                <div className="phase-dot" style={{ background: idle ? G.hover : phaseDone ? G.meadow : phaseActive ? 'var(--surface)' : G.bg, border: idle ? `2px solid ${G.border}` : phaseActive ? `2.5px solid ${G.meadowDeep}` : phaseDone ? 'none' : `2px solid ${G.border}`, boxShadow: phaseActive ? `0 0 0 4px rgba(0,0,0,0.15)` : 'none' }}>
                  {phaseDone && !idle ? <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="#fff" strokeWidth="3"><polyline points="20 6 9 17 4 12"/></svg>
                    : phaseActive ? <div style={{ width:10, height:10, borderRadius:'50%', background:G.meadowDeep }} /> : null}
                </div>
                <span className="phase-label" style={{ color: idle ? G.muted2 : phaseDone ? 'var(--meadow-text-hover)' : phaseActive ? G.ink : G.muted2 }}>{ph.short}</span>
              </div>
            )
          })}
        </div>
      )}
    </div>
  )
}

/* Drag-and-drop (+ keyboard) reorderable list of scheduling phases.
   - Mouse/touch: grab a phase and drag; a thin green marker previews where
     it will land, and the phase fades while it's being dragged.
   - Keyboard: tab to the handle, press Enter/Space to "pick up" the phase,
     Arrow Up/Down to move it, Enter/Space again (or Escape) to drop it.
   Each dot shows the phase's short name (e.g. "Y1") with its position
   number as a small badge, so the order is readable at a glance while
   still keying the badge to the arrow buttons underneath. */
function PhaseReorderList({ phases, onReorder }) {
  const [dragIndex, setDragIndex] = useState(null)
  const [overIndex, setOverIndex] = useState(null)
  const [grabbedIndex, setGrabbedIndex] = useState(null) // keyboard mode
  const dragImgRef = useRef(null)

  function handleDragStart(e, index) {
    setDragIndex(index)
    // Use a transparent 1px drag image so the browser's default ghost
    // doesn't fight with our own CSS-driven "dragging" opacity state.
    if (dragImgRef.current) e.dataTransfer.setDragImage(dragImgRef.current, 0, 0)
    e.dataTransfer.effectAllowed = 'move'
  }

  function handleDragOver(e, index) {
    e.preventDefault()
    if (dragIndex === null || index === dragIndex) { setOverIndex(null); return }
    setOverIndex(index)
  }

  function handleDrop(e, index) {
    e.preventDefault()
    if (dragIndex !== null && index !== dragIndex) onReorder(dragIndex, index)
    setDragIndex(null); setOverIndex(null)
  }

  function handleDragEnd() {
    setDragIndex(null); setOverIndex(null)
  }

  function handleHandleKeyDown(e, index) {
    if (e.key === 'Enter' || e.key === ' ') {
      e.preventDefault()
      setGrabbedIndex(g => (g === index ? null : index))
    } else if (e.key === 'Escape' && grabbedIndex !== null) {
      e.preventDefault()
      setGrabbedIndex(null)
    } else if (grabbedIndex === index && (e.key === 'ArrowUp' || e.key === 'ArrowDown')) {
      e.preventDefault()
      const target = index + (e.key === 'ArrowUp' ? -1 : 1)
      if (target < 0 || target >= phases.length) return
      onReorder(index, target)
      setGrabbedIndex(target)
    }
  }

  return (
    <div role="listbox" aria-label="Scheduling phase order" id="tour-sch-phase-order">
      {/* invisible 0x0 image used to suppress the native drag ghost */}
      <div ref={dragImgRef} style={{ width:1, height:1, opacity:0, position:'absolute' }} />

      <div className="phase-reorder-hint">
        <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"><circle cx="9" cy="6" r="1.3"/><circle cx="9" cy="12" r="1.3"/><circle cx="9" cy="18" r="1.3"/><circle cx="15" cy="6" r="1.3"/><circle cx="15" cy="12" r="1.3"/><circle cx="15" cy="18" r="1.3"/></svg>
        Drag a phase to reorder — earlier phases get first pick of rooms and faculty
      </div>

      <div className="phase-reorder-track">
        {phases.map((ph, i) => {
          const isDragging = dragIndex === i
          const isGrabbed = grabbedIndex === i
          const dropClass = overIndex === i ? (overIndex > dragIndex ? 'drop-after' : 'drop-before') : ''
          return (
            <div key={ph.key} className="phase-reorder-step">
              {i < phases.length - 1 && <div className="phase-reorder-connector" />}
              <div
                className={`phase-chip${isDragging ? ' dragging' : ''}${isGrabbed ? ' keyboard-grabbed' : ''}${dropClass ? ' ' + dropClass : ''}`}
                draggable
                role="option"
                aria-selected={isGrabbed}
                onDragStart={e => handleDragStart(e, i)}
                onDragOver={e => handleDragOver(e, i)}
                onDrop={e => handleDrop(e, i)}
                onDragEnd={handleDragEnd}
              >
                <div className="phase-chip-dot">
                  {ph.short}
                  <span className="phase-chip-order">{i + 1}</span>
                </div>
                <span className="phase-chip-label">{ph.label}</span>
                <button
                  type="button"
                  className="phase-chip-handle"
                  tabIndex={0}
                  aria-label={`${ph.label}. Position ${i + 1} of ${phases.length}. Press Enter to pick up, then arrow keys to move.`}
                  onKeyDown={e => handleHandleKeyDown(e, i)}
                >
                  <svg width="14" height="8" viewBox="0 0 14 8" fill="currentColor"><circle cx="2" cy="2" r="1.3"/><circle cx="7" cy="2" r="1.3"/><circle cx="12" cy="2" r="1.3"/><circle cx="2" cy="6" r="1.3"/><circle cx="7" cy="6" r="1.3"/><circle cx="12" cy="6" r="1.3"/></svg>
                </button>
                <div className="phase-chip-arrows">
                  <button
                    type="button"
                    className="phase-chip-arrow"
                    onClick={() => onReorder(i, i - 1)}
                    disabled={i === 0}
                    aria-label={`Move ${ph.label} earlier`}>
                    <svg width="9" height="9" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3"><polyline points="15 18 9 12 15 6"/></svg>
                  </button>
                  <button
                    type="button"
                    className="phase-chip-arrow"
                    onClick={() => onReorder(i, i + 1)}
                    disabled={i === phases.length - 1}
                    aria-label={`Move ${ph.label} later`}>
                    <svg width="9" height="9" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3"><polyline points="9 18 15 12 9 6"/></svg>
                  </button>
                </div>
              </div>
            </div>
          )
        })}
      </div>
    </div>
  )
}

function CoordinatorCheckPanel({ semester, masterEvents }) {
  const [diag, setDiag] = useState(null)
  const [diagLoading, setDiagLoading] = useState(false)
  const [diagError, setDiagError] = useState(null)
  const [diagTab, setDiagTab] = useState('checks')
  const { coordinatorProgram } = useAuth()

  async function runDiagnostic() {
    setDiagLoading(true); setDiagError(null);
    try {
      // masterEvents comes from the parent page, which already fetched it
      // once in loadAll() — reading it again here would double the cost of
      // an already-expensive call (the master schedule's events live one
      // doc per session in Firestore, so this is O(sessions) reads, not 1).
      const [courses, selectedRooms, settings] = await Promise.all([
        coordGetCourses(),
        coordGetSelectedRooms(),
        coordGetSettings(),
      ]);
      const roomHoursBooked = summarizeRoomHours(masterEvents);

      const checks = [];
      const recs = [];
      let failCount = 0;
      let warnCount = 0;

      const selectedLec = selectedRooms?.lecture || [];
      const selectedLab = selectedRooms?.lab || [];
      const courseList = courses || [];

      // ── Per-Type Demand Math (lecture and lab are NOT interchangeable rooms) ──
      // Mirrors the admin pre-diagnostic model:
      //  - 1 lecture unit ≈ 1 contact hour/week
      //  - 1 lab unit ≈ 3 contact hours/week (split into two sessions by the solver)
      //  - NSTP/GEC blocks are merged in pairs by the solver — two blocks share
      //    one room slot, so their real room demand is roughly half the naive total
      let lecDemandHours = 0;
      let labDemandHours = 0;
      let incompleteCourses = 0;
      courseList.forEach(c => {
        const hasLecField = c.unitsLecture !== undefined && c.unitsLecture !== null;
        const hasLabField = c.unitsLab !== undefined && c.unitsLab !== null;
        if (!hasLecField && !hasLabField) incompleteCourses++;

        const lec = Number(c.unitsLecture) || 0;
        const lab = Number(c.unitsLab) || 0;
        const blocks = Number(c.blocks) || 1;
        const code = (c.courseCode || '').toUpperCase();
        const isMergedType = code.includes('NSTP') || code.startsWith('GEC') || (code.startsWith('MAT') && !code.startsWith('MATH'));
        const lecBlocks = isMergedType ? Math.ceil(blocks / 2) : blocks;

        lecDemandHours += lec * lecBlocks;
        labDemandHours += (lab * 3) * blocks;
      });

      // Settings
      const activeDays = (settings?.days || []).length || 6;
      const startT = Number(settings?.time?.start_time) || 7;
      const endT = Number(settings?.time?.end_time) || 21;
      const hoursPerDay = endT - startT;

      // ── Time Window Settings ──
      if (!(settings?.days || []).length || hoursPerDay <= 0) {
        checks.push({ id: 'time1', label: 'Time Window Settings', status: 'fail', detail: `Scheduling window looks misconfigured (${activeDays} day(s), ${hoursPerDay} hour(s)/day) — capacity can't be computed reliably.` });
        failCount++;
        recs.push({ type: 'blocker', title: 'Invalid Time Window', body: 'Ask the admin to double-check the configured operating days and start/end times before generating.' });
      } else {
        checks.push({ id: 'time1', label: 'Time Window Settings', status: 'pass', detail: `${activeDays} operating day(s), ${hoursPerDay} hour(s)/day (${startT}:00–${endT}:00).` });
      }

      // System-wide fallback names, used only when the coordinator hasn't explicitly picked rooms of that type
      const systemLecRoomNames = settings?.rooms?.lecture || [];
      const systemLabRoomNames = settings?.rooms?.lab || [];
      const systemLecRooms = systemLecRoomNames.length;
      const systemLabRooms = systemLabRoomNames.length;
      const effectiveLecRoomNames = selectedLec.length > 0 ? selectedLec : systemLecRoomNames;
      const effectiveLabRoomNames = selectedLab.length > 0 ? selectedLab : systemLabRoomNames;
      const effectiveLecRooms = effectiveLecRoomNames.length;
      const effectiveLabRooms = effectiveLabRoomNames.length;
      const lecCapacityHours = effectiveLecRooms * activeDays * hoursPerDay;
      const labCapacityHours = effectiveLabRooms * activeDays * hoursPerDay;
      const lecFallback = selectedLec.length === 0 && systemLecRooms > 0;
      const labFallback = selectedLab.length === 0 && systemLabRooms > 0;

      // ── Hours other, already-approved programs have claimed in these same
      // rooms — the merge injects these as pre-bookings before your solve
      // runs, so they're not actually free capacity even though nothing
      // you've generated yet uses them. Net them out before judging whether
      // your demand fits, or "capacity" here would overstate what's real.
      const lecBookedHours = effectiveLecRoomNames.reduce((sum, r) => sum + (roomHoursBooked[r] || 0), 0);
      const labBookedHours = effectiveLabRoomNames.reduce((sum, r) => sum + (roomHoursBooked[r] || 0), 0);
      const lecAvailableHours = Math.max(0, lecCapacityHours - lecBookedHours);
      const labAvailableHours = Math.max(0, labCapacityHours - labBookedHours);

      if (lecBookedHours > 0 || labBookedHours > 0) {
        checks.push({
          id: 'room-overlap',
          label: 'Room Overlap — Other Programs',
          status: 'info',
          detail: `Programs already approved ahead of you in the queue occupy ${lecBookedHours.toFixed(1)}h of lecture time and ${labBookedHours.toFixed(1)}h of lab time in your selected rooms. That's already subtracted from the capacity checks below, so the merge won't double-book those slots.`
        });
      }

      // ── Courses ──
      if (courseList.length === 0) {
        checks.push({ id: 'c1', label: 'Courses', status: 'fail', detail: `No courses found for ${coordinatorProgram} in ${semester}.` });
        failCount++;
        recs.push({ type: 'blocker', title: 'Missing Course Data', body: 'The admin has not uploaded courses for your program. Contact the administrator before generating.' });
      } else {
        checks.push({ id: 'c1', label: 'Courses', status: 'pass', detail: `${courseList.length} courses loaded for ${coordinatorProgram}.` });
      }

      // ── Course Data Completeness ──
      if (incompleteCourses > 0) {
        checks.push({ id: 'data1', label: 'Course Data Completeness', status: 'warn', detail: `${incompleteCourses} course(s) have no lecture/lab unit values set and were counted as 0 hours — demand totals below may be understated.` });
        warnCount++;
        recs.push({ type: 'warning', title: 'Incomplete Course Data', body: `${incompleteCourses} course(s) are missing unitsLecture/unitsLab. Ask the admin to verify them — otherwise the readiness numbers may look better than reality.` });
      }

      // ── Lecture Room Capacity ── (compared against hours actually still
      // free — i.e. after subtracting what other approved programs already
      // hold in these rooms — not the room's raw theoretical capacity)
      const lecCourses = courseList.filter(c => (Number(c.unitsLecture) || 0) > 0);
      const lecBookedNote = lecBookedHours > 0 ? ` (${lecCapacityHours}h raw − ${lecBookedHours.toFixed(1)}h already booked by other programs)` : '';
      if (lecDemandHours > 0 && effectiveLecRooms === 0) {
        checks.push({ id: 'cap-lec', label: 'Lecture Room Capacity', status: 'fail', detail: `${lecCourses.length} course(s) need ${lecDemandHours}h of lecture time, but no lecture room is selected or configured.` });
        failCount++;
        recs.push({ type: 'blocker', title: 'No Lecture Rooms Available', body: 'Select at least one lecture room in Step 1, or ask the admin to configure lecture rooms for your program.' });
      } else if (lecDemandHours > lecAvailableHours) {
        const short = lecDemandHours - lecAvailableHours;
        checks.push({ id: 'cap-lec', label: 'Lecture Room Capacity', status: 'fail', detail: `Lecture demand is ${lecDemandHours}h, but only ${lecAvailableHours.toFixed(1)}h is actually free in your ${effectiveLecRooms} lecture room(s)${lecBookedNote} — short by ${short.toFixed(1)}h.` });
        failCount++;
        recs.push({ type: 'blocker', title: 'Insufficient Lecture Capacity', body: `You're short ${short.toFixed(1)} lecture-hour(s)${lecBookedHours > 0 ? ', partly because other approved programs already hold time in these rooms' : ''}. Select more (or different, less-contested) lecture rooms in Step 1.` });
      } else {
        const util = lecAvailableHours ? Math.round((lecDemandHours / lecAvailableHours) * 100) : 0;
        if (lecDemandHours > 0 && util >= 85) {
          checks.push({ id: 'cap-lec', label: 'Lecture Room Capacity', status: 'warn', detail: `Lecture rooms are ${util}% utilized (${lecDemandHours}h of ${lecAvailableHours.toFixed(1)}h actually free${lecBookedNote})${lecFallback ? ' — using system rooms since none are explicitly selected' : ''} — tight, but should fit.` });
          warnCount++;
          if (lecFallback) recs.push({ type: 'warning', title: 'Lecture Rooms Not Explicitly Selected', body: 'Utilization is already tight and you\'re relying on system-wide lecture rooms, which may get contested by other programs. Select specific lecture rooms in Step 1.' });
        } else {
          checks.push({ id: 'cap-lec', label: 'Lecture Room Capacity', status: 'pass', detail: lecDemandHours > 0 ? `Lecture demand is ${lecDemandHours}h, within ${lecAvailableHours.toFixed(1)}h actually free (${util}% utilized)${lecBookedNote}${lecFallback ? ', using system rooms' : ''}.` : 'No courses in this program require dedicated lecture sessions.' });
        }
      }

      // ── Lab Room Capacity (kept separate — a lab room shortfall can't be papered over with extra lecture rooms) ──
      const labCourses = courseList.filter(c => (Number(c.unitsLab) || 0) > 0);
      const labBookedNote = labBookedHours > 0 ? ` (${labCapacityHours}h raw − ${labBookedHours.toFixed(1)}h already booked by other programs)` : '';
      if (labDemandHours > 0 && effectiveLabRooms === 0) {
        checks.push({ id: 'cap-lab', label: 'Lab Room Capacity', status: 'fail', detail: `${labCourses.length} course(s) require ${labDemandHours}h of lab time, but no lab room exists or is selected for ${coordinatorProgram}.` });
        failCount++;
        recs.push({ type: 'blocker', title: 'No Lab Rooms Available', body: 'The solver has no lab room to place required lab sessions in — extra lecture rooms will NOT fix this. Select lab rooms in Step 1, or ask the admin to configure lab rooms.' });
      } else if (labDemandHours > labAvailableHours) {
        const short = labDemandHours - labAvailableHours;
        checks.push({ id: 'cap-lab', label: 'Lab Room Capacity', status: 'fail', detail: `Lab demand is ${labDemandHours}h, but only ${labAvailableHours.toFixed(1)}h is actually free in your ${effectiveLabRooms} lab room(s)${labBookedNote} — short by ${short.toFixed(1)}h.` });
        failCount++;
        recs.push({ type: 'blocker', title: 'Insufficient Lab Capacity', body: `You're short ${short.toFixed(1)} lab-hour(s)${labBookedHours > 0 ? ', partly because other approved programs already hold time in these rooms' : ''}. Select more (or different, less-contested) lab rooms in Step 1.` });
      } else {
        const util = labAvailableHours ? Math.round((labDemandHours / labAvailableHours) * 100) : 0;
        if (labDemandHours > 0 && util >= 85) {
          checks.push({ id: 'cap-lab', label: 'Lab Room Capacity', status: 'warn', detail: `Lab rooms are ${util}% utilized (${labDemandHours}h of ${labAvailableHours.toFixed(1)}h actually free${labBookedNote})${labFallback ? ' — using system rooms since none are explicitly selected' : ''} — tight, but should fit.` });
          warnCount++;
          if (labFallback) recs.push({ type: 'warning', title: 'Lab Rooms Not Explicitly Selected', body: 'Utilization is already tight and you\'re relying on system-wide lab rooms, which may get contested by other programs. Select specific lab rooms in Step 1.' });
        } else {
          checks.push({ id: 'cap-lab', label: 'Lab Room Capacity', status: 'pass', detail: labDemandHours > 0 ? `Lab demand is ${labDemandHours}h, within ${labAvailableHours.toFixed(1)}h actually free (${util}% utilized)${labBookedNote}${labFallback ? ', using system rooms' : ''}.` : 'No courses in this program require dedicated lab sessions.' });
        }
      }

      const verdict = failCount > 0 ? 'infeasible' : warnCount >= 2 ? 'at_risk' : warnCount > 0 ? 'tight' : 'feasible';
      const verdictDetail = failCount > 0
        ? 'Cannot generate until the blocking issue(s) above are resolved.'
        : warnCount >= 2
          ? 'Several warnings found — review the recommendations before generating.'
          : warnCount > 0
            ? 'Proceed with caution — one item may need attention.'
            : 'All structural checks passed.';

      const sectionCount = new Set(courseList.map(c => `${c.courseCode}__${c.blocks ?? ''}__${c.yearLevel ?? ''}`)).size;

      setDiag({
        verdict, verdictDetail,
        summary: { failCount, warnCount, totalCourses: courseList.length, totalSections: sectionCount, lectureRooms: selectedLec.length, labRooms: selectedLab.length },
        checks,
        recommendations: recs,
        accuracy_note: 'This check catches definite resource shortfalls with high accuracy but cannot predict interaction effects between multiple constraints or edge cases in the solver. A "feasible" verdict does not guarantee a perfect schedule — always review the result after solving.'
      });
    } catch (err) {
      setDiagError({ title: 'Failed to run readiness check', message: err.message || 'An unexpected error occurred.' });
    } finally {
      setDiagLoading(false);
    }
  }

  useEffect(() => {
    if (semester) runDiagnostic()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [semester, masterEvents])

  if (!semester) {
    return (
      <div className="sch-card" style={{ padding: '40px 20px', textAlign: 'center', background: 'var(--bg)' }}>
        <div style={{ fontSize: 13, color: G.muted, fontWeight: 500 }}>Waiting for the active queue to determine the academic term...</div>
      </div>
    )
  }

  const verdict = diag ? (VERDICT_META[diag.verdict] || VERDICT_META.likely_feasible) : null

  return (
    <div className="sch-card" style={{ padding: '20px' }}>
      <div style={{ animation: 'cshFadeIn .3s' }}>
        {diagLoading && !diag && (
          <div style={{ display:'flex', flexDirection:'column', gap:10, padding:'8px 0' }}>
            <Skel h={56} r={10} /><Skel h={56} r={10} /><Skel h={56} r={10} />
          </div>
        )}

        {diagError && !diagLoading && (
          <div>
            <div style={{ display: 'flex', alignItems: 'flex-start', gap: 12, padding: '14px 16px', borderRadius: 10, background: 'rgba(239, 68, 68, 0.05)', border: '1px solid #FECACA' }}>
              <div style={{ width: 32, height: 32, borderRadius: 8, background: 'rgba(239, 68, 68, 0.1)', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke='#EF4444' strokeWidth="2.5"><circle cx="12" cy="12" r="10"/><line x1="12" y1="8" x2="12" y2="12"/><line x1="12" y1="16" x2="12.01" y2="16"/></svg>
              </div>
              <div style={{ flex: 1, minWidth: 0 }}>
                <div style={{ fontSize: 13.5, fontWeight: 700, color: '#FCA5A5', marginBottom: 4 }}>{diagError.title}</div>
                <div style={{ fontSize: 12.5, color: '#EF4444', lineHeight: 1.5 }}>{diagError.message}</div>
              </div>
            </div>
            <button onClick={runDiagnostic} style={{ marginTop: 10, background: 'none', border: 'none', cursor: 'pointer', color: 'var(--meadow-text)', fontSize: 13, fontWeight: 700, fontFamily: "'Inter',sans-serif", padding: 0 }}>Retry check →</button>
          </div>
        )}

        {diag && !diagLoading && (
          <div>
            <div style={{ padding:'14px 16px', borderRadius:10, background: verdict.bg, border: `1px solid ${verdict.border}`, display:'flex', alignItems:'center', justifyContent:'space-between', gap:14, flexWrap:'wrap', marginBottom: 12 }}>
              <div style={{ display:'flex', alignItems:'center', gap:14 }}>
                <div style={{ width:44, height:44, borderRadius:11, background:verdict.color, color: '#fff', display:'flex', alignItems:'center', justifyContent:'center', fontSize:18, fontWeight:800, flexShrink:0, boxShadow: '0 2px 8px rgba(0,0,0,0.1)' }}>{verdict.icon}</div>
                <div>
                  <div style={{ fontSize:15, fontWeight:800, color:verdict.color }}>{verdict.label}</div>
                  <div style={{ fontSize:12.5, color:G.ink, marginTop:2, maxWidth:480, fontWeight: 500 }}>{diag.verdictDetail}</div>
                </div>
              </div>
              <div style={{ display:'flex', gap:18, flexShrink:0 }}>
                {[
                  { val:diag.summary.totalCourses,  label:'Courses'  },
                  { val:diag.summary.totalSections, label:'Sections'},
                  { val:diag.summary.lectureRooms,  label:'Lec Rooms'},
                  { val:diag.summary.labRooms,      label:'Lab Rooms'},
                ].map(s => (
                  <div key={s.label} style={{ textAlign:'center' }}>
                    <div style={{ fontSize:18, fontWeight:800, color:verdict.color, lineHeight:1 }}>{s.val}</div>
                    <div style={{ fontSize:10, color:G.muted2, marginTop:4, fontWeight:700, textTransform:'uppercase', letterSpacing:'.5px' }}>{s.label}</div>
                  </div>
                ))}
              </div>
            </div>

            <div style={{ display:'flex', gap:8, marginBottom: 14 }}>
              <button onClick={() => setDiagTab('checks')} className={`r-tab ${diagTab === 'checks' ? 'active' : ''}`}>Checks ({diag.checks.length})</button>
              <button onClick={() => setDiagTab('recs')} className={`r-tab ${diagTab === 'recs' ? 'active' : ''}`}>Recommendations ({diag.recommendations.length})</button>
              <span style={{ flex: 1 }} />
              <button className="check-btn" onClick={runDiagnostic} disabled={diagLoading}>
                <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"><polyline points="1 4 1 10 7 10"/><path d="M3.51 15a9 9 0 1 0 .49-4.2"/></svg> Refresh
              </button>
            </div>

            {diagTab === 'checks' && (
              <div>
                {diag.checks.map((chk, i) => {
                  const cm = CHECK_META[chk.status] || CHECK_META.pass
                  return (
                    <div key={chk.id} className="diag-check-row" style={{ animationDelay:`${i*0.04}s` }}>
                      <div style={{ width:28, height:28, borderRadius:8, background:cm.bg, border:`1px solid ${cm.border}`, display:'flex', alignItems:'center', justifyContent:'center', flexShrink:0, marginTop:2 }}>
                        <div style={{ width:10, height:10, borderRadius:'50%', background:cm.dot }}/>
                      </div>
                      <div style={{ flex:1, minWidth:0 }}>
                        <div style={{ display:'flex', alignItems:'center', gap:10, marginBottom:4 }}>
                          <span style={{ fontSize:13.5, fontWeight:700, color:G.ink }}>{chk.label}</span>
                          <span style={{ fontSize:11, fontWeight:700, padding:'2px 10px', borderRadius:99, background:cm.bg, color:cm.color, border:`1px solid ${cm.border}` }}>{cm.label}</span>
                        </div>
                        <p style={{ fontSize:12.5, color:G.muted, margin:0, lineHeight:1.55 }}>{chk.detail}</p>
                      </div>
                    </div>
                  )
                })}
              </div>
            )}

            {diagTab === 'recs' && (
              <div style={{ display:'flex', flexDirection:'column', gap:12 }}>
                {diag.recommendations.length === 0 && <div style={{ textAlign:'center', padding:'24px 0', color:G.muted, fontSize:13, fontWeight:500 }}>No recommendations — everything looks good.</div>}
                {diag.recommendations.map((rec, i) => {
                  const rm = REC_META[rec.type] || REC_META.suggestion
                  const icons = { blocker: <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"><circle cx="12" cy="12" r="10"/><line x1="12" y1="8" x2="12" y2="12"/><line x1="12" y1="16" x2="12.01" y2="16"/></svg>, warning: <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"><path d="M10.29 3.86L1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z"/><line x1="12" y1="9" x2="12" y2="13"/><line x1="12" y1="17" x2="12.01" y2="17"/></svg>, suggestion: <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"><circle cx="12" cy="12" r="10"/><line x1="12" y1="16" x2="12" y2="12"/><line x1="12" y1="8" x2="12.01" y2="8"/></svg>, success: <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"><polyline points="20 6 9 17 4 12"/></svg> }
                  return (
                    <div key={i} className="diag-rec" style={{ background:rm.bg, borderColor:rm.border }}>
                      <div style={{ width:32, height:32, borderRadius:8, background:rm.border, color:rm.color, display:'flex', alignItems:'center', justifyContent:'center', flexShrink:0, marginTop:2 }}>{icons[rec.type]}</div>
                      <div>
                        <div style={{ fontSize:13.5, fontWeight:700, color:G.ink, marginBottom:4 }}>{rec.title}</div>
                        <p style={{ fontSize:12.5, color:G.muted, margin:0, lineHeight:1.55 }}>{rec.body}</p>
                      </div>
                    </div>
                  )
                })}
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  )
}

/* ─────────────────────────── PAGE EXPORT ─────────────────────────── */

export default function CoordSchedulerPage() {
  const { coordinatorProgram } = useAuth()
  const navigate = useNavigate()
  const { toasts, toast } = useToast()

  const [wizStep, setWizStep] = useState(1)
  const [maxReached, setMaxReached] = useState(1)
  const [slideDir, setSlideDir] = useState('enter')

  // Steps depend on which wizard step is currently mounted, since every
  // step swaps out its DOM entirely (Readiness/Generate/Review are not
  // present while on Setup, and vice versa). useTour reads `steps` fresh
  // on every render, so recomputing this per wizStep is enough to make
  // the single header '?' button show the right walkthrough wherever the
  // coordinator currently is, without needing a separate tour per step.
  const stepsForWizStep = useMemo(() => {
    if (wizStep === 1) {
      return [
        {
          target: '#tour-wiz-nav',
          title: 'Welcome to the Scheduler',
          content: 'This 4-step wizard walks you through Queue & Room Setup, Readiness checks, Generating, and finally Reviewing & Saving your schedule. Once a step is complete you can jump back to it any time by clicking its label here.',
          disableBeacon: true,
        },
        {
          target: '#tour-queue-card',
          title: 'Queue Status',
          content: 'Schedules are generated one program at a time. This card shows whose turn it is and where you sit in line — feel free to look around while you wait, but the solver stays locked until it\'s your turn.',
        },
        {
          target: '#tour-room-selection',
          title: 'Room Selection',
          content: 'Pick the lecture and lab rooms your program is allowed to use. Only rooms checked here are available to the solver, so leaving one unchecked means it will never be scheduled into it. Don\'t forget to save your selection — "Continue to Readiness" stays disabled until you do.',
          placement: 'top',
        },
        {
          target: '#tour-room-usage-legend',
          title: 'Reading the Room Badges',
          content: 'The % badge on a room shows how full it already is from programs approved ahead of you in the queue — green is mostly free, amber is filling up, red is nearly booked out. Picking a room that\'s already near capacity leaves the solver less room to work with.',
          placement: 'top',
        },
        {
          target: '#tour-my-schedules',
          title: 'My Schedules',
          content: 'Every schedule you\'ve generated and saved shows up here. A draft can be viewed, renamed, or submitted for the admin\'s approval, and a submitted schedule can still be recalled if you need to make changes.',
          // This card sits near the top of the page, so the default
          // bottom/top placement had nowhere to flip to without clipping
          // above the viewport. Anchoring to its left keeps the tooltip
          // fully on-screen regardless of scroll position.
          placement: 'left',
        },
        {
          target: '#tour-wiz-next',
          title: 'Next: Readiness',
          content: 'Once your rooms are saved, click here to move on. The steps ahead let you run the readiness check, start the solver, and review the generated timetable before saving it as a new draft.',
          placement: 'top',
        },
      ]
    }
    if (wizStep === 2) {
      return [
        {
          target: '#tour-readiness-panel',
          title: 'Readiness Check',
          content: 'This step checks whether your course and room setup can structurally support a schedule before you spend time generating one. Each check either passes, warns, or fails, and includes the underlying utilization percentage — e.g. how much of your lecture or lab room capacity is already demanded. A fail here means generating won\'t produce a usable schedule, so it\'s worth fixing the underlying course or room setup first. Hit Refresh after making changes elsewhere to re-run these checks.',
          placement: 'center',
          disableBeacon: true,
        },
        {
          target: '#tour-wiz-next',
          title: 'Next: Generate',
          content: 'Once you\'re satisfied with readiness, continue on to Generate. Note that generating itself stays locked until it\'s your turn in the queue.',
          placement: 'top',
        },
      ]
    }
    if (wizStep === 3) {
      return [
        {
          target: '#tour-solver-engine',
          title: 'Generate',
          content: 'This is the Generate step, where the constraint solver actually builds a timetable for your program using the rooms you selected earlier. Hit Start Solver to run it — it\'s safe to navigate away while it runs since it continues in the background.',
          placement: 'center',
          disableBeacon: true,
        },
        {
          target: '#tour-sch-phase-order',
          title: 'Phase Priority Order',
          content: 'New! You can now drag and drop these phases to change the order in which the solver prioritizes them. Phases scheduled earlier get first pick of available rooms and faculty.',
          placement: 'top',
        },
      ]
    }
    // wizStep === 4
    return [
      {
        target: '#tour-review-result',
        title: 'Review & Save',
        content: 'Check the generated timetable over before committing it as a draft. Every event the solver placed shows up here — switch views, filter, or search to check for anything that looks off before saving. You can still re-generate from the Generate step if something needs fixing.',
        placement: 'center',
        disableBeacon: true,
      },
      {
        target: '#tour-save-schedule',
        title: 'Save as Draft',
        content: 'Give this run a name and save it as a draft. It won\'t be submitted for approval automatically — you can find it later under My Schedules to submit whenever you\'re ready.',
        placement: 'top',
      },
    ]
  }, [wizStep])

  const { TourComponent, startTour, run: tourRunning } = useTour('coordScheduler', stepsForWizStep)

  // When the coordinator advances/returns to a different wizard step while
  // the main tour is actively running, `stepsForWizStep` above swaps out
  // entirely for that step's own array. Without this, the tour's stepIndex
  // stays wherever it was in the *previous* array (often past the end of
  // the new, shorter one), which made Joyride re-measure against
  // '#tour-wiz-nav' over and over — the "keeps re-highlighting the
  // stepper" loop. Jumping back to index 0 of the fresh array whenever the
  // wizard step actually changes (not on every render) keeps the tour
  // moving forward into that step's real content instead.
  const prevWizStepRef = useRef(wizStep)
  useEffect(() => {
    if (prevWizStepRef.current !== wizStep) {
      if (tourRunning) startTour()
      prevWizStepRef.current = wizStep
    }
  }, [wizStep, tourRunning, startTour])

  const [turnData, setTurnData] = useState(null)
  const [schedules, setSchedules] = useState([])
  const [loadingInit, setLoadingInit] = useState(true)

  const [allRooms, setAllRooms] = useState({ lecture: [], lab: [] })
  const [selLecture, setSelLecture] = useState([])
  const [selLab, setSelLab] = useState([])
  const [roomsLoading, setRoomsLoading] = useState(true)
  const [roomsSaving, setRoomsSaving] = useState(false)
  const [roomsDirty, setRoomsDirty] = useState(false)

  // Events from every program already approved ahead of this coordinator in
  // the queue — used to show which rooms are filling up before generating,
  // and fed to the readiness checker so it doesn't count hours other
  // programs already claimed as still "available".
  const [masterEvents, setMasterEvents] = useState([])
  const [globalSettings, setGlobalSettings] = useState(null)

  // Editable solving phase order (shown on the Solve step). null = use
  // backend default order end-to-end (nothing sent to /generate).
  const [schedulePhases, setSchedulePhases] = useState(null)
  const [defaultPhaseOrder, setDefaultPhaseOrder] = useState(null)
  const [phaseOrder, setPhaseOrder] = useState(null)

  useEffect(() => {
    let cancelled = false
    getCoordSchedulePhases().then(res => {
      if (cancelled) return
      setSchedulePhases(res.phases || [])
      setDefaultPhaseOrder(res.default || null)
    }).catch(() => {})
    return () => { cancelled = true }
  }, [])

  // Moves the phase at fromIndex to toIndex (arbitrary distance — used by
  // both drag-and-drop and the arrow-button fallback, which just passes
  // toIndex = fromIndex ± 1).
  function reorderPhase(fromIndex, toIndex) {
    const current = (phaseOrder && phaseOrder.length ? phaseOrder : defaultPhaseOrder) || DEFAULT_PHASE_KEYS
    if (toIndex < 0 || toIndex >= current.length || fromIndex === toIndex) return
    const next = current.slice()
    const [moved] = next.splice(fromIndex, 1)
    next.splice(toIndex, 0, moved)
    setPhaseOrder(next)
  }

  const roomUsage = useMemo(() => {
    const hours = summarizeRoomHours(masterEvents)
    const activeDays = (globalSettings?.days || []).length || 6
    const startT = Number(globalSettings?.time?.start_time) || 7
    const endT = Number(globalSettings?.time?.end_time) || 21
    const weeklyCap = Math.max(1, activeDays * (endT - startT))
    const out = {}
    for (const [room, h] of Object.entries(hours)) {
      out[room] = { hours: h, pct: Math.min(100, Math.round((h / weeklyCap) * 100)) }
    }
    return out
  }, [masterEvents, globalSettings])

  const {
    processId, progress, status: statusState, result,
    error: genError, errorKind: genErrorKind,
    setProcessId, setProgress, setStatus, setLabel, setResult,
    setError, setErrorKind,
  } = useCoordSolverStore()

  // Format the rich error detail if passed as an object
  const genErrorDetails = typeof genError === 'object' ? genError : {
    failedPhase: 'Unknown Phase',
    reasons: [typeof genError === 'string' ? genError : 'Unspecified constraint failure.'],
    suggestions: ['Check your room selection and time constraints.']
  };

  const [saveName, setSaveName] = useState('')
  const [saving, setSaving] = useState(false)
  const [saved, setSaved] = useState(false)
  const [savedScheduleId, setSavedScheduleId] = useState(null)
  const [resultSearch, setResultSearch] = useState('')
  // True from the moment Stop is clicked until the backend actually confirms
  // the solve has unwound (see handleCancel). The solver only checks for a
  // cancellation between phases, so this can lag the click by a while —
  // starting a new solve during that window is what causes the "already
  // running" 409 conflict.
  const [stopRequested, setStopRequested] = useState(false)
  const [activeDay, setActiveDay] = useState('Monday')
  const [reviewViewMode, setReviewViewMode] = useState('grid')

  const [renameId, setRenameId] = useState(null)
  const [renameTmp, setRenameTmp] = useState('')
  const [actionLoading, setActionLoading] = useState(null)

  const isMyTurn = turnData?.isMyTurn

  // Separate one-time guide for the moment a coordinator first reaches
  // Step 3 while it's actually their turn. Uses its own tourId so it has
  // its own localStorage "seen" flag, independent of the Step-1 intro
  // tour above. isReady is only true while both conditions hold, so
  // useTour's internal effect re-checks (and can auto-arm) the moment
  // isMyTurn flips true via the 15s poll while already sitting on Step 3.
  const { TourComponent: TurnTourComponent } = useTour(
    'coordSchedulerYourTurn',
    [
      {
        target: '#tour-wiz-next',
        title: "It's Your Turn",
        content: "You can now run the solver — hit Start Solver whenever you're ready. It runs in the background, so it's safe to navigate away while it works.",
        disableBeacon: true,
      },
    ],
    isMyTurn && wizStep === 3,
    { isPrimary: false }
  )

  const currentProg = turnData?.currentProgram
  const myPos = turnData?.myPosition
  const qLen = turnData?.queueLength
  // Backend sometimes sends -1 (or 0) as a "position unknown" sentinel instead
  // of omitting the field entirely — guard against rendering that raw.
  const myPosDisplay = (typeof myPos === 'number' && myPos > 0) ? myPos : '–'
  const qLenDisplay = (typeof qLen === 'number' && qLen > 0) ? qLen : '–'
  const queueList = turnData?.queue || []
  const hasQueue = turnData?.queueId != null
  const roundSemester = turnData?.semester
  const roundAY = turnData?.academicYear

  // When the backend has no "turn" left to report for this coordinator, it
  // just omits queueId — which used to render as "No active queue", the same
  // message shown before a queue ever existed. But "no turn left" usually
  // means the coordinator already finished this round (schedule submitted
  // or approved), not that nothing has happened yet. Tell those two apart
  // using their own schedule history so a done coordinator sees "you're
  // done", not a message implying they still need to wait on the admin.
  const latestActiveSchedule = !hasQueue
    ? [...schedules]
        .filter(s => s.status === 'submitted' || s.status === 'approved')
        .sort((a, b) => (new Date(b.createdAt || 0)) - (new Date(a.createdAt || 0)))[0]
    : null
  const doneStatus = latestActiveSchedule?.status || null // 'approved' | 'submitted' | null
  function doneTermLabel(s) {
    const parts = [s?.academicYear ? `A.Y. ${s.academicYear}` : null, s?.semester || null].filter(Boolean)
    return parts.length ? parts.join(' • ') : null
  }

  useEffect(() => { loadAll() }, [])

  // The queue rail (who's waiting/active/generating/submitted) was only ever
  // fetched once on page load, so a coordinator sitting on Setup/Readiness
  // had no way to see the active program start generating or finish without
  // refreshing the page. Poll just the turn/queue snapshot in the background —
  // but only while the tab is actually visible, so a coordinator who leaves
  // this tab open in the background all day isn't silently burning a read
  // every 10s for a screen nobody's looking at.
  useEffect(() => {
    let id = null
    function start() {
      if (id) return
      id = setInterval(() => {
        coordCheckTurn().then(t => t && setTurnData(t)).catch(() => {})
      }, 15000)
    }
    function stop() {
      if (id) { clearInterval(id); id = null }
    }
    function onVisibility() {
      if (document.hidden) stop(); else start()
    }
    if (!document.hidden) start()
    document.addEventListener('visibilitychange', onVisibility)
    return () => { stop(); document.removeEventListener('visibilitychange', onVisibility) }
  }, [])

  function loadAll() {
    setLoadingInit(true)
    setRoomsLoading(true)
    Promise.all([
      coordCheckTurn().catch(() => null),
      coordListSchedules().catch(() => []),
      coordGetRooms ? coordGetRooms().catch(() => ({ lecture: [], lab: [] })) : Promise.resolve({ lecture: [], lab: [] }),
      coordGetSelectedRooms ? coordGetSelectedRooms().catch(() => ({ lecture: [], lab: [] })) : Promise.resolve({ lecture: [], lab: [] }),
      // Needs the actual sessions (not just approvedPrograms) to run the
      // room/faculty conflict checks in CoordinatorCheckPanel below.
      coordGetSubmittedSchedule ? coordGetSubmittedSchedule(true).catch(() => ({ schedule: [] })) : Promise.resolve({ schedule: [] }),
      coordGetSettings ? coordGetSettings().catch(() => null) : Promise.resolve(null),
    ]).then(([t, s, rooms, selected, master, settings]) => {
      setTurnData(t)
      setSchedules(Array.isArray(s) ? s : [])
      setAllRooms({ lecture: rooms?.lecture || [], lab: rooms?.lab || [] })
      setSelLecture(selected?.lecture || [])
      setSelLab(selected?.lab || [])
      setMasterEvents(master?.schedule || [])
      setGlobalSettings(settings)
    }).finally(() => { setLoadingInit(false); setRoomsLoading(false) })
  }

  function toggleRoom(type, room) {
    const setter = type === 'lecture' ? setSelLecture : setSelLab
    setter(prev => prev.includes(room) ? prev.filter(r => r !== room) : [...prev, room])
    setRoomsDirty(true)
  }

  function selectAllRooms(type) {
    const setter = type === 'lecture' ? setSelLecture : setSelLab
    setter([...(type === 'lecture' ? allRooms.lecture : allRooms.lab)])
    setRoomsDirty(true)
  }

  function clearRooms(type) {
    const setter = type === 'lecture' ? setSelLecture : setSelLab
    setter([])
    setRoomsDirty(true)
  }

  async function handleSaveRooms() {
    setRoomsSaving(true)
    try {
      await coordSelectRooms({ lecture: selLecture, lab: selLab })
      setRoomsDirty(false)
      toast('Room selection saved', 'success')
    } catch {
      toast('Failed to save room selection', 'error')
    } finally {
      setRoomsSaving(false)
    }
  }

  useEffect(() => {
    if (statusState === 'running') {
      setMaxReached(m => Math.max(m, 3))
      goStep(3)
    }
  }, [statusState])

  useEffect(() => {
    if (statusState === 'complete' && result) {
      setSaved(false)
      setSavedScheduleId(null)
      setMaxReached(m => Math.max(m, 4))
      goStep(4)
      setSaveName(prev => prev || [roundSemester, roundAY].filter(Boolean).join(' ').trim())
    }
  }, [statusState, result])

  // Belt-and-suspenders: pre-fill the save name with the academic term
  // whenever step 4 is actually reached, not just on the fresh-solve path
  // above (e.g. if the user lands on Review & Save some other way). Only
  // fills in a still-empty field — never overwrites something the
  // coordinator already typed.
  useEffect(() => {
    if (wizStep === 4 && !saveName) {
      const suggested = [roundSemester, roundAY].filter(Boolean).join(' ').trim()
      if (suggested) setSaveName(suggested)
    }
  }, [wizStep, roundSemester, roundAY])

  async function handleGenerate() {
    if (!isMyTurn) return
    setStatus('running')
    setError(null)
    setErrorKind(null)
    setResult(null)
    setSaved(false)
    setSavedScheduleId(null)
    setProgress(0)
    try {
      const r = await coordGenerate(roundSemester, phaseOrder)
      setProcessId(r.processId || r.process_id)
      setLabel([coordinatorProgram, roundSemester].filter(Boolean).join(' — '))
    } catch (err) {
      const detail = err?.response?.data?.detail || 'Failed to start solver.'
      setStatus('failed')
      setError(detail)
      setErrorKind(/already running/i.test(detail) ? 'busy' : 'error')
    }
  }

  async function handleCancel() {
    if (!processId) return
    setStopRequested(true)
    try {
      await coordCancelSolve(processId)
      toast('Stopping solver…', 'info')
    } catch {
      toast('Cancel request failed to reach the server — it may keep running in the background', 'error')
    }
    // Deliberately NOT calling setStatus('idle')/setProcessId(null) here.
    // Status stays 'running' so useCoordSolverPolling keeps polling — it
    // already knows how to transition to 'idle' once the backend reports
    // the solve as actually cancelled. Jumping straight to 'idle' here used
    // to let a fast "Start Solver" click race the backend's still-running
    // process and hit the 409 "already running" conflict.
  }

  // Once the backend confirms the stop (useCoordSolverPolling sees status:
  // 'cancelled' and sets status to 'idle'), clear the "stopping" flag so the
  // Start Solver / Try Again buttons re-enable.
  useEffect(() => {
    if (stopRequested && statusState !== 'running') {
      setStopRequested(false)
    }
  }, [statusState, stopRequested])

  async function handleSaveSchedule() {
    if (!result) return
    setSaving(true)
    try {
      const savedName = saveName || 'My Schedule'
      // coordSaveSchedule just proxies whatever the backend returns for
      // POST /coordinator/schedule/save, and that shape isn't something we
      // can rely on from the frontend. Instead of guessing at response
      // fields, diff the schedule list before/after the save: whichever
      // draft is new and has the name we just saved under is the one we
      // just created. This works regardless of list ordering or how the
      // backend responds to the save call itself.
      const prevIds = new Set(schedules.map(s => s.id))
      await coordSaveSchedule({ name: savedName })
      toast('Schedule saved!', 'success')
      setSaved(true)

      const list = await coordListSchedules().catch(() => null)
      if (Array.isArray(list)) {
        setSchedules(list)
        const freshMatch = list.find(s => !prevIds.has(s.id) && s.name === savedName)
        const anyMatch = freshMatch || [...list].reverse().find(s => s.name === savedName)
        setSavedScheduleId(anyMatch?.id ?? null)
      } else {
        setSavedScheduleId(null)
        loadAll()
      }
    } catch (err) {
      toast(err?.response?.data?.detail || 'Failed to save schedule.', 'error')
    } finally {
      setSaving(false)
    }
  }

  async function handleRename(id) {
    if (!renameTmp.trim()) return
    setActionLoading(id + '_rename')
    try {
      await coordRenameSchedule(id, { name: renameTmp.trim() })
      setSchedules(p => p.map(s => s.id === id ? { ...s, name: renameTmp.trim() } : s))
      setRenameId(null)
      toast('Renamed', 'success')
    } catch { toast('Failed to rename', 'error') }
    finally { setActionLoading(null) }
  }

  async function handleDelete(id, name) {
    if (!window.confirm(`Delete "${name}"? This cannot be undone.`)) return
    setActionLoading(id + '_del')
    try {
      await coordDeleteSchedule(id)
      setSchedules(p => p.filter(s => s.id !== id))
      toast('Deleted', 'success')
    } catch { toast('Failed to delete', 'error') }
    finally { setActionLoading(null) }
  }

  async function handleDuplicate(id, name) {
    const newName = `${name} (copy)`
    setActionLoading(id + '_dup')
    try {
      await coordDuplicateSchedule(id, { name: newName })
      toast('Duplicated', 'success')
      loadAll()
    } catch { toast('Failed to duplicate', 'error') }
    finally { setActionLoading(null) }
  }

  async function handleSubmit(id) {
    setActionLoading(id + '_sub')
    try {
      await coordSubmitSchedule(id)
      setSchedules(p => p.map(s => s.id === id ? { ...s, status: 'submitted' } : s))
      toast('Submitted for approval', 'success')
    } catch { toast('Failed to submit', 'error') }
    finally { setActionLoading(null) }
  }

  async function handleUnsubmit(id) {
    setActionLoading(id + '_unsub')
    try {
      await coordUnsubmitSchedule(id)
      setSchedules(p => p.map(s => s.id === id ? { ...s, status: 'draft' } : s))
      toast('Recalled from submission', 'info')
    } catch { toast('Failed to unsubmit', 'error') }
    finally { setActionLoading(null) }
  }

  function goStep(n) {
    setSlideDir(n > wizStep ? 'enter' : 'back')
    setWizStep(n)
    setMaxReached(m => Math.max(m, n))
  }

  const [overlayMaster, setOverlayMaster] = useState(false)
  const [isMaximized, setIsMaximized] = useState(false)
  
  const events = result?.schedule || result?.events || []
  
  const combinedEventsForGrid = useMemo(() => {
    if (!overlayMaster) return events
    const masterOthers = masterEvents.map(e => ({ ...e, _isOtherProgram: true }))
    return [...events, ...masterOthers]
  }, [events, overlayMaster, masterEvents])

  const gridDayEvents = useMemo(() => combinedEventsForGrid.filter(e => e.day === activeDay), [combinedEventsForGrid, activeDay])
  const gridUniqueRooms = useMemo(() => Array.from(new Set(combinedEventsForGrid.map(e => e.room))).sort(), [combinedEventsForGrid])
  const filteredEvents = useMemo(() => {
    if (!resultSearch.trim()) return events
    const q = resultSearch.toLowerCase()
    return events.filter(e =>
      (e.courseCode || '').toLowerCase().includes(q) ||
      (e.day || '').toLowerCase().includes(q) ||
      (e.room || '').toLowerCase().includes(q) ||
      `${e.program}-${e.year}${e.block}`.toLowerCase().includes(q)
    )
  }, [events, resultSearch])

  const resultStats = useMemo(() => {
    if (!events.length) return null
    return {
      courses: new Set(events.map(e => e.courseCode)).size,
      rooms: new Set(events.map(e => e.room)).size,
      days: new Set(events.map(e => e.day)).size,
      sections: new Set(events.map(e => `${e.program}-${e.year}${e.block}`)).size,
    }
  }, [events])

  const totalRoomsPicked = selLecture.length + selLab.length
  const canGenerate = isMyTurn && statusState !== 'running' && !stopRequested
  const portalTarget = document.getElementById('header-stepper-portal');

  return (
    <div className="sch-root sch-wizard-shell">
      <TourComponent />
      <TurnTourComponent />

      {portalTarget 
        ? createPortal(<div id="tour-wiz-nav" style={{ display: 'flex', alignItems: 'center', gap: 10 }}><WizTopBar step={wizStep} maxReached={maxReached} onStepClick={goStep} /></div>, portalTarget) 
        : <div id="tour-wiz-nav" style={{ display: 'flex', alignItems: 'center', gap: 10 }}><WizTopBar step={wizStep} maxReached={maxReached} onStepClick={goStep} /></div>
      }

      <div className="wiz-body">
        <div key={wizStep} className={`wiz-slide wiz-slide-${slideDir}${(wizStep === 3 && statusState === 'running') ? ' no-scroll' : ''}${wizStep === 1 ? ' step1-slide' : ''}`}>

          {wizStep === 1 && (
            <div style={{ display: 'flex', flexDirection: 'column', height: '100%' }}>
              <StepHeader
                number={1}
                title="Queue & Room Setup"
                subtitle={
                  hasQueue
                    ? <>Check your turn status and pick which rooms {coordinatorProgram} can use before generating.</>
                    : doneStatus === 'approved'
                      ? <>Your {doneTermLabel(latestActiveSchedule) || 'latest'} schedule was approved — nothing to do until the next round opens.</>
                      : doneStatus === 'submitted'
                        ? <>Your {doneTermLabel(latestActiveSchedule) || 'latest'} schedule is submitted — waiting on the admin's review.</>
                        : <>Waiting for the admin to open a scheduling queue.</>
                }
                badge={hasQueue && <RoundBadge semester={roundSemester} academicYear={roundAY} light />}
              />
              
              <div className="step1-grid">
                <div className="step1-col">
                  <div className="queue-card" id="tour-queue-card">
                    <div className="queue-head">
                      <div style={{ minWidth: 0 }}>
                        <div className="queue-head-title">
                          {loadingInit ? '\u00A0'
                            : !hasQueue
                              ? (doneStatus === 'approved' ? "You're done — approved" : doneStatus === 'submitted' ? 'Submitted — awaiting review' : 'No active queue')
                              : isMyTurn ? "It's your turn" : 'Waiting in line'}
                        </div>
                        <div className="queue-head-sub">
                          {loadingInit ? '\u00A0'
                            : !hasQueue
                              ? (doneStatus === 'approved'
                                  ? <>The admin approved your {doneTermLabel(latestActiveSchedule) || 'schedule'} — you're all set for this round.</>
                                  : doneStatus === 'submitted'
                                    ? <>Sit tight — the admin hasn't reviewed your {doneTermLabel(latestActiveSchedule) || 'schedule'} yet.</>
                                    : 'The admin hasn\'t opened a scheduling queue yet.')
                              : isMyTurn
                                ? 'Pick your rooms below, then continue.'
                                : <>Currently serving <strong>{currentProg}</strong> — you're up after them.</>}
                        </div>
                      </div>

                      <div style={{ display: 'flex', alignItems: 'center', gap: 10, flexShrink: 0 }}>
                        {loadingInit ? null
                          : !hasQueue
                            ? (doneStatus === 'approved'
                                ? <svg width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="#fff" strokeWidth="2.5"><polyline points="20 6 9 17 4 12"/></svg>
                                : doneStatus === 'submitted'
                                  ? <svg width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="#fff" strokeWidth="2.2"><circle cx="12" cy="12" r="10"/><polyline points="12 6 12 12 16 14"/></svg>
                                  : null)
                            : isMyTurn ? (
                          <svg width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="#fff" strokeWidth="2.5"><polygon points="5 3 19 12 5 21 5 3"/></svg>
                        ) : (
                          <span>
                            <span className="queue-head-num">{myPosDisplay}</span>
                            <span className="queue-head-of">of {qLenDisplay}</span>
                          </span>
                        )}
                        <button onClick={loadAll} title="Refresh" className="qt-refresh">
                          <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"><polyline points="23 4 23 10 17 10"/><polyline points="1 20 1 14 7 14"/><path d="M20.49 9A9 9 0 0 0 5.64 5.64L1 10m22 4l-4.64 4.36A9 9 0 0 1 3.51 15"/></svg>
                        </button>
                      </div>
                    </div>

                    {hasQueue && queueList.length > 0 ? (
                      <div className="qt-rail-wrap">
                        <div style={{ fontSize: 10, fontWeight: 700, color: G.muted2, textTransform: 'uppercase', letterSpacing: '.6px', marginBottom: 8 }}>Queue order</div>
                        <QueueRail queue={queueList} myProgram={coordinatorProgram} currentProgram={currentProg} />
                      </div>
                    ) : !hasQueue && !loadingInit && doneStatus ? (
                      <div className="qt-empty-note" style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 10 }}>
                        <span>{doneStatus === 'approved' ? 'You can review your approved schedule any time.' : 'You can still edit or withdraw it while it waits.'}</span>
                        <button onClick={() => navigate('/coordinator/schedules')}
                          style={{ background: 'none', border: 'none', fontSize: 11.5, fontWeight: 700, color: 'var(--meadow-text-hover)', cursor: 'pointer', fontFamily: 'Inter,sans-serif', display: 'flex', alignItems: 'center', gap: 4, whiteSpace: 'nowrap', padding: 0, flexShrink: 0 }}>
                          View schedule →
                        </button>
                      </div>
                    ) : !hasQueue && !loadingInit ? (
                      <div className="qt-empty-note">You'll see the queue order here once the admin opens it.</div>
                    ) : null}
                  </div>

                  <div id="tour-room-selection" style={{ background: 'var(--surface)', border: `1px solid ${G.border}`, borderRadius: 12, overflow: 'hidden', boxShadow: '0 2px 12px rgba(0,0,0,0.03)', display: 'flex', flexDirection: 'column', flex: 1, minHeight: 0 }}>
                    <div style={{ padding: '12px 16px', display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexShrink: 0 }}>
                       <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                          <div style={{ width: 34, height: 34, borderRadius: 9, background: 'var(--bg)', display: 'flex', alignItems: 'center', justifyContent: 'center', border: `1px solid ${G.border}`, overflow: 'hidden', flexShrink: 0 }}>
                             <img src={roomsIcon} alt="" style={{ width: 20, height: 20, objectFit: 'contain' }} />
                          </div>
                          <div>
                             <div style={{ fontSize: 14, fontWeight: 800, color: G.ink }}>Room Selection</div>
                             <div style={{ fontSize: 11.5, color: G.muted, marginTop: 1 }}>Only these rooms will be used when generating</div>
                          </div>
                       </div>
                       {!roomsLoading && (
                         <div style={{ padding: '5px 12px', background: totalRoomsPicked ? 'var(--meadow-soft)' : G.amberSoft, color: totalRoomsPicked ? 'var(--meadow-deep)' : '#92400E', fontSize: 11.5, fontWeight: 700, borderRadius: 99, flexShrink: 0 }}>
                           {totalRoomsPicked} selected
                         </div>
                       )}
                    </div>

                    {!roomsLoading && (
                      <div style={{ padding: '0 16px 10px', flexShrink: 0 }}>
                        <div style={{ height: 4, background: G.borderLight, borderRadius: 99, overflow: 'hidden' }}>
                          <div style={{
                            height: '100%', borderRadius: 99, transition: 'width .3s',
                            width: `${(allRooms.lecture.length + allRooms.lab.length) ? (totalRoomsPicked / (allRooms.lecture.length + allRooms.lab.length)) * 100 : 0}%`,
                            background: totalRoomsPicked ? `linear-gradient(90deg, ${G.meadowBorder}, ${G.meadow})` : G.amber,
                          }} />
                        </div>
                      </div>
                    )}
                    
                    <div style={{ padding: '14px 16px 16px', borderTop: `1px solid ${G.border}`, flex: 1, minHeight: 0, overflowY: 'auto' }}>
                      {roomsLoading ? (
                        <div style={{ display: 'flex', gap: 20 }}>
                          <Skel h={60} style={{ flex: 1 }} /><Skel h={60} style={{ flex: 1 }} />
                        </div>
                      ) : (
                        <>
                          {totalRoomsPicked === 0 && (
                            <div style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '8px 12px', borderRadius: 7, background: G.amberSoft, border: `1px solid ${G.amberBorder}`, fontSize: 11.5, color: '#92400E', fontWeight: 600, marginTop: 8, marginBottom: 12 }}>
                              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke='#F59E0B' strokeWidth="2.5" style={{ flexShrink: 0 }}><circle cx="12" cy="12" r="10"/><line x1="12" y1="8" x2="12" y2="12"/><line x1="12" y1="16" x2="12.01" y2="16"/></svg>
                              No rooms selected — the solver will fall back to every room in the system.
                            </div>
                          )}
                          {(() => {
                            const hasLec = allRooms.lecture.length > 0
                            const hasLab = allRooms.lab.length > 0
                            const bothPresent = hasLec && hasLab
                            return (
                              <div style={{ display: 'flex', flexDirection: 'column', gap: 12, marginTop: 4 }}>
                                <div style={{ display: 'flex', gap: 28, flexWrap: 'wrap' }}>
                                  {(bothPresent || hasLec) && (
                                    <RoomGroup title="Lecture Rooms" all={allRooms.lecture} selected={selLecture} onToggle={r => toggleRoom('lecture', r)} onSelectAll={() => selectAllRooms('lecture')} onClear={() => clearRooms('lecture')} usage={roomUsage} />
                                  )}
                                  {bothPresent && (
                                    <RoomGroup title="Lab Rooms" all={allRooms.lab} selected={selLab} onToggle={r => toggleRoom('lab', r)} onSelectAll={() => selectAllRooms('lab')} onClear={() => clearRooms('lab')} usage={roomUsage} />
                                  )}
                                  {hasLab && !hasLec && (
                                    <RoomGroup title="Lab Rooms" all={allRooms.lab} selected={selLab} onToggle={r => toggleRoom('lab', r)} onSelectAll={() => selectAllRooms('lab')} onClear={() => clearRooms('lab')} usage={roomUsage} />
                                  )}
                                </div>
                                {!bothPresent && hasLec && (
                                  <RoomGroup title="Lab Rooms" all={allRooms.lab} compact />
                                )}
                                {!bothPresent && hasLab && (
                                  <RoomGroup title="Lecture Rooms" all={allRooms.lecture} compact />
                                )}
                                {!hasLec && !hasLab && (
                                  <>
                                    <RoomGroup title="Lecture Rooms" all={allRooms.lecture} compact />
                                    <RoomGroup title="Lab Rooms" all={allRooms.lab} compact />
                                  </>
                                )}
                              </div>
                            )
                          })()}
                        </>
                      )}
                    </div>
                    
                    <div style={{ padding: '10px 16px', borderTop: `1px solid ${G.border}`, display: 'flex', justifyContent: 'flex-end', background: 'var(--surface)', flexShrink: 0 }}>
                       <button className="btn-primary" onClick={handleSaveRooms} disabled={roomsSaving || !roomsDirty} style={{ padding: '8px 20px', fontSize: 12.5 }}>
                          {roomsSaving ? <svg className="spin" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"><path d="M21 12a9 9 0 1 1-6.219-8.56"/></svg> : null}
                          {roomsDirty ? 'Save Room Selection' : 'Room Selection Saved'}
                       </button>
                    </div>
                  </div>
                </div>

                <div className="sch-card" id="tour-my-schedules" style={{ display: 'flex', flexDirection: 'column', minHeight: 0 }}>
                  <div className="sch-card-header" style={{ padding: '16px 20px', flexShrink: 0, justifyContent: 'space-between' }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                      <h2 className="sch-card-title" style={{ fontSize: 14 }}>My Schedules</h2>
                      {!loadingInit && <span style={{ padding: '2px 8px', borderRadius: 6, fontSize: 10.5, fontWeight: 700, background: G.meadowSoft, color: 'var(--meadow-text)' }}>{schedules.length}</span>}
                    </div>
                    <button onClick={() => navigate('/coordinator/schedules')} style={{ background: 'none', border: 'none', fontSize: 12, fontWeight: 700, color: 'var(--meadow-text-hover)', cursor: 'pointer', fontFamily: 'Inter,sans-serif', display: 'flex', alignItems: 'center', gap: 4, whiteSpace: 'nowrap' }}>
                      View All
                      <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"><polyline points="9 18 15 12 9 6"/></svg>
                    </button>
                  </div>
                  <div style={{ flex: 1, overflowY: 'auto', minHeight: 0, background: 'var(--surface)' }}>
                    {loadingInit ? (
                      <div style={{ padding: '16px 20px', display: 'flex', flexDirection: 'column', gap: 12 }}>
                        {[1, 2, 3].map(i => <Skel key={i} h={56} r={8} />)}
                      </div>
                    ) : schedules.length === 0 ? (
                      <div style={{ padding: '40px 20px', textAlign: 'center', color: G.muted, fontSize: 13.5, fontWeight: 500 }}>No saved schedules yet. Generate one to get started!</div>
                    ) : (
                      schedules.slice(0, 8).map((sch) => {
                        const isRenaming = renameId === sch.id
                        const loading = actionLoading && actionLoading.startsWith(sch.id)
                        const schSemester = sch.semester || roundSemester
                        const schAY = sch.academicYear || roundAY
                        const subLine = [schSemester || null, schAY ? `A.Y. ${schAY}` : null].filter(Boolean).join(' • ') || null
                        
                        return (
                          <div key={sch.id} className="saved-item">
                            <div style={{ flex: 1, minWidth: 0 }}>
                              {isRenaming ? (
                                <div style={{ display: 'flex', gap: 7, alignItems: 'center', marginBottom: 6 }}>
                                  <input autoFocus value={renameTmp} onChange={e => setRenameTmp(e.target.value)} onKeyDown={e => e.key === 'Enter' && handleRename(sch.id)}
                                    style={{ padding: '6px 10px', borderRadius: 7, border: `1.5px solid ${G.meadow}`, fontSize: 12.5, fontFamily: 'Inter,sans-serif', color: G.ink, outline: 'none', width: '100%' }} />
                                  <button className="btn-primary" onClick={() => handleRename(sch.id)} style={{ padding: '6px 10px', fontSize: 11 }}>Save</button>
                                  <button className="btn-outline" onClick={() => setRenameId(null)} style={{ padding: '6px 9px', fontSize: 11 }}>Cancel</button>
                                </div>
                              ) : (
                                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 2 }}>
                                  <span className="saved-name">{sch.name}</span>
                                  <StatusBadge status={sch.status} />
                                </div>
                              )}
                              {subLine && <span className="saved-sub">{subLine}</span>}
                              
                              <div style={{ fontSize: 11.5, color: G.muted, display: 'flex', gap: 8, alignItems: 'center', flexWrap: 'wrap', marginTop: 4 }}>
                                {sch.eventCount != null && <span style={{ fontWeight: 600 }}>{sch.eventCount} events</span>}
                              </div>
                              
                              {sch.status === 'draft' && !isRenaming && (
                                <div style={{ display: 'flex', gap: 6, marginTop: 10 }}>
                                  <button className="btn-outline" style={{ padding: '5px 12px', fontSize: 11 }} onClick={() => navigate(`/coordinator/schedules/${sch.id}`)}>View</button>
                                  <button className="btn-outline" style={{ padding: '5px 12px', fontSize: 11 }} onClick={() => { setRenameId(sch.id); setRenameTmp(sch.name) }}>Rename</button>
                                  <button className="btn-primary" style={{ padding: '5px 12px', fontSize: 11 }} onClick={() => handleSubmit(sch.id)} disabled={!!loading}>Submit</button>
                                </div>
                              )}
                              {sch.status === 'submitted' && (
                                <div style={{ display: 'flex', gap: 6, marginTop: 10 }}>
                                  <button className="btn-outline" style={{ padding: '5px 12px', fontSize: 11 }} onClick={() => navigate(`/coordinator/schedules/${sch.id}`)}>View</button>
                                  <button className="btn-outline" style={{ padding: '5px 12px', fontSize: 11 }} onClick={() => handleUnsubmit(sch.id)} disabled={!!loading}>Recall</button>
                                </div>
                              )}
                            </div>
                          </div>
                        )
                      })
                    )}
                  </div>
                </div>
              </div>
            </div>
          )}

          {wizStep === 2 && (
            <div id="tour-readiness-panel" style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
              <StepHeader
                number={2}
                title="Check Readiness"
                subtitle={<>Verify structural feasibility and course setup for <strong style={{ opacity: .95 }}>{coordinatorProgram}</strong> before generating.</>}
                badge={<RoundBadge semester={roundSemester} academicYear={roundAY} light />}
              />
              {hasQueue && !isMyTurn && (
                <div style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '12px 16px', borderRadius: 10, background: G.amberSoft, border: `1px solid ${G.amberBorder}`, fontSize: 12.5, color: '#92400E', fontWeight: 600 }}>
                  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke='#F59E0B' strokeWidth="2.5" style={{ flexShrink: 0 }}><circle cx="12" cy="12" r="10"/><line x1="12" y1="8" x2="12" y2="12"/><line x1="12" y1="16" x2="12.01" y2="16"/></svg>
                  It's not your turn yet — you can review readiness now, but generating will stay locked until <strong>{currentProg || 'the current program'}</strong> finishes.
                </div>
              )}
              <CoordinatorCheckPanel semester={roundSemester} masterEvents={masterEvents} />
            </div>
          )}

          {wizStep === 3 && (
            // flex:1 + minHeight:0 is only needed for the "running" card, which
            // must fill the available height exactly so its centered loader
            // looks right. For every other state (idle/failed/complete) this
            // forced the card into a fixed-height flex box — when its content
            // (error banner + action buttons) ran taller than that box, the
            // overflow wasn't picked up by the wiz-slide scroll container, so
            // the buttons could render past the visible edge with no way to
            // scroll to them. Letting those states size naturally (height:auto)
            // fixes that.
            <div style={{ display: 'flex', flexDirection: 'column', gap: 14, ...(statusState === 'running' ? { flex: 1, minHeight: 0 } : {}) }}>
              <StepHeader
                number={3}
                title="Generate Schedule"
                subtitle={<>Run the constraint solver for <strong style={{ opacity: .95 }}>{coordinatorProgram}</strong> using your selected rooms.</>}
                badge={<RoundBadge semester={roundSemester} academicYear={roundAY} light />}
              />

              {statusState === 'running' && (
                <div className="fadein sch-card" style={{ flex:1, display:'flex', flexDirection:'column', alignItems:'center', justifyContent:'center', gap:14, padding:'16px 28px', position:'relative', overflow:'hidden', minHeight:0 }}>
                  <div style={{ position:'absolute', inset:0, background:`linear-gradient(160deg, ${G.meadowSoft} 0%, var(--surface) 55%, ${G.bg} 100%)`, pointerEvents:'none' }} />

                  <div style={{ position:'relative', zIndex:1, flexShrink:0 }}>
                    <ScheduleGeneratorLoader message="" progress={progress} showProgress={false} isOverlay={false} />
                  </div>

                  <div style={{ width:'100%', maxWidth:520, position:'relative', zIndex:1, flexShrink:0 }}>
                    <PhaseTimeline currentPhaseIdx={Math.floor((progress / 100) * 7)} status={statusState} progress={progress}
                      order={phaseOrder || defaultPhaseOrder} defaultOrder={defaultPhaseOrder} editable={false} />
                  </div>

                  <p style={{ position:'relative', zIndex:1, fontSize:12, color:G.muted, fontWeight:500, textAlign:'center', margin:0, lineHeight:1.5, flexShrink:0 }}>
                    {stopRequested
                      ? 'Stopping — the solver only checks for this between phases, so it can take a moment.'
                      : 'Running in the background — you can safely navigate away.'}
                  </p>
                </div>
              )}

              {statusState !== 'running' && (
                <div className="sch-card" id="tour-solver-engine">
                  <div className="sch-card-header">
                    <div style={{ flex: 1 }}>
                      <h2 className="sch-card-title">Solver engine</h2>
                      <p className="sch-card-sub" style={{ marginTop: 0 }}>{totalRoomsPicked} room{totalRoomsPicked === 1 ? '' : 's'} selected to evaluate.</p>
                    </div>
                    <button className="action-btn solve" onClick={handleGenerate} disabled={!canGenerate} style={{ padding:'11px 26px', fontSize:13.5, flexShrink:0 }}>
                      {statusState === 'complete' || statusState === 'failed'
                        ? <><svg width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"><polyline points="1 4 1 10 7 10"/><path d="M3.51 15a9 9 0 1 0 .49-4.2"/></svg> Re-generate</>
                        : <><svg width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"><polygon points="5 3 19 12 5 21 5 3"/></svg> Start Solver</>
                      }
                    </button>
                  </div>

                  <div className="sch-card-body">
                    <div id="tour-phase-timeline">
                      <PhaseTimeline currentPhaseIdx={Math.floor((progress / 100) * 7)} status={statusState} progress={progress}
                        order={phaseOrder || defaultPhaseOrder} defaultOrder={defaultPhaseOrder}
                        onReorder={reorderPhase} onReset={() => setPhaseOrder(null)} editable />
                    </div>

                    {!isMyTurn && statusState === 'idle' && (
                      <div style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '12px 16px', borderRadius: 9, background: G.amberSoft, border: `1px solid ${G.amberBorder}`, fontSize: 12.5, color: '#92400E', fontWeight: 600, marginTop: 14 }}>
                        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke='#F59E0B' strokeWidth="2.5"><rect x="3" y="11" width="18" height="11" rx="2"/><path d="M7 11V7a5 5 0 0 1 10 0v4"/></svg>
                        Generation is locked — it's not your turn yet.
                      </div>
                    )}

                    {statusState === 'failed' && genErrorKind === 'busy' && (
                      <div className="fadein solve-result" style={{ marginTop:14 }}>
                        <div className="solve-result-body" style={{ background: G.amberSoft }}>
                          <div style={{ width:44, height:44, borderRadius:'50%', background:'rgba(245, 158, 11, 0.1)', border:'1.5px solid #FDE68A', display:'flex', alignItems:'center', justifyContent:'center', flexShrink:0 }}>
                            <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke='#F59E0B' strokeWidth="2.5"><circle cx="12" cy="12" r="10"/><polyline points="12 6 12 12 16 14"/></svg>
                          </div>
                          <div>
                            <div style={{ fontSize:16, fontWeight:800, color:'#92400E', marginBottom:3 }}>Solver Is Busy</div>
                            <div style={{ fontSize:13.5, color:'#92400E', fontWeight:500 }}>Only one schedule can be generated system-wide at a time — another coordinator (or the admin) currently has the solver running. Your room selection is unaffected — wait a bit and try again.</div>
                          </div>
                        </div>
                        <div className="solve-result-actions">
                          <button className="solve-action-btn primary" onClick={handleGenerate} disabled={!canGenerate}>
                            <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"><polyline points="1 4 1 10 7 10"/><path d="M3.51 15a9 9 0 1 0 .49-4.2"/></svg>
                            Try Again
                          </button>
                        </div>
                      </div>
                    )}

                    {statusState === 'failed' && genErrorKind !== 'busy' && (
                      <div className="fadein solve-result failed" style={{ marginTop: 14 }}>
                        <div className="solve-result-body" style={{ background: 'rgba(239, 68, 68, 0.05)', padding: '20px' }}>
                          <div style={{ width: 44, height: 44, borderRadius: '50%', background: 'rgba(239, 68, 68, 0.1)', border: '1.5px solid #FCA5A5', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                            <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke='#EF4444' strokeWidth="2.5"><circle cx="12" cy="12" r="10"/><line x1="12" y1="8" x2="12" y2="12"/><line x1="12" y1="16" x2="12.01" y2="16"/></svg>
                          </div>
                          <div style={{ flex: 1, minWidth: 0 }}>
                            <div style={{ fontSize: 16, fontWeight: 800, color: '#FCA5A5', marginBottom: 4 }}>
                              Generation Failed in Phase: {genErrorDetails?.failedPhase || 'Constraint Solving'}
                            </div>

                            <div style={{ maxHeight: 260, overflowY: 'auto', paddingRight: 6 }}>
                              {/* Cause */}
                              {genErrorDetails?.reasons?.map((reason, idx) => (
                                <p key={idx} style={{ fontSize: 13, color: '#EF4444', margin: '4px 0', fontWeight: 500 }}>
                                  • {reason}
                                </p>
                              ))}

                              {/* Actionable Suggestions */}
                              {genErrorDetails?.suggestions?.length > 0 && (
                                <div style={{ marginTop: 12, padding: '10px 14px', borderRadius: 8, background: 'var(--surface)', border: '1px solid #FECACA' }}>
                                  <div style={{ fontSize: 12, fontWeight: 800, color: '#FCA5A5', textTransform: 'uppercase', letterSpacing: '0.5px', marginBottom: 4 }}>
                                    Suggested Actions:
                                  </div>
                                  {genErrorDetails.suggestions.map((sug, idx) => (
                                    <div key={idx} style={{ display: 'flex', alignItems: 'flex-start', gap: 6, fontSize: 12.5, color: '#7F1D1D', marginTop: 4 }}>
                                      <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke='#EF4444' strokeWidth="2.5" style={{ flexShrink: 0, marginTop: 2 }}><polyline points="9 18 15 12 9 6"/></svg>
                                      <span>{sug}</span>
                                    </div>
                                  ))}
                                </div>
                              )}
                            </div>
                          </div>
                        </div>
                        <div className="solve-result-actions">
                          <button className="solve-action-btn ghost" onClick={() => goStep(1)}>
                            Adjust Room Selection
                          </button>
                          <button className="solve-action-btn primary" onClick={handleGenerate} disabled={!canGenerate}>
                            Try Again
                          </button>
                        </div>
                      </div>
                    )}

                    {statusState === 'complete' && (
                      <div className="fadein solve-result complete" style={{ marginTop:14 }}>
                        <div className="solve-result-body" style={{ background:'var(--meadow-soft)' }}>
                          <div style={{ width:44, height:44, borderRadius:'50%', background:'var(--meadow-soft)', border:'1.5px solid var(--mint)', display:'flex', alignItems:'center', justifyContent:'center', flexShrink:0 }}>
                            <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="var(--meadow)" strokeWidth="3"><polyline points="20 6 9 17 4 12"/></svg>
                          </div>
                          <div style={{ flex:1, minWidth:0 }}>
                            <div style={{ fontSize:16, fontWeight:800, color:G.ink, marginBottom:3 }}>Schedule Generated Successfully</div>
                            <div style={{ fontSize:13.5, color:G.muted, fontWeight:500 }}>
                              Your generated schedule is ready in memory.
                            </div>
                          </div>
                        </div>
                        <div className="solve-result-actions">
                          <button className="solve-action-btn primary" onClick={() => goStep(4)}>
                            <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"><path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z"/><circle cx="12" cy="12" r="3"/></svg>
                            View Result
                          </button>
                        </div>
                      </div>
                    )}
                  </div>
                </div>
              )}
            </div>
          )}

          {wizStep === 4 && (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
              <StepHeader
                number={4}
                title="Review & Save"
                subtitle={result ? <>{events.length} events generated for <strong style={{ opacity: .95 }}>{coordinatorProgram}</strong> — check them over, then save as a draft.</> : <>Generate a schedule in Step 3 first.</>}
                badge={<RoundBadge semester={roundSemester} academicYear={roundAY} light />}
              />

              {!result ? (
                <div className="sch-card" style={{ padding: '60px 20px', textAlign: 'center' }}>
                  <div style={{ fontSize: 14, color: G.muted, marginBottom: 16, fontWeight: 500 }}>No generated schedule yet.</div>
                  <button className="btn-primary" onClick={() => goStep(3)} style={{ padding: '10px 20px', fontSize: 13 }}>Go to Generate step</button>
                </div>
              ) : (
                <>
                  {resultStats && (
                    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(5, 1fr)', gap: 10 }}>
                      {[
                        { val: events.length, label: 'Total Events' },
                        { val: resultStats.courses, label: 'Courses' },
                        { val: resultStats.sections, label: 'Sections' },
                        { val: resultStats.rooms, label: 'Rooms Used' },
                        { val: resultStats.days, label: 'Days Used' },
                      ].map(s => (
                        <div key={s.label} style={{ background: 'var(--surface)', border: `1px solid ${G.border}`, borderRadius: 10, padding: '12px 14px', boxShadow: '0 1px 6px rgba(0,0,0,0.03)' }}>
                          <div style={{ fontSize: 20, fontWeight: 800, color: 'var(--meadow-text)', lineHeight: 1 }}>{s.val}</div>
                          <div style={{ fontSize: 10.5, color: G.muted, fontWeight: 700, marginTop: 5, textTransform: 'uppercase', letterSpacing: '.4px' }}>{s.label}</div>
                        </div>
                      ))}
                    </div>
                  )}

                  <div className="sch-card" id="tour-review-result">
                    <div className="sch-card-header" style={{ flexWrap: 'wrap', gap: 12 }}>
                      <div style={{ flex: 1, display: 'flex', alignItems: 'center', gap: 10, minWidth: 200 }}>
                        <h2 className="sch-card-title">Generated Result</h2>
                        <span style={{ padding: '3px 10px', borderRadius: 6, fontSize: 11, fontWeight: 700, background: G.meadowSoft, color: 'var(--meadow-text)' }}>{filteredEvents.length} of {events.length} shown</span>
                      </div>
                      <div style={{ display: 'flex', gap: 10, alignItems: 'center' }}>
                        <div style={{ display: 'flex', background: G.hover, borderRadius: 8, padding: 4 }}>
                          <button onClick={() => setReviewViewMode('grid')}
                            style={{ padding: '6px 12px', fontSize: 11, fontWeight: 600, borderRadius: 6, cursor: 'pointer', border: 'none', background: reviewViewMode === 'grid' ? 'var(--surface)' : 'transparent', color: reviewViewMode === 'grid' ? G.ink : G.muted2, boxShadow: reviewViewMode === 'grid' ? '0 1px 3px rgba(0,0,0,0.1)' : 'none' }}>
                            Grid
                          </button>
                          <button onClick={() => setReviewViewMode('table')}
                            style={{ padding: '6px 12px', fontSize: 11, fontWeight: 600, borderRadius: 6, cursor: 'pointer', border: 'none', background: reviewViewMode === 'table' ? 'var(--surface)' : 'transparent', color: reviewViewMode === 'table' ? G.ink : G.muted2, boxShadow: reviewViewMode === 'table' ? '0 1px 3px rgba(0,0,0,0.1)' : 'none' }}>
                            List
                          </button>
                        </div>
                        <div style={{ position: 'relative' }}>
                          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke={G.muted2} strokeWidth="2.5" style={{ position: 'absolute', left: 10, top: '50%', transform: 'translateY(-50%)', pointerEvents: 'none' }}>
                            <circle cx="11" cy="11" r="8"/><line x1="21" y1="21" x2="16.65" y2="16.65"/>
                          </svg>
                          <input className="cp-inp" placeholder="Search events..." value={resultSearch} onChange={e => setResultSearch(e.target.value)} style={{ width: 220, padding: '8px 10px 8px 32px', fontSize: 12 }} />
                        </div>
                        <button className="btn-danger" onClick={() => { setResult(null); goStep(3) }} style={{ padding: '8px 14px', fontSize: 12 }}>
                          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg>
                          Discard
                        </button>
                      </div>
                    </div>
                    <div className="csh-table-wrap" style={{ maxHeight: reviewViewMode === 'grid' ? 500 : 380, overflowY: 'auto' }}>
                      {reviewViewMode === 'table' ? (
                        <table style={{ width: '100%', borderCollapse: 'collapse' }}>
                          <thead style={{ position: 'sticky', top: 0, zIndex: 1 }}>
                            <tr style={{ background: G.hover }}>
                              {['Course', 'Section', 'Session', 'Day', 'Period', 'Room'].map(h => (
                                <th key={h} style={{ padding: '12px 20px', textAlign: 'left', fontSize: 11, fontWeight: 700, color: G.muted2, textTransform: 'uppercase', letterSpacing: '0.8px', borderBottom: `1px solid ${G.border}`, whiteSpace: 'nowrap' }}>{h}</th>
                              ))}
                            </tr>
                          </thead>
                          <tbody>
                            {filteredEvents.length === 0 ? (
                              <tr><td colSpan={6} style={{ padding: '32px', textAlign: 'center', fontSize: 13, color: G.muted, fontWeight: 500 }}>No events match "{resultSearch}"</td></tr>
                            ) : filteredEvents.map((e, i) => (
                              <tr key={i} className="cp-tr-hover">
                                <td style={{ padding: '10px 20px', fontSize: 12.5, fontWeight: 700, color: G.ink, borderBottom: `1px solid ${G.borderLight}` }}>{e.courseCode}</td>
                                <td style={{ padding: '10px 20px', fontSize: 12.5, color: G.muted, borderBottom: `1px solid ${G.borderLight}` }}>{e.program}-{e.year}{e.block}</td>
                                <td style={{ padding: '10px 20px', fontSize: 12, color: G.muted, borderBottom: `1px solid ${G.borderLight}` }}>{e.session}</td>
                                <td style={{ padding: '10px 20px', fontSize: 12, color: G.muted, borderBottom: `1px solid ${G.borderLight}` }}>{e.day}</td>
                                <td style={{ padding: '10px 20px', fontSize: 12, color: G.muted, whiteSpace: 'nowrap', borderBottom: `1px solid ${G.borderLight}` }}>{e.period}</td>
                                <td style={{ padding: '10px 20px', fontSize: 12, color: G.muted, borderBottom: `1px solid ${G.borderLight}` }}>{e.room}</td>
                              </tr>
                            ))}
                          </tbody>
                        </table>
                      ) : (
                        <div style={{
                          display: 'flex', flexDirection: 'column', height: '100%', minHeight: 450, padding: '12px 16px',
                          ...(isMaximized ? { position: 'fixed', top: 0, left: 0, right: 0, bottom: 0, background: 'var(--surface)', zIndex: 9999, minHeight: '100vh', padding: '24px 32px' } : {})
                        }}>
                          <div style={{ display: 'flex', gap: 12, marginBottom: 16, overflowX: 'auto', paddingBottom: 4, alignItems: 'center' }}>
                            <div style={{ display: 'flex', gap: 6 }}>
                              {['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'].map(d => (
                                <button key={d} onClick={() => setActiveDay(d)} 
                                  style={{
                                    padding: '6px 13px', borderRadius: 20, fontSize: 12, fontWeight: 500,
                                    cursor: 'pointer', border: '1px solid var(--border)',
                                    background: activeDay === d ? `linear-gradient(135deg, ${G.meadow}, ${G.meadowDeep})` : 'var(--surface)',
                                    color: activeDay === d ? '#fff' : G.muted,
                                    transition: 'all .15s', whiteSpace: 'nowrap',
                                    boxShadow: activeDay === d ? '0 2px 8px rgba(0,0,0,.3)' : 'none'
                                  }}>
                                  {d}
                                </button>
                              ))}
                            </div>
                            <div style={{ flex: 1 }} />
                            <label style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: 11.5, fontWeight: 600, color: G.muted2, cursor: 'pointer', background: 'var(--bg)', padding: '6px 12px', borderRadius: 8, border: `1px solid ${G.border}` }}>
                              <input type="checkbox" checked={overlayMaster} onChange={e => setOverlayMaster(e.target.checked)} style={{ cursor: 'pointer' }} />
                              Show Other Programs (Background)
                            </label>
                            <button onClick={() => setIsMaximized(m => !m)} title={isMaximized ? "Restore size" : "Maximize"}
                              style={{ padding: '6px', borderRadius: 8, background: 'var(--bg)', border: `1px solid ${G.border}`, color: G.muted, cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                              {isMaximized ? (
                                <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"><path d="M8 3v3a2 2 0 0 1-2 2H3m18 0h-3a2 2 0 0 1-2-2V3m0 18v-3a2 2 0 0 1 2-2h3M3 16h3a2 2 0 0 1 2 2v3"/></svg>
                              ) : (
                                <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"><path d="M15 3h6v6M9 21H3v-6M21 3l-7 7M3 21l7-7"/></svg>
                              )}
                            </button>
                          </div>
                          <div style={{ flex: 1, minHeight: 400 }}>
                            <TimeGrid 
                              rooms={gridUniqueRooms} dayEvents={gridDayEvents} conflictMap={new Map()}
                              locked={true} gridSize="normal" fullscreen={isMaximized}
                              ambientConflictIds={new Set()} ambientMergeIds={new Set()}
                              conflictingDragIds={new Set()} dragConflictBands={[]}
                              mergedIds={new Set()} allEvents={combinedEventsForGrid} availabilityMap={new Map()}
                            />
                          </div>
                        </div>
                      )}
                    </div>
                    <div id="tour-save-schedule" style={{ padding: '18px 20px', borderTop: `1px solid ${G.border}`, display: 'flex', gap: 16, flexWrap: 'wrap', alignItems: 'center', background: 'var(--bg)' }}>
                      <div style={{ width: 38, height: 38, borderRadius: 10, background: G.meadowSoft, border: `1px solid ${G.meadowBorder}`, display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                        <svg width="17" height="17" viewBox="0 0 24 24" fill="none" stroke={G.meadowDeep} strokeWidth="2.5"><path d="M19 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h11l5 5v11a2 2 0 0 1-2 2z"/><polyline points="17 21 17 13 7 13 7 21"/><polyline points="7 3 7 8 15 8"/></svg>
                      </div>
                      <div style={{ flex: 1, minWidth: 220 }}>
                        <label style={{ fontSize: 11.5, fontWeight: 700, color: G.muted2, display: 'block', marginBottom: 6, textTransform: 'uppercase', letterSpacing: '0.5px' }}>Save As</label>
                        <input className="cp-inp" value={saveName} onChange={e => setSaveName(e.target.value)} placeholder="e.g. 1st Sem Draft A"
                          onKeyDown={e => e.key === 'Enter' && saveName.trim() && handleSaveSchedule()} style={{ fontSize: 13.5 }} />
                      </div>
                      <button className="btn-primary" onClick={handleSaveSchedule} disabled={saving || !saveName.trim() || saved}
                        style={{ padding: '10px 24px', flexShrink: 0, fontSize: 13.5 }}>
                        {saving
                          ? <svg className="spin" width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"><path d="M21 12a9 9 0 1 1-6.219-8.56"/></svg>
                          : saved ? <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"><polyline points="20 6 9 17 4 12"/></svg> : null}
                        {saved ? 'Saved' : 'Save Schedule'}
                      </button>
                    </div>
                  </div>

                  {saved && (
                    <div className="fadein sch-card" style={{ padding: '20px', display: 'flex', alignItems: 'center', gap: 16, background: G.meadowSoft, border: `1px solid ${G.meadowBorder}` }}>
                      <div style={{ width: 44, height: 44, borderRadius: '50%', background: 'var(--meadow-soft)', border: '1.5px solid var(--mint)', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                        <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="var(--meadow)" strokeWidth="3"><polyline points="20 6 9 17 4 12"/></svg>
                      </div>
                      <div style={{ flex: 1 }}>
                        <div style={{ fontSize: 15, fontWeight: 800, color: 'var(--meadow-text)', marginBottom: 2 }}>Saved as a draft</div>
                        <div style={{ fontSize: 13, color: 'var(--meadow-text)', opacity: 0.8, fontWeight: 500 }}>Your schedule is safe. You can find it in your My Schedules list to submit for approval when you're ready.</div>
                      </div>
                      <div style={{ display: 'flex', gap: 10, flexShrink: 0, flexWrap: 'wrap' }}>
                        {savedScheduleId && (
                          <button
                            className="btn-primary"
                            onClick={() => navigate(`/coordinator/schedules/${savedScheduleId}`)}
                            style={{ padding: '10px 20px', fontSize: 13, display: 'inline-flex', alignItems: 'center', gap: 7 }}>
                            <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"><path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z"/><circle cx="12" cy="12" r="3"/></svg>
                            View & Edit Schedule
                          </button>
                        )}
                        <button className="btn-outline" onClick={() => navigate('/coordinator/schedules')} style={{ padding: '10px 20px', fontSize: 13, background: 'var(--surface)' }}>Go to My Schedules</button>
                      </div>
                    </div>
                  )}
                </>
              )}
            </div>
          )}
        </div>
      </div>

      <div className="wiz-footer">
        <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
          {wizStep > 1 && (
            <button className="wiz-nav-btn back" onClick={() => goStep(wizStep - 1)}>
              <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"><polyline points="15 18 9 12 15 6"/></svg>
              Back
            </button>
          )}
          <span style={{ fontSize: 13, color: G.muted2, fontWeight: 500 }}>
            Step {wizStep} of 4 — <span style={{ color: G.ink, fontWeight: 700 }}>{WIZ_STEPS[wizStep - 1].label}</span>
          </span>
        </div>
        <div>
          {wizStep === 1 && (
            <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
              {roomsDirty && (
                <span style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 12, fontWeight: 700, color: '#92400E' }}>
                  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke='#F59E0B' strokeWidth="2.5" style={{ flexShrink: 0 }}><circle cx="12" cy="12" r="10"/><line x1="12" y1="8" x2="12" y2="12"/><line x1="12" y1="16" x2="12.01" y2="16"/></svg>
                  Save your room selection to continue
                </span>
              )}
              <button
                id="tour-wiz-next"
                className="wiz-nav-btn next"
                onClick={() => goStep(2)}
                disabled={roomsDirty}
                title={roomsDirty ? 'Save your room selection before continuing' : undefined}
              >
                Continue to Readiness
                <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"><polyline points="9 18 15 12 9 6"/></svg>
              </button>
            </div>
          )}
          {wizStep === 2 && (
            <button id="tour-wiz-next" className="wiz-nav-btn next" onClick={() => goStep(3)}>
              Continue to Generate
              <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"><polyline points="9 18 15 12 9 6"/></svg>
            </button>
          )}
          {wizStep === 3 && statusState === 'idle' && (
            <button id="tour-wiz-next" className="wiz-nav-btn solve-main next" onClick={handleGenerate} disabled={!canGenerate}>
              <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"><polygon points="5 3 19 12 5 21 5 3"/></svg>
              Start Solver
            </button>
          )}
          {wizStep === 3 && statusState === 'running' && (
            <div style={{ display:'flex', alignItems:'center', gap:10 }}>
              <div style={{ display:'flex', alignItems:'center', gap:10, padding:'10px 20px', borderRadius:10, background:G.meadowSoft, border:`1px solid ${G.meadowBorder}` }}>
                <svg className="spin" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke={G.meadowDeep} strokeWidth="2.5"><path d="M21 12a9 9 0 1 1-6.219-8.56"/></svg>
                <span style={{ fontSize:13.5, fontWeight:700, color: 'var(--meadow-text)' }}>
                  {stopRequested ? 'Stopping…' : `Solving… ${progress}%`}
                </span>
              </div>
              <button
                onClick={handleCancel}
                disabled={stopRequested}
                style={{ display:'inline-flex', alignItems:'center', gap:7, padding:'10px 18px', borderRadius:10, border:'1.5px solid #FECACA', background:'rgba(220, 38, 38, 0.05)', color:'#EF4444', fontSize:13, fontWeight:700, cursor: stopRequested ? 'default' : 'pointer', opacity: stopRequested ? 0.6 : 1, fontFamily:"'Inter',sans-serif", transition:'all .15s' }}
                onMouseEnter={e => { if (!stopRequested) e.currentTarget.style.background='rgba(239, 68, 68, 0.1)' }}
                onMouseLeave={e => { if (!stopRequested) e.currentTarget.style.background='rgba(220, 38, 38, 0.05)' }}
              >
                <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"><rect x="4" y="4" width="16" height="16" rx="2"/></svg>
                {stopRequested ? 'Stopping…' : 'Stop'}
              </button>
            </div>
          )}
          {wizStep === 3 && statusState === 'complete' && (
            <button className="wiz-nav-btn next" onClick={() => goStep(4)}>
              Continue to Review
              <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"><polyline points="9 18 15 12 9 6"/></svg>
            </button>
          )}
        </div>
      </div>

      <ToastContainer toasts={toasts} />
    </div>
  )
}