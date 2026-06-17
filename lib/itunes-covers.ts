"use client"

import { Book } from "./book-data"
import { isItunesCover } from "./covers"

// Background cover upgrade: swap each book's source cover (Google / Open Library)
// for the Goodreads-grade Apple Books artwork resolved by its ISBN, keeping the
// original as the fallback. Reliable by construction — the source cover is always
// correct and present, and iTunes only *replaces* it when it returns a real hit,
// so a miss or an outage leaves the correct cover untouched (never a broken/1x1).

const ITUNES_FETCH_TIMEOUT_MS = 6000
const ITUNES_FETCH_CONCURRENCY = 6

// Resolved ISBN -> iTunes cover URL (or null). Session cache so we never refetch.
const _itunesCoverCache = new Map<string, string | null>()

/** Resolve one book's iTunes cover via the same-origin proxy (edge-cached). */
async function resolveItunesCover(isbn: string): Promise<string | null> {
  const cached = _itunesCoverCache.get(isbn)
  if (cached !== undefined) return cached

  const controller = new AbortController()
  const timeout = setTimeout(() => controller.abort(), ITUNES_FETCH_TIMEOUT_MS)
  try {
    const res = await fetch(`/api/itunes-cover?isbn=${encodeURIComponent(isbn)}`, {
      signal: controller.signal,
    })
    if (!res.ok) return null // transient — don't cache, allow a later retry
    const data = await res.json()
    const cover: string | null = data?.cover ?? null
    _itunesCoverCache.set(isbn, cover)
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
  const pending = books.filter((b) => b.isbn && !isItunesCover(b.cover))
  if (pending.length === 0) return []

  const changed: Book[] = []
  for (let i = 0; i < pending.length; i += ITUNES_FETCH_CONCURRENCY) {
    const batch = pending.slice(i, i + ITUNES_FETCH_CONCURRENCY)
    const covers = await Promise.allSettled(batch.map((b) => resolveItunesCover(b.isbn!)))
    covers.forEach((r, j) => {
      if (r.status === "fulfilled" && r.value) {
        const book = batch[j]
        changed.push({ ...book, cover: r.value, coverFallback: book.cover })
      }
    })
  }
  return changed
}
