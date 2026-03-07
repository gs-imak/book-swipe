"use client"

import { useEffect } from "react"
import { motion, AnimatePresence } from "framer-motion"
import { X, Heart } from "lucide-react"

interface DedicationOverlayProps {
  isOpen: boolean
  onClose: () => void
}

export function DedicationOverlay({ isOpen, onClose }: DedicationOverlayProps) {
  useEffect(() => {
    if (!isOpen) return
    const handleKey = (e: KeyboardEvent) => { if (e.key === "Escape") onClose() }
    document.addEventListener("keydown", handleKey)
    return () => document.removeEventListener("keydown", handleKey)
  }, [isOpen, onClose])

  useEffect(() => {
    if (isOpen) {
      document.body.style.overflow = "hidden"
      return () => { document.body.style.overflow = "" }
    }
  }, [isOpen])

  return (
    <AnimatePresence>
      {isOpen && (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          transition={{ duration: 0.4 }}
          className="fixed inset-0 z-[200] flex items-center justify-center p-8"
          style={{ background: "linear-gradient(160deg, #1c1917 0%, #292524 55%, #1c1917 100%)" }}
          onClick={onClose}
        >
          <button
            onClick={onClose}
            aria-label="Close"
            className="absolute top-5 right-5 p-2 rounded-full text-stone-600 hover:text-stone-300 transition-colors"
            style={{ top: "max(20px, env(safe-area-inset-top, 20px))" }}
          >
            <X className="w-5 h-5" />
          </button>

          <motion.div
            initial={{ opacity: 0, y: 28, scale: 0.96 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: 20, scale: 0.97 }}
            transition={{ type: "spring", stiffness: 220, damping: 26, delay: 0.1 }}
            className="max-w-sm w-full text-center space-y-6 overflow-y-auto overscroll-contain"
            style={{ maxHeight: "calc(100dvh - 80px)" }}
            onClick={(e) => e.stopPropagation()}
          >
            {/* Top ornament */}
            <motion.div
              initial={{ scaleX: 0, opacity: 0 }}
              animate={{ scaleX: 1, opacity: 1 }}
              transition={{ delay: 0.45, duration: 0.5 }}
              className="flex items-center justify-center gap-4"
            >
              <div className="h-px w-14 bg-amber-700/50" />
              <Heart className="w-3 h-3 text-amber-600 fill-amber-600" />
              <div className="h-px w-14 bg-amber-700/50" />
            </motion.div>

            {/* Addressee */}
            <motion.p
              initial={{ opacity: 0, y: 6 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.55 }}
              className="text-amber-500/70 text-[10px] uppercase tracking-[0.35em] font-semibold"
            >
              For Lycia
            </motion.p>

            {/* Pull quote */}
            <motion.p
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.65 }}
              className="text-white/90 text-xl font-serif leading-relaxed italic font-light"
            >
              &ldquo;Every dream begins with someone who believes in it.&rdquo;
            </motion.p>

            {/* Body */}
            <motion.div
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.78 }}
              className="space-y-4 text-stone-400 text-sm leading-loose text-left"
            >
              <p>
                This app began as your idea — a simple spark you shared, and probably never thought
                it would go this far. Somehow, that spark turned into something real, and now something
                that I hope you can use, and that brings you joy, just as much as making this for you did for me.
              </p>
              <p>
                You have a rare way of making the people around you want to build things, create things,
                and believe a little more in what&apos;s possible. Thank you for being an angel and for
                inspiring, as you always have been.
              </p>
              <p>
                I hope that every book you discover here feels like it was waiting quietly for you to find it —
                where you can always find peace and calm.
              </p>
            </motion.div>

            {/* Bottom ornament */}
            <motion.div
              initial={{ scaleX: 0, opacity: 0 }}
              animate={{ scaleX: 1, opacity: 1 }}
              transition={{ delay: 0.9, duration: 0.5 }}
              className="flex items-center justify-center gap-4"
            >
              <div className="h-px w-14 bg-amber-700/50" />
              <div className="w-1 h-1 rounded-full bg-amber-700/50" />
              <div className="h-px w-14 bg-amber-700/50" />
            </motion.div>

            {/* Signature */}
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              transition={{ delay: 1 }}
              className="space-y-2 pb-2"
            >
              <p className="text-stone-500 text-xs tracking-wide">Happy International Women&apos;s Day</p>
              <p className="text-amber-600/80 text-sm font-serif">With love ♥ your Georgie</p>
            </motion.div>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  )
}
