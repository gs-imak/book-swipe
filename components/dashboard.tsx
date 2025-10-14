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
import { ArrowLeft, BookOpen, Star, Clock, Trash2, ExternalLink, Filter, Settings, Sparkles, Heart, Trophy, TrendingUp, Target } from "lucide-react"
import { motion } from "framer-motion"
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
    // Update stats when liked books change
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
    // Trigger interaction activity
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
        return 0 // Keep original order for "recent"
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

  return (
    <div className="min-h-screen bg-gradient-to-br from-purple-50 to-pink-50 dark:from-gray-900 dark:to-gray-800 smooth-scroll">
      {/* Header */}
      <div className="bg-white/80 backdrop-blur-sm border-b sticky top-0 z-10">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 py-4">
          <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
            <div className="flex items-center gap-3 sm:gap-4">
              {showBackButton && onBack && (
                <Button variant="outline" size="sm" onClick={onBack} className="flex-shrink-0">
                  <ArrowLeft className="w-4 h-4 sm:mr-2" />
                  <span className="hidden sm:inline">Back to Swipe</span>
                </Button>
              )}
              <div className="min-w-0">
                <h1 className="text-xl sm:text-2xl font-bold bg-gradient-to-r from-purple-600 to-pink-600 bg-clip-text text-transparent">
                  My Reading Library
                </h1>
                <p className="text-xs sm:text-sm text-gray-600">
                  {likedBooks.length} books in your collection
                </p>
              </div>
            </div>
            <div className="flex gap-2 self-start sm:self-auto">
              <Button 
                variant="outline" 
                size="sm" 
                onClick={() => setShowAdmin(!showAdmin)}
                className="flex-shrink-0"
              >
                <Settings className="w-4 h-4 sm:mr-2" />
                <span className="hidden sm:inline">{showAdmin ? 'Hide' : 'API Settings'}</span>
              </Button>
              {likedBooks.length > 0 && (
                <Button variant="destructive" size="sm" onClick={handleClearAll} className="flex-shrink-0">
                  <Trash2 className="w-4 h-4 sm:mr-2" />
                  <span className="hidden sm:inline">Clear All</span>
                </Button>
              )}
            </div>
          </div>
        </div>
      </div>

      {/* Gamification Stats Header */}
      <div className="bg-gradient-to-r from-purple-100 to-pink-100 border-b">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 py-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-6">
              <div className="flex items-center gap-3">
                <div className="w-12 h-12 bg-gradient-to-br from-purple-500 to-pink-500 rounded-full flex items-center justify-center">
                  <Trophy className="w-6 h-6 text-white" />
                </div>
                <div>
                  <p className="text-lg font-bold text-gray-900">Level {userStats.level}</p>
                  <p className="text-sm text-gray-600">{userStats.totalPoints} XP</p>
                </div>
              </div>
              
              <div className="hidden sm:flex items-center gap-6">
                <div className="flex items-center gap-2">
                  <TrendingUp className="w-5 h-5 text-green-600" />
                  <div>
                    <p className="font-semibold text-gray-900">{userStats.currentStreak}</p>
                    <p className="text-xs text-gray-500">Day streak</p>
                  </div>
                </div>
                
                <div className="flex items-center gap-2">
                  <Target className="w-5 h-5 text-blue-600" />
                  <div>
                    <p className="font-semibold text-gray-900">{userStats.totalBooksRead}</p>
                    <p className="text-xs text-gray-500">Books read</p>
                  </div>
                </div>
                
                <div className="flex items-center gap-2">
                  <Star className="w-5 h-5 text-yellow-600" />
                  <div>
                    <p className="font-semibold text-gray-900">{userStats.totalReviews}</p>
                    <p className="text-xs text-gray-500">Reviews</p>
                  </div>
                </div>
              </div>
            </div>
            
            <Button
              variant="outline"
              onClick={showAchievementsPanel}
              className="bg-white/50 hover:bg-white/80 border-purple-200"
            >
              <Trophy className="w-4 h-4 mr-2 text-purple-600" />
              Achievements
            </Button>
          </div>
        </div>
      </div>

      <div className="max-w-7xl mx-auto px-4 sm:px-6 py-6 sm:py-8">
        {/* Discover More Books Button - Always at top when user has books */}
        {likedBooks.length > 0 && (
          <div className="mb-8 text-center">
            <Button 
              onClick={onStartDiscovery} 
              className="px-8 py-3 bg-gradient-to-r from-purple-500 to-pink-500 hover:from-purple-600 hover:to-pink-600 text-white font-medium rounded-xl transition-all duration-300 shadow-lg"
            >
              <Heart className="w-5 h-5 mr-2" />
              Discover More Books
            </Button>
          </div>
        )}

        {/* Smart Recommendations - Only show if user has liked books */}
        {likedBooks.length > 0 && (
          <div className="mb-8">
            <SmartRecommendations 
              onBookLike={(book) => {
                const updatedBooks = [...likedBooks, book]
                setLikedBooks(updatedBooks)
              }}
              onStartReading={addBookToReading}
            />
          </div>
        )}

        {/* Reading Progress Tracker - Only show if user has liked books */}
        {likedBooks.length > 0 && (
          <div className="mb-8">
            <ReadingProgressTracker onStartReading={onStartDiscovery} />
          </div>
        )}

        {/* Admin Panel */}
        {showAdmin && (
          <div className="mb-8">
            <AdminPanel onBooksLoaded={() => {}} />
          </div>
        )}

        {likedBooks.length === 0 ? (
          <div className="text-center py-16">
            <motion.div
              initial={{ scale: 0 }}
              animate={{ scale: 1 }}
              transition={{ type: "spring", delay: 0.2 }}
            >
              <BookOpen className="w-16 h-16 text-gray-300 mx-auto mb-4" />
            </motion.div>
            <motion.h2 
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.3 }}
              className="text-2xl font-bold text-gray-600 mb-2"
            >
              Welcome to Your Library!
            </motion.h2>
            <motion.p 
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.4 }}
              className="text-gray-500 mb-8 max-w-md mx-auto"
            >
              Your personal reading collection is empty. Start discovering books tailored to your taste and build your perfect library.
            </motion.p>
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.5 }}
            >
              <Button 
                onClick={onStartDiscovery} 
                className="px-8 py-3 bg-gradient-to-r from-purple-500 to-pink-500 hover:from-purple-600 hover:to-pink-600 text-white font-medium rounded-xl transition-all duration-300"
              >
                <Sparkles className="w-5 h-5 mr-2" />
                Start Discovering Books
              </Button>
            </motion.div>
          </div>
        ) : (
          <>
            {/* Stats Section */}
            <div className="grid grid-cols-1 md:grid-cols-4 gap-4 mb-8">
              <div className="bg-white rounded-2xl p-6 shadow-sm">
                <div className="text-2xl font-bold text-purple-600">{stats.totalBooks}</div>
                <div className="text-sm text-gray-600">Books Liked</div>
              </div>
              <div className="bg-white rounded-2xl p-6 shadow-sm">
                <div className="text-2xl font-bold text-green-600">{stats.totalPages.toLocaleString()}</div>
                <div className="text-sm text-gray-600">Total Pages</div>
              </div>
              <div className="bg-white rounded-2xl p-6 shadow-sm">
                <div className="text-2xl font-bold text-yellow-600 flex items-center gap-1">
                  <Star className="w-5 h-5 fill-current" />
                  {stats.averageRating}
                </div>
                <div className="text-sm text-gray-600">Avg Rating</div>
              </div>
              <div className="bg-white rounded-2xl p-6 shadow-sm">
                <div className="text-2xl font-bold text-blue-600">{stats.favoriteGenre}</div>
                <div className="text-sm text-gray-600">Top Genre</div>
              </div>
            </div>

            {/* Enhanced Filters and Sort */}
            <motion.div 
              className="bg-white/90 backdrop-blur-xl rounded-3xl p-6 mb-8 shadow-lg border border-white/20"
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.2 }}
            >
              <div className="flex flex-col lg:flex-row gap-6 items-start lg:items-center">
                {/* Filter Section */}
                <div className="flex items-center gap-3 flex-1">
                  <div className="p-2 bg-gradient-to-br from-purple-100 to-pink-100 rounded-xl">
                    <Filter className="w-5 h-5 text-purple-600" />
                  </div>
                  <div className="flex flex-col sm:flex-row gap-3 flex-1">
                    <div className="flex items-center gap-3">
                      <span className="text-sm font-semibold text-gray-700 whitespace-nowrap">Filter by genre:</span>
                      <div className="relative">
                        <select 
                          value={filter} 
                          onChange={(e) => setFilter(e.target.value)}
                          className="appearance-none bg-white/80 backdrop-blur-sm border border-purple-200 rounded-xl px-4 py-2.5 pr-10 text-sm font-medium text-gray-700 hover:border-purple-300 focus:outline-none focus:ring-2 focus:ring-purple-400 focus:border-transparent transition-all duration-300 shadow-sm"
                        >
                          <option value="all">All Genres</option>
                          {genres.map(genre => (
                            <option key={genre} value={genre}>{genre}</option>
                          ))}
                        </select>
                        <div className="absolute inset-y-0 right-0 flex items-center pr-3 pointer-events-none">
                          <svg className="w-4 h-4 text-purple-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                          </svg>
                        </div>
                      </div>
                    </div>
                  </div>
                </div>

                {/* Sort Section */}
                <div className="flex items-center gap-3">
                  <div className="p-2 bg-gradient-to-br from-green-100 to-emerald-100 rounded-xl">
                    <svg className="w-5 h-5 text-green-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 4h13M3 8h9m-9 4h6m4 0l4-4m0 0l4 4m-4-4v12" />
                    </svg>
                  </div>
                  <div className="flex items-center gap-3">
                    <span className="text-sm font-semibold text-gray-700 whitespace-nowrap">Sort by:</span>
                    <div className="relative">
                      <select 
                        value={sortBy} 
                        onChange={(e) => setSortBy(e.target.value as "recent" | "rating" | "pages")}
                        className="appearance-none bg-white/80 backdrop-blur-sm border border-green-200 rounded-xl px-4 py-2.5 pr-10 text-sm font-medium text-gray-700 hover:border-green-300 focus:outline-none focus:ring-2 focus:ring-green-400 focus:border-transparent transition-all duration-300 shadow-sm"
                      >
                        <option value="recent">Recently Added</option>
                        <option value="rating">Highest Rated</option>
                        <option value="pages">Shortest First</option>
                      </select>
                      <div className="absolute inset-y-0 right-0 flex items-center pr-3 pointer-events-none">
                        <svg className="w-4 h-4 text-green-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                        </svg>
                      </div>
                    </div>
                  </div>
                </div>

                {/* Active Filter Indicator */}
                {filter !== "all" && (
                  <motion.div
                    initial={{ opacity: 0, scale: 0.8 }}
                    animate={{ opacity: 1, scale: 1 }}
                    className="flex items-center gap-2 bg-gradient-to-r from-purple-100 to-pink-100 px-3 py-2 rounded-xl border border-purple-200"
                  >
                    <span className="text-xs font-medium text-purple-700">Active: {filter}</span>
                    <button
                      onClick={() => setFilter("all")}
                      className="w-4 h-4 rounded-full bg-purple-200 hover:bg-purple-300 flex items-center justify-center transition-colors"
                    >
                      <svg className="w-2.5 h-2.5 text-purple-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                      </svg>
                    </button>
                  </motion.div>
                )}
              </div>

              {/* Filter Summary */}
              <motion.div 
                className="mt-4 pt-4 border-t border-gray-100"
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                transition={{ delay: 0.4 }}
              >
                <div className="flex items-center justify-between text-xs text-gray-500">
                  <span>
                    Showing {sortedBooks.length} of {likedBooks.length} books
                    {filter !== "all" && ` in ${filter}`}
                  </span>
                  <div className="flex items-center gap-2">
                    <div className="w-2 h-2 bg-gradient-to-r from-purple-400 to-pink-400 rounded-full animate-pulse"></div>
                    <span>Updated just now</span>
                  </div>
                </div>
              </motion.div>
            </motion.div>

            {/* Books Grid */}
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6">
              {sortedBooks.map((book, index) => {
                const review = getBookReview(book.id)
                return (
                  <motion.div
                    key={book.id}
                    initial={{ opacity: 0, y: 20 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ delay: index * 0.1 }}
                    className="bg-white rounded-2xl shadow-lg overflow-hidden hover:shadow-xl transition-all duration-300 cursor-pointer group"
                    onClick={() => handleBookClick(book)}
                  >
                  <div className="relative h-64">
                    <Image
                      src={book.cover}
                      alt={book.title}
                      fill
                      className="object-cover"
                      sizes="(max-width: 768px) 100vw, (max-width: 1200px) 50vw, 25vw"
                    />
                    <div className="absolute top-3 right-3 bg-white/90 text-black px-2 py-1 rounded-full flex items-center gap-1">
                      <Star className="w-3 h-3 fill-yellow-400 text-yellow-400" />
                      <span className="text-xs font-medium">{book.rating}</span>
                    </div>
                  </div>
                  
                  <div className="p-4 space-y-3">
                    <div>
                      <h3 className="font-bold text-gray-900 line-clamp-2 mb-1 group-hover:text-purple-600 transition-colors">
                        {book.title}
                      </h3>
                      <p className="text-gray-600 text-sm font-medium">{book.author}</p>
                    </div>

                    {/* User Review */}
                    {review && (
                      <div className="flex items-center justify-between py-2 px-3 bg-purple-50 rounded-lg">
                        <StarRating rating={review.rating} readonly size="sm" />
                        {review.favorite && (
                          <Heart className="w-4 h-4 text-red-500 fill-red-500" />
                        )}
                      </div>
                    )}

                    <div className="flex items-center gap-3 text-xs text-gray-500">
                      <div className="flex items-center gap-1">
                        <BookOpen className="w-3 h-3" />
                        <span>{book.pages}p</span>
                      </div>
                      <div className="flex items-center gap-1">
                        <Clock className="w-3 h-3" />
                        <span>{book.readingTime}</span>
                      </div>
                    </div>

                    <div className="flex flex-wrap gap-1">
                      {book.genre.slice(0, 2).map((genre) => (
                        <span
                          key={genre}
                          className="bg-purple-100 text-purple-700 text-xs px-2 py-1 rounded-full"
                        >
                          {genre}
                        </span>
                      ))}
                    </div>

                    <p className="text-gray-700 text-xs line-clamp-2">
                      {book.description}
                    </p>

                    <div className="flex gap-2">
                      <Button 
                        size="sm" 
                        variant="outline" 
                        className="flex-1 text-xs"
                        onClick={(e) => {
                          e.stopPropagation()
                          handleBookClick(book)
                        }}
                      >
                        {review ? <MessageSquare className="w-3 h-3 mr-1" /> : <Star className="w-3 h-3 mr-1" />}
                        {review ? 'Review' : 'Rate'}
                      </Button>
                      <Button 
                        size="sm" 
                        className="flex-1 text-xs bg-gradient-to-r from-green-500 to-emerald-600 hover:from-green-600 hover:to-emerald-700"
                        onClick={(e) => {
                          e.stopPropagation()
                          addBookToReading(book)
                        }}
                      >
                        <BookOpen className="w-3 h-3 mr-1" />
                        Read
                      </Button>
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
