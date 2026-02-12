"use client"

import { Book } from "./book-data"
import { searchGoogleBooks, bookSearchQueries } from "./books-api"
import { searchOpenLibrary, transformToBook, OpenLibraryDoc } from "./openlibrary-api"
import { getCachedBooks, addBooksToCache } from "./book-cache"
import { getLikedBooks } from "./storage"

// ---------------------------------------------------------------------------
// Sub-genre definitions
// ---------------------------------------------------------------------------

export interface SubGenre {
  id: string
  name: string
  emoji: string
  description: string
  searchQuery: string
  color: string
}

export const subGenres: SubGenre[] = [
  {
    id: "solarpunk",
    name: "Solarpunk",
    emoji: "\u{1F331}",
    description:
      "Optimistic sci-fi imagining sustainable, green futures. Think renewable cities, cooperative societies, and hopeful technology.",
    searchQuery: "solarpunk fiction",
    color: "emerald",
  },
  {
    id: "dark-academia",
    name: "Dark Academia",
    emoji: "\u{1F3DB}",
    description:
      "Gothic aesthetics meet intellectual pursuits. Secret societies, ancient libraries, classical languages, and moral ambiguity.",
    searchQuery: "dark academia fiction",
    color: "stone",
  },
  {
    id: "cozy-mystery",
    name: "Cozy Mystery",
    emoji: "\u{1F575}",
    description:
      "Light-hearted whodunits with charming settings. No graphic violence — just tea, clever sleuthing, and small-town secrets.",
    searchQuery: "cozy mystery",
    color: "amber",
  },
  {
    id: "grimdark",
    name: "Grimdark",
    emoji: "\u{2694}",
    description:
      "Morally complex fantasy where heroes are deeply flawed and the world is brutal. Gritty, violent, and unapologetically dark.",
    searchQuery: "grimdark fantasy",
    color: "slate",
  },
  {
    id: "magical-realism",
    name: "Magical Realism",
    emoji: "\u{2728}",
    description:
      "Magic woven seamlessly into the everyday world. The extraordinary feels perfectly ordinary, blurring the line between real and surreal.",
    searchQuery: "magical realism fiction",
    color: "violet",
  },
  {
    id: "afrofuturism",
    name: "Afrofuturism",
    emoji: "\u{1F30D}",
    description:
      "African culture and diaspora meet futuristic settings. Technology, tradition, and imagination collide in bold, original worlds.",
    searchQuery: "afrofuturism fiction",
    color: "orange",
  },
]

// ---------------------------------------------------------------------------
// Curated list definitions
// ---------------------------------------------------------------------------

export interface CuratedList {
  id: string
  name: string
  emoji: string
  description: string
  searchQuery: string
}

export const curatedLists: CuratedList[] = [
  {
    id: "best-recent",
    name: "Best of 2025\u201326",
    emoji: "\u{1F3C6}",
    description: "Standout novels from the past year",
    searchQuery: "best fiction 2025 2026",
  },
  {
    id: "hidden-gems",
    name: "Hidden Gems",
    emoji: "\u{1F48E}",
    description: "Under-the-radar books worth discovering",
    searchQuery: "underrated literary fiction",
  },
  {
    id: "staff-picks",
    name: "Staff Picks",
    emoji: "\u{2B50}",
    description: "Handpicked favorites across all genres",
    searchQuery: "award winning fiction novels",
  },
]

// ---------------------------------------------------------------------------
// Trending books — Open Library daily trending with search fallback
// ---------------------------------------------------------------------------

interface TrendingResponse {
  works: OpenLibraryDoc[]
}

export async function getTrendingBooks(limit = 12): Promise<Book[]> {
  try {
    const res = await fetch(
      `https://openlibrary.org/trending/daily.json?limit=${limit}`
    )
    if (!res.ok) throw new Error("trending fetch failed")

    const data: TrendingResponse = await res.json()
    if (!data.works?.length) throw new Error("no works")

    const books = data.works
      .map((w) => transformToBook(w, "fiction"))
      .filter((b): b is Book => b !== null)

    if (books.length > 0) {
      addBooksToCache(books)
      return books.slice(0, limit)
    }
    throw new Error("no valid books from trending")
  } catch {
    // Fallback: Open Library search sorted by new
    try {
      const books = await searchOpenLibrary("fiction", limit)
      return books.slice(0, limit)
    } catch {
      return []
    }
  }
}

// ---------------------------------------------------------------------------
// Author spotlight — more books by a given author
// ---------------------------------------------------------------------------

export async function getAuthorBooks(
  authorName: string,
  excludeIds: Set<string> = new Set()
): Promise<Book[]> {
  try {
    const books = await searchGoogleBooks(`inauthor:"${authorName}"`, 15)
    const filtered = books.filter((b) => !excludeIds.has(b.id))
    addBooksToCache(filtered)
    return filtered.slice(0, 10)
  } catch {
    return []
  }
}

// ---------------------------------------------------------------------------
// Surprise me — random book from an unexplored genre
// ---------------------------------------------------------------------------

export async function getSurpriseBook(
  likedBooks: Book[]
): Promise<{ book: Book; genre: string } | null> {
  // Find which genres the user has already explored
  const exploredGenres = new Set<string>()
  likedBooks.forEach((b) => b.genre.forEach((g) => exploredGenres.add(g)))

  // All available genres from the query map
  const allGenres = Object.keys(bookSearchQueries)
  const unexplored = allGenres.filter((g) => !exploredGenres.has(g))

  // If user explored everything, pick any random genre
  const pool = unexplored.length > 0 ? unexplored : allGenres
  const genre = pool[Math.floor(Math.random() * pool.length)]

  // Try cache first
  const cached = getCachedBooks()
  const likedIds = new Set(likedBooks.map((b) => b.id))
  const fromCache = cached.filter(
    (b) =>
      !likedIds.has(b.id) &&
      b.genre.some((g) => g.toLowerCase() === genre.toLowerCase())
  )

  if (fromCache.length > 0) {
    const pick = fromCache[Math.floor(Math.random() * fromCache.length)]
    return { book: pick, genre }
  }

  // Fetch fresh
  try {
    const query =
      bookSearchQueries[genre as keyof typeof bookSearchQueries] || genre
    const books = await searchGoogleBooks(query, 10)
    const valid = books.filter((b) => !likedIds.has(b.id))
    addBooksToCache(books)

    if (valid.length === 0) return null
    const pick = valid[Math.floor(Math.random() * valid.length)]
    return { book: pick, genre }
  } catch {
    return null
  }
}

// ---------------------------------------------------------------------------
// Curated list / sub-genre books — parallel Google + Open Library search
// ---------------------------------------------------------------------------

export async function getListBooks(
  searchQuery: string,
  limit = 12
): Promise<Book[]> {
  try {
    const [googleBooks, olBooks] = await Promise.allSettled([
      searchGoogleBooks(searchQuery, limit),
      searchOpenLibrary(searchQuery, limit),
    ])

    const g =
      googleBooks.status === "fulfilled" ? googleBooks.value : ([] as Book[])
    const o =
      olBooks.status === "fulfilled" ? olBooks.value : ([] as Book[])

    // Merge + dedupe by id
    const seen = new Set<string>()
    const merged: Book[] = []
    for (const book of [...g, ...o]) {
      if (!seen.has(book.id)) {
        seen.add(book.id)
        merged.push(book)
      }
    }

    addBooksToCache(merged)
    return merged.slice(0, limit)
  } catch {
    return []
  }
}
