"use client"

import { useState, useEffect } from "react"
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
import { motion, AnimatePresence } from "framer-motion"
import { getTheme, applyTheme } from "@/lib/theme"

// Code-split heavy components that aren't needed on initial load
const FreeBooksBrowser = dynamic(() => import("@/components/free-books-browser").then(m => ({ default: m.FreeBooksBrowser })), {
  loading: () => <div className="min-h-screen bg-background flex items-center justify-center"><div className="w-8 h-8 border-2 border-amber-600 border-t-transparent rounded-full animate-spin" /></div>,
})

const GUIDE_SEEN_KEY = "bookswipe_guide_seen"
const LAST_VIEW_KEY = "bookswipe_last_view"

type AppState = "login" | "dashboard" | "questionnaire" | "swipe" | "read"

const RESTORABLE_VIEWS: AppState[] = ["dashboard", "swipe", "read"]

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

  // Persist the current view so reload returns to the same tab
  useEffect(() => {
    if (isLoggedIn && RESTORABLE_VIEWS.includes(currentView)) {
      try { localStorage.setItem(LAST_VIEW_KEY, currentView) } catch { /* ignore */ }
    }
  }, [currentView, isLoggedIn])

  // Listen for storage errors (quota exceeded, rate limits) and show toast
  useEffect(() => {
    const handler = (e: Event) => {
      const msg = (e as CustomEvent).detail?.error || 'Storage error occurred'
      showToast(msg, 'error')
    }
    window.addEventListener('bookswipe:storage-error', handler)
    return () => window.removeEventListener('bookswipe:storage-error', handler)
  }, [showToast])

  // Restore session for returning users (runs before first paint matters)
  useEffect(() => {
    if (isOnboarded()) {
      setIsLoggedIn(true)
      const saved = getSavedPreferences()
      if (saved) setUserPreferences(saved)
      // Restore last active view
      try {
        const lastView = localStorage.getItem(LAST_VIEW_KEY) as AppState | null
        if (lastView && RESTORABLE_VIEWS.includes(lastView)) {
          // Only restore swipe if user has preferences set
          if (lastView === "swipe" && !saved) {
            setCurrentView("dashboard")
          } else {
            setCurrentView(lastView)
          }
        } else {
          setCurrentView("dashboard")
        }
      } catch {
        setCurrentView("dashboard")
      }
      // Show guide if not yet seen
      try {
        if (!localStorage.getItem(GUIDE_SEEN_KEY)) setShowGuide(true)
      } catch { /* ignore */ }
    }
    setReady(true)
  }, [])

  // Update liked books count via custom event (no polling)
  useEffect(() => {
    if (isLoggedIn) {
      setLikedBooksCount(getLikedBooks().length)

      const handleChange = (e: Event) => {
        setLikedBooksCount((e as CustomEvent).detail ?? getLikedBooks().length)
      }
      window.addEventListener('bookswipe:liked-changed', handleChange)
      return () => window.removeEventListener('bookswipe:liked-changed', handleChange)
    }
  }, [isLoggedIn, currentView])

  const handleLogin = () => {
    setIsLoggedIn(true)
    setCurrentView("dashboard")
    setOnboarded()
    setShowGuide(true)
  }

  const handleGuideComplete = () => {
    setShowGuide(false)
    try { localStorage.setItem(GUIDE_SEEN_KEY, "1") } catch { /* ignore */ }
  }

  const handleStartDiscovery = () => {
    setCurrentView("questionnaire")
  }

  const handleQuestionnaireComplete = (preferences: UserPreferences) => {
    setUserPreferences(preferences)
    savePreferences(preferences)
    setCurrentView("swipe")
  }

  const handleRestart = () => {
    setUserPreferences(null)
    setCurrentView("questionnaire")
  }

  const handleViewLibrary = () => {
    setCurrentView("dashboard")
  }

  const handleBackToSwipe = () => {
    if (!userPreferences) {
      setCurrentView("questionnaire")
      return
    }
    setCurrentView("swipe")
  }

  const handleMobileNavigation = (view: "dashboard" | "swipe" | "read" | "achievements" | "profile") => {
    if (view === "profile") {
      onShowAchievements(false)
      setShowTasteProfile(true)
      setCurrentView("dashboard")
    } else if (view === "achievements") {
      setShowTasteProfile(false)
      onShowAchievements(true)
      setCurrentView("dashboard")
    } else if (view === "swipe") {
      setShowTasteProfile(false)
      onShowAchievements(false)
      if (!userPreferences) {
        setCurrentView("questionnaire")
      } else {
        setCurrentView("swipe")
      }
    } else if (view === "read") {
      setShowTasteProfile(false)
      onShowAchievements(false)
      setCurrentView("read")
    } else {
      setShowTasteProfile(false)
      onShowAchievements(false)
      setCurrentView("dashboard")
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
            <Questionnaire onComplete={handleQuestionnaireComplete} onBack={() => setCurrentView("dashboard")} />
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
        onClose={() => setShowTasteProfile(false)}
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
    if (!('serviceWorker' in navigator)) return

    let refreshing = false
    const onControllerChange = () => {
      if (!refreshing) {
        refreshing = true
        window.location.reload()
      }
    }

    navigator.serviceWorker.register('/sw.js').then((reg) => {
      reg.update().catch(() => {})
      if (reg.waiting) {
        reg.waiting.postMessage({ type: 'SKIP_WAITING' })
      }
      reg.addEventListener('updatefound', () => {
        const newWorker = reg.installing
        if (!newWorker) return
        newWorker.addEventListener('statechange', () => {
          if (newWorker.state === 'activated' && navigator.serviceWorker.controller) {
            window.location.reload()
          }
        })
      })
    }).catch(() => {})

    navigator.serviceWorker.addEventListener('controllerchange', onControllerChange)
    return () => {
      navigator.serviceWorker.removeEventListener('controllerchange', onControllerChange)
    }
  }, [])

  return (
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
          onClose={() => setShowAchievements(false)}
        />
        <InstallPrompt />
      </GamificationProvider>
    </ToastProvider>
  )
}
