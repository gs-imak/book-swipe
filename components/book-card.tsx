"use client"

import { motion, PanInfo } from "framer-motion"
import { Book } from "@/lib/book-data"
import { Star, Clock, BookOpen, Heart, X, Plus, ChevronDown, Calendar, Award, Globe, User } from "lucide-react"
import { addBookToReading } from "@/lib/storage"
import { Button } from "@/components/ui/button"
import Image from "next/image"
import { useState, useRef } from "react"

interface BookCardProps {
  book: Book
  onSwipe: (direction: "left" | "right") => void
  isTop?: boolean
  showActions?: boolean
}

export function BookCard({ book, onSwipe, isTop = false, showActions = false }: BookCardProps) {
  const [showScrollIndicator, setShowScrollIndicator] = useState(true)
  const scrollRef = useRef<HTMLDivElement>(null)

  const handleDragEnd = (event: any, info: PanInfo) => {
    // Enhanced mobile touch sensitivity
    const threshold = 80 // Slightly reduced for better mobile response
    const velocity = info.velocity.x
    const offset = info.offset.x
    
    // Consider both distance and velocity for more responsive mobile swiping
    if (offset > threshold || velocity > 400) {
      onSwipe("right")
    } else if (offset < -threshold || velocity < -400) {
      onSwipe("left")
    }
  }

  const handleStartReading = () => {
    addBookToReading(book)
  }

  const handleScroll = () => {
    if (scrollRef.current) {
      const { scrollTop } = scrollRef.current
      if (scrollTop > 20) {
        setShowScrollIndicator(false)
      }
    }
  }

  return (
    <motion.div
      className={`absolute inset-0 ${isTop ? "z-10" : "z-0"}`}
      drag={isTop ? "x" : false}
      dragConstraints={{ left: -250, right: 250 }}
      onDragEnd={handleDragEnd}
      initial={{ scale: isTop ? 1 : 0.95, opacity: isTop ? 1 : 0.8 }}
      animate={{ scale: isTop ? 1 : 0.95, opacity: isTop ? 1 : 0.8 }}
      whileDrag={{ rotate: 0, scale: 1.02 }}
      dragElastic={0.3}
      dragTransition={{ bounceStiffness: 600, bounceDamping: 20 }}
      transition={{ type: "spring", stiffness: 300, damping: 30 }}
    >
      <div className="bg-white rounded-2xl sm:rounded-3xl shadow-2xl overflow-hidden h-full max-w-sm mx-auto flex flex-col">
        {/* Fixed Header Image */}
        <div className="relative h-56 sm:h-64 flex-shrink-0">
          <Image
            src={book.cover}
            alt={book.title}
            fill
            className="object-cover"
            sizes="(max-width: 768px) 100vw, (max-width: 1200px) 50vw, 33vw"
            priority={isTop}
          />
          <div className="absolute inset-0 bg-gradient-to-t from-black/80 via-black/20 to-transparent" />
          
          {/* Title overlay on image - Tinder style */}
          <motion.div 
            className="absolute bottom-0 left-0 right-0 p-4 sm:p-5"
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.3 }}
          >
            <h3 className="text-xl sm:text-2xl font-bold text-white mb-1 leading-tight drop-shadow-lg">
              {book.title}
            </h3>
            <p className="text-white/90 text-sm sm:text-base font-medium drop-shadow-lg">{book.author}</p>
          </motion.div>

          {/* Rating Badge */}
          <motion.div 
            className="absolute top-4 right-4 bg-white/95 backdrop-blur-sm text-gray-800 px-3 py-1.5 rounded-full flex items-center gap-1.5 shadow-lg border border-white/20"
            initial={{ opacity: 0, scale: 0.8 }}
            animate={{ opacity: 1, scale: 1 }}
            transition={{ delay: 0.2 }}
          >
            <Star className="w-4 h-4 fill-yellow-400 text-yellow-400" />
            <span className="text-sm font-bold">{book.rating}</span>
          </motion.div>
        </div>

        {/* Scrollable Content Area */}
        <div 
          ref={scrollRef}
          onScroll={handleScroll}
          className="flex-1 overflow-y-auto overscroll-contain scroll-smooth"
          style={{ 
            touchAction: 'pan-y',
            WebkitOverflowScrolling: 'touch'
          }}
        >
          <div className="p-4 sm:p-5 space-y-4">
            {/* Scroll Indicator */}
            {showScrollIndicator && (
              <motion.div 
                className="flex items-center justify-center gap-2 text-gray-400 py-2"
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                transition={{ delay: 0.8 }}
              >
                <ChevronDown className="w-4 h-4 animate-bounce" />
                <span className="text-xs font-medium">Scroll for more info</span>
                <ChevronDown className="w-4 h-4 animate-bounce" />
              </motion.div>
            )}

            {/* Quick Stats */}
            <motion.div 
              className="grid grid-cols-2 gap-3"
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.4 }}
            >
              <div className="bg-purple-50 rounded-xl p-3 flex items-center gap-2">
                <BookOpen className="w-5 h-5 text-purple-500 flex-shrink-0" />
                <div>
                  <p className="text-xs text-gray-500">Pages</p>
                  <p className="text-sm font-bold text-gray-900">{book.pages}</p>
                </div>
              </div>
              <div className="bg-green-50 rounded-xl p-3 flex items-center gap-2">
                <Clock className="w-5 h-5 text-green-500 flex-shrink-0" />
                <div>
                  <p className="text-xs text-gray-500">Read Time</p>
                  <p className="text-sm font-bold text-gray-900">{book.readingTime}</p>
                </div>
              </div>
            </motion.div>

            {/* Genres Section */}
            <motion.div
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.5 }}
            >
              <h4 className="text-xs font-semibold text-gray-500 uppercase tracking-wider mb-2 flex items-center gap-2">
                <Award className="w-4 h-4" />
                Genres
              </h4>
              <div className="flex flex-wrap gap-2">
                {book.genre.map((genre, index) => (
                  <span
                    key={genre}
                    className="bg-gradient-to-r from-purple-100 to-pink-100 text-purple-700 text-xs px-3 py-1.5 rounded-full font-medium border border-purple-200"
                  >
                    {genre}
                  </span>
                ))}
              </div>
            </motion.div>

            {/* Description Section */}
            <motion.div
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.6 }}
            >
              <h4 className="text-xs font-semibold text-gray-500 uppercase tracking-wider mb-2 flex items-center gap-2">
                <BookOpen className="w-4 h-4" />
                About This Book
              </h4>
              <p className="text-gray-700 text-sm leading-relaxed">
                {book.description}
              </p>
            </motion.div>

            {/* Mood/Vibes Section */}
            <motion.div
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.7 }}
            >
              <h4 className="text-xs font-semibold text-gray-500 uppercase tracking-wider mb-2 flex items-center gap-2">
                <Heart className="w-4 h-4" />
                Reading Vibes
              </h4>
              <div className="flex flex-wrap gap-2">
                {book.mood.map((mood, index) => (
                  <span
                    key={mood}
                    className="bg-gradient-to-r from-pink-50 to-rose-50 text-pink-700 text-xs px-3 py-1.5 rounded-full font-medium border border-pink-200"
                  >
                    {mood}
                  </span>
                ))}
              </div>
            </motion.div>

            {/* Additional Details */}
            <motion.div
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.8 }}
              className="bg-gray-50 rounded-xl p-4 space-y-3"
            >
              <h4 className="text-xs font-semibold text-gray-500 uppercase tracking-wider flex items-center gap-2">
                <Globe className="w-4 h-4" />
                Details
              </h4>
              
              <div className="space-y-2 text-sm">
                <div className="flex justify-between items-center">
                  <span className="text-gray-500">Author</span>
                  <span className="text-gray-900 font-medium">{book.author}</span>
                </div>
                <div className="flex justify-between items-center">
                  <span className="text-gray-500">Rating</span>
                  <span className="text-gray-900 font-medium flex items-center gap-1">
                    <Star className="w-3.5 h-3.5 fill-yellow-400 text-yellow-400" />
                    {book.rating}/5
                  </span>
                </div>
                <div className="flex justify-between items-center">
                  <span className="text-gray-500">Length</span>
                  <span className="text-gray-900 font-medium">{book.pages} pages</span>
                </div>
                <div className="flex justify-between items-center">
                  <span className="text-gray-500">Estimated Time</span>
                  <span className="text-gray-900 font-medium">{book.readingTime}</span>
                </div>
              </div>
            </motion.div>

            {/* Perfect For Section */}
            <motion.div
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.9 }}
              className="bg-gradient-to-br from-purple-50 to-pink-50 rounded-xl p-4 border border-purple-100"
            >
              <h4 className="text-xs font-semibold text-purple-700 uppercase tracking-wider mb-2">
                ✨ Perfect For
              </h4>
              <p className="text-sm text-gray-700">
                {book.mood.slice(0, 2).join(' • ')} readers who enjoy {book.genre.slice(0, 2).join(' and ')} stories
              </p>
            </motion.div>

            {/* Start Reading Button */}
            {showActions && (
              <motion.div
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: 1 }}
                className="pt-2 pb-4"
              >
                <Button
                  onClick={handleStartReading}
                  className="w-full bg-gradient-to-r from-green-500 to-emerald-600 hover:from-green-600 hover:to-emerald-700 text-white rounded-xl transition-all duration-300 h-12 text-base font-semibold shadow-lg"
                >
                  <Plus className="w-5 h-5 mr-2" />
                  Add to Reading List
                </Button>
              </motion.div>
            )}

            {/* Bottom padding for scroll */}
            <div className="h-4"></div>
          </div>
        </div>
      </div>
    </motion.div>
  )
}
