"use client"

import { useState, useEffect, useRef } from "react"
import { motion, AnimatePresence } from "framer-motion"
import { X, Mail, Loader2, Check, Cloud, CloudOff } from "lucide-react"
import { signInWithEmail, signUpWithEmail, signInWithGoogle, sendPasswordReset } from "@/lib/supabase-sync"
import { isSupabaseConfigured } from "@/lib/supabase"

interface AuthModalProps {
  isOpen: boolean
  onClose: () => void
  onAuthSuccess: () => void
}

export function AuthModal({ isOpen, onClose, onAuthSuccess }: AuthModalProps) {
  const [mode, setMode] = useState<"signin" | "signup" | "reset">("signin")
  const [email, setEmail] = useState("")
  const [password, setPassword] = useState("")
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [success, setSuccess] = useState(false)
  const [resetSent, setResetSent] = useState(false)
  // Guard against setState after the modal unmounts mid-request.
  const mountedRef = useRef(true)

  useEffect(() => {
    mountedRef.current = true
    return () => {
      mountedRef.current = false
    }
  }, [])

  const shouldRender = isOpen && isSupabaseConfigured()

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setLoading(true)
    setError(null)

    try {
      if (mode === "reset") {
        const { error: err } = await sendPasswordReset(email)
        if (err) throw err
        if (!mountedRef.current) return
        setResetSent(true)
      } else if (mode === "signup") {
        const { error: err } = await signUpWithEmail(email, password)
        if (err) throw err
        if (!mountedRef.current) return
        setSuccess(true)
      } else {
        const { error: err } = await signInWithEmail(email, password)
        if (err) throw err
        if (!mountedRef.current) return
        onAuthSuccess()
        onClose()
      }
    } catch (err: any) {
      if (!mountedRef.current) return
      setError(err.message || "Something went wrong")
    }
    if (!mountedRef.current) return
    setLoading(false)
  }

  const handleGoogle = async () => {
    setLoading(true)
    setError(null)
    try {
      await signInWithGoogle()
    } catch (err: any) {
      if (!mountedRef.current) return
      setError(err.message || "Google sign-in failed")
      setLoading(false)
    }
  }

  return (
    <AnimatePresence>
      {shouldRender && (
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
        className="fixed inset-0 lg:left-16 z-[70] bg-black/50 backdrop-blur-sm flex items-center justify-center p-4"
        onClick={(e) => { if (e.target === e.currentTarget) onClose() }}
      >
        <motion.div
          initial={{ opacity: 0, scale: 0.95, y: 10 }}
          animate={{ opacity: 1, scale: 1, y: 0 }}
          exit={{ opacity: 0, scale: 0.95 }}
          className="bg-white dark:bg-stone-900 rounded-2xl w-full max-w-sm shadow-xl overflow-hidden"
          onClick={e => e.stopPropagation()}
        >
          {/* Header */}
          <div className="flex items-center justify-between px-5 pt-5 pb-2">
            <div className="flex items-center gap-2">
              <Cloud className="w-5 h-5 text-amber-600" />
              <h3 className="font-bold text-stone-900 dark:text-stone-100 font-serif">
                {mode === "signin" ? "Sign In" : mode === "signup" ? "Create Account" : "Reset Password"}
              </h3>
            </div>
            <button
              onClick={onClose}
              className="p-1.5 rounded-lg hover:bg-stone-100 dark:hover:bg-stone-800 transition-colors"
            >
              <X className="w-4 h-4 text-stone-400" />
            </button>
          </div>

          <div className="px-5 pb-5 space-y-4">
            <p className="text-xs text-stone-500">
              {mode === "signin"
                ? "Sign in to sync your library across devices."
                : mode === "signup"
                ? "Create an account to backup and sync your data."
                : "Enter your email and we'll send a password reset link."}
            </p>

            {success || resetSent ? (
              <div className="flex flex-col items-center gap-3 py-6">
                <Check className="w-10 h-10 text-emerald-500" />
                <p className="text-sm text-stone-600 dark:text-stone-400 text-center">
                  {resetSent
                    ? "If that email has an account, a reset link is on its way."
                    : "Check your email for a confirmation link."}
                </p>
              </div>
            ) : mode === "reset" ? (
              <form onSubmit={handleSubmit} className="space-y-3">
                <label htmlFor="reset-email" className="sr-only">Email</label>
                <input
                  id="reset-email"
                  type="email"
                  placeholder="Email"
                  value={email}
                  onChange={e => setEmail(e.target.value)}
                  required
                  autoComplete="email"
                  className="w-full h-10 px-3 rounded-xl border border-stone-200 dark:border-stone-700 bg-stone-50 dark:bg-stone-800 text-sm text-stone-900 dark:text-stone-100 placeholder-stone-400 outline-none focus:ring-2 focus:ring-amber-500/50"
                />
                {error && <p className="text-xs text-red-500">{error}</p>}
                <button
                  type="submit"
                  disabled={loading}
                  className="w-full h-10 bg-stone-900 dark:bg-stone-100 text-white dark:text-stone-900 rounded-xl text-sm font-medium hover:bg-stone-800 dark:hover:bg-stone-200 transition-colors disabled:opacity-50 flex items-center justify-center gap-2"
                >
                  {loading && <Loader2 className="w-4 h-4 animate-spin" />}
                  Send reset link
                </button>
                <p className="text-xs text-center text-stone-400">
                  <button type="button" onClick={() => { setMode("signin"); setError(null) }} className="text-amber-600 font-medium">
                    Back to sign in
                  </button>
                </p>
              </form>
            ) : (
              <>
                {/* Google */}
                <button
                  onClick={handleGoogle}
                  disabled={loading}
                  className="w-full h-10 flex items-center justify-center gap-2 rounded-xl border border-stone-200 dark:border-stone-700 bg-white dark:bg-stone-800 text-sm font-medium text-stone-700 dark:text-stone-300 hover:bg-stone-50 dark:hover:bg-stone-700 transition-colors"
                >
                  <svg className="w-4 h-4" viewBox="0 0 24 24">
                    <path d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92a5.06 5.06 0 01-2.2 3.32v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.1z" fill="#4285F4"/>
                    <path d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" fill="#34A853"/>
                    <path d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z" fill="#FBBC05"/>
                    <path d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z" fill="#EA4335"/>
                  </svg>
                  Continue with Google
                </button>

                <div className="flex items-center gap-3">
                  <div className="h-px flex-1 bg-stone-200 dark:bg-stone-700" />
                  <span className="text-xs text-stone-400">or</span>
                  <div className="h-px flex-1 bg-stone-200 dark:bg-stone-700" />
                </div>

                {/* Email form */}
                <form onSubmit={handleSubmit} className="space-y-3">
                  <input
                    type="email"
                    placeholder="Email"
                    value={email}
                    onChange={e => setEmail(e.target.value)}
                    required
                    className="w-full h-10 px-3 rounded-xl border border-stone-200 dark:border-stone-700 bg-stone-50 dark:bg-stone-800 text-sm text-stone-900 dark:text-stone-100 placeholder-stone-400 outline-none focus:ring-2 focus:ring-amber-500/50"
                  />
                  <input
                    type="password"
                    placeholder="Password"
                    value={password}
                    onChange={e => setPassword(e.target.value)}
                    required
                    minLength={6}
                    className="w-full h-10 px-3 rounded-xl border border-stone-200 dark:border-stone-700 bg-stone-50 dark:bg-stone-800 text-sm text-stone-900 dark:text-stone-100 placeholder-stone-400 outline-none focus:ring-2 focus:ring-amber-500/50"
                  />

                  {error && (
                    <p className="text-xs text-red-500">{error}</p>
                  )}

                  <button
                    type="submit"
                    disabled={loading}
                    className="w-full h-10 bg-stone-900 dark:bg-stone-100 text-white dark:text-stone-900 rounded-xl text-sm font-medium hover:bg-stone-800 dark:hover:bg-stone-200 transition-colors disabled:opacity-50 flex items-center justify-center gap-2"
                  >
                    {loading && <Loader2 className="w-4 h-4 animate-spin" />}
                    {mode === "signin" ? "Sign In" : "Create Account"}
                  </button>
                </form>

                {mode === "signin" && (
                  <p className="text-xs text-center">
                    <button onClick={() => { setMode("reset"); setError(null) }} className="text-stone-400 hover:text-amber-600">
                      Forgot password?
                    </button>
                  </p>
                )}

                <p className="text-xs text-center text-stone-400">
                  {mode === "signin" ? (
                    <>Don&apos;t have an account?{" "}
                      <button onClick={() => { setMode("signup"); setError(null) }} className="text-amber-600 font-medium">
                        Sign up
                      </button>
                    </>
                  ) : (
                    <>Already have an account?{" "}
                      <button onClick={() => { setMode("signin"); setError(null) }} className="text-amber-600 font-medium">
                        Sign in
                      </button>
                    </>
                  )}
                </p>

                {mode === "signup" && (
                  <p className="text-[10px] text-center text-stone-400 leading-relaxed">
                    By creating an account you agree to our{" "}
                    <a href="/terms" target="_blank" className="underline hover:text-amber-600">Terms</a>{" "}
                    and{" "}
                    <a href="/privacy" target="_blank" className="underline hover:text-amber-600">Privacy Policy</a>.
                  </p>
                )}
              </>
            )}
          </div>
        </motion.div>
      </motion.div>
      )}
    </AnimatePresence>
  )
}
