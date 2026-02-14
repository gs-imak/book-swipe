"use client"

import { useState, useEffect } from "react"
import { motion, AnimatePresence } from "framer-motion"
import { X, Check } from "lucide-react"
import {
  getShelves,
  getShelvesForBook,
  assignBookToShelf,
  removeBookFromShelf,
  type Shelf,
} from "@/lib/storage"
import { useToast } from "./toast-provider"

interface ShelfPickerProps {
  bookId: string
  isOpen: boolean
  onClose: () => void
}

export function ShelfPicker({ bookId, isOpen, onClose }: ShelfPickerProps) {
  const [shelves, setShelves] = useState<Shelf[]>([])
  const [assignedIds, setAssignedIds] = useState<string[]>([])
  const { showToast } = useToast()

  useEffect(() => {
    if (isOpen) {
      setShelves(getShelves())
      setAssignedIds(getShelvesForBook(bookId))
    }
  }, [isOpen, bookId])

  if (!isOpen) return null

  const toggle = (shelfId: string) => {
    const shelf = shelves.find(s => s.id === shelfId)
    if (assignedIds.includes(shelfId)) {
      removeBookFromShelf(bookId, shelfId)
      setAssignedIds(assignedIds.filter(id => id !== shelfId))
      showToast(`Removed from ${shelf?.name || "shelf"}`, "info")
    } else {
      assignBookToShelf(bookId, shelfId)
      setAssignedIds([...assignedIds, shelfId])
      showToast(`Added to ${shelf?.name || "shelf"}`)
    }
  }

  return (
    <AnimatePresence>
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
        className="fixed inset-0 bg-black/30 backdrop-blur-sm z-[60] flex items-end sm:items-center justify-center"
        onClick={onClose}
      >
        <motion.div
          initial={{ opacity: 0, y: 60 }}
          animate={{ opacity: 1, y: 0 }}
          exit={{ opacity: 0, y: 60 }}
          transition={{ type: "spring", stiffness: 300, damping: 30 }}
          className="bg-background rounded-t-2xl sm:rounded-2xl shadow-2xl max-w-sm w-full border border-stone-200/60 overflow-hidden"
          onClick={(e) => e.stopPropagation()}
        >
          <div className="flex items-center justify-between p-4 pb-2">
            <h3 className="text-base font-bold text-stone-900 font-serif">Add to Shelf</h3>
            <button
              onClick={onClose}
              className="p-1.5 rounded-lg hover:bg-stone-100 transition-colors"
            >
              <X className="w-4 h-4 text-stone-400" />
            </button>
          </div>

          <div className="px-4 pb-4 space-y-1">
            {shelves.map((shelf) => {
              const isAssigned = assignedIds.includes(shelf.id)
              return (
                <button
                  key={shelf.id}
                  onClick={() => toggle(shelf.id)}
                  className={`w-full flex items-center gap-3 p-3 rounded-xl transition-all text-left ${
                    isAssigned
                      ? "bg-amber-50 border border-amber-200"
                      : "hover:bg-stone-50 border border-transparent"
                  }`}
                >
                  <span className="text-lg">{shelf.emoji}</span>
                  <span className="flex-1 text-sm font-medium text-stone-800">{shelf.name}</span>
                  {isAssigned && (
                    <motion.div
                      initial={{ scale: 0 }}
                      animate={{ scale: 1 }}
                      className="w-5 h-5 rounded-full bg-amber-600 flex items-center justify-center"
                    >
                      <Check className="w-3 h-3 text-white" strokeWidth={3} />
                    </motion.div>
                  )}
                </button>
              )
            })}
          </div>

          {/* Bottom safe area for mobile */}
          <div className="h-safe sm:hidden" />
        </motion.div>
      </motion.div>
    </AnimatePresence>
  )
}
