"use client"

import { useState, useEffect } from "react"
import { LoginScreen } from "@/components/login-screen"
import { Questionnaire } from "@/components/questionnaire"
import { SwipeInterface } from "@/components/swipe-interface"
import { Dashboard } from "@/components/dashboard"
import { GamificationProvider } from "@/components/gamification-provider"
import { AchievementsPanel } from "@/components/achievements-panel"
import { MobileNav } from "@/components/mobile-nav"
import { UserPreferences } from "@/lib/book-data"
import { getLikedBooks } from "@/lib/storage"

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

  // Update liked books count
  useEffect(() => {
    if (isLoggedIn) {
      const updateCount = () => {
        const books = getLikedBooks()
        setLikedBooksCount(books.length)
      }
      updateCount()
      
      // Poll for updates every 2 seconds when user is active
      const interval = setInterval(updateCount, 2000)
      return () => clearInterval(interval)
    }
  }, [isLoggedIn, currentView])

  const handleLogin = () => {
    setIsLoggedIn(true)
    setCurrentView("dashboard")
  }

  const handleStartDiscovery = () => {
    setCurrentView("questionnaire")
  }

  const handleQuestionnaireComplete = (preferences: UserPreferences) => {
    setUserPreferences(preferences)
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

  const handleMobileNavigation = (view: "dashboard" | "swipe" | "achievements") => {
    if (view === "achievements") {
      onShowAchievements(true)
    } else if (view === "swipe") {
      onShowAchievements(false)
      if (!userPreferences) {
        setCurrentView("questionnaire")
      } else {
        setCurrentView("swipe")
      }
    } else {
      onShowAchievements(false)
      setCurrentView("dashboard")
    }
  }

  const getCurrentNavView = (): "dashboard" | "swipe" | "achievements" => {
    if (isAchievementsOpen) return "achievements"
    if (currentView === "swipe") return "swipe"
    return "dashboard"
  }

  // If not logged in, show login screen
  if (!isLoggedIn) {
    return <LoginScreen onLogin={handleLogin} />
  }

  // Questionnaire has no mobile nav
  if (currentView === "questionnaire") {
    return <Questionnaire onComplete={handleQuestionnaireComplete} />
  }

  return (
    <div className="pb-safe">
      {currentView === "swipe" && userPreferences ? (
        <SwipeInterface 
          preferences={userPreferences} 
          onRestart={handleRestart}
          onViewLibrary={handleViewLibrary}
        />
      ) : (
        <Dashboard 
          onBack={currentView === "dashboard" && userPreferences ? handleBackToSwipe : undefined}
          onStartDiscovery={handleStartDiscovery}
          showBackButton={currentView === "dashboard" && userPreferences !== null}
        />
      )}

      {/* Mobile Bottom Navigation - only show when not in questionnaire */}
      <MobileNav
        currentView={getCurrentNavView()}
        onNavigate={handleMobileNavigation}
        likedCount={likedBooksCount}
      />
    </div>
  )
}

// Main app component with gamification wrapper
export default function App() {
  const [showAchievements, setShowAchievements] = useState(false)
  
  return (
    <GamificationProvider onShowAchievements={() => setShowAchievements(true)}>
      <Home 
        onShowAchievements={setShowAchievements}
        isAchievementsOpen={showAchievements}
      />
      <AchievementsPanel
        isOpen={showAchievements}
        onClose={() => setShowAchievements(false)}
      />
    </GamificationProvider>
  )
}
