import { GutenbergBook } from "./gutenberg-api"

export interface GutenbergBrowseResult {
  count: number
  next: string | null
  results: GutenbergBook[]
}

export const BROWSE_CATEGORIES = [
  { id: "popular", label: "Popular", emoji: "\uD83D\uDD25", topic: "" },
  { id: "fiction", label: "Fiction", emoji: "\uD83D\uDCD6", topic: "fiction" },
  { id: "scifi", label: "Sci-Fi", emoji: "\uD83D\uDE80", topic: "science fiction" },
  { id: "mystery", label: "Mystery", emoji: "\uD83D\uDD0D", topic: "mystery" },
  { id: "romance", label: "Romance", emoji: "\u2764\uFE0F", topic: "love stories" },
  { id: "horror", label: "Horror", emoji: "\uD83D\uDC80", topic: "horror" },
  { id: "fantasy", label: "Fantasy", emoji: "\uD83E\uDDD9", topic: "fantasy" },
  { id: "adventure", label: "Adventure", emoji: "\u2693", topic: "adventure stories" },
  { id: "children", label: "Children", emoji: "\uD83E\uDDF8", topic: "children" },
  { id: "drama", label: "Drama", emoji: "\uD83C\uDFAD", topic: "drama" },
  { id: "poetry", label: "Poetry", emoji: "\u270D\uFE0F", topic: "poetry" },
  { id: "philosophy", label: "Philosophy", emoji: "\uD83E\uDDD0", topic: "philosophy" },
  { id: "history", label: "History", emoji: "\uD83C\uDFDB\uFE0F", topic: "history" },
  { id: "biography", label: "Biography", emoji: "\uD83D\uDC64", topic: "biography" },
  { id: "short-stories", label: "Short Stories", emoji: "\uD83D\uDCDD", topic: "short stories" },
  { id: "humor", label: "Humor", emoji: "\uD83D\uDE02", topic: "humor" },
  { id: "fairy-tales", label: "Fairy Tales", emoji: "\uD83E\uDDDA", topic: "fairy tales" },
  { id: "science", label: "Science", emoji: "\uD83E\uDD2F", topic: "science" },
  { id: "travel", label: "Travel", emoji: "\uD83C\uDF0D", topic: "travel" },
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
