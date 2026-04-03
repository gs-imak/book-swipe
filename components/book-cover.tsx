"use client"

import Image from "next/image"
import { useState, useCallback, useEffect, useMemo } from "react"
import { BookOpen } from "lucide-react"

function getPlaceholderColor(seed: string): string {
  let hash = 0
  for (let i = 0; i < seed.length; i++) hash = seed.charCodeAt(i) + ((hash << 5) - hash)
  const hue = Math.abs(hash) % 360
  return `hsl(${hue}, 15%, 85%)`
}

function getShimmerHighlight(seed: string): string {
  let hash = 0
  for (let i = 0; i < seed.length; i++) hash = seed.charCodeAt(i) + ((hash << 5) - hash)
  const hue = Math.abs(hash) % 360
  return `hsl(${hue}, 12%, 91%)`
}

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
  const [isLoaded, setIsLoaded] = useState(false)

  const colorSeed = alt || src || "book"
  const placeholderBg = useMemo(() => getPlaceholderColor(colorSeed), [colorSeed])
  const shimmerHighlight = useMemo(() => getShimmerHighlight(colorSeed), [colorSeed])

  useEffect(() => {
    setCurrentSrc(src)
    setHasError(false)
    setIsLoaded(false)
  }, [src])

  const handleError = useCallback(() => {
    if (currentSrc === src && fallbackSrc) {
      setCurrentSrc(fallbackSrc)
      setIsLoaded(false)
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
    <>
      <div
        className="absolute inset-0 overflow-hidden"
        style={{
          backgroundColor: placeholderBg,
          opacity: isLoaded ? 0 : 1,
          transition: "opacity 400ms ease-out",
          pointerEvents: "none",
        }}
        aria-hidden="true"
      >
        <div
          className="absolute inset-0"
          style={{
            background: `linear-gradient(
              105deg,
              transparent 40%,
              ${shimmerHighlight} 50%,
              transparent 60%
            )`,
            backgroundSize: "200% 100%",
            animation: isLoaded ? "none" : "bookcover-shimmer 1.8s ease-in-out infinite",
          }}
        />
      </div>
      <Image
        key={currentSrc}
        src={currentSrc}
        alt={alt}
        fill={fill}
        sizes={sizes}
        priority={priority}
        quality={85}
        className={`${className} ${isLoaded ? "opacity-100" : "opacity-0"}`}
        style={{
          transition: "opacity 300ms ease-out",
        }}
        onLoad={() => setIsLoaded(true)}
        onError={handleError}
      />
      <style jsx global>{`
        @keyframes bookcover-shimmer {
          0% { background-position: 200% 0; }
          100% { background-position: -200% 0; }
        }
      `}</style>
    </>
  )
}
