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
  LogOut,
  UserX,
  Mail,
  FileText,
  Loader2,
  Languages,
} from "lucide-react"
import { setTheme, applyTheme } from "@/lib/theme"
import { useTheme } from "@/lib/use-theme"
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
import { isSupabaseConfigured } from "@/lib/supabase"
import { getUser, signOut, deleteAccount } from "@/lib/supabase-sync"
import { useToast } from "./toast-provider"
import { t, LOCALE_LABELS, LOCALES, type Locale } from "@/lib/i18n"
import { useI18n } from "@/components/i18n-provider"

// Update to your real support address before launch.
const SUPPORT_EMAIL = "hello@bookswipe.app"

interface SettingsPageProps {
  onBack: () => void
  /** Opens the auth modal. Settings only knew how to sign OUT, so on a phone —
   *  where the sidebar's sign-in control is `hidden lg:flex` — there was no
   *  route into an account at all. */
  onSignIn?: () => void
}

const sectionVariants = {
  hidden: { opacity: 0, y: 16 },
  visible: (i: number) => ({
    opacity: 1,
    y: 0,
    transition: { delay: i * 0.07, duration: 0.4, ease: [0.25, 0.46, 0.45, 0.94] },
  }),
}

export function SettingsPage({ onBack, onSignIn }: SettingsPageProps) {
  // Subscribed to the theme store — shares one source of truth with the nav.
  const currentTheme = useTheme()
  const [speed, setSpeed] = useState<ReadingSpeed>(() => getReadingSpeed())
  const { locale, setLocale } = useI18n()
  const [language, setLanguage] = useState<BookLanguage>(() => getLanguagePreference())
  const [showClearConfirm, setShowClearConfirm] = useState(false)
  const [backupPreview, setBackupPreview] = useState<{
    json: string
    stats: { books: number; reviews: number; notes: number; totalKeys: number }
  } | null>(null)
  const [importingFull, setImportingFull] = useState(false)
  const [userEmail, setUserEmail] = useState<string | null>(null)
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false)
  const [deletingAccount, setDeletingAccount] = useState(false)

  const fullBackupInputRef = useRef<HTMLInputElement>(null)
  const { showToast } = useToast()

  useEffect(() => {
    // Async fetch — setState in .then is the intended subscription pattern.
    if (isSupabaseConfigured()) {
      getUser().then((u) => setUserEmail(u?.email ?? null))
    }
  }, [])

  const handleSignOut = async () => {
    await signOut()
    showToast(t("settings_page.signed_out"))
    setUserEmail(null)
  }

  const handleDeleteAccount = async () => {
    setDeletingAccount(true)
    const result = await deleteAccount()
    if (result.ok) {
      // Account + cloud data gone; also wipe this device's local copy.
      const keys: string[] = []
      for (let i = 0; i < localStorage.length; i++) {
        const key = localStorage.key(i)
        if (key && key.startsWith("bookswipe_")) keys.push(key)
      }
      keys.forEach((key) => localStorage.removeItem(key))
      showToast(t("settings_page.account_deleted"))
      setTimeout(() => window.location.reload(), 800)
    } else {
      showToast(result.reason || "Could not delete account", "error")
      setDeletingAccount(false)
      setShowDeleteConfirm(false)
    }
  }

  const handleThemeToggle = () => {
    const next = currentTheme === "dark" ? "light" : "dark"
    setTheme(next)
    applyTheme(next)
  }

  const handleSpeedChange = (newSpeed: ReadingSpeed) => {
    setSpeed(newSpeed)
    setReadingSpeed(newSpeed)
  }

  // Changing the app language remounts the tree (see components/i18n-provider),
  // so the toast is queued by the provider's new subtree, not this one.
  const handleLocaleChange = (next: Locale) => {
    setLocale(next)
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
    showToast(t("admin_panel.goodreads_csv_exported"))
  }

  const handleNotionExport = () => {
    const csv = exportToNotionCSV()
    const date = new Date().toISOString().split("T")[0]
    downloadCSV(csv, `notion-books-${date}.csv`)
    showToast(t("admin_panel.notion_csv_exported"))
  }

  const handleFullBackup = () => {
    const json = exportFullBackupJSON()
    const date = new Date().toISOString().split("T")[0]
    downloadJSON(json, `bookswipe-full-backup-${date}.json`)
    markBackupExported()
    showToast(t("admin_panel.full_backup_downloaded"))
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
      showToast(t("admin_panel.failed_to_read_file"), "error")
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
            aria-label={t("common.go_back")}
          >
            <ArrowLeft className="w-5 h-5 text-stone-700 dark:text-stone-300" />
          </motion.button>
          <h1 className="text-xl font-serif font-semibold text-stone-900 dark:text-stone-100 tracking-tight"> {t("settings_page.settings")} </h1>
        </div>
      </motion.header>

      <div className="max-w-lg mx-auto px-4 pt-5 pb-20 space-y-4">

        {/* ─── Appearance ───
            handleThemeToggle existed here with no control wired to it, so the
            theme could only be changed from the desktop sidebar — which is
            `hidden lg:flex`. On a phone there was no way to switch theme at
            all. */}
        <motion.section
          custom={0}
          initial="hidden"
          animate="visible"
          variants={sectionVariants}
          className="bg-white dark:bg-stone-900 rounded-2xl border border-stone-200/60 dark:border-stone-700/60 shadow-sm overflow-hidden"
        >
          <div className="px-5 pt-4 pb-2">
            <h2 className="text-base font-serif font-semibold text-stone-900 dark:text-stone-100 flex items-center gap-2.5">
              {currentTheme === "dark" ? (
                <Moon className="w-[18px] h-[18px] text-amber-600 dark:text-amber-500" />
              ) : (
                <Sun className="w-[18px] h-[18px] text-amber-600 dark:text-amber-500" />
              )} {t("settings_page.appearance")} </h2>
          </div>

          <div className="px-5 pb-4">
            <button
              onClick={handleThemeToggle}
              aria-pressed={currentTheme === "dark"}
              className="w-full min-h-[44px] flex items-center justify-between gap-4 rounded-xl px-4 py-2.5 border border-stone-200/70 dark:border-stone-700/70 hover:bg-stone-50 dark:hover:bg-stone-800/60 transition-colors"
            >
              <span className="text-left">
                <span className="block text-sm font-medium text-stone-800 dark:text-stone-200"> {t("settings_page.dark_mode")} </span>
                <span className="block text-xs text-stone-500 dark:text-stone-400">
                  {currentTheme === "dark" ? "On" : "Off"}
                </span>
              </span>
              <span
                aria-hidden="true"
                className={`relative inline-flex h-6 w-11 shrink-0 rounded-full transition-colors ${
                  currentTheme === "dark" ? "bg-amber-600" : "bg-stone-300 dark:bg-stone-600"
                }`}
              >
                <span
                  className={`absolute top-0.5 h-5 w-5 rounded-full bg-white transition-transform ${
                    currentTheme === "dark" ? t("settings_page.translate_x_22px") : t("settings_page.translate_x_0_5")
                  }`}
                />
              </span>
            </button>
          </div>
        </motion.section>

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
              <Gauge className="w-[18px] h-[18px] text-amber-600 dark:text-amber-500" /> {t("settings_page.reading")} </h2>
          </div>

          <div className="px-5 pb-4 space-y-4">
            {/* Reading speed */}
            <div>
              <p className="text-sm font-medium text-stone-800 dark:text-stone-200 mb-1">{t("settings_page.reading_speed")}</p>
              <p className="text-xs text-stone-500 dark:text-stone-400 mb-3"> {t("settings_page.affects_estimated_reading_time_on_book")} </p>
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
                      {s.value === "slow" ? t("settings_page.150_wpm") : s.value === "average" ? t("settings_page.250_wpm") : t("settings_page.400_wpm")}
                    </span>
                  </button>
                ))}
              </div>
            </div>

            {/* Divider */}
            <div className="border-t border-stone-100 dark:border-stone-800" />

            {/* App language */}
            <div>
              <div className="flex items-center gap-2 mb-1">
                <Languages className="w-4 h-4 text-stone-400" />
                <p className="text-sm font-medium text-stone-800 dark:text-stone-200">{t("settings_page.app_language")}</p>
              </div>
              <p className="text-xs text-stone-500 dark:text-stone-400 mb-2.5">{t("settings_page.the_language_bookswipe_speaks")}</p>
              <select
                value={locale}
                onChange={(e) => handleLocaleChange(e.target.value as Locale)}
                className="w-full h-11 px-3.5 rounded-xl border border-stone-200 dark:border-stone-700 bg-stone-50 dark:bg-stone-800/50 text-sm text-stone-900 dark:text-stone-100 focus:outline-none focus:ring-2 focus:ring-amber-500/40 focus:border-amber-500 transition-all appearance-none cursor-pointer"
                aria-label={t("settings_page.select_app_language")}
              >
                {LOCALES.map((value) => (
                  <option key={value} value={value}>
                    {LOCALE_LABELS[value]}
                  </option>
                ))}
              </select>
            </div>

            {/* Divider */}
            <div className="border-t border-stone-100 dark:border-stone-800" />

            {/* Book language */}
            <div>
              <div className="flex items-center gap-2 mb-1">
                <Globe className="w-4 h-4 text-stone-400" />
                <p className="text-sm font-medium text-stone-800 dark:text-stone-200">{t("settings_page.book_language")}</p>
              </div>
              <p className="text-xs text-stone-500 dark:text-stone-400 mb-2.5"> {t("settings_page.filter_book_recommendations_and_search_resul")} </p>
              <select
                value={language}
                onChange={(e) => handleLanguageChange(e.target.value as BookLanguage)}
                className="w-full h-11 px-3.5 rounded-xl border border-stone-200 dark:border-stone-700 bg-stone-50 dark:bg-stone-800/50 text-sm text-stone-900 dark:text-stone-100 focus:outline-none focus:ring-2 focus:ring-amber-500/40 focus:border-amber-500 transition-all appearance-none cursor-pointer"
                aria-label={t("settings_page.select_book_language")}
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
              <Shield className="w-[18px] h-[18px] text-amber-600 dark:text-amber-500" /> {t("settings_page.data_privacy")} </h2>
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
                <p className="text-sm font-medium text-stone-800 dark:text-stone-200">{t("settings_page.export_for_goodreads")}</p>
                <p className="text-[11px] text-stone-500 dark:text-stone-400">{t("settings_page.csv_format_compatible_with_goodreads")}</p>
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
                <p className="text-sm font-medium text-stone-800 dark:text-stone-200">{t("settings_page.export_for_notion")}</p>
                <p className="text-[11px] text-stone-500 dark:text-stone-400">{t("settings_page.rich_csv_with_genres_moods_and")}</p>
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
                <p className="text-sm font-medium text-stone-800 dark:text-stone-200">{t("settings_page.full_backup")}</p>
                <p className="text-[11px] text-stone-500 dark:text-stone-400">{t("settings_page.download_all_data_as_json")}</p>
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
                <p className="text-sm font-medium text-stone-800 dark:text-stone-200">{t("settings_page.import_backup")}</p>
                <p className="text-[11px] text-stone-500 dark:text-stone-400">{t("settings_page.restore_from_a_json_backup_file")}</p>
              </div>
              <Upload className="w-4 h-4 text-stone-400 group-hover:text-blue-600 transition-colors flex-shrink-0" />
            </button>
            <input
              ref={fullBackupInputRef}
              type="file"
              accept=".json"
              onChange={handleImportFileSelect}
              className="hidden"
              aria-label={t("settings_page.select_backup_file_to_import")}
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
                    <p className="text-sm font-medium text-blue-900 dark:text-blue-200"> {t("settings_page.backup_file_contents")} </p>
                    <div className="grid grid-cols-3 gap-2">
                      <div className="text-center">
                        <p className="text-lg font-bold text-blue-800 dark:text-blue-200">{backupPreview.stats.books}</p>
                        <p className="text-[10px] text-blue-600 dark:text-blue-400">{t("common.books")}</p>
                      </div>
                      <div className="text-center">
                        <p className="text-lg font-bold text-blue-800 dark:text-blue-200">{backupPreview.stats.reviews}</p>
                        <p className="text-[10px] text-blue-600 dark:text-blue-400">{t("settings_page.reviews")}</p>
                      </div>
                      <div className="text-center">
                        <p className="text-lg font-bold text-blue-800 dark:text-blue-200">{backupPreview.stats.notes}</p>
                        <p className="text-[10px] text-blue-600 dark:text-blue-400">{t("common.notes")}</p>
                      </div>
                    </div>
                    <div className="flex gap-2">
                      <button
                        onClick={handleImportConfirm}
                        disabled={importingFull}
                        className="flex-1 py-2.5 rounded-xl bg-blue-600 hover:bg-blue-700 text-white text-sm font-medium transition-colors disabled:opacity-50"
                      >
                        {importingFull ? t("admin_panel.restoring") : t("settings_page.confirm_restore")}
                      </button>
                      <button
                        onClick={() => setBackupPreview(null)}
                        className="py-2.5 px-4 rounded-xl bg-white dark:bg-stone-800 text-stone-700 dark:text-stone-300 text-sm font-medium border border-stone-200 dark:border-stone-700 hover:bg-stone-50 dark:hover:bg-stone-700 transition-colors"
                      > {t("common.cancel")} </button>
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
                      <p className="text-sm font-medium text-red-700 dark:text-red-400">{t("settings_page.clear_all_data")}</p>
                      <p className="text-[11px] text-stone-500 dark:text-stone-400">{t("settings_page.permanently_remove_all_bookswipe_data")}</p>
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
                        <p className="text-sm font-semibold text-red-800 dark:text-red-200"> {t("settings_page.are_you_sure")} </p>
                        <p className="text-xs text-red-700/80 dark:text-red-300/80 mt-1 leading-relaxed"> {t("settings_page.this_will_permanently_delete_all_your")} </p>
                      </div>
                    </div>
                    <div className="flex gap-2">
                      <button
                        onClick={handleClearAllData}
                        className="flex-1 py-2.5 rounded-xl bg-red-600 hover:bg-red-700 text-white text-sm font-medium transition-colors"
                      > {t("settings_page.yes_delete_everything")} </button>
                      <button
                        onClick={() => setShowClearConfirm(false)}
                        className="py-2.5 px-4 rounded-xl bg-white dark:bg-stone-800 text-stone-700 dark:text-stone-300 text-sm font-medium border border-stone-200 dark:border-stone-700 hover:bg-stone-50 dark:hover:bg-stone-700 transition-colors"
                      > {t("common.cancel")} </button>
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
              <Info className="w-[18px] h-[18px] text-amber-600 dark:text-amber-500" /> {t("settings_page.about")} </h2>
          </div>

          <div className="px-5 pb-5 space-y-3">
            <div className="flex items-center justify-between py-1">
              <p className="text-sm text-stone-600 dark:text-stone-400">{t("settings_page.version")}</p>
              <p className="text-sm font-medium text-stone-800 dark:text-stone-200">1.0.0</p>
            </div>
            <div className="border-t border-stone-100 dark:border-stone-800" />

            {/* Legal + support links */}
            <a
              href="/privacy"
              target="_blank"
              rel="noopener noreferrer"
              className="w-full flex items-center gap-3 py-2.5 px-3.5 rounded-xl hover:bg-stone-50 dark:hover:bg-stone-800/50 transition-colors group"
            >
              <Shield className="w-4 h-4 text-stone-400 flex-shrink-0" />
              <span className="text-sm text-stone-700 dark:text-stone-300 flex-1 text-left">{t("settings_page.privacy_policy")}</span>
              <ChevronRight className="w-4 h-4 text-stone-300 dark:text-stone-600" />
            </a>
            <a
              href="/terms"
              target="_blank"
              rel="noopener noreferrer"
              className="w-full flex items-center gap-3 py-2.5 px-3.5 rounded-xl hover:bg-stone-50 dark:hover:bg-stone-800/50 transition-colors group"
            >
              <FileText className="w-4 h-4 text-stone-400 flex-shrink-0" />
              <span className="text-sm text-stone-700 dark:text-stone-300 flex-1 text-left">{t("settings_page.terms_of_service")}</span>
              <ChevronRight className="w-4 h-4 text-stone-300 dark:text-stone-600" />
            </a>
            <a
              href={`mailto:${SUPPORT_EMAIL}?subject=BookSwipe%20feedback`}
              className="w-full flex items-center gap-3 py-2.5 px-3.5 rounded-xl hover:bg-stone-50 dark:hover:bg-stone-800/50 transition-colors group"
            >
              <Mail className="w-4 h-4 text-stone-400 flex-shrink-0" />
              <span className="text-sm text-stone-700 dark:text-stone-300 flex-1 text-left">{t("settings_page.send_feedback")}</span>
              <ChevronRight className="w-4 h-4 text-stone-300 dark:text-stone-600" />
            </a>

            <div className="border-t border-stone-100 dark:border-stone-800" />
            <div className="flex gap-2.5 p-3 rounded-xl bg-amber-50/60 dark:bg-amber-950/20 border border-amber-100 dark:border-amber-900/40">
              <Shield className="w-4 h-4 text-amber-600 dark:text-amber-500 flex-shrink-0 mt-0.5" />
              <p className="text-xs text-amber-800 dark:text-amber-300/90 leading-relaxed"> {t("settings_page.your_reading_data_is_stored_on")} </p>
            </div>
          </div>
        </motion.section>

        {/* ─── Sync (signed out) ─── */}
        {!userEmail && isSupabaseConfigured() && onSignIn && (
          <motion.section
            custom={4}
            initial="hidden"
            animate="visible"
            variants={sectionVariants}
            className="bg-white dark:bg-stone-900 rounded-2xl border border-stone-200/60 dark:border-stone-700/60 shadow-sm overflow-hidden"
          >
            <div className="px-5 pt-4 pb-2">
              <h2 className="text-base font-serif font-semibold text-stone-900 dark:text-stone-100 flex items-center gap-2.5">
                <UserX className="w-[18px] h-[18px] text-amber-600 dark:text-amber-500" /> {t("settings_page.sync")} </h2>
            </div>
            <div className="px-5 pb-4 space-y-3">
              <p className="text-xs text-stone-500 dark:text-stone-400"> {t("settings_page.your_library_lives_on_this_device")} </p>
              <button
                onClick={onSignIn}
                className="w-full min-h-[44px] px-4 rounded-xl bg-stone-900 dark:bg-stone-100 text-white dark:text-stone-900 text-sm font-semibold transition-opacity hover:opacity-90"
              > {t("settings_page.sign_in_to_sync")} </button>
            </div>
          </motion.section>
        )}

        {/* ─── Account (only when signed in) ─── */}
        {userEmail && (
          <motion.section
            custom={4}
            initial="hidden"
            animate="visible"
            variants={sectionVariants}
            className="bg-white dark:bg-stone-900 rounded-2xl border border-stone-200/60 dark:border-stone-700/60 shadow-sm overflow-hidden"
          >
            <div className="px-5 pt-4 pb-2">
              <h2 className="text-base font-serif font-semibold text-stone-900 dark:text-stone-100 flex items-center gap-2.5">
                <UserX className="w-[18px] h-[18px] text-amber-600 dark:text-amber-500" /> {t("settings_page.account")} </h2>
            </div>

            <div className="px-5 pb-4 space-y-3">
              <p className="text-xs text-stone-500 dark:text-stone-400"> {t("settings_page.signed_in_as")} <span className="font-medium text-stone-700 dark:text-stone-300">{userEmail}</span>
              </p>

              <button
                onClick={handleSignOut}
                className="w-full flex items-center gap-3 py-3 px-3.5 rounded-xl bg-stone-50 dark:bg-stone-800/50 hover:bg-stone-100 dark:hover:bg-stone-800 border border-stone-200/60 dark:border-stone-700/60 transition-colors"
              >
                <div className="w-9 h-9 rounded-lg bg-stone-100 dark:bg-stone-700/50 flex items-center justify-center flex-shrink-0">
                  <LogOut className="w-4.5 h-4.5 text-stone-600 dark:text-stone-300" />
                </div>
                <span className="text-sm font-medium text-stone-800 dark:text-stone-200 text-left flex-1">{t("settings_page.sign_out")}</span>
              </button>

              {/* Delete account */}
              <AnimatePresence mode="wait">
                {!showDeleteConfirm ? (
                  <motion.button
                    key="del-btn"
                    initial={{ opacity: 1 }}
                    exit={{ opacity: 0 }}
                    onClick={() => setShowDeleteConfirm(true)}
                    className="w-full flex items-center gap-3 py-3 px-3.5 rounded-xl hover:bg-red-50 dark:hover:bg-red-950/30 border border-transparent hover:border-red-200 dark:hover:border-red-900/60 transition-all"
                  >
                    <div className="w-9 h-9 rounded-lg bg-red-50 dark:bg-red-900/30 flex items-center justify-center flex-shrink-0">
                      <UserX className="w-4.5 h-4.5 text-red-600 dark:text-red-400" />
                    </div>
                    <div className="text-left flex-1 min-w-0">
                      <p className="text-sm font-medium text-red-700 dark:text-red-400">{t("settings_page.delete_account")}</p>
                      <p className="text-[11px] text-stone-500 dark:text-stone-400">{t("settings_page.permanently_delete_your_account_and_all")}</p>
                    </div>
                    <ChevronRight className="w-4 h-4 text-stone-300 dark:text-stone-600 flex-shrink-0" />
                  </motion.button>
                ) : (
                  <motion.div
                    key="del-confirm"
                    initial={{ opacity: 0, scale: 0.97 }}
                    animate={{ opacity: 1, scale: 1 }}
                    exit={{ opacity: 0, scale: 0.97 }}
                    className="p-4 rounded-xl bg-red-50 dark:bg-red-950/40 border border-red-200 dark:border-red-800 space-y-3"
                  >
                    <div className="flex items-start gap-2.5">
                      <AlertTriangle className="w-5 h-5 text-red-600 dark:text-red-400 flex-shrink-0 mt-0.5" />
                      <div>
                        <p className="text-sm font-semibold text-red-800 dark:text-red-200">{t("settings_page.delete_your_account")}</p>
                        <p className="text-xs text-red-700/80 dark:text-red-300/80 mt-1 leading-relaxed"> {t("settings_page.this_permanently_deletes_your_account_and")} </p>
                      </div>
                    </div>
                    <div className="flex gap-2">
                      <button
                        onClick={handleDeleteAccount}
                        disabled={deletingAccount}
                        className="flex-1 py-2.5 rounded-xl bg-red-600 hover:bg-red-700 text-white text-sm font-medium transition-colors disabled:opacity-50 flex items-center justify-center gap-2"
                      >
                        {deletingAccount && <Loader2 className="w-4 h-4 animate-spin" />}
                        {deletingAccount ? t("settings_page.deleting") : t("settings_page.yes_delete_my_account")}
                      </button>
                      <button
                        onClick={() => setShowDeleteConfirm(false)}
                        disabled={deletingAccount}
                        className="py-2.5 px-4 rounded-xl bg-white dark:bg-stone-800 text-stone-700 dark:text-stone-300 text-sm font-medium border border-stone-200 dark:border-stone-700 hover:bg-stone-50 dark:hover:bg-stone-700 transition-colors disabled:opacity-50"
                      > {t("common.cancel")} </button>
                    </div>
                  </motion.div>
                )}
              </AnimatePresence>
            </div>
          </motion.section>
        )}

      </div>
    </div>
  )
}
