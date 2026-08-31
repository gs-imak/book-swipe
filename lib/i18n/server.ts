import { cookies, headers } from "next/headers"
import en from "./en"
import fr from "./fr"
import { translate } from "./translate"
import { DEFAULT_LOCALE, LOCALES, type Dictionary, type Locale, type TranslationVars } from "./types"

// Server-side translation for the handful of surfaces that render before any
// client code runs: the legal pages, the 404, the skip link, page metadata.
//
// Deliberately NOT the module-variable mechanism the client uses. A module
// variable on the server is shared by every concurrent request, so writing a
// visitor's language into one would serve their language to whoever else is
// being rendered at that moment. The locale is resolved per request and the
// translator is bound to it.

const DICTIONARIES: Record<Locale, Dictionary> = { en, fr }
const LOCALE_COOKIE = "bookswipe_locale"

function asLocale(value: unknown): Locale | null {
  return typeof value === "string" && (LOCALES as string[]).includes(value)
    ? (value as Locale)
    : null
}

/**
 * This request's language: the reader's stored choice if they have made one,
 * otherwise the best match from Accept-Language, otherwise English.
 */
export async function getServerLocale(): Promise<Locale> {
  const stored = asLocale((await cookies()).get(LOCALE_COOKIE)?.value)
  if (stored) return stored

  const header = (await headers()).get("accept-language") ?? ""
  // "fr-CH,fr;q=0.9,en;q=0.8" — ordered by q, so the first tag we can serve wins.
  const tags = header
    .split(",")
    .map((part) => {
      const [tag, ...params] = part.trim().split(";")
      const q = params.find((p) => p.trim().startsWith("q="))
      return { tag: tag.toLowerCase(), q: q ? Number(q.split("=")[1]) || 0 : 1 }
    })
    .filter((entry) => entry.tag)
    .sort((a, b) => b.q - a.q)
  for (const { tag } of tags) {
    const base = asLocale(tag.split("-")[0])
    if (base) return base
  }
  return DEFAULT_LOCALE
}

/** A translator bound to this request's language. */
export async function serverT(): Promise<(key: string, vars?: TranslationVars) => string> {
  const locale = await getServerLocale()
  const dict = DICTIONARIES[locale]
  return (key, vars) => translate(dict, en, key, vars)
}
