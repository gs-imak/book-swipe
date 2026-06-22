import { describe, it, expect, beforeEach } from "vitest"
import { runStorageMigrations, saveReadingPosition, getReadingPosition, mergeReadingPositions, getGenreOffset, advanceGenreOffset } from "@/lib/storage"
import { STORAGE_KEYS, STORAGE_SCHEMA_VERSION } from "@/lib/storage-keys"

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

describe("runStorageMigrations", () => {
  it("stamps the current schema version on a fresh (version 0) install", () => {
    expect(store[STORAGE_KEYS.SCHEMA_VERSION]).toBeUndefined()
    runStorageMigrations()
    expect(store[STORAGE_KEYS.SCHEMA_VERSION]).toBe(String(STORAGE_SCHEMA_VERSION))
  })

  it("is idempotent — running twice keeps the current version", () => {
    runStorageMigrations()
    runStorageMigrations()
    expect(store[STORAGE_KEYS.SCHEMA_VERSION]).toBe(String(STORAGE_SCHEMA_VERSION))
  })

  it("does not downgrade a future version", () => {
    store[STORAGE_KEYS.SCHEMA_VERSION] = String(STORAGE_SCHEMA_VERSION + 5)
    runStorageMigrations()
    expect(store[STORAGE_KEYS.SCHEMA_VERSION]).toBe(String(STORAGE_SCHEMA_VERSION + 5))
  })
})

describe("mergeReadingPositions (furthest-wins cross-device sync)", () => {
  it("adopts a cloud position when local has none", () => {
    mergeReadingPositions({ "book-a": 500 })
    expect(getReadingPosition("book-a")).toBe(500)
  })

  it("keeps the furthest (larger) offset per book", () => {
    saveReadingPosition("book-b", 800)
    mergeReadingPositions({ "book-b": 300 }) // cloud is behind local
    expect(getReadingPosition("book-b")).toBe(800)
    mergeReadingPositions({ "book-b": 1200 }) // cloud is ahead
    expect(getReadingPosition("book-b")).toBe(1200)
  })

  it("returns whether anything changed", () => {
    saveReadingPosition("book-c", 1000)
    expect(mergeReadingPositions({ "book-c": 500 })).toBe(false)
    expect(mergeReadingPositions({ "book-c": 1500 })).toBe(true)
  })
})

describe("genre pagination offsets (deeper-each-session book supply)", () => {
  it("starts at 0 and advances by the step", () => {
    expect(getGenreOffset("fantasy")).toBe(0)
    advanceGenreOffset("fantasy", 40)
    advanceGenreOffset("fantasy", 40)
    expect(getGenreOffset("fantasy")).toBe(80)
  })

  it("is case-insensitive", () => {
    advanceGenreOffset("Mystery", 24)
    expect(getGenreOffset("mystery")).toBe(24)
  })

  it("wraps below the max so it cycles the catalog instead of overflowing", () => {
    for (let i = 0; i < 20; i++) advanceGenreOffset("scifi", 40) // 800 → wraps
    const off = getGenreOffset("scifi")
    expect(off).toBeGreaterThanOrEqual(0)
    expect(off).toBeLessThan(560)
  })

  it("ignores non-positive steps", () => {
    advanceGenreOffset("horror", 40)
    advanceGenreOffset("horror", 0)
    advanceGenreOffset("horror", -10)
    expect(getGenreOffset("horror")).toBe(40)
  })
})
