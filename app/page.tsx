"use client"

import { useState, useEffect, useCallback, useRef } from "react"
import dynamic from "next/dynamic"
import { LoginScreen } from "@/components/login-screen"
import { Questionnaire } from "@/components/questionnaire"
import { SwipeInterface } from "@/components/swipe-interface"
import { Dashboard } from "@/components/dashboard"
import { GamificationProvider } from "@/components/gamification-provider"
import { AchievementsPanel } from "@/components/achievements-panel"
import { ToastProvider, useToast } from "@/components/toast-provider"
import { MobileNav } from "@/components/mobile-nav"
import { ErrorBoundary } from "@/components/error-boundary"
import { UserPreferences } from "@/lib/book-data"
import { getLikedBooks, migrateCoverUrls, isOnboarded, setOnboarded, getSavedPreferences, savePreferences } from "@/lib/storage"
import { TasteProfile } from "@/components/taste-profile"
import { InstallPrompt } from "@/components/install-prompt"
import { OnboardingGuide } from "@/components/onboarding-guide"
import { motion, AnimatePresence, MotionConfig } from "framer-motion"
import { getTheme, applyTheme } from "@/lib/theme"

// Code-split heavy components that aren't needed on initial load
const FreeBooksBrowser = dynamic(() => import("@/components/free-books-browser").then(m => ({ default: m.FreeBooksBrowser })), {
  loading: () => <div className="min-h-screen bg-background flex items-center justify-center"><div className="w-8 h-8 border-2 border-amber-600 border-t-transparent rounded-full animate-spin" /></div>,
})

const GUIDE_SEEN_KEY = "bookswipe_guide_seen"

type AppState = "login" | "dashboard" | "questionnaire" | "swipe" | "read"

// ---------------------------------------------------------------------------
// Hash routing helpers
// ---------------------------------------------------------------------------

type NavHash = "#/library" | "#/discover" | "#/read" | "#/profile" | "#/achievements" | "#/"

interface HashState {
  view: AppState
  showTasteProfile: boolean
  showAchievements: boolean
}

function hashToState(hash: string): HashState {
  switch (hash) {
    case "#/discover":
      return { view: "swipe", showTasteProfile: false, showAchievements: false }
    case "#/read":
      return { view: "read", showTasteProfile: false, showAchievements: false }
    case "#/profile":
      return { view: "dashboard", showTasteProfile: true, showAchievements: false }
    case "#/achievements":
      return { view: "dashboard", showTasteProfile: false, showAchievements: true }
    case "#/library":
    case "#/":
    default:
      return { view: "dashboard", showTasteProfile: false, showAchievements: false }
  }
}

function stateToHash(view: AppState, showTasteProfile: boolean, showAchievements: boolean): NavHash {
  if (showTasteProfile) return "#/profile"
  if (showAchievements) return "#/achievements"
  if (view === "swipe" || view === "questionnaire") return "#/discover"
  if (view === "read") return "#/read"
  return "#/library"
}

// ---------------------------------------------------------------------------

interface HomeProps {
  onShowAchievements: (show: boolean) => void
  isAchievementsOpen: boolean
}

function Home({ onShowAchievements, isAchievementsOpen }: HomeProps) {
  const [userPreferences, setUserPreferences] = useState<UserPreferences | null>(null)
  const [currentView, setCurrentView] = useState<AppState>("login")
  const [isLoggedIn, setIsLoggedIn] = useState(false)
  const [likedBooksCount, setLikedBooksCount] = useState(0)
  const [showTasteProfile, setShowTasteProfile] = useState(false)
  const [showGuide, setShowGuide] = useState(false)
  const [ready, setReady] = useState(false)
  const { showToast } = useToast()

  // Track whether we are currently applying a popstate so we don't re-push.
  const applyingPopstate = useRef(false)

  // ---------------------------------------------------------------------------
  // Core navigation primitive — updates hash + React state atomically.
  // Every navigation in the app must go through this so back/forward works.
  // ---------------------------------------------------------------------------
  const navigateTo = useCallback((
    view: AppState,
    opts: { tasteProfile?: boolean; achievements?: boolean } = {}
  ) => {
    const tasteProfile = opts.tasteProfile ?? false
    const achievements = opts.achievements ?? false
    const hash = stateToHash(view, tasteProfile, achievements)

    if (!applyingPopstate.current) {
      // Only push when not responding to a popstate (which already moved the pointer).
      history.pushState(null, "", hash)
    }

    setCurrentView(view)
    setShowTasteProfile(tasteProfile)
    onShowAchievements(achievements)
  }, [onShowAchievements])

  // ---------------------------------------------------------------------------
  // popstate — fires when the user hits back/forward
  // ---------------------------------------------------------------------------
  useEffect(() => {
    const onPopstate = () => {
      if (!isLoggedIn) return

      const resolved = hashToState(window.location.hash)

      // Guard against navigating back to a discover/swipe state without prefs.
      let view = resolved.view
      if (view === "swipe" && !userPreferences) view = "dashboard"

      applyingPopstate.current = true
      navigateTo(view, {
        tasteProfile: resolved.showTasteProfile,
        achievements: resolved.showAchievements,
      })
      applyingPopstate.current = false
    }

    window.addEventListener("popstate", onPopstate)
    return () => window.removeEventListener("popstate", onPopstate)
  }, [isLoggedIn, userPreferences, navigateTo])

  // ---------------------------------------------------------------------------
  // Listen for storage errors and show toast
  // ---------------------------------------------------------------------------
  useEffect(() => {
    const handler = (e: Event) => {
      const msg = (e as CustomEvent).detail?.error || "Storage error occurred"
      showToast(msg, "error")
    }
    window.addEventListener("bookswipe:storage-error", handler)
    return () => window.removeEventListener("bookswipe:storage-error", handler)
  }, [showToast])

  // ---------------------------------------------------------------------------
  // Session restore — runs once on mount
  // ---------------------------------------------------------------------------
  useEffect(() => {
    if (isOnboarded()) {
      setIsLoggedIn(true)
      const saved = getSavedPreferences()
      if (saved) setUserPreferences(saved)

      // Determine initial view: hash takes priority over defaults.
      const currentHash = window.location.hash
      if (currentHash && currentHash !== "#/") {
        const resolved = hashToState(currentHash)
        let view = resolved.view
        // Can't restore swipe without preferences
        if (view === "swipe" && !saved) view = "dashboard"
        // Apply state without pushing (URL is already correct)
        setCurrentView(view)
        setShowTasteProfile(resolved.showTasteProfile)
        onShowAchievements(resolved.showAchievements)
        // Normalise the hash in case it was something unrecognised
        history.replaceState(null, "", stateToHash(view, resolved.showTasteProfile, resolved.showAchievements))
      } else {
        // No meaningful hash — land on library and set canonical hash
        setCurrentView("dashboard")
        history.replaceState(null, "", "#/library")
      }

      try {
        if (!localStorage.getItem(GUIDE_SEEN_KEY)) setShowGuide(true)
      } catch { /* ignore */ }
    }
    setReady(true)
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  // ---------------------------------------------------------------------------
  // Liked books count
  // ---------------------------------------------------------------------------
  useEffect(() => {
    if (isLoggedIn) {
      setLikedBooksCount(getLikedBooks().length)

      const handleChange = (e: Event) => {
        setLikedBooksCount((e as CustomEvent).detail ?? getLikedBooks().length)
      }
      window.addEventListener("bookswipe:liked-changed", handleChange)
      return () => window.removeEventListener("bookswipe:liked-changed", handleChange)
    }
  }, [isLoggedIn, currentView])

  // ---------------------------------------------------------------------------
  // Handlers
  // ---------------------------------------------------------------------------

  const handleLogin = () => {
    setIsLoggedIn(true)
    setOnboarded()
    setShowGuide(true)
    navigateTo("dashboard")
  }

  const handleGuideComplete = () => {
    setShowGuide(false)
    try { localStorage.setItem(GUIDE_SEEN_KEY, "1") } catch { /* ignore */ }
  }

  const handleStartDiscovery = () => {
    navigateTo("questionnaire")
  }

  const handleQuestionnaireComplete = (preferences: UserPreferences) => {
    setUserPreferences(preferences)
    savePreferences(preferences)
    navigateTo("swipe")
  }

  const handleRestart = () => {
    setUserPreferences(null)
    navigateTo("questionnaire")
  }

  const handleViewLibrary = () => {
    navigateTo("dashboard")
  }

  const handleBackToSwipe = () => {
    if (!userPreferences) {
      navigateTo("questionnaire")
      return
    }
    navigateTo("swipe")
  }

  const handleMobileNavigation = (view: "dashboard" | "swipe" | "read" | "achievements" | "profile") => {
    if (view === "profile") {
      navigateTo("dashboard", { tasteProfile: true, achievements: false })
    } else if (view === "achievements") {
      navigateTo("dashboard", { tasteProfile: false, achievements: true })
    } else if (view === "swipe") {
      if (!userPreferences) {
        navigateTo("questionnaire")
      } else {
        navigateTo("swipe")
      }
    } else if (view === "read") {
      navigateTo("read")
    } else {
      navigateTo("dashboard")
    }
  }

  // Close overlays using popstate so the back button collapses them correctly.
  const handleCloseTasteProfile = () => {
    // If the profile was opened on top of a view, go back in history.
    if (window.history.length > 1) {
      history.back()
    } else {
      navigateTo("dashboard")
    }
  }

  const handleCloseAchievements = () => {
    if (window.history.length > 1) {
      history.back()
    } else {
      navigateTo("dashboard")
    }
  }

  const getCurrentNavView = (): "dashboard" | "swipe" | "read" | "achievements" | "profile" => {
    if (showTasteProfile) return "profile"
    if (isAchievementsOpen) return "achievements"
    if (currentView === "swipe") return "swipe"
    if (currentView === "read") return "read"
    return "dashboard"
  }

  const showNav = isLoggedIn && currentView !== "questionnaire"

  // Prevent flash of login screen while checking localStorage
  if (!ready) {
    return <div className="min-h-screen bg-background" />
  }

  return (
    <>
      <AnimatePresence mode="wait">
        {!isLoggedIn ? (
          <motion.div
            key="login"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0, transition: { duration: 0.1 } }}
            transition={{ duration: 0.25, ease: [0.4, 0, 0.2, 1] }}
          >
            <LoginScreen onLogin={handleLogin} />
          </motion.div>
        ) : currentView === "questionnaire" ? (
          <motion.div
            key="questionnaire"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0, transition: { duration: 0.1 } }}
            transition={{ duration: 0.25, ease: [0.4, 0, 0.2, 1] }}
          >
            <Questionnaire onComplete={handleQuestionnaireComplete} onBack={() => navigateTo("dashboard")} />
          </motion.div>
        ) : currentView === "swipe" && userPreferences ? (
          <motion.div
            key="swipe"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0, transition: { duration: 0.1 } }}
            transition={{ duration: 0.2, ease: [0.4, 0, 0.2, 1] }}
          >
            <SwipeInterface
              preferences={userPreferences}
              onRestart={handleRestart}
              onViewLibrary={handleViewLibrary}
            />
          </motion.div>
        ) : currentView === "read" ? (
          <motion.div
            key="read"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0, transition: { duration: 0.1 } }}
            transition={{ duration: 0.2, ease: [0.4, 0, 0.2, 1] }}
          >
            <FreeBooksBrowser />
          </motion.div>
        ) : (
          <motion.div
            key="dashboard"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0, transition: { duration: 0.1 } }}
            transition={{ duration: 0.2, ease: [0.4, 0, 0.2, 1] }}
          >
            <Dashboard
              onBack={currentView === "dashboard" && userPreferences ? handleBackToSwipe : undefined}
              onStartDiscovery={handleStartDiscovery}
              showBackButton={currentView === "dashboard" && userPreferences !== null}
            />
          </motion.div>
        )}
      </AnimatePresence>

      {/* Onboarding Guide */}
      <AnimatePresence>
        {showGuide && <OnboardingGuide onComplete={handleGuideComplete} />}
      </AnimatePresence>

      {/* Taste Profile Panel */}
      <TasteProfile
        isOpen={showTasteProfile}
        onClose={handleCloseTasteProfile}
      />

      {/* Mobile Bottom Navigation - persists across dashboard/swipe transitions */}
      {showNav && (
        <MobileNav
          currentView={getCurrentNavView()}
          onNavigate={handleMobileNavigation}
          likedCount={likedBooksCount}
        />
      )}
    </>
  )
}

// Main app component with gamification wrapper
export default function App() {
  const [showAchievements, setShowAchievements] = useState(false)

  // Apply theme + one-time migration on mount
  useEffect(() => {
    applyTheme(getTheme())
    migrateCoverUrls()
  }, [])

  // Register service worker for offline support + force update stale caches
  useEffect(() => {
    if (!("serviceWorker" in navigator)) return

    let refreshing = false
    const onControllerChange = () => {
      if (!refreshing) {
        refreshing = true
        window.location.reload()
      }
    }

    navigator.serviceWorker.register("/sw.js").then((reg) => {
      reg.update().catch(() => {})
      if (reg.waiting) {
        reg.waiting.postMessage({ type: "SKIP_WAITING" })
      }
      reg.addEventListener("updatefound", () => {
        const newWorker = reg.installing
        if (!newWorker) return
        newWorker.addEventListener("statechange", () => {
          if (newWorker.state === "activated" && navigator.serviceWorker.controller) {
            window.location.reload()
          }
        })
      })
    }).catch(() => {})

    navigator.serviceWorker.addEventListener("controllerchange", onControllerChange)
    return () => {
      navigator.serviceWorker.removeEventListener("controllerchange", onControllerChange)
    }
  }, [])

  const handleCloseAchievements = () => {
    if (window.history.length > 1) {
      history.back()
    } else {
      setShowAchievements(false)
    }
  }

  return (
    <MotionConfig reducedMotion="user">
      <ToastProvider>
        <GamificationProvider onShowAchievements={() => setShowAchievements(true)}>
          <ErrorBoundary>
            <Home
              onShowAchievements={setShowAchievements}
              isAchievementsOpen={showAchievements}
            />
          </ErrorBoundary>
          <AchievementsPanel
            isOpen={showAchievements}
            onClose={handleCloseAchievements}
          />
          <InstallPrompt />
        </GamificationProvider>
      </ToastProvider>
    </MotionConfig>
  )
}
