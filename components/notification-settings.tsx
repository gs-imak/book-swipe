"use client"

import { useState, useEffect, useCallback } from "react"
import { Bell, BellOff, AlertTriangle } from "lucide-react"
import {
  isNotificationSupported,
  getNotificationPermission,
  requestNotificationPermission,
  getNotificationSettings,
  setNotificationSettings,
  formatReminderTime,
  parseTimeValue,
  toTimeValue,
  type NotificationSettings as NotifSettings,
} from "@/lib/notifications"

export function NotificationSettings() {
  const [supported, setSupported] = useState(true)
  const [permission, setPermission] = useState<NotificationPermission | "unsupported">("default")
  const [settings, setSettings] = useState<NotifSettings>({
    enabled: false,
    reminderHour: 20,
    reminderMinute: 0,
  })

  useEffect(() => {
    const sup = isNotificationSupported()
    setSupported(sup)
    setPermission(getNotificationPermission())
    setSettings(getNotificationSettings())
  }, [])

  const handleToggle = useCallback(async () => {
    if (settings.enabled) {
      // Turning off
      const next = { ...settings, enabled: false }
      setSettings(next)
      setNotificationSettings(next)
      return
    }

    // Turning on -- need permission first
    let perm = getNotificationPermission()
    if (perm === "default") {
      perm = await requestNotificationPermission()
      setPermission(perm)
    }

    if (perm === "granted") {
      const next = { ...settings, enabled: true }
      setSettings(next)
      setNotificationSettings(next)
    }
    // If denied, the toggle stays off and we show the denied message
  }, [settings])

  const handleTimeChange = useCallback(
    (e: React.ChangeEvent<HTMLInputElement>) => {
      const { hour, minute } = parseTimeValue(e.target.value)
      const next = { ...settings, reminderHour: hour, reminderMinute: minute }
      setSettings(next)
      setNotificationSettings(next)
    },
    [settings]
  )

  if (!supported) return null

  const isDenied = permission === "denied"
  const isEnabled = settings.enabled && permission === "granted"

  return (
    <div className="space-y-4">
      {/* Toggle row */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          {isEnabled ? (
            <Bell className="w-4 h-4 text-amber-500" />
          ) : (
            <BellOff className="w-4 h-4 text-amber-500" />
          )}
          <div>
            <p className="text-sm font-medium text-stone-900 dark:text-stone-100">
              Reading Reminders
            </p>
            <p className="text-xs text-stone-400">
              {isEnabled
                ? `Daily at ${formatReminderTime(settings.reminderHour, settings.reminderMinute)}`
                : "Get reminded to keep your streak"}
            </p>
          </div>
        </div>
        <button
          onClick={handleToggle}
          role="switch"
          aria-checked={isEnabled}
          aria-label="Toggle reading reminders"
          className={`relative w-11 h-6 rounded-full transition-colors ${
            isEnabled ? "bg-amber-600" : "bg-stone-300 dark:bg-stone-600"
          }`}
        >
          <span
            className={`absolute top-0.5 left-0.5 w-5 h-5 rounded-full bg-white shadow transition-transform ${
              isEnabled ? "translate-x-5" : "translate-x-0"
            }`}
          />
        </button>
      </div>

      {/* Permission denied message */}
      {isDenied && (
        <div className="flex items-start gap-2.5 bg-amber-50 dark:bg-amber-950/30 border border-amber-200/60 dark:border-amber-800/40 rounded-xl p-3">
          <AlertTriangle className="w-4 h-4 text-amber-600 flex-shrink-0 mt-0.5" />
          <p className="text-xs text-amber-800 dark:text-amber-300 leading-relaxed">
            Notifications are blocked. Open your browser settings and allow notifications for this
            site, then try again.
          </p>
        </div>
      )}

      {/* Time picker -- only shown when enabled */}
      {isEnabled && (
        <div className="flex items-center justify-between pl-7">
          <label
            htmlFor="reminder-time"
            className="text-xs text-stone-500 dark:text-stone-400"
          >
            Remind me at
          </label>
          <input
            id="reminder-time"
            type="time"
            value={toTimeValue(settings.reminderHour, settings.reminderMinute)}
            onChange={handleTimeChange}
            className="bg-stone-100 dark:bg-stone-800 border border-stone-200 dark:border-stone-700 rounded-lg px-3 py-1.5 text-sm text-stone-900 dark:text-stone-100 focus:outline-none focus:ring-2 focus:ring-amber-500/40"
          />
        </div>
      )}
    </div>
  )
}
