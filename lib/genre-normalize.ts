/**
 * Turn a source's raw category strings into chips a reader recognises.
 *
 * Google Books returns library/BISAC headings verbatim, so unnormalised chips
 * shipped things like "Barcelona (Spain)", "ESL.", "England, Northern" and
 * "Cold cases (Criminal investigation)" onto cards — 9 of 107 books in a live
 * cache sample. Open Library's path already maps subjects to a small genre
 * vocabulary; this gives the Google path the same treatment so both ingest
 * sites agree.
 */

/** The genre vocabulary the app actually browses by. */
export const CANONICAL_GENRES = [
  "Fantasy",
  "Science Fiction",
  "Mystery",
  "Romance",
  "Thriller",
  "Contemporary Fiction",
  "Historical Fiction",
  "Biography",
  "Self-Help",
  "Philosophy",
  "Horror",
  "Comedy",
  "LGBTQ+",
  "Adventure",
  "Young Adult",
  "Classics",
  "Poetry",
] as const

/** Substring → canonical genre. Longest keys are tried first (see below). */
const SUBJECT_ALIASES: Record<string, string> = {
  "science fiction": "Science Fiction",
  "historical fiction": "Historical Fiction",
  "literary criticism": "Contemporary Fiction",
  "literary collections": "Contemporary Fiction",
  "young adult": "Young Adult",
  "personal development": "Self-Help",
  "self-help": "Self-Help",
  "self help": "Self-Help",
  "love stories": "Romance",
  "graphic novel": "Comedy",
  "true crime": "Thriller",
  autobiography: "Biography",
  autobiographies: "Biography",
  biography: "Biography",
  memoir: "Biography",
  fantasy: "Fantasy",
  "sci-fi": "Science Fiction",
  dystopian: "Science Fiction",
  mystery: "Mystery",
  detective: "Mystery",
  thriller: "Thriller",
  thrillers: "Thriller",
  suspense: "Thriller",
  crime: "Thriller",
  espionage: "Thriller",
  romance: "Romance",
  horror: "Horror",
  gothic: "Horror",
  philosophy: "Philosophy",
  humor: "Comedy",
  humour: "Comedy",
  satire: "Comedy",
  comics: "Comedy",
  poetry: "Poetry",
  adventure: "Adventure",
  classics: "Classics",
  "coming of age": "Young Adult",
  juvenile: "Young Adult",
  lgbt: "LGBTQ+",
  queer: "LGBTQ+",
  gay: "LGBTQ+",
  lesbian: "LGBTQ+",
  fiction: "Contemporary Fiction",
}

// Longest key first so "science fiction" wins over "fiction".
const ALIAS_ENTRIES = Object.entries(SUBJECT_ALIASES).sort((a, b) => b[0].length - a[0].length)

/**
 * A heading that is a place, a discipline or a catalogue artefact rather than
 * a genre. These are what made the chips look like a library index.
 */
function looksLikeCatalogueNoise(raw: string): boolean {
  const s = raw.trim()
  if (!s) return true
  if (/\(.*\)/.test(s)) return true // "Barcelona (Spain)"
  if (/\.$/.test(s)) return true // "ESL."
  if (/,/.test(s)) return true // "England, Northern"
  if (s.length > 28) return true
  if (/^\d/.test(s)) return true
  return false
}

/**
 * Map raw categories onto the canonical vocabulary.
 *
 * Anything that maps is kept; anything that does not is dropped rather than
 * shown, because an unmapped heading is exactly the noise this exists to stop.
 * When nothing maps, `fallback` is used so a card is never chip-less.
 */
export function normalizeGenres(raw: unknown, fallback?: string): string[] {
  const parts = (Array.isArray(raw) ? raw : [])
    .filter((c): c is string => typeof c === "string")
    .flatMap((c) => c.split("/"))
    .map((c) => c.trim())
    .filter(Boolean)

  const out: string[] = []
  const seen = new Set<string>()
  const add = (genre: string) => {
    const key = genre.toLowerCase()
    if (seen.has(key)) return
    seen.add(key)
    out.push(genre)
  }

  for (const part of parts) {
    const lower = part.toLowerCase()
    const hit = ALIAS_ENTRIES.find(([alias]) => lower.includes(alias))
    if (hit) {
      add(hit[1])
      continue
    }
    // No alias, but a clean short heading that is already title-ish is worth
    // keeping (e.g. a genre we simply have not aliased yet).
    if (!looksLikeCatalogueNoise(part) && part.split(" ").length <= 3) {
      const canonical = CANONICAL_GENRES.find((g) => g.toLowerCase() === lower)
      if (canonical) add(canonical)
    }
    if (out.length >= 3) break
  }

  if (out.length === 0 && fallback) add(fallback)
  return out.slice(0, 3)
}
