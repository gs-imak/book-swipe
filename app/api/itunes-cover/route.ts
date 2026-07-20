import { NextRequest, NextResponse } from "next/server"
import { itunesResultMatchesBook } from "@/lib/covers"

// Proxy for the iTunes / Apple Books APIs. The browser can't call iTunes
// directly (no CORS header), so we resolve the high-resolution cover server-side
// and cache it hard at the edge — artwork is stable, so a 30-day cache keeps
// actual iTunes calls rare even under load.
//
// Resolution strategy (a wrong cover is worse than no upgrade):
//   1. Exact by-ISBN lookup — edition-exact, but Apple only indexes EBOOK
//      ISBNs, so arbitrary print ISBNs mostly miss.
//   2. Title+author SEARCH fallback, accepted ONLY when the result passes the
//      strict title/author match check (itunesResultMatchesBook).
const ITUNES_LOOKUP = "https://itunes.apple.com/lookup"
const ITUNES_SEARCH = "https://itunes.apple.com/search"

interface ItunesResult {
  artworkUrl100?: string
  trackName?: string
  artistName?: string
}

// Apple artwork URLs end in a size segment like `/100x100bb.jpg`. Swap it for a
// larger box so we get a crisp (~1000px) cover; `bb` preserves aspect ratio.
function hiRes(artworkUrl: string, px = 1000): string {
  return artworkUrl.replace(/\/\d+x\d+bb\./, `/${px}x${px}bb.`)
}

function isValidIsbn(raw: string): boolean {
  return /^[0-9]{10}([0-9]{3})?[0-9xX]?$/.test(raw) && raw.length >= 10 && raw.length <= 13
}

async function fetchItunes(url: string, signal: AbortSignal): Promise<ItunesResult[]> {
  const res = await fetch(url, {
    headers: { Accept: "application/json" },
    signal,
    next: { revalidate: 2592000 }, // 30 days — artwork is stable
  })
  if (!res.ok) return []
  // iTunes responds with text/javascript; parse defensively.
  const data = JSON.parse(await res.text())
  return Array.isArray(data?.results) ? (data.results as ItunesResult[]) : []
}

export async function GET(request: NextRequest) {
  const params = new URL(request.url).searchParams
  const isbn = params.get("isbn")?.trim()
  const title = params.get("title")?.trim().slice(0, 200)
  const author = params.get("author")?.trim().slice(0, 100)

  const hasIsbn = !!isbn && isValidIsbn(isbn)
  const hasQuery = !!title && !!author
  if (!hasIsbn && !hasQuery) {
    return NextResponse.json(
      { error: "Provide a valid isbn or title+author" },
      { status: 400 }
    )
  }

  const controller = new AbortController()
  const timer = setTimeout(() => controller.abort(), 6_000)
  try {
    let artwork: string | undefined

    // 1) Edition-exact ISBN lookup
    if (hasIsbn) {
      const results = await fetchItunes(
        `${ITUNES_LOOKUP}?isbn=${encodeURIComponent(isbn!)}&entity=ebook`,
        controller.signal
      )
      artwork = results[0]?.artworkUrl100
    }

    // 2) Validated title+author search fallback
    if (!artwork && hasQuery) {
      const term = `${title} ${author}`
      const results = await fetchItunes(
        `${ITUNES_SEARCH}?term=${encodeURIComponent(term)}&entity=ebook&limit=5`,
        controller.signal
      )
      const match = results.find(
        (r) => r.artworkUrl100 && itunesResultMatchesBook(r, title!, author!)
      )
      artwork = match?.artworkUrl100
    }

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
    // iTunes rate-limited or errored — tell the client there's no cover so it
    // keeps the (correct, reliable) Google/Open Library cover. Short-cache misses.
    return NextResponse.json({ cover: null }, { headers: { "Cache-Control": "public, s-maxage=600" } })
  } finally {
    clearTimeout(timer)
  }
}
