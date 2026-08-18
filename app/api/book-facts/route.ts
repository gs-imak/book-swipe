import { NextRequest, NextResponse } from "next/server"
import { generateObject } from "ai"
import { z } from "zod"
import { checkRateLimit, getClientIp } from "@/lib/rate-limit"
import {
  mergeBookFacts,
  parseSeries,
  titlesOverlap,
  yearFrom,
  type GbFacts,
  type LlmFacts,
  type OlFacts,
} from "@/lib/book-facts-shared"
import {
  cleanDescription,
  isPublishable,
  trimToSentenceBand,
  DESC_IDEAL_CHARS,
  DESC_MAX_CHARS,
  DESC_MIN_CHARS,
} from "@/lib/description-clean"

// Quota-proof book facts (ADR-0006). One server round-trip per book, ever:
// - Google Books / Open Library fetches carry `next.revalidate` (30 days) so
//   the framework data cache serves every repeat globally — external quota is
//   spent roughly once per unique book, not once per user. That cache is a
//   Next.js feature, not a Vercel one, so it survives a move to any Node host;
//   `memo` below adds a per-instance layer so the quota story still holds even
//   on a platform where the data cache is unavailable or disabled.
// - The LLM supplies STABLE literary facts first (description, genres,
//   series, first-published), gated on `known:false` for unrecognized books
//   and writing only original prose. LIVE METRICS (ratings) are API-only.
// - Optional GOOGLE_BOOKS_API_KEY moves GB calls onto project quota instead
//   of the shared egress-IP pool; without it the cache still does the heavy
//   lifting. Same gateway/auth/fail-soft shape as /api/recommend (ADR-0003).

const MODEL = process.env.ENRICH_MODEL || "anthropic/claude-haiku-4.5"
const GENERATION_TIMEOUT_MS = 12_000
const API_TIMEOUT_MS = 6_000
// Open Library is materially slower than Google and needs two hops (resolve a
// work, then read it). Measured: the /isbn/ endpoint answers a redirect in
// ~24s, far past any sane budget — which is why we resolve via search.json
// instead. The client allows 20s for the whole route, so two 7s hops fit.
const OL_TIMEOUT_MS = 9_000
// Book facts don't change; a month matches the cover-cache TTL.
const FACTS_REVALIDATE_SECONDS = 2_592_000

const llmSchema = z.object({
  known: z
    .boolean()
    .describe("true ONLY if you specifically recognize this exact book"),
  genres: z
    .array(z.string())
    .max(4)
    .describe("2-4 conventional genre labels, e.g. Fantasy, Literary Fiction"),
  seriesName: z
    .string()
    .describe("series name if the book belongs to one, else empty"),
  seriesIndex: z
    .number()
    .describe("position in the series, 0 when unknown or standalone"),
  firstPublished: z
    .number()
    .describe("year of first publication, 0 when unsure"),
})

// `next.revalidate` opts this fetch into the Data Cache (docs: fetch API
// reference). The timeout signal only matters while a real network request
// is in flight — cache hits return before it can fire. If a future Next
// version treated a custom signal as a cache opt-out, behavior degrades to
// uncached fetches (the pre-ADR-0006 status quo), never to an error.
// Per-instance memo in front of the framework data cache. On Vercel this is a
// small win; off Vercel — where the data cache may be absent, or reset on every
// deploy — it is what keeps repeat lookups from spending external quota. Bounded
// so a long-lived instance cannot grow without limit.
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
  memo.set(url, { value, expiresAt: Date.now() + FACTS_REVALIDATE_SECONDS * 1000 })
}

async function cachedJson(url: string, timeoutMs: number = API_TIMEOUT_MS): Promise<unknown> {
  const cached = memoGet(url)
  if (cached.hit) return cached.value
  try {
    const res = await fetch(url, {
      next: { revalidate: FACTS_REVALIDATE_SECONDS },
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

async function llmFacts(title: string, author: string): Promise<LlmFacts | null> {
  // Test for a real credential, never for the host. `process.env.VERCEL` is
  // always "1" on Vercel, so including it made this guard always true there
  // (every enrichment attempted a generation that could not authenticate) and
  // always false anywhere else — exactly backwards on both sides of a move.
  const hasGatewayAuth = !!(
    process.env.AI_GATEWAY_API_KEY || process.env.VERCEL_OIDC_TOKEN
  )
  if (!hasGatewayAuth) return null
  const prompt = `You are a sharp literary editor for a book-discovery app.

Book: "${title}" by ${author}

If you specifically recognize THIS exact book by this author, return known=true with:
- genres: 2-4 conventional genre labels.
- seriesName/seriesIndex: only if you are certain it belongs to a series (else "" and 0).
- firstPublished: the year it was first published (0 if unsure).

If you do not specifically recognize it: known=false, empty/zero everything. Never guess or invent.`
  try {
    const { object } = await generateObject({
      model: MODEL,
      schema: llmSchema,
      prompt,
      abortSignal: AbortSignal.timeout(GENERATION_TIMEOUT_MS),
    })
    if (!object.known) return { known: false }
    return {
      known: true,
      genres: object.genres.filter((g) => g.trim().length > 0).slice(0, 4),
      series: object.seriesName.trim()
        ? {
            name: object.seriesName.trim().slice(0, 80),
            index: object.seriesIndex > 0 ? object.seriesIndex : undefined,
          }
        : undefined,
      firstPublished:
        object.firstPublished > 1000 && object.firstPublished <= new Date().getFullYear()
          ? object.firstPublished
          : undefined,
    }
  } catch (err) {
    console.error(
      "[BookSwipe] book-facts LLM stage failed:",
      err instanceof Error ? err.message : String(err),
    )
    return null
  }
}

const copyDeskSchema = z.object({
  status: z.enum(["ok", "cannot"]),
  description: z
    .string()
    .describe("House-style description, empty when status is cannot"),
})

/**
 * The copy desk (ADR-0007). Runs only when no cleaned source candidate met the
 * quality bar — i.e. the cases the old pipeline shipped as raw wiki text,
 * edition marketing, or a review quote. Writes ORIGINAL copy in one consistent
 * shape and length so every card carries the same weight, and declines rather
 * than inventing a plot for a book it does not know.
 */
async function copyDesk(
  title: string,
  author: string,
  sourceMaterial: string,
): Promise<string | null> {
  // Test for a real credential, never for the host. `process.env.VERCEL` is
  // always "1" on Vercel, so including it made this guard always true there
  // (every enrichment attempted a generation that could not authenticate) and
  // always false anywhere else — exactly backwards on both sides of a move.
  const hasGatewayAuth = !!(
    process.env.AI_GATEWAY_API_KEY || process.env.VERCEL_OIDC_TOKEN
  )
  if (!hasGatewayAuth) return null

  const prompt = `You write book descriptions for a discovery app, in one consistent house style.

Book: "${title}" by ${author}
${sourceMaterial ? `\nSOURCE MATERIAL (may be messy, may be marketing, may be an encyclopedia entry — use only as reference for facts):\n<<<\n${sourceMaterial}\n>>>` : "\nNo usable source material was found."}

Write a description of this book that follows ALL of these rules:
- Between ${DESC_MIN_CHARS} and ${DESC_MAX_CHARS} characters. Aim for ${DESC_IDEAL_CHARS}. This is a hard constraint.
- Two to three sentences. Open on premise and character. Then the central tension or question. Stop.
- Your OWN words entirely. Never reproduce or closely paraphrase the source material, publisher marketing, or text from the book.
- No spoilers past the setup. No review quotes, awards, bestseller claims, comparisons to other books, edition or format notes, or publication history.
- Do not open with "<Title> is a novel by..." — that is an encyclopedia entry, not a description.
- Plain prose. No markdown, no HTML, no links, no lists.

If you do not actually know this specific book, or the source material is about a different work, return status "cannot" with an empty description. Never guess a plot.`

  try {
    const { object } = await generateObject({
      model: MODEL,
      schema: copyDeskSchema,
      prompt,
      abortSignal: AbortSignal.timeout(GENERATION_TIMEOUT_MS),
    })
    if (object.status !== "ok") return null
    // The model's own length control is unreliable; the cleaner and the band
    // are the authority, and the final gate is isPublishable.
    const { text } = cleanDescription(object.description, { source: "llm" })
    const trimmed = trimToSentenceBand(text).text
    return isPublishable(trimmed) ? trimmed : null
  } catch (err) {
    console.error(
      "[BookSwipe] copy desk failed:",
      err instanceof Error ? err.message : String(err),
    )
    return null
  }
}

async function gbFacts(volumeId: string, title: string): Promise<GbFacts | null> {
  const fields =
    "volumeInfo(title,description,averageRating,ratingsCount,categories,publishedDate)"
  const key = process.env.GOOGLE_BOOKS_API_KEY
  const url =
    `https://www.googleapis.com/books/v1/volumes/${encodeURIComponent(volumeId)}` +
    `?fields=${encodeURIComponent(fields)}${key ? `&key=${key}` : ""}`
  const data = (await cachedJson(url)) as { volumeInfo?: Record<string, unknown> } | null
  const info = data?.volumeInfo
  if (!info || !titlesOverlap(title, info.title)) return null
  return {
    // Raw hand-off: lib/description-clean owns all cleaning now, so there is
    // exactly one cleaner and one place for its rules to change.
    description: typeof info.description === "string" ? info.description : undefined,
    ratingsCount: typeof info.ratingsCount === "number" ? info.ratingsCount : undefined,
    averageRating:
      typeof info.averageRating === "number" ? info.averageRating : undefined,
    categories: Array.isArray(info.categories)
      ? info.categories.filter((c): c is string => typeof c === "string")
      : undefined,
    publishedYear: yearFrom(info.publishedDate),
  }
}

/**
 * Google Books for a book we hold no volume id for — which is every book that
 * reached us from Open Library. Without this, that entire population could
 * never be enriched from Google at all.
 */
async function gbFactsBySearch(title: string, author: string): Promise<GbFacts | null> {
  if (!title || !author) return null
  const key = process.env.GOOGLE_BOOKS_API_KEY
  const q = `intitle:"${title}" inauthor:"${author}"`
  const url =
    `https://www.googleapis.com/books/v1/volumes?q=${encodeURIComponent(q)}` +
    `&maxResults=3&printType=books${key ? `&key=${key}` : ""}`
  const data = (await cachedJson(url)) as
    | { items?: { volumeInfo?: Record<string, unknown> }[] }
    | null
  const items = Array.isArray(data?.items) ? data!.items! : []
  // Title overlap is the same guard the volume-id path uses: a search can
  // return companions, study guides and box sets alongside the real book.
  const match = items.find((it) => it.volumeInfo && titlesOverlap(title, it.volumeInfo.title))
  const info = match?.volumeInfo
  if (!info) return null
  return {
    description: typeof info.description === "string" ? info.description : undefined,
    ratingsCount: typeof info.ratingsCount === "number" ? info.ratingsCount : undefined,
    averageRating:
      typeof info.averageRating === "number" ? info.averageRating : undefined,
    categories: Array.isArray(info.categories)
      ? info.categories.filter((c): c is string => typeof c === "string")
      : undefined,
    publishedYear: yearFrom(info.publishedDate),
  }
}

/**
 * The Open Library work key for a book, or null.
 *
 * Deliberately via search.json rather than /isbn/{isbn}.json: the ISBN
 * endpoint answers with a redirect that measured ~24s, blowing any budget the
 * client is willing to wait for, and the edition record it eventually returns
 * carries no description anyway — the text lives on the work. search.json
 * answers in a few seconds and hands back the work key directly, so this is
 * both faster and one hop shorter.
 */
async function olResolveWorkKey(
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
      (d) => typeof d.key === "string" && d.key.startsWith("/works/") && titlesOverlap(title, d.title),
    )
    if (hit) {
      const series = Array.isArray(hit.series) ? hit.series[0] : hit.series
      return { key: hit.key as string, series }
    }
  }
  return null
}

async function olFacts(
  title: string,
  author: string,
  isbn: string,
): Promise<OlFacts | null> {
  const resolved = await olResolveWorkKey(title, author, isbn)
  if (!resolved) return null
  return olFactsByWork(resolved.key, resolved.series)
}

async function olFactsByWork(workKey: string, seriesRaw?: unknown): Promise<OlFacts | null> {
  const out: OlFacts = {}
  // Series now rides along from the search result rather than costing an extra
  // edition fetch — search.json exposes it directly.
  const series = parseSeries(seriesRaw)
  if (series) out.series = series

  {
    const [work, ratings] = await Promise.all([
      cachedJson(`https://openlibrary.org${workKey}.json`) as Promise<Record<
        string,
        unknown
      > | null>,
      cachedJson(`https://openlibrary.org${workKey}/ratings.json`) as Promise<Record<
        string,
        unknown
      > | null>,
    ])
    if (work) {
      const desc = work.description
      if (typeof desc === "string") out.description = desc.trim()
      else if (
        desc &&
        typeof desc === "object" &&
        typeof (desc as Record<string, unknown>).value === "string"
      )
        out.description = ((desc as Record<string, unknown>).value as string).trim()
      out.firstPublished = yearFrom(work.first_publish_date)
      if (Array.isArray(work.subjects))
        out.subjects = work.subjects
          .filter((s): s is string => typeof s === "string")
          .slice(0, 8)
    }
    const summary =
      ratings && typeof ratings.summary === "object" && ratings.summary
        ? (ratings.summary as Record<string, unknown>)
        : null
    if (summary && typeof summary.count === "number" && summary.count > 0) {
      out.ratingsCount = summary.count
      if (typeof summary.average === "number")
        out.averageRating = Math.round(summary.average * 10) / 10
    }
  }
  return out
}

export async function GET(request: NextRequest) {
  const ip = getClientIp(request)
  if (!(await checkRateLimit(ip, { limit: 60, windowMs: 60_000, prefix: "book-facts" }))) {
    return NextResponse.json(
      { error: "Too many requests" },
      { status: 429, headers: { "Retry-After": "60" } },
    )
  }

  const params = request.nextUrl.searchParams
  const title = (params.get("title") ?? "").slice(0, 150)
  const author = (params.get("author") ?? "").slice(0, 100)
  const volumeId = (params.get("gbId") ?? "").slice(0, 60)
  const isbn = (params.get("isbn") ?? "").replace(/[^0-9Xx]/g, "").slice(0, 13)
  if (!title) return NextResponse.json({ found: false })

  // Neither source is gated on holding an id any more: a book that reached us
  // from Open Library has no Google volume id, and one that reached us from
  // Google search often has no ISBN. Both now fall back to title+author, which
  // is the only identifier every book in the deck actually has.
  const [llm, gb, ol] = await Promise.all([
    author ? llmFacts(title, author) : Promise.resolve(null),
    volumeId ? gbFacts(volumeId, title) : gbFactsBySearch(title, author),
    olFacts(title, author, isbn),
  ])

  const facts = mergeBookFacts(llm, gb, ol)

  // No source candidate cleared the quality bar — hand what survived to the
  // copy desk. `rewriteSourceMaterial` is consumed here and never returned.
  const { rewriteSourceMaterial, ...payload } = facts
  if (!payload.description && author && rewriteSourceMaterial !== undefined) {
    const written = await copyDesk(title, author, rewriteSourceMaterial)
    if (written) {
      payload.description = written
      payload.descriptionSource = "llm"
      payload.found = true
    }
  }

  return NextResponse.json(payload)
}
