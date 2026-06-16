"use client"

import { useState, useEffect } from "react"
import { motion } from "framer-motion"
import { Sparkles, X, Bookmark, Star, BookOpen } from "lucide-react"
import { Book } from "@/lib/book-data"
import { type DailyPick, addLikedBook } from "@/lib/storage"
import { generateDailyPick, dismissDailyPick, saveDailyPickToLibrary } from "@/lib/daily-pick"
import { BookCover } from "@/components/book-cover"

interface DailyPickCardProps {
  onBookClick?: (book: Book) => void
  onBookLiked?: (book: Book) => void
}

function truncateDescription(desc: string, maxSentences = 3): string {
  if (!desc) return ""
  const sentences = desc.match(/[^.!?]+[.!?]+/g)
  if (!sentences) return desc
  const sliced = sentences.slice(0, maxSentences).join(" ").trim()
  if (sentences.length > maxSentences) return sliced
  return sliced
}

export function DailyPickCard({ onBookClick, onBookLiked }: DailyPickCardProps) {
  const [pick, setPick] = useState<DailyPick | null>(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    let mounted = true
    generateDailyPick().then((result) => {
      if (mounted) {
        setPick(result)
        setLoading(false)
      }
    })
    return () => { mounted = false }
  }, [])

  if (loading || !pick) return null

  const handleLike = (e: React.MouseEvent) => {
    e.stopPropagation()
    addLikedBook(pick.book)
    onBookLiked?.(pick.book)
    saveDailyPickToLibrary()
    setPick({ ...pick, saved: true })
  }

  const handleDismiss = (e: React.MouseEvent) => {
    e.stopPropagation()
    dismissDailyPick()
    setPick(null)
  }

  const teaser = truncateDescription(pick.book.description)

  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.5, delay: 0.2, ease: [0.22, 1, 0.36, 1] }}
    >
      <motion.div
        onClick={() => onBookClick?.(pick.book)}
        className="relative w-full overflow-hidden rounded-2xl cursor-pointer group"
        whileHover={{ y: -3, transition: { duration: 0.25 } }}
      >
        {/* Blurred cover background */}
        {pick.book.cover && (
          <div className="absolute inset-0 z-0">
            <img
              src={pick.book.cover}
              alt=""
              aria-hidden="true"
              className="absolute inset-0 w-full h-full object-cover scale-110 blur-2xl opacity-30 dark:opacity-20"
            />
          </div>
        )}

        {/* Gradient overlay */}
        <div className="absolute inset-0 z-[1] bg-gradient-to-br from-stone-50/90 via-amber-50/70 to-stone-50/85 dark:from-stone-800/95 dark:via-amber-900/30 dark:to-stone-800/90" />

        {/* Border overlay for definition */}
        <div className="absolute inset-0 z-[1] rounded-2xl ring-1 ring-inset ring-amber-300/30 dark:ring-amber-600/20" />

        {/* Content */}
        <div className="relative z-[2] p-4 sm:p-5">
          {/* Label */}
          <div className="flex items-center gap-2 mb-3.5">
            <Sparkles className="w-3.5 h-3.5 text-amber-600 dark:text-amber-400" />
            <span className="text-[11px] font-bold uppercase tracking-[0.15em] text-amber-700 dark:text-amber-400">
              Pick of the Day
            </span>
          </div>

          <div className="flex gap-4 sm:gap-5">
            {/* Cover — larger */}
            <motion.div
              initial={{ scale: 0.95, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              transition={{
                type: "spring",
                stiffness: 260,
                damping: 20,
                delay: 0.35
              }}
              className="relative w-24 h-36 sm:w-28 sm:h-[10.5rem] flex-shrink-0 rounded-xl overflow-hidden shadow-lg shadow-stone-900/10 dark:shadow-black/30 border border-white/40 dark:border-stone-600/30"
            >
              <BookCover
                src={pick.book.cover}
                fallbackSrc={pick.book.coverFallback}
                alt={pick.book.title}
                fill
                className="object-cover"
                sizes="(max-width: 640px) 192px, 224px"
              />
            </motion.div>

            {/* Info */}
            <div className="flex-1 min-w-0 flex flex-col">
              <div>
                <h3 className="font-bold text-stone-900 dark:text-stone-100 line-clamp-2 leading-tight font-serif text-base sm:text-lg group-hover:text-amber-800 dark:group-hover:text-amber-300 transition-colors">
                  {pick.book.title}
                </h3>
                <p className="text-sm text-stone-500 dark:text-stone-400 mt-0.5">
                  {pick.book.author}
                </p>

                {/* Rating */}
                <div className="flex items-center gap-1 mt-1.5">
                  <Star className="w-3.5 h-3.5 fill-amber-500 text-amber-500" />
                  <span className="text-xs font-semibold text-stone-700 dark:text-stone-300">
                    {pick.book.rating}
                  </span>
                  {pick.reasons.length > 0 && (
                    <span className="ml-1.5 text-xs px-2 py-0.5 rounded-full bg-white/60 dark:bg-stone-700/50 text-amber-800 dark:text-amber-300 border border-amber-200/40 dark:border-amber-700/30">
                      {pick.reasons[0].description}
                    </span>
                  )}
                </div>

                {/* Description teaser */}
                {teaser && (
                  <p className="mt-2.5 text-[13px] italic text-stone-600 dark:text-stone-400 line-clamp-3 leading-relaxed">
                    &ldquo;{teaser}&rdquo;
                  </p>
                )}
              </div>

              {/* Actions */}
              <div className="flex items-center gap-2 mt-auto pt-3">
                {pick.saved ? (
                  <div className="flex items-center gap-2">
                    <span className="flex items-center gap-1.5 text-xs text-amber-700 dark:text-amber-400 font-medium">
                      <Bookmark className="w-3.5 h-3.5 fill-amber-600 dark:fill-amber-500" />
                      In Library
                    </span>
                    <button
                      onClick={() => onBookClick?.(pick.book)}
                      className="h-9 px-3.5 bg-amber-100/80 hover:bg-amber-200/80 dark:bg-amber-800/30 dark:hover:bg-amber-700/40 text-amber-800 dark:text-amber-300 text-xs font-medium rounded-xl transition-all active:scale-[0.98]"
                    >
                      View Details
                    </button>
                  </div>
                ) : (
                  <button
                    onClick={handleLike}
                    className="h-9 px-4 bg-stone-900 hover:bg-stone-800 dark:bg-stone-100 dark:hover:bg-white text-white dark:text-stone-900 text-xs font-semibold rounded-xl transition-all active:scale-[0.98] flex items-center gap-1.5 shadow-sm"
                  >
                    <BookOpen className="w-3.5 h-3.5" />
                    Add to Library
                  </button>
                )}
                <button
                  onClick={handleDismiss}
                  className="h-9 px-3 text-stone-400 hover:text-stone-600 dark:hover:text-stone-300 hover:bg-white/40 dark:hover:bg-stone-700/40 text-xs rounded-xl transition-all active:scale-[0.98] flex items-center gap-1"
                >
                  <X className="w-3.5 h-3.5" />
                  Pass
                </button>
              </div>
            </div>
          </div>
        </div>
      </motion.div>
    </motion.div>
  )
}
