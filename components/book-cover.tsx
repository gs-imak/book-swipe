"use client"

import Image from "next/image"
import { useState, useCallback, useEffect } from "react"
import { BookOpen } from "lucide-react"
import { Skeleton } from "@/components/ui/skeleton"

// Deterministic hue from a string so each book gets a stable, distinct
// placeholder/gradient tint instead of a flat grey box.
function getSeedHue(seed: string): number {
  let hash = 0
  for (let i = 0; i < seed.length; i++) hash = seed.charCodeAt(i) + ((hash << 5) - hash)
  return Math.abs(hash) % 360
}

interface BookCoverProps {
  src: string
  fallbackSrc?: string
  alt: string
  /** Optional author, shown under the title in the branded placeholder. */
  author?: string
  fill?: boolean
  sizes?: string
  priority?: boolean
  className?: string
}

export function BookCover({
  src,
  fallbackSrc,
  alt,
  author,
  fill,
  sizes,
  priority,
  className = "object-contain",
}: BookCoverProps) {
  const [currentSrc, setCurrentSrc] = useState(src)
  const [hasError, setHasError] = useState(false)
  const [isLoaded, setIsLoaded] = useState(false)

  useEffect(() => {
    setCurrentSrc(src)
    setHasError(false)
    setIsLoaded(false)
  }, [src])

  const handleError = useCallback(() => {
    // Step down the fallback chain: src -> fallbackSrc -> branded placeholder.
    if (currentSrc === src && fallbackSrc && fallbackSrc !== src) {
      setCurrentSrc(fallbackSrc)
      setIsLoaded(false)
    } else {
      setHasError(true)
    }
  }, [src, fallbackSrc, currentSrc])

  // Branded placeholder: shown when there's no cover URL or every source failed.
  if (hasError || !src) {
    const hue = getSeedHue(alt || src || "book")
    return (
      <div
        className="absolute inset-0 flex flex-col items-center justify-center gap-1.5 p-4 text-center"
        style={{
          background: `linear-gradient(145deg, hsl(${hue}, 30%, 88%), hsl(${(hue + 40) % 360}, 24%, 78%))`,
        }}
      >
        <BookOpen className="h-7 w-7 flex-shrink-0 text-stone-500/70" />
        {alt && (
          <span className="line-clamp-3 text-[11px] font-semibold leading-tight text-stone-700">
            {alt}
          </span>
        )}
        {author && (
          <span className="line-clamp-1 text-[10px] font-medium leading-tight text-stone-500">
            {author}
          </span>
        )}
      </div>
    )
  }

  return (
    <>
      {/* Loading skeleton — consistent with the project's Skeleton component. */}
      {!isLoaded && (
        <Skeleton className="absolute inset-0 rounded-none" />
      )}
      <Image
        key={currentSrc}
        src={currentSrc}
        alt={alt}
        fill={fill}
        sizes={sizes}
        priority={priority}
        loading={priority ? undefined : "lazy"}
        quality={85}
        className={`${className} ${isLoaded ? "opacity-100" : "opacity-0"}`}
        style={{
          transition: "opacity 300ms ease-out",
        }}
        onLoad={() => setIsLoaded(true)}
        onError={handleError}
      />
    </>
  )
}
