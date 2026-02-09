import { Book } from "./book-data"

interface OpenLibraryDoc {
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
  return `https://covers.openlibrary.org/b/id/${coverId}-${size}.jpg`
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

function transformToBook(doc: OpenLibraryDoc, searchedSubject: string): Book | null {
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
  if (rating < 2.5 && doc.ratings_count && doc.ratings_count > 10) return null

  return {
    id: `ol_${doc.key.replace("/works/", "")}`,
    title: doc.title,
    author: doc.author_name[0],
    cover: getOpenLibraryCover(doc.cover_i),
    rating: rating || Math.round((Math.random() * 1.5 + 3.5) * 10) / 10,
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
      "ratings_average",
      "readinglog_count",
      "want_to_read_count",
      "ratings_count",
      "number_of_pages_median",
      "first_publish_year",
    ].join(",")

    const url = `https://openlibrary.org/search.json?subject=${encodeURIComponent(
      subject
    )}&fields=${fields}&limit=${limit}&sort=rating`

    const response = await fetch(url)
    if (!response.ok) return []

    const data: OpenLibrarySearchResponse = await response.json()
    if (!data.docs) return []

    return data.docs
      .map((doc) => transformToBook(doc, subject))
      .filter((b): b is Book => b !== null)
  } catch (error) {
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
