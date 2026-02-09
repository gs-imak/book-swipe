import { describe, it, expect, beforeEach, vi } from "vitest"
import { getCachedBooks, addBooksToCache, clearBookCache } from "@/lib/book-cache"
import type { Book } from "@/lib/book-data"

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
})
