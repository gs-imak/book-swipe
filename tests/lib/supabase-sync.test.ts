import { describe, it, expect } from "vitest"
import type { Book } from "@/lib/book-data"
import type { BookReview, ReadingProgress, Shelf, BookShelfAssignment } from "@/lib/storage"
import {
  isLocalNewer,
  mergeLikedBooks,
  mergeReviewsByNewer,
  mergeProgressByNewer,
  mergeShelves,
  mergeShelfAssignments,
} from "@/lib/supabase-sync"

// These cover the conflict-resolution core that powers both syncToCloud's
// last-writer-wins push guard and the new pullFromCloudToLocal merge. Before
// this file there were ZERO tests on sync, the module most likely to silently
// lose a user's reading history.

function book(id: string): Book {
  return {
    id,
    title: `Book ${id}`,
    author: "Author",
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

function review(bookId: string, updatedAt: string, rating = 4): BookReview {
  return {
    bookId,
    rating,
    favorite: false,
    tags: [],
    mood: "",
    createdAt: updatedAt,
    updatedAt,
  }
}

function progress(bookId: string, lastReadDate: string, currentPage = 0): ReadingProgress {
  return {
    bookId,
    book: book(bookId),
    currentPage,
    totalPages: 100,
    startedDate: "2026-01-01T00:00:00.000Z",
    lastReadDate,
    timeSpentMinutes: 0,
    status: "reading",
  }
}

describe("isLocalNewer", () => {
  it("pushes when cloud has no value", () => {
    expect(isLocalNewer("2026-01-02T00:00:00Z", undefined)).toBe(true)
  })

  it("does not overwrite cloud when local has no timestamp", () => {
    expect(isLocalNewer(undefined, "2026-01-02T00:00:00Z")).toBe(false)
  })

  it("local strictly newer wins", () => {
    expect(isLocalNewer("2026-01-03T00:00:00Z", "2026-01-02T00:00:00Z")).toBe(true)
  })

  it("equal timestamps do NOT count as newer (no clobber on tie)", () => {
    const t = "2026-01-02T00:00:00Z"
    expect(isLocalNewer(t, t)).toBe(false)
  })

  it("older local loses", () => {
    expect(isLocalNewer("2026-01-01T00:00:00Z", "2026-01-02T00:00:00Z")).toBe(false)
  })

  it("unparseable local time does not clobber valid cloud", () => {
    expect(isLocalNewer("not-a-date", "2026-01-02T00:00:00Z")).toBe(false)
  })

  it("valid local beats unparseable cloud", () => {
    expect(isLocalNewer("2026-01-02T00:00:00Z", "garbage")).toBe(true)
  })
})

describe("mergeLikedBooks", () => {
  it("unions disjoint sets", () => {
    const merged = mergeLikedBooks([book("a")], [book("b")])
    expect(merged.map((b) => b.id).sort()).toEqual(["a", "b"])
  })

  it("does not duplicate a book present on both sides", () => {
    const merged = mergeLikedBooks([book("a"), book("b")], [book("b"), book("c")])
    expect(merged.map((b) => b.id).sort()).toEqual(["a", "b", "c"])
  })

  it("local entry wins on duplicate id (keeps richer client fields)", () => {
    const localA = { ...book("a"), title: "LOCAL TITLE" }
    const cloudA = { ...book("a"), title: "cloud title" }
    const merged = mergeLikedBooks([localA], [cloudA])
    expect(merged).toHaveLength(1)
    expect(merged[0].title).toBe("LOCAL TITLE")
  })

  it("never loses a cloud-only book (the original push-only bug)", () => {
    const merged = mergeLikedBooks([], [book("from-other-device")])
    expect(merged.map((b) => b.id)).toContain("from-other-device")
  })
})

describe("mergeReviewsByNewer", () => {
  it("keeps the newer review per book", () => {
    const local = [review("a", "2026-01-01T00:00:00Z", 2)]
    const cloud = [review("a", "2026-01-05T00:00:00Z", 5)]
    const merged = mergeReviewsByNewer(local, cloud)
    expect(merged).toHaveLength(1)
    expect(merged[0].rating).toBe(5)
  })

  it("keeps local when it is newer than cloud", () => {
    const local = [review("a", "2026-01-10T00:00:00Z", 2)]
    const cloud = [review("a", "2026-01-05T00:00:00Z", 5)]
    expect(mergeReviewsByNewer(local, cloud)[0].rating).toBe(2)
  })

  it("adds cloud-only reviews", () => {
    const merged = mergeReviewsByNewer([review("a", "2026-01-01T00:00:00Z")], [review("b", "2026-01-01T00:00:00Z")])
    expect(merged.map((r) => r.bookId).sort()).toEqual(["a", "b"])
  })

  it("does not clobber local on an equal timestamp", () => {
    const t = "2026-01-01T00:00:00Z"
    const merged = mergeReviewsByNewer([review("a", t, 2)], [review("a", t, 5)])
    expect(merged[0].rating).toBe(2)
  })
})

describe("mergeProgressByNewer", () => {
  it("keeps the row with the newer lastReadDate", () => {
    const local = [progress("a", "2026-01-01T00:00:00Z", 10)]
    const cloud = [progress("a", "2026-02-01T00:00:00Z", 99)]
    expect(mergeProgressByNewer(local, cloud)[0].currentPage).toBe(99)
  })

  it("does not regress a further-along local read", () => {
    const local = [progress("a", "2026-03-01T00:00:00Z", 250)]
    const cloud = [progress("a", "2026-02-01T00:00:00Z", 99)]
    expect(mergeProgressByNewer(local, cloud)[0].currentPage).toBe(250)
  })

  it("pulls a cloud-only progress row (was never pulled before the fix)", () => {
    const merged = mergeProgressByNewer([], [progress("a", "2026-02-01T00:00:00Z", 42)])
    expect(merged).toHaveLength(1)
    expect(merged[0].currentPage).toBe(42)
  })
})

function shelf(id: string, name = id): Shelf {
  return { id, name, emoji: "📚", isDefault: false, createdAt: "2026-01-01T00:00:00Z" }
}
function assignment(bookId: string, shelfId: string): BookShelfAssignment {
  return { bookId, shelfId, addedAt: "2026-01-01T00:00:00Z" }
}

describe("mergeShelves", () => {
  it("unions custom shelves by id", () => {
    const merged = mergeShelves([shelf("summer")], [shelf("winter")])
    expect(merged.map((s) => s.id).sort()).toEqual(["summer", "winter"])
  })

  it("local definition wins on duplicate id", () => {
    const merged = mergeShelves([shelf("x", "LOCAL")], [shelf("x", "cloud")])
    expect(merged).toHaveLength(1)
    expect(merged[0].name).toBe("LOCAL")
  })

  it("pulls a cloud-only shelf", () => {
    const merged = mergeShelves([], [shelf("from-other-device")])
    expect(merged.map((s) => s.id)).toContain("from-other-device")
  })
})

describe("mergeShelfAssignments", () => {
  it("unions by (bookId, shelfId)", () => {
    const merged = mergeShelfAssignments([assignment("b1", "summer")], [assignment("b1", "winter")])
    expect(merged).toHaveLength(2)
  })

  it("does not duplicate the same book+shelf pair", () => {
    const merged = mergeShelfAssignments([assignment("b1", "summer")], [assignment("b1", "summer")])
    expect(merged).toHaveLength(1)
  })

  it("keeps a book on multiple shelves across devices (the model the cloud column couldn't)", () => {
    const local = [assignment("b1", "summer")]
    const cloud = [assignment("b1", "winter"), assignment("b1", "favorites")]
    const merged = mergeShelfAssignments(local, cloud)
    expect(merged.filter((a) => a.bookId === "b1").map((a) => a.shelfId).sort()).toEqual([
      "favorites",
      "summer",
      "winter",
    ])
  })
})
