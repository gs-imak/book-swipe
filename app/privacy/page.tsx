import type { Metadata } from "next"
import Link from "next/link"

// Edit these before launch, then have the final copy reviewed by a lawyer.
// This template reflects how the app ACTUALLY handles data today — keep it in
// sync if data flows change.
const ENTITY = "BookSwipe"
const CONTACT_EMAIL = "privacy@bookswipe.app"
const EFFECTIVE_DATE = "June 21, 2026"

export const metadata: Metadata = {
  title: "Privacy Policy — BookSwipe",
  description: "How BookSwipe handles your data.",
  robots: { index: true, follow: true },
}

export default function PrivacyPolicy() {
  return (
    <article className="mx-auto max-w-2xl px-5 py-12 prose-legal">
      <Link href="/" className="text-sm text-amber-600 hover:underline">
        ← Back to BookSwipe
      </Link>
      <h1 className="mt-6 text-3xl font-serif font-bold">Privacy Policy</h1>
      <p className="text-sm text-stone-500">Effective {EFFECTIVE_DATE}</p>

      <p>
        {ENTITY} (&quot;we&quot;, &quot;us&quot;) is a book-discovery app. This
        policy explains what data we handle and why. We do not sell your data and
        we do not run advertising trackers.
      </p>

      <h2>Data stored on your device</h2>
      <p>
        BookSwipe is local-first. By default your library, reviews, notes,
        reading progress, shelves, preferences, and gamification stats are stored
        in your browser&apos;s <code>localStorage</code> on your device — not on
        our servers. Clearing your browser data or using &quot;Clear all
        data&quot; in Settings removes it.
      </p>

      <h2>Optional account &amp; cloud sync</h2>
      <p>
        If you create an account (email + password, or Google sign-in) we use{" "}
        <a href="https://supabase.com/privacy" rel="noopener noreferrer" target="_blank">
          Supabase
        </a>{" "}
        to store: your email address, and the reading data you choose to sync
        (your library, reviews, reading progress, and swipe history). This lets
        you access your data across devices. You can delete your account and all
        associated cloud data at any time from Settings.
      </p>

      <h2>Third-party book data</h2>
      <p>
        To show book recommendations and content, your searches and book lookups
        are proxied through our servers to: Google Books, Open Library, and
        Project Gutenberg. Your IP address reaches our server; the relevant query
        text reaches those providers under their own privacy policies. We do not
        send them your identity.
      </p>

      <h2>Analytics</h2>
      <p>
        If analytics is enabled, we use privacy-friendly, cookieless analytics
        that records aggregate usage (e.g. page views) without tracking
        individuals across sites and without storing personal identifiers. No
        third-party advertising cookies are used.
      </p>

      <h2>Cookies &amp; local storage</h2>
      <p>
        When you are signed in, an authentication session token is stored to keep
        you logged in. App data is stored in <code>localStorage</code> as
        described above. We do not use advertising or cross-site tracking
        cookies.
      </p>

      <h2>Your rights</h2>
      <ul>
        <li>Export all your data (Settings → Full backup / CSV export).</li>
        <li>Delete your account and cloud data (Settings → Account).</li>
        <li>Clear all on-device data (Settings → Clear all data).</li>
        <li>
          If you are in the EU/UK, you have rights under the GDPR including
          access, correction, erasure, and portability. Contact us to exercise
          them.
        </li>
      </ul>

      <h2>Children</h2>
      <p>
        BookSwipe is not directed to children under 13 (or the minimum age in
        your country). We do not knowingly collect data from them.
      </p>

      <h2>Changes</h2>
      <p>
        We may update this policy; the effective date above will change. Material
        changes will be surfaced in the app.
      </p>

      <h2>Contact</h2>
      <p>
        Questions or data requests: <a href={`mailto:${CONTACT_EMAIL}`}>{CONTACT_EMAIL}</a>.
      </p>

      <p className="mt-8 text-sm text-stone-500">
        See also our <Link href="/terms" className="text-amber-600 hover:underline">Terms of Service</Link>.
      </p>
    </article>
  )
}
