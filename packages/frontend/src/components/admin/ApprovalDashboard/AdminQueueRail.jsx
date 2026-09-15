import G from './tokens'
import { STATUS } from './constants'

function AdminQueueRail({ programs, statuses, turnIndex }) {
  if (!programs || programs.length === 0) return null
  const n = programs.length
  const CIRCLE = 30
  const MIN_COL = 68
  return (
    <div style={{ width: '100%', overflowX: 'auto' }}>
      <div style={{ position: 'relative', minWidth: n * MIN_COL }}>
        {n > 1 && (
          <div style={{ position: 'absolute', top: CIRCLE / 2 - 1, left: `${50 / n}%`, right: `${50 / n}%`, height: 2 }}>
            {programs.slice(0, -1).map((prog, i) => (
              <div key={prog} style={{
                position: 'absolute', left: `${(i / (n - 1)) * 100}%`, width: `${100 / (n - 1)}%`, height: 2, borderRadius: 99,
                background: i < turnIndex ? G.meadowBorder : G.border,
              }} />
            ))}
          </div>
        )}
        <div style={{ display: 'flex', position: 'relative' }}>
          {programs.map((prog, i) => {
            const s = statuses[prog] || 'waiting'
            const stm = STATUS[s] || STATUS.waiting
            const isCurrent = i === turnIndex
            return (
              <div key={prog} style={{ flex: '1 1 0', minWidth: MIN_COL, display: 'flex', flexDirection: 'column', alignItems: 'center' }}>
                <div style={{
                  width: CIRCLE, height: CIRCLE, borderRadius: '50%', flexShrink: 0,
                  background: s === 'active' ? G.meadow : stm.bg,
                  border: `2px solid ${stm.dot}`,
                  display: 'flex', alignItems: 'center', justifyContent: 'center',
                  boxShadow: s === 'active' ? `0 0 0 5px ${stm.dot}22` : 'none',
                  transition: 'all .25s',
                }}>
                  {s === 'approved'
                    ? <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke={stm.color} strokeWidth="3"><polyline points="20 6 9 17 4 12"/></svg>
                    : s === 'generating'
                      ? <svg className="ap-spin" width="13" height="13" viewBox="0 0 24 24" fill="none" stroke={stm.color} strokeWidth="3"><path d="M21 12a9 9 0 1 1-6.22-8.56"/></svg>
                      : s === 'submitted'
                        ? <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke={stm.color} strokeWidth="2.5"><path d="M22 12h-6l-2 3h-4l-2-3H2"/><path d="M5.45 5.11 2 12v6a2 2 0 0 0 2 2h16a2 2 0 0 0 2-2v-6l-3.45-6.89A2 2 0 0 0 16.76 4H7.24a2 2 0 0 0-1.79 1.11z"/></svg>
                        : s === 'active'
                          ? <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="#fff" strokeWidth="3"><polygon points="5 3 19 12 5 21 5 3"/></svg>
                          : s === 'skipped'
                            ? <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke={stm.color} strokeWidth="2.5"><polyline points="13 17 18 12 13 7"/><polyline points="6 17 11 12 6 7"/></svg>
                            : <span style={{ width: 7, height: 7, borderRadius: '50%', background: stm.dot }} />}
                </div>
                <div style={{ marginTop: 7, textAlign: 'center' }}>
                  <div style={{ fontSize: 11.5, fontWeight: isCurrent ? 800 : 700, color: isCurrent ? 'var(--meadow-text)' : G.ink, whiteSpace: 'nowrap' }}>{prog}</div>
                  <div style={{ fontSize: 9, fontWeight: 800, color: stm.color, letterSpacing: '.4px', textTransform: 'uppercase', whiteSpace: 'nowrap', marginTop: 2 }}>{stm.label}</div>
                </div>
              </div>
            )
          })}
        </div>
      </div>
    </div>
  )
}

// Header banner copy — mirrors the coordinator side's "It's your turn" /
// "Waiting in line" head, but written from the admin's vantage point.
function queueHeadCopy(programs, statuses, turnIndex) {
  if (!programs.length) return { title: 'No queue', subtitle: '' }
  if (turnIndex >= programs.length) return { title: 'Queue complete', subtitle: 'This queue is closed.' }
  const prog = programs[turnIndex]
  const s = statuses[prog] || 'waiting'
  if (s === 'generating') return { title: `${prog} is generating`, subtitle: 'Their schedule is being solved right now.' }
  if (s === 'submitted') return { title: `${prog} submitted`, subtitle: 'Waiting on your review to advance the queue.' }
  return { title: `${prog}'s turn`, subtitle: 'Picking rooms and building their schedule now.' }
}

export { AdminQueueRail, queueHeadCopy }
export default AdminQueueRail
