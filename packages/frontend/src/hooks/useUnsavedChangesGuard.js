import { useEffect, useRef, useState, useCallback } from 'react'
import { useNavigate } from 'react-router-dom'
import { setUnsavedFlag } from '../utils/unsavedChangesRegistry' // adjust path to match your project structure

/**
 * Guards against losing unsaved changes when the user tries to leave the
 * page — via a tab close/reload, the browser back button, or clicking any
 * in-app link (sidebar nav, breadcrumbs, etc). Reload keeps the browser's
 * own native warning by necessity; back-button and link clicks are caught
 * before they navigate, so the caller can show a styled confirm modal
 * (see UnsavedChangesModal) instead of window.confirm().
 *
 * @param {boolean} hasUnsavedChanges - whether there's something unsaved right now
 * @param {string}  [guardKey] - key stored in the pushed history state; give
 *                               each page its own so their guard entries
 *                               never collide with one another.
 *
 * @returns {{
 *   pendingLeaveAction: {type:'link'|'path', href:string} | {type:'back'} | null,
 *   confirmLeave: () => void,
 *   cancelLeave: () => void,
 *   guardedNavigate: (to: string) => void,
 * }}
 */
export function useUnsavedChangesGuard(hasUnsavedChanges, guardKey = 'unsavedGuard') {
  const navigate = useNavigate()
  const [pendingLeaveAction, setPendingLeaveAction] = useState(null)

  // Kept current via a ref so listeners registered once below always read
  // the latest value.
  const hasUnsavedChangesRef = useRef(hasUnsavedChanges)
  useEffect(() => { hasUnsavedChangesRef.current = hasUnsavedChanges }, [hasUnsavedChanges])

  // Mirror into the cross-page registry so things outside this page's
  // component tree (AdminLayout's logout button) can check it too.
  useEffect(() => {
    setUnsavedFlag(hasUnsavedChanges, guardKey)
    return () => setUnsavedFlag(false)
  }, [hasUnsavedChanges, guardKey])

  // 1. Tab close / reload — the browser only honors its own native prompt here.
  useEffect(() => {
    if (!hasUnsavedChanges) return
    const handler = e => { e.preventDefault(); e.returnValue = '' }
    window.addEventListener('beforeunload', handler)
    return () => window.removeEventListener('beforeunload', handler)
  }, [hasUnsavedChanges])

  // 2. Browser back/forward button — beforeunload doesn't fire for in-app
  // history navigation, so we keep one extra history entry on top of this
  // page while dirty; a back-press hits popstate first instead of leaving.
  const guardPushedRef = useRef(false)
  const skipNextPopRef = useRef(false)

  useEffect(() => {
    if (hasUnsavedChanges && !guardPushedRef.current) {
      window.history.pushState({ [guardKey]: true }, '')
      guardPushedRef.current = true
    } else if (!hasUnsavedChanges && guardPushedRef.current) {
      skipNextPopRef.current = true
      window.history.back()
      guardPushedRef.current = false
    }
  }, [hasUnsavedChanges, guardKey])

  useEffect(() => {
    const handlePop = () => {
      if (skipNextPopRef.current) { skipNextPopRef.current = false; return }
      if (!guardPushedRef.current) return
      guardPushedRef.current = false
      if (hasUnsavedChangesRef.current) {
        window.history.pushState({ [guardKey]: true }, '')
        guardPushedRef.current = true
        setPendingLeaveAction({ type: 'back' })
      }
    }
    window.addEventListener('popstate', handlePop)
    return () => {
      window.removeEventListener('popstate', handlePop)
      if (guardPushedRef.current) {
        skipNextPopRef.current = true
        window.history.back()
        guardPushedRef.current = false
      }
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [guardKey])

  // 3. In-app navigation links — sidebar, breadcrumbs, anything rendered as
  // a plain <a>. Caught in the capture phase before the router acts on it.
  useEffect(() => {
    if (!hasUnsavedChanges) return
    const handleLinkClick = (e) => {
      const target = e.target.closest('a')
      if (
        target && target.href &&
        !target.hasAttribute('download') &&
        target.origin === window.location.origin &&
        target.pathname !== window.location.pathname
      ) {
        e.preventDefault()
        e.stopPropagation()
        setPendingLeaveAction({ type: 'link', href: target.pathname + target.search + target.hash })
      }
    }
    document.addEventListener('click', handleLinkClick, { capture: true })
    return () => document.removeEventListener('click', handleLinkClick, { capture: true })
  }, [hasUnsavedChanges])

  const confirmLeave = useCallback(() => {
    const action = pendingLeaveAction
    setPendingLeaveAction(null)
    if (!action) return
    if (action.type === 'link' || action.type === 'path') {
      // We're about to unmount (route is changing). Mark the trap entry as
      // "no longer ours" first — otherwise this hook's own unmount cleanup
      // sees guardPushedRef still true and fires window.history.back() to
      // clean it up, which cancels out the navigate() below and leaves the
      // user back where they started (looks like nothing happened / a reload).
      guardPushedRef.current = false
      navigate(action.href)
    } else if (action.type === 'back') {
      skipNextPopRef.current = true
      guardPushedRef.current = false
      window.history.back()
    }
  }, [pendingLeaveAction, navigate])

  const cancelLeave = useCallback(() => setPendingLeaveAction(null), [])

  // For programmatic navigate() calls that aren't a plain <a> click (a
  // "Back to list" button, a breadcrumb using navigate() instead of Link) —
  // route them through the same guard instead of calling navigate directly.
  const guardedNavigate = useCallback((to) => {
    if (hasUnsavedChangesRef.current) {
      setPendingLeaveAction({ type: 'path', href: to })
    } else {
      navigate(to)
    }
  }, [navigate])

  return { pendingLeaveAction, confirmLeave, cancelLeave, guardedNavigate }
}