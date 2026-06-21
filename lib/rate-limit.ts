import type { NextRequest } from "next/server"

// Shared rate limiting for the API proxy routes.
//
// Two backends, chosen at runtime:
//  1. Upstash Redis (REST) — when UPSTASH_REDIS_REST_URL + UPSTASH_REDIS_REST_TOKEN
//     are set. A fixed-window counter that IS shared across all serverless
//     instances/regions, so the limit actually holds under real traffic. No SDK
//     dependency — plain fetch to the Upstash REST API.
//  2. In-memory fallback — per-instance Map. Best-effort only (the previous
//     behavior): blunts hammering from a single warm instance, nothing more.
//
// Fails OPEN: if Upstash errors or is unreachable, requests are allowed rather
// than taking the app down because the rate-limit store hiccuped.

const UPSTASH_URL = process.env.UPSTASH_REDIS_REST_URL
const UPSTASH_TOKEN = process.env.UPSTASH_REDIS_REST_TOKEN
const upstashConfigured = Boolean(UPSTASH_URL && UPSTASH_TOKEN)

/**
 * Most-trustworthy client IP available. On Vercel `x-real-ip` is set by the edge
 * and is harder to spoof than the client-supplied left-most `x-forwarded-for`.
 * Falls back to the first XFF hop, then "unknown", so it degrades rather than
 * failing per-request. Not fully trustworthy without a verified proxy chain.
 */
export function getClientIp(request: NextRequest): string {
  const realIp = request.headers.get("x-real-ip")?.trim()
  if (realIp) return realIp
  const forwarded = request.headers.get("x-forwarded-for")?.split(",")[0]?.trim()
  if (forwarded) return forwarded
  return "unknown"
}

// ── In-memory fallback ───────────────────────────────────────────────────────

const memoryStore = new Map<string, { count: number; resetAt: number }>()

function checkMemory(key: string, limit: number, windowMs: number): boolean {
  const now = Date.now()
  // Opportunistic cleanup of expired entries (no setInterval in serverless).
  if (memoryStore.size > 5000) {
    memoryStore.forEach((v, k) => {
      if (now > v.resetAt) memoryStore.delete(k)
    })
  }
  const entry = memoryStore.get(key)
  if (!entry || now > entry.resetAt) {
    memoryStore.set(key, { count: 1, resetAt: now + windowMs })
    return true
  }
  if (entry.count >= limit) return false
  entry.count++
  return true
}

// ── Upstash REST (shared, durable) ───────────────────────────────────────────

async function checkUpstash(key: string, limit: number, windowMs: number): Promise<boolean> {
  // Pipeline: INCR the counter, and set its TTL only if it has none yet (NX), so
  // each fixed window expires ~windowMs after its first request.
  const res = await fetch(`${UPSTASH_URL}/pipeline`, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${UPSTASH_TOKEN}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify([
      ["INCR", key],
      ["PEXPIRE", key, windowMs, "NX"],
    ]),
    // Never cache a rate-limit write.
    cache: "no-store",
  })
  if (!res.ok) throw new Error(`Upstash ${res.status}`)
  const data = (await res.json()) as Array<{ result: number }>
  const count = data?.[0]?.result ?? 0
  return count <= limit
}

export interface RateLimitOptions {
  /** Max requests per window. */
  limit: number
  /** Window length in ms. */
  windowMs: number
  /** Namespace so different routes don't share a counter. */
  prefix: string
}

/**
 * Returns true if the request is allowed. Uses Upstash when configured (shared
 * across instances), otherwise the per-instance in-memory fallback.
 */
export async function checkRateLimit(
  identifier: string,
  { limit, windowMs, prefix }: RateLimitOptions,
): Promise<boolean> {
  const key = `ratelimit:${prefix}:${identifier}`
  if (upstashConfigured) {
    try {
      return await checkUpstash(key, limit, windowMs)
    } catch (err) {
      // Fail open — don't break the route if the limiter store is down.
      console.warn("[BookSwipe] Upstash rate-limit failed, allowing:", String(err))
      return true
    }
  }
  return checkMemory(key, limit, windowMs)
}

/** Whether the durable (shared) limiter is active. Useful for diagnostics. */
export function isDistributedRateLimitEnabled(): boolean {
  return upstashConfigured
}
