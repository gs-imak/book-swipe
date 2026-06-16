import { Book } from "./book-data"
import { getOpenLibraryLanguageCodes } from "./language-preference"
import { toIsbn10 } from "./isbn"
import { amazonCoverUrl } from "./covers"

// Background OL cover-upgrade tuning (single consumer: upgradeOpenLibraryCovers).
const EDITION_FETCH_TIMEOUT_MS = 4000
const EDITION_FETCH_CONCURRENCY = 6

// Deterministic pseudo-rating from a string (always returns the same value for the same input)
function stableRating(seed: string, min = 3.5, max = 4.5): number {
  let hash = 0
  for (let i = 0; i < seed.length; i++) {
    hash = ((hash << 5) - hash + seed.charCodeAt(i)) | 0
  }
  const norm = (Math.abs(hash) % 1000) / 1000 // 0..1
  return Math.round((min + norm * (max - min)) * 10) / 10
}

export interface OpenLibraryDoc {
  key: string
  title: string
  author_name?: string[]
  subject?: string[]
  cover_i?: number
  ratings_average?: number
  readinglog_count?: number
  want_to_read_count?: number
  ratings_count?: number
  number_of_pages_median?: number
  first_publish_year?: number
  language?: string[]
  cover_edition_key?: string
}

interface OpenLibrarySearchResponse {
  numFound: number
  docs: OpenLibraryDoc[]
}

const SUBJECT_TO_GENRE: Record<string, string> = {
  fantasy: "Fantasy",
  "science fiction": "Science Fiction",
  "sci-fi": "Science Fiction",
  mystery: "Mystery",
  detective: "Mystery",
  romance: "Romance",
  "love stories": "Romance",
  thriller: "Thriller",
  thrillers: "Thriller",
  suspense: "Thriller",
  crime: "Thriller",
  "historical fiction": "Historical Fiction",
  biography: "Biography",
  autobiographies: "Biography",
  memoir: "Biography",
  "self-help": "Self-Help",
  "personal development": "Self-Help",
  philosophy: "Philosophy",
  horror: "Horror",
  humor: "Comedy",
  humour: "Comedy",
  satire: "Comedy",
  "young adult": "Young Adult",
  poetry: "Poetry",
  adventure: "Adventure",
  classics: "Classics",
  dystopian: "Science Fiction",
  "literary fiction": "Contemporary Fiction",
  contemporary: "Contemporary Fiction",
  lgbtq: "LGBTQ+",
  queer: "LGBTQ+",
}

const SUBJECT_TO_MOOD: Record<string, string[]> = {
  fantasy: ["Magical", "Epic"],
  "science fiction": ["Thought-provoking", "Epic"],
  mystery: ["Suspenseful", "Clever"],
  romance: ["Romantic", "Emotional"],
  thriller: ["Suspenseful", "Dark"],
  horror: ["Dark", "Thrilling"],
  biography: ["Inspiring", "Educational"],
  "self-help": ["Motivational", "Practical"],
  philosophy: ["Philosophical", "Thought-provoking"],
  humor: ["Light-hearted", "Funny"],
  poetry: ["Beautiful", "Contemplative"],
  adventure: ["Epic", "Thrilling"],
  "historical fiction": ["Immersive", "Engaging"],
  dystopian: ["Dark", "Thought-provoking"],
  "coming of age": ["Emotional", "Inspiring"],
  "love stories": ["Romantic", "Heartwarming"],
  suspense: ["Suspenseful", "Gripping"],
  war: ["Powerful", "Dark"],
  magic: ["Magical", "Escapist"],
  friendship: ["Heartwarming", "Emotional"],
}

function getOpenLibraryCover(coverId: number, size: "S" | "M" | "L" = "L"): string {
  // Prefer the large (-L) size for crisp, premium-looking covers.
  // default=false returns 404 instead of a placeholder "image not available" image.
  return `https://covers.openlibrary.org/b/id/${coverId}-${size}.jpg?default=false`
}

function mapSubjectsToGenres(subjects: string[]): string[] {
  const genres = new Set<string>()
  for (const subject of subjects) {
    const lower = subject.toLowerCase()
    for (const [key, genre] of Object.entries(SUBJECT_TO_GENRE)) {
      if (lower.includes(key)) {
        genres.add(genre)
        break
      }
    }
  }
  return Array.from(genres).slice(0, 4)
}

function mapSubjectsToMoods(subjects: string[]): string[] {
  const moods = new Set<string>()
  for (const subject of subjects) {
    const lower = subject.toLowerCase()
    for (const [key, moodList] of Object.entries(SUBJECT_TO_MOOD)) {
      if (lower.includes(key)) {
        moodList.forEach((m) => moods.add(m))
      }
    }
  }
  return Array.from(moods).slice(0, 3)
}

function estimateReadingTime(pages: number): string {
  const hours = Math.ceil((pages * 250) / 250 / 60)
  if (hours < 1) return "< 1 hour"
  if (hours < 2) return "1-2 hours"
  if (hours < 4) return "2-4 hours"
  if (hours < 6) return "4-6 hours"
  if (hours < 8) return "6-8 hours"
  if (hours < 12) return "8-12 hours"
  return "12+ hours"
}

export function transformToBook(doc: OpenLibraryDoc, searchedSubject: string): Book | null {
  if (!doc.title || !doc.author_name?.[0] || !doc.cover_i) return null

  const subjects = doc.subject || []
  const pages = doc.number_of_pages_median || 250
  const genres = mapSubjectsToGenres(subjects)
  if (genres.length === 0) {
    const mapped = SUBJECT_TO_GENRE[searchedSubject.toLowerCase()]
    if (mapped) genres.push(mapped)
    else genres.push("General")
  }

  const moods = mapSubjectsToMoods(subjects)
  if (moods.length === 0) moods.push("Interesting")

  const rating = doc.ratings_average
    ? Math.round(doc.ratings_average * 10) / 10
    : 0

  // Skip books with very low or no ratings
  if (rating < 2.5 && doc.ratings_count && doc.ratings_count >= 10) return null

  return {
    id: `ol_${doc.key.replace("/works/", "")}`,
    title: doc.title,
    author: doc.author_name[0],
    cover: getOpenLibraryCover(doc.cover_i),
    rating: rating || stableRating(`${doc.title}:${doc.author_name[0]}`),
    pages,
    genre: genres,
    mood: moods,
    description: "Discover this book on your reading journey.",
    publishedYear: doc.first_publish_year || 2020,
    readingTime: estimateReadingTime(pages),
    metadata: {
      subjects: subjects.slice(0, 20),
      readinglogCount: doc.readinglog_count,
      wantToReadCount: doc.want_to_read_count,
      ratingsCount: doc.ratings_count,
      source: "openlibrary",
      coverEditionKey: doc.cover_edition_key,
    },
  }
}

export async function searchOpenLibrary(
  subject: string,
  limit: number = 20
): Promise<Book[]> {
  try {
    const fields = [
      "key",
      "title",
      "author_name",
      "subject",
      "cover_i",
      "cover_edition_key",
      "ratings_average",
      "readinglog_count",
      "want_to_read_count",
      "ratings_count",
      "number_of_pages_median",
      "first_publish_year",
      "language",
    ].join(",")

    const olLangCodes = getOpenLibraryLanguageCodes()
    // Fetch extra to compensate for language filtering
    const fetchLimit = olLangCodes ? limit * 2 : limit

    const url = `https://openlibrary.org/search.json?subject=${encodeURIComponent(
      subject
    )}&fields=${fields}&limit=${fetchLimit}&sort=rating`

    const response = await fetch(url)
    if (!response.ok) return []

    const data: OpenLibrarySearchResponse = await response.json()
    if (!data.docs) return []

    let docs = data.docs
    // Post-filter by language: keep matches or books with no language data
    if (olLangCodes) {
      docs = docs.filter((doc) => {
        if (!doc.language || doc.language.length === 0) return true
        return doc.language.some((l) => olLangCodes.includes(l))
      })
    }

    return docs
      .map((doc) => transformToBook(doc, subject))
      .filter((b): b is Book => b !== null)
      .slice(0, limit)
  } catch (error) {
    return []
  }
}

/** General free-text search (uses `q=` instead of `subject=`). */
export async function searchOpenLibraryByQuery(
  query: string,
  limit: number = 20
): Promise<Book[]> {
  try {
    const fields = [
      "key",
      "title",
      "author_name",
      "subject",
      "cover_i",
      "cover_edition_key",
      "ratings_average",
      "readinglog_count",
      "want_to_read_count",
      "ratings_count",
      "number_of_pages_median",
      "first_publish_year",
      "language",
    ].join(",")

    const olLangCodes = getOpenLibraryLanguageCodes()
    const fetchLimit = olLangCodes ? limit * 2 : limit

    const url = `https://openlibrary.org/search.json?q=${encodeURIComponent(
      query
    )}&fields=${fields}&limit=${fetchLimit}&sort=rating`

    const response = await fetch(url)
    if (!response.ok) return []

    const data: OpenLibrarySearchResponse = await response.json()
    if (!data.docs) return []

    let docs = data.docs
    if (olLangCodes) {
      docs = docs.filter((doc) => {
        if (!doc.language || doc.language.length === 0) return true
        return doc.language.some((l) => olLangCodes.includes(l))
      })
    }

    return docs
      .map((doc) => transformToBook(doc, query))
      .filter((b): b is Book => b !== null)
      .slice(0, limit)
  } catch {
    return []
  }
}

/** Fetch curated books from OL's /subjects/{slug}.json endpoint. */
export async function fetchSubjectBooks(
  slug: string,
  limit: number = 12
): Promise<Book[]> {
  try {
    const url = `https://openlibrary.org/subjects/${slug}.json?limit=${limit}`
    const response = await fetch(url)
    if (!response.ok) return []

    const data = await response.json()
    const works: Array<{
      key: string
      title: string
      authors?: { key: string; name: string }[]
      cover_id?: number
      subject?: string[]
      first_publish_year?: number
      edition_count?: number
    }> = data.works || []

    return works
      .filter((w) => w.title && w.authors?.length && w.cover_id)
      .map((w) => {
        const subjects = w.subject || []
        const genres = mapSubjectsToGenres(subjects)
        if (genres.length === 0) genres.push("Classics")

        const moods = mapSubjectsToMoods(subjects)
        if (moods.length === 0) moods.push("Interesting")

        const pages = 300 // subjects endpoint lacks page count
        return {
          id: `ol_${w.key.replace("/works/", "")}`,
          title: w.title,
          author: w.authors![0].name,
          cover: getOpenLibraryCover(w.cover_id!),
          rating: stableRating(`${w.title}:${w.authors![0].name}`, 3.8, 4.8),
          pages,
          genre: genres,
          mood: moods,
          description: "Discover this book on your reading journey.",
          publishedYear: w.first_publish_year || 2000,
          readingTime: estimateReadingTime(pages),
          metadata: {
            subjects: subjects.slice(0, 20),
            source: "openlibrary" as const,
          },
        } satisfies Book
      })
      .slice(0, limit)
  } catch {
    return []
  }
}

export async function getRelatedSubjects(
  subject: string
): Promise<string[]> {
  try {
    const slug = subject.toLowerCase().replace(/ /g, "_")
    const url = `https://openlibrary.org/subjects/${slug}.json?details=true&limit=1`
    const response = await fetch(url)
    if (!response.ok) return []

    const data = await response.json()
    const related: { name: string; count: number }[] = data.subjects || []
    return related
      .sort((a, b) => b.count - a.count)
      .slice(0, 10)
      .map((s) => s.name)
  } catch {
    return []
  }
}

// ── Background cover upgrade: OL books → Goodreads-grade Amazon covers ────────
// OL search is work-level and aggregates ~hundreds of edition ISBNs, so picking
// an arbitrary one shows the wrong edition's cover (e.g. a foreign translation).
// We instead resolve the ISBN of the *cover edition* (cover_edition_key) — the
// edition the displayed OL cover belongs to — so the Amazon cover matches.

/**
 * Pure: build the Amazon cover URL for an OL edition record from its correct
 * ISBN-10, or null when none is derivable. Exported for testing.
 */
export function amazonCoverFromEdition(edition: {
  isbn_13?: string[]
  isbn_10?: string[]
}): string | null {
  const raw = edition.isbn_13?.[0] ?? edition.isbn_10?.[0]
  const isbn10 = toIsbn10(raw)
  return isbn10 ? amazonCoverUrl(isbn10) : null
}

// Resolved OLID -> Amazon cover (or null). Persists for the session so we never
// re-fetch the same edition across deck batches.
const _editionCoverCache = new Map<string, string | null>()

/** Fetch one OL edition and resolve its correct-edition Amazon cover URL. */
async function resolveEditionCover(coverEditionKey: string): Promise<string | null> {
  const cached = _editionCoverCache.get(coverEditionKey)
  if (cached !== undefined) return cached

  const controller = new AbortController()
  const timeout = setTimeout(() => controller.abort(), EDITION_FETCH_TIMEOUT_MS)
  try {
    const res = await fetch(`https://openlibrary.org/books/${coverEditionKey}.json`, {
      signal: controller.signal,
    })
    if (!res.ok) {
      _editionCoverCache.set(coverEditionKey, null)
      return null
    }
    const data = await res.json()
    const cover = amazonCoverFromEdition(data)
    _editionCoverCache.set(coverEditionKey, cover)
    return cover
  } catch {
    // Transient (timeout/network) — don't cache so a later batch can retry.
    return null
  } finally {
    clearTimeout(timeout)
  }
}

/**
 * Background pass: upgrade OL-sourced books to the Goodreads-grade Amazon cover
 * of their cover edition, keeping the OL -L image as the fallback. Returns only
 * the books whose cover changed. Reliable + bounded + cached (OL's own edition
 * API, a small concurrency cap, an OLID->cover cache) — and if Amazon has no
 * image for an edition, <BookCover> detects the 1x1 gif and falls back to OL -L.
 */
export async function upgradeOpenLibraryCovers(books: Book[]): Promise<Book[]> {
  const pending = books.filter(
    (b) =>
      b.metadata?.source === "openlibrary" &&
      b.metadata.coverEditionKey &&
      !b.cover.includes("media-amazon")
  )
  if (pending.length === 0) return []

  const changed: Book[] = []
  for (let i = 0; i < pending.length; i += EDITION_FETCH_CONCURRENCY) {
    const batch = pending.slice(i, i + EDITION_FETCH_CONCURRENCY)
    const covers = await Promise.allSettled(
      batch.map((b) => resolveEditionCover(b.metadata!.coverEditionKey!))
    )
    covers.forEach((r, j) => {
      if (r.status === "fulfilled" && r.value) {
        const book = batch[j]
        changed.push({ ...book, cover: r.value, coverFallback: book.cover })
      }
    })
  }
  return changed
}
