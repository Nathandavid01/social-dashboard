import Anthropic from '@anthropic-ai/sdk'
import { NextRequest, NextResponse } from 'next/server'
import type { ContentIdeaType } from '@/lib/supabase/types'

const MODEL = 'claude-sonnet-4-6'
const anthropic = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY })

interface GeneratedIdea {
  content_type: ContentIdeaType
  title: string
  hook: string
  visual_brief: string
  caption_angle: string
  hashtags_suggestion: string
  rationale: string
}

async function fetchRecentPosts(blogId: string | null | undefined): Promise<string[]> {
  if (!blogId) return []
  try {
    const token = process.env.METRICOOL_TOKEN
    const userId = process.env.METRICOOL_USER_ID
    if (!token || !userId) return []

    const end = new Date()
    const start = new Date()
    start.setDate(start.getDate() - 30)
    const url = `https://app.metricool.com/api/v2/scheduler/posts?userId=${userId}&blogId=${blogId}&start=${start.toISOString().slice(0,19)}&end=${end.toISOString().slice(0,19)}`
    const res = await fetch(url, { headers: { 'X-Mc-Auth': token }, next: { revalidate: 300 } })
    if (!res.ok) return []
    const json = await res.json() as { data?: { text?: string; draft?: boolean }[] }
    return (json.data ?? [])
      .filter((p) => !p.draft && p.text && p.text.trim().length > 20)
      .slice(0, 8)
      .map((p) => p.text!.trim().slice(0, 200))
  } catch {
    return []
  }
}

export async function POST(req: NextRequest) {
  try {
    if (!process.env.ANTHROPIC_API_KEY) {
      return NextResponse.json({ error: 'ANTHROPIC_API_KEY no configurada' }, { status: 500 })
    }

    const {
      clientName,
      industry,
      brandVoice,
      captionLanguage,
      defaultCta,
      defaultHashtags,
      captionNotes,
      metricoolBlogId,
      contentTypes,        // e.g. ['R', 'P', 'C']
      theme,               // optional brief/topic
      count = 5,           // how many ideas
    } = await req.json()

    if (!clientName) {
      return NextResponse.json({ error: 'clientName is required' }, { status: 400 })
    }

    const recentPosts = await fetchRecentPosts(metricoolBlogId)
    const recentBlock = recentPosts.length > 0
      ? `RECENT POSTS (avoid repeating these themes, suggest fresh angles):\n${recentPosts.map((p, i) => `${i + 1}. ${p}`).join('\n')}`
      : 'No recent post history available.'

    const typesLabel: Record<string, string> = { R: 'Reel', P: 'Static Post', C: 'Carousel', S: 'Story' }
    const allowedTypes: ContentIdeaType[] = (Array.isArray(contentTypes) && contentTypes.length > 0)
      ? contentTypes
      : ['R', 'P', 'C']

    const clientProfile = [
      brandVoice && `Brand voice: ${brandVoice}`,
      captionLanguage && `Caption language: ${captionLanguage}`,
      defaultCta && `Default CTA: ${defaultCta}`,
      defaultHashtags && `Default hashtags: ${defaultHashtags}`,
      captionNotes && `Special rules: ${captionNotes}`,
    ].filter(Boolean).join('\n')

    const prompt = `You are a creative director at NMedia PR, a Puerto Rican social media agency. Generate ${count} content ideas for this client.

CLIENT: ${clientName}
INDUSTRY: ${industry || 'Business'}
${clientProfile ? `\nCLIENT PROFILE:\n${clientProfile}\n` : ''}
${theme ? `\nBRIEF / THEME: ${theme}\n` : ''}
ALLOWED CONTENT TYPES: ${allowedTypes.map((t) => typesLabel[t]).join(', ')}

${recentBlock}

TASK: Generate ${count} DIFFERENT content ideas. Mix the content types from the allowed list. Each idea must be specific, executable, and tailored to this client's voice and industry.

Output STRICT JSON with this shape (no markdown, no commentary, just the JSON array):
[
  {
    "content_type": "R" | "P" | "C" | "S",
    "title": "Short 6-8 word title in Spanish",
    "hook": "First 1-2 sentence hook that grabs attention in Spanish",
    "visual_brief": "Concrete visual direction for the designer/editor: shots, composition, colors, lighting, mood. 2-4 sentences in Spanish.",
    "caption_angle": "Tone, structure, and CTA direction for the copywriter. 1-2 sentences in Spanish.",
    "hashtags_suggestion": "5-8 hashtags relevant to this idea + client",
    "rationale": "Why this idea fits the client and why now. 1 sentence in Spanish."
  }
]

Rules:
- Each idea must be UNIQUE in concept (don't suggest 3 reels about the same topic)
- Pull on Puerto Rican culture, local references, and the client's industry
- visual_brief must give the designer something concrete to start with — colors, shots, composition, props
- Output ONLY the JSON array. No prose, no \`\`\`json fence, nothing else.`

    const message = await anthropic.messages.create({
      model: MODEL,
      max_tokens: 2500,
      messages: [{ role: 'user', content: prompt }],
    })

    const raw = message.content[0].type === 'text' ? message.content[0].text.trim() : ''
    // Strip code fences if Claude adds them despite instructions
    const cleaned = raw.replace(/^```(?:json)?\s*/, '').replace(/```\s*$/, '').trim()

    let ideas: GeneratedIdea[]
    try {
      ideas = JSON.parse(cleaned)
    } catch (parseErr) {
      console.error('[generate-ideas] JSON parse failed:', parseErr, '\nRaw:', raw.slice(0, 500))
      return NextResponse.json({ error: 'AI returned invalid JSON', raw: raw.slice(0, 500) }, { status: 500 })
    }

    if (!Array.isArray(ideas)) {
      return NextResponse.json({ error: 'AI did not return an array' }, { status: 500 })
    }

    return NextResponse.json({ ideas, model: MODEL, examplesUsed: recentPosts.length })
  } catch (error) {
    console.error('Idea generation error:', error)
    const message = error instanceof Error ? error.message : 'Failed to generate ideas'
    return NextResponse.json({ error: message }, { status: 500 })
  }
}
