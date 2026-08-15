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
//   Vercel's data cache serves every repeat globally — external quota is
//   spent roughly once per unique book, not once per user.
// - The LLM supplies STABLE literary facts first (description, genres,
//   series, first-published), gated on `known:false` for unrecognized books
//   and writing only original prose. LIVE METRICS (ratings) are API-only.
// - Optional GOOGLE_BOOKS_API_KEY moves GB calls onto project quota instead
//   of the shared egress-IP pool; without it the cache still does the heavy
//   lifting. Same gateway/auth/fail-soft shape as /api/recommend (ADR-0003).

const MODEL = process.env.ENRICH_MODEL || "anthropic/claude-haiku-4.5"
const GENERATION_TIMEOUT_MS = 12_000
const API_TIMEOUT_MS = 6_000
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
async function cachedJson(url: string): Promise<unknown> {
  try {
    const res = await fetch(url, {
      next: { revalidate: FACTS_REVALIDATE_SECONDS },
      signal: AbortSignal.timeout(API_TIMEOUT_MS),
    })
    if (!res.ok) return null
    return await res.json()
  } catch {
    return null
  }
}

async function llmFacts(title: string, author: string): Promise<LlmFacts | null> {
  const hasGatewayAuth = !!(
    process.env.AI_GATEWAY_API_KEY ||
    process.env.VERCEL_OIDC_TOKEN ||
    process.env.VERCEL
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
  const hasGatewayAuth = !!(
    process.env.AI_GATEWAY_API_KEY ||
    process.env.VERCEL_OIDC_TOKEN ||
    process.env.VERCEL
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

async function olFacts(isbn: string, title: string): Promise<OlFacts | null> {
  const edition = (await cachedJson(
    `https://openlibrary.org/isbn/${encodeURIComponent(isbn)}.json`,
  )) as Record<string, unknown> | null
  if (!edition || !titlesOverlap(title, edition.title)) return null

  const out: OlFacts = {}
  const seriesRaw = Array.isArray(edition.series) ? edition.series[0] : undefined
  const series = parseSeries(seriesRaw)
  if (series) out.series = series

  const works = Array.isArray(edition.works) ? edition.works : []
  const workKey =
    works[0] && typeof (works[0] as Record<string, unknown>).key === "string"
      ? ((works[0] as Record<string, unknown>).key as string)
      : null
  if (workKey) {
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

  const [llm, gb, ol] = await Promise.all([
    author ? llmFacts(title, author) : Promise.resolve(null),
    volumeId ? gbFacts(volumeId, title) : Promise.resolve(null),
    isbn ? olFacts(isbn, title) : Promise.resolve(null),
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
