/**
 * AnalyticsPage.jsx
 *
 * Improved analytics dashboard — consistent with the lavender/white system design.
 * - No duplicate page header (handled by the app shell)
 * - Schedule selector pill matching DashboardPage
 * - Stat cards with icons + hover effects
 * - Shimmer skeleton loading
 * - Pie chart legends
 * - Unified card styling
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

// ── Shimmer + shared keyframes ────────────────────────────────────────────────
const SHIMMER_STYLE = `
  @keyframes spin   { to { transform: rotate(360deg) } }
  @keyframes shimmer {
    0%   { background-position: -400px 0 }
    100% { background-position:  400px 0 }
  }
  .skeleton {
    background: linear-gradient(90deg, #F0EDF9 25%, #E4DEFC 50%, #F0EDF9 75%);
    background-size: 800px 100%;
    animation: shimmer 1.4s ease-in-out infinite;
    border-radius: 7px;
  }
`;

// ── Design Tokens ─────────────────────────────────────────────────────────────
const T = {
  bg:            "#F8F7FE",
  surface:       "#FFFFFF",
  border:        "#E8E4F8",
  borderLight:   "#F0EDF9",
  text:          "#1a1a2e",
  muted:         "#8883B0",
  accent:        "#7C6FCD",
  accentLight:   "#C4B5FD",
  success:       "#059669",
  warn:          "#D97706",
  danger:        "#C0392B",
  gridLine:      "#F3F0FC",
};

const PALETTE = ["#7C6FCD", "#A78BFA", "#6366F1", "#C4B5FD", "#EC4899", "#14B8A6"];

const DAY_COLORS = {
  Monday: "#7C6FCD", Tuesday: "#A78BFA", Wednesday: "#C4B5FD",
  Thursday: "#6366F1", Friday: "#818CF8", Saturday: "#4F46E5",
};

// ── Helpers ───────────────────────────────────────────────────────────────────
const pct = (n, total) => total ? `${Math.round((n / total) * 100)}%` : "0%";

const loadColor = (row) => {
  if (row.overloaded)    return T.danger;
  if (row.load_pct >= 85) return T.warn;
  if (row.load_pct <= 30) return T.accentLight;
  return T.success;
};

const formatName = (name) => {
  if (!name) return "";
  return name.length > 18 ? name.substring(0, 16) + "…" : name;
};

// ── Skeleton helper ───────────────────────────────────────────────────────────
function Skel({ w = "100%", h = 14, r = 7, style = {} }) {
  return <div className="skeleton" style={{ width: w, height: h, borderRadius: r, flexShrink: 0, ...style }} />;
}

// ── Card wrapper (matches Dashboard card style) ───────────────────────────────
function Card({ children, style = {} }) {
  return (
    <div style={{
      background: T.surface,
      borderRadius: 13,
      border: `1px solid ${T.border}`,
      boxShadow: "0 2px 8px rgba(124,111,205,0.06)",
      overflow: "hidden",
      ...style,
    }}>
      {children}
    </div>
  );
}

// ── Card header (matches Dashboard section header pattern) ────────────────────
function CardHeader({ title, subtitle, right }) {
  return (
    <div style={{
      padding: "12px 18px",
      borderBottom: `1px solid ${T.borderLight}`,
      display: "flex",
      alignItems: "center",
      justifyContent: "space-between",
      gap: 8,
    }}>
      <div>
        <div style={{ fontSize: 13, fontWeight: 700, color: T.text }}>{title}</div>
        {subtitle && <div style={{ fontSize: 11, color: T.muted, marginTop: 2 }}>{subtitle}</div>}
      </div>
      {right && <div style={{ flexShrink: 0 }}>{right}</div>}
    </div>
  );
}

// ── Insight callout ───────────────────────────────────────────────────────────
function InsightNote({ text, type = "info" }) {
  if (!text) return null;
  const isWarn = type === "warn" || type === "danger";
  const color  = isWarn ? T.danger : T.accent;
  const bg     = isWarn ? "#FFF5F5" : "#F5F3FF";
  const border = isWarn ? "#FECACA" : T.border;
  return (
    <div style={{
      marginTop: 14,
      padding: "10px 14px",
      borderRadius: 8,
      background: bg,
      border: `1px solid ${border}`,
      fontSize: 12,
      color: T.muted,
      lineHeight: 1.6,
    }}>
      <strong style={{ color, fontWeight: 700, marginRight: 6 }}>Insight:</strong>
      {text}
    </div>
  );
}

// ── Stat card (matches Dashboard StatCard) ────────────────────────────────────
function StatCard({ label, value, sub, icon, color, bg, loading }) {
  const [hov, setHov] = useState(false);
  return (
    <div
      onMouseEnter={() => setHov(true)}
      onMouseLeave={() => setHov(false)}
      style={{
        background: T.surface,
        borderRadius: 13,
        padding: "14px 18px",
        border: `1px solid ${T.border}`,
        display: "flex",
        alignItems: "center",
        gap: 14,
        boxShadow: hov && !loading
          ? "0 6px 20px rgba(124,111,205,0.14)"
          : "0 2px 8px rgba(124,111,205,0.06)",
        transform: hov && !loading ? "translateY(-1px)" : "none",
        transition: "all 0.18s ease",
      }}
    >
      <div style={{
        width: 42, height: 42, borderRadius: 11,
        background: loading ? "#F0EDF9" : bg,
        display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0,
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
            <div style={{ fontSize: 26, fontWeight: 700, color: T.text, lineHeight: 1 }}>{value}</div>
            <div style={{ fontSize: 11.5, color: T.muted, marginTop: 3, fontWeight: 500 }}>{label}</div>
            {sub && <div style={{ fontSize: 10.5, color: T.accentLight, marginTop: 2 }}>{sub}</div>}
          </>
        )}
      </div>
    </div>
  );
}

// ── Assignment Quality card ───────────────────────────────────────────────────
function ScoreCard({ loading, autoAssignPct, pctInWindow }) {
  const [hov, setHov] = useState(false);
  const hasData = autoAssignPct !== null && autoAssignPct !== undefined;
  const status = !hasData  ? null
    : autoAssignPct >= 90  ? { label: "Excellent", color: "#059669", bg: "#E6FAF3", bar: "#059669" }
    : autoAssignPct >= 70  ? { label: "Good",      color: "#7C6FCD", bg: "#EEEAFB", bar: "#7C6FCD" }
    : autoAssignPct >= 50  ? { label: "Fair",       color: "#D97706", bg: "#FEF3CD", bar: "#D97706" }
    :                        { label: "Needs work", color: "#C0392B", bg: "#FFE8E8", bar: "#C0392B" };

  return (
    <div
      onMouseEnter={() => setHov(true)}
      onMouseLeave={() => setHov(false)}
      style={{
        background: T.surface, borderRadius: 13, padding: "14px 18px",
        border: `1px solid ${T.border}`,
        boxShadow: hov && !loading ? "0 6px 20px rgba(124,111,205,0.14)" : "0 2px 8px rgba(124,111,205,0.06)",
        transform: hov && !loading ? "translateY(-1px)" : "none",
        transition: "all 0.18s ease",
        display: "flex", alignItems: "center", gap: 14,
      }}
    >
      <div style={{
        width: 42, height: 42, borderRadius: 11, flexShrink: 0,
        background: loading ? "#F0EDF9" : (status?.bg ?? "#F5F4FB"),
        display: "flex", alignItems: "center", justifyContent: "center",
      }}>
        {loading ? <Skel w={42} h={42} r={11} /> : (
          <svg width="19" height="19" viewBox="0 0 24 24" fill="none"
            stroke={status?.color ?? T.muted} strokeWidth="2">
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
            <div style={{ fontSize: 18, fontWeight: 700, color: T.muted, lineHeight: 1 }}>Not run yet</div>
            <div style={{ fontSize: 11, color: T.muted, marginTop: 5, lineHeight: 1.5 }}>
              Run the scheduler to see how many sessions were auto-filled.
            </div>
          </>
        ) : (
          <>
            <div style={{ display: "flex", alignItems: "center", gap: 7 }}>
              <span style={{ fontSize: 26, fontWeight: 700, color: T.text, lineHeight: 1 }}>
                {autoAssignPct}%
              </span>
              <span style={{
                fontSize: 10, fontWeight: 700, padding: "2px 7px", borderRadius: 99,
                background: status.bg, color: status.color,
              }}>
                {status.label}
              </span>
            </div>

            <div style={{ fontSize: 11.5, color: T.muted, marginTop: 3, fontWeight: 500 }}>
              Auto-filled by scheduler
            </div>

            <div style={{ marginTop: 7, height: 5, borderRadius: 99, background: T.borderLight, overflow: "hidden" }}>
              <div style={{
                height: "100%", width: `${Math.min(autoAssignPct, 100)}%`,
                borderRadius: 99, background: status.bar, transition: "width 0.4s ease",
              }} />
            </div>

            {pctInWindow !== null && pctInWindow !== undefined && (
              <div style={{ fontSize: 10.5, color: T.muted, marginTop: 5 }}>
                <span style={{ fontWeight: 700, color: T.text }}>{pctInWindow}%</span> were good faculty matches
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
            <div style={{ width: 8, height: 8, borderRadius: "50%", background: palette[i % palette.length], flexShrink: 0 }} />
            <span style={{ fontSize: 11.5, color: T.muted, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
              {item.name}
            </span>
          </div>
          <span style={{ fontSize: 11.5, fontWeight: 700, color: T.text, flexShrink: 0 }}>
            {item.value} <span style={{ fontWeight: 400, color: T.muted }}>({pct(item.value, item.total)})</span>
          </span>
        </div>
      ))}
    </div>
  );
}

// ── Tooltips ──────────────────────────────────────────────────────────────────
const TooltipStyle = {
  background: T.surface, border: `1px solid ${T.border}`, borderRadius: 8,
  boxShadow: "0 4px 12px rgba(124,111,205,0.12)", padding: "10px 14px",
  fontSize: 12, color: T.text,
};

const StandardTooltip = ({ active, payload }) => {
  if (!active || !payload?.length) return null;
  const d = payload[0];
  return (
    <div style={TooltipStyle}>
      <strong style={{ display: "block", marginBottom: 4, fontSize: 12.5 }}>
        {d.name || d.payload?.day || d.payload?.yearLevel || d.payload?.room}
      </strong>
      <span style={{ color: T.accent, fontWeight: 700 }}>{d.value} sessions</span>
      {d.payload?.total && (
        <span style={{ color: T.muted, marginLeft: 4 }}>({pct(d.value, d.payload.total)})</span>
      )}
    </div>
  );
};

// ── Schedule selector pill (matches Dashboard) ────────────────────────────────
function SchedulePill({ savedList, scheduleSource, scheduleName, onChange, loading }) {
  return (
    <div style={{
      display: "flex", alignItems: "center", gap: 5,
      padding: "4px 10px", borderRadius: 99,
      background: "#F5F4FB", border: `1px solid ${T.border}`,
    }}>
      <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke={T.muted} strokeWidth="2.5" style={{ flexShrink: 0 }}>
        <rect x="3" y="4" width="18" height="18" rx="2"/>
        <line x1="16" y1="2" x2="16" y2="6"/><line x1="8" y1="2" x2="8" y2="6"/>
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
            fontSize: 10.5, fontWeight: 600, color: T.muted, cursor: "pointer",
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
        <span style={{ fontSize: 10.5, fontWeight: 600, color: T.muted }}>
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

  // Bootstrap: load saved list once
  useEffect(() => {
    listSaved().then(res => {
      const names = Array.isArray(res) ? res : (res?.schedules ?? []);
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

  // Handle schedule selector change
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

  // ── Render ─────────────────────────────────────────────────────────────────
  return (
    <div style={{
      fontFamily: "'Poppins', sans-serif",
      background: T.bg,
      minHeight: "100vh",
      padding: "20px 28px",
      color: T.text,
      display: "flex",
      flexDirection: "column",
      gap: 16,
    }}>
      <style>{SHIMMER_STYLE}</style>

      {/* ── Top control bar ── */}
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 12 }}>
        <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
          {/* Session count badge */}
          <div style={{
            fontSize: 11.5, fontWeight: 600, color: T.muted,
            padding: "4px 12px", borderRadius: 99,
            background: T.surface, border: `1px solid ${T.border}`,
          }}>
            {loading
              ? <Skel w={80} h={10} r={5} style={{ display: "inline-block" }} />
              : <><span style={{ fontWeight: 700, color: T.accent }}>{dist?.totalSessions ?? 0}</span> active sessions</>
            }
          </div>

          {/* Schedule selector */}
          <SchedulePill
            savedList={savedList}
            scheduleSource={scheduleSource}
            scheduleName={scheduleName}
            onChange={handleScheduleChange}
            loading={loading}
          />
        </div>

        {/* Refresh */}
        <button
          onClick={load}
          disabled={loading}
          style={{
            background: T.surface,
            color: T.accent,
            border: `1px solid ${T.border}`,
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
          <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"
            style={{ animation: loading ? "spin 0.8s linear infinite" : "none" }}>
            <polyline points="23 4 23 10 17 10"/>
            <path d="M20.49 15a9 9 0 1 1-2.12-9.36L23 10"/>
          </svg>
          Refresh
        </button>
      </div>

      {/* ── SECTION 1: System Health stat cards ── */}
      <div style={{ display: "grid", gridTemplateColumns: "repeat(4, 1fr)", gap: 14 }}>
        <StatCard
          label="Assigned Sessions" sub={`of ${dist?.totalSessions ?? 0} total`}
          value={loading ? null : (dist?.facultyCoverage?.covered ?? 0)}
          color={T.accent} bg="#EEEAFB" loading={loading}
          icon={<svg width="19" height="19" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M22 11.08V12a10 10 0 1 1-5.93-9.14"/><polyline points="22 4 12 14.01 9 11.01"/></svg>}
        />
        <StatCard
          label="TBA / Unassigned" sub="Sessions missing faculty"
          value={loading ? null : (quality?.tbaSessions ?? 0)}
          color="#D97706" bg="#FEF3CD" loading={loading}
          icon={<svg width="19" height="19" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><circle cx="12" cy="12" r="10"/><line x1="12" y1="8" x2="12" y2="12"/><line x1="12" y1="16" x2="12.01" y2="16"/></svg>}
        />
        <StatCard
          label="Hard Conflicts" sub="Room / faculty time clashes"
          value={loading ? null : (quality?.totalConflicts ?? 0)}
          color="#C0392B" bg="#FFE8E8" loading={loading}
          icon={<svg width="19" height="19" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><polygon points="7.86 2 16.14 2 22 7.86 22 16.14 16.14 22 7.86 22 2 16.14 2 7.86 7.86 2"/><line x1="12" y1="8" x2="12" y2="12"/><line x1="12" y1="16" x2="12.01" y2="16"/></svg>}
        />

        {/* Optimization Score — custom card with contextual explanation */}
        <ScoreCard
          loading={loading}
          autoAssignPct={quality?.autoAssignPct ?? null}
          pctInWindow={quality?.pctInWindow ?? null}
        />
      </div>

      {/* ── SECTION 2: Academic Composition ── */}
      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 16 }}>

        {/* Program Distribution */}
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
                    <Pie data={programData} cx="50%" cy="50%" innerRadius={52} outerRadius={80} dataKey="value" stroke="none">
                      {programData.map((_, i) => <Cell key={i} fill={PALETTE[i % PALETTE.length]} />)}
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

        {/* Lecture vs Lab */}
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
                    <Pie data={typeData} cx="50%" cy="50%" outerRadius={80} dataKey="value" stroke="none">
                      {typeData.map((_, i) => <Cell key={i} fill={i === 0 ? T.accent : T.accentLight} />)}
                    </Pie>
                    <Tooltip content={<StandardTooltip />} />
                  </PieChart>
                </ResponsiveContainer>
                <PieLegend data={typeData} palette={[T.accent, T.accentLight]} />
                <InsightNote text="Indicates balance between lecture-based and hands-on lab instruction." />
              </>
            )}
          </div>
        </Card>
      </div>

      {/* ── SECTION 3: Temporal Volume ── */}
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
                <BarChart data={dayData} margin={{ top: 10, right: 4, bottom: 0, left: -20 }}>
                  <CartesianGrid strokeDasharray="3 3" vertical={false} stroke={T.gridLine} />
                  <XAxis dataKey="day" axisLine={false} tickLine={false}
                    tick={{ fill: T.muted, fontSize: 12, fontFamily: "Poppins", dy: 8 }} />
                  <YAxis axisLine={false} tickLine={false}
                    tick={{ fill: T.muted, fontSize: 11, fontFamily: "Poppins" }} />
                  <Tooltip cursor={{ fill: "rgba(124,111,205,0.04)" }} content={<StandardTooltip />} />
                  <Bar dataKey="sessions" radius={[5, 5, 0, 0]} maxBarSize={48}>
                    {dayData.map((d, i) => <Cell key={i} fill={DAY_COLORS[d.day] ?? T.accent} />)}
                    <LabelList dataKey="sessions" position="top"
                      style={{ fill: T.text, fontSize: 11, fontWeight: 600, fontFamily: "Poppins" }} />
                  </Bar>
                </BarChart>
              </ResponsiveContainer>
              <InsightNote text={getTemporalInterpretation()} />
            </>
          )}
        </div>
      </Card>

      {/* ── SECTION 4: Resource Constraints ── */}
      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 16 }}>

        {/* Faculty Workload */}
        <Card>
          <CardHeader
            title="Faculty Workload"
            subtitle="Assigned units vs. maximum capacity"
            right={
              workloadData.some(w => w.overloaded) && (
                <span style={{
                  background: "#FFE8E8", color: T.danger,
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
                    <CartesianGrid strokeDasharray="3 3" horizontal={false} stroke={T.gridLine} />
                    <XAxis type="number" axisLine={false} tickLine={false}
                      tick={{ fontSize: 11, fill: T.muted, fontFamily: "Poppins" }} />
                    <YAxis type="category" dataKey="name" axisLine={false} tickLine={false}
                      width={120} tick={{ fontSize: 11, fill: T.text, fontFamily: "Poppins" }}
                      tickFormatter={formatName} />
                    <Tooltip cursor={{ fill: "rgba(124,111,205,0.04)" }} contentStyle={TooltipStyle} />
                    <Bar dataKey="effective_max" fill={T.borderLight} radius={4} barSize={10} />
                    <Bar dataKey="assigned" radius={4} barSize={10}>
                      {workloadData.map((r, i) => <Cell key={i} fill={loadColor(r)} />)}
                      <LabelList dataKey="assigned" position="right"
                        style={{ fontSize: 10, fontWeight: 600, fill: T.text, fontFamily: "Poppins" }}
                        formatter={(v) => `${v}u`} />
                    </Bar>
                  </BarChart>
                </ResponsiveContainer>
                <InsightNote
                  text={getWorkloadInterpretation()}
                  type={workloadData.some(w => w.overloaded) ? "warn" : "info"}
                />
              </>
            )}
          </div>
        </Card>

        {/* Room Utilization */}
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
                    <CartesianGrid strokeDasharray="3 3" horizontal={false} stroke={T.gridLine} />
                    <XAxis type="number" axisLine={false} tickLine={false}
                      tick={{ fontSize: 11, fill: T.muted, fontFamily: "Poppins" }} />
                    <YAxis type="category" dataKey="room" axisLine={false} tickLine={false}
                      width={70} tick={{ fontSize: 11, fill: T.text, fontFamily: "Poppins" }} />
                    <Tooltip cursor={{ fill: "rgba(124,111,205,0.04)" }} contentStyle={TooltipStyle} />
                    <Bar dataKey="sessions" fill={T.accentLight} radius={[0, 5, 5, 0]} barSize={16}>
                      <LabelList dataKey="sessions" position="right"
                        style={{ fontSize: 10, fontWeight: 600, fill: T.text, fontFamily: "Poppins" }} />
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