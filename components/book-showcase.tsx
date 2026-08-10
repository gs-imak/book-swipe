"use client"

// Full-screen 3D book Showcase (docs/adr/0004): the cinematic first layer on
// discovery-surface book taps. The WebGL engine lives in lib/showcase-scene
// (loaded on demand so three.js never reaches the main bundle); this file is
// the thin React glue: overlay, info panel, action pills, choreography.
import { useCallback, useEffect, useRef, useState } from "react"
import { createPortal } from "react-dom"
import { motion, AnimatePresence } from "framer-motion"
import { X, Heart, BookOpen, Info } from "lucide-react"
import { Book } from "@/lib/book-data"
import { addLikedBook, removeLikedBook, getLikedBooks } from "@/lib/storage"
import { getSeedHue } from "@/components/book-cover"
import { StarRating } from "@/components/star-rating"
import { useToast } from "@/components/toast-provider"
import { useFocusTrap } from "@/lib/use-focus-trap"
import type { ShowcaseSceneHandle } from "@/lib/showcase-scene"

export interface BookShowcaseProps {
  /** The showcased book, or null when the showcase is closed. */
  book: Book | null
  onClose: () => void
  /** Opens the full Detail Modal; the pill is hidden when absent. */
  onMoreDetails?: (book: Book) => void
  /** Shown as "Read free" for books with a known free source (e.g. Gutenberg). */
  onRead?: (book: Book) => void
  /** Lets the surface refresh its local liked-list state after a toggle. */
  onSavedChange?: (book: Book, saved: boolean) => void
}

// WebGL textures need CORS-clean pixels. Remote covers go through the
// same-origin next/image optimizer (hosts are allow-listed in next.config);
// w=640 is a default deviceSize and q=75 is in the configured allowlist.
function coverTextureUrl(book: Book): string | null {
  const src = book.cover || book.coverFallback || ""
  if (!src) return null
  if (src.startsWith("/") || src.startsWith("data:")) return src
  if (src.startsWith("http"))
    return `/_next/image?url=${encodeURIComponent(src)}&w=640&q=75`
  return null
}

const BACKDROP =
  "radial-gradient(120% 100% at 50% 0%, #2B2118 0%, #1C1610 55%, #141009 100%)"

export function BookShowcase(props: BookShowcaseProps) {
  // Portal to <body>: the surfaces that mount this sit inside framer-motion
  // wrappers whose transforms create stacking contexts, which would trap the
  // overlay's z-index under the app nav no matter how high it goes.
  if (typeof document === "undefined") return null
  return createPortal(
    <AnimatePresence>
      {props.book && (
        <ShowcaseOverlay
          key={props.book.id}
          {...props}
          book={props.book}
        />
      )}
    </AnimatePresence>,
    document.body,
  )
}

function ShowcaseOverlay({
  book,
  onClose,
  onMoreDetails,
  onRead,
  onSavedChange,
}: BookShowcaseProps & { book: Book }) {
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const panelRef = useRef<HTMLDivElement>(null)
  const dialogRef = useRef<HTMLDivElement>(null)
  const sceneRef = useRef<ShowcaseSceneHandle | null>(null)
  const closingRef = useRef(false)
  const [closing, setClosing] = useState(false)
  const [saved, setSaved] = useState(() =>
    getLikedBooks().some((b) => b.id === book.id),
  )
  const { showToast } = useToast()
  useFocusTrap(dialogRef, true)

  // The scene exit runs before unmount so the book visibly leaves the frame;
  // AnimatePresence then fades the (already emptied) overlay.
  const requestClose = useCallback(() => {
    if (closingRef.current) return
    closingRef.current = true
    setClosing(true)
    const scene = sceneRef.current
    if (scene) scene.close(onClose)
    else onClose()
  }, [onClose])

  // Jumping to the full modal skips the exit turn — the modal covers us and a
  // half-visible spin underneath would just fight it.
  const jumpToDetails = useCallback(() => {
    if (!onMoreDetails || closingRef.current) return
    closingRef.current = true
    onMoreDetails(book)
    onClose()
  }, [book, onMoreDetails, onClose])

  useEffect(() => {
    const canvas = canvasRef.current
    if (!canvas) return
    let cancelled = false
    let disposed = false
    const reducedMotion = window.matchMedia(
      "(prefers-reduced-motion: reduce)",
    ).matches

    const syncViewport = () => {
      const panelTop = panelRef.current
        ? panelRef.current.getBoundingClientRect().top
        : null
      sceneRef.current?.setViewport(
        window.innerWidth,
        window.innerHeight,
        panelTop,
      )
    }

    import("@/lib/showcase-scene")
      .then((m) => {
        if (cancelled) return
        try {
          const serif =
            getComputedStyle(document.body)
              .getPropertyValue("--font-serif")
              .trim() || "Georgia, serif"
          const scene = m.createShowcaseScene(canvas, {
            reducedMotion,
            serifFamily: serif,
            onBackdropTap: requestClose,
          })
          sceneRef.current = scene
          syncViewport()
          scene.setBook({
            title: book.title,
            author: book.author,
            coverUrl: coverTextureUrl(book),
            seedHue: getSeedHue(book.title || book.cover || "book"),
          })
          scene.open()
        } catch {
          // WebGL unavailable: degrade straight to the flat Detail Modal.
          if (onMoreDetails) onMoreDetails(book)
          onClose()
        }
      })
      .catch(() => {
        if (!cancelled) onClose()
      })

    window.addEventListener("resize", syncViewport)
    window.visualViewport?.addEventListener("resize", syncViewport)
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") requestClose()
    }
    window.addEventListener("keydown", onKey)
    return () => {
      cancelled = true
      window.removeEventListener("resize", syncViewport)
      window.visualViewport?.removeEventListener("resize", syncViewport)
      window.removeEventListener("keydown", onKey)
      if (!disposed) {
        disposed = true
        sceneRef.current?.dispose()
        sceneRef.current = null
      }
    }
    // book identity is fixed per overlay instance (keyed by book.id above).
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  const toggleSaved = () => {
    const next = !saved
    if (next) {
      addLikedBook(book)
      showToast(`"${book.title}" saved to library`)
    } else {
      removeLikedBook(book.id)
      showToast(`"${book.title}" removed from library`, "info")
    }
    setSaved(next)
    onSavedChange?.(book, next)
  }

  const panelState = closing ? "exit" : "show"
  const stagger = {
    hidden: {},
    show: { transition: { staggerChildren: 0.07, delayChildren: 0.35 } },
    exit: { transition: { staggerChildren: 0.03, staggerDirection: -1 } },
  }
  const item = {
    hidden: { opacity: 0, y: 28 },
    show: {
      opacity: 1,
      y: 0,
      transition: { duration: 0.6, ease: [0.22, 1, 0.36, 1] as const },
    },
    exit: { opacity: 0, y: 18, transition: { duration: 0.22 } },
  }

  return (
    <motion.div
      ref={dialogRef}
      role="dialog"
      aria-modal="true"
      aria-labelledby="showcase-title"
      className="fixed inset-0 z-[55]"
      style={{ background: BACKDROP }}
      initial={{ opacity: 0 }}
      animate={{ opacity: closing ? 0 : 1 }}
      exit={{ opacity: 0 }}
      transition={{ duration: closing ? 0.45 : 0.35, ease: "easeOut" }}
    >
      {/* The 3D stage — pointer handling (drag to turn, backdrop tap) lives in
          the engine; the panel and buttons sit above it. */}
      <canvas
        ref={canvasRef}
        aria-hidden="true"
        className="absolute inset-0 h-full w-full touch-none"
      />

      <button
        onClick={requestClose}
        aria-label="Close preview"
        className="absolute right-4 top-4 z-10 flex h-12 w-12 items-center justify-center rounded-full border-[1.5px] border-[#F5EFE0]/40 text-[#F5EFE0] transition-colors hover:border-[#F5EFE0]/90 lg:left-1/2 lg:right-auto lg:top-7 lg:-translate-x-1/2 tap-target"
      >
        <X className="h-5 w-5" />
      </button>

      {/* Info panel: bottom sheet on small screens, right column on large.
          The outer div is transform-free so the engine can measure its top
          edge to place the book above it in portrait. */}
      <div
        ref={panelRef}
        className="absolute bottom-[max(env(safe-area-inset-bottom),16px)] left-1/2 w-[min(560px,92vw)] -translate-x-1/2 lg:bottom-auto lg:left-auto lg:right-[7vw] lg:top-1/2 lg:w-[min(560px,42vw)] lg:-translate-y-1/2 lg:translate-x-0"
      >
        <motion.div variants={stagger} initial="hidden" animate={panelState}>
          <motion.h1
            variants={item}
            id="showcase-title"
            className="font-serif font-bold leading-[0.98] tracking-tight text-[#F5EFE0] text-[clamp(34px,8.5vw,52px)] lg:text-[clamp(48px,4.8vw,80px)]"
          >
            {book.title}
          </motion.h1>

          <motion.p
            variants={item}
            className="mt-3 text-sm text-[#D8CDB8]/80 lg:mt-5 lg:text-base"
          >
            {book.author}
            {book.publishedYear ? ` · ${book.publishedYear}` : ""}
          </motion.p>

          <motion.p
            variants={item}
            className="mt-3 max-w-[54ch] text-[15px] leading-[1.65] text-[#D8CDB8] line-clamp-3 sm:line-clamp-4 lg:mt-6 lg:text-[17px] lg:line-clamp-[7]"
          >
            {book.description}
          </motion.p>

          <motion.div
            variants={item}
            className="mt-4 flex items-center gap-4 lg:mt-7"
          >
            {book.rating > 0 && (
              <StarRating rating={book.rating} readonly size="sm" />
            )}
            {book.readingTime && (
              <>
                <div className="h-6 w-px bg-[#D8CDB8]/25" />
                <span className="text-sm italic text-[#D8CDB8]/70">
                  {book.readingTime}
                </span>
              </>
            )}
          </motion.div>

          {book.genre.length > 0 && (
            <motion.div variants={item} className="mt-4 flex flex-wrap gap-2">
              {book.genre.slice(0, 3).map((g) => (
                <span
                  key={g}
                  className="rounded-full border border-[#F5EFE0]/20 px-3 py-1 text-xs text-[#D8CDB8]"
                >
                  {g}
                </span>
              ))}
            </motion.div>
          )}

          <motion.div
            variants={item}
            className="mt-4 border-t border-[#D8CDB8]/15 lg:mt-6"
          />

          <motion.div
            variants={item}
            className="mt-4 inline-flex flex-wrap items-center gap-2 rounded-[28px] bg-[#241B13]/90 p-2.5 shadow-[0_24px_60px_rgba(0,0,0,0.45)] lg:mt-7 lg:rounded-full"
          >
            {onRead && (
              <button
                onClick={() => onRead(book)}
                className="inline-flex h-12 items-center gap-2 rounded-full bg-amber-600 px-6 text-[15px] font-semibold text-white transition-transform hover:scale-[1.04] tap-target"
              >
                <BookOpen className="h-4 w-4" />
                Read free
              </button>
            )}
            <button
              onClick={toggleSaved}
              className={`inline-flex h-12 items-center gap-2 rounded-full px-6 text-[15px] font-semibold transition-transform hover:scale-[1.04] tap-target ${
                saved
                  ? "bg-[#F5EFE0]/15 text-[#F5EFE0]"
                  : "bg-[#F5EFE0] text-[#2B2118]"
              }`}
            >
              <Heart className={`h-4 w-4 ${saved ? "fill-current" : ""}`} />
              {saved ? "Saved" : "Save"}
            </button>
            {onMoreDetails && (
              <button
                onClick={jumpToDetails}
                className="inline-flex h-12 items-center gap-2 rounded-full bg-white/10 px-6 text-[15px] font-semibold text-[#F5EFE0] transition-transform hover:scale-[1.04] tap-target"
              >
                <Info className="h-4 w-4" />
                Details
              </button>
            )}
          </motion.div>
        </motion.div>
      </div>
    </motion.div>
  )
}
