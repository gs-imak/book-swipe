"use client"

import Link from "next/link"
import { BookOpen } from "lucide-react"
import { t } from "@/lib/i18n"
import { useI18n } from "@/components/i18n-provider"

// A client component, and the reason is not stylistic. In the App Router the
// root not-found is the default NotFound boundary for EVERY route, so reading
// cookies() here (which is what the per-request translator does) took the whole
// app out of static prerendering — the landing page included, whose static HTML
// is what crawlers and first-time visitors get at first paint. Measured on this
// branch: "/" went from ○ to ƒ. Translating on the client keeps it static.
export default function NotFound() {
  // Same reason as the skip link: rendered outside the provider's subtree, so
  // it has to subscribe to the store itself or it stays on the default locale.
  useI18n()
  return (
    <div className="min-h-screen bg-background flex items-center justify-center p-6">
      <div className="text-center max-w-sm">
        <div className="w-16 h-16 bg-amber-50 rounded-2xl flex items-center justify-center mx-auto mb-6">
          <BookOpen className="w-8 h-8 text-amber-600" />
        </div>
        <h1 className="text-3xl font-bold text-stone-900 mb-3 font-serif">
          {t("not_found.page_not_found")}
        </h1>
        <p className="text-stone-500 mb-8 leading-relaxed">
          {t("not_found.the_page_you_re_looking_for")}
        </p>
        <Link
          href="/"
          className="inline-flex items-center h-12 px-8 bg-stone-900 hover:bg-stone-800 text-white text-base font-medium rounded-xl transition-colors"
        >
          {t("not_found.go_home")}
        </Link>
      </div>
    </div>
  )
}
