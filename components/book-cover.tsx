"use client"

import Image from "next/image"
import { useState } from "react"
import { BookOpen } from "lucide-react"

interface BookCoverProps {
  src: string
  alt: string
  fill?: boolean
  sizes?: string
  priority?: boolean
  className?: string
}

export function BookCover({ src, alt, fill, sizes, priority, className = "object-cover" }: BookCoverProps) {
  const [hasError, setHasError] = useState(false)

  if (hasError || !src) {
    return (
      <div className="absolute inset-0 bg-gradient-to-br from-stone-200 to-stone-300 flex flex-col items-center justify-center p-3 text-center">
        <BookOpen className="w-8 h-8 text-stone-400 mb-2" />
        <span className="text-xs font-medium text-stone-500 line-clamp-2 leading-tight">{alt}</span>
      </div>
    )
  }

  return (
    <Image
      src={src}
      alt={alt}
      fill={fill}
      sizes={sizes}
      priority={priority}
      className={className}
      onError={() => setHasError(true)}
    />
  )
}
