"use client"

import { useState, useEffect } from "react"
import { Button } from "@/components/ui/button"
import { Book } from "@/lib/book-data"
import { addBookToReading, saveLikedBooks, getLikedBooks } from "@/lib/storage"
import { 
  getSmartRecommendations, 
  getDiverseRecommendations, 
  getBooksByMood, 
  getBooksByTime,
  moodFilters, 
  timeBasedSuggestions,
  RecommendedBook 
} from "../lib/recommendations"
import { Star, Clock, BookOpen, Heart, Sparkles, Zap, Brain, Coffee } from "lucide-react"
import { motion } from "framer-motion"
import Image from "next/image"
import { useGamification } from "./gamification-provider"

interface SmartRecommendationsProps {
  onBookLike?: (book: Book) => void
  onStartReading?: (book: Book) => void
}

export function SmartRecommendations({ onBookLike, onStartReading }: SmartRecommendationsProps) {
  const [recommendations, setRecommendations] = useState<RecommendedBook[]>([])
  const [diverseBooks, setDiverseBooks] = useState<Book[]>([])
  const [selectedMood, setSelectedMood] = useState<string | null>(null)
  const [selectedTime, setSelectedTime] = useState<string | null>(null)
  const [filteredBooks, setFilteredBooks] = useState<Book[]>([])
  const [likedBooks, setLikedBooks] = useState<Book[]>([])
  const { triggerActivity } = useGamification()

  useEffect(() => {
    const liked = getLikedBooks()
    setLikedBooks(liked)
    
    if (liked.length > 0) {
      setRecommendations(getSmartRecommendations(8))
      setDiverseBooks(getDiverseRecommendations(6))
    }
  }, [])

  const handleMoodFilter = (moodId: string) => {
    const mood = moodFilters.find(m => m.id === moodId)
    if (mood) {
      setSelectedMood(moodId)
      setSelectedTime(null)
      setFilteredBooks(getBooksByMood(mood))
    }
  }

  const handleTimeFilter = (timeId: string) => {
    const timeConstraint = timeBasedSuggestions.find(t => t.id === timeId)
    if (timeConstraint) {
      setSelectedTime(timeId)
      setSelectedMood(null)
      setFilteredBooks(getBooksByTime(timeConstraint))
    }
  }

  const handleLikeBook = (book: Book) => {
    const updatedLiked = [...likedBooks, book]
    setLikedBooks(updatedLiked)
    saveLikedBooks(updatedLiked)
    // Update achievements/progress
    triggerActivity('like_book')
    
    // Refresh recommendations after liking
    setRecommendations(getSmartRecommendations(8))
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
          className="bg-white/90 backdrop-blur-xl rounded-3xl p-6 shadow-lg border border-white/20"
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.2 }}
        >
          <div className="flex items-center gap-3 mb-4">
            <div className="p-2 bg-gradient-to-br from-purple-400 to-pink-500 rounded-xl">
              <Sparkles className="w-5 h-5 text-white" />
            </div>
            <h3 className="text-lg font-bold text-gray-800">Recommended for You</h3>
            <span className="text-xs bg-purple-100 text-purple-700 px-2 py-1 rounded-full">
              Based on your likes
            </span>
          </div>
          
          <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-4 gap-4">
            {recommendations.slice(0, 4).map((book) => (
              <SmartRecommendationCard 
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

      {/* Diverse Recommendations */}
      {diverseBooks.length > 0 && !selectedMood && !selectedTime && (
        <motion.div 
          className="bg-white/90 backdrop-blur-xl rounded-3xl p-6 shadow-lg border border-white/20"
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.3 }}
        >
          <div className="flex items-center gap-3 mb-4">
            <div className="p-2 bg-gradient-to-br from-green-400 to-emerald-500 rounded-xl">
              <Zap className="w-5 h-5 text-white" />
            </div>
            <h3 className="text-lg font-bold text-gray-800">Explore Something New</h3>
            <span className="text-xs bg-green-100 text-green-700 px-2 py-1 rounded-full">
              Step outside your comfort zone
            </span>
          </div>
          
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
            {diverseBooks.slice(0, 3).map((book) => (
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
    </div>
  )
}

// Smart recommendation card with reasons
function SmartRecommendationCard({ 
  book, 
  onLike, 
  onStartReading, 
  isLiked 
}: { 
  book: RecommendedBook
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

          {book.reasons.length > 0 && (
            <div className="mb-2">
              <p className="text-xs text-purple-600 font-medium">
                {book.reasons[0].description}
              </p>
            </div>
          )}
          
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
