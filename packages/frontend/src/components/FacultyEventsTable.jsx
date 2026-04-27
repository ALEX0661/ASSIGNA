import React, { useState, useMemo } from 'react';

// ─── Design tokens (match FacultyDetailPage) ──────────────────────────────────
const T = {
  purple:     '#7C6FCD',
  purpleDeep: '#5a4fbf',
  purpleSoft: '#EEEAFB',
  purpleBorder:'#D8D3F5',
  text:       '#1a1a2e',
  textMid:    '#4a4a6a',
  muted:      '#8883B0',
  mutedLight: '#B0ABCC',
  border:     '#E8E4F8',
  bg:         '#FAFAFE',
  bgCard:     '#fff',
  green:      '#059669',
  greenSoft:  '#E6FAF3',
  blue:       '#2563EB',
  blueSoft:   '#EBF0FF',
  amber:      '#D97706',
  amberSoft:  '#FEF3CD',
  red:        '#C0392B',
  redSoft:    '#FFE8E8',
  teal:       '#0891B2',
  tealSoft:   '#E0F7FA',
  pink:       '#BE185D',
  pinkSoft:   '#FCE7F3',
};

// ─── Day colour palette ───────────────────────────────────────────────────────
const DAY_COLORS = {
  Monday:    { bg: '#EBF0FF', color: '#2563EB', dot: '#2563EB' },
  Tuesday:   { bg: '#FEF3CD', color: '#92400E', dot: '#D97706' },
  Wednesday: { bg: '#E6FAF3', color: '#065F46', dot: '#059669' },
  Thursday:  { bg: T.purpleSoft, color: T.purpleDeep, dot: T.purple },
  Friday:    { bg: T.redSoft,   color: T.red,          dot: T.red    },
  Saturday:  { bg: T.tealSoft,  color: '#0E7490',      dot: T.teal   },
  Sunday:    { bg: T.pinkSoft,  color: T.pink,         dot: T.pink   },
};

// ─── Session badge ─────────────────────────────────────────────────────────────
const SESSION_STYLE = {
  Lecture: { bg: T.blueSoft,  color: T.blue,  label: 'Lecture' },
  Lab:     { bg: T.greenSoft, color: T.green, label: 'Lab'     },
  Laboratory: { bg: T.greenSoft, color: T.green, label: 'Lab'  },
};

function getDayStyle(day) {
  return DAY_COLORS[day] || { bg: '#F5F4FB', color: T.muted, dot: T.mutedLight };
}

function getSessionStyle(session) {
  if (!session) return null;
  const key = Object.keys(SESSION_STYLE).find(k =>
    session.toLowerCase().includes(k.toLowerCase())
  );
  return key ? SESSION_STYLE[key] : { bg: T.purpleSoft, color: T.purple, label: session };
}

// ─── Tiny icon helpers ────────────────────────────────────────────────────────
const Icon = {
  clock:  <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><circle cx="12" cy="12" r="10"/><polyline points="12 6 12 12 16 14"/></svg>,
  room:   <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M3 9l9-7 9 7v11a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z"/><polyline points="9 22 9 12 15 12 15 22"/></svg>,
  book:   <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M4 19.5A2.5 2.5 0 0 1 6.5 17H20"/><path d="M6.5 2H20v20H6.5A2.5 2.5 0 0 1 4 19.5v-15A2.5 2.5 0 0 1 6.5 2z"/></svg>,
  users:  <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2"/><circle cx="9" cy="7" r="4"/><path d="M23 21v-2a4 4 0 0 0-3-3.87"/><path d="M16 3.13a4 4 0 0 1 0 7.75"/></svg>,
  units:  <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><polygon points="12 2 15.09 8.26 22 9.27 17 14.14 18.18 21.02 12 17.77 5.82 21.02 7 14.14 2 9.27 8.91 8.26 12 2"/></svg>,
  sort:   (dir) => (
    <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"
      style={{ opacity: dir ? 1 : 0.35, transition: 'all 0.15s', transform: dir === 'desc' ? 'rotate(180deg)' : 'none' }}>
      <polyline points="18 15 12 9 6 15"/>
    </svg>
  ),
  grid:   <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><rect x="3" y="3" width="7" height="7"/><rect x="14" y="3" width="7" height="7"/><rect x="3" y="14" width="7" height="7"/><rect x="14" y="14" width="7" height="7"/></svg>,
  list:   <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><line x1="8" y1="6" x2="21" y2="6"/><line x1="8" y1="12" x2="21" y2="12"/><line x1="8" y1="18" x2="21" y2="18"/><line x1="3" y1="6" x2="3.01" y2="6"/><line x1="3" y1="12" x2="3.01" y2="12"/><line x1="3" y1="18" x2="3.01" y2="18"/></svg>,
  group:  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><rect x="3" y="3" width="18" height="4" rx="1"/><rect x="3" y="10" width="18" height="4" rx="1"/><rect x="3" y="17" width="18" height="4" rx="1"/></svg>,
};

// ─── Column definitions ───────────────────────────────────────────────────────
const COLUMNS = [
  { key: 'courseCode',  label: 'Course',    sortable: true  },
  { key: 'title',       label: 'Title',     sortable: true  },
  { key: 'session',     label: 'Session',   sortable: true  },
  { key: 'class',       label: 'Class',     sortable: false },   // program + year + block combined
  { key: 'day',         label: 'Day',       sortable: true  },
  { key: 'period',      label: 'Time',      sortable: true  },
  { key: 'room',        label: 'Room',      sortable: true  },
  { key: 'units',       label: 'Units',     sortable: true  },
];

// ─── Empty State ──────────────────────────────────────────────────────────────
function EmptyState({ fetchError }) {
  return (
    <div style={{
      display: 'flex', flexDirection: 'column', alignItems: 'center',
      justifyContent: 'center', padding: '48px 24px', gap: 14,
    }}>
      {fetchError ? (
        <>
          <div style={{
            width: 56, height: 56, borderRadius: '50%', background: T.redSoft,
            display: 'flex', alignItems: 'center', justifyContent: 'center',
          }}>
            <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke={T.red} strokeWidth="1.8">
              <circle cx="12" cy="12" r="10"/>
              <line x1="12" y1="8" x2="12" y2="12"/>
              <line x1="12" y1="16" x2="12.01" y2="16"/>
            </svg>
          </div>
          <div style={{ textAlign: 'center' }}>
            <div style={{ fontSize: 14, fontWeight: 700, color: T.red, marginBottom: 4 }}>
              Couldn't load schedule
            </div>
            <div style={{ fontSize: 12.5, color: T.muted, lineHeight: 1.5 }}>
              There was a problem fetching this faculty's schedule.<br/>Please try refreshing the page.
            </div>
          </div>
        </>
      ) : (
        <>
          {/* Illustrated calendar SVG */}
          <svg width="72" height="72" viewBox="0 0 72 72" fill="none">
            <rect x="6" y="14" width="60" height="52" rx="8" fill={T.purpleSoft} stroke={T.purpleBorder} strokeWidth="1.5"/>
            <rect x="6" y="14" width="60" height="16" rx="8" fill={T.border}/>
            <rect x="6" y="22" width="60" height="8" fill={T.border}/>
            <line x1="20" y1="6" x2="20" y2="20" stroke={T.muted} strokeWidth="3" strokeLinecap="round"/>
            <line x1="52" y1="6" x2="52" y2="20" stroke={T.muted} strokeWidth="3" strokeLinecap="round"/>
            {/* empty day dots */}
            {[
              [20,44],[36,44],[52,44],
              [20,56],[36,56],[52,56],
            ].map(([cx, cy], i) => (
              <circle key={i} cx={cx} cy={cy} r="3.5" fill={T.purpleBorder}/>
            ))}
          </svg>
          <div style={{ textAlign: 'center' }}>
            <div style={{ fontSize: 14, fontWeight: 700, color: T.textMid, marginBottom: 4 }}>
              No classes scheduled
            </div>
            <div style={{ fontSize: 12.5, color: T.mutedLight, lineHeight: 1.5 }}>
              This faculty has no assigned classes<br/>in the selected schedule.
            </div>
          </div>
        </>
      )}
    </div>
  );
}

// ─── Day Badge ────────────────────────────────────────────────────────────────
function DayBadge({ day }) {
  if (!day) return <span style={{ color: T.mutedLight, fontSize: 12 }}>—</span>;
  const s = getDayStyle(day);
  return (
    <span style={{
      display: 'inline-flex', alignItems: 'center', gap: 5,
      padding: '3px 9px', borderRadius: 99,
      background: s.bg, color: s.color,
      fontSize: 11.5, fontWeight: 700, whiteSpace: 'nowrap',
      fontFamily: "'Poppins', sans-serif",
    }}>
      <span style={{ width: 6, height: 6, borderRadius: '50%', background: s.dot, flexShrink: 0 }}/>
      {day.slice(0, 3)}
    </span>
  );
}

// ─── Session Badge ────────────────────────────────────────────────────────────
function SessionBadge({ session }) {
  if (!session) return <span style={{ color: T.mutedLight, fontSize: 12 }}>—</span>;
  const s = getSessionStyle(session);
  return (
    <span style={{
      display: 'inline-block', padding: '3px 9px', borderRadius: 99,
      background: s.bg, color: s.color,
      fontSize: 11, fontWeight: 700,
      fontFamily: "'Poppins', sans-serif",
    }}>
      {s.label}
    </span>
  );
}

// ─── Units Badge ──────────────────────────────────────────────────────────────
function UnitsBadge({ units }) {
  const val = units === '—' || units == null ? '—' : units;
  return (
    <span style={{
      display: 'inline-flex', alignItems: 'center', justifyContent: 'center',
      width: 32, height: 26, borderRadius: 8,
      background: val !== '—' ? T.purpleSoft : '#F5F4FB',
      color: val !== '—' ? T.purple : T.mutedLight,
      fontSize: 12.5, fontWeight: 700,
      fontFamily: "'Poppins', sans-serif",
    }}>
      {val}
    </span>
  );
}

// ─── Class Cell (program + year + block) ──────────────────────────────────────
function ClassCell({ event }) {
  const parts = [event.program, event.year && `Y${event.year}`, event.block].filter(Boolean);
  if (parts.length === 0) return <span style={{ color: T.mutedLight, fontSize: 12 }}>—</span>;
  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 5, flexWrap: 'wrap' }}>
      {event.program && (
        <span style={{
          padding: '2px 7px', borderRadius: 6,
          background: T.amberSoft, color: T.amber,
          fontSize: 10.5, fontWeight: 700,
        }}>{event.program}</span>
      )}
      {(event.year || event.block) && (
        <span style={{ fontSize: 12, color: T.textMid, fontWeight: 600 }}>
          {[event.year && `Y${event.year}`, event.block].filter(Boolean).join(' • ')}
        </span>
      )}
    </div>
  );
}

// ─── Event Card (card view) ───────────────────────────────────────────────────
function EventCard({ event, computeUnits }) {
  const units   = computeUnits(event);
  const dayS    = getDayStyle(event.day);
  const sessS   = getSessionStyle(event.session);

  return (
    <div style={{
      background: T.bgCard, borderRadius: 14,
      border: `1.5px solid ${T.border}`,
      padding: '14px 16px',
      display: 'flex', flexDirection: 'column', gap: 10,
      transition: 'box-shadow 0.15s, border-color 0.15s',
      cursor: 'default',
    }}
      onMouseEnter={e => {
        e.currentTarget.style.boxShadow = `0 4px 20px rgba(124,111,205,0.14)`;
        e.currentTarget.style.borderColor = T.purpleBorder;
      }}
      onMouseLeave={e => {
        e.currentTarget.style.boxShadow = 'none';
        e.currentTarget.style.borderColor = T.border;
      }}
    >
      {/* Top row: course code + session badge + units */}
      <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: 8 }}>
        <div style={{ flex: 1, minWidth: 0 }}>
          <span style={{
            display: 'inline-block', padding: '2px 9px', borderRadius: 7,
            background: T.purpleSoft, color: T.purple, border: `1px solid ${T.purpleBorder}`,
            fontSize: 11.5, fontWeight: 800, letterSpacing: '.3px',
            fontFamily: "'Poppins', sans-serif",
          }}>
            {event.courseCode}
          </span>
          <div style={{
            fontSize: 13, fontWeight: 600, color: T.text, marginTop: 6,
            lineHeight: 1.35, overflow: 'hidden', textOverflow: 'ellipsis',
            display: '-webkit-box', WebkitLineClamp: 2, WebkitBoxOrient: 'vertical',
          }}>
            {event.title || event.courseCode}
          </div>
        </div>
        <UnitsBadge units={units} />
      </div>

      {/* Middle row: session + class info */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
        {sessS && <SessionBadge session={event.session} />}
        <ClassCell event={event} />
      </div>

      {/* Bottom row: day + time + room */}
      <div style={{
        display: 'grid', gridTemplateColumns: 'auto 1fr auto',
        alignItems: 'center', gap: 8,
        paddingTop: 10,
        borderTop: `1px solid ${T.border}`,
      }}>
        <DayBadge day={event.day} />

        <div style={{ display: 'flex', alignItems: 'center', gap: 4, color: T.muted, fontSize: 12, minWidth: 0 }}>
          <span style={{ color: T.mutedLight, flexShrink: 0 }}>{Icon.clock}</span>
          <span style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', fontWeight: 500 }}>
            {event.period || '—'}
          </span>
        </div>

        {event.room && (
          <div style={{ display: 'flex', alignItems: 'center', gap: 4, color: T.muted, fontSize: 12, flexShrink: 0 }}>
            <span style={{ color: T.mutedLight }}>{Icon.room}</span>
            <span style={{ fontWeight: 600, color: T.textMid }}>{event.room}</span>
          </div>
        )}
      </div>
    </div>
  );
}

// ─── Group header row ──────────────────────────────────────────────────────────
function GroupHeader({ label, count }) {
  const s = getDayStyle(label);
  return (
    <div style={{
      display: 'flex', alignItems: 'center', gap: 10,
      padding: '10px 16px',
      background: s.bg,
      borderBottom: `1.5px solid ${T.border}`,
    }}>
      <span style={{
        width: 8, height: 8, borderRadius: '50%',
        background: s.dot, flexShrink: 0,
      }}/>
      <span style={{ fontSize: 12, fontWeight: 700, color: s.color, fontFamily: "'Poppins', sans-serif" }}>
        {label}
      </span>
      <span style={{
        marginLeft: 'auto', padding: '1px 8px', borderRadius: 99,
        background: 'rgba(0,0,0,0.06)', color: s.color,
        fontSize: 10.5, fontWeight: 700,
      }}>
        {count} {count === 1 ? 'class' : 'classes'}
      </span>
    </div>
  );
}

// ─── Summary footer ───────────────────────────────────────────────────────────
function SummaryFooter({ events, computeUnits }) {
  const totalUnits = events
    .map(e => computeUnits(e))
    .filter(u => typeof u === 'number')
    .reduce((s, u) => s + u, 0);

  const lectureCount = events.filter(e => (e.session || '').toLowerCase().includes('lecture')).length;
  const labCount     = events.filter(e => (e.session || '').toLowerCase().includes('lab')).length;
  const days         = [...new Set(events.map(e => e.day).filter(Boolean))];

  const stat = (icon, label, value, color = T.muted) => (
    <div style={{
      display: 'flex', alignItems: 'center', gap: 7,
      padding: '8px 14px', borderRadius: 10,
      background: T.bg, border: `1.5px solid ${T.border}`,
    }}>
      <span style={{ color: T.mutedLight }}>{icon}</span>
      <div>
        <div style={{ fontSize: 15, fontWeight: 800, color, lineHeight: 1, fontFamily: "'Poppins', sans-serif" }}>
          {value}
        </div>
        <div style={{ fontSize: 10, color: T.mutedLight, fontWeight: 500, marginTop: 1 }}>
          {label}
        </div>
      </div>
    </div>
  );

  return (
    <div style={{
      padding: '12px 16px',
      borderTop: `1.5px solid ${T.border}`,
      display: 'flex', gap: 8, flexWrap: 'wrap', alignItems: 'center',
      background: T.bg,
    }}>
      {stat(Icon.units, 'Total Units', totalUnits, T.purple)}
      {stat(Icon.book,  'Total Classes', events.length, T.blue)}
      {lectureCount > 0 && stat(Icon.book, 'Lectures', lectureCount, T.blue)}
      {labCount     > 0 && stat(Icon.book, 'Labs',     labCount,     T.green)}
      {days.length  > 0 && (
        <div style={{
          display: 'flex', alignItems: 'center', gap: 6,
          padding: '8px 14px', borderRadius: 10,
          background: T.bg, border: `1.5px solid ${T.border}`,
          flexWrap: 'wrap',
        }}>
          <span style={{ fontSize: 10, color: T.mutedLight, fontWeight: 500, marginRight: 2 }}>Days</span>
          {days.map(d => <DayBadge key={d} day={d} />)}
        </div>
      )}
    </div>
  );
}

// ─── Toggle button ────────────────────────────────────────────────────────────
function ToggleBtn({ active, onClick, icon, label }) {
  return (
    <button onClick={onClick} title={label} style={{
      display: 'flex', alignItems: 'center', gap: 5,
      padding: '5px 11px', borderRadius: 8, fontSize: 12, fontWeight: 600,
      cursor: 'pointer', transition: 'all 0.15s',
      border: active ? 'none' : `1.5px solid ${T.border}`,
      background: active ? `linear-gradient(135deg,${T.purple},${T.purpleDeep})` : T.bgCard,
      color: active ? '#fff' : T.muted,
      boxShadow: active ? `0 2px 8px rgba(124,111,205,0.28)` : 'none',
      fontFamily: "'Poppins', sans-serif",
    }}>
      {icon}{label}
    </button>
  );
}

// ─── Main component ───────────────────────────────────────────────────────────
const FacultyEventsTable = ({ events, computeUnits, fetchError }) => {
  const [view,      setView]      = useState('table');    // 'table' | 'cards'
  const [groupBy,   setGroupBy]   = useState(false);      // group by day
  const [sortKey,   setSortKey]   = useState('day');
  const [sortDir,   setSortDir]   = useState('asc');
  const [filterDay, setFilterDay] = useState('');         // '' = all

  const isEmpty = !events || events.length === 0;

  // All unique days for the quick filter
  const allDays = useMemo(() => {
    if (!events) return [];
    return [...new Set(events.map(e => e.day).filter(Boolean))];
  }, [events]);

  // Sort + filter
  const processed = useMemo(() => {
    if (!events) return [];
    let arr = [...events];

    // Day filter
    if (filterDay) arr = arr.filter(e => e.day === filterDay);

    // Sort
    arr.sort((a, b) => {
      let av, bv;
      if (sortKey === 'units') {
        av = Number(computeUnits(a)) || 0;
        bv = Number(computeUnits(b)) || 0;
      } else {
        av = (a[sortKey] || '').toString().toLowerCase();
        bv = (b[sortKey] || '').toString().toLowerCase();
      }
      if (av < bv) return sortDir === 'asc' ? -1 : 1;
      if (av > bv) return sortDir === 'asc' ?  1 : -1;
      return 0;
    });

    return arr;
  }, [events, sortKey, sortDir, filterDay, computeUnits]);

  // Grouped by day
  const grouped = useMemo(() => {
    if (!groupBy) return null;
    const DAY_ORDER = ['Monday','Tuesday','Wednesday','Thursday','Friday','Saturday','Sunday'];
    const map = {};
    processed.forEach(e => {
      const k = e.day || 'Unscheduled';
      if (!map[k]) map[k] = [];
      map[k].push(e);
    });
    return Object.entries(map).sort(([a], [b]) => {
      const ai = DAY_ORDER.indexOf(a), bi = DAY_ORDER.indexOf(b);
      if (ai === -1 && bi === -1) return 0;
      if (ai === -1) return 1;
      if (bi === -1) return -1;
      return ai - bi;
    });
  }, [processed, groupBy]);

  function handleSort(key) {
    if (sortKey === key) setSortDir(d => d === 'asc' ? 'desc' : 'asc');
    else { setSortKey(key); setSortDir('asc'); }
  }

  // ── Column header ────────────────────────────────────────────────────────────
  const Th = ({ col }) => {
    const active = sortKey === col.key;
    return (
      <th
        onClick={col.sortable ? () => handleSort(col.key) : undefined}
        style={{
          padding: '10px 14px',
          fontSize: 11, fontWeight: 700, letterSpacing: '.5px',
          textTransform: 'uppercase', whiteSpace: 'nowrap',
          color: active ? T.purple : T.muted,
          background: active ? T.purpleSoft : T.bg,
          borderBottom: `2px solid ${active ? T.purpleBorder : T.border}`,
          cursor: col.sortable ? 'pointer' : 'default',
          userSelect: 'none',
          transition: 'all 0.15s',
          textAlign: 'left',
          fontFamily: "'Poppins', sans-serif",
        }}
        onMouseEnter={e => { if (col.sortable && !active) e.currentTarget.style.color = T.purple }}
        onMouseLeave={e => { if (!active) e.currentTarget.style.color = T.muted }}
      >
        <span style={{ display: 'inline-flex', alignItems: 'center', gap: 5 }}>
          {col.label}
          {col.sortable && Icon.sort(active ? sortDir : null)}
        </span>
      </th>
    );
  };

  // ── Table row ─────────────────────────────────────────────────────────────────
  const TR = ({ event }) => {
    const units = computeUnits(event);
    const [hovered, setHovered] = useState(false);
    return (
      <tr
        onMouseEnter={() => setHovered(true)}
        onMouseLeave={() => setHovered(false)}
        style={{
          background: hovered ? T.purpleSoft : 'transparent',
          transition: 'background 0.12s',
        }}
      >
        {/* Course code */}
        <td style={{ padding: '11px 14px', borderBottom: `1px solid ${T.border}` }}>
          <span style={{
            display: 'inline-block', padding: '2px 8px', borderRadius: 6,
            background: T.purpleSoft, color: T.purple, border: `1px solid ${T.purpleBorder}`,
            fontSize: 11.5, fontWeight: 800, letterSpacing: '.3px',
            fontFamily: "'Poppins', sans-serif",
          }}>
            {event.courseCode}
          </span>
        </td>

        {/* Title */}
        <td style={{ padding: '11px 14px', borderBottom: `1px solid ${T.border}`, maxWidth: 200 }}>
          <span style={{
            fontSize: 12.5, fontWeight: 600, color: T.text, lineHeight: 1.35,
            overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap',
            display: 'block',
          }}>
            {event.title || '—'}
          </span>
        </td>

        {/* Session */}
        <td style={{ padding: '11px 14px', borderBottom: `1px solid ${T.border}` }}>
          <SessionBadge session={event.session} />
        </td>

        {/* Class (program + year + block) */}
        <td style={{ padding: '11px 14px', borderBottom: `1px solid ${T.border}` }}>
          <ClassCell event={event} />
        </td>

        {/* Day */}
        <td style={{ padding: '11px 14px', borderBottom: `1px solid ${T.border}` }}>
          <DayBadge day={event.day} />
        </td>

        {/* Time */}
        <td style={{ padding: '11px 14px', borderBottom: `1px solid ${T.border}` }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 5, color: T.muted, fontSize: 12, whiteSpace: 'nowrap' }}>
            <span style={{ color: T.mutedLight }}>{Icon.clock}</span>
            <span style={{ fontWeight: 500, color: T.textMid }}>{event.period || '—'}</span>
          </div>
        </td>

        {/* Room */}
        <td style={{ padding: '11px 14px', borderBottom: `1px solid ${T.border}` }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 5, fontSize: 12 }}>
            <span style={{ color: T.mutedLight }}>{Icon.room}</span>
            <span style={{ fontWeight: 600, color: T.textMid }}>{event.room || '—'}</span>
          </div>
        </td>

        {/* Units */}
        <td style={{ padding: '11px 14px', borderBottom: `1px solid ${T.border}`, textAlign: 'center' }}>
          <UnitsBadge units={units} />
        </td>
      </tr>
    );
  };

  // ── Toolbar ───────────────────────────────────────────────────────────────────
  const Toolbar = () => (
    <div style={{
      padding: '10px 16px',
      display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap',
      borderBottom: `1px solid ${T.border}`,
      background: T.bgCard,
    }}>
      {/* Day quick-filter */}
      <div style={{ display: 'flex', gap: 5, flexWrap: 'wrap', flex: 1 }}>
        <button
          onClick={() => setFilterDay('')}
          style={{
            padding: '4px 11px', borderRadius: 99, fontSize: 11.5, fontWeight: 600,
            cursor: 'pointer', transition: 'all 0.13s',
            border: !filterDay ? 'none' : `1.5px solid ${T.border}`,
            background: !filterDay ? T.purple : T.bgCard,
            color: !filterDay ? '#fff' : T.muted,
            fontFamily: "'Poppins', sans-serif",
          }}
        >All days</button>
        {allDays.map(d => {
          const s     = getDayStyle(d);
          const active = filterDay === d;
          return (
            <button key={d} onClick={() => setFilterDay(d === filterDay ? '' : d)} style={{
              display: 'inline-flex', alignItems: 'center', gap: 4,
              padding: '4px 11px', borderRadius: 99, fontSize: 11.5, fontWeight: 600,
              cursor: 'pointer', transition: 'all 0.13s',
              border: active ? 'none' : `1.5px solid ${T.border}`,
              background: active ? s.dot : T.bgCard,
              color: active ? '#fff' : s.color,
              fontFamily: "'Poppins', sans-serif",
            }}>
              <span style={{ width: 6, height: 6, borderRadius: '50%', background: active ? '#fff' : s.dot }}/>
              {d.slice(0, 3)}
            </button>
          );
        })}
      </div>

      {/* View + group toggles */}
      <div style={{ display: 'flex', gap: 6 }}>
        <ToggleBtn active={groupBy}       onClick={() => setGroupBy(v => !v)} icon={Icon.group} label="Group"  />
        <ToggleBtn active={view === 'table'} onClick={() => setView('table')} icon={Icon.list}  label="Table"  />
        <ToggleBtn active={view === 'cards'} onClick={() => setView('cards')} icon={Icon.grid}  label="Cards"  />
      </div>
    </div>
  );

  // ── Render ────────────────────────────────────────────────────────────────────
  if (isEmpty) return <EmptyState fetchError={fetchError} />;

  const renderEvents = (evts) =>
    view === 'cards' ? (
      <div style={{
        display: 'grid',
        gridTemplateColumns: 'repeat(auto-fill, minmax(280px, 1fr))',
        gap: 12, padding: 16,
      }}>
        {evts.map(e => (
          <EventCard key={e.schedule_id ?? `${e.courseCode}-${e.day}-${e.period}`} event={e} computeUnits={computeUnits} />
        ))}
      </div>
    ) : (
      <div style={{ overflowX: 'auto' }}>
        <table style={{ width: '100%', borderCollapse: 'collapse', tableLayout: 'auto' }}>
          <thead>
            <tr>
              {COLUMNS.map(col => <Th key={col.key} col={col} />)}
            </tr>
          </thead>
          <tbody>
            {evts.map(e => (
              <TR key={e.schedule_id ?? `${e.courseCode}-${e.day}-${e.period}`} event={e} />
            ))}
          </tbody>
        </table>
      </div>
    );

  return (
    <div style={{ fontFamily: "'Poppins', sans-serif" }}>
      <Toolbar />

      {groupBy && grouped ? (
        grouped.map(([day, evts]) => (
          <div key={day}>
            <GroupHeader label={day} count={evts.length} />
            {renderEvents(evts)}
          </div>
        ))
      ) : (
        renderEvents(processed)
      )}

      <SummaryFooter events={processed} computeUnits={computeUnits} />
    </div>
  );
};

export default FacultyEventsTable;
