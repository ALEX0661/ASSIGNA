const G = {
  meadow: 'var(--meadow, var(--meadow))', meadowDeep: 'var(--meadow-deep)', meadowMid: 'var(--meadow-mid)',
  meadowSoft: 'var(--meadow-soft)', meadowBorder: 'var(--meadow-border)',
  ink: 'var(--ink, #0E2A20)', inkMid: '#1C3D2A', muted: 'var(--muted, #4B7060)', muted2: 'var(--muted2, #6B8C7A)',
  border: 'var(--border)', borderLight: 'var(--hover)', bg: 'var(--bg, #F2F7F4)',
  surface: 'var(--surface, #FFFFFF)', hover: 'var(--hover)',
  amber: '#F59E0B', amberSoft: 'rgba(245, 158, 11, 0.1)', amberBorder: 'rgba(245, 158, 11, 0.25)',
  blue: '#60A5FA', blueSoft: 'rgba(59, 130, 246, 0.1)', blueBorder: '#BFDBFE',
  red: '#EF4444', redSoft: 'rgba(239, 68, 68, 0.1)', redBorder: 'rgba(220, 38, 38, 0.25)',
}

if (!document.getElementById('approval-dashboard-style')) {
  const s = document.createElement('style')
  s.id = 'approval-dashboard-style'
  s.textContent = `
    @import url('https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700;800&family=Poppins:wght@600;700;800&family=IBM+Plex+Mono:wght@500;600;700&display=swap');

    .ap-root { font-family:'Inter',sans-serif; background:${G.bg}; }
    @keyframes apFadeUp { from { opacity:0; transform:translateY(8px) } to { opacity:1; transform:translateY(0) } }
    @keyframes apShimmer { 0% { background-position:-600px 0 } 100% { background-position:600px 0 } }
    @keyframes apSpin { to { transform:rotate(360deg) } }
    @keyframes apSlideIn { from { transform:translateX(24px); opacity:0 } to { transform:translateX(0); opacity:1 } }
    @keyframes apOverlayIn { from { opacity:0 } to { opacity:1 } }
    .ap-fadein { animation:apFadeUp .28s ease both; }
    .ap-spin { animation:apSpin .8s linear infinite; }
    .ap-skeleton { background:linear-gradient(90deg,${G.hover} 25%,${G.borderLight} 50%,${G.hover} 75%); background-size:600px 100%; animation:apShimmer 1.4s ease-in-out infinite; border-radius:7px; }

    .ap-card { background: var(--surface); border-radius:12px; border:1px solid ${G.border}; box-shadow:0 2px 12px rgba(0,0,0,0.03); overflow:hidden; }
    .ap-row { display:flex; align-items:center; gap:14px; padding:13px 18px; border-bottom:1px solid ${G.borderLight}; transition:background .12s; }
    .ap-row:last-child { border-bottom:none; }
    .ap-row:hover { background:${G.hover}; }

    .btn-outline { display:inline-flex; align-items:center; gap:6px; padding:7px 14px; border-radius:8px; border:1px solid ${G.border}; font-family:'Inter',sans-serif; font-size:12px; font-weight:600; cursor:pointer; background: var(--surface); color:${G.muted}; transition:all .13s; }
    .btn-outline:hover:not(:disabled) { background:${G.hover}; color:${G.ink}; border-color:${G.meadowBorder}; }
    .btn-outline:disabled { opacity:.5; cursor:default; }
    .btn-primary { display:inline-flex; align-items:center; gap:6px; padding:7px 16px; border-radius:8px; border:none; font-family:'Inter',sans-serif; font-size:12px; font-weight:600; cursor:pointer; transition:all .15s; background:${G.meadow}; color:#fff; box-shadow:0 3px 10px rgba(0,0,0,0.25); }
    .btn-primary:hover:not(:disabled) { background:${G.meadowDeep}; transform:translateY(-1px); }
    .btn-primary:disabled { opacity:.55; cursor:default; transform:none; box-shadow:none; }
    .btn-danger { display:inline-flex; align-items:center; gap:6px; padding:7px 14px; border-radius:8px; border:1px solid ${G.redBorder}; font-family:'Inter',sans-serif; font-size:12px; font-weight:600; cursor:pointer; background: var(--surface); color:${G.red}; transition:all .13s; }
    .btn-danger:hover:not(:disabled) { background:${G.redSoft}; border-color:${G.red}; }
    .btn-danger:disabled { opacity:.5; cursor:default; }
    .btn-amber { display:inline-flex; align-items:center; gap:6px; padding:7px 14px; border-radius:8px; border:1px solid ${G.amberBorder}; font-family:'Inter',sans-serif; font-size:11.5px; font-weight:600; cursor:pointer; background:${G.amberSoft}; color:#92400E; transition:all .13s; }
    .btn-amber:hover:not(:disabled) { background:#FDE9B0; }
    .btn-blue { display:inline-flex; align-items:center; gap:6px; padding:7px 16px; border-radius:8px; border:none; font-family:'Inter',sans-serif; font-size:12px; font-weight:600; cursor:pointer; transition:all .15s; background:${G.blue}; color:#fff; box-shadow:0 3px 10px rgba(29,78,216,0.22); }
    .btn-blue:hover:not(:disabled) { background:#1E40AF; transform:translateY(-1px); }

    .ap-icon-btn { display:inline-flex; align-items:center; justify-content:center; width:32px; height:32px; border-radius:8px; border:1px solid ${G.border}; background: var(--surface); color:${G.muted}; cursor:pointer; transition:all .15s; padding:0; flex-shrink:0; }
    .ap-icon-btn:hover:not(:disabled) { background:${G.hover}; color: var(--meadow-text); border-color:${G.meadowBorder}; }
    .ap-icon-btn:disabled { opacity:.4; cursor:default; }

    .cp-inp { padding:8px 12px; border-radius:8px; border:1.5px solid ${G.border}; font-family:'Inter',sans-serif; font-size:12.5px; color:${G.ink}; background: var(--surface); outline:none; transition:all .15s; width:100%; box-sizing:border-box; }
    .cp-inp:focus { border-color: var(--meadow-text-hover); box-shadow:0 0 0 3px rgba(0,0,0,0.1); }
    .cp-inp.sm { padding:5px 8px; font-size:11.5px; border-radius:6px; }

    .ap-badge { display:inline-flex; align-items:center; padding:3px 9px; border-radius:99px; font-family:'Inter',sans-serif; font-size:10.5px; font-weight:700; border:1px solid transparent; line-height:1.5; white-space:nowrap; }

    .ap-tab { display:inline-flex; align-items:center; gap:7px; padding:8px 16px; border-radius:9px; font-family:'Inter',sans-serif; font-size:12.5px; font-weight:700; cursor:pointer; transition:all .15s; border:1px solid transparent; background:transparent; color:${G.muted}; }
    .ap-tab:hover:not(.active) { background:${G.hover}; color:${G.ink}; }
    .ap-tab.active { background:${G.meadow}; color:#fff; box-shadow:0 3px 10px rgba(0,0,0,0.22); }
    .ap-tab-count { display:inline-flex; align-items:center; justify-content:center; min-width:17px; height:17px; padding:0 6px; border-radius:99px; font-size:10px; font-weight:800; background:rgba(255,255,255,0.28); font-family:'IBM Plex Mono',monospace; }
    .ap-tab:not(.active) .ap-tab-count { background:${G.amberSoft}; color:#92400E; }

    .r-tab { display:inline-flex; align-items:center; gap:5px; padding:6px 13px; border-radius:8px; font-family:'Inter',sans-serif; font-size:11.5px; font-weight:600; cursor:pointer; transition:all .15s; border:1px solid ${G.border}; background: var(--surface); color:${G.muted}; }
    .r-tab.active { background:${G.meadow}; color:#fff; border-color: var(--meadow-text); box-shadow:0 3px 10px rgba(0,0,0,0.22); }
    .r-tab:hover:not(.active) { background:${G.hover}; border-color:${G.meadowBorder}; color:${G.ink}; }

    .ap-tile { flex:1; display:flex; flex-direction:column; align-items:flex-start; gap:2px; padding:11px 15px; border-radius:11px; border:1px solid; background: var(--surface); font-family:'Inter',sans-serif; text-align:left; transition:transform .15s, box-shadow .15s; cursor:pointer; }
    .ap-tile:hover { transform:translateY(-2px); box-shadow:0 6px 16px rgba(0,0,0,0.08); }
    .ap-tile-value { font-family:'IBM Plex Mono',monospace; font-size:21px; font-weight:800; line-height:1; }
    .ap-tile-label { font-size:10px; font-weight:700; text-transform:uppercase; letter-spacing:.4px; opacity:.85; }

    .prog-bar-wrap { height:6px; background:${G.borderLight}; border-radius:99px; overflow:hidden; width:100%; }
    .prog-bar-fill { height:100%; border-radius:99px; transition:width .4s cubic-bezier(.4,0,.2,1); background:linear-gradient(90deg,${G.meadow},var(--meadow)); }

    /* Queue rail — mirrors the coordinator-side queue card (gradient head
       + circular status rail) so the admin queue view reads as the same
       product instead of the old boxy phase-track squares. */
    .aq-card { border-radius:13px; border:1px solid ${G.border}; overflow:hidden; background: var(--surface); }
    .aq-head { display:flex; align-items:center; justify-content:space-between; gap:14px; padding:12px 16px; background:linear-gradient(135deg, ${G.meadowDeep}, ${G.meadow}); color:#fff; }
    .aq-head-title { font-size:13px; font-weight:800; letter-spacing:-.1px; line-height:1.3; }
    .aq-head-sub { font-size:11px; font-weight:500; color:rgba(255,255,255,0.82); margin-top:2px; line-height:1.3; }
    .aq-head-turn { font-family:'IBM Plex Mono',monospace; font-size:12.5px; font-weight:800; flex-shrink:0; white-space:nowrap; }
    .aq-head-of { font-size:9.5px; font-weight:600; color:rgba(255,255,255,0.75); margin-left:2px; }
    .aq-rail-wrap { padding:20px 16px 16px; }

    .ap-order-item { display:flex; align-items:center; gap:11px; padding:10px 12px; border-radius:9px; background: var(--surface); cursor:grab; transition:border-color .12s, box-shadow .12s; }

    .cp-toast-wrap { position:fixed; bottom:24px; right:26px; z-index:9999; display:flex; flex-direction:column-reverse; gap:10px; align-items:flex-end; pointer-events:none; }
    .cp-toast { display:flex; align-items:center; gap:10px; padding:13px 20px; border-radius:11px; font-family:'Inter',sans-serif; font-size:13px; font-weight:600; animation:apFadeUp .22s cubic-bezier(.4,0,.2,1); white-space:nowrap; pointer-events:auto; box-shadow:0 8px 24px rgba(0,0,0,0.15); }
    .cp-toast.success { background:${G.meadow}; color:#fff; border:1px solid ${G.meadowBorder}; }
    .cp-toast.error { background: var(--surface); color:${G.red}; border:1px solid ${G.redBorder}; }
    .cp-toast.info { background: var(--surface); color: var(--meadow-text); border:1px solid ${G.meadowBorder}; }

    .ap-modal-overlay { position:fixed; inset:0; background:rgba(10,30,20,0.48); z-index:2000; display:flex; align-items:center; justify-content:center; padding:20px; animation:apOverlayIn .15s ease; }
    .ap-modal { background: var(--surface); border-radius:15px; box-shadow:0 24px 60px rgba(0,0,0,0.22); overflow:hidden; }
    .ap-modal-header { padding:17px 20px; border-bottom:1px solid ${G.border}; display:flex; align-items:flex-start; gap:12px; background:${G.bg}; }
    .ap-modal-title { font-size:15.5px; font-weight:800; color:${G.ink}; margin:0; letter-spacing:-.1px; }
    .ap-modal-close { width:28px; height:28px; border-radius:8px; border:1px solid ${G.border}; background: var(--surface); cursor:pointer; color:${G.muted}; font-size:15px; line-height:1; display:flex; align-items:center; justify-content:center; flex-shrink:0; }
    .ap-modal-close:hover { background:${G.hover}; }

    /* Review panel — slide-over from the right, keeps queue context visible
       behind a dim backdrop instead of yanking the admin to a full modal. */
    .ap-panel-overlay { position:fixed; inset:0; background:rgba(10,30,20,0.4); z-index:2500; animation:apOverlayIn .15s ease; }
    .ap-panel { position:fixed; top:0; right:0; bottom:0; width:min(620px, 100vw); background: var(--surface); z-index:2501; display:flex; flex-direction:column; box-shadow:-16px 0 48px rgba(0,0,0,0.18); animation:apSlideIn .22s cubic-bezier(.16,1,.3,1); }
    .ap-kbd { display:inline-flex; align-items:center; justify-content:center; min-width:18px; height:18px; padding:0 4px; border-radius:5px; background:${G.hover}; border:1px solid ${G.border}; font-family:'IBM Plex Mono',monospace; font-size:10px; font-weight:700; color:${G.muted}; }
  `
  document.head.appendChild(s)
}

export default G
