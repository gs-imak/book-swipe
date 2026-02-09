"use client"

import Image from "next/image"
import { useState, useCallback } from "react"
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

  const handleLoad = useCallback((e: React.SyntheticEvent<HTMLImageElement>) => {
    const img = e.currentTarget
    if (!img || !img.naturalWidth) return

    // Reject very small images (likely broken thumbnails)
    if (img.naturalWidth < 50 || img.naturalHeight < 50) {
      setHasError(true)
      return
    }

    // Canvas analysis: detect mostly-white/blank placeholder images
    // (scanned title pages, "image not available" placeholders, etc.)
    try {
      const canvas = document.createElement('canvas')
      const sample = 16
      canvas.width = sample
      canvas.height = sample
      const ctx = canvas.getContext('2d')
      if (ctx) {
        ctx.drawImage(img, 0, 0, sample, sample)
        const data = ctx.getImageData(0, 0, sample, sample).data
        let lightPixels = 0
        const totalPixels = sample * sample
        for (let i = 0; i < data.length; i += 4) {
          // Pixel is "light" if R, G, B are all > 210
          if (data[i] > 210 && data[i + 1] > 210 && data[i + 2] > 210) {
            lightPixels++
          }
        }
        // If more than 60% of sampled pixels are very light, it's a bad cover
        if (lightPixels / totalPixels > 0.60) {
          setHasError(true)
        }
      }
    } catch {
      // Canvas tainted by CORS or other issue — skip check
    }
  }, [])

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
      src={src}
      alt={alt}
      fill={fill}
      sizes={sizes}
      priority={priority}
      className={className}
      onError={() => setHasError(true)}
      onLoad={handleLoad}
    />
  )
}
