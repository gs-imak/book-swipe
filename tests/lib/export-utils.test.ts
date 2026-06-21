import { describe, it, expect, beforeEach } from "vitest"
import type { Book } from "@/lib/book-data"
import { saveLikedBooks, saveBookReview } from "@/lib/storage"
import {
  exportToGoodreadsCSV,
  exportToNotionCSV,
  exportFullBackupJSON,
  importFullBackupJSON,
  previewFullBackupJSON,
} from "@/lib/export-utils"

// localStorage mock whose Object.keys(...) returns the STORED keys (matching
// real Web Storage), which exportFullBackupJSON's getBackupKeys() relies on.
function installLocalStorage() {
  const data: Record<string, string> = {}
  const api: any = {
    getItem: (k: string) => (k in data ? data[k] : null),
    setItem: (k: string, v: string) => {
      data[k] = String(v)
    },
    removeItem: (k: string) => {
      delete data[k]
    },
    clear: () => Object.keys(data).forEach((k) => delete data[k]),
    key: (i: number) => Object.keys(data)[i] ?? null,
    get length() {
      return Object.keys(data).length
    },
  }
  const proxy = new Proxy(api, {
    ownKeys: () => Object.keys(data),
    getOwnPropertyDescriptor: (t, p) =>
      typeof p === "string" && p in data
        ? { enumerable: true, configurable: true, value: data[p] }
        : Object.getOwnPropertyDescriptor(t, p),
    get: (t, p) => (typeof p === "string" && p in api ? api[p] : (data as any)[p]),
  })
  Object.defineProperty(window, "localStorage", { value: proxy, writable: true, configurable: true })
}

beforeEach(() => installLocalStorage())

function makeBook(overrides: Partial<Book> = {}): Book {
  return {
    id: "b1",
    title: "Test Book",
    author: "Test Author",
    cover: "",
    rating: 4,
    pages: 200,
    genre: ["Fiction"],
    mood: ["Calm"],
    description: "",
    publishedYear: 2020,
    readingTime: "",
    ...overrides,
  }
}

describe("exportToGoodreadsCSV — formula injection guard", () => {
  it("neutralizes a title starting with = (CSV/formula injection)", () => {
    saveLikedBooks([makeBook({ id: "x", title: "=HYPERLINK(\"evil\")" })])
    const csv = exportToGoodreadsCSV()
    // The dangerous leading = must be prefixed with ' so a spreadsheet won't run it.
    expect(csv).toContain("'=HYPERLINK")
    expect(csv).not.toMatch(/(^|,)=HYPERLINK/m)
  })

  it("neutralizes +, -, @ formula leads too", () => {
    saveLikedBooks([
      makeBook({ id: "a", title: "+1+1", author: "@cmd" }),
    ])
    const csv = exportToGoodreadsCSV()
    expect(csv).toContain("'+1+1")
    expect(csv).toContain("'@cmd")
  })

  it("quotes and escapes embedded commas and quotes", () => {
    saveLikedBooks([makeBook({ id: "c", title: 'A, "quoted", title' })])
    const csv = exportToGoodreadsCSV()
    expect(csv).toContain('"A, ""quoted"", title"')
  })

  it("emits a header row even with no books", () => {
    saveLikedBooks([])
    const csv = exportToGoodreadsCSV()
    expect(csv.split("\n")[0]).toContain("Title")
  })
})

describe("exportToNotionCSV", () => {
  it("includes genre/mood columns and the book row", () => {
    saveLikedBooks([makeBook({ id: "n", title: "Notion Book", genre: ["Sci-Fi"], mood: ["Tense"] })])
    const csv = exportToNotionCSV()
    expect(csv).toContain("Notion Book")
    expect(csv).toContain("Sci-Fi")
  })
})

describe("full JSON backup round-trip", () => {
  it("exports all bookswipe_ keys and re-imports them", () => {
    saveLikedBooks([makeBook({ id: "rt1" }), makeBook({ id: "rt2" })])
    saveBookReview({
      bookId: "rt1",
      rating: 5,
      favorite: true,
      tags: [],
      mood: "",
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    })

    const json = exportFullBackupJSON()
    // Wipe everything, then restore from the backup.
    window.localStorage.clear()
    const result = importFullBackupJSON(json)

    expect(result.success).toBe(true)
    expect(result.stats!.books).toBe(2)
    expect(result.stats!.reviews).toBe(1)
  })

  it("excludes the volatile book cache from the backup", () => {
    saveLikedBooks([makeBook({ id: "v" })])
    window.localStorage.setItem("bookswipe_book_cache", JSON.stringify([{ id: "junk" }]))
    const parsed = JSON.parse(exportFullBackupJSON())
    expect(parsed.data["bookswipe_book_cache"]).toBeUndefined()
    expect(parsed.data["bookswipe_liked_books"]).toBeDefined()
  })
})

describe("importFullBackupJSON — validation", () => {
  it("rejects malformed JSON", () => {
    expect(importFullBackupJSON("{not json").success).toBe(false)
  })

  it("rejects a file that is not a BookSwipe backup", () => {
    const foreign = JSON.stringify({ metadata: { appVersion: "other" }, data: {} })
    const r = importFullBackupJSON(foreign)
    expect(r.success).toBe(false)
    expect(r.error).toMatch(/not a BookSwipe backup/i)
  })

  it("ignores non-namespaced keys in the data section", () => {
    const payload = JSON.stringify({
      metadata: { appVersion: "bookswipe", version: 1 },
      data: { evil_key: "x", bookswipe_liked_books: [] },
    })
    importFullBackupJSON(payload)
    expect(window.localStorage.getItem("evil_key")).toBeNull()
  })
})

describe("previewFullBackupJSON", () => {
  it("reports counts without writing to storage", () => {
    const payload = JSON.stringify({
      metadata: { appVersion: "bookswipe", version: 1 },
      data: { bookswipe_liked_books: [{ id: "a" }, { id: "b" }] },
    })
    const r = previewFullBackupJSON(payload)
    expect(r.success).toBe(true)
    expect(r.stats!.books).toBe(2)
    expect(window.localStorage.getItem("bookswipe_liked_books")).toBeNull()
  })
})
