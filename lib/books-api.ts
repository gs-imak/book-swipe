import { Book } from "./book-data"
import { getCachedBooks, addBooksToCache, isQueryCached, markQueryCompleted, queryCache } from "./book-cache"
import { searchOpenLibrary } from "./openlibrary-api"

// Strip HTML tags from API descriptions and truncate safely
function sanitizeDescription(raw?: string): string {
  if (!raw) return "No description available."
  // Remove all HTML tags, then decode common entities
  const text = raw
    .replace(/<[^>]*>/g, "")
    .replace(/&amp;/g, "&")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/&nbsp;/g, " ")
    .trim()
  if (!text) return "No description available."
  return text.length > 200 ? text.slice(0, 200) + "..." : text
}

// Google Books API integration
export interface GoogleBook {
  id: string
  volumeInfo: {
    title: string
    authors?: string[]
    description?: string
    pageCount?: number
    publishedDate?: string
    averageRating?: number
    categories?: string[]
    industryIdentifiers?: { type: string; identifier: string }[]
    imageLinks?: {
      smallThumbnail?: string
      thumbnail?: string
      small?: string
      medium?: string
      large?: string
      extraLarge?: string
    }
  }
  saleInfo?: {
    saleability?: string
    isEbook?: boolean
  }
  accessInfo?: {
    epub?: { isAvailable?: boolean }
    pdf?: { isAvailable?: boolean }
  }
}

export async function searchGoogleBooks(query: string, maxResults = 20): Promise<Book[]> {
  try {
    // Call our own API route (keeps API key server-side)
    const url = `/api/books?q=${encodeURIComponent(query)}&maxResults=${maxResults}`

    const response = await fetch(url)

    if (!response.ok) {
      return []
    }

    const data = await response.json()

    if (!data.items || !Array.isArray(data.items)) {
      return []
    }

    return data.items.map(transformGoogleBookToBook).filter(Boolean)
  } catch {
    return []
  }
}

// Validate that an API response item has the expected shape
function isValidGoogleBook(item: unknown): item is GoogleBook {
  if (typeof item !== "object" || item === null) return false
  const obj = item as Record<string, unknown>
  if (typeof obj.id !== "string") return false
  if (typeof obj.volumeInfo !== "object" || obj.volumeInfo === null) return false
  return true
}

function transformGoogleBookToBook(googleBook: unknown): Book | null {
  if (!isValidGoogleBook(googleBook)) return null
  const { volumeInfo } = googleBook

  // Filter out books without proper data or cover images
  if (!volumeInfo.title || !volumeInfo.authors?.[0] || !volumeInfo.imageLinks) {
    return null
  }
  
  // Estimate reading time based on page count
  const estimateReadingTime = (pages: number): string => {
    const wordsPerPage = 250
    const wordsPerMinute = 250
    const totalWords = pages * wordsPerPage
    const minutes = totalWords / wordsPerMinute
    const hours = Math.ceil(minutes / 60)
    
    if (hours < 1) return "< 1 hour"
    if (hours < 2) return "1-2 hours"
    if (hours < 4) return "2-4 hours"
    if (hours < 6) return "4-6 hours"
    if (hours < 8) return "6-8 hours"
    if (hours < 12) return "8-12 hours"
    return "12+ hours"
  }
  
  // Map categories to our mood system
  const mapCategoriesToMoods = (categories: string[]): string[] => {
    const moodMap: Record<string, string[]> = {
      'Fiction': ['Escapist', 'Emotional'],
      'Romance': ['Romantic', 'Emotional'],
      'Mystery': ['Suspenseful', 'Clever'],
      'Science Fiction': ['Thought-provoking', 'Epic'],
      'Fantasy': ['Magical', 'Epic'],
      'Thriller': ['Suspenseful', 'Dark'],
      'Horror': ['Dark', 'Thrilling'],
      'Biography': ['Inspiring', 'Educational'],
      'Self-Help': ['Motivational', 'Practical'],
      'Philosophy': ['Philosophical', 'Thought-provoking'],
      'History': ['Educational', 'Engaging'],
      'Humor': ['Light-hearted', 'Funny'],
      'Poetry': ['Beautiful', 'Contemplative']
    }
    
    const moods = new Set<string>()
    categories.forEach(category => {
      const categoryMoods = moodMap[category] || ['Interesting']
      categoryMoods.forEach(mood => moods.add(mood))
    })
    
    return Array.from(moods).slice(0, 3) // Limit to 3 moods
  }
  
  const pages = volumeInfo.pageCount || 200
  const rating = volumeInfo.averageRating || Math.random() * 2 + 3 // Random rating between 3-5 if none
  const publishedYear = volumeInfo.publishedDate ? 
    parseInt(volumeInfo.publishedDate.split('-')[0]) : 2020
  
  // Get the best quality image available, with fallback chain
  const getBestCoverImage = (imageLinks?: GoogleBook['volumeInfo']['imageLinks']): string => {
    if (!imageLinks) return ''

    // Try in order of quality: extraLarge > large > medium > small > thumbnail
    const coverUrl = imageLinks.extraLarge ||
                     imageLinks.large ||
                     imageLinks.medium ||
                     imageLinks.small ||
                     imageLinks.thumbnail ||
                     imageLinks.smallThumbnail

    if (!coverUrl) return ''

    // Ensure HTTPS and clean up the URL
    let optimizedUrl = coverUrl
      .replace('http:', 'https:')
      .replace(/&edge=curl/g, '') // Remove curl edge effect

    // If it's a Google Books image, request best available size
    if (optimizedUrl.includes('books.google.com') || optimizedUrl.includes('books.googleusercontent.com')) {
      // zoom=0 returns full resolution, zoom=1 is ~128px (too small)
      optimizedUrl = optimizedUrl.replace(/zoom=\d+/g, 'zoom=0')
      if (!optimizedUrl.includes('zoom=')) {
        optimizedUrl += optimizedUrl.includes('?') ? '&zoom=0' : '?zoom=0'
      }
    }

    return optimizedUrl
  }
  
  // Try to get a curated cover from Open Library via ISBN (better for classics)
  const isbn = volumeInfo.industryIdentifiers?.find(id => id.type === 'ISBN_13')?.identifier ||
               volumeInfo.industryIdentifiers?.find(id => id.type === 'ISBN_10')?.identifier
  const olIsbnCover = isbn
    ? `https://covers.openlibrary.org/b/isbn/${isbn}-L.jpg?default=false`
    : ''
  const googleCover = getBestCoverImage(volumeInfo.imageLinks)

  // Detect formats
  const isEbook = googleBook.saleInfo?.isEbook ||
                  googleBook.accessInfo?.epub?.isAvailable ||
                  googleBook.accessInfo?.pdf?.isAvailable || false
  const formats = {
    ebook: isEbook,
    audiobook: false, // Google Books API doesn't indicate audiobook availability
    paperback: !isEbook || (googleBook.saleInfo?.saleability === 'FOR_SALE'),
  }

  return {
    id: googleBook.id,
    title: volumeInfo.title,
    author: volumeInfo.authors[0],
    // Prefer OL ISBN cover (better curated), fall back to Google Books cover
    cover: olIsbnCover || googleCover,
    coverFallback: olIsbnCover ? googleCover : undefined,
    rating: Math.round(rating * 10) / 10,
    pages,
    genre: volumeInfo.categories || ['General'],
    mood: mapCategoriesToMoods(volumeInfo.categories || []),
    description: sanitizeDescription(volumeInfo.description),
    publishedYear,
    readingTime: estimateReadingTime(pages),
    isbn: isbn || undefined,
    formats,
    metadata: {
      source: 'google' as const,
    }
  }
}

// Predefined search queries for different genres/moods (matching questionnaire options EXACTLY)
export const bookSearchQueries = {
  'Fantasy': 'subject:fantasy',
  'Science Fiction': 'subject:"science fiction"',
  'Mystery': 'subject:mystery',
  'Romance': 'subject:romance',
  'Thriller': 'subject:thriller',
  'Contemporary Fiction': 'subject:fiction+bestseller',
  'Historical Fiction': 'subject:"historical fiction"',
  'Biography': 'subject:biography',
  'Self-Help': 'subject:"self help"',
  'Philosophy': 'subject:philosophy',
  'Horror': 'subject:horror',
  'Comedy': 'subject:humor',
  'LGBTQ+': 'subject:lgbtq',
  // Additional genres
  'Adventure': 'subject:adventure',
  'Young Adult': 'subject:"young adult"',
  'Classics': 'subject:classics',
  'Poetry': 'subject:poetry'
}

// Function to get books by category - merges searched genre with Google's categories
export async function getBooksByCategory(category: string, count = 10): Promise<Book[]> {
  const query = bookSearchQueries[category as keyof typeof bookSearchQueries] || category
  // Request more books than needed since we filter out books without covers
  const books = await searchGoogleBooks(query, Math.min(count * 2, 40))

  // Merge searched genre with Google's existing categories (don't overwrite)
  const taggedBooks = books.map(book => ({
    ...book,
    genre: book.genre[0] === 'General'
      ? [category]
      : Array.from(new Set([category, ...book.genre]))
  }))

  return taggedBooks.slice(0, count)
}

// Function to get mixed recommendations -- parallel fetching with cache
export async function getMixedRecommendations(count = 50): Promise<Book[]> {
  // Check cache first
  const cached = getCachedBooks()
  const allCached = cached.length >= count &&
    Object.keys(bookSearchQueries).every(q => isQueryCached(q))

  if (allCached) {
    return cached.sort(() => Math.random() - 0.5).slice(0, count)
  }

  const categories = Object.keys(bookSearchQueries)
  const booksPerCategory = Math.ceil(count / categories.length)

  // Fetch all categories in PARALLEL
  const fetchPromises = categories.map(async (category) => {
    if (isQueryCached(category)) {
      return queryCache(book => book.genre.some(g => g === category)).slice(0, booksPerCategory)
    }
    try {
      const books = await getBooksByCategory(category, booksPerCategory)
      addBooksToCache(books)
      markQueryCompleted(category)
      return books
    } catch (error) {
      return []
    }
  })

  const results = await Promise.allSettled(fetchPromises)
  const allBooks = results
    .filter((r): r is PromiseFulfilledResult<Book[]> => r.status === 'fulfilled')
    .flatMap(r => r.value)

  // Also fetch from Open Library for richer data (top 3 genres only to limit requests)
  try {
    const olGenres = categories.slice(0, 3)
    const olPromises = olGenres.map(g => searchOpenLibrary(g, 5))
    const olResults = await Promise.allSettled(olPromises)
    const olBooks = olResults
      .filter((r): r is PromiseFulfilledResult<Book[]> => r.status === 'fulfilled')
      .flatMap(r => r.value)
    if (olBooks.length > 0) {
      addBooksToCache(olBooks)
      allBooks.push(...olBooks)
    }
  } catch {
    // Open Library is supplementary, don't fail if it errors
  }

  return allBooks
    .sort(() => Math.random() - 0.5)
    .slice(0, count)
}

// Fetch books specifically related to user's liked books
export async function fetchPersonalizedBooks(likedBooks: Book[]): Promise<Book[]> {
  if (likedBooks.length === 0) return []

  // Extract top genres and authors from liked books
  const genreCounts: Record<string, number> = {}
  const authorCounts: Record<string, number> = {}

  likedBooks.forEach(book => {
    book.genre.forEach(g => { genreCounts[g] = (genreCounts[g] || 0) + 1 })
    authorCounts[book.author] = (authorCounts[book.author] || 0) + 1
  })

  const topGenres = Object.entries(genreCounts)
    .sort((a, b) => b[1] - a[1])
    .slice(0, 3)
    .map(([genre]) => genre)

  const topAuthors = Object.entries(authorCounts)
    .sort((a, b) => b[1] - a[1])
    .slice(0, 2)
    .map(([author]) => author)

  // Fetch in parallel: Google genre + Google author + Open Library genre
  const promises: Promise<Book[]>[] = [
    ...topGenres.map(g => getBooksByCategory(g, 8)),
    ...topAuthors.map(a => searchGoogleBooks(`inauthor:"${a}"`, 8)),
    ...topGenres.slice(0, 2).map(g => searchOpenLibrary(g, 8)),
  ]

  const results = await Promise.allSettled(promises)
  const books = results
    .filter((r): r is PromiseFulfilledResult<Book[]> => r.status === 'fulfilled')
    .flatMap(r => r.value)

  addBooksToCache(books)
  return books
}
