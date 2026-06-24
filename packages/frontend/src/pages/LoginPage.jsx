import { useState, useEffect, useRef } from 'react'
import { signInWithEmailAndPassword } from 'firebase/auth'
import { auth } from '../services/firebase'
import { useNavigate } from 'react-router-dom'
import logoImg  from '../assets/ASSIGNAV2.png'
import icon1Img from '../assets/ASSIGNAV1.png'

/* ─── styles ────────────────────────────────────────────────────────────────── */
if (!document.getElementById('login-page-style')) {
  const s = document.createElement('style')
  s.id = 'login-page-style'
  s.textContent = `
    @import url('https://fonts.googleapis.com/css2?family=Sora:wght@600;700;800&family=Inter:wght@400;500;600;700&display=swap');
    *, *::before, *::after { box-sizing: border-box; margin: 0; padding: 0; }

    .login-root {
      --forest:      #0A2E1C;
      --meadow:      #15803D;
      --meadow-deep: #0F5C2C;
      --mint:        #6EE7B7;
      --ink:         #0E2A20;
      --mist:        #F3F8F4;
      --paper:       #FFFFFF;
      --line:        #DCE7DF;
      --slate:       #54655B;
      --slate-soft:  #8FA398;
      --danger:      #C0392B;
      --danger-bg:   #FDF1EF;
      --danger-line: #F3C8C0;
      min-height: 100vh; height: 100vh;
      display: flex; font-family: 'Inter', sans-serif;
      color: var(--ink); overflow: hidden;
    }

    /* ══ LEFT PANEL ══ */
    .login-panel {
      width: 480px; flex-shrink: 0;
      background: var(--forest);
      display: flex; flex-direction: column;
      position: relative; overflow: hidden;
    }
    @media (max-width: 900px) { .login-panel { display: none; } }

    .login-panel::before {
      content: '';
      position: absolute; inset: 0; z-index: 0;
      background-image:
        linear-gradient(rgba(110,231,183,0.035) 1px, transparent 1px),
        linear-gradient(90deg, rgba(110,231,183,0.035) 1px, transparent 1px);
      background-size: 40px 40px;
      pointer-events: none;
    }
    .login-panel::after {
      content: '';
      position: absolute; bottom: -100px; right: -100px;
      width: 400px; height: 400px;
      background: radial-gradient(ellipse, rgba(110,231,183,0.08) 0%, transparent 65%);
      pointer-events: none; z-index: 0;
    }

    .panel-inner {
      position: relative; z-index: 1;
      display: flex; flex-direction: column;
      height: 100%; padding: 36px 40px 32px;
    }

    .panel-brand {
      display: flex; align-items: center; gap: 11px;
      flex-shrink: 0; margin-bottom: 0;
    }
    .panel-brand img { width: 28px; height: 28px; object-fit: contain; }
    .panel-brand-name {
      font-family: 'Sora', sans-serif;
      font-size: 12.5px; font-weight: 800; color: #fff;
      letter-spacing: 2.4px; text-transform: uppercase; display: block;
    }
    .panel-brand-sub {
      font-size: 8px; font-weight: 500;
      color: rgba(255,255,255,0.38);
      letter-spacing: 1.4px; text-transform: uppercase; display: block; margin-top: 2px;
    }

    /* ── CAROUSEL ── */
    .panel-carousel {
      flex: 1; display: flex; flex-direction: column;
      padding-top: 32px; min-height: 0;
    }
    .carousel-track {
      flex: 1; position: relative; overflow: hidden; min-height: 0;
    }
    .carousel-slide {
      position: absolute; inset: 0;
      display: flex; flex-direction: column;
      opacity: 0; transform: translateX(32px);
      transition: opacity 0.5s cubic-bezier(.4,0,.2,1), transform 0.5s cubic-bezier(.4,0,.2,1);
      pointer-events: none;
    }
    .carousel-slide.s-active {
      opacity: 1; transform: translateX(0); pointer-events: auto;
    }
    .carousel-slide.s-exit {
      opacity: 0; transform: translateX(-32px);
    }

    /* text half */
    .slide-text { flex-shrink: 0; }
    .slide-heading {
      font-family: 'Sora', sans-serif;
      font-size: 30px; font-weight: 800; color: #fff;
      line-height: 1.14; letter-spacing: -.7px; margin-bottom: 12px;
    }
    .slide-heading em { font-style: normal; color: var(--mint); }
    .slide-sub {
      font-size: 13px; color: rgba(255,255,255,0.55);
      line-height: 1.7; max-width: 320px;
    }

    /* visual half */
    .slide-visual {
      flex: 1; min-height: 0;
      display: flex; align-items: center;
      padding: 24px 0 8px;
    }

    /* dots */
    .carousel-dots {
      display: flex; gap: 7px; align-items: center;
      padding-top: 20px; flex-shrink: 0;
    }
    .c-dot {
      width: 6px; height: 6px; border-radius: 99px;
      background: rgba(255,255,255,0.20);
      transition: all 0.3s ease; cursor: pointer; border: none;
    }
    .c-dot.active { width: 20px; background: var(--mint); }
    .c-dot:hover:not(.active) { background: rgba(255,255,255,0.42); }

    .panel-footer {
      padding-top: 20px; flex-shrink: 0;
      font-size: 9.5px; font-weight: 500;
      color: rgba(255,255,255,0.20); letter-spacing: .3px;
    }

    /* ═══════════════════════════════════
       VISUAL 1 — timetable grid
    ═══════════════════════════════════ */
    .vis-grid {
      width: 100%; background: rgba(255,255,255,0.04);
      border: 1px solid rgba(255,255,255,0.08);
      border-radius: 12px; overflow: hidden;
    }
    .vg-days {
      display: grid; grid-template-columns: 34px repeat(5,1fr);
      border-bottom: 1px solid rgba(255,255,255,0.08);
    }
    .vg-day {
      padding: 7px 4px; text-align: center;
      font-size: 8px; font-weight: 700; letter-spacing: .9px;
      color: rgba(255,255,255,0.38); text-transform: uppercase;
      border-left: 1px solid rgba(255,255,255,0.06);
    }
    .vg-day:first-child { border-left: none; }
    .vg-rows { display: flex; flex-direction: column; }
    .vg-row {
      display: grid; grid-template-columns: 34px repeat(5,1fr);
      border-bottom: 1px solid rgba(255,255,255,0.05);
    }
    .vg-row:last-child { border-bottom: none; }
    .vg-time {
      padding: 0 5px;
      display: flex; align-items: center; justify-content: flex-end;
      font-size: 7px; font-weight: 600; color: rgba(255,255,255,0.25);
      white-space: nowrap;
    }
    .vg-cell {
      border-left: 1px solid rgba(255,255,255,0.05);
      padding: 2.5px; min-height: 32px;
      display: flex; align-items: stretch;
    }
    .vg-block {
      flex: 1; border-radius: 4px;
      display: flex; flex-direction: column;
      justify-content: center; padding: 3px 5px;
      opacity: 0; transform: scale(0.82);
      transition: opacity 0.3s ease, transform 0.3s ease;
    }
    .vg-block.vb-placed { opacity: 1; transform: scale(1); }
    .vg-block.vb-a { background: rgba(110,231,183,0.18); border: 1px solid rgba(110,231,183,0.30); color: #9EFFD4; }
    .vg-block.vb-b { background: rgba(21,128,61,0.28);  border: 1px solid rgba(21,128,61,0.45);  color: #86EFAC; }
    .vg-block.vb-c { background: rgba(255,255,255,0.07); border: 1px solid rgba(255,255,255,0.13); color: rgba(255,255,255,0.65); }
    .vg-block.vb-d { background: rgba(52,211,153,0.14); border: 1px solid rgba(52,211,153,0.25); color: #6EE7B7; }
    .vg-code { font-size: 7.5px; font-weight: 700; letter-spacing: .3px; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
    .vg-room { font-size: 6.5px; font-weight: 500; opacity: .65; margin-top: 1.5px; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }

    /* ═══════════════════════════════════
       VISUAL 2 — faculty match cards
    ═══════════════════════════════════ */
    .vis-match {
      width: 100%; display: flex; flex-direction: column; gap: 8px;
    }
    .vm-card {
      background: rgba(255,255,255,0.05);
      border: 1px solid rgba(255,255,255,0.09);
      border-radius: 10px; padding: 12px 14px;
      display: flex; align-items: center; gap: 12px;
      opacity: 0; transform: translateY(10px);
      transition: opacity 0.4s ease, transform 0.4s ease;
    }
    .vm-card.vm-in { opacity: 1; transform: translateY(0); }
    .vm-avatar {
      width: 32px; height: 32px; border-radius: 8px;
      background: rgba(110,231,183,0.12);
      border: 1px solid rgba(110,231,183,0.22);
      display: flex; align-items: center; justify-content: center;
      flex-shrink: 0;
      font-size: 11px; font-weight: 700; color: var(--mint);
      font-family: 'Sora', sans-serif;
    }
    .vm-info { flex: 1; min-width: 0; }
    .vm-name { font-size: 11.5px; font-weight: 700; color: #fff; margin-bottom: 3px; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
    .vm-tags { display: flex; gap: 4px; flex-wrap: wrap; }
    .vm-tag {
      font-size: 9px; font-weight: 600; padding: 2px 7px;
      border-radius: 4px; white-space: nowrap;
    }
    .vm-tag-spec { background: rgba(110,231,183,0.14); color: var(--mint); border: 1px solid rgba(110,231,183,0.22); }
    .vm-tag-load { background: rgba(255,255,255,0.06); color: rgba(255,255,255,0.50); border: 1px solid rgba(255,255,255,0.10); }
    .vm-check {
      width: 22px; height: 22px; border-radius: 50%;
      background: rgba(110,231,183,0.15); border: 1.5px solid rgba(110,231,183,0.35);
      display: flex; align-items: center; justify-content: center;
      flex-shrink: 0; opacity: 0; transition: opacity 0.3s ease 0.2s;
    }
    .vm-check.vm-checked { opacity: 1; }
    .vm-check svg { color: var(--mint); }

    /* ═══════════════════════════════════
       VISUAL 3 — workload bars
    ═══════════════════════════════════ */
    .vis-workload {
      width: 100%;
      background: rgba(255,255,255,0.04);
      border: 1px solid rgba(255,255,255,0.08);
      border-radius: 12px; padding: 16px;
    }
    .vw-row {
      display: flex; align-items: center; gap: 10px; margin-bottom: 10px;
    }
    .vw-row:last-child { margin-bottom: 0; }
    .vw-label {
      font-size: 10px; font-weight: 600; color: rgba(255,255,255,0.55);
      width: 72px; flex-shrink: 0; white-space: nowrap;
      overflow: hidden; text-overflow: ellipsis;
    }
    .vw-track {
      flex: 1; height: 8px; border-radius: 99px;
      background: rgba(255,255,255,0.07); overflow: hidden;
    }
    .vw-fill {
      height: 100%; border-radius: 99px;
      background: linear-gradient(90deg, var(--mint), rgba(110,231,183,0.55));
      width: 0%; transition: width 0.9s cubic-bezier(.4,0,.15,1);
    }
    .vw-val {
      font-size: 10px; font-weight: 700; color: var(--mint);
      width: 28px; text-align: right; flex-shrink: 0;
    }
    .vw-legend {
      display: flex; gap: 14px; margin-top: 14px;
      padding-top: 12px; border-top: 1px solid rgba(255,255,255,0.07);
    }
    .vw-leg-item {
      display: flex; align-items: center; gap: 6px;
      font-size: 9px; font-weight: 600; color: rgba(255,255,255,0.35);
    }
    .vw-leg-dot {
      width: 6px; height: 6px; border-radius: 50%;
    }

    /* ══ RIGHT FORM SIDE ══ */
    .login-form-side {
      flex: 1; display: flex; align-items: center; justify-content: center;
      padding: 40px 32px;
      background: #EFF5F1;
      background-image:
        linear-gradient(rgba(21,128,61,0.03) 1px, transparent 1px),
        linear-gradient(90deg, rgba(21,128,61,0.03) 1px, transparent 1px);
      background-size: 30px 30px;
      overflow-y: auto;
    }
    .login-card {
      position: relative; z-index: 1;
      width: 100%; max-width: 388px;
      background: var(--paper); border-radius: 20px;
      padding: 32px 30px 28px;
      box-shadow: 0 1px 3px rgba(15,56,40,0.04), 0 12px 36px rgba(15,56,40,0.10), 0 0 0 1px rgba(15,56,40,0.05);
      animation: fadeUp .3s ease both;
    }
    @media (prefers-reduced-motion: reduce) { .login-card { animation: none; } }
    .card-logo-wrap { display: flex; justify-content: center; margin-bottom: 16px; }
    .card-logo-wrap img { width: 120px; height: auto; object-fit: contain; }
    .card-heading { margin-bottom: 16px; }
    .card-heading h1 {
      font-family: 'Sora', sans-serif;
      font-size: 19px; font-weight: 800; color: var(--ink);
      letter-spacing: -.35px; margin-bottom: 4px;
    }
    .card-heading p { font-size: 12px; color: var(--slate); font-weight: 500; }
    .card-divider { height: 1px; background: var(--line); margin-bottom: 18px; }

    .role-selector-wrap { margin-bottom: 18px; }
    .role-selector-label { font-size: 11.5px; font-weight: 600; color: var(--ink); display: block; margin-bottom: 9px; }
    .role-selector {
      display: flex; gap: 5px; padding: 4px;
      background: var(--mist); border-radius: 11px; border: 1.5px solid var(--line);
    }
    .role-option {
      flex: 1; padding: 9px 8px; border-radius: 8px;
      background: transparent; border: none;
      font-family: 'Inter', sans-serif; font-size: 12px; font-weight: 600;
      color: var(--slate); cursor: pointer; transition: all 0.2s ease;
      display: flex; align-items: center; justify-content: center; gap: 6px;
    }
    .role-option:hover:not(.role-option-active) { background: rgba(21,128,61,0.08); color: var(--meadow-deep); }
    .role-option:focus-visible { outline: 2px solid var(--meadow); outline-offset: 2px; }
    .role-option-active {
      background: linear-gradient(135deg, var(--meadow) 0%, var(--meadow-deep) 100%);
      color: #fff; box-shadow: 0 2px 10px rgba(21,128,61,0.28);
    }

    .login-label { font-size: 11.5px; font-weight: 600; color: var(--ink); display: block; margin-bottom: 7px; }
    .login-field { position: relative; }
    .login-field-icon {
      position: absolute; left: 13px; top: 50%; transform: translateY(-50%);
      color: var(--slate-soft); pointer-events: none; display: flex; align-items: center;
      transition: color 0.15s;
    }
    .login-input {
      width: 100%; padding: 11px 13px 11px 40px;
      border-radius: 10px; border: 1.5px solid var(--line);
      font-family: 'Inter', sans-serif; font-size: 13px; color: var(--ink);
      background: #FBFDFC; outline: none;
      transition: border-color 0.15s, box-shadow 0.15s;
    }
    .login-input:focus { border-color: var(--meadow); box-shadow: 0 0 0 3px rgba(21,128,61,0.13); background: #fff; }
    .login-field:focus-within .login-field-icon { color: var(--meadow-deep); }
    .login-input::placeholder { color: #A9BDB1; }
    .pw-toggle {
      position: absolute; right: 11px; top: 50%; transform: translateY(-50%);
      background: none; border: none; cursor: pointer;
      color: var(--slate-soft); display: flex; align-items: center; padding: 4px;
      transition: color 0.15s;
    }
    .pw-toggle:hover { color: var(--meadow-deep); }

    .login-btn {
      width: 100%; padding: 12px; border-radius: 10px; border: none;
      background: linear-gradient(135deg, var(--meadow) 0%, var(--meadow-deep) 100%);
      color: #fff; font-family: 'Inter', sans-serif;
      font-size: 13.5px; font-weight: 600; cursor: pointer;
      display: flex; align-items: center; justify-content: center; gap: 8px;
      transition: transform 0.12s, box-shadow 0.15s;
      box-shadow: 0 4px 16px rgba(15,92,44,0.30); letter-spacing: .2px;
    }
    .login-btn:hover:not(:disabled) { transform: translateY(-1px); box-shadow: 0 6px 20px rgba(15,92,44,0.40); }
    .login-btn:active:not(:disabled) { transform: translateY(0); }
    .login-btn:disabled { opacity: .6; cursor: default; box-shadow: none; }

    .login-error {
      display: flex; align-items: center; gap: 9px;
      padding: 10px 13px; border-radius: 10px;
      background: var(--danger-bg); border: 1px solid var(--danger-line);
      font-size: 12px; color: var(--danger);
      animation: errShake 0.35s ease;
    }
    @media (max-width: 480px) {
      .login-form-side { padding: 20px 16px; }
      .login-card { padding: 24px 20px 22px; border-radius: 16px; }
    }
    @keyframes errShake { 0%,100%{transform:translateX(0)} 20%{transform:translateX(-5px)} 60%{transform:translateX(5px)} }
    @keyframes spin-login { to { transform: rotate(360deg); } }
    @keyframes fadeUp { from{opacity:0;transform:translateY(12px)} to{opacity:1;transform:translateY(0)} }
  `
  document.head.appendChild(s)
}

/* ─── Visual 1: Animated timetable ──────────────────────────────────────────── */
const TT_TIMES = ['7 AM','8 AM','9 AM','10 AM','11 AM','12 PM']
const TT_DAYS  = ['MON','TUE','WED','THU','FRI']
const TT_DATA  = [
  [null,              {code:'CS 101',room:'L201',v:'a'}, null,                       null,              null             ],
  [{code:'CS 311',room:'Lab1',v:'b'}, null,             null,                       null,              {code:'EMC 201',room:'L104',v:'d'}],
  [null,              {code:'IT 301',room:'L402',v:'c'}, null,                      {code:'CS 401',room:'L201',v:'a'}, null],
  [{code:'EMC 301',room:'Lab2',v:'d'}, null,            null,                       null,              {code:'IT 101',room:'L201',v:'c'}],
  [null,              null,            {code:'IT 401',room:'L104',v:'b'},            null,              null             ],
  [{code:'CS 201',room:'L402',v:'c'}, null,             {code:'CS 101',room:'L201',v:'a'}, null,       null             ],
]

function TimetableVis({ active }) {
  const [placed, setPlaced] = useState(() => TT_DATA.map(r => r.map(() => false)))
  const timerRef = useRef(null)
  const runRef   = useRef(null)

  const startAnim = () => {
    const positions = []
    TT_DATA.forEach((row, r) => row.forEach((cell, c) => { if (cell) positions.push([r,c]) }))
    for (let i = positions.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [positions[i], positions[j]] = [positions[j], positions[i]]
    }
    let i = 0
    const tick = () => {
      if (i >= positions.length) {
        timerRef.current = setTimeout(() => {
          setPlaced(TT_DATA.map(r => r.map(() => false)))
          timerRef.current = setTimeout(() => { i = 0; tick() }, 500)
        }, 2800)
        return
      }
      const [r, c] = positions[i++]
      setPlaced(prev => { const n = prev.map(row => [...row]); n[r][c] = true; return n })
      timerRef.current = setTimeout(tick, 140 + Math.random() * 100)
    }
    tick()
  }

  useEffect(() => {
    if (active) {
      setPlaced(TT_DATA.map(r => r.map(() => false)))
      timerRef.current = setTimeout(startAnim, 300)
    } else {
      clearTimeout(timerRef.current)
    }
    return () => clearTimeout(timerRef.current)
  }, [active])

  return (
    <div className="vis-grid">
      <div className="vg-days">
        <div className="vg-day" />
        {TT_DAYS.map(d => <div key={d} className="vg-day">{d}</div>)}
      </div>
      <div className="vg-rows">
        {TT_DATA.map((row, r) => (
          <div key={r} className="vg-row">
            <div className="vg-time">{TT_TIMES[r]}</div>
            {row.map((cell, c) => (
              <div key={c} className="vg-cell">
                {cell && (
                  <div className={`vg-block vb-${cell.v}${placed[r][c] ? ' vb-placed' : ''}`}>
                    <span className="vg-code">{cell.code}</span>
                    <span className="vg-room">{cell.room}</span>
                  </div>
                )}
              </div>
            ))}
          </div>
        ))}
      </div>
    </div>
  )
}

/* ─── Visual 2: Faculty match cards ─────────────────────────────────────────── */
const FACULTY_CARDS = [
  { init: 'RC', name: 'R. Cruz',    spec: 'Machine Learning', load: '18 units' },
  { init: 'ML', name: 'M. Lim',     spec: 'Web Systems',      load: '15 units' },
  { init: 'JR', name: 'J. Reyes',   spec: 'Networking',       load: '21 units' },
]

function FacultyMatchVis({ active }) {
  const [shown, setShown] = useState([false, false, false])
  const [checked, setChecked] = useState([false, false, false])
  const timerRef = useRef(null)

  useEffect(() => {
    if (!active) {
      clearTimeout(timerRef.current)
      setShown([false, false, false])
      setChecked([false, false, false])
      return
    }
    const seq = []
    FACULTY_CARDS.forEach((_, i) => {
      seq.push({ delay: 300 + i * 380, fn: () => setShown(p => { const n=[...p]; n[i]=true; return n }) })
      seq.push({ delay: 700 + i * 380, fn: () => setChecked(p => { const n=[...p]; n[i]=true; return n }) })
    })
    // loop
    seq.push({ delay: 3600, fn: () => {
      setShown([false,false,false]); setChecked([false,false,false])
      timerRef.current = setTimeout(() => {
        setShown([false,false,false]); setChecked([false,false,false])
        // re-trigger by flipping a dummy — just re-run via a recursive call
      }, 200)
    }})

    let cancelled = false
    seq.forEach(({ delay, fn }) => {
      timerRef.current = setTimeout(() => { if (!cancelled) fn() }, delay)
    })
    // restart loop
    timerRef.current = setTimeout(() => {
      if (cancelled) return
      setShown([false,false,false]); setChecked([false,false,false])
    }, 4800)

    return () => { cancelled = true; clearTimeout(timerRef.current) }
  }, [active])

  return (
    <div className="vis-match">
      {FACULTY_CARDS.map((f, i) => (
        <div key={i} className={`vm-card${shown[i] ? ' vm-in' : ''}`} style={{ transitionDelay: `${i * 0.04}s` }}>
          <div className="vm-avatar">{f.init}</div>
          <div className="vm-info">
            <div className="vm-name">{f.name}</div>
            <div className="vm-tags">
              <span className="vm-tag vm-tag-spec">{f.spec}</span>
              <span className="vm-tag vm-tag-load">{f.load}</span>
            </div>
          </div>
          <div className={`vm-check${checked[i] ? ' vm-checked' : ''}`}>
            <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3">
              <polyline points="20 6 9 17 4 12"/>
            </svg>
          </div>
        </div>
      ))}
    </div>
  )
}

/* ─── Visual 3: Workload bars ────────────────────────────────────────────────── */
const WORKLOAD_ROWS = [
  { name: 'R. Cruz',   pct: 75, val: '18 u' },
  { name: 'M. Lim',    pct: 62, val: '15 u' },
  { name: 'J. Reyes',  pct: 88, val: '21 u' },
  { name: 'A. Santos', pct: 54, val: '13 u' },
  { name: 'L. Tan',    pct: 42, val: '10 u' },
]

function WorkloadVis({ active }) {
  const [filled, setFilled] = useState(false)

  useEffect(() => {
    if (active) {
      const t = setTimeout(() => setFilled(true), 150)
      return () => clearTimeout(t)
    } else {
      setFilled(false)
    }
  }, [active])

  return (
    <div className="vis-workload">
      {WORKLOAD_ROWS.map((row, i) => (
        <div key={i} className="vw-row">
          <div className="vw-label">{row.name}</div>
          <div className="vw-track">
            <div
              className="vw-fill"
              style={{
                width: filled ? `${row.pct}%` : '0%',
                transitionDelay: `${i * 0.09}s`,
              }}
            />
          </div>
          <div className="vw-val">{row.val}</div>
        </div>
      ))}
      <div className="vw-legend">
        <div className="vw-leg-item">
          <div className="vw-leg-dot" style={{ background: 'var(--mint)' }} />
          Unit load
        </div>
        <div className="vw-leg-item">
          <div className="vw-leg-dot" style={{ background: 'rgba(255,255,255,0.18)' }} />
          Max: 24 units
        </div>
      </div>
    </div>
  )
}

/* ─── Carousel ───────────────────────────────────────────────────────────────── */
const SLIDES_META = [
  {
    heading: <>Schedules built<br />by logic, not <em>guesswork.</em></>,
    sub: 'The CP-SAT solver fills every time slot conflict-free across rooms and faculty — in seconds.',
    Visual: TimetableVis,
  },
  {
    heading: <>Right faculty,<br />right course, <em>every time.</em></>,
    sub: 'Faculty are matched by specialization and unit load. No manual cross-referencing needed.',
    Visual: FacultyMatchVis,
  },
  {
    heading: <>One view for<br />the whole <em>semester.</em></>,
    sub: 'Track workloads, spot gaps, and make overrides — all from a single dashboard.',
    Visual: WorkloadVis,
  },
]

function Carousel() {
  const [current, setCurrent] = useState(0)
  const [exiting, setExiting] = useState(null)
  const timerRef = useRef(null)

  const goTo = (idx) => {
    if (idx === current) return
    setExiting(current)
    setCurrent(idx)
    setTimeout(() => setExiting(null), 560)
  }
  const next = () => goTo((current + 1) % SLIDES_META.length)

  useEffect(() => {
    timerRef.current = setTimeout(next, 6500)
    return () => clearTimeout(timerRef.current)
  }, [current])

  return (
    <div className="panel-carousel">
      <div className="carousel-track">
        {SLIDES_META.map(({ heading, sub, Visual }, i) => (
          <div
            key={i}
            className={`carousel-slide${i === current ? ' s-active' : ''}${i === exiting ? ' s-exit' : ''}`}
          >
            <div className="slide-text">
              <h2 className="slide-heading">{heading}</h2>
              <p className="slide-sub">{sub}</p>
            </div>
            <div className="slide-visual">
              <Visual active={i === current} />
            </div>
          </div>
        ))}
      </div>
      <div className="carousel-dots">
        {SLIDES_META.map((_, i) => (
          <button
            key={i}
            className={`c-dot${i === current ? ' active' : ''}`}
            onClick={() => goTo(i)}
            aria-label={`Slide ${i + 1}`}
          />
        ))}
      </div>
    </div>
  )
}

/* ─── Main LoginPage ─────────────────────────────────────────────────────────── */
export default function LoginPage() {
  const [email,        setEmail]        = useState('')
  const [password,     setPassword]     = useState('')
  const [selectedRole, setSelectedRole] = useState('faculty')
  const [showPw,       setShowPw]       = useState(false)
  const [error,        setError]        = useState('')
  const [loading,      setLoading]      = useState(false)
  const navigate = useNavigate()

  async function handleLogin(e) {
    e.preventDefault()
    setError('')
    setLoading(true)
    try {
      const result = await signInWithEmailAndPassword(auth, email, password)
      const token  = await result.user.getIdTokenResult()
      const userRole      = token.claims.role
      const isCoordinator = token.claims.isCoordinator || false

      if (selectedRole === 'admin') {
        if (userRole !== 'admin') { setError('This account is not registered as an Admin.'); await auth.signOut(); setLoading(false); return }
        navigate('/dashboard')
      } else if (selectedRole === 'coordinator') {
        if (userRole !== 'faculty' || !isCoordinator) { setError('Your account does not have coordinator access.'); await auth.signOut(); setLoading(false); return }
        navigate('/coordinator')
      } else if (selectedRole === 'faculty') {
        if (userRole !== 'faculty') { setError('Your account is not registered as Faculty.'); await auth.signOut(); setLoading(false); return }
        navigate('/schedule')
      } else {
        setError('Your account has no role assigned. Contact the admin.')
        await auth.signOut()
      }
    } catch {
      setError('Incorrect email or password.')
    } finally {
      setLoading(false)
    }
  }

  const ROLES = [
    { id: 'admin',       label: 'Admin',
      icon: <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M12 2L2 7l10 5 10-5-10-5z"/><path d="M2 17l10 5 10-5"/><path d="M2 12l10 5 10-5"/></svg> },
    { id: 'coordinator', label: 'Coordinator',
      icon: <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><rect x="3" y="3" width="7" height="7"/><rect x="14" y="3" width="7" height="7"/><rect x="14" y="14" width="7" height="7"/><rect x="3" y="14" width="7" height="7"/></svg> },
    { id: 'faculty',     label: 'Faculty',
      icon: <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2"/><circle cx="12" cy="7" r="4"/></svg> },
  ]

  return (
    <div className="login-root">

      {/* ══ LEFT PANEL ══ */}
      <div className="login-panel">
        <div className="panel-inner">
          <div className="panel-brand">
            <img src={icon1Img} alt="Assigna" />
            <div>
              <span className="panel-brand-name">Assigna</span>
              <span className="panel-brand-sub">Smart Academic Scheduler</span>
            </div>
          </div>
          <Carousel />
          <p className="panel-footer">College of Computing Studies · CCS</p>
        </div>
      </div>

      {/* ══ RIGHT FORM SIDE ══ */}
      <div className="login-form-side">
        <div className="login-card">

          <div className="card-logo-wrap">
            <img src={logoImg} alt="Assigna" />
          </div>

          <div className="card-heading">
            <h1>Welcome back</h1>
            <p>Sign in to manage schedules and faculty workloads.</p>
          </div>

          <div className="card-divider" />

          <form onSubmit={handleLogin} style={{ display:'flex', flexDirection:'column', gap:12 }}>

            <div className="role-selector-wrap">
              <label className="role-selector-label">Select your role</label>
              <div className="role-selector">
                {ROLES.map(r => (
                  <button
                    key={r.id} type="button"
                    className={`role-option${selectedRole === r.id ? ' role-option-active' : ''}`}
                    onClick={() => setSelectedRole(r.id)}
                  >
                    {r.icon}{r.label}
                  </button>
                ))}
              </div>
            </div>

            <div>
              <label className="login-label">Email address</label>
              <div className="login-field">
                <svg className="login-field-icon" width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                  <path d="M4 4h16c1.1 0 2 .9 2 2v12c0 1.1-.9 2-2 2H4c-1.1 0-2-.9-2-2V6c0-1.1.9-2 2-2z"/><polyline points="22,6 12,13 2,6"/>
                </svg>
                <input className="login-input" type="email" value={email}
                  onChange={e => setEmail(e.target.value)}
                  placeholder="you@ccs.edu" required autoComplete="email" />
              </div>
            </div>

            <div>
              <label className="login-label">Password</label>
              <div className="login-field">
                <svg className="login-field-icon" width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                  <rect x="3" y="11" width="18" height="11" rx="2" ry="2"/><path d="M7 11V7a5 5 0 0 1 10 0v4"/>
                </svg>
                <input className="login-input" type={showPw ? 'text' : 'password'} value={password}
                  onChange={e => setPassword(e.target.value)}
                  placeholder="••••••••" required autoComplete="current-password"
                  style={{ paddingRight: 40 }} />
                <button type="button" className="pw-toggle" onClick={() => setShowPw(p => !p)} tabIndex={-1}>
                  {showPw ? (
                    <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                      <path d="M17.94 17.94A10.07 10.07 0 0 1 12 20c-7 0-11-8-11-8a18.45 18.45 0 0 1 5.06-5.94"/>
                      <path d="M9.9 4.24A9.12 9.12 0 0 1 12 4c7 0 11 8 11 8a18.5 18.5 0 0 1-2.16 3.19"/>
                      <line x1="1" y1="1" x2="23" y2="23"/>
                    </svg>
                  ) : (
                    <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                      <path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z"/>
                      <circle cx="12" cy="12" r="3"/>
                    </svg>
                  )}
                </button>
              </div>
            </div>

            {error && (
              <div className="login-error">
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                  <circle cx="12" cy="12" r="10"/><line x1="12" y1="8" x2="12" y2="12"/><line x1="12" y1="16" x2="12.01" y2="16"/>
                </svg>
                {error}
              </div>
            )}

            <button type="submit" className="login-btn" disabled={loading} style={{ marginTop: 4 }}>
              {loading ? (
                <>
                  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"
                    style={{ animation: 'spin-login .8s linear infinite' }}>
                    <path d="M21 12a9 9 0 1 1-6.219-8.56"/>
                  </svg>
                  Signing in…
                </>
              ) : (
                <>
                  Sign in
                  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
                    <line x1="5" y1="12" x2="19" y2="12"/><polyline points="12 5 19 12 12 19"/>
                  </svg>
                </>
              )}
            </button>
          </form>

          <p style={{ marginTop:14, fontSize:11, color:'var(--slate-soft)', textAlign:'center', lineHeight:1.6, fontWeight:500 }}>
            Access is restricted to registered faculty and administrators.
          </p>
        </div>
      </div>
    </div>
  )
}
