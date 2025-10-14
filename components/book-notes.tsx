"use client"

import { useState, useEffect } from "react"
import { motion, AnimatePresence } from "framer-motion"
import { Plus, Quote, Highlighter, FileText, Edit, Trash2, Save, X } from "lucide-react"
import { Button } from "./ui/button"
import { BookNote, saveBookNote, getBookNotesForBook, updateBookNote, deleteBookNote } from "@/lib/storage"
import { useGamification } from "./gamification-provider"

interface BookNotesProps {
  bookId: string
  compact?: boolean
}

export function BookNotes({ bookId, compact = false }: BookNotesProps) {
  const [notes, setNotes] = useState<BookNote[]>([])
  const [isAdding, setIsAdding] = useState(false)
  const [editingNote, setEditingNote] = useState<string | null>(null)
  const [newNote, setNewNote] = useState({ content: "", type: "note" as const, page: "" })
  
  const { triggerActivity } = useGamification()

  useEffect(() => {
    loadNotes()
  }, [bookId])

  const loadNotes = () => {
    const bookNotes = getBookNotesForBook(bookId)
    setNotes(bookNotes)
  }

  const handleAddNote = () => {
    if (!newNote.content.trim()) return

    saveBookNote({
      bookId,
      content: newNote.content.trim(),
      type: newNote.type,
      page: newNote.page ? parseInt(newNote.page) : undefined
    })

    // Trigger gamification events based on note type
    if (newNote.type === 'quote') {
      triggerActivity('add_quote')
    } else if (newNote.type === 'highlight') {
      triggerActivity('add_highlight')
    } else {
      triggerActivity('add_note')
    }

    setNewNote({ content: "", type: "note", page: "" })
    setIsAdding(false)
    loadNotes()
  }

  const handleEditNote = (noteId: string, content: string) => {
    updateBookNote(noteId, { content })
    setEditingNote(null)
    loadNotes()
  }

  const handleDeleteNote = (noteId: string) => {
    if (confirm('Are you sure you want to delete this note?')) {
      deleteBookNote(noteId)
      loadNotes()
    }
  }

  const getTypeIcon = (type: string) => {
    switch (type) {
      case 'highlight': return <Highlighter className="w-4 h-4 text-yellow-500" />
      case 'quote': return <Quote className="w-4 h-4 text-blue-500" />
      default: return <FileText className="w-4 h-4 text-gray-500" />
    }
  }

  const getTypeColor = (type: string) => {
    switch (type) {
      case 'highlight': return 'bg-yellow-50 border-yellow-200'
      case 'quote': return 'bg-blue-50 border-blue-200'
      default: return 'bg-gray-50 border-gray-200'
    }
  }

  if (compact) {
    return (
      <div className="space-y-3">
        <div className="flex items-center justify-between">
          <h4 className="font-medium text-gray-900">Notes & Highlights</h4>
          <span className="text-sm text-gray-500">{notes.length}</span>
        </div>
        
        {notes.length > 0 ? (
          <div className="space-y-2">
            {notes.slice(0, 2).map((note) => (
              <div key={note.id} className={`p-3 rounded-lg border ${getTypeColor(note.type)}`}>
                <div className="flex items-start gap-2">
                  {getTypeIcon(note.type)}
                  <p className="text-sm text-gray-700 line-clamp-2">{note.content}</p>
                </div>
              </div>
            ))}
            {notes.length > 2 && (
              <p className="text-sm text-gray-500 text-center">+{notes.length - 2} more notes</p>
            )}
          </div>
        ) : (
          <p className="text-sm text-gray-500 text-center py-4">No notes yet</p>
        )}
      </div>
    )
  }

  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      className="bg-white rounded-2xl shadow-lg border border-gray-100 p-6"
    >
      {/* Header */}
      <div className="flex items-center justify-between mb-6">
        <div className="flex items-center gap-2">
          <FileText className="w-5 h-5 text-purple-600" />
          <h3 className="text-lg font-bold text-gray-900">Notes & Highlights</h3>
          <span className="text-sm text-gray-500 bg-gray-100 px-2 py-1 rounded-full">
            {notes.length}
          </span>
        </div>
        
        <Button
          onClick={() => setIsAdding(true)}
          size="sm"
          className="flex items-center gap-2"
        >
          <Plus className="w-4 h-4" />
          Add Note
        </Button>
      </div>

      {/* Add Note Form */}
      <AnimatePresence>
        {isAdding && (
          <motion.div
            initial={{ opacity: 0, height: 0 }}
            animate={{ opacity: 1, height: "auto" }}
            exit={{ opacity: 0, height: 0 }}
            className="mb-6 p-4 bg-gray-50 rounded-xl space-y-4"
          >
            <div className="flex gap-2">
              <Button
                variant={newNote.type === "note" ? "default" : "outline"}
                size="sm"
                onClick={() => setNewNote(prev => ({ ...prev, type: "note" }))}
              >
                <FileText className="w-4 h-4 mr-1" />
                Note
              </Button>
              <Button
                variant={newNote.type === "highlight" ? "default" : "outline"}
                size="sm"
                onClick={() => setNewNote(prev => ({ ...prev, type: "highlight" }))}
              >
                <Highlighter className="w-4 h-4 mr-1" />
                Highlight
              </Button>
              <Button
                variant={newNote.type === "quote" ? "default" : "outline"}
                size="sm"
                onClick={() => setNewNote(prev => ({ ...prev, type: "quote" }))}
              >
                <Quote className="w-4 h-4 mr-1" />
                Quote
              </Button>
            </div>
            
            <div className="flex gap-2">
              <input
                type="number"
                placeholder="Page (optional)"
                value={newNote.page}
                onChange={(e) => setNewNote(prev => ({ ...prev, page: e.target.value }))}
                className="w-24 px-3 py-2 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-purple-400"
              />
              <textarea
                placeholder="Add your note, highlight, or favorite quote..."
                value={newNote.content}
                onChange={(e) => setNewNote(prev => ({ ...prev, content: e.target.value }))}
                className="flex-1 px-3 py-2 border border-gray-200 rounded-lg resize-none focus:outline-none focus:ring-2 focus:ring-purple-400"
                rows={3}
              />
            </div>
            
            <div className="flex justify-end gap-2">
              <Button
                variant="outline"
                size="sm"
                onClick={() => {
                  setIsAdding(false)
                  setNewNote({ content: "", type: "note", page: "" })
                }}
              >
                <X className="w-4 h-4 mr-1" />
                Cancel
              </Button>
              <Button
                size="sm"
                onClick={handleAddNote}
                disabled={!newNote.content.trim()}
              >
                <Save className="w-4 h-4 mr-1" />
                Save Note
              </Button>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Notes List */}
      <div className="space-y-4">
        {notes.length > 0 ? (
          <AnimatePresence>
            {notes.map((note) => (
              <motion.div
                key={note.id}
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -20 }}
                className={`p-4 rounded-xl border ${getTypeColor(note.type)}`}
              >
                <div className="flex items-start justify-between mb-2">
                  <div className="flex items-center gap-2">
                    {getTypeIcon(note.type)}
                    <span className="text-sm font-medium text-gray-700 capitalize">
                      {note.type}
                    </span>
                    {note.page && (
                      <span className="text-xs text-gray-500 bg-white px-2 py-1 rounded-full">
                        Page {note.page}
                      </span>
                    )}
                  </div>
                  
                  <div className="flex items-center gap-1">
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => setEditingNote(note.id)}
                      className="h-auto p-1"
                    >
                      <Edit className="w-3 h-3" />
                    </Button>
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => handleDeleteNote(note.id)}
                      className="h-auto p-1 text-red-500 hover:text-red-600"
                    >
                      <Trash2 className="w-3 h-3" />
                    </Button>
                  </div>
                </div>
                
                {editingNote === note.id ? (
                  <EditNoteForm
                    initialContent={note.content}
                    onSave={(content) => handleEditNote(note.id, content)}
                    onCancel={() => setEditingNote(null)}
                  />
                ) : (
                  <div>
                    <p className="text-gray-700 leading-relaxed mb-2">
                      {note.type === 'quote' ? `"${note.content}"` : note.content}
                    </p>
                    <p className="text-xs text-gray-500">
                      {new Date(note.createdAt).toLocaleDateString('en-US', {
                        year: 'numeric',
                        month: 'short', 
                        day: 'numeric',
                        hour: '2-digit',
                        minute: '2-digit'
                      })}
                    </p>
                  </div>
                )}
              </motion.div>
            ))}
          </AnimatePresence>
        ) : (
          <div className="text-center py-8">
            <FileText className="w-12 h-12 text-gray-300 mx-auto mb-4" />
            <p className="text-gray-500 mb-2">No notes yet</p>
            <p className="text-sm text-gray-400">
              Add notes, highlights, and favorite quotes as you read
            </p>
          </div>
        )}
      </div>
    </motion.div>
  )
}

interface EditNoteFormProps {
  initialContent: string
  onSave: (content: string) => void
  onCancel: () => void
}

function EditNoteForm({ initialContent, onSave, onCancel }: EditNoteFormProps) {
  const [content, setContent] = useState(initialContent)

  return (
    <div className="space-y-3">
      <textarea
        value={content}
        onChange={(e) => setContent(e.target.value)}
        className="w-full px-3 py-2 border border-gray-200 rounded-lg resize-none focus:outline-none focus:ring-2 focus:ring-purple-400"
        rows={3}
      />
      <div className="flex justify-end gap-2">
        <Button variant="outline" size="sm" onClick={onCancel}>
          Cancel
        </Button>
        <Button 
          size="sm" 
          onClick={() => onSave(content)}
          disabled={!content.trim()}
        >
          Save
        </Button>
      </div>
    </div>
  )
}
