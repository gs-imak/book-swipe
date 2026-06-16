import { describe, it, expect } from "vitest"
import {
  amazonCoverUrl,
  upgradeGoogleBooksCoverUrl,
  resolveBestCover,
} from "@/lib/covers"

describe("amazonCoverUrl", () => {
  it("builds a largest-available (_SCLZZZZZZZ_) URL from an ISBN-10", () => {
    expect(amazonCoverUrl("0525559477")).toBe(
      "https://m.media-amazon.com/images/P/0525559477.01._SCLZZZZZZZ_.jpg"
    )
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

describe("resolveBestCover", () => {
  it("leads with an Amazon cover when an ISBN resolves, keeping the original as fallback", () => {
    const r = resolveBestCover({ isbn: "9780525559474", googleCover: "https://books.google.com/c?id=X&zoom=2" })
    expect(r.cover).toBe("https://m.media-amazon.com/images/P/0525559477.01._SCLZZZZZZZ_.jpg")
    expect(r.coverFallback).toBe("https://books.google.com/c?id=X&zoom=2")
  })

  it("falls back to the Google cover (no fallback) when no ISBN-10 exists", () => {
    const g = "https://books.google.com/c?id=Y&zoom=2"
    const r = resolveBestCover({ isbn: undefined, googleCover: g })
    expect(r.cover).toBe(g)
    expect(r.coverFallback).toBeUndefined()
  })

  it("does not set an Amazon cover for a 979-prefixed ISBN-13", () => {
    const g = "https://books.google.com/c?id=Z&zoom=2"
    const r = resolveBestCover({ isbn: "9791234567896", googleCover: g })
    expect(r.cover).toBe(g)
    expect(r.coverFallback).toBeUndefined()
  })
})
