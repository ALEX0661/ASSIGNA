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

// ── Base program colors (used as fallback when no block is known) ─────────────
export const PROGRAM_COLORS = {
  BSCS:        { bg: '#EDE9FB', text: '#5b21b6', border: '#C4B8F5' },
  BSIT:        { bg: '#FEF3C7', text: '#92400e', border: '#F59E0B' },
  BSIE:        { bg: '#D1FAE5', text: '#065f46', border: '#34D399' },
  BSECE:       { bg: '#FCE7F3', text: '#9d174d', border: '#F472B6' },
  BSIS:        { bg: '#FFEDD5', text: '#9a3412', border: '#FB923C' },
  BSBA:        { bg: '#DCFCE7', text: '#166534', border: '#86EFAC' },
  BSA:         { bg: '#DBEAFE', text: '#1e40af', border: '#93C5FD' },
  'BSEMC-DAT': { bg: '#E0F2FE', text: '#0369a1', border: '#7DD3FC' },
  'BSEMC-GD':  { bg: '#CCFBF1', text: '#0f766e', border: '#5EEAD4' },
}

// ── Per-section shade palettes — 6 shades (A → F), light → slightly deeper ───
// bg stays readable; border/accent varies to give each block a distinct identity.
export const PROGRAM_SHADE_PALETTE = {
  BSCS: [
    { bg: '#EDE9FB', text: '#5b21b6', border: '#C4B8F5' }, // A — lightest
    { bg: '#E3DAFA', text: '#4c1d95', border: '#B09EF0' }, // B
    { bg: '#D8CFF8', text: '#3730a3', border: '#9C84EB' }, // C
    { bg: '#CEC3F6', text: '#312e81', border: '#8870E6' }, // D
    { bg: '#C3B8F3', text: '#1e1b4b', border: '#745CE1' }, // E
    { bg: '#B8ACF1', text: '#1e1b4b', border: '#6048DC' }, // F — deepest accent
  ],
  BSIT: [
    { bg: '#FFFBEB', text: '#92400e', border: '#FDE68A' }, // A
    { bg: '#FEF3C7', text: '#92400e', border: '#F9C954' }, // B
    { bg: '#FDE68A', text: '#78350f', border: '#F59E0B' }, // C
    { bg: '#FCD34D', text: '#78350f', border: '#D97706' }, // D
    { bg: '#FBC838', text: '#6d2503', border: '#B45309' }, // E
    { bg: '#FABD22', text: '#451a03', border: '#92400E' }, // F
  ],
  BSIE: [
    { bg: '#F0FDF4', text: '#065f46', border: '#BBF7D0' }, // A
    { bg: '#D1FAE5', text: '#065f46', border: '#6EE7B7' }, // B
    { bg: '#BFF5D7', text: '#064e3b', border: '#34D399' }, // C
    { bg: '#ADECCA', text: '#064e3b', border: '#10B981' }, // D
    { bg: '#9BE4BC', text: '#022c22', border: '#059669' }, // E
    { bg: '#89DBAF', text: '#022c22', border: '#047857' }, // F
  ],
  BSECE: [
    { bg: '#FDF2F8', text: '#9d174d', border: '#F9A8D4' }, // A
    { bg: '#FCE7F3', text: '#9d174b', border: '#F472B6' }, // B
    { bg: '#FAD8EA', text: '#831843', border: '#EC4899' }, // C
    { bg: '#F8C9E1', text: '#831843', border: '#DB2777' }, // D
    { bg: '#F6BAD8', text: '#500724', border: '#BE185D' }, // E
    { bg: '#F4ABCF', text: '#500724', border: '#9D174D' }, // F
  ],
  BSIS: [
    { bg: '#FFF7ED', text: '#9a3412', border: '#FED7AA' }, // A
    { bg: '#FFEDD5', text: '#9a3412', border: '#FDBA74' }, // B
    { bg: '#FDDFC0', text: '#7c2d12', border: '#FB923C' }, // C
    { bg: '#FBD1AB', text: '#7c2d12', border: '#F97316' }, // D
    { bg: '#FAC396', text: '#431407', border: '#EA580C' }, // E
    { bg: '#F8B581', text: '#431407', border: '#C2410C' }, // F
  ],
  BSBA: [
    { bg: '#F0FDF4', text: '#166534', border: '#BBF7D0' }, // A
    { bg: '#DCFCE7', text: '#166534', border: '#86EFAC' }, // B
    { bg: '#C8F9D9', text: '#14532D', border: '#4ADE80' }, // C
    { bg: '#B4F5CB', text: '#14532D', border: '#22C55E' }, // D
    { bg: '#A0F2BD', text: '#052e16', border: '#16A34A' }, // E
    { bg: '#8CEEAF', text: '#052e16', border: '#15803D' }, // F
  ],
  BSA: [
    { bg: '#EFF6FF', text: '#1e40af', border: '#BFDBFE' }, // A
    { bg: '#DBEAFE', text: '#1e40af', border: '#93C5FD' }, // B
    { bg: '#C9DDFF', text: '#1e3a8a', border: '#60A5FA' }, // C
    { bg: '#B8D0FF', text: '#1e3a8a', border: '#3B82F6' }, // D
    { bg: '#A7C3FF', text: '#1e3a8a', border: '#2563EB' }, // E
    { bg: '#96B6FF', text: '#1e3a8a', border: '#1D4ED8' }, // F
  ],
  'BSEMC-DAT': [
    { bg: '#F0F9FF', text: '#0369a1', border: '#BAE6FD' }, // A
    { bg: '#E0F2FE', text: '#0369a1', border: '#7DD3FC' }, // B
    { bg: '#CDE9FD', text: '#075985', border: '#38BDF8' }, // C
    { bg: '#BAE0FB', text: '#075985', border: '#0EA5E9' }, // D
    { bg: '#A8D7FA', text: '#0C4A6E', border: '#0284C7' }, // E
    { bg: '#95CDF8', text: '#0C4A6E', border: '#0369A1' }, // F
  ],
  'BSEMC-GD': [
    { bg: '#F0FDF9', text: '#0f766e', border: '#99F6E4' }, // A
    { bg: '#CCFBF1', text: '#0f766e', border: '#5EEAD4' }, // B
    { bg: '#B9F7E9', text: '#0d6c65', border: '#2DD4BF' }, // C
    { bg: '#A6F3E2', text: '#0d6c65', border: '#14B8A6' }, // D
    { bg: '#93EFDA', text: '#134E4A', border: '#0D9488' }, // E
    { bg: '#80EBD3', text: '#134E4A', border: '#0F766E' }, // F
  ],
}

/**
 * Returns the color palette entry for a specific program + block combination.
 * Block 'A' → shade 0 (lightest), 'B' → shade 1, etc., cycling if > 6 blocks.
 * Falls back to the flat programColor() when no palette exists for the program.
 */
export function sectionColor(program, block) {
  const key     = program?.toUpperCase()
  const palette = PROGRAM_SHADE_PALETTE[key]
  if (!palette) return programColor(program)
  const letter = (block || 'A').toString().toUpperCase()
  const idx    = Math.max(0, letter.charCodeAt(0) - 65) % palette.length
  return palette[idx]
}

export function programColor(program) {
  const key = program?.toUpperCase()
  return PROGRAM_COLORS[key] ?? { bg: '#f3f4f6', text: '#374151', border: '#9ca3af' }
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

export function areMergePartners(ea, eb) {
  if (!ea || !eb) return false
  if (getEventId(ea) === getEventId(eb)) return false

  if (
    ea.courseCode && eb.courseCode === ea.courseCode &&
    ea.program    && ea.program    === eb.program    &&
    ea.year !== undefined && String(ea.year) === String(eb.year) &&
    ea.block !== eb.block &&
    ea.room && ea.room !== 'TBA' && ea.room === eb.room &&
    ea.day  && ea.day  === eb.day  &&
    ea.period && ea.period === eb.period
  ) return true

  if (isMergedEvent(ea) && isMergedEvent(eb) &&
      getBaseMergedId(ea.schedule_id) === getBaseMergedId(eb.schedule_id))
    return true

  return false
}

export function findMergePartner(event, allEvents) {
  if (!event || !allEvents) return null
  return allEvents.find(ev => areMergePartners(event, ev)) ?? null
}

export function getMergedIds(allEvents) {
  const ids = new Set()
  for (let i = 0; i < allEvents.length; i++) {
    if (ids.has(getEventId(allEvents[i]))) continue
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

  for (const ev of allEvents) {
    const candidateId = getEventId(ev)
    if (candidateId === evId) continue
    if (ev.day !== day)      continue
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