"use client"

import { useState, useEffect, useRef, useCallback } from "react"
import { motion } from "framer-motion"
import { Search, BookOpen, AlertCircle, Loader2, Heart, Check } from "lucide-react"
import { BookCardSkeleton } from "@/components/ui/skeleton"
import { GutenbergBook } from "@/lib/gutenberg-api"
import { Book } from "@/lib/book-data"
import { addLikedBook, getLikedBooks } from "@/lib/storage"
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
  const [slowLoad, setSlowLoad] = useState(false)
  const [savedIds, setSavedIds] = useState<Set<string>>(() => {
    const liked = getLikedBooks()
    return new Set(liked.map(b => b.id))
  })

  const handleSaveToLibrary = useCallback((book: GutenbergBook) => {
    const rawAuthor = book.authors[0]?.name ?? "Unknown"
    const author = rawAuthor.includes(",") ? rawAuthor.split(",").reverse().join(" ").trim() : rawAuthor
    const coverUrl = getCoverUrl(book)
    const libBook: Book = {
      id: `gutenberg-${book.id}`,
      title: book.title,
      author,
      cover: coverUrl || "",
      rating: 0,
      pages: 0,
      genre: book.subjects?.slice(0, 3) || ["Classic"],
      mood: [],
      description: "",
      publishedYear: 0,
      readingTime: "",
    }
    addLikedBook(libBook)
    setSavedIds(prev => new Set(prev).add(libBook.id))
  }, [])

  // Show "taking longer" message after 5s of loading
  useEffect(() => {
    if (!loading || books.length > 0) { setSlowLoad(false); return }
    const timer = setTimeout(() => setSlowLoad(true), 5000)
    return () => clearTimeout(timer)
  }, [loading, books.length])

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

  // Prefetch all other categories in the background after first load completes
  const hasPrefetchedRef = useRef(false)
  useEffect(() => {
    if (loading || books.length === 0 || hasPrefetchedRef.current) return
    hasPrefetchedRef.current = true

    // Wait 2 seconds then start prefetching other categories one by one
    let cancelled = false
    const timer = setTimeout(async () => {
      for (const cat of BROWSE_CATEGORIES) {
        if (cancelled) break
        if (cat.id === selectedCategory) continue // already loaded
        if (getCachedBrowse(cat.topic)) continue // already cached
        try {
          await browseGutenberg(cat.topic)
        } catch { /* silent */ }
        // Small delay between requests to be respectful to the API
        await new Promise(r => setTimeout(r, 1000))
      }
    }, 2000)

    return () => { cancelled = true; clearTimeout(timer) }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [loading, books.length])

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
    <div className="flex flex-col bg-background" style={{ minHeight: "100dvh" }}>
      {/* Header */}
      <div
        className="bg-background/90 backdrop-blur-md border-b border-stone-200/60 dark:border-stone-700/60 px-4 sm:px-6 pb-3 flex-shrink-0 sticky top-0 z-20"
        style={{ paddingTop: "max(12px, env(safe-area-inset-top, 12px))" }}
      >
        <div className="max-w-6xl mx-auto">
          <div className="flex items-center gap-2 mb-3">
            <BookOpen className="w-5 h-5 text-amber-600" />
            <h1 className="text-lg font-bold text-stone-900 dark:text-stone-100 font-serif">Free Books</h1>
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
        <div className="flex-shrink-0 bg-background/90 backdrop-blur-md border-b border-stone-200/60 dark:border-stone-700/60 overflow-x-auto hide-scrollbar">
          <div className="max-w-6xl mx-auto px-4 sm:px-6 py-2.5 flex flex-nowrap overflow-x-auto hide-scrollbar gap-1.5">
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
                {cat.label}
              </button>
            ))}
          </div>
        </div>
      )}

      {/* Book grid */}
      <div className="flex-1 overflow-y-auto">
        <div className="max-w-6xl mx-auto px-4 sm:px-6 py-4">
          {loading && books.length === 0 ? (
            <div>
              {slowLoad && (
                <motion.div
                  initial={{ opacity: 0, y: -4 }}
                  animate={{ opacity: 1, y: 0 }}
                  className="flex items-center justify-center gap-2 py-3 mb-4 text-sm text-stone-500 dark:text-stone-400"
                >
                  <Loader2 className="w-4 h-4 animate-spin text-amber-500" />
                  <span>The book server is slow — hang tight...</span>
                </motion.div>
              )}
              <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 gap-3 lg:gap-4">
                {Array.from({ length: 9 }).map((_, i) => (
                  <motion.div
                    key={i}
                    initial={{ opacity: 0 }}
                    animate={{ opacity: 1 }}
                    transition={{ delay: i * 0.04 }}
                  >
                    <BookCardSkeleton />
                  </motion.div>
                ))}
              </div>
            </div>
          ) : error ? (
            <div className="flex flex-col items-center justify-center h-64 text-stone-400 gap-3">
              <AlertCircle className="w-8 h-8 opacity-40" />
              <div className="text-center">
                <p className="text-sm font-medium text-stone-500 dark:text-stone-400">Couldn&apos;t load books</p>
                <p className="text-xs text-stone-400 dark:text-stone-500 mt-1">The Gutenberg server may be temporarily down.</p>
              </div>
              <button
                onClick={() => handleCategorySelect(selectedCategory)}
                className="px-4 py-2 rounded-lg text-xs font-semibold bg-amber-600 text-white hover:bg-amber-700 transition-colors"
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
                  <div className="w-3 h-3 rounded-full animate-pulse bg-stone-300 dark:bg-stone-600" /> Refreshing...
                </div>
              )}
              <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 gap-3 lg:gap-4">
                {books.map((book, i) => (
                  <BookGridCard key={book.id} book={book} onRead={handleRead} onSave={handleSaveToLibrary} isSaved={savedIds.has(`gutenberg-${book.id}`)} index={i} />
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
  onSave,
  isSaved,
  index,
}: {
  book: GutenbergBook
  onRead: (book: GutenbergBook) => void
  onSave: (book: GutenbergBook) => void
  isSaved: boolean
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
      className="flex flex-col group"
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      whileHover={{ y: -3, transition: { type: "spring", stiffness: 400, damping: 30 } }}
      transition={{ delay: Math.min(index * 0.03, 0.2), type: "spring", stiffness: 300, damping: 28 }}
    >
      <div
        className="relative w-full aspect-[2/3] rounded-xl overflow-hidden bg-stone-100 dark:bg-stone-800 mb-2.5 shadow-sm group-hover:shadow-md transition-shadow ring-1 ring-stone-200/50 dark:ring-stone-700/50 cursor-pointer"
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
        <p className="text-[11px] text-stone-400 dark:text-stone-500 truncate mb-2">{author}</p>
        <div className="mt-auto flex gap-1.5">
          <button
            onClick={() => onRead(book)}
            className="flex-1 flex items-center justify-center gap-1 py-1.5 rounded-lg text-xs font-medium bg-amber-600 text-white hover:bg-amber-700 active:scale-[0.98] transition-all"
          >
            <BookOpen className="w-3 h-3" />
            Read
          </button>
          <button
            onClick={(e) => { e.stopPropagation(); if (!isSaved) onSave(book) }}
            disabled={isSaved}
            className={`flex items-center justify-center gap-1 py-1.5 px-2.5 rounded-lg text-xs font-medium transition-all active:scale-[0.98] ${
              isSaved
                ? "bg-emerald-50 dark:bg-emerald-900/30 text-emerald-600 dark:text-emerald-400"
                : "bg-stone-100 dark:bg-stone-800 text-stone-600 dark:text-stone-300 hover:bg-stone-200 dark:hover:bg-stone-700"
            }`}
          >
            {isSaved ? <Check className="w-3 h-3" /> : <Heart className="w-3 h-3" />}
            {isSaved ? "Saved" : "Save"}
          </button>
        </div>
      </div>
    </motion.div>
  )
}
