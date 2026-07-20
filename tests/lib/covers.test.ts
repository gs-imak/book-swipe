import { describe, it, expect } from "vitest"
import {
  upgradeGoogleBooksCoverUrl,
  sanitizeGoogleCoverUrl,
  itunesHiResArtwork,
  isItunesCover,
  pickPreferredIsbn,
  itunesResultMatchesBook,
} from "@/lib/covers"

describe("itunesResultMatchesBook", () => {
  it("accepts an exact title/author match", () => {
    expect(itunesResultMatchesBook(
      { trackName: "The Midnight Library", artistName: "Matt Haig" },
      "The Midnight Library", "Matt Haig"
    )).toBe(true)
  })

  it("accepts subtitle variants and author initials via surname match", () => {
    expect(itunesResultMatchesBook(
      { trackName: "Villette (Wordsworth Classics)", artistName: "C. Brontë" },
      "Villette", "Charlotte Brontë"
    )).toBe(true)
  })

  it("normalizes diacritics and punctuation before comparing", () => {
    expect(itunesResultMatchesBook(
      { trackName: "Bronte's Villette", artistName: "Charlotte Bronte" },
      "Brontë’s Villette", "Charlotte Brontë"
    )).toBe(true)
  })

  it("rejects a different book by the same author", () => {
    expect(itunesResultMatchesBook(
      { trackName: "Jane Eyre", artistName: "Charlotte Brontë" },
      "Villette", "Charlotte Brontë"
    )).toBe(false)
  })

  it("rejects the right title by the wrong author", () => {
    expect(itunesResultMatchesBook(
      { trackName: "Villette", artistName: "Somebody Else" },
      "Villette", "Charlotte Brontë"
    )).toBe(false)
  })

  it("requires exact title equality for very short titles", () => {
    expect(itunesResultMatchesBook(
      { trackName: "It Ends with Us", artistName: "Stephen King" },
      "It", "Stephen King"
    )).toBe(false)
    expect(itunesResultMatchesBook(
      { trackName: "It", artistName: "Stephen King" },
      "It", "Stephen King"
    )).toBe(true)
  })

  it("rejects results missing fields", () => {
    expect(itunesResultMatchesBook({}, "Villette", "Charlotte Brontë")).toBe(false)
    expect(itunesResultMatchesBook({ trackName: "Villette" }, "Villette", "")).toBe(false)
  })
})

describe("sanitizeGoogleCoverUrl", () => {
  it("forces https and strips the curl edge WITHOUT bumping zoom", () => {
    const out = sanitizeGoogleCoverUrl(
      "http://books.google.com/books/content?id=X&zoom=1&edge=curl"
    )
    expect(out.startsWith("https://")).toBe(true)
    expect(out).not.toContain("edge=curl")
    expect(out).toContain("zoom=1")
  })

  it("returns empty input unchanged", () => {
    expect(sanitizeGoogleCoverUrl("")).toBe("")
  })
})

describe("pickPreferredIsbn", () => {
  it("prefers an English-group ISBN-13 (978-0/978-1) over foreign ones regardless of order", () => {
    // 978-605 is a Turkish registration group — a real case from OL data
    expect(pickPreferredIsbn(["9786050957174", "9780451524935"])).toBe("9780451524935")
    expect(pickPreferredIsbn(["9786050957174", "9781250174482"])).toBe("9781250174482")
  })

  it("prefers an ISBN-13 over ISBN-10s", () => {
    expect(pickPreferredIsbn(["0451524934", "9780451524935"])).toBe("9780451524935")
  })

  it("falls back to any ISBN-13 when no English-group one exists", () => {
    expect(pickPreferredIsbn(["9786050957174"])).toBe("9786050957174")
    expect(pickPreferredIsbn(["9791234567896"])).toBe("9791234567896")
  })

  it("falls back to ISBN-10, preferring the English group", () => {
    expect(pickPreferredIsbn(["2070360024", "045152493X"])).toBe("045152493X")
    expect(pickPreferredIsbn(["2070360024"])).toBe("2070360024")
  })

  it("strips hyphens before matching", () => {
    expect(pickPreferredIsbn(["978-0-451-52493-5"])).toBe("9780451524935")
  })

  it("returns undefined for empty, missing, or junk input", () => {
    expect(pickPreferredIsbn([])).toBeUndefined()
    expect(pickPreferredIsbn(undefined)).toBeUndefined()
    expect(pickPreferredIsbn(["not-an-isbn"])).toBeUndefined()
  })
})

describe("upgradeGoogleBooksCoverUrl", () => {
  it("forces https and drops the page-curl edge effect", () => {
    const out = upgradeGoogleBooksCoverUrl(
      "http://books.google.com/books/content?id=X&zoom=1&edge=curl"
    )
    expect(out.startsWith("https://")).toBe(true)
    expect(out).not.toContain("edge=curl")
  })

  it("bumps low zoom (0/1) up to 2 on Google covers but leaves higher zoom alone", () => {
    expect(upgradeGoogleBooksCoverUrl("https://books.google.com/x?zoom=1")).toContain("zoom=2")
    expect(upgradeGoogleBooksCoverUrl("https://books.google.com/x?zoom=3")).toContain("zoom=3")
  })

  it("leaves non-Google URLs and empty input untouched (except https/curl)", () => {
    expect(upgradeGoogleBooksCoverUrl("")).toBe("")
    expect(upgradeGoogleBooksCoverUrl("https://covers.openlibrary.org/b/id/1-L.jpg")).toBe(
      "https://covers.openlibrary.org/b/id/1-L.jpg"
    )
  })
})

describe("itunesHiResArtwork", () => {
  it("swaps the artwork size box for a larger one (default 1000)", () => {
    expect(
      itunesHiResArtwork("https://is1-ssl.mzstatic.com/image/thumb/abc/source/100x100bb.jpg")
    ).toBe("https://is1-ssl.mzstatic.com/image/thumb/abc/source/1000x1000bb.jpg")
  })

  it("honours a custom pixel size", () => {
    expect(
      itunesHiResArtwork("https://is1-ssl.mzstatic.com/image/thumb/abc/source/100x100bb.jpg", 600)
    ).toContain("/600x600bb.")
  })

  it("returns empty input unchanged and leaves non-matching URLs alone", () => {
    expect(itunesHiResArtwork("")).toBe("")
    expect(itunesHiResArtwork("https://example.com/cover.jpg")).toBe("https://example.com/cover.jpg")
  })
})

describe("isItunesCover", () => {
  it("is true for Apple artwork URLs, false otherwise", () => {
    expect(isItunesCover("https://is3-ssl.mzstatic.com/image/thumb/x/1000x1000bb.jpg")).toBe(true)
    expect(isItunesCover("https://covers.openlibrary.org/b/id/1-L.jpg")).toBe(false)
    expect(isItunesCover(undefined)).toBe(false)
  })
})
