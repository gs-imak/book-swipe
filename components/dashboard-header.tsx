"use client"

import { ArrowLeft, Search, Camera, Target, Trophy } from "lucide-react"

interface DashboardHeaderProps {
  showBackButton: boolean
  onBack?: () => void
  onScan?: () => void
  level: number
  onSearch: () => void
  onChallenges: () => void
  onAchievements: () => void
}

/** Sticky "My Library" header bar (extracted from Dashboard — presentational). */
export function DashboardHeader({
  showBackButton,
  onBack,
  onScan,
  level,
  onSearch,
  onChallenges,
  onAchievements,
}: DashboardHeaderProps) {
  return (
    <div className="bg-background/90 backdrop-blur-md border-b border-stone-200/60 dark:border-stone-700/60 sticky top-0 z-10">
      <div className="max-w-6xl mx-auto px-4 sm:px-6 py-3 sm:py-4">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3 min-w-0">
            {showBackButton && onBack && (
              <button
                onClick={onBack}
                aria-label="Go back"
                className="p-2 -ml-2 rounded-lg hover:bg-stone-100 dark:hover:bg-stone-800 transition-colors tap-target touch-manipulation"
              >
                <ArrowLeft className="w-5 h-5 text-stone-600 dark:text-stone-300" />
              </button>
            )}
            <div className="min-w-0">
              <h1 className="text-xl sm:text-2xl font-bold text-stone-900 dark:text-stone-100 tracking-tight font-serif">
                My Library
              </h1>
            </div>
          </div>
          <div className="flex items-center gap-1 sm:gap-2">
            <button
              onClick={onSearch}
              aria-label="Search books"
              className="flex items-center justify-center p-2 rounded-lg hover:bg-stone-100 dark:hover:bg-stone-800 transition-colors tap-target touch-manipulation"
            >
              <Search className="w-5 h-5 text-stone-500 dark:text-stone-400" />
            </button>
            {onScan && (
              <button
                onClick={onScan}
                aria-label="Scan a book barcode"
                className="flex items-center justify-center p-2 rounded-lg hover:bg-stone-100 dark:hover:bg-stone-800 transition-colors tap-target touch-manipulation"
              >
                <Camera className="w-5 h-5 text-amber-600 dark:text-amber-500" />
              </button>
            )}
            <button
              onClick={onChallenges}
              aria-label="Reading challenges"
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-full bg-stone-100 dark:bg-stone-800 hover:bg-stone-200 dark:hover:bg-stone-700 text-stone-600 dark:text-stone-300 text-sm font-medium transition-colors tap-target touch-manipulation"
            >
              <Target className="w-4 h-4" />
              <span className="hidden sm:inline">Challenges</span>
            </button>
            <button
              onClick={onAchievements}
              aria-label="Achievements"
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-full bg-amber-50 dark:bg-amber-900/30 hover:bg-amber-100 dark:hover:bg-amber-900/50 text-amber-700 dark:text-amber-400 text-sm font-medium transition-colors tap-target touch-manipulation"
            >
              <Trophy className="w-4 h-4" />
              <span className="hidden sm:inline">Lv.{level}</span>
              <span className="sm:hidden">{level}</span>
            </button>
          </div>
        </div>
      </div>
    </div>
  )
}
