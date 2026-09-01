import type { Metadata, Viewport } from 'next'
import { SkipLink } from '@/components/skip-link'
import { Source_Serif_4, DM_Sans } from 'next/font/google'
import Script from 'next/script'
import './globals.css'

// Cookieless, privacy-friendly analytics (Plausible-compatible). Inert unless
// NEXT_PUBLIC_PLAUSIBLE_DOMAIN is set — so no tracker loads, and because it sets
// no cookies and stores no personal identifiers, no cookie-consent banner is
// required. Point _SRC at your Plausible/self-hosted script.
import { Analytics } from "@vercel/analytics/next"
import { SpeedInsights } from "@vercel/speed-insights/next"

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

// Static, and in English on purpose: this is the marketing copy crawlers
// read, and localising it here would mean reading the request, which opts the
// whole app out of static prerendering.
export const metadata: Metadata = {
  title: 'BookSwipe - Discover Your Next Favorite Book',
  description: 'Swipe through personalized book recommendations matched to your taste. No accounts, no fuss — just great books.',
  metadataBase: new URL('https://book-swipe-tau.vercel.app'),
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
    // Stamped "en" statically and corrected by the boot script below before
    // <body> is parsed — a cascade guarantee, and one that keeps this layout
    // free of any read of the request.
    <html lang="en" suppressHydrationWarning>
      <head>
        {/*
          Boot script. Parser-blocking and in <head>, so everything it decides
          is on <html> before <body> is parsed — a cascade guarantee, never a
          timing race. It owns three things:

          0. Language: stamps <html lang> from the stored choice, the cookie, or
             the browser. The layout renders lang="en" statically — reading the
             request there would take every route out of static prerendering —
             and the legal pages never mount the client provider, so without
             this /privacy served French prose under lang="en".
          1. Theme (mirrors lib/theme.ts): key "bookswipe_theme", dark only when
             the stored value is exactly "dark". Post-hydration, the effect in
             app/page.tsx remains the source of truth.
          2. Boot state: the landing hero is now server-rendered so crawlers and
             first-time visitors get real content at first paint. A RETURNING
             user must never see it, so this stamps data-app-state/-view and the
             mask in globals.css hides the hero before it can paint.
          3. A tap on the hero CTA that lands before hydration: recorded on
             window.__bsPendingStart and replayed by app/page.tsx, so the button
             is never a dead control during the pre-hydration window.

          Every failure path (storage throws, private mode, JS off, crawler,
          first-time visitor) sets no attribute and falls through to the hero —
          fail-open toward the audience that needs it.
        */}
        <script
          dangerouslySetInnerHTML={{
            __html: `(function(){try{var d=document.documentElement;var L=null;try{L=localStorage.getItem("bookswipe_ui_locale");}catch(e){}if(!L){var mm=document.cookie.match(/bookswipe_locale=([a-z]{2})/);if(mm){L=mm[1];}}if(!L&&navigator.languages){for(var i=0;i<navigator.languages.length;i++){var b=String(navigator.languages[i]).toLowerCase().split("-")[0];if(b==="fr"||b==="en"){L=b;break;}}}if(L==="fr"||L==="en"){d.setAttribute("lang",L);}if(localStorage.getItem("bookswipe_theme")==="dark"){d.classList.add("dark");var m=document.querySelector('meta[name="theme-color"]');if(m){m.setAttribute("content","#0a0a0a");}}if(localStorage.getItem("bookswipe_onboarded")==="true"){d.setAttribute("data-app-state","returning");var h=location.hash;d.setAttribute("data-app-view",h==="#/discover"?"deck":h==="#/read"?"read":"shelf");}var c=function(e){if(window.__bsHydrated)return;var t=e.target&&e.target.closest&&e.target.closest("[data-hero-cta]");if(!t)return;window.__bsPendingStart=true;d.setAttribute("data-app-state","entering");d.setAttribute("data-app-view","deck");document.removeEventListener("click",c,true);};window.__bsBootClick=c;document.addEventListener("click",c,true);}catch(e){}})();`,
          }}
        />
        {PLAUSIBLE_DOMAIN && (
          <Script defer data-domain={PLAUSIBLE_DOMAIN} src={PLAUSIBLE_SRC} strategy="afterInteractive" />
        )}
      </head>
      <body className={`${dmSans.variable} ${sourceSerif.variable} font-sans`}>
        {/* Skip link: first focusable element, visually hidden until focused, so
            keyboard users can jump past nav straight to content (WCAG 2.4.1). */}
        <SkipLink />
        <main id="main-content" className="min-h-screen bg-background">
          {children}
        </main>
        {/* Web Analytics + Speed Insights were already provisioned on the
            Vercel project but no client was installed, so nothing was being
            collected. Both load after hydration and stay off the cold path we
            spent PR #73 shrinking. Plausible above remains supported and is
            simply inert while NEXT_PUBLIC_PLAUSIBLE_DOMAIN is unset. */}
        <Analytics />
        <SpeedInsights />
      </body>
    </html>
  )
}
