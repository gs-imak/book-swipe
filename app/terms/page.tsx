import type { Metadata } from "next"
import Link from "next/link"

// Edit before launch; have final copy reviewed by a lawyer.
const ENTITY = "BookSwipe"
const CONTACT_EMAIL = "hello@bookswipe.app"
const GOVERNING_LAW = "[your jurisdiction]"
const EFFECTIVE_DATE = "June 21, 2026"

export const metadata: Metadata = {
  title: "Terms of Service — BookSwipe",
  description: "The terms for using BookSwipe.",
  robots: { index: true, follow: true },
}

export default function TermsOfService() {
  return (
    <article className="mx-auto max-w-2xl px-5 py-12 prose-legal">
      <Link href="/" className="text-sm text-amber-600 hover:underline">
        ← Back to BookSwipe
      </Link>
      <h1 className="mt-6 text-3xl font-serif font-bold">Terms of Service</h1>
      <p className="text-sm text-stone-500">Effective {EFFECTIVE_DATE}</p>

      <p>
        By using {ENTITY} (&quot;the Service&quot;) you agree to these terms. If
        you do not agree, do not use the Service.
      </p>

      <h2>The Service</h2>
      <p>
        BookSwipe helps you discover books and track your reading. Book metadata
        and content are provided by third parties (Google Books, Open Library,
        Project Gutenberg) and are subject to their terms. Public-domain texts are
        read via Project Gutenberg.
      </p>

      <h2>Accounts</h2>
      <p>
        An account is optional and only needed for cross-device sync. You are
        responsible for keeping your credentials secure and for activity under
        your account. You may delete your account at any time.
      </p>

      <h2>Your content</h2>
      <p>
        Reviews, notes, and ratings you create remain yours. By storing them with
        the Service you grant us only the limited permission needed to store,
        sync, and display them back to you. Do not submit unlawful content or
        content that infringes others&apos; rights.
      </p>

      <h2>Acceptable use</h2>
      <ul>
        <li>Do not abuse, overload, or attempt to break the Service or its APIs.</li>
        <li>Do not use the Service for unlawful purposes.</li>
        <li>Do not attempt to access other users&apos; data.</li>
      </ul>

      <h2>Third-party content</h2>
      <p>
        Book covers, descriptions, ratings, and texts originate from third-party
        sources. We do not guarantee their accuracy, availability, or licensing
        for any particular use beyond personal reading and discovery.
      </p>

      <h2>No warranty</h2>
      <p>
        The Service is provided &quot;as is&quot; without warranties of any kind.
        We do not guarantee it will be uninterrupted, error-free, or that data
        will never be lost. Keep your own backups (Settings → Full backup).
      </p>

      <h2>Limitation of liability</h2>
      <p>
        To the maximum extent permitted by law, {ENTITY} is not liable for
        indirect, incidental, or consequential damages, or for any loss of data,
        arising from your use of the Service.
      </p>

      <h2>Termination</h2>
      <p>
        You may stop using the Service and delete your account at any time. We may
        suspend access for violations of these terms.
      </p>

      <h2>Governing law</h2>
      <p>These terms are governed by the laws of {GOVERNING_LAW}.</p>

      <h2>Contact</h2>
      <p>
        <a href={`mailto:${CONTACT_EMAIL}`}>{CONTACT_EMAIL}</a>
      </p>

      <p className="mt-8 text-sm text-stone-500">
        See also our <Link href="/privacy" className="text-amber-600 hover:underline">Privacy Policy</Link>.
      </p>
    </article>
  )
}
