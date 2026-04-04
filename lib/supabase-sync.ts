"use client"

import { supabase, isSupabaseConfigured } from "./supabase"
import { Book } from "./book-data"
import { getLikedBooks, getBookReviews, getReadingProgress, type BookReview, type ReadingProgress } from "./storage"

// ─── Auth helpers ───────────────────────────────────────────────────────────

export async function getUser() {
  if (!supabase) return null
  const { data: { user } } = await supabase.auth.getUser()
  return user
}

export async function signInWithEmail(email: string, password: string) {
  if (!supabase) throw new Error("Supabase not configured")
  return supabase.auth.signInWithPassword({ email, password })
}

export async function signUpWithEmail(email: string, password: string) {
  if (!supabase) throw new Error("Supabase not configured")
  return supabase.auth.signUp({ email, password })
}

export async function signInWithGoogle() {
  if (!supabase) throw new Error("Supabase not configured")
  return supabase.auth.signInWithOAuth({
    provider: "google",
    options: { redirectTo: `${window.location.origin}` },
  })
}

export async function signOut() {
  if (!supabase) return
  return supabase.auth.signOut()
}

export function onAuthChange(callback: (user: any) => void) {
  if (!supabase) return { data: { subscription: { unsubscribe: () => {} } } }
  return supabase.auth.onAuthStateChange((_event, session) => {
    callback(session?.user ?? null)
  })
}

// ─── Book upsert (shared catalog) ───────────────────────────────────────────

async function upsertBook(book: Book) {
  if (!supabase) return
  await supabase.from("books").upsert({
    id: book.id,
    title: book.title,
    author: book.author,
    cover: book.cover,
    cover_fallback: book.coverFallback || null,
    rating: book.rating,
    pages: book.pages,
    genre: book.genre,
    mood: book.mood,
    description: book.description,
    published_year: book.publishedYear,
    isbn: book.isbn || null,
    subjects: book.metadata?.subjects || [],
  }, { onConflict: "id" })
}

// ─── Sync: localStorage → Supabase ─────────────────────────────────────────

export async function syncToCloud() {
  if (!supabase) return { synced: false, reason: "not configured" }

  const user = await getUser()
  if (!user) return { synced: false, reason: "not signed in" }

  const likedBooks = getLikedBooks()
  const reviews = getBookReviews()
  const progress = getReadingProgress()

  // 1. Upsert all books to shared catalog
  const bookPromises = likedBooks.map(book => upsertBook(book))
  await Promise.allSettled(bookPromises)

  // 2. Sync user's library
  const userBooksData = likedBooks.map(book => ({
    user_id: user.id,
    book_id: book.id,
    date_added: new Date().toISOString(),
  }))

  if (userBooksData.length > 0) {
    await supabase.from("user_books").upsert(userBooksData, {
      onConflict: "user_id,book_id",
    })
  }

  // 3. Sync reviews
  const reviewsData = reviews.map(r => ({
    user_id: user.id,
    book_id: r.bookId,
    rating: r.rating,
    review_text: r.review || null,
    favorite: r.favorite,
    mood: r.mood || null,
    pace: r.pace || null,
    format: r.format || null,
    tags: r.tags,
    content_warnings: r.contentWarnings || [],
    dimensions: r.dimensions || null,
    created_at: r.createdAt,
    updated_at: r.updatedAt,
  }))

  if (reviewsData.length > 0) {
    await supabase.from("reviews").upsert(reviewsData, {
      onConflict: "user_id,book_id",
    })
  }

  // 4. Sync reading progress
  const progressData = progress.map(p => ({
    user_id: user.id,
    book_id: p.bookId,
    current_page: p.currentPage,
    total_pages: p.totalPages,
    time_spent_minutes: p.timeSpentMinutes,
    status: p.status,
    started_date: p.startedDate,
    last_read_date: p.lastReadDate,
  }))

  if (progressData.length > 0) {
    await supabase.from("reading_progress").upsert(progressData, {
      onConflict: "user_id,book_id",
    })
  }

  return { synced: true, books: likedBooks.length, reviews: reviews.length }
}

// ─── Sync: Supabase → localStorage ─────────────────────────────────────────

export async function syncFromCloud(): Promise<{ books: Book[]; reviews: BookReview[] } | null> {
  if (!supabase) return null

  const user = await getUser()
  if (!user) return null

  // Fetch user's books with full book data
  const { data: userBooks } = await supabase
    .from("user_books")
    .select("book_id, shelf, format, books(*)")
    .eq("user_id", user.id)

  if (!userBooks) return null

  const books: Book[] = userBooks
    .filter((ub: any) => ub.books)
    .map((ub: any) => ({
      id: ub.books.id,
      title: ub.books.title,
      author: ub.books.author,
      cover: ub.books.cover,
      coverFallback: ub.books.cover_fallback,
      rating: ub.books.rating,
      pages: ub.books.pages,
      genre: ub.books.genre || [],
      mood: ub.books.mood || [],
      description: ub.books.description || "",
      publishedYear: ub.books.published_year || 0,
      readingTime: "",
      isbn: ub.books.isbn,
    }))

  // Fetch reviews
  const { data: cloudReviews } = await supabase
    .from("reviews")
    .select("*")
    .eq("user_id", user.id)

  const reviews: BookReview[] = (cloudReviews || []).map((r: any) => ({
    bookId: r.book_id,
    rating: r.rating,
    review: r.review_text,
    favorite: r.favorite,
    mood: r.mood || "",
    pace: r.pace,
    format: r.format,
    tags: r.tags || [],
    contentWarnings: r.content_warnings || [],
    dimensions: r.dimensions,
    dateStarted: undefined,
    dateFinished: undefined,
    createdAt: r.created_at,
    updatedAt: r.updated_at,
  }))

  return { books, reviews }
}

// ─── Record swipe for collaborative filtering ───────────────────────────────

export async function recordSwipe(bookId: string, direction: "left" | "right", book?: Book) {
  if (!supabase) return
  const user = await getUser()
  if (!user) return

  // Upsert the book to catalog first
  if (book) await upsertBook(book)

  await supabase.from("swipe_history").upsert({
    user_id: user.id,
    book_id: bookId,
    direction,
    swiped_at: new Date().toISOString(),
  }, { onConflict: "user_id,book_id" })
}

// ─── Collaborative filtering: get recs from other users ─────────────────────

export async function getCollaborativeRecs(likedBookIds: string[], limit: number = 10): Promise<string[]> {
  if (!supabase || likedBookIds.length === 0) return []

  // Find books that other users who liked the same books also liked
  const { data } = await supabase
    .from("swipe_history")
    .select("book_id, user_id")
    .in("book_id", likedBookIds.slice(-20))
    .eq("direction", "right")

  if (!data || data.length === 0) return []

  // Find users who share likes
  const currentUser = await getUser()
  const userIds = new Set<string>()
  data.forEach((row: any) => {
    if (row.user_id !== currentUser?.id) userIds.add(row.user_id)
  })

  if (userIds.size === 0) return []

  // Get what those users liked that we haven't seen
  const { data: otherLikes } = await supabase
    .from("swipe_history")
    .select("book_id")
    .in("user_id", Array.from(userIds).slice(0, 50))
    .eq("direction", "right")
    .not("book_id", "in", `(${likedBookIds.join(",")})`)

  if (!otherLikes) return []

  // Count frequency — more users who liked it = stronger signal
  const counts: Record<string, number> = {}
  otherLikes.forEach((row: any) => {
    counts[row.book_id] = (counts[row.book_id] || 0) + 1
  })

  return Object.entries(counts)
    .sort((a, b) => b[1] - a[1])
    .slice(0, limit)
    .map(([bookId]) => bookId)
}
