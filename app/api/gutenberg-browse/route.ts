import { NextRequest, NextResponse } from "next/server"

// Trailing slash is critical — /books (no slash) returns a slow 301 redirect.
const GUTENDEX_BASE = "https://gutendex.com/books/"

// 25s upstream timeout. Longer than the client's 10s AbortController so the
// server-side cache can populate even after the client has given up. Short
// enough to fail fast and let clients fall back to stale localStorage.
const UPSTREAM_TIMEOUT_MS = 25_000

// Only these gutendex params are forwarded — SSRF defence + cache-key stability.
const ALLOWED_PARAMS = new Set(["topic", "search", "languages"])
const PARAM_MAX_LENGTH: Record<string, number> = {
  topic: 64,
  search: 200,
  languages: 64,
}

function sanitizeParams(searchParams: URLSearchParams): URLSearchParams {
  const out = new URLSearchParams()
  searchParams.forEach((rawValue, key) => {
    if (!ALLOWED_PARAMS.has(key)) return
    const max = PARAM_MAX_LENGTH[key] ?? 64
    const value = rawValue.slice(0, max).trim()
    if (!value) return
    out.set(key, value)
  })
  return out
}

export async function GET(request: NextRequest) {
  const clean = sanitizeParams(request.nextUrl.searchParams)
  const upstreamUrl = `${GUTENDEX_BASE}?${clean.toString()}`

  const controller = new AbortController()
  const timer = setTimeout(() => controller.abort(), UPSTREAM_TIMEOUT_MS)

  try {
    const res = await fetch(upstreamUrl, {
      signal: controller.signal,
      redirect: "follow",
      headers: { Accept: "application/json" },
      // Next.js Data Cache — deduplicates fetches for 30 min across concurrent
      // requests on the same instance. Matches app/api/openlibrary/route.ts:19.
      next: { revalidate: 1800 },
    })

    if (!res.ok) {
      return NextResponse.json(
        { error: `Gutenberg upstream returned ${res.status}` },
        { status: 502 }
      )
    }

    const data = await res.json()

    return NextResponse.json(data, {
      headers: {
        // Vercel edge cache: fresh 30 min, stale-while-revalidate 1 day,
        // stale-if-error 7 days. The stale-if-error window is what lets us
        // keep serving books during Gutendex outages.
        "Cache-Control":
          "public, s-maxage=1800, stale-while-revalidate=86400, stale-if-error=604800",
      },
    })
  } catch (err) {
    const aborted = (err as Error)?.name === "AbortError"
    console.error("[BookSwipe] Gutenberg browse proxy error:", aborted ? "timeout" : err)
    return NextResponse.json(
      { error: aborted ? "Gutenberg upstream timed out" : "Failed to fetch from Gutenberg" },
      { status: 502 }
    )
  } finally {
    clearTimeout(timer)
  }
}
