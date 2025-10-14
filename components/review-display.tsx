"use client"

import { useState } from "react"
import { motion } from "framer-motion"
import { Heart, MessageSquare, Tag, Calendar, Edit, Trash2 } from "lucide-react"
import { Button } from "./ui/button"
import { StarRating } from "./star-rating"
import { BookReview, deleteBookReview } from "@/lib/storage"

interface ReviewDisplayProps {
  review: BookReview
  onEdit?: () => void
  onDelete?: () => void
  compact?: boolean
}

export function ReviewDisplay({ review, onEdit, onDelete, compact = false }: ReviewDisplayProps) {
  const [showFullReview, setShowFullReview] = useState(false)

  const moodEmojis: Record<string, string> = {
    happy: "😊",
    excited: "🤩", 
    thoughtful: "🤔",
    emotional: "🥺",
    inspired: "✨",
    relaxed: "😌"
  }

  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleDateString('en-US', {
      year: 'numeric',
      month: 'short',
      day: 'numeric'
    })
  }

  const handleDelete = () => {
    if (confirm('Are you sure you want to delete this review?')) {
      deleteBookReview(review.bookId)
      onDelete?.()
    }
  }

  if (compact) {
    return (
      <motion.div
        initial={{ opacity: 0, scale: 0.95 }}
        animate={{ opacity: 1, scale: 1 }}
        className="bg-gray-50 rounded-xl p-4 space-y-3"
      >
        <div className="flex items-center justify-between">
          <StarRating rating={review.rating} readonly size="sm" />
          {review.favorite && (
            <Heart className="w-4 h-4 text-red-500 fill-red-500" />
          )}
        </div>
        
        {review.review && (
          <p className="text-sm text-gray-600 line-clamp-2">
            "{review.review}"
          </p>
        )}
        
        <div className="flex items-center gap-2 text-xs text-gray-500">
          {review.mood && moodEmojis[review.mood] && (
            <span>{moodEmojis[review.mood]}</span>
          )}
          <Calendar className="w-3 h-3" />
          <span>{formatDate(review.createdAt)}</span>
        </div>
      </motion.div>
    )
  }

  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      className="bg-white rounded-2xl shadow-lg border border-gray-100 p-6 space-y-4"
    >
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <StarRating rating={review.rating} readonly size="md" showLabel />
          {review.favorite && (
            <div className="flex items-center gap-1 text-red-500">
              <Heart className="w-4 h-4 fill-current" />
              <span className="text-sm font-medium">Favorite</span>
            </div>
          )}
        </div>
        
        <div className="flex items-center gap-2">
          {onEdit && (
            <Button variant="outline" size="sm" onClick={onEdit}>
              <Edit className="w-4 h-4 mr-1" />
              Edit
            </Button>
          )}
          {onDelete && (
            <Button variant="outline" size="sm" onClick={handleDelete}>
              <Trash2 className="w-4 h-4 text-red-500" />
            </Button>
          )}
        </div>
      </div>

      {/* Review Text */}
      {review.review && (
        <div className="space-y-2">
          <div className="flex items-center gap-2">
            <MessageSquare className="w-4 h-4 text-gray-500" />
            <span className="text-sm font-medium text-gray-700">Your Review</span>
          </div>
          <div className="bg-gray-50 rounded-lg p-4">
            <p className={`text-gray-700 leading-relaxed ${!showFullReview && review.review.length > 200 ? 'line-clamp-3' : ''}`}>
              "{review.review}"
            </p>
            {review.review.length > 200 && (
              <Button
                variant="ghost"
                size="sm"
                onClick={() => setShowFullReview(!showFullReview)}
                className="mt-2 p-0 h-auto text-purple-600 hover:text-purple-700"
              >
                {showFullReview ? 'Show less' : 'Show more'}
              </Button>
            )}
          </div>
        </div>
      )}

      {/* Mood */}
      {review.mood && moodEmojis[review.mood] && (
        <div className="flex items-center gap-2">
          <span className="text-lg">{moodEmojis[review.mood]}</span>
          <span className="text-sm text-gray-600">
            This book made you feel {review.mood}
          </span>
        </div>
      )}

      {/* Tags */}
      {review.tags.length > 0 && (
        <div className="space-y-2">
          <div className="flex items-center gap-2">
            <Tag className="w-4 h-4 text-gray-500" />
            <span className="text-sm font-medium text-gray-700">Tags</span>
          </div>
          <div className="flex flex-wrap gap-2">
            {review.tags.map((tag) => (
              <span
                key={tag}
                className="inline-flex items-center px-2.5 py-1 rounded-full text-xs font-medium bg-purple-100 text-purple-800"
              >
                {tag}
              </span>
            ))}
          </div>
        </div>
      )}

      {/* Metadata */}
      <div className="flex items-center justify-between text-xs text-gray-500 pt-4 border-t">
        <div className="flex items-center gap-4">
          <div className="flex items-center gap-1">
            <Calendar className="w-3 h-3" />
            <span>Reviewed {formatDate(review.createdAt)}</span>
          </div>
          {review.updatedAt !== review.createdAt && (
            <span>• Updated {formatDate(review.updatedAt)}</span>
          )}
        </div>
      </div>
    </motion.div>
  )
}




