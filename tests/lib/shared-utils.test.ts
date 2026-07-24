import { describe, it, expect } from "vitest"
import { stableRating } from "@/lib/stable-rating"
import { estimateReadingTimeRange } from "@/lib/reading-time"

describe("stableRating", () => {
  it("is deterministic for the same seed", () => {
    expect(stableRating("Dune:Frank Herbert")).toBe(stableRating("Dune:Frank Herbert"))
  })

  it("stays within the given bounds", () => {
    for (const seed of ["a", "The Midnight Library:Matt Haig", "x".repeat(200)]) {
      const r = stableRating(seed)
      expect(r).toBeGreaterThanOrEqual(3.5)
      expect(r).toBeLessThanOrEqual(4.5)
      const custom = stableRating(seed, 3.8, 4.8)
      expect(custom).toBeGreaterThanOrEqual(3.8)
      expect(custom).toBeLessThanOrEqual(4.8)
    }
  })

  it("rounds to one decimal", () => {
    const r = stableRating("some seed")
    expect(r).toBe(Math.round(r * 10) / 10)
  })
})

describe("estimateReadingTimeRange", () => {
  it("returns the catalog bucket strings the time filters parse", () => {
    // hours = ceil(pages / 60) at the fixed average speed
    expect(estimateReadingTimeRange(60)).toBe("1-2 hours")
    expect(estimateReadingTimeRange(100)).toBe("2-4 hours")
    expect(estimateReadingTimeRange(300)).toBe("4-6 hours")
    expect(estimateReadingTimeRange(400)).toBe("6-8 hours")
    expect(estimateReadingTimeRange(600)).toBe("8-12 hours")
    expect(estimateReadingTimeRange(900)).toBe("12+ hours")
  })
})
