/**
 * exportScheduleToExcel.js
 *
 * Produces a styled .xlsx file matching the school schedule format:
 *   Classcode | Course Code | Course Description | Day | Start Time | End Time | Room | FACULTY
 *
 * Merge rules applied before writing:
 *
 *  1. CONSECUTIVE-TIME MERGE (within same day)
 *     Same (classcode + courseCode + room + faculty + day) with back-to-back slots
 *     → one row with the extended range.
 *     e.g.  BSCS3A · PROG · Room1 · Monday  1:00PM–2:00PM
 *           BSCS3A · PROG · Room1 · Monday  2:00PM–3:00PM
 *     →     BSCS3A · PROG · Room1 · Monday  1:00PM–3:00PM
 *
 *  2. DAY MERGE (across days, after time merge)
 *     Same (classcode + courseCode + room + faculty + startTime + endTime)
 *     on multiple days → one row, days joined as abbreviations.
 *     e.g.  Monday + Tuesday  →  MT
 *           Thursday + Friday →  ThF
 *           Mon + Wed + Fri   →  MWF
 *
 *  3. COURSE-CODE SUFFIX  (A = lecture, L = lab)
 *     Applied only when a section has BOTH lecture AND lab sessions.
 *     e.g.  ITC08 lecture  →  ITC08A
 *           ITC08 lab      →  ITC08L
 *
 * Requires:  npm install exceljs
 */

import ExcelJS from 'exceljs'

// ── Palette ───────────────────────────────────────────────────────────────────
const HEADER_FILL  = 'FFAC90'   // salmon/peach  (matches image header)
const SUBHDR_FILL  = 'FFC7CE'   // lighter salmon (FACULTY column header)
const BORDER_COLOR = 'BFBFBF'
const ALT_ROW_FILL = 'FFF2CC'   // very light amber for alternating rows
const WHITE        = 'FFFFFFFF'

// ── Day metadata (abbreviation + sort order) ──────────────────────────────────
const DAY_META = {
  Monday:    { abbr: 'M',  order: 0 },
  Tuesday:   { abbr: 'T',  order: 1 },
  Wednesday: { abbr: 'W',  order: 2 },
  Thursday:  { abbr: 'Th', order: 3 },
  Friday:    { abbr: 'F',  order: 4 },
  Saturday:  { abbr: 'S',  order: 5 },
  Sunday:    { abbr: 'Su', order: 6 },
}

// ── Time utilities ────────────────────────────────────────────────────────────
/** "7:00 AM" | "12:30PM" → minutes since midnight, or null on failure */
function parseTime(str) {
  const m = (str || '').trim().match(/^(\d{1,2}):(\d{2})\s*(AM|PM)$/i)
  if (!m) return null
  let h = parseInt(m[1], 10)
  const min = parseInt(m[2], 10)
  const ap  = m[3].toUpperCase()
  if (ap === 'PM' && h !== 12) h += 12
  if (ap === 'AM' && h === 12) h  = 0
  return h * 60 + min
}

/** minutes since midnight → "7:00 AM" */
function formatTime(mins) {
  const h   = Math.floor(mins / 60)
  const m   = mins % 60
  const ap  = h >= 12 ? 'PM' : 'AM'
  const h12 = h % 12 === 0 ? 12 : h % 12
  return `${h12}:${String(m).padStart(2, '0')}${ap}`
}

// ── Merge pipeline ────────────────────────────────────────────────────────────

/**
 * STEP 1 — Consecutive-time merge within each (classcode, courseCode, room, faculty, day).
 * Input/output: array of flat event objects.
 */
function mergeConsecutiveTimes(flatEvents) {
  // Group
  const groups = new Map()
  flatEvents.forEach(ev => {
    const k = `${ev.classcode}||${ev.courseCode}||${ev.description}||${ev.room}||${ev.faculty}||${ev.day}`
    if (!groups.has(k)) groups.set(k, [])
    groups.get(k).push({ ...ev })
  })

  const result = []
  groups.forEach(group => {
    // Sort by start time within the group
    group.sort((a, b) => (a.startMin ?? 0) - (b.startMin ?? 0))

    const merged = [{ ...group[0] }]
    for (let i = 1; i < group.length; i++) {
      const last = merged[merged.length - 1]
      const curr = group[i]
      if (
        last.endMin   !== null &&
        curr.startMin !== null &&
        curr.startMin === last.endMin          // back-to-back: no gap, no overlap
      ) {
        last.endMin = curr.endMin              // extend the window
      } else {
        merged.push({ ...curr })
      }
    }
    result.push(...merged)
  })
  return result
}

/**
 * STEP 2 — Day merge across days for identical (classcode, courseCode, room, faculty, times).
 * Returns new array where each unique combination appears once with a combined day string.
 */
function mergeSameDayPattern(flatEvents) {
  const groups = new Map()

  flatEvents.forEach(ev => {
    // Key excludes the day so same-time events on different days collapse together
    const k = `${ev.classcode}||${ev.courseCode}||${ev.description}||${ev.startMin}||${ev.endMin}||${ev.room}||${ev.faculty}`
    if (!groups.has(k)) {
      groups.set(k, { ...ev, days: [], minDayOrder: Infinity })
    }
    const g = groups.get(k)
    if (!g.days.includes(ev.day)) {
      g.days.push(ev.day)
      g.minDayOrder = Math.min(g.minDayOrder, DAY_META[ev.day]?.order ?? 9)
    }
  })

  return [...groups.values()].map(g => {
    // Build the day string in calendar order (M before T before W …)
    const sorted = [...g.days].sort(
      (a, b) => (DAY_META[a]?.order ?? 9) - (DAY_META[b]?.order ?? 9)
    )
    return { ...g, day: sorted.map(d => DAY_META[d]?.abbr || d).join('') }
  })
}

// ── Styling helpers ───────────────────────────────────────────────────────────
function thinBorder() {
  const side = { style: 'thin', color: { argb: 'FF' + BORDER_COLOR } }
  return { top: side, left: side, bottom: side, right: side }
}

function applyHeaderStyle(cell, bgArgb = 'FF' + HEADER_FILL) {
  cell.fill      = { type: 'pattern', pattern: 'solid', fgColor: { argb: bgArgb } }
  cell.font      = { name: 'Arial', bold: true, size: 10, color: { argb: 'FF000000' } }
  cell.border    = thinBorder()
  cell.alignment = { horizontal: 'center', vertical: 'middle', wrapText: true }
}

function applyDataStyle(cell, rowIndex) {
  cell.fill      = { type: 'pattern', pattern: 'solid',
    fgColor: { argb: rowIndex % 2 === 0 ? 'FF' + ALT_ROW_FILL : WHITE } }
  cell.font      = { name: 'Arial', size: 10 }
  cell.border    = thinBorder()
  cell.alignment = { vertical: 'middle', wrapText: false }
}

// ── Main export ───────────────────────────────────────────────────────────────
/**
 * @param {object[]} events  – raw schedule events from the Zustand store
 * @param {string}   name    – schedule name used for the downloaded file name
 */
export async function exportScheduleToExcel(events, name = 'schedule') {
  if (!events?.length) return

  // ── A. Which sections have BOTH lecture and lab? ───────────────────────────
  const sectionTypes = {}
  events.forEach(ev => {
    const key = `${ev.program ?? ''}${ev.year ?? ''}${ev.block ?? ''}`
    if (!sectionTypes[key]) sectionTypes[key] = new Set()
    sectionTypes[key].add(ev.session?.toUpperCase().includes('LAB') ? 'lab' : 'lec')
  })

  // ── B. Flatten raw events → normalised objects with numeric times ──────────
  const flat = events.map(ev => {
    const sectionKey = `${ev.program ?? ''}${ev.year ?? ''}${ev.block ?? ''}`
    const hasBoth    = sectionTypes[sectionKey]?.size === 2
    const isLab      = ev.session?.toUpperCase().includes('LAB')

    const courseCode = hasBoth
      ? `${ev.courseCode || ''}${isLab ? 'L' : 'A'}`
      : (ev.courseCode || '')

    const [rawStart = '', rawEnd = ''] = (ev.period || '').split(' - ')
    const startMin = parseTime(rawStart.trim())
    const endMin   = parseTime(rawEnd.trim())

    return {
      classcode:   sectionKey,
      courseCode,
      description: ev.title || '',
      day:         ev.day   || '',
      startMin,
      endMin,
      room:    ev.room    && ev.room    !== 'TBA' ? ev.room    : 'TBA',
      faculty: ev.faculty && ev.faculty !== 'TBA' ? ev.faculty : '',
      // Keep the section order key for final sort
      _sectionKey: sectionKey,
    }
  })

  // ── C. Merge pipeline ─────────────────────────────────────────────────────
  //  1. consecutive times → 2. collapse matching days
  const afterTimeMerge = mergeConsecutiveTimes(flat)
  const afterDayMerge  = mergeSameDayPattern(afterTimeMerge)

  // ── D. Final sort: classcode → first day in group → start time ────────────
  afterDayMerge.sort((a, b) => {
    const sk = a._sectionKey.localeCompare(b._sectionKey)
    if (sk !== 0) return sk
    const do_ = (a.minDayOrder ?? 9) - (b.minDayOrder ?? 9)
    if (do_ !== 0) return do_
    return (a.startMin ?? 0) - (b.startMin ?? 0)
  })

  // ── E. Convert to plain row arrays for ExcelJS ────────────────────────────
  const rows = afterDayMerge.map(ev => [
    ev.classcode,
    ev.courseCode,
    ev.description,
    ev.day,
    ev.startMin !== null ? formatTime(ev.startMin) : '',
    ev.endMin   !== null ? formatTime(ev.endMin)   : '',
    ev.room,
    ev.faculty,
  ])

  // ── F. Build workbook ──────────────────────────────────────────────────────
  const wb = new ExcelJS.Workbook()
  wb.creator = 'Schedule System'
  wb.created = new Date()

  const ws = wb.addWorksheet('Schedule', {
    views: [{ state: 'frozen', ySplit: 1 }],
  })

  ws.columns = [
    { key: 'classcode', width: 13 },
    { key: 'code',      width: 14 },
    { key: 'desc',      width: 48 },
    { key: 'day',       width: 10 },
    { key: 'start',     width: 12 },
    { key: 'end',       width: 12 },
    { key: 'room',      width: 8  },
    { key: 'faculty',   width: 28 },
  ]

  // Header row
  const HEADERS = [
    'Classcode', 'Course Code', 'Course Description',
    'Day', 'Start Time', 'End Time', 'Room', 'FACULTY',
  ]
  const headerRow = ws.addRow(HEADERS)
  headerRow.height = 22
  headerRow.eachCell((cell, col) => {
    applyHeaderStyle(cell, col === 8 ? 'FF' + SUBHDR_FILL : 'FF' + HEADER_FILL)
  })

  // Data rows
  rows.forEach((rowData, idx) => {
    const dataRow = ws.addRow(rowData)
    dataRow.height = 16
    dataRow.eachCell({ includeEmpty: true }, cell => applyDataStyle(cell, idx))

    // Classcode — bold + centered
    const cc = dataRow.getCell(1)
    cc.font      = { name: 'Arial', size: 10, bold: true }
    cc.alignment = { horizontal: 'center', vertical: 'middle' }

    // Day / Start / End / Room — centered
    ;[4, 5, 6, 7].forEach(col => {
      dataRow.getCell(col).alignment = { horizontal: 'center', vertical: 'middle' }
    })
  })

  // Auto-filter
  ws.autoFilter = { from: 'A1', to: 'H1' }

  // ── G. Download ───────────────────────────────────────────────────────────
  const buffer = await wb.xlsx.writeBuffer()
  const blob   = new Blob([buffer], {
    type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
  })
  const url = URL.createObjectURL(blob)
  const a   = Object.assign(document.createElement('a'), {
    href:     url,
    download: `${name}_export.xlsx`,
  })
  document.body.appendChild(a)
  a.click()
  document.body.removeChild(a)
  URL.revokeObjectURL(url)
}