import { useEffect, useState, useMemo, useCallback } from 'react'
import { getDays, saveDays, getTime, saveTime } from '../../services/api'

import iconDays from '../../assets/DAYS.png'
import iconTime from '../../assets/TIME.png'

/* ── Design tokens (Unified with RoomsPage & CourseListPage) ── */
const G = {
  meadow: 'var(--meadow, var(--meadow))',
  meadowDeep:   'var(--meadow-deep)',
  meadowSoft:   'var(--meadow-soft)',
  meadowBorder: 'var(--meadow-border)',
  ink: 'var(--ink, #0E2A20)',
  muted: 'var(--muted, #4B7060)',
  muted2: 'var(--muted2, #6B8C7A)',
  border:       'var(--border)',
  borderLight:  'var(--hover)',
  bg: 'var(--bg, #F2F7F4)',
  surface: 'var(--surface, #FFFFFF)',
  hover:        'var(--hover)',
}

/* ─── Styles ──────────────────────────────────────────────────────────────── */
if (!document.getElementById('settings-page-style')) {
  const s = document.createElement('style')
  s.id = 'settings-page-style'
  s.textContent = `
    @import url('https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700&display=swap');

    @keyframes fadeIn { from{opacity:0} to{opacity:1} }
    @keyframes spin-r { to{transform:rotate(360deg)} }
    @keyframes cpToastIn { from{opacity:0;transform:scale(.96) translateY(12px)} to{opacity:1;transform:scale(1) translateY(0)} }
    @keyframes cpShimmer { 0%{background-position:-400px 0} 100%{background-position:400px 0} }

    /* ── Skeleton ── */
    .stg-skeleton {
      background: linear-gradient(90deg, ${G.hover} 25%, ${G.borderLight} 50%, ${G.hover} 75%);
      background-size: 800px 100%; animation: cpShimmer 1.4s ease-in-out infinite; border-radius: 6px;
    }

    /* ── Toasts (From CourseListPage) ── */
    .cp-toast-wrap { position:fixed;bottom:24px;left:50%;z-index:9999;display:flex;flex-direction:column;gap:10px;align-items:center;pointer-events:none;transform:translateX(-50%); }
    .cp-toast { display:flex;align-items:center;gap:10px;padding:12px 20px;border-radius:12px;font-family:'Inter',sans-serif;font-size:13px;font-weight:600;animation:cpToastIn .22s cubic-bezier(.4,0,.2,1);white-space:nowrap;pointer-events:auto; }
    .cp-toast.success { background:linear-gradient(135deg,${G.meadow},${G.meadowDeep});color:#fff;box-shadow:0 8px 24px rgba(0,0,0,0.3);border:1px solid ${G.meadowBorder}; }
    .cp-toast.error   { background: var(--surface);color:#DC2626;border:1.5px solid #FECACA;box-shadow:0 8px 24px rgba(220,38,38,0.15); }

    /* ── Standard Cards (Matches RoomsPage) ── */
    .stg-card { 
      background: var(--surface); border-radius: 10px; border: 1px solid ${G.border}; 
      overflow: hidden; box-shadow: 0 2px 8px rgba(0,0,0,0.03); 
      display: flex; flex-direction: column; margin-bottom: 20px;
    }
    .stg-card-head { 
      display: flex; align-items: center; gap: 14px; padding: 16px 20px; 
      border-bottom: 1px solid ${G.border}; background: ${G.surface}; flex-wrap: wrap; 
    }
    .stg-card-body { padding: 20px; }

    /* Icon Box */
    .stg-icon-box {
      width: 40px; height: 40px; border-radius: 10px; flex-shrink: 0;
      display: flex; align-items: center; justify-content: center;
    }
    .stg-icon-box img { width: 22px; height: 22px; object-fit: contain; display: block; }

    /* ── Day Segments ── */
    .day-row { display: flex; gap: 8px; flex-wrap: wrap; }
    .day-btn {
      flex: 1; min-width: 90px; padding: 14px 10px; border-radius: 8px;
      border: 1px solid ${G.border}; background: var(--surface); color: ${G.muted};
      font-family: 'Inter', sans-serif; cursor: pointer; transition: all 0.15s;
      display: flex; flex-direction: column; align-items: center; gap: 4px;
      box-shadow: 0 1px 2px rgba(0,0,0,0.02);
    }
    .day-btn:hover:not(.active) { border-color: ${G.meadowBorder}; background: ${G.hover}; color: ${G.ink}; }
    .day-btn.active {
      background: ${G.meadowSoft}; border-color: ${G.meadowBorder}; color: ${G.meadowDeep};
      box-shadow: 0 2px 8px rgba(0,0,0,0.08);
    }
    .day-btn-title { font-size: 13px; font-weight: 700; }
    .day-btn-sub { font-size: 10.5px; font-weight: 500; opacity: 0.8; }

    /* ── Standard Inputs (Matches CourseListPage) ── */
    .cp-sel { 
      padding: 9px 12px; border-radius: 10px; border: 1px solid ${G.border}; 
      font-family: 'Inter',sans-serif; font-size: 12.5px; color: ${G.ink}; 
      background: var(--surface); outline: none; transition: all 0.15s ease; width: 100%; 
      box-sizing: border-box; box-shadow: 0 1px 3px rgba(0,0,0,0.02);
      appearance:none; cursor:pointer; padding-right:32px; 
      background-image:url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='12' height='12' viewBox='0 0 24 24' fill='none' stroke='%236B8C7A' stroke-width='2.5'%3E%3Cpolyline points='6 9 12 15 18 9'/%3E%3C/svg%3E"); 
      background-repeat:no-repeat; background-position:right 12px center; 
    }
    .cp-sel:focus { border-color:${G.meadow}; box-shadow:0 0 0 3px rgba(0,0,0,0.1); }

    /* Buttons */
    .btn-outline { display: inline-flex; align-items: center; gap: 5px; padding: 8px 16px; border-radius: 8px; border: 1px solid ${G.border}; font-family: 'Inter', sans-serif; font-size: 12.5px; font-weight: 600; cursor: pointer; background: var(--surface); color: ${G.muted}; transition: all 0.13s; }
    .btn-outline:hover:not(:disabled) { background: ${G.hover}; color: ${G.ink}; border-color: ${G.meadowBorder}; }
    .btn-outline:disabled { opacity: .6; cursor: default; }

    .btn-primary { display: inline-flex; align-items: center; gap: 6px; padding: 8px 20px; border-radius: 8px; border: none; fontFamily: 'Inter',sans-serif; fontSize: 12.5px; font-weight: 600; cursor: pointer; transition: all .15s; background: linear-gradient(135deg,${G.meadow},${G.meadowDeep}); color: #fff; box-shadow: 0 3px 10px rgba(0,0,0,0.25); }
    .btn-primary:hover:not(:disabled) { box-shadow: 0 5px 14px rgba(0,0,0,0.35); transform: translateY(-1px); }
    .btn-primary:disabled { opacity: .6; cursor: default; transform: none; box-shadow: none; }
  `
  document.head.appendChild(s)
}

/* ─── Constants ───────────────────────────────────────────────────────────── */
const ALL_DAYS = ['Monday','Tuesday','Wednesday','Thursday','Friday','Saturday','Sunday']

/* ─── Helpers ─────────────────────────────────────────────────────────────── */
function fmt12(h) {
  if (h === 0)  return '12:00 AM'
  if (h < 12)   return `${h}:00 AM`
  if (h === 12) return '12:00 PM'
  return `${h - 12}:00 PM`
}

function useToast() {
  const [toasts, setToasts] = useState([])
  const toast = useCallback((message, type = 'info', duration = 3000) => {
    const id = Date.now() + Math.random()
    setToasts(prev => [...prev, { id, message, type }])
    setTimeout(() => setToasts(prev => prev.filter(t => t.id !== id)), duration)
  }, [])
  return { toasts, toast }
}

async function parseErrorMessage(err) {
  let message = 'An unexpected error occurred. Please try again.'
  if (err instanceof Response || err?.status) {
    try {
      const body = await (err.json?.() ?? Promise.resolve(null))
      if (body?.detail) message = body.detail
      else if (body?.message) message = body.message
    } catch { /* ignore */ }
  } else if (err instanceof Error && err.message) {
    message = err.message
  }
  return message
}

function Skel({ w = '100%', h = 14, r = 6, style = {} }) {
  return <div className="stg-skeleton" style={{ width: w, height: h, borderRadius: r, ...style }} />
}

function ToastContainer({ toasts }) {
  const icons = {
    success: <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"><polyline points="20 6 9 17 4 12"/></svg>,
    error:   <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"><circle cx="12" cy="12" r="10"/><line x1="12" y1="8" x2="12" y2="12"/></svg>,
  }
  return (
    <div className="cp-toast-wrap">
      {toasts.map(t => <div key={t.id} className={`cp-toast ${t.type}`}>{icons[t.type]}{t.message}</div>)}
    </div>
  )
}

import { useTour } from '../../hooks/useTour.jsx'

const TOUR_SEEN_KEY = 'adminSettings_tourSeen'
function isOnboardingCompleted() {
  try { return localStorage.getItem(TOUR_SEEN_KEY) === '1' } catch { return true }
}
function markOnboardingCompleted() {
  try { localStorage.setItem(TOUR_SEEN_KEY, '1') } catch {}
}

/* ─── Main Page ───────────────────────────────────────────────────────────── */
export default function SettingsPage() {
  const { toasts, toast } = useToast()

  const [activeTheme, setActiveTheme] = useState('default')
  const [isDarkMode, setIsDarkMode] = useState(false)

  const availableThemes = [
    { id: 'default', name: 'Meadow Green', color: '#15803D' },
    { id: 'blue', name: 'Ocean Blue', color: '#2563EB' },
    { id: 'purple', name: 'Royal Purple', color: '#9333EA' },
    { id: 'rose', name: 'Rose Red', color: '#E11D48' },
    { id: 'amber', name: 'Sunset Amber', color: '#D97706' },
    { id: 'slate', name: 'Slate Gray', color: '#475569' },
    { id: 'teal', name: 'Teal', color: '#0D9488' },
    { id: 'indigo', name: 'Indigo', color: '#4F46E5' },
    { id: 'crimson', name: 'Crimson', color: '#DC2626' }
  ]

  useEffect(() => {
    const root = document.documentElement
    const theme = root.getAttribute('data-theme') || 'default'
    setActiveTheme(theme)
    setIsDarkMode(root.getAttribute('data-mode') === 'dark')
  }, [])

  const handleModeChange = (dark) => {
    setIsDarkMode(dark)
    const root = document.documentElement
    if (dark) {
      root.setAttribute('data-mode', 'dark')
      localStorage.setItem('agy-mode', 'dark')
    } else {
      root.removeAttribute('data-mode')
      localStorage.setItem('agy-mode', 'light')
    }
  }

  const handleThemeChange = (t) => {
    setActiveTheme(t)
    localStorage.setItem('agy-theme', t)
    if (t === 'default') document.documentElement.removeAttribute('data-theme')
    else document.documentElement.setAttribute('data-theme', t)
    toast('Theme updated!', 'success')
  }


  const { TourElement, startTour } = useTour('adminSettings', [
    {
      target: '#tour-stg-days .day-row',
      title: 'Active Operational Days',
      content: 'Toggle which days classes can be scheduled on. At least one day must stay active — the scheduler only places sections on the days selected here.',
      disableBeacon: true,
    },
    {
      target: '#tour-stg-time .cp-sel',
      title: 'Daily Time Boundaries',
      content: 'Set the earliest opening and latest closing time for the day. Everything in between gets split into 30-minute slots the scheduler can assign.',
    },
  ])

  

  /* Current State */
  const [days, setDays] = useState(['Monday','Tuesday','Wednesday','Thursday','Friday'])
  const [startHour, setStartHour] = useState(7)
  const [endHour, setEndHour] = useState(21)

  /* Original State (for Dirty Checking) */
  const [originalDays, setOriginalDays] = useState([])
  const [originalStart, setOriginalStart] = useState(7)
  const [originalEnd, setOriginalEnd] = useState(21)

  const [loading, setLoading] = useState(true)
  const [savingDays, setSavingDays] = useState(false)
  const [savingTime, setSavingTime] = useState(false)

  useEffect(() => {
    Promise.all([
      getDays().catch(() => null),
      getTime().catch(() => null),
    ]).then(([d, t]) => {
      if (Array.isArray(d?.days)) {
        setDays(d.days)
        setOriginalDays(d.days)
      }
      if (t?.start_time != null) {
        setStartHour(t.start_time)
        setOriginalStart(t.start_time)
      }
      if (t?.end_time != null) {
        setEndHour(t.end_time)
        setOriginalEnd(t.end_time)
      }
    }).finally(() => setLoading(false))
  }, [])

  function toggleDay(day) {
    setDays(prev => {
      const updated = prev.includes(day)
        ? prev.filter(d => d !== day)
        : [...prev, day]
      return updated.sort((a, b) => ALL_DAYS.indexOf(a) - ALL_DAYS.indexOf(b))
    })
  }

  /* Compute Dirty States Independently */
  const daysChanged = useMemo(() => days.join(',') !== originalDays.join(','), [days, originalDays])
  const timeChanged = useMemo(() => startHour !== originalStart || endHour !== originalEnd, [startHour, originalStart, endHour, originalEnd])

  /* Handlers for Days */
  function discardDays() {
    setDays([...originalDays])
  }

  async function handleSaveDays() {
    setSavingDays(true)
    try {
      await saveDays({ days })
      setOriginalDays([...days])
      toast('Operational days saved successfully', 'success')
    } catch (err) {
      const msg = await parseErrorMessage(err)
      toast(`Failed to save days: ${msg}`, 'error')
    } finally {
      setSavingDays(false)
    }
  }

  /* Handlers for Time */
  function discardTime() {
    setStartHour(originalStart)
    setEndHour(originalEnd)
  }

  async function handleSaveTime() {
    setSavingTime(true)
    try {
      await saveTime({ start_time: startHour, end_time: endHour })
      setOriginalStart(startHour)
      setOriginalEnd(endHour)
      toast('Time boundaries saved successfully', 'success')
    } catch (err) {
      const msg = await parseErrorMessage(err)
      toast(`Failed to save time boundaries: ${msg}`, 'error')
    } finally {
      setSavingTime(false)
    }
  }

  const hourOptions = Array.from({ length: 24 }, (_, i) => i)
  const hourSpan    = endHour - startHour
  const totalSlots  = hourSpan * 2

  return (
    <div className="page" style={{ padding: '28px 32px', background: G.bg, minHeight: '100%', fontFamily: "'Inter', sans-serif", display: 'flex', flexDirection: 'column' }}>
      {TourElement}
      <div style={{ flex: 1 }}>
        
        {/* ═══════════════════════════════════════════
            Card 1 — Active Days 
        ═══════════════════════════════════════════ */}
        <div id="tour-stg-days" className="stg-card">
          <div className="stg-card-head">
            <div className="stg-icon-box" style={{ background: G.meadowSoft, border: `1px solid ${G.meadowBorder}` }}>
              <img src={iconDays} alt="Days" />
            </div>
            <div style={{ flex: 1, minWidth: '200px' }}>
              <div style={{ fontSize: 16, fontWeight: 800, color: G.ink }}>Active Operational Days</div>
              <div style={{ fontSize: 12.5, color: G.muted }}>Select the specific days classes are allowed to be scheduled</div>
            </div>

            {/* Header Save Bar Logic for Days */}
            {!loading && daysChanged && (
              <div style={{ display: 'flex', alignItems: 'center', gap: '16px', background: '#FFFBEB', padding: '8px 16px', borderRadius: '10px', border: '1px solid #FDE68A', animation: 'fadeIn 0.2s ease-out' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                  <div style={{ width: 24, height: 24, borderRadius: 6, background: '#FEF3C7', display: 'flex', alignItems: 'center', justifyContent: 'center', border: '1px solid #FCD34D' }}>
                    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="#D97706" strokeWidth="2.5"><circle cx="12" cy="12" r="10"/><line x1="12" y1="8" x2="12" y2="12"/><line x1="12" y1="16" x2="12.01" y2="16"/></svg>
                  </div>
                  <span style={{ fontSize: 13, color: G.ink, fontWeight: 600, fontFamily: "'Inter', sans-serif" }}>
                    <strong style={{ color: '#D97706' }}>Unsaved</strong> days changes
                  </span>
                </div>
                <div style={{ display: 'flex', gap: 8 }}>
                  <button className="btn-outline" onClick={discardDays} disabled={savingDays} style={{ padding: '6px 12px' }}>Discard</button>
                  <button className="btn-primary" onClick={handleSaveDays} disabled={savingDays || days.length === 0} style={{ padding: '6px 12px' }}>
                    {savingDays ? (
                      <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" style={{ animation:'spin-r .8s linear infinite' }}><path d="M21 12a9 9 0 1 1-6.219-8.56"/></svg>
                    ) : (
                      <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"><path d="M19 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h11l5 5v11a2 2 0 0 1-2 2z"/><polyline points="17 21 17 13 7 13 7 21"/><polyline points="7 3 7 8 15 8"/></svg>
                    )}
                    Save Changes
                  </button>
                </div>
              </div>
            )}
          </div>

          <div className="stg-card-body">
            {!loading && days.length === 0 && (
              <div style={{ fontSize: 12, fontWeight: 600, color: '#DC2626', marginBottom: 14, display: 'flex', alignItems: 'center', gap: 6 }}>
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"><circle cx="12" cy="12" r="10"/><line x1="12" y1="8" x2="12" y2="12"/><line x1="12" y1="16" x2="12.01" y2="16"/></svg>
                At least one operational day is required
              </div>
            )}
            
            <div className="day-row">
              {loading
                ? Array.from({ length: 7 }).map((_, i) => <Skel key={i} w="100%" h={58} r={8} style={{ flex: 1, minWidth: 90 }} />)
                : ALL_DAYS.map(day => {
                    const isActive = days.includes(day)
                    return (
                      <button
                        key={day}
                        className={`day-btn ${isActive ? 'active' : ''}`}
                        onClick={() => toggleDay(day)}
                      >
                        <span className="day-btn-title">{day.slice(0, 3)}</span>
                        <span className="day-btn-sub">{day}</span>
                      </button>
                    )
                  })
              }
            </div>
          </div>
        </div>

        {/* ═══════════════════════════════════════════
            Card 2 — Time Window 
        ═══════════════════════════════════════════ */}
        <div id="tour-stg-time" className="stg-card">
          <div className="stg-card-head">
            <div className="stg-icon-box" style={{ background: G.hover, border: `1px solid ${G.border}` }}>
              <img src={iconTime} alt="Time" />
            </div>
            <div style={{ flex: 1, minWidth: '200px' }}>
              <div style={{ fontSize: 16, fontWeight: 800, color: G.ink }}>Daily Time Boundaries</div>
              <div style={{ fontSize: 12.5, color: G.muted }}>Set the earliest start time and latest end time for classes</div>
            </div>

            {/* Header Save Bar Logic for Time */}
            {!loading && timeChanged && (
              <div style={{ display: 'flex', alignItems: 'center', gap: '16px', background: '#FFFBEB', padding: '8px 16px', borderRadius: '10px', border: '1px solid #FDE68A', animation: 'fadeIn 0.2s ease-out' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                  <div style={{ width: 24, height: 24, borderRadius: 6, background: '#FEF3C7', display: 'flex', alignItems: 'center', justifyContent: 'center', border: '1px solid #FCD34D' }}>
                    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="#D97706" strokeWidth="2.5"><circle cx="12" cy="12" r="10"/><line x1="12" y1="8" x2="12" y2="12"/><line x1="12" y1="16" x2="12.01" y2="16"/></svg>
                  </div>
                  <span style={{ fontSize: 13, color: G.ink, fontWeight: 600, fontFamily: "'Inter', sans-serif" }}>
                    <strong style={{ color: '#D97706' }}>Unsaved</strong> time boundaries
                  </span>
                </div>
                <div style={{ display: 'flex', gap: 8 }}>
                  <button className="btn-outline" onClick={discardTime} disabled={savingTime} style={{ padding: '6px 12px' }}>Discard</button>
                  <button className="btn-primary" onClick={handleSaveTime} disabled={savingTime} style={{ padding: '6px 12px' }}>
                    {savingTime ? (
                      <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" style={{ animation:'spin-r .8s linear infinite' }}><path d="M21 12a9 9 0 1 1-6.219-8.56"/></svg>
                    ) : (
                      <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"><path d="M19 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h11l5 5v11a2 2 0 0 1-2 2z"/><polyline points="17 21 17 13 7 13 7 21"/><polyline points="7 3 7 8 15 8"/></svg>
                    )}
                    Save Changes
                  </button>
                </div>
              </div>
            )}
          </div>

          <div className="stg-card-body">
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: 20 }}>
              
              {/* Start Time Select */}
              <div>
                <label style={{ display: 'block', fontSize: 11.5, fontWeight: 600, color: G.ink, marginBottom: 6 }}>Opening Time</label>
                {loading ? <Skel w="100%" h={36} r={10} /> : (
                  <select className="cp-sel" value={startHour} onChange={e => setStartHour(parseInt(e.target.value))}>
                    {hourOptions.filter(h => h < endHour).map(h => (
                      <option key={h} value={h}>{fmt12(h)}</option>
                    ))}
                  </select>
                )}
              </div>

              {/* End Time Select */}
              <div>
                <label style={{ display: 'block', fontSize: 11.5, fontWeight: 600, color: G.ink, marginBottom: 6 }}>Closing Time</label>
                {loading ? <Skel w="100%" h={36} r={10} /> : (
                  <select className="cp-sel" value={endHour} onChange={e => setEndHour(parseInt(e.target.value))}>
                    {hourOptions.filter(h => h > startHour).map(h => (
                      <option key={h} value={h}>{fmt12(h)}</option>
                    ))}
                  </select>
                )}
              </div>
            </div>

            <div style={{ marginTop: 24, padding: '12px 16px', borderRadius: 8, background: 'var(--bg)', border: `1px solid ${G.borderLight}`, display: 'flex', alignItems: 'center', gap: 10 }}>
              <div style={{ width: 6, height: 6, borderRadius: '50%', background: G.meadow, flexShrink: 0 }} />
              {loading ? <Skel w={280} h={12} /> : (
                <div style={{ fontSize: 12, color: G.muted }}>
                  Classes will be scheduled between <strong style={{ color: G.ink }}>{fmt12(startHour)}</strong> and <strong style={{ color: G.ink }}>{fmt12(endHour)}</strong>. 
                  <span style={{ marginLeft: 6 }}>
                    This provides a <strong style={{ color: G.ink }}>{hourSpan}-hour</strong> window, resulting in <strong style={{ color: G.ink }}>{totalSlots}</strong> standard 30-minute slots per day.
                  </span>
                </div>
              )}
            </div>

        {/* Card 3 - Color Theme */}
        <div className="stg-card">
          <div className="stg-card-head">
            <div className="stg-icon-box" style={{ background: G.meadowSoft, border: `1px solid ${G.meadowBorder}` }}>
              <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke={G.meadow} strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><circle cx="13.5" cy="6.5" r=".5"/><circle cx="17.5" cy="10.5" r=".5"/><circle cx="8.5" cy="7.5" r=".5"/><circle cx="6.5" cy="12.5" r=".5"/><path d="M12 2C6.5 2 2 6.5 2 12s4.5 10 10 10c.926 0 1.648-.746 1.648-1.688 0-.437-.18-.835-.437-1.125-.29-.289-.438-.652-.438-1.125a1.64 1.64 0 0 1 1.668-1.668h1.996c3.051 0 5.555-2.503 5.555-5.554C21.965 6.012 17.461 2 12 2z"/></svg>
            </div>
            <div style={{ flex: 1, minWidth: '200px' }}>
              <div style={{ fontSize: 16, fontWeight: 800, color: G.ink }}>Color Theme</div>
              <div style={{ fontSize: 12.5, color: G.muted }}>Personalize the appearance of the application</div>
            </div>
          </div>
          <div className="stg-card-body">
            <div style={{ display: 'flex', gap: 12, flexWrap: 'wrap' }}>
              {availableThemes.map(t => (
                <button
                  key={t.id}
                  onClick={() => handleThemeChange(t.id)}
                  style={{
                    display: 'flex', alignItems: 'center', gap: 8, padding: '10px 16px',
                    borderRadius: 10, background: activeTheme === t.id ? G.hover : 'var(--surface)',
                    border: `1px solid ${activeTheme === t.id ? 'var(--meadow-border)' : 'var(--border)'}`,
                    cursor: 'pointer', transition: 'all 0.15s',
                    boxShadow: activeTheme === t.id ? `0 2px 8px ${t.color}33` : 'none'
                  }}
                >
                  <div style={{ width: 18, height: 18, borderRadius: '50%', background: t.color, border: '2px solid var(--surface)', boxShadow: '0 0 0 1px rgba(0,0,0,0.1)' }} />
                  <span style={{ fontSize: 13, fontWeight: activeTheme === t.id ? 700 : 500, color: activeTheme === t.id ? G.meadow : G.muted }}>
                    {t.name}
                  </span>
                </button>
              ))}
            </div>
            <div style={{ marginTop: 24, padding: '12px 16px', borderRadius: 8, background: G.bg, border: '1px solid var(--border-light)', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
                <div style={{ width: 36, height: 36, borderRadius: '50%', background: G.meadowSoft, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                  {isDarkMode ? (
                    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke={G.meadow} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M12 3a6 6 0 0 0 9 9 9 9 0 1 1-9-9Z"/></svg>
                  ) : (
                    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke={G.meadow} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><circle cx="12" cy="12" r="4"/><path d="M12 2v2"/><path d="M12 20v2"/><path d="m4.93 4.93 1.41 1.41"/><path d="m17.66 17.66 1.41 1.41"/><path d="M2 12h2"/><path d="M20 12h2"/><path d="m6.34 17.66-1.41 1.41"/><path d="m19.07 4.93-1.41 1.41"/></svg>
                  )}
                </div>
                <div>
                  <div style={{ fontSize: 13.5, fontWeight: 700, color: G.ink }}>Dark Mode</div>
                  <div style={{ fontSize: 11.5, color: G.muted }}>Switch to a darker appearance</div>
                </div>
              </div>
              <button
                type="button"
                onClick={() => handleModeChange(!isDarkMode)}
                style={{
                  width: 44, height: 24, borderRadius: 12, border: 'none', cursor: 'pointer',
                  background: isDarkMode ? G.meadow : '#CBD5E1', position: 'relative',
                  transition: 'background 0.2s'
                }}
              >
                <div style={{
                  width: 20, height: 20, borderRadius: '50%', background: 'var(--surface, #fff)',
                  position: 'absolute', top: 2, left: isDarkMode ? 22 : 2,
                  transition: 'left 0.2s, transform 0.2s', boxShadow: '0 1px 3px rgba(0,0,0,0.2)'
                }} />
              </button>
            </div>
          </div>
        </div>

                </div>
        </div>
      </div>

      {/* Floating Toast Notifications */}
      <ToastContainer toasts={toasts} />
    </div>
  )
}