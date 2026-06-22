import { NextRequest, NextResponse } from "next/server"
import { checkRateLimit, getClientIp } from "@/lib/rate-limit"

const ALLOWED_PATHS = ["/trending/daily.json", "/trending/weekly.json", "/trending/monthly.json"]

export async function GET(request: NextRequest) {
  const ip = getClientIp(request)
  const allowed = await checkRateLimit(ip, { limit: 60, windowMs: 60_000, prefix: "openlibrary" })
  if (!allowed) {
    return NextResponse.json(
      { error: "Too many requests" },
      { status: 429, headers: { "Retry-After": "60" } }
    )
  }

  const path = request.nextUrl.searchParams.get("path")
  const limit = request.nextUrl.searchParams.get("limit") || "24"

  if (!path || !ALLOWED_PATHS.includes(path)) {
    return NextResponse.json({ error: "Invalid path" }, { status: 400 })
  }

  try {
    const safeLimit = Math.min(Math.max(1, parseInt(limit) || 24), 50)
    const url = `https://openlibrary.org${path}?limit=${safeLimit}`

    const response = await fetch(url, {
      headers: { "Accept": "application/json" },
      next: { revalidate: 600 }, // Cache for 10 minutes
    })

    if (!response.ok) {
      return NextResponse.json(
        { error: "Upstream API error" },
        { status: response.status }
      )
    }

    const data = await response.json()
    return NextResponse.json(data, {
      headers: {
        "Cache-Control": "public, s-maxage=600, stale-while-revalidate=1200",
      },
    })
  } catch (err) {
    console.error("[BookSwipe] Open Library proxy error:", err)
    return NextResponse.json({ error: "Failed to fetch from Open Library" }, { status: 502 })
  }
}
