import { useMemo, useState } from 'react'
import {
  TIME_SLOTS, GRID_START, SLOT_MINUTES,
  getEventId, parsePeriodRange, timeOverlaps,
} from './svHelpers'
import { TV } from './svPrimitives'
import SessionCard from './SessionCard'

/* ── Inject drag-glow styles once ──────────────────────────────────────────── */
if (!document.getElementById('tg-glow-style')) {
  const s = document.createElement('style')
  s.id = 'tg-glow-style'
  s.textContent = `
    @keyframes tg-conflict-glow {
      0%,100% { background:rgba(239,68,68,.05); box-shadow:inset 0 0 0 1px rgba(239,68,68,.14); }
      50%      { background:rgba(239,68,68,.13); box-shadow:inset 0 0 0 1px rgba(239,68,68,.32); }
    }
    @keyframes tg-merge-glow {
      0%,100% { background:rgba(124,111,205,.04); box-shadow:inset 0 0 0 1px rgba(124,111,205,.12); }
      50%      { background:rgba(124,111,205,.10); box-shadow:inset 0 0 0 1px rgba(124,111,205,.26); }
    }
    @keyframes tg-row-conflict {
      0%,100% { background:rgba(239,68,68,.04); border-right-color:rgba(239,68,68,.28); }
      50%      { background:rgba(239,68,68,.10); border-right-color:rgba(239,68,68,.50); }
    }
    .tg-cell-conflict { animation:tg-conflict-glow 1.7s ease-in-out infinite; }
    .tg-cell-merge    { animation:tg-merge-glow    1.7s ease-in-out infinite; }
    .tg-row-conflict  { animation:tg-row-conflict  1.7s ease-in-out infinite; }
  `
  document.head.appendChild(s)
}

// ── DIMENSIONS ────────────────────────────────────────────────────────────────
const TIME_COL_W      = 66
const ROOM_MIN_W      = 210   // normal
const COMPACT_ROOM_W  = 140
const NORMAL_SLOT     = 28
const COMPACT_SLOT    = 22
const GRID_HEIGHT     = 'calc(100vh - 230px)'
const SPREAD_PX       = 28

// ── Resolve dimensions from gridSize string ───────────────────────────────────
function resolveDims(gridSize) {
  if (gridSize === 'compact') return { slotH: COMPACT_SLOT, roomMinW: COMPACT_ROOM_W }
  return                             { slotH: NORMAL_SLOT,  roomMinW: ROOM_MIN_W     }
}

// ─────────────────────────────────────────────────────────────────────────────
function RoomColumn({
  room, dayEvents, conflictMap, draggedEvent, hoveredCell, getDropConflict,
  onDragStart, onDragEnd, onDragOver, onDragLeave, onDrop, onCardClick,
  gridSize, slotH,
  conflictingDragIds,
  ambientConflictIds,
  ambientMergeIds,
  mergedIds,
  preGlowCells,   // { conflict: Set<cellKey>, merge: Set<cellKey> }
}) {
  const compact    = gridSize === 'compact'
  const roomEvents = dayEvents.filter(e => e.room === room)
  const [hoveredId, setHoveredId] = useState(null)

  const overlapGroups = useMemo(() => {
    const assigned = new Set()
    const groups   = []
    roomEvents.forEach((ev, i) => {
      if (assigned.has(i)) return
      const evRange = parsePeriodRange(ev.period)
      const group   = [i]
      assigned.add(i)
      roomEvents.forEach((other, j) => {
        if (i === j || assigned.has(j)) return
        const oRange = parsePeriodRange(other.period)
        if (evRange && oRange && timeOverlaps(evRange, oRange)) {
          group.push(j); assigned.add(j)
        }
      })
      groups.push(group)
    })
    return groups
  }, [roomEvents])

  const spreadOffsets = useMemo(() => {
    if (!hoveredId) return {}
    const hovIdx = roomEvents.findIndex(e => getEventId(e) === hoveredId)
    if (hovIdx === -1) return {}
    const group = overlapGroups.find(g => g.includes(hovIdx))
    if (!group || group.length < 2) return {}
    const result = {}
    group.forEach((evIdx, i) => {
      const offset = (i - (group.length - 1) / 2) * SPREAD_PX * 2
      result[getEventId(roomEvents[evIdx])] = offset
    })
    return result
  }, [hoveredId, roomEvents, overlapGroups])

  const getOverlapIndex = (ev, idx) => {
    const evRange = parsePeriodRange(ev.period)
    if (!evRange) return 0
    let count = 0
    for (let j = 0; j < idx; j++) {
      const oRange = parsePeriodRange(roomEvents[j].period)
      if (oRange && timeOverlaps(evRange, oRange)) count++
    }
    return count
  }

  return (
    <div
      style={{ position: 'relative', flex: 1, minWidth: resolveDims(gridSize).roomMinW, height: '100%' }}
      onDragLeave={onDragLeave}
    >
      {/* Drop-target cells */}
      {TIME_SLOTS.map(slot => {
        const cellKey  = `${room}|${slot.startMinutes}`
        const isHov    = hoveredCell === cellKey
        const dropConf = isHov ? getDropConflict(room, slot) : null
        const isHour   = slot.startMinutes % 60 === 0

        // ── Pre-glow (when dragging but NOT currently hovering this cell) ──
        const isPreConflict = !isHov && !!draggedEvent && (preGlowCells?.conflict.has(cellKey) ?? false)
        const isPreMerge    = !isHov && !!draggedEvent && (preGlowCells?.merge.has(cellKey)    ?? false)

        // ── Detect merge-only hover: all overlapping events in this room are merge partners ──
        const hovRoomConflicts = (isHov && dropConf) ? roomEvents.filter(ev => {
          const range = parsePeriodRange(ev.period)
          return range && timeOverlaps(range, { start: slot.startMinutes, end: slot.startMinutes + SLOT_MINUTES })
        }) : []
        // It's truly a merge only if EVERY overlapping event is a merge partner
        // AND there's at least one (so the slot isn't just empty)
        const isHovMergeOnly = isHov && !!dropConf &&
          hovRoomConflicts.length > 0 &&
          hovRoomConflicts.every(ev => ambientMergeIds.has(getEventId(ev)))

        return (
          <div
            key={slot.startMinutes}
            onDragOver={e => onDragOver(e, room, slot)}
            onDrop={e => onDrop(e, room, slot)}
            className={isPreConflict ? 'tg-cell-conflict' : isPreMerge ? 'tg-cell-merge' : ''}
            style={{
              position: 'absolute',
              top: ((slot.startMinutes - GRID_START) / SLOT_MINUTES) * slotH,
              left: 0, right: 0, height: slotH,
              borderBottom: isHour
                ? `1px solid ${TV.border}`
                : `1px dashed rgba(200,196,230,.38)`,
              background: isHov
                ? isHovMergeOnly
                  ? 'rgba(124,111,205,.07)'   // merge hover → purple
                  : dropConf
                    ? 'rgba(239,68,68,.07)'   // conflict hover → red
                    : 'rgba(124,111,205,.05)' // clean hover → soft purple
                : 'transparent',
              transition: (isPreConflict || isPreMerge) ? 'none' : 'background .1s',
              zIndex: 1,
            }}
          >
            {isHov && (
              <div style={{
                position: 'absolute', inset: 2, borderRadius: 4,
                border: `1.5px dashed ${isHovMergeOnly ? TV.mid : dropConf ? '#ef4444' : TV.mid}`,
                display: 'flex', alignItems: 'center', justifyContent: 'center',
                pointerEvents: 'none',
              }}>
                {/* Merge-only hover label */}
                {isHovMergeOnly && (
                  <span style={{
                    fontSize: 8.5, fontWeight: 700, color: TV.deep,
                    background: '#fff', padding: '2px 6px', borderRadius: 4,
                    boxShadow: '0 2px 6px rgba(0,0,0,.08)',
                    display: 'inline-flex', alignItems: 'center', gap: 3,
                  }}>
                    <svg width={8} height={8} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" style={{display:'inline',verticalAlign:'middle'}}>
                      <path d="M10 13a5 5 0 0 0 7.54.54l3-3a5 5 0 0 0-7.07-7.07l-1.72 1.71"/>
                      <path d="M14 11a5 5 0 0 0-7.54-.54l-3 3a5 5 0 0 0 7.07 7.07l1.71-1.71"/>
                    </svg>
                    Merge — drop to merge
                  </span>
                )}
                {/* Real conflict hover label */}
                {!isHovMergeOnly && dropConf && (
                  <span style={{
                    fontSize: 8.5, fontWeight: 700, color: '#ef4444',
                    background: '#fff', padding: '2px 6px', borderRadius: 4,
                    boxShadow: '0 2px 6px rgba(0,0,0,.08)',
                  }}>
                    <svg width={8} height={8} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" style={{display:'inline',verticalAlign:'middle',marginRight:2}}>
                      <path d="M10.29 3.86L1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z"/>
                      <line x1="12" y1="9" x2="12" y2="13"/><line x1="12" y1="17" x2="12.01" y2="17"/>
                    </svg>
                    {dropConf.label} — drop to override
                  </span>
                )}
              </div>
            )}
          </div>
        )
      })}

      {/* Session cards */}
      {roomEvents.map((event, idx) => {
        const evId             = getEventId(event)
        const conflictInfo     = conflictMap.get(evId) ?? null
        const isDragging       = draggedEvent && getEventId(draggedEvent) === evId
        const isDimmed         = !!draggedEvent && !isDragging
        const overlapIndex     = getOverlapIndex(event, idx)
        const spreadOffset     = spreadOffsets[evId] ?? 0
        const isInHoveredGroup = evId in spreadOffsets
        const isConflictTarget = !isDragging && conflictingDragIds.has(evId)
        const isPotentialConflict = !isDragging && !!draggedEvent && ambientConflictIds.has(evId)
        const isPotentialMerge    = !isDragging && !!draggedEvent && ambientMergeIds.has(evId)
        // isMerged comes from the top-level mergedIds set (computed from ALL events,
        // never filtered) so it always reflects current state immediately after a drag
        const isMerged = mergedIds ? mergedIds.has(evId) : false

        return (
          // When another card is being dragged, make this card transparent to
          // pointer/drag events so the slot-drop-targets underneath are reachable.
          // The dragged card itself keeps pointer-events so it can be grabbed.
          <div
            key={evId}
            style={{ pointerEvents: isDimmed ? 'none' : 'auto' }}
          >
            <SessionCard
              event={event} conflictInfo={conflictInfo}
              isDragging={isDragging} isDimmed={isDimmed}
              compact={compact} slotH={slotH}
              onClick={onCardClick}
              onDragStart={e => onDragStart(e, event)} onDragEnd={onDragEnd}
              overlapIndex={overlapIndex}
              spreadOffset={spreadOffset}
              isInHoveredGroup={isInHoveredGroup}
              onHoverChange={hov => setHoveredId(hov ? evId : null)}
              isConflictTarget={isConflictTarget}
              isPotentialConflict={isPotentialConflict}
              isPotentialMerge={isPotentialMerge}
              isMerged={isMerged}
            />
          </div>
        )
      })}
    </div>
  )
}

// ─────────────────────────────────────────────────────────────────────────────
export default function TimeGrid({
  rooms, dayEvents, conflictMap,
  draggedEvent, hoveredCell, getDropConflict,
  onDragStart, onDragEnd, onDragOver, onDragLeave, onDrop,
  onCardClick,
  gridSize = 'normal',
  compact = false,
  conflictingDragIds = new Set(),
  ambientConflictIds = new Set(),
  ambientMergeIds    = new Set(),
  dragConflictBands  = [],
  fullscreen = false,
  mergedIds = null,   // Set<eventId> from ScheduleViewPage — always current
  allEvents = [],     // Unfiltered events to compute proper pre-glows when filters are active
}) {
  // Resolve gridSize from legacy compact prop when needed
  const resolvedSize = compact ? 'compact' : gridSize
  const { slotH, roomMinW } = resolveDims(resolvedSize)

  const totalH   = TIME_SLOTS.length * slotH
  const gridMinW = TIME_COL_W + rooms.length * roomMinW

  // ── Passive section conflict ranges ─────────────────────────────────────────
  const sectionConflictRanges = useMemo(() => {
    if (!draggedEvent?.program || !draggedEvent?.block || !draggedEvent?.year) return []
    const dragId = getEventId(draggedEvent)
    return allEvents // 👈 Use unfiltered allEvents
      .filter(ev =>
        ev.day === draggedEvent.day && // Ensure same day
        getEventId(ev) !== dragId &&
        ev.program === draggedEvent.program &&
        String(ev.year) === String(draggedEvent.year) &&
        ev.block === draggedEvent.block
      )
      .map(ev => parsePeriodRange(ev.period))
      .filter(Boolean)
  }, [draggedEvent, allEvents])

  // ── Passive faculty conflict ranges ─────────────────────────────────────────
  const facultyConflictRanges = useMemo(() => {
    if (!draggedEvent?.faculty || draggedEvent.faculty === 'TBA') return []
    const dragId = getEventId(draggedEvent)
    return allEvents // 👈 Use unfiltered allEvents
      .filter(ev =>
        ev.day === draggedEvent.day && // Ensure same day
        getEventId(ev) !== dragId &&
        ev.faculty === draggedEvent.faculty
      )
      .map(ev => parsePeriodRange(ev.period))
      .filter(Boolean)
  }, [draggedEvent, allEvents])

  // fullscreen = fills the fixed overlay (top bar 56px)
  const gridH = fullscreen ? 'calc(100vh - 56px)' : GRID_HEIGHT

  // ── Pre-glow cells: computed once per drag, not per hover ─────────────────
  const { preGlowCells, conflictSlots } = useMemo(() => {
    const empty = {
      preGlowCells: { conflict: new Set(), merge: new Set() },
      conflictSlots: { conflict: new Set(), merge: new Set() },
    }
    if (!draggedEvent || !allEvents || allEvents.length === 0) return empty

    const dragId    = getEventId(draggedEvent)
    const dragRange = parsePeriodRange(draggedEvent.period)
    if (!dragRange) return empty

    // 👈 Get all events on this day, completely ignoring active filters
    const unfilteredDayEvents = allEvents.filter(ev => ev.day === draggedEvent.day)

    const cellConf  = new Set()
    const cellMerge = new Set()
    const slotConf  = new Set()
    const slotMerge = new Set()

    rooms.forEach(room => {
      TIME_SLOTS.forEach(slot => {
        const cellKey  = `${room}|${slot.startMinutes}`
        const proposed = { start: slot.startMinutes, end: slot.startMinutes + dragRange.duration }

        let isConflict = false
        const roomEventsAtSlot = []

        for (const ev of unfilteredDayEvents) { // 👈 Loop over unfiltered events!
          if (getEventId(ev) === dragId) continue
          const r = parsePeriodRange(ev.period)
          if (!r || !timeOverlaps(proposed, r)) continue

          const roomC    = ev.room === room && room !== 'TBA'
          const sectionC = draggedEvent.program && ev.program === draggedEvent.program
              && String(ev.year) === String(draggedEvent.year)
              && ev.block === draggedEvent.block
          const facultyC = draggedEvent.faculty && draggedEvent.faculty !== 'TBA'
              && ev.faculty === draggedEvent.faculty

          if (roomC) roomEventsAtSlot.push(ev)

          const isMergePartner = ambientMergeIds.has(getEventId(ev))

          if (sectionC || facultyC || (roomC && !isMergePartner)) {
            isConflict = true
          }
        }

        if (isConflict) {
          cellConf.add(cellKey)
          slotConf.add(slot.startMinutes)
        } else if (roomEventsAtSlot.length > 0 && roomEventsAtSlot.every(ev => ambientMergeIds.has(getEventId(ev)))) {
          cellMerge.add(cellKey)
          slotMerge.add(slot.startMinutes)
        }
      })
    })

    return {
      preGlowCells: { conflict: cellConf, merge: cellMerge },
      conflictSlots: { conflict: slotConf, merge: slotMerge },
    }
  }, [draggedEvent, rooms, allEvents, ambientMergeIds])

  return (
    <div style={{ overflowX: 'auto', overflowY: 'auto', maxHeight: gridH, paddingBottom: 12 }}>
      <div style={{ minWidth: gridMinW }}>

        {/* ── HEADER ── */}
        <div style={{
          display: 'flex',
          background: 'linear-gradient(to bottom,#F7F6FD,#FAFAFE)',
          position: 'sticky', top: 0, zIndex: 30, flexShrink: 0,
        }}>
          <div style={{
            width: TIME_COL_W, flexShrink: 0,
            borderRight: `2px solid ${TV.border}`,
            position: 'sticky', left: 0, zIndex: 31,
            background: 'linear-gradient(to bottom,#F7F6FD,#FAFAFE)',
          }} />
          {rooms.map((room, idx) => (
            <div key={room} style={{
              flex: 1, minWidth: roomMinW,
              padding: resolvedSize === 'compact' ? '4px 8px' : '7px 12px',
              borderRight: idx < rooms.length - 1 ? `1px solid ${TV.border}` : 'none',
              display: 'flex', alignItems: 'center', gap: 6, overflow: 'hidden',
            }}>
              <div style={{ width: 5, height: 5, borderRadius: '50%', background: TV.deep, opacity: .6, flexShrink: 0 }} />
              <span style={{
                fontSize: resolvedSize === 'compact' ? 9.5 : 11, fontWeight: 700, color: TV.text,
                overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap',
                flex: 1, letterSpacing: '-0.2px',
              }}>
                {room}
              </span>
              <span style={{
                fontSize: 8, background: TV.pale, color: TV.deep,
                border: `1px solid ${TV.light}`, borderRadius: 20,
                padding: '1px 5px', fontWeight: 700, flexShrink: 0,
              }}>
                {dayEvents.filter(e => e.room === room).length}
              </span>
            </div>
          ))}
        </div>

        {/* ── BODY ── */}
        <div style={{ display: 'flex', position: 'relative', height: totalH }}>

          {/* Time labels */}
          <div style={{
            width: TIME_COL_W, flexShrink: 0,
            borderRight: `2px solid ${TV.border}`,
            position: 'sticky', left: 0, background: '#FAFAFE', zIndex: 20,
            boxShadow: '2px 0 6px rgba(0,0,0,0.03)',
          }}>
            {TIME_SLOTS.map(slot => {
              const isHour = slot.startMinutes % 60 === 0
              const top    = ((slot.startMinutes - GRID_START) / SLOT_MINUTES) * slotH
              let displayLabel = slot.label
              if (!isHour) {
                const h    = Math.floor(slot.startMinutes / 60)
                const m    = slot.startMinutes % 60
                const hr12 = h % 12 === 0 ? 12 : h % 12
                displayLabel = `${hr12}:${m}`
              }
              const isRowConflict = !!draggedEvent && conflictSlots.conflict.has(slot.startMinutes)
              const isRowMerge    = !!draggedEvent && !isRowConflict && conflictSlots.merge.has(slot.startMinutes)
              return (
                <div key={slot.startMinutes}
                  className={isRowConflict ? 'tg-row-conflict' : ''}
                  style={{
                    position: 'absolute', top, height: slotH, width: '100%',
                    display: 'flex', alignItems: 'flex-start',
                    justifyContent: 'flex-end', paddingRight: 8,
                    paddingTop: resolvedSize === 'compact' ? 1 : 3,
                    borderBottom: isHour
                      ? `1px solid ${TV.border}`
                      : `1px dashed rgba(200,196,230,.65)`,
                    borderRight: isRowConflict ? '3px solid rgba(239,68,68,.40)' : isRowMerge ? `3px solid rgba(124,111,205,.30)` : undefined,
                    transition: 'border-color .1s',
                  }}>
                  {isHour ? (
                    <span style={{ fontSize: resolvedSize === 'compact' ? 8.5 : 10, fontWeight: 700, color: isRowConflict ? '#ef4444' : isRowMerge ? TV.deep : TV.deep, lineHeight: 1, whiteSpace: 'nowrap' }}>
                      {slot.label}
                    </span>
                  ) : (
                    <span style={{ fontSize: resolvedSize === 'compact' ? 7.5 : 8.5, fontWeight: 600, color: isRowConflict ? '#ef4444' : TV.deep, opacity: isRowConflict ? 1 : .85, lineHeight: 1, whiteSpace: 'nowrap' }}>
                      {displayLabel}
                    </span>
                  )}
                </div>
              )
            })}
          </div>

          {/* Room columns */}
          {rooms.map((room, idx) => (
            <div key={room} style={{
              flex: 1, minWidth: roomMinW,
              borderRight: idx < rooms.length - 1 ? `1px solid ${TV.border}` : 'none',
              position: 'relative',
              overflow: 'visible',
            }}>
              <RoomColumn
                room={room} dayEvents={dayEvents} conflictMap={conflictMap}
                draggedEvent={draggedEvent} hoveredCell={hoveredCell}
                getDropConflict={getDropConflict}
                onDragStart={onDragStart} onDragEnd={onDragEnd}
                onDragOver={onDragOver} onDragLeave={onDragLeave} onDrop={onDrop}
                onCardClick={onCardClick}
                gridSize={resolvedSize} slotH={slotH}
                conflictingDragIds={conflictingDragIds}
                ambientConflictIds={ambientConflictIds}
                ambientMergeIds={ambientMergeIds}
                mergedIds={mergedIds}
                preGlowCells={preGlowCells}
              />
            </div>
          ))}

          {/* ── Passive section conflict bands ── */}
          {draggedEvent && sectionConflictRanges.map((range, i) => {
            const bandTop = ((range.start - GRID_START) / SLOT_MINUTES) * slotH
            const bandH   = ((range.end - range.start) / SLOT_MINUTES) * slotH
            return (
              <div key={`sc-${i}`} style={{
                position: 'absolute', left: 0, right: 0, top: bandTop, height: bandH,
                background: 'rgba(239,68,68,.04)',
                borderTop: '1px solid rgba(239,68,68,.18)',
                borderBottom: '1px solid rgba(239,68,68,.18)',
                pointerEvents: 'none', zIndex: 5,
              }}>
                <div style={{ position: 'absolute', left: 0, top: 0, bottom: 0, width: 2, background: 'rgba(239,68,68,.28)' }} />
              </div>
            )
          })}

          {/* ── Passive faculty conflict bands ── */}
          {draggedEvent && facultyConflictRanges.map((range, i) => {
            const bandTop = ((range.start - GRID_START) / SLOT_MINUTES) * slotH
            const bandH   = ((range.end - range.start) / SLOT_MINUTES) * slotH
            return (
              <div key={`fc-${i}`} style={{
                position: 'absolute', left: 0, right: 0, top: bandTop, height: bandH,
                background: 'rgba(29,78,216,.03)',
                borderTop: '1px solid rgba(29,78,216,.15)',
                borderBottom: '1px solid rgba(29,78,216,.15)',
                pointerEvents: 'none', zIndex: 5,
              }}>
                <div style={{ position: 'absolute', right: 0, top: 0, bottom: 0, width: 2, background: 'rgba(29,78,216,.22)' }} />
              </div>
            )
          })}

          {/* ── Active drag conflict bands ── */}
          {dragConflictBands.map((band, i) => {
            const bandTop = ((band.start - GRID_START) / SLOT_MINUTES) * slotH
            const bandH   = ((band.end - band.start) / SLOT_MINUTES) * slotH
            const both    = band.section && band.faculty
            const bg      = both         ? 'rgba(249,115,22,.10)'
                          : band.section ? 'rgba(239,68,68,.10)'
                          : 'rgba(29,78,216,.08)'
            const border  = both         ? '#f97316'
                          : band.section ? '#ef4444'
                          : '#3b82f6'
            return (
              <div key={`dcb-${i}`} style={{
                position: 'absolute', left: 0, right: 0,
                top: bandTop, height: bandH,
                background: bg,
                borderTop:    `2px solid ${border}55`,
                borderBottom: `2px solid ${border}55`,
                pointerEvents: 'none', zIndex: 12,
              }}>
                <div style={{ position: 'absolute', left: 0, top: 0, bottom: 0, width: 3, background: `${border}88` }} />
                <div style={{ position: 'absolute', right: 0, top: 0, bottom: 0, width: 3, background: `${border}88` }} />
                <div style={{
                  position: 'absolute', left: '50%', top: '50%',
                  transform: 'translate(-50%,-50%)',
                  background: '#fff',
                  border: `1px solid ${border}44`,
                  borderRadius: 4,
                  padding: '1px 8px',
                  fontSize: 8, fontWeight: 700,
                  color: border,
                  whiteSpace: 'nowrap',
                  boxShadow: '0 2px 6px rgba(0,0,0,.07)',
                  pointerEvents: 'none',
                  opacity: bandH < 20 ? 0 : 1,
                }}>
                  <svg width={9} height={9} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" style={{display:'inline',verticalAlign:'middle',marginRight:3}}><path d="M10.29 3.86L1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z"/><line x1="12" y1="9" x2="12" y2="13"/><line x1="12" y1="17" x2="12.01" y2="17"/></svg>{band.label}
                </div>
              </div>
            )
          })}

        </div>
      </div>
    </div>
  )
}