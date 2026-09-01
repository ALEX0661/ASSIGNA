import { useState } from 'react'
import { restoreScheduleVersion, getScheduleVersionDiff } from '../services/api'

function formatTimeAgo(date) {
  const d = typeof date === 'string' ? new Date(date) : date
  const diff = Date.now() - d.getTime()
  const seconds = Math.floor(diff / 1000)
  const minutes = Math.floor(diff / (1000 * 60))
  const hours   = Math.floor(diff / (1000 * 60 * 60))
  const days    = Math.floor(diff / (1000 * 60 * 60 * 24))
  const months  = Math.floor(days / 30)
  const years   = Math.floor(days / 365)

  if (seconds < 10) return 'just now'
  if (seconds < 60) return `${seconds}s ago`
  if (minutes === 1) return '1 min ago'
  if (minutes < 60) return `${minutes}m ago`
  if (hours === 1)  return '1 hr ago'
  if (hours < 24)   return `${hours}h ago`
  if (days === 1)   return '1 day ago'
  if (days < 30)    return `${days}d ago`
  if (months === 1) return '1 month ago'
  if (months < 12)  return `${months} months ago`
  if (years === 1)  return '1 year ago'
  return `${years} years ago`
}

function formatFullTimestamp(date) {
  const d = typeof date === 'string' ? new Date(date) : date
  return d.toLocaleString('en-PH', {
    timeZone: 'Asia/Manila',
    month: 'short',
    day: 'numeric',
    year: 'numeric',
    hour: 'numeric',
    minute: '2-digit',
    hour12: true,
  })
}

// ── Changelog helpers ──────────────────────────────────────────────────────

const FIELD_LABELS = {
  room: 'Room',
  faculty: 'Faculty',
  day: 'Day',
  period: 'Period',
  courseCode: 'Course',
  block: 'Block',
  session: 'Session',
  program: 'Program',
  year: 'Year Level',
  title: 'Title',
}

function fieldLabel(key) {
  if (FIELD_LABELS[key]) return FIELD_LABELS[key]
  // Fallback for any field not in the map above (e.g. a newly added event
  // field) — turn "someNewField" into "Some New Field" instead of hiding it.
  return key
    .replace(/([a-z])([A-Z])/g, '$1 $2')
    .replace(/^./, c => c.toUpperCase())
}

function sessionTitle(s) {
  const course = s.courseCode || 'Untitled session'
  const yearBlock = `${s.year ?? ''}${s.block ?? ''}`.trim()
  if (s.program && yearBlock) return `${course} - ${s.program} ${yearBlock}`
  if (yearBlock) return `${course} ${yearBlock}`
  return course
}

function sessionMeta(s) {
  const schedule = [s.day, s.period].filter(Boolean).join(' ')
  return [s.faculty, s.room, schedule].filter(Boolean).join(' · ')
}

/** One added/removed session row. */
function ChangelogSessionRow({ session, kind }) {
  return (
    <div className={`sv-changelog-row sv-changelog-row-${kind}`}>
      <span className="sv-changelog-marker">{kind === 'added' ? '+' : '–'}</span>
      <div className="sv-changelog-row-body">
        <div className="sv-changelog-row-title">{sessionTitle(session)}</div>
        {sessionMeta(session) && <div className="sv-changelog-row-meta">{sessionMeta(session)}</div>}
      </div>
    </div>
  )
}

/** One modified session row, with per-field from → to changes.
 *  Day + Period are merged into a single "moved" line when both changed
 *  together, since "Day: Mon → Wed" and "Period: 7:00–8:30 → 9:00–10:30"
 *  read as two disconnected facts when they're really one move. */
function ChangelogModifiedRow({ session }) {
  const changes = { ...(session.changes || {}) }
  const rows = []

  if (changes.day && changes.period) {
    rows.push({
      label: 'Schedule',
      from: [changes.day.from, changes.period.from].filter(Boolean).join(' · '),
      to:   [changes.day.to,   changes.period.to].filter(Boolean).join(' · '),
    })
    delete changes.day
    delete changes.period
  }

  Object.entries(changes).forEach(([field, { from, to }]) => {
    rows.push({ label: fieldLabel(field), from, to })
  })

  return (
    <div className="sv-changelog-row sv-changelog-row-modified">
      <span className="sv-changelog-marker">~</span>
      <div className="sv-changelog-row-body">
        <div className="sv-changelog-row-title">
          {sessionTitle(session)}
          <span className="sv-changelog-field-count"> · {rows.length} field{rows.length !== 1 ? 's' : ''} changed</span>
        </div>
        <div className="sv-changelog-field-list">
          {rows.map(({ label, from, to }) => (
            <div key={label} className="sv-changelog-field">
              <span className="sv-changelog-field-label">{label}:</span>
              <span className="sv-changelog-field-from">{from || '—'}</span>
              <span className="sv-changelog-field-arrow">→</span>
              <span className="sv-changelog-field-to">{to || '—'}</span>
            </div>
          ))}
        </div>
      </div>
    </div>
  )
}

/** The expandable changelog panel for a single version row. */
function ChangelogPanel({ diff, loading, error }) {
  if (loading) {
    return (
      <div className="sv-changelog-panel sv-changelog-loading">
        <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" style={{ animation: 'spin 0.8s linear infinite' }}>
          <path d="M21 12a9 9 0 1 1-6.219-8.56"/>
        </svg>
        Loading changelog…
      </div>
    )
  }

  if (error) {
    return <div className="sv-changelog-panel sv-changelog-error">Couldn't load changes for this version.</div>
  }

  if (!diff) return null

  const { added = [], removed = [], modified = [] } = diff
  const isEmpty = added.length === 0 && removed.length === 0 && modified.length === 0

  return (
    <div className="sv-changelog-panel">
      {diff.comparedTo == null && (
        <div className="sv-changelog-note">First recorded version — shown as all sessions added.</div>
      )}

      {isEmpty ? (
        <div className="sv-changelog-note">No session-level changes detected between these saves.</div>
      ) : (
        <>
          <div className="sv-changelog-summary">
            {added.length > 0 && <span className="sv-changelog-pill sv-pill-added">+{added.length} added</span>}
            {removed.length > 0 && <span className="sv-changelog-pill sv-pill-removed">−{removed.length} removed</span>}
            {modified.length > 0 && <span className="sv-changelog-pill sv-pill-modified">~{modified.length} modified</span>}
          </div>

          {modified.length > 0 && (
            <div className="sv-changelog-section">
              {modified.map((s, i) => <ChangelogModifiedRow key={s.schedule_id || i} session={s} />)}
            </div>
          )}
          {added.length > 0 && (
            <div className="sv-changelog-section">
              {added.map((s, i) => <ChangelogSessionRow key={s.schedule_id || i} session={s} kind="added" />)}
            </div>
          )}
          {removed.length > 0 && (
            <div className="sv-changelog-section">
              {removed.map((s, i) => <ChangelogSessionRow key={s.schedule_id || i} session={s} kind="removed" />)}
            </div>
          )}
        </>
      )}
    </div>
  )
}

// ── Main modal ───────────────────────────────────────────────────────────

const VersionHistoryModal = ({
  versionHistory,
  currentVersion,
  scheduleName,
  currentSavedAt,
  isRestoredPreview = false,
  onClose,
  onRestore,
  // Let a caller (e.g. the coordinator editor) redirect restore/diff calls
  // to its own scoped endpoints instead of the admin-only ones these
  // default to. Each takes just (version) — the caller closes over
  // whatever id/name it needs.
  restoreFn,
  diffFn,
}) => {
  const [restoring, setRestoring] = useState(null)
  const [error, setError] = useState(null)

  // Changelog state: which version row is expanded, and a small cache so
  // re-expanding a row you already opened doesn't re-fetch.
  const [expandedVersion, setExpandedVersion] = useState(null)
  const [diffCache, setDiffCache] = useState({})       // version -> diff object
  const [diffLoading, setDiffLoading] = useState(null) // version currently fetching
  const [diffErrors, setDiffErrors] = useState({})     // version -> true

  const handleRestore = async (version) => {
    if (restoring) return
    setRestoring(version.version)
    setError(null)
    try {
      const result = restoreFn
        ? await restoreFn(version.version)
        : await restoreScheduleVersion(scheduleName, version.version)
      // Close modal first, then let the parent reload + show a toast
      onClose()
      if (onRestore) onRestore(result)
    } catch (err) {
      console.error('Restore failed:', err)
      setError('Restore failed. Please try again.')
      setRestoring(null)
    }
  }

  const toggleChangelog = async (version) => {
    if (expandedVersion === version) {
      setExpandedVersion(null)
      return
    }
    setExpandedVersion(version)
    if (diffCache[version] || diffLoading === version) return

    setDiffLoading(version)
    setDiffErrors(prev => ({ ...prev, [version]: false }))
    try {
      const data = diffFn
        ? await diffFn(version)
        : await getScheduleVersionDiff(scheduleName, version)
      setDiffCache(prev => ({ ...prev, [version]: data }))
    } catch (err) {
      console.error('Changelog fetch failed:', err)
      setDiffErrors(prev => ({ ...prev, [version]: true }))
    } finally {
      setDiffLoading(null)
    }
  }

  const sorted = versionHistory
    ? [...versionHistory].filter(v => v.version !== currentVersion).reverse()
    : []

  return (
    <div className="sv-version-modal" onClick={onClose}>
      <div className="sv-version-content enhanced" onClick={e => e.stopPropagation()}>

        {/* Header */}
        <div className="sv-version-header">
          <div>
            <h3>Version History</h3>
            <p style={{ margin: '4px 0 0', fontSize: 12, color: '#6b7280', fontWeight: 500 }}>
              {scheduleName} · {sorted.length > 0 ? `${sorted.length} previous save${sorted.length !== 1 ? 's' : ''}` : 'no previous saves yet'}
            </p>
          </div>
          <button onClick={onClose} className="sv-version-close">×</button>
        </div>

        <div className="sv-version-list">
          {/* Current version row */}
          <div className="sv-version-item-wrap">
            <div className={`sv-version-item current${isRestoredPreview ? ' preview' : ''}`}>
              <div className={`sv-version-badge current${isRestoredPreview ? ' preview' : ''}`}>v{currentVersion}</div>
              <div className="sv-version-details">
                <div className="sv-version-label">
                  {isRestoredPreview
                    ? `Currently viewing v${currentVersion} — restored ${formatTimeAgo(currentSavedAt)}, not saved`
                    : `Current — saved ${formatTimeAgo(currentSavedAt)}`}
                </div>
                <div className="sv-version-meta">
                  {currentSavedAt ? formatFullTimestamp(currentSavedAt) : '—'}
                </div>
              </div>
              <div className="sv-version-actions">
                {!isRestoredPreview && (
                  <button
                    onClick={() => toggleChangelog(currentVersion)}
                    className={`sv-changelog-toggle${expandedVersion === currentVersion ? ' open' : ''}`}
                    title="View what changed since the last save"
                  >
                    <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" style={{ transform: expandedVersion === currentVersion ? 'rotate(180deg)' : 'none', transition: 'transform .15s' }}>
                      <polyline points="6 9 12 15 18 9"/>
                    </svg>
                    Changes
                  </button>
                )}
                <span className={`sv-status-badge${isRestoredPreview ? ' preview' : ' current'}`}>
                  {isRestoredPreview ? 'Unsaved' : 'Saved'}
                </span>
              </div>
            </div>
            {!isRestoredPreview && expandedVersion === currentVersion && (
              <ChangelogPanel
                diff={diffCache[currentVersion]}
                loading={diffLoading === currentVersion}
                error={!!diffErrors[currentVersion]}
              />
            )}
          </div>

          {/* No history state */}
          {sorted.length === 0 && (
            <div style={{ padding: '24px 0', textAlign: 'center', color: '#6b7280', fontSize: 13 }}>
              No previous versions yet. Each time you save with actual changes, a restore point is created here.
            </div>
          )}

          {/* Previous version rows */}
          {sorted.map((v, i) => {
            const isRestoring = restoring === v.version
            const isExpanded  = expandedVersion === v.version
            return (
              <div key={i} className="sv-version-item-wrap">
                <div className="sv-version-item">
                  <div className="sv-version-badge">v{v.version}</div>
                  <div className="sv-version-details">
                    <div className="sv-version-label">Saved {formatTimeAgo(v.savedAt)}</div>
                    <div className="sv-version-meta">
                      {formatFullTimestamp(v.savedAt)}
                      {v.eventCount != null ? ` · ${v.eventCount} sessions` : ''}
                      {v.user && v.user !== 'unknown' ? ` · ${v.user}` : ''}
                    </div>
                  </div>
                  <div className="sv-version-actions">
                    <button
                      onClick={() => toggleChangelog(v.version)}
                      className={`sv-changelog-toggle${isExpanded ? ' open' : ''}`}
                      title="View what changed in this save"
                    >
                      <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" style={{ transform: isExpanded ? 'rotate(180deg)' : 'none', transition: 'transform .15s' }}>
                        <polyline points="6 9 12 15 18 9"/>
                      </svg>
                      Changes
                    </button>
                    <button
                      onClick={() => handleRestore(v)}
                      disabled={!!restoring}
                      className="sv-restore-btn"
                      title={`Load the schedule as it was in v${v.version}`}
                    >
                      {isRestoring ? (
                        <>
                          <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" style={{ animation: 'spin 0.8s linear infinite' }}>
                            <path d="M21 12a9 9 0 1 1-6.219-8.56"/>
                          </svg>
                          Loading…
                        </>
                      ) : (
                        <>
                          <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
                            <polyline points="1 4 1 10 7 10"/>
                            <path d="M3.51 15a9 9 0 1 0 2.13-9.36L1 10"/>
                          </svg>
                          Load
                        </>
                      )}
                    </button>
                  </div>
                </div>
                {isExpanded && (
                  <ChangelogPanel
                    diff={diffCache[v.version]}
                    loading={diffLoading === v.version}
                    error={!!diffErrors[v.version]}
                  />
                )}
              </div>
            )
          })}
        </div>

        {/* Footer */}
        <div className="sv-version-footer">
          {error ? (
            <span style={{ color: '#EF4444', fontSize: 12 }}>{error}</span>
          ) : (
            <span style={{ fontSize: 11, color: '#9ca3af' }}>
              Loading a version replaces the current view — save to keep it
            </span>
          )}
        </div>
      </div>

      <style>{`
        .sv-version-modal {
          position: fixed; inset: 0; background: rgba(0,0,0,0.45);
          display: flex; align-items: center; justify-content: center;
          z-index: 1000; animation: svFadeIn 0.18s ease;
        }
        .sv-version-content.enhanced {
          background: white; border-radius: 12px; width: 92%;
          max-width: 480px; max-height: 78vh; display: flex;
          flex-direction: column; box-shadow: 0 16px 40px rgba(0,0,0,0.18);
          animation: svSlideIn 0.22s ease;
        }
        .sv-version-header {
          display: flex; align-items: flex-start; justify-content: space-between;
          padding: 18px 22px 14px; border-bottom: 1px solid #e5e7eb;
        }
        .sv-version-header h3 { margin: 0; font-size: 16px; font-weight: 700; color: var(--ink); }
        .sv-version-close {
          background: none; border: none; font-size: 22px; cursor: pointer;
          color: #9ca3af; padding: 2px 5px; line-height: 1; border-radius: 5px;
        }
        .sv-version-close:hover { color: var(--ink); background: #f3f4f6; }
        .sv-version-list { overflow-y: auto; flex: 1; padding: 10px 22px 14px; }
        .sv-version-item {
          display: flex; align-items: center; gap: 12px;
          padding: 12px 0; border-bottom: 1px solid #f3f4f6;
        }
        .sv-version-item-wrap:last-child .sv-version-item { border-bottom: none; }
        .sv-version-item-wrap:last-child:not(:has(.sv-changelog-panel)) { margin-bottom: 0; }
        .sv-version-item.current {
          background: rgba(34,197,94,0.06); margin: 0 -22px 6px;
          padding: 12px 22px; border-radius: 8px; border-bottom: 1px solid var(--meadow-border);
        }
        .sv-version-item.current.preview {
          background: rgba(245,158,11,0.08); border-bottom: 1px solid #fde68a;
        }
        .sv-version-badge {
          background: #f3f4f6; color: #6b7280; padding: 4px 8px;
          border-radius: 6px; font-size: 10.5px; font-weight: 700;
          font-family: 'SF Mono', Consolas, monospace; flex-shrink: 0; min-width: 38px; text-align: center;
        }
        .sv-version-badge.current { background: var(--meadow); color: white; }
        .sv-version-badge.current.preview { background: #f59e0b; }
        .sv-version-details { flex: 1; min-width: 0; }
        .sv-version-label { font-size: 13px; font-weight: 600; color: var(--ink); }
        .sv-version-meta { font-size: 11px; color: #6b7280; margin-top: 1px; }
        .sv-version-actions { flex-shrink: 0; display: flex; align-items: center; gap: 6px; }
        .sv-restore-btn {
          display: inline-flex; align-items: center; gap: 5px;
          padding: 6px 11px; border: 1px solid #d1d5db; background: white;
          color: var(--muted); font-size: 11.5px; font-weight: 600; border-radius: 6px;
          cursor: pointer; transition: all 0.14s; font-family: 'Inter', sans-serif;
        }
        .sv-restore-btn:hover:not(:disabled) { background: #f3f4f6; border-color: #9ca3af; }
        .sv-restore-btn:disabled { opacity: 0.5; cursor: not-allowed; }
        .sv-status-badge {
          padding: 3px 8px; border-radius: 6px; font-size: 10.5px;
          font-weight: 600; text-transform: uppercase; letter-spacing: 0.4px; flex-shrink: 0;
        }
        .sv-status-badge.current { background: var(--meadow-soft); color: var(--meadow-mid); border: 1px solid var(--meadow-border); }
        .sv-status-badge.preview { background: #fef3c7; color: #92400e; border: 1px solid #fde68a; }
        .sv-version-footer {
          padding: 12px 22px; border-top: 1px solid #e5e7eb;
          background: var(--surface); border-radius: 0 0 12px 12px;
          display: flex; align-items: center; justify-content: center;
        }

        /* ── Changelog toggle + panel ──────────────────────────────── */
        .sv-changelog-toggle {
          display: inline-flex; align-items: center; gap: 4px;
          padding: 6px 9px; border: 1px solid transparent; background: transparent;
          color: #6b7280; font-size: 11.5px; font-weight: 600; border-radius: 6px;
          cursor: pointer; transition: all 0.14s; font-family: 'Inter', sans-serif;
        }
        .sv-changelog-toggle:hover { background: #f3f4f6; color: var(--muted); }
        .sv-changelog-toggle.open { background: #eef2ff; color: #4338ca; }

        .sv-changelog-panel {
          margin: 0 0 10px; padding: 12px 14px; background: #fafafa;
          border: 1px solid #eef0f2; border-radius: 8px; animation: svFadeIn 0.15s ease;
        }
        .sv-changelog-loading, .sv-changelog-error {
          display: flex; align-items: center; gap: 7px;
          font-size: 12px; color: #6b7280;
        }
        .sv-changelog-error { color: #b91c1c; }
        .sv-changelog-note { font-size: 12px; color: #6b7280; font-style: italic; }
        .sv-changelog-summary { display: flex; gap: 6px; flex-wrap: wrap; margin-bottom: 10px; }
        .sv-changelog-pill {
          font-size: 10.5px; font-weight: 700; padding: 3px 9px; border-radius: 99px;
        }
        .sv-pill-added    { background: var(--meadow-soft); color: var(--meadow-mid); }
        .sv-pill-removed  { background: #fee2e2; color: #b91c1c; }
        .sv-pill-modified { background: #fef3c7; color: #92400e; }

        .sv-changelog-section + .sv-changelog-section { margin-top: 8px; padding-top: 8px; border-top: 1px dashed #e5e7eb; }
        .sv-changelog-row { display: flex; gap: 8px; padding: 5px 0; }
        .sv-changelog-marker {
          flex-shrink: 0; width: 16px; text-align: center; font-weight: 800; font-size: 12px;
          font-family: 'SF Mono', Consolas, monospace; line-height: 1.4;
        }
        .sv-changelog-row-added   .sv-changelog-marker { color: var(--meadow); }
        .sv-changelog-row-removed .sv-changelog-marker { color: #dc2626; }
        .sv-changelog-row-modified .sv-changelog-marker { color: #d97706; }
        .sv-changelog-row-body { flex: 1; min-width: 0; }
        .sv-changelog-row-title { font-size: 12.5px; font-weight: 600; color: var(--ink); }
        .sv-changelog-field-count { font-size: 11px; font-weight: 500; color: #9ca3af; }
        .sv-changelog-row-meta { font-size: 11px; color: #6b7280; margin-top: 1px; }
        .sv-changelog-field-list { margin-top: 3px; display: flex; flex-direction: column; gap: 2px; }
        .sv-changelog-field { font-size: 11px; display: flex; align-items: center; gap: 5px; flex-wrap: wrap; }
        .sv-changelog-field-label { color: #6b7280; font-weight: 600; }
        .sv-changelog-field-from { color: #b91c1c; text-decoration: line-through; opacity: 0.75; }
        .sv-changelog-field-arrow { color: #9ca3af; }
        .sv-changelog-field-to { color: var(--meadow-mid); font-weight: 600; }

        @keyframes svFadeIn { from{opacity:0} to{opacity:1} }
        @keyframes svSlideIn { from{opacity:0;transform:translateY(8px)} to{opacity:1;transform:translateY(0)} }
        @keyframes spin { to{transform:rotate(360deg)} }
      `}</style>
    </div>
  )
}

export default VersionHistoryModal