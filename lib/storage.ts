"use client"

import { Book } from "./book-data"

const LIKED_BOOKS_KEY = "bookswipe_liked_books"
const READING_PROGRESS_KEY = "bookswipe_reading_progress"
const READING_GOALS_KEY = "bookswipe_reading_goals"
const BOOK_REVIEWS_KEY = "bookswipe_book_reviews"
const BOOK_NOTES_KEY = "bookswipe_book_notes"
const USER_ACHIEVEMENTS_KEY = "bookswipe_achievements"
const USER_STATS_KEY = "bookswipe_user_stats"

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

// Liked Books Functions
export function saveLikedBooks(books: Book[]): void {
  if (typeof window !== 'undefined') {
    localStorage.setItem(LIKED_BOOKS_KEY, JSON.stringify(books))
  }
}

export function getLikedBooks(): Book[] {
  if (typeof window !== 'undefined') {
    const stored = localStorage.getItem(LIKED_BOOKS_KEY)
    return stored ? JSON.parse(stored) : []
  }
  return []
}

export function clearLikedBooks(): void {
  if (typeof window !== 'undefined') {
    localStorage.removeItem(LIKED_BOOKS_KEY)
  }
}

// Reading Progress Functions
export function saveReadingProgress(progress: ReadingProgress[]): void {
  if (typeof window !== 'undefined') {
    localStorage.setItem(READING_PROGRESS_KEY, JSON.stringify(progress))
  }
}

export function getReadingProgress(): ReadingProgress[] {
  if (typeof window !== 'undefined') {
    const stored = localStorage.getItem(READING_PROGRESS_KEY)
    return stored ? JSON.parse(stored) : []
  }
  return []
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
  if (typeof window !== 'undefined') {
    localStorage.setItem(READING_GOALS_KEY, JSON.stringify(goals))
  }
}

export function getReadingGoals(): ReadingGoals {
  if (typeof window !== 'undefined') {
    const stored = localStorage.getItem(READING_GOALS_KEY)
    if (stored) {
      return JSON.parse(stored)
    }
  }
  
  // Default goals for new users
  return {
    yearlyTarget: 12,
    currentYear: new Date().getFullYear(),
    booksCompleted: 0,
    pagesRead: 0,
    timeSpentMinutes: 0,
    streak: 0,
    lastReadDate: ""
  }
}

export function updateReadingGoals(updates: Partial<ReadingGoals>): void {
  const currentGoals = getReadingGoals()
  const updatedGoals = { ...currentGoals, ...updates }
  saveReadingGoals(updatedGoals)
}

// Book Reviews Functions
export function saveBookReviews(reviews: BookReview[]): void {
  if (typeof window !== 'undefined') {
    localStorage.setItem(BOOK_REVIEWS_KEY, JSON.stringify(reviews))
  }
}

export function getBookReviews(): BookReview[] {
  if (typeof window !== 'undefined') {
    const stored = localStorage.getItem(BOOK_REVIEWS_KEY)
    return stored ? JSON.parse(stored) : []
  }
  return []
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
  if (typeof window !== 'undefined') {
    localStorage.setItem(BOOK_NOTES_KEY, JSON.stringify(notes))
  }
}

export function getBookNotes(): BookNote[] {
  if (typeof window !== 'undefined') {
    const stored = localStorage.getItem(BOOK_NOTES_KEY)
    return stored ? JSON.parse(stored) : []
  }
  return []
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
  if (typeof window !== 'undefined') {
    const stored = localStorage.getItem(USER_ACHIEVEMENTS_KEY)
    return stored ? JSON.parse(stored) : []
  }
  return []
}

export function saveUserAchievements(achievements: Achievement[]): void {
  if (typeof window !== 'undefined') {
    localStorage.setItem(USER_ACHIEVEMENTS_KEY, JSON.stringify(achievements))
  }
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
  if (typeof window !== 'undefined') {
    const stored = localStorage.getItem(USER_STATS_KEY)
    if (stored) {
      return JSON.parse(stored)
    }
  }
  
  // Default stats for new users
  return {
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
  }
}

export function saveUserStats(stats: UserStats): void {
  if (typeof window !== 'undefined') {
    localStorage.setItem(USER_STATS_KEY, JSON.stringify(stats))
  }
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
