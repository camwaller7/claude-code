import type { Metadata } from 'next'
import { Inter } from 'next/font/google'
import './globals.css'
import { AuthHashHandler } from '@/components/auth/AuthHashHandler'

const inter = Inter({ subsets: ['latin'] })

export const metadata: Metadata = {
  title: 'Influencer PA',
  description: 'Your personal assistant for managing brand deals, DMs, and content scheduling',
}

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body className={inter.className}>
        <AuthHashHandler />
        {children}
      </body>
    </html>
  )
}
