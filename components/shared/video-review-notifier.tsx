'use client'

import { useEffect, useRef } from 'react'
import { createClient } from '@/lib/supabase/client'
import { useToast } from '@/lib/hooks/use-toast'
import { usePathname } from 'next/navigation'

export function VideoReviewNotifier() {
  const { toast } = useToast()
  const pathname = usePathname()
  const mountedAt = useRef(Date.now())

  useEffect(() => {
    const supabase = createClient()

    const channel = supabase
      .channel('video-review-notifier')
      .on('postgres_changes', {
        event: 'INSERT',
        schema: 'public',
        table: 'video_reviews',
      }, (payload) => {
        const insertedAt = new Date(payload.new.created_at).getTime()
        if (insertedAt < mountedAt.current) return
        if (pathname.includes('/video-reviews')) return

        const { title } = payload.new as { title: string }
        toast({
          title: 'New video submitted for review',
          description: `"${title}" — check Video QC`,
          duration: 7000,
        })
      })
      .on('postgres_changes', {
        event: 'UPDATE',
        schema: 'public',
        table: 'video_reviews',
      }, (payload) => {
        const updatedAt = new Date(payload.new.updated_at).getTime()
        if (updatedAt < mountedAt.current) return
        if (pathname.includes('/video-reviews')) return

        const { title, status } = payload.new as { title: string; status: string }
        if (status === 'approved') {
          toast({
            title: '✅ Video approved',
            description: `"${title}" was approved`,
            duration: 5000,
          })
        } else if (status === 'revision_needed') {
          toast({
            title: '🔴 Revision needed',
            description: `"${title}" needs revision`,
            duration: 7000,
          })
        }
      })
      .subscribe()

    return () => { supabase.removeChannel(channel) }
  }, [toast, pathname])

  return null
}
