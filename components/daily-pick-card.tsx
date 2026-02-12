"use client"

import { useState, useEffect } from "react"
import { motion } from "framer-motion"
import { Sparkles, Heart, X, Bookmark } from "lucide-react"
import { Book } from "@/lib/book-data"
import { type DailyPick, saveLikedBooks, getLikedBooks } from "@/lib/storage"
import { generateDailyPick, dismissDailyPick, saveDailyPickToLibrary } from "@/lib/daily-pick"
import { BookCover } from "@/components/book-cover"

interface DailyPickCardProps {
  onBookClick?: (book: Book) => void
  onBookLiked?: (book: Book) => void
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
    const liked = getLikedBooks()
    if (!liked.some(b => b.id === pick.book.id)) {
      saveLikedBooks([...liked, pick.book])
      onBookLiked?.(pick.book)
    }
    saveDailyPickToLibrary()
    setPick({ ...pick, saved: true })
  }

  const handleDismiss = (e: React.MouseEvent) => {
    e.stopPropagation()
    dismissDailyPick()
    setPick(null)
  }

  return (
    <motion.div
      initial={{ opacity: 0, y: 16 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.45, delay: 0.25 }}
    >
      <div className="flex items-center gap-2 mb-3">
        <Sparkles className="w-4 h-4 text-amber-600" />
        <h2 className="text-lg font-semibold text-stone-900 font-serif">Today&apos;s Pick</h2>
      </div>

      <motion.div
        onClick={() => onBookClick?.(pick.book)}
        className="relative overflow-hidden rounded-2xl bg-gradient-to-br from-amber-50 via-orange-50 to-rose-50 border border-amber-200/60 shadow-sm cursor-pointer group"
        whileHover={{ y: -2, transition: { duration: 0.2 } }}
      >
        <div className="flex gap-4 p-4 sm:p-5">
          {/* Cover */}
          <div className="relative w-20 h-28 sm:w-24 sm:h-36 flex-shrink-0 rounded-xl overflow-hidden shadow-md border border-white/60">
            <BookCover
              src={pick.book.cover}
              fallbackSrc={pick.book.coverFallback}
              alt={pick.book.title}
              fill
              className="object-cover"
              sizes="96px"
            />
          </div>

          {/* Info */}
          <div className="flex-1 min-w-0 flex flex-col justify-between">
            <div>
              <h3 className="font-bold text-stone-900 line-clamp-2 leading-tight font-serif text-base sm:text-lg group-hover:text-amber-800 transition-colors">
                {pick.book.title}
              </h3>
              <p className="text-sm text-stone-500 mt-0.5">{pick.book.author}</p>

              {/* Reasons */}
              {pick.reasons.length > 0 && (
                <div className="mt-2 flex flex-wrap gap-1.5">
                  {pick.reasons.slice(0, 2).map((reason, i) => (
                    <span
                      key={i}
                      className="text-xs px-2 py-0.5 rounded-full bg-white/70 text-amber-800 border border-amber-200/50"
                    >
                      {reason.description}
                    </span>
                  ))}
                </div>
              )}
            </div>

            {/* Actions */}
            <div className="flex items-center gap-2 mt-3">
              {pick.saved ? (
                <span className="flex items-center gap-1.5 text-xs text-amber-700 font-medium">
                  <Bookmark className="w-3.5 h-3.5 fill-amber-600" />
                  Saved
                </span>
              ) : (
                <button
                  onClick={handleLike}
                  className="h-9 px-3.5 bg-stone-900 hover:bg-stone-800 text-white text-xs font-medium rounded-lg transition-colors flex items-center gap-1.5"
                >
                  <Heart className="w-3.5 h-3.5" />
                  Save
                </button>
              )}
              <button
                onClick={handleDismiss}
                className="h-9 px-3 text-stone-400 hover:text-stone-600 hover:bg-white/60 text-xs rounded-lg transition-colors flex items-center gap-1"
              >
                <X className="w-3.5 h-3.5" />
                Pass
              </button>
            </div>
          </div>
        </div>
      </motion.div>
    </motion.div>
  )
}
