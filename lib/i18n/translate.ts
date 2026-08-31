import type { Dictionary, TranslationVars } from "./types"

/**
 * Resolve one key against one dictionary. Pure, so the rules are testable
 * without a React tree or a browser.
 *
 * Plurals use `key_one` / `key_other` siblings. English and French both take
 * the "other" form for zero, and French additionally takes the singular for
 * 0 as well as 1 ("0 livre", not "0 livres") — which is why the count rule is
 * a parameter of the locale rather than a global `n === 1`.
 */
export function translate(
  dict: Dictionary,
  fallback: Dictionary,
  key: string,
  vars?: TranslationVars,
): string {
  const raw = dict[key] ?? fallback[key]
  // A key with no entry anywhere is a bug, and rendering the key itself makes
  // it visible in a screenshot instead of silently blank.
  if (raw === undefined) return key
  return interpolate(raw, vars)
}

/** Pick the plural form for `count`, then resolve it. */
export function translatePlural(
  dict: Dictionary,
  fallback: Dictionary,
  key: string,
  count: number,
  isSingular: (n: number) => boolean,
  vars?: TranslationVars,
): string {
  const suffix = isSingular(count) ? "_one" : "_other"
  const withCount = { count, ...vars }
  const candidate = `${key}${suffix}`
  if (dict[candidate] !== undefined || fallback[candidate] !== undefined) {
    return translate(dict, fallback, candidate, withCount)
  }
  return translate(dict, fallback, key, withCount)
}

/** `{name}` placeholders. An unknown placeholder is left as written so it
 *  shows up in review rather than becoming an empty gap in a sentence. */
export function interpolate(raw: string, vars?: TranslationVars): string {
  if (!vars) return raw
  return raw.replace(/\{(\w+)\}/g, (whole, name: string) =>
    Object.prototype.hasOwnProperty.call(vars, name) ? String(vars[name]) : whole,
  )
}

/** English: only exactly 1 is singular. */
export function isSingularEn(n: number): boolean {
  return n === 1
}

/** French: 0 and 1 both take the singular ("0 livre", "1 livre", "2 livres"). */
export function isSingularFr(n: number): boolean {
  return n === 0 || n === 1
}
