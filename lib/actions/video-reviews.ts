'use server'

import { revalidatePath } from 'next/cache'
import { createClient } from '@/lib/supabase/server'

export async function getVideoReviews() {
  const supabase = await createClient()

  // Try the full query with all joins first (requires migration 0010 columns)
  const { data, error } = await supabase
    .from('video_reviews')
    .select(`
      *,
      client:clients!video_reviews_client_id_fkey(id, name, metricool_blog_id, default_platforms, brand_voice, caption_language, default_cta, default_hashtags, caption_notes, industry),
      editor:profiles!video_reviews_editor_id_fkey(id, full_name),
      reviewer:profiles!video_reviews_reviewer_id_fkey(id, full_name),
      head_editor:profiles!video_reviews_head_editor_id_fkey(id, full_name),
      final_reviewer:profiles!video_reviews_final_reviewer_id_fkey(id, full_name)
    `)
    .order('created_at', { ascending: false })

  if (!error) return data ?? []

  // Fallback: query without the two-stage columns (pre-migration 0010 schema)
  console.warn('[getVideoReviews] full join failed, falling back to basic query:', error.message)
  const { data: basic, error: basicError } = await supabase
    .from('video_reviews')
    .select(`
      *,
      client:clients!video_reviews_client_id_fkey(id, name, metricool_blog_id, default_platforms, brand_voice, caption_language, default_cta, default_hashtags, caption_notes, industry),
      editor:profiles!video_reviews_editor_id_fkey(id, full_name),
      reviewer:profiles!video_reviews_reviewer_id_fkey(id, full_name)
    `)
    .order('created_at', { ascending: false })

  if (basicError) throw new Error(basicError.message)
  return basic ?? []
}

export async function submitVideoReview(values: {
  title: string
  drive_link: string
  client_id?: string | null
  general_notes?: string | null
}) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return { error: 'Not authenticated' }

  if (!values.title?.trim()) return { error: 'Title is required' }
  if (!values.drive_link?.trim()) return { error: 'Drive link is required' }

  const { error } = await supabase.from('video_reviews').insert({
    title: values.title.trim(),
    drive_link: values.drive_link.trim(),
    client_id: values.client_id ?? null,
    general_notes: values.general_notes?.trim() || null,
    editor_id: user.id,
    created_by: user.id,
    status: 'submitted',
    errors: [],
    revision_count: 0,
  })

  if (error) return { error: error.message }
  revalidatePath('/video-reviews')
  return { success: true }
}

export async function updateVideoReview(
  id: string,
  values: {
    status?: string
    errors?: string[]
    error_notes?: string | null
    general_notes?: string | null
    reviewer_id?: string | null
  }
) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return { error: 'Not authenticated' }

  const updates: Record<string, unknown> = { ...values }

  // When marking revision_needed, bump the revision counter
  if (values.status === 'revision_needed') {
    const { data: current } = await supabase
      .from('video_reviews')
      .select('revision_count')
      .eq('id', id)
      .single()
    updates.revision_count = (current?.revision_count ?? 0) + 1
  }

  // Track who reviewed
  if (values.status === 'approved' || values.status === 'revision_needed') {
    updates.reviewer_id = user.id
  }

  const { error } = await supabase
    .from('video_reviews')
    .update(updates)
    .eq('id', id)

  if (error) return { error: error.message }
  revalidatePath('/video-reviews')
  return { success: true }
}

export async function deleteVideoReview(id: string) {
  const supabase = await createClient()
  const { error } = await supabase.from('video_reviews').delete().eq('id', id)
  if (error) return { error: error.message }
  revalidatePath('/video-reviews')
  return { success: true }
}
