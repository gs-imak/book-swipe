/**
 * Centralized book-cover URL resolution.
 *
 * One place that knows how to turn raw API data into the best cover URL we can
 * serve, plus a graceful fallback. The priority is Goodreads-grade quality:
 *
 *   1. Amazon by ISBN-10  — the same images Goodreads serves (~500px, correct
 *      edition because it's keyed on the ISBN, not a fuzzy title match).
 *   2. The source's own cover (upgraded Google Books, or Open Library -L) as a
 *      fallback for books with no derivable ISBN-10 or no Amazon cover.
 *
 * Amazon returns a 43-byte 1×1 gif when it has no cover for an id; <BookCover>
 * detects that (naturalWidth ≤ 1) and steps down to `coverFallback`.
 */

import { toIsbn10 } from "./isbn"

/** Largest-available Amazon cover for an ISBN-10. */
export function amazonCoverUrl(isbn10: string): string {
  // `_SCLZZZZZZZ_` asks for the largest stored size; arbitrary `_SX###_` codes
  // can silently return a tiny fallback render, so we don't use them.
  return `https://m.media-amazon.com/images/P/${isbn10}.01._SCLZZZZZZZ_.jpg`
}

/**
 * Upgrade a Google Books cover thumbnail URL to a sharper, secure variant.
 * Pure URL transform: forces https, strips the curl-edge effect, and bumps the
 * `zoom` parameter so we request a larger render. Leaves non-Google URLs (and
 * URLs that don't match the expected pattern) untouched.
 */
export function upgradeGoogleBooksCoverUrl(url: string): string {
  if (!url) return url

  // Force HTTPS and drop the page-curl edge effect on every cover form.
  let upgraded = url
    .replace(/^http:\/\//i, "https://")
    .replace(/&edge=curl/gi, "")

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

export interface ResolvedCover {
  /** Best cover to try first. */
  cover: string
  /** Next source to try if `cover` fails or returns Amazon's 1×1 "no image". */
  coverFallback?: string
}

/**
 * Resolve the best cover URL for a book given its ISBN and the source-native
 * cover (an upgraded Google Books URL). Prefers the Amazon high-res cover keyed
 * on ISBN-10, falling back to the source cover.
 */
export function resolveBestCover({
  isbn,
  googleCover,
}: {
  isbn?: string
  googleCover: string
}): ResolvedCover {
  const isbn10 = toIsbn10(isbn)
  if (isbn10) {
    return {
      cover: amazonCoverUrl(isbn10),
      coverFallback: googleCover || undefined,
    }
  }
  return { cover: googleCover, coverFallback: undefined }
}
