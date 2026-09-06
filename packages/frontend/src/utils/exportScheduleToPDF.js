/**
 * exportScheduleToPDF.js
 *
 * PDF version of the same "list of schedule" export exportScheduleToExcel.js
 * produces — a straight table of the (already filtered) schedule, one row per
 * merged session:
 *   Classcode | Course Code | Course Description | Day | Start Time | End Time | Room | FACULTY
 *
 * Reuses the exact same merge pipeline as the Excel export (consecutive-time
 * merge, day merge, lecture/lab suffix) via computeScheduleRows(), so the two
 * files never drift out of sync with each other.
 *
 * This is NOT the per-faculty "Individual Load and Schedule" form — see
 * exportFacultyLoadToPDF.js for that.
 */

import jsPDF from 'jspdf'
import autoTable from 'jspdf-autotable'
import gcLogo  from '../assets/GClogo.png'
import cssLogo from '../assets/CSSlogo.png'
import { computeScheduleRows, formatTime } from './exportScheduleToExcel'

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
 * @param {object[]} events   - (already filtered) schedule events to list
 * @param {string}   name     - schedule name, used in the title + file name
 * @param {object}   meta     - optional { academicYear, semester } shown under the title
 */
export async function exportScheduleToPDF(events, name = 'schedule', meta = {}) {
  if (!events?.length) return
  const { academicYear = '', semester = '' } = meta

  const rows = computeScheduleRows(events)

  const doc = new jsPDF({ orientation: 'landscape', unit: 'mm', format: 'letter' })
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
    .text(`CLASS SCHEDULE — ${name}`, w / 2, y, { align: 'center' })
  if (academicYear || semester) {
    doc.setFont('helvetica', 'normal').setFontSize(11)
      .text(`Semester: ${semester || 'N/A'} | AY: ${academicYear || 'N/A'}`, w / 2, y + 7, { align: 'center' })
    y += 7
  }

  // ── Schedule table ────────────────────────────────────────────────────
  autoTable(doc, {
    head: [['Classcode', 'Course Code', 'Course Description', 'Day', 'Start Time', 'End Time', 'Room', 'FACULTY']],
    body: rows.map(ev => [
      ev.classcode,
      ev.courseCode,
      ev.description,
      ev.day,
      ev.startMin !== null ? formatTime(ev.startMin) : '',
      ev.endMin   !== null ? formatTime(ev.endMin)   : '',
      ev.room,
      ev.faculty,
    ]),
    startY: y + 10,
    theme: 'grid',
    styles: {
      fontSize: 8,
      textColor: [0, 0, 0],
      cellPadding: { top: 1.6, right: 2.2, bottom: 1.6, left: 2.2 },
      lineColor: [0, 0, 0],
      lineWidth: 0.15,
      valign: 'middle',
    },
    margin: { left: m, right: m },
    headStyles: { fillColor: [255, 255, 255], textColor: [0, 0, 0], fontStyle: 'bold', halign: 'center', fontSize: 8.5, overflow: 'visible' },
    columnStyles: {
      0: { cellWidth: 22 },                    // Classcode
      1: { cellWidth: 24 },                    // Course Code
      2: { cellWidth: 'auto' },                 // Course Description — takes remaining space
      3: { cellWidth: 16, halign: 'center' },   // Day
      4: { cellWidth: 20, halign: 'center' },   // Start Time
      5: { cellWidth: 20, halign: 'center' },   // End Time
      6: { cellWidth: 16, halign: 'center' },   // Room
      7: { cellWidth: 42 },                     // FACULTY
    },
    didDrawPage: () => {
      doc.setFont('helvetica', 'normal').setFontSize(8)
        .text(`Page ${doc.internal.getCurrentPageInfo().pageNumber}`, w - m, doc.internal.pageSize.getHeight() - 6, { align: 'right' })
    },
  })

  const safeName = (name || 'schedule').toString().replace(/[^a-zA-Z0-9\s-]/g, '').trim()
  doc.save(`${safeName}_Schedule.pdf`)
}
