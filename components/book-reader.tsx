"use client"

import { useState, useEffect, useRef, useCallback, useMemo } from "react"
import { motion, AnimatePresence } from "framer-motion"
import { ArrowLeft, Sun, Coffee, Moon, Loader2, AlertCircle, BookOpen, Minus, Plus } from "lucide-react"
import { GutenbergBook, fetchBookText } from "@/lib/gutenberg-api"
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

  const scrollRef = useRef<HTMLDivElement>(null)
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null)
  const hasRestoredRef = useRef(false)

  const paragraphs = useMemo(() => {
    if (!text) return []
    return text.split(/\n{2,}/).filter((p) => p.trim().length > 0)
  }, [text])

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
          className="fixed inset-0 z-50 flex flex-col"
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
                  {paragraphs.map((p, i) => (
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
                      {p.trim()}
                    </p>
                  ))}
                </div>
              </div>

              {/* Bottom controls */}
              <div
                className="sticky bottom-0 z-10 flex-shrink-0"
                style={{
                  backgroundColor: currentTheme.barBg,
                  backdropFilter: "blur(12px)",
                  WebkitBackdropFilter: "blur(12px)",
                  borderTop: `1px solid ${currentTheme.border}`,
                  paddingBottom: "max(12px, env(safe-area-inset-bottom, 12px))",
                }}
              >
                <div className="flex items-center justify-center gap-6 px-4 h-12">
                  <motion.button
                    whileTap={{ scale: 0.9 }}
                    onClick={() => setFontSize((s) => Math.max(14, s - 1))}
                    disabled={fontSize <= 14}
                    className="tap-target w-10 h-10 rounded-full flex items-center justify-center transition-all disabled:opacity-30"
                    style={{ color: currentTheme.text }}
                    aria-label="Decrease font size"
                  >
                    <Minus className="w-4 h-4" />
                  </motion.button>

                  <div className="flex items-center gap-1.5">
                    <BookOpen className="w-4 h-4 opacity-50" />
                    <span className="text-xs tabular-nums opacity-50">{fontSize}</span>
                  </div>

                  <motion.button
                    whileTap={{ scale: 0.9 }}
                    onClick={() => setFontSize((s) => Math.min(24, s + 1))}
                    disabled={fontSize >= 24}
                    className="tap-target w-10 h-10 rounded-full flex items-center justify-center transition-all disabled:opacity-30"
                    style={{ color: currentTheme.text }}
                    aria-label="Increase font size"
                  >
                    <Plus className="w-4 h-4" />
                  </motion.button>
                </div>
              </div>
            </>
          )}
        </motion.div>
      )}
    </AnimatePresence>
  )
}
