"use client"

import { motion } from "framer-motion"
import { Home, Heart, Trophy, Sparkles, User } from "lucide-react"

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
      color: "from-purple-500 to-pink-500",
      bgColor: "bg-purple-50",
    },
    {
      id: "swipe" as const,
      icon: Sparkles,
      label: "Discover",
      color: "from-green-500 to-emerald-500",
      bgColor: "bg-green-50",
    },
    {
      id: "achievements" as const,
      icon: Trophy,
      label: "Achievements",
      color: "from-yellow-500 to-orange-500",
      bgColor: "bg-yellow-50",
    },
  ]

  return (
    <>
      {/* Bottom Navigation Bar */}
      <motion.nav
        initial={{ y: 100, opacity: 0 }}
        animate={{ y: 0, opacity: 1 }}
        transition={{ type: "spring", stiffness: 300, damping: 30 }}
        className="fixed bottom-0 left-0 right-0 z-50 bg-white/95 backdrop-blur-xl border-t border-gray-200 shadow-2xl safe-area-inset-bottom"
        style={{
          paddingBottom: "env(safe-area-inset-bottom, 0px)",
        }}
      >
        <div className="max-w-md mx-auto px-4 py-2">
          <div className="flex items-center justify-center gap-4">
            {navItems.map((item) => {
              const Icon = item.icon
              const isActive = currentView === item.id
              
              return (
                <motion.button
                  key={item.id}
                  onClick={() => onNavigate(item.id)}
                  className={`relative flex flex-col items-center justify-center gap-1 py-2 px-3 rounded-2xl transition-all duration-300 flex-1 max-w-[100px] touch-manipulation tap-target ${
                    isActive ? item.bgColor : "hover:bg-gray-50"
                  }`}
                  whileTap={{ scale: 0.95 }}
                  whileHover={{ scale: 1.05 }}
                >
                  {/* Active Indicator */}
                  {isActive && (
                    <motion.div
                      className={`absolute inset-0 bg-gradient-to-r ${item.color} opacity-10 rounded-2xl`}
                      initial={{ opacity: 0 }}
                      animate={{ opacity: 0.1 }}
                      exit={{ opacity: 0 }}
                    />
                  )}

                  {/* Icon Container */}
                  <div className="relative flex items-center justify-center">
                    <motion.div
                      animate={isActive ? { scale: [1, 1.2, 1] } : {}}
                      transition={{ duration: 0.3 }}
                      className={`relative flex items-center justify-center ${
                        isActive
                          ? `bg-gradient-to-br ${item.color} p-3 rounded-xl shadow-xl`
                          : "p-2"
                      }`}
                    >
                      <Icon
                        className={`${isActive ? "w-7 h-7" : "w-6 h-6"} ${
                          isActive ? "text-white drop-shadow-[0_2px_4px_rgba(0,0,0,0.3)]" : "text-gray-400"
                        }`}
                        strokeWidth={isActive ? 3 : 1.5}
                      />
                    </motion.div>

                    {/* Badge for liked books count on Library */}
                    {item.id === "dashboard" && likedCount > 0 && (
                      <motion.div
                        initial={{ scale: 0 }}
                        animate={{ scale: 1 }}
                        className="absolute -top-0.5 -right-0.5 bg-gradient-to-r from-red-500 to-pink-500 text-white text-[10px] font-bold rounded-full min-w-[20px] h-[20px] px-1.5 flex items-center justify-center shadow-lg border-2 border-white"
                      >
                        {likedCount > 99 ? "99" : likedCount}
                      </motion.div>
                    )}

                    {/* Active dot indicator */}
                    {isActive && (
                      <motion.div
                        layoutId="activeDot"
                        className={`absolute -bottom-1 left-1/2 transform -translate-x-1/2 w-1 h-1 bg-gradient-to-r ${item.color} rounded-full shadow-lg`}
                        initial={{ scale: 0 }}
                        animate={{ scale: 1 }}
                        transition={{ type: "spring", stiffness: 500, damping: 30 }}
                      />
                    )}
                  </div>

                  {/* Label */}
                  <span
                    className={`text-[10px] font-semibold transition-colors text-center ${
                      isActive
                        ? "text-purple-600"
                        : "text-gray-600"
                    }`}
                  >
                    {item.label}
                  </span>

                  {/* Ripple effect on tap */}
                  {isActive && (
                    <motion.div
                      className="absolute inset-0 rounded-2xl"
                      initial={{ scale: 0.8, opacity: 0.5 }}
                      animate={{ scale: 1.5, opacity: 0 }}
                      transition={{ duration: 0.6, repeat: Infinity, repeatDelay: 2 }}
                      style={{
                        background: `radial-gradient(circle, ${
                          item.color.includes("purple")
                            ? "rgba(168, 85, 247, 0.2)"
                            : item.color.includes("green")
                            ? "rgba(34, 197, 94, 0.2)"
                            : "rgba(234, 179, 8, 0.2)"
                        } 0%, transparent 70%)`,
                      }}
                    />
                  )}
                </motion.button>
              )
            })}
          </div>
        </div>

        {/* Bottom safe area for devices with home indicator */}
        <div className="h-safe" />
      </motion.nav>

      {/* Spacer to prevent content from being hidden behind nav */}
      <div className="h-20" style={{ height: "calc(80px + env(safe-area-inset-bottom, 0px))" }} />
    </>
  )
}

