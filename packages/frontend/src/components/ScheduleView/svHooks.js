import { useState, useMemo, useCallback, useEffect, useRef } from 'react'
import { overrideSession } from '../../services/api'
import { parsePeriodRange, minutesToTimeLabel, getEventId, timeOverlaps, buildConflictMap, areMergePartners } from './svHelpers'

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
export function useDragDrop(events, activeDay, setLocalEvents, setEvents, storeEvents) {
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
  const [autoSaveIn,         setAutoSaveIn]        = useState(null)   // countdown seconds (null = idle)
  const autoSaveTimerRef    = useRef(null)
  const autoSaveIntervalRef = useRef(null)
  // Always points to the latest saveAllOverrides — updated each render below
  const saveRef             = useRef(null)
  // Stable ref for scheduleAutoSave so applyMove can reference it
  const scheduleAutoSaveRef = useRef(null)

  // ── Clean up timers on unmount ─────────────────────────────────────────────
  useEffect(() => () => {
    if (autoSaveTimerRef.current)    clearTimeout(autoSaveTimerRef.current)
    if (autoSaveIntervalRef.current) clearInterval(autoSaveIntervalRef.current)
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
    setDraggedEvent(event)
    e.dataTransfer.effectAllowed = 'move'
    e.dataTransfer.setData('text/plain', getEventId(event))
  }, [])

  const handleDragEnd = useCallback(() => {
    // Small delay so the drop handler (if any) runs first without a flicker
    setTimeout(() => {
      setDraggedEvent(null)
      setHoveredCell(null)
    }, 30)
  }, [])

  const handleDragOver = useCallback((e, room, slot) => {
    e.preventDefault(); e.dataTransfer.dropEffect = 'move'
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

      const roomC    = ev.room === hRoom && hRoom !== 'TBA'
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

  // ── Auto-save: 5-second countdown then save ────────────────────────────────
  // Called after every successful applyMove.
  // Resets the timer if another move happens before the 5 seconds elapse.
  const scheduleAutoSave = useCallback(() => {
    if (autoSaveTimerRef.current)    clearTimeout(autoSaveTimerRef.current)
    if (autoSaveIntervalRef.current) clearInterval(autoSaveIntervalRef.current)

    let secs = 5
    setAutoSaveIn(secs)

    autoSaveIntervalRef.current = setInterval(() => {
      secs -= 1
      if (secs <= 0) {
        clearInterval(autoSaveIntervalRef.current)
        setAutoSaveIn(null)
      } else {
        setAutoSaveIn(secs)
      }
    }, 1000)

    autoSaveTimerRef.current = setTimeout(() => {
      clearInterval(autoSaveIntervalRef.current)
      setAutoSaveIn(null)
      saveRef.current?.()
    }, 5000)
  }, [])

  // Keep ref always pointing to the latest scheduleAutoSave (stable after mount)
  scheduleAutoSaveRef.current = scheduleAutoSave

  // ── Apply a move to local state + enqueue as pending override ─────────────
  const applyMove = useCallback((event, targetRoom, newPeriod, day) => {
    const dragId = getEventId(event)
    const updated = events.map(ev =>
      getEventId(ev) !== dragId ? ev : { ...ev, room: targetRoom, period: newPeriod, day }
    )
    setLocalEvents(updated)
    setEvents(updated)

    setPendingOverrides(prev => {
      const next = new Map(prev)
      const existing = next.get(dragId)
      next.set(dragId, {
        id:         dragId,
        courseCode: event.courseCode,
        block:      event.block,
        session:    event.session,
        new_room:   targetRoom,
        new_day:    day,
        new_period: newPeriod,
        orig_room:   existing?.orig_room   ?? event.room,
        orig_day:    existing?.orig_day    ?? event.day,
        orig_period: existing?.orig_period ?? event.period,
        label: `${event.courseCode} (${event.program} ${event.year}-${event.block}) → ${targetRoom}`,
      })
      return next
    })

    // Kick off (or reset) the auto-save countdown
    scheduleAutoSaveRef.current?.()
  }, [events, setLocalEvents, setEvents])

  // ── Drop handler — allows conflicting drops via confirmation ──────────────
  const handleDrop = useCallback((e, targetRoom, slot) => {
    e.preventDefault(); setHoveredCell(null)
    if (!draggedEvent) return
    const dragRange = parsePeriodRange(draggedEvent.period)
    if (!dragRange) return
    const newStart  = slot.startMinutes
    const newEnd    = newStart + dragRange.duration
    const newPeriod = `${minutesToTimeLabel(newStart)} - ${minutesToTimeLabel(newEnd)}`
    if (draggedEvent.room === targetRoom && dragRange.start === newStart) return

    const dragId   = getEventId(draggedEvent)
    const proposed = { start: newStart, end: newEnd }

    const prevPartner = events.find(ev => {
      if (getEventId(ev) === dragId || ev.day !== activeDay) return false
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
      const roomC    = ev.room === targetRoom && targetRoom !== 'TBA'
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
  }, [draggedEvent, events, activeDay, applyMove])

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
    if (!draggedEvent) return
    const dragId   = getEventId(draggedEvent)
    const targetId = getEventId(targetEvent)
    if (dragId === targetId) return
    setDraggedEvent(null)
    setHoveredCell(null)
    setPendingStack({ draggedEvent, targetEvent })
  }, [draggedEvent])

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
    if (autoSaveTimerRef.current)    clearTimeout(autoSaveTimerRef.current)
    if (autoSaveIntervalRef.current) clearInterval(autoSaveIntervalRef.current)
    setAutoSaveIn(null)

    setSaving(true)
    const results = await Promise.allSettled(
      overrides.map(o => overrideSession({
        courseCode: o.courseCode,
        block:      o.block,
        session:    o.session,
        new_room:   o.new_room,
        new_day:    o.new_day,
        new_period: o.new_period,
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
  }, [pendingOverrides])

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
      }
    )
    setLocalEvents(reverted)
    setEvents(reverted)
    setPendingOverrides(prev => { const n = new Map(prev); n.delete(id); return n })
    setToast({ type: 'success', message: `Reverted: ${override.courseCode}` })
  }, [pendingOverrides, events, setLocalEvents, setEvents])

  // ── Revert ALL pending overrides ──────────────────────────────────────────
  const revertAllOverrides = useCallback(() => {
    // Cancel auto-save
    if (autoSaveTimerRef.current)    clearTimeout(autoSaveTimerRef.current)
    if (autoSaveIntervalRef.current) clearInterval(autoSaveIntervalRef.current)
    setAutoSaveIn(null)

    setLocalEvents(storeEvents)
    setEvents(storeEvents)
    setPendingOverrides(new Map())
    setToast({ type: 'success', message: 'All pending changes reverted' })
  }, [storeEvents, setLocalEvents, setEvents])

  // ── Drop-conflict preview (for cell highlight) ────────────────────────────
  const getDropConflict = useCallback((room, slot) => {
    if (!draggedEvent || !hoveredCell) return null
    const [hRoom, hSlot] = hoveredCell.split('|')
    if (hRoom !== room || parseInt(hSlot) !== slot.startMinutes) return null
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
      if (ev.room === room && room !== 'TBA') conflictTypes.add('Room')
      if (draggedEvent.program && ev.program === draggedEvent.program
          && String(ev.year) === String(draggedEvent.year)
          && ev.block === draggedEvent.block) conflictTypes.add('Section')
      if (draggedEvent.faculty && draggedEvent.faculty !== 'TBA'
          && ev.faculty === draggedEvent.faculty) conflictTypes.add('Faculty')
    }
    return conflictTypes.size > 0 ? { label: [...conflictTypes].join(' + ') + ' Conflict' } : null
  }, [draggedEvent, hoveredCell, events, activeDay])

  return {
    // Drag state
    draggedEvent, hoveredCell, toast, setToast,
    // Drag handlers
    handleDragStart, handleDragEnd, handleDragOver, handleDragLeave, handleDrop,
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
    saving,
    // Auto-save countdown (null = idle, number = seconds remaining)
    autoSaveIn,
  }
}