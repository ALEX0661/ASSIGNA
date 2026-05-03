// ── Constants ─────────────────────────────────────────────────────────────────
export const DAYS           = ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday', 'Sunday']
export const YEAR_LABEL     = { 1: '1st Year', 2: '2nd Year', 3: '3rd Year', 4: '4th Year' }
export const SLOT_HEIGHT    = 56
export const COMPACT_SLOT_H = 18
export const COMPACT_ROOM_W = 115
export const COMPACT_TIME_W = 44
export const COMPACT_HEADER_H = 22
export const NORMAL_HEADER_H  = 31
export const SLOT_MINUTES   = 30
export const DAY_START_HOUR = 7
export const DAY_END_HOUR   = 21

export const PROGRAM_COLORS = {
  BSCS:  { bg: '#EDE9FB', text: '#5b21b6', border: '#C4B8F5' },
  BSIT:  { bg: '#fef3c7', text: '#92400e', border: '#f59e0b' },
  BSIE:  { bg: '#d1fae5', text: '#065f46', border: '#34d399' },
  BSECE: { bg: '#fce7f3', text: '#9d174d', border: '#f472b6' },
  BSIS:  { bg: '#fff7ed', text: '#9a3412', border: '#fb923c' },
  BSBA:  { bg: '#ecfdf5', text: '#166534', border: '#86efac' },
  BSA:   { bg: '#eff6ff', text: '#1e40af', border: '#93c5fd' },
}

export function programColor(program) {
  return PROGRAM_COLORS[program?.toUpperCase()] ?? { bg: '#f3f4f6', text: '#374151', border: '#9ca3af' }
}

// ── Time helpers ──────────────────────────────────────────────────────────────
export function parseTimeToMinutes(timeStr) {
  if (!timeStr) return 0
  const m = timeStr.match(/(\d{1,2}):(\d{2})\s*(AM|PM)?/i)
  if (!m) return 0
  let h = parseInt(m[1])
  const min  = parseInt(m[2])
  const ampm = m[3]?.toUpperCase()
  if (ampm === 'PM' && h !== 12) h += 12
  if (ampm === 'AM' && h === 12) h = 0
  return h * 60 + min
}

export function parsePeriodRange(period) {
  if (!period) return null
  const parts = period.split(' - ')
  if (parts.length < 2) return null
  const start = parseTimeToMinutes(parts[0].trim())
  const end   = parseTimeToMinutes(parts[1].trim())
  return { start, end, duration: end - start }
}

export function minutesToTimeLabel(minutes) {
  const h       = Math.floor(minutes / 60)
  const m       = minutes % 60
  const ampm    = h >= 12 ? 'PM' : 'AM'
  const displayH = h > 12 ? h - 12 : h === 0 ? 12 : h
  return `${displayH}:${m.toString().padStart(2, '0')} ${ampm}`
}

export function buildTimeSlots() {
  const slots = []
  for (let m = DAY_START_HOUR * 60; m < DAY_END_HOUR * 60; m += SLOT_MINUTES)
    slots.push({ startMinutes: m, label: minutesToTimeLabel(m) })
  return slots
}

export const TIME_SLOTS = buildTimeSlots()
export const GRID_START = DAY_START_HOUR * 60

export function getEventStyle(period, slotH = SLOT_HEIGHT) {
  const range = parsePeriodRange(period)
  if (!range) return { top: 0, height: slotH }
  const top    = ((range.start - GRID_START) / SLOT_MINUTES) * slotH
  const height = Math.max((range.duration / SLOT_MINUTES) * slotH, slotH * 0.8)
  return { top, height }
}

// ── Merged helpers ────────────────────────────────────────────────────────────
//
// Merge detection is now purely positional: two events are "merged" when they
// share the same courseCode + program + year + room + day + period but belong
// to different blocks.  No special schedule_id suffix is required.
//
// Legacy -A/-B suffixes (from the old router) are still recognised as a
// fallback so existing saved schedules continue to display correctly.

/** @deprecated legacy — use areMergePartners / findMergePartner instead */
export function isMergedEvent(event) {
  if (!event?.schedule_id) return false
  return /\-[A-Z]$/.test(String(event.schedule_id))
}

/** @deprecated legacy */
export function getBaseMergedId(scheduleId) {
  return String(scheduleId).replace(/\-[A-Z]$/, '')
}

/** @deprecated legacy */
export function getMergeSuffix(scheduleId) {
  const m = String(scheduleId ?? '').match(/\-([A-Z])$/)
  return m ? m[1] : null
}

/**
 * Returns true when two events are merge partners — i.e. they represent the
 * same class meeting shared across two different blocks.
 *
 * Primary (positional) rule:
 *   same courseCode + program + year + room + day + period, different block.
 *
 * Legacy fallback:
 *   both have -letter suffixes and share the same numeric base id.
 */
export function areMergePartners(ea, eb) {
  if (!ea || !eb) return false
  if (getEventId(ea) === getEventId(eb)) return false

  // Positional rule — the primary, drag-and-drop-based detection
  if (
    ea.courseCode && eb.courseCode === ea.courseCode &&
    ea.program    && ea.program    === eb.program    &&
    ea.year !== undefined && String(ea.year) === String(eb.year) &&
    ea.block !== eb.block &&
    ea.room && ea.room !== 'TBA' && ea.room === eb.room &&
    ea.day  && ea.day  === eb.day  &&
    ea.period && ea.period === eb.period
  ) return true

  // Legacy schedule_id suffix rule
  if (isMergedEvent(ea) && isMergedEvent(eb) &&
      getBaseMergedId(ea.schedule_id) === getBaseMergedId(eb.schedule_id))
    return true

  return false
}

/**
 * Returns the first event in `allEvents` that is a merge partner of `event`,
 * or null if none exists.
 */
export function findMergePartner(event, allEvents) {
  if (!event || !allEvents) return null
  return allEvents.find(ev => areMergePartners(event, ev)) ?? null
}

/**
 * Returns a Set of event IDs that currently have a merge partner.
 * Used to drive the "Merged" filter and badge efficiently.
 */
export function getMergedIds(allEvents) {
  const ids = new Set()
  for (let i = 0; i < allEvents.length; i++) {
    if (ids.has(getEventId(allEvents[i]))) continue          // already confirmed
    for (let j = i + 1; j < allEvents.length; j++) {
      if (areMergePartners(allEvents[i], allEvents[j])) {
        ids.add(getEventId(allEvents[i]))
        ids.add(getEventId(allEvents[j]))
      }
    }
  }
  return ids
}

// ── Conflict helpers ──────────────────────────────────────────────────────────
export function getEventId(event) {
  return event.schedule_id ?? `${event.courseCode}-${event.block}-${event.session}-${event.day}`
}

export function timeOverlaps(a, b) {
  return a.start < b.end && a.end > b.start
}

export function getConflictTypes(ea, eb) {
  const types = []
  if (ea.room && ea.room !== 'TBA' && eb.room && eb.room !== 'TBA' && ea.room === eb.room)
    types.push('Room')
  if (ea.program && ea.year && ea.block &&
      ea.program === eb.program &&
      String(ea.year) === String(eb.year) &&
      ea.block === eb.block)
    types.push('Section')
  if (ea.faculty && ea.faculty !== 'TBA' && eb.faculty && eb.faculty !== 'TBA' && ea.faculty === eb.faculty)
    types.push('Faculty')
  return types
}

export function buildConflictMap(events) {
  const map = new Map()
  for (let i = 0; i < events.length; i++) {
    for (let j = i + 1; j < events.length; j++) {
      const ea = events[i], eb = events[j]
      if (ea.day !== eb.day) continue
      const ra = parsePeriodRange(ea.period), rb = parsePeriodRange(eb.period)
      if (!ra || !rb || !timeOverlaps(ra, rb)) continue
      // Skip merge partners — they share room/time by design and must never conflict
      if (areMergePartners(ea, eb)) continue
      const types = getConflictTypes(ea, eb)
      if (types.length === 0) continue
      const conflictLabel = types.join(' + ') + ' Conflict'
      const addEntry = (ev, peer) => {
        const id = getEventId(ev)
        if (!map.has(id)) map.set(id, { label: conflictLabel, peers: [] })
        const entry = map.get(id)
        const existingTypes = new Set(entry.label.replace(' Conflict', '').split(' + '))
        types.forEach(t => existingTypes.add(t))
        entry.label = [...existingTypes].join(' + ') + ' Conflict'
        if (!entry.peers.find(p => getEventId(p.event) === getEventId(peer)))
          entry.peers.push({ event: peer, conflictLabel })
      }
      addEntry(ea, eb); addEntry(eb, ea)
    }
  }
  return map
}

export function findConflicts(allEvents, { evId, day, startMin, endMin, room, faculty, program, year, block }) {
  const proposed  = { start: startMin, end: endMin }
  const results   = []

  // Build a temporary stub so areMergePartners can compare positionally
  const stub = { schedule_id: evId, courseCode: null, program, year, block, room, day, period: null }

  for (const ev of allEvents) {
    const candidateId = getEventId(ev)

    if (candidateId === evId) continue
    if (ev.day !== day)      continue

    // Skip merge partners — they intentionally share room/time with this event
    if (areMergePartners({ schedule_id: evId, program, year, block, room, day }, ev)) continue

    const r = parsePeriodRange(ev.period)
    if (!r || !timeOverlaps(proposed, r)) continue

    const types = []
    if (room    && room    !== 'TBA' && ev.room    === room)    types.push('Room')
    if (faculty && faculty !== 'TBA' && ev.faculty === faculty) types.push('Faculty')
    if (program && year !== undefined && block &&
        ev.program === program &&
        String(ev.year) === String(year) &&
        ev.block === block)                                      types.push('Section')
    if (types.length > 0) results.push({ ...ev, conflictLabel: types.join(' + ') + ' Conflict' })
  }
  return results
}