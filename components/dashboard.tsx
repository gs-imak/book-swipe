"use client"

import { useState, useEffect } from "react"
import { Book } from "@/lib/book-data"
import { getLikedBooks, clearLikedBooks, addBookToReading } from "@/lib/storage"
import { Button } from "@/components/ui/button"
import { AdminPanel } from "./admin-panel"
import { ReadingProgressTracker } from "./reading-progress"
import { SmartRecommendations } from "./smart-recommendations"
import { BookDetailModal } from "./book-detail-modal"
import { StarRating } from "./star-rating"
import { getBookReview, getUserStats } from "@/lib/storage"
import { useGamification } from "./gamification-provider"
import { ArrowLeft, BookOpen, Star, Clock, Trash2, Settings, Sparkles, Heart, Trophy } from "lucide-react"
import { motion, AnimatePresence } from "framer-motion"
import Image from "next/image"

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

  const { triggerActivity, showAchievementsPanel } = useGamification()

  useEffect(() => {
    setLikedBooks(getLikedBooks())
    setUserStats(getUserStats())
  }, [])

  useEffect(() => {
    setUserStats(getUserStats())
  }, [likedBooks])

  const handleClearAll = () => {
    if (confirm("Are you sure you want to clear all your liked books? This action cannot be undone.")) {
      clearLikedBooks()
      setLikedBooks([])
    }
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

  const filteredBooks = likedBooks.filter(book => {
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

  return (
    <div className="min-h-screen bg-[#FDFBF7] smooth-scroll pb-20">
      {/* Header */}
      <div className="bg-[#FDFBF7]/90 backdrop-blur-md border-b border-stone-200/60 sticky top-0 z-10">
        <div className="max-w-6xl mx-auto px-4 sm:px-6 py-3 sm:py-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3 min-w-0">
              {showBackButton && onBack && (
                <button
                  onClick={onBack}
                  className="p-2 -ml-2 rounded-lg hover:bg-stone-100 transition-colors tap-target touch-manipulation"
                >
                  <ArrowLeft className="w-5 h-5 text-stone-600" />
                </button>
              )}
              <div className="min-w-0">
                <h1
                  className="text-xl sm:text-2xl font-bold text-stone-900 tracking-tight"
                  style={{ fontFamily: "'Georgia', 'Times New Roman', serif" }}
                >
                  My Library
                </h1>
              </div>
            </div>
            <div className="flex items-center gap-2">
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

      <div className="max-w-6xl mx-auto px-4 sm:px-6 py-6 sm:py-8 space-y-6 sm:space-y-8">
        {/* Admin Panel */}
        <AnimatePresence>
          {showAdmin && (
            <motion.div
              initial={{ opacity: 0, height: 0 }}
              animate={{ opacity: 1, height: "auto" }}
              exit={{ opacity: 0, height: 0 }}
              transition={{ duration: 0.2 }}
            >
              <AdminPanel onBooksLoaded={() => {}} />
            </motion.div>
          )}
        </AnimatePresence>

        {likedBooks.length === 0 ? (
          /* Empty State */
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            className="text-center py-16 sm:py-24 px-4"
          >
            <motion.div
              initial={{ scale: 0.8 }}
              animate={{ scale: 1 }}
              transition={{ delay: 0.1, type: "spring", stiffness: 150 }}
              className="w-20 h-20 rounded-2xl bg-amber-50 flex items-center justify-center mx-auto mb-6"
            >
              <BookOpen className="w-10 h-10 text-amber-600" />
            </motion.div>
            <h2
              className="text-2xl sm:text-3xl font-bold text-stone-900 mb-3"
              style={{ fontFamily: "'Georgia', 'Times New Roman', serif" }}
            >
              Your shelf is empty
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
          <>
            {/* Discover CTA */}
            <div className="flex items-center justify-between gap-4 flex-wrap">
              <p className="text-stone-500 text-sm">
                {likedBooks.length} {likedBooks.length === 1 ? "book" : "books"} saved
              </p>
              <Button
                onClick={onStartDiscovery}
                className="h-10 px-5 text-sm bg-stone-900 hover:bg-stone-800 text-white font-medium rounded-xl transition-all shadow-sm tap-target touch-manipulation"
              >
                <Heart className="w-4 h-4 mr-2" />
                Discover More
              </Button>
            </div>

            {/* Inline Stats */}
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
              <div className="bg-white rounded-xl p-4 border border-stone-200/60 shadow-sm">
                <p className="text-2xl font-bold text-stone-900">{stats.totalBooks}</p>
                <p className="text-xs text-stone-500 mt-0.5">Books saved</p>
              </div>
              <div className="bg-white rounded-xl p-4 border border-stone-200/60 shadow-sm">
                <p className="text-2xl font-bold text-stone-900">{stats.totalPages.toLocaleString()}</p>
                <p className="text-xs text-stone-500 mt-0.5">Total pages</p>
              </div>
              <div className="bg-white rounded-xl p-4 border border-stone-200/60 shadow-sm">
                <div className="flex items-center gap-1">
                  <Star className="w-4 h-4 text-amber-500 fill-amber-500" />
                  <span className="text-2xl font-bold text-stone-900">{stats.averageRating}</span>
                </div>
                <p className="text-xs text-stone-500 mt-0.5">Avg rating</p>
              </div>
              <div className="bg-white rounded-xl p-4 border border-stone-200/60 shadow-sm">
                <p className="text-lg font-bold text-stone-900 truncate">{stats.favoriteGenre}</p>
                <p className="text-xs text-stone-500 mt-0.5">Top genre</p>
              </div>
            </div>

            {/* Smart Recommendations */}
            <SmartRecommendations
              onBookLike={(book) => {
                const updatedBooks = [...likedBooks, book]
                setLikedBooks(updatedBooks)
              }}
              onStartReading={addBookToReading}
            />

            {/* Reading Progress */}
            <ReadingProgressTracker onStartReading={onStartDiscovery} />

            {/* Filter & Sort */}
            <div className="space-y-3">
              <div className="flex items-center justify-between">
                <h2
                  className="text-lg font-semibold text-stone-900"
                  style={{ fontFamily: "'Georgia', 'Times New Roman', serif" }}
                >
                  Saved Books
                </h2>
                <span className="text-xs text-stone-400">
                  {sortedBooks.length !== likedBooks.length
                    ? `${sortedBooks.length} of ${likedBooks.length}`
                    : `${likedBooks.length} books`}
                </span>
              </div>

              {/* Genre pills */}
              <div className="flex gap-2 overflow-x-auto hide-scrollbar pb-1">
                <button
                  onClick={() => setFilter("all")}
                  className={`flex-shrink-0 px-3.5 py-1.5 rounded-full text-sm font-medium transition-all ${
                    filter === "all"
                      ? "bg-stone-900 text-white"
                      : "bg-stone-100 text-stone-600 hover:bg-stone-200"
                  }`}
                >
                  All
                </button>
                {genres.slice(0, 8).map(genre => (
                  <button
                    key={genre}
                    onClick={() => setFilter(genre)}
                    className={`flex-shrink-0 px-3.5 py-1.5 rounded-full text-sm font-medium transition-all ${
                      filter === genre
                        ? "bg-stone-900 text-white"
                        : "bg-stone-100 text-stone-600 hover:bg-stone-200"
                    }`}
                  >
                    {genre}
                  </button>
                ))}
              </div>

              {/* Sort pills */}
              <div className="flex gap-1.5">
                {sortOptions.map(opt => (
                  <button
                    key={opt.value}
                    onClick={() => setSortBy(opt.value)}
                    className={`px-3 py-1 rounded-lg text-xs font-medium transition-all ${
                      sortBy === opt.value
                        ? "bg-amber-100 text-amber-800"
                        : "text-stone-400 hover:text-stone-600 hover:bg-stone-50"
                    }`}
                  >
                    {opt.label}
                  </button>
                ))}
              </div>
            </div>

            {/* Books Grid */}
            <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 gap-4 sm:gap-5">
              {sortedBooks.map((book, index) => {
                const review = getBookReview(book.id)
                return (
                  <motion.div
                    key={book.id}
                    initial={{ opacity: 0, y: 16 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ delay: Math.min(index * 0.05, 0.5) }}
                    className="group cursor-pointer"
                    onClick={() => handleBookClick(book)}
                  >
                    {/* Cover */}
                    <div className="relative aspect-[2/3] rounded-lg overflow-hidden bg-stone-100 mb-2.5 shadow-sm group-hover:shadow-md transition-shadow">
                      <Image
                        src={book.cover}
                        alt={book.title}
                        fill
                        className="object-cover"
                        sizes="(max-width: 640px) 50vw, (max-width: 1024px) 33vw, 20vw"
                      />
                      {/* Rating badge */}
                      <div className="absolute top-2 right-2 bg-white/90 backdrop-blur-sm px-1.5 py-0.5 rounded-md flex items-center gap-0.5">
                        <Star className="w-3 h-3 text-amber-500 fill-amber-500" />
                        <span className="text-xs font-semibold text-stone-700">{book.rating}</span>
                      </div>
                      {/* Favorite heart */}
                      {review?.favorite && (
                        <div className="absolute top-2 left-2">
                          <Heart className="w-4 h-4 text-red-500 fill-red-500 drop-shadow-sm" />
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
                      <div className="flex items-center gap-2 text-[11px] text-stone-400 pt-0.5">
                        <span>{book.pages}p</span>
                        <span className="w-0.5 h-0.5 rounded-full bg-stone-300" />
                        <span>{book.readingTime}</span>
                      </div>
                    </div>
                  </motion.div>
                )
              })}
            </div>
          </>
        )}
      </div>

      {/* Book Detail Modal */}
      <BookDetailModal
        book={selectedBook}
        isOpen={isBookModalOpen}
        onClose={handleCloseModal}
        onStartReading={addBookToReading}
      />
    </div>
  )
}
