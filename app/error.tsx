"use client"

import { AlertCircle } from "lucide-react"

export default function Error({
  error,
  reset,
}: {
  error: Error & { digest?: string }
  reset: () => void
}) {
  return (
    <div className="min-h-screen bg-background flex items-center justify-center p-6">
      <div className="text-center max-w-sm">
        <div className="w-16 h-16 bg-red-50 rounded-2xl flex items-center justify-center mx-auto mb-6">
          <AlertCircle className="w-8 h-8 text-red-500" />
        </div>
        <h2
          className="text-2xl font-bold text-stone-900 mb-3 font-serif"
        >
          Something went wrong
        </h2>
        <p className="text-stone-500 mb-8 leading-relaxed">
          An unexpected error occurred. Your data is safe — try again or reload the page.
        </p>
        <button
          onClick={reset}
          className="inline-flex items-center h-12 px-8 bg-stone-900 hover:bg-stone-800 text-white text-base font-medium rounded-xl transition-colors"
        >
          Try Again
        </button>
      </div>
    </div>
  )
}
