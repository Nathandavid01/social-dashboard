'use client'

import { useAuth } from '@/lib/context/auth-context'
import { useEffect, useRef } from 'react'
import { createClient } from '@/lib/supabase/client'
import { useToast } from '@/lib/hooks/use-toast'
import { usePathname } from 'next/navigation'

export function RequestNotifier() {
  const {role}=useAuth()
  const canNotify=role==='owner'||role==='supervisor'
  const { toast } = useToast()
  const pathname = usePathname()
  const mountedAt = useRef(Date.now())

  useEffect(() => {
    if (!canNotify) return
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
        const urgencyLabel = urgency === 'urgent' ? '· Urgente' : urgency === 'high' ? '· Prioridad Alta' : ''

        toast({
          title: `Nueva Solicitud De Cliente ${urgencyLabel}`.trim(),
          description: `${company_name} envió una solicitud. Revisa el Inbox.`,
          duration: 8000,
        })
      })
      .subscribe()

    return () => { supabase.removeChannel(channel) }
  }, [toast, pathname, canNotify])

  return null
}
