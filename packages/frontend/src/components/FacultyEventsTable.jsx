import React, { useState, useMemo } from 'react';

// ─── Lavender & White Theme Tokens ────────────────────────────────────────────
const T = {
  purple:       '#7C6FCD',
  purpleDeep:   '#5a4fbf',
  purpleSoft:   '#EEEAFB',
  purpleBorder: '#D8D3F5',
  textMain:     '#1a1a2e',
  textMid:      '#4a4a6a',
  textMuted:    '#8883B0',
  textLight:    '#B0ABCC',
  border:       '#E8E4F8',
  borderLight:  '#F5F4FB',
  bg:           '#FFFFFF',
  bgAlt:        '#FAFAFE',
  danger:       '#EF4444',
  dangerSoft:   '#FEF2F2',
};

const SESSION_STYLE = {
  Lecture:    { bg: T.bgAlt,      color: T.textMid,    label: 'Lecture' },
  Lab:        { bg: T.purpleSoft, color: T.purpleDeep, label: 'Lab'     },
  Laboratory: { bg: T.purpleSoft, color: T.purpleDeep, label: 'Lab'     },
};

function getSessionStyle(session) {
  if (!session) return null;
  const key = Object.keys(SESSION_STYLE).find(k =>
    session.toLowerCase().includes(k.toLowerCase())
  );
  return key ? SESSION_STYLE[key] : { bg: T.bgAlt, color: T.textMid, label: session };
}

const Icon = {
  clock:    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><circle cx="12" cy="12" r="10"/><polyline points="12 6 12 12 16 14"/></svg>,
  room:     <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M3 9l9-7 9 7v11a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z"/><polyline points="9 22 9 12 15 12 15 22"/></svg>,
  group:    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><rect x="3" y="3" width="18" height="4" rx="2"/><rect x="3" y="10" width="18" height="4" rx="2"/><rect x="3" y="17" width="18" height="4" rx="2"/></svg>,
  filter:   <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><polygon points="22 3 2 3 10 12.46 10 19 14 21 14 12.46 22 3"/></svg>,
  download: <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/><polyline points="7 10 12 15 17 10"/><line x1="12" y1="15" x2="12" y2="3"/></svg>,
};

const COLUMNS = [
  { key: 'courseCode', label: 'Course' },
  { key: 'title',      label: 'Title'  },
  { key: 'session',    label: 'Type'   },
  { key: 'class',      label: 'Class'  },
  { key: 'day',        label: 'Day'    },
  { key: 'period',     label: 'Time'   },
  { key: 'room',       label: 'Room'   },
  { key: 'units',      label: 'Units'  },
];

const DAY_ORDER = { Monday:1, Tuesday:2, Wednesday:3, Thursday:4, Friday:5, Saturday:6, Sunday:7 };

function parseTime(periodStr) {
  if (!periodStr) return 9999;
  const match = periodStr.match(/(\d{1,2}):(\d{2})\s*(AM|PM|am|pm)?/);
  if (!match) return 9999;
  let h = parseInt(match[1], 10);
  let m = parseInt(match[2], 10);
  let ampm = match[3] ? match[3].toLowerCase() : null;
  if (ampm === 'pm' && h < 12) h += 12;
  if (ampm === 'am' && h === 12) h = 0;
  return h * 60 + m;
}

// ─── Shared UI ────────────────────────────────────────────────────────────────
function EmptyState({ fetchError }) {
  return (
    <div style={{ display:'flex', flexDirection:'column', alignItems:'center', justifyContent:'center', padding:'64px 24px', gap:16 }}>
      <div style={{ width:48, height:48, borderRadius:'12px', background: fetchError ? T.dangerSoft : T.bgAlt, color: fetchError ? T.danger : T.textMuted, display:'flex', alignItems:'center', justifyContent:'center', border:`1px solid ${fetchError ? '#FECACA' : T.border}` }}>
        {fetchError
          ? <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><circle cx="12" cy="12" r="10"/><line x1="12" y1="8" x2="12" y2="12"/><line x1="12" y1="16" x2="12.01" y2="16"/></svg>
          : <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><rect x="3" y="4" width="18" height="18" rx="2" ry="2"/><line x1="16" y1="2" x2="16" y2="6"/><line x1="8" y1="2" x2="8" y2="6"/><line x1="3" y1="10" x2="21" y2="10"/></svg>
        }
      </div>
      <div style={{ textAlign:'center' }}>
        <h3 style={{ fontSize:15, fontWeight:600, color:T.textMain, margin:'0 0 4px 0' }}>
          {fetchError ? 'Failed to load schedule' : 'No classes scheduled'}
        </h3>
        <p style={{ fontSize:13, color:T.textMuted, margin:0 }}>
          {fetchError ? 'There was a problem fetching this data. Please refresh.' : 'This faculty has no assigned classes in this view.'}
        </p>
      </div>
    </div>
  );
}

function SessionBadge({ session }) {
  if (!session) return <span style={{ color: T.textLight }}>—</span>;
  const s = getSessionStyle(session);
  return (
    <span style={{ display:'inline-flex', padding:'3px 10px', borderRadius:'6px', background:s.bg, color:s.color, fontSize:12, fontWeight:600 }}>
      {s.label}
    </span>
  );
}

function ClassCell({ event }) {
  const parts = [event.program, event.year && `Y${event.year}`, event.block].filter(Boolean);
  if (parts.length === 0) return <span style={{ color: T.textLight }}>—</span>;
  return <span style={{ fontSize:13, color:T.textMid, fontWeight:500 }}>{parts.join(' ')}</span>;
}

function GroupHeader({ label, count }) {
  return (
    <div style={{ padding:'12px 20px', background:T.bgAlt, borderBottom:`1px solid ${T.border}`, display:'flex', justifyContent:'space-between', alignItems:'center' }}>
      <div style={{ display:'flex', alignItems:'center', gap:8 }}>
        <span style={{ width:6, height:6, borderRadius:'50%', background:T.purple }}></span>
        <span style={{ fontSize:14, fontWeight:600, color:T.textMain }}>{label}</span>
      </div>
      <span style={{ fontSize:12, color:T.textMuted, fontWeight:600 }}>{count} {count === 1 ? 'class' : 'classes'}</span>
    </div>
  );
}

// ─── Main Component ───────────────────────────────────────────────────────────
/**
 * @param {object[]} events
 * @param {function} computeUnits
 * @param {boolean}  fetchError
 * @param {function} onExport   – called with the events array to export;
 *                                provided by ScheduleSection (handles naming + xlsx write)
 */
const FacultyEventsTable = ({ events, computeUnits, fetchError, onExport }) => {
  const [groupBy,    setGroupBy]    = useState(false);
  const [filterDay,  setFilterDay]  = useState('');
  const [exporting,  setExporting]  = useState(false);

  const isEmpty = !events || events.length === 0;

  const allDays = useMemo(() => {
    if (!events) return [];
    return [...new Set(events.map(e => e.day).filter(Boolean))]
      .sort((a, b) => (DAY_ORDER[a] || 99) - (DAY_ORDER[b] || 99));
  }, [events]);

  const processed = useMemo(() => {
    if (!events) return [];
    let arr = [...events];
    if (filterDay) arr = arr.filter(e => e.day === filterDay);
    arr.sort((a, b) => {
      const cmp = (DAY_ORDER[a.day] || 99) - (DAY_ORDER[b.day] || 99);
      return cmp !== 0 ? cmp : parseTime(a.period) - parseTime(b.period);
    });
    return arr;
  }, [events, filterDay]);

  const grouped = useMemo(() => {
    if (!groupBy) return null;
    const map = {};
    processed.forEach(e => {
      const k = e.day || 'Unscheduled';
      if (!map[k]) map[k] = [];
      map[k].push(e);
    });
    return Object.entries(map).sort(([a], [b]) => (DAY_ORDER[a] || 99) - (DAY_ORDER[b] || 99));
  }, [processed, groupBy]);

  /* ── Handle export of filtered view ──────────────────────────────────────── */
  async function handleExportView() {
    if (!onExport || !processed.length || exporting) return
    setExporting(true)
    try {
      await onExport(processed)
    } finally {
      setExporting(false)
    }
  }

  // ─── Toolbar ──────────────────────────────────────────────────────────────
  const Toolbar = () => (
    <div style={{
      padding:'12px 20px', borderBottom:`1px solid ${T.border}`,
      display:'flex', alignItems:'center', justifyContent:'space-between', gap:16,
      background:T.bg, flexWrap:'wrap'
    }}>
      {/* Left: day filter pills */}
      <div style={{ display:'flex', alignItems:'center', gap:8, flexWrap:'wrap' }}>
        <span style={{ display:'flex', alignItems:'center', gap:6, color:T.textMuted, fontSize:13, fontWeight:600, marginRight:8 }}>
          {Icon.filter} Filter
        </span>
        <button
          onClick={() => setFilterDay('')}
          style={{ padding:'6px 14px', borderRadius:'99px', fontSize:12, fontWeight:600, cursor:'pointer', border:'1px solid', transition:'all 0.2s', background:!filterDay ? T.purpleSoft : 'transparent', borderColor:!filterDay ? T.purpleBorder : T.border, color:!filterDay ? T.purpleDeep : T.textMuted, fontFamily:"'Poppins', sans-serif" }}
        >All</button>
        {allDays.map(d => {
          const active = filterDay === d;
          return (
            <button key={d} onClick={() => setFilterDay(d === filterDay ? '' : d)} style={{ padding:'6px 14px', borderRadius:'99px', fontSize:12, fontWeight:600, cursor:'pointer', border:'1px solid', transition:'all 0.2s', background:active ? T.purpleSoft : 'transparent', borderColor:active ? T.purpleBorder : T.border, color:active ? T.purpleDeep : T.textMuted, fontFamily:"'Poppins', sans-serif" }}>
              {d.slice(0, 3)}
            </button>
          );
        })}
      </div>

      {/* Right: group + export */}
      <div style={{ display:'flex', alignItems:'center', gap:8 }}>
        <button
          onClick={() => setGroupBy(v => !v)}
          style={{ display:'inline-flex', alignItems:'center', gap:6, padding:'6px 12px', borderRadius:'8px', fontSize:12, fontWeight:600, border:`1px solid ${groupBy ? T.purpleBorder : T.border}`, background:groupBy ? T.purpleSoft : T.bgAlt, color:groupBy ? T.purpleDeep : T.textMuted, cursor:'pointer', transition:'all 0.2s', fontFamily:"'Poppins', sans-serif" }}
        >
          {Icon.group} Group by Day
        </button>

        {/* Export current view button */}
        {onExport && processed.length > 0 && (
          <button
            onClick={handleExportView}
            disabled={exporting}
            title={filterDay ? `Export ${filterDay} view to Excel` : 'Export current view to Excel'}
            style={{
              display:'inline-flex', alignItems:'center', gap:6,
              padding:'6px 12px', borderRadius:'8px', fontSize:12, fontWeight:600,
              border:`1px solid ${T.purpleBorder}`,
              background: exporting ? T.bgAlt : T.purpleSoft,
              color: exporting ? T.textMuted : T.purpleDeep,
              cursor: exporting ? 'default' : 'pointer',
              transition:'all 0.2s', fontFamily:"'Poppins', sans-serif",
              opacity: exporting ? 0.7 : 1,
            }}
            onMouseEnter={e => { if (!exporting) e.currentTarget.style.borderColor = T.purple }}
            onMouseLeave={e => { e.currentTarget.style.borderColor = T.purpleBorder }}
          >
            {exporting
              ? <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" style={{ animation:'spin 0.8s linear infinite' }}><path d="M21 12a9 9 0 1 1-6.219-8.56"/></svg>
              : Icon.download
            }
            {filterDay ? `Export ${filterDay.slice(0, 3)}` : 'Export View'}
          </button>
        )}
      </div>
    </div>
  );

  // ─── Table ────────────────────────────────────────────────────────────────
  const Th = ({ col }) => (
    <th style={{ padding:'14px 20px', fontSize:11, fontWeight:700, textTransform:'uppercase', letterSpacing:'0.05em', whiteSpace:'nowrap', color:T.textMuted, borderBottom:`2px solid ${T.border}`, userSelect:'none', textAlign:'left', background:T.bgAlt }}>
      {col.label}
    </th>
  );

  const TR = ({ event }) => {
    const units = computeUnits(event);
    const [hovered, setHovered] = useState(false);
    return (
      <tr onMouseEnter={() => setHovered(true)} onMouseLeave={() => setHovered(false)} style={{ background: hovered ? T.bgAlt : T.bg, transition:'background 0.15s' }}>
        <td style={{ padding:'14px 20px', borderBottom:`1px solid ${T.borderLight}` }}>
          <span style={{ fontSize:13, fontWeight:700, color:T.purpleDeep }}>{event.courseCode}</span>
        </td>
        <td style={{ padding:'14px 20px', borderBottom:`1px solid ${T.borderLight}`, maxWidth:220 }}>
          <span style={{ fontSize:13, fontWeight:500, color:T.textMain, whiteSpace:'nowrap', overflow:'hidden', textOverflow:'ellipsis', display:'block' }}>
            {event.title || '—'}
          </span>
        </td>
        <td style={{ padding:'14px 20px', borderBottom:`1px solid ${T.borderLight}` }}>
          <SessionBadge session={event.session} />
        </td>
        <td style={{ padding:'14px 20px', borderBottom:`1px solid ${T.borderLight}` }}>
          <ClassCell event={event} />
        </td>
        <td style={{ padding:'14px 20px', borderBottom:`1px solid ${T.borderLight}` }}>
          <span style={{ fontSize:13, color:T.textMid, fontWeight:500 }}>{event.day || '—'}</span>
        </td>
        <td style={{ padding:'14px 20px', borderBottom:`1px solid ${T.borderLight}` }}>
          <span style={{ fontSize:13, color:T.textMid }}>{event.period || '—'}</span>
        </td>
        <td style={{ padding:'14px 20px', borderBottom:`1px solid ${T.borderLight}` }}>
          <span style={{ fontSize:13, color:T.textMain, fontWeight:600 }}>{event.room || '—'}</span>
        </td>
        <td style={{ padding:'14px 20px', borderBottom:`1px solid ${T.borderLight}`, color:T.textMuted, fontSize:13, fontWeight:600 }}>
          {units === '—' || units == null ? '—' : units}
        </td>
      </tr>
    );
  };

  // ─── Render ───────────────────────────────────────────────────────────────
  if (isEmpty) return <EmptyState fetchError={fetchError} />;

  const renderTable = (evts) => (
    <div style={{ overflowX:'auto' }}>
      <table style={{ width:'100%', borderCollapse:'collapse', textAlign:'left' }}>
        <thead><tr>{COLUMNS.map(col => <Th key={col.key} col={col} />)}</tr></thead>
        <tbody>{evts.map(e => <TR key={e.schedule_id ?? `${e.courseCode}-${e.day}-${e.period}`} event={e} />)}</tbody>
      </table>
    </div>
  );

  return (
    <div style={{ fontFamily:"'Poppins', sans-serif" }}>
      <style>{`@keyframes spin { 100% { transform: rotate(360deg); } }`}</style>
      <Toolbar />
      {groupBy && grouped
        ? grouped.map(([day, evts]) => (
            <div key={day}>
              <GroupHeader label={day} count={evts.length} />
              {renderTable(evts)}
            </div>
          ))
        : renderTable(processed)
      }
    </div>
  );
};

export default FacultyEventsTable;