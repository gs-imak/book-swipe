import { Book } from "./book-data"

export interface RecommendationReason {
  type: "genre" | "mood" | "author" | "rating" | "community" | "similar"
  description: string
}

export interface ScoredBook {
  book: Book
  score: number
  finalScore: number
  reasons: RecommendationReason[]
}

// --- Stopwords ---
const STOPWORDS_LIST = [
  "the", "a", "an", "and", "or", "but", "in", "on", "at", "to", "for",
  "of", "with", "by", "from", "is", "it", "this", "that", "was", "are",
  "be", "has", "had", "have", "will", "would", "could", "should", "can",
  "not", "no", "so", "if", "as", "its", "they", "them", "their", "we",
  "our", "been", "being", "do", "does", "did", "about", "into", "over",
  "after", "before", "between", "under", "above", "than", "more", "most",
  "very", "just", "also", "then", "when", "where", "which", "who", "whom",
  "what", "how", "all", "each", "every", "both", "few", "some", "any",
  "other", "such", "only", "own", "same", "too", "out", "up", "new",
  "now", "way", "may", "even", "back", "well", "still", "one", "two",
  "first", "last", "long", "great", "little", "right", "old", "big",
  "high", "different", "small", "large", "next", "early", "young",
  "important", "world", "through", "while", "she", "her", "his", "him",
  "man", "woman", "find", "here", "thing", "many", "those", "much",
  "must", "life", "story", "book", "novel", "read", "reading",
  "available", "description", "discover", "journey",
]
const STOPWORDS: Record<string, boolean> = {}
STOPWORDS_LIST.forEach((w) => { STOPWORDS[w] = true })

function tokenize(text: string): string[] {
  return text
    .toLowerCase()
    .replace(/[^a-z0-9\s]/g, " ")
    .split(/\s+/)
    .filter((t) => t.length > 2 && !STOPWORDS[t])
}

// --- TF-IDF ---
interface Vocabulary {
  idf: Record<string, number>
}

function buildVocabulary(corpus: string[]): Vocabulary {
  const N = corpus.length
  const docFreq: Record<string, number> = {}

  corpus.forEach((doc) => {
    // Get unique tokens per document
    const seen: Record<string, boolean> = {}
    tokenize(doc).forEach((term) => {
      if (!seen[term]) {
        seen[term] = true
        docFreq[term] = (docFreq[term] || 0) + 1
      }
    })
  })

  const idf: Record<string, number> = {}
  Object.keys(docFreq).forEach((term) => {
    idf[term] = Math.log((N + 1) / (docFreq[term] + 1)) + 1 // smoothed IDF
  })

  return { idf }
}

interface SparseVector {
  [term: string]: number
}

function computeTFIDF(text: string, vocab: Vocabulary): SparseVector {
  const tokens = tokenize(text)
  if (tokens.length === 0) return {}

  // Term frequency (normalized)
  const tf: Record<string, number> = {}
  let maxTF = 0
  tokens.forEach((t) => {
    tf[t] = (tf[t] || 0) + 1
    if (tf[t] > maxTF) maxTF = tf[t]
  })

  const vector: SparseVector = {}
  Object.keys(tf).forEach((term) => {
    const idf = vocab.idf[term]
    if (idf && idf > 1) {
      vector[term] = (tf[term] / maxTF) * idf
    }
  })
  return vector
}

function cosineSimilarity(a: SparseVector, b: SparseVector): number {
  let dot = 0
  let magA = 0
  let magB = 0

  for (const term in a) {
    magA += a[term] ** 2
    if (b[term]) dot += a[term] * b[term]
  }
  for (const term in b) {
    magB += b[term] ** 2
  }

  const denom = Math.sqrt(magA) * Math.sqrt(magB)
  return denom === 0 ? 0 : dot / denom
}

// --- Feature Extraction ---
export function buildFeatureString(book: Book): string {
  const genreText = book.genre.join(" ")
  const moodText = book.mood.join(" ")
  const subjectText = book.metadata?.subjects?.slice(0, 15).join(" ") || ""
  const descWords = (book.description || "")
    .replace(/<[^>]*>/g, "")
    .split(/\s+/)
    .filter((w) => w.length > 3)
    .slice(0, 40)
    .join(" ")

  // Weight genres 3x and moods 2x by repetition
  return [
    book.title,
    book.author,
    genreText, genreText, genreText,
    moodText, moodText,
    subjectText,
    descWords,
  ]
    .join(" ")
    .toLowerCase()
}

// --- User Profile ---
export function buildUserProfile(likedBooks: Book[]): string {
  if (likedBooks.length === 0) return ""

  const features: string[] = []
  // Recency weighting: last 5 liked = 3x, next 5 = 2x, rest = 1x
  const recent3x = likedBooks.slice(-5)
  const recent2x = likedBooks.slice(-10, -5)
  const rest = likedBooks.slice(0, Math.max(0, likedBooks.length - 10))

  recent3x.forEach((b) => {
    const f = buildFeatureString(b)
    features.push(f, f, f)
  })
  recent2x.forEach((b) => {
    const f = buildFeatureString(b)
    features.push(f, f)
  })
  rest.forEach((b) => {
    features.push(buildFeatureString(b))
  })

  return features.join(" ")
}

// --- Reason Generation ---
function generateReasons(
  book: Book,
  likedBooks: Book[]
): RecommendationReason[] {
  const reasons: RecommendationReason[] = []

  // Genre overlap
  const likedGenres: Record<string, number> = {}
  likedBooks.forEach((lb) => {
    lb.genre.forEach((g) => {
      likedGenres[g] = (likedGenres[g] || 0) + 1
    })
  })
  const matchedGenres = book.genre.filter((g) => likedGenres[g] > 0)
  if (matchedGenres.length > 0) {
    const bestGenre = matchedGenres.sort(
      (a, b) => (likedGenres[b] || 0) - (likedGenres[a] || 0)
    )[0]
    reasons.push({
      type: "genre",
      description: `Matches your favorite genre: ${bestGenre}`,
    })
  }

  // Author overlap
  const likedAuthors: Record<string, boolean> = {}
  likedBooks.forEach((b) => { likedAuthors[b.author] = true })
  if (likedAuthors[book.author]) {
    reasons.push({
      type: "author",
      description: `By an author you love: ${book.author}`,
    })
  }

  // Mood overlap
  const likedMoods: Record<string, boolean> = {}
  likedBooks.forEach((b) => b.mood.forEach((m) => { likedMoods[m] = true }))
  const matchedMoods = book.mood.filter((m) => likedMoods[m])
  if (matchedMoods.length > 0) {
    reasons.push({
      type: "mood",
      description: `Captures a mood you enjoy: ${matchedMoods[0]}`,
    })
  }

  // Community signal
  if (
    book.metadata?.readinglogCount &&
    book.metadata.readinglogCount > 1000
  ) {
    reasons.push({
      type: "community",
      description: `Popular with ${Math.round(book.metadata.readinglogCount / 1000)}k readers`,
    })
  }

  // Rating
  if (book.rating >= 4.0) {
    reasons.push({
      type: "rating",
      description: `Highly rated (${book.rating}/5)`,
    })
  }

  return reasons.length > 0
    ? reasons.slice(0, 3)
    : [{ type: "similar", description: "Similar to books you liked" }]
}

// --- Main Scoring Pipeline ---
export function scoreBooks(
  candidates: Book[],
  likedBooks: Book[],
  options?: {
    diversityWeight?: number
    communityBoost?: boolean
    excludeIds?: Set<string>
  }
): ScoredBook[] {
  const { communityBoost = true, excludeIds } = options || {}

  if (likedBooks.length === 0 || candidates.length === 0) return []

  // Filter excluded
  const filtered = excludeIds
    ? candidates.filter((b) => !excludeIds.has(b.id))
    : candidates

  if (filtered.length === 0) return []

  // Build corpus: user profile + all candidates
  const userProfile = buildUserProfile(likedBooks)
  const candidateTexts = filtered.map(buildFeatureString)
  const allTexts = [userProfile, ...candidateTexts]

  // Build vocabulary from full corpus
  const vocab = buildVocabulary(allTexts)

  // Compute user profile vector
  const userVector = computeTFIDF(userProfile, vocab)

  // Score each candidate
  const scored: ScoredBook[] = filtered.map((book, i) => {
    const bookVector = computeTFIDF(candidateTexts[i], vocab)
    let score = cosineSimilarity(userVector, bookVector)

    // Community boost: small nudge for popular books
    if (communityBoost && book.metadata?.readinglogCount) {
      score *= 1 + Math.log10(book.metadata.readinglogCount + 1) * 0.03
    }

    // Quality boost for high-rated books
    if (book.rating >= 4.0) {
      score *= 1 + (book.rating - 3.5) * 0.05
    }

    const reasons = generateReasons(book, likedBooks)

    return { book, score, finalScore: score, reasons }
  })

  // Sort by score
  scored.sort((a, b) => b.finalScore - a.finalScore)

  return scored
}

// --- MMR Diversity ---
export function applyMMR(
  scored: ScoredBook[],
  count: number,
  lambda: number = 0.7
): ScoredBook[] {
  if (scored.length <= count) return scored

  const selected: ScoredBook[] = []
  const remaining = [...scored]

  // Always pick the top-scoring book first
  selected.push(remaining.shift()!)

  while (selected.length < count && remaining.length > 0) {
    let bestIdx = 0
    let bestMMR = -Infinity

    for (let i = 0; i < remaining.length; i++) {
      const relevance = remaining[i].finalScore

      // Max similarity to already-selected books (genre-based approximation)
      let maxSim = 0
      selected.forEach((sel) => {
        const genreOverlap =
          remaining[i].book.genre.filter((g) =>
            sel.book.genre.includes(g)
          ).length /
          Math.max(
            remaining[i].book.genre.length,
            sel.book.genre.length,
            1
          )
        const authorSim =
          remaining[i].book.author === sel.book.author ? 0.5 : 0
        maxSim = Math.max(maxSim, genreOverlap + authorSim)
      })

      const mmrScore = lambda * relevance - (1 - lambda) * maxSim
      if (mmrScore > bestMMR) {
        bestMMR = mmrScore
        bestIdx = i
      }
    }

    selected.push(remaining.splice(bestIdx, 1)[0])
  }

  return selected
}

// --- Genre Diversity Filter ---
export function ensureGenreDiversity(
  books: ScoredBook[],
  minGenres: number
): ScoredBook[] {
  if (books.length === 0) return books

  const selected: ScoredBook[] = []
  const genresSeen: Record<string, boolean> = {}
  let genreCount = 0
  const remaining = [...books]

  // First pass: pick one from each unseen genre
  remaining.forEach((item) => {
    if (genreCount >= minGenres) return
    const newGenre = item.book.genre.find((g) => !genresSeen[g])
    if (newGenre) {
      selected.push(item)
      item.book.genre.forEach((g) => {
        if (!genresSeen[g]) {
          genresSeen[g] = true
          genreCount++
        }
      })
    }
  })

  // Second pass: fill remaining slots
  remaining.forEach((item) => {
    if (!selected.includes(item)) {
      selected.push(item)
    }
  })

  return selected
}
