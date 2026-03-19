"use client"

const THEME_KEY = "bookswipe_theme"
type Theme = "light" | "dark"

export function getTheme(): Theme {
  if (typeof window === "undefined") return "light"
  try {
    const stored = localStorage.getItem(THEME_KEY)
    if (stored === "dark") return "dark"
    if (stored === "light") return "light"
    // Respect system preference as default
    if (window.matchMedia("(prefers-color-scheme: dark)").matches) return "dark"
  } catch {
    // ignore
  }
  return "light"
}

export function setTheme(theme: Theme): void {
  if (typeof window === "undefined") return
  try {
    localStorage.setItem(THEME_KEY, theme)
  } catch {
    // ignore
  }
  applyTheme(theme)
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
