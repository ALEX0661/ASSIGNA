import { useState, useEffect, useCallback, useMemo, useRef } from 'react'
import { Joyride, STATUS, EVENTS, ACTIONS } from 'react-joyride'
import { useAuth } from './useAuth'
import { getTourStatus, markTourSeen } from '../services/api'

// Module-level (shared across every useTour instance on the page) lock so
// at most one tour can ever be running at a time — no matter whether it
// was triggered by auto-start, a Guide button, or the global 'start-tour'
// event. Without this, two unrelated tours (e.g. the page's intro tour and
// a contextual one-off guide) can both auto-arm within the same render and
// render their tooltips on top of each other.
let activeTourId = null

// Which tours the signed-in account has seen, loaded from the backend once per
// session and shared by every useTour instance (so N tours on a page = 1 request).
let statusCache = { uid: null, promise: null }
function loadTourStatus(uid) {
  if (statusCache.uid !== uid || !statusCache.promise) {
    const promise = getTourStatus().catch(err => {
      // Don't cache failures, so the next attempt can try again.
      if (statusCache.promise === promise) statusCache = { uid: null, promise: null }
      throw err
    })
    statusCache = { uid, promise }
  }
  return statusCache.promise
}
function rememberSeen(uid, tourId, all) {
  if (statusCache.uid !== uid || !statusCache.promise) return
  statusCache.promise = statusCache.promise.then(s => ({
    hasSeenGlobalTours: !!s?.hasSeenGlobalTours || all,
    toursSeen: { ...(s?.toursSeen || {}), [tourId]: true },
  }))
}

export function useTour(tourId, steps, isReady = true, { isPrimary = true } = {}) {
  const { user } = useAuth()
  const storageKey = user?.uid ? `tour_${user.uid}_${tourId}` : `tour_${tourId}`

  const [run, setRun] = useState(false)
  const [stepIndex, setStepIndex] = useState(0)
  // Refs so the auto-start loop can read the latest state without re-arming.
  const runRef = useRef(false)
  // True once at least one step was actually shown to the user.
  const shownRef = useRef(false)
  const stepsRef = useRef(steps)
  stepsRef.current = steps
  // Per-step flag: true when the step's target is too tall to fit on screen
  // with a tooltip beside it. Those steps get placement: 'center'.
  const [tallSteps, setTallSteps] = useState({})

  const tryStart = useCallback(() => {
    if (activeTourId && activeTourId !== tourId) return false
    // Already running: don't restart it from step 1 (a re-armed auto-start
    // used to do this mid-tour).
    if (runRef.current) return true
    activeTourId = tourId
    runRef.current = true
    shownRef.current = false
    setStepIndex(0)
    setRun(true)
    // Separate from the 'start-tour' *trigger* event (fired by the header
    // "?" button to request a tour start) — this fires whenever a tour
    // actually begins running, auto-start included, so layouts (sidebar
    // auto-collapse, etc.) can react to every tour, not just manually
    // triggered ones.
    window.dispatchEvent(new Event('tour-started'))
    return true
  }, [tourId])

  const stop = useCallback(async (markSeen, markGlobalSkip = false) => {
    if (activeTourId === tourId) activeTourId = null
    runRef.current = false
    setRun(false)
    setStepIndex(0)
    if (markSeen) {
      localStorage.setItem(storageKey, 'true')

      // Save to the backend so the account stays "seen" on every browser.
      // Per page only: finishing or skipping this tour never hides other pages' tours.
      if (user?.uid) {
        try {
          await markTourSeen(tourId, false)
          rememberSeen(user.uid, tourId, false)
        } catch (e) {
          console.warn('Failed to save tour status to backend', e)
        }
      }
    }
  }, [tourId, storageKey, user])

  useEffect(() => {
    return () => {
      if (activeTourId === tourId) {
        activeTourId = null
      }
    }
  }, [tourId])

  // Auto-start if not seen
  useEffect(() => {
    if (!isReady || !user?.uid) return
    let cancelled = false
    let timer = null

    const checkTour = async () => {
      // Fast path: this page's tour was already finished or skipped in this browser.
      if (localStorage.getItem(storageKey) === 'true') {
        return
      }

      // Slow path: ask the backend (new browser, cleared cache, other device).
      let status
      try {
        status = await loadTourStatus(user.uid)
      } catch (e) {
        // Can't tell whether this account has seen it. Don't risk replaying it
        // for a returning user; the header "?" button still starts it manually.
        console.warn('Could not check tour status, skipping auto-start', e)
        return
      }

      if (status?.toursSeen?.[tourId]) {
        localStorage.setItem(storageKey, 'true')
        return
      }

      if (cancelled) return

      // Start once the lock is free AND the first step's target is on screen.
      // Before, a single tryStart() ran after 1s: if another tour held the
      // lock, or the target hadn't rendered yet, it silently gave up and the
      // tour never auto-started for that user.
      const attemptStart = (triesLeft) => {
        if (cancelled || runRef.current) return
        const list = stepsRef.current || []
        const first = list[0]?.target
        const targetReady = list.length > 0 &&
          (typeof first !== 'string' || !!document.querySelector(first))
        if (targetReady && tryStart()) return
        if (triesLeft > 0) timer = setTimeout(() => attemptStart(triesLeft - 1), 600)
      }
      timer = setTimeout(() => attemptStart(25), 1000)
    }

    checkTour()
    return () => { cancelled = true; clearTimeout(timer) }
  }, [tourId, isReady, tryStart, storageKey, user])

  // Listen for the shared header trigger. The event can target a specific
  // tour via detail.tourId (e.g. { detail: { tourId: 'coordSchedulerYourTurn' } }).
  // A bare dispatch with no detail — the legacy header "?" icon's call —
  // is treated as "open the page's primary tour" and is ignored by any
  // secondary tour (isPrimary: false), so one header click can no longer
  // start every tour mounted on the page at once.
  useEffect(() => {
    const handleStart = (e) => {
      const requestedId = e?.detail?.tourId
      if (requestedId ? requestedId !== tourId : !isPrimary) return
      tryStart()
    }
    window.addEventListener('start-tour', handleStart)
    return () => window.removeEventListener('start-tour', handleStart)
  }, [tourId, isPrimary, tryStart])

  const handleTourEvent = useCallback((data) => {
    const { status, action, index, type } = data

    // A step the user actually saw. If every target was missing, the tour
    // must not be saved as "seen" without ever showing.
    if (type === EVENTS.STEP_AFTER || (EVENTS.TOOLTIP && type === EVENTS.TOOLTIP)) shownRef.current = true

    // Skip and Close are checked FIRST. Joyride also fires STEP_AFTER for
    // them, and the advance logic below used to swallow the event and just
    // move to the next step, so Skip never actually skipped or saved.
    if (action === ACTIONS.SKIP || status === STATUS.SKIPPED) {
      stop(true, false) // Skip: saved for THIS page only
      return
    }
    if (action === ACTIONS.CLOSE) {
      stop(false, false)
      return
    }

    if (type === EVENTS.STEP_AFTER || type === EVENTS.TARGET_NOT_FOUND) {
      const nextIndex = index + (action === ACTIONS.PREV ? -1 : 1)
      if (nextIndex >= steps.length || nextIndex < 0) {
        // Done on the last step always counts; running out of steps because
        // every target was missing does not.
        const pressedDone = type === EVENTS.STEP_AFTER && action === ACTIONS.NEXT
        stop(pressedDone || shownRef.current, false)
      } else {
        setStepIndex(nextIndex)
      }
    } else if (status === STATUS.FINISHED) {
      stop(shownRef.current, false)
    }
  }, [steps.length, stop])

  // We scroll the target into view ourselves, on every step change, instead
  // of letting Joyride do it. Joyride's own scrollIntoView/scroll-parent-fix
  // combo is what was causing both bugs: (1) it can leave the tooltip
  // cut off/mispositioned when it can't scroll a bottom-of-page target far
  // enough up, and (2) its height-inflation cleanup gets stuck (the gray
  // gap) because our wheel/touch blockers below interfere with it. Doing
  // the scroll explicitly here, before Joyride ever tries, sidesteps both —
  // Joyride's own scrolling stays fully disabled (disableScrolling +
  // disableScrollParentFix, below).
  useEffect(() => {
    if (!run) return
    const step = steps[stepIndex]
    if (!step?.target) return
    const el = typeof step.target === 'string' ? document.querySelector(step.target) : step.target
    if (!el?.scrollIntoView) return

    // Target too tall to fit with a tooltip beside it -> center the tooltip
    // on screen and show the top of the target. 280 is roughly the tooltip
    // height plus margin; raise it to center more often, lower it for less.
    const tall = el.getBoundingClientRect().height > window.innerHeight - 280
    setTallSteps(prev => (prev[stepIndex] === tall ? prev : { ...prev, [stepIndex]: tall }))

    // 'nearest' scrolls only as much as needed to bring the target fully
    // into view — no more. Forcing 'center' or 'end' was overscrolling past
    // the actual end of page content on shorter pages, exposing blank
    // space below the last section that isn't a real bug, just unnecessary
    // scroll distance. Anchors are already small (card headers, not whole
    // sections — see AnalyticsPage), so 'nearest' is enough room for the
    // tooltip without the overscroll side effect. Tall targets use 'start'
    // so the top of the section is visible behind the centered tooltip.
    el.scrollIntoView({ behavior: 'smooth', block: tall ? 'start' : 'nearest' })
  }, [run, stepIndex, steps])

  // The app's pages scroll inside <main> (see CoordinatorLayout /
  // AdminLayout / FacultyLayout), not the window. We still block via event
  // listeners rather than overflow: hidden — Joyride detects the
  // scrollable ancestor by computed overflow: auto/scroll, so hiding
  // overflow makes it invisible to Joyride too, and it can no longer
  // auto-scroll targets below the fold into view. Blocking the input
  // events (wheel/touch/keys) instead leaves overflow: auto in place, so
  // Joyride's own JS-driven scrollTop/scrollIntoView calls between steps
  // are unaffected — only the user's manual scrolling is.
  //
  // Listeners go on `window`, not `<main>`: the tooltip renders through a
  // React portal straight onto document.body, outside <main> entirely, so
  // wheel/touch events while hovering the tooltip never reached <main>'s
  // listeners and scrolled the page underneath anyway — desyncing the
  // spotlight from the tour and soft-locking the page. window catches
  // scroll input everywhere, tooltip included.
  useEffect(() => {
    if (!run) return

    const blockWheelOrTouch = (e) => { e.preventDefault() }
    const scrollKeys = ['ArrowUp', 'ArrowDown', 'PageUp', 'PageDown', 'Home', 'End', ' ']
    // Skip preventDefault when focus is on an interactive element (e.g. the
    // tour's own Back/Next/Skip buttons) so Space/Enter still activates
    // them normally instead of getting silently swallowed.
    const blockKeys = (e) => {
      if (!scrollKeys.includes(e.key)) return
      const tag = e.target?.tagName
      if (tag === 'BUTTON' || tag === 'A' || tag === 'INPUT' || tag === 'TEXTAREA') return
      e.preventDefault()
    }

    window.addEventListener('wheel', blockWheelOrTouch, { passive: false })
    window.addEventListener('touchmove', blockWheelOrTouch, { passive: false })
    window.addEventListener('keydown', blockKeys, true)

    return () => {
      window.removeEventListener('wheel', blockWheelOrTouch)
      window.removeEventListener('touchmove', blockWheelOrTouch)
      window.removeEventListener('keydown', blockKeys, true)
    }
  }, [run])

  // Keyed on the steps' actual content (targets/titles), not on the array's
  // reference. Callers often pass an inline array literal (e.g.
  // `useTour('id', [ {...}, {...} ])`), which gets a brand-new identity on
  // every render of the parent. If the parent re-renders while the tour is
  // running — e.g. async data finishing (setDist/setWl/etc.) and swapping a
  // skeleton for a real chart — a reference-keyed memo sees "new steps" and
  // makes Joyride re-measure the target immediately, often before the async
  // reflow (skeleton height -> real chart height) has actually happened.
  // Joyride then never gets a second chance to re-measure once the layout
  // settles, so the tooltip stays glued to the pre-reflow position and ends
  // up floating over whatever now sits there instead. Keying on content
  // keeps the same array identity across those unrelated re-renders, so
  // Joyride only reprocesses steps when they genuinely change.
  const stepsKey = steps.map(s => `${s.target}|${s.title}`).join('::')
  const stepsWithoutBeacon = useMemo(
    () => steps.map((s, i) => ({
      ...s,
      skipBeacon: true,
      // Tall targets: center the tooltip on screen instead of pinning it
      // to the edge of the target.
      ...(tallSteps[i] ? { placement: 'center' } : {}),
    })),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [stepsKey, tallSteps]
  )

  const TourElement = (
    <Joyride
      steps={stepsWithoutBeacon}
      run={run}
      stepIndex={stepIndex}
      continuous
      onEvent={handleTourEvent}
      locale={{ back: 'Back', close: 'Close', last: 'Done', next: 'Next', skip: 'Skip' }}
      options={{
        arrowColor: 'var(--surface)',
        backgroundColor: 'var(--surface)',
        overlayColor: 'rgba(14, 42, 32, 0.55)',
        primaryColor: 'var(--meadow)',
        textColor: 'var(--ink)',
        width: 340,
        zIndex: 10000,
        showProgress: true,
        spotlightRadius: 12,
        buttons: ['back', 'close', 'primary', 'skip'],
        overlayClickAction: false,
        dismissKeyAction: false,
        blockTargetInteraction: true,
        closeButtonAction: 'close',
      }}
      styles={{
        tooltip: {
          borderRadius: 14,
          padding: '20px 22px 16px',
          fontFamily: "'Inter', sans-serif",
          boxShadow: '0 20px 50px rgba(0,0,0,0.28)',
        },
        tooltipContainer: {
          textAlign: 'left',
        },
        tooltipTitle: {
          fontFamily: "'Sora', sans-serif",
          fontSize: 16,
          fontWeight: 800,
          color: 'var(--ink)',
          marginBottom: 4,
        },
        tooltipContent: {
          fontSize: 13.5,
          lineHeight: 1.55,
          color: 'var(--muted)',
          padding: '4px 0 0',
        },
        tooltipFooter: {
          marginTop: 16,
          alignItems: 'center',
        },
        buttonPrimary: {
          backgroundColor: 'var(--meadow)',
          backgroundImage: 'linear-gradient(135deg,var(--meadow),var(--meadow-deep))',
          borderRadius: '8px',
          fontFamily: "'Inter', sans-serif",
          fontWeight: 700,
          fontSize: 13,
          padding: '8px 18px',
          boxShadow: '0 3px 10px rgba(0,0,0,0.3)',
          border: 'none',
        },
        buttonBack: {
          color: 'var(--muted)',
          fontFamily: "'Inter', sans-serif",
          fontWeight: 600,
          fontSize: 13,
          marginRight: 10,
        },
        buttonSkip: {
          color: 'var(--muted2)',
          fontFamily: "'Inter', sans-serif",
          fontWeight: 600,
          fontSize: 12.5,
        },
        buttonClose: {
          color: 'var(--muted2)',
          padding: 14,
        },
        beaconInner: {
          backgroundColor: 'var(--meadow)',
        },
        beaconOuter: {
          backgroundColor: 'rgba(0,0,0,0.35)',
          borderColor: 'var(--meadow)',
        },
      }}
    />
  )

  // Stable component wrapper — avoids creating a new function identity on
  // every render which would cause React to unmount/remount Joyride.
  const TourComponent = useCallback(() => TourElement, [run, stepIndex, stepsWithoutBeacon])

  return { TourComponent, TourElement, run, startTour: tryStart }
}