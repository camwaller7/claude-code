'use client'

import { useState } from 'react'
import { MODELS, getModelsByProvider } from '@/lib/llm/models'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Label } from '@/components/ui/label'
import { Button } from '@/components/ui/button'
import type { LLMProvider } from '@/types'

const PROVIDERS: { value: LLMProvider; label: string }[] = [
  { value: 'anthropic', label: 'Anthropic' },
  { value: 'openai', label: 'OpenAI' },
  { value: 'google', label: 'Google' },
  { value: 'groq', label: 'Groq (Free)' },
]

export function LLMSettings({ initialProvider, initialModel }: { initialProvider: string; initialModel: string }) {
  const [provider, setProvider] = useState<LLMProvider>(initialProvider as LLMProvider)
  const [model, setModel] = useState(initialModel)
  const [saving, setSaving] = useState(false)
  const [saved, setSaved] = useState(false)

  const models = getModelsByProvider(provider)

  function handleProviderChange(p: LLMProvider) {
    setProvider(p)
    setModel(getModelsByProvider(p)[0]?.id ?? '')
    setSaved(false)
  }

  async function handleSave() {
    setSaving(true)
    await fetch('/api/settings', {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ llm_provider: provider, llm_model: model }),
    })
    setSaving(false)
    setSaved(true)
  }

  const selectedModel = MODELS.find(m => m.id === model)

  return (
    <Card>
      <CardHeader>
        <CardTitle>AI Model</CardTitle>
      </CardHeader>
      <CardContent className="flex flex-col gap-4">
        <div className="flex flex-col gap-1.5">
          <Label>Provider</Label>
          <div className="flex flex-wrap gap-2">
            {PROVIDERS.map(p => (
              <button
                key={p.value}
                type="button"
                onClick={() => handleProviderChange(p.value)}
                className={`rounded-md border px-3 py-1.5 text-sm transition-colors ${
                  provider === p.value
                    ? 'border-primary bg-primary text-primary-foreground'
                    : 'border-input bg-background hover:bg-accent'
                }`}
              >
                {p.label}
              </button>
            ))}
          </div>
        </div>

        <div className="flex flex-col gap-1.5">
          <Label>Model</Label>
          <div className="flex flex-col gap-2">
            {models.map(m => (
              <button
                key={m.id}
                type="button"
                onClick={() => { setModel(m.id); setSaved(false) }}
                className={`flex items-center justify-between rounded-md border px-3 py-2 text-sm text-left transition-colors ${
                  model === m.id
                    ? 'border-primary bg-primary/5'
                    : 'border-input bg-background hover:bg-accent'
                }`}
              >
                <span className="font-medium">{m.label}</span>
                <span className="text-xs text-muted-foreground">
                  ${m.inputPricePer1k}/1k in · ${m.outputPricePer1k}/1k out
                </span>
              </button>
            ))}
          </div>
        </div>

        {selectedModel && (
          <p className="text-xs text-muted-foreground">
            Context window: {selectedModel.contextWindow.toLocaleString()} tokens
          </p>
        )}

        <Button onClick={handleSave} disabled={saving} className="self-start">
          {saving ? 'Saving…' : saved ? 'Saved ✓' : 'Save Changes'}
        </Button>
      </CardContent>
    </Card>
  )
}
