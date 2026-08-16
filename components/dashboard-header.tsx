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
    <div className="bg-[rgba(250,247,241,.92)] dark:bg-[rgba(20,17,16,.92)] backdrop-blur-md border-b border-border sticky top-0 z-10">
      <div className="max-w-6xl mx-auto px-4 sm:px-6 py-3 sm:py-4">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3 min-w-0">
            {showBackButton && onBack && (
              <button
                onClick={onBack}
                aria-label="Go back"
                className="p-2 -ml-2 rounded-control text-ink-muted hover:text-ink hover:bg-surface-2 transition-colors tap-target touch-manipulation"
              >
                <ArrowLeft className="w-5 h-5" strokeWidth={1.8} />
              </button>
            )}
            <div className="min-w-0">
              <h1 className="text-xl sm:text-2xl font-semibold text-ink tracking-tight font-serif">
                My Library
              </h1>
            </div>
          </div>
          <div className="flex items-center gap-1 sm:gap-2">
            <button
              onClick={onSearch}
              aria-label="Search books"
              className="flex items-center justify-center p-2 rounded-control text-ink-muted hover:text-ink hover:bg-surface-2 transition-colors tap-target touch-manipulation"
            >
              <Search className="w-5 h-5" strokeWidth={1.8} />
            </button>
            {onScan && (
              <button
                onClick={onScan}
                aria-label="Scan a book barcode"
                className="flex items-center justify-center p-2 rounded-control text-ink-muted hover:text-ink hover:bg-surface-2 transition-colors tap-target touch-manipulation"
              >
                <Camera className="w-5 h-5" strokeWidth={1.8} />
              </button>
            )}
            <button
              onClick={onChallenges}
              aria-label="Reading challenges"
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-full border border-border-strong text-ink text-sm font-medium hover:bg-surface-2 transition-colors tap-target touch-manipulation"
            >
              <Target className="w-4 h-4" />
              <span className="hidden sm:inline">Challenges</span>
            </button>
            <button
              onClick={onAchievements}
              aria-label="Achievements"
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-full border border-border-strong text-ink text-sm font-medium hover:bg-surface-2 transition-colors tap-target touch-manipulation tabular-nums"
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
