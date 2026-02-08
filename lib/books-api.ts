import { Book } from "./book-data"
import { getCachedBooks, addBooksToCache, isQueryCached, markQueryCompleted, queryCache } from "./book-cache"
import { searchOpenLibrary } from "./openlibrary-api"

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
    imageLinks?: {
      smallThumbnail?: string
      thumbnail?: string
      small?: string
      medium?: string
      large?: string
      extraLarge?: string
    }
  }
}

export async function searchGoogleBooks(query: string, maxResults = 20): Promise<Book[]> {
  try {
    const apiKey = process.env.NEXT_PUBLIC_GOOGLE_BOOKS_API_KEY
    
    if (!apiKey) {
      console.error('❌ GOOGLE_BOOKS_API_KEY is not set! Check your .env.local file')
      return []
    }
    
    // Enhanced query with better filters for quality books with covers
    const url = `https://www.googleapis.com/books/v1/volumes?q=${encodeURIComponent(query)}&maxResults=${maxResults}&printType=books&orderBy=relevance&langRestrict=en&projection=full&key=${apiKey}`
    console.log('📚 Fetching:', query)
    
    const response = await fetch(url)
    
    if (!response.ok) {
      const errorText = await response.text()
      console.error(`❌ Google Books API Error (${response.status}):`, errorText)
      
      if (response.status === 400) {
        console.error('🔑 API KEY ISSUE: Check if Books API is enabled and key restrictions allow this request')
      } else if (response.status === 403) {
        console.error('🚫 ACCESS DENIED: Check API key restrictions or quota limits')
      }
      
      return []
    }
    
    const data = await response.json()
    
    if (!data.items) {
      console.warn(`⚠️ No books found for query: ${query}`)
      return []
    }
    
    console.log(`✅ Found ${data.items.length} books for: ${query}`)
    return data.items.map(transformGoogleBookToBook).filter(Boolean)
  } catch (error) {
    console.error('💥 Error fetching books:', error)
    return []
  }
}

function transformGoogleBookToBook(googleBook: GoogleBook): Book | null {
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
    if (!imageLinks) return 'https://via.placeholder.com/400x600?text=No+Cover'
    
    // Try in order of quality: extraLarge > large > medium > small > thumbnail
    const coverUrl = imageLinks.extraLarge || 
                     imageLinks.large || 
                     imageLinks.medium || 
                     imageLinks.small || 
                     imageLinks.thumbnail || 
                     imageLinks.smallThumbnail
    
    if (!coverUrl) return 'https://via.placeholder.com/400x600?text=No+Cover'
    
    // Ensure HTTPS and optimize for best quality
    let optimizedUrl = coverUrl
      .replace('http:', 'https:')
      .replace(/&edge=curl/g, '') // Remove curl edge effect
    
    // If it's a Google Books image, try to get larger size
    if (optimizedUrl.includes('books.google.com') || optimizedUrl.includes('books.googleusercontent.com')) {
      // Replace zoom levels to get highest quality
      optimizedUrl = optimizedUrl.replace(/zoom=\d+/g, 'zoom=0')
      // If no zoom parameter exists, add it
      if (!optimizedUrl.includes('zoom=')) {
        optimizedUrl += optimizedUrl.includes('?') ? '&zoom=0' : '?zoom=0'
      }
    }
    
    return optimizedUrl
  }
  
  return {
    id: googleBook.id,
    title: volumeInfo.title,
    author: volumeInfo.authors[0],
    cover: getBestCoverImage(volumeInfo.imageLinks),
    rating: Math.round(rating * 10) / 10,
    pages,
    genre: volumeInfo.categories || ['General'],
    mood: mapCategoriesToMoods(volumeInfo.categories || []),
    description: volumeInfo.description?.replace(/<[^>]*>/g, '').slice(0, 200) + '...' ||
                'No description available.',
    publishedYear,
    readingTime: estimateReadingTime(pages),
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
      console.error(`Error fetching ${category} books:`, error)
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
