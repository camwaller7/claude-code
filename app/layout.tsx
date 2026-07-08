import type { Metadata } from 'next'
import { Inter } from 'next/font/google'
import './globals.css'
import { AuthHashHandler } from '@/components/auth/AuthHashHandler'
import { ThemeProvider } from '@/components/layout/ThemeProvider'
import { Toaster } from 'sonner'
import { BrandThemeProvider } from '@/components/layout/BrandThemeProvider'

const inter = Inter({ subsets: ['latin'] })

export const metadata: Metadata = {
  title: 'Influencer PA',
  description: 'Your personal assistant for managing brand deals, DMs, and content scheduling',
  manifest: '/manifest.json',
  icons: { icon: '/icon.svg', apple: '/icon.svg' },
}

export const viewport = {
  themeColor: '#8b5cf6',
}

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" suppressHydrationWarning>
      <body className={inter.className}>
        <ThemeProvider>
          <BrandThemeProvider />
          <AuthHashHandler />
          {children}
          <Toaster richColors position="top-center" />
        </ThemeProvider>
      </body>
    </html>
  )
}
