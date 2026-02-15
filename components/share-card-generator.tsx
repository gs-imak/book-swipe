"use client"

import { useState, useEffect, useRef } from "react"
import { motion, AnimatePresence } from "framer-motion"
import { X, Copy, Download, Check } from "lucide-react"
import { Book } from "@/lib/book-data"
import { getBookReview, type BookReview } from "@/lib/storage"
import { generateShareCard, copyImageToClipboard, downloadImage, type ShareTemplate } from "@/lib/share-card"

interface ShareCardGeneratorProps {
  book: Book
  isOpen: boolean
  onClose: () => void
}

const TEMPLATES: { id: ShareTemplate; label: string; preview: string }[] = [
  { id: "clean", label: "Clean", preview: "bg-[#faf7f2] border-amber-200" },
  { id: "gradient", label: "Gradient", preview: "bg-gradient-to-br from-amber-400 to-rose-400" },
  { id: "minimal", label: "Minimal", preview: "bg-stone-900" },
]

export function ShareCardGenerator({ book, isOpen, onClose }: ShareCardGeneratorProps) {
  const [template, setTemplate] = useState<ShareTemplate>("clean")
  const [quote, setQuote] = useState("")
  const [preview, setPreview] = useState<string | null>(null)
  const [generating, setGenerating] = useState(false)
  const [copied, setCopied] = useState(false)
  const [review, setReview] = useState<BookReview | null>(null)
  const blobRef = useRef<Blob | null>(null)

  useEffect(() => {
    if (isOpen) {
      setReview(getBookReview(book.id))
      setTemplate("clean")
      setQuote("")
      setPreview(null)
      setCopied(false)
    }
  }, [isOpen, book.id])

  // Generate preview whenever template or quote changes
  useEffect(() => {
    if (!isOpen) return
    let cancelled = false
    const timer = setTimeout(async () => {
      setGenerating(true)
      const blob = await generateShareCard(book, review, { template, quote: quote.trim() || undefined })
      if (cancelled || !blob) {
        setGenerating(false)
        return
      }
      blobRef.current = blob
      const url = URL.createObjectURL(blob)
      setPreview((prev) => {
        if (prev) URL.revokeObjectURL(prev)
        return url
      })
      setGenerating(false)
    }, 300)
    return () => {
      cancelled = true
      clearTimeout(timer)
    }
  }, [isOpen, template, quote, book, review])

  useEffect(() => {
    if (!isOpen) return
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose()
    }
    document.addEventListener("keydown", handleKeyDown)
    return () => document.removeEventListener("keydown", handleKeyDown)
  }, [isOpen, onClose])

  // Cleanup preview URL on unmount
  useEffect(() => {
    return () => {
      if (preview) URL.revokeObjectURL(preview)
    }
  }, [preview])

  if (!isOpen) return null

  const handleCopy = async () => {
    if (!blobRef.current) return
    const success = await copyImageToClipboard(blobRef.current)
    if (success) {
      setCopied(true)
      setTimeout(() => setCopied(false), 2000)
    }
  }

  const handleDownload = () => {
    if (!blobRef.current) return
    const safeName = book.title.replace(/[^a-z0-9]/gi, "-").toLowerCase()
    downloadImage(blobRef.current, `bookswipe-${safeName}.png`)
  }

  return (
    <AnimatePresence>
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
        className="fixed inset-0 bg-black/50 backdrop-blur-sm z-[60] flex items-center justify-center p-4"
        onClick={onClose}
      >
        <motion.div
          initial={{ opacity: 0, y: 30, scale: 0.97 }}
          animate={{ opacity: 1, y: 0, scale: 1 }}
          exit={{ opacity: 0, y: 30, scale: 0.97 }}
          transition={{ type: "spring", stiffness: 300, damping: 30 }}
          className="bg-background rounded-2xl shadow-2xl max-w-lg w-full max-h-[90vh] overflow-hidden flex flex-col border border-stone-200/60"
          onClick={(e) => e.stopPropagation()}
        >
          {/* Header */}
          <div className="flex items-center justify-between p-5 pb-3">
            <h2 className="text-lg font-bold text-stone-900 font-serif">Share Card</h2>
            <button
              onClick={onClose}
              aria-label="Close share card"
              className="p-2 -mr-2 rounded-lg hover:bg-stone-100 transition-colors tap-target touch-manipulation"
            >
              <X className="w-5 h-5 text-stone-400" />
            </button>
          </div>

          <div className="flex-1 overflow-y-auto px-5 pb-5 space-y-4">
            {/* Preview */}
            <div className="relative aspect-[4/5] rounded-xl overflow-hidden bg-stone-100 border border-stone-200/60">
              {preview ? (
                <img src={preview} alt="Share card preview" className="w-full h-full object-contain" />
              ) : (
                <div className="w-full h-full flex items-center justify-center">
                  <div className="w-6 h-6 border-2 border-stone-300 border-t-stone-600 rounded-full animate-spin" />
                </div>
              )}
              {generating && preview && (
                <div className="absolute inset-0 bg-white/40 flex items-center justify-center">
                  <div className="w-5 h-5 border-2 border-stone-300 border-t-stone-600 rounded-full animate-spin" />
                </div>
              )}
            </div>

            {/* Template picker */}
            <div>
              <label className="text-xs font-semibold text-stone-400 uppercase tracking-wider mb-2 block">Template</label>
              <div className="flex gap-2">
                {TEMPLATES.map((t) => (
                  <button
                    key={t.id}
                    onClick={() => setTemplate(t.id)}
                    className={`flex-1 flex flex-col items-center gap-1.5 p-2.5 rounded-xl border-2 transition-all ${
                      template === t.id
                        ? "border-amber-500 bg-amber-50/50"
                        : "border-stone-200 hover:border-stone-300"
                    }`}
                  >
                    <div className={`w-full aspect-[4/5] rounded-lg ${t.preview} border border-stone-200/30`} />
                    <span className="text-xs font-medium text-stone-700">{t.label}</span>
                  </button>
                ))}
              </div>
            </div>

            {/* Quote input */}
            <div>
              <label className="text-xs font-semibold text-stone-400 uppercase tracking-wider mb-2 block">
                Custom Quote (optional)
              </label>
              <textarea
                value={quote}
                onChange={(e) => setQuote(e.target.value)}
                placeholder="Add a favorite quote or your thoughts..."
                maxLength={200}
                rows={2}
                className="w-full px-3 py-2.5 rounded-xl border border-stone-200 text-sm bg-white focus:outline-none focus:ring-2 focus:ring-amber-500/30 focus:border-amber-500 resize-none"
              />
            </div>

            {/* Actions */}
            <div className="flex gap-3">
              <button
                onClick={handleCopy}
                disabled={!blobRef.current || generating}
                className="flex-1 h-10 bg-stone-900 hover:bg-stone-800 disabled:opacity-40 text-white text-sm font-medium rounded-xl transition-colors flex items-center justify-center gap-2"
              >
                {copied ? (
                  <>
                    <Check className="w-4 h-4" />
                    Copied!
                  </>
                ) : (
                  <>
                    <Copy className="w-4 h-4" />
                    Copy Image
                  </>
                )}
              </button>
              <button
                onClick={handleDownload}
                disabled={!blobRef.current || generating}
                className="flex-1 h-10 bg-white border border-stone-200 hover:bg-stone-50 disabled:opacity-40 text-stone-700 text-sm font-medium rounded-xl transition-colors flex items-center justify-center gap-2"
              >
                <Download className="w-4 h-4" />
                Download
              </button>
            </div>
          </div>
        </motion.div>
      </motion.div>
    </AnimatePresence>
  )
}
