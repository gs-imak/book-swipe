"use client"

import { motion, PanInfo, useMotionValue, useTransform } from "framer-motion"
import { Book } from "@/lib/book-data"
import { Star, Clock, BookOpen, Heart, X, Plus, ChevronUp, Award, Info } from "lucide-react"
import { addBookToReading } from "@/lib/storage"
import { Button } from "@/components/ui/button"
import Image from "next/image"
import { useState } from "react"

interface BookCardProps {
  book: Book
  onSwipe: (direction: "left" | "right") => void
  isTop?: boolean
  showActions?: boolean
}

export function BookCard({ book, onSwipe, isTop = false, showActions = false }: BookCardProps) {
  const [infoExpanded, setInfoExpanded] = useState(false)
  const y = useMotionValue(0)

  const handleDragEnd = (event: any, info: PanInfo) => {
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
      drag={isTop && !infoExpanded ? "x" : false}
      dragConstraints={{ left: -250, right: 250 }}
      onDragEnd={handleDragEnd}
      initial={{ scale: isTop ? 1 : 0.95, opacity: isTop ? 1 : 0.8 }}
      animate={{ scale: isTop ? 1 : 0.95, opacity: isTop ? 1 : 0.8 }}
      whileDrag={{ rotate: 0, scale: 1.02 }}
      dragElastic={0.3}
      dragTransition={{ bounceStiffness: 600, bounceDamping: 20 }}
      transition={{ type: "spring", stiffness: 300, damping: 30 }}
    >
      {/* Full-screen card */}
      <div className="relative h-full w-full overflow-hidden rounded-2xl sm:rounded-3xl shadow-2xl">
        {/* Full-screen book cover */}
        <div className="absolute inset-0">
          <Image
            src={book.cover}
            alt={book.title}
            fill
            className="object-cover"
            sizes="100vw"
            priority={isTop}
          />
          {/* Gradient overlay for readability */}
          <div className="absolute inset-0 bg-gradient-to-t from-black/90 via-black/30 to-black/20" />
        </div>

        {/* Rating badge - top right */}
        <motion.div 
          className="absolute top-6 right-6 bg-white/95 backdrop-blur-sm text-gray-800 px-4 py-2 rounded-full flex items-center gap-2 shadow-xl border border-white/20 z-20"
          initial={{ opacity: 0, scale: 0.8 }}
          animate={{ opacity: 1, scale: 1 }}
          transition={{ delay: 0.2 }}
        >
          <Star className="w-4 h-4 fill-yellow-400 text-yellow-400" />
          <span className="text-sm font-bold">{book.rating}</span>
        </motion.div>

        {/* Main info at bottom - Tinder style */}
        <motion.div 
          className="absolute bottom-0 left-0 right-0 z-10"
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.3 }}
        >
          {/* Title and basic info */}
          <div className="px-6 pb-6">
            <div className="flex items-end justify-between mb-4">
              <div className="flex-1 min-w-0">
                <h3 className="text-3xl sm:text-4xl font-bold text-white mb-2 leading-tight drop-shadow-2xl">
                  {book.title}
                </h3>
                <p className="text-white/95 text-lg font-medium drop-shadow-lg mb-3">
                  {book.author}
                </p>
                
                {/* Quick stats inline */}
                <div className="flex items-center gap-4 text-white/90">
                  <div className="flex items-center gap-1.5">
                    <BookOpen className="w-4 h-4" />
                    <span className="text-sm font-medium">{book.pages}p</span>
                  </div>
                  <div className="w-1 h-1 rounded-full bg-white/60" />
                  <div className="flex items-center gap-1.5">
                    <Clock className="w-4 h-4" />
                    <span className="text-sm font-medium">{book.readingTime}</span>
                  </div>
                </div>
              </div>

              {/* Info button */}
              <motion.button
                whileHover={{ scale: 1.1 }}
                whileTap={{ scale: 0.9 }}
                onClick={() => setInfoExpanded(!infoExpanded)}
                className="ml-4 w-12 h-12 rounded-full bg-white/20 backdrop-blur-md border border-white/30 flex items-center justify-center shadow-xl flex-shrink-0"
              >
                <Info className="w-6 h-6 text-white" />
              </motion.button>
            </div>

            {/* Genre tags */}
            <div className="flex flex-wrap gap-2">
              {book.genre.slice(0, 3).map((genre) => (
                <span
                  key={genre}
                  className="bg-white/20 backdrop-blur-md border border-white/30 text-white text-sm px-4 py-1.5 rounded-full font-medium shadow-lg"
                >
                  {genre}
                </span>
              ))}
            </div>
          </div>
        </motion.div>

        {/* Expanded info sheet - slides up from bottom like Tinder */}
        <motion.div
          initial={false}
          animate={{
            y: infoExpanded ? 0 : '100%',
          }}
          transition={{ type: "spring", damping: 30, stiffness: 300 }}
          className="absolute inset-0 bg-white z-30 flex flex-col"
          style={{ touchAction: infoExpanded ? 'pan-y' : 'none' }}
        >
          {/* Handle bar */}
          <div className="flex-shrink-0 py-4 flex justify-center border-b border-gray-100">
            <button
              onClick={() => setInfoExpanded(false)}
              className="w-12 h-1.5 bg-gray-300 rounded-full"
            />
          </div>

          {/* Scrollable content */}
          <div className="flex-1 overflow-y-auto overscroll-contain">
            <div className="p-6 space-y-6">
              {/* Header */}
              <div>
                <h2 className="text-2xl font-bold text-gray-900 mb-1">{book.title}</h2>
                <p className="text-lg text-gray-600">{book.author}</p>
              </div>

              {/* Stats grid */}
              <div className="grid grid-cols-2 gap-3">
                <div className="bg-purple-50 rounded-xl p-4 border border-purple-100">
                  <div className="flex items-center gap-2 mb-1">
                    <BookOpen className="w-5 h-5 text-purple-500" />
                    <span className="text-xs font-semibold text-gray-500 uppercase">Pages</span>
                  </div>
                  <p className="text-xl font-bold text-gray-900">{book.pages}</p>
                </div>
                <div className="bg-green-50 rounded-xl p-4 border border-green-100">
                  <div className="flex items-center gap-2 mb-1">
                    <Clock className="w-5 h-5 text-green-500" />
                    <span className="text-xs font-semibold text-gray-500 uppercase">Read Time</span>
                  </div>
                  <p className="text-xl font-bold text-gray-900">{book.readingTime}</p>
                </div>
                <div className="bg-yellow-50 rounded-xl p-4 border border-yellow-100">
                  <div className="flex items-center gap-2 mb-1">
                    <Star className="w-5 h-5 text-yellow-500" />
                    <span className="text-xs font-semibold text-gray-500 uppercase">Rating</span>
                  </div>
                  <p className="text-xl font-bold text-gray-900">{book.rating}/5</p>
                </div>
                <div className="bg-pink-50 rounded-xl p-4 border border-pink-100">
                  <div className="flex items-center gap-2 mb-1">
                    <Award className="w-5 h-5 text-pink-500" />
                    <span className="text-xs font-semibold text-gray-500 uppercase">Genres</span>
                  </div>
                  <p className="text-xl font-bold text-gray-900">{book.genre.length}</p>
                </div>
              </div>

              {/* About */}
              <div>
                <h3 className="text-sm font-bold text-gray-900 uppercase tracking-wider mb-3">
                  About This Book
                </h3>
                <p className="text-gray-700 leading-relaxed">
                  {book.description}
                </p>
              </div>

              {/* Genres */}
              <div>
                <h3 className="text-sm font-bold text-gray-900 uppercase tracking-wider mb-3">
                  Genres
                </h3>
                <div className="flex flex-wrap gap-2">
                  {book.genre.map((genre) => (
                    <span
                      key={genre}
                      className="bg-gradient-to-r from-purple-100 to-pink-100 text-purple-700 text-sm px-4 py-2 rounded-full font-medium border border-purple-200"
                    >
                      {genre}
                    </span>
                  ))}
                </div>
              </div>

              {/* Moods */}
              <div>
                <h3 className="text-sm font-bold text-gray-900 uppercase tracking-wider mb-3">
                  Reading Vibes
                </h3>
                <div className="flex flex-wrap gap-2">
                  {book.mood.map((mood) => (
                    <span
                      key={mood}
                      className="bg-gradient-to-r from-pink-50 to-rose-50 text-pink-700 text-sm px-4 py-2 rounded-full font-medium border border-pink-200"
                    >
                      {mood}
                    </span>
                  ))}
                </div>
              </div>

              {/* Perfect For */}
              <div className="bg-gradient-to-br from-purple-50 to-pink-50 rounded-2xl p-5 border border-purple-100">
                <h3 className="text-sm font-bold text-purple-700 uppercase tracking-wider mb-2">
                  ✨ Perfect For
                </h3>
                <p className="text-gray-700">
                  {book.mood.slice(0, 2).join(' • ')} readers who enjoy {book.genre.slice(0, 2).join(' and ')} stories
                </p>
              </div>

              {/* Action button */}
              {showActions && (
                <div className="pt-2 pb-6">
                  <Button
                    onClick={handleStartReading}
                    className="w-full bg-gradient-to-r from-green-500 to-emerald-600 hover:from-green-600 hover:to-emerald-700 text-white rounded-xl h-14 text-lg font-semibold shadow-lg"
                  >
                    <Plus className="w-5 h-5 mr-2" />
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
