import React, { useMemo, useState, useRef, useEffect, useLayoutEffect, useReducer, memo } from 'react'
import {
  SLOT_MINUTES, buildTimeSlots,
  getEventId, parsePeriodRange, timeOverlaps, isOnlineRoom,
} from './svHelpers'
import { getTime, coordGetSettings } from '../../services/api'
import { TV } from './svPrimitives'
import SessionCard from './SessionCard'
import { makeHoverDerived } from './svHooks'

/* ── Inject drag-glow styles once ──────────────────────────────────────────── */
if (!document.getElementById('tg-glow-style')) {
  const s = document.createElement('style')
  s.id = 'tg-glow-style'
  s.textContent = `
    /* tg-cell-conflict / tg-cell-merge / tg-cell-available used to animate
       background + box-shadow directly. Those force a repaint every frame,
       and while dragging there can be 50-100+ of these lit up at once across
       the grid — real, sustained main-thread cost for the whole drag. Fixed
       by keeping the resting ("low") glow static on a ::before layer and
       only animating a ::after layer's opacity for the pulse to "high" —
       opacity is compositor-only, so any number of these animate for free.
       Same colors, same timing, same look — just a cheaper property. */
    @keyframes tg-pulse-opacity { 0%,100% { opacity:0 } 50% { opacity:1 } }

    .tg-cell-conflict::before, .tg-cell-merge::before, .tg-cell-available::before {
      content:''; position:absolute; inset:0; pointer-events:none;
    }
    .tg-cell-conflict::before  { background:rgba(239,68,68,.05);   box-shadow:inset 0 0 0 1px rgba(239,68,68,.14); }
    .tg-cell-merge::before     { background:rgba(0,0,0,.04);       box-shadow:inset 0 0 0 1px rgba(0,0,0,.12); }
    .tg-cell-available::before { background:rgba(0,0,0,.05);       box-shadow:inset 0 0 0 1px rgba(0,0,0,.15); }

    .tg-cell-conflict::after, .tg-cell-merge::after, .tg-cell-available::after {
      content:''; position:absolute; inset:0; pointer-events:none;
      opacity:0; animation:tg-pulse-opacity 1.7s ease-in-out infinite;
    }
    .tg-cell-conflict::after  { background:rgba(239,68,68,.13);    box-shadow:inset 0 0 0 1px rgba(239,68,68,.32); }
    .tg-cell-merge::after     { background:rgba(59,130,246,.13);   box-shadow:inset 0 0 0 1px rgba(59,130,246,.32); }
    .tg-cell-available::after {
      background:rgba(110,231,183,.20); box-shadow:inset 0 0 0 1px rgba(0,0,0,.34);
      animation-duration:2.4s;
    }

    /* Row-label glow (time column, left edge) — one instance per conflicting
       time slot, not multiplied per room, so its cost is far smaller. Left
       as a direct color animation. */
    @keyframes tg-row-conflict {
      0%,100% { background:rgba(239,68,68,.04); border-right-color:rgba(239,68,68,.28); }
      50%      { background:rgba(239,68,68,.10); border-right-color:rgba(239,68,68,.50); }
    }
    .tg-row-conflict { animation:tg-row-conflict 1.7s ease-in-out infinite; }

    /* Hide link/split buttons from the native HTML5 drag ghost image */
    .tg-card:active .tg-action-btn { opacity: 0 !important; }
  `
  document.head.appendChild(s)
}

/* ── Inject auto-scroll drop-zone styles once ──────────────────────────────── */
if (!document.getElementById('tg-autoscroll-style')) {
  const s = document.createElement('style')
  s.id = 'tg-autoscroll-style'
  s.textContent = `
    .tg-as-box { position:absolute; inset:0; pointer-events:none; z-index:2001; overflow:hidden; }
    .tg-as {
      position:absolute; display:flex; pointer-events:none;
      opacity:.7; transition:opacity .15s ease, background .15s ease;
    }
    .tg-as.tg-as-off { opacity:0; }
    .tg-as-left  { align-items:center; justify-content:flex-start; padding-left:10px;
                   background:linear-gradient(to right,  color-mix(in srgb, var(--meadow) 14%, transparent), transparent);
                   border-left:2px dashed color-mix(in srgb, var(--meadow) 45%, transparent); }
    .tg-as-right { align-items:center; justify-content:flex-end; padding-right:10px;
                   background:linear-gradient(to left,   color-mix(in srgb, var(--meadow) 14%, transparent), transparent);
                   border-right:2px dashed color-mix(in srgb, var(--meadow) 45%, transparent); }
    .tg-as-up    { align-items:flex-start; justify-content:center; padding-top:10px;
                   background:linear-gradient(to bottom, color-mix(in srgb, var(--meadow) 14%, transparent), transparent);
                   border-top:2px dashed color-mix(in srgb, var(--meadow) 45%, transparent); }
    .tg-as-down  { align-items:flex-end; justify-content:center; padding-bottom:10px;
                   background:linear-gradient(to top,    color-mix(in srgb, var(--meadow) 14%, transparent), transparent);
                   border-bottom:2px dashed color-mix(in srgb, var(--meadow) 45%, transparent); }
    .tg-as.tg-as-on.tg-as-left  { background:linear-gradient(to right,  color-mix(in srgb, var(--meadow) 30%, transparent), transparent); }
    .tg-as.tg-as-on.tg-as-right { background:linear-gradient(to left,   color-mix(in srgb, var(--meadow) 30%, transparent), transparent); }
    .tg-as.tg-as-on.tg-as-up    { background:linear-gradient(to bottom, color-mix(in srgb, var(--meadow) 30%, transparent), transparent); }
    .tg-as.tg-as-on.tg-as-down  { background:linear-gradient(to top,    color-mix(in srgb, var(--meadow) 30%, transparent), transparent); }
    .tg-as-on { opacity:1; }
    .tg-as-chev {
      width:28px; height:28px; border-radius:50%;
      display:flex; align-items:center; justify-content:center;
      background:var(--surface); color:var(--meadow);
      border:1px solid var(--border);
      box-shadow:0 2px 8px rgba(0,0,0,.12);
      transition:transform .15s ease, background .15s ease, color .15s ease;
    }
    .tg-as-on .tg-as-chev { transform:scale(1.15); background:var(--meadow); color:#fff; border-color:var(--meadow); }
    .tg-as-right .tg-as-chev svg { transform:rotate(180deg); }
    .tg-as-up    .tg-as-chev svg { transform:rotate(90deg); }
    .tg-as-down  .tg-as-chev svg { transform:rotate(-90deg); }
  `
  document.head.appendChild(s)
}

/* ── Inject perf styles once ───────────────────────────────────────────────── */
if (!document.getElementById('tg-perf-style')) {
  const s = document.createElement('style')
  s.id = 'tg-perf-style'
  s.textContent = `
    /* When a drag lights up lots of cells, hundreds of independently animated
       pseudo-elements each become their own compositor layer (and force every
       card above them into one too). Past a threshold the grid gets this class
       and the glow stays lit but stops pulsing. Few cells = pulse as before. */
    .tg-glow-static .tg-cell-conflict::after,
    .tg-glow-static .tg-cell-merge::after,
    .tg-glow-static .tg-cell-available::after { animation:none; opacity:.55; }
    /* The row-label glow animates background/border-color (main-thread paint every
       frame, unlike the opacity pulse), so it goes static in the same mode. */
    .tg-glow-static .tg-row-conflict { animation:none; background:rgba(239,68,68,.07); border-right-color:rgba(239,68,68,.40); }

    /* Drag dimming + pointer-events live in CSS now. Flipping ONE class on the grid
       replaces re-rendering every card with an isDimmed prop and 200+ inline styles. */
    .tg-card-ghost { opacity:0 !important; pointer-events:none !important; }
    .tg-grid-dragging .tg-card { opacity:var(--tg-dim,.25); pointer-events:none; transition:none !important; }
    .tg-grid-dragging .tg-card.tg-card-drag { opacity:var(--tg-drag,.5); }
    .tg-glow-run { position:absolute; left:0; right:0; pointer-events:none; z-index:1; }
  `
  document.head.appendChild(s)
}

// ── DIMENSIONS ────────────────────────────────────────────────────────────────
const TIME_COL_W      = 66
const ROOM_MIN_W      = 210   // normal
const COMPACT_ROOM_W  = 120
const NORMAL_SLOT     = 28
const COMPACT_SLOT    = 17
const GRID_HEIGHT     = 'calc(100vh - 230px)'
const SPREAD_PX       = 28

// Auto-scroll drop-zones (shown only while a session is being dragged)
const AS_SIDE_L   = 72    // left zone width, measured from the edge of the sticky time column
const AS_SIDE_R   = 96    // right zone width
const AS_TOP      = 64    // top zone height, measured from the bottom of the sticky header
const AS_BOTTOM   = 76    // bottom zone height
const AS_MIN_SPEED = 3    // px per frame right at the inner edge of a zone
const AS_MAX_SPEED = 26   // px per frame at the outer edge of a zone
const AS_DIRS     = ['left', 'right', 'up', 'down']


// ── Hover-store subscription helpers ─────────────────────────────────────────
// Shared constants so default props don't create a new Set/array every render
// (which would defeat React.memo on the room columns).
const EMPTY_SET = new Set()
const EMPTY_ARR = []
const NOOP_SUB  = () => () => {}
const GLOW_STATIC_THRESHOLD = 40   // counted in cells; runs of cells animate as one, so this is now very conservative

// Re-renders the calling component only when getValue()'s result changes.
// (Hand-rolled instead of useSyncExternalStore so it works on any React 16.8+.)
function useStoreValue(subscribe, getValue) {
  const [, force] = useReducer(c => c + 1, 0)
  const getRef = useRef(getValue)
  getRef.current = getValue
  const value = getValue()
  const valueRef = useRef(value)
  valueRef.current = value
  useLayoutEffect(() => {
    const check = () => { if (!Object.is(getRef.current(), valueRef.current)) force() }
    const unsub = subscribe(check)
    check()   // catch a change that landed between render and subscribe
    return unsub
  }, [subscribe])
  return value
}

// hover value is "room|slotMinutes" — which slot (if any) is hovered in `room`
function slotForRoom(hv, room) {
  if (!hv) return null
  const i = hv.lastIndexOf('|')
  if (i < 0 || hv.slice(0, i) !== room) return null
  return parseInt(hv.slice(i + 1), 10)
}

// Renders the drag-conflict bands. Live mode subscribes to the hover store so
// TimeGrid itself doesn't have to re-render on every hover change.
function BandsFrom({ derived, fallback, children }) {
  const live = useStoreValue(
    derived ? derived.subscribe : NOOP_SUB,
    () => (derived ? derived.getBands() : EMPTY_ARR),
  )
  return <>{children(derived ? live : fallback)}</>
}

// ── Resolve dimensions from gridSize string ───────────────────────────────────
function resolveDims(gridSize) {
  if (gridSize === 'compact') return { slotH: COMPACT_SLOT, roomMinW: COMPACT_ROOM_W }
  return                             { slotH: NORMAL_SLOT,  roomMinW: ROOM_MIN_W     }
}

// ── Grid lines as ONE background instead of 1 div per slot ───────────────────
// (21 rooms x 28 slots = ~600 absolutely positioned, z-indexed divs before.)
const _gridBgCache = new Map()
function gridLinesBg(slotH) {
  let v = _gridBgCache.get(slotH)
  if (v) return v
  const dash = encodeURIComponent(
    `<svg xmlns='http://www.w3.org/2000/svg' width='7' height='${slotH * 2}'>` +
    `<line x1='0' y1='${slotH * 2 - 0.5}' x2='7' y2='${slotH * 2 - 0.5}' stroke='rgba(180,220,195,.38)' stroke-width='1' stroke-dasharray='4 3'/></svg>`
  )
  v = {
    backgroundImage:
      `url("data:image/svg+xml,${dash}"), ` +
      `linear-gradient(to bottom, transparent ${slotH - 1}px, ${TV.border} ${slotH - 1}px, ${TV.border} ${slotH}px, transparent ${slotH}px)`,
    backgroundSize: `7px ${slotH * 2}px, 100% ${slotH * 2}px`,
    backgroundRepeat: 'repeat-x repeat-y, repeat-y',
  }
  _gridBgCache.set(slotH, v)
  return v
}

// Consecutive slots in the same state become ONE div (runs), not one div each.
function buildRuns(timeSlots, slotH, gridStart, stateOf) {
  const runs = []
  let cur = null
  for (let i = 0; i < timeSlots.length; i++) {
    const st = stateOf(timeSlots[i])
    if (st && cur && cur.st === st) { cur.n++; continue }
    if (cur) runs.push(cur)
    cur = st ? { st, top: ((timeSlots[i].startMinutes - gridStart) / SLOT_MINUTES) * slotH, n: 1 } : null
  }
  if (cur) runs.push(cur)
  return runs
}

// The pre-glow / available highlights for one room, as a handful of run divs.
const GlowRuns = React.memo(function GlowRuns({
  room, timeSlots, gridStart, slotH, dragging, preGlowCells, availableSlotSet,
}) {
  const runs = useMemo(() => buildRuns(timeSlots, slotH, gridStart, slot => {
    const key = `${room}|${slot.startMinutes}`
    if (dragging) {
      if (preGlowCells?.conflict.has(key)) return 'tg-cell-conflict'
      if (preGlowCells?.merge.has(key))    return 'tg-cell-merge'
      return null
    }
    return availableSlotSet?.has(slot.startMinutes) ? 'tg-cell-available' : null
  }), [room, timeSlots, slotH, gridStart, dragging, preGlowCells, availableSlotSet])
  if (runs.length === 0) return null
  return (
    <>
      {runs.map(r => (
        <div key={r.top} className={`tg-glow-run ${r.st}`} style={{ top: r.top, height: r.n * slotH }} />
      ))}
    </>
  )
})

// The ONLY per-hover DOM: one highlight box for the hovered slot of this room.
// A hover change re-renders this tiny component in two columns and nothing else.
const HoverCell = React.memo(function HoverCell({
  room, timeSlots, gridStart, slotH, ambientMergeIds, roomEvents, getDropConflict,
  hoverStore, hoveredSlotProp,
}) {
  const liveSlot = useStoreValue(
    hoverStore ? hoverStore.subscribe : NOOP_SUB,
    () => (hoverStore ? slotForRoom(hoverStore.get(), room) : null),
  )
  const hoveredSlot = hoverStore ? liveSlot : hoveredSlotProp
  if (hoveredSlot == null || Number.isNaN(hoveredSlot)) return null
  const slot = timeSlots.find(sl => sl.startMinutes === hoveredSlot)
  if (!slot) return null

  const dropConf = getDropConflict(room, slot)
  const hovRoomConflicts = dropConf ? roomEvents.filter(ev => {
    const range = parsePeriodRange(ev.period)
    return range && timeOverlaps(range, { start: slot.startMinutes, end: slot.startMinutes + SLOT_MINUTES })
  }) : []
  const isHovMergeOnly = !!dropConf && hovRoomConflicts.length > 0 &&
    hovRoomConflicts.every(ev => ambientMergeIds.has(getEventId(ev)))

  return (
    <div style={{
      position: 'absolute', left: 0, right: 0, zIndex: 1, pointerEvents: 'none',
      top: ((slot.startMinutes - gridStart) / SLOT_MINUTES) * slotH, height: slotH,
      background: isHovMergeOnly ? 'rgba(59,130,246,.15)' : dropConf ? 'rgba(239,68,68,.07)' : 'rgba(0,0,0,.05)',
    }}>
      <div style={{
        position: 'absolute', inset: 2, borderRadius: 4,
        border: `1.5px dashed ${isHovMergeOnly ? TV.mid : dropConf ? '#ef4444' : TV.mid}`,
        display: 'flex', alignItems: 'center', justifyContent: 'center',
        pointerEvents: 'none',
      }}>
        {isHovMergeOnly && (
          <span style={{
            fontSize: 8.5, fontWeight: 700, color: TV.deep,
            background: 'var(--surface)', padding: '2px 6px', borderRadius: 4,
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
        {!isHovMergeOnly && dropConf && (
          <span style={{
            fontSize: 8.5, fontWeight: 700, color: '#ef4444',
            background: 'var(--surface)', padding: '2px 6px', borderRadius: 4,
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
    </div>
  )
})

// ─────────────────────────────────────────────────────────────────────────────
const RoomColumnMemo = React.memo(function RoomColumn({
  room, dayEvents, conflictMap, draggedEvent, onMergeEvent, onSplitEvent, splitCounts, hoveredSlot: hoveredSlotProp, getDropConflict,
  onDragStart, onDragEnd, onDragOver, onDragEnter, onDragLeave, onDrop, onCardClick,
  gridSize, slotH, locked,
  conflictingDragIds: conflictingDragIdsProp,
  hoverStore, hoverDerived,   // set when the page opts into isolated hover
  ambientConflictIds,
  ambientMergeIds,
  mergedIds,
  preGlowCells,   // { conflict: Set<cellKey>, merge: Set<cellKey> }
  availabilityMap,     // Map<room, {start,end}[]> — TRUE free ranges, from unfiltered allEvents
  highlightAvailable,  // bool — "Available Rooms" toggle is on
  timeSlots,
  gridStart,
}) {
  const compact    = gridSize === 'compact'

  // Isolated-hover mode: this column re-renders only when the SET of conflicting
  // cards changes. The hovered slot is handled inside <HoverCell>.
  const liveConflictIds = useStoreValue(
    hoverDerived ? hoverDerived.subscribe : NOOP_SUB,
    () => (hoverDerived ? hoverDerived.getIds() : EMPTY_SET),
  )
  const conflictingDragIds = hoverDerived ? liveConflictIds : conflictingDragIdsProp
  const roomEvents = useMemo(() => dayEvents.filter(e => e.room === room), [dayEvents, room])
  const [hoveredId, setHoveredId] = useState(null)
  // Stable per-event hover callbacks: without this, SessionCard's onHoverChange
  // prop was a brand-new arrow function on every render of this column, which
  // silently defeated SessionCard's React.memo() for every card in it.
  const hoverCallbacksRef = useRef(new Map())
  const getHoverCallback = (id) => {
    const cache = hoverCallbacksRef.current
    let fn = cache.get(id)
    if (!fn) {
      fn = (hov) => setHoveredId(hov ? id : null)
      cache.set(id, fn)
    }
    return fn
  }

  // Slots that are genuinely free for this room, computed from the room's
  // real (unfiltered) free ranges — never from the filtered dayEvents/roomEvents
  // above. This is what makes the glow stay correct even when a session/program/
  // faculty filter is hiding the event that's actually occupying a slot.
  const availableSlotSet = useMemo(() => {
    if (!highlightAvailable) return null
    const ranges = availabilityMap?.get(room)
    if (!ranges || ranges.length === 0) return new Set()
    const set = new Set()
    timeSlots.forEach(slot => {
      const slotEnd = slot.startMinutes + SLOT_MINUTES
      if (ranges.some(r => slot.startMinutes >= r.start && slotEnd <= r.end)) {
        set.add(slot.startMinutes)
      }
    })
    return set
  }, [highlightAvailable, availabilityMap, room])

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

  // Per-card derived flags. Depends only on the data, NOT on drag/hover state, so a
  // re-render caused by conflict highlighting reuses it instead of re-scanning
  // dayEvents (and re-parsing period strings) for every card.
  const cardMeta = useMemo(() => roomEvents.map((event, idx) => {
    const evId  = getEventId(event)
    const range = parsePeriodRange(event.period)
    let overlapIndex = 0
    if (range) {
      for (let j = 0; j < idx; j++) {
        const oRange = parsePeriodRange(roomEvents[j].period)
        if (oRange && timeOverlaps(range, oRange)) overlapIndex++
      }
    }
    const isMatch = (e) => (
      e.courseCode === event.courseCode &&
      e.program === event.program &&
      String(e.year) === String(event.year) &&
      e.block === event.block &&
      e.day === event.day &&
      e.room === event.room &&
      getEventId(e) !== evId
    )
    const canMerge = !locked && !event._isReadonly && range
    const canMergeNext = !!(canMerge && dayEvents.find(e => isMatch(e) && parsePeriodRange(e.period)?.start === range.end))
    const prevEventToMerge = canMerge ? dayEvents.find(e => isMatch(e) && parsePeriodRange(e.period)?.end === range.start) : null
    const splitKey = `${event.courseCode}|${event.program}|${event.year}|${event.block}|${event.session}`
    const canSplit = !locked && !event._isReadonly && range && range.duration > 30 && splitCounts && splitCounts[splitKey] === 1
    return { overlapIndex, canMergeNext, prevEventToMerge, canSplit }
  }), [roomEvents, dayEvents, locked, splitCounts])

  // Slot from cursor Y. Cards are pointer-events:none while dragging, so the column
  // itself is the event target and offsetY is already relative to it.
  const slotFromEvent = (e) => {
    const y = e.target === e.currentTarget
      ? e.nativeEvent.offsetY
      : e.clientY - e.currentTarget.getBoundingClientRect().top
    const i = Math.min(timeSlots.length - 1, Math.max(0, Math.floor(y / slotH)))
    return timeSlots[i]
  }

  return (
    <div
      style={{
        position: 'relative', flex: 1, minWidth: resolveDims(gridSize).roomMinW, height: '100%',
        ...gridLinesBg(slotH),
        // Own stacking context per column: hit testing and painting can skip the other
        // 20 columns instead of sorting every card in the grid. The column with a
        // hovered stack sits above its neighbours so the spread cards aren't hidden.
        zIndex: hoveredId ? 60 : 0,
      }}
      onDragEnter={onDragEnter ? (e => onDragEnter(e, room, slotFromEvent(e))) : undefined}
      onDragOver={e => onDragOver(e, room, slotFromEvent(e))}
      onDrop={e => onDrop(e, room, slotFromEvent(e))}
      onDragLeave={onDragLeave}
    >
      <GlowRuns
        room={room} timeSlots={timeSlots} gridStart={gridStart} slotH={slotH}
        dragging={!!draggedEvent} preGlowCells={preGlowCells} availableSlotSet={availableSlotSet}
      />
      <HoverCell
        room={room} timeSlots={timeSlots} gridStart={gridStart} slotH={slotH}
        ambientMergeIds={ambientMergeIds} roomEvents={roomEvents} getDropConflict={getDropConflict}
        hoverStore={hoverStore} hoveredSlotProp={hoveredSlotProp}
      />

      {/* Session cards */}
      {roomEvents.map((event, idx) => {
        const evId             = getEventId(event)
        const conflictInfo     = conflictMap.get(evId) ?? null
        const isDragging       = draggedEvent && getEventId(draggedEvent) === evId
        const { overlapIndex, canMergeNext, prevEventToMerge, canSplit } = cardMeta[idx]
        const spreadOffset     = spreadOffsets[evId] ?? 0
        const isInHoveredGroup = evId in spreadOffsets
        const isConflictTarget = !isDragging && conflictingDragIds.has(evId)
        const isPotentialConflict = !isDragging && !!draggedEvent && ambientConflictIds.has(evId)
        const isPotentialMerge    = !isDragging && !!draggedEvent && ambientMergeIds.has(evId)
        // isMerged comes from the top-level mergedIds set (computed from ALL events,
        // never filtered) so it always reflects current state immediately after a drag
        const isMerged = mergedIds ? mergedIds.has(evId) : false
        
        return (
          // Dimming and pointer-events:none while dragging come from the
          // .tg-grid-dragging class on the grid, not from per-card props.
            <SessionCard
              key={evId}
              event={event} conflictInfo={conflictInfo}
              isDragging={isDragging}
              compact={compact} slotH={slotH} gridStart={gridStart}
              onClick={onCardClick}
              onDragStart={onDragStart} onDragEnd={onDragEnd}
              locked={locked || event._isReadonly}
              overlapIndex={overlapIndex}
              spreadOffset={spreadOffset}
              isInHoveredGroup={isInHoveredGroup}
              onHoverChange={getHoverCallback(evId)}
              isConflictTarget={isConflictTarget}
              isPotentialConflict={isPotentialConflict}
              isPotentialMerge={isPotentialMerge}
              isMerged={isMerged}
              canMergeNext={canMergeNext}
              prevEventToMerge={prevEventToMerge}
              onMergeEvent={onMergeEvent}
              canSplit={canSplit}
              onSplitEvent={onSplitEvent}
            />
        )
      })}
    </div>
  )
})

// ─────────────────────────────────────────────────────────────────────────────
export default function TimeGrid({
  rooms, dayEvents, conflictMap,
  onMergeEvent, onSplitEvent,
  draggedEvent, hoveredCell, getDropConflict,
  onDragStart, onDragEnd, onDragOver, onDragEnter, onDragLeave, onDrop,
  onCardClick,
  locked = false,
  gridSize = 'normal',
  compact = false,
  conflictingDragIds = EMPTY_SET,
  ambientConflictIds = EMPTY_SET,
  ambientMergeIds    = EMPTY_SET,
  dragConflictBands  = EMPTY_ARR,
  fullscreen = false,
  mergedIds = null,   // Set<eventId> from ScheduleViewPage — always current
  allEvents = [],     // Unfiltered events to compute proper pre-glows when filters are active
  availabilityMap = null,     // Map<room, {start,end}[]> — TRUE free ranges per room, from unfiltered allEvents
  highlightAvailable = false, // "Available Rooms" toggle — glow the genuinely free slots green
  propStartHour, // Optional injected bounds
  propEndHour,
  activeDay, // The day this grid is rendering for
  hoverStore = null, // from useDragDrop(..., { isolateHover: true }); when set, hover never re-renders this component
}) {
  const splitCounts = useMemo(() => {
    const counts = {}
    for (const ev of allEvents || []) {
      const key = `${ev.courseCode}|${ev.program}|${ev.year}|${ev.block}|${ev.session}`
      counts[key] = (counts[key] || 0) + 1
    }
    return counts
  }, [allEvents])

  const { finalStartHour, finalEndHour } = useMemo(() => {
    let minH = propStartHour ?? 7
    let maxH = propEndHour ?? 21
    
    // Ensure we don't chop off existing events if they fall outside the settings bounds
    const scanEvents = allEvents && allEvents.length > 0 ? allEvents : dayEvents
    for (const ev of scanEvents || []) {
      const range = parsePeriodRange(ev.period)
      if (range) {
        const evStartH = Math.floor(range.start / 60)
        const evEndH = Math.ceil(range.end / 60)
        if (evStartH < minH) minH = evStartH
        if (evEndH > maxH) maxH = evEndH
      }
    }
    return { finalStartHour: minH, finalEndHour: maxH }
  }, [propStartHour, propEndHour, allEvents, dayEvents])

  const timeSlots = useMemo(() => buildTimeSlots(finalStartHour, finalEndHour), [finalStartHour, finalEndHour])
  const gridStart = finalStartHour * 60

  // Resolve gridSize from legacy compact prop when needed
  const resolvedSize = compact ? 'compact' : gridSize
  const { slotH, roomMinW } = resolveDims(resolvedSize)

  // ── Auto-scroll while dragging: visible drop-zones on all four edges ───────
  // Hold a dragged session over a zone (left / right / top / bottom of the grid)
  // and the grid scrolls that way — faster the deeper into the zone you go.
  // The zone overlay is pointer-events:none, so drops underneath still work.
  const scrollRef  = useRef(null)
  const headerRef  = useRef(null)
  const asBoxRef   = useRef(null)
  const asNodes    = useRef({})
  const isDragging = !!draggedEvent

  useLayoutEffect(() => {
    const el = scrollRef.current
    if (!el || !isDragging) return

    const nodes   = asNodes.current
    const headerH = headerRef.current?.offsetHeight ?? 32

    // Lay the visible zones out: below the sticky header, right of the sticky
    // time column, and clear of the scrollbars.
    const box = asBoxRef.current
    if (box) {
      box.style.right  = (el.offsetWidth  - el.clientWidth)  + 'px'
      box.style.bottom = (el.offsetHeight - el.clientHeight) + 'px'
    }
    const place = (n, css) => { if (n) Object.assign(n.style, css) }
    place(nodes.left,  { left: TIME_COL_W + 'px', top: headerH + 'px', bottom: '0px', width: AS_SIDE_L + 'px' })
    place(nodes.right, { right: '0px',            top: headerH + 'px', bottom: '0px', width: AS_SIDE_R + 'px' })
    place(nodes.up,    { top: headerH + 'px', left: TIME_COL_W + 'px', right: '0px', height: AS_TOP + 'px' })
    place(nodes.down,  { bottom: '0px',       left: TIME_COL_W + 'px', right: '0px', height: AS_BOTTOM + 'px' })

    let px = 0, py = 0, inside = false
    let rafId = null, lastT = 0

    const speed = t => AS_MIN_SPEED + (AS_MAX_SPEED - AS_MIN_SPEED) * Math.pow(Math.min(1, Math.max(0, t)), 1.4)

    // Geometry is cached: reading clientWidth / scrollWidth / getBoundingClientRect on
    // every animation frame forced a synchronous layout whenever React had just
    // changed the DOM (that was the 96 ms "Forced reflow" in the profile). Dragging
    // never resizes the grid, so read once, refresh only on resize / page scroll.
    let dims = null
    const readDims = () => {
      dims = {
        w: el.clientWidth, h: el.clientHeight,
        sw: el.scrollWidth, sh: el.scrollHeight,
        rect: el.getBoundingClientRect(),
      }
    }
    const invalidate = () => { dims = null }
    const ro = typeof ResizeObserver !== 'undefined' ? new ResizeObserver(invalidate) : null
    ro?.observe(el)
    window.addEventListener('resize', invalidate)
    window.addEventListener('scroll', invalidate, { passive: true })

    const measure = () => {
      if (!dims) readDims()
      const { w, h, sw, sh, rect } = dims
      const canL = el.scrollLeft > 1
      const canR = el.scrollLeft < sw - w - 1
      const canU = el.scrollTop  > 1
      const canD = el.scrollTop  < sh - h - 1
      const s = { vx: 0, vy: 0, canL, canR, canU, canD, inL: false, inR: false, inU: false, inD: false }
      if (!inside) return s

      const x = px - rect.left, y = py - rect.top
      const zl = TIME_COL_W + AS_SIDE_L
      const zt = headerH + AS_TOP

      if (x < zl)                  { s.inL = true; if (canL) s.vx = -speed((zl - x) / AS_SIDE_L) }
      else if (x > w - AS_SIDE_R)  { s.inR = true; if (canR) s.vx =  speed((x - (w - AS_SIDE_R)) / AS_SIDE_R) }

      if (y < zt)                  { s.inU = true; if (canU) s.vy = -speed((zt - y) / AS_TOP) }
      else if (y > h - AS_BOTTOM)  { s.inD = true; if (canD) s.vy =  speed((y - (h - AS_BOTTOM)) / AS_BOTTOM) }
      return s
    }

    const setNode = (n, can, on) => {
      if (!n) return
      n.classList.toggle('tg-as-off', !can)
      n.classList.toggle('tg-as-on', can && on)
    }
    const paint = s => {
      setNode(nodes.left,  s.canL, s.inL)
      setNode(nodes.right, s.canR, s.inR)
      setNode(nodes.up,    s.canU, s.inU)
      setNode(nodes.down,  s.canD, s.inD)
    }

    const tick = now => {
      rafId = null
      const s = measure()
      paint(s)
      if (!s.vx && !s.vy) { lastT = 0; return }
      const k = lastT ? Math.min(50, now - lastT) / 16.7 : 1   // frame-rate independent
      lastT = now
      if (s.vx) el.scrollLeft += s.vx * k
      if (s.vy) el.scrollTop  += s.vy * k
      rafId = requestAnimationFrame(tick)
    }
    const kick = () => { if (rafId === null) rafId = requestAnimationFrame(tick) }

    const onOver = e => { px = e.clientX; py = e.clientY; inside = true; kick() }
    const onLeave = e => {
      if (e.relatedTarget && el.contains(e.relatedTarget)) return
      inside = false; kick()
    }
    const onEnd = () => { inside = false; kick() }

    el.addEventListener('dragover',  onOver)
    el.addEventListener('dragleave', onLeave)
    el.addEventListener('scroll',    kick, { passive: true })
    document.addEventListener('dragend', onEnd)
    document.addEventListener('drop',    onEnd)
    kick()   // paint the idle state right away

    return () => {
      el.removeEventListener('dragover',  onOver)
      el.removeEventListener('dragleave', onLeave)
      el.removeEventListener('scroll',    kick)
      document.removeEventListener('dragend', onEnd)
      document.removeEventListener('drop',    onEnd)
      ro?.disconnect()
      window.removeEventListener('resize', invalidate)
      window.removeEventListener('scroll', invalidate)
      if (rafId !== null) cancelAnimationFrame(rafId)
    }
  }, [isDragging])

  const totalH   = timeSlots.length * slotH
  const gridMinW = TIME_COL_W + rooms.length * roomMinW

  const hoveredRoom = hoveredCell ? hoveredCell.split('|')[0] : null
  const hoveredSlot = hoveredCell ? parseInt(hoveredCell.split('|')[1]) : null

  // ── Passive section conflict ranges ─────────────────────────────────────────
  const sectionConflictRanges = useMemo(() => {
    if (!draggedEvent?.program || !draggedEvent?.block || !draggedEvent?.year) return []
    const dragId = getEventId(draggedEvent)
    return allEvents // 👈 Use unfiltered allEvents
      .filter(ev =>
        ev.day === activeDay && // Ensure same day
        getEventId(ev) !== dragId &&
        ev.program === draggedEvent.program &&
        String(ev.year) === String(draggedEvent.year) &&
        ev.block === draggedEvent.block
      )
      .map(ev => parsePeriodRange(ev.period))
      .filter(Boolean)
  }, [draggedEvent, allEvents, activeDay])

  // ── Passive faculty conflict ranges ─────────────────────────────────────────
  const facultyConflictRanges = useMemo(() => {
    if (!draggedEvent?.faculty || draggedEvent.faculty === 'TBA') return []
    const dragId = getEventId(draggedEvent)
    return allEvents // 👈 Use unfiltered allEvents
      .filter(ev =>
        ev.day === activeDay && // Ensure same day
        getEventId(ev) !== dragId &&
        ev.faculty === draggedEvent.faculty
      )
      .map(ev => parsePeriodRange(ev.period))
      .filter(Boolean)
  }, [draggedEvent, allEvents, activeDay])

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
    const unfilteredDayEvents = allEvents.filter(ev => ev.day === activeDay)

    const cellConf  = new Set()
    const cellMerge = new Set()
    const slotConf  = new Set()
    const slotMerge = new Set()

    rooms.forEach(room => {
      timeSlots.forEach(slot => {
        const cellKey  = `${room}|${slot.startMinutes}`
        const proposed = { start: slot.startMinutes, end: slot.startMinutes + dragRange.duration }

        let isConflict = false
        const roomEventsAtSlot = []

        for (const ev of unfilteredDayEvents) { // 👈 Loop over unfiltered events!
          if (getEventId(ev) === dragId) continue
          const r = parsePeriodRange(ev.period)
          if (!r || !timeOverlaps(proposed, r)) continue

          const roomC    = ev.room === room && room !== 'TBA' && !isOnlineRoom(room)
          const sectionC = draggedEvent.program && ev.program === draggedEvent.program
              && String(ev.year) === String(draggedEvent.year)
              && ev.block === draggedEvent.block
          const facultyC = draggedEvent.faculty && draggedEvent.faculty !== 'TBA'
              && ev.faculty === draggedEvent.faculty

          if (roomC) roomEventsAtSlot.push(ev)

          const isMergePartner = ambientMergeIds.has(getEventId(ev)) && r.start === proposed.start && r.end === proposed.end

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
  }, [draggedEvent, rooms, allEvents, ambientMergeIds, activeDay])

  // ── Isolated-hover: derive conflict data from the hover store ─────────────
  const dayScopedEvents = useMemo(
    () => (hoverStore ? allEvents.filter(ev => ev.day === activeDay) : EMPTY_ARR),
    [hoverStore, allEvents, activeDay]
  )
  const hoverDerived = useMemo(
    () => (hoverStore ? makeHoverDerived(hoverStore, draggedEvent, dayScopedEvents) : null),
    [hoverStore, draggedEvent, dayScopedEvents]
  )
  // "Available Rooms" cells pulse forever too (not only while dragging), so they
  // must count toward the static-glow threshold or hundreds of them animate nonstop.
  const availableCount = useMemo(() => {
    if (!highlightAvailable || draggedEvent || !availabilityMap) return 0
    let n = 0
    for (const room of rooms) {
      const ranges = availabilityMap.get(room)
      if (!ranges || ranges.length === 0) continue
      for (const slot of timeSlots) {
        const end = slot.startMinutes + SLOT_MINUTES
        if (ranges.some(r => slot.startMinutes >= r.start && end <= r.end)) n++
      }
    }
    return n
  }, [highlightAvailable, draggedEvent, availabilityMap, rooms, timeSlots])
  const glowStatic = (preGlowCells.conflict.size + preGlowCells.merge.size + availableCount) > GLOW_STATIC_THRESHOLD

  return (
    <div style={{ position: 'relative' }}>
      <div
        ref={scrollRef}
        className={[glowStatic && 'tg-glow-static', isDragging && 'tg-grid-dragging'].filter(Boolean).join(' ') || undefined}
        style={{
          overflowX: 'auto', overflowY: 'auto', maxHeight: gridH, paddingBottom: 12,
          '--tg-dim': resolvedSize === 'compact' ? .32 : .25,
          '--tg-drag': resolvedSize === 'compact' ? .55 : .5,
        }}
      >
        <div style={{ minWidth: gridMinW }}>

          {/* ── HEADER ── */}
          <div ref={headerRef} style={{
            display: 'flex',
            background: 'linear-gradient(to bottom,var(--surface),var(--bg))',
            position: 'sticky', top: 0, zIndex: 200, flexShrink: 0,
          }}>
            <div style={{
              width: TIME_COL_W, flexShrink: 0,
              borderRight: `2px solid ${TV.border}`,
              position: 'sticky', left: 0, zIndex: 201,
              background: 'linear-gradient(to bottom,var(--surface),var(--bg))',
            }} />
            {rooms.map((room, idx) => (
              <div key={room} style={{
                flex: 1, minWidth: roomMinW,
                padding: resolvedSize === 'compact' ? '3px 5px' : '7px 12px',
                borderRight: idx < rooms.length - 1 ? `1px solid ${TV.border}` : 'none',
                display: 'flex', alignItems: 'center', gap: resolvedSize === 'compact' ? 4 : 6, overflow: 'hidden',
              }}>
                <div style={{ width: resolvedSize === 'compact' ? 3 : 5, height: resolvedSize === 'compact' ? 3 : 5, borderRadius: '50%', background: TV.deep, opacity: .6, flexShrink: 0 }} />
                <span style={{
                  fontSize: resolvedSize === 'compact' ? 8 : 11, fontWeight: 700, color: TV.text,
                  overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap',
                  flex: 1, letterSpacing: '-0.2px',
                }}>
                  {room}
                </span>
                <span style={{
                  fontSize: resolvedSize === 'compact' ? 7 : 8, background: TV.pale, color: TV.deep,
                  border: `1px solid ${TV.light}`, borderRadius: 20,
                  padding: resolvedSize === 'compact' ? '0 4px' : '1px 5px', fontWeight: 700, flexShrink: 0,
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
              position: 'sticky', left: 0, background: 'var(--bg)', zIndex: 100,
              boxShadow: '2px 0 6px rgba(0,0,0,0.03)',
            }}>
              {timeSlots.map(slot => {
                const isHour = slot.startMinutes % 60 === 0
                const top    = ((slot.startMinutes - gridStart) / SLOT_MINUTES) * slotH
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
                        : `1px dashed rgba(180,220,195,.65)`,
                      borderRight: isRowConflict ? '3px solid rgba(239,68,68,.40)' : isRowMerge ? `3px solid rgba(0,0,0,.30)` : undefined,
                      transition: 'border-color .1s',
                    }}>
                    {isHour ? (
                      <span style={{ fontSize: resolvedSize === 'compact' ? 7 : 10, fontWeight: 700, color: isRowConflict ? '#ef4444' : isRowMerge ? TV.deep : TV.deep, lineHeight: 1, whiteSpace: 'nowrap' }}>
                        {slot.label}
                      </span>
                    ) : (
                      <span style={{ fontSize: resolvedSize === 'compact' ? 0 : 8.5, fontWeight: 600, color: isRowConflict ? '#ef4444' : TV.deep, opacity: isRowConflict ? 1 : .85, lineHeight: 1, whiteSpace: 'nowrap' }}>
                        {resolvedSize === 'compact' ? '' : displayLabel}
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
                <RoomColumnMemo
                  room={room} dayEvents={dayEvents} conflictMap={conflictMap}
                  draggedEvent={draggedEvent} hoveredSlot={hoverStore ? null : (hoveredRoom === room ? hoveredSlot : null)}
                hoverStore={hoverStore} hoverDerived={hoverDerived}
                  getDropConflict={getDropConflict}
                  onDragStart={onDragStart} onDragEnd={onDragEnd}
                  onDragOver={onDragOver} onDragEnter={onDragEnter} onDragLeave={onDragLeave} onDrop={onDrop}
                  onCardClick={onCardClick}
                  onMergeEvent={onMergeEvent} onSplitEvent={onSplitEvent} splitCounts={splitCounts}
                  gridSize={resolvedSize} slotH={slotH} locked={locked}
                  conflictingDragIds={hoverStore ? EMPTY_SET : conflictingDragIds}
                  ambientConflictIds={ambientConflictIds}
                  ambientMergeIds={ambientMergeIds}
                  mergedIds={mergedIds}
                  preGlowCells={preGlowCells}
                  availabilityMap={availabilityMap}
                  highlightAvailable={highlightAvailable}
                  timeSlots={timeSlots}
                  gridStart={gridStart}
                />
              </div>
            ))}

            {/* ── Passive section conflict bands ── */}
            {draggedEvent && sectionConflictRanges.map((range, i) => {
              const bandTop = ((range.start - gridStart) / SLOT_MINUTES) * slotH
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
              const bandTop = ((range.start - gridStart) / SLOT_MINUTES) * slotH
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
            <BandsFrom derived={hoverDerived} fallback={dragConflictBands}>
            {bands => bands.map((band, i) => {
              const bandTop = ((band.start - gridStart) / SLOT_MINUTES) * slotH
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
                    background: 'var(--surface)',
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
            </BandsFrom>

          </div>
        </div>
      </div>
      {isDragging && (
        <div ref={asBoxRef} className="tg-as-box" aria-hidden="true">
          {AS_DIRS.map(d => (
            <div key={d} ref={n => { asNodes.current[d] = n }} className={`tg-as tg-as-${d}`}>
              <span className="tg-as-chev">
                <svg width={14} height={14} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                  <polyline points="15 18 9 12 15 6" />
                </svg>
              </span>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}