// Server-side Open Library access, shared by every route that needs it.
//
// Extracted from app/api/book-facts so a second consumer (the ratings
// breakdown) reuses the same work-key resolution and the same cache layers
// instead of re-deriving them. Two books' worth of duplicated fetch policy is
// how the two routes would drift apart on timeouts and on the ISBN trap below.
//
// No "use client" — this module is Node-only and must never reach the bundle.

import { titlesOverlap } from "./book-facts-shared"

/** Open Library needs two hops (resolve a work, then read it) and is
 *  materially slower than Google. Measured: the /isbn/ endpoint answers with a
 *  redirect in ~24s, far past any sane budget, which is why nothing here uses
 *  it. Clients allow ~20s for a whole route, so two 9s hops fit. */
export const OL_TIMEOUT_MS = 9_000

/** Book facts don't change; a month matches the cover-cache TTL. */
export const OL_REVALIDATE_SECONDS = 2_592_000

// Per-instance memo in front of the framework data cache. On Vercel this is a
// small win; off Vercel — where the data cache may be absent, or reset on every
// deploy — it is what keeps repeat lookups from spending external quota.
// Bounded so a long-lived instance cannot grow without limit.
const MEMO_MAX_ENTRIES = 500
const memo = new Map<string, { value: unknown; expiresAt: number }>()

function memoGet(url: string): { hit: boolean; value?: unknown } {
  const entry = memo.get(url)
  if (!entry) return { hit: false }
  if (Date.now() > entry.expiresAt) {
    memo.delete(url)
    return { hit: false }
  }
  return { hit: true, value: entry.value }
}

function memoSet(url: string, value: unknown): void {
  if (memo.size >= MEMO_MAX_ENTRIES) {
    // Oldest insertion first — Map preserves insertion order.
    const oldest = memo.keys().next().value
    if (oldest !== undefined) memo.delete(oldest)
  }
  memo.set(url, { value, expiresAt: Date.now() + OL_REVALIDATE_SECONDS * 1000 })
}

/**
 * `next.revalidate` opts this fetch into the framework Data Cache, which is a
 * Next.js feature rather than a platform one and therefore survives a move to
 * any Node host. The memo above is the degrade path for a host without it.
 */
export async function cachedJson(
  url: string,
  timeoutMs: number = OL_TIMEOUT_MS,
): Promise<unknown> {
  const cached = memoGet(url)
  if (cached.hit) return cached.value
  try {
    const res = await fetch(url, {
      next: { revalidate: OL_REVALIDATE_SECONDS },
      signal: AbortSignal.timeout(timeoutMs),
    })
    if (!res.ok) return null
    const json = await res.json()
    memoSet(url, json)
    return json
  } catch {
    return null
  }
}

/**
 * The Open Library work key for a book, or null.
 *
 * Search returns companions, study guides and box sets for any popular title,
 * so every candidate is checked against the title we asked for before it is
 * accepted — a loose search without that guard resolves "Dune" to a Dune
 * colouring book.
 */
export async function olResolveWorkKey(
  title: string,
  author: string,
  isbn: string,
): Promise<{ key: string; series?: unknown } | null> {
  const fields = "key,title,author_name,series"
  const base = `https://openlibrary.org/search.json?fields=${fields}&limit=3&`
  // Ordered by measured latency, not by precision. Free-text q= answers in
  // ~3.5s; the fielded title=&author= form took 6-20s for the identical
  // result, and a fielded q=title:(..) AND author:(..) query did not return
  // at all inside 21s. The fielded form stays as a fallback for titles too
  // generic to survive free text.
  const attempts: string[] = []
  if (isbn) attempts.push(base + `q=${encodeURIComponent(isbn)}`)
  if (title && author) {
    attempts.push(base + `q=${encodeURIComponent(`${title} ${author}`)}`)
    attempts.push(
      base + `title=${encodeURIComponent(title)}&author=${encodeURIComponent(author)}`,
    )
  } else if (title) {
    attempts.push(base + `q=${encodeURIComponent(title)}`)
  }
  for (const url of attempts) {
    const data = (await cachedJson(url, OL_TIMEOUT_MS)) as
      | { docs?: { key?: unknown; title?: unknown; series?: unknown }[] }
      | null
    const docs = Array.isArray(data?.docs) ? data!.docs! : []
    const hit = docs.find(
      (d) =>
        typeof d.key === "string" &&
        d.key.startsWith("/works/") &&
        titlesOverlap(title, d.title),
    )
    if (hit) {
      const series = Array.isArray(hit.series) ? hit.series[0] : hit.series
      return { key: hit.key as string, series }
    }
  }
  return null
}
