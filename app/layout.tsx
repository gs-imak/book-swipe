import type { Metadata, Viewport } from 'next'
import { Source_Serif_4, DM_Sans } from 'next/font/google'
import Script from 'next/script'
import './globals.css'

// Cookieless, privacy-friendly analytics (Plausible-compatible). Inert unless
// NEXT_PUBLIC_PLAUSIBLE_DOMAIN is set — so no tracker loads, and because it sets
// no cookies and stores no personal identifiers, no cookie-consent banner is
// required. Point _SRC at your Plausible/self-hosted script.
const PLAUSIBLE_DOMAIN = process.env.NEXT_PUBLIC_PLAUSIBLE_DOMAIN
const PLAUSIBLE_SRC =
  process.env.NEXT_PUBLIC_PLAUSIBLE_SRC || 'https://plausible.io/js/script.js'

const sourceSerif = Source_Serif_4({
  subsets: ['latin'],
  variable: '--font-serif',
  display: 'swap',
})

const dmSans = DM_Sans({
  subsets: ['latin'],
  variable: '--font-sans',
  display: 'swap',
})

export const viewport: Viewport = {
  width: 'device-width',
  initialScale: 1,
  maximumScale: 5,
  themeColor: '#FDFBF7',
  viewportFit: 'cover',
}

export const metadata: Metadata = {
  title: 'BookSwipe - Discover Your Next Favorite Book',
  description: 'Swipe through personalized book recommendations matched to your taste. No accounts, no fuss — just great books.',
  metadataBase: new URL('https://bookswipe.app'),
  icons: {
    icon: [
      { url: '/favicon.ico', sizes: 'any' },
      { url: '/favicon.png', type: 'image/png', sizes: '64x64' },
    ],
    apple: '/icons/apple-touch-icon.png',
  },
  manifest: '/manifest.json',
  openGraph: {
    title: 'BookSwipe - Discover Your Next Favorite Book',
    description: 'Swipe through personalized book recommendations matched to your taste.',
    type: 'website',
    images: ['/logo/bookswipe_logo.png'],
  },
  twitter: {
    card: 'summary',
    title: 'BookSwipe',
    description: 'Swipe through personalized book recommendations matched to your taste.',
  },
  robots: { index: true, follow: true },
}

export default function RootLayout({
  children,
}: {
  children: React.ReactNode
}) {
  return (
    <html lang="en">
      <head>
        {/*
          No-FOUC theme script. Runs before paint and mirrors lib/theme.ts:
          key "bookswipe_theme", dark = add the "dark" class to <html> only
          when the stored value is exactly "dark" (default light). The
          useEffect-based logic remains the source of truth post-hydration.
        */}
        <script
          dangerouslySetInnerHTML={{
            __html: `(function(){try{if(localStorage.getItem("bookswipe_theme")==="dark"){document.documentElement.classList.add("dark");var m=document.querySelector('meta[name="theme-color"]');if(m){m.setAttribute("content","#0a0a0a");}}}catch(e){}})();`,
          }}
        />
        {PLAUSIBLE_DOMAIN && (
          <Script defer data-domain={PLAUSIBLE_DOMAIN} src={PLAUSIBLE_SRC} strategy="afterInteractive" />
        )}
      </head>
      <body className={`${dmSans.variable} ${sourceSerif.variable} font-sans`}>
        {/* Skip link: first focusable element, visually hidden until focused, so
            keyboard users can jump past nav straight to content (WCAG 2.4.1). */}
        <a
          href="#main-content"
          className="sr-only focus:not-sr-only focus:fixed focus:top-3 focus:left-3 focus:z-[100] focus:rounded-lg focus:bg-background focus:px-4 focus:py-2 focus:text-foreground focus:shadow-lg focus:ring-2 focus:ring-ring"
        >
          Skip to content
        </a>
        <main id="main-content" className="min-h-screen bg-background">
          {children}
        </main>
      </body>
    </html>
  )
}
