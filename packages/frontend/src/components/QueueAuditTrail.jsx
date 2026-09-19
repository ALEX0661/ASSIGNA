import React, { useEffect, useState, useCallback } from 'react';
import { getQueueAuditLogs } from '../services/api';

function formatRelativeTime(dateString) {
  if (!dateString) return '';
  const rtf = new Intl.RelativeTimeFormat('en', { numeric: 'auto' });
  const date = new Date(dateString);
  const now = new Date();
  const diffInMs = date - now;
  const diffInSecs = Math.round(diffInMs / 1000);
  const diffInMins = Math.round(diffInSecs / 60);
  const diffInHours = Math.round(diffInMins / 60);
  const diffInDays = Math.round(diffInHours / 24);

  if (Math.abs(diffInDays) > 0) return rtf.format(diffInDays, 'day');
  if (Math.abs(diffInHours) > 0) return rtf.format(diffInHours, 'hour');
  if (Math.abs(diffInMins) > 0) return rtf.format(diffInMins, 'minute');
  return rtf.format(diffInSecs, 'second');
}

const ACTION_UI = {
  QUEUE_CREATED: { color: 'var(--meadow-text)', bg: 'var(--meadow-soft)', icon: <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"><rect x="3" y="4" width="18" height="18" rx="2"/><line x1="16" y1="2" x2="16" y2="6"/><line x1="8" y1="2" x2="8" y2="6"/><line x1="3" y1="10" x2="21" y2="10"/></svg> },
  QUEUE_REORDERED: { color: '#D97706', bg: 'rgba(217, 119, 6, 0.1)', icon: <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"><line x1="8" y1="6" x2="21" y2="6"/><line x1="8" y1="12" x2="21" y2="12"/><line x1="8" y1="18" x2="21" y2="18"/><line x1="3" y1="6" x2="3.01" y2="6"/><line x1="3" y1="12" x2="3.01" y2="12"/><line x1="3" y1="18" x2="3.01" y2="18"/></svg> },
  PROGRAM_SKIPPED: { color: '#D97706', bg: 'rgba(217, 119, 6, 0.1)', icon: <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"><polygon points="5 4 15 12 5 20 5 4"/><line x1="19" y1="5" x2="19" y2="19"/></svg> },
  QUEUE_ADVANCED: { color: 'var(--meadow-text)', bg: 'var(--meadow-soft)', icon: <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"><line x1="5" y1="12" x2="19" y2="12"/><polyline points="12 5 19 12 12 19"/></svg> },
  QUEUE_FINISHED: { color: 'var(--meadow-text)', bg: 'var(--meadow-soft)', icon: <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"><path d="M22 11.08V12a10 10 0 1 1-5.93-9.14"/><polyline points="22 4 12 14.01 9 11.01"/></svg> },
  SCHEDULE_APPROVED: { color: 'var(--meadow-text)', bg: 'var(--meadow-soft)', icon: <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"><polyline points="20 6 9 17 4 12"/></svg> },
  SCHEDULE_REJECTED: { color: '#DC2626', bg: 'rgba(220, 38, 38, 0.1)', icon: <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"><circle cx="12" cy="12" r="10"/><line x1="15" y1="9" x2="9" y2="15"/><line x1="9" y1="9" x2="15" y2="15"/></svg> },
  SCHEDULE_UNAPPROVED: { color: '#DC2626', bg: 'rgba(220, 38, 38, 0.1)', icon: <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"><path d="M3 12a9 9 0 1 0 3-6.7"/><polyline points="3 4 3 9 8 9"/></svg> },
  GENERATION_STARTED: { color: '#0891B2', bg: '#CFFAFE', icon: <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"><polygon points="13 2 3 14 12 14 11 22 21 10 12 10 13 2"/></svg> },
  SCHEDULE_SUBMITTED: { color: 'var(--meadow-text)', bg: 'var(--meadow-soft)', icon: <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"><path d="M22 2L11 13"/><polygon points="22 2 15 22 11 13 2 9 22 2"/></svg> },
  SCHEDULE_EDITED: { color: '#2563EB', bg: 'rgba(37, 99, 235, 0.1)', icon: <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"><path d="M12 20h9"/><path d="M16.5 3.5a2.12 2.12 0 0 1 3 3L7 19l-4 1 1-4Z"/></svg> },
  DEFAULT: { color: 'var(--muted)', bg: 'var(--hover)', icon: <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"><circle cx="12" cy="12" r="10"/><line x1="12" y1="8" x2="12" y2="12"/><line x1="12" y1="16" x2="12.01" y2="16"/></svg> }
};

function parseDetails(details) {
  if (!details) return null;
  if (!details.includes(' | ')) return <div style={{ fontSize: 13, color: 'var(--muted)', lineHeight: 1.4 }}>{details}</div>;

  const parts = details.split(' | ');
  const title = parts[0];
  const diffs = parts.slice(1);

  return (
    <div>
      <div style={{ fontSize: 13, color: 'var(--muted)', marginBottom: 6 }}>{title}</div>
      <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
        {diffs.map((diff, i) => {
          const isAdd = diff.startsWith('Added:');
          const isRem = diff.startsWith('Removed:');
          const color = isAdd ? '#059669' : isRem ? '#DC2626' : 'var(--ink)';
          const bg = isAdd ? 'rgba(5,150,105,0.08)' : isRem ? 'rgba(220,38,38,0.08)' : 'var(--hover)';
          const text = diff.replace(/^(Added:|Removed:)\s*/, '');
          const label = isAdd ? '+' : isRem ? '-' : '•';
          
          return (
            <div key={i} style={{ 
              display: 'flex', gap: 8, padding: '6px 10px', borderRadius: 6, 
              background: bg, color: color, fontSize: 12, lineHeight: 1.4,
              fontFamily: "'IBM Plex Mono', monospace" 
            }}>
              <span style={{ fontWeight: 800 }}>{label}</span>
              <span style={{ fontWeight: 500 }}>{text}</span>
            </div>
          );
        })}
      </div>
    </div>
  );
}

export default function QueueAuditTrail({ queueId }) {
  const [logs, setLogs] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  const loadLogs = useCallback(async (silent = false) => {
    if (!queueId) return;
    if (!silent) setLoading(true);
    try {
      const data = await getQueueAuditLogs(queueId);
      setLogs(data);
      setError(null);
    } catch (err) {
      console.error('Error fetching audit logs:', err);
      setError('Failed to load audit logs.');
    } finally {
      setLoading(false);
    }
  }, [queueId]);

  useEffect(() => {
    loadLogs();
  }, [loadLogs]);

  if (!queueId) return null;

  return (
    <div className="d-card ap-card queue-audit-trail" style={{ display: 'flex', flexDirection: 'column', flex: 1, minHeight: 250, maxHeight: 600, marginBottom: 20 }}>
      <div style={{ padding: '20px 24px', borderBottom: '1px solid var(--border)', display: 'flex', alignItems: 'center', justifyContent: 'space-between', background: 'var(--surface)' }}>
        <div>
          <div style={{ fontSize: 16, fontWeight: 800, color: 'var(--ink)' }}>Queue Audit Trail</div>
          <div style={{ fontSize: 13, color: 'var(--muted)' }}>Live updates of actions taken on this queue</div>
        </div>
        <button 
          onClick={() => loadLogs(true)} 
          disabled={loading}
          className={`cd-refresh-btn ${loading ? 'spinning' : ''}`}
          style={{ width: 'auto', padding: '6px 12px', fontSize: 12, fontWeight: 700 }}
        >
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"><path d="M21 12a9 9 0 0 0-9-9 9.75 9.75 0 0 0-6.74 2.74L3 8"/><path d="M3 3v5h5"/><path d="M3 12a9 9 0 0 0 9 9 9.75 9.75 0 0 0 6.74-2.74L21 16"/><path d="M16 21v-5h5"/></svg>
          Refresh
        </button>
      </div>
      
      {loading && logs.length === 0 && <div style={{ padding: 24, fontSize: 13, color: 'var(--muted)' }}>Loading activity...</div>}
      {error && <div style={{ padding: 24, fontSize: 13, color: '#DC2626' }}>{error}</div>}
      
      {!loading && !error && logs.length === 0 && (
        <div style={{ padding: 24, fontSize: 13, color: 'var(--muted)' }}>No recent activity found.</div>
      )}

      {logs.length > 0 && (
        <div style={{ overflowY: 'auto', padding: '16px 24px' }} className="cd-sched-scroll">
          {logs.map((log) => {
            const ui = ACTION_UI[log.action] || ACTION_UI.DEFAULT;
            return (
              <div key={log.id || log.timestamp} style={{ display: 'flex', gap: 14, marginBottom: 18, position: 'relative' }}>
                <div style={{ width: 1.5, background: 'var(--border)', position: 'absolute', top: 28, bottom: -20, left: 16 }} />
                <div style={{ width: 34, height: 34, borderRadius: 10, background: ui.bg, display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0, zIndex: 1, color: ui.color }}>
                  {ui.icon}
                </div>
                <div style={{ flex: 1, paddingBottom: 4 }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 4 }}>
                    <span style={{ fontSize: 13.5, fontWeight: 700, color: 'var(--ink)' }}>{log.actorName}</span>
                    <span style={{ fontSize: 11, padding: '2px 8px', borderRadius: 99, background: 'var(--hover)', color: 'var(--muted)', textTransform: 'capitalize', fontWeight: 600 }}>
                      {log.actorRole}
                    </span>
                    <span style={{ fontSize: 11, color: 'var(--muted2)', fontWeight: 500 }}>
                      {log.timestamp ? formatRelativeTime(log.timestamp) : ''}
                    </span>
                  </div>
                  {parseDetails(log.details)}
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
