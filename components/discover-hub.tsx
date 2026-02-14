"use client"

import { useState, useEffect, useCallback } from "react"
import { Book } from "@/lib/book-data"
import {
  getTrendingBooks,
  getAuthorBooks,
  getSurpriseBook,
  getListBooks,
  subGenres,
  curatedLists,
  type SubGenre,
  type CuratedList,
} from "@/lib/explore-api"
import {
  Flame,
  Shuffle,
  ChevronRight,
  ChevronDown,
  Star,
  Heart,
  User,
  BookOpen,
  RefreshCw,
  Loader2,
} from "lucide-react"
import { motion, AnimatePresence } from "framer-motion"
import { BookCover } from "@/components/book-cover"
import { useGamification } from "./gamification-provider"
import { useToast } from "./toast-provider"

// ---------------------------------------------------------------------------
// Props
// ---------------------------------------------------------------------------

interface DiscoverHubProps {
  likedBooks: Book[]
  onSaveBook: (book: Book) => void
  savedBookIds: Set<string>
}

// ---------------------------------------------------------------------------
// Shared mini book card (matches smart-recommendations pattern)
// ---------------------------------------------------------------------------

function ExploreBookCard({
  book,
  onSave,
  isSaved,
  index = 0,
}: {
  book: Book
  onSave: (book: Book) => void
  isSaved: boolean
  index?: number
}) {
  return (
    <motion.div
      className="flex-shrink-0 w-[130px] sm:w-[140px]"
      initial={{ opacity: 0, x: 12 }}
      animate={{ opacity: 1, x: 0 }}
      transition={{
        type: "spring",
        stiffness: 300,
        damping: 28,
        delay: Math.min(index * 0.03, 0.2),
      }}
    >
      <div className="relative w-full aspect-[2/3] rounded-lg overflow-hidden bg-stone-200 mb-2 shadow-sm">
        <BookCover
          src={book.cover}
          fallbackSrc={book.coverFallback}
          alt={book.title}
          fill
          className="object-contain"
          sizes="280px"
        />
        <div className="absolute top-1.5 right-1.5 bg-white/90 backdrop-blur-sm px-1.5 py-0.5 rounded-md flex items-center gap-0.5">
          <Star className="w-2.5 h-2.5 fill-amber-500 text-amber-500" />
          <span className="text-[10px] font-bold text-stone-700">
            {book.rating}
          </span>
        </div>
      </div>

      <div className="px-0.5">
        <h4 className="font-semibold text-xs text-stone-900 line-clamp-1 leading-tight">
          {book.title}
        </h4>
        <p className="text-[11px] text-stone-400 mb-1.5 truncate">
          {book.author}
        </p>
        <button
          onClick={() => onSave(book)}
          disabled={isSaved}
          className={`w-full flex items-center justify-center gap-1 py-1.5 rounded-lg text-xs font-medium transition-all ${
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
}

// Horizontal scroll wrapper
function HorizontalScroll({ children }: { children: React.ReactNode }) {
  return (
    <div className="overflow-x-auto hide-scrollbar -mx-4 px-4">
      <div className="flex gap-3 pb-2">{children}</div>
    </div>
  )
}

// Small spinner for inline loading
function InlineSpinner() {
  return (
    <div className="flex items-center justify-center py-6">
      <Loader2 className="w-5 h-5 text-stone-400 animate-spin" />
    </div>
  )
}

// Section header
function SectionHeader({
  icon,
  title,
  subtitle,
}: {
  icon: React.ReactNode
  title: string
  subtitle?: string
}) {
  return (
    <div className="flex items-center justify-between mb-3 px-0.5">
      <div className="flex items-center gap-2">
        {icon}
        <h3 className="text-sm font-semibold text-stone-900">{title}</h3>
      </div>
      {subtitle && (
        <span className="text-[11px] text-stone-400">{subtitle}</span>
      )}
    </div>
  )
}

// ---------------------------------------------------------------------------
// Main component
// ---------------------------------------------------------------------------

export function DiscoverHub({
  likedBooks,
  onSaveBook,
  savedBookIds,
}: DiscoverHubProps) {
  // Trending
  const [trending, setTrending] = useState<Book[]>([])
  const [trendingLoading, setTrendingLoading] = useState(true)

  // Author spotlight
  const [authorData, setAuthorData] = useState<{
    author: string
    bookTitle: string
    books: Book[]
  } | null>(null)
  const [authorLoading, setAuthorLoading] = useState(false)

  // Surprise me
  const [surprise, setSurprise] = useState<{
    book: Book
    genre: string
  } | null>(null)
  const [surpriseLoading, setSurpriseLoading] = useState(false)

  // Curated lists
  const [expandedList, setExpandedList] = useState<string | null>(null)
  const [listBooksMap, setListBooksMap] = useState<Record<string, Book[]>>({})
  const [listLoading, setListLoading] = useState<string | null>(null)

  // Genre deep-dives
  const [expandedGenre, setExpandedGenre] = useState<string | null>(null)
  const [genreBooksMap, setGenreBooksMap] = useState<Record<string, Book[]>>({})
  const [genreLoading, setGenreLoading] = useState<string | null>(null)

  const { triggerActivity } = useGamification()
  const { showToast } = useToast()

  const handleSave = useCallback(
    (book: Book) => {
      onSaveBook(book)
      triggerActivity("like_book")
      showToast(`"${book.title}" saved to library`)
    },
    [onSaveBook, triggerActivity, showToast]
  )

  // Load trending on mount
  useEffect(() => {
    let cancelled = false
    async function load() {
      setTrendingLoading(true)
      const books = await getTrendingBooks(12)
      if (!cancelled) {
        setTrending(books)
        setTrendingLoading(false)
      }
    }
    load()
    return () => {
      cancelled = true
    }
  }, [])

  // Load author spotlight when liked books change
  useEffect(() => {
    if (likedBooks.length === 0) return
    let cancelled = false

    async function load() {
      // Find most common author
      const authorCounts: Record<string, { count: number; bookTitle: string }> =
        {}
      likedBooks.forEach((b) => {
        if (!authorCounts[b.author]) {
          authorCounts[b.author] = { count: 0, bookTitle: b.title }
        }
        authorCounts[b.author].count++
      })
      const sorted = Object.entries(authorCounts).sort(
        (a, b) => b[1].count - a[1].count
      )
      if (sorted.length === 0) return

      const [topAuthor, { bookTitle }] = sorted[0]
      setAuthorLoading(true)
      const books = await getAuthorBooks(topAuthor, savedBookIds)
      if (!cancelled) {
        if (books.length > 0) {
          setAuthorData({ author: topAuthor, bookTitle, books })
        }
        setAuthorLoading(false)
      }
    }
    load()
    return () => {
      cancelled = true
    }
    // Only re-run when the number of liked books changes, not on every render
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [likedBooks.length])

  // Surprise me handler
  const handleSurprise = useCallback(async () => {
    setSurpriseLoading(true)
    const result = await getSurpriseBook(likedBooks)
    setSurprise(result)
    setSurpriseLoading(false)
  }, [likedBooks])

  // Curated list expand
  const handleToggleList = useCallback(
    async (listId: string) => {
      if (expandedList === listId) {
        setExpandedList(null)
        return
      }
      setExpandedList(listId)

      if (listBooksMap[listId]) return // already loaded

      const list = curatedLists.find((l) => l.id === listId)
      if (!list) return

      setListLoading(listId)
      const books = await getListBooks(list.searchQuery, 12)
      setListBooksMap((prev) => ({ ...prev, [listId]: books }))
      setListLoading(null)
    },
    [expandedList, listBooksMap]
  )

  // Genre deep-dive expand
  const handleToggleGenre = useCallback(
    async (genreId: string) => {
      if (expandedGenre === genreId) {
        setExpandedGenre(null)
        return
      }
      setExpandedGenre(genreId)

      if (genreBooksMap[genreId]) return

      const genre = subGenres.find((g) => g.id === genreId)
      if (!genre) return

      setGenreLoading(genreId)
      const books = await getListBooks(genre.searchQuery, 10)
      setGenreBooksMap((prev) => ({ ...prev, [genreId]: books }))
      setGenreLoading(null)
    },
    [expandedGenre, genreBooksMap]
  )

  // Color map for sub-genre badges
  const colorMap: Record<string, string> = {
    emerald: "bg-emerald-50 text-emerald-700 border-emerald-200",
    stone: "bg-stone-100 text-stone-700 border-stone-300",
    amber: "bg-amber-50 text-amber-700 border-amber-200",
    slate: "bg-slate-100 text-slate-700 border-slate-300",
    violet: "bg-violet-50 text-violet-700 border-violet-200",
    orange: "bg-orange-50 text-orange-700 border-orange-200",
  }

  return (
    <div className="space-y-6">
      {/* ----------------------------------------------------------------- */}
      {/* Surprise Me */}
      {/* ----------------------------------------------------------------- */}
      <div className="bg-white rounded-xl border border-stone-200/60 shadow-sm overflow-hidden">
        <div className="p-4 sm:p-5">
          <div className="flex items-center gap-2 mb-1">
            <Shuffle className="w-4 h-4 text-teal-600" />
            <h3 className="text-sm font-semibold text-stone-900">
              Surprise Me
            </h3>
          </div>
          <p className="text-xs text-stone-400 mb-3">
            Discover a random book from a genre you haven&apos;t explored yet
          </p>

          {!surprise && !surpriseLoading && (
            <button
              onClick={handleSurprise}
              className="w-full py-3 rounded-xl bg-stone-900 text-white text-sm font-medium hover:bg-stone-800 active:scale-[0.98] transition-all tap-target touch-manipulation"
            >
              Show me something new
            </button>
          )}

          {surpriseLoading && <InlineSpinner />}

          <AnimatePresence mode="wait">
            {surprise && !surpriseLoading && (
              <motion.div
                key={surprise.book.id}
                initial={{ opacity: 0, y: 8 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0 }}
                transition={{ type: "spring", stiffness: 300, damping: 28 }}
                className="flex gap-4"
              >
                <div className="relative w-[90px] aspect-[2/3] rounded-lg overflow-hidden bg-stone-200 flex-shrink-0 shadow-sm">
                  <BookCover
                    src={surprise.book.cover}
                    fallbackSrc={surprise.book.coverFallback}
                    alt={surprise.book.title}
                    fill
                    className="object-contain"
                    sizes="180px"
                  />
                </div>
                <div className="flex-1 min-w-0 py-0.5">
                  <span className="inline-block text-[10px] font-semibold uppercase tracking-wide text-teal-600 bg-teal-50 px-2 py-0.5 rounded-full mb-1.5">
                    From: {surprise.genre}
                  </span>
                  <h4 className="font-semibold text-sm text-stone-900 line-clamp-2 leading-tight">
                    {surprise.book.title}
                  </h4>
                  <p className="text-xs text-stone-400 mt-0.5 truncate">
                    {surprise.book.author}
                  </p>
                  <div className="flex items-center gap-1 mt-1">
                    <Star className="w-3 h-3 fill-amber-500 text-amber-500" />
                    <span className="text-xs font-medium text-stone-600">
                      {surprise.book.rating}
                    </span>
                    <span className="text-[10px] text-stone-300 mx-1">
                      \u00B7
                    </span>
                    <span className="text-[10px] text-stone-400">
                      {surprise.book.pages}p
                    </span>
                  </div>
                  <div className="flex gap-2 mt-2.5">
                    <button
                      onClick={() => handleSave(surprise.book)}
                      disabled={savedBookIds.has(surprise.book.id)}
                      className={`flex items-center gap-1 px-3 py-1.5 rounded-lg text-xs font-medium transition-all ${
                        savedBookIds.has(surprise.book.id)
                          ? "bg-stone-100 text-stone-400"
                          : "bg-stone-900 text-white hover:bg-stone-800 active:scale-[0.98]"
                      }`}
                    >
                      <Heart
                        className={`w-3 h-3 ${savedBookIds.has(surprise.book.id) ? "fill-current" : ""}`}
                      />
                      {savedBookIds.has(surprise.book.id) ? "Saved" : "Save"}
                    </button>
                    <button
                      onClick={handleSurprise}
                      className="flex items-center gap-1 px-3 py-1.5 rounded-lg text-xs font-medium text-stone-500 hover:bg-stone-100 transition-all active:scale-[0.98]"
                    >
                      <RefreshCw className="w-3 h-3" />
                      Try another
                    </button>
                  </div>
                </div>
              </motion.div>
            )}
          </AnimatePresence>
        </div>
      </div>

      {/* ----------------------------------------------------------------- */}
      {/* Trending Now */}
      {/* ----------------------------------------------------------------- */}
      <div>
        <SectionHeader
          icon={<Flame className="w-4 h-4 text-orange-500" />}
          title="Trending Now"
          subtitle="Popular today"
        />
        {trendingLoading ? (
          <InlineSpinner />
        ) : trending.length > 0 ? (
          <HorizontalScroll>
            {trending.map((book, i) => (
              <ExploreBookCard
                key={book.id}
                book={book}
                onSave={handleSave}
                isSaved={savedBookIds.has(book.id)}
                index={i}
              />
            ))}
          </HorizontalScroll>
        ) : (
          <p className="text-xs text-stone-400 px-0.5">
            Could not load trending books right now.
          </p>
        )}
      </div>

      {/* ----------------------------------------------------------------- */}
      {/* Author Spotlight */}
      {/* ----------------------------------------------------------------- */}
      {(authorData || authorLoading) && (
        <div>
          <SectionHeader
            icon={<User className="w-4 h-4 text-indigo-500" />}
            title={
              authorData
                ? `More by ${authorData.author}`
                : "Author Spotlight"
            }
            subtitle={
              authorData
                ? `You liked "${authorData.bookTitle}"`
                : undefined
            }
          />
          {authorLoading ? (
            <InlineSpinner />
          ) : authorData && authorData.books.length > 0 ? (
            <HorizontalScroll>
              {authorData.books.map((book, i) => (
                <ExploreBookCard
                  key={book.id}
                  book={book}
                  onSave={handleSave}
                  isSaved={savedBookIds.has(book.id)}
                  index={i}
                />
              ))}
            </HorizontalScroll>
          ) : null}
        </div>
      )}

      {/* ----------------------------------------------------------------- */}
      {/* Curated Collections */}
      {/* ----------------------------------------------------------------- */}
      <div>
        <SectionHeader
          icon={<BookOpen className="w-4 h-4 text-amber-600" />}
          title="Curated Collections"
        />
        <div className="space-y-2">
          {curatedLists.map((list) => {
            const isExpanded = expandedList === list.id
            const books = listBooksMap[list.id] || []
            const isLoading = listLoading === list.id

            return (
              <div
                key={list.id}
                className="bg-white rounded-xl border border-stone-200/60 shadow-sm overflow-hidden"
              >
                <button
                  onClick={() => handleToggleList(list.id)}
                  className="w-full flex items-center gap-3 p-3.5 text-left hover:bg-stone-50/50 transition-colors"
                >
                  <span className="text-lg">{list.emoji}</span>
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-semibold text-stone-900">
                      {list.name}
                    </p>
                    <p className="text-[11px] text-stone-400">
                      {list.description}
                    </p>
                  </div>
                  <motion.div
                    animate={{ rotate: isExpanded ? 90 : 0 }}
                    transition={{ duration: 0.15 }}
                  >
                    <ChevronRight className="w-4 h-4 text-stone-300" />
                  </motion.div>
                </button>

                <AnimatePresence>
                  {isExpanded && (
                    <motion.div
                      initial={{ height: 0, opacity: 0 }}
                      animate={{ height: "auto", opacity: 1 }}
                      exit={{ height: 0, opacity: 0 }}
                      transition={{ duration: 0.2, ease: [0.4, 0, 0.2, 1] }}
                      className="overflow-hidden"
                    >
                      <div className="px-3.5 pb-3.5">
                        {isLoading ? (
                          <InlineSpinner />
                        ) : books.length > 0 ? (
                          <HorizontalScroll>
                            {books.map((book, i) => (
                              <ExploreBookCard
                                key={book.id}
                                book={book}
                                onSave={handleSave}
                                isSaved={savedBookIds.has(book.id)}
                                index={i}
                              />
                            ))}
                          </HorizontalScroll>
                        ) : (
                          <p className="text-xs text-stone-400 py-3">
                            No books found for this collection.
                          </p>
                        )}
                      </div>
                    </motion.div>
                  )}
                </AnimatePresence>
              </div>
            )
          })}
        </div>
      </div>

      {/* ----------------------------------------------------------------- */}
      {/* Genre Deep-Dives */}
      {/* ----------------------------------------------------------------- */}
      <div>
        <SectionHeader
          icon={
            <span className="text-base leading-none">{"\u{1F50D}"}</span>
          }
          title="Genre Deep-Dives"
          subtitle="Explore sub-genres"
        />
        <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
          {subGenres.map((genre) => {
            const isExpanded = expandedGenre === genre.id
            const books = genreBooksMap[genre.id] || []
            const isLoading = genreLoading === genre.id

            return (
              <div
                key={genre.id}
                className={`rounded-xl border overflow-hidden transition-all ${
                  isExpanded
                    ? "col-span-2 sm:col-span-3 bg-white border-stone-200/60 shadow-sm"
                    : `border-transparent cursor-pointer ${colorMap[genre.color] || "bg-stone-50 text-stone-700"}`
                }`}
              >
                <button
                  onClick={() => handleToggleGenre(genre.id)}
                  className={`w-full text-left p-3 transition-colors ${
                    isExpanded ? "hover:bg-stone-50/50" : "hover:opacity-90"
                  }`}
                >
                  <div className="flex items-center gap-2">
                    <span className="text-base">{genre.emoji}</span>
                    <span className="text-xs font-semibold truncate">
                      {genre.name}
                    </span>
                    {isExpanded && (
                      <ChevronDown className="w-3.5 h-3.5 text-stone-400 ml-auto flex-shrink-0" />
                    )}
                  </div>
                  {!isExpanded && (
                    <p className="text-[10px] opacity-70 mt-1 line-clamp-2 leading-relaxed">
                      {genre.description.split(".")[0]}.
                    </p>
                  )}
                </button>

                <AnimatePresence>
                  {isExpanded && (
                    <motion.div
                      initial={{ height: 0, opacity: 0 }}
                      animate={{ height: "auto", opacity: 1 }}
                      exit={{ height: 0, opacity: 0 }}
                      transition={{ duration: 0.2, ease: [0.4, 0, 0.2, 1] }}
                      className="overflow-hidden"
                    >
                      <div className="px-3 pb-3">
                        <div
                          className={`rounded-lg p-3 mb-3 ${colorMap[genre.color] || "bg-stone-50"}`}
                        >
                          <p className="text-xs font-semibold mb-1">
                            What is {genre.name}?
                          </p>
                          <p className="text-[11px] opacity-80 leading-relaxed">
                            {genre.description}
                          </p>
                        </div>

                        {isLoading ? (
                          <InlineSpinner />
                        ) : books.length > 0 ? (
                          <HorizontalScroll>
                            {books.map((book, i) => (
                              <ExploreBookCard
                                key={book.id}
                                book={book}
                                onSave={handleSave}
                                isSaved={savedBookIds.has(book.id)}
                                index={i}
                              />
                            ))}
                          </HorizontalScroll>
                        ) : (
                          <p className="text-xs text-stone-400 py-3">
                            No books found for this sub-genre.
                          </p>
                        )}
                      </div>
                    </motion.div>
                  )}
                </AnimatePresence>
              </div>
            )
          })}
        </div>
      </div>
    </div>
  )
}
