// The translation entry point every component imports.
//
// `t` is a plain module function rather than a hook, for one reason: the app
// has ~1,200 strings across 65 files, and threading a hook through every one of
// them is 65 opportunities to put it inside a callback, a helper or a map and
// break the rules of hooks. A module function has no such failure mode.
//
// Re-rendering on a language change is handled once, at the root: the provider
// keys the app on the active locale, so switching remounts the tree and every
// `t()` call is evaluated again. Language changes are rare; a remount is the
// cheap and total answer to "did every string update".
//
// SERVER RENDERS ARE ALWAYS THE DEFAULT LOCALE. The active locale lives in a
// module variable, and a module variable on the server is shared by every
// concurrent request — writing a visitor's language into it would leak that
// language into someone else's page. So the server emits English, the client's
// first render matches it (no hydration mismatch), and the provider corrects
// the locale in an effect immediately after mount.

import en from "./en"
import fr from "./fr"
import { DEFAULT_LOCALE, type Dictionary, type Locale, type TranslationVars } from "./types"
import { isSingularEn, isSingularFr, translate, translatePlural } from "./translate"

const DICTIONARIES: Record<Locale, Dictionary> = { en, fr }
const PLURAL_RULES: Record<Locale, (n: number) => boolean> = {
  en: isSingularEn,
  fr: isSingularFr,
}

let activeLocale: Locale = DEFAULT_LOCALE

export function getActiveLocale(): Locale {
  return activeLocale
}

/** Called by the provider only. Everything else reads. */
export function setActiveLocale(locale: Locale): void {
  if (typeof window === "undefined") return
  activeLocale = locale
}

/** Translate one key. `t("deck.empty_title")`, `t("deck.count", { n: 12 })`. */
export function t(key: string, vars?: TranslationVars): string {
  return translate(DICTIONARIES[activeLocale], en, key, vars)
}

/** Translate a counted string against `key_one` / `key_other`. */
export function tp(key: string, count: number, vars?: TranslationVars): string {
  return translatePlural(
    DICTIONARIES[activeLocale],
    en,
    key,
    count,
    PLURAL_RULES[activeLocale],
    vars,
  )
}

/** The BCP-47 tag for Intl and for `<html lang>`. */
export function localeTag(locale: Locale = activeLocale): string {
  return locale === "fr" ? "fr-FR" : "en-US"
}

export function formatNumber(value: number, options?: Intl.NumberFormatOptions): string {
  return new Intl.NumberFormat(localeTag(), options).format(value)
}

export function formatDate(value: Date | number, options?: Intl.DateTimeFormatOptions): string {
  return new Intl.DateTimeFormat(localeTag(), options).format(value)
}

export { en, fr }
export * from "./types"
export * from "./locale"
