# ASSIGNA

Automated schedule builder for the College of Computer Studies. Takes your courses, faculty, and rooms and produces a conflict-free semestral timetable — with faculty already assigned.

Built because doing this manually every semester was taking weeks and still producing double-bookings.

---

## What it does

- Generates a full class schedule using a constraint solver (Google OR-Tools CP-SAT)
- Assigns faculty to each session based on their specialization rating, workload, and preferred schedule
- Detects and prevents room and faculty time conflicts
- Lets you manually override any session after generation
- Exports the final schedule to Excel

The solver runs in phases — NSTP first, then GEC/MAT, then majors by year level (4 down to 1), then PE last. Each phase locks in its slots before the next one starts, so nothing collides across course types.

---

## Stack

**Backend** — FastAPI + Python, running on Railway  
**Frontend** — React (Vite), hosted on Firebase Hosting  
**Solver** — OR-Tools CP-SAT  
**Database** — Firestore  
**Auth** — Firebase Authentication (custom role claims)

---

## Project structure

```
packages/
├── backend/
│   ├── app/
│   │   ├── core/
│   │   │   ├── scheduler.py        # CP-SAT scheduling engine
│   │   │   ├── faculty_assigner.py # greedy + backtracking faculty assignment
│   │   │   ├── unit_balancing.py   # unit cap tiers per employment status
│   │   │   ├── firebase.py         # Firestore client + cache layer
│   │   │   ├── auth.py             # JWT verification, role guards
│   │   │   └── globals.py          # in-process schedule_dict, progress_state
│   │   ├── routers/
│   │   │   ├── schedule.py
│   │   │   ├── faculty.py
│   │   │   ├── courses.py
│   │   │   ├── overrides.py
│   │   │   ├── analytics.py
│   │   │   ├── settings.py
│   │   │   └── block_config.py
│   │   └── main.py
│   ├── requirements.txt
│   └── Procfile
└── frontend/
    ├── src/
    │   ├── pages/
    │   │   ├── admin/              # Dashboard, Scheduler, Faculty, Courses, etc.
    │   │   └── faculty/            # Schedule view + profile for faculty users
    │   ├── services/
    │   │   ├── api.js              # All API calls (axios + Firebase token injection)
    │   │   └── firebase.js         # Firebase client init
    │   ├── store/
    │   │   └── scheduleStore.js    # Zustand stores
    │   └── utils/
    │       └── exportScheduleToExcel.js
    └── vite.config.js
```

---

## Running locally

### Backend

```bash
cd packages/backend
python -m venv venv && source venv/bin/activate
pip install -r requirements.txt
```

Create a `.env` file:

```
GOOGLE_APPLICATION_CREDENTIALS=path/to/serviceAccountKey.json
```

Then start the server:

```bash
uvicorn app.main:app --reload --workers 1 --port 8000
```

> The `--workers 1` flag is not optional. The schedule result and progress state live in-process memory (`globals.py`). Multiple workers = multiple separate processes = the frontend polls a different worker than the one that ran the solver and gets nothing back.

### Frontend

```bash
cd packages/frontend
pnpm install
```

Create a `.env` file:

```
VITE_API_URL=http://localhost:8000
VITE_FIREBASE_API_KEY=...
VITE_FIREBASE_AUTH_DOMAIN=...
VITE_FIREBASE_PROJECT_ID=...
```

```bash
pnpm dev
```

---

## How the scheduler works

Courses are sorted by a priority score (lab courses first, then by block count, then by unit load) and solved in seven phases. Within each phase, OR-Tools finds a feasible slot and room assignment for every session.

Constraints enforced by the solver:
- No two sessions in the same section overlap
- No two sessions in the same room overlap
- All sessions for a course-block use the same room
- Max 2 physical sessions per block per day
- GEC/MAT sessions must fall on MW or TTh at matching times
- NSTP is Friday/Saturday only
- Lunch (11:30–12:30) is avoided unless there's no other option

After the solver finishes, `FacultyAssigner` runs a greedy pass that groups sessions by section, scores every eligible faculty member, and picks the best fit. If a group ends up TBA because of conflicts, a backtracking pass tries swapping earlier assignments to free up a qualified faculty member.

Faculty are scored on: specialization rating (1–5, dominates), continuity bonus (already teaching same course), remaining unit headroom, employment status (full-time preferred), and preferred day/time match.

Unit caps:
| Status | Courses taught | Cap |
|---|---|---|
| Part-time | any | 15 units |
| Full-time | 1–2 | 24 units |
| Full-time | 3–4 | 21 units |
| Full-time | 5+ | 18 units |

---

## Faculty import

Faculty data is imported from the CCS Faculty Specialization Matrix Excel format — rows are course codes, columns are faculty names, cells are ratings (1–5). The parser handles two layout variants (with and without a separate last-name row) and skips placeholder cells automatically.

Upload flow: upload file → select sheets → extract preview → commit to Firestore.

Bulk-imported faculty don't have Firebase Auth accounts yet. Use the "Update Credentials" action to create a login for them, which migrates their Firestore document from a name-based key to a proper UID key.

---

## Deployment

**Backend (Railway)**

The `Procfile` handles startup:
```
web: uvicorn app.main:app --host 0.0.0.0 --port $PORT
```

Required environment variable: `GOOGLE_APPLICATION_CREDENTIALS` or the Firebase service account JSON inline.

**Frontend (Firebase Hosting)**

```bash
pnpm build
firebase deploy --only hosting
```

Set `VITE_API_URL` to the Railway backend URL before building.

---

## Known limitations

- The in-memory schedule is lost on backend restart. Save before restarting.
- The solver can return "impossible" if there aren't enough rooms or the time window is too tight. Expanding either usually fixes it.
- Generation time scales with course count — expect 2–10 minutes for a full semester.
- The analytics conflict counter flags raw overlaps; merged blocks (two sections in the same room intentionally) are detected and excluded from the count.

---

## Roles

Two roles, set as Firebase custom claims:

- `admin` — full access to everything
- `faculty` — can only view their own schedule and update their preferences

To set a role manually, use the script:

```bash
python scripts/set_role.py <uid> admin
```

---

## Environment variables summary

| Variable | Where | Purpose |
|---|---|---|
| `GOOGLE_APPLICATION_CREDENTIALS` | Backend | Firebase Admin SDK service account |
| `VITE_API_URL` | Frontend | Backend base URL |
| `VITE_FIREBASE_API_KEY` | Frontend | Firebase client config |
| `VITE_FIREBASE_AUTH_DOMAIN` | Frontend | Firebase client config |
| `VITE_FIREBASE_PROJECT_ID` | Frontend | Firebase client config |
