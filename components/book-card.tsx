"use client"

import { motion, PanInfo } from "framer-motion"
import { Book } from "@/lib/book-data"
import { Star, Clock, BookOpen, Heart, X, Plus } from "lucide-react"
import { addBookToReading } from "@/lib/storage"
import { Button } from "@/components/ui/button"
import Image from "next/image"

interface BookCardProps {
  book: Book
  onSwipe: (direction: "left" | "right") => void
  isTop?: boolean
  showActions?: boolean
}

export function BookCard({ book, onSwipe, isTop = false, showActions = false }: BookCardProps) {
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

  return (
    <motion.div
      className={`absolute inset-0 ${isTop ? "z-10" : "z-0"} ${isTop ? "touch-pan-x no-select" : ""}`}
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
      <div className="bg-white/95 backdrop-blur-xl rounded-2xl sm:rounded-3xl shadow-2xl overflow-hidden h-full max-w-sm mx-auto border border-white/20">
        <div className="relative h-80 sm:h-96">
          <Image
            src={book.cover}
            alt={book.title}
            fill
            className="object-cover"
            sizes="(max-width: 768px) 100vw, (max-width: 1200px) 50vw, 33vw"
          />
          <div className="absolute inset-0 bg-gradient-to-t from-black/70 via-black/20 to-transparent" />
          
          {/* Genre tags */}
          <motion.div 
            className="absolute top-4 left-4 flex flex-wrap gap-2"
            initial={{ opacity: 0, y: -10 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.2 }}
          >
            {book.genre.slice(0, 2).map((genre, index) => (
              <motion.span
                key={genre}
                initial={{ opacity: 0, scale: 0.8 }}
                animate={{ opacity: 1, scale: 1 }}
                transition={{ delay: 0.3 + index * 0.1 }}
                className="bg-white/95 backdrop-blur-sm text-gray-800 text-xs px-3 py-1.5 rounded-full font-medium shadow-lg border border-white/20"
              >
                {genre}
              </motion.span>
            ))}
          </motion.div>

          {/* Rating */}
          <motion.div 
            className="absolute top-4 right-4 bg-white/95 backdrop-blur-sm text-gray-800 px-3 py-1.5 rounded-full flex items-center gap-1.5 shadow-lg border border-white/20"
            initial={{ opacity: 0, y: -10 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.4 }}
          >
            <Star className="w-3.5 h-3.5 fill-yellow-400 text-yellow-400" />
            <span className="text-sm font-bold">{book.rating}</span>
          </motion.div>

          {/* Floating sparkles */}
          <motion.div
            animate={{ 
              rotate: [0, 360],
              scale: [1, 1.2, 1]
            }}
            transition={{ 
              duration: 4, 
              repeat: Infinity, 
              ease: "easeInOut" 
            }}
            className="absolute bottom-6 right-6 w-3 h-3 bg-yellow-300/60 rounded-full blur-sm"
          />
          <motion.div
            animate={{ 
              rotate: [360, 0],
              scale: [1.2, 1, 1.2]
            }}
            transition={{ 
              duration: 3, 
              repeat: Infinity, 
              ease: "easeInOut",
              delay: 1
            }}
            className="absolute bottom-12 right-8 w-2 h-2 bg-pink-300/60 rounded-full blur-sm"
          />
        </div>

        <motion.div 
          className="p-4 sm:p-6 space-y-3 sm:space-y-4"
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.3 }}
        >
          <motion.div
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.4 }}
          >
            <h3 className="text-lg sm:text-xl font-bold text-gray-900 line-clamp-2 mb-1 sm:mb-2 leading-tight">
              {book.title}
            </h3>
            <p className="text-gray-600 font-medium text-sm sm:text-base">{book.author}</p>
          </motion.div>

          <motion.div 
            className="flex items-center gap-3 sm:gap-6 text-xs sm:text-sm text-gray-600"
            initial={{ opacity: 0, x: -10 }}
            animate={{ opacity: 1, x: 0 }}
            transition={{ delay: 0.5 }}
          >
            <div className="flex items-center gap-1.5 sm:gap-2 bg-gray-50 px-2 sm:px-3 py-1 sm:py-1.5 rounded-full">
              <BookOpen className="w-3 sm:w-4 h-3 sm:h-4 text-purple-500" />
              <span className="font-medium text-xs sm:text-sm">{book.pages}p</span>
            </div>
            <div className="flex items-center gap-1.5 sm:gap-2 bg-gray-50 px-2 sm:px-3 py-1 sm:py-1.5 rounded-full">
              <Clock className="w-3 sm:w-4 h-3 sm:h-4 text-green-500" />
              <span className="font-medium text-xs sm:text-sm">{book.readingTime}</span>
            </div>
          </motion.div>

          <motion.p 
            className="text-gray-700 text-xs sm:text-sm line-clamp-3 leading-relaxed"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ delay: 0.6 }}
          >
            {book.description}
          </motion.p>

          <motion.div 
            className="flex flex-wrap gap-2"
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.7 }}
          >
            {book.mood.slice(0, 3).map((mood, index) => (
              <motion.span
                key={mood}
                initial={{ opacity: 0, scale: 0.8 }}
                animate={{ opacity: 1, scale: 1 }}
                transition={{ delay: 0.8 + index * 0.1 }}
                className="bg-gradient-to-r from-purple-100 to-pink-100 text-purple-700 text-xs px-3 py-1.5 rounded-full font-medium border border-purple-200/50"
              >
                {mood}
              </motion.span>
            ))}
          </motion.div>

          {/* Start Reading Button */}
          {showActions && (
            <motion.div
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.9 }}
              className="pt-2"
            >
              <Button
                onClick={handleStartReading}
                className="w-full bg-gradient-to-r from-green-500 to-emerald-600 hover:from-green-600 hover:to-emerald-700 text-white rounded-xl transition-all duration-300"
              >
                <Plus className="w-4 h-4 mr-2" />
                Start Reading
              </Button>
            </motion.div>
          )}
        </motion.div>

        {/* Enhanced swipe indicators */}
        <div className="absolute inset-0 pointer-events-none">
          <motion.div
            className="absolute top-1/2 left-6 transform -translate-y-1/2 bg-gradient-to-r from-green-400 to-emerald-500 text-white p-3 rounded-full opacity-0 shadow-xl border-2 border-white/30"
            initial={{ opacity: 0, scale: 0.8, x: -20 }}
            whileInView={{ 
              opacity: [0, 1, 0],
              scale: [0.8, 1.1, 1],
              x: [-20, 0, 20]
            }}
            transition={{ 
              duration: 2,
              repeat: Infinity,
              repeatDelay: 3,
              ease: "easeInOut"
            }}
          >
            <Heart className="w-6 h-6" />
          </motion.div>
          
          <motion.div
            className="absolute top-1/2 right-6 transform -translate-y-1/2 bg-gradient-to-r from-red-400 to-pink-500 text-white p-3 rounded-full opacity-0 shadow-xl border-2 border-white/30"
            initial={{ opacity: 0, scale: 0.8, x: 20 }}
            whileInView={{ 
              opacity: [0, 1, 0],
              scale: [0.8, 1.1, 1],
              x: [20, 0, -20]
            }}
            transition={{ 
              duration: 2,
              repeat: Infinity,
              repeatDelay: 3,
              delay: 1,
              ease: "easeInOut"
            }}
          >
            <X className="w-6 h-6" />
          </motion.div>

          {/* Subtle shine effect */}
          <motion.div
            className="absolute inset-0 bg-gradient-to-r from-transparent via-white/10 to-transparent"
            animate={{
              x: ["-100%", "100%"]
            }}
            transition={{
              duration: 3,
              repeat: Infinity,
              repeatDelay: 5,
              ease: "easeInOut"
            }}
          />
        </div>
      </div>
    </motion.div>
  )
}
