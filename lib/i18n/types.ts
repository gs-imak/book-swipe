// The UI language layer. Deliberately tiny and dependency-free.
//
// Keys are FLAT and dotted strings in a plain Record — never a nested object.
// Nesting looks tidier and hands the lookup a resolver that splits on ".", and
// the moment a key contains a dot that came from data (a model id, a slug) the
// resolver walks into an object that does not exist and returns nothing, with
// the translation sitting right there in the file and no error anywhere. A flat
// map cannot have that bug.

export type Locale = "en" | "fr"

export const LOCALES: Locale[] = ["en", "fr"]

/** What each locale calls itself. Never translated — a language picker that
 *  says "French" to someone who cannot read English is useless. */
export const LOCALE_LABELS: Record<Locale, string> = {
  en: "English",
  fr: "Français",
}

export const DEFAULT_LOCALE: Locale = "en"

/**
 * A translation table.
 *
 * `fr.ts` is typed against `en.ts`'s exact key set, so a forgotten key is a
 * BUILD failure rather than an English word appearing in a French sentence.
 * That type is the whole enforcement mechanism — there is no runtime scan that
 * could tell a missing translation from an intentionally identical one.
 */
export type Dictionary = Record<string, string>

/** Values interpolated into a string: `{count} books` */
export type TranslationVars = Record<string, string | number>
