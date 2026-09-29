// src/utils/departments.js
// ─────────────────────────────────────────────────────────────────────────────
// Single source of truth (frontend) for department scoping.
//   • Auto-assign only ever uses HOME_DEPT faculty (enforced in the backend).
//   • Other-department faculty are manual-assign only.
//   • Blank / missing Department counts as the home department.
// Keep MINOR_PREFIXES in sync with app/core/departments.py.
// ─────────────────────────────────────────────────────────────────────────────

export const HOME_DEPT = 'CCS'   // later: derive from the logged-in user's department

// If the dean ever needs home-department instructors on minors in the session
// modal, flip this to true (everyone is then listed for minors).
export const MINOR_ALLOW_HOME = false

const MINOR_PREFIXES = ['GEC', 'MAT', 'PE', 'NSTP', 'GE']

const normDept = v => String(v || '').replace(/\s+/g, ' ').trim().toUpperCase()

export const isMinorCode = code =>
  MINOR_PREFIXES.some(p => String(code || '').toUpperCase().startsWith(p))

export const isHomeFaculty = (f, home = HOME_DEPT) => {
  const d = normDept(f?.Department)
  return !d || d === normDept(home)
}

export const isOtherDept = (f, home = HOME_DEPT) => !isHomeFaculty(f, home)

/**
 * Which faculty the session modal should offer for a course.
 *   minor course -> other-department faculty only
 *   major course -> home-department faculty only
 * Safety net: if a minor has NO other-department faculty yet, list everyone so
 * the dean is never left with an empty picker (scope === 'fallback').
 */
export function eligiblePoolInfo(facultyList, courseCode, home = HOME_DEPT) {
  const list = Array.isArray(facultyList) ? facultyList : []
  if (isMinorCode(courseCode)) {
    if (MINOR_ALLOW_HOME) return { pool: list, scope: 'all' }
    const other = list.filter(f => isOtherDept(f, home))
    return other.length
      ? { pool: other, scope: 'other-dept' }
      : { pool: list,  scope: 'fallback' }
  }
  return { pool: list.filter(f => isHomeFaculty(f, home)), scope: 'home' }
}

export const eligiblePool = (facultyList, courseCode, home = HOME_DEPT) =>
  eligiblePoolInfo(facultyList, courseCode, home).pool
