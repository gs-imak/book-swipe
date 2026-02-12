"use client"

import { useState, useEffect } from "react"
import { motion, AnimatePresence } from "framer-motion"
import { X, BookOpen, Star, Clock, Heart, TrendingUp } from "lucide-react"
import { getLikedBooks, getBookReviews, getUserStats, type BookReview } from "@/lib/storage"
import { Book } from "@/lib/book-data"

interface TasteProfileProps {
  isOpen: boolean
  onClose: () => void
}

interface GenreData {
  name: string
  count: number
  percentage: number
  color: string
}

interface MoodData {
  name: string
  count: number
  percentage: number
}

const GENRE_COLORS = [
  "#d97706", "#b45309", "#92400e", "#78350f",
  "#a16207", "#854d0e", "#713f12", "#65a30d",
  "#0d9488", "#0891b2", "#6366f1", "#a855f7",
]

const ARCHETYPES: Record<string, Record<string, string>> = {
  "Fiction": { default: "Story Seeker", "Emotional": "Empathetic Soul", "Epic": "Grand Voyager", "Suspenseful": "Thrill Chaser" },
  "Fantasy": { default: "Dream Weaver", "Epic": "Realm Walker", "Magical": "Enchantment Seeker", "Dark": "Shadow Scholar" },
  "Science Fiction": { default: "Cosmic Explorer", "Thought-provoking": "Visionary Mind", "Epic": "Galaxy Wanderer" },
  "Mystery": { default: "Puzzle Master", "Suspenseful": "Sleuth Extraordinaire", "Dark": "Noir Devotee" },
  "Romance": { default: "Hopeless Romantic", "Emotional": "Heart Collector", "Uplifting": "Love Optimist" },
  "Non-fiction": { default: "Knowledge Seeker", "Inspiring": "Wisdom Hunter", "Thought-provoking": "Deep Thinker" },
  "Horror": { default: "Scare Enthusiast", "Dark": "Shadow Walker", "Suspenseful": "Fear Connoisseur" },
  "Thriller": { default: "Edge Seeker", "Suspenseful": "Adrenaline Junkie", "Dark": "Tension Addict" },
  "Historical": { default: "Time Traveler", "Epic": "Era Explorer", "Emotional": "Past Lives Reader" },
}

function getArchetype(topGenre: string, topMood: string): string {
  // Try exact genre match
  const genreMap = Object.entries(ARCHETYPES).find(([key]) =>
    topGenre.toLowerCase().includes(key.toLowerCase()) || key.toLowerCase().includes(topGenre.toLowerCase())
  )
  if (genreMap) {
    const moodMap = genreMap[1]
    const moodKey = Object.keys(moodMap).find(k => k !== "default" && topMood.toLowerCase().includes(k.toLowerCase()))
    return moodKey ? moodMap[moodKey] : moodMap["default"]
  }
  return "Curious Reader"
}

export function TasteProfile({ isOpen, onClose }: TasteProfileProps) {
  const [likedBooks, setLikedBooks] = useState<Book[]>([])
  const [reviews, setReviews] = useState<BookReview[]>([])

  useEffect(() => {
    if (isOpen) {
      setLikedBooks(getLikedBooks())
      setReviews(getBookReviews())
    }
  }, [isOpen])

  useEffect(() => {
    if (!isOpen) return
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose()
    }
    document.addEventListener("keydown", handleKeyDown)
    return () => document.removeEventListener("keydown", handleKeyDown)
  }, [isOpen, onClose])

  if (!isOpen) return null

  // Compute genre data
  const genreCounts: Record<string, number> = {}
  likedBooks.forEach(book => {
    book.genre.forEach(g => {
      genreCounts[g] = (genreCounts[g] || 0) + 1
    })
  })
  const totalGenreEntries = Object.values(genreCounts).reduce((s, c) => s + c, 0) || 1
  const genreData: GenreData[] = Object.entries(genreCounts)
    .sort((a, b) => b[1] - a[1])
    .slice(0, 8)
    .map(([name, count], i) => ({
      name,
      count,
      percentage: Math.round((count / totalGenreEntries) * 100),
      color: GENRE_COLORS[i % GENRE_COLORS.length],
    }))

  // Compute mood data
  const moodCounts: Record<string, number> = {}
  likedBooks.forEach(book => {
    book.mood.forEach(m => {
      moodCounts[m] = (moodCounts[m] || 0) + 1
    })
  })
  const maxMoodCount = Math.max(...Object.values(moodCounts), 1)
  const moodData: MoodData[] = Object.entries(moodCounts)
    .sort((a, b) => b[1] - a[1])
    .slice(0, 8)
    .map(([name, count]) => ({
      name,
      count,
      percentage: Math.round((count / maxMoodCount) * 100),
    }))

  // Top authors
  const authorCounts: Record<string, number> = {}
  likedBooks.forEach(book => {
    authorCounts[book.author] = (authorCounts[book.author] || 0) + 1
  })
  const topAuthors = Object.entries(authorCounts)
    .sort((a, b) => b[1] - a[1])
    .slice(0, 5)

  // Rating distribution
  const ratingDist = [0, 0, 0, 0, 0] // index 0 = 1 star, index 4 = 5 stars
  reviews.forEach(r => {
    if (r.rating >= 1 && r.rating <= 5) {
      ratingDist[r.rating - 1]++
    }
  })
  const maxRating = Math.max(...ratingDist, 1)

  // Summary stats
  const stats = getUserStats()
  const totalPages = likedBooks.reduce((s, b) => s + b.pages, 0)
  const avgRating = reviews.length > 0
    ? (reviews.reduce((s, r) => s + r.rating, 0) / reviews.length).toFixed(1)
    : "—"

  // Archetype
  const topGenre = genreData.length > 0 ? genreData[0].name : ""
  const topMood = moodData.length > 0 ? moodData[0].name : ""
  const archetype = topGenre ? getArchetype(topGenre, topMood) : "New Reader"

  // SVG donut chart
  const donutRadius = 60
  const donutCircumference = 2 * Math.PI * donutRadius
  let donutOffset = 0

  const fadeIn = (delay: number) => ({
    initial: { opacity: 0, y: 12 },
    animate: { opacity: 1, y: 0 },
    transition: { duration: 0.4, delay },
  })

  return (
    <AnimatePresence>
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
        className="fixed inset-0 bg-background z-50 overflow-y-auto"
      >
        {/* Header */}
        <div className="bg-background/90 backdrop-blur-md border-b border-stone-200/60 sticky top-0 z-10">
          <div className="max-w-2xl mx-auto px-4 sm:px-6 py-3 sm:py-4 flex items-center justify-between">
            <h1 className="text-xl sm:text-2xl font-bold text-stone-900 font-serif">Taste Profile</h1>
            <button
              onClick={onClose}
              className="p-2 rounded-lg hover:bg-stone-100 transition-colors tap-target touch-manipulation"
            >
              <X className="w-5 h-5 text-stone-400" />
            </button>
          </div>
        </div>

        <div className="max-w-2xl mx-auto px-4 sm:px-6 py-6 sm:py-8 space-y-8 pb-24">
          {likedBooks.length === 0 ? (
            <div className="text-center py-16">
              <BookOpen className="w-12 h-12 text-stone-300 mx-auto mb-4" />
              <p className="text-stone-500">Save some books to see your taste profile</p>
            </div>
          ) : (
            <>
              {/* Reader Archetype */}
              <motion.div
                {...fadeIn(0.05)}
                className="text-center py-6"
              >
                <p className="text-xs font-semibold text-amber-600 uppercase tracking-wider mb-2">Your Reader Type</p>
                <h2 className="text-3xl sm:text-4xl font-bold text-stone-900 font-serif">{archetype}</h2>
                <p className="text-sm text-stone-500 mt-2">
                  Based on {likedBooks.length} books in your library
                </p>
              </motion.div>

              {/* Summary Stats */}
              <motion.div {...fadeIn(0.1)} className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                {[
                  { icon: BookOpen, value: likedBooks.length, label: "Books" },
                  { icon: TrendingUp, value: totalPages.toLocaleString(), label: "Pages" },
                  { icon: Star, value: avgRating, label: "Avg Rating" },
                  { icon: Heart, value: reviews.filter(r => r.favorite).length, label: "Favorites" },
                ].map((stat, i) => (
                  <div key={stat.label} className="bg-white rounded-xl p-4 border border-stone-200/60 shadow-sm text-center">
                    <stat.icon className="w-4 h-4 text-amber-600 mx-auto mb-1" />
                    <p className="text-2xl font-bold text-stone-900">{stat.value}</p>
                    <p className="text-xs text-stone-500">{stat.label}</p>
                  </div>
                ))}
              </motion.div>

              {/* Genre Donut Chart */}
              {genreData.length > 0 && (
                <motion.div {...fadeIn(0.18)} className="bg-white rounded-2xl p-5 border border-stone-200/60 shadow-sm">
                  <h3 className="text-sm font-semibold text-stone-400 uppercase tracking-wider mb-4">Genres</h3>
                  <div className="flex flex-col sm:flex-row items-center gap-6">
                    {/* SVG Donut */}
                    <svg width="160" height="160" viewBox="0 0 160 160" className="flex-shrink-0">
                      {genreData.map((genre, i) => {
                        const segmentLength = (genre.percentage / 100) * donutCircumference
                        const gap = 3
                        const currentOffset = donutOffset
                        donutOffset += segmentLength + gap
                        return (
                          <circle
                            key={genre.name}
                            cx="80"
                            cy="80"
                            r={donutRadius}
                            fill="none"
                            stroke={genre.color}
                            strokeWidth="20"
                            strokeDasharray={`${Math.max(0, segmentLength - gap)} ${donutCircumference}`}
                            strokeDashoffset={-currentOffset}
                            strokeLinecap="round"
                            transform="rotate(-90, 80, 80)"
                          />
                        )
                      })}
                      <text x="80" y="76" textAnchor="middle" className="text-2xl font-bold fill-stone-900" fontSize="22">
                        {genreData.length}
                      </text>
                      <text x="80" y="94" textAnchor="middle" className="fill-stone-500" fontSize="11">
                        genres
                      </text>
                    </svg>

                    {/* Legend */}
                    <div className="flex-1 grid grid-cols-2 gap-x-4 gap-y-1.5 w-full">
                      {genreData.map((genre) => (
                        <div key={genre.name} className="flex items-center gap-2">
                          <div className="w-2.5 h-2.5 rounded-full flex-shrink-0" style={{ backgroundColor: genre.color }} />
                          <span className="text-xs text-stone-700 truncate">{genre.name}</span>
                          <span className="text-xs text-stone-400 ml-auto">{genre.percentage}%</span>
                        </div>
                      ))}
                    </div>
                  </div>
                </motion.div>
              )}

              {/* Mood Bar Chart */}
              {moodData.length > 0 && (
                <motion.div {...fadeIn(0.26)} className="bg-white rounded-2xl p-5 border border-stone-200/60 shadow-sm">
                  <h3 className="text-sm font-semibold text-stone-400 uppercase tracking-wider mb-4">Moods</h3>
                  <div className="space-y-2.5">
                    {moodData.map((mood) => (
                      <div key={mood.name} className="flex items-center gap-3">
                        <span className="text-xs text-stone-600 w-24 truncate text-right">{mood.name}</span>
                        <div className="flex-1 h-5 bg-stone-100 rounded-full overflow-hidden">
                          <motion.div
                            initial={{ width: 0 }}
                            animate={{ width: `${mood.percentage}%` }}
                            transition={{ duration: 0.6, delay: 0.3 }}
                            className="h-full bg-gradient-to-r from-amber-400 to-amber-600 rounded-full"
                          />
                        </div>
                        <span className="text-xs text-stone-400 w-6">{mood.count}</span>
                      </div>
                    ))}
                  </div>
                </motion.div>
              )}

              {/* Top Authors */}
              {topAuthors.length > 0 && (
                <motion.div {...fadeIn(0.34)} className="bg-white rounded-2xl p-5 border border-stone-200/60 shadow-sm">
                  <h3 className="text-sm font-semibold text-stone-400 uppercase tracking-wider mb-4">Top Authors</h3>
                  <div className="space-y-2">
                    {topAuthors.map(([author, count], i) => (
                      <div key={author} className="flex items-center gap-3 py-1.5">
                        <span className="w-6 h-6 rounded-full bg-stone-100 flex items-center justify-center text-xs font-bold text-stone-500">
                          {i + 1}
                        </span>
                        <span className="flex-1 text-sm text-stone-800 font-medium">{author}</span>
                        <span className="text-xs text-stone-400">
                          {count} {count === 1 ? "book" : "books"}
                        </span>
                      </div>
                    ))}
                  </div>
                </motion.div>
              )}

              {/* Rating Distribution */}
              {reviews.length > 0 && (
                <motion.div {...fadeIn(0.42)} className="bg-white rounded-2xl p-5 border border-stone-200/60 shadow-sm">
                  <h3 className="text-sm font-semibold text-stone-400 uppercase tracking-wider mb-4">Your Ratings</h3>
                  <div className="space-y-2">
                    {[5, 4, 3, 2, 1].map((stars) => (
                      <div key={stars} className="flex items-center gap-3">
                        <div className="flex items-center gap-0.5 w-16 justify-end">
                          {Array.from({ length: stars }).map((_, i) => (
                            <Star key={i} className="w-3 h-3 text-amber-500 fill-amber-500" />
                          ))}
                        </div>
                        <div className="flex-1 h-4 bg-stone-100 rounded-full overflow-hidden">
                          <motion.div
                            initial={{ width: 0 }}
                            animate={{ width: `${(ratingDist[stars - 1] / maxRating) * 100}%` }}
                            transition={{ duration: 0.5, delay: 0.4 }}
                            className="h-full bg-amber-500 rounded-full"
                          />
                        </div>
                        <span className="text-xs text-stone-400 w-6 text-right">{ratingDist[stars - 1]}</span>
                      </div>
                    ))}
                  </div>
                </motion.div>
              )}
            </>
          )}
        </div>
      </motion.div>
    </AnimatePresence>
  )
}
