"use client"

import { useState, useRef } from "react"
import { Button } from "@/components/ui/button"
import { Book } from "@/lib/book-data"
import {
  getLikedBooks,
  saveLikedBooks,
  getReadingProgress,
  saveReadingProgress,
  getBookReviews,
  saveBookReviews,
  getBookNotes,
  saveBookNotes,
  getReadingGoals,
  saveReadingGoals,
  getUserStats,
  saveUserStats,
  getUserAchievements,
  saveUserAchievements,
} from "@/lib/storage"
import { Download, Upload, Shield, AlertTriangle } from "lucide-react"
import { useToast } from "./toast-provider"

interface AdminPanelProps {
  onBooksLoaded: (books: Book[]) => void
}

interface ExportData {
  version: number
  exportedAt: string
  data: {
    likedBooks: Book[]
    readingProgress: ReturnType<typeof getReadingProgress>
    bookReviews: ReturnType<typeof getBookReviews>
    bookNotes: ReturnType<typeof getBookNotes>
    readingGoals: ReturnType<typeof getReadingGoals>
    userStats: ReturnType<typeof getUserStats>
    achievements: ReturnType<typeof getUserAchievements>
  }
}

export function AdminPanel({ onBooksLoaded }: AdminPanelProps) {
  const [importing, setImporting] = useState(false)
  const fileInputRef = useRef<HTMLInputElement>(null)
  const { showToast } = useToast()

  const handleExport = () => {
    const exportData: ExportData = {
      version: 1,
      exportedAt: new Date().toISOString(),
      data: {
        likedBooks: getLikedBooks(),
        readingProgress: getReadingProgress(),
        bookReviews: getBookReviews(),
        bookNotes: getBookNotes(),
        readingGoals: getReadingGoals(),
        userStats: getUserStats(),
        achievements: getUserAchievements(),
      },
    }

    const json = JSON.stringify(exportData, null, 2)
    const blob = new Blob([json], { type: "application/json" })
    const url = URL.createObjectURL(blob)
    const a = document.createElement("a")
    a.href = url
    const date = new Date().toISOString().split("T")[0]
    a.download = `bookswipe-backup-${date}.json`
    a.click()
    URL.revokeObjectURL(url)
    showToast("Backup downloaded successfully")
  }

  const handleImport = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (!file) return

    setImporting(true)
    try {
      const text = await file.text()
      const parsed = JSON.parse(text) as ExportData

      if (!parsed.version || !parsed.data) {
        showToast("Invalid backup file format", "error")
        return
      }

      const { data } = parsed
      const counts = {
        books: 0,
        progress: 0,
        reviews: 0,
        notes: 0,
      }

      // Merge liked books (don't duplicate)
      if (data.likedBooks?.length) {
        const existing = getLikedBooks()
        const existingIds = new Set(existing.map(b => b.id))
        const newBooks = data.likedBooks.filter(b => !existingIds.has(b.id))
        saveLikedBooks([...existing, ...newBooks])
        counts.books = newBooks.length
      }

      // Merge reading progress
      if (data.readingProgress?.length) {
        const existing = getReadingProgress()
        const existingIds = new Set(existing.map(p => p.bookId))
        const newProgress = data.readingProgress.filter(p => !existingIds.has(p.bookId))
        saveReadingProgress([...existing, ...newProgress])
        counts.progress = newProgress.length
      }

      // Merge reviews
      if (data.bookReviews?.length) {
        const existing = getBookReviews()
        const existingIds = new Set(existing.map(r => r.bookId))
        const newReviews = data.bookReviews.filter(r => !existingIds.has(r.bookId))
        saveBookReviews([...existing, ...newReviews])
        counts.reviews = newReviews.length
      }

      // Merge notes
      if (data.bookNotes?.length) {
        const existing = getBookNotes()
        const existingIds = new Set(existing.map(n => n.id))
        const newNotes = data.bookNotes.filter(n => !existingIds.has(n.id))
        saveBookNotes([...existing, ...newNotes])
        counts.notes = newNotes.length
      }

      // Restore goals (only if user has default/empty goals)
      if (data.readingGoals) {
        const current = getReadingGoals()
        if (current.booksCompleted === 0 && current.pagesRead === 0) {
          saveReadingGoals(data.readingGoals)
        }
      }

      // Restore stats (use higher values)
      if (data.userStats) {
        const current = getUserStats()
        if (current.totalBooksLiked === 0) {
          saveUserStats(data.userStats)
        }
      }

      // Merge achievements
      if (data.achievements?.length) {
        const existing = getUserAchievements()
        if (existing.length === 0) {
          saveUserAchievements(data.achievements)
        }
      }

      const parts: string[] = []
      if (counts.books > 0) parts.push(`${counts.books} books`)
      if (counts.progress > 0) parts.push(`${counts.progress} reading entries`)
      if (counts.reviews > 0) parts.push(`${counts.reviews} reviews`)
      if (counts.notes > 0) parts.push(`${counts.notes} notes`)

      if (parts.length > 0) {
        showToast(`Imported ${parts.join(", ")}`)
      } else {
        showToast("Everything was already up to date", "info")
      }

      // Trigger a reload
      onBooksLoaded(getLikedBooks())
    } catch {
      showToast("Failed to read backup file", "error")
    } finally {
      setImporting(false)
      if (fileInputRef.current) fileInputRef.current.value = ""
    }
  }

  const likedCount = getLikedBooks().length
  const reviewCount = getBookReviews().length
  const noteCount = getBookNotes().length
  const progressCount = getReadingProgress().length

  return (
    <div className="bg-white rounded-xl p-5 border border-stone-200/60 shadow-sm space-y-5">
      <div>
        <h3 className="text-base font-semibold text-stone-900 flex items-center gap-2 mb-1">
          <Shield className="w-4 h-4 text-stone-500" />
          Data & Backup
        </h3>
        <p className="text-xs text-stone-500">
          Export your data to keep a backup, or import from a previous backup.
        </p>
      </div>

      {/* Current data summary */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
        <div className="bg-stone-50 rounded-lg px-3 py-2">
          <p className="text-lg font-bold text-stone-900">{likedCount}</p>
          <p className="text-[11px] text-stone-500">Books</p>
        </div>
        <div className="bg-stone-50 rounded-lg px-3 py-2">
          <p className="text-lg font-bold text-stone-900">{progressCount}</p>
          <p className="text-[11px] text-stone-500">Reading</p>
        </div>
        <div className="bg-stone-50 rounded-lg px-3 py-2">
          <p className="text-lg font-bold text-stone-900">{reviewCount}</p>
          <p className="text-[11px] text-stone-500">Reviews</p>
        </div>
        <div className="bg-stone-50 rounded-lg px-3 py-2">
          <p className="text-lg font-bold text-stone-900">{noteCount}</p>
          <p className="text-[11px] text-stone-500">Notes</p>
        </div>
      </div>

      {/* Export / Import buttons */}
      <div className="flex gap-3">
        <Button
          onClick={handleExport}
          className="flex-1 h-10 bg-stone-900 hover:bg-stone-800 text-white font-medium rounded-xl text-sm"
        >
          <Download className="w-4 h-4 mr-2" />
          Export Backup
        </Button>
        <Button
          onClick={() => fileInputRef.current?.click()}
          disabled={importing}
          variant="outline"
          className="flex-1 h-10 border-stone-200 hover:bg-stone-50 text-stone-700 rounded-xl text-sm"
        >
          <Upload className="w-4 h-4 mr-2" />
          {importing ? "Importing..." : "Import Backup"}
        </Button>
        <input
          ref={fileInputRef}
          type="file"
          accept=".json"
          onChange={handleImport}
          className="hidden"
        />
      </div>

      {/* Warning */}
      <div className="flex gap-2 p-3 rounded-lg bg-amber-50 border border-amber-100">
        <AlertTriangle className="w-4 h-4 text-amber-600 flex-shrink-0 mt-0.5" />
        <p className="text-xs text-amber-700 leading-relaxed">
          Your data is stored in this browser only. Clearing browser data will erase it.
          Export backups regularly to avoid data loss.
        </p>
      </div>
    </div>
  )
}
