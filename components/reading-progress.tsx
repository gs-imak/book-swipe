"use client"

import { useState, useEffect } from "react"
import { Button } from "@/components/ui/button"
import { ReadingProgress, ReadingGoals, getReadingProgress, updateReadingProgress, removeFromReading, getReadingGoals, updateReadingGoals } from "@/lib/storage"
import { BookOpen, Clock, Target, Flame, Plus, Minus, Play, Pause, CheckCircle, X } from "lucide-react"
import { motion } from "framer-motion"
import { BookCover } from "@/components/book-cover"

interface ReadingProgressProps {
  onStartReading?: (bookId: string) => void
}

export function ReadingProgressTracker({ onStartReading }: ReadingProgressProps) {
  const [readingBooks, setReadingBooks] = useState<ReadingProgress[]>([])
  const [goals, setGoals] = useState<ReadingGoals | null>(null)

  useEffect(() => {
    setReadingBooks(getReadingProgress())
    setGoals(getReadingGoals())
  }, [])

  const handleProgressUpdate = (bookId: string, newPage: number) => {
    const book = readingBooks.find(b => b.bookId === bookId)
    if (!book) return

    const isCompleted = newPage >= book.totalPages

    updateReadingProgress(bookId, {
      currentPage: newPage,
      lastReadDate: new Date().toISOString(),
      status: isCompleted ? "completed" : "reading"
    })

    if (isCompleted && book.status !== "completed") {
      const currentGoals = getReadingGoals()
      updateReadingGoals({
        booksCompleted: currentGoals.booksCompleted + 1,
        pagesRead: currentGoals.pagesRead + book.totalPages,
        lastReadDate: new Date().toISOString()
      })
      setGoals(getReadingGoals())
    }

    setReadingBooks(getReadingProgress())
  }

  const handleRemoveBook = (bookId: string) => {
    removeFromReading(bookId)
    setReadingBooks(getReadingProgress())
  }

  const handleStatusToggle = (bookId: string) => {
    const book = readingBooks.find(b => b.bookId === bookId)
    if (!book) return

    const newStatus = book.status === "reading" ? "paused" : "reading"
    updateReadingProgress(bookId, {
      status: newStatus,
      lastReadDate: new Date().toISOString()
    })
    setReadingBooks(getReadingProgress())
  }

  const formatTimeSpent = (minutes: number) => {
    const hours = Math.floor(minutes / 60)
    const mins = minutes % 60
    return hours > 0 ? `${hours}h ${mins}m` : `${mins}m`
  }

  const currentlyReading = readingBooks.filter(book => book.status === "reading")
  const pausedBooks = readingBooks.filter(book => book.status === "paused")
  const hasReadingActivity = readingBooks.length > 0 || (goals && goals.booksCompleted > 0)

  return (
    <div className="space-y-4">
      {/* Reading Goals */}
      {goals && hasReadingActivity && (
        <div className="bg-white rounded-xl p-4 border border-stone-200/60 shadow-sm">
          <div className="flex items-center gap-2 mb-3">
            <Target className="w-4 h-4 text-amber-600" />
            <h3 className="text-sm font-semibold text-stone-900">Reading Goals {goals.currentYear}</h3>
          </div>

          <div className="grid grid-cols-4 gap-3">
            <div className="text-center">
              <p className="text-lg font-bold text-stone-900">{goals.booksCompleted}</p>
              <p className="text-[11px] text-stone-400">of {goals.yearlyTarget}</p>
              <div className="w-full bg-stone-100 rounded-full h-1 mt-1.5">
                <div
                  className="bg-amber-500 h-1 rounded-full transition-all"
                  style={{ width: `${Math.min((goals.booksCompleted / goals.yearlyTarget) * 100, 100)}%` }}
                />
              </div>
            </div>
            <div className="text-center">
              <p className="text-lg font-bold text-stone-900">{goals.pagesRead}</p>
              <p className="text-[11px] text-stone-400">pages</p>
            </div>
            <div className="text-center">
              <p className="text-lg font-bold text-stone-900">{formatTimeSpent(goals.timeSpentMinutes)}</p>
              <p className="text-[11px] text-stone-400">read time</p>
            </div>
            <div className="text-center">
              <div className="flex items-center justify-center gap-1">
                <Flame className="w-4 h-4 text-amber-500" />
                <p className="text-lg font-bold text-stone-900">{goals.streak}</p>
              </div>
              <p className="text-[11px] text-stone-400">streak</p>
            </div>
          </div>
        </div>
      )}

      {/* Currently Reading */}
      {currentlyReading.length > 0 && (
        <div className="bg-white rounded-xl p-4 border border-stone-200/60 shadow-sm">
          <div className="flex items-center gap-2 mb-3">
            <BookOpen className="w-4 h-4 text-emerald-600" />
            <h3 className="text-sm font-semibold text-stone-900">Currently Reading</h3>
            <span className="text-[11px] bg-emerald-50 text-emerald-700 px-1.5 py-0.5 rounded-full font-medium">
              {currentlyReading.length}
            </span>
          </div>

          <div className="space-y-3">
            {currentlyReading.map((book) => {
              const progressPercent = (book.currentPage / book.totalPages) * 100
              return (
                <div key={book.bookId} className="flex gap-3 p-3 bg-stone-50 rounded-lg">
                  <div className="relative w-12 h-16 flex-shrink-0">
                    <BookCover
                      src={book.book.cover}
                      alt={book.book.title}
                      fill
                      className="object-cover rounded"
                      sizes="48px"
                    />
                  </div>

                  <div className="flex-1 min-w-0">
                    <h4 className="font-medium text-sm text-stone-900 line-clamp-1">{book.book.title}</h4>
                    <p className="text-xs text-stone-500 mb-2">{book.book.author}</p>

                    <div className="flex items-center justify-between text-xs text-stone-400 mb-1">
                      <span>{book.currentPage} / {book.totalPages}p</span>
                      <span>{Math.round(progressPercent)}%</span>
                    </div>
                    <div className="w-full bg-stone-200 rounded-full h-1.5">
                      <div
                        className="bg-emerald-500 h-1.5 rounded-full transition-all"
                        style={{ width: `${progressPercent}%` }}
                      />
                    </div>

                    <div className="flex items-center gap-1.5 mt-2">
                      <button
                        onClick={() => handleProgressUpdate(book.bookId, Math.max(0, book.currentPage - 10))}
                        className="w-7 h-7 rounded-md bg-white border border-stone-200 flex items-center justify-center hover:bg-stone-50 transition-colors"
                      >
                        <Minus className="w-3 h-3 text-stone-500" />
                      </button>
                      <button
                        onClick={() => handleProgressUpdate(book.bookId, Math.min(book.totalPages, book.currentPage + 10))}
                        className="w-7 h-7 rounded-md bg-white border border-stone-200 flex items-center justify-center hover:bg-stone-50 transition-colors"
                      >
                        <Plus className="w-3 h-3 text-stone-500" />
                      </button>
                      <button
                        onClick={() => handleStatusToggle(book.bookId)}
                        className="w-7 h-7 rounded-md bg-white border border-stone-200 flex items-center justify-center hover:bg-stone-50 transition-colors"
                      >
                        <Pause className="w-3 h-3 text-stone-500" />
                      </button>
                      <button
                        onClick={() => handleProgressUpdate(book.bookId, book.totalPages)}
                        className="h-7 px-2 rounded-md bg-white border border-stone-200 flex items-center gap-1 hover:bg-stone-50 transition-colors text-xs text-stone-600"
                      >
                        <CheckCircle className="w-3 h-3" />
                        Done
                      </button>
                      <button
                        onClick={() => handleRemoveBook(book.bookId)}
                        className="w-7 h-7 rounded-md bg-white border border-stone-200 flex items-center justify-center hover:bg-red-50 hover:border-red-200 transition-colors ml-auto"
                      >
                        <X className="w-3 h-3 text-stone-400 hover:text-red-500" />
                      </button>
                    </div>
                  </div>
                </div>
              )
            })}
          </div>
        </div>
      )}

      {/* Paused */}
      {pausedBooks.length > 0 && (
        <div className="bg-white rounded-xl p-4 border border-stone-200/60 shadow-sm">
          <div className="flex items-center gap-2 mb-3">
            <Pause className="w-4 h-4 text-amber-600" />
            <h3 className="text-sm font-semibold text-stone-900">Paused</h3>
          </div>

          <div className="space-y-2">
            {pausedBooks.map((book) => {
              const progressPercent = (book.currentPage / book.totalPages) * 100
              return (
                <div key={book.bookId} className="flex items-center gap-3 p-2.5 bg-stone-50 rounded-lg">
                  <div className="relative w-8 h-11 flex-shrink-0">
                    <BookCover
                      src={book.book.cover}
                      alt={book.book.title}
                      fill
                      className="object-cover rounded"
                      sizes="32px"
                    />
                  </div>
                  <div className="flex-1 min-w-0">
                    <h4 className="font-medium text-xs text-stone-900 line-clamp-1">{book.book.title}</h4>
                    <p className="text-[11px] text-stone-400">{Math.round(progressPercent)}% done</p>
                  </div>
                  <div className="flex gap-1">
                    <button
                      onClick={() => handleStatusToggle(book.bookId)}
                      className="h-7 px-2 rounded-md bg-white border border-stone-200 flex items-center gap-1 hover:bg-stone-50 transition-colors text-xs text-stone-600"
                    >
                      <Play className="w-2.5 h-2.5" />
                      Resume
                    </button>
                    <button
                      onClick={() => handleRemoveBook(book.bookId)}
                      className="w-7 h-7 rounded-md bg-white border border-stone-200 flex items-center justify-center hover:bg-red-50 transition-colors"
                    >
                      <X className="w-3 h-3 text-stone-400" />
                    </button>
                  </div>
                </div>
              )
            })}
          </div>
        </div>
      )}

      {/* Empty State */}
      {readingBooks.length === 0 && (
        <div className="text-center py-8 bg-white rounded-xl border border-stone-200/60 shadow-sm">
          <BookOpen className="w-10 h-10 text-stone-300 mx-auto mb-3" />
          <h3 className="text-sm font-semibold text-stone-700 mb-1">No books in progress</h3>
          <p className="text-xs text-stone-400 mb-4">Start tracking your reading journey</p>
          <button
            onClick={() => onStartReading?.("")}
            className="h-9 px-5 bg-stone-900 hover:bg-stone-800 text-white text-sm font-medium rounded-xl transition-colors"
          >
            Find Books to Read
          </button>
        </div>
      )}
    </div>
  )
}
