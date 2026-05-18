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

// ── Per-section shade palettes ────────────────────────────────────────────────
//
// DESIGN PRINCIPLE
// ─────────────────
// The PROGRAM is identified by the card's background colour family.
// The BLOCK/SECTION is identified by two strong cues:
//   1. `accent`  — the thick left-stripe colour  (changes dramatically A→F)
//   2. `badgeText` / badge background             (block letter pill on card)
//
// Each entry:
//   bg        – card background  (light, consistent within a program)
//   text      – body text colour
//   border    – subtle card outline
//   accent    – LEFT STRIPE + block-letter badge fill (bold, clearly different per block)
//   badgeText – text colour on the accent badge  (white for dark accents)
//
// Accent hues are chosen at 4 clearly visible stops within each programme's hue
// family.  Blocks E-F cycle back to C-D so 6-block sections still look good.
//
export const PROGRAM_SHADE_PALETTE = {
  // Purple family ──────────────────────────────────────────────
  BSCS: [
    { bg: '#F5F3FF', text: '#4C1D95', border: '#DDD6FE', accent: '#A78BFA', badgeText: '#fff' }, // A — soft violet
    { bg: '#EDE9FE', text: '#3730A3', border: '#C4B5FD', accent: '#7C3AED', badgeText: '#fff' }, // B — medium violet
    { bg: '#E0D9FE', text: '#2E1065', border: '#A78BFA', accent: '#5B21B6', badgeText: '#fff' }, // C — deep violet
    { bg: '#D4C9FD', text: '#1E1065', border: '#8B5CF6', accent: '#3730A3', badgeText: '#fff' }, // D — indigo
    { bg: '#EDE9FE', text: '#3730A3', border: '#C4B5FD', accent: '#7C3AED', badgeText: '#fff' }, // E (≡ B)
    { bg: '#E0D9FE', text: '#2E1065', border: '#A78BFA', accent: '#5B21B6', badgeText: '#fff' }, // F (≡ C)
  ],
  // Amber family ───────────────────────────────────────────────
  BSIT: [
    { bg: '#FFFBEB', text: '#92400E', border: '#FDE68A', accent: '#FBBF24', badgeText: '#78350F' }, // A — gold
    { bg: '#FEF3C7', text: '#78350F', border: '#FCD34D', accent: '#F59E0B', badgeText: '#fff'   }, // B — amber
    { bg: '#FEE9A0', text: '#6D2503', border: '#FBBF24', accent: '#D97706', badgeText: '#fff'   }, // C — deep amber
    { bg: '#FDD87A', text: '#451A03', border: '#F59E0B', accent: '#92400E', badgeText: '#fff'   }, // D — dark brown
    { bg: '#FEF3C7', text: '#78350F', border: '#FCD34D', accent: '#F59E0B', badgeText: '#fff'   }, // E (≡ B)
    { bg: '#FEE9A0', text: '#6D2503', border: '#FBBF24', accent: '#D97706', badgeText: '#fff'   }, // F (≡ C)
  ],
  // Emerald family ─────────────────────────────────────────────
  BSIE: [
    { bg: '#ECFDF5', text: '#065F46', border: '#A7F3D0', accent: '#34D399', badgeText: '#064E3B' }, // A — mint
    { bg: '#D1FAE5', text: '#065F46', border: '#6EE7B7', accent: '#10B981', badgeText: '#fff'   }, // B — emerald
    { bg: '#B8F3D4', text: '#064E3B', border: '#34D399', accent: '#059669', badgeText: '#fff'   }, // C — deep emerald
    { bg: '#9DECBE', text: '#022C22', border: '#10B981', accent: '#047857', badgeText: '#fff'   }, // D — forest
    { bg: '#D1FAE5', text: '#065F46', border: '#6EE7B7', accent: '#10B981', badgeText: '#fff'   }, // E (≡ B)
    { bg: '#B8F3D4', text: '#064E3B', border: '#34D399', accent: '#059669', badgeText: '#fff'   }, // F (≡ C)
  ],
  // Pink family ────────────────────────────────────────────────
  BSECE: [
    { bg: '#FDF2F8', text: '#9D174D', border: '#FBCFE8', accent: '#F472B6', badgeText: '#831843' }, // A — light pink
    { bg: '#FCE7F3', text: '#831843', border: '#F9A8D4', accent: '#EC4899', badgeText: '#fff'   }, // B — hot pink
    { bg: '#FAD3E8', text: '#701A75', border: '#F472B6', accent: '#DB2777', badgeText: '#fff'   }, // C — deep pink
    { bg: '#F8BFDC', text: '#500724', border: '#EC4899', accent: '#9D174D', badgeText: '#fff'   }, // D — burgundy
    { bg: '#FCE7F3', text: '#831843', border: '#F9A8D4', accent: '#EC4899', badgeText: '#fff'   }, // E (≡ B)
    { bg: '#FAD3E8', text: '#701A75', border: '#F472B6', accent: '#DB2777', badgeText: '#fff'   }, // F (≡ C)
  ],
  // Orange family ──────────────────────────────────────────────
  BSIS: [
    { bg: '#FFF7ED', text: '#9A3412', border: '#FED7AA', accent: '#FB923C', badgeText: '#7C2D12' }, // A — peach
    { bg: '#FFEDD5', text: '#7C2D12', border: '#FDBA74', accent: '#F97316', badgeText: '#fff'   }, // B — orange
    { bg: '#FEE0BA', text: '#7C2D12', border: '#FB923C', accent: '#EA580C', badgeText: '#fff'   }, // C — deep orange
    { bg: '#FDD0A0', text: '#431407', border: '#F97316', accent: '#9A3412', badgeText: '#fff'   }, // D — brick
    { bg: '#FFEDD5', text: '#7C2D12', border: '#FDBA74', accent: '#F97316', badgeText: '#fff'   }, // E (≡ B)
    { bg: '#FEE0BA', text: '#7C2D12', border: '#FB923C', accent: '#EA580C', badgeText: '#fff'   }, // F (≡ C)
  ],
  // Green family ───────────────────────────────────────────────
  BSBA: [
    { bg: '#F0FDF4', text: '#166534', border: '#BBF7D0', accent: '#4ADE80', badgeText: '#14532D' }, // A — light green
    { bg: '#DCFCE7', text: '#166534', border: '#86EFAC', accent: '#22C55E', badgeText: '#fff'   }, // B — green
    { bg: '#C6F9D9', text: '#14532D', border: '#4ADE80', accent: '#16A34A', badgeText: '#fff'   }, // C — deep green
    { bg: '#B0F4CB', text: '#052E16', border: '#22C55E', accent: '#15803D', badgeText: '#fff'   }, // D — forest green
    { bg: '#DCFCE7', text: '#166534', border: '#86EFAC', accent: '#22C55E', badgeText: '#fff'   }, // E (≡ B)
    { bg: '#C6F9D9', text: '#14532D', border: '#4ADE80', accent: '#16A34A', badgeText: '#fff'   }, // F (≡ C)
  ],
  // Blue family ────────────────────────────────────────────────
  BSA: [
    { bg: '#EFF6FF', text: '#1E40AF', border: '#BFDBFE', accent: '#60A5FA', badgeText: '#1E3A8A' }, // A — sky
    { bg: '#DBEAFE', text: '#1E3A8A', border: '#93C5FD', accent: '#3B82F6', badgeText: '#fff'   }, // B — blue
    { bg: '#C5DEFE', text: '#1E3A8A', border: '#60A5FA', accent: '#2563EB', badgeText: '#fff'   }, // C — deep blue
    { bg: '#AECFFE', text: '#1E3A8A', border: '#3B82F6', accent: '#1D4ED8', badgeText: '#fff'   }, // D — navy
    { bg: '#DBEAFE', text: '#1E3A8A', border: '#93C5FD', accent: '#3B82F6', badgeText: '#fff'   }, // E (≡ B)
    { bg: '#C5DEFE', text: '#1E3A8A', border: '#60A5FA', accent: '#2563EB', badgeText: '#fff'   }, // F (≡ C)
  ],
  // Sky / cyan family ──────────────────────────────────────────
  'BSEMC-DAT': [
    { bg: '#F0F9FF', text: '#0369A1', border: '#BAE6FD', accent: '#38BDF8', badgeText: '#075985' }, // A — sky
    { bg: '#E0F2FE', text: '#075985', border: '#7DD3FC', accent: '#0EA5E9', badgeText: '#fff'   }, // B — cerulean
    { bg: '#CCE9FD', text: '#075985', border: '#38BDF8', accent: '#0284C7', badgeText: '#fff'   }, // C — deep sky
    { bg: '#B7DEFC', text: '#0C4A6E', border: '#0EA5E9', accent: '#0369A1', badgeText: '#fff'   }, // D — dark sky
    { bg: '#E0F2FE', text: '#075985', border: '#7DD3FC', accent: '#0EA5E9', badgeText: '#fff'   }, // E (≡ B)
    { bg: '#CCE9FD', text: '#075985', border: '#38BDF8', accent: '#0284C7', badgeText: '#fff'   }, // F (≡ C)
  ],
  // Teal family ────────────────────────────────────────────────
  'BSEMC-GD': [
    { bg: '#F0FDF9', text: '#0F766E', border: '#99F6E4', accent: '#2DD4BF', badgeText: '#134E4A' }, // A — light teal
    { bg: '#CCFBF1', text: '#0F766E', border: '#5EEAD4', accent: '#14B8A6', badgeText: '#fff'   }, // B — teal
    { bg: '#ADFAE7', text: '#0D6C65', border: '#2DD4BF', accent: '#0D9488', badgeText: '#fff'   }, // C — deep teal
    { bg: '#8EF7DA', text: '#134E4A', border: '#14B8A6', accent: '#0F766E', badgeText: '#fff'   }, // D — forest teal
    { bg: '#CCFBF1', text: '#0F766E', border: '#5EEAD4', accent: '#14B8A6', badgeText: '#fff'   }, // E (≡ B)
    { bg: '#ADFAE7', text: '#0D6C65', border: '#2DD4BF', accent: '#0D9488', badgeText: '#fff'   }, // F (≡ C)
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