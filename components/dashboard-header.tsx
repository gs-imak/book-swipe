"use client"

import { ArrowLeft, Search, Camera, Target, Trophy } from "lucide-react"
import { t } from "@/lib/i18n"

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
                aria-label={t("common.go_back")}
                className="p-2 -ml-2 rounded-control text-ink-muted hover:text-ink hover:bg-surface-2 transition-colors tap-target touch-manipulation"
              >
                <ArrowLeft className="w-5 h-5" strokeWidth={1.8} />
              </button>
            )}
            <div className="min-w-0">
              {/* truncate, and a step smaller on phones: the header row gives the
                  title only what four fixed-width controls leave behind, and a
                  12-character word ("Bibliothèque") was being cut mid-glyph at
                  360px with no ellipsis to say so. English never showed it. */}
              <h1 className="text-lg sm:text-2xl font-semibold text-ink tracking-tight font-serif truncate"> {t("dashboard_header.my_library")} </h1>
            </div>
          </div>
          <div className="flex items-center gap-1 sm:gap-2">
            <button
              onClick={onSearch}
              aria-label={t("dashboard_header.search_books")}
              className="flex items-center justify-center p-2 rounded-control text-ink-muted hover:text-ink hover:bg-surface-2 transition-colors tap-target touch-manipulation"
            >
              <Search className="w-5 h-5" strokeWidth={1.8} />
            </button>
            {onScan && (
              <button
                onClick={onScan}
                aria-label={t("dashboard_header.scan_a_book_barcode")}
                className="flex items-center justify-center p-2 rounded-control text-ink-muted hover:text-ink hover:bg-surface-2 transition-colors tap-target touch-manipulation"
              >
                <Camera className="w-5 h-5" strokeWidth={1.8} />
              </button>
            )}
            <button
              onClick={onChallenges}
              aria-label={t("dashboard_header.reading_challenges")}
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-full border border-border-strong text-ink text-sm font-medium hover:bg-surface-2 transition-colors tap-target touch-manipulation"
            >
              <Target className="w-4 h-4" />
              <span className="hidden sm:inline">{t("dashboard_header.challenges")}</span>
            </button>
            <button
              onClick={onAchievements}
              aria-label={t("dashboard_header.achievements")}
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-full border border-border-strong text-ink text-sm font-medium hover:bg-surface-2 transition-colors tap-target touch-manipulation tabular-nums"
            >
              <Trophy className="w-4 h-4" />
              <span className="hidden sm:inline">{t("dashboard_header.lv")}{level}</span>
              <span className="sm:hidden">{level}</span>
            </button>
          </div>
        </div>
      </div>
    </div>
  )
}
