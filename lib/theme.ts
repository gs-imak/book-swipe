"use client"

const THEME_KEY = "bookswipe_theme"
type Theme = "light" | "dark"

export function getTheme(): Theme {
  if (typeof window === "undefined") return "light"
  try {
    const stored = localStorage.getItem(THEME_KEY)
    if (stored === "dark") return "dark"
    if (stored === "light") return "light"
    // Default to light — user must explicitly choose dark mode
  } catch {
    // ignore
  }
  return "light"
}

// Subscribers for useTheme(). Without this, each component that read the theme
// held its own copy, so toggling in one place (settings) left others (the nav
// icon) stale until remount.
const listeners = new Set<() => void>()

/** Subscribe to theme changes. Returns an unsubscribe function. */
export function subscribeTheme(onChange: () => void): () => void {
  listeners.add(onChange)
  if (typeof window !== "undefined") {
    // Another tab changed the theme.
    window.addEventListener("storage", onChange)
  }
  return () => {
    listeners.delete(onChange)
    if (typeof window !== "undefined") {
      window.removeEventListener("storage", onChange)
    }
  }
}

export function setTheme(theme: Theme): void {
  if (typeof window === "undefined") return
  try {
    localStorage.setItem(THEME_KEY, theme)
  } catch {
    // ignore
  }
  applyTheme(theme)
  listeners.forEach((l) => l())
}

export function toggleTheme(): Theme {
  const current = getTheme()
  const next = current === "dark" ? "light" : "dark"
  setTheme(next)
  return next
}

export function applyTheme(theme: Theme): void {
  if (typeof document === "undefined") return
  const root = document.documentElement
  if (theme === "dark") {
    root.classList.add("dark")
  } else {
    root.classList.remove("dark")
  }
  // Update theme-color meta tag
  const meta = document.querySelector('meta[name="theme-color"]')
  if (meta) {
    meta.setAttribute("content", theme === "dark" ? "#0a0a0a" : "#FDFBF7")
  }
}
