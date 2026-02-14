"use client"

import { useState, useEffect } from "react"
import { Button } from "@/components/ui/button"
import { Book } from "@/lib/book-data"
import { addBookToReading, saveLikedBooks, getLikedBooks } from "@/lib/storage"
import {
  moodFilters,
  timeBasedSuggestions,
  getSmartRecommendations,
  getDiverseRecommendations,
} from "../lib/recommendations"
import { getCachedBooks } from "@/lib/book-cache"
import { Star, Clock, BookOpen, Heart, Sparkles, Zap } from "lucide-react"
import { motion } from "framer-motion"
import { BookCover } from "@/components/book-cover"
import { useGamification } from "./gamification-provider"
import { useToast } from "./toast-provider"

interface SmartRecommendationsProps {
  onBookLike?: (book: Book) => void
  onStartReading?: (book: Book) => void
}

export function SmartRecommendations({ onBookLike, onStartReading }: SmartRecommendationsProps) {
  const [recommendations, setRecommendations] = useState<Book[]>([])
  const [diverseBooks, setDiverseBooks] = useState<Book[]>([])
  const [selectedMood, setSelectedMood] = useState<string | null>(null)
  const [selectedTime, setSelectedTime] = useState<string | null>(null)
  const [filteredBooks, setFilteredBooks] = useState<Book[]>([])
  const [likedBooks, setLikedBooks] = useState<Book[]>([])
  const [isLoading, setIsLoading] = useState(true)
  const { triggerActivity } = useGamification()
  const { showToast } = useToast()

  useEffect(() => {
    async function loadRecommendations() {
      setIsLoading(true)
      const liked = getLikedBooks()
      setLikedBooks(liked)

      if (liked.length > 0) {
        try {
          const smartRecs = await getSmartRecommendations(8)
          setRecommendations(smartRecs)
          const diverseRecs = getDiverseRecommendations(6)
          setDiverseBooks(diverseRecs)
        } catch {
          const cached = getCachedBooks()
          setRecommendations(cached.sort((a, b) => b.rating - a.rating).slice(0, 8))
        }
      }
      setIsLoading(false)
    }
    loadRecommendations()
  }, [])

  const handleMoodFilter = (moodId: string) => {
    const mood = moodFilters.find(m => m.id === moodId)
    if (mood) {
      setSelectedMood(moodId === selectedMood ? null : moodId)
      setSelectedTime(null)
      if (moodId === selectedMood) {
        setFilteredBooks([])
        return
      }
      const filtered = recommendations.filter(book =>
        book.mood.some(bookMood =>
          mood.keywords.some(keyword =>
            bookMood.toLowerCase().includes(keyword.toLowerCase())
          )
        )
      )
      setFilteredBooks(filtered)
    }
  }

  const handleTimeFilter = (timeId: string) => {
    const timeConstraint = timeBasedSuggestions.find(t => t.id === timeId)
    if (timeConstraint) {
      setSelectedTime(timeId === selectedTime ? null : timeId)
      setSelectedMood(null)
      if (timeId === selectedTime) {
        setFilteredBooks([])
        return
      }
      const filtered = recommendations.filter(book => {
        const hours = parseInt(book.readingTime.split('-')[0]) || 0
        if (timeConstraint.maxHours && !timeConstraint.minHours) return hours <= timeConstraint.maxHours
        if (timeConstraint.minHours && !timeConstraint.maxHours) return hours >= timeConstraint.minHours
        if (timeConstraint.minHours && timeConstraint.maxHours) return hours >= timeConstraint.minHours && hours <= timeConstraint.maxHours
        return true
      })
      setFilteredBooks(filtered)
    }
  }

  const handleLikeBook = (book: Book) => {
    const updatedLiked = [...likedBooks, book]
    setLikedBooks(updatedLiked)
    saveLikedBooks(updatedLiked)
    triggerActivity('like_book')
    showToast(`"${book.title}" saved to library`)
    onBookLike?.(book)
  }

  if (likedBooks.length === 0) {
    // Show popular books from cache for new users
    const cachedBooks = getCachedBooks()
    const popular = cachedBooks
      .sort((a, b) => b.rating - a.rating)
      .slice(0, 6)

    if (popular.length === 0) return null

    return (
      <div className="space-y-6">
        <div>
          <div className="flex items-center gap-2 mb-3 px-0.5">
            <Sparkles className="w-4 h-4 text-amber-600" />
            <h3 className="text-sm font-semibold text-stone-900">Popular Books</h3>
          </div>
          <p className="text-xs text-stone-400 mb-3 px-0.5">Like a few books to get personalized recommendations</p>
          <div className="overflow-x-auto hide-scrollbar -mx-4 px-4">
            <div className="flex gap-3 pb-2">
              {popular.map((book, index) => (
                <MiniBookCard
                  key={book.id}
                  book={book}
                  onLike={handleLikeBook}
                  isLiked={false}
                  index={index}
                />
              ))}
            </div>
          </div>
        </div>
      </div>
    )
  }

  if (isLoading) {
    return (
      <div className="space-y-6">
        <div className="bg-white rounded-xl p-4 sm:p-5 border border-stone-200/60 shadow-sm">
          <div className="h-4 w-28 bg-stone-200 rounded animate-pulse mb-3" />
          <div className="flex gap-2">
            {Array.from({ length: 4 }).map((_, i) => (
              <div key={i} className="h-8 w-20 bg-stone-100 rounded-full animate-pulse" />
            ))}
          </div>
        </div>
        <div>
          <div className="h-4 w-20 bg-stone-200 rounded animate-pulse mb-3" />
          <div className="flex gap-3 overflow-hidden">
            {Array.from({ length: 4 }).map((_, i) => (
              <div key={i} className="flex-shrink-0 w-[130px] sm:w-[150px]">
                <div className="w-full aspect-[2/3] rounded-lg bg-stone-200 animate-pulse mb-2" />
                <div className="h-3 w-24 bg-stone-200 rounded animate-pulse mb-1" />
                <div className="h-3 w-16 bg-stone-100 rounded animate-pulse" />
              </div>
            ))}
          </div>
        </div>
      </div>
    )
  }

  return (
    <div className="space-y-6">
      {/* Mood & Time Filters */}
      <div className="bg-white rounded-xl p-4 sm:p-5 border border-stone-200/60 shadow-sm">
        <h3 className="text-sm font-semibold text-stone-900 mb-3">Filter by mood</h3>
        <div className="flex gap-2 overflow-x-auto hide-scrollbar pb-1">
          {moodFilters.map((mood) => (
            <button
              key={mood.id}
              onClick={() => handleMoodFilter(mood.id)}
              className={`flex-shrink-0 flex items-center gap-1.5 px-3 py-1.5 rounded-full text-sm font-medium transition-all ${
                selectedMood === mood.id
                  ? "bg-stone-900 text-white"
                  : "bg-stone-100 text-stone-600 hover:bg-stone-200"
              }`}
            >
              <span className="text-sm">{mood.emoji}</span>
              {mood.name}
            </button>
          ))}
        </div>

        <div className="mt-3 pt-3 border-t border-stone-50">
          <div className="flex items-center gap-2 mb-2">
            <Clock className="w-3.5 h-3.5 text-stone-400" />
            <span className="text-xs font-medium text-stone-500">How much time?</span>
          </div>
          <div className="flex gap-1.5 overflow-x-auto hide-scrollbar">
            {timeBasedSuggestions.map((time) => (
              <button
                key={time.id}
                onClick={() => handleTimeFilter(time.id)}
                className={`flex-shrink-0 px-3 py-1.5 rounded-full text-xs font-medium transition-all ${
                  selectedTime === time.id
                    ? "bg-stone-900 text-white"
                    : "bg-stone-100 text-stone-500 hover:bg-stone-200"
                }`}
              >
                {time.emoji} {time.name}
              </button>
            ))}
          </div>
        </div>
      </div>

      {/* Filtered results */}
      {filteredBooks.length > 0 && (
        <div>
          <h3 className="text-sm font-semibold text-stone-900 mb-3 px-0.5">
            {selectedMood && `${moodFilters.find(m => m.id === selectedMood)?.name} Books`}
            {selectedTime && `${timeBasedSuggestions.find(t => t.id === selectedTime)?.name} Reads`}
          </h3>
          <div className="overflow-x-auto hide-scrollbar -mx-4 px-4">
            <div className="flex gap-3 pb-2">
              {filteredBooks.slice(0, 6).map((book, index) => (
                <MiniBookCard
                  key={book.id}
                  book={book}
                  onLike={handleLikeBook}
                  isLiked={likedBooks.some(l => l.id === book.id)}
                  index={index}
                />
              ))}
            </div>
          </div>
        </div>
      )}

      {/* Smart recommendations */}
      {recommendations.length > 0 && !selectedMood && !selectedTime && (
        <div>
          <div className="flex items-center justify-between mb-3 px-0.5">
            <div className="flex items-center gap-2">
              <Sparkles className="w-4 h-4 text-amber-600" />
              <h3 className="text-sm font-semibold text-stone-900">For You</h3>
            </div>
            <span className="text-[11px] text-stone-400">Based on your likes</span>
          </div>
          <div className="overflow-x-auto hide-scrollbar -mx-4 px-4">
            <div className="flex gap-3 pb-2">
              {recommendations.slice(0, 6).map((book, index) => (
                <MiniBookCard
                  key={book.id}
                  book={book}
                  onLike={handleLikeBook}
                  isLiked={likedBooks.some(l => l.id === book.id)}
                  index={index}
                  reason={(book as any).reasons?.[0]?.description}
                />
              ))}
            </div>
          </div>
        </div>
      )}

      {/* Diverse recommendations */}
      {diverseBooks.length > 0 && !selectedMood && !selectedTime && (
        <div>
          <div className="flex items-center gap-2 mb-3 px-0.5">
            <Zap className="w-4 h-4 text-teal-600" />
            <h3 className="text-sm font-semibold text-stone-900">Try Something New</h3>
          </div>
          <div className="overflow-x-auto hide-scrollbar -mx-4 px-4">
            <div className="flex gap-3 pb-2">
              {diverseBooks.slice(0, 6).map((book, index) => (
                <MiniBookCard
                  key={book.id}
                  book={book}
                  onLike={handleLikeBook}
                  isLiked={likedBooks.some(l => l.id === book.id)}
                  index={index}
                  reason="New genre for you"
                />
              ))}
            </div>
          </div>
        </div>
      )}
    </div>
  )
}

function MiniBookCard({
  book,
  onLike,
  isLiked,
  index,
  reason,
}: {
  book: Book
  onLike: (book: Book) => void
  isLiked: boolean
  index?: number
  reason?: string
}) {
  return (
    <motion.div
      className="flex-shrink-0 w-[130px] sm:w-[150px]"
      initial={{ opacity: 0, x: 12 }}
      animate={{ opacity: 1, x: 0 }}
      transition={{ type: "spring", stiffness: 300, damping: 28, delay: Math.min((index || 0) * 0.03, 0.2) }}
    >
      {/* Cover */}
      <div className="relative w-full aspect-[2/3] rounded-lg overflow-hidden bg-stone-200 mb-2 shadow-sm">
        <BookCover
          src={book.cover}
          fallbackSrc={book.coverFallback}
          alt={book.title}
          fill
          className="object-contain"
          sizes="(max-width: 640px) 260px, 300px"
        />
        <div className="absolute top-1.5 right-1.5 bg-white/90 backdrop-blur-sm px-1.5 py-0.5 rounded-md flex items-center gap-0.5">
          <Star className="w-2.5 h-2.5 fill-amber-500 text-amber-500" />
          <span className="text-[10px] font-bold text-stone-700">{book.rating}</span>
        </div>
      </div>

      {/* Info */}
      <div className="px-0.5">
        <h4 className="font-semibold text-xs text-stone-900 line-clamp-1 leading-tight">{book.title}</h4>
        <p className="text-xs text-stone-400 mb-1.5 truncate">{book.author}</p>

        {reason && (
          <p className="text-[10px] text-amber-700 mb-1.5 line-clamp-1">{reason}</p>
        )}

        <button
          onClick={() => onLike(book)}
          disabled={isLiked}
          className={`w-full flex items-center justify-center gap-1 py-1.5 rounded-lg text-xs font-medium transition-all min-h-[32px] ${
            isLiked
              ? "bg-stone-100 text-stone-400"
              : "bg-stone-900 text-white hover:bg-stone-800 active:scale-[0.98]"
          }`}
        >
          <Heart className={`w-3 h-3 ${isLiked ? 'fill-current' : ''}`} />
          {isLiked ? 'Saved' : 'Save'}
        </button>
      </div>
    </motion.div>
  )
}
