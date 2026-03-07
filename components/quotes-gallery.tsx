"use client"

import { useState, useEffect } from "react"
import { motion } from "framer-motion"
import { Quote } from "lucide-react"
import { getBookNotes, getLikedBooks } from "@/lib/storage"
import { Book } from "@/lib/book-data"

interface QuoteEntry {
  id: string
  content: string
  page?: number
  bookId: string
  book?: Book
}

export function QuotesGallery() {
  const [quotes, setQuotes] = useState<QuoteEntry[]>([])

  useEffect(() => {
    const allNotes = getBookNotes()
    const quoteNotes = allNotes.filter((n) => n.type === "quote")
    if (quoteNotes.length === 0) {
      setQuotes([])
      return
    }
    const books = getLikedBooks()
    const bookMap: Record<string, Book> = {}
    books.forEach((b) => { bookMap[b.id] = b })
    setQuotes(
      quoteNotes.map((n) => ({
        id: n.id,
        content: n.content,
        page: n.page,
        bookId: n.bookId,
        book: bookMap[n.bookId],
      }))
    )
  }, [])

  if (quotes.length === 0) return null

  return (
    <motion.div
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ type: "spring", stiffness: 300, damping: 28 }}
      className="space-y-3"
    >
      <div className="flex items-center gap-2">
        <Quote className="w-4 h-4 text-teal-600" />
        <h3 className="text-sm font-semibold text-stone-900 font-serif">Saved Quotes</h3>
        <span className="text-[11px] bg-teal-50 text-teal-700 px-1.5 py-0.5 rounded-full font-medium">
          {quotes.length}
        </span>
      </div>

      <div className="space-y-2.5">
        {quotes.map((q, i) => (
          <motion.div
            key={q.id}
            initial={{ opacity: 0, y: 6 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: Math.min(i * 0.05, 0.25), type: "spring", stiffness: 300, damping: 28 }}
            className="bg-teal-50 border border-teal-200/60 rounded-xl p-4"
          >
            <div className="flex gap-3">
              <Quote className="w-3.5 h-3.5 text-teal-400 flex-shrink-0 mt-1" />
              <div className="space-y-1.5 min-w-0">
                <p className="text-sm text-stone-700 leading-relaxed italic">{q.content}</p>
                {q.book && (
                  <p className="text-[11px] text-stone-400">
                    — {q.book.title}
                    {q.page ? `, p.\u202f${q.page}` : ""}
                  </p>
                )}
              </div>
            </div>
          </motion.div>
        ))}
      </div>
    </motion.div>
  )
}
