/**
 * exportScheduleToICS.js
 *
 * Exports schedule events as an .ics file for import into a personal
 * calendar (Google Calendar, Outlook, Apple Calendar, etc.).
 *
 * Each schedule event becomes one recurring VEVENT: it's anchored to the
 * next occurrence of its day-of-week and repeats weekly (RRULE) for a
 * configurable number of weeks — approximating a semester.
 *
 * Usage:
 *   await exportScheduleToICS(events, 'My Schedule')
 *   await exportScheduleToICS(events, 'My Schedule', { weeks: 18, startDate: new Date('2026-08-10') })
 */

const DAY_TO_ICS = {
  Sunday: 'SU', Monday: 'MO', Tuesday: 'TU', Wednesday: 'WE',
  Thursday: 'TH', Friday: 'FR', Saturday: 'SA',
}
const DAY_INDEX = {
  Sunday: 0, Monday: 1, Tuesday: 2, Wednesday: 3, Thursday: 4, Friday: 5, Saturday: 6,
}

function pad(n) { return String(n).padStart(2, '0') }

function fmtDateLocal(d) {
  return `${d.getFullYear()}${pad(d.getMonth() + 1)}${pad(d.getDate())}`
}
function fmtDateTimeLocal(d) {
  return `${fmtDateLocal(d)}T${pad(d.getHours())}${pad(d.getMinutes())}00`
}
function fmtDateTimeUTC(d) {
  return `${d.getUTCFullYear()}${pad(d.getUTCMonth() + 1)}${pad(d.getUTCDate())}T${pad(d.getUTCHours())}${pad(d.getUTCMinutes())}${pad(d.getUTCSeconds())}Z`
}

/** "7:00 AM" | "1:30PM" → { h, m } in 24h, or null on failure */
function parseClock(str) {
  const m = (str || '').trim().match(/^(\d{1,2}):(\d{2})\s*(AM|PM)$/i)
  if (!m) return null
  let h = parseInt(m[1], 10)
  const min = parseInt(m[2], 10)
  const ap = m[3].toUpperCase()
  if (ap === 'PM' && h !== 12) h += 12
  if (ap === 'AM' && h === 12) h = 0
  return { h, m: min }
}

/** Next date (>= from, inclusive) that falls on the given weekday name. */
function nextWeekday(from, dayName) {
  const target = DAY_INDEX[dayName]
  if (target === undefined) return new Date(from)
  const d = new Date(from.getFullYear(), from.getMonth(), from.getDate())
  const diff = (target - d.getDay() + 7) % 7
  d.setDate(d.getDate() + diff)
  return d
}

function escapeText(str = '') {
  return String(str)
    .replace(/\\/g, '\\\\')
    .replace(/;/g, '\\;')
    .replace(/,/g, '\\,')
    .replace(/\n/g, '\\n')
}

/** Fold lines longer than 75 octets per RFC 5545. */
function foldLine(line) {
  if (line.length <= 75) return line
  const chunks = []
  let i = 0
  while (i < line.length) {
    const size = i === 0 ? 75 : 74
    chunks.push((i === 0 ? '' : ' ') + line.slice(i, i + size))
    i += size
  }
  return chunks.join('\r\n')
}

/**
 * @param {object[]} events  – flat schedule events (day, period, courseCode, title, room, faculty, program, year, block, session)
 * @param {string}   name    – used as the downloaded file name
 * @param {object}   [opts]
 * @param {Date}     [opts.startDate] – anchor date; defaults to today
 * @param {number}   [opts.weeks]     – weeks to repeat; defaults to 15 (~1 semester)
 */
export async function exportScheduleToICS(events, name = 'schedule', opts = {}) {
  if (!events?.length) return

  const startDate = opts.startDate ?? new Date()
  const weeks     = opts.weeks ?? 15
  const dtstamp   = fmtDateTimeUTC(new Date())

  const lines = [
    'BEGIN:VCALENDAR',
    'VERSION:2.0',
    'PRODID:-//Schedule System//Export//EN',
    'CALSCALE:GREGORIAN',
  ]

  events.forEach((ev, idx) => {
    if (!ev.day || !DAY_TO_ICS[ev.day]) return

    const [rawStart = '', rawEnd = ''] = (ev.period || '').split(' - ')
    const startClock = parseClock(rawStart.trim())
    const endClock   = parseClock(rawEnd.trim())
    if (!startClock || !endClock) return // skip malformed rows (e.g. no period set yet)

    const eventDate = nextWeekday(startDate, ev.day)
    const dtStart = new Date(eventDate); dtStart.setHours(startClock.h, startClock.m, 0, 0)
    const dtEnd   = new Date(eventDate); dtEnd.setHours(endClock.h,   endClock.m,   0, 0)

    const untilDate = new Date(dtStart)
    untilDate.setDate(untilDate.getDate() + weeks * 7)
    const untilUTC = fmtDateTimeUTC(new Date(Date.UTC(
      untilDate.getFullYear(), untilDate.getMonth(), untilDate.getDate(),
      startClock.h, startClock.m, 0,
    )))

    const section = [ev.program, ev.year, ev.block].filter(Boolean).join('')
    const summary = [ev.courseCode, section].filter(Boolean).join(' · ') || 'Class'

    const descParts = []
    if (ev.title)                          descParts.push(ev.title)
    if (ev.faculty && ev.faculty !== 'TBA') descParts.push(`Faculty: ${ev.faculty}`)
    if (ev.session)                        descParts.push(ev.session)

    const uid = `${ev.schedule_id ?? `${ev.courseCode}-${section}-${ev.day}-${idx}`}@schedule-export`
    const room = ev.room && ev.room !== 'TBA' ? ev.room : ''

    lines.push(
      'BEGIN:VEVENT',
      `UID:${uid}`,
      `DTSTAMP:${dtstamp}`,
      `DTSTART:${fmtDateTimeLocal(dtStart)}`,
      `DTEND:${fmtDateTimeLocal(dtEnd)}`,
      `RRULE:FREQ=WEEKLY;BYDAY=${DAY_TO_ICS[ev.day]};UNTIL=${untilUTC}`,
      `SUMMARY:${escapeText(summary)}`,
      room ? `LOCATION:${escapeText(room)}` : null,
      descParts.length ? `DESCRIPTION:${escapeText(descParts.join(' — '))}` : null,
      'END:VEVENT',
    )
  })

  lines.push('END:VCALENDAR')

  const icsBody = lines.filter(Boolean).map(foldLine).join('\r\n')

  const blob = new Blob([icsBody], { type: 'text/calendar;charset=utf-8' })
  const url  = URL.createObjectURL(blob)
  const a    = Object.assign(document.createElement('a'), {
    href: url,
    download: `${name}.ics`,
  })
  document.body.appendChild(a)
  a.click()
  document.body.removeChild(a)
  URL.revokeObjectURL(url)
}
