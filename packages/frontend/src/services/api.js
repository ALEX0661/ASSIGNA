import axios from 'axios'
import { auth } from './firebase'
import { onAuthStateChanged } from 'firebase/auth'

//const BASE = import.meta.env.VITE_API_URL || 'https://logos-backend.up.railway.app'//

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

export const uploadFaculty = async (file) => {
  const form = new FormData()
  form.append('file', file)
  return axios.post(`${BASE}/faculty/upload`, form, { headers: await authHeaders() }).then(r => r.data)
}

export const extractFacultySheets = async (data) =>
  axios.post(`${BASE}/faculty/upload/extract`, data, { headers: await authHeaders() }).then(r => r.data)

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
  return axios.post(`${BASE}/courses/upload`, form, { headers: await authHeaders() }).then(r => r.data)
}

export const extractSheet  = async (data) =>
  axios.post(`${BASE}/courses/upload/extract`, data, { headers: await authHeaders() }).then(r => r.data)

export const commitCourses = async (courses) =>
  axios.post(`${BASE}/courses/upload/commit`, { courses }, { headers: await authHeaders() }).then(r => r.data)

// ── Course Room Assignment ────────────────────────────────────────────────────
// Pins a course to a specific room by name (e.g. "Room 407").
// Pass null or "" to clear the assignment and let the scheduler decide.
export const setCoursePreferredRoom = async (courseCode, program, roomName) =>
  updateCourse(courseCode, program, { preferredRoom: roomName || null })

// Bulk-save a map of { "CODE_PROG": "Room 407" | "" | null } entries.
// Returns { committed, failed } so the caller can surface partial errors.
export const bulkSetPreferredRooms = async (assignmentMap) => {
  const entries = Object.entries(assignmentMap)
  const results = await Promise.allSettled(
    entries.map(([key, roomName]) => {
      const [code, ...progParts] = key.split('_')
      const prog = progParts.join('_')   // handles programs that contain underscores
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
export const getResult      = async ()     => axios.get(`${BASE}/schedule/result`,                      { headers: await authHeaders() }).then(r => r.data)
export const saveSchedule   = async (name) => axios.post(`${BASE}/schedule/save`, { schedule_name: name }, { headers: await authHeaders() }).then(r => r.data)
export const listSaved      = async ()     => axios.get(`${BASE}/schedule/final`,                       { headers: await authHeaders() }).then(r => r.data)
export const loadSaved      = async (name) => axios.get(`${BASE}/schedule/final/${name}`,               { headers: await authHeaders() }).then(r => r.data)
export const deleteSaved    = async (name) => axios.delete(`${BASE}/schedule/final/${name}`,            { headers: await authHeaders() }).then(r => r.data)

export const getSchedules = async (scheduleName = null) => {
  const headers = await authHeaders()
  if (!scheduleName) {
    const names = await axios.get(`${BASE}/schedule/final`, { headers }).then(r => r.data)
    return { names: Array.isArray(names) ? names : [] }
  }
  const data = await axios.get(`${BASE}/schedule/final/${scheduleName}`, { headers }).then(r => r.data)
  return {
    name:   scheduleName,
    events: Array.isArray(data.schedule) ? data.schedule : [],
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

export const updateCredentials = async (id, d) =>
  axios.put(`${BASE}/faculty/credentials/${id}`, d, { headers: await authHeaders() }).then(r => r.data)

// ── Block Config ──────────────────────────────────────────────────────────────
export const getBlockConfigs   = async (semester) => axios.get(`${BASE}/block-config/`,    { headers: await authHeaders(), params: semester ? { semester } : {} }).then(r => r.data)
export const saveBlockConfigs  = async (configs)  => axios.post(`${BASE}/block-config/`,   { configs }, { headers: await authHeaders() }).then(r => r.data)
export const applyBlockConfigs = async (semester) => axios.post(`${BASE}/block-config/apply`, { semester }, { headers: await authHeaders() }).then(r => r.data)