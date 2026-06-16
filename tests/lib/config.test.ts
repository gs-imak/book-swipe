import { describe, it, expect } from "vitest"
import {
  MAX_DECK_SIZE,
  MAX_CACHE_SIZE,
  CACHE_TTL_MS,
  API_RATE_LIMIT,
  API_RATE_WINDOW_MS,
  SEARCH_DEBOUNCE_MS,
  SEARCH_MAX_RESULTS,
} from "@/lib/config"

describe("config constants — all values must be positive numbers", () => {
  const constants: [string, number][] = [
    ["MAX_DECK_SIZE", MAX_DECK_SIZE],
    ["MAX_CACHE_SIZE", MAX_CACHE_SIZE],
    ["CACHE_TTL_MS", CACHE_TTL_MS],
    ["API_RATE_LIMIT", API_RATE_LIMIT],
    ["API_RATE_WINDOW_MS", API_RATE_WINDOW_MS],
    ["SEARCH_DEBOUNCE_MS", SEARCH_DEBOUNCE_MS],
    ["SEARCH_MAX_RESULTS", SEARCH_MAX_RESULTS],
  ]

  constants.forEach(([name, value]) => {
    it(`${name} is a positive finite number`, () => {
      expect(typeof value).toBe("number")
      expect(Number.isFinite(value)).toBe(true)
      expect(value).toBeGreaterThan(0)
    })
  })
})

describe("config relationships", () => {
  it("MAX_CACHE_SIZE is greater than MAX_DECK_SIZE", () => {
    expect(MAX_CACHE_SIZE).toBeGreaterThan(MAX_DECK_SIZE)
  })

  it("CACHE_TTL_MS represents at least one hour", () => {
    const ONE_HOUR_MS = 60 * 60 * 1000
    expect(CACHE_TTL_MS).toBeGreaterThanOrEqual(ONE_HOUR_MS)
  })

  it("SEARCH_MAX_RESULTS is a reasonable display count (1–200)", () => {
    expect(SEARCH_MAX_RESULTS).toBeGreaterThanOrEqual(1)
    expect(SEARCH_MAX_RESULTS).toBeLessThanOrEqual(200)
  })

  it("API_RATE_LIMIT is a whole number", () => {
    expect(Number.isInteger(API_RATE_LIMIT)).toBe(true)
  })
})
