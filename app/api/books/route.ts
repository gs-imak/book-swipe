import { NextRequest, NextResponse } from "next/server"
import { checkRateLimit, getClientIp } from "@/lib/rate-limit"

const API_KEY = process.env.GOOGLE_BOOKS_API_KEY
const GOOGLE_BOOKS_BASE = "https://www.googleapis.com/books/v1/volumes"

// 60 requests / minute / IP. Backed by Upstash (shared across instances) when
// configured, else a per-instance in-memory fallback — see lib/rate-limit.ts.
const API_RATE_LIMIT = 60
const API_RATE_WINDOW_MS = 60_000

export async function GET(request: NextRequest) {
  const ip = getClientIp(request)
  const allowed = await checkRateLimit(ip, {
    limit: API_RATE_LIMIT,
    windowMs: API_RATE_WINDOW_MS,
    prefix: "books",
  })
  if (!allowed) {
    return NextResponse.json(
      { error: "Too many requests" },
      { status: 429, headers: { "Retry-After": "60" } }
    )
  }

  const { searchParams } = new URL(request.url)
  const q = searchParams.get("q")
  const id = searchParams.get("id") // For single volume fetch (price-tracker)
  const maxResults = searchParams.get("maxResults") || "20"
  const lang = searchParams.get("lang") || "en"

  if (!API_KEY) {
    console.error("[BookSwipe] GOOGLE_BOOKS_API_KEY is not set")
    return NextResponse.json({ error: "API key not configured" }, { status: 500 })
  }

  try {
    let url: string

    if (id) {
      // Single volume lookup (used by price tracker)
      url = `${GOOGLE_BOOKS_BASE}/${encodeURIComponent(id)}?key=${API_KEY}`
    } else if (q) {
      // Search query — validate and sanitize
      const sanitizedQuery = q.slice(0, 500) // Cap query length
      const safeMaxResults = Math.min(Math.max(1, parseInt(maxResults) || 20), 40)

      const langParam = lang !== "all" ? `&langRestrict=${encodeURIComponent(lang)}` : ""
      url = `${GOOGLE_BOOKS_BASE}?q=${encodeURIComponent(sanitizedQuery)}&maxResults=${safeMaxResults}&printType=books&orderBy=relevance${langParam}&projection=full&key=${API_KEY}`
    } else {
      return NextResponse.json({ error: "Missing query parameter" }, { status: 400 })
    }

    // Abort the upstream Google Books request if it hangs, instead of letting
    // it run up to the platform function timeout.
    const controller = new AbortController()
    const timer = setTimeout(() => controller.abort(), 6_000)
    let response: Response
    try {
      response = await fetch(url, {
        headers: { "Accept": "application/json" },
        signal: controller.signal,
        next: { revalidate: 300 }, // Cache for 5 minutes
      })
    } finally {
      clearTimeout(timer)
    }

    if (!response.ok) {
      return NextResponse.json(
        { error: "Upstream API error" },
        { status: response.status }
      )
    }

    const data = await response.json()

    // Strip any fields we don't need to reduce payload size
    return NextResponse.json(data, {
      headers: {
        "Cache-Control": "public, s-maxage=300, stale-while-revalidate=600",
      },
    })
  } catch (err) {
    // An aborted fetch throws an AbortError — surface it as a gateway timeout.
    if (err instanceof Error && err.name === "AbortError") {
      console.error("[BookSwipe] Books API upstream timeout")
      return NextResponse.json({ error: "Upstream API timeout" }, { status: 504 })
    }
    console.error("[BookSwipe] Books API error:", err)
    return NextResponse.json({ error: "Failed to fetch books" }, { status: 502 })
  }
}
