'use client'

import { useState, useRef, useEffect } from 'react'
import { X, Send, Loader2 } from 'lucide-react'
import { cn } from '@/lib/utils'

interface Message {
  role: 'user' | 'assistant'
  content: string
}

const SUGGESTIONS = [
  "What brand deals need follow-up? \ud83d\udcbc",
  "What's my pipeline worth this month? \ud83d\udcb0",
  "Draft a reply to my latest brand inquiry \u270d\ufe0f",
  "Which clients are most active? \ud83d\udc65",
]

interface Persona {
  assistant_name: string
  assistant_emoji: string
}

interface ModelOption {
  id: string
  label: string
  disabled: boolean
  reason?: string
}

export function AIChat() {
  const [open, setOpen] = useState(false)
  const [messages, setMessages] = useState<Message[]>([])
  const [input, setInput] = useState('')
  const [loading, setLoading] = useState(false)
  const [persona, setPersona] = useState<Persona>({ assistant_name: 'Elle', assistant_emoji: '\u2728' })
  const [models, setModels] = useState<ModelOption[]>([])
  const [showSwitcher, setShowSwitcher] = useState(false)
  const [selectedModel, setSelectedModel] = useState<string | undefined>(undefined)
  const bottomRef = useRef<HTMLDivElement>(null)
  const inputRef = useRef<HTMLInputElement>(null)

  useEffect(() => {
    fetch('/api/settings')
      .then(r => r.json())
      .then(data => {
        if (data?.assistant_name) setPersona({ assistant_name: data.assistant_name, assistant_emoji: data.assistant_emoji ?? '\u2728' })
      })
      .catch(() => {})
    // Tier-aware model switcher options (multi-user only).
    fetch('/api/billing/models')
      .then(r => r.json())
      .then((data: { switcher?: boolean; defaultModel?: string; models?: ModelOption[] }) => {
        if (data?.switcher && data.models?.length) {
          setShowSwitcher(true)
          setModels(data.models)
          setSelectedModel(data.defaultModel ?? data.models[0]?.id)
        }
      })
      .catch(() => {})
  }, [])

  useEffect(() => {
    if (open && messages.length === 0) {
      setMessages([{
        role: 'assistant',
        content: `Hey! ${persona.assistant_emoji} I'm ${persona.assistant_name}, your personal assistant. I can check your deals, draft replies, update your pipeline, find brand opportunities — just ask me anything about your creator business!`,
      }])
    }
    if (open) setTimeout(() => inputRef.current?.focus(), 100)
  }, [open, persona])

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [messages, loading])

  async function send(text?: string) {
    const content = text ?? input.trim()
    if (!content || loading) return
    setInput('')

    const userMsg: Message = { role: 'user', content }
    const newMessages = [...messages, userMsg]
    setMessages(newMessages)
    setLoading(true)

    try {
      const res = await fetch('/api/chat', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          messages: newMessages
            .filter(m => m.content.trim().length > 0)
            .map(m => ({ role: m.role, content: m.content })),
          ...(selectedModel ? { model: selectedModel } : {}),
        }),
      })
      if (!res.ok || !res.body) throw new Error('chat failed')

      // Stream the reply in as it's generated
      setMessages(prev => [...prev, { role: 'assistant', content: '' }])
      const reader = res.body.getReader()
      const decoder = new TextDecoder()
      let acc = ''
      for (;;) {
        const { done, value } = await reader.read()
        if (done) break
        acc += decoder.decode(value, { stream: true })
        const text = acc
        setMessages(prev => {
          const next = [...prev]
          next[next.length - 1] = { role: 'assistant', content: text }
          return next
        })
      }
      if (!acc.trim()) {
        setMessages(prev => {
          const next = [...prev]
          next[next.length - 1] = { role: 'assistant', content: 'Done! Anything else?' }
          return next
        })
      }
    } catch {
      setMessages(prev => {
        // Drop a dangling empty assistant bubble before showing the error
        const next = prev[prev.length - 1]?.role === 'assistant' && !prev[prev.length - 1].content.trim()
          ? prev.slice(0, -1)
          : [...prev]
        return [...next, { role: 'assistant', content: 'Sorry, something went wrong. Try again!' }]
      })
    } finally {
      setLoading(false)
    }
  }

  return (
    <>
      {/* Floating button */}
      <button
        onClick={() => setOpen(o => !o)}
        className={cn(
          'fixed bottom-6 right-6 z-50 flex h-14 w-14 items-center justify-center rounded-full shadow-lg transition-all duration-200 overflow-hidden',
          'brand-gradient text-white hover:scale-105 active:scale-95'
        )}
        aria-label="Open AI assistant"
      >
        {open ? <X className="h-5 w-5" /> : (
          <span className="text-2xl leading-none" role="img" aria-label={persona.assistant_name}>
            {persona.assistant_emoji}
          </span>
        )}
      </button>

      {/* Chat panel */}
      {open && (
        <div className="fixed bottom-24 right-6 z-50 flex w-[360px] max-w-[calc(100vw-2rem)] flex-col rounded-2xl border bg-background shadow-2xl" style={{ height: 520 }}>
          {/* Header */}
          <div className="flex items-center gap-3 rounded-t-2xl brand-gradient px-4 py-3">
            <div className="flex h-8 w-8 items-center justify-center rounded-full bg-white/20">
              <span className="text-lg leading-none" role="img" aria-label={persona.assistant_name}>
                {persona.assistant_emoji}
              </span>
            </div>
            <div>
              <p className="text-sm font-semibold text-white">{persona.assistant_name}</p>
              <p className="text-xs text-white/70">Your creator co-pilot</p>
            </div>
          </div>

          {/* Messages */}
          <div className="flex-1 overflow-y-auto p-4 flex flex-col gap-3">
            {messages.map((m, i) => (
              <div key={i} className={cn('flex', m.role === 'user' ? 'justify-end' : 'justify-start')}>
                <div className={cn(
                  'max-w-[85%] rounded-2xl px-3 py-2 text-sm whitespace-pre-wrap break-words',
                  m.role === 'user'
                    ? 'brand-gradient text-white rounded-br-sm'
                    : 'bg-muted text-foreground rounded-bl-sm'
                )}>
                  {m.content}
                </div>
              </div>
            ))}

            {loading && (
              <div className="flex justify-start">
                <div className="bg-muted rounded-2xl rounded-bl-sm px-3 py-2">
                  <Loader2 className="h-4 w-4 animate-spin text-muted-foreground" />
                </div>
              </div>
            )}

            {/* Suggestion chips — show after first assistant message with no user messages yet */}
            {messages.length === 1 && (
              <div className="flex flex-col gap-2 mt-1">
                {SUGGESTIONS.map(s => (
                  <button
                    key={s}
                    onClick={() => send(s)}
                    className="text-left rounded-xl border px-3 py-2 text-xs text-muted-foreground hover:bg-accent hover:text-accent-foreground transition-colors"
                  >
                    {s}
                  </button>
                ))}
              </div>
            )}

            <div ref={bottomRef} />
          </div>

          {/* Input */}
          <div className="border-t p-3">
            {showSwitcher && models.length > 1 && (
              <div className="mb-2 flex items-center gap-2">
                <span className="text-[11px] text-muted-foreground">Model</span>
                <div className="flex gap-1">
                  {models.map(m => (
                    <button
                      key={m.id}
                      type="button"
                      title={m.reason ?? m.label}
                      disabled={m.disabled}
                      onClick={() => setSelectedModel(m.id)}
                      className={cn(
                        'rounded-full border px-2.5 py-0.5 text-[11px] transition-colors',
                        m.disabled && 'cursor-not-allowed opacity-40',
                        selectedModel === m.id
                          ? 'border-primary bg-primary text-primary-foreground'
                          : 'border-input bg-background text-foreground hover:bg-accent'
                      )}
                    >
                      {m.label}
                    </button>
                  ))}
                </div>
              </div>
            )}
            <form
              onSubmit={e => { e.preventDefault(); send() }}
              className="flex items-center gap-2 rounded-xl border bg-muted/40 px-3 py-2"
            >
              <input
                ref={inputRef}
                value={input}
                onChange={e => setInput(e.target.value)}
                placeholder="Ask me anything..."
                className="flex-1 bg-transparent text-sm outline-none placeholder:text-muted-foreground"
                disabled={loading}
              />
              <button
                type="submit"
                disabled={!input.trim() || loading}
                className="flex h-7 w-7 items-center justify-center rounded-lg brand-gradient text-white disabled:opacity-40 transition-opacity"
              >
                <Send className="h-3.5 w-3.5" />
              </button>
            </form>
          </div>
        </div>
      )}
    </>
  )
}
