import { useEffect, useState } from 'react'
import { getPublishImpact, getMasterPublishImpact, getActiveQueue } from '../../services/api'

/* ── Impact lookups ───────────────────────────────────────────────────────
   Both hooks run ONLY while a confirm modal is open (never on page load,
   never polled), and cache per term/queue for 30s so re-opening costs nothing.
   Publishing/unpublishing never waits on them — if a lookup fails the modal
   falls back to a short generic line and the action still works.

   - usePublishImpact        → /schedule/publish-impact  (1 indexed read)
   - useMasterPublishImpact  → /approval/master/{id}/publish-impact
                               (a few indexed reads, only on modal open)      */
const cache = new Map()
const TTL = 30_000

function useCachedLookup(open, key, fetcher, empty) {
  const [state, setState] = useState({ loading: false, error: false, ...empty })

  useEffect(() => {
    if (!open || !key) {
      setState({ loading: false, error: false, ...empty })
      return
    }
    const hit = cache.get(key)
    if (hit && Date.now() - hit.at < TTL) {
      setState({ loading: false, error: false, ...hit.data })
      return
    }
    let cancelled = false
    setState({ loading: true, error: false, ...empty })
    fetcher()
      .then(data => {
        cache.set(key, { at: Date.now(), data })
        if (!cancelled) setState({ loading: false, error: false, ...data })
      })
      .catch(() => { if (!cancelled) setState({ loading: false, error: true, ...empty }) })
    return () => { cancelled = true }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, key])

  return state
}

export function usePublishImpact(open, academicYear, semester) {
  return useCachedLookup(
    open && !!academicYear && !!semester,
    `t|${academicYear}|${semester}`,
    () => getPublishImpact(academicYear, semester).then(r => ({ queue: r.queue || null })),
    { queue: null },
  )
}

export function useMasterPublishImpact(open, queueId) {
  return useCachedLookup(
    open && !!queueId,
    `m|${queueId}`,
    () => getMasterPublishImpact(queueId).then(r => ({
      published: r.published || null,
      otherQueues: r.otherQueues || 0,
      queueCompleted: !!r.queueCompleted,
    })),
    { published: null, otherQueues: 0, queueCompleted: false },
  )
}

/* Is some queue currently active? Used by the schedule list's unpublish
   confirm: a schedule that came from a queue is only reopened when no other
   queue is active. Runs only while that modal is open (1 indexed read, cached 30s).
   Returns { loading, error, label } where label is e.g. "2nd Semester 2026-2027"
   or null. */
export function useActiveQueueLabel(open) {
  return useCachedLookup(
    open,
    'aq',
    () => getActiveQueue().then(r => {
      const a = r?.queue
      return { label: a ? [a.semester, a.academicYear].filter(Boolean).join(' ') : null }
    }),
    { label: null },
  )
}

/* Call after a successful publish/unpublish so the next modal is fresh. */
export const clearPublishImpactCache = () => cache.clear()

/* ── UI ──────────────────────────────────────────────────────────────────── */
const AMBER = '#D97706'

const card = (border) => ({
  background: 'var(--surface)', borderRadius: 14, width: 520, maxWidth: '100%', overflow: 'hidden',
  boxShadow: '0 24px 64px rgba(0,0,0,0.28)', border: `1px solid ${border}`, fontFamily: 'Inter,sans-serif',
})

function Header({ eyebrow, title, subtitle }) {
  return (
    <div style={{ padding: '26px 30px 20px' }}>
      {eyebrow && (
        <div style={{ fontSize: 11, fontWeight: 600, letterSpacing: 0.7, textTransform: 'uppercase', color: 'var(--muted)', marginBottom: 8 }}>
          {eyebrow}
        </div>
      )}
      <h3 style={{ margin: 0, fontSize: 18, fontWeight: 700, lineHeight: 1.3, color: 'var(--ink)' }}>{title}</h3>
      {subtitle && <div style={{ fontSize: 13, color: 'var(--muted)', marginTop: 6, lineHeight: 1.5 }}>{subtitle}</div>}
    </div>
  )
}

/* A plain list of consequences: bold lead + muted detail, a short outcome word
   on the right, hairline dividers. No boxes, no accent bars. */
function Effects({ children }) {
  return (
    <div style={{ padding: '0 30px 22px' }}>
      <div style={{ fontSize: 11, fontWeight: 600, letterSpacing: 0.7, textTransform: 'uppercase', color: 'var(--muted)', paddingBottom: 6 }}>
        What happens
      </div>
      <div>{children}</div>
    </div>
  )
}

function Effect({ title, tag, children, first }) {
  return (
    <div style={{ display: 'flex', gap: 16, justifyContent: 'space-between', alignItems: 'flex-start', padding: '13px 0', borderTop: '1px solid var(--border)' }}>
      <div style={{ minWidth: 0 }}>
        <div style={{ fontSize: 13.5, fontWeight: 600, color: 'var(--ink)', lineHeight: 1.4 }}>{title}</div>
        {children && <div style={{ fontSize: 12.5, color: 'var(--muted)', marginTop: 3, lineHeight: 1.55 }}>{children}</div>}
      </div>
      {tag && (
        <div style={{ flexShrink: 0, fontSize: 11, fontWeight: 700, letterSpacing: 0.5, textTransform: 'uppercase', color: AMBER, paddingTop: 2 }}>
          {tag}
        </div>
      )}
    </div>
  )
}

function ProgressBar({ done, total }) {
  const pct = total > 0 ? Math.round((done / total) * 100) : 0
  return (
    <div style={{ height: 4, borderRadius: 99, background: 'var(--border)', marginTop: 10, overflow: 'hidden' }}>
      <div style={{ width: `${pct}%`, height: '100%', background: 'var(--meadow)', borderRadius: 99 }} />
    </div>
  )
}

function Footer({ busy, onCancel, onConfirm, confirmLabel, busyLabel, confirmBg, border, confirmDisabled = false }) {
  const off = busy || confirmDisabled
  return (
    <div style={{ display: 'flex', gap: 10, justifyContent: 'flex-end', padding: '16px 30px', borderTop: `1px solid ${border}`, background: 'var(--bg)' }}>
      <button onClick={onCancel} disabled={busy}
        style={{ padding: '9px 20px', borderRadius: 9, border: `1.5px solid ${border}`, background: 'var(--surface)', color: 'var(--ink)', fontSize: 13, fontWeight: 600, cursor: busy ? 'default' : 'pointer', fontFamily: 'Inter,sans-serif' }}>
        Cancel
      </button>
      <button onClick={onConfirm} disabled={off}
        style={{ padding: '9px 24px', borderRadius: 9, border: 'none', background: confirmBg, color: '#fff', fontSize: 13, fontWeight: 700, cursor: off ? 'default' : 'pointer', fontFamily: 'Inter,sans-serif', opacity: busy ? 0.7 : confirmDisabled ? 0.45 : 1 }}>
        {busy ? busyLabel : confirmLabel}
      </button>
    </div>
  )
}

/**
 * Card contents only — wrap in the page's own overlay.
 *   sibling: name of the schedule currently published for this term (or null)
 *   impact:  { loading, error, queue: {approved,total}|null, otherQueues? }
 */
export default function PublishModal({
  name, academicYear, semester, sibling, impact, busy, onCancel, onConfirm,
  confirmLabel = 'Publish', border = 'var(--border)',
}) {
  const term = [semester, academicYear].filter(Boolean).join(' ')
  const q = impact?.queue
  const pending = q ? q.total - q.approved : 0
  const others = impact?.otherQueues || 0
  const othersText = `${others} other open queue${others > 1 ? 's' : ''} for this term will close too.`
  const nothing = !sibling && !q && others === 0 && !impact?.loading && !impact?.error

  return (
    <div onClick={e => e.stopPropagation()} style={card(border)}>
      <Header
        eyebrow={term || null}
        title={`Publish ${name} to faculty?`}
        subtitle="Faculty can see it as soon as you confirm."
      />

      <Effects>
        {q && (
          <Effect title="The queue closes" tag="Closes">
            {q.approved} of {q.total} programs {q.approved === 1 ? 'has' : 'have'} an approved schedule.
            {pending > 0 ? ` The other ${pending} won't be able to submit anymore.` : ''}
            {others > 0 ? ` ${othersText}` : ''}
            <ProgressBar done={q.approved} total={q.total} />
          </Effect>
        )}

        {!q && others > 0 && <Effect title="Other open queues close" tag="Closes">{othersText}</Effect>}

        {sibling && (
          <Effect title={`"${sibling}" moves back to Draft`} tag="Unpublished">
            It's the schedule currently published for this term. Coordinator submissions for the term are reset to draft too.
          </Effect>
        )}

        {nothing && (
          <Effect title="Nothing else is affected">No active queue or published schedule for this term.</Effect>
        )}

        {impact?.error && (
          <Effect title="Couldn't check this term">
            If a queue is open for it, it will be closed when you publish.
          </Effect>
        )}

        {impact?.loading && (
          <div style={{ fontSize: 12.5, color: 'var(--muted)', padding: '13px 0', borderTop: '1px solid var(--border)' }}>Checking this term…</div>
        )}
      </Effects>

      <Footer busy={busy} onCancel={onCancel} onConfirm={onConfirm} border={border}
        confirmLabel={confirmLabel} busyLabel="Publishing…" confirmBg="var(--meadow)" />
    </div>
  )
}

/**
 * Master-schedule unpublish. Everything shown is already known client-side
 * (no extra reads): unpublishing reopens the queue from the first program and
 * resets coordinator schedules for the term to draft.
 *   activeElsewhere: label of a different queue that is currently active (e.g.
 *              "2nd Semester 2026-2027"). Only one queue can be active at a
 *              time, so the unpublish still goes through but this queue is
 *              NOT reopened; the modal says so instead of blocking.
 */
export function UnpublishModal({
  name, academicYear, semester, approvedCount = 0, activeElsewhere = null, busy, onCancel, onConfirm,
  confirmLabel = 'Unpublish', confirmBg = '#6B7280', border = 'var(--border)',
}) {
  const term = [semester, academicYear].filter(Boolean).join(' ')
  return (
    <div onClick={e => e.stopPropagation()} style={card(border)}>
      <Header
        eyebrow={term || null}
        title={`Unpublish the ${name}?`}
        subtitle="Faculty will no longer see it."
      />

      <Effects>
        {activeElsewhere ? (
          <Effect title="The queue stays closed" tag="Stays closed">
            The {activeElsewhere} queue is active, and only one queue can be open at a time, so this term's queue won't reopen.
          </Effect>
        ) : (
          <Effect title="The queue reopens" tag="Reopens">
            Every program goes back to waiting, starting again from the first one. Only one queue can be open at a time.
          </Effect>
        )}
        <Effect title="Coordinator schedules reset to draft" tag="Reset">
          {approvedCount > 0
            ? `${approvedCount} approved schedule${approvedCount > 1 ? 's are' : ' is'} included. `
            : ''}
          {activeElsewhere
            ? "They can't resubmit until a queue is open for this term again."
            : 'Coordinators will need to review and resubmit.'}
        </Effect>
      </Effects>

      <Footer busy={busy} onCancel={onCancel} onConfirm={onConfirm} border={border}
        confirmLabel={confirmLabel} busyLabel="Unpublishing…" confirmBg={confirmBg} />
    </div>
  )
}

/**
 * Generic confirm dialog in the same style (used by the Queue tab's Delete /
 * Finish warnings). effects: [{ title, tag?, detail?, progress?: {done,total} }]
 */
export function ConfirmModal({
  eyebrow, title, subtitle, effects = [], busy, onCancel, onConfirm,
  confirmLabel, busyLabel, confirmBg = '#6B7280', border = 'var(--border)',
}) {
  return (
    <div onClick={e => e.stopPropagation()} style={card(border)}>
      <Header eyebrow={eyebrow} title={title} subtitle={subtitle} />
      {effects.length > 0 && (
        <Effects>
          {effects.map((f, i) => (
            <Effect key={i} title={f.title} tag={f.tag}>
              {f.detail}
              {f.progress && <ProgressBar done={f.progress.done} total={f.progress.total} />}
            </Effect>
          ))}
        </Effects>
      )}
      <Footer busy={busy} onCancel={onCancel} onConfirm={onConfirm} border={border}
        confirmLabel={confirmLabel} busyLabel={busyLabel} confirmBg={confirmBg} />
    </div>
  )
}