'use client'

import { useEffect, useState } from 'react'
import Link from 'next/link'
import { Button } from '@/components/ui/button'

const STEPS = [
  {
    emoji: '👋',
    title: 'Welcome to your Creator PA!',
    body: 'One place for your DMs, brand deals, clients and content — with an AI assistant that does the busy work for you.',
  },
  {
    emoji: '✨',
    title: 'Meet your assistant',
    body: 'Tap the sparkle button in the corner any time. Ask it to check your deals, draft replies or find follow-ups. You can name it and give it a personality in Settings.',
  },
  {
    emoji: '🚀',
    title: "You're all set",
    body: 'Your inbox, deal pipeline and post scheduler are ready. Have a look around — nothing sends without your say-so.',
  },
]

export function WelcomeFlow() {
  const [show, setShow] = useState(false)
  const [step, setStep] = useState(0)

  useEffect(() => {
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
        <div className="flex h-16 w-16 items-center justify-center rounded-full bg-gradient-to-br from-violet-500 to-purple-600 text-3xl">
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
              <Button onClick={finish} className="w-full bg-gradient-to-r from-violet-500 to-purple-600 text-white">
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
