"use client"

const BUDDY_KEY = "bookswipe_reading_buddies"
const MY_CODES_KEY = "bookswipe_my_buddy_codes"

export interface ReadingBuddy {
  bookId: string
  name: string
  progress: number // 0-100
  lastUpdated: string
  code: string
}

function safeGetJSON<T>(key: string, fallback: T): T {
  try {
    if (typeof window === "undefined") return fallback
    const stored = localStorage.getItem(key)
    if (!stored) return fallback
    return JSON.parse(stored) as T
  } catch {
    return fallback
  }
}

function safeSetJSON(key: string, value: unknown): void {
  try {
    if (typeof window === "undefined") return
    localStorage.setItem(key, JSON.stringify(value))
  } catch {
    // storage full — best effort
  }
}

/**
 * Base64-encode a UTF-8 string safely. `btoa` only accepts Latin1, so we
 * percent-encode first to widen the byte range to arbitrary Unicode before
 * mapping each escape sequence back to a raw byte.
 */
function utf8ToBase64(str: string): string {
  const bytes = encodeURIComponent(str).replace(/%([0-9A-F]{2})/g, (_, hex: string) =>
    String.fromCharCode(parseInt(hex, 16))
  )
  return btoa(bytes)
}

/** Inverse of `utf8ToBase64`. */
function base64ToUtf8(b64: string): string {
  const bytes = atob(b64)
  let percentEncoded = ""
  for (let i = 0; i < bytes.length; i++) {
    percentEncoded += "%" + ("00" + bytes.charCodeAt(i).toString(16)).slice(-2)
  }
  return decodeURIComponent(percentEncoded)
}

/**
 * Encode a buddy code as base64 JSON.
 * Format: { bookId, progress, name, ts }
 * Handles arbitrary Unicode in bookId/name (btoa alone throws on non-Latin1).
 */
export function generateBuddyCode(bookId: string, progress: number, name: string): string {
  const payload = {
    bookId: bookId.slice(0, 200),
    progress: Math.max(0, Math.min(100, Math.round(progress))),
    name: name.replace(/[\x00-\x1f]/g, "").slice(0, 50),
    ts: new Date().toISOString(),
  }
  try {
    return utf8ToBase64(JSON.stringify(payload))
  } catch {
    return ""
  }
}

export function decodeBuddyCode(code: string): { bookId: string; progress: number; name: string } | null {
  const trimmed = code.trim()
  try {
    let raw: string
    try {
      raw = base64ToUtf8(trimmed)
    } catch {
      // Fall back to plain base64 for any codes produced before Unicode support.
      raw = atob(trimmed)
    }
    const parsed = JSON.parse(raw) as { bookId?: unknown; progress?: unknown; name?: unknown }
    if (
      typeof parsed.bookId !== "string" ||
      typeof parsed.progress !== "number" ||
      typeof parsed.name !== "string"
    ) {
      return null
    }
    return {
      bookId: parsed.bookId,
      progress: Math.max(0, Math.min(100, parsed.progress)),
      name: parsed.name.slice(0, 50),
    }
  } catch {
    return null
  }
}

export function getBuddies(bookId: string): ReadingBuddy[] {
  const all = safeGetJSON<ReadingBuddy[]>(BUDDY_KEY, [])
  return all.filter(b => b.bookId === bookId)
}

export function addBuddy(buddy: ReadingBuddy): void {
  const all = safeGetJSON<ReadingBuddy[]>(BUDDY_KEY, [])
  // Replace if code already exists for this book
  const existingIdx = all.findIndex(b => b.bookId === buddy.bookId && b.code === buddy.code)
  if (existingIdx !== -1) {
    all[existingIdx] = buddy
  } else {
    all.push(buddy)
  }
  safeSetJSON(BUDDY_KEY, all)
}

export function removeBuddy(bookId: string, code: string): void {
  const all = safeGetJSON<ReadingBuddy[]>(BUDDY_KEY, [])
  const filtered = all.filter(b => !(b.bookId === bookId && b.code === code))
  safeSetJSON(BUDDY_KEY, filtered)
}

export function getMyCode(bookId: string): string | null {
  const codes = safeGetJSON<Record<string, string>>(MY_CODES_KEY, {})
  return codes[bookId] ?? null
}

export function saveMyCode(bookId: string, code: string): void {
  const codes = safeGetJSON<Record<string, string>>(MY_CODES_KEY, {})
  codes[bookId] = code
  safeSetJSON(MY_CODES_KEY, codes)
}
