import { NextRequest, NextResponse } from "next/server"
import { itunesResultMatchesBook } from "@/lib/covers"

// Proxy for the iTunes / Apple Books APIs. The browser can't call iTunes
// directly (no CORS header), so we resolve the high-resolution cover server-side
// and cache it hard at the edge — artwork is stable, so a 30-day cache keeps
// actual iTunes calls rare even under load.
//
// Resolution strategy (a wrong cover is worse than no upgrade):
//   1. By-ISBN lookup — Apple only indexes EBOOK ISBNs, so arbitrary print
//      ISBNs mostly miss.
//   2. Title+author SEARCH fallback.
//
// EVERY result from either tier must pass the strict title/author match check
// (itunesResultMatchesBook) before it can become a cover. The ISBN tier used to
// be trusted as "edition-exact" and took results[0] unvalidated — it is not.
// Apple's isbn index resolves loosely: probed live on 2026-09-02, four of the
// six Project Hail Mary ISBNs Apple resolves at all returned a different book
// (0593135210 / 0593135202 / 9780593135204 -> "That Summer" by Jennifer Weiner,
// 9786064310996 -> "Turnul nebunilor" by Andrzej Sapkowski), which is how the
// discovery deck came to show a stranger's cover on a Project Hail Mary card.
// Neighbouring ISBNs in one publisher block resolve to each other, so the
// wrong book is usually a plausible-looking one from the same catalog.
//
// Because the ISBN alone cannot name the book it belongs to, title+author are
// REQUIRED: they are the only thing a result can be validated against.
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
  if (!title || !author) {
    // Refuse visibly rather than returning a cover nothing could validate.
    return NextResponse.json(
      { error: "Provide title and author (an isbn alone cannot be validated)" },
      { status: 400 }
    )
  }

  const controller = new AbortController()
  const timer = setTimeout(() => controller.abort(), 6_000)
  try {
    let artwork: string | undefined

    // The one gate both tiers pass through: never return artwork we cannot
    // tie back to the book that was asked for.
    const firstMatch = (results: ItunesResult[]): string | undefined =>
      results.find((r) => r.artworkUrl100 && itunesResultMatchesBook(r, title, author))
        ?.artworkUrl100

    // 1) By-ISBN lookup — validated, and across ALL results rather than just
    //    the first, since a loose isbn match can rank a stranger above the book.
    if (hasIsbn) {
      artwork = firstMatch(
        await fetchItunes(
          `${ITUNES_LOOKUP}?isbn=${encodeURIComponent(isbn!)}&entity=ebook`,
          controller.signal
        )
      )
    }

    // 2) Validated title+author search fallback. Also catches the case where
    //    tier 1 resolved to the wrong book and was rejected above.
    if (!artwork) {
      const term = `${title} ${author}`
      artwork = firstMatch(
        await fetchItunes(
          `${ITUNES_SEARCH}?term=${encodeURIComponent(term)}&entity=ebook&limit=5`,
          controller.signal
        )
      )
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
