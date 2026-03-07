"use client"

import { useState, useCallback } from "react"
import { motion, AnimatePresence } from "framer-motion"
import { Home, Sparkles, BookOpen, BarChart3, Trophy, ArrowRight, X, ChevronRight } from "lucide-react"

interface OnboardingGuideProps {
  onComplete: () => void
}

const STEPS = [
  {
    icon: Sparkles,
    iconBg: "bg-amber-100",
    iconColor: "text-amber-600",
    title: "Welcome to BookSwipe",
    description: "Discover your next favorite book by swiping — like Tinder, but for books. Let\u2019s show you around!",
    illustration: "wave",
  },
  {
    icon: Home,
    iconBg: "bg-stone-100",
    iconColor: "text-stone-700",
    title: "Your Library",
    description: "All your liked books live here. Organize them into shelves, track reading progress, and get personalized recommendations.",
    illustration: "library",
  },
  {
    icon: Sparkles,
    iconBg: "bg-violet-100",
    iconColor: "text-violet-600",
    title: "Discover Books",
    description: "Swipe right to like a book, left to skip. The more you swipe, the smarter your recommendations get!",
    illustration: "swipe",
  },
  {
    icon: BookOpen,
    iconBg: "bg-amber-100",
    iconColor: "text-amber-600",
    title: "Read Free Classics",
    description: "Browse 70,000+ free classic books from Project Gutenberg. Read them right in the app with a beautiful reader.",
    illustration: "read",
  },
  {
    icon: BarChart3,
    iconBg: "bg-teal-100",
    iconColor: "text-teal-600",
    title: "Your Taste Profile",
    description: "See what genres and moods you gravitate towards. Your profile builds as you discover more books.",
    illustration: "profile",
  },
  {
    icon: Trophy,
    iconBg: "bg-yellow-100",
    iconColor: "text-yellow-600",
    title: "Earn Awards",
    description: "Unlock achievements as you explore \u2014 from your first like to becoming a genre master. Have fun!",
    illustration: "awards",
  },
] as const

function StepIllustration({ type, step }: { type: string; step: number }) {
  const colors = [
    { from: "from-amber-400", to: "to-orange-500" },
    { from: "from-stone-400", to: "to-stone-600" },
    { from: "from-violet-400", to: "to-purple-500" },
    { from: "from-amber-400", to: "to-amber-600" },
    { from: "from-teal-400", to: "to-cyan-500" },
    { from: "from-yellow-400", to: "to-orange-400" },
  ]
  const { from, to } = colors[step] || colors[0]

  if (type === "wave") {
    return (
      <div className="relative w-32 h-32 mx-auto">
        <motion.div
          className={`absolute inset-0 rounded-full bg-gradient-to-br ${from} ${to} opacity-20`}
          animate={{ scale: [1, 1.15, 1] }}
          transition={{ duration: 2, repeat: Infinity, ease: "easeInOut" }}
        />
        <motion.div
          className={`absolute inset-3 rounded-full bg-gradient-to-br ${from} ${to} opacity-30`}
          animate={{ scale: [1, 1.1, 1] }}
          transition={{ duration: 2, repeat: Infinity, ease: "easeInOut", delay: 0.2 }}
        />
        <div className={`absolute inset-6 rounded-full bg-gradient-to-br ${from} ${to} flex items-center justify-center`}>
          <span className="text-4xl">👋</span>
        </div>
      </div>
    )
  }

  if (type === "swipe") {
    return (
      <div className="relative w-40 h-32 mx-auto flex items-center justify-center">
        {/* Background card */}
        <div className="absolute w-20 h-28 rounded-xl bg-stone-200 rotate-[-4deg] translate-x-[-6px]" />
        {/* Main card */}
        <motion.div
          className={`relative w-20 h-28 rounded-xl bg-gradient-to-br ${from} ${to} shadow-lg flex items-center justify-center`}
          animate={{ x: [0, 12, 0], rotate: [0, 3, 0] }}
          transition={{ duration: 2.5, repeat: Infinity, ease: "easeInOut" }}
        >
          <BookOpen className="w-8 h-8 text-white/80" />
        </motion.div>
        {/* Arrow hint */}
        <motion.div
          className="absolute right-2 top-1/2 -translate-y-1/2"
          animate={{ x: [0, 6, 0], opacity: [0.4, 0.8, 0.4] }}
          transition={{ duration: 1.5, repeat: Infinity }}
        >
          <ChevronRight className="w-6 h-6 text-emerald-500" />
        </motion.div>
      </div>
    )
  }

  if (type === "library") {
    return (
      <div className="relative w-40 h-28 mx-auto flex items-end justify-center gap-1.5 pb-2">
        {[0.6, 0.8, 1, 0.75, 0.9, 0.65, 0.85].map((h, i) => (
          <motion.div
            key={i}
            className={`w-4 rounded-t-sm bg-gradient-to-t ${from} ${to}`}
            initial={{ height: 0 }}
            animate={{ height: `${h * 90}px` }}
            transition={{ delay: i * 0.08, type: "spring", stiffness: 200, damping: 15 }}
          />
        ))}
      </div>
    )
  }

  if (type === "read") {
    return (
      <div className="relative w-28 h-32 mx-auto">
        <div className={`absolute inset-0 rounded-xl bg-gradient-to-br ${from} ${to} shadow-md flex flex-col items-center justify-center gap-2 px-3`}>
          <BookOpen className="w-8 h-8 text-white/90" />
          <div className="space-y-1 w-full">
            <div className="h-1 bg-white/30 rounded-full w-full" />
            <div className="h-1 bg-white/30 rounded-full w-4/5" />
            <div className="h-1 bg-white/30 rounded-full w-full" />
            <div className="h-1 bg-white/30 rounded-full w-3/5" />
          </div>
        </div>
      </div>
    )
  }

  if (type === "profile") {
    return (
      <div className="relative w-40 h-28 mx-auto flex items-end justify-center gap-3 pb-2">
        {[40, 70, 55, 85, 35].map((h, i) => (
          <motion.div
            key={i}
            className="w-5 rounded-t-md"
            style={{ background: `linear-gradient(to top, hsl(${170 + i * 15}, 60%, 45%), hsl(${170 + i * 15}, 70%, 55%))` }}
            initial={{ height: 0 }}
            animate={{ height: `${h}%` }}
            transition={{ delay: i * 0.1, type: "spring", stiffness: 180, damping: 14 }}
          />
        ))}
      </div>
    )
  }

  // awards
  return (
    <div className="relative w-32 h-32 mx-auto flex items-center justify-center">
      <motion.div
        className={`absolute inset-0 rounded-full bg-gradient-to-br ${from} ${to} opacity-15`}
        animate={{ rotate: 360 }}
        transition={{ duration: 8, repeat: Infinity, ease: "linear" }}
      />
      <motion.div
        className={`w-20 h-20 rounded-full bg-gradient-to-br ${from} ${to} flex items-center justify-center shadow-lg`}
        animate={{ scale: [1, 1.06, 1] }}
        transition={{ duration: 2, repeat: Infinity, ease: "easeInOut" }}
      >
        <Trophy className="w-9 h-9 text-white" />
      </motion.div>
    </div>
  )
}

export function OnboardingGuide({ onComplete }: OnboardingGuideProps) {
  const [currentStep, setCurrentStep] = useState(0)

  const step = STEPS[currentStep]
  const isLast = currentStep === STEPS.length - 1
  const Icon = step.icon

  const handleNext = useCallback(() => {
    if (isLast) {
      onComplete()
    } else {
      setCurrentStep((s) => s + 1)
    }
  }, [isLast, onComplete])

  const handleSkip = useCallback(() => {
    onComplete()
  }, [onComplete])

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
        className="relative bg-white rounded-2xl shadow-2xl mx-5 max-w-sm w-full overflow-hidden"
      >
        {/* Skip button */}
        {!isLast && (
          <button
            onClick={handleSkip}
            className="absolute top-3 right-3 z-10 p-1.5 rounded-full text-stone-400 hover:text-stone-600 hover:bg-stone-100 transition-colors"
            aria-label="Skip guide"
          >
            <X className="w-4 h-4" />
          </button>
        )}

        {/* Content */}
        <div className="px-6 pt-8 pb-6">
          <AnimatePresence mode="wait">
            <motion.div
              key={currentStep}
              initial={{ opacity: 0, x: 30 }}
              animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0, x: -30 }}
              transition={{ duration: 0.2 }}
              className="flex flex-col items-center text-center"
            >
              {/* Illustration */}
              <div className="mb-5 h-32 flex items-center">
                <StepIllustration type={step.illustration} step={currentStep} />
              </div>

              {/* Icon badge */}
              <div className={`w-10 h-10 rounded-xl ${step.iconBg} flex items-center justify-center mb-3`}>
                <Icon className={`w-5 h-5 ${step.iconColor}`} />
              </div>

              {/* Text */}
              <h2 className="text-lg font-bold text-stone-900 mb-2">{step.title}</h2>
              <p className="text-sm text-stone-500 leading-relaxed max-w-[280px]">{step.description}</p>
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
              <>
                Next
                <ArrowRight className="w-4 h-4" />
              </>
            )}
          </button>
        </div>
      </motion.div>
    </motion.div>
  )
}
