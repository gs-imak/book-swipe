"use client"

import { useState, useEffect } from "react"
import { LoginScreen } from "@/components/login-screen"
import { Questionnaire } from "@/components/questionnaire"
import { SwipeInterface } from "@/components/swipe-interface"
import { Dashboard } from "@/components/dashboard"
import { GamificationProvider } from "@/components/gamification-provider"
import { AchievementsPanel } from "@/components/achievements-panel"
import { ToastProvider } from "@/components/toast-provider"
import { MobileNav } from "@/components/mobile-nav"
import { UserPreferences } from "@/lib/book-data"
import { getLikedBooks, migrateCoverUrls, isOnboarded, setOnboarded, getSavedPreferences, savePreferences } from "@/lib/storage"
import { TasteProfile } from "@/components/taste-profile"
import { InstallPrompt } from "@/components/install-prompt"
import { motion, AnimatePresence } from "framer-motion"

type AppState = "login" | "dashboard" | "questionnaire" | "swipe"

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

  // Restore session for returning users
  useEffect(() => {
    if (isOnboarded()) {
      setIsLoggedIn(true)
      setCurrentView("dashboard")
      const saved = getSavedPreferences()
      if (saved) setUserPreferences(saved)
    }
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

  const handleMobileNavigation = (view: "dashboard" | "swipe" | "achievements" | "profile") => {
    if (view === "profile") {
      onShowAchievements(false)
      setShowTasteProfile(true)
    } else if (view === "achievements") {
      setShowTasteProfile(false)
      onShowAchievements(true)
    } else if (view === "swipe") {
      setShowTasteProfile(false)
      onShowAchievements(false)
      if (!userPreferences) {
        setCurrentView("questionnaire")
      } else {
        setCurrentView("swipe")
      }
    } else {
      setShowTasteProfile(false)
      onShowAchievements(false)
      setCurrentView("dashboard")
    }
  }

  const getCurrentNavView = (): "dashboard" | "swipe" | "achievements" | "profile" => {
    if (showTasteProfile) return "profile"
    if (isAchievementsOpen) return "achievements"
    if (currentView === "swipe") return "swipe"
    return "dashboard"
  }

  const showNav = isLoggedIn && currentView !== "questionnaire"

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

  // One-time migration: fix cached cover URLs
  useEffect(() => {
    migrateCoverUrls()
  }, [])

  // Register service worker for offline support
  useEffect(() => {
    if ('serviceWorker' in navigator) {
      navigator.serviceWorker.register('/sw.js').catch(() => {
        // SW registration failed — app works fine without it
      })
    }
  }, [])

  return (
    <ToastProvider>
      <GamificationProvider onShowAchievements={() => setShowAchievements(true)}>
        <Home
          onShowAchievements={setShowAchievements}
          isAchievementsOpen={showAchievements}
        />
        <AchievementsPanel
          isOpen={showAchievements}
          onClose={() => setShowAchievements(false)}
        />
        <InstallPrompt />
      </GamificationProvider>
    </ToastProvider>
  )
}
