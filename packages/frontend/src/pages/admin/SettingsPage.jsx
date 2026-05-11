import { useEffect, useState } from 'react'
import { getDays, saveDays, getTime, saveTime } from '../../services/api'

/* ─── styles ─────────────────────────────────────────────────────────────── */
if (!document.getElementById('settings-page-style')) {
  const s = document.createElement('style')
  s.id = 'settings-page-style'
  s.textContent = `
    .stg-card {
      background: #fff; border-radius: 14px;
      border: 1px solid #E8E4F8;
      box-shadow: 0 2px 10px rgba(124,111,205,0.07);
      overflow: hidden; margin-bottom: 16px;
      animation: stgFade 0.2s ease both;
    }
    .stg-card:nth-child(2) { animation-delay:.05s }

    .stg-head {
      display: flex; align-items: center; gap: 12px;
      padding: 14px 20px; border-bottom: 1px solid #F0EDF9;
    }
    .stg-head-icon {
      width: 34px; height: 34px; border-radius: 10px;
      display: flex; align-items: center; justify-content: center; flex-shrink: 0;
    }
    .stg-row {
      display: flex; align-items: center; justify-content: space-between;
      padding: 13px 20px; border-bottom: 1px solid #F5F4FB; gap: 20px;
    }
    .stg-row:last-child { border-bottom: none; }
    .stg-lbl  { font-size: 13px; font-weight: 500; color: #1a1a2e; }
    .stg-hint { font-size: 11.5px; color: #8883B0; margin-top: 2px; }

    /* day pills */
    .day-pill {
      padding: 5px 12px; border-radius: 8px; font-size: 12px; font-weight: 600;
      border: 1.5px solid #E8E4F8; cursor: pointer; background: #fff;
      color: #8883B0; transition: all 0.13s; user-select: none;
      font-family: 'Poppins', sans-serif;
    }
    .day-pill.on { background: #EDE9FB; color: #7C6FCD; border-color: #C5BBEF; }
    .day-pill:hover:not(.on) { background: #F5F4FB; border-color: #D8D3F5; color: #5a4fbf; }

    /* hour select */
    .hour-select {
      padding: 7px 28px 7px 11px; border-radius: 9px;
      border: 1.5px solid #E8E4F8; font-family: 'Poppins', sans-serif;
      font-size: 13px; color: #1a1a2e; background: #fff; width: 150px;
      outline: none; cursor: pointer; transition: border-color 0.15s;
      appearance: none;
      background-image: url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='11' height='11' viewBox='0 0 24 24' fill='none' stroke='%238883B0' stroke-width='2.5'%3E%3Cpolyline points='6 9 12 15 18 9'/%3E%3C/svg%3E");
      background-repeat: no-repeat; background-position: right 9px center;
    }
    .hour-select:focus { border-color: #A99BE8; box-shadow: 0 0 0 3px rgba(169,155,232,0.12); }

    /* section save btn */
    .sec-save-btn {
      display: flex; align-items: center; gap: 6px;
      padding: 7px 14px; border-radius: 8px;
      border: 1.5px solid #E8E4F8; font-family: 'Poppins', sans-serif;
      font-size: 12px; font-weight: 600; cursor: pointer;
      background: #fff; color: #7C6FCD;
      transition: all 0.13s; flex-shrink: 0;
    }
    .sec-save-btn:hover:not(:disabled) { background: #EEEAFB; border-color: #C5BBEF; }
    .sec-save-btn.saved { background: #E6FAF3; color: #059669; border-color: #A7F3D0; }
    .sec-save-btn:disabled { opacity: .65; cursor: default; }

    @keyframes stgFade {
      from { opacity:0; transform:translateY(5px); }
      to   { opacity:1; transform:translateY(0); }
    }
    @keyframes spin-stg { to { transform:rotate(360deg); } }

    /* Skeleton Animations */
    @keyframes stgShimmer {
      0%   { background-position: -400px 0 }
      100% { background-position:  400px 0 }
    }
    .stg-skeleton {
      background: linear-gradient(90deg, #F0EDF9 25%, #E4DEFC 50%, #F0EDF9 75%);
      background-size: 800px 100%;
      animation: stgShimmer 1.4s ease-in-out infinite;
      border-radius: 7px;
    }
  `
  document.head.appendChild(s)
}

/* ─── helpers ─────────────────────────────────────────────────────────────── */

/** Extract a structured error object from any thrown value.
 *  `action` = short verb phrase, e.g. "save active days" or "load rooms"
 */
async function parseError(err, action) {
  let title   = `Failed to ${action}`
  let message = 'An unexpected error occurred. Please try again.'
  let code    = null

  if (err instanceof Response || err?.status) {
    code = err.status ?? null

    // Title describes the cause
    const causeMap = {
      400: `Failed to ${action} — invalid data sent`,
      401: `Failed to ${action} — not authenticated`,
      403: `Failed to ${action} — access denied`,
      404: `Failed to ${action} — endpoint not found`,
      408: `Failed to ${action} — request timed out`,
      409: `Failed to ${action} — data conflict`,
      422: `Failed to ${action} — validation rejected`,
      429: `Failed to ${action} — too many requests`,
      500: `Failed to ${action} — backend error`,
      502: `Failed to ${action} — bad gateway`,
      503: `Failed to ${action} — server unavailable`,
      504: `Failed to ${action} — gateway timeout`,
    }
    title = causeMap[code] ?? `Failed to ${action} — server error (${code})`

    // Message gives the detail
    const detailMap = {
      400: 'The data submitted was rejected as invalid. Check your inputs and try again.',
      401: 'Your session may have expired. Please refresh the page and log in again.',
      403: 'You don\'t have the required permissions to perform this action.',
      404: 'The server endpoint could not be found. The API may have changed.',
      408: 'The server took too long to respond. Check your connection and retry.',
      409: 'This change conflicts with existing data on the server.',
      422: 'The server could not process the submitted values. Check for invalid fields.',
      429: 'You\'ve sent too many requests. Wait a moment, then try again.',
      500: 'An internal server error occurred on the backend. Try again shortly.',
      502: 'The server returned an invalid response. The service may be restarting.',
      503: 'The server is temporarily unavailable. Try again in a few moments.',
      504: 'The gateway did not receive a timely response from the backend.',
    }
    message = detailMap[code] ?? `The server responded with an unexpected status (${code}).`

    // Override with actual server-provided message if available
    try {
      const body = await (err.json?.() ?? Promise.resolve(null))
      if (body?.detail)                            message = body.detail
      else if (body?.message)                      message = body.message
      else if (typeof body === 'string' && body.length < 200) message = body
    } catch { /* ignore parse errors */ }

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
    <div style={{
      display: 'flex', alignItems: 'flex-start', gap: 10, marginBottom: 14,
      padding: '11px 14px', borderRadius: 10,
      background: '#FFF5F5', border: '1px solid #FECACA',
      animation: 'stgFade 0.18s ease',
    }}>
      <div style={{
        width: 28, height: 28, borderRadius: 8, background: '#FEE2E2',
        display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0, marginTop: 1,
      }}>
        <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="#DC2626" strokeWidth="2.2">
          <circle cx="12" cy="12" r="10"/>
          <line x1="12" y1="8" x2="12" y2="12"/><line x1="12" y1="16" x2="12.01" y2="16"/>
        </svg>
      </div>
      <div style={{ flex: 1, minWidth: 0 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 7, marginBottom: 3 }}>
          <span style={{ fontSize: 12.5, fontWeight: 700, color: '#B91C1C' }}>{error.title}</span>
          {error.code && (
            <span style={{
              fontSize: 10, fontWeight: 700, padding: '1px 6px', borderRadius: 20,
              background: '#FEE2E2', color: '#DC2626', border: '1px solid #FECACA',
            }}>
              {error.code}
            </span>
          )}
        </div>
        <div style={{ fontSize: 12, color: '#C0392B', lineHeight: 1.5 }}>{error.message}</div>
      </div>
      {onDismiss && (
        <button onClick={onDismiss} style={{
          background: 'none', border: 'none', cursor: 'pointer',
          color: '#EF9999', padding: 2, flexShrink: 0, lineHeight: 0,
          borderRadius: 4, transition: 'color 0.13s',
        }}
          onMouseEnter={e => e.currentTarget.style.color = '#DC2626'}
          onMouseLeave={e => e.currentTarget.style.color = '#EF9999'}
          title="Dismiss"
        >
          <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
            <line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/>
          </svg>
        </button>
      )}
    </div>
  )
}

function Skel({ w = '100%', h = 14, r = 7, style = {} }) {
  return (
    <div className="stg-skeleton" style={{ width: w, height: h, borderRadius: r, flexShrink: 0, ...style }} />
  )
}

const ALL_DAYS = ['Monday','Tuesday','Wednesday','Thursday','Friday','Saturday','Sunday']

function fmt12(h) {
  if (h === 0)  return '12:00 AM'
  if (h < 12)   return `${h}:00 AM`
  if (h === 12) return '12:00 PM'
  return `${h - 12}:00 PM`
}

function Toggle({ checked, onChange }) {
  return (
    <label className="stg-toggle">
      <input type="checkbox" checked={checked} onChange={e => onChange(e.target.checked)} />
      <span className="stg-track" />
    </label>
  )
}

/* compact save button with spinner / check */
function SaveBtn({ saving, saved, onClick, label }) {
  return (
    <button
      className={`sec-save-btn${saved ? ' saved' : ''}`}
      onClick={onClick} disabled={saving}
    >
      {saving ? (
        <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"
          style={{ animation:'spin-stg .8s linear infinite' }}>
          <path d="M21 12a9 9 0 1 1-6.219-8.56"/>
        </svg>
      ) : saved ? (
        <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
          <polyline points="20 6 9 17 4 12"/>
        </svg>
      ) : (
        <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
          <path d="M19 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h11l5 5v11a2 2 0 0 1-2 2z"/>
          <polyline points="17 21 17 13 7 13 7 21"/>
          <polyline points="7 3 7 8 15 8"/>
        </svg>
      )}
      {saving ? 'Saving…' : saved ? 'Saved!' : label}
    </button>
  )
}

function SectionHead({ iconBg, iconColor, iconPath, title, desc, saveBtn }) {
  return (
    <div className="stg-head">
      <div className="stg-head-icon" style={{ background: iconBg }}>
        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke={iconColor} strokeWidth="2">
          {iconPath}
        </svg>
      </div>
      <div style={{ flex: 1 }}>
        <div style={{ fontSize: 13, fontWeight: 700, color: '#1a1a2e' }}>{title}</div>
        <div style={{ fontSize: 11.5, color: '#8883B0', marginTop: 1 }}>{desc}</div>
      </div>
      {saveBtn}
    </div>
  )
}

function Row({ label, hint, children }) {
  return (
    <div className="stg-row">
      <div style={{ flex: 1 }}>
        <div className="stg-lbl">{label}</div>
        {hint && <div className="stg-hint">{hint}</div>}
      </div>
      <div style={{ flexShrink: 0 }}>{children}</div>
    </div>
  )
}

export default function SettingsPage() {
  /* days */
  const [days,       setDays]       = useState(['Monday','Tuesday','Wednesday','Thursday','Friday'])
  const [savingDays, setSavingDays] = useState(false)
  const [savedDays,  setSavedDays]  = useState(false)

  /* time — backend: { start_time: 7, end_time: 21 } (integer hours) */
  const [startHour,   setStartHour]  = useState(7)
  const [endHour,     setEndHour]    = useState(21)
  const [savingTime,  setSavingTime] = useState(false)
  const [savedTime,   setSavedTime]  = useState(false)

  const [loading, setLoading] = useState(true)
  const [error,   setError]   = useState(null)

  useEffect(() => {
    Promise.all([
      getDays().catch(() => null),
      getTime().catch(() => null),
    ]).then(([d, t]) => {
      if (Array.isArray(d?.days)) setDays(d.days)
      if (t?.start_time != null) setStartHour(t.start_time)
      if (t?.end_time   != null) setEndHour(t.end_time)
    }).finally(() => setLoading(false))
  }, [])

  function toggleDay(day) {
    setDays(prev => {
      
      const updatedDays = prev.includes(day) 
        ? prev.filter(d => d !== day) 
        : [...prev, day];
        
      
      return updatedDays.sort((a, b) => ALL_DAYS.indexOf(a) - ALL_DAYS.indexOf(b));
    });
    
    setSavedDays(false);
  }

  async function handleSaveDays() {
    setSavingDays(true); setError(null)
    try {
      await saveDays({ days })
      setSavedDays(true); setTimeout(() => setSavedDays(false), 2500)
    } catch (err) { setError(await parseError(err, 'save active days')) }
    finally { setSavingDays(false) }
  }

  async function handleSaveTime() {
    setSavingTime(true); setError(null)
    try {
      await saveTime({ start_time: startHour, end_time: endHour })
      setSavedTime(true); setTimeout(() => setSavedTime(false), 2500)
    } catch (err) { setError(await parseError(err, 'save time window')) }
    finally { setSavingTime(false) }
  }

  const hourOptions = Array.from({ length: 24 }, (_, i) => i)

  return (
    <div className="page">

      {error && (
        <ErrorBanner error={error} onDismiss={() => setError(null)} />
      )}

      {/* ── 1. Active Days ── */}
      <div className="stg-card">
        <SectionHead
          iconBg="#E6FAF3" iconColor="#059669" title="Active Days"
          desc="Days when classes can be scheduled"
          iconPath={<><rect x="3" y="4" width="18" height="18" rx="2"/><line x1="16" y1="2" x2="16" y2="6"/><line x1="8" y1="2" x2="8" y2="6"/><line x1="3" y1="10" x2="21" y2="10"/></>}
          saveBtn={
            loading ? <Skel w={100} h={32} r={8} /> : 
            <SaveBtn saving={savingDays} saved={savedDays} onClick={handleSaveDays} label="Save Days" />
          }
        />

        <div className="stg-row" style={{ flexWrap: 'wrap', gap: 12 }}>
          <div>
            <div className="stg-lbl">School Days</div>
            <div className="stg-hint">
              {loading ? (
                <Skel w={180} h={12} style={{ marginTop: 4 }} />
              ) : days.length === 0 ? (
                'No days selected'
              ) : (
                `${days.length} day${days.length !== 1 ? 's' : ''} — ${days.join(', ')}`
              )}
            </div>
          </div>
          <div style={{ display: 'flex', gap: 5, flexWrap: 'wrap', justifyContent: 'flex-end' }}>
            {loading 
              ? Array.from({ length: 5 }).map((_, i) => <Skel key={i} w={46} h={28} r={8} />)
              : ALL_DAYS.map(d => (
                  <button
                    key={d} className={`day-pill${days.includes(d) ? ' on' : ''}`}
                    onClick={() => toggleDay(d)}
                  >
                    {d.slice(0, 3)}
                  </button>
                ))
            }
          </div>
        </div>
      </div>

      {/* ── 2. Time Window ── */}
      <div className="stg-card">
        <SectionHead
          iconBg="#EDE9FB" iconColor="#7C6FCD" title="Time Window"
          desc={loading ? <Skel w={220} h={12} style={{ marginTop: 4 }} /> : `Classes scheduled between ${fmt12(startHour)} and ${fmt12(endHour)}`}
          iconPath={<><circle cx="12" cy="12" r="10"/><polyline points="12 6 12 12 16 14"/></>}
          saveBtn={
            loading ? <Skel w={100} h={32} r={8} /> : 
            <SaveBtn saving={savingTime} saved={savedTime} onClick={handleSaveTime} label="Save Time" />
          }
        />

        <Row label="Start Time" hint="Earliest a class can begin">
          {loading ? (
            <Skel w={150} h={30} r={9} />
          ) : (
            <select className="hour-select" value={startHour}
              onChange={e => { setStartHour(parseInt(e.target.value)); setSavedTime(false) }}>
              {hourOptions.filter(h => h < endHour).map(h => (
                <option key={h} value={h}>{fmt12(h)}</option>
              ))}
            </select>
          )}
        </Row>

        <Row label="End Time" hint="Latest a class can end">
          {loading ? (
            <Skel w={150} h={30} r={9} />
          ) : (
            <select className="hour-select" value={endHour}
              onChange={e => { setEndHour(parseInt(e.target.value)); setSavedTime(false) }}>
              {hourOptions.filter(h => h > startHour).map(h => (
                <option key={h} value={h}>{fmt12(h)}</option>
              ))}
            </select>
          )}
        </Row>

        <div style={{ padding: '10px 20px', background: '#FAFAFE', borderTop: '1px solid #F5F4FB' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            <div style={{ width: 6, height: 6, borderRadius: '50%', background: '#A99BE8', flexShrink: 0 }} />
            {loading ? (
              <Skel w={250} h={12} />
            ) : (
              <span style={{ fontSize: 12, color: '#8883B0' }}>
                {endHour - startHour} hour window ·{' '}
                {(endHour - startHour) * 2} × 30-min slots available per day
              </span>
            )}
          </div>
        </div>
      </div>
    </div>
  )
}