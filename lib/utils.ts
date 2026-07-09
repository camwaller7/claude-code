import { clsx, type ClassValue } from "clsx"
import { twMerge } from "tailwind-merge"

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs))
}

/**
 * Spelled-out month, never ambiguous digits — "12/8" reads as Aug 12 to an
 * American and Dec 8 to almost everyone else. Always renders identically
 * regardless of server/browser locale.
 */
export function formatDate(dateStr: string, opts?: { withTime?: boolean }): string {
  const d = new Date(dateStr)
  const date = d.toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' })
  if (!opts?.withTime) return date
  const time = d.toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit' })
  return `${date}, ${time}`
}

export function relativeTime(dateStr: string): string {
  const diff = Date.now() - new Date(dateStr).getTime()
  if (diff < 0) {
    const inMinutes = Math.ceil(-diff / 60000)
    if (inMinutes < 60) return `in ${inMinutes}m`
    const inHours = Math.ceil(inMinutes / 60)
    if (inHours < 24) return `in ${inHours}h`
    return `in ${Math.ceil(inHours / 24)}d`
  }
  const minutes = Math.floor(diff / 60000)
  if (minutes < 1) return 'just now'
  if (minutes < 60) return `${minutes}m ago`
  const hours = Math.floor(minutes / 60)
  if (hours < 24) return `${hours}h ago`
  const days = Math.floor(hours / 24)
  if (days < 30) return `${days}d ago`
  const months = Math.floor(days / 30)
  if (months < 12) return `${months}mo ago`
  return `${Math.floor(months / 12)}y ago`
}
