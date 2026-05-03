import { programColor } from './svHelpers'

// ── Lavender theme tokens (mirrors AdminLayout CSS vars) ──────────────────────
export const TV = {
  deep:   '#7C6FCD',
  mid:    '#A99BE8',
  light:  '#D8D3F5',
  pale:   '#EEEAFB',
  border: '#E8E4F8',
  text:   '#1a1a2e',
  muted:  '#8883B0',
}

// ── Modal overlay ─────────────────────────────────────────────────────────────
export function ModalOverlay({ onClose, children }) {
  return (
    <div
      onClick={e => e.target === e.currentTarget && onClose()}
      style={{
        position: 'fixed', inset: 0,
        background: 'rgba(30,24,60,.55)',
        backdropFilter: 'blur(3px)',
        display: 'flex', alignItems: 'center', justifyContent: 'center',
        zIndex: 999,
      }}
    >
      {children}
    </div>
  )
}

export function ModalHeader({ title, subtitle, onClose, fontSize = 16 }) {
  return (
    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 18 }}>
      <div>
        <p style={{ fontWeight: 700, fontSize, margin: 0, color: TV.text, letterSpacing: '-.3px' }}>{title}</p>
        {subtitle && <p style={{ fontSize: 11.5, color: TV.muted, margin: '3px 0 0' }}>{subtitle}</p>}
      </div>
      <button
        onClick={onClose}
        style={{
          background: TV.pale, border: `1px solid ${TV.border}`,
          width: 28, height: 28, borderRadius: 8,
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          cursor: 'pointer', color: TV.muted, fontSize: 16, lineHeight: 1,
          transition: 'all .15s', flexShrink: 0,
        }}
        onMouseEnter={e => { e.currentTarget.style.background = TV.light; e.currentTarget.style.color = TV.text }}
        onMouseLeave={e => { e.currentTarget.style.background = TV.pale;  e.currentTarget.style.color = TV.muted }}
      >×</button>
    </div>
  )
}

export function ModalFooter({ selectedCount, onClose }) {
  return (
    <div style={{ marginTop: 20, display: 'flex', justifyContent: 'space-between', alignItems: 'center', borderTop: `1px solid ${TV.border}`, paddingTop: 16 }}>
      <span style={{ fontSize: 12, color: TV.muted }}>{selectedCount} selected</span>
      <button
        onClick={onClose}
        style={{
          padding: '7px 18px', fontSize: 12.5, fontWeight: 600,
          background: 'linear-gradient(135deg,#7C6FCD,#5a4fbf)',
          color: '#fff', border: 'none', borderRadius: 8, cursor: 'pointer',
          fontFamily: 'Poppins, sans-serif',
        }}
      >Done</button>
    </div>
  )
}

// ── Filter chip ───────────────────────────────────────────────────────────────
export function Chip({ label, active, color, onClick }) {
  const activeBg     = color?.bg     ?? TV.pale
  const activeText   = color?.text   ?? TV.deep
  const activeBorder = color?.border ?? TV.light
  return (
    <button
      onClick={onClick}
      style={{
        padding: '4px 11px', borderRadius: 20, fontSize: 11.5, cursor: 'pointer',
        fontWeight: active ? 600 : 400,
        border:     `1px solid ${active ? activeBorder : TV.border}`,
        background: active ? activeBg  : '#fff',
        color:      active ? activeText : TV.muted,
        transition: 'all .15s', whiteSpace: 'nowrap',
        fontFamily: 'Poppins, sans-serif',
      }}
    >
      {label}
    </button>
  )
}

export function FilterButton({ active, count, onClick }) {
  return (
    <button
      onClick={onClick}
      style={{
        padding: '4px 11px', borderRadius: 20, fontSize: 11.5, cursor: 'pointer',
        background: active ? TV.pale   : '#fff',
        color:      active ? TV.deep   : TV.muted,
        border:     `1px solid ${active ? TV.light : TV.border}`,
        fontWeight: active ? 600 : 400,
        fontFamily: 'Poppins, sans-serif',
        transition: 'all .15s',
      }}
    >
      {count === 0 ? 'All' : `${count} Selected`}
    </button>
  )
}

export function FilterRow({ label, children }) {
  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 6, flexWrap: 'wrap' }}>
      <span style={{ fontSize: 10, fontWeight: 700, color: TV.muted, textTransform: 'uppercase', letterSpacing: '.8px', whiteSpace: 'nowrap' }}>
        {label}
      </span>
      {children}
    </div>
  )
}

// ── Conflict badge ─────────────────────────────────────────────────────────────
export function ConflictBadge({ label }) {
  const isRoom = label?.includes('Room')
  const isFac  = label?.includes('Faculty')
  const isSec  = label?.includes('Section')
  const multi  = [isRoom, isFac, isSec].filter(Boolean).length > 1

  let bg = '#fef2f2', color = '#b91c1c', border = '#fecaca'
  if (multi)      { bg = '#fff7ed'; color = '#c2410c'; border = '#fed7aa' }
  else if (isFac) { bg = '#eff6ff'; color = '#1d4ed8'; border = '#bfdbfe' }
  else if (isSec) { bg = '#fdf4ff'; color = '#7e22ce'; border = '#e9d5ff' }

  return (
    <span style={{
      fontSize: 9.5, fontWeight: 700,
      background: bg, color, border: `1px solid ${border}`,
      borderRadius: 4, padding: '1px 6px', whiteSpace: 'nowrap',
    }}>
      ⚠ {label || 'Conflict'}
    </span>
  )
}

export function MergedBadge() {
  return (
    <span style={{
      fontSize: 9.5, fontWeight: 700,
      background: '#EDE9FB', color: TV.deep,
      border: `1px solid ${TV.light}`,
      borderRadius: 4, padding: '1px 6px', whiteSpace: 'nowrap',
    }}>
      ⚡ Merged
    </span>
  )
}

// ── Conflict summary bar ──────────────────────────────────────────────────────
export function ConflictSummaryBar({ conflictMap, compact = false }) {
  if (conflictMap.size === 0) return null
  const vals = [...conflictMap.values()]
  const roomCount    = vals.filter(v => v.label.includes('Room')).length
  const sectionCount = vals.filter(v => v.label.includes('Section')).length
  const facultyCount = vals.filter(v => v.label.includes('Faculty')).length

  // ── Compact/inline variant for the maximize top bar ───────────────────────
  if (compact) {
    return (
      <div style={{ display: 'flex', alignItems: 'center', gap: 5, flexShrink: 0 }}>
        <span style={{ fontSize: 10, fontWeight: 700, color: '#b91c1c', whiteSpace: 'nowrap' }}>⚠</span>
        {roomCount > 0 && (
          <span style={{ fontSize: 10, background: '#fee2e2', color: '#b91c1c', border: '1px solid #fca5a5', borderRadius: 10, padding: '1px 7px', fontWeight: 700, whiteSpace: 'nowrap' }}>
            {roomCount}R
          </span>
        )}
        {sectionCount > 0 && (
          <span style={{ fontSize: 10, background: '#fdf4ff', color: '#7e22ce', border: '1px solid #e9d5ff', borderRadius: 10, padding: '1px 7px', fontWeight: 700, whiteSpace: 'nowrap' }}>
            {sectionCount}S
          </span>
        )}
        {facultyCount > 0 && (
          <span style={{ fontSize: 10, background: '#eff6ff', color: '#1d4ed8', border: '1px solid #bfdbfe', borderRadius: 10, padding: '1px 7px', fontWeight: 700, whiteSpace: 'nowrap' }}>
            {facultyCount}F
          </span>
        )}
        <span style={{ fontSize: 10, color: TV.muted, whiteSpace: 'nowrap' }}>conflict{conflictMap.size !== 1 ? 's' : ''}</span>
      </div>
    )
  }

  return (
    <div style={{
      display: 'flex', gap: 8, alignItems: 'center', flexWrap: 'wrap',
      background: '#fff8f8', border: '1px solid #fecaca',
      borderRadius: 10, padding: '8px 14px', marginBottom: 12,
    }}>
      <span style={{ fontSize: 12, fontWeight: 700, color: '#b91c1c' }}>⚠ Conflicts today:</span>
      {roomCount    > 0 && <span style={{ fontSize: 11, background: '#fee2e2', color: '#b91c1c', border: '1px solid #fca5a5', borderRadius: 20, padding: '2px 10px', fontWeight: 600 }}>{roomCount} Room</span>}
      {sectionCount > 0 && <span style={{ fontSize: 11, background: '#fdf4ff', color: '#7e22ce', border: '1px solid #e9d5ff', borderRadius: 20, padding: '2px 10px', fontWeight: 600 }}>{sectionCount} Section</span>}
      {facultyCount > 0 && <span style={{ fontSize: 11, background: '#eff6ff', color: '#1d4ed8', border: '1px solid #bfdbfe', borderRadius: 20, padding: '2px 10px', fontWeight: 600 }}>{facultyCount} Faculty</span>}
      <span style={{ fontSize: 11, color: TV.muted, marginLeft: 4 }}>{conflictMap.size} affected session{conflictMap.size > 1 ? 's' : ''}</span>
    </div>
  )
}

// ── Legend ────────────────────────────────────────────────────────────────────
export function Legend() {
  const items = [
    { color: TV.muted,  border: TV.border, bg: '#fff',    label: 'Normal' },
    { color: TV.deep,   border: TV.light,  bg: TV.pale,   label: 'Merged Block' },
    { color: '#b91c1c', border: '#fca5a5', bg: '#fff5f5', label: 'Conflict' },
  ]
  return (
    <div style={{ display: 'flex', gap: 14, alignItems: 'center', flexWrap: 'wrap', fontSize: 11, color: TV.muted }}>
      {items.map(({ color, border, bg, label }) => (
        <span key={label} style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
          <span style={{ width: 12, height: 12, borderRadius: 3, background: bg, border: `2px solid ${border}`, flexShrink: 0, display: 'inline-block' }} />
          <span style={{ fontWeight: 500 }}>{label}</span>
        </span>
      ))}
      <span style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
        <span style={{ fontSize: 9, color: TV.muted }}>· Drag cards to reschedule</span>
      </span>
    </div>
  )
}

// ── Toast notification ────────────────────────────────────────────────────────
export function Toast({ message, type, onDismiss }) {
  const isErr = type === 'error'
  return (
    <div
      onClick={onDismiss}
      style={{
        position: 'fixed', bottom: 28, right: 28, zIndex: 9999,
        padding: '12px 18px', borderRadius: 12,
        background: isErr ? '#fef2f2' : '#f0fdf4',
        border: `1px solid ${isErr ? '#fecaca' : '#bbf7d0'}`,
        color: isErr ? '#b91c1c' : '#166534',
        fontSize: 13, fontWeight: 600, cursor: 'pointer',
        boxShadow: '0 8px 24px rgba(0,0,0,0.12)',
        animation: 'svSlideIn .25s ease',
        display: 'flex', alignItems: 'center', gap: 8, maxWidth: 380,
        fontFamily: 'Poppins, sans-serif',
      }}
    >
      <span>{isErr ? '⚠' : '✓'}</span>
      <span style={{ flex: 1 }}>{message}</span>
      <span style={{ opacity: .5, fontSize: 11 }}>click to dismiss</span>
    </div>
  )
}

// ── Conflict table ────────────────────────────────────────────────────────────
export function ConflictTable({ conflicts }) {
  if (!conflicts || conflicts.length === 0) return null
  return (
    <div style={{ overflowX: 'auto', border: '1px solid #fecaca', borderRadius: 8, marginTop: 8 }}>
      <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 11 }}>
        <thead>
          <tr style={{ background: '#fef2f2' }}>
            {['Course', 'Section', 'Day', 'Time', 'Room', 'Faculty', 'Type'].map(h => (
              <th key={h} style={{ padding: '6px 8px', textAlign: 'left', fontWeight: 700, color: '#991b1b', borderBottom: '1px solid #fecaca', whiteSpace: 'nowrap' }}>{h}</th>
            ))}
          </tr>
        </thead>
        <tbody>
          {conflicts.map((c, i) => {
            const id = c.schedule_id ?? `${c.courseCode}-${c.block}-${c.session}-${c.day}`
            return (
              <tr key={id} style={{ background: i % 2 === 0 ? '#fff' : '#fff8f8' }}>
                <td style={{ padding: '5px 8px', fontWeight: 600, whiteSpace: 'nowrap' }}>{c.courseCode}</td>
                <td style={{ padding: '5px 8px', whiteSpace: 'nowrap' }}>{c.program} {c.year}-{c.block}</td>
                <td style={{ padding: '5px 8px', whiteSpace: 'nowrap' }}>{c.day}</td>
                <td style={{ padding: '5px 8px', whiteSpace: 'nowrap', fontSize: 10 }}>{c.period}</td>
                <td style={{ padding: '5px 8px', whiteSpace: 'nowrap' }}>{c.room || '—'}</td>
                <td style={{ padding: '5px 8px', overflow: 'hidden', maxWidth: 100, textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{c.faculty || 'TBA'}</td>
                <td style={{ padding: '5px 8px' }}><ConflictBadge label={c.conflictLabel} /></td>
              </tr>
            )
          })}
        </tbody>
      </table>
    </div>
  )
}

// ── Room chip ─────────────────────────────────────────────────────────────────
export function RoomChip({ room, selected, hasRoomConflict, hasMergePreview = false, onClick }) {
  let bg, border, color, shadow
  if (selected && hasRoomConflict) {
    bg = '#dc2626'; border = '#b91c1c'; color = '#fff'; shadow = '0 0 0 2px rgba(220,38,38,.25)'
  } else if (selected && hasMergePreview) {
    bg = '#1d4ed8'; border = '#1d4ed8'; color = '#fff'; shadow = '0 0 0 2px rgba(37,99,235,.22)'
  } else if (selected) {
    bg = TV.deep; border = TV.deep; color = '#fff'; shadow = `0 0 0 2px rgba(124,111,205,.2)`
  } else if (hasRoomConflict) {
    bg = '#fef2f2'; border = '#fca5a5'; color = '#b91c1c'; shadow = 'none'
  } else if (hasMergePreview) {
    bg = '#eff6ff'; border = '#93c5fd'; color = '#1d4ed8'; shadow = '0 0 0 1.5px rgba(59,130,246,.18)'
  } else {
    bg = '#fff'; border = TV.border; color = TV.text; shadow = 'none'
  }
  return (
    <button
      onClick={onClick}
      title={
        hasRoomConflict ? '⚠ Room occupied at this time'
        : hasMergePreview ? '⊕ Would merge blocks at this time slot'
        : room
      }
      style={{
        padding: '4px 10px', borderRadius: 7, fontSize: 11,
        fontWeight: selected ? 700 : 400,
        background: bg, border: `1.5px solid ${border}`, color,
        cursor: 'pointer', transition: 'all .12s',
        whiteSpace: 'nowrap', display: 'flex', alignItems: 'center', gap: 3,
        boxShadow: shadow, fontFamily: 'Poppins, sans-serif',
      }}
    >
      {hasRoomConflict && <span style={{ fontSize: 9 }}>⚠</span>}
      {hasMergePreview && !hasRoomConflict && (
        <svg width={9} height={9} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
          <path d="M10 13a5 5 0 0 0 7.54.54l3-3a5 5 0 0 0-7.07-7.07l-1.72 1.71"/>
          <path d="M14 11a5 5 0 0 0-7.54-.54l-3 3a5 5 0 0 0 7.07 7.07l1.71-1.71"/>
        </svg>
      )}
      {room}
    </button>
  )
}

// ── Pending Changes Bar ───────────────────────────────────────────────────────
// Render this above the TimeGrid when pendingOverrides.size > 0.
// Wires up to saveAllOverrides / revertAllOverrides from useDragDrop.
export function PendingChangesBar({ pendingOverrides, onSave, onRevertAll, saving }) {
  const count = pendingOverrides.size
  if (count === 0) return null

  const labels = [...pendingOverrides.values()].map(o => o.label)

  return (
    <div style={{
      display: 'flex', alignItems: 'center', gap: 10, flexWrap: 'wrap',
      background: 'linear-gradient(135deg,#fffbeb,#fff7d6)',
      border: '1px solid #fcd34d',
      borderRadius: 10, padding: '8px 14px', marginBottom: 10,
      fontFamily: 'Poppins, sans-serif',
    }}>
      {/* Icon + count */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="#b45309" strokeWidth="2.5">
          <circle cx="12" cy="12" r="10"/><line x1="12" y1="8" x2="12" y2="12"/>
          <line x1="12" y1="16" x2="12.01" y2="16"/>
        </svg>
        <span style={{ fontSize: 12, fontWeight: 700, color: '#92400e', whiteSpace: 'nowrap' }}>
          {count} unsaved change{count !== 1 ? 's' : ''}
        </span>
      </div>

      {/* Scrollable change list */}
      <div style={{ flex: 1, overflow: 'hidden', minWidth: 0 }}>
        <span style={{ fontSize: 10.5, color: '#78350f', opacity: .8, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis', display: 'block' }}>
          {labels.join(' · ')}
        </span>
      </div>

      {/* Actions */}
      <div style={{ display: 'flex', gap: 6, flexShrink: 0 }}>
        <button
          onClick={onRevertAll}
          disabled={saving}
          style={{
            padding: '5px 13px', fontSize: 11.5, fontWeight: 600,
            background: '#fff', color: '#92400e',
            border: '1.5px solid #fcd34d', borderRadius: 7,
            cursor: saving ? 'not-allowed' : 'pointer',
            fontFamily: 'Poppins, sans-serif', opacity: saving ? .5 : 1,
            transition: 'all .15s',
          }}
        >
          Revert All
        </button>
        <button
          onClick={onSave}
          disabled={saving}
          style={{
            padding: '5px 14px', fontSize: 11.5, fontWeight: 700,
            background: saving
              ? '#d97706'
              : 'linear-gradient(135deg,#d97706,#b45309)',
            color: '#fff', border: 'none', borderRadius: 7,
            cursor: saving ? 'not-allowed' : 'pointer',
            fontFamily: 'Poppins, sans-serif',
            boxShadow: '0 3px 8px rgba(180,83,9,.30)',
            display: 'flex', alignItems: 'center', gap: 5,
            transition: 'all .15s',
          }}
        >
          {saving ? (
            <>
              <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="#fff" strokeWidth="2.5" style={{ animation: 'spin 1s linear infinite' }}>
                <path d="M21 12a9 9 0 1 1-6.219-8.56"/>
              </svg>
              Saving…
            </>
          ) : (
            <>
              <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="#fff" strokeWidth="2.5">
                <path d="M19 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h11l5 5v11a2 2 0 0 1-2 2z"/>
                <polyline points="17 21 17 13 7 13 7 21"/>
                <polyline points="7 3 7 8 15 8"/>
              </svg>
              Save Changes
            </>
          )}
        </button>
      </div>
    </div>
  )
}