"use client"

import { useState, useRef, useEffect, useCallback } from "react"
import { motion, AnimatePresence } from "framer-motion"
import { Camera, X, Loader2, Check, AlertCircle } from "lucide-react"
import { Book } from "@/lib/book-data"
import { addLikedBook } from "@/lib/storage"
import { BookCover } from "@/components/book-cover"

interface BarcodeScannerProps {
  isOpen: boolean
  onClose: () => void
}

export function BarcodeScanner({ isOpen, onClose }: BarcodeScannerProps) {
  const videoRef = useRef<HTMLVideoElement>(null)
  const [scanning, setScanning] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [foundBook, setFoundBook] = useState<Book | null>(null)
  const [lookingUp, setLookingUp] = useState(false)
  const [added, setAdded] = useState(false)
  const streamRef = useRef<MediaStream | null>(null)

  // BarcodeDetector is not in TypeScript's lib types — check at runtime
  const isSupported = typeof window !== "undefined" && "BarcodeDetector" in window

  const stopCamera = useCallback(() => {
    if (streamRef.current) {
      streamRef.current.getTracks().forEach(t => t.stop())
      streamRef.current = null
    }
    setScanning(false)
  }, [])

  const lookupISBN = useCallback(async (isbn: string) => {
    setLookingUp(true)
    try {
      const res = await fetch(`https://www.googleapis.com/books/v1/volumes?q=isbn:${isbn}`)
      const data = await res.json()
      if (data.items && data.items.length > 0) {
        const item = data.items[0]
        const vol = item.volumeInfo
        const book: Book = {
          id: item.id,
          title: vol.title || "Unknown",
          author: (vol.authors || ["Unknown"]).join(", "),
          cover: vol.imageLinks?.thumbnail?.replace("http:", "https:") || "",
          rating: vol.averageRating || 0,
          pages: vol.pageCount || 0,
          genre: vol.categories || [],
          mood: [],
          description: vol.description || "",
          publishedYear: parseInt(vol.publishedDate?.split("-")[0] || "0"),
          readingTime: "",
          isbn,
          metadata: { source: "google" },
        }
        setFoundBook(book)
      } else {
        setError(`No book found for ISBN ${isbn}`)
      }
    } catch {
      setError("Failed to look up book. Check your connection.")
    }
    setLookingUp(false)
  }, [])

  const startCamera = useCallback(async () => {
    if (!isSupported) {
      setError("Barcode scanning is not supported in this browser. Try Chrome or Edge.")
      return
    }

    setError(null)
    setFoundBook(null)
    setAdded(false)

    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        video: { facingMode: "environment" },
      })
      streamRef.current = stream
      if (videoRef.current) {
        videoRef.current.srcObject = stream
        await videoRef.current.play()
      }
      setScanning(true)

      // Cast to any — BarcodeDetector is not in TypeScript's DOM lib
      const detector = new (window as any).BarcodeDetector({ formats: ["ean_13", "ean_8"] })

      const detect = async () => {
        if (!videoRef.current || !streamRef.current) return
        try {
          const barcodes = await detector.detect(videoRef.current)
          if (barcodes.length > 0) {
            const isbn = barcodes[0].rawValue
            stopCamera()
            lookupISBN(isbn)
            return
          }
        } catch {
          // Single frame detection failed — continue loop
        }
        if (streamRef.current) requestAnimationFrame(detect)
      }
      detect()
    } catch (err: any) {
      if (err.name === "NotAllowedError") {
        setError("Camera access denied. Please allow camera access and try again.")
      } else {
        setError("Could not access camera.")
      }
    }
  }, [isSupported, stopCamera, lookupISBN])

  // Auto-start when opened; clean up on close
  useEffect(() => {
    if (isOpen && isSupported) {
      startCamera()
    }
    return () => stopCamera()
  }, [isOpen, isSupported, startCamera, stopCamera])

  const handleAdd = () => {
    if (!foundBook) return
    addLikedBook(foundBook)
    setAdded(true)
  }

  const handleScanAgain = () => {
    setFoundBook(null)
    setAdded(false)
    setError(null)
    startCamera()
  }

  if (!isOpen) return null

  return (
    <AnimatePresence>
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
        className="fixed inset-0 lg:left-16 z-[60] bg-black/80 backdrop-blur-sm flex items-center justify-center p-4"
        onClick={(e) => {
          if (e.target === e.currentTarget) {
            stopCamera()
            onClose()
          }
        }}
      >
        <motion.div
          initial={{ opacity: 0, scale: 0.95 }}
          animate={{ opacity: 1, scale: 1 }}
          exit={{ opacity: 0, scale: 0.95 }}
          className="bg-white dark:bg-stone-900 rounded-2xl w-full max-w-sm overflow-hidden shadow-xl"
          onClick={e => e.stopPropagation()}
        >
          {/* Header */}
          <div className="flex items-center justify-between px-4 py-3 border-b border-stone-200/60 dark:border-stone-700/60">
            <div className="flex items-center gap-2">
              <Camera className="w-4 h-4 text-amber-600" />
              <h3 className="font-semibold text-stone-900 dark:text-stone-100 text-sm">Scan a Book</h3>
            </div>
            <button
              onClick={() => { stopCamera(); onClose() }}
              className="p-1.5 rounded-lg hover:bg-stone-100 dark:hover:bg-stone-800 transition-colors"
            >
              <X className="w-4 h-4 text-stone-400" />
            </button>
          </div>

          {/* Content */}
          <div className="p-4">
            {!isSupported ? (
              <div className="text-center py-8 space-y-3">
                <AlertCircle className="w-10 h-10 text-stone-300 mx-auto" />
                <p className="text-sm text-stone-500">
                  Barcode scanning requires Chrome or Edge on a device with a camera.
                </p>
              </div>
            ) : lookingUp ? (
              <div className="text-center py-8 space-y-3">
                <Loader2 className="w-8 h-8 text-amber-500 animate-spin mx-auto" />
                <p className="text-sm text-stone-500">Looking up book...</p>
              </div>
            ) : foundBook ? (
              <div className="space-y-4">
                <div className="flex gap-3">
                  <div className="relative w-16 h-24 flex-shrink-0 rounded-lg overflow-hidden bg-stone-100 dark:bg-stone-800">
                    <BookCover
                      src={foundBook.cover}
                      alt={foundBook.title}
                      fill
                      className="object-contain"
                      sizes="64px"
                    />
                  </div>
                  <div className="flex-1 min-w-0">
                    <h4 className="font-bold text-sm text-stone-900 dark:text-stone-100 line-clamp-2">
                      {foundBook.title}
                    </h4>
                    <p className="text-xs text-stone-500 mt-0.5">{foundBook.author}</p>
                    {foundBook.pages > 0 && (
                      <p className="text-xs text-stone-400 mt-1">{foundBook.pages} pages</p>
                    )}
                  </div>
                </div>
                <div className="flex gap-2">
                  {added ? (
                    <div className="flex-1 h-10 bg-emerald-50 dark:bg-emerald-900/30 text-emerald-600 dark:text-emerald-400 rounded-xl flex items-center justify-center gap-1.5 text-sm font-medium">
                      <Check className="w-4 h-4" /> Added to library
                    </div>
                  ) : (
                    <button
                      onClick={handleAdd}
                      className="flex-1 h-10 bg-stone-900 dark:bg-stone-100 text-white dark:text-stone-900 rounded-xl text-sm font-medium hover:bg-stone-800 dark:hover:bg-stone-200 transition-colors"
                    >
                      Add to Library
                    </button>
                  )}
                  <button
                    onClick={handleScanAgain}
                    className="h-10 px-4 bg-stone-100 dark:bg-stone-800 text-stone-600 dark:text-stone-300 rounded-xl text-sm font-medium hover:bg-stone-200 dark:hover:bg-stone-700 transition-colors"
                  >
                    Scan Another
                  </button>
                </div>
              </div>
            ) : error ? (
              <div className="text-center py-8 space-y-3">
                <AlertCircle className="w-10 h-10 text-stone-300 mx-auto" />
                <p className="text-sm text-stone-500">{error}</p>
                <button
                  onClick={handleScanAgain}
                  className="text-xs text-amber-600 font-medium"
                >
                  Try again
                </button>
              </div>
            ) : (
              <div className="space-y-3">
                <div className="relative aspect-[4/3] rounded-xl overflow-hidden bg-black">
                  <video
                    ref={videoRef}
                    className="w-full h-full object-cover"
                    playsInline
                    muted
                  />
                  {/* Targeting overlay */}
                  <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
                    <div className="w-48 h-32 border-2 border-amber-500/60 rounded-lg" />
                  </div>
                  {scanning && (
                    <div className="absolute bottom-3 left-0 right-0 text-center pointer-events-none">
                      <span className="text-xs text-white/80 bg-black/50 px-3 py-1 rounded-full">
                        Point at a barcode...
                      </span>
                    </div>
                  )}
                </div>
              </div>
            )}
          </div>
        </motion.div>
      </motion.div>
    </AnimatePresence>
  )
}
