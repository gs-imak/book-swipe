"use client"

import { useState, useEffect, useCallback } from "react"
import { motion, AnimatePresence } from "framer-motion"
import { X, Target, BookOpen, FileText, Flame, Compass, CheckCircle2, ChevronDown, ChevronUp } from "lucide-react"
import { getLikedBooks, getReadingProgress, getBookReviews, getUserStats } from "@/lib/storage"

const CHALLENGES_KEY = "bookswipe_challenges"
const PROMPT_CHALLENGES_KEY = "bookswipe_prompt_challenges"

interface PromptChallenge {
  id: string
  prompt: string
  category: string
  icon: string
}

const PROMPT_CHALLENGES: PromptChallenge[] = [
  // Genre Explorer
  { id: "genre-new", prompt: "Read a book from a genre you've never tried", category: "Genre Explorer", icon: "🗺️" },
  { id: "genre-poetry", prompt: "Read a poetry collection", category: "Genre Explorer", icon: "✍️" },
  { id: "genre-graphic", prompt: "Read a graphic novel or manga", category: "Genre Explorer", icon: "🎨" },
  // Format
  { id: "format-audio", prompt: "Listen to an audiobook", category: "Format", icon: "🎧" },
  { id: "format-short", prompt: "Read a book under 200 pages", category: "Format", icon: "📄" },
  { id: "format-long", prompt: "Read a book over 500 pages", category: "Format", icon: "📚" },
  // Time Travel
  { id: "time-old", prompt: "Read a book published before 1950", category: "Time Travel", icon: "🕰️" },
  { id: "time-new", prompt: "Read a book published this year", category: "Time Travel", icon: "🗓️" },
  { id: "time-classic", prompt: "Read a classic you've been avoiding", category: "Time Travel", icon: "⏳" },
  // Diversity
  { id: "div-country", prompt: "Read a book by an author from a different country", category: "Diversity", icon: "🌍" },
  { id: "div-translation", prompt: "Read a book in translation", category: "Diversity", icon: "🌐" },
  { id: "div-protagonist", prompt: "Read a book with a protagonist unlike you", category: "Diversity", icon: "🧑‍🤝‍🧑" },
  // Wild Card
  { id: "wild-stranger", prompt: "Read a book recommended by a stranger", category: "Wild Card", icon: "🎲" },
  { id: "wild-one-word", prompt: "Read a book with a one-word title", category: "Wild Card", icon: "🔤" },
  { id: "wild-banned", prompt: "Read a book that was banned", category: "Wild Card", icon: "🚫" },
  { id: "wild-reread", prompt: "Reread a childhood favorite", category: "Wild Card", icon: "🧸" },
  { id: "wild-shelf", prompt: "Read the first book on your shelf", category: "Wild Card", icon: "📖" },
]

function loadCompletedPrompts(): string[] {
  try {
    if (typeof window === "undefined") return []
    const stored = localStorage.getItem(PROMPT_CHALLENGES_KEY)
    if (!stored) return []
    return JSON.parse(stored) as string[]
  } catch {
    return []
  }
}

function saveCompletedPrompts(ids: string[]) {
  try {
    if (typeof window === "undefined") return
    localStorage.setItem(PROMPT_CHALLENGES_KEY, JSON.stringify(ids))
  } catch {
    // ignore storage errors
  }
}

interface ChallengeTargets {
  monthlyBooks: number    // 2 | 4 | 6 | 8
  weeklyPages: number     // fixed: 200
  reviewStreak: number    // fixed: 3
  genreExplorer: number   // fixed: 3
  readingStreak: number   // 7 | 14 | 30
}

const DEFAULT_TARGETS: ChallengeTargets = {
  monthlyBooks: 4,
  weeklyPages: 200,
  reviewStreak: 3,
  genreExplorer: 3,
  readingStreak: 7,
}

function loadTargets(): ChallengeTargets {
  try {
    if (typeof window === "undefined") return DEFAULT_TARGETS
    const stored = localStorage.getItem(CHALLENGES_KEY)
    if (!stored) return DEFAULT_TARGETS
    return { ...DEFAULT_TARGETS, ...JSON.parse(stored) }
  } catch {
    return DEFAULT_TARGETS
  }
}

function saveTargets(targets: ChallengeTargets) {
  try {
    if (typeof window === "undefined") return
    localStorage.setItem(CHALLENGES_KEY, JSON.stringify(targets))
  } catch {
    // ignore storage errors
  }
}

function getMonthlyBooksRead(): number {
  const progress = getReadingProgress()
  const now = new Date()
  const monthStart = new Date(now.getFullYear(), now.getMonth(), 1).toISOString()
  return progress.filter(p => p.status === "completed" && p.lastReadDate >= monthStart).length
}

function getWeeklyPagesRead(): number {
  const progress = getReadingProgress()
  const now = new Date()
  const weekStart = new Date(now)
  weekStart.setDate(now.getDate() - 7)
  const weekStartISO = weekStart.toISOString()
  return progress
    .filter(p => p.lastReadDate >= weekStartISO)
    .reduce((sum, p) => sum + (p.currentPage || 0), 0)
}

function getConsecutiveReviewStreak(): number {
  const reviews = getBookReviews()
  if (reviews.length === 0) return 0
  // Sort by createdAt descending and count consecutive reviews from the most recent
  const sorted = [...reviews].sort((a, b) => b.createdAt.localeCompare(a.createdAt))
  return Math.min(sorted.length, 10) // cap at 10 for display
}

function getMonthlyGenreCount(): number {
  const likedBooks = getLikedBooks()
  const progress = getReadingProgress()
  const now = new Date()
  const monthStart = new Date(now.getFullYear(), now.getMonth(), 1).toISOString()
  const completedThisMonth = new Set(
    progress
      .filter(p => p.status === "completed" && p.lastReadDate >= monthStart)
      .map(p => p.bookId)
  )
  const genres = new Set<string>()
  likedBooks.forEach(book => {
    if (completedThisMonth.has(book.id)) {
      book.genre.forEach(g => genres.add(g))
    }
  })
  return genres.size
}

interface Challenge {
  id: string
  icon: React.ReactNode
  title: string
  description: string
  current: number
  target: number
  unit: string
  color: string
  bgColor: string
  darkBgColor: string
}

interface ReadingChallengesProps {
  isOpen: boolean
  onClose: () => void
}

const MONTHLY_BOOK_OPTIONS = [2, 4, 6, 8]
const STREAK_OPTIONS = [7, 14, 30]

export function ReadingChallenges({ isOpen, onClose }: ReadingChallengesProps) {
  const [targets, setTargets] = useState<ChallengeTargets>(DEFAULT_TARGETS)
  const [challenges, setChallenges] = useState<Challenge[]>([])
  const [showGoalEditor, setShowGoalEditor] = useState(false)
  const [completedPrompts, setCompletedPrompts] = useState<string[]>([])

  const buildChallenges = useCallback((t: ChallengeTargets): Challenge[] => {
    const stats = getUserStats()
    return [
      {
        id: "monthly-books",
        icon: <BookOpen className="w-5 h-5" />,
        title: "Monthly Goal",
        description: "Complete books this month",
        current: getMonthlyBooksRead(),
        target: t.monthlyBooks,
        unit: "books",
        color: "text-amber-700 dark:text-amber-400",
        bgColor: "bg-amber-50",
        darkBgColor: "dark:bg-amber-900/20",
      },
      {
        id: "weekly-pages",
        icon: <FileText className="w-5 h-5" />,
        title: "Weekly Pages",
        description: "Pages read this week",
        current: getWeeklyPagesRead(),
        target: t.weeklyPages,
        unit: "pages",
        color: "text-blue-700 dark:text-blue-400",
        bgColor: "bg-blue-50",
        darkBgColor: "dark:bg-blue-900/20",
      },
      {
        id: "review-streak",
        icon: <Target className="w-5 h-5" />,
        title: "Review Streak",
        description: "Books reviewed in a row",
        current: Math.min(getConsecutiveReviewStreak(), t.reviewStreak),
        target: t.reviewStreak,
        unit: "reviews",
        color: "text-purple-700 dark:text-purple-400",
        bgColor: "bg-purple-50",
        darkBgColor: "dark:bg-purple-900/20",
      },
      {
        id: "genre-explorer",
        icon: <Compass className="w-5 h-5" />,
        title: "Genre Explorer",
        description: "Different genres read this month",
        current: Math.min(getMonthlyGenreCount(), t.genreExplorer),
        target: t.genreExplorer,
        unit: "genres",
        color: "text-teal-700 dark:text-teal-400",
        bgColor: "bg-teal-50",
        darkBgColor: "dark:bg-teal-900/20",
      },
      {
        id: "reading-streak",
        icon: <Flame className="w-5 h-5" />,
        title: "Reading Streak",
        description: "Days reading in a row",
        current: Math.min(stats.currentStreak, t.readingStreak),
        target: t.readingStreak,
        unit: "days",
        color: "text-orange-700 dark:text-orange-400",
        bgColor: "bg-orange-50",
        darkBgColor: "dark:bg-orange-900/20",
      },
    ]
  }, [])

  useEffect(() => {
    if (isOpen) {
      const t = loadTargets()
      setTargets(t)
      setChallenges(buildChallenges(t))
      setCompletedPrompts(loadCompletedPrompts())
    }
  }, [isOpen, buildChallenges])

  // Lock body scroll
  useEffect(() => {
    if (isOpen) {
      document.body.style.overflow = "hidden"
      return () => { document.body.style.overflow = "" }
    }
  }, [isOpen])

  // Escape key handler
  useEffect(() => {
    if (!isOpen) return
    const handler = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose()
    }
    document.addEventListener("keydown", handler)
    return () => document.removeEventListener("keydown", handler)
  }, [isOpen, onClose])

  const updateTarget = (key: keyof ChallengeTargets, value: number) => {
    const updated = { ...targets, [key]: value }
    setTargets(updated)
    saveTargets(updated)
    setChallenges(buildChallenges(updated))
  }

  const togglePrompt = (id: string) => {
    const next = completedPrompts.includes(id)
      ? completedPrompts.filter(p => p !== id)
      : [...completedPrompts, id]
    setCompletedPrompts(next)
    saveCompletedPrompts(next)
  }

  const completedCount = challenges.filter(c => c.current >= c.target).length + completedPrompts.length
  const totalCount = challenges.length + PROMPT_CHALLENGES.length

  return (
    <AnimatePresence>
      {isOpen && (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          transition={{ duration: 0.2 }}
          className="fixed inset-0 lg:left-16 z-[60] bg-black/60 backdrop-blur-sm flex items-end sm:items-center justify-center p-0 sm:p-4"
          onClick={(e) => { if (e.target === e.currentTarget) onClose() }}
        >
          <motion.div
            initial={{ y: 40, opacity: 0 }}
            animate={{ y: 0, opacity: 1 }}
            exit={{ y: 40, opacity: 0 }}
            transition={{ type: "spring", stiffness: 300, damping: 30 }}
            className="w-full sm:max-w-lg bg-white dark:bg-stone-900 rounded-t-2xl sm:rounded-2xl shadow-2xl overflow-hidden flex flex-col max-h-[90dvh]"
          >
            {/* Header */}
            <div className="flex items-center justify-between px-5 py-4 border-b border-stone-100 dark:border-stone-800 flex-shrink-0">
              <div className="flex items-center gap-2.5">
                <div className="w-8 h-8 rounded-lg bg-amber-100 dark:bg-amber-900/40 flex items-center justify-center">
                  <Target className="w-4 h-4 text-amber-600 dark:text-amber-400" />
                </div>
                <div>
                  <h2 className="text-base font-bold text-stone-900 dark:text-stone-100 font-serif leading-tight">
                    Reading Challenges
                  </h2>
                  <p className="text-[11px] text-stone-400 dark:text-stone-500">
                    {completedCount} of {totalCount} complete
                  </p>
                </div>
              </div>
              <div className="flex items-center gap-2">
                <button
                  onClick={() => setShowGoalEditor(v => !v)}
                  aria-label="Edit goals"
                  className="flex items-center gap-1 px-2.5 py-1.5 rounded-lg text-xs font-medium text-stone-500 dark:text-stone-400 hover:bg-stone-100 dark:hover:bg-stone-800 transition-colors"
                >
                  Goals
                  {showGoalEditor ? <ChevronUp className="w-3 h-3" /> : <ChevronDown className="w-3 h-3" />}
                </button>
                <button
                  onClick={onClose}
                  aria-label="Close challenges"
                  className="p-1.5 rounded-lg hover:bg-stone-100 dark:hover:bg-stone-800 transition-colors"
                >
                  <X className="w-4 h-4 text-stone-500 dark:text-stone-400" />
                </button>
              </div>
            </div>

            {/* Goal editor */}
            <AnimatePresence>
              {showGoalEditor && (
                <motion.div
                  initial={{ height: 0, opacity: 0 }}
                  animate={{ height: "auto", opacity: 1 }}
                  exit={{ height: 0, opacity: 0 }}
                  transition={{ duration: 0.2 }}
                  className="overflow-hidden border-b border-stone-100 dark:border-stone-800 flex-shrink-0"
                >
                  <div className="px-5 py-3 space-y-3 bg-stone-50 dark:bg-stone-800/50">
                    <p className="text-[11px] font-semibold text-stone-400 dark:text-stone-500 uppercase tracking-widest">
                      Customize Targets
                    </p>
                    <div className="flex items-center justify-between">
                      <span className="text-xs text-stone-600 dark:text-stone-300">Monthly books</span>
                      <div className="flex gap-1.5">
                        {MONTHLY_BOOK_OPTIONS.map(n => (
                          <button
                            key={n}
                            onClick={() => updateTarget("monthlyBooks", n)}
                            className={`w-8 h-7 rounded-md text-xs font-semibold transition-all ${
                              targets.monthlyBooks === n
                                ? "bg-amber-600 text-white"
                                : "bg-white dark:bg-stone-700 text-stone-600 dark:text-stone-300 hover:bg-amber-50 dark:hover:bg-stone-600"
                            }`}
                          >
                            {n}
                          </button>
                        ))}
                      </div>
                    </div>
                    <div className="flex items-center justify-between">
                      <span className="text-xs text-stone-600 dark:text-stone-300">Streak goal (days)</span>
                      <div className="flex gap-1.5">
                        {STREAK_OPTIONS.map(n => (
                          <button
                            key={n}
                            onClick={() => updateTarget("readingStreak", n)}
                            className={`w-10 h-7 rounded-md text-xs font-semibold transition-all ${
                              targets.readingStreak === n
                                ? "bg-orange-500 text-white"
                                : "bg-white dark:bg-stone-700 text-stone-600 dark:text-stone-300 hover:bg-orange-50 dark:hover:bg-stone-600"
                            }`}
                          >
                            {n}d
                          </button>
                        ))}
                      </div>
                    </div>
                  </div>
                </motion.div>
              )}
            </AnimatePresence>

            {/* Challenges list */}
            <div className="overflow-y-auto flex-1 p-4 space-y-3">
              {challenges.map((challenge, index) => {
                const pct = Math.min(100, Math.round((challenge.current / challenge.target) * 100))
                const done = challenge.current >= challenge.target
                return (
                  <motion.div
                    key={challenge.id}
                    initial={{ opacity: 0, y: 8 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ delay: index * 0.05, type: "spring", stiffness: 300, damping: 28 }}
                    className={`relative rounded-xl p-4 border transition-all ${
                      done
                        ? "border-emerald-200 dark:border-emerald-700/50 bg-emerald-50 dark:bg-emerald-900/20"
                        : `border-stone-100 dark:border-stone-800 ${challenge.bgColor} ${challenge.darkBgColor}`
                    }`}
                  >
                    <div className="flex items-start justify-between gap-3 mb-3">
                      <div className="flex items-center gap-3">
                        <div className={`w-9 h-9 rounded-lg flex items-center justify-center flex-shrink-0 ${
                          done
                            ? "bg-emerald-100 dark:bg-emerald-800/50 text-emerald-600 dark:text-emerald-400"
                            : `bg-white/70 dark:bg-stone-800/50 ${challenge.color}`
                        }`}>
                          {done ? <CheckCircle2 className="w-5 h-5" /> : challenge.icon}
                        </div>
                        <div>
                          <h3 className={`text-sm font-semibold leading-tight ${
                            done ? "text-emerald-800 dark:text-emerald-300" : "text-stone-900 dark:text-stone-100"
                          }`}>
                            {challenge.title}
                          </h3>
                          <p className="text-[11px] text-stone-500 dark:text-stone-400 mt-0.5">
                            {challenge.description}
                          </p>
                        </div>
                      </div>
                      <div className="text-right flex-shrink-0">
                        <span className={`text-lg font-bold tabular-nums ${
                          done ? "text-emerald-600 dark:text-emerald-400" : challenge.color
                        }`}>
                          {challenge.current}
                        </span>
                        <span className="text-xs text-stone-400 dark:text-stone-500 ml-0.5">
                          /{challenge.target}
                        </span>
                        <p className="text-[10px] text-stone-400 dark:text-stone-500">{challenge.unit}</p>
                      </div>
                    </div>

                    {/* Progress bar */}
                    <div className="h-1.5 rounded-full bg-stone-200/70 dark:bg-stone-700/60 overflow-hidden">
                      <motion.div
                        className={`h-full rounded-full ${done ? "bg-emerald-500" : ""}`}
                        style={done ? {} : {
                          background: `var(--challenge-fill-${challenge.id.replace(/-/g, "_")}, currentColor)`
                        }}
                        initial={{ width: 0 }}
                        animate={{ width: `${pct}%` }}
                        transition={{ duration: 0.6, delay: index * 0.05 + 0.1, ease: "easeOut" }}
                      >
                        {/* Inline color since Tailwind can't handle dynamic class names for fills */}
                        {!done && (
                          <div
                            className="h-full w-full rounded-full"
                            style={{
                              background:
                                challenge.id === "monthly-books" ? "#d97706" :
                                challenge.id === "weekly-pages" ? "#3b82f6" :
                                challenge.id === "review-streak" ? "#a855f7" :
                                challenge.id === "genre-explorer" ? "#0d9488" :
                                "#f97316",
                            }}
                          />
                        )}
                      </motion.div>
                    </div>

                    {done && (
                      <p className="text-[11px] text-emerald-600 dark:text-emerald-400 font-medium mt-2">
                        Challenge complete!
                      </p>
                    )}
                    {!done && pct > 0 && (
                      <p className="text-[11px] text-stone-400 dark:text-stone-500 mt-1.5">
                        {pct}% complete — {challenge.target - challenge.current} {challenge.unit} to go
                      </p>
                    )}
                    {!done && pct === 0 && (
                      <p className="text-[11px] text-stone-400 dark:text-stone-500 mt-1.5">
                        Not started yet
                      </p>
                    )}
                  </motion.div>
                )
              })}

              {/* Reading Prompts section */}
              <div className="pt-2">
                <div className="flex items-center gap-2 mb-3">
                  <h3 className="text-xs font-semibold text-stone-500 dark:text-stone-400 uppercase tracking-widest">
                    Reading Prompts
                  </h3>
                  <div className="flex-1 h-px bg-stone-100 dark:bg-stone-800" />
                  <span className="text-[11px] text-stone-400 dark:text-stone-500">
                    {completedPrompts.length}/{PROMPT_CHALLENGES.length}
                  </span>
                </div>

                {(["Genre Explorer", "Format", "Time Travel", "Diversity", "Wild Card"] as const).map(category => {
                  const items = PROMPT_CHALLENGES.filter(p => p.category === category)
                  return (
                    <div key={category} className="mb-4">
                      <p className="text-[10px] font-semibold text-stone-400 dark:text-stone-500 uppercase tracking-widest mb-2">
                        {category}
                      </p>
                      <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
                        {items.map(item => {
                          const done = completedPrompts.includes(item.id)
                          return (
                            <button
                              key={item.id}
                              onClick={() => togglePrompt(item.id)}
                              className={`relative text-left rounded-xl p-3 border transition-all active:scale-95 ${
                                done
                                  ? "border-emerald-200 dark:border-emerald-700/50 bg-emerald-50 dark:bg-emerald-900/20"
                                  : "border-stone-100 dark:border-stone-800 bg-stone-50 dark:bg-stone-800/50 hover:bg-stone-100 dark:hover:bg-stone-800"
                              }`}
                            >
                              <span className="text-xl block mb-1.5 leading-none">{item.icon}</span>
                              <p className={`text-[11px] leading-snug font-medium ${
                                done
                                  ? "text-emerald-700 dark:text-emerald-400 line-through decoration-emerald-400/60"
                                  : "text-stone-700 dark:text-stone-300"
                              }`}>
                                {item.prompt}
                              </p>
                              {done && (
                                <CheckCircle2 className="absolute top-2 right-2 w-3.5 h-3.5 text-emerald-500 dark:text-emerald-400" />
                              )}
                            </button>
                          )
                        })}
                      </div>
                    </div>
                  )
                })}
              </div>

              {/* Footer nudge */}
              <p className="text-center text-[11px] text-stone-400 dark:text-stone-500 pb-2 pt-1">
                Progress updates as you read and review books.
              </p>
            </div>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  )
}
