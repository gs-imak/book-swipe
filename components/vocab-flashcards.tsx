"use client"

import { useState, useEffect, useCallback } from "react"
import { motion, AnimatePresence } from "framer-motion"
import { X, BookOpen, RotateCcw, Check, ChevronRight, Brain, Trash2 } from "lucide-react"
import { getVocabulary, getDueWords, reviewWord, deleteVocabWord, type VocabWord } from "@/lib/vocabulary"
import { t } from "@/lib/i18n"

interface VocabFlashcardsProps {
  isOpen: boolean
  onClose: () => void
}

export function VocabFlashcards({ isOpen, onClose }: VocabFlashcardsProps) {
  const [allWords, setAllWords] = useState<VocabWord[]>([])
  const [dueWords, setDueWords] = useState<VocabWord[]>([])
  const [currentIdx, setCurrentIdx] = useState(0)
  const [showAnswer, setShowAnswer] = useState(false)
  const [mode, setMode] = useState<"review" | "browse">("review")
  const [sessionComplete, setSessionComplete] = useState(false)

  // Reset the session on the closed -> open transition, during render
  // (React's "adjusting state when props change" pattern — no extra commit).
  const [wasOpen, setWasOpen] = useState(false)
  if (isOpen !== wasOpen) {
    setWasOpen(isOpen)
    if (isOpen) {
      setAllWords(getVocabulary())
      const due = getDueWords()
      setDueWords(due)
      setCurrentIdx(0)
      setShowAnswer(false)
      setSessionComplete(due.length === 0)
      setMode(due.length > 0 ? "review" : "browse")
    }
  }

  useEffect(() => {
    if (!isOpen) return
    const handleKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose()
    }
    window.addEventListener("keydown", handleKey)
    return () => window.removeEventListener("keydown", handleKey)
  }, [isOpen, onClose])

  const currentWord = mode === "review" ? dueWords[currentIdx] : allWords[currentIdx]
  const totalCards = mode === "review" ? dueWords.length : allWords.length

  const handleRate = useCallback((quality: number) => {
    if (!currentWord) return
    reviewWord(currentWord.word, currentWord.bookId, quality)
    if (currentIdx < dueWords.length - 1) {
      setCurrentIdx(prev => prev + 1)
      setShowAnswer(false)
    } else {
      setSessionComplete(true)
    }
  }, [currentWord, currentIdx, dueWords.length])

  const handleDelete = useCallback(() => {
    if (!currentWord) return
    deleteVocabWord(currentWord.word, currentWord.bookId)
    const updated = mode === "review" ? getDueWords() : getVocabulary()
    if (mode === "review") setDueWords(updated)
    else setAllWords(updated)
    if (currentIdx >= updated.length) setCurrentIdx(Math.max(0, updated.length - 1))
    setShowAnswer(false)
  }, [currentWord, currentIdx, mode])

  if (!isOpen) return null

  return (
    <AnimatePresence>
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
        className="fixed inset-0 bg-background z-[60] flex flex-col"
      >
        {/* Header */}
        <div className="flex items-center justify-between px-5 py-4 border-b border-stone-200/60 dark:border-stone-700/60">
          <div className="flex items-center gap-3">
            <Brain className="w-5 h-5 text-amber-600" />
            <div>
              <h2 className="text-lg font-bold text-stone-900 dark:text-stone-100 font-serif">{t("vocab_flashcards.vocabulary")}</h2>
              <p className="text-xs text-stone-400 dark:text-stone-500">{allWords.length} {t("vocab_flashcards.words_saved")}</p>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <button
              onClick={() => { setMode(mode === "review" ? "browse" : "review"); setCurrentIdx(0); setShowAnswer(false); setSessionComplete(false) }}
              className="px-3 py-1.5 text-xs font-medium rounded-lg bg-stone-100 dark:bg-stone-800 text-stone-600 dark:text-stone-300"
            >
              {mode === "review" ? "Browse All" : "Review Due"}
            </button>
            <button onClick={onClose} aria-label={t("vocab_flashcards.close_flashcards")} className="p-2 rounded-lg hover:bg-stone-100 dark:hover:bg-stone-800">
              <X className="w-5 h-5 text-stone-400" />
            </button>
          </div>
        </div>

        {/* Content */}
        <div className="flex-1 flex items-center justify-center p-6">
          {allWords.length === 0 ? (
            <div className="text-center space-y-4">
              <BookOpen className="w-12 h-12 text-stone-300 dark:text-stone-600 mx-auto" />
              <div>
                <p className="text-lg font-semibold text-stone-700 dark:text-stone-300">{t("vocab_flashcards.no_words_yet")}</p>
                <p className="text-sm text-stone-400 dark:text-stone-500 mt-1 max-w-xs"> {t("vocab_flashcards.select_text_in_the_reader_and")} </p>
              </div>
            </div>
          ) : sessionComplete && mode === "review" ? (
            <div className="text-center space-y-4">
              <motion.div
                initial={{ scale: 0 }}
                animate={{ scale: 1 }}
                transition={{ type: "spring", stiffness: 200 }}
              >
                <Check className="w-16 h-16 text-emerald-500 mx-auto" />
              </motion.div>
              <div>
                <p className="text-xl font-bold text-stone-900 dark:text-stone-100">{t("vocab_flashcards.all_caught_up")}</p>
                <p className="text-sm text-stone-400 dark:text-stone-500 mt-1">{t("vocab_flashcards.no_words_due_for_review_right")}</p>
              </div>
              <button
                onClick={() => { setMode("browse"); setCurrentIdx(0); setShowAnswer(false) }}
                className="px-4 py-2 text-sm font-medium rounded-xl bg-stone-900 dark:bg-stone-100 text-white dark:text-stone-900"
              > {t("vocab_flashcards.browse_all_words")} </button>
            </div>
          ) : currentWord ? (
            <div className="w-full max-w-md">
              {/* Progress */}
              <div className="flex items-center justify-between mb-6">
                <span className="text-xs text-stone-400 dark:text-stone-500 tabular-nums">
                  {currentIdx + 1} {t("common.of")} {totalCards}
                </span>
                <div className="flex-1 mx-4 h-1 bg-stone-200 dark:bg-stone-700 rounded-full overflow-hidden">
                  <div
                    className="h-full bg-amber-500 rounded-full transition-all"
                    style={{ width: `${((currentIdx + 1) / totalCards) * 100}%` }}
                  />
                </div>
              </div>

              {/* Card */}
              <motion.div
                key={`${currentWord.word}-${currentIdx}`}
                initial={{ opacity: 0, x: 20 }}
                animate={{ opacity: 1, x: 0 }}
                className="bg-white dark:bg-stone-900 rounded-2xl border border-stone-200/60 dark:border-stone-700/60 shadow-lg p-8 text-center"
              >
                <p className="text-3xl font-bold text-stone-900 dark:text-stone-100 font-serif mb-2">
                  {currentWord.word}
                </p>
                <p className="text-xs text-stone-400 dark:text-stone-500 italic mb-6"> {t("vocab_flashcards.from")}{currentWord.bookTitle}{t("common.text_2")} </p>

                {showAnswer ? (
                  <motion.div
                    initial={{ opacity: 0, y: 10 }}
                    animate={{ opacity: 1, y: 0 }}
                    className="space-y-4"
                  >
                    {currentWord.definition && (
                      <p className="text-sm text-stone-700 dark:text-stone-300">{currentWord.definition}</p>
                    )}
                    <div className="bg-stone-50 dark:bg-stone-800/50 rounded-xl p-4">
                      <p className="text-sm text-stone-600 dark:text-stone-400 italic leading-relaxed"> {t("common.text")}{currentWord.context}{t("common.text_2")} </p>
                    </div>
                  </motion.div>
                ) : (
                  <button
                    onClick={() => setShowAnswer(true)}
                    className="px-6 py-3 bg-amber-600 hover:bg-amber-700 text-white rounded-xl font-medium transition-colors"
                  > {t("vocab_flashcards.show_context")} </button>
                )}
              </motion.div>

              {/* Actions */}
              {showAnswer && mode === "review" && (
                <motion.div
                  initial={{ opacity: 0, y: 10 }}
                  animate={{ opacity: 1, y: 0 }}
                  className="flex items-center justify-center gap-3 mt-6"
                >
                  <button
                    onClick={() => handleRate(1)}
                    className="flex items-center gap-1.5 px-4 py-2.5 rounded-xl text-sm font-medium bg-red-50 dark:bg-red-900/30 text-red-600 dark:text-red-400 hover:bg-red-100 dark:hover:bg-red-900/50 transition-colors"
                  >
                    <RotateCcw className="w-4 h-4" /> {t("vocab_flashcards.forgot")} </button>
                  <button
                    onClick={() => handleRate(3)}
                    className="flex items-center gap-1.5 px-4 py-2.5 rounded-xl text-sm font-medium bg-amber-50 dark:bg-amber-900/30 text-amber-700 dark:text-amber-400 hover:bg-amber-100 dark:hover:bg-amber-900/50 transition-colors"
                  > {t("vocab_flashcards.hard")} </button>
                  <button
                    onClick={() => handleRate(4)}
                    className="flex items-center gap-1.5 px-4 py-2.5 rounded-xl text-sm font-medium bg-emerald-50 dark:bg-emerald-900/30 text-emerald-700 dark:text-emerald-400 hover:bg-emerald-100 dark:hover:bg-emerald-900/50 transition-colors"
                  > {t("vocab_flashcards.good")} </button>
                  <button
                    onClick={() => handleRate(5)}
                    className="flex items-center gap-1.5 px-4 py-2.5 rounded-xl text-sm font-medium bg-blue-50 dark:bg-blue-900/30 text-blue-700 dark:text-blue-400 hover:bg-blue-100 dark:hover:bg-blue-900/50 transition-colors"
                  > {t("vocab_flashcards.easy")} <ChevronRight className="w-4 h-4" />
                  </button>
                </motion.div>
              )}

              {showAnswer && mode === "browse" && (
                <motion.div
                  initial={{ opacity: 0, y: 10 }}
                  animate={{ opacity: 1, y: 0 }}
                  className="flex items-center justify-center gap-3 mt-6"
                >
                  <button
                    onClick={handleDelete}
                    className="flex items-center gap-1.5 px-4 py-2.5 rounded-xl text-sm font-medium bg-stone-100 dark:bg-stone-800 text-stone-500 dark:text-stone-400 hover:bg-red-50 dark:hover:bg-red-900/30 hover:text-red-500 transition-colors"
                  >
                    <Trash2 className="w-4 h-4" /> {t("common.remove")} </button>
                  <button
                    onClick={() => { setCurrentIdx(prev => Math.min(prev + 1, totalCards - 1)); setShowAnswer(false) }}
                    disabled={currentIdx >= totalCards - 1}
                    className="flex items-center gap-1.5 px-6 py-2.5 rounded-xl text-sm font-medium bg-stone-900 dark:bg-stone-100 text-white dark:text-stone-900 disabled:opacity-30 transition-colors"
                  > {t("common.next")} <ChevronRight className="w-4 h-4" />
                  </button>
                </motion.div>
              )}
            </div>
          ) : null}
        </div>
      </motion.div>
    </AnimatePresence>
  )
}
