import type { Metadata, Viewport } from 'next'
import { Source_Serif_4, DM_Sans, Merriweather, Lora, Literata } from 'next/font/google'
import './globals.css'

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

const merriweather = Merriweather({
  subsets: ['latin'],
  weight: ['300', '400', '700'],
  variable: '--font-merriweather',
  display: 'swap',
})

const lora = Lora({
  subsets: ['latin'],
  variable: '--font-lora',
  display: 'swap',
})

const literata = Literata({
  subsets: ['latin'],
  variable: '--font-literata',
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
    apple: '/logo/bookswipe_logo.png',
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
      <body className={`${dmSans.variable} ${sourceSerif.variable} ${merriweather.variable} ${lora.variable} ${literata.variable} font-sans`}>
        <div className="min-h-screen bg-background">
          {children}
        </div>
      </body>
    </html>
  )
}
