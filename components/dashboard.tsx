"use client"

import { useState, useEffect, useMemo } from "react"
import { Book } from "@/lib/book-data"
import { getLikedBooks, clearLikedBooks, addBookToReading, getReadingProgress, saveLikedBooks, getBookReviews, getShelfAssignments } from "@/lib/storage"
import { Button } from "@/components/ui/button"
import { AdminPanel } from "./admin-panel"
import { ReadingProgressTracker } from "./reading-progress"
import { SmartRecommendations } from "./smart-recommendations"
import { BookDetailModal } from "./book-detail-modal"
import { StarRating } from "./star-rating"
import { getUserStats } from "@/lib/storage"
import { useGamification } from "./gamification-provider"
import { ArrowLeft, BookOpen, Star, Clock, Trash2, Settings, Sparkles, Heart, Trophy, Search, Library, SlidersHorizontal, Download, X as XIcon } from "lucide-react"
import { SittingReadingDoodle, ReadingSideDoodle, ReadingDoodle, FloatDoodle, GroovyDoodle, LovingDoodle } from "./illustrations"
import { motion, AnimatePresence } from "framer-motion"
import { BookCover } from "@/components/book-cover"
import { useToast } from "./toast-provider"
import { BookSearch } from "./book-search"
import { DiscoverHub } from "./discover-hub"
import { DailyPickCard } from "./daily-pick-card"
import { ShelfManager } from "./shelf-manager"
import { ReadingPath } from "./reading-path"
import { getShelves, getBooksForShelf, shouldShowBackupReminder, dismissBackupReminder, type Shelf } from "@/lib/storage"
import { estimateReadingTime, getReadingSpeed, setReadingSpeed, getAllSpeeds, type ReadingSpeed } from "@/lib/reading-time"

interface DashboardProps {
  onBack?: () => void
  onStartDiscovery: () => void
  showBackButton?: boolean
}

export function Dashboard({ onBack, onStartDiscovery, showBackButton = true }: DashboardProps) {
  const [likedBooks, setLikedBooks] = useState<Book[]>([])
  const [filter, setFilter] = useState<string>("all")
  const [sortBy, setSortBy] = useState<"recent" | "rating" | "pages">("recent")
  const [showAdmin, setShowAdmin] = useState(false)
  const [selectedBook, setSelectedBook] = useState<Book | null>(null)
  const [isBookModalOpen, setIsBookModalOpen] = useState(false)
  const [userStats, setUserStats] = useState(getUserStats())
  const [showSearch, setShowSearch] = useState(false)
  const [showShelfManager, setShowShelfManager] = useState(false)
  const [shelves, setShelves] = useState<Shelf[]>([])
  const [shelfFilter, setShelfFilter] = useState<string | null>(null)
  const [formatFilter, setFormatFilter] = useState<"all" | "ebook" | "audio">("all")
  const [readingSpd, setReadingSpd] = useState<ReadingSpeed>("average")
  const [showFilters, setShowFilters] = useState(false)
  const [showBackupBanner, setShowBackupBanner] = useState(false)

  const { triggerActivity, showAchievementsPanel } = useGamification()
  const { showToast } = useToast()

  useEffect(() => {
    setLikedBooks(getLikedBooks())
    setUserStats(getUserStats())
    setShelves(getShelves())
    setReadingSpd(getReadingSpeed())
    setShowBackupBanner(shouldShowBackupReminder())
  }, [])

  useEffect(() => {
    setUserStats(getUserStats())
  }, [likedBooks])

  // Pre-compute review and shelf lookups once instead of per-book in render
  const reviewMap = useMemo(() => {
    const map: Record<string, ReturnType<typeof getBookReviews>[number]> = {}
    getBookReviews().forEach(r => { map[r.bookId] = r })
    return map
  }, [likedBooks, isBookModalOpen])

  const shelfMap = useMemo(() => {
    const map: Record<string, string[]> = {}
    getShelfAssignments().forEach(a => {
      if (!map[a.bookId]) map[a.bookId] = []
      map[a.bookId].push(a.shelfId)
    })
    return map
  }, [likedBooks, isBookModalOpen, showShelfManager])

  const handleClearAll = () => {
    if (confirm("Are you sure you want to clear all your liked books? This action cannot be undone.")) {
      clearLikedBooks()
      setLikedBooks([])
      showToast("Library cleared", "info")
    }
  }

  const handleSearchSave = (book: Book) => {
    // Read fresh from localStorage to avoid overwriting books saved by other components
    const current = getLikedBooks()
    if (current.some(b => b.id === book.id)) {
      showToast("Already in your library", "info")
      return
    }
    const updated = [...current, book]
    setLikedBooks(updated)
    saveLikedBooks(updated)
    triggerActivity('like_book')
    showToast(`"${book.title}" saved to library`)
  }

  const handleStartReading = (book: Book) => {
    const alreadyReading = getReadingProgress().some(p => p.bookId === book.id)
    if (alreadyReading) {
      showToast("Already in your reading list", "info")
      return
    }
    addBookToReading(book)
    showToast(`"${book.title}" added to reading list`)
  }

  const handleBookClick = (book: Book) => {
    setSelectedBook(book)
    setIsBookModalOpen(true)
    triggerActivity('daily_reading')
  }

  const handleCloseModal = () => {
    setIsBookModalOpen(false)
    setSelectedBook(null)
  }

  // Memoize Set of saved book IDs to avoid creating new references every render
  const savedBookIds = useMemo(() => new Set(likedBooks.map(b => b.id)), [likedBooks])

  const shelfBookIds = shelfFilter ? new Set(getBooksForShelf(shelfFilter)) : null
  const filteredBooks = likedBooks.filter(book => {
    if (shelfBookIds && !shelfBookIds.has(book.id)) return false
    if (formatFilter === "ebook" && !book.formats?.ebook) return false
    if (formatFilter === "audio" && !book.formats?.audiobook) return false
    if (filter === "all") return true
    return book.genre.some(genre =>
      genre.toLowerCase().includes(filter.toLowerCase())
    )
  })

  const sortedBooks = [...filteredBooks].sort((a, b) => {
    switch (sortBy) {
      case "rating":
        return b.rating - a.rating
      case "pages":
        return a.pages - b.pages
      default:
        return 0
    }
  })

  const genres = Array.from(new Set(likedBooks.flatMap(book => book.genre)))

  const stats = {
    totalBooks: likedBooks.length,
    totalPages: likedBooks.reduce((sum, book) => sum + book.pages, 0),
    averageRating: likedBooks.length > 0
      ? (likedBooks.reduce((sum, book) => sum + book.rating, 0) / likedBooks.length).toFixed(1)
      : "0",
    favoriteGenre: genres.length > 0
      ? genres.reduce((a, b) =>
          likedBooks.filter(book => book.genre.includes(a)).length >
          likedBooks.filter(book => book.genre.includes(b)).length ? a : b
        )
      : "None"
  }

  const sortOptions: { value: "recent" | "rating" | "pages"; label: string }[] = [
    { value: "recent", label: "Recent" },
    { value: "rating", label: "Top Rated" },
    { value: "pages", label: "Shortest" },
  ]

  const hasActiveFilters = shelfFilter !== null || filter !== "all" || formatFilter !== "all"

  // Time-based greeting
  const getGreeting = () => {
    const hour = new Date().getHours()
    if (hour < 12) return "Good morning"
    if (hour < 17) return "Good afternoon"
    return "Good evening"
  }

  const fadeInUp = (delay: number) => ({
    initial: { opacity: 0, y: 8 },
    animate: { opacity: 1, y: 0 },
    transition: { type: "spring" as const, stiffness: 300, damping: 28, delay },
  })

  return (
    <div className="min-h-screen bg-background smooth-scroll pb-20">
      {/* Header */}
      <div className="bg-background/90 backdrop-blur-md border-b border-stone-200/60 sticky top-0 z-10">
        <div className="max-w-6xl mx-auto px-4 sm:px-6 py-3 sm:py-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3 min-w-0">
              {showBackButton && onBack && (
                <button
                  onClick={onBack}
                  aria-label="Go back"
                  className="p-2 -ml-2 rounded-lg hover:bg-stone-100 transition-colors tap-target touch-manipulation"
                >
                  <ArrowLeft className="w-5 h-5 text-stone-600" />
                </button>
              )}
              <div className="min-w-0">
                <h1 className="text-xl sm:text-2xl font-bold text-stone-900 tracking-tight font-serif">
                  My Library
                </h1>
              </div>
            </div>
            <div className="flex items-center gap-2">
              <button
                onClick={() => setShowSearch(true)}
                aria-label="Search books"
                className="p-2 rounded-lg hover:bg-stone-100 transition-colors tap-target touch-manipulation"
              >
                <Search className="w-5 h-5 text-stone-500" />
              </button>
              <button
                onClick={showAchievementsPanel}
                aria-label="Achievements"
                className="flex items-center gap-1.5 px-3 py-1.5 rounded-full bg-amber-50 hover:bg-amber-100 text-amber-700 text-sm font-medium transition-colors tap-target touch-manipulation"
              >
                <Trophy className="w-4 h-4" />
                <span className="hidden sm:inline">Lv.{userStats.level}</span>
                <span className="sm:hidden">{userStats.level}</span>
              </button>
              <button
                onClick={() => setShowAdmin(!showAdmin)}
                aria-label="Settings"
                className="p-2 rounded-lg hover:bg-stone-100 transition-colors tap-target touch-manipulation"
              >
                <Settings className="w-5 h-5 text-stone-400" />
              </button>
              {likedBooks.length > 0 && (
                <button
                  onClick={handleClearAll}
                  aria-label="Clear all books"
                  className="p-2 rounded-lg hover:bg-red-50 text-stone-400 hover:text-red-500 transition-colors tap-target touch-manipulation"
                >
                  <Trash2 className="w-5 h-5" />
                </button>
              )}
            </div>
          </div>
        </div>
      </div>

      <div className="max-w-6xl mx-auto px-4 sm:px-6">
        {/* Admin Panel */}
        <AnimatePresence>
          {showAdmin && (
            <motion.div
              initial={{ opacity: 0, height: 0 }}
              animate={{ opacity: 1, height: "auto" }}
              exit={{ opacity: 0, height: 0 }}
              transition={{ duration: 0.2 }}
              className="pt-6"
            >
              <AdminPanel onBooksLoaded={() => { setLikedBooks(getLikedBooks()) }} />
            </motion.div>
          )}
        </AnimatePresence>

        {likedBooks.length === 0 ? (
          /* Empty State */
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            className="text-center py-12 sm:py-20 px-4"
          >
            <motion.div
              initial={{ scale: 0.85, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              transition={{ delay: 0.1, type: "spring", stiffness: 150 }}
              className="w-48 h-36 sm:w-56 sm:h-44 mx-auto mb-4 opacity-80"
            >
              <SittingReadingDoodle />
            </motion.div>
            <h2 className="text-2xl sm:text-3xl font-bold text-stone-900 mb-3 font-serif">
              Your shelf is waiting
            </h2>
            <p className="text-stone-500 mb-8 max-w-md mx-auto text-base sm:text-lg leading-relaxed">
              Start swiping to discover books you&apos;ll love.
              We&apos;ll learn your taste and suggest better matches over time.
            </p>
            <Button
              onClick={onStartDiscovery}
              className="h-12 px-8 text-base bg-stone-900 hover:bg-stone-800 text-white font-medium rounded-xl transition-all shadow-sm hover:shadow-md tap-target touch-manipulation"
            >
              <Sparkles className="w-5 h-5 mr-2" />
              Start Discovering
            </Button>
          </motion.div>
        ) : (
          <div className="space-y-10 py-6 sm:py-8">

            {/* Backup reminder */}
            {showBackupBanner && (
              <motion.div
                initial={{ opacity: 0, y: -8 }}
                animate={{ opacity: 1, y: 0 }}
                className="flex items-center gap-3 px-4 py-3 bg-amber-50 border border-amber-200/60 rounded-xl"
              >
                <Download className="w-4 h-4 text-amber-600 flex-shrink-0" />
                <p className="text-xs text-amber-800 flex-1">
                  Your library is stored in this browser only.{' '}
                  <button
                    onClick={() => { setShowAdmin(true); setShowBackupBanner(false) }}
                    className="font-semibold underline underline-offset-2 hover:text-amber-900"
                  >
                    Export a backup
                  </button>{' '}
                  to keep it safe.
                </p>
                <button
                  onClick={() => { dismissBackupReminder(); setShowBackupBanner(false) }}
                  aria-label="Dismiss backup reminder"
                  className="p-1 rounded-md hover:bg-amber-100 transition-colors flex-shrink-0"
                >
                  <XIcon className="w-3.5 h-3.5 text-amber-500" />
                </button>
              </motion.div>
            )}

            {/* ━━━ SECTION 1: Personal Greeting + Stats ━━━ */}
            <motion.div {...fadeInUp(0)}>
              <div className="flex items-start justify-between gap-4 mb-5">
                <div className="flex items-start gap-4">
                  <motion.div
                    initial={{ opacity: 0, scale: 0.8 }}
                    animate={{ opacity: 0.7, scale: 1 }}
                    transition={{ delay: 0.15, type: "spring", stiffness: 200, damping: 20 }}
                    className="hidden sm:block flex-shrink-0 w-20 h-16"
                  >
                    <ReadingSideDoodle />
                  </motion.div>
                  <div>
                    <h2 className="text-2xl sm:text-3xl font-bold text-stone-900 font-serif leading-tight">
                      {getGreeting()},<br className="sm:hidden" /> reader.
                    </h2>
                    <div className="flex items-center gap-2 mt-1.5 text-stone-500 text-sm">
                      <span className="flex items-center gap-1">
                        <BookOpen className="w-3.5 h-3.5 text-stone-400" />
                        {stats.totalBooks} books
                      </span>
                      <span className="w-0.5 h-0.5 rounded-full bg-stone-300 hidden sm:block" />
                      <span className="hidden sm:inline">{stats.totalPages.toLocaleString()} pages</span>
                      <span className="w-0.5 h-0.5 rounded-full bg-stone-300" />
                      <span className="flex items-center gap-0.5">
                        <Star className="w-3 h-3 text-amber-500 fill-amber-500" />
                        {stats.averageRating}
                      </span>
                    </div>
                  </div>
                </div>
                <Button
                  onClick={onStartDiscovery}
                  className="h-10 px-3 sm:px-5 text-sm bg-stone-900 hover:bg-stone-800 text-white font-medium rounded-xl transition-all shadow-sm flex-shrink-0 tap-target touch-manipulation"
                >
                  <Sparkles className="w-4 h-4 sm:mr-2" />
                  <span className="hidden sm:inline">Discover</span>
                </Button>
              </div>

              {/* Daily Pick — inline within the greeting zone */}
              {likedBooks.length >= 3 && (
                <DailyPickCard
                  onBookClick={handleBookClick}
                  onBookLiked={(book) => {
                    const current = getLikedBooks()
                    if (!current.some(b => b.id === book.id)) {
                      const updated = [...current, book]
                      setLikedBooks(updated)
                      saveLikedBooks(updated)
                    }
                    showToast(`"${book.title}" saved to library`)
                  }}
                />
              )}
            </motion.div>

            {/* ━━━ SECTION 2: Reading Progress (currently reading up front) ━━━ */}
            <motion.div {...fadeInUp(0.05)}>
              <ReadingProgressTracker onStartReading={onStartDiscovery} />
            </motion.div>

            {/* ━━━ SECTION 3: Your Library (the core — moved UP) ━━━ */}
            <motion.div {...fadeInUp(0.08)} className="space-y-4">
              {/* Section header + filter toggle */}
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <BookOpen className="w-5 h-5 text-amber-600 hidden sm:block" />
                  <h2 className="text-lg font-semibold text-stone-900 font-serif">
                    Your Books
                  </h2>
                  <span className="text-xs text-stone-400 bg-stone-100 px-2 py-0.5 rounded-full">
                    {sortedBooks.length !== likedBooks.length
                      ? `${sortedBooks.length} / ${likedBooks.length}`
                      : likedBooks.length}
                  </span>
                </div>
                <button
                  onClick={() => setShowFilters(!showFilters)}
                  className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium transition-all tap-target touch-manipulation ${
                    showFilters || hasActiveFilters
                      ? "bg-amber-50 text-amber-700"
                      : "text-stone-400 hover:text-stone-600 hover:bg-stone-50"
                  }`}
                >
                  <SlidersHorizontal className="w-3.5 h-3.5" />
                  Filters
                  {hasActiveFilters && (
                    <span className="w-1.5 h-1.5 rounded-full bg-amber-500" />
                  )}
                </button>
              </div>

              {/* Shelf pills — always visible, compact */}
              <div className="flex gap-2 overflow-x-auto hide-scrollbar pb-1">
                <button
                  onClick={() => setShelfFilter(null)}
                  className={`flex-shrink-0 px-3 py-1.5 rounded-full text-xs font-medium transition-all ${
                    shelfFilter === null
                      ? "bg-stone-900 text-white"
                      : "bg-stone-100 text-stone-600 hover:bg-stone-200"
                  }`}
                >
                  All
                </button>
                {shelves.map(shelf => (
                  <button
                    key={shelf.id}
                    onClick={() => setShelfFilter(shelfFilter === shelf.id ? null : shelf.id)}
                    className={`flex-shrink-0 px-3 py-1.5 rounded-full text-xs font-medium transition-all ${
                      shelfFilter === shelf.id
                        ? "bg-stone-900 text-white"
                        : "bg-stone-100 text-stone-600 hover:bg-stone-200"
                    }`}
                  >
                    {shelf.emoji} {shelf.name}
                  </button>
                ))}
                {genres.slice(0, 6).map(genre => (
                  <button
                    key={genre}
                    onClick={() => setFilter(filter === genre ? "all" : genre)}
                    className={`flex-shrink-0 px-3 py-1.5 rounded-full text-xs font-medium transition-all ${
                      filter === genre
                        ? "bg-amber-600 text-white"
                        : "bg-amber-50 text-amber-700 hover:bg-amber-100"
                    }`}
                  >
                    {genre}
                  </button>
                ))}
                <button
                  onClick={() => setShowShelfManager(true)}
                  aria-label="Manage shelves"
                  className="flex-shrink-0 px-2.5 py-1.5 rounded-full text-xs font-medium text-stone-400 hover:text-stone-600 hover:bg-stone-100 transition-all flex items-center gap-1"
                >
                  <Library className="w-3 h-3" />
                  Manage
                </button>
              </div>

              {/* Collapsible advanced filters */}
              <AnimatePresence>
                {showFilters && (
                  <motion.div
                    initial={{ opacity: 0, height: 0 }}
                    animate={{ opacity: 1, height: "auto" }}
                    exit={{ opacity: 0, height: 0 }}
                    transition={{ duration: 0.2 }}
                    className="overflow-hidden"
                  >
                    <div className="flex items-center gap-2 flex-wrap py-1">
                      <div className="flex gap-1.5">
                        {sortOptions.map(opt => (
                          <button
                            key={opt.value}
                            onClick={() => setSortBy(opt.value)}
                            className={`px-3 py-1.5 rounded-full text-xs font-medium transition-all ${
                              sortBy === opt.value
                                ? "bg-stone-900 text-white"
                                : "bg-stone-100 text-stone-500 hover:bg-stone-200"
                            }`}
                          >
                            {opt.label}
                          </button>
                        ))}
                      </div>

                      <span className="w-px h-4 bg-stone-200" />

                      <div className="flex gap-1">
                        {([
                          { value: "all" as const, label: "All Formats" },
                          { value: "ebook" as const, label: "eBook" },
                          { value: "audio" as const, label: "Audio" },
                        ]).map(f => (
                          <button
                            key={f.value}
                            onClick={() => setFormatFilter(f.value)}
                            className={`px-3 py-1.5 rounded-full text-xs font-medium transition-all ${
                              formatFilter === f.value
                                ? "bg-stone-900 text-white"
                                : "bg-stone-100 text-stone-500 hover:bg-stone-200"
                            }`}
                          >
                            {f.label}
                          </button>
                        ))}
                      </div>

                      <span className="w-px h-4 bg-stone-200" />

                      <select
                        value={readingSpd}
                        onChange={(e) => {
                          const speed = e.target.value as ReadingSpeed
                          setReadingSpd(speed)
                          setReadingSpeed(speed)
                        }}
                        className="text-[11px] text-stone-500 bg-transparent border-none cursor-pointer focus:outline-none hover:text-stone-700"
                      >
                        {getAllSpeeds().map(s => (
                          <option key={s.value} value={s.value}>{s.label}</option>
                        ))}
                      </select>
                    </div>
                  </motion.div>
                )}
              </AnimatePresence>

              {/* Books Grid */}
              <AnimatePresence mode="wait">
              {sortedBooks.length === 0 && likedBooks.length > 0 ? (
                <motion.div
                  key="empty-filter"
                  initial={{ opacity: 0, y: 8 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, y: -8 }}
                  transition={{ duration: 0.2 }}
                  className="text-center py-10"
                >
                  <div className="w-36 h-28 mx-auto mb-3 opacity-60">
                    <LovingDoodle />
                  </div>
                  <p className="text-sm text-stone-500">No books match these filters</p>
                  <button
                    onClick={() => { setFilter("all"); setShelfFilter(null); setFormatFilter("all") }}
                    className="mt-2 text-xs text-amber-600 hover:text-amber-700 font-medium"
                  >
                    Clear filters
                  </button>
                </motion.div>
              ) : (
              <motion.div
                key="books-grid"
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0 }}
                transition={{ duration: 0.15 }}
                className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 gap-3 sm:gap-4 lg:gap-5"
              >
                {sortedBooks.map((book, index) => {
                  const review = reviewMap[book.id] || null
                  const bookShelfIds = shelfMap[book.id] || []
                  const firstShelf = bookShelfIds.length > 0 ? shelves.find(s => s.id === bookShelfIds[0]) : null
                  return (
                    <motion.div
                      key={book.id}
                      initial={{ opacity: 0, y: 8 }}
                      animate={{ opacity: 1, y: 0 }}
                      transition={{ type: "spring", stiffness: 300, damping: 28, delay: Math.min(index * 0.03, 0.2) }}
                      whileHover={{ y: -3, transition: { type: "spring", stiffness: 400, damping: 30 } }}
                      className="group cursor-pointer"
                      onClick={() => handleBookClick(book)}
                    >
                      {/* Cover */}
                      <div className="relative aspect-[2/3] rounded-xl overflow-hidden bg-stone-100 mb-2.5 shadow-sm group-hover:shadow-md transition-shadow ring-1 ring-stone-200/50">
                        <BookCover
                          src={book.cover}
                          fallbackSrc={book.coverFallback}
                          alt={book.title}
                          fill
                          className="object-contain"
                          sizes="(max-width: 640px) 50vw, (max-width: 1024px) 33vw, 20vw"
                        />
                        {/* Rating badge */}
                        <div className="absolute top-2 right-2 bg-white/90 backdrop-blur-sm px-1.5 py-0.5 rounded-md flex items-center gap-0.5 shadow-sm">
                          <Star className="w-3 h-3 text-amber-500 fill-amber-500" />
                          <span className="text-xs font-semibold text-stone-700">{book.rating}</span>
                        </div>
                        {/* Favorite heart */}
                        {review?.favorite && (
                          <div className="absolute top-2 left-2">
                            <Heart className="w-4 h-4 text-red-500 fill-red-500 drop-shadow-sm" />
                          </div>
                        )}
                        {/* Shelf badge */}
                        {firstShelf && (
                          <div className="absolute bottom-2 left-2 bg-white/90 backdrop-blur-sm px-1.5 py-0.5 rounded-md text-[11px] font-medium text-stone-600 max-w-[calc(100%-16px)] truncate shadow-sm">
                            {firstShelf.emoji} {firstShelf.name}
                          </div>
                        )}
                      </div>

                      {/* Info */}
                      <div className="space-y-0.5 px-0.5">
                        <h3 className="font-semibold text-sm text-stone-900 line-clamp-2 leading-tight group-hover:text-amber-800 transition-colors">
                          {book.title}
                        </h3>
                        <p className="text-xs text-stone-500 truncate">{book.author}</p>

                        {/* User rating */}
                        {review && (
                          <div className="pt-1">
                            <StarRating rating={review.rating} readonly size="sm" />
                          </div>
                        )}

                        {/* Meta */}
                        <div className="flex items-center gap-2 text-xs text-stone-400 pt-0.5 flex-wrap">
                          <span>{book.pages}p</span>
                          <span className="w-0.5 h-0.5 rounded-full bg-stone-300" />
                          <span>{estimateReadingTime(book.pages, readingSpd)}</span>
                          {book.formats?.ebook && (
                            <span className="px-1 py-px rounded bg-blue-50 text-blue-500 text-[9px] font-medium">eBook</span>
                          )}
                        </div>
                      </div>
                    </motion.div>
                  )
                })}
              </motion.div>
              )}
              </AnimatePresence>
            </motion.div>

            {/* ━━━ SECTION 4: Discovery Zone ━━━ */}
            <div className="space-y-8">
              <div className="flex flex-col items-center gap-2 py-2">
                <div className="w-28 h-24 opacity-60">
                  <FloatDoodle />
                </div>
                <div className="flex items-center gap-3 w-full">
                  <div className="h-px flex-1 bg-stone-200/60" />
                  <span className="text-xs font-semibold text-stone-400 uppercase tracking-widest">Discover</span>
                  <div className="h-px flex-1 bg-stone-200/60" />
                </div>
              </div>

              {/* Smart Recommendations */}
              <motion.div {...fadeInUp(0.1)}>
                <SmartRecommendations
                  onBookLike={(book) => {
                    const current = getLikedBooks()
                    if (!current.some(b => b.id === book.id)) {
                      const updated = [...current, book]
                      setLikedBooks(updated)
                      saveLikedBooks(updated)
                    }
                  }}
                  onStartReading={handleStartReading}
                  onBookClick={handleBookClick}
                />
              </motion.div>

              {/* Discover Hub */}
              <motion.div {...fadeInUp(0.12)}>
                <DiscoverHub
                  likedBooks={likedBooks}
                  onSaveBook={(book) => {
                    const current = getLikedBooks()
                    if (current.some(b => b.id === book.id)) return
                    const updated = [...current, book]
                    setLikedBooks(updated)
                    saveLikedBooks(updated)
                  }}
                  savedBookIds={savedBookIds}
                  onBookClick={handleBookClick}
                />
              </motion.div>

              {/* Reading Paths */}
              {likedBooks.length >= 3 && (
                <ReadingPath onBookClick={handleBookClick} />
              )}
            </div>
          </div>
        )}
      </div>

      {/* Book Detail Modal */}
      <BookDetailModal
        book={selectedBook}
        isOpen={isBookModalOpen}
        onClose={handleCloseModal}
        onStartReading={handleStartReading}
        onRemoveBook={(book) => {
          const current = getLikedBooks()
          const updated = current.filter(b => b.id !== book.id)
          setLikedBooks(updated)
          saveLikedBooks(updated)
          showToast(`"${book.title}" removed from library`, "info")
        }}
      />

      {/* Book Search */}
      <BookSearch
        isOpen={showSearch}
        onClose={() => setShowSearch(false)}
        onSaveBook={handleSearchSave}
        savedBookIds={likedBooks.map(b => b.id)}
      />

      {/* Shelf Manager */}
      <ShelfManager
        isOpen={showShelfManager}
        onClose={() => setShowShelfManager(false)}
        onShelvesChanged={() => setShelves(getShelves())}
      />
    </div>
  )
}
