"use client"

import { useState, useCallback } from "react"
import { motion, AnimatePresence } from "framer-motion"
import { ArrowRight, X } from "lucide-react"
import dynamic from "next/dynamic"
import { t } from "@/lib/i18n"
// Doodles are decorative and below the fold — dynamic() keeps them out of the
// hydration payload (they were 104KB gzip, 24.5% of the entire cold download).
const GroovyDoodle = dynamic(() => import("@/components/illustrations").then(m => ({ default: m.GroovyDoodle })))
const SittingReadingDoodle = dynamic(() => import("@/components/illustrations").then(m => ({ default: m.SittingReadingDoodle })))
const LovingDoodle = dynamic(() => import("@/components/illustrations").then(m => ({ default: m.LovingDoodle })))
const ReadingSideDoodle = dynamic(() => import("@/components/illustrations").then(m => ({ default: m.ReadingSideDoodle })))
const MeditatingDoodle = dynamic(() => import("@/components/illustrations").then(m => ({ default: m.MeditatingDoodle })))
const FloatDoodle = dynamic(() => import("@/components/illustrations").then(m => ({ default: m.FloatDoodle })))

interface OnboardingGuideProps {
  /** Genres are optional: skipping the guide must never block discovery. */
  onComplete: (genres?: string[]) => void
}

// The one question worth asking a brand-new user. Kept to a single tap-grid
// inside the guide that already runs, rather than a questionnaire in front of
// the deck — gating discovery behind a form is what got the old one skipped.
const GENRE_CHOICES = [
  "Fantasy",
  "Science Fiction",
  "Mystery",
  "Romance",
  "Thriller",
  "Historical Fiction",
  "Biography",
  "Self-Help",
  "Philosophy",
  "Horror",
] as const

const STEPS = [
  {
    title: "Welcome to BookSwipe",
    description: "Discover your next favorite book by swiping \u2014 like Tinder, but for books. Let\u2019s show you around!",
    Doodle: GroovyDoodle,
  },
  {
    title: "What do you read?",
    description: "Pick a few. This aims your very first deck \u2014 you can change it any time, and swiping teaches it more.",
    Doodle: SittingReadingDoodle,
    picker: true,
  },
  {
    title: "Your Library",
    description: "All your liked books live here. Organize them into shelves, track reading progress, and get personalized recommendations.",
    Doodle: SittingReadingDoodle,
  },
  {
    title: "Discover Books",
    description: "Swipe right to like a book, left to skip. The more you swipe, the smarter your recommendations get!",
    Doodle: LovingDoodle,
  },
  {
    title: "Read Free Classics",
    description: "Browse 70,000+ free classic books from Project Gutenberg. Read them right in the app with a beautiful reader.",
    Doodle: ReadingSideDoodle,
  },
  {
    title: "Your Taste Profile",
    description: "See what genres and moods you gravitate towards. Your profile builds as you discover more books.",
    Doodle: MeditatingDoodle,
  },
  {
    title: "Earn Awards",
    description: "Unlock achievements as you explore \u2014 from your first like to becoming a genre master. Have fun!",
    Doodle: FloatDoodle,
  },
] as const

export function OnboardingGuide({ onComplete }: OnboardingGuideProps) {
  const [currentStep, setCurrentStep] = useState(0)
  const [picked, setPicked] = useState<string[]>([])

  const step = STEPS[currentStep]
  const isLast = currentStep === STEPS.length - 1
  const Doodle = step.Doodle

  const handleNext = useCallback(() => {
    if (isLast) {
      onComplete(picked)
    } else {
      setCurrentStep((s) => s + 1)
    }
  }, [isLast, onComplete, picked])

  const handleSkip = useCallback(() => {
    // Keep anything already tapped — skipping means "stop explaining", not
    // "discard what I told you".
    onComplete(picked)
  }, [onComplete, picked])

  const togglePick = useCallback((genre: string) => {
    setPicked((prev) => (prev.includes(genre) ? prev.filter((g) => g !== genre) : [...prev, genre]))
  }, [])

  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      transition={{ duration: 0.2 }}
      className="fixed inset-0 z-[70] flex items-center justify-center bg-black/50 backdrop-blur-sm"
      style={{ paddingBottom: "env(safe-area-inset-bottom)" }}
    >
      <motion.div
        initial={{ opacity: 0, y: 30, scale: 0.95 }}
        animate={{ opacity: 1, y: 0, scale: 1 }}
        transition={{ type: "spring", stiffness: 300, damping: 28 }}
        className="relative bg-white dark:bg-stone-900 rounded-2xl shadow-2xl mx-5 max-w-sm w-full overflow-hidden"
      >
        {/* Skip button */}
        {!isLast && (
          <button
            onClick={handleSkip}
            className="absolute top-3 right-3 z-10 p-1.5 rounded-full text-stone-400 hover:text-stone-600 hover:bg-stone-100 dark:bg-stone-800 transition-colors"
            aria-label={t("onboarding_guide.skip_guide")}
          >
            <X className="w-4 h-4" />
          </button>
        )}

        {/* Content */}
        <div className="px-6 pt-6 pb-5">
          <AnimatePresence mode="wait">
            <motion.div
              key={currentStep}
              initial={{ opacity: 0, x: 30 }}
              animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0, x: -30 }}
              transition={{ duration: 0.2 }}
              className="flex flex-col items-center text-center"
            >
              {/* Doodle illustration — the picker step trades it for the grid */}
              {!("picker" in step && step.picker) && (
                <motion.div
                  className="w-44 h-36 mb-4"
                  initial={{ opacity: 0, scale: 0.9 }}
                  animate={{ opacity: 1, scale: 1 }}
                  transition={{ delay: 0.1, type: "spring", stiffness: 200, damping: 20 }}
                >
                  <Doodle className="w-full h-full" />
                </motion.div>
              )}

              {/* Text */}
              <h2 className="text-lg font-bold text-stone-900 dark:text-stone-100 mb-2">{step.title}</h2>
              <p className="text-sm text-stone-500 leading-relaxed max-w-[280px]">{step.description}</p>

              {"picker" in step && step.picker && (
                <div role="group" aria-label={t("onboarding_guide.favourite_genres")} className="mt-4 flex flex-wrap justify-center gap-2">
                  {GENRE_CHOICES.map((genre) => {
                    const on = picked.includes(genre)
                    return (
                      <button
                        key={genre}
                        type="button"
                        onClick={() => togglePick(genre)}
                        aria-pressed={on}
                        className={`min-h-[40px] px-3.5 rounded-full text-[13px] font-medium border transition-colors ${
                          on
                            ? "bg-stone-900 dark:bg-stone-100 text-white dark:text-stone-900 border-transparent"
                            : "border-stone-300 dark:border-stone-600 text-stone-600 dark:text-stone-300 hover:border-stone-500"
                        }`}
                      >
                        {genre}
                      </button>
                    )
                  })}
                </div>
              )}
            </motion.div>
          </AnimatePresence>
        </div>

        {/* Footer */}
        <div className="px-6 pb-6">
          {/* Progress dots */}
          <div className="flex items-center justify-center gap-1.5 mb-5">
            {STEPS.map((_, i) => (
              <motion.div
                key={i}
                className="rounded-full"
                animate={{
                  width: i === currentStep ? 20 : 6,
                  height: 6,
                  backgroundColor: i === currentStep ? "#d97706" : i < currentStep ? "#d9770680" : "#e7e5e4",
                }}
                transition={{ type: "spring", stiffness: 400, damping: 30 }}
              />
            ))}
          </div>

          {/* Action button */}
          <button
            onClick={handleNext}
            className="w-full flex items-center justify-center gap-2 py-3 rounded-xl text-sm font-semibold bg-stone-900 text-white hover:bg-stone-800 active:scale-[0.98] transition-all"
          >
            {isLast ? (
              "Start Exploring"
            ) : (
              <> {t("common.next")} <ArrowRight className="w-4 h-4" />
              </>
            )}
          </button>
        </div>
      </motion.div>
    </motion.div>
  )
}
