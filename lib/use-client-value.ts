"use client"

import { useSyncExternalStore } from "react"

// One-shot external read: nothing invalidates these values during a component's
// life (they're re-read on remount), so the subscribe function is a no-op.
const emptySubscribe = () => () => {}

/**
 * Read a client-only value (localStorage, matchMedia, Notification.permission…)
 * in a hydration-safe way.
 *
 * The server — and the client's first, hydrating render — use `serverValue`, so
 * both trees match; React then re-renders with the real client value. This is
 * the documented `useSyncExternalStore` use case for client-only data, and it
 * replaces the `useState(default)` + `useEffect(() => setX(read()))` pattern
 * that triggers a cascading render on every mount.
 *
 * Pass a `serverValue` that renders *nothing surprising* (e.g. `false` for
 * "show this badge") so there's no flash before the real value arrives.
 */
export function useClientValue<T>(getClientValue: () => T, serverValue: T): T {
  return useSyncExternalStore(emptySubscribe, getClientValue, () => serverValue)
}
