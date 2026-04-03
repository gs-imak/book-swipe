"use client"

import { useState, useRef, useEffect, useCallback, useMemo } from "react"
import { Book } from "@/lib/book-data"
import { getLikedBooks, getBookNotes, getBookReviews, BookNote, BookReview } from "@/lib/storage"
import { Search, X, Loader2, BookOpen, StickyNote, MessageSquare } from "lucide-react"
import { motion, AnimatePresence } from "framer-motion"
import { BookCover } from "@/components/book-cover"

interface GlobalSearchProps {
  isOpen: boolean
  onClose: () => void
  onBookClick: (book: Book) => void
}

interface LibraryResult {
  type: "library"
  book: Book
  matchField: "title" | "author"
  matchContext: string
}

interface NoteResult {
  type: "note"
  note: BookNote
  book: Book | null
  matchContext: string
}

interface ReviewResult {
  type: "review"
  review: BookReview
  book: Book | null
  matchContext: string
}

type SearchResult = LibraryResult | NoteResult | ReviewResult

function highlightMatch(text: string, query: string): React.ReactNode {
  if (!query.trim()) return text
  const safeQuery = query.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")
  const regex = new RegExp(`(${safeQuery})`, "gi")
  const parts = text.split(regex)
  return parts.map((part, i) =>
    regex.test(part) ? (
      <mark key={i} className="bg-amber-200/80 dark:bg-amber-700/50 text-amber-900 dark:text-amber-100 rounded-sm px-0.5">
        {part}
      </mark>
    ) : (
      part
    )
  )
}

function extractMatchContext(text: string, query: string, maxLen = 120): string {
  const lowerText = text.toLowerCase()
  const lowerQuery = query.toLowerCase()
  const idx = lowerText.indexOf(lowerQuery)
  if (idx === -1) return text.slice(0, maxLen)
  const start = Math.max(0, idx - 40)
  const end = Math.min(text.length, idx + query.length + 80)
  let snippet = text.slice(start, end)
  if (start > 0) snippet = "..." + snippet
  if (end < text.length) snippet = snippet + "..."
  return snippet
}

export function GlobalSearch({ isOpen, onClose, onBookClick }: GlobalSearchProps) {
  const [query, setQuery] = useState("")
  const [results, setResults] = useState<SearchResult[]>([])
  const [isSearching, setIsSearching] = useState(false)
  const [hasSearched, setHasSearched] = useState(false)
  const inputRef = useRef<HTMLInputElement>(null)
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null)

  // Cache data sources on open
  const likedBooks = useRef<Book[]>([])
  const bookNotes = useRef<BookNote[]>([])
  const bookReviews = useRef<BookReview[]>([])
  const bookMap = useRef<Record<string, Book>>({})

  useEffect(() => {
    if (isOpen) {
      likedBooks.current = getLikedBooks()
      bookNotes.current = getBookNotes()
      bookReviews.current = getBookReviews()

      const map: Record<string, Book> = {}
      likedBooks.current.forEach(b => { map[b.id] = b })
      bookMap.current = map

      setTimeout(() => inputRef.current?.focus(), 100)
    } else {
      if (debounceRef.current) clearTimeout(debounceRef.current)
      setQuery("")
      setResults([])
      setHasSearched(false)
      setIsSearching(false)
    }
    return () => {
      if (debounceRef.current) clearTimeout(debounceRef.current)
    }
  }, [isOpen])

  // Lock body scroll
  useEffect(() => {
    if (isOpen) {
      document.body.style.overflow = "hidden"
    } else {
      document.body.style.overflow = ""
    }
    return () => { document.body.style.overflow = "" }
  }, [isOpen])

  // Escape key
  useEffect(() => {
    if (!isOpen) return
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose()
    }
    window.addEventListener("keydown", handleKeyDown)
    return () => window.removeEventListener("keydown", handleKeyDown)
  }, [isOpen, onClose])

  const doSearch = useCallback((searchQuery: string) => {
    const q = searchQuery.trim().toLowerCase()
    if (q.length < 2) {
      setResults([])
      setHasSearched(false)
      setIsSearching(false)
      return
    }

    setIsSearching(true)
    setHasSearched(true)

    const found: SearchResult[] = []

    // Search liked books by title and author
    likedBooks.current.forEach(book => {
      if (book.title.toLowerCase().includes(q)) {
        found.push({
          type: "library",
          book,
          matchField: "title",
          matchContext: book.title,
        })
      } else if (book.author.toLowerCase().includes(q)) {
        found.push({
          type: "library",
          book,
          matchField: "author",
          matchContext: book.author,
        })
      }
    })

    // Search notes
    bookNotes.current.forEach(note => {
      const content = note.content || ""
      const selectedText = note.selectedText || ""
      if (content.toLowerCase().includes(q) || selectedText.toLowerCase().includes(q)) {
        const matchText = content.toLowerCase().includes(q) ? content : selectedText
        found.push({
          type: "note",
          note,
          book: bookMap.current[note.bookId] || null,
          matchContext: extractMatchContext(matchText, searchQuery),
        })
      }
    })

    // Search reviews
    bookReviews.current.forEach(review => {
      const text = review.review || ""
      if (text.toLowerCase().includes(q)) {
        found.push({
          type: "review",
          review,
          book: bookMap.current[review.bookId] || null,
          matchContext: extractMatchContext(text, searchQuery),
        })
      }
    })

    setResults(found)
    setIsSearching(false)
  }, [])

  const handleInputChange = (value: string) => {
    setQuery(value)
    if (debounceRef.current) clearTimeout(debounceRef.current)
    debounceRef.current = setTimeout(() => doSearch(value), 300)
  }

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault()
    if (debounceRef.current) clearTimeout(debounceRef.current)
    doSearch(query)
  }

  const handleResultClick = (result: SearchResult) => {
    const book = result.type === "library" ? result.book : result.book
    if (book) {
      onBookClick(book)
      onClose()
    }
  }

  // Group results by type
  const grouped = useMemo(() => {
    const library: LibraryResult[] = []
    const notes: NoteResult[] = []
    const reviews: ReviewResult[] = []
    results.forEach(r => {
      if (r.type === "library") library.push(r)
      else if (r.type === "note") notes.push(r)
      else if (r.type === "review") reviews.push(r)
    })
    return { library, notes, reviews }
  }, [results])

  const totalResults = results.length

  return (
    <AnimatePresence>
      {isOpen && (
        <motion.div
          initial={{ opacity: 0, y: "8%" }}
          animate={{ opacity: 1, y: 0 }}
          exit={{ opacity: 0, y: "4%" }}
          transition={{ type: "spring", stiffness: 400, damping: 35 }}
          className="fixed inset-0 lg:left-16 z-[60] bg-stone-50/[0.98] dark:bg-stone-950/[0.98] backdrop-blur-xl"
          role="dialog"
          aria-modal="true"
          aria-label="Search your library, notes, and reviews"
        >
          {/* Search header */}
          <div className="border-b border-stone-200/60 dark:border-stone-700/60 bg-white/80 dark:bg-stone-900/80 backdrop-blur-md">
            <div className="max-w-2xl mx-auto px-4 py-3">
              <form onSubmit={handleSubmit} className="flex items-center gap-3">
                <Search className="w-5 h-5 text-stone-400 dark:text-stone-500 flex-shrink-0" />
                <input
                  ref={inputRef}
                  type="text"
                  value={query}
                  onChange={(e) => handleInputChange(e.target.value)}
                  placeholder="Search library, notes, reviews..."
                  aria-label="Search your library, notes, and reviews"
                  className="flex-1 bg-transparent text-stone-900 dark:text-stone-100 text-base placeholder:text-stone-400 dark:placeholder:text-stone-500 outline-none"
                />
                {query && (
                  <button
                    type="button"
                    onClick={() => {
                      setQuery("")
                      setResults([])
                      setHasSearched(false)
                      inputRef.current?.focus()
                    }}
                    aria-label="Clear search"
                    className="p-2 rounded-md hover:bg-stone-100 dark:hover:bg-stone-800 tap-target touch-manipulation"
                  >
                    <X className="w-4 h-4 text-stone-400 dark:text-stone-500" />
                  </button>
                )}
                <button
                  type="button"
                  onClick={onClose}
                  className="text-sm font-medium text-stone-500 dark:text-stone-400 hover:text-stone-700 dark:hover:text-stone-300 pl-2"
                >
                  Cancel
                </button>
              </form>
            </div>
          </div>

          {/* Results */}
          <div className="max-w-2xl mx-auto px-4 py-4 overflow-y-auto" style={{ maxHeight: "calc(100vh - 60px)" }}>
            {isSearching && (
              <div className="flex items-center justify-center py-12" role="status">
                <Loader2 className="w-6 h-6 text-stone-400 animate-spin" aria-hidden="true" />
                <span className="sr-only">Searching...</span>
              </div>
            )}

            {/* Empty state */}
            {!isSearching && !hasSearched && (
              <div className="text-center py-16">
                <div className="w-14 h-14 mx-auto mb-4 rounded-2xl bg-stone-100 dark:bg-stone-800 flex items-center justify-center">
                  <Search className="w-6 h-6 text-stone-300 dark:text-stone-600" />
                </div>
                <p className="text-stone-500 dark:text-stone-400 text-sm font-medium mb-1">
                  Search across everything
                </p>
                <p className="text-stone-400 dark:text-stone-500 text-xs max-w-[260px] mx-auto leading-relaxed">
                  Find books in your library, notes you have written, and your reviews -- all in one place.
                </p>
              </div>
            )}

            {/* No results */}
            {!isSearching && hasSearched && totalResults === 0 && (
              <div className="text-center py-16">
                <div className="w-14 h-14 mx-auto mb-4 rounded-2xl bg-stone-100 dark:bg-stone-800 flex items-center justify-center">
                  <Search className="w-6 h-6 text-stone-300 dark:text-stone-600" />
                </div>
                <p className="text-stone-500 dark:text-stone-400 text-sm font-medium">
                  No matches found
                </p>
                <p className="text-stone-400 dark:text-stone-500 text-xs mt-1">
                  Try a different spelling or shorter keyword.
                </p>
              </div>
            )}

            {/* Grouped results */}
            {!isSearching && hasSearched && totalResults > 0 && (
              <div className="space-y-6">
                {/* Library results */}
                {grouped.library.length > 0 && (
                  <section>
                    <div className="flex items-center gap-2 mb-3">
                      <BookOpen className="w-3.5 h-3.5 text-amber-600 dark:text-amber-500" />
                      <h3 className="text-[11px] font-semibold uppercase tracking-wider text-stone-400 dark:text-stone-500">
                        In Your Library
                      </h3>
                      <span className="text-[10px] text-stone-300 dark:text-stone-600 tabular-nums">
                        {grouped.library.length}
                      </span>
                    </div>
                    <div className="space-y-2">
                      {grouped.library.map((result, index) => (
                        <motion.button
                          key={`lib-${result.book.id}`}
                          initial={{ opacity: 0, y: 6 }}
                          animate={{ opacity: 1, y: 0 }}
                          transition={{ delay: Math.min(index * 0.03, 0.15) }}
                          onClick={() => handleResultClick(result)}
                          className="w-full flex gap-3 p-3 rounded-xl bg-white dark:bg-stone-900 border border-stone-200/60 dark:border-stone-700/60 shadow-sm text-left hover:border-amber-300/60 dark:hover:border-amber-600/40 hover:shadow-md transition-all group"
                        >
                          <div className="relative w-12 h-[4.5rem] rounded-lg overflow-hidden bg-stone-200 dark:bg-stone-800 flex-shrink-0">
                            <BookCover
                              src={result.book.cover}
                              fallbackSrc={result.book.coverFallback}
                              alt={result.book.title}
                              fill
                              className="object-contain"
                              sizes="96px"
                            />
                          </div>
                          <div className="flex-1 min-w-0 py-0.5">
                            <p className="font-semibold text-sm text-stone-900 dark:text-stone-100 line-clamp-1 group-hover:text-amber-800 dark:group-hover:text-amber-300 transition-colors">
                              {highlightMatch(result.book.title, query)}
                            </p>
                            <p className="text-xs text-stone-500 dark:text-stone-400 line-clamp-1 mt-0.5">
                              {highlightMatch(result.book.author, query)}
                            </p>
                            {result.book.genre[0] && result.book.genre[0] !== "General" && (
                              <span className="inline-block mt-1.5 text-[10px] font-medium text-stone-400 dark:text-stone-500 bg-stone-100 dark:bg-stone-800 px-2 py-0.5 rounded-full">
                                {result.book.genre[0]}
                              </span>
                            )}
                          </div>
                        </motion.button>
                      ))}
                    </div>
                  </section>
                )}

                {/* Notes results */}
                {grouped.notes.length > 0 && (
                  <section>
                    <div className="flex items-center gap-2 mb-3">
                      <StickyNote className="w-3.5 h-3.5 text-amber-600 dark:text-amber-500" />
                      <h3 className="text-[11px] font-semibold uppercase tracking-wider text-stone-400 dark:text-stone-500">
                        In Your Notes
                      </h3>
                      <span className="text-[10px] text-stone-300 dark:text-stone-600 tabular-nums">
                        {grouped.notes.length}
                      </span>
                    </div>
                    <div className="space-y-2">
                      {grouped.notes.map((result, index) => (
                        <motion.button
                          key={`note-${result.note.id}`}
                          initial={{ opacity: 0, y: 6 }}
                          animate={{ opacity: 1, y: 0 }}
                          transition={{ delay: Math.min(index * 0.03, 0.15) }}
                          onClick={() => handleResultClick(result)}
                          disabled={!result.book}
                          className="w-full flex gap-3 p-3 rounded-xl bg-white dark:bg-stone-900 border border-stone-200/60 dark:border-stone-700/60 shadow-sm text-left hover:border-amber-300/60 dark:hover:border-amber-600/40 hover:shadow-md transition-all group disabled:opacity-50 disabled:cursor-not-allowed"
                        >
                          {result.book ? (
                            <div className="relative w-12 h-[4.5rem] rounded-lg overflow-hidden bg-stone-200 dark:bg-stone-800 flex-shrink-0">
                              <BookCover
                                src={result.book.cover}
                                fallbackSrc={result.book.coverFallback}
                                alt={result.book.title}
                                fill
                                className="object-contain"
                                sizes="96px"
                              />
                            </div>
                          ) : (
                            <div className="w-12 h-[4.5rem] rounded-lg bg-stone-100 dark:bg-stone-800 flex items-center justify-center flex-shrink-0">
                              <StickyNote className="w-5 h-5 text-stone-300 dark:text-stone-600" />
                            </div>
                          )}
                          <div className="flex-1 min-w-0 py-0.5">
                            <p className="font-semibold text-sm text-stone-900 dark:text-stone-100 line-clamp-1 group-hover:text-amber-800 dark:group-hover:text-amber-300 transition-colors">
                              {result.book?.title || "Unknown Book"}
                            </p>
                            <span className="inline-flex items-center gap-1 text-[10px] font-medium text-stone-400 dark:text-stone-500 mt-0.5">
                              <span className="capitalize">{result.note.type}</span>
                              {result.note.page && <span>-- p.{result.note.page}</span>}
                            </span>
                            <p className="text-xs text-stone-500 dark:text-stone-400 line-clamp-2 leading-relaxed mt-1">
                              {highlightMatch(result.matchContext, query)}
                            </p>
                          </div>
                        </motion.button>
                      ))}
                    </div>
                  </section>
                )}

                {/* Reviews results */}
                {grouped.reviews.length > 0 && (
                  <section>
                    <div className="flex items-center gap-2 mb-3">
                      <MessageSquare className="w-3.5 h-3.5 text-amber-600 dark:text-amber-500" />
                      <h3 className="text-[11px] font-semibold uppercase tracking-wider text-stone-400 dark:text-stone-500">
                        In Your Reviews
                      </h3>
                      <span className="text-[10px] text-stone-300 dark:text-stone-600 tabular-nums">
                        {grouped.reviews.length}
                      </span>
                    </div>
                    <div className="space-y-2">
                      {grouped.reviews.map((result, index) => (
                        <motion.button
                          key={`review-${result.review.bookId}`}
                          initial={{ opacity: 0, y: 6 }}
                          animate={{ opacity: 1, y: 0 }}
                          transition={{ delay: Math.min(index * 0.03, 0.15) }}
                          onClick={() => handleResultClick(result)}
                          disabled={!result.book}
                          className="w-full flex gap-3 p-3 rounded-xl bg-white dark:bg-stone-900 border border-stone-200/60 dark:border-stone-700/60 shadow-sm text-left hover:border-amber-300/60 dark:hover:border-amber-600/40 hover:shadow-md transition-all group disabled:opacity-50 disabled:cursor-not-allowed"
                        >
                          {result.book ? (
                            <div className="relative w-12 h-[4.5rem] rounded-lg overflow-hidden bg-stone-200 dark:bg-stone-800 flex-shrink-0">
                              <BookCover
                                src={result.book.cover}
                                fallbackSrc={result.book.coverFallback}
                                alt={result.book.title}
                                fill
                                className="object-contain"
                                sizes="96px"
                              />
                            </div>
                          ) : (
                            <div className="w-12 h-[4.5rem] rounded-lg bg-stone-100 dark:bg-stone-800 flex items-center justify-center flex-shrink-0">
                              <MessageSquare className="w-5 h-5 text-stone-300 dark:text-stone-600" />
                            </div>
                          )}
                          <div className="flex-1 min-w-0 py-0.5">
                            <p className="font-semibold text-sm text-stone-900 dark:text-stone-100 line-clamp-1 group-hover:text-amber-800 dark:group-hover:text-amber-300 transition-colors">
                              {result.book?.title || "Unknown Book"}
                            </p>
                            <div className="flex items-center gap-1 mt-0.5">
                              {Array.from({ length: 5 }).map((_, i) => (
                                <div
                                  key={i}
                                  className={`w-2.5 h-2.5 rounded-full ${
                                    i < result.review.rating
                                      ? "bg-amber-400 dark:bg-amber-500"
                                      : "bg-stone-200 dark:bg-stone-700"
                                  }`}
                                />
                              ))}
                            </div>
                            <p className="text-xs text-stone-500 dark:text-stone-400 line-clamp-2 leading-relaxed mt-1">
                              {highlightMatch(result.matchContext, query)}
                            </p>
                          </div>
                        </motion.button>
                      ))}
                    </div>
                  </section>
                )}
              </div>
            )}
          </div>
        </motion.div>
      )}
    </AnimatePresence>
  )
}
