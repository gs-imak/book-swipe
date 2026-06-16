/** Centralized app configuration constants */

// Swipe interface
export const MAX_DECK_SIZE = 15

// Book cache
export const MAX_CACHE_SIZE = 500
export const CACHE_TTL_MS = 24 * 60 * 60 * 1000 // 24 hours

// API rate limiting (server-side)
export const API_RATE_LIMIT = 60 // requests per window
export const API_RATE_WINDOW_MS = 60_000 // 1 minute

// Search
export const SEARCH_DEBOUNCE_MS = 500
export const SEARCH_MAX_RESULTS = 20
