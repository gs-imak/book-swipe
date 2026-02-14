"use client"

import { useState, useEffect, useRef } from "react"
import { motion, AnimatePresence } from "framer-motion"
import { X, Star, Heart, MessageSquare, FileText, Calendar, Clock, BookOpen, Library, Share2, Trash2 } from "lucide-react"
import { Book } from "@/lib/book-data"
import { BookReview, getBookReview, getShelvesForBook, getShelves, type Shelf } from "@/lib/storage"
import { QuickReview } from "./quick-review"
import { ReviewDisplay } from "./review-display"
import { BookNotes } from "./book-notes"
import { BookCover } from "@/components/book-cover"
import { ShelfPicker } from "./shelf-picker"
import { ShareCardGenerator } from "./share-card-generator"
import { WhereToRead } from "./where-to-read"
import { estimateReadingTime } from "@/lib/reading-time"
import { useFocusTrap } from "@/lib/use-focus-trap"

interface BookDetailModalProps {
  book: Book | null
  isOpen: boolean
  onClose: () => void
  onStartReading?: (book: Book) => void
  onRemoveBook?: (book: Book) => void
}

export function BookDetailModal({ book, isOpen, onClose, onStartReading, onRemoveBook }: BookDetailModalProps) {
  const [activeTab, setActiveTab] = useState<"overview" | "review" | "notes">("overview")
  const [existingReview, setExistingReview] = useState<BookReview | null>(null)
  const [isEditingReview, setIsEditingReview] = useState(false)
  const [showShelfPicker, setShowShelfPicker] = useState(false)
  const [showShareCard, setShowShareCard] = useState(false)
  const [assignedShelves, setAssignedShelves] = useState<Shelf[]>([])
  const [descExpanded, setDescExpanded] = useState(false)
  const dialogRef = useRef<HTMLDivElement>(null)
  const contentRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    if (book) {
      const review = getBookReview(book.id)
      setExistingReview(review)
      setActiveTab("overview")
      setDescExpanded(false)
      // Load assigned shelves
      const shelfIds = getShelvesForBook(book.id)
      const allShelves = getShelves()
      setAssignedShelves(allShelves.filter(s => shelfIds.includes(s.id)))
    }
  }, [book])

  // Close on Escape key
  useEffect(() => {
    if (!isOpen) return
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        onClose()
      }
    }
    document.addEventListener("keydown", handleKeyDown)
    return () => {
      document.removeEventListener("keydown", handleKeyDown)
    }
  }, [isOpen, onClose])

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
        className="fixed inset-0 bg-black/40 backdrop-blur-sm z-50 flex items-start md:items-center justify-center p-3 sm:p-4 pt-3 sm:pt-8 pb-16 sm:pb-24"
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
          className="bg-background rounded-2xl shadow-2xl max-w-3xl w-full max-h-[calc(100vh-64px)] sm:max-h-[85vh] overflow-hidden flex flex-col border border-stone-200/60"
          onClick={(e) => e.stopPropagation()}
        >
          {/* Header with cover */}
          <div className="flex-shrink-0 p-4 sm:p-6 pb-4">
            <div className="flex items-start gap-4 sm:gap-5">
              {/* Cover */}
              <div className="relative w-20 h-28 sm:w-24 sm:h-36 flex-shrink-0 rounded-xl overflow-hidden shadow-md border border-stone-200/40">
                <BookCover
                  src={book.cover}
                  fallbackSrc={book.coverFallback}
                  alt={book.title}
                  fill
                  className="object-contain"
                  sizes="(max-width: 640px) 160px, 192px"
                />
              </div>

              {/* Info */}
              <div className="flex-1 min-w-0 space-y-2.5">
                <div className="flex items-start justify-between gap-2">
                  <div className="min-w-0">
                    <h2
                      id="book-detail-title"
                      className="text-lg sm:text-xl font-bold text-stone-900 leading-tight line-clamp-2 font-serif"
                    >
                      {book.title}
                    </h2>
                    <p className="text-sm sm:text-base text-stone-500 mt-0.5">{book.author}</p>
                  </div>

                  <button
                    onClick={onClose}
                    aria-label="Close book details"
                    className="p-2 -mr-2 -mt-1 rounded-lg hover:bg-stone-100 transition-colors flex-shrink-0 tap-target touch-manipulation"
                  >
                    <X className="w-5 h-5 text-stone-400" />
                  </button>
                </div>

                {/* Meta */}
                <div className="flex items-center gap-3 sm:gap-4 text-sm text-stone-500 flex-wrap">
                  <div className="flex items-center gap-1">
                    <BookOpen className="w-3.5 h-3.5 text-stone-400" />
                    <span>{book.pages}p</span>
                  </div>
                  <div className="flex items-center gap-1">
                    <Clock className="w-3.5 h-3.5 text-stone-400" />
                    <span>{estimateReadingTime(book.pages)}</span>
                  </div>
                  <div className="flex items-center gap-1">
                    <Star className="w-3.5 h-3.5 text-amber-500 fill-amber-500" />
                    <span className="font-medium text-stone-700">{book.rating}</span>
                  </div>
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
                </div>

                {/* Action buttons */}
                <div className="flex items-center gap-2 pt-0.5 flex-wrap">
                  {onStartReading && (
                    <button
                      onClick={() => onStartReading(book)}
                      className="h-9 px-4 bg-stone-900 hover:bg-stone-800 text-white text-sm font-medium rounded-xl transition-all active:scale-[0.98]"
                    >
                      <BookOpen className="w-3.5 h-3.5 inline mr-1.5 -mt-0.5" />
                      Start Reading
                    </button>
                  )}

                  {!existingReview && (
                    <button
                      onClick={() => {
                        setIsEditingReview(true)
                        setActiveTab("review")
                      }}
                      className="h-9 px-4 bg-white border border-stone-200 hover:bg-stone-50 text-stone-700 text-sm font-medium rounded-xl transition-all active:scale-[0.98] shadow-sm"
                    >
                      <MessageSquare className="w-3.5 h-3.5 inline mr-1.5 -mt-0.5" />
                      Review
                    </button>
                  )}

                  <button
                    onClick={() => setShowShelfPicker(true)}
                    className="h-9 px-3 bg-white border border-stone-200 hover:bg-stone-50 text-stone-700 text-sm font-medium rounded-xl transition-all active:scale-[0.98] shadow-sm"
                  >
                    <Library className="w-3.5 h-3.5 inline mr-1 -mt-0.5" />
                    Shelves
                  </button>

                  <button
                    onClick={() => setShowShareCard(true)}
                    className="h-9 px-3 bg-white border border-stone-200 hover:bg-stone-50 text-stone-700 text-sm font-medium rounded-xl transition-all active:scale-[0.98] shadow-sm"
                  >
                    <Share2 className="w-3.5 h-3.5 inline mr-1 -mt-0.5" />
                    Share
                  </button>

                  {onRemoveBook && (
                    <button
                      onClick={() => {
                        if (confirm(`Remove "${book.title}" from your library?`)) {
                          onRemoveBook(book)
                          onClose()
                        }
                      }}
                      className="h-9 px-3 bg-white border border-stone-200 hover:bg-red-50 hover:border-red-200 text-stone-400 hover:text-red-500 text-sm font-medium rounded-xl transition-all active:scale-[0.98] shadow-sm"
                    >
                      <Trash2 className="w-3.5 h-3.5 inline -mt-0.5" />
                    </button>
                  )}
                </div>

                {/* Assigned shelf tags */}
                {assignedShelves.length > 0 && (
                  <div className="flex flex-wrap gap-1 pt-1">
                    {assignedShelves.map(shelf => (
                      <span key={shelf.id} className="text-[11px] px-2 py-0.5 rounded-full bg-amber-50 text-amber-700 border border-amber-100">
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
            <div className="flex gap-1 bg-stone-100 rounded-lg p-1">
              {tabs.map((tab) => (
                <button
                  key={tab.id}
                  onClick={() => handleTabChange(tab.id)}
                  className={`flex-1 py-2 px-3 rounded-md text-sm font-medium transition-all tap-target touch-manipulation relative ${
                    activeTab === tab.id
                      ? "bg-white text-stone-900 shadow-sm"
                      : "text-stone-500 hover:text-stone-700"
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
            {activeTab === "overview" && (
              <div className="space-y-5">
                {/* Description */}
                <div>
                  <h3 className="text-xs font-semibold text-stone-400 uppercase tracking-wider mb-2">
                    About this book
                  </h3>
                  <p className="text-sm text-stone-600 leading-relaxed">
                    {descExpanded || book.description.length <= 200
                      ? book.description
                      : book.description.slice(0, 200) + "..."}
                  </p>
                  {book.description.length > 200 && (
                    <button
                      onClick={() => setDescExpanded(!descExpanded)}
                      className="text-xs text-amber-700 hover:text-amber-800 font-medium mt-1.5 transition-colors"
                    >
                      {descExpanded ? "Show less" : "Read more"}
                    </button>
                  )}
                </div>

                {/* Genres & Moods */}
                <div>
                  <h3 className="text-xs font-semibold text-stone-400 uppercase tracking-wider mb-2.5">
                    Genres & Moods
                  </h3>
                  <div className="flex flex-wrap gap-1.5">
                    {book.genre.map((genre) => (
                      <span
                        key={genre}
                        className="bg-stone-100 text-stone-700 text-xs px-3 py-1.5 rounded-full font-medium"
                      >
                        {genre}
                      </span>
                    ))}
                    {book.mood.map((mood) => (
                      <span
                        key={mood}
                        className="bg-amber-50 text-amber-700 text-xs px-3 py-1.5 rounded-full font-medium border border-amber-100"
                      >
                        {mood}
                      </span>
                    ))}
                  </div>
                </div>

                {/* Where to Read */}
                <div>
                  <h3 className="text-xs font-semibold text-stone-400 uppercase tracking-wider mb-2.5">
                    Where to Read
                  </h3>
                  <WhereToRead book={book} />
                </div>

                {/* Existing Review Summary */}
                {existingReview && (
                  <div>
                    <div className="flex items-center justify-between mb-2.5">
                      <h3 className="text-xs font-semibold text-stone-400 uppercase tracking-wider">
                        Your Review
                      </h3>
                      <button
                        onClick={handleEditReview}
                        className="text-xs text-amber-700 hover:text-amber-800 font-medium transition-colors"
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
                  <h3 className="text-xs font-semibold text-stone-400 uppercase tracking-wider mb-2.5">
                    Notes & Highlights
                  </h3>
                  <BookNotes bookId={book.id} compact />
                </div>
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
    </AnimatePresence>
  )
}
