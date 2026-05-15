import Anthropic from '@anthropic-ai/sdk'
import { NextRequest, NextResponse } from 'next/server'

const anthropic = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY })

async function fetchClientStyleExamples(blogId?: string): Promise<{ text: string; provider: string }[]> {
  try {
    const token = process.env.METRICOOL_TOKEN
    const userId = process.env.METRICOOL_USER_ID
    const effectiveBlogId = blogId || process.env.METRICOOL_BLOG_ID
    if (!token || !userId || !effectiveBlogId) return []

    const url = `https://app.metricool.com/api/v2/scheduler/posts?userId=${userId}&blogId=${effectiveBlogId}&start=2025-01-01T00:00:00&end=2026-12-31T23:59:59`
    const res = await fetch(url, { headers: { 'X-Mc-Auth': token } })
    if (!res.ok) return []

    const json = await res.json() as { data?: { text: string; providers?: { network: string }[]; draft?: boolean }[] }
    const posts = json.data || []
    return posts
      .filter((p) => p.text?.trim().length > 20 && !p.draft)
      .map((p) => ({ text: p.text, provider: p.providers?.[0]?.network || 'instagram' }))
      .slice(0, 12)
  } catch {
    return []
  }
}

export async function POST(req: NextRequest) {
  try {
    const {
      videoTitle,
      platform,
      clientName,
      metricoolBlogId,
      brandVoice,
      captionLanguage,
      defaultCta,
      defaultHashtags,
      captionNotes,
      industry,
    } = await req.json()

    if (!videoTitle) {
      return NextResponse.json({ error: 'Video title is required' }, { status: 400 })
    }

    const examples = await fetchClientStyleExamples(metricoolBlogId)

    const examplesBlock = examples.length > 0
      ? `REFERENCE CAPTIONS (published for this client — match this exact style, tone, and format):\n\n${examples
          .map((c, i) => `--- Example ${i + 1} (${c.provider}) ---\n${c.text}`)
          .join('\n\n')}`
      : 'No previous captions available. Write in a natural, engaging Puerto Rican social media style.'

    const clientProfile = [
      brandVoice && `Brand voice: ${brandVoice}`,
      captionLanguage && `Language: ${captionLanguage} (IMPORTANT: write the caption in this language)`,
      defaultCta && `Call to action to include: ${defaultCta}`,
      defaultHashtags && `Hashtags to use: ${defaultHashtags}`,
      captionNotes && `Rules to follow: ${captionNotes}`,
    ]
      .filter(Boolean)
      .join('\n')

    const prompt = `You are a professional social media copywriter for NMedia PR, a Puerto Rican marketing agency. You write captions that perform well on Instagram, TikTok, and Facebook.

CLIENT: ${clientName || 'Unknown client'}
INDUSTRY: ${industry || 'Business'}
${clientProfile ? `\nCLIENT PROFILE:\n${clientProfile}` : ''}

${examplesBlock}

VIDEO TOPIC: "${videoTitle}"
PLATFORM: ${platform || 'Instagram'}

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

    const caption = message.content[0].type === 'text' ? message.content[0].text.trim() : ''

    return NextResponse.json({ caption, examplesUsed: examples.length })
  } catch (error) {
    console.error('Caption generation error:', error)
    return NextResponse.json({ error: 'Failed to generate caption' }, { status: 500 })
  }
}
