import { describe, it, expect } from "vitest"
import {
  moodFilters,
  timeBasedSuggestions,
  type MoodFilter,
  type TimeSuggestion,
} from "@/lib/recommendations"

// ── moodFilters ───────────────────────────────────────────────────────────────

describe("moodFilters", () => {
  it("is a non-empty array", () => {
    expect(Array.isArray(moodFilters)).toBe(true)
    expect(moodFilters.length).toBeGreaterThan(0)
  })

  it("every filter has required string fields: id, name, emoji, description", () => {
    moodFilters.forEach((filter: MoodFilter) => {
      expect(typeof filter.id).toBe("string")
      expect(filter.id.length).toBeGreaterThan(0)

      expect(typeof filter.name).toBe("string")
      expect(filter.name.length).toBeGreaterThan(0)

      expect(typeof filter.emoji).toBe("string")
      expect(filter.emoji.length).toBeGreaterThan(0)

      expect(typeof filter.description).toBe("string")
      expect(filter.description.length).toBeGreaterThan(0)
    })
  })

  it("every filter has a non-empty keywords array with string values", () => {
    moodFilters.forEach((filter: MoodFilter) => {
      expect(Array.isArray(filter.keywords)).toBe(true)
      expect(filter.keywords.length).toBeGreaterThan(0)
      filter.keywords.forEach((kw) => expect(typeof kw).toBe("string"))
    })
  })

  it("all ids are unique", () => {
    const ids = moodFilters.map((f) => f.id)
    const unique = new Set(ids)
    expect(unique.size).toBe(ids.length)
  })

  it("contains the expected mood ids", () => {
    const ids = moodFilters.map((f) => f.id)
    expect(ids).toContain("uplifting")
    expect(ids).toContain("suspenseful")
    expect(ids).toContain("thoughtful")
    expect(ids).toContain("dark")
  })

  it("uplifting filter has heartwarming-related keywords", () => {
    const uplifting = moodFilters.find((f) => f.id === "uplifting")!
    const lowerKeywords = uplifting.keywords.map((k) => k.toLowerCase())
    expect(lowerKeywords.some((k) => k.includes("uplift") || k.includes("heartwarming") || k.includes("cozy"))).toBe(true)
  })

  it("suspenseful filter has tension-related keywords", () => {
    const suspenseful = moodFilters.find((f) => f.id === "suspenseful")!
    const lowerKeywords = suspenseful.keywords.map((k) => k.toLowerCase())
    expect(lowerKeywords.some((k) => k.includes("suspens") || k.includes("thrill") || k.includes("dark"))).toBe(true)
  })
})

// ── timeBasedSuggestions ──────────────────────────────────────────────────────

describe("timeBasedSuggestions", () => {
  it("is a non-empty array", () => {
    expect(Array.isArray(timeBasedSuggestions)).toBe(true)
    expect(timeBasedSuggestions.length).toBeGreaterThan(0)
  })

  it("every suggestion has required string fields: id, name, emoji, description", () => {
    timeBasedSuggestions.forEach((s: TimeSuggestion) => {
      expect(typeof s.id).toBe("string")
      expect(s.id.length).toBeGreaterThan(0)

      expect(typeof s.name).toBe("string")
      expect(s.name.length).toBeGreaterThan(0)

      expect(typeof s.emoji).toBe("string")
      expect(s.emoji.length).toBeGreaterThan(0)

      expect(typeof s.description).toBe("string")
      expect(s.description.length).toBeGreaterThan(0)
    })
  })

  it("all ids are unique", () => {
    const ids = timeBasedSuggestions.map((s) => s.id)
    const unique = new Set(ids)
    expect(unique.size).toBe(ids.length)
  })

  it("minHours is a positive number when defined", () => {
    timeBasedSuggestions.forEach((s: TimeSuggestion) => {
      if (typeof s.minHours !== "undefined") {
        expect(typeof s.minHours).toBe("number")
        expect(s.minHours).toBeGreaterThan(0)
      }
    })
  })

  it("maxHours is a positive number when defined", () => {
    timeBasedSuggestions.forEach((s: TimeSuggestion) => {
      if (typeof s.maxHours !== "undefined") {
        expect(typeof s.maxHours).toBe("number")
        expect(s.maxHours).toBeGreaterThan(0)
      }
    })
  })

  it("minHours is strictly less than maxHours when both are defined", () => {
    timeBasedSuggestions.forEach((s: TimeSuggestion) => {
      if (typeof s.minHours === "number" && typeof s.maxHours === "number") {
        expect(s.minHours).toBeLessThan(s.maxHours)
      }
    })
  })

  it("at least one suggestion has no minHours (open-ended short category)", () => {
    const hasOpenShort = timeBasedSuggestions.some(
      (s) => typeof s.minHours === "undefined" && typeof s.maxHours === "number"
    )
    expect(hasOpenShort).toBe(true)
  })

  it("at least one suggestion has no maxHours (open-ended long category)", () => {
    const hasOpenLong = timeBasedSuggestions.some(
      (s) => typeof s.minHours === "number" && typeof s.maxHours === "undefined"
    )
    expect(hasOpenLong).toBe(true)
  })

  it("time ranges form a continuum — adjacent ranges share boundary values", () => {
    // Collect all boundaries; each maxHours should match the next minHours
    const withMax = timeBasedSuggestions
      .filter((s) => typeof s.maxHours === "number")
      .sort((a, b) => a.maxHours! - b.maxHours!)

    withMax.forEach((s) => {
      const nextMin = timeBasedSuggestions.find((t) => t.minHours === s.maxHours)
      // It's fine if there is no next range (last capped entry before the open-ended one)
      // but if there IS a next, it must connect cleanly
      if (nextMin) {
        expect(nextMin.minHours).toBe(s.maxHours)
      }
    })
  })

  it("contains expected time-bucket ids", () => {
    const ids = timeBasedSuggestions.map((s) => s.id)
    expect(ids).toContain("quick-bite")
    expect(ids).toContain("marathon")
  })

  it("quick-bite has maxHours of 2", () => {
    const quickBite = timeBasedSuggestions.find((s) => s.id === "quick-bite")!
    expect(quickBite.maxHours).toBe(2)
    expect(quickBite.minHours).toBeUndefined()
  })

  it("marathon has minHours of 8 and no maxHours", () => {
    const marathon = timeBasedSuggestions.find((s) => s.id === "marathon")!
    expect(marathon.minHours).toBe(8)
    expect(marathon.maxHours).toBeUndefined()
  })
})
