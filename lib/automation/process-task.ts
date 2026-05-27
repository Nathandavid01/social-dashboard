'use server'

import Anthropic from '@anthropic-ai/sdk'
import { createDraftPost } from '@/lib/metricool/post'
import { createClient } from '@/lib/supabase/server'
import type { Client, VideoReview } from '@/lib/supabase/types'

const anthropic = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY })

export interface ProcessResult {
  success: boolean
  videoReviewId: string
  videoTitle: string
  caption?: string
  metricoolPostId?: string | number
  error?: string
}

// ── Fetch Metricool style examples ───────────────────────────────────────────

async function fetchMetricoolExamples(metricoolBlogId?: string | null): Promise<{ text: string; provider: string }[]> {
  try {
    const token = process.env.METRICOOL_TOKEN
    const userId = process.env.METRICOOL_USER_ID
    const blogId = metricoolBlogId || process.env.METRICOOL_BLOG_ID
    if (!token || !userId || !blogId) return []

    const url = `https://app.metricool.com/api/v2/scheduler/posts?userId=${userId}&blogId=${blogId}&start=2025-11-01T00:00:00&end=2026-12-31T23:59:59`
    const res = await fetch(url, { headers: { 'X-Mc-Auth': token } })
    if (!res.ok) return []

    const json = await res.json() as { data?: { text: string; providers?: { network: string }[]; draft?: boolean }[] }
    return (json.data || [])
      .filter(p => p.text?.trim().length > 20 && !p.draft)
      .map(p => ({ text: p.text, provider: p.providers?.[0]?.network || 'instagram' }))
      .slice(0, 12)
  } catch {
    return []
  }
}

// ── Generate caption with Claude ─────────────────────────────────────────────

async function generateCaption(
  title: string,
  client: Client | null,
  examples: { text: string; provider: string }[]
): Promise<string> {
  const examplesBlock = examples.length > 0
    ? `REFERENCE CAPTIONS (published for this client — match this exact style, tone, and format):\n\n${examples
        .map((c, i) => `--- Example ${i + 1} (${c.provider}) ---\n${c.text}`)
        .join('\n\n')}`
    : 'No previous captions available. Write in a natural, engaging Puerto Rican social media style.'

  const profileLines = client ? [
    client.brand_voice && `Brand voice: ${client.brand_voice}`,
    client.caption_language && `Language: ${client.caption_language} (IMPORTANT: write the caption in this language)`,
    client.default_cta && `Call to action to include: ${client.default_cta}`,
    client.default_hashtags && `Hashtags to use: ${client.default_hashtags}`,
    client.caption_notes && `Rules to follow: ${client.caption_notes}`,
  ].filter(Boolean).join('\n') : ''

  const prompt = `You are a professional social media copywriter for NMedia PR, a Puerto Rican marketing agency.

CLIENT: ${client?.name || 'Unknown client'}
INDUSTRY: ${client?.industry || 'Business'}
${profileLines ? `\nCLIENT PROFILE:\n${profileLines}` : ''}

${examplesBlock}

VIDEO TOPIC: "${title}"

TASK: Write ONE complete social media caption for this video.

RULES:
- Match the EXACT tone, length, emoji style, and hashtag format from the reference captions above
- Follow the client profile rules precisely
- Include: hook that grabs attention, body that adds value, clear call to action, hashtags
- Do NOT include any explanation, title, or label — output ONLY the caption text itself`

  const message = await anthropic.messages.create({
    model: 'claude-sonnet-4-6',
    max_tokens: 1200,
    messages: [{ role: 'user', content: prompt }],
  })

  return message.content[0].type === 'text' ? message.content[0].text.trim() : ''
}

// ── Process a video review → generate caption → save + Metricool draft ───────

export async function processVideoReview(videoReviewId: string): Promise<ProcessResult> {
  try {
    const supabase = await createClient()

    // 1. Fetch the video review with client
    const { data: review, error: reviewErr } = await supabase
      .from('video_reviews')
      .select('*, client:clients!video_reviews_client_id_fkey(*)')
      .eq('id', videoReviewId)
      .single()

    if (reviewErr || !review) throw new Error('Video review not found')

    const videoReview = review as unknown as VideoReview & { client: Client | null }
    const client = videoReview.client ?? null

    // 2. Fetch Metricool style examples
    const examples = await fetchMetricoolExamples(client?.metricool_blog_id)

    // 3. Generate caption
    const caption = await generateCaption(videoReview.title, client, examples)
    if (!caption) throw new Error('Caption generation returned empty result')

    // 4. Save caption to saved_captions table
    const { data: { user } } = await supabase.auth.getUser()
    await supabase.from('saved_captions').insert({
      client_id: videoReview.client_id,
      video_review_id: videoReviewId,
      video_title: videoReview.title,
      caption,
      examples_used: examples.length,
      model: 'claude-sonnet-4-6',
      generated_by: user?.id ?? null,
    })

    // 5. Post to Metricool as draft
    let metricoolPostId: string | number | undefined
    try {
      const draft = await createDraftPost(
        caption,
        client?.metricool_blog_id ?? undefined,
        client?.platforms ?? undefined,
        videoReview.drive_link ?? undefined
      )
      metricoolPostId = draft.data?.id ?? draft.data?.uuid
    } catch (err) {
      console.error('Metricool post failed:', err)
    }

    return {
      success: true,
      videoReviewId,
      videoTitle: videoReview.title,
      caption,
      metricoolPostId,
    }
  } catch (error) {
    const msg = error instanceof Error ? error.message : 'Unknown error'
    console.error(`Failed to process video review ${videoReviewId}:`, msg)
    return { success: false, videoReviewId, videoTitle: '', error: msg }
  }
}

// ── Fetch approved video reviews ready for caption generation ─────────────────

export async function getApprovedVideoReviews() {
  const supabase = await createClient()
  const { data, error } = await supabase
    .from('video_reviews')
    .select('*, client:clients!video_reviews_client_id_fkey(id, name)')
    .eq('status', 'approved')
    .order('updated_at', { ascending: false })
    .limit(50)

  if (error) return []
  return data ?? []
}
