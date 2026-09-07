'use client'

import { useState } from 'react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { Sparkles, MessageSquare, Loader2 } from 'lucide-react'
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog'
import { Textarea } from '@/components/ui/textarea'
import { Button } from '@/components/ui/button'
import type { Deal } from '@/types'

// Deal detail view: an AI-generated preview (charged against the user's AI
// usage, cached on the deal) and an editable notes section.
export function DealDetailDialog({ deal, children }: { deal: Deal; children: React.ReactNode }) {
  const router = useRouter()
  const [summary, setSummary] = useState(deal.ai_summary ?? '')
  const [generating, setGenerating] = useState(false)
  const [summaryError, setSummaryError] = useState<string | null>(null)
  const [notes, setNotes] = useState(deal.notes ?? '')
  const [savingNotes, setSavingNotes] = useState(false)
  const [notesSaved, setNotesSaved] = useState(false)

  async function generate() {
    setGenerating(true)
    setSummaryError(null)
    try {
      const res = await fetch(`/api/deals/${deal.id}/summary`, { method: 'POST' })
      const data = (await res.json().catch(() => null)) as { summary?: string; error?: string } | null
      if (data?.summary) {
        setSummary(data.summary)
        router.refresh()
      } else {
        setSummaryError(data?.error ?? 'Could not generate a preview. Please try again.')
      }
    } catch {
      setSummaryError('Could not generate a preview. Please try again.')
    } finally {
      setGenerating(false)
    }
  }

  async function saveNotes() {
    setSavingNotes(true)
    setNotesSaved(false)
    try {
      const res = await fetch(`/api/deals/${deal.id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ notes }),
      })
      if (res.ok) {
        setNotesSaved(true)
        router.refresh()
        setTimeout(() => setNotesSaved(false), 2000)
      }
    } finally {
      setSavingNotes(false)
    }
  }

  return (
    <Dialog>
      <DialogTrigger asChild>{children}</DialogTrigger>
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <DialogTitle>{deal.brand_name}</DialogTitle>
        </DialogHeader>

        <div className="flex flex-col gap-4">
          {/* Deal facts */}
          <div className="flex flex-wrap gap-x-6 gap-y-1 text-sm">
            {deal.contact_name && <span className="text-muted-foreground">Contact: <span className="text-foreground">{deal.contact_name}</span></span>}
            {deal.deal_value != null && <span className="text-muted-foreground">Value: <span className="font-medium text-green-600">{deal.currency} {deal.deal_value.toLocaleString()}</span></span>}
            <span className="text-muted-foreground">Status: <span className="capitalize text-foreground">{deal.status}</span></span>
          </div>

          {deal.conversation_id && (
            <Link href={`/inbox/${deal.conversation_id}`} className="inline-flex w-fit items-center gap-1.5 text-sm text-primary hover:underline">
              <MessageSquare className="h-4 w-4" /> View messages
            </Link>
          )}

          {/* AI preview */}
          <div className="rounded-xl border bg-muted/30 p-3">
            <div className="mb-2 flex items-center justify-between">
              <div className="flex items-center gap-1.5 text-sm font-medium">
                <Sparkles className="h-4 w-4 text-primary" /> AI preview
              </div>
              <Button size="sm" variant="outline" onClick={generate} disabled={generating}>
                {generating ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : summary ? 'Regenerate' : 'Generate'}
              </Button>
            </div>
            {summary ? (
              <p className="whitespace-pre-wrap text-sm text-muted-foreground">{summary}</p>
            ) : (
              <p className="text-sm text-muted-foreground">Generate an AI summary of this deal. This uses your AI usage.</p>
            )}
            {summaryError && <p className="mt-2 text-sm text-destructive">{summaryError}</p>}
          </div>

          {/* Notes */}
          <div className="flex flex-col gap-2">
            <label className="text-sm font-medium">Notes</label>
            <Textarea value={notes} onChange={e => setNotes(e.target.value)} rows={4} placeholder="Add your own notes about this deal…" />
            <div className="flex items-center justify-end gap-2">
              {notesSaved && <span className="text-xs text-emerald-600">Saved</span>}
              <Button size="sm" onClick={saveNotes} disabled={savingNotes}>
                {savingNotes ? 'Saving…' : 'Save notes'}
              </Button>
            </div>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  )
}
