"use client"

import { useState } from "react"
import { Button } from "@/components/ui/button"
import { BookOpen, ArrowRight, Bookmark, Library, Star, Heart, Clock, Sparkles, Users, BookMarked } from "lucide-react"
import { motion } from "framer-motion"
import Image from "next/image"

interface LoginScreenProps {
  onLogin: () => void
}

const stagger = {
  hidden: {},
  visible: {
    transition: { staggerChildren: 0.12, delayChildren: 0.1 },
  },
}

const fadeUp = {
  hidden: { opacity: 0, y: 24 },
  visible: {
    opacity: 1,
    y: 0,
    transition: { duration: 0.6, ease: [0.22, 1, 0.36, 1] },
  },
}

const fadeIn = {
  hidden: { opacity: 0 },
  visible: {
    opacity: 1,
    transition: { duration: 0.8, ease: "easeOut" },
  },
}

export function LoginScreen({ onLogin }: LoginScreenProps) {
  const [isEntering, setIsEntering] = useState(false)

  const handleGetStarted = () => {
    setIsEntering(true)
    setTimeout(() => onLogin(), 600)
  }

  return (
    <div className="bg-background relative overflow-hidden flex flex-col" style={{ minHeight: "100dvh" }}>
      {/* Background layers */}
      <div className="absolute inset-0 pointer-events-none">
        {/* Radial gradient - warm center glow */}
        <div
          className="absolute inset-0"
          style={{
            background: "radial-gradient(ellipse 80% 60% at 50% 40%, rgba(245, 158, 11, 0.06) 0%, transparent 70%)",
          }}
        />
        {/* Secondary glow for depth */}
        <div
          className="absolute inset-0 dark:block hidden"
          style={{
            background: "radial-gradient(ellipse 60% 50% at 30% 50%, rgba(245, 158, 11, 0.04) 0%, transparent 60%)",
          }}
        />
        {/* Subtle grain texture via SVG noise */}
        <svg className="absolute inset-0 w-full h-full opacity-[0.03] dark:opacity-[0.05]" xmlns="http://www.w3.org/2000/svg">
          <filter id="grain">
            <feTurbulence type="fractalNoise" baseFrequency="0.65" numOctaves="3" stitchTiles="stitch" />
            <feColorMatrix type="saturate" values="0" />
          </filter>
          <rect width="100%" height="100%" filter="url(#grain)" />
        </svg>
        {/* Subtle grid pattern */}
        <div
          className="absolute inset-0 opacity-[0.02] dark:opacity-[0.03]"
          style={{
            backgroundImage: "linear-gradient(rgba(120,113,108,0.5) 1px, transparent 1px), linear-gradient(90deg, rgba(120,113,108,0.5) 1px, transparent 1px)",
            backgroundSize: "80px 80px",
          }}
        />
      </div>

      {/* Floating decorative elements */}
      <FloatingBooks />

      {/* Header */}
      <motion.header
        initial={{ opacity: 0, y: -12 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.5, ease: "easeOut" }}
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
          <span className="text-xl sm:text-2xl font-semibold tracking-tight text-stone-900 dark:text-stone-100 font-serif">
            BookSwipe
          </span>
        </div>
      </motion.header>

      {/* Main content */}
      <div className="relative z-10 flex-1 flex items-center">
        <div className="w-full max-w-6xl mx-auto px-6 sm:px-8 py-12 sm:py-20">
          <div className="grid lg:grid-cols-2 gap-12 lg:gap-20 items-center">
            {/* Left: Copy */}
            <motion.div
              variants={stagger}
              initial="hidden"
              animate="visible"
              className="space-y-8 sm:space-y-10 text-center lg:text-left order-2 lg:order-1"
            >
              <div className="space-y-5">
                <motion.h1
                  variants={fadeUp}
                  className="text-[2.75rem] sm:text-6xl md:text-7xl font-bold leading-[1.05] text-stone-900 dark:text-stone-100 tracking-tight font-serif"
                >
                  Find your next
                  <span className="block relative">
                    <span
                      className="bg-clip-text text-transparent"
                      style={{
                        backgroundImage: "linear-gradient(135deg, #b45309, #d97706, #f59e0b, #d97706, #b45309)",
                        backgroundSize: "200% auto",
                        animation: "shimmer 3s ease-in-out infinite",
                      }}
                    >
                      favorite book.
                    </span>
                    {/* Subtle underline accent */}
                    <span
                      className="absolute -bottom-1 left-1/2 -translate-x-1/2 lg:left-0 lg:translate-x-0 h-[3px] rounded-full opacity-30"
                      style={{
                        width: "60%",
                        background: "linear-gradient(90deg, #d97706, transparent)",
                      }}
                    />
                  </span>
                </motion.h1>
                <motion.p
                  variants={fadeUp}
                  className="text-lg sm:text-xl md:text-[1.375rem] text-stone-500 dark:text-stone-400 leading-relaxed max-w-xl mx-auto lg:mx-0"
                >
                  Swipe through personalized recommendations matched to your
                  taste. No accounts, no fuss — just great books.
                </motion.p>
              </div>

              {/* CTA */}
              <motion.div variants={fadeUp} className="space-y-5">
                <div className="flex flex-col sm:flex-row items-center gap-4 lg:justify-start justify-center">
                  <button
                    onClick={handleGetStarted}
                    disabled={isEntering}
                    className="group relative h-14 sm:h-16 px-10 sm:px-12 text-base sm:text-lg bg-stone-900 dark:bg-stone-100 text-white dark:text-stone-900 font-semibold rounded-2xl transition-all duration-300 tap-target touch-manipulation disabled:opacity-50 disabled:pointer-events-none overflow-hidden"
                    style={{
                      boxShadow: "0 0 0 0 rgba(180, 83, 9, 0), 0 4px 20px -4px rgba(28, 25, 23, 0.3)",
                    }}
                    onMouseEnter={(e) => {
                      e.currentTarget.style.boxShadow = "0 0 30px 4px rgba(180, 83, 9, 0.2), 0 8px 32px -4px rgba(28, 25, 23, 0.4)"
                      e.currentTarget.style.transform = "translateY(-1px)"
                    }}
                    onMouseLeave={(e) => {
                      e.currentTarget.style.boxShadow = "0 0 0 0 rgba(180, 83, 9, 0), 0 4px 20px -4px rgba(28, 25, 23, 0.3)"
                      e.currentTarget.style.transform = "translateY(0)"
                    }}
                  >
                    {/* Subtle gradient sweep on hover */}
                    <span className="absolute inset-0 bg-gradient-to-r from-transparent via-white/[0.07] to-transparent translate-x-[-100%] group-hover:translate-x-[100%] transition-transform duration-700 ease-out" />
                    {isEntering ? (
                      <motion.span
                        className="relative flex items-center gap-3"
                        initial={{ opacity: 1 }}
                        animate={{ opacity: [1, 0.5, 1] }}
                        transition={{ duration: 1, repeat: Infinity }}
                      >
                        <BookOpen className="w-5 h-5" />
                        Opening your library...
                      </motion.span>
                    ) : (
                      <span className="relative flex items-center gap-3">
                        Start Discovering
                        <ArrowRight className="w-5 h-5 transition-transform duration-300 group-hover:translate-x-1.5" />
                      </span>
                    )}
                  </button>
                </div>
                <p className="text-sm text-stone-400 dark:text-stone-500">
                  Free forever. Your data stays on your device.
                </p>
              </motion.div>

              {/* Social proof */}
              <motion.div variants={fadeUp} className="flex flex-col sm:flex-row items-center gap-4 lg:justify-start justify-center">
                <div className="flex items-center gap-1.5">
                  {[1, 2, 3, 4, 5].map((i) => (
                    <Star
                      key={i}
                      className={`w-4 h-4 ${i <= 4 ? "fill-amber-500 text-amber-500" : "fill-amber-500/40 text-amber-500/40"}`}
                    />
                  ))}
                  <span className="text-sm font-medium text-stone-600 dark:text-stone-400 ml-1">4.8</span>
                </div>
                <div className="hidden sm:block w-px h-4 bg-stone-300 dark:bg-stone-700" />
                <div className="flex items-center gap-2">
                  <div className="flex -space-x-2">
                    {["bg-amber-200 dark:bg-amber-800", "bg-rose-200 dark:bg-rose-800", "bg-teal-200 dark:bg-teal-800", "bg-indigo-200 dark:bg-indigo-800"].map((color, i) => (
                      <div
                        key={i}
                        className={`w-7 h-7 rounded-full ${color} border-2 border-white dark:border-stone-900 flex items-center justify-center`}
                      >
                        <Users className="w-3 h-3 text-stone-600 dark:text-stone-300" />
                      </div>
                    ))}
                  </div>
                  <p className="text-sm text-stone-500 dark:text-stone-400">
                    Loved by <span className="font-semibold text-stone-700 dark:text-stone-300">2,400+</span> readers
                  </p>
                </div>
              </motion.div>
            </motion.div>

            {/* Right: Phone mockup */}
            <motion.div
              initial={{ opacity: 0, y: 32, scale: 0.96 }}
              animate={{ opacity: 1, y: 0, scale: 1 }}
              transition={{ duration: 0.8, ease: [0.22, 1, 0.36, 1], delay: 0.2 }}
              className="relative order-1 lg:order-2 flex justify-center"
            >
              <PhoneMockup />
            </motion.div>
          </div>
        </div>
      </div>

      {/* Features section */}
      <motion.div
        initial="hidden"
        whileInView="visible"
        viewport={{ once: true, margin: "-40px" }}
        variants={stagger}
        className="relative z-10 w-full max-w-6xl mx-auto px-6 sm:px-8 pb-16 sm:pb-24"
      >
        <motion.div variants={fadeUp} className="mb-10 text-center">
          <p className="text-xs uppercase tracking-[0.2em] text-amber-700 dark:text-amber-400 font-semibold mb-2">
            How it works
          </p>
          <h2 className="text-2xl sm:text-3xl font-bold text-stone-900 dark:text-stone-100 font-serif">
            Your reading journey, simplified
          </h2>
        </motion.div>
        <div className="grid sm:grid-cols-2 gap-4 sm:gap-5">
          {[
            {
              icon: BookOpen,
              title: "Swipe to discover",
              description: "Browse books like you scroll social media. Swipe right to save, left to skip. It takes seconds.",
            },
            {
              icon: Sparkles,
              title: "Smart recommendations",
              description: "Our algorithm learns your taste with every swipe and surfaces books you will actually love.",
            },
            {
              icon: BookMarked,
              title: "Build your shelf",
              description: "Organize saved books into custom lists. Track what you have read and what is next.",
            },
            {
              icon: Library,
              title: "70,000+ free classics",
              description: "Access a vast library of public domain books from Open Library, all completely free to read.",
            },
          ].map((feature, i) => {
            return (
              <motion.div
                key={feature.title}
                variants={fadeUp}
                className="group flex items-start gap-4 sm:gap-5 p-5 sm:p-6 rounded-2xl border border-stone-200/60 dark:border-stone-700/60 bg-white dark:bg-stone-900 transition-all duration-300 hover:shadow-md"
              >
                <div className="shrink-0 w-11 h-11 rounded-xl bg-amber-50 dark:bg-amber-900/30 flex items-center justify-center">
                  <feature.icon className="w-5 h-5 text-amber-700 dark:text-amber-400" />
                </div>
                <div>
                  <h3 className="text-base font-semibold text-stone-800 dark:text-stone-200 mb-1">
                    {feature.title}
                  </h3>
                  <p className="text-sm leading-relaxed text-stone-500 dark:text-stone-400">
                    {feature.description}
                  </p>
                </div>
              </motion.div>
            )
          })}
        </div>
      </motion.div>

      {/* Footer */}
      <footer className="relative z-10 px-6 sm:px-8 pb-8 pt-4 border-t border-stone-200/60 dark:border-stone-800/60">
        <div className="max-w-6xl mx-auto flex flex-col sm:flex-row items-center justify-between gap-4">
          <div className="flex items-center gap-2">
            <Image
              src="/logo/bookswipe_logo.png"
              alt="BookSwipe"
              width={24}
              height={24}
              className="w-5 h-5 opacity-50"
            />
            <p className="text-xs text-stone-400 dark:text-stone-500">
              Powered by Google Books & Open Library
            </p>
          </div>
          <div className="flex items-center gap-6">
            <span className="text-xs text-stone-400 dark:text-stone-500 hover:text-stone-600 dark:hover:text-stone-300 transition-colors cursor-pointer">
              Privacy
            </span>
            <span className="text-xs text-stone-400 dark:text-stone-500 hover:text-stone-600 dark:hover:text-stone-300 transition-colors cursor-pointer">
              About
            </span>
            <span className="text-xs text-stone-400 dark:text-stone-500 hover:text-stone-600 dark:hover:text-stone-300 transition-colors cursor-pointer">
              GitHub
            </span>
          </div>
        </div>
      </footer>

    </div>
  )
}

/* ---------- Floating decorative book shapes ---------- */
function FloatingBooks() {
  const books = [
    { left: "8%", top: "15%", size: 32, delay: 0, duration: 6, rotate: -12, opacity: 0.06 },
    { left: "85%", top: "20%", size: 28, delay: 1.5, duration: 7, rotate: 8, opacity: 0.05 },
    { left: "75%", top: "70%", size: 24, delay: 3, duration: 5.5, rotate: -6, opacity: 0.04 },
    { left: "15%", top: "75%", size: 20, delay: 2, duration: 8, rotate: 15, opacity: 0.05 },
    { left: "92%", top: "45%", size: 22, delay: 4, duration: 6.5, rotate: -20, opacity: 0.04 },
    { left: "5%", top: "50%", size: 26, delay: 1, duration: 7.5, rotate: 10, opacity: 0.05 },
  ]

  return (
    <div className="absolute inset-0 pointer-events-none overflow-hidden">
      {books.map((book, i) => (
        <div
          key={i}
          className="absolute text-stone-900 dark:text-stone-100"
          style={{
            left: book.left,
            top: book.top,
            opacity: book.opacity,
            ["--rotate" as string]: `${book.rotate}deg`,
            animation: `float ${book.duration}s ease-in-out ${book.delay}s infinite`,
          }}
        >
          <BookOpen style={{ width: book.size, height: book.size }} />
        </div>
      ))}
    </div>
  )
}

/* ---------- Phone device mockup ---------- */
function PhoneMockup() {
  return (
    <div className="relative w-[260px] sm:w-[300px]">
      {/* Ambient glow behind phone */}
      <div
        className="absolute -inset-8 rounded-full blur-3xl opacity-20 dark:opacity-15"
        style={{
          background: "radial-gradient(circle, rgba(245, 158, 11, 0.4) 0%, transparent 70%)",
        }}
      />

      {/* Phone frame */}
      <div className="relative rounded-[2.5rem] border-[6px] border-stone-800 dark:border-stone-700 bg-stone-800 dark:bg-stone-700 shadow-2xl overflow-hidden" style={{ boxShadow: "0 25px 60px -12px rgba(28, 25, 23, 0.4), 0 0 0 1px rgba(255,255,255,0.05) inset" }}>
        {/* Notch */}
        <div className="absolute top-0 left-1/2 -translate-x-1/2 w-24 h-5 bg-stone-800 dark:bg-stone-700 rounded-b-2xl z-30" />

        {/* Screen */}
        <div className="relative bg-background rounded-[2rem] overflow-hidden">
          {/* Status bar space */}
          <div className="h-10" />

          {/* Mini header */}
          <div className="px-4 pb-2 flex items-center justify-between">
            <div className="flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-stone-100 dark:bg-stone-800">
              <Library className="w-3 h-3 text-stone-500 dark:text-stone-400" />
              <span className="text-[10px] font-semibold text-stone-600 dark:text-stone-300">3</span>
            </div>
            <div className="text-center">
              <p className="text-xs font-bold text-stone-800 dark:text-stone-200 font-serif">
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
              className="absolute inset-x-5 top-2 bottom-4 rounded-xl bg-stone-200/70 dark:bg-stone-700/50"
              style={{ transform: "scale(0.95)" }}
            />

            {/* Main card */}
            <div className="relative h-full rounded-xl overflow-hidden shadow-lg border border-stone-200/40 dark:border-stone-600/30">
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
              <div className="absolute top-3 right-3 bg-white/90 dark:bg-white/80 px-2 py-0.5 rounded-full flex items-center gap-1">
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
            <div className="w-10 h-10 rounded-full border-2 border-red-200 dark:border-red-900/50 bg-white dark:bg-stone-800 flex items-center justify-center shadow-sm">
              <svg className="w-4 h-4 text-red-400" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth={2.5}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
              </svg>
            </div>
            <div className="w-10 h-10 rounded-full bg-emerald-500 flex items-center justify-center shadow-sm">
              <Heart className="w-4 h-4 text-white" />
            </div>
          </div>

          {/* Mini nav bar */}
          <div className="border-t border-stone-100 dark:border-stone-800 flex justify-around py-2 px-6">
            <div className="flex flex-col items-center gap-0.5">
              <Library className="w-3.5 h-3.5 text-stone-300 dark:text-stone-600" />
              <span className="text-[8px] text-stone-300 dark:text-stone-600">Library</span>
            </div>
            <div className="flex flex-col items-center gap-0.5">
              <BookOpen className="w-3.5 h-3.5 text-stone-800 dark:text-stone-200" />
              <span className="text-[8px] text-stone-800 dark:text-stone-200 font-medium">Discover</span>
              <div className="w-1 h-1 rounded-full bg-amber-500 -mt-0.5" />
            </div>
            <div className="flex flex-col items-center gap-0.5">
              <Star className="w-3.5 h-3.5 text-stone-300 dark:text-stone-600" />
              <span className="text-[8px] text-stone-300 dark:text-stone-600">Awards</span>
            </div>
          </div>

          {/* Home indicator */}
          <div className="flex justify-center pb-2 pt-1">
            <div className="w-20 h-1 rounded-full bg-stone-300 dark:bg-stone-600" />
          </div>
        </div>
      </div>

      {/* Subtle shadow beneath phone */}
      <div className="absolute -bottom-4 left-1/2 -translate-x-1/2 w-[80%] h-8 bg-stone-900/15 dark:bg-black/30 rounded-full blur-xl" />
    </div>
  )
}
