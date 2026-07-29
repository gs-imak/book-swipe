"use client"

import { useSyncExternalStore } from "react"
import { getTheme, subscribeTheme } from "./theme"

/**
 * Subscribe to the current theme. Hydration-safe: the server snapshot is
 * "light" (matching the un-classed <html>), and every subscriber re-renders
 * together when the theme changes anywhere in the app.
 */
export function useTheme(): "light" | "dark" {
  return useSyncExternalStore(subscribeTheme, getTheme, () => "light" as const)
}
