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

function getGutenbergLang(): string {
  if (typeof window === "undefined") return "en"
  const lang = localStorage.getItem("bookswipe_language") || "en"
  return lang === "all" ? "" : lang
}

// Two-layer cache: localStorage (survives navigation) + in-memory (instant)
const _memCache = new Map<string, { data: GutenbergBrowseResult; ts: number }>()
const CACHE_TTL = 30 * 60 * 1000 // 30 minutes
const LS_PREFIX = "gutenberg_cache_"

function getCachedResult(key: string): GutenbergBrowseResult | null {
  // Check memory first
  const mem = _memCache.get(key)
  if (mem && Date.now() - mem.ts < CACHE_TTL) return mem.data

  // Check localStorage
  if (typeof window === "undefined") return null
  try {
    const stored = localStorage.getItem(LS_PREFIX + key)
    if (!stored) return null
    const parsed = JSON.parse(stored) as { data: GutenbergBrowseResult; ts: number }
    if (Date.now() - parsed.ts < CACHE_TTL) {
      _memCache.set(key, parsed) // promote to memory
      return parsed.data
    }
  } catch { /* ignore */ }
  return null
}

function setCachedResult(key: string, data: GutenbergBrowseResult): void {
  const entry = { data, ts: Date.now() }
  _memCache.set(key, entry)
  try {
    localStorage.setItem(LS_PREFIX + key, JSON.stringify(entry))
  } catch { /* quota exceeded — memory cache still works */ }
}

async function cachedFetch(url: string): Promise<GutenbergBrowseResult> {
  const cacheKey = url.replace("https://gutendex.com/books?", "")
  const cached = getCachedResult(cacheKey)
  if (cached) return cached

  const res = await fetch(url)
  if (!res.ok) throw new Error("Failed to fetch")
  const data = await res.json() as GutenbergBrowseResult
  setCachedResult(cacheKey, data)
  return data
}

export async function browseGutenberg(topic: string): Promise<GutenbergBrowseResult> {
  const lang = getGutenbergLang()
  const params = new URLSearchParams(lang ? { languages: lang } : {})
  if (topic) params.set("topic", topic)
  return cachedFetch(`https://gutendex.com/books?${params.toString()}`)
}

export async function searchFreeBooks(query: string): Promise<GutenbergBrowseResult> {
  const lang = getGutenbergLang()
  const params = new URLSearchParams(lang ? { search: query, languages: lang } : { search: query })
  return cachedFetch(`https://gutendex.com/books?${params.toString()}`)
}

export function hasReadableText(book: GutenbergBook): boolean {
  return Object.keys(book.formats).some(k => k.startsWith("text/plain"))
}

export function getCoverUrl(book: GutenbergBook): string | null {
  return book.formats["image/jpeg"] ?? null
}
