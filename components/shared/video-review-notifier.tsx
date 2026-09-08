'use client'

import { useAuth } from '@/lib/context/auth-context'
import { useEffect, useRef } from 'react'
import { createClient } from '@/lib/supabase/client'
import { useToast } from '@/lib/hooks/use-toast'
import { usePathname } from 'next/navigation'

export function VideoReviewNotifier() {
  const {role}=useAuth()
  const canNotify=role==='owner'||role==='supervisor'
  const { toast } = useToast()
  const pathname = usePathname()
  const mountedAt = useRef(Date.now())

  useEffect(() => {
    if (!canNotify) return
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
          title: 'Video Recibido En Video QC',
          description: `"${title}" — Revisa El Archivo En Video QC`,
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

        if (payload.old?.status === payload.new.status) return
        const { title, status } = payload.new as { title: string; status: string }
        if (status === 'approved') {
          toast({
            title: 'Video Aprobado En Video QC',
            description: `"${title}" fue aprobado en QC. Esto no confirma su publicación.`,
            duration: 5000,
          })
        } else if (status === 'revision_needed') {
          toast({
            title: 'Corrección Pendiente En Video QC',
            description: `"${title}" necesita correcciones. Abre Video QC para ver el motivo.`,
            duration: 7000,
          })
        }
      })
      .subscribe()

    return () => { supabase.removeChannel(channel) }
  }, [toast, pathname, canNotify])

  return null
}
