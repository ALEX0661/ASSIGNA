import { useEffect, useState, useMemo } from 'react'
import { useAuth } from '../../hooks/useAuth'
import { listSaved, loadSaved, getFaculty, getActiveSchedule } from '../../services/api'
import { buildConflictMap, isMergedEvent } from '../../components/ScheduleView/svHelpers'
import { exportScheduleToExcel } from '../../utils/exportScheduleToExcel'
import { exportScheduleToICS } from '../../utils/exportScheduleToICS'

// ─── PNG Icon Imports (stat strip) ────────────────────────────────────────────
import iconClasses  from '../../assets/CLASSES.png'
import iconDays     from '../../assets/DAY.png'
import iconUnits    from '../../assets/UNITS.png'
import iconSchedule from '../../assets/SCHEDULE.png'

// ─── PNG Icon Imports (modal) ─────────────────────────────────────────────────
import iconClock    from '../../assets/TIME.png'
import iconRoom     from '../../assets/ROOMS.png'
import iconLab      from '../../assets/LABROOM.png'
import iconBook     from '../../assets/LECROOM.png'
import iconSection  from '../../assets/BLOCKS.png'
import iconConflict from '../../assets/CONFLICT.png'
import iconMerged   from '../../assets/MERGED.png'

// ─── Inject Styles ────────────────────────────────────────────────────────────
if (!document.getElementById('fsp-style')) {
  const s = document.createElement('style')
  s.id = 'fsp-style'
  s.textContent = `
    @import url('https://fonts.googleapis.com/css2?family=Sora:wght@600;700;800&family=Inter:wght@400;500;600;700&display=swap');

    @keyframes fsp-shimmer  { 0%{background-position:200% 0} 100%{background-position:-200% 0} }
    @keyframes fsp-fadeUp   { from{opacity:0;transform:translateY(12px)} to{opacity:1;transform:none} }
    @keyframes fsp-fadeIn   { from{opacity:0} to{opacity:1} }
    @keyframes fsp-scaleIn  { from{opacity:0;transform:scale(0.94) translateY(12px)} to{opacity:1;transform:scale(1) translateY(0)} }
    @keyframes fsp-spin     { to{transform:rotate(360deg)} }

    .fsp-card-clickable { cursor: pointer; }
    .fsp-card-clickable:focus-visible { outline: 2px solid var(--mint); outline-offset: 2px; }

    .fsp-modal-overlay {
      position: fixed; inset: 0; z-index: 1000;
      background: rgba(0,0,0,0.72); backdrop-filter: blur(6px);
      display: flex; align-items: center; justify-content: center; padding: 20px;
      animation: fsp-fadeIn 0.18s ease;
    }
    .fsp-modal-card {
      background: var(--surface); border-radius: 20px; width: 100%; max-width: 480px;
      box-shadow: 0 32px 80px rgba(0,0,0,0.35), 0 0 0 1px rgba(110,231,183,0.15);
      animation: fsp-scaleIn 0.22s cubic-bezier(0.34,1.56,0.64,1);
      overflow: hidden; max-height: 90vh; display: flex; flex-direction: column;
    }

    .fsp-select {
      appearance: none; border: 1px solid var(--border); box-sizing: border-box;
      border-radius: 10px; padding: 8px 34px 8px 14px;
      font-size: 12.5px; font-weight: 600; color: #0E2A1C;
      background: #fafafa; cursor: pointer; outline: none;
      font-family: 'Inter', sans-serif;
      transition: all 0.15s;
    }
    .fsp-select:hover { background: var(--surface); border-color: #B8D9C6; }
    .fsp-select:focus { background: var(--surface); border-color: #1E7A4A; box-shadow: 0 0 0 3px rgba(110,231,183,0.25); }

    .fsp-search-wrapper {
      position: relative;
      display: flex;
      align-items: center;
      flex: 1;
      min-width: 200px;
    }
    .fsp-search-input {
      width: 100%; box-sizing: border-box;
      appearance: none; border: 1px solid var(--border);
      border-radius: 10px; padding: 8px 30px 8px 34px;
      font-size: 12.5px; font-weight: 500; color: #0E2A1C;
      background: #fafafa; outline: none;
      font-family: 'Inter', sans-serif;
      transition: all 0.2s ease;
    }
    .fsp-search-input::placeholder { color: #6B8C7A; }
    .fsp-search-input:focus { border-color: #1E7A4A; background: var(--surface); box-shadow: 0 0 0 3px rgba(110,231,183,0.25); }

    .fsp-search-clear {
      position: absolute; right: 8px; background: none; border: none;
      cursor: pointer; color: #6B8C7A; font-size: 16px; padding: 4px;
      display: flex; align-items: center; justify-content: center; line-height: 1;
    }
    .fsp-search-clear:hover { color: #0E2A1C; }

    .fsp-view-btn {
      padding: 7px 12px; border-radius: 7px; border: none; cursor: pointer;
      transition: all 0.15s; display: flex; align-items: center; justify-content: center;
    }

    .fsp-export-btn {
      padding: 8px 16px; border-radius: 10px; border: 1px solid var(--border);
      background: var(--surface); color: #155C36; font-size: 12.5px; font-weight: 600;
      cursor: pointer; display: flex; align-items: center; gap: 8px;
      transition: all 0.15s; font-family: 'Inter', sans-serif;
      box-shadow: 0 1px 4px rgba(14,42,28,0.04);
      flex-shrink: 0; box-sizing: border-box;
    }
    .fsp-export-btn:hover:not(:disabled) {
      background: #E8F5EE; border-color: #1E7A4A; color: #1E7A4A;
    }
    .fsp-export-btn:disabled { opacity: 0.6; cursor: default; }

    .fsp-pill {
      display: flex; align-items: center; gap: 6px;
      padding: 6px 14px; border-radius: 99px; font-size: 12px;
      font-weight: 600; cursor: pointer; border: 1.5px solid;
      font-family: 'Inter', sans-serif; transition: all 0.15s;
      white-space: nowrap;
    }

    .fsp-stat-card {
      display: flex; align-items: center; gap: 12px;
      background: var(--surface); border-radius: 14px; border: 1px solid var(--border);
      padding: 14px 18px; flex: 1; min-width: 140px;
      box-shadow: 0 1px 6px rgba(14,42,28,0.05);
      animation: fsp-fadeUp 0.3s ease both;
    }

    .fsp-list-card {
      background: var(--surface); border-radius: 14px; border: 1px solid var(--border);
      display: flex; align-items: stretch; overflow: hidden;
      transition: all 0.17s ease;
      box-shadow: 0 1px 4px rgba(14,42,28,0.04);
    }
    .fsp-list-card:hover {
      border-color: rgba(30,122,74,0.4);
      box-shadow: 0 8px 24px rgba(14,42,28,0.10);
      transform: translateY(-1px);
    }

    .fsp-grid-card {
      background: var(--surface); border-radius: 18px; border: 1px solid var(--border);
      display: flex; flex-direction: column; overflow: hidden;
      transition: all 0.18s ease;
      box-shadow: 0 1px 5px rgba(14,42,28,0.05);
    }
    .fsp-grid-card:hover {
      box-shadow: 0 12px 36px rgba(14,42,28,0.12);
      transform: translateY(-3px);
    }

    @media (max-width: 768px) {
      .fsp-page-wrap { padding: 16px !important; }
      .fsp-hero-wrap { padding: 16px 20px !important; border-radius: 16px !important; }
      .fsp-hero-title { font-size: 18px !important; }
      .fsp-hero-avatar { width: 48px !important; height: 48px !important; font-size: 16px !important; }
      .fsp-filter-group { flex-direction: column; align-items: flex-start !important; width: 100%; gap: 6px !important; }
      .fsp-filter-group > div { width: 100%; }
      .fsp-select { width: 100% !important; min-width: 0 !important; }
      .fsp-right-controls { flex-direction: column; align-items: stretch !important; width: 100%; gap: 6px !important; }
      .fsp-search-wrapper { width: 100% !important; flex: none !important; min-width: 0 !important; }
      .fsp-search-input { width: 100% !important; }
      .fsp-export-btn { width: 100% !important; justify-content: center; }
      .fsp-divider { display: none !important; }
    }

    .fsp-scrollable { overflow-y: auto; }
    .fsp-scrollable::-webkit-scrollbar { width: 4px; }
    .fsp-scrollable::-webkit-scrollbar-track { background: transparent; }
    .fsp-scrollable::-webkit-scrollbar-thumb { background: #C0DFC9; border-radius: 99px; }
  `
  document.head.appendChild(s)
}

// ─── Theme ────────────────────────────────────────────────────────────────────
const T = {
  forest:      '#3D7A58',
  forestDeep:  '#2E6145',
  green:       '#2E7D52',
  greenDeep:   '#236040',
  greenSoft:   '#E8F5EE',
  greenBorder: 'var(--meadow-border)',
  mint:        'var(--mint)',
  meadow:      '#4A9B6F',
  textMain:    '#0E2A1C',
  textMid:     '#3A5448',
  textMuted:   'var(--muted2, #6B8C7A)',
  textLight:   '#A0BCAD',
  border:      'var(--border)',
  borderLight: '#EFF6F2',
  bg: 'var(--surface, #FFFFFF)',
  bgAlt:       '#F6FAF8',
  bgPage:      '#F2F7F4',
}

const DAYS      = ['Monday','Tuesday','Wednesday','Thursday','Friday','Saturday','Sunday']
const DAY_SHORT = { Monday:'Mon', Tuesday:'Tue', Wednesday:'Wed', Thursday:'Thu', Friday:'Fri', Saturday:'Sat', Sunday:'Sun' }
const DAY_ABBR  = { Monday:'MO', Tuesday:'TU', Wednesday:'WE', Thursday:'TH', Friday:'FR', Saturday:'SA', Sunday:'SU' }
const DAY_COLOR = ['#1E7A4A','#3A9CBA','#5B7FD6','#9060CD','#E11D48','#F59E0B','#6BC78A']

// ─── Helpers ──────────────────────────────────────────────────────────────────
function parseTimeToMinutes(str = '') {
  const m = str.trim().match(/^(\d{1,2}):(\d{2})(?:\s*(AM|PM))?$/i)
  if (!m) return 9999
  let h = parseInt(m[1], 10)
  const min = parseInt(m[2], 10)
  const ampm = (m[3] || '').toUpperCase()
  if (ampm === 'PM' && h !== 12) h += 12
  if (ampm === 'AM' && h === 12) h = 0
  return h * 60 + min
}

function periodStartMinutes(period = '') {
  return parseTimeToMinutes(period.split(/\s*[–—\-]\s*/)[0] || '')
}

function formatPeriodCompact(period = '') {
  const parts = period.split(/\s*[–—\-]\s*/)
  if (parts.length < 2) return [period.trim()]
  const start = parts[0].trim(), end = parts[1].trim()
  const startAmpm = start.match(/(AM|PM)$/i)?.[1]?.toUpperCase()
  const endAmpm   = end.match(/(AM|PM)$/i)?.[1]?.toUpperCase()
  const compactStart = (startAmpm && startAmpm === endAmpm) ? start.replace(/\s*(AM|PM)$/i, '') : start
  return [compactStart.trim(), end.trim()]
}

function getAvatarColor(name = '') {
  const palette = [
    { bg:'var(--meadow-soft)', fg:'var(--meadow)' }, { bg:'rgba(59, 130, 246, 0.1)', fg:'#60A5FA' },
    { bg:'#FCE7F3', fg:'#DB2777' }, { bg:'color-mix(in srgb, #6D28D9 15%, transparent)', fg:'#7C3AED' },
    { bg:'rgba(245, 158, 11, 0.1)', fg:'#F59E0B' }, { bg:'#FFE4E6', fg:'#E11D48' },
  ]
  const code = name.split('').reduce((a, c) => a + c.charCodeAt(0), 0)
  return palette[code % palette.length]
}

function getInitials(name = '') {
  const parts = name.trim().split(/\s+/)
  if (parts.length >= 2) return (parts[0][0] + parts[parts.length - 1][0]).toUpperCase()
  return name.slice(0, 2).toUpperCase() || '?'
}

// ─── Badge ────────────────────────────────────────────────────────────────────
function Badge({ children, type = 'default', size = 'sm' }) {
  const styles = {
    lec:     { bg:'rgba(37, 99, 235, 0.1)', color:'#60A5FA', border:'#BFDBFE' },
    lab:     { bg:'rgba(217, 119, 6, 0.05)', color:'#F59E0B', border:'rgba(245, 158, 11, 0.25)' },
    room:    { bg: T.greenSoft, color: T.greenDeep, border: T.greenBorder },
    merged:  { bg:'var(--meadow-soft)', color:'var(--meadow)', border:'#A7F3D0' },
    conflict:{ bg:'rgba(239, 68, 68, 0.05)', color:'#EF4444', border:'rgba(220, 38, 38, 0.25)' },
    default: { bg: T.bgAlt, color: T.textMid, border: T.border },
  }
  const s = styles[type] || styles.default
  const pad = size === 'lg' ? '5px 13px' : '3px 9px'
  const fs  = size === 'lg' ? 12.5 : 11
  return (
    <span style={{
      display:'inline-flex', alignItems:'center', gap:4,
      padding:pad, borderRadius:8, fontSize:fs, fontWeight:600,
      background:s.bg, color:s.color, border:`1px solid ${s.border}`,
      whiteSpace:'nowrap', letterSpacing:'0.2px', fontFamily:"'Inter',sans-serif"
    }}>{children}</span>
  )
}

// ─── Skeleton ─────────────────────────────────────────────────────────────────
function Skel({ w = '100%', h = 14, r = 8 }) {
  return (
    <div style={{
      width:w, height:h, borderRadius:r,
      background:'linear-gradient(90deg,#DCF0E6 25%,#EEF6F1 50%,#DCF0E6 75%)',
      backgroundSize:'200% 100%', animation:'fsp-shimmer 1.4s infinite', flexShrink:0
    }}/>
  )
}

// ─── Session Detail Modal ─────────────────────────────────────────────────────
function SessionModal({ event, onClose }) {
  if (!event) return null
  const isMerged    = isMergedEvent?.(event) ?? false
  const timeParts   = formatPeriodCompact(event.period || '')
  const isLab       = event.session?.toLowerCase().includes('lab')
  const classLabel  = [event.program, event.year && `Year ${event.year}`, event.block].filter(Boolean).join(' · ')

  function handleOverlayClick(e) { if (e.target === e.currentTarget) onClose() }

  useEffect(() => {
    function onKey(e) { if (e.key === 'Escape') onClose() }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [onClose])

  return (
    <div className="fsp-modal-overlay" onClick={handleOverlayClick} role="dialog" aria-modal="true">
      <div className="fsp-modal-card" style={{ background: T.bg }}>
        {/* ── Header ── */}
        <div style={{ padding: '24px 24px 20px', borderBottom: `1px solid ${T.borderLight}`, position: 'relative' }}>
          <button onClick={onClose} aria-label="Close" style={{
            position: 'absolute', top: 16, right: 16,
            width: 32, height: 32, borderRadius: 9, cursor: 'pointer',
            background: T.bgAlt, border: `1px solid ${T.border}`, color: T.textMuted,
            display: 'flex', alignItems: 'center', justifyContent: 'center', transition: 'all 0.15s'
          }}
          onMouseEnter={e => { e.currentTarget.style.background='rgba(239, 68, 68, 0.1)'; e.currentTarget.style.color='#EF4444'; e.currentTarget.style.borderColor='#FCA5A5' }}
          onMouseLeave={e => { e.currentTarget.style.background=T.bgAlt; e.currentTarget.style.color=T.textMuted; e.currentTarget.style.borderColor=T.border }}
          >
            <span style={{ fontSize: 20, lineHeight: 1, userSelect: 'none' }}>×</span>
          </button>

          <div style={{ paddingRight: 40 }}>
            <div style={{ display: 'flex', gap: 8, marginBottom: 10, flexWrap: 'wrap' }}>
              <span style={{
                fontFamily: "'Inter',sans-serif", fontSize: 10, fontWeight: 700,
                padding: '4px 10px', borderRadius: 6, textTransform: 'uppercase', letterSpacing: '0.5px',
                background: T.greenSoft, color: T.greenDeep, border: `1px solid ${T.greenBorder}`,
              }}>
                {isLab ? 'Laboratory' : 'Lecture'}
              </span>
              {event.units != null && (
                 <span style={{
                    fontFamily: "'Inter',sans-serif", fontSize: 10, fontWeight: 700,
                    padding: '4px 10px', borderRadius: 6, textTransform: 'uppercase', letterSpacing: '0.5px',
                    background: T.bgAlt, color: T.textMid, border: `1px solid ${T.border}`,
                 }}>{event.units} Units</span>
              )}
              {isMerged && (
                <span style={{
                  fontFamily: "'Inter',sans-serif", fontSize: 10, fontWeight: 700, padding: '4px 10px', borderRadius: 6,
                  background: 'var(--meadow-soft)', color: 'var(--meadow)', border: '1px solid #A7F3D0', display: 'flex', alignItems: 'center', gap: 4
                }}>
                  <img src={iconMerged} alt="Merged" style={{ width:10, height:10 }}/> Merged
                </span>
              )}
              {event.hasConflict && (
                <span style={{
                  fontFamily: "'Inter',sans-serif", fontSize: 10, fontWeight: 700, padding: '4px 10px', borderRadius: 6,
                  background: 'rgba(239, 68, 68, 0.05)', color: '#EF4444', border: '1px solid #FECACA', display: 'flex', alignItems: 'center', gap: 4
                }}>
                  <img src={iconConflict} alt="Conflict" style={{ width:10, height:10 }}/> Conflict
                </span>
              )}
            </div>

            <div style={{ fontFamily: "'Sora',sans-serif", fontSize: 26, fontWeight: 800, color: T.forest, lineHeight: 1.15, marginBottom: 6 }}>
              {event.courseCode || 'Course Code'}
            </div>
            <div style={{ fontFamily: "'Inter',sans-serif", fontSize: 14, color: T.textMuted, fontWeight: 500, lineHeight: 1.4 }}>
              {event.title || 'Course Description'}
            </div>
          </div>
        </div>

        {/* ── Body ── */}
        <div className="fsp-scrollable" style={{ padding: '20px 24px', display: 'flex', flexDirection: 'column', gap: 14 }}>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
            {[
              { label: 'Schedule', value: `${event.day} · ${timeParts.join(' – ')}`, iconSrc: iconClock, bg: 'var(--meadow-soft)', border: 'var(--meadow-soft)' },
              { label: 'Room', value: event.room || 'TBA', iconSrc: isLab ? iconLab : iconRoom, bg: 'var(--meadow-soft)', border: 'var(--meadow-soft)' },
            ].map(({ label, value, iconSrc, bg, border }) => (
              <div key={label} style={{
                padding: '14px', borderRadius: 14, background: T.bgAlt, border: `1px solid ${T.borderLight}`,
                display: 'flex', flexDirection: 'column', gap: 10
              }}>
                <div style={{
                  width: 36, height: 36, borderRadius: 10, background: bg, border: `1px solid ${border}`,
                  display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0
                }}>
                  <img src={iconSrc} alt={label} style={{ width: 20, height: 20, objectFit: 'contain' }} />
                </div>
                <div>
                  <div style={{ fontFamily: "'Inter',sans-serif", fontSize: 10, fontWeight: 700, color: T.textLight, textTransform: 'uppercase', letterSpacing: '.5px', marginBottom: 3 }}>{label}</div>
                  <div style={{ fontFamily: "'Inter',sans-serif", fontSize: 13.5, fontWeight: 700, color: T.textMain, lineHeight: 1.3 }}>{value}</div>
                </div>
              </div>
            ))}
          </div>

          <div style={{
            display: 'flex', alignItems: 'center', gap: 14, padding: '14px', borderRadius: 14,
            background: T.bgAlt, border: `1px solid ${T.borderLight}`
          }}>
            <div style={{
              width: 38, height: 38, borderRadius: 10, background: 'var(--meadow-soft)', border: '1px solid var(--meadow-soft)', flexShrink: 0,
              display: 'flex', alignItems: 'center', justifyContent: 'center'
            }}>
              <img src={iconSection} alt="Section" style={{ width: 22, height: 22, objectFit: 'contain' }} />
            </div>
            <div style={{ minWidth: 0, flex: 1 }}>
              <div style={{ fontFamily: "'Inter',sans-serif", fontSize: 10, fontWeight: 700, color: T.textLight, textTransform: 'uppercase', letterSpacing: '.5px', marginBottom: 2 }}>Class / Section</div>
              <div style={{ fontFamily: "'Inter',sans-serif", fontSize: 14, fontWeight: 700, color: T.textMain }}>{classLabel || '—'}</div>
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}

// ─── List View Card ───────────────────────────────────────────────────────────
function ListCard({ event, index, conflictMap, onClick }) {
  const isMerged    = isMergedEvent?.(event) ?? false
  const hasConflict = conflictMap?.has(event.schedule_id)
  const dayIdx      = DAYS.indexOf(event.day)
  const accentColor = DAY_COLOR[dayIdx] || T.green
  const timeParts   = formatPeriodCompact(event.period || '')

  return (
    <div
      className="fsp-list-card fsp-card-clickable"
      role="button" tabIndex={0}
      onClick={() => onClick({ ...event, hasConflict })}
      onKeyDown={e => (e.key === 'Enter' || e.key === ' ') && onClick({ ...event, hasConflict })}
      style={{ animation:`fsp-fadeUp 0.24s ease ${index * 0.04}s both` }}
    >
      <div style={{
        width:88, flexShrink:0,
        background:`${accentColor}0C`, borderRight:`2px solid ${accentColor}1A`,
        display:'flex', flexDirection:'column', alignItems:'center',
        justifyContent:'center', padding:'14px 8px', gap:4,
      }}>
        <span style={{
          fontFamily:"'Sora',sans-serif", fontSize:9, fontWeight:800,
          letterSpacing:'1.4px', color:accentColor, textTransform:'uppercase'
        }}>
          {DAY_ABBR[event.day] || event.day?.slice(0,2)?.toUpperCase()}
        </span>
        <div style={{ width:24, height:1, background:`${accentColor}35`, margin:'2px 0' }}/>
        <div style={{ display:'flex', flexDirection:'column', alignItems:'center', gap:2 }}>
          {timeParts.map((t, ti) => (
            <span key={ti} style={{
              fontFamily:"'Inter',sans-serif", fontSize: ti === 0 ? 11.5 : 10.5,
              fontWeight: ti === 0 ? 700 : 500,
              color: ti === 0 ? T.textMain : T.textMuted, lineHeight:1.3, whiteSpace:'nowrap'
            }}>{t}</span>
          ))}
        </div>
      </div>

      <div style={{ flex:1, minWidth:0, display:'flex', alignItems:'center', gap:12, padding:'13px 18px' }}>
        <div style={{ flex:1, minWidth:0 }}>
          <div style={{ display:'flex', alignItems:'baseline', gap:8, marginBottom:6 }}>
            <span style={{ fontFamily:"'Sora',sans-serif", fontSize:14.5, fontWeight:800, color:T.greenDeep, flexShrink:0 }}>
              {event.courseCode}
            </span>
            <span style={{ fontFamily:"'Inter',sans-serif", fontSize:12.5, fontWeight:500, color:T.textMid, overflow:'hidden', textOverflow:'ellipsis', whiteSpace:'nowrap' }}>
              {event.title}
            </span>
          </div>
          <div style={{ display:'flex', gap:5, flexWrap:'wrap', alignItems:'center' }}>
            <Badge type={event.session?.toLowerCase().includes('lab') ? 'lab' : 'lec'}>
              {event.session}
            </Badge>
            {(event.program || event.year || event.block) && (
              <Badge>{[event.program, event.year && `Y${event.year}`, event.block].filter(Boolean).join(' ')}</Badge>
            )}
            {event.room && <Badge type="room">
              <svg width="9" height="9" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"><path d="M3 9l9-7 9 7v11a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z"/><polyline points="9 22 9 12 15 12 15 22"/></svg>
              {event.room}
            </Badge>}
            {isMerged    && <Badge type="merged">Merged</Badge>}
            {hasConflict && <Badge type="conflict">Conflict</Badge>}
          </div>
        </div>

        <div style={{ flexShrink:0, display:'flex', flexDirection:'column', alignItems:'center', gap:3 }}>
          {event.units != null && (
            <>
              <div style={{
                fontSize:17, fontWeight:800, color:T.green, lineHeight:1,
                background:T.greenSoft, borderRadius:10, padding:'7px 11px',
                border:`1px solid ${T.greenBorder}`, minWidth:36, textAlign:'center',
                fontFamily:"'Sora',sans-serif"
              }}>{event.units}</div>
              <div style={{ fontSize:8.5, fontWeight:700, color:T.textLight, textTransform:'uppercase', letterSpacing:'.5px', fontFamily:"'Inter',sans-serif" }}>units</div>
            </>
          )}
        </div>

        <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke={T.textLight} strokeWidth="2" style={{ flexShrink:0 }}>
          <polyline points="9 18 15 12 9 6"/>
        </svg>
      </div>
    </div>
  )
}

// ─── Grid View Card ───────────────────────────────────────────────────────────
function GridCard({ event, index, conflictMap, onClick }) {
  const isMerged    = isMergedEvent?.(event) ?? false
  const hasConflict = conflictMap?.has(event.schedule_id)
  const dayIdx      = DAYS.indexOf(event.day)
  const accentColor = DAY_COLOR[dayIdx] || T.green
  const isLab       = event.session?.toLowerCase().includes('lab')
  const timeParts   = formatPeriodCompact(event.period || '')
  const classTag    = [event.program, event.year && `Y${event.year}`, event.block].filter(Boolean).join(' ')

  return (
    <div
      className="fsp-grid-card fsp-card-clickable"
      role="button" tabIndex={0}
      onClick={() => onClick({ ...event, hasConflict })}
      onKeyDown={e => (e.key === 'Enter' || e.key === ' ') && onClick({ ...event, hasConflict })}
      style={{ animation:`fsp-fadeUp 0.28s ease ${index * 0.045}s both` }}
    >
      <div style={{
        background:`linear-gradient(135deg, ${accentColor}EE 0%, ${accentColor}BB 100%)`,
        padding:'14px 16px 12px', flexShrink:0, position:'relative', overflow:'hidden'
      }}>
        <div style={{ position:'absolute', inset:0, pointerEvents:'none', backgroundImage:`radial-gradient(circle, rgba(255,255,255,0.12) 1px, transparent 1px)`, backgroundSize:'14px 14px' }}/>
        <div style={{ position:'relative', zIndex:1 }}>
          <div style={{ display:'flex', alignItems:'center', justifyContent:'space-between', marginBottom:10 }}>
            <span style={{ fontFamily:"'Sora',sans-serif", fontSize:10, fontWeight:800, letterSpacing:'1.2px', textTransform:'uppercase', color:'rgba(255,255,255,0.9)', background:'rgba(255,255,255,0.18)', padding:'3px 10px', borderRadius:99 }}>
              {DAY_SHORT[event.day] || event.day || '—'}
            </span>
            <span style={{ fontFamily:"'Inter',sans-serif", fontSize:9.5, fontWeight:700, padding:'3px 9px', borderRadius:6, background: isLab ? 'rgba(217,119,6,0.25)' : 'rgba(37,99,235,0.25)', color: isLab ? 'rgba(245, 158, 11, 0.25)' : '#BFDBFE', border: `1px solid ${isLab ? 'rgba(217,119,6,0.4)' : 'rgba(37,99,235,0.4)'}`, letterSpacing:'.3px' }}>
              {isLab ? 'LAB' : 'LEC'}
            </span>
          </div>
          <div style={{ fontFamily:"'Sora',sans-serif", fontSize:22, fontWeight:800, color: '#fff', lineHeight:1, letterSpacing:'-0.3px', marginBottom:4 }}>
            {event.courseCode || '—'}
          </div>
          <div style={{ fontFamily:"'Inter',sans-serif", fontSize:11.5, color:'rgba(255,255,255,0.72)', fontWeight:500, lineHeight:1.4, display:'-webkit-box', WebkitLineClamp:2, WebkitBoxOrient:'vertical', overflow:'hidden' }}>
            {event.title}
          </div>
        </div>
      </div>

      <div style={{ padding:'12px 14px', flex:1, display:'flex', flexDirection:'column', gap:8 }}>
        {[
          { icon: <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2"><circle cx="12" cy="12" r="10"/><polyline points="12 6 12 12 16 14"/></svg>, label: 'Time', value: timeParts.join(' – ') || '—' },
          { icon: <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2"><path d="M3 9l9-7 9 7v11a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z"/><polyline points="9 22 9 12 15 12 15 22"/></svg>, label: 'Room', value: event.room || '—' },
          { icon: <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2"><path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2"/><circle cx="9" cy="7" r="4"/></svg>, label: 'Section', value: classTag || '—' },
        ].map(({ icon, label, value }) => (
          <div key={label} style={{ display:'flex', alignItems:'center', gap:9 }}>
            <div style={{ width:24, height:24, borderRadius:6, flexShrink:0, background:T.bgAlt, border:`1px solid ${T.borderLight}`, display:'flex', alignItems:'center', justifyContent:'center', color:T.textMuted }}>{icon}</div>
            <div style={{ minWidth:0, flex:1 }}>
              <div style={{ fontFamily:"'Inter',sans-serif", fontSize:8.5, fontWeight:700, color:T.textLight, textTransform:'uppercase', letterSpacing:'.6px' }}>{label}</div>
              <div style={{ fontFamily:"'Inter',sans-serif", fontSize:12, fontWeight:600, color:T.textMain, whiteSpace:'nowrap', overflow:'hidden', textOverflow:'ellipsis' }}>{value}</div>
            </div>
            {label === 'Section' && event.units != null && (
              <div style={{ flexShrink:0, fontFamily:"'Sora',sans-serif", fontSize:13, fontWeight:800, color:accentColor, background:`${accentColor}12`, borderRadius:8, padding:'3px 9px', border:`1px solid ${accentColor}25` }}>
                {event.units}<span style={{ fontSize:8, fontWeight:600, color:T.textMuted, marginLeft:2 }}>u</span>
              </div>
            )}
          </div>
        ))}
        {(isMerged || hasConflict) && (
          <div style={{ display:'flex', gap:5, flexWrap:'wrap', marginTop:2 }}>
            {isMerged    && <Badge type="merged">Merged</Badge>}
            {hasConflict && <Badge type="conflict">Conflict</Badge>}
          </div>
        )}
      </div>

      <div style={{ padding:'8px 14px', borderTop:`1px solid ${T.borderLight}`, display:'flex', alignItems:'center', justifyContent:'space-between', background:T.bgAlt, flexShrink:0 }}>
        <span style={{ fontFamily:"'Inter',sans-serif", fontSize:10, fontWeight:600, color:T.textLight }}>Tap to view details</span>
        <div style={{ width:20, height:20, borderRadius:6, background:`${accentColor}14`, border:`1px solid ${accentColor}25`, display:'flex', alignItems:'center', justifyContent:'center' }}>
          <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke={accentColor} strokeWidth="2.5"><polyline points="9 18 15 12 9 6"/></svg>
        </div>
      </div>
    </div>
  )
}

// ─── Weekly Overview ───────────────────────────────
function WeekHeatmap({ myEvents }) {
  const dayCount = useMemo(() => {
    const map = {}
    DAYS.forEach(d => { map[d] = myEvents.filter(e => e.day === d).length })
    return map
  }, [myEvents])
  const maxCount = Math.max(...Object.values(dayCount), 1)

  return (
    <div style={{ display:'flex', flexDirection:'column', gap:10 }}>
      {DAYS.map((d, i) => {
        const count     = dayCount[d]
        const intensity = count / maxCount
        const color     = DAY_COLOR[i]
        const hasClass  = count > 0
        return (
          <div key={d} style={{ display:'flex', alignItems:'center', gap:12 }}>
            <div style={{ width:32, fontFamily:"'Inter',sans-serif", fontSize:11, fontWeight:700, color: hasClass ? T.textMid : T.textLight, textTransform:'uppercase', letterSpacing:'.5px', flexShrink:0, textAlign:'right' }}>
              {d.slice(0,3)}
            </div>
            <div style={{ flex:1, height:10, borderRadius:99, background:T.borderLight, overflow:'hidden', position:'relative' }}>
              {hasClass && (
                <div style={{ position:'absolute', left:0, top:0, bottom:0, borderRadius:99, width:`${Math.max(8, intensity * 100)}%`, background:`linear-gradient(90deg, ${color}CC, ${color})`, transition:'width 0.7s cubic-bezier(0.34,1.2,0.64,1)' }}/>
              )}
            </div>
            {hasClass
              ? <span style={{ fontFamily:"'Sora',sans-serif", fontSize:11, fontWeight:800, color, minWidth:20, textAlign:'center', flexShrink:0, background:`${color}12`, padding:'1px 7px', borderRadius:99, border:`1px solid ${color}20` }}>{count}</span>
              : <span style={{ fontFamily:"'Inter',sans-serif", fontSize:11, color:T.textLight, minWidth:20, textAlign:'center', flexShrink:0 }}>—</span>
            }
          </div>
        )
      })}
    </div>
  )
}

// ─── Timetable View ───────────────────────────────────────────────────────────
function TimetableView({ events, conflictMap, onSelect }) {
  const timeSlots = useMemo(() => {
    const set = new Set(events.map(e => e.period).filter(Boolean))
    return [...set].sort((a, b) => periodStartMinutes(a) - periodStartMinutes(b))
  }, [events])
  const activeDays = useMemo(() => DAYS.filter(d => events.some(e => e.day === d)), [events])

  if (activeDays.length === 0 || timeSlots.length === 0) return null

  const cellMap = useMemo(() => {
    const m = {}
    for (const e of events) {
      const key = `${e.day}||${e.period}`
      if (!m[key]) m[key] = []
      m[key].push(e)
    }
    return m
  }, [events])

  const TIME_W  = 72

  return (
    <div style={{ background:T.bg, borderRadius:16, border:`1px solid ${T.border}`, overflow:'hidden', boxShadow:'0 1px 8px rgba(14,42,28,0.05)', animation:'fsp-fadeUp 0.3s ease both' }}>
      <div style={{ display:'flex', borderBottom:`2px solid ${T.border}`, background:T.bgAlt }}>
        <div style={{ width:TIME_W, flexShrink:0, padding:'11px 8px', borderRight:`1px solid ${T.border}`, display:'flex', alignItems:'center', justifyContent:'center' }}>
          <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke={T.textMuted} strokeWidth="2"><circle cx="12" cy="12" r="10"/><polyline points="12 6 12 12 16 14"/></svg>
        </div>
        {activeDays.map((d, i) => {
          const color = DAY_COLOR[DAYS.indexOf(d)]
          return (
            <div key={d} style={{ flex:1, padding:'10px 8px', textAlign:'center', borderRight: i < activeDays.length - 1 ? `1px solid ${T.border}` : 'none', borderBottom:`3px solid ${color}` }}>
              <div style={{ fontFamily:"'Sora',sans-serif", fontSize:12, fontWeight:800, color, letterSpacing:'.5px', textTransform:'uppercase' }}>{DAY_SHORT[d]}</div>
              <div style={{ fontFamily:"'Inter',sans-serif", fontSize:10, color:T.textLight, marginTop:2 }}>{events.filter(e => e.day === d).length} class{events.filter(e => e.day === d).length !== 1 ? 'es' : ''}</div>
            </div>
          )
        })}
      </div>
      <div style={{ overflowY:'auto', maxHeight:520 }}>
        {timeSlots.map((slot, ri) => (
          <div key={slot} style={{ display:'flex', minHeight:72, borderBottom: ri < timeSlots.length - 1 ? `1px solid ${T.borderLight}` : 'none', background: ri % 2 === 0 ? T.bg : 'var(--bg)' }}>
            <div style={{ width:TIME_W, flexShrink:0, padding:'10px 6px', borderRight:`1px solid ${T.border}`, display:'flex', flexDirection:'column', alignItems:'center', justifyContent:'center', gap:2 }}>
              {formatPeriodCompact(slot).map((t, ti) => (
                <span key={ti} style={{ fontFamily:"'Inter',sans-serif", fontSize: ti === 0 ? 10.5 : 9.5, fontWeight: ti === 0 ? 700 : 500, color: ti === 0 ? T.textMid : T.textMuted, lineHeight:1.3, whiteSpace:'nowrap', textAlign:'center' }}>{t}</span>
              ))}
            </div>
            {activeDays.map((d, di) => {
              const key    = `${d}||${slot}`
              const evts   = cellMap[key] || []
              const color  = DAY_COLOR[DAYS.indexOf(d)]
              return (
                <div key={d} style={{ flex:1, padding:'6px 5px', minWidth:0, borderRight: di < activeDays.length - 1 ? `1px solid ${T.borderLight}` : 'none', display:'flex', flexDirection:'column', gap:4 }}>
                  {evts.map((ev, ei) => {
                    const hasConflict = conflictMap?.has(ev.schedule_id)
                    const isLab = ev.session?.toLowerCase().includes('lab')
                    return (
                      <div key={ei} onClick={() => onSelect({ ...ev, hasConflict })} style={{ flex:1, cursor:'pointer', borderRadius:9, padding:'7px 9px', background:`${color}0F`, border:`1.5px solid ${color}28`, borderLeft:`3px solid ${color}`, transition:'all 0.15s', userSelect:'none', minHeight:56 }} onMouseEnter={e => { e.currentTarget.style.background=`${color}1A`; e.currentTarget.style.transform='scale(1.015)'; e.currentTarget.style.boxShadow=`0 4px 12px ${color}25` }} onMouseLeave={e => { e.currentTarget.style.background=`${color}0F`; e.currentTarget.style.transform='scale(1)'; e.currentTarget.style.boxShadow='none' }}>
                        <div style={{ fontFamily:"'Sora',sans-serif", fontSize:11, fontWeight:800, color, lineHeight:1.2, marginBottom:3 }}>{ev.courseCode}</div>
                        <div style={{ fontFamily:"'Inter',sans-serif", fontSize:9.5, color:T.textMuted, fontWeight:500, lineHeight:1.3, overflow:'hidden', display:'-webkit-box', WebkitLineClamp:2, WebkitBoxOrient:'vertical' }}>{ev.title}</div>
                        <div style={{ display:'flex', gap:3, marginTop:5, flexWrap:'wrap', alignItems:'center' }}>
                          <span style={{ fontSize:8.5, fontWeight:700, padding:'1px 5px', borderRadius:4, background: isLab ? 'rgba(217, 119, 6, 0.05)' : 'rgba(37, 99, 235, 0.1)', color: isLab ? '#F59E0B' : '#60A5FA', border: `1px solid ${isLab ? 'rgba(245, 158, 11, 0.25)' : '#BFDBFE'}` }}>{isLab ? 'LAB' : 'LEC'}</span>
                          {ev.room && <span style={{ fontSize:8.5, fontWeight:600, color:T.textMuted }}>{ev.room}</span>}
                          {hasConflict && <span style={{ fontSize:8.5, fontWeight:700, color:'#EF4444', background:'rgba(239, 68, 68, 0.05)', padding:'1px 5px', borderRadius:4, border:'1px solid #FECACA' }}>!</span>}
                        </div>
                      </div>
                    )
                  })}
                </div>
              )
            })}
          </div>
        ))}
      </div>
    </div>
  )
}

// ─── Stat Card ────────────────────────────────────────────────────────────────
function StatCard({ label, value, color, iconSrc, delay = 0 }) {
  return (
    <div className="fsp-stat-card" style={{ animationDelay:`${delay}s` }}>
      <div style={{ width:40, height:40, borderRadius:11, flexShrink:0, background:`${color}12`, border:`1px solid ${color}20`, display:'flex', alignItems:'center', justifyContent:'center' }}>
        <img src={iconSrc} alt={label} style={{ width:22, height:22, objectFit:'contain' }} />
      </div>
      <div style={{ minWidth:0 }}>
        <div style={{ fontFamily:"'Inter',sans-serif", fontSize:9, fontWeight:700, color:T.textMuted, textTransform:'uppercase', letterSpacing:'.9px', marginBottom:3 }}>{label}</div>
        <div style={{ fontFamily:"'Sora',sans-serif", fontSize:22, fontWeight:800, color, lineHeight:1.1, overflow:'hidden', textOverflow:'ellipsis', whiteSpace:'nowrap' }}>{value}</div>
      </div>
    </div>
  )
}

// ─── Main Component ───────────────────────────────────────────────────────────
export default function FacultySchedulePage() {
  const { user } = useAuth()

  const [schedulesMeta,    setSchedulesMeta]    = useState([])   // full metadata objects
  const [selectedSchedule, setSelectedSchedule] = useState('')   // schedule id/name
  const [finalizedMeta,    setFinalizedMeta]    = useState(null) // the finalized schedule meta, if any
  const [events,           setEvents]           = useState([])
  const [facultyName,      setFacultyName]      = useState('')
  const [facultyMeta,      setFacultyMeta]      = useState({})

  const [viewMode,         setViewMode]         = useState('list')
  const [activeDay,        setActiveDay]        = useState('All')
  const [sessionFilter,    setSessionFilter]    = useState('All')
  const [searchQuery,      setSearchQuery]      = useState('')
  const [selectedEvent,    setSelectedEvent]    = useState(null)

  const [listLoading,   setListLoading]   = useState(true)
  const [eventsLoading, setEventsLoading] = useState(false)
  const [exporting,     setExporting]     = useState(false)
  const [exportingIcs,  setExportingIcs]  = useState(false)
  const [error,         setError]         = useState('')

  // Derive a stable list — faculty only sees finalized schedules
  const finalizedSchedules = useMemo(() =>
    schedulesMeta.filter(s => s.finalized),
  [schedulesMeta])

  const scheduleNames = useMemo(() =>
    finalizedSchedules.map(s => s.id || s.name).filter(Boolean),
  [finalizedSchedules])

  // Label helper for dropdown options
  function scheduleLabel(idOrName) {
    const meta = finalizedSchedules.find(s => (s.id || s.name) === idOrName)
    if (!meta) return idOrName
    const parts = [meta.name || idOrName]
    if (meta.academicYear) parts.push(`A.Y. ${meta.academicYear}`)
    if (meta.semester)     parts.push(meta.semester)
    return parts.join(' · ')
  }

  useEffect(() => {
    if (!user) return
    async function init() {
      try {
        let resolvedName = user.displayName || user.email || ''
        try {
          const list = await getFaculty()
          if (list.length > 0) {
            const me = list[0]
            if (me.name) resolvedName = me.name
            setFacultyMeta({ rank:me.AcademicRank||'', department:me.Department||'', status:me.status||'full-time' })
          }
        } catch {}
        setFacultyName(resolvedName)

        const raw = await listSaved()
        const arr = Array.isArray(raw) ? raw : (raw?.schedules || [])
        setSchedulesMeta(arr)

        // Faculty only sees finalized schedules — auto-select the most recent one
        const finalized = arr.filter(s => s.finalized)
        if (finalized.length > 0) {
          const latest = finalized[finalized.length - 1]
          setFinalizedMeta(latest)
          setSelectedSchedule(latest.id || latest.name)
        }
      } catch {
        setError('Could not load schedule data.')
      } finally {
        setListLoading(false)
      }
    }
    init()
  }, [user])

  useEffect(() => {
    if (!selectedSchedule) return
    setEventsLoading(true)
    loadSaved(selectedSchedule)
      .then(data => {
        setEvents(data.schedule || data.events || [])
        // Keep finalizedMeta in sync when user manually switches schedules
        const meta = schedulesMeta.find(s => (s.id || s.name) === selectedSchedule)
        setFinalizedMeta(meta?.finalized ? meta : null)
      })
      .catch(() => setError(`Could not load "${selectedSchedule}".`))
      .finally(() => setEventsLoading(false))
  }, [selectedSchedule])

  const myEvents = useMemo(() => {
    if (!facultyName && !user?.email) return []
    return events.filter(e => (facultyName && e.faculty === facultyName) || (user?.email && e.faculty === user.email))
  }, [events, facultyName, user])

  const conflictMap  = useMemo(() => buildConflictMap?.(myEvents) || new Map(), [myEvents])
  const teachingDays = useMemo(() => DAYS.filter(d => myEvents.some(e => e.day === d)), [myEvents])
  
  const displayedEvents = useMemo(() => {
    let arr = [...myEvents]
    
    // Filter by Day
    if (activeDay !== 'All') arr = arr.filter(e => e.day === activeDay)
    
    // Filter by Session Type
    if (sessionFilter === 'Lecture') arr = arr.filter(e => !e.session?.toLowerCase().includes('lab'))
    if (sessionFilter === 'Lab') arr = arr.filter(e => e.session?.toLowerCase().includes('lab'))
    
    // Filter by Search Query
    if (searchQuery.trim()) {
      const q = searchQuery.toLowerCase()
      arr = arr.filter(e => 
        (e.courseCode && e.courseCode.toLowerCase().includes(q)) ||
        (e.title && e.title.toLowerCase().includes(q)) ||
        (e.room && e.room.toLowerCase().includes(q))
      )
    }

    arr.sort((a, b) => {
      const da = DAYS.indexOf(a.day), db = DAYS.indexOf(b.day)
      if (da !== db) return da - db
      return periodStartMinutes(a.period) - periodStartMinutes(b.period)
    })
    return arr
  }, [myEvents, activeDay, sessionFilter, searchQuery])

  const totalUnits  = useMemo(() => myEvents.reduce((s, e) => s + (e.units || 0), 0), [myEvents])
  const loading     = listLoading || eventsLoading
  const avatarColor = useMemo(() => getAvatarColor(facultyName), [facultyName])
  const initials    = useMemo(() => getInitials(facultyName), [facultyName])

  async function handleExport() {
    if (!displayedEvents?.length || exporting) return
    setExporting(true)
    try {
      const schedLabel = selectedSchedule || 'Schedule'
      const safeName   = (facultyName || 'Faculty').replace(/[^a-zA-Z0-9\s-]/g, '').trim()
      await exportScheduleToExcel(displayedEvents, `${safeName} - ${schedLabel} (Filtered)`)
    } finally {
      setExporting(false)
    }
  }

  // Uses the full myEvents (not displayedEvents) — a personal calendar import
  // should carry the whole teaching schedule, not whatever day/session filter
  // happens to be active in the view right now.
  async function handleExportIcs() {
    if (!myEvents?.length || exportingIcs) return
    setExportingIcs(true)
    try {
      const schedLabel = selectedSchedule || 'Schedule'
      const safeName   = (facultyName || 'Faculty').replace(/[^a-zA-Z0-9\s-]/g, '').trim()
      await exportScheduleToICS(myEvents, `${safeName} - ${schedLabel}`)
    } finally {
      setExportingIcs(false)
    }
  }

  return (
    <div className="fsp-page-wrap" style={{ fontFamily:"'Inter',sans-serif", color:T.textMain, minHeight:'100vh', background:T.bgPage, padding:'28px 28px 48px' }}>

      {/* ══ MODAL ══ */}
      {selectedEvent && (
        <SessionModal event={selectedEvent} onClose={() => setSelectedEvent(null)} />
      )}

      {/* ══ HERO HEADER ══ */}
      <div className="fsp-hero-wrap" style={{
        background: `linear-gradient(135deg, ${T.forest} 0%, ${T.forestDeep} 60%, #265242 100%)`,
        borderRadius:20, padding:'24px 28px',
        marginBottom:20, position:'relative', overflow:'hidden',
        boxShadow:'0 6px 28px rgba(46,122,82,0.22)',
        animation:'fsp-fadeUp 0.3s ease both'
      }}>
        {/* Grid overlay */}
        <div style={{ position:'absolute', inset:0, zIndex:0, pointerEvents:'none', backgroundImage:`linear-gradient(rgba(255,255,255,0.06) 1px,transparent 1px),linear-gradient(90deg,rgba(255,255,255,0.06) 1px,transparent 1px)`, backgroundSize:'32px 32px' }}/>
        <div style={{ position:'absolute', bottom:-60, right:-60, width:280, height:280, background:'radial-gradient(ellipse,rgba(255,255,255,0.08) 0%,transparent 65%)', pointerEvents:'none', zIndex:0 }}/>

        <div style={{ position:'relative', zIndex:1, display:'flex', alignItems:'center', justifyContent:'space-between', gap:16, flexWrap:'wrap' }}>

          {/* Faculty identity */}
          <div style={{ display:'flex', alignItems:'center', gap:16 }}>
            <div className="fsp-hero-avatar" style={{
              width:56, height:56, borderRadius:16, flexShrink:0,
              background: listLoading ? 'rgba(110,231,183,0.12)' : avatarColor.bg,
              color: listLoading ? 'var(--mint)' : avatarColor.fg,
              display:'flex', alignItems:'center', justifyContent:'center',
              fontSize:19, fontWeight:800, letterSpacing:'-0.5px', fontFamily:"'Sora',sans-serif",
              border:`2.5px solid ${listLoading ? 'rgba(110,231,183,0.25)' : avatarColor.fg + '30'}`,
              boxShadow:'0 4px 16px rgba(0,0,0,0.20)'
            }}>
              {listLoading ? <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8"><path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2"/><circle cx="12" cy="7" r="4"/></svg> : initials}
            </div>

            <div>
              <div style={{ display:'flex', alignItems:'center', gap:8, marginBottom:4 }}>
                <span style={{ fontFamily:"'Inter',sans-serif", fontSize:10, fontWeight:700, color:'rgba(255,255,255,0.80)', textTransform:'uppercase', letterSpacing:'1px' }}>
                  My Schedule
                </span>
                {facultyMeta.status && (
                  <span style={{
                    fontSize:10, fontWeight:700, padding:'2px 9px', borderRadius:99,
                    background: facultyMeta.status === 'full-time' ? 'rgba(110,231,183,0.15)' : 'rgba(255,255,255,0.08)',
                    color:      facultyMeta.status === 'full-time' ? 'var(--mint)' : 'rgba(255,255,255,0.65)',
                    border:    `1px solid ${facultyMeta.status === 'full-time' ? 'rgba(110,231,183,0.30)' : 'rgba(255,255,255,0.15)'}`,
                    fontFamily:"'Inter',sans-serif"
                  }}>
                    {facultyMeta.status === 'full-time' ? 'Full-Time' : 'Part-Time'}
                  </span>
                )}
              </div>
              <h1 className="fsp-hero-title" style={{ fontFamily:"'Sora',sans-serif", fontSize:22, fontWeight:800, color: '#fff', margin:0, lineHeight:1.15, letterSpacing:'-.4px' }}>
                {listLoading ? '…' : facultyName || 'Faculty Schedule'}
              </h1>
              {facultyMeta.rank && (
                <p style={{ fontFamily:"'Inter',sans-serif", fontSize:12.5, color:'rgba(255,255,255,0.50)', margin:'4px 0 0', fontWeight:500 }}>
                  {facultyMeta.rank}{facultyMeta.department ? ` · ${facultyMeta.department}` : ''}
                </p>
              )}
            </div>
          </div>

          {/* Controls - View Toggle Only */}
          <div style={{ display:'flex', gap:10, alignItems:'center', flexWrap:'wrap' }}>
            <div style={{
              display:'flex', background:'rgba(255,255,255,0.12)',
              border:'1.5px solid rgba(255,255,255,0.20)', borderRadius:10, padding:3, gap:2
            }}>
              {[
                { mode:'list', title:'List', icon: <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"><line x1="8" y1="6" x2="21" y2="6"/><line x1="8" y1="12" x2="21" y2="12"/><line x1="8" y1="18" x2="21" y2="18"/><line x1="3" y1="6" x2="3.01" y2="6"/><line x1="3" y1="12" x2="3.01" y2="12"/><line x1="3" y1="18" x2="3.01" y2="18"/></svg> },
                { mode:'grid', title:'Cards', icon: <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"><rect x="3" y="3" width="7" height="7"/><rect x="14" y="3" width="7" height="7"/><rect x="14" y="14" width="7" height="7"/><rect x="3" y="14" width="7" height="7"/></svg> },
                { mode:'timetable', title:'Timetable', icon: <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"><rect x="3" y="3" width="18" height="18" rx="2"/><line x1="3" y1="9" x2="21" y2="9"/><line x1="3" y1="15" x2="21" y2="15"/><line x1="9" y1="3" x2="9" y2="21"/><line x1="15" y1="3" x2="15" y2="21"/></svg> },
              ].map(({ mode, icon, title }) => (
                <button key={mode} className="fsp-view-btn"
                  title={title}
                  onClick={() => setViewMode(mode)}
                  style={{
                    background: viewMode === mode ? 'rgba(255,255,255,0.22)' : 'transparent',
                    color:      viewMode === mode ? 'var(--surface)' : 'rgba(255,255,255,0.50)',
                    boxShadow:  viewMode === mode ? '0 1px 4px rgba(0,0,0,0.15)' : 'none',
                  }}
                >{icon}</button>
              ))}
            </div>
          </div>
        </div>
      </div>

      {/* ══ STAT STRIP ══ */}
      {!loading && myEvents.length > 0 && (
        <div style={{ display:'flex', gap:10, marginBottom:16, flexWrap:'wrap' }}>
          <StatCard delay={0.0}  label="Total Classes"  value={myEvents.length}          color={T.green}    iconSrc={iconClasses}  />
          <StatCard delay={0.06} label="Teaching Days"  value={teachingDays.length}      color="#3A9CBA"    iconSrc={iconDays}     />
          <StatCard delay={0.12} label="Total Units"    value={totalUnits}               color="#48BFA3"    iconSrc={iconUnits}    />
        </div>
      )}

      {/* ══ FILTER & CONTROLS ROW ══ */}
      {!loading && scheduleNames.length > 0 && (
        <div style={{
          display: 'flex', flexWrap: 'wrap', gap: 12, alignItems: 'center', justifyContent: 'space-between',
          background: 'var(--surface)', padding: '14px 18px', borderRadius: 16, border: `1px solid ${T.border}`,
          boxShadow: '0 1px 6px rgba(14,42,28,0.03)', marginBottom: 20
        }}>
          {/* Left Side: Schedule & Type Dropdowns */}
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: 16, alignItems: 'center', flex: '1 1 auto' }}>
            
            {/* Schedule Selector — shows only finalized schedules */}
            {scheduleNames.length > 0 && (
              <div className="fsp-filter-group" style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                <span style={{ fontSize: 11, fontWeight: 700, color: T.textMuted, textTransform: 'uppercase', letterSpacing: '.5px' }}>
                  Schedule
                </span>
                <span style={{
                  display: 'inline-flex', alignItems: 'center', gap: 4,
                  padding: '2px 9px', borderRadius: 99, fontSize: 10, fontWeight: 700,
                  background: 'var(--meadow-soft)', color: 'var(--meadow)', border: '1px solid var(--meadow-border)',
                  whiteSpace: 'nowrap'
                }}>
                  <svg width="9" height="9" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"><polyline points="20 6 9 17 4 12"/></svg>
                  Published
                </span>
                <div style={{ position: 'relative' }}>
                  <select value={selectedSchedule} onChange={e => setSelectedSchedule(e.target.value)} className="fsp-select" style={{ minWidth: 150 }}>
                    {scheduleNames.map(id => (
                      <option key={id} value={id}>{scheduleLabel(id)}</option>
                    ))}
                  </select>
                  <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke={T.textMuted} strokeWidth="2.5" style={{ position:'absolute', right:12, top:'50%', transform:'translateY(-50%)', pointerEvents:'none' }}><polyline points="6 9 12 15 18 9"/></svg>
                </div>
              </div>
            )}

            <div className="fsp-divider" style={{ width: 1, height: 24, background: T.border, display: scheduleNames.length ? 'block' : 'none' }} />

            {/* Session Type Filter */}
            <div className="fsp-filter-group" style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
              <span style={{ fontSize: 11, fontWeight: 700, color: T.textMuted, textTransform: 'uppercase', letterSpacing: '.5px' }}>
                Session
              </span>
              <div style={{ position: 'relative' }}>
                <select value={sessionFilter} onChange={e => setSessionFilter(e.target.value)} className="fsp-select" style={{ minWidth: 140 }}>
                  <option value="All">All Types</option>
                  <option value="Lecture">Lecture</option>
                  <option value="Lab">Laboratory</option>
                </select>
                <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke={T.textMuted} strokeWidth="2.5" style={{ position:'absolute', right:12, top:'50%', transform:'translateY(-50%)', pointerEvents:'none' }}><polyline points="6 9 12 15 18 9"/></svg>
              </div>
            </div>

          </div>

          {/* Right Side: Search & Export */}
          <div className="fsp-right-controls" style={{ display: 'flex', flexWrap: 'wrap', gap: 12, alignItems: 'center', flex: '1 1 auto', justifyContent: 'flex-end' }}>
            
            {/* Search Input */}
            <div className="fsp-search-wrapper" style={{ position: 'relative' }}>
              <input
                type="text"
                placeholder="Search class or room..."
                value={searchQuery}
                onChange={e => setSearchQuery(e.target.value)}
                className="fsp-search-input"
              />
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="var(--muted2)" strokeWidth="2.5"
                style={{ position:'absolute', left:12, top:'50%', transform:'translateY(-50%)', pointerEvents:'none' }}>
                <circle cx="11" cy="11" r="8"/><line x1="21" y1="21" x2="16.65" y2="16.65"/>
              </svg>
              {searchQuery && (
                <button onClick={() => setSearchQuery('')} className="fsp-search-clear">×</button>
              )}
            </div>

            {/* Export Button */}
            <button onClick={handleExport} disabled={exporting || displayedEvents.length === 0} className="fsp-export-btn" title="Export filtered schedule to Excel">
              {exporting ? (
                 <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" style={{ animation: 'fsp-spin 0.8s linear infinite' }}><path d="M21 12a9 9 0 1 1-6.219-8.56"/></svg>
              ) : (
                 <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/><polyline points="7 10 12 15 17 10"/><line x1="12" y1="15" x2="12" y2="3"/></svg>
              )}
              Export
            </button>

            {/* Add to Calendar Button (.ics) */}
            <button onClick={handleExportIcs} disabled={exportingIcs || myEvents.length === 0} className="fsp-export-btn" title="Download your full schedule as a .ics file to import into Google Calendar, Outlook, or Apple Calendar">
              {exportingIcs ? (
                 <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" style={{ animation: 'fsp-spin 0.8s linear infinite' }}><path d="M21 12a9 9 0 1 1-6.219-8.56"/></svg>
              ) : (
                 <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"><rect x="3" y="4" width="18" height="18" rx="2"/><line x1="16" y1="2" x2="16" y2="6"/><line x1="8" y1="2" x2="8" y2="6"/><line x1="3" y1="10" x2="21" y2="10"/><line x1="12" y1="14" x2="12" y2="18"/><line x1="10" y1="16" x2="14" y2="16"/></svg>
              )}
              Add to Calendar
            </button>
          </div>
        </div>
      )}

      {/* ══ LOADING SKELETONS ══ */}
      {loading && (
        <div style={{ display:'flex', flexDirection:'column', gap:10 }}>
          <div style={{ background:T.bg, borderRadius:14, border:`1px solid ${T.border}`, padding:20, marginBottom:10 }}>
            <Skel w="100%" h={60} r={10}/>
          </div>
          {[1,2,3].map(i => (
            <div key={i} style={{ background:T.bg, borderRadius:14, border:`1px solid ${T.border}`, display:'flex', overflow:'hidden' }}>
              <div style={{ width:88, background:T.bgAlt, padding:20 }}><Skel w="100%" h={56} r={8}/></div>
              <div style={{ flex:1, padding:'18px 20px', display:'flex', flexDirection:'column', gap:10 }}>
                <Skel w="48%" h={16}/>
                <Skel w="30%" h={11}/>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* ══ NO SCHEDULES ══ */}
      {!loading && scheduleNames.length === 0 && (
        <div style={{
          background:T.bg, borderRadius:18, padding:'60px 32px', border:`2px dashed ${T.border}`,
          display:'flex', flexDirection:'column', alignItems:'center', gap:18, textAlign:'center',
          animation:'fsp-fadeUp 0.3s ease both'
        }}>
          <div style={{ width:64, height:64, borderRadius:18, background:T.greenSoft, border:`1px solid ${T.greenBorder}`, display:'flex', alignItems:'center', justifyContent:'center' }}>
            <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke={T.green} strokeWidth="1.7"><rect x="3" y="4" width="18" height="18" rx="2"/><line x1="16" y1="2" x2="16" y2="6"/><line x1="8" y1="2" x2="8" y2="6"/><line x1="3" y1="10" x2="21" y2="10"/></svg>
          </div>
          <div>
            <p style={{ fontFamily:"'Sora',sans-serif", fontSize:17, fontWeight:800, color:T.textMain, margin:'0 0 9px' }}>No published schedules yet</p>
            <p style={{ fontFamily:"'Inter',sans-serif", fontSize:13.5, color:T.textMuted, maxWidth:340, lineHeight:1.75, margin:0 }}>Once administration finalizes and publishes a schedule, your classes will appear here.</p>
          </div>
        </div>
      )}

      {/* ══ HAS EVENTS ══ */}
      {!loading && myEvents.length > 0 && (
        <>
          {/* Weekly Heatmap */}
          <div style={{
            background:T.bg, borderRadius:16, border:`1px solid ${T.border}`,
            padding:'18px 22px', marginBottom:18,
            boxShadow:'0 1px 8px rgba(14,42,28,0.05)',
            animation:'fsp-fadeUp 0.3s ease 0.05s both'
          }}>
            <div style={{ display:'flex', alignItems:'center', gap:8, marginBottom:16 }}>
              <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke={T.green} strokeWidth="2.5"><rect x="3" y="4" width="18" height="18" rx="2"/><line x1="16" y1="2" x2="16" y2="6"/><line x1="8" y1="2" x2="8" y2="6"/><line x1="3" y1="10" x2="21" y2="10"/></svg>
              <span style={{ fontFamily:"'Inter',sans-serif", fontSize:10, fontWeight:700, color:T.textMuted, textTransform:'uppercase', letterSpacing:'.9px' }}>Weekly Overview</span>
            </div>
            <WeekHeatmap myEvents={myEvents}/>
          </div>

          {/* DAY PILLS ROW */}
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 16, marginBottom: 18, flexWrap: 'wrap' }}>
            <div style={{ display:'flex', gap:6, flexWrap:'wrap' }}>
              <button
                onClick={() => setActiveDay('All')}
                className="fsp-pill"
                style={{
                  background: activeDay === 'All' ? T.greenSoft : 'transparent',
                  borderColor: activeDay === 'All' ? T.greenBorder : T.border,
                  color: activeDay === 'All' ? T.greenDeep : T.textMuted,
                }}
              >
                All Days
                <span style={{
                  fontSize:10, fontWeight:800, padding:'1px 8px', borderRadius:99,
                  background: activeDay === 'All' ? T.bg : T.bgAlt,
                  color: activeDay === 'All' ? T.green : T.textMuted,
                  border:`1px solid ${activeDay === 'All' ? T.greenBorder : T.border}`
                }}>{myEvents.length}</span>
              </button>

              {teachingDays.map(day => {
                const count  = myEvents.filter(e => e.day === day).length
                const active = activeDay === day
                const color  = DAY_COLOR[DAYS.indexOf(day)]
                return (
                  <button key={day} className="fsp-pill" onClick={() => setActiveDay(active ? 'All' : day)} style={{ background: active ? `${color}12` : 'transparent', borderColor: active ? `${color}50` : T.border, color: active ? color : T.textMuted }}>
                    {active && <div style={{ width:6, height:6, borderRadius:'50%', background:color, flexShrink:0 }}/>}
                    {day}
                    <span style={{ fontSize:10, fontWeight:800, padding:'1px 8px', borderRadius:99, background: active ? T.bg : T.bgAlt, color: active ? color : T.textMuted, border:`1px solid ${active ? color + '40' : T.border}` }}>{count}</span>
                  </button>
                )
              })}
            </div>
          </div>

          {/* Fallback for no search results */}
          {displayedEvents.length === 0 && (searchQuery || sessionFilter !== 'All') && (
             <div style={{ padding: '40px 20px', textAlign: 'center', color: T.textMuted, fontSize: 14 }}>
               No classes match your current filters.
             </div>
          )}

          {/* Cards */}
          {displayedEvents.length > 0 && (
            viewMode === 'list' ? (
              <div style={{ display:'flex', flexDirection:'column', gap:8 }}>
                {displayedEvents.map((e, i) => (
                  <ListCard key={e.schedule_id ?? `${e.courseCode}-${e.day}-${e.period}-${i}`} event={e} index={i} conflictMap={conflictMap} onClick={setSelectedEvent} />
                ))}
              </div>
            ) : viewMode === 'grid' ? (
              <div style={{ display:'grid', gridTemplateColumns:'repeat(auto-fill,minmax(286px,1fr))', gap:14 }}>
                {displayedEvents.map((e, i) => (
                  <GridCard key={e.schedule_id ?? `${e.courseCode}-${e.day}-${e.period}-${i}`} event={e} index={i} conflictMap={conflictMap} onClick={setSelectedEvent} />
                ))}
              </div>
            ) : (
              <TimetableView events={displayedEvents} conflictMap={conflictMap} onSelect={setSelectedEvent} />
            )
          )}
        </>
      )}

      {/* ══ NO ASSIGNMENTS IN THIS SCHEDULE ══ */}
      {!loading && myEvents.length === 0 && scheduleNames.length > 0 && (
        <div style={{
          background:T.bg, borderRadius:18, padding:'52px 32px', border:`2px dashed ${T.border}`,
          display:'flex', flexDirection:'column', alignItems:'center', gap:16, textAlign:'center',
          animation:'fsp-fadeUp 0.3s ease both'
        }}>
          <div style={{ width:58, height:58, borderRadius:16, background:T.bgAlt, border:`1px solid ${T.border}`, display:'flex', alignItems:'center', justifyContent:'center' }}>
            <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke={T.textMuted} strokeWidth="1.8"><circle cx="12" cy="12" r="10"/><line x1="12" y1="8" x2="12" y2="12"/><line x1="12" y1="16" x2="12.01" y2="16"/></svg>
          </div>
          <div>
            <p style={{ fontFamily:"'Sora',sans-serif", fontSize:16, fontWeight:800, color:T.textMain, margin:'0 0 8px' }}>No classes assigned</p>
            <p style={{ fontFamily:"'Inter',sans-serif", fontSize:13.5, color:T.textMuted, maxWidth:340, lineHeight:1.75, margin:0 }}>You have no teaching assignments in <strong style={{ color:T.textMain }}>{schedulesMeta.find(s=>(s.id||s.name)===selectedSchedule)?.name || selectedSchedule}</strong>.</p>
          </div>
        </div>
      )}

      {/* ══ ERROR ══ */}
      {error && (
        <div style={{ background:'#FFF0F0', border:'1px solid #FECACA', borderRadius:12, padding:'14px 18px', fontSize:13, color:'#EF4444', marginTop:16, display:'flex', gap:10, alignItems:'center', fontFamily:"'Inter',sans-serif" }}>
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><circle cx="12" cy="12" r="10"/><line x1="15" y1="9" x2="9" y2="15"/><line x1="9" y1="9" x2="15" y2="15"/></svg>
          {error}
        </div>
      )}
    </div>
  )
}