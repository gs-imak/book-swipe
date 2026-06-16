import { describe, it, expect, beforeEach, vi } from "vitest"
import { getCachedBooks, addBooksToCache, updateBooksInCache, clearBookCache, queryCache } from "@/lib/book-cache"
import type { Book } from "@/lib/book-data"
import { MAX_CACHE_SIZE } from "@/lib/config"

function makeBook(overrides: Partial<Book> = {}): Book {
  return {
    id: "test-1",
    title: "Test Book",
    author: "Test Author",
    cover: "https://example.com/cover.jpg",
    rating: 4.0,
    pages: 300,
    genre: ["Fiction"],
    mood: ["Thoughtful"],
    description: "A test book.",
    publishedYear: 2023,
    readingTime: "4-6 hours",
    ...overrides,
  }
}

// Mock localStorage
const localStorageMock = (() => {
  let store: Record<string, string> = {}
  return {
    getItem: vi.fn((key: string) => store[key] ?? null),
    setItem: vi.fn((key: string, value: string) => { store[key] = value }),
    removeItem: vi.fn((key: string) => { delete store[key] }),
    clear: vi.fn(() => { store = {} }),
  }
})()

Object.defineProperty(globalThis, "localStorage", { value: localStorageMock })

describe("book-cache", () => {
  beforeEach(() => {
    localStorageMock.clear()
    vi.clearAllMocks()
  })

  it("getCachedBooks returns sample books when cache is empty", () => {
    const books = getCachedBooks()
    expect(books.length).toBeGreaterThan(0)
    expect(books[0]).toHaveProperty("title")
    expect(books[0]).toHaveProperty("author")
  })

  it("addBooksToCache stores books and getCachedBooks retrieves them", () => {
    const newBooks = [
      makeBook({ id: "new-1", title: "New Book One" }),
      makeBook({ id: "new-2", title: "New Book Two" }),
    ]
    addBooksToCache(newBooks)
    const cached = getCachedBooks()
    const ids = cached.map((b) => b.id)
    expect(ids).toContain("new-1")
    expect(ids).toContain("new-2")
  })

  it("addBooksToCache deduplicates by ID", () => {
    const book = makeBook({ id: "dupe-1", title: "Original" })
    addBooksToCache([book])

    const duplicate = makeBook({ id: "dupe-1", title: "Duplicate" })
    addBooksToCache([duplicate])

    const cached = getCachedBooks()
    const dupes = cached.filter((b) => b.id === "dupe-1")
    expect(dupes.length).toBe(1)
  })

  it("clearBookCache empties the cache", () => {
    addBooksToCache([makeBook({ id: "clear-test" })])
    clearBookCache()
    // After clearing, getCachedBooks re-seeds with sample books
    const cached = getCachedBooks()
    const found = cached.find((b) => b.id === "clear-test")
    expect(found).toBeUndefined()
  })

  it("clearBookCache removes both the book cache and metadata keys", () => {
    addBooksToCache([makeBook({ id: "meta-check" })])
    clearBookCache()
    expect(localStorageMock.removeItem).toHaveBeenCalledWith("bookswipe_book_cache")
    expect(localStorageMock.removeItem).toHaveBeenCalledWith("bookswipe_cache_metadata")
  })

  it("adding a large batch beyond MAX_CACHE_SIZE evicts old entries", () => {
    // Fill the cache with books up to the limit
    const initialBatch = Array.from({ length: MAX_CACHE_SIZE }, (_, i) =>
      makeBook({ id: `initial-${i}`, title: `Initial ${i}` })
    )
    addBooksToCache(initialBatch)

    // Add more books that must push out the oldest
    const overflow = Array.from({ length: 20 }, (_, i) =>
      makeBook({ id: `overflow-${i}`, title: `Overflow ${i}` })
    )
    addBooksToCache(overflow)

    const cached = getCachedBooks()
    // Total must be capped at MAX_CACHE_SIZE
    expect(cached.length).toBeLessThanOrEqual(MAX_CACHE_SIZE)
  })

  it("queryCache returns only books matching the predicate", () => {
    addBooksToCache([
      makeBook({ id: "scifi-1", genre: ["Science Fiction"] }),
      makeBook({ id: "romance-1", genre: ["Romance"] }),
      makeBook({ id: "scifi-2", genre: ["Science Fiction"] }),
    ])

    const scifiBooks = queryCache((b) => b.genre.includes("Science Fiction"))
    expect(scifiBooks.every((b) => b.genre.includes("Science Fiction"))).toBe(true)
    expect(scifiBooks.some((b) => b.id === "romance-1")).toBe(false)
  })

  it("queryCache returns empty array when no books match", () => {
    addBooksToCache([makeBook({ id: "any-1", genre: ["Fiction"] })])
    const result = queryCache((b) => b.genre.includes("DoesNotExist"))
    expect(result).toEqual([])
  })

  it("addBooksToCache is a no-op when given an empty array", () => {
    addBooksToCache([makeBook({ id: "base" })])
    const before = getCachedBooks().length
    addBooksToCache([])
    const after = getCachedBooks().length
    expect(after).toBe(before)
  })

  it("updateBooksInCache replaces an existing book's fields in place", () => {
    addBooksToCache([makeBook({ id: "up-1", cover: "https://covers.openlibrary.org/old-L.jpg" })])
    updateBooksInCache([makeBook({ id: "up-1", cover: "https://m.media-amazon.com/images/P/0525559477.01._SCLZZZZZZZ_.jpg", coverFallback: "https://covers.openlibrary.org/old-L.jpg" })])
    const book = getCachedBooks().find((b) => b.id === "up-1")
    expect(book?.cover).toContain("media-amazon")
    expect(book?.coverFallback).toContain("openlibrary")
  })

  it("updateBooksInCache does not add books whose id is not already cached", () => {
    addBooksToCache([makeBook({ id: "present" })])
    const before = getCachedBooks().length
    updateBooksInCache([makeBook({ id: "absent", title: "Should not be added" })])
    const cached = getCachedBooks()
    expect(cached.length).toBe(before)
    expect(cached.some((b) => b.id === "absent")).toBe(false)
  })

  it("updateBooksInCache is a no-op when given an empty array", () => {
    addBooksToCache([makeBook({ id: "base" })])
    const before = getCachedBooks().length
    updateBooksInCache([])
    expect(getCachedBooks().length).toBe(before)
  })
})
