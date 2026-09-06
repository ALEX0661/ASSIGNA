import jsPDF from 'jspdf'
import autoTable from 'jspdf-autotable'
import gcLogo  from '../assets/GClogo.png'
import cssLogo from '../assets/CSSlogo.png'

function formatStatus(status) {
  if (!status) return 'N/A'
  return status === 'part-time' ? 'Part-time' : 'Full-time'
}

// Falls back to parsing the schedule name when the caller didn't pass
// explicit semester/academicYear fields. Handles a wide range of formats
// since the exact naming convention used when the schedule was created can
// vary: "2024-2025 1st Sem", "SY 2024-2025 First Semester",
// "1st Semester, AY 2024-2025", "2024-2025 Midyear", "2nd Sem 2024-2025", etc.
function extractScheduleInfo(name) {
  let semester = ''
  let academicYear = ''
  if (!name) return { semester, academicYear }
  const str = String(name)

  const yearMatch = str.match(/(\d{4})\s*-\s*(\d{4})/)
  if (yearMatch) academicYear = `${yearMatch[1]}-${yearMatch[2]}`

  if (/mid\s*-?\s*year/i.test(str)) {
    semester = 'Midyear'
    return { semester, academicYear }
  }

  // "1st sem" / "2nd semester" / "3rd sem"
  let mm = str.match(/(\d)(?:st|nd|rd|th)?\s*sem/i)
  if (mm) {
    const num = mm[1]
    const suffix = num === '1' ? 'st' : num === '2' ? 'nd' : num === '3' ? 'rd' : 'th'
    semester = `${num}${suffix}`
    return { semester, academicYear }
  }

  // "First Semester" / "Second Sem" / "Third Semester"
  const wordMap = { first: '1st', second: '2nd', third: '3rd' }
  mm = str.match(/\b(first|second|third)\b\s*sem/i)
  if (mm) {
    semester = wordMap[mm[1].toLowerCase()]
    return { semester, academicYear }
  }

  // bare "Sem 1" / "Semester 2"
  mm = str.match(/sem(?:ester)?\s*\.?\s*(\d)/i)
  if (mm) {
    const num = mm[1]
    const suffix = num === '1' ? 'st' : num === '2' ? 'nd' : num === '3' ? 'rd' : 'th'
    semester = `${num}${suffix}`
  }

  return { semester, academicYear }
}

/* ── Day-token handling ───────────────────────────────────────────────────
   Normalizes any day representation ("Monday", "mon", "M", "TTh", "T,Th")
   into the standard set of tokens: M, T, W, Th, F, Sat, Sun.               */
const DAY_MAP = {
  monday: 'M', mon: 'M', m: 'M',
  tuesday: 'T', tue: 'T', tues: 'T', t: 'T',
  wednesday: 'W', wed: 'W', w: 'W',
  thursday: 'Th', thu: 'Th', thur: 'Th', thurs: 'Th', th: 'Th',
  friday: 'F', fri: 'F', f: 'F',
  saturday: 'Sat', sat: 'Sat',
  sunday: 'Sun', sun: 'Sun',
}

function normalizeDayToken(tok) {
  return DAY_MAP[tok.toLowerCase()] || tok
}

function splitDayTokens(dayStr) {
  if (!dayStr) return []
  const str = String(dayStr).trim()
  // Comma / slash separated full or short names ("Monday, Wednesday")
  if (/[,/]/.test(str)) {
    return str.split(/[,/]/).map(s => s.trim()).filter(Boolean).map(normalizeDayToken)
  }
  // Space separated ("M W F")
  if (/\s/.test(str) && str.length > 3) {
    return str.split(/\s+/).filter(Boolean).map(normalizeDayToken)
  }
  // Compact string like "MWF", "TTh", "MTWThF" — match "Th"/"Sat"/"Sun" BEFORE
  // single letters so "Th" is never split into "T" + "h".
  const tokens = str.match(/Th|Sat|Sun|M|T|W|F/gi) || []
  return tokens.map(normalizeDayToken)
}

function formatDays(dayStr) {
  const seen = new Set()
  const out = []
  splitDayTokens(dayStr).forEach(t => {
    if (!seen.has(t)) { seen.add(t); out.push(t) }
  })
  return out.join('')
}

/* ── Lecture / Laboratory helpers ─────────────────────────────────────── */
function isLab(session) {
  return String(session || '').toLowerCase().startsWith('lab')
}
function isLec(session) {
  return String(session || '').toLowerCase().startsWith('lec')
}

// ASSIGNA course codes carry an A (lecture) / L (laboratory) suffix, e.g.
// "IT101A" / "IT101L". If a code is missing that suffix, add the right one.
function formatCourseCode(ev) {
  const raw = (ev.courseCode || ev.course_code || ev.subject || ev.course || '').toString().trim()
  if (!raw) return ''
  if (/[AL]$/i.test(raw)) return raw.toUpperCase()
  if (isLab(ev.session)) return `${raw}L`
  if (isLec(ev.session)) return `${raw}A`
  return raw
}

function formatCourseTitle(ev) {
  const title = ev.courseTitle || ev.title || ev.course_title || ''
  if (isLab(ev.session)) return title ? `${title} (Lab)` : '(Lab)'
  if (isLec(ev.session)) return title ? `${title} (Lec)` : '(Lec)'
  return title
}

// "BSCS 4A" style program/year/block section label.
function formatSection(ev) {
  const program = ev.program || ''
  const year = ev.year || ''
  const block = ev.block || ''
  const yb = `${year}${block}`.trim()
  return [program, yb].filter(Boolean).join(' ').trim() || 'N/A'
}

/* ── Time / unit calculation ──────────────────────────────────────────────
   Lecture: 1 unit  = 1 hour
   Laboratory: 1 unit = 3 hours  (so 1.5 hrs lab = 0.5 units)              */
function toMinutes(timeStr) {
  const [time, meridiem] = timeStr.trim().split(' ')
  let [hours, minutes] = time.split(':').map(Number)
  if (/pm/i.test(meridiem) && hours !== 12) hours += 12
  if (/am/i.test(meridiem) && hours === 12) hours = 0
  return hours * 60 + minutes
}

function getPeriodHours(periodStr) {
  if (!periodStr) return 0
  const parts = periodStr.split(' - ')
  if (parts.length !== 2) return 0
  const [startStr, endStr] = parts
  try {
    const start = toMinutes(startStr)
    const end = toMinutes(endStr)
    return Math.max(0, (end - start) / 60)
  } catch {
    return 0
  }
}

function getEventPeriodStr(ev) {
  return ev.timeSlot || ev.time || ev.period || ''
}

function computeCorrectUnits(ev) {
  const hours = getPeriodHours(getEventPeriodStr(ev))
  return isLab(ev.session) ? hours / 3 : hours
}

/* ── Merge rows that are identical except for the day they meet ──────────
   e.g. an "MWF 7:00-8:00" lecture that was stored as 3 separate M / W / F
   events for the same section, room and time gets combined into one row
   with day = "MWF".                                                       */
function mergeEventsBySharedTime(events) {
  const order = []
  const map = new Map()

  events.forEach(ev => {
    const key = [
      formatCourseCode(ev),
      formatSection(ev),
      ev.room || 'TBA',
      getEventPeriodStr(ev),
      ev.session || '',
    ].join('|')

    if (!map.has(key)) {
      map.set(key, { ...ev, _dayTokens: new Set() })
      order.push(key)
    }
    const entry = map.get(key)
    splitDayTokens(ev.day).forEach(d => entry._dayTokens.add(d))
  })

  const dayOrder = ['M', 'T', 'W', 'Th', 'F', 'Sat', 'Sun']
  return order.map(key => {
    const entry = map.get(key)
    const days = dayOrder.filter(d => entry._dayTokens.has(d))
    const { _dayTokens, ...rest } = entry
    return { ...rest, day: days.join('') }
  })
}

/* ── Logo → data URL, so jsPDF can embed it ─────────────────────────────── */
function getDataUrl(img) {
  const canvas = document.createElement('canvas')
  const ctx = canvas.getContext('2d')
  canvas.width = img.width
  canvas.height = img.height
  ctx.drawImage(img, 0, 0)
  return canvas.toDataURL('image/png')
}

function loadImage(src) {
  return new Promise((resolve, reject) => {
    const img = new Image()
    img.crossOrigin = 'Anonymous'
    img.onload = () => resolve(getDataUrl(img))
    img.onerror = reject
    img.src = src
  })
}

/**
 * @param {object[]} events        - this faculty member's schedule events
 * @param {object}   faculty       - faculty record (name, SexAtBirth, specializations, status, Educational_attainment, AcademicRank, Department)
 * @param {object}   scheduleMeta  - { name, academicYear, semester } — the real fields ASSIGNA tracks per saved schedule
 * @param {function} [computeUnits] - optional (event) => number override. When omitted, units are
 *                                     computed correctly in-house: 1 hr = 1 unit for Lecture,
 *                                     3 hrs = 1 unit for Laboratory.
 */
export async function exportFacultyLoadToPDF(events, faculty, scheduleMeta = {}, computeUnits) {
  if (!faculty || !events?.length) return
  const {
    name: scheduleName = '',
    academicYear: metaAY = '',
    semester: metaSem = '',
    // tolerate alternate key names different callers in the codebase might use
    ay: metaAY2 = '',
    year: metaAY3 = '',
    term: metaSem2 = '',
  } = scheduleMeta
  const rawAY = metaAY || metaAY2 || metaAY3 || ''
  const rawSem = metaSem || metaSem2 || ''
  const parsed = (!rawAY || !rawSem) ? extractScheduleInfo(scheduleName) : {}
  const semester = rawSem || parsed.semester || ''
  const academicYear = rawAY || parsed.academicYear || ''

  const unitsFor = typeof computeUnits === 'function' ? computeUnits : computeCorrectUnits

  // Combine rows that share the same course/section/room/time but differ
  // only in which day of the week they occur on.
  const mergedEvents = mergeEventsBySharedTime(events)

  const doc = new jsPDF({ orientation: 'portrait', unit: 'mm', format: 'letter' })
  const w = doc.internal.pageSize.getWidth()
  const m = 12

  // ── Letterhead ────────────────────────────────────────────────────────
  try {
    const [leftData, rightData] = await Promise.all([loadImage(gcLogo), loadImage(cssLogo)])
    doc.addImage(leftData, 'PNG', m, m, 30, 30)
    doc.addImage(rightData, 'PNG', w - m - 30, m, 30, 30)
  } catch (e) {
    console.warn('Logo load failed', e)
  }

  doc.setFont('helvetica', 'bold').setFontSize(12)
    .text('City of Olongapo', w / 2, m + 6, { align: 'center' })
    .setFont('helvetica', 'bold').setFontSize(14)
    .text('GORDON COLLEGE', w / 2, m + 13, { align: 'center' })
    .setFont('helvetica', 'bold').setFontSize(12)
    .text('College of Computer Studies', w / 2, m + 19, { align: 'center' })
  doc.setFont('helvetica', 'normal').setFontSize(9)
    .text('Olongapo City Sports Complex, East Tapinac, Olongapo City', w / 2, m + 26, { align: 'center' })
    .text('Tel. No. (047) 224-2089 loc. 314', w / 2, m + 31, { align: 'center' })
    .text('www.gordoncollege.edu.ph', w / 2, m + 36, { align: 'center' })
  doc.setDrawColor(0).setLineWidth(0.4).line(m, m + 40, w - m, m + 40)

  // ── Title ─────────────────────────────────────────────────────────────
  let y = m + 48
  doc.setFont('helvetica', 'bold').setFontSize(16)
    .text('INDIVIDUAL FACULTY LOAD AND SCHEDULE', w / 2, y, { align: 'center' })
  doc.setFont('helvetica', 'normal').setFontSize(11)
    .text(`Semester: ${semester || 'N/A'} | AY: ${academicYear || 'N/A'}`, w / 2, y + 7, { align: 'center' })

  // ── Faculty info block ────────────────────────────────────────────────
  // Label stays plain/normal weight; the value is bold. The gap between
  // label and value is measured per-label (not a fixed offset), so a long
  // label like "Educational Attainment:" can never run into its own value.
  y += 15
  const infoX = m
  const colGap = 95

  const gridFields = [
    ['Name of Professor:', faculty.name || 'N/A'],
    ['Sex:', faculty.SexAtBirth || faculty.Sex || 'N/A'],
    ['Status:', formatStatus(faculty.status || faculty.Status)],
    ['Educational Attainment:', faculty.Educational_attainment || 'N/A'],
    ['Academic Rank:', faculty.AcademicRank || 'N/A'],
    ['Department:', faculty.Department || 'N/A'],
  ]

  doc.setFontSize(10)
  gridFields.forEach(([label, value], idx) => {
    const colX = infoX + (idx % 2) * colGap
    const rowY = y + Math.floor(idx / 2) * 6
    doc.setFont('helvetica', 'normal')
    doc.text(label, colX, rowY)
    const labelW = doc.getTextWidth(label)
    doc.setFont('helvetica', 'bold')
    doc.text(String(value), colX + labelW + 4, rowY)
  })
  y += Math.ceil(gridFields.length / 2) * 6 + 8

  // ── Course table ──────────────────────────────────────────────────────
  const assignedUnits = mergedEvents.reduce((acc, ev) => acc + unitsFor(ev), 0)
  const tableW = w - 2 * m

  autoTable(doc, {
    head: [['Course Code', 'Course Title', 'Section', 'Session', 'Day', 'Time', 'Room', 'Units']],
    body: mergedEvents.map(ev => [
      formatCourseCode(ev),
      formatCourseTitle(ev),
      formatSection(ev),
      ev.session || '',
      formatDays(ev.day),
      getEventPeriodStr(ev),
      ev.room || 'TBA',
      unitsFor(ev).toFixed(1).replace(/\.0$/, ''),
    ]),
    foot: [[
      {
        content: 'Total Units:',
        colSpan: 7,
        styles: { halign: 'right' },
      },
      assignedUnits.toFixed(1).replace(/\.0$/, ''),
    ]],
    startY: y,
    theme: 'grid',
    styles: {
      fontSize: 8,
      textColor: [0, 0, 0],
      cellPadding: { top: 1.6, right: 2.2, bottom: 1.6, left: 2.2 },
      lineColor: [0, 0, 0],
      lineWidth: 0.15,
      valign: 'middle',
    },
    tableWidth: tableW,
    margin: { left: m, right: m },
    headStyles: { fillColor: [255, 255, 255], textColor: [0, 0, 0], fontStyle: 'bold', halign: 'center', fontSize: 8.5, overflow: 'visible' },
    footStyles: { fillColor: [255, 255, 255], textColor: [0, 0, 0], fontStyle: 'bold', halign: 'left', fontSize: 8.5 },
    columnStyles: {
      0: { cellWidth: 22 },                              // Course Code
      1: { cellWidth: 'auto' },                          // Course Title (gets remaining room)
      2: { cellWidth: 26 },                              // Section
      3: { cellWidth: 19, halign: 'center' },            // Session
      4: { cellWidth: 11, halign: 'center' },            // Day
      5: { cellWidth: 34, halign: 'center', overflow: 'visible' }, // Time — wide enough for one line
      6: { cellWidth: 13, halign: 'center' },            // Room
      7: { cellWidth: 14, halign: 'center' },            // Units
    },
  })

  const safeSem  = (semester || 'schedule').toString().replace(/[^a-zA-Z0-9]+/g, '_')
  const safeAY   = (academicYear || '').toString().replace(/[^a-zA-Z0-9]+/g, '_')
  const safeName = (faculty.name || 'Faculty').replace(/[^a-zA-Z0-9\s-]/g, '').trim()
  doc.save(`Faculty_Load_${safeName}_${safeSem}${safeAY ? `_${safeAY}` : ''}.pdf`)
}