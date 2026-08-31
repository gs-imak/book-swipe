import type { Metadata } from "next"
import { getServerLocale, serverT } from "@/lib/i18n/server"
import Link from "next/link"

// Edit before launch; have final copy reviewed by a lawyer.
const ENTITY = "BookSwipe"
const CONTACT_EMAIL = "hello@bookswipe.app"
// Still a placeholder, and deliberately visible as one: a governing-law
// clause naming the wrong country is worse than one that obviously needs
// filling in. Translated so it reads as a placeholder in both languages.
const GOVERNING_LAW_KEY = "terms.governing_law_placeholder"
// Stored as an instant, rendered in the reader's language — "June 21, 2026"
// hard-coded is an English sentence hiding in a constant.
const EFFECTIVE_DATE = new Date("2026-06-21T00:00:00Z")

export async function generateMetadata(): Promise<Metadata> {
  const t = await serverT()
  const locale = await getServerLocale()
  const effective = new Intl.DateTimeFormat(locale === "fr" ? "fr-FR" : "en-US", {
    year: "numeric", month: "long", day: "numeric", timeZone: "UTC",
  }).format(EFFECTIVE_DATE)
  return {
    title: t("terms.meta_title"),
    description: t("terms.meta_description"),
    robots: { index: true, follow: true },
  }
}

export default async function TermsOfService() {
  const t = await serverT()
  const locale = await getServerLocale()
  const effective = new Intl.DateTimeFormat(locale === "fr" ? "fr-FR" : "en-US", {
    year: "numeric", month: "long", day: "numeric", timeZone: "UTC",
  }).format(EFFECTIVE_DATE)
  return (
    <article className="mx-auto max-w-2xl px-5 py-12 prose-legal">
      <Link href="/" className="text-sm text-amber-600 hover:underline"> {t("privacy.back_to_bookswipe")} </Link>
      <h1 className="mt-6 text-3xl font-serif font-bold">{t("settings_page.terms_of_service")}</h1>
      <p className="text-sm text-stone-500">{t("privacy.effective")} {effective}</p>

      <p> {t("terms.by_using")} {ENTITY} {t("terms.the_service_you_agree_to_these")} </p>

      <h2>{t("terms.the_service")}</h2>
      <p> {t("terms.bookswipe_helps_you_discover_books_and")} </p>

      <h2>{t("terms.accounts")}</h2>
      <p> {t("terms.an_account_is_optional_and_only")} </p>

      <h2>{t("terms.your_content")}</h2>
      <p> {t("terms.reviews_notes_and_ratings_you_create")} </p>

      <h2>{t("terms.acceptable_use")}</h2>
      <ul>
        <li>{t("terms.do_not_abuse_overload_or_attempt")}</li>
        <li>{t("terms.do_not_use_the_service_for")}</li>
        <li>{t("terms.do_not_attempt_to_access_other")}</li>
      </ul>

      <h2>{t("terms.third_party_content")}</h2>
      <p> {t("terms.book_covers_descriptions_ratings_and_texts")} </p>

      <h2>{t("terms.no_warranty")}</h2>
      <p> {t("terms.the_service_is_provided_as_is")} </p>

      <h2>{t("terms.limitation_of_liability")}</h2>
      <p> {t("terms.to_the_maximum_extent_permitted_by")} {ENTITY} {t("terms.is_not_liable_for_indirect_incidental")} </p>

      <h2>{t("terms.termination")}</h2>
      <p> {t("terms.you_may_stop_using_the_service")} </p>

      <h2>{t("terms.governing_law")}</h2>
      <p>{t("terms.these_terms_are_governed_by_the")} {t(GOVERNING_LAW_KEY)}.</p>

      <h2>{t("privacy.contact")}</h2>
      <p>
        <a href={`mailto:${CONTACT_EMAIL}`}>{CONTACT_EMAIL}</a>
      </p>

      <p className="mt-8 text-sm text-stone-500"> {t("privacy.see_also_our")} <Link href="/privacy" className="text-amber-600 hover:underline">{t("auth_modal.privacy_policy")}</Link>.
      </p>
    </article>
  )
}
