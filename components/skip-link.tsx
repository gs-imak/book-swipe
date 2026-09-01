"use client"

import { t } from "@/lib/i18n"
import { useI18n } from "@/components/i18n-provider"

/**
 * The first focusable element on the page, visually hidden until focused, so
 * keyboard users can jump past the nav straight to content (WCAG 2.4.1).
 *
 * A client component on purpose. It is the only translated string in the root
 * layout, and reading the locale on the SERVER there would mean calling
 * cookies() in the layout — which opts EVERY route out of static prerendering,
 * including the landing page whose static HTML is the reason crawlers and
 * first-time visitors get real content at first paint. It renders English in
 * the server HTML and corrects itself on mount, which is the right trade for a
 * link nobody sees until they press Tab.
 */
export function SkipLink() {
  // Subscribes so this re-renders when the locale resolves: the link sits in
  // the root layout, outside the provider's subtree, so nothing else would.
  useI18n()
  return (
    <a
      href="#main-content"
      className="sr-only focus:not-sr-only focus:fixed focus:top-3 focus:left-3 focus:z-[100] focus:rounded-lg focus:bg-background focus:px-4 focus:py-2 focus:text-foreground focus:shadow-lg focus:ring-2 focus:ring-ring"
    >
      {t("layout.skip_to_content")}
    </a>
  )
}
