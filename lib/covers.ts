/**
 * Cover URL helpers.
 *
 * Covers come from each book's own source of record (correct edition, reliable):
 *   - Google Books `imageLinks` for Google-sourced books (upgraded for sharpness)
 *   - Open Library `-L` for OL-sourced books
 *
 * High-resolution covers are then layered on in a background pass via the
 * iTunes / Apple Books API (see lib/itunes-covers.ts) — an official, exact-ISBN
 * source on a robust CDN, replacing the fragile Amazon image hotlinking that
 * produced missing (1x1 gif) and wrong-edition covers.
 */

/**
 * Sanitize a Google Books cover URL without changing its size: forces https
 * and strips the page-curl edge effect. This is the safe form used as the
 * FALLBACK cover — it always renders, unlike higher zoom levels which can 404.
 */
export function sanitizeGoogleCoverUrl(url: string): string {
  if (!url) return url
  return url
    .replace(/^http:\/\//i, "https://")
    .replace(/&edge=curl/gi, "")
}

/**
 * Upgrade a Google Books cover thumbnail URL to a sharper, secure variant.
 * Pure URL transform: sanitizes (https, no curl edge) and bumps the `zoom`
 * parameter so we request a larger render. Leaves non-Google URLs (and URLs
 * that don't match the expected pattern) untouched.
 */
export function upgradeGoogleBooksCoverUrl(url: string): string {
  if (!url) return url

  let upgraded = sanitizeGoogleCoverUrl(url)

  const isGoogleCover =
    upgraded.includes("books.google.com") ||
    upgraded.includes("books.googleusercontent.com")

  if (isGoogleCover) {
    // Bump small/default zoom levels (0 or 1) up to zoom=2 for a sharper image.
    // Leave already-large zoom levels (2+) as-is so we don't request broken sizes.
    upgraded = upgraded.replace(/([?&])zoom=(\d+)/gi, (match, sep, level) =>
      parseInt(level, 10) <= 1 ? `${sep}zoom=2` : match
    )
  }

  return upgraded
}

/**
 * Pick the best ISBN from an Open Library `isbn` field (a flat, unordered list
 * across ALL editions, including foreign ones). Preference: English-language
 * registration groups first (978-0 / 978-1) — they're what the Apple Books US
 * lookup actually resolves — then any ISBN-13, then English ISBN-10, then any
 * ISBN-10. Used to key edition-exact cover lookups (iTunes, OL by-ISBN).
 */
export function pickPreferredIsbn(isbns: string[] | undefined): string | undefined {
  if (!isbns || isbns.length === 0) return undefined
  const cleaned = isbns
    .map((i) => i.replace(/[^0-9Xx]/g, ""))
    .filter(Boolean)
  return (
    cleaned.find((i) => /^978[01]\d{9}$/.test(i)) ||
    cleaned.find((i) => /^97[89]\d{10}$/.test(i)) ||
    cleaned.find((i) => /^[01]\d{8}[\dXx]$/.test(i)) ||
    cleaned.find((i) => /^\d{9}[\dXx]$/.test(i))
  )
}

/**
 * Turn an iTunes `artworkUrl100` into a high-resolution cover URL. Apple artwork
 * URLs end in a size segment like `/100x100bb.jpg`; swapping it for a larger box
 * yields a crisp ~1000px cover (`bb` preserves aspect ratio).
 */
export function itunesHiResArtwork(artworkUrl: string, px = 1000): string {
  if (!artworkUrl) return artworkUrl
  return artworkUrl.replace(/\/\d+x\d+bb\./, `/${px}x${px}bb.`)
}

/** True for Apple/iTunes artwork URLs (so we don't re-upgrade an already-iTunes cover). */
export function isItunesCover(url: string | undefined): boolean {
  return !!url && url.includes("mzstatic.com")
}

function normalizeForMatch(s: string): string {
  return s
    .toLowerCase()
    .normalize("NFKD")
    .replace(/[̀-ͯ]/g, "") // strip diacritics
    .replace(/[^a-z0-9\s]/g, " ")
    .replace(/\s+/g, " ")
    .trim()
}

/**
 * Strict match check for iTunes SEARCH results (title+author fallback when the
 * by-ISBN lookup misses). A wrong cover is far worse than no upgrade, so both
 * conditions must hold: the titles must contain each other (subtitle variants
 * tolerated, but only for titles long enough to be distinctive) AND the
 * author's surname must appear in the result's artist name (initials and
 * middle names vary across catalogs; surnames don't).
 */
export function itunesResultMatchesBook(
  result: { trackName?: string; artistName?: string },
  title: string,
  author: string
): boolean {
  const rTitle = normalizeForMatch(result.trackName || "")
  const rAuthor = normalizeForMatch(result.artistName || "")
  const bTitle = normalizeForMatch(title)
  const bAuthor = normalizeForMatch(author)
  if (!rTitle || !bTitle || !rAuthor || !bAuthor) return false

  const titleOk =
    bTitle.length >= 4
      ? rTitle.includes(bTitle) || bTitle.includes(rTitle)
      : rTitle === bTitle

  const surname = bAuthor.split(" ").pop() || ""
  const authorOk = surname.length >= 3 ? rAuthor.includes(surname) : rAuthor === bAuthor

  return titleOk && authorOk
}
