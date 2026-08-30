import { useState, useEffect, useCallback, useMemo } from 'react'
import { Joyride, STATUS, EVENTS, ACTIONS } from 'react-joyride'
import { useAuth } from './useAuth'

// Module-level (shared across every useTour instance on the page) lock so
// at most one tour can ever be running at a time — no matter whether it
// was triggered by auto-start, a Guide button, or the global 'start-tour'
// event. Without this, two unrelated tours (e.g. the page's intro tour and
// a contextual one-off guide) can both auto-arm within the same render and
// render their tooltips on top of each other.
let activeTourId = null

export function useTour(tourId, steps, isReady = true, { isPrimary = true } = {}) {
  const { user } = useAuth()
  const storageKey = user?.uid ? `tour_${user.uid}_${tourId}` : `tour_${tourId}`

  const [run, setRun] = useState(false)
  const [stepIndex, setStepIndex] = useState(0)

  const tryStart = useCallback(() => {
    if (activeTourId && activeTourId !== tourId) return false
    activeTourId = tourId
    setStepIndex(0)
    setRun(true)
    return true
  }, [tourId])

  const stop = useCallback((markSeen) => {
    if (activeTourId === tourId) activeTourId = null
    setRun(false)
    setStepIndex(0)
    if (markSeen) localStorage.setItem(storageKey, 'true')
  }, [tourId, storageKey])

  // Auto-start if not seen
  useEffect(() => {
    if (!isReady) return
    const hasSeen = localStorage.getItem(storageKey)
    if (!hasSeen) {
      const t = setTimeout(() => { tryStart() }, 1000)
      return () => clearTimeout(t)
    }
  }, [tourId, isReady, tryStart, storageKey])

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

    if (type === EVENTS.STEP_AFTER || type === EVENTS.TARGET_NOT_FOUND) {
      const nextIndex = index + (action === ACTIONS.PREV ? -1 : 1)
      if (nextIndex >= steps.length || nextIndex < 0) {
        stop(true)
      } else {
        setStepIndex(nextIndex)
      }
    } else if (action === ACTIONS.CLOSE) {
      stop(false)
    } else if (action === ACTIONS.SKIP) {
      stop(true)
    } else {
      const finishedStatuses = [STATUS.FINISHED, STATUS.SKIPPED]
      if (finishedStatuses.includes(status)) {
        stop(true)
      }
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
    // 'nearest' scrolls only as much as needed to bring the target fully
    // into view — no more. Forcing 'center' or 'end' was overscrolling past
    // the actual end of page content on shorter pages, exposing blank
    // space below the last section that isn't a real bug, just unnecessary
    // scroll distance. Anchors are already small (card headers, not whole
    // sections — see AnalyticsPage), so 'nearest' is enough room for the
    // tooltip without the overscroll side effect.
    el.scrollIntoView({ behavior: 'smooth', block: 'nearest' })
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
    () => steps.map(s => ({ ...s, skipBeacon: true })),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [stepsKey]
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
        arrowColor: '#FFFFFF',
        backgroundColor: '#FFFFFF',
        overlayColor: 'rgba(14, 42, 32, 0.55)',
        primaryColor: '#15803D',
        textColor: '#0E2A20',
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
          boxShadow: '0 20px 50px rgba(10,46,28,0.28)',
        },
        tooltipContainer: {
          textAlign: 'left',
        },
        tooltipTitle: {
          fontFamily: "'Sora', sans-serif",
          fontSize: 16,
          fontWeight: 800,
          color: '#0E2A20',
          marginBottom: 4,
        },
        tooltipContent: {
          fontSize: 13.5,
          lineHeight: 1.55,
          color: '#4B7060',
          padding: '4px 0 0',
        },
        tooltipFooter: {
          marginTop: 16,
          alignItems: 'center',
        },
        buttonPrimary: {
          backgroundColor: '#15803D',
          backgroundImage: 'linear-gradient(135deg,#15803D,#0F5C2C)',
          borderRadius: '8px',
          fontFamily: "'Inter', sans-serif",
          fontWeight: 700,
          fontSize: 13,
          padding: '8px 18px',
          boxShadow: '0 3px 10px rgba(21,128,61,0.3)',
          border: 'none',
        },
        buttonBack: {
          color: '#4B7060',
          fontFamily: "'Inter', sans-serif",
          fontWeight: 600,
          fontSize: 13,
          marginRight: 10,
        },
        buttonSkip: {
          color: '#6B8C7A',
          fontFamily: "'Inter', sans-serif",
          fontWeight: 600,
          fontSize: 12.5,
        },
        buttonClose: {
          color: '#6B8C7A',
          padding: 14,
        },
        beaconInner: {
          backgroundColor: '#15803D',
        },
        beaconOuter: {
          backgroundColor: 'rgba(21,128,61,0.35)',
          borderColor: '#15803D',
        },
      }}
    />
  )

  // Stable component wrapper — avoids creating a new function identity on
  // every render which would cause React to unmount/remount Joyride.
  const TourComponent = useCallback(() => TourElement, [run, stepIndex, stepsWithoutBeacon])

  return { TourComponent, TourElement, run, startTour: tryStart }
}