'use server'

import Anthropic from '@anthropic-ai/sdk'
import { getTask, extractTaskFields, addCommentToTask } from '@/lib/clickup/client'
import { createDraftPost } from '@/lib/metricool/post'
import { createClient } from '@/lib/supabase/server'
import type { Client } from '@/lib/supabase/types'

const anthropic = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY })

export interface ProcessResult {
  success: boolean
  taskId: string
  taskTitle: string
  caption?: string
  metricoolPostId?: string | number
  error?: string
}

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
    const posts = json.data || []
    return posts
      .filter(p => p.text?.trim().length > 20 && !p.draft)
      .map(p => ({
        text: p.text,
        provider: p.providers?.[0]?.network || 'instagram'
      }))
      .slice(0, 12)
  } catch {
    return []
  }
}

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

  const prompt = `You are a professional social media copywriter for NMedia PR, a Puerto Rican marketing agency. You write captions that perform well on Instagram, TikTok, and Facebook.

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
- Do NOT include any explanation, title, or label — output ONLY the caption text itself
- Do NOT add "[Caption]" or "Here is your caption:" — just the raw caption`

  const message = await anthropic.messages.create({
    model: 'claude-sonnet-4-6',
    max_tokens: 1200,
    messages: [{ role: 'user', content: prompt }],
  })

  return message.content[0].type === 'text' ? message.content[0].text.trim() : ''
}

export async function processClickUpTask(taskId: string): Promise<ProcessResult> {
  try {
    // 1. Fetch task from ClickUp
    const task = await getTask(taskId)
    const { title, driveLink, clientName } = extractTaskFields(task)

    // 2. Look up client in Supabase
    let client: Client | null = null
    if (clientName) {
      const supabase = await createClient()
      const { data } = await supabase
        .from('clients')
        .select('*')
        .ilike('name', `%${clientName}%`)
        .limit(1)
        .single()
      client = data as Client | null
    }

    // 3. Fetch Metricool style examples
    const examples = await fetchMetricoolExamples(client?.metricool_blog_id)

    // 4. Generate caption
    const caption = await generateCaption(title, client, examples)
    if (!caption) throw new Error('Caption generation returned empty result')

    // 5. Post to Metricool as draft (include Drive link as first comment)
    let metricoolPostId: string | number | undefined
    try {
      const draft = await createDraftPost(
        caption,
        client?.metricool_blog_id ?? undefined,
        client?.platforms ?? undefined,
        driveLink ?? undefined
      )
      metricoolPostId = draft.data?.id ?? draft.data?.uuid
    } catch (err) {
      console.error('Metricool post failed:', err)
    }

    // 6. Add caption as comment on ClickUp task
    const commentText = [
      '✅ *Caption generado automáticamente por NMedia Dashboard*',
      '',
      caption,
      driveLink ? `\n🎬 *Video:* ${driveLink}` : '',
      metricoolPostId ? `\n📋 *Metricool Draft ID:* ${metricoolPostId}` : '',
    ].filter(s => s !== null).join('\n')

    await addCommentToTask(taskId, commentText)

    return { success: true, taskId, taskTitle: title, caption, metricoolPostId }
  } catch (error) {
    const msg = error instanceof Error ? error.message : 'Unknown error'
    console.error(`Failed to process task ${taskId}:`, msg)
    return { success: false, taskId, taskTitle: '', error: msg }
  }
}
