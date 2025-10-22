"use client"

import { createContext, useContext, useState, useCallback, ReactNode } from "react"
import { GamificationEvent, handleUserActivity } from "@/lib/gamification"
import { GamificationToast } from "./gamification-toast"
import { ConfettiCelebration, FireworksCelebration } from "./confetti-celebration"

interface GamificationContextType {
  triggerActivity: (activity: string, data?: any) => void
  showAchievementsPanel: () => void
}

const GamificationContext = createContext<GamificationContextType | null>(null)

export function useGamification() {
  const context = useContext(GamificationContext)
  if (!context) {
    throw new Error('useGamification must be used within a GamificationProvider')
  }
  return context
}

interface GamificationProviderProps {
  children: ReactNode
  onShowAchievements?: () => void
}

export function GamificationProvider({ children, onShowAchievements }: GamificationProviderProps) {
  const [events, setEvents] = useState<GamificationEvent[]>([])
  const [showConfetti, setShowConfetti] = useState(false)
  const [showFireworks, setShowFireworks] = useState(false)

  const triggerActivity = useCallback((activity: string, data?: any) => {
    try {
      const rawEvents = handleUserActivity(activity, data)
      
      // Only show meaningful events (achievements, level-ups)
      // Filter out routine points_earned events to reduce clutter
      const significantEvents = rawEvents.filter(e => 
        e.type === 'achievement_unlocked' || e.type === 'level_up'
      )
      
      if (significantEvents.length > 0) {
        setEvents(significantEvents)
        
        // Check for special celebrations
        const hasAchievement = significantEvents.some(e => e.type === 'achievement_unlocked')
        const hasLevelUp = significantEvents.some(e => e.type === 'level_up')
        
        if (hasAchievement && hasLevelUp) {
          // Both achievement and level up - fireworks!
          setShowFireworks(true)
        } else if (hasAchievement || hasLevelUp) {
          // Just achievement or level up - confetti
          setShowConfetti(true)
        }
      }
    } catch (error) {
      console.error('Error handling gamification activity:', error)
    }
  }, [])

  const showAchievementsPanel = useCallback(() => {
    onShowAchievements?.()
  }, [onShowAchievements])

  const handleEventShown = useCallback((event: GamificationEvent) => {
    setEvents(prev => prev.filter(e => e !== event))
    // Refresh achievements/stats so the panel shows latest progress
    try {
      // Re-run a passive check to update progress (no new activity)
      const updated = handleUserActivity('daily_reading')
      if (updated.length === 0) {
        // noop, just ensures streak/lastActivity updated
      }
    } catch {}
  }, [])

  const handleConfettiComplete = useCallback(() => {
    setShowConfetti(false)
  }, [])

  const handleFireworksComplete = useCallback(() => {
    setShowFireworks(false)
  }, [])

  return (
    <GamificationContext.Provider value={{ triggerActivity, showAchievementsPanel }}>
      {children}
      
      {/* Toast notifications */}
      <GamificationToast 
        events={events} 
        onEventShown={handleEventShown}
        onOpenAchievements={onShowAchievements}
      />
      
      {/* Celebrations */}
      <ConfettiCelebration 
        isActive={showConfetti}
        onComplete={handleConfettiComplete}
      />
      
      <FireworksCelebration 
        isActive={showFireworks}
        onComplete={handleFireworksComplete}
      />
    </GamificationContext.Provider>
  )
}

