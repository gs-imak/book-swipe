import { describe, it, expect, beforeEach } from "vitest"
import type { Book } from "@/lib/book-data"
import {
  addLikedBook,
  removeLikedBook,
  saveLikedBooks,
  getLikedBooks,
  addBookToReading,
  getReadingProgress,
  saveBookReview,
  getBookReview,
  getBookReviews,
  calculateLevel,
  getPointsForNextLevel,
  shouldShowBackupReminder,
  isOnboarded,
  setOnboarded,
  saveReadingPosition,
  getReadingPosition,
  assignBookToShelf,
  getShelvesForBook,
  getBooksForShelf,
  removeBookFromShelf,
  createShelf,
  getShelves,
  addPassedBookId,
  getPassedFeatures,
} from "@/lib/storage"
import type { BookReview } from "@/lib/storage"

// ── localStorage mock ─────────────────────────────────────────────────────────

const store: Record<string, string> = {}

beforeEach(() => {
  Object.keys(store).forEach((k) => delete store[k])
  Object.defineProperty(window, "localStorage", {
    value: {
      getItem: (key: string) => store[key] ?? null,
      setItem: (key: string, value: string) => {
        store[key] = value
      },
      removeItem: (key: string) => {
        delete store[key]
      },
      clear: () => Object.keys(store).forEach((k) => delete store[k]),
      get length() {
        return Object.keys(store).length
      },
      key: (i: number) => Object.keys(store)[i] ?? null,
    },
    writable: true,
    configurable: true,
  })
})

// ── helpers ───────────────────────────────────────────────────────────────────

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
    description: "A test book about testing things.",
    publishedYear: 2023,
    readingTime: "4-6 hours",
    ...overrides,
  }
}

function makeReview(overrides: Partial<BookReview> = {}): BookReview {
  return {
    bookId: "test-1",
    rating: 4,
    review: "Great read.",
    favorite: false,
    tags: ["classic"],
    mood: "Thoughtful",
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
    ...overrides,
  }
}

// ── liked books ───────────────────────────────────────────────────────────────

describe("getLikedBooks / saveLikedBooks", () => {
  it("returns empty array when nothing is stored", () => {
    expect(getLikedBooks()).toEqual([])
  })

  it("round-trips an array of books", () => {
    const books = [makeBook({ id: "a" }), makeBook({ id: "b" })]
    saveLikedBooks(books)
    const retrieved = getLikedBooks()
    expect(retrieved).toHaveLength(2)
    expect(retrieved.map((b) => b.id)).toEqual(["a", "b"])
  })

  it("overwrites previously saved books", () => {
    saveLikedBooks([makeBook({ id: "old" })])
    saveLikedBooks([makeBook({ id: "new" })])
    expect(getLikedBooks().map((b) => b.id)).toEqual(["new"])
  })
})

describe("addLikedBook", () => {
  it("adds a book and returns true", () => {
    const result = addLikedBook(makeBook({ id: "unique-1" }))
    expect(result).toBe(true)
    expect(getLikedBooks().some((b) => b.id === "unique-1")).toBe(true)
  })

  it("rejects a duplicate id and returns false", () => {
    const book = makeBook({ id: "dup-1" })
    addLikedBook(book)
    const second = addLikedBook(book)
    expect(second).toBe(false)
    expect(getLikedBooks().filter((b) => b.id === "dup-1")).toHaveLength(1)
  })

  it("accumulates multiple distinct books", () => {
    addLikedBook(makeBook({ id: "book-a" }))
    addLikedBook(makeBook({ id: "book-b" }))
    addLikedBook(makeBook({ id: "book-c" }))
    expect(getLikedBooks()).toHaveLength(3)
  })
})

describe("removeLikedBook", () => {
  it("removes the book with the matching id", () => {
    saveLikedBooks([makeBook({ id: "keep" }), makeBook({ id: "remove-me" })])
    const updated = removeLikedBook("remove-me")
    expect(updated.some((b) => b.id === "remove-me")).toBe(false)
    expect(updated.some((b) => b.id === "keep")).toBe(true)
  })

  it("returns the updated array that matches getLikedBooks", () => {
    saveLikedBooks([makeBook({ id: "x" }), makeBook({ id: "y" })])
    const returned = removeLikedBook("x")
    expect(returned).toEqual(getLikedBooks())
  })

  it("is a no-op when the id does not exist", () => {
    saveLikedBooks([makeBook({ id: "only" })])
    const updated = removeLikedBook("nonexistent")
    expect(updated).toHaveLength(1)
  })
})

// ── reading progress ──────────────────────────────────────────────────────────

describe("addBookToReading", () => {
  it("adds a progress entry for a new book", () => {
    addBookToReading(makeBook({ id: "reading-1", pages: 350 }))
    const progress = getReadingProgress()
    expect(progress).toHaveLength(1)
    expect(progress[0].bookId).toBe("reading-1")
    expect(progress[0].totalPages).toBe(350)
    expect(progress[0].currentPage).toBe(0)
    expect(progress[0].status).toBe("reading")
  })

  it("skips a duplicate without adding a second entry", () => {
    const book = makeBook({ id: "reading-dup" })
    addBookToReading(book)
    addBookToReading(book)
    expect(getReadingProgress()).toHaveLength(1)
  })

  it("records both startedDate and lastReadDate as ISO strings", () => {
    addBookToReading(makeBook({ id: "date-check" }))
    const entry = getReadingProgress()[0]
    expect(() => new Date(entry.startedDate).toISOString()).not.toThrow()
    expect(() => new Date(entry.lastReadDate).toISOString()).not.toThrow()
  })
})

// ── book reviews ──────────────────────────────────────────────────────────────

describe("saveBookReview / getBookReview", () => {
  it("saves and retrieves a review by bookId", () => {
    const review = makeReview({ bookId: "rev-1" })
    saveBookReview(review)
    const retrieved = getBookReview("rev-1")
    expect(retrieved).not.toBeNull()
    expect(retrieved!.bookId).toBe("rev-1")
    expect(retrieved!.rating).toBe(4)
  })

  it("returns null for a bookId with no review", () => {
    expect(getBookReview("no-such-book")).toBeNull()
  })

  it("upserts — saving again for same bookId replaces the existing entry", () => {
    saveBookReview(makeReview({ bookId: "upsert-1", rating: 3 }))
    saveBookReview(makeReview({ bookId: "upsert-1", rating: 5 }))
    const reviews = getBookReviews().filter((r) => r.bookId === "upsert-1")
    expect(reviews).toHaveLength(1)
    expect(reviews[0].rating).toBe(5)
  })

  it("strips control characters from the review text", () => {
    const dirty = "Good book\x01\x07\x0b with some\x0c hidden chars"
    saveBookReview(makeReview({ bookId: "sanitize-1", review: dirty }))
    const retrieved = getBookReview("sanitize-1")
    expect(retrieved!.review).not.toMatch(/[\x00-\x08\x0b\x0c\x0e-\x1f]/)
    expect(retrieved!.review).toContain("Good book")
  })

  it("caps review text at 5000 characters", () => {
    const longText = "a".repeat(6000)
    saveBookReview(makeReview({ bookId: "cap-1", review: longText }))
    const retrieved = getBookReview("cap-1")
    expect(retrieved!.review!.length).toBe(5000)
  })

  it("caps mood at 100 characters", () => {
    const longMood = "m".repeat(200)
    saveBookReview(makeReview({ bookId: "mood-cap", mood: longMood }))
    const retrieved = getBookReview("mood-cap")
    expect(retrieved!.mood.length).toBe(100)
  })

  it("caps each tag at 50 characters and keeps at most 20 tags", () => {
    const manyTags = Array.from({ length: 25 }, (_, i) => "x".repeat(80) + i)
    saveBookReview(makeReview({ bookId: "tags-cap", tags: manyTags }))
    const retrieved = getBookReview("tags-cap")!
    expect(retrieved.tags.length).toBeLessThanOrEqual(20)
    retrieved.tags.forEach((tag) => expect(tag.length).toBeLessThanOrEqual(50))
  })
})

// ── points / level formula ────────────────────────────────────────────────────

describe("calculateLevel", () => {
  it("returns level 1 at 0 points", () => {
    expect(calculateLevel(0)).toBe(1)
  })

  it("returns level 2 at 100 points", () => {
    expect(calculateLevel(100)).toBe(2)
  })

  it("returns level 3 at 400 points", () => {
    expect(calculateLevel(400)).toBe(3)
  })

  it("never returns a level below 1", () => {
    expect(calculateLevel(0)).toBeGreaterThanOrEqual(1)
  })
})

describe("getPointsForNextLevel", () => {
  it("returns a positive number for level 1", () => {
    expect(getPointsForNextLevel(1)).toBeGreaterThan(0)
  })

  it("returns more points for higher levels", () => {
    const l2 = getPointsForNextLevel(2)
    const l5 = getPointsForNextLevel(5)
    expect(l5).toBeGreaterThan(l2)
  })
})

// ── backup reminder ───────────────────────────────────────────────────────────

describe("shouldShowBackupReminder", () => {
  it("returns false when fewer than 10 books are liked", () => {
    saveLikedBooks(Array.from({ length: 5 }, (_, i) => makeBook({ id: `b${i}` })))
    expect(shouldShowBackupReminder()).toBe(false)
  })

  it("returns true when 10+ books liked and no export has been made", () => {
    saveLikedBooks(Array.from({ length: 10 }, (_, i) => makeBook({ id: `b${i}` })))
    expect(shouldShowBackupReminder()).toBe(true)
  })
})

// ── onboarding flag ───────────────────────────────────────────────────────────

describe("isOnboarded / setOnboarded", () => {
  it("returns false before setOnboarded is called", () => {
    expect(isOnboarded()).toBe(false)
  })

  it("returns true after setOnboarded is called", () => {
    setOnboarded()
    expect(isOnboarded()).toBe(true)
  })
})

// ── reading positions ─────────────────────────────────────────────────────────

describe("saveReadingPosition / getReadingPosition", () => {
  it("returns 0 for an unseen bookId", () => {
    expect(getReadingPosition("never-read")).toBe(0)
  })

  it("saves and retrieves the character offset", () => {
    saveReadingPosition("pos-1", 1234)
    expect(getReadingPosition("pos-1")).toBe(1234)
  })

  it("overwrites a previous position for the same bookId", () => {
    saveReadingPosition("pos-2", 100)
    saveReadingPosition("pos-2", 999)
    expect(getReadingPosition("pos-2")).toBe(999)
  })

  it("stores positions for multiple books independently", () => {
    saveReadingPosition("multi-a", 10)
    saveReadingPosition("multi-b", 20)
    expect(getReadingPosition("multi-a")).toBe(10)
    expect(getReadingPosition("multi-b")).toBe(20)
  })
})

// ── shelves ───────────────────────────────────────────────────────────────────

describe("assignBookToShelf / getShelvesForBook", () => {
  it("assigns a book to a shelf and retrieves it", () => {
    assignBookToShelf("book-1", "want-to-read")
    expect(getShelvesForBook("book-1")).toContain("want-to-read")
  })

  it("does not duplicate an assignment made twice", () => {
    assignBookToShelf("book-2", "finished")
    assignBookToShelf("book-2", "finished")
    expect(getShelvesForBook("book-2").filter((s) => s === "finished")).toHaveLength(1)
  })

  it("assigns a book to multiple shelves", () => {
    assignBookToShelf("book-3", "want-to-read")
    assignBookToShelf("book-3", "currently-reading")
    const shelves = getShelvesForBook("book-3")
    expect(shelves).toContain("want-to-read")
    expect(shelves).toContain("currently-reading")
  })
})

describe("removeBookFromShelf", () => {
  it("removes the specific shelf assignment only", () => {
    assignBookToShelf("book-4", "want-to-read")
    assignBookToShelf("book-4", "finished")
    removeBookFromShelf("book-4", "want-to-read")
    const shelves = getShelvesForBook("book-4")
    expect(shelves).not.toContain("want-to-read")
    expect(shelves).toContain("finished")
  })
})

describe("getBooksForShelf", () => {
  it("returns all book IDs assigned to a shelf", () => {
    assignBookToShelf("shelf-book-a", "want-to-read")
    assignBookToShelf("shelf-book-b", "want-to-read")
    const books = getBooksForShelf("want-to-read")
    expect(books).toContain("shelf-book-a")
    expect(books).toContain("shelf-book-b")
  })
})

describe("createShelf", () => {
  it("creates a new non-default shelf and includes it in getShelves", () => {
    const shelf = createShelf("My Shelf", "★")
    expect(shelf.isDefault).toBe(false)
    expect(shelf.name).toBe("My Shelf")
    const all = getShelves()
    expect(all.some((s) => s.id === shelf.id)).toBe(true)
  })

  it("strips control characters from the shelf name", () => {
    const shelf = createShelf("Good\x01Name\x1f", "★")
    expect(shelf.name).toBe("GoodName")
  })

  it("caps emoji at 4 characters", () => {
    const shelf = createShelf("Test", "★★★★★★")
    expect(shelf.emoji.length).toBeLessThanOrEqual(4)
  })
})

// ── Passed features (negative signal) ────────────────────────────────────────

describe("passed features", () => {
  it("records the passed author alongside genres and moods", () => {
    addPassedBookId("p1", ["Fantasy"], ["Epic"], "Zorblax Vex")
    const features = getPassedFeatures()
    expect(features.genres).toContain("Fantasy")
    expect(features.moods).toContain("Epic")
    expect(features.authors).toEqual(["Zorblax Vex"])
  })

  it("returns empty authors for features stored before the field existed", () => {
    window.localStorage.setItem(
      "bookswipe_passed_features",
      JSON.stringify({ genres: ["Mystery"], moods: ["Dark"] })
    )
    const features = getPassedFeatures()
    expect(features.genres).toEqual(["Mystery"])
    expect(features.moods).toEqual(["Dark"])
    expect(features.authors).toEqual([])
  })

  it("caps stored authors at 200 most recent", () => {
    for (let i = 0; i < 210; i++) {
      addPassedBookId(`pass-${i}`, undefined, undefined, `Author ${i}`)
    }
    const features = getPassedFeatures()
    expect(features.authors.length).toBe(200)
    expect(features.authors[0]).toBe("Author 10")
    expect(features.authors[199]).toBe("Author 209")
  })
})
