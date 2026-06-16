import { NextRequest, NextResponse } from "next/server"

// Proxy for the iTunes / Apple Books lookup API. The browser can't call iTunes
// directly (no CORS header), so we resolve the high-resolution cover server-side
// and cache it hard at the edge — each ISBN's artwork is stable, so a 30-day
// cache keeps actual iTunes calls rare even under load.
const ITUNES_LOOKUP = "https://itunes.apple.com/lookup"

// Apple artwork URLs end in a size segment like `/100x100bb.jpg`. Swap it for a
// larger box so we get a crisp (~1000px) cover; `bb` preserves aspect ratio.
function hiRes(artworkUrl: string, px = 1000): string {
  return artworkUrl.replace(/\/\d+x\d+bb\./, `/${px}x${px}bb.`)
}

function isValidIsbn(raw: string): boolean {
  return /^[0-9]{10}([0-9]{3})?[0-9xX]?$/.test(raw) && raw.length >= 10 && raw.length <= 13
}

export async function GET(request: NextRequest) {
  const isbn = new URL(request.url).searchParams.get("isbn")?.trim()
  if (!isbn || !isValidIsbn(isbn)) {
    return NextResponse.json({ error: "Missing or invalid isbn" }, { status: 400 })
  }

  const controller = new AbortController()
  const timer = setTimeout(() => controller.abort(), 6_000)
  try {
    const res = await fetch(`${ITUNES_LOOKUP}?isbn=${encodeURIComponent(isbn)}&entity=ebook`, {
      headers: { Accept: "application/json" },
      signal: controller.signal,
      next: { revalidate: 2592000 }, // 30 days — artwork is stable
    })
    if (!res.ok) {
      // iTunes rate-limited or errored — tell the client there's no cover so it
      // keeps the (correct, reliable) Google/Open Library cover. Don't cache misses long.
      return NextResponse.json({ cover: null }, { headers: { "Cache-Control": "public, s-maxage=3600" } })
    }
    // iTunes responds with text/javascript; parse defensively.
    const data = JSON.parse(await res.text())
    const artwork: string | undefined = data?.results?.[0]?.artworkUrl100
    const cover = artwork ? hiRes(artwork) : null
    return NextResponse.json(
      { cover },
      {
        headers: {
          "Cache-Control": cover
            ? "public, s-maxage=2592000, stale-while-revalidate=86400"
            : "public, s-maxage=3600",
        },
      }
    )
  } catch {
    return NextResponse.json({ cover: null }, { headers: { "Cache-Control": "public, s-maxage=600" } })
  } finally {
    clearTimeout(timer)
  }
}
