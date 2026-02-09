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

export function BookCover({ src, fallbackSrc, alt, fill, sizes, priority, className = "object-cover" }: BookCoverProps) {
  const [currentSrc, setCurrentSrc] = useState(src)
  const [hasError, setHasError] = useState(false)

  const tryFallback = useCallback(() => {
    if (currentSrc === src && fallbackSrc) {
      setCurrentSrc(fallbackSrc)
    } else {
      setHasError(true)
    }
  }, [src, fallbackSrc, currentSrc])

  const handleLoad = useCallback((e: React.SyntheticEvent<HTMLImageElement>) => {
    const img = e.currentTarget
    if (!img || !img.naturalWidth) return

    // Reject very small images
    if (img.naturalWidth < 50 || img.naturalHeight < 50) {
      tryFallback()
      return
    }

    // Canvas check: detect blank placeholder images
    // (e.g. Google Books "image not available" which is all-white with ~2 colors)
    try {
      const canvas = document.createElement('canvas')
      const s = 16
      canvas.width = s
      canvas.height = s
      const ctx = canvas.getContext('2d')
      if (ctx) {
        ctx.drawImage(img, 0, 0, s, s)
        const data = ctx.getImageData(0, 0, s, s).data
        let lightPixels = 0
        const total = s * s
        const colors = new Set<number>()
        for (let i = 0; i < data.length; i += 4) {
          const r = data[i], g = data[i + 1], b = data[i + 2]
          if (r > 210 && g > 210 && b > 210) lightPixels++
          // Quantize colors to 32-step buckets
          colors.add(Math.round(r / 32) * 100 + Math.round(g / 32) * 10 + Math.round(b / 32))
        }
        // Reject only obvious placeholders: >90% light AND ≤5 colors
        // Real white-themed covers have many colors from illustrations/gradients
        if (lightPixels / total > 0.90 && colors.size <= 5) {
          tryFallback()
        }
      }
    } catch {
      // Canvas tainted by CORS — skip check
    }
  }, [tryFallback])

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
      onError={tryFallback}
      onLoad={handleLoad}
    />
  )
}
