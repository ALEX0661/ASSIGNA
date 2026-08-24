/**
 * AnalyticsPage.jsx
 *
 * Analytics dashboard — colour-matched to DashboardPage green system.
 * - CSS variables: --surface, --border, --ink, --muted, --muted2, --hover, --bg
 * - Distinct chart palettes for bar + pie so every segment is clearly separated
 * - Shimmer skeleton tinted to match dashboard green shimmer
 */

import { useState, useEffect, useCallback } from "react";
import {
  PieChart, Pie, Cell, Tooltip, ResponsiveContainer,
  BarChart, Bar, XAxis, YAxis, CartesianGrid, LabelList,
} from "recharts";

import {
  getScheduleDistribution,
  getAssignmentQuality,
  getWorkload,
  listSaved,
  loadSaved,
} from "../../services/api";
import { useScheduleStore } from "../../store/scheduleStore";

// ── Shared keyframes (mirrors DashboardPage DASH_STYLE) ───────────────────────
const ANALYTICS_STYLE = `
  @keyframes spin { to { transform: rotate(360deg) } }
  @keyframes barIn { from { width: 0 } }
  @keyframes fadeUp {
    from { opacity:0; transform:translateY(10px) }
    to   { opacity:1; transform:translateY(0) }
  }
  @keyframes shimmer {
    0%   { background-position: -600px 0 }
    100% { background-position:  600px 0 }
  }
  /* Green-tinted shimmer — matches DashboardPage .skel */
  .a-skel {
    background: linear-gradient(90deg,#EBF4EF 25%,#D8EEE3 50%,#EBF4EF 75%);
    background-size: 600px 100%;
    animation: shimmer 1.4s ease-in-out infinite;
    border-radius: 7px;
  }
  .a-card {
    background: var(--surface);
    border-radius: 16px;
    border: 1px solid var(--border);
    box-shadow: 0 2px 12px rgba(10,46,28,0.07);
    overflow: hidden;
    animation: fadeUp .35s ease both;
  }
  .a-stat-card {
    background: var(--surface);
    border-radius: 14px;
    border: 1px solid var(--border);
    box-shadow: 0 1px 6px rgba(10,46,28,0.06);
    padding: 16px 18px;
    display: flex;
    align-items: center;
    gap: 14px;
    transition: box-shadow .18s, transform .18s;
    animation: fadeUp .3s ease both;
    cursor: default;
  }
  .a-stat-card:hover {
    box-shadow: 0 6px 22px rgba(10,46,28,0.11);
    transform: translateY(-2px);
  }
`;

// ── Colour palette (matches Dashboard green system) ───────────────────────────
// These mirror the exact colours used in DashboardPage for consistency.
const C = {
  green:   "#15803D",   // primary accent — Dashboard's main colour
  blue:    "#2563EB",
  amber:   "#D97706",
  purple:  "#7C3AED",
  cyan:    "#0891B2",
  red:     "#C0392B",
  teal:    "#0D9488",
  rose:    "#E11D48",
};

// ── Distinct palette for pie / bar charts ─────────────────────────────────────
// 8 high-contrast colours so every segment is clearly distinguishable
const PALETTE = [
  C.green,   // #15803D  forest green
  C.blue,    // #2563EB  royal blue
  C.amber,   // #D97706  amber
  C.purple,  // #7C3AED  violet
  C.cyan,    // #0891B2  cyan
  C.rose,    // #E11D48  rose
  C.teal,    // #0D9488  teal
  "#6D28D9", //          indigo (fallback 8th)
];

// Daily session bar colours — one per weekday, all distinct
const DAY_COLORS = {
  Monday:    C.green,
  Tuesday:   C.blue,
  Wednesday: C.amber,
  Thursday:  C.purple,
  Friday:    C.cyan,
  Saturday:  C.rose,
  Sunday:    C.teal,
};

// Lecture vs Lab — clearly contrasting pair
const TYPE_COLORS = [C.green, C.blue];

// ── Helpers ───────────────────────────────────────────────────────────────────
const pct = (n, total) => total ? `${Math.round((n / total) * 100)}%` : "0%";

const loadColor = (row) => {
  if (row.overloaded)     return C.red;
  if (row.load_pct >= 85) return C.amber;
  if (row.load_pct <= 30) return "#86EFAC"; // light green — low load
  return C.green;
};

const formatName = (name) => {
  if (!name) return "";
  return name.length > 18 ? name.substring(0, 16) + "…" : name;
};

// ── Skeleton ──────────────────────────────────────────────────────────────────
function Skel({ w = "100%", h = 14, r = 7, style = {} }) {
  return (
    <div className="a-skel"
      style={{ width: w, height: h, borderRadius: r, flexShrink: 0, ...style }} />
  );
}

// ── Card ──────────────────────────────────────────────────────────────────────
function Card({ children, style = {} }) {
  return (
    <div className="a-card" style={style}>
      {children}
    </div>
  );
}

// ── Card header (mirrors DashboardPage SectionHeader) ─────────────────────────
function CardHeader({ title, subtitle, right }) {
  return (
    <div style={{
      padding: "12px 18px",
      borderBottom: "1px solid var(--border)",
      display: "flex", alignItems: "center", justifyContent: "space-between", gap: 8,
    }}>
      <div>
        <div style={{ fontSize: 13, fontWeight: 700, color: "var(--ink)" }}>{title}</div>
        {subtitle && <div style={{ fontSize: 11, color: "var(--muted2)", marginTop: 2 }}>{subtitle}</div>}
      </div>
      {right && <div style={{ flexShrink: 0 }}>{right}</div>}
    </div>
  );
}

// ── Insight callout ───────────────────────────────────────────────────────────
function InsightNote({ text, type = "info" }) {
  if (!text) return null;
  const isWarn = type === "warn" || type === "danger";
  const color  = isWarn ? C.red : C.green;
  const bg     = isWarn ? "#FFF5F5" : "#F0FDF4";
  const border = isWarn ? "#FECACA" : "#BBF7D0";
  return (
    <div style={{
      marginTop: 14, padding: "10px 14px", borderRadius: 8,
      background: bg, border: `1px solid ${border}`,
      fontSize: 12, color: "var(--muted)", lineHeight: 1.6,
    }}>
      <strong style={{ color, fontWeight: 700, marginRight: 6 }}>Insight:</strong>
      {text}
    </div>
  );
}

// ── Stat card (matches DashboardPage .stat-card) ──────────────────────────────
function StatCard({ label, value, sub, icon, color, bg, loading }) {
  return (
    <div className="a-stat-card">
      <div style={{
        width: 42, height: 42, borderRadius: 11, flexShrink: 0,
        background: loading ? "var(--hover)" : bg,
        display: "flex", alignItems: "center", justifyContent: "center",
      }}>
        {loading ? <Skel w={42} h={42} r={11} /> : <div style={{ color }}>{icon}</div>}
      </div>
      <div style={{ flex: 1 }}>
        {loading ? (
          <>
            <Skel w={48} h={26} r={6} style={{ marginBottom: 6 }} />
            <Skel w={80} h={11} r={5} />
          </>
        ) : (
          <>
            <div style={{ fontSize: 26, fontWeight: 800, color: "var(--ink)", lineHeight: 1, fontFamily: "'Sora',sans-serif" }}>
              {value}
            </div>
            <div style={{ fontSize: 11.5, color: "var(--muted2)", marginTop: 3, fontWeight: 500 }}>{label}</div>
            {sub && <div style={{ fontSize: 10.5, color: "var(--muted)", marginTop: 2 }}>{sub}</div>}
          </>
        )}
      </div>
    </div>
  );
}

// ── Optimization / Score card ─────────────────────────────────────────────────
function ScoreCard({ loading, autoAssignPct, pctInWindow }) {
  const hasData = autoAssignPct !== null && autoAssignPct !== undefined;
  const status = !hasData  ? null
    : autoAssignPct >= 90  ? { label: "Excellent", color: C.green,  bg: "#DCFCE7", bar: C.green  }
    : autoAssignPct >= 70  ? { label: "Good",      color: C.blue,   bg: "#DBEAFE", bar: C.blue   }
    : autoAssignPct >= 50  ? { label: "Fair",       color: C.amber,  bg: "#FEF3CD", bar: C.amber  }
    :                        { label: "Needs work", color: C.red,    bg: "#FFE8E8", bar: C.red    };

  return (
    <div className="a-stat-card">
      <div style={{
        width: 42, height: 42, borderRadius: 11, flexShrink: 0,
        background: loading ? "var(--hover)" : (status?.bg ?? "var(--hover)"),
        display: "flex", alignItems: "center", justifyContent: "center",
      }}>
        {loading ? <Skel w={42} h={42} r={11} /> : (
          <svg width="19" height="19" viewBox="0 0 24 24" fill="none"
            stroke={status?.color ?? "var(--muted)"} strokeWidth="2">
            <path d="M12 20V10"/><path d="M18 20V4"/><path d="M6 20v-4"/>
          </svg>
        )}
      </div>

      <div style={{ flex: 1, minWidth: 0 }}>
        {loading ? (
          <>
            <Skel w={52} h={26} r={6} style={{ marginBottom: 6 }} />
            <Skel w={90} h={10} r={5} style={{ marginBottom: 6 }} />
            <Skel w="100%" h={5} r={99} />
          </>
        ) : !hasData ? (
          <>
            <div style={{ fontSize: 18, fontWeight: 700, color: "var(--muted)", lineHeight: 1 }}>Not run yet</div>
            <div style={{ fontSize: 11, color: "var(--muted2)", marginTop: 5, lineHeight: 1.5 }}>
              Run the scheduler to see auto-fill rate.
            </div>
          </>
        ) : (
          <>
            <div style={{ display: "flex", alignItems: "center", gap: 7 }}>
              <span style={{ fontSize: 26, fontWeight: 800, color: "var(--ink)", lineHeight: 1, fontFamily: "'Sora',sans-serif" }}>
                {autoAssignPct}%
              </span>
              <span style={{
                fontSize: 10, fontWeight: 700, padding: "2px 7px", borderRadius: 99,
                background: status.bg, color: status.color,
              }}>
                {status.label}
              </span>
            </div>
            <div style={{ fontSize: 11.5, color: "var(--muted2)", marginTop: 3, fontWeight: 500 }}>
              Auto-filled by scheduler
            </div>
            <div style={{ marginTop: 7, height: 5, borderRadius: 99, background: "var(--hover)", overflow: "hidden" }}>
              <div style={{
                height: "100%", width: `${Math.min(autoAssignPct, 100)}%`,
                borderRadius: 99, background: status.bar, transition: "width 0.4s ease",
              }} />
            </div>
            {pctInWindow !== null && pctInWindow !== undefined && (
              <div style={{ fontSize: 10.5, color: "var(--muted2)", marginTop: 5 }}>
                <span style={{ fontWeight: 700, color: "var(--ink)" }}>{pctInWindow}%</span> were good faculty matches
              </div>
            )}
          </>
        )}
      </div>
    </div>
  );
}

// ── Pie chart legend ──────────────────────────────────────────────────────────
function PieLegend({ data, palette }) {
  if (!data?.length) return null;
  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 6, marginTop: 14 }}>
      {data.map((item, i) => (
        <div key={i} style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 8 }}>
          <div style={{ display: "flex", alignItems: "center", gap: 7, minWidth: 0 }}>
            <div style={{
              width: 9, height: 9, borderRadius: 2,
              background: palette[i % palette.length], flexShrink: 0,
            }} />
            <span style={{
              fontSize: 11.5, color: "var(--muted)", fontWeight: 600,
              overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap",
            }}>
              {item.name}
            </span>
          </div>
          <span style={{ fontSize: 11.5, fontWeight: 700, color: "var(--ink)", flexShrink: 0 }}>
            {item.value}{" "}
            <span style={{ fontWeight: 400, color: "var(--muted2)" }}>({pct(item.value, item.total)})</span>
          </span>
        </div>
      ))}
    </div>
  );
}

// ── Tooltips ──────────────────────────────────────────────────────────────────
const TooltipStyle = {
  background: "var(--surface)",
  border: "1px solid var(--border)",
  borderRadius: 8,
  boxShadow: "0 4px 12px rgba(10,46,28,0.10)",
  padding: "10px 14px",
  fontSize: 12,
  color: "var(--ink)",
};

const StandardTooltip = ({ active, payload }) => {
  if (!active || !payload?.length) return null;
  const d = payload[0];
  return (
    <div style={TooltipStyle}>
      <strong style={{ display: "block", marginBottom: 4, fontSize: 12.5 }}>
        {d.name || d.payload?.day || d.payload?.yearLevel || d.payload?.room}
      </strong>
      <span style={{ color: C.green, fontWeight: 700 }}>{d.value} sessions</span>
      {d.payload?.total && (
        <span style={{ color: "var(--muted2)", marginLeft: 4 }}>({pct(d.value, d.payload.total)})</span>
      )}
    </div>
  );
};

// ── Schedule selector pill (mirrors DashboardPage style) ──────────────────────
function SchedulePill({ savedList, scheduleSource, scheduleName, onChange, loading }) {
  return (
    <div style={{
      display: "flex", alignItems: "center", gap: 5,
      padding: "4px 10px", borderRadius: 99,
      background: "var(--surface)", border: "1px solid var(--border)",
    }}>
      <svg width="10" height="10" viewBox="0 0 24 24" fill="none"
        stroke="var(--muted)" strokeWidth="2.5" style={{ flexShrink: 0 }}>
        <rect x="3" y="4" width="18" height="18" rx="2"/>
        <line x1="16" y1="2" x2="16" y2="6"/>
        <line x1="8" y1="2" x2="8" y2="6"/>
        <line x1="3" y1="10" x2="21" y2="10"/>
      </svg>
      {loading ? (
        <Skel w={100} h={10} r={5} />
      ) : savedList.length > 0 ? (
        <select
          value={scheduleSource || "__current__"}
          onChange={e => onChange(e.target.value)}
          style={{
            background: "transparent", border: "none", outline: "none",
            fontSize: 10.5, fontWeight: 600, color: "var(--muted)", cursor: "pointer",
            maxWidth: 140, fontFamily: "inherit", padding: 0,
          }}
        >
          <option value="__current__">
            {scheduleName ? `Current (${scheduleName})` : "Current (in memory)"}
          </option>
          {savedList.map(name => (
            <option key={name} value={name}>{name}</option>
          ))}
        </select>
      ) : (
        <span style={{ fontSize: 10.5, fontWeight: 600, color: "var(--muted)" }}>
          No saved schedules
        </span>
      )}
    </div>
  );
}

// ── Section skeleton ──────────────────────────────────────────────────────────
function SectionSkel({ rows = 4 }) {
  return (
    <div style={{ padding: "18px", display: "flex", flexDirection: "column", gap: 10 }}>
      {Array.from({ length: rows }).map((_, i) => (
        <Skel key={i} w={`${85 - i * 8}%`} h={14} r={6} />
      ))}
    </div>
  );
}

// ── Main Page ─────────────────────────────────────────────────────────────────
export default function AnalyticsPage() {
  const { scheduleName, setName, clearSchedule } = useScheduleStore();

  const [dist,           setDist]           = useState(null);
  const [quality,        setQuality]        = useState(null);
  const [wl,             setWl]             = useState(null);
  const [loading,        setLoading]        = useState(true);
  const [savedList,      setSavedList]      = useState([]);
  const [scheduleSource, setScheduleSource] = useState(null);

  useEffect(() => {
    listSaved().then(res => {
      const list = Array.isArray(res) ? res : (res?.schedules ?? []);
      // listSaved() returns schedule objects, not plain name strings
      const names = list.map(item => (typeof item === "string" ? item : item?.name)).filter(Boolean);
      setSavedList(names);
    }).catch(() => {});
  }, []);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const [d, q, w] = await Promise.all([
        getScheduleDistribution(),
        getAssignmentQuality(),
        getWorkload(),
      ]);
      setDist(d);
      setQuality(q);
      setWl(w.workload ?? []);
    } catch (e) {
      console.error(e);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { load(); }, [load]);

  const handleScheduleChange = async (value) => {
    const isPinned = value !== "__current__";
    setScheduleSource(isPinned ? value : null);
    setLoading(true);
    try {
      if (isPinned) {
        await loadSaved(value);
        setName(value);
      } else {
        clearSchedule();
      }
      await load();
    } catch (e) {
      console.error(e);
      setLoading(false);
    }
  };

  // ── Derived data ──
  const total        = dist?.totalSessions ?? 1;
  const programData  = (dist?.byProgram ?? []).map(p => ({ ...p, name: p.program,  value: p.sessions, total }));
  const typeData     = (dist?.byType     ?? []).map(t => ({ ...t, name: t.type,    value: t.count,    total }));
  const dayData      = dist?.byDay ?? [];
  const roomData     = (dist?.roomUtilisation ?? []).slice(0, 8);
  const workloadData = (wl ?? [])
    .map(r => ({ ...r, fill: loadColor(r) }))
    .sort((a, b) => b.assigned - a.assigned)
    .slice(0, 15);

  // ── Interpretations ──
  const getCoverageInterpretation = () => {
    const cov = dist?.facultyCoverage?.pct ?? 0;
    if (cov >= 95) return `Excellent coverage — ${cov}% of sessions have designated instructors.`;
    if (cov < 80)  return `Critical: Faculty coverage is low at ${cov}%. Automated scheduling runs are required to fill TBA slots.`;
    return `Moderate coverage (${cov}%). Review unassigned sessions to ensure major courses are staffed.`;
  };

  const getProgramInterpretation = () => {
    if (!programData.length) return "No data available.";
    const top = [...programData].sort((a, b) => b.value - a.value)[0];
    return `The ${top.name} program accounts for ${pct(top.value, total)} of all sessions.`;
  };

  const getTemporalInterpretation = () => {
    if (!dayData.length) return "No data available.";
    const sorted = [...dayData].sort((a, b) => b.sessions - a.sessions);
    return `Schedule density peaks on ${sorted[0].day} with ${sorted[0].sessions} sessions. Consider migrating floating subjects to lighter days when spatial conflicts occur.`;
  };

  const getWorkloadInterpretation = () => {
    const over = workloadData.filter(w => w.overloaded);
    return over.length > 0
      ? `Attention: ${over.length} faculty member${over.length > 1 ? "s" : ""} exceed their maximum unit capacity.`
      : "Faculty workload is currently balanced across the department.";
  };

  // ── Render ────────────────────────────────────────────────────────────────
  return (
    <div style={{
      fontFamily: "'Poppins', sans-serif",
      background: "var(--bg, #F0F7F4)",
      minHeight: "100vh",
      padding: "20px 28px",
      color: "var(--ink)",
      display: "flex",
      flexDirection: "column",
      gap: 16,
    }}>
      <style>{ANALYTICS_STYLE}</style>

      {/* ── Top control bar ── */}
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 12 }}>
        <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
          {/* Session count badge */}
          <div style={{
            fontSize: 11.5, fontWeight: 600, color: "var(--muted)",
            padding: "4px 12px", borderRadius: 99,
            background: "var(--surface)", border: "1px solid var(--border)",
          }}>
            {loading
              ? <Skel w={80} h={10} r={5} style={{ display: "inline-block" }} />
              : <><span style={{ fontWeight: 700, color: C.green }}>{dist?.totalSessions ?? 0}</span> active sessions</>
            }
          </div>

          <SchedulePill
            savedList={savedList}
            scheduleSource={scheduleSource}
            scheduleName={scheduleName}
            onChange={handleScheduleChange}
            loading={loading}
          />
        </div>

        {/* Refresh button — matches DashboardPage pill style */}
        <button
          onClick={load}
          disabled={loading}
          style={{
            background: "var(--surface)",
            color: C.green,
            border: "1px solid var(--border)",
            borderRadius: 8,
            padding: "6px 14px",
            fontSize: 12,
            fontWeight: 600,
            cursor: loading ? "not-allowed" : "pointer",
            fontFamily: "inherit",
            display: "flex",
            alignItems: "center",
            gap: 6,
            opacity: loading ? 0.6 : 1,
            transition: "all 0.15s ease",
          }}
        >
          <svg width="11" height="11" viewBox="0 0 24 24" fill="none"
            stroke="currentColor" strokeWidth="2.5"
            style={{ animation: loading ? "spin 0.8s linear infinite" : "none" }}>
            <polyline points="23 4 23 10 17 10"/>
            <path d="M20.49 15a9 9 0 1 1-2.12-9.36L23 10"/>
          </svg>
          Refresh
        </button>
      </div>

      {/* ── SECTION 1: System Health stat cards ── */}
      <div style={{ display: "grid", gridTemplateColumns: "repeat(4, 1fr)", gap: 14 }}>

        {/* Assigned Sessions */}
        <StatCard
          label="Assigned Sessions" sub={`of ${dist?.totalSessions ?? 0} total`}
          value={loading ? null : (dist?.facultyCoverage?.covered ?? 0)}
          color={C.green} bg="#DCFCE7" loading={loading}
          icon={<svg width="19" height="19" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M22 11.08V12a10 10 0 1 1-5.93-9.14"/><polyline points="22 4 12 14.01 9 11.01"/></svg>}
        />

        {/* Faculty Coverage */}
        <StatCard
          label="Faculty Coverage" sub="Instructors assigned"
          value={loading ? null : `${dist?.facultyCoverage?.pct ?? 0}%`}
          color={C.blue} bg="#DBEAFE" loading={loading}
          icon={<svg width="19" height="19" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2"/><circle cx="9" cy="7" r="4"/><path d="M23 21v-2a4 4 0 0 0-3-3.87"/><path d="M16 3.13a4 4 0 0 1 0 7.75"/></svg>}
        />

        {/* TBA / Unassigned */}
        <StatCard
          label="TBA / Unassigned" sub="Sessions missing faculty"
          value={loading ? null : (quality?.tbaSessions ?? 0)}
          color={C.amber} bg="#FEF3CD" loading={loading}
          icon={<svg width="19" height="19" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><circle cx="12" cy="12" r="10"/><line x1="12" y1="8" x2="12" y2="12"/><line x1="12" y1="16" x2="12.01" y2="16"/></svg>}
        />

        {/* Hard Conflicts */}
        <StatCard
          label="Hard Conflicts" sub="Room / faculty time clashes"
          value={loading ? null : (quality?.totalConflicts ?? 0)}
          color={C.red} bg="#FFE8E8" loading={loading}
          icon={<svg width="19" height="19" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><polygon points="7.86 2 16.14 2 22 7.86 22 16.14 16.14 22 7.86 22 2 16.14 2 7.86 7.86 2"/><line x1="12" y1="8" x2="12" y2="12"/><line x1="12" y1="16" x2="12.01" y2="16"/></svg>}
        />
      </div>

      {/* ── Coverage insight + Optimization Score row ── */}
      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 14 }}>
        {/* Coverage insight card */}
        <div className="a-stat-card" style={{ alignItems: "flex-start", flexDirection: "column", gap: 6 }}>
          <div style={{ fontSize: 12, fontWeight: 700, color: "var(--ink)" }}>Coverage Summary</div>
          <div style={{ fontSize: 11.5, color: "var(--muted)", lineHeight: 1.6 }}>
            {loading ? <Skel w="90%" h={11} r={5} /> : getCoverageInterpretation()}
          </div>
          {!loading && (
            <div style={{ marginTop: 4, height: 6, borderRadius: 99, background: "var(--hover)", overflow: "hidden", width: "100%" }}>
              <div style={{
                height: "100%", borderRadius: 99,
                width: `${dist?.facultyCoverage?.pct ?? 0}%`,
                background: (dist?.facultyCoverage?.pct ?? 0) >= 95 ? C.green
                          : (dist?.facultyCoverage?.pct ?? 0) >= 80 ? C.amber
                          : C.red,
                transition: "width 0.6s ease",
              }} />
            </div>
          )}
        </div>

        {/* Optimization / Score card */}
        <ScoreCard
          loading={loading}
          autoAssignPct={quality?.autoAssignPct ?? null}
          pctInWindow={quality?.pctInWindow ?? null}
        />
      </div>

      {/* ── SECTION 2: Academic Composition ── */}
      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 16 }}>

        {/* Program Distribution — distinct PALETTE */}
        <Card>
          <CardHeader
            title="Distribution by Program"
            subtitle="Session count per academic program"
          />
          <div style={{ padding: "18px" }}>
            {loading ? (
              <SectionSkel rows={5} />
            ) : (
              <>
                <ResponsiveContainer width="100%" height={200}>
                  <PieChart>
                    <Pie
                      data={programData} cx="50%" cy="50%"
                      innerRadius={52} outerRadius={80}
                      dataKey="value" stroke="var(--surface)" strokeWidth={2}
                      paddingAngle={2}
                    >
                      {programData.map((_, i) => (
                        <Cell key={i} fill={PALETTE[i % PALETTE.length]} />
                      ))}
                    </Pie>
                    <Tooltip content={<StandardTooltip />} />
                  </PieChart>
                </ResponsiveContainer>
                <PieLegend data={programData} palette={PALETTE} />
                <InsightNote text={getProgramInterpretation()} />
              </>
            )}
          </div>
        </Card>

        {/* Lecture vs Lab — green/blue clearly contrasting */}
        <Card>
          <CardHeader
            title="Lecture vs. Laboratory"
            subtitle="Ratio of theoretical to practical sessions"
          />
          <div style={{ padding: "18px" }}>
            {loading ? (
              <SectionSkel rows={4} />
            ) : (
              <>
                <ResponsiveContainer width="100%" height={200}>
                  <PieChart>
                    <Pie
                      data={typeData} cx="50%" cy="50%"
                      outerRadius={80} dataKey="value"
                      stroke="var(--surface)" strokeWidth={2}
                      paddingAngle={3}
                    >
                      {typeData.map((_, i) => (
                        <Cell key={i} fill={TYPE_COLORS[i % TYPE_COLORS.length]} />
                      ))}
                    </Pie>
                    <Tooltip content={<StandardTooltip />} />
                  </PieChart>
                </ResponsiveContainer>
                <PieLegend data={typeData} palette={TYPE_COLORS} />
                <InsightNote text="Indicates balance between lecture-based and hands-on lab instruction." />
              </>
            )}
          </div>
        </Card>
      </div>

      {/* ── SECTION 3: Daily Session Volume (bar chart — distinct colour per day) ── */}
      <Card>
        <CardHeader
          title="Daily Session Volume"
          subtitle="Number of scheduled sessions per weekday"
        />
        <div style={{ padding: "18px" }}>
          {loading ? (
            <SectionSkel rows={5} />
          ) : (
            <>
              <ResponsiveContainer width="100%" height={240}>
                <BarChart data={dayData} margin={{ top: 14, right: 4, bottom: 0, left: -20 }}>
                  <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="var(--hover)" />
                  <XAxis
                    dataKey="day" axisLine={false} tickLine={false}
                    tick={{ fill: "var(--muted)", fontSize: 12, fontFamily: "Poppins", dy: 8 }}
                  />
                  <YAxis
                    axisLine={false} tickLine={false}
                    tick={{ fill: "var(--muted2)", fontSize: 11, fontFamily: "Poppins" }}
                  />
                  <Tooltip cursor={{ fill: "rgba(10,46,28,0.04)" }} content={<StandardTooltip />} />
                  <Bar dataKey="sessions" radius={[6, 6, 0, 0]} maxBarSize={52}>
                    {dayData.map((d, i) => (
                      <Cell key={i} fill={DAY_COLORS[d.day] ?? C.green} />
                    ))}
                    <LabelList
                      dataKey="sessions" position="top"
                      style={{ fill: "var(--ink)", fontSize: 11, fontWeight: 700, fontFamily: "Poppins" }}
                    />
                  </Bar>
                </BarChart>
              </ResponsiveContainer>

              {/* Day colour legend */}
              <div style={{ display: "flex", flexWrap: "wrap", gap: "6px 14px", marginTop: 12 }}>
                {dayData.map((d, i) => (
                  <div key={i} style={{ display: "flex", alignItems: "center", gap: 5 }}>
                    <div style={{ width: 8, height: 8, borderRadius: 2, background: DAY_COLORS[d.day] ?? C.green }} />
                    <span style={{ fontSize: 11, color: "var(--muted)", fontWeight: 600 }}>{d.day}</span>
                  </div>
                ))}
              </div>

              <InsightNote text={getTemporalInterpretation()} />
            </>
          )}
        </div>
      </Card>

      {/* ── SECTION 4: Resource Constraints ── */}
      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 16 }}>

        {/* Faculty Workload — load-based colour per bar */}
        <Card>
          <CardHeader
            title="Faculty Workload"
            subtitle="Assigned units vs. maximum capacity"
            right={
              workloadData.some(w => w.overloaded) && (
                <span style={{
                  background: "#FFE8E8", color: C.red,
                  fontSize: 10.5, fontWeight: 700, padding: "3px 9px", borderRadius: 99,
                }}>
                  {workloadData.filter(w => w.overloaded).length} over cap
                </span>
              )
            }
          />
          <div style={{ padding: "18px" }}>
            {loading ? (
              <SectionSkel rows={6} />
            ) : (
              <>
                <ResponsiveContainer width="100%" height={Math.max(220, workloadData.length * 34)}>
                  <BarChart data={workloadData} layout="vertical" margin={{ top: 0, right: 36, bottom: 0, left: 16 }}>
                    <CartesianGrid strokeDasharray="3 3" horizontal={false} stroke="var(--hover)" />
                    <XAxis type="number" axisLine={false} tickLine={false}
                      tick={{ fontSize: 11, fill: "var(--muted2)", fontFamily: "Poppins" }} />
                    <YAxis type="category" dataKey="name" axisLine={false} tickLine={false}
                      width={120} tick={{ fontSize: 11, fill: "var(--ink)", fontFamily: "Poppins" }}
                      tickFormatter={formatName} />
                    <Tooltip cursor={{ fill: "rgba(10,46,28,0.04)" }} contentStyle={TooltipStyle} />
                    {/* Capacity bar — subtle track */}
                    <Bar dataKey="effective_max" fill="#D1EAD9" radius={4} barSize={10} />
                    {/* Assigned bar — coloured by load status */}
                    <Bar dataKey="assigned" radius={4} barSize={10}>
                      {workloadData.map((r, i) => <Cell key={i} fill={loadColor(r)} />)}
                      <LabelList dataKey="assigned" position="right"
                        style={{ fontSize: 10, fontWeight: 600, fill: "var(--ink)", fontFamily: "Poppins" }}
                        formatter={(v) => `${v}u`} />
                    </Bar>
                  </BarChart>
                </ResponsiveContainer>

                {/* Workload legend */}
                <div style={{ display: "flex", gap: 14, marginTop: 10, flexWrap: "wrap" }}>
                  {[
                    { label: "Balanced",    color: C.green },
                    { label: "Near cap",    color: C.amber },
                    { label: "Overloaded",  color: C.red   },
                    { label: "Low load",    color: "#86EFAC" },
                  ].map(x => (
                    <div key={x.label} style={{ display: "flex", alignItems: "center", gap: 5 }}>
                      <div style={{ width: 8, height: 8, borderRadius: 2, background: x.color }} />
                      <span style={{ fontSize: 11, color: "var(--muted)", fontWeight: 600 }}>{x.label}</span>
                    </div>
                  ))}
                </div>

                <InsightNote
                  text={getWorkloadInterpretation()}
                  type={workloadData.some(w => w.overloaded) ? "warn" : "info"}
                />
              </>
            )}
          </div>
        </Card>

        {/* Room Utilization — stepped PALETTE so bars are visually distinct */}
        <Card>
          <CardHeader
            title="Most Utilized Rooms"
            subtitle="Top rooms by total sessions assigned"
          />
          <div style={{ padding: "18px" }}>
            {loading ? (
              <SectionSkel rows={6} />
            ) : (
              <>
                <ResponsiveContainer width="100%" height={Math.max(220, roomData.length * 34)}>
                  <BarChart data={roomData} layout="vertical" margin={{ top: 0, right: 36, bottom: 0, left: 8 }}>
                    <CartesianGrid strokeDasharray="3 3" horizontal={false} stroke="var(--hover)" />
                    <XAxis type="number" axisLine={false} tickLine={false}
                      tick={{ fontSize: 11, fill: "var(--muted2)", fontFamily: "Poppins" }} />
                    <YAxis type="category" dataKey="room" axisLine={false} tickLine={false}
                      width={70} tick={{ fontSize: 11, fill: "var(--ink)", fontFamily: "Poppins" }} />
                    <Tooltip cursor={{ fill: "rgba(10,46,28,0.04)" }} contentStyle={TooltipStyle} />
                    <Bar dataKey="sessions" radius={[0, 5, 5, 0]} barSize={16}>
                      {roomData.map((_, i) => (
                        <Cell key={i} fill={PALETTE[i % PALETTE.length]} />
                      ))}
                      <LabelList dataKey="sessions" position="right"
                        style={{ fontSize: 10, fontWeight: 600, fill: "var(--ink)", fontFamily: "Poppins" }} />
                    </Bar>
                  </BarChart>
                </ResponsiveContainer>
                <InsightNote
                  text={roomData.length > 0
                    ? `Room ${roomData[0].room} handles the highest volume of classes this term.`
                    : "No room data available."}
                />
              </>
            )}
          </div>
        </Card>

      </div>
    </div>
  );
}