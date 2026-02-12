"use client"

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
  return `~${roundedHours} hrs`
}

export function estimateReadingMinutes(pages: number, speed?: ReadingSpeed): number {
  const s = speed || getReadingSpeed()
  const wpm = WPM[s]
  return Math.round((pages * WORDS_PER_PAGE) / wpm)
}

export function formatMinutesToDisplay(minutes: number): string {
  if (minutes < 60) return `${minutes} min`
  const hours = Math.floor(minutes / 60)
  const mins = minutes % 60
  if (mins === 0) return `${hours} hr${hours > 1 ? "s" : ""}`
  return `${hours}h ${mins}m`
}
