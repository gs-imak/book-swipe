"use client"

// What sits behind a book's average rating.
//
// Readers asked to tap a rating and "read the reviews". Review PROSE is not
// available from any source this app can reach — the Google Books v1 API has
// no review field, Open Library stores none, and the Goodreads API was
// withdrawn in 2020 — so this panel answers the question the reviews were
// wanted for instead: how the ratings are actually distributed. A 4.0 built
// from a wall of fives and a hostile minority is a different book from a 4.0
// everybody found fine, and the average cannot tell those apart.
//
// The source is named on the panel. Doing otherwise would present one
// community's 179 ratings as the whole world's verdict.

import { useEffect, useRef, useState } from "react"
import { createPortal } from "react-dom"
import { motion, AnimatePresence } from "framer-motion"
import { X, ExternalLink, Loader2 } from "lucide-react"
import { Book } from "@/lib/book-data"
import { useFocusTrap } from "@/lib/use-focus-trap"
import { useOverlayHistory } from "@/lib/use-overlay-history"
import { formatCount } from "@/lib/book-enrichment"
import {
  toBars,
  polarisation,
  type RatingBreakdown,
} from "@/lib/rating-breakdown-shared"

export interface RatingBreakdownPanelProps {
  /** The book whose ratings to break down, or null when closed. */
  book: Book | null
  onClose: () => void
}

// One lookup per book per session. The route is cached server-side too, but a
// reader who opens and closes the panel three times should cost zero requests.
const cache = new Map<string, RatingBreakdown>()

export function RatingBreakdownPanel({ book, onClose }: RatingBreakdownPanelProps) {
  useOverlayHistory("rating-breakdown", Boolean(book), onClose)

  const [data, setData] = useState<RatingBreakdown | null>(
    () => (book ? cache.get(book.id) ?? null : null),
  )
  const [loading, setLoading] = useState(() => (book ? !cache.has(book.id) : false))
  const panelRef = useRef<HTMLDivElement>(null)
  useFocusTrap(panelRef, Boolean(book))

  // A different book resets the panel during render rather than in an effect,
  // so opening one whose numbers are already cached paints them on the first
  // commit instead of flashing a spinner it never needed.
  const [shownId, setShownId] = useState<string | null>(book?.id ?? null)
  if (book && shownId !== book.id) {
    setShownId(book.id)
    const cached = cache.get(book.id) ?? null
    setData(cached)
    setLoading(!cached)
  }

  useEffect(() => {
    if (!book || cache.has(book.id)) return
    const key = book.id
    const controller = new AbortController()
    const params = new URLSearchParams({ title: book.title, author: book.author })
    if (book.isbn) params.set("isbn", book.isbn)
    fetch(`/api/book-ratings?${params.toString()}`, { signal: controller.signal })
      .then((r) => (r.ok ? r.json() : null))
      .then((json: RatingBreakdown | null) => {
        const value = json ?? { found: false, source: "openlibrary" as const }
        cache.set(key, value)
        setData(value)
      })
      .catch(() => {
        // An aborted fetch is a closed panel, not a failure worth showing.
        if (!controller.signal.aborted) setData({ found: false, source: "openlibrary" })
      })
      .finally(() => {
        if (!controller.signal.aborted) setLoading(false)
      })
    return () => controller.abort()
  }, [book])

  useEffect(() => {
    if (!book) return
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        e.stopPropagation()
        onClose()
      }
    }
    document.addEventListener("keydown", onKey)
    return () => document.removeEventListener("keydown", onKey)
  }, [book, onClose])

  if (typeof document === "undefined") return null

  const bars = data?.counts ? toBars(data.counts) : []
  const split = data?.counts ? polarisation(data.counts) : null

  return createPortal(
    <AnimatePresence>
      {book && (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          transition={{ duration: 0.18 }}
          className="fixed inset-0 z-[130] flex items-end justify-center bg-black/70 p-0 backdrop-blur-sm sm:items-center sm:p-6"
          onClick={onClose}
        >
          <motion.div
            ref={panelRef}
            role="dialog"
            aria-modal="true"
            aria-labelledby="rating-breakdown-title"
            initial={{ y: 28, opacity: 0 }}
            animate={{ y: 0, opacity: 1 }}
            exit={{ y: 28, opacity: 0 }}
            transition={{ duration: 0.24, ease: [0.22, 1, 0.36, 1] }}
            onClick={(e) => e.stopPropagation()}
            className="w-full max-w-md rounded-t-3xl border border-stage-hairline bg-[#1c1610] px-5 pb-[calc(20px+env(safe-area-inset-bottom))] pt-5 shadow-2xl sm:rounded-3xl sm:pb-6"
          >
            <div className="flex items-start justify-between gap-4">
              <div className="min-w-0">
                <h2
                  id="rating-breakdown-title"
                  className="font-serif text-xl leading-tight text-stage-ink"
                >
                  How readers rated it
                </h2>
                <p className="mt-0.5 truncate text-sm text-stage-ink-tertiary">
                  {book.title}
                </p>
              </div>
              <button
                type="button"
                onClick={onClose}
                aria-label="Close ratings breakdown"
                className="-mr-1 -mt-1 flex h-11 w-11 shrink-0 items-center justify-center rounded-full text-stage-ink-muted transition-colors hover:bg-white/10 hover:text-stage-ink"
              >
                <X className="h-5 w-5" />
              </button>
            </div>

            {loading && (
              <div className="flex items-center gap-2 py-10 text-sm text-stage-ink-muted">
                <Loader2 className="h-4 w-4 animate-spin" />
                Looking up the ratings…
              </div>
            )}

            {!loading && data && !data.found && (
              <p className="py-8 text-[15px] leading-relaxed text-stage-ink-muted">
                No public rating breakdown for this book yet. It needs at least
                a couple of dozen ratings on Open Library before a distribution
                says anything.
              </p>
            )}

            {!loading && data?.found && data.counts && (
              <>
                <div className="mt-5 flex items-baseline gap-2.5">
                  <span className="font-serif text-4xl tabular-nums text-stage-ink">
                    {data.average ? data.average.toFixed(2) : "—"}
                  </span>
                  <span className="text-sm text-stage-ink-muted">
                    from {formatCount(data.count ?? 0)} ratings
                  </span>
                </div>

                <div className="mt-4 space-y-1.5">
                  {bars.map((bar) => (
                    <div key={bar.stars} className="flex items-center gap-3">
                      <span className="w-9 shrink-0 text-right text-sm tabular-nums text-stage-ink-muted">
                        {bar.stars} ★
                      </span>
                      <div className="h-2.5 flex-1 overflow-hidden rounded-full bg-white/10">
                        <motion.div
                          initial={{ width: 0 }}
                          animate={{ width: `${bar.width}%` }}
                          transition={{ duration: 0.5, ease: [0.22, 1, 0.36, 1] }}
                          className="h-full rounded-full bg-stage-amber"
                        />
                      </div>
                      <span className="w-16 shrink-0 text-right text-sm tabular-nums text-stage-ink-tertiary">
                        {bar.percent}%
                      </span>
                    </div>
                  ))}
                </div>

                {/* The line the average hides. Only stated when the shape of
                    the distribution actually carries it. */}
                {split?.divisive && (
                  <p className="mt-4 rounded-2xl border border-stage-hairline px-4 py-3 text-[14px] leading-relaxed text-stage-ink-muted">
                    Divisive — {split.loved}% gave it five stars while{" "}
                    {split.disliked}% gave it one or two.
                  </p>
                )}

                <div className="mt-4 flex items-center justify-between gap-3 border-t border-stage-hairline pt-3">
                  <span className="text-xs text-stage-ink-tertiary">
                    Open Library readers
                  </span>
                  {data.workKey && (
                    <a
                      href={`https://openlibrary.org${data.workKey}`}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="inline-flex min-h-[40px] items-center gap-1.5 text-xs font-medium text-stage-amber transition-opacity hover:opacity-80"
                    >
                      See it on Open Library
                      <ExternalLink className="h-3.5 w-3.5" />
                    </a>
                  )}
                </div>
              </>
            )}
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>,
    document.body,
  )
}
