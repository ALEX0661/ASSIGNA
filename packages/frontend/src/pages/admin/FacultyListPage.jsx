import { useEffect, useState, useMemo } from 'react'
import { useNavigate } from 'react-router-dom'
import ImportFacultyModal from '../../components/ImportFacultyModal'
import { getFaculty, deleteFaculty } from '../../services/api' 

/* ── Checkbox — pure visual, no hidden input (avoids double-click ghost event) ── */
function Checkbox({ checked, indeterminate }) {
  return (
    <span style={{
      width: 16, height: 16, borderRadius: 4, flexShrink: 0,
      border: `1.5px solid ${checked || indeterminate ? '#7C6FCD' : '#D8D3F5'}`,
      background: checked || indeterminate ? 'linear-gradient(135deg,#7C6FCD,#5a4fbf)' : '#fff',
      display: 'inline-flex', alignItems: 'center', justifyContent: 'center',
      transition: 'all 0.15s',
      boxShadow: checked || indeterminate ? '0 2px 6px rgba(124,111,205,0.35)' : 'none',
      pointerEvents: 'none',
    }}>
      {indeterminate && !checked && (
        <svg width="8" height="2" viewBox="0 0 8 2" fill="none"><rect width="8" height="2" rx="1" fill="white"/></svg>
      )}
      {checked && (
        <svg width="9" height="7" viewBox="0 0 9 7" fill="none">
          <polyline points="1,3.5 3.5,6 8,1" stroke="white" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round"/>
        </svg>
      )}
    </span>
  )
}

/* ── Toggle pill ── */
function TogglePill({ label, active, onClick }) {
  return (
    <button onClick={onClick} style={{
      padding: '4px 12px', borderRadius: 99, fontSize: 11.5, fontWeight: active ? 600 : 500,
      background: active ? 'linear-gradient(135deg,#7C6FCD,#5a4fbf)' : '#F5F4FB',
      color: active ? '#fff' : '#8883B0',
      border: `1.5px solid ${active ? 'transparent' : '#E8E4F8'}`,
      cursor: 'pointer', transition: 'all 0.15s',
      boxShadow: active ? '0 2px 8px rgba(124,111,205,0.28)' : 'none',
      whiteSpace: 'nowrap', fontFamily: "'Poppins',sans-serif",
    }}>{label}</button>
  )
}

/* ── Rating stars (display only) ── */
function RatingStars({ rating }) {
  return (
    <span style={{ display: 'inline-flex', gap: 1 }}>
      {[1, 2, 3, 4, 5].map(s => (
        <svg key={s} width="9" height="9" viewBox="0 0 24 24"
          fill={s <= rating ? '#7C6FCD' : 'none'}
          stroke={s <= rating ? '#7C6FCD' : '#D8D3F5'}
          strokeWidth="2">
          <polygon points="12 2 15.09 8.26 22 9.27 17 14.14 18.18 21.02 12 17.77 5.82 21.02 7 14.14 2 9.27 8.91 8.26 12 2"/>
        </svg>
      ))}
    </span>
  )
}

/* ── Avatar ── */
function Avatar({ name, size = 56 }) {
  const safeName = name || '?';
  const initials = safeName.split(' ').map(n => n[0]).join('').slice(0, 2).toUpperCase()
  
  const colors = [
    ['#7C6FCD', '#EEEAFB'], ['#2563EB', '#EBF0FF'], ['#059669', '#E6FAF3'],
    ['#D97706', '#FEF3CD'], ['#DC2626', '#FFE8E8'], ['#7C3AED', '#EDE9FE'],
  ]
  
  const [fg, bg] = colors[safeName.charCodeAt(0) % colors.length]
  
  return (
    <div style={{
      width: size, height: size, borderRadius: '50%',
      background: `linear-gradient(135deg, ${bg}, ${bg}cc)`,
      color: fg, display: 'flex', alignItems: 'center', justifyContent: 'center',
      fontSize: size * 0.33, fontWeight: 700, flexShrink: 0,
      border: `2.5px solid ${fg}30`,
      boxShadow: `0 4px 12px ${fg}25`,
    }}>{initials}</div>
  )
}

/* ── Faculty Card ── */
function FacultyCard({ faculty, selected, onSelect, onClick, selectionMode }) {
  const [hovered, setHovered] = useState(false)
  const isOverloaded = (faculty.units ?? 0) > (faculty.max_units ?? 21)
  const unitPct = Math.min(100, ((faculty.units ?? 0) / (faculty.max_units ?? 21)) * 100)

  return (
    <div
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => setHovered(false)}
      onClick={onClick}
      style={{
        background: selected ? '#FDFCFF' : '#fff',
        borderRadius: 16,
        border: `1.5px solid ${selected ? '#7C6FCD' : hovered ? '#C4BBF0' : '#E8E4F8'}`,
        padding: '18px 18px 16px',
        cursor: 'pointer',
        position: 'relative',
        boxShadow: selected
          ? '0 0 0 3px rgba(124,111,205,0.18), 0 8px 24px rgba(124,111,205,0.14)'
          : hovered
            ? '0 8px 24px rgba(124,111,205,0.13)'
            : '0 2px 8px rgba(124,111,205,0.06)',
        transform: hovered && !selected ? 'translateY(-2px)' : 'none',
        transition: 'all 0.18s ease',
      }}
    >
      {/* Selection checkbox — always visible */}
      <div
        onClick={e => { e.stopPropagation(); onSelect() }}
        style={{
          position: 'absolute', top: 12, right: 12,
          opacity: selected ? 1 : hovered || selectionMode ? 0.85 : 0.3,
          transition: 'opacity 0.15s',
          zIndex: 2,
        }}
      >
        <Checkbox checked={selected} onChange={() => {}} />
      </div>

      {/* Header: avatar + name + rank */}
      <div style={{ display: 'flex', gap: 12, alignItems: 'flex-start', marginBottom: 14 }}>
        <Avatar name={faculty.name} size={44} />
        <div style={{ flex: 1, minWidth: 0, paddingRight: 20 }}>
          <div style={{ fontSize: 14, fontWeight: 700, color: '#1a1a2e', lineHeight: 1.2, marginBottom: 2, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
            {faculty.name}
          </div>
          <div style={{ fontSize: 11, color: '#8883B0', fontWeight: 500, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
            {faculty.AcademicRank || 'No rank set'}
          </div>
        </div>
      </div>

      {/* Status badge */}
      <div style={{ display: 'flex', gap: 6, marginBottom: 12, flexWrap: 'wrap' }}>
        <span style={{
          padding: '2px 9px', borderRadius: 99, fontSize: 10.5, fontWeight: 700,
          background: faculty.status === 'full-time' ? '#E6FAF3' : '#F5F4FB',
          color: faculty.status === 'full-time' ? '#059669' : '#8883B0',
          border: `1px solid ${faculty.status === 'full-time' ? '#B8F0DC' : '#E8E4F8'}`,
          textTransform: 'capitalize',
        }}>{faculty.status}</span>

        {isOverloaded && (
          <span style={{
            padding: '2px 9px', borderRadius: 99, fontSize: 10.5, fontWeight: 700,
            background: '#FFE8E8', color: '#C0392B', border: '1px solid #FFCCCC',
          }}>Overloaded</span>
        )}
      </div>

      {/* Unit load bar */}
      <div style={{ marginBottom: 12 }}>
        <div style={{ height: 4, background: '#F0EDF9', borderRadius: 99, overflow: 'hidden' }}>
          <div style={{
            height: '100%', width: `${unitPct}%`,
            background: isOverloaded
              ? 'linear-gradient(90deg,#E74C3C,#C0392B)'
              : unitPct > 80
                ? 'linear-gradient(90deg,#F39C12,#D97706)'
                : 'linear-gradient(90deg,#7C6FCD,#5a4fbf)',
            borderRadius: 99,
            transition: 'width 0.3s ease',
          }} />
        </div>
      </div>

      {/* Specializations */}
      <div style={{ display: 'flex', gap: 4, flexWrap: 'wrap', minHeight: 24 }}>
        {(faculty.specializations || []).length === 0 ? (
          <span style={{ fontSize: 11, color: '#C0BBDC', fontStyle: 'italic' }}>No specializations</span>
        ) : (
          <>
            {(faculty.specializations || []).slice(0, 3).map((s, i) => (
              <span key={i} style={{
                display: 'inline-flex', alignItems: 'center', gap: 4,
                padding: '2px 7px', borderRadius: 99, fontSize: 10, fontWeight: 700,
                background: '#F0EDF9', color: '#5a4fbf',
                border: '1px solid #E0DAF8',
              }}>
                {typeof s === 'object' ? s.courseCode : s}
                {typeof s === 'object' && <RatingStars rating={s.rating} />}
              </span>
            ))}
            {(faculty.specializations || []).length > 3 && (
              <span style={{
                padding: '2px 7px', borderRadius: 99, fontSize: 10, fontWeight: 700,
                background: '#F5F4FB', color: '#8883B0', border: '1px solid #E8E4F8',
              }}>+{faculty.specializations.length - 3} more</span>
            )}
          </>
        )}
      </div>

      {/* Hover edit hint */}
      {hovered && !selectionMode && (
        <div style={{
          position: 'absolute', bottom: 0, left: 0, right: 0,
          background: 'linear-gradient(to top, rgba(124,111,205,0.08), transparent)',
          borderRadius: '0 0 14px 14px', height: 32,
          display: 'flex', alignItems: 'flex-end', justifyContent: 'center', paddingBottom: 6,
        }}>
          <span style={{ fontSize: 10.5, color: '#7C6FCD', fontWeight: 600, display: 'flex', alignItems: 'center', gap: 3 }}>
            <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="#7C6FCD" strokeWidth="2.5">
              <path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"/>
              <path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"/>
            </svg>
            Click to edit
          </span>
        </div>
      )}
    </div>
  )
}

/* ── Main page ── */
export default function FacultyListPage() {
  const [faculty,       setFaculty]       = useState([])
  const [search,        setSearch]        = useState('')
  const [statusFilter,  setStatusFilter]  = useState([])
  const [loading,       setLoading]       = useState(true)
  const [selected,      setSelected]      = useState(new Set())
  const [deleting,      setDeleting]      = useState(false)
  const [showImport,    setShowImport]    = useState(false) // Modal state
  const navigate = useNavigate()

  async function load() {
    setLoading(true)
    try { setFaculty(await getFaculty()) } finally { setLoading(false) }
    setSelected(new Set())
  }
  useEffect(() => { load() }, [])

  const filtered = useMemo(() => faculty.filter(f => {
    const q = search.toLowerCase()
    const matchSearch = !q || (f.name || '').toLowerCase().includes(q) || (f.AcademicRank || '').toLowerCase().includes(q)
    const matchStatus = statusFilter.length === 0 || statusFilter.includes(f.status)
    return matchSearch && matchStatus
  }), [faculty, search, statusFilter])

  const filteredIds   = filtered.map(f => f.id)
  const allSelected   = filteredIds.length > 0 && filteredIds.every(id => selected.has(id))
  const someSelected  = filteredIds.some(id => selected.has(id)) && !allSelected
  const selectedCount = [...selected].filter(id => filteredIds.includes(id)).length
  const selectionMode = selected.size > 0

  function toggleSelectAll() {
    if (allSelected) {
      setSelected(prev => { const n = new Set(prev); filteredIds.forEach(id => n.delete(id)); return n })
    } else {
      setSelected(prev => { const n = new Set(prev); filteredIds.forEach(id => n.add(id)); return n })
    }
  }

  function toggleOne(id) {
    setSelected(prev => { const n = new Set(prev); n.has(id) ? n.delete(id) : n.add(id); return n })
  }

  async function handleBulkDelete() {
    const targets = filtered.filter(f => selected.has(f.id))
    if (!targets.length) return
    if (!confirm(`Permanently delete ${targets.length} faculty member${targets.length !== 1 ? 's' : ''}? This cannot be undone.`)) return
    setDeleting(true)
    try {
      await Promise.all(targets.map(f => deleteFaculty(f.id)))
      load()
    } finally { setDeleting(false) }
  }

  const hasFilter = search || statusFilter.length > 0

  return (
    <div style={{ padding: '28px 32px', fontFamily: "'Poppins',sans-serif" }}>
      <style>{`
        @keyframes slideIn { from { opacity:0; transform:translateY(-8px) } to { opacity:1; transform:translateY(0) } }
        @keyframes spin     { to   { transform:rotate(360deg) } }
        @keyframes fadeIn   { from { opacity:0 } to { opacity:1 } }
      `}</style>

      {/* ── Page header ── */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 22 }}>
        <div>
          <h1 style={{ fontSize: 21, fontWeight: 700, color: '#1a1a2e', letterSpacing: '-.3px', margin: 0 }}>Faculty</h1>
          <p style={{ fontSize: 12.5, color: '#8883B0', marginTop: 3 }}>
            {faculty.length} member{faculty.length !== 1 ? 's' : ''}
            {hasFilter && filtered.length !== faculty.length && (
              <span style={{ marginLeft: 6, color: '#7C6FCD', fontWeight: 600 }}>· {filtered.length} shown</span>
            )}
          </p>
        </div>
        
        <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
          {/* Import Button */}
          <button 
            onClick={() => setShowImport(true)}
            style={{
              display: 'inline-flex', alignItems: 'center', gap: 7,
              padding: '8px 18px', borderRadius: 10, border: '1.5px solid #D8D3F5',
              fontFamily: "'Poppins',sans-serif", fontSize: 12.5, fontWeight: 600,
              cursor: 'pointer', transition: 'all 0.15s',
              background: '#fff', color: '#7C6FCD'
            }}
            onMouseEnter={e => { e.currentTarget.style.background = '#F2EFFD'; e.currentTarget.style.borderColor = '#C5BBEF'; }}
            onMouseLeave={e => { e.currentTarget.style.background = '#fff'; e.currentTarget.style.borderColor = '#D8D3F5'; }}
          >
            <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/>
              <polyline points="17 8 12 3 7 8"/><line x1="12" y1="3" x2="12" y2="15"/>
            </svg>
            Import Faculty
          </button>

          {/* Add Faculty Button */}
          <button
            onClick={() => navigate('/dashboard/faculty/new')}
            style={{
              display: 'inline-flex', alignItems: 'center', gap: 7,
              padding: '8px 18px', borderRadius: 10, border: 'none',
              fontFamily: "'Poppins',sans-serif", fontSize: 12.5, fontWeight: 600,
              cursor: 'pointer', transition: 'all 0.15s',
              background: 'linear-gradient(135deg,#7C6FCD,#5a4fbf)', color: '#fff',
              boxShadow: '0 3px 12px rgba(124,111,205,0.32)',
            }}
            onMouseEnter={e => { e.currentTarget.style.boxShadow = '0 5px 18px rgba(124,111,205,0.42)'; e.currentTarget.style.transform = 'translateY(-1px)' }}
            onMouseLeave={e => { e.currentTarget.style.boxShadow = '0 3px 12px rgba(124,111,205,0.32)'; e.currentTarget.style.transform = 'none' }}
          >
            <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
              <line x1="12" y1="5" x2="12" y2="19"/><line x1="5" y1="12" x2="19" y2="12"/>
            </svg>
            Add Faculty
          </button>
        </div>
      </div>

      {/* ── Search + Filters ── */}
      <div style={{
        background: '#fff', borderRadius: 14, border: '1px solid #E8E4F8',
        padding: '12px 16px', marginBottom: 16,
        display: 'flex', alignItems: 'center', gap: 12, flexWrap: 'wrap',
        boxShadow: '0 2px 8px rgba(124,111,205,0.06)',
      }}>
        {/* Search */}
        <div style={{ position: 'relative', flex: '1 1 220px', minWidth: 180 }}>
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="#B0ABCC" strokeWidth="2"
            style={{ position: 'absolute', left: 11, top: '50%', transform: 'translateY(-50%)', pointerEvents: 'none' }}>
            <circle cx="11" cy="11" r="8"/><line x1="21" y1="21" x2="16.65" y2="16.65"/>
          </svg>
          <input
            placeholder="Search by name or rank…"
            value={search}
            onChange={e => setSearch(e.target.value)}
            style={{
              width: '100%', paddingLeft: 34, paddingRight: 10,
              height: 34, borderRadius: 8, border: '1.5px solid #E8E4F8',
              fontSize: 12.5, fontFamily: "'Poppins',sans-serif", background: '#FAFAFE', outline: 'none',
              boxSizing: 'border-box',
            }}
          />
        </div>

        <div style={{ width: 1, height: 20, background: '#E8E4F8', flexShrink: 0 }} />

        {/* Status filter */}
        <span style={{ fontSize: 10.5, fontWeight: 700, color: '#C0BBDC', textTransform: 'uppercase', letterSpacing: '.7px', whiteSpace: 'nowrap', flexShrink: 0 }}>Status</span>
        <div style={{ display: 'flex', gap: 5 }}>
          <TogglePill label="Full-time" active={statusFilter.includes('full-time')}
            onClick={() => setStatusFilter(p => p.includes('full-time') ? p.filter(x => x !== 'full-time') : [...p, 'full-time'])} />
          <TogglePill label="Part-time" active={statusFilter.includes('part-time')}
            onClick={() => setStatusFilter(p => p.includes('part-time') ? p.filter(x => x !== 'part-time') : [...p, 'part-time'])} />
        </div>

        {/* Select all toggle */}
        {filtered.length > 0 && (
          <>
            <div style={{ width: 1, height: 20, background: '#E8E4F8', flexShrink: 0 }} />
            <div
              onClick={toggleSelectAll}
              style={{ display: 'flex', alignItems: 'center', gap: 7, cursor: 'pointer', fontSize: 12, color: '#8883B0', fontWeight: 500, userSelect: 'none', whiteSpace: 'nowrap' }}
            >
              <Checkbox checked={allSelected} indeterminate={someSelected} />
              {allSelected ? 'Deselect all' : 'Select all'}
            </div>
          </>
        )}

        {/* Clear */}
        {hasFilter && (
          <>
            <div style={{ width: 1, height: 20, background: '#E8E4F8', flexShrink: 0 }} />
            <button onClick={() => { setSearch(''); setStatusFilter([]) }}
              style={{ fontSize: 11.5, color: '#7C6FCD', background: '#EEEAFB', border: 'none', padding: '4px 11px', borderRadius: 99, cursor: 'pointer', fontWeight: 600, fontFamily: "'Poppins',sans-serif", whiteSpace: 'nowrap' }}>
              Clear
            </button>
          </>
        )}
      </div>

      {/* ── Bulk action bar ── */}
      {selectedCount > 0 && (
        <div style={{
          background: 'linear-gradient(135deg,#3D3580,#2E2660)', borderRadius: 12, padding: '10px 18px',
          marginBottom: 16, display: 'flex', alignItems: 'center', gap: 12,
          boxShadow: '0 6px 20px rgba(61,53,128,0.28)', animation: 'slideIn 0.18s ease',
        }}>
          <div style={{ width: 28, height: 28, borderRadius: 8, background: 'rgba(255,255,255,0.14)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
            <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="2.5"><polyline points="20 6 9 17 4 12"/></svg>
          </div>
          <span style={{ fontSize: 13, fontWeight: 600, color: '#fff', flex: 1 }}>
            {selectedCount} faculty member{selectedCount !== 1 ? 's' : ''} selected
          </span>
          <button onClick={() => setSelected(new Set())}
            style={{ background: 'rgba(255,255,255,0.1)', border: '1px solid rgba(255,255,255,0.2)', color: 'rgba(255,255,255,0.85)', fontSize: 12, padding: '5px 14px', borderRadius: 8, cursor: 'pointer', fontFamily: "'Poppins',sans-serif" }}>
            Deselect all
          </button>
          <button onClick={handleBulkDelete} disabled={deleting}
            style={{ background: '#C0392B', border: 'none', color: '#fff', fontSize: 12, fontWeight: 600, padding: '5px 15px', borderRadius: 8, display: 'flex', alignItems: 'center', gap: 5, cursor: 'pointer', fontFamily: "'Poppins',sans-serif", opacity: deleting ? 0.7 : 1 }}>
            <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"><polyline points="3 6 5 6 21 6"/><path d="M19 6l-1 14a2 2 0 0 1-2 2H8a2 2 0 0 1-2-2L5 6"/><path d="M10 11v6M14 11v6"/></svg>
            {deleting ? 'Deleting…' : `Delete ${selectedCount}`}
          </button>
        </div>
      )}

      {/* ── Content ── */}
      {loading ? (
        <div style={{ display: 'flex', alignItems: 'center', gap: 10, color: '#8883B0', fontSize: 13, padding: '40px 0' }}>
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="#A99BE8" strokeWidth="2" style={{ animation: 'spin 1s linear infinite' }}>
            <path d="M21 12a9 9 0 1 1-6.219-8.56"/>
          </svg>
          Loading faculty…
        </div>
      ) : filtered.length === 0 ? (
        <div style={{ textAlign: 'center', padding: '60px 20px', color: '#B0ABCC', animation: 'fadeIn 0.3s' }}>
          <div style={{ width: 56, height: 56, borderRadius: '50%', background: '#F5F4FB', display: 'flex', alignItems: 'center', justifyContent: 'center', margin: '0 auto 14px' }}>
            <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="#D8D3F5" strokeWidth="1.5">
              <path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2"/><circle cx="9" cy="7" r="4"/>
              <path d="M23 21v-2a4 4 0 0 0-3-3.87"/><path d="M16 3.13a4 4 0 0 1 0 7.75"/>
            </svg>
          </div>
          <div style={{ fontSize: 14, fontWeight: 600, color: '#8883B0', marginBottom: 4 }}>
            {faculty.length === 0 ? 'No faculty yet' : 'No faculty match your search'}
          </div>
          <div style={{ fontSize: 12.5, color: '#C0BBDC' }}>
            {faculty.length === 0 ? 'Add your first faculty member to get started.' : 'Try adjusting your search or filters.'}
          </div>
        </div>
      ) : (
        <div style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(auto-fill, minmax(260px, 1fr))',
          gap: 16,
          animation: 'fadeIn 0.25s ease',
        }}>
          {filtered.map(f => (
            <FacultyCard
              key={f.id}
              faculty={f}
              selected={selected.has(f.id)}
              selectionMode={selectionMode}
              onSelect={() => toggleOne(f.id)}
              onClick={() => {
                if (selectionMode) { toggleOne(f.id); return }
                navigate(`/dashboard/faculty/${f.id}`)
              }}
            />
          ))}
        </div>
      )}

      {/* Footer count */}
      {!loading && filtered.length > 0 && (
        <div style={{ marginTop: 18, fontSize: 12, color: '#C0BBDC', textAlign: 'right' }}>
          Showing {filtered.length} of {faculty.length} faculty
          {selectedCount > 0 && <span style={{ marginLeft: 8, color: '#7C6FCD', fontWeight: 600 }}>· {selectedCount} selected</span>}
        </div>
      )}

      {/* ── Modal Rendering ── */}
      {showImport && (
        <ImportFacultyModal 
          onClose={() => setShowImport(false)} 
          onImported={() => {
            load(); 
            setShowImport(false);
          }} 
        />
      )}
    </div>
  )
}