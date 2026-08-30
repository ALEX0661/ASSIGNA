import ExcelJS from 'exceljs'
import * as XLSX from 'xlsx'
import { ACADEMIC_RANKS, DEPARTMENTS } from './FacultyDetail/fdShared'

/* ─────────────────────────────────────────────────────────────────────────
   Shared option lists — also used to populate the dropdown source ranges
   ───────────────────────────────────────────────────────────────────────── */
export const STATUS_OPTIONS    = ['Full-time', 'Part-time']
export const SEX_OPTIONS       = ['Male', 'Female', 'Other']

const BRAND = {
  headerFill:     'FF1F7A45',
  headerFont:     'FFFFFFFF',
  labelFill:      'FFE5F9EC',
  bandFill:       'FFF7FCF9',
  border:         'FFDCF3E4',
  title:          'FF0E2A20',
}

export const FACULTY_INFO_SHEET_NAME = 'Faculty Info'
const LISTS_SHEET_NAME = '_Lists' // hidden helper sheet — dropdown source ranges live here

/* ─── Hidden sheet that backs every dropdown ────────────────────────────── */
function addListsSheet(wb) {
  const existing = wb.getWorksheet(LISTS_SHEET_NAME)
  if (existing) return existing

  const ws = wb.addWorksheet(LISTS_SHEET_NAME, { state: 'hidden' })
  const columns = [
    { letter: 'A', values: STATUS_OPTIONS },
    { letter: 'B', values: SEX_OPTIONS },
    { letter: 'C', values: ACADEMIC_RANKS || [] },
    { letter: 'D', values: DEPARTMENTS || [] },
  ]
  columns.forEach(col => {
    col.values.forEach((v, i) => { ws.getCell(`${col.letter}${i + 1}`).value = v })
  })
  return ws
}

const LIST_COUNTS = () => ({
  A: STATUS_OPTIONS.length,
  B: SEX_OPTIONS.length,
  C: (ACADEMIC_RANKS || []).length,
  D: (DEPARTMENTS || []).length,
})

function listFormula(colLetter, count) {
  return `'${LISTS_SHEET_NAME}'!$${colLetter}$1:$${colLetter}$${Math.max(count, 1)}`
}

/* ─── Cosmetic helpers ───────────────────────────────────────────────────── */
function styleHeaderCell(cell) {
  cell.font = { bold: true, color: { argb: BRAND.headerFont }, name: 'Calibri', size: 11 }
  cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: BRAND.headerFill } }
  cell.alignment = { vertical: 'middle', horizontal: 'center', wrapText: true }
  cell.border = {
    top: { style: 'thin', color: { argb: BRAND.border } },
    bottom: { style: 'thin', color: { argb: BRAND.border } },
    left: { style: 'thin', color: { argb: BRAND.border } },
    right: { style: 'thin', color: { argb: BRAND.border } },
  }
}

function styleBodyCell(cell, rowIndex, isRatingCell = false) {
  cell.font = { name: 'Calibri', size: 11 }
  cell.alignment = { vertical: 'middle', horizontal: 'left' }
  cell.border = {
    top: { style: 'hair', color: { argb: BRAND.border } },
    bottom: { style: 'hair', color: { argb: BRAND.border } },
    left: { style: 'hair', color: { argb: BRAND.border } },
    right: { style: 'hair', color: { argb: BRAND.border } },
  }
  if (rowIndex % 2 === 1) {
    cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: BRAND.bandFill } }
  }
  if (isRatingCell) {
    cell.dataValidation = {
      type: 'list',
      allowBlank: true,
      formulae: ['"1,2,3,4,5"'],
      showErrorMessage: true,
      errorTitle: 'Invalid Rating',
      error: 'Please enter a proficiency rating between 1 and 5.',
    }
  }
}
/* ─────────────────────────────────────────────────────────────────────────
   "Faculty Info" sheet — basic info, login email, preferred schedule
   ───────────────────────────────────────────────────────────────────────── */
const INFO_COLUMNS = [
  { key: 'lastName',      header: 'Last Name *',                width: 20 },
  { key: 'firstName',     header: 'First Name *',               width: 20 },
  { key: 'status',        header: 'Status *',                   width: 14, dropdown: 'A' },
  { key: 'email',         header: 'Email (Login)',              width: 30 },
  { key: 'sex',           header: 'Sex at Birth',               width: 14, dropdown: 'B' },
  { key: 'rank',          header: 'Academic Rank',              width: 24, dropdown: 'C' },
  { key: 'department',    header: 'Department',                 width: 24, dropdown: 'D' },
  { key: 'education',     header: 'Educational Attainment',     width: 26 },
]

const CELL_NOTES = {
  email: 'Used as the faculty member\u2019s login username. Leave blank to add it later.',
}

export function buildFacultyInfoSheet(wb, rows = [], { blankRowCount = 150 } = {}) {
  addListsSheet(wb)
  const ws = wb.addWorksheet(FACULTY_INFO_SHEET_NAME, {
    views: [{ state: 'frozen', ySplit: 1 }],
  })

  ws.columns = INFO_COLUMNS.map(c => ({ header: c.header, key: c.key, width: c.width }))
  const headerRow = ws.getRow(1)
  headerRow.height = 30
  INFO_COLUMNS.forEach((col, i) => {
    const cell = headerRow.getCell(i + 1)
    styleHeaderCell(cell)
    if (CELL_NOTES[col.key]) cell.note = CELL_NOTES[col.key]
  })

  const counts = LIST_COUNTS()
  const totalRows = Math.max(rows.length, blankRowCount)

  for (let r = 0; r < totalRows; r++) {
    const data = rows[r] || {}
    const row = ws.getRow(r + 2)
    INFO_COLUMNS.forEach((col, ci) => {
      const cell = row.getCell(ci + 1)
      cell.value = data[col.key] ?? ''
      styleBodyCell(cell, r)
      if (col.dropdown) {
        cell.dataValidation = {
          type: 'list',
          allowBlank: true,
          formulae: [listFormula(col.dropdown, counts[col.dropdown])],
          showErrorMessage: true,
          errorTitle: 'Invalid entry',
          error: 'Please choose a value from the dropdown.',
        }
      }
    })
    row.commit()
  }

  ws.autoFilter = { from: 'A1', to: `${String.fromCharCode(64 + INFO_COLUMNS.length)}1` }
  return ws
}

/* ─────────────────────────────────────────────────────────────────────────
   Specialization matrix sheets (Full-time / Part-time) — same layout the
   backend parser already expects, just styled.
   ───────────────────────────────────────────────────────────────────────── */
export function buildSpecializationMatrixSheets(wb, groups, courseTitleMap = {}) {
  Object.entries(groups).forEach(([sheetLabel, members]) => {
    if (!members.length) return

    const allCodes = [...new Set(members.flatMap(f =>
      (f.specializations || [])
        .filter(s => {
        if (typeof s !== 'object') return true;
        if (!s.isUnmatched) return true;
        const c = (s.courseCode || '').toUpperCase().replace(/\s+/g, '');
        return !!courseTitleMap[c];
      })
        .map(s => (typeof s === 'object' ? s.courseCode : s))
    ))].sort()

    const ws = wb.addWorksheet(sheetLabel, { views: [{ state: 'frozen', xSplit: 2, ySplit: 2 }] })
    ws.getColumn(1).width = 18
    ws.getColumn(2).width = 45
    members.forEach((_, i) => { ws.getColumn(i + 3).width = 16 })

    const lastRow = ws.getRow(1)
    lastRow.getCell(1).value = 'COURSES CODE'
    lastRow.getCell(2).value = 'COURSES NAME'
    members.forEach((f, i) => {
      const parts = f.name.split(',')
      lastRow.getCell(i + 3).value = (parts[0] || f.name).trim().toUpperCase()
    })
    lastRow.eachCell({ includeEmpty: true }, cell => styleHeaderCell(cell))

    const firstRow = ws.getRow(2)
    firstRow.getCell(2).value = `\u21B3 ${sheetLabel.toUpperCase()} FACULTY`
    members.forEach((f, i) => {
      const parts = f.name.split(',')
      firstRow.getCell(i + 3).value = (parts[1] || '').trim().toUpperCase()
    })
    firstRow.eachCell({ includeEmpty: true }, cell => {
      cell.font = { bold: true, italic: true, size: 10, color: { argb: BRAND.title } }
      cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: BRAND.labelFill } }
      cell.alignment = { vertical: 'middle', horizontal: 'center' }
      cell.border = { bottom: { style: 'medium', color: { argb: BRAND.headerFill } } }
    })

    allCodes.forEach((code, ci) => {
      const row = ws.getRow(ci + 3)
      row.getCell(1).value = code
      
      let courseTitle = courseTitleMap[code.toUpperCase()] || ''
      if (!courseTitle) {
        for (const f of members) {
          const spec = (f.specializations || []).find(s => (typeof s === 'object' ? s.courseCode : s) === code)
          if (spec && typeof spec === 'object' && spec.title) {
            courseTitle = spec.title
            break
          }
        }
      }
      row.getCell(2).value = courseTitle

      members.forEach((f, i) => {
        const spec = (f.specializations || []).find(s => (typeof s === 'object' ? s.courseCode : s) === code)
        row.getCell(i + 3).value = spec ? (typeof spec === 'object' ? spec.rating : '') : ''
      })
      row.eachCell({ includeEmpty: true }, (cell, colNumber) => {
        if (colNumber === 1 || colNumber === 2 || colNumber >= 3) styleBodyCell(cell, ci)
      })
    })
  })
}

/* ─────────────────────────────────────────────────────────────────────────
   Top-level builders
   ───────────────────────────────────────────────────────────────────────── */
export async function generateExportWorkbook(facultyList, courseTitleMap = {}) {
  const wb = new ExcelJS.Workbook()
  wb.creator = 'Scheduler'
  wb.created = new Date()

  const groups = {
    'Full-time': facultyList.filter(f => f.status === 'full-time'),
    'Part-time': facultyList.filter(f => f.status === 'part-time'),
  }
  buildSpecializationMatrixSheets(wb, groups, courseTitleMap)

  const infoRows = facultyList.map(f => {
    const parts = (f.name || '').split(',')
    return {
      lastName: (parts[0] || '').trim(),
      firstName: (parts[1] || '').trim(),
      status: f.status === 'part-time' ? 'Part-time' : 'Full-time',
      email: f.email || '',
      sex: f.SexAtBirth || '',
      rank: f.AcademicRank || '',
      department: f.Department || '',
      education: f.Educational_attainment || '',
    }
  })
  buildFacultyInfoSheet(wb, infoRows, { blankRowCount: infoRows.length })

  return wb
}

export async function generateBlankTemplateWorkbook(courseList = []) {
  const wb = new ExcelJS.Workbook()
  wb.creator = 'Scheduler'
  wb.created = new Date()

  buildSpecializationMatrixSheets(wb, {
    'Full-time': [{ name: 'LAST NAME, FIRST NAME', specializations: [] }],
    'Part-time': [{ name: 'LAST NAME, FIRST NAME', specializations: [] }],
  })
  
  const wsF = wb.getWorksheet('Full-time')
  const wsP = wb.getWorksheet('Part-time')
  
  if (courseList && courseList.length > 0) {
    courseList.forEach((c, idx) => {
      const r = idx + 3
      wsF.getCell(r, 1).value = c.courseCode
      wsF.getCell(r, 2).value = c.title
      wsP.getCell(r, 1).value = c.courseCode
      wsP.getCell(r, 2).value = c.title
      
      wsF.getRow(r).eachCell({ includeEmpty: true }, (cell, col) => {
        if (col === 1 || col === 2 || col >= 3) styleBodyCell(cell, idx, col >= 3)
      })
      wsP.getRow(r).eachCell({ includeEmpty: true }, (cell, col) => {
        if (col === 1 || col === 2 || col >= 3) styleBodyCell(cell, idx, col >= 3)
      })
    })
  } else {
    // Fallback if no courses provided
    wsF.getCell('A3').value = 'CS101'
    wsF.getCell('A4').value = 'CS102'
    wsP.getCell('A3').value = 'CS101'
    wsP.getCell('A4').value = 'CS102'
    ;[3, 4].forEach(r => {
       wsF.getRow(r).eachCell({ includeEmpty: true }, (c, col) => { if (col === 1 || col === 2 || col >= 3) styleBodyCell(c, r - 3, col >= 3) })
       wsP.getRow(r).eachCell({ includeEmpty: true }, (c, col) => { if (col === 1 || col === 2 || col >= 3) styleBodyCell(c, r - 3, col >= 3) })
    })
  }

  buildFacultyInfoSheet(wb, [], { blankRowCount: 100 })
  return wb
}

export async function downloadWorkbook(wb, filename) {
  const buffer = await wb.xlsx.writeBuffer()
  const blob = new Blob([buffer], { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' })
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = filename
  document.body.appendChild(a)
  a.click()
  document.body.removeChild(a)
  URL.revokeObjectURL(url)
}

/* ─────────────────────────────────────────────────────────────────────────
   Reading the "Faculty Info" sheet back out on import (plain SheetJS read —
   no styling/validation needed here, so no need for ExcelJS on this path).
   ───────────────────────────────────────────────────────────────────────── */
export function readFileAsArrayBuffer(file) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader()
    reader.onload = e => resolve(e.target.result)
    reader.onerror = reject
    reader.readAsArrayBuffer(file)
  })
}

export function parseFacultyInfoSheet(arrayBuffer) {
  const wb = XLSX.read(arrayBuffer, { type: 'array' })
  const sheetName = wb.SheetNames.find(n => n.trim().toLowerCase() === FACULTY_INFO_SHEET_NAME.toLowerCase())
  if (!sheetName) return new Map()

  const rows = XLSX.utils.sheet_to_json(wb.Sheets[sheetName], { defval: '' })
  const map = new Map()

  for (const row of rows) {
    const last  = (row['Last Name *']  || '').toString().trim().toUpperCase()
    const first = (row['First Name *'] || '').toString().trim().toUpperCase()
    if (!last && !first) continue
    const name = last && first ? `${last}, ${first}` : (last || first)

    const statusRaw = (row['Status *'] || '').toString().trim()

    map.set(name, {
      email: (row['Email (Login)'] || '').toString().trim(),
      SexAtBirth: (row['Sex at Birth'] || '').toString().trim(),
      AcademicRank: (row['Academic Rank'] || '').toString().trim(),
      Department: (row['Department'] || '').toString().trim(),
      Educational_attainment: (row['Educational Attainment'] || '').toString().trim(),
      status: statusRaw ? (/part/i.test(statusRaw) ? 'part-time' : 'full-time') : undefined,
    })
  }
  return map
}

/** Fills in blanks on the parsed specialization-matrix `preview` using
 *  whatever was entered in the "Faculty Info" sheet, matched by name. */
export function mergeFacultyInfo(preview, infoMap) {
  if (!infoMap || infoMap.size === 0) return preview
  return preview.map(f => {
    const info = infoMap.get((f.name || '').toUpperCase())
    if (!info) return f
    return {
      ...f,
      email: f.email || info.email,
      SexAtBirth: f.SexAtBirth || info.SexAtBirth,
      AcademicRank: f.AcademicRank || info.AcademicRank,
      Department: f.Department || info.Department,
      Educational_attainment: f.Educational_attainment || info.Educational_attainment,
      status: f.status || info.status,
    }
  })
}