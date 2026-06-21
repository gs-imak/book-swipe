"use client"

import { useState, useEffect } from "react"
import { Loader2, Check, KeyRound } from "lucide-react"
import { updatePassword } from "@/lib/supabase-sync"
import { isSupabaseConfigured } from "@/lib/supabase"

export default function ResetPasswordPage() {
  const [password, setPassword] = useState("")
  const [confirm, setConfirm] = useState("")
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [done, setDone] = useState(false)
  const [configured, setConfigured] = useState(true)

  useEffect(() => {
    setConfigured(isSupabaseConfigured())
  }, [])

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setError(null)
    if (password.length < 6) {
      setError("Password must be at least 6 characters.")
      return
    }
    if (password !== confirm) {
      setError("Passwords do not match.")
      return
    }
    setLoading(true)
    try {
      const { error: err } = await updatePassword(password)
      if (err) throw err
      setDone(true)
      setTimeout(() => {
        window.location.href = "/"
      }, 1800)
    } catch (err: any) {
      setError(err?.message || "Could not reset password. The link may have expired.")
    } finally {
      setLoading(false)
    }
  }

  return (
    <main className="min-h-screen flex items-center justify-center bg-background px-4">
      <div className="w-full max-w-sm rounded-2xl border border-stone-200 dark:border-stone-700 bg-white dark:bg-stone-900 p-6 shadow-sm">
        <div className="flex items-center gap-2 mb-4">
          <KeyRound className="w-5 h-5 text-amber-600" aria-hidden="true" />
          <h1 className="text-lg font-serif font-bold text-stone-900 dark:text-stone-100">
            Set a new password
          </h1>
        </div>

        {!configured ? (
          <p className="text-sm text-stone-500">
            Accounts are not enabled on this deployment.
          </p>
        ) : done ? (
          <div className="flex flex-col items-center gap-3 py-6">
            <Check className="w-10 h-10 text-emerald-500" aria-hidden="true" />
            <p className="text-sm text-stone-600 dark:text-stone-400 text-center">
              Password updated. Redirecting you to BookSwipe…
            </p>
          </div>
        ) : (
          <form onSubmit={handleSubmit} className="space-y-3">
            <label htmlFor="new-password" className="sr-only">New password</label>
            <input
              id="new-password"
              type="password"
              placeholder="New password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              required
              minLength={6}
              autoComplete="new-password"
              className="w-full h-10 px-3 rounded-xl border border-stone-200 dark:border-stone-700 bg-stone-50 dark:bg-stone-800 text-sm text-stone-900 dark:text-stone-100 outline-none focus:ring-2 focus:ring-amber-500/50"
            />
            <label htmlFor="confirm-password" className="sr-only">Confirm new password</label>
            <input
              id="confirm-password"
              type="password"
              placeholder="Confirm new password"
              value={confirm}
              onChange={(e) => setConfirm(e.target.value)}
              required
              minLength={6}
              autoComplete="new-password"
              className="w-full h-10 px-3 rounded-xl border border-stone-200 dark:border-stone-700 bg-stone-50 dark:bg-stone-800 text-sm text-stone-900 dark:text-stone-100 outline-none focus:ring-2 focus:ring-amber-500/50"
            />
            {error && <p className="text-xs text-red-500">{error}</p>}
            <button
              type="submit"
              disabled={loading}
              className="w-full h-10 bg-stone-900 dark:bg-stone-100 text-white dark:text-stone-900 rounded-xl text-sm font-medium hover:bg-stone-800 dark:hover:bg-stone-200 transition-colors disabled:opacity-50 flex items-center justify-center gap-2"
            >
              {loading && <Loader2 className="w-4 h-4 animate-spin" aria-hidden="true" />}
              Update password
            </button>
          </form>
        )}
      </div>
    </main>
  )
}
