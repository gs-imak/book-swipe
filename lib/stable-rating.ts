/**
 * Deterministic pseudo-rating from a string — always returns the same value
 * for the same input, so a book without a real rating gets a stable placeholder
 * instead of flickering between renders. Books rated this way are tagged
 * `metadata.ratingEstimated` at their creation site so scoring and UI never
 * treat the placeholder as a real quality signal.
 */
export function stableRating(seed: string, min = 3.5, max = 4.5): number {
  let hash = 0
  for (let i = 0; i < seed.length; i++) {
    hash = ((hash << 5) - hash + seed.charCodeAt(i)) | 0
  }
  const norm = (Math.abs(hash) % 1000) / 1000 // 0..1
  return Math.round((min + norm * (max - min)) * 10) / 10
}
