# BookSwipe

A Next.js 14 PWA for discovering books via a Tinder-style swipe deck. Reading
data is local-first (`localStorage`) with optional Supabase cloud sync. This file
is the domain glossary: the canonical name for each concept and the aliases to
avoid, so code, commits, and conversations use one vocabulary.

## Language

**Book**:
A title sourced from an external API (Google Books, Open Library, Project
Gutenberg). The canonical shape is `Book` in `lib/book-data.ts`. A `Book` is
immutable catalog data; it carries no per-user state.
_Avoid_: volume, item, result.

**Library** (a.k.a. **Liked Books**):
The set of books a user has saved (swiped right / added). Stored under
`STORAGE_KEYS.LIKED_BOOKS`. "Liked" is the verb; "Library" is the collection.
_Avoid_: favorites (that is a separate per-review boolean), saved list.

**Swipe**:
A discovery decision on a book: **right** = save to Library, **left** = pass
(negative signal). Persisted to `swipe_history` for collaborative filtering.
_Avoid_: vote, rate (rating is a Review concept).

**Pass**:
A left-swipe. Recorded as a negative signal (`PASSED_BOOKS` / `PASSED_FEATURES`)
that down-weights similar books in recommendations.
_Avoid_: reject, dislike.

**Shelf**:
A user-defined or default bucket (`want-to-read`, `currently-reading`,
`finished`, `dnf`, plus custom). A book can be on MANY shelves locally
(`BookShelfAssignment`). Note the model mismatch with the cloud `user_books.shelf`
column (one shelf per book) — see `docs/adr/0002-…`.
_Avoid_: list, category, tag (Tag is a separate concept).

**Shelf Assignment**:
The link between one book and one shelf (`BookShelfAssignment`). The local source
of truth for shelving; distinct from the cloud's single-shelf column.

**Review**:
A user's rating + optional text + reading metadata for a book (`BookReview`).
Keyed by `bookId`, last-writer-wins on `updatedAt` during sync.
_Avoid_: rating-only (a Review may have no text but is still a Review).

**Reading Progress**:
Per-book position + status (`reading | paused | completed | dnf`) + time spent
(`ReadingProgress`). Freshness marker is `lastReadDate`.
_Avoid_: status alone, bookmark (a Note may be a bookmark; Progress is the page cursor).

**Daily Pick**:
One algorithmically chosen book surfaced per calendar day (`DailyPick`),
dismissable, derived from the scoring engine + MMR diversity.
_Avoid_: recommendation of the day, featured book.

**Co-like**:
The collaborative-filtering signal: how many OTHER users right-swiped a book that
the current user has not. Served only as aggregate counts by the
`get_co_like_counts` security-definer RPC — never raw per-user rows.
_Avoid_: similar users, neighbors (those are internal to the RPC).

**Sync — Push / Pull**:
**Push** = `syncToCloud` (local → Supabase). **Pull** = `pullFromCloudToLocal`
(Supabase → local, merged). **Bidirectional** = `syncBidirectional` (pull then
push), run on sign-in. Both directions use per-record last-writer-wins.
_Avoid_: "upload/download", "backup" (Backup = the manual JSON export/import).

**Backup**:
The manual full-data JSON export/import (`export-utils.ts`), distinct from cloud
Sync. Exports all `bookswipe_`-prefixed keys except the volatile book cache.

## Notes

- All persisted keys live in `lib/storage-keys.ts` (`STORAGE_KEYS`). Never inline
  a `"bookswipe_…"` string literal.
- Cloud sync degrades to no-op when Supabase env vars are absent; the app is fully
  usable offline/anonymous.
