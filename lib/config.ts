/** Centralized app configuration constants */

// Swipe interface
export const MAX_DECK_SIZE = 15
// Books fetched per deck load, split across the user's genres. Each genre's
// Google request is capped at 40 (Google's page max) — the per-genre cursor
// pages deeper on every load, so supply over time is unbounded.
export const DECK_FETCH_BUDGET = 80

// Book cache
export const MAX_CACHE_SIZE = 800 // ~1MB of localStorage at ~1.2KB/book
export const CACHE_TTL_MS = 24 * 60 * 60 * 1000 // 24 hours

// API rate limiting (server-side)
export const API_RATE_LIMIT = 60 // requests per window
export const API_RATE_WINDOW_MS = 60_000 // 1 minute

// Search
export const SEARCH_DEBOUNCE_MS = 500
export const SEARCH_MAX_RESULTS = 20
