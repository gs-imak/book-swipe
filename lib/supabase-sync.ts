"use client"

import { supabase, isSupabaseConfigured } from "./supabase"
import { Book } from "./book-data"
import { getLikedBooks, getBookReviews, getReadingProgress, type BookReview, type ReadingProgress } from "./storage"

// ─── Auth helpers ───────────────────────────────────────────────────────────

// Cache the resolved user for a short window. supabase.auth.getUser() makes a
// network round-trip to the auth server on every call, and a single sync op calls
// getUser() many times (syncToCloud, recordSwipe, getCollaborativeRecs all do).
// The cache is invalidated on any auth state change (see onAuthChange below) and
// after a short TTL, so it never serves a stale session beyond that window.
type CachedUser = Awaited<ReturnType<NonNullable<typeof supabase>["auth"]["getUser"]>>["data"]["user"]
let cachedUser: CachedUser = null
let cachedUserAt = 0
const USER_CACHE_TTL_MS = 30_000

function clearUserCache() {
  cachedUser = null
  cachedUserAt = 0
}

export async function getUser() {
  if (!supabase) return null
  if (cachedUser && Date.now() - cachedUserAt < USER_CACHE_TTL_MS) {
    return cachedUser
  }
  const { data, error } = await supabase.auth.getUser()
  if (error) {
    // Don't throw: callers treat a null user as "not signed in" and degrade
    // gracefully (skip cloud sync). Surface the cause for debugging.
    console.warn("[BookSwipe] getUser failed:", error.message)
    clearUserCache()
    return null
  }
  cachedUser = data.user
  cachedUserAt = Date.now()
  return cachedUser
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
  // Always return the same { data: { subscription: { unsubscribe } } } shape so the
  // caller (app/page.tsx useEffect cleanup) can always call
  // data.subscription.unsubscribe() — including when Supabase is not configured —
  // which prevents a dangling listener / leak.
  if (!supabase) return { data: { subscription: { unsubscribe: () => {} } } }
  return supabase.auth.onAuthStateChange((_event, session) => {
    // The cached user is now stale (sign-in/out/token refresh); drop it so the next
    // getUser() re-reads the real session.
    clearUserCache()
    callback(session?.user ?? null)
  })
}

// ─── Book upsert (shared catalog) ───────────────────────────────────────────

async function upsertBook(book: Book): Promise<{ error: unknown | null }> {
  if (!supabase) return { error: null }
  // ignoreDuplicates:true => "insert if absent, no-op if the id already exists".
  // This matches the books RLS policy, which is INSERT-only (no UPDATE policy): an
  // ON CONFLICT DO UPDATE would be blocked by RLS for a row another user created.
  // The shared catalog is therefore first-writer-wins and immutable from clients.
  const { error } = await supabase.from("books").upsert({
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
  }, { onConflict: "id", ignoreDuplicates: true })
  return { error }
}

// ─── Sync: localStorage → Supabase ─────────────────────────────────────────

export async function syncToCloud(): Promise<{
  synced: boolean
  reason?: string
  books?: number
  reviews?: number
}> {
  if (!supabase) return { synced: false, reason: "not configured" }

  const user = await getUser()
  if (!user) return { synced: false, reason: "not signed in" }

  const likedBooks = getLikedBooks()
  const reviews = getBookReviews()
  const progress = getReadingProgress()

  // Collect every failure so the caller learns the sync did NOT fully succeed,
  // instead of the old behaviour of always returning { synced: true }.
  const errors: string[] = []

  // 1. Upsert all books to the shared catalog. upsertBook now returns its error.
  const bookResults = await Promise.allSettled(likedBooks.map(book => upsertBook(book)))
  for (const r of bookResults) {
    if (r.status === "rejected") errors.push(`book upsert threw: ${String(r.reason)}`)
    else if (r.value.error) errors.push(`book upsert: ${stringifyError(r.value.error)}`)
  }

  // 2. Sync the user's library.
  // CONFLICT RESOLUTION (P2-A 6a): do NOT send date_added. user_books.date_added
  // defaults to now() on first insert and must be PRESERVED as the original
  // library-add time — re-sending now() on every sync reset it. Omitting it keeps
  // the DB default on insert and leaves the stored value untouched on conflict.
  // We bump updated_at so a future last-writer-wins comparison has a freshness marker.
  const now = new Date().toISOString()
  const userBooksData = likedBooks.map(book => ({
    user_id: user.id,
    book_id: book.id,
    updated_at: now,
  }))

  if (userBooksData.length > 0) {
    const { error } = await supabase.from("user_books").upsert(userBooksData, {
      onConflict: "user_id,book_id",
    })
    if (error) errors.push(`user_books: ${stringifyError(error)}`)
  }

  // 3. Sync reviews with last-writer-wins by updated_at (P1-6).
  // PostgREST upsert unconditionally overwrites on conflict, so a stale device
  // could clobber a newer cloud review. To prevent that we first read the cloud
  // updated_at for the caller's reviews and only push rows that are newer than (or
  // absent from) the cloud. created_at is intentionally NOT pushed on conflict —
  // the original cloud creation time is preserved (we only send it for brand-new rows).
  const existingReviewTimes = await fetchUpdatedAtMap("reviews", user.id)
  if (existingReviewTimes === null) {
    errors.push("reviews: could not read existing updated_at for conflict resolution")
  } else {
    const reviewsData = reviews
      .filter(r => isLocalNewer(r.updatedAt, existingReviewTimes.get(r.bookId)))
      .map(r => {
        const isNew = !existingReviewTimes.has(r.bookId)
        return {
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
          // Reading-session metadata (P2-A 6b) — preserved across the round-trip.
          date_started: r.dateStarted || null,
          date_finished: r.dateFinished || null,
          reading_time_minutes: r.readingTime ?? null,
          // Only seed created_at for genuinely new rows; never overwrite the cloud's
          // original created_at on an update.
          ...(isNew ? { created_at: r.createdAt } : {}),
          updated_at: r.updatedAt,
        }
      })

    if (reviewsData.length > 0) {
      const { error } = await supabase.from("reviews").upsert(reviewsData, {
        onConflict: "user_id,book_id",
      })
      if (error) errors.push(`reviews: ${stringifyError(error)}`)
    }
  }

  // 4. Sync reading progress with the same last-writer-wins guard, keyed on
  // last_read_date (its freshness marker).
  const existingProgressTimes = await fetchUpdatedAtMap("reading_progress", user.id, "last_read_date")
  if (existingProgressTimes === null) {
    errors.push("reading_progress: could not read existing last_read_date for conflict resolution")
  } else {
    const progressData = progress
      .filter(p => isLocalNewer(p.lastReadDate, existingProgressTimes.get(p.bookId)))
      .map(p => ({
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
      const { error } = await supabase.from("reading_progress").upsert(progressData, {
        onConflict: "user_id,book_id",
      })
      if (error) errors.push(`reading_progress: ${stringifyError(error)}`)
    }
  }

  if (errors.length > 0) {
    return { synced: false, reason: errors.join("; ") }
  }
  return { synced: true, books: likedBooks.length, reviews: reviews.length }
}

// ─── Sync helpers ────────────────────────────────────────────────────────────

function stringifyError(error: unknown): string {
  if (error && typeof error === "object" && "message" in error) {
    return String((error as { message: unknown }).message)
  }
  return String(error)
}

/**
 * Reads { book_id -> freshness timestamp } for the caller's rows in `table`, used
 * for last-writer-wins conflict resolution before an upsert. Returns null on a read
 * error (caller treats that as "skip this section, report it") so we never silently
 * clobber cloud data when we couldn't verify what's there.
 */
async function fetchUpdatedAtMap(
  table: "reviews" | "reading_progress",
  userId: string,
  column: "updated_at" | "last_read_date" = "updated_at",
): Promise<Map<string, string> | null> {
  if (!supabase) return new Map()
  const { data, error } = await supabase
    .from(table)
    .select(`book_id, ${column}`)
    .eq("user_id", userId)
  if (error) return null
  const map = new Map<string, string>()
  for (const row of (data || []) as Array<Record<string, string>>) {
    if (row.book_id && row[column]) map.set(row.book_id, row[column])
  }
  return map
}

/**
 * True if the local record should win: either the cloud has no such row, or the
 * local timestamp is strictly newer. Unparseable/missing local time => treat as not
 * newer (don't risk clobbering cloud with an undated local record).
 */
function isLocalNewer(localTime: string | undefined, cloudTime: string | undefined): boolean {
  if (!cloudTime) return true // not in cloud yet → push it
  if (!localTime) return false // no local timestamp → don't overwrite newer-or-equal cloud
  const local = Date.parse(localTime)
  const cloud = Date.parse(cloudTime)
  if (Number.isNaN(local)) return false
  if (Number.isNaN(cloud)) return true
  return local > cloud
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
    // P2-A 6b: preserve reading-session metadata instead of dropping it. These are
    // now persisted columns (see schema), so the round-trip keeps them.
    dateStarted: r.date_started ?? undefined,
    dateFinished: r.date_finished ?? undefined,
    readingTime: r.reading_time_minutes ?? undefined,
    createdAt: r.created_at,
    updatedAt: r.updated_at,
  }))

  return { books, reviews }
}

// ─── Record swipe for collaborative filtering ───────────────────────────────

export async function recordSwipe(
  bookId: string,
  direction: "left" | "right",
  book?: Book,
): Promise<{ ok: boolean; reason?: string }> {
  if (!supabase) return { ok: false, reason: "not configured" }
  const user = await getUser()
  if (!user) return { ok: false, reason: "not signed in" }

  // Upsert the book to the catalog first (best-effort; a catalog write failure
  // shouldn't block recording the swipe, but we surface it).
  if (book) {
    const { error: bookErr } = await upsertBook(book)
    if (bookErr) {
      console.warn("[BookSwipe] recordSwipe: book upsert failed:", stringifyError(bookErr))
    }
  }

  // There is one row per (user, book) by the unique constraint, so this upsert
  // intentionally REPLACES the prior decision with the latest swipe (a user can
  // re-decide a book). swiped_at + updated_at record WHEN that latest decision was
  // made, so it's preserved correctly rather than left stale. The schema's swipe
  // UPDATE policy permits the conflict path for the caller's own row.
  const nowIso = new Date().toISOString()
  const { error } = await supabase.from("swipe_history").upsert({
    user_id: user.id,
    book_id: bookId,
    direction,
    swiped_at: nowIso,
    updated_at: nowIso,
  }, { onConflict: "user_id,book_id" })

  if (error) {
    // P1-7: surface the failure instead of swallowing it.
    console.warn("[BookSwipe] recordSwipe failed:", stringifyError(error))
    return { ok: false, reason: stringifyError(error) }
  }
  return { ok: true }
}

// ─── Collaborative filtering: get recs from other users ─────────────────────

export async function getCollaborativeRecs(likedBookIds: string[], limit: number = 10): Promise<string[]> {
  if (!supabase || likedBookIds.length === 0) return []

  // P1-5 (injection) + P1-4 (RLS): the old implementation read other users' raw
  // swipe_history rows from the client and excluded the caller's books with a
  // string-concatenated PostgREST filter:
  //   .not("book_id", "in", `(${likedBookIds.join(",")})`)
  // Book IDs can contain commas / parens / quotes (e.g. some Google Books ids), which
  // broke the filter and allowed filter injection. Both problems are gone now:
  //   - The aggregation runs server-side in the security-definer RPC
  //     public.get_co_like_counts (own-row RLS would otherwise hide other users' rows).
  //   - likedBookIds is passed as an ARRAY PARAMETER, never interpolated — so no
  //     value inside it can alter the query. The RPC also excludes the caller's own
  //     books and own user from the aggregate. We only ever receive aggregate counts.
  // Pass the full liked list so the RPC both seeds neighbours from it AND excludes
  // every already-liked book from the results (never recommend a book you have).
  const { data, error } = await supabase.rpc("get_co_like_counts", {
    liked_book_ids: likedBookIds,
  })

  if (error) {
    console.warn("[BookSwipe] getCollaborativeRecs RPC failed:", stringifyError(error))
    return []
  }
  if (!data) return []

  // RPC already returns rows ordered by co_like_count desc; just take the top N ids.
  return (data as Array<{ book_id: string; co_like_count: number }>)
    .slice(0, limit)
    .map(row => row.book_id)
}
