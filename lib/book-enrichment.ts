"use client"

// Goodreads-parity metadata enrichment, quota-proof edition (ADR-0005 +
// ADR-0006). The client makes ONE same-origin call per book to
// /api/book-facts; that route does LLM-first stable facts + globally-cached
// Google Books / Open Library verification, so external quota is spent about
// once per unique book EVER — not per user. This lib is the thin merge +
// persistence side: apply the payload to the Book, mark it enriched, and
// write it back to the cache and liked library.
// Every stage fails soft: a book is returned unchanged (and unmarked, so a
// later session retries) rather than broken.
import { Book } from "./book-data"
import { getLikedBooks, saveLikedBooks } from "./storage"
import { updateBooksInCache } from "./book-cache"
import type { BookFactsPayload } from "./book-facts-shared"

// The route may wait on its LLM stage (~12s worst case) before answering.
const FACTS_TIMEOUT_MS = 20_000
const ENRICH_CONCURRENCY = 2
/** Below this, a description reads as a stub worth replacing. */
const THIN_DESCRIPTION_CHARS = 160
const PLACEHOLDER_DESCRIPTION = "No description available."

// In-flight/session dedupe: enriching the same book twice concurrently (deck
// upgrade + showcase open) must resolve to one pipeline run.
const _inFlight = new Map<string, Promise<Book>>()

function isThin(description: string | undefined): boolean {
  return (
    !description ||
    description === PLACEHOLDER_DESCRIPTION ||
    description.length < THIN_DESCRIPTION_CHARS
  )
}

async function fetchFacts(book: Book): Promise<BookFactsPayload | null> {
  const params = new URLSearchParams()
  params.set("title", book.title)
  params.set("author", book.author)
  if (book.metadata?.source === "google") params.set("gbId", book.id)
  if (book.isbn) params.set("isbn", book.isbn)
  try {
    const res = await fetch(`/api/book-facts?${params.toString()}`, {
      signal: AbortSignal.timeout(FACTS_TIMEOUT_MS),
    })
    if (!res.ok) return null
    return (await res.json()) as BookFactsPayload
  } catch {
    return null
  }
}

/**
 * Enrich one book (idempotent — `metadata.enriched` marks completion). Always
 * resolves; on failure the input book is returned unchanged and unmarked.
 */
export function enrichBook(book: Book): Promise<Book> {
  if (book.metadata?.enriched) return Promise.resolve(book)
  const existing = _inFlight.get(book.id)
  if (existing) return existing

  const run = (async (): Promise<Book> => {
    const facts = await fetchFacts(book)
    if (!facts?.found) return book

    // Longest real text wins; the route already ordered its candidates.
    let description = book.description
    let descriptionSource: NonNullable<
      NonNullable<Book["metadata"]>["enriched"]
    >["descriptionSource"] = "original"
    if (
      facts.description &&
      facts.descriptionSource &&
      (isThin(description) || facts.description.length > description.length)
    ) {
      description = facts.description
      descriptionSource = facts.descriptionSource
    }

    // Real rating replaces the deterministic placeholder — but only with
    // enough votes to mean something (the ratingEstimated honesty contract).
    let rating = book.rating
    let ratingEstimated = book.metadata?.ratingEstimated
    if (
      facts.averageRating &&
      facts.ratingsCount !== undefined &&
      facts.ratingsCount >= 20
    ) {
      rating = Math.round(facts.averageRating * 10) / 10
      ratingEstimated = false
    }

    const enriched: NonNullable<NonNullable<Book["metadata"]>["enriched"]> = {
      at: new Date().toISOString(),
      descriptionSource,
    }
    if (facts.series) enriched.series = facts.series
    if (facts.firstPublished) enriched.firstPublished = facts.firstPublished

    return {
      ...book,
      description,
      rating,
      genre: facts.genres && facts.genres.length > 0 ? facts.genres : book.genre,
      metadata: {
        ...book.metadata,
        source: book.metadata?.source ?? "sample",
        ratingsCount: facts.ratingsCount ?? book.metadata?.ratingsCount,
        subjects: facts.subjects ?? book.metadata?.subjects,
        ratingEstimated,
        enriched,
      },
    }
  })().finally(() => _inFlight.delete(book.id))

  _inFlight.set(book.id, run)
  return run
}

/** 12437 → "12.4k" — compact ratings-count for chips and meta rows. */
export function formatCount(n: number): string {
  if (n >= 1_000_000) return (n / 1_000_000).toFixed(1).replace(/\.0$/, "") + "M"
  if (n >= 1000) return (n / 1000).toFixed(1).replace(/\.0$/, "") + "k"
  return String(n)
}

/** Persist enriched books everywhere a Book lives: cache + liked library. */
export function persistEnrichedBooks(changed: Book[]): void {
  if (changed.length === 0) return
  updateBooksInCache(changed)
  const patch = new Map(changed.map((b) => [b.id, b]))
  // Re-read at write time to not clobber swipes made while fetching
  const current = getLikedBooks()
  let touched = false
  const updated = current.map((b) => {
    const next = patch.get(b.id)
    if (next) touched = true
    return next ?? b
  })
  if (touched) saveLikedBooks(updated)
}

/**
 * Background upgrade for the books a user can currently see (deck top,
 * discover rows). Small batches, persisted as they land; `onUpdated` fires
 * per batch so surfaces can refresh live.
 */
export async function upgradeVisibleBooks(
  books: Book[],
  onUpdated?: (updated: Book[]) => void,
): Promise<Book[]> {
  const pending = books.filter((b) => !b.metadata?.enriched)
  const changed: Book[] = []
  for (let i = 0; i < pending.length; i += ENRICH_CONCURRENCY) {
    const batch = pending.slice(i, i + ENRICH_CONCURRENCY)
    const results = await Promise.allSettled(batch.map((b) => enrichBook(b)))
    const landed: Book[] = []
    results.forEach((r, j) => {
      if (r.status === "fulfilled" && r.value !== batch[j]) landed.push(r.value)
    })
    if (landed.length > 0) {
      changed.push(...landed)
      persistEnrichedBooks(landed)
      onUpdated?.(landed)
    }
  }
  return changed
}
