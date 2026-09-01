import { useState } from 'react'
import { sectionColor, getEventStyle, SLOT_HEIGHT } from './svHelpers'
import { TV } from './svPrimitives'

export default function SessionCard({
  event, onClick, conflictInfo, isDragging, isDimmed,
  onDragStart, onDragEnd, compact, slotH = SLOT_HEIGHT, overlapIndex = 0,
  spreadOffset = 0,
  isInHoveredGroup = false,
  onHoverChange,
  isMerged = false,
  isConflictTarget = false,
  isPotentialConflict = false,
  isPotentialMerge = false,
  onDropOnCard,
  locked = false,
  isAmbient = false,
}) {
  const [isHovered,     setIsHovered]     = useState(false)
  const [isStackTarget, setIsStackTarget] = useState(false)

  // ── Use section-aware color — block A = shade 0, B = shade 1, etc. ─────────
  const clr    = sectionColor(event.program, event.block)
  // `accent` is the vivid left-stripe colour (bold, clearly different per block).
  // `border` is the subtle card outline. Fall back gracefully if palette is old.
  const stripeColor = clr.accent ?? clr.border
  const { top, height } = getEventStyle(event.period, slotH)
  const merged = isMerged

  // ── Unassigned faculty detection ─────────────────────────────────────────
  const isUnassigned = !event.faculty || event.faculty === 'TBA'

  // ── THEME — solid, saturated card fills ────────────────────────────────────
  let accentColor, bgGradient, borderColor, badgeBg, textColor, glowColor

  if (isStackTarget) {
    accentColor = 'var(--meadow)'
    bgGradient  = 'linear-gradient(160deg,var(--meadow-soft) 0%,var(--hover) 100%)'
    borderColor = 'var(--mint)'
    badgeBg     = 'rgba(5,150,105,.12)'
    textColor   = 'var(--meadow-deep)'
    glowColor   = 'rgba(16,185,129,.40)'
  } else if (isConflictTarget && !isDragging) {
    accentColor = '#EF4444'
    bgGradient  = 'linear-gradient(160deg,#fee2e2 0%,#fff5f5 100%)'
    borderColor = '#fca5a5'
    badgeBg     = 'rgba(239,68,68,.10)'
    textColor   = '#FCA5A5'
    glowColor   = 'rgba(239,68,68,.45)'
  } else if (isPotentialMerge && !isDragging) {
    accentColor = '#60A5FA'
    bgGradient  = 'linear-gradient(160deg,#dbeafe 0%,#eff6ff 100%)'
    borderColor = '#93c5fd'
    badgeBg     = 'rgba(37,99,235,.10)'
    textColor   = '#1e40af'
    glowColor   = 'rgba(59,130,246,.40)'
  } else if (isPotentialConflict && !isDragging) {
    accentColor = '#EF4444'
    bgGradient  = 'linear-gradient(160deg,#fee2e2 0%,#fff5f5 100%)'
    borderColor = '#fca5a5'
    badgeBg     = 'rgba(239,68,68,.08)'
    textColor   = '#FCA5A5'
    glowColor   = 'rgba(239,68,68,.32)'
  } else if (conflictInfo) {
    accentColor = '#ef4444'; bgGradient = 'linear-gradient(160deg,#fee2e2 0%,#fff5f5 100%)'
    borderColor = '#fca5a5'; badgeBg = 'rgba(239,68,68,.10)'; textColor = '#FCA5A5'
    glowColor   = 'rgba(239,68,68,.30)'
  } else if (merged) {
    accentColor = TV.deep; bgGradient = `linear-gradient(160deg,var(--meadow-border) 0%,var(--meadow-soft) 100%)`
    borderColor = TV.mid;  badgeBg    = `rgba(0,0,0,.12)`; textColor = 'var(--meadow-deep)'
    glowColor   = 'rgba(0,0,0,.35)'
  } else {
    // Normal state — solid saturated program tint, no white washout
    accentColor = stripeColor
    bgGradient  = `linear-gradient(160deg,${clr.bg} 0%,${clr.bg}ee 100%)`
    borderColor = clr.border
    badgeBg     = `${clr.accent}18`
    textColor   = clr.text
    glowColor   = `${stripeColor}55`
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

  const handleDragOverCard = e => {
    if (!onDropOnCard || locked) return
    e.preventDefault()
    e.stopPropagation()
    setIsStackTarget(true)
  }
  const handleDragLeaveCard = () => setIsStackTarget(false)
  const handleDropOnCard = e => {
    if (!onDropOnCard || locked) return
    e.preventDefault()
    e.stopPropagation()
    setIsStackTarget(false)
    onDropOnCard(e, event)
  }

  const zIndex = isDragging ? 2000 : isHovered ? 1200 : isConflictTarget ? 1100 : isStackTarget ? 1150 : isInHoveredGroup ? 900 : 10 + overlapIndex

  const baseShadow   = `0 1px 3px rgba(0,0,0,.10), 0 0 0 0.5px ${borderColor}88`
  const hoverShadow  = `0 12px 36px ${glowColor}, 0 3px 10px rgba(0,0,0,.12), 0 0 0 2px ${accentColor}66`
  const groupShadow  = `0 5px 16px ${glowColor}, 0 0 0 1.5px ${borderColor}99`
  const conflictRing = `0 0 0 2.5px #dc2626, 0 0 0 5px rgba(220,38,38,.28), 0 6px 28px rgba(239,68,68,.50)`
  const stackRing    = `0 0 0 2.5px var(--meadow), 0 0 0 5px rgba(16,185,129,.28), 0 6px 28px rgba(16,185,129,.45)`
  const ambientConflictRing = `0 0 0 1.5px #fca5a5, 0 0 0 3.5px rgba(220,38,38,.18), 0 4px 16px rgba(239,68,68,.30)`
  const ambientMergeRing    = `0 0 0 1.5px #93c5fd, 0 0 0 3.5px rgba(59,130,246,.18), 0 4px 16px rgba(37,99,235,.28)`

  function computeShadow() {
    if (isAmbient) return 'none'
    if (isStackTarget)                        return stackRing
    if (isConflictTarget && !isDragging)      return conflictRing
    if (isPotentialMerge && !isDragging)      return isHovered ? `0 0 0 2px #3b82f6, 0 0 0 5px rgba(59,130,246,.28), 0 6px 28px rgba(37,99,235,.45)` : ambientMergeRing
    if (isPotentialConflict && !isDragging)   return isHovered ? conflictRing : ambientConflictRing
    if (isHovered)                            return hoverShadow
    if (isInHoveredGroup)                     return groupShadow
    return baseShadow
  }

  const UnassignedDot = () => (
    <span
      title="Faculty unassigned"
      style={{
        display: 'inline-flex', alignItems: 'center', justifyContent: 'center',
        width: compact ? 8 : 12, height: compact ? 8 : 12,
        borderRadius: '50%',
        background: 'rgba(245,158,11,.18)',
        border: '1px solid #f59e0b',
        flexShrink: 0,
      }}
    >
      <svg
        width={compact ? 5 : 7} height={compact ? 5 : 7}
        viewBox="0 0 24 24" fill="none"
        stroke='#F59E0B' strokeWidth="2.5"
        strokeLinecap="round" strokeLinejoin="round"
      >
        <path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2"/>
        <circle cx="12" cy="7" r="4"/>
        <line x1="12" y1="23" x2="12.01" y2="23"/>
      </svg>
    </span>
  )

  // ─────────────────────────────────────────────────────────────────────────
  // ── COMPACT MODE — ultra-tight, single-row layout ───────────────────────
  if (compact) {
    const compactCardH = Math.max(height - vOffset - 2, 16)
    const isTiny = compactCardH < 24
    return (
      <div
        draggable={!locked}
        onDragStart={locked ? undefined : onDragStart}
        onDragEnd={locked ? undefined : onDragEnd}
        onDragOver={handleDragOverCard}
        onDragLeave={handleDragLeaveCard}
        onDrop={handleDropOnCard}
        onClick={() => onClick(event)}
        onMouseEnter={handleEnter} onMouseLeave={handleLeave}
        style={{
          ...noSelect, position: 'absolute',
          left: `calc(${hOffset}px + 2px)`,
          width: `calc(100% - ${hOffset + 4}px)`,
          top: top + vOffset,
          height: compactCardH,
          background: bgGradient,
          border: `1px solid ${borderColor}`,
          borderLeft: `3px solid ${accentColor}`,
          borderRadius: 4,
          display: 'flex', alignItems: 'center',
          gap: 3,
          padding: isTiny ? '0 4px' : '1px 5px',
          cursor: locked ? 'default' : 'grab', overflow: 'hidden',
          boxShadow: computeShadow(),
          opacity: isDimmed ? 0.32 : isDragging ? 0.55 : event._isOtherProgram ? 0.35 : 1,
          transform,
          transition: 'all .15s ease-out',
          zIndex,
        }}
      >
        {isStackTarget && (
          <div style={{
            position: 'absolute', inset: 0, borderRadius: 4,
            background: 'rgba(16,185,129,.06)',
            border: '2px dashed #10b981',
            pointerEvents: 'none', zIndex: 1,
          }} />
        )}

        {/* Course code — always visible */}
        <span style={{
          fontSize: isTiny ? 8.5 : 10, fontWeight: 800, color: textColor,
          letterSpacing: '-0.3px', lineHeight: 1, whiteSpace: 'nowrap', flexShrink: 0,
        }}>
          {event.courseCode}
        </span>

        {/* Section — shrink-to-fit */}
        {sectionStr && !isTiny && (
          <span style={{
            fontSize: 7.5, fontWeight: 600, color: textColor, opacity: 0.6,
            whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis',
            lineHeight: 1, flex: 1, minWidth: 0,
          }}>
            {sectionStr}
          </span>
        )}

        {/* Right-side info cluster */}
        <div style={{ marginLeft: 'auto', display: 'flex', alignItems: 'center', gap: 2, flexShrink: 0 }}>
          {isUnassigned && <UnassignedDot />}
          {event.block && (
            <span style={{
              fontSize: 6, fontWeight: 900,
              background: accentColor,
              color: clr.badgeText ?? '#fff',
              borderRadius: 2, padding: '0 3px', lineHeight: 1.4, flexShrink: 0,
            }}>
              {event.block}
            </span>
          )}
          <span style={{
            fontSize: 6, fontWeight: 800, letterSpacing: '0.3px',
            color: isLab ? '#fff' : textColor,
            background: isLab ? TV.deep : badgeBg,
            border: isLab ? 'none' : `1px solid ${borderColor}`,
            padding: '0 3px', borderRadius: 2, lineHeight: 1.4, flexShrink: 0,
          }}>
            {sessionType}
          </span>
        </div>
      </div>
    )
  }

  // ─────────────────────────────────────────────────────────────────────────
  // ── NORMAL / MAXIMIZE MODE — rich, solid cards ──────────────────────────
  return (
    <div
      draggable={!locked}
      onDragStart={locked ? undefined : onDragStart}
      onDragEnd={locked ? undefined : onDragEnd}
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
        cursor: locked ? 'default' : isDragging ? 'grabbing' : 'grab',
        overflow: 'hidden',
        boxShadow: computeShadow(),
        opacity: isDimmed ? 0.25 : isDragging ? 0.5 : event._isOtherProgram ? 0.35 : 1,
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
            fontSize: 8, fontWeight: 800, color: 'var(--meadow)',
            background: 'var(--surface)', padding: '2px 8px', borderRadius: 4,
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
              opacity: 0.6, lineHeight: 1.1, marginTop: 1,
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
          {/* Session type badge */}
          <span style={{
            fontSize: 6.5, fontWeight: 800, letterSpacing: '0.7px',
            background: isLab ? TV.deep : badgeBg,
            border: isLab ? 'none' : `1px solid ${borderColor}`,
            color: isLab ? '#fff' : textColor,
            padding: '1.5px 5px', borderRadius: 4,
          }}>
            {sessionType}
          </span>
          {/* Block letter badge — filled with the accent stripe colour */}
          {event.block && (
            <span style={{
              fontSize: 7.5, fontWeight: 900, letterSpacing: '0.3px',
              background: accentColor,
              color: clr.badgeText ?? '#fff',
              padding: '1px 6px', borderRadius: 4,
              lineHeight: 1.4, flexShrink: 0,
            }}>
              {event.block}
            </span>
          )}
          <div style={{ display: 'flex', gap: 3, alignItems: 'center' }}>
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
              <span title="Could merge with dragged card" style={{ color: '#60A5FA', display: 'flex' }}>
                <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                  <path d="M10 13a5 5 0 0 0 7.54.54l3-3a5 5 0 0 0-7.07-7.07l-1.72 1.71" />
                  <path d="M14 11a5 5 0 0 0-7.54-.54l-3 3a5 5 0 0 0 7.07 7.07l1.71-1.71" />
                </svg>
              </span>
            )}
            {(isConflictTarget || isPotentialConflict) && !isDragging && (
              <span title={isConflictTarget ? "Would conflict with dragged card" : "Potential conflict with dragged card"} style={{ color: '#EF4444', display: 'flex' }}>
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
        borderTop: height > 58 ? `1px solid ${accentColor}22` : 'none',
        gap: 6,
      }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 3, minWidth: 0 }}>
          {height > 58 && (
            <svg width="8" height="8" viewBox="0 0 24 24" fill="none" stroke={textColor} strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" style={{ opacity: .55, flexShrink: 0 }}>
              <circle cx="12" cy="12" r="10"/><polyline points="12 6 12 12 16 14"/>
            </svg>
          )}
          <span style={{ fontSize: height > 58 ? 8 : 7.5, fontWeight: 600, color: textColor, opacity: height > 58 ? .7 : .8, whiteSpace: 'nowrap' }}>
            {height > 58 ? event.period : event.period?.replace(/\s*[AP]M/g, '').trim()}
          </span>
        </div>

        {height > 45 && (
          <div style={{ display: 'flex', alignItems: 'center', gap: 3, minWidth: 0, overflow: 'hidden' }}>
            {isUnassigned ? (
              <span style={{
                fontSize: height > 58 ? 8 : 7.5, fontWeight: 700,
                color: '#F59E0B', opacity: 0.9,
                whiteSpace: 'nowrap',
              }}>
                Unassigned
              </span>
            ) : (
              <>
                {height > 58 && (
                  <svg width="8" height="8" viewBox="0 0 24 24" fill="none" stroke={textColor} strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" style={{ opacity: .55, flexShrink: 0 }}>
                    <path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2"/><circle cx="12" cy="7" r="4"/>
                  </svg>
                )}
                <span style={{ fontSize: height > 58 ? 8 : 7.5, fontWeight: 600, color: textColor, opacity: height > 58 ? .65 : .6, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
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