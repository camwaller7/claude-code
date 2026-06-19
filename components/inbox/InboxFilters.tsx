'use client'

import { useRouter, useSearchParams, usePathname } from 'next/navigation'
import type { Platform, MessageCategory } from '@/types'

const PLATFORMS: { value: Platform | 'all'; label: string }[] = [
  { value: 'all', label: 'All' },
  { value: 'instagram', label: 'Instagram' },
  { value: 'facebook', label: 'Facebook' },
  { value: 'x', label: 'X' },
  { value: 'gmail', label: 'Gmail' },
  { value: 'threads', label: 'Threads' },
]

const CATEGORIES: { value: MessageCategory | 'all'; label: string }[] = [
  { value: 'all', label: 'All' },
  { value: 'brand_deal', label: 'Brand Deal' },
  { value: 'client', label: 'Client' },
  { value: 'fan', label: 'Fan' },
  { value: 'spam', label: 'Spam' },
  { value: 'uncategorized', label: 'Uncategorized' },
]

export function InboxFilters() {
  const router = useRouter()
  const pathname = usePathname()
  const searchParams = useSearchParams()

  const platform = searchParams.get('platform') ?? 'all'
  const category = searchParams.get('category') ?? 'all'

  function setFilter(key: string, value: string) {
    const params = new URLSearchParams(searchParams.toString())
    if (value === 'all') {
      params.delete(key)
    } else {
      params.set(key, value)
    }
    router.push(`${pathname}?${params.toString()}`)
  }

  return (
    <div className="flex flex-col gap-3 mb-4">
      <div className="flex flex-wrap gap-1.5">
        {PLATFORMS.map(({ value, label }) => (
          <button
            key={value}
            onClick={() => setFilter('platform', value)}
            className={`rounded-full border px-3 py-0.5 text-xs transition-colors ${
              platform === value
                ? 'border-primary bg-primary text-primary-foreground'
                : 'border-input bg-background text-foreground hover:bg-accent'
            }`}
          >
            {label}
          </button>
        ))}
      </div>
      <div className="flex flex-wrap gap-1.5">
        {CATEGORIES.map(({ value, label }) => (
          <button
            key={value}
            onClick={() => setFilter('category', value)}
            className={`rounded-full border px-3 py-0.5 text-xs transition-colors ${
              category === value
                ? 'border-primary bg-primary text-primary-foreground'
                : 'border-input bg-background text-foreground hover:bg-accent'
            }`}
          >
            {label}
          </button>
        ))}
      </div>
    </div>
  )
}
