import type { Metadata } from "next"
import { getServerLocale, serverT } from "@/lib/i18n/server"
import Link from "next/link"

// Edit these before launch, then have the final copy reviewed by a lawyer.
// This template reflects how the app ACTUALLY handles data today — keep it in
// sync if data flows change.
const ENTITY = "BookSwipe"
const CONTACT_EMAIL = "privacy@bookswipe.app"
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
    title: t("privacy.meta_title"),
    description: t("privacy.meta_description"),
    robots: { index: true, follow: true },
  }
}

export default async function PrivacyPolicy() {
  const t = await serverT()
  const locale = await getServerLocale()
  const effective = new Intl.DateTimeFormat(locale === "fr" ? "fr-FR" : "en-US", {
    year: "numeric", month: "long", day: "numeric", timeZone: "UTC",
  }).format(EFFECTIVE_DATE)
  return (
    <article className="mx-auto max-w-2xl px-5 py-12 prose-legal">
      <Link href="/" className="text-sm text-amber-600 hover:underline"> {t("privacy.back_to_bookswipe")} </Link>
      <h1 className="mt-6 text-3xl font-serif font-bold">{t("auth_modal.privacy_policy")}</h1>
      <p className="text-sm text-stone-500">{t("privacy.effective")} {effective}</p>

      <p>
        {ENTITY} {t("privacy.we_us_is_a_book_discovery")} </p>

      <h2>{t("privacy.data_stored_on_your_device")}</h2>
      <p> {t("privacy.bookswipe_is_local_first_by_default")} <code>{t("privacy.localstorage")}</code> {t("privacy.on_your_device_not_on_our")} </p>

      <h2>{t("privacy.optional_account_cloud_sync")}</h2>
      <p> {t("privacy.if_you_create_an_account_email")}{" "}
        <a href="https://supabase.com/privacy" rel="noopener noreferrer" target="_blank"> {t("privacy.supabase")} </a>{" "} {t("privacy.to_store_your_email_address_and")} </p>

      <h2>{t("privacy.third_party_book_data")}</h2>
      <p> {t("privacy.to_show_book_recommendations_and_content")} </p>

      <h2>{t("privacy.analytics")}</h2>
      <p> {t("privacy.if_analytics_is_enabled_we_use")} </p>

      <h2>{t("privacy.cookies_local_storage")}</h2>
      <p> {t("privacy.when_you_are_signed_in_an")} <code>{t("privacy.localstorage")}</code> {t("privacy.as_described_above_we_do_not")} </p>

      <h2>{t("privacy.your_rights")}</h2>
      <ul>
        <li>{t("privacy.export_all_your_data_settings_full")}</li>
        <li>{t("privacy.delete_your_account_and_cloud_data")}</li>
        <li>{t("privacy.clear_all_on_device_data_settings")}</li>
        <li> {t("privacy.if_you_are_in_the_eu")} </li>
      </ul>

      <h2>{t("privacy.children")}</h2>
      <p> {t("privacy.bookswipe_is_not_directed_to_children")} </p>

      <h2>{t("privacy.changes")}</h2>
      <p> {t("privacy.we_may_update_this_policy_the")} </p>

      <h2>{t("privacy.contact")}</h2>
      <p> {t("privacy.questions_or_data_requests")} <a href={`mailto:${CONTACT_EMAIL}`}>{CONTACT_EMAIL}</a>.
      </p>

      <p className="mt-8 text-sm text-stone-500"> {t("privacy.see_also_our")} <Link href="/terms" className="text-amber-600 hover:underline">{t("settings_page.terms_of_service")}</Link>.
      </p>
    </article>
  )
}
