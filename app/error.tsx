'use client'

import { useEffect } from 'react'

// Route-segment error boundary for the app. Logs the error (with its digest)
// and shows a safe, detail-free recovery UI instead of the raw error overlay.
export default function Error({ error, reset }: { error: Error & { digest?: string }; reset: () => void }) {
  useEffect(() => {
    console.error('[app error]', error.digest ?? error.message)
  }, [error])

  return (
    <div className="mx-auto flex min-h-[60vh] max-w-md flex-col items-center justify-center gap-4 text-center">
      <h1 className="text-xl font-semibold">Something went wrong</h1>
      <p className="text-sm text-muted-foreground">
        An unexpected error occurred. You can try again, or head back to your dashboard.
      </p>
      <div className="flex gap-2">
        <button
          onClick={() => reset()}
          className="rounded-lg border bg-background px-4 py-2 text-sm font-medium hover:bg-accent transition-colors"
        >
          Try again
        </button>
        <a
          href="/dashboard"
          className="rounded-lg bg-primary px-4 py-2 text-sm font-medium text-primary-foreground hover:opacity-90"
        >
          Go to dashboard
        </a>
      </div>
    </div>
  )
}
