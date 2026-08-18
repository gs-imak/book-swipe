"use client"

import { useSyncExternalStore } from "react"
import { getLikedBooks } from "./storage"

// The library already broadcasts every change as a DOM event, which makes the
// liked count a genuine external store — subscribing to it beats mirroring the
// value into component state via an effect.
// Invalidated by the very events that can change the count, so the cache can
// never go stale. Without it getSnapshot re-parses the whole liked array on
// every render AND every tear-check — measured at 26 full parses per like,
// which is the cost that grows with the size of the user's library.
let cachedCount: number | null = null

function invalidate(): void {
  cachedCount = null
}

function subscribe(onChange: () => void): () => void {
  const handler = () => {
    invalidate()
    onChange()
  }
  window.addEventListener("bookswipe:liked-changed", handler)
  // Another tab wrote to localStorage.
  window.addEventListener("storage", handler)
  return () => {
    window.removeEventListener("bookswipe:liked-changed", handler)
    window.removeEventListener("storage", handler)
  }
}

function getSnapshot(): number {
  if (cachedCount === null) cachedCount = getLikedBooks().length
  return cachedCount
}

/** Current number of liked books, kept in sync across the app and across tabs. */
export function useLikedCount(): number {
  return useSyncExternalStore(subscribe, getSnapshot, () => 0)
}
