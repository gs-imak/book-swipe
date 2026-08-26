"use client"

import { Book } from "./book-data"

/**
 * What the app is allowed to state as fact about a book.
 *
 * The deck fills gaps so every card looks complete: a book with no rating gets
 * a hash of its title in the 3.5-4.5 band, a book with no page count gets 200,
 * a book with no publication year gets 2020. That is fine as internal ballast
 * and wrong the moment it reaches a user, who reads "★4.2 · 200 pp · 2020" as
 * information rather than as filler.
 *
 * Every surface that renders one of these values goes through this module, so
 * the rule lives in one place instead of being re-decided per component.
 */

/**
 * Below this, a rating is arithmetically real but says nothing — "★5 from 1
 * rating" is one person. Sources that report no count at all (our seed set,
 * whose ratings are hand-entered from real-world values) are judged on the
 * estimated flag alone.
 */
export const MIN_RATINGS_FOR_DISPLAY = 20

/** True when the star rating reflects real readers and can be shown. */
export function hasVerifiedRating(book: Pick<Book, "rating" | "metadata">): boolean {
  if (typeof book.rating !== "number" || book.rating <= 0) return false
  if (book.metadata?.ratingEstimated) return false
  const count = book.metadata?.ratingsCount
  if (typeof count === "number" && count < MIN_RATINGS_FOR_DISPLAY) return false
  return true
}

/** The rating to render, or null when the app has no honest one to show. */
export function displayRating(book: Pick<Book, "rating" | "metadata">): number | null {
  return hasVerifiedRating(book) ? book.rating : null
}

/** Page count only when it came from a source. 0 is the "unknown" sentinel. */
export function displayPages(book: Pick<Book, "pages">): number | null {
  return typeof book.pages === "number" && book.pages > 0 ? book.pages : null
}

/** Publication year only when it came from a source. */
export function displayYear(book: Pick<Book, "publishedYear">): number | null {
  const y = book.publishedYear
  return typeof y === "number" && y > 0 ? y : null
}

/**
 * The card's meta line, assembled from whatever is actually known.
 * Returns "" when nothing is — the caller then renders no line at all rather
 * than a row of separators with nothing between them.
 */
export function metaSegments(
  book: Pick<Book, "rating" | "pages" | "publishedYear" | "metadata">,
  opts: { readTime?: string | null } = {},
): string[] {
  const out: string[] = []
  const pages = displayPages(book)
  if (pages) out.push(`${pages} pp`)
  if (pages && opts.readTime) out.push(opts.readTime)
  const rating = displayRating(book)
  if (rating) out.push(`★ ${rating}`)
  return out
}
