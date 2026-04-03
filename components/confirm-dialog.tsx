"use client"

import { useEffect, useRef, useCallback } from "react"
import { motion, AnimatePresence } from "framer-motion"
import { AlertTriangle, Trash2 } from "lucide-react"

interface ConfirmDialogProps {
  isOpen: boolean
  onConfirm: () => void
  onCancel: () => void
  title: string
  message: string
  confirmLabel?: string
  variant?: "danger" | "warning"
}

export function ConfirmDialog({
  isOpen,
  onConfirm,
  onCancel,
  title,
  message,
  confirmLabel = "Confirm",
  variant = "danger",
}: ConfirmDialogProps) {
  const cancelRef = useRef<HTMLButtonElement>(null)
  const dialogRef = useRef<HTMLDivElement>(null)

  const handleKeyDown = useCallback(
    (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        e.stopPropagation()
        onCancel()
      }
    },
    [onCancel]
  )

  useEffect(() => {
    if (!isOpen) return
    document.addEventListener("keydown", handleKeyDown, true)
    cancelRef.current?.focus()
    return () => document.removeEventListener("keydown", handleKeyDown, true)
  }, [isOpen, handleKeyDown])

  const isDanger = variant === "danger"

  return (
    <AnimatePresence>
      {isOpen && (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          transition={{ duration: 0.15 }}
          className="fixed inset-0 z-[100] flex items-center justify-center p-4"
          onClick={onCancel}
        >
          <div className="absolute inset-0 bg-black/40 backdrop-blur-sm" />

          <motion.div
            ref={dialogRef}
            role="alertdialog"
            aria-modal="true"
            aria-labelledby="confirm-dialog-title"
            aria-describedby="confirm-dialog-message"
            initial={{ opacity: 0, scale: 0.95, y: 8 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.95, y: 8 }}
            transition={{ type: "spring", stiffness: 400, damping: 30 }}
            className="relative bg-white dark:bg-stone-900 rounded-2xl shadow-2xl max-w-sm w-full border border-stone-200/60 dark:border-stone-700/60 overflow-hidden"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="p-6 pb-5">
              <div className="flex items-start gap-4">
                <div
                  className={`flex-shrink-0 w-10 h-10 rounded-xl flex items-center justify-center ${
                    isDanger
                      ? "bg-red-50 dark:bg-red-900/30"
                      : "bg-amber-50 dark:bg-amber-900/30"
                  }`}
                >
                  {isDanger ? (
                    <Trash2 className="w-5 h-5 text-red-500 dark:text-red-400" />
                  ) : (
                    <AlertTriangle className="w-5 h-5 text-amber-500 dark:text-amber-400" />
                  )}
                </div>

                <div className="flex-1 min-w-0">
                  <h3
                    id="confirm-dialog-title"
                    className="text-base font-semibold text-stone-900 dark:text-stone-100 leading-tight"
                  >
                    {title}
                  </h3>
                  <p
                    id="confirm-dialog-message"
                    className="mt-1.5 text-sm text-stone-500 dark:text-stone-400 leading-relaxed"
                  >
                    {message}
                  </p>
                </div>
              </div>
            </div>

            <div className="flex gap-3 px-6 pb-6">
              <button
                ref={cancelRef}
                onClick={onCancel}
                className="flex-1 h-10 rounded-xl border border-stone-200 dark:border-stone-700 text-sm font-medium text-stone-700 dark:text-stone-300 hover:bg-stone-50 dark:hover:bg-stone-800/50 transition-all active:scale-[0.98] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-stone-400 focus-visible:ring-offset-2"
              >
                Cancel
              </button>
              <button
                onClick={onConfirm}
                className={`flex-1 h-10 rounded-xl text-sm font-medium text-white transition-all active:scale-[0.98] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-offset-2 ${
                  isDanger
                    ? "bg-red-500 hover:bg-red-600 focus-visible:ring-red-400"
                    : "bg-amber-500 hover:bg-amber-600 focus-visible:ring-amber-400"
                }`}
              >
                {confirmLabel}
              </button>
            </div>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  )
}
