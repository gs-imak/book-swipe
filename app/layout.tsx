import type { Metadata, Viewport } from 'next'
import { Source_Serif_4, DM_Sans } from 'next/font/google'
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

export const viewport: Viewport = {
  width: 'device-width',
  initialScale: 1,
  maximumScale: 1,
  userScalable: false,
  themeColor: '#FDFBF7',
}

export const metadata: Metadata = {
  title: 'BookSwipe - Discover Your Next Favorite Book',
  description: 'Discover books tailored to your mood with our Tinder-like interface',
}

export default function RootLayout({
  children,
}: {
  children: React.ReactNode
}) {
  return (
    <html lang="en">
      <body className={`${dmSans.variable} ${sourceSerif.variable} font-sans`}>
        <div className="min-h-screen bg-[#FDFBF7]">
          {children}
        </div>
      </body>
    </html>
  )
}
