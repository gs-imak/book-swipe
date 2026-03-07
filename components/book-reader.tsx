"use client"

import { useState, useEffect, useRef, useCallback, useMemo } from "react"
import { motion, AnimatePresence } from "framer-motion"
import { ArrowLeft, ChevronLeft, ChevronRight, Sun, Coffee, Moon, Loader2, AlertCircle, BookOpen, Minus, Plus, List, X, Search } from "lucide-react"
import { GutenbergBook, fetchBookText, fetchBookImages } from "@/lib/gutenberg-api"
import { saveReadingPosition, getReadingPosition } from "@/lib/storage"

type ReaderTheme = "light" | "sepia" | "dark"

interface BookReaderProps {
  bookId: string
  bookTitle: string
  gutenbergBook: GutenbergBook
  isOpen: boolean
  onClose: () => void
}

const THEME_KEY = "bookswipe_reader_theme"

const themes: Record<ReaderTheme, { bg: string; text: string; border: string; barBg: string; progressTrack: string; progressFill: string }> = {
  light: {
    bg: "#FDFBF7",
    text: "#1c1917",
    border: "rgba(0,0,0,0.08)",
    barBg: "rgba(253,251,247,0.88)",
    progressTrack: "rgba(0,0,0,0.1)",
    progressFill: "#d97706",
  },
  sepia: {
    bg: "#F5EFE0",
    text: "#3d2b1f",
    border: "rgba(0,0,0,0.08)",
    barBg: "rgba(245,239,224,0.88)",
    progressTrack: "rgba(0,0,0,0.1)",
    progressFill: "#d97706",
  },
  dark: {
    bg: "#1c1917",
    text: "#e7e5e4",
    border: "rgba(255,255,255,0.08)",
    barBg: "rgba(28,25,23,0.88)",
    progressTrack: "rgba(255,255,255,0.15)",
    progressFill: "#fbbf24",
  },
}

const themeIcons: Record<ReaderTheme, typeof Sun> = {
  light: Sun,
  sepia: Coffee,
  dark: Moon,
}

const themeOrder: ReaderTheme[] = ["light", "sepia", "dark"]

function getStoredTheme(): ReaderTheme {
  if (typeof window === "undefined") return "sepia"
  try {
    const stored = localStorage.getItem(THEME_KEY)
    if (stored === "light" || stored === "sepia" || stored === "dark") return stored
  } catch {
    // ignore
  }
  return "sepia"
}

/**
 * Renders inline text with Gutenberg formatting:
 * _text_ → italic (Gutenberg convention for emphasis)
 */
function RenderInlineText({ text }: { text: string }) {
  const parts: React.ReactNode[] = []
  const re = /_([^_\n]{2,}?)_/g
  let lastIndex = 0
  let match: RegExpExecArray | null
  while ((match = re.exec(text)) !== null) {
    if (match.index > lastIndex) {
      parts.push(text.slice(lastIndex, match.index))
    }
    parts.push(<em key={match.index}>{match[1]}</em>)
    lastIndex = match.index + match[0].length
  }
  if (parts.length === 0) return <>{text}</>
  if (lastIndex < text.length) parts.push(text.slice(lastIndex))
  return <>{parts}</>
}

export default function BookReader({ bookId, bookTitle, gutenbergBook, isOpen, onClose }: BookReaderProps) {
  const [theme, setTheme] = useState<ReaderTheme>(getStoredTheme)
  const [fontSize, setFontSize] = useState(17)
  const [text, setText] = useState<string | null>(null)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [progress, setProgress] = useState(0)
  const [showNavPanel, setShowNavPanel] = useState(false)
  const [images, setImages] = useState<string[]>([])

  const scrollRef = useRef<HTMLDivElement>(null)
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null)
  const hasRestoredRef = useRef(false)

  type TextBlock =
    | { type: "heading"; text: string; subtitle?: string }
    | { type: "paragraph"; text: string }
    | { type: "separator" }
    | { type: "verse"; lines: string[] }
    | { type: "centered"; lines: string[] }
    | { type: "blockquote"; text: string }
    | { type: "image"; src: string; caption?: string }

  const blocks = useMemo<TextBlock[]>(() => {
    if (!text) return []
    // Normalize line endings (safety net for cached text with \r\n)
    const normalized = text.replace(/\r\n/g, "\n").replace(/\r/g, "\n")
    const raw = normalized.split(/\n{2,}/).filter((p) => p.trim().length > 0)
    const result: TextBlock[] = []

    const chapterRe = /^(?:chapter|book|part|act|section|prologue|epilogue|introduction|preface|foreword|contents|letter)\b/i
    const separatorRe = /^\s*(?:[*\-_]{3,}|\*\s+\*\s+\*)\s*$/
    const illustrationRe = /\[Illustration(?::?\s*([\s\S]+?))?\]/i

    let imgIndex = 0
    let firstHeadingSeen = false

    for (let idx = 0; idx < raw.length; idx++) {
      const block = raw[idx]
      const trimmed = block.trim()

      // Skip empty/whitespace blocks
      if (trimmed.length === 0) continue

      // Scene break separators (*** or --- or ___)
      if (separatorRe.test(trimmed)) {
        result.push({ type: "separator" })
        continue
      }

      // Illustration markers — [Illustration] or [Illustration: caption]
      // Use dotAll (s flag) to match across newlines within the marker
      const illMatch = illustrationRe.exec(trimmed)
      if (illMatch) {
        const caption = illMatch[1]?.trim()
        if (images.length > imgIndex) {
          result.push({ type: "image", src: images[imgIndex], caption })
          imgIndex++
        }
        // Check for text outside the illustration marker
        const remaining = trimmed.replace(illustrationRe, "").trim()
        if (remaining.length > 10) {
          result.push({ type: "paragraph", text: remaining.replace(/\n/g, " ").replace(/\s{2,}/g, " ") })
        }
        continue
      }

      // Skip standalone bracket fragments from split illustration markers
      if (/^\]?\s*$/.test(trimmed) || /^\[Illustration/.test(trimmed)) continue

      const lines = block.split("\n")
      const nonEmptyLines = lines.filter((l) => l.trim().length > 0)
      if (nonEmptyLines.length === 0) continue

      // --- Centered text detection ---
      // Lines with significant leading whitespace (>5 spaces) = centered
      // Common in title pages, dedications, epigraphs
      const indentedCount = nonEmptyLines.filter((l) => /^ {5,}/.test(l)).length
      if (indentedCount >= nonEmptyLines.length * 0.6 && nonEmptyLines.length >= 2) {
        const trimmedLines = nonEmptyLines.map((l) => l.trim())
        const avgLen = trimmedLines.reduce((s, l) => s + l.length, 0) / trimmedLines.length
        if (avgLen < 65) {
          result.push({ type: "centered", lines: trimmedLines })
          continue
        }
      }

      // --- Chapter/section headings ---
      // Must be short and match chapter keywords
      const headLines = trimmed.split("\n").map((l) => l.trim())
      const mainLine = headLines[0]
      if (chapterRe.test(trimmed) && mainLine.length < 100) {
        // Multi-line block starting with chapter keyword: check if it's a TOC
        if (headLines.length > 5) {
          // Many lines = this is a table of contents, not a heading
          result.push({ type: "verse", lines: headLines })
        } else {
          const subtitle = headLines.length > 1 ? headLines.slice(1).join(" ").trim() : undefined
          result.push({ type: "heading", text: mainLine, subtitle: subtitle || undefined })
          firstHeadingSeen = true
        }
        continue
      }

      // --- ALL CAPS detection ---
      const firstLineTrim = headLines[0]
      const alphaChars = firstLineTrim.replace(/[^A-Za-z]/g, "")
      if (
        alphaChars.length >= 3 &&
        firstLineTrim.length < 80 &&
        firstLineTrim === firstLineTrim.toUpperCase() &&
        /[A-Z]/.test(firstLineTrim) &&
        !/[a-z]/.test(firstLineTrim)
      ) {
        if (nonEmptyLines.length === 1) {
          result.push({ type: "heading", text: firstLineTrim })
          firstHeadingSeen = true
          continue
        }
        const allTrimmed = nonEmptyLines.map((l) => l.trim())
        const avgLen = allTrimmed.reduce((s, l) => s + l.length, 0) / allTrimmed.length
        if (avgLen < 50) {
          result.push({ type: "verse", lines: allTrimmed })
          continue
        }
      }

      // --- Pre-heading title page lines ---
      // Short single lines before any chapter heading = title/author info → center them
      if (!firstHeadingSeen && nonEmptyLines.length === 1 && trimmed.length < 60) {
        result.push({ type: "centered", lines: [trimmed] })
        continue
      }

      // --- Indented blocks (block quotes, letters, dedications) ---
      const allIndented = nonEmptyLines.every((l) => /^ {2,}/.test(l))
      if (allIndented && nonEmptyLines.length >= 2) {
        const trimmedLines = nonEmptyLines.map((l) => l.trim())
        const avgLen = trimmedLines.reduce((s, l) => s + l.length, 0) / trimmedLines.length
        if (avgLen < 50) {
          result.push({ type: "verse", lines: trimmedLines })
          continue
        }
        const unwrapped = trimmedLines.join(" ").replace(/\s{2,}/g, " ")
        result.push({ type: "blockquote", text: unwrapped })
        continue
      }

      // --- Verse / poetry / TOC / short-line blocks ---
      if (nonEmptyLines.length > 1) {
        const trimmedLines = nonEmptyLines.map((l) => l.trim())
        const avgLen = trimmedLines.reduce((s, l) => s + l.length, 0) / trimmedLines.length
        const longLineCount = trimmedLines.filter((l) => l.length > 55).length
        if (avgLen < 45 && longLineCount < trimmedLines.length * 0.3) {
          result.push({ type: "verse", lines: trimmedLines })
          continue
        }
      }

      // --- Regular paragraph ---
      // Unwrap hard line-wrapping (Gutenberg wraps at ~70 chars) into flowing text
      const unwrapped = trimmed.replace(/\n/g, " ").replace(/\s{2,}/g, " ")
      result.push({ type: "paragraph", text: unwrapped })
    }

    return result
  }, [text, images])

  // Page & time calculations
  const CHARS_PER_PAGE = 1500
  const totalPages = text ? Math.ceil(text.length / CHARS_PER_PAGE) : 0
  const currentPage = totalPages > 0 ? Math.max(1, Math.ceil((progress / 100) * totalPages)) : 0
  const totalWords = text ? Math.round(text.length / 5) : 0
  const wordsRead = Math.round(totalWords * (progress / 100))
  const minsRemaining = totalWords > 0 ? Math.max(1, Math.round((totalWords * (1 - progress / 100)) / 250)) : 0

  // Derive chapters from parsed heading blocks (much more precise than regex)
  interface Chapter { title: string; blockIndex: number; subtitle?: string }
  const chapters = useMemo<Chapter[]>(() => {
    const result: Chapter[] = []
    for (let i = 0; i < blocks.length; i++) {
      const b = blocks[i]
      if (b.type === "heading") {
        result.push({ title: b.text, blockIndex: i, subtitle: b.subtitle })
      }
    }
    return result
  }, [blocks])

  // Current chapter based on scroll position
  const currentChapterIndex = useMemo(() => {
    if (chapters.length === 0) return -1
    // Find the last chapter whose block is before or at the current scroll ratio
    const scrollRatio = progress / 100
    const totalBlocks = blocks.length
    let lastIdx = -1
    for (let i = 0; i < chapters.length; i++) {
      const blockRatio = chapters[i].blockIndex / totalBlocks
      if (blockRatio <= scrollRatio + 0.01) lastIdx = i
    }
    return lastIdx
  }, [chapters, blocks.length, progress])

  const currentChapter = currentChapterIndex >= 0 ? chapters[currentChapterIndex] : null

  const jumpToRatio = useCallback((ratio: number) => {
    const el = scrollRef.current
    if (!el) return
    const scrollable = el.scrollHeight - el.clientHeight
    el.scrollTop = Math.max(0, Math.min(1, ratio)) * scrollable
  }, [])

  const jumpToPage = useCallback((page: number) => {
    if (totalPages <= 1) return
    jumpToRatio((page - 1) / (totalPages - 1))
  }, [totalPages, jumpToRatio])

  const jumpToBlock = useCallback((blockIndex: number) => {
    const el = scrollRef.current
    if (!el) return
    // Find the heading element by data attribute
    const target = el.querySelector(`[data-block-index="${blockIndex}"]`)
    if (target) {
      target.scrollIntoView({ behavior: "smooth", block: "start" })
    } else {
      // Fallback: estimate position by block ratio
      jumpToRatio(blockIndex / blocks.length)
    }
  }, [blocks.length, jumpToRatio])

  const jumpToChapter = useCallback((ch: Chapter) => {
    jumpToBlock(ch.blockIndex)
    setShowNavPanel(false)
  }, [jumpToBlock])

  const goToPrevChapter = useCallback(() => {
    if (currentChapterIndex > 0) {
      jumpToChapter(chapters[currentChapterIndex - 1])
    }
  }, [currentChapterIndex, chapters, jumpToChapter])

  const goToNextChapter = useCallback(() => {
    if (currentChapterIndex < chapters.length - 1) {
      jumpToChapter(chapters[currentChapterIndex + 1])
    }
  }, [currentChapterIndex, chapters, jumpToChapter])

  // Search within book
  const [searchOpen, setSearchOpen] = useState(false)
  const [searchQuery, setSearchQuery] = useState("")
  const searchResults = useMemo(() => {
    if (!searchQuery || searchQuery.length < 2 || !text) return []
    const query = searchQuery.toLowerCase()
    const results: { text: string; charOffset: number; page: number }[] = []
    let startIdx = 0
    const lowerText = text.toLowerCase()
    while (results.length < 50) {
      const idx = lowerText.indexOf(query, startIdx)
      if (idx === -1) break
      const contextStart = Math.max(0, idx - 30)
      const contextEnd = Math.min(text.length, idx + query.length + 30)
      results.push({
        text: (contextStart > 0 ? "..." : "") + text.slice(contextStart, contextEnd) + (contextEnd < text.length ? "..." : ""),
        charOffset: idx,
        page: Math.max(1, Math.ceil(idx / CHARS_PER_PAGE)),
      })
      startIdx = idx + query.length
    }
    return results
  }, [searchQuery, text])

  const jumpToSearchResult = useCallback((charOffset: number) => {
    if (!text) return
    jumpToRatio(charOffset / text.length)
    setSearchOpen(false)
    setShowNavPanel(false)
  }, [text, jumpToRatio])

  const currentTheme = themes[theme]
  const ThemeIcon = themeIcons[theme]

  const cycleTheme = useCallback(() => {
    setTheme((prev) => {
      const idx = themeOrder.indexOf(prev)
      const next = themeOrder[(idx + 1) % themeOrder.length]
      try {
        localStorage.setItem(THEME_KEY, next)
      } catch {
        // ignore
      }
      return next
    })
  }, [])

  useEffect(() => {
    if (!isOpen) {
      hasRestoredRef.current = false
      if (debounceRef.current) clearTimeout(debounceRef.current)
      return
    }

    setLoading(true)
    setError(null)
    setText(null)

    let cancelled = false
    fetchBookText(gutenbergBook)
      .then((result) => {
        if (!cancelled) {
          if (!result) {
            setError("Could not load book text. The file may be unavailable.")
          } else {
            setText(result)
          }
        }
      })
      .catch(() => {
        if (!cancelled) setError("Could not load book text. The file may be unavailable.")
      })
      .finally(() => {
        if (!cancelled) setLoading(false)
      })
    // Fetch illustrations in parallel
    fetchBookImages(gutenbergBook)
      .then((imgs) => {
        if (!cancelled) setImages(imgs)
      })
      .catch(() => {})
    return () => {
      cancelled = true
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isOpen, gutenbergBook.id])

  useEffect(() => {
    if (!text || !scrollRef.current || hasRestoredRef.current) return
    hasRestoredRef.current = true

    const charOffset = getReadingPosition(bookId)
    if (charOffset <= 0) return

    const ratio = charOffset / text.length
    const el = scrollRef.current
    requestAnimationFrame(() => {
      el.scrollTop = ratio * el.scrollHeight
    })
  }, [text, bookId])

  const handleScroll = useCallback(() => {
    const el = scrollRef.current
    if (!el || !text) return

    const scrollable = el.scrollHeight - el.clientHeight
    if (scrollable <= 0) return

    const ratio = el.scrollTop / scrollable
    const pct = Math.min(100, Math.max(0, Math.round(ratio * 100)))
    setProgress(pct)

    if (debounceRef.current) clearTimeout(debounceRef.current)
    debounceRef.current = setTimeout(() => {
      saveReadingPosition(bookId, Math.round(ratio * text.length))
    }, 500)
  }, [text, bookId])

  useEffect(() => {
    if (isOpen) {
      document.body.style.overflow = "hidden"
    }
    return () => {
      document.body.style.overflow = ""
    }
  }, [isOpen])

  useEffect(() => {
    if (!isOpen) return

    const handleKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose()
    }
    window.addEventListener("keydown", handleKey)
    return () => window.removeEventListener("keydown", handleKey)
  }, [isOpen, onClose])

  useEffect(() => {
    return () => {
      if (debounceRef.current) clearTimeout(debounceRef.current)
    }
  }, [])

  return (
    <AnimatePresence>
      {isOpen && (
        <motion.div
          initial={{ y: "100%" }}
          animate={{ y: 0 }}
          exit={{ y: "100%" }}
          transition={{ type: "spring", stiffness: 280, damping: 32 }}
          className="fixed inset-0 z-[60] flex flex-col"
          style={{ backgroundColor: currentTheme.bg, color: currentTheme.text }}
          role="dialog"
          aria-modal="true"
          aria-label={`Reading ${bookTitle}`}
        >
          {/* Top bar */}
          <div
            className="sticky top-0 z-10 flex-shrink-0"
            style={{
              backgroundColor: currentTheme.barBg,
              backdropFilter: "blur(12px)",
              WebkitBackdropFilter: "blur(12px)",
              borderBottom: `1px solid ${currentTheme.border}`,
              paddingTop: "env(safe-area-inset-top)",
            }}
          >
            <div className="flex items-center justify-between px-4 h-12">
              <motion.button
                whileTap={{ scale: 0.9 }}
                onClick={onClose}
                className="tap-target flex items-center justify-center rounded-lg p-2 -ml-2 transition-colors"
                style={{ color: currentTheme.text }}
                aria-label="Close reader"
              >
                <ArrowLeft className="w-5 h-5" />
              </motion.button>

              <div className="flex-1 mx-4 min-w-0 text-center">
                <p className="text-xs font-medium truncate opacity-70">{bookTitle}</p>
                <div className="flex items-center justify-center gap-2 mt-0.5">
                  <div className="max-w-[100px] w-full h-[3px] rounded-full overflow-hidden" style={{ backgroundColor: currentTheme.progressTrack }}>
                    <motion.div
                      className="h-full rounded-full"
                      style={{ backgroundColor: currentTheme.progressFill }}
                      initial={{ width: 0 }}
                      animate={{ width: `${progress}%` }}
                      transition={{ duration: 0.3, ease: "easeOut" }}
                    />
                  </div>
                  <span className="text-[10px] tabular-nums opacity-50">{progress}%</span>
                </div>
              </div>

              <motion.button
                whileTap={{ scale: 0.9 }}
                onClick={cycleTheme}
                className="tap-target flex items-center justify-center rounded-lg p-2 -mr-2 transition-colors"
                style={{ color: currentTheme.text }}
                aria-label={`Switch theme, currently ${theme}`}
              >
                <AnimatePresence mode="wait">
                  <motion.div
                    key={theme}
                    initial={{ opacity: 0, scale: 0.7 }}
                    animate={{ opacity: 1, scale: 1 }}
                    exit={{ opacity: 0, scale: 0.7 }}
                    transition={{ duration: 0.15 }}
                  >
                    <ThemeIcon className="w-5 h-5" />
                  </motion.div>
                </AnimatePresence>
              </motion.button>
            </div>
          </div>

          {/* Content area */}
          {loading && (
            <div className="flex-1 flex flex-col items-center justify-center gap-3">
              <Loader2 className="w-8 h-8 animate-spin opacity-40" />
              <p className="text-sm opacity-50">Loading book...</p>
            </div>
          )}

          {error && (
            <div className="flex-1 flex flex-col items-center justify-center gap-3 px-6">
              <AlertCircle className="w-8 h-8 opacity-40" />
              <p className="text-sm opacity-60 text-center">{error}</p>
              <motion.button
                whileTap={{ scale: 0.9 }}
                onClick={onClose}
                className="tap-target mt-2 px-4 py-2 rounded-lg text-sm font-medium transition-colors"
                style={{
                  backgroundColor: currentTheme.border,
                  color: currentTheme.text,
                }}
              >
                Go back
              </motion.button>
            </div>
          )}

          {!loading && !error && text && (
            <>
              <div
                ref={scrollRef}
                onScroll={handleScroll}
                className="flex-1 overflow-y-auto"
                style={{ overscrollBehavior: "contain" }}
              >
                <div
                  className="max-w-2xl mx-auto px-5 sm:px-8 py-8"
                  style={{ paddingBottom: "calc(2rem + env(safe-area-inset-bottom))" }}
                >
                  {blocks.map((block, i) => {
                    if (block.type === "separator") {
                      return (
                        <div key={i} className="flex items-center justify-center gap-3 py-8 opacity-25">
                          <div className="w-1.5 h-1.5 rounded-full" style={{ backgroundColor: currentTheme.text }} />
                          <div className="w-1.5 h-1.5 rounded-full" style={{ backgroundColor: currentTheme.text }} />
                          <div className="w-1.5 h-1.5 rounded-full" style={{ backgroundColor: currentTheme.text }} />
                        </div>
                      )
                    }

                    if (block.type === "image") {
                      return (
                        <div key={i} className="my-6 flex flex-col items-center gap-2">
                          {/* eslint-disable-next-line @next/next/no-img-element */}
                          <img
                            src={block.src}
                            alt={block.caption || "Illustration"}
                            className="max-w-full rounded-lg shadow-sm"
                            style={{ maxHeight: "60vh" }}
                            loading="lazy"
                          />
                          {block.caption && (
                            <p
                              className="text-center italic opacity-50"
                              style={{
                                fontFamily: "Georgia, 'Source Serif 4', serif",
                                fontSize: `${fontSize - 2}px`,
                              }}
                            >
                              {block.caption}
                            </p>
                          )}
                        </div>
                      )
                    }

                    if (block.type === "heading") {
                      return (
                        <div key={i} className="mt-14 mb-8 text-center" data-block-index={i}>
                          <h2
                            className="font-bold"
                            style={{
                              fontFamily: "Georgia, 'Source Serif 4', serif",
                              fontSize: `${fontSize + 4}px`,
                              lineHeight: "1.4",
                              letterSpacing: "0.02em",
                              color: currentTheme.text,
                            }}
                          >
                            <RenderInlineText text={block.text} />
                          </h2>
                          {block.subtitle && (
                            <p
                              className="mt-2 italic opacity-60"
                              style={{
                                fontFamily: "Georgia, 'Source Serif 4', serif",
                                fontSize: `${fontSize}px`,
                                color: currentTheme.text,
                              }}
                            >
                              <RenderInlineText text={block.subtitle} />
                            </p>
                          )}
                        </div>
                      )
                    }

                    if (block.type === "centered") {
                      return (
                        <div
                          key={i}
                          className="my-8 text-center"
                          style={{
                            fontFamily: "Georgia, 'Source Serif 4', serif",
                            fontSize: `${fontSize}px`,
                            lineHeight: "1.7",
                            color: currentTheme.text,
                          }}
                        >
                          {block.lines.map((line, j) => (
                            <div key={j} className={line.length < 30 ? "opacity-70" : ""}>
                              <RenderInlineText text={line} />
                            </div>
                          ))}
                        </div>
                      )
                    }

                    if (block.type === "blockquote") {
                      return (
                        <blockquote
                          key={i}
                          className="mb-5 pl-4 italic"
                          style={{
                            fontFamily: "Georgia, 'Source Serif 4', serif",
                            fontSize: `${fontSize}px`,
                            lineHeight: "1.85",
                            letterSpacing: "0.01em",
                            color: currentTheme.text,
                            borderLeft: `3px solid ${currentTheme.progressFill}`,
                            opacity: 0.85,
                          }}
                        >
                          <RenderInlineText text={block.text} />
                        </blockquote>
                      )
                    }

                    if (block.type === "verse") {
                      return (
                        <div
                          key={i}
                          className="mb-5 whitespace-pre-line"
                          style={{
                            fontFamily: "Georgia, 'Source Serif 4', serif",
                            fontSize: `${fontSize}px`,
                            lineHeight: "1.85",
                            letterSpacing: "0.01em",
                            color: currentTheme.text,
                          }}
                        >
                          {block.lines.map((line, j) => (
                            <span key={j}>
                              <RenderInlineText text={line} />
                              {j < block.lines.length - 1 ? "\n" : ""}
                            </span>
                          ))}
                        </div>
                      )
                    }

                    return (
                      <p
                        key={i}
                        className="mb-5 leading-relaxed text-justify"
                        style={{
                          fontFamily: "Georgia, 'Source Serif 4', serif",
                          fontSize: `${fontSize}px`,
                          lineHeight: "1.85",
                          letterSpacing: "0.01em",
                          color: currentTheme.text,
                        }}
                      >
                        <RenderInlineText text={block.text} />
                      </p>
                    )
                  })}
                </div>
              </div>

              {/* Bottom controls */}
              <div
                className="flex-shrink-0 z-20"
                style={{
                  backgroundColor: currentTheme.bg,
                  borderTop: `1px solid ${currentTheme.border}`,
                  paddingBottom: "max(8px, env(safe-area-inset-bottom, 8px))",
                }}
              >
                {/* Full-screen navigation overlay */}
                <AnimatePresence>
                  {showNavPanel && (
                    <motion.div
                      initial={{ opacity: 0 }}
                      animate={{ opacity: 1 }}
                      exit={{ opacity: 0 }}
                      transition={{ duration: 0.15 }}
                      className="fixed inset-0 z-30 flex flex-col"
                      style={{ backgroundColor: currentTheme.bg, color: currentTheme.text }}
                    >
                      {/* Nav header */}
                      <div
                        className="flex items-center justify-between px-4 h-12 flex-shrink-0"
                        style={{
                          borderBottom: `1px solid ${currentTheme.border}`,
                          paddingTop: "env(safe-area-inset-top)",
                        }}
                      >
                        <h3 className="text-sm font-semibold">Contents</h3>
                        <button onClick={() => { setShowNavPanel(false); setSearchOpen(false) }} className="p-2 -mr-2 rounded-lg">
                          <X className="w-5 h-5 opacity-60" />
                        </button>
                      </div>

                      {/* Search bar */}
                      <div className="px-4 py-2 flex-shrink-0" style={{ borderBottom: `1px solid ${currentTheme.border}` }}>
                        <div className="relative">
                          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-3.5 h-3.5 opacity-40" />
                          <input
                            type="search"
                            placeholder="Search in book..."
                            value={searchQuery}
                            onChange={(e) => { setSearchQuery(e.target.value); setSearchOpen(e.target.value.length > 1) }}
                            className="w-full pl-9 pr-3 py-2 rounded-lg text-sm outline-none"
                            style={{
                              backgroundColor: `${currentTheme.text}08`,
                              color: currentTheme.text,
                            }}
                          />
                        </div>
                      </div>

                      {/* Search results or chapter list */}
                      <div className="flex-1 overflow-y-auto overscroll-contain">
                        {searchOpen && searchQuery.length > 1 ? (
                          <div className="px-4 py-2">
                            <p className="text-[10px] uppercase tracking-wider opacity-40 font-semibold mb-2">
                              {searchResults.length} result{searchResults.length !== 1 ? "s" : ""}
                            </p>
                            {searchResults.length === 0 && (
                              <p className="text-sm opacity-40 py-8 text-center">No matches found</p>
                            )}
                            {searchResults.map((r, i) => (
                              <button
                                key={i}
                                onClick={() => jumpToSearchResult(r.charOffset)}
                                className="w-full text-left px-3 py-2.5 rounded-lg text-xs mb-1 transition-opacity hover:opacity-80"
                                style={{ backgroundColor: `${currentTheme.text}06` }}
                              >
                                <span className="opacity-60 line-clamp-2" style={{ fontSize: "11px" }}>{r.text}</span>
                                <span className="text-[10px] opacity-30 mt-0.5 block tabular-nums">Page {r.page}</span>
                              </button>
                            ))}
                          </div>
                        ) : (
                          <div className="px-4 py-2">
                            {/* Page scrubber */}
                            <div className="mb-4">
                              <div className="flex items-center justify-between mb-1">
                                <span className="text-[10px] font-semibold uppercase tracking-wider opacity-40">
                                  Go to page
                                </span>
                                <span className="text-xs tabular-nums opacity-60">
                                  {currentPage} of {totalPages}
                                </span>
                              </div>
                              <input
                                type="range"
                                min={1}
                                max={totalPages}
                                value={currentPage}
                                onChange={(e) => jumpToPage(parseInt(e.target.value))}
                                className="w-full h-2 rounded-full appearance-none cursor-pointer"
                                style={{
                                  accentColor: currentTheme.progressFill,
                                  background: `linear-gradient(to right, ${currentTheme.progressFill} ${progress}%, ${currentTheme.progressTrack} ${progress}%)`,
                                }}
                              />
                            </div>

                            {/* Chapter list */}
                            {chapters.length > 0 && (
                              <div>
                                <div className="flex items-center gap-1.5 mb-2">
                                  <List className="w-3.5 h-3.5 opacity-40" />
                                  <span className="text-[10px] font-semibold uppercase tracking-wider opacity-40">
                                    {chapters.length} Chapter{chapters.length !== 1 ? "s" : ""}
                                  </span>
                                </div>
                                <div className="space-y-0.5">
                                  {chapters.map((ch, i) => {
                                    const isCurrent = i === currentChapterIndex
                                    const isPast = i < currentChapterIndex
                                    return (
                                      <button
                                        key={i}
                                        onClick={() => jumpToChapter(ch)}
                                        className="w-full text-left px-3 py-2.5 rounded-lg text-[13px] transition-all flex items-start gap-3"
                                        style={{
                                          backgroundColor: isCurrent ? `${currentTheme.progressFill}20` : "transparent",
                                          fontWeight: isCurrent ? 600 : 400,
                                          opacity: isPast ? 0.5 : 1,
                                        }}
                                      >
                                        <span
                                          className="w-1.5 h-1.5 rounded-full flex-shrink-0 mt-1.5"
                                          style={{
                                            backgroundColor: isCurrent ? currentTheme.progressFill : isPast ? currentTheme.progressFill : `${currentTheme.text}20`,
                                          }}
                                        />
                                        <div className="min-w-0">
                                          <span className="block truncate">{ch.title}</span>
                                          {ch.subtitle && (
                                            <span className="text-[11px] opacity-50 block truncate">{ch.subtitle}</span>
                                          )}
                                        </div>
                                      </button>
                                    )
                                  })}
                                </div>
                              </div>
                            )}

                            {chapters.length === 0 && (
                              <p className="text-sm opacity-40 py-8 text-center">No chapters detected</p>
                            )}

                            {/* Reading stats */}
                            <div
                              className="mt-6 p-3 rounded-xl grid grid-cols-3 gap-3 text-center"
                              style={{ backgroundColor: `${currentTheme.text}06` }}
                            >
                              <div>
                                <div className="text-lg font-bold tabular-nums" style={{ color: currentTheme.progressFill }}>{currentPage}</div>
                                <div className="text-[10px] opacity-40">of {totalPages} pages</div>
                              </div>
                              <div>
                                <div className="text-lg font-bold tabular-nums" style={{ color: currentTheme.progressFill }}>{progress}%</div>
                                <div className="text-[10px] opacity-40">complete</div>
                              </div>
                              <div>
                                <div className="text-lg font-bold tabular-nums" style={{ color: currentTheme.progressFill }}>
                                  {minsRemaining < 60 ? `${minsRemaining}m` : `${Math.floor(minsRemaining / 60)}h${minsRemaining % 60}m`}
                                </div>
                                <div className="text-[10px] opacity-40">remaining</div>
                              </div>
                            </div>
                          </div>
                        )}
                      </div>
                    </motion.div>
                  )}
                </AnimatePresence>

                {/* Current chapter indicator */}
                {currentChapter && (
                  <div className="px-4 pt-1.5 pb-0.5">
                    <p className="text-[10px] truncate opacity-40 text-center">
                      {currentChapter.title}{currentChapter.subtitle ? ` — ${currentChapter.subtitle}` : ""}
                    </p>
                  </div>
                )}

                {/* Main controls bar */}
                <div className="flex items-center justify-between px-3 h-11">
                  {/* Left: prev chapter + page info + TOC */}
                  <div className="flex items-center gap-1">
                    {chapters.length > 0 && (
                      <motion.button
                        whileTap={{ scale: 0.9 }}
                        onClick={goToPrevChapter}
                        disabled={currentChapterIndex <= 0}
                        className="w-8 h-8 rounded-full flex items-center justify-center disabled:opacity-20"
                        aria-label="Previous chapter"
                      >
                        <ChevronLeft className="w-4 h-4" />
                      </motion.button>
                    )}
                    <button
                      onClick={() => setShowNavPanel(true)}
                      className="flex items-center gap-1 px-2 py-1 rounded-lg transition-opacity hover:opacity-80"
                      aria-label="Open table of contents"
                    >
                      <List className="w-3.5 h-3.5 opacity-50" />
                      <span className="text-[11px] tabular-nums font-medium opacity-60">
                        {currentPage}/{totalPages}
                      </span>
                    </button>
                    {chapters.length > 0 && (
                      <motion.button
                        whileTap={{ scale: 0.9 }}
                        onClick={goToNextChapter}
                        disabled={currentChapterIndex >= chapters.length - 1}
                        className="w-8 h-8 rounded-full flex items-center justify-center disabled:opacity-20"
                        aria-label="Next chapter"
                      >
                        <ChevronRight className="w-4 h-4" />
                      </motion.button>
                    )}
                  </div>

                  {/* Center: font controls */}
                  <div className="flex items-center gap-2">
                    <motion.button
                      whileTap={{ scale: 0.9 }}
                      onClick={() => setFontSize((s) => Math.max(14, s - 1))}
                      disabled={fontSize <= 14}
                      className="w-8 h-8 rounded-full flex items-center justify-center disabled:opacity-20"
                      aria-label="Decrease font size"
                    >
                      <Minus className="w-3.5 h-3.5" />
                    </motion.button>
                    <span className="text-[11px] tabular-nums opacity-40 w-5 text-center">{fontSize}</span>
                    <motion.button
                      whileTap={{ scale: 0.9 }}
                      onClick={() => setFontSize((s) => Math.min(24, s + 1))}
                      disabled={fontSize >= 24}
                      className="w-8 h-8 rounded-full flex items-center justify-center disabled:opacity-20"
                      aria-label="Increase font size"
                    >
                      <Plus className="w-3.5 h-3.5" />
                    </motion.button>
                  </div>

                  {/* Right: time remaining */}
                  <span className="text-[10px] tabular-nums opacity-40 min-w-[60px] text-right">
                    {progress >= 98 ? "Done!" : `~${minsRemaining < 60 ? `${minsRemaining}m` : `${Math.floor(minsRemaining / 60)}h ${minsRemaining % 60}m`}`}
                  </span>
                </div>
              </div>
            </>
          )}
        </motion.div>
      )}
    </AnimatePresence>
  )
}
