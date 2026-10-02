// Demo mode: swaps real faculty names and emails for fake ones, only on screen.
// Turn on:  open the app with ?demo=1   (it is remembered)
// Turn off: open the app with ?demo=0
// Nothing is saved to the database. Real data is untouched.
// It only works in dev (npm run dev). In a production build it is switched off.

const FLAG = 'assigna_demo'
const MAP_KEY = 'assigna_demo_alias_v1'

// Vite sets DEV to true only on the dev server. If you do not use Vite, change this to true while recording.
const DEV = (() => { try { return !!import.meta.env.DEV } catch { return false } })()

if (DEV && typeof window !== 'undefined') {
  try {
    const q = new URLSearchParams(window.location.search).get('demo')
    if (q === '1') localStorage.setItem(FLAG, '1')
    if (q === '0') localStorage.removeItem(FLAG)
    console.info('[ASSIGNA demo mode]', localStorage.getItem(FLAG) === '1' ? 'ON' : 'OFF')
  } catch {}
}

export function isDemo() {
  if (!DEV) return false
  try { return localStorage.getItem(FLAG) === '1' } catch { return false }
}

const LAST = [
  'ABELLANA','BALANAY','CABRALES','DALISAY','ESCOBIDO','FAJARDA','GALVEZ','HILARIO','ILAGAN','JAVIER',
  'KALAW','LAUREL','MANGUBAT','NAVARRETE','OBISPO','PALOMAR','QUIAMBAO','RAGUDO','SALVADOR','TABORA',
  'URBANO','VALERIO','YAPTINCHAY','ZAMORA','ALCANTARA','BUENAVENTURA','CASTILLEJOS','DIMAANO','ENRIQUEZ','FLORENDO',
  'GATCHALIAN','HERNANI','IBARRA','JIMENEZ','LACSON','MAGBANUA','NOLASCO','ORTEGA','PASCUAL','REYNOSO',
  'SANDOVAL','TRINIDAD','UMALI','VELASCO','WENCESLAO','AGUINALDO','BARRIENTOS','CORTEZANO','DELOSREYES','EUSEBIO',
  'FERRER','GUTIERREZ','HIPOLITO','INOCENCIO','JACINTO','LUMBAD','MALABANAN','NAPALA','OCAMPO','PANGAN',
]
const FIRST = [
  'ALDRIN','BEA','CARLO','DANICA','EMMANUEL','FRANCINE','GABRIEL','HANNAH','IVAN','JASMINE',
  'KEVIN','LORAINE','MARCO','NICOLE','OLIVER','PATRICIA','QUENTIN','RHEA','SEBASTIAN','TRISHA',
  'URIEL','VANESSA','WILFREDO','XAVIER','YVETTE','ZACHARY','ANGELO','BIANCA','CEDRIC','DIANNE',
  'ELIJAH','FAITH','GLENN','HEIDI','ISAAC','JOANNA','KENNETH','LEAH','MIGUEL','NORA',
  'OSCAR','PAULA','RAFAEL','SOPHIA','TRISTAN','VIOLETA','WARREN','YSABEL','ZENAIDA','ARNOLD',
  'BERNICE','CLARENCE','DELFIN','ESTELLE','FERDINAND','GRACE','HARVEY','IRENE','JOEL','KAREN',
]

let aliasMap = null
function loadMap() {
  if (aliasMap) return aliasMap
  try { aliasMap = JSON.parse(localStorage.getItem(MAP_KEY) || '{}') } catch { aliasMap = {} }
  return aliasMap
}
function norm(s) {
  const t = String(s || '').trim().replace(/\s+/g, ' ').toLowerCase()
  let h = 2166136261
  for (let i = 0; i < t.length; i++) { h ^= t.charCodeAt(i); h = Math.imul(h, 16777619) }
  return t ? (h >>> 0).toString(16) : ''
}

// Same real name always gives the same fake name, on every page and every reload.
export function fakeName(real) {
  const key = norm(real)
  if (!key) return real
  const map = loadMap()
  if (!map[key]) {
    const n = Object.keys(map).length
    map[key] = `${LAST[(n * 7) % LAST.length]}, ${FIRST[(n * 11 + 5) % FIRST.length]}`
    try { localStorage.setItem(MAP_KEY, JSON.stringify(map)) } catch {}
  }
  return map[key]
}

export function maskEmail(email) {
  if (!isDemo() || !email) return email
  return 'dean@school.edu'
}

const NAME_KEYS = ['name', 'faculty', 'facultyName', 'instructor', 'instructorName']

function maskRow(row) {
  if (!row || typeof row !== 'object') return row
  const out = { ...row }
  NAME_KEYS.forEach(k => { if (typeof out[k] === 'string' && out[k].trim()) out[k] = fakeName(out[k]) })
  if (typeof out.email === 'string') out.email = 'faculty@school.edu'
  return out
}

const cache = new WeakMap()
function maskList(list) {
  if (!isDemo() || !Array.isArray(list)) return list
  if (cache.has(list)) return cache.get(list)
  const out = list.map(maskRow)
  cache.set(list, out)
  return out
}

export const maskFacultyList = maskList
export const maskEvents = maskList