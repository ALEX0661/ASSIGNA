/**
 * Styled stand-in for window.confirm() when the user tries to navigate away
 * with unsaved changes. Self-contained (no dependency on any page's own
 * modal primitives) so it can be dropped into any page.
 */
export default function UnsavedChangesModal({ subject, onConfirm, onCancel }) {
  return (
    <div
      onClick={onCancel}
      style={{
        position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.45)',
        display: 'flex', alignItems: 'center', justifyContent: 'center',
        zIndex: 1000,
      }}
    >
      <div
        onClick={e => e.stopPropagation()}
        style={{
          background: 'var(--surface)', borderRadius: 16, width: 420, maxWidth: '90vw',
          padding: '28px 30px', boxShadow: '0 24px 60px rgba(0,0,0,0.25)',
          border: '1px solid var(--border)', fontFamily: "'Inter',sans-serif",
        }}
      >
        <div style={{ display: 'flex', alignItems: 'flex-start', gap: 14, marginBottom: 20 }}>
          <div style={{ width: 40, height: 40, borderRadius: 11, background: '#fffbeb', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="#d97706" strokeWidth="2.5">
              <path d="M10.29 3.86L1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z" />
              <line x1="12" y1="9" x2="12" y2="13" /><line x1="12" y1="17" x2="12.01" y2="17" />
            </svg>
          </div>
          <div>
            <h3 style={{ margin: 0, fontSize: 15, fontWeight: 700, color: 'var(--ink)' }}>Unsaved changes</h3>
            <p style={{ margin: '5px 0 0', fontSize: 12.5, color: 'var(--muted2)', lineHeight: 1.5 }}>
              You have unsaved changes{subject ? <> to <strong>{subject}</strong></> : ''}. If you leave now, they'll be lost.
            </p>
          </div>
        </div>
        <div style={{ display: 'flex', gap: 8, justifyContent: 'flex-end' }}>
          <button
            onClick={onCancel}
            style={{ padding: '8px 18px', borderRadius: 9, border: '1.5px solid var(--border)', background: 'var(--surface)', color: 'var(--muted)', fontSize: 12.5, fontWeight: 600, cursor: 'pointer', fontFamily: "'Inter',sans-serif" }}
          >
            Keep Editing
          </button>
          <button
            onClick={onConfirm}
            style={{ padding: '8px 22px', borderRadius: 9, border: 'none', background: 'linear-gradient(135deg,#d97706,#b45309)', color: '#fff', fontSize: 12.5, fontWeight: 700, cursor: 'pointer', fontFamily: "'Inter',sans-serif", boxShadow: '0 3px 12px rgba(0,0,0,0.25)' }}
          >
            Leave Without Saving
          </button>
        </div>
      </div>
    </div>
  )
}
