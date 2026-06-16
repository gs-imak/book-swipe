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
