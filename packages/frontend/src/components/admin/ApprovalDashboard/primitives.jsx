import G from './tokens'

const ICONS = {
  queue: <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8"><rect x="3" y="4" width="18" height="4" rx="1"/><rect x="3" y="10" width="18" height="4" rx="1"/><rect x="3" y="16" width="18" height="4" rx="1"/></svg>,
  inbox: <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8"><path d="M22 12h-6l-2 3h-4l-2-3H2"/><path d="M5.45 5.11 2 12v6a2 2 0 0 0 2 2h16a2 2 0 0 0 2-2v-6l-3.45-6.89A2 2 0 0 0 16.76 4H7.24a2 2 0 0 0-1.79 1.11z"/></svg>,
  calendar: <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8"><rect x="3" y="4" width="18" height="18" rx="2"/><line x1="16" y1="2" x2="16" y2="6"/><line x1="8" y1="2" x2="8" y2="6"/><line x1="3" y1="10" x2="21" y2="10"/></svg>,
  clipboard: <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8"><path d="M9 2h6a1 1 0 0 1 1 1v2H8V3a1 1 0 0 1 1-1z"/><rect x="5" y="4" width="14" height="17" rx="2"/><line x1="9" y1="11" x2="15" y2="11"/><line x1="9" y1="15" x2="15" y2="15"/></svg>,
  activity: <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8"><polyline points="22 12 18 12 15 21 9 3 6 12 2 12"/></svg>,
}

function ToastContainer({ toasts }) {
  const icons = {
    success: <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"><polyline points="20 6 9 17 4 12"/></svg>,
    error: <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"><circle cx="12" cy="12" r="10"/><line x1="12" y1="8" x2="12" y2="12"/><line x1="12" y1="16" x2="12.01" y2="16"/></svg>,
    info: <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"><circle cx="12" cy="12" r="10"/><path d="M12 8v4"/></svg>,
  }
  return <div className="cp-toast-wrap">{toasts.map(t => <div key={t.id} className={`cp-toast ${t.type}`}>{icons[t.type]}{t.message}</div>)}</div>
}

function Skel({ w = '100%', h = 13, r = 6, style = {} }) {
  return <div className="ap-skeleton" style={{ width: w, height: h, borderRadius: r, flexShrink: 0, ...style }} />
}
function Badge({ label, bg, color, border }) {
  return <span className="ap-badge" style={{ background: bg, color, borderColor: border || 'transparent' }}>{label}</span>
}
function EmptyState({ icon, text, action }) {
  return (
    <div style={{ padding: '42px 20px', textAlign: 'center', color: G.muted2, display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 11 }}>
      <div style={{ width: 44, height: 44, borderRadius: 12, background: G.bg, display: 'flex', alignItems: 'center', justifyContent: 'center', color: G.muted2 }}>{icon}</div>
      <div style={{ fontSize: 12.5, fontWeight: 500, maxWidth: 280, lineHeight: 1.5 }}>{text}</div>
      {action}
    </div>
  )
}

export { ICONS, ToastContainer, Skel, Badge, EmptyState }
