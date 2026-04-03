"use client"

import { useState, useEffect, useCallback } from "react"
import { motion, AnimatePresence } from "framer-motion"
import { X, Tag, Search, Activity, Settings, Link2, Bell } from "lucide-react"
import {
  getUserFeatureVersion,
  setUserFeatureVersion,
  markAllFeaturesSeen,
  CURRENT_FEATURE_VERSION,
  isOnboarded,
} from "@/lib/storage"

interface FeatureEntry {
  id: string
  icon: typeof Tag
  title: string
  description: string
}

const VERSION_2_FEATURES: FeatureEntry[] = [
  {
    id: "tags",
    icon: Tag,
    title: "Custom Tags",
    description: "Organize your books with personal tags for quick filtering.",
  },
  {
    id: "global_search",
    icon: Search,
    title: "Global Search",
    description: "Find any book across your library, shelves, and collections instantly.",
  },
  {
    id: "activity_feed",
    icon: Activity,
    title: "Activity Feed",
    description: "Track your reading activity and see your history at a glance.",
  },
  {
    id: "series_detection",
    icon: Link2,
    title: "Series Detection",
    description: "Automatically identifies books that belong to the same series.",
  },
  {
    id: "notifications",
    icon: Bell,
    title: "Reading Reminders",
    description: "Gentle nudges to keep your reading streak alive.",
  },
  {
    id: "settings",
    icon: Settings,
    title: "Settings Panel",
    description: "Theme, reading speed, and notification preferences in one place.",
  },
]

export function WhatsNewModal() {
  const [open, setOpen] = useState(false)

  useEffect(() => {
    if (!isOnboarded()) return
    const storedVersion = getUserFeatureVersion()
    if (storedVersion < CURRENT_FEATURE_VERSION) {
      const timer = setTimeout(() => setOpen(true), 800)
      return () => clearTimeout(timer)
    }
  }, [])

  const handleDismiss = useCallback(() => {
    setOpen(false)
    markAllFeaturesSeen()
    setUserFeatureVersion(CURRENT_FEATURE_VERSION)
  }, [])

  return (
    <AnimatePresence>
      {open && (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          transition={{ duration: 0.2 }}
          className="fixed inset-0 z-[80] flex items-center justify-center bg-black/50 backdrop-blur-sm"
          style={{ paddingBottom: "env(safe-area-inset-bottom)" }}
          onClick={handleDismiss}
          role="dialog"
          aria-modal="true"
          aria-label="What's new in this update"
        >
          <motion.div
            initial={{ opacity: 0, y: 40, scale: 0.94 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: 20, scale: 0.96 }}
            transition={{ type: "spring", stiffness: 320, damping: 28 }}
            className="relative bg-white dark:bg-stone-900 rounded-2xl shadow-2xl mx-5 max-w-sm w-full overflow-hidden"
            onClick={(e) => e.stopPropagation()}
          >
            <button
              onClick={handleDismiss}
              className="absolute top-3 right-3 z-10 p-1.5 rounded-full text-stone-400 hover:text-stone-600 hover:bg-stone-100 dark:hover:bg-stone-800 transition-colors"
              aria-label="Close"
            >
              <X className="w-4 h-4" />
            </button>

            <div className="px-6 pt-6 pb-2">
              <div className="flex items-center gap-2.5 mb-1">
                <span className="inline-flex items-center px-2 py-0.5 text-[10px] font-bold tracking-wide uppercase rounded-full bg-amber-400 text-amber-950">
                  v{CURRENT_FEATURE_VERSION}
                </span>
              </div>
              <h2 className="text-lg font-bold text-stone-900 dark:text-stone-100">
                What&apos;s New
              </h2>
              <p className="text-xs text-stone-500 dark:text-stone-400 mt-0.5">
                Features added since your last visit
              </p>
            </div>

            <div className="px-6 pb-2 max-h-[50vh] overflow-y-auto">
              <ul className="space-y-1" role="list">
                {VERSION_2_FEATURES.map((feature, i) => {
                  const Icon = feature.icon
                  return (
                    <motion.li
                      key={feature.id}
                      initial={{ opacity: 0, x: -12 }}
                      animate={{ opacity: 1, x: 0 }}
                      transition={{ delay: 0.1 + i * 0.06, type: "spring", stiffness: 300, damping: 25 }}
                      className="flex items-start gap-3 py-2.5 border-b border-stone-100 dark:border-stone-800 last:border-0"
                    >
                      <div className="flex-shrink-0 w-8 h-8 rounded-lg bg-amber-50 dark:bg-amber-900/30 flex items-center justify-center mt-0.5">
                        <Icon className="w-4 h-4 text-amber-600 dark:text-amber-400" />
                      </div>
                      <div className="min-w-0">
                        <p className="text-sm font-semibold text-stone-900 dark:text-stone-100 leading-tight">
                          {feature.title}
                        </p>
                        <p className="text-xs text-stone-500 dark:text-stone-400 mt-0.5 leading-relaxed">
                          {feature.description}
                        </p>
                      </div>
                    </motion.li>
                  )
                })}
              </ul>
            </div>

            <div className="px-6 pb-6 pt-3">
              <button
                onClick={handleDismiss}
                className="w-full py-3 rounded-xl text-sm font-semibold bg-stone-900 dark:bg-stone-100 text-white dark:text-stone-900 hover:bg-stone-800 dark:hover:bg-stone-200 active:scale-[0.98] transition-all"
              >
                Got it
              </button>
            </div>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  )
}
