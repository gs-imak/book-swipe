"use client"

import { useState, useEffect, useCallback, useRef } from "react"
import { BookCard } from "./book-card"
import { Button } from "@/components/ui/button"
import { Book, UserPreferences } from "@/lib/book-data"
import { addLikedBook, removeLikedBook, getLikedBooks, addPassedBookId, getPassedBookIds } from "@/lib/storage"
import { scoreBooks, applyMMR } from "@/lib/scoring-engine"
import { getRecommendedBooks } from "@/lib/recommend-client"
import { getBooksByCategory, bookSearchQueries, fetchPersonalizedBooks } from "@/lib/books-api"
import { getCachedBooks, addBooksToCache, updateBooksInCache } from "@/lib/book-cache"
import { searchOpenLibrary } from "@/lib/openlibrary-api"
import { upgradeCoversWithItunes } from "@/lib/itunes-covers"
import { Heart, X, Undo2, RotateCcw, Settings, Library, BookOpen, Loader2 } from "lucide-react"
import { motion, AnimatePresence } from "framer-motion"
import { useGamification } from "./gamification-provider"
import { useToast } from "./toast-provider"
import { hapticLight, hapticMedium, hapticSuccess } from "@/lib/haptics"
import { recordSwipe, getCoLikeCounts } from "@/lib/supabase-sync"
import { isSupabaseConfigured } from "@/lib/supabase"

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

  const contentPrefs = new Set((preferences.contentPreferences || []).map(p => p.toLowerCase()))
  const hasContentPrefs = contentPrefs.size > 0 && !contentPrefs.has("no specific preferences")

  const DARK_MOODS = new Set(["dark", "grim", "heavy", "disturbing", "bleak", "violent", "tragic", "horror"])
  const ESCAPIST_MOODS = new Set(["escapist", "light", "fun", "uplifting", "whimsical", "cozy", "adventurous", "romantic"])

  const scored = books.map(book => {
    const genreMatch = matchesGenre(book.genre)
    const moodMatch = matchesMood(book.mood)

    // CRITICAL: A book MUST match at least one selected genre to be shown.
    // If user selected no genres, all pass (matchesGenre returns true).
    if (!genreMatch) return { book, score: 0 }

    // Genre match is the primary signal
    let score = 2
    if (moodMatch) score += 1

    // Length/rating are tiebreakers only (never standalone)
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

    // Content preferences scoring
    if (hasContentPrefs) {
      const bookMoodsLower = book.mood.map(m => m.toLowerCase())
      const descLower = (book.description || "").toLowerCase()

      if (contentPrefs.has("avoid heavy/dark themes")) {
        if (bookMoodsLower.some(m => DARK_MOODS.has(m))) score -= 1.5
      }
      if (contentPrefs.has("looking for escapism")) {
        if (bookMoodsLower.some(m => ESCAPIST_MOODS.has(m))) score += 0.5
      }
      if (contentPrefs.has("prefer recent publications")) {
        if (book.publishedYear >= 2000) score += 0.5
        else if (book.publishedYear < 1950 && book.publishedYear > 0) score -= 0.3
      }
      if (contentPrefs.has("open to classics")) {
        if (book.publishedYear > 0 && book.publishedYear < 1970) score += 0.3
      }
      if (contentPrefs.has("prefer diverse characters")) {
        if (descLower.match(/diverse|multicultural|identity|immigrant|heritage|culture/)) score += 0.4
      }
      if (contentPrefs.has("want strong female protagonists")) {
        if (descLower.match(/she |her |woman|female|heroine|mother|daughter|sister|queen|girl/)) score += 0.4
      }
    }

    return { book, score }
  })

  const filtered = scored
    .filter(s => s.score > 0)
    .sort((a, b) => b.score - a.score)
    .map(s => s.book)

  // Fallback: if very few genre-matched results, try genre-only (still strict)
  if (filtered.length < 5 && books.length > 10) {
    return books
      .filter(b => matchesGenre(b.genre))
      .sort((a, b) => b.rating - a.rating)
      .slice(0, 50)
  }

  return filtered
}

import { MAX_DECK_SIZE } from "@/lib/config"

export function SwipeInterface({ preferences, onRestart, onViewLibrary }: SwipeInterfaceProps) {
  const [filteredBooks, setFilteredBooks] = useState<Book[]>([])
  const [currentIndex, setCurrentIndex] = useState(0)
  const [likedBooks, setLikedBooks] = useState<Book[]>([])
  const [passedBooks, setPassedBooks] = useState<Book[]>([])
  const [undoStack, setUndoStack] = useState<{ book: Book; direction: "left" | "right" }[]>([])
  const [isLoading, setIsLoading] = useState(true)
  const [batchCount, setBatchCount] = useState(1)
  const [sessionLikedBooks, setSessionLikedBooks] = useState<Book[]>([])
  const [bookReasons, setBookReasons] = useState<Record<string, string>>({})
  const [llmReasons, setLlmReasons] = useState<Record<string, string>>({})
  const [coLikeCounts, setCoLikeCounts] = useState<Record<string, number>>({})
  const { triggerActivity } = useGamification()
  const { showToast } = useToast()

  // Background cover upgrade: resolve high-res iTunes covers by ISBN and patch
  // both the live deck and the cache. Best-effort — failures keep the source
  // (Google / Open Library) cover, which is already correct and reliable.
  const upgradeDeckCovers = useCallback(async (deck: Book[]) => {
    try {
      const changed = await upgradeCoversWithItunes(deck)
      if (changed.length === 0) return
      updateBooksInCache(changed)
      const patch = new Map(changed.map((b) => [b.id, b]))
      setFilteredBooks((prev) => prev.map((b) => patch.get(b.id) ?? b))
    } catch {
      // best-effort
    }
  }, [])

  const loadBooks = async (excludeIds?: Set<string>) => {
    setIsLoading(true)
    try {
      // Fetch books specifically from user's selected genres (not all genres)
      const userGenres = preferences.favoriteGenres.length > 0
        ? preferences.favoriteGenres
        : Object.keys(bookSearchQueries) // fallback to all if none selected
      const booksPerGenre = Math.ceil(50 / userGenres.length)

      // Fetch from Google Books + Open Library in parallel, only for user's genres.
      // Once there's taste signal, also pull books aligned to the user's actual
      // likes (same authors / top genres) in the same parallel batch — broadens
      // the candidate pool the ranker draws from, no extra latency.
      const likedForFetch = getLikedBooks()
      const fetchPromises: Promise<Book[]>[] = [
        ...userGenres.flatMap(genre => [
          getBooksByCategory(genre, booksPerGenre),
          searchOpenLibrary(genre, Math.min(booksPerGenre, 8)),
        ]),
        ...(likedForFetch.length >= 3 ? [fetchPersonalizedBooks(likedForFetch)] : []),
      ]

      const results = await Promise.allSettled(fetchPromises)
      const freshBooks = results
        .filter((r): r is PromiseFulfilledResult<Book[]> => r.status === 'fulfilled')
        .flatMap(r => r.value)

      if (freshBooks.length > 0) {
        addBooksToCache(freshBooks)
      }

      let books = getCachedBooks()
      // Exclude already-seen books from previous batches + previously passed
      const passedSet = new Set(getPassedBookIds())
      if (excludeIds && excludeIds.size > 0) {
        books = books.filter(b => !excludeIds.has(b.id))
      }
      books = books.filter(b => !passedSet.has(b.id))
      const filtered = filterBooks(books, preferences)

      // Rank the deck. With taste signal, order by the TF-IDF engine + MMR
      // diversity (the real personalization — previously the deck used only the
      // genre-match heuristic and the engine just generated reason text). Cold
      // start keeps the genre-match / rating order.
      const liked = getLikedBooks()
      const candidatePool = filtered.length > 0 ? filtered : (freshBooks.length > 0 ? freshBooks : books)
      let deck: Book[]
      if (liked.length >= 1 && candidatePool.length > 0) {
        const likedIds = new Set(liked.map(b => b.id))
        const scored = scoreBooks(candidatePool, liked, { communityBoost: true, excludeIds: likedIds })
        deck = scored.length > 0
          ? applyMMR(scored, MAX_DECK_SIZE, 0.7).map(s => s.book)
          : [...candidatePool].sort((a, b) => b.rating - a.rating).slice(0, MAX_DECK_SIZE)
      } else {
        deck = (filtered.length > 0 ? filtered : [...candidatePool].sort((a, b) => b.rating - a.rating)).slice(0, MAX_DECK_SIZE)
      }

      // LLM-direct recommendations (ADR-0003): when configured, lead the deck with
      // personalized picks + their "why this book" reasons. No-ops (returns [])
      // without a key, so this gracefully falls back to the TF-IDF-ranked deck above.
      let llmReasonMap: Record<string, string> = {}
      if (liked.length >= 3) {
        try {
          const seenIds = new Set<string>([
            ...liked.map(b => b.id),
            ...Array.from(passedSet),
            ...(excludeIds ? Array.from(excludeIds) : []),
          ])
          const { books: recBooks, reasons } = await getRecommendedBooks(
            liked,
            seenIds,
            liked.map(b => b.title),
            12,
          )
          if (recBooks.length > 0) {
            const deckIds = new Set(deck.map(b => b.id))
            const recUnseen = recBooks.filter(b => !deckIds.has(b.id))
            deck = [...recUnseen, ...deck].slice(0, MAX_DECK_SIZE)
            llmReasonMap = reasons
          }
        } catch {
          // best-effort — keep the local deck
        }
      }
      setLlmReasons(llmReasonMap)
      setFilteredBooks(deck)
      // Background: swap OL books to their correct-edition Amazon cover (no
      // perceived latency — the deck already renders with OL -L).
      void upgradeDeckCovers(deck)
      setCurrentIndex(0)
      setPassedBooks([])
      setUndoStack([])
      setLikedBooks(getLikedBooks())
    } catch {
      const cached = getCachedBooks()
      if (cached.length > 0) {
        const filtered = filterBooks(cached, preferences)
        setFilteredBooks(
          (filtered.length > 0 ? filtered : cached).slice(0, MAX_DECK_SIZE)
        )
      }
      showToast("Couldn't load new books. Showing cached results.", "error")
    } finally {
      setIsLoading(false)
    }
  }

  useEffect(() => {
    loadBooks()
  }, [preferences])

  // Build reason map whenever the deck or liked books change
  useEffect(() => {
    const liked = getLikedBooks()
    if (liked.length === 0 || filteredBooks.length === 0) {
      setBookReasons({})
      return
    }
    const scored = scoreBooks(filteredBooks, liked)
    const reasons: Record<string, string> = {}
    scored.forEach(s => {
      if (s.reasons.length > 0) {
        reasons[s.book.id] = s.reasons[0].description
      }
    })
    // LLM reasons (for recommended books) take precedence over the local
    // TF-IDF reason for the same book.
    setBookReasons({ ...reasons, ...llmReasons })
    // Re-run when the deck changes or the user's liked books change (the
    // likedBooks state mirrors getLikedBooks() and updates on every swipe/undo).
  }, [filteredBooks, likedBooks, llmReasons])

  // Fetch collaborative-filtering co-like counts (social proof) for signed-in
  // users. Keyed on the user's liked books; the RPC returns counts for books
  // that similar readers also liked. No-ops when Supabase isn't configured or
  // the user isn't signed in. Best-effort — failures just mean no badge.
  useEffect(() => {
    if (!isSupabaseConfigured()) return
    const liked = getLikedBooks()
    if (liked.length === 0) {
      setCoLikeCounts({})
      return
    }
    let cancelled = false
    getCoLikeCounts(liked.map((b) => b.id)).then((map) => {
      if (!cancelled) setCoLikeCounts(Object.fromEntries(map))
    })
    return () => {
      cancelled = true
    }
  }, [filteredBooks, likedBooks])

  const handleSwipe = (direction: "left" | "right") => {
    const currentBook = filteredBooks[currentIndex]
    if (!currentBook) return

    if (direction === "right") {
      hapticSuccess()
      addLikedBook(currentBook) // atomic: handles dedup + storage in one call
      setLikedBooks(getLikedBooks())
      setSessionLikedBooks(prev => [...prev, currentBook])
      triggerActivity('like_book')
      showToast(`"${currentBook.title}" saved to library`)
    } else {
      hapticLight()
      setPassedBooks(prev => [...prev, currentBook])
      addPassedBookId(currentBook.id, currentBook.genre, currentBook.mood) // persist for negative signal
    }

    setUndoStack(prev => [...prev, { book: currentBook, direction }])
    setCurrentIndex(prev => prev + 1)

    // Record swipe to cloud for collaborative filtering (fire-and-forget)
    recordSwipe(currentBook.id, direction, currentBook)
  }

  const handleUndo = () => {
    if (undoStack.length === 0 || currentIndex === 0) {
      showToast("Nothing to undo", "info")
      return
    }
    hapticMedium()

    const lastAction = undoStack[undoStack.length - 1]
    if (lastAction.direction === "right") {
      const updated = removeLikedBook(lastAction.book.id)
      setLikedBooks(updated)
      setSessionLikedBooks(prev => prev.filter(b => b.id !== lastAction.book.id))
    } else {
      setPassedBooks(prev => prev.filter(b => b.id !== lastAction.book.id))
    }

    setUndoStack(prev => prev.slice(0, -1))
    setCurrentIndex(prev => prev - 1)
    showToast("Undo — back to previous book", "info")
  }

  const currentBook = filteredBooks[currentIndex]
  const nextBook = filteredBooks[currentIndex + 1]
  const hasMoreBooks = currentIndex < filteredBooks.length

  // Refs to avoid stale closures in keyboard handler
  const handleSwipeRef = useRef(handleSwipe)
  const handleUndoRef = useRef(handleUndo)
  const hasMoreRef = useRef(hasMoreBooks)
  const currentBookRef = useRef(currentBook)
  handleSwipeRef.current = handleSwipe
  handleUndoRef.current = handleUndo
  hasMoreRef.current = hasMoreBooks
  currentBookRef.current = currentBook

  // Keyboard navigation for swipe actions
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if ((e.ctrlKey || e.metaKey) && e.key === "z") {
        e.preventDefault()
        handleUndoRef.current()
        return
      }
      if (!hasMoreRef.current || !currentBookRef.current) return
      if (e.key === "ArrowLeft") {
        handleSwipeRef.current("left")
      } else if (e.key === "ArrowRight") {
        handleSwipeRef.current("right")
      }
    }
    document.addEventListener("keydown", handleKeyDown)
    return () => {
      document.removeEventListener("keydown", handleKeyDown)
    }
  }, [])

  // Loading
  if (isLoading) {
    return (
      <div className="bg-background flex items-center justify-center" style={{ minHeight: "100dvh" }}>
        <div className="text-center">
          <Loader2 className="w-8 h-8 text-amber-600 animate-spin mx-auto mb-4" />
          <p className="text-base font-medium text-stone-600 dark:text-stone-300">Finding books for you...</p>
        </div>
      </div>
    )
  }

  // No matches
  if (filteredBooks.length === 0) {
    return (
      <div className="bg-background flex items-center justify-center p-6 pb-16" style={{ minHeight: "100dvh" }}>
        <motion.div
          className="text-center max-w-sm"
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
        >
          <div className="w-16 h-16 bg-amber-50 dark:bg-amber-900/30 rounded-2xl flex items-center justify-center mx-auto mb-5">
            <BookOpen className="w-8 h-8 text-amber-600" />
          </div>
          <h2
            className="text-2xl font-bold text-stone-900 dark:text-stone-100 mb-2 font-serif"
          >
            No matches yet
          </h2>
          <p className="text-stone-500 dark:text-stone-400 mb-6 leading-relaxed">
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
      <div className="bg-background flex items-center justify-center p-6 pb-16" style={{ minHeight: "100dvh" }}>
        <motion.div
          className="text-center max-w-sm w-full"
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
        >
          <div className="w-16 h-16 bg-emerald-50 dark:bg-emerald-900/30 rounded-2xl flex items-center justify-center mx-auto mb-5">
            <Heart className="w-8 h-8 text-emerald-600" />
          </div>
          <h2
            className="text-2xl font-bold text-stone-900 dark:text-stone-100 mb-2 font-serif"
          >
            Nice batch!
          </h2>
          <p className="text-stone-500 dark:text-stone-400 mb-6">
            You&apos;ve gone through {filteredBooks.length} books. Ready for more or head to your library?
          </p>

          {/* Stats */}
          <div className="flex justify-center gap-8 mb-6">
            <div className="text-center">
              <p className="text-2xl font-bold text-emerald-600">{sessionLikedBooks.length}</p>
              <p className="text-xs text-stone-500 dark:text-stone-400">Liked</p>
            </div>
            <div className="text-center">
              <p className="text-2xl font-bold text-stone-400 dark:text-stone-500">{passedBooks.length}</p>
              <p className="text-xs text-stone-500 dark:text-stone-400">Passed</p>
            </div>
          </div>

          {/* Liked books list */}
          {sessionLikedBooks.length > 0 && (
            <div className="bg-white dark:bg-stone-900 rounded-xl p-4 border border-stone-200/60 dark:border-stone-700/60 shadow-sm mb-6 text-left">
              <h3 className="text-xs font-semibold text-stone-400 dark:text-stone-500 uppercase tracking-wider mb-3">
                Your picks
              </h3>
              <div className="max-h-32 overflow-y-auto space-y-1.5">
                {sessionLikedBooks.map((book, index) => (
                  <motion.div
                    key={book.id}
                    initial={{ opacity: 0, x: -8 }}
                    animate={{ opacity: 1, x: 0 }}
                    transition={{ delay: Math.min(index * 0.03, 0.2) }}
                    className="text-sm text-stone-700 dark:text-stone-300 bg-stone-50 dark:bg-stone-800/50 rounded-lg px-3 py-2"
                  >
                    <span className="font-medium">{book.title}</span>
                    <span className="text-stone-400 dark:text-stone-500"> by {book.author}</span>
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
              onClick={() => {
                const seenIds = new Set([
                  ...filteredBooks.map(b => b.id),
                  ...likedBooks.map(b => b.id),
                ])
                setBatchCount(prev => prev + 1)
                loadBooks(seenIds)
              }}
              variant="outline"
              className="flex-1 h-11 border-stone-200 dark:border-stone-700 hover:bg-stone-50 dark:hover:bg-stone-800/50 text-stone-700 dark:text-stone-300 rounded-xl"
            >
              <RotateCcw className="w-4 h-4 mr-2" />
              More Books
            </Button>
          </div>
        </motion.div>
      </div>
    )
  }

  return (
    <div className="bg-background relative" style={{ minHeight: "100dvh" }}>
      <div className="relative z-10 flex flex-col" style={{ minHeight: "100dvh" }}>
        {/* Screen reader announcement */}
        <div aria-live="polite" className="sr-only">
          {currentBook
            ? `${currentBook.title} by ${currentBook.author}, card ${currentIndex + 1} of ${filteredBooks.length}`
            : ""}
        </div>

        {/* Header */}
        <div className="bg-background/90 backdrop-blur-md border-b border-stone-200/60 dark:border-stone-700/60 sticky top-0 z-20">
          <div className="px-4 sm:px-6 py-3 flex justify-between items-center max-w-md lg:max-w-2xl mx-auto">
            <button
              onClick={onViewLibrary}
              aria-label="View library"
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-full bg-stone-100 dark:bg-stone-800 hover:bg-stone-200 dark:hover:bg-stone-700 transition-colors tap-target touch-manipulation"
            >
              <Library className="w-4 h-4 text-stone-600 dark:text-stone-300" />
              <span className="text-sm font-medium text-stone-700 dark:text-stone-300">{likedBooks.length}</span>
            </button>

            <div className="text-center">
              <h1
                className="text-lg font-bold text-stone-900 dark:text-stone-100 tracking-tight font-serif"
              >
                BookSwipe
              </h1>
              <p className="text-xs text-stone-400 dark:text-stone-500 font-medium">
                {currentIndex + 1} of {filteredBooks.length}
              </p>
            </div>

            <button
              onClick={onRestart}
              aria-label="Update preferences"
              className="flex items-center justify-center p-2 rounded-lg hover:bg-stone-100 dark:hover:bg-stone-800 transition-colors tap-target touch-manipulation"
            >
              <Settings className="w-5 h-5 text-stone-400 dark:text-stone-500" />
            </button>
          </div>
        </div>

        {/* Card stack + action buttons together */}
        <div className="flex-1 flex flex-col items-center justify-center p-3 sm:p-4 pb-16 sm:pb-6">
          <div className="relative w-full max-w-sm lg:max-w-md">
            <motion.div
              className="relative sm:h-[560px] md:h-[600px] lg:h-[640px]"
              style={{ height: "min(500px, 60svh, 60vh)" }}
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
                    reason={bookReasons[currentBook.id]}
                    coLikeCount={coLikeCounts[currentBook.id]}
                  />
                )}
              </AnimatePresence>
            </motion.div>
          </div>

          {/* Action buttons — directly below card */}
          <div className="w-full max-w-sm lg:max-w-md px-4 mt-4">
            <div className="flex justify-center items-center gap-4 mb-3">
              <motion.button
                whileTap={{ scale: 0.9 }}
                aria-label="Pass on this book"
                className="w-14 h-14 rounded-full border-2 border-red-200 dark:border-red-800 hover:border-red-300 dark:hover:border-red-700 bg-white dark:bg-stone-900 shadow-sm flex items-center justify-center transition-colors tap-target touch-manipulation"
                onClick={() => handleSwipe("left")}
              >
                <X className="w-6 h-6 text-red-400" />
              </motion.button>

              <motion.button
                whileTap={{ scale: 0.9 }}
                aria-label="Undo last swipe"
                disabled={undoStack.length === 0}
                className={`w-12 h-12 rounded-full border-2 bg-white shadow-sm flex items-center justify-center transition-all tap-target touch-manipulation ${
                  undoStack.length > 0
                    ? "border-amber-200 hover:border-amber-300 text-amber-500"
                    : "border-stone-100 text-stone-200 cursor-not-allowed"
                }`}
                onClick={handleUndo}
              >
                <Undo2 className="w-4 h-4" />
              </motion.button>

              <motion.button
                whileTap={{ scale: 0.9 }}
                aria-label="Like this book"
                className="w-14 h-14 rounded-full bg-emerald-500 hover:bg-emerald-600 shadow-sm flex items-center justify-center transition-colors tap-target touch-manipulation"
                onClick={() => handleSwipe("right")}
              >
                <Heart className="w-6 h-6 text-white" />
              </motion.button>
            </div>

            <p className="text-center text-xs text-stone-400">
              <span className="lg:hidden">Swipe left to pass · right to save</span>
              <span className="hidden lg:inline">
                <kbd className="px-1.5 py-0.5 rounded bg-stone-100 dark:bg-stone-800 text-stone-500 font-mono text-[10px]">&larr;</kbd> Pass
                <span className="mx-2 text-stone-300">·</span>
                <kbd className="px-1.5 py-0.5 rounded bg-stone-100 dark:bg-stone-800 text-stone-500 font-mono text-[10px]">&rarr;</kbd> Save
                <span className="mx-2 text-stone-300">·</span>
                <kbd className="px-1.5 py-0.5 rounded bg-stone-100 dark:bg-stone-800 text-stone-500 font-mono text-[10px]">Ctrl+Z</kbd> Undo
              </span>
            </p>
          </div>
        </div>
      </div>
    </div>
  )
}
