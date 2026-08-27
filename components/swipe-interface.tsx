"use client"

import { useState, useEffect, useCallback, useRef } from "react"
import Image from "next/image"
import dynamic from "next/dynamic"
import { BookCard } from "./book-card"
import { BookShowcase } from "./book-showcase"
import { Button } from "@/components/ui/button"
import { Book, UserPreferences } from "@/lib/book-data"
import { addLikedBook, removeLikedBook, getLikedBooks, addPassedBookId, getPassedBookIds, getGenreOffset, advanceGenreOffset } from "@/lib/storage"
import { scoreBooks, applyMMR } from "@/lib/scoring-engine"
import { getRecommendedBooks } from "@/lib/recommend-client"
import { getBooksByCategory, bookSearchQueries, fetchPersonalizedBooks } from "@/lib/books-api"
import { getCachedBooks, addBooksToCache, updateBooksInCache } from "@/lib/book-cache"
import { mergeDuplicates, idsFor } from "@/lib/book-identity"
import { saveDeckSession, loadDeckSession } from "@/lib/deck-session"
import { upgradeVisibleBooks } from "@/lib/book-enrichment"
import { searchOpenLibrary } from "@/lib/openlibrary-api"
import { upgradeCoversWithItunes } from "@/lib/itunes-covers"
import { Heart, X, Undo2, RotateCcw, Settings2, Library, BookOpen } from "lucide-react"
import { motion, AnimatePresence } from "framer-motion"
import { useGamification } from "./gamification-provider"
import { useToast } from "./toast-provider"
import { hapticLight, hapticMedium, hapticSuccess } from "@/lib/haptics"
import { recordSwipe, getCoLikeCounts } from "@/lib/supabase-sync"
import { isSupabaseConfigured } from "@/lib/supabase"

// The full Detail Modal only loads if someone goes past the Showcase preview.
const BookDetailModal = dynamic(() =>
  import("./book-detail-modal").then((m) => ({ default: m.BookDetailModal })),
)

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

    // Length/rating are tiebreakers only (never standalone).
    // pages === 0 means "no source reported one" — an unknown length must stay
    // neutral rather than counting as short (0 < 300 was matching "Short").
    let matchesLength = true
    if (preferences.preferredLength !== "No preference" && book.pages > 0) {
      switch (preferences.preferredLength) {
        case "Short (under 250 pages)": matchesLength = book.pages < 300; break
        case "Medium (250-400 pages)": matchesLength = book.pages >= 200 && book.pages <= 450; break
        case "Long (400-600 pages)": matchesLength = book.pages > 350 && book.pages <= 650; break
        case "Epic (600+ pages)": matchesLength = book.pages > 550; break
      }
    }
    if (matchesLength) score += 0.5
    // Only a rating real readers produced earns ranking weight.
    if (!book.metadata?.ratingEstimated) score += book.rating / 10

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

import { MAX_DECK_SIZE, DECK_FETCH_BUDGET, DECK_COVER_SIZES } from "@/lib/config"

export function SwipeInterface({ preferences, onRestart, onViewLibrary }: SwipeInterfaceProps) {
  const [filteredBooks, setFilteredBooks] = useState<Book[]>([])
  const [currentIndex, setCurrentIndex] = useState(0)
  const [likedBooks, setLikedBooks] = useState<Book[]>([])
  const [passedBooks, setPassedBooks] = useState<Book[]>([])
  const [undoStack, setUndoStack] = useState<{ book: Book; direction: "left" | "right" }[]>([])
  // Showcase = 3D preview layer on card tap; Detail Modal sits behind it.
  const [showcaseBook, setShowcaseBook] = useState<Book | null>(null)
  const [detailBook, setDetailBook] = useState<Book | null>(null)
  const [isLoading, setIsLoading] = useState(true)
  const [batchCount, setBatchCount] = useState(1)
  const [sessionLikedBooks, setSessionLikedBooks] = useState<Book[]>([])
  const [bookReasons, setBookReasons] = useState<Record<string, string>>({})
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

  // Identity, not id: two records of one novel from different sources have
  // different ids and would both reach the deck.
  const dedupeById = (deck: Book[]): Book[] => mergeDuplicates(deck)

  /**
   * The genres the user's likes actually point at, most-liked first, or null
   * when there is not enough signal to beat a broad fetch. Matched against the
   * fetchable query set so a stray subject string can never become a query.
   */
  const derivedGenres = (): string[] | null => {
    const liked = getLikedBooks()
    if (liked.length < 2) return null
    const fetchable = new Set(Object.keys(bookSearchQueries).map(g => g.toLowerCase()))
    const counts = new Map<string, number>()
    for (const book of liked) {
      for (const genre of book.genre || []) {
        const key = genre.toLowerCase().trim()
        if (fetchable.has(key)) counts.set(key, (counts.get(key) || 0) + 1)
      }
    }
    if (counts.size === 0) return null
    const ranked = [...counts.entries()].sort((a, b) => b[1] - a[1]).slice(0, 6)
    // Map back to the canonical casing the query table uses.
    const canonical = new Map(Object.keys(bookSearchQueries).map(g => [g.toLowerCase(), g]))
    return ranked.map(([key]) => canonical.get(key)!).filter(Boolean)
  }

  // NETWORK stage, extracted pure (no state writes): fetch fresh candidates
  // into the shared cache and return how many landed. Callers decide what the
  // user sees — this function never gates a paint.
  const fetchFreshIntoCache = async (): Promise<number> => {
    // Fetch from the user's stated genres; failing that, from the genres
    // their likes reveal. Only a user with neither gets the full 17-genre
    // fan-out — which used to be everyone, because "Start Discovering" writes
    // favoriteGenres: [] and the questionnaire is never shown.
    const statedGenres = preferences.favoriteGenres
    const userGenres = statedGenres.length > 0 ? statedGenres : (derivedGenres() ?? Object.keys(bookSearchQueries))
    const booksPerGenre = Math.ceil(DECK_FETCH_BUDGET / userGenres.length)

    // Fetch from Google Books + Open Library in parallel, only for user's genres.
    // Once there's taste signal, also pull books aligned to the user's actual
    // likes (same authors / top genres) in the same parallel batch — broadens
    // the candidate pool the ranker draws from, no extra latency.
    const likedForFetch = getLikedBooks()
    // Paged Google fetches are labeled per genre so the cursor can advance
    // selectively below. All promises start before any await — still parallel.
    const genreFetches = userGenres.map(genre => ({
      genre,
      // Page deeper each session via the per-genre cursor — surfaces fresh
      // books instead of re-querying the same top results.
      promise: getBooksByCategory(genre, booksPerGenre, getGenreOffset(genre)),
    }))
    // Open Library supplements each genre — it also covers for Google when
    // Google's API rate-limits (503s), so keep its share meaningful.
    const otherFetches: Promise<Book[]>[] = [
      ...userGenres.map(genre => searchOpenLibrary(genre, Math.min(booksPerGenre, 12))),
      ...(likedForFetch.length >= 3 ? [fetchPersonalizedBooks(likedForFetch)] : []),
    ]

    const [genreResults, otherResults] = await Promise.all([
      Promise.allSettled(genreFetches.map(f => f.promise)),
      Promise.allSettled(otherFetches),
    ])
    // Advance a genre's cursor only when its page actually loaded — advancing
    // on a failed fetch would permanently skip books the user never saw.
    const fetchStep = Math.min(booksPerGenre * 2, 40)
    genreFetches.forEach((f, i) => {
      const r = genreResults[i]
      if (r.status === 'fulfilled' && r.value.length > 0) {
        advanceGenreOffset(f.genre, fetchStep)
      }
    })
    const freshBooks = [...genreResults, ...otherResults]
      .filter((r): r is PromiseFulfilledResult<Book[]> => r.status === 'fulfilled')
      .flatMap(r => r.value)

    if (freshBooks.length > 0) {
      addBooksToCache(freshBooks)
    }
    return freshBooks.length
  }

  // LOCAL stage, synchronous: rank whatever is already on the device into a
  // deck. getCachedBooks() seeds 25 real books on first run and grows to
  // hundreds, so this almost always has something to show in frame one.
  const rankLocalDeck = (excludeIds?: Set<string>): { deck: Book[]; reasons: Record<string, string> } => {
    let books = getCachedBooks()
    // Exclude already-seen books from previous batches + previously passed
    const passedSet = new Set(getPassedBookIds())
    if (excludeIds && excludeIds.size > 0) {
      books = books.filter(b => !excludeIds.has(b.id))
    }
    books = books.filter(b => !passedSet.has(b.id))
    const filtered = filterBooks(books, preferences)

    // Rank the deck. With enough taste signal (>= 3 likes, same gate as the
    // LLM recs), order by the TF-IDF engine + MMR diversity. Below that the
    // profile is 1-2 books — similarity ranking tunnels on them, so keep the
    // genre-match / rating order instead.
    const liked = getLikedBooks()
    // Aliases included: a book merged away still answers to its old id, and
    // the liked/passed lists were written with whichever id was current then.
    const likedIdSet = new Set(liked.flatMap(idsFor))
    // Unconditional: a book already in the library must not come back around,
    // regardless of which ranking branch runs below.
    const withoutLiked = (list: Book[]) => list.filter(b => !idsFor(b).some(id => likedIdSet.has(id)))
    const candidatePool = withoutLiked(filtered.length > 0 ? filtered : books)
    const reasons: Record<string, string> = {}
    let deck: Book[]
    if (liked.length >= 3 && candidatePool.length > 0) {
      const scored = scoreBooks(candidatePool, liked, { communityBoost: true, excludeIds: likedIdSet })
      deck = scored.length > 0
        ? applyMMR(scored, MAX_DECK_SIZE, 0.7).map(s => s.book)
        : [...candidatePool].sort((a, b) => b.rating - a.rating).slice(0, MAX_DECK_SIZE)
      scored.forEach(s => {
        if (s.reasons.length > 0) reasons[s.book.id] = s.reasons[0].description
      })
    } else {
      deck = (filtered.length > 0 ? withoutLiked(filtered) : [...candidatePool].sort((a, b) => b.rating - a.rating)).slice(0, MAX_DECK_SIZE)
    }
    return { deck: dedupeById(deck), reasons }
  }

  // Deck load = instant local render + background refresh (audit finding #1:
  // the old version blocked the first card behind ~34 network calls and an
  // LLM round-trip while a usable deck sat in localStorage).
  const loadBooks = async (excludeIds?: Set<string>) => {
    // 1) Instant: rank what's on the device and paint it in this frame.
    const local = rankLocalDeck(excludeIds)
    const renderedInstantly = local.deck.length > 0
    if (renderedInstantly) {
      setBookReasons(local.reasons)
      setFilteredBooks(local.deck)
      setCurrentIndex(0)
      setPassedBooks([])
      setUndoStack([])
      setLikedBooks(getLikedBooks())
      setIsLoading(false)
      void upgradeDeckCovers(local.deck)
    } else {
      // Nothing usable locally (every cached book already passed/excluded) —
      // the spinner is honest here.
      setIsLoading(true)
    }

    // 2) Background: fetch fresh candidates, re-rank the (now richer) cache,
    // and merge into the part of the deck the user hasn't reached yet.
    try {
      await fetchFreshIntoCache()
      const ranked = rankLocalDeck(excludeIds)
      let deck = ranked.deck

      // LLM-direct recommendations (ADR-0003): when configured, lead the deck
      // with personalized picks + their "why this book" reasons. No-ops
      // (returns []) without a key — graceful fallback to the ranked deck.
      let llmReasonMap: Record<string, string> = {}
      const liked = getLikedBooks()
      if (liked.length >= 3) {
        try {
          const seenIds = new Set<string>([
            ...liked.map(b => b.id),
            ...getPassedBookIds(),
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
            deck = dedupeById([...recUnseen, ...deck]).slice(0, MAX_DECK_SIZE)
            llmReasonMap = reasons
          }
        } catch {
          // best-effort — keep the local deck
        }
      }

      // Fresh reasons win for re-ranked books; existing entries survive for
      // cards the user is already looking at.
      setBookReasons(prev => ({ ...prev, ...ranked.reasons, ...llmReasonMap }))
      // Anchor the merge on what the user has actually swiped — storage is
      // written synchronously on every swipe, so it is fresher than any ref,
      // and reading it here keeps the updater below pure.
      const swipedIds = new Set<string>([
        ...getPassedBookIds(),
        ...getLikedBooks().map(b => b.id),
      ])
      setFilteredBooks(prev => {
        if (prev.length === 0) return deck
        // Keep the already-swiped run plus the current card and the two
        // visibly stacked behind it — everything the user hasn't reached is
        // replaced by the fresher ranking. Books swiped since the instant
        // render must not come back.
        let swipedPrefix = 0
        while (swipedPrefix < prev.length && swipedIds.has(prev[swipedPrefix].id)) {
          swipedPrefix++
        }
        const keepCount = Math.min(swipedPrefix + 3, prev.length)
        const kept = prev.slice(0, keepCount)
        const keptIds = new Set(kept.map(b => b.id))
        const tail = deck.filter(
          b => !keptIds.has(b.id) && !swipedIds.has(b.id)
        )
        return [...kept, ...tail]
      })
      // Background: swap OL books to their correct-edition Amazon cover (no
      // perceived latency — the deck already renders with OL -L).
      void upgradeDeckCovers(deck)
      if (!renderedInstantly) {
        setCurrentIndex(0)
        setPassedBooks([])
        setUndoStack([])
        setLikedBooks(getLikedBooks())
      }
    } catch {
      // Books are already on screen in the instant path — a background refresh
      // failure needs no interruption. Only surface it when the user is still
      // staring at the spinner.
      if (!renderedInstantly) {
        const cached = getCachedBooks()
        if (cached.length > 0) {
          const filtered = filterBooks(cached, preferences)
          setFilteredBooks(
            (filtered.length > 0 ? filtered : cached).slice(0, MAX_DECK_SIZE)
          )
          setBookReasons({}) // fallback deck was never scored — drop stale reasons
          // The fallback is a NEW deck — without these resets a stale index
          // from the previous batch would land past the deck end and show the
          // batch-complete screen instead of the books.
          setCurrentIndex(0)
          setPassedBooks([])
          setUndoStack([])
        }
        showToast("Couldn't load new books. Showing cached results.", "error")
      }
    } finally {
      setIsLoading(false)
    }
  }

  useEffect(() => {
    // Leaving Discover unmounts this whole component, so first try to resume
    // the deck the user was actually on. Only when there is no usable snapshot
    // do we pay for a fetch — that round trip used to cost 114 requests and
    // land the user on a different book.
    /* eslint-disable react-hooks/set-state-in-effect */
    const resumed = loadDeckSession(preferences)
    if (resumed) {
      setFilteredBooks(resumed.books)
      setCurrentIndex(resumed.currentIndex)
      setUndoStack(resumed.undoStack)
      setBatchCount(resumed.batchCount)
      setIsLoading(false)
      return
    }
    // Deck fetch. loadBooks flips the loading flag synchronously before its
    // first await — the canonical "start async work" trigger — and it is
    // intentionally re-run only when preferences change, not on every render
    // (the function closes over fresh state each time it is called).
    loadBooks()
    /* eslint-enable react-hooks/set-state-in-effect */
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [preferences])

  // Mirror deck position into the session snapshot. Writing on change (rather
  // than on unmount) survives a tab close, a crash and a hard navigation, none
  // of which run cleanup reliably.
  useEffect(() => {
    if (isLoading || filteredBooks.length === 0) return
    saveDeckSession(filteredBooks, currentIndex, undoStack, batchCount, preferences)
  }, [filteredBooks, currentIndex, undoStack, batchCount, preferences, isLoading])

  // Fetch collaborative-filtering co-like counts (social proof) for signed-in
  // users. Keyed on the user's liked books; the RPC returns counts for books
  // that similar readers also liked. No-ops when Supabase isn't configured or
  // the user isn't signed in. Best-effort — failures just mean no badge.
  useEffect(() => {
    if (!isSupabaseConfigured()) return
    const ids = getLikedBooks().map((b) => b.id)
    let cancelled = false
    // Route the empty case through the same async path, so the state update
    // always lands in a promise callback rather than synchronously in the
    // effect body (which would cost a cascading render).
    const pending = ids.length === 0
      ? Promise.resolve(new Map<string, number>())
      : getCoLikeCounts(ids)
    pending.then((map) => {
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
      addPassedBookId(currentBook.id, currentBook.genre, currentBook.mood, currentBook.author) // persist for negative signal
    }

    setUndoStack(prev => [...prev, { book: currentBook, direction }])
    setCurrentIndex(prev => prev + 1)
    rerankTail(currentIndex + 1)

    // Record swipe to cloud for collaborative filtering (fire-and-forget)
    recordSwipe(currentBook.id, direction, currentBook)
  }

  /**
   * Re-order the part of the queue the user cannot see yet, so a like or a pass
   * changes what comes next inside this session instead of only affecting the
   * next batch.
   *
   * Everything up to nextIndex + 2 is left exactly as it is: those are the top
   * card, the card peeking behind it, and one card of slack. Cards are keyed by
   * book.id, so reordering a visible slot would visibly swap a card mid-swipe.
   */
  const rerankTail = (nextIndex: number) => {
    const liked = getLikedBooks()
    // Same gate as the initial rank: a 1-2 book profile makes similarity
    // ranking tunnel, which is worse than the order we already have.
    if (liked.length < 3) return
    const frozenUntil = nextIndex + 3
    setFilteredBooks(prev => {
      if (prev.length - frozenUntil < 4) return prev
      const head = prev.slice(0, frozenUntil)
      const tail = prev.slice(frozenUntil)
      const likedIds = new Set(liked.map(b => b.id))
      const scored = scoreBooks(tail, liked, { communityBoost: true, excludeIds: likedIds })
      if (scored.length === 0) return prev
      const reordered = applyMMR(scored, tail.length, 0.7).map(s => s.book)
      // MMR can drop candidates; keep any it left behind at the back rather
      // than shortening the queue under the user.
      const seen = new Set(reordered.map(b => b.id))
      const leftovers = tail.filter(b => !seen.has(b.id))
      return [...head, ...reordered, ...leftovers]
    })
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

  // Goodreads-parity upgrade for the two cards the user can see (ADR-0005).
  // Enriched books carry metadata.enriched, so re-runs are no-ops.
  useEffect(() => {
    const visible = [currentBook, nextBook].filter(
      (b): b is Book => !!b && !b.metadata?.enriched
    )
    if (visible.length === 0) return
    let cancelled = false
    upgradeVisibleBooks(visible, (landed) => {
      if (cancelled) return
      setFilteredBooks(prev => {
        const patch = new Map(landed.map(b => [b.id, b]))
        return prev.map(b => patch.get(b.id) ?? b)
      })
    })
    return () => { cancelled = true }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [currentBook?.id, nextBook?.id])

  // Refs to avoid stale closures in keyboard handler
  const handleSwipeRef = useRef(handleSwipe)
  const handleUndoRef = useRef(handleUndo)
  const hasMoreRef = useRef(hasMoreBooks)
  const currentBookRef = useRef(currentBook)
  const overlayOpenRef = useRef(false)
  // Written directly by BookCard callbacks (not state): the info sheet must
  // pause keyboard swipes the instant it opens.
  const sheetOpenRef = useRef(false)
  // Latest-ref pattern: refs are updated AFTER each commit, never during
  // render, so the stable keyboard handler below always sees current values.
  useEffect(() => {
    handleSwipeRef.current = handleSwipe
    handleUndoRef.current = handleUndo
    hasMoreRef.current = hasMoreBooks
    currentBookRef.current = currentBook
    overlayOpenRef.current = !!showcaseBook || !!detailBook
  })

  // Keyboard navigation for swipe actions
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      // Never act on keys the user aimed elsewhere: an open Showcase/Detail
      // overlay owns the keyboard, and typing contexts (global search lives
      // outside this component) must keep native behavior — including Ctrl+Z.
      const el = document.activeElement
      if (
        overlayOpenRef.current ||
        sheetOpenRef.current ||
        (el instanceof HTMLElement &&
          (el.tagName === "INPUT" || el.tagName === "TEXTAREA" || el.isContentEditable))
      ) {
        return
      }
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

  // Prefetch the next batch while the user is still swiping this one, so the
  // "Nice batch!" wall only ever appears when the network genuinely has
  // nothing to add (audit finding #1). Ref-guarded: one in-flight prefetch,
  // and enriched/appended books never reset index, undo, or passed state.
  const prefetchingRef = useRef(false)
  useEffect(() => {
    if (isLoading || prefetchingRef.current) return
    if (filteredBooks.length === 0) return
    if (currentIndex < filteredBooks.length - 5) return
    prefetchingRef.current = true
    ;(async () => {
      try {
        await fetchFreshIntoCache()
        const seen = new Set(filteredBooks.map(b => b.id))
        const { deck: more, reasons } = rankLocalDeck(seen)
        if (more.length === 0) return
        setBookReasons(prev => ({ ...reasons, ...prev }))
        setFilteredBooks(prev => {
          const have = new Set(prev.map(b => b.id))
          const passedSet = new Set(getPassedBookIds())
          const add = more.filter(b => !have.has(b.id) && !passedSet.has(b.id))
          return add.length > 0 ? [...prev, ...add] : prev
        })
      } catch {
        // best-effort — the batch-complete screen remains the fallback
      } finally {
        prefetchingRef.current = false
      }
    })()
    // fetch/rank close over fresh state per call; deps trigger on progress.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [currentIndex, isLoading, filteredBooks.length])

  // Loading — skeleton mirrors the real card anatomy (never a spinner)
  if (isLoading) {
    return (
      <div className="bg-surface-0 flex flex-col items-center justify-center gap-5 p-4" style={{ minHeight: "100dvh" }} aria-busy="true" aria-label="Finding books for you">
        <div className="w-[264px] h-[396px] rounded-cover shimmer" />
        <div className="w-[300px] space-y-2.5">
          <div className="h-3 w-24 rounded shimmer" />
          <div className="h-6 w-full rounded shimmer" />
          <div className="h-6 w-2/3 rounded shimmer" />
          <div className="h-4 w-32 rounded shimmer" />
        </div>
      </div>
    )
  }

  // No matches
  if (filteredBooks.length === 0) {
    return (
      <div className="bg-surface-0 flex items-center justify-center p-6 pb-16" style={{ minHeight: "100dvh" }}>
        <motion.div
          className="text-center max-w-sm"
          initial={{ opacity: 0, y: 8 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.24, ease: [0.22, 1, 0.36, 1] }}
        >
          <div className="w-16 h-16 bg-surface-2 rounded-card flex items-center justify-center mx-auto mb-5">
            <BookOpen className="w-8 h-8 text-ink" strokeWidth={1.8} />
          </div>
          <h2 className="font-serif font-semibold text-[30px] leading-[1.08] text-ink mb-2">
            No matches yet
          </h2>
          <p className="text-ink-muted mb-6 leading-relaxed">
            We couldn&apos;t find books for your current preferences. Try adjusting your taste profile.
          </p>
          <Button
            onClick={onRestart}
            className="h-11 px-6 bg-ink hover:bg-ink/90 text-surface-0 font-semibold rounded-full"
          >
            <Settings2 className="w-4 h-4 mr-2" />
            Update Preferences
          </Button>
        </motion.div>
      </div>
    )
  }

  // Done swiping
  if (!hasMoreBooks) {
    return (
      <div className="bg-surface-0 flex items-center justify-center p-6 pb-16" style={{ minHeight: "100dvh" }}>
        <motion.div
          className="text-center max-w-sm w-full"
          initial={{ opacity: 0, y: 8 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.24, ease: [0.22, 1, 0.36, 1] }}
        >
          <div className="w-16 h-16 bg-surface-2 rounded-card flex items-center justify-center mx-auto mb-5">
            <Heart className="w-8 h-8 text-success" strokeWidth={1.8} />
          </div>
          <h2 className="font-serif font-semibold text-[30px] leading-[1.08] text-ink mb-2">
            Nice batch!
          </h2>
          <p className="text-ink-muted mb-6">
            You&apos;ve gone through {filteredBooks.length} books. Ready for more or head to your library?
          </p>

          {/* Stats — serif numbers over a hairline, no tiles */}
          <div className="flex justify-center divide-x divide-border border-y border-border py-3 mb-6">
            <div className="text-center px-8">
              <p className="font-serif font-semibold text-[26px] text-success-ink tabular-nums">{sessionLikedBooks.length}</p>
              <p className="text-xs text-ink-muted mt-0.5">Saved</p>
            </div>
            <div className="text-center px-8">
              <p className="font-serif font-semibold text-[26px] text-ink-muted tabular-nums">{passedBooks.length}</p>
              <p className="text-xs text-ink-muted mt-0.5">Passed</p>
            </div>
          </div>

          {/* Liked books list — hairline rows */}
          {sessionLikedBooks.length > 0 && (
            <div className="mb-6 text-left">
              <h3 className="text-[11px] font-bold text-ink-muted uppercase tracking-[0.12em] mb-2">
                Your picks
              </h3>
              <div className="max-h-32 overflow-y-auto divide-y divide-border border-y border-border">
                {sessionLikedBooks.map((book, index) => (
                  <motion.div
                    key={book.id}
                    initial={{ opacity: 0, x: -8 }}
                    animate={{ opacity: 1, x: 0 }}
                    transition={{ delay: Math.min(index * 0.03, 0.2) }}
                    className="text-[13px] text-ink py-2"
                  >
                    <span className="font-serif font-semibold">{book.title}</span>
                    <span className="text-ink-muted"> by {book.author}</span>
                  </motion.div>
                ))}
              </div>
            </div>
          )}

          {/* Actions */}
          <div className="flex gap-3">
            <Button
              onClick={onViewLibrary}
              className="flex-1 h-11 bg-ink hover:bg-ink/90 text-surface-0 font-semibold rounded-full"
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
              className="flex-1 h-11 border-border-strong hover:bg-surface-2 text-ink font-semibold rounded-full"
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

        {/* Header — 52px, hairline; the counter lives in the deck strand */}
        <div className="bg-[rgba(250,247,241,.92)] dark:bg-[rgba(20,17,16,.92)] backdrop-blur-md border-b border-border sticky top-0 z-20">
          <div className="px-4 sm:px-6 h-[52px] flex justify-between items-center max-w-md lg:max-w-[820px] mx-auto">
            <button
              onClick={onViewLibrary}
              aria-label="View library"
              className="flex items-center gap-1.5 px-2 -ml-2 rounded-control text-ink-muted hover:text-ink hover:bg-surface-2 transition-colors tap-target touch-manipulation"
            >
              <BookOpen className="w-[18px] h-[18px]" strokeWidth={1.8} />
              <span className="text-sm font-medium tabular-nums">{likedBooks.length}</span>
            </button>

            <h1 className="font-serif font-semibold text-[18px] text-ink tracking-tight">
              BookSwipe
            </h1>

            <button
              onClick={onRestart}
              aria-label="Update preferences"
              className="flex items-center justify-center p-2 -mr-2 rounded-control text-ink-muted hover:text-ink hover:bg-surface-2 transition-colors tap-target touch-manipulation"
            >
              <Settings2 className="w-5 h-5" strokeWidth={1.8} />
            </button>
          </div>
          {/* Deck strand: 2px progress track + right-aligned counter */}
          <div className="max-w-md lg:max-w-[820px] mx-auto px-4 sm:px-6 pb-1.5">
            <div className="h-[2px] bg-surface-2 rounded-full overflow-hidden">
              <div
                className="h-full bg-ink transition-[width] duration-300"
                style={{ width: `${Math.min(100, ((currentIndex + 1) / Math.max(1, filteredBooks.length)) * 100)}%` }}
              />
            </div>
            <p className="text-right font-mono text-[10.5px] text-ink-muted mt-1 tabular-nums [@media(max-height:700px)]:hidden">
              {currentIndex + 1} / {filteredBooks.length}
            </p>
          </div>
        </div>

        {/* Card stack + action buttons together */}
        <div className="flex-1 flex flex-col items-center justify-center p-2 sm:p-4 pb-14 sm:pb-6">
          <div className="relative w-full max-w-sm lg:max-w-[820px]">
            <motion.div
              className="relative h-[604px] [@media(max-height:700px)]:h-[440px] sm:h-[620px] lg:h-[500px]"
              initial={{ scale: 0.97, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              transition={{ duration: 0.24, ease: [0.22, 1, 0.36, 1] }}
            >
              {/* Keyed by book.id, NOT by deck position: a role-based key
                  (`${id}-next` / `${id}-current`) gave the same book a different
                  key depending on where it sat, so the card the user was already
                  peeking at was destroyed and rebuilt the instant it was promoted
                  — remounting its BookCover, which then replayed its placeholder
                  and 300ms fade for art that was already painted and cached.
                  Stacking is z-index driven (isTop ? z-10 : z-0), so the DOM
                  reorder React does instead is visually inert. */}
              <AnimatePresence>
                {nextBook && (
                  <BookCard
                    key={nextBook.id}
                    book={nextBook}
                    onSwipe={() => {}}
                    isTop={false}
                  />
                )}
                {currentBook && (
                  <BookCard
                    key={currentBook.id}
                    book={currentBook}
                    onSwipe={handleSwipe}
                    isTop={true}
                    reason={bookReasons[currentBook.id]}
                    coLikeCount={coLikeCounts[currentBook.id]}
                    onOpenDetails={() => setShowcaseBook(currentBook)}
                    onSheetToggle={(open) => { sheetOpenRef.current = open }}
                  />
                )}
              </AnimatePresence>
              {/* Look-ahead cover preload: warm the browser + image-optimizer
                  caches for the next few cards so they surface with their art
                  already loaded. Same sizes/quality as the card's BookCover so
                  the optimized URL matches exactly. Open Library's origin can
                  take seconds on a cold fetch — this buys that time upfront. */}
              <div aria-hidden className="pointer-events-none absolute h-px w-px overflow-hidden opacity-0">
                {filteredBooks.slice(currentIndex + 2, currentIndex + 5).map((b, i) => (
                  <div key={`preload-${currentIndex + 2 + i}-${b.id}`} className="relative h-px w-px">
                    {/* Same sizes as the card, or this warms a URL the card
                        never asks for. priority is deliberately absent: these
                        are offscreen and must not load eagerly. */}
                    <Image src={b.cover} alt="" fill sizes={DECK_COVER_SIZES} quality={85} />
                  </div>
                ))}
              </div>
            </motion.div>
          </div>

          {/* Action buttons — under the card (mobile) / under the caption
              column of the magazine spread (desktop: cover 312 + gap 64).
              relative z-10 is load-bearing on desktop: lg:-mt-16 pulls this row
              back inside the card stack's box, and the stack is a transformed
              motion.div (its own stacking context) that would otherwise paint
              over the buttons and swallow every click. */}
          <div className="relative z-10 w-full max-w-sm lg:max-w-[820px] px-4 lg:px-0 mt-3 [@media(max-height:700px)]:mt-1 lg:-mt-16 lg:pl-[376px]">
            <div className="flex justify-center lg:justify-start items-center gap-4 mb-3">
              <motion.button
                whileTap={{ scale: 0.97 }}
                aria-label="Pass on this book"
                className="w-14 h-14 rounded-full border border-border-strong bg-surface-1 flex items-center justify-center transition-colors hover:border-ink-muted tap-target touch-manipulation"
                onClick={() => handleSwipe("left")}
              >
                <X className="w-6 h-6 text-destructive" />
              </motion.button>

              <motion.button
                whileTap={{ scale: 0.97 }}
                aria-label="Undo last swipe"
                disabled={undoStack.length === 0}
                className={`w-11 h-11 rounded-full border border-border bg-surface-1 flex items-center justify-center transition-colors tap-target touch-manipulation ${
                  undoStack.length > 0
                    ? "text-ink-muted hover:text-ink"
                    : "text-ink-faint cursor-not-allowed"
                }`}
                onClick={handleUndo}
              >
                <Undo2 className="w-4 h-4" />
              </motion.button>

              <motion.button
                whileTap={{ scale: 0.97 }}
                aria-label="Like this book"
                className="w-14 h-14 rounded-full bg-success hover:bg-success/90 flex items-center justify-center transition-colors tap-target touch-manipulation"
                onClick={() => handleSwipe("right")}
              >
                <Heart className="w-6 h-6 text-on-success" />
              </motion.button>
            </div>

            <p className="text-center lg:text-left text-xs text-ink-muted [@media(max-height:700px)]:hidden lg:[@media(max-height:700px)]:block">
              <span className="lg:hidden">Swipe left to pass · right to save</span>
              <span className="hidden lg:inline">
                <kbd className="px-1.5 py-0.5 rounded bg-surface-2 text-ink-muted font-mono text-[10.5px]">&larr;</kbd> Pass
                <span className="mx-2 text-ink-faint">·</span>
                <kbd className="px-1.5 py-0.5 rounded bg-surface-2 text-ink-muted font-mono text-[10.5px]">&rarr;</kbd> Save
                <span className="mx-2 text-ink-faint">·</span>
                <kbd className="px-1.5 py-0.5 rounded bg-surface-2 text-ink-muted font-mono text-[10.5px]">Ctrl+Z</kbd> Undo
              </span>
            </p>
          </div>
        </div>
      </div>

      {/* 3D Showcase — tap on the top card; "Details" continues to the modal */}
      <BookShowcase
        book={showcaseBook}
        onClose={() => setShowcaseBook(null)}
        onMoreDetails={(book) => setDetailBook(book)}
      />
      <BookDetailModal
        book={detailBook}
        isOpen={!!detailBook}
        onClose={() => setDetailBook(null)}
        onBookClick={(book) => {
          if (book) setDetailBook(book)
        }}
      />
    </div>
  )
}
