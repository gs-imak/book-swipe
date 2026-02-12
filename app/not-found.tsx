import Link from "next/link"
import { BookOpen } from "lucide-react"

export default function NotFound() {
  return (
    <div className="min-h-screen bg-background flex items-center justify-center p-6">
      <div className="text-center max-w-sm">
        <div className="w-16 h-16 bg-amber-50 rounded-2xl flex items-center justify-center mx-auto mb-6">
          <BookOpen className="w-8 h-8 text-amber-600" />
        </div>
        <h1
          className="text-3xl font-bold text-stone-900 mb-3 font-serif"
        >
          Page not found
        </h1>
        <p className="text-stone-500 mb-8 leading-relaxed">
          The page you&apos;re looking for doesn&apos;t exist or has been moved.
        </p>
        <Link
          href="/"
          className="inline-flex items-center h-12 px-8 bg-stone-900 hover:bg-stone-800 text-white text-base font-medium rounded-xl transition-colors"
        >
          Go Home
        </Link>
      </div>
    </div>
  )
}
