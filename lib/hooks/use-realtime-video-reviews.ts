'use client'

import { useEffect, useState, useCallback } from 'react'
import { createClient } from '@/lib/supabase/client'
import type { VideoReview } from '@/lib/supabase/types'

export function useRealtimeVideoReviews(initialReviews: VideoReview[]) {
  const [reviews, setReviews] = useState<VideoReview[]>(initialReviews)

  const fetchReview = useCallback(async (id: string) => {
    const supabase = createClient()
    const { data } = await supabase
      .from('video_reviews')
      .select(`
        *,
        client:clients!video_reviews_client_id_fkey(id, name),
        editor:profiles!video_reviews_editor_id_fkey(id, full_name),
        reviewer:profiles!video_reviews_reviewer_id_fkey(id, full_name)
      `)
      .eq('id', id)
      .single()
    return data
  }, [])

  useEffect(() => {
    setReviews(initialReviews)
  }, [initialReviews])

  useEffect(() => {
    const supabase = createClient()

    const channel = supabase
      .channel('video-reviews-realtime')
      .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'video_reviews' }, async (payload) => {
        const newReview = await fetchReview(payload.new.id)
        if (newReview) setReviews((prev) => [newReview as VideoReview, ...prev])
      })
      .on('postgres_changes', { event: 'UPDATE', schema: 'public', table: 'video_reviews' }, async (payload) => {
        const updated = await fetchReview(payload.new.id)
        if (updated) {
          setReviews((prev) => prev.map((r) => r.id === updated.id ? updated as VideoReview : r))
        }
      })
      .on('postgres_changes', { event: 'DELETE', schema: 'public', table: 'video_reviews' }, (payload) => {
        setReviews((prev) => prev.filter((r) => r.id !== payload.old.id))
      })
      .subscribe()

    return () => { supabase.removeChannel(channel) }
  }, [fetchReview])

  return reviews
}
