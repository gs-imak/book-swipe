"use client"

import { useState, useRef, useEffect, useCallback } from "react"
import { Book } from "@/lib/book-data"
import { searchGoogleBooks } from "@/lib/books-api"
import { Search, X, Heart, Star, Loader2 } from "lucide-react"
import { motion, AnimatePresence } from "framer-motion"
import { BookCover } from "@/components/book-cover"

interface BookSearchProps {
  isOpen: boolean
  onClose: () => void
  onSaveBook: (book: Book) => void
  savedBookIds: string[]
}

export function BookSearch({ isOpen, onClose, onSaveBook, savedBookIds }: BookSearchProps) {
  const [query, setQuery] = useState("")
  const [results, setResults] = useState<Book[]>([])
  const [isSearching, setIsSearching] = useState(false)
  const [hasSearched, setHasSearched] = useState(false)
  const inputRef = useRef<HTMLInputElement>(null)
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null)

  useEffect(() => {
    if (isOpen) {
      setTimeout(() => inputRef.current?.focus(), 100)
    } else {
      setQuery("")
      setResults([])
      setHasSearched(false)
    }
  }, [isOpen])

  // Lock body scroll when open
  useEffect(() => {
    if (isOpen) {
      document.body.style.overflow = "hidden"
    } else {
      document.body.style.overflow = ""
    }
    return () => { document.body.style.overflow = "" }
  }, [isOpen])

  const doSearch = useCallback(async (searchQuery: string) => {
    if (searchQuery.trim().length < 2) {
      setResults([])
      setHasSearched(false)
      return
    }

    setIsSearching(true)
    setHasSearched(true)
    try {
      const books = await searchGoogleBooks(searchQuery, 20)
      setResults(books)
    } catch {
      setResults([])
    } finally {
      setIsSearching(false)
    }
  }, [])

  const handleInputChange = (value: string) => {
    setQuery(value)
    if (debounceRef.current) clearTimeout(debounceRef.current)
    debounceRef.current = setTimeout(() => doSearch(value), 500)
  }

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault()
    if (debounceRef.current) clearTimeout(debounceRef.current)
    doSearch(query)
  }

  return (
    <AnimatePresence>
      {isOpen && (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          transition={{ duration: 0.15 }}
          className="fixed inset-0 z-50 bg-background"
        >
          {/* Search header */}
          <div className="border-b border-stone-200/60 bg-background">
            <div className="max-w-2xl mx-auto px-4 py-3">
              <form onSubmit={handleSubmit} className="flex items-center gap-3">
                <Search className="w-5 h-5 text-stone-400 flex-shrink-0" />
                <input
                  ref={inputRef}
                  type="text"
                  value={query}
                  onChange={(e) => handleInputChange(e.target.value)}
                  placeholder="Search books or authors..."
                  aria-label="Search books or authors"
                  className="flex-1 bg-transparent text-stone-900 text-base placeholder:text-stone-400 outline-none"
                />
                {query && (
                  <button
                    type="button"
                    onClick={() => { setQuery(""); setResults([]); setHasSearched(false); inputRef.current?.focus() }}
                    aria-label="Clear search"
                    className="p-2 rounded-md hover:bg-stone-100 tap-target touch-manipulation"
                  >
                    <X className="w-4 h-4 text-stone-400" />
                  </button>
                )}
                <button
                  type="button"
                  onClick={onClose}
                  className="text-sm font-medium text-stone-500 hover:text-stone-700 pl-2"
                >
                  Cancel
                </button>
              </form>
            </div>
          </div>

          {/* Results */}
          <div className="max-w-2xl mx-auto px-4 py-4 overflow-y-auto" style={{ maxHeight: "calc(100vh - 60px)" }}>
            {isSearching && (
              <div className="flex items-center justify-center py-12">
                <Loader2 className="w-6 h-6 text-stone-400 animate-spin" />
              </div>
            )}

            {!isSearching && hasSearched && results.length === 0 && (
              <div className="text-center py-12">
                <Search className="w-10 h-10 text-stone-200 mx-auto mb-3" />
                <p className="text-stone-500 text-sm">No books found for &ldquo;{query}&rdquo;</p>
                <div className="mt-3 space-y-1.5 text-xs text-stone-400">
                  <p>Try:</p>
                  <p>• Searching by author name instead</p>
                  <p>• Using fewer or broader keywords</p>
                  <p>• Checking the spelling</p>
                </div>
              </div>
            )}

            {!isSearching && !hasSearched && (
              <div className="text-center py-12">
                <Search className="w-10 h-10 text-stone-200 mx-auto mb-3" />
                <p className="text-stone-400 text-sm">Search for any book or author</p>
                <div className="flex flex-wrap gap-2 justify-center mt-4">
                  {["Dune", "Sapiens", "Project Hail Mary", "Atomic Habits"].map(term => (
                    <button
                      key={term}
                      onClick={() => { setQuery(term); doSearch(term) }}
                      className="px-3 py-1.5 rounded-full bg-stone-100 text-stone-600 text-xs font-medium hover:bg-stone-200 transition-colors"
                    >
                      {term}
                    </button>
                  ))}
                </div>
              </div>
            )}

            {results.length > 0 && (
              <div className="space-y-2">
                {results.map((book, index) => {
                  const isSaved = savedBookIds.includes(book.id)
                  return (
                    <motion.div
                      key={book.id}
                      initial={{ opacity: 0, y: 8 }}
                      animate={{ opacity: 1, y: 0 }}
                      transition={{ delay: Math.min(index * 0.03, 0.3) }}
                      className="flex gap-3 p-3 rounded-xl bg-white border border-stone-200/60 shadow-sm"
                    >
                      {/* Cover */}
                      <div className="relative w-16 h-24 rounded-lg overflow-hidden bg-stone-200 flex-shrink-0">
                        <BookCover
                          src={book.cover}
                          fallbackSrc={book.coverFallback}
                          alt={book.title}
                          fill
                          className="object-contain"
                          sizes="128px"
                        />
                      </div>

                      {/* Info */}
                      <div className="flex-1 min-w-0">
                        <h4 className="font-semibold text-sm text-stone-900 line-clamp-1">{book.title}</h4>
                        <p className="text-xs text-stone-500 mb-1">{book.author}</p>
                        <div className="flex items-center gap-2 text-xs text-stone-400 mb-2">
                          <div className="flex items-center gap-0.5">
                            <Star className="w-3 h-3 text-amber-500 fill-amber-500" />
                            <span>{book.rating}</span>
                          </div>
                          <span>{book.pages}p</span>
                          {book.genre[0] !== "General" && (
                            <span className="text-stone-400">{book.genre[0]}</span>
                          )}
                        </div>
                        <p className="text-xs text-stone-400 line-clamp-2 leading-relaxed">{book.description}</p>
                      </div>

                      {/* Save button */}
                      <div className="flex items-center flex-shrink-0">
                        <button
                          onClick={() => onSaveBook(book)}
                          disabled={isSaved}
                          className={`flex items-center gap-1 px-3 py-1.5 rounded-lg text-xs font-medium transition-all ${
                            isSaved
                              ? "bg-stone-100 text-stone-400"
                              : "bg-stone-900 text-white hover:bg-stone-800 active:scale-[0.98]"
                          }`}
                        >
                          <Heart className={`w-3 h-3 ${isSaved ? "fill-current" : ""}`} />
                          {isSaved ? "Saved" : "Save"}
                        </button>
                      </div>
                    </motion.div>
                  )
                })}
              </div>
            )}
          </div>
        </motion.div>
      )}
    </AnimatePresence>
  )
}
