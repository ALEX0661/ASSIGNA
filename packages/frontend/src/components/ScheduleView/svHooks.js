import { useState, useMemo, useCallback, useEffect, useRef } from 'react'
import { overrideSession } from '../../services/api'
import { parsePeriodRange, minutesToTimeLabel, getEventId, timeOverlaps, buildConflictMap, areMergePartners, isOnlineRoom } from './svHelpers'

// ── useFilters ────────────────────────────────────────────────────────────────
export function useFilters(events, masterFacultyList, masterRooms, activeDay) {
  const [searchQuery,      setSearchQuery]     = useState('')
  const [filterFac,        setFilterFac]       = useState(new Set())
  const [filterPrograms,   setFilterPrograms]  = useState(new Set())
  const [filterYears,      setFilterYears]     = useState(new Set())
  const [filterRooms,      setFilterRooms]     = useState(new Set())
  const [filterBlocks,     setFilterBlocks]    = useState(new Set())
  const [filterSessions,   setFilterSessions]  = useState(new Set())
  const [filterConflicts,  setFilterConflicts] = useState(false)
  const [filterUnassigned, setFilterUnassigned]= useState(false)
  const [filterMerged,     setFilterMerged]    = useState(false)

  const makeToggle = setter => val =>
    setter(prev => { const n = new Set(prev); n.has(val) ? n.delete(val) : n.add(val); return n })

  const toggles = {
    program:    makeToggle(setFilterPrograms),
    year:       makeToggle(setFilterYears),
    room:       makeToggle(setFilterRooms),
    faculty:    makeToggle(setFilterFac),
    block:      makeToggle(setFilterBlocks),
    session:    makeToggle(setFilterSessions),
    conflicts:  () => setFilterConflicts(v => !v),
    unassigned: () => setFilterUnassigned(v => !v),
    merged:     () => setFilterMerged(v => !v),
  }

  const options = useMemo(() => {
    const programs = new Set(), years = new Set(), blocksSet = new Set(), sessSet = new Set()
    const faculty  = new Set(masterFacultyList.map(f => f.name))
    const roomsSet = new Set([...masterRooms.lecture, ...masterRooms.lab])
    events.forEach(e => {
      if (e.program) programs.add(e.program)
      if (e.year)    years.add(e.year)
      if (e.faculty && e.faculty !== 'TBA') faculty.add(e.faculty)
      if (e.room)    roomsSet.add(e.room)
      if (e.block)   blocksSet.add(e.block)
      if (e.session) sessSet.add(e.session)
    })
    return {
      allPrograms: [...programs].sort(),
      allYears:    [...years].sort((a, b) => a - b),
      allFaculty:  [...faculty].sort(),
      allRooms:    [...roomsSet].sort(),
      allBlocks:   [...blocksSet].sort(),
      allSessions: [...sessSet].sort(),
    }
  }, [events, masterFacultyList, masterRooms])

  const dayEvents = useMemo(() => {
    const q = searchQuery.trim().toLowerCase()
    const dayEvs = events.filter(e => e.day === activeDay)
    const conflictIds = filterConflicts ? new Set(buildConflictMap(dayEvs).keys()) : null

    return dayEvs
      .filter(e => {
        if (q) {
          const ok = (e.courseCode||'').toLowerCase().includes(q)
            || (e.block||'').toLowerCase().includes(q)
            || (e.faculty||'').toLowerCase().includes(q)
            || (q.length >= 3 && (e.title||'').toLowerCase().includes(q))
          if (!ok) return false
        }
        if (filterFac.size      > 0 && !filterFac.has(e.faculty))      return false
        if (filterPrograms.size > 0 && !filterPrograms.has(e.program)) return false
        if (filterYears.size    > 0 && !filterYears.has(e.year))       return false
        if (filterRooms.size    > 0 && !filterRooms.has(e.room))       return false
        if (filterBlocks.size   > 0 && !filterBlocks.has(e.block))     return false
        if (filterSessions.size > 0 && !filterSessions.has(e.session)) return false
        if (filterUnassigned && (e.faculty && e.faculty !== 'TBA'))    return false
        if (filterConflicts && conflictIds && !conflictIds.has(
          e.schedule_id ?? `${e.courseCode}-${e.block}-${e.session}-${e.day}`
        )) return false
        return true
      })
      .sort((a, b) => (parsePeriodRange(a.period)?.start ?? 9999) - (parsePeriodRange(b.period)?.start ?? 9999))
  }, [events, activeDay, searchQuery, filterFac, filterPrograms, filterYears, filterRooms, filterBlocks, filterSessions, filterConflicts, filterUnassigned])

  const hasFilters = !!(searchQuery || filterFac.size || filterPrograms.size || filterYears.size || filterRooms.size || filterBlocks.size || filterSessions.size || filterConflicts || filterUnassigned || filterMerged)

  function clearFilters() {
    setSearchQuery('')
    setFilterFac(new Set()); setFilterPrograms(new Set()); setFilterYears(new Set())
    setFilterRooms(new Set()); setFilterBlocks(new Set()); setFilterSessions(new Set())
    setFilterConflicts(false); setFilterUnassigned(false); setFilterMerged(false)
  }

  return { searchQuery, setSearchQuery, filterFac, filterRooms, filterPrograms, filterYears, filterBlocks, filterSessions, filterConflicts, filterUnassigned, filterMerged, toggles, options, dayEvents, hasFilters, clearFilters }
}

// ── useDragDrop ───────────────────────────────────────────────────────────────
// events      = full local event list (all days, reflects pending moves)
// storeEvents = original server state (for reverting)
// overrideFn lets a caller (e.g. the coordinator editor) redirect saves to
// its own scoped endpoint instead of the admin-only one — defaults to the
// admin override so existing callers are unaffected.
export function useDragDrop(events, activeDay, setLocalEvents, setEvents, storeEvents, locked = false, overrideFn = overrideSession) {
  const [draggedEvent,     setDraggedEvent]     = useState(null)
  const [hoveredCell,      setHoveredCell]      = useState(null)
  const [toast,            setToast]            = useState(null)

  // ── Frontend-first override queue ─────────────────────────────────────────
  const [pendingOverrides, setPendingOverrides] = useState(new Map())
  const [saving,           setSaving]           = useState(false)

  // ── Confirmation state — set when a conflicting drop needs approval ────────
  const [pendingDrop, setPendingDrop] = useState(null)

  // ── Stack confirmation state ───────────────────────────────────────────────
  const [pendingStack, setPendingStack] = useState(null)

  // ── Auto-save state & refs ─────────────────────────────────────────────────
  
  
  
  // Always points to the latest saveAllOverrides — updated each render below
  const saveRef             = useRef(null)
  // Stable ref for scheduleAutoSave so applyMove can reference it
  

  // ── Clean up timers on unmount ─────────────────────────────────────────────
  useEffect(() => () => {
    
    
  }, [])

  // ── Global drag-end safety net ─────────────────────────────────────────────
  // Clears "stuck" drag state when dragend fires anywhere on the document
  // (handles the case where the mouse is released outside the browser window
  //  or over a non-drop-zone and the component's onDragEnd prop is not called).
  useEffect(() => {
    const forceClean = () => {
      setDraggedEvent(null)
      setHoveredCell(null)
    }
    document.addEventListener('dragend', forceClean)
    // mouseup as an additional safety net for rapid re-drags
    document.addEventListener('mouseup', forceClean)
    return () => {
      document.removeEventListener('dragend', forceClean)
      document.removeEventListener('mouseup', forceClean)
    }
  }, [])

  // ── Drag handlers ─────────────────────────────────────────────────────────
  const handleDragStart = useCallback((e, event) => {
    if (locked) {
      e.preventDefault()
      setToast({ type: 'info', message: 'This schedule is locked and can no longer be edited.' })
      return
    }
    e.dataTransfer.effectAllowed = 'move'
    e.dataTransfer.setData('text/plain', getEventId(event))
    // Defer state update so the browser captures the drag source before we mutate its pointer-events
    setTimeout(() => {
      setDraggedEvent(event)
    }, 0)
  }, [locked])

  const handleDragEnd = useCallback(() => {
    // Small delay so the drop handler (if any) runs first without a flicker
    setTimeout(() => {
      setDraggedEvent(null)
      setHoveredCell(null)
    }, 30)
  }, [])

  const lastDragOverTime = useRef(0)

  const handleDragOver = useCallback((e, room, slot) => {
    e.preventDefault(); e.dataTransfer.dropEffect = 'move'
    const now = Date.now()
    // Throttle: only update hovered cell at most every 50 ms.
    // Without this, every pixel of mouse movement triggers setHoveredCell
    // which re-renders the entire grid (800+ cards) and re-runs four expensive
    // useMemo conflict-detection loops — the main source of drag lag.
    if (now - lastDragOverTime.current < 50) return
    lastDragOverTime.current = now
    setHoveredCell(`${room}|${slot.startMinutes}`)
  }, [])

  const handleDragLeave = useCallback(e => {
    if (!e.currentTarget.contains(e.relatedTarget)) setHoveredCell(null)
  }, [])

  // ── Ambient conflict IDs ───────────────────────────────────────────────────
  const ambientConflictIds = useMemo(() => {
    if (!draggedEvent) return new Set()
    const ids = new Set()
    const dragId = getEventId(draggedEvent)
    for (const ev of events) {
      if (ev.day !== activeDay) continue
      if (getEventId(ev) === dragId) continue
      const sectionMatch = draggedEvent.program && draggedEvent.year && draggedEvent.block
        && ev.program === draggedEvent.program
        && String(ev.year) === String(draggedEvent.year)
        && ev.block === draggedEvent.block
      const facultyMatch = draggedEvent.faculty && draggedEvent.faculty !== 'TBA'
        && ev.faculty === draggedEvent.faculty
      if (sectionMatch || facultyMatch) ids.add(getEventId(ev))
    }
    return ids
  }, [draggedEvent, events, activeDay])

  // ── Ambient merge IDs ──────────────────────────────────────────────────────
  const ambientMergeIds = useMemo(() => {
    if (!draggedEvent?.courseCode) return new Set()
    const ids = new Set()
    const dragId = getEventId(draggedEvent)
    for (const ev of events) {
      if (ev.day !== activeDay) continue
      if (getEventId(ev) === dragId) continue
      if (
        ev.courseCode === draggedEvent.courseCode &&
        ev.program    === draggedEvent.program &&
        String(ev.year) === String(draggedEvent.year) &&
        ev.block !== draggedEvent.block
      ) ids.add(getEventId(ev))
    }
    return ids
  }, [draggedEvent, events, activeDay])

  // ── Conflict IDs at the hovered target ────────────────────────────────────
  const conflictingDragIds = useMemo(() => {
    if (!draggedEvent || !hoveredCell) return new Set()
    const [hRoom, hSlot] = hoveredCell.split('|')
    const dragRange = parsePeriodRange(draggedEvent.period)
    if (!dragRange) return new Set()
    const newStart  = parseInt(hSlot)
    const newEnd    = newStart + dragRange.duration
    const dragId    = getEventId(draggedEvent)
    const proposed  = { start: newStart, end: newEnd }
    const ids       = new Set()

    for (const ev of events) {
      if (getEventId(ev) === dragId || ev.day !== activeDay) continue
      const r = parsePeriodRange(ev.period)
      if (!r || !timeOverlaps(proposed, r)) continue

      const wouldMerge = draggedEvent.courseCode &&
        ev.courseCode === draggedEvent.courseCode &&
        ev.program    === draggedEvent.program &&
        String(ev.year) === String(draggedEvent.year) &&
        ev.block !== draggedEvent.block &&
        ev.room === hRoom && hRoom !== 'TBA'
      if (wouldMerge) continue

      const roomC    = ev.room === hRoom && hRoom !== 'TBA' && !isOnlineRoom(hRoom)
      const sectionC = draggedEvent.program && draggedEvent.year && draggedEvent.block
        && ev.program === draggedEvent.program
        && String(ev.year) === String(draggedEvent.year)
        && ev.block === draggedEvent.block
      const facultyC = draggedEvent.faculty && draggedEvent.faculty !== 'TBA'
        && ev.faculty === draggedEvent.faculty
      if (roomC || sectionC || facultyC) ids.add(getEventId(ev))
    }
    return ids
  }, [draggedEvent, hoveredCell, events, activeDay])

  // ── Full-width conflict bands at the proposed drop position ───────────────
  const dragConflictBands = useMemo(() => {
    if (!draggedEvent || !hoveredCell) return []
    const [, hSlot]  = hoveredCell.split('|')
    const dragRange  = parsePeriodRange(draggedEvent.period)
    if (!dragRange) return []
    const newStart   = parseInt(hSlot)
    const newEnd     = newStart + dragRange.duration
    const dragId     = getEventId(draggedEvent)
    const proposed   = { start: newStart, end: newEnd }
    const sectionHit = new Set()
    const facultyHit = new Set()

    for (const ev of events) {
      if (getEventId(ev) === dragId || ev.day !== activeDay) continue
      const r = parsePeriodRange(ev.period)
      if (!r || !timeOverlaps(proposed, r)) continue
      if (
        draggedEvent.program && draggedEvent.year && draggedEvent.block
        && ev.program === draggedEvent.program
        && String(ev.year) === String(draggedEvent.year)
        && ev.block === draggedEvent.block
      ) sectionHit.add(`${ev.program}${ev.year}-${ev.block}`)
      if (draggedEvent.faculty && draggedEvent.faculty !== 'TBA' && ev.faculty === draggedEvent.faculty)
        facultyHit.add(ev.faculty)
    }

    const bands = []
    if (sectionHit.size > 0 || facultyHit.size > 0) {
      bands.push({
        start:   newStart,
        end:     newEnd,
        section: sectionHit.size > 0,
        faculty: facultyHit.size > 0,
        label:   [
          sectionHit.size > 0 ? `${draggedEvent.program} ${draggedEvent.year}-${draggedEvent.block} conflict` : null,
          facultyHit.size > 0 ? `${draggedEvent.faculty} conflict` : null,
        ].filter(Boolean).join(' · '),
      })
    }
    return bands
  }, [draggedEvent, hoveredCell, events, activeDay])

  // ── Apply a move to local state + enqueue as pending override ─────────────
  const applyMove = useCallback((event, targetRoom, newPeriod, day) => {
    const dragId = getEventId(event)
    const [startTime, endTime] = newPeriod.split(' - ')
    const updated = events.map(ev =>
      getEventId(ev) !== dragId ? ev : { ...ev, room: targetRoom, period: newPeriod, day, startTime, endTime }
    )
    setLocalEvents(updated)
    setEvents(updated)

    setPendingOverrides(prev => {
      const next = new Map(prev)
      const existing = next.get(dragId)
      
      const origRoom   = existing?.orig_room   ?? event.room
      const origDay    = existing?.orig_day    ?? event.day
      const origPeriod = existing?.orig_period ?? event.period

      const normTime = p => p ? p.replace(/\b0(\d):/g, '$1:') : ''
      const parts = []
      if (day !== origDay) parts.push(day)
      if (normTime(newPeriod) !== normTime(origPeriod)) parts.push(newPeriod)
      if (targetRoom !== origRoom) parts.push(targetRoom)
      const moveDesc = parts.length > 0 ? parts.join(' | ') : 'Unchanged'

      const sessType = (event.session || 'CLASS').toUpperCase();
      const progBlock = `${event.program || ''} ${event.year || ''}${event.block || ''}`.replace(/\s+/g, ' ').trim();

      next.set(dragId, {
        id:         dragId,
        courseCode: event.courseCode,
        program:    event.program,
        year:       event.year,
        block:      event.block,
        session:    event.session,
        new_room:   targetRoom,
        new_day:    day,
        new_period: newPeriod,
        orig_room:  origRoom,
        orig_day:   origDay,
        orig_period: origPeriod,
        label: `${event.courseCode} ${sessType} (${progBlock}) -> ${moveDesc}`,
      })
      return next
    })

    // Kick off (or reset) the auto-save countdown
    
  }, [events, setLocalEvents, setEvents])

  // ── Drop handler — allows conflicting drops via confirmation ──────────────
  const handleDrop = useCallback((e, targetRoom, slot) => {
    e.preventDefault(); setHoveredCell(null)
    if (locked || !draggedEvent) return
    const dragRange = parsePeriodRange(draggedEvent.period)
    if (!dragRange) return
    const newStart  = slot.startMinutes
    const newEnd    = newStart + dragRange.duration
    const newPeriod = `${minutesToTimeLabel(newStart)} - ${minutesToTimeLabel(newEnd)}`
    if (draggedEvent.room === targetRoom && dragRange.start === newStart && draggedEvent.day === activeDay) return

    const dragId   = getEventId(draggedEvent)
    const proposed = { start: newStart, end: newEnd }

    const prevPartner = events.find(ev => {
      if (getEventId(ev) === dragId || ev.day !== draggedEvent.day) return false
      return areMergePartners(draggedEvent, ev)
    }) ?? null

    const wouldMergeWith = []
    const conflicting    = []

    for (const ev of events) {
      if (getEventId(ev) === dragId || ev.day !== activeDay) continue
      const r = parsePeriodRange(ev.period)
      if (!r || !timeOverlaps(proposed, r)) continue

      const isMergeCandidate = draggedEvent.courseCode &&
        ev.courseCode === draggedEvent.courseCode &&
        ev.program    === draggedEvent.program    &&
        String(ev.year) === String(draggedEvent.year) &&
        ev.block !== draggedEvent.block &&
        ev.room === targetRoom && targetRoom !== 'TBA'

      if (isMergeCandidate) {
        wouldMergeWith.push(ev)
        continue
      }

      const types = []
      const roomC    = ev.room === targetRoom && targetRoom !== 'TBA' && !isOnlineRoom(targetRoom)
      const sectionC = draggedEvent.program && draggedEvent.year && draggedEvent.block
        && ev.program === draggedEvent.program
        && String(ev.year) === String(draggedEvent.year)
        && ev.block === draggedEvent.block
      const facultyC = draggedEvent.faculty && draggedEvent.faculty !== 'TBA'
        && ev.faculty === draggedEvent.faculty

      if (roomC)    types.push('Room')
      if (sectionC) types.push('Section')
      if (facultyC) types.push('Faculty')
      if (types.length > 0) conflicting.push({ ...ev, conflictLabel: types.join(' + ') + ' Conflict' })
    }

    if (conflicting.length > 0) {
      setPendingDrop({ draggedEvent, targetRoom, newPeriod, day: activeDay, conflicts: conflicting })
      return
    }

    applyMove(draggedEvent, targetRoom, newPeriod, activeDay)
    setDraggedEvent(null)

    if (wouldMergeWith.length > 0) {
      const partner = wouldMergeWith[0]
      setToast({
        type: 'success',
        icon: 'link',
        message: `Merged: ${draggedEvent.courseCode} ${draggedEvent.program} ${draggedEvent.year}-${draggedEvent.block} + Block ${partner.block}`,
      })
    } else if (prevPartner) {
      const otherMerges = events.filter(ev => {
        if (getEventId(ev) === dragId) return false
        return ev.courseCode === draggedEvent.courseCode &&
          ev.program === draggedEvent.program &&
          String(ev.year) === String(draggedEvent.year) &&
          ev.day !== activeDay
      })
      const hasSiblings = otherMerges.length > 0
      setToast({
        type: 'info',
        icon: 'unlink',
        message: hasSiblings
          ? `Unmerged from Block ${prevPartner.block}. ${draggedEvent.courseCode} may still have merged sessions on other days.`
          : `${draggedEvent.courseCode} Block ${draggedEvent.block} unmerged from Block ${prevPartner.block}.`,
      })
    } else {
      setToast({ type: 'success', message: `Moved ${draggedEvent.courseCode} to ${targetRoom} at ${minutesToTimeLabel(newStart)}` })
    }
  }, [locked, draggedEvent, events, activeDay, applyMove])

  // ── Day Tab Drop handler ──────────────────────────────────────────────────
  const handleDayDrop = useCallback((e, targetDay) => {
    e.preventDefault()
    setHoveredCell(null)
    if (locked || !draggedEvent) return
    if (targetDay === draggedEvent.day) {
      setDraggedEvent(null)
      return
    }

    const targetRoom = draggedEvent.room
    const dragRange = parsePeriodRange(draggedEvent.period)
    if (!dragRange) return
    const newStart = dragRange.start
    const newEnd = dragRange.start + dragRange.duration
    const newPeriod = draggedEvent.period

    const dragId   = getEventId(draggedEvent)
    const proposed = { start: newStart, end: newEnd }

    const prevPartner = events.find(ev => {
      if (getEventId(ev) === dragId || ev.day !== draggedEvent.day) return false
      return areMergePartners(draggedEvent, ev)
    }) ?? null

    const wouldMergeWith = []
    const conflicting    = []

    for (const ev of events) {
      if (getEventId(ev) === dragId || ev.day !== targetDay) continue
      const r = parsePeriodRange(ev.period)
      if (!r || !timeOverlaps(proposed, r)) continue

      const isMergeCandidate = draggedEvent.courseCode &&
        ev.courseCode === draggedEvent.courseCode &&
        ev.program    === draggedEvent.program    &&
        String(ev.year) === String(draggedEvent.year) &&
        ev.block !== draggedEvent.block &&
        ev.room === targetRoom && targetRoom !== 'TBA'

      if (isMergeCandidate) {
        wouldMergeWith.push(ev)
        continue
      }

      const types = []
      const roomC    = ev.room === targetRoom && targetRoom !== 'TBA' && !isOnlineRoom(targetRoom)
      const sectionC = draggedEvent.program && draggedEvent.year && draggedEvent.block
        && ev.program === draggedEvent.program
        && String(ev.year) === String(draggedEvent.year)
        && ev.block === draggedEvent.block
      const facultyC = draggedEvent.faculty && draggedEvent.faculty !== 'TBA'
        && ev.faculty === draggedEvent.faculty

      if (roomC)    types.push('Room')
      if (sectionC) types.push('Section')
      if (facultyC) types.push('Faculty')
      if (types.length > 0) conflicting.push({ ...ev, conflictLabel: types.join(' + ') + ' Conflict' })
    }

    if (conflicting.length > 0) {
      setPendingDrop({ draggedEvent, targetRoom, newPeriod, day: targetDay, conflicts: conflicting })
      return
    }

    applyMove(draggedEvent, targetRoom, newPeriod, targetDay)
    setDraggedEvent(null)

    if (wouldMergeWith.length > 0) {
      const partner = wouldMergeWith[0]
      setToast({
        type: 'success',
        icon: 'link',
        message: `Merged: ${draggedEvent.courseCode} ${draggedEvent.program} ${draggedEvent.year}-${draggedEvent.block} + Block ${partner.block} on ${targetDay}`,
      })
    } else if (prevPartner) {
      const otherMerges = events.filter(ev => {
        if (getEventId(ev) === dragId) return false
        return ev.courseCode === draggedEvent.courseCode &&
          ev.program === draggedEvent.program &&
          String(ev.year) === String(draggedEvent.year) &&
          ev.day !== targetDay
      })
      const hasSiblings = otherMerges.length > 0
      setToast({
        type: 'info',
        icon: 'unlink',
        message: hasSiblings
          ? `Unmerged from Block ${prevPartner.block}. ${draggedEvent.courseCode} may still have merged sessions on other days.`
          : `${draggedEvent.courseCode} Block ${draggedEvent.block} unmerged from Block ${prevPartner.block}. Moved to ${targetDay}.`,
      })
    } else {
      setToast({ type: 'success', message: `Moved ${draggedEvent.courseCode} to ${targetDay}` })
    }
  }, [locked, draggedEvent, events, activeDay, applyMove])

  // ── Confirmation modal callbacks ──────────────────────────────────────────
  const confirmDrop = useCallback(() => {
    if (!pendingDrop) return
    const { draggedEvent: ev, targetRoom, newPeriod, day } = pendingDrop
    applyMove(ev, targetRoom, newPeriod, day)
    setPendingDrop(null)
    setToast({ type: 'success', message: `Override saved (pending): ${ev.courseCode} → ${targetRoom}` })
  }, [pendingDrop, applyMove])

  const cancelDrop = useCallback(() => setPendingDrop(null), [])

  // ── Stack-drop handler ────────────────────────────────────────────────────
  const handleDropOnCard = useCallback((e, targetEvent) => {
    e.preventDefault()
    e.stopPropagation()
    if (locked || !draggedEvent) return
    const dragId   = getEventId(draggedEvent)
    const targetId = getEventId(targetEvent)
    if (dragId === targetId) return
    setDraggedEvent(null)
    setHoveredCell(null)
    setPendingStack({ draggedEvent, targetEvent })
  }, [locked, draggedEvent])

  const confirmStack = useCallback(() => {
    if (!pendingStack) return
    const { draggedEvent: ev, targetEvent } = pendingStack
    applyMove(ev, targetEvent.room, targetEvent.period, activeDay)
    setPendingStack(null)
    setToast({
      type: 'success',
      message: `Stacked ${ev.courseCode} with ${targetEvent.courseCode} in ${targetEvent.room}`,
    })
  }, [pendingStack, applyMove, activeDay])

  const cancelStack = useCallback(() => {
    setDraggedEvent(null)
    setPendingStack(null)
  }, [])

  // ── Save all pending overrides to the server ──────────────────────────────
  const saveAllOverrides = useCallback(async () => {
    const overrides = [...pendingOverrides.values()]
    if (overrides.length === 0) return { succeeded: 0, failed: [] }

    // Cancel any pending auto-save timer since we're saving now
    
    
    

    setSaving(true)
    const results = await Promise.allSettled(
      overrides.map(o => overrideFn({
        courseCode: o.courseCode,
        block:      o.block,
        session:    o.session,
        new_room:   o.new_room,
        new_day:    o.new_day,
        new_period: o.new_period,
        new_faculty: o.new_faculty,
      }))
    )
    setSaving(false)

    const failed    = results.map((r, i) => r.status === 'rejected' ? overrides[i] : null).filter(Boolean)
    const succeeded = overrides.length - failed.length

    if (failed.length === 0) {
      setPendingOverrides(new Map())
      setToast({ type: 'success', message: `Saved ${succeeded} change${succeeded !== 1 ? 's' : ''}` })
    } else {
      const failedIds = new Set(failed.map(f => f.id))
      setPendingOverrides(prev => {
        const next = new Map()
        for (const [id, rec] of prev) if (failedIds.has(id)) next.set(id, rec)
        return next
      })
      setToast({ type: 'error', message: `${succeeded} saved, ${failed.length} failed — check network and retry` })
    }
    return { succeeded, failed }
  }, [pendingOverrides, overrideFn])

  // Keep ref always pointing to the latest saveAllOverrides (for the auto-save timer)
  saveRef.current = saveAllOverrides

  // ── Revert a single pending override ──────────────────────────────────────
  const revertOverride = useCallback((id) => {
    const override = pendingOverrides.get(id)
    if (!override) return
    const reverted = events.map(ev =>
      getEventId(ev) !== id ? ev : {
        ...ev,
        room:   override.orig_room,
        day:    override.orig_day,
        period: override.orig_period,
        ...(override.orig_faculty !== undefined ? { faculty: override.orig_faculty } : {})
      }
    )
    setLocalEvents(reverted)
    setEvents(reverted)
    setPendingOverrides(prev => { const n = new Map(prev); n.delete(id); return n })
    setToast({ type: 'success', message: `Reverted: ${override.courseCode}` })
  }, [pendingOverrides, events, setLocalEvents, setEvents])

  // ── Apply edits from SessionModal ─────────────────────────────────────────
  const applyEdits = useCallback((updates) => {
    const arr = Array.isArray(updates) ? updates : [updates]
    
    // Inject startTime and endTime from period string if present
    const processedUpdates = arr.map(u => {
      if (u.period) {
        const [startTime, endTime] = u.period.split(' - ')
        return { ...u, startTime, endTime }
      }
      return u
    })

    const patchMap = new Map(processedUpdates.map(u => [getEventId(u), u]))
    const updatedEvents = events.map(e => patchMap.has(getEventId(e)) ? { ...e, ...patchMap.get(getEventId(e)) } : e)
    
    setLocalEvents(updatedEvents)
    setEvents(updatedEvents)

    setPendingOverrides(prev => {
      const next = new Map(prev)
      for (const updated of processedUpdates) {
        const id = getEventId(updated)
        const existingOverride = next.get(id)
        const oldEvent = events.find(e => getEventId(e) === id) || updated
        
        const origRoom = existingOverride?.orig_room ?? oldEvent.room
        const origDay = existingOverride?.orig_day ?? oldEvent.day
        const origPeriod = existingOverride?.orig_period ?? oldEvent.period
        const origFaculty = existingOverride?.orig_faculty ?? oldEvent.faculty

        const normTime = p => p ? p.replace(/\b0(\d):/g, '$1:') : ''
        const parts = []
        if (updated.day !== origDay) parts.push(updated.day)
        if (normTime(updated.period) !== normTime(origPeriod)) parts.push(updated.period)
        if (updated.room !== origRoom) parts.push(updated.room)
        if (updated.faculty !== origFaculty) parts.push(`Faculty: ${updated.faculty || 'TBA'}`)
        
        const moveDesc = parts.length > 0 ? parts.join(' | ') : 'Unchanged'
        
        // If nothing changed, we could theoretically delete from pendingOverrides,
        // but for now we just register the Unchanged label.
          const sessType = (updated.session || 'CLASS').toUpperCase();
          const progBlock = `${updated.program || ''} ${updated.year || ''}${updated.block || ''}`.replace(/\s+/g, ' ').trim();

          next.set(id, {
            id,
            courseCode: updated.courseCode,
            program: updated.program,
            year: updated.year,
            block: updated.block,
            session: updated.session,
            new_room: updated.room,
            new_day: updated.day,
            new_period: updated.period,
            new_faculty: updated.faculty,
            orig_room: origRoom,
            orig_day: origDay,
            orig_period: origPeriod,
            orig_faculty: origFaculty,
            label: `${updated.courseCode} ${sessType} (${progBlock}) -> ${moveDesc}`
          })
      }
      return next
    })
  }, [events, setLocalEvents, setEvents])

  // ── Revert ALL pending overrides ──────────────────────────────────────────
  const revertAllOverrides = useCallback(() => {
    if (pendingOverrides.size === 0) return

    const reverted = events.map(ev => {
      const id = getEventId(ev)
      const override = pendingOverrides.get(id)
      if (override) {
          return {
            ...ev,
            room:   override.orig_room,
            day:    override.orig_day,
            period: override.orig_period,
            ...(override.orig_faculty !== undefined ? { faculty: override.orig_faculty } : {})
          }
      }
      return ev
    })

    setLocalEvents(reverted)
    setEvents(reverted)
    setPendingOverrides(new Map())
    setToast({ type: 'success', message: 'All pending changes reverted' })
  }, [events, pendingOverrides, setLocalEvents, setEvents])

  // ── Drop-conflict preview (for cell highlight) ────────────────────────────
  const getDropConflict = useCallback((room, slot) => {
    if (!draggedEvent) return null
    const dragRange = parsePeriodRange(draggedEvent.period)
    if (!dragRange) return null
    const newStart = slot.startMinutes
    const newEnd   = newStart + dragRange.duration
    const dragId   = getEventId(draggedEvent)
    const proposed = { start: newStart, end: newEnd }
    const conflictTypes = new Set()
    for (const ev of events) {
      if (getEventId(ev) === dragId || ev.day !== activeDay) continue
      const r = parsePeriodRange(ev.period)
      if (!r || !timeOverlaps(proposed, r)) continue
      if (ev.room === room && room !== 'TBA' && !isOnlineRoom(room)) conflictTypes.add('Room')
      if (draggedEvent.program && ev.program === draggedEvent.program
          && String(ev.year) === String(draggedEvent.year)
          && ev.block === draggedEvent.block) conflictTypes.add('Section')
      if (draggedEvent.faculty && draggedEvent.faculty !== 'TBA'
          && ev.faculty === draggedEvent.faculty) conflictTypes.add('Faculty')
    }
    return conflictTypes.size > 0 ? { label: [...conflictTypes].join(' + ') + ' Conflict' } : null
  }, [draggedEvent, events, activeDay])

  return {
    // Locked (finalized) flag — consumers use this to disable draggable
    // attributes / show a lock cursor, though edits are already blocked
    // functionally regardless of what the UI does with it.
    locked,
    // Drag state
    draggedEvent, hoveredCell, toast, setToast,
    // Drag handlers
    handleDragStart, handleDragEnd, handleDragOver, handleDragLeave, handleDrop, handleDayDrop,
    getDropConflict,
    // Conflict visualization during drag
    conflictingDragIds,
    ambientConflictIds,
    ambientMergeIds,
    dragConflictBands,
    // Conflict confirmation (override modal)
    pendingDrop, confirmDrop, cancelDrop,
    // Stack confirmation (stack-sessions modal)
    pendingStack, handleDropOnCard, confirmStack, cancelStack,
    // Pending override queue
    pendingOverrides,
    saveAllOverrides,
    revertOverride,
    revertAllOverrides,
    applyEdits,
    saving,
    // Auto-save countdown (null = idle, number = seconds remaining)
    
  }
}
