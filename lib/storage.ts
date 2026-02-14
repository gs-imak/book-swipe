"use client"

import { Book } from "./book-data"

// Safe localStorage helpers to prevent crashes from QuotaExceeded or corrupted data
function safeGetJSON<T>(key: string, fallback: T): T {
  try {
    if (typeof window === 'undefined') return fallback
    const stored = localStorage.getItem(key)
    if (!stored) return fallback
    return JSON.parse(stored) as T
  } catch {
    return fallback
  }
}

function safeSetJSON(key: string, value: unknown): boolean {
  try {
    if (typeof window === 'undefined') return false
    localStorage.setItem(key, JSON.stringify(value))
    return true
  } catch {
    // QuotaExceededError or other storage failure
    return false
  }
}

const LIKED_BOOKS_KEY = "bookswipe_liked_books"
const READING_PROGRESS_KEY = "bookswipe_reading_progress"
const READING_GOALS_KEY = "bookswipe_reading_goals"
const BOOK_REVIEWS_KEY = "bookswipe_book_reviews"
const BOOK_NOTES_KEY = "bookswipe_book_notes"
const USER_ACHIEVEMENTS_KEY = "bookswipe_achievements"
const USER_STATS_KEY = "bookswipe_user_stats"
const SHELVES_KEY = "bookswipe_shelves"
const SHELF_ASSIGNMENTS_KEY = "bookswipe_shelf_assignments"
const DAILY_PICK_KEY = "bookswipe_daily_pick"
const LAST_EXPORT_KEY = "bookswipe_last_export"
const BACKUP_DISMISSED_KEY = "bookswipe_backup_dismissed"

export interface ReadingProgress {
  bookId: string
  book: Book
  currentPage: number
  totalPages: number
  startedDate: string
  lastReadDate: string
  timeSpentMinutes: number
  notes?: string
  status: "reading" | "paused" | "completed"
}

export interface ReadingGoals {
  yearlyTarget: number
  currentYear: number
  booksCompleted: number
  pagesRead: number
  timeSpentMinutes: number
  streak: number
  lastReadDate: string
}

export interface BookNote {
  id: string
  bookId: string
  content: string
  type: 'highlight' | 'note' | 'quote'
  page?: number
  createdAt: string
  updatedAt: string
}

export interface BookReview {
  bookId: string
  rating: number // 1-5 stars
  review?: string
  favorite: boolean
  dateStarted?: string
  dateFinished?: string
  readingTime?: number // minutes
  tags: string[]
  mood: string
  createdAt: string
  updatedAt: string
}

export interface Achievement {
  id: string
  name: string
  description: string
  icon: string
  type: 'bronze' | 'silver' | 'gold' | 'platinum'
  category: 'reading' | 'social' | 'discovery' | 'consistency' | 'milestone'
  unlockedAt?: string
  progress?: number
  maxProgress?: number
}

export interface UserStats {
  totalBooksLiked: number
  totalBooksRead: number
  totalPagesRead: number
  totalReadingTime: number // minutes
  totalReviews: number
  totalNotes: number
  currentStreak: number
  longestStreak: number
  lastActivityDate: string
  level: number
  totalPoints: number
  genrePreferences: Record<string, number>
  moodPreferences: Record<string, number>
  averageRating: number
  favoritesCount: number
  joinDate: string
}

export interface Shelf {
  id: string
  name: string
  emoji: string
  isDefault: boolean
  createdAt: string
}

export interface BookShelfAssignment {
  bookId: string
  shelfId: string
  addedAt: string
}

export interface DailyPick {
  book: Book
  reasons: { type: string; description: string }[]
  date: string
  dismissed: boolean
  saved: boolean
}

// Liked Books Functions
export function saveLikedBooks(books: Book[]): void {
  safeSetJSON(LIKED_BOOKS_KEY, books)
  if (typeof window !== 'undefined') {
    window.dispatchEvent(new CustomEvent('bookswipe:liked-changed', { detail: books.length }))
  }
}

export function getLikedBooks(): Book[] {
  return safeGetJSON<Book[]>(LIKED_BOOKS_KEY, [])
}

export function clearLikedBooks(): void {
  if (typeof window !== 'undefined') {
    localStorage.removeItem(LIKED_BOOKS_KEY)
    window.dispatchEvent(new CustomEvent('bookswipe:liked-changed', { detail: 0 }))
  }
}

// Reading Progress Functions
export function saveReadingProgress(progress: ReadingProgress[]): void {
  safeSetJSON(READING_PROGRESS_KEY, progress)
}

export function getReadingProgress(): ReadingProgress[] {
  return safeGetJSON<ReadingProgress[]>(READING_PROGRESS_KEY, [])
}

export function addBookToReading(book: Book): void {
  const currentProgress = getReadingProgress()
  const existingBook = currentProgress.find(p => p.bookId === book.id)
  
  if (!existingBook) {
    const newProgress: ReadingProgress = {
      bookId: book.id,
      book,
      currentPage: 0,
      totalPages: book.pages,
      startedDate: new Date().toISOString(),
      lastReadDate: new Date().toISOString(),
      timeSpentMinutes: 0,
      status: "reading"
    }
    
    currentProgress.push(newProgress)
    saveReadingProgress(currentProgress)
  }
}

export function updateReadingProgress(bookId: string, updates: Partial<ReadingProgress>): void {
  const currentProgress = getReadingProgress()
  const bookIndex = currentProgress.findIndex(p => p.bookId === bookId)
  
  if (bookIndex !== -1) {
    currentProgress[bookIndex] = { ...currentProgress[bookIndex], ...updates }
    saveReadingProgress(currentProgress)
  }
}

export function removeFromReading(bookId: string): void {
  const currentProgress = getReadingProgress()
  const filtered = currentProgress.filter(p => p.bookId !== bookId)
  saveReadingProgress(filtered)
}

// Reading Goals Functions
export function saveReadingGoals(goals: ReadingGoals): void {
  safeSetJSON(READING_GOALS_KEY, goals)
}

export function getReadingGoals(): ReadingGoals {
  return safeGetJSON<ReadingGoals>(READING_GOALS_KEY, {
    yearlyTarget: 12,
    currentYear: new Date().getFullYear(),
    booksCompleted: 0,
    pagesRead: 0,
    timeSpentMinutes: 0,
    streak: 0,
    lastReadDate: ""
  })
}

export function updateReadingGoals(updates: Partial<ReadingGoals>): void {
  const currentGoals = getReadingGoals()
  const updatedGoals = { ...currentGoals, ...updates }
  saveReadingGoals(updatedGoals)
}

// Book Reviews Functions
export function saveBookReviews(reviews: BookReview[]): void {
  safeSetJSON(BOOK_REVIEWS_KEY, reviews)
}

export function getBookReviews(): BookReview[] {
  return safeGetJSON<BookReview[]>(BOOK_REVIEWS_KEY, [])
}

export function getBookReview(bookId: string): BookReview | null {
  const reviews = getBookReviews()
  return reviews.find(review => review.bookId === bookId) || null
}

export function saveBookReview(review: BookReview): void {
  const reviews = getBookReviews()
  const existingIndex = reviews.findIndex(r => r.bookId === review.bookId)
  
  if (existingIndex !== -1) {
    reviews[existingIndex] = { ...review, updatedAt: new Date().toISOString() }
  } else {
    reviews.push({ ...review, createdAt: new Date().toISOString(), updatedAt: new Date().toISOString() })
  }
  
  saveBookReviews(reviews)
}

export function deleteBookReview(bookId: string): void {
  const reviews = getBookReviews()
  const filtered = reviews.filter(review => review.bookId !== bookId)
  saveBookReviews(filtered)
}

// Book Notes Functions
export function saveBookNotes(notes: BookNote[]): void {
  safeSetJSON(BOOK_NOTES_KEY, notes)
}

export function getBookNotes(): BookNote[] {
  return safeGetJSON<BookNote[]>(BOOK_NOTES_KEY, [])
}

export function getBookNotesForBook(bookId: string): BookNote[] {
  const notes = getBookNotes()
  return notes.filter(note => note.bookId === bookId)
}

export function saveBookNote(note: Omit<BookNote, 'id' | 'createdAt' | 'updatedAt'>): void {
  const notes = getBookNotes()
  const newNote: BookNote = {
    ...note,
    id: Date.now().toString() + Math.random().toString(36).substr(2, 9),
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString()
  }
  
  notes.push(newNote)
  saveBookNotes(notes)
}

export function updateBookNote(noteId: string, updates: Partial<BookNote>): void {
  const notes = getBookNotes()
  const noteIndex = notes.findIndex(note => note.id === noteId)
  
  if (noteIndex !== -1) {
    notes[noteIndex] = { ...notes[noteIndex], ...updates, updatedAt: new Date().toISOString() }
    saveBookNotes(notes)
  }
}

export function deleteBookNote(noteId: string): void {
  const notes = getBookNotes()
  const filtered = notes.filter(note => note.id !== noteId)
  saveBookNotes(filtered)
}

// Achievements Functions
export function getUserAchievements(): Achievement[] {
  return safeGetJSON<Achievement[]>(USER_ACHIEVEMENTS_KEY, [])
}

export function saveUserAchievements(achievements: Achievement[]): void {
  safeSetJSON(USER_ACHIEVEMENTS_KEY, achievements)
}

export function unlockAchievement(achievementId: string): boolean {
  const achievements = getUserAchievements()
  const achievement = achievements.find(a => a.id === achievementId)
  
  if (achievement && !achievement.unlockedAt) {
    achievement.unlockedAt = new Date().toISOString()
    // Ensure progress reflects completion when unlocked
    if (typeof achievement.maxProgress === 'number') {
      achievement.progress = achievement.maxProgress
    } else if (typeof achievement.progress !== 'number') {
      achievement.progress = 1
    }
    saveUserAchievements(achievements)
    return true // New achievement unlocked
  }
  return false // Already unlocked or doesn't exist
}

// User Stats Functions
export function getUserStats(): UserStats {
  return safeGetJSON<UserStats>(USER_STATS_KEY, {
    totalBooksLiked: 0,
    totalBooksRead: 0,
    totalPagesRead: 0,
    totalReadingTime: 0,
    totalReviews: 0,
    totalNotes: 0,
    currentStreak: 0,
    longestStreak: 0,
    lastActivityDate: "",
    level: 1,
    totalPoints: 0,
    genrePreferences: {},
    moodPreferences: {},
    averageRating: 0,
    favoritesCount: 0,
    joinDate: new Date().toISOString()
  })
}

export function saveUserStats(stats: UserStats): void {
  safeSetJSON(USER_STATS_KEY, stats)
}

export function updateUserStats(updates: Partial<UserStats>): void {
  const currentStats = getUserStats()
  const updatedStats = { ...currentStats, ...updates }
  saveUserStats(updatedStats)
}

// Points and Experience Functions
export function calculateLevel(totalPoints: number): number {
  // Level formula: level = floor(sqrt(points / 100)) + 1
  return Math.floor(Math.sqrt(totalPoints / 100)) + 1
}

export function getPointsForNextLevel(currentLevel: number): number {
  // Points needed for next level: (level * level - 1) * 100
  return (currentLevel * currentLevel) * 100
}

export function addPoints(points: number, activity: string): boolean {
  const stats = getUserStats()
  const oldLevel = stats.level
  
  stats.totalPoints += points
  stats.level = calculateLevel(stats.totalPoints)
  stats.lastActivityDate = new Date().toISOString()
  
  updateUserStats(stats)
  
  // Return true if level up occurred
  return stats.level > oldLevel
}

// Shelves Functions
const DEFAULT_SHELVES: Shelf[] = [
  { id: "want-to-read", name: "Want to Read", emoji: "\u{1F4DA}", isDefault: true, createdAt: new Date().toISOString() },
  { id: "currently-reading", name: "Currently Reading", emoji: "\u{1F4D6}", isDefault: true, createdAt: new Date().toISOString() },
  { id: "finished", name: "Finished", emoji: "\u2705", isDefault: true, createdAt: new Date().toISOString() },
]

export function getShelves(): Shelf[] {
  const stored = safeGetJSON<Shelf[] | null>(SHELVES_KEY, null)
  if (stored) return stored
  // Seed defaults on first access
  safeSetJSON(SHELVES_KEY, DEFAULT_SHELVES)
  return DEFAULT_SHELVES
}

export function saveShelves(shelves: Shelf[]): void {
  safeSetJSON(SHELVES_KEY, shelves)
}

export function createShelf(name: string, emoji: string): Shelf {
  const shelves = getShelves()
  const newShelf: Shelf = {
    id: Date.now().toString() + Math.random().toString(36).substr(2, 6),
    name,
    emoji,
    isDefault: false,
    createdAt: new Date().toISOString(),
  }
  shelves.push(newShelf)
  saveShelves(shelves)
  return newShelf
}

export function renameShelf(shelfId: string, name: string, emoji: string): void {
  const shelves = getShelves()
  const idx = shelves.findIndex(s => s.id === shelfId)
  if (idx !== -1) {
    shelves[idx] = { ...shelves[idx], name, emoji }
    saveShelves(shelves)
  }
}

export function deleteShelf(shelfId: string): void {
  const shelves = getShelves().filter(s => s.id !== shelfId)
  saveShelves(shelves)
  // Also remove assignments for this shelf
  const assignments = getShelfAssignments().filter(a => a.shelfId !== shelfId)
  saveShelfAssignments(assignments)
}

export function getShelfAssignments(): BookShelfAssignment[] {
  return safeGetJSON<BookShelfAssignment[]>(SHELF_ASSIGNMENTS_KEY, [])
}

export function saveShelfAssignments(assignments: BookShelfAssignment[]): void {
  safeSetJSON(SHELF_ASSIGNMENTS_KEY, assignments)
}

export function assignBookToShelf(bookId: string, shelfId: string): void {
  const assignments = getShelfAssignments()
  const exists = assignments.some(a => a.bookId === bookId && a.shelfId === shelfId)
  if (!exists) {
    assignments.push({ bookId, shelfId, addedAt: new Date().toISOString() })
    saveShelfAssignments(assignments)
  }
}

export function removeBookFromShelf(bookId: string, shelfId: string): void {
  const assignments = getShelfAssignments().filter(
    a => !(a.bookId === bookId && a.shelfId === shelfId)
  )
  saveShelfAssignments(assignments)
}

export function getShelvesForBook(bookId: string): string[] {
  return getShelfAssignments()
    .filter(a => a.bookId === bookId)
    .map(a => a.shelfId)
}

export function getBooksForShelf(shelfId: string): string[] {
  return getShelfAssignments()
    .filter(a => a.shelfId === shelfId)
    .map(a => a.bookId)
}

// Daily Pick Functions
export function getDailyPick(): DailyPick | null {
  return safeGetJSON<DailyPick | null>(DAILY_PICK_KEY, null)
}

export function saveDailyPick(pick: DailyPick): void {
  safeSetJSON(DAILY_PICK_KEY, pick)
}

// Cover URL migration
const COVER_MIGRATION_KEY = "bookswipe_cover_migration_v4"

// Backup Tracking Functions
export function markBackupExported(): void {
  safeSetJSON(LAST_EXPORT_KEY, new Date().toISOString())
}

export function getLastExportDate(): string | null {
  return safeGetJSON<string | null>(LAST_EXPORT_KEY, null)
}

export function dismissBackupReminder(): void {
  safeSetJSON(BACKUP_DISMISSED_KEY, new Date().toISOString())
}

export function shouldShowBackupReminder(): boolean {
  const likedBooks = getLikedBooks()
  if (likedBooks.length < 10) return false

  const lastExport = getLastExportDate()
  const lastDismissed = safeGetJSON<string | null>(BACKUP_DISMISSED_KEY, null)

  const thirtyDaysMs = 30 * 24 * 60 * 60 * 1000
  const sevenDaysMs = 7 * 24 * 60 * 60 * 1000
  const now = Date.now()

  // Dismissed within last 7 days? Don't show
  if (lastDismissed && now - new Date(lastDismissed).getTime() < sevenDaysMs) {
    return false
  }

  // Never exported, or exported 30+ days ago? Show
  if (!lastExport) return true
  return now - new Date(lastExport).getTime() > thirtyDaysMs
}

// Cover URL migration
export function migrateCoverUrls(): void {
  if (typeof window === 'undefined') return
  try {
    if (localStorage.getItem(COVER_MIGRATION_KEY)) return

    // Nuclear clear: wipe the book cache so all books are re-fetched with new cover logic
    const { clearBookCache } = require("./book-cache")
    clearBookCache()

    localStorage.setItem(COVER_MIGRATION_KEY, new Date().toISOString())
  } catch {
    // Migration is best-effort
  }
}
