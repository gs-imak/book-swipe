"use client"

import { useState, useEffect } from "react"
import { motion, AnimatePresence } from "framer-motion"
import { X, Copy, Check, UserPlus, Trash2, Users } from "lucide-react"
import {
  generateBuddyCode,
  decodeBuddyCode,
  getBuddies,
  addBuddy,
  removeBuddy,
  getMyCode,
  saveMyCode,
  type ReadingBuddy,
} from "@/lib/reading-buddy"

interface ReadingBuddyProps {
  bookId: string
  bookTitle: string
  progress: number // 0-100
  isOpen: boolean
  onClose: () => void
}

export function ReadingBuddyPanel({ bookId, bookTitle, progress, isOpen, onClose }: ReadingBuddyProps) {
  const [myCode, setMyCode] = useState<string>("")
  const [myName, setMyName] = useState<string>("")
  const [buddies, setBuddies] = useState<ReadingBuddy[]>([])
  const [buddyInput, setBuddyInput] = useState("")
  const [buddyName, setBuddyName] = useState("")
  const [codeCopied, setCodeCopied] = useState(false)
  const [errorMsg, setErrorMsg] = useState<string | null>(null)
  const [step, setStep] = useState<"main" | "add-buddy">("main")

  useEffect(() => {
    if (isOpen) {
      setBuddies(getBuddies(bookId))
      const stored = getMyCode(bookId)
      if (stored) {
        setMyCode(stored)
        // Try to extract name from code
        const decoded = decodeBuddyCode(stored)
        if (decoded) setMyName(decoded.name)
      }
      setBuddyInput("")
      setBuddyName("")
      setErrorMsg(null)
      setStep("main")
    }
  }, [isOpen, bookId])

  // Escape key
  useEffect(() => {
    if (!isOpen) return
    const handleKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        if (step !== "main") setStep("main")
        else onClose()
      }
    }
    window.addEventListener("keydown", handleKey)
    return () => window.removeEventListener("keydown", handleKey)
  }, [isOpen, onClose, step])

  if (!isOpen) return null

  const handleGenerateCode = () => {
    const name = myName.trim() || "Reader"
    const code = generateBuddyCode(bookId, progress, name)
    if (!code) return
    saveMyCode(bookId, code)
    setMyCode(code)
  }

  const handleCopyCode = async () => {
    if (!myCode) return
    try {
      await navigator.clipboard.writeText(myCode)
      setCodeCopied(true)
      setTimeout(() => setCodeCopied(false), 2000)
    } catch {
      // ignore
    }
  }

  const handleAddBuddy = () => {
    setErrorMsg(null)
    const decoded = decodeBuddyCode(buddyInput.trim())
    if (!decoded) {
      setErrorMsg("Invalid buddy code. Please check and try again.")
      return
    }
    if (decoded.bookId !== bookId) {
      setErrorMsg("This code is for a different book.")
      return
    }
    const name = buddyName.trim() || decoded.name || "Buddy"
    const buddy: ReadingBuddy = {
      bookId,
      name,
      progress: decoded.progress,
      lastUpdated: new Date().toISOString(),
      code: buddyInput.trim(),
    }
    addBuddy(buddy)
    setBuddies(getBuddies(bookId))
    setBuddyInput("")
    setBuddyName("")
    setStep("main")
  }

  const handleRemoveBuddy = (code: string) => {
    removeBuddy(bookId, code)
    setBuddies(getBuddies(bookId))
  }

  return (
    <AnimatePresence>
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
        className="fixed inset-0 bg-black/40 backdrop-blur-sm z-[70] flex items-end sm:items-center justify-center p-4 pb-safe"
        onClick={onClose}
      >
        <motion.div
          initial={{ opacity: 0, y: 40, scale: 0.97 }}
          animate={{ opacity: 1, y: 0, scale: 1 }}
          exit={{ opacity: 0, y: 40, scale: 0.97 }}
          transition={{ type: "spring", stiffness: 300, damping: 28 }}
          className="bg-background rounded-2xl shadow-2xl w-full max-w-md overflow-hidden border border-stone-200/60 dark:border-stone-700/60"
          onClick={e => e.stopPropagation()}
        >
          {/* Header */}
          <div className="flex items-center justify-between px-5 py-4 border-b border-stone-200/60 dark:border-stone-700/60">
            <div className="flex items-center gap-2">
              {step !== "main" && (
                <button
                  onClick={() => setStep("main")}
                  className="p-1 -ml-1 rounded-lg hover:bg-stone-100 dark:hover:bg-stone-800 transition-colors"
                >
                  <X className="w-4 h-4 text-stone-400 rotate-180" />
                </button>
              )}
              <div>
                <h2 className="text-base font-bold text-stone-900 dark:text-stone-100">Reading Buddy</h2>
                <p className="text-[11px] text-stone-400 dark:text-stone-500 truncate max-w-[200px]">{bookTitle}</p>
              </div>
            </div>
            <button
              onClick={onClose}
              className="p-2 -mr-2 rounded-lg hover:bg-stone-100 dark:hover:bg-stone-800 transition-colors"
            >
              <X className="w-5 h-5 text-stone-400" />
            </button>
          </div>

          <div className="p-5 space-y-5 max-h-[70vh] overflow-y-auto overscroll-contain">

            {step === "main" && (
              <>
                {/* My Code section */}
                <div className="space-y-3">
                  <p className="text-xs font-semibold text-stone-400 dark:text-stone-500 uppercase tracking-wider">Your Code</p>

                  {!myCode ? (
                    <div className="space-y-2">
                      <input
                        type="text"
                        value={myName}
                        onChange={e => setMyName(e.target.value)}
                        placeholder="Your display name (optional)"
                        maxLength={30}
                        className="w-full h-10 px-3 rounded-xl border border-stone-200 dark:border-stone-700 bg-white dark:bg-stone-900 text-stone-900 dark:text-stone-100 placeholder-stone-400 dark:placeholder-stone-600 text-sm focus:outline-none focus:ring-2 focus:ring-amber-500/40 focus:border-amber-400 transition-all"
                      />
                      <button
                        onClick={handleGenerateCode}
                        className="w-full h-11 bg-amber-600 hover:bg-amber-700 text-white text-sm font-medium rounded-xl transition-all flex items-center justify-center gap-2"
                      >
                        <Users className="w-4 h-4" />
                        Generate My Code
                      </button>
                    </div>
                  ) : (
                    <div className="space-y-2">
                      <div className="flex items-center gap-2">
                        <div className="flex-1 bg-stone-100 dark:bg-stone-800 rounded-xl px-4 py-3 font-mono text-xs text-stone-600 dark:text-stone-300 break-all select-all">
                          {myCode}
                        </div>
                        <button
                          onClick={handleCopyCode}
                          className="h-11 px-3 flex-shrink-0 bg-white dark:bg-stone-900 border border-stone-200 dark:border-stone-700 hover:bg-stone-50 dark:hover:bg-stone-800/50 text-stone-700 dark:text-stone-300 rounded-xl transition-all flex items-center gap-1.5 text-sm"
                        >
                          {codeCopied ? <Check className="w-4 h-4 text-emerald-500" /> : <Copy className="w-4 h-4" />}
                          {codeCopied ? "Copied" : "Copy"}
                        </button>
                      </div>
                      <p className="text-xs text-stone-400 dark:text-stone-500">
                        Share this code with a friend reading the same book.
                      </p>
                      <button
                        onClick={handleGenerateCode}
                        className="text-xs text-amber-600 dark:text-amber-400 hover:text-amber-700 dark:hover:text-amber-300 font-medium transition-colors"
                      >
                        Refresh code with current progress ({Math.round(progress)}%)
                      </button>
                    </div>
                  )}
                </div>

                {/* Buddies list */}
                <div className="space-y-3">
                  <div className="flex items-center justify-between">
                    <p className="text-xs font-semibold text-stone-400 dark:text-stone-500 uppercase tracking-wider">
                      Buddies {buddies.length > 0 && `(${buddies.length})`}
                    </p>
                    <button
                      onClick={() => { setStep("add-buddy"); setErrorMsg(null) }}
                      className="flex items-center gap-1 text-xs text-amber-600 dark:text-amber-400 hover:text-amber-700 dark:hover:text-amber-300 font-medium transition-colors"
                    >
                      <UserPlus className="w-3.5 h-3.5" />
                      Add Buddy
                    </button>
                  </div>

                  {buddies.length === 0 ? (
                    <div className="text-center py-8 border-2 border-dashed border-stone-200 dark:border-stone-700 rounded-xl">
                      <Users className="w-8 h-8 text-stone-300 dark:text-stone-600 mx-auto mb-2" />
                      <p className="text-sm text-stone-400 dark:text-stone-500">No buddies yet</p>
                      <p className="text-xs text-stone-300 dark:text-stone-600 mt-0.5">Add a buddy using their code</p>
                    </div>
                  ) : (
                    <div className="space-y-2">
                      {buddies.map(buddy => (
                        <div
                          key={buddy.code}
                          className="flex items-center gap-3 bg-stone-50 dark:bg-stone-800/50 rounded-xl p-3"
                        >
                          <div className="w-9 h-9 rounded-full bg-amber-100 dark:bg-amber-900/40 flex items-center justify-center flex-shrink-0">
                            <span className="text-sm font-bold text-amber-700 dark:text-amber-400">
                              {buddy.name.charAt(0).toUpperCase()}
                            </span>
                          </div>
                          <div className="flex-1 min-w-0">
                            <div className="flex items-center gap-2">
                              <p className="text-sm font-medium text-stone-900 dark:text-stone-100 truncate">{buddy.name}</p>
                              <span className="text-xs text-amber-600 dark:text-amber-400 font-semibold flex-shrink-0">
                                {buddy.progress}%
                              </span>
                            </div>
                            {/* Progress bar */}
                            <div className="mt-1.5 h-1.5 bg-stone-200 dark:bg-stone-700 rounded-full overflow-hidden">
                              <div
                                className="h-full bg-amber-500 rounded-full transition-all"
                                style={{ width: `${buddy.progress}%` }}
                              />
                            </div>
                            <p className="text-[10px] text-stone-400 dark:text-stone-500 mt-1">
                              Updated {new Date(buddy.lastUpdated).toLocaleDateString()}
                            </p>
                          </div>
                          <button
                            onClick={() => handleRemoveBuddy(buddy.code)}
                            className="p-1.5 text-stone-300 dark:text-stone-600 hover:text-red-400 dark:hover:text-red-400 transition-colors flex-shrink-0"
                            aria-label={`Remove ${buddy.name}`}
                          >
                            <Trash2 className="w-3.5 h-3.5" />
                          </button>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              </>
            )}

            {step === "add-buddy" && (
              <div className="space-y-4">
                <div>
                  <label className="block text-xs font-semibold text-stone-400 dark:text-stone-500 uppercase tracking-wider mb-2">
                    Buddy&apos;s Code
                  </label>
                  <textarea
                    value={buddyInput}
                    onChange={e => { setBuddyInput(e.target.value); setErrorMsg(null) }}
                    placeholder="Paste your buddy's code here..."
                    rows={3}
                    className="w-full px-4 py-3 rounded-xl border border-stone-200 dark:border-stone-700 bg-white dark:bg-stone-900 text-stone-900 dark:text-stone-100 placeholder-stone-400 dark:placeholder-stone-600 text-xs font-mono focus:outline-none focus:ring-2 focus:ring-amber-500/40 focus:border-amber-400 transition-all resize-none"
                    autoFocus
                  />
                  {errorMsg && (
                    <p className="text-xs text-red-500 mt-1.5">{errorMsg}</p>
                  )}
                </div>

                <div>
                  <label className="block text-xs font-semibold text-stone-400 dark:text-stone-500 uppercase tracking-wider mb-2">
                    Nickname <span className="normal-case font-normal">(optional)</span>
                  </label>
                  <input
                    type="text"
                    value={buddyName}
                    onChange={e => setBuddyName(e.target.value)}
                    placeholder="e.g. Alex"
                    maxLength={30}
                    className="w-full h-10 px-3 rounded-xl border border-stone-200 dark:border-stone-700 bg-white dark:bg-stone-900 text-stone-900 dark:text-stone-100 placeholder-stone-400 dark:placeholder-stone-600 text-sm focus:outline-none focus:ring-2 focus:ring-amber-500/40 focus:border-amber-400 transition-all"
                  />
                </div>

                <div className="flex gap-2 pt-1">
                  <button
                    onClick={() => setStep("main")}
                    className="flex-1 h-11 rounded-xl border border-stone-200 dark:border-stone-700 text-stone-600 dark:text-stone-300 text-sm font-medium hover:bg-stone-50 dark:hover:bg-stone-800/50 transition-all"
                  >
                    Cancel
                  </button>
                  <button
                    onClick={handleAddBuddy}
                    disabled={!buddyInput.trim()}
                    className="flex-1 h-11 rounded-xl bg-amber-600 hover:bg-amber-700 text-white text-sm font-medium transition-all disabled:opacity-40 disabled:cursor-not-allowed flex items-center justify-center gap-2"
                  >
                    <UserPlus className="w-4 h-4" />
                    Add Buddy
                  </button>
                </div>
              </div>
            )}

          </div>
        </motion.div>
      </motion.div>
    </AnimatePresence>
  )
}
