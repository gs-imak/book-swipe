"use client"

import { type Book } from "./book-data"
import { getLikedBooks, getDailyPick, saveDailyPick, type DailyPick } from "./storage"
import { getCachedBooks } from "./book-cache"
import { scoreBooks, applyMMR, type RecommendationReason } from "./scoring-engine"

function getTodayString(): string {
  const d = new Date()
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`
}

export async function generateDailyPick(): Promise<DailyPick | null> {
  // Check if we already have a valid pick for today
  const existing = getDailyPick()
  const today = getTodayString()

  if (existing && existing.date === today && !existing.dismissed) {
    return existing
  }

  const liked = getLikedBooks()
  if (liked.length < 3) return null

  const likedIds = new Set(liked.map((b) => b.id))
  const allBooks = getCachedBooks()
  let candidates = allBooks.filter((b) => !likedIds.has(b.id))

  if (candidates.length === 0) return null

  // Score using TF-IDF engine
  const scored = scoreBooks(candidates, liked, {
    communityBoost: true,
    excludeIds: likedIds,
  })

  // Apply MMR for diversity
  const diverse = applyMMR(scored, 5, 0.7)

  if (diverse.length === 0) return null

  // Pick from top 3 with slight randomization
  const topN = Math.min(3, diverse.length)
  const randomIdx = Math.floor(Math.random() * topN)
  const picked = diverse[randomIdx]

  const pick: DailyPick = {
    book: picked.book,
    reasons: picked.reasons,
    date: today,
    dismissed: false,
    saved: false,
  }

  saveDailyPick(pick)
  return pick
}

export function dismissDailyPick(): void {
  const pick = getDailyPick()
  if (pick) {
    saveDailyPick({ ...pick, dismissed: true })
  }
}

export function saveDailyPickToLibrary(): void {
  const pick = getDailyPick()
  if (pick) {
    saveDailyPick({ ...pick, saved: true })
  }
}
