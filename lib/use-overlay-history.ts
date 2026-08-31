"use client"

import { useEffect, useRef, useState } from "react"

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
 * Depth-aware by design: overlays nest (Showcase -> ratings breakdown,
 * Showcase -> "more details" -> detail modal), and one Back press must close
 * exactly one layer.
 */

/**
 * The open overlays, innermost last.
 *
 * A `popstate` reaches EVERY listener on the page, so without this each open
 * overlay would close itself on one Back press and the whole stack would
 * collapse at once. Only the innermost overlay may answer a given press.
 */
const openStack: symbol[] = []

/**
 * The presses already answered.
 *
 * Belt to the stack's braces. Every listener runs inside the SAME dispatch,
 * and whichever one claims the press pops itself off, which promotes the next
 * overlay to the top before the remaining listeners have run. Listener order
 * normally makes that harmless, but it is an ordering assumption rather than a
 * guarantee — an overlay that closes and reopens under another one re-registers
 * itself last. Claiming the event is order-independent and costs nothing.
 */
const answered = new WeakSet<Event>()

function removeFromStack(token: symbol): void {
  const at = openStack.lastIndexOf(token)
  if (at !== -1) openStack.splice(at, 1)
}

export function useOverlayHistory(
  id: string,
  isOpen: boolean,
  onClose: () => void,
): void {
  // Whether THIS instance owns an unconsumed history entry.
  const pushedRef = useRef(false)
  // Identity of this instance within the stack. Two instances can legitimately
  // share an `id` (the same overlay rendered by two hosts), so membership is
  // keyed on the instance, not on the name.
  // Held in state with a lazy initialiser rather than in a ref: the value is
  // read during render, and a ref read there is exactly what the compiler
  // forbids (a ref may hold a different value on a re-render it triggered).
  const [token] = useState(() => Symbol(id))
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
      openStack.push(token)
      // The URL is passed EXPLICITLY, even though it does not change.
      // Next's App Router patches history.pushState to track its own route
      // entries; an entry pushed with the URL argument omitted is one the
      // router has no record of, and LANDING on it (which only happens once
      // overlays nest — Showcase -> ratings breakdown) made it fall back to a
      // full document navigation. The app reloaded, every overlay vanished at
      // once and the deck reset, which reads exactly like "Back closes
      // everything". Same entry, same URL, but well-formed.
      window.history.pushState({ overlay: id }, "", window.location.href)
    }

    if (!isOpen && pushedRef.current) {
      // Closed by something other than Back (Escape, a button). Remove the
      // entry we added so Back does not need two presses to leave the view.
      pushedRef.current = false
      removeFromStack(token)
      if (window.history.state?.overlay === id) window.history.back()
    }
  }, [id, isOpen, token])

  useEffect(() => {
    if (!isOpen || typeof window === "undefined") return

    const onPop = (event: PopStateEvent) => {
      if (!pushedRef.current) return
      // One press closes one layer, whichever listener happens to run first.
      if (answered.has(event)) return
      // Not the innermost layer — this press belongs to whatever is on top of
      // us, and answering it too would close the whole stack at once.
      if (openStack[openStack.length - 1] !== token) return
      answered.add(event)
      // Our entry is already gone — the browser consumed it — so just close.
      pushedRef.current = false
      removeFromStack(token)
      closeRef.current()
    }

    window.addEventListener("popstate", onPop)
    return () => window.removeEventListener("popstate", onPop)
  }, [isOpen, token])

  // A component unmounting while still open (a parent view swap) must not
  // leave a stray entry behind.
  useEffect(() => {
    return () => {
      if (pushedRef.current && typeof window !== "undefined") {
        pushedRef.current = false
        removeFromStack(token)
        if (window.history.state?.overlay === id) window.history.back()
      }
    }
  }, [id, token])
}
