/**
 * CoordAnalyticsPage.jsx
 *
 * Program-scoped analytics for coordinators — same design system as the admin
 * AnalyticsPage (DashboardPage green theme):
 *   - CSS variables: --surface, --border, --ink, --muted, --muted2, --hover, --bg, --meadow*
 *   - Card / CardHeader / StatCard / InsightNote / FilterChip / Ring / Skeleton
 *   - Same chart palette (C, PALETTE, DAY_COLORS), same recharts styling
 *   - Sora for big numbers, IBM Plex Mono only for course / room codes
 *
 * Answers, in order:
 *   1. Can I submit this schedule?           (stat cards + readiness)
 *   2. Which draft should I submit?          (drafts compared)
 *   3. What exactly is wrong?                (conflicts, unassigned, staffing)
 *   4. Is anyone overloaded / badly matched? (instructor load & fit)
 *   5. What does the week look like for
 *      students, and are my rooms used?      (daily volume, busiest hours, sections, rooms)
 *
 * Data comes from the saved schedule document (not the shared in-memory
 * buffer), plus read-only sessions from other programs' approved schedules.
 *
 * All class names are `ca-` prefixed and the <style> lives inside the component
 * so it is removed on unmount — nothing here can leak into other pages.
 */

import { useState, useEffect, useCallback, useMemo, useRef } from 'react'
import { Link, useSearchParams } from 'react-router-dom'
import {
  Tooltip, ResponsiveContainer,
  BarChart, Bar, XAxis, YAxis, CartesianGrid, LabelList, Cell,
} from 'recharts'
import { coordGetAnalyticsOverview, coordGetAnalytics } from '../../services/api'

// ── Styles (mirrors admin ANALYTICS_STYLE) ───────────────────────────────────
const STYLE = `
  @keyframes ca-spin { to { transform: rotate(360deg) } }
  @keyframes ca-fadeUp {
    from { opacity:0; transform:translateY(10px) }
    to   { opacity:1; transform:translateY(0) }
  }
  @keyframes ca-shimmer {
    0%   { background-position: -600px 0 }
    100% { background-position:  600px 0 }
  }
  .ca-root {
    padding: 24px 32px;
    background: var(--bg);
    min-height: 100%;
    color: var(--ink);
    font-family: 'Inter', sans-serif;
    display: flex; flex-direction: column; gap: 24px;
  }
  .ca-root * { box-sizing: border-box; }
  .ca-skel {
    background: linear-gradient(90deg,var(--hover) 25%,var(--border) 50%,var(--hover) 75%);
    background-size: 600px 100%;
    animation: ca-shimmer 1.4s ease-in-out infinite;
    border-radius: 7px;
  }
  .ca-spin { animation: ca-spin .8s linear infinite; }
  .ca-card {
    background: var(--surface);
    border-radius: 16px;
    border: 1px solid var(--border);
    box-shadow: 0 2px 12px rgba(0,0,0,0.07);
    overflow: hidden;
    flex-shrink: 0;
    animation: ca-fadeUp .35s ease both;
  }
  .ca-stat-card {
    background: var(--surface);
    border-radius: 14px;
    border: 1px solid var(--border);
    box-shadow: 0 1px 6px rgba(0,0,0,0.06);
    padding: 16px 18px;
    display: flex; align-items: center; gap: 14px;
    transition: box-shadow .18s, transform .18s;
    animation: ca-fadeUp .3s ease both;
    cursor: default; position: relative; overflow: hidden;
  }
  .ca-stat-card:hover { box-shadow: 0 6px 22px rgba(0,0,0,0.11); transform: translateY(-2px); }

  .ca-stats { display: grid; grid-template-columns: repeat(4, 1fr); gap: 14px; }
  .ca-grid2 { display: grid; grid-template-columns: 1fr 1fr; gap: 16px; }
  @media (max-width: 1100px) { .ca-stats { grid-template-columns: repeat(2, 1fr); } }
  @media (max-width: 980px)  { .ca-grid2 { grid-template-columns: 1fr; } .ca-root { padding: 20px 16px 40px; } }
  @media (max-width: 560px)  { .ca-stats { grid-template-columns: 1fr; } }

  .ca-scroll { border: 1px solid var(--border); border-radius: 10px; overflow-y: auto; }
  .ca-row { border-bottom: 1px solid var(--border); }
  .ca-row:last-child { border-bottom: none; }

  .ca-table { width: 100%; border-collapse: collapse; font-size: 12.5px; }
  .ca-table th {
    font-size: 10px; font-weight: 700; letter-spacing: .5px; text-transform: uppercase;
    color: var(--muted2); text-align: left; padding: 10px 14px;
    border-bottom: 1px solid var(--border); white-space: nowrap;
  }
  .ca-table td { padding: 10px 14px; border-bottom: 1px solid var(--border); vertical-align: middle; }
  .ca-table tr:last-child td { border-bottom: none; }
  .ca-table .num { text-align: right; font-variant-numeric: tabular-nums; }
  .ca-table tr.ca-pick { cursor: pointer; }
  .ca-table tr.ca-pick:hover td { background: var(--hover); }
  .ca-table tr.ca-on td { background: var(--meadow-soft); }

  .ca-mono { font-family: 'IBM Plex Mono', ui-monospace, monospace; }
  .ca-link { color: var(--meadow); font-weight: 600; font-size: 12.5px; text-decoration: none; }
  .ca-link:hover { text-decoration: underline; }
  .ca-refresh:hover:not([disabled]) { border-color: var(--meadow); }
`

// ── Colour palette (identical to admin AnalyticsPage) ────────────────────────
const C = {
  green:  'var(--meadow)',
  blue:   '#60A5FA',
  amber:  '#F59E0B',
  purple: '#7C3AED',
  cyan:   '#0891B2',
  red:    '#EF4444',
  teal:   '#0D9488',
  rose:   '#E11D48',
}
const AMBER_TEXT = '#B45309'
const SOFT = {
  green: 'var(--meadow-soft)',
  blue:  'rgba(59, 130, 246, 0.1)',
  amber: 'rgba(245, 158, 11, 0.12)',
  red:   'rgba(220, 38, 38, 0.1)',
  grey:  'var(--hover)',
}

const PALETTE = [C.green, C.blue, C.amber, C.purple, C.cyan, C.rose, C.teal, '#A78BFA']
const DAY_COLORS = {
  Monday: C.green, Tuesday: C.blue, Wednesday: C.amber, Thursday: C.purple,
  Friday: C.cyan, Saturday: C.rose, Sunday: C.teal,
}

// ── Helpers ──────────────────────────────────────────────────────────────────
const dash  = (v, suffix = '') => (v === null || v === undefined ? '—' : `${v}${suffix}`)
const short = (s) => (s && s.length > 26 ? s.slice(0, 24) + '…' : s || '')
const scoreColor = (s) => (s >= 80 ? C.green : s >= 60 ? C.blue : s >= 40 ? C.amber : C.red)
const bandKeyColor = (b, score) =>
  b === 'great' ? C.green : b === 'good' ? C.blue : b === 'fair' ? C.amber : b === 'poor' ? C.red : scoreColor(score)
const capDay = (d) => { const s = String(d || ''); return s.charAt(0).toUpperCase() + s.slice(1).toLowerCase() }
const plural = (n, w) => `${n} ${w}${n === 1 ? '' : 's'}`

const STATUS = {
  pass: { label: 'OK',    color: C.green,        soft: SOFT.green },
  warn: { label: 'CHECK', color: AMBER_TEXT,     soft: SOFT.amber },
  fail: { label: 'FIX',   color: C.red,          soft: SOFT.red },
  info: { label: 'N/A',   color: 'var(--muted2)', soft: SOFT.grey },
}
const VERDICT = {
  ready:     { label: 'Ready',     color: C.green,        soft: SOFT.green },
  review:    { label: 'Review',    color: AMBER_TEXT,     soft: SOFT.amber },
  not_ready: { label: 'Not ready', color: C.red,          soft: SOFT.red },
  empty:     { label: 'Empty',     color: 'var(--muted2)', soft: SOFT.grey },
}

// button is globally reset (all: unset) in this app, so every control is fully styled
const ctrlBase = {
  fontFamily: 'inherit', fontSize: 11.5, color: 'var(--ink)',
  background: 'var(--surface)', border: '1.5px solid var(--border)',
  borderRadius: 8, padding: '6px 10px', outline: 'none',
}

const TooltipStyle = {
  background: 'var(--surface)',
  border: '1px solid var(--border)',
  borderRadius: 8,
  boxShadow: '0 4px 12px rgba(0,0,0,0.10)',
  padding: '10px 14px',
  fontSize: 12,
  color: 'var(--ink)',
}

const StandardTooltip = ({ active, payload }) => {
  if (!active || !payload?.length) return null
  const d = payload[0]
  return (
    <div style={TooltipStyle}>
      <strong style={{ display: 'block', marginBottom: 4, fontSize: 12.5 }}>
        {d.name || d.payload?.day || d.payload?.room}
      </strong>
      <span style={{ color: C.green, fontWeight: 700 }}>{d.value} sessions</span>
    </div>
  )
}

// ── Building blocks (same as admin AnalyticsPage) ────────────────────────────
function Skel({ w = '100%', h = 14, r = 7, style = {} }) {
  return <div className="ca-skel" style={{ width: w, height: h, borderRadius: r, flexShrink: 0, ...style }} />
}

function SectionSkel({ rows = 4 }) {
  return (
    <div style={{ padding: 18, display: 'flex', flexDirection: 'column', gap: 10 }}>
      {Array.from({ length: rows }).map((_, i) => <Skel key={i} w={`${85 - i * 8}%`} h={14} r={6} />)}
    </div>
  )
}

function Card({ children, style = {}, id }) {
  return <div className="ca-card" id={id} style={style}>{children}</div>
}

function CardHeader({ title, subtitle, right, id }) {
  return (
    <div id={id} style={{
      padding: '12px 18px', borderBottom: '1px solid var(--border)',
      display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 8,
    }}>
      <div style={{ minWidth: 0 }}>
        <div style={{ fontSize: 13, fontWeight: 700, color: 'var(--ink)' }}>{title}</div>
        {subtitle && <div style={{ fontSize: 11, color: 'var(--muted2)', marginTop: 2 }}>{subtitle}</div>}
      </div>
      {right && <div style={{ flexShrink: 0 }}>{right}</div>}
    </div>
  )
}

function Pill({ children, color = 'var(--muted)', soft = SOFT.grey, style }) {
  return (
    <span style={{
      background: soft, color, fontSize: 10.5, fontWeight: 700, padding: '3px 9px',
      borderRadius: 99, whiteSpace: 'nowrap', ...style,
    }}>{children}</span>
  )
}

function InsightNote({ text, type = 'info' }) {
  if (!text) return null
  const isWarn = type === 'warn' || type === 'danger'
  const color  = isWarn ? C.red : C.green
  const bg     = isWarn ? 'rgba(220, 38, 38, 0.05)' : 'var(--meadow-soft)'
  const border = isWarn ? 'rgba(220, 38, 38, 0.25)' : 'var(--meadow-border)'
  return (
    <div style={{
      marginTop: 14, padding: '10px 14px', borderRadius: 8,
      background: bg, border: `1px solid ${border}`,
      fontSize: 12, color: 'var(--muted)', lineHeight: 1.6,
    }}>
      <strong style={{ color, fontWeight: 700, marginRight: 6 }}>Insight:</strong>
      {text}
    </div>
  )
}

function Empty({ children, ok = false, pad = '36px 12px' }) {
  return (
    <div style={{ textAlign: 'center', padding: pad, color: 'var(--muted2)', fontSize: 12.5, lineHeight: 1.6 }}>
      {ok && (
        <div style={{ width: 34, height: 34, borderRadius: '50%', background: 'var(--meadow-soft)', color: 'var(--meadow)', display: 'flex', alignItems: 'center', justifyContent: 'center', margin: '0 auto 10px' }}>
          <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3"><polyline points="20 6 9 17 4 12" /></svg>
        </div>
      )}
      {children}
    </div>
  )
}

function StatCard({ label, value, sub, icon, color, bg, loading }) {
  return (
    <div className="ca-stat-card">
      <div style={{
        width: 42, height: 42, borderRadius: 11, flexShrink: 0,
        background: loading ? 'var(--hover)' : bg,
        display: 'flex', alignItems: 'center', justifyContent: 'center',
      }}>
        {loading ? <Skel w={42} h={42} r={11} /> : <div style={{ color }}>{icon}</div>}
      </div>
      <div style={{ flex: 1, minWidth: 0 }}>
        {loading ? (
          <>
            <Skel w={48} h={26} r={6} style={{ marginBottom: 6 }} />
            <Skel w={80} h={11} r={5} />
          </>
        ) : (
          <>
            <div style={{ fontSize: 26, fontWeight: 800, color: 'var(--ink)', lineHeight: 1, fontFamily: "'Sora',sans-serif" }}>{value}</div>
            <div style={{ fontSize: 11.5, color: 'var(--muted2)', marginTop: 3, fontWeight: 500 }}>{label}</div>
            {sub && <div style={{ fontSize: 10.5, color: 'var(--muted)', marginTop: 2 }}>{sub}</div>}
          </>
        )}
      </div>
      {color && (
        <svg width="100%" height="40" style={{ position: 'absolute', bottom: 0, right: 0, opacity: 0.12, zIndex: 0, pointerEvents: 'none' }} viewBox="0 0 100 40" preserveAspectRatio="none">
          <path d="M0 40 Q 25 10, 50 25 T 100 10 L 100 40 Z" fill={color} />
        </svg>
      )}
    </div>
  )
}

function FilterChip({ active, color, label, count, onClick }) {
  return (
    <button
      type="button"
      onClick={onClick}
      style={{
        display: 'inline-flex', alignItems: 'center', gap: 6, padding: '5px 11px',
        borderRadius: 99, cursor: 'pointer', fontFamily: 'inherit', fontSize: 11.5, fontWeight: 700,
        border: `1.5px solid ${active ? (color || 'var(--meadow)') : 'var(--border)'}`,
        background: active ? 'var(--hover)' : 'var(--surface)',
        color: active ? 'var(--ink)' : 'var(--muted)',
        transition: 'all .15s',
      }}
    >
      {color && <span style={{ width: 8, height: 8, borderRadius: 2, background: color }} />}
      {label}
      <span style={{ fontWeight: 800, color: active ? (color || 'var(--ink)') : 'var(--muted2)' }}>{count}</span>
    </button>
  )
}

function Ring({ value, size = 116, stroke = 11, sub = 'out of 100', suffix = '' }) {
  const r = (size - stroke) / 2
  const circ = 2 * Math.PI * r
  const has = value !== null && value !== undefined
  const filled = has ? (Math.min(value, 100) / 100) * circ : 0
  const color = has ? scoreColor(value) : 'var(--muted2)'
  return (
    <div style={{ position: 'relative', width: size, height: size, flexShrink: 0 }}>
      <svg width={size} height={size} style={{ transform: 'rotate(-90deg)' }}>
        <circle cx={size / 2} cy={size / 2} r={r} fill="none" stroke="var(--hover)" strokeWidth={stroke} />
        <circle cx={size / 2} cy={size / 2} r={r} fill="none" stroke={color} strokeWidth={stroke}
          strokeDasharray={`${filled} ${circ - filled}`} strokeLinecap="round"
          style={{ transition: 'stroke-dasharray 1s cubic-bezier(.4,0,.15,1)' }} />
      </svg>
      <div style={{ position: 'absolute', inset: 0, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center' }}>
        <span style={{ fontSize: 26, fontWeight: 800, color: 'var(--ink)', fontFamily: "'Sora',sans-serif", lineHeight: 1 }}>
          {has ? `${Math.round(value)}${suffix}` : '—'}
        </span>
        <span style={{ fontSize: 9.5, fontWeight: 700, color: 'var(--muted2)', marginTop: 3 }}>{sub}</span>
      </div>
    </div>
  )
}

function ScoreChip({ label, value }) {
  const has = value !== null && value !== undefined
  const c = has ? scoreColor(value) : 'var(--muted2)'
  return (
    <span title={has ? `${label}: ${Math.round(value)}%` : `${label}: no preference set`}
      style={{ display: 'inline-flex', gap: 4, alignItems: 'center', fontSize: 10, fontWeight: 700, padding: '2px 7px', borderRadius: 6, background: 'var(--hover)', color: 'var(--muted)' }}>
      {label}
      <span style={{ color: c }}>{has ? `${Math.round(value)}%` : 'n/a'}</span>
    </span>
  )
}

function RoomChip({ name, good }) {
  const color = good === undefined ? 'var(--ink)' : good ? C.green : C.red
  return (
    <span style={{ fontSize: 10, fontWeight: 700, padding: '2px 8px', borderRadius: 99, background: 'var(--surface)', border: `1px solid ${good === undefined ? 'var(--border)' : color}`, color, fontFamily: "'IBM Plex Mono',monospace" }}>
      {name}
    </span>
  )
}

function SessionLine({ s }) {
  return (
    <div style={{ fontSize: 12.5, lineHeight: 1.6 }}>
      <strong className="ca-mono" style={{ fontWeight: 700 }}>{s.courseCode}</strong>
      <span style={{ color: 'var(--muted)' }}> · {s.year ? `${s.year}-` : ''}{s.block} · {s.session}</span>
      <span style={{ color: 'var(--muted)' }}> · {s.room || 'TBA'} · {s.faculty || 'TBA'}</span>
      {s.external && (
        <span style={{ marginLeft: 6, padding: '1px 6px', borderRadius: 99, fontSize: 9, fontWeight: 700, letterSpacing: '.3px', textTransform: 'uppercase', background: SOFT.amber, color: AMBER_TEXT }}>
          {s.program} (approved)
        </span>
      )}
    </div>
  )
}

// ── Readiness ────────────────────────────────────────────────────────────────
function Readiness({ d, scheduleId, externalPrograms }) {
  const r = d.readiness
  const s = d.summary
  const v = VERDICT[r.verdict] || VERDICT.ready
  return (
    <Card>
      <CardHeader
        title="Submission Readiness"
        subtitle="Can this schedule be submitted as it is?"
        right={<Pill color={v.color} soft={v.soft}>{v.label}</Pill>}
      />
      <div style={{ padding: 18 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 14, marginBottom: 16 }}>
          <div style={{ width: 42, height: 42, borderRadius: 11, flexShrink: 0, background: v.soft, color: v.color, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
            {r.verdict === 'ready' || !VERDICT[r.verdict] ? (
              <svg width="19" height="19" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M22 11.08V12a10 10 0 1 1-5.93-9.14" /><polyline points="22 4 12 14.01 9 11.01" /></svg>
            ) : (
              <svg width="19" height="19" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><circle cx="12" cy="12" r="10" /><line x1="12" y1="8" x2="12" y2="12" /><line x1="12" y1="16" x2="12.01" y2="16" /></svg>
            )}
          </div>
          <div style={{ minWidth: 0 }}>
            <div style={{ fontSize: 18, fontWeight: 800, color: 'var(--ink)', fontFamily: "'Sora',sans-serif", lineHeight: 1.25 }}>{r.headline}</div>
            <div style={{ fontSize: 11.5, color: 'var(--muted2)', marginTop: 4 }}>
              {s.sessions} sessions · {s.sections} sections · {s.faculty} instructors · {s.lectureSessions} lecture / {s.labSessions} lab
            </div>
            {externalPrograms?.length > 0 && (
              <div style={{ fontSize: 11.5, color: 'var(--muted2)', marginTop: 2 }}>Checked against approved: {externalPrograms.join(', ')}</div>
            )}
          </div>
        </div>

        <div className="ca-scroll" style={{ overflowY: 'visible' }}>
          {r.items.map((it) => {
            const st = STATUS[it.status] || STATUS.info
            return (
              <div className="ca-row" key={it.id} style={{ display: 'grid', gridTemplateColumns: '64px minmax(0,1fr) auto', gap: 14, alignItems: 'start', padding: '11px 14px' }}>
                <span style={{ fontSize: 10, fontWeight: 700, letterSpacing: '.4px', textAlign: 'center', padding: '3px 0', borderRadius: 99, background: st.soft, color: st.color }}>{st.label}</span>
                <div style={{ minWidth: 0 }}>
                  <div style={{ fontSize: 12.5, fontWeight: 600, color: 'var(--ink)' }}>{it.label}</div>
                  <div style={{ fontSize: 11.5, color: 'var(--muted)', marginTop: 2, lineHeight: 1.5 }}>{it.detail}</div>
                </div>
                <div style={{ fontSize: 16, fontWeight: 800, fontFamily: "'Sora',sans-serif", minWidth: 28, textAlign: 'right', color: it.count ? st.color : 'var(--muted2)' }}>
                  {it.count || '0'}
                </div>
              </div>
            )
          })}
        </div>

        <div style={{ marginTop: 14 }}>
          <Link className="ca-link" to={`/coordinator/schedules/${scheduleId}`}>Open in schedule editor →</Link>
        </div>
      </div>
    </Card>
  )
}

// ── Drafts compared ──────────────────────────────────────────────────────────
function Compare({ overview, selectedId, onPick }) {
  const rows = overview.schedules
  const issues = (r) => r.conflicts + r.crossConflicts + r.tbaSessions + r.overloaded
  const live = rows.filter((r) => r.sessions > 0).map(issues)
  const best = live.length > 1 && Math.min(...live) < Math.max(...live) ? Math.min(...live) : null
  const tone = (n, color) => ({ color: n ? color : 'var(--muted2)', fontWeight: n ? 700 : 400 })
  return (
    <Card>
      <CardHeader
        title="Drafts Compared"
        subtitle="Click a row to analyse that schedule"
        right={<Pill>{plural(rows.length, 'draft')}</Pill>}
      />
      <div style={{ overflowX: 'auto' }}>
        <table className="ca-table">
          <thead>
            <tr>
              <th>Draft</th><th>Status</th>
              <th className="num">Sessions</th><th className="num">Conflicts</th>
              <th className="num">Clashes</th><th className="num">TBA</th>
              <th className="num">Over cap</th><th className="num">Fit</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((r) => (
              <tr key={r.id} className={`ca-pick ${r.id === selectedId ? 'ca-on' : ''}`} onClick={() => onPick(r.id)}>
                <td>
                  <strong style={{ color: 'var(--ink)' }}>{short(r.name) || 'Untitled'}</strong>
                  {best !== null && r.sessions > 0 && issues(r) === best && (
                    <Pill color={C.green} soft={SOFT.green} style={{ marginLeft: 8, fontSize: 9.5 }}>Fewest issues</Pill>
                  )}
                </td>
                <td><Pill style={{ textTransform: 'capitalize' }}>{r.status}</Pill></td>
                <td className="num">{r.sessions}</td>
                <td className="num" style={tone(r.conflicts, C.red)}>{r.conflicts}</td>
                <td className="num" style={tone(r.crossConflicts, C.red)}>{r.crossConflicts}</td>
                <td className="num" style={tone(r.tbaSessions, C.amber)}>{r.tbaSessions}</td>
                <td className="num" style={tone(r.overloaded, C.red)}>{r.overloaded}</td>
                <td className="num" style={{ fontWeight: 700, color: r.avgSatisfaction == null ? 'var(--muted2)' : scoreColor(r.avgSatisfaction) }}>{dash(r.avgSatisfaction)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </Card>
  )
}

// ── Conflicts ────────────────────────────────────────────────────────────────
function Conflicts({ c }) {
  if (!c.items.length) return null
  const cross = c.items.filter((p) => p.scope === 'cross').length
  return (
    <Card>
      <CardHeader
        title="Conflicts to Resolve"
        subtitle="Room and instructor clashes between two sessions"
        right={<Pill color={C.red} soft={SOFT.red}>
          {c.totalPairs > c.items.length ? `Showing ${c.items.length} of ${c.totalPairs}` : `${c.totalPairs} in total`}
        </Pill>}
      />
      <div style={{ padding: 18 }}>
        <div className="ca-scroll" style={{ maxHeight: 460 }}>
          {c.items.map((p, i) => (
            <div className="ca-row" key={i} style={{ display: 'grid', gridTemplateColumns: '150px minmax(0,1fr)', gap: 14, padding: '11px 14px' }}>
              <div>
                <span style={{ display: 'inline-block', fontSize: 9.5, fontWeight: 700, letterSpacing: '.4px', textTransform: 'uppercase', padding: '2px 8px', borderRadius: 99, background: SOFT.red, color: C.red }}>
                  {p.kinds.join(' + ')}
                </span>
                {p.scope === 'cross' && <div style={{ fontSize: 10, color: AMBER_TEXT, fontWeight: 700, marginTop: 4 }}>Other program</div>}
                <div style={{ fontSize: 11.5, fontWeight: 700, color: 'var(--ink)', marginTop: 6 }}>{p.day}</div>
                <div style={{ fontSize: 11, color: 'var(--muted2)' }}>{p.period}</div>
              </div>
              <div style={{ minWidth: 0, display: 'flex', flexDirection: 'column', gap: 3 }}>
                <SessionLine s={p.a} />
                <SessionLine s={p.b} />
              </div>
            </div>
          ))}
        </div>
        <InsightNote type="warn" text={cross > 0
          ? `${c.totalPairs} clashing pair${c.totalPairs === 1 ? '' : 's'} to fix before you submit. ${cross} involve another program's approved schedule, so your session is the one that has to move.`
          : `${c.totalPairs} clashing pair${c.totalPairs === 1 ? '' : 's'} to fix before you submit. Move one session in each pair to a free room or time.`} />
      </div>
    </Card>
  )
}

// ── Staffing ─────────────────────────────────────────────────────────────────
function Staffing({ tba, risks }) {
  const tbaTotal = tba.reduce((n, t) => n + (t.sessions || 0), 0)
  return (
    <div className="ca-grid2">
      <Card>
        <CardHeader
          title="Unassigned Courses"
          subtitle="Courses still missing an instructor (TBA)"
          right={tbaTotal > 0 && <Pill color={AMBER_TEXT} soft={SOFT.amber}>{plural(tbaTotal, 'session')}</Pill>}
        />
        <div style={{ padding: 18, minHeight: 200 }}>
          {tba.length === 0 ? (
            <Empty ok>Every major-course session is staffed.</Empty>
          ) : (
            <>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 12, maxHeight: 360, overflowY: 'auto' }}>
                {tba.map((t) => (
                  <div key={t.courseCode}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', gap: 8 }}>
                      <span style={{ fontSize: 12, fontWeight: 600, color: 'var(--ink)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                        <span className="ca-mono" style={{ fontWeight: 700 }}>{t.courseCode}</span>
                        <span style={{ color: 'var(--muted2)', fontWeight: 500 }}> · {short(t.title)}</span>
                      </span>
                      <span style={{ fontSize: 11.5, fontWeight: 800, color: C.amber, flexShrink: 0 }}>{plural(t.sessions, 'session')}</span>
                    </div>
                    {t.blocks.length > 0 && <div style={{ fontSize: 10, color: 'var(--muted2)', marginTop: 3 }}>Block {t.blocks.join(', ')}</div>}
                  </div>
                ))}
              </div>
              <InsightNote type="warn" text="Fix these first. Assign a faculty member manually, or add the specialization and re-run the scheduler." />
            </>
          )}
        </div>
      </Card>

      <Card>
        <CardHeader
          title="Thin Instructor Pool"
          subtitle="Courses with 0–1 qualified instructors"
          right={risks.length > 0 && <Pill color={AMBER_TEXT} soft={SOFT.amber}>{plural(risks.length, 'course')}</Pill>}
        />
        <div style={{ padding: 18, minHeight: 200 }}>
          {risks.length === 0 ? (
            <Empty ok>Every course has at least two instructors with a matching specialization.</Empty>
          ) : (
            <>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 12, maxHeight: 360, overflowY: 'auto' }}>
                {risks.map((t) => (
                  <div key={t.courseCode} style={{ display: 'flex', justifyContent: 'space-between', gap: 8, alignItems: 'baseline' }}>
                    <span style={{ fontSize: 12, fontWeight: 600, color: 'var(--ink)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                      <span className="ca-mono" style={{ fontWeight: 700 }}>{t.courseCode}</span>
                      <span style={{ color: 'var(--muted2)', fontWeight: 500 }}> · {short(t.title)}</span>
                    </span>
                    <span style={{ fontSize: 11.5, fontWeight: 800, flexShrink: 0, color: t.facultyCount === 0 ? C.red : C.amber }}>
                      {t.facultyCount === 0 ? 'Nobody' : '1 person'}
                    </span>
                  </div>
                ))}
              </div>
              <InsightNote type={risks.some((t) => t.facultyCount === 0) ? 'warn' : 'info'}
                text="A course with one qualified instructor has no backup if that person reaches their unit cap. A course with nobody cannot be staffed by the scheduler." />
            </>
          )}
        </div>
      </Card>
    </div>
  )
}

// ── Instructors: load against cap + fit ──────────────────────────────────────
const SORTS = [
  { k: 'attention', l: 'Needs attention' },
  { k: 'load',      l: 'Highest load' },
  { k: 'fit',       l: 'Lowest fit' },
  { k: 'name',      l: 'Name A to Z' },
]

function FacultyLedger({ rows }) {
  const [sort, setSort]     = useState('attention')
  const [filter, setFilter] = useState('all')
  const [openName, setOpen] = useState(null)

  const scale = useMemo(
    () => Math.max(1, ...rows.map((r) => Math.max(r.totalUnits || 0, r.cap || 0))),
    [rows]
  )
  const stateOf = (r) => (r.overloaded ? 'over' : r.nearCap ? 'near' : r.satisfaction < 40 ? 'low' : 'ok')
  const counts = useMemo(() => {
    const c = { over: 0, near: 0, low: 0, ok: 0 }
    rows.forEach((r) => { c[stateOf(r)] += 1 })
    return c
  }, [rows])

  const visible = useMemo(() => {
    const a = rows.filter((r) => filter === 'all' || stateOf(r) === filter)
    const weight = (r) => (r.overloaded ? 3 : r.nearCap ? 2 : r.satisfaction < 40 ? 1 : 0)
    if (sort === 'attention') a.sort((x, y) => weight(y) - weight(x) || (y.loadPct ?? 0) - (x.loadPct ?? 0) || x.satisfaction - y.satisfaction)
    if (sort === 'load') a.sort((x, y) => (y.loadPct ?? 0) - (x.loadPct ?? 0))
    if (sort === 'fit') a.sort((x, y) => x.satisfaction - y.satisfaction)
    if (sort === 'name') a.sort((x, y) => x.name.localeCompare(y.name))
    return a
  }, [rows, sort, filter])

  const avgFit  = rows.length ? Math.round(rows.reduce((s, r) => s + (r.satisfaction || 0), 0) / rows.length) : null
  const mineSum = rows.reduce((s, r) => s + (r.mineUnits || 0), 0)
  const over    = rows.filter((r) => r.overloaded).sort((a, b) => (b.totalUnits - b.cap) - (a.totalUnits - a.cap))
  const insight = over.length
    ? `${over.length} instructor${over.length > 1 ? 's are' : ' is'} over the unit cap, the worst being ${over[0].name} at ${over[0].totalUnits}/${dash(over[0].cap)}u.`
    : counts.near
      ? `Nobody is over cap, but ${counts.near} instructor${counts.near > 1 ? 's are' : ' is'} close to it. Avoid adding sessions to them.`
      : counts.low
        ? `${counts.low} instructor${counts.low > 1 ? 's have' : ' has'} a fit under 40. Check their specialization and preferred days or hours.`
        : 'Everyone is inside their unit cap and reasonably matched to their sessions.'

  return (
    <Card>
      <CardHeader
        title="Instructor Load & Fit"
        subtitle="Units include what other approved programs already gave them. Fit is 0–100."
        right={counts.over > 0 && <Pill color={C.red} soft={SOFT.red}>{counts.over} over cap</Pill>}
      />
      <div style={{ padding: 18 }}>
        {rows.length === 0 ? (
          <Empty>No instructors are assigned in this schedule yet.</Empty>
        ) : (
          <>
            <div style={{ display: 'flex', gap: 28, flexWrap: 'wrap', alignItems: 'flex-end', marginBottom: 14 }}>
              {[
                ['Instructors', rows.length, 'assigned'],
                ['Your units', Math.round(mineSum * 10) / 10, 'units'],
                ['Average fit', avgFit, 'out of 100'],
              ].map(([l, v, u]) => (
                <div key={l}>
                  <div style={{ fontSize: 10, fontWeight: 700, letterSpacing: '.5px', textTransform: 'uppercase', color: 'var(--muted2)' }}>{l}</div>
                  <div style={{ fontSize: 22, fontWeight: 800, color: 'var(--ink)', fontFamily: "'Sora',sans-serif", lineHeight: 1.2, marginTop: 3 }}>
                    {dash(v)} <span style={{ fontSize: 13, fontWeight: 600, color: 'var(--muted2)' }}>{u}</span>
                  </div>
                </div>
              ))}
            </div>

            <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', alignItems: 'center', marginBottom: 12 }}>
              <FilterChip label="All" count={rows.length} active={filter === 'all'} onClick={() => setFilter('all')} />
              <FilterChip label="Over cap" count={counts.over} color={C.red} active={filter === 'over'} onClick={() => setFilter(filter === 'over' ? 'all' : 'over')} />
              <FilterChip label="Near cap" count={counts.near} color={C.amber} active={filter === 'near'} onClick={() => setFilter(filter === 'near' ? 'all' : 'near')} />
              <FilterChip label="Low fit" count={counts.low} color={C.purple} active={filter === 'low'} onClick={() => setFilter(filter === 'low' ? 'all' : 'low')} />
              <div style={{ flex: 1 }} />
              <select value={sort} onChange={(e) => setSort(e.target.value)} style={{ ...ctrlBase, cursor: 'pointer' }}>
                {SORTS.map((s) => <option key={s.k} value={s.k}>{s.l}</option>)}
              </select>
            </div>

            <div style={{ display: 'flex', gap: 16, flexWrap: 'wrap', fontSize: 10.5, color: 'var(--muted2)', fontWeight: 600, marginBottom: 8 }}>
              <span><i style={{ display: 'inline-block', width: 9, height: 9, borderRadius: 2, marginRight: 6, background: 'var(--meadow)' }} />Your program</span>
              <span><i style={{ display: 'inline-block', width: 9, height: 9, borderRadius: 2, marginRight: 6, background: 'var(--muted2)', opacity: .55 }} />Other approved programs</span>
              <span><i style={{ display: 'inline-block', width: 2, height: 11, marginRight: 6, background: 'var(--ink)', verticalAlign: '-1px' }} />Unit cap</span>
            </div>

            <div className="ca-scroll" style={{ maxHeight: 480 }}>
              {visible.length === 0 && (
                <div style={{ padding: 24, textAlign: 'center', fontSize: 12, color: 'var(--muted2)' }}>No instructors match this filter.</div>
              )}
              {visible.map((r) => {
                const open = openName === r.name
                const mineW = (r.mineUnits / scale) * 100
                const elseW = (r.elsewhereUnits / scale) * 100
                const capX  = r.cap ? (r.cap / scale) * 100 : null
                const fitC  = bandKeyColor(r.band, r.satisfaction)
                const unitC = r.overloaded ? C.red : r.nearCap ? AMBER_TEXT : 'var(--ink)'
                return (
                  <div className="ca-row" key={r.name}>
                    <div onClick={() => setOpen(open ? null : r.name)}
                      style={{ display: 'grid', gridTemplateColumns: '180px minmax(0,1fr) 96px 46px', gap: 14, alignItems: 'center', padding: '9px 12px', cursor: 'pointer', background: open ? 'var(--hover)' : 'transparent' }}>
                      <div style={{ minWidth: 0 }}>
                        <div style={{ fontSize: 12, fontWeight: 600, color: 'var(--ink)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }} title={r.name}>{r.name}</div>
                        <div style={{ fontSize: 10, color: 'var(--muted2)', marginTop: 1 }}>
                          {r.status}{r.courses ? ` · ${plural(r.courses, 'course')}` : ''}
                        </div>
                      </div>

                      <div style={{ position: 'relative', height: 12, borderRadius: 99, background: 'var(--hover)', overflow: 'hidden' }}>
                        <div style={{ position: 'absolute', top: 2, bottom: 2, left: 0, width: `${mineW}%`, background: 'var(--meadow)', borderRadius: '99px 0 0 99px', transition: 'width .5s ease' }} />
                        <div style={{ position: 'absolute', top: 2, bottom: 2, left: `${mineW}%`, width: `${elseW}%`, background: r.overloaded ? C.red : 'var(--muted2)', opacity: r.overloaded ? 1 : .55 }} />
                        {capX !== null && <div style={{ position: 'absolute', top: 0, bottom: 0, left: `${capX}%`, width: 2, marginLeft: -1, background: 'var(--ink)', opacity: 0.55 }} />}
                      </div>

                      <div style={{ textAlign: 'right', lineHeight: 1.25 }}>
                        <div style={{ fontSize: 12, fontWeight: 800, color: unitC }}>
                          {r.totalUnits}<span style={{ fontWeight: 500, color: 'var(--muted2)' }}> / {dash(r.cap)}u</span>
                        </div>
                        {r.elsewhereUnits > 0 && <div style={{ fontSize: 10, color: 'var(--muted2)' }}>{r.mineUnits} yours</div>}
                      </div>

                      <span style={{ textAlign: 'right', fontSize: 13, fontWeight: 800, color: fitC, fontFamily: "'Sora',sans-serif" }} title="Fit score">
                        {r.satisfaction}
                      </span>
                    </div>

                    {open && (
                      <div style={{ padding: '4px 14px 12px 12px', background: 'var(--hover)', display: 'flex', flexWrap: 'wrap', gap: 6, alignItems: 'center' }}>
                        <span style={{ fontSize: 10.5, fontWeight: 700, color: 'var(--muted2)' }}>{plural(r.sessions, 'session')} · Fit</span>
                        <ScoreChip label="Spec" value={r.specScore} />
                        <ScoreChip label="Days" value={r.dayScore} />
                        <ScoreChip label="Hours" value={r.timeScore} />
                      </div>
                    )}
                  </div>
                )
              })}
            </div>
            <div style={{ fontSize: 10.5, color: 'var(--muted2)', marginTop: 8 }}>
              Showing {visible.length} of {rows.length} instructors. Click a row for its fit breakdown.
            </div>
            <InsightNote text={insight} type={over.length ? 'warn' : 'info'} />
          </>
        )}
      </div>
    </Card>
  )
}

// ── Week shape: daily volume + busiest hours ─────────────────────────────────
function DayVolumeCard({ byDay }) {
  const data = useMemo(
    () => byDay.map((d) => ({ ...d, day: capDay(d.day), sessions: d.sessions ?? d.count ?? 0 })),
    [byDay]
  )
  const peak = [...data].sort((a, b) => b.sessions - a.sessions)[0]
  return (
    <Card>
      <CardHeader title="Daily Session Volume" subtitle="Number of scheduled sessions per weekday" />
      <div style={{ padding: 18, minHeight: 340 }}>
        {data.length === 0 ? <Empty>No dated sessions.</Empty> : (
          <>
            <ResponsiveContainer width="100%" height={260}>
              <BarChart data={data} margin={{ top: 20, right: 8, left: 0, bottom: 8 }}>
                <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="var(--hover)" />
                <XAxis dataKey="day" axisLine={false} tickLine={false}
                  tick={{ fill: 'var(--muted)', fontSize: 12, fontFamily: 'Poppins', dy: 8 }} />
                <YAxis axisLine={false} tickLine={false} allowDecimals={false}
                  tick={{ fill: 'var(--muted2)', fontSize: 11, fontFamily: 'Poppins' }} />
                <Tooltip cursor={{ fill: 'rgba(0,0,0,0.04)' }} content={<StandardTooltip />} />
                <Bar dataKey="sessions" radius={[6, 6, 0, 0]} maxBarSize={52}>
                  {data.map((d, i) => <Cell key={i} fill={DAY_COLORS[d.day] ?? C.green} />)}
                  <LabelList dataKey="sessions" position="top"
                    style={{ fill: 'var(--ink)', fontSize: 11, fontWeight: 700, fontFamily: 'Poppins' }} />
                </Bar>
              </BarChart>
            </ResponsiveContainer>
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: '6px 14px', marginTop: 12 }}>
              {data.map((d, i) => (
                <div key={i} style={{ display: 'flex', alignItems: 'center', gap: 5 }}>
                  <div style={{ width: 8, height: 8, borderRadius: 2, background: DAY_COLORS[d.day] ?? C.green }} />
                  <span style={{ fontSize: 11, color: 'var(--muted)', fontWeight: 600 }}>{d.day}</span>
                </div>
              ))}
            </div>
            {peak && <InsightNote text={`Your week peaks on ${peak.day} with ${peak.sessions} sessions. Consider moving flexible sessions to lighter days.`} />}
          </>
        )}
      </div>
    </Card>
  )
}

function HeatmapCard({ cells, days }) {
  const hourLabel = (h) => `${h % 12 || 12}${h < 12 ? 'a' : 'p'}`
  const hours = useMemo(() => {
    if (!cells?.length) return []
    const lo = Math.min(...cells.map((c) => c.hour))
    const hi = Math.max(...cells.map((c) => c.hour))
    return Array.from({ length: hi - lo + 1 }, (_, i) => lo + i)
  }, [cells])
  const map = useMemo(() => {
    const m = {}
    ;(cells || []).forEach((c) => { m[`${c.day}|${c.hour}`] = c.count })
    return m
  }, [cells])
  const max  = Math.max(1, ...(cells || []).map((c) => c.count))
  const peak = (cells || []).reduce((a, c) => (c.count > (a?.count ?? 0) ? c : a), null)
  const dayList = days.length ? days : ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday']

  return (
    <Card>
      <CardHeader title="Busiest Hours" subtitle="Classes in session for each day and hour" />
      <div style={{ padding: 18, minHeight: 340 }}>
        {!hours.length ? <Empty>No timed sessions yet.</Empty> : (
          <>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
              <div style={{ display: 'flex', gap: 4, paddingLeft: 38 }}>
                {hours.map((h) => (
                  <div key={h} style={{ flex: 1, textAlign: 'center', fontSize: 9.5, fontWeight: 700, color: 'var(--muted2)' }}>{hourLabel(h)}</div>
                ))}
              </div>
              {dayList.map((d) => (
                <div key={d} style={{ display: 'flex', gap: 4, alignItems: 'center' }}>
                  <div style={{ width: 34, fontSize: 10.5, fontWeight: 700, color: 'var(--muted)' }}>{d.slice(0, 3)}</div>
                  {hours.map((h) => {
                    const n = map[`${d}|${h}`] || 0
                    const k = n / max
                    return (
                      <div key={h} title={`${d} ${hourLabel(h)}: ${n} class${n === 1 ? '' : 'es'}`}
                        style={{ flex: 1, height: 32, borderRadius: 6, background: 'var(--hover)', position: 'relative', overflow: 'hidden' }}>
                        {n > 0 && <div style={{ position: 'absolute', inset: 0, background: 'var(--meadow)', opacity: 0.18 + 0.82 * k }} />}
                        {n > 0 && (
                          <span style={{ position: 'relative', display: 'flex', alignItems: 'center', justifyContent: 'center', height: '100%', fontSize: 10, fontWeight: 800, color: k > 0.5 ? '#fff' : 'var(--ink)' }}>{n}</span>
                        )}
                      </div>
                    )
                  })}
                </div>
              ))}
            </div>
            <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginTop: 12, fontSize: 10, color: 'var(--muted2)', fontWeight: 600 }}>
              Fewer
              <div style={{ display: 'flex', gap: 2 }}>
                {[0.18, 0.4, 0.62, 0.85, 1].map((o) => (
                  <div key={o} style={{ width: 16, height: 8, borderRadius: 2, background: 'var(--meadow)', opacity: o }} />
                ))}
              </div>
              More
            </div>
            {peak && (
              <InsightNote text={`The busiest slot is ${peak.day} around ${hourLabel(peak.hour)}, with ${peak.count} classes running at once.`} />
            )}
          </>
        )}
      </div>
    </Card>
  )
}

// ── Sections (what students get) ─────────────────────────────────────────────
function Sections({ rows }) {
  const heavy = rows.filter((r) => r.maxDayHours >= 8)
  const idle  = [...rows].sort((a, b) => b.gapHours - a.gapHours)[0]
  const insight = !rows.length ? null
    : heavy.length
      ? `${plural(heavy.length, 'section')} ${heavy.length === 1 ? 'has' : 'have'} a day of 8 hours or more, the longest being ${[...heavy].sort((a, b) => b.maxDayHours - a.maxDayHours)[0].section}.`
      : idle && idle.gapHours > 0
        ? `${idle.section} has the most idle time between classes (${idle.gapHours}h a week across ${plural(idle.longGaps, 'long gap')}).`
        : 'Student days look compact. No section has a very long day or big gaps.'
  const tone = (bad) => (bad ? { color: AMBER_TEXT, fontWeight: 700 } : null)

  return (
    <Card>
      <CardHeader
        title="Sections"
        subtitle="What students actually get. Long gap = 1.5h or more between classes."
        right={heavy.length > 0 && <Pill color={AMBER_TEXT} soft={SOFT.amber}>{heavy.length} long day{heavy.length > 1 ? 's' : ''}</Pill>}
      />
      {!rows.length ? <Empty>No sections to show.</Empty> : (
        <>
          <div style={{ overflowX: 'auto' }}>
            <table className="ca-table">
              <thead>
                <tr>
                  <th>Section</th><th className="num">Sessions</th><th className="num">Hrs / week</th>
                  <th className="num">Days</th><th className="num">Longest day</th>
                  <th className="num">Long gaps</th><th className="num">Idle hrs</th>
                </tr>
              </thead>
              <tbody>
                {rows.map((r) => (
                  <tr key={r.section}>
                    <td><strong style={{ color: 'var(--ink)' }}>{r.section}</strong></td>
                    <td className="num">{r.sessions}</td>
                    <td className="num">{r.hours}</td>
                    <td className="num">{r.days}</td>
                    <td className="num" style={tone(r.maxDayHours >= 8)}>{r.maxDayHours}h</td>
                    <td className="num" style={r.longGaps ? tone(true) : { color: 'var(--muted2)' }}>{r.longGaps}</td>
                    <td className="num" style={tone(r.gapHours >= 6)}>{r.gapHours}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <div style={{ padding: '0 18px 18px' }}>
            <InsightNote text={insight} type={heavy.length ? 'warn' : 'info'} />
          </div>
        </>
      )}
    </Card>
  )
}

// ── Rooms ────────────────────────────────────────────────────────────────────
function RoomUsageCard({ rooms }) {
  const max  = Math.max(1, ...rooms.rows.map((r) => r.hours))
  const top  = [...rooms.rows].sort((a, b) => b.hours - a.hours)[0]
  const insight = top && top.sessions > 0
    ? `${top.room} is the busiest room at ${top.hours}h of ${rooms.windowHours}h available each week.${rooms.idle ? ` ${plural(rooms.idle, 'room')} ${rooms.idle === 1 ? 'is' : 'are'} not used at all.` : ''}`
    : null
  return (
    <Card>
      <CardHeader
        title="Room Usage"
        subtitle={`Hours booked per room · ${rooms.windowHours}h available / week`}
        right={rooms.idle > 0 && <Pill color={AMBER_TEXT} soft={SOFT.amber}>{rooms.idle} unused</Pill>}
      />
      <div style={{ padding: 18, minHeight: 260 }}>
        {rooms.rows.length === 0 ? <Empty>No rooms in use.</Empty> : (
          <>
            <div className="ca-scroll" style={{ maxHeight: 400, padding: '10px 12px' }}>
              {rooms.rows.map((r, i) => (
                <div key={r.room} style={{ display: 'grid', gridTemplateColumns: '92px minmax(0,1fr) 56px', gap: 12, alignItems: 'center', padding: '5px 0' }}>
                  <span className="ca-mono" title={r.type || ''} style={{ fontSize: 11.5, fontWeight: 700, color: 'var(--ink)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{short(r.room)}</span>
                  <div style={{ height: 10, borderRadius: 99, background: 'var(--hover)', overflow: 'hidden' }}>
                    <div style={{ height: '100%', width: `${(r.hours / max) * 100}%`, borderRadius: 99, background: PALETTE[i % PALETTE.length], transition: 'width .5s ease' }} />
                  </div>
                  <span style={{ textAlign: 'right', fontSize: 11.5, fontWeight: 800, color: r.sessions === 0 ? 'var(--muted2)' : 'var(--ink)' }}>
                    {r.sessions === 0 ? <span style={{ fontWeight: 500 }}>unused</span> : `${r.hours}h`}
                  </span>
                </div>
              ))}
            </div>
            {!rooms.hasSelection && (
              <div style={{ fontSize: 10.5, color: 'var(--muted2)', marginTop: 8 }}>
                No room selection saved, so the solver could use any room. Save one on the Rooms page to see unused rooms here.
              </div>
            )}
            <InsightNote text={insight} />
          </>
        )}
      </div>
    </Card>
  )
}

const ROOM_STATUS = {
  respected: { label: 'Honored',     color: C.green },
  partial:   { label: 'Partly',      color: C.amber },
  broken:    { label: 'Not honored', color: C.red },
}

function RoomComplianceCard({ compliance: c }) {
  const issues = c.rows
  const insight = !c.sessionsWithPref ? null
    : issues.length === 0
      ? `All ${c.sessionsWithPref} sessions with an assigned room are in that room.`
      : `${plural(issues.length, 'course')} ${issues.length === 1 ? 'has' : 'have'} sessions outside the assigned room. Check for a clash in that room, or a manual edit made after solving.`
  return (
    <Card>
      <CardHeader
        title="Assigned Room Compliance"
        subtitle="Do sessions land in the room their course was assigned?"
        right={issues.length > 0 && <Pill color={AMBER_TEXT} soft={SOFT.amber}>{issues.length} off room</Pill>}
      />
      <div style={{ padding: 18, minHeight: 260 }}>
        {c.sessionsWithPref === 0 ? (
          <Empty>None of your courses has a preferred room, so there is nothing to check.</Empty>
        ) : (
          <>
            <div style={{ display: 'flex', alignItems: 'center', gap: 16, marginBottom: 16 }}>
              <Ring value={c.respectPct} suffix="%" sub="honored" size={96} stroke={10} />
              <div>
                <div style={{ fontSize: 13, fontWeight: 800, color: 'var(--ink)' }}>
                  {dash(c.respectPct, '%')} of {c.sessionsWithPref} sessions
                </div>
                <div style={{ fontSize: 11.5, color: 'var(--muted)', marginTop: 3, lineHeight: 1.5 }}>
                  are in the room their course was assigned.
                </div>
              </div>
            </div>
            {issues.length === 0 ? (
              <Empty ok pad="18px 12px">Every session with a preferred room is in it.</Empty>
            ) : (
              <div className="ca-scroll" style={{ maxHeight: 320 }}>
                {issues.map((r) => {
                  const st = ROOM_STATUS[r.status] || ROOM_STATUS.partial
                  const wanted = [...new Set([r.preferredLec, r.preferredLab].flatMap((s) => String(s || '').split(',')).map((s) => s.trim()).filter(Boolean))]
                  const wantedLower = wanted.map((w) => w.toLowerCase())
                  return (
                    <div className="ca-row" key={r.courseCode} style={{ padding: '10px 12px', display: 'flex', alignItems: 'center', gap: 10 }}>
                      <div style={{ flex: 1, minWidth: 0 }}>
                        <span className="ca-mono" style={{ fontSize: 12, fontWeight: 700, color: 'var(--ink)' }}>{r.courseCode}</span>
                        <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap', alignItems: 'center', marginTop: 6 }}>
                          <span style={{ fontSize: 10, fontWeight: 700, color: 'var(--muted2)' }}>Assigned</span>
                          {wanted.length ? wanted.map((w) => <RoomChip key={w} name={w} />) : <span style={{ fontSize: 10.5, color: 'var(--muted2)' }}>—</span>}
                          <span style={{ fontSize: 10, fontWeight: 700, color: 'var(--muted2)', marginLeft: 6 }}>Used</span>
                          {r.rooms.length
                            ? r.rooms.map((x) => <RoomChip key={x} name={x} good={wantedLower.includes(x.toLowerCase())} />)
                            : <span style={{ fontSize: 10.5, color: 'var(--muted2)' }}>no room</span>}
                        </div>
                      </div>
                      <div style={{ width: 84, flexShrink: 0, textAlign: 'right' }}>
                        <div style={{ fontSize: 12, fontWeight: 800, color: st.color }}>{r.violated}/{r.sessions}</div>
                        <div style={{ fontSize: 9.5, fontWeight: 700, color: st.color, marginTop: 2 }}>{st.label}</div>
                      </div>
                    </div>
                  )
                })}
              </div>
            )}
            <InsightNote text={insight} type={issues.length ? 'warn' : 'info'} />
          </>
        )}
      </div>
    </Card>
  )
}

// ── Top-bar schedule picker (mirrors admin SchedulePill) ─────────────────────
function DraftPill({ schedules, value, onChange }) {
  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 5, padding: '4px 10px', borderRadius: 99, background: 'var(--surface)', border: '1px solid var(--border)' }}>
      <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="var(--muted)" strokeWidth="2.5" style={{ flexShrink: 0 }}>
        <rect x="3" y="4" width="18" height="18" rx="2" /><line x1="16" y1="2" x2="16" y2="6" />
        <line x1="8" y1="2" x2="8" y2="6" /><line x1="3" y1="10" x2="21" y2="10" />
      </svg>
      <select value={value || ''} onChange={(e) => onChange(e.target.value)}
        style={{ background: 'transparent', border: 'none', outline: 'none', fontSize: 10.5, fontWeight: 600, color: 'var(--muted)', cursor: 'pointer', maxWidth: 220, fontFamily: 'inherit', padding: 0 }}>
        {schedules.map((s) => (
          <option key={s.id} value={s.id} style={{ background: 'var(--surface)', color: 'var(--ink)' }}>
            {s.name || 'Untitled'} ({s.status})
          </option>
        ))}
      </select>
    </div>
  )
}

// ── Page ─────────────────────────────────────────────────────────────────────
export default function CoordAnalyticsPage() {
  const [params, setParams] = useSearchParams()
  const wanted = useRef(params.get('schedule'))

  const [overview, setOverview] = useState(null)
  const [detail, setDetail] = useState(null)
  const [selectedId, setSelectedId] = useState(null)
  const [loadingOv, setLoadingOv] = useState(true)
  const [loadingDt, setLoadingDt] = useState(false)
  const [error, setError] = useState(null)
  const [tick, setTick] = useState(0)

  const loadOverview = useCallback(async () => {
    setLoadingOv(true)
    setError(null)
    try {
      const o = await coordGetAnalyticsOverview()
      setOverview(o)
      // The overview only lists the active term (newest 10), so a linked or picked
      // schedule may not be in it. The detail endpoint validates ownership, so keep it.
      setSelectedId((prev) => prev || wanted.current || o.defaultId)
    } catch (e) {
      setError(e?.response?.data?.detail || e?.message || 'Could not load analytics.')
    } finally {
      setLoadingOv(false)
    }
  }, [])

  useEffect(() => { loadOverview() }, [loadOverview, tick])

  useEffect(() => {
    if (!selectedId) { setDetail(null); return }
    let alive = true
    setLoadingDt(true)
    setParams({ schedule: selectedId }, { replace: true })
    coordGetAnalytics(selectedId)
      .then((d) => { if (alive) { setDetail(d); setError(null) } })
      .catch((e) => { if (alive) setError(e?.response?.data?.detail || e?.message || 'Could not load this schedule.') })
      .finally(() => { if (alive) setLoadingDt(false) })
    return () => { alive = false }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selectedId, tick])

  const pick = useCallback((id) => { wanted.current = id; setSelectedId(id) }, [])

  // Picker list: the overview's drafts, plus the selected schedule if it lives outside them
  const outsideOverview = !!(selectedId && overview && !overview.schedules.some((s) => s.id === selectedId))
  const pickerList = useMemo(() => {
    const list = overview?.schedules || []
    if (outsideOverview && detail?.schedule?.id === selectedId) {
      return [{ id: selectedId, name: detail.schedule.name, status: detail.schedule.status }, ...list]
    }
    return list
  }, [overview, outsideOverview, detail, selectedId])

  const busy = loadingOv || loadingDt
  const activeTerm = overview?.term ? `${overview.term.semester || ''} ${overview.term.academicYear || ''}`.trim() : 'All terms'
  const termLabel = outsideOverview && detail?.schedule
    ? `${detail.schedule.semester || ''} ${detail.schedule.academicYear || ''}`.trim() || activeTerm
    : activeTerm
  const noSchedules = !loadingOv && overview && overview.schedules.length === 0 && !selectedId
  const loadingStats = loadingOv || loadingDt || !detail
  const hasContent = detail && !loadingDt && detail.readiness.verdict !== 'empty'

  // Stat-card numbers, derived from the selected schedule
  const stats = useMemo(() => {
    if (!detail) return null
    return {
      sessions: detail.summary.sessions,
      sections: detail.summary.sections,
      instructors: detail.summary.faculty,
      conflicts: detail.conflicts?.totalPairs ?? 0,
      tba: (detail.tbaCourses || []).reduce((n, t) => n + (t.sessions || 0), 0),
      over: (detail.faculty || []).filter((f) => f.overloaded).length,
    }
  }, [detail])

  return (
    <div className="ca-root">
      <style>{STYLE}</style>

      {/* ── Top control bar (same layout as admin Analytics) ── */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 12, flexWrap: 'wrap' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
          <div style={{ fontSize: 11.5, fontWeight: 600, color: 'var(--muted)', padding: '4px 12px', borderRadius: 99, background: 'var(--surface)', border: '1px solid var(--border)' }}>
            {loadingOv
              ? <Skel w={110} h={10} r={5} style={{ display: 'inline-block' }} />
              : <><span style={{ fontWeight: 700, color: C.green }}>{overview?.programCode || 'Program'}</span> · {termLabel}</>}
          </div>
          {pickerList.length > 0 && (
            <DraftPill schedules={pickerList} value={selectedId} onChange={pick} />
          )}
          {outsideOverview && detail && (
            <Pill color={AMBER_TEXT} soft={SOFT.amber}>Outside the active term</Pill>
          )}
        </div>

        <button
          type="button"
          className="ca-refresh"
          disabled={busy}
          onClick={() => setTick((t) => t + 1)}
          style={{
            background: 'var(--surface)', color: C.green, border: '1px solid var(--border)',
            borderRadius: 8, padding: '6px 14px', fontSize: 12, fontWeight: 600,
            cursor: busy ? 'not-allowed' : 'pointer', fontFamily: 'inherit',
            display: 'flex', alignItems: 'center', gap: 6, opacity: busy ? 0.6 : 1,
            transition: 'all 0.15s ease',
          }}
        >
          <svg className={busy ? 'ca-spin' : ''} width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
            <polyline points="23 4 23 10 17 10" /><path d="M20.49 15a9 9 0 1 1-2.12-9.36L23 10" />
          </svg>
          Refresh
        </button>
      </div>

      {error && (
        <div style={{ padding: '12px 16px', borderRadius: 10, background: 'rgba(220, 38, 38, 0.05)', border: '1px solid rgba(220, 38, 38, 0.25)', color: C.red, fontSize: 12.5, lineHeight: 1.5 }}>
          <strong style={{ marginRight: 6 }}>Error:</strong>{error}
        </div>
      )}

      {noSchedules && (
        <Card>
          <CardHeader title="No saved schedules" subtitle="Nothing to analyse for this term yet" />
          <Empty pad="32px 18px">
            You have no saved schedules for this term yet. Generate one and save it as a draft, then come back here to check it before you submit.
            <div style={{ marginTop: 12 }}><Link className="ca-link" to="/coordinator/scheduler">Go to the scheduler →</Link></div>
          </Empty>
        </Card>
      )}

      {!noSchedules && (
        <>
          {/* ── System health stat cards ── */}
          <div className="ca-stats">
            <StatCard
              label="Sessions" sub={stats ? `${stats.sections} sections · ${stats.instructors} instructors` : ''}
              value={stats?.sessions ?? 0} color={C.green} bg={SOFT.green} loading={loadingStats}
              icon={<svg width="19" height="19" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M22 11.08V12a10 10 0 1 1-5.93-9.14" /><polyline points="22 4 12 14.01 9 11.01" /></svg>}
            />
            <StatCard
              label="Conflicts" sub="Room / instructor clashes"
              value={stats?.conflicts ?? 0} color={C.red} bg={SOFT.red} loading={loadingStats}
              icon={<svg width="19" height="19" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><polygon points="7.86 2 16.14 2 22 7.86 22 16.14 16.14 22 7.86 22 2 16.14 2 7.86 7.86 2" /><line x1="12" y1="8" x2="12" y2="12" /><line x1="12" y1="16" x2="12.01" y2="16" /></svg>}
            />
            <StatCard
              label="TBA / Unassigned" sub="Sessions missing an instructor"
              value={stats?.tba ?? 0} color={C.amber} bg="rgba(217, 119, 6, 0.1)" loading={loadingStats}
              icon={<svg width="19" height="19" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><circle cx="12" cy="12" r="10" /><line x1="12" y1="8" x2="12" y2="12" /><line x1="12" y1="16" x2="12.01" y2="16" /></svg>}
            />
            <StatCard
              label="Over Unit Cap" sub={stats ? `of ${stats.instructors} instructors` : ''}
              value={stats?.over ?? 0} color={C.blue} bg={SOFT.blue} loading={loadingStats}
              icon={<svg width="19" height="19" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2" /><circle cx="9" cy="7" r="4" /><path d="M23 21v-2a4 4 0 0 0-3-3.87" /><path d="M16 3.13a4 4 0 0 1 0 7.75" /></svg>}
            />
          </div>

          {/* ── Readiness ── */}
          {loadingDt || !detail
            ? <Card><CardHeader title="Submission Readiness" subtitle="Can this schedule be submitted as it is?" /><SectionSkel rows={6} /></Card>
            : detail.readiness.verdict === 'empty'
              ? <Card><CardHeader title="Submission Readiness" /><Empty>This schedule has no sessions yet.</Empty></Card>
              : <Readiness d={detail} scheduleId={detail.schedule.id} externalPrograms={detail.externalPrograms} />}

          {/* ── Drafts compared ── */}
          {overview?.schedules?.length > 1 && (
            <Compare overview={overview} selectedId={selectedId} onPick={pick} />
          )}

          {hasContent && (
            <>
              <Conflicts c={detail.conflicts} />
              <Staffing tba={detail.tbaCourses} risks={detail.staffingRisks} />
              <FacultyLedger rows={detail.faculty} />

              <div className="ca-grid2">
                <DayVolumeCard byDay={detail.byDay} />
                <HeatmapCard cells={detail.heatmap} days={detail.byDay.map((d) => d.day)} />
              </div>

              <Sections rows={detail.sections} />

              <div className="ca-grid2">
                <RoomUsageCard rooms={detail.rooms} />
                <RoomComplianceCard compliance={detail.rooms.compliance} />
              </div>
            </>
          )}

          {loadingDt && detail && (
            <>
              <Card><SectionSkel rows={4} /></Card>
              <Card><SectionSkel rows={5} /></Card>
            </>
          )}
        </>
      )}
    </div>
  )
}