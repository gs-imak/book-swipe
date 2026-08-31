import { NextRequest, NextResponse } from "next/server"
import { checkRateLimit, getClientIp } from "@/lib/rate-limit"
import { cachedJson, olResolveWorkKey } from "@/lib/openlibrary-server"
import { MIN_RATINGS_FOR_DISPLAY } from "@/lib/book-truth"
import type { RatingBreakdown } from "@/lib/rating-breakdown-shared"

// The 1-5 star distribution behind a book's average.
//
// Written because readers asked to "click the rating and read the reviews".
// Review PROSE is not available from any source this app can reach: the Google
// Books v1 API exposes no review field, Open Library stores none, and the
// Goodreads API was withdrawn in 2020. The distribution is, and it answers the
// question people are really asking — a 4.0 built from a wall of fives with a
// hostile minority is a different book from a 4.0 everybody found fine.
//
// On demand only. Nothing here runs during enrichment, so a reader who never
// opens the breakdown never pays for it.

export async function GET(request: NextRequest) {
  const ip = getClientIp(request)
  if (!(await checkRateLimit(ip, { limit: 60, windowMs: 60_000, prefix: "book-ratings" }))) {
    return NextResponse.json(
      { error: "Too many requests" },
      { status: 429, headers: { "Retry-After": "60" } },
    )
  }

  const params = request.nextUrl.searchParams
  const title = (params.get("title") ?? "").slice(0, 150)
  const author = (params.get("author") ?? "").slice(0, 100)
  const isbn = (params.get("isbn") ?? "").replace(/[^0-9Xx]/g, "").slice(0, 13)

  const empty: RatingBreakdown = { found: false, source: "openlibrary" }
  if (!title) return NextResponse.json(empty)

  const resolved = await olResolveWorkKey(title, author, isbn)
  if (!resolved) return NextResponse.json(empty)

  const data = (await cachedJson(`https://openlibrary.org${resolved.key}/ratings.json`)) as
    | { summary?: { average?: unknown; count?: unknown }; counts?: Record<string, unknown> }
    | null
  if (!data) return NextResponse.json(empty)

  const raw = data.counts ?? {}
  const counts: RatingBreakdown["counts"] = {
    1: numberOr0(raw["1"]),
    2: numberOr0(raw["2"]),
    3: numberOr0(raw["3"]),
    4: numberOr0(raw["4"]),
    5: numberOr0(raw["5"]),
  }
  const total = counts[1] + counts[2] + counts[3] + counts[4] + counts[5]

  // The same confidence floor the star itself is held to (lib/book-truth): a
  // distribution over a handful of ratings is noise drawn as a chart, which
  // reads far more authoritative than the number it came from.
  if (total < MIN_RATINGS_FOR_DISPLAY) return NextResponse.json(empty)

  const average = typeof data.summary?.average === "number" ? data.summary.average : undefined

  return NextResponse.json({
    found: true,
    source: "openlibrary",
    workKey: resolved.key,
    count: total,
    average,
    counts,
  } satisfies RatingBreakdown)
}

function numberOr0(raw: unknown): number {
  return typeof raw === "number" && Number.isFinite(raw) && raw > 0 ? Math.round(raw) : 0
}
