/**
 * AnalyticsPage.jsx
 *
 * Analytics dashboard — colour-matched to DashboardPage green system.
 * - CSS variables: --surface, --border, --ink, --muted, --muted2, --hover, --bg
 * - Distinct chart palettes for bar + pie so every segment is clearly separated
 * - Shimmer skeleton tinted to match dashboard green shimmer
 */

import { useState, useEffect, useCallback, useMemo } from "react";
import {
  PieChart, Pie, Cell, Tooltip, ResponsiveContainer,
  BarChart, Bar, XAxis, YAxis, CartesianGrid, LabelList,
} from "recharts";

import {
  getScheduleDistribution,
  getAssignmentQuality,
  getWorkload,
  getFacultySatisfaction,
  getRoomCompliance,
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
    background: linear-gradient(90deg,var(--hover) 25%,var(--border) 50%,var(--hover) 75%);
    background-size: 600px 100%;
    animation: shimmer 1.4s ease-in-out infinite;
    border-radius: 7px;
  }
  .a-card {
    background: var(--surface);
    border-radius: 16px;
    border: 1px solid var(--border);
    box-shadow: 0 2px 12px rgba(0,0,0,0.07);
    overflow: hidden;
    flex-shrink: 0;
    animation: fadeUp .35s ease both;
  }
  .a-stat-card {
    background: var(--surface);
    border-radius: 14px;
    border: 1px solid var(--border);
    box-shadow: 0 1px 6px rgba(0,0,0,0.06);
    padding: 16px 18px;
    display: flex;
    align-items: center;
    gap: 14px;
    transition: box-shadow .18s, transform .18s;
    animation: fadeUp .3s ease both;
    cursor: default;
    position: relative;
    overflow: hidden;
  }
  .a-stat-card:hover {
    box-shadow: 0 6px 22px rgba(0,0,0,0.11);
    transform: translateY(-2px);
  }
`;

// ── Colour palette (matches Dashboard green system) ───────────────────────────
// These mirror the exact colours used in DashboardPage for consistency.
const C = {
  green:   "var(--meadow)",   // primary accent — Dashboard's main colour
  blue:    '#60A5FA',
  amber:   '#F59E0B',
  purple:  "#7C3AED",
  cyan:    "#0891B2",
  red:     '#EF4444',
  teal:    "#0D9488",
  rose:    "#E11D48",
};

// ── Distinct palette for pie / bar charts ─────────────────────────────────────
// 8 high-contrast colours so every segment is clearly distinguishable
const PALETTE = [
  C.green,   // var(--meadow)  forest green
  C.blue,    // #2563EB  royal blue
  C.amber,   // #D97706  amber
  C.purple,  // #7C3AED  violet
  C.cyan,    // #0891B2  cyan
  C.rose,    // #E11D48  rose
  C.teal,    // #0D9488  teal
  '#A78BFA', //          indigo (fallback 8th)
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
function Card({ children, style = {}, id }) {
  return (
    <div className="a-card" id={id} style={{ flexShrink: 0, ...style }}>
      {children}
    </div>
  );
}

// ── Card header (mirrors DashboardPage SectionHeader) ─────────────────────────
function CardHeader({ title, subtitle, right, id }) {
  return (
    <div id={id} style={{
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
  const bg     = isWarn ? 'rgba(220, 38, 38, 0.05)' : "var(--meadow-soft)";
  const border = isWarn ? 'rgba(220, 38, 38, 0.25)' : "var(--meadow-border)";
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
      {/* Decorative wave */}
      {(typeof color !== 'undefined' ? color : (typeof status !== 'undefined' ? status?.color : null)) && (
        <svg width="100%" height="40" style={{ position: 'absolute', bottom: 0, right: 0, opacity: 0.12, zIndex: 0, pointerEvents: 'none' }} viewBox="0 0 100 40" preserveAspectRatio="none">
          <path d="M0 40 Q 25 10, 50 25 T 100 10 L 100 40 Z" fill={typeof color !== 'undefined' ? color : status?.color} />
        </svg>
      )}
    </div>
  );
}

// ── Optimization / Score card ─────────────────────────────────────────────────
function ScoreCard({ loading, autoAssignPct, specMatchPct }) {
  const hasData = autoAssignPct !== null && autoAssignPct !== undefined;
  const status = !hasData  ? null
    : autoAssignPct >= 90  ? { label: "Excellent", color: C.green,  bg: "var(--meadow-soft)", bar: C.green  }
    : autoAssignPct >= 70  ? { label: "Good",      color: C.blue,   bg: 'rgba(59, 130, 246, 0.1)', bar: C.blue   }
    : autoAssignPct >= 50  ? { label: "Fair",       color: C.amber,  bg: 'rgba(217, 119, 6, 0.1)', bar: C.amber  }
    :                        { label: "Needs work", color: C.red,    bg: 'rgba(220, 38, 38, 0.1)', bar: C.red    };

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
            {specMatchPct !== null && specMatchPct !== undefined && (
              <div style={{ fontSize: 10.5, color: "var(--muted2)", marginTop: 5 }}>
                <span style={{ fontWeight: 700, color: "var(--ink)" }}>{specMatchPct}%</span> taught by a matching specialist
              </div>
            )}
          </>
        )}
      </div>
      {/* Decorative wave */}
      {(typeof color !== 'undefined' ? color : (typeof status !== 'undefined' ? status?.color : null)) && (
        <svg width="100%" height="40" style={{ position: 'absolute', bottom: 0, right: 0, opacity: 0.12, zIndex: 0, pointerEvents: 'none' }} viewBox="0 0 100 40" preserveAspectRatio="none">
          <path d="M0 40 Q 25 10, 50 25 T 100 10 L 100 40 Z" fill={typeof color !== 'undefined' ? color : status?.color} />
        </svg>
      )}
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
  boxShadow: "0 4px 12px rgba(0,0,0,0.10)",
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
          <option value="__current__" style={{ background: 'var(--surface)', color: 'var(--ink)' }}>
            {scheduleName ? `Current (${scheduleName})` : "Current (in memory)"}
          </option>
          {savedList.map(name => (
            <option key={name} value={name} style={{ background: 'var(--surface)', color: 'var(--ink)' }}>{name}</option>
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

import { useTour } from '../../hooks/useTour.jsx'

const TOUR_SEEN_KEY = 'adminAnalytics_tourSeen'
function isOnboardingCompleted() {
  try { return localStorage.getItem(TOUR_SEEN_KEY) === '1' } catch { return true }
}
function markOnboardingCompleted() {
  try { localStorage.setItem(TOUR_SEEN_KEY, '1') } catch {}
}

// ══════════════════════════════════════════════════════════════════════════════
//  Unit cap + satisfaction + heatmap components
// ══════════════════════════════════════════════════════════════════════════════

// button is globally reset (all: unset) in this app, so every control is fully styled
const ctrlBase = {
  fontFamily: "inherit", fontSize: 11.5, color: "var(--ink)",
  background: "var(--surface)", border: "1.5px solid var(--border)",
  borderRadius: 8, padding: "6px 10px", outline: "none",
};

const STATE = {
  over:  { label: "Over cap", color: C.red,         soft: "rgba(220, 38, 38, 0.1)" },
  near:  { label: "Near cap", color: C.amber,       soft: "rgba(245, 158, 11, 0.12)" },
  ok:    { label: "Balanced", color: C.green,       soft: "var(--meadow-soft)" },
  light: { label: "Light",    color: "var(--mint)", soft: "var(--hover)" },
};
const STATE_ORDER = ["over", "near", "ok", "light"];

function enrichWorkload(r) {
  const cap = Number(r.effective_max ?? r.max_units ?? 0);
  const assigned = Number(r.assigned ?? 0);
  const pctUsed = cap ? (assigned / cap) * 100 : 0;
  const state = r.overloaded || pctUsed > 100 ? "over" : pctUsed >= 85 ? "near" : pctUsed <= 30 ? "light" : "ok";
  return { ...r, cap, assigned, pctUsed, state, headroom: Math.max(0, cap - assigned) };
}

const BANDS = [
  { key: "great", label: "Great", color: C.green },
  { key: "good",  label: "Good",  color: C.blue  },
  { key: "fair",  label: "Fair",  color: C.amber },
  { key: "poor",  label: "Poor",  color: C.red   },
];
const bandColor = (score) => score >= 80 ? C.green : score >= 60 ? C.blue : score >= 40 ? C.amber : C.red;

function FilterChip({ active, color, label, count, onClick }) {
  return (
    <button
      onClick={onClick}
      style={{
        display: "inline-flex", alignItems: "center", gap: 6, padding: "5px 11px",
        borderRadius: 99, cursor: "pointer", fontFamily: "inherit", fontSize: 11.5, fontWeight: 700,
        border: `1.5px solid ${active ? (color || "var(--meadow)") : "var(--border)"}`,
        background: active ? "var(--hover)" : "var(--surface)",
        color: active ? "var(--ink)" : "var(--muted)",
        transition: "all .15s",
      }}
    >
      {color && <span style={{ width: 8, height: 8, borderRadius: 2, background: color }} />}
      {label}
      <span style={{ fontWeight: 800, color: active ? (color || "var(--ink)") : "var(--muted2)" }}>{count}</span>
    </button>
  );
}

// ── Unit cap card: every faculty member, one shared cap line ─────────────────
function UnitCapCard({ rows, loading }) {
  const [filter, setFilter] = useState("all");
  const [sort, setSort]     = useState("load");
  const [q, setQ]           = useState("");
  const [openName, setOpen] = useState(null);

  const counts = useMemo(() => {
    const c = { over: 0, near: 0, ok: 0, light: 0 };
    rows.forEach(r => { c[r.state] += 1; });
    return c;
  }, [rows]);

  const totalAssigned = rows.reduce((s, r) => s + r.assigned, 0);
  const totalCap      = rows.reduce((s, r) => s + r.cap, 0);
  const totalHeadroom = rows.reduce((s, r) => s + r.headroom, 0);
  const totalPct      = totalCap ? Math.round((totalAssigned / totalCap) * 100) : 0;

  // shared axis: 100% (the cap) sits at the same x-position on every row
  const scaleMax = Math.max(130, Math.ceil(Math.max(0, ...rows.map(r => r.pctUsed)) / 10) * 10 + 10);
  const at = (p) => `${(p / scaleMax) * 100}%`;

  const visible = useMemo(() => {
    const needle = q.trim().toLowerCase();
    const list = rows.filter(r =>
      (filter === "all" || r.state === filter) &&
      (!needle || (r.name || "").toLowerCase().includes(needle))
    );
    const by = {
      load:     (a, b) => b.pctUsed - a.pctUsed,
      low:      (a, b) => a.pctUsed - b.pctUsed,
      headroom: (a, b) => b.headroom - a.headroom,
      units:    (a, b) => b.assigned - a.assigned,
      name:     (a, b) => (a.name || "").localeCompare(b.name || ""),
    }[sort];
    return [...list].sort(by);
  }, [rows, filter, sort, q]);

  const overRows = rows.filter(r => r.state === "over").sort((a, b) => b.pctUsed - a.pctUsed);
  const roomiest = [...rows].sort((a, b) => b.headroom - a.headroom)[0];
  const insight = overRows.length
    ? `${overRows.length} faculty ${overRows.length > 1 ? "are" : "is"} over the unit cap, the worst being ${overRows[0].name} at ${overRows[0].assigned}/${overRows[0].cap}u (+${(overRows[0].assigned - overRows[0].cap).toFixed(1)}u).${roomiest && roomiest.headroom > 0 ? ` ${roomiest.name} has the most room left (${roomiest.headroom.toFixed(1)}u).` : ""}`
    : counts.near
      ? `Nobody is over cap, but ${counts.near} faculty ${counts.near > 1 ? "are" : "is"} at 85% or more. Avoid adding sessions to them.`
      : "Workload is balanced. Everyone is comfortably inside their unit cap.";

  return (
    <Card>
      <CardHeader
        id="tour-analytics-constraints"
        title="Faculty Unit Cap"
        subtitle="Every faculty member's assigned units against their own cap"
        right={counts.over > 0 && (
          <span style={{ background: "rgba(220, 38, 38, 0.1)", color: C.red, fontSize: 10.5, fontWeight: 700, padding: "3px 9px", borderRadius: 99 }}>
            {counts.over} over cap
          </span>
        )}
      />
      <div style={{ padding: 18 }}>
        {loading ? <SectionSkel rows={6} /> : rows.length === 0 ? (
          <div style={{ textAlign: "center", padding: "36px 0", color: "var(--muted2)", fontSize: 12.5 }}>
            No workload data yet. Run or load a schedule to see unit usage.
          </div>
        ) : (
          <>
            {/* Department totals */}
            <div style={{ display: "flex", gap: 28, flexWrap: "wrap", alignItems: "flex-end", marginBottom: 12 }}>
              <div>
                <div style={{ fontSize: 10, fontWeight: 700, letterSpacing: ".5px", textTransform: "uppercase", color: "var(--muted2)" }}>Department load</div>
                <div style={{ fontSize: 22, fontWeight: 800, color: "var(--ink)", fontFamily: "'Sora',sans-serif", lineHeight: 1.2, marginTop: 3 }}>
                  {Math.round(totalAssigned)} <span style={{ fontSize: 13, fontWeight: 600, color: "var(--muted2)" }}>/ {Math.round(totalCap)} units · {totalPct}%</span>
                </div>
              </div>
              <div>
                <div style={{ fontSize: 10, fontWeight: 700, letterSpacing: ".5px", textTransform: "uppercase", color: "var(--muted2)" }}>Spare capacity</div>
                <div style={{ fontSize: 22, fontWeight: 800, color: "var(--ink)", fontFamily: "'Sora',sans-serif", lineHeight: 1.2, marginTop: 3 }}>
                  {Math.round(totalHeadroom)} <span style={{ fontSize: 13, fontWeight: 600, color: "var(--muted2)" }}>units</span>
                </div>
              </div>
              <div style={{ flex: 1, minWidth: 220 }}>
                <div style={{ display: "flex", height: 10, borderRadius: 99, overflow: "hidden", background: "var(--hover)" }}>
                  {STATE_ORDER.map(k => counts[k] > 0 && (
                    <div key={k} title={`${STATE[k].label}: ${counts[k]}`}
                      style={{ width: `${(counts[k] / rows.length) * 100}%`, background: STATE[k].color }} />
                  ))}
                </div>
                <div style={{ fontSize: 10.5, color: "var(--muted2)", marginTop: 5 }}>{rows.length} faculty by load status</div>
              </div>
            </div>

            {/* Filters (double as the legend) + search + sort */}
            <div style={{ display: "flex", gap: 8, flexWrap: "wrap", alignItems: "center", marginBottom: 12 }}>
              <FilterChip label="All" count={rows.length} active={filter === "all"} onClick={() => setFilter("all")} />
              {STATE_ORDER.map(k => (
                <FilterChip key={k} label={STATE[k].label} count={counts[k]} color={STATE[k].color}
                  active={filter === k} onClick={() => setFilter(filter === k ? "all" : k)} />
              ))}
              <div style={{ flex: 1 }} />
              <input value={q} onChange={e => setQ(e.target.value)} placeholder="Search faculty…"
                style={{ ...ctrlBase, width: 150 }} />
              <select value={sort} onChange={e => setSort(e.target.value)} style={{ ...ctrlBase, cursor: "pointer" }}>
                <option value="load">Highest load %</option>
                <option value="low">Lowest load %</option>
                <option value="headroom">Most spare units</option>
                <option value="units">Most units</option>
                <option value="name">Name A to Z</option>
              </select>
            </div>

            {/* Axis */}
            <div style={{ display: "grid", gridTemplateColumns: "180px minmax(0,1fr) 116px", gap: 14, padding: "0 6px 6px" }}>
              <div />
              <div style={{ position: "relative", height: 14, fontSize: 9.5, fontWeight: 700, color: "var(--muted2)" }}>
                <span style={{ position: "absolute", left: 0 }}>0</span>
                <span style={{ position: "absolute", left: at(85), transform: "translateX(-50%)", color: C.amber }}>85%</span>
                <span style={{ position: "absolute", left: at(100), transform: "translateX(-50%)", color: "var(--ink)" }}>CAP</span>
              </div>
              <div />
            </div>

            {/* Rows: every faculty member, scrolls instead of truncating */}
            <div style={{ maxHeight: 480, overflowY: "auto", border: "1px solid var(--border)", borderRadius: 10 }}>
              {visible.length === 0 && (
                <div style={{ padding: 24, textAlign: "center", fontSize: 12, color: "var(--muted2)" }}>No faculty match this filter.</div>
              )}
              {visible.map((r, i) => {
                const st = STATE[r.state];
                const open = openName === r.name;
                const over = r.assigned - r.cap;
                return (
                  <div key={r.name} style={{ borderBottom: i < visible.length - 1 ? "1px solid var(--border)" : "none" }}>
                    <div
                      onClick={() => setOpen(open ? null : r.name)}
                      style={{ display: "grid", gridTemplateColumns: "180px minmax(0,1fr) 116px", gap: 14, alignItems: "center", padding: "9px 12px", cursor: "pointer", background: open ? "var(--hover)" : "transparent" }}
                    >
                      <div style={{ minWidth: 0, display: "flex", alignItems: "center", gap: 7 }}>
                        <span style={{ fontSize: 12, fontWeight: 600, color: "var(--ink)", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }} title={r.name}>{r.name}</span>
                        <span style={{ fontSize: 9, fontWeight: 700, padding: "1px 6px", borderRadius: 4, background: "var(--hover)", color: "var(--muted)", flexShrink: 0 }}>
                          {String(r.status || "").toLowerCase() === "part-time" ? "PT" : "FT"}
                        </span>
                      </div>

                      <div style={{ position: "relative", height: 12, borderRadius: 99, background: "var(--hover)", overflow: "hidden" }}>
                        <div style={{ position: "absolute", top: 0, bottom: 0, left: at(85), width: at(15), background: "rgba(245, 158, 11, 0.16)" }} />
                        <div style={{ position: "absolute", top: 0, bottom: 0, left: at(100), right: 0, background: "rgba(239, 68, 68, 0.14)" }} />
                        <div style={{ position: "absolute", top: 2, bottom: 2, left: 0, width: at(Math.min(r.pctUsed, scaleMax)), borderRadius: 99, background: st.color, transition: "width .5s ease" }} />
                        <div style={{ position: "absolute", top: 0, bottom: 0, left: at(100), width: 2, marginLeft: -1, background: "var(--ink)", opacity: 0.55 }} />
                      </div>

                      <div style={{ textAlign: "right", lineHeight: 1.25 }}>
                        <div style={{ fontSize: 12, fontWeight: 800, color: "var(--ink)" }}>
                          {r.assigned}<span style={{ fontWeight: 500, color: "var(--muted2)" }}> / {r.cap}u</span>
                        </div>
                        <div style={{ fontSize: 10.5, fontWeight: 700, color: st.color }}>
                          {r.state === "over" ? `+${over.toFixed(1)}u over` : `${Math.round(r.pctUsed)}%`}
                        </div>
                      </div>
                    </div>

                    {open && (
                      <div style={{ padding: "4px 14px 14px 12px", background: "var(--hover)" }}>
                        {r.load_reason && (
                          <div style={{ fontSize: 11.5, color: "var(--muted)", lineHeight: 1.55, marginBottom: 8 }}>{r.load_reason}</div>
                        )}
                        <div style={{ display: "flex", flexWrap: "wrap", gap: 6, alignItems: "center" }}>
                          <span style={{ fontSize: 10.5, fontWeight: 700, color: "var(--muted2)" }}>
                            {r.headroom.toFixed(1)}u spare · {r.distinct_courses ?? (r.course_list?.length || 0)} course(s)
                          </span>
                          {(r.course_list || []).map(c => (
                            <span key={c} style={{ fontSize: 10, fontWeight: 700, padding: "2px 8px", borderRadius: 99, background: "var(--surface)", border: "1px solid var(--border)", color: "var(--ink)", fontFamily: "'IBM Plex Mono',monospace" }}>{c}</span>
                          ))}
                        </div>
                      </div>
                    )}
                  </div>
                );
              })}
            </div>

            <div style={{ display: "flex", justifyContent: "space-between", flexWrap: "wrap", gap: 8, marginTop: 8, fontSize: 10.5, color: "var(--muted2)" }}>
              <span>Showing {visible.length} of {rows.length} faculty. Click a row for details.</span>
              <span>Dark line = unit cap · amber zone = 85 to 100% · red zone = above cap</span>
            </div>

            <InsightNote text={insight} type={counts.over ? "warn" : "info"} />
          </>
        )}
      </div>
    </Card>
  );
}

// ── Satisfaction ─────────────────────────────────────────────────────────────
function Ring({ value, size = 116, stroke = 11, sub = "out of 100", suffix = "" }) {
  const r = (size - stroke) / 2;
  const circ = 2 * Math.PI * r;
  const has = value !== null && value !== undefined;
  const filled = has ? (Math.min(value, 100) / 100) * circ : 0;
  const color = has ? bandColor(value) : "var(--muted2)";
  return (
    <div style={{ position: "relative", width: size, height: size, flexShrink: 0 }}>
      <svg width={size} height={size} style={{ transform: "rotate(-90deg)" }}>
        <circle cx={size / 2} cy={size / 2} r={r} fill="none" stroke="var(--hover)" strokeWidth={stroke} />
        <circle cx={size / 2} cy={size / 2} r={r} fill="none" stroke={color} strokeWidth={stroke}
          strokeDasharray={`${filled} ${circ - filled}`} strokeLinecap="round"
          style={{ transition: "stroke-dasharray 1s cubic-bezier(.4,0,.15,1)" }} />
      </svg>
      <div style={{ position: "absolute", inset: 0, display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center" }}>
        <span style={{ fontSize: 26, fontWeight: 800, color: "var(--ink)", fontFamily: "'Sora',sans-serif", lineHeight: 1 }}>{has ? `${Math.round(value)}${suffix}` : "—"}</span>
        <span style={{ fontSize: 9.5, fontWeight: 700, color: "var(--muted2)", marginTop: 3 }}>{sub}</span>
      </div>
    </div>
  );
}

function MetricBar({ label, value, note }) {
  const has = value !== null && value !== undefined;
  return (
    <div>
      <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 4 }}>
        <span style={{ fontSize: 11.5, fontWeight: 600, color: "var(--ink)" }}>{label}</span>
        <span style={{ fontSize: 11.5, fontWeight: 800, color: has ? bandColor(value) : "var(--muted2)" }}>{has ? `${Math.round(value)}%` : "n/a"}</span>
      </div>
      <div style={{ height: 7, borderRadius: 99, background: "var(--hover)", overflow: "hidden" }}>
        {has && <div style={{ height: "100%", width: `${Math.min(value, 100)}%`, borderRadius: 99, background: bandColor(value), transition: "width .6s ease" }} />}
      </div>
      {note && <div style={{ fontSize: 10, color: "var(--muted2)", marginTop: 3 }}>{note}</div>}
    </div>
  );
}

function ScoreChip({ label, value }) {
  const has = value !== null && value !== undefined;
  const c = has ? bandColor(value) : "var(--muted2)";
  return (
    <span title={has ? `${label}: ${Math.round(value)}%` : `${label}: no preference set`}
      style={{ display: "inline-flex", gap: 4, alignItems: "center", fontSize: 10, fontWeight: 700, padding: "2px 7px", borderRadius: 6, background: "var(--hover)", color: "var(--muted)" }}>
      {label}
      <span style={{ color: c }}>{has ? `${Math.round(value)}%` : "n/a"}</span>
    </span>
  );
}

function SatisfactionCard({ sat, loading }) {
  const [view, setView] = useState("attention");
  const rows = sat?.rows ?? [];
  const sum  = sat?.summary;
  const attention = rows.filter(r => r.satisfaction < 60);
  const list = view === "attention" && attention.length ? attention : rows;

  const bandData = BANDS.map(b => ({ name: b.label, count: sum?.bands?.[b.key] ?? 0, fill: b.color }));

  const issueTotals = rows.reduce((a, r) => ({
    day: a.day + (r.offDaySessions || 0),
    time: a.time + (r.offTimeSessions || 0),
    spec: a.spec + (r.noSpecSessions || 0),
  }), { day: 0, time: 0, spec: 0 });
  const topIssue = [
    [issueTotals.spec, "sessions taught outside a faculty member's specializations"],
    [issueTotals.day,  "sessions placed on days faculty did not prefer"],
    [issueTotals.time, "sessions outside preferred teaching hours"],
  ].sort((a, b) => b[0] - a[0])[0];

  const insight = !rows.length ? null
    : attention.length
      ? `${attention.length} of ${rows.length} faculty are below 60. The biggest driver is ${topIssue[0]} ${topIssue[1]}.`
      : `Everyone is at 60 or above. Average satisfaction is ${Math.round(sum.avgSatisfaction ?? 0)}.`;

  return (
    <Card>
      <CardHeader
        id="tour-analytics-satisfaction"
        title="Faculty Satisfaction"
        subtitle="How well the schedule fits each faculty member's specializations and preferences"
        right={sum && attention.length > 0 && (
          <span style={{ background: "rgba(245, 158, 11, 0.12)", color: "#B45309", fontSize: 10.5, fontWeight: 700, padding: "3px 9px", borderRadius: 99 }}>
            {attention.length} need attention
          </span>
        )}
      />
      <div style={{ padding: 18 }}>
        {loading ? <SectionSkel rows={6} /> : !rows.length ? (
          <div style={{ textAlign: "center", padding: "36px 0", color: "var(--muted2)", fontSize: 12.5 }}>
            {sat ? "No faculty have assigned sessions yet." : "Satisfaction data is unavailable. Check that the analytics API is updated."}
          </div>
        ) : (
          <div style={{ display: "grid", gridTemplateColumns: "minmax(260px, 340px) minmax(0, 1fr)", gap: 24 }}>
            {/* Left: score, components, distribution */}
            <div style={{ display: "flex", flexDirection: "column", gap: 18 }}>
              <div style={{ display: "flex", alignItems: "center", gap: 16 }}>
                <Ring value={sum.avgSatisfaction} />
                <div>
                  <div style={{ fontSize: 13, fontWeight: 800, color: "var(--ink)" }}>Average satisfaction</div>
                  <div style={{ fontSize: 11.5, color: "var(--muted)", marginTop: 3, lineHeight: 1.5 }}>
                    Weighted: specialization 50%, days 25%, hours 25%.
                  </div>
                </div>
              </div>

              <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
                <MetricBar label="Specialization fit" value={sum.avgSpec} note={`${sum.specMatchPct ?? 0}% of sessions taught by a matching specialist`} />
                <MetricBar label="Preferred days" value={sum.avgDay} note={`${sum.dayPrefFaculty} of ${sum.partTimeFaculty ?? 0} part-time faculty set preferred days`} />
                <MetricBar label="Preferred hours" value={sum.avgTime} note={`${sum.timePrefFaculty} of ${sum.partTimeFaculty ?? 0} part-time faculty set a time window`} />
              </div>

              <div>
                <div style={{ fontSize: 11.5, fontWeight: 700, color: "var(--ink)", marginBottom: 4 }}>Faculty by satisfaction</div>
                <ResponsiveContainer width="100%" height={150}>
                  <BarChart data={bandData} margin={{ top: 18, right: 4, left: 4, bottom: 0 }}>
                    <XAxis dataKey="name" axisLine={false} tickLine={false}
                      tick={{ fontSize: 11, fill: "var(--muted)", fontFamily: "Poppins" }} />
                    <YAxis hide allowDecimals={false} />
                    <Tooltip cursor={{ fill: "rgba(0,0,0,0.04)" }}
                      content={({ active, payload }) => active && payload?.length ? (
                        <div style={TooltipStyle}><strong>{payload[0].payload.name}</strong>: {payload[0].value} faculty</div>
                      ) : null} />
                    <Bar dataKey="count" radius={[6, 6, 0, 0]} maxBarSize={44}>
                      {bandData.map((b, i) => <Cell key={i} fill={b.fill} />)}
                      <LabelList dataKey="count" position="top"
                        style={{ fill: "var(--ink)", fontSize: 11, fontWeight: 700, fontFamily: "Poppins" }} />
                    </Bar>
                  </BarChart>
                </ResponsiveContainer>
                <div style={{ display: "flex", gap: 12, flexWrap: "wrap", justifyContent: "center", fontSize: 10, color: "var(--muted2)", fontWeight: 600 }}>
                  <span>Great 80+</span><span>Good 60 to 79</span><span>Fair 40 to 59</span><span>Poor under 40</span>
                </div>
              </div>
            </div>

            {/* Right: per-faculty list, lowest first */}
            <div style={{ minWidth: 0, display: "flex", flexDirection: "column" }}>
              <div style={{ display: "flex", gap: 8, marginBottom: 10, alignItems: "center", flexWrap: "wrap" }}>
                <FilterChip label="Needs attention" count={attention.length} color={C.amber}
                  active={view === "attention"} onClick={() => setView("attention")} />
                <FilterChip label="All faculty" count={rows.length}
                  active={view === "all"} onClick={() => setView("all")} />
                <span style={{ fontSize: 10.5, color: "var(--muted2)", marginLeft: "auto" }}>Lowest satisfaction first</span>
              </div>

              <div style={{ maxHeight: 470, overflowY: "auto", border: "1px solid var(--border)", borderRadius: 10 }}>
                {list.map((r, i) => {
                  const c = bandColor(r.satisfaction);
                  const issues = [
                    r.noSpecSessions  ? `${r.noSpecSessions} outside specialization` : null,
                    r.offDaySessions  ? `${r.offDaySessions} off preferred days` : null,
                    r.offTimeSessions ? `${r.offTimeSessions} outside preferred hours` : null,
                  ].filter(Boolean);
                  return (
                    <div key={r.name} style={{ padding: "10px 12px", borderBottom: i < list.length - 1 ? "1px solid var(--border)" : "none" }}>
                      <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
                        <div style={{ width: 150, minWidth: 0, flexShrink: 0 }}>
                          <div style={{ fontSize: 12, fontWeight: 600, color: "var(--ink)", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }} title={r.name}>{r.name}</div>
                          <div style={{ fontSize: 10, color: "var(--muted2)", marginTop: 1 }}>
                            {r.sessions} session{r.sessions === 1 ? "" : "s"} · {r.teachingDays} day{r.teachingDays === 1 ? "" : "s"}
                          </div>
                        </div>
                        <div style={{ flex: 1, height: 9, borderRadius: 99, background: "var(--hover)", overflow: "hidden" }}>
                          <div style={{ height: "100%", width: `${r.satisfaction}%`, borderRadius: 99, background: c, transition: "width .5s ease" }} />
                        </div>
                        <span style={{ width: 34, textAlign: "right", fontSize: 13, fontWeight: 800, color: c, fontFamily: "'Sora',sans-serif" }}>{Math.round(r.satisfaction)}</span>
                      </div>
                      <div style={{ display: "flex", gap: 6, flexWrap: "wrap", alignItems: "center", marginTop: 6, paddingLeft: 162 }}>
                        <ScoreChip label="Spec" value={r.specScore} />
                        <ScoreChip label="Days" value={r.dayScore} />
                        <ScoreChip label="Hours" value={r.timeScore} />
                        {issues.length > 0 && (
                          <span style={{ fontSize: 10.5, color: "var(--muted)", marginLeft: 4 }}>{issues.join(" · ")}</span>
                        )}
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          </div>
        )}
        {insight && <InsightNote text={insight} type={attention.length ? "warn" : "info"} />}
      </div>
    </Card>
  );
}

// ── Busiest hours heatmap ────────────────────────────────────────────────────
function HeatmapCard({ cells, days, loading }) {
  const hourLabel = (h) => `${h % 12 || 12}${h < 12 ? "a" : "p"}`;
  const hours = useMemo(() => {
    if (!cells?.length) return [];
    const lo = Math.min(...cells.map(c => c.hour));
    const hi = Math.max(...cells.map(c => c.hour));
    return Array.from({ length: hi - lo + 1 }, (_, i) => lo + i);
  }, [cells]);
  const map = useMemo(() => {
    const m = {};
    (cells || []).forEach(c => { m[`${c.day}|${c.hour}`] = c.count; });
    return m;
  }, [cells]);
  const max = Math.max(1, ...(cells || []).map(c => c.count));
  const peak = (cells || []).reduce((a, c) => (c.count > (a?.count ?? 0) ? c : a), null);
  const dayList = days.length ? days : ["Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday"];

  return (
    <Card>
      <CardHeader title="Busiest Hours" subtitle="Classes in session for each day and hour" />
      <div style={{ padding: 18, minHeight: 340 }}>
        {loading ? <SectionSkel rows={5} /> : !hours.length ? (
          <div style={{ textAlign: "center", padding: "36px 0", color: "var(--muted2)", fontSize: 12.5 }}>No timed sessions yet.</div>
        ) : (
          <>
            <div style={{ display: "flex", flexDirection: "column", gap: 4 }}>
              <div style={{ display: "flex", gap: 4, paddingLeft: 38 }}>
                {hours.map(h => (
                  <div key={h} style={{ flex: 1, textAlign: "center", fontSize: 9.5, fontWeight: 700, color: "var(--muted2)" }}>{hourLabel(h)}</div>
                ))}
              </div>
              {dayList.map(d => (
                <div key={d} style={{ display: "flex", gap: 4, alignItems: "center" }}>
                  <div style={{ width: 34, fontSize: 10.5, fontWeight: 700, color: "var(--muted)" }}>{d.slice(0, 3)}</div>
                  {hours.map(h => {
                    const n = map[`${d}|${h}`] || 0;
                    const k = n / max;
                    return (
                      <div key={h} title={`${d} ${hourLabel(h)}: ${n} class${n === 1 ? "" : "es"}`}
                        style={{ flex: 1, height: 32, borderRadius: 6, background: "var(--hover)", position: "relative", overflow: "hidden" }}>
                        {n > 0 && <div style={{ position: "absolute", inset: 0, background: "var(--meadow)", opacity: 0.18 + 0.82 * k }} />}
                        {n > 0 && (
                          <span style={{ position: "relative", display: "flex", alignItems: "center", justifyContent: "center", height: "100%", fontSize: 10, fontWeight: 800, color: k > 0.5 ? "#fff" : "var(--ink)" }}>{n}</span>
                        )}
                      </div>
                    );
                  })}
                </div>
              ))}
            </div>
            <div style={{ display: "flex", alignItems: "center", gap: 6, marginTop: 12, fontSize: 10, color: "var(--muted2)", fontWeight: 600 }}>
              Fewer
              <div style={{ display: "flex", gap: 2 }}>
                {[0.18, 0.4, 0.62, 0.85, 1].map(o => (
                  <div key={o} style={{ width: 16, height: 8, borderRadius: 2, background: "var(--meadow)", opacity: o }} />
                ))}
              </div>
              More
            </div>
            {peak && (
              <InsightNote text={`The busiest slot is ${peak.day} around ${hourLabel(peak.hour)}, with ${peak.count} classes running at once. That is when rooms are hardest to find.`} />
            )}
          </>
        )}
      </div>
    </Card>
  );
}

// ── Unassigned courses ───────────────────────────────────────────────────────
function UnassignedCard({ courses, loading }) {
  const max = Math.max(1, ...(courses || []).map(c => c.sessions));
  return (
    <Card>
      <CardHeader title="Unassigned Courses" subtitle="Major courses still missing an instructor (TBA)" />
      <div style={{ padding: 18, minHeight: 320 }}>
        {loading ? <SectionSkel rows={5} /> : !courses?.length ? (
          <div style={{ textAlign: "center", padding: "48px 0", color: "var(--muted2)", fontSize: 12.5 }}>
            <div style={{ width: 34, height: 34, borderRadius: "50%", background: "var(--meadow-soft)", color: "var(--meadow)", display: "flex", alignItems: "center", justifyContent: "center", margin: "0 auto 10px" }}>
              <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3"><polyline points="20 6 9 17 4 12" /></svg>
            </div>
            Every major session has an instructor.
          </div>
        ) : (
          <>
            <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
              {courses.map(c => (
                <div key={c.courseCode}>
                  <div style={{ display: "flex", justifyContent: "space-between", gap: 8, marginBottom: 4 }}>
                    <span style={{ fontSize: 12, fontWeight: 600, color: "var(--ink)", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                      <span style={{ fontFamily: "'IBM Plex Mono',monospace", fontWeight: 700 }}>{c.courseCode}</span>
                      {c.title ? <span style={{ color: "var(--muted2)", fontWeight: 500 }}> · {c.title}</span> : null}
                    </span>
                    <span style={{ fontSize: 11.5, fontWeight: 800, color: C.amber, flexShrink: 0 }}>{c.sessions} session{c.sessions === 1 ? "" : "s"}</span>
                  </div>
                  <div style={{ height: 7, borderRadius: 99, background: "var(--hover)", overflow: "hidden" }}>
                    <div style={{ height: "100%", width: `${(c.sessions / max) * 100}%`, borderRadius: 99, background: C.amber }} />
                  </div>
                  {c.programs?.length > 0 && (
                    <div style={{ fontSize: 10, color: "var(--muted2)", marginTop: 3 }}>{c.programs.join(", ")}</div>
                  )}
                </div>
              ))}
            </div>
            <InsightNote type="warn" text="Fix these first. Assign a faculty member manually, or add the specialization and re-run the scheduler." />
          </>
        )}
      </div>
    </Card>
  );
}

// ── Room compliance: are courses in the rooms they were assigned? ────────────
const CAUSE_INFO = {
  preferred_busy: { label: "Assigned room already booked", hint: "Another class held the room at that time", color: C.amber },
  preferred_free: { label: "Assigned room was free but unused", hint: "Often a manual edit after solving", color: C.red },
  unplaced:       { label: "No physical room (online or TBA)", hint: "Session has no room at all", color: C.purple },
  unknown:        { label: "Could not determine", hint: "Time slot missing on the session", color: "var(--muted2)" },
};
const ROOM_STATUS = {
  respected: { label: "Honored",     color: C.green },
  partial:   { label: "Partly",      color: C.amber },
  broken:    { label: "Not honored", color: C.red   },
};

function RoomChip({ name, good }) {
  const color = good === undefined ? "var(--ink)" : good ? C.green : C.red;
  return (
    <span style={{ fontSize: 10, fontWeight: 700, padding: "2px 8px", borderRadius: 99, background: "var(--surface)", border: `1px solid ${good === undefined ? "var(--border)" : color}`, color, fontFamily: "'IBM Plex Mono',monospace" }}>
      {name}
    </span>
  );
}

function RoomComplianceCard({ data, loading }) {
  const [view, setView] = useState("issues");
  const [openKey, setOpen] = useState(null);
  const sum = data?.summary;
  const rows = data?.rows ?? [];
  const issues = rows.filter(r => r.status !== "respected");
  const list = view === "issues" && issues.length ? issues : rows;
  const causes = sum?.causes ?? {};
  const causeTotal = Object.values(causes).reduce((a, b) => a + b, 0);
  const mism = data?.typeMismatchRows ?? [];

  const fmtCourses = (n) => `${n} course${n === 1 ? "" : "s"}`;
  const insight = !sum || !sum.coursesWithPref ? null
    : sum.violatedSessions === 0
      ? `All ${sum.sessionsWithPref} sessions with an assigned room are in that room.`
      : `${sum.violatedSessions} of ${sum.sessionsWithPref} sessions are not in their assigned room, across ${fmtCourses(issues.length)}. ${causes.preferred_free ? `${causes.preferred_free} of them had the assigned room free, so check for manual edits.` : "Most were blocked by another class in the assigned room."}`;

  const dayShort = (d) => (d || "").slice(0, 3);

  return (
    <Card>
      <CardHeader
        id="tour-analytics-rooms"
        title="Assigned Room Compliance"
        subtitle="Do sessions land in the room their course was assigned?"
        right={sum && sum.violatedSessions > 0 && (
          <span style={{ background: "rgba(245, 158, 11, 0.12)", color: "#B45309", fontSize: 10.5, fontWeight: 700, padding: "3px 9px", borderRadius: 99 }}>
            {sum.violatedSessions} off room
          </span>
        )}
      />
      <div style={{ padding: 18 }}>
        {loading ? <SectionSkel rows={6} /> : !sum ? (
          <div style={{ textAlign: "center", padding: "36px 0", color: "var(--muted2)", fontSize: 12.5 }}>
            Room data is unavailable. Check that the analytics API is updated.
          </div>
        ) : !sum.coursesWithPref ? (
          <div style={{ textAlign: "center", padding: "36px 12px", color: "var(--muted2)", fontSize: 12.5, lineHeight: 1.6 }}>
            {sum.scheduledCourses
              ? "None of the scheduled courses have an assigned room. Set a preferred room on a course and this card will track it."
              : "No schedule loaded yet."}
          </div>
        ) : (
          <>
            <div style={{ display: "grid", gridTemplateColumns: "minmax(260px, 340px) minmax(0, 1fr)", gap: 24 }}>
              {/* Left: score, course status, causes, most requested rooms */}
              <div style={{ display: "flex", flexDirection: "column", gap: 18 }}>
                <div style={{ display: "flex", alignItems: "center", gap: 16 }}>
                  <Ring value={sum.respectPct} suffix="%" sub="honored" />
                  <div>
                    <div style={{ fontSize: 13, fontWeight: 800, color: "var(--ink)" }}>
                      {sum.respectedSessions} of {sum.sessionsWithPref} sessions
                    </div>
                    <div style={{ fontSize: 11.5, color: "var(--muted)", marginTop: 3, lineHeight: 1.5 }}>
                      are in the room their course was assigned. {sum.scheduledCourses - sum.coursesWithPref} scheduled courses have no assigned room.
                    </div>
                  </div>
                </div>

                <div>
                  <div style={{ fontSize: 11.5, fontWeight: 700, color: "var(--ink)", marginBottom: 6 }}>Courses with an assigned room</div>
                  <div style={{ display: "flex", height: 10, borderRadius: 99, overflow: "hidden", background: "var(--hover)" }}>
                    {[["respected", sum.fullyRespected], ["partial", sum.partial], ["broken", sum.broken]].map(([k, n]) => n > 0 && (
                      <div key={k} title={`${ROOM_STATUS[k].label}: ${n}`}
                        style={{ width: `${(n / sum.coursesWithPref) * 100}%`, background: ROOM_STATUS[k].color }} />
                    ))}
                  </div>
                  <div style={{ display: "flex", gap: 14, flexWrap: "wrap", marginTop: 7 }}>
                    {[["respected", sum.fullyRespected], ["partial", sum.partial], ["broken", sum.broken]].map(([k, n]) => (
                      <span key={k} style={{ display: "inline-flex", alignItems: "center", gap: 5, fontSize: 11, fontWeight: 600, color: "var(--muted)" }}>
                        <span style={{ width: 8, height: 8, borderRadius: 2, background: ROOM_STATUS[k].color }} />
                        {ROOM_STATUS[k].label} <strong style={{ color: "var(--ink)" }}>{n}</strong>
                      </span>
                    ))}
                  </div>
                </div>

                {causeTotal > 0 && (
                  <div>
                    <div style={{ fontSize: 11.5, fontWeight: 700, color: "var(--ink)", marginBottom: 8 }}>Why sessions missed their room</div>
                    <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
                      {Object.keys(CAUSE_INFO).filter(k => causes[k] > 0).map(k => (
                        <div key={k}>
                          <div style={{ display: "flex", justifyContent: "space-between", gap: 8, marginBottom: 3 }}>
                            <span style={{ fontSize: 11.5, fontWeight: 600, color: "var(--ink)" }}>{CAUSE_INFO[k].label}</span>
                            <span style={{ fontSize: 11.5, fontWeight: 800, color: CAUSE_INFO[k].color }}>{causes[k]}</span>
                          </div>
                          <div style={{ height: 6, borderRadius: 99, background: "var(--hover)", overflow: "hidden" }}>
                            <div style={{ height: "100%", width: `${(causes[k] / causeTotal) * 100}%`, borderRadius: 99, background: CAUSE_INFO[k].color }} />
                          </div>
                          <div style={{ fontSize: 10, color: "var(--muted2)", marginTop: 2 }}>{CAUSE_INFO[k].hint}</div>
                        </div>
                      ))}
                    </div>
                  </div>
                )}

                {(data?.byRoom?.length ?? 0) > 0 && (
                  <div>
                    <div style={{ fontSize: 11.5, fontWeight: 700, color: "var(--ink)", marginBottom: 8 }}>Most requested rooms</div>
                    <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
                      {data.byRoom.map(r => {
                        const p = r.wanted ? (r.got / r.wanted) * 100 : 0;
                        return (
                          <div key={r.room}>
                            <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 3 }}>
                              <span style={{ fontSize: 11.5, fontWeight: 700, color: "var(--ink)", fontFamily: "'IBM Plex Mono',monospace" }}>{r.room}</span>
                              <span style={{ fontSize: 11, color: "var(--muted2)", fontWeight: 600 }}>
                                <strong style={{ color: bandColor(p) }}>{r.got}</strong> of {r.wanted} sessions · {fmtCourses(r.courses)}
                              </span>
                            </div>
                            <div style={{ height: 6, borderRadius: 99, background: "var(--hover)", overflow: "hidden" }}>
                              <div style={{ height: "100%", width: `${p}%`, borderRadius: 99, background: bandColor(p) }} />
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  </div>
                )}
              </div>

              {/* Right: per-course list */}
              <div style={{ minWidth: 0, display: "flex", flexDirection: "column" }}>
                <div style={{ display: "flex", gap: 8, marginBottom: 10, alignItems: "center", flexWrap: "wrap" }}>
                  <FilterChip label="Needs a fix" count={issues.length} color={C.amber}
                    active={view === "issues"} onClick={() => setView("issues")} />
                  <FilterChip label="All courses" count={rows.length}
                    active={view === "all"} onClick={() => setView("all")} />
                  <span style={{ fontSize: 10.5, color: "var(--muted2)", marginLeft: "auto" }}>Click a course for its sessions</span>
                </div>

                <div style={{ maxHeight: 520, overflowY: "auto", border: "1px solid var(--border)", borderRadius: 10 }}>
                  {list.map((r, i) => {
                    const k = `${r.courseCode}|${r.program}`;
                    const st = ROOM_STATUS[r.status];
                    const open = openKey === k;
                    const wanted = [...new Set([r.preferredLec, r.preferredLab].flatMap(s => String(s || "").split(",")).map(s => s.trim()).filter(Boolean))];
                    const wantedLower = wanted.map(w => w.toLowerCase());
                    const p = r.sessions ? (r.respected / r.sessions) * 100 : 0;
                    const sessions = (data?.violations ?? []).filter(v => v.courseCode === r.courseCode && v.program === r.program);
                    return (
                      <div key={k} style={{ borderBottom: i < list.length - 1 ? "1px solid var(--border)" : "none" }}>
                        <div onClick={() => setOpen(open ? null : k)}
                          style={{ padding: "10px 12px", cursor: "pointer", background: open ? "var(--hover)" : "transparent" }}>
                          <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
                            <div style={{ flex: 1, minWidth: 0 }}>
                              <div style={{ display: "flex", alignItems: "baseline", gap: 7, minWidth: 0 }}>
                                <span style={{ fontSize: 12, fontWeight: 700, color: "var(--ink)", fontFamily: "'IBM Plex Mono',monospace", flexShrink: 0 }}>{r.courseCode}</span>
                                <span style={{ fontSize: 11.5, color: "var(--muted)", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{r.title}</span>
                              </div>
                              <div style={{ display: "flex", gap: 6, flexWrap: "wrap", alignItems: "center", marginTop: 6 }}>
                                <span style={{ fontSize: 10, fontWeight: 700, color: "var(--muted2)" }}>Assigned</span>
                                {wanted.map(w => <RoomChip key={w} name={w} />)}
                                <span style={{ fontSize: 10, fontWeight: 700, color: "var(--muted2)", marginLeft: 6 }}>Used</span>
                                {r.rooms.length
                                  ? r.rooms.map(x => <RoomChip key={x} name={x} good={wantedLower.includes(x.toLowerCase())} />)
                                  : <span style={{ fontSize: 10.5, color: "var(--muted2)" }}>no room</span>}
                              </div>
                            </div>
                            <div style={{ width: 96, flexShrink: 0, textAlign: "right" }}>
                              <div style={{ fontSize: 12, fontWeight: 800, color: st.color }}>{r.respected}/{r.sessions}</div>
                              <div style={{ height: 6, borderRadius: 99, background: "var(--hover)", overflow: "hidden", marginTop: 4 }}>
                                <div style={{ height: "100%", width: `${p}%`, borderRadius: 99, background: st.color }} />
                              </div>
                              <div style={{ fontSize: 9.5, fontWeight: 700, color: st.color, marginTop: 3 }}>{st.label}</div>
                            </div>
                          </div>
                        </div>
                        {open && (
                          <div style={{ padding: "2px 14px 12px 12px", background: "var(--hover)" }}>
                            {sessions.length === 0 ? (
                              <div style={{ fontSize: 11.5, color: "var(--muted)" }}>Every session is in an assigned room.</div>
                            ) : sessions.map((v, j) => (
                              <div key={j} style={{ display: "flex", gap: 8, alignItems: "baseline", flexWrap: "wrap", fontSize: 11.5, color: "var(--muted)", padding: "3px 0" }}>
                                <span style={{ fontWeight: 700, color: "var(--ink)" }}>{dayShort(v.day)} {v.period}</span>
                                <span>{v.session}{v.block ? ` · Block ${v.block}` : ""}</span>
                                <span>in <strong style={{ color: C.red }}>{v.actual}</strong>, wanted <strong style={{ color: C.green }}>{v.preferred.join(" or ")}</strong></span>
                                <span style={{ fontSize: 10, fontWeight: 700, padding: "1px 7px", borderRadius: 99, background: "var(--surface)", color: CAUSE_INFO[v.cause]?.color }}>{CAUSE_INFO[v.cause]?.label}</span>
                              </div>
                            ))}
                          </div>
                        )}
                      </div>
                    );
                  })}
                </div>
              </div>
            </div>

            {insight && <InsightNote text={insight} type={sum.violatedSessions ? "warn" : "info"} />}
            {sum.typeMismatch > 0 && (
              <InsightNote type="warn" text={`${sum.typeMismatch} session${sum.typeMismatch === 1 ? " is" : "s are"} in the wrong kind of room, for example ${mism.slice(0, 3).map(m => `${m.courseCode} (${m.session}) in ${m.room}`).join(", ")}.`} />
            )}
          </>
        )}
      </div>
    </Card>
  );
}

// ── Main Page ─────────────────────────────────────────────────────────────────
export default function AnalyticsPage() {
  const { scheduleName, setName, clearSchedule } = useScheduleStore();

  const { TourElement, startTour } = useTour('adminAnalytics', [
    {
      target: '#tour-analytics-source',
      title: 'Choose a Schedule',
      content: 'View analytics for the schedule you\'re currently working on, or pick any saved schedule from the dropdown to review it instead.',
      disableBeacon: true,
    },
    {
      target: '#tour-analytics-stats',
      title: 'System Health at a Glance',
      content: 'Four numbers worth checking first: how many sessions are assigned, faculty coverage, sessions still missing an instructor, and hard conflicts that need fixing.',
      placement: 'bottom',
    },
    {
      target: '#tour-analytics-score',
      title: 'Coverage & Optimization Score',
      content: 'The left card tracks instructor coverage over time; the right one scores how well the solver placed sessions automatically and within your time windows.',
      placement: 'bottom',
    },
    {
      target: '#tour-analytics-composition',
      title: 'Academic Composition',
      content: 'See how sessions break down by program and by lecture vs. laboratory — useful for spotting an imbalance before it becomes a scheduling bottleneck.',
      placement: 'bottom',
    },
    {
      target: '#tour-analytics-constraints',
      title: 'Faculty Unit Cap',
      content: 'Every faculty member against their own unit cap, on one shared scale. The dark line is the cap, so anything crossing it is over. Filter by status, search by name, or click a row to see why.',
      placement: 'top',
    },
    {
      target: '#tour-analytics-rooms',
      title: 'Assigned Room Compliance',
      content: 'Checks whether each session landed in the room its course was assigned. Courses that missed are listed first, with the reason and the exact sessions, so you can fix them.',
      placement: 'top',
    },
    {
      target: '#tour-analytics-satisfaction',
      title: 'Faculty Satisfaction',
      content: 'Scores how well the schedule fits each instructor: specialization match, preferred days, and preferred hours. Faculty with the lowest scores are listed first so you know who to fix.',
      placement: 'top',
    },
  ])

  const [dist,           setDist]           = useState(null);
  const [quality,        setQuality]        = useState(null);
  const [wl,             setWl]             = useState(null);
  const [sat,            setSat]            = useState(null);
  const [roomComp,       setRoomComp]       = useState(null);
  const [loading,        setLoading]        = useState(true);
  const [savedList,      setSavedList]      = useState([]);
  const [scheduleSource, setScheduleSource] = useState(null);

  useEffect(() => {
    listSaved().then(res => {
      const list = Array.isArray(res) ? res : (res?.schedules ?? []);
      const names = list.map(item => (typeof item === "string" ? item : item?.name)).filter(Boolean);
      setSavedList(names);
    }).catch(() => {});
  }, []);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const [d, q, w, s, rc] = await Promise.all([
        getScheduleDistribution(),
        getAssignmentQuality(),
        getWorkload(),
        getFacultySatisfaction().catch(() => null),
        getRoomCompliance().catch(() => null),
      ]);
      setDist(d);
      setQuality(q);
      setWl(w.workload ?? []);
      setSat(s);
      setRoomComp(rc);
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
  
  // Normalizing `byDay` handles discrepancies if the API returns an Object instead of an Array, 
  // or if it returns { count: X } instead of { sessions: X }. This guarantees the BarChart renders.
  const rawDayData = dist?.byDay;
  const dayArray = Array.isArray(rawDayData) 
    ? rawDayData 
    : (typeof rawDayData === 'object' && rawDayData !== null) 
      ? Object.entries(rawDayData).map(([k, v]) => ({ day: k, count: v })) 
      : [];

  const dayData = dayArray.map(d => {
    const rawDay = String(d.day || d.name || "Unknown");
    const day = rawDay.charAt(0).toUpperCase() + rawDay.slice(1).toLowerCase(); // Match DAY_COLORS
    const sessions = d.sessions ?? d.count ?? d.value ?? (typeof d.count === 'number' ? d.count : 0);
    return { ...d, day, sessions };
  });
  
  const roomData     = (dist?.roomUtilisation ?? []).slice(0, 8);
  const workloadRows = useMemo(() => (wl ?? []).map(enrichWorkload), [wl]);

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

  // ── Render ────────────────────────────────────────────────────────────────
  return (
    <div className="page" style={{ padding: "24px 32px", background: "var(--bg)", minHeight: "100%", display: "flex", flexDirection: "column", gap: 24, fontFamily: "'Inter', sans-serif" }}>
      {TourElement}
      <style>{ANALYTICS_STYLE}</style>

      {/* ── Top control bar ── */}
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 12 }}>
        <div id="tour-analytics-source" style={{ display: "flex", alignItems: "center", gap: 8 }}>
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

        {/* Refresh button */}
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
      <div id="tour-analytics-stats" style={{ display: "grid", gridTemplateColumns: "repeat(4, 1fr)", gap: 14 }}>

        {/* Assigned Sessions */}
        <StatCard
          label="Assigned Sessions" sub={`of ${dist?.totalSessions ?? 0} total`}
          value={loading ? null : (dist?.facultyCoverage?.covered ?? 0)}
          color={C.green} bg="var(--meadow-soft)" loading={loading}
          icon={<svg width="19" height="19" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M22 11.08V12a10 10 0 1 1-5.93-9.14"/><polyline points="22 4 12 14.01 9 11.01"/></svg>}
        />

        {/* Faculty Coverage */}
        <StatCard
          label="Faculty Coverage" sub="Instructors assigned"
          value={loading ? null : `${dist?.facultyCoverage?.pct ?? 0}%`}
          color={C.blue} bg='rgba(59, 130, 246, 0.1)' loading={loading}
          icon={<svg width="19" height="19" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2"/><circle cx="9" cy="7" r="4"/><path d="M23 21v-2a4 4 0 0 0-3-3.87"/><path d="M16 3.13a4 4 0 0 1 0 7.75"/></svg>}
        />

        {/* TBA / Unassigned */}
        <StatCard
          label="TBA / Unassigned" sub="Sessions missing faculty"
          value={loading ? null : (quality?.tbaSessions ?? 0)}
          color={C.amber} bg='rgba(217, 119, 6, 0.1)' loading={loading}
          icon={<svg width="19" height="19" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><circle cx="12" cy="12" r="10"/><line x1="12" y1="8" x2="12" y2="12"/><line x1="12" y1="16" x2="12.01" y2="16"/></svg>}
        />

        {/* Hard Conflicts */}
        <StatCard
          label="Hard Conflicts" sub="Room / faculty time clashes"
          value={loading ? null : (quality?.totalConflicts ?? 0)}
          color={C.red} bg='rgba(220, 38, 38, 0.1)' loading={loading}
          icon={<svg width="19" height="19" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><polygon points="7.86 2 16.14 2 22 7.86 22 16.14 16.14 22 7.86 22 2 16.14 2 7.86 7.86 2"/><line x1="12" y1="8" x2="12" y2="12"/><line x1="12" y1="16" x2="12.01" y2="16"/></svg>}
        />
      </div>

      {/* ── Coverage insight + Optimization Score row ── */}
      <div id="tour-analytics-score" style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 14 }}>
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
          specMatchPct={quality?.specMatchPct ?? null}
        />
      </div>

      {/* ── SECTION 2: Academic Composition ── */}
      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 16 }}>

        {/* Program Distribution */}
        <Card>
          <CardHeader
            id="tour-analytics-composition"
            title="Distribution by Program"
            subtitle="Session count per academic program"
          />
          <div style={{ padding: "18px", minHeight: 320 }}>
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

        {/* Lecture vs Lab */}
        <Card>
          <CardHeader
            title="Lecture vs. Laboratory"
            subtitle="Ratio of theoretical to practical sessions"
          />
          <div style={{ padding: "18px", minHeight: 320 }}>
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

      {/* ── SECTION 3: Daily volume + busiest hours ── */}
      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 16 }}>
      <Card id="tour-analytics-daily">
        <CardHeader
          title="Daily Session Volume"
          subtitle="Number of scheduled sessions per weekday"
        />
        <div style={{ padding: "18px", minHeight: 340 }}>
          {loading ? (
            <SectionSkel rows={4} />
          ) : (
            <>
              <ResponsiveContainer width="100%" height={260}>
                <BarChart data={dayData} margin={{ top: 20, right: 8, left: 0, bottom: 8 }}>
                  <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="var(--hover)" />
                  <XAxis
                    dataKey="day" axisLine={false} tickLine={false}
                    tick={{ fill: "var(--muted)", fontSize: 12, fontFamily: "Poppins", dy: 8 }}
                  />
                  <YAxis
                    axisLine={false} tickLine={false}
                    tick={{ fill: "var(--muted2)", fontSize: 11, fontFamily: "Poppins" }}
                  />
                  <Tooltip cursor={{ fill: "rgba(0,0,0,0.04)" }} content={<StandardTooltip />} />
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

        <HeatmapCard cells={dist?.heatmap ?? []} days={dayData.map(d => d.day)} loading={loading} />
      </div>

      {/* ── SECTION 4: Faculty unit cap (every faculty member) ── */}
      <UnitCapCard rows={workloadRows} loading={loading} />

      {/* ── SECTION 5: Faculty satisfaction ── */}
      <SatisfactionCard sat={sat} loading={loading} />

      {/* ── SECTION 6: Assigned room compliance ── */}
      <RoomComplianceCard data={roomComp} loading={loading} />

      {/* ── SECTION 7: Rooms + unassigned courses ── */}
      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 16 }}>
        {/* Room Utilization */}
        <Card>
          <CardHeader
            title="Most Utilized Rooms"
            subtitle="Top rooms by total sessions assigned"
          />
          <div style={{ padding: "18px", minHeight: Math.max(220, roomData.length * 34) + 60 }}>
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
                    <Tooltip cursor={{ fill: "rgba(0,0,0,0.04)" }} contentStyle={TooltipStyle} />
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
        <UnassignedCard courses={dist?.tbaCourses ?? []} loading={loading} />
      </div>
    </div>
  );
}