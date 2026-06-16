"use client"

import { useState, useRef, useCallback, useEffect } from "react"
import { motion, AnimatePresence } from "framer-motion"
import { X, Download, Copy, Check, Share2 } from "lucide-react"
import { getLikedBooks, getBookReviews, getReadingProgress, getUserStats, getReadingGoals } from "@/lib/storage"

interface ProfileShareCardProps {
  isOpen: boolean
  onClose: () => void
}

export function ProfileShareCard({ isOpen, onClose }: ProfileShareCardProps) {
  const [preview, setPreview] = useState<string | null>(null)
  const [generating, setGenerating] = useState(false)
  const [copied, setCopied] = useState(false)
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const blobRef = useRef<Blob | null>(null)

  const generate = useCallback(async () => {
    setGenerating(true)
    const canvas = canvasRef.current
    if (!canvas) { setGenerating(false); return }

    const ctx = canvas.getContext("2d")
    if (!ctx) { setGenerating(false); return }

    const W = 600
    const H = 800
    canvas.width = W
    canvas.height = H

    // Gather data
    const books = getLikedBooks()
    const reviews = getBookReviews()
    const progress = getReadingProgress()
    const stats = getUserStats()
    const goals = getReadingGoals()
    const completed = progress.filter(p => p.status === "completed").length
    const totalPages = books.reduce((s, b) => s + b.pages, 0)
    const avgRating = reviews.length > 0
      ? (reviews.reduce((s, r) => s + r.rating, 0) / reviews.length).toFixed(1)
      : "—"

    // Genre breakdown
    const genreCounts: Record<string, number> = {}
    books.forEach(b => b.genre.forEach(g => { genreCounts[g] = (genreCounts[g] || 0) + 1 }))
    const topGenres = Object.entries(genreCounts)
      .sort((a, b) => b[1] - a[1])
      .slice(0, 3)
      .map(([name]) => name)

    // Top books (by rating from reviews)
    const topBooks = reviews
      .filter(r => r.rating >= 4)
      .sort((a, b) => b.rating - a.rating)
      .slice(0, 3)
      .map(r => {
        const book = books.find(b => b.id === r.bookId)
        return book ? `${book.title}` : null
      })
      .filter(Boolean)

    // Draw card
    // Background
    const grad = ctx.createLinearGradient(0, 0, W, H)
    grad.addColorStop(0, "#faf7f2")
    grad.addColorStop(1, "#f5efe6")
    ctx.fillStyle = grad
    roundRect(ctx, 0, 0, W, H, 24)
    ctx.fill()

    // Border
    ctx.strokeStyle = "#e7e0d5"
    ctx.lineWidth = 2
    roundRect(ctx, 1, 1, W - 2, H - 2, 24)
    ctx.stroke()

    // Header
    ctx.fillStyle = "#1c1917"
    ctx.font = "bold 32px 'Georgia', serif"
    ctx.textAlign = "center"
    ctx.fillText("My Reading Year", W / 2, 60)

    ctx.fillStyle = "#78716c"
    ctx.font = "16px 'system-ui', sans-serif"
    ctx.fillText(new Date().getFullYear().toString(), W / 2, 88)

    // Divider
    ctx.strokeStyle = "#d6cfc5"
    ctx.lineWidth = 1
    ctx.beginPath()
    ctx.moveTo(40, 110)
    ctx.lineTo(W - 40, 110)
    ctx.stroke()

    // Stats grid (2x2)
    const statsData = [
      { label: "Books", value: books.length.toString(), color: "#d97706" },
      { label: "Pages", value: totalPages.toLocaleString(), color: "#0d9488" },
      { label: "Completed", value: completed.toString(), color: "#059669" },
      { label: "Avg Rating", value: avgRating, color: "#6366f1" },
    ]

    statsData.forEach((stat, i) => {
      const col = i % 2
      const row = Math.floor(i / 2)
      const x = 40 + col * (W / 2 - 40)
      const y = 140 + row * 100

      ctx.fillStyle = stat.color
      ctx.font = "bold 40px 'Georgia', serif"
      ctx.textAlign = "left"
      ctx.fillText(stat.value, x + 20, y + 40)

      ctx.fillStyle = "#a8a29e"
      ctx.font = "14px 'system-ui', sans-serif"
      ctx.fillText(stat.label, x + 20, y + 60)
    })

    // Top genres section
    const genreY = 370
    ctx.fillStyle = "#a8a29e"
    ctx.font = "bold 11px 'system-ui', sans-serif"
    ctx.textAlign = "left"
    ctx.fillText("TOP GENRES", 60, genreY)

    topGenres.forEach((genre, i) => {
      ctx.fillStyle = "#1c1917"
      ctx.font = "16px 'system-ui', sans-serif"
      ctx.fillText(`${i + 1}. ${genre}`, 60, genreY + 28 + i * 28)
    })

    // Top books section (if any)
    if (topBooks.length > 0) {
      const booksY = genreY + 28 + topGenres.length * 28 + 30
      ctx.fillStyle = "#a8a29e"
      ctx.font = "bold 11px 'system-ui', sans-serif"
      ctx.fillText("FAVORITE READS", 60, booksY)

      topBooks.forEach((title, i) => {
        ctx.fillStyle = "#1c1917"
        ctx.font = "italic 14px 'Georgia', serif"
        const displayTitle = title!.length > 40 ? title!.slice(0, 40) + "..." : title!
        ctx.fillText(`"${displayTitle}"`, 60, booksY + 28 + i * 26)
      })
    }

    // Level badge
    ctx.fillStyle = "#d97706"
    ctx.font = "bold 14px 'system-ui', sans-serif"
    ctx.textAlign = "center"
    ctx.fillText(`Level ${stats.level} Reader`, W / 2, H - 80)

    // Streak
    if (stats.currentStreak > 0) {
      ctx.fillStyle = "#78716c"
      ctx.font = "13px 'system-ui', sans-serif"
      ctx.fillText(`${stats.currentStreak} day reading streak`, W / 2, H - 56)
    }

    // Footer
    ctx.fillStyle = "#a8a29e"
    ctx.font = "12px 'system-ui', sans-serif"
    ctx.fillText("BookSwipe", W / 2, H - 24)

    // Convert to blob
    canvas.toBlob(blob => {
      if (blob) {
        blobRef.current = blob
        setPreview(URL.createObjectURL(blob))
      }
      setGenerating(false)
    }, "image/png")
  }, [])

  useEffect(() => {
    if (isOpen) {
      setCopied(false)
      setPreview(null)
      setTimeout(generate, 100)
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

  const handleCopy = async () => {
    if (!blobRef.current) return
    try {
      await navigator.clipboard.write([new ClipboardItem({ "image/png": blobRef.current })])
      setCopied(true)
      setTimeout(() => setCopied(false), 2000)
    } catch {
      // Fallback: download instead
      handleDownload()
    }
  }

  const handleDownload = () => {
    if (!blobRef.current) return
    const url = URL.createObjectURL(blobRef.current)
    const a = document.createElement("a")
    a.href = url
    a.download = `bookswipe-profile-${new Date().getFullYear()}.png`
    a.click()
    URL.revokeObjectURL(url)
  }

  const handleShare = async () => {
    if (!blobRef.current) return
    const file = new File([blobRef.current], "bookswipe-profile.png", { type: "image/png" })
    if (navigator.share) {
      try {
        await navigator.share({ files: [file], title: "My BookSwipe Reading Profile" })
      } catch {
        handleDownload()
      }
    } else {
      handleDownload()
    }
  }

  if (!isOpen) return null

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
          initial={{ opacity: 0, scale: 0.95 }}
          animate={{ opacity: 1, scale: 1 }}
          exit={{ opacity: 0, scale: 0.95 }}
          className="bg-background rounded-2xl shadow-2xl max-w-md w-full overflow-hidden border border-stone-200/60 dark:border-stone-700/60"
          onClick={e => e.stopPropagation()}
        >
          {/* Header */}
          <div className="flex items-center justify-between px-5 py-4 border-b border-stone-200/60 dark:border-stone-700/60">
            <h2 className="text-lg font-bold text-stone-900 dark:text-stone-100 font-serif">Share Your Profile</h2>
            <button onClick={onClose} className="p-2 -mr-2 rounded-lg hover:bg-stone-100 dark:bg-stone-800 transition-colors">
              <X className="w-5 h-5 text-stone-400" />
            </button>
          </div>

          {/* Preview */}
          <div className="p-5">
            {generating && (
              <div className="aspect-[3/4] bg-stone-100 dark:bg-stone-800 rounded-xl flex items-center justify-center">
                <div className="w-8 h-8 border-2 border-amber-600 border-t-transparent rounded-full animate-spin" />
              </div>
            )}
            {preview && !generating && (
              <img
                src={preview}
                alt="Reading profile card"
                className="w-full rounded-xl shadow-md"
              />
            )}
          </div>

          {/* Actions */}
          <div className="flex items-center gap-2 px-5 pb-5">
            <button
              onClick={handleShare}
              className="flex-1 h-11 bg-stone-900 hover:bg-stone-800 text-white text-sm font-medium rounded-xl transition-all flex items-center justify-center gap-2"
            >
              <Share2 className="w-4 h-4" />
              Share
            </button>
            <button
              onClick={handleCopy}
              className="h-11 px-4 bg-white dark:bg-stone-900 border border-stone-200 hover:bg-stone-50 dark:bg-stone-800/50 text-stone-700 text-sm font-medium rounded-xl transition-all flex items-center gap-2"
            >
              {copied ? <Check className="w-4 h-4 text-emerald-500" /> : <Copy className="w-4 h-4" />}
              {copied ? "Copied" : "Copy"}
            </button>
            <button
              onClick={handleDownload}
              className="h-11 px-4 bg-white dark:bg-stone-900 border border-stone-200 hover:bg-stone-50 dark:bg-stone-800/50 text-stone-700 text-sm font-medium rounded-xl transition-all flex items-center gap-2"
            >
              <Download className="w-4 h-4" />
            </button>
          </div>
        </motion.div>

        {/* Hidden canvas */}
        <canvas ref={canvasRef} className="hidden" />
      </motion.div>
    </AnimatePresence>
  )
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
