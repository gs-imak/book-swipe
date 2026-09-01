"use client"

import { useCallback, useEffect, useSyncExternalStore } from "react"
import {
  DEFAULT_LOCALE,
  localeTag,
  persistLocale,
  resolveLocale,
  setActiveLocale,
  syncLocaleCookie,
  type Locale,
} from "@/lib/i18n"

// A tiny store rather than a context value, so the reader's language can be
// read DURING render on the client while the server still renders the default.
// That is exactly what useSyncExternalStore's third argument is for, and it is
// what keeps this from being a setState-in-an-effect: hydration matches the
// server snapshot, then React re-renders with the client one, with no mismatch
// and no extra commit of our own.
let current: Locale = DEFAULT_LOCALE
let resolved = false
// Counts only EXPLICIT switches, never the initial resolution — see the
// provider below for why the remount key hangs off this and not off `current`.
let switches = 0
const listeners = new Set<() => void>()

function subscribe(listener: () => void): () => void {
  listeners.add(listener)
  return () => listeners.delete(listener)
}

function getSnapshot(): string {
  if (!resolved) {
    resolved = true
    current = resolveLocale()
    setActiveLocale(current)
  }
  return `${current}:${switches}`
}

function getServerSnapshot(): string {
  // The server has no reader to ask, and a module variable there is shared by
  // every concurrent request — see lib/i18n.
  return `${DEFAULT_LOCALE}:0`
}

export function useI18n(): { locale: Locale; setLocale: (locale: Locale) => void } {
  const snapshot = useSyncExternalStore(subscribe, getSnapshot, getServerSnapshot)
  const setLocale = useCallback((next: Locale) => {
    if (next === current) return
    persistLocale(next)
    current = next
    resolved = true
    switches += 1
    setActiveLocale(next)
    listeners.forEach((l) => l())
  }, [])
  return { locale: snapshot.split(":")[0] as Locale, setLocale }
}

/**
 * Makes the whole app re-read the active language.
 *
 * The remount key is the SWITCH COUNT, not the locale. `t()` is a module
 * function with no subscription of its own, so a language change has to remount
 * the tree for every string to be evaluated again — but keying on the locale
 * meant a French reader paid that remount on EVERY load, because the first
 * render is deliberately the default locale and the resolved one arrives a
 * commit later. The switch count is 0 through that correction and only moves
 * when a reader actually picks a language, so the remount happens exactly when
 * it is needed and never on a cold start. The strings still update on the
 * initial correction: the same commit re-renders the tree with the new locale
 * already active.
 */
export function I18nProvider({ children }: { children: React.ReactNode }) {
  const snapshot = useSyncExternalStore(subscribe, getSnapshot, getServerSnapshot)
  const [locale, switchCount] = snapshot.split(":")

  useEffect(() => {
    document.documentElement.lang = localeTag(locale as Locale).slice(0, 2)
    // So the NEXT request is server-rendered in the same language: the legal
    // pages are produced before any of this runs.
    syncLocaleCookie(locale as Locale)
  }, [locale])

  return (
    <div key={switchCount} className="contents">
      {children}
    </div>
  )
}
