"use client"

import { useState, useEffect, useRef, useMemo } from "react"
import { motion, AnimatePresence } from "framer-motion"
import { X, Star, Heart, MessageSquare, FileText, Calendar, Clock, BookOpen, Library, Share2, Trash2, Loader2, EyeOff, Plus, ChevronRight, Tag, CheckCircle2, Sparkles, Users, AlertTriangle, TrendingUp } from "lucide-react"
import { Book } from "@/lib/book-data"
import { BookReview, getBookReview, getShelvesForBook, getShelves, type Shelf, addLikedBook, getLikedBooks, getBookTags, getTagDefinitions, addTagToBook, removeTagFromBook, createTag, type TagDefinition, TAG_COLORS, getReadingProgress, updateReadingProgress, addBookToReading, recordBookView, isSuggestionDismissed, dismissSuggestion } from "@/lib/storage"
import { scoreBooks } from "@/lib/scoring-engine"
import { getCachedBooks } from "@/lib/book-cache"
import { detectSeries, findNextInSeries, type SeriesInfo } from "@/lib/series-detection"
import { QuickReview } from "./quick-review"
import { ReviewDisplay } from "./review-display"
import { BookNotes } from "./book-notes"
import { BookCover } from "@/components/book-cover"
import { ShelfPicker } from "./shelf-picker"
import { ShareCardGenerator } from "./share-card-generator"
import { WhereToRead } from "./where-to-read"
import { ConfirmDialog } from "./confirm-dialog"
import { estimateReadingTime } from "@/lib/reading-time"
import { useFocusTrap } from "@/lib/use-focus-trap"
import dynamic from "next/dynamic"
import { searchGutenberg, type GutenbergBook } from "@/lib/gutenberg-api"

// Code-split the reader (1,666 lines) — only loaded when user opens a book to read
const BookReader = dynamic(() => import("./book-reader"), {
  loading: () => (
    <div className="fixed inset-0 z-[60] bg-[#F5EFE0] flex items-center justify-center">
      <div className="w-8 h-8 border-2 border-amber-600 border-t-transparent rounded-full animate-spin" />
    </div>
  ),
})

interface BookDetailModalProps {
  book: Book | null
  isOpen: boolean
  onClose: () => void
  onStartReading?: (book: Book) => void
  onRemoveBook?: (book: Book) => void
  onHideBook?: (book: Book) => void
  onBookClick?: (book: Book) => void
}

export function BookDetailModal({ book, isOpen, onClose, onStartReading, onRemoveBook, onHideBook, onBookClick }: BookDetailModalProps) {
  const [activeTab, setActiveTab] = useState<"overview" | "review" | "notes">("overview")
  const [existingReview, setExistingReview] = useState<BookReview | null>(null)
  const [isEditingReview, setIsEditingReview] = useState(false)
  const [showShelfPicker, setShowShelfPicker] = useState(false)
  const [showShareCard, setShowShareCard] = useState(false)
  const [assignedShelves, setAssignedShelves] = useState<Shelf[]>([])
  const [descExpanded, setDescExpanded] = useState(false)
  const [gutenbergBook, setGutenbergBook] = useState<GutenbergBook | null | undefined>(undefined)
  // undefined = still searching, null = no match found, GutenbergBook = match found
  const [showReader, setShowReader] = useState(false)
  const [similarBooks, setSimilarBooks] = useState<Book[]>([])
  const [seriesInfo, setSeriesInfo] = useState<SeriesInfo | null>(null)
  const [seriesBooks, setSeriesBooks] = useState<Book[]>([])
  const [seriesLoading, setSeriesLoading] = useState(false)
  const [bookTagDefs, setBookTagDefs] = useState<TagDefinition[]>([])
  const [showTagDropdown, setShowTagDropdown] = useState(false)
  const [creatingTag, setCreatingTag] = useState(false)
  const [newTagName, setNewTagName] = useState("")
  const [newTagColor, setNewTagColor] = useState<string>(TAG_COLORS[4])
  const [showRemoveConfirm, setShowRemoveConfirm] = useState(false)
  const [showFinishedSuggestion, setShowFinishedSuggestion] = useState(false)
  const [showStartReadingSuggestion, setShowStartReadingSuggestion] = useState(false)
  const tagDropdownRef = useRef<HTMLDivElement>(null)
  const dialogRef = useRef<HTMLDivElement>(null)
  const contentRef = useRef<HTMLDivElement>(null)

  const likedSimilarBooks = useMemo(() => {
    if (!book) return []
    const allBooks = getLikedBooks()
    const scored = allBooks
      .filter(b => b.id !== book.id)
      .map(b => {
        let score = 0
        book.genre.forEach(g => { if (b.genre.includes(g)) score += 2 })
        book.mood.forEach(m => { if (b.mood.includes(m)) score += 1 })
        if (b.author === book.author) score += 3
        return { book: b, score }
      })
      .filter(s => s.score > 0)
      .sort((a, b) => b.score - a.score)
      .slice(0, 4)
      .map(s => s.book)
    return scored
  }, [book])

  useEffect(() => {
    if (book) {
      let cancelled = false
      setGutenbergBook(undefined)
      setShowReader(false)
      searchGutenberg(book.title, book.author).then((result) => {
        if (!cancelled) setGutenbergBook(result)
      })
      const review = getBookReview(book.id)
      setExistingReview(review)
      setActiveTab("overview")
      setDescExpanded(false)
      // Load assigned shelves
      const shelfIds = getShelvesForBook(book.id)
      const allShelves = getShelves()
      setAssignedShelves(allShelves.filter(s => shelfIds.includes(s.id)))
      // Load assigned tags
      setBookTagDefs(getBookTags(book.id))
      setShowTagDropdown(false)
      setCreatingTag(false)
      // Smart shelf suggestions
      const viewCount = recordBookView(book.id)
      const progress = getReadingProgress()
      const bookProgress = progress.find(p => p.bookId === book.id)
      if (
        bookProgress &&
        bookProgress.status !== "completed" &&
        bookProgress.totalPages > 0 &&
        (bookProgress.currentPage / bookProgress.totalPages) >= 0.95 &&
        !isSuggestionDismissed(book.id, "finished")
      ) {
        setShowFinishedSuggestion(true)
      } else {
        setShowFinishedSuggestion(false)
      }
      if (
        viewCount >= 3 &&
        !bookProgress &&
        !isSuggestionDismissed(book.id, "start-reading")
      ) {
        setShowStartReadingSuggestion(true)
      } else {
        setShowStartReadingSuggestion(false)
      }
      // Compute similar books using the current book as the "liked" input
      const cached = getCachedBooks().filter(b => b.id !== book.id)
      const scored = scoreBooks(cached, [book])
      setSimilarBooks(scored.slice(0, 6).map(s => s.book))
      // Detect series and fetch next books
      const detected = detectSeries(book)
      setSeriesInfo(detected)
      setSeriesBooks([])
      if (detected) {
        setSeriesLoading(true)
        findNextInSeries(book, detected).then((books) => {
          if (!cancelled) {
            setSeriesBooks(books)
            setSeriesLoading(false)
          }
        }).catch(() => {
          if (!cancelled) setSeriesLoading(false)
        })
      }
      return () => { cancelled = true }
    }
  }, [book])

  // Close tag dropdown on outside click
  useEffect(() => {
    if (!showTagDropdown) return
    const handleClickOutside = (e: MouseEvent) => {
      if (tagDropdownRef.current && !tagDropdownRef.current.contains(e.target as Node)) {
        setShowTagDropdown(false)
        setCreatingTag(false)
      }
    }
    document.addEventListener("mousedown", handleClickOutside)
    return () => document.removeEventListener("mousedown", handleClickOutside)
  }, [showTagDropdown])

  // Close on Escape key (only if no sub-modal is open)
  useEffect(() => {
    if (!isOpen) return
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape" && !showShelfPicker && !showShareCard) {
        if (showTagDropdown) {
          setShowTagDropdown(false)
          setCreatingTag(false)
          return
        }
        onClose()
      }
    }
    document.addEventListener("keydown", handleKeyDown)
    return () => {
      document.removeEventListener("keydown", handleKeyDown)
    }
  }, [isOpen, onClose, showShelfPicker, showShareCard])

  // Trap focus inside dialog (disabled when sub-modals are active)
  useFocusTrap(dialogRef, isOpen && !showShelfPicker && !showShareCard)

  if (!book || !isOpen) return null

  const handleReviewSaved = (review: BookReview) => {
    setExistingReview(review)
    setIsEditingReview(false)
    setActiveTab("overview")
  }

  const handleEditReview = () => {
    setIsEditingReview(true)
    setActiveTab("review")
  }

  const handleDeleteReview = () => {
    setExistingReview(null)
    setActiveTab("overview")
  }

  const handleTabChange = (tab: "overview" | "review" | "notes") => {
    setActiveTab(tab)
    // Scroll content area to top on tab switch
    contentRef.current?.scrollTo({ top: 0, behavior: "smooth" })
  }

  const tabs = [
    { id: "overview" as const, label: "Overview" },
    { id: "review" as const, label: "Review", hasDot: !!existingReview },
    { id: "notes" as const, label: "Notes" },
  ]

  return (
    <AnimatePresence>
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
        className="fixed inset-0 lg:left-16 bg-black/40 backdrop-blur-sm z-50 flex items-start md:items-center justify-center p-3 sm:p-4 pt-3 sm:pt-8 pb-16 sm:pb-24"
        onClick={onClose}
      >
        <motion.div
          ref={dialogRef}
          role="dialog"
          aria-modal="true"
          aria-labelledby="book-detail-title"
          tabIndex={-1}
          initial={{ opacity: 0, y: 30, scale: 0.97 }}
          animate={{ opacity: 1, y: 0, scale: 1 }}
          exit={{ opacity: 0, y: 30, scale: 0.97 }}
          transition={{ type: "spring", stiffness: 300, damping: 30 }}
          className="bg-background rounded-2xl shadow-2xl max-w-3xl w-full overflow-hidden flex flex-col border border-stone-200/60 dark:border-stone-700/60"
          style={{ maxHeight: "calc(100dvh - 64px)" }}
          onClick={(e) => e.stopPropagation()}
        >
          {/* Header with cover */}
          <div className="flex-shrink-0 p-4 sm:p-6 pb-4">
            <div className="flex items-start gap-4 sm:gap-5">
              {/* Cover */}
              <div className="relative w-20 sm:w-24 aspect-[2/3] flex-shrink-0 rounded-xl overflow-hidden shadow-md border border-stone-200/40 dark:border-stone-700/40">
                <BookCover
                  src={book.cover}
                  fallbackSrc={book.coverFallback}
                  alt={book.title}
                  fill
                  className="object-cover"
                  sizes="(max-width: 640px) 160px, 192px"
                />
              </div>

              {/* Info */}
              <div className="flex-1 min-w-0 space-y-2.5">
                <div className="flex items-start justify-between gap-2">
                  <div className="min-w-0">
                    <h2
                      id="book-detail-title"
                      className="text-lg sm:text-xl font-bold text-stone-900 dark:text-stone-100 leading-tight line-clamp-2 font-serif"
                    >
                      {book.title}
                    </h2>
                    <p className="text-sm sm:text-base text-stone-500 dark:text-stone-400 mt-0.5">{book.author}</p>
                  </div>

                  <button
                    onClick={onClose}
                    aria-label="Close book details"
                    className="p-2 -mr-2 -mt-1 rounded-lg hover:bg-stone-100 dark:hover:bg-stone-800 transition-colors flex-shrink-0 tap-target touch-manipulation"
                  >
                    <X className="w-5 h-5 text-stone-400 dark:text-stone-500" />
                  </button>
                </div>

                {/* Meta */}
                <div className="flex items-center gap-3 sm:gap-4 text-sm text-stone-500 dark:text-stone-400 flex-wrap">
                  <div className="flex items-center gap-1">
                    <BookOpen className="w-3.5 h-3.5 text-stone-400 dark:text-stone-500" />
                    <span>{book.pages}p</span>
                  </div>
                  <div className="flex items-center gap-1">
                    <Clock className="w-3.5 h-3.5 text-stone-400 dark:text-stone-500" />
                    <span>{estimateReadingTime(book.pages)}</span>
                  </div>
                  <div className="flex items-center gap-1">
                    <Star className="w-3.5 h-3.5 text-amber-500 fill-amber-500" />
                    <span className="font-medium text-stone-700 dark:text-stone-300">{book.rating}</span>
                  </div>
                  {book.metadata?.readinglogCount && book.metadata.readinglogCount > 0 && (
                    <div className="flex items-center gap-1">
                      <Users className="w-3.5 h-3.5 text-stone-400 dark:text-stone-500" />
                      <span>{book.metadata.readinglogCount.toLocaleString()} readers</span>
                    </div>
                  )}
                  {/* Format badges */}
                  {book.formats && (
                    <>
                      {book.formats.ebook && (
                        <span className="text-[10px] px-1.5 py-0.5 rounded bg-blue-50 text-blue-600 font-medium">eBook</span>
                      )}
                      {book.formats.audiobook && (
                        <span className="text-[10px] px-1.5 py-0.5 rounded bg-purple-50 text-purple-600 font-medium">Audio</span>
                      )}
                    </>
                  )}
                  {/* Reading pace estimation */}
                  {(() => {
                    const prog = getReadingProgress().find(p => p.bookId === book.id)
                    if (!prog || prog.currentPage <= 0 || prog.timeSpentMinutes <= 0) return null
                    const pagesPerMinute = prog.currentPage / prog.timeSpentMinutes
                    const pagesLeft = prog.totalPages - prog.currentPage
                    const minutesLeft = Math.round(pagesLeft / pagesPerMinute)
                    const hoursLeft = Math.round(minutesLeft / 60)
                    return minutesLeft > 0 ? (
                      <div className="flex items-center gap-1 text-amber-600 dark:text-amber-500">
                        <TrendingUp className="w-3.5 h-3.5" />
                        <span className="text-xs font-medium">
                          {hoursLeft < 2 ? `${minutesLeft}m to finish` : `~${hoursLeft}h to finish`}
                        </span>
                      </div>
                    ) : null
                  })()}
                </div>

                {/* Action buttons — primary row */}
                <div className="flex items-center gap-2 pt-0.5">
                  {onStartReading && (
                    <button
                      onClick={() => onStartReading(book)}
                      className="h-9 px-4 bg-stone-900 hover:bg-stone-800 text-white text-sm font-medium rounded-xl transition-all active:scale-[0.98] flex items-center gap-1.5"
                    >
                      <Plus className="w-3.5 h-3.5" />
                      Add to List
                    </button>
                  )}

                  {!existingReview && (
                    <button
                      onClick={() => {
                        setIsEditingReview(true)
                        setActiveTab("review")
                      }}
                      className="h-9 px-4 bg-white dark:bg-stone-900 border border-stone-200 dark:border-stone-700 hover:bg-stone-50 dark:hover:bg-stone-800/50 text-stone-700 dark:text-stone-300 text-sm font-medium rounded-xl transition-all active:scale-[0.98] shadow-sm flex items-center gap-1.5"
                    >
                      <MessageSquare className="w-3.5 h-3.5" />
                      Review
                    </button>
                  )}

                  {/* Show Read Free when Gutenberg match found */}
                  {gutenbergBook && (
                    <button
                      onClick={() => setShowReader(true)}
                      className="h-9 px-4 bg-amber-700 hover:bg-amber-800 text-white text-sm font-medium rounded-xl transition-all active:scale-[0.98] flex items-center gap-1.5"
                    >
                      <BookOpen className="w-3.5 h-3.5" />
                      Read Free
                    </button>
                  )}
                  {/* Subtle spinner while search is in progress */}
                  {gutenbergBook === undefined && (
                    <div className="h-9 flex items-center px-2">
                      <Loader2 className="w-3.5 h-3.5 text-stone-300 animate-spin" />
                    </div>
                  )}
                </div>

                {/* Secondary actions row */}
                <div className="flex items-center gap-2">
                  <button
                    onClick={() => setShowShelfPicker(true)}
                    className="h-10 px-3 bg-stone-50 dark:bg-stone-800/50 border border-stone-200 dark:border-stone-700 hover:bg-stone-100 dark:hover:bg-stone-800 text-stone-600 dark:text-stone-300 text-sm font-medium rounded-lg transition-all active:scale-[0.98] flex items-center gap-1"
                  >
                    <Library className="w-3 h-3" />
                    Shelves
                  </button>

                  <button
                    onClick={() => setShowShareCard(true)}
                    className="h-10 px-3 bg-stone-50 dark:bg-stone-800/50 border border-stone-200 dark:border-stone-700 hover:bg-stone-100 dark:hover:bg-stone-800 text-stone-600 dark:text-stone-300 text-sm font-medium rounded-lg transition-all active:scale-[0.98] flex items-center gap-1"
                  >
                    <Share2 className="w-3 h-3" />
                    Share
                  </button>

                  {onHideBook && (
                    <button
                      onClick={() => {
                        onHideBook(book)
                        onClose()
                      }}
                      className="h-10 px-3 bg-stone-50 dark:bg-stone-800/50 border border-stone-200 dark:border-stone-700 hover:bg-amber-50 dark:hover:bg-amber-900/30 hover:border-amber-200 text-stone-400 dark:text-stone-500 hover:text-amber-600 text-sm font-medium rounded-lg transition-all active:scale-[0.98] flex items-center gap-1 ml-2"
                    >
                      <EyeOff className="w-3 h-3" />
                      Hide
                    </button>
                  )}

                  {onRemoveBook && (
                    <button
                      onClick={() => {
                        if (confirm(`Remove "${book.title}" from your library?`)) {
                          onRemoveBook(book)
                          onClose()
                        }
                      }}
                      className="h-10 px-3 bg-stone-50 dark:bg-stone-800/50 border border-stone-200 dark:border-stone-700 hover:bg-red-50 hover:border-red-200 text-stone-400 dark:text-stone-500 hover:text-red-500 text-sm font-medium rounded-lg transition-all active:scale-[0.98] flex items-center gap-1"
                    >
                      <Trash2 className="w-3 h-3" />
                      Remove
                    </button>
                  )}
                </div>

                {/* Assigned shelf tags */}
                {assignedShelves.length > 0 && (
                  <div className="flex flex-wrap gap-1 pt-1">
                    {assignedShelves.map(shelf => (
                      <span key={shelf.id} className="text-[11px] px-2 py-0.5 rounded-full bg-amber-50 dark:bg-amber-900/30 text-amber-700 dark:text-amber-400 border border-amber-100 dark:border-amber-900/40">
                        {shelf.emoji} {shelf.name}
                      </span>
                    ))}
                  </div>
                )}
              </div>
            </div>
          </div>

          {/* Tabs - iOS-style segmented control */}
          <div className="px-5 sm:px-6 flex-shrink-0">
            <div className="flex gap-1 bg-stone-100 dark:bg-stone-800 rounded-lg p-1">
              {tabs.map((tab) => (
                <button
                  key={tab.id}
                  onClick={() => handleTabChange(tab.id)}
                  className={`flex-1 py-2 px-3 rounded-md text-sm font-medium transition-all tap-target touch-manipulation relative ${
                    activeTab === tab.id
                      ? "bg-white dark:bg-stone-900 text-stone-900 dark:text-stone-100 shadow-sm"
                      : "text-stone-500 dark:text-stone-400 hover:text-stone-700 dark:hover:text-stone-300"
                  }`}
                >
                  {tab.label}
                  {tab.hasDot && (
                    <span className="ml-1.5 w-1.5 h-1.5 bg-amber-500 rounded-full inline-block" />
                  )}
                </button>
              ))}
            </div>
          </div>

          {/* Content */}
          <div ref={contentRef} className="p-5 sm:p-6 overflow-y-auto flex-1 overscroll-contain" style={{ WebkitOverflowScrolling: 'touch' }}>
            {/* Smart shelf suggestion banners */}
            <AnimatePresence>
              {showFinishedSuggestion && (
                <motion.div
                  key="finished-suggestion"
                  initial={{ opacity: 0, height: 0, marginBottom: 0 }}
                  animate={{ opacity: 1, height: "auto", marginBottom: 16 }}
                  exit={{ opacity: 0, height: 0, marginBottom: 0 }}
                  transition={{ duration: 0.3, ease: "easeOut" }}
                  className="overflow-hidden"
                >
                  <div className="rounded-xl p-3.5 flex items-center gap-3 border border-emerald-200/60 dark:border-emerald-800/40" style={{ background: "linear-gradient(135deg, #fef3c7 0%, #d1fae5 100%)" }}>
                    <div className="flex-shrink-0 w-9 h-9 rounded-full bg-emerald-500/15 flex items-center justify-center">
                      <CheckCircle2 className="w-5 h-5 text-emerald-600" />
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-medium text-stone-800 leading-snug">Looks like you've finished this book!</p>
                      <p className="text-xs text-stone-500 mt-0.5">Mark it as completed?</p>
                    </div>
                    <div className="flex items-center gap-2 flex-shrink-0">
                      <button
                        onClick={() => {
                          updateReadingProgress(book.id, { status: "completed" })
                          setShowFinishedSuggestion(false)
                          dismissSuggestion(book.id, "finished")
                        }}
                        className="h-8 px-3.5 bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-semibold rounded-lg transition-colors active:scale-[0.97]"
                      >
                        Yes, I'm done
                      </button>
                      <button
                        onClick={() => {
                          setShowFinishedSuggestion(false)
                          dismissSuggestion(book.id, "finished")
                        }}
                        className="text-[11px] text-stone-400 hover:text-stone-600 dark:hover:text-stone-300 font-medium transition-colors px-1"
                      >
                        Dismiss
                      </button>
                    </div>
                  </div>
                </motion.div>
              )}

              {showStartReadingSuggestion && (
                <motion.div
                  key="start-reading-suggestion"
                  initial={{ opacity: 0, height: 0, marginBottom: 0 }}
                  animate={{ opacity: 1, height: "auto", marginBottom: 16 }}
                  exit={{ opacity: 0, height: 0, marginBottom: 0 }}
                  transition={{ duration: 0.3, ease: "easeOut" }}
                  className="overflow-hidden"
                >
                  <div className="rounded-xl p-3.5 flex items-center gap-3 bg-blue-50/80 dark:bg-blue-950/30 border border-blue-200/60 dark:border-blue-800/40">
                    <div className="flex-shrink-0 w-9 h-9 rounded-full bg-blue-500/15 flex items-center justify-center">
                      <Sparkles className="w-5 h-5 text-blue-600 dark:text-blue-400" />
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-medium text-stone-800 dark:text-stone-200 leading-snug">You keep coming back to this one.</p>
                      <p className="text-xs text-stone-500 dark:text-stone-400 mt-0.5">Ready to start reading?</p>
                    </div>
                    <div className="flex items-center gap-2 flex-shrink-0">
                      <button
                        onClick={() => {
                          addBookToReading(book)
                          setShowStartReadingSuggestion(false)
                          dismissSuggestion(book.id, "start-reading")
                        }}
                        className="h-8 px-3.5 bg-blue-600 hover:bg-blue-700 text-white text-xs font-semibold rounded-lg transition-colors active:scale-[0.97]"
                      >
                        Start Reading
                      </button>
                      <button
                        onClick={() => {
                          setShowStartReadingSuggestion(false)
                          dismissSuggestion(book.id, "start-reading")
                        }}
                        className="text-[11px] text-stone-400 hover:text-stone-600 dark:hover:text-stone-300 font-medium transition-colors px-1"
                      >
                        Dismiss
                      </button>
                    </div>
                  </div>
                </motion.div>
              )}
            </AnimatePresence>

            {activeTab === "overview" && (
              <div className="space-y-5">
                {/* Description */}
                <div>
                  <h3 className="text-xs font-semibold text-stone-400 dark:text-stone-500 uppercase tracking-wider mb-2">
                    About this book
                  </h3>
                  <p className="text-sm text-stone-600 dark:text-stone-300 leading-relaxed">
                    {(() => {
                      const description = book.description ?? ""
                      return descExpanded || description.length <= 200
                        ? description
                        : description.slice(0, 200) + "..."
                    })()}
                  </p>
                  {(book.description?.length ?? 0) > 200 && (
                    <button
                      onClick={() => setDescExpanded(!descExpanded)}
                      className="text-xs text-amber-700 dark:text-amber-400 hover:text-amber-800 dark:hover:text-amber-300 font-medium mt-1.5 transition-colors"
                    >
                      {descExpanded ? "Show less" : "Read more"}
                    </button>
                  )}
                </div>

                {/* Content Warnings */}
                {(() => {
                  const warnings: string[] = []
                  // From user review
                  if (existingReview?.contentWarnings) warnings.push(...existingReview.contentWarnings)
                  // Auto-detect from genres/mood/description
                  const lower = [...book.genre, ...book.mood, ...(book.description ? [book.description] : [])].join(" ").toLowerCase()
                  if (!warnings.includes("Violence") && lower.match(/violen|war|battle|murder|kill/)) warnings.push("Violence")
                  if (!warnings.includes("Death / Grief") && lower.match(/death|grief|loss|dying|funeral/)) warnings.push("Death / Grief")
                  if (!warnings.includes("Mental Health") && lower.match(/depress|anxiety|mental|suicid|trauma/)) warnings.push("Mental Health")
                  if (warnings.length === 0) return null
                  return (
                    <div className="space-y-2">
                      <p className="text-xs font-semibold text-stone-400 dark:text-stone-500 uppercase tracking-wider flex items-center gap-1.5">
                        <AlertTriangle className="w-3 h-3" />
                        Content Warnings
                      </p>
                      <div className="flex flex-wrap gap-1.5">
                        {warnings.map(w => (
                          <span key={w} className="px-2 py-0.5 rounded-full text-[10px] font-medium bg-amber-50 dark:bg-amber-900/20 text-amber-700 dark:text-amber-400 border border-amber-200/60 dark:border-amber-700/40">
                            {w}
                          </span>
                        ))}
                      </div>
                    </div>
                  )
                })()}

                {/* Genres & Moods */}
                <div>
                  <h3 className="text-xs font-semibold text-stone-400 dark:text-stone-500 uppercase tracking-wider mb-2.5">
                    Genres & Moods
                  </h3>
                  <div className="flex flex-wrap gap-1.5">
                    {book.genre.map((genre) => (
                      <span
                        key={genre}
                        className="bg-stone-100 dark:bg-stone-800 text-stone-700 dark:text-stone-300 text-xs px-3 py-1.5 rounded-full font-medium"
                      >
                        {genre}
                      </span>
                    ))}
                    {book.mood.map((mood) => (
                      <span
                        key={mood}
                        className="bg-amber-50 dark:bg-amber-900/30 text-amber-700 dark:text-amber-400 text-xs px-3 py-1.5 rounded-full font-medium border border-amber-100 dark:border-amber-900/40"
                      >
                        {mood}
                      </span>
                    ))}
                  </div>
                </div>

                {/* Tags / Labels */}
                <div>
                  <h3 className="text-xs font-semibold text-stone-400 dark:text-stone-500 uppercase tracking-wider mb-2.5">
                    Tags
                  </h3>
                  <div className="flex flex-wrap items-center gap-1.5">
                    {bookTagDefs.map((tag) => (
                      <span
                        key={tag.id}
                        className="inline-flex items-center gap-1 text-xs font-medium px-2.5 py-1 rounded-full transition-colors"
                        style={{
                          backgroundColor: tag.color + "20",
                          color: tag.color,
                        }}
                      >
                        {tag.name}
                        <button
                          onClick={() => {
                            removeTagFromBook(book.id, tag.id)
                            setBookTagDefs(getBookTags(book.id))
                          }}
                          className="ml-0.5 rounded-full hover:bg-black/10 dark:hover:bg-white/10 p-0.5 transition-colors"
                          aria-label={`Remove tag ${tag.name}`}
                        >
                          <X className="w-3 h-3" />
                        </button>
                      </span>
                    ))}
                    <div className="relative" ref={tagDropdownRef}>
                      <button
                        onClick={() => {
                          setShowTagDropdown(!showTagDropdown)
                          setCreatingTag(false)
                          setNewTagName("")
                        }}
                        className="inline-flex items-center gap-1 text-xs font-medium px-2.5 py-1 rounded-full bg-stone-100 dark:bg-stone-800 text-stone-500 dark:text-stone-400 hover:bg-stone-200 dark:hover:bg-stone-700 hover:text-stone-700 dark:hover:text-stone-200 transition-colors"
                      >
                        <Tag className="w-3 h-3" />
                        Add tag
                      </button>
                      <AnimatePresence>
                        {showTagDropdown && (
                          <motion.div
                            initial={{ opacity: 0, y: 4, scale: 0.95 }}
                            animate={{ opacity: 1, y: 0, scale: 1 }}
                            exit={{ opacity: 0, y: 4, scale: 0.95 }}
                            transition={{ duration: 0.15 }}
                            className="absolute top-full left-0 mt-1.5 z-20 w-56 bg-white dark:bg-stone-900 rounded-xl shadow-lg border border-stone-200 dark:border-stone-700 overflow-hidden"
                          >
                            {!creatingTag ? (
                              <div className="max-h-48 overflow-y-auto">
                                {getTagDefinitions()
                                  .filter(t => !bookTagDefs.some(bt => bt.id === t.id))
                                  .map((tag) => (
                                    <button
                                      key={tag.id}
                                      onClick={() => {
                                        addTagToBook(book.id, tag.id)
                                        setBookTagDefs(getBookTags(book.id))
                                      }}
                                      className="w-full flex items-center gap-2 px-3 py-2 text-xs text-left hover:bg-stone-50 dark:hover:bg-stone-800 transition-colors"
                                    >
                                      <span
                                        className="w-2.5 h-2.5 rounded-full flex-shrink-0"
                                        style={{ backgroundColor: tag.color }}
                                      />
                                      <span className="text-stone-700 dark:text-stone-300 truncate">{tag.name}</span>
                                    </button>
                                  ))
                                }
                                <button
                                  onClick={() => {
                                    setCreatingTag(true)
                                    setNewTagName("")
                                    setNewTagColor(TAG_COLORS[4])
                                  }}
                                  className="w-full flex items-center gap-2 px-3 py-2.5 text-xs text-left border-t border-stone-100 dark:border-stone-800 hover:bg-stone-50 dark:hover:bg-stone-800 transition-colors text-amber-700 dark:text-amber-400 font-medium"
                                >
                                  <Plus className="w-3.5 h-3.5" />
                                  Create new tag
                                </button>
                              </div>
                            ) : (
                              <div className="p-3 space-y-2.5">
                                <input
                                  type="text"
                                  placeholder="Tag name..."
                                  value={newTagName}
                                  onChange={(e) => setNewTagName(e.target.value)}
                                  onKeyDown={(e) => {
                                    if (e.key === "Enter" && newTagName.trim()) {
                                      const created = createTag(newTagName.trim(), newTagColor)
                                      addTagToBook(book.id, created.id)
                                      setBookTagDefs(getBookTags(book.id))
                                      setCreatingTag(false)
                                      setShowTagDropdown(false)
                                      setNewTagName("")
                                    }
                                  }}
                                  autoFocus
                                  maxLength={50}
                                  className="w-full text-xs px-2.5 py-1.5 rounded-lg border border-stone-200 dark:border-stone-700 bg-stone-50 dark:bg-stone-800 text-stone-800 dark:text-stone-200 placeholder:text-stone-400 focus:outline-none focus:ring-1 focus:ring-amber-400"
                                />
                                <div className="flex gap-1.5 flex-wrap">
                                  {TAG_COLORS.map((c) => (
                                    <button
                                      key={c}
                                      onClick={() => setNewTagColor(c)}
                                      className="w-6 h-6 rounded-full transition-all flex items-center justify-center"
                                      style={{
                                        backgroundColor: c,
                                        boxShadow: newTagColor === c ? `0 0 0 2px white, 0 0 0 4px ${c}` : "none",
                                      }}
                                      aria-label={`Select color ${c}`}
                                    >
                                      {newTagColor === c && (
                                        <svg className="w-3 h-3 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={3}>
                                          <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
                                        </svg>
                                      )}
                                    </button>
                                  ))}
                                </div>
                                <div className="flex gap-1.5">
                                  <button
                                    onClick={() => setCreatingTag(false)}
                                    className="flex-1 text-xs px-2.5 py-1.5 rounded-lg bg-stone-100 dark:bg-stone-800 text-stone-500 dark:text-stone-400 hover:bg-stone-200 dark:hover:bg-stone-700 transition-colors"
                                  >
                                    Cancel
                                  </button>
                                  <button
                                    onClick={() => {
                                      if (newTagName.trim()) {
                                        const created = createTag(newTagName.trim(), newTagColor)
                                        addTagToBook(book.id, created.id)
                                        setBookTagDefs(getBookTags(book.id))
                                        setCreatingTag(false)
                                        setShowTagDropdown(false)
                                        setNewTagName("")
                                      }
                                    }}
                                    disabled={!newTagName.trim()}
                                    className="flex-1 text-xs px-2.5 py-1.5 rounded-lg bg-stone-900 dark:bg-stone-100 text-white dark:text-stone-900 hover:bg-stone-800 dark:hover:bg-stone-200 transition-colors disabled:opacity-40 disabled:cursor-not-allowed font-medium"
                                  >
                                    Create
                                  </button>
                                </div>
                              </div>
                            )}
                          </motion.div>
                        )}
                      </AnimatePresence>
                    </div>
                  </div>
                </div>

                {/* Where to Read */}
                <div>
                  <h3 className="text-xs font-semibold text-stone-400 dark:text-stone-500 uppercase tracking-wider mb-2.5">
                    Where to Read
                  </h3>
                  <WhereToRead book={book} />
                </div>

                {/* Existing Review Summary */}
                {existingReview && (
                  <div>
                    <div className="flex items-center justify-between mb-2.5">
                      <h3 className="text-xs font-semibold text-stone-400 dark:text-stone-500 uppercase tracking-wider">
                        Your Review
                      </h3>
                      <button
                        onClick={handleEditReview}
                        className="text-xs text-amber-700 dark:text-amber-400 hover:text-amber-800 dark:hover:text-amber-300 font-medium transition-colors"
                      >
                        Edit
                      </button>
                    </div>
                    <ReviewDisplay
                      review={existingReview}
                      onEdit={handleEditReview}
                      onDelete={handleDeleteReview}
                      compact
                    />
                  </div>
                )}

                {/* Notes Preview */}
                <div>
                  <h3 className="text-xs font-semibold text-stone-400 dark:text-stone-500 uppercase tracking-wider mb-2.5">
                    Notes & Highlights
                  </h3>
                  <BookNotes bookId={book.id} compact />
                </div>

                {/* Series */}
                {seriesInfo && (
                  <div>
                    <div className="flex items-center gap-2 mb-2.5">
                      <h3 className="text-xs font-semibold text-stone-400 dark:text-stone-500 uppercase tracking-wider">
                        Continue the Series
                      </h3>
                      <span className="text-[10px] px-2 py-0.5 rounded-full bg-amber-100 dark:bg-amber-900/40 text-amber-700 dark:text-amber-400 font-semibold border border-amber-200/60 dark:border-amber-800/40">
                        Book {seriesInfo.bookNumber} of {seriesInfo.seriesName}
                      </span>
                    </div>

                    {seriesLoading ? (
                      <div className="flex items-center gap-2 py-4">
                        <Loader2 className="w-4 h-4 text-amber-500 animate-spin" />
                        <span className="text-xs text-stone-400 dark:text-stone-500">Finding series books...</span>
                      </div>
                    ) : seriesBooks.length > 0 ? (
                      <div className="flex gap-2.5 overflow-x-auto pb-1 -mx-1 px-1">
                        {seriesBooks.map((seriesBook) => {
                          const sbInfo = detectSeries(seriesBook)
                          return (
                            <div
                              key={seriesBook.id}
                              className="flex-shrink-0 group flex flex-col items-center gap-1.5"
                            >
                              <button
                                onClick={() => onBookClick?.(seriesBook)}
                                className="relative"
                                title={`${seriesBook.title} by ${seriesBook.author}`}
                              >
                                <div className="relative w-[48px] h-[72px] rounded-lg overflow-hidden shadow-sm border border-stone-200/60 dark:border-stone-700/60 group-hover:shadow-md group-hover:border-amber-300 dark:group-hover:border-amber-700 transition-all">
                                  <BookCover
                                    src={seriesBook.cover}
                                    fallbackSrc={seriesBook.coverFallback}
                                    alt={seriesBook.title}
                                    fill
                                    className="object-cover"
                                    sizes="48px"
                                  />
                                </div>
                                {sbInfo && (
                                  <span className="absolute -top-1.5 -right-1.5 w-5 h-5 rounded-full bg-amber-500 text-white text-[10px] font-bold flex items-center justify-center shadow-sm">
                                    {sbInfo.bookNumber}
                                  </span>
                                )}
                              </button>
                              <p className="text-[10px] text-stone-500 dark:text-stone-400 text-center leading-tight w-[48px] line-clamp-2">
                                {seriesBook.title}
                              </p>
                              <button
                                onClick={() => {
                                  addLikedBook(seriesBook)
                                  onStartReading?.(seriesBook)
                                }}
                                className="text-[9px] px-2 py-0.5 rounded-full bg-stone-100 dark:bg-stone-800 text-stone-500 dark:text-stone-400 hover:bg-amber-100 dark:hover:bg-amber-900/40 hover:text-amber-700 dark:hover:text-amber-400 transition-colors font-medium flex items-center gap-0.5"
                              >
                                <Plus className="w-2.5 h-2.5" />
                                Add
                              </button>
                            </div>
                          )
                        })}
                      </div>
                    ) : (
                      <p className="text-xs text-stone-400 dark:text-stone-500 italic py-2">
                        No other books found in this series.
                      </p>
                    )}
                  </div>
                )}

                {/* Similar Books */}
                {similarBooks.length > 0 && (
                  <div>
                    <h3 className="text-xs font-semibold text-stone-400 dark:text-stone-500 uppercase tracking-wider mb-2.5">
                      More Like This
                    </h3>
                    <div className="flex gap-2.5 overflow-x-auto pb-1 -mx-1 px-1">
                      {similarBooks.map((similar) => (
                        <button
                          key={similar.id}
                          onClick={() => onBookClick?.(similar)}
                          className="flex-shrink-0 group flex flex-col items-center gap-1.5"
                          title={`${similar.title} by ${similar.author}`}
                        >
                          <div className="relative w-20 h-28 rounded-lg overflow-hidden shadow-sm border border-stone-200/60 dark:border-stone-700/60 group-hover:shadow-md transition-shadow">
                            <BookCover
                              src={similar.cover}
                              fallbackSrc={similar.coverFallback}
                              alt={similar.title}
                              fill
                              className="object-cover"
                              sizes="80px"
                            />
                          </div>
                          <p className="text-xs text-stone-500 dark:text-stone-400 text-center leading-tight w-20 line-clamp-2">
                            {similar.title}
                          </p>
                        </button>
                      ))}
                    </div>
                  </div>
                )}

                {/* If You Liked This — from user's library */}
                {likedSimilarBooks.length > 0 && (
                  <div className="space-y-3 pt-2">
                    <p className="text-xs font-semibold text-stone-400 dark:text-stone-500 uppercase tracking-wider">
                      If you liked this
                    </p>
                    <div className="grid grid-cols-4 gap-2">
                      {likedSimilarBooks.map(sb => (
                        <button
                          key={sb.id}
                          onClick={() => onBookClick?.(sb)}
                          className="text-left group"
                        >
                          <div className="relative aspect-[2/3] rounded-lg overflow-hidden bg-stone-100 dark:bg-stone-800 ring-1 ring-stone-200/50 dark:ring-stone-700/50 mb-1.5">
                            <BookCover
                              src={sb.cover}
                              fallbackSrc={sb.coverFallback}
                              alt={sb.title}
                              fill
                              className="object-cover"
                              sizes="80px"
                            />
                          </div>
                          <p className="text-[10px] font-medium text-stone-700 dark:text-stone-300 line-clamp-2 leading-tight group-hover:text-amber-700 dark:group-hover:text-amber-400 transition-colors">
                            {sb.title}
                          </p>
                        </button>
                      ))}
                    </div>
                  </div>
                )}
              </div>
            )}

            {activeTab === "review" && (
              <div>
                {isEditingReview || !existingReview ? (
                  <QuickReview
                    book={book}
                    onReviewSaved={handleReviewSaved}
                    existingReview={existingReview}
                  />
                ) : (
                  <ReviewDisplay
                    review={existingReview}
                    onEdit={handleEditReview}
                    onDelete={handleDeleteReview}
                  />
                )}
              </div>
            )}

            {activeTab === "notes" && (
              <BookNotes bookId={book.id} />
            )}

            <div className="h-4 sm:h-0" />
          </div>
        </motion.div>

        {/* Shelf Picker */}
        <ShelfPicker
          bookId={book.id}
          isOpen={showShelfPicker}
          onClose={() => {
            setShowShelfPicker(false)
            // Refresh assigned shelves
            const shelfIds = getShelvesForBook(book.id)
            const allShelves = getShelves()
            setAssignedShelves(allShelves.filter(s => shelfIds.includes(s.id)))
          }}
        />

        {/* Share Card Generator */}
        <ShareCardGenerator
          book={book}
          isOpen={showShareCard}
          onClose={() => setShowShareCard(false)}
        />
      </motion.div>

      {book && gutenbergBook && (
        <BookReader
          bookId={book.id}
          bookTitle={book.title}
          gutenbergBook={gutenbergBook}
          isOpen={showReader}
          onClose={() => setShowReader(false)}
        />
      )}
    </AnimatePresence>
  )
}
