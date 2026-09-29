import { useState, useMemo, useEffect, useRef } from 'react'
import { createPortal } from 'react-dom'
import { TV } from './svPrimitives'
import {
  DAYS, sectionColor, parsePeriodRange, minutesToTimeLabel, getEventId,
  areMergePartners, getConflictTypes, timeOverlaps,
  getFacultyPreference, checkPreferenceViolation, formatPreferenceSummary,
} from './svHelpers'

/* ── Inject styles (always overwrite so stale/HMR style tags never win) ─────── */
let _fimStyle = document.getElementById('fim-style')
if (!_fimStyle) {
  _fimStyle = document.createElement('style')
  _fimStyle.id = 'fim-style'
  document.head.appendChild(_fimStyle)
}
_fimStyle.textContent = `
  @keyframes fim-in   { from{opacity:0;transform:translateY(10px) scale(.97)} to{opacity:1;transform:none} }
  @keyframes fim-fade { from{opacity:0} to{opacity:1} }

  .fim-overlay {
    position:fixed; inset:0; z-index:10050; padding:20px;
    display:flex; align-items:center; justify-content:center;
    background:rgba(15,23,42,.55); backdrop-filter:blur(3px);
    animation:fim-fade .15s ease;
  }
  .fim-card {
    width:600px; max-width:100%; max-height:88vh;
    display:flex; flex-direction:column; overflow:hidden;
    border-radius:18px; background:var(--surface);
    border:1px solid var(--fim-border);
    box-shadow:0 28px 80px rgba(0,0,0,.34);
    font-family:Inter,sans-serif; color:var(--fim-text);
    animation:fim-in .2s cubic-bezier(.4,0,.2,1);
  }

  /* Hero */
  .fim-hero { position:relative; flex-shrink:0; padding:20px 22px 18px; color:#fff; overflow:hidden; }
  .fim-hero::after {
    content:''; position:absolute; right:-46px; top:-46px;
    width:170px; height:170px; border-radius:50%; background:rgba(255,255,255,.09);
    pointer-events:none;
  }
  .fim-hero-row { position:relative; z-index:1; display:flex; align-items:center; gap:14px; }
  .fim-avatar {
    width:54px; height:54px; border-radius:16px; flex-shrink:0;
    display:flex; align-items:center; justify-content:center;
    background:rgba(255,255,255,.2); border:1px solid rgba(255,255,255,.3);
    font-size:18px; font-weight:800; letter-spacing:.5px;
  }
  .fim-name { margin:0; font-size:16.5px; font-weight:800; line-height:1.25; letter-spacing:.1px; }
  .fim-rank { margin:2px 0 0; font-size:12px; font-weight:500; opacity:.85; }
  .fim-pills { position:relative; z-index:1; display:flex; flex-wrap:wrap; gap:6px; margin-top:14px; }
  .fim-pill {
    display:inline-flex; align-items:center; gap:5px; padding:3px 10px; border-radius:99px;
    font-size:10.5px; font-weight:700; letter-spacing:.2px;
    background:rgba(255,255,255,.18); border:1px solid rgba(255,255,255,.3); color:#fff;
  }
  .fim-close {
    position:absolute; top:12px; right:12px; z-index:2;
    width:30px; height:30px; border-radius:9px; border:none; cursor:pointer;
    display:flex; align-items:center; justify-content:center;
    background:rgba(255,255,255,.16); color:#fff; transition:background .12s;
  }
  .fim-close:hover { background:rgba(255,255,255,.3); }

  /* Compact hero on the schedule tab: one row, frees ~70px for the grid */
  .fim-hero.compact { padding:12px 58px 12px 18px; display:flex; align-items:center; flex-wrap:wrap; gap:8px 16px; }
  .fim-hero.compact .fim-avatar { width:38px; height:38px; border-radius:11px; font-size:14px; }
  .fim-hero.compact .fim-rank { margin-top:0; font-size:11px; }
  .fim-hero.compact .fim-pills { margin:0 0 0 auto; }
  .fim-hero.compact::after { width:120px; height:120px; right:-36px; top:-50px; }

  /* Body */
  .fim-body { flex:1; min-height:0; overflow-y:auto; padding:18px 22px 8px; display:flex; flex-direction:column; gap:18px; }
  .fim-tiles { display:grid; grid-template-columns:repeat(3,1fr); gap:10px; }
  .fim-tile { background:var(--bg); border:1px solid var(--fim-border); border-radius:12px; padding:10px 12px; min-width:0; }
  .fim-label { font-size:9.5px; font-weight:700; letter-spacing:.7px; text-transform:uppercase; color:var(--fim-muted); }
  .fim-tile-val { margin-top:5px; font-size:16px; font-weight:800; line-height:1.15; }
  .fim-tile-sub { margin-top:3px; font-size:10.5px; font-weight:600; color:var(--fim-muted); }
  .fim-bar { margin-top:7px; height:4px; border-radius:99px; background:var(--hover); overflow:hidden; }
  .fim-bar > i { display:block; height:100%; border-radius:99px; }

  .fim-section-head { display:flex; align-items:center; gap:8px; margin-bottom:9px; }
  .fim-count {
    padding:1px 8px; border-radius:99px; font-size:10px; font-weight:700;
    background:var(--hover); color:var(--fim-muted);
  }
  .fim-grid { display:grid; grid-template-columns:1fr 1fr; gap:8px; }
  .fim-field { background:var(--bg); border:1px solid var(--fim-border); border-radius:10px; padding:8px 12px; min-width:0; }
  .fim-field.wide { grid-column:1 / -1; }
  .fim-field-val { margin-top:3px; font-size:12.5px; font-weight:600; overflow:hidden; text-overflow:ellipsis; white-space:nowrap; }

  /* Specializations */
  .fim-search { position:relative; margin-bottom:9px; }
  .fim-search input {
    width:100%; box-sizing:border-box; height:32px; padding:0 12px 0 32px;
    border-radius:9px; border:1px solid var(--fim-border); background:var(--bg);
    font-size:12px; font-family:inherit; color:var(--fim-text); outline:none;
  }
  .fim-search input:focus { border-color:var(--meadow); }
  .fim-search svg { position:absolute; left:10px; top:50%; transform:translateY(-50%); pointer-events:none; }
  .fim-spec-list { border:1px solid var(--fim-border); border-radius:12px; overflow:hidden; }
  .fim-spec {
    display:flex; align-items:center; gap:10px; padding:9px 12px;
    border-bottom:1px solid var(--hover); background:var(--surface);
  }
  .fim-spec:last-child { border-bottom:none; }
  .fim-spec.match { background:var(--meadow-soft); }
  .fim-code {
    flex-shrink:0; padding:2px 8px; border-radius:6px; background:var(--hover);
    font-family:'IBM Plex Mono',ui-monospace,monospace; font-size:10.5px; font-weight:600;
  }
  .fim-spec.match .fim-code { background:var(--surface); }
  .fim-spec-title { flex:1; min-width:0; font-size:12px; font-weight:500; overflow:hidden; text-overflow:ellipsis; white-space:nowrap; }
  .fim-meter { display:inline-flex; gap:2px; flex-shrink:0; }
  .fim-meter i { display:block; width:12px; height:5px; border-radius:99px; }
  .fim-rate { flex-shrink:0; width:104px; display:flex; flex-direction:column; align-items:flex-end; gap:3px; }
  .fim-rate span.t { font-size:9.5px; font-weight:700; white-space:nowrap; }
  .fim-tag {
    flex-shrink:0; padding:1px 7px; border-radius:99px; font-size:9px; font-weight:800;
    letter-spacing:.4px; text-transform:uppercase;
  }
  .fim-empty { padding:22px 12px; text-align:center; font-size:12px; color:var(--fim-muted); }

  /* Footer */
  .fim-foot {
    flex-shrink:0; display:flex; align-items:center; justify-content:flex-end; gap:10px;
    padding:14px 22px; border-top:1px solid var(--fim-border); background:var(--surface);
  }
  .fim-btn {
    height:36px; padding:0 16px; border-radius:10px; cursor:pointer;
    font-family:inherit; font-size:12.5px; font-weight:700; transition:filter .12s, background .12s;
    display:inline-flex; align-items:center; gap:6px;
  }
  .fim-btn.ghost { background:transparent; border:1px solid var(--fim-border); color:var(--fim-text); }
  .fim-btn.ghost:hover { background:var(--hover); }
  .fim-btn.primary { border:none; color:#fff; background:linear-gradient(135deg,var(--meadow),var(--fim-deep)); }
  .fim-btn.primary:hover { filter:brightness(1.07); }
  .fim-btn.primary:disabled { opacity:.55; cursor:default; filter:none; }

  /* Small "i" button used inside the session modal's faculty rows */
  .fim-info-btn {
    width:20px; height:20px; padding:0; flex-shrink:0; border-radius:50%; cursor:pointer;
    display:inline-flex; align-items:center; justify-content:center;
    background:transparent; color:inherit; opacity:.6;
    border:1px solid rgba(148,163,184,.55);
    transition:opacity .12s, background .12s, border-color .12s, color .12s;
  }
  .fim-info-btn:hover, .fim-info-btn:focus-visible {
    opacity:1; color:#7C3AED; background:rgba(139,92,246,.14); border-color:rgba(139,92,246,.6); outline:none;
  }

  /* Card grows when the schedule tab is open */
  .fim-card { transition:width .2s cubic-bezier(.4,0,.2,1), height .2s cubic-bezier(.4,0,.2,1); }
  .fim-card.wide { width:880px; height:min(88vh, 780px); }
  .fim-card.wide.max { width:min(1240px, 100%); height:min(94vh, 980px); max-height:94vh; }

  /* Schedule tab: fixed top (summary + toolbar), scrolling grid, pinned legend/detail */
  .fim-body.sched { overflow:hidden; padding:14px 22px 0; gap:10px; }
  .fim-sched-top { flex-shrink:0; display:flex; flex-direction:column; gap:10px; }
  .fim-sched-scroll { flex:1; min-height:0; overflow-y:auto; overscroll-behavior:contain; border-radius:12px; }
  .fim-sched-bottom { flex-shrink:0; padding-bottom:14px; }
  .fim-sched-bottom .fim-detail { max-height:150px; overflow-y:auto; }
  .fim-strip {
    display:flex; align-items:center; flex-wrap:wrap; gap:6px 16px; padding:9px 14px;
    border:1px solid var(--fim-border); border-radius:12px; background:var(--bg); font-size:12px; font-weight:600; color:var(--fim-muted);
  }
  .fim-strip b { color:var(--fim-text); font-weight:800; font-size:13.5px; }
  .fim-strip .sep { width:1px; align-self:stretch; background:var(--fim-border); }
  .fim-strip .pref { margin-left:auto; }
  .fim-strip .warn { color:#B45309; font-style:normal; }
  .fim-mini.icon { width:30px; padding:0; justify-content:center; }
  .fim-mini .chev { transition:transform .15s; }
  .fim-mini .chev.open { transform:rotate(180deg); }
  .fim-ok-chip { display:inline-flex; align-items:center; gap:6px; height:30px; padding:0 11px; border-radius:9px; font-size:11.5px; font-weight:700;
    border:1px solid rgba(34,197,94,.3); background:var(--meadow-soft); color:var(--meadow-text, #166534); }

  /* Tabs */
  .fim-tabs { flex-shrink:0; display:flex; gap:4px; padding:0 18px; border-bottom:1px solid var(--fim-border); background:var(--surface); }
  .fim-tab {
    position:relative; height:42px; padding:0 12px; border:none; background:transparent; cursor:pointer;
    font-family:inherit; font-size:12.5px; font-weight:700; color:var(--fim-muted);
    display:inline-flex; align-items:center; gap:7px; transition:color .12s;
  }
  .fim-tab:hover { color:var(--fim-text); }
  .fim-tab.on { color:var(--fim-text); }
  .fim-tab.on::after { content:''; position:absolute; left:8px; right:8px; bottom:-1px; height:2px; border-radius:2px; background:var(--meadow); }
  .fim-tab-badge {
    min-width:17px; height:17px; padding:0 5px; border-radius:99px; box-sizing:border-box;
    display:inline-flex; align-items:center; justify-content:center; gap:3px;
    font-size:9.5px; font-weight:800; background:var(--hover); color:var(--fim-muted);
  }
  .fim-tab-badge.bad { background:rgba(239,68,68,.14); color:#DC2626; }

  /* Schedule: tiles, banners, toolbar */
  .fim-tiles.four { grid-template-columns:repeat(4,1fr); }
  .fim-banner {
    display:flex; align-items:center; gap:8px; flex-wrap:wrap; padding:8px 12px; border-radius:10px;
    background:var(--bg); border:1px solid var(--fim-border); font-size:11.5px; font-weight:600;
  }
  .fim-banner b { font-weight:800; }
  .fim-cf { border:1px solid rgba(239,68,68,.35); background:rgba(239,68,68,.06); border-radius:12px; overflow:hidden; }
  .fim-cf-h { display:flex; align-items:center; gap:8px; padding:9px 12px; font-size:12px; font-weight:800; color:#DC2626; }
  .fim-cf-h span.s { margin-left:auto; font-size:10.5px; font-weight:600; opacity:.8; }
  .fim-cf-list { max-height:min(180px, 22vh); overflow-y:auto; border-top:1px solid rgba(239,68,68,.2); }
  .fim-cf-row {
    display:flex; flex-direction:column; gap:5px; width:100%; text-align:left; padding:8px 12px;
    border:none; border-bottom:1px solid rgba(239,68,68,.14); background:transparent; cursor:pointer;
    font-family:inherit; color:var(--fim-text);
  }
  .fim-cf-row:last-child { border-bottom:none; }
  .fim-cf-row:hover { background:rgba(239,68,68,.08); }
  .fim-cf-line { display:flex; align-items:center; gap:8px; flex-wrap:wrap; font-size:11.5px; }
  .fim-cf-vs { font-size:11px; color:var(--fim-muted); font-weight:600; }
  .fim-ok {
    display:flex; align-items:center; gap:8px; padding:9px 12px; border-radius:12px;
    border:1px solid rgba(34,197,94,.3); background:var(--meadow-soft);
    font-size:12px; font-weight:700; color:var(--meadow-text, #166534);
  }
  .fim-toolbar { display:flex; align-items:center; gap:8px; flex-wrap:wrap; }
  .fim-toolbar .grow { flex:1; }
  .fim-seg { display:inline-flex; padding:2px; border-radius:9px; background:var(--hover); border:1px solid var(--fim-border); }
  .fim-seg button {
    height:26px; padding:0 10px; border:none; border-radius:7px; background:transparent; cursor:pointer;
    font-family:inherit; font-size:11.5px; font-weight:700; color:var(--fim-muted);
    display:inline-flex; align-items:center; gap:5px; transition:background .12s, color .12s;
  }
  .fim-seg button.on { background:var(--surface); color:var(--fim-text); box-shadow:0 1px 3px rgba(0,0,0,.16); }
  .fim-mini {
    height:30px; padding:0 11px; border-radius:9px; cursor:pointer; background:transparent;
    border:1px solid var(--fim-border); color:var(--fim-text); font-family:inherit; font-size:11.5px; font-weight:700;
    display:inline-flex; align-items:center; gap:6px; transition:background .12s, border-color .12s;
  }
  .fim-mini:hover { background:var(--hover); }
  .fim-mini.on { background:rgba(239,68,68,.1); border-color:rgba(239,68,68,.45); color:#DC2626; }

  /* Week grid */
  .fim-wk { border:1px solid var(--fim-border); border-radius:12px; overflow:clip; background:var(--surface); }
  .fim-wk-head { position:sticky; top:0; z-index:10; display:grid; border-bottom:1px solid var(--fim-border); background:var(--bg); }
  .fim-wk-head > div { padding:7px 4px; text-align:center; font-size:10px; font-weight:800; letter-spacing:.6px; text-transform:uppercase; color:var(--fim-muted); }
  .fim-wk-body { display:grid; position:relative; z-index:0; isolation:isolate; }
  .fim-wk-time { position:relative; }
  .fim-wk-time span { position:absolute; right:6px; font-size:9.5px; font-weight:600; color:var(--fim-muted); white-space:nowrap; }
  .fim-wk-col { position:relative; border-left:1px solid var(--hover); }
  .fim-wk-line { position:absolute; left:0; right:0; height:0; border-top:1px solid var(--hover); }
  .fim-off {
    position:absolute; left:0; right:0; pointer-events:none;
    background:repeating-linear-gradient(135deg, rgba(148,163,184,.2) 0 5px, transparent 5px 10px);
  }
  .fim-blk {
    position:absolute; box-sizing:border-box; border-radius:7px; padding:3px 6px; overflow:hidden; cursor:pointer;
    text-align:left; font-family:inherit; line-height:1.25; border-width:1px; border-style:solid;
    transition:box-shadow .12s, transform .12s;
  }
  .fim-blk:hover { z-index:5; box-shadow:0 4px 14px rgba(0,0,0,.22); }
  .fim-blk.bad { border-color:#EF4444 !important; box-shadow:0 0 0 1.5px #EF4444; }
  .fim-blk.sel { z-index:6; box-shadow:0 0 0 2px var(--fim-text), 0 6px 18px rgba(0,0,0,.25); }
  .fim-blk .c { font-size:10.5px; font-weight:800; white-space:nowrap; overflow:hidden; text-overflow:ellipsis; padding-right:14px; }
  .fim-blk .t { font-size:9.5px; font-weight:600; opacity:.85; white-space:nowrap; overflow:hidden; text-overflow:ellipsis; }
  .fim-mark {
    position:absolute; top:3px; right:3px; width:13px; height:13px; border-radius:50%;
    display:flex; align-items:center; justify-content:center; color:#fff; font-size:9px; font-weight:800;
  }
  .fim-legend { display:flex; align-items:center; flex-wrap:wrap; gap:14px; margin-top:8px; font-size:10.5px; font-weight:600; color:var(--fim-muted); }
  .fim-legend i { display:inline-block; width:12px; height:12px; border-radius:4px; margin-right:5px; vertical-align:-2px; box-sizing:border-box; }

  /* Detail card */
  .fim-detail { margin-top:10px; border:1px solid var(--fim-border); border-radius:12px; padding:12px 14px; background:var(--bg); display:flex; flex-direction:column; gap:9px; }
  .fim-detail-top { display:flex; align-items:flex-start; gap:10px; }
  .fim-x { width:24px; height:24px; border-radius:7px; border:none; background:var(--hover); color:var(--fim-muted); cursor:pointer; display:flex; align-items:center; justify-content:center; flex-shrink:0; }
  .fim-x:hover { color:var(--fim-text); }
  .fim-chips { display:flex; flex-wrap:wrap; gap:6px; }
  .fim-chip {
    display:inline-flex; align-items:center; gap:5px; padding:2px 8px; border-radius:6px;
    background:var(--hover); font-size:10.5px; font-weight:600; color:var(--fim-text); white-space:nowrap;
  }
  .fim-tag.red   { background:rgba(239,68,68,.14); color:#DC2626; }
  .fim-tag.amber { background:rgba(245,158,11,.16); color:#B45309; }
  .fim-tag.blue  { background:rgba(96,165,250,.18); color:#2563EB; }

  /* List view */
  .fim-days { display:flex; flex-direction:column; gap:10px; }
  .fim-day { border:1px solid var(--fim-border); border-radius:12px; overflow:hidden; background:var(--surface); }
  .fim-day-h { display:flex; align-items:center; gap:8px; padding:8px 12px; background:var(--bg); border-bottom:1px solid var(--fim-border); }
  .fim-day-h .n { font-size:12px; font-weight:800; }
  .fim-day-h .s { margin-left:auto; font-size:10.5px; font-weight:600; color:var(--fim-muted); }
  .fim-row { display:flex; gap:11px; padding:10px 12px; border-bottom:1px solid var(--hover); }
  .fim-row:last-child { border-bottom:none; }
  .fim-row.bad { background:rgba(239,68,68,.05); }
  .fim-stripe { width:3px; align-self:stretch; border-radius:3px; flex-shrink:0; }
  .fim-row-time { flex-shrink:0; width:112px; font-family:'IBM Plex Mono',ui-monospace,monospace; font-size:10.5px; font-weight:600; line-height:1.5; }
  .fim-row-time small { display:block; font-family:Inter,sans-serif; font-size:10px; font-weight:600; color:var(--fim-muted); }
  .fim-row-main { flex:1; min-width:0; display:flex; flex-direction:column; gap:5px; }
  .fim-row-title { display:flex; align-items:center; gap:8px; min-width:0; }
  .fim-row-title .t { flex:1; min-width:0; font-size:12px; font-weight:600; overflow:hidden; text-overflow:ellipsis; white-space:nowrap; }
  .fim-gap { padding:3px 12px; background:var(--bg); border-bottom:1px solid var(--hover); font-size:10px; font-weight:600; color:var(--fim-muted); text-align:center; }
  .fim-note { font-size:11px; font-weight:600; color:var(--fim-muted); }
`

/* ── Helpers ─────────────────────────────────────────────────────────────── */
const HOME_DEPT_FALLBACK = 'CCS'

const RATING = {
  5: { label: 'Expert',            color: 'var(--meadow)' },
  4: { label: 'Highly Proficient', color: '#60A5FA' },
  3: { label: 'Competent',         color: 'var(--meadow)' },
  2: { label: 'Developing',        color: '#F59E0B' },
  1: { label: 'Beginner',          color: '#EF4444' },
}

const norm = v => String(v || '').replace(/\s+/g, ' ').trim()

/** { label, isHome } — a blank Department counts as the home department. */
export function deptInfo(dept, home = HOME_DEPT_FALLBACK) {
  const label = norm(dept) || home
  return { label, isHome: label.toUpperCase() === norm(home).toUpperCase() }
}

const fmtUnits = n => {
  const x = Number(n)
  if (!Number.isFinite(x)) return '0'
  return Number.isInteger(x) ? String(x) : x.toFixed(1)
}

const titleCase = s => norm(s).replace(/\b\w/g, c => c.toUpperCase())

function initialsOf(name) {
  const [last = '', first = ''] = String(name || '').split(',')
  const a = norm(first)[0] || ''
  const b = norm(last)[0] || ''
  return (a + b).toUpperCase() || (norm(name)[0] || '?').toUpperCase()
}

function normalizeSpecs(raw) {
  const arr = Array.isArray(raw) ? raw : []
  return arr
    .map(s => {
      if (typeof s === 'string') return { code: norm(s), title: '', rating: 3, unmatched: false }
      return {
        code:      norm(s?.courseCode),
        title:     norm(s?.title || s?.courseTitle),
        rating:    Math.min(5, Math.max(1, Math.round(Number(s?.rating) || 3))),
        unmatched: !!s?.isUnmatched,
      }
    })
    .filter(s => s.code || s.title)
}

/* ── Icons (self-contained) ──────────────────────────────────────────────── */
const svgProps = (size, color) => ({
  width: size, height: size, viewBox: '0 0 24 24', fill: 'none', stroke: color,
  strokeWidth: 2, strokeLinecap: 'round', strokeLinejoin: 'round', style: { flexShrink: 0 },
})
const IcInfo   = ({ size = 12, color = 'currentColor' }) => (
  <svg {...svgProps(size, color)}><circle cx="12" cy="12" r="10"/><line x1="12" y1="16" x2="12" y2="12"/><line x1="12" y1="8" x2="12.01" y2="8"/></svg>
)
const IcClose  = ({ size = 14, color = 'currentColor' }) => (
  <svg {...svgProps(size, color)}><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg>
)
const IcSearch = ({ size = 13, color = 'currentColor' }) => (
  <svg {...svgProps(size, color)}><circle cx="11" cy="11" r="8"/><line x1="21" y1="21" x2="16.65" y2="16.65"/></svg>
)
const IcCheck  = ({ size = 13, color = 'currentColor' }) => (
  <svg {...svgProps(size, color)}><polyline points="20 6 9 17 4 12"/></svg>
)
const IcLock   = ({ size = 11, color = 'currentColor' }) => (
  <svg {...svgProps(size, color)}><rect x="3" y="11" width="18" height="11" rx="2" ry="2"/><path d="M7 11V7a5 5 0 0 1 10 0v4"/></svg>
)

const IcCal    = ({ size = 13, color = 'currentColor' }) => (
  <svg {...svgProps(size, color)}><rect x="3" y="4" width="18" height="18" rx="2"/><line x1="16" y1="2" x2="16" y2="6"/><line x1="8" y1="2" x2="8" y2="6"/><line x1="3" y1="10" x2="21" y2="10"/></svg>
)
const IcAlert  = ({ size = 13, color = 'currentColor' }) => (
  <svg {...svgProps(size, color)}><path d="M10.29 3.86L1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z"/><line x1="12" y1="9" x2="12" y2="13"/><line x1="12" y1="17" x2="12.01" y2="17"/></svg>
)
const IcCopy   = ({ size = 13, color = 'currentColor' }) => (
  <svg {...svgProps(size, color)}><rect x="9" y="9" width="13" height="13" rx="2"/><path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1"/></svg>
)
const IcGrid   = ({ size = 12, color = 'currentColor' }) => (
  <svg {...svgProps(size, color)}><rect x="3" y="3" width="7" height="7"/><rect x="14" y="3" width="7" height="7"/><rect x="14" y="14" width="7" height="7"/><rect x="3" y="14" width="7" height="7"/></svg>
)
const IcMax    = ({ size = 13, color = 'currentColor' }) => (
  <svg {...svgProps(size, color)}><polyline points="15 3 21 3 21 9"/><polyline points="9 21 3 21 3 15"/><line x1="21" y1="3" x2="14" y2="10"/><line x1="3" y1="21" x2="10" y2="14"/></svg>
)
const IcMin    = ({ size = 13, color = 'currentColor' }) => (
  <svg {...svgProps(size, color)}><polyline points="4 14 10 14 10 20"/><polyline points="20 10 14 10 14 4"/><line x1="14" y1="10" x2="21" y2="3"/><line x1="3" y1="21" x2="10" y2="14"/></svg>
)
const IcChev   = ({ size = 12, color = 'currentColor', className }) => (
  <svg {...svgProps(size, color)} className={className}><polyline points="6 9 12 15 18 9"/></svg>
)
const IcList   = ({ size = 12, color = 'currentColor' }) => (
  <svg {...svgProps(size, color)}><line x1="8" y1="6" x2="21" y2="6"/><line x1="8" y1="12" x2="21" y2="12"/><line x1="8" y1="18" x2="21" y2="18"/><line x1="3" y1="6" x2="3.01" y2="6"/><line x1="3" y1="12" x2="3.01" y2="12"/><line x1="3" y1="18" x2="3.01" y2="18"/></svg>
)

/* ── Schedule helpers ────────────────────────────────────────────────────── */
const RED = '#EF4444'
const AMBER = '#F59E0B'

const fmtDur = mins => {
  const h = Math.floor(mins / 60), m = mins % 60
  return h && m ? `${h}h ${m}m` : h ? `${h}h` : `${m}m`
}
const fmtHours = mins => {
  const h = mins / 60
  return Number.isInteger(h) ? String(h) : h.toFixed(1)
}
const rangeLabel = r => (r ? `${minutesToTimeLabel(r.start)} – ${minutesToTimeLabel(r.end)}` : '')
const secLabel = e => {
  const yb = e.year && e.block ? `${e.year}-${e.block}` : ''
  return [e.program, yb].filter(Boolean).join(' ')
}
const uniq = arr => [...new Set(arr.filter(Boolean))]
const dayKey3 = d => String(d || '').slice(0, 3).toLowerCase()

const TYPE_TEXT = { Faculty: 'Double-booked', Room: 'Room clash', Section: 'Section clash' }

function describeGroup(g) {
  return { code: g.courseCode, title: g.title, sections: g.sections, room: g.room, range: g.range, faculty: g.facultyName }
}

/**
 * Builds one faculty member's schedule from the full event list.
 *  - merged sections (same course / day / period / room) collapse into one entry
 *  - conflicts use the same rules as the schedule view (getConflictTypes + areMergePartners)
 *  - part-time preference violations come from getFacultyPreference()
 */
function buildFacultySchedule(allEvents, facultyName, pref) {
  const mine = allEvents.filter(e => e && e.faculty === facultyName)
  const map = new Map()
  const unscheduled = []

  for (const ev of mine) {
    const range = parsePeriodRange(ev.period)
    if (!range || !DAYS.includes(ev.day)) { unscheduled.push(ev); continue }
    const room = norm(ev.room)
    const key = room && room.toUpperCase() !== 'TBA'
      ? `${ev.day}|${ev.period}|${room}|${ev.courseCode}`
      : `id:${getEventId(ev)}`
    let g = map.get(key)
    if (!g) {
      g = {
        key, day: ev.day, period: ev.period, range, room: room || 'TBA',
        courseCode: norm(ev.courseCode), title: norm(ev.title || ev.courseTitle),
        units: Number(ev.units) || 0, facultyName,
        events: [], ids: new Set(), sections: [], conflicts: [], types: new Set(), pref: null,
      }
      map.set(key, g)
    }
    g.events.push(ev)
    g.ids.add(getEventId(ev))
  }

  const groups = [...map.values()]
  groups.forEach(g => {
    g.sections = uniq(g.events.map(secLabel)).sort()
    g.pref = checkPreferenceViolation(pref, g.day, g.range.start, g.range.end)
  })
  groups.sort((a, b) => DAYS.indexOf(a.day) - DAYS.indexOf(b.day) || a.range.start - b.range.start)

  // conflicts
  const idToGroup = new Map()
  groups.forEach(g => g.ids.forEach(id => idToGroup.set(id, g)))
  const pairs = new Map()

  for (const g of groups) {
    for (const ea of g.events) {
      for (const eb of allEvents) {
        if (!eb || eb.day !== g.day) continue
        const idb = getEventId(eb)
        if (g.ids.has(idb)) continue
        const rb = parsePeriodRange(eb.period)
        if (!rb || !timeOverlaps(g.range, rb)) continue
        if (areMergePartners(ea, eb)) continue
        const types = getConflictTypes(ea, eb)
        if (!types.length) continue

        const og = idToGroup.get(idb) || null
        const peerKey = og ? og.key : `x|${eb.courseCode}|${eb.day}|${eb.period}|${eb.room}|${eb.faculty}`
        const pk = [g.key, peerKey].sort().join('##')
        let p = pairs.get(pk)
        if (!p) {
          p = { id: pk, day: g.day, types: new Set(), a: g, ownPeer: og, peerEvents: [], peerIds: new Set() }
          pairs.set(pk, p)
        }
        types.forEach(t => p.types.add(t))
        if (!og && !p.peerIds.has(idb)) { p.peerEvents.push(eb); p.peerIds.add(idb) }
      }
    }
  }

  const pairList = [...pairs.values()]
  pairList.forEach(p => {
    let peerRange, peer
    if (p.ownPeer) {
      peer = describeGroup(p.ownPeer)
      peerRange = p.ownPeer.range
    } else {
      const e0 = p.peerEvents[0]
      peerRange = parsePeriodRange(e0.period)
      peer = {
        code: norm(e0.courseCode), title: norm(e0.title || e0.courseTitle),
        sections: uniq(p.peerEvents.map(secLabel)).sort(),
        room: norm(e0.room) || 'TBA', range: peerRange, faculty: norm(e0.faculty) || 'TBA',
      }
    }
    p.peer = peer
    p.overlap = { start: Math.max(p.a.range.start, peerRange.start), end: Math.min(p.a.range.end, peerRange.end) }
    p.a.conflicts.push(p); p.types.forEach(t => p.a.types.add(t))
    if (p.ownPeer) { p.ownPeer.conflicts.push(p); p.types.forEach(t => p.ownPeer.types.add(t)) }
  })
  pairList.sort((x, y) => DAYS.indexOf(x.day) - DAYS.indexOf(y.day) || x.overlap.start - y.overlap.start)

  const teachDays = DAYS.filter(d => groups.some(g => g.day === d))
  const freeDays = DAYS.filter(d => d !== 'Sunday' && !teachDays.includes(d))
  const totalMin = groups.reduce((s, g) => s + g.range.duration, 0)
  const sectionCount = uniq(groups.flatMap(g => g.sections)).length
  const prefCount = groups.filter(g => g.pref).length

  return { groups, pairs: pairList, unscheduled, teachDays, freeDays, totalMin, sectionCount, prefCount }
}

/** Greedy side-by-side lanes for overlapping blocks in one day column. */
function layoutDay(items) {
  const out = []
  let cluster = []
  let clusterEnd = -1
  const flush = () => {
    const lanes = Math.max(...cluster.map(c => c.lane)) + 1
    cluster.forEach(c => out.push({ ...c, lanes }))
    cluster = []
  }
  for (const g of items) {
    if (cluster.length && g.range.start >= clusterEnd) { flush(); clusterEnd = -1 }
    const used = new Set(cluster.filter(c => c.g.range.end > g.range.start).map(c => c.lane))
    let lane = 0
    while (used.has(lane)) lane++
    cluster.push({ g, lane })
    clusterEnd = Math.max(clusterEnd, g.range.end)
  }
  if (cluster.length) flush()
  return out
}

function groupColor(g) {
  const e = g.events[0] || {}
  const c = sectionColor(e.program, e.block)
  return { ...c, accent: c.accent || c.border }
}

function TypeTags({ types }) {
  return [...types].map(t => <span key={t} className="fim-tag red">{t}</span>)
}

/* ── Schedule tab body ───────────────────────────────────────────────────── */
const ROW_MIN = 22, ROW_MAX = 36 // px per 30 minutes; grid auto-fits between these
const HEAD_H = 30

function FacultySchedulePanel({ schedule, pref, facultyName, maxed, onToggleMax }) {
  const [view, setView] = useState('week')
  const [onlyConf, setOnlyConf] = useState(false)
  const [activeKey, setActiveKey] = useState(null)
  const [copied, setCopied] = useState(false)
  const [cfOpen, setCfOpen] = useState(false)

  const { groups, pairs, unscheduled, teachDays, freeDays, totalMin, sectionCount, prefCount } = schedule
  const shown = useMemo(() => (onlyConf ? groups.filter(g => g.conflicts.length) : groups), [groups, onlyConf])
  const active = groups.find(g => g.key === activeKey) || null

  const cols = useMemo(() => DAYS.filter(d => d !== 'Sunday' || teachDays.includes('Sunday')), [teachDays])

  const geo = useMemo(() => {
    let lo = Infinity, hi = -Infinity
    groups.forEach(g => { lo = Math.min(lo, g.range.start); hi = Math.max(hi, g.range.end) })
    if (!Number.isFinite(lo)) { lo = 8 * 60; hi = 17 * 60 }
    lo = Math.floor(lo / 60) * 60
    hi = Math.ceil(hi / 60) * 60
    if (hi - lo < 240) hi = lo + 240
    return { lo, hi }
  }, [groups])

  // Fit the whole day into the visible area when possible (scroll only if it can't)
  const scrollRef = useRef(null)
  const [availH, setAvailH] = useState(0)
  useEffect(() => {
    const el = scrollRef.current
    if (!el || typeof ResizeObserver === 'undefined') return
    const ro = new ResizeObserver(() => setAvailH(el.clientHeight))
    ro.observe(el); setAvailH(el.clientHeight)
    return () => ro.disconnect()
  }, [])
  const halfHours = (geo.hi - geo.lo) / 30
  const ROW_H = availH > 0
    ? Math.max(ROW_MIN, Math.min(ROW_MAX, Math.floor((availH - HEAD_H - 2) / halfHours)))
    : 30
  const px = m => ((m - geo.lo) * ROW_H) / 30
  const bodyH = px(geo.hi)
  const gridCols = `46px repeat(${cols.length}, minmax(0, 1fr))`
  const hours = []
  for (let m = geo.lo; m < geo.hi; m += 60) hours.push(m)

  const layouts = useMemo(() => {
    const o = {}
    cols.forEach(d => { o[d] = layoutDay(shown.filter(g => g.day === d)) })
    return o
  }, [cols, shown])

  const focusPair = p => { setView('week'); setOnlyConf(false); setActiveKey(p.a.key); setCfOpen(false) }

  const copyText = () => {
    const lines = [`Schedule: ${facultyName}`]
    teachDays.forEach(d => {
      lines.push('', d)
      groups.filter(g => g.day === d).forEach(g => {
        const flags = []
        if (g.types.size) flags.push(`CONFLICT: ${[...g.types].join(' + ')}`)
        if (g.pref) flags.push('outside preferred availability')
        lines.push(`  ${rangeLabel(g.range)}  ${g.courseCode}  ${g.sections.join(', ')}  ${g.room}${flags.length ? `  [${flags.join('; ')}]` : ''}`)
      })
    })
    lines.push('', `${groups.length} classes, ${fmtHours(totalMin)} h/week, ${pairs.length} conflict${pairs.length === 1 ? '' : 's'}`)
    const text = lines.join('\n')
    const done = () => { setCopied(true); setTimeout(() => setCopied(false), 1600) }
    if (navigator.clipboard?.writeText) navigator.clipboard.writeText(text).then(done).catch(() => {})
  }

  /* ── views ── */
  const weekView = (
      <div className="fim-wk">
        <div className="fim-wk-head" style={{ gridTemplateColumns: gridCols }}>
          <div />
          {cols.map(d => (
            <div key={d} style={teachDays.includes(d) ? { color: TV.text } : undefined}>{d.slice(0, 3)}</div>
          ))}
        </div>
        <div className="fim-wk-body" style={{ gridTemplateColumns: gridCols, height: bodyH }}>
          <div className="fim-wk-time">
            {hours.map((m, i) => (
              <span key={m} style={{ top: px(m), transform: i === 0 ? 'translateY(2px)' : 'translateY(-50%)' }}>
                {minutesToTimeLabel(m).replace(':00', '')}
              </span>
            ))}
          </div>
          {cols.map(d => {
            const dayOff = !!(pref?.hasDays && !pref.dayKeys.has(dayKey3(d)))
            return (
              <div key={d} className="fim-wk-col">
                {hours.map((m, i) => i > 0 && <div key={m} className="fim-wk-line" style={{ top: px(m) }} />)}
                {dayOff && <div className="fim-off" style={{ top: 0, bottom: 0 }} />}
                {!dayOff && pref?.start != null && pref.start > geo.lo && <div className="fim-off" style={{ top: 0, height: px(pref.start) }} />}
                {!dayOff && pref?.end != null && pref.end < geo.hi && <div className="fim-off" style={{ top: px(pref.end), bottom: 0 }} />}

                {layouts[d].map(({ g, lane, lanes }) => {
                  const col = groupColor(g)
                  const h = Math.max(px(g.range.end) - px(g.range.start) - 2, 18)
                  const bad = g.conflicts.length > 0
                  return (
                    <button
                      key={g.key} type="button"
                      className={`fim-blk${bad ? ' bad' : ''}${activeKey === g.key ? ' sel' : ''}`}
                      title={`${g.courseCode}${g.title ? ` – ${g.title}` : ''}\n${g.day} ${rangeLabel(g.range)}\n${g.sections.join(', ')} · ${g.room}${bad ? `\nConflict: ${[...g.types].join(' + ')}` : ''}${g.pref ? '\nOutside preferred availability' : ''}`}
                      onClick={() => setActiveKey(activeKey === g.key ? null : g.key)}
                      style={{
                        top: px(g.range.start) + 1, height: h,
                        left: `calc(${(lane / lanes) * 100}% + 2px)`, width: `calc(${100 / lanes}% - 4px)`,
                        background: col.bg, color: col.text, borderColor: col.border, borderLeft: `3px solid ${col.accent}`,
                      }}
                    >
                      <div className="c">{g.courseCode || 'Session'}</div>
                      {h >= 40 && <div className="t">{g.sections.join(', ')}</div>}
                      {h >= 56 && <div className="t">{g.room}</div>}
                      {bad ? <span className="fim-mark" style={{ background: RED }}>!</span>
                        : g.pref ? <span className="fim-mark" style={{ background: AMBER }}>~</span> : null}
                    </button>
                  )
                })}
              </div>
            )
          })}
        </div>
      </div>
  )

  const weekLegend = (
      <div className="fim-legend">
        <span><i style={{ border: `2px solid ${RED}` }} />Conflict</span>
        {pref && <span><i style={{ background: 'repeating-linear-gradient(135deg, rgba(148,163,184,.5) 0 3px, transparent 3px 6px)', border: '1px solid var(--fim-border)' }} />Outside preferred availability</span>}
        {pref && <span><i style={{ background: AMBER, borderRadius: '50%' }} />Off preference</span>}
        <span style={{ marginLeft: 'auto' }}>Click a block for details</span>
      </div>
  )

  const detailCard = (
    <>
      {active && (
        <div className="fim-detail">
          <div className="fim-detail-top">
            <span className="fim-stripe" style={{ background: groupColor(active).accent, alignSelf: 'stretch' }} />
            <div style={{ flex: 1, minWidth: 0 }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
                <span className="fim-code">{active.courseCode || '—'}</span>
                <span style={{ fontSize: 12.5, fontWeight: 700 }}>{active.title || 'Untitled course'}</span>
              </div>
              <div className="fim-chips" style={{ marginTop: 8 }}>
                <span className="fim-chip">{active.day}</span>
                <span className="fim-chip">{rangeLabel(active.range)} · {fmtDur(active.range.duration)}</span>
                <span className="fim-chip">{active.room}</span>
                {active.sections.map(s => <span key={s} className="fim-chip">{s}</span>)}
                {active.sections.length > 1 && <span className="fim-tag blue" style={{ alignSelf: 'center' }}>Merged</span>}
                {active.units > 0 && <span className="fim-chip">{fmtUnits(active.units)} units</span>}
              </div>
            </div>
            <button type="button" className="fim-x" onClick={() => setActiveKey(null)} aria-label="Close details"><IcClose size={12} /></button>
          </div>

          {active.pref && (
            <div className="fim-cf-line" style={{ color: '#B45309', fontWeight: 600 }}>
              <IcAlert size={12} color={AMBER} />
              {active.pref.dayOff && active.pref.timeOff ? 'Outside preferred day and time' : active.pref.dayOff ? 'Not a preferred day' : 'Outside preferred hours'}
              <span className="fim-cf-vs">({formatPreferenceSummary(pref)})</span>
            </div>
          )}

          {active.conflicts.length === 0 && !active.pref && (
            <div className="fim-cf-line" style={{ color: 'var(--meadow-text, #166534)', fontWeight: 600 }}>
              <IcCheck size={12} /> No conflicts for this session
            </div>
          )}
          {active.conflicts.map(p => {
            const o = p.ownPeer ? describeGroup(p.ownPeer === active ? p.a : p.ownPeer) : p.peer
            return (
              <div key={p.id} className="fim-cf-line">
                <TypeTags types={p.types} />
                <span style={{ fontWeight: 700 }}>{o.code}</span>
                <span className="fim-cf-vs">{o.sections.join(', ')} · {o.room} · {o.faculty || 'TBA'} · {rangeLabel(o.range)}</span>
              </div>
            )
          })}
        </div>
      )}
    </>
  )

  const listDays = DAYS.filter(d => shown.some(g => g.day === d))
  const listView = (
    <div className="fim-days">
      {listDays.map(d => {
        const dayGroups = shown.filter(g => g.day === d)
        const mins = dayGroups.reduce((s, g) => s + g.range.duration, 0)
        return (
          <div key={d} className="fim-day">
            <div className="fim-day-h">
              <span className="n">{d}</span>
              <span className="fim-count">{dayGroups.length}</span>
              <span className="s">{fmtHours(mins)} h · {minutesToTimeLabel(dayGroups[0].range.start)} to {minutesToTimeLabel(dayGroups[dayGroups.length - 1].range.end)}</span>
            </div>
            {dayGroups.map((g, i) => {
              const prev = dayGroups[i - 1]
              const gap = prev ? g.range.start - prev.range.end : 0
              const col = groupColor(g)
              const bad = g.conflicts.length > 0
              return (
                <div key={g.key}>
                  {gap > 0 && <div className="fim-gap">{fmtDur(gap)} break</div>}
                  <div className={`fim-row${bad ? ' bad' : ''}`}>
                    <span className="fim-stripe" style={{ background: col.accent }} />
                    <div className="fim-row-time">
                      {minutesToTimeLabel(g.range.start)}<br />{minutesToTimeLabel(g.range.end)}
                      <small>{fmtDur(g.range.duration)}</small>
                    </div>
                    <div className="fim-row-main">
                      <div className="fim-row-title">
                        <span className="fim-code">{g.courseCode || '—'}</span>
                        <span className="t" title={g.title}>{g.title || <span style={{ color: TV.muted }}>Untitled course</span>}</span>
                        {bad && <TypeTags types={g.types} />}
                        {g.pref && <span className="fim-tag amber" title={formatPreferenceSummary(pref)}>Off pref</span>}
                        {g.sections.length > 1 && <span className="fim-tag blue">Merged</span>}
                      </div>
                      <div className="fim-chips">
                        {g.sections.map(s => <span key={s} className="fim-chip">{s}</span>)}
                        <span className="fim-chip">{g.room}</span>
                        {g.units > 0 && <span className="fim-chip">{fmtUnits(g.units)} units</span>}
                      </div>
                      {g.conflicts.map(p => {
                        const o = p.ownPeer ? describeGroup(p.ownPeer === g ? p.a : p.ownPeer) : p.peer
                        return (
                          <div key={p.id} className="fim-cf-line" style={{ color: '#DC2626' }}>
                            <IcAlert size={11} color={RED} />
                            <span style={{ fontWeight: 700 }}>{[...p.types].map(t => TYPE_TEXT[t] || t).join(' + ')}</span>
                            <span className="fim-cf-vs">with {o.code} ({o.sections.join(', ')}) · {o.room} · {rangeLabel(o.range)}</span>
                          </div>
                        )
                      })}
                    </div>
                  </div>
                </div>
              )
            })}
          </div>
        )
      })}
    </div>
  )

  const conflictPanel = (
        <div className="fim-cf">
          <div className="fim-cf-h">
            <IcAlert size={14} color={RED} />
            {pairs.length} {pairs.length === 1 ? 'conflict' : 'conflicts'} found
            <span className="s">Click a row to locate it</span>
          </div>
          <div className="fim-cf-list">
            {pairs.map(p => (
              <button key={p.id} type="button" className="fim-cf-row" onClick={() => focusPair(p)}>
                <div className="fim-cf-line">
                  <TypeTags types={p.types} />
                  <span style={{ fontWeight: 700 }}>{p.day}</span>
                  <span className="fim-cf-vs">{rangeLabel(p.overlap)} overlap</span>
                </div>
                <div className="fim-cf-line">
                  <span style={{ fontWeight: 700 }}>{p.a.courseCode}</span>
                  <span className="fim-cf-vs">{p.a.sections.join(', ')} · {p.a.room} · {rangeLabel(p.a.range)}</span>
                </div>
                <div className="fim-cf-line">
                  <span className="fim-cf-vs">vs</span>
                  <span style={{ fontWeight: 700 }}>{p.peer.code}</span>
                  <span className="fim-cf-vs">{p.peer.sections.join(', ')} · {p.peer.room} · {p.peer.faculty || 'TBA'} · {rangeLabel(p.peer.range)}</span>
                </div>
              </button>
            ))}
          </div>
        </div>
  )

  const daysWord = teachDays.length === 1 ? 'day' : 'days'
  return (
    <div className="fim-body sched">
      <div className="fim-sched-top">
        <div className="fim-strip">
          <span><b>{groups.length}</b> {groups.length === 1 ? 'class' : 'classes'} · {sectionCount} {sectionCount === 1 ? 'section' : 'sections'}</span>
          <i className="sep" />
          <span><b>{fmtHours(totalMin)}</b> h / week</span>
          <i className="sep" />
          <span title={freeDays.join(', ')}>
            <b>{teachDays.length}</b> teaching {daysWord}
            {groups.length > 0 && freeDays.length > 0 && <> · free {freeDays.map(d => d.slice(0, 3)).join(', ')}</>}
          </span>
          {pref && (
            <span className="pref">
              Prefers <b>{formatPreferenceSummary(pref)}</b>{' '}
              <em className={prefCount ? 'warn' : ''} style={{ fontStyle: 'normal' }}>
                {prefCount ? `· ${prefCount} outside` : '· all within'}
              </em>
            </span>
          )}
        </div>

        {groups.length > 0 && (
          <div className="fim-toolbar">
            <div className="fim-seg" role="tablist" aria-label="Schedule view">
              <button type="button" className={view === 'week' ? 'on' : ''} onClick={() => setView('week')}><IcGrid /> Week</button>
              <button type="button" className={view === 'list' ? 'on' : ''} onClick={() => setView('list')}><IcList /> List</button>
            </div>
            {pairs.length > 0 ? (
              <>
                <button type="button" className="fim-mini on" onClick={() => setCfOpen(v => !v)} aria-expanded={cfOpen}>
                  <IcAlert size={12} /> {pairs.length} {pairs.length === 1 ? 'conflict' : 'conflicts'} <IcChev className={`chev${cfOpen ? ' open' : ''}`} />
                </button>
                <button type="button" className={`fim-mini${onlyConf ? ' on' : ''}`} onClick={() => setOnlyConf(v => !v)}>
                  Only conflicts
                </button>
              </>
            ) : (
              <span className="fim-ok-chip"><IcCheck size={12} /> No conflicts</span>
            )}
            <span className="grow" />
            <button type="button" className="fim-mini" onClick={copyText}>
              {copied ? <IcCheck size={12} /> : <IcCopy size={12} />} {copied ? 'Copied' : 'Copy'}
            </button>
            {onToggleMax && (
              <button type="button" className="fim-mini icon" onClick={onToggleMax} aria-label={maxed ? 'Shrink' : 'Expand'} title={maxed ? 'Shrink' : 'Expand'}>
                {maxed ? <IcMin /> : <IcMax />}
              </button>
            )}
          </div>
        )}

        {cfOpen && pairs.length > 0 && conflictPanel}
      </div>

      <div className="fim-sched-scroll" ref={scrollRef}>
        {groups.length === 0
          ? <div className="fim-spec-list"><div className="fim-empty">No scheduled sessions for this faculty member yet.</div></div>
          : view === 'week' ? weekView : listView}
      </div>

      <div className="fim-sched-bottom">
        {groups.length > 0 && view === 'week' && weekLegend}
        {view === 'week' && detailCard}
        {unscheduled.length > 0 && (
          <div className="fim-note" style={{ marginTop: 8 }}>
            {unscheduled.length} {unscheduled.length === 1 ? 'session' : 'sessions'} without a day or time: {uniq(unscheduled.map(e => e.courseCode)).join(', ') || 'unnamed'}
          </div>
        )}
      </div>
    </div>
  )
}

/* ── Small pieces exported for the faculty rows ──────────────────────────── */

/** Department badge shown beside a faculty name. Purple = other department. */
export function DeptBadge({ dept, home = HOME_DEPT_FALLBACK, onDark = false, style = {} }) {
  const { label, isHome } = deptInfo(dept, home)
  const look = onDark
    ? { background: 'rgba(255,255,255,.2)', color: '#fff', border: '1px solid rgba(255,255,255,.35)' }
    : isHome
      ? { background: 'var(--meadow-soft)', color: 'var(--meadow-text, #166534)', border: '1px solid rgba(34,197,94,.28)' }
      : { background: 'rgba(139,92,246,.14)', color: '#8B5CF6', border: '1px solid rgba(139,92,246,.4)' }
  return (
    <span
      title={isHome ? `${label} faculty` : `${label} faculty · manual-assign only`}
      style={{
        display: 'inline-flex', alignItems: 'center', flexShrink: 0,
        padding: '2px 8px', borderRadius: 99, fontSize: 9, fontWeight: 800,
        letterSpacing: '.5px', textTransform: 'uppercase', lineHeight: 1.3,
        fontStyle: 'normal', ...look, ...style,
      }}
    >
      {label}
    </span>
  )
}

/** Round "i" button — opens the faculty info modal. Never selects the row. */
export function FacultyInfoButton({ onClick, name }) {
  return (
    <button
      type="button"
      className="fim-info-btn"
      title={name ? `View details for ${name}` : 'View faculty details'}
      aria-label={name ? `View details for ${name}` : 'View faculty details'}
      onClick={e => { e.stopPropagation(); onClick?.() }}
      onMouseDown={e => e.stopPropagation()}
    >
      <IcInfo size={11} />
    </button>
  )
}

/* ── The modal ───────────────────────────────────────────────────────────── */
/**
 * Props
 *   faculty      faculty document (name, AcademicRank, Department, status, email,
 *                Educational_attainment, units, max_units, specializations, ...)
 *   courseCode   course of the session being assigned (highlights the match)
 *   unitInfo     optional { usedUnits, maxUnits } from the session modal
 *   availability optional string, e.g. the part-time preference summary
 *   isSelected   true when this faculty is already the picked one
 *   onSelect     optional; when given, shows a "Select for assignment" button
 *   home         home department (default "CCS")
 *   allEvents    optional full event list; when given, a Schedule tab shows this
 *                faculty's sessions with conflict + preference checks
 *   initialTab   'overview' (default) or 'schedule'
 *   onClose      required
 */
export default function FacultyInfoModal({
  faculty, courseCode = '', unitInfo = null, availability = '',
  isSelected = false, onSelect, home = HOME_DEPT_FALLBACK, onClose,
  allEvents = null, initialTab = 'overview',
}) {
  const [q, setQ] = useState('')
  const [tab, setTab] = useState(initialTab)
  const [maxed, setMaxed] = useState(false)

  // Esc closes this modal only (capture + stop so the session modal stays open)
  useEffect(() => {
    const onKey = e => {
      if (e.key !== 'Escape') return
      e.stopPropagation()
      e.stopImmediatePropagation?.()
      onClose?.()
    }
    window.addEventListener('keydown', onKey, true)
    return () => window.removeEventListener('keydown', onKey, true)
  }, [onClose])

  const target = norm(courseCode).toUpperCase()

  const specs = useMemo(() => {
    return normalizeSpecs(faculty?.specializations).sort((a, b) => {
      const am = target && a.code.toUpperCase() === target ? 1 : 0
      const bm = target && b.code.toUpperCase() === target ? 1 : 0
      if (am !== bm) return bm - am
      if (a.rating !== b.rating) return b.rating - a.rating
      return a.code.localeCompare(b.code)
    })
  }, [faculty, target])

  const visibleSpecs = useMemo(() => {
    const s = norm(q).toLowerCase()
    if (!s) return specs
    return specs.filter(x => x.code.toLowerCase().includes(s) || x.title.toLowerCase().includes(s))
  }, [specs, q])

  const hasSchedule = Array.isArray(allEvents)
  const pref = useMemo(() => getFacultyPreference(faculty), [faculty])
  const schedule = useMemo(
    () => (hasSchedule && faculty ? buildFacultySchedule(allEvents, faculty.name, pref) : null),
    [hasSchedule, allEvents, faculty, pref]
  )

  if (!faculty) return null

  const activeTab = hasSchedule ? tab : 'overview'
  const { label: deptLabel, isHome } = deptInfo(faculty.Department, home)
  const match     = target ? specs.find(s => s.code.toUpperCase() === target) : null
  const status    = titleCase(faculty.status || 'full-time')
  const used      = unitInfo?.usedUnits ?? faculty.units ?? 0
  const max       = unitInfo?.maxUnits  ?? faculty.max_units ?? 0
  const loadPct   = max > 0 ? Math.min(100, Math.round((Number(used) / Number(max)) * 100)) : 0
  const loadColor = loadPct > 100 ? '#EF4444' : loadPct > 80 ? '#F59E0B' : 'var(--meadow)'

  const heroBg = isHome
    ? `linear-gradient(135deg, var(--meadow), ${TV.deep})`
    : 'linear-gradient(135deg, #8B5CF6, #5B21B6)'

  const fields = [
    { label: 'Department',     value: deptLabel },
    { label: 'Employment',     value: status },
    { label: 'Academic rank',  value: norm(faculty.AcademicRank) },
    { label: 'Education',      value: norm(faculty.Educational_attainment) },
    { label: 'Email',          value: norm(faculty.email), wide: true },
  ]
  const availText = availability || formatPreferenceSummary(pref)
  if (availText) fields.push({ label: 'Preferred availability', value: availText, wide: true })

  return createPortal(
    <div
      className="fim-overlay"
      onMouseDown={e => { if (e.target === e.currentTarget) onClose?.() }}
      style={{ '--fim-border': TV.border, '--fim-muted': TV.muted, '--fim-text': TV.text, '--fim-deep': TV.deep }}
    >
      <div className={`fim-card${activeTab === 'schedule' ? ` wide${maxed ? ' max' : ''}` : ''}`} role="dialog" aria-modal="true" aria-label={`${faculty.name} details`}>

        {/* Hero */}
        <div className={`fim-hero${activeTab === 'schedule' ? ' compact' : ''}`} style={{ background: heroBg }}>
          <button type="button" className="fim-close" onClick={onClose} aria-label="Close"><IcClose /></button>
          <div className="fim-hero-row">
            <div className="fim-avatar">{initialsOf(faculty.name)}</div>
            <div style={{ minWidth: 0, paddingRight: activeTab === 'schedule' ? 0 : 34 }}>
              <h3 className="fim-name">{faculty.name}</h3>
              <p className="fim-rank">{norm(faculty.AcademicRank) || 'Faculty member'}</p>
            </div>
          </div>
          <div className="fim-pills">
            <DeptBadge dept={faculty.Department} home={home} onDark style={{ padding: '3px 10px', fontSize: 10 }} />
            <span className="fim-pill">{status}</span>
            {!isHome && <span className="fim-pill"><IcLock size={10} /> Manual-assign only</span>}
            {match && <span className="fim-pill"><IcCheck size={10} /> Teaches {courseCode}</span>}
          </div>
        </div>

        {/* Tabs */}
        {hasSchedule && (
          <div className="fim-tabs" role="tablist">
            <button type="button" role="tab" aria-selected={activeTab === 'overview'} className={`fim-tab${activeTab === 'overview' ? ' on' : ''}`} onClick={() => setTab('overview')}>
              Overview
            </button>
            <button type="button" role="tab" aria-selected={activeTab === 'schedule'} className={`fim-tab${activeTab === 'schedule' ? ' on' : ''}`} onClick={() => setTab('schedule')}>
              <IcCal size={13} /> Schedule
              <span className="fim-tab-badge">{schedule.groups.length}</span>
              {schedule.pairs.length > 0 && <span className="fim-tab-badge bad"><IcAlert size={9} color="#DC2626" />{schedule.pairs.length}</span>}
            </button>
          </div>
        )}

        {/* Body */}
        {activeTab === 'schedule' && schedule ? (
          <FacultySchedulePanel schedule={schedule} pref={pref} facultyName={faculty.name} maxed={maxed} onToggleMax={() => setMaxed(v => !v)} />
        ) : (
        <div className="fim-body">

          <div className="fim-tiles">
            <div className="fim-tile">
              <div className="fim-label">Current load</div>
              <div className="fim-tile-val">{fmtUnits(used)}<span style={{ fontWeight: 600, color: TV.muted, fontSize: 12 }}> / {fmtUnits(max)}</span></div>
              <div className="fim-bar"><i style={{ width: `${loadPct}%`, background: loadColor }} /></div>
            </div>
            <div className="fim-tile">
              <div className="fim-label">Specializations</div>
              <div className="fim-tile-val">{specs.length}</div>
              <div className="fim-tile-sub">{specs.length === 1 ? 'course' : 'courses'} on file</div>
            </div>
            <div className="fim-tile">
              <div className="fim-label">{courseCode ? `For ${courseCode}` : 'This course'}</div>
              <div className="fim-tile-val" style={{ fontSize: 13.5, color: match ? RATING[match.rating].color : TV.muted }}>
                {match ? RATING[match.rating].label : 'No match'}
              </div>
              <div className="fim-tile-sub">{match ? `${match.rating} of 5` : 'not specialized'}</div>
            </div>
          </div>

          <div>
            <div className="fim-section-head"><span className="fim-label">Profile</span></div>
            <div className="fim-grid">
              {fields.map(f => (
                <div key={f.label} className={`fim-field${f.wide ? ' wide' : ''}`}>
                  <div className="fim-label">{f.label}</div>
                  <div className="fim-field-val" title={f.value || ''} style={{ color: f.value ? TV.text : TV.muted }}>
                    {f.value || '—'}
                  </div>
                </div>
              ))}
            </div>
          </div>

          <div>
            <div className="fim-section-head">
              <span className="fim-label">Specializations</span>
              <span className="fim-count">{specs.length}</span>
            </div>

            {specs.length > 6 && (
              <div className="fim-search">
                <IcSearch color={TV.muted} />
                <input value={q} onChange={e => setQ(e.target.value)} placeholder="Search course code or title…" />
              </div>
            )}

            <div className="fim-spec-list">
              {specs.length === 0 ? (
                <div className="fim-empty">No specializations on file for this faculty member.</div>
              ) : visibleSpecs.length === 0 ? (
                <div className="fim-empty">No specialization matches “{norm(q)}”.</div>
              ) : visibleSpecs.map(s => {
                const isMatch = target && s.code.toUpperCase() === target
                const r = RATING[s.rating]
                return (
                  <div key={`${s.code}|${s.title}`} className={`fim-spec${isMatch ? ' match' : ''}`}>
                    <span className="fim-code">{s.code || '—'}</span>
                    <span className="fim-spec-title" title={s.title}>{s.title || <span style={{ color: TV.muted }}>Untitled course</span>}</span>
                    {isMatch && <span className="fim-tag" style={{ background: 'var(--meadow)', color: '#fff' }}>This course</span>}
                    {s.unmatched && <span className="fim-tag" title="Not linked to a course in the Course List" style={{ background: 'rgba(245,158,11,.16)', color: '#B45309' }}>Unmatched</span>}
                    <div className="fim-rate">
                      <span className="fim-meter">
                        {[1, 2, 3, 4, 5].map(i => <i key={i} style={{ background: i <= s.rating ? r.color : 'var(--hover)' }} />)}
                      </span>
                      <span className="t" style={{ color: r.color }}>{r.label}</span>
                    </div>
                  </div>
                )
              })}
            </div>
          </div>
          <div style={{ height: 4, flexShrink: 0 }} />
        </div>
        )}

        {/* Footer */}
        <div className="fim-foot">
          <button type="button" className="fim-btn ghost" onClick={onClose}>Close</button>
          {onSelect && (
            <button type="button" className="fim-btn primary" disabled={isSelected} onClick={onSelect}>
              <IcCheck size={13} color="#fff" /> {isSelected ? 'Already selected' : 'Select for assignment'}
            </button>
          )}
        </div>
      </div>
    </div>,
    document.body
  )
}