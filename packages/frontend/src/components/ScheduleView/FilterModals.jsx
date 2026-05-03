import { useState, useMemo } from 'react'
import { ModalOverlay, ModalHeader, ModalFooter, Chip, TV, ConflictTable } from './svPrimitives'

// ── Shared: unit cap logic (mirrors backend + SessionModal) ───────────────────
function getEffectiveMaxUnits(status, courseCount) {
  if (status === 'part-time') return 15
  if (courseCount >= 5) return 18
  if (courseCount >= 3) return 21
  return 24
}

// ── Shared: search input ──────────────────────────────────────────────────────
function ModalSearch({ value, onChange, placeholder = 'Search…' }) {
  return (
    <div style={{ position: 'relative', marginBottom: 14 }}>
      <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke={TV.muted} strokeWidth="2"
        style={{ position: 'absolute', left: 10, top: '50%', transform: 'translateY(-50%)', pointerEvents: 'none' }}>
        <circle cx="11" cy="11" r="8"/><line x1="21" y1="21" x2="16.65" y2="16.65"/>
      </svg>
      <input
        value={value}
        onChange={e => onChange(e.target.value)}
        placeholder={placeholder}
        style={{
          width: '100%', padding: '7px 12px 7px 30px',
          border: `1px solid ${TV.border}`, borderRadius: 8,
          fontSize: 12.5, fontFamily: 'Poppins, sans-serif',
          color: TV.text, background: '#fafafa', outline: 'none',
          boxSizing: 'border-box', transition: 'border-color .15s, background .15s',
        }}
        onFocus={e => { e.target.style.borderColor = TV.mid; e.target.style.background = '#fff' }}
        onBlur={e  => { e.target.style.borderColor = TV.border; e.target.style.background = '#fafafa' }}
      />
      {value && (
        <button onClick={() => onChange('')}
          style={{ position: 'absolute', right: 8, top: '50%', transform: 'translateY(-50%)', background: 'none', border: 'none', cursor: 'pointer', color: TV.muted, fontSize: 15, lineHeight: 1, padding: 2 }}>
          ×
        </button>
      )}
    </div>
  )
}

// ── Shared: section label ─────────────────────────────────────────────────────
function SectionLabel({ icon, label, count, accent = false }) {
  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 7, marginBottom: 10 }}>
      {icon && <span style={{ fontSize: 11 }}>{icon}</span>}
      <span style={{
        fontSize: 9, fontWeight: 800, textTransform: 'uppercase', letterSpacing: '.8px',
        color:      accent ? TV.deep  : TV.muted,
        background: accent ? TV.pale  : 'rgba(0,0,0,.04)',
        border:     `1px solid ${accent ? TV.light : TV.border}`,
        borderRadius: 4, padding: '2px 7px',
      }}>
        {label}
      </span>
      {count !== undefined && (
        <span style={{ fontSize: 9.5, color: TV.muted, fontWeight: 500 }}>{count} total</span>
      )}
    </div>
  )
}

// ── Shared: modal shell ───────────────────────────────────────────────────────
function ModalShell({ width = 480, children }) {
  return (
    <div style={{
      background: '#fff', borderRadius: 14, padding: '22px 24px 20px',
      width, maxWidth: '92vw', maxHeight: '82vh',
      display: 'flex', flexDirection: 'column',
      boxShadow: '0 24px 64px rgba(61,53,128,0.22), 0 0 0 1px rgba(0,0,0,.05)',
      border: `1px solid ${TV.border}`,
      fontFamily: 'Poppins, sans-serif',
    }}>
      {children}
    </div>
  )
}

// ── Shared: "Select all / Clear" quick-action bar ─────────────────────────────
function QuickActions({ filtered, selectedSet, onToggle }) {
  const allSelected  = filtered.length > 0 && filtered.every(o => selectedSet.has(o))
  const noneSelected = filtered.every(o => !selectedSet.has(o))

  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 12, flexWrap: 'wrap' }}>
      <span style={{ fontSize: 10, color: TV.muted, fontWeight: 500, marginRight: 2 }}>
        {selectedSet.size} selected
      </span>
      <button
        onClick={() => filtered.forEach(o => { if (!selectedSet.has(o)) onToggle(o) })}
        disabled={allSelected}
        style={{
          fontSize: 10.5, fontWeight: 600, padding: '3px 10px', borderRadius: 6,
          cursor: allSelected ? 'default' : 'pointer',
          border: `1px solid ${TV.border}`,
          background: allSelected ? TV.pale : '#fff',
          color: allSelected ? TV.muted : TV.deep,
          transition: 'all .15s',
        }}
      >
        Select all
      </button>
      <button
        onClick={() => filtered.forEach(o => { if (selectedSet.has(o)) onToggle(o) })}
        disabled={noneSelected}
        style={{
          fontSize: 10.5, fontWeight: 600, padding: '3px 10px', borderRadius: 6,
          cursor: noneSelected ? 'default' : 'pointer',
          border: `1px solid ${TV.border}`,
          background: noneSelected ? TV.pale : '#fff',
          color: noneSelected ? TV.muted : '#b91c1c',
          transition: 'all .15s',
        }}
      >
        Clear
      </button>
    </div>
  )
}

// ── Shared: empty state ───────────────────────────────────────────────────────
function EmptyState({ q, noun }) {
  return (
    <div style={{ textAlign: 'center', padding: '28px 0', display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 8 }}>
      <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke={TV.border} strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
        <circle cx="11" cy="11" r="8"/><line x1="21" y1="21" x2="16.65" y2="16.65"/>
      </svg>
      <p style={{ fontSize: 12.5, color: TV.muted, margin: 0 }}>
        {q ? `No ${noun} matching "${q}"` : `No ${noun} found.`}
      </p>
    </div>
  )
}

// ── Shared: stat pill ─────────────────────────────────────────────────────────
function StatPill({ label, value, color, bg, border, icon }) {
  return (
    <span style={{
      display: 'inline-flex', alignItems: 'center', gap: 5,
      fontSize: 10.5, fontWeight: 600, color,
      background: bg, border: `1px solid ${border}`,
      borderRadius: 20, padding: '3px 10px',
    }}>
      {icon && <span>{icon}</span>}
      <strong style={{ fontWeight: 800 }}>{value}</strong>
      <span style={{ opacity: .75 }}>{label}</span>
    </span>
  )
}

// ── Shared: cancel button ─────────────────────────────────────────────────────
function CancelButton({ onClick }) {
  return (
    <button
      onClick={onClick}
      style={{
        padding: '8px 20px', fontSize: 12.5, fontWeight: 600,
        background: '#fff', color: TV.muted,
        border: `1.5px solid ${TV.border}`, borderRadius: 8,
        cursor: 'pointer', fontFamily: 'Poppins, sans-serif', transition: 'all .15s',
      }}
      onMouseEnter={e => { e.currentTarget.style.background = TV.pale; e.currentTarget.style.color = TV.text }}
      onMouseLeave={e => { e.currentTarget.style.background = '#fff';  e.currentTarget.style.color = TV.muted }}
    >
      Cancel
    </button>
  )
}

// ── Generic chip-picker modal ────────────────────────────────────────────────
export function FilterModal({ title, options, selectedSet, onToggle, onClose, searchPlaceholder }) {
  const [q, setQ] = useState('')
  const filtered  = options.filter(o => o.toString().toLowerCase().includes(q.toLowerCase()))

  return (
    <ModalOverlay onClose={onClose}>
      <ModalShell>
        <ModalHeader title={title} onClose={onClose} />
        <ModalSearch value={q} onChange={setQ} placeholder={searchPlaceholder ?? `Search ${title.toLowerCase()}…`} />
        <QuickActions filtered={filtered} selectedSet={selectedSet} onToggle={onToggle} />
        <div style={{ overflowY: 'auto', flex: 1, paddingRight: 4 }}>
          {filtered.length === 0
            ? <EmptyState q={q} noun={title.toLowerCase()} />
            : (
              <div style={{ display: 'flex', flexWrap: 'wrap', gap: 7 }}>
                {filtered.map(opt => (
                  <Chip key={opt} label={opt} active={selectedSet.has(opt)} onClick={() => onToggle(opt)} />
                ))}
              </div>
            )
          }
        </div>
        <ModalFooter selectedCount={selectedSet.size} onClose={onClose} />
      </ModalShell>
    </ModalOverlay>
  )
}

// ── Faculty filter modal with unit load bars ──────────────────────────────────
// New dedicated modal that shows each faculty's current unit load.
//
// Props:
//   options           – string[] faculty names visible in the current schedule view
//   selectedSet       – Set<string> currently selected faculty names (for filtering)
//   onToggle          – (name: string) => void
//   onClose           – () => void
//   masterFacultyList – faculty objects [{ name, status, specializations, … }]
//   allEvents         – all schedule events used to compute unit loads
export function FacultyFilterModal({
  title = 'Filter by Faculty',
  options,
  selectedSet,
  onToggle,
  onClose,
  masterFacultyList = [],
  allEvents = [],
}) {
  const [q, setQ]           = useState('')
  const [sortBy, setSortBy] = useState('name') // 'name' | 'units' | 'load'

  // ── Build per-faculty unit info ──────────────────────────────────────────
  const unitMap = useMemo(() => {
    const map      = new Map()
    const facIndex = new Map(masterFacultyList.map(f => [f.name, f]))

    options.forEach(name => {
      const facObj      = facIndex.get(name) ?? {}
      const courseCodes = new Set()
      let   usedUnits   = 0

      allEvents.forEach(ev => {
        if (ev.faculty !== name) return
        usedUnits += Number(ev.units) || 0
        if (ev.courseCode) courseCodes.add(ev.courseCode)
      })

      const courseCount = courseCodes.size
      const maxUnits    = getEffectiveMaxUnits(facObj.status, courseCount)
      const pct         = Math.min(100, Math.round((usedUnits / maxUnits) * 100))

      map.set(name, {
        usedUnits,
        maxUnits,
        pct,
        isOver:  usedUnits > maxUnits,
        isNear:  !usedUnits > maxUnits && pct >= 80,
        status:  facObj.status ?? 'full-time',
      })
    })
    return map
  }, [options, masterFacultyList, allEvents])

  // ── Sorted + filtered list ───────────────────────────────────────────────
  const filtered = useMemo(() => {
    const qLow = q.toLowerCase()
    const list  = options.filter(o => o.toLowerCase().includes(qLow))
    if (sortBy === 'units') return [...list].sort((a, b) => (unitMap.get(b)?.usedUnits ?? 0) - (unitMap.get(a)?.usedUnits ?? 0))
    if (sortBy === 'load')  return [...list].sort((a, b) => (unitMap.get(b)?.pct ?? 0)       - (unitMap.get(a)?.pct ?? 0))
    return list.sort((a, b) => a.localeCompare(b))
  }, [options, q, sortBy, unitMap])

  // ── Summary stats ────────────────────────────────────────────────────────
  const totalUnits    = [...unitMap.values()].reduce((s, v) => s + v.usedUnits, 0)
  const overloadedCnt = [...unitMap.values()].filter(v => v.isOver).length

  // Bar colour helper
  const barColor = (pct, isOver) => isOver ? '#ef4444' : pct >= 80 ? '#f59e0b' : '#22c55e'

  return (
    <ModalOverlay onClose={onClose}>
      <ModalShell width={520}>
        <ModalHeader title={title} onClose={onClose} />

        {/* ── Summary strip ── */}
        <div style={{ display: 'flex', alignItems: 'center', gap: 7, marginBottom: 14, flexWrap: 'wrap' }}>
          <StatPill label="faculty" value={options.length} color={TV.deep}   bg={TV.pale}   border={TV.light}   />
          <StatPill label="units assigned" value={totalUnits} color="#1d4ed8" bg="#eff6ff" border="#bfdbfe" />
          {overloadedCnt > 0 && (
            <StatPill label="over cap" value={overloadedCnt} color="#b91c1c" bg="#fee2e2" border="#fca5a5" icon="⚠" />
          )}

          {/* Sort controls */}
          <div style={{ marginLeft: 'auto', display: 'flex', alignItems: 'center', gap: 5 }}>
            <span style={{ fontSize: 9.5, color: TV.muted }}>Sort by:</span>
            {[['name','Name'], ['units','Units'], ['load','Load %']].map(([val, lbl]) => (
              <button key={val} onClick={() => setSortBy(val)} style={{
                fontSize: 9.5, fontWeight: 700, padding: '2px 8px', borderRadius: 5, cursor: 'pointer',
                border:     `1px solid ${sortBy === val ? TV.deep : TV.border}`,
                background: sortBy === val ? TV.deep : '#fff',
                color:      sortBy === val ? '#fff'  : TV.muted,
                textTransform: 'capitalize', transition: 'all .15s', fontFamily: 'Poppins, sans-serif',
              }}>
                {lbl}
              </button>
            ))}
          </div>
        </div>

        <ModalSearch value={q} onChange={setQ} placeholder="Search faculty…" />
        <QuickActions filtered={filtered} selectedSet={selectedSet} onToggle={onToggle} />

        {/* ── Faculty rows ── */}
        <div style={{ overflowY: 'auto', flex: 1, display: 'flex', flexDirection: 'column', gap: 5, paddingRight: 2 }}>
          {filtered.length === 0
            ? <EmptyState q={q} noun="faculty" />
            : filtered.map(name => {
                const info     = unitMap.get(name) ?? { usedUnits: 0, maxUnits: 24, pct: 0, isOver: false, status: 'full-time' }
                const isActive = selectedSet.has(name)
                const bc       = barColor(info.pct, info.isOver)

                // Border / background per state
                let rowBorder = isActive ? TV.deep : info.isOver ? '#fca5a5' : TV.border
                let rowBg     = isActive ? TV.pale  : info.isOver ? '#fff5f5' : '#fff'

                return (
                  <button
                    key={name}
                    onClick={() => onToggle(name)}
                    style={{
                      display: 'flex', alignItems: 'center', gap: 11,
                      padding: '9px 13px', borderRadius: 10, cursor: 'pointer',
                      border: `1.5px solid ${rowBorder}`,
                      background: rowBg,
                      textAlign: 'left', fontFamily: 'Poppins, sans-serif',
                      transition: 'all .15s', outline: 'none',
                    }}
                    onMouseEnter={e => { if (!isActive) e.currentTarget.style.borderColor = TV.mid }}
                    onMouseLeave={e => { if (!isActive) e.currentTarget.style.borderColor = info.isOver ? '#fca5a5' : TV.border }}
                  >
                    {/* Checkbox */}
                    <span style={{
                      width: 16, height: 16, borderRadius: 5, flexShrink: 0,
                      display: 'inline-flex', alignItems: 'center', justifyContent: 'center',
                      background: isActive ? TV.deep : '#fff',
                      border: `2px solid ${isActive ? TV.deep : TV.border}`,
                      transition: 'all .15s',
                    }}>
                      {isActive && (
                        <svg width="9" height="9" viewBox="0 0 24 24" fill="none" stroke="#fff" strokeWidth="3.5" strokeLinecap="round" strokeLinejoin="round">
                          <polyline points="20 6 9 17 4 12"/>
                        </svg>
                      )}
                    </span>

                    {/* Name, badges, bar */}
                    <div style={{ flex: 1, minWidth: 0 }}>

                      {/* Top: name + PT/FT + OVER CAP badges */}
                      <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 5 }}>
                        <span style={{
                          fontSize: 12, fontWeight: isActive ? 700 : 500,
                          color: isActive ? TV.deep : TV.text,
                          overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', flex: 1, minWidth: 0,
                        }}>
                          {name}
                        </span>

                        {/* PT / FT badge */}
                        <span style={{
                          fontSize: 8.5, fontWeight: 700, flexShrink: 0,
                          padding: '1px 6px', borderRadius: 4,
                          textTransform: 'uppercase', letterSpacing: '.5px',
                          background: info.status === 'part-time' ? '#fef9c3' : '#f0f9ff',
                          color:      info.status === 'part-time' ? '#854d0e' : '#0369a1',
                          border:     `1px solid ${info.status === 'part-time' ? '#fde68a' : '#bae6fd'}`,
                        }}>
                          {info.status === 'part-time' ? 'PT' : 'FT'}
                        </span>

                        {/* Over cap badge */}
                        {info.isOver && (
                          <span style={{
                            fontSize: 8.5, fontWeight: 700, flexShrink: 0,
                            color: '#b91c1c', background: '#fee2e2',
                            border: '1px solid #fca5a5', borderRadius: 4, padding: '1px 6px',
                          }}>
                            OVER CAP
                          </span>
                        )}
                      </div>

                      {/* Bottom: unit progress bar + label */}
                      <div style={{ display: 'flex', alignItems: 'center', gap: 9 }}>
                        <div style={{ flex: 1, height: 5, borderRadius: 99, background: '#F0EDF9', overflow: 'hidden' }}>
                          <div style={{
                            height: '100%', borderRadius: 99,
                            width: `${info.pct}%`,
                            background: isActive ? TV.deep : bc,
                            transition: 'width .3s ease',
                          }} />
                        </div>
                        <span style={{
                          fontSize: 9.5, fontWeight: 700, flexShrink: 0, minWidth: 80, textAlign: 'right',
                          color: isActive ? TV.deep : info.isOver ? '#b91c1c' : info.pct >= 80 ? '#92400e' : TV.muted,
                        }}>
                          {info.usedUnits} / {info.maxUnits} units
                        </span>
                        <span style={{
                          fontSize: 9, fontWeight: 600, flexShrink: 0, minWidth: 34, textAlign: 'right',
                          color: isActive ? TV.mid : info.isOver ? '#ef4444' : info.pct >= 80 ? '#f59e0b' : TV.muted,
                        }}>
                          {info.pct}%
                        </span>
                      </div>
                    </div>
                  </button>
                )
              })
          }
        </div>

        <ModalFooter selectedCount={selectedSet.size} onClose={onClose} />
      </ModalShell>
    </ModalOverlay>
  )
}

// ── Room picker modal with lecture / lab grouping ────────────────────────────
export function RoomFilterModal({ title, options, selectedSet, onToggle, onClose, masterRooms }) {
  const [q, setQ] = useState('')
  const labSet   = new Set(masterRooms.lab)
  const lecSet   = new Set(masterRooms.lecture)
  const labRooms = options.filter(r => labSet.has(r) || (!lecSet.has(r) && r.toLowerCase().includes('lab')))
  const lecRooms = options.filter(r => lecSet.has(r) || (!labSet.has(r) && !r.toLowerCase().includes('lab')))

  function filterGroup(rooms) {
    return q ? rooms.filter(r => r.toLowerCase().includes(q.toLowerCase())) : rooms
  }

  const RoomGroup = ({ groupTitle, rooms, icon }) => {
    const visible = filterGroup(rooms)
    if (visible.length === 0) return null
    const isLab = groupTitle.toLowerCase().includes('lab')
    return (
      <div style={{ marginBottom: 18 }}>
        <SectionLabel icon={icon} label={groupTitle} count={visible.length} accent={isLab} />
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: 7 }}>
          {visible.map(rm => (
            <Chip key={rm} label={rm} active={selectedSet.has(rm)} onClick={() => onToggle(rm)} />
          ))}
        </div>
      </div>
    )
  }

  const allFiltered = [...filterGroup(lecRooms), ...filterGroup(labRooms)]

  return (
    <ModalOverlay onClose={onClose}>
      <ModalShell width={500}>
        <ModalHeader title={title} onClose={onClose} />
        <ModalSearch value={q} onChange={setQ} placeholder="Search rooms…" />
        <QuickActions filtered={allFiltered} selectedSet={selectedSet} onToggle={onToggle} />
        <div style={{ overflowY: 'auto', flex: 1, paddingRight: 4 }}>
          {options.length === 0
            ? <EmptyState q={q} noun="rooms" />
            : <>
                <RoomGroup groupTitle="Lecture Rooms"    rooms={lecRooms} icon="🏫" />
                <RoomGroup groupTitle="Laboratory Rooms" rooms={labRooms} icon="🔬" />
              </>
          }
        </div>
        <ModalFooter selectedCount={selectedSet.size} onClose={onClose} />
      </ModalShell>
    </ModalOverlay>
  )
}

// ── Session picker modal with lecture / lab grouping ─────────────────────────
export function SessionFilterModal({ title, options, selectedSet, onToggle, onClose }) {
  const [q, setQ] = useState('')

  const labSessions = options.filter(s => s?.toUpperCase().includes('LAB'))
  const lecSessions = options.filter(s => !s?.toUpperCase().includes('LAB'))

  function filterGroup(sessions) {
    return q ? sessions.filter(s => s.toLowerCase().includes(q.toLowerCase())) : sessions
  }

  const SessionGroup = ({ groupTitle, sessions, accent }) => {
    const visible = filterGroup(sessions)
    if (visible.length === 0) return null
    const isLab = accent === 'lab'
    return (
      <div style={{ marginBottom: 18 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 10 }}>
          <span style={{
            fontSize: 9, fontWeight: 800, textTransform: 'uppercase', letterSpacing: '.8px',
            color:      isLab ? TV.deep  : TV.muted,
            background: isLab ? TV.pale  : 'rgba(0,0,0,.04)',
            border:     `1px solid ${isLab ? TV.light : TV.border}`,
            borderRadius: 4, padding: '2px 7px',
          }}>
            {isLab ? 'LAB' : 'LEC'}
          </span>
          <span style={{ fontSize: 10, fontWeight: 700, color: TV.muted, textTransform: 'uppercase', letterSpacing: '.8px' }}>
            {groupTitle}
          </span>
          <span style={{ fontSize: 9.5, color: TV.muted }}>{visible.length} total</span>
        </div>
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: 7 }}>
          {visible.map(s => (
            <Chip key={s} label={s} active={selectedSet.has(s)} onClick={() => onToggle(s)} />
          ))}
        </div>
      </div>
    )
  }

  const allFiltered = [...filterGroup(lecSessions), ...filterGroup(labSessions)]

  return (
    <ModalOverlay onClose={onClose}>
      <ModalShell width={500}>
        <ModalHeader title={title} onClose={onClose} />
        <ModalSearch value={q} onChange={setQ} placeholder="Search sessions…" />
        <QuickActions filtered={allFiltered} selectedSet={selectedSet} onToggle={onToggle} />
        <div style={{ overflowY: 'auto', flex: 1, paddingRight: 4 }}>
          {options.length === 0
            ? <EmptyState q={q} noun="sessions" />
            : <>
                <SessionGroup groupTitle="Lecture Sessions"    sessions={lecSessions} accent="lec" />
                <SessionGroup groupTitle="Laboratory Sessions" sessions={labSessions} accent="lab" />
              </>
          }
        </div>
        <ModalFooter selectedCount={selectedSet.size} onClose={onClose} />
      </ModalShell>
    </ModalOverlay>
  )
}

// ── Override confirmation modal ───────────────────────────────────────────────
export function OverrideConfirmModal({ pendingDrop, onConfirm, onCancel }) {
  if (!pendingDrop) return null
  const { draggedEvent, targetRoom, newPeriod, conflicts } = pendingDrop

  const conflictTypes = new Set(conflicts.flatMap(c => c.conflictLabel.replace(' Conflict', '').split(' + ')))
  const typeColors = {
    Room:    { bg: '#fef2f2', text: '#b91c1c', border: '#fecaca' },
    Section: { bg: '#fdf4ff', text: '#7e22ce', border: '#e9d5ff' },
    Faculty: { bg: '#eff6ff', text: '#1d4ed8', border: '#bfdbfe' },
  }

  return (
    <ModalOverlay onClose={onCancel}>
      <div style={{
        background: '#fff', borderRadius: 14, padding: 28,
        width: 560, maxWidth: '94vw', maxHeight: '88vh',
        display: 'flex', flexDirection: 'column',
        boxShadow: '0 24px 72px rgba(61,53,128,0.24), 0 0 0 1px rgba(0,0,0,.06)',
        border: `1px solid ${TV.border}`,
        fontFamily: 'Poppins, sans-serif',
      }}>
        <ModalHeader
          title="Confirm Schedule Override"
          subtitle="This move will create one or more conflicts. You can still apply it."
          onClose={onCancel}
        />

        <div style={{
          background: TV.pale, border: `1px solid ${TV.border}`,
          borderRadius: 10, padding: '12px 16px', marginBottom: 14,
          display: 'flex', flexDirection: 'column', gap: 4,
        }}>
          <span style={{ fontSize: 10, fontWeight: 700, color: TV.muted, textTransform: 'uppercase', letterSpacing: '.7px' }}>
            Moving
          </span>
          <div style={{ display: 'flex', alignItems: 'center', gap: 10, flexWrap: 'wrap' }}>
            <span style={{ fontSize: 14, fontWeight: 800, color: TV.text, letterSpacing: '-0.3px' }}>
              {draggedEvent.courseCode}
            </span>
            <span style={{ fontSize: 11, color: TV.muted }}>
              {draggedEvent.program} {draggedEvent.year}-{draggedEvent.block}
            </span>
            <span style={{ fontSize: 9, color: TV.muted }}>→</span>
            <span style={{ fontSize: 12, fontWeight: 700, color: TV.deep }}>{targetRoom}</span>
            <span style={{ fontSize: 11, color: TV.muted }}>{newPeriod}</span>
          </div>
        </div>

        <div style={{ display: 'flex', gap: 6, marginBottom: 10, flexWrap: 'wrap' }}>
          <span style={{ fontSize: 11, fontWeight: 700, color: '#b91c1c', alignSelf: 'center' }}>
            ⚠ {conflicts.length} conflict{conflicts.length !== 1 ? 's' : ''}:
          </span>
          {[...conflictTypes].map(t => {
            const c = typeColors[t] ?? typeColors.Room
            return (
              <span key={t} style={{
                fontSize: 10, fontWeight: 700, padding: '2px 9px',
                background: c.bg, color: c.text, border: `1px solid ${c.border}`,
                borderRadius: 20,
              }}>
                {t}
              </span>
            )
          })}
        </div>

        <div style={{ overflowY: 'auto', flex: 1 }}>
          <ConflictTable conflicts={conflicts} />
        </div>

        <p style={{ fontSize: 10.5, color: TV.muted, margin: '12px 0 0', lineHeight: 1.5 }}>
          Overrides are queued locally. Use <strong>Save Changes</strong> in the toolbar to persist them to the server.
        </p>

        <div style={{ display: 'flex', gap: 10, justifyContent: 'flex-end', marginTop: 16, paddingTop: 16, borderTop: `1px solid ${TV.border}` }}>
          <CancelButton onClick={onCancel} />
          <button
            onClick={onConfirm}
            style={{
              padding: '8px 20px', fontSize: 12.5, fontWeight: 700,
              background: 'linear-gradient(135deg,#dc2626,#b91c1c)',
              color: '#fff', border: 'none', borderRadius: 8,
              cursor: 'pointer', fontFamily: 'Poppins, sans-serif',
              boxShadow: '0 4px 12px rgba(220,38,38,.30)',
              display: 'flex', alignItems: 'center', gap: 6, transition: 'all .15s',
            }}
            onMouseEnter={e => { e.currentTarget.style.transform = 'translateY(-1px)'; e.currentTarget.style.boxShadow = '0 6px 18px rgba(220,38,38,.40)' }}
            onMouseLeave={e => { e.currentTarget.style.transform = '';                e.currentTarget.style.boxShadow = '0 4px 12px rgba(220,38,38,.30)' }}
          >
            <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
              <path d="M10.29 3.86L1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z"/>
              <line x1="12" y1="9" x2="12" y2="13"/><line x1="12" y1="17" x2="12.01" y2="17"/>
            </svg>
            Override Anyway
          </button>
        </div>
      </div>
    </ModalOverlay>
  )
}

// ── Stack sessions confirmation modal ─────────────────────────────────────────
export function StackConfirmModal({ pendingStack, onConfirm, onCancel }) {
  if (!pendingStack) return null
  const { draggedEvent: src, targetEvent: tgt } = pendingStack

  const srcSection = src.program && src.year && src.block
    ? `${src.program} ${src.year}-${src.block}` : src.block || ''
  const tgtSection = tgt.program && tgt.year && tgt.block
    ? `${tgt.program} ${tgt.year}-${tgt.block}` : tgt.block || ''

  const isSameRoom   = src.room   === tgt.room
  const isSamePeriod = src.period === tgt.period

  function EventPill({ event, section, label, accent }) {
    return (
      <div style={{
        flex: 1, minWidth: 0,
        background: accent === 'src' ? TV.pale : '#f0fdf4',
        border: `1.5px solid ${accent === 'src' ? TV.light : '#6ee7b7'}`,
        borderRadius: 10, padding: '10px 14px',
        display: 'flex', flexDirection: 'column', gap: 3,
      }}>
        <span style={{ fontSize: 9, fontWeight: 700, color: TV.muted, textTransform: 'uppercase', letterSpacing: '.6px' }}>
          {label}
        </span>
        <span style={{ fontSize: 15, fontWeight: 800, color: TV.text, letterSpacing: '-0.4px', lineHeight: 1 }}>
          {event.courseCode}
        </span>
        {section && (
          <span style={{ fontSize: 10.5, fontWeight: 600, color: TV.deep }}>{section}</span>
        )}
        <div style={{ display: 'flex', flexDirection: 'column', gap: 2, marginTop: 2 }}>
          <span style={{ fontSize: 10, color: TV.muted }}>📍 {event.room || 'TBA'}</span>
          <span style={{ fontSize: 10, color: TV.muted }}>🕐 {event.period || '—'}</span>
          {event.faculty && event.faculty !== 'TBA' && (
            <span style={{ fontSize: 10, color: TV.muted }}>👤 {event.faculty}</span>
          )}
        </div>
      </div>
    )
  }

  return (
    <ModalOverlay onClose={onCancel}>
      <div style={{
        background: '#fff', borderRadius: 14, padding: 28,
        width: 540, maxWidth: '94vw', maxHeight: '88vh',
        display: 'flex', flexDirection: 'column',
        boxShadow: '0 24px 72px rgba(16,185,129,0.18), 0 0 0 1px rgba(0,0,0,.06)',
        border: '1px solid #d1fae5',
        fontFamily: 'Poppins, sans-serif',
      }}>
        <ModalHeader
          title="Stack Sessions Together?"
          subtitle="This will place both sessions in the same room at the same time."
          onClose={onCancel}
        />

        <div style={{ display: 'flex', gap: 12, marginBottom: 16, alignItems: 'stretch' }}>
          <EventPill event={src} section={srcSection} label="Moving"        accent="src" />
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="#059669" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
              <line x1="5" y1="12" x2="19" y2="12"/>
              <polyline points="12 5 19 12 12 19"/>
            </svg>
          </div>
          <EventPill event={tgt} section={tgtSection} label="Stacking with" accent="tgt" />
        </div>

        <div style={{
          background: '#f0fdf4', border: '1.5px solid #6ee7b7',
          borderRadius: 10, padding: '12px 16px', marginBottom: 14,
          display: 'flex', flexDirection: 'column', gap: 6,
        }}>
          <span style={{ fontSize: 10, fontWeight: 700, color: '#065f46', textTransform: 'uppercase', letterSpacing: '.7px' }}>
            After stacking
          </span>
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8 }}>
            <Pill icon="📍" label={`Room: ${tgt.room || 'TBA'}`} color="#059669" bg="#dcfce7" border="#86efac" />
            <Pill icon="🕐" label={`Time: ${tgt.period || '—'}`}  color="#059669" bg="#dcfce7" border="#86efac" />
          </div>
          {!isSameRoom   && <Notice text={`${src.courseCode} will move from ${src.room} → ${tgt.room}`} />}
          {!isSamePeriod && <Notice text={`${src.courseCode} will shift to ${tgt.period}`} />}
        </div>

        <div style={{
          background: '#fffbeb', border: '1px solid #fcd34d',
          borderRadius: 8, padding: '10px 14px',
          display: 'flex', alignItems: 'flex-start', gap: 10, marginBottom: 16,
        }}>
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="#d97706" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" style={{ flexShrink: 0, marginTop: 1 }}>
            <path d="M10.29 3.86L1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z"/>
            <line x1="12" y1="9" x2="12" y2="13"/><line x1="12" y1="17" x2="12.01" y2="17"/>
          </svg>
          <p style={{ fontSize: 11, color: '#92400e', margin: 0, lineHeight: 1.55 }}>
            Stacked sessions share the same room and timeslot. This will appear as a{' '}
            <strong>Room Conflict</strong> unless your system treats overlapping sections as merged.
            The change is queued locally — use <strong>Save Changes</strong> to persist.
          </p>
        </div>

        <div style={{ display: 'flex', gap: 10, justifyContent: 'flex-end', paddingTop: 16, borderTop: `1px solid ${TV.border}` }}>
          <CancelButton onClick={onCancel} />
          <button
            onClick={onConfirm}
            style={{
              padding: '8px 20px', fontSize: 12.5, fontWeight: 700,
              background: 'linear-gradient(135deg,#059669,#047857)',
              color: '#fff', border: 'none', borderRadius: 8,
              cursor: 'pointer', fontFamily: 'Poppins, sans-serif',
              boxShadow: '0 4px 12px rgba(5,150,105,.30)',
              display: 'flex', alignItems: 'center', gap: 6, transition: 'all .15s',
            }}
            onMouseEnter={e => { e.currentTarget.style.transform = 'translateY(-1px)'; e.currentTarget.style.boxShadow = '0 6px 18px rgba(5,150,105,.40)' }}
            onMouseLeave={e => { e.currentTarget.style.transform = '';                e.currentTarget.style.boxShadow = '0 4px 12px rgba(5,150,105,.30)' }}
          >
            <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
              <polyline points="22 12 16 12 14 15 10 15 8 12 2 12"/>
              <path d="M5.45 5.11L2 12v6a2 2 0 0 0 2 2h16a2 2 0 0 0 2-2v-6l-3.45-6.89A2 2 0 0 0 16.76 4H7.24a2 2 0 0 0-1.79 1.11z"/>
            </svg>
            Stack Sessions
          </button>
        </div>
      </div>
    </ModalOverlay>
  )
}

// ── Stack-modal small helpers ─────────────────────────────────────────────────
function Pill({ icon, label, color, bg, border }) {
  return (
    <span style={{
      display: 'inline-flex', alignItems: 'center', gap: 4,
      fontSize: 10.5, fontWeight: 600, color,
      background: bg, border: `1px solid ${border}`,
      borderRadius: 20, padding: '2px 10px',
    }}>
      {icon} {label}
    </span>
  )
}

function Notice({ text }) {
  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginTop: 2 }}>
      <div style={{ width: 4, height: 4, borderRadius: '50%', background: '#059669', flexShrink: 0 }} />
      <span style={{ fontSize: 10.5, color: '#047857' }}>{text}</span>
    </div>
  )
}