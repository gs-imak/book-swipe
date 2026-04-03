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
  getShelves,
  saveShelves,
  getShelfAssignments,
  saveShelfAssignments,
  markBackupExported,
} from "@/lib/storage"
import { Download, Upload, Shield, AlertTriangle, BookOpen, FileSpreadsheet, Globe, HardDrive, Check, X } from "lucide-react"
import {
  type BookLanguage,
  LANGUAGE_LABELS,
  getLanguagePreference,
  setLanguagePreference,
} from "@/lib/language-preference"
import { useToast } from "./toast-provider"
import { GoodreadsImport } from "./goodreads-import"
import {
  exportToGoodreadsCSV,
  exportToNotionCSV,
  downloadCSV,
  exportFullBackupJSON,
  importFullBackupJSON,
  previewFullBackupJSON,
  downloadJSON,
} from "@/lib/export-utils"

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
    shelves?: ReturnType<typeof getShelves>
    shelfAssignments?: ReturnType<typeof getShelfAssignments>
  }
}

export function AdminPanel({ onBooksLoaded }: AdminPanelProps) {
  const [importing, setImporting] = useState(false)
  const [showGoodreadsImport, setShowGoodreadsImport] = useState(false)
  const [language, setLanguage] = useState<BookLanguage>(getLanguagePreference)
  const [fullBackupPreview, setFullBackupPreview] = useState<{
    json: string
    stats: { books: number; reviews: number; notes: number; totalKeys: number }
  } | null>(null)
  const [importingFull, setImportingFull] = useState(false)
  const fileInputRef = useRef<HTMLInputElement>(null)
  const fullBackupInputRef = useRef<HTMLInputElement>(null)
  const { showToast } = useToast()

  const handleLanguageChange = (lang: BookLanguage) => {
    setLanguage(lang)
    setLanguagePreference(lang)
    showToast(`Language set to ${LANGUAGE_LABELS[lang]}. Book cache cleared.`)
  }

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
        shelves: getShelves(),
        shelfAssignments: getShelfAssignments(),
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
    markBackupExported()
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

      // Merge shelves
      if (data.shelves?.length) {
        const existing = getShelves()
        const existingIds = new Set(existing.map(s => s.id))
        const newShelves = data.shelves.filter(s => !existingIds.has(s.id))
        if (newShelves.length > 0) {
          saveShelves([...existing, ...newShelves])
        }
      }

      // Merge shelf assignments
      if (data.shelfAssignments?.length) {
        const existing = getShelfAssignments()
        const existingKeys = new Set(existing.map(a => `${a.bookId}|${a.shelfId}`))
        const newAssignments = data.shelfAssignments.filter(a => !existingKeys.has(`${a.bookId}|${a.shelfId}`))
        if (newAssignments.length > 0) {
          saveShelfAssignments([...existing, ...newAssignments])
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

  const handleFullBackupExport = () => {
    const json = exportFullBackupJSON()
    const date = new Date().toISOString().split("T")[0]
    downloadJSON(json, `bookswipe-full-backup-${date}.json`)
    markBackupExported()
    showToast("Full backup downloaded")
  }

  const handleFullBackupFileSelect = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (!file) return

    try {
      const text = await file.text()
      const preview = previewFullBackupJSON(text)

      if (!preview.success || !preview.stats) {
        showToast(preview.error || "Invalid backup file", "error")
        return
      }

      setFullBackupPreview({ json: text, stats: preview.stats })
    } catch {
      showToast("Failed to read file", "error")
    } finally {
      if (fullBackupInputRef.current) fullBackupInputRef.current.value = ""
    }
  }

  const handleFullBackupConfirm = () => {
    if (!fullBackupPreview) return
    setImportingFull(true)

    const result = importFullBackupJSON(fullBackupPreview.json)

    if (result.success) {
      showToast(`Restored ${result.stats?.totalKeys || 0} data entries`)
      setFullBackupPreview(null)
      setTimeout(() => window.location.reload(), 600)
    } else {
      showToast(result.error || "Import failed", "error")
      setImportingFull(false)
    }
  }

  const likedCount = getLikedBooks().length
  const reviewCount = getBookReviews().length
  const noteCount = getBookNotes().length
  const progressCount = getReadingProgress().length

  return (
    <div className="bg-white dark:bg-stone-900 rounded-xl p-5 border border-stone-200/60 dark:border-stone-700/60 shadow-sm space-y-5">
      {/* Book Language */}
      <div>
        <h3 className="text-base font-semibold text-stone-900 dark:text-stone-100 flex items-center gap-2 mb-1">
          <Globe className="w-4 h-4 text-stone-500" />
          Book Language
        </h3>
        <p className="text-xs text-stone-500 mb-2">
          Choose the language for book recommendations and search results.
        </p>
        <select
          value={language}
          onChange={(e) => handleLanguageChange(e.target.value as BookLanguage)}
          className="w-full h-10 px-3 rounded-xl border border-stone-200 dark:border-stone-700 bg-stone-50 dark:bg-stone-800/50 text-sm text-stone-900 dark:text-stone-100 focus:outline-none focus:ring-2 focus:ring-stone-300"
        >
          {Object.entries(LANGUAGE_LABELS).map(([value, label]) => (
            <option key={value} value={value}>
              {label}
            </option>
          ))}
        </select>
      </div>

      <div className="border-t border-stone-200/60 dark:border-stone-700/60" />

      <div>
        <h3 className="text-base font-semibold text-stone-900 dark:text-stone-100 flex items-center gap-2 mb-1">
          <Shield className="w-4 h-4 text-stone-500" />
          Data & Backup
        </h3>
        <p className="text-xs text-stone-500">
          Export your data to keep a backup, or import from a previous backup.
        </p>
      </div>

      {/* Current data summary */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
        <div className="bg-stone-50 dark:bg-stone-800/50 rounded-xl px-3 py-2">
          <p className="text-lg font-bold text-stone-900 dark:text-stone-100">{likedCount}</p>
          <p className="text-[11px] text-stone-500">Books</p>
        </div>
        <div className="bg-stone-50 dark:bg-stone-800/50 rounded-xl px-3 py-2">
          <p className="text-lg font-bold text-stone-900 dark:text-stone-100">{progressCount}</p>
          <p className="text-[11px] text-stone-500">Reading</p>
        </div>
        <div className="bg-stone-50 dark:bg-stone-800/50 rounded-xl px-3 py-2">
          <p className="text-lg font-bold text-stone-900 dark:text-stone-100">{reviewCount}</p>
          <p className="text-[11px] text-stone-500">Reviews</p>
        </div>
        <div className="bg-stone-50 dark:bg-stone-800/50 rounded-xl px-3 py-2">
          <p className="text-lg font-bold text-stone-900 dark:text-stone-100">{noteCount}</p>
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
          className="flex-1 h-10 border-stone-200 hover:bg-stone-50 dark:bg-stone-800/50 text-stone-700 dark:text-stone-300 rounded-xl text-sm"
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

      {/* Full Backup (JSON) */}
      <div className="pt-2 border-t border-stone-200/60 dark:border-stone-700/60 space-y-2">
        <p className="text-xs text-stone-500 font-medium">Full Backup (all data)</p>
        <div className="grid grid-cols-2 gap-2">
          <Button
            onClick={handleFullBackupExport}
            variant="outline"
            className="h-10 border-stone-200 hover:bg-stone-50 dark:bg-stone-800/50 text-stone-700 dark:text-stone-300 rounded-xl text-sm"
          >
            <HardDrive className="w-4 h-4 mr-1.5" />
            Export Full
          </Button>
          <Button
            onClick={() => fullBackupInputRef.current?.click()}
            variant="outline"
            className="h-10 border-stone-200 hover:bg-stone-50 dark:bg-stone-800/50 text-stone-700 dark:text-stone-300 rounded-xl text-sm"
          >
            <Upload className="w-4 h-4 mr-1.5" />
            Import Full
          </Button>
          <input
            ref={fullBackupInputRef}
            type="file"
            accept=".json"
            onChange={handleFullBackupFileSelect}
            className="hidden"
          />
        </div>
      </div>

      {/* Full Backup Import Confirmation */}
      {fullBackupPreview && (
        <div className="p-3 rounded-xl border border-blue-200 dark:border-blue-800 bg-blue-50 dark:bg-blue-900/30 space-y-2">
          <p className="text-sm font-medium text-blue-900 dark:text-blue-200">
            Confirm full restore
          </p>
          <p className="text-xs text-blue-700 dark:text-blue-300 leading-relaxed">
            This will overwrite your current data with: {fullBackupPreview.stats.books} books,{" "}
            {fullBackupPreview.stats.reviews} reviews, {fullBackupPreview.stats.notes} notes
            ({fullBackupPreview.stats.totalKeys} total entries).
          </p>
          <div className="flex gap-2">
            <Button
              onClick={handleFullBackupConfirm}
              disabled={importingFull}
              className="flex-1 h-9 bg-blue-600 hover:bg-blue-700 text-white font-medium rounded-xl text-sm"
            >
              <Check className="w-4 h-4 mr-1.5" />
              {importingFull ? "Restoring..." : "Confirm Restore"}
            </Button>
            <Button
              onClick={() => setFullBackupPreview(null)}
              disabled={importingFull}
              variant="outline"
              className="h-9 border-blue-200 dark:border-blue-700 text-blue-700 dark:text-blue-300 rounded-xl text-sm px-4"
            >
              <X className="w-4 h-4" />
            </Button>
          </div>
        </div>
      )}

      {/* Goodreads / Notion */}
      <div className="pt-2 border-t border-stone-200/60 dark:border-stone-700/60 space-y-2">
        <p className="text-xs text-stone-500 font-medium">Goodreads & Notion</p>
        <div className="grid grid-cols-2 gap-2">
          <Button
            onClick={() => setShowGoodreadsImport(true)}
            variant="outline"
            className="h-10 border-stone-200 hover:bg-stone-50 dark:bg-stone-800/50 text-stone-700 dark:text-stone-300 rounded-xl text-sm"
          >
            <Upload className="w-4 h-4 mr-1.5" />
            Import GR
          </Button>
          <Button
            onClick={() => {
              const csv = exportToGoodreadsCSV()
              const date = new Date().toISOString().split("T")[0]
              downloadCSV(csv, `goodreads-export-${date}.csv`)
              showToast("Goodreads CSV exported")
            }}
            variant="outline"
            className="h-10 border-stone-200 hover:bg-stone-50 dark:bg-stone-800/50 text-stone-700 dark:text-stone-300 rounded-xl text-sm"
          >
            <BookOpen className="w-4 h-4 mr-1.5" />
            Export GR
          </Button>
        </div>
        <Button
          onClick={() => {
            const csv = exportToNotionCSV()
            const date = new Date().toISOString().split("T")[0]
            downloadCSV(csv, `notion-books-${date}.csv`)
            showToast("Notion CSV exported")
          }}
          variant="outline"
          className="w-full h-10 border-stone-200 hover:bg-stone-50 dark:bg-stone-800/50 text-stone-700 dark:text-stone-300 rounded-xl text-sm"
        >
          <FileSpreadsheet className="w-4 h-4 mr-2" />
          Export for Notion
        </Button>
      </div>

      {/* Warning */}
      <div className="flex gap-2 p-3 rounded-lg bg-amber-50 dark:bg-amber-900/30 border border-amber-100">
        <AlertTriangle className="w-4 h-4 text-amber-600 flex-shrink-0 mt-0.5" />
        <p className="text-xs text-amber-700 dark:text-amber-400 leading-relaxed">
          Your data is stored in this browser only. Clearing browser data will erase it.
          Export backups regularly to avoid data loss.
        </p>
      </div>

      {/* Goodreads Import Modal */}
      <GoodreadsImport
        isOpen={showGoodreadsImport}
        onClose={() => setShowGoodreadsImport(false)}
        onComplete={() => onBooksLoaded(getLikedBooks())}
      />
    </div>
  )
}
