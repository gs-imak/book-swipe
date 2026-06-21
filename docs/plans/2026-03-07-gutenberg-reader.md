# Gutenberg In-App Reader Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Let users read full public-domain books in-app via Project Gutenberg, with a polished mobile reader UI that saves their position, supports themes and font controls, and integrates seamlessly into the existing book detail flow.

**Architecture:** A Gutendex API client (`lib/gutenberg-api.ts`) searches for a Gutenberg edition by title+author and fetches the plain-text content. A `BookReader` full-screen overlay renders the text with reader controls. Reading position is persisted to localStorage. A "Read Free" button appears in the `BookDetailModal` only when a Gutenberg match is found.

**Tech Stack:** Next.js 14 App Router, React 18, TypeScript, Framer Motion, TailwindCSS, Gutendex REST API (`gutendex.com`), localStorage

---

## Task 1: Gutenberg API client

**Files:**
- Create: `lib/gutenberg-api.ts`

**What it does:**
- `searchGutenberg(title, author)` → finds the best-matching Gutenberg book
- `fetchBookText(gutenbergId)` → fetches the raw UTF-8 plain-text content
- Caches results in `sessionStorage` to avoid re-fetching on tab switch

**Step 1: Create the file**

```typescript
// lib/gutenberg-api.ts

export interface GutenbergBook {
  id: number
  title: string
  authors: { name: string }[]
  formats: Record<string, string>
}

interface GutendexResponse {
  results: GutenbergBook[]
}

const CACHE_PREFIX = "bookswipe_gutenberg_"

function normalise(s: string) {
  return s.toLowerCase().replace(/[^a-z0-9 ]/g, "").trim()
}

export async function searchGutenberg(
  title: string,
  author: string
): Promise<GutenbergBook | null> {
  const cacheKey = CACHE_PREFIX + "meta_" + normalise(title)
  try {
    const cached = sessionStorage.getItem(cacheKey)
    if (cached) return JSON.parse(cached) as GutenbergBook
  } catch { /* ignore */ }

  try {
    const query = encodeURIComponent(title)
    const res = await fetch(`https://gutendex.com/books/?search=${query}&languages=en`)
    if (!res.ok) return null
    const data: GutendexResponse = await res.json()

    const normTitle = normalise(title)
    const normAuthor = normalise(author.split(",")[0]) // use last name

    // Score candidates — prefer exact title + author match
    const scored = data.results.map((book) => {
      const bt = normalise(book.title)
      const ba = book.authors.map((a) => normalise(a.name)).join(" ")
      let score = 0
      if (bt === normTitle) score += 4
      else if (bt.includes(normTitle) || normTitle.includes(bt)) score += 2
      if (ba.includes(normAuthor.split(" ").pop() ?? normAuthor)) score += 3
      // Must have a plain-text format
      const hasText = Object.keys(book.formats).some(
        (f) => f.includes("text/plain")
      )
      if (!hasText) score = 0
      return { book, score }
    })

    const best = scored.sort((a, b) => b.score - a.score)[0]
    if (!best || best.score < 2) return null

    try {
      sessionStorage.setItem(cacheKey, JSON.stringify(best.book))
    } catch { /* quota */ }

    return best.book
  } catch {
    return null
  }
}

export async function fetchBookText(book: GutenbergBook): Promise<string | null> {
  const cacheKey = CACHE_PREFIX + "text_" + book.id
  try {
    const cached = sessionStorage.getItem(cacheKey)
    if (cached) return cached
  } catch { /* ignore */ }

  // Prefer UTF-8 plain text
  const textUrl =
    book.formats["text/plain; charset=utf-8"] ||
    book.formats["text/plain; charset=us-ascii"] ||
    book.formats["text/plain"] ||
    Object.entries(book.formats).find(([k]) => k.startsWith("text/plain"))?.[1]

  if (!textUrl) return null

  try {
    const res = await fetch(textUrl)
    if (!res.ok) return null
    let text = await res.text()

    // Strip Project Gutenberg header/footer boilerplate
    const startMarkers = [
      "*** START OF THE PROJECT GUTENBERG",
      "***START OF THE PROJECT GUTENBERG",
      "*** START OF THIS PROJECT GUTENBERG",
    ]
    const endMarkers = [
      "*** END OF THE PROJECT GUTENBERG",
      "***END OF THE PROJECT GUTENBERG",
      "*** END OF THIS PROJECT GUTENBERG",
    ]

    for (const marker of startMarkers) {
      const idx = text.indexOf(marker)
      if (idx !== -1) {
        text = text.slice(text.indexOf("\n", idx) + 1)
        break
      }
    }
    for (const marker of endMarkers) {
      const idx = text.indexOf(marker)
      if (idx !== -1) {
        text = text.slice(0, idx)
        break
      }
    }

    text = text.trim()

    try {
      sessionStorage.setItem(cacheKey, text)
    } catch { /* quota — text too large, skip cache */ }

    return text
  } catch {
    return null
  }
}
```

**Step 2: Verify TypeScript compiles**

```bash
cd bookswipe && npx tsc --noEmit
```
Expected: no errors relating to `lib/gutenberg-api.ts`

**Step 3: Commit**

```bash
git add lib/gutenberg-api.ts
git commit -m "feat: add Gutenberg API client with search + text fetch"
```

---

## Task 2: Reading position storage

**Files:**
- Modify: `lib/storage.ts` (append new key + two functions at the bottom)

**What it adds:**
- `saveReadingPosition(bookId, charOffset)` — saves scroll position as char offset
- `getReadingPosition(bookId)` — returns char offset or 0

**Step 1: Add to `lib/storage.ts`**

Append after the last export in the file:

```typescript
// ── Gutenberg reading positions ──────────────────────────────────────────────

const READING_POSITION_KEY = "bookswipe_reading_positions"

export function saveReadingPosition(bookId: string, charOffset: number): void {
  const positions = safeGetJSON<Record<string, number>>(READING_POSITION_KEY, {})
  positions[bookId] = charOffset
  safeSetJSON(READING_POSITION_KEY, positions)
}

export function getReadingPosition(bookId: string): number {
  const positions = safeGetJSON<Record<string, number>>(READING_POSITION_KEY, {})
  return positions[bookId] ?? 0
}
```

**Step 2: Verify TypeScript**

```bash
npx tsc --noEmit
```

**Step 3: Commit**

```bash
git add lib/storage.ts
git commit -m "feat: add reading position persistence for Gutenberg reader"
```

---

## Task 3: BookReader component

**Files:**
- Create: `components/book-reader.tsx`

**What it renders:**
- Full-screen overlay (`fixed inset-0 z-[100]`)
- Top bar: back button, book title, progress percentage
- Scrollable text area with reader typography
- Bottom controls bar: font size (A- / A+), theme toggle (light/sepia/dark)
- Restores scroll position on open; saves on scroll (debounced 500ms)
- Loading state while fetching text
- Error state if Gutenberg has no match

**Step 1: Create the component**

```typescript
"use client"

import { useState, useEffect, useRef, useCallback } from "react"
import { motion, AnimatePresence } from "framer-motion"
import { ArrowLeft, Sun, Moon, Coffee, Minus, Plus, BookOpen, Loader2, AlertCircle } from "lucide-react"
import { GutenbergBook, fetchBookText } from "@/lib/gutenberg-api"
import { saveReadingPosition, getReadingPosition } from "@/lib/storage"

interface BookReaderProps {
  bookId: string
  bookTitle: string
  gutenbergBook: GutenbergBook
  isOpen: boolean
  onClose: () => void
}

type Theme = "light" | "sepia" | "dark"

const THEMES: Record<Theme, { bg: string; text: string; label: string }> = {
  light: { bg: "#FDFBF7", text: "#1c1917", label: "Light" },
  sepia: { bg: "#F5EFE0", text: "#3d2b1f", label: "Sepia" },
  dark:  { bg: "#1c1917", text: "#e7e5e4", label: "Dark" },
}

const MIN_FONT = 14
const MAX_FONT = 24
const DEFAULT_FONT = 17

export function BookReader({ bookId, bookTitle, gutenbergBook, isOpen, onClose }: BookReaderProps) {
  const [text, setText] = useState<string | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(false)
  const [fontSize, setFontSize] = useState(DEFAULT_FONT)
  const [theme, setTheme] = useState<Theme>("sepia")
  const [progress, setProgress] = useState(0)
  const scrollRef = useRef<HTMLDivElement>(null)
  const saveTimer = useRef<ReturnType<typeof setTimeout> | null>(null)
  const didRestoreRef = useRef(false)

  // Fetch text when opened
  useEffect(() => {
    if (!isOpen) return
    let cancelled = false
    setLoading(true)
    setError(false)
    didRestoreRef.current = false

    fetchBookText(gutenbergBook).then((result) => {
      if (cancelled) return
      if (!result) {
        setError(true)
        setLoading(false)
        return
      }
      setText(result)
      setLoading(false)
    })

    return () => { cancelled = true }
  }, [isOpen, gutenbergBook])

  // Restore scroll position after text renders
  useEffect(() => {
    if (!text || !scrollRef.current || didRestoreRef.current) return
    const saved = getReadingPosition(bookId)
    if (saved > 0) {
      // Convert char offset to scroll position ratio
      const ratio = saved / text.length
      const el = scrollRef.current
      // Wait one frame for layout
      requestAnimationFrame(() => {
        el.scrollTop = ratio * el.scrollHeight
        didRestoreRef.current = true
      })
    } else {
      didRestoreRef.current = true
    }
  }, [text, bookId])

  // Lock body scroll
  useEffect(() => {
    if (isOpen) {
      document.body.style.overflow = "hidden"
      return () => { document.body.style.overflow = "" }
    }
  }, [isOpen])

  // Escape key
  useEffect(() => {
    if (!isOpen) return
    const handler = (e: KeyboardEvent) => { if (e.key === "Escape") onClose() }
    document.addEventListener("keydown", handler)
    return () => document.removeEventListener("keydown", handler)
  }, [isOpen, onClose])

  const handleScroll = useCallback(() => {
    const el = scrollRef.current
    if (!el || !text) return
    const scrolled = el.scrollTop / (el.scrollHeight - el.clientHeight)
    const pct = Math.min(100, Math.round(scrolled * 100))
    setProgress(pct)

    // Debounced save
    if (saveTimer.current) clearTimeout(saveTimer.current)
    saveTimer.current = setTimeout(() => {
      const charOffset = Math.round(scrolled * text.length)
      saveReadingPosition(bookId, charOffset)
    }, 500)
  }, [bookId, text])

  const cycleTheme = () => {
    const order: Theme[] = ["light", "sepia", "dark"]
    setTheme((t) => order[(order.indexOf(t) + 1) % order.length])
  }

  const themeStyle = THEMES[theme]

  // Split text into paragraphs for rendering
  const paragraphs = text
    ? text
        .split(/\n{2,}/)
        .map((p) => p.replace(/\n/g, " ").trim())
        .filter((p) => p.length > 0)
    : []

  const ThemeIcon = theme === "dark" ? Moon : theme === "sepia" ? Coffee : Sun

  return (
    <AnimatePresence>
      {isOpen && (
        <motion.div
          initial={{ opacity: 0, y: "100%" }}
          animate={{ opacity: 1, y: 0 }}
          exit={{ opacity: 0, y: "100%" }}
          transition={{ type: "spring", stiffness: 280, damping: 32 }}
          className="fixed inset-0 z-[100] flex flex-col"
          style={{ background: themeStyle.bg, color: themeStyle.text }}
        >
          {/* Top bar */}
          <div
            className="flex-shrink-0 flex items-center justify-between px-4 py-3 border-b"
            style={{
              borderColor: theme === "dark" ? "rgba(255,255,255,0.08)" : "rgba(0,0,0,0.08)",
              paddingTop: "max(12px, env(safe-area-inset-top, 12px))",
            }}
          >
            <button
              onClick={onClose}
              aria-label="Close reader"
              className="p-2 -ml-2 rounded-lg transition-colors tap-target"
              style={{ color: themeStyle.text, opacity: 0.6 }}
            >
              <ArrowLeft className="w-5 h-5" />
            </button>

            <div className="text-center flex-1 mx-3 min-w-0">
              <p
                className="text-xs font-medium truncate opacity-60"
                style={{ color: themeStyle.text }}
              >
                {bookTitle}
              </p>
              {/* Progress bar */}
              <div
                className="mt-1 h-0.5 rounded-full overflow-hidden mx-auto max-w-[120px]"
                style={{ background: theme === "dark" ? "rgba(255,255,255,0.15)" : "rgba(0,0,0,0.12)" }}
              >
                <div
                  className="h-full rounded-full transition-all duration-300"
                  style={{ width: `${progress}%`, background: theme === "dark" ? "#d6b47a" : "#92400e" }}
                />
              </div>
              <p className="text-[10px] mt-0.5 opacity-40" style={{ color: themeStyle.text }}>
                {progress}%
              </p>
            </div>

            <button
              onClick={cycleTheme}
              aria-label={`Switch to next theme (currently ${theme})`}
              className="p-2 -mr-2 rounded-lg transition-colors tap-target"
              style={{ color: themeStyle.text, opacity: 0.6 }}
            >
              <ThemeIcon className="w-5 h-5" />
            </button>
          </div>

          {/* Content */}
          {loading ? (
            <div className="flex-1 flex flex-col items-center justify-center gap-3">
              <Loader2 className="w-7 h-7 animate-spin" style={{ color: themeStyle.text, opacity: 0.4 }} />
              <p className="text-sm opacity-50" style={{ color: themeStyle.text }}>
                Loading book...
              </p>
            </div>
          ) : error ? (
            <div className="flex-1 flex flex-col items-center justify-center gap-4 px-8 text-center">
              <AlertCircle className="w-10 h-10 opacity-30" style={{ color: themeStyle.text }} />
              <div>
                <p className="font-semibold mb-1" style={{ color: themeStyle.text }}>
                  Couldn&apos;t load book text
                </p>
                <p className="text-sm opacity-50" style={{ color: themeStyle.text }}>
                  The Project Gutenberg server may be temporarily unavailable.
                </p>
              </div>
              <button
                onClick={onClose}
                className="mt-2 px-5 py-2.5 rounded-xl text-sm font-medium"
                style={{
                  background: theme === "dark" ? "rgba(255,255,255,0.12)" : "rgba(0,0,0,0.08)",
                  color: themeStyle.text,
                }}
              >
                Go back
              </button>
            </div>
          ) : (
            <div
              ref={scrollRef}
              onScroll={handleScroll}
              className="flex-1 overflow-y-auto overscroll-contain"
              style={{ WebkitOverflowScrolling: "touch" }}
            >
              <div
                className="max-w-2xl mx-auto px-5 sm:px-8 py-8"
                style={{
                  paddingBottom: "max(48px, env(safe-area-inset-bottom, 48px))",
                }}
              >
                {paragraphs.map((para, i) => (
                  <p
                    key={i}
                    className="mb-5 leading-relaxed"
                    style={{
                      fontSize: `${fontSize}px`,
                      color: themeStyle.text,
                      fontFamily: "'Georgia', 'Source Serif 4', serif",
                      textAlign: "justify",
                    }}
                  >
                    {para}
                  </p>
                ))}
              </div>
            </div>
          )}

          {/* Bottom controls */}
          {!loading && !error && (
            <div
              className="flex-shrink-0 flex items-center justify-center gap-6 px-6 py-3 border-t"
              style={{
                borderColor: theme === "dark" ? "rgba(255,255,255,0.08)" : "rgba(0,0,0,0.08)",
                paddingBottom: "max(12px, env(safe-area-inset-bottom, 12px))",
                background: theme === "dark"
                  ? "rgba(0,0,0,0.3)"
                  : theme === "sepia"
                  ? "rgba(245,239,224,0.9)"
                  : "rgba(253,251,247,0.9)",
              }}
            >
              <button
                onClick={() => setFontSize((s) => Math.max(MIN_FONT, s - 1))}
                disabled={fontSize <= MIN_FONT}
                aria-label="Decrease font size"
                className="w-10 h-10 rounded-full flex items-center justify-center transition-all tap-target disabled:opacity-30"
                style={{
                  background: theme === "dark" ? "rgba(255,255,255,0.1)" : "rgba(0,0,0,0.06)",
                  color: themeStyle.text,
                }}
              >
                <Minus className="w-4 h-4" />
              </button>

              <div className="flex items-center gap-1.5" style={{ color: themeStyle.text, opacity: 0.5 }}>
                <BookOpen className="w-3.5 h-3.5" />
                <span className="text-xs font-medium">{fontSize}px</span>
              </div>

              <button
                onClick={() => setFontSize((s) => Math.min(MAX_FONT, s + 1))}
                disabled={fontSize >= MAX_FONT}
                aria-label="Increase font size"
                className="w-10 h-10 rounded-full flex items-center justify-center transition-all tap-target disabled:opacity-30"
                style={{
                  background: theme === "dark" ? "rgba(255,255,255,0.1)" : "rgba(0,0,0,0.06)",
                  color: themeStyle.text,
                }}
              >
                <Plus className="w-4 h-4" />
              </button>
            </div>
          )}
        </motion.div>
      )}
    </AnimatePresence>
  )
}
```

**Step 2: Verify TypeScript**

```bash
npx tsc --noEmit
```

**Step 3: Commit**

```bash
git add components/book-reader.tsx
git commit -m "feat: add BookReader full-screen reading component"
```

---

## Task 4: "Read Free" button in BookDetailModal

**Files:**
- Modify: `components/book-detail-modal.tsx`

**What changes:**
- On mount (when `book` changes), call `searchGutenberg(book.title, book.author)`
- Store result in `gutenbergBook` state (null = no match, undefined = loading)
- When match found, show a **"Read Free"** button in the primary action row
- Render `<BookReader>` when the button is tapped

**Step 1: Add imports to `book-detail-modal.tsx`**

Add to the existing imports at the top:
```typescript
import { searchGutenberg, type GutenbergBook } from "@/lib/gutenberg-api"
import { BookReader } from "./book-reader"
```

**Step 2: Add state + search effect**

Inside the component, after existing `useState` declarations:
```typescript
const [gutenbergBook, setGutenbergBook] = useState<GutenbergBook | null | undefined>(undefined)
const [showReader, setShowReader] = useState(false)
```

In the existing `useEffect` that runs when `book` changes (the one that calls `getBookReview`), add the Gutenberg lookup:
```typescript
// Reset then search
setGutenbergBook(undefined)
setShowReader(false)
searchGutenberg(book.title, book.author).then(setGutenbergBook)
```

**Step 3: Add "Read Free" button to primary action row**

In the "primary row" div (right after `{onStartReading && ...}` and `{!existingReview && ...}`), append:

```typescript
{gutenbergBook && (
  <button
    onClick={() => setShowReader(true)}
    className="h-9 px-4 bg-amber-700 hover:bg-amber-800 text-white text-sm font-medium rounded-xl transition-all active:scale-[0.98] flex items-center gap-1.5"
  >
    <BookOpen className="w-3.5 h-3.5" />
    Read Free
  </button>
)}
{gutenbergBook === undefined && (
  <div className="h-9 px-4 flex items-center gap-1.5 text-stone-300 text-sm">
    <Loader2 className="w-3 h-3 animate-spin" />
  </div>
)}
```

**Step 4: Render BookReader**

At the very bottom of the component return, before the closing `</AnimatePresence>` tag, add:

```typescript
{gutenbergBook && book && (
  <BookReader
    bookId={book.id}
    bookTitle={book.title}
    gutenbergBook={gutenbergBook}
    isOpen={showReader}
    onClose={() => setShowReader(false)}
  />
)}
```

**Step 5: Verify TypeScript**

```bash
npx tsc --noEmit
```

**Step 6: Build check**

```bash
npx next build
```

Expected: clean build, no type errors

**Step 7: Commit**

```bash
git add components/book-detail-modal.tsx
git commit -m "feat: integrate Gutenberg reader into book detail modal"
```

---

## Task 5: Visual polish pass (frontend-designer agent)

> At this stage dispatch the `frontend-designer` agent to:
> 1. Review the `BookReader` component and `book-detail-modal.tsx` "Read Free" button on mobile
> 2. Check that the reader entry/exit animation feels native (slides up from bottom like a sheet)
> 3. Verify the sepia/dark/light themes look correct
> 4. Check font rendering at min/max sizes on a narrow viewport (375px)
> 5. Verify the bottom controls don't overlap system home indicator on iPhone

---

## Task 6: Final build + push

```bash
npx next build
git add -A
git commit -m "feat: Gutenberg in-app reader — search, fetch, read, position save"
git push origin master
```

---

## Testing Checklist

Manual test with a known public-domain book already in the app's catalog:

- [ ] Open "Pride and Prejudice" or "The Great Gatsby" detail modal
- [ ] "Read Free" button appears within ~1s (Gutendex search completes)
- [ ] Modern book (e.g. "The Hunger Games") shows no "Read Free" button (not on Gutenberg)
- [ ] Tapping "Read Free" slides the reader up
- [ ] Text loads and displays
- [ ] Scrolling updates the progress bar
- [ ] Close and reopen → scroll position restored
- [ ] A- / A+ buttons change font size smoothly
- [ ] Theme button cycles light → sepia → dark
- [ ] Swipe-down / back button closes the reader
- [ ] On iPhone SE (375px): no overflow, bottom controls above home indicator
- [ ] No TypeScript errors: `npx tsc --noEmit`
- [ ] Clean production build: `npx next build`
