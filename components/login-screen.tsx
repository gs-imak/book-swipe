"use client"

import { useState } from "react"
import { Button } from "@/components/ui/button"
import { BookOpen, ArrowRight, Bookmark, Library, Star, Heart } from "lucide-react"
import { motion } from "framer-motion"
import Image from "next/image"

interface LoginScreenProps {
  onLogin: () => void
}

// Real book covers from Open Library for the preview
const PREVIEW_BOOKS = [
  {
    title: "Dune",
    author: "Frank Herbert",
    cover: "https://covers.openlibrary.org/b/isbn/9780441172719-M.jpg",
    rating: 4.6,
  },
  {
    title: "The Great Gatsby",
    author: "F. Scott Fitzgerald",
    cover: "https://covers.openlibrary.org/b/isbn/9780743273565-M.jpg",
    rating: 4.2,
  },
  {
    title: "Pride and Prejudice",
    author: "Jane Austen",
    cover: "https://covers.openlibrary.org/b/isbn/9780141439518-M.jpg",
    rating: 4.5,
  },
]

export function LoginScreen({ onLogin }: LoginScreenProps) {
  const [isEntering, setIsEntering] = useState(false)

  const handleGetStarted = () => {
    setIsEntering(true)
    setTimeout(() => onLogin(), 600)
  }

  return (
    <div className="min-h-screen bg-[#FDFBF7] relative overflow-hidden flex flex-col">
      {/* Header */}
      <motion.header
        initial={{ opacity: 0, y: -20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.6 }}
        className="relative z-10 px-6 sm:px-8 pt-8 sm:pt-10"
      >
        <div className="max-w-6xl mx-auto flex items-center gap-3">
          <Image
            src="/logo/bookswipe_logo.png"
            alt="BookSwipe Logo"
            width={44}
            height={44}
            className="w-9 h-9 sm:w-11 sm:h-11"
            priority
          />
          <span className="text-xl sm:text-2xl font-semibold tracking-tight text-stone-900" style={{ fontFamily: "'Georgia', 'Times New Roman', serif" }}>
            BookSwipe
          </span>
        </div>
      </motion.header>

      {/* Main content */}
      <div className="relative z-10 flex-1 flex items-center">
        <div className="w-full max-w-6xl mx-auto px-6 sm:px-8 py-12 sm:py-16">
          <div className="grid lg:grid-cols-2 gap-12 lg:gap-16 items-center">

            {/* Left: Copy */}
            <motion.div
              initial={{ opacity: 0, y: 30 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.7, delay: 0.15 }}
              className="space-y-6 sm:space-y-8 text-center lg:text-left order-2 lg:order-1"
            >
              <div className="space-y-4">
                <h1
                  className="text-4xl sm:text-5xl md:text-6xl font-bold leading-[1.1] text-stone-900 tracking-tight"
                  style={{ fontFamily: "'Georgia', 'Times New Roman', serif" }}
                >
                  Find your next
                  <span className="block text-amber-700">
                    favorite book.
                  </span>
                </h1>

                <p className="text-lg sm:text-xl text-stone-500 leading-relaxed max-w-lg mx-auto lg:mx-0">
                  Swipe through personalized recommendations matched to your taste.
                  No accounts, no fuss — just great books.
                </p>
              </div>

              {/* CTA */}
              <div className="space-y-4">
                <Button
                  onClick={handleGetStarted}
                  disabled={isEntering}
                  className="h-14 px-8 text-base sm:text-lg bg-stone-900 hover:bg-stone-800 text-white font-medium rounded-xl transition-all duration-300 shadow-sm hover:shadow-md tap-target touch-manipulation"
                >
                  {isEntering ? (
                    <motion.div
                      className="flex items-center gap-3"
                      initial={{ opacity: 1 }}
                      animate={{ opacity: [1, 0.5, 1] }}
                      transition={{ duration: 1, repeat: Infinity }}
                    >
                      <BookOpen className="w-5 h-5" />
                      Opening your library...
                    </motion.div>
                  ) : (
                    <div className="flex items-center gap-3">
                      Get Started
                      <ArrowRight className="w-5 h-5" />
                    </div>
                  )}
                </Button>
                <p className="text-sm text-stone-400">
                  Free forever. Your data stays on your device.
                </p>
              </div>

              {/* Features */}
              <div className="grid grid-cols-3 gap-4 sm:gap-6 pt-4">
                <div className="text-center lg:text-left">
                  <div className="w-10 h-10 rounded-lg bg-amber-50 flex items-center justify-center mx-auto lg:mx-0 mb-2">
                    <BookOpen className="w-5 h-5 text-amber-700" />
                  </div>
                  <p className="text-sm font-medium text-stone-700">Swipe to discover</p>
                  <p className="text-xs text-stone-400 mt-0.5">Like Tinder, for books</p>
                </div>
                <div className="text-center lg:text-left">
                  <div className="w-10 h-10 rounded-lg bg-rose-50 flex items-center justify-center mx-auto lg:mx-0 mb-2">
                    <Bookmark className="w-5 h-5 text-rose-600" />
                  </div>
                  <p className="text-sm font-medium text-stone-700">Smart matching</p>
                  <p className="text-xs text-stone-400 mt-0.5">Learns your taste</p>
                </div>
                <div className="text-center lg:text-left">
                  <div className="w-10 h-10 rounded-lg bg-teal-50 flex items-center justify-center mx-auto lg:mx-0 mb-2">
                    <Library className="w-5 h-5 text-teal-700" />
                  </div>
                  <p className="text-sm font-medium text-stone-700">Build your shelf</p>
                  <p className="text-xs text-stone-400 mt-0.5">Track your reads</p>
                </div>
              </div>
            </motion.div>

            {/* Right: App preview mockup */}
            <motion.div
              initial={{ opacity: 0, y: 30 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.7, delay: 0.35 }}
              className="relative h-[400px] sm:h-[460px] order-1 lg:order-2"
            >
              <div className="relative w-full max-w-[280px] sm:max-w-[310px] mx-auto h-full flex items-center">
                {/* Card stack - 3 cards with real covers */}
                {PREVIEW_BOOKS.map((book, i) => {
                  const isTop = i === PREVIEW_BOOKS.length - 1
                  const stackOffset = (PREVIEW_BOOKS.length - 1 - i)

                  return (
                    <motion.div
                      key={book.title}
                      initial={{ opacity: 0, y: 40 }}
                      animate={{
                        opacity: isTop ? 1 : 0.85 - stackOffset * 0.15,
                        y: stackOffset * -10,
                        scale: 1 - stackOffset * 0.04,
                      }}
                      transition={{
                        duration: 0.5,
                        delay: 0.5 + i * 0.12,
                        type: "spring",
                        stiffness: 120,
                        damping: 20,
                      }}
                      className="absolute inset-x-0 top-1/2 -translate-y-1/2"
                      style={{ zIndex: i }}
                    >
                      <div className="w-full aspect-[3/4.2] rounded-2xl overflow-hidden shadow-lg border border-stone-200/50 bg-stone-100 relative">
                        {/* Book cover */}
                        <Image
                          src={book.cover}
                          alt={book.title}
                          fill
                          className="object-cover"
                          sizes="310px"
                        />

                        {/* Dark gradient at bottom */}
                        <div className="absolute inset-0 bg-gradient-to-t from-black/75 via-black/10 to-transparent" />

                        {/* Top-right rating badge (only on top card) */}
                        {isTop && (
                          <motion.div
                            initial={{ opacity: 0, scale: 0.8 }}
                            animate={{ opacity: 1, scale: 1 }}
                            transition={{ delay: 1 }}
                            className="absolute top-4 right-4 bg-white/90 backdrop-blur-sm px-2.5 py-1 rounded-full flex items-center gap-1 shadow-sm"
                          >
                            <Star className="w-3 h-3 fill-amber-500 text-amber-500" />
                            <span className="text-xs font-bold text-stone-700">{book.rating}</span>
                          </motion.div>
                        )}

                        {/* Bottom info (only on top card) */}
                        {isTop && (
                          <motion.div
                            initial={{ opacity: 0, y: 10 }}
                            animate={{ opacity: 1, y: 0 }}
                            transition={{ delay: 1.1 }}
                            className="absolute bottom-0 left-0 right-0 p-5"
                          >
                            <h3
                              className="text-xl sm:text-2xl font-bold text-white leading-tight mb-0.5"
                              style={{ fontFamily: "'Georgia', 'Times New Roman', serif" }}
                            >
                              {book.title}
                            </h3>
                            <p className="text-white/75 text-sm">{book.author}</p>
                          </motion.div>
                        )}
                      </div>
                    </motion.div>
                  )
                })}

                {/* Floating action buttons preview */}
                <motion.div
                  initial={{ opacity: 0, y: 20 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: 1.3 }}
                  className="absolute -bottom-2 left-1/2 -translate-x-1/2 flex items-center gap-4"
                  style={{ zIndex: 10 }}
                >
                  <div className="w-11 h-11 rounded-full border-2 border-red-200 bg-white shadow-md flex items-center justify-center">
                    <svg className="w-5 h-5 text-red-400" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth={2.5}>
                      <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
                    </svg>
                  </div>
                  <div className="w-11 h-11 rounded-full bg-emerald-500 shadow-md flex items-center justify-center">
                    <Heart className="w-5 h-5 text-white" />
                  </div>
                </motion.div>
              </div>
            </motion.div>
          </div>
        </div>
      </div>

      {/* Footer */}
      <motion.footer
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        transition={{ delay: 1 }}
        className="relative z-10 px-6 sm:px-8 pb-8 text-center"
      >
        <p className="text-xs text-stone-400">
          Powered by Google Books & Open Library
        </p>
      </motion.footer>
    </div>
  )
}
