"use client"

import { useState, useRef, useCallback, useEffect } from "react"
import { motion, AnimatePresence } from "framer-motion"
import { X, Download, Copy, Check, Share2 } from "lucide-react"
import { useFocusTrap } from "@/lib/use-focus-trap"

interface ProgressShareProps {
  isOpen: boolean
  onClose: () => void
  bookTitle: string
  bookAuthor: string
  progress: number // 0-100
  currentPage: number
  totalPages: number
}

function roundRect(ctx: CanvasRenderingContext2D, x: number, y: number, w: number, h: number, r: number) {
  ctx.beginPath()
  ctx.moveTo(x + r, y)
  ctx.lineTo(x + w - r, y)
  ctx.quadraticCurveTo(x + w, y, x + w, y + r)
  ctx.lineTo(x + w, y + h - r)
  ctx.quadraticCurveTo(x + w, y + h, x + w - r, y + h)
  ctx.lineTo(x + r, y + h)
  ctx.quadraticCurveTo(x, y + h, x, y + h - r)
  ctx.lineTo(x, y + r)
  ctx.quadraticCurveTo(x, y, x + r, y)
  ctx.closePath()
}

export function ProgressShare({
  isOpen,
  onClose,
  bookTitle,
  bookAuthor,
  progress,
  currentPage,
  totalPages,
}: ProgressShareProps) {
  const [preview, setPreview] = useState<string | null>(null)
  const [generating, setGenerating] = useState(false)
  const [copied, setCopied] = useState(false)
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const blobRef = useRef<Blob | null>(null)
  const modalRef = useRef<HTMLDivElement>(null)
  useFocusTrap(modalRef, isOpen)

  const generate = useCallback(async () => {
    setGenerating(true)
    const canvas = canvasRef.current
    if (!canvas) return
    const ctx = canvas.getContext("2d")
    if (!ctx) return

    const W = 600
    const H = 400
    canvas.width = W
    canvas.height = H

    // Background gradient — warm parchment
    const bg = ctx.createLinearGradient(0, 0, W, H)
    bg.addColorStop(0, "#fdf8f0")
    bg.addColorStop(1, "#f5ead8")
    ctx.fillStyle = bg
    roundRect(ctx, 0, 0, W, H, 20)
    ctx.fill()

    // Border
    ctx.strokeStyle = "#e4d5bb"
    ctx.lineWidth = 2
    roundRect(ctx, 1, 1, W - 2, H - 2, 20)
    ctx.stroke()

    // Decorative top accent bar
    const accentGrad = ctx.createLinearGradient(0, 0, W, 0)
    accentGrad.addColorStop(0, "#d97706")
    accentGrad.addColorStop(1, "#b45309")
    ctx.fillStyle = accentGrad
    ctx.beginPath()
    ctx.moveTo(20, 0)
    ctx.lineTo(W - 20, 0)
    ctx.quadraticCurveTo(W, 0, W, 20)
    ctx.lineTo(W, 8)
    ctx.quadraticCurveTo(W, 0, W - 20, 0)
    ctx.moveTo(20, 0)
    ctx.quadraticCurveTo(0, 0, 0, 20)
    ctx.lineTo(0, 8)
    ctx.quadraticCurveTo(0, 0, 20, 0)
    ctx.fill()
    // Simpler: just a top rectangle strip
    ctx.fillStyle = accentGrad
    roundRect(ctx, 0, 0, W, 6, 3)
    ctx.fill()

    // "Currently Reading" label
    ctx.fillStyle = "#b45309"
    ctx.font = "bold 11px 'system-ui', sans-serif"
    ctx.textAlign = "left"
    ctx.letterSpacing = "0.08em"
    ctx.fillText("CURRENTLY READING", 48, 48)
    ctx.letterSpacing = "0"

    // Book title
    ctx.fillStyle = "#1c1917"
    ctx.font = "bold 28px 'Georgia', serif"
    ctx.textAlign = "left"
    // Truncate title if too long
    let displayTitle = bookTitle
    while (ctx.measureText(displayTitle).width > W - 96 && displayTitle.length > 10) {
      displayTitle = displayTitle.slice(0, -1)
    }
    if (displayTitle !== bookTitle) displayTitle += "..."
    ctx.fillText(displayTitle, 48, 82)

    // Author
    ctx.fillStyle = "#78716c"
    ctx.font = "italic 16px 'Georgia', serif"
    ctx.fillText(`by ${bookAuthor}`, 48, 108)

    // Progress percentage — large
    ctx.fillStyle = "#d97706"
    ctx.font = "bold 72px 'Georgia', serif"
    ctx.textAlign = "right"
    ctx.fillText(`${Math.round(progress)}%`, W - 48, 190)

    ctx.fillStyle = "#a8a29e"
    ctx.font = "13px 'system-ui', sans-serif"
    ctx.textAlign = "right"
    ctx.fillText("complete", W - 48, 212)

    // Progress bar
    const barX = 48
    const barY = 240
    const barW = W - 96
    const barH = 16

    // Track
    ctx.fillStyle = "#e7d9c4"
    roundRect(ctx, barX, barY, barW, barH, barH / 2)
    ctx.fill()

    // Fill — clamp progress to [0,100] so the bar never overflows the track.
    const clampedProgress = Math.min(100, Math.max(0, progress))
    const fillW = Math.max(barH, (clampedProgress / 100) * barW)
    const fillGrad = ctx.createLinearGradient(barX, 0, barX + fillW, 0)
    fillGrad.addColorStop(0, "#f59e0b")
    fillGrad.addColorStop(1, "#d97706")
    ctx.fillStyle = fillGrad
    roundRect(ctx, barX, barY, fillW, barH, barH / 2)
    ctx.fill()

    // Page info
    ctx.fillStyle = "#92847a"
    ctx.font = "14px 'system-ui', sans-serif"
    ctx.textAlign = "left"
    if (totalPages > 0 && currentPage > 0) {
      ctx.fillText(`Page ${currentPage} of ${totalPages}`, barX, barY + barH + 24)
    }

    // Footer — "Reading on BookSwipe"
    ctx.fillStyle = "#c9b89a"
    ctx.font = "bold 12px 'system-ui', sans-serif"
    ctx.textAlign = "center"
    ctx.fillText("Reading on BookSwipe", W / 2, H - 22)

    canvas.toBlob(blob => {
      if (blob) {
        blobRef.current = blob
        setPreview(URL.createObjectURL(blob))
      }
      setGenerating(false)
    }, "image/png")
  }, [bookTitle, bookAuthor, progress, currentPage, totalPages])

  useEffect(() => {
    if (isOpen) {
      setCopied(false)
      setPreview(null)
      const id = setTimeout(generate, 80)
      return () => clearTimeout(id)
    }
    return () => {
      if (preview) URL.revokeObjectURL(preview)
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isOpen])

  useEffect(() => {
    if (!isOpen) return
    const handleKey = (e: KeyboardEvent) => { if (e.key === "Escape") onClose() }
    window.addEventListener("keydown", handleKey)
    return () => window.removeEventListener("keydown", handleKey)
  }, [isOpen, onClose])

  // Lock body scroll while the modal is open.
  useEffect(() => {
    if (!isOpen) return
    const prev = document.body.style.overflow
    document.body.style.overflow = "hidden"
    return () => {
      document.body.style.overflow = prev
    }
  }, [isOpen])

  const handleCopy = async () => {
    if (!blobRef.current) return
    try {
      await navigator.clipboard.write([new ClipboardItem({ "image/png": blobRef.current })])
      setCopied(true)
      setTimeout(() => setCopied(false), 2000)
    } catch {
      handleDownload()
    }
  }

  const handleDownload = () => {
    if (!blobRef.current) return
    const url = URL.createObjectURL(blobRef.current)
    const a = document.createElement("a")
    a.href = url
    const safeTitle = bookTitle.replace(/[^a-z0-9]/gi, "-").slice(0, 30)
    a.download = `reading-progress-${safeTitle}.png`
    document.body.appendChild(a)
    a.click()
    document.body.removeChild(a)
    setTimeout(() => URL.revokeObjectURL(url), 1000)
  }

  const handleShare = async () => {
    if (!blobRef.current) return
    const file = new File([blobRef.current], "reading-progress.png", { type: "image/png" })
    if (navigator.share && navigator.canShare?.({ files: [file] })) {
      try {
        await navigator.share({
          files: [file],
          title: `I'm ${Math.round(progress)}% through ${bookTitle}`,
          text: `Reading "${bookTitle}" by ${bookAuthor} on BookSwipe`,
        })
        return
      } catch {
        // fall through to download
      }
    }
    handleDownload()
  }

  if (!isOpen) return null

  return (
    <AnimatePresence>
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
        className="fixed inset-0 bg-black/40 backdrop-blur-sm z-[70] flex items-center justify-center p-4"
        onClick={onClose}
      >
        <motion.div
          ref={modalRef}
          role="dialog"
          aria-modal="true"
          aria-label="Share Progress"
          initial={{ opacity: 0, scale: 0.95, y: 10 }}
          animate={{ opacity: 1, scale: 1, y: 0 }}
          exit={{ opacity: 0, scale: 0.95, y: 10 }}
          transition={{ type: "spring", stiffness: 300, damping: 28 }}
          className="bg-background rounded-2xl shadow-2xl max-w-sm w-full overflow-hidden border border-stone-200/60 dark:border-stone-700/60"
          onClick={e => e.stopPropagation()}
        >
          {/* Header */}
          <div className="flex items-center justify-between px-5 py-4 border-b border-stone-200/60 dark:border-stone-700/60">
            <h2 className="text-lg font-bold text-stone-900 dark:text-stone-100 font-serif">Share Progress</h2>
            <button
              onClick={onClose}
              aria-label="Close share progress"
              className="p-2 -mr-2 rounded-lg hover:bg-stone-100 dark:hover:bg-stone-800 transition-colors"
            >
              <X className="w-5 h-5 text-stone-400" />
            </button>
          </div>

          {/* Preview */}
          <div className="p-5">
            {generating && (
              <div className="w-full aspect-[3/2] bg-stone-100 dark:bg-stone-800 rounded-xl flex items-center justify-center">
                <div className="w-7 h-7 border-2 border-amber-600 border-t-transparent rounded-full animate-spin" />
              </div>
            )}
            {preview && !generating && (
              <img
                src={preview}
                alt={`Reading progress for ${bookTitle}`}
                className="w-full rounded-xl shadow-md"
              />
            )}
          </div>

          {/* Actions */}
          <div className="flex items-center gap-2 px-5 pb-5">
            <button
              onClick={handleShare}
              disabled={!preview}
              className="flex-1 h-11 bg-stone-900 hover:bg-stone-800 dark:bg-stone-100 dark:hover:bg-stone-200 text-white dark:text-stone-900 text-sm font-medium rounded-xl transition-all flex items-center justify-center gap-2 disabled:opacity-40"
            >
              <Share2 className="w-4 h-4" />
              Share
            </button>
            <button
              onClick={handleCopy}
              disabled={!preview}
              className="h-11 px-4 bg-white dark:bg-stone-900 border border-stone-200 dark:border-stone-700 hover:bg-stone-50 dark:hover:bg-stone-800/50 text-stone-700 dark:text-stone-300 text-sm font-medium rounded-xl transition-all flex items-center gap-2 disabled:opacity-40"
            >
              {copied ? <Check className="w-4 h-4 text-emerald-500" /> : <Copy className="w-4 h-4" />}
              {copied ? "Copied" : "Copy"}
            </button>
            <button
              onClick={handleDownload}
              disabled={!preview}
              className="h-11 px-4 bg-white dark:bg-stone-900 border border-stone-200 dark:border-stone-700 hover:bg-stone-50 dark:hover:bg-stone-800/50 text-stone-700 dark:text-stone-300 text-sm font-medium rounded-xl transition-all flex items-center gap-2 disabled:opacity-40"
            >
              <Download className="w-4 h-4" />
            </button>
          </div>
        </motion.div>

        <canvas ref={canvasRef} className="hidden" />
      </motion.div>
    </AnimatePresence>
  )
}
