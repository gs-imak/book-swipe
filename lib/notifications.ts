"use client"

const NOTIFICATION_SETTINGS_KEY = "bookswipe_notification_settings"
const LAST_NOTIFIED_KEY = "bookswipe_last_notified_date"

export interface NotificationSettings {
  enabled: boolean
  reminderHour: number   // 0-23
  reminderMinute: number // 0-59
}

const DEFAULT_SETTINGS: NotificationSettings = {
  enabled: false,
  reminderHour: 20,
  reminderMinute: 0,
}

// Check if the Notification API is available
export function isNotificationSupported(): boolean {
  return typeof window !== "undefined" && "Notification" in window
}

// Get current browser permission state
export function getNotificationPermission(): NotificationPermission | "unsupported" {
  if (!isNotificationSupported()) return "unsupported"
  return Notification.permission
}

// Request notification permission from the browser
export async function requestNotificationPermission(): Promise<NotificationPermission | "unsupported"> {
  if (!isNotificationSupported()) return "unsupported"
  try {
    const result = await Notification.requestPermission()
    return result
  } catch {
    return "denied"
  }
}

// Read notification settings from localStorage
export function getNotificationSettings(): NotificationSettings {
  try {
    if (typeof window === "undefined") return DEFAULT_SETTINGS
    const stored = localStorage.getItem(NOTIFICATION_SETTINGS_KEY)
    if (!stored) return DEFAULT_SETTINGS
    return JSON.parse(stored) as NotificationSettings
  } catch {
    return DEFAULT_SETTINGS
  }
}

// Write notification settings to localStorage
export function setNotificationSettings(settings: NotificationSettings): void {
  try {
    if (typeof window === "undefined") return
    localStorage.setItem(NOTIFICATION_SETTINGS_KEY, JSON.stringify(settings))
  } catch {
    // Storage full or unavailable -- degrade silently
  }
}

// Format the reminder time for display (e.g. "8:00 PM")
export function formatReminderTime(hour: number, minute: number): string {
  const period = hour >= 12 ? "PM" : "AM"
  const displayHour = hour === 0 ? 12 : hour > 12 ? hour - 12 : hour
  const displayMinute = minute.toString().padStart(2, "0")
  return `${displayHour}:${displayMinute} ${period}`
}

// Parse an HTML time input value ("HH:MM") into hour and minute
export function parseTimeValue(value: string): { hour: number; minute: number } {
  const [h, m] = value.split(":").map(Number)
  return { hour: h || 0, minute: m || 0 }
}

// Convert hour/minute to an HTML time input value ("HH:MM")
export function toTimeValue(hour: number, minute: number): string {
  return `${hour.toString().padStart(2, "0")}:${minute.toString().padStart(2, "0")}`
}

// Check whether we've already sent a notification today
function wasNotifiedToday(): boolean {
  try {
    const last = localStorage.getItem(LAST_NOTIFIED_KEY)
    if (!last) return false
    return last === new Date().toDateString()
  } catch {
    return false
  }
}

// Mark that we notified the user today
function markNotifiedToday(): void {
  try {
    localStorage.setItem(LAST_NOTIFIED_KEY, new Date().toDateString())
  } catch {
    // ignore
  }
}

// Show a local notification through the Notification API
function showNotification(title: string, body: string): void {
  if (!isNotificationSupported()) return
  if (Notification.permission !== "granted") return

  try {
    const notification = new Notification(title, {
      body,
      icon: "/logo/bookswipe_logo.png",
      badge: "/logo/bookswipe_logo.png",
      tag: "bookswipe-reading-reminder",
    })

    notification.onclick = () => {
      window.focus()
      notification.close()
    }
  } catch {
    // Some browsers restrict Notification constructor in certain contexts
  }
}

// Main check: called on app load to decide whether to show a reminder
// Requires the current streak and last activity date from the gamification system
export function checkAndNotify(currentStreak: number, lastActivityDate: string): void {
  if (!isNotificationSupported()) return

  const settings = getNotificationSettings()
  if (!settings.enabled) return
  if (Notification.permission !== "granted") return
  if (wasNotifiedToday()) return

  // Check if user has already been active today
  const today = new Date().toDateString()
  if (lastActivityDate) {
    const lastDate = new Date(lastActivityDate).toDateString()
    if (lastDate === today) return // Already active today, no reminder needed
  }

  // Check if it's past the reminder time
  const now = new Date()
  const reminderTime = new Date()
  reminderTime.setHours(settings.reminderHour, settings.reminderMinute, 0, 0)

  if (now < reminderTime) return // Not yet time

  // Build the notification message
  let body: string
  if (currentStreak > 1) {
    body = `Don't break your ${currentStreak}-day reading streak! Open BookSwipe to keep it going.`
  } else if (currentStreak === 1) {
    body = "You started a streak yesterday! Come back to keep it alive."
  } else {
    body = "Take a moment to discover your next favorite book today."
  }

  showNotification("BookSwipe", body)
  markNotifiedToday()
}
