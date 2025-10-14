import { Book } from "./book-data"

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
      thumbnail?: string
      smallThumbnail?: string
    }
  }
}

export async function searchGoogleBooks(query: string, maxResults = 20): Promise<Book[]> {
  try {
    const response = await fetch(
      `https://www.googleapis.com/books/v1/volumes?q=${encodeURIComponent(query)}&maxResults=${maxResults}&printType=books&projection=full`
    )
    
    if (!response.ok) {
      throw new Error('Failed to fetch books')
    }
    
    const data = await response.json()
    
    if (!data.items) {
      return []
    }
    
    return data.items.map(transformGoogleBookToBook).filter(Boolean)
  } catch (error) {
    console.error('Error fetching books:', error)
    return []
  }
}

function transformGoogleBookToBook(googleBook: GoogleBook): Book | null {
  const { volumeInfo } = googleBook
  
  if (!volumeInfo.title || !volumeInfo.authors?.[0]) {
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
  
  return {
    id: googleBook.id,
    title: volumeInfo.title,
    author: volumeInfo.authors[0],
    cover: volumeInfo.imageLinks?.thumbnail?.replace('http:', 'https:') || 
           'https://via.placeholder.com/300x450?text=No+Cover',
    rating: Math.round(rating * 10) / 10,
    pages,
    genre: volumeInfo.categories || ['General'],
    mood: mapCategoriesToMoods(volumeInfo.categories || []),
    description: volumeInfo.description?.replace(/<[^>]*>/g, '').slice(0, 200) + '...' || 
                'No description available.',
    publishedYear,
    readingTime: estimateReadingTime(pages)
  }
}

// Predefined search queries for different genres/moods
export const bookSearchQueries = {
  fiction: 'subject:fiction+inauthor:bestseller',
  mystery: 'subject:mystery+subject:thriller',
  romance: 'subject:romance+subject:fiction',
  fantasy: 'subject:fantasy+subject:fiction',
  scifi: 'subject:"science fiction"',
  biography: 'subject:biography+subject:autobiography',
  selfhelp: 'subject:"self help"+subject:psychology',
  philosophy: 'subject:philosophy+subject:wisdom',
  history: 'subject:history+subject:historical',
  humor: 'subject:humor+subject:comedy',
  popular: 'orderBy=relevance+bestsellers',
  recent: 'orderBy=newest+publishedDate>2020'
}

// Function to get books by category
export async function getBooksByCategory(category: string, count = 10): Promise<Book[]> {
  const query = bookSearchQueries[category as keyof typeof bookSearchQueries] || category
  return searchGoogleBooks(query, count)
}

// Function to get mixed recommendations
export async function getMixedRecommendations(count = 50): Promise<Book[]> {
  const categories = Object.keys(bookSearchQueries)
  const booksPerCategory = Math.ceil(count / categories.length)
  
  const allBooks: Book[] = []
  
  for (const category of categories) {
    try {
      const books = await getBooksByCategory(category, booksPerCategory)
      allBooks.push(...books)
    } catch (error) {
      console.error(`Error fetching ${category} books:`, error)
    }
  }
  
  // Shuffle and return requested count
  return allBooks
    .sort(() => Math.random() - 0.5)
    .slice(0, count)
}


