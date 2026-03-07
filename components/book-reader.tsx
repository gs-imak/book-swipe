"use client"

import { useState, useEffect, useRef, useCallback, useMemo } from "react"
import { motion, AnimatePresence } from "framer-motion"
import { ArrowLeft, Sun, Coffee, Moon, Loader2, AlertCircle, BookOpen, Minus, Plus, List, ChevronsUp } from "lucide-react"
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
    | { type: "image"; src: string; caption?: string }

  const blocks = useMemo<TextBlock[]>(() => {
    if (!text) return []
    const raw = text.split(/\n{2,}/).filter((p) => p.trim().length > 0)
    const result: TextBlock[] = []

    const chapterRe = /^(?:chapter|book|part|act|section|prologue|epilogue|introduction|preface|foreword|contents)\b/i
    const separatorRe = /^\s*(?:[*\-_]{3,}|\*\s+\*\s+\*)\s*$/
    const illustrationRe = /\[Illustration(?::?\s*(.+?))?\]/i

    let imgIndex = 0

    for (let idx = 0; idx < raw.length; idx++) {
      const trimmed = raw[idx].trim()

      // Scene break separators (*** or --- or ___)
      if (separatorRe.test(trimmed)) {
        result.push({ type: "separator" })
        continue
      }

      // Illustration markers — [Illustration] or [Illustration: caption]
      const illMatch = illustrationRe.exec(trimmed)
      if (illMatch) {
        const caption = illMatch[1]?.trim()
        if (images.length > imgIndex) {
          result.push({ type: "image", src: images[imgIndex], caption })
          imgIndex++
        } else if (images.length > 0) {
          // More markers than images — skip the marker
        }
        // If the block has more text around the illustration marker, add it too
        const remaining = trimmed.replace(illustrationRe, "").trim()
        if (remaining.length > 10) {
          result.push({ type: "paragraph", text: remaining.replace(/\n/g, " ").replace(/\s{2,}/g, " ") })
        }
        continue
      }

      // Chapter / section headings (may have subtitle on next line)
      if (chapterRe.test(trimmed)) {
        const headLines = trimmed.split("\n").map((l) => l.trim())
        const mainLine = headLines[0]
        if (mainLine.length < 120) {
          const subtitle = headLines.length > 1 ? headLines.slice(1).join(" ") : undefined
          result.push({ type: "heading", text: mainLine, subtitle })
          continue
        }
      }

      // ALL CAPS short lines → likely headings
      const firstLine = trimmed.split("\n")[0].trim()
      if (
        firstLine.length > 2 &&
        firstLine.length < 80 &&
        firstLine === firstLine.toUpperCase() &&
        /[A-Z]/.test(firstLine) &&
        !/[a-z]/.test(firstLine)
      ) {
        const allLines = trimmed.split("\n").map((l) => l.trim())
        if (allLines.length === 1) {
          result.push({ type: "heading", text: firstLine })
          continue
        }
        const avgLen = allLines.reduce((s, l) => s + l.length, 0) / allLines.length
        if (avgLen < 50) {
          result.push({ type: "verse", lines: allLines })
          continue
        }
      }

      // Check if this block has intentional short lines (verse, TOC, addresses, poetry)
      const lines = trimmed.split("\n")
      if (lines.length > 1) {
        const avgLen = lines.reduce((s, l) => s + l.trim().length, 0) / lines.length
        if (avgLen < 50) {
          result.push({ type: "verse", lines: lines.map((l) => l.trim()) })
          continue
        }
      }

      // Regular paragraph — unwrap hard line-wrapping into flowing text
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
  const minsRemaining = totalWords > 0 ? Math.max(1, Math.round((totalWords * (1 - progress / 100)) / 250)) : 0

  // Chapter detection
  interface Chapter { title: string; charOffset: number; page: number }
  const chapters = useMemo<Chapter[]>(() => {
    if (!text) return []
    const result: Chapter[] = []
    const regex = /^(?:chapter|book|part|act|section|prologue|epilogue)\s*[\divxlcdm]*[.:)\-—]*\s*.{0,60}$/gim
    let match: RegExpExecArray | null
    while ((match = regex.exec(text)) !== null) {
      const title = match[0].trim()
      if (title.length < 4) continue // skip noise
      result.push({
        title: title.slice(0, 60),
        charOffset: match.index,
        page: Math.max(1, Math.ceil(match.index / CHARS_PER_PAGE)),
      })
    }
    return result
  }, [text])

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

  const jumpToChapter = useCallback((ch: { charOffset: number }) => {
    if (!text) return
    jumpToRatio(ch.charOffset / text.length)
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
                        <div key={i} className="mt-14 mb-8 text-center">
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
                            {block.text}
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
                              {block.subtitle}
                            </p>
                          )}
                        </div>
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
                          {block.lines.join("\n")}
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
                        {block.text}
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
                  paddingBottom: "max(12px, env(safe-area-inset-bottom, 12px))",
                }}
              >
                {/* Navigation panel (slides up) */}
                <AnimatePresence>
                  {showNavPanel && (
                    <motion.div
                      initial={{ height: 0, opacity: 0 }}
                      animate={{ height: "auto", opacity: 1 }}
                      exit={{ height: 0, opacity: 0 }}
                      transition={{ duration: 0.2 }}
                      className="overflow-hidden"
                      style={{ borderBottom: `1px solid ${currentTheme.border}` }}
                    >
                      <div className="px-4 pt-3 pb-2 space-y-3">
                        {/* Page scrubber */}
                        <div>
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
                          <div className="flex justify-between text-[10px] opacity-30 mt-0.5 tabular-nums">
                            <span>1</span>
                            <span>{totalPages}</span>
                          </div>
                        </div>

                        {/* Chapters */}
                        {chapters.length > 0 && (
                          <div>
                            <div className="flex items-center gap-1.5 mb-1.5">
                              <List className="w-3 h-3 opacity-40" />
                              <span className="text-[10px] font-semibold uppercase tracking-wider opacity-40">
                                Chapters
                              </span>
                            </div>
                            <div className="max-h-44 overflow-y-auto overscroll-contain space-y-0.5 -mx-1">
                              {chapters.map((ch, i) => {
                                const isCurrentOrPast = ch.page <= currentPage
                                return (
                                  <button
                                    key={i}
                                    onClick={() => jumpToChapter(ch)}
                                    className="w-full text-left px-2 py-1.5 rounded-lg text-xs transition-opacity hover:opacity-80 flex justify-between items-center gap-2"
                                    style={{
                                      backgroundColor: isCurrentOrPast ? `${currentTheme.progressFill}18` : "transparent",
                                      fontWeight: isCurrentOrPast ? 500 : 400,
                                    }}
                                  >
                                    <span className="truncate">{ch.title}</span>
                                    <span className="text-[10px] opacity-40 flex-shrink-0 tabular-nums">
                                      p.{ch.page}
                                    </span>
                                  </button>
                                )
                              })}
                            </div>
                          </div>
                        )}
                      </div>
                    </motion.div>
                  )}
                </AnimatePresence>

                {/* Main controls bar */}
                <div className="flex items-center justify-between px-4 h-12">
                  {/* Page info (tappable) */}
                  <button
                    onClick={() => setShowNavPanel((p) => !p)}
                    className="flex items-center gap-1.5 min-w-[70px] transition-opacity hover:opacity-80"
                    aria-label="Open navigation"
                  >
                    <ChevronsUp
                      className="w-3.5 h-3.5 opacity-40 transition-transform"
                      style={{ transform: showNavPanel ? "rotate(180deg)" : "rotate(0deg)" }}
                    />
                    <span className="text-[11px] tabular-nums font-medium opacity-60">
                      {currentPage}/{totalPages}
                    </span>
                  </button>

                  {/* Font controls */}
                  <div className="flex items-center gap-3">
                    <motion.button
                      whileTap={{ scale: 0.9 }}
                      onClick={() => setFontSize((s) => Math.max(14, s - 1))}
                      disabled={fontSize <= 14}
                      className="tap-target w-9 h-9 rounded-full flex items-center justify-center transition-all disabled:opacity-30"
                      style={{ color: currentTheme.text }}
                      aria-label="Decrease font size"
                    >
                      <Minus className="w-3.5 h-3.5" />
                    </motion.button>

                    <div className="flex items-center gap-1">
                      <BookOpen className="w-3.5 h-3.5 opacity-40" />
                      <span className="text-[11px] tabular-nums opacity-50">{fontSize}</span>
                    </div>

                    <motion.button
                      whileTap={{ scale: 0.9 }}
                      onClick={() => setFontSize((s) => Math.min(24, s + 1))}
                      disabled={fontSize >= 24}
                      className="tap-target w-9 h-9 rounded-full flex items-center justify-center transition-all disabled:opacity-30"
                      style={{ color: currentTheme.text }}
                      aria-label="Increase font size"
                    >
                      <Plus className="w-3.5 h-3.5" />
                    </motion.button>
                  </div>

                  {/* Time remaining */}
                  <span className="text-[10px] tabular-nums opacity-40 min-w-[70px] text-right">
                    {progress >= 98 ? "Finished!" : `~${minsRemaining}m left`}
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
