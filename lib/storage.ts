"use client"

import { Book, UserPreferences } from "./book-data"

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
    // QuotaExceededError or other storage failure — notify UI
    if (typeof window !== 'undefined') {
      window.dispatchEvent(new CustomEvent('bookswipe:storage-error', {
        detail: { key, error: 'Storage is full. Some data may not be saved.' }
      }))
    }
    return false
  }
}

const ACTIVITY_LOG_KEY = "bookswipe_activity_log"
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
const ONBOARDED_KEY = "bookswipe_onboarded"
const USER_PREFERENCES_KEY = "bookswipe_user_preferences"

export interface ActivityEntry {
  id: string
  type: "liked" | "finished" | "started_reading" | "reviewed" | "added_to_shelf" | "created_collection" | "achievement_unlocked"
  bookId?: string
  bookTitle?: string
  detail?: string
  timestamp: string
}

export function logActivity(entry: Omit<ActivityEntry, "id" | "timestamp">): void {
  const log = safeGetJSON<ActivityEntry[]>(ACTIVITY_LOG_KEY, [])
  const newEntry: ActivityEntry = {
    ...entry,
    id: Date.now().toString(36) + Math.random().toString(36).substr(2, 6),
    timestamp: new Date().toISOString(),
  }
  log.unshift(newEntry)
  safeSetJSON(ACTIVITY_LOG_KEY, log.slice(0, 200))
}

export function getActivityLog(): ActivityEntry[] {
  return safeGetJSON<ActivityEntry[]>(ACTIVITY_LOG_KEY, [])
}

export interface ReadingProgress {
  bookId: string
  book: Book
  currentPage: number
  totalPages: number
  startedDate: string
  lastReadDate: string
  timeSpentMinutes: number
  notes?: string
  status: "reading" | "paused" | "completed" | "dnf"
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
  type: 'highlight' | 'note' | 'quote' | 'bookmark'
  page?: number
  blockIndex?: number
  selectedText?: string
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
  contentWarnings?: string[]
  format?: "print" | "ebook" | "audiobook"
  pace?: "slow" | "medium" | "fast"
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

/** Atomic add: reads, deduplicates, writes in one call to prevent race conditions */
export function addLikedBook(book: Book): boolean {
  const current = getLikedBooks()
  if (current.some(b => b.id === book.id)) return false
  const updated = [...current, book]
  const success = safeSetJSON(LIKED_BOOKS_KEY, updated)
  if (success && typeof window !== 'undefined') {
    window.dispatchEvent(new CustomEvent('bookswipe:liked-changed', { detail: updated.length }))
    logActivity({ type: "liked", bookId: book.id, bookTitle: book.title })
  }
  return success
}

/** Atomic remove: reads, filters, writes in one call to prevent race conditions */
export function removeLikedBook(bookId: string): Book[] {
  const current = getLikedBooks()
  const updated = current.filter(b => b.id !== bookId)
  safeSetJSON(LIKED_BOOKS_KEY, updated)
  if (typeof window !== 'undefined') {
    window.dispatchEvent(new CustomEvent('bookswipe:liked-changed', { detail: updated.length }))
  }
  return updated
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
    logActivity({ type: "started_reading", bookId: book.id, bookTitle: book.title })
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
  // Sanitize user-generated text: strip control characters, cap length
  const sanitized: BookReview = {
    ...review,
    review: review.review
      ? review.review.replace(/[\x00-\x08\x0b\x0c\x0e-\x1f]/g, "").slice(0, 5000)
      : undefined,
    mood: review.mood ? review.mood.slice(0, 100) : "",
    tags: review.tags?.map(t => t.replace(/[\x00-\x1f]/g, "").slice(0, 50)).slice(0, 20) || [],
  }

  const reviews = getBookReviews()
  const existingIndex = reviews.findIndex(r => r.bookId === sanitized.bookId)

  if (existingIndex !== -1) {
    reviews[existingIndex] = { ...sanitized, updatedAt: new Date().toISOString() }
  } else {
    reviews.push({ ...sanitized, createdAt: new Date().toISOString(), updatedAt: new Date().toISOString() })
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
  { id: "dnf", name: "Did Not Finish", emoji: "\u{1F6AB}", isDefault: true, createdAt: new Date().toISOString() },
]

export function getShelves(): Shelf[] {
  const stored = safeGetJSON<Shelf[] | null>(SHELVES_KEY, null)
  if (!stored) {
    safeSetJSON(SHELVES_KEY, DEFAULT_SHELVES)
    return DEFAULT_SHELVES
  }
  // Ensure all default shelves exist (for upgrades)
  const ids = new Set(stored.map(s => s.id))
  let updated = false
  DEFAULT_SHELVES.forEach(ds => {
    if (!ids.has(ds.id)) {
      stored.push(ds)
      updated = true
    }
  })
  if (updated) safeSetJSON(SHELVES_KEY, stored)
  return stored
}

export function saveShelves(shelves: Shelf[]): void {
  safeSetJSON(SHELVES_KEY, shelves)
}

export function createShelf(name: string, emoji: string): Shelf {
  const shelves = getShelves()
  // Sanitize inputs: cap length, strip control characters
  const safeName = name.replace(/[\x00-\x1f]/g, "").slice(0, 50)
  const safeEmoji = emoji.slice(0, 4)
  const newShelf: Shelf = {
    id: Date.now().toString() + Math.random().toString(36).substr(2, 6),
    name: safeName,
    emoji: safeEmoji,
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
    const safeName = name.replace(/[\x00-\x1f]/g, "").slice(0, 50)
    const safeEmoji = emoji.slice(0, 4)
    shelves[idx] = { ...shelves[idx], name: safeName, emoji: safeEmoji }
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
const COVER_MIGRATION_KEY = "bookswipe_cover_migration_v7"

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

// Onboarding & Preferences persistence
export function isOnboarded(): boolean {
  return safeGetJSON<boolean>(ONBOARDED_KEY, false)
}

export function setOnboarded(): void {
  safeSetJSON(ONBOARDED_KEY, true)
}

export function getSavedPreferences(): UserPreferences | null {
  return safeGetJSON<UserPreferences | null>(USER_PREFERENCES_KEY, null)
}

export function savePreferences(prefs: UserPreferences): void {
  safeSetJSON(USER_PREFERENCES_KEY, prefs)
}

// Cover URL migration
export function migrateCoverUrls(): void {
  if (typeof window === 'undefined') return
  try {
    if (localStorage.getItem(COVER_MIGRATION_KEY)) return

    // Nuclear clear: wipe the book cache so all books are re-fetched with new cover logic
    clearBookCacheForMigration()

    localStorage.setItem(COVER_MIGRATION_KEY, new Date().toISOString())
  } catch {
    // Migration is best-effort
  }
}

// Inline cache clear to avoid circular dependency with book-cache.ts
function clearBookCacheForMigration(): void {
  localStorage.removeItem("bookswipe_book_cache")
  localStorage.removeItem("bookswipe_cache_metadata")
}

// ── Passed / swiped-left books (negative signal) ────────────────────────────

const PASSED_BOOKS_KEY = "bookswipe_passed_books"

/** Record a book the user swiped left on (negative signal for recommendations) */
export function addPassedBookId(bookId: string): void {
  const passed = safeGetJSON<string[]>(PASSED_BOOKS_KEY, [])
  if (!passed.includes(bookId)) {
    // Keep last 200 to avoid unbounded growth
    const updated = [...passed, bookId].slice(-200)
    safeSetJSON(PASSED_BOOKS_KEY, updated)
  }
}

/** Get all passed book IDs */
export function getPassedBookIds(): string[] {
  return safeGetJSON<string[]>(PASSED_BOOKS_KEY, [])
}

// ── Hidden / Archived books ──────────────────────────────────────────────────

const HIDDEN_BOOKS_KEY = "bookswipe_hidden_books"

/** Get list of hidden book IDs */
export function getHiddenBookIds(): string[] {
  return safeGetJSON<string[]>(HIDDEN_BOOKS_KEY, [])
}

/** Hide a book from library view (doesn't delete it) */
export function hideBook(bookId: string): void {
  const hidden = getHiddenBookIds()
  if (!hidden.includes(bookId)) {
    hidden.push(bookId)
    safeSetJSON(HIDDEN_BOOKS_KEY, hidden)
  }
}

/** Unhide a book */
export function unhideBook(bookId: string): void {
  const hidden = getHiddenBookIds().filter(id => id !== bookId)
  safeSetJSON(HIDDEN_BOOKS_KEY, hidden)
}

// ── Book Collections ────────────────────────────────────────────────────────

const COLLECTIONS_KEY = "bookswipe_collections"

export interface BookCollection {
  id: string
  name: string
  description: string
  emoji: string
  bookIds: string[]
  createdAt: string
}

export function getCollections(): BookCollection[] {
  return safeGetJSON<BookCollection[]>(COLLECTIONS_KEY, [])
}

export function saveCollection(collection: BookCollection): void {
  const collections = getCollections()
  const existingIndex = collections.findIndex(c => c.id === collection.id)
  if (existingIndex !== -1) {
    collections[existingIndex] = collection
  } else {
    collections.push(collection)
  }
  safeSetJSON(COLLECTIONS_KEY, collections)
}

export function deleteCollection(id: string): void {
  const collections = getCollections().filter(c => c.id !== id)
  safeSetJSON(COLLECTIONS_KEY, collections)
}

export function addBookToCollection(collectionId: string, bookId: string): void {
  const collections = getCollections()
  const idx = collections.findIndex(c => c.id === collectionId)
  if (idx !== -1 && !collections[idx].bookIds.includes(bookId)) {
    collections[idx].bookIds = [...collections[idx].bookIds, bookId]
    safeSetJSON(COLLECTIONS_KEY, collections)
  }
}

export function removeBookFromCollection(collectionId: string, bookId: string): void {
  const collections = getCollections()
  const idx = collections.findIndex(c => c.id === collectionId)
  if (idx !== -1) {
    collections[idx].bookIds = collections[idx].bookIds.filter(id => id !== bookId)
    safeSetJSON(COLLECTIONS_KEY, collections)
  }
}

// ── Gutenberg reading positions ──────────────────────────────────────────────

const READING_POSITION_KEY = "bookswipe_reading_positions"

export function saveReadingPosition(bookId: string, charOffset: number): void {
  const positions = safeGetJSON<Record<string, number>>(READING_POSITION_KEY, {})
  positions[bookId] = charOffset
  safeSetJSON(READING_POSITION_KEY, positions)
}

export function getReadingPosition(bookId: string): number {
  const positions = safeGetJSON<Record<string, number>>(READING_POSITION_KEY, {})
  return positions[bookId] ?? 0
}

// ── Reading time helpers ─────────────────────────────────────────────────────

export function getReadingTimeToday(): number {
  const today = new Date().toISOString().split("T")[0]
  return getReadingProgress()
    .filter(p => p.lastReadDate && p.lastReadDate.startsWith(today))
    .reduce((sum, p) => sum + (p.timeSpentMinutes || 0), 0)
}

export function getTotalReadingTime(): number {
  return getReadingProgress().reduce((sum, p) => sum + (p.timeSpentMinutes || 0), 0)
}

// ── Tags / Labels ───────────────────────────────────────────────────────────

const TAG_DEFINITIONS_KEY = "bookswipe_tag_definitions"
const BOOK_TAGS_KEY = "bookswipe_book_tags"

export const TAG_COLORS = [
  "#ef4444", "#f97316", "#f59e0b", "#22c55e",
  "#3b82f6", "#a855f7", "#ec4899", "#78716c",
] as const

export interface TagDefinition {
  id: string
  name: string
  color: string
  createdAt: string
}

interface BookTagEntry {
  bookId: string
  tagId: string
}

export function getTagDefinitions(): TagDefinition[] {
  return safeGetJSON<TagDefinition[]>(TAG_DEFINITIONS_KEY, [])
}

export function createTag(name: string, color: string): TagDefinition {
  const tags = getTagDefinitions()
  const tag: TagDefinition = {
    id: `tag_${Date.now()}_${Math.random().toString(36).slice(2, 7)}`,
    name: name.trim(),
    color,
    createdAt: new Date().toISOString(),
  }
  tags.push(tag)
  safeSetJSON(TAG_DEFINITIONS_KEY, tags)
  return tag
}

export function deleteTag(id: string): void {
  safeSetJSON(TAG_DEFINITIONS_KEY, getTagDefinitions().filter(t => t.id !== id))
  // Also remove all assignments for this tag
  const entries = safeGetJSON<BookTagEntry[]>(BOOK_TAGS_KEY, [])
  safeSetJSON(BOOK_TAGS_KEY, entries.filter(e => e.tagId !== id))
}

export function getBookTags(bookId: string): TagDefinition[] {
  const entries = safeGetJSON<BookTagEntry[]>(BOOK_TAGS_KEY, [])
  const tagIds = entries.filter(e => e.bookId === bookId).map(e => e.tagId)
  const allTags = getTagDefinitions()
  return allTags.filter(t => tagIds.includes(t.id))
}

export function addTagToBook(bookId: string, tagId: string): void {
  const entries = safeGetJSON<BookTagEntry[]>(BOOK_TAGS_KEY, [])
  if (entries.some(e => e.bookId === bookId && e.tagId === tagId)) return
  entries.push({ bookId, tagId })
  safeSetJSON(BOOK_TAGS_KEY, entries)
}

export function removeTagFromBook(bookId: string, tagId: string): void {
  const entries = safeGetJSON<BookTagEntry[]>(BOOK_TAGS_KEY, [])
  safeSetJSON(BOOK_TAGS_KEY, entries.filter(e => !(e.bookId === bookId && e.tagId === tagId)))
}

export function getBooksWithTag(tagId: string): string[] {
  const entries = safeGetJSON<BookTagEntry[]>(BOOK_TAGS_KEY, [])
  return entries.filter(e => e.tagId === tagId).map(e => e.bookId)
}

// ── Feature discovery / What's New ──────────────────────────────────────────

const FEATURE_VERSION_KEY = "bookswipe_feature_version"
const SEEN_FEATURES_KEY = "bookswipe_seen_features"

export const CURRENT_FEATURE_VERSION = 2

export function getUserFeatureVersion(): number {
  return safeGetJSON<number>(FEATURE_VERSION_KEY, 0)
}

export function setUserFeatureVersion(v: number): void {
  safeSetJSON(FEATURE_VERSION_KEY, v)
}

export function getSeenFeatures(): string[] {
  return safeGetJSON<string[]>(SEEN_FEATURES_KEY, [])
}

export function markFeatureSeen(featureId: string): void {
  const seen = getSeenFeatures()
  if (!seen.includes(featureId)) {
    seen.push(featureId)
    safeSetJSON(SEEN_FEATURES_KEY, seen)
  }
}

export function markAllFeaturesSeen(): void {
  // Mark all known v2 features as seen
  const all = ["tags", "global_search", "activity_feed", "settings", "series_detection", "notifications"]
  safeSetJSON(SEEN_FEATURES_KEY, all)
}

export function isFeatureNew(featureId: string): boolean {
  return !getSeenFeatures().includes(featureId)
}

export function isFeatureSeen(featureId: string): boolean {
  return getSeenFeatures().includes(featureId)
}

// ── Reading pace insights ────────────────────────────────────────────────────

export interface ReadingPaceInsights {
  avgPagesPerHour: number
  bestDay: string
  totalMinutes: number
  booksFinished: number
  avgDaysPerBook: number
  estimatedCompletion: (remainingPages: number) => string
}

export function getReadingPaceInsights(): ReadingPaceInsights {
  const entries = getReadingProgress()

  const DAY_NAMES = ["Sunday", "Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday"]

  // Average pages per hour from entries with tracked time
  const entriesWithTime = entries.filter(p => p.timeSpentMinutes > 0 && p.currentPage > 0)
  let avgPagesPerHour = 0
  if (entriesWithTime.length > 0) {
    const totalPages = entriesWithTime.reduce((s, p) => s + p.currentPage, 0)
    const totalHours = entriesWithTime.reduce((s, p) => s + p.timeSpentMinutes, 0) / 60
    avgPagesPerHour = totalHours > 0 ? Math.round(totalPages / totalHours) : 0
  }

  // Best reading day — group lastReadDate by day of week
  const dayCounts: Record<number, number> = {}
  entries.forEach(p => {
    if (p.lastReadDate) {
      const dow = new Date(p.lastReadDate).getDay()
      dayCounts[dow] = (dayCounts[dow] || 0) + 1
    }
  })
  let bestDayIndex = 0
  let bestDayCount = 0
  Object.entries(dayCounts).forEach(([dayStr, count]) => {
    const day = Number(dayStr)
    if (count > bestDayCount) {
      bestDayCount = count
      bestDayIndex = day
    }
  })
  const bestDay = bestDayCount > 0 ? DAY_NAMES[bestDayIndex] : "N/A"

  // Total reading minutes
  const totalMinutes = entries.reduce((s, p) => s + (p.timeSpentMinutes || 0), 0)

  // Completed books count and avg days per book
  const completed = entries.filter(p => p.status === "completed")
  const booksFinished = completed.length

  let avgDaysPerBook = 0
  if (completed.length > 0) {
    const totalDays = completed.reduce((sum, p) => {
      const start = new Date(p.startedDate).getTime()
      const end = new Date(p.lastReadDate).getTime()
      const diffDays = Math.max(1, Math.round((end - start) / (1000 * 60 * 60 * 24)))
      return sum + diffDays
    }, 0)
    avgDaysPerBook = Math.round(totalDays / completed.length)
  }

  // Estimated completion based on average pace
  const estimatedCompletion = (remainingPages: number): string => {
    if (avgPagesPerHour <= 0 || remainingPages <= 0) return "N/A"
    const hoursNeeded = remainingPages / avgPagesPerHour
    if (hoursNeeded < 1) return "< 1 hour"
    if (hoursNeeded < 24) return `~${Math.round(hoursNeeded)} hour${Math.round(hoursNeeded) !== 1 ? "s" : ""}`
    const daysNeeded = Math.round(hoursNeeded / 24)
    return `~${daysNeeded} day${daysNeeded !== 1 ? "s" : ""}`
  }

  return {
    avgPagesPerHour,
    bestDay,
    totalMinutes,
    booksFinished,
    avgDaysPerBook,
    estimatedCompletion,
  }
}

// ── Smart shelf suggestions ──────────────────────────────────────────────────

const BOOK_VIEW_COUNT_KEY = "bookswipe_book_views"
const DISMISSED_SUGGESTIONS_KEY = "bookswipe_dismissed_suggestions"

export function recordBookView(bookId: string): number {
  const views = safeGetJSON<Record<string, number>>(BOOK_VIEW_COUNT_KEY, {})
  views[bookId] = (views[bookId] || 0) + 1
  safeSetJSON(BOOK_VIEW_COUNT_KEY, views)
  return views[bookId]
}

export function getBookViewCount(bookId: string): number {
  const views = safeGetJSON<Record<string, number>>(BOOK_VIEW_COUNT_KEY, {})
  return views[bookId] || 0
}

export function dismissSuggestion(bookId: string, type: string): void {
  const dismissed = safeGetJSON<string[]>(DISMISSED_SUGGESTIONS_KEY, [])
  const key = `${bookId}::${type}`
  if (!dismissed.includes(key)) {
    dismissed.push(key)
    safeSetJSON(DISMISSED_SUGGESTIONS_KEY, dismissed)
  }
}

export function isSuggestionDismissed(bookId: string, type: string): boolean {
  const dismissed = safeGetJSON<string[]>(DISMISSED_SUGGESTIONS_KEY, [])
  return dismissed.includes(`${bookId}::${type}`)
}
