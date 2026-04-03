"use client"

import { useState, useEffect } from "react"
import { motion, AnimatePresence } from "framer-motion"
import { X, Plus, Trash2, ArrowLeft, BookOpen } from "lucide-react"
import {
  getCollections,
  saveCollection,
  deleteCollection,
  type BookCollection,
} from "@/lib/storage"
import { getLikedBooks } from "@/lib/storage"
import { Book } from "@/lib/book-data"
import { BookCover } from "@/components/book-cover"

const PRESET_EMOJIS = ["📚", "⭐", "🔥", "❤️", "🌙", "🌿", "🎭", "🗺️", "🧠", "🏆", "✨", "🎯"]

interface BookCollectionsProps {
  isOpen: boolean
  onClose: () => void
  onBookClick?: (book: Book) => void
}

type View = "list" | "detail" | "create"

export function BookCollections({ isOpen, onClose, onBookClick }: BookCollectionsProps) {
  const [collections, setCollections] = useState<BookCollection[]>([])
  const [likedBooks, setLikedBooks] = useState<Book[]>([])
  const [view, setView] = useState<View>("list")
  const [activeCollection, setActiveCollection] = useState<BookCollection | null>(null)
  const [confirmDeleteId, setConfirmDeleteId] = useState<string | null>(null)

  // Create form state
  const [newName, setNewName] = useState("")
  const [newEmoji, setNewEmoji] = useState("📚")
  const [newDescription, setNewDescription] = useState("")

  useEffect(() => {
    if (isOpen) {
      setCollections(getCollections())
      setLikedBooks(getLikedBooks())
      setView("list")
      setActiveCollection(null)
      setConfirmDeleteId(null)
    }
  }, [isOpen])

  // Lock body scroll while open
  useEffect(() => {
    if (isOpen) {
      document.body.style.overflow = "hidden"
      return () => { document.body.style.overflow = "" }
    }
  }, [isOpen])

  // Close on Escape
  useEffect(() => {
    if (!isOpen) return
    const handleKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        if (view !== "list") {
          setView("list")
          setActiveCollection(null)
        } else {
          onClose()
        }
      }
    }
    document.addEventListener("keydown", handleKey)
    return () => document.removeEventListener("keydown", handleKey)
  }, [isOpen, onClose, view])

  if (!isOpen) return null

  const getBooksForCollection = (collection: BookCollection): Book[] => {
    return collection.bookIds
      .map(id => likedBooks.find(b => b.id === id))
      .filter((b): b is Book => !!b)
  }

  const handleCreateCollection = () => {
    if (!newName.trim()) return
    const collection: BookCollection = {
      id: Date.now().toString() + Math.random().toString(36).slice(2, 8),
      name: newName.trim().slice(0, 60),
      description: newDescription.trim().slice(0, 200),
      emoji: newEmoji,
      bookIds: [],
      createdAt: new Date().toISOString(),
    }
    saveCollection(collection)
    setCollections(getCollections())
    setNewName("")
    setNewEmoji("📚")
    setNewDescription("")
    setView("list")
  }

  const handleDeleteCollection = (id: string) => {
    deleteCollection(id)
    setCollections(getCollections())
    setConfirmDeleteId(null)
    if (activeCollection?.id === id) {
      setActiveCollection(null)
      setView("list")
    }
  }

  const handleOpenCollection = (collection: BookCollection) => {
    setActiveCollection(collection)
    setView("detail")
  }

  return (
    <AnimatePresence>
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
        className="fixed inset-0 lg:left-16 bg-background z-[60]"
      >
        {/* Header */}
        <div className="bg-background/90 backdrop-blur-md border-b border-stone-200/60 dark:border-stone-700/60 sticky top-0 z-10">
          <div className="max-w-2xl mx-auto px-4 sm:px-6 py-3 sm:py-4 flex items-center justify-between">
            <div className="flex items-center gap-2">
              {view !== "list" && (
                <button
                  onClick={() => { setView("list"); setActiveCollection(null) }}
                  className="p-2 -ml-2 rounded-lg hover:bg-stone-100 dark:hover:bg-stone-800 transition-colors"
                  aria-label="Back"
                >
                  <ArrowLeft className="w-5 h-5 text-stone-500 dark:text-stone-400" />
                </button>
              )}
              <h1 className="text-xl sm:text-2xl font-bold text-stone-900 dark:text-stone-100 font-serif">
                {view === "list" && "Collections"}
                {view === "detail" && (activeCollection ? `${activeCollection.emoji} ${activeCollection.name}` : "Collection")}
                {view === "create" && "New Collection"}
              </h1>
            </div>
            <button
              onClick={onClose}
              className="p-2 rounded-lg hover:bg-stone-100 dark:hover:bg-stone-800 transition-colors tap-target touch-manipulation"
            >
              <X className="w-5 h-5 text-stone-400" />
            </button>
          </div>
        </div>

        {/* Body */}
        <div
          className="overflow-y-auto overscroll-contain"
          style={{ height: "calc(100vh - 57px)", WebkitOverflowScrolling: "touch" as never }}
        >
          <div className="max-w-2xl mx-auto px-4 sm:px-6 py-6 pb-24">

            {/* ── LIST VIEW ── */}
            {view === "list" && (
              <div className="space-y-4">
                <button
                  onClick={() => setView("create")}
                  className="w-full flex items-center justify-center gap-2 h-12 border-2 border-dashed border-stone-300 dark:border-stone-700 rounded-xl text-stone-500 dark:text-stone-400 hover:border-amber-400 hover:text-amber-600 dark:hover:border-amber-600 dark:hover:text-amber-400 transition-all text-sm font-medium"
                >
                  <Plus className="w-4 h-4" />
                  Create Collection
                </button>

                {collections.length === 0 && (
                  <div className="text-center py-16">
                    <BookOpen className="w-12 h-12 text-stone-300 dark:text-stone-600 mx-auto mb-3" />
                    <p className="text-stone-500 dark:text-stone-400 text-sm">
                      No collections yet. Create one to organize your books.
                    </p>
                  </div>
                )}

                {collections.map(collection => {
                  const books = getBooksForCollection(collection)
                  return (
                    <motion.div
                      key={collection.id}
                      initial={{ opacity: 0, y: 6 }}
                      animate={{ opacity: 1, y: 0 }}
                      className="bg-white dark:bg-stone-900 rounded-2xl border border-stone-200/60 dark:border-stone-700/60 shadow-sm overflow-hidden"
                    >
                      <button
                        onClick={() => handleOpenCollection(collection)}
                        className="w-full flex items-center gap-4 p-4 text-left hover:bg-stone-50 dark:hover:bg-stone-800/50 transition-colors"
                      >
                        <span className="text-3xl flex-shrink-0">{collection.emoji}</span>
                        <div className="flex-1 min-w-0">
                          <p className="font-semibold text-stone-900 dark:text-stone-100 truncate">{collection.name}</p>
                          {collection.description && (
                            <p className="text-xs text-stone-500 dark:text-stone-400 truncate mt-0.5">{collection.description}</p>
                          )}
                          <p className="text-xs text-stone-400 dark:text-stone-500 mt-1">
                            {books.length} {books.length === 1 ? "book" : "books"}
                          </p>
                        </div>
                        {/* Thumbnail strip */}
                        <div className="flex items-center gap-1 flex-shrink-0">
                          {books.slice(0, 3).map(book => (
                            <div key={book.id} className="relative w-8 h-12 rounded overflow-hidden border border-stone-200/60 dark:border-stone-700/60 flex-shrink-0">
                              <BookCover src={book.cover} fallbackSrc={book.coverFallback} alt={book.title} fill className="object-cover" sizes="32px" />
                            </div>
                          ))}
                        </div>
                      </button>

                      {/* Delete row */}
                      <div className="border-t border-stone-100 dark:border-stone-800 px-4 py-2 flex items-center justify-end">
                        {confirmDeleteId === collection.id ? (
                          <div className="flex items-center gap-2">
                            <span className="text-xs text-stone-500 dark:text-stone-400">Delete collection?</span>
                            <button
                              onClick={() => handleDeleteCollection(collection.id)}
                              className="text-xs text-red-500 font-semibold hover:text-red-600 transition-colors px-2 py-1 rounded"
                            >
                              Yes, delete
                            </button>
                            <button
                              onClick={() => setConfirmDeleteId(null)}
                              className="text-xs text-stone-400 hover:text-stone-600 dark:hover:text-stone-300 transition-colors px-2 py-1 rounded"
                            >
                              Cancel
                            </button>
                          </div>
                        ) : (
                          <button
                            onClick={() => setConfirmDeleteId(collection.id)}
                            className="flex items-center gap-1 text-xs text-stone-400 hover:text-red-500 dark:hover:text-red-400 transition-colors"
                          >
                            <Trash2 className="w-3 h-3" />
                            Delete
                          </button>
                        )}
                      </div>
                    </motion.div>
                  )
                })}
              </div>
            )}

            {/* ── DETAIL VIEW ── */}
            {view === "detail" && activeCollection && (
              <div className="space-y-4">
                {activeCollection.description && (
                  <p className="text-sm text-stone-500 dark:text-stone-400">{activeCollection.description}</p>
                )}

                {getBooksForCollection(activeCollection).length === 0 ? (
                  <div className="text-center py-16">
                    <BookOpen className="w-12 h-12 text-stone-300 dark:text-stone-600 mx-auto mb-3" />
                    <p className="text-stone-500 dark:text-stone-400 text-sm">
                      No books in this collection yet.
                    </p>
                    <p className="text-xs text-stone-400 dark:text-stone-500 mt-1">
                      Open a book and add it to this collection from the detail view.
                    </p>
                  </div>
                ) : (
                  <div className="grid grid-cols-3 sm:grid-cols-4 gap-3">
                    {getBooksForCollection(activeCollection).map(book => (
                      <button
                        key={book.id}
                        onClick={() => onBookClick?.(book)}
                        className="group flex flex-col gap-1.5 text-left"
                      >
                        <div className="relative aspect-[2/3] rounded-lg overflow-hidden border border-stone-200/60 dark:border-stone-700/60 shadow-sm group-hover:shadow-md transition-shadow">
                          <BookCover src={book.cover} fallbackSrc={book.coverFallback} alt={book.title} fill className="object-cover" sizes="(max-width: 640px) 33vw, 25vw" />
                        </div>
                        <p className="text-xs text-stone-700 dark:text-stone-300 line-clamp-2 leading-tight font-medium">
                          {book.title}
                        </p>
                        <p className="text-[11px] text-stone-400 dark:text-stone-500 truncate">{book.author}</p>
                      </button>
                    ))}
                  </div>
                )}
              </div>
            )}

            {/* ── CREATE VIEW ── */}
            {view === "create" && (
              <div className="space-y-5">
                {/* Emoji picker */}
                <div>
                  <label className="block text-xs font-semibold text-stone-400 dark:text-stone-500 uppercase tracking-wider mb-3">
                    Choose an Emoji
                  </label>
                  <div className="flex flex-wrap gap-2">
                    {PRESET_EMOJIS.map(emoji => (
                      <button
                        key={emoji}
                        onClick={() => setNewEmoji(emoji)}
                        className={`w-10 h-10 text-xl rounded-xl border-2 transition-all flex items-center justify-center ${
                          newEmoji === emoji
                            ? "border-amber-500 bg-amber-50 dark:bg-amber-900/30"
                            : "border-stone-200 dark:border-stone-700 hover:border-stone-300 dark:hover:border-stone-600 bg-white dark:bg-stone-900"
                        }`}
                      >
                        {emoji}
                      </button>
                    ))}
                  </div>
                </div>

                {/* Name */}
                <div>
                  <label className="block text-xs font-semibold text-stone-400 dark:text-stone-500 uppercase tracking-wider mb-2">
                    Collection Name
                  </label>
                  <input
                    type="text"
                    value={newName}
                    onChange={e => setNewName(e.target.value)}
                    placeholder="e.g. Summer Reads"
                    maxLength={60}
                    className="w-full h-11 px-4 rounded-xl border border-stone-200 dark:border-stone-700 bg-white dark:bg-stone-900 text-stone-900 dark:text-stone-100 placeholder-stone-400 dark:placeholder-stone-600 text-sm focus:outline-none focus:ring-2 focus:ring-amber-500/40 focus:border-amber-400 transition-all"
                    autoFocus
                  />
                </div>

                {/* Description */}
                <div>
                  <label className="block text-xs font-semibold text-stone-400 dark:text-stone-500 uppercase tracking-wider mb-2">
                    Description <span className="normal-case font-normal">(optional)</span>
                  </label>
                  <textarea
                    value={newDescription}
                    onChange={e => setNewDescription(e.target.value)}
                    placeholder="A short note about this collection..."
                    maxLength={200}
                    rows={3}
                    className="w-full px-4 py-3 rounded-xl border border-stone-200 dark:border-stone-700 bg-white dark:bg-stone-900 text-stone-900 dark:text-stone-100 placeholder-stone-400 dark:placeholder-stone-600 text-sm focus:outline-none focus:ring-2 focus:ring-amber-500/40 focus:border-amber-400 transition-all resize-none"
                  />
                </div>

                <div className="flex gap-3 pt-2">
                  <button
                    onClick={() => setView("list")}
                    className="flex-1 h-11 rounded-xl border border-stone-200 dark:border-stone-700 text-stone-600 dark:text-stone-300 text-sm font-medium hover:bg-stone-50 dark:hover:bg-stone-800/50 transition-all"
                  >
                    Cancel
                  </button>
                  <button
                    onClick={handleCreateCollection}
                    disabled={!newName.trim()}
                    className="flex-1 h-11 rounded-xl bg-stone-900 dark:bg-stone-100 hover:bg-stone-800 dark:hover:bg-stone-200 text-white dark:text-stone-900 text-sm font-medium transition-all disabled:opacity-40 disabled:cursor-not-allowed"
                  >
                    Create
                  </button>
                </div>
              </div>
            )}

          </div>
        </div>
      </motion.div>
    </AnimatePresence>
  )
}
