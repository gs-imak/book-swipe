"use client"

import { useState } from "react"
import { Button } from "@/components/ui/button"
import { getMixedRecommendations, getBooksByCategory, bookSearchQueries } from "@/lib/books-api"
import { Book } from "@/lib/book-data"
import { Download, RefreshCw, Database, Globe } from "lucide-react"

interface AdminPanelProps {
  onBooksLoaded: (books: Book[]) => void
}

export function AdminPanel({ onBooksLoaded }: AdminPanelProps) {
  const [loading, setLoading] = useState(false)
  const [apiBooks, setApiBooks] = useState<Book[]>([])

  const loadMixedBooks = async () => {
    setLoading(true)
    try {
      const books = await getMixedRecommendations(30)
      setApiBooks(books)
      console.log('Loaded books:', books)
    } catch (error) {
      console.error('Error loading mixed books:', error)
    } finally {
      setLoading(false)
    }
  }

  const loadByCategory = async (category: string) => {
    setLoading(true)
    try {
      const books = await getBooksByCategory(category, 15)
      setApiBooks(books)
      console.log(`Loaded ${category} books:`, books)
    } catch (error) {
      console.error(`Error loading ${category} books:`, error)
    } finally {
      setLoading(false)
    }
  }

  const exportToBookData = () => {
    if (apiBooks.length === 0) return
    
    const exportData = `// Auto-generated books from Google Books API
export const apiBooks: Book[] = ${JSON.stringify(apiBooks, null, 2)}

// To use these books, import and spread them into your sampleBooks array:
// export const sampleBooks: Book[] = [...existingBooks, ...apiBooks]`

    const blob = new Blob([exportData], { type: 'text/typescript' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = 'api-books.ts'
    a.click()
    URL.revokeObjectURL(url)
  }

  return (
    <div className="bg-white rounded-2xl p-6 shadow-lg">
      <div className="mb-6">
        <h3 className="text-xl font-bold mb-2 flex items-center gap-2">
          <Database className="w-5 h-5" />
          Book Data Management
        </h3>
        <p className="text-gray-600 text-sm">
          Load books from Google Books API to expand your collection
        </p>
      </div>

      <div className="space-y-4">
        <div>
          <h4 className="font-medium mb-2">Quick Load Options:</h4>
          <div className="flex flex-wrap gap-2">
            <Button 
              variant="outline" 
              size="sm" 
              onClick={loadMixedBooks}
              disabled={loading}
            >
              <Globe className="w-4 h-4 mr-2" />
              {loading ? 'Loading...' : 'Mixed Selection (30 books)'}
            </Button>
          </div>
        </div>

        <div>
          <h4 className="font-medium mb-2">Load by Category:</h4>
          <div className="grid grid-cols-2 md:grid-cols-3 gap-2">
            {Object.keys(bookSearchQueries).map(category => (
              <Button
                key={category}
                variant="outline"
                size="sm"
                onClick={() => loadByCategory(category)}
                disabled={loading}
                className="text-xs"
              >
                {category}
              </Button>
            ))}
          </div>
        </div>

        {apiBooks.length > 0 && (
          <div className="border-t pt-4">
            <div className="flex items-center justify-between mb-2">
              <span className="text-sm font-medium">
                Loaded {apiBooks.length} books from API
              </span>
              <Button size="sm" onClick={exportToBookData}>
                <Download className="w-4 h-4 mr-2" />
                Export to File
              </Button>
            </div>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-2 max-h-40 overflow-y-auto">
              {apiBooks.slice(0, 10).map(book => (
                <div key={book.id} className="text-xs p-2 bg-gray-50 rounded">
                  <div className="font-medium">{book.title}</div>
                  <div className="text-gray-600">{book.author}</div>
                </div>
              ))}
              {apiBooks.length > 10 && (
                <div className="text-xs text-gray-500 p-2">
                  ...and {apiBooks.length - 10} more books
                </div>
              )}
            </div>
          </div>
        )}

        <div className="bg-blue-50 p-4 rounded-lg text-sm">
          <h5 className="font-medium text-blue-800 mb-1">How to use API books:</h5>
          <ol className="text-blue-700 space-y-1 text-xs">
            <li>1. Click "Mixed Selection" or choose a category</li>
            <li>2. Click "Export to File" to download the book data</li>
            <li>3. Copy the exported books to your book-data.ts file</li>
            <li>4. Restart your app to see the new books</li>
          </ol>
        </div>

        <div className="bg-yellow-50 p-4 rounded-lg text-sm">
          <h5 className="font-medium text-yellow-800 mb-1">Note:</h5>
          <p className="text-yellow-700 text-xs">
            The Google Books API is free but has rate limits. For production use, consider 
            implementing caching and error handling. You may also want to get an API key 
            for higher limits.
          </p>
        </div>
      </div>
    </div>
  )
}


