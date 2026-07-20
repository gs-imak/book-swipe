"use client"

import { Book } from "./book-data"
import { isItunesCover } from "./covers"
import { getLikedBooks, saveLikedBooks } from "./storage"

// Background cover upgrade: swap each book's source cover (Google / Open Library)
// for the Goodreads-grade Apple Books artwork resolved by its ISBN, keeping the
// original as the fallback. Reliable by construction — the source cover is always
// correct and present, and iTunes only *replaces* it when it returns a real hit,
// so a miss or an outage leaves the correct cover untouched (never a broken/1x1).

const ITUNES_FETCH_TIMEOUT_MS = 6000
const ITUNES_FETCH_CONCURRENCY = 6

// Resolved book-key -> iTunes cover URL (or null). Session cache so we never refetch.
const _itunesCoverCache = new Map<string, string | null>()

function coverCacheKey(book: Book): string {
  return book.isbn || `${book.title}::${book.author}`
}

/**
 * Resolve one book's iTunes cover via the same-origin proxy (edge-cached).
 * Sends the ISBN when present (edition-exact lookup) plus title+author so the
 * server can fall back to a strictly-validated catalog search.
 */
async function resolveItunesCover(book: Book): Promise<string | null> {
  const key = coverCacheKey(book)
  const cached = _itunesCoverCache.get(key)
  if (cached !== undefined) return cached

  const controller = new AbortController()
  const timeout = setTimeout(() => controller.abort(), ITUNES_FETCH_TIMEOUT_MS)
  try {
    const params = new URLSearchParams()
    if (book.isbn) params.set("isbn", book.isbn)
    params.set("title", book.title)
    params.set("author", book.author)
    const res = await fetch(`/api/itunes-cover?${params.toString()}`, {
      signal: controller.signal,
    })
    if (!res.ok) return null // transient — don't cache, allow a later retry
    const data = await res.json()
    const cover: string | null = data?.cover ?? null
    _itunesCoverCache.set(key, cover)
    return cover
  } catch {
    return null
  } finally {
    clearTimeout(timeout)
  }
}

/**
 * Upgrade books to their high-res iTunes cover. Returns only the books whose
 * cover changed (cover = iTunes, coverFallback = the original source cover).
 */
export async function upgradeCoversWithItunes(books: Book[]): Promise<Book[]> {
  const pending = books.filter(
    (b) => (b.isbn || (b.title && b.author)) && !isItunesCover(b.cover)
  )
  if (pending.length === 0) return []

  const changed: Book[] = []
  for (let i = 0; i < pending.length; i += ITUNES_FETCH_CONCURRENCY) {
    const batch = pending.slice(i, i + ITUNES_FETCH_CONCURRENCY)
    const covers = await Promise.allSettled(batch.map((b) => resolveItunesCover(b)))
    covers.forEach((r, j) => {
      if (r.status === "fulfilled" && r.value) {
        const book = batch[j]
        changed.push({ ...book, cover: r.value, coverFallback: book.cover })
      }
    })
  }
  return changed
}

/**
 * Background pass for the LIBRARY: upgrade the user's liked books to their
 * iTunes covers and persist the result, so the shelf the user stares at gets
 * the same Goodreads-grade artwork as the swipe deck. Returns the updated
 * full list when anything changed, null otherwise. Best-effort by design.
 */
export async function upgradeLikedBookCovers(): Promise<Book[] | null> {
  const liked = getLikedBooks()
  const changed = await upgradeCoversWithItunes(liked)
  if (changed.length === 0) return null

  const patch = new Map(changed.map((b) => [b.id, b]))
  // Re-read at write time to not clobber swipes made while fetching
  const current = getLikedBooks()
  const updated = current.map((b) => patch.get(b.id) ?? b)
  saveLikedBooks(updated)
  return updated
}
