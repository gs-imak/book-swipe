"use client"

import { Book } from "./book-data"
import {
  getLikedBooks,
  getBookReviews,
  getReadingProgress,
  getBookNotes,
  getShelves,
  getShelfAssignments,
  type BookReview,
  type ReadingProgress,
  type BookNote,
} from "./storage"

// --- Goodreads CSV Export ---

function escapeCSV(value: string): string {
  // Formula-injection guard: a leading =, +, -, or @ can be interpreted as a
  // formula by spreadsheet apps (Excel, Sheets). Prefix with ' to neutralize.
  let safe = value
  if (/^[=+\-@]/.test(safe)) {
    safe = `'${safe}`
  }
  if (safe.includes(",") || safe.includes('"') || safe.includes("\n")) {
    return `"${safe.replace(/"/g, '""')}"`
  }
  return safe
}

export function exportToGoodreadsCSV(): string {
  const books = getLikedBooks()
  const reviews = getBookReviews()
  const progress = getReadingProgress()
  const shelves = getShelves()
  const assignments = getShelfAssignments()

  const reviewMap: Record<string, BookReview> = {}
  reviews.forEach(r => { reviewMap[r.bookId] = r })

  const progressMap: Record<string, ReadingProgress> = {}
  progress.forEach(p => { progressMap[p.bookId] = p })

  const shelfAssignmentMap: Record<string, string[]> = {}
  assignments.forEach(a => {
    if (!shelfAssignmentMap[a.bookId]) shelfAssignmentMap[a.bookId] = []
    shelfAssignmentMap[a.bookId].push(a.shelfId)
  })

  // Goodreads CSV header
  const headers = [
    "Title", "Author", "ISBN", "ISBN13", "My Rating",
    "Average Rating", "Number of Pages", "Exclusive Shelf",
    "Bookshelves", "My Review", "Date Read", "Date Added"
  ]

  const rows = books.map(book => {
    const review = reviewMap[book.id]
    const prog = progressMap[book.id]

    // Map app shelves to Goodreads exclusive shelf
    const bookShelfIds = shelfAssignmentMap[book.id] || []
    const bookShelves = shelves.filter(s => bookShelfIds.includes(s.id))
    const shelfNames = bookShelves.map(s => s.name)

    let exclusiveShelf = "to-read"
    if (prog?.status === "completed" || shelfNames.some(n => n.toLowerCase().includes("finished"))) {
      exclusiveShelf = "read"
    } else if (prog?.status === "reading" || shelfNames.some(n => n.toLowerCase().includes("reading"))) {
      exclusiveShelf = "currently-reading"
    }

    // Custom bookshelves (non-default ones)
    const customShelves = bookShelves
      .filter(s => !s.isDefault)
      .map(s => s.name.toLowerCase().replace(/\s+/g, "-"))
      .join(", ")

    const isbn10 = book.isbn?.length === 10 ? book.isbn : ""
    const isbn13 = book.isbn?.length === 13 ? book.isbn : ""
    const rating = review?.rating || ""
    const reviewText = review?.review || ""
    const dateRead = review?.dateFinished || prog?.lastReadDate || ""
    const dateAdded = review?.createdAt?.split("T")[0] || new Date().toISOString().split("T")[0]

    return [
      escapeCSV(book.title),
      escapeCSV(book.author),
      isbn10,
      isbn13,
      rating.toString(),
      (book.rating ?? 0).toString(),
      (book.pages ?? 0).toString(),
      exclusiveShelf,
      escapeCSV(customShelves),
      escapeCSV(reviewText),
      dateRead ? dateRead.split("T")[0] : "",
      dateAdded,
    ]
  })

  const csv = [
    headers.join(","),
    ...rows.map(row => row.join(","))
  ].join("\n")

  return csv
}

// --- Notion CSV Export ---

export function exportToNotionCSV(): string {
  const books = getLikedBooks()
  const reviews = getBookReviews()
  const progress = getReadingProgress()
  const notes = getBookNotes()
  const shelves = getShelves()
  const assignments = getShelfAssignments()

  const reviewMap: Record<string, BookReview> = {}
  reviews.forEach(r => { reviewMap[r.bookId] = r })

  const progressMap: Record<string, ReadingProgress> = {}
  progress.forEach(p => { progressMap[p.bookId] = p })

  const notesByBook: Record<string, BookNote[]> = {}
  notes.forEach(n => {
    if (!notesByBook[n.bookId]) notesByBook[n.bookId] = []
    notesByBook[n.bookId].push(n)
  })

  const shelfAssignmentMap: Record<string, string[]> = {}
  assignments.forEach(a => {
    if (!shelfAssignmentMap[a.bookId]) shelfAssignmentMap[a.bookId] = []
    shelfAssignmentMap[a.bookId].push(a.shelfId)
  })

  // Notion-friendly headers (rich properties)
  const headers = [
    "Name", "Author", "Genre", "Mood", "Rating (Mine)", "Rating (Avg)",
    "Pages", "Status", "Shelf", "Review", "Notes",
    "Published Year", "ISBN", "Date Added", "Date Finished"
  ]

  const rows = books.map(book => {
    const review = reviewMap[book.id]
    const prog = progressMap[book.id]
    const bookNotes = notesByBook[book.id] || []

    const bookShelfIds = shelfAssignmentMap[book.id] || []
    const bookShelves = shelves.filter(s => bookShelfIds.includes(s.id))
    const shelfNames = bookShelves.map(s => s.name).join(", ")

    let status = "Want to Read"
    if (prog?.status === "completed") status = "Finished"
    else if (prog?.status === "reading") status = "Reading"
    else if (prog?.status === "paused") status = "Paused"

    const notesText = bookNotes
      .map(n => {
        const prefix = n.type === "quote" ? `"${n.content}"` :
                       n.type === "highlight" ? `[Highlight] ${n.content}` :
                       n.content
        return n.page ? `p.${n.page}: ${prefix}` : prefix
      })
      .join(" | ")

    return [
      escapeCSV(book.title),
      escapeCSV(book.author),
      escapeCSV((book.genre ?? []).join(", ")),
      escapeCSV((book.mood ?? []).join(", ")),
      review?.rating?.toString() || "",
      (book.rating ?? 0).toString(),
      (book.pages ?? 0).toString(),
      status,
      escapeCSV(shelfNames),
      escapeCSV(review?.review || ""),
      escapeCSV(notesText),
      (book.publishedYear ?? "").toString(),
      book.isbn || "",
      review?.createdAt?.split("T")[0] || new Date().toISOString().split("T")[0],
      review?.dateFinished?.split("T")[0] || prog?.lastReadDate?.split("T")[0] || "",
    ]
  })

  const csv = [
    headers.join(","),
    ...rows.map(row => row.join(","))
  ].join("\n")

  return csv
}

// --- Download helpers ---

export function downloadCSV(csv: string, filename: string): void {
  const blob = new Blob([csv], { type: "text/csv;charset=utf-8;" })
  const url = URL.createObjectURL(blob)
  const a = document.createElement("a")
  a.href = url
  a.download = filename
  a.click()
  URL.revokeObjectURL(url)
}

export function downloadJSON(json: string, filename: string): void {
  const blob = new Blob([json], { type: "application/json;charset=utf-8;" })
  const url = URL.createObjectURL(blob)
  const a = document.createElement("a")
  a.href = url
  a.download = filename
  a.click()
  URL.revokeObjectURL(url)
}

// --- Full JSON Backup ---

// Prefix every user-data key shares. The hand-maintained allow-list this
// replaced silently dropped real keys (tags, book-tags, activity log, etc.)
// from "full" backups, so we now export ALL bookswipe_-prefixed keys.
const BACKUP_KEY_PREFIX = "bookswipe_"

// Volatile, regenerable state that must NOT be backed up: the book cache (re-
// fetched from the API), its metadata, and any one-shot cover-migration flag.
function isVolatileCacheKey(key: string): boolean {
  return (
    key === "bookswipe_book_cache" ||
    key === "bookswipe_cache_metadata" ||
    key.includes("cover_migration")
  )
}

function getBackupKeys(): string[] {
  return Object.keys(localStorage).filter(
    key => key.startsWith(BACKUP_KEY_PREFIX) && !isVolatileCacheKey(key)
  )
}

export function exportFullBackupJSON(): string {
  const data: Record<string, unknown> = {}

  getBackupKeys().forEach(key => {
    try {
      const raw = localStorage.getItem(key)
      if (raw !== null) {
        try {
          data[key] = JSON.parse(raw)
        } catch {
          data[key] = raw
        }
      }
    } catch {
      // skip inaccessible keys
    }
  })

  const backup = {
    metadata: {
      version: 1,
      exportDate: new Date().toISOString(),
      appVersion: "bookswipe",
    },
    data,
  }

  return JSON.stringify(backup, null, 2)
}

interface ImportResult {
  success: boolean
  error?: string
  stats?: { books: number; reviews: number; notes: number; totalKeys: number }
}

export function importFullBackupJSON(jsonString: string): ImportResult {
  try {
    const parsed = JSON.parse(jsonString)

    if (!parsed || typeof parsed !== "object") {
      return { success: false, error: "Invalid JSON structure" }
    }

    if (!parsed.metadata || !parsed.data || typeof parsed.data !== "object") {
      return { success: false, error: "Missing metadata or data in backup file" }
    }

    if (parsed.metadata.appVersion !== "bookswipe") {
      return { success: false, error: "This file is not a BookSwipe backup" }
    }

    const data = parsed.data as Record<string, unknown>
    let totalKeys = 0

    Object.entries(data).forEach(([key, value]) => {
      // Only restore our own namespaced keys; ignore anything else in the file.
      if (!key.startsWith(BACKUP_KEY_PREFIX)) return
      try {
        const serialized = typeof value === "string" ? value : JSON.stringify(value)
        // JSON.stringify can return undefined (e.g. value === undefined / a
        // function); never write a non-string into localStorage.
        if (typeof serialized !== "string") return
        localStorage.setItem(key, serialized)
        totalKeys++
      } catch {
        // skip keys that fail to write (quota, etc.)
      }
    })

    const books = Array.isArray(data["bookswipe_liked_books"])
      ? (data["bookswipe_liked_books"] as unknown[]).length
      : 0
    const reviews = Array.isArray(data["bookswipe_book_reviews"])
      ? (data["bookswipe_book_reviews"] as unknown[]).length
      : 0
    const notes = Array.isArray(data["bookswipe_book_notes"])
      ? (data["bookswipe_book_notes"] as unknown[]).length
      : 0

    return {
      success: true,
      stats: { books, reviews, notes, totalKeys },
    }
  } catch {
    return { success: false, error: "Failed to parse JSON file" }
  }
}

export function previewFullBackupJSON(jsonString: string): ImportResult {
  try {
    const parsed = JSON.parse(jsonString)

    if (!parsed || typeof parsed !== "object" || !parsed.metadata || !parsed.data) {
      return { success: false, error: "Invalid backup file format" }
    }

    if (parsed.metadata.appVersion !== "bookswipe") {
      return { success: false, error: "This file is not a BookSwipe backup" }
    }

    const data = parsed.data as Record<string, unknown>
    const totalKeys = Object.keys(data).filter(k => k.startsWith("bookswipe_")).length

    const books = Array.isArray(data["bookswipe_liked_books"])
      ? (data["bookswipe_liked_books"] as unknown[]).length
      : 0
    const reviews = Array.isArray(data["bookswipe_book_reviews"])
      ? (data["bookswipe_book_reviews"] as unknown[]).length
      : 0
    const notes = Array.isArray(data["bookswipe_book_notes"])
      ? (data["bookswipe_book_notes"] as unknown[]).length
      : 0

    return {
      success: true,
      stats: { books, reviews, notes, totalKeys },
    }
  } catch {
    return { success: false, error: "Failed to parse JSON file" }
  }
}
