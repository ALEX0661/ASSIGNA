import React from 'react'

export default function ConfirmDeleteModal({ scheduleName, onConfirm, onCancel }) {
  return (
    <div style={{ position:'fixed', inset:0, background:'rgba(14,42,32,0.4)', backdropFilter:'blur(2px)', display:'flex', alignItems:'center', justifyContent:'center', zIndex:9999, animation:'fadeIn .15s ease' }} onClick={onCancel}>
      <div style={{ background:'var(--surface, #fff)', width: 400, borderRadius: 16, padding: '24px 28px', boxShadow: '0 20px 40px rgba(0,0,0,0.15), 0 0 0 1px var(--border)', animation:'slideIn .2s ease' }} onClick={e => e.stopPropagation()}>
        <div style={{ display:'flex', alignItems:'center', gap:14, marginBottom:20 }}>
          <div style={{ width:42, height:42, borderRadius:12, background:'#FFF0F0', display:'flex', alignItems:'center', justifyContent:'center', flexShrink:0 }}>
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="#C0392B" strokeWidth="2.5">
              <path d="M3 6h18M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2M10 11v6M14 11v6"/>
            </svg>
          </div>
          <div>
            <p style={{ fontSize:15, fontWeight:700, color:'var(--ink)', margin:0 }}>Delete Schedule</p>
            <p style={{ fontSize:12.5, color:'var(--muted2)', marginTop:4, lineHeight:1.4 }}>
              Are you sure you want to delete <strong style={{color:'var(--ink)'}}>"{scheduleName}"</strong>? This action cannot be undone.
            </p>
          </div>
        </div>
        <div style={{ display:'flex', gap:10, justifyContent:'flex-end' }}>
          <button onClick={onCancel} style={{ padding:'8px 18px', borderRadius:10, border:'1.5px solid var(--border)', background:'var(--bg)', color:'var(--ink-mid)', fontSize:12.5, fontWeight:600, cursor:'pointer', fontFamily:'Inter,sans-serif' }}>
            Cancel
          </button>
          <button onClick={onConfirm} style={{ padding:'8px 18px', borderRadius:10, border:'none', background:'linear-gradient(135deg,#EF4444,#C0392B)', color: 'var(--surface)', fontSize:12.5, fontWeight:600, cursor:'pointer', fontFamily:'Inter,sans-serif', boxShadow:'0 4px 14px rgba(192,57,43,0.3)' }}>
            Delete
          </button>
        </div>
      </div>
    </div>
  )
}
