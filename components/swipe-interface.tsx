"use client"

import { useState, useEffect } from "react"
import { BookCard } from "./book-card"
import { Button } from "@/components/ui/button"
import { Book, UserPreferences } from "@/lib/book-data"
import { saveLikedBooks, getLikedBooks } from "@/lib/storage"
import { getMixedRecommendations } from "@/lib/books-api"
import { getCachedBooks, addBooksToCache } from "@/lib/book-cache"
import { Heart, X, RotateCcw, Settings, Library, BookOpen } from "lucide-react"
import { motion, AnimatePresence } from "framer-motion"
import { useGamification } from "./gamification-provider"

interface SwipeInterfaceProps {
  preferences: UserPreferences
  onRestart: () => void
  onViewLibrary: () => void
}

// Genre alias map for fuzzy matching
const GENRE_ALIASES: Record<string, string[]> = {
  'fantasy': ['fantasy', 'magical', 'myths', 'fairy tales'],
  'science fiction': ['science fiction', 'sci-fi', 'scifi', 'space', 'futuristic'],
  'mystery': ['mystery', 'detective', 'crime', 'whodunit'],
  'romance': ['romance', 'love stories', 'romantic'],
  'thriller': ['thriller', 'suspense', 'crime thriller'],
  'contemporary fiction': ['fiction', 'contemporary', 'literary fiction', 'general fiction'],
  'historical fiction': ['historical fiction', 'history', 'historical'],
  'biography': ['biography', 'memoir', 'autobiography', 'biographical'],
  'self-help': ['self-help', 'self help', 'personal development', 'self improvement'],
  'philosophy': ['philosophy', 'philosophical'],
  'horror': ['horror', 'gothic', 'dark fiction'],
  'comedy': ['comedy', 'humor', 'humour', 'funny', 'satire'],
  'lgbtq+': ['lgbtq', 'lgbtq+', 'queer', 'gay', 'lesbian'],
}

function filterBooks(books: Book[], preferences: UserPreferences): Book[] {
  if (books.length === 0) return []

  const prefGenresArr = preferences.favoriteGenres.map(g => g.toLowerCase().trim())
  const prefGenres = new Set(prefGenresArr)
  const prefMoodsArr = preferences.currentMood.map(m => m.toLowerCase().trim())
  const prefMoods = new Set(prefMoodsArr)

  const matchesGenre = (bookGenres: string[]): boolean => {
    if (prefGenres.size === 0) return true
    return bookGenres.some(bg => {
      const bgLower = bg.toLowerCase().trim()
      if (prefGenres.has(bgLower)) return true
      for (const [canonical, aliases] of Object.entries(GENRE_ALIASES)) {
        if (prefGenres.has(canonical) && aliases.some(a => bgLower.includes(a))) return true
        if (aliases.some(a => a === bgLower) && prefGenres.has(canonical)) return true
      }
      if (prefGenresArr.some(pg => bgLower.includes(pg) || pg.includes(bgLower))) return true
      return false
    })
  }

  const matchesMood = (bookMoods: string[]): boolean => {
    if (prefMoods.size === 0) return true
    return bookMoods.some(bm => {
      const bmLower = bm.toLowerCase().trim()
      if (prefMoods.has(bmLower)) return true
      if (prefMoodsArr.some(pm => bmLower.includes(pm) || pm.includes(bmLower))) return true
      return false
    })
  }

  const scored = books.map(book => {
    let score = 0
    if (matchesGenre(book.genre)) score += 2
    if (matchesMood(book.mood)) score += 1

    let matchesLength = true
    if (preferences.preferredLength !== "No preference") {
      switch (preferences.preferredLength) {
        case "Short (under 250 pages)": matchesLength = book.pages < 300; break
        case "Medium (250-400 pages)": matchesLength = book.pages >= 200 && book.pages <= 450; break
        case "Long (400-600 pages)": matchesLength = book.pages > 350 && book.pages <= 650; break
        case "Epic (600+ pages)": matchesLength = book.pages > 550; break
      }
    }
    if (matchesLength) score += 0.5
    score += book.rating / 10

    return { book, score }
  })

  const filtered = scored
    .filter(s => s.score > 0)
    .sort((a, b) => b.score - a.score)
    .map(s => s.book)

  if (filtered.length < 5 && books.length > 10) {
    return books
      .filter(b => matchesGenre(b.genre) || matchesMood(b.mood))
      .sort((a, b) => b.rating - a.rating)
      .slice(0, 50)
  }

  return filtered
}

// Max books per swipe session — enough variety without overwhelming
const MAX_DECK_SIZE = 15

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
        let books = getCachedBooks()
        if (books.length < 30) {
          const fresh = await getMixedRecommendations(50)
          addBooksToCache(fresh)
          books = getCachedBooks()
        }
        const filtered = filterBooks(books, preferences)
        if (filtered.length === 0 && books.length > 0) {
          setFilteredBooks(books.sort((a, b) => b.rating - a.rating).slice(0, MAX_DECK_SIZE))
        } else {
          setFilteredBooks(filtered.slice(0, MAX_DECK_SIZE))
        }
        setCurrentIndex(0)
        setLikedBooks(getLikedBooks())
      } catch (error) {
        console.error('Error loading books:', error)
        const cached = getCachedBooks()
        if (cached.length > 0) {
          const filtered = filterBooks(cached, preferences)
          setFilteredBooks(
            (filtered.length > 0 ? filtered : cached).slice(0, MAX_DECK_SIZE)
          )
        }
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
      triggerActivity('like_book')
    } else {
      setPassedBooks(prev => [...prev, currentBook])
    }

    setCurrentIndex(prev => prev + 1)
  }

  const currentBook = filteredBooks[currentIndex]
  const nextBook = filteredBooks[currentIndex + 1]
  const hasMoreBooks = currentIndex < filteredBooks.length

  // Loading
  if (isLoading) {
    return (
      <div className="min-h-screen bg-[#FDFBF7] flex items-center justify-center">
        <div className="text-center">
          <motion.div
            animate={{ rotate: 360 }}
            transition={{ duration: 1, repeat: Infinity, ease: "linear" }}
            className="w-12 h-12 border-3 border-stone-300 border-t-amber-600 rounded-full mx-auto mb-4"
            style={{ borderWidth: '3px' }}
          />
          <p className="text-base font-medium text-stone-600">Finding books for you...</p>
        </div>
      </div>
    )
  }

  // No matches
  if (filteredBooks.length === 0) {
    return (
      <div className="min-h-screen bg-[#FDFBF7] flex items-center justify-center p-6 pb-24">
        <motion.div
          className="text-center max-w-sm"
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
        >
          <div className="w-16 h-16 bg-amber-50 rounded-2xl flex items-center justify-center mx-auto mb-5">
            <BookOpen className="w-8 h-8 text-amber-600" />
          </div>
          <h2
            className="text-2xl font-bold text-stone-900 mb-2"
            style={{ fontFamily: "'Georgia', 'Times New Roman', serif" }}
          >
            No matches yet
          </h2>
          <p className="text-stone-500 mb-6 leading-relaxed">
            We couldn&apos;t find books for your current preferences. Try adjusting your taste profile.
          </p>
          <Button
            onClick={onRestart}
            className="h-11 px-6 bg-stone-900 hover:bg-stone-800 text-white font-medium rounded-xl"
          >
            <Settings className="w-4 h-4 mr-2" />
            Update Preferences
          </Button>
        </motion.div>
      </div>
    )
  }

  // Done swiping
  if (!hasMoreBooks) {
    return (
      <div className="min-h-screen bg-[#FDFBF7] flex items-center justify-center p-6 pb-24">
        <motion.div
          className="text-center max-w-sm w-full"
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
        >
          <div className="w-16 h-16 bg-emerald-50 rounded-2xl flex items-center justify-center mx-auto mb-5">
            <Heart className="w-8 h-8 text-emerald-600" />
          </div>
          <h2
            className="text-2xl font-bold text-stone-900 mb-2"
            style={{ fontFamily: "'Georgia', 'Times New Roman', serif" }}
          >
            All done!
          </h2>
          <p className="text-stone-500 mb-6">
            You&apos;ve explored all available books.
          </p>

          {/* Stats */}
          <div className="flex justify-center gap-8 mb-6">
            <div className="text-center">
              <p className="text-2xl font-bold text-emerald-600">{likedBooks.length}</p>
              <p className="text-xs text-stone-500">Liked</p>
            </div>
            <div className="text-center">
              <p className="text-2xl font-bold text-stone-400">{passedBooks.length}</p>
              <p className="text-xs text-stone-500">Passed</p>
            </div>
          </div>

          {/* Liked books list */}
          {likedBooks.length > 0 && (
            <div className="bg-white rounded-xl p-4 border border-stone-200/60 shadow-sm mb-6 text-left">
              <h3 className="text-xs font-semibold text-stone-400 uppercase tracking-wider mb-3">
                Your picks
              </h3>
              <div className="max-h-32 overflow-y-auto space-y-1.5">
                {likedBooks.map((book, index) => (
                  <motion.div
                    key={book.id}
                    initial={{ opacity: 0, x: -8 }}
                    animate={{ opacity: 1, x: 0 }}
                    transition={{ delay: 0.1 + index * 0.05 }}
                    className="text-sm text-stone-700 bg-stone-50 rounded-lg px-3 py-2"
                  >
                    <span className="font-medium">{book.title}</span>
                    <span className="text-stone-400"> by {book.author}</span>
                  </motion.div>
                ))}
              </div>
            </div>
          )}

          {/* Actions */}
          <div className="flex gap-3">
            <Button
              onClick={onViewLibrary}
              className="flex-1 h-11 bg-stone-900 hover:bg-stone-800 text-white font-medium rounded-xl"
            >
              <Library className="w-4 h-4 mr-2" />
              View Library
            </Button>
            <Button
              onClick={onRestart}
              variant="outline"
              className="flex-1 h-11 border-stone-200 hover:bg-stone-50 text-stone-700 rounded-xl"
            >
              <RotateCcw className="w-4 h-4 mr-2" />
              Start Over
            </Button>
          </div>
        </motion.div>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-[#FDFBF7] relative">
      <div className="relative z-10 min-h-screen flex flex-col">
        {/* Header */}
        <div className="bg-[#FDFBF7]/90 backdrop-blur-md border-b border-stone-200/60 sticky top-0 z-20">
          <div className="px-4 sm:px-6 py-3 flex justify-between items-center max-w-md mx-auto">
            <button
              onClick={onViewLibrary}
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-full bg-stone-100 hover:bg-stone-200 transition-colors tap-target touch-manipulation"
            >
              <Library className="w-4 h-4 text-stone-600" />
              <span className="text-sm font-medium text-stone-700">{likedBooks.length}</span>
            </button>

            <div className="text-center">
              <h1
                className="text-lg font-bold text-stone-900 tracking-tight"
                style={{ fontFamily: "'Georgia', 'Times New Roman', serif" }}
              >
                BookSwipe
              </h1>
              <p className="text-xs text-stone-400 font-medium">
                {currentIndex + 1} of {filteredBooks.length}
              </p>
            </div>

            <button
              onClick={onRestart}
              className="p-2 rounded-lg hover:bg-stone-100 transition-colors tap-target touch-manipulation"
            >
              <Settings className="w-5 h-5 text-stone-400" />
            </button>
          </div>
        </div>

        {/* Card stack */}
        <div className="flex-1 flex items-center justify-center p-3 sm:p-4">
          <div className="relative w-full max-w-sm">
            <motion.div
              className="relative h-[500px] sm:h-[560px] md:h-[600px]"
              initial={{ scale: 0.95, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              transition={{ duration: 0.4 }}
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

        {/* Action buttons */}
        <div className="pb-20 sm:pb-6 pt-2">
          <div className="max-w-sm mx-auto px-4">
            <div className="flex justify-center gap-6 mb-3">
              <motion.button
                whileTap={{ scale: 0.9 }}
                className="w-14 h-14 rounded-full border-2 border-red-200 hover:border-red-300 bg-white shadow-sm flex items-center justify-center transition-colors tap-target touch-manipulation"
                onClick={() => handleSwipe("left")}
              >
                <X className="w-6 h-6 text-red-400" />
              </motion.button>

              <motion.button
                whileTap={{ scale: 0.9 }}
                className="w-14 h-14 rounded-full bg-emerald-500 hover:bg-emerald-600 shadow-sm flex items-center justify-center transition-colors tap-target touch-manipulation"
                onClick={() => handleSwipe("right")}
              >
                <Heart className="w-6 h-6 text-white" />
              </motion.button>
            </div>

            <p className="text-center text-xs text-stone-400">
              Swipe or tap to discover
            </p>
          </div>
        </div>
      </div>
    </div>
  )
}
