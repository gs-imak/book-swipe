import { describe, it, expect } from "vitest"
import { amazonCoverFromEdition, upgradeOpenLibraryCovers } from "@/lib/openlibrary-api"
import type { Book } from "@/lib/book-data"

const baseBook = (over: Partial<Book>): Book => ({
  id: "x",
  title: "T",
  author: "A",
  cover: "https://covers.openlibrary.org/b/id/1-L.jpg?default=false",
  rating: 4,
  pages: 100,
  genre: ["Fantasy"],
  mood: ["Magical"],
  description: "d",
  publishedYear: 2020,
  readingTime: "1-2 hours",
  ...over,
})

describe("amazonCoverFromEdition", () => {
  it("builds an Amazon URL from the edition's ISBN-13 (correct edition)", () => {
    expect(amazonCoverFromEdition({ isbn_13: ["9780525559474"] })).toBe(
      "https://m.media-amazon.com/images/P/0525559477.01._SCLZZZZZZZ_.jpg"
    )
  })

  it("falls back to ISBN-10 when no ISBN-13 is present", () => {
    expect(amazonCoverFromEdition({ isbn_10: ["0441013597"] })).toBe(
      "https://m.media-amazon.com/images/P/0441013597.01._SCLZZZZZZZ_.jpg"
    )
  })

  it("prefers ISBN-13 over ISBN-10", () => {
    const url = amazonCoverFromEdition({ isbn_13: ["9780525559474"], isbn_10: ["0441013597"] })
    expect(url).toContain("0525559477")
  })

  it("returns null for a 979-only edition or no ISBN at all", () => {
    expect(amazonCoverFromEdition({ isbn_13: ["9791234567896"] })).toBeNull()
    expect(amazonCoverFromEdition({})).toBeNull()
  })
})

describe("upgradeOpenLibraryCovers — skips non-candidates without any fetch", () => {
  it("returns [] for an empty deck", async () => {
    expect(await upgradeOpenLibraryCovers([])).toEqual([])
  })

  it("ignores Google-sourced books", async () => {
    const g = baseBook({ id: "g", metadata: { source: "google" } })
    expect(await upgradeOpenLibraryCovers([g])).toEqual([])
  })

  it("ignores OL books without a cover_edition_key", async () => {
    const o = baseBook({ id: "o", metadata: { source: "openlibrary" } })
    expect(await upgradeOpenLibraryCovers([o])).toEqual([])
  })

  it("ignores OL books already on an Amazon cover", async () => {
    const o = baseBook({
      id: "o",
      cover: "https://m.media-amazon.com/images/P/0525559477.01._SCLZZZZZZZ_.jpg",
      metadata: { source: "openlibrary", coverEditionKey: "OL1M" },
    })
    expect(await upgradeOpenLibraryCovers([o])).toEqual([])
  })
})
