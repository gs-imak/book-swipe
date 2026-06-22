"use client"

import { useState, useEffect, useMemo, useRef, useCallback } from "react"
import dynamic from "next/dynamic"
import { Book } from "@/lib/book-data"
import { getLikedBooks, clearLikedBooks, addBookToReading, getReadingProgress, addLikedBook, removeLikedBook, getBookReviews, getBookNotes, getShelfAssignments, getReadingTimeToday } from "@/lib/storage"
import { Button } from "@/components/ui/button"
import { ReadingProgressTracker } from "./reading-progress"
import { BookDetailModal } from "./book-detail-modal"
import { StarRating } from "./star-rating"
import { getUserStats } from "@/lib/storage"
import { useGamification } from "./gamification-provider"
import { ArrowLeft, BookOpen, Star, Clock, Trash2, Settings, Sparkles, Heart, Trophy, Search, Library, SlidersHorizontal, Download, X as XIcon, Target, FolderOpen, ChevronRight, Flame, Camera } from "lucide-react"
import { SittingReadingDoodle, ReadingSideDoodle, ReadingDoodle, FloatDoodle, GroovyDoodle, LovingDoodle } from "./illustrations"
import { motion, AnimatePresence } from "framer-motion"
import { BookCover } from "@/components/book-cover"
import { useToast } from "./toast-provider"
import { BookSearch } from "./book-search"
import { DailyPickCard } from "./daily-pick-card"
import { ShelfManager } from "./shelf-manager"
import { ConfirmDialog } from "./confirm-dialog"
import { ReadingGoalSetter } from "./reading-goal-setter"
import { SmartNextRead } from "./smart-next-read"

// Lazy-load below-the-fold discovery components + the admin-only panel
const AdminPanel = dynamic(() => import("./admin-panel").then(m => ({ default: m.AdminPanel })), { ssr: false })
const SmartRecommendations = dynamic(() => import("./smart-recommendations").then(m => ({ default: m.SmartRecommendations })), { ssr: false })
const DiscoverHub = dynamic(() => import("./discover-hub").then(m => ({ default: m.DiscoverHub })), { ssr: false })
const ReadingPath = dynamic(() => import("./reading-path").then(m => ({ default: m.ReadingPath })), { ssr: false })
const QuotesGallery = dynamic(() => import("./quotes-gallery").then(m => ({ default: m.QuotesGallery })), { ssr: false })
const ReadingWrapped = dynamic(() => import("./reading-wrapped").then(m => ({ default: m.ReadingWrapped })), { ssr: false })
const ReadingChallenges = dynamic(() => import("./reading-challenges").then(m => ({ default: m.ReadingChallenges })), { ssr: false })
const BookCollections = dynamic(() => import("./book-collections").then(m => ({ default: m.BookCollections })), { ssr: false })
import { getShelves, getBooksForShelf, shouldShowBackupReminder, dismissBackupReminder, getHiddenBookIds, hideBook, unhideBook, type Shelf } from "@/lib/storage"
import { estimateReadingTime, getReadingSpeed, setReadingSpeed, getAllSpeeds, type ReadingSpeed } from "@/lib/reading-time"

interface DashboardProps {
  onBack?: () => void
  onStartDiscovery: () => void
  showBackButton?: boolean
  onScan?: () => void
}

export function Dashboard({ onBack, onStartDiscovery, showBackButton = true, onScan }: DashboardProps) {
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
  const [showWrapped, setShowWrapped] = useState(false)
  const [showCollections, setShowCollections] = useState(false)
  const [showChallenges, setShowChallenges] = useState(false)
  const [hiddenIds, setHiddenIds] = useState<Set<string>>(new Set())
  const [showHidden, setShowHidden] = useState(false)
  const [authorFilter, setAuthorFilter] = useState<string | null>(null)
  const [moodFilter, setMoodFilter] = useState<string | null>(null)
  const [currentlyReading, setCurrentlyReading] = useState<ReturnType<typeof getReadingProgress>>([])
  const [showAllReading, setShowAllReading] = useState(false)
  const [showClearConfirm, setShowClearConfirm] = useState(false)

  // Progressive loading: render books in batches for scroll performance
  const BOOKS_PER_PAGE = 30
  const [visibleCount, setVisibleCount] = useState(BOOKS_PER_PAGE)
  const sentinelRef = useRef<HTMLDivElement | null>(null)
  const observerRef = useRef<IntersectionObserver | null>(null)

  const { triggerActivity, showAchievementsPanel } = useGamification()
  const { showToast } = useToast()

  useEffect(() => {
    setLikedBooks(getLikedBooks())
    setUserStats(getUserStats())
    setShelves(getShelves())
    setReadingSpd(getReadingSpeed())
    setShowBackupBanner(shouldShowBackupReminder())
    setHiddenIds(new Set(getHiddenBookIds()))
    setCurrentlyReading(
      getReadingProgress()
        .filter(p => p.status === "reading")
        .sort((a, b) => new Date(b.lastReadDate).getTime() - new Date(a.lastReadDate).getTime())
    )
  }, [])

  useEffect(() => {
    setUserStats(getUserStats())
  }, [likedBooks])

  // Pre-compute review and shelf lookups once instead of per-book in render
  // Re-read reviews/shelves when books change or after modal/shelf edits
  const [reviewVersion, setReviewVersion] = useState(0)
  const reviewMap = useMemo(() => {
    const map: Record<string, ReturnType<typeof getBookReviews>[number]> = {}
    getBookReviews().forEach(r => { map[r.bookId] = r })
    return map
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [likedBooks, reviewVersion])

  const shelfMap = useMemo(() => {
    const map: Record<string, string[]> = {}
    getShelfAssignments().forEach(a => {
      if (!map[a.bookId]) map[a.bookId] = []
      map[a.bookId].push(a.shelfId)
    })
    return map
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [likedBooks, reviewVersion])

  const handleClearAll = () => {
    setShowClearConfirm(true)
  }

  const confirmClearAll = () => {
    clearLikedBooks()
    setLikedBooks([])
    setShowClearConfirm(false)
    showToast("Library cleared", "info")
  }

  const handleSearchSave = (book: Book) => {
    if (!addLikedBook(book)) {
      showToast("Already in your library", "info")
      return
    }
    setLikedBooks(getLikedBooks())
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
    setReviewVersion(v => v + 1) // refresh reviews/shelves after modal edits
  }

  // Memoize Set of saved book IDs to avoid creating new references every render
  const savedBookIds = useMemo(() => new Set(likedBooks.map(b => b.id)), [likedBooks])

  const shelfBookIds = useMemo(() => shelfFilter ? new Set(getBooksForShelf(shelfFilter)) : null, [shelfFilter])
  const MOOD_KEYWORDS: Record<string, string[]> = {
    "Adventurous": ["adventurous", "epic", "thrilling", "immersive", "exciting"],
    "Cozy": ["cozy", "heartwarming", "feel-good", "light-hearted", "warm", "comforting"],
    "Intellectual": ["thought-provoking", "philosophical", "complex", "contemplative", "reflective", "smart"],
    "Romantic": ["romantic", "emotional", "love", "passionate", "sensual"],
    "Thrilling": ["suspenseful", "gripping", "twisty", "tense", "dark", "thrilling"],
    "Relaxing": ["relaxing", "gentle", "peaceful", "simple", "calming", "uplifting", "spiritual"],
    "Inspiring": ["inspiring", "motivational", "empowering", "powerful", "eye-opening", "honest"],
    "Dark": ["dark", "atmospheric", "melancholic", "tragic", "haunting", "gothic"],
  }

  const filteredBooks = useMemo(() => likedBooks.filter(book => {
    if (!showHidden && hiddenIds.has(book.id)) return false
    if (showHidden && !hiddenIds.has(book.id)) return false
    if (shelfBookIds && !shelfBookIds.has(book.id)) return false
    if (formatFilter === "ebook" && !book.formats?.ebook) return false
    if (formatFilter === "audio" && !book.formats?.audiobook) return false
    if (authorFilter && book.author !== authorFilter) return false
    if (moodFilter) {
      const keywords = MOOD_KEYWORDS[moodFilter] || []
      const bookMoods = book.mood.map(m => m.toLowerCase())
      const hasMatch = keywords.some(kw => bookMoods.some(bm => bm.includes(kw)))
      if (!hasMatch) return false
    }
    if (filter === "all") return true
    return book.genre.some(genre =>
      genre.toLowerCase().includes(filter.toLowerCase())
    )
  }), [likedBooks, shelfBookIds, formatFilter, filter, hiddenIds, showHidden, authorFilter, moodFilter])

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

  // Reset visible count when filters/sort change so user sees first page
  useEffect(() => {
    setVisibleCount(BOOKS_PER_PAGE)
  }, [filter, sortBy, shelfFilter, formatFilter, authorFilter, moodFilter, showHidden])

  // Slice the visible portion for rendering
  const visibleBooks = sortedBooks.slice(0, visibleCount)
  const hasMore = visibleCount < sortedBooks.length

  // Sentinel callback ref: sets up IntersectionObserver when the sentinel div mounts
  const sentinelCallback = useCallback((node: HTMLDivElement | null) => {
    if (observerRef.current) {
      observerRef.current.disconnect()
      observerRef.current = null
    }
    if (node) {
      observerRef.current = new IntersectionObserver(
        (entries) => {
          if (entries[0]?.isIntersecting) {
            setVisibleCount(prev => prev + BOOKS_PER_PAGE)
          }
        },
        { rootMargin: "200px" }
      )
      observerRef.current.observe(node)
    }
    sentinelRef.current = node
  }, [])

  // Cleanup observer on unmount
  useEffect(() => {
    return () => {
      if (observerRef.current) {
        observerRef.current.disconnect()
      }
    }
  }, [])

  const genres = useMemo(() => Array.from(new Set(likedBooks.flatMap(book => book.genre))), [likedBooks])

  const stats = {
    totalBooks: likedBooks.length,
    totalPages: likedBooks.reduce((sum, book) => sum + (book.pages || 0), 0),
    averageRating: likedBooks.length > 0
      ? (likedBooks.filter(b => b.rating).reduce((sum, book) => sum + (book.rating || 0), 0) / (likedBooks.filter(b => b.rating).length || 1)).toFixed(1)
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
    { value: "pages", label: "Pages ↑" },
  ]

  const hasActiveFilters = shelfFilter !== null || filter !== "all" || formatFilter !== "all" || authorFilter !== null || moodFilter !== null

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
    <div className="bg-background smooth-scroll pb-20" style={{ minHeight: "100dvh" }}>
      {/* Header */}
      <div className="bg-background/90 backdrop-blur-md border-b border-stone-200/60 dark:border-stone-700/60 sticky top-0 z-10">
        <div className="max-w-6xl mx-auto px-4 sm:px-6 py-3 sm:py-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3 min-w-0">
              {showBackButton && onBack && (
                <button
                  onClick={onBack}
                  aria-label="Go back"
                  className="p-2 -ml-2 rounded-lg hover:bg-stone-100 dark:hover:bg-stone-800 transition-colors tap-target touch-manipulation"
                >
                  <ArrowLeft className="w-5 h-5 text-stone-600 dark:text-stone-300" />
                </button>
              )}
              <div className="min-w-0">
                <h1 className="text-xl sm:text-2xl font-bold text-stone-900 dark:text-stone-100 tracking-tight font-serif">
                  My Library
                </h1>
              </div>
            </div>
            <div className="flex items-center gap-1 sm:gap-2">
              <button
                onClick={() => setShowSearch(true)}
                aria-label="Search books"
                className="flex items-center justify-center p-2 rounded-lg hover:bg-stone-100 dark:hover:bg-stone-800 transition-colors tap-target touch-manipulation"
              >
                <Search className="w-5 h-5 text-stone-500 dark:text-stone-400" />
              </button>
              {onScan && (
                <button
                  onClick={onScan}
                  aria-label="Scan a book barcode"
                  className="flex items-center justify-center p-2 rounded-lg hover:bg-stone-100 dark:hover:bg-stone-800 transition-colors tap-target touch-manipulation"
                >
                  <Camera className="w-5 h-5 text-amber-600 dark:text-amber-500" />
                </button>
              )}
              <button
                onClick={() => setShowChallenges(true)}
                aria-label="Reading challenges"
                className="flex items-center gap-1.5 px-3 py-1.5 rounded-full bg-stone-100 dark:bg-stone-800 hover:bg-stone-200 dark:hover:bg-stone-700 text-stone-600 dark:text-stone-300 text-sm font-medium transition-colors tap-target touch-manipulation"
              >
                <Target className="w-4 h-4" />
                <span className="hidden sm:inline">Challenges</span>
              </button>
              <button
                onClick={showAchievementsPanel}
                aria-label="Achievements"
                className="flex items-center gap-1.5 px-3 py-1.5 rounded-full bg-amber-50 dark:bg-amber-900/30 hover:bg-amber-100 dark:hover:bg-amber-900/50 text-amber-700 dark:text-amber-400 text-sm font-medium transition-colors tap-target touch-manipulation"
              >
                <Trophy className="w-4 h-4" />
                <span className="hidden sm:inline">Lv.{userStats.level}</span>
                <span className="sm:hidden">{userStats.level}</span>
              </button>
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
            <h2 className="text-2xl sm:text-3xl font-bold text-stone-900 dark:text-stone-100 mb-3 font-serif">
              Your shelf is waiting
            </h2>
            <p className="text-stone-500 dark:text-stone-400 mb-8 max-w-md mx-auto text-base sm:text-lg leading-relaxed">
              Start swiping to discover books you&apos;ll love.
              We&apos;ll learn your taste and suggest better matches over time.
            </p>
            <Button
              onClick={onStartDiscovery}
              className="h-12 px-8 text-base bg-stone-900 dark:bg-stone-100 hover:bg-stone-800 dark:hover:bg-stone-200 text-white dark:text-stone-900 font-medium rounded-xl transition-all shadow-sm hover:shadow-md tap-target touch-manipulation"
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
                className="flex items-center gap-3 px-4 py-3 bg-amber-50 dark:bg-amber-900/30 border border-amber-200/60 dark:border-amber-700/60 rounded-xl"
              >
                <Download className="w-4 h-4 text-amber-600 flex-shrink-0" />
                <p className="text-xs text-amber-800 dark:text-amber-300 flex-1">
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

            {/* ━━━ Continue Reading Card ━━━ */}
            {currentlyReading.length > 0 && (() => {
              const primary = currentlyReading[0]
              const pct = primary.totalPages > 0
                ? Math.round((primary.currentPage / primary.totalPages) * 100)
                : 0
              const timeLabel = primary.timeSpentMinutes >= 60
                ? `${Math.floor(primary.timeSpentMinutes / 60)}h ${primary.timeSpentMinutes % 60}m`
                : `${primary.timeSpentMinutes}m`
              const othersCount = currentlyReading.length - 1
              return (
                <motion.div
                  initial={{ opacity: 0, y: 8 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ type: "spring", stiffness: 300, damping: 28 }}
                >
                  <button
                    onClick={() => handleBookClick(primary.book)}
                    className="w-full text-left rounded-2xl border border-stone-200/70 dark:border-stone-700/60 bg-stone-50/80 dark:bg-stone-800/50 p-4 transition-all hover:border-amber-300/60 dark:hover:border-amber-600/40 hover:shadow-sm group focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-amber-500 focus-visible:ring-offset-2"
                  >
                    <div className="flex gap-4">
                      {/* Book cover */}
                      <div className="relative w-16 h-24 sm:w-20 sm:h-[120px] flex-shrink-0 rounded-lg overflow-hidden bg-stone-100 dark:bg-stone-700 ring-1 ring-stone-200/50 dark:ring-stone-600/50 shadow-sm">
                        <BookCover
                          src={primary.book.cover}
                          fallbackSrc={primary.book.coverFallback}
                          alt={primary.book.title}
                          fill
                          className="object-cover"
                          sizes="80px"
                        />
                      </div>

                      {/* Content */}
                      <div className="flex-1 min-w-0 flex flex-col justify-between py-0.5">
                        <div>
                          <p className="text-[11px] font-semibold uppercase tracking-wider text-amber-600 dark:text-amber-500 mb-1">
                            Continue Reading
                          </p>
                          <h3 className="text-sm sm:text-base font-bold text-stone-900 dark:text-stone-100 leading-tight line-clamp-1 group-hover:text-amber-800 dark:group-hover:text-amber-400 transition-colors">
                            {primary.book.title}
                          </h3>
                          <p className="text-xs text-stone-500 dark:text-stone-400 mt-0.5 truncate">
                            {primary.book.author}
                          </p>
                        </div>

                        {/* Progress bar */}
                        <div className="mt-2.5 space-y-1.5">
                          <div className="h-1.5 w-full bg-stone-200 dark:bg-stone-700 rounded-full overflow-hidden">
                            <motion.div
                              className="h-full bg-amber-500 rounded-full"
                              initial={{ width: 0 }}
                              animate={{ width: `${pct}%` }}
                              transition={{ duration: 0.6, ease: "easeOut", delay: 0.2 }}
                            />
                          </div>
                          <div className="flex items-center justify-between text-[11px] text-stone-500 dark:text-stone-400">
                            <span>
                              Page {primary.currentPage} of {primary.totalPages}
                              <span className="mx-1.5 text-stone-300 dark:text-stone-600">|</span>
                              {pct}%
                            </span>
                            <span className="flex items-center gap-1">
                              <Clock className="w-3 h-3" />
                              {timeLabel} read
                              {primary.currentPage > 0 && primary.timeSpentMinutes > 0 && primary.totalPages > primary.currentPage && (() => {
                                const pagesPerMinute = primary.currentPage / primary.timeSpentMinutes
                                const pagesLeft = primary.totalPages - primary.currentPage
                                const minutesLeft = Math.round(pagesLeft / pagesPerMinute)
                                if (!Number.isFinite(minutesLeft) || minutesLeft <= 0) return null
                                const hoursLeft = Math.round(minutesLeft / 60)
                                const startedMs = new Date(primary.startedDate).getTime()
                                const daysElapsed = Number.isFinite(startedMs)
                                  ? Math.max(1, Math.ceil((Date.now() - startedMs) / 86400000))
                                  : 1
                                const minutesPerDay = primary.timeSpentMinutes / daysElapsed
                                const daysLeft = minutesPerDay > 0 ? Math.ceil(minutesLeft / minutesPerDay) : 0
                                const estimate = hoursLeft < 2
                                  ? `~${minutesLeft}m left`
                                  : hoursLeft < 24
                                    ? `~${hoursLeft}h left`
                                    : daysLeft > 0
                                      ? `~${daysLeft} day${daysLeft !== 1 ? "s" : ""} left`
                                      : `~${hoursLeft}h left`
                                return (
                                  <span className="text-amber-600 dark:text-amber-500 font-medium ml-1.5">· {estimate}</span>
                                )
                              })()}
                            </span>
                          </div>
                        </div>
                      </div>

                      {/* Arrow */}
                      <div className="flex items-center flex-shrink-0 self-center">
                        <div className="w-8 h-8 rounded-full bg-stone-900 dark:bg-stone-100 flex items-center justify-center group-hover:bg-amber-600 dark:group-hover:bg-amber-500 transition-colors shadow-sm">
                          <ChevronRight className="w-4 h-4 text-white dark:text-stone-900" />
                        </div>
                      </div>
                    </div>
                  </button>

                  {/* "Reading X more" indicator */}
                  {othersCount > 0 && (
                    <div className="mt-2">
                      <button
                        onClick={(e) => {
                          e.stopPropagation()
                          setShowAllReading(!showAllReading)
                        }}
                        className="text-xs font-medium text-stone-500 dark:text-stone-400 hover:text-amber-600 dark:hover:text-amber-500 transition-colors px-1"
                      >
                        {showAllReading ? "Show less" : `Reading ${othersCount} more...`}
                      </button>
                      <AnimatePresence>
                        {showAllReading && (
                          <motion.div
                            initial={{ opacity: 0, height: 0 }}
                            animate={{ opacity: 1, height: "auto" }}
                            exit={{ opacity: 0, height: 0 }}
                            transition={{ duration: 0.2 }}
                            className="overflow-hidden"
                          >
                            <div className="flex flex-col gap-2 mt-2">
                              {currentlyReading.slice(1).map((prog) => {
                                const p = prog.totalPages > 0
                                  ? Math.round((prog.currentPage / prog.totalPages) * 100)
                                  : 0
                                return (
                                  <button
                                    key={prog.bookId}
                                    onClick={() => handleBookClick(prog.book)}
                                    className="flex items-center gap-3 rounded-xl border border-stone-200/50 dark:border-stone-700/40 bg-stone-50/60 dark:bg-stone-800/30 px-3 py-2.5 text-left hover:border-amber-300/60 dark:hover:border-amber-600/40 transition-all group/sub focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-amber-500"
                                  >
                                    <div className="relative w-8 h-12 flex-shrink-0 rounded overflow-hidden bg-stone-100 dark:bg-stone-700">
                                      <BookCover
                                        src={prog.book.cover}
                                        fallbackSrc={prog.book.coverFallback}
                                        alt={prog.book.title}
                                        fill
                                        className="object-cover"
                                        sizes="32px"
                                      />
                                    </div>
                                    <div className="flex-1 min-w-0">
                                      <p className="text-xs font-semibold text-stone-800 dark:text-stone-200 truncate group-hover/sub:text-amber-800 dark:group-hover/sub:text-amber-400 transition-colors">
                                        {prog.book.title}
                                      </p>
                                      <div className="flex items-center gap-2 mt-1">
                                        <div className="h-1 flex-1 bg-stone-200 dark:bg-stone-700 rounded-full overflow-hidden">
                                          <div
                                            className="h-full bg-amber-500 rounded-full"
                                            style={{ width: `${p}%` }}
                                          />
                                        </div>
                                        <span className="text-[10px] text-stone-400 dark:text-stone-500 flex-shrink-0 tabular-nums">
                                          {p}%
                                        </span>
                                      </div>
                                    </div>
                                  </button>
                                )
                              })}
                            </div>
                          </motion.div>
                        )}
                      </AnimatePresence>
                    </div>
                  )}
                </motion.div>
              )
            })()}

            {/* ━━━ Desktop 2-col: Greeting/Daily Pick + Streaks/Mood ━━━ */}
            <div className="grid grid-cols-1 gap-10 lg:grid-cols-2 lg:gap-6 lg:items-start">

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
                    <h2 className="text-2xl sm:text-3xl font-bold text-stone-900 dark:text-stone-100 font-serif leading-tight">
                      {getGreeting()},<br className="sm:hidden" /> reader.
                    </h2>
                    <div className="flex items-center gap-2 mt-1.5 text-stone-500 dark:text-stone-400 text-sm">
                      <span className="flex items-center gap-1">
                        <BookOpen className="w-3.5 h-3.5 text-stone-400" />
                        {stats.totalBooks} books
                      </span>
                      {stats.totalPages > 0 && (
                        <>
                          <span className="w-0.5 h-0.5 rounded-full bg-stone-300 hidden sm:block" />
                          <span className="hidden sm:inline">{stats.totalPages.toLocaleString()} pages</span>
                        </>
                      )}
                      {Number(stats.averageRating) > 0 && (
                        <>
                          <span className="w-0.5 h-0.5 rounded-full bg-stone-300" />
                          <span className="flex items-center gap-0.5">
                            <Star className="w-3 h-3 text-amber-500 fill-amber-500" />
                            {stats.averageRating}
                          </span>
                        </>
                      )}
                      {(() => {
                        const todayMin = getReadingTimeToday()
                        if (todayMin > 0) return (
                          <>
                            <span className="w-0.5 h-0.5 rounded-full bg-stone-300" />
                            <span className="flex items-center gap-0.5">
                              <Clock className="w-3 h-3 text-stone-400" />
                              {todayMin >= 60 ? `${Math.floor(todayMin / 60)}h ${todayMin % 60}m` : `${todayMin}m`} today
                            </span>
                          </>
                        )
                        return null
                      })()}
                      {userStats.currentStreak > 0 && (
                        <>
                          <span className="w-0.5 h-0.5 rounded-full bg-stone-300" />
                          <span className="text-amber-600 dark:text-amber-400 font-medium">{userStats.currentStreak}d streak</span>
                        </>
                      )}
                    </div>
                  </div>
                </div>
                <Button
                  onClick={onStartDiscovery}
                  className="h-10 px-3 sm:px-5 text-sm bg-stone-900 dark:bg-stone-100 hover:bg-stone-800 dark:hover:bg-stone-200 text-white dark:text-stone-900 font-medium rounded-xl transition-all shadow-sm flex-shrink-0 tap-target touch-manipulation"
                >
                  <Sparkles className="w-4 h-4 sm:mr-2" />
                  <span className="hidden sm:inline">Discover</span>
                </Button>
              </div>

              {/* Reading Wrapped banner */}
              {likedBooks.length >= 5 && (
                <motion.button
                  onClick={() => setShowWrapped(true)}
                  initial={{ opacity: 0, y: 6 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: 0.2, type: "spring", stiffness: 280, damping: 26 }}
                  whileTap={{ scale: 0.98 }}
                  className="w-full flex items-center justify-between gap-3 px-4 py-3 rounded-xl bg-gradient-to-r from-stone-900 to-stone-800 text-white text-left hover:from-stone-800 hover:to-stone-700 transition-all shadow-sm mb-4"
                >
                  <div className="flex items-center gap-3">
                    <Sparkles className="w-4 h-4 text-amber-400 flex-shrink-0" />
                    <div>
                      <p className="text-sm font-semibold leading-tight">Your {new Date().getFullYear()} Reading Wrapped</p>
                      <p className="text-[11px] text-stone-400 mt-0.5">{likedBooks.length} books · tap to see your year</p>
                    </div>
                  </div>
                  <div className="w-6 h-6 rounded-full bg-amber-500/20 flex items-center justify-center flex-shrink-0">
                    <Star className="w-3 h-3 text-amber-400 fill-amber-400" />
                  </div>
                </motion.button>
              )}

              {/* Daily Pick — inline within the greeting zone */}
              {likedBooks.length >= 3 && (
                <DailyPickCard
                  onBookClick={handleBookClick}
                  onBookLiked={(book) => {
                    addLikedBook(book)
                    setLikedBooks(getLikedBooks())
                    showToast(`"${book.title}" saved to library`)
                  }}
                />
              )}
            </motion.div>

            {/* ━━━ Reading Streaks Calendar + Mood Browse ━━━ */}
            <motion.div {...fadeInUp(0.02)} className="space-y-4">
              {/* Calendar Heatmap */}
              {(() => {
                const now = new Date()
                const year = now.getFullYear()
                const month = now.getMonth()
                const monthName = now.toLocaleString("default", { month: "long" })
                const daysInMonth = new Date(year, month + 1, 0).getDate()
                const firstDayOfWeek = new Date(year, month, 1).getDay()

                const activityCounts: Record<string, number> = {}
                const countDay = (dateStr: string | undefined) => {
                  if (!dateStr) return
                  const d = new Date(dateStr)
                  if (d.getFullYear() === year && d.getMonth() === month) {
                    const key = d.getDate().toString()
                    activityCounts[key] = (activityCounts[key] || 0) + 1
                  }
                }

                getReadingProgress()
                  .filter(p => p.status !== "dnf")
                  .forEach(p => countDay(p.lastReadDate))
                getBookReviews().forEach(r => countDay(r.updatedAt || r.createdAt))
                getBookNotes().forEach(n => countDay(n.createdAt))

                const todayDate = now.getDate()
                let streak = 0
                for (let d = todayDate; d >= 1; d--) {
                  if (activityCounts[d.toString()]) {
                    streak++
                  } else {
                    break
                  }
                }

                const weeks: (number | null)[][] = []
                let currentWeek: (number | null)[] = []
                const startOffset = firstDayOfWeek === 0 ? 6 : firstDayOfWeek - 1
                for (let i = 0; i < startOffset; i++) currentWeek.push(null)
                for (let day = 1; day <= daysInMonth; day++) {
                  currentWeek.push(day)
                  if (currentWeek.length === 7) {
                    weeks.push(currentWeek)
                    currentWeek = []
                  }
                }
                if (currentWeek.length > 0) {
                  while (currentWeek.length < 7) currentWeek.push(null)
                  weeks.push(currentWeek)
                }

                const dayLabels = ["M", "T", "W", "T", "F", "S", "S"]

                const getCellColor = (count: number) => {
                  if (count === 0) return "bg-stone-100 dark:bg-stone-800"
                  if (count === 1) return "bg-amber-200 dark:bg-amber-800/60"
                  if (count === 2) return "bg-amber-400 dark:bg-amber-600/80"
                  return "bg-amber-600 dark:bg-amber-500"
                }

                return (
                  <div className="rounded-xl border border-stone-200/70 dark:border-stone-700/60 bg-stone-50/80 dark:bg-stone-800/40 p-4">
                    <div className="flex items-center justify-between mb-3">
                      <div>
                        <p className="text-xs font-semibold uppercase tracking-wider text-stone-500 dark:text-stone-400">
                          {monthName} {year}
                        </p>
                      </div>
                      {streak > 0 && (
                        <div className="flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-amber-50 dark:bg-amber-900/30">
                          <Flame className="w-3.5 h-3.5 text-amber-500" />
                          <span className="text-xs font-bold text-amber-700 dark:text-amber-400">{streak} day streak</span>
                        </div>
                      )}
                    </div>

                    <div className="flex gap-1">
                      <div className="flex flex-col gap-1 mr-1.5 pt-0">
                        {dayLabels.map((label, i) => (
                          <div
                            key={i}
                            className="h-3 flex items-center"
                            style={{ fontSize: "9px", lineHeight: "12px" }}
                          >
                            <span className={`text-stone-400 dark:text-stone-500 font-medium ${i % 2 === 0 ? "opacity-100" : "opacity-0"}`}>
                              {label}
                            </span>
                          </div>
                        ))}
                      </div>

                      <div className="flex gap-1 flex-1">
                        {weeks.map((week, wi) => (
                          <div key={wi} className="flex flex-col gap-1 flex-1">
                            {week.map((day, di) => {
                              const count = day ? (activityCounts[day.toString()] || 0) : 0
                              const isToday = day === todayDate
                              return (
                                <div
                                  key={day !== null ? `${year}-${month}-${day}` : `pad-${wi}-${di}`}
                                  className={`h-3 w-full rounded-sm transition-colors ${
                                    day === null
                                      ? "bg-transparent"
                                      : getCellColor(count)
                                  } ${isToday ? "ring-1 ring-stone-400 dark:ring-stone-500" : ""}`}
                                  title={day ? `${monthName} ${day}: ${count} ${count === 1 ? "activity" : "activities"}` : ""}
                                />
                              )
                            })}
                          </div>
                        ))}
                      </div>
                    </div>

                    <div className="flex items-center gap-1.5 mt-2.5 justify-end">
                      <span className="text-[9px] text-stone-400 dark:text-stone-500">Less</span>
                      <div className="h-2.5 w-2.5 rounded-sm bg-stone-100 dark:bg-stone-800" />
                      <div className="h-2.5 w-2.5 rounded-sm bg-amber-200 dark:bg-amber-800/60" />
                      <div className="h-2.5 w-2.5 rounded-sm bg-amber-400 dark:bg-amber-600/80" />
                      <div className="h-2.5 w-2.5 rounded-sm bg-amber-600 dark:bg-amber-500" />
                      <span className="text-[9px] text-stone-400 dark:text-stone-500">More</span>
                    </div>
                  </div>
                )
              })()}

              {/* Mood-Based Quick Browse */}
              <div className="flex items-center gap-2 overflow-x-auto hide-scrollbar pb-0.5 lg:flex-wrap">
                {([
                  { mood: "Adventurous", bg: "bg-amber-50 dark:bg-amber-900/20", text: "text-amber-700 dark:text-amber-400", activeBg: "bg-amber-600", activeText: "text-white" },
                  { mood: "Cozy", bg: "bg-orange-50 dark:bg-orange-900/20", text: "text-orange-700 dark:text-orange-400", activeBg: "bg-orange-600", activeText: "text-white" },
                  { mood: "Intellectual", bg: "bg-blue-50 dark:bg-blue-900/20", text: "text-blue-700 dark:text-blue-400", activeBg: "bg-blue-600", activeText: "text-white" },
                  { mood: "Romantic", bg: "bg-rose-50 dark:bg-rose-900/20", text: "text-rose-700 dark:text-rose-400", activeBg: "bg-rose-600", activeText: "text-white" },
                  { mood: "Thrilling", bg: "bg-red-50 dark:bg-red-900/20", text: "text-red-700 dark:text-red-400", activeBg: "bg-red-600", activeText: "text-white" },
                  { mood: "Relaxing", bg: "bg-emerald-50 dark:bg-emerald-900/20", text: "text-emerald-700 dark:text-emerald-400", activeBg: "bg-emerald-600", activeText: "text-white" },
                  { mood: "Inspiring", bg: "bg-violet-50 dark:bg-violet-900/20", text: "text-violet-700 dark:text-violet-400", activeBg: "bg-violet-600", activeText: "text-white" },
                  { mood: "Dark", bg: "bg-stone-100 dark:bg-stone-700/40", text: "text-stone-700 dark:text-stone-300", activeBg: "bg-stone-800 dark:bg-stone-200", activeText: "text-white dark:text-stone-900" },
                ] as const).map((item) => {
                  const isActive = moodFilter === item.mood
                  return (
                    <button
                      key={item.mood}
                      onClick={() => setMoodFilter(isActive ? null : item.mood)}
                      className={`flex-shrink-0 rounded-full py-1 px-3 text-xs font-medium transition-all ${
                        isActive
                          ? `${item.activeBg} ${item.activeText}`
                          : `${item.bg} ${item.text} hover:opacity-80`
                      }`}
                    >
                      {item.mood}
                    </button>
                  )
                })}
                {moodFilter && (
                  <button
                    onClick={() => setMoodFilter(null)}
                    className="flex-shrink-0 rounded-full py-1 px-2.5 text-xs font-medium text-stone-400 hover:text-stone-600 dark:hover:text-stone-300 transition-colors flex items-center gap-1"
                  >
                    <XIcon className="w-3 h-3" />
                    Clear
                  </button>
                )}
              </div>
            </motion.div>

            </div>{/* end desktop 2-col grid */}

            {/* ━━━ What to Read Next ━━━ */}
            <SmartNextRead
              onBookClick={handleBookClick}
              onStartReading={(book) => {
                handleStartReading(book)
                setCurrentlyReading(
                  getReadingProgress()
                    .filter(p => p.status === "reading")
                    .sort((a, b) => new Date(b.lastReadDate).getTime() - new Date(a.lastReadDate).getTime())
                )
              }}
            />

            {/* ━━━ Desktop 2-col: Goal + Progress ━━━ */}
            <div className="grid grid-cols-1 gap-10 lg:grid-cols-2 lg:gap-6 lg:items-start">
              {/* ━━━ Reading Goal Setter (shown once until user sets a goal) ━━━ */}
              <ReadingGoalSetter />

              {/* ━━━ SECTION 2: Reading Progress (currently reading up front) ━━━ */}
              <motion.div {...fadeInUp(0.05)}>
                <ReadingProgressTracker onStartReading={onStartDiscovery} />
              </motion.div>
            </div>

            {/* ━━━ SECTION 3: Your Library (the core — moved UP) ━━━ */}
            <motion.div {...fadeInUp(0.08)} className="space-y-4">
              {/* Section header + filter toggle */}
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <BookOpen className="w-5 h-5 text-amber-600 hidden sm:block" />
                  <h2 className="text-lg font-semibold text-stone-900 dark:text-stone-100 font-serif">
                    Your Books
                  </h2>
                  <span className="text-xs text-stone-400 dark:text-stone-500 bg-stone-100 dark:bg-stone-800 px-2 py-0.5 rounded-full">
                    {sortedBooks.length !== likedBooks.length
                      ? `${sortedBooks.length} / ${likedBooks.length}`
                      : likedBooks.length}
                  </span>
                  {authorFilter && (
                    <button
                      onClick={() => setAuthorFilter(null)}
                      className="flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-medium bg-amber-100 dark:bg-amber-900/40 text-amber-800 dark:text-amber-400 hover:bg-amber-200 dark:hover:bg-amber-900/60 transition-colors"
                    >
                      by {authorFilter}
                      <XIcon className="w-3 h-3" />
                    </button>
                  )}
                </div>
                <button
                  onClick={() => setShowFilters(!showFilters)}
                  className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium transition-all tap-target touch-manipulation ${
                    showFilters || hasActiveFilters
                      ? "bg-amber-50 dark:bg-amber-900/30 text-amber-700 dark:text-amber-400"
                      : "text-stone-400 hover:text-stone-600 dark:hover:text-stone-300 hover:bg-stone-50 dark:hover:bg-stone-800/50"
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
                      ? "bg-stone-900 dark:bg-stone-100 text-white dark:text-stone-900"
                      : "bg-stone-100 dark:bg-stone-800 text-stone-600 dark:text-stone-300 hover:bg-stone-200 dark:hover:bg-stone-700"
                  }`}
                >
                  All
                </button>
                {shelves.map(shelf => {
                  const count = getBooksForShelf(shelf.id).length
                  return (
                    <button
                      key={shelf.id}
                      onClick={() => setShelfFilter(shelfFilter === shelf.id ? null : shelf.id)}
                      className={`flex-shrink-0 px-3 py-1.5 rounded-full text-xs font-medium transition-all ${
                        shelfFilter === shelf.id
                          ? "bg-stone-900 dark:bg-stone-100 text-white dark:text-stone-900"
                          : "bg-stone-100 dark:bg-stone-800 text-stone-600 dark:text-stone-300 hover:bg-stone-200 dark:hover:bg-stone-700"
                      }`}
                    >
                      {shelf.emoji} {shelf.name}
                      {count > 0 && (
                        <span className={`ml-1 ${shelfFilter === shelf.id ? "text-stone-400" : "text-stone-400"}`}>
                          {count}
                        </span>
                      )}
                    </button>
                  )
                })}
                {genres.slice(0, 6).map(genre => (
                  <button
                    key={genre}
                    onClick={() => setFilter(filter === genre ? "all" : genre)}
                    className={`flex-shrink-0 px-3 py-1.5 rounded-full text-xs font-medium transition-all ${
                      filter === genre
                        ? "bg-amber-600 text-white"
                        : "bg-amber-50 dark:bg-amber-900/30 text-amber-700 dark:text-amber-400 hover:bg-amber-100 dark:hover:bg-amber-900/50"
                    }`}
                  >
                    {genre}
                  </button>
                ))}
                <button
                  onClick={() => setShowShelfManager(true)}
                  aria-label="Manage shelves"
                  className="flex-shrink-0 px-2.5 py-1.5 rounded-full text-xs font-medium text-stone-400 hover:text-stone-600 dark:hover:text-stone-300 hover:bg-stone-100 dark:hover:bg-stone-800 transition-all flex items-center gap-1"
                >
                  <Library className="w-3 h-3" />
                  Manage
                </button>
                <button
                  onClick={() => setShowCollections(true)}
                  aria-label="Open collections"
                  className="flex-shrink-0 px-2.5 py-1.5 rounded-full text-xs font-medium text-stone-400 hover:text-stone-600 dark:hover:text-stone-300 hover:bg-stone-100 dark:hover:bg-stone-800 transition-all flex items-center gap-1"
                >
                  <FolderOpen className="w-3 h-3" />
                  Collections
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
                                ? "bg-stone-900 dark:bg-stone-100 text-white dark:text-stone-900"
                                : "bg-stone-100 dark:bg-stone-800 text-stone-500 dark:text-stone-400 hover:bg-stone-200 dark:hover:bg-stone-700"
                            }`}
                          >
                            {opt.label}
                          </button>
                        ))}
                      </div>

                      <span className="w-px h-4 bg-stone-200 dark:bg-stone-700" />

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
                                ? "bg-stone-900 dark:bg-stone-100 text-white dark:text-stone-900"
                                : "bg-stone-100 dark:bg-stone-800 text-stone-500 dark:text-stone-400 hover:bg-stone-200 dark:hover:bg-stone-700"
                            }`}
                          >
                            {f.label}
                          </button>
                        ))}
                      </div>

                      <span className="w-px h-4 bg-stone-200 dark:bg-stone-700" />

                      <button
                        onClick={() => setShowHidden(!showHidden)}
                        className={`px-3 py-1.5 rounded-full text-xs font-medium transition-all flex items-center gap-1 ${
                          showHidden
                            ? "bg-stone-900 text-white"
                            : "bg-stone-100 text-stone-500 hover:bg-stone-200"
                        }`}
                      >
                        {showHidden ? `Hidden (${hiddenIds.size})` : `Hidden${hiddenIds.size > 0 ? ` (${hiddenIds.size})` : ''}`}
                      </button>

                      <span className="w-px h-4 bg-stone-200 dark:bg-stone-700" />

                      <button
                        onClick={handleClearAll}
                        className="px-3 py-1.5 rounded-full text-xs font-medium text-red-400 hover:bg-red-50 dark:hover:bg-red-900/30 hover:text-red-600 transition-all flex items-center gap-1"
                      >
                        <Trash2 className="w-3 h-3" />
                        Clear all
                      </button>

                      <span className="w-px h-4 bg-stone-200 dark:bg-stone-700" />

                      <span className="text-[11px] text-stone-400 dark:text-stone-500">Speed:</span>
                      <select
                        value={readingSpd}
                        aria-label="Reading speed"
                        onChange={(e) => {
                          const speed = e.target.value as ReadingSpeed
                          setReadingSpd(speed)
                          setReadingSpeed(speed)
                        }}
                        className="text-[11px] text-stone-500 dark:text-stone-400 bg-transparent border-none cursor-pointer hover:text-stone-700 dark:hover:text-stone-300"
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
                  <p className="text-sm text-stone-500 dark:text-stone-400">No books match these filters</p>
                  <button
                    onClick={() => { setFilter("all"); setShelfFilter(null); setFormatFilter("all"); setAuthorFilter(null); setMoodFilter(null); setShowHidden(false) }}
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
              >
                <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 2xl:grid-cols-6 gap-3 sm:gap-4 lg:gap-5">
                {visibleBooks.map((book, index) => {
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
                      <div className="relative aspect-[2/3] rounded-xl overflow-hidden bg-stone-100 dark:bg-stone-800 mb-2.5 shadow-sm group-hover:shadow-md transition-shadow ring-1 ring-stone-200/50 dark:ring-stone-700/50">
                        <BookCover
                          src={book.cover}
                          fallbackSrc={book.coverFallback}
                          alt={book.title}
                          fill
                          className="object-cover"
                          sizes="(max-width: 640px) 50vw, (max-width: 1024px) 33vw, 20vw"
                        />
                        {/* Rating badge */}
                        <div className="absolute top-2 right-2 bg-white/90 dark:bg-stone-800/90 backdrop-blur-sm px-1.5 py-0.5 rounded-md flex items-center gap-0.5 shadow-sm">
                          <Star className="w-3 h-3 text-amber-500 fill-amber-500" />
                          <span className="text-xs font-semibold text-stone-700 dark:text-stone-300">{book.rating}</span>
                        </div>
                        {/* Favorite heart */}
                        {review?.favorite && (
                          <div className="absolute top-2 left-2">
                            <Heart className="w-4 h-4 text-red-500 fill-red-500 drop-shadow-sm" />
                          </div>
                        )}
                        {/* Shelf badge */}
                        {firstShelf && (
                          <div className="absolute bottom-2 left-2 bg-white/90 dark:bg-stone-800/90 backdrop-blur-sm px-1.5 py-0.5 rounded-md text-[11px] font-medium text-stone-600 dark:text-stone-300 max-w-[calc(100%-16px)] truncate shadow-sm">
                            {firstShelf.emoji} {firstShelf.name}
                          </div>
                        )}
                      </div>

                      {/* Info */}
                      <div className="space-y-0.5 px-0.5">
                        <h3 className="font-semibold text-sm text-stone-900 dark:text-stone-100 line-clamp-2 leading-tight group-hover:text-amber-800 dark:group-hover:text-amber-400 transition-colors">
                          {book.title}
                        </h3>
                        <button
                          onClick={(e) => {
                            e.stopPropagation()
                            setAuthorFilter(authorFilter === book.author ? null : book.author)
                          }}
                          className="text-xs text-stone-500 dark:text-stone-400 truncate hover:text-amber-700 dark:hover:text-amber-400 hover:underline transition-colors text-left w-full"
                        >
                          {book.author}
                        </button>

                        {/* User rating */}
                        {review && (
                          <div className="pt-1">
                            <StarRating rating={review.rating} readonly size="sm" />
                          </div>
                        )}

                        {/* Meta */}
                        <div className="flex items-center gap-2 text-xs text-stone-400 dark:text-stone-500 pt-0.5 flex-wrap">
                          {book.pages ? (
                            <>
                              <span>{book.pages}p</span>
                              <span className="w-0.5 h-0.5 rounded-full bg-stone-300" />
                              <span>{estimateReadingTime(book.pages, readingSpd)}</span>
                            </>
                          ) : (
                            <span>Unknown length</span>
                          )}
                          {book.formats?.ebook && (
                            <span className="px-1 py-px rounded bg-blue-50 dark:bg-blue-900/30 text-blue-500 dark:text-blue-400 text-[9px] font-medium">eBook</span>
                          )}
                        </div>
                      </div>
                    </motion.div>
                  )
                })}

                {/* Inline discover prompt when library is small */}
                {visibleBooks.length < 5 && (
                  <motion.button
                    onClick={onStartDiscovery}
                    initial={{ opacity: 0, y: 8 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ delay: 0.15, type: "spring", stiffness: 300, damping: 28 }}
                    whileHover={{ y: -3, transition: { type: "spring", stiffness: 400, damping: 30 } }}
                    className="group aspect-[2/3] rounded-xl border-2 border-dashed border-stone-200 dark:border-stone-700 hover:border-amber-400 dark:hover:border-amber-600 bg-stone-50/50 dark:bg-stone-800/30 flex flex-col items-center justify-center gap-2 transition-all"
                  >
                    <div className="w-10 h-10 rounded-full bg-amber-100 dark:bg-amber-900/30 flex items-center justify-center group-hover:bg-amber-200 dark:group-hover:bg-amber-800/40 transition-colors">
                      <Sparkles className="w-5 h-5 text-amber-600 dark:text-amber-500" />
                    </div>
                    <span className="text-xs font-semibold text-stone-500 dark:text-stone-400 group-hover:text-amber-700 dark:group-hover:text-amber-400 transition-colors">Discover more</span>
                  </motion.button>
                )}
                </div>

                {/* Scroll sentinel + progress indicator */}
                {sortedBooks.length > BOOKS_PER_PAGE && (
                  <div className="mt-6 flex flex-col items-center gap-3">
                    <p className="text-xs text-stone-400 dark:text-stone-500 tabular-nums">
                      Showing {Math.min(visibleCount, sortedBooks.length)} of {sortedBooks.length} books
                    </p>
                    {hasMore && (
                      <>
                        <div ref={sentinelCallback} className="w-full h-px" aria-hidden="true" />
                        <button
                          onClick={() => setVisibleCount(sortedBooks.length)}
                          className="px-4 py-2 rounded-lg text-xs font-medium text-stone-500 dark:text-stone-400 hover:text-stone-700 dark:hover:text-stone-200 bg-stone-100 dark:bg-stone-800 hover:bg-stone-200 dark:hover:bg-stone-700 transition-colors"
                        >
                          Load all ({sortedBooks.length - visibleCount} remaining)
                        </button>
                      </>
                    )}
                  </div>
                )}
              </motion.div>
              )}
              </AnimatePresence>
            </motion.div>

            {/* ━━━ Quotes Gallery (shown when user has saved quotes) ━━━ */}
            <motion.div {...fadeInUp(0.09)}>
              <QuotesGallery />
            </motion.div>

            {/* ━━━ SECTION 4: Discovery Zone ━━━ */}
            <div className="space-y-8">
              <div className="flex flex-col items-center gap-2 py-2">
                <div className="w-28 h-24 opacity-60">
                  <FloatDoodle />
                </div>
                <div className="flex items-center gap-3 w-full">
                  <div className="h-px flex-1 bg-stone-200/60 dark:bg-stone-700/60" />
                  <span className="text-xs font-semibold text-stone-400 dark:text-stone-500 uppercase tracking-widest">Discover</span>
                  <div className="h-px flex-1 bg-stone-200/60 dark:bg-stone-700/60" />
                </div>
              </div>

              {/* Smart Recommendations */}
              <motion.div {...fadeInUp(0.1)}>
                <SmartRecommendations
                  onBookLike={(book) => {
                    addLikedBook(book)
                    setLikedBooks(getLikedBooks())
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
                    addLikedBook(book)
                    setLikedBooks(getLikedBooks())
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
          if (showHidden) {
            // In hidden view, "remove" means unhide
            unhideBook(book.id)
            setHiddenIds(new Set(getHiddenBookIds()))
            showToast(`"${book.title}" restored to library`)
          } else {
            const updated = removeLikedBook(book.id)
            setLikedBooks(updated)
            showToast(`"${book.title}" removed from library`, "info")
          }
        }}
        onHideBook={showHidden ? undefined : (book) => {
          hideBook(book.id)
          setHiddenIds(new Set(getHiddenBookIds()))
          showToast(`"${book.title}" hidden from library`, "info")
        }}
      />

      {/* Book Search */}
      <BookSearch
        isOpen={showSearch}
        onClose={() => setShowSearch(false)}
        onSaveBook={handleSearchSave}
        onBookClick={handleBookClick}
        savedBookIds={likedBooks.map(b => b.id)}
      />

      {/* Shelf Manager */}
      <ShelfManager
        isOpen={showShelfManager}
        onClose={() => setShowShelfManager(false)}
        onShelvesChanged={() => setShelves(getShelves())}
      />

      {/* Reading Wrapped */}
      <ReadingWrapped isOpen={showWrapped} onClose={() => setShowWrapped(false)} />

      {/* Reading Challenges */}
      <ReadingChallenges isOpen={showChallenges} onClose={() => setShowChallenges(false)} />

      {/* Book Collections */}
      <BookCollections
        isOpen={showCollections}
        onClose={() => setShowCollections(false)}
        onBookClick={handleBookClick}
      />

      {/* Clear Library Confirmation */}
      <ConfirmDialog
        isOpen={showClearConfirm}
        onConfirm={confirmClearAll}
        onCancel={() => setShowClearConfirm(false)}
        title="Clear entire library?"
        message="All your liked books will be permanently removed. This action cannot be undone."
        confirmLabel="Clear All"
        variant="danger"
      />
    </div>
  )
}
