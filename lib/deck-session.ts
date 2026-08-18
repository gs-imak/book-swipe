"use client"

import { Book, UserPreferences } from "./book-data"
import { getCachedBooks } from "./book-cache"

/**
 * Where you were in the deck, for the length of one tab.
 *
 * Every view is a keyed child of an <AnimatePresence mode="wait">, so leaving
 * Discover unmounts the whole deck: the queue, the index and the undo history
 * all die, and coming back re-runs the full network fan-out to rebuild a
 * *different* deck. Measured before this existed: swipe 6 -> Library ->
 * Discover landed on "1 / 15" with a new top card and cost 114 requests.
 *
 * Deliberately sessionStorage, not localStorage — resuming mid-deck is right
 * for "I just checked my library", wrong for "I opened the app the next day",
 * and sessionStorage draws exactly that line for free.
 */

const KEY = "bookswipe_deck_session"

/** Books are stored by id and rehydrated from the shared cache. */
interface DeckSnapshot {
  deckIds: string[]
  currentIndex: number
  undo: { id: string; direction: "left" | "right" }[]
  batchCount: number
  prefsHash: string
  savedAt: number
}

export interface RestoredDeck {
  books: Book[]
  currentIndex: number
  undoStack: { book: Book; direction: "left" | "right" }[]
  batchCount: number
}

/**
 * Identity of the preference set the deck was built for. A snapshot taken
 * under different preferences describes a deck the user no longer wants, so it
 * is discarded rather than restored.
 */
export function preferencesHash(p: UserPreferences): string {
  return JSON.stringify([
    [...p.favoriteGenres].sort(),
    [...p.currentMood].sort(),
    p.preferredLength,
    [...(p.contentPreferences || [])].sort(),
  ])
}

// A tab left open for hours should refill rather than resume a stale queue.
const MAX_AGE_MS = 2 * 60 * 60 * 1000

export function saveDeckSession(
  books: Book[],
  currentIndex: number,
  undoStack: { book: Book; direction: "left" | "right" }[],
  batchCount: number,
  preferences: UserPreferences,
): void {
  if (typeof window === "undefined") return
  if (books.length === 0) return
  try {
    const snapshot: DeckSnapshot = {
      deckIds: books.map((b) => b.id),
      currentIndex,
      undo: undoStack.map((u) => ({ id: u.book.id, direction: u.direction })),
      batchCount,
      prefsHash: preferencesHash(preferences),
      savedAt: Date.now(),
    }
    sessionStorage.setItem(KEY, JSON.stringify(snapshot))
  } catch {
    /* quota or private mode — resuming is a nicety, never a requirement */
  }
}

/**
 * Returns the deck the user was on, or null if there isn't a usable one.
 *
 * Null means "fetch normally", so every uncertain case (no snapshot, stale,
 * different preferences, cache evicted the books, already at the end) returns
 * null rather than a half-restored deck.
 */
export function loadDeckSession(preferences: UserPreferences): RestoredDeck | null {
  if (typeof window === "undefined") return null
  let snapshot: DeckSnapshot
  try {
    const raw = sessionStorage.getItem(KEY)
    if (!raw) return null
    snapshot = JSON.parse(raw) as DeckSnapshot
  } catch {
    return null
  }

  if (!snapshot?.deckIds?.length) return null
  if (snapshot.prefsHash !== preferencesHash(preferences)) return null
  if (!snapshot.savedAt || Date.now() - snapshot.savedAt > MAX_AGE_MS) return null

  const byId = new Map(getCachedBooks().map((b) => [b.id, b]))
  const books = snapshot.deckIds.map((id) => byId.get(id)).filter((b): b is Book => Boolean(b))

  // The cache is shared and trimmed independently, so a snapshot can outlive
  // the books it points at. Restoring a deck with holes would silently skip
  // cards; refetching is the honest fallback.
  if (books.length !== snapshot.deckIds.length) return null

  const currentIndex = Math.min(Math.max(snapshot.currentIndex, 0), books.length)
  if (currentIndex >= books.length) return null

  return {
    books,
    currentIndex,
    undoStack: snapshot.undo
      .map((u) => {
        const book = byId.get(u.id)
        return book ? { book, direction: u.direction } : null
      })
      .filter((u): u is { book: Book; direction: "left" | "right" } => Boolean(u)),
    batchCount: snapshot.batchCount || 1,
  }
}

export function clearDeckSession(): void {
  if (typeof window === "undefined") return
  try {
    sessionStorage.removeItem(KEY)
  } catch {
    /* nothing to do */
  }
}
