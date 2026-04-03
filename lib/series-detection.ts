"use client"

import { Book } from "./book-data"
import { searchGoogleBooks } from "./books-api"

const SERIES_CACHE_KEY = "bookswipe_series_cache"
const SERIES_CACHE_TTL_MS = 7 * 24 * 60 * 60 * 1000 // 7 days

export interface SeriesInfo {
  seriesName: string
  bookNumber: number
}

interface SeriesCacheEntry {
  books: Book[]
  timestamp: string
}

type SeriesCache = Record<string, SeriesCacheEntry>

// Word-to-number mapping for written ordinals
const WORD_NUMBERS: Record<string, number> = {
  one: 1, two: 2, three: 3, four: 4, five: 5,
  six: 6, seven: 7, eight: 8, nine: 9, ten: 10,
  eleven: 11, twelve: 12, thirteen: 13, fourteen: 14, fifteen: 15,
  sixteen: 16, seventeen: 17, eighteen: 18, nineteen: 19, twenty: 20,
  first: 1, second: 2, third: 3, fourth: 4, fifth: 5,
  sixth: 6, seventh: 7, eighth: 8, ninth: 9, tenth: 10,
}

function wordToNumber(word: string): number | null {
  return WORD_NUMBERS[word.toLowerCase()] ?? null
}

/**
 * Detect series information from a book's title and description.
 *
 * Handles patterns like:
 *   "Title (Series Name #3)"
 *   "Title (Series Name, Book 3)"
 *   "Title: Series Name Book Three"
 *   "Series Name: Title" (when description confirms series)
 *   Description mentions like "book 3 in the Series Name series"
 */
export function detectSeries(book: Book): SeriesInfo | null {
  const title = book.title
  const description = book.description || ""

  // Pattern 1: "Title (Series Name #3)" or "Title (Series Name, #3)"
  const hashPattern = /\(([^)]+?)\s*#(\d+)\)/i
  const hashMatch = title.match(hashPattern)
  if (hashMatch) {
    return { seriesName: hashMatch[1].replace(/,\s*$/, "").trim(), bookNumber: parseInt(hashMatch[2]) }
  }

  // Pattern 2: "Title (Series Name, Book 3)" or "Title (Series Name, Vol. 3)"
  const bookNumParenPattern = /\(([^)]+?),?\s+(?:book|vol\.?|volume|part|tome)\s+(\d+)\)/i
  const bookNumParenMatch = title.match(bookNumParenPattern)
  if (bookNumParenMatch) {
    return { seriesName: bookNumParenMatch[1].trim(), bookNumber: parseInt(bookNumParenMatch[2]) }
  }

  // Pattern 3: "Title (Series Name, Book Three)" — written number in parens
  const bookWordParenPattern = /\(([^)]+?),?\s+(?:book|vol\.?|volume|part|tome)\s+(\w+)\)/i
  const bookWordParenMatch = title.match(bookWordParenPattern)
  if (bookWordParenMatch) {
    const num = wordToNumber(bookWordParenMatch[2])
    if (num) {
      return { seriesName: bookWordParenMatch[1].trim(), bookNumber: num }
    }
  }

  // Pattern 4: "Title: Series Name Book 3" or "Series Name Book Three: Title"
  const colonPattern = /^(.+?):\s*(.+?)\s+(?:book|vol\.?|volume|part)\s+(\w+)/i
  const colonMatch = title.match(colonPattern)
  if (colonMatch) {
    const num = parseInt(colonMatch[3]) || wordToNumber(colonMatch[3])
    if (num) {
      // The series name could be on either side of the colon.
      // Use the part that doesn't look like a standalone title (heuristic: shorter part is the series)
      const left = colonMatch[1].trim()
      const right = colonMatch[2].trim().replace(/\s+(?:book|vol\.?|volume|part)\s+\w+$/i, "").trim()
      const seriesName = left.length <= right.length ? left : right
      return { seriesName, bookNumber: num }
    }
  }

  // Pattern 5: Title ends with a number like "Series Name 3" (only for titles with colon separator)
  const titleTrailingNum = /^(.+?):\s*(.+?)\s+(\d+)\s*$/i
  const trailingMatch = title.match(titleTrailingNum)
  if (trailingMatch) {
    const num = parseInt(trailingMatch[3])
    if (num >= 1 && num <= 50) {
      return { seriesName: trailingMatch[1].trim(), bookNumber: num }
    }
  }

  // Pattern 6: Check description for series mentions
  // "book 3 in the Series Name series"
  const descBookInPattern = /book\s+(\w+)\s+(?:in|of)\s+(?:the\s+)?(.+?)\s+series/i
  const descBookInMatch = description.match(descBookInPattern)
  if (descBookInMatch) {
    const num = parseInt(descBookInMatch[1]) || wordToNumber(descBookInMatch[1])
    if (num) {
      return { seriesName: descBookInMatch[2].trim(), bookNumber: num }
    }
  }

  // "the Nth book in the Series Name"
  const descNthPattern = /the\s+(\w+)\s+(?:book|novel|installment|entry|volume)\s+(?:in|of)\s+(?:the\s+)?(.+?)(?:\s+series|\s+trilogy|\s+saga|\s+cycle|\.|\,)/i
  const descNthMatch = description.match(descNthPattern)
  if (descNthMatch) {
    const num = parseInt(descNthMatch[1]) || wordToNumber(descNthMatch[1])
    if (num) {
      return { seriesName: descNthMatch[2].trim(), bookNumber: num }
    }
  }

  // "#N in the Series Name series"
  const descHashPattern = /#(\d+)\s+(?:in|of)\s+(?:the\s+)?(.+?)\s+series/i
  const descHashMatch = description.match(descHashPattern)
  if (descHashMatch) {
    return { seriesName: descHashMatch[2].trim(), bookNumber: parseInt(descHashMatch[1]) }
  }

  // "Series Name series" with book number context nearby
  const descSeriesGeneral = /(.+?)\s+series/i
  const descNumberContext = /(?:book|volume|#)\s*(\d+)/i
  const seriesMatch = description.match(descSeriesGeneral)
  const numberMatch = description.match(descNumberContext)
  if (seriesMatch && numberMatch) {
    const seriesName = seriesMatch[1].trim()
    // Avoid false positives from very generic phrases
    if (seriesName.length > 2 && seriesName.length < 80) {
      return { seriesName, bookNumber: parseInt(numberMatch[1]) }
    }
  }

  return null
}

// --- Cache helpers ---

function getSeriesCache(): SeriesCache {
  if (typeof window === "undefined") return {}
  try {
    const stored = localStorage.getItem(SERIES_CACHE_KEY)
    if (!stored) return {}
    return JSON.parse(stored) as SeriesCache
  } catch {
    return {}
  }
}

function setSeriesCache(cache: SeriesCache): void {
  if (typeof window === "undefined") return
  try {
    localStorage.setItem(SERIES_CACHE_KEY, JSON.stringify(cache))
  } catch {
    // Storage full — series cache is non-critical
  }
}

function getCachedSeriesBooks(seriesName: string): Book[] | null {
  const cache = getSeriesCache()
  const key = seriesName.toLowerCase()
  const entry = cache[key]
  if (!entry) return null
  const age = Date.now() - new Date(entry.timestamp).getTime()
  if (age > SERIES_CACHE_TTL_MS) {
    // Expired — remove entry
    delete cache[key]
    setSeriesCache(cache)
    return null
  }
  return entry.books
}

function cacheSeriesBooks(seriesName: string, books: Book[]): void {
  const cache = getSeriesCache()
  const key = seriesName.toLowerCase()
  cache[key] = { books, timestamp: new Date().toISOString() }

  // Limit cache to 50 series to avoid unbounded growth
  const keys = Object.keys(cache)
  if (keys.length > 50) {
    // Evict oldest entries
    const sorted = keys
      .map(k => ({ key: k, ts: new Date(cache[k].timestamp).getTime() }))
      .sort((a, b) => a.ts - b.ts)
    const toRemove = sorted.slice(0, keys.length - 50)
    toRemove.forEach(item => delete cache[item.key])
  }

  setSeriesCache(cache)
}

/**
 * Find the next book(s) in a series by searching Google Books.
 * Returns up to 5 books from the same series, sorted by likely order.
 */
export async function findNextInSeries(
  book: Book,
  seriesInfo: SeriesInfo
): Promise<Book[]> {
  const { seriesName } = seriesInfo

  // Check cache first
  const cached = getCachedSeriesBooks(seriesName)
  if (cached) {
    return cached.filter(b => b.id !== book.id)
  }

  try {
    // Search for series books using the series name
    const query = `"${seriesName}" intitle:"${seriesName}"`
    const results = await searchGoogleBooks(query, 10)

    // Filter to likely series matches: same series name in title or same author
    const seriesBooks = results.filter(b => {
      if (b.id === book.id) return false
      const titleLower = b.title.toLowerCase()
      const seriesLower = seriesName.toLowerCase()
      const sameAuthor = b.author.toLowerCase() === book.author.toLowerCase()
      const mentionsSeries = titleLower.includes(seriesLower)
      return mentionsSeries || (sameAuthor && titleLower.includes(seriesLower.split(/\s+/)[0]))
    })

    // Sort: prefer books with detectable series numbers in ascending order
    const withNumbers = seriesBooks.map(b => {
      const info = detectSeries(b)
      return { book: b, number: info?.bookNumber ?? 999 }
    })
    withNumbers.sort((a, b) => a.number - b.number)

    const sorted = withNumbers.map(w => w.book).slice(0, 5)

    // Cache the results (include the current book for future lookups)
    cacheSeriesBooks(seriesName, [...sorted, book])

    return sorted
  } catch {
    return []
  }
}
