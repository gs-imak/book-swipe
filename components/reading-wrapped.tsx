"use client"

import { useState, useEffect, useCallback } from "react"
import { motion, AnimatePresence } from "framer-motion"
import { X, BookOpen, Star, Sparkles, TrendingUp, Flame, Heart } from "lucide-react"
import { getLikedBooks, getBookReviews, getReadingGoals } from "@/lib/storage"
import { BookCover } from "@/components/book-cover"
import { Book } from "@/lib/book-data"

// ---------------------------------------------------------------------------
// Archetype helper (mirrors taste-profile logic)
// ---------------------------------------------------------------------------
const ARCHETYPES: Record<string, Record<string, string>> = {
  "Fiction":          { default: "Story Seeker",    "Emotional": "Empathetic Soul",   "Epic": "Grand Voyager"   },
  "Fantasy":          { default: "Dream Weaver",    "Epic": "Realm Walker",            "Dark": "Shadow Scholar"  },
  "Science Fiction":  { default: "Cosmic Explorer", "Thought-provoking": "Visionary Mind" },
  "Mystery":          { default: "Puzzle Master",   "Suspenseful": "Sleuth Extraordinaire" },
  "Romance":          { default: "Hopeless Romantic","Emotional": "Heart Collector"    },
  "Non-fiction":      { default: "Knowledge Seeker","Inspiring": "Wisdom Hunter"       },
  "Horror":           { default: "Scare Enthusiast","Dark": "Shadow Walker"            },
  "Thriller":         { default: "Edge Seeker",     "Suspenseful": "Adrenaline Junkie" },
  "Historical":       { default: "Time Traveler",   "Epic": "Era Explorer"             },
}

function getArchetype(topGenre: string, topMood: string): string {
  const entry = Object.entries(ARCHETYPES).find(([k]) =>
    topGenre.toLowerCase().includes(k.toLowerCase()) || k.toLowerCase().includes(topGenre.toLowerCase())
  )
  if (entry) {
    const moodMap = entry[1]
    const moodKey = Object.keys(moodMap).find(k => k !== "default" && topMood.toLowerCase().includes(k.toLowerCase()))
    return moodKey ? moodMap[moodKey] : moodMap["default"]
  }
  return "Curious Reader"
}

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------
interface WrappedStats {
  year: number
  totalBooks: number
  totalPages: number
  topGenre: string
  topGenreCount: number
  topAuthor: string
  topAuthorCount: number
  bestBook: Book | null
  bestRating: number
  archetype: string
  booksCompleted: number
  streak: number
}

interface ReadingWrappedProps {
  isOpen: boolean
  onClose: () => void
}

// ---------------------------------------------------------------------------
// Slide components
// ---------------------------------------------------------------------------
const slideVariants = {
  enter: { opacity: 0, scale: 0.96, y: 20 },
  center: { opacity: 1, scale: 1, y: 0 },
  exit: { opacity: 0, scale: 1.02, y: -16 },
}

function SlideIntro({ stats }: { stats: WrappedStats }) {
  return (
    <div className="flex flex-col items-center justify-center h-full text-center px-8 space-y-6">
      <motion.div
        initial={{ scale: 0.7, opacity: 0 }}
        animate={{ scale: 1, opacity: 1 }}
        transition={{ type: "spring", stiffness: 180, damping: 18, delay: 0.1 }}
        className="w-16 h-16 rounded-2xl bg-amber-600/20 flex items-center justify-center"
      >
        <Sparkles className="w-8 h-8 text-amber-500" />
      </motion.div>
      <motion.div
        initial={{ opacity: 0, y: 16 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.25 }}
        className="space-y-2"
      >
        <p className="text-amber-500/80 text-xs uppercase tracking-[0.3em] font-semibold">
          Reading Wrapped
        </p>
        <h2 className="text-4xl sm:text-5xl font-bold text-white font-serif leading-tight">
          Your {stats.year}<br />in Books
        </h2>
      </motion.div>
      <motion.p
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        transition={{ delay: 0.5 }}
        className="text-stone-500 text-sm"
      >
        Tap to begin
      </motion.p>
    </div>
  )
}

function SlideBooks({ stats }: { stats: WrappedStats }) {
  return (
    <div className="flex flex-col items-center justify-center h-full text-center px-8 space-y-5">
      <motion.div initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.1 }}>
        <BookOpen className="w-10 h-10 text-amber-500 mx-auto mb-4" />
        <p className="text-stone-400 text-sm uppercase tracking-widest mb-3">You discovered</p>
        <p className="text-8xl sm:text-9xl font-bold text-white font-serif leading-none">
          {stats.totalBooks}
        </p>
        <p className="text-stone-300 text-xl mt-3 font-serif">
          {stats.totalBooks === 1 ? "book" : "books"}
        </p>
      </motion.div>
      {stats.booksCompleted > 0 && (
        <motion.p
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ delay: 0.5 }}
          className="text-stone-500 text-sm"
        >
          {stats.booksCompleted} finished cover to cover
        </motion.p>
      )}
    </div>
  )
}

function SlidePages({ stats }: { stats: WrappedStats }) {
  return (
    <div className="flex flex-col items-center justify-center h-full text-center px-8 space-y-5">
      <motion.div initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.1 }}>
        <TrendingUp className="w-10 h-10 text-teal-400 mx-auto mb-4" />
        <p className="text-stone-400 text-sm uppercase tracking-widest mb-3">You explored</p>
        <p className="text-7xl sm:text-8xl font-bold text-white font-serif leading-none">
          {stats.totalPages.toLocaleString()}
        </p>
        <p className="text-stone-300 text-xl mt-3 font-serif">pages of worlds</p>
      </motion.div>
      <motion.p
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        transition={{ delay: 0.5 }}
        className="text-stone-500 text-sm"
      >
        That&apos;s about {Math.round(stats.totalPages / 250)} hours of reading
      </motion.p>
    </div>
  )
}

function SlideGenre({ stats }: { stats: WrappedStats }) {
  return (
    <div className="flex flex-col items-center justify-center h-full text-center px-8 space-y-5">
      <motion.div initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.1 }}>
        <Heart className="w-10 h-10 text-rose-400 mx-auto mb-4" />
        <p className="text-stone-400 text-sm uppercase tracking-widest mb-4">Your favourite genre</p>
        <h3 className="text-4xl sm:text-5xl font-bold text-white font-serif leading-tight">
          {stats.topGenre || "Everything"}
        </h3>
        {stats.topGenreCount > 1 && (
          <motion.p
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ delay: 0.45 }}
            className="text-stone-400 text-sm mt-4"
          >
            {stats.topGenreCount} books in this genre
          </motion.p>
        )}
      </motion.div>
      {stats.topAuthor && (
        <motion.div
          initial={{ opacity: 0, y: 8 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.6 }}
          className="mt-4 px-5 py-3 bg-white/5 rounded-2xl border border-white/8"
        >
          <p className="text-stone-500 text-xs mb-0.5">Top author</p>
          <p className="text-white text-sm font-medium">{stats.topAuthor}</p>
          {stats.topAuthorCount > 1 && (
            <p className="text-stone-500 text-[11px]">{stats.topAuthorCount} books</p>
          )}
        </motion.div>
      )}
    </div>
  )
}

function SlideBestBook({ stats }: { stats: WrappedStats }) {
  return (
    <div className="flex flex-col items-center justify-center h-full text-center px-8 space-y-5">
      <motion.div
        initial={{ opacity: 0, y: 12 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.1 }}
        className="w-full space-y-4"
      >
        <Star className="w-10 h-10 text-amber-400 fill-amber-400/30 mx-auto" />
        <p className="text-stone-400 text-sm uppercase tracking-widest">Highest rated</p>
        {stats.bestBook ? (
          <motion.div
            initial={{ opacity: 0, scale: 0.92 }}
            animate={{ opacity: 1, scale: 1 }}
            transition={{ delay: 0.3, type: "spring", stiffness: 180, damping: 20 }}
            className="flex flex-col items-center gap-3"
          >
            <div className="relative w-28 h-40 rounded-xl overflow-hidden shadow-2xl border border-white/10">
              <BookCover
                src={stats.bestBook.cover}
                fallbackSrc={stats.bestBook.coverFallback}
                alt={stats.bestBook.title}
                fill
                className="object-contain"
                sizes="224px"
              />
            </div>
            <div>
              <p className="text-white font-bold font-serif text-lg leading-tight">{stats.bestBook.title}</p>
              <p className="text-stone-400 text-sm">{stats.bestBook.author}</p>
              <div className="flex items-center justify-center gap-1 mt-1.5">
                {Array.from({ length: 5 }).map((_, i) => (
                  <Star
                    key={i}
                    className={`w-3.5 h-3.5 ${i < stats.bestRating ? "text-amber-400 fill-amber-400" : "text-stone-700"}`}
                  />
                ))}
              </div>
            </div>
          </motion.div>
        ) : (
          <p className="text-stone-400 text-sm">Rate some books to see your best read</p>
        )}
      </motion.div>
    </div>
  )
}

function SlideArchetype({ stats, onClose }: { stats: WrappedStats; onClose: () => void }) {
  return (
    <div className="flex flex-col items-center justify-center h-full text-center px-8 space-y-6">
      <motion.div
        initial={{ opacity: 0, y: 12 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.1 }}
        className="space-y-3"
      >
        <p className="text-stone-400 text-sm uppercase tracking-widest">You are a</p>
        <h2 className="text-4xl sm:text-5xl font-bold text-white font-serif leading-tight">
          {stats.archetype}
        </h2>
        {stats.streak > 1 && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ delay: 0.5 }}
            className="flex items-center justify-center gap-2 mt-2"
          >
            <Flame className="w-4 h-4 text-orange-400" />
            <p className="text-stone-300 text-sm">{stats.streak}-day reading streak</p>
          </motion.div>
        )}
      </motion.div>

      <motion.div
        initial={{ opacity: 0, y: 8 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.65 }}
        className="space-y-3 w-full"
      >
        <div className="h-px bg-white/8 w-24 mx-auto" />
        <p className="text-stone-500 text-sm leading-relaxed">
          Keep going. The next great book is one swipe away.
        </p>
        <button
          onClick={(e) => { e.stopPropagation(); onClose() }}
          className="mt-2 h-11 px-8 rounded-xl bg-amber-600 hover:bg-amber-500 text-white text-sm font-semibold transition-colors active:scale-[0.97]"
        >
          Keep Reading
        </button>
      </motion.div>
    </div>
  )
}

// ---------------------------------------------------------------------------
// Main component
// ---------------------------------------------------------------------------
export function ReadingWrapped({ isOpen, onClose }: ReadingWrappedProps) {
  const [stats, setStats] = useState<WrappedStats | null>(null)
  const [slide, setSlide] = useState(0)
  const TOTAL_SLIDES = 6

  useEffect(() => {
    if (!isOpen) { setSlide(0); return }

    const books = getLikedBooks()
    const reviews = getBookReviews()
    const goals = getReadingGoals()

    const year = new Date().getFullYear()
    const totalBooks = books.length
    const totalPages = books.reduce((s, b) => s + b.pages, 0)

    // Top genre
    const genreCounts: Record<string, number> = {}
    books.forEach(b => b.genre.forEach(g => { genreCounts[g] = (genreCounts[g] || 0) + 1 }))
    const [topGenre = "", topGenreCount = 0] = Object.entries(genreCounts).sort((a, b) => b[1] - a[1])[0] ?? []

    // Top author
    const authorCounts: Record<string, number> = {}
    books.forEach(b => { authorCounts[b.author] = (authorCounts[b.author] || 0) + 1 })
    const [topAuthor = "", topAuthorCount = 0] = Object.entries(authorCounts).sort((a, b) => b[1] - a[1])[0] ?? []

    // Best rated book (by user review rating, fallback to community rating)
    let bestBook: Book | null = null
    let bestRating = 0
    if (reviews.length > 0) {
      const best = reviews.sort((a, b) => b.rating - a.rating)[0]
      bestBook = books.find(b => b.id === best.bookId) ?? null
      bestRating = best.rating
    } else if (books.length > 0) {
      const topBook = [...books].sort((a, b) => b.rating - a.rating)[0]
      bestBook = topBook
      bestRating = Math.round(topBook.rating)
    }

    // Top mood
    const moodCounts: Record<string, number> = {}
    books.forEach(b => b.mood.forEach(m => { moodCounts[m] = (moodCounts[m] || 0) + 1 }))
    const [topMood = ""] = Object.entries(moodCounts).sort((a, b) => b[1] - a[1])[0] ?? []

    const archetype = topGenre ? getArchetype(topGenre, topMood) : "Curious Reader"

    setStats({
      year,
      totalBooks,
      totalPages,
      topGenre,
      topGenreCount,
      topAuthor,
      topAuthorCount,
      bestBook,
      bestRating,
      archetype,
      booksCompleted: goals.booksCompleted,
      streak: goals.streak,
    })
  }, [isOpen])

  const advance = useCallback(() => {
    setSlide(s => Math.min(s + 1, TOTAL_SLIDES - 1))
  }, [])

  const retreat = useCallback(() => {
    setSlide(s => Math.max(s - 1, 0))
  }, [])

  const handleTap = useCallback((e: React.MouseEvent<HTMLDivElement>) => {
    const x = e.clientX
    const midpoint = window.innerWidth / 2
    if (x > midpoint) advance()
    else retreat()
  }, [advance, retreat])

  useEffect(() => {
    if (!isOpen) return
    const handleKey = (e: KeyboardEvent) => {
      if (e.key === "ArrowRight" || e.key === " ") advance()
      else if (e.key === "ArrowLeft") retreat()
      else if (e.key === "Escape") onClose()
    }
    document.addEventListener("keydown", handleKey)
    return () => document.removeEventListener("keydown", handleKey)
  }, [isOpen, advance, retreat, onClose])

  useEffect(() => {
    if (isOpen) {
      document.body.style.overflow = "hidden"
      return () => { document.body.style.overflow = "" }
    }
  }, [isOpen])

  return (
    <AnimatePresence>
      {isOpen && stats && (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          transition={{ duration: 0.3 }}
          className="fixed inset-0 z-[100] flex flex-col select-none"
          style={{ background: "linear-gradient(160deg, #1c1917 0%, #252120 60%, #1a1817 100%)" }}
        >
          {/* Progress bar */}
          <div
            className="flex gap-1 px-4 pb-2 flex-shrink-0"
            style={{ paddingTop: "max(16px, env(safe-area-inset-top, 16px))" }}
          >
            {Array.from({ length: TOTAL_SLIDES }).map((_, i) => (
              <div key={i} className="h-0.5 flex-1 rounded-full bg-white/15 overflow-hidden">
                <motion.div
                  className="h-full bg-amber-500 rounded-full"
                  initial={{ width: 0 }}
                  animate={{ width: i < slide ? "100%" : i === slide ? "100%" : "0%" }}
                  transition={{ duration: i === slide ? 0.4 : 0, ease: "easeOut" }}
                />
              </div>
            ))}
          </div>

          {/* Close */}
          <button
            onClick={onClose}
            className="absolute right-4 z-10 p-2 rounded-full text-stone-500 hover:text-stone-200 transition-colors"
            style={{ top: "max(16px, env(safe-area-inset-top, 16px))" }}
            aria-label="Close"
          >
            <X className="w-5 h-5" />
          </button>

          {/* Slide content — tap zone */}
          <div
            className="flex-1 relative cursor-pointer"
            onClick={handleTap}
          >
            <AnimatePresence mode="wait">
              <motion.div
                key={slide}
                variants={slideVariants}
                initial="enter"
                animate="center"
                exit="exit"
                transition={{ type: "spring", stiffness: 280, damping: 28 }}
                className="absolute inset-0"
              >
                {slide === 0 && <SlideIntro stats={stats} />}
                {slide === 1 && <SlideBooks stats={stats} />}
                {slide === 2 && <SlidePages stats={stats} />}
                {slide === 3 && <SlideGenre stats={stats} />}
                {slide === 4 && <SlideBestBook stats={stats} />}
                {slide === 5 && <SlideArchetype stats={stats} onClose={onClose} />}
              </motion.div>
            </AnimatePresence>
          </div>

          {/* Tap-to-continue hint — hidden on final slide */}
          {slide < TOTAL_SLIDES - 1 && (
            <motion.p
              key={slide}
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              transition={{ delay: 0.8 }}
              className="text-center text-stone-600 text-xs pb-10 flex-shrink-0"
            >
              Tap to continue
            </motion.p>
          )}
        </motion.div>
      )}
    </AnimatePresence>
  )
}
