"use client"

import { Star } from "lucide-react"
import { motion } from "framer-motion"

interface StarRatingProps {
  rating: number
  onRatingChange?: (rating: number) => void
  readonly?: boolean
  size?: "sm" | "md" | "lg"
  showLabel?: boolean
}

export function StarRating({ 
  rating, 
  onRatingChange, 
  readonly = false, 
  size = "md", 
  showLabel = false 
}: StarRatingProps) {
  const sizeClasses = {
    sm: "w-4 h-4",
    md: "w-5 h-5",
    lg: "w-6 h-6"
  }

  const labels = {
    1: "Poor",
    2: "Fair", 
    3: "Good",
    4: "Great",
    5: "Excellent"
  }

  return (
    <div className="flex items-center gap-2">
      <div className="flex items-center gap-1">
        {[1, 2, 3, 4, 5].map((star) => (
          <motion.button
            key={star}
            type="button"
            onClick={() => !readonly && onRatingChange?.(star)}
            disabled={readonly}
            className={`${readonly ? "cursor-default" : "cursor-pointer hover:scale-110"} transition-transform`}
            whileHover={!readonly ? { scale: 1.1 } : {}}
            whileTap={!readonly ? { scale: 0.95 } : {}}
          >
            <Star
              className={`${sizeClasses[size]} transition-colors ${
                star <= rating
                  ? "text-yellow-400 fill-yellow-400"
                  : "text-gray-300"
              }`}
            />
          </motion.button>
        ))}
      </div>
      
      {showLabel && rating > 0 && (
        <span className="text-sm text-gray-600 font-medium">
          {labels[rating as keyof typeof labels]}
        </span>
      )}
    </div>
  )
}




