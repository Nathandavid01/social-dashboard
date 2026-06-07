import Anthropic from '@anthropic-ai/sdk'
import { NextRequest, NextResponse } from 'next/server'
import type { ContentIdeaType } from '@/lib/supabase/types'
import { getPosts, formatDateParam } from '@/lib/metricool/client'
import {
  buildGenerationPrompt,
  buildCritiquePrompt,
  selectTopPosts,
  type PerfPost,
  type IdeaGenInput,
} from '@/lib/utils/idea-prompt'
import { getIdeaFeedbackForPrompt } from '@/lib/actions/idea-feedback'

// Upgraded to Opus with adaptive thinking: the Idea Lab strategizes before it
// writes, then critiques its own draft (two-pass) — the difference between
// generic output and expert-level ideas.
const MODEL = 'claude-opus-4-8'
const EFFORT = 'medium' as const
const anthropic = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY })

interface GeneratedIdea {
  content_type: ContentIdeaType
  objective?: string
  funnel_stage?: string
  title: string
  hook: string
  visual_brief: string
  caption_angle: string
  hashtags_suggestion: string
  rationale: string
}

/** Recent post copy — used only to avoid repeating themes. */
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

/**
 * Published posts WITH engagement (last 90 days) so the model can learn from
 * what actually performed. Never throws — returns [] if Metricool is
 * unavailable, and the generator falls back to recency only.
 */
async function fetchTopPosts(blogId: string | null | undefined): Promise<PerfPost[]> {
  if (!blogId) return []
  const userToken = process.env.METRICOOL_TOKEN
  const userId = process.env.METRICOOL_USER_ID
  if (!userToken || !userId) return []
  try {
    const end = new Date()
    const start = new Date()
    start.setDate(start.getDate() - 90)
    const posts = await getPosts(
      { userToken, userId, blogId },
      formatDateParam(start),
      formatDateParam(end)
    )
    return Array.isArray(posts) ? (posts as PerfPost[]) : []
  } catch {
    return []
  }
}

/** Call the model and return the first text block (skips thinking blocks). */
async function runModel(prompt: string, maxTokens: number): Promise<string> {
  const message = await anthropic.messages.create({
    model: MODEL,
    max_tokens: maxTokens,
    thinking: { type: 'adaptive' },
    output_config: { effort: EFFORT },
    messages: [{ role: 'user', content: prompt }],
  })
  const textBlock = message.content.find((b) => b.type === 'text')
  return textBlock && textBlock.type === 'text' ? textBlock.text.trim() : ''
}

/** Parse a strict-JSON idea array, tolerating an accidental code fence. */
function parseIdeas(raw: string): GeneratedIdea[] | null {
  const cleaned = raw.replace(/^```(?:json)?\s*/, '').replace(/```\s*$/, '').trim()
  try {
    const parsed = JSON.parse(cleaned)
    return Array.isArray(parsed) ? parsed : null
  } catch {
    return null
  }
}

export async function POST(req: NextRequest) {
  try {
    if (!process.env.ANTHROPIC_API_KEY) {
      return NextResponse.json({ error: 'ANTHROPIC_API_KEY no configurada' }, { status: 500 })
    }

    const {
      clientId,
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
      trends,              // optional string[] of trending topics/audio to riff on
      count = 5,           // how many ideas
    } = await req.json()

    // clientName optional: with it, ideas are client-tailored; without it the
    // Idea Lab runs in general agency-brainstorming mode.
    const general = !clientName
    const trendList: string[] = Array.isArray(trends)
      ? trends.map((t) => String(t).trim()).filter(Boolean).slice(0, 20)
      : []

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

    // #1 Performance-aware: learn from the client's best posts.
    // #4 Learning loop: pull the team's past approvals/rejections.
    const [topPosts, recentTexts, feedback] = await Promise.all([
      fetchTopPosts(metricoolBlogId),
      fetchRecentPosts(metricoolBlogId),
      getIdeaFeedbackForPrompt(clientId),
    ])
    const winners = selectTopPosts(topPosts, 6)

    const input: IdeaGenInput = {
      count,
      general,
      clientName,
      industry,
      clientProfile: clientProfile || undefined,
      theme: theme?.trim() || undefined,
      trends: trendList,
      typeLabels: allowedTypes.map((t) => typesLabel[t]),
      winners,
      recentTexts,
      approvedExamples: feedback.approved,
      rejectedExamples: feedback.rejected,
    }

    // Pass 1 — strategize + generate.
    const draftRaw = await runModel(buildGenerationPrompt(input), 6000)
    const draft = parseIdeas(draftRaw)
    if (!draft) {
      console.error('[generate-ideas] pass-1 JSON parse failed. Raw:', draftRaw.slice(0, 500))
      return NextResponse.json({ error: 'AI returned invalid JSON', raw: draftRaw.slice(0, 500) }, { status: 500 })
    }

    // Pass 2 — critique + refine. If it fails to parse, keep the solid draft.
    let ideas = draft
    let refined = false
    try {
      const refinedRaw = await runModel(buildCritiquePrompt(JSON.stringify(draft), input), 6000)
      const improved = parseIdeas(refinedRaw)
      if (improved && improved.length > 0) {
        ideas = improved
        refined = true
      }
    } catch (critiqueErr) {
      console.error('[generate-ideas] critique pass failed, using draft:', critiqueErr)
    }

    return NextResponse.json({
      ideas,
      model: MODEL,
      refined,
      examplesUsed: recentTexts.length,
      winnersUsed: winners.length,
    })
  } catch (error) {
    console.error('Idea generation error:', error)
    const message = error instanceof Error ? error.message : 'Failed to generate ideas'
    return NextResponse.json({ error: message }, { status: 500 })
  }
}
