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
const listeners = new Set<() => void>()

function subscribe(listener: () => void): () => void {
  listeners.add(listener)
  return () => listeners.delete(listener)
}

function getSnapshot(): Locale {
  if (!resolved) {
    resolved = true
    current = resolveLocale()
    setActiveLocale(current)
  }
  return current
}

function getServerSnapshot(): Locale {
  // The server has no reader to ask, and a module variable there is shared by
  // every concurrent request — see lib/i18n.
  return DEFAULT_LOCALE
}

function writeLocale(next: Locale): void {
  current = next
  resolved = true
  setActiveLocale(next)
  listeners.forEach((l) => l())
}

export function useI18n(): { locale: Locale; setLocale: (locale: Locale) => void } {
  const locale = useSyncExternalStore(subscribe, getSnapshot, getServerSnapshot)
  const setLocale = useCallback((next: Locale) => {
    persistLocale(next)
    writeLocale(next)
  }, [])
  return { locale, setLocale }
}

/**
 * Makes the whole app re-read the active language.
 *
 * `key={locale}` is the mechanism: `t()` is a module function with no
 * subscription of its own, so a language change remounts the tree and every
 * string is evaluated again. Heavy-handed for a per-frame update, and exactly
 * right for something a reader does once.
 */
export function I18nProvider({ children }: { children: React.ReactNode }) {
  const locale = useSyncExternalStore(subscribe, getSnapshot, getServerSnapshot)

  useEffect(() => {
    document.documentElement.lang = localeTag(locale).slice(0, 2)
    // So the NEXT request is server-rendered in the same language: page
    // metadata and the legal pages are produced before any of this runs.
    syncLocaleCookie(locale)
  }, [locale])

  return (
    <div key={locale} className="contents">
      {children}
    </div>
  )
}
