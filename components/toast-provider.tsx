"use client"

import { createContext, useContext, useState, useCallback, useEffect, useMemo, useRef, ReactNode } from "react"
import { motion, AnimatePresence } from "framer-motion"
import { CheckCircle, AlertCircle, Info, X } from "lucide-react"
import { t, tv } from "@/lib/i18n"

type ToastType = "success" | "error" | "info"

interface Toast {
  id: string
  message: string
  type: ToastType
}

interface ToastContextType {
  showToast: (message: string, type?: ToastType) => void
}

const ToastContext = createContext<ToastContextType | null>(null)

export function useToast() {
  const context = useContext(ToastContext)
  if (!context) {
    throw new Error("useToast must be used within a ToastProvider")
  }
  return context
}

export function ToastProvider({ children }: { children: ReactNode }) {
  const [toasts, setToasts] = useState<Toast[]>([])
  // Track each toast's auto-dismiss timer so we can clear it on unmount
  // or when the toast is dismissed early, preventing setState-after-unmount.
  const timersRef = useRef<Map<string, ReturnType<typeof setTimeout>>>(new Map())
  // Synchronous mirror of the visible toasts. The dedupe check and timer
  // bookkeeping must not live inside a setToasts updater (updaters have to
  // stay pure — React may run them more than once), so showToast reads and
  // writes this ref and pushes the computed array into state.
  const toastsRef = useRef<Toast[]>([])

  const clearTimer = useCallback((id: string) => {
    const timer = timersRef.current.get(id)
    if (timer) {
      clearTimeout(timer)
      timersRef.current.delete(id)
    }
  }, [])

  const commit = useCallback((next: Toast[]) => {
    toastsRef.current = next
    setToasts(next)
  }, [])

  const scheduleDismiss = useCallback((id: string) => {
    const timer = setTimeout(() => {
      timersRef.current.delete(id)
      commit(toastsRef.current.filter(t => t.id !== id))
    }, 3000)
    timersRef.current.set(id, timer)
  }, [commit])

  const showToast = useCallback((message: string, type: ToastType = "success") => {
    // An identical toast (same message + type) is already on screen: restart
    // its dismiss timer instead of stacking a duplicate — rapid swiping used
    // to pile up three "Too many requests" toasts at once.
    const existing = toastsRef.current.find(t => t.message === message && t.type === type)
    if (existing) {
      clearTimer(existing.id)
      scheduleDismiss(existing.id)
      return
    }

    const id = Date.now().toString() + Math.random().toString(36).slice(2)
    // Cap at 3 visible toasts; drop the oldest ones' timers along with them.
    const evicted = toastsRef.current.slice(0, -2)
    evicted.forEach(t => clearTimer(t.id))
    commit([...toastsRef.current.slice(-2), { id, message, type }])
    scheduleDismiss(id)
  }, [clearTimer, commit, scheduleDismiss])

  const dismiss = useCallback((id: string) => {
    clearTimer(id)
    commit(toastsRef.current.filter(t => t.id !== id))
  }, [clearTimer, commit])

  // Clear any pending auto-dismiss timers when the provider unmounts.
  useEffect(() => {
    const timers = timersRef.current
    return () => {
      timers.forEach(clearTimeout)
      timers.clear()
    }
  }, [])

  const icons = {
    success: <CheckCircle className="w-4 h-4 text-emerald-600 flex-shrink-0" />,
    error: <AlertCircle className="w-4 h-4 text-red-600 flex-shrink-0" />,
    info: <Info className="w-4 h-4 text-blue-600 flex-shrink-0" />,
  }

  const bgColors = {
    success: "bg-emerald-50 border-emerald-200",
    error: "bg-red-50 border-red-200",
    info: "bg-blue-50 border-blue-200",
  }

  // Stable identity: showToast is already a stable useCallback, so without this
  // every toast add and every 3s auto-dismiss re-rendered all 11 consumers of
  // the context — the deck included, mid-gesture.
  const ctx = useMemo(() => ({ showToast }), [showToast])

  const textColors = {
    success: "text-emerald-800",
    error: "text-red-800",
    info: "text-blue-800",
  }

  return (
    <ToastContext.Provider value={ctx}>
      {children}
      <div
        aria-live="polite"
        role="status"
        className="fixed top-4 left-4 right-4 sm:left-auto sm:w-full sm:max-w-sm z-toast flex flex-col gap-2 pointer-events-none"
      >
        <AnimatePresence>
          {toasts.map(toast => (
            <motion.div
              key={toast.id}
              initial={{ opacity: 0, y: -12, scale: 0.95 }}
              animate={{ opacity: 1, y: 0, scale: 1 }}
              exit={{ opacity: 0, y: -8, scale: 0.95 }}
              transition={{ duration: 0.2 }}
              className={`pointer-events-auto flex items-center gap-2.5 px-4 py-3 rounded-xl border shadow-lg ${bgColors[toast.type]}`}
            >
              {icons[toast.type]}
              <span className={`text-sm font-medium flex-1 ${textColors[toast.type]}`}>
                {tv(toast.message)}
              </span>
              <button
                onClick={() => dismiss(toast.id)}
                aria-label={t("toast_provider.dismiss_notification")}
                className="relative before:absolute before:-inset-3 before:content-[''] p-0.5 rounded-md hover:bg-black/5 transition-colors flex-shrink-0"
              >
                <X className="w-3.5 h-3.5 text-stone-400" />
              </button>
            </motion.div>
          ))}
        </AnimatePresence>
      </div>
    </ToastContext.Provider>
  )
}
