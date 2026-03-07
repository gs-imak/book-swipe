import { GutenbergBook } from "./gutenberg-api"

export interface GutenbergBrowseResult {
  count: number
  next: string | null
  results: GutenbergBook[]
}

export const BROWSE_CATEGORIES = [
  { id: "popular", label: "Popular", topic: "" },
  { id: "fiction", label: "Fiction", topic: "fiction" },
  { id: "mystery", label: "Mystery", topic: "mystery" },
  { id: "romance", label: "Romance", topic: "love stories" },
  { id: "adventure", label: "Adventure", topic: "adventure stories" },
  { id: "philosophy", label: "Philosophy", topic: "philosophy" },
  { id: "history", label: "History", topic: "history" },
  { id: "poetry", label: "Poetry", topic: "poetry" },
  { id: "science", label: "Science", topic: "science" },
] as const

export async function browseGutenberg(topic: string): Promise<GutenbergBrowseResult> {
  const params = new URLSearchParams({ languages: "en" })
  if (topic) params.set("topic", topic)
  const res = await fetch(`https://gutendex.com/books?${params.toString()}`)
  if (!res.ok) throw new Error("Failed to fetch")
  return res.json() as Promise<GutenbergBrowseResult>
}

export async function searchFreeBooks(query: string): Promise<GutenbergBrowseResult> {
  const params = new URLSearchParams({ search: query, languages: "en" })
  const res = await fetch(`https://gutendex.com/books?${params.toString()}`)
  if (!res.ok) throw new Error("Failed to search")
  return res.json() as Promise<GutenbergBrowseResult>
}

export function hasReadableText(book: GutenbergBook): boolean {
  return Object.keys(book.formats).some(k => k.startsWith("text/plain"))
}

export function getCoverUrl(book: GutenbergBook): string | null {
  return book.formats["image/jpeg"] ?? null
}
