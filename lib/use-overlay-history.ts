"use client"

import { useEffect, useRef } from "react"

/**
 * Makes an overlay answer the Back button.
 *
 * Every overlay in the app was a bare `useState` boolean, so Back skipped
 * straight past it and unwound the view underneath: with the Showcase open on
 * the deck, Back killed the canvas AND the deck, landed on the library, and a
 * second press left the app. On Android — where Back is the primary gesture,
 * not a fallback — that is the single most-hit interaction in the product.
 *
 * The overlay pushes one history entry when it opens and consumes it when it
 * closes, so the count stays balanced no matter which way it is dismissed
 * (Escape, a close button, or Back itself).
 *
 * Depth-aware by design: overlays nest (Showcase -> "more details" -> detail
 * modal), and a single shared flag would pop past the whole stack on one press.
 * Each instance owns its own entry, keyed by `id`.
 */
export function useOverlayHistory(
  id: string,
  isOpen: boolean,
  onClose: () => void,
): void {
  // Whether THIS instance owns an unconsumed history entry.
  const pushedRef = useRef(false)
  // Latest onClose without re-running the popstate effect on every parent
  // render. Assigned in an effect, not during render, so React can rely on
  // render being pure.
  const closeRef = useRef(onClose)
  useEffect(() => {
    closeRef.current = onClose
  }, [onClose])

  useEffect(() => {
    if (typeof window === "undefined") return

    if (isOpen && !pushedRef.current) {
      pushedRef.current = true
      window.history.pushState({ overlay: id }, "")
    }

    if (!isOpen && pushedRef.current) {
      // Closed by something other than Back (Escape, a button). Remove the
      // entry we added so Back does not need two presses to leave the view.
      pushedRef.current = false
      if (window.history.state?.overlay === id) window.history.back()
    }
  }, [id, isOpen])

  useEffect(() => {
    if (!isOpen || typeof window === "undefined") return

    const onPop = () => {
      if (!pushedRef.current) return
      // Our entry is already gone — the browser consumed it — so just close.
      pushedRef.current = false
      closeRef.current()
    }

    window.addEventListener("popstate", onPop)
    return () => window.removeEventListener("popstate", onPop)
  }, [isOpen])

  // A component unmounting while still open (a parent view swap) must not
  // leave a stray entry behind.
  useEffect(() => {
    return () => {
      if (pushedRef.current && typeof window !== "undefined") {
        pushedRef.current = false
        if (window.history.state?.overlay === id) window.history.back()
      }
    }
  }, [id])
}
