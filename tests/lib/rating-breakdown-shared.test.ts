import { describe, it, expect } from "vitest"
import { toBars, polarisation, STAR_ROWS } from "@/lib/rating-breakdown-shared"

// Real distribution, read from openlibrary.org/works/OL21745884W/ratings.json
// on 2026-08-31. Hand-invented fixtures would only prove the maths against the
// shape I imagined, so the happy path is pinned to a payload the API produced.
const PROJECT_HAIL_MARY = { 1: 1, 2: 4, 3: 11, 4: 51, 5: 112 } as const

describe("toBars", () => {
  it("orders rows five stars first", () => {
    expect(toBars({ ...PROJECT_HAIL_MARY }).map((b) => b.stars)).toEqual(STAR_ROWS)
  })

  it("reports each row's share of the total", () => {
    const bars = toBars({ ...PROJECT_HAIL_MARY })
    const five = bars.find((b) => b.stars === 5)!
    // 112 of 179
    expect(five.count).toBe(112)
    expect(five.percent).toBe(63)
    expect(bars.reduce((s, b) => s + b.count, 0)).toBe(179)
  })

  it("scales bar width against the tallest row, not against 100%", () => {
    const bars = toBars({ ...PROJECT_HAIL_MARY })
    expect(bars.find((b) => b.stars === 5)!.width).toBe(100)
    // 51/112 — visible next to the peak, which a percent-of-total width
    // (28%) would flatten.
    expect(bars.find((b) => b.stars === 4)!.width).toBe(46)
  })

  it("survives an all-zero distribution without dividing by zero", () => {
    const bars = toBars({ 1: 0, 2: 0, 3: 0, 4: 0, 5: 0 })
    expect(bars.every((b) => b.percent === 0 && b.width === 0)).toBe(true)
  })
})

describe("polarisation", () => {
  it("does not call a well-liked book divisive", () => {
    const split = polarisation({ ...PROJECT_HAIL_MARY })
    expect(split.loved).toBe(63)
    expect(split.disliked).toBe(3)
    expect(split.divisive).toBe(false)
  })

  it("flags the shape an average hides", () => {
    // Average 3.4, and nobody who read it felt lukewarm about it.
    const split = polarisation({ 1: 30, 2: 5, 3: 5, 4: 10, 5: 50 })
    expect(split.loved).toBe(50)
    expect(split.disliked).toBe(35)
    expect(split.divisive).toBe(true)
  })

  it("needs both camps, not just a loud minority", () => {
    // Plenty of one-stars but no enthusiasm — a bad book, not a divisive one.
    expect(polarisation({ 1: 40, 2: 30, 3: 20, 4: 8, 5: 2 }).divisive).toBe(false)
  })

  it("returns zeroes rather than NaN with no ratings", () => {
    expect(polarisation({ 1: 0, 2: 0, 3: 0, 4: 0, 5: 0 })).toEqual({
      loved: 0,
      disliked: 0,
      divisive: false,
    })
  })
})
