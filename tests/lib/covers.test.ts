import { describe, it, expect } from "vitest"
import {
  upgradeGoogleBooksCoverUrl,
  itunesHiResArtwork,
  isItunesCover,
} from "@/lib/covers"

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
