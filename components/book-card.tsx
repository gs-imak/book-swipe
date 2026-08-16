"use client"

import { motion, PanInfo, useMotionValue, useTransform } from "framer-motion"
import { Book } from "@/lib/book-data"
import { Star, Clock, BookOpen, Info, Plus, ChevronDown, Heart } from "lucide-react"
import { addBookToReading, getReadingProgress } from "@/lib/storage"
import { hapticLight } from "@/lib/haptics"
import { Button } from "@/components/ui/button"
import { BookCover } from "@/components/book-cover"
import { formatCount } from "@/lib/book-enrichment"
import { useToast } from "./toast-provider"
import { useState, useRef } from "react"

interface BookCardProps {
  book: Book
  onSwipe: (direction: "left" | "right") => void
  isTop?: boolean
  showActions?: boolean
  reason?: string
  /** How many readers with similar taste also saved this book (social proof). */
  coLikeCount?: number
  /** Clean tap on the top card (not a drag, not a button) — opens the Showcase. */
  onOpenDetails?: () => void
}

// Modern Editorial deck card (design handoff §1b): the card IS the book — a
// cover object with a caption below it, sitting directly on the page surface.
// No card box, no blurred fill, no bottom gradient. All gesture mechanics are
// unchanged engineering assets.
export function BookCard({ book, onSwipe, isTop = false, showActions = true, reason, coLikeCount, onOpenDetails }: BookCardProps) {
  const [infoExpanded, setInfoExpanded] = useState(false)
  const [descExpanded, setDescExpanded] = useState(false)
  const sheetY = useMotionValue(0)
  const { showToast } = useToast()
  const x = useMotionValue(0)
  const rotate = useTransform(x, [-200, 0, 200], [-12, 0, 12])
  const saveOpacity = useTransform(x, [0, 80], [0, 1])
  const passOpacity = useTransform(x, [-80, 0], [1, 0])

  // Distinguishes a tap from a swipe: framer fires onDragStart only after real
  // movement, and the browser still emits a click on release — so the flag is
  // cleared a beat later to swallow that post-drag click.
  const draggingRef = useRef(false)

  const handleCardTap = (e: React.MouseEvent) => {
    if (!isTop || !onOpenDetails || infoExpanded || draggingRef.current) return
    if ((e.target as HTMLElement).closest("button")) return
    onOpenDetails()
  }

  const handleDragEnd = (_event: MouseEvent | TouchEvent | PointerEvent, info: PanInfo) => {
    setTimeout(() => {
      draggingRef.current = false
    }, 80)
    // Scale threshold to screen width so small phones don't get accidental swipes
    const threshold = Math.max(60, Math.min(100, window.innerWidth * 0.22))
    const velocity = info.velocity.x
    const offset = info.offset.x

    if (offset > threshold || velocity > 400) {
      hapticLight()
      onSwipe("right")
    } else if (offset < -threshold || velocity < -400) {
      hapticLight()
      onSwipe("left")
    }
  }

  const handleStartReading = () => {
    const alreadyReading = getReadingProgress().some(p => p.bookId === book.id)
    if (alreadyReading) {
      showToast("Already in your reading list", "info")
      return
    }
    addBookToReading(book)
    showToast(`"${book.title}" added to reading list`)
  }

  const readTime = book.pages >= 60 ? `~${Math.round(book.pages / 40)} h` : `~${Math.round((book.pages / 40) * 60)} m`
  const ratingsCount = book.metadata?.ratingsCount

  return (
    <motion.div
      className={`absolute inset-0 ${isTop ? "z-10" : "z-0"}`}
      style={isTop ? { x, rotate } : undefined}
      // Background cards are purely visual — inert removes their ~8 invisible
      // tab stops (Info, sheet buttons) so keyboard focus can't act on a card
      // the user isn't seeing. React 19 supports inert as a boolean prop.
      inert={!isTop}
      drag={isTop && !infoExpanded ? "x" : false}
      dragConstraints={{ left: -250, right: 250 }}
      onDragStart={() => {
        draggingRef.current = true
      }}
      onDragEnd={handleDragEnd}
      // Next-card peek (§1b): rises 11px behind the top card, slightly
      // smaller, half-faded and desaturated.
      initial={{ scale: isTop ? 1 : 0.955, opacity: isTop ? 1 : 0.5, y: isTop ? 0 : -11 }}
      animate={{
        scale: isTop ? 1 : 0.955,
        opacity: isTop ? 1 : 0.5,
        y: isTop ? 0 : -11,
        filter: isTop ? "saturate(1)" : "saturate(.85)",
      }}
      whileDrag={{ scale: 1.02 }}
      dragElastic={0.4}
      dragTransition={{ bounceStiffness: 500, bounceDamping: 25 }}
      transition={{ type: "spring", stiffness: 300, damping: 30 }}
    >
      <div className="relative h-full w-full" onClick={handleCardTap}>
        <div className="flex h-full w-full flex-col items-center lg:flex-row lg:items-start lg:justify-center lg:gap-16">
          {/* Cover object — radius 5px (covers are books), object shadow */}
          <div className="relative w-[264px] h-[396px] lg:w-[312px] lg:h-[468px] flex-shrink-0 rounded-cover shadow-cover overflow-hidden bg-surface-2">
            <BookCover
              src={book.cover}
              fallbackSrc={book.coverFallback}
              alt={book.title}
              fill
              className="object-cover"
              sizes="(max-width: 1023px) 264px, 312px"
              priority={isTop}
            />
            {/* Rating badge — 22px pill over the cover, top-left */}
            <div className="absolute top-2.5 left-2.5 h-[22px] px-2 rounded-full bg-[rgba(28,23,18,.8)] flex items-center gap-1 z-10">
              <Star className="w-3 h-3 fill-stage-amber text-stage-amber" />
              <span className="text-[11px] font-semibold text-white tabular-nums">{book.rating}</span>
            </div>

            {/* SAVE / PASS drag stamps (§1b), over the cover */}
            {isTop && (
              <>
                <motion.div
                  className="absolute top-6 left-4 z-20 rounded-lg border-[2.5px] border-success-ink px-3 py-0.5 -rotate-10 bg-[rgba(20,17,16,.4)]"
                  style={{ opacity: saveOpacity, rotate: -10 }}
                >
                  <span className="text-success-ink dark:text-[#A3C168] text-[17px] font-extrabold tracking-[0.14em]">SAVE</span>
                </motion.div>
                <motion.div
                  className="absolute top-6 right-4 z-20 rounded-lg border-[2.5px] border-ink-muted px-3 py-0.5 bg-[rgba(20,17,16,.4)]"
                  style={{ opacity: passOpacity, rotate: 10 }}
                >
                  <span className="text-ink-muted text-[17px] font-extrabold tracking-[0.14em]">PASS</span>
                </motion.div>
              </>
            )}
          </div>

          {/* Caption — left-aligned column under (mobile) / beside (desktop) */}
          <div className="w-[300px] lg:w-[420px] pt-5 lg:pt-2 text-left">
            {reason && (
              <p className="text-[10.5px] font-semibold uppercase tracking-[0.1em] text-ink-muted truncate mb-1.5">
                {reason}
              </p>
            )}
            <h3 className="font-serif font-semibold text-[22px] leading-[1.22] lg:text-[36px] lg:leading-[1.12] text-ink line-clamp-3">
              {book.title}
            </h3>
            <div className="flex items-center justify-between gap-3 mt-1">
              <p className="text-[15px] text-ink-muted truncate">{book.author}</p>
              {/* Info button — opens the expanded sheet */}
              <motion.button
                whileTap={{ scale: 0.97 }}
                onClick={() => setInfoExpanded(true)}
                aria-label="View book details"
                className="w-9 h-9 -mr-1 rounded-full flex items-center justify-center flex-shrink-0 text-ink-muted hover:text-ink hover:bg-surface-2 transition-colors tap-target"
              >
                <Info className="w-[18px] h-[18px]" />
              </motion.button>
            </div>

            <div className="border-t border-border mt-3 pt-3">
              <p className="text-[13px] text-ink-muted tabular-nums">
                {book.pages} pp · {readTime} · ★ {book.rating}
                {ratingsCount ? ` · ${formatCount(ratingsCount)} ratings` : ""}
              </p>
            </div>

            {isTop && typeof coLikeCount === "number" && coLikeCount > 0 && (
              <div className="flex items-center gap-1.5 mt-2 text-success-ink text-[12.5px] font-semibold">
                <Heart className="w-3 h-3 fill-current flex-shrink-0" />
                <span>
                  {coLikeCount} {coLikeCount === 1 ? "reader" : "readers"} with your taste saved this
                </span>
              </div>
            )}

            {/* ONE chip system: hairline outline, no pastel fills */}
            <div className="flex flex-wrap gap-1.5 mt-3">
              {book.genre.slice(0, 3).map((genre) => (
                <span
                  key={genre}
                  className="h-[27px] inline-flex items-center px-3 rounded-full border border-border-strong text-[12.5px] text-ink"
                >
                  {genre}
                </span>
              ))}
            </div>
          </div>
        </div>

        {/* Expanded info sheet — kept mounted for the spring close and
            drag-to-dismiss, so it must be inert while translated off-card
            or its Close/Read-more/Add buttons stay in the tab order. */}
        <motion.div
          initial={false}
          inert={!infoExpanded}
          animate={{ y: infoExpanded ? 0 : '100%' }}
          transition={{ type: "spring", damping: 32, stiffness: 320 }}
          className="absolute inset-0 bg-surface-1 z-30 flex flex-col rounded-t-sheet border border-border shadow-e3"
          style={{ y: sheetY, touchAction: 'pan-y' }}
          drag={infoExpanded ? "y" : false}
          dragConstraints={{ top: 0, bottom: 0 }}
          dragElastic={{ top: 0, bottom: 0.3 }}
          onDragEnd={(_e, info) => {
            if (info.offset.y > 80 || info.velocity.y > 400) {
              sheetY.set(0)
              setInfoExpanded(false)
            } else {
              sheetY.set(0)
            }
          }}
        >
          {/* Handle bar */}
          <div className="flex-shrink-0 pt-2 pb-1 flex flex-col items-center border-b border-border">
            <div className="w-10 h-1 rounded-full bg-border-strong mb-2" />
            <button
              onClick={() => setInfoExpanded(false)}
              aria-label="Close details"
              className="flex items-center gap-1 text-ink-muted hover:text-ink transition-colors px-3 py-2 min-h-[44px]"
            >
              <ChevronDown className="w-5 h-5" />
              <span className="text-xs font-medium">Close</span>
            </button>
          </div>

          {/* Scrollable content */}
          <div className="flex-1 overflow-y-auto overscroll-contain">
            <div className="p-5 space-y-5">
              {reason && (
                <p className="text-[10.5px] font-semibold uppercase tracking-[0.1em] text-ink-muted">
                  {reason}
                </p>
              )}

              {/* Title and Author */}
              <div>
                <h2 className="text-xl font-semibold text-ink mb-1 font-serif">
                  {book.title}
                </h2>
                <p className="text-base text-ink-muted">{book.author}</p>
              </div>

              {/* Stats — serif numbers over hairlines, no tile boxes */}
              <div className="grid grid-cols-3 divide-x divide-border border-y border-border py-3">
                <div className="text-center px-2">
                  <p className="font-serif font-semibold text-[21px] text-ink tabular-nums">{book.rating}</p>
                  <p className="text-xs text-ink-muted mt-0.5">rating</p>
                </div>
                <div className="text-center px-2">
                  <p className="font-serif font-semibold text-[21px] text-ink tabular-nums">{book.pages}</p>
                  <p className="text-xs text-ink-muted mt-0.5">pages</p>
                </div>
                <div className="text-center px-2">
                  <p className="font-serif font-semibold text-[21px] text-ink tabular-nums">{readTime}</p>
                  <p className="text-xs text-ink-muted mt-0.5">read time</p>
                </div>
              </div>

              {/* Genres */}
              <div>
                <h3 className="text-[11px] font-bold text-ink-muted uppercase tracking-[0.12em] mb-2">
                  Genres
                </h3>
                <div className="flex flex-wrap gap-1.5">
                  {book.genre.map((genre) => (
                    <span
                      key={genre}
                      className="h-[27px] inline-flex items-center px-3 rounded-full border border-border-strong text-[12.5px] text-ink"
                    >
                      {genre}
                    </span>
                  ))}
                </div>
              </div>

              {/* Moods */}
              {book.mood.length > 0 && (
                <div>
                  <h3 className="text-[11px] font-bold text-ink-muted uppercase tracking-[0.12em] mb-2">
                    Vibes
                  </h3>
                  <div className="flex flex-wrap gap-1.5">
                    {book.mood.map((mood) => (
                      <span
                        key={mood}
                        className="h-[27px] inline-flex items-center px-3 rounded-full border border-border text-[12.5px] text-ink-muted"
                      >
                        {mood}
                      </span>
                    ))}
                  </div>
                </div>
              )}

              {/* Description — collapsible */}
              <div>
                <h3 className="text-[11px] font-bold text-ink-muted uppercase tracking-[0.12em] mb-2">
                  About
                </h3>
                <p className={`text-[15px] text-ink leading-[1.6] max-w-[54ch] ${descExpanded ? "" : "line-clamp-3"}`}>
                  {book.description}
                </p>
                {book.description.length > 150 && (
                  <button
                    onClick={() => setDescExpanded(!descExpanded)}
                    className="text-xs text-accent-ink font-medium mt-1.5 hover:underline"
                  >
                    {descExpanded ? "Show less" : "Read more"}
                  </button>
                )}
              </div>

              {/* Action button — save semantics = success */}
              {showActions && (
                <div className="pt-1 pb-4">
                  <Button
                    onClick={handleStartReading}
                    className="w-full bg-success hover:bg-success/90 text-on-success rounded-control h-12 text-[15px] font-semibold"
                  >
                    <Plus className="w-4 h-4 mr-2" />
                    Add to Reading List
                  </Button>
                </div>
              )}
            </div>
          </div>
        </motion.div>
      </div>
    </motion.div>
  )
}
