import { useEffect, useState, useRef } from 'react'
import { getAssignmentQuality, getWorkload, getFacultyPreview, listSaved, loadSaved } from '../../services/api'

/* ─────────────────────────────────────────────
   Global keyframes (injected once)
───────────────────────────────────────────── */
if (!document.getElementById('analytics-style')) {
  const s = document.createElement('style')
  s.id = 'analytics-style'
  s.textContent = `
    @keyframes spin { to { transform: rotate(360deg) } }
    @keyframes fadeUp { from { opacity:0; transform:translateY(10px) } to { opacity:1; transform:translateY(0) } }
    @keyframes shimmer {
      0%   { background-position: -400px 0 }
      100% { background-position:  400px 0 }
    }
    @keyframes countUp {
      from { opacity: 0; transform: translateY(6px) }
      to   { opacity: 1; transform: translateY(0) }
    }
    .analytics-tab {
      padding: 8px 18px; border-radius: 9px; border: none;
      font-family: 'Poppins', sans-serif; font-size: 13px; font-weight: 500;
      cursor: pointer; background: transparent; color: #8883B0;
      transition: all 0.15s; white-space: nowrap;
    }
    .analytics-tab:hover { background: #F0EDF9; color: #3D3580; }
    .analytics-tab.active { background: #7C6FCD; color: #fff; box-shadow: 0 3px 10px rgba(124,111,205,0.3); }
    .analytics-tab .tab-badge {
      display: inline-flex; align-items: center; justify-content: center;
      width: 17px; height: 17px; border-radius: 50%;
      font-size: 9px; font-weight: 700; margin-left: 6px;
    }
    .analytics-tab.active .tab-badge { background: rgba(255,255,255,0.25); color: #fff; }
    .analytics-tab .tab-badge { background: #E8E4F8; color: #7C6FCD; }
    .analytics-tab.active.warn-tab .tab-badge { background: rgba(255,100,100,0.25); color: #fff; }
    .analytics-tab.warn-tab .tab-badge { background: #FFE8E8; color: #C0392B; }
    .kpi-card { animation: fadeUp 0.35s ease both; }
    .kpi-card:nth-child(1) { animation-delay: 0.04s }
    .kpi-card:nth-child(2) { animation-delay: 0.09s }
    .kpi-card:nth-child(3) { animation-delay: 0.14s }
    .kpi-card:nth-child(4) { animation-delay: 0.19s }
    .section-enter { animation: fadeUp 0.3s ease both; }
    .skeleton-pulse {
      background: linear-gradient(90deg, #F0EDF9 25%, #E8E4F8 50%, #F0EDF9 75%);
      background-size: 400px 100%;
      animation: shimmer 1.4s infinite linear;
      border-radius: 8px;
    }
    .row-hover:hover td { background: #FAFAFE !important; }
    .expand-row { cursor: pointer; transition: background 0.12s; }
    .expand-row:hover { background: #FAFAFE; }
    .pill-chip {
      display: inline-flex; align-items: center;
      padding: 3px 10px; border-radius: 99px;
      font-size: 11px; font-weight: 600;
      background: #EEEAFB; color: #7C6FCD;
      transition: background 0.15s;
    }
    .pill-chip:hover { background: #D8D3F5; }
    .refresh-btn {
      display: flex; align-items: center; gap: 6px;
      padding: 7px 14px; border-radius: 9px;
      border: 1px solid #E8E4F8; background: #fff;
      color: #7C6FCD; font-size: 12.5px; font-weight: 500;
      font-family: 'Poppins', sans-serif; cursor: pointer;
      transition: all 0.15s;
    }
    .refresh-btn:hover { background: #F0EDF9; border-color: #D8D3F5; }
    .refresh-btn:disabled { opacity: 0.5; cursor: not-allowed; }
    .search-input-wrap { position: relative; }
    .search-input-wrap svg { position: absolute; left: 10px; top: 50%; transform: translateY(-50%); pointer-events: none; }
    .search-input-wrap input { padding-left: 32px !important; }
    .sort-btn {
      background: none; border: none; cursor: pointer; padding: 3px 6px;
      border-radius: 5px; color: #B0ABCC; transition: all 0.12s;
      font-family: 'Poppins', sans-serif;
    }
    .sort-btn:hover { background: #F0EDF9; color: #7C6FCD; }
    .sort-btn.active { color: #7C6FCD; }
    .alert-banner {
      display: flex; align-items: flex-start; gap: 10px;
      padding: 12px 16px; border-radius: 12px; margin-bottom: 20px;
      animation: fadeUp 0.3s ease;
    }
    .progress-ring-track { stroke: #F0EDF9; }
    .progress-ring-fill { transition: stroke-dashoffset 1s cubic-bezier(.4,0,.2,1); }
  `
  document.head.appendChild(s)
}

/* ─────────────────────────────────────────────
   Skeleton loader
───────────────────────────────────────────── */
function Skeleton({ w = '100%', h = 16, style = {} }) {
  return <div className="skeleton-pulse" style={{ width: w, height: h, ...style }} />
}

function SkeletonPage() {
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4,1fr)', gap: 16 }}>
        {[...Array(4)].map((_, i) => (
          <div key={i} style={{ background: '#fff', borderRadius: 16, padding: '20px', border: '1px solid #E8E4F8', display: 'flex', flexDirection: 'column', gap: 12 }}>
            <Skeleton w={36} h={36} style={{ borderRadius: 10 }} />
            <Skeleton w="55%" h={28} />
            <Skeleton w="70%" h={12} />
          </div>
        ))}
      </div>
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16 }}>
        {[...Array(2)].map((_, i) => (
          <div key={i} style={{ background: '#fff', borderRadius: 16, padding: '24px', border: '1px solid #E8E4F8', display: 'flex', gap: 20, alignItems: 'center' }}>
            <Skeleton w={80} h={80} style={{ borderRadius: '50%', flexShrink: 0 }} />
            <div style={{ flex: 1, display: 'flex', flexDirection: 'column', gap: 8 }}>
              <Skeleton w="60%" h={14} />
              <Skeleton w="80%" h={12} />
              <Skeleton w="40%" h={12} />
            </div>
          </div>
        ))}
      </div>
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16 }}>
        {[...Array(2)].map((_, i) => (
          <div key={i} style={{ background: '#fff', borderRadius: 16, border: '1px solid #E8E4F8', overflow: 'hidden' }}>
            <div style={{ padding: '16px 20px', borderBottom: '1px solid #F0EDF9' }}>
              <Skeleton w="45%" h={14} />
            </div>
            {[...Array(4)].map((_, j) => (
              <div key={j} style={{ padding: '12px 20px', borderBottom: '1px solid #F5F4FB', display: 'flex', gap: 12, alignItems: 'center' }}>
                <Skeleton w={30} h={30} style={{ borderRadius: '50%', flexShrink: 0 }} />
                <div style={{ flex: 1, display: 'flex', flexDirection: 'column', gap: 6 }}>
                  <Skeleton w="60%" h={12} />
                  <Skeleton w="40%" h={10} />
                </div>
                <Skeleton w={50} h={22} style={{ borderRadius: 99 }} />
              </div>
            ))}
          </div>
        ))}
      </div>
    </div>
  )
}

/* ─────────────────────────────────────────────
   Alert banner
───────────────────────────────────────────── */
function AlertBanner({ overloadCount, warnCount }) {
  const issues = []
  if (overloadCount > 0) issues.push(`${overloadCount} faculty member${overloadCount > 1 ? 's are' : ' is'} overloaded`)
  if (warnCount > 0) issues.push(`${warnCount} course${warnCount > 1 ? 's have' : ' has'} no eligible faculty`)
  if (!issues.length) return null

  return (
    <div className="alert-banner" style={{ background: '#FFF8F0', border: '1px solid #FED7AA' }}>
      <div style={{ width: 34, height: 34, borderRadius: 10, background: '#FEF3CD', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="#D97706" strokeWidth="2">
          <path d="M10.29 3.86L1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z"/>
          <line x1="12" y1="9" x2="12" y2="13"/><line x1="12" y1="17" x2="12.01" y2="17"/>
        </svg>
      </div>
      <div style={{ flex: 1 }}>
        <p style={{ fontSize: 13, fontWeight: 600, color: '#92400E', marginBottom: 2 }}>Attention required</p>
        <p style={{ fontSize: 12, color: '#B45309', lineHeight: 1.5 }}>
          {issues.join(' · ')}. Review the Workload and Eligibility tabs.
        </p>
      </div>
    </div>
  )
}

/* ─────────────────────────────────────────────
   KPI Card
───────────────────────────────────────────── */
function KpiCard({ label, value, sub, icon, color, bg, accent }) {
  const [hov, setHov] = useState(false)
  return (
    <div
      className="kpi-card"
      onMouseEnter={() => setHov(true)}
      onMouseLeave={() => setHov(false)}
      style={{
        background: '#fff', borderRadius: 16, padding: '20px 22px',
        border: `1px solid ${hov ? accent || '#D8D3F5' : '#E8E4F8'}`,
        boxShadow: hov ? `0 8px 28px ${color}22` : '0 2px 10px rgba(124,111,205,0.06)',
        transform: hov ? 'translateY(-3px)' : 'none',
        transition: 'all 0.2s cubic-bezier(.4,0,.2,1)',
        display: 'flex', flexDirection: 'column', gap: 14, position: 'relative', overflow: 'hidden',
      }}
    >
      {/* decorative bg circle */}
      <div style={{ position: 'absolute', top: -24, right: -24, width: 80, height: 80, borderRadius: '50%', background: bg, opacity: 0.6, pointerEvents: 'none' }} />

      <div style={{ width: 40, height: 40, borderRadius: 12, background: bg, display: 'flex', alignItems: 'center', justifyContent: 'center', color, flexShrink: 0 }}>
        {icon}
      </div>
      <div>
        <div style={{ fontSize: 30, fontWeight: 700, color: '#1a1a2e', lineHeight: 1, letterSpacing: '-1px', animation: 'countUp 0.4s ease' }}>
          {value ?? '—'}
        </div>
        <div style={{ fontSize: 12, color: '#8883B0', marginTop: 5, fontWeight: 500 }}>{label}</div>
        {sub && <div style={{ fontSize: 11, color: '#B0ABCC', marginTop: 2 }}>{sub}</div>}
      </div>
    </div>
  )
}

/* ─────────────────────────────────────────────
   Compliance ring
───────────────────────────────────────────── */
function ComplianceRing({ label, value, desc, color, icon }) {
  const pct    = value !== null ? parseFloat(value) : 0
  const radius = 34
  const circ   = 2 * Math.PI * radius
  const offset = circ - (pct / 100) * circ
  const [mounted, setMounted] = useState(false)
  useEffect(() => { const t = setTimeout(() => setMounted(true), 100); return () => clearTimeout(t) }, [])

  const grade = pct >= 80 ? { label: 'Excellent', c: '#059669', bg: '#E6FAF3' }
              : pct >= 60 ? { label: 'Good',      c: '#D97706', bg: '#FEF3CD' }
              :             { label: 'Low',        c: '#C0392B', bg: '#FFE8E8' }

  return (
    <div style={{ background: '#fff', borderRadius: 16, padding: '22px 24px', border: '1px solid #E8E4F8', boxShadow: '0 2px 10px rgba(124,111,205,0.06)', display: 'flex', alignItems: 'center', gap: 20 }}>
      <div style={{ position: 'relative', flexShrink: 0 }}>
        <svg width={88} height={88} viewBox="0 0 88 88">
          <circle cx={44} cy={44} r={radius} fill="none" stroke="#F0EDF9" strokeWidth={8} className="progress-ring-track" />
          <circle
            cx={44} cy={44} r={radius}
            fill="none" stroke={color} strokeWidth={8}
            strokeLinecap="round"
            strokeDasharray={circ}
            strokeDashoffset={mounted && value !== null ? offset : circ}
            transform="rotate(-90 44 44)"
            className="progress-ring-fill"
          />
        </svg>
        <div style={{ position: 'absolute', inset: 0, display: 'flex', alignItems: 'center', justifyContent: 'center', flexDirection: 'column' }}>
          <span style={{ fontSize: 14, fontWeight: 700, color: '#1a1a2e', lineHeight: 1 }}>{value !== null ? `${value}%` : '—'}</span>
        </div>
      </div>
      <div style={{ flex: 1 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 6 }}>
          <p style={{ fontWeight: 700, fontSize: 13.5, color: '#1a1a2e' }}>{label}</p>
          {value !== null && (
            <span style={{ fontSize: 10, fontWeight: 700, padding: '2px 8px', borderRadius: 99, background: grade.bg, color: grade.c }}>
              {grade.label}
            </span>
          )}
        </div>
        <p style={{ fontSize: 12, color: '#8883B0', lineHeight: 1.55 }}>{desc}</p>
      </div>
    </div>
  )
}

/* ─────────────────────────────────────────────
   Score badge
───────────────────────────────────────────── */
function ScoreBadge({ score }) {
  if (score === null || score === undefined) return <span style={{ color: '#B0ABCC', fontSize: 12 }}>—</span>
  const v = parseFloat(score)
  const [bg, color] = v >= 0.70 ? ['#E8F8EE', '#1a6b2c'] : v >= 0.40 ? ['#FEF3CD', '#8a5c00'] : ['#FFE8E8', '#C0392B']
  return (
    <span style={{ display: 'inline-block', padding: '3px 11px', borderRadius: 99, fontSize: 11.5, fontWeight: 700, background: bg, color }}>
      {v.toFixed(2)}
    </span>
  )
}

/* ─────────────────────────────────────────────
   Workload bar row
───────────────────────────────────────────── */
function WorkloadBar({ label, value, max, overloaded }) {
  const pct      = max > 0 ? Math.min((value / max) * 100, 100) : 0
  const initials = label.split(/[\s,]+/).filter(Boolean).map(n => n[0]).join('').slice(0, 2).toUpperCase()
  const barColor = overloaded
    ? 'linear-gradient(90deg,#E74C3C,#C0392B)'
    : pct > 85
      ? 'linear-gradient(90deg,#F39C12,#D97706)'
      : 'linear-gradient(90deg,#A99BE8,#7C6FCD)'

  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 13, padding: '10px 0', borderBottom: '1px solid #F5F4FB' }}>
      <div style={{
        width: 32, height: 32, borderRadius: '50%', flexShrink: 0,
        background: overloaded ? '#FFE8E8' : '#EEEAFB',
        color: overloaded ? '#C0392B' : '#7C6FCD',
        display: 'flex', alignItems: 'center', justifyContent: 'center',
        fontSize: 10, fontWeight: 700,
      }}>{initials}</div>
      <div style={{ flex: 1, minWidth: 0 }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 5, alignItems: 'center' }}>
          <span style={{ fontSize: 12.5, fontWeight: 600, color: '#1a1a2e', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
            {label}
          </span>
          <span style={{ fontSize: 11.5, color: overloaded ? '#C0392B' : '#8883B0', fontWeight: overloaded ? 700 : 400, flexShrink: 0, marginLeft: 8 }}>
            {value} / {max}
          </span>
        </div>
        <div style={{ height: 6, background: '#F0EDF9', borderRadius: 99, overflow: 'hidden' }}>
          <div style={{ height: '100%', width: `${pct}%`, background: barColor, borderRadius: 99, transition: 'width 0.7s cubic-bezier(.4,0,.2,1)' }} />
        </div>
      </div>
      {overloaded
        ? <span style={{ flexShrink: 0, background: '#FFE8E8', color: '#C0392B', fontSize: 10, fontWeight: 700, padding: '2px 8px', borderRadius: 99 }}>Over</span>
        : <span style={{ flexShrink: 0, fontSize: 11, color: '#B0ABCC', minWidth: 36, textAlign: 'right' }}>{Math.round(pct)}%</span>
      }
    </div>
  )
}

/* ─────────────────────────────────────────────
   Faculty eligibility row (expandable)
───────────────────────────────────────────── */
function EligibilityRow({ courseCode, title, poolSize, eligibleFaculty, warning, idx }) {
  const [open, setOpen] = useState(false)
  const canExpand = poolSize > 0

  return (
    <div style={{ borderBottom: '1px solid #F5F4FB', animation: `fadeUp 0.25s ease ${idx * 0.03}s both` }}>
      <div
        className={canExpand ? 'expand-row' : ''}
        onClick={() => canExpand && setOpen(v => !v)}
        style={{ display: 'flex', alignItems: 'center', gap: 12, padding: '11px 20px', cursor: canExpand ? 'pointer' : 'default' }}
      >
        {/* pool size dot */}
        <div style={{
          width: 8, height: 8, borderRadius: '50%', flexShrink: 0,
          background: warning ? '#C0392B' : poolSize >= 3 ? '#27AE60' : '#F39C12',
        }} />
        <div style={{ flex: 1, minWidth: 0 }}>
          <p style={{ fontSize: 13, fontWeight: 600, color: '#1a1a2e', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
            {courseCode}
          </p>
          <p style={{ fontSize: 11, color: '#8883B0', marginTop: 1, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
            {title}
          </p>
        </div>
        <span style={{
          flexShrink: 0, fontSize: 11, fontWeight: 700, padding: '3px 11px', borderRadius: 99,
          background: warning ? '#FFE8E8' : poolSize >= 3 ? '#E8F8EE' : '#FEF3CD',
          color:      warning ? '#C0392B' : poolSize >= 3 ? '#1a6b2c' : '#8a5c00',
        }}>
          {warning ? 'No faculty' : `${poolSize} eligible`}
        </span>
        {canExpand && (
          <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="#B0ABCC" strokeWidth="2"
            style={{ flexShrink: 0, transform: open ? 'rotate(180deg)' : 'none', transition: 'transform 0.2s' }}>
            <polyline points="6 9 12 15 18 9"/>
          </svg>
        )}
      </div>
      {open && (
        <div style={{ padding: '0 20px 12px 40px', display: 'flex', flexWrap: 'wrap', gap: 6, animation: 'fadeUp 0.2s ease' }}>
          {eligibleFaculty.map(name => (
            <span key={name} className="pill-chip">{name}</span>
          ))}
        </div>
      )}
    </div>
  )
}

/* ─────────────────────────────────────────────
   Section: Overview
───────────────────────────────────────────── */
function OverviewSection({ quality }) {
  const KPI_CARDS = [
    {
      label: 'Total sessions', value: quality.totalSessions, sub: 'in current schedule',
      color: '#7C6FCD', bg: '#EEEAFB',
      icon: <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><rect x="3" y="4" width="18" height="18" rx="2"/><line x1="16" y1="2" x2="16" y2="6"/><line x1="8" y1="2" x2="8" y2="6"/><line x1="3" y1="10" x2="21" y2="10"/></svg>,
    },
    {
      label: 'Auto-assigned rate', value: `${quality.autoAssignPct}%`, sub: `${quality.autoAssigned} of ${quality.totalSessions} sessions`,
      color: '#2563EB', bg: '#EBF0FF',
      icon: <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z"/></svg>,
    },
    {
      label: 'Avg quality score', value: quality.avgScore ?? '—', sub: 'target ≥ 0.70',
      color: '#059669', bg: '#E6FAF3',
      icon: <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><polygon points="12 2 15.09 8.26 22 9.27 17 14.14 18.18 21.02 12 17.77 5.82 21.02 7 14.14 2 9.27 8.91 8.26 12 2"/></svg>,
    },
    {
      label: 'TBA sessions', value: quality.tbaSessions, sub: quality.tbaSessions > 0 ? 'need manual assignment' : 'all sessions assigned',
      color: quality.tbaSessions > 0 ? '#D97706' : '#059669',
      bg:    quality.tbaSessions > 0 ? '#FEF3CD' : '#E6FAF3',
      icon: quality.tbaSessions > 0
        ? <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><circle cx="12" cy="12" r="10"/><line x1="12" y1="8" x2="12" y2="12"/><line x1="12" y1="16" x2="12.01" y2="16"/></svg>
        : <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><polyline points="20 6 9 17 4 12"/></svg>,
    },
  ]

  return (
    <div className="section-enter" style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
      {/* KPIs */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4,1fr)', gap: 16 }}>
        {KPI_CARDS.map(c => <KpiCard key={c.label} {...c} />)}
      </div>

      {/* Compliance rings */}
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16 }}>
        <ComplianceRing
          label="Time window compliance"
          value={quality.pctInWindow}
          desc="Sessions placed within each faculty's preferred time window."
          color="#7C6FCD"
        />
        <ComplianceRing
          label="Day preference compliance"
          value={quality.pctOnPreferredDays}
          desc="Sessions placed on each faculty's preferred teaching days."
          color="#2563EB"
        />
      </div>

      {/* Per-faculty quality table */}
      {quality.perFaculty.length > 0 && (
        <div style={{ background: '#fff', borderRadius: 16, border: '1px solid #E8E4F8', boxShadow: '0 2px 10px rgba(124,111,205,0.06)', overflow: 'hidden' }}>
          <div style={{ padding: '16px 20px', borderBottom: '1px solid #F0EDF9', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <div>
              <p style={{ fontWeight: 700, fontSize: 14, color: '#1a1a2e' }}>Per-faculty quality</p>
              <p style={{ fontSize: 11, color: '#8883B0', marginTop: 2 }}>Sorted by lowest score first — review flagged entries</p>
            </div>
            <span style={{ fontSize: 11, color: '#8883B0' }}>{quality.perFaculty.length} instructors</span>
          </div>
          <div style={{ maxHeight: 320, overflowY: 'auto' }}>
            {[...quality.perFaculty]
              .sort((a, b) => (a.avgScore ?? 0) - (b.avgScore ?? 0))
              .map((f, i, arr) => {
                const initials = f.name.split(/[\s,]+/).filter(Boolean).map(n => n[0]).join('').slice(0, 2).toUpperCase()
                const isLow    = f.avgScore !== null && f.avgScore < 0.40
                return (
                  <div key={f.name} style={{
                    display: 'flex', alignItems: 'center', gap: 12, padding: '11px 20px',
                    borderBottom: i < arr.length - 1 ? '1px solid #F5F4FB' : 'none',
                    background: isLow ? '#FFFBF5' : 'transparent',
                    transition: 'background 0.12s',
                  }}>
                    <div style={{
                      width: 32, height: 32, borderRadius: '50%', flexShrink: 0,
                      background: isLow ? '#FEF3CD' : '#EEEAFB',
                      color: isLow ? '#D97706' : '#7C6FCD',
                      display: 'flex', alignItems: 'center', justifyContent: 'center',
                      fontSize: 10, fontWeight: 700,
                    }}>{initials}</div>
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <p style={{ fontSize: 13, fontWeight: 600, color: '#1a1a2e', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                        {f.name}
                      </p>
                      <p style={{ fontSize: 11, color: '#8883B0', marginTop: 1 }}>{f.sessions} session{f.sessions !== 1 ? 's' : ''}</p>
                    </div>
                    <ScoreBadge score={f.avgScore} />
                  </div>
                )
              })}
          </div>
        </div>
      )}
    </div>
  )
}

/* ─────────────────────────────────────────────
   Section: Workload
───────────────────────────────────────────── */
function WorkloadSection({ workload }) {
  const [search, setSearch] = useState('')
  const [sortBy, setSortBy] = useState('load') // load | name | overloaded

  if (!workload?.workload?.length) {
    return <EmptyCard icon="📊" title="No workload data" desc="Run or load a schedule to see faculty workload." />
  }

  const overloaded = workload.workload.filter(f => f.overloaded)
  const atCap      = workload.workload.filter(f => !f.overloaded && f.assigned / f.max_units >= 0.85)
  const normal     = workload.workload.filter(f => !f.overloaded && f.assigned / f.max_units < 0.85)

  const filtered = [...workload.workload]
    .filter(f => f.name.toLowerCase().includes(search.toLowerCase()))
    .sort((a, b) => {
      if (sortBy === 'name') return a.name.localeCompare(b.name)
      if (sortBy === 'overloaded') return (b.overloaded ? 1 : 0) - (a.overloaded ? 1 : 0)
      return b.assigned - a.assigned
    })

  return (
    <div className="section-enter" style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
      {/* Summary pills */}
      <div style={{ display: 'flex', gap: 12, flexWrap: 'wrap' }}>
        {[
          { label: 'Total instructors', val: workload.workload.length, bg: '#EEEAFB', c: '#7C6FCD' },
          { label: 'Overloaded', val: overloaded.length, bg: overloaded.length > 0 ? '#FFE8E8' : '#E8F8EE', c: overloaded.length > 0 ? '#C0392B' : '#27AE60' },
          { label: 'Near cap (>85%)', val: atCap.length, bg: atCap.length > 0 ? '#FEF3CD' : '#E8F8EE', c: atCap.length > 0 ? '#8a5c00' : '#27AE60' },
          { label: 'Normal load', val: normal.length, bg: '#E8F8EE', c: '#27AE60' },
        ].map(p => (
          <div key={p.label} style={{ background: p.bg, color: p.c, borderRadius: 12, padding: '10px 16px', display: 'flex', flexDirection: 'column', gap: 2, minWidth: 100 }}>
            <span style={{ fontSize: 22, fontWeight: 700, lineHeight: 1 }}>{p.val}</span>
            <span style={{ fontSize: 11, fontWeight: 500, opacity: 0.8 }}>{p.label}</span>
          </div>
        ))}
      </div>

      {/* List */}
      <div style={{ background: '#fff', borderRadius: 16, border: '1px solid #E8E4F8', boxShadow: '0 2px 10px rgba(124,111,205,0.06)', overflow: 'hidden' }}>
        {/* Toolbar */}
        <div style={{ padding: '14px 20px', borderBottom: '1px solid #F0EDF9', display: 'flex', gap: 10, alignItems: 'center', flexWrap: 'wrap' }}>
          <div className="search-input-wrap" style={{ flex: 1, minWidth: 180 }}>
            <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="#B0ABCC" strokeWidth="2">
              <circle cx="11" cy="11" r="8"/><line x1="21" y1="21" x2="16.65" y2="16.65"/>
            </svg>
            <input
              type="text" placeholder="Search faculty…" value={search}
              onChange={e => setSearch(e.target.value)}
              style={{ width: '100%', padding: '7px 12px 7px 32px', borderRadius: 9, border: '1px solid #E8E4F8', fontSize: 13, fontFamily: "'Poppins',sans-serif", background: '#FAFAFE', color: '#1a1a2e' }}
            />
          </div>
          <div style={{ display: 'flex', gap: 4, alignItems: 'center' }}>
            <span style={{ fontSize: 11, color: '#B0ABCC', marginRight: 4 }}>Sort:</span>
            {[
              { key: 'load', label: 'Load' },
              { key: 'name', label: 'Name' },
              { key: 'overloaded', label: 'Status' },
            ].map(opt => (
              <button key={opt.key} className={`sort-btn ${sortBy === opt.key ? 'active' : ''}`} onClick={() => setSortBy(opt.key)}>
                {opt.label}
              </button>
            ))}
          </div>
        </div>

        <div style={{ padding: '4px 20px 12px', maxHeight: 480, overflowY: 'auto' }}>
          {filtered.length === 0
            ? <p style={{ color: '#B0ABCC', fontSize: 13, padding: '20px 0', textAlign: 'center' }}>No results for "{search}"</p>
            : filtered.map(f => (
                <WorkloadBar key={f.name} label={f.name} value={f.assigned} max={f.max_units} overloaded={f.overloaded} />
              ))
          }
        </div>
      </div>
    </div>
  )
}

/* ─────────────────────────────────────────────
   Section: Eligibility
───────────────────────────────────────────── */
function EligibilitySection({ preview }) {
  const [search,  setSearch]  = useState('')
  const [filter,  setFilter]  = useState('all') // all | warning | ok

  if (!preview?.courses?.length) {
    return <EmptyCard icon="🔍" title="No eligibility data" desc="Run or load a schedule to see faculty eligibility." />
  }

  const warnCount = preview.courses.filter(c => c.warning).length
  const filtered  = [...preview.courses]
    .filter(c => {
      const matchSearch = c.courseCode.toLowerCase().includes(search.toLowerCase()) || c.title.toLowerCase().includes(search.toLowerCase())
      const matchFilter = filter === 'all' || (filter === 'warning' && c.warning) || (filter === 'ok' && !c.warning)
      return matchSearch && matchFilter
    })
    .sort((a, b) => a.poolSize - b.poolSize)

  return (
    <div className="section-enter" style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
      {warnCount > 0 && (
        <div style={{ background: '#FFF5F5', border: '1px solid #FECACA', borderRadius: 12, padding: '12px 16px', display: 'flex', gap: 10, alignItems: 'center' }}>
          <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="#C0392B" strokeWidth="2" style={{ flexShrink: 0 }}>
            <circle cx="12" cy="12" r="10"/><line x1="12" y1="8" x2="12" y2="12"/><line x1="12" y1="16" x2="12.01" y2="16"/>
          </svg>
          <p style={{ fontSize: 12.5, color: '#B91C1C' }}>
            <strong>{warnCount} course{warnCount > 1 ? 's have' : ' has'} no eligible faculty</strong> — these sessions will remain unassigned unless a faculty member's specializations are updated.
          </p>
        </div>
      )}

      <div style={{ background: '#fff', borderRadius: 16, border: '1px solid #E8E4F8', boxShadow: '0 2px 10px rgba(124,111,205,0.06)', overflow: 'hidden' }}>
        {/* Toolbar */}
        <div style={{ padding: '14px 20px', borderBottom: '1px solid #F0EDF9', display: 'flex', gap: 10, alignItems: 'center', flexWrap: 'wrap' }}>
          <div className="search-input-wrap" style={{ flex: 1, minWidth: 200 }}>
            <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="#B0ABCC" strokeWidth="2">
              <circle cx="11" cy="11" r="8"/><line x1="21" y1="21" x2="16.65" y2="16.65"/>
            </svg>
            <input
              type="text" placeholder="Search by code or title…" value={search}
              onChange={e => setSearch(e.target.value)}
              style={{ width: '100%', padding: '7px 12px 7px 32px', borderRadius: 9, border: '1px solid #E8E4F8', fontSize: 13, fontFamily: "'Poppins',sans-serif", background: '#FAFAFE', color: '#1a1a2e' }}
            />
          </div>
          <div style={{ display: 'flex', gap: 6 }}>
            {[
              { key: 'all',     label: `All (${preview.courses.length})` },
              { key: 'warning', label: `⚠ No faculty (${warnCount})` },
              { key: 'ok',      label: `✓ Assigned (${preview.courses.length - warnCount})` },
            ].map(opt => (
              <button
                key={opt.key}
                onClick={() => setFilter(opt.key)}
                style={{
                  padding: '5px 12px', borderRadius: 8, border: '1px solid',
                  borderColor: filter === opt.key ? '#7C6FCD' : '#E8E4F8',
                  background: filter === opt.key ? '#EEEAFB' : '#fff',
                  color: filter === opt.key ? '#7C6FCD' : '#8883B0',
                  fontFamily: "'Poppins',sans-serif", fontSize: 12, fontWeight: 500, cursor: 'pointer',
                  transition: 'all 0.15s',
                }}
              >
                {opt.label}
              </button>
            ))}
          </div>
        </div>

        {/* Result count */}
        <div style={{ padding: '8px 20px', borderBottom: '1px solid #F5F4FB', background: '#FAFAFE' }}>
          <p style={{ fontSize: 11, color: '#B0ABCC' }}>
            Showing {filtered.length} of {preview.courses.length} courses · click a row to see eligible faculty
          </p>
        </div>

        <div style={{ maxHeight: 500, overflowY: 'auto' }}>
          {filtered.length === 0
            ? <p style={{ color: '#B0ABCC', fontSize: 13, padding: '24px', textAlign: 'center' }}>No courses match your filters.</p>
            : filtered.map((c, i) => <EligibilityRow key={`${c.courseCode}-${i}`} {...c} idx={i} />)
          }
        </div>
      </div>
    </div>
  )
}

/* ─────────────────────────────────────────────
   Empty card (section-level)
───────────────────────────────────────────── */
function EmptyCard({ icon, title, desc }) {
  return (
    <div style={{
      background: '#fff', borderRadius: 16, padding: '52px 32px',
      border: '1px solid #E8E4F8', display: 'flex', flexDirection: 'column',
      alignItems: 'center', gap: 10, textAlign: 'center',
    }}>
      <span style={{ fontSize: 32 }}>{icon}</span>
      <p style={{ fontSize: 14, fontWeight: 600, color: '#1a1a2e' }}>{title}</p>
      <p style={{ fontSize: 13, color: '#8883B0', maxWidth: 300 }}>{desc}</p>
    </div>
  )
}

/* ─────────────────────────────────────────────
   Page-level empty state
───────────────────────────────────────────── */
function EmptyState() {
  return (
    <div style={{
      background: '#fff', borderRadius: 16, padding: '64px 32px',
      border: '2px dashed #E8E4F8',
      display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 14,
    }}>
      <div style={{ width: 60, height: 60, borderRadius: '50%', background: '#EEEAFB', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
        <svg width="26" height="26" viewBox="0 0 24 24" fill="none" stroke="#A99BE8" strokeWidth="2">
          <line x1="18" y1="20" x2="18" y2="10"/><line x1="12" y1="20" x2="12" y2="4"/><line x1="6" y1="20" x2="6" y2="14"/>
        </svg>
      </div>
      <div style={{ textAlign: 'center' }}>
        <p style={{ fontSize: 15, fontWeight: 700, color: '#1a1a2e', marginBottom: 6 }}>No schedule in memory</p>
        <p style={{ fontSize: 13, color: '#8883B0', maxWidth: 340, lineHeight: 1.6 }}>
          Generate a new schedule from the Scheduler page, or select a saved schedule from the dropdown above.
        </p>
      </div>
    </div>
  )
}

/* ─────────────────────────────────────────────
   Error banner
───────────────────────────────────────────── */
function ErrorBanner({ message, onDismiss }) {
  return (
    <div style={{
      display: 'flex', alignItems: 'center', gap: 10, justifyContent: 'space-between',
      padding: '11px 16px', borderRadius: 12,
      background: '#FFF5F5', border: '1px solid #FECACA',
      fontSize: 13, color: '#B91C1C', marginBottom: 16,
    }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
        <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" style={{ flexShrink: 0 }}>
          <circle cx="12" cy="12" r="10"/><line x1="12" y1="8" x2="12" y2="12"/><line x1="12" y1="16" x2="12.01" y2="16"/>
        </svg>
        {message}
      </div>
      {onDismiss && (
        <button onClick={onDismiss} style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#B91C1C', padding: '2px 6px', borderRadius: 6, fontSize: 12 }}>
          Dismiss
        </button>
      )}
    </div>
  )
}

/* ─────────────────────────────────────────────
   Main component
───────────────────────────────────────────── */
export default function AnalyticsPage() {
  const [quality,     setQuality]     = useState(null)
  const [workload,    setWorkload]    = useState(null)
  const [preview,     setPreview]     = useState(null)
  const [loading,     setLoading]     = useState(true)
  const [selected,    setSelected]    = useState(null)
  const [savedList,   setSavedList]   = useState([])
  const [error,       setError]       = useState(null)
  const [listLoading, setListLoading] = useState(true)
  const [switching,   setSwitching]   = useState(false)
  const [refreshing,  setRefreshing]  = useState(false)
  const [activeTab,   setActiveTab]   = useState('overview')

  const fetchAnalytics = async () => {
    setError(null)
    const [q, w, p] = await Promise.all([getAssignmentQuality(), getWorkload(), getFacultyPreview()])
    setQuality(q); setWorkload(w); setPreview(p)
  }

  // load saved list
  useEffect(() => {
    listSaved()
      .then(data => setSavedList(Array.isArray(data) ? data : (data?.schedules ?? [])))
      .catch(() => {})
      .finally(() => setListLoading(false))
  }, [])

  // initial analytics load
  useEffect(() => {
    setLoading(true)
    fetchAnalytics().catch(() => setError('Failed to load analytics.')).finally(() => setLoading(false))
  }, []) // eslint-disable-line react-hooks/exhaustive-deps

  async function handleSelectSchedule(value) {
    const name = value === '__current__' ? null : value
    setSelected(name)
    if (!name) {
      setLoading(true)
      fetchAnalytics().catch(() => setError('Failed to reload analytics.')).finally(() => setLoading(false))
      return
    }
    setSwitching(true)
    try {
      await loadSaved(name)
      await fetchAnalytics()
    } catch {
      setError(`Failed to load schedule "${name}".`)
    } finally {
      setSwitching(false)
    }
  }

  async function handleRefresh() {
    setRefreshing(true)
    try { await fetchAnalytics() } catch { setError('Refresh failed.') } finally { setRefreshing(false) }
  }

  const isSpinning    = loading || switching
  const overloadCount = workload?.workload?.filter(f => f.overloaded).length ?? 0
  const warnCount     = preview?.courses?.filter(c => c.warning).length ?? 0
  const hasData       = quality && quality.totalSessions > 0

  const TABS = [
    { key: 'overview',    label: 'Overview',    count: null },
    { key: 'workload',    label: 'Workload',     count: overloadCount || null, warn: overloadCount > 0 },
    { key: 'eligibility', label: 'Eligibility',  count: warnCount || null,    warn: warnCount > 0 },
  ]

  return (
    <div className="page" style={{ fontFamily: "'Poppins', sans-serif", maxWidth: 1200 }}>

      {/* ── Header ── */}
      <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', marginBottom: 20, flexWrap: 'wrap', gap: 12 }}>
        <div>
          <h1 style={{ fontSize: 20, fontWeight: 700, color: '#1a1a2e', letterSpacing: '-.3px', margin: 0 }}>Analytics</h1>
          <p style={{ fontSize: 12.5, color: '#8883B0', marginTop: 3 }}>
            {hasData ? `${quality.totalSessions} sessions · ${quality.autoAssignPct}% auto-assigned` : 'Load a schedule to view metrics.'}
          </p>
        </div>

        <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexShrink: 0 }}>
          {/* Refresh */}
          {hasData && (
            <button className="refresh-btn" onClick={handleRefresh} disabled={isSpinning || refreshing}>
              <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"
                style={{ animation: refreshing ? 'spin 0.8s linear infinite' : 'none' }}>
                <path d="M23 4v6h-6"/><path d="M1 20v-6h6"/>
                <path d="M3.51 9a9 9 0 0 1 14.85-3.36L23 10M1 14l4.64 4.36A9 9 0 0 0 20.49 15"/>
              </svg>
              Refresh
            </button>
          )}

          {/* Schedule selector */}
          <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            <div style={{ position: 'relative' }}>
              <select
                value={selected ?? '__current__'}
                onChange={e => handleSelectSchedule(e.target.value)}
                disabled={isSpinning || listLoading}
                style={{
                  padding: '7px 34px 7px 12px', borderRadius: 9,
                  border: '1px solid #E8E4F8', background: '#fff',
                  color: '#1a1a2e', fontSize: 12.5, fontWeight: 500,
                  fontFamily: "'Poppins', sans-serif", appearance: 'none',
                  cursor: isSpinning ? 'not-allowed' : 'pointer',
                  opacity: listLoading ? 0.6 : 1, minWidth: 190,
                  backgroundImage: `url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='12' height='12' viewBox='0 0 24 24' fill='none' stroke='%238883B0' stroke-width='2'%3E%3Cpolyline points='6 9 12 15 18 9'/%3E%3C/svg%3E")`,
                  backgroundRepeat: 'no-repeat', backgroundPosition: 'right 10px center',
                }}
              >
                <option value="__current__">Current (in memory)</option>
                {savedList.map(name => <option key={name} value={name}>{name}</option>)}
              </select>
            </div>
            {isSpinning && (
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="#A99BE8" strokeWidth="2"
                style={{ animation: 'spin 0.8s linear infinite', flexShrink: 0 }}>
                <path d="M21 12a9 9 0 1 1-6.219-8.56"/>
              </svg>
            )}
          </div>
        </div>
      </div>

      {/* ── Error ── */}
      {error && <ErrorBanner message={error} onDismiss={() => setError(null)} />}

      {/* ── Loading skeleton ── */}
      {loading ? (
        <SkeletonPage />
      ) : !hasData ? (
        <EmptyState />
      ) : (
        <>
          {/* Alert banner */}
          <AlertBanner overloadCount={overloadCount} warnCount={warnCount} />

          {/* Tabs */}
          <div style={{ display: 'flex', gap: 4, marginBottom: 20, background: '#fff', padding: '6px', borderRadius: 12, border: '1px solid #E8E4F8', boxShadow: '0 2px 8px rgba(124,111,205,0.06)', width: 'fit-content' }}>
            {TABS.map(tab => (
              <button
                key={tab.key}
                className={`analytics-tab${activeTab === tab.key ? ' active' : ''}${tab.warn ? ' warn-tab' : ''}`}
                onClick={() => setActiveTab(tab.key)}
              >
                {tab.label}
                {tab.count !== null && (
                  <span className="tab-badge">{tab.count}</span>
                )}
              </button>
            ))}
          </div>

          {/* Tab content */}
          {activeTab === 'overview'    && <OverviewSection    quality={quality} />}
          {activeTab === 'workload'    && <WorkloadSection    workload={workload} />}
          {activeTab === 'eligibility' && <EligibilitySection preview={preview} />}
        </>
      )}

      {/* Switching overlay */}
      {switching && (
        <div style={{
          position: 'fixed', inset: 0, background: 'rgba(245,244,251,0.75)',
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          zIndex: 50, backdropFilter: 'blur(3px)',
        }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 10, background: '#fff', padding: '14px 22px', borderRadius: 14, boxShadow: '0 8px 32px rgba(124,111,205,0.18)', border: '1px solid #E8E4F8' }}>
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="#A99BE8" strokeWidth="2" style={{ animation: 'spin 0.8s linear infinite' }}>
              <path d="M21 12a9 9 0 1 1-6.219-8.56"/>
            </svg>
            <span style={{ fontSize: 13, color: '#8883B0', fontWeight: 500 }}>Loading schedule…</span>
          </div>
        </div>
      )}
    </div>
  )
}