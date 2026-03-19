"use client"

/**
 * Generate a "Story So Far" recap from text read up to a given position.
 * Uses extractive summarization — picks the most important sentences
 * from the beginning of each chapter/section the reader has passed.
 * No LLM needed — purely algorithmic.
 */

export interface RecapSection {
  chapter: string
  summary: string
}

export function generateRecap(
  fullText: string,
  readRatio: number, // 0-1, how far the reader has progressed
  maxSections: number = 8
): RecapSection[] {
  if (!fullText || readRatio <= 0) return []

  const readUpTo = Math.floor(fullText.length * Math.min(readRatio, 1))
  const readText = fullText.slice(0, readUpTo)

  // Split into chapters/sections
  const chapterRe = /\n\s*(?:CHAPTER|Chapter|LETTER|Letter|BOOK|Book|PART|Part|ACT|Act|SECTION|Section|PROLOGUE|EPILOGUE|INTRODUCTION|PREFACE)\s+[IVXLCDM\d]+[.\s:]?[^\n]*/g
  const splits: { title: string; start: number }[] = []
  let match: RegExpExecArray | null

  while ((match = chapterRe.exec(readText)) !== null) {
    splits.push({ title: match[0].trim(), start: match.index })
  }

  if (splits.length === 0) {
    // No chapters found — treat the whole read text as one section
    return [{
      chapter: "So far",
      summary: extractKeysentences(readText, 3).join(" "),
    }]
  }

  // Extract key sentences from each chapter
  const sections: RecapSection[] = []
  for (let i = 0; i < splits.length && sections.length < maxSections; i++) {
    const start = splits[i].start
    const end = i + 1 < splits.length ? splits[i + 1].start : readText.length
    const chapterText = readText.slice(start, end)

    const sentences = extractKeysentences(chapterText, 2)
    if (sentences.length > 0) {
      sections.push({
        chapter: cleanChapterTitle(splits[i].title),
        summary: sentences.join(" "),
      })
    }
  }

  return sections
}

function cleanChapterTitle(raw: string): string {
  return raw
    .replace(/^\s+|\s+$/g, "")
    .replace(/\n/g, " ")
    .replace(/\s{2,}/g, " ")
    .slice(0, 60)
}

/**
 * Extract the N most important sentences from a chunk of text.
 * Uses a simple TF scoring — sentences with less common words score higher.
 */
function extractKeysentences(text: string, count: number): string[] {
  // Split into sentences
  const sentences = text
    .replace(/\n/g, " ")
    .replace(/\s{2,}/g, " ")
    .split(/(?<=[.!?])\s+/)
    .filter(s => s.length > 30 && s.length < 300)
    .filter(s => !/^\s*(?:chapter|letter|book|part|act|section)/i.test(s))
    .filter(s => !/gutenberg|copyright|license|project|www\./i.test(s))

  if (sentences.length <= count) return sentences

  // Score each sentence by word rarity
  const wordFreq: Record<string, number> = {}
  const words = text.toLowerCase().split(/\W+/).filter(w => w.length > 3)
  words.forEach(w => { wordFreq[w] = (wordFreq[w] || 0) + 1 })

  const scored = sentences.map(s => {
    const sWords = s.toLowerCase().split(/\W+/).filter(w => w.length > 3)
    // Score = sum of inverse frequency (rarer words score higher)
    const score = sWords.reduce((sum, w) => sum + (1 / (wordFreq[w] || 1)), 0) / Math.max(1, sWords.length)
    return { sentence: s, score }
  })

  // Pick top N by score, but maintain original order
  scored.sort((a, b) => b.score - a.score)
  const topSentences = scored.slice(0, count).map(s => s.sentence)

  // Return in original text order
  return sentences.filter(s => topSentences.includes(s)).slice(0, count)
}
