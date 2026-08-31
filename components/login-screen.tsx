"use client"

import { useState } from "react"
import { Button } from "@/components/ui/button"
import { BookOpen, ArrowRight, Bookmark, Library, Star, Heart, Clock, Sparkles, BookMarked } from "lucide-react"
import { motion } from "framer-motion"
import Image from "next/image"
import { t, tv } from "@/lib/i18n"

interface LoginScreenProps {
  onLogin: () => void
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
        {/* Light mode: warm amber glow from center */}
        <div
          className="absolute inset-0 dark:hidden"
          style={{
            background: "radial-gradient(ellipse 90% 70% at 50% 30%, rgba(217, 119, 6, 0.08) 0%, rgba(245, 158, 11, 0.04) 40%, transparent 70%)",
          }}
        />
        {/* Light mode: secondary warm glow from bottom-right */}
        <div
          className="absolute inset-0 dark:hidden"
          style={{
            background: "radial-gradient(ellipse 50% 50% at 80% 80%, rgba(180, 83, 9, 0.05) 0%, transparent 60%)",
          }}
        />
        {/* Dark mode: deeper amber glow */}
        <div
          className="absolute inset-0 hidden dark:block"
          style={{
            background: "radial-gradient(ellipse 80% 60% at 50% 40%, rgba(245, 158, 11, 0.08) 0%, transparent 70%)",
          }}
        />
        <div
          className="absolute inset-0 hidden dark:block"
          style={{
            background: "radial-gradient(ellipse 60% 50% at 30% 50%, rgba(245, 158, 11, 0.05) 0%, transparent 60%)",
          }}
        />
        {/* Subtle grain texture */}
        <svg className="absolute inset-0 w-full h-full opacity-[0.04] dark:opacity-[0.05]" xmlns="http://www.w3.org/2000/svg">
          <filter id="grain">
            <feTurbulence type="fractalNoise" baseFrequency="0.65" numOctaves="3" stitchTiles="stitch" />
            <feColorMatrix type="saturate" values="0" />
          </filter>
          <rect width="100%" height="100%" filter="url(#grain)" />
        </svg>
      </div>

      {/* Floating decorative elements */}
      <FloatingBooks />

      {/* Header */}
      <header
        className="hero-rise relative z-10 px-6 sm:px-8"
        style={{ paddingTop: "max(32px, env(safe-area-inset-top, 32px))" }}
      >
        <div className="max-w-6xl mx-auto flex items-center gap-3">
          <Image
            src="/logo/bookswipe_logo.png"
            alt={t("login_screen.bookswipe_logo")}
            /* No priority: this is server-rendered on every document now, and a
               head preload is not cancelled by display:none — it would sit on
               every returning user's critical path for a 44px asset. */
            width={44}
            height={44}
            className="w-9 h-9 sm:w-11 sm:h-11"
            priority
          />
          <span className="text-xl sm:text-2xl font-semibold tracking-tight text-stone-900 dark:text-stone-100 font-serif"> {t("login_screen.bookswipe")} </span>
        </div>
      </header>

      {/* Main content */}
      <div className="relative z-10 flex-1 flex items-center">
        <div className="w-full max-w-6xl mx-auto px-6 sm:px-8 py-12 sm:py-20">
          <div className="grid lg:grid-cols-2 gap-12 lg:gap-20 items-center">
            {/* Left: Copy */}
            {/* Left column. No stagger container any more: the copy it used
                to orchestrate is now static (so it is opaque in the server
                HTML) and the surrounding pieces rise via CSS. */}
            <div className="space-y-8 sm:space-y-10 text-center lg:text-left order-2 lg:order-1">
              <div className="space-y-5">
                <h1
                  className="text-[2.75rem] sm:text-6xl md:text-7xl font-bold leading-[1.05] text-stone-900 dark:text-stone-100 tracking-tight font-serif"
                > {t("login_screen.find_your_next")} <span className="block relative">
                    <span
                      className="bg-clip-text text-transparent"
                      style={{
                        backgroundImage: "linear-gradient(135deg, #b45309, #d97706, #f59e0b, #d97706, #b45309)",
                        backgroundSize: "200% auto",
                        animation: "shimmer 3s ease-in-out infinite",
                      }}
                    > {t("login_screen.favorite_book")} </span>
                    {/* Subtle underline accent */}
                    <span
                      className="absolute -bottom-1 left-1/2 -translate-x-1/2 lg:left-0 lg:translate-x-0 h-[3px] rounded-full opacity-30"
                      style={{
                        width: "60%",
                        background: "linear-gradient(90deg, #d97706, transparent)",
                      }}
                    />
                  </span>
                </h1>
                <p
                  className="text-lg sm:text-xl md:text-[1.375rem] text-stone-500 dark:text-stone-400 leading-relaxed max-w-xl mx-auto lg:mx-0"
                > {t("login_screen.swipe_through_personalized_recommendations_m")} </p>
              </div>

              {/* CTA — static, never animated: it must be clickable at first
                  paint, and the boot script captures a tap that lands before
                  hydration so it is never a dead control. */}
              <div className="space-y-5">
                <div className="flex flex-col sm:flex-row items-center gap-4 lg:justify-start justify-center">
                  <button
                    onClick={handleGetStarted}
                    disabled={isEntering}
                    data-hero-cta
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
                        <BookOpen className="w-5 h-5" /> {t("login_screen.opening_your_library")} </motion.span>
                    ) : (
                      <span className="relative flex items-center gap-3"> {t("common.start_discovering")} <ArrowRight className="w-5 h-5 transition-transform duration-300 group-hover:translate-x-1.5" />
                      </span>
                    )}
                  </button>
                </div>
                <p className="text-sm text-stone-400 dark:text-stone-500"> {t("login_screen.free_forever_your_data_stays_on")} </p>
              </div>

              {/* Social proof */}
              {/* Truthful trust row — every claim here is verifiable (no
                  fabricated ratings/user counts on a public project) */}
              <div
                className="hero-rise flex flex-col sm:flex-row items-center gap-4 lg:justify-start justify-center"
                style={{ "--rise-delay": "120ms" } as React.CSSProperties}
              >
                <div className="flex items-center gap-1.5">
                  <BookMarked className="w-4 h-4 text-amber-600 dark:text-amber-500" />
                  <p className="text-sm text-stone-500 dark:text-stone-400">
                    <span className="font-semibold text-stone-700 dark:text-stone-300">70,000+</span> {t("login_screen.free_classics_to_read")} </p>
                </div>
                <div className="hidden sm:block w-px h-4 bg-stone-300 dark:bg-stone-700" />
                <div className="flex items-center gap-1.5">
                  <Heart className="w-4 h-4 text-emerald-600 dark:text-emerald-500" />
                  <p className="text-sm text-stone-500 dark:text-stone-400"> {t("login_screen.free")} <a href="https://github.com/gs-imak/book-swipe" target="_blank" rel="noopener noreferrer" className="font-semibold text-stone-700 dark:text-stone-300 underline decoration-stone-300 dark:decoration-stone-600 underline-offset-2 hover:decoration-amber-500">{t("login_screen.open_source")}</a>
                  </p>
                </div>
              </div>
            </div>

            {/* Right: phone mockup. aria-hidden — its demo copy is a visual
                anchor, not page content, and must not be indexed as such. */}
            <div
              aria-hidden="true"
              className="hero-rise relative order-1 lg:order-2 flex justify-center"
              style={{ "--rise-delay": "200ms" } as React.CSSProperties}
            >
              <PhoneMockup />
            </div>
          </div>
        </div>
      </div>

      {/* Features section */}
      <div
        className="hero-rise relative z-10 w-full max-w-6xl mx-auto px-6 sm:px-8 pb-16 sm:pb-24"
        style={{ "--rise-delay": "280ms" } as React.CSSProperties}
      >
        <div className="mb-10 text-center">
          <p className="text-xs uppercase tracking-[0.2em] text-amber-700 dark:text-amber-400 font-semibold mb-2"> {t("login_screen.how_it_works")} </p>
          <h2 className="text-2xl sm:text-3xl font-bold text-stone-900 dark:text-stone-100 font-serif"> {t("login_screen.your_reading_journey_simplified")} </h2>
        </div>
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
              <div
                key={tv(feature.title)}
                className="hero-rise group flex items-start gap-4 sm:gap-5 p-5 sm:p-6 rounded-2xl border border-stone-200/60 dark:border-stone-700/60 bg-white dark:bg-stone-900 transition-all duration-300 hover:shadow-md"
                style={{ "--rise-delay": `${340 + i * 80}ms` } as React.CSSProperties}
              >
                <div className="shrink-0 w-11 h-11 rounded-xl bg-amber-50 dark:bg-amber-900/30 flex items-center justify-center">
                  <feature.icon className="w-5 h-5 text-amber-700 dark:text-amber-400" />
                </div>
                <div>
                  <h3 className="text-base font-semibold text-stone-800 dark:text-stone-200 mb-1">
                    {tv(feature.title)}
                  </h3>
                  <p className="text-sm leading-relaxed text-stone-500 dark:text-stone-400">
                    {tv(feature.description)}
                  </p>
                </div>
              </div>
            )
          })}
        </div>
      </div>

      {/* Footer */}
      <footer className="relative z-10 px-6 sm:px-8 pb-8 pt-4 border-t border-stone-200/60 dark:border-stone-800/60">
        <div className="max-w-6xl mx-auto flex flex-col sm:flex-row items-center justify-between gap-4">
          <div className="flex items-center gap-2">
            <Image
              src="/logo/bookswipe_logo.png"
              alt={t("login_screen.bookswipe")}
              width={24}
              height={24}
              className="w-5 h-5 opacity-50"
            />
            <p className="text-xs text-stone-400 dark:text-stone-500"> {t("login_screen.powered_by_google_books_open_library")} </p>
          </div>
          <div className="flex items-center gap-6">
            <span className="text-xs text-stone-400 dark:text-stone-500"> {t("login_screen.no_tracking_no_accounts_100_free")} </span>
            <a
              href="https://github.com/gs-imak/book-swipe"
              target="_blank"
              rel="noopener noreferrer"
              className="text-xs text-stone-400 dark:text-stone-500 hover:text-stone-600 dark:hover:text-stone-300 transition-colors"
            > {t("login_screen.github")} </a>
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
            ["--rotate" as string]: t("login_screen.deg", { v0: book.rotate }),
            animation: t("login_screen.float_s_ease_in_out_s", { v0: book.duration, v1: book.delay }),
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
              <p className="text-xs font-bold text-stone-800 dark:text-stone-200 font-serif"> {t("login_screen.bookswipe")} </p>
              <p className="text-[9px] text-stone-400">{t("login_screen.4_of_15")}</p>
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
                <p className="text-amber-400/80 text-[10px] uppercase tracking-[0.2em] font-medium mb-2"> {t("login_screen.a_novel")} </p>
                <h3 className="text-white text-xl font-bold leading-tight mb-1.5 font-serif"> {t("login_screen.the_midnight")} <br /> {t("login_screen.library")} </h3>
                <p className="text-stone-400 text-xs"> {t("login_screen.matt_haig")} </p>
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
                    <span>{t("login_screen.288p")}</span>
                  </div>
                  <span className="w-0.5 h-0.5 rounded-full bg-white/40" />
                  <div className="flex items-center gap-0.5">
                    <Clock className="w-2.5 h-2.5" />
                    <span>{t("login_screen.4_6_hours")}</span>
                  </div>
                </div>
                <div className="flex gap-1">
                  <span className="bg-white/15 border border-white/20 text-white text-[9px] px-2 py-0.5 rounded-full"> {t("login_screen.fiction")} </span>
                  <span className="bg-white/15 border border-white/20 text-white text-[9px] px-2 py-0.5 rounded-full"> {t("login_screen.philosophical")} </span>
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
              <span className="text-[8px] text-stone-300 dark:text-stone-600">{t("login_screen.library")}</span>
            </div>
            <div className="flex flex-col items-center gap-0.5">
              <BookOpen className="w-3.5 h-3.5 text-stone-800 dark:text-stone-200" />
              <span className="text-[8px] text-stone-800 dark:text-stone-200 font-medium">{t("login_screen.discover")}</span>
              <div className="w-1 h-1 rounded-full bg-amber-500 -mt-0.5" />
            </div>
            <div className="flex flex-col items-center gap-0.5">
              <Star className="w-3.5 h-3.5 text-stone-300 dark:text-stone-600" />
              <span className="text-[8px] text-stone-300 dark:text-stone-600">{t("login_screen.awards")}</span>
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
