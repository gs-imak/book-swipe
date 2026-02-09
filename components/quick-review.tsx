"use client"

import { useState } from "react"
import { motion } from "framer-motion"
import { Heart, MessageSquare, Tag, Calendar, Clock } from "lucide-react"
import { Button } from "./ui/button"
import { StarRating } from "./star-rating"
import { BookCover } from "@/components/book-cover"
import { Book } from "@/lib/book-data"
import { BookReview, saveBookReview } from "@/lib/storage"
import { useGamification } from "./gamification-provider"

interface QuickReviewProps {
  book: Book
  onReviewSaved?: (review: BookReview) => void
  existingReview?: BookReview | null
}

const moodOptions = [
  { id: "happy", emoji: "😊", label: "Happy" },
  { id: "excited", emoji: "🤩", label: "Excited" },
  { id: "thoughtful", emoji: "🤔", label: "Thoughtful" },
  { id: "emotional", emoji: "🥺", label: "Emotional" },
  { id: "inspired", emoji: "✨", label: "Inspired" },
  { id: "relaxed", emoji: "😌", label: "Relaxed" },
]

const quickTags = [
  "Page-turner", "Beautiful writing", "Great characters", "Thought-provoking",
  "Funny", "Heartwarming", "Suspenseful", "Educational", "Life-changing", "Quick read"
]

export function QuickReview({ book, onReviewSaved, existingReview }: QuickReviewProps) {
  const [rating, setRating] = useState(existingReview?.rating || 0)
  const [review, setReview] = useState(existingReview?.review || "")
  const [selectedMood, setSelectedMood] = useState(existingReview?.mood || "")
  const [selectedTags, setSelectedTags] = useState<string[]>(existingReview?.tags || [])
  const [favorite, setFavorite] = useState(existingReview?.favorite || false)
  const [isSubmitting, setIsSubmitting] = useState(false)
  
  const { triggerActivity } = useGamification()

  const handleTagToggle = (tag: string) => {
    setSelectedTags(prev => 
      prev.includes(tag) 
        ? prev.filter(t => t !== tag)
        : [...prev, tag]
    )
  }

  const handleSubmit = async () => {
    if (rating === 0) return

    setIsSubmitting(true)
    
    const reviewData: BookReview = {
      bookId: book.id,
      rating,
      review: review.trim() || undefined,
      favorite,
      tags: selectedTags,
      mood: selectedMood,
      createdAt: existingReview?.createdAt || new Date().toISOString(),
      updatedAt: new Date().toISOString()
    }

    saveBookReview(reviewData)
    onReviewSaved?.(reviewData)
    
    // Trigger gamification events
    if (!existingReview) {
      // First time writing review
      triggerActivity('write_review', { 
        rating, 
        review, 
        favorite,
        isLongReview: review.length > 100 
      })
      
      if (favorite) {
        triggerActivity('favorite_book')
      }
      
      if (review.length > 100) {
        triggerActivity('long_review')
      }
    }
    
    setIsSubmitting(false)
  }

  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      className="bg-white rounded-2xl shadow-lg border border-stone-200/60 shadow-sm p-6 space-y-6"
    >
      {/* Header */}
      <div className="flex items-start gap-4">
        <div className="relative w-16 h-24 flex-shrink-0 rounded-lg overflow-hidden shadow-md">
          <BookCover
            src={book.cover}
            alt={book.title}
            fill
            className="object-cover"
            sizes="64px"
          />
        </div>
        <div className="flex-1">
          <h3 className="font-bold text-lg text-gray-900 line-clamp-2">
            {book.title}
          </h3>
          <p className="text-gray-600 text-sm">{book.author}</p>
        </div>
      </div>

      {/* Rating */}
      <div className="space-y-2">
        <label className="text-sm font-semibold text-gray-700">How was it?</label>
        <StarRating
          rating={rating}
          onRatingChange={setRating}
          size="lg"
          showLabel={true}
        />
      </div>

      {/* Mood */}
      <div className="space-y-3">
        <label className="text-sm font-semibold text-gray-700">How did it make you feel?</label>
        <div className="grid grid-cols-3 sm:grid-cols-6 gap-2">
          {moodOptions.map((mood) => (
            <Button
              key={mood.id}
              variant={selectedMood === mood.id ? "default" : "outline"}
              size="sm"
              onClick={() => setSelectedMood(mood.id)}
              className="h-auto p-2 flex flex-col gap-1 text-center"
            >
              <span className="text-lg">{mood.emoji}</span>
              <span className="text-xs">{mood.label}</span>
            </Button>
          ))}
        </div>
      </div>

      {/* Quick Tags */}
      <div className="space-y-3">
        <label className="text-sm font-semibold text-gray-700">Quick tags</label>
        <div className="flex flex-wrap gap-2">
          {quickTags.map((tag) => (
            <Button
              key={tag}
              variant={selectedTags.includes(tag) ? "default" : "outline"}
              size="sm"
              onClick={() => handleTagToggle(tag)}
              className="h-auto px-3 py-1 text-xs"
            >
              <Tag className="w-3 h-3 mr-1" />
              {tag}
            </Button>
          ))}
        </div>
      </div>

      {/* Written Review */}
      <div className="space-y-2">
        <label className="text-sm font-semibold text-gray-700">
          Your thoughts <span className="text-gray-400 font-normal">(optional)</span>
        </label>
        <textarea
          value={review}
          onChange={(e) => setReview(e.target.value)}
          placeholder="What did you love about this book? Any memorable quotes or moments?"
          className="w-full p-3 border border-gray-200 rounded-lg resize-none focus:outline-none focus:ring-2 focus:ring-amber-400 focus:border-transparent"
          rows={3}
        />
      </div>

      {/* Favorite Toggle */}
      <div className="flex items-center gap-3">
        <Button
          variant={favorite ? "default" : "outline"}
          size="sm"
          onClick={() => setFavorite(!favorite)}
          className="flex items-center gap-2"
        >
          <Heart className={`w-4 h-4 ${favorite ? "fill-current" : ""}`} />
          {favorite ? "Remove from favorites" : "Add to favorites"}
        </Button>
      </div>

      {/* Submit Button */}
      <div className="flex justify-end pt-4 border-t">
        <Button
          onClick={handleSubmit}
          disabled={rating === 0 || isSubmitting}
          className="px-6"
        >
          {isSubmitting ? "Saving..." : existingReview ? "Update Review" : "Save Review"}
        </Button>
      </div>
    </motion.div>
  )
}
