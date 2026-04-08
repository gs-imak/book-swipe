/**
 * Baked-in fallback dataset for the Read tab.
 *
 * Returned by /api/gutenberg-browse when gutendex.com is unreachable (it
 * goes down/overloads periodically). Uses real Project Gutenberg IDs so
 * cover images and book text still work via gutenberg.org, which is a
 * separate service from gutendex.com and much more stable.
 *
 * Each entry matches the GutenbergBook shape consumed by
 * lib/gutenberg-browser-api.ts and components/free-books-browser.tsx.
 */

import type { GutenbergBook } from "./gutenberg-api"

interface FallbackBook extends GutenbergBook {
  /** Topics this book maps to — matches BROWSE_CATEGORIES.topic strings. */
  topics: string[]
}

function gutenbergFormats(id: number): Record<string, string> {
  // /files/{id}/{id}-0.txt is the primary text encoding (UTF-8 with BOM)
  // and /cache/epub/{id}/pg{id}.txt is the fallback. Both verified 200 OK
  // via Vercel→gutenberg.org. The `.utf-8` suffix variant returns 404.
  return {
    "text/plain; charset=utf-8": `https://www.gutenberg.org/files/${id}/${id}-0.txt`,
    "text/plain; charset=us-ascii": `https://www.gutenberg.org/cache/epub/${id}/pg${id}.txt`,
    "text/html": `https://www.gutenberg.org/cache/epub/${id}/pg${id}-images.html`,
    "image/jpeg": `https://www.gutenberg.org/cache/epub/${id}/pg${id}.cover.medium.jpg`,
  }
}

const FALLBACK_BOOKS: FallbackBook[] = [
  {
    id: 84,
    title: "Frankenstein; Or, The Modern Prometheus",
    authors: [{ name: "Shelley, Mary Wollstonecraft" }],
    subjects: ["Science fiction", "Horror tales", "Monsters -- Fiction", "Gothic fiction"],
    formats: gutenbergFormats(84),
    topics: ["fiction", "horror", "science fiction"],
  },
  {
    id: 1342,
    title: "Pride and Prejudice",
    authors: [{ name: "Austen, Jane" }],
    subjects: ["Love stories", "England -- Fiction", "Young women -- Fiction", "Courtship -- Fiction"],
    formats: gutenbergFormats(1342),
    topics: ["fiction", "love stories"],
  },
  {
    id: 11,
    title: "Alice's Adventures in Wonderland",
    authors: [{ name: "Carroll, Lewis" }],
    subjects: ["Fantasy fiction", "Children's stories", "Imaginary places -- Juvenile fiction"],
    formats: gutenbergFormats(11),
    topics: ["fiction", "fantasy", "children"],
  },
  {
    id: 174,
    title: "The Picture of Dorian Gray",
    authors: [{ name: "Wilde, Oscar" }],
    subjects: ["Horror tales", "Didactic fiction", "London (England) -- Fiction"],
    formats: gutenbergFormats(174),
    topics: ["fiction", "horror"],
  },
  {
    id: 98,
    title: "A Tale of Two Cities",
    authors: [{ name: "Dickens, Charles" }],
    subjects: ["Historical fiction", "France -- History -- Revolution, 1789-1799 -- Fiction"],
    formats: gutenbergFormats(98),
    topics: ["fiction", "history"],
  },
  {
    id: 1661,
    title: "The Adventures of Sherlock Holmes",
    authors: [{ name: "Doyle, Arthur Conan" }],
    subjects: ["Detective and mystery stories", "Short stories", "Holmes, Sherlock (Fictitious character) -- Fiction"],
    formats: gutenbergFormats(1661),
    topics: ["fiction", "mystery", "short stories"],
  },
  {
    id: 345,
    title: "Dracula",
    authors: [{ name: "Stoker, Bram" }],
    subjects: ["Horror tales", "Vampires -- Fiction", "Transylvania (Romania) -- Fiction"],
    formats: gutenbergFormats(345),
    topics: ["fiction", "horror"],
  },
  {
    id: 158,
    title: "Emma",
    authors: [{ name: "Austen, Jane" }],
    subjects: ["Love stories", "Young women -- Fiction", "England -- Fiction"],
    formats: gutenbergFormats(158),
    topics: ["fiction", "love stories"],
  },
  {
    id: 74,
    title: "The Adventures of Tom Sawyer",
    authors: [{ name: "Twain, Mark" }],
    subjects: ["Adventure stories", "Boys -- Fiction", "Mississippi River -- Fiction"],
    formats: gutenbergFormats(74),
    topics: ["fiction", "adventure stories", "children"],
  },
  {
    id: 76,
    title: "Adventures of Huckleberry Finn",
    authors: [{ name: "Twain, Mark" }],
    subjects: ["Adventure stories", "Boys -- Fiction", "Mississippi River -- Fiction"],
    formats: gutenbergFormats(76),
    topics: ["fiction", "adventure stories"],
  },
  {
    id: 2701,
    title: "Moby Dick; Or, The Whale",
    authors: [{ name: "Melville, Herman" }],
    subjects: ["Adventure stories", "Sea stories", "Whaling -- Fiction"],
    formats: gutenbergFormats(2701),
    topics: ["fiction", "adventure stories"],
  },
  {
    id: 36,
    title: "The War of the Worlds",
    authors: [{ name: "Wells, H. G. (Herbert George)" }],
    subjects: ["Science fiction", "Space warfare -- Fiction", "Mars (Planet) -- Fiction"],
    formats: gutenbergFormats(36),
    topics: ["fiction", "science fiction"],
  },
  {
    id: 35,
    title: "The Time Machine",
    authors: [{ name: "Wells, H. G. (Herbert George)" }],
    subjects: ["Science fiction", "Time travel -- Fiction", "Imaginary histories"],
    formats: gutenbergFormats(35),
    topics: ["fiction", "science fiction"],
  },
  {
    id: 1260,
    title: "Jane Eyre: An Autobiography",
    authors: [{ name: "Brontë, Charlotte" }],
    subjects: ["Love stories", "Governesses -- Fiction", "Orphans -- Fiction"],
    formats: gutenbergFormats(1260),
    topics: ["fiction", "love stories"],
  },
  {
    id: 768,
    title: "Wuthering Heights",
    authors: [{ name: "Brontë, Emily" }],
    subjects: ["Love stories", "Revenge -- Fiction", "Yorkshire (England) -- Fiction"],
    formats: gutenbergFormats(768),
    topics: ["fiction", "love stories"],
  },
  {
    id: 120,
    title: "Treasure Island",
    authors: [{ name: "Stevenson, Robert Louis" }],
    subjects: ["Adventure stories", "Pirates -- Fiction", "Buried treasure -- Fiction"],
    formats: gutenbergFormats(120),
    topics: ["fiction", "adventure stories", "children"],
  },
  {
    id: 43,
    title: "The Strange Case of Dr. Jekyll and Mr. Hyde",
    authors: [{ name: "Stevenson, Robert Louis" }],
    subjects: ["Horror tales", "Psychological fiction", "London (England) -- Fiction"],
    formats: gutenbergFormats(43),
    topics: ["fiction", "horror"],
  },
  {
    id: 1400,
    title: "Great Expectations",
    authors: [{ name: "Dickens, Charles" }],
    subjects: ["Orphans -- Fiction", "Young men -- Fiction", "England -- Fiction"],
    formats: gutenbergFormats(1400),
    topics: ["fiction"],
  },
  {
    id: 46,
    title: "A Christmas Carol in Prose; Being a Ghost Story of Christmas",
    authors: [{ name: "Dickens, Charles" }],
    subjects: ["Christmas stories", "Ghost stories", "London (England) -- Fiction"],
    formats: gutenbergFormats(46),
    topics: ["fiction"],
  },
  {
    id: 2591,
    title: "Grimms' Fairy Tales",
    authors: [{ name: "Grimm, Jacob" }, { name: "Grimm, Wilhelm" }],
    subjects: ["Fairy tales", "Folklore -- Germany", "Children's stories, German"],
    formats: gutenbergFormats(2591),
    topics: ["fairy tales", "children", "fiction"],
  },
  {
    id: 514,
    title: "Little Women; Or, Meg, Jo, Beth, and Amy",
    authors: [{ name: "Alcott, Louisa May" }],
    subjects: ["Sisters -- Fiction", "Family -- Fiction", "Young women -- Fiction"],
    formats: gutenbergFormats(514),
    topics: ["fiction"],
  },
  {
    id: 1727,
    title: "The Odyssey",
    authors: [{ name: "Homer" }],
    subjects: ["Epic poetry, Greek", "Odysseus, King of Ithaca (Mythological character)"],
    formats: gutenbergFormats(1727),
    topics: ["poetry", "fiction", "adventure stories"],
  },
  {
    id: 1232,
    title: "The Prince",
    authors: [{ name: "Machiavelli, Niccolò" }],
    subjects: ["Political science -- Early works to 1800", "Political ethics"],
    formats: gutenbergFormats(1232),
    topics: ["philosophy", "history"],
  },
  {
    id: 5200,
    title: "Metamorphosis",
    authors: [{ name: "Kafka, Franz" }],
    subjects: ["Psychological fiction", "Short stories"],
    formats: gutenbergFormats(5200),
    topics: ["fiction", "short stories"],
  },
  {
    id: 2852,
    title: "The Hound of the Baskervilles",
    authors: [{ name: "Doyle, Arthur Conan" }],
    subjects: ["Detective and mystery stories", "Holmes, Sherlock (Fictitious character) -- Fiction"],
    formats: gutenbergFormats(2852),
    topics: ["fiction", "mystery"],
  },
  {
    id: 64317,
    title: "The Great Gatsby",
    authors: [{ name: "Fitzgerald, F. Scott (Francis Scott)" }],
    subjects: ["Rich people -- Fiction", "Nineteen twenties -- Fiction", "Long Island (N.Y.) -- Fiction"],
    formats: gutenbergFormats(64317),
    topics: ["fiction", "love stories"],
  },
  {
    id: 4300,
    title: "Ulysses",
    authors: [{ name: "Joyce, James" }],
    subjects: ["Psychological fiction", "Dublin (Ireland) -- Fiction"],
    formats: gutenbergFormats(4300),
    topics: ["fiction"],
  },
  {
    id: 1080,
    title: "A Modest Proposal",
    authors: [{ name: "Swift, Jonathan" }],
    subjects: ["Satire", "Poverty -- Ireland -- Early works to 1800"],
    formats: gutenbergFormats(1080),
    topics: ["humor", "philosophy"],
  },
  {
    id: 1497,
    title: "The Republic",
    authors: [{ name: "Plato" }],
    subjects: ["Political science -- Early works to 1800", "Utopias -- Early works to 1800"],
    formats: gutenbergFormats(1497),
    topics: ["philosophy"],
  },
  {
    id: 2000,
    title: "Don Quijote",
    authors: [{ name: "Cervantes Saavedra, Miguel de" }],
    subjects: ["Knights and knighthood -- Spain -- Fiction", "Spain -- Social life and customs"],
    formats: gutenbergFormats(2000),
    topics: ["fiction", "adventure stories", "humor"],
  },
]

/**
 * Get fallback books filtered by topic. Returns everything if no topic
 * (popular), or entries whose `topics` array includes the requested topic.
 */
export function getFallbackBrowseResult(topic: string): {
  count: number
  next: string | null
  results: GutenbergBook[]
} {
  const t = topic.trim().toLowerCase()
  const filtered = !t
    ? FALLBACK_BOOKS
    : FALLBACK_BOOKS.filter(b => b.topics.includes(t))

  // Strip the `topics` helper field — consumers only know GutenbergBook
  const results: GutenbergBook[] = filtered.map(({ topics: _topics, ...book }) => book)

  return {
    count: results.length,
    next: null,
    results,
  }
}

/**
 * Simple fallback search across titles, authors, and subjects.
 */
export function searchFallback(query: string): {
  count: number
  next: string | null
  results: GutenbergBook[]
} {
  const q = query.trim().toLowerCase()
  if (!q) return getFallbackBrowseResult("")
  const matched = FALLBACK_BOOKS.filter(b => {
    if (b.title.toLowerCase().includes(q)) return true
    if (b.authors.some(a => a.name.toLowerCase().includes(q))) return true
    if (b.subjects?.some(s => s.toLowerCase().includes(q))) return true
    return false
  })
  const results: GutenbergBook[] = matched.map(({ topics: _topics, ...book }) => book)
  return { count: results.length, next: null, results }
}
