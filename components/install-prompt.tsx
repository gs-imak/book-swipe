"use client"

import { useState, useEffect } from "react"
import { motion, AnimatePresence } from "framer-motion"
import { Download, X } from "lucide-react"

const INSTALL_DISMISSED_KEY = "bookswipe_install_dismissed"

interface BeforeInstallPromptEvent extends Event {
  prompt: () => Promise<void>
  userChoice: Promise<{ outcome: "accepted" | "dismissed" }>
}

export function InstallPrompt() {
  const [deferredPrompt, setDeferredPrompt] = useState<BeforeInstallPromptEvent | null>(null)
  const [show, setShow] = useState(false)

  useEffect(() => {
    // Don't show if already dismissed recently (30 days)
    try {
      const dismissed = localStorage.getItem(INSTALL_DISMISSED_KEY)
      if (dismissed) {
        const daysSince = (Date.now() - new Date(dismissed).getTime()) / (1000 * 60 * 60 * 24)
        if (daysSince < 30) return
      }
    } catch { /* ignore */ }

    const handler = (e: Event) => {
      e.preventDefault()
      setDeferredPrompt(e as BeforeInstallPromptEvent)
      // Only show to engaged users (3+ liked books)
      try {
        const liked = localStorage.getItem("bookswipe_liked_books")
        const count = liked ? JSON.parse(liked).length : 0
        if (count >= 3) setShow(true)
      } catch { /* ignore */ }
    }

    window.addEventListener("beforeinstallprompt", handler)
    return () => window.removeEventListener("beforeinstallprompt", handler)
  }, [])

  const handleInstall = async () => {
    if (!deferredPrompt) return
    await deferredPrompt.prompt()
    const { outcome } = await deferredPrompt.userChoice
    if (outcome === "accepted") {
      setShow(false)
    }
    setDeferredPrompt(null)
  }

  const handleDismiss = () => {
    setShow(false)
    try {
      localStorage.setItem(INSTALL_DISMISSED_KEY, new Date().toISOString())
    } catch { /* ignore */ }
  }

  return (
    <AnimatePresence>
      {show && (
        <motion.div
          initial={{ opacity: 0, y: 50 }}
          animate={{ opacity: 1, y: 0 }}
          exit={{ opacity: 0, y: 50 }}
          transition={{ type: "spring", stiffness: 300, damping: 30 }}
          className="fixed bottom-20 sm:bottom-6 left-4 right-4 z-40 max-w-sm mx-auto"
        >
          <div className="flex items-center gap-3 bg-stone-900 text-white rounded-xl px-4 py-3 shadow-xl">
            <Download className="w-5 h-5 text-amber-400 flex-shrink-0" />
            <div className="flex-1 min-w-0">
              <p className="text-sm font-medium">Add BookSwipe to home screen</p>
              <p className="text-xs text-stone-400">Quick access, works offline</p>
            </div>
            <button
              onClick={handleInstall}
              className="px-3 py-1.5 bg-amber-500 hover:bg-amber-400 text-stone-900 text-xs font-semibold rounded-lg transition-colors flex-shrink-0"
            >
              Install
            </button>
            <button
              onClick={handleDismiss}
              aria-label="Dismiss install prompt"
              className="p-1 rounded-md hover:bg-stone-800 transition-colors flex-shrink-0"
            >
              <X className="w-4 h-4 text-stone-400" />
            </button>
          </div>
        </motion.div>
      )}
    </AnimatePresence>
  )
}
