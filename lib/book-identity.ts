import { Book } from "./book-data"

/**
 * Whether two records are the same book.
 *
 * Ids cannot answer this: the same novel arrives as a Google volume id, an
 * Open Library work key and a seed id, all distinct. Deduping on id alone left
 * 36% of a live 150-book cache as duplicates — Project Hail Mary appeared four
 * times — and a deck that shows you the same book four times reads as broken.
 */

/** Lowercase, strip accents and punctuation, collapse whitespace. */
function normalize(s: string): string {
  return (s || "")
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-z0-9 ]/g, " ")
    .replace(/\s+/g, " ")
    .trim()
}

/** Drop the sort of subtitle that differs between editions of one work. */
function coreTitle(title: string): string {
  const n = normalize(title)
  // "Dune: Special Edition" / "Circe - A Novel" -> the part before the break
  const cut = n.split(/\s+(?:a novel|the novel|special edition|deluxe edition)\b/)[0]
  return cut.split(" : ")[0].trim() || n
}

/**
 * Surname only. Full-name matching misses "J.R.R. Tolkien" vs "John Tolkien",
 * and surname-only alone would collapse different King/Smith/Miller authors —
 * so it is paired with an exact title match, never used on its own.
 */
function authorKey(author: string): string {
  const raw = (author || "").trim()
  // Open Library writes "Weir, Andy" while Google writes "Andy Weir". Taking
  // the last word gives "andy" for the first and "weir" for the second, so the
  // same author would never match. The part before a comma is the surname.
  const surnameFirst = raw.includes(",") ? raw.split(",")[0] : ""
  if (surnameFirst) {
    const p = normalize(surnameFirst).split(" ").filter(Boolean)
    if (p.length) return p[p.length - 1]
  }
  const parts = normalize(raw).split(" ").filter(Boolean)
  return parts.length ? parts[parts.length - 1] : ""
}

/** Stable identity for a work, independent of which source supplied it. */
export function bookIdentity(book: Pick<Book, "title" | "author">): string {
  return `${coreTitle(book.title)}::${authorKey(book.author)}`
}

/**
 * Which of two records to keep. Richer wins, because the duplicate usually
 * differs in how much was resolved: a real description, a real cover and a real
 * rating all beat placeholders.
 */
function score(book: Book): number {
  let s = 0
  const desc = book.description || ""
  if (desc.length >= 180) s += 4
  else if (desc.length > 0) s += 1
  if (book.metadata?.enriched) s += 3
  if (!book.metadata?.ratingEstimated && book.rating > 0) s += 2
  if (book.pages > 0) s += 1
  if (book.publishedYear > 0) s += 1
  if (book.isbn) s += 1
  if (book.coverFallback) s += 1
  return s
}

/**
 * Fold duplicates into one record per work, keeping the richest and carrying
 * every id it absorbed in `aliasIds`.
 *
 * The alias list is not optional: a user's liked/passed lists store ids, so
 * dropping a duplicate silently orphans a book they already saved. Callers
 * resolve through `aliasIds` to keep those lookups working.
 */
export function mergeDuplicates(books: Book[]): Book[] {
  const byIdentity = new Map<string, Book>()

  for (const book of books) {
    if (!book?.title || !book?.author) continue
    const key = bookIdentity(book)
    const seen = byIdentity.get(key)
    if (!seen) {
      byIdentity.set(key, book)
      continue
    }
    const [keep, drop] = score(book) > score(seen) ? [book, seen] : [seen, book]
    const aliases = new Set([
      ...(keep.aliasIds || []),
      ...(drop.aliasIds || []),
      drop.id,
    ])
    aliases.delete(keep.id)
    byIdentity.set(key, { ...keep, aliasIds: [...aliases] })
  }

  return [...byIdentity.values()]
}

/** Every id a book answers to — its own plus any it absorbed. */
export function idsFor(book: Book): string[] {
  return [book.id, ...(book.aliasIds || [])]
}

/** True when `book` is the one referenced by `id`, directly or via an alias. */
export function matchesId(book: Book, id: string): boolean {
  return book.id === id || (book.aliasIds || []).includes(id)
}
