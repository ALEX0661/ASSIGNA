// Lets AdminLayout (specifically the logout button) know whether the
// currently mounted page has unsaved work, without prop-drilling page
// state up through the router. Any page using useUnsavedChangesGuard
// reports into this automatically.
let flag = false
let subject = null
const listeners = new Set()

export function setUnsavedFlag(value, subj = null) {
  flag = value
  subject = value ? subj : null
  listeners.forEach(fn => fn(flag, subject))
}

export function getUnsavedFlag() {
  return { flag, subject }
}

export function subscribeUnsaved(fn) {
  listeners.add(fn)
  return () => listeners.delete(fn)
}
