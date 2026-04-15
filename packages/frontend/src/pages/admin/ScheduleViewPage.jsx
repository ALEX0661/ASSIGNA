import { useState, useMemo, useEffect, useCallback } from 'react'
import { useParams } from 'react-router-dom'
import { useScheduleStore } from '../../store/scheduleStore'
import { overrideSession, getFaculty, getRooms, loadSaved } from '../../services/api'

// ── Constants ─────────────────────────────────────────────────────────────────
const DAYS           = ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday', 'Sunday']
const YEAR_LABEL     = { 1: '1st Year', 2: '2nd Year', 3: '3rd Year', 4: '4th Year' }
const SLOT_HEIGHT     = 56
const COMPACT_SLOT_H  = 18
const COMPACT_ROOM_W  = 115
const COMPACT_TIME_W  = 44
const COMPACT_HEADER_H = 22
const NORMAL_HEADER_H  = 31
const SLOT_MINUTES    = 30
const DAY_START_HOUR  = 7
const DAY_END_HOUR    = 21

const PROGRAM_COLORS = {
  BSCS:  { bg: '#e8f0fe', text: '#1a56db', border: '#93b4f8' },
  BSIT:  { bg: '#fef3c7', text: '#92400e', border: '#f59e0b' },
  BSIE:  { bg: '#d1fae5', text: '#065f46', border: '#34d399' },
  BSECE: { bg: '#ede9fe', text: '#5b21b6', border: '#a78bfa' },
  BSIS:  { bg: '#fce7f3', text: '#9d174d', border: '#f472b6' },
  BSBA:  { bg: '#fff7ed', text: '#9a3412', border: '#fb923c' },
  BSA:   { bg: '#ecfdf5', text: '#166534', border: '#86efac' },
}

function programColor(program) {
  return PROGRAM_COLORS[program?.toUpperCase()] ?? { bg: '#f3f4f6', text: '#374151', border: '#9ca3af' }
}

// ── Time helpers ──────────────────────────────────────────────────────────────
function parseTimeToMinutes(timeStr) {
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

function parsePeriodRange(period) {
  if (!period) return null
  const parts = period.split(' - ')
  if (parts.length < 2) return null
  const start = parseTimeToMinutes(parts[0].trim())
  const end   = parseTimeToMinutes(parts[1].trim())
  return { start, end, duration: end - start }
}

function minutesToTimeLabel(minutes) {
  const h       = Math.floor(minutes / 60)
  const m       = minutes % 60
  const ampm    = h >= 12 ? 'PM' : 'AM'
  const displayH = h > 12 ? h - 12 : h === 0 ? 12 : h
  return `${displayH}:${m.toString().padStart(2, '0')} ${ampm}`
}

function buildTimeSlots() {
  const slots = []
  for (let m = DAY_START_HOUR * 60; m < DAY_END_HOUR * 60; m += SLOT_MINUTES)
    slots.push({ startMinutes: m, label: minutesToTimeLabel(m) })
  return slots
}

const TIME_SLOTS = buildTimeSlots()
const GRID_START = DAY_START_HOUR * 60

function getEventStyle(period, slotH = SLOT_HEIGHT) {
  const range = parsePeriodRange(period)
  if (!range) return { top: 0, height: slotH }
  const top    = ((range.start - GRID_START) / SLOT_MINUTES) * slotH
  const height = Math.max((range.duration / SLOT_MINUTES) * slotH, slotH * 0.8)
  return { top, height }
}

// ── Merged-class helpers ──────────────────────────────────────────────────────
/** Returns true if a schedule_id has a -A / -B suffix (merged block) */
function isMergedEvent(event) {
  if (!event?.schedule_id) return false
  return typeof event.schedule_id === 'string' && /\-[AB]$/.test(String(event.schedule_id))
}

/** Strip -A / -B to get the base merged id */
function getBaseMergedId(scheduleId) {
  return String(scheduleId).replace(/\-[AB]$/, '')
}

// ── Conflict helpers ──────────────────────────────────────────────────────────
function getEventId(event) {
  return event.schedule_id ?? `${event.courseCode}-${event.block}-${event.session}-${event.day}`
}

function timeOverlaps(a, b) {
  return a.start < b.end && a.end > b.start
}

/**
 * Determines all conflict types between two overlapping events.
 * Returns an array of: 'Room' | 'Section' | 'Faculty'
 */
function getConflictTypes(ea, eb) {
  const types = []

  // Room conflict — same non-TBA room
  if (ea.room && ea.room !== 'TBA' && eb.room && eb.room !== 'TBA' && ea.room === eb.room) {
    types.push('Room')
  }

  // Section conflict — same program + year + block (two classes scheduled at the same time for the same section)
  if (
    ea.program && ea.year && ea.block &&
    ea.program === eb.program &&
    String(ea.year) === String(eb.year) &&
    ea.block === eb.block
  ) {
    types.push('Section')
  }

  // Faculty conflict — same non-TBA faculty assigned at the same time
  if (
    ea.faculty && ea.faculty !== 'TBA' &&
    eb.faculty && eb.faculty !== 'TBA' &&
    ea.faculty === eb.faculty
  ) {
    types.push('Faculty')
  }

  return types
}

/**
 * Builds a rich conflict map for all events on a day.
 * Returns Map<eventId, { label: string, peers: ConflictPeer[] }>
 * where ConflictPeer = { event, conflictLabel }
 */
function buildConflictMap(events) {
  const map = new Map() // eventId => { label: string, peers: [] }

  for (let i = 0; i < events.length; i++) {
    for (let j = i + 1; j < events.length; j++) {
      const ea = events[i]
      const eb = events[j]

      // Must be same day
      if (ea.day !== eb.day) continue

      const ra = parsePeriodRange(ea.period)
      const rb = parsePeriodRange(eb.period)
      if (!ra || !rb) continue
      if (!timeOverlaps(ra, rb)) continue

      // Skip if the two events are part of the same merged class
      if (isMergedEvent(ea) && isMergedEvent(eb)) {
        const baseA = getBaseMergedId(ea.schedule_id)
        const baseB = getBaseMergedId(eb.schedule_id)
        if (baseA === baseB) continue // same merged pair — not a conflict
      }

      const types = getConflictTypes(ea, eb)
      if (types.length === 0) continue

      const conflictLabel = types.join(' + ') + ' Conflict'

      const addEntry = (ev, peer) => {
        const id = getEventId(ev)
        if (!map.has(id)) map.set(id, { label: conflictLabel, peers: [] })
        const entry = map.get(id)
        // Merge type labels
        const existingTypes = new Set(entry.label.replace(' Conflict', '').split(' + '))
        types.forEach(t => existingTypes.add(t))
        entry.label = [...existingTypes].join(' + ') + ' Conflict'
        // Add peer if not already listed
        if (!entry.peers.find(p => getEventId(p.event) === getEventId(peer))) {
          entry.peers.push({ event: peer, conflictLabel })
        }
      }

      addEntry(ea, eb)
      addEntry(eb, ea)
    }
  }

  return map
}

/**
 * Finds conflicts for a proposed reschedule (used in SessionModal live-preview and drag-drop).
 * Checks Room + Section + Faculty conflicts.
 * Returns array of conflicting events annotated with conflictLabel.
 */
function findConflicts(allEvents, { evId, day, startMin, endMin, room, faculty, program, year, block }) {
  const proposed = { start: startMin, end: endMin }
  const results  = []

  for (const ev of allEvents) {
    if (getEventId(ev) === evId) continue
    if (ev.day !== day) continue
    const r = parsePeriodRange(ev.period)
    if (!r || !timeOverlaps(proposed, r)) continue

    const types = []

    if (room    && room    !== 'TBA' && ev.room    === room)                                               types.push('Room')
    if (faculty && faculty !== 'TBA' && ev.faculty === faculty)                                            types.push('Faculty')
    if (program && year !== undefined && block &&
        ev.program === program &&
        String(ev.year) === String(year) &&
        ev.block === block)                                                                                 types.push('Section')

    if (types.length > 0) {
      results.push({ ...ev, conflictLabel: types.join(' + ') + ' Conflict' })
    }
  }

  return results
}

// ── Shared UI primitives ──────────────────────────────────────────────────────
function ModalOverlay({ onClose, children }) {
  return (
    <div
      style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,.45)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 999 }}
      onClick={e => e.target === e.currentTarget && onClose()}
    >
      {children}
    </div>
  )
}

function ModalHeader({ title, subtitle, onClose, fontSize = 16 }) {
  return (
    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 16 }}>
      <div>
        <p style={{ fontWeight: 700, fontSize, margin: 0 }}>{title}</p>
        {subtitle && <p style={{ fontSize: 12, color: '#6b7280', margin: '2px 0 0' }}>{subtitle}</p>}
      </div>
      <button onClick={onClose} style={{ background: 'none', border: 'none', fontSize: 20, cursor: 'pointer', color: '#6b7280', lineHeight: 1 }}>×</button>
    </div>
  )
}

function ModalFooter({ selectedCount, onClose }) {
  return (
    <div style={{ marginTop: 20, display: 'flex', justifyContent: 'space-between', alignItems: 'center', borderTop: '1px solid #e5e7eb', paddingTop: 16 }}>
      <span style={{ fontSize: 12, color: '#6b7280' }}>{selectedCount} selected</span>
      <button style={{ padding: '8px 16px', fontSize: 13, background: '#111', color: '#fff', border: 'none', borderRadius: 6, cursor: 'pointer' }} onClick={onClose}>
        Done
      </button>
    </div>
  )
}

function FilterRow({ label, children }) {
  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
      <span style={{ fontSize: 10, fontWeight: 700, color: '#6b7280', textTransform: 'uppercase', letterSpacing: '.5px' }}>
        {label}:
      </span>
      {children}
    </div>
  )
}

function FilterButton({ active, count, onClick }) {
  return (
    <button
      onClick={onClick}
      style={{
        padding: '4px 10px', borderRadius: 14, fontSize: 11, cursor: 'pointer',
        background: active ? '#111' : '#fff',
        color:      active ? '#fff' : '#4b5563',
        border: `1px solid ${active ? '#111' : '#d1d5db'}`,
      }}
    >
      {count === 0 ? 'All' : `${count} Selected`}
    </button>
  )
}

function Chip({ label, active, color, onClick }) {
  return (
    <button
      onClick={onClick}
      style={{
        padding: '4px 10px', borderRadius: 14, fontSize: 11, cursor: 'pointer',
        fontWeight: active ? 600 : 400,
        border:     `1px solid ${active ? (color?.border ?? '#000') : '#d1d5db'}`,
        background: active ? (color?.bg  ?? '#111') : '#fff',
        color:      active ? (color?.text ?? '#fff') : '#4b5563',
        transition: 'all .15s', whiteSpace: 'nowrap',
      }}
    >
      {label}
    </button>
  )
}

// ── Conflict badge ─────────────────────────────────────────────────────────────
function ConflictBadge({ label }) {
  // Colour-code by type
  const isRoom    = label?.includes('Room')
  const isFac     = label?.includes('Faculty')
  const isSec     = label?.includes('Section')
  const multi     = [isRoom, isFac, isSec].filter(Boolean).length > 1

  let bg = '#fef2f2', color = '#b91c1c', border = '#fecaca'
  if (multi)   { bg = '#fff7ed'; color = '#c2410c'; border = '#fed7aa' }
  else if (isFac) { bg = '#eff6ff'; color = '#1d4ed8'; border = '#bfdbfe' }
  else if (isSec) { bg = '#fdf4ff'; color = '#7e22ce'; border = '#e9d5ff' }

  return (
    <span style={{ fontSize: 9, fontWeight: 700, background: bg, color, border: `1px solid ${border}`, borderRadius: 3, padding: '1px 5px', whiteSpace: 'nowrap' }}>
      ⚠ {label || 'Conflict'}
    </span>
  )
}

// ── Merged badge ──────────────────────────────────────────────────────────────
function MergedBadge() {
  return (
    <span style={{ fontSize: 9, fontWeight: 700, background: '#eff6ff', color: '#1d4ed8', border: '1px solid #bfdbfe', borderRadius: 3, padding: '1px 5px', whiteSpace: 'nowrap' }}>
      ⚡ Merged
    </span>
  )
}

// ── Room Chip (used in override modal) ───────────────────────────────────────
function RoomChip({ room, selected, hasRoomConflict, onClick }) {
  let bg, border, color, shadow
  if (selected && hasRoomConflict) {
    bg = '#dc2626'; border = '#b91c1c'; color = '#fff'; shadow = '0 0 0 2px rgba(220,38,38,.25)'
  } else if (selected) {
    bg = '#111'; border = '#111'; color = '#fff'; shadow = '0 0 0 2px rgba(0,0,0,.15)'
  } else if (hasRoomConflict) {
    bg = '#fef2f2'; border = '#fca5a5'; color = '#b91c1c'; shadow = 'none'
  } else {
    bg = '#f9fafb'; border = '#d1d5db'; color = '#374151'; shadow = 'none'
  }
  return (
    <button
      onClick={onClick}
      title={hasRoomConflict ? '⚠ Room occupied at this time' : room}
      style={{
        padding: '4px 9px', borderRadius: 6, fontSize: 11,
        fontWeight: selected ? 700 : 400,
        background: bg, border: `1.5px solid ${border}`, color,
        cursor: 'pointer', transition: 'all .12s',
        whiteSpace: 'nowrap', display: 'flex', alignItems: 'center', gap: 3,
        boxShadow: shadow,
      }}
    >
      {hasRoomConflict && <span style={{ fontSize: 9 }}>⚠</span>}
      {room}
    </button>
  )
}


function SessionCard({ event, onClick, conflictInfo, isDragging, isDimmed, onDragStart, onDragEnd, compact, slotH = SLOT_HEIGHT }) {
  const clr    = programColor(event.program)
  const { top, height } = getEventStyle(event.period, slotH)
  const merged = isMergedEvent(event)

  // Styling precedence: conflict > merged > normal
  let borderColor, bgColor, shadow
  if (conflictInfo) {
    borderColor = '#ef4444'
    bgColor     = '#fff5f5'
    shadow      = '0 0 0 2px rgba(239,68,68,.20), 0 2px 6px rgba(0,0,0,.06)'
  } else if (merged) {
    borderColor = '#3b82f6'
    bgColor     = '#eff6ff'
    shadow      = '0 0 0 1px rgba(59,130,246,.25), 0 2px 6px rgba(0,0,0,.06)'
  } else {
    borderColor = clr.border
    bgColor     = '#fff'
    shadow      = '0 1px 4px rgba(0,0,0,.06)'
  }

  // ── Compact label: "GEC02-BSCS3A-LEC"
  const compactLabel = [
    event.courseCode,
    `${event.program ?? ''}${event.year ?? ''}${event.block ?? ''}`,
    event.session,
  ].filter(Boolean).join('-')

  if (compact) {
    return (
      <div
        draggable
        onDragStart={onDragStart}
        onDragEnd={onDragEnd}
        onClick={() => onClick(event)}
        title={`${compactLabel} · ${event.period}${merged ? ' [Merged]' : ''}${conflictInfo ? ` · ⚠ ${conflictInfo.label}` : ''}`}
        style={{
          position: 'absolute', top: top + 1, height: Math.max(height - 4, 14), left: 2, right: 2,
          background: clr.bg,
          border: `1px solid ${borderColor}`,
          borderLeft: `3px solid ${borderColor}`,
          borderRadius: 4,
          cursor: isDragging ? 'grabbing' : 'grab',
          opacity: isDimmed ? 0.35 : isDragging ? 0.6 : 1,
          overflow: 'hidden', zIndex: conflictInfo ? 5 : 3,
          boxSizing: 'border-box', userSelect: 'none',
          display: 'flex', alignItems: 'center',
          padding: '0 4px',
          boxShadow: conflictInfo ? '0 0 0 1px rgba(239,68,68,.3)' : 'none',
          transition: 'opacity .15s',
        }}
        onMouseEnter={e => { if (!isDragging) e.currentTarget.style.filter = 'brightness(0.93)' }}
        onMouseLeave={e => { e.currentTarget.style.filter = 'none' }}
      >
        {conflictInfo && (
          <span style={{ fontSize: 8, color: '#ef4444', marginRight: 3, flexShrink: 0 }}>⚠</span>
        )}
        {merged && (
          <span style={{ fontSize: 8, color: '#3b82f6', marginRight: 3, flexShrink: 0 }}>⚡</span>
        )}
        <span style={{
          fontSize: 9, fontWeight: 700, color: clr.text,
          whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis',
          letterSpacing: '.2px', lineHeight: 1,
        }}>
          {compactLabel}
        </span>
      </div>
    )
  }

  return (
    <div
      draggable
      onDragStart={onDragStart}
      onDragEnd={onDragEnd}
      onClick={() => onClick(event)}
      title={`${event.courseCode} · ${event.period}${merged ? ' [Merged]' : ''}${conflictInfo ? ` · ⚠ ${conflictInfo.label}` : ''}`}
      style={{
        position: 'absolute', top, height: height - 3, left: 3, right: 3,
        background: bgColor, border: `1px solid ${borderColor}`, borderLeft: `4px solid ${borderColor}`,
        borderRadius: 6, padding: '5px 7px',
        cursor: isDragging ? 'grabbing' : 'grab',
        opacity: isDimmed ? 0.4 : isDragging ? 0.6 : 1,
        transition: 'box-shadow .15s, opacity .15s', boxShadow: shadow,
        overflow: 'hidden', zIndex: conflictInfo ? 5 : 3, boxSizing: 'border-box', userSelect: 'none',
      }}
      onMouseEnter={e => { if (!isDragging) { e.currentTarget.style.boxShadow = '0 4px 14px rgba(0,0,0,.12)'; e.currentTarget.style.zIndex = 20 } }}
      onMouseLeave={e => { e.currentTarget.style.boxShadow = shadow; e.currentTarget.style.zIndex = conflictInfo ? 5 : 3 }}
    >
      {/* Top row: program badge, section, flags */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 4, marginBottom: 3, flexWrap: 'wrap' }}>
        {event.program && (
          <span style={{ fontSize: 9, fontWeight: 700, letterSpacing: '.2px', background: clr.bg, color: clr.text, border: `1px solid ${clr.border}`, borderRadius: 3, padding: '1px 5px', flexShrink: 0 }}>
            {event.program}
          </span>
        )}
        {(event.year || event.block) && (
          <span style={{ fontSize: 9, color: '#4b5563', background: '#f9fafb', border: '1px solid #e5e7eb', borderRadius: 3, padding: '1px 5px', flexShrink: 0 }}>
            {event.year ? (YEAR_LABEL[event.year] ?? `Yr ${event.year}`) : ''}
            {event.year && event.block ? ' · ' : ''}
            {event.block || ''}
          </span>
        )}
        {merged      && <MergedBadge />}
        {conflictInfo && <ConflictBadge label={conflictInfo.label} />}
      </div>

      <div style={{ fontWeight: 700, fontSize: 12, color: '#111', lineHeight: 1.2, marginBottom: 3 }}>{event.courseCode}</div>

      {height > 50 && (
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 4, marginBottom: 3 }}>
          <span style={{ fontSize: 9, fontWeight: 600, color: '#6b7280', textTransform: 'uppercase', letterSpacing: '.3px' }}>{event.session}</span>
          <span style={{ fontSize: 9, color: '#374151', background: '#f3f4f6', padding: '1px 5px', borderRadius: 3, whiteSpace: 'nowrap' }}>{event.period}</span>
        </div>
      )}

      {height > 72 && (
        <div style={{ fontSize: 10, color: '#6b7280', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', borderTop: '1px dashed #e5e7eb', paddingTop: 3 }}>
          {event.faculty || 'TBA'}
        </div>
      )}
    </div>
  )
}

// ── Filter Modals ─────────────────────────────────────────────────────────────
function FilterModal({ title, options, selectedSet, onToggle, onClose }) {
  const [search, setSearch] = useState('')
  const filtered = options.filter(o => o.toLowerCase().includes(search.toLowerCase()))

  return (
    <ModalOverlay onClose={onClose}>
      <div style={{ background: '#fff', borderRadius: 10, padding: 24, width: 400, maxWidth: '92vw', maxHeight: '80vh', display: 'flex', flexDirection: 'column', boxShadow: '0 10px 40px rgba(0,0,0,.2)' }}>
        <ModalHeader title={title} onClose={onClose} />
        <input
          placeholder={`Search ${title.toLowerCase()}...`}
          value={search} onChange={e => setSearch(e.target.value)}
          style={{ padding: '8px 12px', fontSize: 13, width: '100%', borderRadius: 6, border: '1px solid #d1d5db', boxSizing: 'border-box', marginBottom: 16 }}
        />
        <div style={{ overflowY: 'auto', flex: 1, display: 'flex', flexDirection: 'column', gap: 8, paddingRight: 4 }}>
          {filtered.length === 0
            ? <p style={{ fontSize: 13, color: '#6b7280', textAlign: 'center', marginTop: 20 }}>No results found.</p>
            : filtered.map(opt => {
                const isSelected = selectedSet.has(opt)
                return (
                  <label key={opt} style={{ display: 'flex', alignItems: 'center', gap: 12, padding: '10px 14px', cursor: 'pointer', borderRadius: 6, background: isSelected ? '#f3f4f6' : '#fff', border: `1px solid ${isSelected ? '#d1d5db' : '#e5e7eb'}`, margin: 0 }}>
                    <input type="checkbox" checked={isSelected} onChange={() => onToggle(opt)} style={{ cursor: 'pointer', margin: 0, width: 16, height: 16, flexShrink: 0 }} />
                    <span style={{ fontSize: 13, fontWeight: isSelected ? 600 : 400, textTransform: 'capitalize', color: '#111' }}>{opt}</span>
                  </label>
                )
              })
          }
        </div>
        <ModalFooter selectedCount={selectedSet.size} onClose={onClose} />
      </div>
    </ModalOverlay>
  )
}

function RoomFilterModal({ title, options, selectedSet, onToggle, onClose, masterRooms }) {
  const labRooms = options.filter(r => masterRooms.lab.includes(r))
  const lecRooms = options.filter(r => masterRooms.lecture.includes(r))
  options.filter(r => !masterRooms.lab.includes(r) && !masterRooms.lecture.includes(r))
    .forEach(r => (r.toLowerCase().includes('lab') ? labRooms : lecRooms).push(r))

  const RoomGroup = ({ groupTitle, rooms }) => rooms.length === 0 ? null : (
    <div>
      <p style={{ fontSize: 11, fontWeight: 700, color: '#6b7280', marginBottom: 12, textTransform: 'uppercase', letterSpacing: '.5px' }}>{groupTitle}</p>
      <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8 }}>
        {rooms.map(rm => <Chip key={rm} label={rm} active={selectedSet.has(rm)} onClick={() => onToggle(rm)} />)}
      </div>
    </div>
  )

  return (
    <ModalOverlay onClose={onClose}>
      <div style={{ background: '#fff', borderRadius: 10, padding: 24, width: 500, maxWidth: '92vw', maxHeight: '80vh', display: 'flex', flexDirection: 'column', boxShadow: '0 10px 40px rgba(0,0,0,.2)' }}>
        <ModalHeader title={title} onClose={onClose} />
        <div style={{ overflowY: 'auto', flex: 1, display: 'flex', flexDirection: 'column', gap: 24, paddingRight: 4 }}>
          {options.length === 0
            ? <p style={{ fontSize: 13, color: '#6b7280', textAlign: 'center', marginTop: 20 }}>No rooms found.</p>
            : <><RoomGroup groupTitle="Lecture Rooms" rooms={lecRooms} /><RoomGroup groupTitle="Laboratory Rooms" rooms={labRooms} /></>
          }
        </div>
        <ModalFooter selectedCount={selectedSet.size} onClose={onClose} />
      </div>
    </ModalOverlay>
  )
}

// ── Conflict details table (reused in SessionModal) ───────────────────────────
function ConflictTable({ conflicts }) {
  if (!conflicts || conflicts.length === 0) return null
  return (
    <div style={{ overflowX: 'auto', border: '1px solid #fecaca', borderRadius: 8, marginTop: 8 }}>
      <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 11 }}>
        <thead>
          <tr style={{ background: '#fef2f2' }}>
            {['Course', 'Section', 'Day', 'Time', 'Room', 'Faculty', 'Conflict Type'].map(h => (
              <th key={h} style={{ padding: '6px 8px', textAlign: 'left', fontWeight: 700, color: '#991b1b', borderBottom: '1px solid #fecaca', whiteSpace: 'nowrap' }}>{h}</th>
            ))}
          </tr>
        </thead>
        <tbody>
          {conflicts.map((c, i) => (
            <tr key={getEventId(c)} style={{ background: i % 2 === 0 ? '#fff' : '#fff5f5' }}>
              <td style={{ padding: '5px 8px', fontWeight: 600, whiteSpace: 'nowrap' }}>{c.courseCode}</td>
              <td style={{ padding: '5px 8px', whiteSpace: 'nowrap' }}>{c.program} {c.year}-{c.block}</td>
              <td style={{ padding: '5px 8px', whiteSpace: 'nowrap' }}>{c.day}</td>
              <td style={{ padding: '5px 8px', whiteSpace: 'nowrap', fontSize: 10 }}>{c.period}</td>
              <td style={{ padding: '5px 8px', whiteSpace: 'nowrap' }}>{c.room || '—'}</td>
              <td style={{ padding: '5px 8px', overflow: 'hidden', maxWidth: 100, textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{c.faculty || 'TBA'}</td>
              <td style={{ padding: '5px 8px' }}>
                <ConflictBadge label={c.conflictLabel} />
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  )
}

// ── Force-override confirmation dialog ────────────────────────────────────────
function OverrideConfirmDialog({ event, newDay, newPeriod, newRoom, newFaculty, conflicts, onConfirm, onCancel }) {
  return (
    <ModalOverlay onClose={onCancel}>
      <div style={{ background: '#fff', borderRadius: 12, padding: 24, width: 620, maxWidth: '95vw', maxHeight: '90vh', overflowY: 'auto', boxShadow: '0 10px 40px rgba(0,0,0,.25)' }}>
        <ModalHeader title="Confirm Schedule Override" subtitle="This action will force the change despite conflicts." onClose={onCancel} fontSize={16} />

        {/* Before / After summary */}
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12, marginBottom: 16 }}>
          <div style={{ padding: 14, background: '#fff7ed', border: '1px solid #fed7aa', borderRadius: 8 }}>
            <p style={{ fontSize: 11, fontWeight: 700, color: '#c2410c', textTransform: 'uppercase', letterSpacing: '.5px', margin: '0 0 8px' }}>Current</p>
            <p style={{ margin: '0 0 4px', fontWeight: 700, fontSize: 13 }}>{event.courseCode}</p>
            <p style={{ margin: 0, fontSize: 12, color: '#6b7280' }}>{event.day} · {event.period}</p>
            <p style={{ margin: '2px 0 0', fontSize: 12, color: '#6b7280' }}>Room: {event.room || '—'} · {event.faculty || 'TBA'}</p>
          </div>
          <div style={{ padding: 14, background: '#f0fdf4', border: '1px solid #bbf7d0', borderRadius: 8 }}>
            <p style={{ fontSize: 11, fontWeight: 700, color: '#15803d', textTransform: 'uppercase', letterSpacing: '.5px', margin: '0 0 8px' }}>New</p>
            <p style={{ margin: '0 0 4px', fontWeight: 700, fontSize: 13 }}>{event.courseCode}</p>
            <p style={{ margin: 0, fontSize: 12, color: '#6b7280' }}>{newDay} · {newPeriod}</p>
            <p style={{ margin: '2px 0 0', fontSize: 12, color: '#6b7280' }}>Room: {newRoom} · {newFaculty || 'TBA'}</p>
          </div>
        </div>

        {conflicts.length > 0 && (
          <>
            <p style={{ margin: '0 0 6px', fontSize: 12, fontWeight: 700, color: '#b91c1c', display: 'flex', alignItems: 'center', gap: 6 }}>
              ⚠️ {conflicts.length} class{conflicts.length > 1 ? 'es' : ''} will conflict with this change:
            </p>
            <ConflictTable conflicts={conflicts} />
          </>
        )}

        <div style={{ display: 'flex', gap: 10, marginTop: 20, borderTop: '1px solid #e5e7eb', paddingTop: 16 }}>
          <button
            onClick={onConfirm}
            style={{ flex: 1, padding: '9px 16px', fontSize: 13, fontWeight: 700, background: '#dc2626', color: '#fff', border: 'none', borderRadius: 6, cursor: 'pointer' }}
          >
            Force Override
          </button>
          <button
            onClick={onCancel}
            style={{ flex: 1, padding: '9px 16px', fontSize: 13, fontWeight: 600, background: '#fff', color: '#374151', border: '1px solid #d1d5db', borderRadius: 6, cursor: 'pointer' }}
          >
            Cancel
          </button>
        </div>
      </div>
    </ModalOverlay>
  )
}

// ── Session Modal ─────────────────────────────────────────────────────────────
function SessionModal({ event, allEvents, onClose, onSaved, masterRooms, masterFacultyList }) {
  const originalRange = parsePeriodRange(event.period)
  const duration      = originalRange?.duration ?? 60
  const evId          = getEventId(event)
  const merged        = isMergedEvent(event)

  const [newRoom,    setNewRoom]    = useState(event.room)
  const [newDay,     setNewDay]     = useState(event.day)
  const [newFaculty, setNewFaculty] = useState(event.faculty)
  const [newStart,   setNewStart]   = useState(originalRange?.start ?? DAY_START_HOUR * 60)
  const [saving,     setSaving]     = useState(false)
  const [error,      setError]      = useState('')
  const [showConfirm, setShowConfirm] = useState(false)

  const newEnd    = newStart + duration
  const newPeriod = `${minutesToTimeLabel(newStart)} - ${minutesToTimeLabel(newEnd)}`

  // Conflicts at the CURRENT schedule position
  const currentConflicts = useMemo(() =>
    originalRange
      ? findConflicts(allEvents, {
          evId, day: event.day,
          startMin: originalRange.start, endMin: originalRange.end,
          room: event.room, faculty: event.faculty,
          program: event.program, year: event.year, block: event.block,
        })
      : [],
  [event, allEvents, evId, originalRange])

  // Conflicts at the PROPOSED new position (live check)
  const previewConflicts = useMemo(() =>
    findConflicts(allEvents, {
      evId, day: newDay,
      startMin: newStart, endMin: newEnd,
      room: newRoom, faculty: newFaculty,
      program: event.program, year: event.year, block: event.block,
    }),
  [allEvents, evId, newDay, newStart, newEnd, newRoom, newFaculty, event.program, event.year, event.block])

  const timeOptions  = TIME_SLOTS.filter(s => s.startMinutes <= DAY_END_HOUR * 60 - duration)
  const allFacNames  = [...new Set([...masterFacultyList.map(f => f.name), event.faculty])].filter(n => n && n !== 'TBA').sort()

  // Build room lists — fall back to scanning allEvents if master lists are empty
  const lectureRooms = masterRooms.lecture.length > 0
    ? masterRooms.lecture
    : []
  const labRooms = masterRooms.lab.length > 0
    ? masterRooms.lab
    : []
  const knownRooms = new Set([...lectureRooms, ...labRooms])
  const otherRooms = [...new Set(allEvents.map(e => e.room).filter(r => r && r !== 'TBA' && !knownRooms.has(r)))].sort()

  // Per-room conflict check — only room occupancy, not section/faculty
  const roomConflictSet = useMemo(() => {
    const set = new Set()
    const allRoomsToCheck = [...lectureRooms, ...labRooms, ...otherRooms]
    allRoomsToCheck.forEach(r => {
      const conflicts = findConflicts(allEvents, {
        evId, day: newDay, startMin: newStart, endMin: newEnd,
        room: r, faculty: null, program: null, year: null, block: null,
      })
      if (conflicts.length > 0) set.add(r)
    })
    return set
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [allEvents, evId, newDay, newStart, newEnd])

  // Per-time-slot full conflict check (room + section + faculty)
  const timeConflictMap = useMemo(() => {
    const m = new Map()
    TIME_SLOTS.forEach(s => {
      if (s.startMinutes > DAY_END_HOUR * 60 - duration) return
      const slotEnd = s.startMinutes + duration
      const conflicts = findConflicts(allEvents, {
        evId, day: newDay, startMin: s.startMinutes, endMin: slotEnd,
        room: newRoom, faculty: newFaculty,
        program: event.program, year: event.year, block: event.block,
      })
      if (conflicts.length > 0) {
        // Collect unique conflict type labels
        const typeSet = new Set()
        conflicts.forEach(c => {
          if (c.conflictLabel) c.conflictLabel.replace(' Conflict', '').split(' + ').forEach(t => typeSet.add(t))
        })
        m.set(s.startMinutes, { conflicts, typeLabel: [...typeSet].join(' + ') || 'Conflict' })
      }
    })
    return m
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [allEvents, evId, newDay, newRoom, newFaculty, duration, event.program, event.year, event.block])

  const hasChanges = newRoom !== event.room || newDay !== event.day || newStart !== originalRange?.start || newFaculty !== event.faculty

  async function doSave(force = false) {
    setSaving(true); setError('')
    try {
      await overrideSession({
        courseCode:    event.courseCode,
        block:         event.block,
        session:       event.session,
        new_room:      newRoom,
        new_day:       newDay,
        new_period:    newPeriod,
        new_faculty:   newFaculty !== event.faculty ? newFaculty : undefined,
        force_override: force || undefined,
      })
      onSaved(); onClose()
    } catch (err) {
      const detail = err.response?.data?.detail
      if (detail?.conflict) {
        const ce = detail.conflicting_event
        setError(`Conflict detected with ${ce.courseCode} ${ce.block} (${ce.session}).`)
      } else {
        setError(typeof detail === 'string' ? detail : 'Failed to save changes.')
      }
    } finally { setSaving(false) }
  }

  async function handleSave() {
    if (previewConflicts.length > 0) {
      setShowConfirm(true) // ask user to confirm force override
    } else {
      await doSave(false)
    }
  }

  const selectStyle = { padding: '8px 10px', fontSize: 13, width: '100%', borderRadius: 6, border: '1px solid #d1d5db', background: '#fff' }
  const labelStyle  = { fontSize: 12, fontWeight: 600, display: 'block', marginBottom: 4, color: '#374151' }

  return (
    <>
      <ModalOverlay onClose={onClose}>
        <div style={{ background: '#fff', borderRadius: 12, padding: 24, width: 560, maxWidth: '96vw', boxShadow: '0 10px 40px rgba(0,0,0,.2)', maxHeight: '92vh', overflowY: 'auto' }}>
          <ModalHeader
            title="Session Details"
            subtitle={merged ? '⚡ This session is part of a merged block class' : undefined}
            onClose={onClose}
            fontSize={18}
          />

          {/* Event Info Card */}
          <div style={{ padding: 14, background: merged ? '#eff6ff' : '#f9fafb', borderRadius: 8, border: `1px solid ${merged ? '#bfdbfe' : '#e5e7eb'}`, marginBottom: 16 }}>
            <p style={{ margin: '0 0 4px', fontSize: 15, fontWeight: 700 }}>
              {event.courseCode}
              {merged && <span style={{ marginLeft: 8, fontSize: 11, fontWeight: 600, color: '#1d4ed8', background: '#dbeafe', padding: '2px 8px', borderRadius: 4 }}>Merged Block</span>}
              {' '}— {event.block}
            </p>
            <p style={{ margin: '0 0 10px', fontSize: 13, color: '#4b5563', lineHeight: 1.3 }}>{event.title || 'No Title Available'}</p>
            <div style={{ display: 'flex', gap: 8, fontSize: 11, color: '#4b5563', flexWrap: 'wrap' }}>
              <span style={{ background: '#e5e7eb', padding: '3px 8px', borderRadius: 4, fontWeight: 600 }}>{event.program}</span>
              {event.year && <span style={{ background: '#fff', border: '1px solid #d1d5db', padding: '2px 8px', borderRadius: 4 }}>{YEAR_LABEL[event.year] || `Yr ${event.year}`}</span>}
              <span style={{ background: '#fff', border: '1px solid #d1d5db', padding: '2px 8px', borderRadius: 4 }}>{event.session}</span>
              {event.room && event.room !== 'TBA' && (
                <span style={{ background: '#fff', border: '1px solid #d1d5db', padding: '2px 8px', borderRadius: 4 }}>📍 {event.room}</span>
              )}
            </div>
          </div>

          {/* Active Conflict Warning */}
          {currentConflicts.length > 0 && (
            <div style={{ background: '#fef2f2', border: '1px solid #fecaca', padding: '10px 14px', borderRadius: 8, marginBottom: 16 }}>
              <p style={{ margin: '0 0 6px', fontSize: 12, fontWeight: 700, color: '#b91c1c' }}>
                ⚠️ Active Conflict ({currentConflicts.length} class{currentConflicts.length > 1 ? 'es' : ''})
              </p>
              <ConflictTable conflicts={currentConflicts} />
            </div>
          )}

          {/* Reschedule Form */}
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12, marginBottom: 16 }}>
            <div style={{ gridColumn: 'span 2' }}>
              <label style={labelStyle}>Day</label>
              <select style={selectStyle} value={newDay} onChange={e => setNewDay(e.target.value)}>
                {DAYS.map(d => <option key={d} value={d}>{d}</option>)}
              </select>
            </div>

            {/* ── Time Period — scrollable list with conflict cues ── */}
            <div style={{ gridColumn: 'span 2' }}>
              <label style={labelStyle}>
                Time Period
                <span style={{ marginLeft: 6, fontWeight: 400, fontSize: 11, color: '#9ca3af' }}>
                  — ends {minutesToTimeLabel(newEnd)}
                </span>
              </label>
              <div style={{ maxHeight: 176, overflowY: 'auto', border: '1px solid #d1d5db', borderRadius: 8, background: '#fff', boxShadow: '0 1px 4px rgba(0,0,0,.04)' }}>
                {timeOptions.map((s, idx) => {
                  const isSelected   = newStart === s.startMinutes
                  const conflictData = timeConflictMap.get(s.startMinutes)
                  const hasConflict  = !!conflictData
                  const typeLabel    = conflictData?.typeLabel ?? ''
                  const isHour       = s.startMinutes % 60 === 0

                  let bg, color, borderLeft
                  if (isSelected && hasConflict) {
                    bg = '#dc2626'; color = '#fff'; borderLeft = '3px solid #991b1b'
                  } else if (isSelected) {
                    bg = '#111'; color = '#fff'; borderLeft = '3px solid #000'
                  } else if (hasConflict) {
                    bg = '#fef2f2'; color = '#b91c1c'; borderLeft = '3px solid #fca5a5'
                  } else {
                    bg = isHour ? '#fafafa' : '#fff'; color = '#374151'; borderLeft = '3px solid transparent'
                  }

                  return (
                    <div
                      key={s.startMinutes}
                      onClick={() => setNewStart(s.startMinutes)}
                      style={{
                        padding: '6px 10px', display: 'flex', alignItems: 'center',
                        justifyContent: 'space-between', cursor: 'pointer',
                        background: bg, color, borderLeft,
                        borderBottom: idx < timeOptions.length - 1 ? '1px solid #f3f4f6' : 'none',
                        fontSize: isHour ? 12 : 11,
                        fontWeight: isSelected ? 700 : isHour ? 500 : 400,
                        transition: 'background .1s',
                      }}
                      onMouseEnter={e => { if (!isSelected) e.currentTarget.style.background = hasConflict ? '#fee2e2' : '#f3f4f6' }}
                      onMouseLeave={e => { if (!isSelected) e.currentTarget.style.background = bg }}
                    >
                      <span>
                        {s.label}
                        <span style={{ marginLeft: 4, fontSize: 10, opacity: .6 }}>→ {minutesToTimeLabel(s.startMinutes + duration)}</span>
                      </span>
                      {isSelected && !hasConflict && <span style={{ fontSize: 11 }}>✓</span>}
                      {hasConflict && (
                        <span style={{ fontSize: 10, fontWeight: 700 }}>
                          ⚠ {typeLabel}
                        </span>
                      )}
                    </div>
                  )
                })}
              </div>
            </div>

            {/* ── Room — chips grouped by Lecture / Lab ── */}
            <div style={{ gridColumn: 'span 2' }}>
              <label style={labelStyle}>
                Room
                {roomConflictSet.size > 0 && (
                  <span style={{ marginLeft: 8, fontSize: 10, fontWeight: 500, color: '#b91c1c' }}>
                    — {roomConflictSet.size} room{roomConflictSet.size > 1 ? 's' : ''} occupied at this time
                  </span>
                )}
              </label>

              {/* TBA pill */}
              <div style={{ display: 'flex', flexWrap: 'wrap', gap: 5, marginBottom: 8 }}>
                <RoomChip room="TBA" selected={newRoom === 'TBA'} hasRoomConflict={false} onClick={() => setNewRoom('TBA')} />
              </div>

              {lectureRooms.length > 0 && (
                <div style={{ marginBottom: 10 }}>
                  <div style={{ fontSize: 10, fontWeight: 700, color: '#6b7280', textTransform: 'uppercase', letterSpacing: '.5px', marginBottom: 5 }}>
                    📋 Lecture Rooms
                  </div>
                  <div style={{ display: 'flex', flexWrap: 'wrap', gap: 5 }}>
                    {lectureRooms.map(r => (
                      <RoomChip key={r} room={r} selected={newRoom === r} hasRoomConflict={roomConflictSet.has(r)} onClick={() => setNewRoom(r)} />
                    ))}
                  </div>
                </div>
              )}

              {labRooms.length > 0 && (
                <div style={{ marginBottom: otherRooms.length > 0 ? 10 : 0 }}>
                  <div style={{ fontSize: 10, fontWeight: 700, color: '#6b7280', textTransform: 'uppercase', letterSpacing: '.5px', marginBottom: 5 }}>
                    🔬 Lab Rooms
                  </div>
                  <div style={{ display: 'flex', flexWrap: 'wrap', gap: 5 }}>
                    {labRooms.map(r => (
                      <RoomChip key={r} room={r} selected={newRoom === r} hasRoomConflict={roomConflictSet.has(r)} onClick={() => setNewRoom(r)} />
                    ))}
                  </div>
                </div>
              )}

              {otherRooms.length > 0 && (
                <div>
                  <div style={{ fontSize: 10, fontWeight: 700, color: '#6b7280', textTransform: 'uppercase', letterSpacing: '.5px', marginBottom: 5 }}>
                    🏫 {lectureRooms.length === 0 && labRooms.length === 0 ? 'Rooms' : 'Other Rooms'}
                  </div>
                  <div style={{ display: 'flex', flexWrap: 'wrap', gap: 5 }}>
                    {otherRooms.map(r => (
                      <RoomChip key={r} room={r} selected={newRoom === r} hasRoomConflict={roomConflictSet.has(r)} onClick={() => setNewRoom(r)} />
                    ))}
                  </div>
                </div>
              )}

              {lectureRooms.length === 0 && labRooms.length === 0 && otherRooms.length === 0 && (
                <p style={{ fontSize: 12, color: '#9ca3af', margin: '4px 0 0' }}>No room data loaded — showing TBA only.</p>
              )}
            </div>

            <div style={{ gridColumn: 'span 2' }}>
              <label style={labelStyle}>Faculty</label>
              <select style={selectStyle} value={newFaculty} onChange={e => setNewFaculty(e.target.value)}>
                <option value="TBA">TBA</option>
                {allFacNames.map(f => <option key={f} value={f}>{f}</option>)}
              </select>
            </div>
          </div>

          {/* Live Conflict Preview */}
          {previewConflicts.length > 0 ? (
            <div style={{ background: '#fffbeb', border: '1px solid #fde68a', padding: '10px 14px', borderRadius: 8, marginBottom: 16 }}>
              <p style={{ margin: '0 0 6px', fontSize: 12, fontWeight: 700, color: '#b45309' }}>
                Live Check — Conflict Detected ({previewConflicts.length})
              </p>
              <ConflictTable conflicts={previewConflicts} />
              <p style={{ margin: '8px 0 0', fontSize: 11, color: '#92400e' }}>
                You can still force this override — you will be asked to confirm.
              </p>
            </div>
          ) : (
            <div style={{ background: '#f0fdf4', border: '1px solid #bbf7d0', padding: '10px 14px', borderRadius: 8, marginBottom: 16 }}>
              <p style={{ margin: 0, fontSize: 12, fontWeight: 600, color: '#166534' }}>✓ No conflicts — time, room, faculty, and section are all clear.</p>
            </div>
          )}

          {error && (
            <p style={{ fontSize: 12, color: '#dc2626', margin: '0 0 12px', background: '#fef2f2', padding: '8px 10px', borderRadius: 6 }}>{error}</p>
          )}

          <div style={{ display: 'flex', gap: 10, borderTop: '1px solid #e5e7eb', paddingTop: 16 }}>
            <button
              style={{ padding: '8px 16px', fontSize: 13, background: previewConflicts.length > 0 ? '#dc2626' : '#111', color: '#fff', border: 'none', borderRadius: 6, cursor: saving || !hasChanges ? 'not-allowed' : 'pointer', flex: 1, fontWeight: 600, opacity: !hasChanges ? 0.5 : 1 }}
              onClick={handleSave}
              disabled={saving || !hasChanges}
            >
              {saving ? 'Applying…' : previewConflicts.length > 0 ? '⚠ Force Override' : 'Apply Reschedule'}
            </button>
            <button
              style={{ padding: '8px 16px', fontSize: 13, background: '#fff', border: '1px solid #d1d5db', borderRadius: 6, cursor: 'pointer', flex: 1, fontWeight: 600, color: '#374151' }}
              onClick={onClose}
            >
              Cancel
            </button>
          </div>
        </div>
      </ModalOverlay>

      {/* Force Override confirmation */}
      {showConfirm && (
        <OverrideConfirmDialog
          event={event}
          newDay={newDay}
          newPeriod={newPeriod}
          newRoom={newRoom}
          newFaculty={newFaculty}
          conflicts={previewConflicts}
          onConfirm={async () => { setShowConfirm(false); await doSave(true) }}
          onCancel={() => setShowConfirm(false)}
        />
      )}
    </>
  )
}

// ── Toast ─────────────────────────────────────────────────────────────────────
function Toast({ message, type, onDismiss }) {
  useEffect(() => {
    const t = setTimeout(onDismiss, 4500)
    return () => clearTimeout(t)
  }, [onDismiss])

  const colors = type === 'error'
    ? { bg: '#fef2f2', border: '#fecaca', text: '#b91c1c' }
    : type === 'warning'
    ? { bg: '#fffbeb', border: '#fde68a', text: '#b45309' }
    : { bg: '#f0fdf4', border: '#bbf7d0', text: '#15803d' }

  return (
    <div style={{ position: 'fixed', bottom: 24, right: 24, zIndex: 1000, background: colors.bg, border: `1px solid ${colors.border}`, color: colors.text, borderRadius: 8, padding: '10px 16px', fontSize: 13, fontWeight: 500, boxShadow: '0 4px 16px rgba(0,0,0,.12)', maxWidth: 400, display: 'flex', alignItems: 'center', gap: 10, animation: 'slideIn .2s ease' }}>
      <span style={{ flex: 1 }}>{message}</span>
      <button onClick={onDismiss} style={{ background: 'none', border: 'none', cursor: 'pointer', fontSize: 16, color: 'inherit', padding: 0, lineHeight: 1 }}>×</button>
    </div>
  )
}

// ── Custom hooks ──────────────────────────────────────────────────────────────

function useFilters(events, masterFacultyList, masterRooms, activeDay) {
  const [searchQuery,    setSearchQuery]    = useState('')
  const [filterFac,      setFilterFac]      = useState(new Set())
  const [filterPrograms, setFilterPrograms] = useState(new Set())
  const [filterYears,    setFilterYears]    = useState(new Set())
  const [filterRooms,    setFilterRooms]    = useState(new Set())
  const [filterBlocks,   setFilterBlocks]   = useState(new Set())
  const [filterSessions, setFilterSessions] = useState(new Set())
  const [filterConflicts,  setFilterConflicts]  = useState(false)
  const [filterUnassigned, setFilterUnassigned] = useState(false)
  const [filterMerged,     setFilterMerged]     = useState(false)

  const makeToggle = setter => val =>
    setter(prev => { const n = new Set(prev); n.has(val) ? n.delete(val) : n.add(val); return n })

  const toggles = {
    program:    makeToggle(setFilterPrograms),
    year:       makeToggle(setFilterYears),
    room:       makeToggle(setFilterRooms),
    faculty:    makeToggle(setFilterFac),
    block:      makeToggle(setFilterBlocks),
    session:    makeToggle(setFilterSessions),
    conflicts:  () => setFilterConflicts(v => !v),
    unassigned: () => setFilterUnassigned(v => !v),
    merged:     () => setFilterMerged(v => !v),
  }

  const options = useMemo(() => {
    const programs = new Set(), years = new Set(), blocksSet = new Set(), sessSet = new Set()
    const faculty  = new Set(masterFacultyList.map(f => f.name))
    const roomsSet = new Set([...masterRooms.lecture, ...masterRooms.lab])
    events.forEach(e => {
      if (e.program) programs.add(e.program)
      if (e.year)    years.add(e.year)
      if (e.faculty && e.faculty !== 'TBA') faculty.add(e.faculty)
      if (e.room)    roomsSet.add(e.room)
      if (e.block)   blocksSet.add(e.block)
      if (e.session) sessSet.add(e.session)
    })
    return {
      allPrograms: [...programs].sort(),
      allYears:    [...years].sort((a, b) => a - b),
      allFaculty:  [...faculty].sort(),
      allRooms:    [...roomsSet].sort(),
      allBlocks:   [...blocksSet].sort(),
      allSessions: [...sessSet].sort(),
    }
  }, [events, masterFacultyList, masterRooms])

  const dayEvents = useMemo(() => {
    const q = searchQuery.trim().toLowerCase()
    return events
      .filter(e => {
        if (e.day !== activeDay) return false
        if (q) {
          const matchCode  = (e.courseCode || '').toLowerCase().includes(q)
          const matchBlock = (e.block || '').toLowerCase().includes(q)
          const matchFac   = (e.faculty || '').toLowerCase().includes(q)
          const matchTitle = q.length >= 3 && (e.title || '').toLowerCase().includes(q)
          if (!matchCode && !matchBlock && !matchFac && !matchTitle) return false
        }
        if (filterFac.size      > 0 && !filterFac.has(e.faculty))      return false
        if (filterPrograms.size > 0 && !filterPrograms.has(e.program)) return false
        if (filterYears.size    > 0 && !filterYears.has(e.year))       return false
        if (filterRooms.size    > 0 && !filterRooms.has(e.room))       return false
        if (filterBlocks.size   > 0 && !filterBlocks.has(e.block))     return false
        if (filterSessions.size > 0 && !filterSessions.has(e.session)) return false
        return true
      })
      .sort((a, b) => {
        const ra = parsePeriodRange(a.period), rb = parsePeriodRange(b.period)
        return (ra?.start ?? 9999) - (rb?.start ?? 9999)
      })
  }, [events, activeDay, searchQuery, filterFac, filterPrograms, filterYears, filterRooms, filterBlocks, filterSessions])

  const hasFilters = !!(searchQuery || filterFac.size || filterPrograms.size || filterYears.size || filterRooms.size || filterBlocks.size || filterSessions.size || filterConflicts || filterUnassigned || filterMerged)

  function clearFilters() {
    setSearchQuery('')
    setFilterFac(new Set()); setFilterPrograms(new Set()); setFilterYears(new Set())
    setFilterRooms(new Set()); setFilterBlocks(new Set()); setFilterSessions(new Set())
    setFilterConflicts(false); setFilterUnassigned(false); setFilterMerged(false)
  }

  return {
    searchQuery, setSearchQuery,
    filterFac, filterRooms, filterPrograms, filterYears, filterBlocks, filterSessions,
    filterConflicts, filterUnassigned, filterMerged,
    toggles, options, dayEvents, hasFilters, clearFilters,
  }
}

function useDragDrop(events, activeDay, setLocalEvents, setEvents, storeEvents) {
  const [draggedEvent, setDraggedEvent] = useState(null)
  const [hoveredCell,  setHoveredCell]  = useState(null)
  const [toast,        setToast]        = useState(null)

  const handleDragStart = useCallback((e, event) => {
    setDraggedEvent(event)
    e.dataTransfer.effectAllowed = 'move'
    e.dataTransfer.setData('text/plain', getEventId(event))
  }, [])

  const handleDragEnd = useCallback(() => {
    setDraggedEvent(null); setHoveredCell(null)
  }, [])

  const handleDragOver = useCallback((e, room, slot) => {
    e.preventDefault(); e.dataTransfer.dropEffect = 'move'
    setHoveredCell(`${room}|${slot.startMinutes}`)
  }, [])

  const handleDragLeave = useCallback(e => {
    if (!e.currentTarget.contains(e.relatedTarget)) setHoveredCell(null)
  }, [])

  const handleDrop = useCallback((e, targetRoom, slot) => {
    e.preventDefault(); setHoveredCell(null)
    if (!draggedEvent) return

    const dragRange = parsePeriodRange(draggedEvent.period)
    if (!dragRange) return

    const { duration } = dragRange
    const newStart  = slot.startMinutes
    const newEnd    = newStart + duration
    const newPeriod = `${minutesToTimeLabel(newStart)} - ${minutesToTimeLabel(newEnd)}`

    if (draggedEvent.room === targetRoom && dragRange.start === newStart) return

    const dragId   = getEventId(draggedEvent)
    const proposed = { start: newStart, end: newEnd }

    // Full conflict check: room + section + faculty
    const conflicting = events.filter(ev => {
      if (getEventId(ev) === dragId || ev.day !== activeDay) return false
      const r = parsePeriodRange(ev.period)
      if (!r || !timeOverlaps(proposed, r)) return false

      const roomConflict    = ev.room === targetRoom && targetRoom !== 'TBA'
      const sectionConflict = draggedEvent.program && draggedEvent.year && draggedEvent.block &&
                              ev.program === draggedEvent.program &&
                              String(ev.year) === String(draggedEvent.year) &&
                              ev.block === draggedEvent.block
      const facultyConflict = draggedEvent.faculty && draggedEvent.faculty !== 'TBA' &&
                              ev.faculty === draggedEvent.faculty

      return roomConflict || sectionConflict || facultyConflict
    })

    if (conflicting.length > 0) {
      const conflictTypes = new Set()
      conflicting.forEach(c => {
        if (c.room === targetRoom) conflictTypes.add('Room')
        if (draggedEvent.program && c.program === draggedEvent.program &&
            String(c.year) === String(draggedEvent.year) && c.block === draggedEvent.block)
          conflictTypes.add('Section')
        if (draggedEvent.faculty && c.faculty === draggedEvent.faculty) conflictTypes.add('Faculty')
      })
      setToast({
        type: 'error',
        message: `${[...conflictTypes].join(' + ')} conflict with: ${conflicting.map(c => `${c.courseCode} (${c.block})`).join(', ')}. Move cancelled.`,
      })
      return
    }

    const updated = events.map(ev => getEventId(ev) !== dragId ? ev : { ...ev, room: targetRoom, period: newPeriod, day: activeDay })
    setLocalEvents(updated); setEvents(updated)
    setToast({ type: 'success', message: `Moved ${draggedEvent.courseCode} to ${targetRoom} at ${minutesToTimeLabel(newStart)}` })

    overrideSession({ courseCode: draggedEvent.courseCode, block: draggedEvent.block, session: draggedEvent.session, new_room: targetRoom, new_day: activeDay, new_period: newPeriod })
      .catch(err => {
        setLocalEvents(storeEvents); setEvents(storeEvents)
        const detail = err.response?.data?.detail
        setToast({ type: 'error', message: detail?.conflict
          ? `Server conflict: ${detail.conflicting_event?.courseCode}`
          : (typeof detail === 'string' ? detail : 'Override failed — reverted.') })
      })
  }, [draggedEvent, events, activeDay, setEvents, storeEvents])

  /**
   * Returns the conflict info { label } for the hovered drop target, or null if clear.
   */
  const getDropConflict = useCallback((room, slot) => {
    if (!draggedEvent || !hoveredCell) return null
    const [hRoom, hSlot] = hoveredCell.split('|')
    if (hRoom !== room || parseInt(hSlot) !== slot.startMinutes) return null

    const dragRange = parsePeriodRange(draggedEvent.period)
    if (!dragRange) return null
    const newStart  = slot.startMinutes
    const newEnd    = newStart + dragRange.duration
    const dragId    = getEventId(draggedEvent)
    const proposed  = { start: newStart, end: newEnd }

    const conflictTypes = new Set()
    for (const ev of events) {
      if (getEventId(ev) === dragId || ev.day !== activeDay) continue
      const r = parsePeriodRange(ev.period)
      if (!r || !timeOverlaps(proposed, r)) continue

      if (ev.room === room && room !== 'TBA')                             conflictTypes.add('Room')
      if (draggedEvent.program && ev.program === draggedEvent.program &&
          String(ev.year) === String(draggedEvent.year) &&
          ev.block === draggedEvent.block)                                conflictTypes.add('Section')
      if (draggedEvent.faculty && draggedEvent.faculty !== 'TBA' &&
          ev.faculty === draggedEvent.faculty)                            conflictTypes.add('Faculty')
    }

    return conflictTypes.size > 0 ? { label: [...conflictTypes].join(' + ') + ' Conflict' } : null
  }, [draggedEvent, hoveredCell, events, activeDay])

  return { draggedEvent, hoveredCell, toast, setToast, handleDragStart, handleDragEnd, handleDragOver, handleDragLeave, handleDrop, getDropConflict }
}

// ── Conflict Summary Bar ──────────────────────────────────────────────────────
function ConflictSummaryBar({ conflictMap, events }) {
  const roomCount    = [...conflictMap.values()].filter(v => v.label.includes('Room')).length
  const sectionCount = [...conflictMap.values()].filter(v => v.label.includes('Section')).length
  const facultyCount = [...conflictMap.values()].filter(v => v.label.includes('Faculty')).length

  if (conflictMap.size === 0) return null

  return (
    <div style={{ display: 'flex', gap: 8, alignItems: 'center', flexWrap: 'wrap', background: '#fef2f2', border: '1px solid #fecaca', borderRadius: 8, padding: '8px 14px', marginBottom: 12 }}>
      <span style={{ fontSize: 12, fontWeight: 700, color: '#b91c1c' }}>⚠ Conflicts on this day:</span>
      {roomCount    > 0 && <span style={{ fontSize: 11, background: '#fee2e2', color: '#b91c1c', border: '1px solid #fca5a5', borderRadius: 12, padding: '2px 10px', fontWeight: 600 }}>{roomCount} Room</span>}
      {sectionCount > 0 && <span style={{ fontSize: 11, background: '#fdf4ff', color: '#7e22ce', border: '1px solid #e9d5ff', borderRadius: 12, padding: '2px 10px', fontWeight: 600 }}>{sectionCount} Section</span>}
      {facultyCount > 0 && <span style={{ fontSize: 11, background: '#eff6ff', color: '#1d4ed8', border: '1px solid #bfdbfe', borderRadius: 12, padding: '2px 10px', fontWeight: 600 }}>{facultyCount} Faculty</span>}
      <span style={{ fontSize: 11, color: '#6b7280', marginLeft: 4 }}>{conflictMap.size} affected session{conflictMap.size > 1 ? 's' : ''}</span>
    </div>
  )
}

// ── Legend ────────────────────────────────────────────────────────────────────
function Legend() {
  const items = [
    { color: '#4b5563', border: '#9ca3af', bg: '#fff',     label: 'Normal' },
    { color: '#1d4ed8', border: '#3b82f6', bg: '#eff6ff',  label: 'Merged Block' },
    { color: '#b91c1c', border: '#ef4444', bg: '#fff5f5',  label: 'Conflict' },
  ]
  return (
    <div style={{ display: 'flex', gap: 12, alignItems: 'center', flexWrap: 'wrap', fontSize: 11, color: '#6b7280' }}>
      {items.map(({ color, border, bg, label }) => (
        <span key={label} style={{ display: 'flex', alignItems: 'center', gap: 5 }}>
          <span style={{ width: 12, height: 12, borderRadius: 2, background: bg, border: `2px solid ${border}`, flexShrink: 0, display: 'inline-block' }} />
          {label}
        </span>
      ))}
    </div>
  )
}

// ── Main page ─────────────────────────────────────────────────────────────────
export default function ScheduleViewPage() {
  const { name }     = useParams()
  const storeEvents  = useScheduleStore(s => s.events)
  const scheduleName = useScheduleStore(s => s.scheduleName)
  const setEvents    = useScheduleStore(s => s.setEvents)

  const [events, setLocalEvents] = useState(storeEvents)
  useEffect(() => { setLocalEvents(storeEvents) }, [storeEvents])

  const [masterFacultyList, setMasterFacultyList] = useState([])
  const [masterRooms, setMasterRooms] = useState({ lecture: [], lab: [] })
  useEffect(() => {
    getFaculty().then(setMasterFacultyList).catch(() => {})
    getRooms().then(r => setMasterRooms({ lecture: r.lecture || [], lab: r.lab || [] })).catch(() => {})
  }, [])

  const [activeDay,          setActiveDay]          = useState('Monday')
  const [selected,           setSelected]           = useState(null)
  const [isFacModalOpen,     setIsFacModalOpen]     = useState(false)
  const [isRoomModalOpen,    setIsRoomModalOpen]    = useState(false)
  const [calendarMinimized,  setCalendarMinimized]  = useState(false)
  const [filterOccupiedRooms, setFilterOccupiedRooms] = useState(false)

  const {
    searchQuery, setSearchQuery,
    filterFac, filterRooms, filterPrograms, filterYears, filterBlocks, filterSessions,
    filterConflicts, filterUnassigned, filterMerged,
    toggles, options, dayEvents, hasFilters, clearFilters,
  } = useFilters(events, masterFacultyList, masterRooms, activeDay)

  const { allPrograms, allYears, allFaculty, allRooms, allBlocks, allSessions } = options

  const { draggedEvent, hoveredCell, toast, setToast, handleDragStart, handleDragEnd, handleDragOver, handleDragLeave, handleDrop, getDropConflict } =
    useDragDrop(events, activeDay, setLocalEvents, setEvents, storeEvents)

  // Rich conflict map for the current day's events
  const conflictMap = useMemo(() => buildConflictMap(dayEvents), [dayEvents])

  // Optionally filter to only conflicting events
  const displayedDayEvents = useMemo(() => {
    let evs = dayEvents
    if (filterConflicts)  evs = evs.filter(e => conflictMap.has(getEventId(e)))
    if (filterUnassigned) evs = evs.filter(e => !e.faculty || e.faculty === 'TBA' || !e.room || e.room === 'TBA')
    if (filterMerged)     evs = evs.filter(e => isMergedEvent(e))
    return evs
  }, [dayEvents, conflictMap, filterConflicts, filterUnassigned, filterMerged])

  const roomsToDisplay = useMemo(() => {
    let rooms = filterRooms.size > 0 ? allRooms.filter(r => filterRooms.has(r)) : allRooms
    if (filterOccupiedRooms) {
      const occupiedSet = new Set(displayedDayEvents.map(e => e.room))
      rooms = rooms.filter(r => occupiedSet.has(r))
    }
    return rooms
  }, [allRooms, filterRooms, filterOccupiedRooms, displayedDayEvents])

  // Count distinct conflict types across all day events
  const totalConflicts   = conflictMap.size
  const mergedEventCount = dayEvents.filter(isMergedEvent).length

  function handleSaved() {
    if (name) loadSaved(name).then(d => { setEvents(d.schedule); setLocalEvents(d.schedule) })
  }

  function exportCSV() {
    const rows = [
      'courseCode,title,program,year,block,session,day,period,room,faculty,merged,hasConflict,conflictType',
      ...events.map(e => {
        const evId   = getEventId(e)
        const allDay = events.filter(x => x.day === e.day)
        const cMap   = buildConflictMap(allDay)
        const ci     = cMap.get(evId)
        return [
          e.courseCode,
          `"${e.title ?? ''}"`,
          e.program ?? '',
          e.year ?? '',
          e.block ?? '',
          e.session,
          e.day,
          `"${e.period}"`,
          e.room,
          e.faculty,
          isMergedEvent(e) ? 'yes' : 'no',
          ci ? 'yes' : 'no',
          ci ? `"${ci.label}"` : '',
        ].join(',')
      }),
    ].join('\n')
    const a = Object.assign(document.createElement('a'), {
      href: URL.createObjectURL(new Blob([rows], { type: 'text/csv' })),
      download: `${scheduleName || 'schedule'}.csv`,
    })
    a.click()
  }

  if (events.length === 0) return (
    <div className="page" style={{ padding: 20 }}>
      <p className="page-title" style={{ fontSize: 20, marginBottom: 16 }}>Schedule view</p>
      <div className="card" style={{ color: '#888', fontSize: 14, padding: 20 }}>
        No schedule loaded. Go to the Scheduler page to generate or load a schedule.
      </div>
    </div>
  )

  return (
    <div className="page" style={{ padding: 20 }}>
      <style>{`
        @keyframes slideIn { from { transform: translateY(12px); opacity: 0; } to { transform: translateY(0); opacity: 1; } }

        /* ── Grid CSS variables (set inline on container) ── */
        .sv-time-col  { flex: 0 0 var(--sv-time-w); position: sticky; left: 0; z-index: 70; background: #f9fafb; }
        .sv-room-col  { flex: 0 0 var(--sv-room-w); position: relative; }

        .sv-slot-cell { height: var(--sv-slot-h); border-bottom: 1px solid #f0f0f0; box-sizing: border-box; transition: background .12s; position: relative; }
        .sv-slot-cell.half-hour  { border-bottom: 1px dashed #f3f4f6; }
        .sv-slot-cell.drop-hover    { background: #eff6ff; }
        .sv-slot-cell.drop-conflict { background: #fef2f2; }
        .sv-slot-cell.drop-valid    { background: #f0fdf4; }

        .sv-room-header {
          position: sticky; top: 0; z-index: 60;
          height: var(--sv-header-h); box-sizing: border-box;
          display: flex; align-items: center; justify-content: center;
          background: #1f2937; color: #fff; font-weight: 600; font-size: 12px;
          padding: 0 8px; text-align: center;
          border-radius: 6px 6px 0 0; letter-spacing: .4px;
          white-space: nowrap; overflow: hidden; text-overflow: ellipsis;
        }
        .sv-time-header {
          position: sticky; top: 0; left: 0; z-index: 75;
          height: var(--sv-header-h); box-sizing: border-box;
          display: flex; align-items: center; justify-content: center;
          background: #f9fafb; font-size: 10px; color: #9ca3af; font-weight: 600;
          border-radius: 6px 6px 0 0; border-bottom: 1px solid #e5e7eb;
        }
        .sv-time-label {
          height: var(--sv-slot-h); display: flex; align-items: flex-start;
          padding-top: 3px; font-size: 9px; color: #c4c9d4;
          justify-content: flex-end; padding-right: 5px;
          box-sizing: border-box; white-space: nowrap;
        }
        .sv-time-label.hour        { color: #6b7280; font-size: 10px; font-weight: 600; }
        .sv-time-label.half-hour-tick { color: #b0b7c3; font-size: 8px; }

        .sv-events-layer { position: absolute; top: var(--sv-header-h); left: 0; right: 0; pointer-events: none; }
        .sv-events-layer > * { pointer-events: auto; }
        .sv-drop-hint { position: absolute; left: 4px; right: 4px; top: 2px; font-size: 10px; text-align: center; font-weight: 600; pointer-events: none; z-index: 50; }

        /* ── Compact overrides ── */
        .sv-compact .sv-room-header { font-size: 9px; letter-spacing: .2px; border-radius: 3px 3px 0 0; }
        .sv-compact .sv-time-header { font-size: 8px; border-radius: 3px 3px 0 0; }
        .sv-compact .sv-time-label       { padding-top: 2px; padding-right: 3px; font-size: 7px; }
        .sv-compact .sv-time-label.hour  { font-size: 8px; }
        .sv-compact .sv-slot-cell        { border-bottom: 1px solid #f3f4f6; }
        .sv-compact .sv-slot-cell.half-hour { border-bottom: 1px dashed #f9f9f9; }
        .sv-compact .sv-drop-hint        { font-size: 7px; }
      `}</style>

      {/* ── Header ── */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16, flexWrap: 'wrap', gap: 12 }}>
        <div>
          <p className="page-title" style={{ margin: 0, fontSize: 18 }}>
            {scheduleName ? `Schedule — ${scheduleName}` : 'Schedule View'}
          </p>
          <div style={{ display: 'flex', gap: 10, marginTop: 4, flexWrap: 'wrap' }}>
            {totalConflicts > 0 && (
              <span style={{ fontSize: 11, fontWeight: 600, color: '#b91c1c', background: '#fef2f2', border: '1px solid #fecaca', borderRadius: 12, padding: '2px 10px' }}>
                ⚠ {totalConflicts} conflict{totalConflicts > 1 ? 's' : ''} today
              </span>
            )}
            {mergedEventCount > 0 && (
              <span style={{ fontSize: 11, fontWeight: 600, color: '#1d4ed8', background: '#eff6ff', border: '1px solid #bfdbfe', borderRadius: 12, padding: '2px 10px' }}>
                ⚡ {mergedEventCount} merged block{mergedEventCount > 1 ? 's' : ''}
              </span>
            )}
          </div>
        </div>
        <div style={{ display: 'flex', gap: 10, alignItems: 'center', flexWrap: 'wrap' }}>
          <input
            type="text" placeholder="Search by code, block, faculty…"
            value={searchQuery} onChange={e => setSearchQuery(e.target.value)}
            style={{ padding: '6px 12px', fontSize: 12, borderRadius: 6, border: '1px solid #d1d5db', width: 230 }}
          />
          <button style={{ padding: '6px 12px', fontSize: 12, borderRadius: 6, border: '1px solid #d1d5db', background: '#fff', cursor: 'pointer' }} onClick={exportCSV}>
            Export CSV
          </button>
        </div>
      </div>

      {/* ── Filters ── */}
      <div style={{ display: 'flex', alignItems: 'center', flexWrap: 'wrap', gap: 16, marginBottom: 16, background: '#f9fafb', padding: '12px 16px', borderRadius: 8, border: '1px solid #f3f4f6' }}>
        <FilterRow label="Faculty">
          <FilterButton active={filterFac.size > 0} count={filterFac.size} onClick={() => setIsFacModalOpen(true)} />
        </FilterRow>
        <FilterRow label="Rooms">
          <FilterButton active={filterRooms.size > 0} count={filterRooms.size} onClick={() => setIsRoomModalOpen(true)} />
        </FilterRow>
        {allPrograms.length > 0 && (
          <FilterRow label="Program">
            {allPrograms.map(prog => <Chip key={prog} label={prog} active={filterPrograms.has(prog)} color={programColor(prog)} onClick={() => toggles.program(prog)} />)}
          </FilterRow>
        )}
        {allYears.length > 0 && (
          <FilterRow label="Year">
            {allYears.map(yr => <Chip key={yr} label={YEAR_LABEL[yr] ?? `Yr ${yr}`} active={filterYears.has(yr)} onClick={() => toggles.year(yr)} />)}
          </FilterRow>
        )}
        {allBlocks.length > 0 && (
          <FilterRow label="Block">
            {allBlocks.map(blk => <Chip key={blk} label={blk} active={filterBlocks.has(blk)} onClick={() => toggles.block(blk)} />)}
          </FilterRow>
        )}
        {allSessions.length > 0 && (
          <FilterRow label="Type">
            {allSessions.map(sess => <Chip key={sess} label={sess} active={filterSessions.has(sess)} onClick={() => toggles.session(sess)} />)}
          </FilterRow>
        )}
        <FilterRow label="Show">
          <Chip
            label={`⚠ Conflicts${totalConflicts > 0 ? ` (${totalConflicts})` : ''}`}
            active={filterConflicts}
            onClick={toggles.conflicts}
            color={{ bg: '#fef2f2', text: '#b91c1c', border: '#fca5a5' }}
          />
          <Chip
            label="? Unassigned"
            active={filterUnassigned}
            onClick={toggles.unassigned}
            color={{ bg: '#fffbeb', text: '#92400e', border: '#fde68a' }}
          />
          <Chip
            label={`⚡ Merged${mergedEventCount > 0 ? ` (${mergedEventCount})` : ''}`}
            active={filterMerged}
            onClick={toggles.merged}
            color={{ bg: '#eff6ff', text: '#1d4ed8', border: '#bfdbfe' }}
          />
        </FilterRow>
        <FilterRow label="Columns">
          <Chip
            label="📋 Occupied rooms only"
            active={filterOccupiedRooms}
            onClick={() => setFilterOccupiedRooms(v => !v)}
            color={{ bg: '#f0fdf4', text: '#166534', border: '#86efac' }}
          />
        </FilterRow>
        {(hasFilters || filterOccupiedRooms) && (
          <button onClick={() => { clearFilters(); setFilterOccupiedRooms(false) }} style={{ fontSize: 11, color: '#dc2626', background: 'none', border: 'none', cursor: 'pointer', textDecoration: 'underline', padding: '0 4px', marginLeft: 'auto' }}>
            Clear filters
          </button>
        )}
      </div>

      {/* ── Legend ── */}
      <div style={{ marginBottom: 10 }}>
        <Legend />
      </div>

      {/* ── Day Tabs ── */}
      <div style={{ display: 'flex', gap: 8, marginBottom: 12, flexWrap: 'wrap', alignItems: 'center' }}>
        {DAYS.map(day => {
          const count    = events.filter(e => e.day === day).length
          const dayMap   = buildConflictMap(events.filter(e => e.day === day))
          const hasConf  = dayMap.size > 0
          const active   = activeDay === day
          return (
            <button
              key={day}
              onClick={() => setActiveDay(day)}
              style={{
                padding: '6px 14px', borderRadius: 20, fontSize: 12,
                fontWeight: active ? 600 : 400,
                background: active ? '#111' : '#fff',
                color: active ? '#fff' : '#374151',
                border: `1px solid ${active ? '#111' : hasConf ? '#fca5a5' : '#d1d5db'}`,
                cursor: 'pointer', transition: 'all .15s',
                boxShadow: hasConf && !active ? 'inset 0 0 0 2px rgba(239,68,68,.15)' : 'none',
              }}
            >
              {day.slice(0, 3)}
              <span style={{ fontSize: 10, opacity: active ? .8 : .5, marginLeft: 4 }}>({count})</span>
              {hasConf && !active && <span style={{ marginLeft: 3, fontSize: 9, color: '#ef4444' }}>⚠</span>}
            </button>
          )
        })}
        <span style={{ marginLeft: 8, fontSize: 12, color: '#888', alignSelf: 'center' }}>
          {displayedDayEvents.length} shown · {events.length} total
        </span>
        <span style={{ fontSize: 11, color: '#9ca3af', alignSelf: 'center', marginLeft: 4 }}>· Drag cards to reschedule</span>

        {/* ── Minimize toggle ── */}
        <button
          onClick={() => setCalendarMinimized(v => !v)}
          title={calendarMinimized ? 'Switch to full view' : 'Switch to compact view'}
          style={{
            marginLeft: 'auto', display: 'flex', alignItems: 'center', gap: 5,
            padding: '5px 12px', borderRadius: 20, fontSize: 11, fontWeight: 600,
            background: calendarMinimized ? '#f0fdf4' : '#f9fafb',
            color: calendarMinimized ? '#166534' : '#374151',
            border: `1px solid ${calendarMinimized ? '#86efac' : '#d1d5db'}`,
            cursor: 'pointer', transition: 'all .15s', whiteSpace: 'nowrap',
          }}
        >
          <span style={{ fontSize: 13, lineHeight: 1 }}>{calendarMinimized ? '⊞' : '⊟'}</span>
          {calendarMinimized ? 'Full View' : 'Compact View'}
        </button>
      </div>

      {/* ── Conflict Summary Bar ── */}
      <ConflictSummaryBar conflictMap={conflictMap} events={dayEvents} />

      {/* ── Empty State ── */}
      {displayedDayEvents.length === 0 && (
        <div style={{ color: '#888', fontSize: 13, padding: '24px 0', textAlign: 'center', border: '1px dashed #d1d5db', borderRadius: 8 }}>
          {filterConflicts ? 'No conflicts on this day.' : hasFilters ? 'No sessions match the current filters on this day.' : `No sessions on ${activeDay}.`}
        </div>
      )}

      {/* ── Time Grid ── */}
      {roomsToDisplay.length > 0 && (() => {
        const slotH   = calendarMinimized ? COMPACT_SLOT_H   : SLOT_HEIGHT
        const roomW   = calendarMinimized ? COMPACT_ROOM_W   : 200
        const timeW   = calendarMinimized ? COMPACT_TIME_W   : 56
        const headerH = calendarMinimized ? COMPACT_HEADER_H : NORMAL_HEADER_H
        const cssVars = {
          '--sv-slot-h':   `${slotH}px`,
          '--sv-room-w':   `${roomW}px`,
          '--sv-time-w':   `${timeW}px`,
          '--sv-header-h': `${headerH}px`,
        }
        return (
        <div
          className={calendarMinimized ? 'sv-compact' : ''}
          style={{
            ...cssVars,
            overflowX: calendarMinimized ? 'auto' : 'auto',
            overflowY: calendarMinimized ? 'visible' : 'auto',
            paddingBottom: 8,
            maxHeight: calendarMinimized ? 'none' : 'calc(100vh - 300px)',
            border: '1px solid #e5e7eb', borderRadius: 8,
          }}
        >
          <div style={{ display: 'flex', minWidth: roomsToDisplay.length * (roomW + 2) + timeW }}>

            {/* Time Column */}
            <div className="sv-time-col" style={{ flexShrink: 0 }}>
              <div className="sv-time-header">Time</div>
              {TIME_SLOTS.map((slot, idx) => {
                const isHour = slot.startMinutes % 60 === 0
                return (
                  <div
                    key={idx}
                    className={`sv-time-label${isHour ? ' hour' : ' half-hour-tick'}`}
                  >
                    {slot.label}
                  </div>
                )
              })}
            </div>

            {/* Room Columns */}
            {roomsToDisplay.map(room => {
              const roomEvents      = displayedDayEvents.filter(e => e.room === room)
              const roomHasConflict = roomEvents.some(e => conflictMap.has(getEventId(e)))

              return (
                <div key={room} className="sv-room-col" style={{ borderLeft: '1px solid #e5e7eb', borderRight: roomHasConflict ? '2px solid #fca5a5' : undefined }}>
                  <div className="sv-room-header" style={{ background: roomHasConflict ? '#7f1d1d' : '#1f2937' }}>
                    {room}
                    <span style={{ marginLeft: 4, opacity: .6, fontSize: calendarMinimized ? 8 : 10 }}>({roomEvents.length})</span>
                    {roomHasConflict && <span style={{ marginLeft: 3, fontSize: 9 }}>⚠</span>}
                  </div>

                  {TIME_SLOTS.map((slot, idx) => {
                    const cellKey      = `${room}|${slot.startMinutes}`
                    const isHover      = hoveredCell === cellKey
                    const conflictInfo = isHover ? getDropConflict(room, slot) : null
                    const hasConflict  = !!conflictInfo
                    const isValid      = isHover && !hasConflict && !!draggedEvent
                    const classes      = [
                      'sv-slot-cell',
                      slot.startMinutes % 60 !== 0 && 'half-hour',
                      isHover && 'drop-hover',
                      hasConflict && 'drop-conflict',
                      isValid && 'drop-valid',
                    ].filter(Boolean).join(' ')

                    return (
                      <div
                        key={idx}
                        className={classes}
                        onDragOver={e => handleDragOver(e, room, slot)}
                        onDragLeave={handleDragLeave}
                        onDrop={e => handleDrop(e, room, slot)}
                      >
                        {isHover && draggedEvent && (
                          <div
                            className="sv-drop-hint"
                            style={{ color: hasConflict ? '#ef4444' : '#16a34a' }}
                          >
                            {hasConflict ? `⚠ ${conflictInfo.label}` : '✓ Drop here'}
                          </div>
                        )}
                      </div>
                    )
                  })}

                  <div className="sv-events-layer">
                    {roomEvents.map((ev, i) => {
                      const evId       = getEventId(ev)
                      const ci         = conflictMap.get(evId) ?? null
                      const isDrag     = draggedEvent && getEventId(draggedEvent) === evId
                      return (
                        <SessionCard
                          key={evId || i}
                          event={ev}
                          onClick={setSelected}
                          conflictInfo={ci}
                          isDragging={isDrag}
                          isDimmed={!!draggedEvent && !isDrag}
                          onDragStart={e => handleDragStart(e, ev)}
                          onDragEnd={handleDragEnd}
                          compact={calendarMinimized}
                          slotH={slotH}
                        />
                      )
                    })}
                  </div>
                </div>
              )
            })}
          </div>
        </div>
        )
      })()}

      {/* ── Modals ── */}
      {selected && (
        <SessionModal
          event={selected}
          allEvents={events}
          onClose={() => setSelected(null)}
          onSaved={handleSaved}
          masterRooms={masterRooms}
          masterFacultyList={masterFacultyList}
        />
      )}
      {isFacModalOpen  && <FilterModal title="Filter Faculty" options={allFaculty} selectedSet={filterFac} onToggle={toggles.faculty} onClose={() => setIsFacModalOpen(false)} />}
      {isRoomModalOpen && <RoomFilterModal title="Filter Rooms" options={allRooms} selectedSet={filterRooms} onToggle={toggles.room} onClose={() => setIsRoomModalOpen(false)} masterRooms={masterRooms} />}

      {/* ── Toast ── */}
      {toast && <Toast message={toast.message} type={toast.type} onDismiss={() => setToast(null)} />}
    </div>
  )
}