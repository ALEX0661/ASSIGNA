import axios from 'axios'
import { auth } from './firebase'
import { onAuthStateChanged } from 'firebase/auth'

const BASE = 'http://localhost:8000'

async function getToken() {
  if (auth.currentUser) {
    return auth.currentUser.getIdToken()
  }

  return new Promise((resolve, reject) => {
    const unsubscribe = onAuthStateChanged(auth, async (user) => {
      unsubscribe()
      if (user) {
        resolve(await user.getIdToken())
      } else {
        reject(new Error('Not authenticated'))
      }
    })
  })
}

async function authHeaders() {
  const token = await getToken()
  return { Authorization: `Bearer ${token}` }
}

export const checkHealth = () =>
  axios.get(`${BASE}/health`).then(r => r.data)

// ── Faculty ───────────────────────────────────────────────────────────────────
export const getFaculty         = async ()        => axios.get(`${BASE}/faculty/`,                  { headers: await authHeaders(), params: { include_archived: false } }).then(r => r.data)
export const getArchivedFaculty = async ()        => axios.get(`${BASE}/faculty/`,                  { headers: await authHeaders(), params: { include_archived: true  } }).then(r => r.data)
export const addFaculty         = async (d)       => axios.post(`${BASE}/faculty/add`, d,           { headers: await authHeaders() }).then(r => r.data)
export const updateFaculty      = async (id, d)   => axios.put(`${BASE}/faculty/update/${id}`, d,   { headers: await authHeaders() }).then(r => r.data)
export const deleteFaculty      = async (id)      => axios.delete(`${BASE}/faculty/delete/${id}`,   { headers: await authHeaders() }).then(r => r.data)
export const updatePreferences  = async (id, d)   => axios.put(`${BASE}/faculty/preferences/${id}`, d, { headers: await authHeaders() }).then(r => r.data)

// ── Archive / soft-delete ─────────────────────────────────────────────────────
export const archiveFaculty   = async (id) => updateFaculty(id, { archived: true  })
export const unarchiveFaculty = async (id) => updateFaculty(id, { archived: false })

// ── File Uploads ──────────────────────────────────────────────────────────────
export const uploadFaculty = async (file) => {
  const form = new FormData()
  form.append('file', file)
  // Axios handles the multipart boundary automatically when passing FormData
  const res = await axios.post(`${BASE}/faculty/upload`, form, {
    headers: await authHeaders()
  })
  return res.data
}

export const extractFacultySheets = async ({ fileData, sheetNames }) =>
  axios.post(
    `${BASE}/faculty/upload/extract`,
    { fileData, sheetNames },
    { headers: await authHeaders() }
  ).then(r => r.data)

export const commitFaculty = async (faculty) =>
  axios.post(`${BASE}/faculty/upload/commit`, { faculty }, { headers: await authHeaders() }).then(r => r.data)

// ── Courses ───────────────────────────────────────────────────────────────────
export const getCourses    = async (semester)       => axios.get(`${BASE}/courses/`,                         { headers: await authHeaders(), params: semester ? { semester } : {} }).then(r => r.data)
export const addCourse     = async (d)             => axios.post(`${BASE}/courses/add`, d,                  { headers: await authHeaders() }).then(r => r.data)
export const updateCourse  = async (code, prog, d) => axios.put(`${BASE}/courses/update/${code}/${prog}`, d, { headers: await authHeaders() }).then(r => r.data)
export const deleteCourse  = async (code, prog)    => axios.delete(`${BASE}/courses/delete/${code}/${prog}`, { headers: await authHeaders() }).then(r => r.data)

export const uploadCourses = async (file) => {
  const form = new FormData()
  form.append('file', file)
  const res = await axios.post(`${BASE}/courses/upload`, form, {
    headers: await authHeaders()
  })
  return res.data
}

export const extractSheet  = async (data) =>
  axios.post(`${BASE}/courses/upload/extract`, data, { headers: await authHeaders() }).then(r => r.data)

export const commitCourses = async (courses) =>
  axios.post(`${BASE}/courses/upload/commit`, { courses }, { headers: await authHeaders() }).then(r => r.data)

// ── Course Room Assignment ────────────────────────────────────────────────────
export const setCoursePreferredRoom = async (courseCode, program, roomName) =>
  updateCourse(courseCode, program, { preferredRoom: roomName || null })

export const bulkSetPreferredRooms = async (assignmentMap) => {
  const entries = Object.entries(assignmentMap)
  const results = await Promise.allSettled(
    entries.map(([key, roomName]) => {
      const [code, ...progParts] = key.split('_')
      const prog = progParts.join('_')
      return setCoursePreferredRoom(code, prog, roomName)
    })
  )
  const committed = results.filter(r => r.status === 'fulfilled').length
  const failed    = results
    .map((r, i) => r.status === 'rejected' ? { key: entries[i][0], reason: r.reason?.message } : null)
    .filter(Boolean)
  return { committed, failed }
}

// ── Settings ──────────────────────────────────────────────────────────────────
export const getRooms  = async ()  => axios.get(`${BASE}/settings/rooms`,  { headers: await authHeaders() }).then(r => r.data)
export const saveRooms = async (d) => axios.post(`${BASE}/settings/rooms`, d, { headers: await authHeaders() }).then(r => r.data)
export const getDays   = async ()  => axios.get(`${BASE}/settings/days`,   { headers: await authHeaders() }).then(r => r.data)
export const saveDays  = async (d) => axios.post(`${BASE}/settings/days`,  d, { headers: await authHeaders() }).then(r => r.data)
export const getTime   = async ()  => axios.get(`${BASE}/settings/time`,   { headers: await authHeaders() }).then(r => r.data)
export const saveTime  = async (d) => axios.post(`${BASE}/settings/time`,  d, { headers: await authHeaders() }).then(r => r.data)

// ── Schedule ──────────────────────────────────────────────────────────────────
export const triggerSolve   = async (semester) => axios.get(`${BASE}/schedule/generate`,                    { headers: await authHeaders(), params: semester ? { semester } : {} }).then(r => r.data)
export const getSolveStatus = async (pid)  => axios.get(`${BASE}/schedule/status/${pid}`,               { headers: await authHeaders() }).then(r => r.data)
export const cancelSolve    = async (pid)  => axios.delete(`${BASE}/schedule/cancel/${pid}`,             { headers: await authHeaders() }).then(r => r.data)
export const getDiagnostic  = async (semester) => axios.get(`${BASE}/schedule/diagnostic`,               { headers: await authHeaders(), params: semester ? { semester } : {} }).then(r => r.data)
export const getResult      = async ()     => axios.get(`${BASE}/schedule/result`,                      { headers: await authHeaders() }).then(r => r.data)
export const saveSchedule   = async (name, { academicYear, semester } = {}, events = null) => axios.post(`${BASE}/schedule/save`, { schedule_name: name, academic_year: academicYear || '', semester: semester || '', ...(events ? { events } : {}) }, { headers: await authHeaders() }).then(r => r.data)
export const restoreScheduleVersion = async (name, version) => axios.post(`${BASE}/schedule/final/${name}/restore/${version}`, {}, { headers: await authHeaders() }).then(r => r.data)
export const getScheduleVersionDiff = async (name, version) => axios.get(`${BASE}/schedule/final/${name}/diff/${version}`, { headers: await authHeaders() }).then(r => r.data)
export const listSaved      = async ()     => axios.get(`${BASE}/schedule/final`,                       { headers: await authHeaders() }).then(r => r.data)
export const loadSaved      = async (name) => axios.get(`${BASE}/schedule/final/${name}`,               { headers: await authHeaders() }).then(r => r.data)
export const deleteSaved    = async (name) => axios.delete(`${BASE}/schedule/final/${name}`,            { headers: await authHeaders() }).then(r => r.data)

// ── Schedule Finalization ─────────────────────────────────────────────────────
export const finalizeSchedule     = async (name) => axios.post(`${BASE}/schedule/final/${name}/finalize`, {}, { headers: await authHeaders() }).then(r => r.data)
export const unfinalizeSchedule   = async (name) => axios.post(`${BASE}/schedule/final/${name}/unfinalize`, {}, { headers: await authHeaders() }).then(r => r.data)
export const updateScheduleMeta   = async (name, d) => axios.put(`${BASE}/schedule/final/${name}/metadata`, d, { headers: await authHeaders() }).then(r => r.data)
export const getActiveSchedule    = async (academicYear, semester) => axios.get(`${BASE}/schedule/final/active`, { headers: await authHeaders(), params: { academic_year: academicYear, semester } }).then(r => r.data)

export const getSchedules = async (scheduleName = null) => {
  const headers = await authHeaders()
  if (!scheduleName) {
    const list = await axios.get(`${BASE}/schedule/final`, { headers }).then(r => r.data)
    // Backend now returns objects with metadata; extract names for backward compat
    const arr = Array.isArray(list) ? list : []
    const names = arr.map(s => typeof s === 'string' ? s : (s.id || s.name))
    return { names, schedules: arr }
  }
  const data = await axios.get(`${BASE}/schedule/final/${scheduleName}`, { headers }).then(r => r.data)
  return {
    name:   scheduleName,
    events: Array.isArray(data.schedule) ? data.schedule : [],
    academicYear: data.academicYear || '',
    semester: data.semester || '',
    finalized: data.finalized || false,
    version: data.version || 1,
    createdAt: data.createdAt,
    lastModified: data.lastModified,
    savedAt: data.savedAt,
    eventCount: data.eventCount || (Array.isArray(data.schedule) ? data.schedule.length : 0),
    versionHistory: data.versionHistory || [],
    // Present only while the live doc is a restored preview (see
    // POST /final/{name}/restore/{version} on the backend). Needed so the
    // UI can tell "actually saved as current" apart from "restored but
    // not yet saved" — without these, ScheduleViewPage has no way to know
    // a restore ever happened.
    restoredFromVersion: data.restoredFromVersion || null,
    restoredAt: data.restoredAt || null,
  }
}

// ── Overrides & Merges ────────────────────────────────────────────────────────
export const overrideSession = async (d) =>
  axios.post(`${BASE}/overrides/session`, d, { headers: await authHeaders() }).then(r => r.data)

export const mergeSession = async (idA, idB) =>
  axios.post(`${BASE}/merges/merge`, { id_a: idA, id_b: idB }, { headers: await authHeaders() }).then(r => r.data)

export const unmergeSession = async (scheduleId) =>
  axios.post(`${BASE}/merges/unmerge`, { schedule_id: scheduleId }, { headers: await authHeaders() }).then(r => r.data)

// ── Analytics ─────────────────────────────────────────────────────────────────
export const getAssignmentQuality    = async () => axios.get(`${BASE}/analytics/assignment-quality`,    { headers: await authHeaders() }).then(r => r.data)
export const getFacultyPreview       = async () => axios.get(`${BASE}/analytics/faculty-preview`,       { headers: await authHeaders() }).then(r => r.data)
export const getWorkload             = async () => axios.get(`${BASE}/analytics/workload`,              { headers: await authHeaders() }).then(r => r.data)
export const getScheduleDistribution = async () => axios.get(`${BASE}/analytics/schedule-distribution`, { headers: await authHeaders() }).then(r => r.data)
export const getDashboardStats       = async () => axios.get(`${BASE}/analytics/dashboard-stats`,       { headers: await authHeaders() }).then(r => r.data)
export const getPreDiagnostic        = async (semester) => axios.get(`${BASE}/analytics/pre-diagnostic`, { headers: await authHeaders(), params: semester ? { semester } : {} }).then(r => r.data)

export const updateCredentials = async (id, d) =>
  axios.put(`${BASE}/faculty/credentials/${id}`, d, { headers: await authHeaders() }).then(r => r.data)

// ── Role Management ───────────────────────────────────────────────────────────
// A faculty member can now hold multiple roles at once (e.g. Admin + Faculty).
// Valid combinations: Admin, Faculty, Admin+Faculty, Faculty+Coordinator.
// Invalid: Coordinator alone, Admin+Coordinator, Admin+Faculty+Coordinator.
// `role` is still sent (comma-joined) for any backend/legacy code that reads a single string field.
export const setFacultyRole = async (id, { isAdmin = false, isFaculty = false, isCoordinator = false, coordinatorProgram = null } = {}) => {
  const roles = [isAdmin && 'admin', isFaculty && 'faculty'].filter(Boolean)
  return axios.post(`${BASE}/faculty/role/${id}`, {
    isAdmin, isFaculty, isCoordinator, coordinatorProgram,
    role: roles.join(','), // legacy/back-compat field
  }, { headers: await authHeaders() }).then(r => r.data)
}

export const getFacultyRole = async (id) =>
  axios.get(`${BASE}/faculty/role/${id}`, { headers: await authHeaders() }).then(r => r.data)

// ── Block Config ──────────────────────────────────────────────────────────────
export const getBlockConfigs   = async (semester) => axios.get(`${BASE}/block-config/`,    { headers: await authHeaders(), params: semester ? { semester } : {} }).then(r => r.data)
export const saveBlockConfigs  = async (configs)  => axios.post(`${BASE}/block-config/`,   { configs }, { headers: await authHeaders() }).then(r => r.data)
export const applyBlockConfigs = async (semester) => axios.post(`${BASE}/block-config/apply`, { semester }, { headers: await authHeaders() }).then(r => r.data)

// ── Coordinator ───────────────────────────────────────────────────────────────
export const coordListSchedules   = async ()     => axios.get(`${BASE}/coordinator/schedule/list`,        { headers: await authHeaders() }).then(r => r.data)
export const coordGenerate        = async (sem)  => axios.post(`${BASE}/coordinator/schedule/generate`,   { semester: sem }, { headers: await authHeaders() }).then(r => r.data)
export const coordSolveStatus     = async (pid)  => axios.get(`${BASE}/coordinator/schedule/status/${pid}`, { headers: await authHeaders() }).then(r => r.data)
export const coordGetResult       = async ()     => axios.get(`${BASE}/coordinator/schedule/result`,      { headers: await authHeaders() }).then(r => r.data)
export const coordCancelSolve     = async (pid)  => axios.delete(`${BASE}/coordinator/schedule/cancel/${pid}`, { headers: await authHeaders() }).then(r => r.data)
export const coordSaveSchedule    = async (d)    => axios.post(`${BASE}/coordinator/schedule/save`, d,    { headers: await authHeaders() }).then(r => r.data)
export const coordLoadSchedule    = async (id)   => axios.get(`${BASE}/coordinator/schedule/${id}`,       { headers: await authHeaders() }).then(r => r.data)
export const coordDeleteSchedule  = async (id)   => axios.delete(`${BASE}/coordinator/schedule/${id}`,    { headers: await authHeaders() }).then(r => r.data)
export const coordRenameSchedule  = async (id,d) => axios.patch(`${BASE}/coordinator/schedule/${id}/rename`, d, { headers: await authHeaders() }).then(r => r.data)
export const coordDuplicateSchedule = async (id,d) => axios.post(`${BASE}/coordinator/schedule/${id}/duplicate`, d, { headers: await authHeaders() }).then(r => r.data)
export const coordSubmitSchedule  = async (id)   => axios.post(`${BASE}/coordinator/schedule/${id}/submit`, {}, { headers: await authHeaders() }).then(r => r.data)
export const coordUnsubmitSchedule = async (id)  => axios.post(`${BASE}/coordinator/schedule/${id}/unsubmit`, {}, { headers: await authHeaders() }).then(r => r.data)
// Save-in-place (editor) — unlike coordSaveSchedule above (which always mints a new draft),
// this persists edits back onto the SAME schedule doc and archives a version when content changed.
export const coordSaveScheduleInPlace = async (id) => axios.put(`${BASE}/coordinator/schedule/${id}`, {}, { headers: await authHeaders() }).then(r => r.data)
export const coordOverrideSession = async (scheduleId, d) =>
  axios.post(`${BASE}/coordinator/schedule/${scheduleId}/override`, d, { headers: await authHeaders() }).then(r => r.data)
export const coordRestoreScheduleVersion = async (scheduleId, version) =>
  axios.post(`${BASE}/coordinator/schedule/${scheduleId}/restore/${version}`, {}, { headers: await authHeaders() }).then(r => r.data)
export const coordGetScheduleVersionDiff = async (scheduleId, version) =>
  axios.get(`${BASE}/coordinator/schedule/${scheduleId}/diff/${version}`, { headers: await authHeaders() }).then(r => r.data)
export const coordGetRooms        = async ()     => axios.get(`${BASE}/coordinator/rooms`,                { headers: await authHeaders() }).then(r => r.data)
export const coordSelectRooms     = async (d)    => axios.post(`${BASE}/coordinator/rooms/select`, d,     { headers: await authHeaders() }).then(r => r.data)
export const coordGetSelectedRooms = async ()    => axios.get(`${BASE}/coordinator/rooms/selected`,       { headers: await authHeaders() }).then(r => r.data)
export const coordGetCourses      = async ()     => axios.get(`${BASE}/coordinator/courses`,              { headers: await authHeaders() }).then(r => r.data)
export const coordCheckTurn       = async ()     => axios.get(`${BASE}/coordinator/queue/my-turn`,        { headers: await authHeaders() }).then(r => r.data)
export const coordGetSettings     = async ()     => axios.get(`${BASE}/coordinator/settings`,             { headers: await authHeaders() }).then(r => r.data)
export const coordGetSubmittedSchedule = async () => axios.get(`${BASE}/coordinator/queue/submitted-schedule`, { headers: await authHeaders() }).then(r => r.data)

// ── Queue Management (Admin) ──────────────────────────────────────────────────
export const createQueue     = async (d)       => axios.post(`${BASE}/queue/create`, d,           { headers: await authHeaders() }).then(r => r.data)
export const listQueues      = async ()        => axios.get(`${BASE}/queue/list`,                 { headers: await authHeaders() }).then(r => r.data)
export const getQueue        = async (id)      => axios.get(`${BASE}/queue/${id}`,                { headers: await authHeaders() }).then(r => r.data)
export const reorderQueue    = async (id, d)   => axios.patch(`${BASE}/queue/${id}/reorder`, d,   { headers: await authHeaders() }).then(r => r.data)
export const skipProgram     = async (id, prog)=> axios.post(`${BASE}/queue/${id}/skip/${prog}`,{},{ headers: await authHeaders() }).then(r => r.data)
export const advanceQueue    = async (id)      => axios.post(`${BASE}/queue/${id}/advance`, {},    { headers: await authHeaders() }).then(r => r.data)
export const deleteQueue     = async (id)      => axios.delete(`${BASE}/queue/${id}`,              { headers: await authHeaders() }).then(r => r.data)

// ── Approval (Admin) ─────────────────────────────────────────────────────────
export const getSubmittedSchedules  = async ()     => axios.get(`${BASE}/approval/submitted`,                   { headers: await authHeaders() }).then(r => r.data)
export const getSubmittedSchedule   = async (id)   => axios.get(`${BASE}/approval/schedule/${id}`,              { headers: await authHeaders() }).then(r => r.data)
export const approveSchedule        = async (id)   => axios.post(`${BASE}/approval/schedule/${id}/approve`, {}, { headers: await authHeaders() }).then(r => r.data)
export const rejectSchedule         = async (id,d) => axios.post(`${BASE}/approval/schedule/${id}/reject`, d,   { headers: await authHeaders() }).then(r => r.data)
export const getMasterSchedule      = async (qid)  => axios.get(`${BASE}/approval/master/${qid}`,               { headers: await authHeaders() }).then(r => r.data)
export const finalizeMasterSchedule = async (qid)  => axios.post(`${BASE}/approval/master/${qid}/finalize`, {}, { headers: await authHeaders() }).then(r => r.data)
export const adminEditSchedule      = async (id,d) => axios.put(`${BASE}/approval/schedule/${id}/edit`, d,      { headers: await authHeaders() }).then(r => r.data)