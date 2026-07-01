'use client'

import { useEffect, useState } from 'react'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'

interface UsageSummary {
  today: { input: number; output: number; total: number }
  month: { input: number; output: number; total: number }
  allTime: { input: number; output: number; total: number }
  byFeature: {
    triage: { total: number }
    draft_reply: { total: number }
  }
  recent: Array<{ provider: string; model: string; feature: string; input_tokens: number; output_tokens: number; created_at: string }>
}

function fmt(n: number) {
  if (n >= 1_000_000) return `${(n / 1_000_000).toFixed(1)}M`
  if (n >= 1000) return `${(n / 1000).toFixed(1)}k`
  return n.toString()
}

export function TokenUsagePanel() {
  const [usage, setUsage] = useState<UsageSummary | null>(null)

  useEffect(() => {
    fetch('/api/settings/token-usage')
      .then(r => r.json())
      .then(data => { if (data && data.today && data.byFeature) setUsage(data) })
      .catch(console.error)
  }, [])

  if (!usage) return (
    <Card>
      <CardHeader><CardTitle>Token Usage</CardTitle></CardHeader>
      <CardContent><p className="text-sm text-muted-foreground">Loading…</p></CardContent>
    </Card>
  )

  return (
    <Card>
      <CardHeader>
        <CardTitle>Token Usage</CardTitle>
      </CardHeader>
      <CardContent className="flex flex-col gap-6">
        <div className="grid grid-cols-3 gap-4">
          {[
            { label: 'Today', data: usage.today },
            { label: 'This Month', data: usage.month },
            { label: 'All Time', data: usage.allTime },
          ].map(({ label, data }) => (
            <div key={label} className="flex flex-col gap-1 rounded-lg border p-3">
              <p className="text-xs text-muted-foreground">{label}</p>
              <p className="text-xl font-bold">{fmt(data.total)}</p>
              <p className="text-xs text-muted-foreground">{fmt(data.input)} in · {fmt(data.output)} out</p>
            </div>
          ))}
        </div>

        <div className="flex flex-col gap-2">
          <p className="text-sm font-medium">By feature</p>
          <div className="flex gap-4">
            <div className="flex flex-col gap-0.5">
              <p className="text-xs text-muted-foreground">Triage</p>
              <p className="text-sm font-medium">{fmt(usage.byFeature.triage.total)} tokens</p>
            </div>
            <div className="flex flex-col gap-0.5">
              <p className="text-xs text-muted-foreground">Draft Replies</p>
              <p className="text-sm font-medium">{fmt(usage.byFeature.draft_reply.total)} tokens</p>
            </div>
          </div>
        </div>

        {usage.recent.length > 0 && (
          <div className="flex flex-col gap-2">
            <p className="text-sm font-medium">Recent API calls</p>
            <div className="flex flex-col gap-1 max-h-48 overflow-y-auto">
              {usage.recent.map((r, i) => (
                <div key={i} className="flex items-center justify-between text-xs py-1 border-b last:border-0">
                  <span className="text-muted-foreground">{r.feature} · {r.model}</span>
                  <span>{fmt(r.input_tokens + r.output_tokens)} tokens</span>
                </div>
              ))}
            </div>
          </div>
        )}
      </CardContent>
    </Card>
  )
}
