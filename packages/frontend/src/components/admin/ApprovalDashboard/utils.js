import G from './tokens'
import { PROG_COLORS, PROG_COLOR_PALETTE } from './constants'

function getProgColor(prog) {
  if (!prog) return G.meadow
  if (PROG_COLORS[prog]) return PROG_COLORS[prog]
  let hash = 0
  for (let i = 0; i < prog.length; i++) hash = prog.charCodeAt(i) + ((hash << 5) - hash)
  return PROG_COLOR_PALETTE[Math.abs(hash) % PROG_COLOR_PALETTE.length]
}
function progShort(prog = '') {
  const stripped = prog.replace(/^BS/, '')
  const parts = stripped.split('-')
  return parts.length > 1 ? parts[parts.length - 1] : stripped
}

function toSafeDate(dateLike) {
  if (!dateLike) return null
  let val = dateLike
  if (typeof val === 'string' && !/[zZ]|[+-]\d{2}:?\d{2}$/.test(val)) {
    val += 'Z'
  }
  const d = val instanceof Date ? val : new Date(val)
  return Number.isNaN(d.getTime()) ? null : d
}

function timeAgo(dateLike) {
  const d = toSafeDate(dateLike)
  if (!d) return ''
  const diff = Math.max(0, Date.now() - d.getTime())
  const min = Math.floor(diff / 60000)
  if (min < 1) return 'just now'
  if (min < 60) return `${min}m ago`
  const hr = Math.floor(min / 60)
  if (hr < 24) return `${hr}h ago`
  const day = Math.floor(hr / 24)
  if (day < 7) return `${day}d ago`
  return d.toLocaleDateString()
}

// Flags same-room/same-day/same-period collisions between a candidate
// schedule's events and events already merged into the master schedule
// (excluding the candidate's own program, in case it was previously
// approved and is being re-submitted). Pure client-side, no extra calls —
// the data is already on screen by the time a review is opened.
function computeConflicts(events = [], masterEvents = [], excludeProgram) {
  const key = e => `${e.day}__${e.period}__${e.room}`
  const masterByKey = new Map()
  for (const ev of masterEvents) {
    if (excludeProgram && ev.program === excludeProgram) continue
    const k = key(ev)
    if (!masterByKey.has(k)) masterByKey.set(k, [])
    masterByKey.get(k).push(ev)
  }
  const conflicts = []
  for (const ev of events) {
    if (!ev.room || !ev.day || !ev.period) continue
    const hits = masterByKey.get(key(ev))
    if (hits && hits.length) {
      conflicts.push({ event: ev, against: hits })
    }
  }
  return conflicts
}

export { getProgColor, progShort, toSafeDate, timeAgo, computeConflicts }
