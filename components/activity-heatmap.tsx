"use client"

import { Flame } from "lucide-react"
import { getReadingProgress, getBookReviews, getBookNotes } from "@/lib/storage"

/**
 * Current-month reading-activity calendar + day streak. Self-contained: reads
 * progress/reviews/notes from storage on render (extracted verbatim from the
 * dashboard's inline IIFE — same data, same behavior).
 */
export function ActivityHeatmap() {
  const now = new Date()
  const year = now.getFullYear()
  const month = now.getMonth()
  const monthName = now.toLocaleString("default", { month: "long" })
  const daysInMonth = new Date(year, month + 1, 0).getDate()
  const firstDayOfWeek = new Date(year, month, 1).getDay()

  const activityCounts: Record<string, number> = {}
  const countDay = (dateStr: string | undefined) => {
    if (!dateStr) return
    const d = new Date(dateStr)
    if (d.getFullYear() === year && d.getMonth() === month) {
      const key = d.getDate().toString()
      activityCounts[key] = (activityCounts[key] || 0) + 1
    }
  }

  getReadingProgress()
    .filter((p) => p.status !== "dnf")
    .forEach((p) => countDay(p.lastReadDate))
  getBookReviews().forEach((r) => countDay(r.updatedAt || r.createdAt))
  getBookNotes().forEach((n) => countDay(n.createdAt))

  const todayDate = now.getDate()
  let streak = 0
  for (let d = todayDate; d >= 1; d--) {
    if (activityCounts[d.toString()]) {
      streak++
    } else {
      break
    }
  }

  const weeks: (number | null)[][] = []
  let currentWeek: (number | null)[] = []
  const startOffset = firstDayOfWeek === 0 ? 6 : firstDayOfWeek - 1
  for (let i = 0; i < startOffset; i++) currentWeek.push(null)
  for (let day = 1; day <= daysInMonth; day++) {
    currentWeek.push(day)
    if (currentWeek.length === 7) {
      weeks.push(currentWeek)
      currentWeek = []
    }
  }
  if (currentWeek.length > 0) {
    while (currentWeek.length < 7) currentWeek.push(null)
    weeks.push(currentWeek)
  }

  const dayLabels = ["M", "T", "W", "T", "F", "S", "S"]

  const getCellColor = (count: number) => {
    if (count === 0) return "bg-stone-100 dark:bg-stone-800"
    if (count === 1) return "bg-amber-200 dark:bg-amber-800/60"
    if (count === 2) return "bg-amber-400 dark:bg-amber-600/80"
    return "bg-amber-600 dark:bg-amber-500"
  }

  return (
    <div className="rounded-xl border border-stone-200/70 dark:border-stone-700/60 bg-stone-50/80 dark:bg-stone-800/40 p-4">
      <div className="flex items-center justify-between mb-3">
        <div>
          <p className="text-xs font-semibold uppercase tracking-wider text-stone-500 dark:text-stone-400">
            {monthName} {year}
          </p>
        </div>
        {streak > 0 && (
          <div className="flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-amber-50 dark:bg-amber-900/30">
            <Flame className="w-3.5 h-3.5 text-amber-500" />
            <span className="text-xs font-bold text-amber-700 dark:text-amber-400">{streak} day streak</span>
          </div>
        )}
      </div>

      <div className="flex gap-1">
        <div className="flex flex-col gap-1 mr-1.5 pt-0">
          {dayLabels.map((label, i) => (
            <div key={i} className="h-3 flex items-center" style={{ fontSize: "9px", lineHeight: "12px" }}>
              <span className={`text-stone-400 dark:text-stone-500 font-medium ${i % 2 === 0 ? "opacity-100" : "opacity-0"}`}>
                {label}
              </span>
            </div>
          ))}
        </div>

        <div className="flex gap-1 flex-1">
          {weeks.map((week, wi) => (
            <div key={wi} className="flex flex-col gap-1 flex-1">
              {week.map((day, di) => {
                const count = day ? activityCounts[day.toString()] || 0 : 0
                const isToday = day === todayDate
                return (
                  <div
                    key={day !== null ? `${year}-${month}-${day}` : `pad-${wi}-${di}`}
                    className={`h-3 w-full rounded-sm transition-colors ${
                      day === null ? "bg-transparent" : getCellColor(count)
                    } ${isToday ? "ring-1 ring-stone-400 dark:ring-stone-500" : ""}`}
                    title={day ? `${monthName} ${day}: ${count} ${count === 1 ? "activity" : "activities"}` : ""}
                  />
                )
              })}
            </div>
          ))}
        </div>
      </div>

      <div className="flex items-center gap-1.5 mt-2.5 justify-end">
        <span className="text-[9px] text-stone-400 dark:text-stone-500">Less</span>
        <div className="h-2.5 w-2.5 rounded-sm bg-stone-100 dark:bg-stone-800" />
        <div className="h-2.5 w-2.5 rounded-sm bg-amber-200 dark:bg-amber-800/60" />
        <div className="h-2.5 w-2.5 rounded-sm bg-amber-400 dark:bg-amber-600/80" />
        <div className="h-2.5 w-2.5 rounded-sm bg-amber-600 dark:bg-amber-500" />
        <span className="text-[9px] text-stone-400 dark:text-stone-500">More</span>
      </div>
    </div>
  )
}
