"use client"

import { createContext, useCallback, useContext, useEffect, useState } from "react"
import {
  DEFAULT_LOCALE,
  localeTag,
  persistLocale,
  resolveLocale,
  setActiveLocale,
  type Locale,
} from "@/lib/i18n"

interface I18nValue {
  locale: Locale
  setLocale: (locale: Locale) => void
}

const I18nContext = createContext<I18nValue>({
  locale: DEFAULT_LOCALE,
  setLocale: () => {},
})

export function useI18n(): I18nValue {
  return useContext(I18nContext)
}

/**
 * Owns the active language and makes the whole app re-read it.
 *
 * The first render is DELIBERATELY the default locale, matching what the
 * server emitted, so hydration cannot mismatch. The reader's real language is
 * applied in the effect below, one commit later.
 *
 * `key={locale}` on the children is the mechanism that makes a language change
 * total: `t()` is a module function with no subscription, so a switch remounts
 * the tree and every string is evaluated again. That is heavy-handed for a
 * per-frame update and exactly right for something a reader does once.
 */
export function I18nProvider({ children }: { children: React.ReactNode }) {
  const [locale, setLocaleState] = useState<Locale>(DEFAULT_LOCALE)

  useEffect(() => {
    const resolved = resolveLocale()
    if (resolved === DEFAULT_LOCALE) {
      // Still set it: the module variable starts at the default, but being
      // explicit keeps the two in step if the default ever changes.
      setActiveLocale(resolved)
      document.documentElement.lang = localeTag(resolved).slice(0, 2)
      return
    }
    setActiveLocale(resolved)
    document.documentElement.lang = localeTag(resolved).slice(0, 2)
    setLocaleState(resolved)
  }, [])

  const setLocale = useCallback((next: Locale) => {
    persistLocale(next)
    setActiveLocale(next)
    document.documentElement.lang = localeTag(next).slice(0, 2)
    setLocaleState(next)
  }, [])

  return (
    <I18nContext.Provider value={{ locale, setLocale }}>
      <div key={locale} className="contents">
        {children}
      </div>
    </I18nContext.Provider>
  )
}
