"use client"

import { useState, useEffect } from "react"
import { motion, AnimatePresence } from "framer-motion"
import { X, Star, Heart, MessageSquare, FileText, Calendar, Clock, BookOpen } from "lucide-react"
import { Button } from "./ui/button"
import { Book } from "@/lib/book-data"
import { BookReview, getBookReview } from "@/lib/storage"
import { QuickReview } from "./quick-review"
import { ReviewDisplay } from "./review-display"
import { BookNotes } from "./book-notes"

interface BookDetailModalProps {
  book: Book | null
  isOpen: boolean
  onClose: () => void
  onStartReading?: (book: Book) => void
}

export function BookDetailModal({ book, isOpen, onClose, onStartReading }: BookDetailModalProps) {
  const [activeTab, setActiveTab] = useState<"overview" | "review" | "notes">("overview")
  const [existingReview, setExistingReview] = useState<BookReview | null>(null)
  const [isEditingReview, setIsEditingReview] = useState(false)

  useEffect(() => {
    if (book) {
      const review = getBookReview(book.id)
      setExistingReview(review)
      
      // Set default tab based on existing content
      if (review) {
        setActiveTab("overview")
      } else {
        setActiveTab("overview")
      }
    }
  }, [book])

  if (!book || !isOpen) return null

  const handleReviewSaved = (review: BookReview) => {
    setExistingReview(review)
    setIsEditingReview(false)
    setActiveTab("overview")
  }

  const handleEditReview = () => {
    setIsEditingReview(true)
    setActiveTab("review")
  }

  const handleDeleteReview = () => {
    setExistingReview(null)
    setActiveTab("overview")
  }

  return (
    <AnimatePresence>
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
        className="fixed inset-0 bg-black/50 backdrop-blur-sm z-50 flex items-center justify-center p-4"
        onClick={onClose}
      >
        <motion.div
          initial={{ opacity: 0, scale: 0.95, y: 20 }}
          animate={{ opacity: 1, scale: 1, y: 0 }}
          exit={{ opacity: 0, scale: 0.95, y: 20 }}
          className="bg-white rounded-2xl shadow-2xl max-w-4xl w-full max-h-[90vh] overflow-hidden"
          onClick={(e) => e.stopPropagation()}
        >
          {/* Header */}
          <div className="bg-gradient-to-r from-purple-50 to-pink-50 p-6 border-b">
            <div className="flex items-start gap-6">
              <img
                src={book.cover}
                alt={book.title}
                className="w-24 h-36 object-cover rounded-lg shadow-lg"
              />
              
              <div className="flex-1 space-y-3">
                <div className="flex items-start justify-between">
                  <div>
                    <h2 className="text-2xl font-bold text-gray-900 leading-tight">
                      {book.title}
                    </h2>
                    <p className="text-lg text-gray-600">{book.author}</p>
                  </div>
                  
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={onClose}
                    className="text-gray-500 hover:text-gray-700"
                  >
                    <X className="w-5 h-5" />
                  </Button>
                </div>
                
                <div className="flex items-center gap-6 text-sm text-gray-600">
                  <div className="flex items-center gap-1">
                    <BookOpen className="w-4 h-4" />
                    <span>{book.pages} pages</span>
                  </div>
                  <div className="flex items-center gap-1">
                    <Clock className="w-4 h-4" />
                    <span>{book.readingTime}</span>
                  </div>
                  <div className="flex items-center gap-1">
                    <Star className="w-4 h-4 text-yellow-500 fill-yellow-500" />
                    <span>{book.rating}</span>
                  </div>
                </div>
                
                <div className="flex items-center gap-3">
                  {onStartReading && (
                    <Button onClick={() => onStartReading(book)} className="px-6">
                      <BookOpen className="w-4 h-4 mr-2" />
                      Start Reading
                    </Button>
                  )}
                  
                  {!existingReview && (
                    <Button
                      variant="outline"
                      onClick={() => {
                        setIsEditingReview(true)
                        setActiveTab("review")
                      }}
                    >
                      <MessageSquare className="w-4 h-4 mr-2" />
                      Write Review
                    </Button>
                  )}
                </div>
              </div>
            </div>
          </div>

          {/* Tabs */}
          <div className="border-b">
            <div className="flex">
              <button
                onClick={() => setActiveTab("overview")}
                className={`px-6 py-4 text-sm font-medium border-b-2 transition-colors ${
                  activeTab === "overview"
                    ? "border-purple-500 text-purple-600"
                    : "border-transparent text-gray-500 hover:text-gray-700"
                }`}
              >
                Overview
              </button>
              <button
                onClick={() => setActiveTab("review")}
                className={`px-6 py-4 text-sm font-medium border-b-2 transition-colors ${
                  activeTab === "review"
                    ? "border-purple-500 text-purple-600"
                    : "border-transparent text-gray-500 hover:text-gray-700"
                }`}
              >
                Review
                {existingReview && (
                  <span className="ml-2 w-2 h-2 bg-purple-500 rounded-full inline-block"></span>
                )}
              </button>
              <button
                onClick={() => setActiveTab("notes")}
                className={`px-6 py-4 text-sm font-medium border-b-2 transition-colors ${
                  activeTab === "notes"
                    ? "border-purple-500 text-purple-600"
                    : "border-transparent text-gray-500 hover:text-gray-700"
                }`}
              >
                Notes & Highlights
              </button>
            </div>
          </div>

          {/* Content */}
          <div className="p-6 overflow-y-auto max-h-[60vh]">
            {activeTab === "overview" && (
              <div className="space-y-6">
                {/* Book Description */}
                <div>
                  <h3 className="text-lg font-semibold text-gray-900 mb-3">About this book</h3>
                  <p className="text-gray-700 leading-relaxed">{book.description}</p>
                </div>

                {/* Genres/Moods */}
                <div>
                  <h3 className="text-lg font-semibold text-gray-900 mb-3">Genres & Moods</h3>
                  <div className="flex flex-wrap gap-2">
                    <span className="px-3 py-1 bg-purple-100 text-purple-800 rounded-full text-sm font-medium">
                      {book.genre}
                    </span>
                    {book.mood.map((mood) => (
                      <span
                        key={mood}
                        className="px-3 py-1 bg-blue-100 text-blue-800 rounded-full text-sm font-medium"
                      >
                        {mood}
                      </span>
                    ))}
                  </div>
                </div>

                {/* Existing Review Summary */}
                {existingReview && (
                  <div>
                    <div className="flex items-center justify-between mb-3">
                      <h3 className="text-lg font-semibold text-gray-900">Your Review</h3>
                      <Button variant="outline" size="sm" onClick={handleEditReview}>
                        Edit Review
                      </Button>
                    </div>
                    <ReviewDisplay
                      review={existingReview}
                      onEdit={handleEditReview}
                      onDelete={handleDeleteReview}
                      compact
                    />
                  </div>
                )}

                {/* Notes Preview */}
                <div>
                  <h3 className="text-lg font-semibold text-gray-900 mb-3">Notes & Highlights</h3>
                  <BookNotes bookId={book.id} compact />
                </div>
              </div>
            )}

            {activeTab === "review" && (
              <div>
                {isEditingReview || !existingReview ? (
                  <QuickReview
                    book={book}
                    onReviewSaved={handleReviewSaved}
                    existingReview={existingReview}
                  />
                ) : (
                  <ReviewDisplay
                    review={existingReview}
                    onEdit={handleEditReview}
                    onDelete={handleDeleteReview}
                  />
                )}
              </div>
            )}

            {activeTab === "notes" && (
              <BookNotes bookId={book.id} />
            )}
          </div>
        </motion.div>
      </motion.div>
    </AnimatePresence>
  )
}




