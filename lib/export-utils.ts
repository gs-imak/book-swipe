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
  if (value.includes(",") || value.includes('"') || value.includes("\n")) {
    return `"${value.replace(/"/g, '""')}"`
  }
  return value
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
      book.rating.toString(),
      book.pages.toString(),
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
      escapeCSV(book.genre.join(", ")),
      escapeCSV(book.mood.join(", ")),
      review?.rating?.toString() || "",
      book.rating.toString(),
      book.pages.toString(),
      status,
      escapeCSV(shelfNames),
      escapeCSV(review?.review || ""),
      escapeCSV(notesText),
      book.publishedYear.toString(),
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

const BACKUP_KEYS = [
  "bookswipe_liked_books",
  "bookswipe_reading_progress",
  "bookswipe_reading_goals",
  "bookswipe_book_reviews",
  "bookswipe_book_notes",
  "bookswipe_achievements",
  "bookswipe_user_stats",
  "bookswipe_shelves",
  "bookswipe_shelf_assignments",
  "bookswipe_collections",
  "bookswipe_daily_pick",
  "bookswipe_user_preferences",
  "bookswipe_vocabulary",
  "bookswipe_challenges",
  "bookswipe_hidden_books",
  "bookswipe_reading_positions",
  "bookswipe_theme",
  "bookswipe_onboarded",
  "bookswipe_reading_buddies",
  "bookswipe_my_buddy_codes",
  "bookswipe_price_watch",
  "bookswipe_language",
  "bookswipe_reading_speed",
  "bookswipe_reader_theme",
  "bookswipe_reader_font",
  "bookswipe_bionic_mode",
  "bookswipe_passed_books",
  "bookswipe_goal_configured",
] as const

export function exportFullBackupJSON(): string {
  const data: Record<string, unknown> = {}

  BACKUP_KEYS.forEach(key => {
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
      if (!key.startsWith("bookswipe_")) return
      try {
        const serialized = typeof value === "string" ? value : JSON.stringify(value)
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
