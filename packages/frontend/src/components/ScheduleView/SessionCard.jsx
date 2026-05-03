import { useState } from 'react'
import { programColor, getEventStyle, SLOT_HEIGHT } from './svHelpers'
import { TV } from './svPrimitives'

export default function SessionCard({
  event, onClick, conflictInfo, isDragging, isDimmed,
  onDragStart, onDragEnd, compact, slotH = SLOT_HEIGHT, overlapIndex = 0,
  spreadOffset = 0,
  isInHoveredGroup = false,
  onHoverChange,
  // true when this event currently has a merge partner (same room/day/period)
  isMerged = false,
  // true when the currently-dragged card would conflict with this card at the hovered drop target
  isConflictTarget = false,
  // true when ANY drag is in progress and this card shares section/faculty → ambient red pre-glow
  isPotentialConflict = false,
  // true when ANY drag is in progress and this card could be merged → ambient blue pre-glow
  isPotentialMerge = false,
  // called when another card is dropped directly onto this card (stack gesture)
  onDropOnCard,
}) {
  const [isHovered,     setIsHovered]     = useState(false)
  // visual state: another card is being dragged over THIS card (stack target)
  const [isStackTarget, setIsStackTarget] = useState(false)

  const clr    = programColor(event.program)
  const { top, height } = getEventStyle(event.period, slotH)
  const merged = isMerged

  // ── Unassigned faculty detection ────────────────────────────────────────────
  const isUnassigned = !event.faculty || event.faculty === 'TBA'

  // ── THEME ──────────────────────────────────────────────────────────────────
  let accentColor, bgGradient, borderColor, badgeBg, textColor, glowColor

  if (isStackTarget) {
    // Being targeted for a stack-drop — vivid emerald ring
    accentColor = '#059669'
    bgGradient  = 'linear-gradient(160deg,#f0fdf4 0%,#fff 100%)'
    borderColor = '#6ee7b7'
    badgeBg     = 'rgba(5,150,105,.08)'
    textColor   = '#065f46'
    glowColor   = 'rgba(16,185,129,.40)'
  } else if (isConflictTarget && !isDragging) {
    accentColor = '#dc2626'
    bgGradient  = 'linear-gradient(160deg,#fff5f5 0%,#fff 100%)'
    borderColor = '#fca5a5'
    badgeBg     = 'rgba(239,68,68,.08)'
    textColor   = '#b91c1c'
    glowColor   = 'rgba(239,68,68,.45)'
  } else if (isPotentialMerge && !isDragging) {
    // Ambient blue: could be merged with the dragged card
    accentColor = '#2563eb'
    bgGradient  = 'linear-gradient(160deg,#eff6ff 0%,#fff 100%)'
    borderColor = '#93c5fd'
    badgeBg     = 'rgba(37,99,235,.07)'
    textColor   = '#1d4ed8'
    glowColor   = 'rgba(59,130,246,.40)'
  } else if (isPotentialConflict && !isDragging) {
    // Ambient red: shares section/faculty with the dragged card
    accentColor = '#dc2626'
    bgGradient  = 'linear-gradient(160deg,#fff8f8 0%,#fff 100%)'
    borderColor = '#fca5a5'
    badgeBg     = 'rgba(239,68,68,.06)'
    textColor   = '#b91c1c'
    glowColor   = 'rgba(239,68,68,.32)'
  } else if (conflictInfo) {
    accentColor = '#ef4444'; bgGradient = 'linear-gradient(160deg,#fff8f8 0%,#fff 100%)'
    borderColor = '#fca5a5'; badgeBg = 'rgba(239,68,68,.08)'; textColor = '#b91c1c'
    glowColor   = 'rgba(239,68,68,.30)'
  } else if (merged) {
    accentColor = TV.deep; bgGradient = `linear-gradient(160deg,#F0EEFB 0%,#fafaff 100%)`
    borderColor = TV.mid;  badgeBg    = `rgba(124,111,205,.10)`; textColor = TV.deep
    glowColor   = 'rgba(124,111,205,.35)'
  } else {
    accentColor = clr.border; bgGradient = `linear-gradient(160deg,${clr.bg} 0%,#fff 100%)`
    borderColor = clr.border; badgeBg    = `rgba(0,0,0,.04)`; textColor = clr.text
    glowColor   = 'rgba(0,0,0,.18)'
  }

  const noSelect = {
    userSelect: 'none', WebkitUserSelect: 'none',
    WebkitTapHighlightColor: 'transparent', outline: 'none',
  }

  const sectionStr = event.program && event.year && event.block
    ? `${event.program} ${event.year}-${event.block}`
    : event.block || ''
  const isLab = event.session?.toUpperCase().includes('LAB')
  const sessionType = isLab ? 'LAB' : 'LEC'

  const hOffset = overlapIndex * 10
  const vOffset = overlapIndex * 4

  let tx = 0, ty = 0, sc = 1
  if (isStackTarget) {
    sc = 1.03; ty = -3
  } else if (isInHoveredGroup && !isDragging) {
    tx = spreadOffset
    ty = isHovered ? -4 : -1
    sc = isHovered ? 1.02 : 1.005
  } else if (isDragging) {
    sc = 0.95
  }
  const transform = `translate(${tx}px,${ty}px) scale(${sc})`
  const cardH     = Math.max(height - vOffset, 24)

  const handleEnter = () => { setIsHovered(true);  onHoverChange?.(true)  }
  const handleLeave = () => { setIsHovered(false); onHoverChange?.(false) }

  // Stack-drop handlers — fire only when a drag is in progress over this card
  const handleDragOverCard = e => {
    if (!onDropOnCard) return
    e.preventDefault()
    e.stopPropagation()
    setIsStackTarget(true)
  }
  const handleDragLeaveCard = () => setIsStackTarget(false)
  const handleDropOnCard = e => {
    if (!onDropOnCard) return
    e.preventDefault()
    e.stopPropagation()
    setIsStackTarget(false)
    onDropOnCard(e, event)
  }

  const zIndex = isDragging ? 2000 : isHovered ? 1200 : isConflictTarget ? 1100 : isStackTarget ? 1150 : isInHoveredGroup ? 900 : 10 + overlapIndex

  // ── Box shadows — visibly pumped up for all states ──────────────────────────
  const baseShadow   = `0 1px 4px rgba(0,0,0,.08), 0 0 0 0.5px ${borderColor}66`
  const hoverShadow  = `0 14px 42px ${glowColor}, 0 3px 12px rgba(0,0,0,.10), 0 0 0 2px ${accentColor}55`
  const groupShadow  = `0 5px 16px ${glowColor}, 0 0 0 1.5px ${borderColor}99`
  const conflictRing = `0 0 0 2.5px #dc2626, 0 0 0 5px rgba(220,38,38,.28), 0 6px 28px rgba(239,68,68,.50)`
  const stackRing    = `0 0 0 2.5px #059669, 0 0 0 5px rgba(16,185,129,.28), 0 6px 28px rgba(16,185,129,.45)`
  const ambientConflictRing = `0 0 0 1.5px #fca5a5, 0 0 0 3.5px rgba(220,38,38,.18), 0 4px 16px rgba(239,68,68,.30)`
  const ambientMergeRing    = `0 0 0 1.5px #93c5fd, 0 0 0 3.5px rgba(59,130,246,.18), 0 4px 16px rgba(37,99,235,.28)`

  function computeShadow() {
    if (isStackTarget)                        return stackRing
    if (isConflictTarget && !isDragging)      return conflictRing
    if (isPotentialMerge && !isDragging)      return isHovered ? `0 0 0 2px #3b82f6, 0 0 0 5px rgba(59,130,246,.28), 0 6px 28px rgba(37,99,235,.45)` : ambientMergeRing
    if (isPotentialConflict && !isDragging)   return isHovered ? conflictRing : ambientConflictRing
    if (isHovered)                            return hoverShadow
    if (isInHoveredGroup)                     return groupShadow
    return baseShadow
  }

  // ── UNASSIGNED BADGE icon (amber) ───────────────────────────────────────────
  // Shown in both compact and normal modes; visible even on tiny cards
  const UnassignedDot = () => (
    <span
      title="Faculty unassigned"
      style={{
        display: 'inline-flex', alignItems: 'center', justifyContent: 'center',
        width: compact ? 10 : 12, height: compact ? 10 : 12,
        borderRadius: '50%',
        background: 'rgba(245,158,11,.15)',
        border: '1px solid #f59e0b',
        flexShrink: 0,
      }}
    >
      {/* person-question-mark icon */}
      <svg
        width={compact ? 6 : 7} height={compact ? 6 : 7}
        viewBox="0 0 24 24" fill="none"
        stroke="#d97706" strokeWidth="2.5"
        strokeLinecap="round" strokeLinejoin="round"
      >
        <path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2"/>
        <circle cx="12" cy="7" r="4"/>
        <line x1="12" y1="23" x2="12.01" y2="23"/>
      </svg>
    </span>
  )

  // ─────────────────────────────────────────────────────────────────────────────
  // ── COMPACT MODE ─────────────────────────────────────────────────────────────
  // ─────────────────────────────────────────────────────────────────────────────
  if (compact) {
    const compactCardH = Math.max(height - vOffset - 2, 22)
    return (
      <div
        draggable
        onDragStart={onDragStart} onDragEnd={onDragEnd}
        onDragOver={handleDragOverCard}
        onDragLeave={handleDragLeaveCard}
        onDrop={handleDropOnCard}
        onClick={() => onClick(event)}
        onMouseEnter={handleEnter} onMouseLeave={handleLeave}
        style={{
          ...noSelect, position: 'absolute',
          left: `calc(${hOffset}px + 3px)`,
          width: `calc(100% - ${hOffset + 6}px)`,
          top: top + vOffset,
          height: compactCardH,
          background: bgGradient,
          border: `1px solid ${borderColor}`,
          borderLeft: `3px solid ${accentColor}`,
          borderRadius: 5,
          display: 'flex', flexDirection: 'column',
          justifyContent: compactCardH > 35 ? 'space-between' : 'flex-start',
          gap: compactCardH > 35 ? 0 : 2,
          padding: '3px 6px 3px',
          cursor: 'grab', overflow: 'hidden',
          boxShadow: computeShadow(),
          opacity: isDimmed ? 0.32 : isDragging ? 0.55 : 1,
          transform,
          transition: 'all .18s ease-out',
          zIndex,
        }}
      >
        {/* Stack target overlay stripe */}
        {isStackTarget && (
          <div style={{
            position: 'absolute', inset: 0, borderRadius: 5,
            background: 'rgba(16,185,129,.06)',
            border: '2px dashed #10b981',
            pointerEvents: 'none', zIndex: 1,
          }} />
        )}

        <div style={{ display: 'flex', alignItems: 'baseline', gap: 4, overflow: 'hidden', minWidth: 0 }}>
          <span style={{
            fontSize: 11.5, fontWeight: 800, color: textColor,
            letterSpacing: '-0.4px', lineHeight: 1, whiteSpace: 'nowrap', flexShrink: 0,
          }}>
            {event.courseCode}
          </span>
          {sectionStr && (
            <span style={{
              fontSize: 8.5, fontWeight: 600, color: textColor, opacity: 0.55,
              whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis', lineHeight: 1,
            }}>
              {sectionStr}
            </span>
          )}
          {isUnassigned && <UnassignedDot />}
        </div>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 4 }}>
          <span style={{ fontSize: 8, fontWeight: 600, color: textColor, opacity: 0.75, whiteSpace: 'nowrap', lineHeight: 1 }}>
            {event.period?.replace(/\s*[AP]M/g, '').trim()}
          </span>
          <span style={{
            fontSize: 7, fontWeight: 800, letterSpacing: '0.5px',
            color: isLab ? TV.deep : textColor,
            background: isLab ? `rgba(124,111,205,.12)` : badgeBg,
            border: `1px solid ${isLab ? TV.mid : borderColor}`,
            padding: '0.5px 4px', borderRadius: 3, lineHeight: 1.4, flexShrink: 0,
          }}>
            {sessionType}
          </span>
        </div>
      </div>
    )
  }

  // ─────────────────────────────────────────────────────────────────────────────
  // ── NORMAL / MAXIMIZE MODE ───────────────────────────────────────────────────
  // ─────────────────────────────────────────────────────────────────────────────
  return (
    <div
      draggable
      onDragStart={onDragStart} onDragEnd={onDragEnd}
      onDragOver={handleDragOverCard}
      onDragLeave={handleDragLeaveCard}
      onDrop={handleDropOnCard}
      onClick={() => onClick(event)}
      onMouseEnter={handleEnter} onMouseLeave={handleLeave}
      style={{
        ...noSelect, position: 'absolute',
        left: `calc(${hOffset}px + 4px)`,
        width: `calc(100% - ${hOffset + 8}px)`,
        top: top + vOffset,
        height: cardH,
        background: bgGradient,
        border: `1px solid ${borderColor}`,
        borderLeft: `4px solid ${accentColor}`,
        borderRadius: 7,
        padding: '5px 8px 4px',
        cursor: isDragging ? 'grabbing' : 'grab',
        overflow: 'hidden',
        boxShadow: computeShadow(),
        opacity: isDimmed ? 0.25 : isDragging ? 0.5 : 1,
        transform,
        transition: isDragging ? 'opacity .12s ease' : 'all .18s ease-out',
        zIndex,
        display: 'flex', flexDirection: 'column', gap: 0,
      }}
    >
      {/* Conflict-target overlay stripe */}
      {isConflictTarget && !isDragging && (
        <div style={{
          position: 'absolute', inset: 0, borderRadius: 7,
          background: 'rgba(220,38,38,.04)',
          pointerEvents: 'none', zIndex: 1,
        }} />
      )}

      {/* Stack-target overlay stripe */}
      {isStackTarget && (
        <div style={{
          position: 'absolute', inset: 0, borderRadius: 7,
          background: 'rgba(16,185,129,.05)',
          border: '2px dashed #10b981',
          pointerEvents: 'none', zIndex: 1,
          display: 'flex', alignItems: 'center', justifyContent: 'center',
        }}>
          <span style={{
            fontSize: 8, fontWeight: 800, color: '#059669',
            background: '#fff', padding: '2px 8px', borderRadius: 4,
            boxShadow: '0 2px 6px rgba(0,0,0,.08)',
          }}>
            ⊕ Stack here
          </span>
        </div>
      )}

      <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: 4 }}>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 0, minWidth: 0, flex: 1 }}>
          <span style={{
            fontSize: 11.5, fontWeight: 800, color: textColor,
            letterSpacing: '-0.4px', lineHeight: 1.05,
            whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis',
          }}>
            {event.courseCode}
          </span>
          {sectionStr && (
            <span style={{
              fontSize: 7.5, fontWeight: 700, color: textColor,
              opacity: 0.5, lineHeight: 1.1, marginTop: 1,
              whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis', letterSpacing: '0.1px',
            }}>
              {sectionStr}
            </span>
          )}
          {event.title && height > 50 && (
            <span style={{
              fontSize: 8.5, fontWeight: 500, color: textColor, opacity: 0.70,
              lineHeight: 1.25, marginTop: 2, overflow: 'hidden',
              display: '-webkit-box', WebkitLineClamp: height > 72 ? 2 : 1, WebkitBoxOrient: 'vertical',
            }}>
              {event.title}
            </span>
          )}
        </div>

        <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-end', gap: 3, flexShrink: 0 }}>
          <span style={{
            fontSize: 6.5, fontWeight: 800, letterSpacing: '0.7px',
            background: isLab ? `rgba(124,111,205,.12)` : badgeBg,
            border: `1px solid ${isLab ? TV.mid : borderColor}`,
            color: isLab ? TV.deep : textColor,
            padding: '1.5px 5px', borderRadius: 4,
          }}>
            {sessionType}
          </span>
          <div style={{ display: 'flex', gap: 3, alignItems: 'center' }}>
            {/* ── Unassigned faculty icon ── */}
            {isUnassigned && <UnassignedDot />}

            {merged && (
              <span title="Merged Block" style={{ color: TV.deep, display: 'flex' }}>
                <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                  <path d="M10 13a5 5 0 0 0 7.54.54l3-3a5 5 0 0 0-7.07-7.07l-1.72 1.71" />
                  <path d="M14 11a5 5 0 0 0-7.54-.54l-3 3a5 5 0 0 0 7.07 7.07l1.71-1.71" />
                </svg>
              </span>
            )}
            {isPotentialMerge && !isDragging && (
              <span title="Could merge with dragged card" style={{ color: '#2563eb', display: 'flex' }}>
                <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                  <path d="M10 13a5 5 0 0 0 7.54.54l3-3a5 5 0 0 0-7.07-7.07l-1.72 1.71" />
                  <path d="M14 11a5 5 0 0 0-7.54-.54l-3 3a5 5 0 0 0 7.07 7.07l1.71-1.71" />
                </svg>
              </span>
            )}
            {(isConflictTarget || isPotentialConflict) && !isDragging && (
              <span title={isConflictTarget ? "Would conflict with dragged card" : "Potential conflict with dragged card"} style={{ color: '#dc2626', display: 'flex' }}>
                <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                  <path d="M10.29 3.86L1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z" />
                  <line x1="12" y1="9" x2="12" y2="13" /><line x1="12" y1="17" x2="12.01" y2="17" />
                </svg>
              </span>
            )}
            {conflictInfo && !isConflictTarget && !isPotentialConflict && (
              <span title={`Conflict: ${conflictInfo.label}`} style={{ color: '#ef4444', display: 'flex' }}>
                <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                  <path d="M10.29 3.86L1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z" />
                  <line x1="12" y1="9" x2="12" y2="13" /><line x1="12" y1="17" x2="12.01" y2="17" />
                </svg>
              </span>
            )}
          </div>
        </div>
      </div>

      {/* ── FOOTER ── */}
      <div style={{
        marginTop: height > 58 ? 'auto' : 2,
        display: 'flex', justifyContent: 'space-between', alignItems: 'center',
        paddingTop: height > 58 ? 4 : 0,
        borderTop: height > 58 ? `1px solid ${accentColor}1A` : 'none',
        gap: 6,
      }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 3, minWidth: 0 }}>
          {height > 58 && (
            <svg width="8" height="8" viewBox="0 0 24 24" fill="none" stroke={textColor} strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" style={{ opacity: .5, flexShrink: 0 }}>
              <circle cx="12" cy="12" r="10"/><polyline points="12 6 12 12 16 14"/>
            </svg>
          )}
          <span style={{ fontSize: height > 58 ? 8 : 7.5, fontWeight: 600, color: textColor, opacity: height > 58 ? .65 : .75, whiteSpace: 'nowrap' }}>
            {height > 58 ? event.period : event.period?.replace(/\s*[AP]M/g, '').trim()}
          </span>
        </div>

        {/* Faculty row — amber label if unassigned */}
        {height > 45 && (
          <div style={{ display: 'flex', alignItems: 'center', gap: 3, minWidth: 0, overflow: 'hidden' }}>
            {isUnassigned ? (
              <span style={{
                fontSize: height > 58 ? 8 : 7.5, fontWeight: 700,
                color: '#d97706', opacity: 0.9,
                whiteSpace: 'nowrap',
              }}>
                Unassigned
              </span>
            ) : (
              <>
                {height > 58 && (
                  <svg width="8" height="8" viewBox="0 0 24 24" fill="none" stroke={textColor} strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" style={{ opacity: .5, flexShrink: 0 }}>
                    <path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2"/><circle cx="12" cy="7" r="4"/>
                  </svg>
                )}
                <span style={{ fontSize: height > 58 ? 8 : 7.5, fontWeight: 600, color: textColor, opacity: height > 58 ? .60 : .55, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                  {height > 58 ? event.faculty : event.faculty?.split(' ').pop()}
                </span>
              </>
            )}
          </div>
        )}
      </div>
    </div>
  )
}