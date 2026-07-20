import { describe, it, expect } from "vitest"
import { transformToBook, type OpenLibraryDoc } from "@/lib/openlibrary-api"

function makeDoc(overrides: Partial<OpenLibraryDoc> = {}): OpenLibraryDoc {
  return {
    key: "/works/OL123W",
    title: "Test Work",
    author_name: ["Test Person"],
    cover_i: 5551234,
    ...overrides,
  }
}

describe("transformToBook covers + ISBN", () => {
  it("stores the preferred ISBN-13 from the doc's isbn list", () => {
    const book = transformToBook(
      makeDoc({ isbn: ["0451524934", "9780451524935"] }),
      "fantasy"
    )
    expect(book).not.toBeNull()
    expect(book!.isbn).toBe("9780451524935")
  })

  it("uses an edition-exact by-ISBN cover fallback when an ISBN exists", () => {
    const book = transformToBook(
      makeDoc({ isbn: ["9780451524935"] }),
      "fantasy"
    )
    expect(book!.cover).toContain("/b/id/5551234-L.jpg")
    expect(book!.coverFallback).toContain("/b/isbn/9780451524935-L.jpg")
  })

  it("falls back to the medium work cover when no ISBN exists", () => {
    const book = transformToBook(makeDoc(), "fantasy")
    expect(book!.isbn).toBeUndefined()
    expect(book!.coverFallback).toContain("/b/id/5551234-M.jpg")
  })

  it("still rejects docs without a cover id", () => {
    expect(transformToBook(makeDoc({ cover_i: undefined }), "fantasy")).toBeNull()
  })
})
