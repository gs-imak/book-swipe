"use client"

import { useState, useEffect } from "react"
import { motion, AnimatePresence } from "framer-motion"
import { X, Plus, Pencil, Trash2 } from "lucide-react"
import {
  getShelves,
  createShelf,
  renameShelf,
  deleteShelf,
  getBooksForShelf,
  type Shelf,
} from "@/lib/storage"

interface ShelfManagerProps {
  isOpen: boolean
  onClose: () => void
  onShelvesChanged?: () => void
}

const SHELF_EMOJIS = ["\u{1F4DA}", "\u{1F4D6}", "\u2705", "\u2764\uFE0F", "\u{1F31F}", "\u{1F525}", "\u{1F3AF}", "\u{1F48E}", "\u{1F381}", "\u{1F30D}", "\u{1F5A4}", "\u{1F4A1}"]

export function ShelfManager({ isOpen, onClose, onShelvesChanged }: ShelfManagerProps) {
  const [shelves, setShelves] = useState<Shelf[]>([])
  const [isAdding, setIsAdding] = useState(false)
  const [editingId, setEditingId] = useState<string | null>(null)
  const [name, setName] = useState("")
  const [emoji, setEmoji] = useState("\u{1F4DA}")

  useEffect(() => {
    if (isOpen) {
      setShelves(getShelves())
    }
  }, [isOpen])

  useEffect(() => {
    if (!isOpen) return
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose()
    }
    document.addEventListener("keydown", handleKeyDown)
    return () => document.removeEventListener("keydown", handleKeyDown)
  }, [isOpen, onClose])

  if (!isOpen) return null

  const handleCreate = () => {
    if (!name.trim()) return
    createShelf(name.trim(), emoji)
    setShelves(getShelves())
    setIsAdding(false)
    setName("")
    setEmoji("\u{1F4DA}")
    onShelvesChanged?.()
  }

  const handleRename = (shelfId: string) => {
    if (!name.trim()) return
    renameShelf(shelfId, name.trim(), emoji)
    setShelves(getShelves())
    setEditingId(null)
    setName("")
    setEmoji("\u{1F4DA}")
    onShelvesChanged?.()
  }

  const handleDelete = (shelfId: string) => {
    const shelf = shelves.find(s => s.id === shelfId)
    const count = getBooksForShelf(shelfId).length
    const msg = count > 0
      ? `Delete "${shelf?.name}"? ${count} book${count > 1 ? "s" : ""} will be unassigned.`
      : `Delete "${shelf?.name}"?`
    if (confirm(msg)) {
      deleteShelf(shelfId)
      setShelves(getShelves())
      onShelvesChanged?.()
    }
  }

  const startEdit = (shelf: Shelf) => {
    setEditingId(shelf.id)
    setName(shelf.name)
    setEmoji(shelf.emoji)
    setIsAdding(false)
  }

  const startAdd = () => {
    setIsAdding(true)
    setEditingId(null)
    setName("")
    setEmoji("\u{1F4DA}")
  }

  return (
    <AnimatePresence>
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
        className="fixed inset-0 bg-black/40 backdrop-blur-sm z-50 flex items-center justify-center p-4"
        onClick={onClose}
      >
        <motion.div
          initial={{ opacity: 0, y: 30, scale: 0.97 }}
          animate={{ opacity: 1, y: 0, scale: 1 }}
          exit={{ opacity: 0, y: 30, scale: 0.97 }}
          transition={{ type: "spring", stiffness: 300, damping: 30 }}
          className="bg-background rounded-2xl shadow-2xl max-w-md w-full max-h-[80vh] overflow-hidden flex flex-col border border-stone-200/60"
          onClick={(e) => e.stopPropagation()}
        >
          {/* Header */}
          <div className="flex items-center justify-between p-5 pb-3">
            <h2 className="text-lg font-bold text-stone-900 font-serif">Manage Shelves</h2>
            <button
              onClick={onClose}
              className="p-2 -mr-2 rounded-lg hover:bg-stone-100 transition-colors tap-target touch-manipulation"
            >
              <X className="w-5 h-5 text-stone-400" />
            </button>
          </div>

          {/* Shelves list */}
          <div className="flex-1 overflow-y-auto px-5 pb-3 space-y-2">
            {shelves.map((shelf) => (
              <div key={shelf.id}>
                {editingId === shelf.id ? (
                  <div className="bg-stone-50 rounded-xl p-3 space-y-2">
                    <div className="flex gap-2">
                      <input
                        type="text"
                        value={name}
                        onChange={(e) => setName(e.target.value)}
                        className="flex-1 h-9 px-3 rounded-lg border border-stone-200 text-sm bg-white focus:outline-none focus:ring-2 focus:ring-amber-500/30 focus:border-amber-500"
                        placeholder="Shelf name"
                        autoFocus
                        onKeyDown={(e) => e.key === "Enter" && handleRename(shelf.id)}
                      />
                    </div>
                    <div className="flex gap-1.5 flex-wrap">
                      {SHELF_EMOJIS.map((e) => (
                        <button
                          key={e}
                          onClick={() => setEmoji(e)}
                          className={`w-8 h-8 rounded-lg text-base flex items-center justify-center transition-all ${
                            emoji === e ? "bg-amber-100 ring-2 ring-amber-500/40" : "hover:bg-stone-100"
                          }`}
                        >
                          {e}
                        </button>
                      ))}
                    </div>
                    <div className="flex gap-2 justify-end">
                      <button
                        onClick={() => setEditingId(null)}
                        className="px-3 py-1.5 text-xs text-stone-500 hover:text-stone-700 rounded-lg transition-colors"
                      >
                        Cancel
                      </button>
                      <button
                        onClick={() => handleRename(shelf.id)}
                        className="px-3 py-1.5 text-xs bg-stone-900 text-white rounded-lg hover:bg-stone-800 transition-colors font-medium"
                      >
                        Save
                      </button>
                    </div>
                  </div>
                ) : (
                  <div className="flex items-center gap-3 p-3 rounded-xl hover:bg-stone-50 transition-colors">
                    <span className="text-lg">{shelf.emoji}</span>
                    <span className="flex-1 text-sm font-medium text-stone-800">{shelf.name}</span>
                    <span className="text-xs text-stone-400">{getBooksForShelf(shelf.id).length}</span>
                    <button
                      onClick={() => startEdit(shelf)}
                      aria-label={`Edit ${shelf.name}`}
                      className="p-1.5 rounded-lg text-stone-400 hover:text-stone-600 hover:bg-stone-100 transition-all tap-target touch-manipulation"
                    >
                      <Pencil className="w-3.5 h-3.5" />
                    </button>
                    {!shelf.isDefault && (
                      <button
                        onClick={() => handleDelete(shelf.id)}
                        aria-label={`Delete ${shelf.name}`}
                        className="p-1.5 rounded-lg text-stone-400 hover:text-red-500 hover:bg-red-50 transition-all tap-target touch-manipulation"
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                      </button>
                    )}
                  </div>
                )}
              </div>
            ))}

            {/* Add form */}
            {isAdding ? (
              <div className="bg-amber-50/50 rounded-xl p-3 space-y-2 border border-amber-100">
                <input
                  type="text"
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  className="w-full h-9 px-3 rounded-lg border border-stone-200 text-sm bg-white focus:outline-none focus:ring-2 focus:ring-amber-500/30 focus:border-amber-500"
                  placeholder="New shelf name"
                  autoFocus
                  onKeyDown={(e) => e.key === "Enter" && handleCreate()}
                />
                <div className="flex gap-1.5 flex-wrap">
                  {SHELF_EMOJIS.map((e) => (
                    <button
                      key={e}
                      onClick={() => setEmoji(e)}
                      className={`w-8 h-8 rounded-lg text-base flex items-center justify-center transition-all ${
                        emoji === e ? "bg-amber-100 ring-2 ring-amber-500/40" : "hover:bg-stone-100"
                      }`}
                    >
                      {e}
                    </button>
                  ))}
                </div>
                <div className="flex gap-2 justify-end">
                  <button
                    onClick={() => setIsAdding(false)}
                    className="px-3 py-1.5 text-xs text-stone-500 hover:text-stone-700 rounded-lg transition-colors"
                  >
                    Cancel
                  </button>
                  <button
                    onClick={handleCreate}
                    disabled={!name.trim()}
                    className="px-3 py-1.5 text-xs bg-stone-900 text-white rounded-lg hover:bg-stone-800 transition-colors font-medium disabled:opacity-40"
                  >
                    Create
                  </button>
                </div>
              </div>
            ) : (
              <button
                onClick={startAdd}
                className="w-full flex items-center gap-2 p-3 rounded-xl text-sm text-amber-700 hover:bg-amber-50 transition-colors font-medium"
              >
                <Plus className="w-4 h-4" />
                New Shelf
              </button>
            )}
          </div>
        </motion.div>
      </motion.div>
    </AnimatePresence>
  )
}
