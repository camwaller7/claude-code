'use client'

import { useEffect, useState } from 'react'
import Link from 'next/link'
import { Button } from '@/components/ui/button'

const STEPS = [
  {
    emoji: '👋',
    title: 'Welcome to Corvelle',
    body: 'Your DMs, deals, clients and content — together, with an assistant that handles the busywork.',
  },
  {
    emoji: '✨',
    title: 'Meet your assistant',
    body: 'Tap the sparkle any time. Ask it to triage your inbox, draft a reply, or chase a follow-up. Name it and set its tone in Settings.',
  },
  {
    emoji: '🔗',
    title: 'Connect your accounts',
    body: 'Link Instagram and Facebook in Settings — that’s what brings your DMs in. A minute now, or whenever you’re ready.',
  },
  {
    emoji: '🚀',
    title: "You're all set",
    body: 'Have a look around. Nothing goes out without your say-so.',
  },
]

export function WelcomeFlow() {
  const [show, setShow] = useState(false)
  const [step, setStep] = useState(0)

  useEffect(() => {
    // localStorage is client-only, so this must run in an effect (not a lazy
    // initializer, which would run during SSR).
    // eslint-disable-next-line react-hooks/set-state-in-effect
    if (!localStorage.getItem('welcome_done')) setShow(true)
  }, [])

  function finish() {
    localStorage.setItem('welcome_done', '1')
    setShow(false)
  }

  if (!show) return null
  const s = STEPS[step]
  const last = step === STEPS.length - 1

  return (
    <div className="fixed inset-0 z-[60] flex items-center justify-center bg-black/50 p-4">
      <div className="w-full max-w-sm rounded-3xl bg-background p-6 text-center shadow-2xl flex flex-col items-center gap-4">
        <div className="flex h-16 w-16 items-center justify-center rounded-full brand-gradient text-3xl">
          {s.emoji}
        </div>
        <h2 className="text-xl font-bold">{s.title}</h2>
        <p className="text-sm text-muted-foreground">{s.body}</p>

        <div className="flex gap-1.5 py-1">
          {STEPS.map((_, i) => (
            <div key={i} className={`h-1.5 rounded-full transition-all ${i === step ? 'w-6 bg-violet-500' : 'w-1.5 bg-muted'}`} />
          ))}
        </div>

        <div className="flex w-full flex-col gap-2">
          {last ? (
            <>
              <Button onClick={finish} className="w-full brand-gradient text-white">
                Let&apos;s go 🎉
              </Button>
              <Link
                href="/settings"
                onClick={finish}
                className="text-xs text-muted-foreground underline underline-offset-2"
              >
                Customise my assistant first
              </Link>
            </>
          ) : (
            <>
              <Button onClick={() => setStep(s2 => s2 + 1)} className="w-full">
                Next
              </Button>
              <button onClick={finish} className="text-xs text-muted-foreground">
                Skip
              </button>
            </>
          )}
        </div>
      </div>
    </div>
  )
}
