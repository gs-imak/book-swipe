"use client"

import { Book } from "./book-data"
import { searchGoogleBooks } from "./books-api"

// Client side of the LLM-direct recommender (see app/api/recommend + ADR-0003).
// Flow: ask the route for {title, author, reason}[] based on the user's liked
// books, then resolve each title against Google Books for a real Book (covers/
// metadata), dropping any that don't resolve. Cached per liked-set so we don't
// re-call the LLM every session. Returns [] when the feature is off — callers
// fall back to the local scoring engine.

export interface RawRec {
  title: string
  author: string
  reason: string
}

const CACHE_KEY = "bookswipe_llm_recs"
const TTL_MS = 6 * 60 * 60 * 1000 // 6h

function fingerprint(likedIds: string[]): string {
  return [...likedIds].sort().join(",")
}

/** Fetch raw LLM recommendations, cached by liked-set fingerprint. */
export async function getRawRecommendations(
  liked: Book[],
  excludeTitles: string[],
  limit = 12,
): Promise<RawRec[]> {
  if (typeof window === "undefined" || liked.length === 0) return []
  const fp = fingerprint(liked.map((b) => b.id))

  try {
    const raw = localStorage.getItem(CACHE_KEY)
    if (raw) {
      const c = JSON.parse(raw)
      if (c && c.fp === fp && typeof c.at === "number" && Date.now() - c.at < TTL_MS && Array.isArray(c.recs)) {
        return c.recs as RawRec[]
      }
    }
  } catch {
    /* ignore cache read errors */
  }

  try {
    const res = await fetch("/api/recommend", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        likedBooks: liked.slice(-30).map((b) => ({ title: b.title, author: b.author, genre: b.genre })),
        excludeTitles: excludeTitles.slice(0, 100),
        limit,
      }),
    })
    if (!res.ok) return []
    const data = await res.json()
    const recs: RawRec[] = Array.isArray(data?.recommendations)
      ? data.recommendations
          .filter((r: unknown): r is RawRec =>
            !!r && typeof (r as RawRec).title === "string" && typeof (r as RawRec).author === "string",
          )
          .map((r: RawRec) => ({ title: r.title, author: r.author, reason: String(r.reason ?? "") }))
      : []
    try {
      localStorage.setItem(CACHE_KEY, JSON.stringify({ fp, at: Date.now(), recs }))
    } catch {
      /* ignore quota */
    }
    return recs
  } catch {
    return []
  }
}

/**
 * Resolve raw recommendations to real Book objects via Google Books, attaching
 * each LLM "reason" to the resolved book id. Titles that don't resolve (or are
 * already seen) are dropped — so hallucinated/duplicate suggestions never surface.
 */
export async function resolveRecommendations(
  recs: RawRec[],
  excludeIds: Set<string>,
): Promise<{ books: Book[]; reasons: Record<string, string> }> {
  const results = await Promise.allSettled(
    recs.map((r) =>
      searchGoogleBooks(`intitle:"${r.title}" inauthor:"${r.author}"`, 1).then((books) => ({
        book: books[0] as Book | undefined,
        reason: r.reason,
      })),
    ),
  )

  const books: Book[] = []
  const reasons: Record<string, string> = {}
  const seen = new Set(excludeIds)

  for (const res of results) {
    if (res.status !== "fulfilled") continue
    const { book, reason } = res.value
    if (!book || seen.has(book.id)) continue
    seen.add(book.id)
    books.push(book)
    if (reason) reasons[book.id] = reason
  }

  return { books, reasons }
}

/**
 * End-to-end: liked books -> LLM recs -> resolved real Books + reason map.
 * `excludeIds` are books already in the deck/library/passed (won't be re-shown);
 * `excludeTitles` is sent to the LLM so it doesn't recommend them in the first place.
 */
export async function getRecommendedBooks(
  liked: Book[],
  excludeIds: Set<string>,
  excludeTitles: string[],
  limit = 12,
): Promise<{ books: Book[]; reasons: Record<string, string> }> {
  const recs = await getRawRecommendations(liked, excludeTitles, limit)
  if (recs.length === 0) return { books: [], reasons: {} }
  return resolveRecommendations(recs, excludeIds)
}
