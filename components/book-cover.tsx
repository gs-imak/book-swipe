"use client"

import Image from "next/image"
import { useState, useCallback, useEffect } from "react"
import { BookOpen } from "lucide-react"

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
  className = "object-cover",
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

  // Quality gate: an image a few pixels wide is a tracking-pixel/broken
  // response, not cover art — step down the chain instead of showing garbage.
  const handleLoad = useCallback((e: React.SyntheticEvent<HTMLImageElement>) => {
    const img = e.currentTarget
    if (
      img.naturalWidth > 0 &&
      (img.naturalWidth < 60 || img.naturalHeight < 60)
    ) {
      handleError()
      return
    }
    setIsLoaded(true)
  }, [handleError])

  // Branded fill: a saturated, seed-tinted "cover" card with the title in
  // white serif — theme-independent and far more premium than a grey box.
  // Doubles as the INSTANT loading state (the real cover fades in over it)
  // and as the terminal placeholder when every source failed.
  const brandedFill = (
    <div
      className="absolute inset-0 flex flex-col items-center justify-center gap-1.5 p-4 text-center"
      style={{
        background: `linear-gradient(150deg, hsl(${getSeedHue(alt || src || "book")} 45% 35%), hsl(${(getSeedHue(alt || src || "book") + 38) % 360} 50% 22%))`,
      }}
    >
      {/* Subtle top sheen for depth */}
      <div className="pointer-events-none absolute inset-0 bg-gradient-to-b from-white/15 to-transparent" />
      <BookOpen className="relative h-7 w-7 flex-shrink-0 text-white/80" />
      {alt && (
        <span className="relative line-clamp-3 font-serif text-[12px] font-semibold leading-tight text-white drop-shadow-sm">
          {alt}
        </span>
      )}
      {author && (
        <span className="relative line-clamp-1 text-[10px] font-medium leading-tight text-white/75">
          {author}
        </span>
      )}
    </div>
  )

  if (hasError || !src) {
    return brandedFill
  }

  return (
    <>
      {/* Instant paint: the branded fill shows the book identity immediately;
          the real cover fades in over it once loaded. */}
      {!isLoaded && brandedFill}
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
        onLoad={handleLoad}
        onError={handleError}
      />
    </>
  )
}
