"use client"

import { useEffect, useState, useRef } from "react"
import { motion, AnimatePresence } from "framer-motion"
import { Trophy, Star, Zap, Award } from "lucide-react"
import { GamificationEvent } from "@/lib/gamification"

interface GamificationToastProps {
  events: GamificationEvent[]
  onEventShown?: (event: GamificationEvent) => void
  onOpenAchievements?: () => void
}

export function GamificationToast({ events, onEventShown, onOpenAchievements }: GamificationToastProps) {
  const [currentEvent, setCurrentEvent] = useState<GamificationEvent | null>(null)
  const [eventQueue, setEventQueue] = useState<GamificationEvent[]>([])
  const seenEventsRef = useRef(new WeakSet<GamificationEvent>())

  useEffect(() => {
    if (events.length > 0) {
      // Deduplicate: only queue events we haven't seen before
      const newEvents = events.filter(e => !seenEventsRef.current.has(e))
      if (newEvents.length > 0) {
        newEvents.forEach(e => seenEventsRef.current.add(e))
        setEventQueue(prev => [...prev, ...newEvents])
      }
    }
  }, [events])

  // Dequeue next event when idle
  useEffect(() => {
    if (!currentEvent && eventQueue.length > 0) {
      const nextEvent = eventQueue[0]
      setCurrentEvent(nextEvent)
      setEventQueue(prev => prev.slice(1))
    }
  }, [currentEvent, eventQueue])

  // Auto-dismiss the current event after a short delay
  useEffect(() => {
    if (!currentEvent) return
    const timer = setTimeout(() => {
      onEventShown?.(currentEvent)
      setCurrentEvent(null)
    }, getEventDuration(currentEvent))
    return () => clearTimeout(timer)
  }, [currentEvent, onEventShown])

  if (!currentEvent) return null

  return (
    <AnimatePresence>
      <motion.div
        initial={{ opacity: 0, y: -100, scale: 0.8 }}
        animate={{ opacity: 1, y: 0, scale: 1 }}
        exit={{ opacity: 0, y: -100, scale: 0.8 }}
        className="fixed top-4 left-4 z-[100] w-[calc(100%-2rem)] max-w-[400px]"
      >
        <div
          onClick={() => {
            if (currentEvent?.type === 'achievement_unlocked') {
              onOpenAchievements?.()
              setCurrentEvent(null)
            }
          }}
          className={`
          ${getEventStyle(currentEvent.type)}
          rounded-2xl shadow-2xl border-2 p-4 w-full
          backdrop-blur-xl cursor-pointer
        `}
        >
          <div className="flex items-center gap-3">
            <div className={`
              ${getIconStyle(currentEvent.type)}
              w-12 h-12 rounded-full flex items-center justify-center
            `}>
              {getEventIcon(currentEvent.type)}
            </div>
            
            <div className="flex-1">
              <h3 className="font-bold text-white text-lg leading-tight">
                {currentEvent.title}
              </h3>
              <p className="text-white/90 text-sm">
                {currentEvent.description}
              </p>
              
              {currentEvent.type === 'achievement_unlocked' && currentEvent.achievement && (
                <div className="mt-2 flex items-center gap-2">
                  <span className={`
                    px-2 py-1 rounded-full text-xs font-medium
                    ${getAchievementTypeStyle(currentEvent.achievement.type)}
                  `}>
                    {currentEvent.achievement.type.toUpperCase()}
                  </span>
                  <span className="text-white/80 text-xs">
                    {currentEvent.achievement.category}
                  </span>
                </div>
              )}
            </div>
          </div>
          
          {/* Progress bar for timed display */}
          <motion.div
            className="absolute bottom-0 left-0 h-1 bg-white/30 rounded-full"
            initial={{ width: "100%" }}
            animate={{ width: "0%" }}
            transition={{ 
              duration: getEventDuration(currentEvent) / 1000,
              ease: "linear"
            }}
          />
        </div>
      </motion.div>
    </AnimatePresence>
  )
}

function getEventDuration(event: GamificationEvent): number {
  switch (event.type) {
    case 'achievement_unlocked':
      return 2500 // ~2.5 seconds for achievements
    case 'level_up':
      return 2300 // ~2.3 seconds for level ups
    case 'points_earned':
      return 2000 // 2 seconds for points
    default:
      return 2500
  }
}

function getEventStyle(type: string): string {
  switch (type) {
    case 'achievement_unlocked':
      return 'bg-gradient-to-r from-amber-500 to-orange-500 border-amber-300'
    case 'level_up':
      return 'bg-gradient-to-r from-stone-700 to-stone-900 border-stone-500'
    case 'points_earned':
      return 'bg-gradient-to-r from-emerald-500 to-teal-600 border-emerald-300'
    default:
      return 'bg-gradient-to-r from-stone-600 to-stone-800 border-stone-400'
  }
}

function getIconStyle(type: string): string {
  switch (type) {
    case 'achievement_unlocked':
      return 'bg-white/20'
    case 'level_up':
      return 'bg-white/20'
    case 'points_earned':
      return 'bg-white/20'
    default:
      return 'bg-white/20'
  }
}

function getEventIcon(type: string) {
  switch (type) {
    case 'achievement_unlocked':
      return <Trophy className="w-6 h-6 text-white" />
    case 'level_up':
      return <Award className="w-6 h-6 text-white" />
    case 'points_earned':
      return <Star className="w-6 h-6 text-white" />
    default:
      return <Zap className="w-6 h-6 text-white" />
  }
}

function getAchievementTypeStyle(type: string): string {
  switch (type) {
    case 'bronze':
      return 'bg-amber-600 text-white'
    case 'silver':
      return 'bg-stone-400 text-white'
    case 'gold':
      return 'bg-yellow-500 text-white'
    case 'platinum':
      return 'bg-stone-800 text-white'
    default:
      return 'bg-stone-500 text-white'
  }
}

