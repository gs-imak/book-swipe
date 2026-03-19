"use client"

const VOCAB_KEY = "bookswipe_vocabulary"

export interface VocabWord {
  word: string
  definition?: string
  context: string // the sentence it appeared in
  bookId: string
  bookTitle: string
  page?: number
  addedAt: string
  nextReview: string // ISO date for spaced repetition
  interval: number // days until next review
  ease: number // ease factor for SRS
}

export function getVocabulary(): VocabWord[] {
  if (typeof window === "undefined") return []
  try {
    const stored = localStorage.getItem(VOCAB_KEY)
    return stored ? JSON.parse(stored) : []
  } catch {
    return []
  }
}

export function addVocabWord(entry: Omit<VocabWord, "addedAt" | "nextReview" | "interval" | "ease">): void {
  const vocab = getVocabulary()
  // Skip duplicates (same word + same book)
  if (vocab.some(v => v.word.toLowerCase() === entry.word.toLowerCase() && v.bookId === entry.bookId)) return

  const now = new Date()
  const tomorrow = new Date(now)
  tomorrow.setDate(tomorrow.getDate() + 1)

  vocab.push({
    ...entry,
    word: entry.word.toLowerCase(),
    addedAt: now.toISOString(),
    nextReview: tomorrow.toISOString(),
    interval: 1,
    ease: 2.5,
  })

  try {
    localStorage.setItem(VOCAB_KEY, JSON.stringify(vocab))
  } catch { /* ignore */ }
}

export function deleteVocabWord(word: string, bookId: string): void {
  const vocab = getVocabulary().filter(v => !(v.word === word && v.bookId === bookId))
  try {
    localStorage.setItem(VOCAB_KEY, JSON.stringify(vocab))
  } catch { /* ignore */ }
}

/** Get words due for review today */
export function getDueWords(): VocabWord[] {
  const now = new Date().toISOString()
  return getVocabulary().filter(v => v.nextReview <= now)
}

/** Update a word after review using SM-2 algorithm */
export function reviewWord(word: string, bookId: string, quality: number): void {
  // quality: 0 = forgot, 3 = hard, 4 = good, 5 = easy
  const vocab = getVocabulary()
  const idx = vocab.findIndex(v => v.word === word && v.bookId === bookId)
  if (idx === -1) return

  const entry = vocab[idx]
  let { interval, ease } = entry

  if (quality < 3) {
    // Failed — reset to 1 day
    interval = 1
  } else {
    if (interval === 1) {
      interval = 3
    } else if (interval === 3) {
      interval = 7
    } else {
      interval = Math.round(interval * ease)
    }
    // Update ease factor
    ease = Math.max(1.3, ease + (0.1 - (5 - quality) * (0.08 + (5 - quality) * 0.02)))
  }

  const next = new Date()
  next.setDate(next.getDate() + interval)

  vocab[idx] = { ...entry, interval, ease, nextReview: next.toISOString() }

  try {
    localStorage.setItem(VOCAB_KEY, JSON.stringify(vocab))
  } catch { /* ignore */ }
}

export function getVocabCount(): number {
  return getVocabulary().length
}
