import { NextRequest, NextResponse } from "next/server"

const API_KEY = process.env.GOOGLE_BOOKS_API_KEY || process.env.NEXT_PUBLIC_GOOGLE_BOOKS_API_KEY
const GOOGLE_BOOKS_BASE = "https://www.googleapis.com/books/v1/volumes"

// Inline constants to avoid importing client-tainted config module into server route
const API_RATE_LIMIT = 60
const API_RATE_WINDOW_MS = 60_000

// Rate limiting: simple in-memory counter per IP
const rateLimiter = new Map<string, { count: number; resetAt: number }>()

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

  // Rate limit check
  const ip = request.headers.get("x-forwarded-for")?.split(",")[0]?.trim() || "unknown"
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

    const response = await fetch(url, {
      headers: { "Accept": "application/json" },
      next: { revalidate: 300 }, // Cache for 5 minutes
    })

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
    console.error("[BookSwipe] Books API error:", err)
    return NextResponse.json({ error: "Failed to fetch books" }, { status: 502 })
  }
}
