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
import { Star, Clock, BookOpen, Heart, Sparkles, Zap, Brain, Coffee } from "lucide-react"
import { motion } from "framer-motion"
import Image from "next/image"
import { useGamification } from "./gamification-provider"

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

  useEffect(() => {
    async function loadRecommendations() {
      setIsLoading(true)
      const liked = getLikedBooks()
      setLikedBooks(liked)

      if (liked.length > 0) {
        try {
          // TF-IDF powered smart recommendations
          const smartRecs = await getSmartRecommendations(8)
          setRecommendations(smartRecs)

          // Diverse recommendations from full pool
          const diverseRecs = getDiverseRecommendations(6)
          setDiverseBooks(diverseRecs)
        } catch (error) {
          console.error('Error loading recommendations:', error)
          // Fallback: use cached books sorted by rating
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
      setSelectedMood(moodId)
      setSelectedTime(null)
      // Filter from existing recommendations by mood keywords
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
      setSelectedTime(timeId)
      setSelectedMood(null)
      // Filter from existing recommendations by reading time
      const filtered = recommendations.filter(book => {
        const hours = parseInt(book.readingTime.split('-')[0]) || 0
        if (timeConstraint.maxHours && !timeConstraint.minHours) {
          return hours <= timeConstraint.maxHours
        } else if (timeConstraint.minHours && !timeConstraint.maxHours) {
          return hours >= timeConstraint.minHours
        } else if (timeConstraint.minHours && timeConstraint.maxHours) {
          return hours >= timeConstraint.minHours && hours <= timeConstraint.maxHours
        }
        return true
      })
      setFilteredBooks(filtered)
    }
  }

  const handleLikeBook = (book: Book) => {
    const updatedLiked = [...likedBooks, book]
    setLikedBooks(updatedLiked)
    saveLikedBooks(updatedLiked)
    // Update achievements/progress
    triggerActivity('like_book')
    onBookLike?.(book)
  }

  const clearFilters = () => {
    setSelectedMood(null)
    setSelectedTime(null)
    setFilteredBooks([])
  }

  if (likedBooks.length === 0) {
    return null // Don't show recommendations until user has liked books
  }

  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-12">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-purple-500 mx-auto mb-4"></div>
          <p className="text-gray-600">Loading recommendations...</p>
        </div>
      </div>
    )
  }

  return (
    <div className="space-y-8">
      {/* Quick Mood Filters */}
      <motion.div 
        className="bg-white/90 backdrop-blur-xl rounded-3xl p-6 shadow-lg border border-white/20"
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
      >
        <div className="flex items-center gap-3 mb-4">
          <div className="p-2 bg-gradient-to-br from-blue-400 to-indigo-500 rounded-xl">
            <Brain className="w-5 h-5 text-white" />
          </div>
          <h3 className="text-lg font-bold text-gray-800">What's Your Mood?</h3>
        </div>
        
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3 mb-4">
          {moodFilters.map((mood) => (
            <Button
              key={mood.id}
              variant={selectedMood === mood.id ? "default" : "outline"}
              onClick={() => handleMoodFilter(mood.id)}
              className="h-auto p-3 flex flex-col items-start gap-1 text-left w-full"
            >
              <div className="flex items-center gap-2 w-full">
                <span className="text-base sm:text-lg">{mood.emoji}</span>
                <span className="font-semibold text-xs sm:text-sm flex-1">{mood.name}</span>
              </div>
              <span className="text-xs text-gray-500 leading-tight">{mood.description}</span>
            </Button>
          ))}
        </div>

        {/* Time-based suggestions */}
        <div className="border-t pt-4">
          <div className="flex items-center gap-2 mb-3">
            <Clock className="w-4 h-4 text-gray-500" />
            <span className="text-sm font-medium text-gray-700">How much time do you have?</span>
          </div>
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
            {timeBasedSuggestions.map((time) => (
              <Button
                key={time.id}
                variant={selectedTime === time.id ? "default" : "outline"}
                size="sm"
                onClick={() => handleTimeFilter(time.id)}
                className="h-auto p-2 flex flex-col gap-1 text-center"
              >
                <div className="flex flex-col sm:flex-row items-center gap-1">
                  <span className="text-sm">{time.emoji}</span>
                  <span className="text-xs font-medium leading-tight">{time.name}</span>
                </div>
              </Button>
            ))}
          </div>
        </div>

        {(selectedMood || selectedTime) && (
          <div className="mt-4 flex justify-center">
            <Button variant="outline" size="sm" onClick={clearFilters}>
              Clear Filters
            </Button>
          </div>
        )}
      </motion.div>

      {/* Filtered Results */}
      {filteredBooks.length > 0 && (
        <motion.div 
          className="bg-white/90 backdrop-blur-xl rounded-3xl p-6 shadow-lg border border-white/20"
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.1 }}
        >
          <h3 className="text-lg font-bold text-gray-800 mb-4">
            {selectedMood && `${moodFilters.find(m => m.id === selectedMood)?.name} Books`}
            {selectedTime && `${timeBasedSuggestions.find(t => t.id === selectedTime)?.name} Options`}
          </h3>
          
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
            {filteredBooks.slice(0, 6).map((book) => (
              <BookRecommendationCard 
                key={book.id} 
                book={book} 
                onLike={handleLikeBook}
                onStartReading={onStartReading}
                isLiked={likedBooks.some(liked => liked.id === book.id)}
              />
            ))}
          </div>
        </motion.div>
      )}

      {/* Smart Recommendations based on liked books */}
      {recommendations.length > 0 && !selectedMood && !selectedTime && (
        <motion.div 
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.2 }}
        >
          <div className="flex items-center justify-between mb-3 px-1">
            <div className="flex items-center gap-2">
              <Sparkles className="w-5 h-5 text-purple-600" />
              <h3 className="text-base font-bold text-gray-900">Recommended for You</h3>
            </div>
            <span className="text-xs bg-purple-100 text-purple-700 px-2 py-1 rounded-full">
              Based on your likes
            </span>
          </div>
          
          {/* Horizontal Scroll for Mobile */}
          <div className="overflow-x-auto hide-scrollbar -mx-4 px-4">
            <div className="flex gap-3 pb-2">
              {recommendations.slice(0, 6).map((book, index) => (
                <SmartRecommendationCard 
                  key={book.id} 
                  book={book} 
                  onLike={handleLikeBook}
                  onStartReading={onStartReading}
                  isLiked={likedBooks.some(liked => liked.id === book.id)}
                  index={index}
                />
              ))}
            </div>
          </div>
        </motion.div>
      )}

      {/* Diverse Recommendations - Explore Something New */}
      {diverseBooks.length > 0 && !selectedMood && !selectedTime && (
        <motion.div 
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.3 }}
        >
          <div className="mb-3 px-1">
            <div className="flex items-center gap-2 mb-1">
              <Zap className="w-4 h-4 text-green-600" />
              <h3 className="text-sm font-bold text-gray-900">Explore Something New</h3>
            </div>
            <p className="text-xs text-gray-500">Step outside your comfort zone</p>
          </div>
          
          {/* Horizontal Scroll for Mobile */}
          <div className="overflow-x-auto hide-scrollbar -mx-4 px-4">
            <div className="flex gap-3 pb-2">
              {diverseBooks.slice(0, 6).map((book, index) => (
                <DiverseBookCard 
                  key={book.id} 
                  book={book} 
                  onLike={handleLikeBook}
                  onStartReading={onStartReading}
                  isLiked={likedBooks.some(liked => liked.id === book.id)}
                  index={index}
                />
              ))}
            </div>
          </div>
        </motion.div>
      )}
    </div>
  )
}

// Smart recommendation card - Mobile-first design
function SmartRecommendationCard({ 
  book, 
  onLike, 
  onStartReading, 
  isLiked,
  index
}: { 
  book: Book
  onLike: (book: Book) => void
  onStartReading?: (book: Book) => void
  isLiked: boolean
  index?: number
}) {
  return (
    <motion.div
      className="flex-shrink-0 w-[160px] sm:w-[180px]"
      initial={{ opacity: 0, x: 20 }}
      animate={{ opacity: 1, x: 0 }}
      transition={{ delay: (index || 0) * 0.05 }}
    >
      <div className="bg-white rounded-xl overflow-hidden shadow-sm border border-gray-100">
        {/* Book Cover */}
        <div className="relative w-full aspect-[2/3] bg-gradient-to-br from-purple-100 to-pink-100">
          <Image
            src={book.cover}
            alt={book.title}
            fill
            className="object-cover"
            sizes="180px"
          />
          {/* Rating Badge */}
          <div className="absolute top-2 right-2 bg-white/95 backdrop-blur-sm rounded-full px-2 py-1 flex items-center gap-1 shadow-sm">
            <Star className="w-3 h-3 fill-yellow-400 text-yellow-400" />
            <span className="text-xs font-semibold">{book.rating}</span>
          </div>
        </div>
        
        {/* Book Info */}
        <div className="p-3">
          <h4 className="font-semibold text-sm line-clamp-1 mb-0.5">{book.title}</h4>
          <p className="text-xs text-gray-500 mb-2">{book.author}</p>
          
          <p className="text-xs text-purple-600 mb-2 line-clamp-2">
            {(book as any).reasons?.[0]?.description || 'Based on your likes'}
          </p>

          {/* Like Button */}
          <Button
            size="sm"
            variant={isLiked ? "default" : "outline"}
            onClick={() => onLike(book)}
            disabled={isLiked}
            className="w-full h-8 text-xs"
          >
            <Heart className={`w-3 h-3 mr-1 ${isLiked ? 'fill-current' : ''}`} />
            {isLiked ? 'Liked' : 'Like'}
          </Button>
        </div>
      </div>
    </motion.div>
  )
}

// Regular book recommendation card
function BookRecommendationCard({ 
  book, 
  onLike, 
  onStartReading, 
  isLiked 
}: { 
  book: Book
  onLike: (book: Book) => void
  onStartReading?: (book: Book) => void
  isLiked: boolean
}) {
  return (
    <motion.div
      className="bg-gray-50 rounded-xl p-4 hover:bg-gray-100 transition-colors"
      whileHover={{ scale: 1.02 }}
    >
      <div className="flex gap-3">
        <div className="relative w-12 h-16 flex-shrink-0">
          <Image
            src={book.cover}
            alt={book.title}
            fill
            className="object-cover rounded"
            sizes="48px"
          />
        </div>
        
        <div className="flex-1 min-w-0">
          <h4 className="font-semibold text-sm line-clamp-1 mb-1">{book.title}</h4>
          <p className="text-xs text-gray-600 mb-2">{book.author}</p>
          
          <div className="flex items-center gap-1 mb-2">
            <Star className="w-3 h-3 fill-yellow-400 text-yellow-400" />
            <span className="text-xs">{book.rating}</span>
            <span className="text-xs text-gray-500">• {book.pages}p</span>
          </div>

          <div className="flex flex-wrap gap-1 mb-2">
            {book.mood.slice(0, 2).map((mood) => (
              <span
                key={mood}
                className="bg-purple-100 text-purple-700 text-xs px-1.5 py-0.5 rounded-full"
              >
                {mood}
              </span>
            ))}
          </div>
          
          <div className="flex gap-1">
            <Button
              size="sm"
              variant={isLiked ? "default" : "outline"}
              onClick={() => onLike(book)}
              disabled={isLiked}
              className="h-6 px-2 text-xs flex-1"
            >
              <Heart className={`w-2 h-2 mr-1 ${isLiked ? 'fill-current' : ''}`} />
              {isLiked ? 'Liked' : 'Like'}
            </Button>
            {onStartReading && (
              <Button
                size="sm"
                variant="outline"
                onClick={() => onStartReading(book)}
                className="h-6 px-2 text-xs"
              >
                <BookOpen className="w-2 h-2" />
              </Button>
            )}
          </div>
        </div>
      </div>
    </motion.div>
  )
}

// Diverse book card - Mobile-first horizontal scroll design
function DiverseBookCard({ 
  book, 
  onLike, 
  onStartReading, 
  isLiked,
  index
}: { 
  book: Book
  onLike: (book: Book) => void
  onStartReading?: (book: Book) => void
  isLiked: boolean
  index?: number
}) {
  return (
    <motion.div
      className="flex-shrink-0 w-[160px] sm:w-[180px]"
      initial={{ opacity: 0, x: 20 }}
      animate={{ opacity: 1, x: 0 }}
      transition={{ delay: (index || 0) * 0.05 }}
    >
      <div className="bg-white rounded-xl overflow-hidden shadow-sm border border-gray-100">
        {/* Book Cover */}
        <div className="relative w-full aspect-[2/3] bg-gradient-to-br from-green-100 to-emerald-100">
          <Image
            src={book.cover}
            alt={book.title}
            fill
            className="object-cover"
            sizes="180px"
          />
          {/* Rating Badge */}
          <div className="absolute top-2 right-2 bg-white/95 backdrop-blur-sm rounded-full px-2 py-1 flex items-center gap-1 shadow-sm">
            <Star className="w-3 h-3 fill-yellow-400 text-yellow-400" />
            <span className="text-xs font-semibold">{book.rating}</span>
          </div>
        </div>
        
        {/* Book Info */}
        <div className="p-3">
          <h4 className="font-semibold text-sm line-clamp-1 mb-0.5">{book.title}</h4>
          <p className="text-xs text-gray-500 mb-2">{book.author}</p>
          
          <p className="text-xs text-green-600 mb-2 line-clamp-2">
            New genre for you!
          </p>
          
          {/* Like Button */}
          <Button
            size="sm"
            variant={isLiked ? "default" : "outline"}
            onClick={() => onLike(book)}
            disabled={isLiked}
            className="w-full h-8 text-xs"
          >
            <Heart className={`w-3 h-3 mr-1 ${isLiked ? 'fill-current' : ''}`} />
            {isLiked ? 'Liked' : 'Like'}
          </Button>
        </div>
      </div>
    </motion.div>
  )
}
