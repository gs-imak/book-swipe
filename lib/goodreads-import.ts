"use client"

import { type Book } from "./book-data"
import {
  getLikedBooks,
  saveLikedBooks,
  saveBookReview,
  getShelves,
  createShelf,
  assignBookToShelf,
  type BookReview,
} from "./storage"

export interface GoodreadsRow {
  title: string
  author: string
  isbn: string
  isbn13: string
  myRating: number
  numberOfPages: number
  exclusiveShelf: string
  bookshelves: string
  myReview: string
  dateRead: string
  dateAdded: string
}

export interface ImportProgress {
  total: number
  processed: number
  matched: number
  skipped: number
  errors: number
  currentTitle: string
}

export interface ImportResult {
  total: number
  matched: number
  skipped: number
  errors: number
  newShelves: string[]
}

// State-machine CSV parser handling quoted fields
export function parseGoodreadsCSV(text: string): GoodreadsRow[] {
  const lines = text.split("\n")
  if (lines.length < 2) return []

  // Parse header
  const headers = parseCSVLine(lines[0])
  const headerMap: Record<string, number> = {}
  headers.forEach((h, i) => {
    headerMap[h.trim()] = i
  })

  const getCol = (row: string[], name: string): string => {
    const idx = headerMap[name]
    return idx !== undefined && idx < row.length ? row[idx].trim() : ""
  }

  const rows: GoodreadsRow[] = []
  for (let i = 1; i < lines.length; i++) {
    const line = lines[i].trim()
    if (!line) continue
    const cols = parseCSVLine(line)
    if (cols.length < 3) continue

    rows.push({
      title: getCol(cols, "Title"),
      author: getCol(cols, "Author") || getCol(cols, "Author l-f"),
      isbn: getCol(cols, "ISBN").replace(/[="]/g, ""),
      isbn13: getCol(cols, "ISBN13").replace(/[="]/g, ""),
      myRating: parseInt(getCol(cols, "My Rating")) || 0,
      numberOfPages: parseInt(getCol(cols, "Number of Pages")) || 0,
      exclusiveShelf: getCol(cols, "Exclusive Shelf"),
      bookshelves: getCol(cols, "Bookshelves"),
      myReview: getCol(cols, "My Review"),
      dateRead: getCol(cols, "Date Read"),
      dateAdded: getCol(cols, "Date Added"),
    })
  }

  return rows
}

function parseCSVLine(line: string): string[] {
  const fields: string[] = []
  let current = ""
  let inQuotes = false

  for (let i = 0; i < line.length; i++) {
    const char = line[i]
    if (inQuotes) {
      if (char === '"') {
        if (i + 1 < line.length && line[i + 1] === '"') {
          current += '"'
          i++
        } else {
          inQuotes = false
        }
      } else {
        current += char
      }
    } else {
      if (char === '"') {
        inQuotes = true
      } else if (char === ',') {
        fields.push(current)
        current = ""
      } else {
        current += char
      }
    }
  }
  fields.push(current)
  return fields
}

// Sanitize shelf/input names against formula injection (CSV injection prevention)
function sanitizeInput(value: string): string {
  // Strip leading characters that spreadsheet apps interpret as formulas
  return value.replace(/^[=+\-@\t\r]+/, "")
}

// Match book via our API route (keeps API key server-side)
async function matchBookToAPI(row: GoodreadsRow): Promise<Book | null> {
  // Try ISBN first
  const isbn = row.isbn13 || row.isbn
  if (isbn && isbn.length >= 10) {
    try {
      const res = await fetch(`/api/books?q=isbn:${encodeURIComponent(isbn)}&maxResults=1&lang=all`)
      const data = await res.json()
      if (data.items && data.items.length > 0) {
        return googleBookToBook(data.items[0], isbn)
      }
    } catch {
      // Fall through to title+author search
    }
  }

  // Fallback: title + author
  try {
    const query = `intitle:${row.title} inauthor:${row.author}`
    const res = await fetch(`/api/books?q=${encodeURIComponent(query)}&maxResults=1&lang=all`)
    const data = await res.json()
    if (data.items && data.items.length > 0) {
      return googleBookToBook(data.items[0])
    }
  } catch {
    // Unable to match
  }

  return null
}

function getBestGoogleCover(imageLinks: any): string {
  if (!imageLinks) return ""
  // Prefer largest available size
  const url =
    imageLinks.extraLarge ||
    imageLinks.large ||
    imageLinks.medium ||
    imageLinks.small ||
    imageLinks.thumbnail ||
    ""
  if (!url) return ""
  return url
    .replace("http:", "https:")
    .replace(/&edge=curl/g, "")
    .replace(/zoom=\d/, "zoom=0")
}

function googleBookToBook(item: any, isbn?: string): Book {
  const info = item.volumeInfo || {}
  const pageCount = info.pageCount || 200
  const hours = Math.max(1, Math.round(pageCount / 50))

  const googleCover = getBestGoogleCover(info.imageLinks)

  // Use Open Library ISBN cover as primary when ISBN is available (higher res)
  const resolvedIsbn = isbn || info.industryIdentifiers?.find((id: any) => id.type === "ISBN_13")?.identifier || info.industryIdentifiers?.find((id: any) => id.type === "ISBN_10")?.identifier
  const openLibraryCover = resolvedIsbn
    ? `https://covers.openlibrary.org/b/isbn/${resolvedIsbn}-L.jpg`
    : ""

  return {
    id: item.id || Date.now().toString(),
    title: info.title || "Unknown",
    author: (info.authors || ["Unknown"]).join(", "),
    cover: openLibraryCover || googleCover,
    coverFallback: openLibraryCover ? googleCover : undefined,
    rating: info.averageRating || 0,
    pages: pageCount,
    genre: (info.categories || ["Fiction"]).slice(0, 3),
    mood: [],
    description: info.description || "",
    publishedYear: parseInt(info.publishedDate?.substring(0, 4)) || 2000,
    readingTime: hours <= 2 ? "< 2 hours" : `${hours - 1}-${hours + 1} hours`,
  }
}

// Shelf name mapping from Goodreads to BookSwipe defaults
const SHELF_MAP: Record<string, string> = {
  "to-read": "want-to-read",
  "currently-reading": "currently-reading",
  "read": "finished",
}

// Batch API calls with rate limiting
async function processBatch<T, R>(
  items: T[],
  fn: (item: T) => Promise<R>,
  concurrency: number,
  delayMs: number
): Promise<R[]> {
  const results: R[] = []
  for (let i = 0; i < items.length; i += concurrency) {
    const batch = items.slice(i, i + concurrency)
    const batchResults = await Promise.all(batch.map(fn))
    results.push(...batchResults)
    if (i + concurrency < items.length) {
      await new Promise(resolve => setTimeout(resolve, delayMs))
    }
  }
  return results
}

export interface ImportOptions {
  importRatings?: boolean
  importShelves?: boolean
}

export async function importGoodreadsData(
  text: string,
  onProgress?: (progress: ImportProgress) => void,
  options?: ImportOptions
): Promise<ImportResult> {
  const shouldImportRatings = options?.importRatings !== false
  const shouldImportShelves = options?.importShelves !== false

  const rows = parseGoodreadsCSV(text)
  const existingBooks = getLikedBooks()
  const existingTitles = new Set(existingBooks.map(b => `${b.title.toLowerCase()}|${b.author.toLowerCase()}`))

  const progress: ImportProgress = {
    total: rows.length,
    processed: 0,
    matched: 0,
    skipped: 0,
    errors: 0,
    currentTitle: "",
  }

  const newBooks: Book[] = []
  const newReviews: { bookId: string; row: GoodreadsRow }[] = []
  const shelfAssignments: { bookId: string; grShelf: string }[] = []
  const customShelves = new Set<string>()

  // Process in batches of 3 with 200ms delay
  const processRow = async (row: GoodreadsRow): Promise<void> => {
    progress.currentTitle = row.title
    progress.processed++

    // Duplicate check
    const key = `${row.title.toLowerCase()}|${row.author.toLowerCase()}`
    if (existingTitles.has(key)) {
      progress.skipped++
      onProgress?.({ ...progress })
      return
    }

    try {
      const book = await matchBookToAPI(row)
      if (!book) {
        progress.errors++
        onProgress?.({ ...progress })
        return
      }

      // Check for duplicates by matched book id
      if (existingBooks.some(b => b.id === book.id) || newBooks.some(b => b.id === book.id)) {
        progress.skipped++
        onProgress?.({ ...progress })
        return
      }

      newBooks.push(book)
      existingTitles.add(key)
      progress.matched++

      // Collect review data
      if (shouldImportRatings && row.myRating > 0) {
        newReviews.push({ bookId: book.id, row })
      }

      // Collect shelf assignments
      if (shouldImportShelves) {
        if (row.exclusiveShelf) {
          shelfAssignments.push({ bookId: book.id, grShelf: row.exclusiveShelf })
        }

        // Custom shelves from "Bookshelves" column
        if (row.bookshelves) {
          row.bookshelves.split(",").forEach(s => {
            const shelfName = s.trim()
            if (shelfName && !SHELF_MAP[shelfName]) {
              customShelves.add(shelfName)
              shelfAssignments.push({ bookId: book.id, grShelf: shelfName })
            }
          })
        }
      }
    } catch {
      progress.errors++
    }

    onProgress?.({ ...progress })
  }

  await processBatch(rows, processRow, 3, 200)

  // Save all new books
  if (newBooks.length > 0) {
    saveLikedBooks([...existingBooks, ...newBooks])
  }

  // Save reviews
  newReviews.forEach(({ bookId, row }) => {
    const review: BookReview = {
      bookId,
      rating: row.myRating,
      review: row.myReview || undefined,
      favorite: false,
      dateFinished: row.dateRead || undefined,
      tags: [],
      mood: "",
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    }
    saveBookReview(review)
  })

  // Create custom shelves
  const createdShelves: string[] = []
  const existingShelves = getShelves()
  const existingShelfNames = new Set(existingShelves.map(s => s.name.toLowerCase()))

  customShelves.forEach(shelfName => {
    const displayName = sanitizeInput(shelfName).replace(/-/g, " ").replace(/\b\w/g, c => c.toUpperCase())
    if (!displayName.trim() || existingShelfNames.has(displayName.toLowerCase())) {
      return // Skip empty or duplicate shelf names
    }
    createShelf(displayName, "\u{1F4D1}")
    createdShelves.push(displayName)
    existingShelfNames.add(displayName.toLowerCase())
  })

  // Assign books to shelves
  const allShelves = getShelves()
  const shelfNameToId: Record<string, string> = {}
  allShelves.forEach(s => {
    shelfNameToId[s.name.toLowerCase()] = s.id
  })

  shelfAssignments.forEach(({ bookId, grShelf }) => {
    // Check default mapping first
    const mappedId = SHELF_MAP[grShelf]
    if (mappedId) {
      assignBookToShelf(bookId, mappedId)
    } else {
      // Custom shelf
      const displayName = sanitizeInput(grShelf).replace(/-/g, " ").replace(/\b\w/g, c => c.toUpperCase())
      const shelfId = shelfNameToId[displayName.toLowerCase()]
      if (shelfId) {
        assignBookToShelf(bookId, shelfId)
      }
    }
  })

  return {
    total: rows.length,
    matched: progress.matched,
    skipped: progress.skipped,
    errors: progress.errors,
    newShelves: createdShelves,
  }
}
