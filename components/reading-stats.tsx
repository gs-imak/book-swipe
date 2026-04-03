"use client"

import { useState, useEffect, useMemo } from "react"
import { motion, AnimatePresence } from "framer-motion"
import { X, BarChart3, TrendingUp, Calendar, BookOpen, Target, Flame, Clock, Zap } from "lucide-react"
import {
  getLikedBooks,
  getReadingProgress,
  getBookReviews,
  getBookNotes,
  getUserStats,
  getReadingGoals,
  getReadingPaceInsights,
  type ReadingProgress,
  type ReadingPaceInsights,
  type BookReview,
  type BookNote,
  type UserStats,
  type ReadingGoals,
} from "@/lib/storage"
import { Book } from "@/lib/book-data"

interface ReadingStatsProps {
  isOpen: boolean
  onClose: () => void
}

const AMBER_SHADES = ["#d97706", "#b45309", "#92400e", "#78350f", "#a16207"]

function formatNumber(n: number): string {
  if (n >= 1000) return `${(n / 1000).toFixed(1)}k`
  return n.toString()
}

export function ReadingStats({ isOpen, onClose }: ReadingStatsProps) {
  const [likedBooks, setLikedBooks] = useState<Book[]>([])
  const [progress, setProgress] = useState<ReadingProgress[]>([])
  const [reviews, setReviews] = useState<BookReview[]>([])
  const [notes, setNotes] = useState<BookNote[]>([])
  const [stats, setStats] = useState<UserStats | null>(null)
  const [goals, setGoals] = useState<ReadingGoals | null>(null)
  const [paceInsights, setPaceInsights] = useState<ReadingPaceInsights | null>(null)

  useEffect(() => {
    if (isOpen) {
      setLikedBooks(getLikedBooks())
      setProgress(getReadingProgress())
      setReviews(getBookReviews())
      setNotes(getBookNotes())
      setStats(getUserStats())
      setGoals(getReadingGoals())
      setPaceInsights(getReadingPaceInsights())
    }
  }, [isOpen])

  useEffect(() => {
    if (isOpen) {
      document.body.style.overflow = "hidden"
      return () => { document.body.style.overflow = "" }
    }
  }, [isOpen])

  useEffect(() => {
    if (!isOpen) return
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose()
    }
    document.addEventListener("keydown", handleKeyDown)
    return () => document.removeEventListener("keydown", handleKeyDown)
  }, [isOpen, onClose])

  const computed = useMemo(() => {
    const now = new Date()
    const currentYear = now.getFullYear()
    const lastYear = currentYear - 1
    const currentMonth = now.getMonth()

    // Reading Pace
    const completedThisYear = progress.filter(p => {
      if (p.status !== "completed" || !p.lastReadDate) return false
      const d = new Date(p.lastReadDate)
      return d.getFullYear() === currentYear
    }).length

    const completedLastYear = progress.filter(p => {
      if (p.status !== "completed" || !p.lastReadDate) return false
      const d = new Date(p.lastReadDate)
      return d.getFullYear() === lastYear
    }).length

    const pagesThisMonth = progress.reduce((sum, p) => {
      if (!p.lastReadDate) return sum
      const d = new Date(p.lastReadDate)
      if (d.getFullYear() === currentYear && d.getMonth() === currentMonth) {
        return sum + p.currentPage
      }
      return sum
    }, 0)

    const totalMinutes = progress.reduce((sum, p) => sum + (p.timeSpentMinutes || 0), 0)
    const totalPagesRead = progress.reduce((sum, p) => sum + p.currentPage, 0)
    const avgPagesPerDay = totalMinutes > 0
      ? Math.round(totalPagesRead / Math.max(1, Math.ceil(totalMinutes / (60 * 24))))
      : 0

    // Genre Breakdown
    const genreCounts: Record<string, number> = {}
    likedBooks.forEach(book => {
      book.genre.forEach(g => {
        genreCounts[g] = (genreCounts[g] || 0) + 1
      })
    })
    const totalGenreEntries = Object.values(genreCounts).reduce((s, c) => s + c, 0) || 1
    const genreData = Object.entries(genreCounts)
      .sort((a, b) => b[1] - a[1])
      .slice(0, 5)
      .map(([name, count], i) => ({
        name,
        count,
        percentage: Math.round((count / totalGenreEntries) * 100),
        color: AMBER_SHADES[i % AMBER_SHADES.length],
      }))
    const maxGenreCount = genreData.length > 0 ? genreData[0].count : 1

    // Heatmap (last 12 weeks = 84 days)
    const activityMap: Record<string, number> = {}
    progress.forEach(p => {
      if (p.lastReadDate) {
        const day = p.lastReadDate.split("T")[0]
        activityMap[day] = (activityMap[day] || 0) + 1
      }
    })
    reviews.forEach(r => {
      if (r.createdAt) {
        const day = r.createdAt.split("T")[0]
        activityMap[day] = (activityMap[day] || 0) + 1
      }
    })
    notes.forEach(n => {
      if (n.createdAt) {
        const day = n.createdAt.split("T")[0]
        activityMap[day] = (activityMap[day] || 0) + 1
      }
    })

    const today = new Date()
    const heatmapDays: { date: string; count: number; dayOfWeek: number }[] = []
    for (let i = 83; i >= 0; i--) {
      const d = new Date(today)
      d.setDate(d.getDate() - i)
      const dateStr = d.toISOString().split("T")[0]
      heatmapDays.push({
        date: dateStr,
        count: activityMap[dateStr] || 0,
        dayOfWeek: d.getDay(),
      })
    }
    const heatmapMax = Math.max(...heatmapDays.map(d => d.count), 1)
    const activeDays = heatmapDays.filter(d => d.count > 0).length

    // Group into weeks (columns of 7)
    const heatmapWeeks: typeof heatmapDays[] = []
    for (let i = 0; i < heatmapDays.length; i += 7) {
      heatmapWeeks.push(heatmapDays.slice(i, i + 7))
    }

    // Reading Insights
    const avgBookLength = likedBooks.length > 0
      ? Math.round(likedBooks.reduce((s, b) => s + b.pages, 0) / likedBooks.length)
      : 0

    const favoriteGenre = genreData.length > 0 ? genreData[0].name : "None yet"

    const longestStreak = stats?.longestStreak || 0

    // Monthly comparison (this month vs last month)
    const lastMonthDate = new Date(now)
    lastMonthDate.setMonth(lastMonthDate.getMonth() - 1)
    const lastMonthYear = lastMonthDate.getFullYear()
    const lastMonthMonth = lastMonthDate.getMonth()

    const pagesLastMonth = progress.reduce((sum, p) => {
      if (!p.lastReadDate) return sum
      const d = new Date(p.lastReadDate)
      if (d.getFullYear() === lastMonthYear && d.getMonth() === lastMonthMonth) {
        return sum + p.currentPage
      }
      return sum
    }, 0)

    const monthlyChange = pagesLastMonth > 0
      ? Math.round(((pagesThisMonth - pagesLastMonth) / pagesLastMonth) * 100)
      : pagesThisMonth > 0 ? 100 : 0

    const hasAnyData = likedBooks.length > 0 || progress.length > 0 || reviews.length > 0 || notes.length > 0

    return {
      completedThisYear,
      completedLastYear,
      pagesThisMonth,
      avgPagesPerDay,
      genreData,
      maxGenreCount,
      heatmapDays,
      heatmapWeeks,
      heatmapMax,
      activeDays,
      avgBookLength,
      favoriteGenre,
      longestStreak,
      monthlyChange,
      hasAnyData,
    }
  }, [likedBooks, progress, reviews, notes, stats, goals])

  const getHeatColor = (count: number): string => {
    if (count === 0) return "bg-stone-100 dark:bg-stone-800"
    const ratio = count / computed.heatmapMax
    if (ratio <= 0.25) return "bg-emerald-200 dark:bg-emerald-900"
    if (ratio <= 0.5) return "bg-emerald-400 dark:bg-emerald-700"
    if (ratio <= 0.75) return "bg-emerald-500 dark:bg-emerald-600"
    return "bg-emerald-600 dark:bg-emerald-500"
  }

  const fadeIn = (delay: number) => ({
    initial: { opacity: 0, y: 12 },
    animate: { opacity: 1, y: 0 },
    transition: { duration: 0.4, delay },
  })

  if (!isOpen) return null

  return (
    <AnimatePresence>
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
        className="fixed inset-0 lg:left-16 bg-background z-[60]"
      >
        {/* Header */}
        <div className="bg-background/90 backdrop-blur-md border-b border-stone-200/60 dark:border-stone-800 sticky top-0 z-10">
          <div className="max-w-2xl mx-auto px-4 sm:px-6 py-3 sm:py-4 flex items-center justify-between">
            <div className="flex items-center gap-2.5">
              <BarChart3 className="w-5 h-5 text-amber-600" />
              <h1 className="text-xl sm:text-2xl font-bold text-stone-900 dark:text-stone-100 font-serif">Reading Stats</h1>
            </div>
            <button
              onClick={onClose}
              aria-label="Close reading stats"
              className="p-2 rounded-lg hover:bg-stone-100 dark:hover:bg-stone-800 transition-colors tap-target touch-manipulation"
            >
              <X className="w-5 h-5 text-stone-400" />
            </button>
          </div>
        </div>

        <div
          className="overflow-y-auto overscroll-contain"
          style={{ height: "calc(100vh - 57px)", WebkitOverflowScrolling: "touch" as never }}
        >
          <div className="max-w-2xl mx-auto px-4 sm:px-6 py-6 sm:py-8 space-y-6 sm:space-y-8 pb-24">
            {!computed.hasAnyData ? (
              <div className="text-center py-16">
                <BookOpen className="w-12 h-12 text-stone-300 dark:text-stone-600 mx-auto mb-4" />
                <p className="text-lg font-serif text-stone-500 dark:text-stone-400 mb-1">No reading data yet</p>
                <p className="text-sm text-stone-400 dark:text-stone-500">Start reading to see your stats</p>
              </div>
            ) : (
              <>
                {/* ── Reading Pace ── */}
                <motion.div {...fadeIn(0.05)} className="bg-white dark:bg-stone-900 rounded-2xl p-5 border border-stone-200/60 dark:border-stone-800 shadow-sm">
                  <div className="flex items-center gap-2 mb-4">
                    <TrendingUp className="w-4 h-4 text-amber-600" />
                    <h3 className="text-sm font-semibold text-stone-400 uppercase tracking-wider">Reading Pace</h3>
                  </div>
                  <div className="grid grid-cols-3 gap-3">
                    <div className="text-center p-3 bg-stone-50 dark:bg-stone-800/60 rounded-xl">
                      <div className="flex items-baseline justify-center gap-1">
                        <span className="text-2xl sm:text-3xl font-bold text-stone-900 dark:text-stone-100">
                          {computed.completedThisYear}
                        </span>
                        {computed.completedLastYear > 0 && (
                          <span className="text-xs text-stone-400">
                            / {computed.completedLastYear}
                          </span>
                        )}
                      </div>
                      <p className="text-[11px] text-stone-500 dark:text-stone-400 mt-1">
                        Books this year{computed.completedLastYear > 0 ? " vs last" : ""}
                      </p>
                    </div>
                    <div className="text-center p-3 bg-stone-50 dark:bg-stone-800/60 rounded-xl">
                      <span className="text-2xl sm:text-3xl font-bold text-stone-900 dark:text-stone-100">
                        {formatNumber(computed.pagesThisMonth)}
                      </span>
                      <p className="text-[11px] text-stone-500 dark:text-stone-400 mt-1">Pages this month</p>
                    </div>
                    <div className="text-center p-3 bg-stone-50 dark:bg-stone-800/60 rounded-xl">
                      <span className="text-2xl sm:text-3xl font-bold text-stone-900 dark:text-stone-100">
                        {computed.avgPagesPerDay}
                      </span>
                      <p className="text-[11px] text-stone-500 dark:text-stone-400 mt-1">Avg pages/day</p>
                    </div>
                  </div>
                  {/* Year goal progress bar */}
                  {goals && goals.yearlyTarget > 0 && (
                    <div className="mt-4">
                      <div className="flex items-center justify-between mb-1.5">
                        <span className="text-xs text-stone-500 dark:text-stone-400 flex items-center gap-1">
                          <Target className="w-3 h-3" />
                          Yearly goal
                        </span>
                        <span className="text-xs font-medium text-stone-600 dark:text-stone-300">
                          {computed.completedThisYear} / {goals.yearlyTarget}
                        </span>
                      </div>
                      <div className="h-2 bg-stone-100 dark:bg-stone-800 rounded-full overflow-hidden">
                        <motion.div
                          initial={{ width: 0 }}
                          animate={{ width: `${Math.min(100, (computed.completedThisYear / goals.yearlyTarget) * 100)}%` }}
                          transition={{ duration: 0.8, delay: 0.2 }}
                          className="h-full bg-gradient-to-r from-amber-400 to-amber-600 rounded-full"
                        />
                      </div>
                    </div>
                  )}
                </motion.div>

                {/* ── Genre Breakdown ── */}
                {computed.genreData.length > 0 && (
                  <motion.div {...fadeIn(0.12)} className="bg-white dark:bg-stone-900 rounded-2xl p-5 border border-stone-200/60 dark:border-stone-800 shadow-sm">
                    <div className="flex items-center gap-2 mb-4">
                      <BarChart3 className="w-4 h-4 text-amber-600" />
                      <h3 className="text-sm font-semibold text-stone-400 uppercase tracking-wider">Genre Breakdown</h3>
                    </div>
                    <div className="space-y-3">
                      {computed.genreData.map((genre, i) => (
                        <div key={genre.name}>
                          <div className="flex items-center justify-between mb-1">
                            <span className="text-sm text-stone-700 dark:text-stone-300 font-medium">{genre.name}</span>
                            <span className="text-xs text-stone-400 tabular-nums">{genre.percentage}%</span>
                          </div>
                          <div className="h-3.5 bg-stone-100 dark:bg-stone-800 rounded-full overflow-hidden">
                            <motion.div
                              initial={{ width: 0 }}
                              animate={{ width: `${(genre.count / computed.maxGenreCount) * 100}%` }}
                              transition={{ duration: 0.6, delay: 0.15 + i * 0.08 }}
                              className="h-full rounded-full"
                              style={{ backgroundColor: genre.color }}
                            />
                          </div>
                        </div>
                      ))}
                    </div>
                  </motion.div>
                )}

                {/* ── Reading Heatmap ── */}
                <motion.div {...fadeIn(0.2)} className="bg-white dark:bg-stone-900 rounded-2xl p-5 border border-stone-200/60 dark:border-stone-800 shadow-sm">
                  <div className="flex items-center justify-between mb-4">
                    <div className="flex items-center gap-2">
                      <Calendar className="w-4 h-4 text-amber-600" />
                      <h3 className="text-sm font-semibold text-stone-400 uppercase tracking-wider">Reading Heatmap</h3>
                    </div>
                    <span className="text-xs text-stone-400">
                      {computed.activeDays} active day{computed.activeDays !== 1 ? "s" : ""} in 12 weeks
                    </span>
                  </div>
                  {/* Day-of-week labels + grid */}
                  <div className="flex gap-1">
                    <div className="flex flex-col gap-[3px] mr-1 pt-0">
                      {["S", "M", "T", "W", "T", "F", "S"].map((label, i) => (
                        <div
                          key={`${label}-${i}`}
                          className="w-3 h-3 sm:w-3.5 sm:h-3.5 flex items-center justify-center text-[8px] text-stone-400 dark:text-stone-500 leading-none"
                        >
                          {i % 2 === 1 ? label : ""}
                        </div>
                      ))}
                    </div>
                    <div className="flex gap-[3px] overflow-x-auto hide-scrollbar">
                      {computed.heatmapWeeks.map((week, wi) => (
                        <div key={wi} className="flex flex-col gap-[3px]">
                          {week.map((day) => (
                            <div
                              key={day.date}
                              className={`w-3 h-3 sm:w-3.5 sm:h-3.5 rounded-sm ${getHeatColor(day.count)} transition-colors`}
                              title={`${day.date}: ${day.count} activit${day.count === 1 ? "y" : "ies"}`}
                              role="presentation"
                            />
                          ))}
                        </div>
                      ))}
                    </div>
                  </div>
                  <div className="flex items-center justify-end gap-1.5 mt-3">
                    <span className="text-[10px] text-stone-400">Less</span>
                    <div className="w-2.5 h-2.5 rounded-sm bg-stone-100 dark:bg-stone-800" />
                    <div className="w-2.5 h-2.5 rounded-sm bg-emerald-200 dark:bg-emerald-900" />
                    <div className="w-2.5 h-2.5 rounded-sm bg-emerald-400 dark:bg-emerald-700" />
                    <div className="w-2.5 h-2.5 rounded-sm bg-emerald-500 dark:bg-emerald-600" />
                    <div className="w-2.5 h-2.5 rounded-sm bg-emerald-600 dark:bg-emerald-500" />
                    <span className="text-[10px] text-stone-400">More</span>
                  </div>
                </motion.div>

                {/* ── Reading Insights ── */}
                <motion.div {...fadeIn(0.28)} className="bg-white dark:bg-stone-900 rounded-2xl p-5 border border-stone-200/60 dark:border-stone-800 shadow-sm">
                  <div className="flex items-center gap-2 mb-4">
                    <Flame className="w-4 h-4 text-amber-600" />
                    <h3 className="text-sm font-semibold text-stone-400 uppercase tracking-wider">Reading Insights</h3>
                  </div>
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                    <InsightCard
                      icon={<BookOpen className="w-4 h-4 text-amber-600" />}
                      label="Average book length"
                      value={`${computed.avgBookLength} pages`}
                    />
                    <InsightCard
                      icon={<BarChart3 className="w-4 h-4 text-amber-600" />}
                      label="Favorite genre"
                      value={computed.favoriteGenre}
                    />
                    <InsightCard
                      icon={<TrendingUp className="w-4 h-4 text-amber-600" />}
                      label="Monthly change"
                      value={
                        computed.monthlyChange > 0
                          ? `${computed.monthlyChange}% more this month`
                          : computed.monthlyChange < 0
                            ? `${Math.abs(computed.monthlyChange)}% less this month`
                            : "Same as last month"
                      }
                      positive={computed.monthlyChange >= 0}
                    />
                    <InsightCard
                      icon={<Flame className="w-4 h-4 text-amber-600" />}
                      label="Longest streak"
                      value={`${computed.longestStreak} day${computed.longestStreak !== 1 ? "s" : ""}`}
                    />
                  </div>
                </motion.div>

                {/* ── Reading Pace ── */}
                {paceInsights && (paceInsights.avgPagesPerHour > 0 || paceInsights.booksFinished > 0) && (
                  <motion.div {...fadeIn(0.36)} className="bg-white dark:bg-stone-900 rounded-2xl p-5 border border-stone-200/60 dark:border-stone-800 shadow-sm">
                    <div className="flex items-center gap-2 mb-4">
                      <Zap className="w-4 h-4 text-amber-600" />
                      <h3 className="text-sm font-semibold text-stone-400 uppercase tracking-wider">Reading Pace</h3>
                    </div>
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                      {paceInsights.avgPagesPerHour > 0 && (
                        <InsightCard
                          icon={<Clock className="w-4 h-4 text-amber-600" />}
                          label="Your reading speed"
                          value={`~${paceInsights.avgPagesPerHour} pages/hour`}
                        />
                      )}
                      {paceInsights.bestDay !== "N/A" && (
                        <InsightCard
                          icon={<Calendar className="w-4 h-4 text-amber-600" />}
                          label="Most active day"
                          value={`You read most on ${paceInsights.bestDay}s`}
                        />
                      )}
                      {paceInsights.booksFinished > 0 && (
                        <InsightCard
                          icon={<Target className="w-4 h-4 text-amber-600" />}
                          label="Avg time to finish"
                          value={`${paceInsights.avgDaysPerBook} day${paceInsights.avgDaysPerBook !== 1 ? "s" : ""} per book`}
                        />
                      )}
                      {paceInsights.totalMinutes > 0 && (
                        <InsightCard
                          icon={<Flame className="w-4 h-4 text-amber-600" />}
                          label="Total reading time"
                          value={
                            paceInsights.totalMinutes >= 60
                              ? `${Math.round(paceInsights.totalMinutes / 60)} hour${Math.round(paceInsights.totalMinutes / 60) !== 1 ? "s" : ""}`
                              : `${paceInsights.totalMinutes} min`
                          }
                        />
                      )}
                    </div>

                    {/* Per-book completion estimates for currently reading */}
                    {paceInsights.avgPagesPerHour > 0 && (() => {
                      const currentlyReading = progress.filter(p => p.status === "reading" && p.totalPages > 0)
                      if (currentlyReading.length === 0) return null
                      return (
                        <div className="mt-4 pt-4 border-t border-stone-100 dark:border-stone-800">
                          <p className="text-[11px] text-stone-400 dark:text-stone-500 uppercase tracking-wider mb-3">
                            At your pace
                          </p>
                          <div className="space-y-2">
                            {currentlyReading.map(book => {
                              const remaining = Math.max(0, book.totalPages - book.currentPage)
                              const estimate = paceInsights.estimatedCompletion(remaining)
                              const pct = book.totalPages > 0 ? Math.round((book.currentPage / book.totalPages) * 100) : 0
                              return (
                                <div key={book.bookId} className="flex items-center gap-3 p-2.5 bg-stone-50 dark:bg-stone-800/60 rounded-lg">
                                  <div className="flex-1 min-w-0">
                                    <p className="text-sm text-stone-700 dark:text-stone-300 font-medium truncate">
                                      {book.book.title}
                                    </p>
                                    <div className="flex items-center gap-2 mt-1">
                                      <div className="flex-1 h-1.5 bg-stone-200 dark:bg-stone-700 rounded-full overflow-hidden">
                                        <div
                                          className="h-full bg-amber-500 rounded-full transition-all"
                                          style={{ width: `${pct}%` }}
                                        />
                                      </div>
                                      <span className="text-[10px] text-stone-400 tabular-nums flex-shrink-0">{pct}%</span>
                                    </div>
                                  </div>
                                  <span className="text-xs font-medium text-amber-600 dark:text-amber-400 flex-shrink-0 whitespace-nowrap">
                                    {estimate} left
                                  </span>
                                </div>
                              )
                            })}
                          </div>
                        </div>
                      )
                    })()}
                  </motion.div>
                )}
              </>
            )}
          </div>
        </div>
      </motion.div>
    </AnimatePresence>
  )
}

function InsightCard({
  icon,
  label,
  value,
  positive,
}: {
  icon: React.ReactNode
  label: string
  value: string
  positive?: boolean
}) {
  return (
    <div className="flex items-start gap-3 p-3 bg-stone-50 dark:bg-stone-800/60 rounded-xl">
      <div className="mt-0.5 flex-shrink-0">{icon}</div>
      <div className="min-w-0">
        <p className="text-[11px] text-stone-400 dark:text-stone-500 uppercase tracking-wider">{label}</p>
        <p
          className={`text-sm font-semibold mt-0.5 ${
            positive === true
              ? "text-emerald-600 dark:text-emerald-400"
              : positive === false
                ? "text-rose-600 dark:text-rose-400"
                : "text-stone-900 dark:text-stone-100"
          }`}
        >
          {value}
        </p>
      </div>
    </div>
  )
}
