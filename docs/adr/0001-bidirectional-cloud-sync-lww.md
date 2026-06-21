# Cloud sync is bidirectional with per-record last-writer-wins

Status: accepted

## Context

`syncToCloud` (push) ran on sign-in, but `syncFromCloud` was exported and never
called — so cloud data was never pulled. A user who built a library on one device
got an empty app on a second device, and `reading_progress` was pushed but never
read back at all (a new device restarted reads from page 0).

## Decision

Sync is now bidirectional. On sign-in `syncBidirectional` runs `pullFromCloudToLocal`
first, then `syncToCloud`. Both directions resolve conflicts per-record with
last-writer-wins, never a blind overwrite:

- **Liked books**: union by `id` (a book saved on either device stays saved;
  local entry wins on duplicate to keep richer client-only fields).
- **Reviews**: newer `updatedAt` wins per `bookId`; equal timestamps keep local.
- **Reading progress**: newer `lastReadDate` wins per `bookId`.

Pull runs before push so this device first gains anything saved elsewhere, then
contributes its local-only data — neither half clobbers fresher data. The merge
logic is extracted into pure, unit-tested functions (`mergeLikedBooks`,
`mergeReviewsByNewer`, `mergeProgressByNewer`, `isLocalNewer`).

## Consequences

- Multi-device users now actually receive their library/reviews/progress.
- Last-writer-wins can still lose a concurrent edit made on two devices within the
  same record between syncs. This is acceptable for single-user reading data; true
  conflict-free merge (CRDT) is out of scope.
- No clock-skew correction: timestamps come from each device's clock. Acceptable
  given the low edit-collision rate for one user across their own devices.
