"use client"

import { useState, useEffect, useRef } from "react"
import { motion } from "framer-motion"
import { Search, BookOpen, Loader2, AlertCircle } from "lucide-react"
import { GutenbergBook } from "@/lib/gutenberg-api"
import {
  BROWSE_CATEGORIES,
  browseGutenberg,
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
  const searchDebounceRef = useRef<ReturnType<typeof setTimeout> | null>(null)

  // Load by category
  useEffect(() => {
    if (searchQuery) return
    const cat = BROWSE_CATEGORIES.find(c => c.id === selectedCategory)
    if (!cat) return
    let cancelled = false
    setLoading(true)
    setError(false)

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

  // Debounced search
  useEffect(() => {
    if (!searchQuery) return
    if (searchDebounceRef.current) clearTimeout(searchDebounceRef.current)
    setLoading(true)
    setError(false)

    searchDebounceRef.current = setTimeout(() => {
      let cancelled = false
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
      return () => { cancelled = true }
    }, 400)

    return () => {
      if (searchDebounceRef.current) clearTimeout(searchDebounceRef.current)
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
    <div className="flex flex-col bg-stone-50" style={{ minHeight: "100dvh" }}>
      {/* Header */}
      <div
        className="bg-white border-b border-stone-100 px-4 pb-3 flex-shrink-0"
        style={{ paddingTop: "max(16px, env(safe-area-inset-top, 16px))" }}
      >
        <div className="max-w-md mx-auto">
          <div className="flex items-center gap-2 mb-3">
            <BookOpen className="w-5 h-5 text-amber-600" />
            <h1 className="text-lg font-bold text-stone-900">Free Books</h1>
            <span className="text-[10px] text-amber-700 bg-amber-50 border border-amber-100 px-2 py-0.5 rounded-full font-medium">
              70k+ classics
            </span>
          </div>
          <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-stone-400 pointer-events-none" />
            <input
              type="search"
              placeholder="Search by title or author..."
              value={searchInput}
              onChange={e => handleSearchChange(e.target.value)}
              className="w-full pl-9 pr-4 py-2.5 bg-stone-100 rounded-xl text-sm text-stone-900 placeholder-stone-400 outline-none focus:ring-2 focus:ring-amber-500/50"
            />
          </div>
        </div>
      </div>

      {/* Categories */}
      {!searchQuery && (
        <div className="flex-shrink-0 bg-white border-b border-stone-100 overflow-x-auto hide-scrollbar">
          <div className="px-4 py-2.5 flex gap-2 max-w-md mx-auto">
            {BROWSE_CATEGORIES.map(cat => (
              <button
                key={cat.id}
                onClick={() => handleCategorySelect(cat.id)}
                className={`flex-shrink-0 px-3 py-1.5 rounded-full text-xs font-medium transition-all ${
                  selectedCategory === cat.id
                    ? "bg-stone-900 text-white"
                    : "bg-stone-100 text-stone-600 hover:bg-stone-200"
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
        <div className="max-w-md mx-auto px-4 py-4">
          {loading ? (
            <div className="flex items-center justify-center h-64">
              <Loader2 className="w-6 h-6 text-stone-400 animate-spin" />
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
            <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
              {books.map((book, i) => (
                <BookGridCard key={book.id} book={book} onRead={handleRead} index={i} />
              ))}
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
  const coverUrl = getCoverUrl(book)
  const rawAuthor = book.authors[0]?.name ?? "Unknown"
  const author = rawAuthor.includes(",")
    ? rawAuthor.split(",").reverse().join(" ").trim()
    : rawAuthor

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
        {coverUrl ? (
          <Image
            src={coverUrl}
            alt={book.title}
            fill
            className="object-cover"
            sizes="(max-width: 640px) 50vw, 200px"
            unoptimized
          />
        ) : (
          <div className="absolute inset-0 flex items-center justify-center bg-gradient-to-br from-amber-50 to-stone-200">
            <BookOpen className="w-8 h-8 text-stone-400" />
          </div>
        )}
        <div className="absolute top-1.5 left-1.5 bg-amber-600 text-white text-[9px] font-bold px-1.5 py-0.5 rounded-md">
          FREE
        </div>
      </div>

      <div className="flex flex-col min-h-[5rem]">
        <h4 className="font-semibold text-xs text-stone-900 line-clamp-2 leading-tight min-h-[1.875rem]">
          {book.title}
        </h4>
        <p className="text-[11px] text-stone-400 truncate mb-1.5">{author}</p>
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
