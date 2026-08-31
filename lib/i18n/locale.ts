"use client"

import { DEFAULT_LOCALE, LOCALES, type Locale } from "./types"

export const LOCALE_STORAGE_KEY = "bookswipe_ui_locale"
/** Mirrored into a cookie so the SERVER can read it — page metadata (the tab
 *  title, the share description) is rendered before any client code runs. */
export const LOCALE_COOKIE = "bookswipe_locale"

export function isLocale(value: unknown): value is Locale {
  return typeof value === "string" && (LOCALES as string[]).includes(value)
}

/** The stored choice, or null when the reader has never made one. */
export function getStoredLocale(): Locale | null {
  if (typeof window === "undefined") return null
  try {
    const stored = localStorage.getItem(LOCALE_STORAGE_KEY)
    return isLocale(stored) ? stored : null
  } catch {
    return null
  }
}

/**
 * What the browser says the reader speaks, mapped onto a language we have.
 * `navigator.languages` is ordered by preference, so the first entry we can
 * actually serve wins — a fr-CA/en-GB reader gets French, not the base tag.
 */
export function detectBrowserLocale(): Locale {
  if (typeof navigator === "undefined") return DEFAULT_LOCALE
  const tags = navigator.languages?.length
    ? navigator.languages
    : [navigator.language].filter(Boolean)
  for (const tag of tags) {
    const base = String(tag).toLowerCase().split("-")[0]
    if (isLocale(base)) return base
  }
  return DEFAULT_LOCALE
}

/** The locale to use: an explicit choice first, the browser's otherwise. */
export function resolveLocale(): Locale {
  return getStoredLocale() ?? detectBrowserLocale()
}

/**
 * Tell the SERVER which language to render, without recording a choice the
 * reader did not make. The cookie is what generateMetadata and the legal pages
 * read; localStorage is reserved for an explicit pick, so a reader who changes
 * their browser language still gets the new one.
 */
export function syncLocaleCookie(locale: Locale): void {
  if (typeof document === "undefined") return
  try {
    document.cookie = `${LOCALE_COOKIE}=${locale}; path=/; max-age=31536000; samesite=lax`
  } catch {
    /* server-rendered metadata falls back to Accept-Language */
  }
}

export function persistLocale(locale: Locale): void {
  if (typeof window === "undefined") return
  try {
    localStorage.setItem(LOCALE_STORAGE_KEY, locale)
  } catch {
    // Private mode: the choice lasts the session, which is better than failing.
  }
  try {
    // A year, path-wide, SameSite=Lax so it rides ordinary navigations. No
    // personal data, so nothing here needs a consent banner.
    document.cookie = `${LOCALE_COOKIE}=${locale}; path=/; max-age=31536000; samesite=lax`
  } catch {
    /* nothing depends on the cookie beyond server-rendered metadata */
  }
}
