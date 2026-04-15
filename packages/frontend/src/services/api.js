import axios from 'axios'
import { auth } from './firebase'

const BASE = import.meta.env.VITE_API_URL || 'http://localhost:8000'

async function getToken() {
  const user = auth.currentUser
  if (!user) throw new Error('Not authenticated')
  return user.getIdToken()
}

async function authHeaders() {
  const token = await getToken()
  return { Authorization: `Bearer ${token}` }
}

// ── Health ────────────────────────────────────────────────────────────────────
export const checkHealth = () =>
  axios.get(`${BASE}/health`).then(r => r.data)

// ── Faculty ───────────────────────────────────────────────────────────────────
export const getFaculty       = async () => axios.get(`${BASE}/faculty/`,             { headers: await authHeaders() }).then(r => r.data)
export const addFaculty       = async (d) => axios.post(`${BASE}/faculty/add`, d,     { headers: await authHeaders() }).then(r => r.data)
export const updateFaculty    = async (id, d) => axios.put(`${BASE}/faculty/update/${id}`, d, { headers: await authHeaders() }).then(r => r.data)
export const deleteFaculty    = async (id) => axios.delete(`${BASE}/faculty/delete/${id}`,   { headers: await authHeaders() }).then(r => r.data)
export const updatePreferences= async (id, d) => axios.put(`${BASE}/faculty/preferences/${id}`, d, { headers: await authHeaders() }).then(r => r.data)

// ── Courses ───────────────────────────────────────────────────────────────────
export const getCourses     = async () => axios.get(`${BASE}/courses/`,             { headers: await authHeaders() }).then(r => r.data)
export const addCourse      = async (d) => axios.post(`${BASE}/courses/add`, d,     { headers: await authHeaders() }).then(r => r.data)
export const updateCourse   = async (code, prog, d) => axios.put(`${BASE}/courses/update/${code}/${prog}`, d, { headers: await authHeaders() }).then(r => r.data)
export const deleteCourse   = async (code, prog) => axios.delete(`${BASE}/courses/delete/${code}/${prog}`,  { headers: await authHeaders() }).then(r => r.data)

export const uploadCourses  = async (file) => {
  const form = new FormData()
  form.append('file', file)
  return axios.post(`${BASE}/courses/upload`, form, { headers: await authHeaders() }).then(r => r.data)
}

// NEW: Extract a specific sheet based on the user's selection
export const extractSheet   = async (data) => 
  axios.post(`${BASE}/courses/upload/extract`, data, { headers: await authHeaders() }).then(r => r.data)

export const commitCourses  = async (courses) =>
  axios.post(`${BASE}/courses/upload/commit`, { courses }, { headers: await authHeaders() }).then(r => r.data)

// ── Settings ──────────────────────────────────────────────────────────────────
export const getRooms    = async () => axios.get(`${BASE}/settings/rooms`, { headers: await authHeaders() }).then(r => r.data)
export const saveRooms   = async (d) => axios.post(`${BASE}/settings/rooms`, d, { headers: await authHeaders() }).then(r => r.data)
export const getDays     = async () => axios.get(`${BASE}/settings/days`,  { headers: await authHeaders() }).then(r => r.data)
export const saveDays    = async (d) => axios.post(`${BASE}/settings/days`,  d, { headers: await authHeaders() }).then(r => r.data)
export const getTime     = async () => axios.get(`${BASE}/settings/time`,  { headers: await authHeaders() }).then(r => r.data)
export const saveTime    = async (d) => axios.post(`${BASE}/settings/time`,  d, { headers: await authHeaders() }).then(r => r.data)

// ── Schedule ──────────────────────────────────────────────────────────────────
export const triggerSolve   = async () => axios.get(`${BASE}/schedule/generate`,           { headers: await authHeaders() }).then(r => r.data)
export const getSolveStatus = async (pid) => axios.get(`${BASE}/schedule/status/${pid}`,   { headers: await authHeaders() }).then(r => r.data)
export const getResult      = async () => axios.get(`${BASE}/schedule/result`,             { headers: await authHeaders() }).then(r => r.data)
export const saveSchedule   = async (name) => axios.post(`${BASE}/schedule/save`, { schedule_name: name }, { headers: await authHeaders() }).then(r => r.data)
export const listSaved      = async () => axios.get(`${BASE}/schedule/final`,              { headers: await authHeaders() }).then(r => r.data)
export const loadSaved      = async (name) => axios.get(`${BASE}/schedule/final/${name}`,  { headers: await authHeaders() }).then(r => r.data)
export const deleteSaved    = async (name) => axios.delete(`${BASE}/schedule/final/${name}`, { headers: await authHeaders() }).then(r => r.data)

// ── Overrides ─────────────────────────────────────────────────────────────────
export const overrideSession = async (d) =>
  axios.post(`${BASE}/overrides/session`, d, { headers: await authHeaders() }).then(r => r.data)

// ── Analytics ─────────────────────────────────────────────────────────────────
export const getAssignmentQuality = async () => axios.get(`${BASE}/analytics/assignment-quality`, { headers: await authHeaders() }).then(r => r.data)
export const getFacultyPreview    = async () => axios.get(`${BASE}/analytics/faculty-preview`,    { headers: await authHeaders() }).then(r => r.data)
export const getWorkload          = async () => axios.get(`${BASE}/analytics/workload`,           { headers: await authHeaders() }).then(r => r.data)