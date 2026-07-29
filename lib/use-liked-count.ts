"use client"

import { useSyncExternalStore } from "react"
import { getLikedBooks } from "./storage"

// The library already broadcasts every change as a DOM event, which makes the
// liked count a genuine external store — subscribing to it beats mirroring the
// value into component state via an effect.
function subscribe(onChange: () => void): () => void {
  window.addEventListener("bookswipe:liked-changed", onChange)
  // Another tab wrote to localStorage.
  window.addEventListener("storage", onChange)
  return () => {
    window.removeEventListener("bookswipe:liked-changed", onChange)
    window.removeEventListener("storage", onChange)
  }
}

// Returns a number, so a fresh read per call is safe (no snapshot caching needed).
function getSnapshot(): number {
  return getLikedBooks().length
}

/** Current number of liked books, kept in sync across the app and across tabs. */
export function useLikedCount(): number {
  return useSyncExternalStore(subscribe, getSnapshot, () => 0)
}
