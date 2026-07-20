import { describe, it, expect, beforeEach } from "vitest"
import { buildFeatureString, buildUserProfile, scoreBooks, applyMMR } from "@/lib/scoring-engine"
import { addPassedBookId } from "@/lib/storage"
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

// Shared fixture: a liked book with a distinctive vocabulary so candidate
// overlap is fully controlled by each test.
function likedFantasy(): Book[] {
  return [
    makeBook({
      id: "liked-fantasy",
      title: "Dragon Crown",
      author: "Liked Writer",
      genre: ["Fantasy"],
      mood: ["Epic"],
      description: "dragon magic kingdom quest wizard",
    }),
  ]
}

describe("novelty bonus", () => {
  beforeEach(() => localStorage.clear())

  it("boosts fully-unexplored well-rated books over unexplored low-rated ones", () => {
    const novelHigh = makeBook({
      id: "novel-high", title: "Ocean Currents", author: "Marine Writer",
      genre: ["Oceanography"], mood: ["Calm"], rating: 4.5,
      description: "tides currents saltwater reefs plankton",
    })
    const novelLow = makeBook({
      id: "novel-low", title: "Volcano Basics", author: "Rock Writer",
      genre: ["Geology"], mood: ["Grounded"], rating: 3.0,
      description: "lava eruptions tectonic craters basalt",
    })
    const results = scoreBooks([novelHigh, novelLow], likedFantasy())
    const high = results.find((r) => r.book.id === "novel-high")!
    const low = results.find((r) => r.book.id === "novel-low")!
    // Zero content overlap with the profile — the score gap is the bonus itself
    expect(high.finalScore).toBeGreaterThan(low.finalScore)
    expect(high.finalScore).toBeGreaterThanOrEqual(0.04)
    expect(low.finalScore).toBeLessThan(0.04)
  })

  it("gives no novelty bonus when any genre is already explored", () => {
    // Identical feature text, only the rating differs. Under the old `some()`
    // logic the high-rated one got a flat +0.05 for its single unfamiliar
    // genre string; now neither counts as novel (Fantasy is explored).
    const partialHigh = makeBook({
      id: "partial-high", title: "Castle Winds", author: "Quimble Nord",
      genre: ["Fantasy", "Zorbified Studies"], mood: ["Calm"], rating: 4.5,
      description: "storm castle wanderer",
    })
    const partialLow = makeBook({
      id: "partial-low", title: "Castle Winds", author: "Quimble Nord",
      genre: ["Fantasy", "Zorbified Studies"], mood: ["Calm"], rating: 3.4,
      description: "storm castle wanderer",
    })
    const results = scoreBooks([partialHigh, partialLow], likedFantasy())
    const high = results.find((r) => r.book.id === "partial-high")!
    const low = results.find((r) => r.book.id === "partial-low")!
    expect(Math.abs(high.finalScore - low.finalScore)).toBeLessThan(0.04)
  })
})

describe("estimated ratings", () => {
  beforeEach(() => localStorage.clear())

  it("real high rating outscores an identical book with an estimated one", () => {
    const real = makeBook({
      id: "real-rated", title: "Dragon Storm", author: "Quimble Nord",
      genre: ["Fantasy"], mood: ["Epic"], rating: 4.5,
      description: "dragon magic castle",
    })
    const estimated = makeBook({
      id: "estimated-rated", title: "Dragon Storm", author: "Quimble Nord",
      genre: ["Fantasy"], mood: ["Epic"], rating: 4.5,
      description: "dragon magic castle",
      metadata: { source: "google", ratingEstimated: true },
    })
    // Filler keeps shared terms below the every-document IDF cutoff
    const filler = makeBook({
      id: "filler", title: "Volcano Basics", author: "Rock Writer",
      genre: ["Geology"], mood: ["Grounded"], rating: 3.5,
      description: "lava eruptions tectonic craters",
    })
    const results = scoreBooks([real, estimated, filler], likedFantasy())
    const realScored = results.find((r) => r.book.id === "real-rated")!
    const estScored = results.find((r) => r.book.id === "estimated-rated")!
    expect(realScored.finalScore).toBeGreaterThan(estScored.finalScore)
    // And no "highly rated" claim may be generated from a fabricated number
    expect(estScored.reasons.find((r) => r.type === "rating")).toBeUndefined()
  })
})

describe("applyMMR content diversity", () => {
  beforeEach(() => localStorage.clear())

  it("skips a near-duplicate even when genre labels don't overlap", () => {
    const liked = [
      makeBook({
        id: "liked-mixed", title: "Mixed Tastes", author: "Liked Writer",
        genre: ["Fantasy", "Romance"], mood: ["Epic", "Romantic"],
        description: "dragon magic kingdom quest wizard romance love wedding paris",
      }),
    ]
    const a = makeBook({
      id: "A", title: "Dragon Tower", author: "Author One",
      genre: ["Fantasy"], mood: ["Epic"], rating: 3.5,
      description: "dragon magic kingdom quest wizard tower",
    })
    // Near-duplicate of A in CONTENT, but no genre-string overlap with it —
    // the old genre-based MMR approximation saw zero similarity here.
    const b = makeBook({
      id: "B", title: "Dragon Castle", author: "Author Two",
      genre: ["Epic Saga"], mood: ["Epic"], rating: 3.5,
      description: "dragon magic kingdom quest wizard castle",
    })
    const c = makeBook({
      id: "C", title: "Paris Hearts", author: "Author Three",
      genre: ["Romance"], mood: ["Romantic"], rating: 3.5,
      description: "romance love wedding paris cafe",
    })
    const scored = scoreBooks([a, b, c], liked)
    const picked = applyMMR(scored, 2, 0.7)
    const ids = picked.map((p) => p.book.id)
    expect(ids).toContain("C")
  })
})

describe("author-level negative signal", () => {
  beforeEach(() => localStorage.clear())

  it("penalizes authors the user repeatedly passes", () => {
    addPassedBookId("pass-1", undefined, undefined, "Zorblax Vex")
    addPassedBookId("pass-2", undefined, undefined, "Zorblax Vex")
    addPassedBookId("pass-3", undefined, undefined, "Zorblax Vex")

    const passedAuthor = makeBook({
      id: "passed-author", title: "Dragon Storm", author: "Zorblax Vex",
      genre: ["Fantasy"], mood: ["Epic"], rating: 3.5,
      description: "dragon magic castle",
    })
    const freshAuthor = makeBook({
      id: "fresh-author", title: "Dragon Storm", author: "Quimble Nord",
      genre: ["Fantasy"], mood: ["Epic"], rating: 3.5,
      description: "dragon magic castle",
    })
    const filler = makeBook({
      id: "filler", title: "Volcano Basics", author: "Rock Writer",
      genre: ["Geology"], mood: ["Grounded"], rating: 3.5,
      description: "lava eruptions tectonic craters",
    })
    const results = scoreBooks([passedAuthor, freshAuthor, filler], likedFantasy())
    const bad = results.find((r) => r.book.id === "passed-author")!
    const good = results.find((r) => r.book.id === "fresh-author")!
    expect(good.finalScore).toBeGreaterThan(bad.finalScore)
  })
})
