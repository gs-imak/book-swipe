"use client"

// Goodreads-parity metadata enrichment (ADR-0005). Two API stages + one
// contained LLM stage:
//   1. Google Books per-VOLUME record — the search endpoint truncates or omits
//      descriptions; the volume endpoint has the full text, ratingsCount and
//      real categories.
//   2. Open Library edition (by ISBN, title-validated — OL's isbn index mixes
//      in foreign editions, same gotcha as the cover pipeline) → work record
//      for description / first-publish year, edition `series` when present.
//   3. /api/enrich (LLM, prose only) — ONLY when the description is still thin
//      after both API stages. Facts (ratings, series, years) never come from
//      the LLM.
// Every stage fails soft: a book is returned unchanged rather than broken.
import { Book } from "./book-data"
import { getLikedBooks, saveLikedBooks } from "./storage"
import { updateBooksInCache } from "./book-cache"

const FETCH_TIMEOUT_MS = 6000
const ENRICH_CONCURRENCY = 2
/** Below this, a description reads as a stub and the LLM hook stage runs. */
const THIN_DESCRIPTION_CHARS = 160
const PLACEHOLDER_DESCRIPTION = "No description available."

// In-flight/session dedupe: enriching the same book twice concurrently (deck
// upgrade + showcase open) must resolve to one pipeline run.
const _inFlight = new Map<string, Promise<Book>>()

function normalize(s: string): string {
  return s
    .toLowerCase()
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .replace(/[^a-z0-9 ]/g, " ")
    .replace(/\s+/g, " ")
    .trim()
}

// Foreign-edition guard: an OL/GB record only counts as OUR book when the
// titles overlap after normalization (either direction — subtitles vary).
function titleMatches(book: Book, candidateTitle: unknown): boolean {
  if (typeof candidateTitle !== "string" || !candidateTitle) return false
  const a = normalize(book.title)
  const b = normalize(candidateTitle)
  if (!a || !b) return false
  return a.includes(b) || b.includes(a)
}

function isThin(description: string | undefined): boolean {
  return (
    !description ||
    description === PLACEHOLDER_DESCRIPTION ||
    description.length < THIN_DESCRIPTION_CHARS
  )
}

async function fetchJson(url: string, init?: RequestInit): Promise<unknown> {
  const controller = new AbortController()
  const timeout = setTimeout(() => controller.abort(), FETCH_TIMEOUT_MS)
  try {
    const res = await fetch(url, { ...init, signal: controller.signal })
    if (!res.ok) return null
    return await res.json()
  } catch {
    return null
  } finally {
    clearTimeout(timeout)
  }
}

function stripHtml(raw: string): string {
  return raw
    .replace(/<[^>]*>/g, "")
    .replace(/&amp;/g, "&")
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/&nbsp;/g, " ")
    .trim()
}

function yearFrom(raw: unknown): number | undefined {
  if (typeof raw !== "string") return undefined
  const m = raw.match(/\d{4}/)
  return m ? Number(m[0]) : undefined
}

// "Mistborn (2)" / "The Stormlight Archive #3" / "Dune ; 1" → {name, index}
function parseSeries(raw: unknown): { name: string; index?: number } | undefined {
  if (typeof raw !== "string" || !raw.trim()) return undefined
  const s = raw.trim()
  const m =
    s.match(/^(.*?)\s*[(#;,]\s*(?:#|book\s*)?(\d+)\s*\)?$/i) || s.match(/^(.*)$/)
  if (!m) return undefined
  const name = m[1].replace(/[\s;,(]+$/, "").trim()
  if (!name) return undefined
  const index = m[2] ? Number(m[2]) : undefined
  return { name, index }
}

// "Fiction / Fantasy / Epic" lists → clean deduped genre chips
function refineGenres(categories: unknown, existing: string[]): string[] {
  if (!Array.isArray(categories)) return existing
  const parts = categories
    .filter((c): c is string => typeof c === "string")
    .flatMap((c) => c.split("/"))
    .map((c) => c.trim())
    .filter((c) => c && c.toLowerCase() !== "general")
  const seen = new Set<string>()
  const out: string[] = []
  for (const p of parts) {
    const key = p.toLowerCase()
    if (!seen.has(key)) {
      seen.add(key)
      out.push(p)
    }
    if (out.length >= 4) break
  }
  return out.length > 0 ? out : existing
}

interface GoogleFacts {
  description?: string
  ratingsCount?: number
  averageRating?: number
  categories?: unknown
  publishedYear?: number
}

// Stage 1 — the full volume record (search results truncate descriptions).
async function fetchGoogleFacts(book: Book): Promise<GoogleFacts | null> {
  if (book.metadata?.source !== "google") return null
  const fields =
    "volumeInfo(title,description,averageRating,ratingsCount,categories,publishedDate)"
  const data = (await fetchJson(
    `https://www.googleapis.com/books/v1/volumes/${encodeURIComponent(book.id)}?fields=${encodeURIComponent(fields)}`,
  )) as { volumeInfo?: Record<string, unknown> } | null
  const info = data?.volumeInfo
  if (!info || !titleMatches(book, info.title)) return null
  return {
    description:
      typeof info.description === "string" ? stripHtml(info.description) : undefined,
    ratingsCount:
      typeof info.ratingsCount === "number" ? info.ratingsCount : undefined,
    averageRating:
      typeof info.averageRating === "number" ? info.averageRating : undefined,
    categories: info.categories,
    publishedYear: yearFrom(info.publishedDate),
  }
}

interface OpenLibraryFacts {
  description?: string
  firstPublished?: number
  series?: { name: string; index?: number }
  subjects?: string[]
}

// Stage 2 — ISBN → edition (title-validated) → work record.
async function fetchOpenLibraryFacts(book: Book): Promise<OpenLibraryFacts | null> {
  if (!book.isbn) return null
  const edition = (await fetchJson(
    `https://openlibrary.org/isbn/${encodeURIComponent(book.isbn)}.json`,
  )) as Record<string, unknown> | null
  if (!edition || !titleMatches(book, edition.title)) return null

  const out: OpenLibraryFacts = {}
  const seriesRaw = Array.isArray(edition.series) ? edition.series[0] : undefined
  const series = parseSeries(seriesRaw)
  if (series) out.series = series

  const works = Array.isArray(edition.works) ? edition.works : []
  const workKey =
    works[0] && typeof (works[0] as Record<string, unknown>).key === "string"
      ? ((works[0] as Record<string, unknown>).key as string)
      : null
  if (workKey) {
    const work = (await fetchJson(`https://openlibrary.org${workKey}.json`)) as
      | Record<string, unknown>
      | null
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
  }
  return out
}

// Stage 3 — original editorial hook, only for still-thin descriptions. The
// route returns known=false for books the model doesn't specifically
// recognize, so nothing is ever invented for obscure titles.
async function fetchLlmHook(book: Book, subjects: string[]): Promise<string | null> {
  const data = (await fetchJson("/api/enrich", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      title: book.title,
      author: book.author,
      genre: book.genre,
      subjects,
      existingDescription: book.description.slice(0, 400),
    }),
  })) as { known?: boolean; hook?: string } | null
  if (!data?.known || typeof data.hook !== "string") return null
  const hook = data.hook.trim()
  return hook.length >= 80 ? hook : null
}

/**
 * Enrich one book (idempotent — `metadata.enriched` marks completion). Always
 * resolves; on total API failure the input book is returned unchanged.
 */
export function enrichBook(book: Book): Promise<Book> {
  if (book.metadata?.enriched) return Promise.resolve(book)
  const existing = _inFlight.get(book.id)
  if (existing) return existing

  const run = (async (): Promise<Book> => {
    const [gbResult, olResult] = await Promise.allSettled([
      fetchGoogleFacts(book),
      fetchOpenLibraryFacts(book),
    ])
    const gb = gbResult.status === "fulfilled" ? gbResult.value : null
    const ol = olResult.status === "fulfilled" ? olResult.value : null

    // Longest real description wins; publisher copy beats the LLM stage.
    const candidates: Array<{ text: string; source: "google" | "openlibrary" }> = []
    if (gb?.description) candidates.push({ text: gb.description, source: "google" })
    if (ol?.description) candidates.push({ text: ol.description, source: "openlibrary" })
    candidates.sort((a, b) => b.text.length - a.text.length)

    let description = book.description
    let descriptionSource: NonNullable<
      NonNullable<Book["metadata"]>["enriched"]
    >["descriptionSource"] = "original"
    const best = candidates[0]
    if (best && (isThin(description) || best.text.length > description.length)) {
      description = best.text
      descriptionSource = best.source
    }

    const subjects = ol?.subjects ?? book.metadata?.subjects ?? []
    if (isThin(description)) {
      const hook = await fetchLlmHook(book, subjects)
      if (hook) {
        description = hook
        descriptionSource = "llm"
      }
    }

    // Real Google rating replaces the deterministic placeholder — but only
    // with enough votes to mean something (mirrors the ratingEstimated flag's
    // honesty contract in book-data.ts).
    let rating = book.rating
    let ratingEstimated = book.metadata?.ratingEstimated
    if (
      gb?.averageRating &&
      gb.ratingsCount !== undefined &&
      gb.ratingsCount >= 20
    ) {
      rating = Math.round(gb.averageRating * 10) / 10
      ratingEstimated = false
    }

    // Nothing landed (offline / both APIs down): return the book UNMARKED so a
    // later session retries, instead of freezing the thin state forever.
    if (!gb && !ol && descriptionSource !== "llm") return book

    const enriched: NonNullable<NonNullable<Book["metadata"]>["enriched"]> = {
      at: new Date().toISOString(),
      descriptionSource,
    }
    if (ol?.series) enriched.series = ol.series
    if (ol?.firstPublished) enriched.firstPublished = ol.firstPublished

    return {
      ...book,
      description,
      rating,
      genre: refineGenres(gb?.categories, book.genre),
      metadata: {
        ...book.metadata,
        source: book.metadata?.source ?? "sample",
        ratingsCount: gb?.ratingsCount ?? book.metadata?.ratingsCount,
        subjects: subjects.length > 0 ? subjects : book.metadata?.subjects,
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
