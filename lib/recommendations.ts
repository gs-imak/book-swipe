"use client"

import { sampleBooks, type Book } from "./book-data"
import { getLikedBooks } from "./storage"

export interface RecommendationReason {
  type: "genre" | "mood" | "author" | "rating"
  description: string
}

export interface RecommendedBook extends Book {
  reasons: RecommendationReason[]
}

export interface MoodFilter {
  id: string
  name: string
  emoji: string
  description: string
  keywords: string[]
}

export interface TimeSuggestion {
  id: string
  name: string
  emoji: string
  description: string
  minHours?: number
  maxHours?: number
}

export const moodFilters: MoodFilter[] = [
  { id: "uplifting", name: "Uplifting", emoji: "😊", description: "Feel-good and heartwarming reads", keywords: ["Uplifting", "Heartwarming", "Feel-good", "Cozy", "Beautiful"] },
  { id: "romantic", name: "Romantic", emoji: "💖", description: "Love stories and tender moments", keywords: ["Romantic", "Emotional", "Heartwarming"] },
  { id: "suspenseful", name: "Suspenseful", emoji: "🕵️", description: "Twists, tension, and fast plots", keywords: ["Suspenseful", "Thrilling", "Dark", "Twisty", "Gripping"] },
  { id: "epic", name: "Epic", emoji: "🗡️", description: "Big worlds and long adventures", keywords: ["Epic", "Magical", "Adventure", "Immersive"] },
  { id: "thoughtful", name: "Thoughtful", emoji: "🧠", description: "Philosophical and contemplative", keywords: ["Philosophical", "Thought-provoking", "Contemplative", "Reflective"] },
  { id: "funny", name: "Funny", emoji: "😄", description: "Humorous and light reads", keywords: ["Humorous", "Funny", "Light-hearted"] },
  { id: "inspiring", name: "Inspiring", emoji: "🌟", description: "Motivating and empowering", keywords: ["Inspiring", "Motivational", "Empowering", "Practical"] },
  { id: "dark", name: "Dark", emoji: "🌒", description: "Brooding, heavy, and intense", keywords: ["Dark", "Melancholic", "Powerful"] }
]

export const timeBasedSuggestions: TimeSuggestion[] = [
  { id: "quick-bite", name: "< 2 hrs", emoji: "⚡", description: "Perfect for a quick session", maxHours: 2 },
  { id: "short-session", name: "2–4 hrs", emoji: "☕", description: "Nice afternoon read", minHours: 2, maxHours: 4 },
  { id: "unwind", name: "4–6 hrs", emoji: "🌆", description: "Unwind in the evening", minHours: 4, maxHours: 6 },
  { id: "weekend", name: "6–8 hrs", emoji: "📚", description: "Great for a weekend", minHours: 6, maxHours: 8 },
  { id: "marathon", name: "> 8 hrs", emoji: "🚀", description: "Settle in for a long ride", minHours: 8 }
]

function estimateHoursFromString(readingTime: string): number {
  const ltMatch = readingTime.match(/<\s*(\d+)\s*hour/i)
  if (ltMatch) return Math.max(0.5, Number(ltMatch[1]) - 0.5)
  const rangeMatch = readingTime.match(/(\d+)\s*-\s*(\d+)\s*hour/i)
  if (rangeMatch) return (Number(rangeMatch[1]) + Number(rangeMatch[2])) / 2
  const singleMatch = readingTime.match(/(\d+)\s*hour/i)
  if (singleMatch) return Number(singleMatch[1])
  return 4
}

function buildUserPreferenceMaps(liked: Book[]) {
  const genreFrequency = new Map<string, number>()
  const moodFrequency = new Map<string, number>()
  const authorFrequency = new Map<string, number>()

  liked.forEach((book) => {
    book.genre.forEach((g) => genreFrequency.set(g, (genreFrequency.get(g) || 0) + 1))
    book.mood.forEach((m) => moodFrequency.set(m, (moodFrequency.get(m) || 0) + 1))
    authorFrequency.set(book.author, (authorFrequency.get(book.author) || 0) + 1)
  })

  return { genreFrequency, moodFrequency, authorFrequency }
}

function scoreBookForUser(book: Book, pref: ReturnType<typeof buildUserPreferenceMaps>): { score: number; reasons: RecommendationReason[] } {
  let score = 0
  const reasons: RecommendationReason[] = []

  const genreMatches = book.genre.filter((g) => pref.genreFrequency.has(g))
  if (genreMatches.length > 0) {
    score += 3 * genreMatches.length
    reasons.push({ type: "genre", description: `Matches your preferred genre: ${genreMatches[0]}` })
  }

  const moodMatches = book.mood.filter((m) => pref.moodFrequency.has(m))
  if (moodMatches.length > 0) {
    score += 2 * moodMatches.length
    reasons.push({ type: "mood", description: `Captures a mood you like: ${moodMatches[0]}` })
  }

  if (pref.authorFrequency.has(book.author)) {
    score += 2
    reasons.push({ type: "author", description: `By an author you enjoyed: ${book.author}` })
  }

  score += book.rating / 5
  reasons.push({ type: "rating", description: `Highly rated (${book.rating})` })

  return { score, reasons }
}

export function getSmartRecommendations(count = 8): RecommendedBook[] {
  const liked = getLikedBooks()
  if (liked.length === 0) return []

  const likedIds = new Set(liked.map((b) => b.id))
  const preferences = buildUserPreferenceMaps(liked)

  return sampleBooks
    .filter((b) => !likedIds.has(b.id))
    .map((b) => {
      const { score, reasons } = scoreBookForUser(b, preferences)
      return { ...b, reasons, _score: score } as unknown as RecommendedBook & { _score: number }
    })
    .sort((a, b) => (b as any)._score - (a as any)._score)
    .slice(0, count)
    .map(({ _score, ...rest }) => rest as RecommendedBook)
}

export function getDiverseRecommendations(count = 6): Book[] {
  const liked = getLikedBooks()
  const preferences = buildUserPreferenceMaps(liked)
  const likedIds = new Set(liked.map((b) => b.id))

  return sampleBooks
    .filter((b) => !likedIds.has(b.id))
    .map((b) => {
      const genreOverlap = b.genre.filter((g) => preferences.genreFrequency.has(g)).length
      const moodOverlap = b.mood.filter((m) => preferences.moodFrequency.has(m)).length
      const authorOverlap = preferences.authorFrequency.has(b.author) ? 1 : 0
      const overlap = genreOverlap + moodOverlap + authorOverlap
      return { book: b, overlap }
    })
    .sort((a, b) => a.overlap - b.overlap || b.book.rating - a.book.rating)
    .slice(0, count)
    .map((x) => x.book)
}

export function getBooksByMood(mood: MoodFilter): Book[] {
  const keywords = new Set(mood.keywords.map((k) => k.toLowerCase()))
  return sampleBooks.filter((b) => b.mood.some((m) => keywords.has(m.toLowerCase())))
}

export function getBooksByTime(time: TimeSuggestion): Book[] {
  return sampleBooks.filter((b) => {
    const hours = estimateHoursFromString(b.readingTime)
    if (typeof time.minHours === "number" && hours < time.minHours) return false
    if (typeof time.maxHours === "number" && hours > time.maxHours) return false
    return true
  })
}




