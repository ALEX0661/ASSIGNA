import { useState, useEffect, useMemo, useCallback, useRef } from 'react'
import { createPortal } from 'react-dom'
import { useNavigate, useLocation } from 'react-router-dom'
import {
  getFaculty, getCourses,
  triggerSolve, cancelSolve,
  saveSchedule, listSaved, loadSaved, deleteSaved,
  getPreDiagnostic, getDiagnostic,
  getSchedulePhases,
} from '../../services/api'
import { useScheduleStore, useSolverStore } from '../../store/scheduleStore'
import ScheduleGeneratorLoader from './ScheduleGeneratorLoader'

/* ── Design tokens (Unified Green Theme — matches Dashboard / Faculty pages) ── */
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

/* ─────────────────────────── constants ─────────────────────────── */

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

const SEMESTER_OPTIONS = ['1st Semester', '2nd Semester', 'Midyear']

const RATING_LABELS = { 5: 'Expert', 4: 'Highly Proficient', 3: 'Competent', 2: 'Developing', 1: 'Beginner' }
const RATING_COLORS = { 5: 'var(--meadow-mid)', 4: '#0369A1', 3: G.meadow, 2: '#D97706', 1: '#DC2626' }
const RATING_BG     = { 5: 'var(--meadow-soft)', 4: '#E0F2FE', 3: G.meadowSoft, 2: '#FEF3C7', 1: '#FEE2E2' }

const OTHER_DEPT_PREFIXES = ['PE', 'NSTP', 'MAT', 'MATH', 'PATHFIT', 'GEC']
function isOtherDept(courseCode = '') {
  const upper = courseCode.toUpperCase().trim()
  return OTHER_DEPT_PREFIXES.some(p => upper.startsWith(p))
}

const STATUS_META = {
  no_faculty:  { label: 'No faculty',   color: '#DC2626', bg: '#FEE2E2', border: 'rgba(220, 38, 38, 0.25)' },
  low_quality: { label: 'Low quality',  color: '#D97706', bg: '#FEF3C7', border: '#FDE68A' },
  thin:        { label: 'Thin pool',    color: '#0369A1', bg: '#E0F2FE', border: '#BAE6FD' },
  ready:       { label: 'Ready',        color: G.meadowDeep, bg: G.meadowSoft, border: G.meadowBorder },
  other_dept:  { label: 'Ext. managed', color: G.muted, bg: G.hover, border: G.border },
}

const now = new Date();
const startYear = now.getMonth() < 5 ? now.getFullYear() - 1 : now.getFullYear();

// Academic year options for the Custom dropdown — 2 years back through 4 years ahead,
// always centred on the current academic year so it stays relevant automatically.
const AY_OPTIONS = Array.from({ length: 7 }, (_, i) => {
  const y = startYear - 1 + i
  return `${y}-${y + 1}`
})

const PRESET_NAMES = [
  `A.Y. ${startYear}-${startYear + 1}, 1st Semester`,
  `A.Y. ${startYear}-${startYear + 1}, 2nd Semester`,
  `A.Y. ${startYear}-${startYear + 1}, Midyear`,
  `A.Y. ${startYear + 1}-${startYear + 2}, 1st Semester`,
  `A.Y. ${startYear + 1}-${startYear + 2}, 2nd Semester`,
  `A.Y. ${startYear + 1}-${startYear + 2}, Midyear`,
  'Custom...'
]

const VERDICT_META = {
  feasible:        { color: G.meadowDeep, bg: G.meadowSoft, border: G.meadowBorder, label: 'Feasible',           icon: '✓' },
  likely_feasible: { color: '#0369A1',    bg: '#E0F2FE',    border: '#BAE6FD',      label: 'Likely Feasible',    icon: '~' },
  tight:           { color: '#D97706',    bg: '#FEF3C7',    border: '#FDE68A',      label: 'Feasible but Tight', icon: '⚠' },
  at_risk:         { color: '#DC2626',    bg: '#FEE2E2',    border: 'rgba(220, 38, 38, 0.25)',      label: 'At Risk',            icon: '!' },
  infeasible:      { color: '#991B1B',    bg: '#FEF2F2',    border: 'rgba(220, 38, 38, 0.25)',      label: 'Likely Infeasible',  icon: '✕' },
}
const CHECK_META = {
  pass: { color: G.meadowDeep, bg: G.meadowSoft, border: G.meadowBorder, dot: G.meadow,  label: 'Pass' },
  warn: { color: '#D97706',    bg: '#FFFBEB',    border: '#FDE68A',      dot: '#F59E0B', label: 'Warn' },
  fail: { color: '#DC2626',    bg: '#FEE2E2',    border: 'rgba(220, 38, 38, 0.25)',      dot: '#EF4444', label: 'Fail' },
}
const REC_META = {
  blocker:    { color: '#DC2626',    bg: '#FEE2E2',    border: 'rgba(220, 38, 38, 0.25)' },
  warning:    { color: '#D97706',    bg: '#FFFBEB',    border: '#FDE68A' },
  suggestion: { color: '#0369A1',    bg: '#E0F2FE',    border: '#BAE6FD' },
  success:    { color: G.meadowDeep, bg: G.meadowSoft, border: G.meadowBorder },
}

/* ─────────────────────────── styles ─────────────────────────── */

if (!document.getElementById('scheduler-page-style')) {
  const s = document.createElement('style')
  s.id = 'scheduler-page-style'
  s.textContent = `
    @import url('https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700;800&family=Poppins:wght@500;600;700&display=swap');

    .sch-root { display:flex; flex-direction:column; gap:0; padding:0; background:${G.bg}; min-height:100%; font-family:'Inter',sans-serif; overflow:hidden; }
    .sch-wizard-shell { display:flex; flex-direction:column; height:100%; overflow:hidden; }

    /* ── Wizard top bar (Slimmer Pill Stepper) ── */
    .wiz-topbar { display:flex; align-items:center; justify-content:center; padding:0; background:transparent; border:none; flex-shrink:0; z-index:10; }
    .wiz-steps { display:flex; align-items:center; gap:4px; position:relative; background: var(--surface); padding:6px 12px; border-radius:99px; border:1px solid ${G.border}; box-shadow:0 2px 8px rgba(0,0,0,0.04); }
    .wiz-step-node { display:flex; align-items:center; gap:6px; padding:4px 12px; border-radius:99px; transition:all .2s; cursor:pointer; }
    .wiz-step-node.active { background:${G.meadowSoft}; }
    .wiz-step-node.done { cursor:pointer; }
    .wiz-step-node.done:hover { background:${G.hover}; }
    .wiz-step-circle { width:20px; height:20px; border-radius:50%; display:flex; align-items:center; justify-content:center; font-size:10.5px; font-weight:800; flex-shrink:0; transition:all .2s; border:2px solid transparent; }
    .wiz-step-circle.done   { background:${G.meadow}; color:#fff; }
    .wiz-step-circle.active { background:${G.meadow}; color:#fff; border-color:${G.meadowBorder}; box-shadow:0 0 0 3px rgba(0,0,0,0.15); }
    .wiz-step-circle.todo   { background:${G.hover}; color:${G.muted2}; border-color:${G.border}; }
    .wiz-step-label { font-size:11.5px; font-weight:700; transition:color .2s; white-space:nowrap; }
    .wiz-step-label.active { color:${G.meadowDeep}; }
    .wiz-step-label.done   { color:${G.ink}; }
    .wiz-step-label.todo   { color:${G.muted}; }
    .wiz-step-div { width:16px; height:2px; background:${G.border}; border-radius:99px; flex-shrink:0; }
    .wiz-step-div.done { background:${G.meadowBorder}; }

    /* ── Wizard body (the sliding area) ── */
    .wiz-body { flex:1; overflow:hidden; position:relative; }
    .wiz-slide { position:absolute; inset:0; overflow-y:auto; padding:16px 28px 24px; display:flex; flex-direction:column; gap:14px; }
    .wiz-slide-enter  { animation:wizSlideIn .32s cubic-bezier(0.16,1,0.3,1) both; }
    .wiz-slide-back   { animation:wizSlideBack .32s cubic-bezier(0.16,1,0.3,1) both; }
    @keyframes wizSlideIn  { from { opacity:0; transform:translateX(48px) scale(0.98); } to { opacity:1; transform:translateX(0) scale(1); } }
    @keyframes wizSlideBack { from { opacity:0; transform:translateX(-48px) scale(0.98); } to { opacity:1; transform:translateX(0) scale(1); } }
    /* Step 3 running: no scroll, flex fill */
    .wiz-slide.no-scroll { overflow-y:hidden; }

    /* Panel body — the expandable content area inside CheckPanel and other cards */
    .panel-body { padding:16px 18px; display:flex; flex-direction:column; gap:0; }

    /* Card shell (consistent across panels) */
    .sch-card { background: var(--surface); border-radius:12px; border:1px solid ${G.border}; box-shadow:0 2px 12px rgba(0,0,0,0.03); overflow:hidden; }
    .sch-card-header { display:flex; align-items:center; gap:12px; padding:12px 18px; border-bottom:1px solid ${G.border}; }
    .sch-card-title { font-size:14px; font-weight:800; color:${G.ink}; margin:0; letter-spacing:-0.1px; }
    .sch-card-sub { font-size:11.5px; color:${G.muted}; margin-top:1px; font-weight:500; }
    .sch-card-body { padding:16px 18px; }

    /* Wizard bottom nav */
    .wiz-footer { position:sticky; bottom:0; display:flex; align-items:center; justify-content:space-between; padding:10px 28px; background:rgba(255,255,255,0.92); backdrop-filter:blur(12px); border-top:1px solid ${G.border}; z-index:40; flex-shrink:0; }
    .wiz-nav-btn { display:inline-flex; align-items:center; gap:8px; padding:11px 24px; border-radius:10px; font-family:'Inter',sans-serif; font-size:13.5px; font-weight:700; cursor:pointer; transition:all .18s; }
    .wiz-nav-btn.back { background: var(--surface); color:${G.muted}; border:1px solid ${G.border}; }
    .wiz-nav-btn.back:hover { background:${G.hover}; color:${G.ink}; border-color:${G.meadowBorder}; }
    .wiz-nav-btn.next { background:${G.meadow}; color:#fff; border:none; box-shadow:0 4px 14px rgba(0,0,0,0.2); }
    .wiz-nav-btn.next:hover { background:${G.meadowDeep}; transform:translateY(-1px); box-shadow:0 6px 20px rgba(0,0,0,0.3); }
    .wiz-nav-btn.next:disabled { opacity:.5; cursor:not-allowed; transform:none; box-shadow:none; }
    .wiz-nav-btn.solve-main { background:${G.meadow}; color:#fff; border:none; box-shadow:0 4px 20px rgba(0,0,0,0.3); padding:13px 32px; font-size:14.5px; }

    .sch-select { padding:9px 36px 9px 14px; border-radius:8px; border:1px solid ${G.border}; background: var(--surface); color:${G.ink}; font-size:13px; font-weight:600; font-family:'Inter',sans-serif; appearance:none; cursor:pointer; outline:none; transition:all .15s; background-image:url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='12' height='12' viewBox='0 0 24 24' fill='none' stroke='%234B7060' stroke-width='2.5'%3E%3Cpolyline points='6 9 12 15 18 9'/%3E%3C/svg%3E"); background-repeat:no-repeat; background-position:right 12px center; box-shadow:0 1px 3px rgba(0,0,0,0.02); }
    .sch-select:focus, .sch-input:focus { border-color:${G.meadow}; box-shadow:0 0 0 3px rgba(0,0,0,0.1); }

    .sch-input { padding:9px 14px; border-radius:8px; border:1px solid ${G.border}; background: var(--surface); color:${G.ink}; font-size:13px; font-weight:600; font-family:'Inter',sans-serif; outline:none; transition:all .15s; }
    .sch-input::placeholder { color:${G.muted2}; font-weight:500; }

    .saved-item { display:flex; align-items:center; gap:14px; padding:14px 18px; cursor:pointer; transition:background .15s, border-color .15s; border-bottom:1px solid ${G.borderLight}; background: var(--surface); }
    .saved-item:last-child { border-bottom:none; }
    .saved-item:hover { background:${G.hover}; border-bottom-color:${G.meadowBorder}; }
    .saved-item:hover .saved-name { color:${G.meadowDeep}; }
    .saved-item:hover .saved-chevron { color:${G.meadowDeep}; }
    .saved-name-block { flex:1; min-width:0; }
    .saved-name { font-size:13.5px; font-weight:700; color:${G.ink}; overflow:hidden; text-overflow:ellipsis; white-space:nowrap; display:block; transition:color .15s; }
    .saved-sub { font-size:11.5px; color:${G.muted}; font-weight:500; margin-top:2px; display:block; }
    .saved-actions { display:flex; gap:8px; margin-left:auto; flex-shrink:0; align-items:center; }
    .saved-load-btn { display:inline-flex; align-items:center; gap:6px; padding:7px 14px; border-radius:8px; font-size:12.5px; font-weight:700; cursor:pointer; font-family:'Inter',sans-serif; transition:all .15s; background:${G.meadowSoft}; color:${G.meadowDeep}; border:1px solid ${G.meadowBorder}; }
    .saved-load-btn:hover:not(:disabled) { background:${G.meadow}; color:#fff; border-color:${G.meadowDeep}; }
    .saved-load-btn:disabled { opacity:.5; cursor:not-allowed; }
    .saved-del-btn { width:32px; height:32px; display:inline-flex; align-items:center; justify-content:center; border-radius:8px; cursor:pointer; font-family:'Inter',sans-serif; transition:all .15s; background:#FEF2F2; color:#DC2626; border:1px solid #FECACA; flex-shrink:0; }
    .saved-del-btn:hover:not(:disabled) { background:#FEE2E2; border-color:#FCA5A5; }
    .saved-del-btn:disabled { opacity:.4; cursor:not-allowed; }
    .saved-chevron { color:${G.muted2}; transition:color .15s; flex-shrink:0; }
    .saved-current-badge { font-size:10px; font-weight:800; padding:2px 8px; border-radius:99px; background:${G.meadow}; color:#fff; letter-spacing:.3px; text-transform:uppercase; flex-shrink:0; }

    .r-tab { display:inline-flex; align-items:center; gap:5px; padding:8px 16px; border-radius:8px; font-family:'Inter',sans-serif; font-size:12.5px; font-weight:600; cursor:pointer; transition:all .15s; border:1px solid ${G.border}; background: var(--surface); color:${G.muted}; box-shadow:0 1px 2px rgba(0,0,0,0.02); }
    .r-tab.active { background:${G.meadow}; color:#fff; border-color:${G.meadowDeep}; box-shadow:0 3px 10px rgba(0,0,0,0.25); }
    .r-tab:hover:not(.active) { background:${G.hover}; border-color:${G.meadowBorder}; color:${G.ink}; }

    .r-stat { flex:1; display:flex; flex-direction:column; align-items:center; padding:10px 8px; border-radius:10px; border:1px solid; transition:transform .15s, box-shadow .15s; background: var(--surface); }
    .r-stat.clickable { cursor:pointer; }
    .r-stat.clickable:hover { transform:translateY(-2px); box-shadow:0 6px 16px rgba(0,0,0,0.06); }

    .course-row { border-bottom:1px solid ${G.borderLight}; transition:background .15s; cursor:pointer; background: var(--surface); }
    .course-row:hover { background:${G.hover}; }
    .course-row:last-child { border-bottom:none; }
    .course-row-main { display:flex; align-items:center; gap:12px; padding:10px 16px; }

    .star-fill  { fill:${G.meadow}; stroke:${G.meadow}; }
    .star-empty { fill:none; stroke:${G.border}; }

    /* Faculty pool modal */
    .fp-modal-backdrop { position:fixed; inset:0; background:rgba(14,42,32,0.6); display:flex; align-items:center; justify-content:center; z-index:600; backdrop-filter:blur(4px); padding:24px; animation:fadeIn 0.2s ease-out; }
    .fp-modal { background: var(--surface); border-radius:16px; width:100%; max-width:520px; max-height:85vh; display:flex; flex-direction:column; box-shadow:0 24px 48px rgba(0,0,0,0.25); border:1px solid ${G.border}; animation:slideUp .25s cubic-bezier(0.16, 1, 0.3, 1); overflow:hidden; }
    .fp-modal-head { padding:24px 28px 20px; border-bottom:1px solid ${G.border}; flex-shrink:0; background: var(--surface); }
    .fp-modal-body { overflow-y:auto; flex:1; padding:0 28px 24px; background:${G.bg}; }
    .fp-frow { display:flex; align-items:center; gap:14px; padding:14px 16px; border-bottom:1px solid ${G.borderLight}; background: var(--surface); border-radius:10px; margin-top:10px; border:1px solid ${G.border}; box-shadow:0 1px 2px rgba(0,0,0,0.02); }
    .fp-frow:last-child { border-bottom:1px solid ${G.border}; }
    .fp-avatar { width:36px; height:36px; border-radius:10px; display:flex; align-items:center; justify-content:center; font-size:12px; font-weight:700; flex-shrink:0; border:1px solid rgba(0,0,0,0.05); }
    .fp-ubar-wrap { flex:1; height:6px; background:${G.borderLight}; border-radius:99px; overflow:hidden; }
    .fp-ubar-fill { height:100%; border-radius:99px; transition:width .5s; }

    .wl-bar-wrap { flex:1; height:6px; background:${G.borderLight}; border-radius:99px; overflow:hidden; }
    .wl-bar-fill { height:100%; border-radius:99px; transition:width .5s; }

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
    .phase-chip.keyboard-grabbed .phase-chip-dot { border-color:${G.meadow} !important; box-shadow:0 0 0 4px rgba(0,0,0,0.18); }
    .phase-chip-dot {
      width:30px; height:30px; border-radius:50%; flex-shrink:0; display:flex; align-items:center; justify-content:center;
      font-size:11px; font-weight:800; background:${G.meadowSoft}; color:${G.meadowDeep}; border:2px solid ${G.meadowBorder};
      transition:all .15s; position:relative;
    }
    .phase-chip:hover .phase-chip-dot { background:${G.meadow}; color:#fff; border-color:${G.meadowDeep}; transform:scale(1.08); }
    .phase-chip-order {
      position:absolute; top:-5px; right:-5px; width:15px; height:15px; border-radius:50%; background: var(--surface);
      border:1.5px solid ${G.border}; color:${G.muted2}; font-size:8.5px; font-weight:800;
      display:flex; align-items:center; justify-content:center; transition:all .15s;
    }
    .phase-chip:hover .phase-chip-order { border-color:${G.meadowDeep}; color:${G.meadowDeep}; }
    .phase-chip-label { font-size:10.5px; font-weight:700; text-align:center; letter-spacing:0.4px; text-transform:uppercase; color:${G.ink}; line-height:1.3; max-width:100%; }
    .phase-chip-handle { display:flex; align-items:center; justify-content:center; color:${G.muted2}; opacity:0; transition:opacity .15s; margin-top:-2px; }
    .phase-chip:hover .phase-chip-handle, .phase-chip:focus-within .phase-chip-handle { opacity:1; }
    .phase-chip-arrows { display:flex; gap:3px; margin-top:2px; opacity:0; transition:opacity .15s; }
    .phase-chip:hover .phase-chip-arrows, .phase-chip:focus-within .phase-chip-arrows { opacity:1; }
    .phase-chip-arrow { width:18px; height:18px; padding:0; border-radius:5px; border:1px solid ${G.border}; background: var(--surface); display:flex; align-items:center; justify-content:center; cursor:pointer; color:${G.muted2}; transition:all .15s; }
    .phase-chip-arrow:hover:not(:disabled) { background:${G.meadowSoft}; border-color:${G.meadowBorder}; color:${G.meadowDeep}; }
    .phase-chip-arrow:disabled { opacity:0.25; cursor:default; }
    @media (max-width: 720px) {
      .phase-reorder-track { flex-wrap:wrap; row-gap:22px; }
      .phase-reorder-step { flex:0 0 25%; }
    }

    .prog-bar-wrap { height:6px; background:${G.borderLight}; border-radius:99px; overflow:hidden; margin-top:10px; box-shadow:inset 0 1px 2px rgba(0,0,0,0.05); width: 100%; }
    .prog-bar-fill { height:100%; border-radius:99px; transition:width .6s cubic-bezier(.4,0,.2,1); }

    .action-btn { display:inline-flex; align-items:center; justify-content:center; gap:8px; padding:10px 24px; border-radius:8px; font-family:'Inter',sans-serif; font-size:13px; font-weight:600; cursor:pointer; transition:all .2s; border:none; }
    .action-btn.solve { background:${G.meadow}; color:#fff; box-shadow:0 4px 12px rgba(0,0,0,0.2); }
    .action-btn.solve:hover:not(:disabled) { transform:translateY(-1px); box-shadow:0 6px 16px rgba(0,0,0,0.3); background:${G.meadowDeep}; }
    .action-btn.solve:disabled { opacity:0.5; cursor:not-allowed; transform:none; box-shadow:none; }
    .action-btn.save { background:${G.inkMid}; color:#fff; box-shadow:0 4px 12px rgba(0,0,0,0.2); }
    .action-btn.save:hover:not(:disabled) { transform:translateY(-1px); background:${G.ink}; box-shadow:0 6px 16px rgba(0,0,0,0.3); }
    .action-btn.save:disabled { opacity:0.5; cursor:not-allowed; }
    .action-btn.view { background: var(--surface); color:${G.ink}; border:1px solid ${G.border}; box-shadow:0 1px 3px rgba(0,0,0,0.02); }
    .action-btn.view:hover { background:${G.hover}; border-color:${G.meadowBorder}; color:${G.meadowDeep}; }

    .status-strip { display:flex; align-items:center; gap:12px; padding:14px 20px; border-radius:10px; font-size:13.5px; font-weight:600; font-family:'Inter', sans-serif; }
    .status-strip.running  { background:${G.meadowSoft}; color:${G.meadowDeep}; border:1px solid ${G.meadowBorder}; }
    .status-strip.complete { background:var(--meadow-soft); color:var(--meadow-deep); border:1px solid #A7F3D0; }
    .status-strip.failed   { background:#FEE2E2; color:#B91C1C; border:1px solid #FECACA; }

    /* Step 3 result block */
    .solve-result { border-radius:12px; overflow:hidden; border:1px solid; margin-top:14px; box-shadow: 0 4px 12px rgba(0,0,0,0.05); }
    .solve-result.complete { border-color:${G.meadowBorder}; }
    .solve-result.failed   { border-color:#FECACA; }
    .solve-result-body { display:flex; align-items:center; gap:16px; padding:24px 28px; }
    .solve-result-actions { display:flex; flex-wrap:wrap; gap:10px; padding:16px 28px; border-top:1px solid; background: var(--surface); justify-content:flex-end; }
    .solve-result.complete .solve-result-actions { border-color:${G.meadowBorder}; background:var(--bg); }
    .solve-result.failed   .solve-result-actions { border-color:#FECACA; background:#FEF2F2; }
    .solve-action-btn { display:inline-flex; align-items:center; gap:8px; padding:10px 20px; border-radius:9px; font-family:'Inter',sans-serif; font-size:13px; font-weight:700; cursor:pointer; transition:all .2s; }
    .solve-action-btn.primary { background:${G.meadow}; color:#fff; border:none; box-shadow:0 4px 12px rgba(0,0,0,0.2); }
    .solve-action-btn.primary:hover:not(:disabled) { transform:translateY(-1px); box-shadow:0 6px 16px rgba(0,0,0,0.3); background:${G.meadowDeep}; }
    .solve-action-btn.primary:disabled { opacity:.5; cursor:not-allowed; transform:none; box-shadow:none; }
    .solve-action-btn.ghost { background: var(--surface); color:${G.ink}; border:1px solid ${G.border}; }
    .solve-action-btn.ghost:hover { background:${G.bg}; border-color:${G.meadowBorder}; color:${G.meadowDeep}; }
    
    .check-btn { display:inline-flex; align-items:center; gap:8px; padding:9px 16px; border-radius:8px; border:1px solid ${G.border}; background: var(--surface); color:${G.ink}; font-family:'Inter',sans-serif; font-size:12.5px; font-weight:600; cursor:pointer; transition:all .15s; box-shadow:0 1px 2px rgba(0,0,0,0.02); white-space:nowrap; }
    .check-btn:hover:not(:disabled) { background:${G.hover}; color:${G.meadowDeep}; border-color:${G.meadowBorder}; }
    .check-btn:disabled { opacity:.6; cursor:not-allowed; }

    @keyframes pulseGlow { 0% { opacity: 0.3; transform: translate(-50%, -50%) scale(0.95); } 100% { opacity: 0.6; transform: translate(-50%, -50%) scale(1.05); } }
    @keyframes sch-spin { to { transform:rotate(360deg) } }
    @keyframes slideUp { from{opacity:0;transform:translateY(15px) scale(0.98)} to{opacity:1;transform:translateY(0) scale(1)} }
    @keyframes fadeIn { from{opacity:0} to{opacity:1} }
    @keyframes schShimmer { 0%{background-position:-800px 0} 100%{background-position:800px 0} }

    .spin   { animation:sch-spin 1s linear infinite; }
    .fadein { animation:fadeIn .25s cubic-bezier(0.2, 0.8, 0.2, 1) both; }

    /* Sub-tabs inside the Check card (Diagnostic / Faculty Pools / Workload) */
    .subtab-row { display:flex; gap:4px; padding:3px; background:${G.hover}; border-radius:9px; border:1px solid ${G.border}; }
    .subtab-btn { flex:1; display:flex; align-items:center; justify-content:center; gap:6px; padding:7px 12px; border-radius:7px; font-family:'Inter',sans-serif; font-size:12px; font-weight:700; cursor:pointer; transition:all .15s; border:none; background:transparent; color:${G.muted}; }
    .subtab-btn.active { background: var(--surface); color:${G.meadowDeep}; box-shadow:0 2px 6px rgba(0,0,0,0.08); }
    .subtab-btn:hover:not(.active) { color:${G.ink}; }
    .subtab-count { font-size:10.5px; font-weight:800; padding:1px 7px; border-radius:99; background:${G.borderLight}; color:${G.muted2}; }
    .subtab-btn.active .subtab-count { background:${G.meadowSoft}; color:${G.meadowDeep}; }

    .diag-check-row { display:flex; align-items:flex-start; gap:12px; padding:10px 0; border-bottom:1px solid ${G.borderLight}; }
    .diag-check-row:last-child { border-bottom:none; }
    .diag-rec { padding:12px 16px; border-radius:10px; display:flex; gap:12px; align-items:flex-start; border:1px solid transparent; transition:transform .15s; }
    .diag-rec:hover { transform:translateY(-1px); }
    @keyframes diag-bar { from { width:0 } }

    /* Toast Notifications — centered within main content area, not full viewport */
    .sch-toast-wrap { 
      position: fixed; 
      bottom: 24px; 
      left: 50%; 
      transform: translateX(-50%);
      /* Offset by sidebar width to center within main content */
      margin-left: 110px; /* Half of normal sidebar width (220px / 2) */
      z-index: 9999; 
      display: flex; 
      flex-direction: column; 
      gap: 10px; 
      align-items: center; 
      pointer-events: none; 
    }
    .sch-toast { display:flex; align-items:center; gap:10px; padding:14px 22px; border-radius:12px; font-family:'Inter',sans-serif; font-size:13.5px; font-weight:600; animation:slideUp .25s cubic-bezier(.4,0,.2,1); white-space:nowrap; pointer-events:auto; box-shadow:0 8px 24px rgba(0,0,0,0.15); }
    .sch-toast.success { background:${G.meadow}; color:#fff; border:1px solid ${G.meadowBorder}; }
    .sch-toast.error   { background: var(--surface); color:#DC2626; border:1px solid #FECACA; }
    .sch-toast.info    { background: var(--surface); color:${G.meadowDeep}; border:1px solid ${G.meadowBorder}; }

    /* Search */
    .sch-search { padding:9px 14px 9px 36px; border-radius:8px; border:1px solid ${G.border}; font-family:'Inter',sans-serif; font-size:13px; background: var(--surface); color:${G.ink}; outline:none; transition:all .15s; width:100%; box-sizing:border-box; box-shadow:0 1px 3px rgba(0,0,0,0.02); }
    .sch-search:focus { border-color:${G.meadow}; box-shadow:0 0 0 3px rgba(0,0,0,0.1); }

    /* Delete modal */
    .del-modal-backdrop { position:fixed; inset:0; background:rgba(14,42,32,0.6); display:flex; align-items:center; justify-content:center; z-index:500; backdrop-filter:blur(4px); }
    .del-modal-box { background: var(--surface); border-radius:16px; width:380px; padding:32px; box-shadow:0 24px 48px rgba(0,0,0,0.25); border:1px solid ${G.border}; animation:slideUp .25s cubic-bezier(0.16, 1, 0.3, 1); }

    /* Skeleton */
    .sch-skeleton { background:linear-gradient(90deg, ${G.hover} 25%, ${G.borderLight} 50%, ${G.hover} 75%); background-size:800px 100%; animation:schShimmer 1.4s ease-in-out infinite; border-radius:8px; }
  `
  document.head.appendChild(s)
}

/* ─────────────────────────── pure helpers ─────────────────────────── */

function Skel({ w = '100%', h = 14, r = 7, style = {} }) {
  return <div className="sch-skeleton" style={{ width: w, height: h, borderRadius: r, flexShrink: 0, ...style }} />
}

/* ─────────────────────────── error helpers ─────────────────────────── */

async function parseError(err, action) {
  let title   = `Failed to ${action}`
  let message = 'An unexpected error occurred. Please try again.'
  let code    = null

  if (err instanceof Response || err?.status) {
    code = err.status ?? null
    const causeMap = {
      400: `Failed to ${action} — invalid request`,
      401: `Failed to ${action} — not authenticated`,
      403: `Failed to ${action} — access denied`,
      404: `Failed to ${action} — endpoint not found`,
      408: `Failed to ${action} — request timed out`,
      409: `Failed to ${action} — data conflict`,
      422: `Failed to ${action} — validation error`,
      429: `Failed to ${action} — too many requests`,
      500: `Failed to ${action} — backend error`,
      502: `Failed to ${action} — bad gateway`,
      503: `Failed to ${action} — server unavailable`,
      504: `Failed to ${action} — gateway timeout`,
    }
    title = causeMap[code] ?? `Failed to ${action} — server error (${code})`
    const detailMap = {
      400: 'The request was rejected as invalid. Check your inputs and try again.',
      401: 'Your session may have expired. Please refresh the page and log in again.',
      403: 'You don\'t have the required permissions to perform this action.',
      404: 'The server endpoint could not be found. The API may have changed.',
      408: 'The server took too long to respond. Check your connection and retry.',
      409: 'This change conflicts with existing data on the server.',
      422: 'Some fields failed validation. Double-check the values you entered.',
      429: 'Too many requests sent in a short time. Wait a moment and try again.',
      500: 'The server ran into an internal error. Try again shortly.',
      502: 'The server gateway is currently misbehaving. Try again shortly.',
      503: 'The service is temporarily unavailable. Try again shortly.',
      504: 'The server took too long to respond. Try again shortly.',
    }
    message = detailMap[code] ?? message
    try {
      const data = err?.response?.data ?? (err.json ? await err.json() : null)
      if (data?.detail) message = data.detail
    } catch { /* ignore */ }
    if (err?.response?.data?.detail) message = err.response.data.detail
  } else if (err instanceof TypeError && err.message.includes('fetch')) {
    title   = `Failed to ${action} — no connection`
    message = 'Could not reach the server. Check your internet connection and try again.'
  } else if (err instanceof Error && err.message) {
    title   = `Failed to ${action} — unexpected error`
    message = err.message
  }

  return { title, message, code }
}

function ErrorBanner({ error, onDismiss }) {
  if (!error) return null
  return (
    <div className="fadein" style={{
      display: 'flex', alignItems: 'flex-start', gap: 12,
      padding: '14px 16px', borderRadius: 10,
      background: '#FEF2F2', border: '1px solid #FECACA',
    }}>
      <div style={{
        width: 32, height: 32, borderRadius: 8, background: '#FEE2E2',
        display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0,
      }}>
        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="#DC2626" strokeWidth="2.5">
          <circle cx="12" cy="12" r="10"/>
          <line x1="12" y1="8" x2="12" y2="12"/><line x1="12" y1="16" x2="12.01" y2="16"/>
        </svg>
      </div>
      <div style={{ flex: 1, minWidth: 0 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 4 }}>
          <span style={{ fontSize: 13.5, fontWeight: 700, color: '#991B1B' }}>{error.title}</span>
          {error.code && (
            <span style={{ fontSize: 11, fontWeight: 700, padding: '2px 8px', borderRadius: 20, background: '#FEE2E2', color: '#DC2626', border: '1px solid #FECACA' }}>
              {error.code}
            </span>
          )}
        </div>
        <div style={{ fontSize: 12.5, color: '#B91C1C', lineHeight: 1.5 }}>{error.message}</div>
      </div>
      {onDismiss && (
        <button onClick={onDismiss} style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#FCA5A5', padding: 4, lineHeight: 0, borderRadius: 6, flexShrink: 0 }}
          onMouseEnter={e => e.currentTarget.style.color = '#DC2626'}
          onMouseLeave={e => e.currentTarget.style.color = '#FCA5A5'}
          title="Dismiss"
        >
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
            <line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/>
          </svg>
        </button>
      )}
    </div>
  )
}

function buildReadinessReport(courses, facultyList) {
  const poolMap = {}
  for (const f of facultyList) {
    for (const spec of (f.specializations || [])) {
      const code = (spec.courseCode || '').trim().toUpperCase()
      if (!code) continue
      if (!poolMap[code]) poolMap[code] = []
      poolMap[code].push({ name: f.name || 'Unknown', rating: spec.rating || 1, units: f.units || 0, max_units: f.max_units || 21 })
    }
  }

  const seen = new Map()
  for (const c of courses) {
    const key = (c.courseCode || '').trim().toUpperCase()
    if (key && !seen.has(key)) seen.set(key, c)
  }

  return [...seen.values()].map(c => {
    const code           = (c.courseCode || '').trim().toUpperCase()
    const otherDept      = isOtherDept(code)
    const pool           = (poolMap[code] || []).sort((a, b) => b.rating - a.rating)
    const poolSize       = pool.length
    const bestRating     = poolSize > 0 ? pool[0].rating : 0
    const qualifiedPool  = pool.filter(f => f.rating >= 3)
    const qualifiedCount = qualifiedPool.length
    const availablePool  = qualifiedPool.filter(f => f.units < f.max_units)
    const availableCount = availablePool.length

    const ratingDist = {}
    for (const f of pool) ratingDist[f.rating] = (ratingDist[f.rating] || 0) + 1

    const status = otherDept
      ? 'other_dept'
      : poolSize === 0  ? 'no_faculty'
      : bestRating <= 2 ? 'low_quality'
      : qualifiedCount <= 1 ? 'thin'
      : 'ready'

    return { courseCode: c.courseCode, title: c.title, program: c.program, yearLevel: c.yearLevel,
             pool, poolSize, bestRating, qualifiedCount, availableCount, status, otherDept, ratingDist }
  })
}

function buildWorkloadReport(facultyList) {
  return facultyList
    .map(f => ({
      name: f.name || 'Unknown', units: f.units || 0, max_units: f.max_units || 21,
      pct: Math.min(100, Math.round(((f.units || 0) / (f.max_units || 21)) * 100)),
      status: (f.units || 0) >= (f.max_units || 21) ? 'full' : (f.units || 0) >= (f.max_units || 21) * 0.8 ? 'near' : 'ok',
    }))
    .sort((a, b) => b.pct - a.pct)
}

/* ─────────────────────────── Toast system ─────────────────────────── */

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
    success: <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"><polyline points="20 6 9 17 4 12"/></svg>,
    error:   <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"><circle cx="12" cy="12" r="10"/><line x1="12" y1="8" x2="12" y2="12"/></svg>,
    info:    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"><circle cx="12" cy="12" r="10"/><path d="M12 8v4"/></svg>,
  }
  return (
    <div className="sch-toast-wrap">
      {toasts.map(t => (
        <div key={t.id} className={`sch-toast ${t.type}`}>
          {icons[t.type]}
          {t.message}
        </div>
      ))}
    </div>
  )
}

/* ─────────────────────────── Delete confirm modal ─────────────────────────── */

function DeleteModal({ name, onConfirm, onCancel }) {
  return (
    <div className="del-modal-backdrop" onClick={onCancel}>
      <div className="del-modal-box" onClick={e => e.stopPropagation()}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 16, marginBottom: 24 }}>
          <div style={{ width: 48, height: 48, borderRadius: 12, background: '#FEE2E2', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0, border: '1px solid #FECACA' }}>
            <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="#DC2626" strokeWidth="2.5">
              <polyline points="3 6 5 6 21 6"/><path d="M19 6l-1 14H6L5 6"/><path d="M10 11v6"/><path d="M14 11v6"/>
            </svg>
          </div>
          <div>
            <p style={{ fontSize: 18, fontWeight: 800, color: G.ink, margin: 0 }}>Delete schedule?</p>
            <p style={{ fontSize: 13.5, color: G.muted, marginTop: 4 }}>This action cannot be undone.</p>
          </div>
        </div>
        <div style={{ background: G.bg, borderRadius: 10, padding: '14px 16px', marginBottom: 24, border:`1px solid ${G.border}` }}>
          <p style={{ fontSize: 14, color: G.ink, fontWeight: 700, margin: 0, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>"{name}"</p>
        </div>
        <div style={{ display: 'flex', gap: 12, justifyContent: 'flex-end' }}>
          <button onClick={onCancel} style={{ padding: '10px 20px', borderRadius: 8, border: `1px solid ${G.border}`, background: 'var(--surface)', color: G.muted, fontSize: 13.5, fontWeight: 600, cursor: 'pointer', fontFamily: "'Inter',sans-serif", transition: 'all .15s' }}
            onMouseOver={e => {e.currentTarget.style.background = G.hover; e.currentTarget.style.color = G.ink}}
            onMouseOut={e => {e.currentTarget.style.background = 'var(--surface)'; e.currentTarget.style.color = G.muted}}>
            Cancel
          </button>
          <button onClick={onConfirm} style={{ padding: '10px 20px', borderRadius: 8, border: 'none', background: '#DC2626', color: '#fff', fontSize: 13.5, fontWeight: 600, cursor: 'pointer', fontFamily: "'Inter',sans-serif", boxShadow: '0 4px 12px rgba(220,38,38,0.25)', transition: 'all .15s' }}
            onMouseOver={e => {e.currentTarget.style.background = '#B91C1C'; e.currentTarget.style.transform = 'translateY(-1px)'}}
            onMouseOut={e => {e.currentTarget.style.background = '#DC2626'; e.currentTarget.style.transform = 'none'}}>
            Yes, Delete
          </button>
        </div>
      </div>
    </div>
  )
}

/* ─────────────────────────── Overwrite confirm modal ───────────────────────── */

function OverwriteModal({ name, onOverwrite, onRename, onCancel }) {
  const [newName, setNewName] = useState(name + ' (2)')
  const [mode, setMode]       = useState('choice') // 'choice' | 'rename'

  return (
    <div className="del-modal-backdrop" onClick={onCancel}>
      <div className="del-modal-box" onClick={e => e.stopPropagation()}>

        {mode === 'choice' ? (
          <>
            <div style={{ display:'flex', alignItems:'center', gap:16, marginBottom:22 }}>
              <div style={{ width:48, height:48, borderRadius:12, background:'#FEF3C7', display:'flex', alignItems:'center', justifyContent:'center', flexShrink:0, border:'1px solid #FDE68A' }}>
                <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="#D97706" strokeWidth="2.5">
                  <path d="M10.29 3.86L1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z"/>
                  <line x1="12" y1="9" x2="12" y2="13"/><line x1="12" y1="17" x2="12.01" y2="17"/>
                </svg>
              </div>
              <div>
                <p style={{ fontSize:17, fontWeight:800, color:G.ink, margin:0 }}>Name already exists</p>
                <p style={{ fontSize:13, color:G.muted, marginTop:4 }}>A schedule named <strong style={{ color:G.ink }}>"{name}"</strong> already exists.</p>
              </div>
            </div>

            <div style={{ display:'flex', flexDirection:'column', gap:10, marginBottom:24 }}>
              <button
                onClick={onOverwrite}
                style={{ display:'flex', alignItems:'center', gap:14, padding:'14px 16px', borderRadius:10, border:`1.5px solid #FECACA`, background:'rgba(220, 38, 38, 0.05)', cursor:'pointer', fontFamily:"'Inter',sans-serif", textAlign:'left', transition:'all .15s' }}
                onMouseEnter={e => { e.currentTarget.style.borderColor='#FCA5A5'; e.currentTarget.style.background='#FEE2E2' }}
                onMouseLeave={e => { e.currentTarget.style.borderColor='rgba(220, 38, 38, 0.25)'; e.currentTarget.style.background='rgba(220, 38, 38, 0.05)' }}
              >
                <div style={{ width:36, height:36, borderRadius:9, background:'#FEE2E2', display:'flex', alignItems:'center', justifyContent:'center', flexShrink:0 }}>
                  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="#DC2626" strokeWidth="2.5"><path d="M19 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h11l5 5v11a2 2 0 0 1-2 2z"/><polyline points="17 21 17 13 7 13 7 21"/></svg>
                </div>
                <div>
                  <div style={{ fontSize:13.5, fontWeight:700, color:'#DC2626' }}>Overwrite</div>
                  <div style={{ fontSize:12, color:G.muted, marginTop:1 }}>Replace the existing schedule — this cannot be undone.</div>
                </div>
              </button>

              <button
                onClick={() => setMode('rename')}
                style={{ display:'flex', alignItems:'center', gap:14, padding:'14px 16px', borderRadius:10, border:`1.5px solid ${G.meadowBorder}`, background:G.meadowSoft, cursor:'pointer', fontFamily:"'Inter',sans-serif", textAlign:'left', transition:'all .15s' }}
                onMouseEnter={e => { e.currentTarget.style.borderColor=G.meadow; e.currentTarget.style.background='var(--meadow-border)' }}
                onMouseLeave={e => { e.currentTarget.style.borderColor=G.meadowBorder; e.currentTarget.style.background=G.meadowSoft }}
              >
                <div style={{ width:36, height:36, borderRadius:9, background:'var(--meadow-border)', display:'flex', alignItems:'center', justifyContent:'center', flexShrink:0 }}>
                  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke={G.meadowDeep} strokeWidth="2.5"><path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"/><path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"/></svg>
                </div>
                <div>
                  <div style={{ fontSize:13.5, fontWeight:700, color:G.meadowDeep }}>Save with a new name</div>
                  <div style={{ fontSize:12, color:G.muted, marginTop:1 }}>Keep the existing schedule and save this one separately.</div>
                </div>
              </button>
            </div>

            <div style={{ display:'flex', justifyContent:'flex-end' }}>
              <button onClick={onCancel}
                style={{ padding:'9px 20px', borderRadius:8, border:`1px solid ${G.border}`, background: 'var(--surface)', color:G.muted, fontSize:13, fontWeight:600, cursor:'pointer', fontFamily:"'Inter',sans-serif" }}>
                Cancel
              </button>
            </div>
          </>
        ) : (
          <>
            <div style={{ display:'flex', alignItems:'center', gap:12, marginBottom:20 }}>
              <button onClick={() => setMode('choice')} style={{ background:'none', border:'none', cursor:'pointer', color:G.muted, display:'flex', padding:4, borderRadius:6 }}>
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"><polyline points="15 18 9 12 15 6"/></svg>
              </button>
              <p style={{ fontSize:16, fontWeight:800, color:G.ink, margin:0 }}>Save with new name</p>
            </div>

            <label style={{ fontSize:11.5, fontWeight:700, color:G.muted2, textTransform:'uppercase', letterSpacing:'.6px', display:'block', marginBottom:7 }}>
              Schedule Name
            </label>
            <input
              autoFocus
              value={newName}
              onChange={e => setNewName(e.target.value)}
              onKeyDown={e => e.key === 'Enter' && newName.trim() && onRename(newName.trim())}
              style={{ width:'100%', padding:'10px 13px', borderRadius:9, border:`1.5px solid ${G.border}`, fontSize:13.5, fontFamily:"'Inter',sans-serif", outline:'none', boxSizing:'border-box', marginBottom:20, transition:'border-color .15s' }}
              onFocus={e => e.target.style.borderColor = G.meadow}
              onBlur={e => e.target.style.borderColor = G.border}
            />

            <div style={{ display:'flex', gap:10, justifyContent:'flex-end' }}>
              <button onClick={onCancel}
                style={{ padding:'9px 20px', borderRadius:8, border:`1px solid ${G.border}`, background: 'var(--surface)', color:G.muted, fontSize:13, fontWeight:600, cursor:'pointer', fontFamily:"'Inter',sans-serif" }}>
                Cancel
              </button>
              <button onClick={() => newName.trim() && onRename(newName.trim())} disabled={!newName.trim()}
                style={{ padding:'9px 22px', borderRadius:8, border:'none', background:G.meadow, color:'#fff', fontSize:13, fontWeight:700, cursor:'pointer', fontFamily:"'Inter',sans-serif", boxShadow:`0 3px 12px rgba(0,0,0,.25)`, opacity: newName.trim() ? 1 : 0.5 }}>
                Save
              </button>
            </div>
          </>
        )}
      </div>
    </div>
  )
}

function MiniStars({ rating, size = 12 }) {
  return (
    <span style={{ display:'inline-flex', gap:2 }}>
      {[1,2,3,4,5].map(s => (
        <svg key={s} width={size} height={size} viewBox="0 0 24 24" strokeWidth="2.5" className={s <= rating ? 'star-fill' : 'star-empty'}>
          <polygon points="12 2 15.09 8.26 22 9.27 17 14.14 18.18 21.02 12 17.77 5.82 21.02 7 14.14 2 9.27 8.91 8.26 12 2"/>
        </svg>
      ))}
    </span>
  )
}

function FacultyPoolModal({ item, onClose }) {
  if (!item) return null
  const meta = STATUS_META[item.status]
  const qualified   = item.pool.filter(f => f.rating >= 3)
  const unqualified = item.pool.filter(f => f.rating < 3)

  const mkIni = name => (name || '').split(/\s+/).filter(Boolean).map(n => n[0]).join('').slice(0, 2).toUpperCase()

  return (
    <div className="fp-modal-backdrop" onClick={onClose}>
      <div className="fp-modal" onClick={e => e.stopPropagation()}>
        <div className="fp-modal-head">
          <div style={{ display:'flex', alignItems:'flex-start', justifyContent:'space-between', gap:14 }}>
            <div style={{ flex:1, minWidth:0 }}>
              <div style={{ display:'flex', alignItems:'center', gap:10, flexWrap:'wrap', marginBottom:8 }}>
                <span style={{ fontFamily:'monospace', fontSize:15, fontWeight:800, color:G.ink }}>{item.courseCode}</span>
                <span style={{ fontSize:11.5, fontWeight:700, padding:'3px 10px', borderRadius:99, background:meta.bg, color:meta.color, border:`1px solid ${meta.border}`, flexShrink:0 }}>{meta.label}</span>
              </div>
              <p style={{ fontSize:16, fontWeight:600, color:G.ink, marginBottom:16, lineHeight:1.4 }}>{item.title || '—'}</p>
              <div style={{ display:'flex', gap:24 }}>
                {[
                  { val: item.poolSize,       label: 'in pool',          c: G.inkMid },
                  { val: item.qualifiedCount,  label: 'qualified (≥ 3)',  c: G.meadow },
                  { val: item.availableCount,  label: 'available',        c: '#0369A1' },
                ].map(s => (
                  <div key={s.label}>
                    <span style={{ fontSize:22, fontWeight:800, color:s.c, lineHeight:1 }}>{s.val}</span>
                    <span style={{ fontSize:12, color:G.muted, marginLeft:6, fontWeight:600 }}>{s.label}</span>
                  </div>
                ))}
              </div>
            </div>
            <button onClick={onClose} style={{ width:36, height:36, borderRadius:10, border:`1px solid ${G.border}`, background: 'var(--surface)', cursor:'pointer', display:'flex', alignItems:'center', justifyContent:'center', fontSize:20, flexShrink:0, lineHeight:0, transition:'all .15s' }}
              onMouseOver={e => {e.currentTarget.style.background = '#FEE2E2'; e.currentTarget.style.borderColor = 'rgba(220, 38, 38, 0.25)'}}
              onMouseOut={e => {e.currentTarget.style.background = 'var(--surface)'; e.currentTarget.style.borderColor = G.border}}>
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="var(--muted)" strokeWidth="2.5"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg>
            </button>
          </div>
        </div>

        <div className="fp-modal-body">
          {item.pool.length === 0 ? (
            <div style={{ textAlign:'center', padding:'40px 0', color:G.muted, fontSize:14, fontWeight: 500 }}>No faculty assigned to this course yet.</div>
          ) : (
            <>
              {qualified.length > 0 && (
                <div style={{ marginTop:24 }}>
                  <p style={{ fontSize:11.5, fontWeight:800, color:G.muted2, textTransform:'uppercase', letterSpacing:'.8px', marginBottom:12 }}>Qualified faculty — eligible for assignment</p>
                  {qualified.map((f, i) => {
                    const isFull = f.units >= f.max_units
                    const pct    = Math.min(100, Math.round((f.units / f.max_units) * 100))
                    const barCol = isFull ? '#DC2626' : pct > 80 ? '#D97706' : G.meadow
                    return (
                      <div key={i} className="fp-frow" style={{ opacity: isFull ? 0.6 : 1 }}>
                        <div className="fp-avatar" style={{ background:RATING_BG[f.rating], color:RATING_COLORS[f.rating] }}>{mkIni(f.name)}</div>
                        <div style={{ flex:1, minWidth:0 }}>
                          <div style={{ display:'flex', alignItems:'center', justifyContent:'space-between', marginBottom:8 }}>
                            <span style={{ fontSize:13.5, fontWeight:700, color:G.ink, overflow:'hidden', textOverflow:'ellipsis', whiteSpace:'nowrap' }}>{f.name}</span>
                            <div style={{ display:'flex', alignItems:'center', gap:10, flexShrink:0, marginLeft:8 }}>
                              {isFull && <span style={{ fontSize:10.5, fontWeight:800, padding:'2px 8px', borderRadius:99, background:'#FEE2E2', color:'#DC2626', border: '1px solid #FECACA' }}>At cap</span>}
                              <span style={{ fontSize:11.5, fontWeight:700, padding:'3px 10px', borderRadius:99, background:RATING_BG[f.rating], color:RATING_COLORS[f.rating], border: `1px solid ${RATING_COLORS[f.rating]}30` }}>{RATING_LABELS[f.rating]}</span>
                              <MiniStars rating={f.rating} size={12} />
                            </div>
                          </div>
                          <div style={{ display:'flex', alignItems:'center', gap:12 }}>
                            <div className="fp-ubar-wrap"><div className="fp-ubar-fill" style={{ width:`${pct}%`, background:barCol }} /></div>
                            <span style={{ fontSize:11.5, fontWeight:700, color:barCol, whiteSpace:'nowrap' }}>{f.units}/{f.max_units} units</span>
                          </div>
                        </div>
                      </div>
                    )
                  })}
                </div>
              )}

              {unqualified.length > 0 && (
                <div style={{ marginTop:28 }}>
                  <p style={{ fontSize:11.5, fontWeight:800, color:G.muted2, textTransform:'uppercase', letterSpacing:'.8px', marginBottom:12 }}>Below threshold — not eligible</p>
                  {unqualified.map((f, i) => (
                    <div key={i} className="fp-frow" style={{ opacity:0.6, background: G.hover, borderColor: G.borderLight, boxShadow: 'none' }}>
                      <div className="fp-avatar" style={{ background: 'var(--surface)', color:G.muted2, border: `1px solid ${G.border}` }}>{mkIni(f.name)}</div>
                      <div style={{ flex:1, minWidth:0 }}>
                        <div style={{ display:'flex', alignItems:'center', justifyContent:'space-between' }}>
                          <span style={{ fontSize:13.5, fontWeight:600, color:G.muted, overflow:'hidden', textOverflow:'ellipsis', whiteSpace:'nowrap' }}>{f.name}</span>
                          <span style={{ fontSize:11.5, fontWeight:700, padding:'3px 10px', borderRadius:99, background: 'var(--surface)', color:G.muted2, flexShrink:0, marginLeft:8, border: `1px solid ${G.border}` }}>{RATING_LABELS[f.rating]}</span>
                        </div>
                      </div>
                    </div>
                  ))}
                  <p style={{ fontSize:12, color:G.muted, marginTop:16, lineHeight:1.5, background:G.bg, padding:'12px 16px', borderRadius:10, border: `1px dashed ${G.border}` }}>
                    Faculty need a rating of Competent (3) or above to be auto-scheduled. They can still be manually assigned later.
                  </p>
                </div>
              )}
            </>
          )}
        </div>
      </div>
    </div>
  )
}

function CourseRow({ item, onOpenModal }) {
  const meta = STATUS_META[item.status]

  const canOpen = item.poolSize > 0 && !item.otherDept
  const total = item.poolSize || 1
  const ratingSegs = [5,4,3,2,1].filter(r => item.ratingDist?.[r])

  return (
    <div className="course-row">
      <div className="course-row-main"
        onClick={() => canOpen && onOpenModal(item)}
        style={{ cursor: canOpen ? 'pointer' : 'default' }}>

        <div style={{ width:10, height:10, borderRadius:'50%', flexShrink:0, background:meta.color, boxShadow:`0 0 0 2px ${meta.bg}` }} />

        <div style={{ flex:1, minWidth:0 }}>
          <div style={{ display:'flex', alignItems:'center', gap:10, marginBottom:6 }}>
            <span style={{ fontSize:14, fontWeight:800, color:G.ink, fontFamily:'monospace' }}>{item.courseCode}</span>
            {item.otherDept && <span style={{ fontSize:10.5, fontWeight:700, padding:'2px 8px', borderRadius:99, background:G.hover, color:G.muted2, border: `1px solid ${G.border}` }}>Ext. dept</span>}
          </div>
          <span style={{ fontSize:13, color:G.muted, overflow:'hidden', textOverflow:'ellipsis', whiteSpace:'nowrap', display:'block', fontWeight:500 }}>{item.title || '—'}</span>
        </div>

        {!item.otherDept && (
          <div style={{ display:'flex', flexDirection:'column', alignItems:'flex-end', gap:8, flexShrink:0, width:100 }}>
            <div style={{ display:'flex', height:6, borderRadius:99, overflow:'hidden', gap:2, width:'100%', background: G.borderLight }}>
              {ratingSegs.length === 0
                ? <div style={{ flex:1, background:G.borderLight, borderRadius:99 }} />
                : ratingSegs.map(r => (
                    <div key={r} style={{ flex: item.ratingDist[r] / total, background: r >= 3 ? RATING_COLORS[r] : '#E5E7EB', borderRadius:99 }}
                      title={`${item.ratingDist[r]}× ${RATING_LABELS[r]}`} />
                  ))
              }
            </div>
            <span style={{ fontSize:11.5, fontWeight:600, color:G.muted2, whiteSpace:'nowrap' }}>
              {item.qualifiedCount}/{item.poolSize} qual.
            </span>
          </div>
        )}

        <div style={{ width:110, display:'flex', justifyContent:'flex-end', flexShrink:0 }}>
          <span style={{ fontSize:11.5, fontWeight:700, padding:'5px 12px', borderRadius:99, whiteSpace:'nowrap', background:meta.bg, color:meta.color, border:`1px solid ${meta.border}` }}>{meta.label}</span>
        </div>

        <div style={{ width:18, display:'flex', justifyContent:'flex-end', flexShrink:0 }}>
          {canOpen && (
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke={G.muted2} strokeWidth="2.5">
              <polyline points="9 18 15 12 9 6"/>
            </svg>
          )}
        </div>
      </div>
    </div>
  )
}

function WorkloadRow({ f }) {
  const barColor = f.status === 'full' ? '#DC2626' : f.status === 'near' ? '#D97706' : G.meadow
  return (
    <div style={{ display:'flex', alignItems:'center', gap:14, padding:'12px 0', borderBottom:`1px solid ${G.borderLight}` }}>
      <div style={{ width:32, height:32, borderRadius:'50%', flexShrink:0, display:'flex', alignItems:'center', justifyContent:'center', fontSize:11, fontWeight:700,
        background: f.status === 'full' ? '#FEE2E2' : f.status === 'near' ? '#FEF3C7' : G.meadowSoft, color: barColor, border: `1px solid ${f.status === 'full' ? 'rgba(220, 38, 38, 0.25)' : f.status === 'near' ? '#FDE68A' : G.meadowBorder}` }}>
        {f.name.split(' ').map(n => n[0]).join('').slice(0,2).toUpperCase()}
      </div>
      <span style={{ fontSize:13.5, fontWeight:600, color:G.ink, flex:1, overflow:'hidden', textOverflow:'ellipsis', whiteSpace:'nowrap', minWidth:0 }}>{f.name}</span>
      <div className="wl-bar-wrap" style={{ maxWidth:100, height: 8 }}><div className="wl-bar-fill" style={{ width:`${f.pct}%`, background:barColor }} /></div>
      <span style={{ fontSize:13, fontWeight:700, color:barColor, whiteSpace:'nowrap', minWidth:46, textAlign:'right' }}>{f.units}/{f.max_units}</span>
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
              style={{ background:'none', border:'none', padding:0, fontSize:11.5, fontWeight:700, color: isDefaultOrder ? G.muted2 : G.meadowDeep, cursor: isDefaultOrder ? 'default' : 'pointer', opacity: isDefaultOrder ? 0.5 : 1 }}>
              Reset to Default
            </button>
          )}
          <span style={{ fontSize:14, fontWeight:800, color: idle ? G.muted2 : done ? G.meadow : G.meadowDeep }}>{idle ? '—' : `${progress}%`}</span>
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
                <div className="phase-dot" style={{ background: idle ? G.hover : phaseDone ? G.meadow : phaseActive ? '#fff' : G.bg, border: idle ? `2px solid ${G.border}` : phaseActive ? `2.5px solid ${G.meadowDeep}` : phaseDone ? 'none' : `2px solid ${G.border}`, boxShadow: phaseActive ? `0 0 0 4px rgba(0,0,0,0.15)` : 'none' }}>
                  {phaseDone && !idle ? <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="#fff" strokeWidth="3"><polyline points="20 6 9 17 4 12"/></svg>
                    : phaseActive ? <div style={{ width:10, height:10, borderRadius:'50%', background:G.meadowDeep }} /> : null}
                </div>
                <span className="phase-label" style={{ color: idle ? G.muted2 : phaseDone ? G.meadow : phaseActive ? G.ink : G.muted2 }}>{ph.short}</span>
              </div>
            )
          })}
        </div>
      )}
    </div>
  )
}

/* Drag-and-drop (+ keyboard) reorderable list of scheduling phases.
   - Mouse/touch: grab the handle and drag; a live insertion line previews
     where the phase will land, and the list reorders as you pass over rows.
   - Keyboard: focus the handle, press Enter/Space to "pick up" the row,
     Arrow Up/Down to move it, Enter/Space again (or Escape) to drop it. */
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

function SavedItem({ name, academicYear, semester, finalized, onLoad, onDelete, loading, isCurrent }) {
  // Subtitle comes from the schedule's actual stored metadata (academicYear /
  // semester), not from parsing an "A.Y. XXXX-XXXX, ..." prefix out of the
  // name. That parsing approach silently dropped the subtitle for any
  // schedule saved under a raw name (e.g. "test1") that never had the A.Y.
  // baked into it, even though the metadata existed in Firestore all along.
  const subLine = [
    academicYear ? `A.Y. ${academicYear}` : null,
    semester || null,
  ].filter(Boolean).join(' • ') || null

  return (
    <div className="saved-item fadein" onClick={() => onLoad(name)}>
      <div className="saved-name-block">
        <div style={{ display:'flex', alignItems:'center', gap:8, marginBottom: subLine ? 2 : 0 }}>
          <span className="saved-name">{name}</span>
          {isCurrent && <span className="saved-current-badge">Active</span>}
          {finalized && (
            <span style={{ display:'inline-flex', alignItems:'center', gap:3, padding:'1px 7px', borderRadius:99, fontSize:9.5, fontWeight:700, background:'var(--meadow-soft)', color: 'var(--meadow)', border:'1px solid var(--meadow-border)', flexShrink:0 }}>
              <svg width="9" height="9" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3"><polyline points="20 6 9 17 4 12"/></svg>
              Finalized
            </span>
          )}
        </div>
        {subLine && <span className="saved-sub">{subLine}</span>}
      </div>
      <div className="saved-actions">
        <button
          onClick={(e) => { e.stopPropagation(); onDelete(name); }}
          disabled={loading}
          title="Delete schedule"
          style={{ width:30, height:30, borderRadius:8, border:'1.5px solid #FFD0D0', background:'rgba(220, 38, 38, 0.1)', color:'#C0392B', display:'inline-flex', alignItems:'center', justifyContent:'center', cursor:'pointer', padding:0, flexShrink:0, transition:'background .15s, color .15s', opacity: loading ? 0.4 : 1 }}
          onMouseEnter={e => { e.currentTarget.style.background='#C0392B'; e.currentTarget.style.color='#fff' }}
          onMouseLeave={e => { e.currentTarget.style.background='rgba(220, 38, 38, 0.1)'; e.currentTarget.style.color='#C0392B' }}
        >
          <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
            <polyline points="3 6 5 6 21 6"/>
            <path d="M19 6l-1 14a2 2 0 0 1-2 2H8a2 2 0 0 1-2-2L5 6"/>
            <path d="M10 11v6M14 11v6"/>
          </svg>
        </button>
        {loading
          ? <svg className="spin" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke={G.meadow} strokeWidth="2.5" style={{ marginLeft: 4, flexShrink:0 }}><path d="M21 12a9 9 0 1 1-6.219-8.56"/></svg>
          : <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke={G.muted2} strokeWidth="2.5" style={{ marginLeft: 4, flexShrink:0 }}><polyline points="9 18 15 12 9 6"/></svg>
        }
      </div>
    </div>
  )
}

function CheckPanel({ semester }) {
  const [expanded, setExpanded] = useState(true)
  const [subtab, setSubtab] = useState('diagnostic')

  const [diag,        setDiag]        = useState(null)
  const [diagLoading,  setDiagLoading]  = useState(false)
  const [diagError,    setDiagError]    = useState(null)
  const [diagTab,      setDiagTab]      = useState('checks')
  const [diagSemester,  setDiagSemester] = useState(null)

  const [readiness,    setReadiness]    = useState(null)
  const [workload,     setWorkload]     = useState(null)
  const [poolLoading,  setPoolLoading]  = useState(false)
  const [poolError,    setPoolError]    = useState(null)
  const [poolSemester, setPoolSemester] = useState(null)
  const [filterTab,    setFilterTab]    = useState('all')
  const [showOtherDept, setShowOtherDept] = useState(false)
  const [modalItem,    setModalItem]     = useState(null)
  const [courseSearch, setCourseSearch] = useState('')

  async function runDiagnostic() {
    setDiagLoading(true); setDiagError(null)
    try {
      const data = await getPreDiagnostic(semester)
      setDiag(data)
      setDiagSemester(semester)
    } catch (err) {
      setDiagError(await parseError(err, 'run pre-diagnostic check'))
    } finally {
      setDiagLoading(false)
    }
  }

  async function runPoolCheck() {
    setPoolLoading(true); setPoolError(null)
    try {
      const [facultyList, courseList] = await Promise.all([getFaculty(), getCourses(semester)])
      setReadiness(buildReadinessReport(courseList, facultyList))
      setWorkload(buildWorkloadReport(facultyList))
      setPoolSemester(semester)
      setFilterTab('all')
      setCourseSearch('')
    } catch (err) {
      setPoolError(await parseError(err, 'load readiness data'))
    } finally {
      setPoolLoading(false)
    }
  }

  useEffect(() => {
    if (semester) runDiagnostic()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [semester])

  const diagStale = diag && diagSemester !== semester
  const poolStale = readiness && poolSemester !== semester

  const verdict = diag ? (VERDICT_META[diag.verdict] || VERDICT_META.likely_feasible) : null
  const nFail   = diag?.summary?.failCount || 0
  const nWarn   = diag?.summary?.warnCount || 0

  const summary = useMemo(() => {
    if (!readiness) return null
    const myDept = readiness.filter(r => !r.otherDept)
    return {
      ready:       myDept.filter(r => r.status === 'ready').length,
      thin:        myDept.filter(r => r.status === 'thin').length,
      low_quality: myDept.filter(r => r.status === 'low_quality').length,
      no_faculty:  myDept.filter(r => r.status === 'no_faculty').length,
      total:       myDept.length,
      otherDept:   readiness.filter(r => r.otherDept).length,
    }
  }, [readiness])

  const filteredReadiness = useMemo(() => {
    if (!readiness) return []
    const q = courseSearch.toLowerCase().trim()
    return readiness.filter(r => {
      if (r.otherDept) return false
      const matchTab = filterTab === 'issues' ? r.status !== 'ready' : filterTab === 'ready' ? r.status === 'ready' : true
      const matchSearch = !q || r.courseCode.toLowerCase().includes(q) || (r.title || '').toLowerCase().includes(q)
      return matchTab && matchSearch
    })
  }, [readiness, filterTab, courseSearch])

  const otherDeptReadiness = useMemo(() => {
    if (!readiness) return []
    const q = courseSearch.toLowerCase().trim()
    return readiness.filter(r => r.otherDept && (!q || r.courseCode.toLowerCase().includes(q) || (r.title || '').toLowerCase().includes(q)))
  }, [readiness, courseSearch])

  const issueCount      = summary ? summary.thin + summary.low_quality + summary.no_faculty : 0
  const overloadedCount = workload ? workload.filter(f => f.status === 'full').length : 0

  const rollup = (() => {
    if (diagLoading) return { label: 'Checking…', color: G.muted2, bg: G.hover, border: G.border, spin: true }
    if (diagError)   return { label: 'Check failed', color: '#DC2626', bg: '#FEE2E2', border: 'rgba(220, 38, 38, 0.25)' }
    if (!diag)       return null
    return { label: verdict.label, color: verdict.color, bg: verdict.bg, border: verdict.border, icon: verdict.icon }
  })()

  return (
    <div className="sch-card fadein">
      <div className="sch-card-header" onClick={() => setExpanded(v => !v)} style={{ cursor: 'pointer' }}>
        <div style={{ flex: 1, minWidth: 0 }}>
          <h2 className="sch-card-title">Check Readiness</h2>
          <p className="sch-card-sub">Verify the term has enough rooms, slots, and qualified faculty before solving.</p>
        </div>
        {rollup && (
          <div className="fadein" style={{ display:'flex', alignItems:'center', gap:8, padding:'7px 14px', borderRadius:99, background:rollup.bg, border:`1px solid ${rollup.border}`, flexShrink:0 }}>
            {rollup.spin
              ? <svg className="spin" width="13" height="13" viewBox="0 0 24 24" fill="none" stroke={rollup.color} strokeWidth="2.5"><path d="M21 12a9 9 0 1 1-6.219-8.56"/></svg>
              : rollup.icon && <span style={{ fontSize:13, fontWeight:800, color:rollup.color }}>{rollup.icon}</span>
            }
            <span style={{ fontSize:12.5, fontWeight:700, color:rollup.color, whiteSpace:'nowrap' }}>{rollup.label}</span>
            {(nFail > 0 || nWarn > 0) && (
              <span style={{ fontSize:11, color:rollup.color, fontWeight:600, opacity: 0.75 }}>
                {nFail > 0 && `${nFail} fail`}{nFail > 0 && nWarn > 0 && ' · '}{nWarn > 0 && `${nWarn} warn`}
              </span>
            )}
          </div>
        )}
        <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke={G.muted2} strokeWidth="2.5" style={{ flexShrink: 0, transform: expanded ? 'rotate(180deg)' : 'none', transition: 'transform 0.2s' }}>
          <polyline points="6 9 12 15 18 9"/>
        </svg>
      </div>

      {expanded && (
      <div className="panel-body">
        {/* Sub-tabs */}
        <div className="subtab-row" style={{ marginBottom: 12 }}>
          <button className={`subtab-btn${subtab === 'diagnostic' ? ' active' : ''}`} onClick={() => setSubtab('diagnostic')}>
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"><path d="M9 11l3 3L22 4"/><path d="M21 12v7a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h11"/></svg>
            Feasibility
            {diag && <span className="subtab-count">{nFail + nWarn || 'OK'}</span>}
          </button>
          <button className={`subtab-btn${subtab === 'pools' ? ' active' : ''}`} onClick={() => setSubtab('pools')}>
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"><path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2"/><circle cx="9" cy="7" r="4"/><path d="M23 21v-2a4 4 0 0 0-3-3.87"/><path d="M16 3.13a4 4 0 0 1 0 7.75"/></svg>
            Faculty Pools
            {summary && <span className="subtab-count">{issueCount}</span>}
          </button>
        </div>

        {/* ── Feasibility (diagnostic) ── */}
        {subtab === 'diagnostic' && (
          <div className="fadein">
            {diagStale && (
              <div style={{ marginBottom: 14, display:'flex', alignItems:'center', gap:10, padding:'10px 14px', borderRadius:8, background:'#FFFBEB', border:'1px solid #FDE68A' }}>
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="#D97706" strokeWidth="2.5"><circle cx="12" cy="12" r="10"/><line x1="12" y1="8" x2="12" y2="12"/><line x1="12" y1="16" x2="12.01" y2="16"/></svg>
                <span style={{ fontSize:12.5, color:'#92400E', fontWeight:600, flex:1 }}>This result is for a different term. Re-run to refresh.</span>
                <button className="check-btn" onClick={runDiagnostic} disabled={diagLoading} style={{ padding:'6px 12px' }}>Refresh</button>
              </div>
            )}

            {diagLoading && !diag && (
              <div style={{ display:'flex', flexDirection:'column', gap:10, padding:'8px 0' }}>
                <Skel h={56} r={10} /><Skel h={56} r={10} /><Skel h={56} r={10} />
              </div>
            )}

            {diagError && !diagLoading && (
              <div>
                <ErrorBanner error={diagError} onDismiss={() => setDiagError(null)} />
                <button onClick={runDiagnostic} style={{ marginTop: 10, background: 'none', border: 'none', cursor: 'pointer', color: G.meadowDeep, fontSize: 13, fontWeight: 700, fontFamily: "'Inter',sans-serif", padding: 0 }}>
                  Retry check →
                </button>
              </div>
            )}

            {diag && !diagLoading && (
              <div>
                {/* Verdict header */}
                <div style={{ padding:'14px 16px', borderRadius:10, background: verdict.bg, border: `1px solid ${verdict.border}`, display:'flex', alignItems:'center', justifyContent:'space-between', gap:14, flexWrap:'wrap', marginBottom: 12 }}>
                  <div style={{ display:'flex', alignItems:'center', gap:14 }}>
                    <div style={{ width:44, height:44, borderRadius:11, background:verdict.color, color:'#fff', display:'flex', alignItems:'center', justifyContent:'center', fontSize:18, fontWeight:800, flexShrink:0, boxShadow: '0 2px 8px rgba(0,0,0,0.1)' }}>
                      {verdict.icon}
                    </div>
                    <div>
                      <div style={{ fontSize:15, fontWeight:800, color:verdict.color }}>{verdict.label}</div>
                      <div style={{ fontSize:12.5, color:G.ink, marginTop:2, maxWidth:480, fontWeight: 500 }}>{diag.verdictDetail}</div>
                    </div>
                  </div>
                  <div style={{ display:'flex', gap:18, flexShrink:0 }}>
                    {[
                      { val:diag.summary.totalCourses,  label:'Courses'  },
                      { val:diag.summary.totalSections, label:'Sections' },
                      { val:diag.summary.totalFaculty,  label:'Faculty'  },
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

                {/* Accuracy disclaimer */}
                <div style={{ display:'flex', alignItems:'center', gap:10, marginBottom:18 }}>
                  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke={G.muted2} strokeWidth="2" style={{ flexShrink:0 }}><circle cx="12" cy="12" r="10"/><line x1="12" y1="8" x2="12" y2="12"/><line x1="12" y1="16" x2="12.01" y2="16"/></svg>
                  <span style={{ fontSize:11.5, color:G.muted, lineHeight:1.4, fontWeight: 500 }}>
                    Static structural analysis, not a simulation — catches resource shortfalls with high accuracy but can't predict constraint interactions.
                  </span>
                </div>

                {/* Inner tabs */}
                <div style={{ display:'flex', gap:8, marginBottom: 14 }}>
                  {[
                    { key:'checks', label:`Checks (${diag.checks.length})` },
                    { key:'recs',   label:`Recommendations (${diag.recommendations.length})` },
                  ].map(t => (
                    <button key={t.key} onClick={() => setDiagTab(t.key)} className={`r-tab ${diagTab === t.key ? 'active' : ''}`}>{t.label}</button>
                  ))}
                  <span style={{ flex: 1 }} />
                  <button className="check-btn" onClick={runDiagnostic} disabled={diagLoading} style={{ padding: '8px 14px' }}>
                    <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"><polyline points="1 4 1 10 7 10"/><path d="M3.51 15a9 9 0 1 0 .49-4.2"/></svg>
                    Refresh
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
                            {chk.metric && (
                              <div style={{ marginTop:10, display:'flex', alignItems:'center', gap:10 }}>
                                <div style={{ flex:1, height:6, borderRadius:99, background:G.borderLight, overflow:'hidden', maxWidth:240 }}>
                                  <div style={{
                                    height:'100%', borderRadius:99, transition:'width .8s ease',
                                    width:`${Math.min(100, chk.metric.value)}%`,
                                    background: chk.status === 'fail' ? 'linear-gradient(90deg,#EF4444,#DC2626)' :
                                                chk.status === 'warn' ? 'linear-gradient(90deg,#F59E0B,#D97706)' :
                                                `linear-gradient(90deg,${G.meadowBorder},${G.meadow})`,
                                    animation: 'diag-bar .8s ease both',
                                  }}/>
                                </div>
                                <span style={{ fontSize:12, fontWeight:700, color:cm.color }}>{chk.metric.value}{chk.metric.unit} {chk.metric.label}</span>
                              </div>
                            )}
                          </div>
                        </div>
                      )
                    })}
                  </div>
                )}

                {diagTab === 'recs' && (
                  <div style={{ display:'flex', flexDirection:'column', gap:12 }}>
                    {diag.recommendations.length === 0 && (
                      <div style={{ textAlign:'center', padding:'24px 0', color:G.muted, fontSize:13, fontWeight:500 }}>No recommendations — everything looks good.</div>
                    )}
                    {diag.recommendations.map((rec, i) => {
                      const rm = REC_META[rec.type] || REC_META.suggestion
                      const icons = {
                        blocker:    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"><circle cx="12" cy="12" r="10"/><line x1="12" y1="8" x2="12" y2="12"/><line x1="12" y1="16" x2="12.01" y2="16"/></svg>,
                        warning:    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"><path d="M10.29 3.86L1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z"/><line x1="12" y1="9" x2="12" y2="13"/><line x1="12" y1="17" x2="12.01" y2="17"/></svg>,
                        suggestion: <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"><circle cx="12" cy="12" r="10"/><line x1="12" y1="16" x2="12" y2="12"/><line x1="12" y1="8" x2="12.01" y2="8"/></svg>,
                        success:    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"><polyline points="20 6 9 17 4 12"/></svg>,
                      }
                      return (
                        <div key={i} className="diag-rec" style={{ background:rm.bg, borderColor:rm.border, animationDelay:`${i*0.05}s` }}>
                          <div style={{ width:32, height:32, borderRadius:8, background:rm.border, color:rm.color, display:'flex', alignItems:'center', justifyContent:'center', flexShrink:0, marginTop:2 }}>
                            {icons[rec.type]}
                          </div>
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
        )}

        {/* ── Faculty Pools ── */}
        {subtab === 'pools' && (
          <div className="fadein">
            {poolStale && readiness && (
              <div style={{ marginBottom: 14, display:'flex', alignItems:'center', gap:10, padding:'10px 14px', borderRadius:8, background:'#FFFBEB', border:'1px solid #FDE68A' }}>
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="#D97706" strokeWidth="2.5"><circle cx="12" cy="12" r="10"/><line x1="12" y1="8" x2="12" y2="12"/><line x1="12" y1="16" x2="12.01" y2="16"/></svg>
                <span style={{ fontSize:12.5, color:'#92400E', fontWeight:600, flex:1 }}>This result is for a different term. Re-run to refresh.</span>
                <button className="check-btn" onClick={runPoolCheck} disabled={poolLoading} style={{ padding:'6px 12px' }}>Refresh</button>
              </div>
            )}

            {poolError && (
              <div style={{ marginBottom: 20 }}>
                <ErrorBanner error={poolError} onDismiss={() => setPoolError(null)} />
                <button onClick={runPoolCheck} style={{ marginTop: 10, background: 'none', border: 'none', cursor: 'pointer', color: G.meadowDeep, fontSize: 13, fontWeight: 700, fontFamily: "'Inter',sans-serif", padding: 0 }}>
                  Retry check →
                </button>
              </div>
            )}

            {!readiness && !poolLoading && !poolError && (
              <div style={{ display:'flex', flexDirection:'column', alignItems:'center', gap:14, padding:'40px 24px', textAlign:'center', background: G.bg, borderRadius: 12, border: `1px dashed ${G.border}` }}>
                <div style={{ width:56, height:56, borderRadius:'50%', background:G.hover, display:'flex', alignItems:'center', justifyContent:'center', border:`1px solid ${G.borderLight}` }}>
                  <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke={G.muted2} strokeWidth="2"><path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2"/><circle cx="9" cy="7" r="4"/></svg>
                </div>
                <p style={{ fontSize:14.5, fontWeight:800, color:G.ink, margin:0 }}>Check faculty pools per course</p>
                <p style={{ fontSize:13, color:G.muted, maxWidth:340, lineHeight:1.5, margin:0 }}>See which courses have enough qualified faculty before you solve.</p>
                <button className="check-btn" onClick={runPoolCheck} disabled={poolLoading} style={{ marginTop: 4 }}>
                  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"><path d="M22 11.08V12a10 10 0 1 1-5.93-9.14"/><polyline points="22 4 12 14.01 9 11.01"/></svg>
                  Run check
                </button>
              </div>
            )}

            {poolLoading && !readiness && (
              <div style={{ display:'flex', flexDirection:'column', gap:10 }}>
                <Skel h={70} r={10} /><Skel h={56} r={10} /><Skel h={56} r={10} /><Skel h={56} r={10} />
              </div>
            )}

            {readiness && summary && (
              <div>
                <div style={{ display:'flex', justifyContent:'flex-end', marginBottom: 14 }}>
                  <button className="check-btn" onClick={runPoolCheck} disabled={poolLoading}>
                    {poolLoading
                      ? <><svg className="spin" width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"><path d="M21 12a9 9 0 1 1-6.219-8.56"/></svg>Checking…</>
                      : <><svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"><polyline points="1 4 1 10 7 10"/><path d="M3.51 15a9 9 0 1 0 .49-4.2"/></svg>Recheck</>
                    }
                  </button>
                </div>

                {/* Summary tiles */}
                <div style={{ display:'flex', gap:10, marginBottom:16 }}>
                  {[
                    { key:'ready',       label:'Ready' },
                    { key:'thin',        label:'Thin pool' },
                    { key:'low_quality', label:'Low quality' },
                    { key:'no_faculty',  label:'No faculty' },
                  ].map(({ key, label }) => {
                    const meta = STATUS_META[key], count = summary[key]
                    const active = count > 0
                    return (
                      <div key={key}
                        className={`r-stat${active ? ' clickable' : ''}`}
                        onClick={() => active && setFilterTab(key === 'ready' ? 'ready' : 'issues')}
                        style={{ background:meta.bg, borderColor: active ? meta.border : G.borderLight, opacity: active ? 1 : 0.5 }}>
                        <span style={{ fontSize:26, fontWeight:800, color:meta.color, lineHeight:1 }}>{count}</span>
                        <span style={{ fontSize:10.5, fontWeight:800, color:meta.color, textAlign:'center', marginTop:4, textTransform:'uppercase', letterSpacing:'0.5px' }}>{label}</span>
                      </div>
                    )
                  })}
                </div>

                {/* Filter tabs + search */}
                <div style={{ display:'flex', gap:12, marginBottom:16, alignItems:'center', flexWrap:'wrap' }}>
                  <div style={{ display:'flex', gap:8, background:G.hover, padding:6, borderRadius:10, border:`1px solid ${G.border}` }}>
                    {[
                      { key:'all',    label:`All (${summary.total})` },
                      ...(issueCount > 0 ? [{ key:'issues', label:`Issues (${issueCount})` }] : []),
                      { key:'ready',  label:`Ready (${summary.ready})` },
                    ].map(t => (
                      <button key={t.key} className={`r-tab${filterTab === t.key ? ' active' : ''}`} onClick={() => setFilterTab(t.key)}>{t.label}</button>
                    ))}
                  </div>
                  <span style={{ flex:1 }} />
                  <div style={{ position:'relative', width:240 }}>
                    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke={G.muted2} strokeWidth="2.5"
                      style={{ position:'absolute', left:12, top:'50%', transform:'translateY(-50%)', pointerEvents:'none' }}>
                      <circle cx="11" cy="11" r="8"/><line x1="21" y1="21" x2="16.65" y2="16.65"/>
                    </svg>
                    <input className="sch-search" type="text" placeholder="Search by course..." value={courseSearch} onChange={e => setCourseSearch(e.target.value)} />
                  </div>
                </div>

                {/* Course table */}
                <div style={{ borderRadius:10, border:`1px solid ${G.border}`, overflow:'hidden', maxHeight:320, overflowY:'auto', boxShadow:'0 2px 6px rgba(0,0,0,0.04)', background: 'var(--surface)' }}>
                  <div style={{ display:'grid', gridTemplateColumns:'24px 1fr 110px 110px 24px', gap:14, padding:'12px 20px', background:G.hover, borderBottom:`1px solid ${G.border}`, position:'sticky', top:0, zIndex:1, alignItems:'center' }}>
                    <span />
                    <span style={{ fontSize:11.5, fontWeight:800, color:G.muted2, textTransform:'uppercase', letterSpacing:'.8px' }}>Course</span>
                    <span style={{ fontSize:11.5, fontWeight:800, color:G.muted2, textTransform:'uppercase', letterSpacing:'.8px', textAlign:'right' }}>Pool rating</span>
                    <span style={{ fontSize:11.5, fontWeight:800, color:G.muted2, textTransform:'uppercase', letterSpacing:'.8px', textAlign:'right' }}>Status</span>
                    <span />
                  </div>
                  {filteredReadiness.length === 0
                    ? <div style={{ padding:'40px 20px', textAlign:'center', color:G.muted, fontSize:13.5, fontWeight: 500 }}>
                        {courseSearch ? `No courses match "${courseSearch}".` : 'No courses match this filter.'}
                      </div>
                    : filteredReadiness.map(item => <CourseRow key={item.courseCode} item={item} onOpenModal={setModalItem} />)
                  }
                </div>

                {/* Externally managed courses */}
                {summary.otherDept > 0 && (
                  <div style={{ marginTop:20, borderRadius:12, border:`1px solid ${G.border}`, overflow:'hidden' }}>
                    <button onClick={() => setShowOtherDept(v => !v)}
                      style={{ width:'100%', padding:'16px 20px', background:G.hover, border:'none', cursor:'pointer', display:'flex', alignItems:'center', gap:12, fontFamily:"'Inter',sans-serif" }}>
                      <div style={{ width:32, height:32, borderRadius:8, background:G.borderLight, display:'flex', alignItems:'center', justifyContent:'center', color:G.inkMid, border: `1px solid ${G.border}` }}>
                        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
                          <rect x="3" y="3" width="7" height="7" rx="1"/><rect x="14" y="3" width="7" height="7" rx="1"/>
                          <rect x="3" y="14" width="7" height="7" rx="1"/><rect x="14" y="14" width="7" height="7" rx="1"/>
                        </svg>
                      </div>
                      <span style={{ fontSize:14, fontWeight:700, color:G.ink, flex:1, textAlign:'left' }}>Externally Managed Courses</span>
                      <span style={{ fontSize:11.5, padding:'3px 12px', borderRadius:99, background:G.borderLight, color:G.inkMid, fontWeight:800, border: `1px solid ${G.border}` }}>{summary.otherDept}</span>
                      <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke={G.muted2} strokeWidth="2.5"
                        style={{ flexShrink:0, transform: showOtherDept ? 'rotate(180deg)' : 'none', transition:'transform 0.18s', marginLeft:6 }}>
                        <polyline points="6 9 12 15 18 9"/>
                      </svg>
                    </button>
                    {showOtherDept && (
                      <div className="fadein" style={{ borderTop:`1px solid ${G.border}`, maxHeight:320, overflowY:'auto', background: 'var(--surface)' }}>
                        <div style={{ padding:'12px 20px', background:G.bg, borderBottom:`1px solid ${G.borderLight}`, fontSize:12.5, color:G.muted, fontWeight: 500 }}>
                          PE, NSTP, MAT, and GEC are assigned by other departments and skipped by the automated solver.
                        </div>
                        {otherDeptReadiness.map(item => <CourseRow key={item.courseCode} item={item} onOpenModal={setModalItem} />)}
                      </div>
                    )}
                  </div>
                )}
              </div>
            )}
          </div>
        )}
      </div>
      )}

      {modalItem && <FacultyPoolModal item={modalItem} onClose={() => setModalItem(null)} />}
    </div>
  )
}

/* ─────────────────────────── Wizard top bar ─────────────────────────── */

function WizTopBar({ step, onStepClick }) {
  const steps = [
    { n: 1, label: 'Configure' },
    { n: 2, label: 'Readiness' },
    { n: 3, label: 'Solve' },
  ]
  return (
    <div className="wiz-topbar">
      <div id="tour-sch-wizard" className="wiz-steps fadein">
        {steps.map((s, i) => {
          const state = s.n < step ? 'done' : s.n === step ? 'active' : 'todo'
          return (
            <div key={s.n} style={{ display:'flex', alignItems:'center', gap:4 }}>
              <div className={`wiz-step-node ${state}`} onClick={() => state === 'done' && onStepClick(s.n)}>
                <div className={`wiz-step-circle ${state}`}>
                  {state === 'done'
                    ? <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3"><polyline points="20 6 9 17 4 12"/></svg>
                    : s.n}
                </div>
                <span className={`wiz-step-label ${state}`}>{s.label}</span>
              </div>
              {i < steps.length - 1 && <div className={`wiz-step-div${state === 'done' ? ' done' : ''}`} />}
            </div>
          )
        })}
      </div>
    </div>
  )
}

/* ────────────────────── compact step header + generic icon ────────────────────── */

function CalendarIcon({ size = 18 }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
      <rect x="3" y="4" width="18" height="18" rx="2"/><line x1="16" y1="2" x2="16" y2="6"/>
      <line x1="8" y1="2" x2="8" y2="6"/><line x1="3" y1="10" x2="21" y2="10"/>
    </svg>
  )
}

function StepHeader({ number, title, subtitle, badge }) {
  return (
    <div style={{ display:'flex', alignItems:'center', gap:14, padding:'16px 22px', borderRadius:14,
      background: `linear-gradient(135deg, ${G.meadowDeep}, ${G.meadow})`, 
      boxShadow: '0 4px 14px rgba(0,0,0,0.15)',
      marginBottom:16, position:'relative', overflow:'hidden' }}>
      
      {/* Decorative background circle */}
      <div style={{ position:'absolute', top:-30, right:-20, width:100, height:100, borderRadius:'50%', background:'rgba(255,255,255,0.05)', pointerEvents:'none' }} />
      
      <div style={{ width:32, height:32, borderRadius:'50%', background: 'rgba(255,255,255,0.2)', border: '1px solid rgba(255,255,255,0.3)',
        display:'flex', alignItems:'center', justifyContent:'center', fontSize:13, fontWeight:800, color: '#fff', flexShrink:0, zIndex: 1 }}>
        {number}
      </div>
      <div style={{ flex:1, minWidth:0, zIndex: 1 }}>
        <div style={{ fontSize:16, fontWeight:800, color: '#fff', letterSpacing:'-0.3px', fontFamily:"'Poppins',sans-serif" }}>{title}</div>
        <div style={{ fontSize:12.5, color: 'rgba(255,255,255,0.8)', fontWeight:500, marginTop:2 }}>{subtitle}</div>
      </div>
      <div style={{ zIndex: 1 }}>{badge}</div>
    </div>
  )
}

/* ─────────────────────────── Step 1 slide ─────────────────────────── */

function Step1Configure({ scheduleNamePreset, setScheduleNamePreset, scheduleNameCustom, setScheduleNameCustom,
  customSemester, setCustomSemester, customAcademicYear, setCustomAcademicYear,
  setSaved, targetSemester, effectiveScheduleName, status,
  termStats, termStatsLoading, savedList, loadingList, loadingItem, onLoad, currentScheduleName, onDelete }) {

  const sc = { from: G.meadowDeep, to: G.meadow }
  
  // Display all saved lists instead of capping at 5, since the main drawer was removed.
  const allSaved = savedList || []

  return (
    <div style={{ display:'flex', flexDirection:'column', height:'100%', minHeight:0 }}>
      {/* Compact step header */}
      <StepHeader
        number={1}
        title="Configure the Term"
        subtitle="Choose the academic year and semester for this schedule."
      />

      {/* Main content: 2-column layout */}
      <div style={{ display:'grid', gridTemplateColumns: allSaved.length > 0 || loadingList ? '1fr 340px' : '1fr', gap:14, flex:1, minHeight:0 }}>
      <div style={{ display:'flex', flexDirection:'column', gap:12, minHeight:0, overflowY:'auto' }}>

      {/* Term selector card */}
      <div id="tour-sch-presets" className="sch-card">
        <div className="sch-card-header">
          <div style={{ flex:1, minWidth:0 }}>
            <h2 className="sch-card-title">Academic Term</h2>
            <p className="sch-card-sub">Select a preset or enter a custom name.</p>
          </div>
        </div>
        <div className="sch-card-body" style={{ display:'flex', flexDirection:'column', gap:14 }}>
          <div style={{ display:'flex', flexWrap:'wrap', gap:16 }}>
            <div style={{ display:'flex', flexDirection:'column', gap:6, flex: '1 1 180px' }}>
              <span style={{ fontSize:11, fontWeight:800, color:G.muted2, textTransform:'uppercase', letterSpacing:'0.8px' }}>Academic Term</span>
              <select className="sch-select" value={scheduleNamePreset}
                onChange={e => { setScheduleNamePreset(e.target.value); setSaved(false) }}
                disabled={status === 'running'} style={{ width: '100%' }}>
                {PRESET_NAMES.map(n => <option key={n} value={n}>{n}</option>)}
              </select>
            </div>
            {scheduleNamePreset === 'Custom...' && (
              <>
                <div style={{ display:'flex', flexDirection:'column', gap:6, flex: '1 1 180px' }} className="fadein">
                  <span style={{ fontSize:11, fontWeight:800, color:G.muted2, textTransform:'uppercase', letterSpacing:'0.8px' }}>Schedule Name</span>
                  <input className="sch-input" placeholder="e.g. Summer 2026" value={scheduleNameCustom}
                    onChange={e => { setScheduleNameCustom(e.target.value); setSaved(false) }}
                    disabled={status === 'running'} style={{ width: '100%' }} />
                </div>
                <div style={{ display:'flex', flexDirection:'column', gap:6, flex: '1 1 120px' }} className="fadein">
                  <span style={{ fontSize:11, fontWeight:800, color:G.muted2, textTransform:'uppercase', letterSpacing:'0.8px' }}>Academic Year</span>
                  <select className="sch-select" value={customAcademicYear}
                    onChange={e => { setCustomAcademicYear(e.target.value); setSaved(false) }}
                    disabled={status === 'running'} style={{ width: '100%' }}>
                    <option value="">— Select —</option>
                    {AY_OPTIONS.map(ay => (
                      <option key={ay} value={ay}>{ay}</option>
                    ))}
                  </select>
                </div>
                <div style={{ display:'flex', flexDirection:'column', gap:6, flex: '1 1 140px' }} className="fadein">
                  <span style={{ fontSize:11, fontWeight:800, color:G.muted2, textTransform:'uppercase', letterSpacing:'0.8px' }}>Semester</span>
                  <select className="sch-select" value={customSemester}
                    onChange={e => setCustomSemester(e.target.value)}
                    disabled={status === 'running'} style={{ width: '100%' }}>
                    {SEMESTER_OPTIONS.map(s => <option key={s} value={s}>{s}</option>)}
                  </select>
                </div>
              </>
            )}
          </div>

          {/* Preview strip */}
          {effectiveScheduleName.trim() && (
            <div className="fadein" style={{ display:'flex', alignItems:'center', gap:16, padding:'16px 20px', borderRadius:12,
              background:`linear-gradient(135deg,${sc.from}08,${sc.to}18)`, border:`1px solid ${sc.from}30` }}>
              <div style={{ width:38, height:38, borderRadius:10, background:`linear-gradient(135deg,${sc.from},${sc.to})`, display:'flex', alignItems:'center', justifyContent:'center', flexShrink:0, color:'#fff', boxShadow:`0 3px 10px ${sc.from}40` }}><CalendarIcon size={16} /></div>
              <div style={{ flex:1 }}>
                <div style={{ fontSize:15, fontWeight:800, color:G.ink, letterSpacing:'-0.2px' }}>{effectiveScheduleName.trim()}</div>
                <div style={{ fontSize:12.5, color:G.muted, fontWeight:500, marginTop:2 }}>Will load <strong style={{ color:sc.from }}>{targetSemester}</strong> course list</div>
              </div>
              <div style={{ display:'flex', alignItems:'center', gap:8, padding:'6px 14px', borderRadius:99, background:'rgba(255,255,255,0.8)', border:`1px solid ${sc.from}30` }}>
                <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke={sc.from} strokeWidth="2.5"><polyline points="20 6 9 17 4 12"/></svg>
                <span style={{ fontSize:12, fontWeight:700, color:sc.from }}>Ready</span>
              </div>
            </div>
          )}
        </div>
      </div>

      {/* Live term stats strip */}
      <div className="sch-card" style={{ borderTop: `3px solid ${sc.from}` }}>
        <div style={{ padding:'16px 20px', display:'flex', alignItems:'center', gap:20 }}>
          <span style={{ fontSize:12, fontWeight:700, color:G.muted2, textTransform:'uppercase', letterSpacing:'0.5px', flexShrink:0 }}>Term Data</span>
          <div style={{ width:1, height:24, background:G.border, flexShrink:0 }} />
          {termStatsLoading ? (
            <div style={{ display:'flex', gap:24, flex:1 }}>
              <Skel w={80} h={16} r={6} /><Skel w={80} h={16} r={6} /><Skel w={80} h={16} r={6} />
            </div>
          ) : termStats ? (
            <div style={{ display:'flex', gap:24, flex:1, flexWrap:'wrap' }}>
              {[
                { val: termStats.courses, label: 'Courses', color: G.meadowDeep },
                { val: termStats.sections, label: 'Sections', color: G.inkMid },
                { val: termStats.faculty, label: 'Faculty', color: '#0369A1' },
                { val: termStats.lecRooms, label: 'Lec Rooms', color: '#7C3AED' },
                { val: termStats.labRooms, label: 'Lab Rooms', color: '#D97706' },
              ].map(s => (
                <div key={s.label} style={{ display:'flex', alignItems:'center', gap:6 }}>
                  <span style={{ fontSize:18, fontWeight:800, color:s.color, lineHeight:1 }}>{s.val}</span>
                  <span style={{ fontSize:11, fontWeight:600, color:G.muted2 }}>{s.label}</span>
                </div>
              ))}
            </div>
          ) : (
            <span style={{ fontSize:12.5, color:G.muted, fontWeight:500 }}>Loading term data…</span>
          )}
        </div>
      </div>
      </div>{/* close left column */}

      {/* Right column: All saved schedules */}
      {(allSaved.length > 0 || loadingList) && (
        <div id="tour-sch-saved-list" className="sch-card" style={{ alignSelf:'stretch', display: 'flex', flexDirection: 'column', minHeight: 0 }}>
          <div className="sch-card-header" style={{ padding:'14px 18px', flexShrink: 0 }}>
            <div style={{ flex:1, minWidth:0 }}>
              <h2 className="sch-card-title" style={{ fontSize:13.5 }}>Saved Schedules</h2>
            </div>
            {!loadingList && savedList.length > 0 && (
              <span style={{ fontSize:10.5, fontWeight:800, padding:'2px 8px', borderRadius:99, background:G.meadow, color:'#fff' }}>{savedList.length}</span>
            )}
          </div>
          <div style={{ flex: 1, overflowY:'auto', minHeight: 0 }}>
            {loadingList ? (
              <div style={{ padding:'12px 18px', display:'flex', flexDirection:'column', gap:10 }}>
                <Skel h={44} r={8} /><Skel h={44} r={8} /><Skel h={44} r={8} />
              </div>
            ) : allSaved.length === 0 ? (
              <div style={{ padding:'24px 18px', textAlign:'center', color:G.muted, fontSize:13 }}>No saved schedules yet.</div>
            ) : (
              allSaved.map(s => {
                const sName = typeof s === 'string' ? s : (s.name || s.id || '')
                const sFinalized = typeof s === 'object' ? !!s.finalized : false
                const sAcademicYear = typeof s === 'object' ? s.academicYear : null
                const sSemester = typeof s === 'object' ? s.semester : null
                return (
                  <SavedItem 
                    key={sName} 
                    name={sName}
                    academicYear={sAcademicYear}
                    semester={sSemester}
                    finalized={sFinalized}
                    onLoad={onLoad} 
                    onDelete={onDelete} 
                    loading={loadingItem === sName} 
                    isCurrent={sName === currentScheduleName} 
                  />
                )
              })
            )}
          </div>
        </div>
      )}
      </div>{/* close grid */}
    </div>
  )
}

/* ─────────────────────────── main page ─────────────────────────── */

import { useTour } from '../../hooks/useTour.jsx'

const TOUR_SEEN_KEY = 'adminScheduler_tourSeen'
function isOnboardingCompleted() {
  try { return localStorage.getItem(TOUR_SEEN_KEY) === '1' } catch { return true }
}
function markOnboardingCompleted() {
  try { localStorage.setItem(TOUR_SEEN_KEY, '1') } catch {}
}

export default function SchedulerPage() {
  const navigate  = useNavigate()
  const location  = useLocation()
  const setEvents = useScheduleStore(s => s.setEvents)
  const setName   = useScheduleStore(s => s.setName)
  const currentScheduleName = useScheduleStore(s => s.scheduleName)
  const { progress, status, processId, label, originalName, setProcessId, setStatus, setLabel, setOriginalName, setDismissed, reset } = useSolverStore()
  const { toasts, toast } = useToast()

  const [wizStep, setWizStep] = useState(1)
  const [slideDir, setSlideDir] = useState('enter') // 'enter' | 'back'

  // Steps depend on which wizard step is currently mounted, since each step
  // swaps out its DOM entirely (Readiness/Solve panels aren't present while
  // on Configure, and vice versa). useTour reads `steps` fresh on every
  // render, so recomputing this per wizStep lets the single header '?'
  // button show the right walkthrough wherever the admin currently is,
  // without needing a separate tour per step. Mirrors the coordinator
  // scheduler's tour (see CoordSchedulerPage.jsx) for consistency.
  const stepsForWizStep = useMemo(() => {
    if (wizStep === 1) {
      return [
        {
          target: '#tour-sch-wizard',
          title: 'Welcome to the Scheduler',
          content: 'This 3-step wizard walks you through Configuring the term, checking Readiness, and Solving to generate a timetable. Once a step is complete you can jump back to it any time.',
          skipBeacon: true,
        },
        {
          target: '#tour-sch-presets',
          title: 'Choose the Term',
          content: 'Select the semester to schedule for, or use Custom... to specify a different academic year.',
        },
        {
          target: '#tour-sch-saved-list',
          title: 'Saved Schedules',
          content: 'Or load a previously saved schedule from here instead of starting a fresh configuration.',
        },
        {
          target: '#tour-sch-next',
          title: 'Next: Readiness',
          content: 'Once you\'ve picked a term, click here to move on to the readiness check and solver.',
        },
      ]
    }
    if (wizStep === 2) {
      return [
        {
          target: '#tour-sch-checkpanel',
          title: 'Readiness Check',
          content: 'This step verifies structural feasibility and faculty pools before you spend time solving. Each check either passes, warns, or fails, along with the utilization percentage behind it — a fail here means solving won\'t produce a usable schedule, so it\'s worth fixing the underlying setup first.',
          placement: 'center',
          disableBeacon: true,
        },
        {
          target: '#tour-sch-next',
          title: 'Next: Solve',
          content: 'Once readiness looks good, continue on to run the solver.',
        },
      ]
    }
    // wizStep === 3
    return [
      {
        target: '#tour-sch-phase-order',
        title: 'Phase Priority Order',
        content: 'New! You can now drag and drop these phases to change the order in which the solver prioritizes them. Phases scheduled earlier get first pick of available rooms and faculty.',
      },
      {
        target: '#tour-sch-solve-area',
        title: 'Solve & Save',
        content: 'Run the constraint solver to auto-generate a timetable for the selected term. It\'s safe to navigate away while it runs — it continues in the background.',
        placement: 'center',
        disableBeacon: true,
      },
    ]
  }, [wizStep])

  const { TourElement, startTour, run: tourRunning } = useTour('adminScheduler', stepsForWizStep)

  // When the admin advances/returns to a different wizard step while the
  // tour is actively running, stepsForWizStep swaps out entirely for that
  // step's own array. Without this, the tour's stepIndex stays wherever it
  // was in the *previous* array, which can point at a target that no
  // longer exists and cause Joyride to re-measure and re-highlight
  // whatever's still mounted (e.g. the wizard stepper) over and over.
  // Jumping to index 0 of the fresh array whenever the wizard step
  // actually changes keeps the tour moving into that step's real content.
  const prevWizStepRef = useRef(1)
  useEffect(() => {
    if (prevWizStepRef.current !== wizStep) {
      if (tourRunning) startTour()
      prevWizStepRef.current = wizStep
    }
  }, [wizStep, tourRunning, startTour])

  

  // Solver / Setup states
  const [scheduleNamePreset, setScheduleNamePreset] = useState(PRESET_NAMES[0])
  const [scheduleNameCustom, setScheduleNameCustom] = useState('')
  const [customSemester,     setCustomSemester]     = useState('1st Semester')
  const [customAcademicYear, setCustomAcademicYear] = useState('')
  const [solveError,   setSolveError]   = useState(null)
  // True from the moment Stop is clicked until the backend actually confirms
  // the solve has unwound (see handleStop). The solver only checks for a
  // cancellation between CP-SAT phases, so this can lag the click by a while —
  // starting a new solve during that window is what causes the "already
  // running" 409 conflict.
  const [stopRequested, setStopRequested] = useState(false)
  const [saved,        setSaved]        = useState(false)
  const [saveLoading,  setSaveLoading]  = useState(false)
  const [termStats,    setTermStats]    = useState(null)
  const [termStatsLoading, setTermStatsLoading] = useState(false)

  // Editable solving phase order (shown on the Solve step). null = use
  // backend default order end-to-end (nothing sent to /generate).
  const [schedulePhases, setSchedulePhases] = useState(null)
  const [defaultPhaseOrder, setDefaultPhaseOrder] = useState(null)
  const [phaseOrder, setPhaseOrder] = useState(null)

  // Fetch phase metadata + default order once on mount.
  useEffect(() => {
    let cancelled = false
    getSchedulePhases().then(res => {
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

  // Diagnostic state
  const [diagnostic, setDiagnostic] = useState(null)
  const [diagnosticLoading, setDiagnosticLoading] = useState(false)

  function semesterFromPreset(preset) {
    if (preset.includes('2nd')) return '2nd Semester'
    if (preset.includes('Midyear')) return 'Midyear'
    return '1st Semester'
  }
  const targetSemester = scheduleNamePreset === 'Custom...'
    ? customSemester
    : semesterFromPreset(scheduleNamePreset)

  // Fetch term stats for Step 1 display
  useEffect(() => {
    let cancelled = false
    setTermStatsLoading(true)
    setTermStats(null)
    getPreDiagnostic(targetSemester)
      .then(data => {
        if (!cancelled && data?.summary) {
          setTermStats({
            courses: data.summary.totalCourses || 0,
            sections: data.summary.totalSections || 0,
            faculty: data.summary.totalFaculty || 0,
            lecRooms: data.summary.lectureRooms || 0,
            labRooms: data.summary.labRooms || 0,
          })
        }
      })
      .catch(() => { if (!cancelled) setTermStats(null) })
      .finally(() => { if (!cancelled) setTermStatsLoading(false) })
    return () => { cancelled = true }
  }, [targetSemester])

  const [savedList,    setSavedList]    = useState([])
  const [loadingList,  setLoadingList]  = useState(true)
  const [loadingItem,  setLoadingItem]  = useState(null)
  const [deleteTarget, setDeleteTarget] = useState(null)

  useEffect(() => {
    listSaved()
      .then(data => setSavedList(Array.isArray(data) ? data : (data?.schedules ?? [])))
      .finally(() => setLoadingList(false))
  }, [])

  // Clear schedule data when semester changes to prevent stale data
  // But only if we're not currently generating (to preserve progress when navigating)
  useEffect(() => {
    // Only clear if we have existing schedule data, status is complete/failed, AND not currently running
    if ((status === 'complete' || status === 'failed') && currentScheduleName && status !== 'running') {
      setEvents([])
      setName(null)
      reset()
      setSaved(false)
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [targetSemester])

  // Preserve progress during navigation - NEVER clear data when generation is active
  // This ensures progress is maintained across all navigation during active generation
  const prevProcessId = useRef(processId)
  const prevStatus = useRef(status)
  
  useEffect(() => {
    // Only clear data when explicitly changing semesters, not during navigation
    // Don't clear if status is 'running' regardless of other conditions
    if (status === 'running') {
      return // Always preserve data during active generation
    }
    
    // Update refs for next render
    prevProcessId.current = processId
    prevStatus.current = status
  }, [processId, status])



  /* ── handlers ── */

  const effectiveScheduleName = scheduleNamePreset === 'Custom...' ? scheduleNameCustom : scheduleNamePreset;
  const canSolve = effectiveScheduleName.trim().length > 0;

  async function handleStop() {
    if (!processId) { reset(); setStatus('idle'); return }
    setStopRequested(true)
    try { await cancelSolve(processId) } catch { /* still wait for poll below */ }
    // Deliberately NOT calling reset()/setStatus('idle') here. Status stays
    // 'running' so useSolverPolling keeps polling /status — it already knows
    // how to transition to 'idle' once the backend reports the solve as
    // actually cancelled. Jumping straight to 'idle' here used to let a
    // fast "Start Solver" click race the backend's still-running process
    // and hit the 409 "already running" conflict.
  }

  // Once the backend confirms the stop (useSolverPolling sees status:
  // 'cancelled' and sets status to 'idle'), clear the "stopping" flag so the
  // Start Solver / Try Again buttons re-enable.
  useEffect(() => {
    if (stopRequested && status !== 'running') {
      setStopRequested(false)
    }
  }, [status, stopRequested])

  async function handleSolve() {    
    if (!canSolve || stopRequested) return;
    setSolveError('')
    setSaved(false)
    
    // Only clear existing schedule data when starting a NEW generation
    // Don't clear if we're resuming or retrying the same generation
    if (status !== 'running') {
      setEvents([])
      setName(null)
    }
    
    // Only clear and reset if this is a brand new generation
    // If resuming (processId exists), preserve the original label
    if (!processId) {
      reset()
      // Don't duplicate the semester if it's already in the schedule name
      const scheduleName = effectiveScheduleName.trim()
      const generationName = scheduleName.includes(targetSemester) 
        ? scheduleName 
        : `${scheduleName} (${targetSemester})`
      setLabel(generationName)
      setOriginalName(generationName) // Store the original name
    }
    setStatus('running')
    try {
      const res = await triggerSolve(targetSemester, phaseOrder)
      setProcessId(res.process_id)
    } catch (err) {
      setStatus('failed')
      const parsed = await parseError(err, 'start the solver')
      setSolveError(parsed)
      toast(parsed.title, 'error', 5000)
    }
  }

  async function handleSave() {
    let finalName = effectiveScheduleName.trim()
    if (!finalName) return
    
    // Generate unique name to prevent overwrites
    finalName = generateUniqueName(finalName)
    
    await performSave(finalName)
  }

  async function performSave(finalName, overwrite = false) {
    setSaveLoading(true)
    try {
      // Pass academicYear and semester so they're stored automatically — no manual entry needed
      const ayRaw = scheduleNamePreset === 'Custom...'
        ? customAcademicYear.trim()
        : scheduleNamePreset.replace(/,.*$/, '').replace('A.Y. ', '').trim()
      await saveSchedule(finalName, { academicYear: ayRaw, semester: targetSemester })
      
      // Update the displayed name if it was auto-renamed
      if (finalName !== effectiveScheduleName.trim()) {
        if (scheduleNamePreset === 'Custom...') {
          setScheduleNameCustom(finalName)
        } else {
          // If it was a preset, switch to custom mode with the new name
          setScheduleNamePreset('Custom...')
          setScheduleNameCustom(finalName)
        }
      }
      
      setName(finalName)
      setSaved(true)
      
      // Show different message if name was auto-changed
      if (finalName !== effectiveScheduleName.trim()) {
        toast(`Saved as "${finalName}" (auto-renamed to avoid overwrite)`, 'success')
      } else {
        toast(`Saved as "${finalName}"`, 'success')
      }
      
      const data = await listSaved()
      setSavedList(Array.isArray(data) ? data : (data?.schedules ?? []))
    } catch (err) {
      const parsed = await parseError(err, 'save schedule')
      toast(`${parsed.title} — ${parsed.message}`, 'error')
    } finally {
      setSaveLoading(false)
    }
  }

  async function handleLoad(name) {
    setLoadingItem(name)
    try {
      const data = await loadSaved(name)
      setEvents(data.schedule)
      setName(name)
      navigate(`/dashboard/schedule/${encodeURIComponent(name)}`)
    } catch (err) {
      const parsed = await parseError(err, `load "${name}"`)
      toast(`${parsed.title} — ${parsed.message}`, 'error')
    } finally {
      setLoadingItem(null)
    }
  }

  function handleDelete(name) {
    setDeleteTarget(name)
  }

  async function confirmDelete() {
    const name = deleteTarget
    setDeleteTarget(null)
    try {
      await deleteSaved(name)
      setSavedList(l => l.filter(x => (typeof x === 'string' ? x : x.name) !== name))
      toast(`"${name}" deleted.`, 'info')
    } catch (err) {
      const parsed = await parseError(err, `delete "${name}"`)
      toast(`${parsed.title} — ${parsed.message}`, 'error')
    }
  }

  // Diagnostic handler
  async function runDiagnostic() {
    setDiagnosticLoading(true)
    try {
      const result = await getDiagnostic(targetSemester)
      setDiagnostic(result)
      if (result.issues && result.issues.length > 0) {
        toast(`Found ${result.issues.length} issue(s) - check diagnostic details`, 'error', 5000)
      } else {
        toast('No issues found - solver should work', 'success')
      }
    } catch (err) {
      const parsed = await parseError(err, 'run diagnostic')
      toast(`${parsed.title} — ${parsed.message}`, 'error')
      setDiagnostic({ status: 'error', error: parsed.message })
    } finally {
      setDiagnosticLoading(false)
    }
  }

  // Smart naming to prevent overwrites
  function generateUniqueName(baseName) {
    const existingNames = savedList.map(s => typeof s === 'string' ? s : s.name)
    
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

  async function handleViewSchedule() {
    // Set metadata in the schedule store before navigating
    const ayRaw = scheduleNamePreset === 'Custom...'
      ? customAcademicYear.trim()
      : scheduleNamePreset.replace(/,.*$/, '').replace('A.Y. ', '').trim()
    
    // Use the current schedule name (which might have been auto-renamed)
    const currentName = currentScheduleName || effectiveScheduleName
    
    // Store the metadata temporarily for the view page
    const metadata = {
      academicYear: ayRaw,
      semester: targetSemester,
      scheduleName: currentName,
      isUnsaved: !saved
    }
    
    // Pass metadata via state
    navigate('/dashboard/schedule', { state: metadata })
  }

  const currentPhaseIdx = Math.floor((progress / 100) * 7)

  function goStep(n) {
    setSlideDir(n > wizStep ? 'enter' : 'back')
    setWizStep(n)
  }

  // Auto-advance to step 3 when solve kicks off
  useEffect(() => {
    if (status === 'running') goStep(3)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [status])

  // Handle hash-based navigation (from floating pill when complete)
  useEffect(() => {
    if (location.hash === '#step3') {
      goStep(3)
      // Clear the hash to clean up URL
      window.history.replaceState(null, null, location.pathname)
    }
  }, [location.hash, goStep])

  /* ────────────────────────── render ────────────────────────── */

  const portalTarget = document.getElementById('header-stepper-portal');

  return (
    <div className="sch-root sch-wizard-shell">
      {TourElement}
      {portalTarget 
        ? createPortal(<WizTopBar step={wizStep} onStepClick={goStep} />, portalTarget) 
        : <WizTopBar step={wizStep} onStepClick={goStep} />
      }

      <div className="wiz-body">
        <div key={wizStep} className={`wiz-slide wiz-slide-${slideDir}${(wizStep === 1 || (wizStep === 3 && status === 'running')) ? ' no-scroll' : ''}`}>

          {wizStep === 1 && (
            <Step1Configure
              scheduleNamePreset={scheduleNamePreset}
              setScheduleNamePreset={setScheduleNamePreset}
              scheduleNameCustom={scheduleNameCustom}
              setScheduleNameCustom={setScheduleNameCustom}
              customSemester={customSemester}
              setCustomSemester={setCustomSemester}
              customAcademicYear={customAcademicYear}
              setCustomAcademicYear={setCustomAcademicYear}
              setSaved={setSaved}
              targetSemester={targetSemester}
              effectiveScheduleName={effectiveScheduleName}
              status={status}
              termStats={termStats}
              termStatsLoading={termStatsLoading}
              savedList={savedList}
              loadingList={loadingList}
              loadingItem={loadingItem}
              onLoad={handleLoad}
              onDelete={handleDelete}
              currentScheduleName={currentScheduleName}
            />
          )}

          {wizStep === 2 && (
            <div>
              <StepHeader
                number={2}
                title="Check Readiness"
                subtitle={<>Verify structural feasibility and faculty pools for <strong style={{ opacity:.95 }}>{originalName ? originalName.split('(').pop().replace(')', '').trim() : targetSemester}</strong> before solving.</>}
                badge={<div style={{ padding:'5px 14px', borderRadius:99, background: 'rgba(255,255,255,0.2)', border: '1px solid rgba(255,255,255,0.3)', fontSize:12, fontWeight:700, color: '#fff', position:'relative' }}>{originalName ? originalName.replace(/[()]/g, '').trim() : effectiveScheduleName || '—'}</div>}
              />
              <div id="tour-sch-checkpanel">
                <CheckPanel semester={originalName ? originalName.split('(').pop().replace(')', '').trim() : targetSemester} />
              </div>
            </div>
          )}

          {wizStep === 3 && (
            // flex:1 + minHeight:0 is only needed for the "running" card, which
            // must fill the available height exactly so its centered loader looks
            // right. For every other state (idle/failed/complete) this forced the
            // card into a fixed-height flex box — when its content (error banner +
            // action buttons) ran taller than that box, the overflow wasn't picked
            // up by the wiz-slide scroll container, so the buttons rendered past
            // the visible edge with no way to scroll to them. Letting those states
            // size naturally (height:auto) fixes that.
            <div id="tour-sch-solve-area" style={{ display:'flex', flexDirection:'column', gap:14, ...(status === 'running' ? { flex:1, minHeight:0 } : {}) }}>
              <StepHeader
                number={3}
                title="Solve & Save"
                subtitle={
                  <>
                    Run the constraint solver to auto-generate a timetable for{' '}
                    <strong style={{ opacity:.95 }}>
                      {/* Show original generation values when status is running/complete, otherwise show current form values */}
                      {(status === 'running' || status === 'complete') && originalName 
                        ? originalName.replace(/[()]/g, '').trim()  // Remove parentheses from stored name
                        : `${scheduleNamePreset === 'Custom...' ? customAcademicYear : scheduleNamePreset.replace(/,.*$/, '').replace('A.Y. ', '')} - ${targetSemester}`
                      }
                    </strong>.
                  </>
                }
              />

              {/* ── RUNNING: full-height, no-scroll state ── */}
              {status === 'running' && (
                <div className="fadein sch-card" style={{ flex:1, display:'flex', flexDirection:'column', alignItems:'center', justifyContent:'center', gap:14, padding:'16px 28px', position:'relative', overflow:'hidden', minHeight:0 }}>
                  
                  {/* Subtle bg gradient */}
                  <div style={{ position:'absolute', inset:0, background:`linear-gradient(160deg, ${G.meadowSoft} 0%, #fff 55%, ${G.bg} 100%)`, pointerEvents:'none' }} />

                  {/* Calendar widget — no message, no inner progress bar */}
                  <div style={{ position:'relative', zIndex:1, flexShrink:0 }}>
                    <ScheduleGeneratorLoader
                      message=""
                      progress={progress}
                      showProgress={false}
                      isOverlay={false}
                    />
                  </div>

                  {/* Phase timeline — single progress bar + phase dots */}
                  <div style={{ width:'100%', maxWidth:520, position:'relative', zIndex:1, flexShrink:0 }}>
                    <PhaseTimeline currentPhaseIdx={currentPhaseIdx} status={status} progress={progress}
                      order={phaseOrder || defaultPhaseOrder} defaultOrder={defaultPhaseOrder} editable={false} />
                  </div>

                  {/* Info note */}
                  <p style={{ position:'relative', zIndex:1, fontSize:12, color:G.muted, fontWeight:500, textAlign:'center', margin:0, lineHeight:1.5, flexShrink:0 }}>
                    {stopRequested
                      ? 'Stopping — the solver only checks for this between phases, so it can take a moment.'
                      : 'Running in the background — you can safely navigate away.'}
                  </p>
                </div>
              )}

              {/* ── IDLE / COMPLETE / FAILED: normal card ── */}
              {status !== 'running' && (
                <div className="sch-card">
                  <div className="sch-card-header">
                    <div style={{ flex:1, minWidth:0 }}>
                      <h2 className="sch-card-title">Schedule Generator</h2>
                      <p className="sch-card-sub">Solving for <strong>{originalName ? originalName.replace(/[()]/g, '').trim() : effectiveScheduleName || targetSemester}</strong></p>
                    </div>
                    <button
                      className="action-btn solve"
                      onClick={handleSolve}
                      disabled={!canSolve || stopRequested}
                      style={{ padding:'11px 26px', fontSize:13.5, flexShrink:0 }}>
                      {status === 'complete'
                        ? <><svg width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"><polyline points="1 4 1 10 7 10"/><path d="M3.51 15a9 9 0 1 0 .49-4.2"/></svg> Re-generate</>
                        : <><svg width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"><polygon points="5 3 19 12 5 21 5 3"/></svg> Start Solver</>
                      }
                    </button>
                  </div>

                  <div className="sch-card-body">
                    <PhaseTimeline currentPhaseIdx={currentPhaseIdx} status={status} progress={progress}
                      order={phaseOrder || defaultPhaseOrder} defaultOrder={defaultPhaseOrder}
                      onReorder={reorderPhase} onReset={() => setPhaseOrder(null)} editable />

                    {status === 'failed' && (
                      <div className="fadein solve-result failed" style={{ marginTop:14 }}>
                        <div className="solve-result-body" style={{ background: '#FEF2F2' }}>
                          {solveError ? (
                            <ErrorBanner error={solveError} onDismiss={() => setSolveError(null)} />
                          ) : (
                            <>
                              <div style={{ width:44, height:44, borderRadius:'50%', background:'#FEE2E2', border:'1.5px solid #FCA5A5', display:'flex', alignItems:'center', justifyContent:'center', flexShrink:0 }}>
                                <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="#DC2626" strokeWidth="2.5"><circle cx="12" cy="12" r="10"/><line x1="12" y1="8" x2="12" y2="12"/><line x1="12" y1="16" x2="12.01" y2="16"/></svg>
                              </div>
                              <div>
                                <div style={{ fontSize:16, fontWeight:800, color:'#991B1B', marginBottom:3 }}>Could Not Generate Schedule</div>
                                <div style={{ fontSize:13.5, color:'#B91C1C', fontWeight:500 }}>No feasible solution found. Run diagnostics to identify the cause.</div>
                              </div>
                            </>
                          )}
                        </div>
                        <div className="solve-result-actions">
                          <button 
                            className="solve-action-btn ghost" 
                            onClick={runDiagnostic}
                            disabled={diagnosticLoading}
                          >
                            {diagnosticLoading 
                              ? <><svg className="spin" width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"><path d="M21 12a9 9 0 1 1-6.219-8.56"/></svg> Checking...</>
                              : <><svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"><path d="M9 12l2 2 4-4"/><circle cx="12" cy="12" r="9"/></svg> Run Diagnostics</>
                            }
                          </button>
                          <button className="solve-action-btn ghost" onClick={() => goStep(2)}>
                            <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"><polyline points="15 18 9 12 15 6"/></svg>
                            Review Readiness
                          </button>
                          <button className="solve-action-btn primary" onClick={handleSolve} disabled={!canSolve || stopRequested}>
                            <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"><polygon points="5 3 19 12 5 21 5 3"/></svg>
                            Try Again
                          </button>
                        </div>
                        
                        {/* Diagnostic Results Panel */}
                        {diagnostic && (
                          <div className="fadein" style={{ marginTop:16, padding:16, borderRadius:10, border:'1px solid #D8E8DF', background:'var(--bg)' }}>
                            <div style={{ display:'flex', alignItems:'center', gap:10, marginBottom:12 }}>
                              <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke={G.meadowDeep} strokeWidth="2.5">
                                <path d="M9 12l2 2 4-4"/><circle cx="12" cy="12" r="9"/>
                              </svg>
                              <span style={{ fontSize:14, fontWeight:700, color:G.ink }}>Diagnostic Results</span>
                            </div>
                            
                            {diagnostic.status === 'error' ? (
                              <div style={{ padding:12, borderRadius:8, background:'#FEE2E2', border:'1px solid #FECACA' }}>
                                <div style={{ fontSize:13, fontWeight:600, color:'#DC2626', marginBottom:4 }}>Diagnostic Error</div>
                                <div style={{ fontSize:12, color:'#B91C1C' }}>{diagnostic.error}</div>
                              </div>
                            ) : (
                              <div>
                                {/* Summary */}
                                <div style={{ display:'grid', gridTemplateColumns:'repeat(auto-fit, minmax(140px, 1fr))', gap:8, marginBottom:14 }}>
                                  <div style={{ padding:8, borderRadius:6, background: 'var(--surface)', border:'1px solid #D8E8DF', textAlign:'center' }}>
                                    <div style={{ fontSize:16, fontWeight:800, color:G.meadowDeep }}>{diagnostic.summary?.filtered_courses || 0}</div>
                                    <div style={{ fontSize:10, color:G.muted, textTransform:'uppercase', letterSpacing:'0.5px' }}>Courses</div>
                                  </div>
                                  <div style={{ padding:8, borderRadius:6, background: 'var(--surface)', border:'1px solid #D8E8DF', textAlign:'center' }}>
                                    <div style={{ fontSize:16, fontWeight:800, color:G.meadowDeep }}>{diagnostic.summary?.total_rooms || 0}</div>
                                    <div style={{ fontSize:10, color:G.muted, textTransform:'uppercase', letterSpacing:'0.5px' }}>Rooms</div>
                                  </div>
                                  <div style={{ padding:8, borderRadius:6, background: 'var(--surface)', border:'1px solid #D8E8DF', textAlign:'center' }}>
                                    <div style={{ fontSize:16, fontWeight:800, color:G.meadowDeep }}>{diagnostic.summary?.days_configured || 0}</div>
                                    <div style={{ fontSize:10, color:G.muted, textTransform:'uppercase', letterSpacing:'0.5px' }}>Days</div>
                                  </div>
                                </div>

                                {/* Issues */}
                                {diagnostic.issues && diagnostic.issues.length > 0 ? (
                                  <div style={{ marginBottom:12 }}>
                                    <div style={{ fontSize:12, fontWeight:700, color:'#DC2626', marginBottom:8, textTransform:'uppercase', letterSpacing:'0.5px' }}>Issues Found</div>
                                    {diagnostic.issues.map((issue, i) => (
                                      <div key={i} style={{ display:'flex', alignItems:'flex-start', gap:8, padding:8, borderRadius:6, background:'#FEE2E2', border:'1px solid #FECACA', marginBottom:6 }}>
                                        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="#DC2626" strokeWidth="2.5" style={{ flexShrink:0, marginTop:1 }}>
                                          <circle cx="12" cy="12" r="10"/><line x1="12" y1="8" x2="12" y2="12"/><line x1="12" y1="16" x2="12.01" y2="16"/>
                                        </svg>
                                        <span style={{ fontSize:12, color:'#B91C1C', lineHeight:1.4 }}>{issue}</span>
                                      </div>
                                    ))}
                                  </div>
                                ) : (
                                  <div style={{ display:'flex', alignItems:'center', gap:8, padding:8, borderRadius:6, background:G.meadowSoft, border:`1px solid ${G.meadowBorder}`, marginBottom:12 }}>
                                    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke={G.meadowDeep} strokeWidth="2.5">
                                      <polyline points="20 6 9 17 4 12"/>
                                    </svg>
                                    <span style={{ fontSize:12, color:G.meadowDeep, fontWeight:600 }}>No issues detected</span>
                                  </div>
                                )}

                                {/* Recommendation */}
                                <div style={{ padding:10, borderRadius:6, background:'#F0F9FF', border:'1px solid #BAE6FD' }}>
                                  <div style={{ fontSize:11, fontWeight:700, color:'#0369A1', marginBottom:4, textTransform:'uppercase', letterSpacing:'0.5px' }}>Recommendation</div>
                                  <div style={{ fontSize:12, color:'#0C4A6E', lineHeight:1.4 }}>{diagnostic.recommendation}</div>
                                </div>
                              </div>
                            )}
                          </div>
                        )}
                      </div>
                    )}

                    {status === 'complete' && (
                      <div className="fadein solve-result complete" style={{ marginTop:14 }}>
                        <div className="solve-result-body" style={{ background:'var(--meadow-soft)' }}>
                          <div style={{ width:44, height:44, borderRadius:'50%', background:'var(--meadow-soft)', border:'1.5px solid var(--mint)', display:'flex', alignItems:'center', justifyContent:'center', flexShrink:0 }}>
                            <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="var(--meadow)" strokeWidth="3"><polyline points="20 6 9 17 4 12"/></svg>
                          </div>
                          <div style={{ flex:1, minWidth:0 }}>
                            <div style={{ fontSize:16, fontWeight:800, color:G.ink, marginBottom:3 }}>Schedule Generated Successfully</div>
                            <div style={{ fontSize:13.5, color:G.muted, fontWeight:500 }}>
                              <strong style={{ color:G.meadowDeep }}>"{originalName ? originalName.replace(/[()]/g, '').trim() : effectiveScheduleName}"</strong> is ready in memory.
                            </div>
                          </div>
                        </div>
                        <div className="solve-result-actions">
                          <button className="solve-action-btn primary" onClick={handleViewSchedule}>
                            <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"><path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z"/><circle cx="12" cy="12" r="3"/></svg>
                            View Schedule
                          </button>
                        </div>
                      </div>
                    )}
                  </div>
                </div>
              )}
            </div>
          )}

        </div>
      </div>

      {/* Wizard footer nav */}
      <div className="wiz-footer">
        <div style={{ display:'flex', alignItems:'center', gap:12 }}>
          {wizStep > 1 && (
            <button className="wiz-nav-btn back" onClick={() => goStep(wizStep - 1)}>
              <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"><polyline points="15 18 9 12 15 6"/></svg>
              Back
            </button>
          )}
          <span style={{ fontSize:13, color:G.muted2, fontWeight:500 }}>
            Step {wizStep} of 3 — <span style={{ color:G.ink, fontWeight:700 }}>{['Configure', 'Readiness', 'Solve'][wizStep - 1]}</span>
          </span>
        </div>
        <div style={{ display:'flex', alignItems:'center', gap:10 }}>
          {wizStep === 1 && (
            <button id="tour-sch-next" className="wiz-nav-btn next" onClick={() => goStep(2)} disabled={!effectiveScheduleName.trim()}>
              Continue to Readiness Check
              <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"><polyline points="9 18 15 12 9 6"/></svg>
            </button>
          )}
          {wizStep === 2 && (
            <button id="tour-sch-next" className="wiz-nav-btn next" onClick={() => goStep(3)}>
              Continue to Solver
              <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"><polyline points="9 18 15 12 9 6"/></svg>
            </button>
          )}
          {wizStep === 3 && status === 'idle' && (
            <button className="wiz-nav-btn solve-main next" onClick={handleSolve} disabled={!canSolve || stopRequested}>
              <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"><polygon points="5 3 19 12 5 21 5 3"/></svg>
              Start Solver
            </button>
          )}
          {wizStep === 3 && status === 'running' && (
            <div style={{ display:'flex', alignItems:'center', gap:10 }}>
              <div style={{ display:'flex', alignItems:'center', gap:10, padding:'10px 20px', borderRadius:10, background:G.meadowSoft, border:`1px solid ${G.meadowBorder}` }}>
                <svg className="spin" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke={G.meadowDeep} strokeWidth="2.5"><path d="M21 12a9 9 0 1 1-6.219-8.56"/></svg>
                <span style={{ fontSize:13.5, fontWeight:700, color:G.meadowDeep }}>
                  {stopRequested ? 'Stopping…' : `Solving… ${progress}%`}
                </span>
              </div>
              <button
                onClick={handleStop}
                disabled={stopRequested}
                style={{ display:'inline-flex', alignItems:'center', gap:7, padding:'10px 18px', borderRadius:10, border:'1.5px solid #FECACA', background:'rgba(220, 38, 38, 0.05)', color:'#DC2626', fontSize:13, fontWeight:700, cursor: stopRequested ? 'default' : 'pointer', opacity: stopRequested ? 0.6 : 1, fontFamily:"'Inter',sans-serif", transition:'all .15s' }}
                onMouseEnter={e => { if (!stopRequested) e.currentTarget.style.background='#FEE2E2' }}
                onMouseLeave={e => { if (!stopRequested) e.currentTarget.style.background='rgba(220, 38, 38, 0.05)' }}
              >
                <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"><rect x="4" y="4" width="16" height="16" rx="2"/></svg>
                {stopRequested ? 'Stopping…' : 'Stop'}
              </button>
            </div>
          )}
          {wizStep === 3 && status === 'complete' && !saved && (
            <button className="wiz-nav-btn solve-main next" onClick={handleSave} disabled={saveLoading}>
              {saveLoading
                ? <><svg className="spin" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"><path d="M21 12a9 9 0 1 1-6.219-8.56"/></svg>Saving…</>
                : <><svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"><path d="M19 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h11l5 5v11a2 2 0 0 1-2 2z"/><polyline points="17 21 17 13 7 13 7 21"/></svg>Save Schedule</>}
            </button>
          )}
          {wizStep === 3 && status === 'complete' && saved && (
            <button className="wiz-nav-btn next" onClick={handleViewSchedule}>
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"><path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z"/><circle cx="12" cy="12" r="3"/></svg>
              View Schedule
            </button>
          )}
        </div>
      </div>

      {/* Modals */}
      {deleteTarget && <DeleteModal name={deleteTarget} onConfirm={confirmDelete} onCancel={() => setDeleteTarget(null)} />}
      <ToastContainer toasts={toasts} />
    </div>
  )
}