"use client"

import { supabase, isSupabaseConfigured } from "./supabase"
import { Book } from "./book-data"
import {
  getLikedBooks,
  saveLikedBooks,
  getBookReviews,
  saveBookReviews,
  getReadingProgress,
  saveReadingProgress,
  getShelves,
  saveShelves,
  getShelfAssignments,
  saveShelfAssignments,
  getReadingPositions,
  mergeReadingPositions,
  type BookReview,
  type ReadingProgress,
  type Shelf,
  type BookShelfAssignment,
} from "./storage"

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

/**
 * Send a password-reset email. The link returns the user to /reset-password,
 * where updatePassword() sets the new password using the recovery session
 * Supabase establishes from the link.
 */
export async function sendPasswordReset(email: string) {
  if (!supabase) throw new Error("Supabase not configured")
  const redirectTo =
    typeof window !== "undefined" ? `${window.location.origin}/reset-password` : undefined
  return supabase.auth.resetPasswordForEmail(email, { redirectTo })
}

/** Set a new password for the currently-authenticated (recovery) session. */
export async function updatePassword(newPassword: string) {
  if (!supabase) throw new Error("Supabase not configured")
  return supabase.auth.updateUser({ password: newPassword })
}

/** Resend the signup confirmation email. */
export async function resendConfirmation(email: string) {
  if (!supabase) throw new Error("Supabase not configured")
  return supabase.auth.resend({ type: "signup", email })
}

/**
 * Permanently delete the signed-in user's account and ALL their cloud data, then
 * sign out. Deletion runs in the `delete_my_account` security-definer RPC (see
 * lib/supabase-schema.sql), which removes the auth.users row; every public table
 * FK is `on delete cascade`, so reviews/progress/swipes/library/profile go with
 * it. Local on-device data is the caller's responsibility to clear afterwards.
 */
export async function deleteAccount(): Promise<{ ok: boolean; reason?: string }> {
  if (!supabase) return { ok: false, reason: "not configured" }
  const user = await getUser()
  if (!user) return { ok: false, reason: "not signed in" }

  const { error } = await supabase.rpc("delete_my_account")
  if (error) {
    console.warn("[BookSwipe] deleteAccount failed:", stringifyError(error))
    return { ok: false, reason: stringifyError(error) }
  }
  clearUserCache()
  await supabase.auth.signOut()
  return { ok: true }
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

  // 5. Sync shelves. Custom (non-default) shelf DEFINITIONS go to user_shelves;
  // the book↔shelf links go to user_book_shelves. Default shelves are constant
  // across devices (same ids), so we never push them. Additive union — see ADR-0002.
  const customShelves = getShelves().filter((s) => !s.isDefault)
  if (customShelves.length > 0) {
    const { error } = await supabase.from("user_shelves").upsert(
      customShelves.map((s) => ({
        user_id: user.id,
        shelf_id: s.id,
        name: s.name,
        emoji: s.emoji,
        is_default: false,
        created_at: s.createdAt,
      })),
      { onConflict: "user_id,shelf_id" },
    )
    if (error) errors.push(`user_shelves: ${stringifyError(error)}`)
  }

  const assignments = getShelfAssignments()
  if (assignments.length > 0) {
    const { error } = await supabase.from("user_book_shelves").upsert(
      assignments.map((a) => ({
        user_id: user.id,
        book_id: a.bookId,
        shelf_id: a.shelfId,
        added_at: a.addedAt,
      })),
      { onConflict: "user_id,book_id,shelf_id" },
    )
    if (error) errors.push(`user_book_shelves: ${stringifyError(error)}`)
  }

  // 6. Reading positions (cross-device continue-reading). Furthest-wins is
  // achieved by the bidirectional flow: pull merges the larger offset into local
  // first, then this push sends the (now-furthest) local offsets up.
  const positions = getReadingPositions()
  const positionRows = Object.entries(positions)
    .filter(([, offset]) => typeof offset === "number" && offset > 0)
    .map(([book_id, char_offset]) => ({ user_id: user.id, book_id, char_offset, updated_at: now }))
  if (positionRows.length > 0) {
    const { error } = await supabase.from("reading_positions").upsert(positionRows, {
      onConflict: "user_id,book_id",
    })
    if (error) errors.push(`reading_positions: ${stringifyError(error)}`)
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
export function isLocalNewer(localTime: string | undefined, cloudTime: string | undefined): boolean {
  if (!cloudTime) return true // not in cloud yet → push it
  if (!localTime) return false // no local timestamp → don't overwrite newer-or-equal cloud
  const local = Date.parse(localTime)
  const cloud = Date.parse(cloudTime)
  if (Number.isNaN(local)) return false
  if (Number.isNaN(cloud)) return true
  return local > cloud
}

// ─── Pure merge helpers (cloud → local) ─────────────────────────────────────
// Extracted as pure functions so the conflict-resolution logic is unit-testable
// without mocking Supabase. pullFromCloudToLocal() is the thin IO wrapper.

/** Union liked books by id; local entries win on duplicate (richer client fields). */
export function mergeLikedBooks(local: Book[], cloud: Book[]): Book[] {
  const localIds = new Set(local.map((b) => b.id))
  return [...local, ...cloud.filter((b) => !localIds.has(b.id))]
}

/** Per bookId, keep whichever review has the newer updatedAt (cloud wins ties only when strictly newer). */
export function mergeReviewsByNewer(local: BookReview[], cloud: BookReview[]): BookReview[] {
  const byBook = new Map<string, BookReview>(local.map((r) => [r.bookId, r]))
  for (const c of cloud) {
    const existing = byBook.get(c.bookId)
    if (!existing || isLocalNewer(c.updatedAt, existing.updatedAt)) byBook.set(c.bookId, c)
  }
  return Array.from(byBook.values())
}

/** Per bookId, keep whichever progress row has the newer lastReadDate. */
export function mergeProgressByNewer(local: ReadingProgress[], cloud: ReadingProgress[]): ReadingProgress[] {
  const byBook = new Map<string, ReadingProgress>(local.map((p) => [p.bookId, p]))
  for (const c of cloud) {
    const existing = byBook.get(c.bookId)
    if (!existing || isLocalNewer(c.lastReadDate, existing.lastReadDate)) byBook.set(c.bookId, c)
  }
  return Array.from(byBook.values())
}

/** Union shelves by id; local definition wins on duplicate. */
export function mergeShelves(local: Shelf[], cloud: Shelf[]): Shelf[] {
  const byId = new Map<string, Shelf>(local.map((s) => [s.id, s]))
  for (const c of cloud) if (!byId.has(c.id)) byId.set(c.id, c)
  return Array.from(byId.values())
}

/** Union book↔shelf assignments by (bookId, shelfId). Additive: a removal on one
 *  device does not propagate (documented limitation in ADR-0002). */
export function mergeShelfAssignments(
  local: BookShelfAssignment[],
  cloud: BookShelfAssignment[],
): BookShelfAssignment[] {
  const key = (a: BookShelfAssignment) => `${a.bookId}::${a.shelfId}`
  const byKey = new Map<string, BookShelfAssignment>(local.map((a) => [key(a), a]))
  for (const c of cloud) if (!byKey.has(key(c))) byKey.set(key(c), c)
  return Array.from(byKey.values())
}

// ─── Sync: Supabase → localStorage ─────────────────────────────────────────

export async function syncFromCloud(): Promise<{
  books: Book[]
  reviews: BookReview[]
  progress: ReadingProgress[]
  shelves: Shelf[]
  assignments: BookShelfAssignment[]
  positions: Record<string, number>
} | null> {
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

  // Build a book lookup so reading-progress rows can carry their full Book
  // (the local ReadingProgress shape embeds the Book, not just its id).
  const bookById = new Map<string, Book>(books.map((b) => [b.id, b]))

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

  // Fetch reading progress. syncToCloud has always pushed this, but nothing ever
  // pulled it back, so a new device started a re-read from page 0. Pull it here
  // and only keep rows whose book we also have locally/in the catalog (the local
  // ReadingProgress.book field must be a real Book).
  const { data: cloudProgress } = await supabase
    .from("reading_progress")
    .select("*")
    .eq("user_id", user.id)

  const progress: ReadingProgress[] = (cloudProgress || [])
    .map((p: any): ReadingProgress | null => {
      const book = bookById.get(p.book_id)
      if (!book) return null
      return {
        bookId: p.book_id,
        book,
        currentPage: p.current_page || 0,
        totalPages: p.total_pages || 0,
        timeSpentMinutes: p.time_spent_minutes || 0,
        status: p.status || "reading",
        startedDate: p.started_date,
        lastReadDate: p.last_read_date,
      }
    })
    .filter((p: ReadingProgress | null): p is ReadingProgress => p !== null)

  // Fetch custom shelves + book↔shelf assignments.
  const { data: cloudShelves } = await supabase
    .from("user_shelves")
    .select("*")
    .eq("user_id", user.id)

  const shelves: Shelf[] = (cloudShelves || []).map((s: any) => ({
    id: s.shelf_id,
    name: s.name,
    emoji: s.emoji || "",
    isDefault: !!s.is_default,
    createdAt: s.created_at,
  }))

  const { data: cloudAssignments } = await supabase
    .from("user_book_shelves")
    .select("*")
    .eq("user_id", user.id)

  const assignments: BookShelfAssignment[] = (cloudAssignments || []).map((a: any) => ({
    bookId: a.book_id,
    shelfId: a.shelf_id,
    addedAt: a.added_at,
  }))

  // Reading positions (cross-device continue-reading)
  const { data: cloudPositions } = await supabase
    .from("reading_positions")
    .select("book_id, char_offset")
    .eq("user_id", user.id)
  const positions: Record<string, number> = {}
  for (const row of (cloudPositions || []) as Array<{ book_id: string; char_offset: number }>) {
    if (row.book_id && typeof row.char_offset === "number") positions[row.book_id] = row.char_offset
  }

  return { books, reviews, progress, shelves, assignments, positions }
}

// ─── Sync: Supabase → localStorage (the missing pull side) ──────────────────

/**
 * Pulls the signed-in user's cloud data and MERGES it into localStorage so a
 * second device actually receives the library/reviews/progress. Previously
 * `syncFromCloud` was exported but never called, making sync push-only.
 *
 * Merge strategy (matches the push side's last-writer-wins, never blind-clobber):
 *  - liked books: UNION by id (a book saved on either device stays saved).
 *  - reviews: per bookId keep the row with the newer `updatedAt`.
 *  - reading progress: per bookId keep the row with the newer `lastReadDate`.
 *
 * Returns counts of what was applied, or null if there was nothing to pull.
 */
export async function pullFromCloudToLocal(): Promise<{
  books: number
  reviews: number
  progress: number
} | null> {
  const cloud = await syncFromCloud()
  if (!cloud) return null

  const localBooks = getLikedBooks()
  const localReviews = getBookReviews()
  const localProgress = getReadingProgress()

  const mergedBooks = mergeLikedBooks(localBooks, cloud.books)
  const mergedReviews = mergeReviewsByNewer(localReviews, cloud.reviews)
  const mergedProgress = mergeProgressByNewer(localProgress, cloud.progress)

  // Only write back when the merge actually changed something (avoids spurious
  // storage writes + change events on a no-op sync).
  const booksAdded = mergedBooks.length - localBooks.length
  if (booksAdded > 0) saveLikedBooks(mergedBooks)

  const reviewsChanged = !sameReviewSet(localReviews, mergedReviews)
  if (reviewsChanged) saveBookReviews(mergedReviews)

  const progressChanged = !sameProgressSet(localProgress, mergedProgress)
  if (progressChanged) saveReadingProgress(mergedProgress)

  // Shelves + assignments — additive union merge.
  const localShelves = getShelves()
  const mergedShelves = mergeShelves(localShelves, cloud.shelves)
  if (mergedShelves.length !== localShelves.length) saveShelves(mergedShelves)

  const localAssignments = getShelfAssignments()
  const mergedAssignments = mergeShelfAssignments(localAssignments, cloud.assignments)
  if (mergedAssignments.length !== localAssignments.length) saveShelfAssignments(mergedAssignments)

  // Reading positions — furthest-wins merge (resume at the furthest point read).
  if (cloud.positions) mergeReadingPositions(cloud.positions)

  return {
    books: booksAdded,
    reviews: reviewsChanged ? mergedReviews.length : 0,
    progress: progressChanged ? mergedProgress.length : 0,
  }
}

/** Cheap structural equality for the review set (count + per-book updatedAt). */
function sameReviewSet(a: BookReview[], b: BookReview[]): boolean {
  if (a.length !== b.length) return false
  const byBook = new Map(a.map((r) => [r.bookId, r.updatedAt]))
  return b.every((r) => byBook.get(r.bookId) === r.updatedAt)
}

/** Cheap structural equality for the progress set (count + per-book lastReadDate). */
function sameProgressSet(a: ReadingProgress[], b: ReadingProgress[]): boolean {
  if (a.length !== b.length) return false
  const byBook = new Map(a.map((p) => [p.bookId, p.lastReadDate]))
  return b.every((p) => byBook.get(p.bookId) === p.lastReadDate)
}

/**
 * Full two-way sync used on sign-in: PULL cloud → local first (so this device
 * gains anything saved elsewhere), then PUSH local → cloud (so the cloud gains
 * this device's local-only data). Both halves use last-writer-wins, so neither
 * direction clobbers fresher data. After the pull, the liked-changed event fires
 * so the UI reflects newly-arrived books immediately.
 */
export async function syncBidirectional(): Promise<{
  pulled: { books: number; reviews: number; progress: number } | null
  pushed: Awaited<ReturnType<typeof syncToCloud>>
}> {
  const pulled = await pullFromCloudToLocal()
  if (pulled && (pulled.books > 0 || pulled.reviews > 0 || pulled.progress > 0)) {
    if (typeof window !== "undefined") {
      window.dispatchEvent(
        new CustomEvent("bookswipe:liked-changed", { detail: getLikedBooks().length })
      )
    }
  }
  const pushed = await syncToCloud()
  return { pulled, pushed }
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

/**
 * Returns book_id -> co-like count for books that users similar to the caller
 * (they right-swiped at least one of the caller's liked books) also liked, via
 * the aggregate security-definer RPC. Powers the "N readers like you saved this"
 * social-proof badge. Returns an empty map when not signed in / not configured /
 * the RPC errors — callers treat that as "no badge".
 */
export async function getCoLikeCounts(likedBookIds: string[]): Promise<Map<string, number>> {
  if (!supabase || likedBookIds.length === 0) return new Map()
  const user = await getUser()
  if (!user) return new Map() // RPC is granted to authenticated only
  const { data, error } = await supabase.rpc("get_co_like_counts", { liked_book_ids: likedBookIds })
  if (error || !data) {
    if (error) console.warn("[BookSwipe] getCoLikeCounts RPC failed:", stringifyError(error))
    return new Map()
  }
  return new Map(
    (data as Array<{ book_id: string; co_like_count: number }>).map((r) => [r.book_id, Number(r.co_like_count)])
  )
}

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
