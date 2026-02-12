"use client"

import { type Book } from "./book-data"
import { getLikedBooks } from "./storage"
import { getCachedBooks } from "./book-cache"
import { scoreBooks } from "./scoring-engine"

export interface BookChain {
  startBook: Book
  chain: Book[]
  theme: string
}

function getChainTheme(books: Book[]): string {
  // Find the most common genre across the chain
  const genreCounts: Record<string, number> = {}
  books.forEach(b => {
    b.genre.forEach(g => {
      genreCounts[g] = (genreCounts[g] || 0) + 1
    })
  })

  const topGenre = Object.entries(genreCounts)
    .sort((a, b) => b[1] - a[1])
    .map(([g]) => g)[0] || "Books"

  // Find common mood
  const moodCounts: Record<string, number> = {}
  books.forEach(b => {
    b.mood.forEach(m => {
      moodCounts[m] = (moodCounts[m] || 0) + 1
    })
  })

  const topMood = Object.entries(moodCounts)
    .sort((a, b) => b[1] - a[1])
    .map(([m]) => m)[0] || ""

  if (topMood) return `${topMood} ${topGenre}`
  return topGenre
}

export function generateBookChain(startBook: Book, chainLength: number = 4): BookChain | null {
  const liked = getLikedBooks()
  const allBooks = getCachedBooks()
  const likedIds = new Set(liked.map(b => b.id))

  // Pool: liked books + cached books, excluding the start book
  const pool = [...liked, ...allBooks].filter(b => b.id !== startBook.id)
  // Deduplicate
  const seenIds = new Set<string>()
  const uniquePool = pool.filter(b => {
    if (seenIds.has(b.id)) return false
    seenIds.add(b.id)
    return true
  })

  if (uniquePool.length < chainLength) return null

  const chain: Book[] = []
  let currentBook = startBook
  const usedIds = new Set<string>([startBook.id])

  for (let i = 0; i < chainLength; i++) {
    // Score remaining candidates based on similarity to the current book
    const candidates = uniquePool.filter(b => !usedIds.has(b.id))
    if (candidates.length === 0) break

    const scored = scoreBooks(candidates, [currentBook], {
      excludeIds: usedIds,
    })

    if (scored.length === 0) break

    // Pick from top 5 with slight variation to keep it interesting
    const topN = Math.min(5, scored.length)
    const pick = scored[Math.floor(Math.random() * topN)]
    chain.push(pick.book)
    usedIds.add(pick.book.id)
    currentBook = pick.book
  }

  if (chain.length < 2) return null

  return {
    startBook,
    chain,
    theme: getChainTheme([startBook, ...chain]),
  }
}

export function generateChainFromLiked(count: number = 3): BookChain[] {
  const liked = getLikedBooks()
  if (liked.length === 0) return []

  const chains: BookChain[] = []
  // Pick random starting books from liked
  const shuffled = [...liked].sort(() => Math.random() - 0.5)
  const starters = shuffled.slice(0, Math.min(count, shuffled.length))

  starters.forEach(starter => {
    const chain = generateBookChain(starter, 3)
    if (chain) {
      chains.push(chain)
    }
  })

  return chains
}
