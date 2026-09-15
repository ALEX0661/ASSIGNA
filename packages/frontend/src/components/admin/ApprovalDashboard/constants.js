import G from './tokens'

const DEFAULT_PROGRAMS = ['BSIT', 'BSCS', 'BSEMC-GD', 'BSEMC-DAT']
const SEMESTERS = ['1st Semester', '2nd Semester', 'Midyear']
// The submitted-schedules list is now scoped server-side to the active
// term (see approval.py), so it no longer grows with every semester that's
// ever been approved — but it's still worth polling less aggressively than
// every 20s, and not at all while the tab is hidden.
const POLL_MS = 45000

// PH school years run roughly June–May, so anything from June onward
// counts as the start of that calendar year's AY. Centers the dropdown
// on "today's" AY with a couple years of slack either side, so admins
// can still set up a queue for a term that hasn't started yet.
function currentAcademicYearStart(d = new Date()) {
  return d.getMonth() >= 5 ? d.getFullYear() : d.getFullYear() - 1
}
function academicYearOptions() {
  const start = currentAcademicYearStart()
  const years = []
  for (let y = start - 1; y <= start + 3; y++) years.push(`${y}-${y + 1}`)
  return years
}

const STATUS = {
  waiting:    { bg: '#F1F5F9', color: 'var(--muted2)', dot: '#94A3B8', label: 'Waiting'    },
  active:     { bg: G.meadowSoft, color: 'var(--meadow-text)', dot: G.meadow, label: 'Their turn' },
  generating: { bg: G.blueSoft, color: G.blue, dot: '#3B82F6', label: 'Generating' },
  submitted:  { bg: G.amberSoft, color: '#92400E', dot: G.amber, label: 'Submitted'  },
  approved:   { bg: G.meadowSoft, color: 'var(--meadow-text-hover)', dot: G.meadow, label: 'Approved'   },
  skipped:    { bg: 'rgba(217, 119, 6, 0.05)', color: '#9A3412', dot: '#FB923C', label: 'Skipped'    },
}
const SCHED_STATUS = {
  draft:     { bg: G.hover, color: G.muted, border: G.border, label: 'Draft'     },
  submitted: { bg: G.amberSoft, color: '#92400E', border: G.amberBorder, label: 'Submitted' },
  approved:  { bg: G.meadowSoft, color: 'var(--meadow-text-hover)', border: G.meadowBorder, label: 'Approved'  },
}

const PROG_COLORS = { 'BSIT': G.meadow, 'BSCS': '#60A5FA', 'BSEMC-GD': '#7C3AED', 'BSEMC-DAT': '#F59E0B' }
const PROG_COLOR_PALETTE = [G.meadow, '#60A5FA', '#7C3AED', '#F59E0B', '#DB2777', '#0EA5E9', '#CA8A04', 'var(--meadow)']

export { DEFAULT_PROGRAMS, SEMESTERS, POLL_MS, currentAcademicYearStart, academicYearOptions, STATUS, SCHED_STATUS, PROG_COLORS, PROG_COLOR_PALETTE }
