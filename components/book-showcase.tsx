"use client"

// Full-screen 3D book Showcase (docs/adr/0004): the cinematic first layer on
// discovery-surface book taps. The WebGL engine lives in lib/showcase-scene
// (loaded on demand so three.js never reaches the main bundle); this file is
// the thin React glue: overlay, info panel, action pills, choreography.
import { useCallback, useEffect, useRef, useState } from "react"
import { createPortal } from "react-dom"
import { motion, AnimatePresence } from "framer-motion"
import { X, Heart, BookOpen, Info, Eye, Loader2, ChevronRight } from "lucide-react"
import { Book } from "@/lib/book-data"
import { searchGutenberg, fetchBookText, type GutenbergBook } from "@/lib/gutenberg-api"
import { addLikedBook, removeLikedBook, getLikedBooks } from "@/lib/storage"
import { enrichBook, persistEnrichedBooks, formatCount } from "@/lib/book-enrichment"
import { getSeedHue } from "@/components/book-cover"
import { StarRating } from "@/components/star-rating"
import { useToast } from "@/components/toast-provider"
import { useFocusTrap } from "@/lib/use-focus-trap"
import type { ShowcaseSceneHandle } from "@/lib/showcase-scene"
import { hasVerifiedRating } from "@/lib/book-truth"
import { useOverlayHistory } from "@/lib/use-overlay-history"
import { RatingBreakdownPanel } from "@/components/rating-breakdown-panel"
import { t } from "@/lib/i18n"

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
  /** Known Gutenberg identity (free-books browser) — skips the probe. */
  gutenbergBook?: GutenbergBook
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
  // Gated on props.book, NOT on mount: this component stays mounted with a
  // null book while the deck is open, so a constant `true` pushed the history
  // entry at app start and the deck own navigation then buried it. Back closes
  // the Showcase instead of destroying the deck underneath it.
  useOverlayHistory("showcase", Boolean(props.book), props.onClose)
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
  gutenbergBook,
}: BookShowcaseProps & { book: Book }) {
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const panelRef = useRef<HTMLDivElement>(null)
  const dialogRef = useRef<HTMLDivElement>(null)
  const sceneRef = useRef<ShowcaseSceneHandle | null>(null)
  const engineModRef = useRef<typeof import("@/lib/showcase-scene") | null>(null)
  const serifRef = useRef("Georgia, serif")
  const closingRef = useRef(false)
  const peekingRef = useRef(false)
  const [closing, setClosing] = useState(false)
  const [peeking, setPeeking] = useState(false)
  const [peekLoading, setPeekLoading] = useState(false)
  // undefined = probing, null = no free edition, GutenbergBook = peekable
  const [gutenberg, setGutenberg] = useState<GutenbergBook | null | undefined>(
    gutenbergBook ?? undefined,
  )
  const [saved, setSaved] = useState(() =>
    getLikedBooks().some((b) => b.id === book.id),
  )
  // Enrich-on-open (ADR-0005): the panel upgrades to Goodreads-parity fields
  // as they land — `book` stays the scene's identity, `display` feeds text.
  const [display, setDisplay] = useState(book)
  // Whether the description is actually cut off. Measured after paint rather
  // than guessed from length: the clamp is line-based and the panel width
  // changes between phone and desktop, so a character count would be wrong at
  // one of them.
  const [ratingsOpen, setRatingsOpen] = useState(false)
  const [descExpanded, setDescExpanded] = useState(false)
  const [descClamped, setDescClamped] = useState(false)
  // A new book starts collapsed. Adjusted during render rather than in an
  // effect, so there is no extra commit and no expanded flash on book change.
  const [descBookId, setDescBookId] = useState(book.id)
  if (descBookId !== book.id) {
    setDescBookId(book.id)
    setDescExpanded(false)
    setRatingsOpen(false)
  }
  const descRef = useRef<HTMLParagraphElement | null>(null)
  const { showToast } = useToast()
  useFocusTrap(dialogRef, true)

  // Re-measure whenever the text or the width could have changed.
  useEffect(() => {
    const el = descRef.current
    if (!el) return
    const measure = () => {
      // Only meaningful while collapsed: once expanded the element grows to fit,
      // so scrollHeight === clientHeight and a naive re-measure would decide
      // there is nothing to expand and remove the control the user needs to
      // collapse again.
      if (descExpanded) return
      setDescClamped(el.scrollHeight > el.clientHeight + 2)
    }
    measure()
    const ro = new ResizeObserver(measure)
    ro.observe(el)
    return () => ro.disconnect()
  }, [display.description, descExpanded])

  // Lock the page behind the takeover. Measured at 1280x900: a wheel over the
  // open Showcase scrolled the library underneath from 400 to 1582 while the
  // Showcase stayed put. The scrollbar's width is compensated so the page does
  // not shift sideways as it locks.
  useEffect(() => {
    const { body } = document
    const prevOverflow = body.style.overflow
    const prevPadding = body.style.paddingRight
    const gutter = window.innerWidth - document.documentElement.clientWidth
    body.style.overflow = "hidden"
    if (gutter > 0) body.style.paddingRight = `${gutter}px`
    return () => {
      body.style.overflow = prevOverflow
      body.style.paddingRight = prevPadding
    }
  }, [])

  useEffect(() => {
    let cancelled = false
    enrichBook(book).then((b) => {
      if (!cancelled && b !== book) {
        setDisplay(b)
        persistEnrichedBooks([b])
      }
    })
    // Free-edition probe (session-cached) gates the "Peek inside" pill; the
    // free-books browser passes its Gutenberg identity and skips this.
    if (gutenbergBook === undefined) {
      searchGutenberg(book.title, book.author).then((gb) => {
        if (!cancelled) setGutenberg(gb)
      })
    }
    return () => {
      cancelled = true
    }
    // book identity is fixed per overlay instance (keyed by book.id).
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  // The scene exit runs before unmount so the book visibly leaves the frame;
  // AnimatePresence then fades the (already emptied) overlay.
  const requestClose = useCallback(() => {
    if (closingRef.current) return
    closingRef.current = true
    peekingRef.current = false
    setClosing(true)
    const scene = sceneRef.current
    if (scene) scene.close(onClose)
    else onClose()
  }, [onClose])

  const exitPeek = useCallback(() => {
    peekingRef.current = false
    setPeeking(false)
    sceneRef.current?.closePeek()
  }, [])

  // Escape and backdrop taps close the peek first, then the showcase.
  const dismiss = useCallback(() => {
    if (peekingRef.current) exitPeek()
    else requestClose()
  }, [exitPeek, requestClose])

  const handlePeek = useCallback(async () => {
    const scene = sceneRef.current
    const mod = engineModRef.current
    if (!scene || !mod || !gutenberg || peekingRef.current || peekLoading) return
    setPeekLoading(true)
    // Public-domain text only: fetchBookText serves Project Gutenberg editions
    // with the license boilerplate stripped, session-cached.
    const text = await fetchBookText(gutenberg)
    setPeekLoading(false)
    if (closingRef.current) return
    if (!text) {
      showToast(t("book_showcase.preview_unavailable_right_now"), "info")
      return
    }
    const page = document.createElement("canvas")
    page.width = 1024
    page.height = 1536
    mod.paintFirstPage(page, {
      title: book.title,
      author: book.author,
      text: text.slice(0, 4000),
      serifFamily: serifRef.current,
    })
    scene.setPageTexture(page)
    scene.openPeek()
    peekingRef.current = true
    setPeeking(true)
  }, [gutenberg, peekLoading, book.title, book.author, showToast])

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
          engineModRef.current = m
          serifRef.current = serif
          const scene = m.createShowcaseScene(canvas, {
            reducedMotion,
            serifFamily: serif,
            onBackdropTap: dismiss,
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
      if (e.key === "Escape") dismiss()
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
        aria-label={t("book_showcase.close_showcase")}
        className="absolute right-4 top-4 z-10 flex h-12 w-12 items-center justify-center rounded-full border-[1.5px] border-[rgba(245,239,224,.4)] text-stage-ink transition-colors hover:border-[rgba(245,239,224,.9)] lg:left-1/2 lg:right-auto lg:top-7 lg:-translate-x-1/2 tap-target"
      >
        <X className="h-5 w-5" />
      </button>

      {/* Reading bar — replaces the panel while the first page is open */}
      <AnimatePresence>
        {peeking && (
          <motion.div
            initial={{ opacity: 0, y: 24 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: 24 }}
            transition={{ duration: 0.3, ease: "easeOut" }}
            className="absolute bottom-[max(env(safe-area-inset-bottom),20px)] left-1/2 z-10 flex -translate-x-1/2 items-center gap-2 rounded-full bg-[rgba(23,19,15,.92)] p-2.5 shadow-[0_24px_60px_rgba(0,0,0,0.45)]"
          >
            <button
              onClick={() => (onRead ? onRead(book) : jumpToDetails())}
              className="inline-flex h-12 items-center gap-2 rounded-full bg-stage-amber px-6 text-[15px] font-semibold text-on-stage-amber transition-transform hover:scale-[1.04] tap-target"
            >
              <BookOpen className="h-4 w-4" /> {t("book_showcase.keep_reading")} </button>
            <button
              onClick={exitPeek}
              className="inline-flex h-12 items-center gap-2 rounded-full bg-white/10 px-6 text-[15px] font-semibold text-stage-ink transition-transform hover:scale-[1.04] tap-target"
            > {t("book_showcase.close_preview")} </button>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Info panel: bottom sheet on small screens, right column on large.
          The outer div is transform-free so the engine can measure its top
          edge to place the book above it in portrait. Fades away while the
          first page is open so nothing competes with the text. */}
      <div
        ref={panelRef}
        className={`absolute bottom-[max(env(safe-area-inset-bottom),16px)] left-1/2 w-[min(560px,92vw)] -translate-x-1/2 transition-opacity duration-300 lg:bottom-auto lg:left-auto lg:right-[7vw] lg:top-1/2 lg:w-[min(560px,42vw)] lg:-translate-y-1/2 lg:translate-x-0 ${peeking ? t("book_showcase.pointer_events_none_opacity_0") : "opacity-100"}`}
      >
        <motion.div variants={stagger} initial="hidden" animate={panelState}>
          <motion.h1
            variants={item}
            id="showcase-title"
            className="font-serif font-semibold leading-[1.0] tracking-[-0.02em] text-stage-ink text-[clamp(34px,9vw,40px)] lg:leading-[0.98] lg:text-[clamp(48px,4.6vw,68px)]"
          >
            {book.title}
          </motion.h1>

          <motion.p
            variants={item}
            className="mt-3 text-sm text-stage-ink-muted lg:mt-5 lg:text-base"
          >
            {display.author}
            {display.publishedYear ? ` · ${display.publishedYear}` : ""}
          </motion.p>

          {(display.metadata?.enriched?.series ||
            display.metadata?.enriched?.firstPublished) && (
            <motion.p
              variants={item}
              className="mt-1.5 font-serif text-[13px] italic text-stage-ink-tertiary lg:text-sm"
            >
              {[
                display.metadata.enriched.series
                  ? display.metadata.enriched.series.index
                    ? `Book ${display.metadata.enriched.series.index} of ${display.metadata.enriched.series.name}`
                    : display.metadata.enriched.series.name
                  : null,
                display.metadata.enriched.firstPublished
                  ? `First published ${display.metadata.enriched.firstPublished}`
                  : null,
              ]
                .filter(Boolean)
                .join(" · ")}
            </motion.p>
          )}

          {/* Clamped copy that can be opened. The ellipsis was previously a
              dead end: it promised more and offered no way to get it. The
              paragraph is only interactive when it is actually overflowing —
              measured, not assumed — so a short description carries no
              misleading affordance. */}
          <motion.div variants={item} className="mt-3 max-w-[54ch] lg:mt-6">
            <p
              ref={descRef}
              id="showcase-description"
              className={`text-[15px] leading-[1.6] text-stage-ink-muted lg:text-[17px] lg:leading-[1.65] ${
                descExpanded ? "" : t("book_showcase.line_clamp_4_lg_line_clamp")
              }`}
            >
              {display.description}
            </p>
            {descClamped && (
              <button
                type="button"
                onClick={() => setDescExpanded((v) => !v)}
                aria-expanded={descExpanded}
                aria-controls="showcase-description"
                className="mt-1.5 inline-flex min-h-[40px] items-center gap-1 text-[14px] font-medium text-stage-amber transition-opacity hover:opacity-80"
              >
                {descExpanded ? t("book_card.show_less") : t("book_card.read_more")}
                <svg
                  width="15"
                  height="15"
                  viewBox="0 0 24 24"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="2"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  style={{ transform: descExpanded ? "rotate(180deg)" : "none" }}
                >
                  <path d="M6 9l6 6 6-6"></path>
                </svg>
              </button>
            )}
          </motion.div>

          <motion.div
            variants={item}
            className="mt-4 flex items-center gap-4 lg:mt-7"
          >
            {/* The rating opens its own breakdown. "8 ratings" never appears
                on its own: with the stars hidden for being under the
                confidence floor, a bare count reads as a missing number
                rather than as a deliberate omission. */}
            {hasVerifiedRating(display) && (
              <button
                type="button"
                onClick={() => setRatingsOpen(true)}
                aria-haspopup="dialog"
                aria-label={`See how readers rated ${display.title}`}
                className="-mx-2 inline-flex min-h-[44px] items-center gap-2.5 rounded-full px-2 transition-colors hover:bg-white/10"
              >
                <StarRating rating={display.rating} readonly size="sm" />
                {display.metadata?.ratingsCount ? (
                  <span className="text-sm text-stage-ink-muted tabular-nums">
                    {formatCount(display.metadata.ratingsCount)} {t("common.ratings")} </span>
                ) : null}
                <ChevronRight className="h-4 w-4 text-stage-ink-tertiary" />
              </button>
            )}
            {display.readingTime && (
              <>
                <div className="h-6 w-px bg-stage-hairline" />
                <span className="font-serif text-sm italic text-stage-ink-tertiary">
                  {display.readingTime}
                </span>
              </>
            )}
          </motion.div>

          {display.genre.length > 0 && (
            <motion.div variants={item} className="mt-4 flex flex-wrap gap-2">
              {display.genre.slice(0, 3).map((g) => (
                <span
                  key={g}
                  className="h-[29px] inline-flex items-center rounded-full border border-stage-hairline px-3 text-xs text-stage-ink-muted"
                >
                  {g}
                </span>
              ))}
            </motion.div>
          )}

          <motion.div
            variants={item}
            className="mt-4 border-t border-stage-hairline lg:mt-6"
          />

          <motion.div
            variants={item}
            className="mt-4 inline-flex flex-wrap items-center gap-2 rounded-[28px] bg-[rgba(23,19,15,.92)] p-2.5 shadow-[0_24px_60px_rgba(0,0,0,0.45)] lg:mt-7 lg:rounded-full"
          >
            {onRead && (
              <button
                onClick={() => onRead(book)}
                className="inline-flex h-12 items-center gap-2 rounded-full bg-stage-amber px-6 text-[15px] font-semibold text-on-stage-amber transition-transform hover:scale-[1.04] tap-target"
              >
                <BookOpen className="h-4 w-4" /> {t("book_showcase.read_free")} </button>
            )}
            {gutenberg ? (
              <button
                onClick={handlePeek}
                disabled={peekLoading}
                className="inline-flex h-12 items-center gap-2 rounded-full border-[1.5px] border-[rgba(245,239,224,.4)] px-6 text-[15px] font-semibold text-stage-ink transition-transform hover:scale-[1.04] disabled:opacity-60 tap-target"
              >
                {peekLoading ? (
                  <Loader2 className="h-4 w-4 animate-spin" />
                ) : (
                  <Eye className="h-4 w-4" />
                )} {t("book_showcase.peek_inside")} </button>
            ) : null}
            <button
              onClick={toggleSaved}
              className={`inline-flex h-12 items-center gap-2 rounded-full px-6 text-[15px] font-semibold transition-transform hover:scale-[1.04] tap-target ${
                saved
                  ? "bg-[rgba(245,239,224,.15)] text-stage-ink"
                  : "bg-[#F5EFE0] text-[#2B2118]"
              }`}
            >
              <Heart className={`h-4 w-4 ${saved ? "fill-current" : ""}`} />
              {saved ? "Saved" : "Save"}
            </button>
            {onMoreDetails && (
              <button
                onClick={jumpToDetails}
                className="inline-flex h-12 items-center gap-2 rounded-full bg-white/10 px-6 text-[15px] font-semibold text-stage-ink transition-transform hover:scale-[1.04] tap-target"
              >
                <Info className="h-4 w-4" /> {t("book_showcase.details")} </button>
            )}
          </motion.div>
        </motion.div>
      </div>

      <RatingBreakdownPanel
        book={ratingsOpen ? display : null}
        onClose={() => setRatingsOpen(false)}
      />
    </motion.div>
  )
}
