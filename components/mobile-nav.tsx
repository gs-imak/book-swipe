"use client"

import { motion } from "framer-motion"
import { Home, Sparkles, Trophy, BarChart3, BookOpen, Search } from "lucide-react"
import { NewDot } from "./new-badge"

type NavView = "dashboard" | "swipe" | "read" | "achievements" | "profile"

interface MobileNavProps {
  currentView: NavView
  onNavigate: (view: NavView) => void
  likedCount?: number
  onSearch?: () => void
}

const NAV_NEW_FEATURES: Record<string, string[]> = {
  dashboard: ["collections", "challenges", "global_search"],
  read: ["series_detection"],
  profile: ["tags", "settings", "activity_feed"],
}

export function MobileNav({ currentView, onNavigate, likedCount = 0, onSearch }: MobileNavProps) {
  const navItems = [
    {
      id: "dashboard" as const,
      icon: Home,
      label: "Library",
    },
    {
      id: "swipe" as const,
      icon: Sparkles,
      label: "Discover",
    },
    {
      id: "read" as const,
      icon: BookOpen,
      label: "Read",
    },
    {
      id: "profile" as const,
      icon: BarChart3,
      label: "Profile",
    },
    {
      id: "achievements" as const,
      icon: Trophy,
      label: "Awards",
    },
  ]

  return (
    <>
      {/* Floating search button above nav */}
      {onSearch && (
        <motion.button
          initial={{ scale: 0, opacity: 0 }}
          animate={{ scale: 1, opacity: 1 }}
          transition={{ type: "spring", stiffness: 400, damping: 25, delay: 0.15 }}
          onClick={onSearch}
          aria-label="Search library, notes, and reviews"
          className="fixed z-50 left-1/2 -translate-x-1/2 flex items-center gap-1.5 px-4 py-2 rounded-full bg-stone-900 dark:bg-stone-100 text-white dark:text-stone-900 shadow-lg shadow-stone-900/20 dark:shadow-stone-100/20 hover:shadow-xl hover:scale-105 active:scale-95 transition-all touch-manipulation"
          style={{
            bottom: "calc(60px + env(safe-area-inset-bottom, 0px))",
          }}
          whileTap={{ scale: 0.92 }}
        >
          <Search className="w-3.5 h-3.5" strokeWidth={2.2} />
          <span className="text-xs font-semibold tracking-wide">Search</span>
        </motion.button>
      )}

      <motion.nav
        aria-label="Main navigation"
        initial={{ y: 100, opacity: 0 }}
        animate={{ y: 0, opacity: 1 }}
        transition={{ type: "spring", stiffness: 300, damping: 30 }}
        className="fixed bottom-0 left-0 right-0 z-50 bg-background/95 backdrop-blur-xl border-t border-stone-200/80 dark:border-stone-700/80"
        style={{
          paddingBottom: "env(safe-area-inset-bottom, 0px)",
        }}
      >
        <div className="max-w-md mx-auto px-4 py-1.5">
          <div className="flex items-center justify-around">
            {navItems.map((item) => {
              const Icon = item.icon
              const isActive = currentView === item.id
              const featureIds = NAV_NEW_FEATURES[item.id]

              return (
                <motion.button
                  key={item.id}
                  onClick={() => onNavigate(item.id)}
                  aria-label={item.label}
                  aria-current={isActive ? "page" : undefined}
                  className="relative flex flex-col items-center justify-center gap-0.5 py-2 px-3 rounded-xl transition-all duration-200 touch-manipulation tap-target"
                  whileTap={{ scale: 0.92 }}
                >
                  <div className="relative">
                    <Icon
                      className={`w-[22px] h-[22px] transition-colors duration-200 ${
                        isActive ? "text-stone-900 dark:text-stone-100" : "text-stone-500 dark:text-stone-400"
                      }`}
                      strokeWidth={isActive ? 2.5 : 1.8}
                    />

                    {/* Badge for liked books count */}
                    {item.id === "dashboard" && likedCount > 0 && (
                      <motion.div
                        initial={{ scale: 0 }}
                        animate={{ scale: 1 }}
                        className="absolute -top-1.5 -right-2.5 bg-amber-600 text-white text-[9px] font-bold rounded-full min-w-[16px] h-[16px] px-1 flex items-center justify-center"
                      >
                        {likedCount > 99 ? "99" : likedCount}
                      </motion.div>
                    )}

                    {featureIds && featureIds.length > 0 && (
                      <NewDot featureIds={featureIds} className="-top-0.5 -right-0.5" />
                    )}
                  </div>

                  <span
                    className={`text-[10px] font-medium transition-colors duration-200 ${
                      isActive ? "text-stone-900 dark:text-stone-100" : "text-stone-500 dark:text-stone-400"
                    }`}
                  >
                    {item.label}
                  </span>

                </motion.button>
              )
            })}
          </div>
        </div>

        <div className="h-safe" />
      </motion.nav>

      {/* Spacer */}
      <div className="h-16" style={{ height: "calc(64px + env(safe-area-inset-bottom, 0px))" }} />
    </>
  )
}
