"use client"

import { useState, useEffect } from "react"
import { Button } from "@/components/ui/button"
import { Progress } from "@/components/ui/progress"
import { ReadingProgress, ReadingGoals, getReadingProgress, updateReadingProgress, removeFromReading, getReadingGoals, updateReadingGoals } from "@/lib/storage"
import { BookOpen, Clock, Target, Flame, Plus, Minus, Play, Pause, CheckCircle, X } from "lucide-react"
import { motion, AnimatePresence } from "framer-motion"
import Image from "next/image"

interface ReadingProgressProps {
  onStartReading?: (bookId: string) => void
}

export function ReadingProgressTracker({ onStartReading }: ReadingProgressProps) {
  const [readingBooks, setReadingBooks] = useState<ReadingProgress[]>([])
  const [goals, setGoals] = useState<ReadingGoals | null>(null)
  const [selectedBook, setSelectedBook] = useState<string | null>(null)

  useEffect(() => {
    setReadingBooks(getReadingProgress())
    setGoals(getReadingGoals())
  }, [])

  const handleProgressUpdate = (bookId: string, newPage: number) => {
    const book = readingBooks.find(b => b.bookId === bookId)
    if (!book) return

    const progressPercent = (newPage / book.totalPages) * 100
    const isCompleted = newPage >= book.totalPages

    updateReadingProgress(bookId, {
      currentPage: newPage,
      lastReadDate: new Date().toISOString(),
      status: isCompleted ? "completed" : "reading"
    })

    // Update goals if book is completed
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
    if (hours > 0) {
      return `${hours}h ${mins}m`
    }
    return `${mins}m`
  }

  const getProgressColor = (percentage: number) => {
    if (percentage < 25) return "from-red-400 to-red-500"
    if (percentage < 50) return "from-orange-400 to-orange-500"
    if (percentage < 75) return "from-yellow-400 to-yellow-500"
    return "from-green-400 to-green-500"
  }

  const currentlyReading = readingBooks.filter(book => book.status === "reading")
  const pausedBooks = readingBooks.filter(book => book.status === "paused")
  const completedBooks = readingBooks.filter(book => book.status === "completed")

  // Only show goals if user has any reading activity
  const hasReadingActivity = readingBooks.length > 0 || (goals && goals.booksCompleted > 0)

  return (
    <div className="space-y-6">
      {/* Reading Goals Overview - Only show if user has reading activity */}
      {goals && hasReadingActivity && (
        <motion.div 
          className="bg-gradient-to-r from-purple-50 to-pink-50 rounded-3xl p-6 border border-purple-100"
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
        >
          <div className="flex items-center gap-3 mb-4">
            <div className="p-2 bg-gradient-to-br from-purple-400 to-pink-400 rounded-xl">
              <Target className="w-5 h-5 text-white" />
            </div>
            <h3 className="text-lg font-bold text-gray-800">Reading Goals {goals.currentYear}</h3>
          </div>
          
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            <div className="text-center">
              <div className="text-2xl font-bold text-purple-600">{goals.booksCompleted}</div>
              <div className="text-sm text-gray-600">of {goals.yearlyTarget} books</div>
              <div className="w-full bg-gray-200 rounded-full h-2 mt-2">
                <div 
                  className="bg-gradient-to-r from-purple-400 to-pink-400 h-2 rounded-full transition-all duration-500"
                  style={{ width: `${Math.min((goals.booksCompleted / goals.yearlyTarget) * 100, 100)}%` }}
                />
              </div>
            </div>
            <div className="text-center">
              <div className="text-2xl font-bold text-green-600">{goals.pagesRead}</div>
              <div className="text-sm text-gray-600">pages read</div>
            </div>
            <div className="text-center">
              <div className="text-2xl font-bold text-blue-600">{formatTimeSpent(goals.timeSpentMinutes)}</div>
              <div className="text-sm text-gray-600">time spent</div>
            </div>
            <div className="text-center">
              <div className="text-2xl font-bold text-orange-600 flex items-center justify-center gap-1">
                <Flame className="w-6 h-6" />
                {goals.streak}
              </div>
              <div className="text-sm text-gray-600">day streak</div>
            </div>
          </div>
        </motion.div>
      )}

      {/* Currently Reading */}
      {currentlyReading.length > 0 && (
        <motion.div 
          className="bg-white/90 backdrop-blur-xl rounded-3xl p-6 shadow-lg border border-white/20"
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.1 }}
        >
          <div className="flex items-center gap-3 mb-4">
            <div className="p-2 bg-gradient-to-br from-green-400 to-emerald-500 rounded-xl">
              <BookOpen className="w-5 h-5 text-white" />
            </div>
            <h3 className="text-lg font-bold text-gray-800">Currently Reading</h3>
            <span className="bg-green-100 text-green-700 px-2 py-1 rounded-full text-xs font-medium">
              {currentlyReading.length}
            </span>
          </div>

          <div className="space-y-4">
            {currentlyReading.map((book) => {
              const progressPercent = (book.currentPage / book.totalPages) * 100
              return (
                <motion.div
                  key={book.bookId}
                  className="flex gap-4 p-4 bg-gray-50 rounded-2xl hover:bg-gray-100 transition-colors"
                  initial={{ opacity: 0, x: -20 }}
                  animate={{ opacity: 1, x: 0 }}
                >
                  <div className="relative w-16 h-20 flex-shrink-0">
                    <Image
                      src={book.book.cover}
                      alt={book.book.title}
                      fill
                      className="object-cover rounded-lg"
                      sizes="64px"
                    />
                  </div>
                  
                  <div className="flex-1 min-w-0">
                    <h4 className="font-semibold text-gray-900 line-clamp-1">{book.book.title}</h4>
                    <p className="text-sm text-gray-600 mb-2">{book.book.author}</p>
                    
                    <div className="space-y-2">
                      <div className="flex items-center justify-between text-sm text-gray-600">
                        <span>{book.currentPage} of {book.totalPages} pages</span>
                        <span>{Math.round(progressPercent)}%</span>
                      </div>
                      
                      <div className="w-full bg-gray-200 rounded-full h-2">
                        <div 
                          className={`bg-gradient-to-r ${getProgressColor(progressPercent)} h-2 rounded-full transition-all duration-500`}
                          style={{ width: `${progressPercent}%` }}
                        />
                      </div>
                    </div>

                    <div className="flex items-center gap-2 mt-3">
                      <Button
                        size="sm"
                        variant="outline"
                        onClick={() => handleProgressUpdate(book.bookId, Math.max(0, book.currentPage - 10))}
                        className="h-8 w-8 p-0"
                      >
                        <Minus className="w-3 h-3" />
                      </Button>
                      
                      <Button
                        size="sm"
                        variant="outline"
                        onClick={() => handleProgressUpdate(book.bookId, Math.min(book.totalPages, book.currentPage + 10))}
                        className="h-8 w-8 p-0"
                      >
                        <Plus className="w-3 h-3" />
                      </Button>

                      <Button
                        size="sm"
                        variant="outline"
                        onClick={() => handleStatusToggle(book.bookId)}
                        className="h-8 w-8 p-0"
                      >
                        <Pause className="w-3 h-3" />
                      </Button>

                      <Button
                        size="sm"
                        variant="outline"
                        onClick={() => handleProgressUpdate(book.bookId, book.totalPages)}
                        className="h-8 px-3 text-xs"
                      >
                        <CheckCircle className="w-3 h-3 mr-1" />
                        Done
                      </Button>

                      <Button
                        size="sm"
                        variant="outline"
                        onClick={() => handleRemoveBook(book.bookId)}
                        className="h-8 w-8 p-0 text-red-500 hover:text-red-600"
                      >
                        <X className="w-3 h-3" />
                      </Button>
                    </div>
                  </div>
                </motion.div>
              )
            })}
          </div>
        </motion.div>
      )}

      {/* Paused Books */}
      {pausedBooks.length > 0 && (
        <motion.div 
          className="bg-white/90 backdrop-blur-xl rounded-3xl p-6 shadow-lg border border-white/20"
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.2 }}
        >
          <div className="flex items-center gap-3 mb-4">
            <div className="p-2 bg-gradient-to-br from-orange-400 to-red-400 rounded-xl">
              <Pause className="w-5 h-5 text-white" />
            </div>
            <h3 className="text-lg font-bold text-gray-800">Paused</h3>
            <span className="bg-orange-100 text-orange-700 px-2 py-1 rounded-full text-xs font-medium">
              {pausedBooks.length}
            </span>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {pausedBooks.map((book) => {
              const progressPercent = (book.currentPage / book.totalPages) * 100
              return (
                <motion.div
                  key={book.bookId}
                  className="flex gap-3 p-3 bg-gray-50 rounded-xl hover:bg-gray-100 transition-colors"
                  initial={{ opacity: 0, scale: 0.9 }}
                  animate={{ opacity: 1, scale: 1 }}
                >
                  <div className="relative w-12 h-16 flex-shrink-0">
                    <Image
                      src={book.book.cover}
                      alt={book.book.title}
                      fill
                      className="object-cover rounded"
                      sizes="48px"
                    />
                  </div>
                  
                  <div className="flex-1 min-w-0">
                    <h4 className="font-medium text-gray-900 text-sm line-clamp-1">{book.book.title}</h4>
                    <p className="text-xs text-gray-600 mb-1">{book.book.author}</p>
                    <div className="text-xs text-gray-500 mb-2">{Math.round(progressPercent)}% complete</div>
                    
                    <div className="flex gap-1">
                      <Button
                        size="sm"
                        variant="outline"
                        onClick={() => handleStatusToggle(book.bookId)}
                        className="h-6 px-2 text-xs"
                      >
                        <Play className="w-2 h-2 mr-1" />
                        Resume
                      </Button>
                      <Button
                        size="sm"
                        variant="outline"
                        onClick={() => handleRemoveBook(book.bookId)}
                        className="h-6 w-6 p-0 text-red-500"
                      >
                        <X className="w-2 h-2" />
                      </Button>
                    </div>
                  </div>
                </motion.div>
              )
            })}
          </div>
        </motion.div>
      )}

      {/* Empty State */}
      {readingBooks.length === 0 && (
        <motion.div 
          className="text-center py-12 bg-white/60 backdrop-blur-xl rounded-3xl border border-white/20"
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
        >
          <BookOpen className="w-12 h-12 text-gray-300 mx-auto mb-4" />
          <h3 className="text-lg font-semibold text-gray-600 mb-2">No books in progress</h3>
          <p className="text-gray-500 mb-4">Start tracking your reading journey!</p>
          <Button 
            onClick={() => onStartReading?.("")} 
            className="px-6 py-2 bg-gradient-to-r from-purple-500 to-pink-500 hover:from-purple-600 hover:to-pink-600 text-white rounded-xl"
          >
            Find Books to Read
          </Button>
        </motion.div>
      )}
    </div>
  )
}
