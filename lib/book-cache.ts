"use client"

import { Book, sampleBooks } from "./book-data"

const BOOK_CACHE_KEY = "bookswipe_book_cache"
const CACHE_METADATA_KEY = "bookswipe_cache_metadata"
const MAX_CACHE_SIZE = 500

interface CacheMetadata {
  lastUpdated: string
  queriesCompleted: Record<string, string> // query -> timestamp
  totalBooks: number
}

function getCacheMetadata(): CacheMetadata {
  const fallback: CacheMetadata = { lastUpdated: "", queriesCompleted: {}, totalBooks: 0 }
  if (typeof window === "undefined") return fallback
  try {
    const stored = localStorage.getItem(CACHE_METADATA_KEY)
    return stored ? JSON.parse(stored) : fallback
  } catch {
    return fallback
  }
}

function saveCacheMetadata(meta: CacheMetadata): void {
  if (typeof window === "undefined") return
  try {
    localStorage.setItem(CACHE_METADATA_KEY, JSON.stringify(meta))
  } catch {
    // Storage full — metadata is non-critical
  }
}

export function getCachedBooks(): Book[] {
  if (typeof window === "undefined") return [...sampleBooks]
  try {
    const stored = localStorage.getItem(BOOK_CACHE_KEY)
    if (!stored) {
      seedCache()
      return [...sampleBooks]
    }
    const books: Book[] = JSON.parse(stored)
    return books.length > 0 ? books : [...sampleBooks]
  } catch {
    return [...sampleBooks]
  }
}

function seedCache(): void {
  const seeded = sampleBooks.map((b) => ({
    ...b,
    metadata: { ...b.metadata, source: "sample" as const },
  }))
  if (typeof window === "undefined") return
  try {
    localStorage.setItem(BOOK_CACHE_KEY, JSON.stringify(seeded))
    saveCacheMetadata({
      lastUpdated: new Date().toISOString(),
      queriesCompleted: {},
      totalBooks: seeded.length,
    })
  } catch {
    // Storage full — will use sampleBooks in memory
  }
}

export function addBooksToCache(books: Book[]): void {
  if (typeof window === "undefined" || books.length === 0) return
  const existing = getCachedBooks()
  const existingIds = new Set(existing.map((b) => b.id))

  const newBooks = books.filter((b) => !existingIds.has(b.id))
  if (newBooks.length === 0) return

  let merged = [...existing, ...newBooks]

  // Evict if over limit: keep liked books + most recent additions
  if (merged.length > MAX_CACHE_SIZE) {
    const { getLikedBooks } = require("./storage")
    const likedIds = new Set(getLikedBooks().map((b: Book) => b.id))
    const liked = merged.filter((b) => likedIds.has(b.id))
    const rest = merged
      .filter((b) => !likedIds.has(b.id))
      .slice(-(MAX_CACHE_SIZE - liked.length))
    merged = [...liked, ...rest]
  }

  try {
    localStorage.setItem(BOOK_CACHE_KEY, JSON.stringify(merged))
  } catch {
    // Storage full — evict more aggressively
    const trimmed = merged.slice(-Math.floor(MAX_CACHE_SIZE / 2))
    try { localStorage.setItem(BOOK_CACHE_KEY, JSON.stringify(trimmed)) } catch { /* give up */ }
  }
  const meta = getCacheMetadata()
  meta.lastUpdated = new Date().toISOString()
  meta.totalBooks = merged.length
  saveCacheMetadata(meta)
}

export function isQueryCached(query: string): boolean {
  const meta = getCacheMetadata()
  const timestamp = meta.queriesCompleted[query]
  if (!timestamp) return false
  const age = Date.now() - new Date(timestamp).getTime()
  return age < 24 * 60 * 60 * 1000 // 24 hour TTL
}

export function markQueryCompleted(query: string): void {
  const meta = getCacheMetadata()
  meta.queriesCompleted[query] = new Date().toISOString()
  saveCacheMetadata(meta)
}

export function queryCache(predicate: (book: Book) => boolean): Book[] {
  return getCachedBooks().filter(predicate)
}

export function clearBookCache(): void {
  if (typeof window !== "undefined") {
    localStorage.removeItem(BOOK_CACHE_KEY)
    localStorage.removeItem(CACHE_METADATA_KEY)
  }
}
