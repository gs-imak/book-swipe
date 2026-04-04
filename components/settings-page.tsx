"use client"

import { useState, useEffect, useRef } from "react"
import { motion, AnimatePresence } from "framer-motion"
import {
  ArrowLeft,
  Sun,
  Moon,
  Globe,
  Gauge,
  Download,
  Upload,
  Trash2,
  Info,
  BookOpen,
  FileSpreadsheet,
  ChevronRight,
  Check,
  AlertTriangle,
  HardDrive,
  Shield,
} from "lucide-react"
import { getTheme, setTheme, applyTheme } from "@/lib/theme"
import {
  getReadingSpeed,
  setReadingSpeed,
  getAllSpeeds,
  type ReadingSpeed,
} from "@/lib/reading-time"
import {
  getLanguagePreference,
  setLanguagePreference,
  LANGUAGE_LABELS,
  type BookLanguage,
} from "@/lib/language-preference"
import {
  exportToGoodreadsCSV,
  exportToNotionCSV,
  downloadCSV,
  exportFullBackupJSON,
  importFullBackupJSON,
  previewFullBackupJSON,
  downloadJSON,
} from "@/lib/export-utils"
import { markBackupExported } from "@/lib/storage"
import { useToast } from "./toast-provider"

interface SettingsPageProps {
  onBack: () => void
}

const sectionVariants = {
  hidden: { opacity: 0, y: 16 },
  visible: (i: number) => ({
    opacity: 1,
    y: 0,
    transition: { delay: i * 0.07, duration: 0.4, ease: [0.25, 0.46, 0.45, 0.94] },
  }),
}

export function SettingsPage({ onBack }: SettingsPageProps) {
  const [currentTheme, setCurrentTheme] = useState<"light" | "dark">("light")
  const [speed, setSpeed] = useState<ReadingSpeed>("average")
  const [language, setLanguage] = useState<BookLanguage>("en")
  const [showClearConfirm, setShowClearConfirm] = useState(false)
  const [backupPreview, setBackupPreview] = useState<{
    json: string
    stats: { books: number; reviews: number; notes: number; totalKeys: number }
  } | null>(null)
  const [importingFull, setImportingFull] = useState(false)

  const fullBackupInputRef = useRef<HTMLInputElement>(null)
  const { showToast } = useToast()

  useEffect(() => {
    setCurrentTheme(getTheme())
    setSpeed(getReadingSpeed())
    setLanguage(getLanguagePreference())
  }, [])

  const handleThemeToggle = () => {
    const next = currentTheme === "dark" ? "light" : "dark"
    setCurrentTheme(next)
    setTheme(next)
    applyTheme(next)
  }

  const handleSpeedChange = (newSpeed: ReadingSpeed) => {
    setSpeed(newSpeed)
    setReadingSpeed(newSpeed)
  }

  const handleLanguageChange = (lang: BookLanguage) => {
    setLanguage(lang)
    setLanguagePreference(lang)
    showToast(`Language set to ${LANGUAGE_LABELS[lang]}. Book cache cleared.`)
  }

  const handleGoodreadsExport = () => {
    const csv = exportToGoodreadsCSV()
    const date = new Date().toISOString().split("T")[0]
    downloadCSV(csv, `goodreads-export-${date}.csv`)
    showToast("Goodreads CSV exported")
  }

  const handleNotionExport = () => {
    const csv = exportToNotionCSV()
    const date = new Date().toISOString().split("T")[0]
    downloadCSV(csv, `notion-books-${date}.csv`)
    showToast("Notion CSV exported")
  }

  const handleFullBackup = () => {
    const json = exportFullBackupJSON()
    const date = new Date().toISOString().split("T")[0]
    downloadJSON(json, `bookswipe-full-backup-${date}.json`)
    markBackupExported()
    showToast("Full backup downloaded")
  }

  const handleImportFileSelect = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (!file) return

    try {
      const text = await file.text()
      const preview = previewFullBackupJSON(text)

      if (!preview.success || !preview.stats) {
        showToast(preview.error || "Invalid backup file", "error")
        return
      }

      setBackupPreview({ json: text, stats: preview.stats })
    } catch {
      showToast("Failed to read file", "error")
    } finally {
      if (fullBackupInputRef.current) fullBackupInputRef.current.value = ""
    }
  }

  const handleImportConfirm = () => {
    if (!backupPreview) return
    setImportingFull(true)

    const result = importFullBackupJSON(backupPreview.json)

    if (result.success) {
      showToast(`Restored ${result.stats?.totalKeys || 0} data entries`)
      setBackupPreview(null)
      setTimeout(() => window.location.reload(), 600)
    } else {
      showToast(result.error || "Import failed", "error")
      setImportingFull(false)
    }
  }

  const handleClearAllData = () => {
    if (!showClearConfirm) {
      setShowClearConfirm(true)
      return
    }

    const keys: string[] = []
    for (let i = 0; i < localStorage.length; i++) {
      const key = localStorage.key(i)
      if (key && key.startsWith("bookswipe_")) {
        keys.push(key)
      }
    }
    keys.forEach((key) => localStorage.removeItem(key))
    showToast(`Cleared ${keys.length} data entries`)
    setShowClearConfirm(false)
    setTimeout(() => window.location.reload(), 600)
  }

  const speeds = getAllSpeeds()

  return (
    <div className="min-h-screen bg-background">
      {/* Sticky header */}
      <motion.header
        initial={{ opacity: 0, y: -12 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.3 }}
        className="sticky top-0 z-40 bg-background/90 backdrop-blur-xl border-b border-stone-200/60 dark:border-stone-700/60"
      >
        <div className="max-w-lg mx-auto px-4 py-3.5 flex items-center gap-3">
          <motion.button
            onClick={onBack}
            whileTap={{ scale: 0.92 }}
            className="w-10 h-10 flex items-center justify-center rounded-xl bg-stone-100 dark:bg-stone-800 hover:bg-stone-200 dark:hover:bg-stone-700 transition-colors tap-target"
            aria-label="Go back"
          >
            <ArrowLeft className="w-5 h-5 text-stone-700 dark:text-stone-300" />
          </motion.button>
          <h1 className="text-xl font-serif font-semibold text-stone-900 dark:text-stone-100 tracking-tight">
            Settings
          </h1>
        </div>
      </motion.header>

      <div className="max-w-lg mx-auto px-4 pt-5 pb-20 space-y-4">

        {/* ─── Reading ─── */}
        <motion.section
          custom={1}
          initial="hidden"
          animate="visible"
          variants={sectionVariants}
          className="bg-white dark:bg-stone-900 rounded-2xl border border-stone-200/60 dark:border-stone-700/60 shadow-sm overflow-hidden"
        >
          <div className="px-5 pt-4 pb-2">
            <h2 className="text-base font-serif font-semibold text-stone-900 dark:text-stone-100 flex items-center gap-2.5">
              <Gauge className="w-[18px] h-[18px] text-amber-600 dark:text-amber-500" />
              Reading
            </h2>
          </div>

          <div className="px-5 pb-4 space-y-4">
            {/* Reading speed */}
            <div>
              <p className="text-sm font-medium text-stone-800 dark:text-stone-200 mb-1">Reading speed</p>
              <p className="text-xs text-stone-500 dark:text-stone-400 mb-3">
                Affects estimated reading time on book details
              </p>
              <div className="flex gap-2">
                {speeds.map((s) => (
                  <button
                    key={s.value}
                    onClick={() => handleSpeedChange(s.value)}
                    className={`flex-1 py-2.5 px-2 rounded-xl text-xs font-medium transition-all duration-200 border ${
                      speed === s.value
                        ? "bg-amber-600 text-white border-amber-600 shadow-sm"
                        : "bg-stone-50 dark:bg-stone-800/50 text-stone-600 dark:text-stone-400 border-stone-200 dark:border-stone-700 hover:border-amber-300 dark:hover:border-amber-700"
                    }`}
                    aria-pressed={speed === s.value}
                  >
                    <span className="block text-center leading-tight">
                      {s.value === "slow" ? "Relaxed" : s.value === "average" ? "Average" : "Speed"}
                    </span>
                    <span className={`block text-center text-[10px] mt-0.5 ${
                      speed === s.value ? "text-amber-100" : "text-stone-400 dark:text-stone-500"
                    }`}>
                      {s.value === "slow" ? "150 wpm" : s.value === "average" ? "250 wpm" : "400 wpm"}
                    </span>
                  </button>
                ))}
              </div>
            </div>

            {/* Divider */}
            <div className="border-t border-stone-100 dark:border-stone-800" />

            {/* Language preference */}
            <div>
              <div className="flex items-center gap-2 mb-1">
                <Globe className="w-4 h-4 text-stone-400" />
                <p className="text-sm font-medium text-stone-800 dark:text-stone-200">Book language</p>
              </div>
              <p className="text-xs text-stone-500 dark:text-stone-400 mb-2.5">
                Filter book recommendations and search results by language
              </p>
              <select
                value={language}
                onChange={(e) => handleLanguageChange(e.target.value as BookLanguage)}
                className="w-full h-11 px-3.5 rounded-xl border border-stone-200 dark:border-stone-700 bg-stone-50 dark:bg-stone-800/50 text-sm text-stone-900 dark:text-stone-100 focus:outline-none focus:ring-2 focus:ring-amber-500/40 focus:border-amber-500 transition-all appearance-none cursor-pointer"
                aria-label="Select book language"
              >
                {Object.entries(LANGUAGE_LABELS).map(([value, label]) => (
                  <option key={value} value={value}>
                    {label}
                  </option>
                ))}
              </select>
            </div>
          </div>
        </motion.section>

        {/* ─── Data & Privacy ─── */}
        <motion.section
          custom={2}
          initial="hidden"
          animate="visible"
          variants={sectionVariants}
          className="bg-white dark:bg-stone-900 rounded-2xl border border-stone-200/60 dark:border-stone-700/60 shadow-sm overflow-hidden"
        >
          <div className="px-5 pt-4 pb-2">
            <h2 className="text-base font-serif font-semibold text-stone-900 dark:text-stone-100 flex items-center gap-2.5">
              <Shield className="w-[18px] h-[18px] text-amber-600 dark:text-amber-500" />
              Data & Privacy
            </h2>
          </div>

          <div className="px-5 pb-4 space-y-3">

            {/* Export row - Goodreads */}
            <button
              onClick={handleGoodreadsExport}
              className="w-full flex items-center gap-3 py-3 px-3.5 rounded-xl bg-stone-50 dark:bg-stone-800/50 hover:bg-stone-100 dark:hover:bg-stone-800 border border-stone-200/60 dark:border-stone-700/60 transition-colors group"
            >
              <div className="w-9 h-9 rounded-lg bg-amber-50 dark:bg-amber-900/30 flex items-center justify-center flex-shrink-0">
                <BookOpen className="w-4.5 h-4.5 text-amber-700 dark:text-amber-400" />
              </div>
              <div className="text-left flex-1 min-w-0">
                <p className="text-sm font-medium text-stone-800 dark:text-stone-200">Export for Goodreads</p>
                <p className="text-[11px] text-stone-500 dark:text-stone-400">CSV format compatible with Goodreads</p>
              </div>
              <Download className="w-4 h-4 text-stone-400 group-hover:text-amber-600 transition-colors flex-shrink-0" />
            </button>

            {/* Export row - Notion */}
            <button
              onClick={handleNotionExport}
              className="w-full flex items-center gap-3 py-3 px-3.5 rounded-xl bg-stone-50 dark:bg-stone-800/50 hover:bg-stone-100 dark:hover:bg-stone-800 border border-stone-200/60 dark:border-stone-700/60 transition-colors group"
            >
              <div className="w-9 h-9 rounded-lg bg-stone-100 dark:bg-stone-700/50 flex items-center justify-center flex-shrink-0">
                <FileSpreadsheet className="w-4.5 h-4.5 text-stone-600 dark:text-stone-300" />
              </div>
              <div className="text-left flex-1 min-w-0">
                <p className="text-sm font-medium text-stone-800 dark:text-stone-200">Export for Notion</p>
                <p className="text-[11px] text-stone-500 dark:text-stone-400">Rich CSV with genres, moods, and notes</p>
              </div>
              <Download className="w-4 h-4 text-stone-400 group-hover:text-amber-600 transition-colors flex-shrink-0" />
            </button>

            {/* Divider */}
            <div className="border-t border-stone-100 dark:border-stone-800" />

            {/* Full backup */}
            <button
              onClick={handleFullBackup}
              className="w-full flex items-center gap-3 py-3 px-3.5 rounded-xl bg-stone-50 dark:bg-stone-800/50 hover:bg-stone-100 dark:hover:bg-stone-800 border border-stone-200/60 dark:border-stone-700/60 transition-colors group"
            >
              <div className="w-9 h-9 rounded-lg bg-emerald-50 dark:bg-emerald-900/30 flex items-center justify-center flex-shrink-0">
                <HardDrive className="w-4.5 h-4.5 text-emerald-700 dark:text-emerald-400" />
              </div>
              <div className="text-left flex-1 min-w-0">
                <p className="text-sm font-medium text-stone-800 dark:text-stone-200">Full backup</p>
                <p className="text-[11px] text-stone-500 dark:text-stone-400">Download all data as JSON</p>
              </div>
              <Download className="w-4 h-4 text-stone-400 group-hover:text-emerald-600 transition-colors flex-shrink-0" />
            </button>

            {/* Import backup */}
            <button
              onClick={() => fullBackupInputRef.current?.click()}
              className="w-full flex items-center gap-3 py-3 px-3.5 rounded-xl bg-stone-50 dark:bg-stone-800/50 hover:bg-stone-100 dark:hover:bg-stone-800 border border-stone-200/60 dark:border-stone-700/60 transition-colors group"
            >
              <div className="w-9 h-9 rounded-lg bg-blue-50 dark:bg-blue-900/30 flex items-center justify-center flex-shrink-0">
                <Upload className="w-4.5 h-4.5 text-blue-700 dark:text-blue-400" />
              </div>
              <div className="text-left flex-1 min-w-0">
                <p className="text-sm font-medium text-stone-800 dark:text-stone-200">Import backup</p>
                <p className="text-[11px] text-stone-500 dark:text-stone-400">Restore from a JSON backup file</p>
              </div>
              <Upload className="w-4 h-4 text-stone-400 group-hover:text-blue-600 transition-colors flex-shrink-0" />
            </button>
            <input
              ref={fullBackupInputRef}
              type="file"
              accept=".json"
              onChange={handleImportFileSelect}
              className="hidden"
              aria-label="Select backup file to import"
            />

            {/* Import preview modal */}
            <AnimatePresence>
              {backupPreview && (
                <motion.div
                  initial={{ opacity: 0, height: 0 }}
                  animate={{ opacity: 1, height: "auto" }}
                  exit={{ opacity: 0, height: 0 }}
                  className="overflow-hidden"
                >
                  <div className="p-4 rounded-xl bg-blue-50 dark:bg-blue-950/40 border border-blue-200 dark:border-blue-800 space-y-3">
                    <p className="text-sm font-medium text-blue-900 dark:text-blue-200">
                      Backup file contents
                    </p>
                    <div className="grid grid-cols-3 gap-2">
                      <div className="text-center">
                        <p className="text-lg font-bold text-blue-800 dark:text-blue-200">{backupPreview.stats.books}</p>
                        <p className="text-[10px] text-blue-600 dark:text-blue-400">Books</p>
                      </div>
                      <div className="text-center">
                        <p className="text-lg font-bold text-blue-800 dark:text-blue-200">{backupPreview.stats.reviews}</p>
                        <p className="text-[10px] text-blue-600 dark:text-blue-400">Reviews</p>
                      </div>
                      <div className="text-center">
                        <p className="text-lg font-bold text-blue-800 dark:text-blue-200">{backupPreview.stats.notes}</p>
                        <p className="text-[10px] text-blue-600 dark:text-blue-400">Notes</p>
                      </div>
                    </div>
                    <div className="flex gap-2">
                      <button
                        onClick={handleImportConfirm}
                        disabled={importingFull}
                        className="flex-1 py-2.5 rounded-xl bg-blue-600 hover:bg-blue-700 text-white text-sm font-medium transition-colors disabled:opacity-50"
                      >
                        {importingFull ? "Restoring..." : "Confirm restore"}
                      </button>
                      <button
                        onClick={() => setBackupPreview(null)}
                        className="py-2.5 px-4 rounded-xl bg-white dark:bg-stone-800 text-stone-700 dark:text-stone-300 text-sm font-medium border border-stone-200 dark:border-stone-700 hover:bg-stone-50 dark:hover:bg-stone-700 transition-colors"
                      >
                        Cancel
                      </button>
                    </div>
                  </div>
                </motion.div>
              )}
            </AnimatePresence>

            {/* Divider */}
            <div className="border-t border-stone-100 dark:border-stone-800" />

            {/* Clear all data */}
            <div>
              <AnimatePresence mode="wait">
                {!showClearConfirm ? (
                  <motion.button
                    key="clear-btn"
                    initial={{ opacity: 1 }}
                    exit={{ opacity: 0 }}
                    onClick={() => setShowClearConfirm(true)}
                    className="w-full flex items-center gap-3 py-3 px-3.5 rounded-xl hover:bg-red-50 dark:hover:bg-red-950/30 border border-transparent hover:border-red-200 dark:hover:border-red-900/60 transition-all group"
                  >
                    <div className="w-9 h-9 rounded-lg bg-red-50 dark:bg-red-900/30 flex items-center justify-center flex-shrink-0">
                      <Trash2 className="w-4.5 h-4.5 text-red-600 dark:text-red-400" />
                    </div>
                    <div className="text-left flex-1 min-w-0">
                      <p className="text-sm font-medium text-red-700 dark:text-red-400">Clear all data</p>
                      <p className="text-[11px] text-stone-500 dark:text-stone-400">Permanently remove all BookSwipe data</p>
                    </div>
                    <ChevronRight className="w-4 h-4 text-stone-300 dark:text-stone-600 flex-shrink-0" />
                  </motion.button>
                ) : (
                  <motion.div
                    key="confirm"
                    initial={{ opacity: 0, scale: 0.97 }}
                    animate={{ opacity: 1, scale: 1 }}
                    exit={{ opacity: 0, scale: 0.97 }}
                    className="p-4 rounded-xl bg-red-50 dark:bg-red-950/40 border border-red-200 dark:border-red-800 space-y-3"
                  >
                    <div className="flex items-start gap-2.5">
                      <AlertTriangle className="w-5 h-5 text-red-600 dark:text-red-400 flex-shrink-0 mt-0.5" />
                      <div>
                        <p className="text-sm font-semibold text-red-800 dark:text-red-200">
                          Are you sure?
                        </p>
                        <p className="text-xs text-red-700/80 dark:text-red-300/80 mt-1 leading-relaxed">
                          This will permanently delete all your books, reading progress, reviews, notes, and preferences. This action cannot be undone.
                        </p>
                      </div>
                    </div>
                    <div className="flex gap-2">
                      <button
                        onClick={handleClearAllData}
                        className="flex-1 py-2.5 rounded-xl bg-red-600 hover:bg-red-700 text-white text-sm font-medium transition-colors"
                      >
                        Yes, delete everything
                      </button>
                      <button
                        onClick={() => setShowClearConfirm(false)}
                        className="py-2.5 px-4 rounded-xl bg-white dark:bg-stone-800 text-stone-700 dark:text-stone-300 text-sm font-medium border border-stone-200 dark:border-stone-700 hover:bg-stone-50 dark:hover:bg-stone-700 transition-colors"
                      >
                        Cancel
                      </button>
                    </div>
                  </motion.div>
                )}
              </AnimatePresence>
            </div>
          </div>
        </motion.section>

        {/* ─── About ─── */}
        <motion.section
          custom={3}
          initial="hidden"
          animate="visible"
          variants={sectionVariants}
          className="bg-white dark:bg-stone-900 rounded-2xl border border-stone-200/60 dark:border-stone-700/60 shadow-sm overflow-hidden"
        >
          <div className="px-5 pt-4 pb-2">
            <h2 className="text-base font-serif font-semibold text-stone-900 dark:text-stone-100 flex items-center gap-2.5">
              <Info className="w-[18px] h-[18px] text-amber-600 dark:text-amber-500" />
              About
            </h2>
          </div>

          <div className="px-5 pb-5 space-y-3">
            <div className="flex items-center justify-between py-1">
              <p className="text-sm text-stone-600 dark:text-stone-400">Version</p>
              <p className="text-sm font-medium text-stone-800 dark:text-stone-200">1.0.0</p>
            </div>
            <div className="border-t border-stone-100 dark:border-stone-800" />
            <div className="flex gap-2.5 p-3 rounded-xl bg-amber-50/60 dark:bg-amber-950/20 border border-amber-100 dark:border-amber-900/40">
              <Shield className="w-4 h-4 text-amber-600 dark:text-amber-500 flex-shrink-0 mt-0.5" />
              <p className="text-xs text-amber-800 dark:text-amber-300/90 leading-relaxed">
                All your data is stored locally in your browser. Nothing is sent to any server. Export backups regularly to avoid data loss.
              </p>
            </div>
          </div>
        </motion.section>

      </div>
    </div>
  )
}
