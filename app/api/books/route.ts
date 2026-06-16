import { NextRequest, NextResponse } from "next/server"

const API_KEY = process.env.GOOGLE_BOOKS_API_KEY
const GOOGLE_BOOKS_BASE = "https://www.googleapis.com/books/v1/volumes"

// Inline constants to avoid importing client-tainted config module into server route
const API_RATE_LIMIT = 60
const API_RATE_WINDOW_MS = 60_000

// Rate limiting: simple in-memory counter per IP.
//
// BEST-EFFORT ONLY — NOT a real rate limiter. Two known limitations:
//  1. State lives in module memory, so it is per-instance. On serverless each
//     cold/warm instance has its own Map, and the limit is not shared across
//     instances or regions. A client hitting different instances can exceed
//     the nominal limit, and the counters vanish on instance recycle.
//  2. The client IP is derived from proxy headers, which are spoofable unless
//     a trusted proxy overwrites them (see getClientIp below).
// For real protection, move this to a shared store (e.g. Upstash Redis /
// @upstash/ratelimit) keyed on a trustworthy IP. This local map only blunts
// accidental hammering from a single warm instance.
const rateLimiter = new Map<string, { count: number; resetAt: number }>()

// Prefer the most trustworthy IP source available. On Vercel, `x-real-ip` is
// set by the platform edge and is harder to spoof than the client-supplied
// `x-forwarded-for`, whose left-most entry is attacker-controlled. We still
// fall back to the first XFF hop, then "unknown", so the limiter degrades
// rather than failing open per-request. NOTE: none of these are fully
// trustworthy without a verified trusted-proxy chain — see the caveat above.
function getClientIp(request: NextRequest): string {
  const realIp = request.headers.get("x-real-ip")?.trim()
  if (realIp) return realIp
  const forwarded = request.headers.get("x-forwarded-for")?.split(",")[0]?.trim()
  if (forwarded) return forwarded
  return "unknown"
}

function checkRateLimit(ip: string): boolean {
  const now = Date.now()
  const entry = rateLimiter.get(ip)

  if (!entry || now > entry.resetAt) {
    rateLimiter.set(ip, { count: 1, resetAt: now + API_RATE_WINDOW_MS })
    return true
  }

  if (entry.count >= API_RATE_LIMIT) return false
  entry.count++
  return true
}

// Lazy cleanup: clear stale entries on each request (no setInterval in serverless)
function cleanupRateLimiter() {
  const now = Date.now()
  rateLimiter.forEach((v, k) => {
    if (now > v.resetAt) rateLimiter.delete(k)
  })
}

export async function GET(request: NextRequest) {
  cleanupRateLimiter()

  // Rate limit check (best-effort, per-instance — see rateLimiter comment)
  const ip = getClientIp(request)
  if (!checkRateLimit(ip)) {
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
