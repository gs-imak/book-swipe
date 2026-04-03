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
      {/* Floating search button above nav — mobile only, hidden on desktop (sidebar has its own) */}
      {onSearch && (
        <motion.button
          initial={{ scale: 0, opacity: 0 }}
          animate={{ scale: 1, opacity: 1 }}
          transition={{ type: "spring", stiffness: 400, damping: 25, delay: 0.15 }}
          onClick={onSearch}
          aria-label="Search library, notes, and reviews"
          className="fixed z-50 left-1/2 -translate-x-1/2 flex items-center gap-1.5 px-4 py-2 rounded-full bg-stone-900 dark:bg-stone-100 text-white dark:text-stone-900 shadow-lg shadow-stone-900/20 dark:shadow-stone-100/20 hover:shadow-xl hover:scale-105 active:scale-95 transition-all touch-manipulation lg:hidden"
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
        data-desktop-sidebar=""
        initial={{ y: 100, opacity: 0 }}
        animate={{ y: 0, opacity: 1 }}
        transition={{ type: "spring", stiffness: 300, damping: 30 }}
        className={[
          // Mobile: bottom bar
          "fixed bottom-0 left-0 right-0 z-50",
          "bg-background/95 backdrop-blur-xl",
          "border-t border-stone-200/80 dark:border-stone-700/80",
          // Desktop: left sidebar
          "lg:top-0 lg:bottom-0 lg:right-auto lg:w-16",
          "lg:border-t-0 lg:border-r",
          "lg:flex lg:flex-col",
        ].join(" ")}
        style={{
          paddingBottom: "env(safe-area-inset-bottom, 0px)",
        }}
      >
        {/* Desktop: branding area at top of sidebar */}
        <div className="hidden lg:flex lg:items-center lg:justify-center lg:h-14 lg:border-b lg:border-stone-200/80 lg:dark:border-stone-700/80 lg:shrink-0">
          <span className="text-sm font-bold tracking-tight text-amber-600">BS</span>
        </div>

        {/* Nav items container */}
        <div className="max-w-md mx-auto px-4 py-1.5 lg:max-w-none lg:mx-0 lg:px-0 lg:py-3 lg:flex-1">
          <div className="flex items-center justify-around lg:flex-col lg:items-stretch lg:justify-start lg:gap-1">
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
                  className={[
                    // Base (mobile)
                    "relative flex flex-col items-center justify-center gap-0.5",
                    "py-2 px-3 rounded-xl",
                    "transition-all duration-200 touch-manipulation tap-target",
                    // Desktop overrides
                    "lg:py-2.5 lg:px-1 lg:mx-1 lg:rounded-lg lg:gap-0.5",
                    // Desktop hover
                    "lg:hover:bg-stone-100 lg:dark:hover:bg-stone-800",
                    // Desktop active — handled by the indicator bar child element
                  ].join(" ")}
                  whileTap={{ scale: 0.92 }}
                >
                  {/* Active indicator bar — desktop only */}
                  {isActive && (
                    <span
                      className="hidden lg:block absolute left-0 top-1/2 -translate-y-1/2 w-[3px] h-6 rounded-r-full bg-amber-600"
                      aria-hidden="true"
                    />
                  )}

                  <div className="relative">
                    <Icon
                      className={[
                        "w-[22px] h-[22px] transition-colors duration-200",
                        isActive
                          ? "text-stone-900 dark:text-stone-100 lg:text-amber-600 lg:dark:text-amber-500"
                          : "text-stone-500 dark:text-stone-400",
                      ].join(" ")}
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
                    className={[
                      "text-[10px] font-medium transition-colors duration-200",
                      isActive
                        ? "text-stone-900 dark:text-stone-100 lg:text-amber-600 lg:dark:text-amber-500 lg:font-bold"
                        : "text-stone-500 dark:text-stone-400",
                    ].join(" ")}
                  >
                    {item.label}
                  </span>

                </motion.button>
              )
            })}
          </div>
        </div>

        {/* Desktop: search shortcut at bottom of sidebar */}
        {onSearch && (
          <div className="hidden lg:flex lg:items-center lg:justify-center lg:py-3 lg:border-t lg:border-stone-200/80 lg:dark:border-stone-700/80 lg:shrink-0">
            <button
              onClick={onSearch}
              aria-label="Search"
              className="flex flex-col items-center gap-0.5 py-2 px-1 rounded-lg text-stone-400 dark:text-stone-500 hover:text-stone-900 dark:hover:text-stone-100 hover:bg-stone-100 dark:hover:bg-stone-800 transition-colors duration-150 w-[calc(100%-8px)]"
            >
              <Search className="w-[20px] h-[20px]" strokeWidth={1.8} />
              <span className="text-[10px] font-medium">Search</span>
            </button>
          </div>
        )}

        <div className="h-safe lg:h-0" />
      </motion.nav>

      {/* Spacer: bottom padding on mobile (desktop offset handled by CSS :has() rule) */}
      <div
        className="h-16 lg:hidden"
        style={{ height: "calc(64px + env(safe-area-inset-bottom, 0px))" }}
      />
    </>
  )
}
