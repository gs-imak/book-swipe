import { describe, it, expect, beforeEach } from "vitest"
import type { Book } from "@/lib/book-data"
import { saveLikedBooks, saveDailyPick, type DailyPick } from "@/lib/storage"
import { generateDailyPick, dismissDailyPick } from "@/lib/daily-pick"

const store: Record<string, string> = {}

beforeEach(() => {
  Object.keys(store).forEach((k) => delete store[k])
  Object.defineProperty(window, "localStorage", {
    value: {
      getItem: (k: string) => store[k] ?? null,
      setItem: (k: string, v: string) => {
        store[k] = v
      },
      removeItem: (k: string) => {
        delete store[k]
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

function book(id: string): Book {
  return {
    id,
    title: `Book ${id}`,
    author: "A",
    cover: "",
    rating: 4,
    pages: 100,
    genre: [],
    mood: [],
    description: "",
    publishedYear: 2020,
    readingTime: "",
  }
}

function todayString(): string {
  const d = new Date()
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`
}

describe("generateDailyPick — guards", () => {
  it("returns null when fewer than 3 books are liked (no premature pick)", async () => {
    saveLikedBooks([book("a"), book("b")])
    expect(await generateDailyPick()).toBeNull()
  })

  it("returns the existing pick when one already exists for today and is not dismissed", async () => {
    const existing: DailyPick = {
      book: book("today"),
      reasons: [{ type: "test", description: "because" }],
      date: todayString(),
      dismissed: false,
      saved: false,
    }
    saveDailyPick(existing)
    const pick = await generateDailyPick()
    expect(pick).not.toBeNull()
    expect(pick!.book.id).toBe("today")
  })

  it("returns null (does not resurrect) when today's pick was dismissed", async () => {
    saveDailyPick({
      book: book("dismissed"),
      reasons: [],
      date: todayString(),
      dismissed: true,
      saved: false,
    })
    expect(await generateDailyPick()).toBeNull()
  })
})

describe("dismissDailyPick", () => {
  it("marks the stored pick dismissed", async () => {
    saveDailyPick({
      book: book("x"),
      reasons: [],
      date: todayString(),
      dismissed: false,
      saved: false,
    })
    dismissDailyPick()
    // Next generate for the same day should now return null.
    expect(await generateDailyPick()).toBeNull()
  })
})
