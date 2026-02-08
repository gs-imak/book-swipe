"use client"

import { useState } from "react"
import { Button } from "@/components/ui/button"
import { BookOpen, ArrowRight, Bookmark, Library } from "lucide-react"
import { motion } from "framer-motion"
import Image from "next/image"

interface LoginScreenProps {
  onLogin: () => void
}

const SAMPLE_COVERS = [
  { title: "Fiction", color: "from-amber-700 to-amber-900" },
  { title: "Mystery", color: "from-slate-700 to-slate-900" },
  { title: "Romance", color: "from-rose-600 to-rose-800" },
  { title: "Sci-Fi", color: "from-teal-700 to-teal-900" },
  { title: "Fantasy", color: "from-indigo-700 to-indigo-900" },
]

export function LoginScreen({ onLogin }: LoginScreenProps) {
  const [isEntering, setIsEntering] = useState(false)

  const handleGetStarted = () => {
    setIsEntering(true)
    setTimeout(() => onLogin(), 600)
  }

  return (
    <div className="min-h-screen bg-[#FDFBF7] relative overflow-hidden flex flex-col">
      {/* Subtle texture overlay */}
      <div className="absolute inset-0 opacity-[0.03]" style={{
        backgroundImage: `url("data:image/svg+xml,%3Csvg width='60' height='60' viewBox='0 0 60 60' xmlns='http://www.w3.org/2000/svg'%3E%3Cg fill='none' fill-rule='evenodd'%3E%3Cg fill='%23000000' fill-opacity='1'%3E%3Cpath d='M36 34v-4h-2v4h-4v2h4v4h2v-4h4v-2h-4zm0-30V0h-2v4h-4v2h4v4h2V6h4V4h-4zM6 34v-4H4v4H0v2h4v4h2v-4h4v-2H6zM6 4V0H4v4H0v2h4v4h2V6h4V4H6z'/%3E%3C/g%3E%3C/g%3E%3C/svg%3E")`,
      }} />

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

            {/* Right: Visual preview - stacked book cards */}
            <motion.div
              initial={{ opacity: 0, y: 30 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.7, delay: 0.35 }}
              className="relative h-[380px] sm:h-[440px] order-1 lg:order-2"
            >
              {/* Floating card stack */}
              <div className="relative w-full max-w-[300px] sm:max-w-[340px] mx-auto h-full">
                {SAMPLE_COVERS.map((cover, i) => {
                  const offset = (SAMPLE_COVERS.length - 1 - i) * 8
                  const scale = 1 - (SAMPLE_COVERS.length - 1 - i) * 0.03
                  const isTop = i === SAMPLE_COVERS.length - 1

                  return (
                    <motion.div
                      key={cover.title}
                      initial={{ opacity: 0, y: 60, rotate: (i - 2) * 2 }}
                      animate={{
                        opacity: 1,
                        y: -offset,
                        rotate: isTop ? 0 : (i - 2) * 1.5,
                        scale
                      }}
                      transition={{
                        duration: 0.6,
                        delay: 0.5 + i * 0.1,
                        type: "spring",
                        stiffness: 100
                      }}
                      className="absolute inset-x-0 bottom-0"
                      style={{ zIndex: i }}
                    >
                      <div
                        className={`w-full aspect-[3/4] rounded-2xl bg-gradient-to-br ${cover.color} shadow-xl flex flex-col items-center justify-end p-6 sm:p-8 relative overflow-hidden`}
                      >
                        {/* Book spine detail */}
                        <div className="absolute left-0 top-0 bottom-0 w-3 bg-black/10" />

                        {/* Text on card */}
                        {isTop && (
                          <motion.div
                            initial={{ opacity: 0 }}
                            animate={{ opacity: 1 }}
                            transition={{ delay: 1.2 }}
                            className="text-center text-white/90 space-y-2"
                          >
                            <div className="w-12 h-0.5 bg-white/30 mx-auto" />
                            <p className="text-xl sm:text-2xl font-serif font-medium italic">
                              &ldquo;Swipe right on your next adventure&rdquo;
                            </p>
                            <div className="w-12 h-0.5 bg-white/30 mx-auto" />
                          </motion.div>
                        )}
                      </div>
                    </motion.div>
                  )
                })}

                {/* Swipe hint arrow */}
                <motion.div
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1, x: [0, 12, 0] }}
                  transition={{
                    opacity: { delay: 1.5 },
                    x: { delay: 1.8, duration: 1.5, repeat: Infinity, ease: "easeInOut" }
                  }}
                  className="absolute -right-8 sm:-right-12 top-1/2 -translate-y-1/2 text-stone-300"
                  style={{ zIndex: 10 }}
                >
                  <ArrowRight className="w-8 h-8 sm:w-10 sm:h-10" />
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
