import { describe, it, expect } from "vitest"
import { buildFeatureString, buildUserProfile, scoreBooks } from "@/lib/scoring-engine"
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
    description: "A test book about testing things.",
    publishedYear: 2023,
    readingTime: "4-6 hours",
    ...overrides,
  }
}

describe("buildFeatureString", () => {
  it("includes title, author, genres, and moods", () => {
    const book = makeBook({
      title: "Dune",
      author: "Frank Herbert",
      genre: ["Science Fiction", "Adventure"],
      mood: ["Epic", "Suspenseful"],
    })
    const feature = buildFeatureString(book)

    expect(feature).toContain("dune")
    expect(feature).toContain("frank herbert")
    expect(feature).toContain("science fiction")
    expect(feature).toContain("adventure")
    expect(feature).toContain("epic")
    expect(feature).toContain("suspenseful")
  })

  it("weights genres higher by repeating them", () => {
    const book = makeBook({ genre: ["Fantasy"] })
    const feature = buildFeatureString(book)
    const matches = feature.match(/fantasy/g)
    expect(matches?.length).toBeGreaterThanOrEqual(3)
  })
})

describe("buildUserProfile", () => {
  it("returns empty string for no liked books", () => {
    expect(buildUserProfile([])).toBe("")
  })

  it("includes features from liked books", () => {
    const liked = [makeBook({ genre: ["Mystery", "Thriller"], mood: ["Suspenseful"] })]
    const profile = buildUserProfile(liked)
    expect(profile).toContain("mystery")
    expect(profile).toContain("thriller")
    expect(profile).toContain("suspenseful")
  })
})

describe("scoreBooks", () => {
  it("returns empty array when no liked books", () => {
    const candidates = [makeBook()]
    expect(scoreBooks(candidates, [])).toEqual([])
  })

  it("returns empty array when no candidates", () => {
    const liked = [makeBook()]
    expect(scoreBooks([], liked)).toEqual([])
  })

  it("scores matching-genre books higher than mismatched ones", () => {
    const liked = [
      makeBook({ id: "liked-1", genre: ["Fantasy"], mood: ["Epic"], description: "An epic fantasy adventure with magic and dragons." }),
    ]
    const matchingBook = makeBook({
      id: "match",
      genre: ["Fantasy"],
      mood: ["Epic"],
      description: "A magical fantasy tale with wizards and quests.",
    })
    const mismatchBook = makeBook({
      id: "mismatch",
      genre: ["Romance"],
      mood: ["Lighthearted"],
      description: "A lighthearted romantic comedy about dating.",
    })

    const results = scoreBooks([matchingBook, mismatchBook], liked)
    expect(results.length).toBe(2)
    expect(results[0].book.id).toBe("match")
    expect(results[0].finalScore).toBeGreaterThan(results[1].finalScore)
  })

  it("excludes books by ID when excludeIds is provided", () => {
    const liked = [makeBook({ id: "liked-1" })]
    const candidates = [
      makeBook({ id: "keep" }),
      makeBook({ id: "exclude" }),
    ]
    const excludeIds = new Set(["exclude"])
    const results = scoreBooks(candidates, liked, { excludeIds })
    expect(results.length).toBe(1)
    expect(results[0].book.id).toBe("keep")
  })
})
