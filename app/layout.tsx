import type { Metadata } from 'next'
import { Inter, Fraunces } from 'next/font/google'
import './globals.css'
import { AuthHashHandler } from '@/components/auth/AuthHashHandler'
import { ThemeProvider } from '@/components/layout/ThemeProvider'
import { Toaster } from 'sonner'
import { BrandThemeProvider } from '@/components/layout/BrandThemeProvider'

const inter = Inter({ subsets: ['latin'] })
// Display serif for titles — a premium, warm counterpoint to the clean sans
// body. Exposed as --font-display; applied to headings in globals.css.
const fraunces = Fraunces({
  subsets: ['latin'],
  variable: '--font-display',
  display: 'swap',
})

export const metadata: Metadata = {
  title: 'Corvelle',
  description: 'Your personal assistant for managing brand deals, DMs, and content scheduling',
  manifest: '/manifest.json',
  icons: { icon: '/corvelle-icon.png', apple: '/corvelle-icon.png' },
}

export const viewport = {
  themeColor: '#3f5c50',
}

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" data-brand="studio" suppressHydrationWarning className={fraunces.variable}>
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
