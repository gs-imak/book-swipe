import { NextRequest, NextResponse } from "next/server"
import { getFallbackBrowseResult, searchFallback } from "@/lib/fallback-books"

// Trailing slash is critical — /books (no slash) returns a slow 301 redirect.
const GUTENDEX_BASE = "https://gutendex.com/books/"

// 6s upstream timeout. CRITICAL: must be shorter than the client's 10s
// AbortController in lib/gutenberg-browser-api.ts so the proxy has time
// to return the fallback dataset before the client gives up. If gutendex
// responds within 6s we cache the live data; otherwise users see the
// baked-in classics within ~6s instead of a "Couldn't load" error.
const UPSTREAM_TIMEOUT_MS = 6_000

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

// Fresh upstream success: cache aggressively at the edge.
const SUCCESS_CACHE = "public, s-maxage=1800, stale-while-revalidate=86400, stale-if-error=604800"

// Fallback (gutendex unreachable): cache briefly so we re-try gutendex soon
// once it recovers, but still absorb traffic spikes during the outage.
const FALLBACK_CACHE = "public, s-maxage=300, stale-while-revalidate=1800"

function fallbackResponse(topic: string, search: string) {
  const data = search ? searchFallback(search) : getFallbackBrowseResult(topic)
  return NextResponse.json(data, {
    headers: {
      "Cache-Control": FALLBACK_CACHE,
      "X-BookSwipe-Fallback": "1",
    },
  })
}

export async function GET(request: NextRequest) {
  const clean = sanitizeParams(request.nextUrl.searchParams)
  const topic = clean.get("topic") ?? ""
  const search = clean.get("search") ?? ""
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
      console.error("[BookSwipe] Gutendex returned non-OK status:", res.status, "— serving fallback")
      return fallbackResponse(topic, search)
    }

    const data = await res.json()

    return NextResponse.json(data, {
      headers: { "Cache-Control": SUCCESS_CACHE },
    })
  } catch (err) {
    const aborted = (err as Error)?.name === "AbortError"
    console.error("[BookSwipe] Gutendex unreachable (", aborted ? "timeout" : err, ") — serving fallback")
    return fallbackResponse(topic, search)
  } finally {
    clearTimeout(timer)
  }
}
