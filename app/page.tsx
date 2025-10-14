"use client"

import { useState } from "react"
import { LoginScreen } from "@/components/login-screen"
import { Questionnaire } from "@/components/questionnaire"
import { SwipeInterface } from "@/components/swipe-interface"
import { Dashboard } from "@/components/dashboard"
import { GamificationProvider } from "@/components/gamification-provider"
import { AchievementsPanel } from "@/components/achievements-panel"
import { UserPreferences } from "@/lib/book-data"

type AppState = "login" | "dashboard" | "questionnaire" | "swipe"

function Home() {
  const [userPreferences, setUserPreferences] = useState<UserPreferences | null>(null)
  const [currentView, setCurrentView] = useState<AppState>("login")
  const [isLoggedIn, setIsLoggedIn] = useState(false)

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

  // If not logged in, show login screen
  if (!isLoggedIn) {
    return <LoginScreen onLogin={handleLogin} />
  }

  switch (currentView) {
    case "questionnaire":
      return <Questionnaire onComplete={handleQuestionnaireComplete} />
    case "swipe":
      if (!userPreferences) {
        setCurrentView("questionnaire")
        return <Questionnaire onComplete={handleQuestionnaireComplete} />
      }
      return (
        <SwipeInterface 
          preferences={userPreferences} 
          onRestart={handleRestart}
          onViewLibrary={handleViewLibrary}
        />
      )
    case "dashboard":
    default:
      return (
        <Dashboard 
          onBack={currentView === "dashboard" && userPreferences ? handleBackToSwipe : undefined}
          onStartDiscovery={handleStartDiscovery}
          showBackButton={currentView === "dashboard" && userPreferences !== null}
        />
      )
  }
}

// Main app component with gamification wrapper
export default function App() {
  const [showAchievements, setShowAchievements] = useState(false)
  
  return (
    <GamificationProvider onShowAchievements={() => setShowAchievements(true)}>
      <Home />
      <AchievementsPanel
        isOpen={showAchievements}
        onClose={() => setShowAchievements(false)}
      />
    </GamificationProvider>
  )
}
