"use client"

import { useState, useEffect, useRef } from "react"
import { motion, AnimatePresence } from "framer-motion"
import { Search, BookOpen, Loader2, AlertCircle } from "lucide-react"
import { GutenbergBook } from "@/lib/gutenberg-api"
import {
  BROWSE_CATEGORIES,
  browseGutenberg,
  getCachedBrowse,
  searchFreeBooks,
  hasReadableText,
  getCoverUrl,
} from "@/lib/gutenberg-browser-api"
import BookReader from "@/components/book-reader"
import Image from "next/image"

export function FreeBooksBrowser() {
  const [books, setBooks] = useState<GutenbergBook[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(false)
  const [selectedCategory, setSelectedCategory] = useState("popular")
  const [searchInput, setSearchInput] = useState("")
  const [searchQuery, setSearchQuery] = useState("")
  const [readerBook, setReaderBook] = useState<GutenbergBook | null>(null)
  const [readerOpen, setReaderOpen] = useState(false)
  const [loadProgress, setLoadProgress] = useState(0)
  const progressRef = useRef<ReturnType<typeof setInterval> | null>(null)
  // Load by category — show cached data instantly, fetch fresh in background
  useEffect(() => {
    if (searchQuery) return
    const cat = BROWSE_CATEGORIES.find(c => c.id === selectedCategory)
    if (!cat) return
    let cancelled = false

    // Try cache first — instant, no loading state
    const cached = getCachedBrowse(cat.topic)
    if (cached) {
      setBooks(cached.results.filter(hasReadableText))
      setLoading(false)
      setError(false)
      // Still refresh in background
      browseGutenberg(cat.topic)
        .then(result => {
          if (!cancelled) setBooks(result.results.filter(hasReadableText))
        })
        .catch(() => {}) // silent — we have cached data
      return () => { cancelled = true }
    }

    // No cache — show loading animation
    setLoading(true)
    setError(false)
    setBooks([])

    browseGutenberg(cat.topic)
      .then(result => {
        if (!cancelled) setBooks(result.results.filter(hasReadableText))
      })
      .catch(() => {
        if (!cancelled) setError(true)
      })
      .finally(() => {
        if (!cancelled) setLoading(false)
      })

    return () => { cancelled = true }
  }, [selectedCategory, searchQuery])

  // Debounced search — cancelled flag hoisted outside setTimeout
  useEffect(() => {
    if (!searchQuery) return
    let cancelled = false
    setLoading(true)
    setError(false)

    const timer = setTimeout(() => {
      searchFreeBooks(searchQuery)
        .then(result => {
          if (!cancelled) setBooks(result.results.filter(hasReadableText))
        })
        .catch(() => {
          if (!cancelled) setError(true)
        })
        .finally(() => {
          if (!cancelled) setLoading(false)
        })
    }, 400)

    return () => {
      cancelled = true
      clearTimeout(timer)
    }
  }, [searchQuery])

  // Simulated progress bar — gives perception of work happening
  useEffect(() => {
    if (loading && books.length === 0) {
      setLoadProgress(0)
      let progress = 0
      progressRef.current = setInterval(() => {
        // Fast at first, slows down as it approaches 90% (never reaches 100 until done)
        const remaining = 90 - progress
        const increment = Math.max(0.5, remaining * 0.08)
        progress = Math.min(90, progress + increment)
        setLoadProgress(progress)
      }, 200)
    } else {
      if (progressRef.current) {
        clearInterval(progressRef.current)
        progressRef.current = null
      }
      if (!loading) setLoadProgress(100)
    }
    return () => {
      if (progressRef.current) {
        clearInterval(progressRef.current)
        progressRef.current = null
      }
    }
  }, [loading, books.length])

  const handleSearchChange = (val: string) => {
    setSearchInput(val)
    const trimmed = val.trim()
    setSearchQuery(trimmed)
    if (!trimmed) setSelectedCategory("popular")
  }

  const handleCategorySelect = (id: string) => {
    setSelectedCategory(id)
    setSearchInput("")
    setSearchQuery("")
  }

  const handleRead = (book: GutenbergBook) => {
    setReaderBook(book)
    setReaderOpen(true)
  }

  const handleCloseReader = () => {
    setReaderOpen(false)
    setTimeout(() => setReaderBook(null), 500)
  }

  return (
    <div className="flex flex-col bg-stone-50 dark:bg-stone-800/50" style={{ minHeight: "100dvh" }}>
      {/* Header */}
      <div
        className="bg-white dark:bg-stone-900 border-b border-stone-100 dark:border-stone-800 px-4 pb-3 flex-shrink-0"
        style={{ paddingTop: "max(16px, env(safe-area-inset-top, 16px))" }}
      >
        <div className="max-w-md mx-auto">
          <div className="flex items-center gap-2 mb-3">
            <BookOpen className="w-5 h-5 text-amber-600" />
            <h1 className="text-lg font-bold text-stone-900 dark:text-stone-100">Free Books</h1>
            <span className="text-[10px] text-amber-700 dark:text-amber-400 bg-amber-50 dark:bg-amber-900/30 border border-amber-100 px-2 py-0.5 rounded-full font-medium">
              70k+ classics
            </span>
          </div>
          <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-stone-400 dark:text-stone-500 pointer-events-none" />
            <input
              type="search"
              placeholder="Search by title or author..."
              value={searchInput}
              onChange={e => handleSearchChange(e.target.value)}
              className="w-full pl-9 pr-4 py-2.5 bg-stone-100 dark:bg-stone-800 rounded-xl text-sm text-stone-900 dark:text-stone-100 placeholder-stone-400 dark:placeholder-stone-500 outline-none focus:ring-2 focus:ring-amber-500/50"
            />
          </div>
        </div>
      </div>

      {/* Categories */}
      {!searchQuery && (
        <div className="flex-shrink-0 bg-white dark:bg-stone-900 border-b border-stone-100 dark:border-stone-800 overflow-x-auto hide-scrollbar">
          <div className="max-w-2xl mx-auto px-4 py-2.5 flex flex-nowrap overflow-x-auto hide-scrollbar gap-1.5">
            {BROWSE_CATEGORIES.map(cat => (
              <button
                key={cat.id}
                onClick={() => handleCategorySelect(cat.id)}
                className={`flex-shrink-0 px-2.5 py-1.5 rounded-full text-[11px] font-medium transition-all ${
                  selectedCategory === cat.id
                    ? "bg-stone-900 dark:bg-stone-100 text-white dark:text-stone-900 shadow-sm"
                    : "bg-stone-100 dark:bg-stone-800 text-stone-600 dark:text-stone-300 hover:bg-stone-200 dark:hover:bg-stone-700"
                }`}
              >
                <span className="mr-1">{cat.emoji}</span>
                {cat.label}
              </button>
            ))}
          </div>
        </div>
      )}

      {/* Book grid */}
      <div className="flex-1 overflow-y-auto">
        <div className="max-w-md mx-auto px-4 py-4">
          {loading && books.length === 0 ? (
            <div className="space-y-6 pt-6">
              {/* Animated book illustration */}
              <motion.div
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                className="text-center space-y-5"
              >
                {/* Bouncing books animation */}
                <div className="flex items-end justify-center gap-2 h-16">
                  {[0, 1, 2].map(i => (
                    <motion.div
                      key={i}
                      className="rounded-md bg-amber-500"
                      style={{ width: 14 + i * 4, originY: 1 }}
                      animate={{
                        height: [28 + i * 8, 40 + i * 8, 28 + i * 8],
                        opacity: [0.4, 1, 0.4],
                      }}
                      transition={{
                        duration: 1,
                        repeat: Infinity,
                        delay: i * 0.2,
                        ease: "easeInOut",
                      }}
                    />
                  ))}
                </div>

                <div>
                  <p className="text-base font-semibold text-stone-800 dark:text-stone-200">
                    {loadProgress < 25 ? "Opening the library..." : loadProgress < 50 ? "Browsing the shelves..." : loadProgress < 75 ? "Picking the best titles..." : "Almost there..."}
                  </p>
                  <p className="text-sm text-stone-400 dark:text-stone-500 mt-1">
                    70,000+ free classics to explore
                  </p>
                </div>

                {/* Progress bar */}
                <div className="max-w-[240px] mx-auto">
                  <div className="h-2 bg-stone-200 dark:bg-stone-700 rounded-full overflow-hidden">
                    <motion.div
                      className="h-full rounded-full"
                      style={{ background: "linear-gradient(90deg, #d97706, #f59e0b, #d97706)", backgroundSize: "200% 100%" }}
                      initial={{ width: "0%" }}
                      animate={{ width: `${loadProgress}%`, backgroundPosition: ["0% 0%", "100% 0%"] }}
                      transition={{ width: { duration: 0.4, ease: "easeOut" }, backgroundPosition: { duration: 1.5, repeat: Infinity, ease: "linear" } }}
                    />
                  </div>
                </div>

                {/* Fun facts that rotate */}
                <AnimatePresence mode="wait">
                  <motion.p
                    key={Math.floor(loadProgress / 25)}
                    initial={{ opacity: 0, y: 5 }}
                    animate={{ opacity: 1, y: 0 }}
                    exit={{ opacity: 0, y: -5 }}
                    className="text-xs text-stone-400 dark:text-stone-500 italic"
                  >
                    {loadProgress < 25
                      ? "Did you know? Project Gutenberg was founded in 1971"
                      : loadProgress < 50
                      ? "The most downloaded book is Pride and Prejudice"
                      : loadProgress < 75
                      ? "Over 70,000 books available in 60+ languages"
                      : "Free to read, forever. No sign-up required."}
                  </motion.p>
                </AnimatePresence>
              </motion.div>

              {/* Skeleton cards — staggered fade in */}
              <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
                {Array.from({ length: 6 }).map((_, i) => (
                  <motion.div
                    key={i}
                    initial={{ opacity: 0, y: 8 }}
                    animate={{ opacity: 0.3 }}
                    transition={{ delay: 0.3 + i * 0.15 }}
                  >
                    <div className="aspect-[2/3] bg-stone-200 dark:bg-stone-700 rounded-xl mb-2 animate-pulse" />
                    <div className="h-3 bg-stone-200 dark:bg-stone-700 rounded w-3/4 mb-1 animate-pulse" />
                    <div className="h-3 bg-stone-200 dark:bg-stone-700 rounded w-1/2 animate-pulse" />
                  </motion.div>
                ))}
              </div>
            </div>
          ) : error ? (
            <div className="flex flex-col items-center justify-center h-64 text-stone-400 gap-2">
              <AlertCircle className="w-8 h-8 opacity-40" />
              <p className="text-sm">Couldn&apos;t load books. Check your connection.</p>
              <button
                onClick={() => handleCategorySelect(selectedCategory)}
                className="text-xs text-amber-600 font-medium mt-1"
              >
                Try again
              </button>
            </div>
          ) : books.length === 0 ? (
            <div className="flex flex-col items-center justify-center h-64 text-stone-400 gap-2">
              <BookOpen className="w-8 h-8 opacity-40" />
              <p className="text-sm">No books found</p>
            </div>
          ) : (
            <div>
              {loading && books.length > 0 && (
                <div className="flex items-center justify-center gap-2 py-2 mb-3 text-xs text-stone-400">
                  <Loader2 className="w-3 h-3 animate-spin" /> Refreshing...
                </div>
              )}
              <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
                {books.map((book, i) => (
                  <BookGridCard key={book.id} book={book} onRead={handleRead} index={i} />
                ))}
              </div>
            </div>
          )}
        </div>
      </div>

      {/* Reader */}
      {readerBook && (
        <BookReader
          bookId={`gutenberg-${readerBook.id}`}
          bookTitle={readerBook.title}
          gutenbergBook={readerBook}
          isOpen={readerOpen}
          onClose={handleCloseReader}
        />
      )}
    </div>
  )
}

function BookGridCard({
  book,
  onRead,
  index,
}: {
  book: GutenbergBook
  onRead: (book: GutenbergBook) => void
  index: number
}) {
  const [imgError, setImgError] = useState(false)
  const [imgLoaded, setImgLoaded] = useState(false)
  const coverUrl = getCoverUrl(book)
  const rawAuthor = book.authors[0]?.name ?? "Unknown"
  const author = rawAuthor.includes(",")
    ? rawAuthor.split(",").reverse().join(" ").trim()
    : rawAuthor

  // Generate a deterministic pastel background from book id for placeholder
  const hue = (book.id * 37) % 360

  // Timeout: if cover doesn't load in 5s, give up and show placeholder
  useEffect(() => {
    if (!coverUrl || imgLoaded || imgError) return
    const timer = setTimeout(() => setImgError(true), 5000)
    return () => clearTimeout(timer)
  }, [coverUrl, imgLoaded, imgError])

  return (
    <motion.div
      className="flex flex-col"
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ delay: Math.min(index * 0.03, 0.2), type: "spring", stiffness: 300, damping: 28 }}
    >
      <div
        className="relative w-full aspect-[2/3] rounded-xl overflow-hidden bg-stone-200 mb-2 shadow-sm cursor-pointer"
        onClick={() => onRead(book)}
      >
        {coverUrl && !imgError ? (
          <Image
            src={coverUrl}
            alt={book.title}
            fill
            className="object-cover"
            sizes="(max-width: 640px) 50vw, 200px"
            unoptimized
            onLoad={() => setImgLoaded(true)}
            onError={() => setImgError(true)}
          />
        ) : (
          <div
            className="absolute inset-0 flex flex-col items-center justify-center gap-2 px-2"
            style={{ background: `hsl(${hue}, 35%, 88%)` }}
          >
            <BookOpen className="w-7 h-7 flex-shrink-0" style={{ color: `hsl(${hue}, 40%, 40%)` }} />
            <p
              className="text-[9px] font-semibold text-center leading-tight line-clamp-3 px-1"
              style={{ color: `hsl(${hue}, 40%, 35%)` }}
            >
              {book.title}
            </p>
          </div>
        )}
        <div className="absolute top-1.5 left-1.5 bg-amber-600 text-white text-[9px] font-bold px-1.5 py-0.5 rounded-md">
          FREE
        </div>
      </div>

      <div className="flex flex-col min-h-[5rem]">
        <h4 className="font-semibold text-xs text-stone-900 dark:text-stone-100 line-clamp-2 leading-tight min-h-[1.875rem]">
          {book.title}
        </h4>
        <p className="text-[11px] text-stone-400 dark:text-stone-500 truncate mb-1.5">{author}</p>
        <button
          onClick={() => onRead(book)}
          className="mt-auto w-full flex items-center justify-center gap-1 py-1.5 rounded-lg text-xs font-medium bg-amber-600 text-white hover:bg-amber-700 active:scale-[0.98] transition-all"
        >
          <BookOpen className="w-3 h-3" />
          Read Free
        </button>
      </div>
    </motion.div>
  )
}
