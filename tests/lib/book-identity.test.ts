import { describe, it, expect } from "vitest"
import { bookIdentity, mergeDuplicates, idsFor, matchesId } from "@/lib/book-identity"
import type { Book } from "@/lib/book-data"

const make = (over: Partial<Book>): Book => ({
  id: "x",
  title: "T",
  author: "A",
  cover: "",
  rating: 0,
  pages: 0,
  genre: [],
  mood: [],
  description: "",
  publishedYear: 0,
  readingTime: "",
  formats: { ebook: true, audiobook: false, paperback: true },
  metadata: { source: "google" },
  ...over,
} as Book)

describe("bookIdentity", () => {
  it("matches the same work across sources", () => {
    expect(bookIdentity({ title: "Project Hail Mary", author: "Andy Weir" }))
      .toBe(bookIdentity({ title: "project hail mary", author: "Weir, Andy" }))
  })

  it("ignores edition subtitles", () => {
    expect(bookIdentity({ title: "Circe: A Novel", author: "Madeline Miller" }))
      .toBe(bookIdentity({ title: "Circe", author: "Madeline Miller" }))
  })

  it("does NOT collapse different books by same-surname authors", () => {
    expect(bookIdentity({ title: "It", author: "Stephen King" }))
      .not.toBe(bookIdentity({ title: "Joyland", author: "Stephen King" }))
  })

  it("does not collapse different authors of the same title", () => {
    expect(bookIdentity({ title: "Beloved", author: "Toni Morrison" }))
      .not.toBe(bookIdentity({ title: "Beloved", author: "Sarah Waters" }))
  })
})

describe("mergeDuplicates", () => {
  const rich = make({
    id: "gb1",
    title: "Project Hail Mary",
    author: "Andy Weir",
    description: "x".repeat(220),
    rating: 4.5,
    pages: 496,
    metadata: { source: "google", ratingsCount: 900 },
  })
  const poor = make({
    id: "ol_1",
    title: "Project Hail Mary",
    author: "Weir, Andy",
    description: "",
    metadata: { source: "openlibrary", ratingEstimated: true },
  })

  it("folds duplicates into one record", () => {
    expect(mergeDuplicates([rich, poor])).toHaveLength(1)
  })

  it("keeps the richer record regardless of order", () => {
    expect(mergeDuplicates([rich, poor])[0].id).toBe("gb1")
    expect(mergeDuplicates([poor, rich])[0].id).toBe("gb1")
  })

  it("carries the dropped id so a saved book still resolves", () => {
    const [merged] = mergeDuplicates([rich, poor])
    expect(merged.aliasIds).toContain("ol_1")
    expect(idsFor(merged)).toEqual(expect.arrayContaining(["gb1", "ol_1"]))
    expect(matchesId(merged, "ol_1")).toBe(true)
  })

  it("never lists its own id as an alias", () => {
    const [merged] = mergeDuplicates([rich, poor])
    expect(merged.aliasIds).not.toContain("gb1")
  })

  it("leaves distinct books alone", () => {
    const other = make({ id: "z", title: "Dune", author: "Frank Herbert" })
    expect(mergeDuplicates([rich, other])).toHaveLength(2)
  })

  it("survives three-way duplicates and accumulates every alias", () => {
    const third = make({ id: "seed_1", title: "Project Hail Mary", author: "Andy Weir" })
    const [merged] = mergeDuplicates([poor, rich, third])
    expect(merged.id).toBe("gb1")
    expect(merged.aliasIds).toEqual(expect.arrayContaining(["ol_1", "seed_1"]))
  })

  it("skips records with no title or author rather than grouping them", () => {
    const broken = make({ id: "b", title: "", author: "" })
    expect(mergeDuplicates([rich, broken])).toHaveLength(1)
  })
})
