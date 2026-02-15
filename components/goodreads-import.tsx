"use client"

import { useState, useRef } from "react"
import { motion, AnimatePresence } from "framer-motion"
import { X, Upload, FileText, CheckCircle2, AlertCircle, BookOpen } from "lucide-react"
import {
  parseGoodreadsCSV,
  importGoodreadsData,
  type GoodreadsRow,
  type ImportProgress,
  type ImportResult,
} from "@/lib/goodreads-import"

interface GoodreadsImportProps {
  isOpen: boolean
  onClose: () => void
  onComplete?: () => void
}

type Step = "upload" | "preview" | "progress" | "results"

export function GoodreadsImport({ isOpen, onClose, onComplete }: GoodreadsImportProps) {
  const [step, setStep] = useState<Step>("upload")
  const [csvText, setCsvText] = useState("")
  const [rows, setRows] = useState<GoodreadsRow[]>([])
  const [progress, setProgress] = useState<ImportProgress | null>(null)
  const [result, setResult] = useState<ImportResult | null>(null)
  const [importRatings, setImportRatings] = useState(true)
  const [importShelves, setImportShelves] = useState(true)
  const fileInputRef = useRef<HTMLInputElement>(null)

  const handleFileSelect = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (!file) return
    const text = await file.text()
    setCsvText(text)
    const parsed = parseGoodreadsCSV(text)
    setRows(parsed)
    setStep("preview")
  }

  const handleStartImport = async () => {
    setStep("progress")
    const result = await importGoodreadsData(csvText, (p) => {
      setProgress({ ...p })
    }, { importRatings, importShelves })
    setResult(result)
    setStep("results")
  }

  const handleDone = () => {
    setStep("upload")
    setCsvText("")
    setRows([])
    setProgress(null)
    setResult(null)
    onComplete?.()
    onClose()
  }

  const handleClose = () => {
    if (step === "progress") return // Don't allow closing during import
    handleDone()
  }

  if (!isOpen) return null

  // Preview stats
  const ratedCount = rows.filter(r => r.myRating > 0).length
  const readCount = rows.filter(r => r.exclusiveShelf === "read").length
  const toReadCount = rows.filter(r => r.exclusiveShelf === "to-read").length

  return (
    <AnimatePresence>
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
        className="fixed inset-0 bg-black/40 backdrop-blur-sm z-50 flex items-center justify-center p-4"
        onClick={handleClose}
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
            <h2 className="text-lg font-bold text-stone-900 font-serif">Import from Goodreads</h2>
            {step !== "progress" && (
              <button
                onClick={handleClose}
                aria-label="Close import"
                className="p-2 -mr-2 rounded-lg hover:bg-stone-100 transition-colors tap-target touch-manipulation"
              >
                <X className="w-5 h-5 text-stone-400" />
              </button>
            )}
          </div>

          <div className="flex-1 overflow-y-auto px-5 pb-5">
            {/* Step 1: Upload */}
            {step === "upload" && (
              <div className="space-y-5">
                <div className="bg-amber-50 rounded-xl p-4 border border-amber-100">
                  <h3 className="text-sm font-semibold text-amber-900 mb-2">How to export from Goodreads</h3>
                  <ol className="text-xs text-amber-800 space-y-1.5 list-decimal list-inside leading-relaxed">
                    <li>Go to goodreads.com/review/import</li>
                    <li>Click &ldquo;Export Library&rdquo; at the top</li>
                    <li>Wait for the export to generate</li>
                    <li>Download the CSV file</li>
                  </ol>
                </div>

                <button
                  onClick={() => fileInputRef.current?.click()}
                  className="w-full flex flex-col items-center gap-3 p-8 rounded-xl border-2 border-dashed border-stone-300 hover:border-amber-400 hover:bg-amber-50/30 transition-all cursor-pointer"
                >
                  <Upload className="w-8 h-8 text-stone-400" />
                  <div className="text-center">
                    <p className="text-sm font-medium text-stone-700">Choose CSV file</p>
                    <p className="text-xs text-stone-400 mt-1">goodreads_library_export.csv</p>
                  </div>
                </button>
                <input
                  ref={fileInputRef}
                  type="file"
                  accept=".csv"
                  onChange={handleFileSelect}
                  className="hidden"
                />
              </div>
            )}

            {/* Step 2: Preview */}
            {step === "preview" && (
              <div className="space-y-5">
                <div className="bg-stone-50 rounded-xl p-4 border border-stone-200/60">
                  <div className="flex items-center gap-2 mb-3">
                    <FileText className="w-4 h-4 text-stone-500" />
                    <span className="text-sm font-medium text-stone-800">Found {rows.length} books</span>
                  </div>
                  <div className="grid grid-cols-3 gap-3">
                    <div className="text-center">
                      <p className="text-lg font-bold text-stone-900">{readCount}</p>
                      <p className="text-[11px] text-stone-500">Read</p>
                    </div>
                    <div className="text-center">
                      <p className="text-lg font-bold text-stone-900">{toReadCount}</p>
                      <p className="text-[11px] text-stone-500">To Read</p>
                    </div>
                    <div className="text-center">
                      <p className="text-lg font-bold text-stone-900">{ratedCount}</p>
                      <p className="text-[11px] text-stone-500">Rated</p>
                    </div>
                  </div>
                </div>

                {/* Options */}
                <div className="space-y-2">
                  <label className="flex items-center gap-3 p-3 rounded-xl hover:bg-stone-50 cursor-pointer transition-colors">
                    <input
                      type="checkbox"
                      checked={importRatings}
                      onChange={(e) => setImportRatings(e.target.checked)}
                      className="w-4 h-4 rounded border-stone-300 text-amber-600 focus:ring-amber-500"
                    />
                    <div>
                      <p className="text-sm font-medium text-stone-800">Import ratings as reviews</p>
                      <p className="text-xs text-stone-500">{ratedCount} books with ratings</p>
                    </div>
                  </label>
                  <label className="flex items-center gap-3 p-3 rounded-xl hover:bg-stone-50 cursor-pointer transition-colors">
                    <input
                      type="checkbox"
                      checked={importShelves}
                      onChange={(e) => setImportShelves(e.target.checked)}
                      className="w-4 h-4 rounded border-stone-300 text-amber-600 focus:ring-amber-500"
                    />
                    <div>
                      <p className="text-sm font-medium text-stone-800">Map shelves</p>
                      <p className="text-xs text-stone-500">Assign books to matching shelves</p>
                    </div>
                  </label>
                </div>

                <div className="flex gap-3">
                  <button
                    onClick={() => setStep("upload")}
                    className="flex-1 h-10 bg-white border border-stone-200 hover:bg-stone-50 text-stone-700 text-sm font-medium rounded-xl transition-colors"
                  >
                    Back
                  </button>
                  <button
                    onClick={handleStartImport}
                    className="flex-1 h-10 bg-stone-900 hover:bg-stone-800 text-white text-sm font-medium rounded-xl transition-colors"
                  >
                    Import {rows.length} Books
                  </button>
                </div>
              </div>
            )}

            {/* Step 3: Progress */}
            {step === "progress" && progress && (
              <div className="space-y-5 py-4">
                <div className="text-center">
                  <BookOpen className="w-10 h-10 text-amber-600 mx-auto mb-3 animate-pulse" />
                  <p className="text-sm font-medium text-stone-800">
                    Importing books... {progress.processed} / {progress.total}
                  </p>
                  <p className="text-xs text-stone-500 mt-1 truncate px-4">{progress.currentTitle}</p>
                </div>

                {/* Progress bar */}
                <div className="w-full h-2 bg-stone-100 rounded-full overflow-hidden">
                  <motion.div
                    className="h-full bg-gradient-to-r from-amber-400 to-amber-600 rounded-full"
                    initial={{ width: 0 }}
                    animate={{ width: `${(progress.processed / progress.total) * 100}%` }}
                    transition={{ duration: 0.3 }}
                  />
                </div>

                <div className="grid grid-cols-3 gap-3 text-center">
                  <div>
                    <p className="text-lg font-bold text-green-600">{progress.matched}</p>
                    <p className="text-[11px] text-stone-500">Matched</p>
                  </div>
                  <div>
                    <p className="text-lg font-bold text-stone-400">{progress.skipped}</p>
                    <p className="text-[11px] text-stone-500">Skipped</p>
                  </div>
                  <div>
                    <p className="text-lg font-bold text-red-400">{progress.errors}</p>
                    <p className="text-[11px] text-stone-500">Errors</p>
                  </div>
                </div>
              </div>
            )}

            {/* Step 4: Results */}
            {step === "results" && result && (
              <div className="space-y-5 py-4">
                <div className="text-center">
                  <CheckCircle2 className="w-12 h-12 text-green-500 mx-auto mb-3" />
                  <h3 className="text-lg font-bold text-stone-900 font-serif">Import Complete</h3>
                </div>

                <div className="bg-stone-50 rounded-xl p-4 border border-stone-200/60 space-y-2">
                  <div className="flex items-center justify-between text-sm">
                    <span className="text-stone-600">Books imported</span>
                    <span className="font-bold text-green-600">{result.matched}</span>
                  </div>
                  <div className="flex items-center justify-between text-sm">
                    <span className="text-stone-600">Already existed</span>
                    <span className="font-bold text-stone-400">{result.skipped}</span>
                  </div>
                  {result.errors > 0 && (
                    <div className="flex items-center justify-between text-sm">
                      <span className="text-stone-600">Could not match</span>
                      <span className="font-bold text-red-400">{result.errors}</span>
                    </div>
                  )}
                  {result.newShelves.length > 0 && (
                    <div className="pt-2 border-t border-stone-200/60">
                      <p className="text-xs text-stone-500 mb-1">New shelves created:</p>
                      <div className="flex flex-wrap gap-1">
                        {result.newShelves.map(s => (
                          <span key={s} className="text-xs px-2 py-0.5 bg-amber-50 text-amber-700 rounded-full border border-amber-100">
                            {s}
                          </span>
                        ))}
                      </div>
                    </div>
                  )}
                </div>

                <button
                  onClick={handleDone}
                  className="w-full h-10 bg-stone-900 hover:bg-stone-800 text-white text-sm font-medium rounded-xl transition-colors"
                >
                  Done
                </button>
              </div>
            )}
          </div>
        </motion.div>
      </motion.div>
    </AnimatePresence>
  )
}
