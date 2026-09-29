import { useState, useEffect, useMemo, useCallback, useRef, memo } from 'react'
import { useNavigate } from 'react-router-dom'
import {
  coordListSchedules, coordDeleteSchedule,
  coordRenameSchedule, coordDuplicateSchedule, coordSubmitSchedule,
  coordUnsubmitSchedule, coordCheckTurn, coordGetAnalyticsOverview, listSaved
} from '../../services/api'
import { useTour } from '../../hooks/useTour.jsx'
import QueueAuditTrail from '../../components/QueueAuditTrail'

// Route of CoordAnalyticsPage. It reads ?schedule=<id> to pre-select a draft.
const ANALYTICS_PATH = '/coordinator/analytics'
// Analytics is read-only, so every schedule can be analysed. Return false to restrict it.
const canAnalyze = () => true

const VIEW_KEY = 'coordMySchedule_viewMode'
const INITIAL_VISIBLE = 12 // schedules rendered per term before "Show all"

// Health (conflicts / TBA / fit) survives page navigation, so coming back to
// this page paints the numbers instantly and refreshes them in the background.
// Keyed by schedule id, so it can never show another account's numbers.
let healthCache = {}

/* ── Design tokens (same variables as ScheduleListPage) ───────────────────── */
const G = {
  meadow: 'var(--meadow)', meadowDeep: 'var(--meadow-deep)',
  meadowSoft: 'var(--meadow-soft)', meadowBorder: 'var(--meadow-border)',
  ink: 'var(--ink, #0E2A20)', muted: 'var(--muted, #4B7060)', muted2: 'var(--muted2, #6B8C7A)',
  border: 'var(--border)', hover: 'var(--hover)', bg: 'var(--bg, #F2F7F4)', surface: 'var(--surface, #FFFFFF)',
  amber: '#F59E0B', amberText: '#D97706', amberSoft: 'rgba(245, 158, 11, 0.1)', amberBorder: 'rgba(245, 158, 11, 0.25)',
  red: '#EF4444', redSoft: 'rgba(239, 68, 68, 0.1)', redBorder: 'rgba(239, 68, 68, 0.25)',
  blue: '#60A5FA',
}

const BANNER_PATTERN = "data:image/svg+xml;charset=UTF-8,%3Csvg width='100%25' height='100%25' xmlns='http://www.w3.org/2000/svg'%3E%3Cdefs%3E%3Cpattern id='p' width='40' height='40' patternUnits='userSpaceOnUse'%3E%3Cpath d='M0 40L40 0H20L0 20M40 40V20L20 40' fill='%23ffffff' fill-opacity='0.1'/%3E%3C/pattern%3E%3C/defs%3E%3Crect width='100%25' height='100%25' fill='url(%23p)'/%3E%3C/svg%3E"

/* ── Styles: one button system, one card system, one table ────────────────────
   Injected once at module level (same approach as ScheduleListPage) instead of
   being re-sent through a <style> tag on every render. Fonts are inherited from
   the app, so the per-page Google Fonts @import is gone. */
const CS_STYLE = `
  @keyframes csFade { from { opacity:0; transform:translateY(6px) } to { opacity:1; transform:none } }
  @keyframes csShimmer { 0% { background-position:-600px 0 } 100% { background-position:600px 0 } }
  @media (prefers-reduced-motion: reduce) { .cs-card, .cs-toast, .cs-skel { animation:none !important } }

  .cs-page { font-family:'Inter',sans-serif; background:${G.bg}; min-height:100%; padding:24px 32px; display:flex; flex-direction:column; gap:20px; box-sizing:border-box; }
  .cs-stack { display:flex; flex-direction:column; gap:20px; }
  .cs-meta { font-size:11.5px; color:${G.muted2}; }

  .cs-topbar { display:flex; align-items:center; justify-content:space-between; gap:12px; flex-wrap:wrap; }
  .cs-tabs { padding:4px; }
  .cs-tabs .cs-seg-btn { padding:7px 18px; }

  /* Buttons */
  .cs-btn { display:inline-flex; align-items:center; justify-content:center; gap:6px; height:32px; padding:0 14px; border-radius:6px; border:1px solid transparent; font:600 12px 'Inter',sans-serif; cursor:pointer; white-space:nowrap; transition:background .12s, border-color .12s, opacity .12s; }
  .cs-btn:disabled { opacity:.45; cursor:not-allowed; }
  .cs-btn-sm { height:28px; padding:0 10px; }
  .cs-btn-primary { background:${G.meadow}; color:#fff; }
  .cs-btn-primary:hover:not(:disabled) { opacity:.9; }
  .cs-btn-outline { background:transparent; color:${G.ink}; border-color:${G.border}; }
  .cs-btn-outline:hover:not(:disabled) { background:${G.hover}; border-color:${G.meadowBorder}; }
  .cs-btn-danger { background:${G.red}; color:#fff; }
  .cs-btn-soft-danger { background:transparent; color:${G.red}; border-color:${G.redBorder}; }
  .cs-btn-soft-danger:hover:not(:disabled) { background:${G.redSoft}; }
  .cs-btn-soft-go { background:${G.meadowSoft}; color:var(--meadow-text-hover, ${G.meadow}); border-color:${G.meadowBorder}; }
  .cs-btn-soft-go:hover:not(:disabled) { background:${G.meadowBorder}; }
  .cs-btn-soft-warn { background:${G.amberSoft}; color:${G.amberText}; border-color:${G.amberBorder}; }
  .cs-btn-soft-warn:hover:not(:disabled) { background:${G.amberBorder}; }
  .cs-btn-danger:hover:not(:disabled) { opacity:.9; }
  .cs-link { background:none; border:none; padding:0; font:600 11.5px 'Inter',sans-serif; color:${G.muted}; cursor:pointer; }
  .cs-link:hover:not(:disabled) { color:${G.ink}; text-decoration:underline; }
  .cs-link:disabled { opacity:.45; cursor:not-allowed; }
  .cs-link.go { color:var(--meadow-text, ${G.meadow}); }
  .cs-link.warn { color:${G.amberText}; }
  .cs-link.danger { color:${G.red}; }
  .cs-check { -webkit-appearance:none; appearance:none; width:16px; height:16px; margin:0; flex-shrink:0; border-radius:4px; border:1.5px solid ${G.muted2}; background:transparent center/12px no-repeat; cursor:pointer; transition:background-color .12s, border-color .12s; }
  .cs-check, .cs-check:checked, .cs-check:indeterminate { background-repeat:no-repeat !important; background-position:center !important; background-size:12px 12px !important; }
  .cs-banner .cs-check, .cs-banner .cs-check:checked { background-size:14px 14px !important; }
  .cs-check:hover { border-color:${G.meadow}; }
  .cs-check:focus-visible { outline:2px solid ${G.meadow}; outline-offset:2px; }
  .cs-check:checked { background-color:${G.meadow}; border-color:${G.meadow}; background-image:url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 24 24' fill='none' stroke='%23fff' stroke-width='3.5' stroke-linecap='round' stroke-linejoin='round'%3E%3Cpolyline points='20 6 9 17 4 12'/%3E%3C/svg%3E"); }
  .cs-check:indeterminate { background-color:${G.meadow}; border-color:${G.meadow}; background-image:url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 24 24' fill='none' stroke='%23fff' stroke-width='3.5' stroke-linecap='round'%3E%3Cline x1='6' y1='12' x2='18' y2='12'/%3E%3C/svg%3E"); }
  /* On the banner: white outline, turns solid white with a dark tick when selected */
  .cs-banner .cs-check { width:20px; height:20px; border-radius:5px; border:2px solid rgba(255,255,255,.9); background-color:rgba(255,255,255,.12); }
  .cs-banner .cs-check:hover { background-color:rgba(255,255,255,.25); border-color:#fff; }
  .cs-banner .cs-check:checked { background-color:#fff; border-color:#fff; background-image:url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 24 24' fill='none' stroke='%230E2A20' stroke-width='3.5' stroke-linecap='round' stroke-linejoin='round'%3E%3Cpolyline points='20 6 9 17 4 12'/%3E%3C/svg%3E"); }

  /* Toolbar */
  .cs-toolbar, .cs-bulk { display:flex; align-items:center; gap:10px; flex-wrap:wrap; min-height:34px; }
  .cs-grow { flex:1 1 200px; min-width:160px; }
  .cs-seg { display:inline-flex; gap:2px; padding:2px; border-radius:8px; border:1px solid ${G.border}; background:${G.surface}; flex-shrink:0; }
  .cs-seg-btn { display:inline-flex; align-items:center; gap:6px; padding:5px 12px; border:none; border-radius:6px; background:transparent; font:600 12px 'Inter',sans-serif; color:${G.muted}; cursor:pointer; }
  .cs-seg-btn i { font-style:normal; font-weight:500; font-size:11px; opacity:.75; }
  .cs-seg-btn:hover:not(.on) { color:${G.ink}; }
  .cs-seg-btn.on { background:${G.meadow}; color:#fff; box-shadow:0 2px 8px rgba(0,0,0,.22); }
  .cs-input, .cs-select { height:32px; box-sizing:border-box; padding:0 10px; border-radius:6px; border:1px solid ${G.border}; background:${G.surface}; color:${G.ink}; font:500 12.5px 'Inter',sans-serif; outline:none; }
  .cs-input { width:100%; }
  .cs-input:focus, .cs-select:focus { border-color:${G.meadow}; }
  .cs-select { padding-right:28px; appearance:none; cursor:pointer; max-width:190px;
    background-image:url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='11' height='11' viewBox='0 0 24 24' fill='none' stroke='%236B8C7A' stroke-width='2.5'%3E%3Cpolyline points='6 9 12 15 18 9'/%3E%3C/svg%3E"); background-repeat:no-repeat; background-position:right 10px center; }
  .cs-bulk { background:${G.meadowDeep}; color:#fff; padding:6px 12px; border-radius:8px; }
  .cs-bulk-text { flex:1; font-size:13px; font-weight:600; }
  .cs-bulk .cs-btn-outline { color:#fff; border-color:rgba(255,255,255,.35); }
  .cs-bulk .cs-btn-outline:hover:not(:disabled) { background:rgba(255,255,255,.12); }

  /* Term sections */
  .cs-section { display:flex; flex-direction:column; gap:12px; }
  .cs-section-head { display:flex; align-items:center; gap:10px; flex-wrap:wrap; }
  .cs-section-head h2 { margin:0; font-size:14px; font-weight:800; color:${G.ink}; }
  .cs-count { font-size:11px; font-weight:700; color:${G.muted2}; background:${G.hover}; padding:1px 8px; border-radius:99px; }
  .cs-fold { display:flex; align-items:center; gap:10px; width:100%; padding:10px 14px; border-radius:10px; border:1px solid ${G.border}; background:${G.surface}; cursor:pointer; font-family:'Inter',sans-serif; text-align:left; }
  .cs-fold:hover { background:${G.hover}; }
  .cs-fold h2 { margin:0; font-size:13px; font-weight:700; color:${G.ink}; }
  .cs-fold .cs-meta { margin-left:auto; }
  .cs-caret { font-size:10px; color:${G.muted}; width:10px; }
  .cs-groups-title { font-size:12px; font-weight:700; color:${G.muted}; margin:0 0 -8px; }
  .cs-more { align-self:center; }

  /* Pills */
  .cs-pill { display:inline-block; padding:2px 8px; border-radius:99px; border:1px solid transparent; font-size:10.5px; font-weight:700; line-height:1.5; white-space:nowrap; flex-shrink:0; }
  .cs-pill.draft { background:${G.hover}; color:${G.muted}; border-color:${G.border}; }
  .cs-pill.submitted, .cs-pill.warn { background:${G.amberSoft}; color:${G.amberText}; border-color:${G.amberBorder}; }
  .cs-pill.approved, .cs-pill.ok { background:${G.meadowSoft}; color:var(--meadow-text-hover, ${G.meadow}); border-color:${G.meadowBorder}; }
  .cs-pill.bad { background:${G.redSoft}; color:${G.red}; border-color:${G.redBorder}; }

  /* Card grid */
  .cs-grid { display:grid; grid-template-columns:repeat(auto-fill, minmax(300px, 1fr)); gap:16px; }
  .cs-card { display:flex; flex-direction:column; overflow:hidden; background:${G.surface}; border:1px solid ${G.border}; border-radius:12px; animation:csFade .2s ease both; transition:border-color .15s, box-shadow .15s; }
  .cs-card:hover { border-color:var(--accent, ${G.border}); box-shadow:0 4px 16px rgba(0,0,0,.07); }
  .cs-card.sel { border-color:${G.meadow}; box-shadow:0 0 0 2px ${G.meadowSoft}; }
  .cs-banner { height:44px; position:relative; flex-shrink:0; display:flex; align-items:center; justify-content:space-between; padding:0 12px; background:var(--meadow-deep); }
  .cs-banner::before { content:''; position:absolute; inset:0; opacity:.3; background-image:url("${BANNER_PATTERN}"); background-size:cover; background-position:center; pointer-events:none; }
  .cs-banner > * { position:relative; }
  .cs-banner-pill { display:inline-flex; align-items:center; gap:6px; padding:3px 10px; border-radius:99px; font-size:11px; font-weight:700; color:#fff; background:rgba(255,255,255,.18); border:1px solid rgba(255,255,255,.3); }
  .cs-banner-pill i { width:7px; height:7px; border-radius:50%; background:var(--dot, #CBD5E1); }
  .cs-body { display:flex; flex-direction:column; gap:14px; padding:16px; flex:1; }
  .cs-row1 { display:flex; align-items:flex-start; gap:10px; }
  .cs-name { flex:1; min-width:0; text-align:left; padding:0; border:none; background:none; text-align:left; cursor:pointer; font:800 15px/1.25 'Inter',sans-serif; color:${G.ink}; }
  .cs-name:hover { color:var(--meadow-text-hover, ${G.meadow}); }
  .cs-meta-row { display:flex; align-items:center; justify-content:space-between; gap:8px; margin-top:-6px; font-size:11.5px; color:${G.muted2}; min-height:20px; }
  .cs-note { padding:6px 10px; border-radius:6px; font-size:12px; line-height:1.45; }
  .cs-note.warn { color:${G.amberText}; background:${G.amberSoft}; border:1px solid ${G.amberBorder}; }
  .cs-note.bad { color:${G.red}; background:${G.redSoft}; border:1px solid ${G.redBorder}; }
  .cs-title-block { min-width:0; }
  .cs-term { margin-top:3px; font-size:12px; color:${G.muted2}; }
  .cs-info { display:flex; flex-direction:column; gap:7px; padding:12px 0; border-top:1px solid ${G.hover}; border-bottom:1px solid ${G.hover}; font-size:12px; color:${G.muted}; }
  .cs-info-row { display:flex; align-items:center; gap:8px; min-width:0; }
  .cs-info-row svg { flex-shrink:0; color:${G.muted2}; }
  .cs-info-row .cs-pill { margin-left:auto; }
  .cs-icon-btn { display:inline-flex; align-items:center; justify-content:center; width:30px; height:30px; padding:0; border-radius:6px; border:1px solid ${G.border}; background:transparent; color:${G.muted}; cursor:pointer; flex-shrink:0; transition:background .12s, color .12s, border-color .12s; }
  .cs-icon-btn:hover:not(:disabled) { background:${G.hover}; color:${G.ink}; border-color:${G.meadowBorder}; }
  .cs-icon-btn.danger:hover:not(:disabled) { background:${G.redSoft}; color:${G.red}; border-color:${G.redBorder}; }
  .cs-act-main { display:inline-flex; align-items:center; gap:8px; }
  .cs-act-icons { display:inline-flex; align-items:center; gap:6px; margin-left:auto; }
  .cs-lock { display:inline-flex; align-items:center; gap:6px; font-size:12px; font-weight:600; color:${G.muted2}; }
  .cs-actions { display:flex; gap:8px; }
  .cs-foot { display:flex; align-items:center; gap:8px; margin-top:auto; }
  .cs-rename { display:flex; align-items:center; gap:8px; flex-wrap:wrap; }
  .cs-rename .cs-input { flex:1 1 140px; }

  /* List view (table, same look as ScheduleListPage) */
  .cs-tablewrap { background:${G.surface}; border:1px solid ${G.border}; border-radius:12px; overflow-x:auto; }
  .cs-table { width:100%; border-collapse:collapse; font-size:12.5px; }
  .cs-table th { padding:10px 14px; text-align:left; font-size:10.5px; font-weight:700; letter-spacing:.5px; text-transform:uppercase; color:${G.muted}; background:${G.bg}; border-bottom:1px solid ${G.border}; white-space:nowrap; }
  .cs-table td { padding:10px 14px; border-bottom:1px solid ${G.border}; vertical-align:middle; color:${G.ink}; }
  .cs-table tbody tr:last-child td { border-bottom:none; }
  .cs-table tbody tr:nth-child(even) { background:${G.bg}; }
  .cs-table tbody tr:hover { background:${G.hover}; }
  .cs-table tbody tr.sel { background:${G.meadowSoft} !important; }
  .cs-table .cs-name { display:block; flex:none; font-size:13px; font-weight:700; }
  .cs-table .cs-note { margin-top:6px; display:inline-block; }
  .cs-num { font-weight:700; }
  .cs-row-actions { display:flex; align-items:center; gap:6px; flex-wrap:wrap; justify-content:flex-end; }
  .cs-row-actions .cs-btn { flex-shrink:0; }

  /* Master tab */
  .cs-sec-title { display:flex; align-items:center; justify-content:space-between; gap:8px; margin:0 0 12px; padding-bottom:8px; border-bottom:1px solid ${G.border}; font-size:14px; font-weight:800; color:${G.ink}; }
  .cs-hero { display:flex; align-items:center; gap:16px; padding:18px 20px; border-radius:12px; border:1px solid ${G.meadowBorder}; background:${G.meadowSoft}; cursor:pointer; }
  .cs-hero:hover { border-color:${G.meadow}; }
  .cs-hero-title { display:flex; align-items:center; gap:8px; flex-wrap:wrap; font-size:15px; font-weight:800; color:${G.ink}; margin-bottom:3px; }

  /* States */
  .cs-empty { padding:48px 20px; text-align:center; font-size:13px; color:${G.muted2}; background:${G.surface}; border:1px dashed ${G.border}; border-radius:12px; display:flex; flex-direction:column; align-items:center; gap:14px; }
  .cs-empty.slim { padding:24px 20px; }
  .cs-skel { background:linear-gradient(90deg, ${G.hover} 25%, ${G.meadowSoft} 50%, ${G.hover} 75%); background-size:600px 100%; animation:csShimmer 1.4s ease-in-out infinite; border-radius:6px; }

  /* Toast + modal */
  .cs-toast { position:fixed; bottom:28px; right:28px; z-index:9999; display:flex; align-items:center; gap:12px; padding:11px 16px; border-radius:8px; font-size:13px; font-weight:600; box-shadow:0 8px 24px rgba(0,0,0,.14); animation:csFade .2s ease; }
  .cs-toast.ok { background:${G.meadowSoft}; color:var(--meadow); border:1px solid ${G.meadowBorder}; }
  .cs-toast.err { background:${G.redSoft}; color:${G.red}; border:1px solid ${G.redBorder}; }
  .cs-toast button { background:none; border:none; color:inherit; font-size:16px; line-height:1; padding:0; cursor:pointer; }
  .cs-overlay { position:fixed; inset:0; z-index:1100; display:flex; align-items:center; justify-content:center; padding:24px; background:rgba(10,30,18,.5); }
  .cs-modal { width:100%; max-width:400px; padding:24px; border-radius:12px; background:${G.surface}; box-shadow:0 20px 50px rgba(10,30,18,.22); }
  .cs-modal h3 { margin:0 0 8px; font-size:16px; font-weight:700; color:${G.ink}; }
  .cs-modal p { margin:0 0 20px; font-size:13px; line-height:1.5; color:${G.muted}; }
  .cs-modal-actions { display:flex; gap:10px; justify-content:flex-end; }

  @media (max-width: 640px) { .cs-page { padding:16px; } .cs-grid { grid-template-columns:1fr; } }
`
if (typeof document !== 'undefined') {
  document.getElementById('cs-page-style')?.remove() // keeps hot-reload edits working
  const el = document.createElement('style')
  el.id = 'cs-page-style'
  el.textContent = CS_STYLE
  document.head.appendChild(el)
}

const STATUS = {
  draft:     { label: 'Draft',     accent: 'var(--muted2)' },
  submitted: { label: 'Submitted', accent: G.amber },
  approved:  { label: 'Approved',  accent: 'var(--meadow)' },
}

/* ── Helpers ───────────────────────────────────────────────────────────────── */
const issueCount = (h) => (h ? (h.conflicts || 0) + (h.crossConflicts || 0) + (h.tbaSessions || 0) + (h.overloaded || 0) : null)

// The backend sends timestamps like "2026-08-22T10:15:00" with no "Z". JS parses
// that as *local* time, so on a PH machine (UTC+8) a schedule saved seconds ago
// reads as 8 hours old. If there's no timezone marker we assume UTC (what the
// backend actually writes) and append "Z" before parsing.
function toSafeDate(dateLike) {
  if (!dateLike) return null
  let val = dateLike
  if (typeof val === 'string' && !/[zZ]|[+-]\d{2}:?\d{2}$/.test(val)) val += 'Z'
  const d = new Date(val)
  return Number.isNaN(d.getTime()) ? null : d
}

function timeAgo(dateStr) {
  const then = toSafeDate(dateStr)
  if (!then) return ''
  const min = Math.floor((Date.now() - then.getTime()) / 60000)
  if (min < 1) return 'just now'
  if (min < 60) return `${min}m ago`
  const hr = Math.floor(min / 60)
  if (hr < 24) return `${hr}h ago`
  const day = Math.floor(hr / 24)
  if (day < 7) return `${day}d ago`
  const wk = Math.floor(day / 7)
  if (wk < 5) return `${wk}w ago`
  return then.toLocaleDateString(undefined, { month: 'short', day: 'numeric', year: 'numeric' })
}

const termLabel = (s) => {
  const parts = [s.academicYear ? `A.Y. ${s.academicYear}` : null, s.semester || null].filter(Boolean)
  return parts.length ? parts.join(' • ') : null
}
// Schedules with no term metadata land in one "No term set" bucket instead of vanishing.
const termKey = (s) => (s.academicYear || s.semester ? `${s.academicYear || '—'}||${s.semester || '—'}` : '__no_term__')

const SEM_ORDER = { '1st semester': 0, '2nd semester': 1, 'summer': 2 }
const semRank = (sem) => SEM_ORDER[(sem || '').trim().toLowerCase()] ?? 99

// Newest term first; the active queue's term always leads; "no term" sinks.
function sortTermKeys(keys, activeTermKey) {
  return [...keys].sort((ka, kb) => {
    if (activeTermKey) {
      if (ka === activeTermKey) return -1
      if (kb === activeTermKey) return 1
    }
    if (ka === '__no_term__') return 1
    if (kb === '__no_term__') return -1
    const [ayA, semA] = ka.split('||')
    const [ayB, semB] = kb.split('||')
    if (ayA !== ayB) return ayB.localeCompare(ayA)
    return semRank(semB) - semRank(semA)
  })
}

const time = (s) => toSafeDate(s.createdAt)?.getTime() || 0
const SORTERS = {
  newest: (a, b) => time(b) - time(a),
  oldest: (a, b) => time(a) - time(b),
  name:   (a, b) => (a.name || '').localeCompare(b.name || ''),
  events: (a, b) => (b.eventCount || 0) - (a.eventCount || 0),
}

/* ── Small pieces ──────────────────────────────────────────────────────────── */
function Toast({ msg, onClose }) {
  useEffect(() => {
    if (!msg) return
    const t = setTimeout(onClose, 3500)
    return () => clearTimeout(t)
  }, [msg, onClose])
  if (!msg) return null
  return (
    <div className={`cs-toast ${/fail|error/i.test(msg) ? 'err' : 'ok'}`} role="status">
      {msg}
      <button onClick={onClose} aria-label="Dismiss">×</button>
    </div>
  )
}

function Check({ checked, indeterminate, onChange, label }) {
  return (
    <input type="checkbox" className="cs-check" aria-label={label} checked={!!checked}
      ref={el => { if (el) el.indeterminate = !!indeterminate }} onChange={onChange} />
  )
}

const StatusPill = ({ status }) => <span className={`cs-pill ${STATUS[status] ? status : 'draft'}`}>{(STATUS[status] || STATUS.draft).label}</span>

function IssuePill({ h }) {
  if (!h) return null
  const n = issueCount(h)
  const hard = (h.conflicts || 0) + (h.crossConflicts || 0) > 0
  return <span className={`cs-pill ${n === 0 ? 'ok' : hard ? 'bad' : 'warn'}`}>{n === 0 ? 'No issues' : `${n} issue${n === 1 ? '' : 's'}`}</span>
}

// One callout per schedule, in priority order.
function Note({ s }) {
  if (s.status === 'submitted') return <div className="cs-note warn"><b>Awaiting admin review</b></div>
  if (s.status !== 'draft') return null
  if (s.rejectionFeedback) return <div className="cs-note bad"><b>Rejected:</b> {s.rejectionFeedback}</div>
  if (s.unfinalizedNote) return <div className="cs-note warn"><b>Note:</b> {s.unfinalizedNote}</div>
  return null
}

// Rename state lives with the card, so typing never re-renders the whole page.
function useRename(s, actions) {
  const [editing, setEditing] = useState(false)
  const [value, setValue] = useState('')
  return {
    editing, value, setValue,
    start: () => { setValue(s.name || ''); setEditing(true) },
    cancel: () => setEditing(false),
    save: async () => { if (value.trim() && await actions.rename(s.id, value.trim())) setEditing(false) },
  }
}

function RenameForm({ r }) {
  return (
    <div className="cs-rename">
      <input className="cs-input" value={r.value} autoFocus onChange={e => r.setValue(e.target.value)}
        onKeyDown={e => { if (e.key === 'Enter') r.save(); if (e.key === 'Escape') r.cancel() }} />
      <button className="cs-btn cs-btn-primary cs-btn-sm" onClick={r.save}>Save</button>
      <button className="cs-btn cs-btn-outline cs-btn-sm" onClick={r.cancel}>Cancel</button>
    </div>
  )
}

/* ── Icons (small, stroke-only, inherit colour) ───────────────────────────── */
const Ico = ({ children, size = 14 }) => (
  <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">{children}</svg>
)
const IcoCalendar = (p) => <Ico {...p}><rect x="3" y="4" width="18" height="18" rx="2"/><line x1="16" y1="2" x2="16" y2="6"/><line x1="8" y1="2" x2="8" y2="6"/><line x1="3" y1="10" x2="21" y2="10"/></Ico>
const IcoClock = (p) => <Ico {...p}><circle cx="12" cy="12" r="9"/><polyline points="12 7 12 12 15.5 14"/></Ico>
const IcoSend = (p) => <Ico {...p}><line x1="22" y1="2" x2="11" y2="13"/><polygon points="22 2 15 22 11 13 2 9 22 2"/></Ico>
const IcoUndo = (p) => <Ico {...p}><path d="M9 14 4 9l5-5"/><path d="M4 9h10.5a5.5 5.5 0 0 1 0 11H11"/></Ico>
const IcoLock = (p) => <Ico {...p}><rect x="4" y="11" width="16" height="10" rx="2"/><path d="M8 11V7a4 4 0 0 1 8 0v4"/></Ico>
const IcoEdit = (p) => <Ico {...p}><path d="M17 3a2.85 2.83 0 1 1 4 4L7.5 20.5 2 22l1.5-5.5Z"/></Ico>
const IcoCopy = (p) => <Ico {...p}><rect x="9" y="9" width="13" height="13" rx="2"/><path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1"/></Ico>
const IcoTrash = (p) => <Ico {...p}><polyline points="3 6 5 6 21 6"/><path d="M19 6l-1 14a2 2 0 0 1-2 2H8a2 2 0 0 1-2-2L5 6"/><path d="M10 11v6M14 11v6"/></Ico>

// Left side of the action row: the one workflow action for this status.
function ActionMain({ s, submit, actions, size = 'sm' }) {
  const cls = size === 'sm' ? 'cs-btn cs-btn-sm' : 'cs-btn'
  if (s.status === 'draft') {
    if (submit.pastTerm) return <span className="cs-act-main"><span className="cs-lock" title="Only schedules for the active queue term can be submitted">Past term</span></span>
    return (
      <span className="cs-act-main">
        <button className={`${cls} cs-btn-soft-go tour-btn-submit`} disabled={submit.blocked} title={submit.title}
          onClick={() => !submit.blocked && actions.confirm({ action: 'submit', id: s.id })}><IcoSend size={13} />Submit</button>
      </span>
    )
  }
  if (s.status === 'submitted') {
    return <span className="cs-act-main"><button className={`${cls} cs-btn-soft-warn`} title="Withdraw from review" onClick={() => actions.unsubmit(s.id)}><IcoUndo size={13} />Withdraw</button></span>
  }
  return <span className="cs-act-main"><span className="cs-lock" title="Approved schedules are locked"><IcoLock size={13} />Locked</span></span>
}

// Right side: quiet icon buttons (labels live in the tooltip).
function ActionIcons({ s, actions, r }) {
  return (
    <span className="cs-act-icons">
      {s.status === 'draft' && <button className="cs-icon-btn tour-btn-rename" title="Rename" aria-label="Rename" onClick={r.start}><IcoEdit /></button>}
      <button className="cs-icon-btn tour-btn-duplicate" title="Duplicate" aria-label="Duplicate" onClick={() => actions.confirm({ action: 'duplicate', id: s.id, name: s.name })}><IcoCopy /></button>
      {s.status === 'draft' && <button className="cs-icon-btn danger tour-btn-delete" title="Delete" aria-label="Delete" onClick={() => actions.confirm({ action: 'delete', id: s.id })}><IcoTrash /></button>}
    </span>
  )
}

const BANNER_DOT = { draft: '#CBD5E1', submitted: '#FBBF24', approved: '#4ADE80' }

/* ── Schedule card (grid view) ─────────────────────────────────────────────────
   banner (select + status) → name & term → info → open/analytics → workflow + tools */
const ScheduleCard = memo(function ScheduleCard({ s, h, selected, submit, onToggle, actions }) {
  const r = useRename(s, actions)
  const st = STATUS[s.status] || STATUS.draft
  const created = toSafeDate(s.createdAt)
  const sameYear = created && created.getFullYear() === new Date().getFullYear()
  const updated = created
    ? created.toLocaleString('en-US', { month: 'short', day: 'numeric', ...(sameYear ? {} : { year: 'numeric' }), hour: 'numeric', minute: '2-digit', hour12: true }).replace(',', sameYear ? ',' : '')
    : ''
  const sessions = s.eventCount ?? 0
  return (
    <div className={`cs-card${selected ? ' sel' : ''}`} style={{ '--accent': st.accent }}>
      <div className="cs-banner">
        {s.status === 'draft'
          ? <Check checked={selected} onChange={() => onToggle(s.id)} label="Select schedule" />
          : <span />}
        <span className="cs-banner-pill" style={{ '--dot': BANNER_DOT[s.status] || BANNER_DOT.draft }}><i />{st.label}</span>
      </div>
      <div className="cs-body">
        {r.editing ? <RenameForm r={r} /> : (
          <>
            <div className="cs-title-block">
              <button type="button" className="cs-name" title="Open schedule" onClick={() => actions.open(s.id)}>{s.name}</button>
              <div className="cs-term">{termLabel(s) || 'No term set'}</div>
            </div>
            <Note s={s} />
            <div className="cs-info">
              <div className="cs-info-row">
                <IcoCalendar size={13} />
                <span>{sessions} session{sessions === 1 ? '' : 's'}</span>
                <IssuePill h={h} />
              </div>
              <div className="cs-info-row" title={created ? created.toLocaleString() : ''}>
                <IcoClock size={13} />
                <span>Updated {updated || timeAgo(s.createdAt)}</span>
              </div>
            </div>
            <div className="cs-actions">
              <button className="cs-btn cs-btn-primary tour-btn-view" style={{ flex: 1 }} onClick={() => actions.open(s.id)}>View Schedule</button>
              {canAnalyze(s) && (
                <button className="cs-btn cs-btn-outline tour-btn-analytics" style={{ flex: 1 }} title="Analytics for this schedule" onClick={() => actions.analytics(s.id)}>Analytics</button>
              )}
            </div>
            <div className="cs-foot">
              <ActionMain s={s} submit={submit} actions={actions} />
              <ActionIcons s={s} actions={actions} r={r} />
            </div>
          </>
        )}
      </div>
    </div>
  )
})

/* ── Schedule row (list view): same columns as ScheduleListPage's table ────── */
const ScheduleRow = memo(function ScheduleRow({ s, h, selected, submit, onToggle, actions }) {
  const r = useRename(s, actions)
  const created = toSafeDate(s.createdAt)
  const updated = created ? created.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' }) : ''
  return (
    <tr className={selected ? 'sel' : ''}>
      <td style={{ width: 36 }}>{s.status === 'draft' && <Check checked={selected} onChange={() => onToggle(s.id)} label="Select schedule" />}</td>
      <td>
        {r.editing ? <RenameForm r={r} /> : (
          <>
            <button type="button" className="cs-name" onClick={() => actions.open(s.id)}>{s.name}</button>
            <Note s={s} />
          </>
        )}
      </td>
      <td style={{ whiteSpace: 'nowrap', color: G.muted }}>{termLabel(s) || 'No term set'}</td>
      <td><StatusPill status={s.status} /> <IssuePill h={h} /></td>
      <td>{s.eventCount ?? 0}</td>
      <td style={{ whiteSpace: 'nowrap', color: G.muted }} title={created ? created.toLocaleString() : ''}>{updated}</td>
      <td>
        {!r.editing && (
          <div className="cs-row-actions">
            <button className="cs-btn cs-btn-primary cs-btn-sm tour-btn-view" onClick={() => actions.open(s.id)}>View</button>
            {canAnalyze(s) && <button className="cs-btn cs-btn-outline cs-btn-sm tour-btn-analytics" onClick={() => actions.analytics(s.id)}>Analytics</button>}
            <ActionMain s={s} submit={submit} actions={actions} />
            <ActionIcons s={s} actions={actions} r={r} />
          </div>
        )}
      </td>
    </tr>
  )
})

/* ── One term's schedules, in grid or list ─────────────────────────────────── */
function Collection({ rows, mode, health, selected, submitInfo, onToggle, onToggleMany, actions }) {
  const props = (s) => ({ s, h: health[s.id], selected: selected.has(s.id), submit: submitInfo[s.id], onToggle, actions })
  if (mode === 'grid') return <div className="cs-grid">{rows.map(s => <ScheduleCard key={s.id} {...props(s)} />)}</div>

  const draftIds = rows.filter(s => s.status === 'draft').map(s => s.id)
  const on = draftIds.filter(id => selected.has(id)).length
  return (
    <div className="cs-tablewrap">
      <table className="cs-table">
        <thead>
          <tr>
            <th style={{ width: 36 }}>
              {draftIds.length > 0 && <Check checked={on === draftIds.length} indeterminate={on > 0 && on < draftIds.length} label="Select all drafts in this term"
                onChange={() => onToggleMany(draftIds, on !== draftIds.length)} />}
            </th>
            {['Name', 'Term', 'Status', 'Sessions', 'Last Updated', ''].map(t => <th key={t || 'x'}>{t}</th>)}
          </tr>
        </thead>
        <tbody>{rows.map(s => <ScheduleRow key={s.id} {...props(s)} />)}</tbody>
      </table>
    </div>
  )
}

function ConfirmDialog({ modal, count, busy, onCancel, onConfirm }) {
  if (!modal) return null
  const plural = count > 1 ? 's' : ''
  const cfg = {
    submit: { title: 'Submit schedule?', desc: 'This sends the schedule to the admin for approval. You will not be able to edit it unless the admin recalls it.', ok: 'Submit', working: 'Submitting…' },
    duplicate: { title: 'Duplicate schedule?', desc: `This will create a copy of "${modal.name}" as a new draft.`, ok: 'Duplicate', working: 'Duplicating…' },
    bulkDelete: { title: `Delete ${count} schedule${plural}?`, desc: `This cannot be undone. The ${count} selected schedule${plural} will be removed for good.`, ok: `Delete ${count}`, working: 'Deleting…', danger: true },
    delete: { title: 'Delete schedule?', desc: 'This cannot be undone. The schedule will be removed for good.', ok: 'Delete', working: 'Deleting…', danger: true },
  }[modal.action]
  return (
    <div className="cs-overlay" onClick={() => !busy && onCancel()}>
      <div className="cs-modal" role="dialog" aria-modal="true" onClick={e => e.stopPropagation()}>
        <h3>{cfg.title}</h3>
        <p>{cfg.desc}</p>
        <div className="cs-modal-actions">
          <button className="cs-btn cs-btn-outline" disabled={busy} onClick={onCancel}>Cancel</button>
          <button className={`cs-btn ${cfg.danger ? 'cs-btn-danger' : 'cs-btn-primary'}`} disabled={busy} onClick={onConfirm}>{busy ? cfg.working : cfg.ok}</button>
        </div>
      </div>
    </div>
  )
}

/* ── Master schedules tab ─────────────────────────────────────────────────── */
function MasterSchedulesTab({ navigate, roundTerm, hasQueue }) {
  const [loading, setLoading] = useState(true)
  const [masters, setMasters] = useState([])

  useEffect(() => {
    let alive = true
    listSaved()
      .then(res => { if (alive) setMasters(Array.isArray(res) ? res : (res.schedules || [])) })
      .catch(() => {})
      .finally(() => { if (alive) setLoading(false) })
    return () => { alive = false }
  }, [])

  if (loading) {
    return <div className="cs-grid">{[...Array(3)].map((_, i) => <div key={i} className="cs-skel" style={{ height: 130, borderRadius: 12 }} />)}</div>
  }
  const finalized = masters.filter(m => m.finalized)

  return (
    <div className="cs-stack" style={{ gap: 28 }}>
      {hasQueue && (
        <div data-tour="master-active-queue">
          <h2 className="cs-sec-title">Active Queue Master Schedule</h2>
          <div className="cs-hero" role="button" tabIndex={0} onClick={() => navigate('/coordinator/schedules/master')}
            onKeyDown={e => e.key === 'Enter' && navigate('/coordinator/schedules/master')}>
            <div style={{ flex: 1, minWidth: 0 }}>
              <div className="cs-hero-title">
                {roundTerm ? `Combined master, ${roundTerm.semester} ${roundTerm.academicYear}` : 'Combined master schedule'}
                <span className="cs-pill ok">Live</span>
              </div>
              <div className="cs-meta">Includes every program currently approved in the queue.</div>
            </div>
            <span className="cs-btn cs-btn-primary">Open</span>
          </div>
        </div>
      )}

      <div data-tour="master-finalized">
        <h2 className="cs-sec-title">Finalized master schedules <span className="cs-meta" style={{ fontWeight: 600 }}>{finalized.length} finalized</span></h2>
        {finalized.length === 0 ? (
          <div className="cs-empty slim">No finalized master schedules yet.</div>
        ) : (
          <div className="cs-grid">
            {finalized.map(m => (
              <div key={m.name} className="cs-card" style={{ cursor: 'pointer', '--accent': 'var(--meadow)' }}
                onClick={() => navigate(`/coordinator/schedules/${encodeURIComponent(m.name)}?type=final`)}>
                <div className="cs-banner" />
                <div className="cs-body">
                  <div className="cs-row1">
                    <div className="cs-name" style={{ cursor: 'pointer' }}>{m.name}</div>
                    <span className="cs-pill ok">Finalized</span>
                  </div>
                  <div className="cs-meta-row"><span>{m.semester && m.academicYear ? `${m.semester} • A.Y. ${m.academicYear}` : 'No term set'}</span></div>
                  <div className="cs-foot" style={{ justifyContent: 'space-between' }}>
                    <span className="cs-meta">{m.eventCount || 0} sessions</span>
                    <span className="cs-btn cs-btn-outline cs-btn-sm">Open</span>
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  )
}

/* ── Page ─────────────────────────────────────────────────────────────────── */
export default function CoordMySchedulePage() {
  const navigate = useNavigate()

  const [schedules,   setSchedules]   = useState([])
  const [loading,     setLoading]     = useState(true)
  const [mainTab,     setMainTab]     = useState('my') // 'my' | 'master'
  const [search,      setSearch]      = useState('')
  const [filter,      setFilter]      = useState('all')
  const [sortBy,      setSortBy]      = useState('newest')
  const [termFilter,  setTermFilter]  = useState('all')
  const [viewMode,    setViewMode]    = useState(() => {
    try { return localStorage.getItem(VIEW_KEY) === 'list' ? 'list' : 'grid' } catch { return 'grid' }
  })
  const [openPast,    setOpenPast]    = useState({}) // termKey -> bool; newest past term opens by default
  const [showAll,     setShowAll]     = useState({}) // termKey -> bool
  const [selected,    setSelected]    = useState(() => new Set())
  const [confirmModal, setConfirmModal] = useState(null)
  const [busy,        setBusy]        = useState(false)
  const [toast,       setToast]       = useState('')

  // Per-schedule health (conflicts, TBA, fit) from the analytics overview.
  const [health,        setHealth]        = useState(healthCache)

  // Active queue: which term is live, whose turn it is.
  const [roundTerm,          setRoundTerm]          = useState(null)
  const [isMyTurn,           setIsMyTurn]           = useState(true) // true until loaded, so we don't flash a false block
  const [hasApprovedInQueue, setHasApprovedInQueue] = useState(false)
  const [activeQueueId,      setActiveQueueId]      = useState(null)

  const flash = useCallback(msg => setToast(msg), [])
  const closeToast = useCallback(() => setToast(''), [])
  const changeView = (mode) => {
    setViewMode(mode)
    try { localStorage.setItem(VIEW_KEY, mode) } catch {}
  }

  /* ── Data ── the three requests are independent, so they start together.
     (Health used to wait for the list to finish before it even started.) */
  const loadList = useCallback(async () => {
    try {
      const d = await coordListSchedules()
      setSchedules(Array.isArray(d) ? d : [])
    } catch { /* keep what's on screen */ }
    finally { setLoading(false) } // no skeleton flash on refreshes: only the first load shows one
  }, [])

  const loadHealth = useCallback(async () => {
    try {
      // all_terms/limit need the updated coordinator.py; an older backend just returns the active term
      const o = await coordGetAnalyticsOverview({ all_terms: true, limit: 100 })
      const m = {}
      ;(o?.schedules || []).forEach(r => { m[r.id] = r })
      healthCache = { ...healthCache, ...m }
      setHealth(healthCache)
    } catch { /* health is optional */ }
  }, [])

  useEffect(() => {
    loadList()
    loadHealth()
    coordCheckTurn().then(t => {
      if (!t) return
      setRoundTerm({ academicYear: t.academicYear, semester: t.semester })
      setHasApprovedInQueue(t.queue?.some(p => p.status === 'approved') || false)
      setActiveQueueId(t.queueId)
      setIsMyTurn(Boolean(t.isMyTurn))
    }).catch(() => {})
  }, [loadList, loadHealth])

  /* ── Derived data (memoised, so typing in search stays cheap) ── */
  const activeTermKey = roundTerm ? `${roundTerm.academicYear || '—'}||${roundTerm.semester || '—'}` : null

  const counts = useMemo(() => ({
    all: schedules.length,
    draft: schedules.filter(s => s.status === 'draft').length,
    submitted: schedules.filter(s => s.status === 'submitted').length,
    approved: schedules.filter(s => s.status === 'approved').length,
  }), [schedules])

  const termOptions = useMemo(() => {
    const meta = new Map()
    schedules.forEach(s => { const k = termKey(s); if (!meta.has(k)) meta.set(k, termLabel(s) || 'No term set') })
    return sortTermKeys([...meta.keys()], activeTermKey).map(k => ({ key: k, label: meta.get(k) }))
  }, [schedules, activeTermKey])

  // Filter → sort → group by term. Within a term the submitted schedule leads
  // (a term can only have one submission in flight).
  const view = useMemo(() => {
    const q = search.trim().toLowerCase()
    const filtered = schedules
      .filter(s => (filter === 'all' || s.status === filter)
        && (termFilter === 'all' || termKey(s) === termFilter)
        && (!q || (s.name || '').toLowerCase().includes(q)))
      .sort(SORTERS[sortBy] || SORTERS.newest)

    const byTerm = new Map()
    filtered.forEach(s => {
      const k = termKey(s)
      if (!byTerm.has(k)) byTerm.set(k, { key: k, label: termLabel(s) || 'No term set', rows: [] })
      byTerm.get(k).rows.push(s)
    })
    const sections = sortTermKeys([...byTerm.keys()], activeTermKey).map(k => {
      const sec = byTerm.get(k)
      sec.rows = [...sec.rows.filter(s => s.status === 'submitted'), ...sec.rows.filter(s => s.status !== 'submitted')]
      return sec
    })
    const unfiltered = filter === 'all' && termFilter === 'all' && !q
    let active = activeTermKey ? sections.find(s => s.key === activeTermKey) : null
    // Nothing yet for the live term: still show it, so the coordinator sees they haven't generated one.
    if (!active && activeTermKey && unfiltered && roundTerm) {
      active = { key: activeTermKey, label: termLabel(roundTerm) || 'Active term', rows: [] }
    }
    return {
      filtered, active,
      past: sections.filter(s => s.key !== activeTermKey),
      draftIds: filtered.filter(s => s.status === 'draft').map(s => s.id),
    }
  }, [schedules, filter, termFilter, search, sortBy, activeTermKey, roundTerm])

  // Submit rules, computed once per schedule instead of scanning the whole list per card.
  const submitInfo = useMemo(() => {
    const lockedPerTerm = new Map()
    const isLocked = s => s.status === 'submitted' || s.status === 'approved'
    schedules.forEach(s => { if (isLocked(s)) lockedPerTerm.set(termKey(s), (lockedPerTerm.get(termKey(s)) || 0) + 1) })
    const out = {}
    schedules.forEach(s => {
      const termLocked = (lockedPerTerm.get(termKey(s)) || 0) - (isLocked(s) ? 1 : 0) > 0 // one submission per term
      const pastTerm = !roundTerm || s.academicYear !== roundTerm.academicYear || s.semester !== roundTerm.semester
      const notMyTurn = !pastTerm && !isMyTurn
      out[s.id] = {
        pastTerm,
        blocked: termLocked || pastTerm || notMyTurn,
        title: termLocked ? 'Another schedule is already submitted or approved for this term'
          : pastTerm ? 'You can only submit schedules for the active scheduling queue term'
          : notMyTurn ? "It's not your turn to submit yet" : 'Submit for review',
      }
    })
    return out
  }, [schedules, roundTerm, isMyTurn])

  /* ── Selection (drafts that are currently visible) ── */
  const selCount = view.draftIds.filter(id => selected.has(id)).length
  const selectionMode = selCount > 0
  const allSel = view.draftIds.length > 0 && selCount === view.draftIds.length
  const someSel = selCount > 0 && !allSel

  const toggleOne = useCallback(id => setSelected(p => { const n = new Set(p); n.has(id) ? n.delete(id) : n.add(id); return n }), [])
  const toggleMany = useCallback((ids, on) => setSelected(p => { const n = new Set(p); ids.forEach(id => (on ? n.add(id) : n.delete(id))); return n }), [])

  /* ── Actions ── */
  const errText = (e, fallback) => e?.response?.data?.detail || fallback

  async function handleBulkDelete() {
    const ids = view.draftIds.filter(id => selected.has(id))
    setBusy(true)
    const results = await Promise.allSettled(ids.map(id => coordDeleteSchedule(id)))
    const failed = results.filter(r => r.status === 'rejected').length
    flash(failed ? `Failed to delete ${failed} schedule${failed > 1 ? 's' : ''}` : `Deleted ${ids.length} schedule${ids.length > 1 ? 's' : ''}`)
    setSelected(new Set())
    setBusy(false); setConfirmModal(null)
    loadList()
  }
  async function handleDelete(sid) {
    setBusy(true)
    try { await coordDeleteSchedule(sid); flash('Deleted'); loadList() }
    catch (e) { flash(errText(e, 'Delete failed')) }
    finally { setBusy(false); setConfirmModal(null) }
  }
  async function handleDuplicate(sid, name) {
    setBusy(true)
    try { await coordDuplicateSchedule(sid, { name: `${name} (copy)` }); flash('Duplicated'); loadList(); loadHealth() }
    catch (e) { flash(errText(e, 'Duplicate failed')) }
    finally { setBusy(false); setConfirmModal(null) }
  }
  async function handleSubmit(sid) {
    setBusy(true)
    try { await coordSubmitSchedule(sid); flash('Submitted for review!'); loadList() }
    catch (e) { flash(errText(e, 'Submit failed. This term may already have a submission')) }
    finally { setBusy(false); setConfirmModal(null) }
  }
  const confirmAction = () => {
    const m = confirmModal
    if (m.action === 'submit') handleSubmit(m.id)
    else if (m.action === 'duplicate') handleDuplicate(m.id, m.name)
    else if (m.action === 'bulkDelete') handleBulkDelete()
    else handleDelete(m.id)
  }

  // Cards receive this one stable object, so memo() actually skips re-renders.
  // The methods always call the latest closures through the ref.
  const latest = useRef({})
  latest.current = {
    open: id => navigate(`/coordinator/schedules/${id}`),
    analytics: id => navigate(`${ANALYTICS_PATH}?schedule=${encodeURIComponent(id)}`),
    rename: async (id, name) => {
      try { await coordRenameSchedule(id, { name }); loadList(); return true }
      catch (e) { flash(errText(e, 'Rename failed')); return false }
    },
    unsubmit: async id => {
      try { await coordUnsubmitSchedule(id); flash('Withdrawn from review'); loadList() }
      catch (e) { flash(errText(e, 'Unsubmit failed')) }
    },
  }
  const actions = useMemo(() => ({
    open: (...a) => latest.current.open(...a),
    analytics: (...a) => latest.current.analytics(...a),
    rename: (...a) => latest.current.rename(...a),
    unsubmit: (...a) => latest.current.unsubmit(...a),
    confirm: setConfirmModal,
  }), [])

  /* ── Product tour ── */
  const tourSteps = useMemo(() => {
    const steps = [
      {
        target: '.cs-status-filter',
        title: 'Schedule Status',
        content: 'Filter your generated schedules by their current state: Drafts you are working on, Submitted schedules waiting for admin review, or Approved schedules.',
        placement: 'bottom'
      },
      {
        target: '.cs-term-filter',
        title: 'Term Filter',
        content: 'Use this to focus on schedules for a specific academic year and semester.',
        placement: 'bottom'
      },
      {
        target: '.cs-view-toggle',
        title: 'Grid or List',
        content: 'Grid shows one card per schedule with its health at a glance. List packs everything into compact rows when you have a lot of drafts.',
        placement: 'bottom'
      },
      {
        target: '.cs-new-btn',
        title: 'Generate Schedule',
        content: 'Ready to build? Click here to enter the automated scheduler and start assigning courses to rooms and faculty.',
        placement: 'left'
      }
    ]

    if (schedules.length > 0) {
      steps.push(
        {
          target: '.tour-btn-view',
          title: 'View Schedule',
          content: 'Open this schedule to inspect its timetable, or start manually assigning faculty to courses.',
          placement: 'bottom'
        },
        {
          target: '.tour-btn-analytics',
          title: 'Schedule Analytics',
          content: 'Jump straight to the analytics for this exact schedule: readiness, conflicts, unassigned courses, instructor load and room usage. Works for any schedule, not just the active queue one.',
          placement: 'bottom'
        },
        {
          target: '.tour-btn-rename',
          title: 'Rename Draft',
          content: 'Give your draft a clear name (like "Scenario A - Heavy Loading") so you can tell your experiments apart.',
          placement: 'bottom'
        },
        {
          target: '.tour-btn-duplicate',
          title: 'Duplicate Schedule',
          content: 'Want to try a different arrangement without ruining a good draft? Duplicate it first to safely experiment.',
          placement: 'bottom'
        },
        {
          target: '.tour-btn-submit',
          title: 'Submit for Review',
          content: 'When your draft is perfect, hit Submit! This sends the schedule straight to the Dean for approval. Make sure you\'re ready — you can\'t edit it again unless you recall it.',
          placement: 'top'
        },
        {
          target: '.tour-btn-delete',
          title: 'Delete Draft',
          content: 'Clean up drafts you no longer need. (Note: Only drafts can be deleted; submitted/approved ones are locked).',
          placement: 'bottom'
        }
      )
    } else {
      steps.push({
        target: '#tour-schedules-list',
        title: 'Your Schedules',
        content: 'Once you generate a schedule, it will appear here. You\'ll be able to view, analyse, rename, submit, or delete it.',
        placement: 'bottom'
      })
    }

    if (activeQueueId) {
      steps.push({
        target: '#tour-queue-audit-trail-my',
        title: 'Queue Audit Trail',
        content: 'Track all actions happening in the live queue in real-time right here.',
        placement: 'top'
      })
    }

    return steps
  }, [schedules.length, activeQueueId])

  const masterTabTourSteps = useMemo(() => {
    const steps = [
      {
        target: '[data-tour="main-tabs"]',
        title: 'My Schedules vs Master Schedules',
        content: 'This page has two tabs. "My Schedules" shows all the draft/submitted/approved schedules you have generated. Switch to "Master Schedules" to see the combined timetable for the entire institution.',
        disableBeacon: true,
        placement: 'bottom',
      },
    ]
    if (hasApprovedInQueue) {
      steps.push({
        target: '[data-tour="master-active-queue"]',
        title: 'Active Queue Combined Master',
        content: 'This card links to the live combined schedule of every program approved so far in the current queue — all programs on one timetable so you can see the full picture.',
        placement: 'bottom',
      })
    }
    steps.push({
      target: '[data-tour="master-finalized"]',
      title: 'Finalized Master Schedules',
      content: hasApprovedInQueue
        ? 'Below the active queue card you will find permanently finalized master schedules from past rounds. Click any entry to open its full read-only timetable.'
        : 'Once a round is completed and finalized by the admin, the final merged timetable appears here. Click any entry to open its full schedule view. When a round is active, an "Active Queue Combined Master" card will also appear above this section.',
      placement: 'bottom',
    })
    return steps
  }, [hasApprovedInQueue])

  const { TourElement } = useTour('coordSchedules', tourSteps, !loading, { isPrimary: mainTab === 'my' })
  const { TourElement: MasterTourElement } = useTour('coordSchedulesMaster', masterTabTourSteps, mainTab === 'master' && !loading, { isPrimary: mainTab === 'master' })

  /* ── Render ── */
  const shared = { mode: viewMode, health, selected, submitInfo, onToggle: toggleOne, onToggleMany: toggleMany, actions }

  const renderRows = (sec) => {
    const limit = showAll[sec.key] ? sec.rows.length : INITIAL_VISIBLE
    return (
      <>
        <Collection rows={sec.rows.slice(0, limit)} {...shared} />
        {sec.rows.length > INITIAL_VISIBLE && (
          <button className="cs-btn cs-btn-outline cs-more" onClick={() => setShowAll(p => ({ ...p, [sec.key]: !p[sec.key] }))}>
            {showAll[sec.key] ? 'Show fewer' : `Show all ${sec.rows.length}`}
          </button>
        )}
      </>
    )
  }

  const noFilters = filter === 'all' && termFilter === 'all' && !search.trim()

  return (
    <div className="cs-page">
      <Toast msg={toast} onClose={closeToast} />
      {TourElement}
      {MasterTourElement}

      <div className="cs-topbar">
        <div className="cs-seg cs-tabs" data-tour="main-tabs">
          <button className={`cs-seg-btn${mainTab === 'my' ? ' on' : ''}`} onClick={() => setMainTab('my')}>My Schedules</button>
          <button className={`cs-seg-btn${mainTab === 'master' ? ' on' : ''}`} onClick={() => setMainTab('master')}>Master Schedules</button>
        </div>
        {mainTab === 'my' && (
          <button className="cs-btn cs-btn-primary cs-new-btn" onClick={() => navigate('/coordinator/scheduler')}>
            <Ico size={13}><line x1="12" y1="5" x2="12" y2="19"/><line x1="5" y1="12" x2="19" y2="12"/></Ico>
            New Schedule
          </button>
        )}
      </div>

      {mainTab === 'master' ? (
        <MasterSchedulesTab navigate={navigate} roundTerm={roundTerm} hasQueue={hasApprovedInQueue} />
      ) : (
        <div id="tour-schedules-list" className="cs-stack">
          {/* Toolbar: filter on the left, find/sort/view on the right. Swaps to a bulk bar while drafts are selected. */}
          {selectionMode ? (
            <div className="cs-bulk">
              <Check checked={allSel} indeterminate={someSel} onChange={() => toggleMany(view.draftIds, !allSel)} label="Select all visible drafts" />
              <span className="cs-bulk-text">{selCount} selected</span>
              <button className="cs-btn cs-btn-outline cs-btn-sm" onClick={() => setSelected(new Set())}>Clear</button>
              <button className="cs-btn cs-btn-danger cs-btn-sm" disabled={busy} onClick={() => setConfirmModal({ action: 'bulkDelete' })}>Delete {selCount}</button>
            </div>
          ) : (
            <div className="cs-toolbar">
              <div className="cs-seg cs-status-filter">
                {['all', 'draft', 'submitted', 'approved'].map(f => (
                  <button key={f} className={`cs-seg-btn${filter === f ? ' on' : ''}`} onClick={() => setFilter(f)}>
                    {f.charAt(0).toUpperCase() + f.slice(1)}<i>{counts[f]}</i>
                  </button>
                ))}
              </div>
              <div className="cs-grow"><input className="cs-input" value={search} onChange={e => setSearch(e.target.value)} placeholder="Search schedules" aria-label="Search schedules" /></div>
              {termOptions.length > 0 && (
                <select className="cs-select cs-term-filter" value={termFilter} onChange={e => setTermFilter(e.target.value)} aria-label="Filter by term">
                  <option value="all">All terms</option>
                  {termOptions.map(t => <option key={t.key} value={t.key}>{t.label}</option>)}
                </select>
              )}
              <select className="cs-select" value={sortBy} onChange={e => setSortBy(e.target.value)} aria-label="Sort schedules">
                <option value="newest">Newest first</option>
                <option value="oldest">Oldest first</option>
                <option value="name">Name (A–Z)</option>
                <option value="events">Most sessions</option>
              </select>
              <div className="cs-seg cs-view-toggle">
                <button className={`cs-seg-btn${viewMode === 'grid' ? ' on' : ''}`} onClick={() => changeView('grid')}>Grid</button>
                <button className={`cs-seg-btn${viewMode === 'list' ? ' on' : ''}`} onClick={() => changeView('list')}>List</button>
              </div>
            </div>
          )}

          {/* Content */}
          {loading ? (
            viewMode === 'grid'
              ? <div className="cs-grid">{[...Array(6)].map((_, i) => <div key={i} className="cs-skel" style={{ height: 250, borderRadius: 12, opacity: 1 - i * 0.12 }} />)}</div>
              : <div className="cs-stack" style={{ gap: 8 }}>{[...Array(5)].map((_, i) => <div key={i} className="cs-skel" style={{ height: 46, borderRadius: 8, opacity: 1 - i * 0.15 }} />)}</div>
          ) : view.filtered.length === 0 && !view.active ? (
            <div className="cs-empty">
              <span>{search ? 'No schedules match your search.' : !noFilters ? 'No schedules match these filters.' : 'No schedules yet. Generate one from the Scheduler.'}</span>
              {noFilters && <button className="cs-btn cs-btn-primary" onClick={() => navigate('/coordinator/scheduler')}>Go to Scheduler</button>}
            </div>
          ) : (
            <>
              {view.active && (
                <section className="cs-section">
                  <div className="cs-section-head">
                    <h2>{view.active.label}</h2>
                    <span className="cs-pill ok">Active term</span>
                    <span className="cs-count">{view.active.rows.length}</span>
                    {activeQueueId && (
                      <span className={`cs-pill ${isMyTurn ? 'ok' : 'warn'}`} style={{ marginLeft: 'auto' }}>
                        {isMyTurn ? 'Your turn to submit' : 'Waiting for your turn'}
                      </span>
                    )}
                  </div>
                  {view.active.rows.length === 0
                    ? <div className="cs-empty slim">No schedules for this term yet.</div>
                    : renderRows(view.active)}
                </section>
              )}

              {activeQueueId && (
                <div id="tour-queue-audit-trail-my">
                  <QueueAuditTrail queueId={activeQueueId} />
                </div>
              )}

              {view.past.length > 0 && (
                <div className="cs-stack" style={{ gap: 12 }}>
                  <h2 className="cs-groups-title" style={{ marginBottom: 0 }}>{activeTermKey ? 'Past terms' : 'Terms'}</h2>
                  {view.past.map((sec, idx) => {
                    const isOpen = openPast[sec.key] ?? idx === 0
                    const nApproved = sec.rows.filter(x => x.status === 'approved').length
                    const nDraft = sec.rows.filter(x => x.status === 'draft').length
                    return (
                      <section key={sec.key} className="cs-section">
                        <button className="cs-fold" aria-expanded={isOpen} onClick={() => setOpenPast(p => ({ ...p, [sec.key]: !isOpen }))}>
                          <span className="cs-caret">{isOpen ? '▾' : '▸'}</span>
                          <h2>{sec.label}</h2>
                          <span className="cs-count">{sec.rows.length}</span>
                          <span className="cs-meta">{[nApproved && `${nApproved} approved`, nDraft && `${nDraft} draft${nDraft > 1 ? 's' : ''}`].filter(Boolean).join(', ')}</span>
                        </button>
                        {isOpen && renderRows(sec)}
                      </section>
                    )
                  })}
                </div>
              )}
            </>
          )}
        </div>
      )}

      <ConfirmDialog
        modal={confirmModal} count={selCount} busy={busy}
        onCancel={() => setConfirmModal(null)} onConfirm={confirmAction}
      />
    </div>
  )
}