import { useMemo } from 'react'
import G from './tokens'
import { getProgColor, toSafeDate, timeAgo } from './utils'
import { EmptyState, ICONS } from './primitives'

function ActivityTab({ schedules }) {
  const items = useMemo(() => {
    const out = []
    for (const s of schedules) {
      const c = getProgColor(s.programCode)
      if (s.submittedAt) out.push({ t: toSafeDate(s.submittedAt) || new Date(0), c, kind: 'submitted', text: `${s.programCode} submitted "${s.name}" for review` })
      if (s.status === 'approved' && s.approvedAt) out.push({ t: toSafeDate(s.approvedAt) || new Date(0), c, kind: 'approved', text: `${s.programCode}'s "${s.name}" was approved and merged` })
    }
    return out.sort((a, b) => b.t - a.t).slice(0, 40)
  }, [schedules])

  const KIND_META = {
    submitted: { bg: G.amberSoft, color: '#92400E', icon: <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"><path d="M22 12h-6l-2 3h-4l-2-3H2"/><path d="M5.45 5.11 2 12v6a2 2 0 0 0 2 2h16a2 2 0 0 0 2-2v-6l-3.45-6.89A2 2 0 0 0 16.76 4H7.24a2 2 0 0 0-1.79 1.11z"/></svg> },
    approved: { bg: G.meadowSoft, color: 'var(--meadow-text)', icon: <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"><polyline points="20 6 9 17 4 12"/></svg> },
  }

  return (
    <div className="ap-card ap-fadein">
      <div className="aq-head" style={{ borderRadius: 0 }}>
        <div style={{ minWidth: 0 }}>
          <div className="aq-head-title">Recent Activity</div>
          <div className="aq-head-sub">Submissions and approvals across all coordinators</div>
        </div>
      </div>
      {items.length === 0 ? (
        <EmptyState icon={ICONS.activity} text="Nothing has happened yet — activity shows up here as coordinators submit and you approve schedules." />
      ) : (
        <div>
          {items.map((it, i) => {
            const m = KIND_META[it.kind]
            return (
              <div key={i} className="ap-row">
                <div style={{ width: 30, height: 30, borderRadius: 8, background: m.bg, color: m.color, display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>{m.icon}</div>
                <div style={{ flex: 1, fontSize: 12.5, color: G.ink, fontWeight: 500 }}>{it.text}</div>
                <div style={{ fontSize: 11, color: G.muted, flexShrink: 0, fontFamily: "'IBM Plex Mono',monospace" }}>{timeAgo(it.t)}</div>
              </div>
            )
          })}
        </div>
      )}
    </div>
  )
}

export default ActivityTab
