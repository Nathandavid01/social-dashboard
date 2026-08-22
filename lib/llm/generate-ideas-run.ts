import type { ContentIdeaType } from '@/lib/supabase/types'
import { getPosts, formatDateParam } from '@/lib/metricool/client'
import {
  buildGenerationPrompt,
  buildCritiquePrompt,
  selectTopPosts,
  parseReferenceIdeas,
  type PerfPost,
  type IdeaGenInput,
} from '@/lib/utils/idea-prompt'
import { getIdeaFeedbackForPrompt } from '@/lib/actions/idea-feedback'
import { runIdeaModel, ideaModelId } from '@/lib/llm/idea-llm'

export interface GeneratedIdea {
  content_type: ContentIdeaType
  objective?: string
  funnel_stage?: string
  title: string
  hook: string
  visual_brief: string
  caption_angle: string
  hashtags_suggestion: string
  rationale: string
  virality_score?: number | string
}

export interface GenerateIdeaBatchInput {
  clientId?: string
  clientName?: string
  industry?: string | null
  brandVoice?: string | null
  captionLanguage?: string | null
  defaultCta?: string | null
  defaultHashtags?: string | null
  captionNotes?: string | null
  metricoolBlogId?: string | null
  contentTypes?: ContentIdeaType[]
  theme?: string
  trends?: string[]
  referenceIdeas?: string
  count?: number
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
    const url = `https://app.metricool.com/api/v2/scheduler/posts?userId=${userId}&blogId=${blogId}&start=${start.toISOString().slice(0, 19)}&end=${end.toISOString().slice(0, 19)}`
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
      formatDateParam(end),
    )
    return Array.isArray(posts) ? (posts as PerfPost[]) : []
  } catch {
    return []
  }
}

function parseIdeas(raw: string): GeneratedIdea[] | null {
  const cleaned = raw.replace(/^```(?:json)?\s*/, '').replace(/```\s*$/, '').trim()
  try {
    const parsed = JSON.parse(cleaned)
    return Array.isArray(parsed) ? parsed : null
  } catch {
    return null
  }
}

/** El mismo generador del Lab. On Site y /api/generate-ideas llaman esto. */
export async function generateIdeaBatch(input: GenerateIdeaBatchInput): Promise<{
  ideas: GeneratedIdea[]
  model: string
  refined: boolean
}> {
  const count = input.count ?? 5
  const general = !input.clientName
  const trendList: string[] = Array.isArray(input.trends)
    ? input.trends.map((t) => String(t).trim()).filter(Boolean).slice(0, 20)
    : []
  const referenceList = parseReferenceIdeas(
    typeof input.referenceIdeas === 'string' ? input.referenceIdeas : null,
  )
  const typesLabel: Record<string, string> = { R: 'Reel', P: 'Static Post', C: 'Carousel', S: 'Story' }
  const allowedTypes: ContentIdeaType[] = (Array.isArray(input.contentTypes) && input.contentTypes.length > 0)
    ? input.contentTypes
    : ['R', 'P', 'C']

  const clientProfile = [
    input.brandVoice && `Brand voice: ${input.brandVoice}`,
    input.captionLanguage && `Caption language: ${input.captionLanguage}`,
    input.defaultCta && `Default CTA: ${input.defaultCta}`,
    input.defaultHashtags && `Default hashtags: ${input.defaultHashtags}`,
    input.captionNotes && `Special rules: ${input.captionNotes}`,
  ].filter(Boolean).join('\n')

  const [topPosts, recentTexts, feedback] = await Promise.all([
    fetchTopPosts(input.metricoolBlogId),
    fetchRecentPosts(input.metricoolBlogId),
    getIdeaFeedbackForPrompt(input.clientId),
  ])
  const winners = selectTopPosts(topPosts, 6)

  const promptInput: IdeaGenInput = {
    count,
    general,
    clientName: input.clientName,
    industry: input.industry ?? undefined,
    clientProfile: clientProfile || undefined,
    theme: input.theme?.trim() || undefined,
    trends: trendList,
    typeLabels: allowedTypes.map((t) => typesLabel[t]),
    winners,
    recentTexts,
    approvedExamples: feedback.approved,
    rejectedExamples: feedback.rejected,
    referenceIdeas: referenceList,
  }

  const draftRaw = await runIdeaModel(buildGenerationPrompt(promptInput), 6000)
  const draft = parseIdeas(draftRaw)
  if (!draft) {
    throw new Error('La IA no devolvió ideas válidas')
  }

  let ideas = draft
  let refined = false
  try {
    const refinedRaw = await runIdeaModel(buildCritiquePrompt(JSON.stringify(draft), promptInput), 6000)
    const improved = parseIdeas(refinedRaw)
    if (improved && improved.length > 0) {
      ideas = improved
      refined = true
    }
  } catch {
    // keep draft
  }

  return { ideas, model: ideaModelId(process.env), refined }
}
