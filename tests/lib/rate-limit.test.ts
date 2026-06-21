import { describe, it, expect } from "vitest"
import { checkRateLimit, isDistributedRateLimitEnabled } from "@/lib/rate-limit"

// With no UPSTASH_* env, checkRateLimit uses the in-memory fixed-window fallback.
// The store is module-global, so each test uses a unique prefix/identifier to
// stay isolated.

describe("checkRateLimit (in-memory fallback)", () => {
  it("uses the in-memory fallback when Upstash is not configured", () => {
    expect(isDistributedRateLimitEnabled()).toBe(false)
  })

  it("allows up to the limit then blocks", async () => {
    const opts = { limit: 3, windowMs: 60_000, prefix: "t1" }
    expect(await checkRateLimit("ip-a", opts)).toBe(true)
    expect(await checkRateLimit("ip-a", opts)).toBe(true)
    expect(await checkRateLimit("ip-a", opts)).toBe(true)
    expect(await checkRateLimit("ip-a", opts)).toBe(false) // 4th over limit 3
  })

  it("tracks identifiers independently", async () => {
    const opts = { limit: 1, windowMs: 60_000, prefix: "t2" }
    expect(await checkRateLimit("ip-x", opts)).toBe(true)
    expect(await checkRateLimit("ip-x", opts)).toBe(false)
    // Different IP has its own bucket.
    expect(await checkRateLimit("ip-y", opts)).toBe(true)
  })

  it("separates buckets by prefix (different routes don't share a counter)", async () => {
    const id = "shared-ip"
    expect(await checkRateLimit(id, { limit: 1, windowMs: 60_000, prefix: "books" })).toBe(true)
    expect(await checkRateLimit(id, { limit: 1, windowMs: 60_000, prefix: "books" })).toBe(false)
    // Same IP, different route prefix → fresh bucket.
    expect(await checkRateLimit(id, { limit: 1, windowMs: 60_000, prefix: "openlibrary" })).toBe(true)
  })

  it("resets after the window elapses", async () => {
    const opts = { limit: 1, windowMs: 40, prefix: "t3" }
    expect(await checkRateLimit("ip-z", opts)).toBe(true)
    expect(await checkRateLimit("ip-z", opts)).toBe(false)
    await new Promise((r) => setTimeout(r, 60))
    expect(await checkRateLimit("ip-z", opts)).toBe(true)
  })
})
