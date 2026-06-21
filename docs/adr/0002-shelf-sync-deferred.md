# Shelf sync via dedicated join tables (additive union merge)

Status: accepted (supersedes the earlier "deferred" decision)

## Context

Locally a book can be on MANY shelves (`BookShelfAssignment[]`), which the cloud
`user_books.shelf` single column could not represent without a lossy round-trip.
The first pass deliberately deferred shelf sync rather than ship a lossy mapping.

## Decision

Shelves now sync through two dedicated tables that mirror the local model
(see `lib/supabase-schema.sql`):

- `user_shelves(user_id, shelf_id, name, emoji, is_default, created_at)` — custom
  shelf DEFINITIONS. Default shelves are constant across devices (same ids), so
  they are never synced.
- `user_book_shelves(user_id, book_id, shelf_id, added_at)` — the many-to-many
  book↔shelf links. `book_id` is plain text (no FK to `books`) so an assignment
  syncs regardless of whether the book is in the shared catalog yet.

Both are own-row RLS. Sync is an **additive union**: `mergeShelves` (by shelf id)
and `mergeShelfAssignments` (by book+shelf), pushed in `syncToCloud` and merged
back in `pullFromCloudToLocal`. The merge helpers are pure and unit-tested.

## Consequences

- Custom shelves and their book assignments now sync across devices.
- **Removal does not propagate.** Because the merge is additive (union), deleting
  a shelf or un-shelving a book on one device does not remove it on another. This
  is the same trade-off as the liked-books union and is acceptable for v1;
  tombstone-based deletes are a future enhancement if users report drift.
