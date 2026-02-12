"use client"

import { useState, useEffect } from "react"
import { motion } from "framer-motion"
import { ArrowRight, RefreshCw } from "lucide-react"
import { Book } from "@/lib/book-data"
import { generateChainFromLiked, type BookChain } from "@/lib/book-chains"
import { BookCover } from "@/components/book-cover"

interface ReadingPathProps {
  onBookClick?: (book: Book) => void
}

export function ReadingPath({ onBookClick }: ReadingPathProps) {
  const [chains, setChains] = useState<BookChain[]>([])
  const [loading, setLoading] = useState(true)

  const loadChains = () => {
    setLoading(true)
    // Use setTimeout so the UI doesn't block
    setTimeout(() => {
      const result = generateChainFromLiked(2)
      setChains(result)
      setLoading(false)
    }, 50)
  }

  useEffect(() => {
    loadChains()
  }, [])

  if (loading) return null
  if (chains.length === 0) return null

  return (
    <motion.div
      initial={{ opacity: 0, y: 12 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.4, delay: 0.15 }}
    >
      <div className="flex items-center justify-between mb-3">
        <h2 className="text-lg font-semibold text-stone-900 font-serif">Reading Paths</h2>
        <button
          onClick={loadChains}
          className="p-1.5 rounded-lg text-stone-400 hover:text-stone-600 hover:bg-stone-100 transition-all"
          title="Refresh paths"
        >
          <RefreshCw className="w-4 h-4" />
        </button>
      </div>

      <div className="space-y-4">
        {chains.map((chain, ci) => (
          <div key={`${chain.startBook.id}-${ci}`} className="bg-white rounded-2xl p-4 border border-stone-200/60 shadow-sm">
            <p className="text-xs font-medium text-amber-700 mb-3">
              {chain.theme} journey
            </p>

            <div className="flex items-center gap-1 overflow-x-auto hide-scrollbar pb-1">
              {/* Start book */}
              <button
                onClick={() => onBookClick?.(chain.startBook)}
                className="flex-shrink-0 group"
              >
                <div className="relative w-14 h-20 sm:w-16 sm:h-24 rounded-lg overflow-hidden shadow-sm border border-stone-200/40 group-hover:shadow-md transition-shadow">
                  <BookCover
                    src={chain.startBook.cover}
                    fallbackSrc={chain.startBook.coverFallback}
                    alt={chain.startBook.title}
                    fill
                    className="object-contain"
                    sizes="128px"
                  />
                </div>
                <p className="text-[10px] text-stone-600 mt-1 w-14 sm:w-16 truncate text-center font-medium group-hover:text-amber-700 transition-colors">
                  {chain.startBook.title}
                </p>
              </button>

              {/* Chain links */}
              {chain.chain.map((book, i) => (
                <div key={book.id} className="flex items-center gap-1 flex-shrink-0">
                  <ArrowRight className="w-3.5 h-3.5 text-amber-400 flex-shrink-0" />
                  <button
                    onClick={() => onBookClick?.(book)}
                    className="flex-shrink-0 group"
                  >
                    <div className="relative w-14 h-20 sm:w-16 sm:h-24 rounded-lg overflow-hidden shadow-sm border border-stone-200/40 group-hover:shadow-md transition-shadow">
                      <BookCover
                        src={book.cover}
                        fallbackSrc={book.coverFallback}
                        alt={book.title}
                        fill
                        className="object-contain"
                        sizes="128px"
                      />
                    </div>
                    <p className="text-[10px] text-stone-600 mt-1 w-14 sm:w-16 truncate text-center font-medium group-hover:text-amber-700 transition-colors">
                      {book.title}
                    </p>
                  </button>
                </div>
              ))}
            </div>
          </div>
        ))}
      </div>
    </motion.div>
  )
}
