'use client'

import { useEffect, useRef } from 'react'
import { createClient } from '@/lib/supabase/client'
import { useToast } from '@/lib/hooks/use-toast'
import { usePathname } from 'next/navigation'

export function RequestNotifier() {
  const { toast } = useToast()
  const pathname = usePathname()
  const mountedAt = useRef(Date.now())

  useEffect(() => {
    const supabase = createClient()

    const channel = supabase
      .channel('request-notifier')
      .on('postgres_changes', {
        event: 'INSERT',
        schema: 'public',
        table: 'client_requests',
      }, (payload) => {
        // Ignore inserts that happened before this component mounted (page load hydration)
        const insertedAt = new Date(payload.new.created_at).getTime()
        if (insertedAt < mountedAt.current) return

        // Don't show toast if already on inbox page
        if (pathname.includes('/inbox')) return

        const { company_name, urgency } = payload.new as { company_name: string; urgency: string }
        const urgencyLabel = urgency === 'urgent' ? '🔴 URGENT' : urgency === 'high' ? '🟠 High' : ''

        toast({
          title: `New client request ${urgencyLabel}`.trim(),
          description: `${company_name} submitted a new request — check your Inbox`,
          duration: 8000,
        })
      })
      .subscribe()

    return () => { supabase.removeChannel(channel) }
  }, [toast, pathname])

  return null
}
