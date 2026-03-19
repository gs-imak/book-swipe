"use client"

import { useState, useEffect, useRef, useCallback, useMemo } from "react"
import { motion, AnimatePresence } from "framer-motion"
import { ArrowLeft, ChevronLeft, ChevronRight, ChevronDown, Sun, Coffee, Moon, Loader2, AlertCircle, BookOpen, Minus, Plus, List, X, Search, Bookmark, BookmarkCheck, Highlighter, StickyNote, Copy, Trash2, MessageSquare, Quote, Globe, BookText, Share2, Type, Timer, Play, Pause, Brain } from "lucide-react"
import { GutenbergBook, fetchBookText, fetchBookImages } from "@/lib/gutenberg-api"
import { saveReadingPosition, getReadingPosition, getBookNotesForBook, saveBookNote, deleteBookNote, type BookNote } from "@/lib/storage"
import { addVocabWord } from "@/lib/vocabulary"
import { VocabFlashcards } from "./vocab-flashcards"
import { generateRecap, type RecapSection } from "@/lib/story-recap"

type ReaderTheme = "light" | "sepia" | "dark"

interface BookReaderProps {
  bookId: string
  bookTitle: string
  gutenbergBook: GutenbergBook
  isOpen: boolean
  onClose: () => void
}

const THEME_KEY = "bookswipe_reader_theme"
const FONT_KEY = "bookswipe_reader_font"
const BIONIC_KEY = "bookswipe_bionic_mode"

type ReaderFont = "georgia" | "merriweather" | "lora" | "system" | "literata" | "opendyslexic"

const FONT_OPTIONS: { id: ReaderFont; label: string; family: string }[] = [
  { id: "georgia", label: "Georgia", family: "Georgia, 'Source Serif 4', serif" },
  { id: "merriweather", label: "Merriweather", family: "var(--font-merriweather), Georgia, serif" },
  { id: "lora", label: "Lora", family: "var(--font-lora), Georgia, serif" },
  { id: "literata", label: "Literata", family: "var(--font-literata), Georgia, serif" },
  { id: "system", label: "Sans-serif", family: "system-ui, -apple-system, sans-serif" },
  { id: "opendyslexic", label: "OpenDyslexic", family: "'OpenDyslexic', sans-serif" },
]

type AmbientSound = "library" | "fireplace" | "coffeeshop" | "dark"
const AMBIENT_SOUNDS: { id: AmbientSound; label: string; emoji: string; file: string }[] = [
  { id: "library", label: "Library", emoji: "📚", file: "/sounds/library.mp3" },
  { id: "fireplace", label: "Fireplace", emoji: "🔥", file: "/sounds/fireplace.mp3" },
  { id: "coffeeshop", label: "Coffee Shop", emoji: "☕", file: "/sounds/coffeshop.mp3" },
  { id: "dark", label: "Nightscape", emoji: "🌙", file: "/sounds/dark.mp3" },
]

// Create ambient sound player from local MP3 files
function createAmbientPlayer(soundId: AmbientSound, volume: number): { start: () => void; stop: () => void; setVolume: (v: number) => void } | null {
  const soundDef = AMBIENT_SOUNDS.find(s => s.id === soundId)
  if (!soundDef) return null
  try {
    const audio = new Audio(soundDef.file)
    audio.loop = true
    audio.volume = volume
    return {
      start: () => { audio.play().catch(() => {}) },
      stop: () => { audio.pause(); audio.currentTime = 0 },
      setVolume: (v: number) => { audio.volume = Math.max(0, Math.min(1, v)) },
    }
  } catch {
    return null
  }
}

type AutoScrollSpeed = "slow" | "medium" | "fast"
const AUTO_SCROLL_SPEEDS: { id: AutoScrollSpeed; label: string; seconds: number }[] = [
  { id: "slow", label: "Slow", seconds: 30 },
  { id: "medium", label: "Medium", seconds: 20 },
  { id: "fast", label: "Fast", seconds: 12 },
]

const POMODORO_DURATIONS = [15, 25, 45, 60]

function getStoredFont(): ReaderFont {
  if (typeof window === "undefined") return "georgia"
  try {
    const stored = localStorage.getItem(FONT_KEY)
    if (stored && FONT_OPTIONS.some(f => f.id === stored)) return stored as ReaderFont
  } catch { /* ignore */ }
  return "georgia"
}

function getStoredBionic(): boolean {
  if (typeof window === "undefined") return false
  try {
    return localStorage.getItem(BIONIC_KEY) === "true"
  } catch { /* ignore */ }
  return false
}

function getFontFamily(font: ReaderFont): string {
  return FONT_OPTIONS.find(f => f.id === font)?.family || FONT_OPTIONS[0].family
}

const themes: Record<ReaderTheme, { bg: string; text: string; border: string; barBg: string; progressTrack: string; progressFill: string; highlight: string }> = {
  light: {
    bg: "#FDFBF7",
    text: "#1c1917",
    border: "rgba(0,0,0,0.08)",
    barBg: "rgba(253,251,247,0.88)",
    progressTrack: "rgba(0,0,0,0.1)",
    progressFill: "#d97706",
    highlight: "rgba(251,191,36,0.3)",
  },
  sepia: {
    bg: "#F5EFE0",
    text: "#3d2b1f",
    border: "rgba(0,0,0,0.08)",
    barBg: "rgba(245,239,224,0.88)",
    progressTrack: "rgba(0,0,0,0.1)",
    progressFill: "#d97706",
    highlight: "rgba(217,119,6,0.25)",
  },
  dark: {
    bg: "#1c1917",
    text: "#e7e5e4",
    border: "rgba(255,255,255,0.08)",
    barBg: "rgba(28,25,23,0.88)",
    progressTrack: "rgba(255,255,255,0.15)",
    progressFill: "#fbbf24",
    highlight: "rgba(251,191,36,0.2)",
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
 * Apply typographic transforms to plain text:
 * -- → em dash, ... → ellipsis, straight quotes → curly quotes
 */
function typographicText(src: string): string {
  let t = src
  // Em dashes: -- → — (but not inside --- separators)
  // Use capture groups instead of lookbehind for Safari compatibility
  t = t.replace(/---/g, "\uE000")             // protect triple dashes (PUA char)
  t = t.replace(/--/g, "\u2014")              // all double dashes → em dash
  t = t.replace(/\uE000/g, "---")            // restore triple dashes
  // Ellipsis
  t = t.replace(/\.\.\./g, "\u2026")
  // Smart double quotes: "word" → \u201C word \u201D
  // Opening: after whitespace/start or after em dash/open paren
  t = t.replace(/(^|[\s\u2014(])"(?=\S)/g, "$1\u201C")
  // Closing: before whitespace/end/punctuation
  t = t.replace(/"(?=[\s.,;:!?\u2014)\]]|$)/g, "\u201D")
  // Any remaining straight double quotes → closing
  t = t.replace(/"/g, "\u201D")
  // Smart single quotes / apostrophes
  // Opening: after whitespace/start
  t = t.replace(/(^|[\s\u2014(])'(?=\S)/g, "$1\u2018")
  // Apostrophes and closing
  t = t.replace(/'/g, "\u2019")
  // Fix elision apostrophes that were wrongly made opening quotes
  // Decade shortenings ('90s, '40s) and archaic elisions ('twas, 'tis, 'em, etc.)
  t = t.replace(/\u2018(\d+s\b)/g, "\u2019$1")
  t = t.replace(/\u2018(twas|tis|em|til|bout|cause|round|scuse)/gi, "\u2019$1")
  return t
}

/**
 * Renders inline text with Gutenberg formatting:
 * _text_ → italic, [1] → superscript footnote, ALL CAPS words → small-caps
 */
/** Splits text around highlighted passages, then renders each segment with RenderInlineText */
function HighlightedText({ text, highlights, blockIndex, skipTypography, highlightColor }: {
  text: string
  highlights: BookNote[]
  blockIndex: number
  skipTypography?: boolean
  highlightColor: string
}) {
  // Find highlights that match this block
  const blockHighlights = highlights.filter(
    h => h.selectedText && (h.blockIndex === blockIndex || (h.blockIndex === undefined && text.includes(h.selectedText)))
  )

  if (blockHighlights.length === 0) {
    return <RenderInlineText text={text} skipTypography={skipTypography} />
  }

  // Build segments: find all highlight ranges in the text
  type Seg = { text: string; highlighted: boolean; noteId?: string; hasNote?: boolean }
  const segments: Seg[] = []
  let offset = 0

  // Sort highlights by their position in the text
  const sorted = blockHighlights
    .map(h => ({ ...h, idx: text.indexOf(h.selectedText!) }))
    .filter(h => h.idx >= 0)
    .sort((a, b) => a.idx - b.idx)

  for (const h of sorted) {
    const idx = text.indexOf(h.selectedText!, offset)
    if (idx < 0) continue
    if (idx > offset) {
      segments.push({ text: text.slice(offset, idx), highlighted: false })
    }
    segments.push({
      text: h.selectedText!,
      highlighted: true,
      noteId: h.id,
      hasNote: h.type === "note" && !!h.content,
    })
    offset = idx + h.selectedText!.length
  }
  if (offset < text.length) {
    segments.push({ text: text.slice(offset), highlighted: false })
  }

  if (segments.length === 0) {
    return <RenderInlineText text={text} skipTypography={skipTypography} />
  }

  return (
    <>
      {segments.map((seg, i) =>
        seg.highlighted ? (
          <mark
            key={i}
            style={{
              backgroundColor: highlightColor,
              borderRadius: "2px",
              padding: "0 1px",
              color: "inherit",
            }}
            title={seg.hasNote ? "Has note" : undefined}
          >
            <RenderInlineText text={seg.text} skipTypography={skipTypography} />
            {seg.hasNote && (
              <sup style={{ fontSize: "0.6em", opacity: 0.6, marginLeft: "1px" }}>*</sup>
            )}
          </mark>
        ) : (
          <RenderInlineText key={i} text={seg.text} skipTypography={skipTypography} />
        )
      )}
    </>
  )
}

function RenderInlineText({ text, skipTypography }: { text: string; skipTypography?: boolean }) {
  // Apply typography (unless already applied by caller)
  const typod = skipTypography ? text : typographicText(text)
  const parts: React.ReactNode[] = []
  // Combined regex: _italic_, [footnote number], or ALL CAPS words (4+ letters)
  const re = /_([^_\n]{2,}?)_|\[(\d{1,3})\]|\b([A-Z]{4,})\b/g
  const romanRe = /^M{0,4}(CM|CD|D?C{0,3})(XC|XL|L?X{0,3})(IX|IV|V?I{0,3})$/
  let lastIndex = 0
  let match: RegExpExecArray | null
  while ((match = re.exec(typod)) !== null) {
    if (match.index > lastIndex) {
      parts.push(typod.slice(lastIndex, match.index))
    }
    if (match[1] !== undefined) {
      // Italic
      parts.push(<em key={match.index}>{match[1]}</em>)
    } else if (match[2] !== undefined) {
      // Footnote superscript
      parts.push(
        <sup key={match.index} className="text-[0.7em] opacity-60 ml-px">
          {match[2]}
        </sup>
      )
    } else if (match[3] !== undefined) {
      // ALL CAPS → small-caps (skip Roman numerals like VIII, XIII)
      const word = match[3]
      if (!romanRe.test(word)) {
        parts.push(
          <span key={match.index} style={{ fontVariant: "small-caps", letterSpacing: "0.05em" }}>
            {word.toLowerCase()}
          </span>
        )
      } else {
        parts.push(word)
      }
    }
    lastIndex = match.index + match[0].length
  }
  if (parts.length === 0) return <>{typod}</>
  if (lastIndex < typod.length) parts.push(typod.slice(lastIndex))
  return <>{parts}</>
}

function makeBionicNode(text: string): React.ReactNode {
  return text.split(/(\s+)/).map((word, i) => {
    if (/^\s+$/.test(word) || word.length === 0) return word
    const boldLen = Math.ceil(word.length * 0.45)
    return <span key={i}><strong>{word.slice(0, boldLen)}</strong>{word.slice(boldLen)}</span>
  })
}

export default function BookReader({ bookId, bookTitle, gutenbergBook, isOpen, onClose }: BookReaderProps) {
  const [theme, setTheme] = useState<ReaderTheme>(getStoredTheme)
  const [fontSize, setFontSize] = useState(17)
  const [readerFont, setReaderFont] = useState<ReaderFont>(getStoredFont)
  const [showFontMenu, setShowFontMenu] = useState(false)
  const fontFamily = getFontFamily(readerFont)
  const [text, setText] = useState<string | null>(null)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [progress, setProgress] = useState(0)
  const [showNavPanel, setShowNavPanel] = useState(false)
  const [showChapterDropdown, setShowChapterDropdown] = useState(false)
  const [images, setImages] = useState<string[]>([])
  const [readerNotes, setReaderNotes] = useState<BookNote[]>([])
  const [navTab, setNavTab] = useState<"contents" | "notes" | "recap">("contents")
  const [selectionBar, setSelectionBar] = useState<{ x: number; y: number; text: string; blockIndex: number } | null>(null)
  const [noteInputFor, setNoteInputFor] = useState<{ text: string; blockIndex: number } | null>(null)
  const [noteInputValue, setNoteInputValue] = useState("")
  const [isBookmarked, setIsBookmarked] = useState(false)

  // Feature: Bionic Reading
  const [bionicMode, setBionicMode] = useState<boolean>(getStoredBionic)

  // Feature: Focus Mode + Pomodoro
  const [focusMode, setFocusMode] = useState(false)
  const [focusMinimized, setFocusMinimized] = useState(false)
  const [pomodoroMinutes, setPomodoroMinutes] = useState(25)
  const [pomodoroSecondsLeft, setPomodoroSecondsLeft] = useState(25 * 60)
  const [pomodoroRunning, setPomodoroRunning] = useState(false)
  const [pomodoroFinished, setPomodoroFinished] = useState(false)
  const [ambientSound, setAmbientSound] = useState<AmbientSound>("" as AmbientSound)
  // audioRef removed — ambient sounds use Web Audio API via ambientRef
  const pomodoroIntervalRef = useRef<ReturnType<typeof setInterval> | null>(null)

  // Feature: Auto-scroll
  const [autoScrollEnabled, setAutoScrollEnabled] = useState(false)
  const [autoScrollSpeed, setAutoScrollSpeed] = useState<AutoScrollSpeed>("medium")
  const autoScrollIntervalRef = useRef<ReturnType<typeof setInterval> | null>(null)

  // Feature: Vocabulary Builder
  const [showVocab, setShowVocab] = useState(false)

  // Feature: Story Recap
  const [showRecap, setShowRecap] = useState(false)
  const [recapData, setRecapData] = useState<RecapSection[]>([])

  // Feature: One-time reader hints
  const [showHints, setShowHints] = useState(false)

  // CSS column pagination state
  const [paginatedPage, setPaginatedPage] = useState(0)
  const [columnTotal, setColumnTotal] = useState(1)
  const [colWidth, setColWidth] = useState(0)

  const scrollRef = useRef<HTMLDivElement>(null)
  const pagesRef = useRef<HTMLDivElement>(null)
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null)
  const measureTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null)
  const hasRestoredRef = useRef(false)
  const noteInputRef = useRef<HTMLTextAreaElement>(null)
  const touchStartRef = useRef<{ x: number; y: number } | null>(null)

  // Bionic-aware text renderer: wraps RenderInlineText output with bold-prefix styling
  const BionicInline = useCallback(({ text, skipTypography }: { text: string; skipTypography?: boolean }) => {
    if (!bionicMode) return <RenderInlineText text={text} skipTypography={skipTypography} />
    // Split text into words and apply bionic bolding
    return <>{makeBionicNode(text)}</>
  }, [bionicMode])

  // Load notes for this book
  const loadNotes = useCallback(() => {
    const notes = getBookNotesForBook(bookId)
    setReaderNotes(notes)
    setIsBookmarked(notes.some(n => n.type === "bookmark"))
  }, [bookId])

  useEffect(() => {
    if (isOpen) loadNotes()
  }, [isOpen, loadNotes])

  // Bionic mode persistence
  useEffect(() => {
    try { localStorage.setItem(BIONIC_KEY, bionicMode ? "true" : "false") } catch { /* ignore */ }
  }, [bionicMode])

  // One-time hints on first open
  useEffect(() => {
    if (!isOpen || !text) return
    try {
      const seen = localStorage.getItem("bookswipe_reader_hints_seen")
      if (!seen) {
        setShowHints(true)
        localStorage.setItem("bookswipe_reader_hints_seen", "1")
        const timer = setTimeout(() => setShowHints(false), 4000)
        return () => clearTimeout(timer)
      }
    } catch { /* ignore */ }
  }, [isOpen, text])

  // Focus Mode: start/stop pomodoro timer
  useEffect(() => {
    if (!focusMode || !pomodoroRunning) {
      if (pomodoroIntervalRef.current) {
        clearInterval(pomodoroIntervalRef.current)
        pomodoroIntervalRef.current = null
      }
      return
    }
    pomodoroIntervalRef.current = setInterval(() => {
      setPomodoroSecondsLeft(prev => {
        if (prev <= 1) {
          clearInterval(pomodoroIntervalRef.current!)
          pomodoroIntervalRef.current = null
          setPomodoroRunning(false)
          setPomodoroFinished(true)
          return 0
        }
        return prev - 1
      })
    }, 1000)
    return () => {
      if (pomodoroIntervalRef.current) {
        clearInterval(pomodoroIntervalRef.current)
        pomodoroIntervalRef.current = null
      }
    }
  }, [focusMode, pomodoroRunning])

  // Focus Mode: manage ambient audio via Web Audio API
  const ambientRef = useRef<{ stop: () => void; setVolume: (v: number) => void } | null>(null)
  const [ambientVolume, setAmbientVolume] = useState(0.4)

  // Start ambient sound — called directly from click handlers
  const startAmbientSound = useCallback((soundId: AmbientSound) => {
    if (ambientRef.current) {
      ambientRef.current.stop()
      ambientRef.current = null
    }
    if (!soundId) return
    const player = createAmbientPlayer(soundId, ambientVolume)
    if (player) {
      player.start()
      ambientRef.current = player
    }
  }, [ambientVolume])

  const stopAmbientSound = useCallback(() => {
    if (ambientRef.current) {
      ambientRef.current.stop()
      ambientRef.current = null
    }
  }, [])

  // Cleanup audio on unmount or reader close
  useEffect(() => {
    if (!isOpen) {
      stopAmbientSound()
      setFocusMode(false)
      setPomodoroRunning(false)
    }
  }, [isOpen])

  // Helper: reset pomodoro to a new duration
  const resetPomodoro = useCallback((minutes: number) => {
    setPomodoroMinutes(minutes)
    setPomodoroSecondsLeft(minutes * 60)
    setPomodoroRunning(false)
    setPomodoroFinished(false)
  }, [])

  // Helper: toggle focus mode
  const toggleFocusMode = useCallback(() => {
    setFocusMode(prev => {
      if (!prev) {
        // Activating — reset timer but don't auto-start (user presses play)
        setPomodoroSecondsLeft(pomodoroMinutes * 60)
        setPomodoroRunning(false)
        setPomodoroFinished(false)
      } else {
        setPomodoroRunning(false)
      }
      return !prev
    })
  }, [pomodoroMinutes])

  // Helper: pause auto-scroll on user interaction
  const pauseAutoScroll = useCallback(() => {
    if (autoScrollEnabled) setAutoScrollEnabled(false)
  }, [autoScrollEnabled])

  // Turn page by delta (-1 or +1), updating transform and progress
  const turnPage = useCallback((delta: number) => {
    if (!text) return
    setPaginatedPage(prev => {
      const next = Math.max(0, Math.min(prev + delta, columnTotal - 1))
      const el = pagesRef.current
      if (el) {
        el.style.transform = `translateX(-${next * el.clientWidth}px)`
      }
      // Update progress based on page position
      const pct = columnTotal > 1 ? Math.round((next / (columnTotal - 1)) * 100) : (next === 0 ? 0 : 100)
      setProgress(pct)
      // Save reading position
      const charOffset = Math.round((next / Math.max(1, columnTotal - 1)) * text.length)
      if (debounceRef.current) clearTimeout(debounceRef.current)
      debounceRef.current = setTimeout(() => {
        saveReadingPosition(bookId, charOffset)
      }, 300)
      return next
    })
  }, [columnTotal, text, bookId])

  // Auto-scroll: turn pages at configured interval (placed after turnPage definition)
  useEffect(() => {
    if (!autoScrollEnabled) {
      if (autoScrollIntervalRef.current) {
        clearInterval(autoScrollIntervalRef.current)
        autoScrollIntervalRef.current = null
      }
      return
    }
    const speedDef = AUTO_SCROLL_SPEEDS.find(s => s.id === autoScrollSpeed)
    const ms = (speedDef?.seconds ?? 20) * 1000
    autoScrollIntervalRef.current = setInterval(() => {
      turnPage(1)
    }, ms)
    return () => {
      if (autoScrollIntervalRef.current) {
        clearInterval(autoScrollIntervalRef.current)
        autoScrollIntervalRef.current = null
      }
    }
  }, [autoScrollEnabled, autoScrollSpeed, turnPage])

  // Navigate directly to a specific page index (used by chapter/search navigation)
  const goToPageIndex = useCallback((pageIdx: number) => {
    const clamped = Math.max(0, Math.min(pageIdx, columnTotal - 1))
    const el = pagesRef.current
    if (el) {
      el.style.transform = `translateX(-${clamped * el.clientWidth}px)`
    }
    const pct = columnTotal > 1 ? Math.round((clamped / (columnTotal - 1)) * 100) : 0
    setProgress(pct)
    setPaginatedPage(clamped)
  }, [columnTotal])

  // Measure columns after content renders or font/size changes
  useEffect(() => {
    if (!text) return
    if (measureTimerRef.current) clearTimeout(measureTimerRef.current)
    measureTimerRef.current = setTimeout(() => {
      const el = pagesRef.current
      if (!el) return
      const w = el.clientWidth
      if (w <= 0) return
      setColWidth(prev => prev === w ? prev : w)
      const pages = Math.max(1, Math.ceil(el.scrollWidth / w))
      setColumnTotal(pages)

      if (!hasRestoredRef.current) {
        // First load: restore saved reading position
        hasRestoredRef.current = true
        const charOffset = getReadingPosition(bookId)
        if (charOffset > 0) {
          const ratio = charOffset / text.length
          const targetPage = Math.round(ratio * (pages - 1))
          const clamped = Math.max(0, Math.min(targetPage, pages - 1))
          el.style.transform = `translateX(-${clamped * w}px)`
          const pct = pages > 1 ? Math.round((clamped / (pages - 1)) * 100) : 0
          setProgress(pct)
          setPaginatedPage(clamped)
        } else {
          // Start at page 0
          el.style.transform = "translateX(0)"
          setPaginatedPage(0)
        }
      } else {
        // Font/size changed: clamp current page and re-apply transform
        setPaginatedPage(prev => {
          const clamped = Math.min(prev, pages - 1)
          el.style.transform = `translateX(-${clamped * w}px)`
          return clamped
        })
      }
    }, 100)
    return () => {
      if (measureTimerRef.current) clearTimeout(measureTimerRef.current)
    }
  }, [text, fontSize, readerFont, bookId, colWidth])

  // Track if user is dragging (selecting text) vs tapping
  const mouseDownRef = useRef<{ x: number; y: number; time: number } | null>(null)

  const handleMouseDown = useCallback((e: React.MouseEvent<HTMLDivElement>) => {
    mouseDownRef.current = { x: e.clientX, y: e.clientY, time: Date.now() }
  }, [])

  // Tap zone handler: left third = prev page, right third = next page, center = ignore
  const handleReaderTap = useCallback((e: React.MouseEvent<HTMLDivElement>) => {
    // Don't turn page if tapping on interactive elements
    const target = e.target as HTMLElement
    if (target.closest("[data-selection-bar]") || target.closest("button") || target.closest("a") || target.closest("mark")) return
    // Don't turn page if there's an active text selection
    const sel = window.getSelection()
    if (sel && !sel.isCollapsed) {
      setAutoScrollEnabled(false) // pause auto-scroll on text selection
      return
    }
    // Don't turn page if user dragged (was selecting text)
    if (mouseDownRef.current) {
      const dx = Math.abs(e.clientX - mouseDownRef.current.x)
      const dy = Math.abs(e.clientY - mouseDownRef.current.y)
      const dt = Date.now() - mouseDownRef.current.time
      mouseDownRef.current = null
      if (dx > 5 || dy > 5 || dt > 300) return // moved or held too long = not a tap
    }
    const rect = (e.currentTarget as HTMLElement).getBoundingClientRect()
    const x = e.clientX - rect.left
    const third = rect.width / 3
    if (x < third) {
      setAutoScrollEnabled(false)
      turnPage(-1)
    } else if (x > third * 2) {
      setAutoScrollEnabled(false)
      turnPage(1)
    }
  }, [turnPage])

  // Touch/swipe handlers
  const handleTouchStart = useCallback((e: React.TouchEvent<HTMLDivElement>) => {
    const t = e.touches[0]
    touchStartRef.current = { x: t.clientX, y: t.clientY }
  }, [])

  const handleTouchEnd = useCallback((e: React.TouchEvent<HTMLDivElement>) => {
    if (!touchStartRef.current) return
    const t = e.changedTouches[0]
    const dx = t.clientX - touchStartRef.current.x
    const dy = t.clientY - touchStartRef.current.y
    touchStartRef.current = null
    // Only horizontal swipes with enough distance and not too vertical
    if (Math.abs(dx) > 50 && Math.abs(dx) > Math.abs(dy) * 1.5) {
      setAutoScrollEnabled(false) // pause auto-scroll on manual swipe
      if (dx < 0) {
        turnPage(1)
      } else {
        turnPage(-1)
      }
    }
  }, [turnPage])


  type TextBlock =
    | { type: "heading"; text: string; subtitle?: string }
    | { type: "paragraph"; text: string; dropCap?: boolean }
    | { type: "separator" }
    | { type: "verse"; lines: string[] }
    | { type: "centered"; lines: string[] }
    | { type: "blockquote"; text: string }
    | { type: "image"; src: string; caption?: string }
    | { type: "signature"; text: string }

  const blocks = useMemo<TextBlock[]>(() => {
    if (!text) return []
    // Normalize line endings (safety net for cached text with \r\n)
    let normalized = text.replace(/\r\n/g, "\n").replace(/\r/g, "\n")

    // Strip Gutenberg boilerplate — save credits to show at the end
    let savedCredits = ""

    // Extract header (before "*** START OF") — contains Gutenberg license
    const startMarker = normalized.indexOf("*** START OF")
    if (startMarker !== -1) {
      const afterMarker = normalized.indexOf("\n", startMarker)
      if (afterMarker !== -1) normalized = normalized.slice(afterMarker + 1)
    }

    // Extract footer (after "*** END OF") — contains Gutenberg license
    const endMarker = normalized.indexOf("*** END OF")
    if (endMarker !== -1) normalized = normalized.slice(0, endMarker)

    // Extract "Produced by" credits — move to end instead of removing
    const creditMatch = normalized.match(/^\s*((?:Produced by|Transcribed by|E-text prepared by)[\s\S]*?)\n\n/i)
    if (creditMatch) {
      savedCredits = creditMatch[1].trim()
      normalized = normalized.slice(creditMatch[0].length)
    }

    const raw = normalized.split(/\n{2,}/).filter((p) => p.trim().length > 0)
    const result: TextBlock[] = []

    const chapterRe = /^(?:chapter|book|part|act|section|prologue|epilogue|introduction|preface|foreword|contents|letter|volume|canto)\b/i
    const separatorRe = /^\s*(?:[*\-_]{3,}|\*\s+\*\s+\*)\s*$/
    const illustrationRe = /\[Illustration(?::?\s*([\s\S]+?))?\]/i

    let imgIndex = 0
    let firstHeadingSeen = false

    for (let idx = 0; idx < raw.length; idx++) {
      const block = raw[idx]
      const trimmed = block.trim()

      // Skip empty/whitespace blocks
      if (trimmed.length === 0) continue

      // Skip common Gutenberg boilerplate lines that survived the header strip
      if (/^(?:This eBook is for the use|Most recently updated|Release Date|Posting Date|Last Updated|Character set|Language:|Original publication|Source:|Note:|Transcriber|Editor|Translator|Illustrated by|With Illustrations|Title:|Author:|Translator:|Edition:|Online Distributed|Proofreading|Internet Archive|Digital Library)/i.test(trimmed) && trimmed.length < 150) continue
      if (/gutenberg|public domain|copyright|license|donation|www\.|http|\.org|\.com|\.net/i.test(trimmed) && !firstHeadingSeen) continue
      // Skip lines that are just numbers or Roman numerals (page numbers, section markers in TOC)
      if (/^[IVXLCDM\d\s.,-]+$/.test(trimmed) && trimmed.length < 20 && !firstHeadingSeen) continue

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

      // --- Detect and skip Table of Contents blocks ---
      // TOC lines typically have chapter keywords followed by many short lines
      // or lines with page numbers, dots, roman numerals
      const headLines = trimmed.split("\n").map((l) => l.trim())
      const looksLikeTOC = headLines.length > 5 && headLines.filter(l => chapterRe.test(l) || /^\d+\.?\s|^[IVXLC]+\.?\s|\.{3,}|─|—/.test(l)).length > headLines.length * 0.3
      if (looksLikeTOC && !firstHeadingSeen) continue // Skip TOC entirely
      if (/^(?:contents|table of contents)\s*$/i.test(trimmed)) continue // Skip "CONTENTS" header

      // --- Chapter/section headings ---
      const mainLine = headLines[0]
      if (chapterRe.test(trimmed) && mainLine.length < 100) {
        if (headLines.length > 5) {
          // Multi-line chapter block = TOC — skip (we have chapter nav dropdown)
          continue
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
      // Only the first few short blocks before any heading get centered (title, author, date)
      // Longer blocks or anything after 5 centered blocks = regular paragraphs (preface text, intro)
      if (!firstHeadingSeen) {
        const centeredSoFar = result.filter(b => b.type === "centered").length
        const cleanLines = nonEmptyLines.map(l => l.trim()).filter(l => l.length > 0)

        // Short lines early on = title page material (max 5 centered blocks)
        if (centeredSoFar < 5 && cleanLines.length > 0 && cleanLines.every(l => l.length < 80) && cleanLines.length <= 5) {
          result.push({ type: "centered", lines: cleanLines })
          continue
        }

        // Everything else before the first heading = treat as normal paragraph
        // (preface text, translator notes, long introductions)
        // Fall through to the regular paragraph handler below
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

      // --- Signature / date lines ---
      // Short lines at end of letters: "Yours truly," or "December 3, 1818" etc.
      // Case-sensitive to avoid false positives like "Your mother..." or "Truly, it was..."
      // Keep patterns tight: letter-closing words must be near end (< 35 chars total)
      const signatureRe = /^(?:Yours\s|Sincerely\b|Faithfully\b|Affectionately\b|Respectfully\b|Cordially\b|Ever yours\b|[A-Z][a-z]+\s\d{1,2},?\s\d{4})\s*$/
      if (nonEmptyLines.length === 1 && trimmed.length < 35 && signatureRe.test(trimmed)) {
        result.push({ type: "signature", text: trimmed })
        continue
      }

      // --- Regular paragraph ---
      // Unwrap hard line-wrapping (Gutenberg wraps at ~70 chars) into flowing text
      const unwrapped = trimmed.replace(/\n/g, " ").replace(/\s{2,}/g, " ")
      // Drop cap: first paragraph after a chapter heading only
      const prev = result.length > 0 ? result[result.length - 1] : null
      const isAfterHeading = prev !== null && prev.type === "heading"
      // Only drop-cap if starts with a letter (or a quote followed by a letter)
      const dropCapOk = isAfterHeading && unwrapped.length > 40 && /^[A-Za-z"'\u201C\u2018\u2019]/.test(unwrapped)
      result.push({ type: "paragraph", text: unwrapped, dropCap: dropCapOk })
    }

    // Append credits at the end of the book
    if (savedCredits) {
      result.push({ type: "separator" })
      result.push({ type: "centered", lines: savedCredits.split("\n").map(l => l.trim()).filter(l => l.length > 0) })
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
    // In paginated mode, convert ratio to page index
    const clampedRatio = Math.max(0, Math.min(1, ratio))
    const targetPage = Math.round(clampedRatio * (columnTotal - 1))
    goToPageIndex(targetPage)
  }, [columnTotal, goToPageIndex])

  const jumpToPage = useCallback((page: number) => {
    // page is 1-based from the nav panel scrubber (CHARS_PER_PAGE units)
    // Convert to a ratio and then to a column page
    if (totalPages <= 1) {
      goToPageIndex(0)
      return
    }
    jumpToRatio((page - 1) / (totalPages - 1))
  }, [totalPages, jumpToRatio, goToPageIndex])

  const jumpToBlock = useCallback((blockIndex: number) => {
    // Convert block index to a reading ratio, then to a column page
    jumpToRatio(blockIndex / Math.max(1, blocks.length))
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

  // Position restore happens inside the measure effect after columnTotal is known

  // handleScroll kept as stub — paged mode uses overflow:hidden so this won't fire
  const handleScroll = useCallback(() => {}, [])

  useEffect(() => {
    if (isOpen) {
      document.body.style.overflow = "hidden"
    }
    return () => {
      document.body.style.overflow = ""
    }
  }, [isOpen])

  // Keyboard navigation — arrow keys for page turns, escape to close
  const [isDesktop, setIsDesktop] = useState(false)
  const [showKeyboardHint, setShowKeyboardHint] = useState(false)

  useEffect(() => {
    if (!isOpen) return
    // Detect desktop (no touch support)
    const desktop = !("ontouchstart" in window) && window.matchMedia("(pointer: fine)").matches
    setIsDesktop(desktop)

    // Show keyboard hint once for desktop users
    if (desktop) {
      const seen = localStorage.getItem("bookswipe_keyboard_hint_seen")
      if (!seen) {
        setShowKeyboardHint(true)
        const timer = setTimeout(() => {
          setShowKeyboardHint(false)
          localStorage.setItem("bookswipe_keyboard_hint_seen", "1")
        }, 5000)
        return () => clearTimeout(timer)
      }
    }
  }, [isOpen])

  useEffect(() => {
    if (!isOpen) return

    const handleKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose()
      if (e.key === "ArrowRight" || e.key === " ") {
        e.preventDefault()
        turnPage(1)
      }
      if (e.key === "ArrowLeft") {
        e.preventDefault()
        turnPage(-1)
      }
    }
    window.addEventListener("keydown", handleKey)
    return () => window.removeEventListener("keydown", handleKey)
  }, [isOpen, onClose, turnPage])

  useEffect(() => {
    return () => {
      if (debounceRef.current) clearTimeout(debounceRef.current)
    }
  }, [])

  // Text selection handler — show floating bar when user selects text in reader
  useEffect(() => {
    if (!isOpen || !text) return

    const handleSelectionChange = () => {
      const sel = window.getSelection()
      if (!sel || sel.isCollapsed || !sel.rangeCount) {
        // Don't dismiss immediately — let click handler on bar work
        return
      }
      const range = sel.getRangeAt(0)
      const selectedStr = sel.toString().trim()
      if (selectedStr.length < 2 || selectedStr.length > 500) return

      // Check that selection is within the reader scroll area
      const container = scrollRef.current
      if (!container || !container.contains(range.commonAncestorContainer)) return

      // Find blockIndex from data attribute
      let node: Node | null = range.startContainer
      let blockIdx = -1
      while (node && node !== container) {
        if (node instanceof HTMLElement) {
          const attr = node.getAttribute("data-block-index")
          if (attr !== null) { blockIdx = parseInt(attr); break }
        }
        node = node.parentNode
      }

      const rect = range.getBoundingClientRect()
      const containerRect = container.getBoundingClientRect()
      setSelectionBar({
        x: rect.left + rect.width / 2 - containerRect.left,
        y: rect.top - containerRect.top - 8,
        text: selectedStr,
        blockIndex: blockIdx,
      })
    }

    document.addEventListener("selectionchange", handleSelectionChange)
    return () => document.removeEventListener("selectionchange", handleSelectionChange)
  }, [isOpen, text])

  // Dismiss selection bar on tap outside
  useEffect(() => {
    if (!selectionBar) return
    const dismiss = (e: PointerEvent) => {
      const target = e.target as HTMLElement
      if (target.closest("[data-selection-bar]")) return
      // Small delay to allow button clicks to register
      setTimeout(() => setSelectionBar(null), 150)
    }
    document.addEventListener("pointerdown", dismiss)
    return () => document.removeEventListener("pointerdown", dismiss)
  }, [selectionBar])

  const handleHighlight = useCallback(() => {
    if (!selectionBar) return
    saveBookNote({
      bookId,
      content: "",
      type: "highlight",
      page: currentPage,
      blockIndex: selectionBar.blockIndex,
      selectedText: selectionBar.text,
    })
    loadNotes()
    setSelectionBar(null)
    window.getSelection()?.removeAllRanges()
  }, [selectionBar, bookId, currentPage, loadNotes])

  const handleAddNoteToSelection = useCallback(() => {
    if (!selectionBar) return
    setNoteInputFor({ text: selectionBar.text, blockIndex: selectionBar.blockIndex })
    setNoteInputValue("")
    setSelectionBar(null)
    window.getSelection()?.removeAllRanges()
    setTimeout(() => noteInputRef.current?.focus(), 100)
  }, [selectionBar])

  const handleSaveNote = useCallback(() => {
    if (!noteInputFor || !noteInputValue.trim()) return
    saveBookNote({
      bookId,
      content: noteInputValue.trim(),
      type: "note",
      page: currentPage,
      blockIndex: noteInputFor.blockIndex,
      selectedText: noteInputFor.text,
    })
    loadNotes()
    setNoteInputFor(null)
    setNoteInputValue("")
  }, [noteInputFor, noteInputValue, bookId, currentPage, loadNotes])

  const handleCopySelection = useCallback(() => {
    if (!selectionBar) return
    navigator.clipboard?.writeText(selectionBar.text)
    setSelectionBar(null)
    window.getSelection()?.removeAllRanges()
  }, [selectionBar])

  const handleSaveQuote = useCallback(() => {
    if (!selectionBar) return
    saveBookNote({
      bookId,
      content: "",
      type: "quote",
      page: currentPage,
      blockIndex: selectionBar.blockIndex,
      selectedText: selectionBar.text,
    })
    loadNotes()
    setSelectionBar(null)
    window.getSelection()?.removeAllRanges()
  }, [selectionBar, bookId, currentPage, loadNotes])

  const handleDefine = useCallback(() => {
    if (!selectionBar) return
    const word = selectionBar.text.split(/\s+/)[0] // first word if multi-word
    const context = selectionBar.text
    addVocabWord({
      word: word,
      context: context,
      bookId,
      bookTitle,
    })
    window.open(`https://en.wiktionary.org/wiki/${encodeURIComponent(word.toLowerCase())}`, "_blank")
    setSelectionBar(null)
    window.getSelection()?.removeAllRanges()
  }, [selectionBar, bookId, bookTitle])

  const handleWebSearch = useCallback(() => {
    if (!selectionBar) return
    window.open(`https://www.google.com/search?q=${encodeURIComponent(selectionBar.text)}`, "_blank")
    setSelectionBar(null)
    window.getSelection()?.removeAllRanges()
  }, [selectionBar])

  const handleShareQuote = useCallback(() => {
    if (!selectionBar) return
    const formatted = `"${selectionBar.text}" — ${bookTitle}`
    if (navigator.share) {
      navigator.share({ text: formatted }).catch(() => {
        navigator.clipboard?.writeText(formatted)
      })
    } else {
      navigator.clipboard?.writeText(formatted)
    }
    setSelectionBar(null)
    window.getSelection()?.removeAllRanges()
  }, [selectionBar, bookTitle])

  const handleToggleBookmark = useCallback(() => {
    const existing = readerNotes.find(n => n.type === "bookmark")
    if (existing) {
      deleteBookNote(existing.id)
    } else {
      saveBookNote({
        bookId,
        content: currentChapter?.title || `Page ${currentPage}`,
        type: "bookmark",
        page: currentPage,
      })
    }
    loadNotes()
  }, [readerNotes, bookId, currentPage, currentChapter, loadNotes])

  const handleDeleteReaderNote = useCallback((noteId: string) => {
    deleteBookNote(noteId)
    loadNotes()
  }, [loadNotes])

  const jumpToNote = useCallback((note: BookNote) => {
    if (note.page && totalPages > 0) {
      jumpToPage(note.page)
    } else if (note.blockIndex !== undefined) {
      jumpToBlock(note.blockIndex)
    }
    setShowNavPanel(false)
  }, [totalPages, jumpToPage, jumpToBlock])

  // Only highlights/notes/quotes for rendering
  const inlineHighlights = useMemo(() =>
    readerNotes.filter(n => n.selectedText && (n.type === "highlight" || n.type === "note" || n.type === "quote")),
    [readerNotes]
  )

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
            className="sticky top-0 z-30 flex-shrink-0"
            style={{
              backgroundColor: currentTheme.barBg,
              backdropFilter: "blur(12px)",
              WebkitBackdropFilter: "blur(12px)",
              borderBottom: `1px solid ${currentTheme.border}`,
              paddingTop: "env(safe-area-inset-top)",
            }}
          >
            <div className="relative flex items-center justify-between px-4 h-14">
              <motion.button
                whileTap={{ scale: 0.9 }}
                onClick={onClose}
                className="tap-target flex items-center justify-center rounded-lg p-2.5 -ml-2 transition-colors"
                style={{ color: currentTheme.text }}
                aria-label="Close reader"
              >
                <ArrowLeft className="w-5 h-5" />
              </motion.button>

              {/* Absolutely centered title — not affected by left/right button count */}
              <div className="absolute left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 text-center pointer-events-none">
                <p className="text-sm font-medium truncate opacity-70">{bookTitle}</p>
                <div className="flex items-center justify-center gap-2 mt-0.5">
                  <div className="w-[140px] h-1 rounded-full overflow-hidden" style={{ backgroundColor: currentTheme.progressTrack }}>
                    <motion.div
                      className="h-full rounded-full"
                      style={{ backgroundColor: currentTheme.progressFill }}
                      initial={{ width: 0 }}
                      animate={{ width: `${progress}%` }}
                      transition={{ duration: 0.3, ease: "easeOut" }}
                    />
                  </div>
                  <span className="text-xs tabular-nums opacity-50">{progress}%</span>
                </div>
              </div>

              <div className="flex items-center gap-1">
                <motion.button
                  whileTap={{ scale: 0.9 }}
                  onClick={() => { if (focusMode) stopAmbientSound(); toggleFocusMode(); setFocusMinimized(false) }}
                  className="tap-target flex items-center justify-center rounded-lg p-2 transition-colors"
                  style={{ color: focusMode ? currentTheme.progressFill : currentTheme.text }}
                  aria-label={focusMode ? "Exit focus mode" : "Enter focus mode"}
                >
                  <Timer className="w-5 h-5" />
                </motion.button>
                <motion.button
                  whileTap={{ scale: 0.9 }}
                  onClick={() => setShowVocab(true)}
                  className="tap-target flex items-center justify-center rounded-lg p-2 transition-colors"
                  style={{ color: currentTheme.text }}
                  aria-label="Open vocabulary builder"
                >
                  <Brain className="w-5 h-5" />
                </motion.button>
                <motion.button
                  whileTap={{ scale: 0.9 }}
                  onClick={handleToggleBookmark}
                  className="tap-target flex items-center justify-center rounded-lg p-2 transition-colors"
                  style={{ color: isBookmarked ? currentTheme.progressFill : currentTheme.text }}
                  aria-label={isBookmarked ? "Remove bookmark" : "Bookmark this page"}
                >
                  {isBookmarked ? <BookmarkCheck className="w-5 h-5" /> : <Bookmark className="w-5 h-5" />}
                </motion.button>
                <motion.button
                  whileTap={{ scale: 0.9 }}
                  onClick={() => setShowFontMenu(!showFontMenu)}
                  className="tap-target flex items-center justify-center rounded-lg p-2 transition-colors"
                  style={{ color: currentTheme.text }}
                  aria-label="Change font"
                >
                  <Type className="w-5 h-5" />
                </motion.button>
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
          </div>

          {/* One-time tooltip hints */}
          <AnimatePresence>
            {showHints && (
              <motion.div
                initial={{ opacity: 0, y: -8 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -8 }}
                transition={{ duration: 0.2 }}
                className="absolute right-4 z-[72] rounded-xl shadow-lg px-4 py-2.5 max-w-[260px]"
                style={{
                  top: "env(safe-area-inset-top, 0px)",
                  marginTop: 62,
                  backgroundColor: theme === "dark" ? "#292524" : "#1c1917",
                  color: "#fafaf9",
                }}
                onClick={() => setShowHints(false)}
                role="tooltip"
              >
                <p className="text-xs leading-relaxed">
                  Tap icons to access vocabulary, bookmark, focus timer, font settings, and theme.
                </p>
                <div
                  className="absolute -top-1.5 right-6 w-3 h-3 rotate-45"
                  style={{ backgroundColor: theme === "dark" ? "#292524" : "#1c1917" }}
                />
              </motion.div>
            )}
          </AnimatePresence>

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
                style={{
                  overflow: "hidden",
                  position: "relative",
                  flex: 1,
                  padding: "0 clamp(20px, 6vw, 80px)",
                }}
                onMouseDown={handleMouseDown}
                onClick={handleReaderTap}
                onTouchStart={handleTouchStart}
                onTouchEnd={handleTouchEnd}
              >
                <div
                  ref={pagesRef}
                  style={{
                    height: "100%",
                    paddingTop: "1.5rem",
                    paddingBottom: "1.5rem",
                    ...(colWidth > 0 ? { columnWidth: `${colWidth}px` } : {}),
                    columnFill: "auto" as const,
                    columnGap: 0,
                    transition: "transform 300ms cubic-bezier(0.25, 0.1, 0.25, 1)",
                    fontKerning: "normal",
                    fontVariantLigatures: "common-ligatures",
                    fontVariantNumeric: "oldstyle-nums proportional-nums",
                    textRendering: "optimizeLegibility",
                  }}
                >
                  {/* Fallback title page — if no centered title blocks were detected, show bookTitle */}
                  {blocks.length > 0 && blocks[0].type !== "centered" && (
                    <div
                      className="text-center flex flex-col items-center justify-center"
                      style={{
                        fontFamily,
                        color: currentTheme.text,
                        breakInside: "avoid",
                        maxWidth: "65ch",
                        margin: "0 auto",
                        minHeight: "70vh",
                        paddingTop: "20vh",
                        paddingBottom: "4em",
                      }}
                    >
                      <div style={{ fontSize: `${fontSize * 2.5}px`, fontWeight: 700, lineHeight: "1.15", marginBottom: "0.5em" }}>
                        {bookTitle}
                      </div>
                    </div>
                  )}

                  {blocks.map((block, i) => {
                    if (block.type === "separator") {
                      return (
                        <div key={i} className="flex items-center justify-center gap-3 opacity-25" style={{ padding: "2.5em 0", breakInside: "avoid", maxWidth: "65ch", margin: "0 auto" }}>
                          <div className="w-1.5 h-1.5 rounded-full" style={{ backgroundColor: currentTheme.text }} />
                          <div className="w-1.5 h-1.5 rounded-full" style={{ backgroundColor: currentTheme.text }} />
                          <div className="w-1.5 h-1.5 rounded-full" style={{ backgroundColor: currentTheme.text }} />
                        </div>
                      )
                    }

                    if (block.type === "image") {
                      return (
                        <div key={i} className="flex flex-col items-center gap-2" style={{ margin: "1.5em auto", breakInside: "avoid", maxWidth: "65ch" }}>
                          {/* eslint-disable-next-line @next/next/no-img-element */}
                          <img
                            src={block.src}
                            alt={block.caption || "Illustration"}
                            className="max-w-full rounded-lg shadow-sm"
                            style={{ maxHeight: "50vh" }}
                            loading="lazy"
                          />
                          {block.caption && (
                            <p
                              className="text-center italic opacity-50"
                              style={{
                                fontFamily,
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
                        <div key={i} className="text-center" data-block-index={i} style={{ breakBefore: "column", breakInside: "avoid", paddingTop: "3em", paddingBottom: "2em", maxWidth: "65ch", margin: "0 auto" }}>
                          <h2
                            className="font-bold"
                            style={{
                              fontFamily,
                              fontSize: `${fontSize + 4}px`,
                              lineHeight: "1.4",
                              letterSpacing: "0.02em",
                              color: currentTheme.text,
                            }}
                          >
                            <HighlightedText text={block.text} highlights={inlineHighlights} blockIndex={i} highlightColor={currentTheme.highlight} />
                          </h2>
                          {block.subtitle && (
                            <p
                              className="mt-2 italic opacity-60"
                              style={{
                                fontFamily,
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
                      // Check if this is a title page block (before the first heading)
                      const isBeforeFirstHeading = !blocks.slice(0, i).some(b => b.type === "heading")
                      const isTitleBlock = isBeforeFirstHeading && i < 5

                      if (isTitleBlock) {
                        // Collect ALL title page lines into one unit on the first block
                        const isFirstBlock = i === 0
                        if (!isFirstBlock) {
                          // Skip non-first title blocks — they're merged into block 0 below
                          return null
                        }

                        // Gather lines from all title page centered blocks
                        const allTitleLines: string[] = []
                        for (let ti = i; ti < Math.min(i + 5, blocks.length); ti++) {
                          const tb = blocks[ti]
                          if (tb.type !== "centered") break
                          if (blocks.slice(0, ti).some(b => b.type === "heading")) break
                          allTitleLines.push(...tb.lines)
                        }

                        return (
                          <div
                            key={i}
                            className="text-center flex flex-col items-center justify-center"
                            data-block-index={i}
                            style={{
                              fontFamily,
                              color: currentTheme.text,
                              breakInside: "avoid",
                              maxWidth: "65ch",
                              margin: "0 auto",
                              minHeight: "70vh",
                              paddingTop: "20vh",
                              paddingBottom: "4em",
                            }}
                          >
                            {allTitleLines.map((line, j) => {
                              const isByLine = /^by\s/i.test(line)
                              const isTitle = j === 0 && !isByLine
                              return (
                                <div
                                  key={j}
                                  style={{
                                    fontSize: isTitle ? `${fontSize * 2.5}px` : isByLine ? `${fontSize * 1.3}px` : `${fontSize * 1.1}px`,
                                    fontWeight: isTitle ? 700 : 400,
                                    lineHeight: isTitle ? "1.15" : "1.5",
                                    letterSpacing: isTitle ? "0.01em" : undefined,
                                    opacity: isByLine ? 0.55 : isTitle ? 1 : 0.6,
                                    marginTop: isByLine ? "0.8em" : isTitle ? 0 : "0.3em",
                                    marginBottom: isTitle ? "0.2em" : "0.15em",
                                    fontStyle: isByLine ? "italic" : "normal",
                                  }}
                                >
                                  <RenderInlineText text={line} />
                                </div>
                              )
                            })}
                          </div>
                        )
                      }

                      // Regular centered block (not title page)
                      return (
                        <div
                          key={i}
                          className="text-center"
                          data-block-index={i}
                          style={{
                            fontFamily,
                            fontSize: `${fontSize}px`,
                            lineHeight: "1.7",
                            color: currentTheme.text,
                            padding: "2em 0",
                            breakInside: "avoid",
                            maxWidth: "65ch",
                            margin: "0 auto",
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
                          className="pl-4 italic"
                          data-block-index={i}
                          style={{
                            fontFamily,
                            fontSize: `${fontSize}px`,
                            lineHeight: "1.6",
                            color: currentTheme.text,
                            borderLeft: `3px solid ${currentTheme.progressFill}`,
                            opacity: 0.85,
                            margin: "0 auto",
                            marginBottom: "0.5em",
                            breakInside: "avoid",
                            maxWidth: "65ch",
                            hyphens: "auto",
                            WebkitHyphens: "auto",
                          }}
                        >
                          <HighlightedText text={block.text} highlights={inlineHighlights} blockIndex={i} highlightColor={currentTheme.highlight} />
                        </blockquote>
                      )
                    }

                    if (block.type === "signature") {
                      return (
                        <p
                          key={i}
                          className="text-right italic"
                          data-block-index={i}
                          style={{
                            fontFamily,
                            fontSize: `${fontSize}px`,
                            lineHeight: "1.6",
                            color: currentTheme.text,
                            opacity: 0.75,
                            margin: "0 auto",
                            marginBottom: "0.5em",
                            breakInside: "avoid",
                            maxWidth: "65ch",
                          }}
                        >
                          <RenderInlineText text={block.text} />
                        </p>
                      )
                    }

                    if (block.type === "verse") {
                      return (
                        <div
                          key={i}
                          className="whitespace-pre-line"
                          data-block-index={i}
                          style={{
                            fontFamily,
                            fontSize: `${fontSize}px`,
                            lineHeight: "1.6",
                            color: currentTheme.text,
                            margin: "0 auto",
                            marginBottom: "0.5em",
                            breakInside: "avoid",
                            maxWidth: "65ch",
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

                    if (block.dropCap && block.text.length > 1) {
                      // Apply typography to get smart quotes, then split
                      const typod = typographicText(block.text)
                      // If text starts with a quote mark, include it with the first letter
                      const dropMatch = /^([\u201C\u201D\u2018\u2019"']?)([A-Za-z])/.exec(typod)
                      const dropChars = dropMatch ? dropMatch[1] + dropMatch[2] : typod[0]
                      const rest = typod.slice(dropChars.length)
                      return (
                        <p
                          key={i}
                          className="leading-relaxed text-justify"
                          data-block-index={i}
                          style={{
                            fontFamily,
                            fontSize: `${fontSize}px`,
                            lineHeight: "1.6",
                            color: currentTheme.text,
                            margin: "0 auto",
                            marginBottom: "0.3em",
                            maxWidth: "65ch",
                            hyphens: "auto",
                            WebkitHyphens: "auto",
                          }}
                        >
                          <span
                            style={{
                              float: "left",
                              fontFamily,
                              fontSize: `${fontSize * 3.2}px`,
                              lineHeight: "0.8",
                              paddingTop: "0.07em",
                              paddingRight: "0.08em",
                              fontWeight: 700,
                              color: currentTheme.progressFill,
                            }}
                          >
                            {dropChars}
                          </span>
                          <HighlightedText text={rest} highlights={inlineHighlights} blockIndex={i} skipTypography highlightColor={currentTheme.highlight} />
                        </p>
                      )
                    }

                    // Check if previous block was a heading or separator (skip indent)
                    const prevBlock = i > 0 ? blocks[i - 1] : null
                    const skipIndent = prevBlock?.type === "heading" || prevBlock?.type === "separator"

                    return (
                      <p
                        key={i}
                        className="leading-relaxed text-justify"
                        data-block-index={i}
                        style={{
                          fontFamily,
                          fontSize: `${fontSize}px`,
                          lineHeight: "1.6",
                          color: currentTheme.text,
                          textIndent: skipIndent ? 0 : "1.5em",
                          margin: "0 auto",
                          marginBottom: "0.3em",
                          maxWidth: "65ch",
                          hyphens: "auto",
                          WebkitHyphens: "auto",
                        }}
                      >
                        <HighlightedText text={block.text} highlights={inlineHighlights} blockIndex={i} highlightColor={currentTheme.highlight} />
                      </p>
                    )
                  })}
                </div>
              </div>

              {/* Floating selection bar — outside pagesRef so not affected by translateX */}
              {selectionBar && (() => {
                const isDark = currentTheme.text === "#e7e5e4"
                const barBg = isDark ? "#292524" : "#fafaf9"
                const primaryColor = "#d97706"
                const textColor = isDark ? "#e7e5e4" : "#44403c"
                const mutedColor = isDark ? "#a8a29e" : "#78716c"
                const divider = <div className="w-px h-4" style={{ backgroundColor: currentTheme.border }} />
                const barWidth = 340
                const viewW = scrollRef.current?.clientWidth || 300
                const clampedX = Math.max(8, Math.min(selectionBar.x - barWidth / 2, viewW - barWidth - 8))
                return (
                  <div
                    data-selection-bar
                    className="absolute z-40 flex flex-col rounded-xl shadow-lg overflow-hidden"
                    style={{
                      left: clampedX,
                      top: Math.max(8, selectionBar.y - 56),
                      backgroundColor: barBg,
                      border: `1px solid ${currentTheme.border}`,
                    }}
                  >
                    <div className="flex items-center gap-1 px-1.5 py-1">
                      <button onClick={handleHighlight} className="flex items-center gap-1.5 px-3 py-2 rounded-lg text-xs font-medium transition-colors hover:opacity-80" style={{ color: primaryColor }}>
                        <Highlighter className="w-4 h-4" /> Highlight
                      </button>
                      {divider}
                      <button onClick={handleAddNoteToSelection} className="flex items-center gap-1.5 px-3 py-2 rounded-lg text-xs font-medium transition-colors hover:opacity-80" style={{ color: textColor }}>
                        <StickyNote className="w-4 h-4" /> Note
                      </button>
                      {divider}
                      <button onClick={handleSaveQuote} className="flex items-center gap-1.5 px-3 py-2 rounded-lg text-xs font-medium transition-colors hover:opacity-80" style={{ color: textColor }}>
                        <Quote className="w-4 h-4" /> Quote
                      </button>
                      {divider}
                      <button onClick={handleCopySelection} className="flex items-center gap-1.5 px-3 py-2 rounded-lg text-xs font-medium transition-colors hover:opacity-80" style={{ color: mutedColor }}>
                        <Copy className="w-4 h-4" />
                      </button>
                    </div>
                    <div className="flex items-center gap-1 px-1.5 py-1" style={{ borderTop: `1px solid ${currentTheme.border}` }}>
                      <button onClick={handleDefine} className="flex items-center gap-1.5 px-3 py-2 rounded-lg text-xs font-medium transition-colors hover:opacity-80" style={{ color: mutedColor }}>
                        <BookText className="w-4 h-4" /> Define
                      </button>
                      {divider}
                      <button onClick={handleWebSearch} className="flex items-center gap-1.5 px-3 py-2 rounded-lg text-xs font-medium transition-colors hover:opacity-80" style={{ color: mutedColor }}>
                        <Globe className="w-4 h-4" /> Search
                      </button>
                      {divider}
                      <button onClick={handleShareQuote} className="flex items-center gap-1.5 px-3 py-2 rounded-lg text-xs font-medium transition-colors hover:opacity-80" style={{ color: mutedColor }}>
                        <Share2 className="w-4 h-4" /> Share
                      </button>
                    </div>
                  </div>
                )
              })()}

              {/* Note input overlay */}
              <AnimatePresence>
                {noteInputFor && (
                  <motion.div
                    initial={{ opacity: 0, y: 20 }}
                    animate={{ opacity: 1, y: 0 }}
                    exit={{ opacity: 0, y: 20 }}
                    transition={{ duration: 0.15 }}
                    className="absolute bottom-0 left-0 right-0 z-40 p-4"
                    style={{
                      backgroundColor: currentTheme.bg,
                      borderTop: `1px solid ${currentTheme.border}`,
                      paddingBottom: "max(16px, env(safe-area-inset-bottom, 16px))",
                    }}
                  >
                    <div className="max-w-2xl mx-auto">
                      <div className="flex items-start gap-2 mb-3">
                        <Highlighter className="w-3.5 h-3.5 mt-0.5 flex-shrink-0" style={{ color: currentTheme.progressFill }} />
                        <p className="text-xs italic opacity-60 line-clamp-2">&ldquo;{noteInputFor.text}&rdquo;</p>
                      </div>
                      <textarea
                        ref={noteInputRef}
                        value={noteInputValue}
                        onChange={(e) => setNoteInputValue(e.target.value)}
                        placeholder="Add your note..."
                        rows={2}
                        className="w-full px-3 py-2 rounded-lg text-sm resize-none outline-none"
                        style={{
                          backgroundColor: `${currentTheme.text}08`,
                          color: currentTheme.text,
                          border: `1px solid ${currentTheme.border}`,
                        }}
                      />
                      <div className="flex justify-end gap-2 mt-2">
                        <button
                          onClick={() => { setNoteInputFor(null); setNoteInputValue("") }}
                          className="px-3 py-1.5 rounded-lg text-xs font-medium opacity-60 hover:opacity-80"
                          style={{ color: currentTheme.text }}
                        >
                          Cancel
                        </button>
                        <button
                          onClick={handleSaveNote}
                          disabled={!noteInputValue.trim()}
                          className="px-4 py-1.5 rounded-lg text-xs font-semibold text-white disabled:opacity-40"
                          style={{ backgroundColor: currentTheme.progressFill }}
                        >
                          Save Note
                        </button>
                      </div>
                    </div>
                  </motion.div>
                )}
              </AnimatePresence>

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
                      {/* Nav header with tabs */}
                      <div
                        className="flex-shrink-0"
                        style={{
                          borderBottom: `1px solid ${currentTheme.border}`,
                          paddingTop: "env(safe-area-inset-top)",
                        }}
                      >
                        <div className="flex items-center justify-between px-4 h-12">
                          <div className="flex items-center gap-1">
                            <button
                              onClick={() => setNavTab("contents")}
                              className="px-3 py-1 rounded-lg text-xs font-semibold transition-all"
                              style={{
                                backgroundColor: navTab === "contents" ? `${currentTheme.progressFill}20` : "transparent",
                                color: navTab === "contents" ? currentTheme.progressFill : `${currentTheme.text}80`,
                              }}
                            >
                              Contents
                            </button>
                            <button
                              onClick={() => setNavTab("notes")}
                              className="px-3 py-1 rounded-lg text-xs font-semibold transition-all flex items-center gap-1.5"
                              style={{
                                backgroundColor: navTab === "notes" ? `${currentTheme.progressFill}20` : "transparent",
                                color: navTab === "notes" ? currentTheme.progressFill : `${currentTheme.text}80`,
                              }}
                            >
                              Notes
                              {readerNotes.length > 0 && (
                                <span
                                  className="text-[9px] px-1.5 py-0.5 rounded-full font-bold"
                                  style={{ backgroundColor: `${currentTheme.text}10`, color: `${currentTheme.text}80` }}
                                >
                                  {readerNotes.length}
                                </span>
                              )}
                            </button>
                            <button
                              onClick={() => {
                                setNavTab("recap")
                                if (text && recapData.length === 0) {
                                  setRecapData(generateRecap(text, progress / 100))
                                }
                              }}
                              className="px-3 py-1 rounded-lg text-xs font-semibold transition-all"
                              style={{
                                backgroundColor: navTab === "recap" ? `${currentTheme.progressFill}20` : "transparent",
                                color: navTab === "recap" ? currentTheme.progressFill : `${currentTheme.text}80`,
                              }}
                            >
                              Recap
                            </button>
                          </div>
                          <button onClick={() => { setShowNavPanel(false); setSearchOpen(false) }} className="p-2 -mr-2 rounded-lg">
                            <X className="w-5 h-5 opacity-60" />
                          </button>
                        </div>
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

                      {/* Tab content */}
                      <div className="flex-1 overflow-y-auto overscroll-contain">
                        {navTab === "contents" ? (
                          <>
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
                          </>
                        ) : navTab === "notes" ? (
                          <div className="px-4 py-2">
                            {readerNotes.length === 0 ? (
                              <div className="text-center py-12">
                                <StickyNote className="w-8 h-8 mx-auto mb-3 opacity-20" />
                                <p className="text-sm opacity-40">No notes yet</p>
                                <p className="text-xs opacity-30 mt-1">Select text while reading to highlight or add notes</p>
                              </div>
                            ) : (
                              <div className="space-y-2">
                                {readerNotes.map((note) => {
                                  const isHighlight = note.type === "highlight"
                                  const isNote = note.type === "note"
                                  const isBm = note.type === "bookmark"
                                  return (
                                    <div
                                      key={note.id}
                                      className="rounded-lg p-3 transition-colors"
                                      style={{ backgroundColor: `${currentTheme.text}06` }}
                                    >
                                      <div className="flex items-start justify-between gap-2">
                                        <button
                                          onClick={() => jumpToNote(note)}
                                          className="flex-1 text-left min-w-0"
                                        >
                                          <div className="flex items-center gap-1.5 mb-1">
                                            {isBm && <BookmarkCheck className="w-3 h-3 flex-shrink-0" style={{ color: currentTheme.progressFill }} />}
                                            {isHighlight && <Highlighter className="w-3 h-3 flex-shrink-0" style={{ color: currentTheme.progressFill }} />}
                                            {isNote && <MessageSquare className="w-3 h-3 flex-shrink-0" style={{ color: currentTheme.progressFill }} />}
                                            {note.type === "quote" && <Quote className="w-3 h-3 flex-shrink-0" style={{ color: currentTheme.progressFill }} />}
                                            <span className="text-[10px] uppercase tracking-wider opacity-40 font-semibold">
                                              {note.type}{note.page ? ` · p.${note.page}` : ""}
                                            </span>
                                          </div>
                                          {note.selectedText && (
                                            <p className="text-xs italic opacity-50 line-clamp-2 mb-1">
                                              &ldquo;{note.selectedText}&rdquo;
                                            </p>
                                          )}
                                          {note.content && (
                                            <p className="text-xs opacity-70 line-clamp-2">
                                              {isBm ? note.content : note.content}
                                            </p>
                                          )}
                                        </button>
                                        <button
                                          onClick={() => handleDeleteReaderNote(note.id)}
                                          className="p-1.5 rounded-md opacity-30 hover:opacity-60 flex-shrink-0"
                                        >
                                          <Trash2 className="w-3 h-3" />
                                        </button>
                                      </div>
                                    </div>
                                  )
                                })}
                              </div>
                            )}
                          </div>
                        ) : (
                          <div className="px-4 py-2">
                            {progress <= 0 ? (
                              <div className="text-center py-12">
                                <BookOpen className="w-8 h-8 mx-auto mb-3 opacity-20" />
                                <p className="text-sm opacity-40">Start reading first</p>
                                <p className="text-xs opacity-30 mt-1">A recap will appear once you begin reading.</p>
                              </div>
                            ) : recapData.length === 0 ? (
                              <div className="text-center py-12">
                                <BookOpen className="w-8 h-8 mx-auto mb-3 opacity-20" />
                                <p className="text-sm opacity-40">No recap available</p>
                                <p className="text-xs opacity-30 mt-1">Not enough content to summarize yet.</p>
                              </div>
                            ) : (
                              <div className="space-y-3">
                                <p className="text-[10px] uppercase tracking-wider opacity-40 font-semibold mb-3">
                                  Story so far ({progress}% read)
                                </p>
                                {recapData.map((section, i) => (
                                  <div
                                    key={i}
                                    className="rounded-lg p-3"
                                    style={{ backgroundColor: `${currentTheme.text}06` }}
                                  >
                                    <p className="text-xs font-semibold mb-1.5" style={{ color: currentTheme.progressFill }}>
                                      {section.chapter}
                                    </p>
                                    <p className="text-xs opacity-70 leading-relaxed">
                                      {section.summary}
                                    </p>
                                  </div>
                                ))}
                              </div>
                            )}
                          </div>
                        )}
                      </div>
                    </motion.div>
                  )}
                </AnimatePresence>

                {/* Keyboard hint for desktop users */}
                <AnimatePresence>
                  {showKeyboardHint && isDesktop && (
                    <motion.div
                      initial={{ opacity: 0, y: 8 }}
                      animate={{ opacity: 1, y: 0 }}
                      exit={{ opacity: 0, y: 8 }}
                      className="px-6 py-3"
                      onClick={() => { setShowKeyboardHint(false); localStorage.setItem("bookswipe_keyboard_hint_seen", "1") }}
                    >
                      <div className="flex items-center justify-center gap-3">
                        <kbd className="px-3 py-1.5 rounded-lg text-sm font-mono font-medium shadow-sm"
                          style={{ backgroundColor: `${currentTheme.text}10`, color: currentTheme.text, border: `1px solid ${currentTheme.border}` }}>
                          ←
                        </kbd>
                        <span className="text-sm opacity-60">and</span>
                        <kbd className="px-3 py-1.5 rounded-lg text-sm font-mono font-medium shadow-sm"
                          style={{ backgroundColor: `${currentTheme.text}10`, color: currentTheme.text, border: `1px solid ${currentTheme.border}` }}>
                          →
                        </kbd>
                        <span className="text-sm opacity-60">to turn pages</span>
                      </div>
                    </motion.div>
                  )}
                </AnimatePresence>

                {/* Chapter quick-select — tap chapter name to see dropdown */}
                {chapters.length > 0 && (
                  <div className="relative px-4 pt-2 pb-1">
                    <button
                      onClick={() => setShowChapterDropdown(prev => !prev)}
                      className="w-full flex items-center justify-center gap-1.5 py-1 rounded-lg transition-opacity hover:opacity-80"
                    >
                      <p className="text-xs truncate opacity-50 font-medium">
                        {currentChapter ? currentChapter.title : "Select Chapter"}
                        {currentChapter?.subtitle ? ` — ${currentChapter.subtitle}` : ""}
                      </p>
                      <ChevronDown className="w-3 h-3 opacity-40 flex-shrink-0" style={{ transform: showChapterDropdown ? "rotate(180deg)" : "none", transition: "transform 0.2s" }} />
                    </button>

                    <AnimatePresence>
                      {showChapterDropdown && (
                        <motion.div
                          initial={{ opacity: 0, y: 4, scaleY: 0.95 }}
                          animate={{ opacity: 1, y: 0, scaleY: 1 }}
                          exit={{ opacity: 0, y: 4, scaleY: 0.95 }}
                          transition={{ duration: 0.15 }}
                          className="absolute bottom-full left-4 right-4 mb-1 z-[66] rounded-xl shadow-lg overflow-hidden"
                          style={{
                            backgroundColor: theme === "dark" ? "rgba(41,37,36,0.96)" : "rgba(253,251,247,0.96)",
                            backdropFilter: "blur(16px)",
                            border: `1px solid ${currentTheme.border}`,
                            maxHeight: "50vh",
                            overflowY: "auto",
                          }}
                        >
                          <div className="px-3 py-2" style={{ borderBottom: `1px solid ${currentTheme.border}` }}>
                            <p className="text-[10px] uppercase tracking-wider opacity-40 font-semibold">
                              {chapters.length} Chapters
                            </p>
                          </div>
                          {chapters.map((ch, idx) => {
                            const isCurrent = idx === currentChapterIndex
                            return (
                              <button
                                key={idx}
                                onClick={() => { jumpToChapter(ch); setShowChapterDropdown(false) }}
                                className="w-full text-left px-4 py-2.5 text-sm transition-colors flex items-center gap-3"
                                style={{
                                  backgroundColor: isCurrent ? `${currentTheme.progressFill}15` : "transparent",
                                  color: isCurrent ? currentTheme.progressFill : currentTheme.text,
                                  fontWeight: isCurrent ? 600 : 400,
                                }}
                              >
                                <span className="w-1.5 h-1.5 rounded-full flex-shrink-0" style={{ backgroundColor: isCurrent ? currentTheme.progressFill : `${currentTheme.text}20` }} />
                                <span className="truncate">{ch.title}</span>
                              </button>
                            )
                          })}
                        </motion.div>
                      )}
                    </AnimatePresence>
                  </div>
                )}

                {/* Main controls bar — 3-column grid for proper centering */}
                <div className="grid grid-cols-3 items-center px-4 h-14">
                  {/* Left: prev chapter + page info + TOC */}
                  <div className="flex items-center gap-1 justify-self-start">
                    {chapters.length > 0 && (
                      <motion.button
                        whileTap={{ scale: 0.9 }}
                        onClick={goToPrevChapter}
                        disabled={currentChapterIndex <= 0}
                        className="w-10 h-10 rounded-full flex items-center justify-center disabled:opacity-20"
                        aria-label="Previous chapter"
                      >
                        <ChevronLeft className="w-5 h-5" />
                      </motion.button>
                    )}
                    <button
                      onClick={() => setShowNavPanel(true)}
                      className="flex items-center gap-1.5 px-2 py-2 rounded-lg transition-opacity hover:opacity-80"
                      aria-label="Open table of contents"
                    >
                      <List className="w-4 h-4 opacity-60" />
                      <span className="text-sm tabular-nums font-medium opacity-70">
                        {paginatedPage + 1} / {columnTotal}
                      </span>
                    </button>
                    {chapters.length > 0 && (
                      <motion.button
                        whileTap={{ scale: 0.9 }}
                        onClick={goToNextChapter}
                        disabled={currentChapterIndex >= chapters.length - 1}
                        className="w-10 h-10 rounded-full flex items-center justify-center disabled:opacity-20"
                        aria-label="Next chapter"
                      >
                        <ChevronRight className="w-5 h-5" />
                      </motion.button>
                    )}
                  </div>

                  {/* Center: font controls — always centered */}
                  <div className="flex items-center gap-3 justify-self-center">
                    <motion.button
                      whileTap={{ scale: 0.9 }}
                      onClick={() => setFontSize((s) => Math.max(14, s - 1))}
                      disabled={fontSize <= 14}
                      className="w-10 h-10 rounded-full flex items-center justify-center disabled:opacity-20"
                      aria-label="Decrease font size"
                    >
                      <Minus className="w-4 h-4" />
                    </motion.button>
                    <span className="text-sm tabular-nums opacity-60 w-6 text-center">{fontSize}</span>
                    <motion.button
                      whileTap={{ scale: 0.9 }}
                      onClick={() => setFontSize((s) => Math.min(24, s + 1))}
                      disabled={fontSize >= 24}
                      className="w-10 h-10 rounded-full flex items-center justify-center disabled:opacity-20"
                      aria-label="Increase font size"
                    >
                      <Plus className="w-4 h-4" />
                    </motion.button>
                  </div>

                  {/* Right: auto-scroll toggle + time remaining */}
                  <div className="flex items-center gap-2 justify-self-end">
                    <div className="flex flex-col items-center">
                      <motion.button
                        whileTap={{ scale: 0.9 }}
                        onClick={() => setAutoScrollEnabled(prev => !prev)}
                        className="w-10 h-10 rounded-full flex items-center justify-center transition-colors"
                        style={{
                          backgroundColor: autoScrollEnabled ? `${currentTheme.progressFill}20` : "transparent",
                          color: autoScrollEnabled ? currentTheme.progressFill : `${currentTheme.text}60`,
                        }}
                        aria-label={autoScrollEnabled ? "Pause auto-scroll" : "Start auto-scroll"}
                      >
                        {autoScrollEnabled ? <Pause className="w-4 h-4" /> : <Play className="w-4 h-4" />}
                      </motion.button>
                      <span className="text-[9px] opacity-40 -mt-0.5">Auto</span>
                    </div>
                    <span className="text-xs tabular-nums opacity-50">
                      {progress >= 98 ? "Done!" : `~${minsRemaining < 60 ? `${minsRemaining}m` : `${Math.floor(minsRemaining / 60)}h ${minsRemaining % 60}m`}`}
                    </span>
                  </div>
                </div>
              </div>
            </>
          )}
          {/* Font picker overlay — fixed position so it can't be clipped */}
          <AnimatePresence>
            {showFontMenu && (
              <>
                <motion.div
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1 }}
                  exit={{ opacity: 0 }}
                  className="fixed inset-0 z-[70]"
                  onClick={() => setShowFontMenu(false)}
                />
                <motion.div
                  initial={{ opacity: 0, y: -8 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, y: -8 }}
                  transition={{ duration: 0.15 }}
                  className="fixed right-4 z-[71] rounded-2xl shadow-2xl overflow-hidden"
                  style={{
                    top: "env(safe-area-inset-top, 0px)",
                    marginTop: 60,
                    backgroundColor: currentTheme.bg,
                    border: `1px solid ${currentTheme.border}`,
                  }}
                >
                  <div className="px-4 py-3" style={{ borderBottom: `1px solid ${currentTheme.border}` }}>
                    <p className="text-xs font-semibold opacity-50 uppercase tracking-wider">Font</p>
                  </div>
                  {FONT_OPTIONS.map(opt => (
                    <button
                      key={opt.id}
                      onClick={() => {
                        setReaderFont(opt.id)
                        try { localStorage.setItem(FONT_KEY, opt.id) } catch { /* ignore */ }
                        setShowFontMenu(false)
                      }}
                      className="w-full text-left px-5 py-3.5 text-base transition-colors flex items-center justify-between gap-4 min-w-[200px]"
                      style={{
                        fontFamily: opt.family,
                        color: readerFont === opt.id ? currentTheme.progressFill : currentTheme.text,
                        backgroundColor: readerFont === opt.id ? `${currentTheme.progressFill}15` : "transparent",
                      }}
                    >
                      <span>{opt.label}</span>
                      {readerFont === opt.id && <span className="text-xs opacity-50">Active</span>}
                    </button>
                  ))}
                  <div className="px-4 py-3 flex items-center justify-between" style={{ borderTop: `1px solid ${currentTheme.border}` }}>
                    <span className="text-xs opacity-50">Size</span>
                    <div className="flex items-center gap-3">
                      <button
                        onClick={() => setFontSize(s => Math.max(14, s - 1))}
                        disabled={fontSize <= 14}
                        className="w-9 h-9 rounded-full flex items-center justify-center disabled:opacity-20"
                        style={{ border: `1px solid ${currentTheme.border}` }}
                      >
                        <Minus className="w-4 h-4" />
                      </button>
                      <span className="text-sm tabular-nums font-medium w-6 text-center">{fontSize}</span>
                      <button
                        onClick={() => setFontSize(s => Math.min(24, s + 1))}
                        disabled={fontSize >= 24}
                        className="w-9 h-9 rounded-full flex items-center justify-center disabled:opacity-20"
                        style={{ border: `1px solid ${currentTheme.border}` }}
                      >
                        <Plus className="w-4 h-4" />
                      </button>
                    </div>
                  </div>
                </motion.div>
              </>
            )}
          </AnimatePresence>

          {/* Focus Mode overlay */}
          <AnimatePresence>
            {focusMode && focusMinimized && (
              <motion.div
                initial={{ opacity: 0, scale: 0.9 }}
                animate={{ opacity: 1, scale: 1 }}
                className="fixed bottom-20 right-4 z-[65]"
              >
                <button
                  onClick={() => setFocusMinimized(false)}
                  className="flex items-center gap-2 px-4 py-2.5 rounded-full shadow-lg"
                  style={{
                    backgroundColor: theme === "dark" ? "rgba(41,37,36,0.95)" : "rgba(253,251,247,0.95)",
                    backdropFilter: "blur(16px)",
                    border: `1px solid ${currentTheme.border}`,
                    color: currentTheme.text,
                  }}
                >
                  <Timer className="w-4 h-4" style={{ color: currentTheme.progressFill }} />
                  <span className="text-sm tabular-nums font-medium">
                    {String(Math.floor(pomodoroSecondsLeft / 60)).padStart(2, "0")}:{String(pomodoroSecondsLeft % 60).padStart(2, "0")}
                  </span>
                  {ambientSound && <span className="text-xs">{AMBIENT_SOUNDS.find(s => s.id === ambientSound)?.emoji}</span>}
                </button>
              </motion.div>
            )}

            {focusMode && !focusMinimized && (
              <motion.div
                initial={{ opacity: 0, y: 20, scale: 0.95 }}
                animate={{ opacity: 1, y: 0, scale: 1 }}
                exit={{ opacity: 0, y: 20, scale: 0.95 }}
                transition={{ duration: 0.2 }}
                className="fixed bottom-20 right-4 z-[65] rounded-xl shadow-lg overflow-hidden"
                style={{
                  backgroundColor: theme === "dark" ? "rgba(41,37,36,0.92)" : "rgba(253,251,247,0.92)",
                  backdropFilter: "blur(16px)",
                  WebkitBackdropFilter: "blur(16px)",
                  border: `1px solid ${currentTheme.border}`,
                  color: currentTheme.text,
                  minWidth: 220,
                }}
              >
                <div className="flex items-center justify-between px-4 pt-3 pb-1">
                  <span className="text-[10px] uppercase tracking-wider opacity-40 font-semibold">Focus Mode</span>
                  <div className="flex items-center gap-1">
                    <button
                      onClick={() => setFocusMinimized(true)}
                      className="p-1 rounded-md opacity-40 hover:opacity-80 transition-opacity"
                      aria-label="Minimize focus mode"
                    >
                      <Minus className="w-3.5 h-3.5" />
                    </button>
                    <button
                      onClick={() => { toggleFocusMode(); stopAmbientSound() }}
                      className="p-1 rounded-md opacity-50 hover:opacity-80 transition-opacity"
                      aria-label="Close focus mode"
                    >
                      <X className="w-3.5 h-3.5" />
                    </button>
                  </div>
                </div>

                <div className="px-4 py-3">
                  {pomodoroFinished ? (
                    <div className="text-center py-2">
                      <p className="text-lg font-bold mb-1">Session complete! 🎉</p>
                      <button
                        onClick={() => resetPomodoro(pomodoroMinutes)}
                        className="text-xs font-medium px-3 py-1.5 rounded-lg mt-1 transition-colors"
                        style={{ backgroundColor: `${currentTheme.progressFill}20`, color: currentTheme.progressFill }}
                      >
                        Start another
                      </button>
                    </div>
                  ) : (
                    <>
                      <div className="text-center mb-3">
                        <p className="text-3xl font-bold tabular-nums" style={{ color: currentTheme.progressFill }}>
                          {String(Math.floor(pomodoroSecondsLeft / 60)).padStart(2, "0")}:{String(pomodoroSecondsLeft % 60).padStart(2, "0")}
                        </p>
                      </div>
                      <div className="flex items-center justify-center gap-2 mb-3">
                        <button
                          onClick={() => setPomodoroRunning(prev => !prev)}
                          className="flex items-center gap-2 px-5 py-2.5 rounded-xl text-sm font-semibold transition-colors"
                          style={{ backgroundColor: pomodoroRunning ? `${currentTheme.text}15` : currentTheme.progressFill, color: pomodoroRunning ? currentTheme.text : "#fff" }}
                        >
                          {pomodoroRunning ? <Pause className="w-4 h-4" /> : <Play className="w-4 h-4" />}
                          {pomodoroRunning ? "Pause" : "Start"}
                        </button>
                        <div className="flex gap-1">
                          {POMODORO_DURATIONS.map(mins => (
                            <button
                              key={mins}
                              onClick={() => resetPomodoro(mins)}
                              className="px-2 py-1.5 rounded-md text-[10px] font-medium transition-colors"
                              style={{
                                backgroundColor: pomodoroMinutes === mins ? `${currentTheme.text}15` : "transparent",
                                opacity: pomodoroMinutes === mins ? 1 : 0.5,
                              }}
                            >
                              {mins}m
                            </button>
                          ))}
                        </div>
                      </div>
                    </>
                  )}
                </div>

                <div className="px-4 pb-3">
                  <p className="text-[10px] uppercase tracking-wider opacity-40 font-semibold mb-1.5">Ambient Sound</p>
                  <div className="flex gap-1 flex-wrap">
                    {AMBIENT_SOUNDS.map(sound => (
                      <button
                        key={sound.id}
                        onClick={() => {
                          if (ambientSound === sound.id) {
                            // Toggle off — clicking same sound stops it
                            stopAmbientSound()
                            setAmbientSound("" as AmbientSound)
                          } else {
                            setAmbientSound(sound.id)
                            startAmbientSound(sound.id)
                          }
                        }}
                        className="flex items-center gap-1 px-2.5 py-1.5 rounded-lg text-[11px] font-medium transition-colors"
                        style={{
                          backgroundColor: ambientSound === sound.id ? `${currentTheme.progressFill}20` : `${currentTheme.text}06`,
                          color: ambientSound === sound.id ? currentTheme.progressFill : currentTheme.text,
                          opacity: ambientSound === sound.id ? 1 : 0.6,
                        }}
                      >
                        <span>{sound.emoji}</span> {sound.label}
                      </button>
                    ))}
                    <button
                      onClick={() => {
                        stopAmbientSound()
                        setAmbientSound("" as AmbientSound)
                      }}
                      className="px-2.5 py-1.5 rounded-lg text-[11px] font-medium transition-colors"
                      style={{
                        backgroundColor: `${currentTheme.text}06`,
                        opacity: 0.5,
                      }}
                    >
                      None
                    </button>
                  </div>

                  {/* Volume slider */}
                  <div className="flex items-center gap-2 mt-2">
                    <span className="text-[10px] opacity-40">🔈</span>
                    <input
                      type="range"
                      min={0}
                      max={100}
                      value={Math.round(ambientVolume * 100)}
                      onChange={(e) => {
                        const v = parseInt(e.target.value) / 100
                        setAmbientVolume(v)
                        if (ambientRef.current) ambientRef.current.setVolume(v)
                      }}
                      className="flex-1 h-1.5 rounded-full appearance-none cursor-pointer"
                      style={{
                        accentColor: currentTheme.progressFill,
                        background: `linear-gradient(to right, ${currentTheme.progressFill} ${ambientVolume * 100}%, ${currentTheme.progressTrack} ${ambientVolume * 100}%)`,
                      }}
                    />
                    <span className="text-[10px] opacity-40">🔊</span>
                  </div>
                </div>
              </motion.div>
            )}
          </AnimatePresence>

          {/* Vocabulary Flashcards */}
          <VocabFlashcards isOpen={showVocab} onClose={() => setShowVocab(false)} />

        </motion.div>
      )}
    </AnimatePresence>
  )
}
