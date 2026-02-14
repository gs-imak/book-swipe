import { NextRequest, NextResponse } from "next/server"

const API_KEY = process.env.GOOGLE_BOOKS_API_KEY
const GOOGLE_BOOKS_BASE = "https://www.googleapis.com/books/v1/volumes"

// Rate limiting: simple in-memory counter per IP
const rateLimiter = new Map<string, { count: number; resetAt: number }>()
const RATE_LIMIT = 60 // requests per window
const RATE_WINDOW = 60_000 // 1 minute

function checkRateLimit(ip: string): boolean {
  const now = Date.now()
  const entry = rateLimiter.get(ip)

  if (!entry || now > entry.resetAt) {
    rateLimiter.set(ip, { count: 1, resetAt: now + RATE_WINDOW })
    return true
  }

  if (entry.count >= RATE_LIMIT) return false
  entry.count++
  return true
}

// Periodic cleanup of stale entries
setInterval(() => {
  const now = Date.now()
  rateLimiter.forEach((v, k) => {
    if (now > v.resetAt) rateLimiter.delete(k)
  })
}, RATE_WINDOW * 2)

export async function GET(request: NextRequest) {
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

  if (!API_KEY) {
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

      url = `${GOOGLE_BOOKS_BASE}?q=${encodeURIComponent(sanitizedQuery)}&maxResults=${safeMaxResults}&printType=books&orderBy=relevance&langRestrict=en&projection=full&key=${API_KEY}`
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
  } catch {
    return NextResponse.json({ error: "Failed to fetch books" }, { status: 502 })
  }
}
