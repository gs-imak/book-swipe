// The shape of a star distribution and the pure maths for drawing it, shared
// by the API route and the panel. No "use client", no I/O — unit-testable.

export interface RatingBreakdown {
  found: boolean
  source: "openlibrary"
  workKey?: string
  /** Total ratings behind the distribution — the sum of `counts`, not the
   *  source's own summary count, so the bars and the total always agree. */
  count?: number
  average?: number
  counts?: Record<1 | 2 | 3 | 4 | 5, number>
}

export interface RatingBar {
  stars: 1 | 2 | 3 | 4 | 5
  count: number
  /** Share of all ratings, 0-100, rounded for display. */
  percent: number
  /** Bar width relative to the most common rating, 0-100. Scaling to the
   *  largest bar rather than to 100 keeps a lopsided distribution readable;
   *  the percentage label carries the absolute value. */
  width: number
}

export const STAR_ROWS: (1 | 2 | 3 | 4 | 5)[] = [5, 4, 3, 2, 1]

export function toBars(counts: Record<1 | 2 | 3 | 4 | 5, number>): RatingBar[] {
  const total = STAR_ROWS.reduce((sum, s) => sum + (counts[s] || 0), 0)
  const peak = Math.max(...STAR_ROWS.map((s) => counts[s] || 0), 1)
  return STAR_ROWS.map((stars) => {
    const count = counts[stars] || 0
    return {
      stars,
      count,
      percent: total > 0 ? Math.round((count / total) * 100) : 0,
      width: Math.round((count / peak) * 100),
    }
  })
}

/**
 * The share of readers who landed at one extreme or the other.
 *
 * This is the whole reason someone taps a rating: a 4.0 built from a wall of
 * fives and a hostile minority is a different book from a 4.0 everyone found
 * fine, and the average cannot tell them apart.
 */
export function polarisation(counts: Record<1 | 2 | 3 | 4 | 5, number>): {
  loved: number
  disliked: number
  divisive: boolean
} {
  const total = STAR_ROWS.reduce((sum, s) => sum + (counts[s] || 0), 0)
  if (total === 0) return { loved: 0, disliked: 0, divisive: false }
  const loved = Math.round(((counts[5] || 0) / total) * 100)
  const disliked = Math.round((((counts[1] || 0) + (counts[2] || 0)) / total) * 100)
  // Both camps sizeable at once — the case an average actively hides.
  return { loved, disliked, divisive: loved >= 35 && disliked >= 15 }
}
