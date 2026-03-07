"use client"

import { useState, useEffect } from "react"
import { motion, AnimatePresence } from "framer-motion"
import { Target, Check } from "lucide-react"
import { updateReadingGoals } from "@/lib/storage"

const GOAL_CONFIGURED_KEY = "bookswipe_goal_configured"

const GOAL_OPTIONS = [
  { value: 6,  label: "6 books",  sub: "One every 2 months" },
  { value: 12, label: "12 books", sub: "One a month" },
  { value: 24, label: "24 books", sub: "Two a month" },
  { value: 52, label: "52 books", sub: "One a week" },
]

interface ReadingGoalSetterProps {
  onGoalSet?: () => void
}

export function ReadingGoalSetter({ onGoalSet }: ReadingGoalSetterProps) {
  const [visible, setVisible] = useState(false)
  const [selected, setSelected] = useState<number | null>(null)
  const [confirmed, setConfirmed] = useState(false)

  useEffect(() => {
    const alreadySet = typeof window !== "undefined"
      ? localStorage.getItem(GOAL_CONFIGURED_KEY)
      : "1"
    if (!alreadySet) setVisible(true)
  }, [])

  const handleSet = () => {
    if (!selected) return
    updateReadingGoals({ yearlyTarget: selected })
    localStorage.setItem(GOAL_CONFIGURED_KEY, "1")
    setConfirmed(true)
    setTimeout(() => {
      setVisible(false)
      onGoalSet?.()
    }, 1200)
  }

  return (
    <AnimatePresence>
      {visible && (
        <motion.div
          initial={{ opacity: 0, y: 8 }}
          animate={{ opacity: 1, y: 0 }}
          exit={{ opacity: 0, y: -6, scale: 0.98 }}
          transition={{ type: "spring", stiffness: 300, damping: 28 }}
        >
          {confirmed ? (
            <motion.div
              initial={{ opacity: 1 }}
              animate={{ opacity: 0, scale: 0.96 }}
              transition={{ delay: 0.7, duration: 0.4 }}
              className="flex items-center gap-3 px-5 py-4 bg-emerald-50 border border-emerald-200/60 rounded-2xl"
            >
              <div className="w-7 h-7 rounded-full bg-emerald-500 flex items-center justify-center flex-shrink-0">
                <Check className="w-4 h-4 text-white" />
              </div>
              <p className="text-sm font-medium text-emerald-800">
                Goal set — let&apos;s go!
              </p>
            </motion.div>
          ) : (
            <div className="bg-white border border-stone-200/60 rounded-2xl p-5 shadow-sm">
              <div className="flex items-center gap-2 mb-1">
                <Target className="w-4 h-4 text-amber-600" />
                <h3 className="text-sm font-semibold text-stone-900">
                  Set your {new Date().getFullYear()} reading goal
                </h3>
              </div>
              <p className="text-xs text-stone-400 mb-4 ml-6">
                How many books do you want to read this year?
              </p>

              <div className="grid grid-cols-2 gap-2 mb-4">
                {GOAL_OPTIONS.map((opt) => (
                  <button
                    key={opt.value}
                    onClick={() => setSelected(opt.value)}
                    className={`p-3 rounded-xl border text-left transition-all active:scale-[0.97] ${
                      selected === opt.value
                        ? "border-amber-500 bg-amber-50"
                        : "border-stone-200 bg-stone-50 hover:border-stone-300"
                    }`}
                  >
                    <p className={`text-sm font-semibold ${
                      selected === opt.value ? "text-amber-800" : "text-stone-800"
                    }`}>
                      {opt.label}
                    </p>
                    <p className={`text-[11px] mt-0.5 ${
                      selected === opt.value ? "text-amber-600" : "text-stone-400"
                    }`}>
                      {opt.sub}
                    </p>
                  </button>
                ))}
              </div>

              <button
                onClick={handleSet}
                disabled={!selected}
                className="w-full h-10 rounded-xl bg-stone-900 text-white text-sm font-medium transition-all hover:bg-stone-800 active:scale-[0.98] disabled:opacity-35 disabled:cursor-not-allowed"
              >
                Set goal
              </button>
            </div>
          )}
        </motion.div>
      )}
    </AnimatePresence>
  )
}
