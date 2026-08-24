/**
 * roomAvailability.js
 *
 * Computes, per room, which time ranges are free on a given day.
 *
 * IMPORTANT: always call this with the FULL unfiltered event list
 * (`allEvents`, not `dayEvents`) so that "available" reflects true
 * occupancy — not just what happens to be visible under the currently
 * active program/year/faculty/etc. filters. Filters narrow what's
 * *shown*; they should never change what actually counts as "free".
 */
import { isOnlineRoom, parsePeriodRange, minutesToTimeLabel, DAY_START_HOUR, DAY_END_HOUR } from '../components/ScheduleView/svHelpers'

/**
 * @param {object[]} allEvents   – full unfiltered event list
 * @param {object}   masterRooms – { lecture: string[], lab: string[] }
 * @param {string}   day         – e.g. 'Monday'
 * @returns {{ room:string, type:'lecture'|'lab'|'other', busy:{start:number,end:number}[], free:{start:number,end:number}[], fullyFree:boolean }[]}
 */
export function computeRoomAvailability(allEvents, masterRooms, day) {
  const dayStart = DAY_START_HOUR * 60
  const dayEnd   = DAY_END_HOUR   * 60

  const dayRoomEvents = allEvents.filter(
    e => e.day === day && e.room && e.room !== 'TBA' && !isOnlineRoom(e.room)
  )

  const rooms = [
    ...(masterRooms.lecture || []).map(r => ({ room: r, type: 'lecture' })),
    ...(masterRooms.lab     || []).map(r => ({ room: r, type: 'lab' })),
  ]
  // Include any room actually in use but missing from the master list
  dayRoomEvents.forEach(ev => {
    if (!rooms.find(r => r.room === ev.room)) rooms.push({ room: ev.room, type: 'other' })
  })

  return rooms.map(({ room, type }) => {
    const busy = dayRoomEvents
      .filter(e => e.room === room)
      .map(e => parsePeriodRange(e.period))
      .filter(Boolean)
      .sort((a, b) => a.start - b.start)

    // Merge overlapping / back-to-back busy ranges
    const merged = []
    busy.forEach(r => {
      const last = merged[merged.length - 1]
      if (last && r.start <= last.end) last.end = Math.max(last.end, r.end)
      else merged.push({ start: r.start, end: r.end })
    })

    // Free gaps within the day's operating window
    const free = []
    let cursor = dayStart
    merged.forEach(b => {
      if (b.start > cursor) free.push({ start: cursor, end: b.start })
      cursor = Math.max(cursor, b.end)
    })
    if (cursor < dayEnd) free.push({ start: cursor, end: dayEnd })

    return { room, type, busy: merged, free, fullyFree: merged.length === 0 }
  })
}

export function formatFreeSlots(free) {
  if (!free.length) return 'Fully booked'
  return free.map(f => `${minutesToTimeLabel(f.start)} – ${minutesToTimeLabel(f.end)}`).join(', ')
}

/** Total free minutes across all gaps — used for sorting/reporting. */
export function totalFreeMinutes(free) {
  return free.reduce((sum, f) => sum + (f.end - f.start), 0)
}