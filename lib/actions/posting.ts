'use server'

import { revalidatePath } from 'next/cache'
import { createClient } from '@/lib/supabase/server'
import { createDraftPost } from '@/lib/metricool/post'
import type { VideoReview, PostingDraft, Client } from '@/lib/supabase/types'

export interface PostingQueueItem {
  review: VideoReview
  client: Pick<Client, 'id' | 'name' | 'metricool_blog_id' | 'default_platforms' | 'brand_voice' | 'caption_language' | 'default_cta' | 'default_hashtags' | 'caption_notes' | 'industry'> | null
  draft: PostingDraft | null
}

export async function getPostingQueue(): Promise<PostingQueueItem[]> {
  const supabase = await createClient()

  const { data: reviews, error } = await supabase
    .from('video_reviews')
    .select(`
      *,
      client:clients!video_reviews_client_id_fkey(id, name, metricool_blog_id, default_platforms, brand_voice, caption_language, default_cta, default_hashtags, caption_notes, industry),
      editor:profiles!video_reviews_editor_id_fkey(id, full_name),
      reviewer:profiles!video_reviews_reviewer_id_fkey(id, full_name)
    `)
    .eq('status', 'approved')
    .order('updated_at', { ascending: false })

  if (error) {
    console.warn('[posting] video_reviews query failed:', error.message)
    return []
  }
  const approved = (reviews ?? []) as unknown as (VideoReview & { client: PostingQueueItem['client'] })[]

  if (approved.length === 0) return []

  const reviewIds = approved.map((r) => r.id)
  const { data: drafts, error: draftsError } = await supabase
    .from('posting_drafts')
    .select('*')
    .in('video_review_id', reviewIds)
    .order('created_at', { ascending: false })

  if (draftsError) {
    console.warn('[posting] posting_drafts query failed (table may not exist yet):', draftsError.message)
  }

  const draftByReview = new Map<string, PostingDraft>()
  for (const d of (drafts ?? []) as PostingDraft[]) {
    if (!draftByReview.has(d.video_review_id)) draftByReview.set(d.video_review_id, d)
  }

  return approved.map((r) => ({
    review: r,
    client: r.client ?? null,
    draft: draftByReview.get(r.id) ?? null,
  }))
}

export async function sendDraftToMetricool(input: {
  videoReviewId: string
  clientId: string | null
  scheduledFor: string  // ISO datetime
  caption: string
  platforms: string[]
}) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return { error: 'Not authenticated' }

  if (!input.caption?.trim()) return { error: 'Caption is required' }
  if (!input.scheduledFor) return { error: 'Scheduled date is required' }
  if (!input.platforms.length) return { error: 'At least one platform is required' }

  let blogId: string | null = null
  let driveLink: string | null = null

  if (input.clientId) {
    const { data: client } = await supabase
      .from('clients')
      .select('metricool_blog_id')
      .eq('id', input.clientId)
      .single()
    blogId = client?.metricool_blog_id ?? null
  }

  const { data: review } = await supabase
    .from('video_reviews')
    .select('drive_link')
    .eq('id', input.videoReviewId)
    .single()
  driveLink = review?.drive_link ?? null

  try {
    const response = await createDraftPost(
      input.caption,
      blogId ?? undefined,
      input.platforms,
      driveLink ?? undefined,
      input.scheduledFor,
    )

    const metricoolPostId = (response.data?.id as number | undefined) ?? null
    const metricoolUuid = (response.data?.uuid as string | undefined) ?? null

    const { error: insertError } = await supabase.from('posting_drafts').insert({
      video_review_id: input.videoReviewId,
      client_id: input.clientId,
      scheduled_for: input.scheduledFor,
      caption: input.caption.trim(),
      platforms: input.platforms,
      metricool_post_id: metricoolPostId,
      metricool_uuid: metricoolUuid,
      status: 'sent',
      created_by: user.id,
    })
    if (insertError) return { error: `Saved to Metricool but failed to log: ${insertError.message}` }

    revalidatePath('/posting')
    return { success: true, metricoolPostId, metricoolUuid }
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Unknown error'
    await supabase.from('posting_drafts').insert({
      video_review_id: input.videoReviewId,
      client_id: input.clientId,
      scheduled_for: input.scheduledFor,
      caption: input.caption.trim(),
      platforms: input.platforms,
      status: 'failed',
      error_message: message,
      created_by: user.id,
    })
    return { error: message }
  }
}

export async function deletePostingDraft(draftId: string) {
  const supabase = await createClient()
  const { error } = await supabase.from('posting_drafts').delete().eq('id', draftId)
  if (error) return { error: error.message }
  revalidatePath('/posting')
  return { success: true }
}
