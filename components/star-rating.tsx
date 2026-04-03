"use client"

import { useState } from "react"
import { motion } from "framer-motion"

interface StarRatingProps {
  rating: number
  onRatingChange?: (rating: number) => void
  readonly?: boolean
  size?: "sm" | "md" | "lg"
  showLabel?: boolean
  "aria-labelledby"?: string
}

// Renders a single star SVG that can be empty, half-filled, or fully filled.
// Half fill is achieved via a clipPath that covers the left 50% of the star.
function StarIcon({
  fill,
  className,
  id,
}: {
  fill: "empty" | "half" | "full"
  className: string
  id: string
}) {
  const clipId = `half-clip-${id}`

  return (
    <svg
      viewBox="0 0 24 24"
      xmlns="http://www.w3.org/2000/svg"
      className={className}
      aria-hidden="true"
    >
      {fill === "half" && (
        <defs>
          <clipPath id={clipId}>
            <rect x="0" y="0" width="12" height="24" />
          </clipPath>
        </defs>
      )}

      {/* Base star — always rendered in stone-300 (empty look) */}
      <path
        d="M12 2l3.09 6.26L22 9.27l-5 4.87 1.18 6.88L12 17.77l-6.18 3.25L7 14.14 2 9.27l6.91-1.01L12 2z"
        className="fill-stone-300 stroke-stone-300"
        strokeWidth="1"
        strokeLinejoin="round"
      />

      {/* Filled overlay — full or half via clipPath */}
      {fill !== "empty" && (
        <path
          d="M12 2l3.09 6.26L22 9.27l-5 4.87 1.18 6.88L12 17.77l-6.18 3.25L7 14.14 2 9.27l6.91-1.01L12 2z"
          className="fill-amber-500 stroke-amber-500"
          strokeWidth="1"
          strokeLinejoin="round"
          clipPath={fill === "half" ? `url(#${clipId})` : undefined}
        />
      )}
    </svg>
  )
}

function getStarFill(star: number, rating: number): "empty" | "half" | "full" {
  if (rating >= star) return "full"
  if (rating >= star - 0.5) return "half"
  return "empty"
}

function formatLabel(rating: number): string {
  const wholeLabels: Record<number, string> = {
    1: "Poor",
    2: "Fair",
    3: "Good",
    4: "Great",
    5: "Excellent",
  }
  if (wholeLabels[rating]) return wholeLabels[rating]
  // Half-star values: show numeric representation
  return rating.toFixed(1)
}

export function StarRating({
  rating,
  onRatingChange,
  readonly = false,
  size = "md",
  showLabel = false,
  "aria-labelledby": ariaLabelledBy,
}: StarRatingProps) {
  // hoverRating drives the visual preview while hovering in interactive mode.
  // null means "no hover active — show committed rating".
  const [hoverRating, setHoverRating] = useState<number | null>(null)

  const sizeClasses = {
    sm: "w-4 h-4",
    md: "w-5 h-5",
    lg: "w-6 h-6",
  }

  const displayRating = hoverRating !== null ? hoverRating : rating

  function handleClick(e: React.MouseEvent<HTMLButtonElement>, star: number) {
    if (readonly) return
    const rect = e.currentTarget.getBoundingClientRect()
    const clickX = e.clientX - rect.left
    const isLeftHalf = clickX < rect.width / 2
    const newRating = isLeftHalf ? star - 0.5 : star
    onRatingChange?.(newRating)
  }

  function handleMouseMove(e: React.MouseEvent<HTMLButtonElement>, star: number) {
    if (readonly) return
    const rect = e.currentTarget.getBoundingClientRect()
    const x = e.clientX - rect.left
    const isLeftHalf = x < rect.width / 2
    setHoverRating(isLeftHalf ? star - 0.5 : star)
  }

  function handleMouseLeave() {
    if (readonly) return
    setHoverRating(null)
  }

  return (
    <div className="flex items-center gap-2">
      <div
        role={readonly ? undefined : "group"}
        aria-labelledby={ariaLabelledBy}
        className="flex items-center gap-1"
        onMouseLeave={handleMouseLeave}
      >
        {[1, 2, 3, 4, 5].map((star) => {
          const fill = getStarFill(star, displayRating)
          const halfValue = star - 0.5

          // aria-label describes both selectable values this button covers
          const ariaLabel = readonly
            ? `${star} star${star !== 1 ? "s" : ""}`
            : `${halfValue} or ${star} star${star !== 1 ? "s" : ""}${
                rating === star
                  ? ", selected"
                  : rating === halfValue
                  ? ", half selected"
                  : ""
              }`

          return (
            <motion.button
              key={star}
              type="button"
              onClick={(e) => handleClick(e, star)}
              onMouseMove={(e) => handleMouseMove(e, star)}
              disabled={readonly}
              aria-label={ariaLabel}
              aria-pressed={
                !readonly
                  ? rating === star || rating === halfValue
                  : undefined
              }
              className={`${
                readonly ? "cursor-default" : "cursor-pointer"
              } transition-transform relative`}
              whileHover={!readonly ? { scale: 1.1 } : {}}
              whileTap={!readonly ? { scale: 0.95 } : {}}
            >
              <StarIcon
                fill={fill}
                className={sizeClasses[size]}
                id={`star-${star}`}
              />
            </motion.button>
          )
        })}
      </div>

      {showLabel && rating > 0 && (
        <span className="text-sm text-stone-500 font-medium">
          {formatLabel(rating)}
        </span>
      )}
    </div>
  )
}
