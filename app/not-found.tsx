import Link from "next/link"
import { serverT } from "@/lib/i18n/server"
import { BookOpen } from "lucide-react"

export default async function NotFound() {
  const t = await serverT()
  return (
    <div className="min-h-screen bg-background flex items-center justify-center p-6">
      <div className="text-center max-w-sm">
        <div className="w-16 h-16 bg-amber-50 rounded-2xl flex items-center justify-center mx-auto mb-6">
          <BookOpen className="w-8 h-8 text-amber-600" />
        </div>
        <h1
          className="text-3xl font-bold text-stone-900 mb-3 font-serif"
        > {t("not_found.page_not_found")} </h1>
        <p className="text-stone-500 mb-8 leading-relaxed"> {t("not_found.the_page_you_re_looking_for")} </p>
        <Link
          href="/"
          className="inline-flex items-center h-12 px-8 bg-stone-900 hover:bg-stone-800 text-white text-base font-medium rounded-xl transition-colors"
        > {t("not_found.go_home")} </Link>
      </div>
    </div>
  )
}
