import { describe, it, expect, beforeEach, afterEach, vi } from "vitest"
import { NextRequest } from "next/server"
import { GET } from "@/app/api/itunes-cover/route"

/**
 * Regression cover for the wrong-cover defect: Apple's `lookup?isbn=` is NOT
 * edition-exact. Probed live on 2026-09-02, four of the six Project Hail Mary
 * ISBNs Apple resolves at all came back as a different book entirely, and the
 * route accepted `results[0]` unvalidated:
 *
 *   0593135210    -> That Summer :: Jennifer Weiner
 *   0593135202    -> That Summer :: Jennifer Weiner
 *   9780593135204 -> That Summer :: Jennifer Weiner
 *   9786064310996 -> Turnul nebunilor :: Andrzej Sapkowski
 *   9780593135211 -> Project Hail Mary :: Andy Weir   (correct)
 *   9789401614085 -> Project Hail Mary :: Andy Weir   (correct)
 *
 * The payloads below are the real responses, copied verbatim.
 */

const PHM = {
  trackName: "Project Hail Mary",
  artistName: "Andy Weir",
  artworkUrl100:
    "https://is1-ssl.mzstatic.com/image/thumb/Publication211/v4/13/fb/63/13fb6355-fce2-0e4b-08b7-48452037759a/9780593135211.d.jpg/100x100bb.jpg",
}
const PHM_HIRES = PHM.artworkUrl100.replace("/100x100bb.", "/1000x1000bb.")

const THAT_SUMMER = {
  trackName: "That Summer",
  artistName: "Jennifer Weiner",
  artworkUrl100:
    "https://is1-ssl.mzstatic.com/image/thumb/Publication126/v4/de/ad/8a/dead8aa1-2910-ee1d-9f1a-434c0dde8491/9781501133565.jpg/100x100bb.jpg",
}

/** The wrong cover the deck actually rendered on the Project Hail Mary card. */
const BREASTFEEDING = {
  trackName: "The National Childbirth Trust Book Of Breastfeeding",
  artistName: "Mary Smale",
  artworkUrl100:
    "https://is1-ssl.mzstatic.com/image/thumb/Publication/59/4e/eb/mzi.irggjfxz.jpg/100x100bb.jpg",
}

/** Stub iTunes: `lookup` and `search` answer from the given result lists. */
function stubItunes(byEndpoint: { lookup?: unknown[]; search?: unknown[] }) {
  const fetchMock = vi.fn(async (url: string | URL) => {
    const u = String(url)
    const results = u.includes("/lookup") ? byEndpoint.lookup : byEndpoint.search
    return new Response(JSON.stringify({ resultCount: (results || []).length, results: results || [] }), {
      status: 200,
      headers: { "Content-Type": "text/javascript" },
    })
  })
  vi.stubGlobal("fetch", fetchMock)
  return fetchMock
}

function get(params: Record<string, string>) {
  const qs = new URLSearchParams(params).toString()
  return GET(new NextRequest(`http://localhost/api/itunes-cover?${qs}`))
}

const PROJECT_HAIL_MARY = { title: "Project Hail Mary", author: "Andy Weir" }

describe("GET /api/itunes-cover — the ISBN tier is validated too", () => {
  afterEach(() => vi.unstubAllGlobals())

  it("rejects a by-ISBN hit that is a different book, and falls through to the search", async () => {
    stubItunes({ lookup: [THAT_SUMMER], search: [PHM] })
    const body = await (await get({ isbn: "0593135210", ...PROJECT_HAIL_MARY })).json()
    expect(body.cover).not.toContain("9781501133565") // That Summer's artwork
    expect(body.cover).toBe(PHM_HIRES)
  })

  it("returns no cover rather than a wrong one when nothing matches", async () => {
    stubItunes({ lookup: [BREASTFEEDING], search: [BREASTFEEDING] })
    const body = await (await get({ isbn: "9780593135204", ...PROJECT_HAIL_MARY })).json()
    expect(body.cover).toBeNull()
  })

  it("still accepts a by-ISBN hit that IS the book (the tier keeps working)", async () => {
    stubItunes({ lookup: [PHM], search: [] })
    const body = await (await get({ isbn: "9780593135211", ...PROJECT_HAIL_MARY })).json()
    expect(body.cover).toBe(PHM_HIRES)
  })

  it("scans every lookup result, not just the first", async () => {
    stubItunes({ lookup: [THAT_SUMMER, PHM], search: [] })
    const body = await (await get({ isbn: "9780593135211", ...PROJECT_HAIL_MARY })).json()
    expect(body.cover).toBe(PHM_HIRES)
  })

  it("refuses an isbn-only request instead of returning an unvalidatable cover", async () => {
    // Nothing to validate a lookup result against, and Apple's isbn index is
    // not trustworthy on its own — so refuse visibly rather than guess.
    stubItunes({ lookup: [THAT_SUMMER], search: [] })
    const res = await get({ isbn: "0593135210" })
    expect(res.status).toBe(400)
    expect(await res.json()).not.toHaveProperty("cover")
  })
})
