"use client"

import { useState, useEffect, useMemo, useRef, useCallback } from "react"
import dynamic from "next/dynamic"
import { Book } from "@/lib/book-data"
import { getLikedBooks, clearLikedBooks, addBookToReading, getReadingProgress, addLikedBook, removeLikedBook, getBookReviews, getBookNotes, getShelfAssignments, getReadingTimeToday } from "@/lib/storage"
import { Button } from "@/components/ui/button"
import { ReadingProgressTracker } from "./reading-progress"
import { DashboardHeader } from "./dashboard-header"
import { DashboardEmpty } from "./dashboard-empty"
import { ActivityHeatmap } from "./activity-heatmap"
import { StarRating } from "./star-rating"
import { getUserStats } from "@/lib/storage"
import { useGamification } from "./gamification-provider"
import { BookOpen, Star, Clock, Trash2, Settings, Sparkles, Heart, Search, Library, SlidersHorizontal, Download, X as XIcon, FolderOpen, ChevronRight } from "lucide-react"
// Doodles are decorative and below the fold — dynamic() keeps them out of the
// hydration payload (they were 104KB gzip, 24.5% of the entire cold download).
const ReadingSideDoodle = dynamic(() => import("./illustrations").then(m => ({ default: m.ReadingSideDoodle })))
const ReadingDoodle = dynamic(() => import("./illustrations").then(m => ({ default: m.ReadingDoodle })))
const FloatDoodle = dynamic(() => import("./illustrations").then(m => ({ default: m.FloatDoodle })))
const GroovyDoodle = dynamic(() => import("./illustrations").then(m => ({ default: m.GroovyDoodle })))
const LovingDoodle = dynamic(() => import("./illustrations").then(m => ({ default: m.LovingDoodle })))

// These two static imports were what dragged BookDetailModal and BookShowcase
// into the root chunk, silently defeating the dynamic() declarations in
// app/page.tsx — a bundler re-merge that no source-level lint rule can catch.
const BookDetailModal = dynamic(() => import("./book-detail-modal").then(m => ({ default: m.BookDetailModal })))
const BookShowcase = dynamic(() => import("./book-showcase").then(m => ({ default: m.BookShowcase })))
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
import { upgradeLikedBookCovers } from "@/lib/itunes-covers"
import { hasVerifiedRating } from "@/lib/book-truth"
import { t } from "@/lib/i18n"

// Module scope: a constant lookup table, so it isn't rebuilt on every render
// (and doesn't need to be a memo dependency).
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

interface DashboardProps {
  onBack?: () => void
  onStartDiscovery: () => void
  showBackButton?: boolean
  onScan?: () => void
}

export function Dashboard({ onBack, onStartDiscovery, showBackButton = true, onScan }: DashboardProps) {
  // The dashboard only mounts after the session-restore gate in app/page.tsx,
  // i.e. post-hydration — so every initial read happens in a lazy initializer
  // instead of a mount effect.
  const [likedBooks, setLikedBooks] = useState<Book[]>(() => getLikedBooks())
  const [filter, setFilter] = useState<string>("all")
  const [sortBy, setSortBy] = useState<"recent" | "rating" | "pages">("recent")
  const [showAdmin, setShowAdmin] = useState(false)
  const [selectedBook, setSelectedBook] = useState<Book | null>(null)
  const [isBookModalOpen, setIsBookModalOpen] = useState(false)
  // 3D Showcase for discovery surfaces (Daily Pick, Discover hub) — library
  // taps keep opening the Detail Modal directly (docs/adr/0004).
  const [showcaseBook, setShowcaseBook] = useState<Book | null>(null)
  // Derived from storage, which the liked list drives — recomputed rather than
  // mirrored into state by an effect. `likedBooks` is the cache key, not an
  // input, so the linter can't see the relationship.
  // eslint-disable-next-line react-hooks/exhaustive-deps
  const userStats = useMemo(() => getUserStats(), [likedBooks])
  const [showSearch, setShowSearch] = useState(false)
  const [showShelfManager, setShowShelfManager] = useState(false)
  const [shelves, setShelves] = useState<Shelf[]>(() => getShelves())
  const [shelfFilter, setShelfFilter] = useState<string | null>(null)
  const [formatFilter, setFormatFilter] = useState<"all" | "ebook" | "audio">("all")
  const [readingSpd, setReadingSpd] = useState<ReadingSpeed>(() => getReadingSpeed())
  const [showFilters, setShowFilters] = useState(false)
  const [showBackupBanner, setShowBackupBanner] = useState(() => shouldShowBackupReminder())
  const [showWrapped, setShowWrapped] = useState(false)
  const [showCollections, setShowCollections] = useState(false)
  const [showChallenges, setShowChallenges] = useState(false)
  const [hiddenIds, setHiddenIds] = useState<Set<string>>(() => new Set(getHiddenBookIds()))
  const [showHidden, setShowHidden] = useState(false)
  const [authorFilter, setAuthorFilter] = useState<string | null>(null)
  const [moodFilter, setMoodFilter] = useState<string | null>(null)
  const [currentlyReading, setCurrentlyReading] = useState<ReturnType<typeof getReadingProgress>>(() =>
    getReadingProgress()
      .filter(p => p.status === "reading")
      .sort((a, b) => new Date(b.lastReadDate).getTime() - new Date(a.lastReadDate).getTime())
  )
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
    // Background: upgrade library covers to their edition-exact iTunes artwork
    // (persisted, so it runs at most once per book). Best-effort, async only.
    let cancelled = false
    void upgradeLikedBookCovers().then((updated) => {
      if (updated && !cancelled) setLikedBooks(updated)
    }).catch(() => { /* best-effort */ })
    return () => { cancelled = true }
  }, [])

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

  const handleDiscoveryBookClick = (book: Book) => {
    setShowcaseBook(book)
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

  // Reset visible count when filters/sort change so the user sees the first
  // page — done during render (React's "adjusting state" pattern) so the list
  // never paints one frame with the old page size.
  const filterKey = `${filter}|${sortBy}|${shelfFilter}|${formatFilter}|${authorFilter}|${moodFilter}|${showHidden}`
  const [prevFilterKey, setPrevFilterKey] = useState(filterKey)
  if (filterKey !== prevFilterKey) {
    setPrevFilterKey(filterKey)
    setVisibleCount(BOOKS_PER_PAGE)
  }

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
      ? (likedBooks.filter(hasVerifiedRating).reduce((sum, book) => sum + book.rating, 0) / (likedBooks.filter(hasVerifiedRating).length || 1)).toFixed(1)
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
      <DashboardHeader
        showBackButton={showBackButton}
        onBack={onBack}
        onScan={onScan}
        level={userStats.level}
        onSearch={() => setShowSearch(true)}
        onChallenges={() => setShowChallenges(true)}
        onAchievements={showAchievementsPanel}
      />

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
          <DashboardEmpty onStartDiscovery={onStartDiscovery} />
        ) : (
          <div className="space-y-10 py-6 sm:py-8">

            {/* Backup reminder */}
            {showBackupBanner && (
              <motion.div
                initial={{ opacity: 0, y: -8 }}
                animate={{ opacity: 1, y: 0 }}
                className="flex items-center gap-3 px-4 py-3 bg-surface-1 border border-border rounded-card"
              >
                <Download className="w-4 h-4 text-ink-muted flex-shrink-0" strokeWidth={1.8} />
                <p className="text-xs text-ink flex-1"> {t("dashboard.your_library_is_stored_in_this")}{' '}
                  <button
                    onClick={() => { setShowAdmin(true); setShowBackupBanner(false) }}
                    className="font-semibold text-accent-ink underline underline-offset-2"
                  > {t("dashboard.export_a_backup")} </button>{' '} {t("dashboard.to_keep_it_safe")} </p>
                <button
                  onClick={() => { dismissBackupReminder(); setShowBackupBanner(false) }}
                  aria-label={t("dashboard.dismiss_backup_reminder")}
                  className="p-1 rounded-md text-ink-muted hover:text-ink hover:bg-surface-2 transition-colors flex-shrink-0"
                >
                  <XIcon className="w-3.5 h-3.5" />
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
                    className="w-full text-left rounded-card border border-border bg-surface-1 p-4 transition-colors hover:border-border-strong group focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-focus focus-visible:ring-offset-2"
                  >
                    <div className="flex gap-4">
                      {/* Book cover */}
                      <div className="relative w-[84px] h-[126px] sm:w-24 sm:h-36 flex-shrink-0 rounded-cover overflow-hidden bg-surface-2 shadow-cover">
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
                          <p className="text-[11px] font-bold uppercase tracking-[0.12em] text-ink-muted mb-1"> {t("dashboard.continue_reading")} </p>
                          <h3 className="font-serif font-semibold text-[19px] sm:text-[24px] text-ink leading-tight line-clamp-1">
                            {primary.book.title}
                          </h3>
                          <p className="text-xs text-ink-muted mt-0.5 truncate">
                            {primary.book.author}
                          </p>
                        </div>

                        {/* Progress bar */}
                        <div className="mt-2.5 space-y-1.5">
                          <div className="h-1 w-full bg-surface-2 rounded-full overflow-hidden">
                            <motion.div
                              className="h-full bg-ink rounded-full"
                              initial={{ width: 0 }}
                              animate={{ width: `${pct}%` }}
                              transition={{ duration: 0.6, ease: "easeOut", delay: 0.2 }}
                            />
                          </div>
                          <div className="flex items-center justify-between text-xs text-ink-muted tabular-nums">
                            <span> {t("common.page")} {primary.currentPage} {t("common.of")} {primary.totalPages}
                              <span className="mx-1.5 text-ink-faint">·</span>
                              {pct}%
                            </span>
                            <span className="flex items-center gap-1">
                              <Clock className="w-3 h-3" />
                              {timeLabel} {t("dashboard.read")} {primary.currentPage > 0 && primary.timeSpentMinutes > 0 && primary.totalPages > primary.currentPage && (() => {
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
                                  <span className="font-serif italic ml-1.5">· {estimate}</span>
                                )
                              })()}
                            </span>
                          </div>
                        </div>
                      </div>

                      {/* Arrow */}
                      <div className="flex items-center flex-shrink-0 self-center">
                        <div className="w-8 h-8 rounded-full border border-border-strong flex items-center justify-center group-hover:bg-surface-2 transition-colors">
                          <ChevronRight className="w-4 h-4 text-ink" strokeWidth={1.8} />
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
                        className="text-xs font-medium text-ink-muted hover:text-accent-ink transition-colors px-1"
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
                                      <p className="text-xs font-semibold text-ink truncate group-hover/sub:text-accent-ink transition-colors">
                                        {prog.book.title}
                                      </p>
                                      <div className="flex items-center gap-2 mt-1">
                                        <div className="h-1 flex-1 bg-stone-200 dark:bg-stone-700 rounded-full overflow-hidden">
                                          <div
                                            className="h-full bg-ink rounded-full"
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
                    <p className="text-[11px] font-bold uppercase tracking-[0.12em] text-ink-muted mb-1">{t("dashboard.my_library")}</p>
                    <h2 className="text-[30px] sm:text-[40px] font-semibold text-ink font-serif leading-[1.08]">
                      {getGreeting()},<br className="sm:hidden" /> {t("dashboard.reader")} </h2>
                    <div className="flex items-center gap-2 mt-1.5 text-ink-muted text-[13px] tabular-nums">
                      <span className="flex items-center gap-1">
                        <BookOpen className="w-3.5 h-3.5" strokeWidth={1.8} />
                        {stats.totalBooks} {t("common.books_2")} </span>
                      {stats.totalPages > 0 && (
                        <>
                          <span className="w-0.5 h-0.5 rounded-full bg-border-strong hidden sm:block" />
                          <span className="hidden sm:inline">{stats.totalPages.toLocaleString()} {t("common.pages")}</span>
                        </>
                      )}
                      {Number(stats.averageRating) > 0 && (
                        <>
                          <span className="w-0.5 h-0.5 rounded-full bg-border-strong" />
                          <span className="flex items-center gap-0.5">
                            <Star className="w-3 h-3 text-accent-ink fill-accent-ink" />
                            {stats.averageRating}
                          </span>
                        </>
                      )}
                      {(() => {
                        const todayMin = getReadingTimeToday()
                        if (todayMin > 0) return (
                          <>
                            <span className="w-0.5 h-0.5 rounded-full bg-border-strong" />
                            <span className="flex items-center gap-0.5">
                              <Clock className="w-3 h-3" strokeWidth={1.8} />
                              {todayMin >= 60 ? `${Math.floor(todayMin / 60)}h ${todayMin % 60}m` : `${todayMin}m`} {t("dashboard.today")} </span>
                          </>
                        )
                        return null
                      })()}
                      {userStats.currentStreak > 0 && (
                        <>
                          <span className="w-0.5 h-0.5 rounded-full bg-border-strong" />
                          <span className="text-ink font-bold tabular-nums">{userStats.currentStreak}{t("dashboard.d_streak")}</span>
                        </>
                      )}
                    </div>
                  </div>
                </div>
                <Button
                  onClick={onStartDiscovery}
                  className="h-10 px-3 sm:px-5 text-sm bg-accent hover:bg-accent/90 text-on-accent font-semibold rounded-full transition-all flex-shrink-0 tap-target touch-manipulation"
                >
                  <Sparkles className="w-4 h-4 sm:mr-2" />
                  <span className="hidden sm:inline">{t("dashboard.discover")}</span>
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
                  className="w-full flex items-center justify-between gap-3 px-4 py-3 rounded-card bg-ink text-surface-0 dark:bg-surface-2 dark:text-ink dark:border dark:border-border-strong text-left transition-opacity hover:opacity-90 mb-4"
                >
                  <div className="flex items-center gap-3">
                    <Sparkles className="w-4 h-4 text-stage-amber flex-shrink-0" />
                    <div>
                      <p className="font-serif font-semibold text-[15px] leading-tight">{t("dashboard.your")} {new Date().getFullYear()} {t("dashboard.reading_wrapped")}</p>
                      <p className="text-[11px] opacity-70 mt-0.5 tabular-nums">{likedBooks.length} {t("dashboard.books_tap_to_see_your_year")}</p>
                    </div>
                  </div>
                  <div className="w-6 h-6 rounded-full border border-stage-hairline flex items-center justify-center flex-shrink-0">
                    <Star className="w-3 h-3 text-stage-amber fill-stage-amber" />
                  </div>
                </motion.button>
              )}

              {/* Daily Pick — inline within the greeting zone */}
              {likedBooks.length >= 3 && (
                <DailyPickCard
                  onBookClick={handleDiscoveryBookClick}
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
              <ActivityHeatmap />

              {/* Mood-Based Quick Browse */}
              <div className="flex items-center gap-2 overflow-x-auto hide-scrollbar py-2 -mt-2 -mb-1.5 lg:flex-wrap">
                {([
                  "Adventurous", "Cozy", "Intellectual", "Romantic",
                  "Thrilling", "Relaxing", "Inspiring", "Dark",
                ] as const).map((mood) => {
                  const isActive = moodFilter === mood
                  return (
                    <button
                      key={mood}
                      onClick={() => setMoodFilter(isActive ? null : mood)}
                      className={`relative before:absolute before:-inset-y-2 before:inset-x-0 before:content-[''] flex-shrink-0 h-[27px] inline-flex items-center rounded-full px-3 text-[12.5px] font-medium transition-colors ${
                        isActive
                          ? "bg-ink text-surface-0"
                          : "border border-border-strong text-ink hover:bg-surface-2"
                      }`}
                    >
                      {mood}
                    </button>
                  )
                })}
                {moodFilter && (
                  <button
                    onClick={() => setMoodFilter(null)}
                    className="flex-shrink-0 rounded-full py-1 px-2.5 text-xs font-medium text-ink-muted hover:text-ink transition-colors flex items-center gap-1"
                  >
                    <XIcon className="w-3 h-3" /> {t("dashboard.clear")} </button>
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
                  <BookOpen className="w-5 h-5 text-ink hidden sm:block" strokeWidth={1.8} />
                  <h2 className="text-lg font-semibold text-stone-900 dark:text-stone-100 font-serif"> {t("dashboard.your_books")} </h2>
                  <span className="text-xs text-stone-400 dark:text-stone-500 bg-stone-100 dark:bg-stone-800 px-2 py-0.5 rounded-full">
                    {sortedBooks.length !== likedBooks.length
                      ? `${sortedBooks.length} / ${likedBooks.length}`
                      : likedBooks.length}
                  </span>
                  {authorFilter && (
                    <button
                      onClick={() => setAuthorFilter(null)}
                      className="relative before:absolute before:-inset-y-2 before:inset-x-0 before:content-[''] flex items-center gap-1 h-[27px] px-2.5 rounded-full text-[12.5px] font-medium bg-ink text-surface-0 transition-opacity hover:opacity-90"
                    > {t("dashboard.by")} {authorFilter}
                      <XIcon className="w-3 h-3" />
                    </button>
                  )}
                </div>
                <button
                  onClick={() => setShowFilters(!showFilters)}
                  className={`flex items-center gap-1.5 px-3 py-1.5 rounded-control text-xs font-medium transition-all tap-target touch-manipulation ${
                    showFilters || hasActiveFilters
                      ? "bg-surface-2 text-ink"
                      : "text-ink-muted hover:text-ink hover:bg-surface-2"
                  }`}
                >
                  <SlidersHorizontal className="w-3.5 h-3.5" /> {t("dashboard.filters")} {hasActiveFilters && (
                    <span className="w-1.5 h-1.5 rounded-full bg-accent" />
                  )}
                </button>
              </div>

              {/* Shelf pills — always visible, compact */}
              <div className="flex gap-2 overflow-x-auto hide-scrollbar py-2 -mt-2 -mb-1">
                <button
                  onClick={() => setShelfFilter(null)}
                  className={`relative before:absolute before:-inset-y-2 before:inset-x-0 before:content-[''] flex-shrink-0 h-[27px] inline-flex items-center px-3 rounded-full text-[12.5px] font-medium transition-colors ${
                    shelfFilter === null
                      ? "bg-ink text-surface-0"
                      : "border border-border-strong text-ink hover:bg-surface-2"
                  }`}
                > {t("dashboard.all")} </button>
                {shelves.map(shelf => {
                  const count = getBooksForShelf(shelf.id).length
                  return (
                    <button
                      key={shelf.id}
                      onClick={() => setShelfFilter(shelfFilter === shelf.id ? null : shelf.id)}
                      className={`relative before:absolute before:-inset-y-2 before:inset-x-0 before:content-[''] flex-shrink-0 h-[27px] inline-flex items-center px-3 rounded-full text-[12.5px] font-medium transition-colors ${
                        shelfFilter === shelf.id
                          ? "bg-ink text-surface-0"
                          : "border border-border-strong text-ink hover:bg-surface-2"
                      }`}
                    >
                      {shelf.name}
                      {count > 0 && (
                        <span className="ml-1 opacity-60 tabular-nums">· {count}</span>
                      )}
                    </button>
                  )
                })}
                {genres.slice(0, 6).map(genre => (
                  <button
                    key={genre}
                    onClick={() => setFilter(filter === genre ? "all" : genre)}
                    className={`relative before:absolute before:-inset-y-2 before:inset-x-0 before:content-[''] flex-shrink-0 h-[27px] inline-flex items-center px-3 rounded-full text-[12.5px] font-medium transition-colors ${
                      filter === genre
                        ? "bg-ink text-surface-0"
                        : "border border-border-strong text-ink hover:bg-surface-2"
                    }`}
                  >
                    {genre}
                  </button>
                ))}
                <button
                  onClick={() => setShowShelfManager(true)}
                  aria-label={t("dashboard.manage_shelves")}
                  className="flex-shrink-0 px-2.5 py-1.5 text-xs font-medium text-accent-ink hover:underline transition-colors flex items-center gap-1"
                >
                  <Library className="w-3 h-3" /> {t("dashboard.manage")} </button>
                <button
                  onClick={() => setShowCollections(true)}
                  aria-label={t("dashboard.open_collections")}
                  className="flex-shrink-0 px-2.5 py-1.5 text-xs font-medium text-accent-ink hover:underline transition-colors flex items-center gap-1"
                >
                  <FolderOpen className="w-3 h-3" /> {t("dashboard.collections")} </button>
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
                        <Trash2 className="w-3 h-3" /> {t("dashboard.clear_all")} </button>

                      <span className="w-px h-4 bg-stone-200 dark:bg-stone-700" />

                      <span className="text-[11px] text-stone-400 dark:text-stone-500">{t("dashboard.speed")}</span>
                      <select
                        value={readingSpd}
                        aria-label={t("dashboard.reading_speed")}
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
                  <p className="text-sm text-stone-500 dark:text-stone-400">{t("dashboard.no_books_match_these_filters")}</p>
                  <button
                    onClick={() => { setFilter("all"); setShelfFilter(null); setFormatFilter("all"); setAuthorFilter(null); setMoodFilter(null); setShowHidden(false) }}
                    className="mt-2 text-xs text-accent-ink hover:underline font-medium"
                  > {t("dashboard.clear_filters")} </button>
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
                      <div className="relative aspect-[2/3] rounded-cover overflow-hidden bg-surface-2 mb-2.5 shadow-cover transition-transform group-hover:-translate-y-0.5">
                        <BookCover
                          src={book.cover}
                          fallbackSrc={book.coverFallback}
                          alt={book.title}
                          fill
                          className="object-cover"
                          sizes="(max-width: 640px) 50vw, (max-width: 1024px) 33vw, 20vw"
                        />
                        {/* Rating badge */}
                        {hasVerifiedRating(book) && (
                          <div className="absolute top-2 right-2 bg-white/90 dark:bg-stone-800/90 backdrop-blur-sm px-1.5 py-0.5 rounded-md flex items-center gap-0.5 shadow-sm">
                            <Star className="w-3 h-3 text-accent-ink fill-accent-ink" />
                            <span className="text-xs font-semibold text-ink tabular-nums">{book.rating}</span>
                          </div>
                        )}
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
                        <h3 className="font-serif font-semibold text-[12.5px] text-ink line-clamp-1 leading-tight">
                          {book.title}
                        </h3>
                        <button
                          onClick={(e) => {
                            e.stopPropagation()
                            setAuthorFilter(authorFilter === book.author ? null : book.author)
                          }}
                          className="text-[11px] text-ink-muted truncate hover:text-accent-ink hover:underline transition-colors text-left w-full py-3 -my-[10px]"
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
                              <span className="w-0.5 h-0.5 rounded-full bg-border-strong" />
                              <span>{estimateReadingTime(book.pages, readingSpd)}</span>
                            </>
                          ) : (
                            <span>{t("dashboard.unknown_length")}</span>
                          )}
                          {book.formats?.ebook && (
                            <span className="px-1 py-px rounded bg-blue-50 dark:bg-blue-900/30 text-blue-500 dark:text-blue-400 text-[9px] font-medium">{t("common.ebook")}</span>
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
                    className="group aspect-[2/3] rounded-cover border border-dashed border-border-strong hover:border-ink-muted bg-surface-1 flex flex-col items-center justify-center gap-2 transition-colors"
                  >
                    <div className="w-10 h-10 rounded-full bg-surface-2 flex items-center justify-center transition-colors">
                      <Sparkles className="w-5 h-5 text-ink" strokeWidth={1.8} />
                    </div>
                    <span className="text-xs font-semibold text-ink-muted group-hover:text-ink transition-colors">{t("dashboard.discover_more")}</span>
                  </motion.button>
                )}
                </div>

                {/* Scroll sentinel + progress indicator */}
                {sortedBooks.length > BOOKS_PER_PAGE && (
                  <div className="mt-6 flex flex-col items-center gap-3">
                    <p className="text-xs text-stone-400 dark:text-stone-500 tabular-nums"> {t("dashboard.showing")} {Math.min(visibleCount, sortedBooks.length)} {t("common.of")} {sortedBooks.length} {t("common.books_2")} </p>
                    {hasMore && (
                      <>
                        <div ref={sentinelCallback} className="w-full h-px" aria-hidden="true" />
                        <button
                          onClick={() => setVisibleCount(sortedBooks.length)}
                          className="px-4 py-2 rounded-lg text-xs font-medium text-stone-500 dark:text-stone-400 hover:text-stone-700 dark:hover:text-stone-200 bg-stone-100 dark:bg-stone-800 hover:bg-stone-200 dark:hover:bg-stone-700 transition-colors"
                        > {t("dashboard.load_all")}{sortedBooks.length - visibleCount} {t("dashboard.remaining")} </button>
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
                  <span className="text-xs font-semibold text-stone-400 dark:text-stone-500 uppercase tracking-widest">{t("dashboard.discover")}</span>
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
                  onBookClick={handleDiscoveryBookClick}
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

      {/* 3D Showcase for discovery taps; "Details" continues into the modal */}
      <BookShowcase
        book={showcaseBook}
        onClose={() => setShowcaseBook(null)}
        onMoreDetails={handleBookClick}
        onSavedChange={() => setLikedBooks(getLikedBooks())}
      />

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
        title={t("dashboard.clear_entire_library")}
        message="All your liked books will be permanently removed. This action cannot be undone."
        confirmLabel="Clear All"
        variant="danger"
      />
    </div>
  )
}
