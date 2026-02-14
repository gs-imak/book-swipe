"use client"

import { type Book } from "./book-data"
import { getLikedBooks } from "./storage"
import { getCachedBooks } from "./book-cache"
import { fetchPersonalizedBooks } from "./books-api"
import {
  scoreBooks,
  applyMMR,
  ensureGenreDiversity,
  type RecommendationReason,
} from "./scoring-engine"

export type { RecommendationReason }

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
  { id: "dark", name: "Dark", emoji: "🌒", description: "Brooding, heavy, and intense", keywords: ["Dark", "Melancholic", "Powerful"] },
]

export const timeBasedSuggestions: TimeSuggestion[] = [
  { id: "quick-bite", name: "< 2 hrs", emoji: "⚡", description: "Perfect for a quick session", maxHours: 2 },
  { id: "short-session", name: "2–4 hrs", emoji: "☕", description: "Nice afternoon read", minHours: 2, maxHours: 4 },
  { id: "unwind", name: "4–6 hrs", emoji: "🌆", description: "Unwind in the evening", minHours: 4, maxHours: 6 },
  { id: "weekend", name: "6–8 hrs", emoji: "📚", description: "Great for a weekend", minHours: 6, maxHours: 8 },
  { id: "marathon", name: "> 8 hrs", emoji: "🚀", description: "Settle in for a long ride", minHours: 8 },
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

// TF-IDF powered smart recommendations using full book pool
export async function getSmartRecommendations(count = 8): Promise<RecommendedBook[]> {
  const liked = getLikedBooks()
  if (liked.length === 0) return []

  const likedIds = new Set(liked.map((b) => b.id))
  let allBooks = getCachedBooks()
  let candidates = allBooks.filter((b) => !likedIds.has(b.id))

  // If cache is too small, fetch personalized books with retry
  if (candidates.length < count * 2) {
    for (let attempt = 0; attempt < 3; attempt++) {
      try {
        const fresh = await fetchPersonalizedBooks(liked)
        const freshFiltered = fresh.filter((b) => !likedIds.has(b.id))
        candidates = [...candidates, ...freshFiltered]
        // Deduplicate
        const seen = new Set<string>()
        candidates = candidates.filter((b) => {
          if (seen.has(b.id)) return false
          seen.add(b.id)
          return true
        })
        break // Success — stop retrying
      } catch {
        if (attempt < 2) {
          await new Promise((r) => setTimeout(r, 1000 * (attempt + 1))) // 1s, 2s backoff
        }
      }
    }
  }

  if (candidates.length === 0) return []

  // Score using TF-IDF engine
  const scored = scoreBooks(candidates, liked, {
    communityBoost: true,
    excludeIds: likedIds,
  })

  // Apply MMR for diversity
  const diverse = applyMMR(scored, count, 0.7)

  return diverse.map((s) => ({
    ...s.book,
    reasons: s.reasons,
  }))
}

// Pick books that are different from what the user has liked but still high quality
export function getDiverseRecommendations(count = 6): Book[] {
  const liked = getLikedBooks()
  const likedIds = new Set(liked.map((b) => b.id))
  const allBooks = getCachedBooks()
  const candidates = allBooks.filter((b) => !likedIds.has(b.id))

  if (liked.length === 0) {
    return candidates
      .sort((a, b) => b.rating - a.rating)
      .slice(0, count)
  }

  // Score then pick from the BOTTOM of relevance (low similarity = diverse)
  const scored = scoreBooks(candidates, liked, { excludeIds: likedIds })

  const diverseCandidates = scored
    .filter((s) => s.score < 0.3 && s.book.rating >= 3.5)
    .sort((a, b) => b.book.rating - a.book.rating)

  // If not enough low-similarity books, relax the threshold
  const pool =
    diverseCandidates.length >= count
      ? diverseCandidates
      : scored
          .sort((a, b) => a.score - b.score || b.book.rating - a.book.rating)
          .slice(0, count * 2)

  return ensureGenreDiversity(pool, 3)
    .slice(0, count)
    .map((s) => s.book)
}

// Filter by mood from full cache
export function getBooksByMood(mood: MoodFilter): Book[] {
  const allBooks = getCachedBooks()
  const keywords = new Set(mood.keywords.map((k) => k.toLowerCase()))

  return allBooks
    .filter((b) => b.mood.some((m) => keywords.has(m.toLowerCase())))
    .sort((a, b) => b.rating - a.rating)
    .slice(0, 20)
}

// Filter by reading time from full cache
export function getBooksByTime(time: TimeSuggestion): Book[] {
  const allBooks = getCachedBooks()

  return allBooks
    .filter((b) => {
      const hours = estimateHoursFromString(b.readingTime)
      if (typeof time.minHours === "number" && hours < time.minHours) return false
      if (typeof time.maxHours === "number" && hours > time.maxHours) return false
      return true
    })
    .sort((a, b) => b.rating - a.rating)
    .slice(0, 20)
}
