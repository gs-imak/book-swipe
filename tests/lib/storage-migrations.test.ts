import { describe, it, expect, beforeEach } from "vitest"
import { runStorageMigrations } from "@/lib/storage"
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
