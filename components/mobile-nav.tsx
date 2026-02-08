"use client"

import { motion } from "framer-motion"
import { Home, Sparkles, Trophy } from "lucide-react"

interface MobileNavProps {
  currentView: "dashboard" | "swipe" | "achievements"
  onNavigate: (view: "dashboard" | "swipe" | "achievements") => void
  likedCount?: number
}

export function MobileNav({ currentView, onNavigate, likedCount = 0 }: MobileNavProps) {
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
      id: "achievements" as const,
      icon: Trophy,
      label: "Achievements",
    },
  ]

  return (
    <>
      <motion.nav
        initial={{ y: 100, opacity: 0 }}
        animate={{ y: 0, opacity: 1 }}
        transition={{ type: "spring", stiffness: 300, damping: 30 }}
        className="fixed bottom-0 left-0 right-0 z-50 bg-[#FDFBF7]/95 backdrop-blur-xl border-t border-stone-200/80"
        style={{
          paddingBottom: "env(safe-area-inset-bottom, 0px)",
        }}
      >
        <div className="max-w-md mx-auto px-6 py-1.5">
          <div className="flex items-center justify-around">
            {navItems.map((item) => {
              const Icon = item.icon
              const isActive = currentView === item.id

              return (
                <motion.button
                  key={item.id}
                  onClick={() => onNavigate(item.id)}
                  className="relative flex flex-col items-center justify-center gap-0.5 py-2 px-4 rounded-xl transition-all duration-200 touch-manipulation tap-target"
                  whileTap={{ scale: 0.92 }}
                >
                  <div className="relative">
                    <Icon
                      className={`w-[22px] h-[22px] transition-colors duration-200 ${
                        isActive ? "text-stone-900" : "text-stone-400"
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
                  </div>

                  <span
                    className={`text-[10px] font-medium transition-colors duration-200 ${
                      isActive ? "text-stone-900" : "text-stone-400"
                    }`}
                  >
                    {item.label}
                  </span>

                  {/* Active dot indicator */}
                  {isActive && (
                    <motion.div
                      layoutId="nav-indicator"
                      className="absolute -bottom-0.5 w-1 h-1 rounded-full bg-amber-600"
                      transition={{ type: "spring", stiffness: 400, damping: 30 }}
                    />
                  )}
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
