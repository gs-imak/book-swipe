"use client"
import { t } from "@/lib/i18n"


const READING_SPEED_KEY = "bookswipe_reading_speed"

export type ReadingSpeed = "slow" | "average" | "fast"

// Words per minute for each speed
const WPM: Record<ReadingSpeed, number> = {
  slow: 150,
  average: 250,
  fast: 400,
}

const SPEED_LABELS: Record<ReadingSpeed, string> = {
  slow: "Relaxed (150 wpm)",
  average: "Average (250 wpm)",
  fast: "Speed Reader (400 wpm)",
}

export function getReadingSpeed(): ReadingSpeed {
  if (typeof window !== "undefined") {
    const stored = localStorage.getItem(READING_SPEED_KEY) as ReadingSpeed | null
    if (stored && WPM[stored]) return stored
  }
  return "average"
}

export function setReadingSpeed(speed: ReadingSpeed): void {
  if (typeof window !== "undefined") {
    localStorage.setItem(READING_SPEED_KEY, speed)
  }
}

export function getSpeedLabel(speed: ReadingSpeed): string {
  return SPEED_LABELS[speed]
}

export function getAllSpeeds(): { value: ReadingSpeed; label: string }[] {
  return [
    { value: "slow", label: SPEED_LABELS.slow },
    { value: "average", label: SPEED_LABELS.average },
    { value: "fast", label: SPEED_LABELS.fast },
  ]
}

const WORDS_PER_PAGE = 250

/**
 * Catalog-facing reading-time BUCKETS ("2-4 hours", "12+ hours") at a fixed
 * average speed. This is the format stored on `Book.readingTime` and parsed
 * by the time filters (regex on "N-M hours") — distinct from
 * `estimateReadingTime` below, which is personalized to the user's reading
 * speed and returns display strings like "~2 hrs". Don't merge them.
 */
export function estimateReadingTimeRange(pages: number): string {
  const wordsPerMinute = 250
  const totalWords = pages * WORDS_PER_PAGE
  const hours = Math.ceil(totalWords / wordsPerMinute / 60)

  if (hours < 1) return "< 1 hour"
  if (hours < 2) return "1-2 hours"
  if (hours < 4) return "2-4 hours"
  if (hours < 6) return "4-6 hours"
  if (hours < 8) return "6-8 hours"
  if (hours < 12) return "8-12 hours"
  return "12+ hours"
}

export function estimateReadingTime(pages: number, speed?: ReadingSpeed): string {
  const s = speed || getReadingSpeed()
  const wpm = WPM[s]
  const totalWords = pages * WORDS_PER_PAGE
  const totalMinutes = totalWords / wpm
  const hours = totalMinutes / 60

  if (hours < 1) return "< 1 hr"
  if (hours < 1.5) return "~1 hr"
  if (hours < 2.5) return "~2 hrs"

  const roundedHours = Math.round(hours)
  return t("reading_time.hrs", { v0: roundedHours })
}

export function estimateReadingMinutes(pages: number, speed?: ReadingSpeed): number {
  const s = speed || getReadingSpeed()
  const wpm = WPM[s]
  return Math.round((pages * WORDS_PER_PAGE) / wpm)
}

export function formatMinutesToDisplay(minutes: number): string {
  if (minutes < 60) return t("reading_stats.min", { v0: minutes })
  const hours = Math.floor(minutes / 60)
  const mins = minutes % 60
  if (mins === 0) return `${hours} hr${hours > 1 ? "s" : ""}`
  return `${hours}h ${mins}m`
}
