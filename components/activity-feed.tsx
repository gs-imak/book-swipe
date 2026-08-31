"use client"

import { useMemo } from "react"
import { Heart, BookOpen, CheckCircle2, Star, BookMarked, FolderPlus, Trophy } from "lucide-react"
import { getActivityLog, type ActivityEntry } from "@/lib/storage"
import { t, tv } from "@/lib/i18n"

interface ActivityFeedProps {
  limit?: number
}

const ICONS: Record<ActivityEntry["type"], typeof Heart> = {
  liked: Heart,
  started_reading: BookOpen,
  finished: CheckCircle2,
  reviewed: Star,
  added_to_shelf: BookMarked,
  created_collection: FolderPlus,
  achievement_unlocked: Trophy,
}

const ICON_COLORS: Record<ActivityEntry["type"], string> = {
  liked: "text-rose-500 bg-rose-50 dark:bg-rose-950/40",
  started_reading: "text-amber-600 bg-amber-50 dark:bg-amber-950/40",
  finished: "text-emerald-600 bg-emerald-50 dark:bg-emerald-950/40",
  reviewed: "text-amber-500 bg-amber-50 dark:bg-amber-950/40",
  added_to_shelf: "text-sky-600 bg-sky-50 dark:bg-sky-950/40",
  created_collection: "text-violet-600 bg-violet-50 dark:bg-violet-950/40",
  achievement_unlocked: "text-amber-500 bg-amber-50 dark:bg-amber-950/40",
}

function describeActivity(entry: ActivityEntry): string {
  const title = entry.bookTitle ? `"${entry.bookTitle}"` : "a book"
  switch (entry.type) {
    case "liked":
      return t("activity_feed.liked", { v0: title })
    case "started_reading":
      return t("activity_feed.started_reading", { v0: title })
    case "finished":
      return t("activity_feed.finished", { v0: title })
    case "reviewed":
      return t("activity_feed.reviewed", { v0: title, v1: entry.detail ? ` -- ${entry.detail}` : "" })
    case "added_to_shelf":
      return t("activity_feed.added_to", { v0: title, v1: entry.detail || "a shelf" })
    case "created_collection":
      return t("activity_feed.created_collection", { v0: entry.detail || "" })
    case "achievement_unlocked":
      return t("activity_feed.unlocked", { v0: entry.detail || "an achievement" })
    default:
      return "Activity"
  }
}

function formatRelativeTime(iso: string): string {
  const date = new Date(iso)
  const now = new Date()
  const diffMs = now.getTime() - date.getTime()
  const diffMin = Math.floor(diffMs / 60000)
  const diffHr = Math.floor(diffMs / 3600000)
  const diffDay = Math.floor(diffMs / 86400000)

  if (diffMin < 1) return "Just now"
  if (diffMin < 60) return t("activity_feed.m_ago", { v0: diffMin })
  if (diffHr < 24) return t("activity_feed.h_ago", { v0: diffHr })
  if (diffDay === 1) return "Yesterday"
  if (diffDay < 7) return t("activity_feed.d_ago", { v0: diffDay })

  return date.toLocaleDateString("en-US", { month: "short", day: "numeric" })
}

function dateLabel(iso: string): string {
  const date = new Date(iso)
  const now = new Date()
  const today = new Date(now.getFullYear(), now.getMonth(), now.getDate())
  const entryDate = new Date(date.getFullYear(), date.getMonth(), date.getDate())
  const diffDay = Math.floor((today.getTime() - entryDate.getTime()) / 86400000)

  if (diffDay === 0) return "Today"
  if (diffDay === 1) return "Yesterday"
  if (diffDay < 7) return "This Week"
  return date.toLocaleDateString("en-US", { month: "long", day: "numeric" })
}

export function ActivityFeed({ limit = 20 }: ActivityFeedProps) {
  const entries = useMemo(() => getActivityLog().slice(0, limit), [limit])

  if (entries.length === 0) {
    return (
      <div className="text-center py-8">
        <BookOpen className="w-8 h-8 text-stone-300 dark:text-stone-600 mx-auto mb-2" />
        <p className="text-sm text-stone-400 dark:text-stone-500">{t("activity_feed.your_reading_journey_starts_here")}</p>
      </div>
    )
  }

  const grouped: { label: string; items: ActivityEntry[] }[] = []
  entries.forEach(entry => {
    const label = dateLabel(entry.timestamp)
    const last = grouped[grouped.length - 1]
    if (last && last.label === label) {
      last.items.push(entry)
    } else {
      grouped.push({ label, items: [entry] })
    }
  })

  return (
    <div className="relative">
      <div className="absolute left-[15px] top-4 bottom-0 w-px bg-stone-200/70 dark:bg-stone-700/50" aria-hidden="true" />

      <div className="space-y-5">
        {grouped.map((group) => (
          <div key={tv(group.label)}>
            <p className="text-[11px] font-semibold text-stone-400 dark:text-stone-500 uppercase tracking-wider ml-9 mb-2">
              {tv(group.label)}
            </p>
            <div className="space-y-1">
              {group.items.map((entry) => {
                const Icon = ICONS[entry.type] || BookOpen
                const colorClass = ICON_COLORS[entry.type] || "text-stone-500 bg-stone-100"
                return (
                  <div key={entry.id} className="flex items-start gap-3 group relative">
                    <div
                      className={`relative z-[1] flex-shrink-0 w-[31px] h-[31px] rounded-full flex items-center justify-center ${colorClass} ring-2 ring-white dark:ring-stone-900 transition-transform duration-200 group-hover:scale-110`}
                    >
                      <Icon className="w-3.5 h-3.5" />
                    </div>
                    <div className="flex-1 min-w-0 py-1">
                      <p className="text-sm text-stone-700 dark:text-stone-300 leading-snug truncate">
                        {describeActivity(entry)}
                      </p>
                      <p className="text-[11px] text-stone-400 dark:text-stone-500 mt-0.5">
                        {formatRelativeTime(entry.timestamp)}
                      </p>
                    </div>
                  </div>
                )
              })}
            </div>
          </div>
        ))}
      </div>
    </div>
  )
}
