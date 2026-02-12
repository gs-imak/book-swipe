"use client"

import { motion, PanInfo, useMotionValue, useTransform } from "framer-motion"
import { Book } from "@/lib/book-data"
import { Star, Clock, BookOpen, Info, Plus, ChevronDown } from "lucide-react"
import { addBookToReading } from "@/lib/storage"
import { Button } from "@/components/ui/button"
import { BookCover } from "@/components/book-cover"
import { useState } from "react"

interface BookCardProps {
  book: Book
  onSwipe: (direction: "left" | "right") => void
  isTop?: boolean
  showActions?: boolean
}

export function BookCard({ book, onSwipe, isTop = false, showActions = false }: BookCardProps) {
  const [infoExpanded, setInfoExpanded] = useState(false)
  const x = useMotionValue(0)
  const rotate = useTransform(x, [-200, 0, 200], [-12, 0, 12])
  const likeOpacity = useTransform(x, [0, 80], [0, 1])
  const nopeOpacity = useTransform(x, [-80, 0], [1, 0])

  const handleDragEnd = (_event: MouseEvent | TouchEvent | PointerEvent, info: PanInfo) => {
    const threshold = 80
    const velocity = info.velocity.x
    const offset = info.offset.x

    if (offset > threshold || velocity > 400) {
      onSwipe("right")
    } else if (offset < -threshold || velocity < -400) {
      onSwipe("left")
    }
  }

  const handleStartReading = () => {
    addBookToReading(book)
  }

  return (
    <motion.div
      className={`absolute inset-0 ${isTop ? "z-10" : "z-0"}`}
      style={isTop ? { x, rotate } : undefined}
      drag={isTop && !infoExpanded ? "x" : false}
      dragConstraints={{ left: -250, right: 250 }}
      onDragEnd={handleDragEnd}
      initial={{ scale: isTop ? 1 : 0.96, opacity: isTop ? 1 : 0.6 }}
      animate={{ scale: isTop ? 1 : 0.96, opacity: isTop ? 1 : 0.6 }}
      whileDrag={{ scale: 1.02 }}
      dragElastic={0.4}
      dragTransition={{ bounceStiffness: 500, bounceDamping: 25 }}
      transition={{ type: "spring", stiffness: 300, damping: 30 }}
    >
      <div className="relative h-full w-full overflow-hidden rounded-2xl shadow-lg border border-stone-200/40">
        {/* Cover image with blurred background fill */}
        <div className="absolute inset-0 bg-stone-900">
          {/* Blurred background version to fill gaps */}
          <BookCover
            src={book.cover}
            alt=""
            fill
            className="object-cover blur-2xl scale-110 opacity-50"
            sizes="100px"
          />
          {/* Actual cover shown in full */}
          <BookCover
            src={book.cover}
            fallbackSrc={book.coverFallback}
            alt={book.title}
            fill
            className="object-contain"
            sizes="(max-width: 640px) 100vw, 400px"
            priority={isTop}
          />
          {/* Bottom gradient for text legibility */}
          <div className="absolute inset-0 bg-gradient-to-t from-black/80 via-black/20 to-transparent" />
        </div>

        {/* LIKE / NOPE stamps */}
        {isTop && (
          <>
            <motion.div
              className="absolute top-8 left-6 z-20 border-4 border-emerald-500 rounded-lg px-4 py-1 -rotate-12"
              style={{ opacity: likeOpacity }}
            >
              <span className="text-emerald-500 text-3xl font-black tracking-wider">LIKE</span>
            </motion.div>
            <motion.div
              className="absolute top-8 right-6 z-20 border-4 border-red-400 rounded-lg px-4 py-1 rotate-12"
              style={{ opacity: nopeOpacity }}
            >
              <span className="text-red-400 text-3xl font-black tracking-wider">NOPE</span>
            </motion.div>
          </>
        )}

        {/* Rating badge */}
        <div className="absolute top-5 right-5 bg-white/90 backdrop-blur-sm px-3 py-1.5 rounded-full flex items-center gap-1.5 shadow-sm z-10">
          <Star className="w-3.5 h-3.5 fill-amber-500 text-amber-500" />
          <span className="text-sm font-bold text-stone-800">{book.rating}</span>
        </div>

        {/* Bottom info overlay */}
        <motion.div
          className="absolute bottom-0 left-0 right-0 z-10 px-5 pb-5"
          initial={{ opacity: 0, y: 16 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.2 }}
        >
          {/* Title & Author */}
          <div className="flex items-end justify-between gap-3 mb-3">
            <div className="flex-1 min-w-0">
              <h3
                className="text-2xl sm:text-3xl font-bold text-white leading-tight mb-1 drop-shadow-lg font-serif"
              >
                {book.title}
              </h3>
              <p className="text-white/85 text-base font-medium drop-shadow-md">
                {book.author}
              </p>
            </div>

            {/* Info button */}
            <motion.button
              whileTap={{ scale: 0.9 }}
              onClick={() => setInfoExpanded(true)}
              aria-label="View book details"
              className="w-10 h-10 rounded-full bg-white/20 backdrop-blur-md border border-white/25 flex items-center justify-center flex-shrink-0"
            >
              <Info className="w-5 h-5 text-white" />
            </motion.button>
          </div>

          {/* Meta row */}
          <div className="flex items-center gap-3 text-white/80 text-sm mb-3">
            <div className="flex items-center gap-1">
              <BookOpen className="w-3.5 h-3.5" />
              <span>{book.pages}p</span>
            </div>
            <span className="w-1 h-1 rounded-full bg-white/40" />
            <div className="flex items-center gap-1">
              <Clock className="w-3.5 h-3.5" />
              <span>{book.readingTime}</span>
            </div>
          </div>

          {/* Genre tags */}
          <div className="flex flex-wrap gap-1.5">
            {book.genre.slice(0, 3).map((genre) => (
              <span
                key={genre}
                className="bg-white/15 backdrop-blur-sm border border-white/20 text-white text-xs px-3 py-1 rounded-full font-medium"
              >
                {genre}
              </span>
            ))}
          </div>
        </motion.div>

        {/* Expanded info sheet */}
        <motion.div
          initial={false}
          animate={{ y: infoExpanded ? 0 : '100%' }}
          transition={{ type: "spring", damping: 30, stiffness: 300 }}
          className="absolute inset-0 bg-background z-30 flex flex-col"
          style={{ touchAction: infoExpanded ? 'pan-y' : 'none' }}
        >
          {/* Handle bar */}
          <div className="flex-shrink-0 py-3 flex justify-center border-b border-stone-100">
            <button
              onClick={() => setInfoExpanded(false)}
              aria-label="Close details"
              className="flex items-center gap-1 text-stone-400 hover:text-stone-600 transition-colors px-3 py-1"
            >
              <ChevronDown className="w-5 h-5" />
              <span className="text-xs font-medium">Close</span>
            </button>
          </div>

          {/* Scrollable content */}
          <div className="flex-1 overflow-y-auto overscroll-contain">
            <div className="p-5 space-y-5">
              {/* Header */}
              <div>
                <h2
                  className="text-xl font-bold text-stone-900 mb-1 font-serif"
                >
                  {book.title}
                </h2>
                <p className="text-base text-stone-500">{book.author}</p>
              </div>

              {/* Stats */}
              <div className="grid grid-cols-3 gap-2">
                <div className="bg-white rounded-xl p-3 border border-stone-200/60 shadow-sm text-center">
                  <BookOpen className="w-4 h-4 text-stone-400 mx-auto mb-1" />
                  <p className="text-lg font-bold text-stone-900">{book.pages}</p>
                  <p className="text-[11px] text-stone-400">pages</p>
                </div>
                <div className="bg-white rounded-xl p-3 border border-stone-200/60 shadow-sm text-center">
                  <Clock className="w-4 h-4 text-stone-400 mx-auto mb-1" />
                  <p className="text-lg font-bold text-stone-900">{book.readingTime.replace(' hours', 'h').replace(' hour', 'h')}</p>
                  <p className="text-[11px] text-stone-400">read time</p>
                </div>
                <div className="bg-white rounded-xl p-3 border border-stone-200/60 shadow-sm text-center">
                  <Star className="w-4 h-4 text-amber-500 mx-auto mb-1" />
                  <p className="text-lg font-bold text-stone-900">{book.rating}</p>
                  <p className="text-[11px] text-stone-400">rating</p>
                </div>
              </div>

              {/* Description */}
              <div>
                <h3 className="text-xs font-semibold text-stone-400 uppercase tracking-wider mb-2">
                  About
                </h3>
                <p className="text-sm text-stone-600 leading-relaxed">
                  {book.description}
                </p>
              </div>

              {/* Genres */}
              <div>
                <h3 className="text-xs font-semibold text-stone-400 uppercase tracking-wider mb-2">
                  Genres
                </h3>
                <div className="flex flex-wrap gap-1.5">
                  {book.genre.map((genre) => (
                    <span
                      key={genre}
                      className="bg-stone-100 text-stone-700 text-xs px-3 py-1.5 rounded-full font-medium"
                    >
                      {genre}
                    </span>
                  ))}
                </div>
              </div>

              {/* Moods */}
              <div>
                <h3 className="text-xs font-semibold text-stone-400 uppercase tracking-wider mb-2">
                  Vibes
                </h3>
                <div className="flex flex-wrap gap-1.5">
                  {book.mood.map((mood) => (
                    <span
                      key={mood}
                      className="bg-amber-50 text-amber-700 text-xs px-3 py-1.5 rounded-full font-medium border border-amber-100"
                    >
                      {mood}
                    </span>
                  ))}
                </div>
              </div>

              {/* Perfect for */}
              <div className="bg-white rounded-xl p-4 border border-stone-200/60 shadow-sm">
                <h3 className="text-xs font-semibold text-stone-400 uppercase tracking-wider mb-1.5">
                  Perfect for
                </h3>
                <p className="text-sm text-stone-600">
                  {book.mood.slice(0, 2).join(' & ')} readers who enjoy {book.genre.slice(0, 2).join(' and ')} stories
                </p>
              </div>

              {/* Action button */}
              {showActions && (
                <div className="pt-1 pb-4">
                  <Button
                    onClick={handleStartReading}
                    className="w-full bg-stone-900 hover:bg-stone-800 text-white rounded-xl h-12 text-sm font-medium"
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
