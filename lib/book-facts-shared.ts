// Pure helpers + merge policy for book-facts enrichment, shared by the server
// route (app/api/book-facts) and the client lib (lib/book-enrichment). No
// "use client", no I/O — everything here is unit-testable in isolation.
//
// Merge policy (ADR-0006): the LLM supplies STABLE literary facts LLM-first
// (description, genres, series, first-published) gated on `known`; API facts
// VERIFY and override on conflict; LIVE METRICS (ratings count / average)
// come from APIs only, never the model.

/** Below this, an LLM "description" is a fragment, not a usable hook — the
 *  route zeroes it and the merge ignores it (both sides share the floor). */
export const MIN_HOOK_CHARS = 80

export interface SeriesFacts {
  name: string
  index?: number
}

export interface LlmFacts {
  known: boolean
  description?: string
  genres?: string[]
  series?: SeriesFacts
  firstPublished?: number
}

export interface GbFacts {
  description?: string
  ratingsCount?: number
  averageRating?: number
  categories?: string[]
  publishedYear?: number
}

export interface OlFacts {
  description?: string
  firstPublished?: number
  series?: SeriesFacts
  subjects?: string[]
  ratingsCount?: number
  averageRating?: number
}

export interface BookFactsPayload {
  found: boolean
  description?: string
  descriptionSource?: "google" | "openlibrary" | "llm"
  genres?: string[]
  series?: SeriesFacts
  firstPublished?: number
  subjects?: string[]
  ratingsCount?: number
  averageRating?: number
}

export function stripHtml(raw: string): string {
  return raw
    .replace(/<[^>]*>/g, "")
    .replace(/&amp;/g, "&")
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/&nbsp;/g, " ")
    .trim()
}

export function yearFrom(raw: unknown): number | undefined {
  if (typeof raw !== "string") return undefined
  const m = raw.match(/\d{4}/)
  return m ? Number(m[0]) : undefined
}

// "Mistborn (2)" / "The Stormlight Archive #3" / "Dune ; 1" → {name, index}
export function parseSeries(raw: unknown): SeriesFacts | undefined {
  if (typeof raw !== "string" || !raw.trim()) return undefined
  const s = raw.trim()
  const m =
    s.match(/^(.*?)\s*[(#;,]\s*(?:#|book\s*)?(\d+)\s*\)?$/i) || s.match(/^(.*)$/)
  if (!m) return undefined
  const name = m[1].replace(/[\s;,(]+$/, "").trim()
  if (!name) return undefined
  const index = m[2] ? Number(m[2]) : undefined
  return { name, index }
}

// "Fiction / Fantasy / Epic" lists → clean deduped genre chips (max 4)
export function splitGenres(categories: unknown): string[] {
  if (!Array.isArray(categories)) return []
  const parts = categories
    .filter((c): c is string => typeof c === "string")
    .flatMap((c) => c.split("/"))
    .map((c) => c.trim())
    .filter((c) => c && c.toLowerCase() !== "general")
  const seen = new Set<string>()
  const out: string[] = []
  for (const p of parts) {
    const key = p.toLowerCase()
    if (!seen.has(key)) {
      seen.add(key)
      out.push(p)
    }
    if (out.length >= 4) break
  }
  return out
}

function normalize(s: string): string {
  return s
    .toLowerCase()
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .replace(/[^a-z0-9 ]/g, " ")
    .replace(/\s+/g, " ")
    .trim()
}

// Foreign-edition guard: a record only counts as OUR book when titles overlap
// after normalization (either direction — subtitles vary between editions).
export function titlesOverlap(a: string, b: unknown): boolean {
  if (typeof b !== "string" || !b) return false
  const na = normalize(a)
  const nb = normalize(b)
  if (!na || !nb) return false
  return na.includes(nb) || nb.includes(na)
}

/** Longest-real-description + LLM-first-facts-API-verified merge. */
export function mergeBookFacts(
  llm: LlmFacts | null,
  gb: GbFacts | null,
  ol: OlFacts | null,
): BookFactsPayload {
  if (!llm?.known && !gb && !ol) return { found: false }

  // Description is PROSE, not a stable fact: longest real text wins and the
  // LLM's original hook competes on equal footing (a 2-4 sentence hook only
  // beats an API stub, since substantive publisher copy is longer). Strict
  // API-override applies to series/year/genres below, per ADR-0006.
  const candidates: Array<{
    text: string
    source: NonNullable<BookFactsPayload["descriptionSource"]>
  }> = []
  if (gb?.description) candidates.push({ text: gb.description, source: "google" })
  if (ol?.description)
    candidates.push({ text: ol.description, source: "openlibrary" })
  if (llm?.known && llm.description && llm.description.length >= MIN_HOOK_CHARS)
    candidates.push({ text: llm.description, source: "llm" })
  candidates.sort((a, b) => b.text.length - a.text.length)

  const genres =
    (gb?.categories && splitGenres(gb.categories).length > 0
      ? splitGenres(gb.categories)
      : undefined) ??
    (llm?.known && llm.genres && llm.genres.length > 0
      ? llm.genres.slice(0, 4)
      : undefined)

  return {
    found: true,
    description: candidates[0]?.text,
    descriptionSource: candidates[0]?.source,
    genres,
    // Stable facts: API value verifies/overrides the model's on conflict.
    series: ol?.series ?? (llm?.known ? llm.series : undefined),
    firstPublished:
      ol?.firstPublished ?? (llm?.known ? llm.firstPublished : undefined),
    subjects: ol?.subjects,
    // Live metrics: APIs only, never the LLM (GB primary, OL fallback).
    ratingsCount: gb?.ratingsCount ?? ol?.ratingsCount,
    averageRating: gb?.averageRating ?? ol?.averageRating,
  }
}
