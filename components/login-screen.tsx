"use client"

import { useState } from "react"
import { Button } from "@/components/ui/button"
import { BookOpen, ArrowRight, Bookmark, Library, Star, Heart, Clock } from "lucide-react"
import { motion } from "framer-motion"
import Image from "next/image"

interface LoginScreenProps {
  onLogin: () => void
}

export function LoginScreen({ onLogin }: LoginScreenProps) {
  const [isEntering, setIsEntering] = useState(false)

  const handleGetStarted = () => {
    setIsEntering(true)
    setTimeout(() => onLogin(), 600)
  }

  return (
    <div className="bg-background relative overflow-hidden flex flex-col" style={{ minHeight: "100dvh" }}>
      {/* Header */}
      <header
        className="relative z-10 px-6 sm:px-8"
        style={{ paddingTop: "max(32px, env(safe-area-inset-top, 32px))" }}
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
          <span
            className="text-xl sm:text-2xl font-semibold tracking-tight text-stone-900 font-serif"
          >
            BookSwipe
          </span>
        </div>
      </header>

      {/* Main content */}
      <div className="relative z-10 flex-1 flex items-center">
        <div className="w-full max-w-6xl mx-auto px-6 sm:px-8 py-10 sm:py-16">
          <div className="grid lg:grid-cols-2 gap-10 lg:gap-16 items-center">
            {/* Left: Copy */}
            <div className="space-y-6 sm:space-y-8 text-center lg:text-left order-2 lg:order-1">
              <div className="space-y-4">
                <h1
                  className="text-4xl sm:text-5xl md:text-6xl font-bold leading-[1.1] text-stone-900 tracking-tight font-serif"
                >
                  Find your next
                  <span className="block text-amber-700">favorite book.</span>
                </h1>
                <p className="text-lg sm:text-xl text-stone-500 leading-relaxed max-w-lg mx-auto lg:mx-0">
                  Swipe through personalized recommendations matched to your
                  taste. No accounts, no fuss — just great books.
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
            </div>

            {/* Right: Phone mockup */}
            <div className="relative order-1 lg:order-2 flex justify-center">
              <PhoneMockup />
            </div>
          </div>
        </div>
      </div>

      {/* Footer */}
      <footer className="relative z-10 px-6 sm:px-8 pb-8 text-center">
        <p className="text-xs text-stone-400">
          Powered by Google Books &amp; Open Library
        </p>
      </footer>
    </div>
  )
}

/* ---------- Phone device mockup ---------- */
function PhoneMockup() {
  return (
    <div className="relative w-[260px] sm:w-[290px]">
      {/* Phone frame */}
      <div className="relative rounded-[2.5rem] border-[6px] border-stone-800 bg-stone-800 shadow-2xl overflow-hidden">
        {/* Notch */}
        <div className="absolute top-0 left-1/2 -translate-x-1/2 w-24 h-5 bg-stone-800 rounded-b-2xl z-30" />

        {/* Screen */}
        <div className="relative bg-background rounded-[2rem] overflow-hidden">
          {/* Status bar space */}
          <div className="h-10" />

          {/* Mini header */}
          <div className="px-4 pb-2 flex items-center justify-between">
            <div className="flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-stone-100">
              <Library className="w-3 h-3 text-stone-500" />
              <span className="text-[10px] font-semibold text-stone-600">3</span>
            </div>
            <div className="text-center">
              <p className="text-xs font-bold text-stone-800 font-serif">
                BookSwipe
              </p>
              <p className="text-[9px] text-stone-400">4 of 15</p>
            </div>
            <div className="w-7" />
          </div>

          {/* Card area */}
          <div className="px-3 pb-2 relative" style={{ height: 320 }}>
            {/* Background card (stack effect) */}
            <div
              className="absolute inset-x-5 top-2 bottom-4 rounded-xl bg-stone-200/70"
              style={{ transform: "scale(0.95)" }}
            />

            {/* Main card */}
            <div className="relative h-full rounded-xl overflow-hidden shadow-lg border border-stone-200/40">
              {/* Cover gradient */}
              <div className="absolute inset-0 bg-gradient-to-br from-stone-700 via-stone-800 to-stone-900" />

              {/* Decorative book cover design */}
              <div className="absolute inset-0 flex flex-col items-center justify-center px-8 text-center">
                <div className="w-16 h-px bg-amber-500/60 mb-4" />
                <p className="text-amber-400/80 text-[10px] uppercase tracking-[0.2em] font-medium mb-2">
                  A Novel
                </p>
                <h3 className="text-white text-xl font-bold leading-tight mb-1.5 font-serif">
                  The Midnight
                  <br />
                  Library
                </h3>
                <p className="text-stone-400 text-xs">
                  Matt Haig
                </p>
                <div className="w-16 h-px bg-amber-500/60 mt-4" />
              </div>

              {/* Rating badge */}
              <div className="absolute top-3 right-3 bg-white/90 px-2 py-0.5 rounded-full flex items-center gap-1">
                <Star className="w-2.5 h-2.5 fill-amber-500 text-amber-500" />
                <span className="text-[10px] font-bold text-stone-700">4.5</span>
              </div>

              {/* Bottom info overlay */}
              <div className="absolute bottom-0 left-0 right-0 bg-gradient-to-t from-black/60 to-transparent p-3 pt-8">
                <div className="flex items-center gap-2 text-white/70 text-[10px] mb-2">
                  <div className="flex items-center gap-0.5">
                    <BookOpen className="w-2.5 h-2.5" />
                    <span>288p</span>
                  </div>
                  <span className="w-0.5 h-0.5 rounded-full bg-white/40" />
                  <div className="flex items-center gap-0.5">
                    <Clock className="w-2.5 h-2.5" />
                    <span>4-6 hours</span>
                  </div>
                </div>
                <div className="flex gap-1">
                  <span className="bg-white/15 border border-white/20 text-white text-[9px] px-2 py-0.5 rounded-full">
                    Fiction
                  </span>
                  <span className="bg-white/15 border border-white/20 text-white text-[9px] px-2 py-0.5 rounded-full">
                    Philosophical
                  </span>
                </div>
              </div>
            </div>
          </div>

          {/* Action buttons */}
          <div className="flex justify-center gap-5 py-3">
            <div className="w-10 h-10 rounded-full border-2 border-red-200 bg-white flex items-center justify-center shadow-sm">
              <svg className="w-4 h-4 text-red-400" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth={2.5}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
              </svg>
            </div>
            <div className="w-10 h-10 rounded-full bg-emerald-500 flex items-center justify-center shadow-sm">
              <Heart className="w-4 h-4 text-white" />
            </div>
          </div>

          {/* Mini nav bar */}
          <div className="border-t border-stone-100 flex justify-around py-2 px-6">
            <div className="flex flex-col items-center gap-0.5">
              <Library className="w-3.5 h-3.5 text-stone-300" />
              <span className="text-[8px] text-stone-300">Library</span>
            </div>
            <div className="flex flex-col items-center gap-0.5">
              <BookOpen className="w-3.5 h-3.5 text-stone-800" />
              <span className="text-[8px] text-stone-800 font-medium">Discover</span>
              <div className="w-1 h-1 rounded-full bg-amber-500 -mt-0.5" />
            </div>
            <div className="flex flex-col items-center gap-0.5">
              <Star className="w-3.5 h-3.5 text-stone-300" />
              <span className="text-[8px] text-stone-300">Awards</span>
            </div>
          </div>

          {/* Home indicator */}
          <div className="flex justify-center pb-2 pt-1">
            <div className="w-20 h-1 rounded-full bg-stone-300" />
          </div>
        </div>
      </div>

      {/* Subtle shadow beneath phone */}
      <div className="absolute -bottom-4 left-1/2 -translate-x-1/2 w-[80%] h-6 bg-stone-900/10 rounded-full blur-xl" />
    </div>
  )
}
