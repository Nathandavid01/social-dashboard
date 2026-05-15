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

    const end = new Date()
    const start = new Date()
    start.setDate(start.getDate() - 90)
    const fmt = (d: Date) => `${d.getFullYear()}${String(d.getMonth() + 1).padStart(2, '0')}${String(d.getDate()).padStart(2, '0')}`

    const url = `https://app.metricool.com/api/stats/posts?userId=${userId}&blogId=${blogId}&start=${fmt(start)}&end=${fmt(end)}`
    const res = await fetch(url, { headers: { 'X-Mc-Auth': token } })
    if (!res.ok) return []

    const posts = await res.json() as { text: string; provider: string }[]
    return posts.filter((p) => p.text?.trim().length > 20).slice(0, 8)
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
    ? `Here are real captions previously written for this client:\n\n${examples
        .map((c, i) => `Example ${i + 1} (${c.provider}):\n${c.text}`)
        .join('\n\n---\n\n')}`
    : 'No previous captions available. Write in a professional, engaging social media tone in Spanish.'

  const clientProfile = client ? [
    client.brand_voice && `Brand voice: ${client.brand_voice}`,
    client.caption_language && `Language: ${client.caption_language}`,
    client.default_cta && `Default CTA: ${client.default_cta}`,
    client.default_hashtags && `Default hashtags: ${client.default_hashtags}`,
    client.caption_notes && `Special rules: ${client.caption_notes}`,
  ].filter(Boolean).join('\n') : ''

  const prompt = `You are a social media copywriter for a Puerto Rican agency.
${clientProfile ? `\nCLIENT PROFILE:\n${clientProfile}\n` : ''}
${examplesBlock}

---

Write a caption for:
- Client: ${client?.name || 'the client'}
- Video topic: ${title}

Requirements:
- Follow the client profile rules exactly
- Match tone and structure from examples
- Include hook, body, CTA, and hashtags
- Output ONLY the caption text, no explanation`

  const message = await anthropic.messages.create({
    model: 'claude-sonnet-4-6',
    max_tokens: 1024,
    messages: [{ role: 'user', content: prompt }],
  })

  return message.content[0].type === 'text' ? message.content[0].text : ''
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

    // 5. Post to Metricool as draft
    let metricoolPostId: string | number | undefined
    try {
      const draft = await createDraftPost(caption, client?.metricool_blog_id ?? undefined, client?.platforms ?? undefined)
      metricoolPostId = draft.data?.id ?? draft.data?.uuid
    } catch (err) {
      console.error('Metricool post failed:', err)
    }

    // 6. Add caption as comment on ClickUp task
    const commentText = `✅ Caption generado automáticamente:\n\n${caption}${driveLink ? `\n\n🎬 Drive: ${driveLink}` : ''}`
    await addCommentToTask(taskId, commentText)

    return { success: true, taskId, taskTitle: title, caption, metricoolPostId }
  } catch (error) {
    const msg = error instanceof Error ? error.message : 'Unknown error'
    console.error(`Failed to process task ${taskId}:`, msg)
    return { success: false, taskId, taskTitle: '', error: msg }
  }
}
