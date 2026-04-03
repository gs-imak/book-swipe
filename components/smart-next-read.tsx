"use client"

import { useState, useEffect } from "react"
import { motion, AnimatePresence } from "framer-motion"
import { Wand2, BookOpen, RefreshCw, Star } from "lucide-react"
import { Book } from "@/lib/book-data"
import { getLikedBooks, getReadingProgress, getBookReviews, ReadingProgress, BookReview } from "@/lib/storage"
import { BookCover } from "@/components/book-cover"

interface SmartNextReadProps {
  onBookClick: (book: Book) => void
  onStartReading: (book: Book) => void
}

interface ScoredCandidate {
  book: Book
  score: number
  reason: string
}

function pickNextRead(
  likedBooks: Book[],
  progress: ReadingProgress[],
  reviews: BookReview[],
  skipIds: Set<string>
): { book: Book; reason: string } | null {
  const readingIds: Record<string, boolean> = {}
  progress.forEach(p => { readingIds[p.bookId] = true })

  const reviewedIds: Record<string, boolean> = {}
  reviews.forEach(r => { reviewedIds[r.bookId] = true })

  const candidates = likedBooks.filter(
    b => !readingIds[b.id] && !reviewedIds[b.id] && !skipIds.has(b.id)
  )
  if (candidates.length === 0) return null

  // Build recent genre/mood data from the last 5 reviews
  const recentReviews = reviews.slice(-5)

  const recentGenres: string[] = []
  const recentMoods: string[] = []

  recentReviews.forEach(r => {
    const book = likedBooks.find(b => b.id === r.bookId)
    if (book) {
      book.genre.forEach(g => recentGenres.push(g))
      book.mood.forEach(m => recentMoods.push(m))
    }
  })

  const darkMoods = ["dark", "heavy", "grim", "suspenseful"]
  const lightMoods = ["light", "uplifting", "fun", "cozy", "romantic"]
  const cozyMoods = ["cozy", "relaxing", "romantic"]
  const morningMoods = ["inspiring", "uplifting", "adventurous"]

  const darkCount = recentMoods.filter(m =>
    darkMoods.includes(m.toLowerCase())
  ).length

  const hour = new Date().getHours()

  const scored: ScoredCandidate[] = candidates.map(book => {
    let score = book.rating || 3
    let reason = ""

    // Genre overlap with recent reads
    const genreOverlap = book.genre.filter(g => recentGenres.includes(g)).length
    if (genreOverlap > 0) {
      score += genreOverlap * 0.5
      reason = `Matches your recent ${book.genre[0]} streak`
    }

    // Lighter read after a dark streak
    const isLight = book.mood.some(m => lightMoods.includes(m.toLowerCase()))
    if (darkCount >= 3 && isLight) {
      score += 2
      reason = "A lighter read after your recent dark streak"
    }

    // Evening cozy bonus
    if (hour >= 20 && book.mood.some(m => cozyMoods.includes(m.toLowerCase()))) {
      score += 1
      if (!reason) reason = "Perfect for a cozy evening read"
    }

    // Morning momentum bonus
    if (hour < 12 && book.mood.some(m => morningMoods.includes(m.toLowerCase()))) {
      score += 1
      if (!reason) reason = "Great way to start your day"
    }

    // Short book bonus
    if (book.pages > 0 && book.pages < 250) {
      score += 0.5
      if (!reason) reason = "A quick read to get back into it"
    }

    if (!reason) reason = "Highly rated in your library"

    return { book, score, reason }
  })

  scored.sort((a, b) => b.score - a.score)
  const top = scored[0]
  return top ? { book: top.book, reason: top.reason } : null
}

export function SmartNextRead({ onBookClick, onStartReading }: SmartNextReadProps) {
  const [result, setResult] = useState<{ book: Book; reason: string } | null>(null)
  const [skipIds, setSkipIds] = useState<Set<string>>(new Set())
  const [hasData, setHasData] = useState(false)
  const [startedId, setStartedId] = useState<string | null>(null)
  const [isShuffling, setIsShuffling] = useState(false)

  function computePick(currentSkipIds: Set<string>) {
    const likedBooks = getLikedBooks()
    const progress = getReadingProgress()
    const reviews = getBookReviews()
    const pick = pickNextRead(likedBooks, progress, reviews, currentSkipIds)
    setResult(pick)
    setHasData(likedBooks.length >= 3)
  }

  useEffect(() => {
    computePick(skipIds)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  const handlePickAnother = () => {
    if (!result) return
    setIsShuffling(true)
    const next = new Set(skipIds)
    next.add(result.book.id)
    setSkipIds(next)
    setTimeout(() => {
      computePick(next)
      setIsShuffling(false)
    }, 220)
  }

  const handleStartReading = (e: React.MouseEvent) => {
    e.stopPropagation()
    if (!result) return
    setStartedId(result.book.id)
    onStartReading(result.book)
  }

  // Only show when the user has enough liked books and a candidate was found
  if (!hasData || !result) return null

  const { book, reason } = result
  const isStarted = startedId === book.id

  return (
    <motion.div
      initial={{ opacity: 0, y: 12 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ type: "spring", stiffness: 300, damping: 28, delay: 0.05 }}
    >
      <div className="rounded-2xl border border-stone-200/70 dark:border-stone-700/60 bg-stone-50/80 dark:bg-stone-800/40 overflow-hidden">
        {/* Header bar */}
        <div className="flex items-center gap-2 px-4 pt-4 pb-0">
          <Wand2 className="w-3.5 h-3.5 text-amber-600 dark:text-amber-400 flex-shrink-0" />
          <span className="text-[11px] font-bold uppercase tracking-[0.14em] text-amber-700 dark:text-amber-400">
            What to Read Next
          </span>
        </div>

        {/* Book row */}
        <AnimatePresence mode="wait">
          <motion.div
            key={book.id}
            initial={{ opacity: 0, x: isShuffling ? 16 : 0 }}
            animate={{ opacity: 1, x: 0 }}
            exit={{ opacity: 0, x: -16 }}
            transition={{ duration: 0.18, ease: "easeOut" }}
          >
            <button
              onClick={() => onBookClick(book)}
              className="w-full text-left flex gap-4 px-4 py-4 group focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-amber-500 focus-visible:ring-inset rounded-2xl"
            >
              {/* Cover */}
              <div className="relative w-14 h-20 flex-shrink-0 rounded-lg overflow-hidden shadow-md shadow-stone-900/10 dark:shadow-black/30 border border-white/30 dark:border-stone-600/30 bg-stone-100 dark:bg-stone-700">
                <BookCover
                  src={book.cover}
                  fallbackSrc={book.coverFallback}
                  alt={book.title}
                  fill
                  className="object-contain"
                  sizes="56px"
                />
              </div>

              {/* Info */}
              <div className="flex-1 min-w-0 flex flex-col justify-center gap-1">
                <h3 className="text-sm font-bold text-stone-900 dark:text-stone-100 leading-snug line-clamp-2 group-hover:text-amber-800 dark:group-hover:text-amber-300 transition-colors font-serif">
                  {book.title}
                </h3>
                <p className="text-xs text-stone-500 dark:text-stone-400 truncate">
                  {book.author}
                </p>

                {/* Rating pill */}
                {book.rating > 0 && (
                  <div className="flex items-center gap-1 mt-0.5">
                    <Star className="w-3 h-3 fill-amber-500 text-amber-500" />
                    <span className="text-[11px] font-semibold text-stone-600 dark:text-stone-300">
                      {book.rating.toFixed(1)}
                    </span>
                    {book.pages > 0 && (
                      <>
                        <span className="text-stone-300 dark:text-stone-600 text-[11px]">·</span>
                        <span className="text-[11px] text-stone-400 dark:text-stone-500">
                          {book.pages} pages
                        </span>
                      </>
                    )}
                  </div>
                )}

                {/* Reason badge */}
                <div className="mt-1">
                  <span className="inline-block text-[11px] px-2 py-0.5 rounded-full bg-amber-100/80 dark:bg-amber-900/40 text-amber-800 dark:text-amber-300 border border-amber-200/50 dark:border-amber-700/40">
                    {reason}
                  </span>
                </div>
              </div>
            </button>

            {/* Actions */}
            <div className="flex items-center gap-2 px-4 pb-4">
              {isStarted ? (
                <span className="flex items-center gap-1.5 text-xs text-amber-700 dark:text-amber-400 font-medium">
                  <BookOpen className="w-3.5 h-3.5" />
                  Added to reading list
                </span>
              ) : (
                <button
                  onClick={handleStartReading}
                  className="h-8 px-4 bg-stone-900 hover:bg-stone-800 dark:bg-stone-100 dark:hover:bg-white text-white dark:text-stone-900 text-xs font-semibold rounded-xl transition-all active:scale-[0.97] flex items-center gap-1.5 shadow-sm"
                >
                  <BookOpen className="w-3.5 h-3.5" />
                  Start Reading
                </button>
              )}

              <button
                onClick={handlePickAnother}
                disabled={isShuffling}
                className="h-8 px-3 flex items-center gap-1.5 text-xs text-stone-400 hover:text-stone-600 dark:hover:text-stone-300 hover:bg-stone-100 dark:hover:bg-stone-700/50 rounded-xl transition-all active:scale-[0.97] disabled:opacity-50"
              >
                <RefreshCw className={`w-3 h-3 ${isShuffling ? "animate-spin" : ""}`} />
                Pick another
              </button>
            </div>
          </motion.div>
        </AnimatePresence>
      </div>
    </motion.div>
  )
}
