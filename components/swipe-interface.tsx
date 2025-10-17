"use client"

import { useState, useEffect } from "react"
import { BookCard } from "./book-card"
import { Button } from "@/components/ui/button"
import { Book, UserPreferences } from "@/lib/book-data"
import { saveLikedBooks, getLikedBooks } from "@/lib/storage"
import { getMixedRecommendations } from "@/lib/books-api"
import { Heart, X, RotateCcw, Settings, Library, BookOpen } from "lucide-react"
import { motion, AnimatePresence } from "framer-motion"
import { useGamification } from "./gamification-provider"

interface SwipeInterfaceProps {
  preferences: UserPreferences
  onRestart: () => void
  onViewLibrary: () => void
}

function filterBooks(books: Book[], preferences: UserPreferences): Book[] {
  // If no books, return empty
  if (books.length === 0) return []
  
  const filtered = books.filter(book => {
    // Filter by genre preferences (EXACT match required)
    const hasMatchingGenre = preferences.favoriteGenres.length === 0 || 
      book.genre.some(bookGenre => 
        preferences.favoriteGenres.some(prefGenre => {
          const match = bookGenre.toLowerCase().trim() === prefGenre.toLowerCase().trim()
          if (match) {
            console.log(`✓ Genre match: "${bookGenre}" === "${prefGenre}" for book: ${book.title}`)
          }
          return match
        })
      )
    
    // Filter by mood preferences (EXACT match required)
    const hasMatchingMood = preferences.currentMood.length === 0 ||
      book.mood.some(bookMood => 
        preferences.currentMood.some(prefMood => 
          bookMood.toLowerCase().trim() === prefMood.toLowerCase().trim()
        )
      )
    
    // Filter by length preference (strict)
    let matchesLength = true
    if (preferences.preferredLength !== "No preference") {
      switch (preferences.preferredLength) {
        case "Short (under 250 pages)":
          matchesLength = book.pages < 250
          break
        case "Medium (250-400 pages)":
          matchesLength = book.pages >= 250 && book.pages <= 400
          break
        case "Long (400-600 pages)":
          matchesLength = book.pages > 400 && book.pages <= 600
          break
        case "Epic (600+ pages)":
          matchesLength = book.pages > 600
          break
      }
    }
    
    const passes = (hasMatchingGenre || hasMatchingMood) && matchesLength
    
    if (!passes) {
      console.log(`✗ Filtered out: ${book.title} - Genre: ${book.genre.join(', ')} - Mood: ${book.mood.join(', ')} - Pages: ${book.pages}`)
    }
    
    return passes
  })
  
  console.log(`Filter result: ${filtered.length}/${books.length} books passed`)
  return filtered
}

export function SwipeInterface({ preferences, onRestart, onViewLibrary }: SwipeInterfaceProps) {
  const [filteredBooks, setFilteredBooks] = useState<Book[]>([])
  const [currentIndex, setCurrentIndex] = useState(0)
  const [likedBooks, setLikedBooks] = useState<Book[]>([])
  const [passedBooks, setPassedBooks] = useState<Book[]>([])
  const [isLoading, setIsLoading] = useState(true)
  const { triggerActivity } = useGamification()

  useEffect(() => {
    async function loadBooks() {
      setIsLoading(true)
      try {
        // Fetch books from Google Books API
        console.log('Fetching books from Google Books API...')
        console.log('User preferences:', preferences)
        
        const books = await getMixedRecommendations(50)
        console.log(`Fetched ${books.length} books from API`)
        
        // Debug: Show first few books and their genres
        console.log('Sample books with genres:', books.slice(0, 3).map(b => ({
          title: b.title,
          genre: b.genre
        })))
        
        // Apply filters
        const filtered = filterBooks(books, preferences)
        console.log(`After filtering: ${filtered.length} books match preferences`)
        
        // Debug: Show what got filtered out
        if (filtered.length < books.length) {
          console.log(`Filtered out ${books.length - filtered.length} books`)
        }
        
        // If filtering is too strict and we have no books, show error
        if (filtered.length === 0 && books.length > 0) {
          console.error('ERROR: No books matched your preferences!')
          alert('No books match your preferences. Try selecting different genres or adjusting your filters.')
          setFilteredBooks([])
        } else {
          setFilteredBooks(filtered)
        }
        
        setCurrentIndex(0)
        setLikedBooks(getLikedBooks())
      } catch (error) {
        console.error('Error loading books:', error)
        alert('Failed to load books. Please check your internet connection and API key.')
        setFilteredBooks([])
      } finally {
        setIsLoading(false)
      }
    }
    
    loadBooks()
  }, [preferences])

  const handleSwipe = (direction: "left" | "right") => {
    const currentBook = filteredBooks[currentIndex]
    if (!currentBook) return

    if (direction === "right") {
      const newLikedBooks = [...likedBooks, currentBook]
      setLikedBooks(newLikedBooks)
      saveLikedBooks(newLikedBooks)
      // Update gamification progress (likes achievements)
      triggerActivity('like_book')
    } else {
      setPassedBooks(prev => [...prev, currentBook])
    }

    setCurrentIndex(prev => prev + 1)
  }

  const handleButtonSwipe = (direction: "left" | "right") => {
    handleSwipe(direction)
  }

  const currentBook = filteredBooks[currentIndex]
  const nextBook = filteredBooks[currentIndex + 1]
  const hasMoreBooks = currentIndex < filteredBooks.length

  // Loading state
  if (isLoading) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-purple-50 via-pink-50 to-indigo-50 flex items-center justify-center">
        <div className="text-center">
          <motion.div
            animate={{ rotate: 360 }}
            transition={{ duration: 1, repeat: Infinity, ease: "linear" }}
            className="w-16 h-16 border-4 border-purple-500 border-t-transparent rounded-full mx-auto mb-4"
          />
          <p className="text-lg font-semibold text-gray-700">Loading amazing books for you...</p>
        </div>
      </div>
    )
  }

  if (filteredBooks.length === 0) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-purple-50 via-pink-50 to-indigo-50 relative overflow-hidden">
        {/* Animated background */}
        <div className="absolute inset-0">
          <motion.div 
            animate={{ rotate: [0, 360] }}
            transition={{ duration: 20, repeat: Infinity, ease: "linear" }}
            className="absolute top-1/4 left-1/4 w-64 h-64 bg-purple-200/20 rounded-full blur-3xl"
          />
          <motion.div 
            animate={{ rotate: [360, 0] }}
            transition={{ duration: 25, repeat: Infinity, ease: "linear" }}
            className="absolute bottom-1/4 right-1/4 w-80 h-80 bg-pink-200/20 rounded-full blur-3xl"
          />
        </div>

        <div className="relative z-10 min-h-screen flex items-start md:items-center justify-center p-6 pt-4 pb-24">
          <motion.div 
            className="text-center max-w-md bg-white/90 backdrop-blur-xl rounded-3xl p-8 shadow-2xl border border-white/20"
            initial={{ opacity: 0, scale: 0.9 }}
            animate={{ opacity: 1, scale: 1 }}
            transition={{ duration: 0.5 }}
          >
            <motion.div
              initial={{ scale: 0 }}
              animate={{ scale: 1 }}
              transition={{ delay: 0.2, type: "spring" }}
              className="w-16 h-16 bg-gradient-to-br from-purple-400 to-pink-400 rounded-full flex items-center justify-center mx-auto mb-6"
            >
              <BookOpen className="w-8 h-8 text-white" />
            </motion.div>
            <motion.h2 
              className="text-2xl font-bold mb-4 bg-gradient-to-r from-purple-600 to-pink-600 bg-clip-text text-transparent"
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.3 }}
            >
              No Perfect Matches Found
            </motion.h2>
            <motion.p 
              className="text-gray-600 mb-8 leading-relaxed"
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.4 }}
            >
              We couldn't find books that match your current preferences. Let's adjust your taste profile to discover more amazing reads!
            </motion.p>
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.5 }}
            >
              <Button 
                onClick={onRestart} 
                className="px-8 py-3 bg-gradient-to-r from-purple-500 to-pink-500 hover:from-purple-600 hover:to-pink-600 text-white font-medium rounded-xl transition-all duration-300"
              >
                <Settings className="w-5 h-5 mr-2" />
                Update Preferences
              </Button>
            </motion.div>
          </motion.div>
        </div>
      </div>
    )
  }

  if (!hasMoreBooks) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-purple-50 via-pink-50 to-indigo-50 relative overflow-hidden">
        {/* Animated background */}
        <div className="absolute inset-0">
          <motion.div 
            animate={{ rotate: [0, 360] }}
            transition={{ duration: 20, repeat: Infinity, ease: "linear" }}
            className="absolute top-1/4 left-1/4 w-64 h-64 bg-purple-200/20 rounded-full blur-3xl"
          />
          <motion.div 
            animate={{ rotate: [360, 0] }}
            transition={{ duration: 25, repeat: Infinity, ease: "linear" }}
            className="absolute bottom-1/4 right-1/4 w-80 h-80 bg-pink-200/20 rounded-full blur-3xl"
          />
        </div>

        <div className="relative z-10 min-h-screen flex items-start md:items-center justify-center p-6 pt-4 pb-24">
          <motion.div 
            className="text-center max-w-lg bg-white/90 backdrop-blur-xl rounded-3xl p-8 shadow-2xl border border-white/20"
            initial={{ opacity: 0, scale: 0.9 }}
            animate={{ opacity: 1, scale: 1 }}
            transition={{ duration: 0.5 }}
          >
            <motion.div
              initial={{ scale: 0 }}
              animate={{ scale: 1 }}
              transition={{ delay: 0.2, type: "spring" }}
              className="w-20 h-20 bg-gradient-to-br from-green-400 to-emerald-500 rounded-full flex items-center justify-center mx-auto mb-6"
            >
              <Heart className="w-10 h-10 text-white" />
            </motion.div>
            
            <motion.h2 
              className="text-3xl font-bold mb-4 bg-gradient-to-r from-purple-600 to-pink-600 bg-clip-text text-transparent"
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.3 }}
            >
              Discovery Complete! 🎉
            </motion.h2>
            
            <motion.div 
              className="mb-8"
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.4 }}
            >
              <p className="text-gray-600 mb-4 text-lg">
                Amazing! You've explored all available books.
              </p>
              <div className="flex justify-center gap-8 mb-6">
                <div className="text-center">
                  <div className="text-2xl font-bold text-green-600">{likedBooks.length}</div>
                  <div className="text-sm text-gray-500">Books Liked</div>
                </div>
                <div className="text-center">
                  <div className="text-2xl font-bold text-red-400">{passedBooks.length}</div>
                  <div className="text-sm text-gray-500">Books Passed</div>
                </div>
              </div>
              
              {likedBooks.length > 0 && (
                <motion.div 
                  className="bg-gradient-to-r from-green-50 to-emerald-50 p-6 rounded-2xl border border-green-200/50"
                  initial={{ opacity: 0, scale: 0.9 }}
                  animate={{ opacity: 1, scale: 1 }}
                  transition={{ delay: 0.6 }}
                >
                  <h3 className="font-bold text-green-800 mb-3 flex items-center gap-2">
                    <Heart className="w-5 h-5" />
                    Your Reading List
                  </h3>
                  <div className="max-h-32 overflow-y-auto space-y-1">
                    {likedBooks.map((book, index) => (
                      <motion.div
                        key={book.id}
                        initial={{ opacity: 0, x: -10 }}
                        animate={{ opacity: 1, x: 0 }}
                        transition={{ delay: 0.7 + index * 0.1 }}
                        className="text-sm text-green-700 bg-white/60 rounded-lg px-3 py-2"
                      >
                        <span className="font-medium">{book.title}</span> by {book.author}
                      </motion.div>
                    ))}
                  </div>
                </motion.div>
              )}
            </motion.div>

            <motion.div 
              className="flex gap-4 justify-center"
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.8 }}
            >
              <Button 
                onClick={onViewLibrary}
                className="px-6 py-3 bg-gradient-to-r from-purple-500 to-pink-500 hover:from-purple-600 hover:to-pink-600 text-white font-medium rounded-xl transition-all duration-300"
              >
                <Library className="w-5 h-5 mr-2" />
                View Library
              </Button>
              <Button 
                onClick={onRestart} 
                variant="outline"
                className="px-6 py-3 border-purple-200 hover:border-purple-300 hover:bg-purple-50 rounded-xl transition-all duration-300"
              >
                <RotateCcw className="w-5 h-5 mr-2" />
                Start Over
              </Button>
            </motion.div>
          </motion.div>
        </div>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-purple-50 via-pink-50 to-indigo-50 relative overflow-hidden">
      {/* Animated background elements */}
      <div className="absolute inset-0 overflow-hidden">
        <motion.div 
          animate={{ 
            rotate: [0, 360],
            scale: [1, 1.1, 1]
          }}
          transition={{ 
            duration: 25, 
            repeat: Infinity, 
            ease: "linear" 
          }}
          className="absolute -top-32 -left-32 w-96 h-96 bg-purple-200/20 rounded-full blur-3xl"
        />
        <motion.div 
          animate={{ 
            rotate: [360, 0],
            scale: [1.1, 1, 1.1]
          }}
          transition={{ 
            duration: 30, 
            repeat: Infinity, 
            ease: "linear" 
          }}
          className="absolute -bottom-32 -right-32 w-96 h-96 bg-pink-200/20 rounded-full blur-3xl"
        />
      </div>

      <div className="relative z-10 min-h-screen flex flex-col">
        {/* Header */}
        <div className="bg-white/80 backdrop-blur-xl border-b border-white/20 sticky top-0 z-20">
          <div className="px-4 sm:px-6 py-3 sm:py-4 flex justify-between items-center max-w-md mx-auto">
            <Button 
              variant="outline" 
              size="sm" 
              onClick={onViewLibrary}
              className="border-purple-200 hover:border-purple-300 hover:bg-purple-50 transition-all duration-300 flex-shrink-0"
            >
              <Library className="w-4 h-4 sm:mr-2 text-purple-600" />
              <span className="font-medium text-purple-700">{likedBooks.length}</span>
            </Button>
            <div className="text-center flex-1 min-w-0 mx-2 sm:mx-4">
              <h1 className="text-lg sm:text-2xl font-bold bg-gradient-to-r from-purple-600 to-pink-600 bg-clip-text text-transparent">
                BookSwipe
              </h1>
              <div className="flex items-center justify-center gap-1 sm:gap-2 mt-0.5 sm:mt-1">
                <div className="w-1.5 sm:w-2 h-1.5 sm:h-2 bg-gradient-to-r from-purple-400 to-pink-400 rounded-full animate-pulse"></div>
                <p className="text-xs sm:text-sm text-gray-600 font-medium">
                  {currentIndex + 1} of {filteredBooks.length}
                </p>
                <div className="w-1.5 sm:w-2 h-1.5 sm:h-2 bg-gradient-to-r from-purple-400 to-pink-400 rounded-full animate-pulse"></div>
              </div>
            </div>
            <Button 
              variant="outline" 
              size="sm" 
              onClick={onRestart}
              className="border-gray-200 hover:border-gray-300 hover:bg-gray-50 transition-all duration-300 flex-shrink-0"
            >
              <Settings className="w-4 h-4 text-gray-600" />
            </Button>
          </div>
        </div>

        {/* Cards Stack */}
        <div className="flex-1 flex items-center justify-center p-3 sm:p-4 md:p-6">
          <div className="relative w-full max-w-sm">
            <motion.div 
              className="relative h-[520px] sm:h-[580px] md:h-[640px]"
              initial={{ scale: 0.9, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              transition={{ duration: 0.5, ease: "easeOut" }}
            >
              <AnimatePresence>
                {nextBook && (
                  <BookCard
                    key={`${nextBook.id}-next`}
                    book={nextBook}
                    onSwipe={() => {}}
                    isTop={false}
                  />
                )}
                {currentBook && (
                  <BookCard
                    key={`${currentBook.id}-current`}
                    book={currentBook}
                    onSwipe={handleSwipe}
                    isTop={true}
                  />
                )}
              </AnimatePresence>
            </motion.div>
          </div>
        </div>

        {/* Action Buttons */}
        <div className="pb-20 sm:pb-8 pt-3 sm:pt-4">
          <div className="max-w-sm mx-auto px-4 sm:px-6">
            <div className="flex justify-center gap-6 sm:gap-8 mb-4 sm:mb-6">
              <motion.div
                whileHover={{ scale: 1.1 }}
                whileTap={{ scale: 0.95 }}
              >
                <Button
                  variant="outline"
                  size="icon"
                  className="w-14 sm:w-16 h-14 sm:h-16 rounded-full border-2 border-red-200 hover:border-red-300 hover:bg-red-50 bg-white/80 backdrop-blur-sm shadow-lg transition-all duration-300 tap-target touch-manipulation"
                  onClick={() => handleButtonSwipe("left")}
                >
                  <X className="w-6 sm:w-7 h-6 sm:h-7 text-red-500" />
                </Button>
              </motion.div>
              
              <motion.div
                whileHover={{ scale: 1.1 }}
                whileTap={{ scale: 0.95 }}
              >
                <Button
                  size="icon"
                  className="w-14 sm:w-16 h-14 sm:h-16 rounded-full bg-gradient-to-r from-green-400 to-emerald-500 hover:from-green-500 hover:to-emerald-600 shadow-lg transition-all duration-300 tap-target touch-manipulation"
                  onClick={() => handleButtonSwipe("right")}
                >
                  <Heart className="w-6 sm:w-7 h-6 sm:h-7 text-white" />
                </Button>
              </motion.div>
            </div>
            
            <div className="flex justify-center gap-8 sm:gap-12 text-xs sm:text-sm font-medium">
              <span className="text-red-500 flex items-center gap-1.5 sm:gap-2">
                <div className="w-1.5 sm:w-2 h-1.5 sm:h-2 bg-red-500 rounded-full"></div>
                Pass
              </span>
              <span className="text-green-600 flex items-center gap-1.5 sm:gap-2">
                <div className="w-1.5 sm:w-2 h-1.5 sm:h-2 bg-green-500 rounded-full"></div>
                Like
              </span>
            </div>

            {/* Swipe hint */}
            <motion.div 
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 1, duration: 0.5 }}
              className="text-center mt-3 sm:mt-4"
            >
              <p className="text-xs text-gray-500 bg-white/60 backdrop-blur-sm rounded-full px-3 sm:px-4 py-1.5 sm:py-2 inline-block">
                💡 Swipe or tap to discover your next read
              </p>
            </motion.div>
          </div>
        </div>
      </div>
    </div>
  )
}
