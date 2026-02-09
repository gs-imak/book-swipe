"use client"

import Image from "next/image"
import { useState, useCallback } from "react"
import { BookOpen } from "lucide-react"

interface BookCoverProps {
  src: string
  fallbackSrc?: string
  alt: string
  fill?: boolean
  sizes?: string
  priority?: boolean
  className?: string
}

export function BookCover({ src, fallbackSrc, alt, fill, sizes, priority, className = "object-contain" }: BookCoverProps) {
  const [currentSrc, setCurrentSrc] = useState(src)
  const [hasError, setHasError] = useState(false)

  const handleError = useCallback(() => {
    if (currentSrc === src && fallbackSrc) {
      setCurrentSrc(fallbackSrc)
    } else {
      setHasError(true)
    }
  }, [src, fallbackSrc, currentSrc])

  if (hasError || !src) {
    return (
      <div className="absolute inset-0 bg-gradient-to-br from-stone-100 via-stone-200 to-stone-300 flex flex-col items-center justify-center p-4 text-center">
        <BookOpen className="w-8 h-8 text-stone-400 mb-2 flex-shrink-0" />
        <span className="text-[11px] font-semibold text-stone-500 line-clamp-2 leading-tight">{alt}</span>
      </div>
    )
  }

  return (
    <Image
      key={currentSrc}
      src={currentSrc}
      alt={alt}
      fill={fill}
      sizes={sizes}
      priority={priority}
      className={className}
      onError={handleError}
    />
  )
}
