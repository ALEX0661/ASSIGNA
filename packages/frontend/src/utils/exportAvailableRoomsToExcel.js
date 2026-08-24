/**
 * exportAvailableRoomsToExcel.js
 *
 * Produces a styled .xlsx report of room availability:
 *   - "Summary" sheet: one row per day with a quick free/partial/booked breakdown
 *   - "Available Rooms" sheet: Day | Room | Type | Free Hours | Status | Free Time Slots
 *
 * Always computed from the FULL unfiltered event list, so the report
 * reflects true occupancy regardless of what filters are active in the UI.
 *
 * Requires: npm install exceljs
 */
import ExcelJS from 'exceljs'
import { DAYS } from '../components/ScheduleView/svHelpers'
import { computeRoomAvailability, formatFreeSlots, totalFreeMinutes } from './roomAvailability'

// ── Brand palette (matches the app's green theme — see svPrimitives.TV) ────────
const DEEP    = '15803D'
const BORDER  = 'D8E8DF'

const HEADER_FILL   = DEEP
const HEADER_FONT   = 'FFFFFF'
const TITLE_FONT    = '0E2A20'
const FREE_FILL     = 'ECFDF5'
const PARTIAL_FILL  = 'FFFBEB'
const BUSY_FILL     = 'FEF2F2'
const DAY_BAND_FILL = 'F7FBF9'   // alternating day-group tint

const STATUS_ICON = { 'Fully Free': '🟢', 'Partially Free': '🟡', 'Fully Booked': '🔴' }

function thinBorder(color = BORDER) {
  const side = { style: 'thin', color: { argb: 'FF' + color } }
  return { top: side, left: side, bottom: side, right: side }
}

function thickTop(color = DEEP) {
  return { top: { style: 'medium', color: { argb: 'FF' + color } } }
}

function fmtHours(mins) {
  const h = mins / 60
  return Number.isInteger(h) ? `${h}` : h.toFixed(1)
}

/**
 * @param {object[]} allEvents   – full unfiltered event list
 * @param {object}   masterRooms – { lecture: string[], lab: string[] }
 * @param {string}   name        – schedule name, used in the downloaded file name
 */
export async function exportAvailableRoomsToExcel(allEvents, masterRooms, name = 'schedule') {
  const wb = new ExcelJS.Workbook()
  wb.creator = 'Schedule System'
  wb.created = new Date()

  const generatedAt = new Date().toLocaleString('en-US', {
    dateStyle: 'medium', timeStyle: 'short',
  })

  // Pre-compute availability for every day once, reused by both sheets
  const perDay = DAYS.map(day => ({
    day,
    availability: computeRoomAvailability(allEvents, masterRooms, day)
      .sort((a, b) => {
        if (a.fullyFree !== b.fullyFree) return a.fullyFree ? -1 : 1
        return a.room.localeCompare(b.room)
      }),
  }))

  /* ══════════════════════════ SUMMARY SHEET ══════════════════════════ */
  const summary = wb.addWorksheet('Summary', {
    properties: { tabColor: { argb: 'FF' + DEEP } },
    pageSetup: { orientation: 'landscape', fitToPage: true, fitToWidth: 1, fitToHeight: 0 },
  })
  summary.columns = [
    { key: 'day',      width: 14 },
    { key: 'total',    width: 13 },
    { key: 'free',     width: 13 },
    { key: 'partial',  width: 15 },
    { key: 'booked',   width: 14 },
    { key: 'avgFree',  width: 16 },
  ]

  summary.mergeCells('A1:F1')
  const summaryTitle = summary.getCell('A1')
  summaryTitle.value = `Room Availability Summary — ${name}`
  summaryTitle.font = { name: 'Arial', bold: true, size: 14, color: { argb: 'FF' + TITLE_FONT } }
  summaryTitle.alignment = { vertical: 'middle' }
  summary.getRow(1).height = 26

  summary.mergeCells('A2:F2')
  const summarySub = summary.getCell('A2')
  summarySub.value = `Generated ${generatedAt} · computed from the full, unfiltered schedule`
  summarySub.font = { name: 'Arial', italic: true, size: 9.5, color: { argb: 'FF4B7060' } }
  summary.getRow(2).height = 16
  summary.addRow([])

  const summaryHeaderRow = summary.addRow(['Day', 'Total Rooms', 'Fully Free', 'Partially Free', 'Fully Booked', 'Avg. Free (hrs)'])
  summaryHeaderRow.height = 22
  summaryHeaderRow.eachCell(cell => {
    cell.fill      = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FF' + HEADER_FILL } }
    cell.font      = { name: 'Arial', bold: true, size: 10, color: { argb: 'FF' + HEADER_FONT } }
    cell.border    = thinBorder()
    cell.alignment = { horizontal: 'center', vertical: 'middle' }
  })
  summary.views = [{ state: 'frozen', ySplit: summaryHeaderRow.number }]

  perDay.forEach(({ day, availability }) => {
    const total   = availability.length
    const free    = availability.filter(r => r.fullyFree).length
    const partial = availability.filter(r => !r.fullyFree && r.free.length > 0).length
    const booked  = total - free - partial
    const avgFreeMins = total ? availability.reduce((s, r) => s + totalFreeMinutes(r.free), 0) / total : 0

    const row = summary.addRow([day, total, free, partial, booked, fmtHours(avgFreeMins)])
    row.height = 18
    row.eachCell(cell => {
      cell.font      = { name: 'Arial', size: 10 }
      cell.border    = thinBorder()
      cell.alignment = { horizontal: 'center', vertical: 'middle' }
    })
    row.getCell(1).alignment = { horizontal: 'left', vertical: 'middle' }
    row.getCell(1).font      = { name: 'Arial', size: 10, bold: true }
    row.getCell(3).font      = { name: 'Arial', size: 10, bold: true, color: { argb: 'FF' + DEEP } }
  })

  /* ══════════════════════════ DETAIL SHEET ══════════════════════════ */
  const ws = wb.addWorksheet('Available Rooms', {
    properties: { tabColor: { argb: 'FF' + DEEP } },
    pageSetup: { orientation: 'landscape', fitToPage: true, fitToWidth: 1, fitToHeight: 0 },
  })
  ws.columns = [
    { key: 'day',    width: 12 },
    { key: 'room',   width: 14 },
    { key: 'type',   width: 11 },
    { key: 'hours',  width: 12 },
    { key: 'status', width: 16 },
    { key: 'free',   width: 48 },
  ]

  ws.mergeCells('A1:F1')
  const title = ws.getCell('A1')
  title.value = `Available Rooms — ${name}`
  title.font = { name: 'Arial', bold: true, size: 14, color: { argb: 'FF' + TITLE_FONT } }
  ws.getRow(1).height = 26

  ws.mergeCells('A2:F2')
  const sub = ws.getCell('A2')
  sub.value = `Generated ${generatedAt} · always reflects the full schedule, independent of any view filters`
  sub.font = { name: 'Arial', italic: true, size: 9.5, color: { argb: 'FF4B7060' } }
  ws.getRow(2).height = 16
  ws.addRow([])

  const headerRow = ws.addRow(['Day', 'Room', 'Type', 'Free (hrs)', 'Status', 'Free Time Slots'])
  headerRow.height = 22
  headerRow.eachCell(cell => {
    cell.fill      = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FF' + HEADER_FILL } }
    cell.font      = { name: 'Arial', bold: true, size: 10, color: { argb: 'FF' + HEADER_FONT } }
    cell.border    = thinBorder()
    cell.alignment = { horizontal: 'center', vertical: 'middle' }
  })
  // Freeze the header row AND the Day/Room columns so long lists stay readable
  ws.views = [{ state: 'frozen', xSplit: 2, ySplit: headerRow.number }]

  perDay.forEach(({ day, availability }) => {
    let firstRowOfDay = true

    availability.forEach(({ room, type, free, fullyFree }) => {
      const status   = fullyFree ? 'Fully Free' : free.length ? 'Partially Free' : 'Fully Booked'
      const fill     = fullyFree ? FREE_FILL : free.length ? PARTIAL_FILL : BUSY_FILL
      const freeMins = totalFreeMinutes(free)
      const freeText = free.length ? free.map(f => formatFreeSlots([f])).join('\n') : 'Fully booked'
      const lineCount = free.length || 1

      const row = ws.addRow([
        day, room, type[0].toUpperCase() + type.slice(1),
        free.length ? fmtHours(freeMins) : 0,
        `${STATUS_ICON[status]}  ${status}`,
        freeText,
      ])
      row.height = Math.max(16, lineCount * 13)

      row.eachCell({ includeEmpty: true }, cell => {
        cell.fill      = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FF' + fill } }
        cell.font      = { name: 'Arial', size: 10 }
        cell.border    = firstRowOfDay ? { ...thinBorder(), ...thickTop() } : thinBorder()
        cell.alignment = { vertical: 'middle', wrapText: true }
      })
      row.getCell(1).alignment = { horizontal: 'center', vertical: 'middle' }
      row.getCell(1).font      = { name: 'Arial', size: 10, bold: true, color: { argb: 'FF' + TITLE_FONT } }
      row.getCell(3).alignment = { horizontal: 'center', vertical: 'middle' }
      row.getCell(4).alignment = { horizontal: 'center', vertical: 'middle' }
      row.getCell(4).font      = { name: 'Arial', size: 10, bold: true }
      row.getCell(5).alignment = { horizontal: 'center', vertical: 'middle' }
      row.getCell(5).font      = { name: 'Arial', size: 10, bold: true }

      firstRowOfDay = false
    })
  })

  ws.autoFilter = { from: { row: headerRow.number, column: 1 }, to: { row: headerRow.number, column: 6 } }
  ws.getColumn(6).alignment = { wrapText: true, vertical: 'middle' }

  const buffer = await wb.xlsx.writeBuffer()
  const blob   = new Blob([buffer], {
    type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
  })
  const url = URL.createObjectURL(blob)
  const a   = Object.assign(document.createElement('a'), {
    href:     url,
    download: `${name}_available-rooms.xlsx`,
  })
  document.body.appendChild(a)
  a.click()
  document.body.removeChild(a)
  URL.revokeObjectURL(url)
}