import { useEffect, RefObject } from "react"

const FOCUSABLE_SELECTOR = [
  'a[href]',
  'button:not([disabled])',
  'input:not([disabled])',
  'select:not([disabled])',
  'textarea:not([disabled])',
  '[tabindex]:not([tabindex="-1"])',
].join(', ')

export function useFocusTrap(
  containerRef: RefObject<HTMLElement | null>,
  active: boolean
) {
  useEffect(() => {
    if (!active || !containerRef.current) return

    const container = containerRef.current
    const previouslyFocused = document.activeElement as HTMLElement | null

    // Move focus into the container. Returns true once a focusable child was
    // found, so we can stop re-trying for late-arriving content.
    const focusFirst = (): boolean => {
      const firstFocusable = container.querySelector<HTMLElement>(FOCUSABLE_SELECTOR)
      if (firstFocusable) {
        firstFocusable.focus()
        return true
      }
      // Nothing focusable yet — park focus on the container as a fallback.
      container.focus()
      return false
    }

    // Observe for late-arriving focusable children (async preview/buttons).
    // Keep re-trying until focus actually lands inside the container, then
    // disconnect so we don't fight the user's own focus moves.
    let observer: MutationObserver | null = null
    if (!focusFirst()) {
      observer = new MutationObserver(() => {
        if (container.contains(document.activeElement) && document.activeElement !== container) {
          observer?.disconnect()
          return
        }
        if (focusFirst()) observer?.disconnect()
      })
      observer.observe(container, { childList: true, subtree: true })
    }

    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key !== 'Tab') return

      const focusableElements = Array.from(
        container.querySelectorAll<HTMLElement>(FOCUSABLE_SELECTOR)
      ).filter(el => el.offsetParent !== null) // only visible elements

      if (focusableElements.length === 0) return

      const firstEl = focusableElements[0]
      const lastEl = focusableElements[focusableElements.length - 1]

      if (e.shiftKey) {
        if (document.activeElement === firstEl || !container.contains(document.activeElement)) {
          e.preventDefault()
          lastEl.focus()
        }
      } else {
        if (document.activeElement === lastEl || !container.contains(document.activeElement)) {
          e.preventDefault()
          firstEl.focus()
        }
      }
    }

    document.addEventListener('keydown', handleKeyDown)

    return () => {
      document.removeEventListener('keydown', handleKeyDown)
      observer?.disconnect()
      // Restore focus only if the element is still in the document and visible.
      // A detached/hidden element (e.g. removed with its modal) would either
      // throw or silently move focus to <body>, so guard before focusing.
      if (
        previouslyFocused &&
        typeof previouslyFocused.focus === 'function' &&
        previouslyFocused.isConnected &&
        document.contains(previouslyFocused) &&
        previouslyFocused.offsetParent !== null
      ) {
        previouslyFocused.focus()
      }
    }
  }, [active, containerRef])
}
