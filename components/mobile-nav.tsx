"use client"

import { motion } from "framer-motion"
import { Home, Sparkles, Trophy, BarChart3, BookOpen, Search, Sun, Moon, Camera, Cloud, User } from "lucide-react"
import { toggleTheme } from "@/lib/theme"
import { useTheme } from "@/lib/use-theme"
import { t, tv } from "@/lib/i18n"

type NavView = "dashboard" | "swipe" | "read" | "achievements" | "profile"

interface MobileNavProps {
  currentView: NavView
  onNavigate: (view: NavView) => void
  likedCount?: number
  onSearch?: () => void
  onScan?: () => void
  onSignIn?: () => void
  isSignedIn?: boolean
}

export function MobileNav({ currentView, onNavigate, likedCount = 0, onSearch, onScan, onSignIn, isSignedIn }: MobileNavProps) {
  // Subscribed: stays in sync when the theme is toggled anywhere (settings,
  // another tab), and is hydration-safe via the store's server snapshot.
  const isDark = useTheme() === "dark"

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
      {/*
        Mobile floating Search/Scan pills were removed — they duplicated the
        header Search button and hung in dead space above the tab bar. Scan
        now lives in the Library header next to Search. On desktop, Search
        and Scan stay in the left sidebar below the nav items (see below).
      */}

      <motion.nav
        aria-label={t("mobile_nav.main_navigation")}
        data-desktop-sidebar=""
        initial={{ y: 100, opacity: 0 }}
        animate={{ y: 0, opacity: 1 }}
        transition={{ type: "spring", stiffness: 300, damping: 30 }}
        className={[
          // Mobile: bottom bar
          "fixed bottom-0 left-0 right-0 z-nav",
          "bg-[rgba(255,255,255,.95)] dark:bg-[rgba(30,26,23,.95)] backdrop-blur-xl",
          "border-t border-border",
          // Desktop: left sidebar
          "lg:top-0 lg:bottom-0 lg:right-auto lg:w-[76px]",
          "lg:border-t-0 lg:border-r",
          "lg:flex lg:flex-col",
        ].join(" ")}
        style={{
          paddingBottom: "env(safe-area-inset-bottom, 0px)",
        }}
      >
        {/* Desktop: branding area at top of sidebar */}
        <div className="hidden lg:flex lg:items-center lg:justify-center lg:h-14 lg:border-b lg:border-border lg:shrink-0">
          <span className="font-serif font-semibold text-[17px] text-ink">B.</span>
        </div>

        {/* Nav items container */}
        <div className="max-w-md mx-auto px-4 py-1.5 lg:max-w-none lg:mx-0 lg:px-0 lg:py-3 lg:flex-1">
          <div className="flex items-center justify-around lg:flex-col lg:items-stretch lg:justify-start lg:gap-1">
            {navItems.map((item) => {
              const Icon = item.icon
              const isActive = currentView === item.id
              return (
                <motion.button
                  key={item.id}
                  onClick={() => onNavigate(item.id)}
                  aria-label={tv(item.label)}
                  aria-current={isActive ? "page" : undefined}
                  className={[
                    // Base (mobile)
                    "relative flex flex-col items-center justify-center gap-0.5",
                    "py-2 px-3 rounded-control",
                    "transition-all duration-200 touch-manipulation tap-target",
                    // Desktop overrides
                    "lg:py-2.5 lg:px-1 lg:mx-1 lg:rounded-control lg:gap-0.5",
                    // Desktop hover
                    "lg:hover:bg-surface-2",
                    isActive ? "lg:bg-surface-2" : "",
                  ].join(" ")}
                  whileTap={{ scale: 0.92 }}
                >
                  <div className="relative">
                    <Icon
                      className={[
                        "w-[22px] h-[22px] transition-colors duration-200",
                        isActive ? "text-ink" : "text-ink-muted",
                      ].join(" ")}
                      strokeWidth={isActive ? 2.2 : 1.8}
                    />
                  </div>

                  <span
                    className={[
                      "text-[10px] font-medium transition-colors duration-200 tabular-nums",
                      isActive ? "text-ink font-bold" : "text-ink-muted",
                    ].join(" ")}
                  >
                    {item.id === "dashboard" && likedCount > 0
                      ? `${tv(item.label)} · ${likedCount > 999 ? t("mobile_nav.1k") : likedCount}`
                      : tv(item.label)}
                  </span>

                </motion.button>
              )
            })}
          </div>
        </div>

        {/* Desktop: search + scan + theme toggle at bottom of sidebar */}
        <div className="hidden lg:flex lg:flex-col lg:shrink-0 lg:border-t lg:border-border">
          {onSearch && (
            <div className="lg:flex lg:items-center lg:justify-center lg:pt-3 lg:pb-1">
              <button
                onClick={onSearch}
                aria-label={t("mobile_nav.search")}
                className="flex flex-col items-center gap-0.5 py-2 px-1 rounded-control text-ink-muted hover:text-ink hover:bg-surface-2 transition-colors duration-150 w-[calc(100%-8px)]"
              >
                <Search className="w-[20px] h-[20px]" strokeWidth={1.8} />
                <span className="text-[10px] font-medium">{t("mobile_nav.search")}</span>
              </button>
            </div>
          )}
          {onScan && (
            <div className="lg:flex lg:items-center lg:justify-center lg:pb-1">
              <button
                onClick={onScan}
                aria-label={t("mobile_nav.scan_a_book_barcode")}
                className="flex flex-col items-center gap-0.5 py-2 px-1 rounded-control text-ink-muted hover:text-ink hover:bg-surface-2 transition-colors duration-150 w-[calc(100%-8px)]"
              >
                <Camera className="w-[20px] h-[20px]" strokeWidth={1.8} />
                <span className="text-[10px] font-medium">{t("mobile_nav.scan")}</span>
              </button>
            </div>
          )}
          <div className="lg:flex lg:items-center lg:justify-center lg:py-1">
            <button
              onClick={() => toggleTheme()}
              aria-label={isDark ? t("mobile_nav.switch_to_light_mode") : t("mobile_nav.switch_to_dark_mode")}
              className="flex flex-col items-center gap-0.5 py-2 px-1 rounded-control text-ink-muted hover:text-ink hover:bg-surface-2 transition-colors duration-150 w-[calc(100%-8px)]"
            >
              {isDark ? <Sun className="w-[20px] h-[20px]" strokeWidth={1.8} /> : <Moon className="w-[20px] h-[20px]" strokeWidth={1.8} />}
              <span className="text-[10px] font-medium">{isDark ? t("mobile_nav.light") : t("recommendations.dark")}</span>
            </button>
          </div>
          {onSignIn && (
            <div className="lg:flex lg:items-center lg:justify-center lg:pb-2">
              <button
                onClick={onSignIn}
                aria-label={isSignedIn ? t("mobile_nav.account_synced") : t("settings_page.sign_in_to_sync")}
                className={`flex flex-col items-center gap-0.5 py-2 px-1 rounded-lg transition-colors duration-150 w-[calc(100%-8px)] ${
                  isSignedIn
                    ? "text-success-ink"
                    : "text-ink-muted hover:text-ink hover:bg-surface-2"
                }`}
              >
                {isSignedIn ? <User className="w-[20px] h-[20px]" strokeWidth={1.8} /> : <Cloud className="w-[20px] h-[20px]" strokeWidth={1.8} />}
                <span className="text-[10px] font-medium">{isSignedIn ? t("mobile_nav.synced") : t("settings_page.sync")}</span>
              </button>
            </div>
          )}
        </div>
        {/* No extra safe-area spacer here: paddingBottom on the nav itself
            (above) already reserves the home-indicator inset. A second spacer
            made the bar ~34px taller than the content spacer below expects. */}
      </motion.nav>

      {/* Spacer: bottom padding on mobile (desktop offset handled by CSS :has() rule) */}
      <div
        className="h-16 lg:hidden"
        style={{ height: "calc(64px + env(safe-area-inset-bottom, 0px))" }}
      />
    </>
  )
}
