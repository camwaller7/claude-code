'use client'

import { supabase } from '@/lib/supabase/client'
import { useEffect } from 'react'
import { useRouter } from 'next/navigation'

export function RealtimeInbox() {
  const router = useRouter()

  useEffect(() => {
    const channel = supabase
      .channel('inbox')
      .on(
        'postgres_changes',
        { event: 'INSERT', schema: 'public', table: 'messages' },
        () => router.refresh()
      )
      .subscribe()

    return () => {
      supabase.removeChannel(channel)
    }
  }, [router])

  return null
}
