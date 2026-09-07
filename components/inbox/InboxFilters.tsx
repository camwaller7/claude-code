'use client'

import { useEffect, useRef, useState } from 'react'
import { Search, X } from 'lucide-react'
import { useRouter, useSearchParams, usePathname } from 'next/navigation'
import type { Platform, MessageCategory } from '@/types'

const PLATFORMS: { value: Platform | 'all'; label: string }[] = [
  { value: 'all', label: 'All' },
  { value: 'instagram', label: 'Instagram' },
  { value: 'facebook', label: 'Facebook' },
  { value: 'x', label: 'X' },
  { value: 'gmail', label: 'Gmail' },
]

const CATEGORIES: { value: MessageCategory | 'all'; label: string }[] = [
  { value: 'all', label: 'All' },
  { value: 'brand_deal', label: 'Brand Deal' },
  { value: 'client', label: 'Client' },
  { value: 'fan', label: 'Fan' },
  { value: 'personal', label: 'Personal' },
  { value: 'spam', label: 'Spam' },
  { value: 'uncategorized', label: 'Uncategorized' },
]

export function InboxFilters() {
  const router = useRouter()
  const pathname = usePathname()
  const searchParams = useSearchParams()

  const platform = searchParams.get('platform') ?? 'all'
  const category = searchParams.get('category') ?? 'all'
  const status = searchParams.get('status') ?? 'needs_reply'
  const q = searchParams.get('q') ?? ''
  const [search, setSearch] = useState(q)
  const debounce = useRef<ReturnType<typeof setTimeout> | null>(null)

  // Keep the local search box in sync when the URL query param changes
  // externally (e.g. back/forward navigation).
  // eslint-disable-next-line react-hooks/set-state-in-effect
  useEffect(() => setSearch(q), [q])

  function onSearchChange(value: string) {
    setSearch(value)
    if (debounce.current) clearTimeout(debounce.current)
    debounce.current = setTimeout(() => setFilter('q', value.trim() || 'all'), 300)
  }

  function setFilter(key: string, value: string) {
    const params = new URLSearchParams(searchParams.toString())
    if (value === 'all' && key !== 'status') {
      params.delete(key)
    } else {
      params.set(key, value)
    }
    router.push(`${pathname}?${params.toString()}`)
  }

  return (
    <div className="flex flex-col gap-3 mb-4">
      {/* Search */}
      <div className="flex items-center gap-2 rounded-xl border bg-background px-3 py-2 max-w-md">
        <Search className="h-4 w-4 text-muted-foreground shrink-0" />
        <input
          value={search}
          onChange={e => onSearchChange(e.target.value)}
          placeholder="Search by name or handle…"
          className="flex-1 bg-transparent text-sm outline-none placeholder:text-muted-foreground"
        />
        {search && (
          <button onClick={() => onSearchChange('')} aria-label="Clear search">
            <X className="h-4 w-4 text-muted-foreground hover:text-foreground" />
          </button>
        )}
      </div>
      {/* Needs-reply quick filter */}
      <div className="flex flex-wrap gap-1.5">
        <button
          onClick={() => setFilter('status', status === 'needs_reply' ? 'all' : 'needs_reply')}
          className={`rounded-full border px-3 py-0.5 text-xs font-medium transition-colors ${
            status === 'needs_reply'
              ? 'border-red-500 bg-red-500 text-white'
              : 'border-input bg-background text-foreground hover:bg-accent'
          }`}
        >
          Needs reply
        </button>
      </div>
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
